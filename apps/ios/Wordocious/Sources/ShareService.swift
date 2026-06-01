import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// Renders the ShareCardView to a PNG and presents the native share sheet,
/// mirroring the web shareResult flow (image + wordocious.com caption).
enum ShareService {
    @MainActor
    static func share(
        kind: ShareCardView.Kind, modeLabel: String, accent: Color, won: Bool,
        guesses: Int, maxGuesses: Int, timeSeconds: Int
    ) {
        #if canImport(UIKit)
        let card = ShareCardView(
            kind: kind, modeLabel: modeLabel, accent: accent, won: won, guesses: guesses,
            maxGuesses: maxGuesses, timeSeconds: timeSeconds, dateStr: shortDate()
        )
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        guard let image = renderer.uiImage else { return }

        let url = URL(string: "https://wordocious.com")!
        let av = UIActivityViewController(activityItems: [image, url], applicationActivities: nil)

        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let root = scene.keyWindow?.rootViewController else { return }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        av.popoverPresentationController?.sourceView = top.view
        av.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
        top.present(av, animated: true)
        #endif
    }

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
