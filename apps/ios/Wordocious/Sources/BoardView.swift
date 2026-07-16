import SwiftUI
import WordociousCore

/// Horizontal shake for a rejected guess — mirrors web's `animate-shake`
/// (±4px, a few oscillations over ~0.4s). Driven by an incrementing counter.
struct ShakeEffect: GeometryEffect {
    var amount: CGFloat = 4
    var shakes: CGFloat = 3
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: amount * sin(animatableData * .pi * shakes * 2), y: 0))
    }
}

/// Web-parity tile flip on reveal: `rotateX` 0°→90°→0° — the tile rotates to
/// edge-on at the midpoint and back, with its final color applied throughout
/// (mirrors the `tile-flip` keyframe; no face swap). Progress 0→1 maps to the
/// 0→90→0 triangle so a single eased tween produces the flip.
private struct TileFlip: ViewModifier, Animatable {
    var progress: Double
    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }
    func body(content: Content) -> some View {
        let angle = (progress < 0.5 ? progress : 1 - progress) * 2 * 90
        // An orthographic rotateX (perspective 0) just scales height by cos(angle):
        // 1 → 0 (edge-on) → 1. Using a cheap 2D scaleEffect instead of
        // rotation3DEffect keeps it smooth even when every multi-board tile flips
        // at once. Visually identical to the web's tile-flip.
        return content.scaleEffect(x: 1, y: CGFloat(cos(angle * .pi / 180)), anchor: .center)
    }
}

/// A just-committed tile that flips open on reveal. Reuses `TileView` for the
/// face so styling stays pixel-identical. 0.5s / 150ms stagger on a full board,
/// 0.3s / 80ms on mini (multi-board) — matching web's tile-flip / tile-flip-mini.
struct FlipRevealTile: View {
    let letter: String
    let state: TileState
    var size: CGFloat = 58
    var height: CGFloat? = nil
    var delay: Double = 0
    var duration: Double = 0.5
    @State private var progress: Double = 0

    var body: some View {
        TileView(letter: letter, state: state, revealed: true, size: size, height: height)
            .modifier(TileFlip(progress: progress))
            .onAppear {
                // Theme.reduceMotion = in-app toggle OR OS setting (the old
                // env-only check let the in-app toggle keep flipping tiles).
                guard !Theme.reduceMotion else { return }
                withAnimation(.easeInOut(duration: duration).delay(delay)) { progress = 1 }
            }
    }
}

struct TileView: View {
    let letter: String
    let state: TileState
    let revealed: Bool
    var size: CGFloat = 58
    /// Optional explicit height — multi-board fills its cell with non-square
    /// tiles (web `1fr` rows). Defaults to a square tile.
    var height: CGFloat? = nil
    /// Live "not a valid / already-guessed word" indicator on the typing row —
    /// red tile (web: border-red-400 / bg-red-50 / text-red-500), shown before Enter.
    var isInvalid: Bool = false

    var body: some View {
        let h = height ?? size
        let s = min(size, h)
        let filled = state != .empty
        // Web HINT_USED tile: bg-gray-100 / border-gray-200 / text-gray-300 —
        // a faint ghost tile, not a solid gray tile with white text.
        let fg: Color = isInvalid ? Color(hex: 0xEF4444)
            : (filled && revealed ? (state == .hintUsed ? Color(hex: 0xD1D5DB) : .white) : Theme.textPrimary)
        let bg: Color = isInvalid ? Color(hex: 0xFEF2F2) : (revealed ? Theme.tileColor(for: state) : Color.white)
        let border: Color = isInvalid ? Color(hex: 0xF87171)
            : (!revealed ? Theme.emptyBorder
               : (state == .hintUsed ? Color(hex: 0xE5E7EB)
                  : (state == .absent ? Theme.emptyBorder : Theme.borderAlt)))
        Text(letter)
            .font(Brand.font(s * 0.5, .black))
            .foregroundStyle(fg)
            .frame(width: size, height: h)
            .background(RoundedRectangle(cornerRadius: s * 0.14).fill(bg))
            .overlay(RoundedRectangle(cornerRadius: s * 0.14).stroke(border, lineWidth: min(2, max(1, s * 0.09))))
    }
}

extension TileState {
    /// VoiceOver name for a revealed tile's evaluation.
    var a11yName: String {
        switch self {
        case .correct: return "correct"
        case .present: return "wrong position"
        case .absent: return "not in word"
        case .hintUsed: return "revealed by hint"
        default: return ""
        }
    }
}

/// One spoken sentence for a whole revealed row — VoiceOver reads the guess
/// then each letter's result, instead of five separate unlabeled tiles.
func a11yRowLabel(_ eval: GuessResult) -> String {
    let word = eval.tiles.map(\.letter).joined()
    let parts = eval.tiles.map { "\($0.letter), \($0.state.a11yName)" }
    return "\(word). " + parts.joined(separator: ". ")
}

/// Renders one board (by index) from the view model: prefilled rows (Rescue),
/// committed guesses, the shared current-input row, then empty filler.
struct BoardView: View {
    @ObservedObject var vm: GameViewModel
    let boardIndex: Int
    var tileSize: CGFloat = 58
    /// Multi-board fill mode: non-square tile height + a fixed inter-tile gap so
    /// boards fill their cell exactly (web `1fr` rows / `gap-[2px]`). nil = square.
    var tileHeight: CGFloat? = nil
    var fillGap: CGFloat? = nil

    /// Guess count observed at first appear — rows present then (resume/restore)
    /// never flip; only rows committed live during this session do (web parity).
    @State private var seenGuessCount: Int = -1

    private var board: BoardState { vm.board(boardIndex) }
    private var prefilled: [PrefilledGuess] { board.prefilledGuesses ?? [] }
    private var spacing: CGFloat { fillGap ?? tileSize * 0.1 }

    var body: some View {
        VStack(spacing: spacing) {
            // Prefilled (Rescue/Deliverance): revealed, don't consume budget.
            ForEach(prefilled.indices, id: \.self) { i in
                revealedRow(prefilled[i].evaluation)
            }
            // Guess rows up to this board's budget.
            ForEach(0..<board.maxGuesses, id: \.self) { row in
                rowView(row)
            }
        }
        // Web parity: in multi-board modes a solved board gets a green frame +
        // ✓ badge the moment it's won; once the game is over, any unsolved board
        // gets a red frame. Single-board modes show no frame.
        .modifier(SolvedBoardFrame(won: vm.isMultiBoard && board.status == .won,
                                   lost: vm.isMultiBoard && vm.isFinished && board.status != .won,
                                   active: vm.isMultiBoard,
                                   tileSize: tileSize))
        // Sequence: dim locked (future) boards + highlight the active one.
        .opacity(seqLocked ? 0.6 : 1)
        .overlay(activeSeqBorder)
        .onAppear { if seenGuessCount < 0 { seenGuessCount = board.guesses.count } }
    }

    // MARK: Sequence (Succession) per-board state
    private var seqActive: Bool { !vm.isSequence || boardIndex == vm.sequenceActiveIndex }
    private var seqDone: Bool { board.status == .won || board.status == .lost }
    private var seqLocked: Bool { vm.isSequence && !seqActive && !seqDone }
    private var seqShowColors: Bool { !vm.isSequence || seqActive || seqDone }

    @ViewBuilder private var activeSeqBorder: some View {
        if vm.isSequence && seqActive && !seqDone {
            RoundedRectangle(cornerRadius: 8).stroke(Color(hex: 0xFACC15), lineWidth: 2)
        }
    }

    @ViewBuilder
    private func rowView(_ row: Int) -> some View {
        let committed = row < board.guesses.count
        let isCurrent = row == board.guesses.count && board.status == .playing && !vm.isFinished

        if committed, let eval = vm.evaluation(board: boardIndex, row: row) {
            // Flip only the row just committed live this session (not on resume,
            // not older rows) — matches web animating just the latest guess.
            let fresh = seenGuessCount >= 0 && row == board.guesses.count - 1 && board.guesses.count > seenGuessCount
            if seqShowColors { revealedRow(eval, animate: fresh) } else { maskedRow(eval.tiles.count) }
        } else if isCurrent && seqActive {
            let letters = Array(vm.currentInput)
            // Live invalid indicator (web parity): full-length word that isn't in
            // the dictionary OR was already guessed on this board → red row.
            let entry = vm.currentInput.uppercased()
            let invalid = letters.count == vm.wordLength
                && (!GameDictionary.shared.isValidWord(entry) || board.guesses.contains(entry))
            HStack(spacing: spacing) {
                ForEach(0..<vm.wordLength, id: \.self) { col in
                    let ch = col < letters.count ? String(letters[col]) : ""
                    TileView(letter: ch, state: .empty, revealed: false, size: tileSize, height: tileHeight, isInvalid: invalid && !ch.isEmpty)
                }
            }
            .modifier(ShakeEffect(animatableData: CGFloat(vm.shakeCount)))
            .animation(Theme.animation(.linear(duration: 0.4)), value: vm.shakeCount)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(letters.isEmpty ? "Current guess row, empty"
                : "Current guess: \(letters.map(String.init).joined(separator: ", "))\(invalid ? ". Not a valid word" : "")")
        } else {
            HStack(spacing: spacing) {
                ForEach(0..<vm.wordLength, id: \.self) { _ in
                    TileView(letter: "", state: .empty, revealed: false, size: tileSize, height: tileHeight)
                }
            }
            .accessibilityHidden(true)   // unused filler rows are noise to VoiceOver
        }
    }

    /// Locked Sequence board: previous guesses shown as masked bullets (web '•').
    private func maskedRow(_ count: Int) -> some View {
        HStack(spacing: spacing) {
            ForEach(0..<count, id: \.self) { _ in
                TileView(letter: "•", state: .empty, revealed: false, size: tileSize, height: tileHeight)
            }
        }
    }

    private func revealedRow(_ eval: GuessResult, animate: Bool = false) -> some View {
        // Per-tile staggered flip (web parity). Multi-board uses the faster "mini"
        // timing (0.3s / 80ms); single board the full flip (0.5s / 150ms).
        let mini = vm.isMultiBoard
        let stagger = mini ? 0.08 : 0.15
        let dur = mini ? 0.3 : 0.5
        return HStack(spacing: spacing) {
            ForEach(eval.tiles.indices, id: \.self) { col in
                if animate {
                    FlipRevealTile(letter: eval.tiles[col].letter, state: eval.tiles[col].state,
                                   size: tileSize, height: tileHeight, delay: Double(col) * stagger, duration: dur)
                } else {
                    TileView(letter: eval.tiles[col].letter, state: eval.tiles[col].state, revealed: true, size: tileSize, height: tileHeight)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11yRowLabel(eval))
    }
}

/// Web-parity won/lost board treatment: green rounded frame (#4ade80 / bg
/// #f0fdf4) + green ✓ badge for a solved board, red frame (#f87171 / bg
/// #fef2f2) for a lost one. `active` reserves the frame padding for every board
/// so the grid geometry stays stable whether or not a board is solved.
struct SolvedBoardFrame: ViewModifier {
    let won: Bool
    let lost: Bool
    var active: Bool = true
    var tileSize: CGFloat = 40

    func body(content: Content) -> some View {
        // Web: every multi board sits in a card — default border-gray-200 / white,
        // green when solved, red when lost. Single board (active:false) = no frame.
        let border: Color = won ? Color(hex: 0xA78BFA) : (lost ? Color(hex: 0xF87171) : (active ? Color(hex: 0xE5E7EB) : .clear))
        let fill: Color = won ? Color(hex: 0xF5F3FF) : (lost ? Color(hex: 0xFEF2F2) : (active ? .white : .clear))
        let badge = max(13, min(20, tileSize * 0.7))
        return content
            .padding(active ? 4 : 0)
            .background(RoundedRectangle(cornerRadius: 8).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(border, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if won {
                    Image(systemName: "checkmark")
                        .font(.system(size: badge * 0.55, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: badge, height: badge)
                        .background(Circle().fill(Color(hex: 0x8B5CF6)))
                        // Flush to the board's right edge (no rightward overhang):
                        // the right-column boards sit against the post-game
                        // ScrollView's clip bound, so a positive x-offset sheared
                        // the badge. Keep a small upward float (top has room).
                        .offset(x: 0, y: -badge * 0.3)
                }
            }
    }
}

/// Web-parity sizing for the compact "completed / solved daily" boards
/// (ports completed-daily-board.tsx). The web lays solved boards in a
/// width-capped grid whose tiles shrink so EVERY board is visible on one
/// screen — `grid-cols-4` + `min(320px)` for >4 boards, `grid-cols-2` + 240px
/// for 2–4, and 200px for a single board. We solve for the matching tile size
/// (inter-tile spacing is tileSize*0.1; each multi board adds ~12pt of
/// SolvedBoardFrame padding+border) so nothing clips or needs scrolling.
enum CompletedBoardLayout {
    static func cols(_ n: Int) -> Int { n > 4 ? 4 : (n > 1 ? 2 : 1) }
    static func maxWidth(_ n: Int) -> CGFloat { n > 4 ? 320 : (n > 1 ? 240 : 200) }
    static let gridSpacing: CGFloat = 8

    static func tileSize(boardCount: Int, wordLen: Int) -> CGFloat {
        guard wordLen > 0 else { return 16 }
        let c = cols(boardCount)
        let framePad: CGFloat = boardCount > 1 ? 12 : 0
        let cellW = (maxWidth(boardCount) - CGFloat(c - 1) * gridSpacing) / CGFloat(c) - framePad
        let denom = CGFloat(wordLen) + CGFloat(wordLen - 1) * 0.1
        return max(9, cellW / denom)
    }
}

/// Rebuilds per-board `BoardState`s from a flat matches-row guess list when no
/// local session exists (cross-device). Mode-aware: Succession (SEQUENCE) plays
/// boards one at a time, so its flat list is split sequentially — advance to the
/// next board when a guess matches the current solution. Every other multi mode
/// (Quordle/Octordle/Rescue) applies the shared guesses to all boards at once.
enum CompletedBoardReconstruct {
    /// Engine replay: rebuild the finished boards by recreating the initial
    /// state from the deterministic daily seed (which REGENERATES Deliverance's
    /// prefilled rows and every mode's board structure) and replaying the
    /// recorded guesses through the real reducer — so the review shows exactly
    /// what the player saw, cross-device. Falls back to the legacy flat rebuild
    /// only if the seed doesn't reproduce the recorded solutions.
    static func boards(mode: GameMode, seed: String, solutions: [String], guesses: [String], maxGuesses: Int) -> [BoardState] {
        var state = createInitialState(seed: seed, mode: mode)
        let seedMatches = solutions.isEmpty ||
            Set(state.boards.map { $0.solution.uppercased() }) == Set(solutions.map { $0.uppercased() })
        if seedMatches, state.gauntlet == nil {
            let applyToAll = state.boards.count > 1 && mode != .sequence
            var safety = 0
            for g in guesses {
                guard state.status == .playing, safety < 200 else { break }
                safety += 1
                // Hint rows (Six/Seven) are recorded as space-padded strings
                // (the revealed letter in its real slot, blanks elsewhere).
                // .submitGuess would reject them (not a valid word) and drop
                // the row — rebuild the stored hint evaluation instead, so the
                // completed-board dropdown shows hint tiles cross-device, in
                // their real positions (web replayRecordedGuesses parity).
                if g.contains(where: { !$0.isLetter }) {
                    // Derive the revealed POSITIONS from the solution rather than
                    // trusting the recorded string's padding: a row recorded
                    // left-aligned ("A     ") would otherwise replay a .correct
                    // tile at slot 0 and render the hint in the wrong column.
                    // Mirrors how the row is built in-game (every occurrence of
                    // the revealed letter is .correct) — web use-game-snapshot
                    // parity.
                    let solution = Array(state.boards[state.currentBoardIndex].solution.uppercased())
                    let revealed = Set(g.uppercased().filter { $0.isLetter })
                    let derived = solution.map { revealed.contains($0) }
                    let usable = !solution.isEmpty && derived.contains(true)
                    let tiles: [TileResult] = usable
                        ? solution.enumerated().map { i, ch in
                            derived[i]
                                ? TileResult(letter: String(ch), state: .correct)
                                : TileResult(letter: "", state: .hintUsed)
                        }
                        // Unmatchable row (corrupt — a real hint only reveals a
                        // letter that IS in the answer): keep what was recorded.
                        : g.map { ch -> TileResult in
                            ch.isLetter
                                ? TileResult(letter: String(ch).uppercased(), state: .correct)
                                : TileResult(letter: "", state: .hintUsed)
                        }
                    // Re-derive the stored word too, so guesses agree with tiles.
                    let hintWord = tiles.map { $0.state == .correct ? $0.letter : " " }.joined()
                    state = gameReducer(state: state, action: .submitHint(
                        hintWord: hintWord, hintEvaluation: GuessResult(tiles: tiles, isCorrect: false), boardIndex: nil))
                } else if mode == .sequence {
                    // Web shape: flat per-board concatenation — each entry goes
                    // to the first still-PLAYING board (use-game-snapshot parity).
                    guard let idx = state.boards.firstIndex(where: { $0.status == .playing }) else { break }
                    state = gameReducer(state: state, action: .submitGuess(guess: g, boardIndex: idx, applyToAll: false))
                } else {
                    state = gameReducer(state: state, action: .submitGuess(guess: g, applyToAll: applyToAll))
                }
            }
            return state.boards
        }
        return legacyBoards(mode: mode, solutions: solutions, guesses: guesses, maxGuesses: maxGuesses)
    }

    private static func legacyBoards(mode: GameMode, solutions: [String], guesses: [String], maxGuesses: Int) -> [BoardState] {
        let cap = maxGuesses > 0 ? maxGuesses : 6
        if mode == .sequence {
            var idx = 0
            return solutions.map { sol in
                var g: [String] = []
                var solved = false
                while idx < guesses.count {
                    let guess = guesses[idx]; idx += 1
                    g.append(guess)
                    if guess.uppercased() == sol.uppercased() { solved = true; break }
                }
                return BoardState(solution: sol, guesses: g, maxGuesses: cap, status: solved ? .won : .lost)
            }
        }
        // Shared-guess modes: each board gets the guesses up to (incl.) its solve.
        return solutions.map { sol in
            var g: [String] = []
            var solved = false
            for guess in guesses {
                g.append(guess)
                if guess.uppercased() == sol.uppercased() { solved = true; break }
            }
            return BoardState(solution: sol, guesses: g, maxGuesses: cap, status: solved ? .won : .lost)
        }
    }
}

/// Deterministically rebuilds a completed Gauntlet's per-stage breakdown by
/// replaying the recorded flat guess list through the engine. Used on re-entry
/// when there's no local session AND no server-persisted `gauntlet_stages` — the
/// `.nextStage` reducer records each cleared stage's snapshot, so a pure replay
/// reproduces the full run. Lets the proper stage-by-stage results screen show
/// cross-device instead of a meaningless generic board grid.
enum GauntletReconstruct {
    static func reconstruct(seed: String, guesses: [String]) -> (progress: GauntletProgress, won: Bool)? {
        var state = createInitialState(seed: seed, mode: .gauntlet)
        guard state.gauntlet != nil else { return nil }
        var idx = 0, safety = 0
        while idx < guesses.count, state.status == .playing, safety < 1000 {
            safety += 1
            let multi = state.boards.count > 1
            state = gameReducer(state: state, action: .submitGuess(
                guess: guesses[idx].uppercased(), boardIndex: multi ? nil : 0, applyToAll: multi))
            idx += 1
            // Stage cleared but run not finished → advance (records the won
            // stage's result + boards snapshot, then sets up the next stage).
            if state.status == .playing, state.gauntlet != nil,
               state.boards.allSatisfy({ $0.status == .won }) {
                state = gameReducer(state: state, action: .nextStage(elapsedMs: nil))
            }
        }
        guard let g = state.gauntlet, !g.stageResults.isEmpty else { return nil }
        return (g, state.status == .won)
    }
}

/// Read-only completed mini board rendered from a single saved `BoardState`
/// (ports the web CompletedMiniBoard). Renders each board's OWN guesses — so
/// sequence/rescue boards, whose per-board guess streams differ, are correct —
/// padded to `rowCount` for a uniform grid height, framed by win/loss.
struct CompletedMiniBoardView: View {
    let board: BoardState
    let tileSize: CGFloat
    let rowCount: Int
    var framed: Bool = true

    var body: some View {
        let width = board.solution.count
        VStack(spacing: tileSize * 0.1) {
            ForEach(0..<rowCount, id: \.self) { r in
                HStack(spacing: tileSize * 0.1) {
                    if r < board.guesses.count, let stored = board.hintEvaluations?[String(r)] {
                        // Hint rows (Six/Seven) carry a stored evaluation keyed by row index.
                        ForEach(stored.tiles.indices, id: \.self) { c in
                            TileView(letter: stored.tiles[c].letter, state: stored.tiles[c].state, revealed: true, size: tileSize)
                        }
                    } else if r < board.guesses.count, board.guesses[r].count == width {
                        let tiles = evaluateGuess(solution: board.solution, guess: board.guesses[r]).tiles
                        ForEach(tiles.indices, id: \.self) { c in
                            TileView(letter: tiles[c].letter, state: tiles[c].state, revealed: true, size: tileSize)
                        }
                    } else {
                        // Padding row OR a guess whose length doesn't match the solution
                        // (e.g. stale cross-mode / ProperNoundle data mid-transition) —
                        // render empty rather than evaluating a mismatch (which trapped).
                        ForEach(0..<max(1, width), id: \.self) { _ in
                            TileView(letter: "", state: .empty, revealed: false, size: tileSize)
                        }
                    }
                }
            }
        }
        .modifier(SolvedBoardFrame(won: framed && board.status == .won,
                                   lost: framed && board.status != .won,
                                   active: framed, tileSize: tileSize))
    }
}

/// Lays boards out so they always fit on screen above the keyboard. Tiles are
/// sized to the smaller of the width budget and (when `fitHeight` is given) the
/// vertical budget, so multi-board modes like Deliverance/OctoWord never get
/// clipped. Single board = 1 column; 2/4/8 boards = 2 columns.
///
/// - `availableWidth`: usable width for the whole grid.
/// - `fitHeight`: when set (in-play), tiles also shrink to fit this height so
///   every board stays visible. When nil (post-game inside a ScrollView), tiles
///   fit by width only and the parent scrolls.
struct BoardLayout: View {
    @ObservedObject var vm: GameViewModel
    var availableWidth: CGFloat
    var fitHeight: CGFloat? = nil

    private let colSpacing: CGFloat = 10
    private let rowSpacing: CGFloat = 14

    // Match the web (multi-board.tsx): single board = 1 col, 2–4 boards = 2
    // cols, octordle (>4) = 4 cols. Using 2 cols for 8 boards forced 4 rows,
    // which crushed every tile to fit the height — the web's 4×2 keeps them legible.
    private var cols: Int { vm.boardCount <= 1 ? 1 : (vm.boardCount > 4 ? 4 : 2) }
    private var boardRows: Int { (vm.boardCount + cols - 1) / cols }

    /// Tallest board (prefilled rows + guess rows) drives the height budget.
    private var rowsPerBoard: Int {
        (0..<vm.boardCount).map { i in
            let b = vm.board(i)
            return (b.prefilledGuesses?.count ?? 0) + b.maxGuesses
        }.max() ?? vm.maxGuesses
    }

    /// Cap so boards don't balloon on wide screens (matches prior sizes).
    private var maxTile: CGFloat {
        switch vm.boardCount {
        case 1: return 58
        case 2: return 46
        case 4: return 38
        default: return 32 // octordle (8)
        }
    }

    /// Per-board frame overhead (SolvedBoardFrame padding 4*2 + border 2*2).
    private var framePad: CGFloat { vm.boardCount > 1 ? 12 : 0 }

    /// OctoWord-only: the board the user tapped to zoom into (web parity — only
    /// >4-board layouts are zoomable). Overlaid large + still playable.
    @State private var expandedIndex: Int? = nil
    /// 0 = at the tapped board's slot, 1 = centered + full size. Drives the
    /// scale/offset morph so the board visibly maximizes from / minimizes to
    /// its own position.
    @State private var zoomProgress: CGFloat = 0
    private var canZoom: Bool { vm.boardCount > 4 && fitHeight != nil }

    var body: some View {
        Group {
            if vm.boardCount == 1 {
                BoardView(vm: vm, boardIndex: 0, tileSize: fittedTileSize())
            } else {
                multiGrid
            }
        }
        // Center the board in the greedy area between header and keyboard so the
        // leftover space is split top/bottom — matches the web `justify-center
        // h-full` (practice-game.tsx) instead of pinning the board to the top.
        .frame(maxWidth: .infinity, maxHeight: fitHeight == nil ? nil : .infinity, alignment: .center)
        // Zoom overlay covers only the board area (this view's frame), never the
        // keyboard below — matching the web backdrop.
        .overlay { if let i = expandedIndex { expandedOverlay(i) } }
    }

    private let zoomSpring: Animation = .spring(response: 0.45, dampingFraction: 0.82)

    private func dismissExpanded() {
        withAnimation(Theme.animation(zoomSpring)) { zoomProgress = 0 }
        // Remove the overlay once the minimize animation has settled.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if zoomProgress == 0 { expandedIndex = nil }
        }
    }

    /// Dim backdrop + an enlarged, still-playable copy of the tapped board that
    /// scales/offsets from that board's exact grid slot up to a centered full
    /// size (and back on dismiss) — a true maximize/minimize from position.
    @ViewBuilder
    private func expandedOverlay(_ i: Int) -> some View {
        let areaH = fitHeight ?? availableWidth * 2.2
        let cellW = (availableWidth - CGFloat(cols - 1) * boardGap) / CGFloat(cols)
        let cellH = (areaH - CGFloat(boardRows - 1) * boardGap) / CGFloat(boardRows)
        let r = i / cols, c = i % cols
        let srcMidX = CGFloat(c) * (cellW + boardGap) + cellW / 2
        let srcMidY = CGFloat(r) * (cellH + boardGap) + cellH / 2
        let rows = CGFloat(rowsPerBoard)
        // Render the enlarged board with the SAME tile layout as the mini, so at
        // p=0 (scale 1, slot position) it overlays the mini exactly. Then scale up
        // toward center as p→1 — a clean maximize from / minimize to the real slot.
        let tileW = max(6, (cellW - framePadTotal - CGFloat(vm.wordLength - 1) * tileGap) / CGFloat(vm.wordLength))
        let tileH = max(6, (cellH - framePadTotal - (rows - 1) * tileGap) / rows)
        let maxScale = max(1, min(availableWidth * 0.96 / cellW, areaH * 0.96 / cellH))
        let p = zoomProgress
        let s = 1 + (maxScale - 1) * p
        let dx = (srcMidX - availableWidth / 2) * (1 - p)
        let dy = (srcMidY - areaH / 2) * (1 - p)
        ZStack {
            Color.black.opacity(0.6 * p).onTapGesture { dismissExpanded() }
            BoardView(vm: vm, boardIndex: i, tileSize: tileW, tileHeight: tileH, fillGap: tileGap)
                .scaleEffect(s, anchor: .center)
                .offset(x: dx, y: dy)
                .onTapGesture { dismissExpanded() }
        }
        .frame(width: availableWidth, height: areaH, alignment: .center)
    }

    // MARK: Multi-board fill layout — web parity. Boards fill the full width and
    // (in-play) height; tiles stretch to non-square cells like the web's `1fr`
    // rows. 8px between boards (gap-2), 2px between tiles (gap-[2px]).
    private let boardGap: CGFloat = 8
    private let tileGap: CGFloat = 2
    private let framePadTotal: CGFloat = 8   // SolvedBoardFrame .padding(4) per side

    private var multiGrid: some View {
        let n = vm.boardCount
        let cellW = (availableWidth - CGFloat(cols - 1) * boardGap) / CGFloat(cols)
        let rows = CGFloat(rowsPerBoard)
        let innerW = cellW - framePadTotal
        let tileW = max(6, (innerW - CGFloat(vm.wordLength - 1) * tileGap) / CGFloat(vm.wordLength))
        // Cell height fills the vertical budget in-play; nil → square tiles (post-game scroll).
        let cellH: CGFloat? = {
            guard let h = fitHeight, h.isFinite, h > 0 else { return nil }
            return (h - CGFloat(boardRows - 1) * boardGap) / CGFloat(boardRows)
        }()
        let tileH = max(6, cellH.map { ($0 - framePadTotal - (rows - 1) * tileGap) / rows } ?? tileW)
        return VStack(spacing: boardGap) {
            ForEach(0..<boardRows, id: \.self) { r in
                HStack(spacing: boardGap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let i = r * cols + c
                        if i < n {
                            BoardView(vm: vm, boardIndex: i, tileSize: tileW, tileHeight: tileH, fillGap: tileGap)
                                .frame(width: cellW)
                                // Hide the mini while it's zoomed; the overlay copy morphs over it.
                                .opacity(expandedIndex == i ? 0 : 1)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    guard canZoom else { return }
                                    expandedIndex = i
                                    zoomProgress = 0
                                    // Render the overlay at the slot first, then grow it.
                                    DispatchQueue.main.async {
                                        withAnimation(Theme.animation(zoomSpring)) { zoomProgress = 1 }
                                    }
                                }
                        } else {
                            Color.clear.frame(width: cellW)
                        }
                    }
                }
            }
        }
        .frame(width: availableWidth, alignment: .top)
    }

    /// Solve for the largest tile that fits both the width and (optionally) the
    /// height budget. Within a board, inter-tile spacing is `tileSize * 0.1`
    /// (see BoardView.spacing).
    private func fittedTileSize() -> CGFloat {
        let wl = CGFloat(vm.wordLength)
        // board width  = wl*t + (wl-1)*0.1*t = t * (wl + (wl-1)*0.1)
        let wFactor = wl + (wl - 1) * 0.1
        let usableW = availableWidth - CGFloat(cols - 1) * colSpacing - CGFloat(cols) * framePad
        let tileW = usableW / (CGFloat(cols) * wFactor)

        guard let h = fitHeight, h.isFinite, h > 0 else {
            return max(8, min(maxTile, tileW))
        }
        let rb = CGFloat(rowsPerBoard)
        let hFactor = rb + (rb - 1) * 0.1
        let usableH = h - CGFloat(boardRows - 1) * rowSpacing - CGFloat(boardRows) * framePad
        let tileH = usableH / (CGFloat(boardRows) * hFactor)
        return max(8, min(maxTile, tileW, tileH))
    }
}
