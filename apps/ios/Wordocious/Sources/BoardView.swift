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
        .opacity(board.status == .won ? 0.55 : 1)
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

    private var cols: Int { vm.boardCount <= 1 ? 1 : 2 }
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
        case 2: return 44
        case 4: return 34
        default: return 24 // octordle (8)
        }
    }

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
        let usableW = availableWidth - CGFloat(cols - 1) * colSpacing
        let tileW = usableW / (CGFloat(cols) * wFactor)

        guard let h = fitHeight, h.isFinite, h > 0 else {
            return max(8, min(maxTile, tileW))
        }
        let rb = CGFloat(rowsPerBoard)
        let hFactor = rb + (rb - 1) * 0.1
        let usableH = h - CGFloat(boardRows - 1) * rowSpacing
        let tileH = usableH / (CGFloat(boardRows) * hFactor)
        return max(8, min(maxTile, tileW, tileH))
    }
}
