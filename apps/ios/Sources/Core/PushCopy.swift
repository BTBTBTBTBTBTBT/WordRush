import Foundation

/// FINISH_SPEC §AE: push + reminder copy in the fun cast voice. 1:1 port of
/// packages/core/src/push-copy.ts (pinned by push-copy-fixtures.json) so the native
/// local reminders read exactly like the server pushes. Short, American spelling,
/// no em dashes.
public enum PushCopy {
    public enum Kind: String, CaseIterable, Codable {
        case friendBeat, yourTurn, streakReminder, shieldUsed, challengeReceived, friendRequest, giftReceived, dailyReady
    }

    /// Each push's body template. {name} = the sender, {game} = the game, {days} = streak days.
    public static let bank: [Kind: String] = [
        .friendBeat: "{name} just beat your {game} time ⚡ Your move!",
        .yourTurn: "{name} played. Your turn! 🎯",
        .streakReminder: "Your 🔥 {days}-day streak misses you! One quick game?",
        .shieldUsed: "A shield saved your streak 🛡️ Phew!",
        .challengeReceived: "{name} challenged you to {game} ⚔️",
        .friendRequest: "{name} wants to be friends! 🎉",
        .giftReceived: "{name} gifted you a week of Pro 🎁",
        .dailyReady: "Today's puzzles are fresh 🌅",
    ]

    /// The push's title line (the app name, so the body carries the voice).
    public static let title = "Wordocious"

    /// The body: the template filled ("A friend" / "Wordocious" when blank, days default 0).
    public static func body(_ kind: Kind, name: String? = nil, game: String? = nil, days: Int? = nil) -> String {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let g = (game ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return (bank[kind] ?? "")
            .replacingOccurrences(of: "{name}", with: n.isEmpty ? "A friend" : n)
            .replacingOccurrences(of: "{game}", with: g.isEmpty ? "Wordocious" : g)
            .replacingOccurrences(of: "{days}", with: "\(days ?? 0)")
    }
}
