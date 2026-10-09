import UserNotifications
import Intents

/// Notification Service Extension (FRIDAY-QUEUE item 34). Turns a rich push into a COMMUNICATION notification:
/// the SENDER's mascot is the avatar (iOS draws the app icon as the badge on it), the title reads complete
/// ("Ava played Hubbub"), and the game's art rides along as the thumbnail attachment. The server sends
/// `mutable-content: 1` + `rich` only when the `rich_push` off-switch is on; a plain push passes through
/// untouched. Anything that fails (offline, slow, no entitlement) still delivers the original alert.
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

            if let artData, let attachment = Self.attachment(artData, id: "game-\(rich.gameId)") {
                best.attachments = [attachment]
            }
            deliver(Self.communication(best, rich: rich, avatar: avatarData))
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // The system is about to give up: ship what we have (the original alert at worst).
        if let best { deliver(best) }
    }

    // MARK: - Pieces

    /// A Communication Notification: the intent's sender (our title as the display name, the mascot as the
    /// image) replaces the system's generic header. Needs the `communication` entitlement; without it
    /// `updating(from:)` throws and the plain alert is delivered.
    private static func communication(_ content: UNMutableNotificationContent, rich: PushRich, avatar: Data?) -> UNNotificationContent {
        let image = avatar.map { INImage(imageData: $0) }
        let handle = INPersonHandle(value: rich.senderId.isEmpty ? rich.senderName : rich.senderId, type: .unknown)
        // The display name is the server's title ("Ava played Hubbub", <= 28 chars): it reads complete in the header.
        let sender = INPerson(personHandle: handle, nameComponents: nil,
                              displayName: content.title.isEmpty ? rich.senderName : content.title,
                              image: image, contactIdentifier: nil, customIdentifier: rich.senderId)
        let intent = INSendMessageIntent(recipients: nil, outgoingMessageType: .outgoingMessageText,
                                         content: content.body, speakableGroupName: nil,
                                         conversationIdentifier: rich.thread, serviceName: nil,
                                         sender: sender, attachments: nil)
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)
        guard let updated = try? content.updating(from: intent) else { return content }
        return updated
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
