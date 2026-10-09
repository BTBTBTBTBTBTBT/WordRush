import UserNotifications
import Intents

/// Notification Service Extension (FRIDAY-QUEUE item 34). A rich push becomes a COMMUNICATION notification: the
/// SENDER's mascot is the avatar (iOS draws the app icon as the badge on it) and the server's complete title is the
/// header, via an INSendMessageIntent (needs the Communication Notifications capability on the app + this
/// extension's profile). The game art rides along as an attachment for the long-press card. Any failure along the way
/// (no capability, no avatar, offline, slow) falls back to the attachments: the sender's mascot as the thumbnail, the
/// game art second, the original title and body untouched. The server sends `mutable-content: 1` + `rich` only when
/// the `rich_push` off-switch is on; a plain push passes through.
final class NotificationService: UNNotificationServiceExtension {
    private var handler: ((UNNotificationContent) -> Void)?
    private var best: UNMutableNotificationContent?
    private var delivered = false

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        handler = contentHandler
        best = request.content.mutableCopy() as? UNMutableNotificationContent
        guard let best, let rich = PushRich.parse(userInfo: request.content.userInfo) else {
            deliver(best ?? request.content)
            return
        }
        best.categoryIdentifier = PushRich.category
        best.threadIdentifier = rich.thread

        Task {
            async let avatar = Self.download(rich.senderAvatar)
            async let art = Self.download(rich.gameImage)
            let (avatarData, artData) = await (avatar, art)

            let sender = avatarData.flatMap { Self.attachment($0, id: PushRich.attachmentSender) }
            let game = artData.flatMap { Self.attachment($0, id: PushRich.attachmentGame) }

            // Communication Notification first (the sender's mascot as the avatar). `updating(from:)` throws without
            // the capability: then we are on the attachment fallback below.
            if let avatarData, let comm = Self.communication(best, rich: rich, avatar: avatarData),
               let final = comm.mutableCopy() as? UNMutableNotificationContent {
                // The avatar is already the notification's picture: the game art leads as the thumbnail, the sender's
                // mascot stays attached for the long-press card.
                final.attachments = [game, sender].compactMap { $0 }
                deliver(final)
                return
            }
            // Fallback: the sender's mascot is the thumbnail (the game art when there is no avatar), the game art second.
            best.attachments = [sender, game].compactMap { $0 }
            deliver(best)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // The system is about to give up: ship what we have (the original alert at worst).
        if let best { deliver(best) }
    }

    // MARK: - Pieces

    /// The Communication Notification content, or nil when the system refuses (capability missing).
    private static func communication(_ content: UNMutableNotificationContent, rich: PushRich, avatar: Data) -> UNNotificationContent? {
        let handle = INPersonHandle(value: rich.senderId.isEmpty ? rich.senderName : rich.senderId, type: .unknown)
        // The display name is the server's title ("Ava played Hubbub", <= 28 chars): it reads complete in the header.
        let sender = INPerson(personHandle: handle, nameComponents: nil,
                              displayName: content.title.isEmpty ? rich.senderName : content.title,
                              image: INImage(imageData: avatar), contactIdentifier: nil, customIdentifier: rich.senderId)
        let intent = INSendMessageIntent(recipients: nil, outgoingMessageType: .outgoingMessageText,
                                         content: content.body, speakableGroupName: nil,
                                         conversationIdentifier: rich.thread, serviceName: nil,
                                         sender: sender, attachments: nil)
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)
        return try? content.updating(from: intent)
    }

    private static func attachment(_ data: Data, id: String) -> UNNotificationAttachment? {
        let dir = FileManager.default.temporaryDirectory
        let file = dir.appendingPathComponent("\(id)-\(UUID().uuidString).png")
        guard (try? data.write(to: file)) != nil else { return nil }
        return try? UNNotificationAttachment(identifier: id, url: file, options: nil)
    }

    /// 12-second cap per image: the extension has ~30 s in total and a missing image is never worth a missing push.
    private static func download(_ url: URL?) async -> Data? {
        guard let url else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 12
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200, !data.isEmpty else { return nil }
        return data
    }

    private func deliver(_ content: UNNotificationContent) {
        guard !delivered else { return }
        delivered = true
        handler?(content)
    }
}
