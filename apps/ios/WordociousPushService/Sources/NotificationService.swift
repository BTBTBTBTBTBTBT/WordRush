import UserNotifications

/// Notification Service Extension (FRIDAY-QUEUE item 34). Gives a rich push its pictures without needing the
/// Communication Notifications entitlement: the SENDER's mascot is the thumbnail attachment (the game's art
/// when the sender has no avatar), the game art rides along as a second attachment for the long-press card,
/// and the server's complete title and body are delivered untouched. The server sends `mutable-content: 1` +
/// `rich` only when the `rich_push` off-switch is on; a plain push passes through. Anything that fails
/// (offline, slow) still delivers the original alert.
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

            // The first attachment is the collapsed thumbnail: the sender's mascot, else the game art.
            // Both reach the content extension, which reads them by identifier.
            var attachments: [UNNotificationAttachment] = []
            if let avatarData, let a = Self.attachment(avatarData, id: PushRich.attachmentSender) { attachments.append(a) }
            if let artData, let a = Self.attachment(artData, id: PushRich.attachmentGame) { attachments.append(a) }
            if !attachments.isEmpty { best.attachments = attachments }
            deliver(best)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // The system is about to give up: ship what we have (the original alert at worst).
        if let best { deliver(best) }
    }

    // MARK: - Pieces

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
