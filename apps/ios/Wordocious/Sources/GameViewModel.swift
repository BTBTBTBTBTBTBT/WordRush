import SwiftUI
import WordociousCore

/// Drives any solo mode (1..N boards) from the pure engine. A single shared
/// input row is applied to every still-playing board (applyToAll) for
/// multi-board modes; single-board modes submit to board 0.
@MainActor
final class GameViewModel: ObservableObject {
    @Published private(set) var state: GameState
    @Published var currentInput: String = ""
    /// Bumped on each rejected guess to drive the row shake (web's animate-shake).
    @Published var shakeCount: Int = 0
    @Published var toast: String?
    /// Per-board evaluations: evaluations[boardIndex][rowIndex].
    @Published private(set) var evaluations: [[GuessResult]] = []
    /// Frozen elapsed seconds at completion (for the header + score). Live
    /// elapsed is computed from startEpochMs while playing.
    @Published private(set) var finalTimeSeconds: Int?
    /// XP earned this game — set once recording completes; drives the XP toast.
    @Published var xpResult: GameResultsService.XpResult?

    // MARK: Classic hints (Six / Seven) — mirrors web useClassicHints.
    // Each hint reveals a random un-guessed vowel/consonant as a board row
    // (revealed letter = correct, rest = hint-used) and consumes a guess.
    @Published private(set) var vowelUsed = false
    @Published private(set) var consonantUsed = false
    @Published private(set) var vowelRevealed: String?      // revealed letter, or "—" if none left
    @Published private(set) var consonantRevealed: String?

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
        // Web parity (gauntlet-results.tsx handleShare): map EVERY stage config —
        // stages the player never reached render as lost/0-guess entries so the
        // share always shows the full run (was: only attempted stages, so a
        // stage-2 loss shared "1/2 stages" instead of "1/5").
        return g.stages.map { stage in
            let r = g.stageResults.first { $0.stageIndex == stage.stageIndex }
            let solved = r?.status == .won ? stage.boardCount
                : (r?.boardsSnapshot?.filter { $0.status == .won }.count ?? 0)
            return GauntletStageShare(name: stage.name, won: r?.status == .won,
                                      guesses: r?.guesses ?? 0,
                                      boardsSolved: solved, totalBoards: stage.boardCount)
        }
    }

    /// Total guesses across the whole gauntlet run — the tally the web passes
    /// as the share's guess count (NOT the last stage's rowsUsed).
    var gauntletTotalGuesses: Int { state.gauntlet?.stageResults.reduce(0) { $0 + $1.guesses } ?? 0 }

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
    /// Gauntlet VS: fires with the index of the stage just cleared so the
    /// VSMatchViewModel can emit stage_completed (web's onStageCompleted).
    var onStageCompleted: ((_ stageIndex: Int) -> Void)?
    private var reportedSolvedBoards = Set<Int>()

    var boards: [BoardState] { state.boards }
    var boardCount: Int { state.boards.count }
    var isMultiBoard: Bool { state.boards.count > 1 }
    /// Sequence (Succession) is played one board at a time: the first still-
    /// playing board is "active" (shows colors + takes input); later playing
    /// boards are locked (dimmed, letters masked). Web parity: sequence-game.tsx.
    var isSequence: Bool { mode == .sequence }
    var sequenceActiveIndex: Int { state.boards.firstIndex { $0.status == .playing } ?? -1 }
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

    // MARK: Gauntlet header (mirrors web GauntletProgress + GauntletStageHeader)

    /// Number of stages in the run (for the progress stepper).
    var gauntletStageCount: Int { state.gauntlet?.totalStages ?? state.gauntlet?.stages.count ?? 0 }
    /// Index of the active stage.
    var gauntletCurrentIndex: Int { state.gauntlet?.currentStage ?? 0 }
    /// Indices of finished stages (rendered as green checks in the stepper).
    var gauntletCompletedIndices: Set<Int> { Set((state.gauntlet?.stageResults ?? []).map { $0.stageIndex }) }
    /// Display name of the active stage (the colored title, e.g. "The Opening").
    var gauntletStageName: String {
        guard let g = state.gauntlet else { return "" }
        return g.stages[safe: g.currentStage]?.name ?? "Stage \(g.currentStage + 1)"
    }

    var isLastStage: Bool {
        guard let g = state.gauntlet else { return false }
        return g.currentStage >= g.totalStages - 1
    }

    /// Next stage's stats for the stage-transition overlay (nil on the last stage).
    var gauntletNextStageInfo: (name: String, boards: Int, guesses: Int, sequential: Bool, prefill: Bool)? {
        guard let g = state.gauntlet, let next = g.stages[safe: g.currentStage + 1] else { return nil }
        return (next.name, next.boardCount, next.maxGuesses, next.sequential, next.hasPrefill)
    }

    /// Advance to the next stage (or finish the run on the last stage).
    func nextStage() {
        guard isGauntlet, stageCleared else { return }
        let clearedStage = state.gauntlet?.currentStage ?? 0
        let elapsedMs = Date().timeIntervalSince1970 * 1000 - state.startTime
        state = gameReducer(state: state, action: .nextStage(elapsedMs: elapsedMs))
        if isVersus { onStageCompleted?(clearedStage) }
        currentInput = ""
        recomputeEvaluations()
        persistence.save(state)
        if isFinished { recordResultIfNeeded() }   // last stage → WON
    }

    /// Max rows to render = the largest maxGuesses across boards (multi-board
    /// modes share a guess budget; single boards use their own).
    var maxGuesses: Int { state.boards.map(\.maxGuesses).max() ?? 6 }

    // MARK: - Classic hints (Six / Seven)

    /// Single-board modes that expose vowel/consonant hints (web HINT_BEARING_MODES).
    var hasHints: Bool { mode == .duel6 || mode == .duel7 }
    /// Hints consumed — each adds a row stored in `hintEvaluations`, so this
    /// persists with the board and drives the scoring penalty automatically.
    var hintsUsed: Int { state.boards.first?.hintEvaluations?.count ?? 0 }

    func revealVowel() { revealHint(vowels: true) }
    func revealConsonant() { revealHint(vowels: false) }

    private func revealHint(vowels: Bool) {
        guard hasHints, !isFinished, let board = state.boards.first else { return }
        if vowels ? vowelUsed : consonantUsed { return }
        let vset = Set("AEIOU")
        let solution = board.solution.uppercased()
        let guessed = Set(board.guesses.joined().uppercased())   // letters already typed
        let candidates = Array(Set(solution.filter { c in
            c >= "A" && c <= "Z" && (vowels ? vset.contains(c) : !vset.contains(c)) && !guessed.contains(c)
        }))
        guard let pick = candidates.randomElement() else {
            // None of that letter-type left to reveal — mark used, add no row (web parity).
            if vowels { vowelUsed = true; vowelRevealed = "—" } else { consonantUsed = true; consonantRevealed = "—" }
            persistHintUI()
            return
        }
        // Reveal the letter at every position it occurs; blanks elsewhere.
        let chars = Array(solution)
        let tiles = chars.map { TileResult(letter: $0 == pick ? String($0) : "",
                                           state: $0 == pick ? .correct : .hintUsed) }
        let hintWord = String(chars.map { $0 == pick ? $0 : " " })
        let eval = GuessResult(tiles: tiles, isCorrect: false)
        state = gameReducer(state: state, action: .submitHint(hintWord: hintWord, hintEvaluation: eval, boardIndex: 0))
        if vowels { vowelUsed = true; vowelRevealed = String(pick) } else { consonantUsed = true; consonantRevealed = String(pick) }
        recomputeEvaluations()
        if !isVersus { persistence.save(state); persistHintUI() }
        if state.status == .lost { flash(lossMessage) }
        if isFinished { recordResultIfNeeded() }
    }

    /// Persist hint button state (used flags + revealed letters) keyed by
    /// seed+mode — mirrors the web `wordocious-hints-{mode}-{seed}` localStorage.
    private var hintUIKey: String { "wordocious-hints-\(mode.rawValue)-\(state.seed)" }
    private func persistHintUI() {
        UserDefaults.standard.set([
            "vowelUsed": vowelUsed ? "1" : "0",
            "consonantUsed": consonantUsed ? "1" : "0",
            "vowelRevealed": vowelRevealed ?? "",
            "consonantRevealed": consonantRevealed ?? "",
        ], forKey: hintUIKey)
    }
    private func restoreHintUI() {
        guard hasHints, let d = UserDefaults.standard.dictionary(forKey: hintUIKey) as? [String: String] else { return }
        vowelUsed = d["vowelUsed"] == "1"
        consonantUsed = d["consonantUsed"] == "1"
        vowelRevealed = (d["vowelRevealed"]?.isEmpty == false) ? d["vowelRevealed"] : nil
        consonantRevealed = (d["consonantRevealed"]?.isEmpty == false) ? d["consonantRevealed"] : nil
    }

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
        restoreHintUI()
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
        guard currentInput.count == wordLength else { rejectGuess("Not enough letters"); return }
        let guess = currentInput.uppercased()
        guard GameDictionary.shared.isValidWord(guess) else { rejectGuess("Not in word list"); return }
        // Already guessed on this board — web blocks this with "Already guessed"
        // (for multi-board, board 0's history mirrors the shared applyToAll guesses).
        let checkIdx = isSequence ? sequenceActiveIndex : 0
        if checkIdx >= 0, checkIdx < state.boards.count, state.boards[checkIdx].guesses.contains(guess) {
            rejectGuess("Already guessed"); return
        }

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
            rejectGuess("Not in word list")
        }
    }

    /// Reject an invalid/duplicate guess: toast + sound + a row shake (web parity).
    private func rejectGuess(_ message: String) {
        flash(message)
        SoundManager.shared.playInvalid()
        shakeCount += 1
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
        // Record for daily AND unlimited play ("All stats count"): the service
        // updates user_stats + profile XP + the matches row regardless, and only
        // writes the daily_results leaderboard row when the seed is a daily one.
        guard !resultRecorded else { return }
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
        // Match-history row (player2_id = null) so this game feeds the Profile
        // charts, mirroring the web's recordSoloMatch. board 0's guesses are the
        // shared guess list; solutions = every board's answer.
        let guessWords = state.boards.first?.guesses ?? []
        let solutionWords = state.boards.map(\.solution)
        let hintsCount = hintsUsed   // Six/Seven hint penalty (0 for non-hint modes)
        Task {
            let xp = await GameResultsService.record(
                gameMode: modeRaw, won: completed, guessCount: guesses,
                timeSeconds: secs, boardsSolved: solved, totalBoards: total,
                seed: theSeed, hintsUsed: hintsCount
            )
            self.xpResult = xp
            await GameResultsService.recordSoloMatch(
                gameMode: modeRaw, won: completed, score: guesses, timeSeconds: secs,
                seed: theSeed, solutions: solutionWords, guesses: guessWords, hintsUsed: hintsCount
            )
            // Gauntlet: persist the per-stage breakdown so the results screen
            // shows full detail (incl. per-stage times) on any device.
            if isGauntlet, let g = state.gauntlet {
                await GameResultsService.recordGauntletStages(
                    seed: theSeed,
                    payload: .init(stages: g.stages, stageResults: g.stageResults))
            }
            // Unlock achievements (after stats/profile/match are written).
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: modeRaw.rawValue, playType: "solo", won: completed,
                    guessCount: guesses, timeSeconds: secs, seed: theSeed, hintsUsed: hintsCount)
            }
        }
    }

    // MARK: - Rendering helpers

    /// Number of guesses already committed (rows used). For multi-board modes
    /// every board shares the same guess list length, so board 0 is canonical.
    /// Total guesses used — web parity: max across boards. In shared-guess
    /// modes a solved board STOPS accumulating, so boards[0] underreports
    /// whenever it solves early (e.g. OctoWord "9/13" after 12 real guesses).
    var rowsUsed: Int { state.boards.map { $0.guesses.count }.max() ?? 0 }

    private var totalGuesses: Int { state.boards.map(\.guesses.count).reduce(0, +) }

    func board(_ i: Int) -> BoardState { state.boards[i] }

    func evaluation(board: Int, row: Int) -> GuessResult? {
        guard board < evaluations.count, row < evaluations[board].count else { return nil }
        return evaluations[board][row]
    }

    /// Best-known state per letter across every board, for keyboard coloring.
    func keyState(for letter: String) -> TileState? {
        let L = letter.uppercased()
        // Sequence colors the keyboard from the ACTIVE board only (web parity).
        if isSequence {
            let idx = sequenceActiveIndex
            guard idx >= 0, let evals = evaluations[safe: idx] else { return nil }
            var best: TileState?
            for eval in evals { for tile in eval.tiles where tile.letter == L { best = Self.merge(best, tile.state) } }
            return best
        }
        var best: TileState?
        for boardEvals in evaluations {
            for eval in boardEvals {
                for tile in eval.tiles where tile.letter == L {
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

    /// Use the per-board quadrant keyboard for simultaneous multi-board modes
    /// (QuadWord / OctoWord / Deliverance) — but NOT Sequence, which is played
    /// one active board at a time (web: only quordle/octordle/rescue pass
    /// boardLetterStates; sequence uses the active board's single states).
    var useQuadrantKeyboard: Bool { mode != .sequence && boardCount > 1 }

    /// Per-board keyboard letter states for the quadrant keyboard. Mirrors web
    /// computePerBoardLetterStates: a non-playing (solved/lost) board returns an
    /// empty dict so its sub-cell renders blank.
    func boardKeyStates() -> [[String: TileState]] {
        state.boards.enumerated().map { i, board in
            guard board.status == .playing else { return [:] }
            var d: [String: TileState] = [:]
            for eval in (evaluations[safe: i] ?? []) {
                for tile in eval.tiles where !tile.letter.isEmpty {
                    d[tile.letter] = Self.merge(d[tile.letter], tile.state)
                }
            }
            return d
        }
    }

    private var lossMessage: String {
        let unsolved = state.boards.filter { $0.status != .won }.map(\.solution)
        return unsolved.count == 1 ? unsolved[0] : "\(unsolved.count) left unsolved"
    }

    // MARK: - Internals

    private func recomputeEvaluations() {
        evaluations = state.boards.map { board in
            board.guesses.enumerated().map { i, g in
                // Hint rows carry a stored evaluation (keyed by row index); their
                // blank/spaced word must not be re-evaluated like a real guess.
                if let he = board.hintEvaluations?[String(i)] { return he }
                return evaluateGuess(solution: board.solution, guess: g)
            }
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
