import SwiftUI
import Supabase
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// Renders the ShareCardView to a PNG and presents the native share sheet.
/// FINISH_SPEC §S1 (founder 10-02): a completed game shares the IMAGE ONLY — no
/// URL, no caption — so Messages / WhatsApp show the picture with all of its
/// information instead of a link-preview card. Nothing is uploaded and no hosted
/// /s link is built for result shares any more (old links keep working on web).
enum ShareService {
    @MainActor
    static func share(
        kind: ShareCardView.Kind, mode: GameMode, modeLabel: String, accent: Color, won: Bool,
        guesses: Int, maxGuesses: Int, timeSeconds: Int,
        category: String? = nil, wordGroups: [Int]? = nil,
        reveal: Bool = false, letters: [[String]]? = nil, solutionDisplay: String? = nil,
        /// The result's points (the gold POINTS window); the puzzle number rides
        /// the card's date line via the kind.
        points: Int? = nil, puzzleNumber: Int? = nil,
        /// Kept for the call sites; §S1 shares no text.
        caption: String? = nil
    ) {
        #if canImport(UIKit)
        var card = ShareCardView(
            kind: kind, modeLabel: modeLabel, accent: accent, won: won, guesses: guesses,
            maxGuesses: maxGuesses, timeSeconds: timeSeconds, dateStr: shortDate(),
            category: category, wordGroups: wordGroups,
            reveal: reveal, letters: letters, solutionDisplay: solutionDisplay,
            mode: mode, points: points
        )
        // §S2: measure the board so the canvas fits the puzzle (no dead space).
        card.boardNatural = naturalSize(card.boardBody)
        guard let image = renderCard(card, size: card.size) else { return }
        presentImages([image], game: modeLabel)
        #endif
    }

    #if canImport(UIKit)
    @MainActor
    static func present(items: [Any]) {
        let av = UIActivityViewController(activityItems: items, applicationActivities: nil)
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let root = scene.keyWindow?.rootViewController else { return }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        av.popoverPresentationController?.sourceView = top.view
        av.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
        top.present(av, animated: true)
    }
    #endif

    private static func shortDate() -> String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        f.locale = Locale(identifier: "en_US")
        return f.string(from: Date())
    }
}

#if canImport(UIKit)
private extension UIWindowScene {
    var keyWindow: UIWindow? { windows.first(where: { $0.isKeyWindow }) ?? windows.first }
}
#endif
