import SwiftUI
import WordociousCore

struct TileView: View {
    let letter: String
    let state: TileState
    let revealed: Bool

    var body: some View {
        let filled = state != .empty
        Text(letter)
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .foregroundStyle(filled && revealed ? .white : Theme.textPrimary)
            .frame(width: 58, height: 58)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(revealed ? Theme.tileColor(for: state) : Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(letter.isEmpty ? Theme.emptyBorder : Theme.textPrimary.opacity(0.25),
                            lineWidth: 2)
            )
            .rotation3DEffect(
                .degrees(revealed ? 0 : 0),
                axis: (x: 1, y: 0, z: 0)
            )
    }
}

struct BoardView: View {
    @ObservedObject var vm: GameViewModel

    var body: some View {
        VStack(spacing: 6) {
            ForEach(0..<vm.maxGuesses, id: \.self) { row in
                rowView(row)
            }
        }
    }

    @ViewBuilder
    private func rowView(_ row: Int) -> some View {
        let committed = row < vm.board.guesses.count
        let isCurrent = row == vm.board.guesses.count && !vm.isFinished
        let eval = vm.evaluation(forRow: row)

        HStack(spacing: 6) {
            ForEach(0..<vm.wordLength, id: \.self) { col in
                if committed, let eval {
                    TileView(letter: eval.tiles[col].letter, state: eval.tiles[col].state, revealed: true)
                } else if isCurrent {
                    let letters = Array(vm.currentInput)
                    let ch = col < letters.count ? String(letters[col]) : ""
                    TileView(letter: ch, state: .empty, revealed: false)
                } else {
                    TileView(letter: "", state: .empty, revealed: false)
                }
            }
        }
    }
}
