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

/// What a VS game screen was opened to do (VS overhaul, 2026-10-01): a live
/// search (with a bot stepping in at 0:15), a bot straight away, a "race my run"
/// challenge to send, or a friend's challenge to race.
enum VSIntent {
    struct SendTarget {
        let friendIds: [String]
        let link: Bool
    }
    struct GhostRun {
        let guesses: Int
        let timeMs: Double
    }
    case live
    case bot(CpuKind, ghost: GhostRun? = nil)
    case sendChallenge(SendTarget)
    case race(VsChallenge)
}

/// A finished challenge race (or a stored one), from the racer's side.
struct VSChallengeOutcome {
    let mine: VsChallengeRun
    let theirs: VsChallengeRun
    let outcome: VsOutcome
    let opponentName: String
}

/// The "race my run" transport: no opponent at all. The match simply ends when
/// the player finishes (VSMatchViewModel posts the run), so every call is a no-op.
final class SoloRunTransport: VSTransport {
    var onConnect: (() -> Void)?
    var onDisconnect: (() -> Void)?
    var onQueueStatus: ((VSQueueStatus) -> Void)?
    var onMatchFound: ((VSMatchFound) -> Void)?
    var onMatchStart: ((VSMatchStart) -> Void)?
    var onGuessResult: ((VSGuessResult) -> Void)?
    var onOpponentProgress: ((VSOpponentProgress) -> Void)?
    var onMatchEnded: ((VSMatchEnded) -> Void)?
    var onOpponentStageCompleted: ((VSStageEvent) -> Void)?
    var onRematchOffered: (() -> Void)?
    var onRematchDeclined: (() -> Void)?
    var onRematchStart: ((VSRematchStart) -> Void)?
    var onOpponentLeft: (() -> Void)?
    var onOpponentDisconnected: ((VSOpponentDisconnected) -> Void)?
    var onOpponentReconnected: (() -> Void)?
    var onOpponentTyping: (() -> Void)?
    var onServerError: ((VSServerError) -> Void)?
    var isConfigured: Bool { true }
    func connect(presenceId: String?, token: String?) {}
    func disconnect() {}
    func joinQueue(mode: String, dailySeed: String?, inviteCode: String?) {}
    func leaveQueue() {}
    func submitGuess(_ guess: String, boardIndex: Int) {}
    func boardSolved(boardIndex: Int) {}
    func playerCompleted(status: String, totalGuesses: Int, timeMs: Int) {}
    func stageCompleted(stageIndex: Int) {}
    func emitTyping() {}
    func abandonMatch() {}
    func offerRematch() {}
    func declineRematch() {}
}

/// Drives a live VS match — the native equivalent of the state machine in
/// apps/web/components/vs/vs-game.tsx. Owns the socket service + a child
/// GameViewModel (the player's own board, engine-driven from the match seed),
/// relays the player's guesses/solves/completion, and renders opponent progress
/// from server events.
@MainActor
final class VSMatchViewModel: ObservableObject {
    enum Screen { case queue, match, waiting, result, opponentLeft, matchGone, alreadyPlayedDaily, notConfigured, challengeSent, challengeResult }
    enum SendState: Equatable { case sending, sent(code: String), failed(String) }
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
    let intent: VSIntent

    /// One opponent-milestone toast (greens / board solved / last guess).
    struct Callout: Equatable { let id: Double; let text: String }

    @Published var screen: Screen = .queue
    @Published var queuePosition = 0
    @Published var queueSize = 0           // total players waiting (queue_status.queueSize)
    @Published var countdown: Int?         // non-nil → show "Match Found" overlay
    /// The countdown overlay's label: a found match, a rematch, or your own run.
    @Published var countdownLabel = "MATCH FOUND"
    private var pendingCountdownSecs = 3        // held until the intro finishes
    @Published var game: GameViewModel?    // built on match_start (board modes)
    @Published var proper: ProperNoundleVM?  // built on match_start (ProperNoundle VS)
    @Published var opponent = OpponentProgress()
    @Published var result: VSMatchEnded?
    @Published var playerTimeMs: Int = 0
    @Published var rematch: RematchState = .idle
    /// Free user received a rematch offer: it was auto-declined — show the Pro
    /// upsell modal (web parity: Rematch is Pro-only, VsLimitModal explains).
    @Published var rematchProUpsell = false
    /// Opponent's socket dropped mid-match: unix-ms deadline when the server's
    /// reconnect grace expires (a forfeit win for us). Drives the countdown
    /// banner; cleared on opponent_reconnected / match end.
    @Published var opponentDisconnectDeadline: Double?
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
    /// Snapshot of MY final board state (guesses + per-row hintEvaluations +
    /// statuses), captured at match end BEFORE anything resets. The result
    /// recap renders MY side from this so hint rows survive — re-evaluating
    /// myGuessLog loses them (Six/Seven hints go through .submitHint and never
    /// hit onGuessCommitted, so the log shows 3 rows while the score says 4).
    /// The OPPONENT side stays log-based: bots never use hints, and a human
    /// opponent's hints aren't relayed by the server (known limitation).
    @Published var myFinalBoards: [BoardState]?
    /// ProperNoundle VS: my final rows (raw words + REAL tiles, which carry
    /// .hintUsed states the recorded word list can't reproduce).
    @Published var myFinalPNRows: [VSPNRecapRow]?
    /// Boards I have solved this match (drives the tug-of-war bar).
    @Published var myBoardsSolved = 0
    /// My finished status ('won'/'lost') once I complete — drives stakes copy.
    @Published var myStatus: GameStatus?
    /// My reported totals once I complete (web playerStats).
    @Published var myFinalGuesses: Int?

    // ── Live search step-in (§6): a bot takes over at 0:15 unless KEEP WAITING ──
    /// When the human search started (drives the ring timer and the step-in bar).
    @Published var searchStartedAt: Date?
    /// KEEP WAITING was tapped: no automatic step-in (PLAY NOW stays).
    @Published var keepWaiting = false
    /// The line under the step-in card's buttons after KEEP WAITING pinged
    /// the opted-in players (§13); nil keeps "We’ll keep looking".
    @Published var lookingNote: String?
    private var stepInTask: Task<Void, Never>?
    private var humanMatchFound = false
    private var dailySeedValue: String?

    // ── Async challenges (§3–§5) ──
    /// The run being sent and the POST's progress (challenge-send game).
    @Published var sentRun: VsChallengeRun?
    @Published var sendState: SendState = .sending
    /// The finished race (challenge race game) and any note from saving it.
    @Published var challengeOutcome: VSChallengeOutcome?
    @Published var challengeNote: String?

    var raceChallenge: VsChallenge? { if case .race(let c) = intent { return c }; return nil }
    var sendTarget: VSIntent.SendTarget? { if case .sendChallenge(let t) = intent { return t }; return nil }
    var isRace: Bool { raceChallenge != nil }
    var isSend: Bool { sendTarget != nil }
    /// A live search that can hand off to a bot: not a private invite, not a bot / challenge game.
    var canStepIn: Bool {
        if case .live = intent { return inviteCode == nil }
        return false
    }
    /// "Ping me when someone's looking" (§13): Pro, live random queue only — not
    /// the Daily Battle, not a private invite.
    var canPingLooking: Bool { canStepIn && isPro && !dailyVsActive }
    /// The bot that steps in: Lexi for the Daily Battle, else the ladder's next bot.
    var stepInKind: CpuKind { VsLobbyKit.stepInKind(isDaily: dailyVsActive) }

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

    /// The player's race clock: paused while their own Gauntlet stage card is up
    /// (founder: VS matches solo), so every recorded time excludes the card time.
    private var raceClock = RaceClock(startMs: 0)
    private static var nowMs: Double { Date().timeIntervalSince1970 * 1000 }
    /// Race time so far (card time excluded) — the header clock and every recorded time.
    func elapsedMs() -> Double { raceClock.elapsedMs(at: Self.nowMs) }
    /// The stage card went up / came down (VSGameView).
    func stageCardShown() { raceClock.pause(at: Self.nowMs) }
    func stageCardDone() { raceClock.resume(at: Self.nowMs) }

    // Swappable transport: socket by default, hot-swapped to a client-side CPU
    // bot when the player picks "Play the CPU" (Pro-only practice).
    private var service: VSTransport = VSMatchService()

    // ── CPU-vs state ──
    @Published var isCpu = false
    @Published var cpuPersona: CpuIdentity?
    private var cpuKind: CpuKind?
    // Fun layer (CPU only): photo-finish ("photo"/"clutch"), streak milestone,
    // cosmetic unlock, current streak, and a per-session run-it-back tally.
    @Published var photoFinish: String?
    @Published var cpuMilestone: Int?
    @Published var cpuUnlock: String?
    /// The ladder rung this bot game cleared (a bot id), if any.
    @Published var cpuClearedRung: String?
    @Published var cpuStreak = 0
    @Published var cpuSessionWins = 0
    @Published var cpuSessionLosses = 0

    private(set) var seed = ""   // exposed read-only: VSFinalBoards replays multi-board recaps from it
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
    init(mode: GameMode, isDaily: Bool = false, inviteCode: String? = nil, intent: VSIntent = .live) {
        self.mode = mode
        self.isDaily = isDaily
        self.inviteCode = inviteCode
        self.intent = intent
    }

    // MARK: - Lifecycle

    /// Once per screen: the view's onAppear fires again when a page pushed from
    /// the result (CHALLENGE BACK, Pro) pops back, and that must not start a
    /// second game.
    private var started = false
    func start() {
        guard !started else { return }
        started = true
        Task { await startAsync() }
    }

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

        // The lobby already chose (VS overhaul): a live search, a bot, or a challenge.
        dailySeedValue = dailySeed
        switch intent {
        case .live:
            joinHumanQueue(dailySeed: dailySeed)
        case .bot(let kind, let ghost):
            let fixed: String? = kind == .daily
                ? generateDailySeed(date: LeaderboardService.todayUTC(), gameMode: "\(mode.rawValue)_CPU")
                : nil
            startCpu(kind, ghost: ghost.map { (guesses: $0.guesses, timeMs: $0.timeMs) }, fixedSeed: fixed)
        case .sendChallenge:
            startChallengeSend()
        case .race(let c):
            startRace(c)
        }
    }

    /// Join the live human matchmaking queue (the lobby's LIVE / DAILY tiles and
    /// invite links). A plain search starts the 15 s step-in clock.
    func joinHumanQueue(dailySeed: String? = nil) {
        let seed = dailySeed ?? (dailyVsActive ? generateDailySeed(date: LeaderboardService.todayUTC(), gameMode: "DUEL_VS") : nil)
        screen = .queue
        humanMatchFound = false
        if canStepIn { beginStepInClock() }
        wireHandlers()
        let presenceId = AuthService.shared.profile.map { "u:\($0.id)" }
        // Emit join_queue ONLY once the socket is actually connected. Emitting it
        // synchronously right after connect() drops the event — Socket.IO-Swift,
        // unlike the JS client, does NOT buffer pre-connection emits — which left
        // both players stuck on the "waiting" screen, connected but never queued.
        // Re-fires on reconnect while still in the queue (server dedupes by player
        // id); the screen guard avoids re-queuing once a match has started.
        let joinMode = mode.rawValue
        let joinInvite = inviteCode
        service.onConnect = { [weak self] in
            guard let self, self.screen == .queue else { return }
            self.service.joinQueue(mode: joinMode, dailySeed: seed, inviteCode: joinInvite)
        }
        service.connect(presenceId: presenceId, token: AuthService.shared.accessToken)
    }

    /// CPU spectator shortcut: end the match now instead of watching the bot's
    /// timer run down, once its result can no longer beat the player. The bot's
    /// outcome is already fixed by its plan, and the player's time was captured
    /// at their completion — so this just skips the wait.
    func finishCpuNow() { guard isCpu else { return }; service.resolveNow() }

    // MARK: - Step-in (§6)

    private func beginStepInClock() {
        stepInTask?.cancel()
        searchStartedAt = Date()
        keepWaiting = false
        stepInTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 15_000_000_000)
            guard let self, !Task.isCancelled, !self.keepWaiting else { return }
            self.stepInNow()
        }
    }

    /// KEEP WAITING: stay in the human queue; PLAY NOW stays available.
    /// Pro on the live random queue also pings the players who opted in (§13).
    func keepWaitingTapped() {
        keepWaiting = true
        stepInTask?.cancel()
        guard canPingLooking else { return }
        let m = mode
        Task { [weak self] in
            guard let p = await VsLookingService.ping(gameMode: m) else { return }
            self?.lookingNote = VsLookingService.line(p)
        }
    }

    /// PLAY <BOT> NOW, or the automatic step-in at 0:15. A person who matched
    /// first wins: nothing happens once a match was found. The Daily Battle's
    /// bot plays today's shared daily puzzle (the play is consumed at start).
    func stepInNow() {
        guard canStepIn, screen == .queue, !isCpu, !humanMatchFound, countdown == nil, !showIntro else { return }
        stepInTask?.cancel()
        service.leaveQueue()
        startCpu(stepInKind, fixedSeed: dailyVsActive ? dailySeedValue : nil)
    }

    func leave() {
        stepInTask?.cancel()
        countdownTimer?.invalidate()
        typingHideTask?.cancel()
        calloutTask?.cancel()
        service.leaveQueue()
        service.disconnect()
    }

    /// Swap the socket transport for a client-side CPU bot and start a match.
    /// Pro-gated in the UI. `ghost` supplies (guessCount, timeMs) for Beat Your
    /// Best; `fixedSeed` is the Bot-of-the-Day daily seed.
    func startCpu(_ kind: CpuKind, ghost: (guesses: Int, timeMs: Double)? = nil, fixedSeed: String? = nil) {
        stepInTask?.cancel()
        let oppId = CpuOpponent.opponentId(kind)
        let id = CpuOpponent.identity(oppId)
        cpuKind = kind
        cpuPersona = id
        isCpu = true
        countdownTimer?.invalidate()
        service.disconnect()

        var config = BotConfig(opponentId: oppId)
        // FINISH_SPEC §D1: Umi (the old Adapt) matches the player's form; every
        // other cast bot plays its own guess range at its speed tier.
        if id.adaptive {
            config.adaptive = BotEngine.AdaptiveHint(winRate: min(0.9, 0.4 + Double(CpuProgressionStore.load().streak) * 0.05))
        } else if let m = id.persona?.member, let lo = m.minGuesses, let hi = m.maxGuesses {
            config.guessRange = lo...max(lo, hi)
        }
        if let ghost { config.ghostGuesses = ghost.guesses; config.ghostTimeMs = ghost.timeMs }
        if let fixedSeed { config.fixedSeed = fixedSeed }
        let engineDifficulty = BotDifficulty(rawValue: id.adaptive ? "adaptive" : id.tier.rawValue) ?? .medium

        let bot = LocalBotMatchService(difficulty: engineDifficulty, config: config)
        service = bot
        screen = .queue
        resultRecorded = false
        matchCompletionHandled = false
        wireHandlers()
        service.onConnect = { [weak self] in
            guard let self, self.screen == .queue else { return }
            self.service.joinQueue(mode: self.mode.rawValue, dailySeed: nil, inviteCode: nil)
        }
        service.connect(presenceId: nil, token: nil)
    }

    /// Race a friend's run (§4): the local bot service replays a ghost of it —
    /// the challenge's seed, its guess count and solve time, solving only if the
    /// run did. The opponent is the challenger (their profile + head-to-head),
    /// never a bot label; the outcome is VsLobby.vsOutcome, not the bot's own.
    func startRace(_ c: VsChallenge) {
        countdownTimer?.invalidate()
        service.disconnect()
        var config = BotConfig(fixedSeed: c.seed, opponentId: c.challenger.id)
        config.ghostGuesses = max(1, c.run.guesses)
        config.ghostTimeMs = Double(max(1000, c.run.timeMs))
        config.ghostSolves = c.run.solved
        service = LocalBotMatchService(difficulty: .medium, config: config)
        screen = .queue
        resultRecorded = false
        matchCompletionHandled = false
        wireHandlers()
        service.onConnect = { [weak self] in
            guard let self, self.screen == .queue else { return }
            self.service.joinQueue(mode: self.mode.rawValue, dailySeed: nil, inviteCode: nil)
        }
        service.connect(presenceId: nil, token: nil)
    }

    /// Play first, then send (§3): a fresh seed, no opponent, a 3-2-1 and go.
    /// Nothing is recorded to the challenger's stats now — each friend's race
    /// adds the game to both players later (server side).
    private func startChallengeSend() {
        service = SoloRunTransport()
        screen = .queue
        countdownLabel = "YOUR RUN STARTS IN"
        countdownThenBegin(seed: generateMatchSeed())
    }

    /// The finished run as the challenge API stores it (guesses = the VS score unit).
    private func buildMyRun(guesses: Int, timeMs: Int, solutions: [String]?) -> VsChallengeRun {
        let solved = myStatus == .won
        let total = totalBoards
        let boards = solved ? total : min(total, max(myBoardsSolved, game?.boardsSolvedCount ?? 0))
        let sols = (solutions?.isEmpty == false) ? (solutions ?? []) : BotEngine.matchSolutions(seed: seed, mode: mode)
        return VsChallengeRun(solved: solved, boardsSolved: boards, totalBoards: total, guesses: guesses,
                              timeMs: timeMs, guessLog: myGuessLog.map(\.guess), solutions: sols)
    }

    private func finishChallengeSend(guesses: Int, timeMs: Int) {
        guard isSend else { return }
        // Snapshot like a match end, so nothing resets under the sent screen.
        myFinalBoards = game?.state.boards
        sentRun = buildMyRun(guesses: guesses, timeMs: timeMs, solutions: nil)
        screen = .challengeSent
        sendChallenge()
    }

    /// POST the run (also the sent screen's retry).
    func sendChallenge() {
        guard let target = sendTarget, let run = sentRun else { return }
        sendState = .sending
        let m = mode, s = seed
        Task { [weak self] in
            let r = await VsChallengeService.create(gameMode: m, seed: s, run: run, friendIds: target.friendIds, link: target.link)
            switch r {
            case .success(let c): self?.sendState = .sent(code: c.code)
            case .failure(let e): self?.sendState = .failed(e.message)
            }
        }
    }

    /// The race is over the moment the player finishes: score it with the live
    /// rule, post it (the server writes the shared matches row and the
    /// challenger's side), then record OUR side through the normal live-VS path
    /// (XP, achievements) — never a client matches row, never vs_cpu.
    private func finishRace(_ data: VSMatchEnded) {
        guard let c = raceChallenge, !resultRecorded else { return }
        resultRecorded = true
        let mine = buildMyRun(guesses: data.playerGuesses, timeMs: Int(data.playerTime.rounded()), solutions: data.solutions)
        let outcome = VsLobby.vsOutcome(mine.vsRun, c.run.vsRun)
        challengeOutcome = VSChallengeOutcome(mine: mine, theirs: c.run, outcome: outcome, opponentName: c.challenger.username)
        screen = .challengeResult
        guard AuthService.shared.profile != nil else { return }
        let pending = VsPendingRaces.make(code: c.code, mode: mode, seed: seed, run: mine)
        let oppId = c.challenger.id
        Task { [weak self] in
            // Accepted → our side (+ XP) is recorded; offline / 5xx → kept in the
            // pending list and retried from the lobby (§14).
            switch await VsPendingRaces.submit(pending) {
            case .recorded(let xp): self?.xpResult = xp
            case .alreadyRecorded: self?.challengeNote = "You already raced this run — your first result stands."
            case .saved: self?.challengeNote = VsPendingRaces.savedNote
            case .failed(let message): self?.challengeNote = message
            }
            // The server wrote the shared matches row — refresh the head-to-head.
            if let myId = AuthService.shared.profile?.id {
                self?.headToHead = await HeadToHeadService.fetchHeadToHead(myId: myId, opponentId: oppId)
            }
        }
    }

    /// Leaving now would actually forfeit (a recorded loss): only while still
    /// MID-GAME. Once finished (waiting screen) — or once the match is over /
    /// gone — leaving records nothing.
    /// A race quit counts too (§14): the run posts as not solved, a loss.
    var leaveWouldForfeit: Bool { screen == .match && myStatus == nil && (!isLocalOpponent || isRace) && !resultRecorded }
    /// A bot, a challenge ghost or no opponent at all — nothing on a server to forfeit.
    var isLocalOpponent: Bool { isCpu || isRace || isSend }

    func forfeit() {
        // Forfeiting an IN-PROGRESS match counts as a loss and (for daily VS)
        // consumes today's play — you can't replay it. The server already
        // credits the opponent the win + writes the shared match row; this records
        // OUR side (user_stats VS loss + daily_results loss) since we leave before
        // match_ended arrives. Bailing from the queue (no match yet) records nothing.
        // A FINISHED player leaving the spectator screen is NOT a forfeit: their
        // result is already submitted, so record nothing here — the server
        // resolves the match (opponent finishes, or its idle/hard-cap timeout)
        // and a match_ended that lands before teardown still records normally.
        // Same for a zombie match (.matchGone): the match no longer exists
        // server-side, so a local loss would be fabricated.
        // CPU practice is never a ranked loss: quitting a bot match records
        // nothing (parity with the clean-end CPU path, which only writes the
        // separate vs_cpu bucket — and with the web, where a CPU abandon is a
        // pure teardown).
        // A friend's race quit mid-game is the same on every platform (§14): the
        // run posts as NOT solved and the racer's side records as a loss (kept
        // in the pending list when offline). Quitting a challenge send sends
        // nothing; quitting a bot game records nothing.
        if screen == .match, myStatus == nil, !resultRecorded, let c = raceChallenge {
            resultRecorded = true
            if AuthService.shared.profile != nil {
                let elapsed = Int(elapsedMs())
                let rows = game?.rowsUsed ?? proper?.guesses.count ?? myGuessLog.count
                let run = VsChallengeRun(solved: false, boardsSolved: 0, totalBoards: totalBoards, guesses: rows,
                                         timeMs: elapsed, guessLog: myGuessLog.map(\.guess),
                                         solutions: BotEngine.matchSolutions(seed: seed, mode: mode))
                let pending = VsPendingRaces.make(code: c.code, mode: mode, seed: seed, run: run, quit: true)
                // Outlives this screen (it dismisses right away).
                Task { _ = await VsPendingRaces.submit(pending) }
            }
        }
        if screen == .match, myStatus == nil, !resultRecorded, !isLocalOpponent {
            resultRecorded = true
            let secs = Int(elapsedMs() / 1000)
            let gc = game?.rowsUsed ?? 0
            let solved = game?.boardsSolvedCount ?? 0
            let total = game?.boardCount ?? 1
            let theSeed = seed
            let daily = dailyVsActive
            let m = mode
            if daily { VSPlayLimit.markPlayedToday() }
            Task {
                // record()'s vs branch also writes the daily_results vs row —
                // a second explicit recordVs here double-counted the loss.
                _ = await GameResultsService.record(
                    gameMode: m, playType: "vs", won: false, guessCount: gc,
                    timeSeconds: secs, boardsSolved: solved, totalBoards: total, seed: theSeed)
            }
        }
        // Only abandon when still mid-game (or CPU teardown). A finished player
        // emitting abandon_match would turn their already-submitted result into
        // a forfeit win for the opponent — disconnect and let the server
        // resolve the match (opponent finishes on merit, or its reconnect-grace
        // timeout). A gone match (.matchGone) has nothing to abandon.
        if isLocalOpponent || (myStatus == nil && screen != .matchGone) { service.abandonMatch() }
        service.disconnect()
    }

    // MARK: - App lifecycle (scenePhase)

    /// Server-side reconnect grace: a dropped socket forfeits after this long.
    /// Mirrors the server's RECONNECT_GRACE_MS.
    private static let serverGraceMs: Double = 60_000
    /// Wall-clock (unix ms) when the app was backgrounded mid-match.
    private var backgroundedAtMs: Double?

    /// scenePhase → .background while playing a HUMAN match: the socket will
    /// drop and the server holds our slot for its 60s reconnect grace.
    func appDidEnterBackground() {
        guard !isLocalOpponent, screen == .match || screen == .waiting else { return }
        backgroundedAtMs = Date().timeIntervalSince1970 * 1000
    }

    /// scenePhase → .active: if we were backgrounded past the server's grace
    /// window the match no longer exists server-side (we were forfeited).
    /// Transition to the clean "match ended while you were away" state instead
    /// of leaving a zombie board that loops "Not in a match" toasts — and never
    /// record a local loss here (the server already resolved the match; only a
    /// match_ended that actually arrived records anything).
    func appDidBecomeActive() {
        guard let bg = backgroundedAtMs else { return }
        backgroundedAtMs = nil
        guard !isLocalOpponent, screen == .match || screen == .waiting else { return }
        if Date().timeIntervalSince1970 * 1000 - bg > Self.serverGraceMs {
            markMatchGone()
        }
    }

    /// The match no longer exists server-side (backgrounded past the reconnect
    /// grace, or the server answered "Not in a match"). Show the clean
    /// match-gone screen; forfeit()/goHome from there records nothing.
    private func markMatchGone() {
        guard screen == .match || screen == .waiting else { return }
        opponentDisconnectDeadline = nil
        screen = .matchGone
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
        service.onMatchStart = { [weak self] in self?.beginMatch(seed: $0.seed, startMs: $0.startTime, solutions: $0.solutions) }
        service.onOpponentProgress = { [weak self] in self?.applyOpponentProgress($0) }
        service.onOpponentStageCompleted = { [weak self] in
            // stageIndex is the stage the opponent just cleared (0-based) → that
            // many + 1 stages are now done.
            self?.opponent.stagesCleared = max(self?.opponent.stagesCleared ?? 0, $0.stageIndex + 1)
        }
        service.onMatchEnded = { [weak self] in self?.handleMatchEnded($0) }
        service.onRematchOffered = { [weak self] in
            guard let self else { return }
            if self.isPro {
                self.rematch = .received
            } else {
                // Rematch is Pro-only: auto-decline so the Pro opponent's
                // "Waiting…" resolves instead of hanging on a button this
                // player can't accept, then show the Pro upsell (web parity —
                // non-Pro Rematch routes to VsLimitModal).
                self.service.declineRematch()
                self.rematch = .declined
                self.rematchProUpsell = true
            }
        }
        service.onRematchDeclined = { [weak self] in self?.rematch = .declined }
        service.onRematchStart = { [weak self] in self?.beginRematch(seed: $0.seed, solutions: $0.solutions) }
        service.onOpponentLeft = { [weak self] in
            // Only meaningful while actually mid-match or spectating — a stray
            // opponent_left on the queue/result screens must not clobber them
            // (the forfeit-win match_ended that follows this event sets .result).
            guard let self, self.screen == .match || self.screen == .waiting else { return }
            self.opponentDisconnectDeadline = nil
            self.message = "Opponent left the match"
            self.screen = .opponentLeft
        }
        service.onOpponentDisconnected = { [weak self] data in
            // Opponent's socket dropped: the server holds the match open for a
            // reconnect grace window, then forfeits them. Surface a countdown
            // banner against that deadline.
            guard let self, self.screen == .match || self.screen == .waiting else { return }
            let grace = data.graceSeconds ?? 60
            self.opponentDisconnectDeadline = Date().timeIntervalSince1970 * 1000 + grace * 1000
        }
        service.onOpponentReconnected = { [weak self] in self?.opponentDisconnectDeadline = nil }
        service.onServerError = { [weak self] err in
            guard let self else { return }
            // "Not in a match" while we think we're playing = the server ended
            // our match while we were away (reconnect grace expired / idle or
            // hard-cap timeout). One clean transition, not an error-toast loop.
            if err.message == "Not in a match", !self.isCpu,
               self.screen == .match || self.screen == .waiting {
                self.markMatchGone()
            } else {
                self.message = err.message
            }
        }
    }

    private func handleMatchFound(_ data: VSMatchFound) {
        // Match-intro splash: resolve the opponent's public profile and the
        // all-time head-to-head record while the 2.5s intro plays.
        showIntro = true
        headToHead = nil
        opponentInfo = nil
        opponentUserId = data.opponentUserId
        if !isCpu && !isRace { humanMatchFound = true; stepInTask?.cancel() }
        if let oppId = data.opponentUserId, CpuOpponent.isCpu(oppId) {
            // Bot opponent: the persona identity and art locally — no profile / H2H fetch.
            let id = CpuOpponent.identity(oppId)
            // Labelled a bot by name ("Opal · Bot"), drawn as its character.
            opponentInfo = VsProfile(username: "\(id.name) · Bot", avatarUrl: nil, level: 0, botArt: id.art)
        } else if let c = raceChallenge {
            // Challenge ghost: the challenger themself (never a bot label) + head-to-head.
            opponentInfo = VsProfile(username: c.challenger.username, avatarUrl: c.challenger.avatarUrl, level: 0)
            // BJ5: their full look (mascot / cast / frame) lands before the intro slams in.
            AvatarDirectory.shared.want(userIds: [c.challenger.id])
            if let myId = AuthService.shared.profile?.id {
                Task { [weak self] in
                    self?.headToHead = await HeadToHeadService.fetchHeadToHead(myId: myId, opponentId: c.challenger.id)
                }
            }
        } else if let oppId = data.opponentUserId {
            AvatarDirectory.shared.want(userIds: [oppId])   // BJ5: their full look before the intro
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
        // Don't tick the countdown WHILE the intro clash is on screen — otherwise
        // it counts down behind the splash and only a stale "1" flashes when the
        // intro lifts. Hold it and start ticking when the intro finishes (below).
        pendingCountdownSecs = max(1, Int(data.countdownSeconds))
    }

    /// Start the visible match-start countdown — called when the match-intro
    /// splash finishes, so the "3-2-1" reads smoothly instead of flashing a
    /// leftover number. beginMatch (match_start) clears it when the board loads.
    func startCountdownTick() {
        guard countdown == nil, screen == .queue else { return }
        countdown = pendingCountdownSecs
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                guard let self else { t.invalidate(); return }
                // The countdown was already cleared (beginMatch ran and faded GO!
                // out, or the match went away): stop — never resurrect "GO!".
                // Founder + Oliver, 2026-09-26: a tick landing just after the fade
                // re-set countdown = 0 over the LIVE board and the old safety only
                // cleared it on the queue screen, so both phones sat on "GO!".
                guard let c = self.countdown else { t.invalidate(); return }
                if c > 1 { self.countdown = c - 1 }
                else {
                    // 3-2-1-GO: hold "GO!" (countdown == 0) — beginMatch fades it
                    // out over the first beat of the board. Safety: if the match
                    // never starts, drop the overlay after 2.5s regardless of screen.
                    self.countdown = 0
                    t.invalidate()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
                        if self?.countdown == 0 { self?.countdown = nil }
                    }
                }
            }
        }
    }

    /// Rematch start — unlike the initial match there's no match-intro splash, so
    /// run a short 3-2-1 countdown (mirrors the initial MATCH_COUNTDOWN) before
    /// the board resets, instead of snapping straight into a new game. The bot's
    /// engine is likewise delayed by the same 3s so the pacing stays aligned.
    private func beginRematch(seed: String, solutions: [String]? = nil) {
        rematch = .idle
        showIntro = false
        countdownLabel = "REMATCH STARTING IN"
        countdownThenBegin(seed: seed, solutions: solutions)
    }

    /// A 3-2-1 overlay, then the board (rematches and your own challenge run).
    private func countdownThenBegin(seed: String, solutions: [String]? = nil) {
        let start = Date().timeIntervalSince1970 * 1000 + 3000
        countdown = 3
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                guard let self else { t.invalidate(); return }
                if let c = self.countdown, c > 1 { self.countdown = c - 1 }
                else { t.invalidate(); self.beginMatch(seed: seed, startMs: start, solutions: solutions) }
            }
        }
    }

    private func beginMatch(seed: String, startMs: Double?, solutions: [String]? = nil) {
        self.seed = seed
        matchStartMs = startMs ?? (Date().timeIntervalSince1970 * 1000)
        raceClock = RaceClock(startMs: matchStartMs)
        opponent = OpponentProgress()
        result = nil
        rematch = .idle
        rematchProUpsell = false
        opponentDisconnectDeadline = nil
        backgroundedAtMs = nil
        resultRecorded = false
        matchCompletionHandled = false
        // Daily VS is CONSUMED at match START, not at the end — once the shared
        // daily board is revealed, backgrounding/killing the app mid-match must
        // not hand back a fresh attempt at the same (now known) puzzle. The
        // end-of-match/forfeit markings stay as idempotent backstops.
        // A bot that stepped into the Daily Battle consumes it too (§6).
        if dailyVsActive { VSPlayLimit.markPlayedToday() }
        // 3-2-1-GO: if a countdown was running, flash "GO!" over the board's
        // first ~0.6s instead of cutting straight from "1" into the game. The
        // tick timer is stopped HERE so a late tick can never re-show "GO!".
        countdownTimer?.invalidate(); countdownTimer = nil
        if countdown != nil {
            countdown = 0
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                if self?.countdown == 0 { self?.countdown = nil }
            }
        }
        // Per-match VS-experience state (web resetPerMatchState).
        myGuessLog = []
        myFinalBoards = nil
        myFinalPNRows = nil
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
                let timeMs = Int(self.elapsedMs())
                self.playerTimeMs = timeMs
                if status == .won { self.myBoardsSolved = 1 }
                self.myStatus = status
                self.myFinalGuesses = guesses
                // .waiting BEFORE playerCompleted — see the board-mode note above:
                // a fast CPU can end the match synchronously here (screen=.result).
                self.screen = .waiting
                self.service.playerCompleted(status: status == .won ? "won" : "lost",
                                             totalGuesses: guesses, timeMs: timeMs)
                self.afterPlayerCompleted(guesses: guesses, timeMs: timeMs)
            }
            // Throttled typing relay while letters are in the current row.
            pvm.$input.dropFirst()
                .sink { [weak self] in self?.relayTyping($0) }
                .store(in: &cancellables)
            proper = pvm
            screen = .match
            return
        }

        // Server-dealt words win over seed derivation — same puzzle for both
        // players even across app versions (Dave + his girlfriend, 2026-09-26).
        let vm = GameViewModel(seed: seed, mode: mode, isVersus: true, solutions: solutions)
        vm.onGuessCommitted = { [weak self] guess, boardIndex in
            // Relay the ACTUAL board this guess landed on (not a hardcoded 0) so
            // the server evaluates it against the right solution and the
            // opponent's per-board mini-board populates the correct board. For
            // single-board / quordle-style applyToAll modes this is 0 as before.
            self?.service.submitGuess(guess, boardIndex: boardIndex)
            // Mirror my own guess locally so the result screen can render my
            // final board with letters (web myGuessLog).
            self?.myGuessLog.append(VSGuessLogEntry(boardIndex: boardIndex, guess: guess.uppercased()))
        }
        vm.onBoardSolved = { [weak self] idx in
            self?.service.boardSolved(boardIndex: idx)
            self?.myBoardsSolved += 1
        }
        vm.onStageCompleted = { [weak self] stage in self?.service.stageCompleted(stageIndex: stage) }
        vm.onCompleted = { [weak self] status, guesses in
            guard let self else { return }
            let timeMs = Int(self.elapsedMs())
            self.playerTimeMs = timeMs
            self.myStatus = status
            self.myFinalGuesses = guesses
            // Go to the spectator screen FIRST: playerCompleted can end the match
            // synchronously (when a fast CPU already finished), which sets
            // screen=.result — setting .waiting after would clobber it back and
            // strand the match (ended internally, stuck on the spectator screen).
            self.screen = .waiting
            self.service.playerCompleted(status: status == .won ? "won" : "lost",
                                         totalGuesses: guesses, timeMs: timeMs)
            self.afterPlayerCompleted(guesses: guesses, timeMs: timeMs)
        }
        // Throttled typing relay while letters are in the current row.
        vm.$currentInput.dropFirst()
            .sink { [weak self] in self?.relayTyping($0) }
            .store(in: &cancellables)
        vm.resumeTimer()
        game = vm
        screen = .match
    }

    /// A challenge game ends with the player: a race resolves now (the outcome
    /// is the live rule against the stored run, not the ghost's finish), and a
    /// send posts the run.
    private func afterPlayerCompleted(guesses: Int, timeMs: Int) {
        if isRace { service.resolveNow() }
        else if isSend { finishChallengeSend(guesses: guesses, timeMs: timeMs) }
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
        // V6: a late in-flight progress event after the match ends (or between
        // rematch reset and rematch start) must not mutate opponent state --
        // it corrupted the result recap / freshly-reset rematch HUD.
        guard screen == .match || screen == .waiting else { return }
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

        // applyToAll modes (quordle/octordle/rescue) send `latestGuesses` — the
        // guess against every unsolved board — so all the opponent's per-board
        // mini-boards populate, not just board 0. Single-board / sequence use the
        // single `latestGuess`.
        let perBoard = p.latestGuesses ?? p.latestGuess.map { [$0] } ?? []
        if !perBoard.isEmpty {
            SoundManager.shared.playOpponentThunk()
            Haptics.tap()
            for g in perBoard {
                var rows = opponent.tiles[g.boardIndex] ?? []
                rows.append(g.tileStates)
                opponent.tiles[g.boardIndex] = rows
            }
            // "N greens!" keys off the focused board (single latestGuess) or the
            // first fanned-out board.
            let primary = p.latestGuess ?? perBoard[0]
            let greens = primary.tiles.filter { $0 == "CORRECT" }.count
            let len = primary.tiles.count
            if calloutText == nil, len >= 2, greens == len - 1 {
                calloutText = "\(name) got \(greens) greens!"
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
        // Snapshot MY final board state before anything can reset it — the
        // recap renders my side from this (hint rows included). See the
        // myFinalBoards doc comment.
        myFinalBoards = game?.state.boards
        myFinalPNRows = proper.map { p in p.guesses.map { VSPNRecapRow(word: $0.word, tiles: $0.tiles) } }
        opponentDisconnectDeadline = nil
        if isRace { finishRace(data); return }
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

        if isCpu {
            // Pure practice: record ONLY the separate vs_cpu bucket — no XP, no
            // matches row, no head-to-head, no achievements, no daily lock.
            let m = mode
            let g = data.playerGuesses
            Task { await GameResultsService.recordCpuResult(gameMode: m, won: won, guessCount: g, timeSeconds: secs) }
            // Fun layer: progression (streak / ladder / cosmetics / milestone),
            // session tally, photo-finish on a close / last-guess win.
            let tier = cpuPersona?.tier ?? .medium
            let dayResult: VsDayResult = data.winner == "draw" ? .draw : (won ? .won : .lost)
            let outcome = CpuProgressionStore.recordGame(won: won, tier: tier,
                                                         personaId: cpuPersona?.persona?.id ?? BotPersonas.persona(tier).id,
                                                         botId: cpuPersona?.botId ?? "opal")
            if cpuKind == .daily { CpuProgressionStore.recordBotOfDay(result: dayResult, todayUtc: LeaderboardService.todayUTC()) }
            // A bot that stepped into the Daily Battle (§6): its result shows on the
            // VS banner from a local key — never a daily_results 'vs' row (the People
            // record and the VS leaderboard stay people-only).
            if dailyVsActive { VsLobbyKit.recordDailyBot(result: dayResult, opponent: cpuPersona?.name ?? "Opal") }
            cpuStreak = outcome.progression.streak
            cpuMilestone = outcome.milestone
            cpuUnlock = outcome.unlockedPersona
            cpuClearedRung = outcome.clearedRung
            // §U: the boss falls (ladder cleared) — celebrate; a bot-streak milestone — streak.
            if let r = outcome.clearedRung, BotCast.canonicalId(r) == VsLobby.ladderBots.last { Feedback.celebrate() }
            else if outcome.milestone != nil { Feedback.streak() }
            if won { cpuSessionWins += 1 } else { cpuSessionLosses += 1 }
            if won {
                let margin = abs(data.playerTime - data.opponentTime)
                if margin < 2000 { photoFinish = "photo" }
                else if data.playerGuesses >= modeMaxGuesses { photoFinish = "clutch" }
            }
            return
        }

        let theMode = mode
        let isDraw = data.winner == "draw"
        let shouldRecordMatch = data.recordMatch == true
        let oppId = data.opponentId
        let mySolutions = data.solutions ?? []
        let myWords = myGuessLog.map(\.guess)
        let theirWords = (data.opponentGuessLog ?? []).map(\.guess)
        let forfeit = data.forfeit == true
        Task {
            // Match-history row so this VS battle shows in Recent Matches. Only the
            // server-designated writer (recordMatch) inserts, so there's one shared row.
            // The matches insert is independent of record()'s user_stats/profiles/
            // daily_results writes, so run them CONCURRENTLY — the XP toast lands
            // as soon as record() returns instead of waiting behind the insert.
            async let matchWrite: Void = {
                if shouldRecordMatch, let opp = oppId {
                    await GameResultsService.recordVsMatch(
                        gameMode: theMode, opponentId: opp, won: won, isDraw: isDraw,
                        playerGuesses: data.playerGuesses, opponentGuesses: data.opponentGuesses,
                        playerTimeSec: secs, opponentTimeSec: opponentSecs, seed: theSeed,
                        solutions: mySolutions,
                        myGuesses: myWords,
                        theirGuesses: theirWords,
                        forfeit: forfeit)
                }
            }()
            // A draw is NOT a loss: isDraw skips the loss/streak mutations and
            // counts the game only (vs_games+1 on the daily VS row) — web parity.
            xpResult = await GameResultsService.record(
                gameMode: theMode, playType: "vs", won: won, guessCount: data.playerGuesses,
                timeSeconds: secs, boardsSolved: solved, totalBoards: total, seed: theSeed,
                isDraw: isDraw)
            await matchWrite
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: mode.rawValue, playType: "vs", won: won,
                    guessCount: data.playerGuesses, timeSeconds: secs, seed: theSeed, hintsUsed: 0)
            }
            // daily_results (play_type='vs') is written INSIDE record() — its
            // unconditional vs branch covers daily and non-daily matches alike.
            // An explicit second call here double-incremented vs_wins/vs_games
            // for daily VS (a single win scored as 2-0 on the VS leaderboard).
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
