import SwiftUI
import WordociousCore

/// Drives any solo mode (1..N boards) from the pure engine. A single shared
/// input row is applied to every still-playing board (applyToAll) for
/// multi-board modes; single-board modes submit to board 0.
@MainActor
final class GameViewModel: ObservableObject {
    @Published private(set) var state: GameState
    @Published var currentInput: String = ""
    @Published var toast: String?
    /// Per-board evaluations: evaluations[boardIndex][rowIndex].
    @Published private(set) var evaluations: [[GuessResult]] = []
    /// Frozen elapsed seconds at completion (for the header + score). Live
    /// elapsed is computed from startEpochMs while playing.
    @Published private(set) var finalTimeSeconds: Int?

    // Active-play timer: accumulates only while the game is foregrounded,
    // pauses on background, persists across relaunch. Mirrors the web
    // useActivePlayTimer so a backgrounded game doesn't inflate the clock.
    private var accumulatedMs: Double = 0
    private var resumeAtMs: Double?
    private var nowMs: Double { Date().timeIntervalSince1970 * 1000 }

    var elapsedSeconds: Int {
        if let f = finalTimeSeconds { return f }
        let running = resumeAtMs.map { nowMs - $0 } ?? 0
        return max(0, Int((accumulatedMs + running) / 1000))
    }

    /// Call when the game becomes active (onAppear / foreground).
    func resumeTimer() {
        guard !isFinished, resumeAtMs == nil else { return }
        resumeAtMs = nowMs
    }

    /// Call when the game goes inactive (onDisappear / background).
    func pauseTimer() {
        if let r = resumeAtMs { accumulatedMs += nowMs - r; resumeAtMs = nil }
        if !isVersus { persistence.saveElapsed(accumulatedMs, seed: state.seed, mode: mode) }
    }

    private func freezeTimer() {
        if let r = resumeAtMs { accumulatedMs += nowMs - r; resumeAtMs = nil }
    }

    /// Single-board share grid (board 0), padded to maxGuesses rows.
    func shareGrid() -> [[TileState]] {
        let b = state.boards[0]
        var rows: [[TileState]] = evaluations.first?.map { $0.tiles.map(\.state) } ?? []
        let width = b.solution.count
        while rows.count < b.maxGuesses { rows.append(Array(repeating: .empty, count: width)) }
        return rows
    }

    /// Per-board share grids (multi-board), each padded to prefill+maxGuesses.
    func shareBoards() -> [(grid: [[TileState]], won: Bool)] {
        state.boards.enumerated().map { i, b in
            var rows: [[TileState]] = (b.prefilledGuesses ?? []).map { $0.evaluation.tiles.map(\.state) }
            rows += (evaluations[safe: i] ?? []).map { $0.tiles.map(\.state) }
            let total = (b.prefilledGuesses?.count ?? 0) + b.maxGuesses
            let width = b.solution.count
            while rows.count < total { rows.append(Array(repeating: .empty, count: width)) }
            return (rows, b.status == .won)
        }
    }

    func gauntletStagesShare() -> [GauntletStageShare] {
        guard let g = state.gauntlet else { return [] }
        return g.stageResults.map { r in
            let stage = g.stages[safe: r.stageIndex]
            let bc = stage?.boardCount ?? 0
            let solved = r.status == .won ? bc : (r.boardsSnapshot?.filter { $0.status == .won }.count ?? 0)
            return GauntletStageShare(name: stage?.name ?? "Stage \(r.stageIndex + 1)",
                                      won: r.status == .won, guesses: r.guesses,
                                      boardsSolved: solved, totalBoards: bc)
        }
    }
    var boardsSolvedCount: Int { state.boards.filter { $0.status == .won }.count }

    let mode: GameMode
    let wordLength: Int
    let isDaily: Bool
    private let persistence = GamePersistence.shared
    private var resultRecorded = false

    // MARK: - VS hooks
    /// When true this VM drives a live VS match: it skips solo persistence and
    /// solo daily-result recording, and instead fires the relay callbacks so the
    /// VSMatchViewModel can emit submit_guess / board_solved / player_completed.
    let isVersus: Bool
    var onGuessCommitted: ((_ guess: String) -> Void)?
    var onBoardSolved: ((_ boardIndex: Int) -> Void)?
    var onCompleted: ((_ status: GameStatus, _ totalGuesses: Int) -> Void)?
    private var reportedSolvedBoards = Set<Int>()

    var boards: [BoardState] { state.boards }
    var boardCount: Int { state.boards.count }
    var isMultiBoard: Bool { state.boards.count > 1 }
    var status: GameStatus { state.status }
    var isFinished: Bool { status != .playing }

    // MARK: - Gauntlet

    var isGauntlet: Bool { mode == .gauntlet }

    /// All boards in the current stage solved, but the run isn't over yet —
    /// the player taps Continue to advance (or finish) via NEXT_STAGE.
    var stageCleared: Bool {
        isGauntlet && status == .playing && !state.boards.isEmpty && state.boards.allSatisfy { $0.status == .won }
    }

    var gauntletStageLabel: String? {
        guard isGauntlet, let g = state.gauntlet else { return nil }
        let name = g.stages[safe: g.currentStage]?.name ?? ""
        return "Stage \(g.currentStage + 1)/\(g.totalStages) · \(name)"
    }

    var isLastStage: Bool {
        guard let g = state.gauntlet else { return false }
        return g.currentStage >= g.totalStages - 1
    }

    /// Advance to the next stage (or finish the run on the last stage).
    func nextStage() {
        guard isGauntlet, stageCleared else { return }
        let elapsedMs = Date().timeIntervalSince1970 * 1000 - state.startTime
        state = gameReducer(state: state, action: .nextStage(elapsedMs: elapsedMs))
        currentInput = ""
        recomputeEvaluations()
        persistence.save(state)
        if isFinished { recordResultIfNeeded() }   // last stage → WON
    }

    /// Max rows to render = the largest maxGuesses across boards (multi-board
    /// modes share a guess budget; single boards use their own).
    var maxGuesses: Int { state.boards.map(\.maxGuesses).max() ?? 6 }

    init(seed: String, mode: GameMode, isVersus: Bool = false) {
        self.mode = mode
        self.isVersus = isVersus
        switch mode {
        case .duel6: wordLength = 6
        case .duel7: wordLength = 7
        default: wordLength = 5
        }

        self.isDaily = isDailySeed(seed)
        // VS matches are transient (server-supplied seed) — never restore from or
        // write to solo persistence, which would collide with the solo game of
        // the same mode/seed.
        if !isVersus, let saved = GamePersistence.shared.load(seed: seed, mode: mode) {
            state = saved
        } else {
            state = createInitialState(seed: seed, mode: mode)
        }
        recomputeEvaluations()
        accumulatedMs = isVersus ? 0 : GamePersistence.shared.loadElapsed(seed: seed, mode: mode)
        // A game restored from disk that's already finished shouldn't re-post.
        resultRecorded = state.status != .playing
    }

    // MARK: - Input

    func type(_ letter: String) {
        guard !isFinished, currentInput.count < wordLength else { return }
        currentInput += letter.uppercased()
    }

    func delete() {
        guard !currentInput.isEmpty else { return }
        currentInput.removeLast()
    }

    func submit() {
        guard !isFinished else { return }
        guard currentInput.count == wordLength else { flash("Not enough letters"); return }
        let guess = currentInput.uppercased()
        guard GameDictionary.shared.isValidWord(guess) else { flash("Not in word list"); return }

        let beforeGuessCount = totalGuesses
        let action: GameAction = isMultiBoard
            ? .submitGuess(guess: guess, boardIndex: nil, applyToAll: true)
            : .submitGuess(guess: guess, boardIndex: 0, applyToAll: false)
        state = gameReducer(state: state, action: action)

        if totalGuesses != beforeGuessCount {
            currentInput = ""
            recomputeEvaluations()
            if !isVersus { persistence.save(state) }
            if state.status == .won { flash("Solved!") }
            else if state.status == .lost { flash(lossMessage) }

            if isVersus {
                onGuessCommitted?(guess)
                for (i, b) in state.boards.enumerated() where b.status == .won && !reportedSolvedBoards.contains(i) {
                    reportedSolvedBoards.insert(i)
                    onBoardSolved?(i)
                }
            }
            if isFinished {
                recordResultIfNeeded()
                if isVersus { onCompleted?(status, rowsUsed) }
            }
        } else {
            flash("Not in word list")
        }
    }

    /// Post the finished daily result to Supabase (once). No-ops for
    /// non-daily games or when signed out (handled in the service).
    private func recordResultIfNeeded() {
        freezeTimer()
        let secs = max(0, Int(accumulatedMs / 1000))
        if finalTimeSeconds == nil { finalTimeSeconds = secs }
        // VS matches don't touch solo persistence or solo daily recording — the
        // VSMatchViewModel records the result with play_type 'vs' instead.
        guard !isVersus else { return }
        persistence.saveElapsed(accumulatedMs, seed: state.seed, mode: mode)
        guard isDaily, !resultRecorded else { return }
        resultRecorded = true
        let completed = state.status == .won
        let modeRaw = mode

        let guesses: Int
        let solved: Int
        let total: Int

        if isGauntlet, let g = state.gauntlet {
            // Mirror web gauntlet-game recording: sum across stageResults.
            // On WON the final NEXT_STAGE already pushed the last stage, so the
            // current boards would double-count → currentStageGuesses = 0.
            // On LOST the failed stage is in stageResults (with snapshot).
            let completedStageGuesses = g.stageResults.reduce(0) { $0 + $1.guesses }
            let currentStageGuesses = completed ? 0 : state.boards.reduce(0) { max($0, $1.guesses.count) }
            guesses = completedStageGuesses + currentStageGuesses
            solved = g.stageResults.reduce(0) { sum, r in
                if r.status == .won { return sum + (g.stages[safe: r.stageIndex]?.boardCount ?? 0) }
                return sum + (r.boardsSnapshot?.filter { $0.status == .won }.count ?? 0)
            }
            total = g.stageResults.reduce(0) { $0 + (g.stages[safe: $1.stageIndex]?.boardCount ?? 0) }
        } else {
            guesses = rowsUsed
            solved = state.boards.filter { $0.status == .won }.count
            total = boardCount
        }

        let theSeed = state.seed
        Task {
            await GameResultsService.record(
                gameMode: modeRaw, won: completed, guessCount: guesses,
                timeSeconds: secs, boardsSolved: solved, totalBoards: total,
                seed: theSeed
            )
        }
    }

    // MARK: - Rendering helpers

    /// Number of guesses already committed (rows used). For multi-board modes
    /// every board shares the same guess list length, so board 0 is canonical.
    var rowsUsed: Int { state.boards.first?.guesses.count ?? 0 }

    private var totalGuesses: Int { state.boards.map(\.guesses.count).reduce(0, +) }

    func board(_ i: Int) -> BoardState { state.boards[i] }

    func evaluation(board: Int, row: Int) -> GuessResult? {
        guard board < evaluations.count, row < evaluations[board].count else { return nil }
        return evaluations[board][row]
    }

    /// Best-known state per letter across every board, for keyboard coloring.
    func keyState(for letter: String) -> TileState? {
        var best: TileState?
        for boardEvals in evaluations {
            for eval in boardEvals {
                for tile in eval.tiles where tile.letter == letter.uppercased() {
                    best = Self.merge(best, tile.state)
                }
            }
        }
        return best
    }

    private static func merge(_ a: TileState?, _ b: TileState) -> TileState {
        let rank: (TileState) -> Int = {
            switch $0 { case .correct: return 3; case .present: return 2; case .absent: return 1; default: return 0 }
        }
        guard let a else { return b }
        return rank(b) > rank(a) ? b : a
    }

    private var lossMessage: String {
        let unsolved = state.boards.filter { $0.status != .won }.map(\.solution)
        return unsolved.count == 1 ? unsolved[0] : "\(unsolved.count) left unsolved"
    }

    // MARK: - Internals

    private func recomputeEvaluations() {
        evaluations = state.boards.map { board in
            board.guesses.map { evaluateGuess(solution: board.solution, guess: $0) }
        }
    }

    private func flash(_ message: String) {
        toast = message
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if toast == message { toast = nil }
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
