import UIKit
import SwiftUI
import UserNotifications
import UserNotificationsUI

/// Notification Content Extension (FRIDAY-QUEUE item 34): the long-press card. Game art + BOTH mascots (the
/// sender and you, both from the push itself, no app group) + the score, in the glossy frame art (Halloween frame in season), with the system's
/// Play / Later actions under it (registered by the app: PushActions.register). Everything fails soft:
/// no network = the attachment already on the notification, no mascot = W.
final class NotificationViewController: UIViewController, UNNotificationContentExtension {
    private let model = PushCardModel()
    private var host: UIHostingController<PushCard>?

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: PushCard(model: model))
        host.view.backgroundColor = .clear
        addChild(host)
        view.addSubview(host.view)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        host.didMove(toParent: self)
        self.host = host
    }

    func didReceive(_ notification: UNNotification) {
        let content = notification.request.content
        guard let rich = PushRich.parse(userInfo: content.userInfo) else {
            model.title = content.title; model.detail = content.body
            return
        }
        model.title = content.title
        model.detail = content.body
        model.score = rich.score
        model.gameTitle = rich.gameTitle
        model.accent = Color(pushHex: rich.accent)
        model.halloween = rich.halloween
        // The pictures the service extension already downloaded (no app group needed), else fetch them.
        for att in content.attachments {
            guard att.url.startAccessingSecurityScopedResource() else { continue }
            let img = UIImage(contentsOfFile: att.url.path)
            att.url.stopAccessingSecurityScopedResource()
            if att.identifier == PushRich.attachmentSender { model.sender = img }
            else if att.identifier == PushRich.attachmentGame { model.gameArt = img }
        }
        // The player's own look, pre-rendered by the app into the shared container (WidgetAvatarSnapshot); the
        // payload's youAvatar is the fallback when the group is unavailable (or the player has no look saved yet).
        model.you = Self.ownMascot()
        Task {
            async let sender: UIImage? = model.sender == nil ? Self.fetch(rich.senderAvatar) : nil
            async let art: UIImage? = model.gameArt == nil ? Self.fetch(rich.gameImage) : nil
            async let you: UIImage? = model.you == nil ? Self.fetch(rich.youAvatar) : nil
            let (s, a, y) = await (sender, art, you)
            await MainActor.run {
                if let s { model.sender = s }
                if let a { model.gameArt = a }
                if let y { model.you = y }
            }
        }
    }

    /// The shared container's mascot cutout / framed photo (nil when the app group is not available).
    private static func ownMascot() -> UIImage? {
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.wordocious.app") else { return nil }
        for name in ["widget-avatar-mascot.png", "widget-avatar-photo.png"] {
            if let img = UIImage(contentsOfFile: dir.appendingPathComponent(name).path) { return img }
        }
        return nil
    }

    private static func fetch(_ url: URL?) async -> UIImage? {
        guard let url else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 8
        guard let (data, _) = try? await URLSession.shared.data(for: req) else { return nil }
        return UIImage(data: data)
    }
}

final class PushCardModel: ObservableObject {
    @Published var title = ""
    @Published var detail = ""
    @Published var score: String?
    @Published var gameTitle = ""
    @Published var accent = Color(pushHex: "#7c3aed")
    @Published var halloween = false
    @Published var sender: UIImage?
    @Published var you: UIImage?
    @Published var gameArt: UIImage?
}

/// The card: frame art behind, game art on the left in its thumb frame, the two mascots with the score
/// between them, the complete title + detail underneath. No outlined boxes: the frame art is the only chrome.
struct PushCard: View {
    @ObservedObject var model: PushCardModel

    var body: some View {
        let ink = model.halloween ? Color(pushHex: "#fdba74") : Color(pushHex: "#3b1a78")
        ZStack {
            Image(model.halloween ? "push-card-frame-halloween" : "push-card-frame")
                .resizable().scaledToFill().accessibilityHidden(true)
            VStack(spacing: 8) {
                HStack(spacing: 12) {
                    ZStack {
                        Image(model.halloween ? "push-thumb-frame-halloween" : "push-thumb-frame").resizable().scaledToFit()
                        if let art = model.gameArt {
                            Image(uiImage: art).resizable().scaledToFit().padding(14)
                        }
                    }
                    .frame(width: 72, height: 72)
                    .accessibilityLabel(model.gameTitle)

                    Spacer(minLength: 0)
                    mascot(model.sender)
                    if let score = model.score {
                        Text(score)
                            .font(.system(size: 26, weight: .black, design: .rounded)).monospacedDigit()
                            .foregroundColor(model.halloween ? Color(pushHex: "#fb923c") : model.accent)
                            .lineLimit(1).minimumScaleFactor(0.6)
                    } else {
                        Text("vs").font(.system(size: 14, weight: .black, design: .rounded)).foregroundColor(ink.opacity(0.6))
                    }
                    mascot(model.you)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.title).font(.system(size: 17, weight: .black, design: .rounded)).foregroundColor(ink)
                    Text(model.detail).font(.system(size: 14, weight: .semibold, design: .rounded)).foregroundColor(ink.opacity(0.8))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 22).padding(.vertical, 18)
        }
        .aspectRatio(384.0 / 193.0 * 0.8, contentMode: .fit)
        .frame(maxWidth: .infinity)
    }

    private func mascot(_ img: UIImage?) -> some View {
        Group {
            if let img { Image(uiImage: img).resizable().scaledToFit() }
            else { Image("push-mascot-w").resizable().scaledToFit() }
        }
        .frame(width: 54, height: 54)
        .accessibilityHidden(true)
    }
}

extension Color {
    init(pushHex hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}
