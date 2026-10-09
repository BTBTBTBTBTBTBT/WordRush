import Foundation

/// Rich push payload (FRIDAY-QUEUE item 34), the iOS reader of what apps/web/lib/push/rich.ts sends under the
/// `rich` key of the APNs payload. Pure Foundation: compiled into the Notification Service Extension and the
/// Notification Content Extension as well as the app (project.yml), and unit-tested in WordociousCoreTests.
public struct PushRich: Equatable, Sendable {
    public let senderId: String
    public let senderName: String
    /// Absolute https PNG: the sender's mascot (or photo).
    public let senderAvatar: URL?
    /// The recipient's own avatar PNG (the card's "you"); nil on older servers.
    public let youAvatar: URL?
    public let gameId: String
    public let gameTitle: String
    /// Absolute https PNG: the game's art (the attachment thumbnail).
    public let gameImage: URL?
    public let thread: String
    /// "#rrggbb" accent: the game's color, Halloween orange in season.
    public let accent: String
    public let halloween: Bool
    public let score: String?
    public let url: String

    /// The notification category the content extension registers for (server: APNS_RICH_CATEGORY).
    public static let category = "WORDOCIOUS_GAME"
    /// Attachment identifiers the service extension sets and the content extension reads.
    public static let attachmentSender = "sender"
    public static let attachmentGame = "game"
    public static let actionPlay = "WORDOCIOUS_PLAY"
    public static let actionLater = "WORDOCIOUS_LATER"

    /// Reads `userInfo["rich"]`; nil when the push is not a rich one (or the dictionary is malformed).
    public static func parse(userInfo: [AnyHashable: Any]) -> PushRich? {
        guard let d = userInfo["rich"] as? [String: Any] else { return nil }
        func s(_ k: String) -> String { (d[k] as? String)?.trimmingCharacters(in: .whitespaces) ?? "" }
        let name = s("senderName")
        guard !name.isEmpty else { return nil }
        func u(_ k: String) -> URL? {
            guard let url = URL(string: s(k)), url.scheme == "https", url.host != nil else { return nil }
            return url
        }
        return PushRich(
            senderId: s("senderId"), senderName: name, senderAvatar: u("senderAvatar"), youAvatar: u("youAvatar"),
            gameId: s("gameId"), gameTitle: s("gameTitle"), gameImage: u("gameImage"),
            thread: s("thread"), accent: s("accent").isEmpty ? "#7c3aed" : s("accent"),
            halloween: s("halloween") == "1", score: s("score").isEmpty ? nil : s("score"),
            url: s("url"))
    }
}
