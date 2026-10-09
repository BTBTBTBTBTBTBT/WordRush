import Foundation

// FRIDAY-QUEUE item 41: the one-time "What's new in 2.8" tour — a 1:1 port of packages/core/src/whats-new.ts
// (pages + the show / record / wait / none decision). Brand-new players never see it.

public enum WhatsNew {
    public static let key = "whats-new-28"
    public static let flag = "whats_new_28"
    /// Accounts created on or after this local date are 2.8-era players: no tour. Set to the 2.8 go-live date.
    public static let cutoff = "2026-10-15"

    public enum Art: Equatable {
        case art(String)
        case mascot
        case icons([String])
    }

    public struct Page: Equatable, Identifiable {
        public let id: String
        public let title: String
        public let lines: [String]
        public let art: Art
        public let platforms: [String]
    }

    private static let all = ["web", "ios", "android"]
    private static let apps = ["ios", "android"]

    public static let pages: [Page] = [
        Page(id: "season", title: "HALLOWEEN IS HERE",
             lines: ["The whole cast is in costume, with spooky screens and tunes.", "Pick a seasonal theme in Settings, or switch it off any time."],
             art: .art("art-halloween-prop-pumpkin"), platforms: all),
        Page(id: "alive", title: "YOUR MASCOT IS ALIVE",
             lines: ["Your mascot breathes, blinks and reacts as you play.", "Tap it to say hi."],
             art: .mascot, platforms: all),
        Page(id: "order", title: "PUT GAMES IN YOUR ORDER",
             lines: ["Tap the pencil by Dailies or Puzzles, or press and hold a game, then drag it.", "Classic always stays first."],
             art: .icons(["game-practice", "game-quordle", "game-octordle"]), platforms: all),
        Page(id: "invites", title: "INVITES AND POCKET GAMES",
             lines: ["One link per invite, straight to the right screen.", "Pocket games play live now: watch your friend move as it happens."],
             art: .icons(["game-pocket-rps", "game-pocket-ttt", "game-pocket-coin"]), platforms: all),
        Page(id: "widgets", title: "NEW WIDGETS",
             lines: ["Widgets with your mascot show today\u{2019}s games, your streak and a live countdown.", "Add one from your home screen."],
             art: .icons(["game-sweep"]), platforms: apps),
        Page(id: "packs", title: "MASCOT PACKS",
             lines: ["New bodies, costumes and parts in the Dressing Room.", "Make your mascot truly yours."],
             art: .art("art-pose-o1-cheer"), platforms: all),
    ]

    public static func pages(for platform: String) -> [Page] { pages.filter { $0.platforms.contains(platform) } }

    public enum Decision: Equatable { case show, record, wait, none }

    /// show: open the tour. record: a brand-new player, write the key quietly. wait: not decidable yet. none: nothing to do.
    public static func decision(live: Bool, seen: [String]?, signedIn: Bool, hasOnboarded: Bool?, createdAt: String?,
                                cutoff: String = WhatsNew.cutoff) -> Decision {
        if !live || !signedIn { return .none }
        guard let seen, let hasOnboarded else { return .wait }
        if seen.contains(key) { return .none }
        let created = String((createdAt ?? "").prefix(10))
        let brandNew = !hasOnboarded || (!created.isEmpty && created >= cutoff)
        return brandNew ? .record : .show
    }
}
