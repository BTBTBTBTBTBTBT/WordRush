import Foundation
import WordociousCore

/// The transport surface VSMatchViewModel depends on. Both the socket
/// (VSMatchService) and the client-side bot (LocalBotMatchService) satisfy it,
/// so the VM can swap between them without changing its lifecycle logic.
protocol VSTransport: AnyObject {
    var onConnect: (() -> Void)? { get set }
    var onDisconnect: (() -> Void)? { get set }
    var onQueueStatus: ((VSQueueStatus) -> Void)? { get set }
    var onMatchFound: ((VSMatchFound) -> Void)? { get set }
    var onMatchStart: ((VSMatchStart) -> Void)? { get set }
    var onGuessResult: ((VSGuessResult) -> Void)? { get set }
    var onOpponentProgress: ((VSOpponentProgress) -> Void)? { get set }
    var onMatchEnded: ((VSMatchEnded) -> Void)? { get set }
    var onOpponentStageCompleted: ((VSStageEvent) -> Void)? { get set }
    var onRematchOffered: (() -> Void)? { get set }
    var onRematchDeclined: (() -> Void)? { get set }
    var onRematchStart: ((VSRematchStart) -> Void)? { get set }
    var onOpponentLeft: (() -> Void)? { get set }
    var onOpponentTyping: (() -> Void)? { get set }
    var onServerError: ((VSServerError) -> Void)? { get set }
    var isConfigured: Bool { get }
    func connect(presenceId: String?)
    func disconnect()
    func joinQueue(mode: String, dailySeed: String?, inviteCode: String?)
    func leaveQueue()
    func submitGuess(_ guess: String, boardIndex: Int)
    func boardSolved(boardIndex: Int)
    func playerCompleted(status: String, totalGuesses: Int, timeMs: Int)
    func stageCompleted(stageIndex: Int)
    func emitTyping()
    func abandonMatch()
    func offerRematch()
    func declineRematch()
}

/// The socket transport already exposes the whole surface.
extension VSMatchService: VSTransport {}

// MARK: - CPU opponent identity

/// Every way to pick a CPU opponent from the chooser.
enum CpuKind: String {
    case easy, medium, hard, adaptive, ghost, daily
}

struct CpuIdentity {
    let name: String
    let avatar: String
    let color: Int
    let tier: BotTier
}

enum CpuOpponent {
    static let prefix = "cpu:"

    static func opponentId(_ kind: CpuKind) -> String { "\(prefix)\(kind.rawValue)" }

    static func isCpu(_ id: String?) -> Bool { id?.hasPrefix(prefix) ?? false }

    static func identity(_ oppId: String) -> CpuIdentity {
        let raw = String(oppId.dropFirst(prefix.count))
        switch raw {
        case "ghost": return CpuIdentity(name: "Your Ghost", avatar: "👻", color: 0x64748B, tier: .hard)
        case "daily": return CpuIdentity(name: "Daily Bot", avatar: "📅", color: 0xF59E0B, tier: .medium)
        case "adaptive": return CpuIdentity(name: "Adapt", avatar: "⚖️", color: 0x7C3AED, tier: .medium)
        default:
            let p = BotPersonas.persona(BotTier(rawValue: raw) ?? .medium)
            return CpuIdentity(name: p.name, avatar: p.avatar, color: p.color, tier: p.tier)
        }
    }
}

struct BotConfig {
    var adaptive: BotEngine.AdaptiveHint? = nil
    var ghostGuesses: Int? = nil
    var ghostTimeMs: Double? = nil
    var fixedSeed: String? = nil
    var opponentId: String? = nil
}

// MARK: - Local bot transport

/// A fully client-side opponent that satisfies VSTransport without a socket. It
/// builds a BotEngine.Plan and replays it on timers, driving the identical
/// onMatchFound / onMatchStart / onOpponentProgress / onMatchEnded callbacks the
/// socket would. Nothing is recorded here — the VM routes CPU results to the
/// separate vs_cpu bucket. Swift port of apps/web/lib/adapters/bot-match-service.ts.
final class LocalBotMatchService: VSTransport {
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
    var onOpponentTyping: (() -> Void)?
    var onServerError: ((VSServerError) -> Void)?
    var isConfigured: Bool { true }

    private let difficulty: BotDifficulty
    private let config: BotConfig
    private var mode: GameMode = .duel
    private var plan: BotEngine.Plan?
    private var timers: [DispatchWorkItem] = []
    private var serverStartAt: Double = 0
    private var ended = false

    private var botDone = false
    private var botTimeMs: Double = 0
    private var playerDone = false
    private var playerBoardsSolved = 0
    private var playerResult: (status: String, guesses: Int, timeMs: Double)?

    private let countdownMs: Double = 3000 // mirror server MATCH_COUNTDOWN

    init(difficulty: BotDifficulty, config: BotConfig = BotConfig()) {
        self.difficulty = difficulty
        self.config = config
    }

    private func schedule(_ ms: Double, _ work: @escaping () -> Void) {
        let item = DispatchWorkItem(block: work)
        timers.append(item)
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0, ms) / 1000.0, execute: item)
    }
    private func clearTimers() { timers.forEach { $0.cancel() }; timers.removeAll() }

    private func planOpts() -> BotEngine.BuildOpts {
        BotEngine.BuildOpts(
            targetGuesses: config.ghostGuesses,
            targetSolveMs: config.ghostTimeMs,
            forceSolve: config.ghostGuesses != nil,
            adaptive: config.adaptive
        )
    }

    // MARK: VSTransport
    func connect(presenceId: String?) { DispatchQueue.main.async { [weak self] in self?.onConnect?() } }
    func disconnect() { clearTimers() }

    func joinQueue(mode: String, dailySeed: String?, inviteCode: String?) {
        self.mode = GameMode(rawValue: mode) ?? .duel
        schedule(900) { [weak self] in self?.startMatch(self?.config.fixedSeed ?? generateMatchSeed()) }
    }

    private func startMatch(_ seed: String) {
        guard !ended else { return }
        serverStartAt = Date().timeIntervalSince1970 * 1000 + countdownMs
        plan = BotEngine.buildPlan(seed: seed, mode: mode, difficulty: difficulty, opts: planOpts())
        botDone = false; playerDone = false; playerBoardsSolved = 0; playerResult = nil

        onMatchFound?(VSMatchFound(
            matchId: "bot-\(Int(serverStartAt))", mode: mode.rawValue,
            serverStartAt: serverStartAt, countdownSeconds: countdownMs / 1000,
            opponentUserId: config.opponentId ?? CpuOpponent.opponentId(CpuKind(rawValue: difficulty.rawValue) ?? .medium)))

        schedule(countdownMs) { [weak self] in
            guard let self, !self.ended else { return }
            self.onMatchStart?(VSMatchStart(seed: seed, startTime: self.serverStartAt, puzzleMetadata: nil))
            self.runPlan()
        }
    }

    private func runPlan() {
        guard let plan else { return }
        for ev in plan.events {
            schedule(ev.atMs) { [weak self] in
                guard let self, !self.ended else { return }
                if ev.typing { self.onOpponentTyping?() }
                else if let p = ev.progress { self.onOpponentProgress?(p) }
            }
        }
        // Gauntlet: advance the opponent's 5-node stepper at each stage clear.
        for se in plan.stageEvents {
            schedule(se.atMs) { [weak self] in
                guard let self, !self.ended else { return }
                self.onOpponentStageCompleted?(VSStageEvent(stageIndex: se.stageIndex))
            }
        }
        schedule(plan.finishAtMs) { [weak self] in
            guard let self, !self.ended else { return }
            self.botDone = true
            self.botTimeMs = plan.finishAtMs
            self.maybeEnd()
        }
    }

    private func maybeEnd() {
        guard !ended, let plan, botDone, playerDone, let pr = playerResult else { return }
        ended = true
        clearTimers()
        let playerWon = pr.status == "won"
        let botWon = plan.solved
        let playerBoards = playerWon ? plan.totalBoards : playerBoardsSolved
        let botBoards = plan.boardsSolved
        let playerScore = Double(pr.guesses) + pr.timeMs / 1000 / 45
        let botScore = Double(plan.totalGuesses) + botTimeMs / 1000 / 45

        var winner: String? = nil
        if playerWon && !botWon { winner = "player" }
        else if botWon && !playerWon { winner = "opponent" }
        else if playerWon && botWon {
            if playerBoards > botBoards { winner = "player" }
            else if botBoards > playerBoards { winner = "opponent" }
            else if abs(playerScore - botScore) < 0.01 { winner = "draw" }
            else { winner = playerScore < botScore ? "player" : "opponent" }
        }

        onMatchEnded?(VSMatchEnded(
            winner: winner, playerGuesses: pr.guesses, opponentGuesses: plan.totalGuesses,
            playerTime: pr.timeMs, opponentTime: botTimeMs, playerScore: playerScore, opponentScore: botScore,
            opponentId: nil, recordMatch: false, forfeit: false,
            opponentGuessLog: plan.guessLog, solutions: plan.solutions))
    }

    func leaveQueue() { clearTimers() }
    func submitGuess(_ guess: String, boardIndex: Int) {}
    func boardSolved(boardIndex: Int) { playerBoardsSolved += 1 }
    func playerCompleted(status: String, totalGuesses: Int, timeMs: Int) {
        playerResult = (status, totalGuesses, Double(timeMs))
        playerDone = true
        maybeEnd()
    }
    func stageCompleted(stageIndex: Int) {}
    func emitTyping() {}
    func abandonMatch() { ended = true; clearTimers() }

    func offerRematch() {
        ended = false
        clearTimers()
        let seed = config.fixedSeed ?? generateMatchSeed()
        serverStartAt = Date().timeIntervalSince1970 * 1000
        plan = BotEngine.buildPlan(seed: seed, mode: mode, difficulty: difficulty, opts: planOpts())
        botDone = false; playerDone = false; playerBoardsSolved = 0; playerResult = nil
        onRematchStart?(VSRematchStart(matchId: "bot-\(Int(serverStartAt))", seed: seed, puzzleMetadata: nil))
        schedule(50) { [weak self] in self?.runPlan() }
    }
    func declineRematch() {}
}
