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

/// FINISH_SPEC §B3 / §AU4 reveal: the tile turns over GPU-only. Two FIXED faces
/// (the typed face and the colored face, built once) on a fixed-size frame; the
/// front turns 0 → 90° about X, then the back turns −90° → 0, both with
/// `rotation3DEffect` + perspective. Only transforms animate — no view body runs per
/// frame and nothing re-lays-out mid-flip (the old animatable face rebuilt the whole
/// glossy tile every frame for every flipping tile).
private struct FlipFaces: View {
    let letter: String
    let face: GlossyFace
    let width: CGFloat
    let height: CGFloat
    let glow: Color
    let glowAmount: CGFloat
    let goldRing: Bool
    /// Front face angle (0 → 90) and back face angle (−90 → 0).
    let front: Double
    let back: Double

    var body: some View {
        ZStack {
            GlossyTile(face: .typed, letter: letter, width: width, height: height)
                .rotation3DEffect(.degrees(front), axis: (x: 1, y: 0, z: 0), perspective: 0.45)
                .opacity(front >= 89.5 ? 0 : 1)
            GlossyTile(face: face, letter: letter, width: width, height: height,
                       glow: glow, glowAmount: glowAmount, goldRing: goldRing)
                .rotation3DEffect(.degrees(back), axis: (x: 1, y: 0, z: 0), perspective: 0.45)
                .opacity(back <= -89.5 ? 0 : 1)
        }
        .frame(width: width, height: height)
    }
}

/// A just-committed tile that flips open on reveal (FINISH_SPEC §B3, §BI5): 0.5 s
/// each, 150 ms apart (mini boards 0.3 s / 80 ms), the color swapping at the half, then a soft color glow (bloom,
/// 600 ms). A hint tile pulses a gold glow twice instead; the winning row hops in
/// a wave (`hopAt`); a lost board's last row wobbles and sinks (`sinkAt`).
/// Reduce Motion: the final face, no motion.
struct FlipRevealTile: View {
    let letter: String
    let state: TileState
    var size: CGFloat = 58
    var height: CGFloat? = nil
    var delay: Double = 0
    var duration: Double = TileMotion.flip
    /// Seconds after appearing when this tile starts its win hop (nil = none).
    var hopAt: Double? = nil
    /// Seconds after appearing when this tile starts its loss wobble + sink.
    var sinkAt: Double? = nil
    /// A hint reveal: the gold glow ×2 instead of the color bloom.
    var hint: Bool = false
    /// The soft color bloom after landing (off on multi-board grids).
    var bloom: Bool = true

    @State private var front: Double = 0
    @State private var back: Double = -90
    @State private var glow: CGFloat = 0
    @State private var hop: Double = 0
    @State private var sink: Double = 0

    var body: some View {
        let h = height ?? size
        let face = GlossyFace(revealed: state)
        let box = CGSize(width: size, height: h)
        FlipFaces(letter: letter, face: face, width: size, height: h,
                  glow: hint ? Color(hex: 0xF5C542).opacity(0.7) : (bloom ? GlossyTile.bloom(face) : .clear),
                  glowAmount: glow, goldRing: hint, front: front, back: back)
            .modifier(KeyframeEffect(progress: hop, frames: TileMotion.hopFrames, easing: TileMotion.hopEasing, size: box))
            .modifier(KeyframeEffect(progress: sink, frames: TileMotion.sinkFrames, easing: .easeOut, size: box,
                                     desaturate: sink > 0))
            .onAppear(perform: run)
    }

    private func run() {
        // §U: each tile of a reveal — flip · selection (sound plays under Reduce
        // Motion too); the winning row's landing — a light tap. Letterless tiles (the
        // VS opponent's mini board) stay quiet — its row already gets a soft thunk.
        let fresh = front == 0 && back == -90
        if fresh && !letter.isEmpty {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { Feedback.flip() }
            if let hopAt, delay == 0 { DispatchQueue.main.asyncAfter(deadline: .now() + hopAt) { Feedback.rowLand() } }
        }
        // Theme.reduceMotion = in-app toggle OR OS setting: the final face, no motion.
        guard !Theme.reduceMotion else { front = 89.5; back = 0; return }
        guard fresh else { return }
        // §AU4: two transform-only halves (ease in to edge-on, ease out to flat).
        withAnimation(.easeIn(duration: duration / 2).delay(delay)) { front = 89.5 }
        withAnimation(.easeOut(duration: duration / 2).delay(delay + duration / 2)) { back = 0 }
        let land = delay + duration
        if hint {
            for k in 0..<2 {
                let t = land + Double(k) * TileMotion.hintPulse
                DispatchQueue.main.asyncAfter(deadline: .now() + t) {
                    withAnimation(.easeInOut(duration: TileMotion.hintPulse / 2)) { glow = 1 }
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + t + TileMotion.hintPulse / 2) {
                    withAnimation(.easeInOut(duration: TileMotion.hintPulse / 2)) { glow = 0 }
                }
            }
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + land) {
                withAnimation(.easeOut(duration: TileMotion.bloom * 0.35)) { glow = 1 }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + land + TileMotion.bloom * 0.35) {
                withAnimation(.easeOut(duration: TileMotion.bloom * 0.65)) { glow = 0 }
            }
        }
        if let hopAt {
            withAnimation(.linear(duration: TileMotion.hop).delay(hopAt)) { hop = 1 }
        }
        if let sinkAt {
            withAnimation(.linear(duration: TileMotion.sink).delay(sinkAt)) { sink = 1 }
        }
    }
}

/// One board tile in the game kit's glossy look (FINISH_SPEC §B1): frosted glass
/// when empty, a white face with a purple border once typed (it pops in), purple
/// / gold / slate once revealed, red letters + ring when the row isn't a word.
/// Same API as before, so every board (solo, VS, completed recaps) follows.
struct TileView: View {
    let letter: String
    let state: TileState
    let revealed: Bool
    var size: CGFloat = 58
    /// Optional explicit height — multi-board fills its cell with non-square
    /// tiles (web `1fr` rows). Defaults to a square tile.
    var height: CGFloat? = nil
    /// Live "not a valid / already-guessed word" indicator on the typing row —
    /// red letters + ring (§B3), shown before Enter and while a rejection plays.
    var isInvalid: Bool = false

    private var face: GlossyFace {
        if isInvalid { return .bad }
        if revealed { return GlossyFace(revealed: state) }
        // "•" marks a locked Succession board's hidden guesses.
        return letter.isEmpty || letter == "•" ? .empty : .typed
    }

    var body: some View {
        let h = height ?? size
        GlossyTile(face: face, letter: letter, width: size, height: h)
            // §B3 type: the letter fades in as the tile swells (typing rows only).
            .modifier(TypePop(letter: revealed ? "" : letter, size: CGSize(width: size, height: h)))
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
    /// §L: the zoomed (OctoWord) copy of a board — its tray takes the active state.
    var zoomed: Bool = false
    /// The mini tray's inner padding (BoardLayout sizes the grid around it).
    var trayPadding: CGFloat? = nil

    /// Guess count observed at first appear — rows present then (resume/restore)
    /// never flip; only rows committed live during this session do (web parity).
    @State private var seenGuessCount: Int = -1
    /// §B3 not a word: the typed letters stay red for the rejection's 1 s glow.
    @State private var rejecting = false
    @State private var rejectGlow: CGFloat = 0

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
        // §L: in multi-board modes every board is its own tray; the active
        // Succession board / the zoomed OctoWord board gets the stronger tint + ring.
        .modifier(SolvedBoardFrame(won: vm.isMultiBoard && board.status == .won,
                                   lost: vm.isMultiBoard && vm.isFinished && board.status != .won,
                                   active: vm.isMultiBoard,
                                   tileSize: tileSize,
                                   accent: ModeStyle.accent(vm.mode),
                                   highlighted: zoomed || (vm.isSequence && seqActive && !seqDone),
                                   padding: trayPadding))
        // Sequence: dim locked (future) boards.
        .opacity(seqLocked ? 0.6 : 1)
        .onAppear { if seenGuessCount < 0 { seenGuessCount = board.guesses.count } }
        .onChange(of: vm.shakeCount) { _ in playReject() }
        // §AQ1: typing over a rejected row drops its red hold at once.
        .onChange(of: vm.inputEpoch) { _ in
            guard rejecting else { return }
            rejecting = false
            rejectGlow = 0
        }
    }

    /// §B3 "not a word": the letters turn red with a soft red glow for 1 s while the
    /// row nudges (the view model then clears them right to left).
    private func playReject() {
        rejecting = true
        DispatchQueue.main.asyncAfter(deadline: .now() + TileMotion.rejectHold) { rejecting = false }
        guard !Theme.reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.35)) { rejectGlow = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            withAnimation(.easeInOut(duration: 0.65)) { rejectGlow = 0 }
        }
    }

    // MARK: Sequence (Succession) per-board state
    private var seqActive: Bool { !vm.isSequence || boardIndex == vm.sequenceActiveIndex }
    private var seqDone: Bool { board.status == .won || board.status == .lost }
    private var seqLocked: Bool { vm.isSequence && !seqActive && !seqDone }
    private var seqShowColors: Bool { !vm.isSequence || seqActive || seqDone }

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
                    TileView(letter: ch, state: .empty, revealed: false, size: tileSize, height: tileHeight,
                             isInvalid: (invalid || rejecting) && !ch.isEmpty)
                }
            }
            .shadow(color: Color(hex: 0xF0435F).opacity(0.6 * Double(rejectGlow)), radius: tileSize * 0.3 * rejectGlow)
            // §B3: the small row nudge (520 ms).
            .modifier(NudgeEffect(animatableData: CGFloat(vm.shakeCount), scale: max(0.5, tileSize / 58)))
            .animation(Theme.animation(.linear(duration: TileMotion.nudge)), value: vm.shakeCount)
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
        // FINISH_SPEC §B3 / §BI5: one motion kit for every board — each tile turns over
        // in 0.5 s, 150 ms apart on a single board; a multi-board game uses the "mini"
        // pacing (0.3 s, 80 ms apart; every board at once); the winning row hops in a wave
        // once it has landed; a lost board's last row wobbles and sinks; a hint row pulses gold.
        let n = eval.tiles.count
        let mini = vm.isMultiBoard
        let landed = TileMotion.rowReveal(columns: n, mini: mini)
        let isHint = eval.tiles.contains { $0.state == .hintUsed }
        // Perf audit (founder: smooth over flashy): 5+ boards (OctoWord, its Gauntlet
        // stage) turn colors at once — 40 simultaneous flips cost frames; 2–4 boards
        // flip without the per-tile bloom glow (a blurred shadow per tile).
        let animate = animate && vm.boardCount <= 4
        let bloom = vm.boardCount <= 1
        let wins = animate && eval.isCorrect
        let sinks = animate && !eval.isCorrect && board.status == .lost
        return HStack(spacing: spacing) {
            ForEach(eval.tiles.indices, id: \.self) { col in
                if animate {
                    FlipRevealTile(letter: eval.tiles[col].letter, state: eval.tiles[col].state,
                                   size: tileSize, height: tileHeight,
                                   delay: Double(col) * TileMotion.stagger(mini: mini),
                                   duration: TileMotion.flipDuration(mini: mini),
                                   hopAt: wins ? landed + Double(col) * TileMotion.hopStagger : nil,
                                   sinkAt: sinks ? landed + Double(col) * TileMotion.sinkStagger : nil,
                                   hint: isHint && eval.tiles[col].state == .correct, bloom: bloom)
                } else {
                    TileView(letter: eval.tiles[col].letter, state: eval.tiles[col].state, revealed: true, size: tileSize, height: tileHeight)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11yRowLabel(eval))
    }
}

/// FINISH_SPEC §L: every multi board (QuadWord / OctoWord / Succession /
/// Deliverance, the completed recaps) sits on its own shared GAME TRAY — a soft
/// wash of the game's accent, a 1.5-pt border, a 4-pt lip, gloss and shadow. A
/// solved board's tray takes the gentle purple (won) wash + a ✓ badge; once the
/// game is over an unsolved board's tray turns slate (lost). The active / zoomed
/// board gets the stronger tint + ring. `active` reserves the tray for every board
/// so the grid geometry stays stable whether or not a board is solved; a single
/// board (active: false) draws no frame here (the game screen trays it itself).
struct SolvedBoardFrame: ViewModifier {
    let won: Bool
    let lost: Bool
    var active: Bool = true
    var tileSize: CGFloat = 40
    /// The game's accent (the tray wash).
    var accent: Color = FinishInk.purple
    /// The active / zoomed board of a multi-board game (stronger tint + ring).
    var highlighted: Bool = false
    /// Inner padding; nil = sized from the tile (mini boards stay compact).
    var padding: CGFloat? = nil

    /// The compact tray padding for a mini board (≤ 6 per side so the completed
    /// grids' 12-pt frame budget still holds).
    static func miniPadding(tileSize: CGFloat) -> CGFloat { max(4, min(6, tileSize * 0.3)) }
    static func miniRadius(tileSize: CGFloat) -> CGFloat { max(10, min(18, tileSize * 0.7)) }

    @ViewBuilder
    func body(content: Content) -> some View {
        let badge = max(13, min(20, tileSize * 0.7))
        let state: GameTrayState = won ? .won : (lost ? .lost : (highlighted ? .active : .normal))
        if active {
            content
                .gameTray(accent: accent, state: state, radius: Self.miniRadius(tileSize: tileSize),
                          padding: padding ?? Self.miniPadding(tileSize: tileSize))
                .overlay(alignment: .topTrailing) {
                    if won {
                        Image(systemName: "checkmark")
                            .font(.system(size: badge * 0.55, weight: .black))
                            .foregroundStyle(.white)
                            .frame(width: badge, height: badge)
                            .background(Circle().fill(LinearGradient(colors: [Color(hex: 0xA66BFF), Color(hex: 0x6D28D9)],
                                                                     startPoint: .top, endPoint: .bottom)))
                            .overlay(Circle().strokeBorder(Color(hex: 0xF5C542), lineWidth: 1))
                            .shadow(color: Color(hex: 0x4C1D95).opacity(0.3), radius: 2, x: 0, y: 1.5)
                            // Flush to the board's right edge (no rightward overhang):
                            // the right-column boards sit against the post-game
                            // ScrollView's clip bound, so a positive x-offset sheared
                            // the badge. Keep a small upward float (top has room).
                            .offset(x: 0, y: -badge * 0.3)
                            .accessibilityHidden(true)
                    }
                }
        } else {
            content
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
    /// §233: on the persistent post-game of a LOST run, the failed board
    /// spells out its answer under the tiles (the answer never appears in the
    /// tiles themselves) — Android/web parity; off everywhere else, so the
    /// home grid, profiles, and VS recaps never spoil.
    var revealMissed: Bool = false

    /// §AT2: the shared row count for a multi-board recap — every board pads to the
    /// largest one (core `RecapSizing`), so all boards draw the same size.
    static func sharedRows(_ boards: [BoardState], floor: Int = 1) -> Int {
        RecapSizing.sharedRows(guessCounts: boards.map(\.guesses.count), budgets: boards.map(\.maxGuesses), floor: floor)
    }

    var body: some View {
        let width = board.solution.count
        // §AT2: a fixed grid size (the answer slot reserved on EVERY board when the
        // recap reveals missed answers), so a lost board never draws bigger or smaller.
        let size = RecapSizing.boardSize(tile: Double(tileSize), columns: max(1, width),
                                         rows: max(1, rowCount), revealMissed: revealMissed)
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
            if revealMissed {
                Text(board.status != .won ? board.solution.uppercased() : " ")
                    .font(Brand.font(11, .black))
                    .foregroundStyle(Color(hex: 0xDC2626))
                    .lineLimit(1).minimumScaleFactor(0.4)
                    .frame(width: CGFloat(size.width),
                           height: CGFloat(RecapSizing.answerSlot(tile: Double(tileSize), revealMissed: true)))
                    .accessibilityHidden(board.status == .won)
            }
        }
        .frame(width: CGFloat(size.width), height: CGFloat(size.height), alignment: .top)
        .modifier(SolvedBoardFrame(won: framed && board.status == .won,
                                   lost: framed && board.status != .won,
                                   active: framed, tileSize: tileSize))
    }
}

/// Lays boards out with the ONE shared sizing rule (FINISH_SPEC §B5, core
/// `BoardSizing`): the board fills the space between the title / status line and
/// the keyboard — as wide as the screen allows (a 2% margin each side) and
/// centered in the remaining height. Multi-board games size their whole grid the
/// same way (tiles stretch to fill each cell, web `1fr` rows).
///
/// - `availableWidth`: usable width for the whole grid.
/// - `fitHeight`: when set (in-play), tiles also shrink to fit this height so
///   every board stays visible. When nil (post-game inside a ScrollView), tiles
///   fit by width only and the parent scrolls.
struct BoardLayout: View {
    @ObservedObject var vm: GameViewModel
    var availableWidth: CGFloat
    var fitHeight: CGFloat? = nil
    /// §L: sit the single board on the shared game tray. Default = live play only
    /// (`fitHeight` set); the finished recaps are trayed by their own call sites.
    var tray: Bool? = nil

    private var trayed: Bool { tray ?? (fitHeight != nil) }

    private var cols: Int { BoardSizing.boardColumns(boardCount: vm.boardCount) }
    private var boardRows: Int { BoardSizing.boardRows(boardCount: vm.boardCount) }

    /// Tallest board (prefilled rows + guess rows) drives the height budget.
    private var rowsPerBoard: Int {
        (0..<vm.boardCount).map { i in
            let b = vm.board(i)
            return (b.prefilledGuesses?.count ?? 0) + b.maxGuesses
        }.max() ?? vm.maxGuesses
    }

    /// The multi-board fill layout from the shared rule.
    private var multi: BoardSizing.Multi {
        // §L: each mini board's tray pads both sides and adds its 4-pt lip below,
        // so the height budget loses one lip per board row (exact: cellH − lip).
        BoardSizing.multi(boardCount: vm.boardCount, wordLength: vm.wordLength, rowsPerBoard: rowsPerBoard,
                          width: Double(availableWidth),
                          height: fitHeight.map { Double($0) - Double(CGFloat(boardRows) * GameTray.lip) / BoardSizing.heightFill },
                          boardGap: Double(boardGap), tileGap: Double(tileGap), framePad: Double(framePadTotal))
    }

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
                // §L: the single Classic-family board sits on the shared game tray
                // (purple wash once won, slate once lost).
                if trayed {
                    BoardView(vm: vm, boardIndex: 0, tileSize: fittedTileSize())
                        .gameTray(accent: ModeStyle.accent(vm.mode), state: singleTrayState,
                                  padding: singlePad)
                } else {
                    BoardView(vm: vm, boardIndex: 0, tileSize: fittedTileSize())
                }
            } else {
                multiGrid
            }
        }
        // Center the board in the greedy area between header and keyboard so the
        // leftover space is split top/bottom.
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
        let m = multi
        let gridW = CGFloat(m.gridWidth)
        let areaH = fitHeight ?? availableWidth * 2.2
        let cellW = CGFloat(m.cellWidth)
        // The tray's lip sits below each cell's sized height (§L).
        let cellH = m.cellHeight.map { CGFloat($0) + GameTray.lip }
            ?? (areaH - CGFloat(boardRows - 1) * boardGap) / CGFloat(boardRows)
        let gridH = cellH * CGFloat(boardRows) + CGFloat(boardRows - 1) * boardGap
        let r = i / cols, c = i % cols
        let srcMidX = CGFloat(c) * (cellW + boardGap) + cellW / 2
        let srcMidY = (areaH - gridH) / 2 + CGFloat(r) * (cellH + boardGap) + cellH / 2
        // Render the enlarged board with the SAME tile layout as the mini, so at
        // p=0 (scale 1, slot position) it overlays the mini exactly. Then scale up
        // toward center as p→1 — a clean maximize from / minimize to the real slot.
        let tileW = CGFloat(m.tileWidth)
        let tileH = CGFloat(m.tileHeight)
        let maxScale = max(1, min(gridW * 0.96 / cellW, areaH * 0.96 / cellH))
        let p = zoomProgress
        let sc = 1 + (maxScale - 1) * p
        let dx = (srcMidX - gridW / 2) * (1 - p)
        let dy = (srcMidY - areaH / 2) * (1 - p)
        ZStack {
            Color.black.opacity(0.6 * p).onTapGesture { dismissExpanded() }
            BoardView(vm: vm, boardIndex: i, tileSize: tileW, tileHeight: tileH, fillGap: tileGap,
                      zoomed: true, trayPadding: miniPad)
                .scaleEffect(sc, anchor: .center)
                .offset(x: dx, y: dy)
                .onTapGesture { dismissExpanded() }
        }
        .frame(width: gridW, height: areaH, alignment: .center)
    }

    // MARK: Multi-board fill layout — 8 pt between boards, 2 pt between tiles.
    private let boardGap: CGFloat = 8
    private let tileGap: CGFloat = 2
    /// §L: each mini board's tray padding (OctoWord stays compact).
    private var miniPad: CGFloat { vm.boardCount > 4 ? 5 : 7 }
    private var framePadTotal: CGFloat { miniPad * 2 }
    /// §L: the single board's tray padding (10–12 pt; a touch less on tiny phones).
    private var singlePad: CGFloat { availableWidth < 340 ? 8 : GameTray.padding }
    private var singleTrayState: GameTrayState {
        guard vm.isFinished else { return .normal }
        return vm.board(0).status == .won ? .won : .lost
    }

    private var multiGrid: some View {
        let n = vm.boardCount
        let m = multi
        let cellW = CGFloat(m.cellWidth)
        let tileW = CGFloat(m.tileWidth)
        let tileH = CGFloat(m.tileHeight)
        return VStack(spacing: boardGap) {
            ForEach(0..<boardRows, id: \.self) { r in
                HStack(spacing: boardGap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let i = r * cols + c
                        if i < n {
                            BoardView(vm: vm, boardIndex: i, tileSize: tileW, tileHeight: tileH, fillGap: tileGap,
                                      trayPadding: miniPad)
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
        .frame(width: CGFloat(m.gridWidth), alignment: .top)
    }

    /// §B5: the largest square tile that fits the width (2% margins) and, in play,
    /// the height between the title and the keyboard. Inter-tile spacing is
    /// `tileSize * 0.1` (see BoardView.spacing). §L: the tray's padding (both
    /// sides) and its 4-pt lip come out of the budget first so it never overflows.
    private func fittedTileSize() -> CGFloat {
        let pad = trayed ? singlePad * 2 : 0
        let lip = trayed ? GameTray.lip + 4 : 0
        return CGFloat(BoardSizing.squareTile(columns: vm.wordLength, rows: rowsPerBoard,
                                              width: Double(availableWidth - pad / CGFloat(BoardSizing.widthFill)),
                                              height: fitHeight.map { Double($0 - (pad + lip) / CGFloat(BoardSizing.heightFill)) }))
    }
}
