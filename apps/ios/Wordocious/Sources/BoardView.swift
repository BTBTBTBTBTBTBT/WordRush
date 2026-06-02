import SwiftUI
import WordociousCore

struct TileView: View {
    let letter: String
    let state: TileState
    let revealed: Bool
    var size: CGFloat = 58

    var body: some View {
        let filled = state != .empty
        Text(letter)
            .font(Brand.font(size * 0.5, .black))
            .foregroundStyle(filled && revealed ? .white : Theme.textPrimary)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: size * 0.14)
                    .fill(revealed ? Theme.tileColor(for: state) : Color.white)
            )
            .overlay(
                // Web: empty/typing tiles use gray-300; revealed absent stays gray-300,
                // revealed present/correct use the lighter gray-200 — no dark outline.
                RoundedRectangle(cornerRadius: size * 0.14)
                    .stroke(!revealed ? Theme.emptyBorder : (state == .absent ? Theme.emptyBorder : Theme.borderAlt),
                            lineWidth: 2)
            )
    }
}

/// Renders one board (by index) from the view model: prefilled rows (Rescue),
/// committed guesses, the shared current-input row, then empty filler.
struct BoardView: View {
    @ObservedObject var vm: GameViewModel
    let boardIndex: Int
    var tileSize: CGFloat = 58

    private var board: BoardState { vm.board(boardIndex) }
    private var prefilled: [PrefilledGuess] { board.prefilledGuesses ?? [] }
    private var spacing: CGFloat { tileSize * 0.1 }

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
    }

    @ViewBuilder
    private func rowView(_ row: Int) -> some View {
        let committed = row < board.guesses.count
        let isCurrent = row == board.guesses.count && board.status == .playing && !vm.isFinished

        if committed, let eval = vm.evaluation(board: boardIndex, row: row) {
            revealedRow(eval)
        } else if isCurrent {
            let letters = Array(vm.currentInput)
            HStack(spacing: spacing) {
                ForEach(0..<vm.wordLength, id: \.self) { col in
                    let ch = col < letters.count ? String(letters[col]) : ""
                    TileView(letter: ch, state: .empty, revealed: false, size: tileSize)
                }
            }
        } else {
            HStack(spacing: spacing) {
                ForEach(0..<vm.wordLength, id: \.self) { _ in
                    TileView(letter: "", state: .empty, revealed: false, size: tileSize)
                }
            }
        }
    }

    private func revealedRow(_ eval: GuessResult) -> some View {
        HStack(spacing: spacing) {
            ForEach(eval.tiles.indices, id: \.self) { col in
                TileView(letter: eval.tiles[col].letter, state: eval.tiles[col].state, revealed: true, size: tileSize)
            }
        }
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
        let border: Color = won ? Color(hex: 0x4ADE80) : (lost ? Color(hex: 0xF87171) : .clear)
        let fill: Color = won ? Color(hex: 0xF0FDF4) : (lost ? Color(hex: 0xFEF2F2) : .clear)
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
                        .background(Circle().fill(Color(hex: 0x22C55E)))
                        .offset(x: badge * 0.3, y: -badge * 0.3)
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
    static func boards(mode: GameMode, solutions: [String], guesses: [String], maxGuesses: Int) -> [BoardState] {
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
                    if r < board.guesses.count {
                        let g = board.guesses[r]
                        // Hint rows (Six/Seven) carry a stored evaluation keyed by word.
                        let tiles = (board.hintEvaluations?[g] ?? evaluateGuess(solution: board.solution, guess: g)).tiles
                        ForEach(tiles.indices, id: \.self) { c in
                            TileView(letter: tiles[c].letter, state: tiles[c].state, revealed: true, size: tileSize)
                        }
                    } else {
                        ForEach(0..<width, id: \.self) { _ in
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

    var body: some View {
        let tile = fittedTileSize()
        Group {
            if vm.boardCount == 1 {
                BoardView(vm: vm, boardIndex: 0, tileSize: tile)
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: colSpacing), count: cols),
                          spacing: rowSpacing) {
                    ForEach(0..<vm.boardCount, id: \.self) { i in
                        BoardView(vm: vm, boardIndex: i, tileSize: tile)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: fitHeight == nil ? nil : .infinity)
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
