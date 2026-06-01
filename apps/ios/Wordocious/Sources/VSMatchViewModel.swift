import SwiftUI
import WordociousCore

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
        /// Latest tiles per board index (each board accumulates its guess rows).
        var tiles: [Int: [[TileState]]] = [:]
    }

    let mode: GameMode
    let isDaily: Bool          // freemium daily-VS flow (free + DUEL only)
    let inviteCode: String?

    @Published var screen: Screen = .queue
    @Published var queuePosition = 0
    @Published var countdown: Int?         // non-nil → show "Match Found" overlay
    @Published var game: GameViewModel?    // built on match_start
    @Published var opponent = OpponentProgress()
    @Published var result: VSMatchEnded?
    @Published var playerTimeMs: Int = 0
    @Published var rematch: RematchState = .idle
    @Published var message: String?
    @Published var dailyAnswer: String = ""

    private let service = VSMatchService()
    private var seed = ""
    private var matchStartMs: Double = 0
    private var resultRecorded = false
    private var countdownTimer: Timer?

    var isPro: Bool { AuthService.shared.isProActive }
    /// Freemium gating mirrors the web: daily flow only bites for free users on DUEL.
    private var dailyVsActive: Bool { isDaily && !isPro && mode == .duel }

    init(mode: GameMode, isDaily: Bool = false, inviteCode: String? = nil) {
        self.mode = mode
        self.isDaily = isDaily
        self.inviteCode = inviteCode
    }

    // MARK: - Lifecycle

    func start() {
        guard service.isConfigured else { screen = .notConfigured; return }

        // Freemium: if the daily VS was already used today, show the read-only
        // "already played" screen instead of queueing.
        let dailySeed: String? = dailyVsActive
            ? generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: "DUEL_VS")
            : nil
        if dailyVsActive, VSPlayLimit.hasPlayedToday() {
            dailyAnswer = dailySeed.flatMap { generateSolutionsFromSeed($0, count: 1).first } ?? ""
            screen = .alreadyPlayedDaily
            return
        }

        wireHandlers()
        let presenceId = AuthService.shared.profile.map { "u:\($0.id)" }
        service.connect(presenceId: presenceId)
        service.joinQueue(mode: mode.rawValue, dailySeed: dailySeed, inviteCode: inviteCode)
    }

    func leave() {
        countdownTimer?.invalidate()
        service.leaveQueue()
        service.disconnect()
    }

    func forfeit() {
        service.abandonMatch()
        service.disconnect()
    }

    // MARK: - User actions

    func offerRematch() {
        guard isPro else { message = "Rematches are a Pro feature."; return }
        rematch = .offered
        service.offerRematch()
    }
    func acceptRematch() { service.acceptRematch() }
    func declineRematch() { rematch = .declined; service.declineRematch() }

    // MARK: - Socket handlers

    private func wireHandlers() {
        service.onQueueStatus = { [weak self] in self?.queuePosition = $0.position }
        service.onMatchFound = { [weak self] in self?.handleMatchFound($0) }
        service.onMatchStart = { [weak self] in self?.beginMatch(seed: $0.seed, startMs: $0.startTime) }
        service.onOpponentProgress = { [weak self] in self?.applyOpponentProgress($0) }
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
        countdown = nil

        let vm = GameViewModel(seed: seed, mode: mode, isVersus: true)
        vm.onGuessCommitted = { [weak self] guess in self?.service.submitGuess(guess, boardIndex: 0) }
        vm.onBoardSolved = { [weak self] idx in self?.service.boardSolved(boardIndex: idx) }
        vm.onCompleted = { [weak self] status, guesses in
            guard let self else { return }
            let timeMs = Int(max(0, Date().timeIntervalSince1970 * 1000 - self.matchStartMs))
            self.playerTimeMs = timeMs
            self.service.playerCompleted(status: status == .won ? "won" : "lost",
                                         totalGuesses: guesses, timeMs: timeMs)
            self.screen = .waiting
        }
        vm.resumeTimer()
        game = vm
        screen = .match
    }

    private func applyOpponentProgress(_ p: VSOpponentProgress) {
        opponent.attempts = p.attempts
        opponent.solved = p.solved
        opponent.boardsSolved = p.boardsSolved
        opponent.totalBoards = p.totalBoards
        if let latest = p.latestGuess {
            var rows = opponent.tiles[latest.boardIndex] ?? []
            rows.append(latest.tileStates)
            opponent.tiles[latest.boardIndex] = rows
        }
    }

    private func handleMatchEnded(_ data: VSMatchEnded) {
        result = data
        screen = .result
        recordResult(data)
        if dailyVsActive { VSPlayLimit.markPlayedToday() }
    }

    private func recordResult(_ data: VSMatchEnded) {
        guard !resultRecorded, AuthService.shared.profile != nil else { return }
        resultRecorded = true
        let won = data.winner == "player"
        let secs = Int((data.playerTime / 1000).rounded())
        let solved = game?.boardsSolvedCount ?? (won ? 1 : 0)
        let total = game?.boardCount ?? 1
        let theSeed = seed
        Task {
            await GameResultsService.record(
                gameMode: mode, playType: "vs", won: won, guessCount: data.playerGuesses,
                timeSeconds: secs, boardsSolved: solved, totalBoards: total, seed: theSeed)
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
