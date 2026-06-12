import SwiftUI
import Supabase
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// Renders the ShareCardView to a PNG and presents the native share sheet.
/// Mirrors the web shareResult flow: the rendered image is shared directly
/// (best for Messages / WhatsApp / Mail), AND a per-result URL is included so
/// platforms that ignore attached image files — Facebook, X, LinkedIn — scrape
/// its Open Graph image (which IS this same PNG, uploaded to the shared
/// `share-images` bucket) and render the finished puzzle in the post.
enum ShareService {
    private static let bucket = "share-images"

    /// GameMode → web ShareMode name (used in the /s URL + storage path so the
    /// landing page maps the mode and the og:image resolves correctly).
    private static func shareMode(_ mode: GameMode) -> String {
        switch mode.rawValue {
        case "DUEL": return "Classic"
        case "QUORDLE": return "QuadWord"
        case "OCTORDLE": return "OctoWord"
        case "SEQUENCE": return "Succession"
        case "RESCUE": return "Deliverance"
        case "DUEL_6": return "Six"
        case "DUEL_7": return "Seven"
        case "GAUNTLET": return "Gauntlet"
        case "PROPERNOUNDLE": return "ProperNoundle"
        default: return mode.rawValue
        }
    }

    @MainActor
    static func share(
        kind: ShareCardView.Kind, mode: GameMode, modeLabel: String, accent: Color, won: Bool,
        guesses: Int, maxGuesses: Int, timeSeconds: Int,
        category: String? = nil, wordGroups: [Int]? = nil
    ) {
        #if canImport(UIKit)
        let card = ShareCardView(
            kind: kind, modeLabel: modeLabel, accent: accent, won: won, guesses: guesses,
            maxGuesses: maxGuesses, timeSeconds: timeSeconds, dateStr: shortDate(),
            category: category, wordGroups: wordGroups
        )
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        guard let image = renderer.uiImage, let png = image.pngData() else { return }

        // Upload the PNG + build the per-result URL, then present the sheet with
        // [image, url]. If the upload can't happen (not signed in / failure) we
        // fall back to image-only — the direct attachment still works for
        // Messages et al., we just lose the social-site preview.
        Task {
            let url = await uploadAndBuildURL(png: png, kind: kind, mode: mode,
                                              won: won, guesses: guesses, maxGuesses: maxGuesses,
                                              timeSeconds: timeSeconds)
            await MainActor.run {
                var items: [Any] = [image]
                if let url { items.append(url) }
                present(items: items)
            }
        }
        #endif
    }

    /// Upload the PNG to `share-images/<uid>/<ShareMode>-<date>.png` and return
    /// the matching https://wordocious.com/s/<uid>/<ShareMode>-<date> URL with
    /// the result stats in its query (consumed by app/s/[...key]).
    private static func uploadAndBuildURL(
        png: Data, kind: ShareCardView.Kind, mode: GameMode,
        won: Bool, guesses: Int, maxGuesses: Int, timeSeconds: Int
    ) async -> URL? {
        let client = AuthService.shared.client
        // RLS keys the folder on auth.uid()::text, which is lowercase.
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased() else { return nil }

        let sm = shareMode(mode)
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        let dateStr = f.string(from: Date())
        let key = "\(uid)/\(sm)-\(dateStr)"
        let path = "\(key).png"

        do {
            try await client.storage.from(bucket).upload(
                path, data: png,
                options: FileOptions(contentType: "image/png", upsert: true))
        } catch {
            return nil
        }

        let isVertical = mode == .octordle || mode == .gauntlet
        var q: [String: String] = [
            "m": sm, "won": won ? "1" : "0",
            "g": "\(guesses)", "mg": "\(maxGuesses)", "t": "\(timeSeconds)",
            "w": "1080", "h": isVertical ? "1350" : "1080",
            "v": "\(won ? "w" : "x")\(guesses)-\(timeSeconds)",
        ]
        switch kind {
        case let .multi(_, boardsSolved, totalBoards):
            q["bs"] = "\(boardsSolved)"; q["tb"] = "\(totalBoards)"
        case let .gauntlet(_, stagesCompleted, totalStages):
            q["sc"] = "\(stagesCompleted)"; q["ts"] = "\(totalStages)"
        case .single:
            break
        }

        var comps = URLComponents(string: "https://wordocious.com/s/\(key)")
        comps?.queryItems = q.map { URLQueryItem(name: $0.key, value: $0.value) }
        return comps?.url
    }

    #if canImport(UIKit)
    @MainActor
    private static func present(items: [Any]) {
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
