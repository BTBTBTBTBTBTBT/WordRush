#if DEBUG
import SwiftUI
import UIKit
import WordociousCore

/// `-shareSheetDemo <finished|leaderboard>` (with `-storeDemo`, and `-debug-season halloween` for the season look): after launch
/// the app opens the custom share sheet over Home with sample cards, so it can be captured in the simulator
/// (docs/design/review/share-sheet-1016/ios-*.png). `finished` carries a Starsweep result (with its No spoilers / Full results
/// toggle) and the leaderboard card as the second page of the carousel; `leaderboard` carries the leaderboard card alone.
enum ShareSheetDemo {
    static var kind: String? {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-shareSheetDemo"), i + 1 < a.count else { return nil }
        return a[i + 1]
    }

    @MainActor
    static func present(_ kind: String) {
        let season = CastSkin.season?.rawValue
        let leaderboardOnly = kind == "leaderboard"
        let ctx = ShareSheetContext(surface: leaderboardOnly ? .leaderboard : .finished, mode: leaderboardOnly ? "" : "regions", play: nil,
                                    cards: leaderboardOnly ? [.leaderboard] : [.result, .leaderboard], hasSpoilerVariant: !leaderboardOnly,
                                    season: season, caption: nil)
        let source = ShareSheetSource(context: ctx, gameLabel: "Starsweep", logMode: "REGIONS", logSurface: "demo") { variant, look in
            ShareCapture.withLook(look) {
                var out: [UIImage] = []
                if !leaderboardOnly, let card = starsweep(reveal: variant == .full), let img = ShareService.renderCard(card, size: card.size) { out.append(img) }
                let lb = leaderboardCard()
                if let img = ShareService.renderCard(lb, size: lb.size) { out.append(img) }
                return out
            }
        }
        ShareSheetPresenter.present(source)
    }

    @MainActor
    private static func starsweep(reveal: Bool) -> ShareCardView? {
        guard let p = generateRegions("demo-starsweep", n: 8) else { return nil }
        let sol = Array(p.solution)
        var board = ""
        for r in 0..<8 { for c in 0..<8 { board += (String(c) == String(sol[r])) ? "*" : "0" } }
        var card = ShareCardView(kind: .regions(n: 8, regions: p.regions, board: board, hintMask: String(repeating: "0", count: 64),
                                                mistakes: 0, sizeLabel: "8 × 8", puzzleNumber: 24),
                                 modeLabel: "STARSWEEP", accent: Color(hex: 0x7C3AED), won: true, guesses: 1, maxGuesses: 4,
                                 timeSeconds: 56, dateStr: "Oct 16", reveal: reveal, letters: nil, mode: .regions, points: 2319)
        card.puzzleNumber = 24
        card.hintsUsed = 0
        card.boardNatural = ShareService.naturalSize(card.boardBody)
        return card
    }

    @MainActor
    private static func leaderboardCard() -> LeaderboardShareCardView {
        func r(_ rank: Int, _ name: String, _ score: String, _ sub: String, you: Bool = false) -> LbShareRow {
            LbShareRow(rank: rank, name: name, scoreDisplay: score, subline: sub, isYou: you, userId: "demo-\(name)", username: name)
        }
        let input = LbShareInput(variant: .solo, shareMode: "Starsweep", gameModeRaw: GameMode.regions.rawValue,
                                 modeAccent: Color(hex: 0x7C3AED), modeChip: "Starsweep", dateChip: "Oct 16, 2026 · #193 · as of 9:53 AM",
                                 rows: [r(1, "MJT", "2,320", "0 mistakes · 0:55 · Win"), r(2, "BMT", "2,319", "0 mistakes · 0:56 · Win", you: true)],
                                 you: nil, youRankLine: nil, delta: nil, footer: "", day: "2026-10-16")
        return LeaderboardShareCardView(input: input)
    }
}
#endif
