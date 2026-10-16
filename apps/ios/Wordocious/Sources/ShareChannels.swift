import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
import MessageUI
import Photos

// The CHANNELS row's mechanics on iOS (docs/review/share-sheet-plan.md §2). The model (core ShareSheet.swift) says what each
// channel carries; this says how iOS delivers it:
//
//   Copy link   UIPasteboard (the sheet shows the "Copied" toast)
//   Messages    MFMessageComposeViewController with the card PNG attached; the system sheet where the device can't send texts
//   WhatsApp    UIDocumentInteractionController with uti net.whatsapp.image on a `.wai` file (community-documented, WhatsApp
//               publishes no iOS API for images); the system sheet when WhatsApp isn't installed or won't take it
//   X, Facebook the system share sheet with the image (X's iOS intents are text only; both apps list their share extension there)
//   Save image  add-only Photos (NSPhotoLibraryAddUsageDescription), keeps the PNG
//   More        UIActivityViewController
//
// §S1 stays: a result share to a messaging app is the image alone (no link, no caption), so the system sheet items carry the
// image only unless the model's channel text exists (profile / moment surfaces).

@MainActor
final class ShareChannels: NSObject, MFMessageComposeViewControllerDelegate, UIDocumentInteractionControllerDelegate {
    static let shared = ShareChannels()

    private var docController: UIDocumentInteractionController?

    // MARK: Presenting

    static func topController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
                ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              var top = (scene.windows.first(where: \.isKeyWindow) ?? scene.windows.first)?.rootViewController else { return nil }
        while let next = top.presentedViewController, !next.isBeingDismissed { top = next }
        return top
    }

    // MARK: Analytics

    /// One `share_events` row per tile tap (the channel isn't a column yet: image channels log 'image', the rest 'other').
    static func logTap(_ ch: ShareSheetChannel, source: ShareSheetSource) {
        let kind = ch.payload == .link ? "other" : "image"
        ShareEvents.log(kind: kind, gameMode: source.logMode, surface: source.logSurface)
    }

    // MARK: Files

    private nonisolated static func fileName(_ game: String, ext: String) -> String {
        let slug = game.components(separatedBy: CharacterSet.alphanumerics.inverted).joined()
        return "Wordocious-\(slug.isEmpty ? "Share" : slug).\(ext)"
    }

    /// Encode off the main thread, then hand the file URL back on it.
    private static func writeTemp(_ image: UIImage, game: String, ext: String, jpeg: Bool, _ done: @escaping @MainActor (URL?) -> Void) {
        Task.detached(priority: .userInitiated) {
            let data = jpeg ? image.jpegData(compressionQuality: 0.92) : image.pngData()
            var url: URL?
            if let data {
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent("share-sheet", isDirectory: true)
                try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                let u = dir.appendingPathComponent(fileName(game, ext: ext))
                if (try? data.write(to: u, options: .atomic)) != nil { url = u }
            }
            await MainActor.run { done(url) }
        }
    }

    // MARK: More / X / Facebook

    static func systemSheet(_ image: UIImage, text: String?, game: String) {
        var items: [Any] = [ShareImageItem(image: image, game: game)]
        if let text, !text.isEmpty { items.append(text) }
        ShareService.present(items: items)
    }

    // MARK: Messages

    static func messages(_ image: UIImage, text: String?, game: String) {
        guard MFMessageComposeViewController.canSendText(), MFMessageComposeViewController.canSendAttachments(),
              let top = topController() else {
            systemSheet(image, text: text, game: game)    // a simulator / an iPad with no Messages
            return
        }
        Task.detached(priority: .userInitiated) {
            let data = image.pngData()
            await MainActor.run {
                guard let data else { systemSheet(image, text: text, game: game); return }
                let vc = MFMessageComposeViewController()
                vc.messageComposeDelegate = ShareChannels.shared
                if let text, !text.isEmpty { vc.body = text }
                vc.addAttachmentData(data, typeIdentifier: "public.png", filename: fileName(game, ext: "png"))
                top.present(vc, animated: true)
            }
        }
    }

    nonisolated func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        Task { @MainActor in controller.dismiss(animated: true) }
    }

    // MARK: WhatsApp

    static func whatsApp(_ image: UIImage, game: String) {
        guard let url = URL(string: "whatsapp://app"), UIApplication.shared.canOpenURL(url), let top = topController() else {
            systemSheet(image, text: nil, game: game)    // not installed
            return
        }
        writeTemp(image, game: game, ext: "wai", jpeg: true) { file in
            guard let file else { systemSheet(image, text: nil, game: game); return }
            let doc = UIDocumentInteractionController(url: file)
            doc.uti = "net.whatsapp.image"
            doc.delegate = ShareChannels.shared
            ShareChannels.shared.docController = doc
            let rect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.maxY - 40, width: 1, height: 1)
            if !doc.presentOpenInMenu(from: rect, in: top.view, animated: true) {
                ShareChannels.shared.docController = nil
                systemSheet(image, text: nil, game: game)
            }
        }
    }

    nonisolated func documentInteractionControllerDidDismissOpenInMenu(_ controller: UIDocumentInteractionController) {
        Task { @MainActor in if ShareChannels.shared.docController === controller { ShareChannels.shared.docController = nil } }
    }

    // MARK: Save image

    static func saveToPhotos(_ image: UIImage, game: String, toast: @escaping @MainActor (String) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                Task { @MainActor in toast("Allow Photos in Settings to save") }
                return
            }
            Task.detached(priority: .userInitiated) {
                guard let data = image.pngData() else { return }
                PHPhotoLibrary.shared().performChanges({
                    let req = PHAssetCreationRequest.forAsset()
                    req.addResource(with: .photo, data: data, options: nil)
                }, completionHandler: { ok, _ in
                    Task { @MainActor in toast(ok ? "Saved to Photos" : "Couldn't save") }
                })
            }
        }
    }
}
#endif
