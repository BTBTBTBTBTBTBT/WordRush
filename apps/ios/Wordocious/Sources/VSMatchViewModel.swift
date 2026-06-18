import SwiftUI
import Combine
import WordociousCore

// MARK: - VS mode constants (mirror vs-game.tsx MODE_TOTAL_BOARDS /
// VS_MODE_MAX_GUESSES / MODE_WORD_LEN exactly)

enum VSModeInfo {
    static func totalBoards(_ mode: GameMode) -> Int {
        switch mode {
        case .quordle: return 4
        case .octordle: return 8
        case .sequence: return 4
        case .rescue: return 4
        case .gauntlet: return 21
        default: return 1
        }
    }

    static func maxGuesses(_ mode: GameMode) -> Int {
        switch mode {
        case .duel: return 6
        case .quordle: return 9
        case .octordle: return 13
        case .sequence: return 10
        case .rescue: return 6
        case .gauntlet: return 50
        case .propernoundle: return 6
        case .duel6: return 7
        case .duel7: return 8
        default: return 6
        }
    }

    static func wordLen(_ mode: GameMode) -> Int {
        switch mode {
        case .duel6: return 6
        case .duel7: return 7
        default: return 5
        }
    }

    /// Tug-of-war lead metric: boards solved dominate (weight 0.7); best-row
    /// greens add the within-board signal (weight 0.3) — computeVsProgress.
    static func progress(boardsSolved: Int, totalBoards: Int, bestGreens: Int, wordLen: Int) -> Double {
        min(1, Double(boardsSolved) / Double(max(1, totalBoards)) * 0.7
            + Double(bestGreens) / Double(max(1, wordLen)) * 0.3)
    }

    /// Max count of CORRECT tiles in any single row across all boards.
    static func bestRowGreens(_ tiles: [Int: [[TileState]]]) -> Int {
        var best = 0
        for rows in tiles.values {
            for row in rows {
                let greens = row.filter { $0 == .correct }.count
                if greens > best { best = greens }
            }
        }
        return best
    }
}

/// Drives a live VS match — the native equivalent of the state machine in
/// apps/web/components/vs/vs-game.tsx. Owns the socket service + a child
/// GameViewModel (the player's own board, engine-driven from the match seed),
/// relays the player's guesses/solves/completion, and renders opponent progress
/// from server events.
@MainActor
final class VSMatchViewModel: ObservableObject {
    enum Screen { case queue, match, waiting, result, opponentLeft, alreadyPlayedDaily, notConfigured }
    enum RematchState { case idle, offered, received, declined }

    struct OpponentProgress {
        var attempts = 0
        var solved = false
        var boardsSolved = 0
        var totalBoards = 0
        /// Gauntlet VS: highest stage the opponent has cleared (0-based count of
        /// completed stages). Updated from opponent_stage_completed events.
        var stagesCleared = 0
        /// Latest tiles per board index (each board accumulates its guess rows).
        var tiles: [Int: [[TileState]]] = [:]
    }

    let mode: GameMode
    let isDaily: Bool          // freemium daily-VS flow (free + DUEL only)
    let inviteCode: String?

    /// One opponent-milestone toast (greens / board solved / last guess).
    struct Callout: Equatable { let id: Double; let text: String }

    @Published var screen: Screen = .queue
    @Published var queuePosition = 0
    @Published var queueSize = 0           // total players waiting (queue_status.queueSize)
    @Published var countdown: Int?         // non-nil → show "Match Found" overlay
    @Published var game: GameViewModel?    // built on match_start (board modes)
    @Published var proper: ProperNoundleVM?  // built on match_start (ProperNoundle VS)
    @Published var opponent = OpponentProgress()
    @Published var result: VSMatchEnded?
    @Published var playerTimeMs: Int = 0
    @Published var rematch: RematchState = .idle
    @Published var message: String?
    @Published var dailyAnswer: String = ""
    /// Today's daily VS result for the already-played screen badge (true=won,
    /// false=lost, nil=unknown). Fetched when the already-played screen shows.
    @Published var dailyWon: Bool? = nil
    /// XP/level-up earned for this match — surfaces the same post-game toast the
    /// solo flow shows (web shows XpToast on the VS result screen too).
    @Published var xpResult: GameResultsService.XpResult?

    // ── VS experience upgrade state (mirrors vs-game.tsx) ──
    /// Full-screen 2.5s match-intro splash (skippable on tap).
    @Published var showIntro = false
    /// Opponent's Supabase user id (nil = anonymous opponent).
    @Published var opponentUserId: String?
    /// Opponent's public profile (username / avatar / level) once resolved.
    @Published var opponentInfo: VsProfile?
    /// All-time head-to-head record (nil while loading or vs anonymous).
    @Published var headToHead: HeadToHeadRecord?
    /// True while opponent typing pings arrive (hidden 2s after the last one).
    @Published var opponentTyping = false
    /// Opponent moment callout (top toast, 2.5s, dedupes consecutive).
    @Published var callout: Callout?
    /// My own guess words (boardIndex + word), mirrored locally so the result
    /// screen can render my final board with letters.
    @Published var myGuessLog: [VSGuessLogEntry] = []
    /// Boards I have solved this match (drives the tug-of-war bar).
    @Published var myBoardsSolved = 0
    /// My finished status ('won'/'lost') once I complete — drives stakes copy.
    @Published var myStatus: GameStatus?
    /// My reported totals once I complete (web playerStats).
    @Published var myFinalGuesses: Int?

    var opponentName: String { opponentInfo?.username ?? "Opponent" }
    var totalBoards: Int { VSModeInfo.totalBoards(mode) }
    var modeMaxGuesses: Int { VSModeInfo.maxGuesses(mode) }
    var wordLen: Int { VSModeInfo.wordLen(mode) }

    /// Best-row greens on MY boards. ProperNoundle has no local solution until
    /// match end, so it contributes 0 (web: mySolutions stays empty for PN).
    var myBestGreens: Int {
        guard mode != .propernoundle, let game else { return 0 }
        var best = 0
        for boardEvals in game.evaluations {
            for eval in boardEvals {
                let greens = eval.tiles.filter { $0.state == .correct }.count
                if greens > best { best = greens }
            }
        }
        return best
    }

    var myProgress: Double {
        VSModeInfo.progress(boardsSolved: myBoardsSolved, totalBoards: totalBoards,
                            bestGreens: myBestGreens, wordLen: wordLen)
    }
    var theirProgress: Double {
        VSModeInfo.progress(boardsSolved: opponent.boardsSolved, totalBoards: totalBoards,
                            bestGreens: VSModeInfo.bestRowGreens(opponent.tiles), wordLen: wordLen)
    }

    /// Unix-ms match start — drives the spectator clock.
    var startTimeMs: Double { matchStartMs }

    private let service = VSMatchService()
    private var seed = ""
    private var matchStartMs: Double = 0
    private var resultRecorded = false
    private var countdownTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    private var lastTypingSentMs: Double = 0
    private var typingHideTask: Task<Void, Never>?
    private var calloutTask: Task<Void, Never>?
    private var lastCalloutText = ""
    private var prevOppBoardsSolved = 0

    var isPro: Bool { AuthService.shared.isProActive }
    /// Freemium gating mirrors the web: daily flow only bites for free users on DUEL.
    // Daily VS is a single shared Classic puzzle per day for EVERYONE (web parity:
    // dailyVsActive dropped the !isPro guard — Pro plays the same daily VS, then
    // gets the already-played screen with a "Play Unlimited VS" prompt).
    private var dailyVsActive: Bool { isDaily && mode == .duel }

    init(mode: GameMode, isDaily: Bool = false, inviteCode: String? = nil) {
        self.mode = mode
        self.isDaily = isDaily
        self.inviteCode = inviteCode
    }

    // MARK: - Lifecycle

    func start() { Task { await startAsync() } }

    private func startAsync() async {
        guard service.isConfigured else { screen = .notConfigured; return }

        // Daily VS: a single shared Classic puzzle per day. If already played
        // (local play-limit OR a server daily_results row, so it's correct
        // cross-device), show the read-only "already played" screen instead of
        // queueing — for free AND Pro users (web parity).
        let dailySeed: String? = dailyVsActive
            ? generateDailySeed(date: LeaderboardService.todayUTC(), gameMode: "DUEL_VS")
            : nil
        if dailyVsActive {
            var played = VSPlayLimit.hasPlayedToday()
            if !played { played = await DailyResultsService.hasPlayedDailyVS() }
            if played {
                dailyAnswer = dailySeed.flatMap { generateSolutionsFromSeed($0, count: 1).first } ?? ""
                dailyWon = await DailyResultsService.dailyVSResult()
                screen = .alreadyPlayedDaily
                return
            }
        }

        wireHandlers()
        let presenceId = AuthService.shared.profile.map { "u:\($0.id)" }
        // Emit join_queue ONLY once the socket is actually connected. Emitting it
        // synchronously right after connect() drops the event — Socket.IO-Swift,
        // unlike the JS client, does NOT buffer pre-connection emits — which left
        // both players stuck on the "waiting" screen, connected but never queued.
        // Re-fires on reconnect while still in the queue (server dedupes by player
        // id); the screen guard avoids re-queuing once a match has started.
        let joinMode = mode.rawValue
        let joinSeed = dailySeed
        let joinInvite = inviteCode
        service.onConnect = { [weak self] in
            guard let self, self.screen == .queue else { return }
            self.service.joinQueue(mode: joinMode, dailySeed: joinSeed, inviteCode: joinInvite)
        }
        service.connect(presenceId: presenceId)
    }

    func leave() {
        countdownTimer?.invalidate()
        typingHideTask?.cancel()
        calloutTask?.cancel()
        service.leaveQueue()
        service.disconnect()
    }

    func forfeit() {
        // Forfeiting an IN-PROGRESS match counts as a loss and (for daily VS)
        // consumes today's play — you can't replay it. The server already
        // credits the opponent the win + writes the shared match row; this records
        // OUR side (user_stats VS loss + daily_results loss) since we leave before
        // match_ended arrives. Bailing from the queue (no match yet) records nothing.
        if (screen == .match || screen == .waiting), !resultRecorded {
            resultRecorded = true
            let secs = matchStartMs > 0 ? Int(max(0, Date().timeIntervalSince1970 * 1000 - matchStartMs) / 1000) : 0
            let gc = game?.rowsUsed ?? 0
            let solved = game?.boardsSolvedCount ?? 0
            let total = game?.boardCount ?? 1
            let theSeed = seed
            let daily = dailyVsActive
            let m = mode
            if daily { VSPlayLimit.markPlayedToday() }
            Task {
                _ = await GameResultsService.record(
                    gameMode: m, playType: "vs", won: false, guessCount: gc,
                    timeSeconds: secs, boardsSolved: solved, totalBoards: total, seed: theSeed)
                if daily { await DailyResultsService.recordVs(gameMode: m, won: false) }
            }
        }
        service.abandonMatch()
        service.disconnect()
    }

    // MARK: - User actions

    func offerRematch() {
        guard isPro else { message = "Rematches are a Pro feature."; return }
        rematch = .offered
        service.offerRematch()
    }
    /// Accepting an incoming offer is the SAME wire action as initiating one:
    /// the server starts the rematch once BOTH players have emitted
    /// `offer_rematch` (it has no `accept_rematch` handler). Mirrors the web,
    /// whose Accept button also routes through offerRematch().
    func acceptRematch() { offerRematch() }
    func declineRematch() { rematch = .declined; service.declineRematch() }

    // MARK: - Socket handlers

    private func wireHandlers() {
        service.onQueueStatus = { [weak self] in
            self?.queuePosition = $0.position
            if let size = $0.queueSize { self?.queueSize = size }
        }
        service.onMatchFound = { [weak self] in self?.handleMatchFound($0) }
        service.onOpponentTyping = { [weak self] in self?.handleOpponentTyping() }
        service.onMatchStart = { [weak self] in self?.beginMatch(seed: $0.seed, startMs: $0.startTime) }
        service.onOpponentProgress = { [weak self] in self?.applyOpponentProgress($0) }
        service.onOpponentStageCompleted = { [weak self] in
            // stageIndex is the stage the opponent just cleared (0-based) → that
            // many + 1 stages are now done.
            self?.opponent.stagesCleared = max(self?.opponent.stagesCleared ?? 0, $0.stageIndex + 1)
        }
        service.onMatchEnded = { [weak self] in self?.handleMatchEnded($0) }
        service.onRematchOffered = { [weak self] in self?.rematch = .received }
        service.onRematchDeclined = { [weak self] in self?.rematch = .declined }
        service.onRematchStart = { [weak self] in self?.beginMatch(seed: $0.seed, startMs: nil) }
        service.onOpponentLeft = { [weak self] in
            self?.message = "Opponent left the match"
            self?.screen = .opponentLeft
        }
        service.onServerError = { [weak self] in self?.message = $0.message }
    }

    private func handleMatchFound(_ data: VSMatchFound) {
        // Match-intro splash: resolve the opponent's public profile and the
        // all-time head-to-head record while the 2.5s intro plays.
        showIntro = true
        headToHead = nil
        opponentInfo = nil
        opponentUserId = data.opponentUserId
        if let oppId = data.opponentUserId {
            Task { [weak self] in
                if let p = await HeadToHeadService.fetchVsProfile(userId: oppId) {
                    self?.opponentInfo = p
                }
            }
            if let myId = AuthService.shared.profile?.id {
                Task { [weak self] in
                    self?.headToHead = await HeadToHeadService.fetchHeadToHead(myId: myId, opponentId: oppId)
                }
            }
        }

        // Private match: flip the invite row to accepted now that the server paired us.
        if let code = inviteCode {
            Task { await InviteService.markAccepted(code: code, matchId: data.matchId) }
        }
        let secs = max(1, Int(data.countdownSeconds))
        countdown = secs
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                guard let self else { t.invalidate(); return }
                if let c = self.countdown, c > 1 { self.countdown = c - 1 }
                else { self.countdown = nil; t.invalidate() }
            }
        }
    }

    private func beginMatch(seed: String, startMs: Double?) {
        self.seed = seed
        matchStartMs = startMs ?? (Date().timeIntervalSince1970 * 1000)
        opponent = OpponentProgress()
        result = nil
        rematch = .idle
        resultRecorded = false
        matchCompletionHandled = false
        countdown = nil
        // Per-match VS-experience state (web resetPerMatchState).
        myGuessLog = []
        myBoardsSolved = 0
        myStatus = nil
        myFinalGuesses = nil
        callout = nil
        calloutTask?.cancel(); calloutTask = nil
        lastCalloutText = ""
        opponentTyping = false
        typingHideTask?.cancel(); typingHideTask = nil
        prevOppBoardsSolved = 0
        cancellables.removeAll()

        // ProperNoundle uses its own engine — drive a ProperNoundleVM instead
        // of the board GameViewModel, relaying guesses/completion the same way.
        if mode == .propernoundle {
            let pvm = ProperNoundleVM(seed: seed, isVersus: true)
            pvm.onGuessCommitted = { [weak self] guess in
                self?.service.submitGuess(guess, boardIndex: 0)
                self?.myGuessLog.append(VSGuessLogEntry(boardIndex: 0, guess: guess.uppercased()))
            }
            pvm.onCompleted = { [weak self] status, guesses in
                guard let self else { return }
                let timeMs = Int(max(0, Date().timeIntervalSince1970 * 1000 - self.matchStartMs))
                self.playerTimeMs = timeMs
                if status == .won { self.myBoardsSolved = 1 }
                self.myStatus = status
                self.myFinalGuesses = guesses
                self.service.playerCompleted(status: status == .won ? "won" : "lost",
                                             totalGuesses: guesses, timeMs: timeMs)
                self.screen = .waiting
            }
            // Throttled typing relay while letters are in the current row.
            pvm.$input.dropFirst()
                .sink { [weak self] in self?.relayTyping($0) }
                .store(in: &cancellables)
            proper = pvm
            screen = .match
            return
        }

        let vm = GameViewModel(seed: seed, mode: mode, isVersus: true)
        vm.onGuessCommitted = { [weak self] guess in
            self?.service.submitGuess(guess, boardIndex: 0)
            // Mirror my own guess locally so the result screen can render my
            // final board with letters (web myGuessLog).
            self?.myGuessLog.append(VSGuessLogEntry(boardIndex: 0, guess: guess.uppercased()))
        }
        vm.onBoardSolved = { [weak self] idx in
            self?.service.boardSolved(boardIndex: idx)
            self?.myBoardsSolved += 1
        }
        vm.onStageCompleted = { [weak self] stage in self?.service.stageCompleted(stageIndex: stage) }
        vm.onCompleted = { [weak self] status, guesses in
            guard let self else { return }
            let timeMs = Int(max(0, Date().timeIntervalSince1970 * 1000 - self.matchStartMs))
            self.playerTimeMs = timeMs
            self.myStatus = status
            self.myFinalGuesses = guesses
            self.service.playerCompleted(status: status == .won ? "won" : "lost",
                                         totalGuesses: guesses, timeMs: timeMs)
            self.screen = .waiting
        }
        // Throttled typing relay while letters are in the current row.
        vm.$currentInput.dropFirst()
            .sink { [weak self] in self?.relayTyping($0) }
            .store(in: &cancellables)
        vm.resumeTimer()
        game = vm
        screen = .match
    }

    /// Emit at most one typing ping per 1.5s while the local row has letters
    /// (web handleTyping: throttled, fires on every input change).
    private func relayTyping(_ text: String) {
        guard !text.isEmpty, screen == .match else { return }
        let now = Date().timeIntervalSince1970 * 1000
        guard now - lastTypingSentMs >= 1500 else { return }
        lastTypingSentMs = now
        service.emitTyping()
    }

    private func handleOpponentTyping() {
        opponentTyping = true
        // Hide after 2s without fresh pings (the sender throttles to 1/1.5s).
        typingHideTask?.cancel()
        typingHideTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            self?.opponentTyping = false
        }
    }

    /// Show an opponent-milestone toast for 2.5s, deduping consecutive
    /// identical callouts while one is visible (web showCallout).
    private func showCallout(_ text: String) {
        if text == lastCalloutText, calloutTask != nil { return }
        lastCalloutText = text
        callout = Callout(id: Date().timeIntervalSince1970 * 1000, text: text)
        calloutTask?.cancel()
        calloutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            self?.callout = nil
            self?.calloutTask = nil
            self?.lastCalloutText = ""
        }
    }

    private func applyOpponentProgress(_ p: VSOpponentProgress) {
        opponent.attempts = p.attempts
        opponent.solved = p.solved
        opponent.boardsSolved = p.boardsSolved
        opponent.totalBoards = p.totalBoards

        // Moment callouts (one per progress event, most dramatic first).
        let name = opponentName
        var calloutText: String?
        if p.boardsSolved > prevOppBoardsSolved && p.totalBoards > 1 {
            calloutText = "\(name) solved board \(p.boardsSolved)!"
        }
        prevOppBoardsSolved = p.boardsSolved

        if let latest = p.latestGuess {
            SoundManager.shared.playOpponentThunk()
            Haptics.tap()
            var rows = opponent.tiles[latest.boardIndex] ?? []
            rows.append(latest.tileStates)
            opponent.tiles[latest.boardIndex] = rows
            let greens = latest.tiles.filter { $0 == "CORRECT" }.count
            let len = latest.tiles.count
            if calloutText == nil, len >= 2, greens == len - 1 {
                calloutText = "\(name) got \(greens) greens! 😱"
            }
        }
        if calloutText == nil, !p.solved, p.attempts == modeMaxGuesses - 1 {
            calloutText = "\(name) is on their last guess!"
        }
        if let text = calloutText { showCallout(text) }
    }

    private var matchCompletionHandled = false
    private func handleMatchEnded(_ data: VSMatchEnded) {
        // Guard against a duplicate/replayed match_ended firing the transition twice.
        guard !matchCompletionHandled else { return }
        matchCompletionHandled = true
        result = data
        screen = .result
        recordResult(data)
        if dailyVsActive { VSPlayLimit.markPlayedToday() }

        // Refresh the head-to-head line so the result screen shows the UPDATED
        // record including this match. Small delay gives the single-writer
        // client's `matches` insert time to land (web: 1.2s setTimeout).
        if let oppId = data.opponentId, let myId = AuthService.shared.profile?.id {
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                self?.headToHead = await HeadToHeadService.fetchHeadToHead(myId: myId, opponentId: oppId)
            }
        }
    }

    private func recordResult(_ data: VSMatchEnded) {
        guard !resultRecorded, AuthService.shared.profile != nil else { return }
        resultRecorded = true
        let won = data.winner == "player"
        let secs = Int((data.playerTime / 1000).rounded())
        let solved = game?.boardsSolvedCount ?? (won ? 1 : 0)
        let total = game?.boardCount ?? 1
        let theSeed = seed
        let opponentSecs = Int((data.opponentTime / 1000).rounded())
        Task {
            xpResult = await GameResultsService.record(
                gameMode: mode, playType: "vs", won: won, guessCount: data.playerGuesses,
                timeSeconds: secs, boardsSolved: solved, totalBoards: total, seed: theSeed)
            // Match-history row so this VS battle shows in Recent Matches. Only the
            // server-designated writer (recordMatch) inserts, so there's one shared row.
            if data.recordMatch == true, let opp = data.opponentId {
                await GameResultsService.recordVsMatch(
                    gameMode: mode, opponentId: opp, won: won, isDraw: data.winner == "draw",
                    playerGuesses: data.playerGuesses, opponentGuesses: data.opponentGuesses,
                    playerTimeSec: secs, opponentTimeSec: opponentSecs, seed: theSeed,
                    solutions: data.solutions ?? [],
                    myGuesses: myGuessLog.map(\.guess),
                    theirGuesses: (data.opponentGuessLog ?? []).map(\.guess),
                    forfeit: data.forfeit == true)
            }
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: mode.rawValue, playType: "vs", won: won,
                    guessCount: data.playerGuesses, timeSeconds: secs, seed: theSeed, hintsUsed: 0)
            }
        }
    }
}

/// Tiny UserDefaults-backed daily-VS play limit (the native equivalent of the
/// web's play-limit-service for the freemium daily VS gate). Keyed by local day.
enum VSPlayLimit {
    private static let key = "vs_daily_played_on"
    static func hasPlayedToday() -> Bool {
        UserDefaults.standard.string(forKey: key) == LeaderboardService.todayLocal()
    }
    static func markPlayedToday() {
        UserDefaults.standard.set(LeaderboardService.todayLocal(), forKey: key)
    }
}
