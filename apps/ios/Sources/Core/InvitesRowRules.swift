import Foundation

/// The Invites row's data rules (FRIDAY-QUEUE 9f), mirrored from apps/web/lib/invites-row.ts
/// (pinned by InvitesRowRulesTests): merge pending live VS invites and incoming race-my-run
/// challenges into one newest-first list, minus the ones the player declined on this device.
public struct InviteRowItem: Identifiable, Equatable {
    public enum Variant: String, Equatable { case live, race }
    public let variant: Variant
    public let code: String
    /// GameMode raw value (e.g. "DUEL").
    public let gameMode: String
    public let sender: String
    public let senderId: String
    public let raceLine: String?
    /// match_invites.id (live only), for the decline write.
    public let inviteId: String?
    public let createdAt: Date
    public var id: String { "\(variant.rawValue):\(code)" }

    public init(variant: Variant, code: String, gameMode: String, sender: String, senderId: String,
                raceLine: String? = nil, inviteId: String? = nil, createdAt: Date) {
        self.variant = variant; self.code = code; self.gameMode = gameMode; self.sender = sender
        self.senderId = senderId; self.raceLine = raceLine; self.inviteId = inviteId; self.createdAt = createdAt
    }
}

public enum InvitesRowRules {
    public static func build(_ items: [InviteRowItem], dismissed: [String]) -> [InviteRowItem] {
        let gone = Set(dismissed.map { $0.uppercased() })
        return items.filter { !gone.contains($0.code.uppercased()) }.sorted { $0.createdAt > $1.createdAt }
    }

    /// "solved in 4 · 1:12" or "a run to beat" (core raceLine).
    public static func raceLine(solved: Bool, guesses: Int, timeMs: Int) -> String {
        guard solved else { return "a run to beat" }
        let total = max(0, Int((Double(timeMs) / 1000).rounded()))
        return "solved in \(guesses) · \(total / 60):\(String(format: "%02d", total % 60))"
    }

    public static let dismissedKey = "wr_dismissed_invites"
}
