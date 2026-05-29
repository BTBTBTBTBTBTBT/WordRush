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
            .font(Brand.font(size * 0.5, .heavy))
            .foregroundStyle(filled && revealed ? .white : Theme.textPrimary)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: size * 0.14)
                    .fill(revealed ? Theme.tileColor(for: state) : Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: size * 0.14)
                    .stroke(letter.isEmpty ? Theme.emptyBorder : Theme.textPrimary.opacity(0.25),
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

/// Lays boards out: single board full-size; multi-board in a scrollable grid
/// sized to fit (2 columns for 2/4 boards, 2 columns for 8).
struct BoardLayout: View {
    @ObservedObject var vm: GameViewModel

    var body: some View {
        if vm.boardCount == 1 {
            BoardView(vm: vm, boardIndex: 0, tileSize: tileSize(for: 1))
        } else {
            ScrollView {
                let cols = columns(for: vm.boardCount)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: cols), spacing: 14) {
                    ForEach(0..<vm.boardCount, id: \.self) { i in
                        BoardView(vm: vm, boardIndex: i, tileSize: tileSize(for: vm.boardCount))
                    }
                }
                .padding(.horizontal, 6)
            }
        }
    }

    private func columns(for count: Int) -> Int {
        count <= 1 ? 1 : 2
    }

    private func tileSize(for count: Int) -> CGFloat {
        switch count {
        case 1: return 58
        case 2: return 40
        case 4: return 26
        default: return 18 // octordle (8)
        }
    }
}
