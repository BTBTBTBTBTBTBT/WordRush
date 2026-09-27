import SwiftUI
import WordociousCore

/// Today's daily for a custom-engine title, by catalog id. Every custom game's
/// view restores a finished daily from its own save and shows its own result
/// screen, so this is the ONE place the Home solved cover, the leaderboard's
/// Play / View button and the Stats Today tiles route those titles through.
/// Founder, 2026-09-27: Letter Ladder / Muddle / Hubbub were reaching the
/// word-game `SolvedPuzzleView` (empty grids) from three different covers.
struct CustomDailyView: View {
    let id: String

    /// The catalog id for a GameMode, or nil for the word engines.
    static func customId(for mode: GameMode) -> String? {
        guard mode.isCustomEngine else { return nil }
        return ModeGen.byDbKey(mode.rawValue)?.id
    }

    var body: some View {
        switch id {
        case "sudoku": SudokuView()
        case "regions": RegionsView()
        case "ladder": LadderView()
        case "wordsearch": SpyglassView()
        case "hub": HubView()
        case "cryptogram": CodebreakerView()
        case "groups": KindredView()
        case "crossword": CrosswordView()
        case "scramble": MuddleView()
        default: ProperNoundleView()
        }
    }
}
