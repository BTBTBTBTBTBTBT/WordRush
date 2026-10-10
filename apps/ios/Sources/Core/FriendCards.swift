import Foundation

// Friends tab, one card per friend (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3).
// Swift port of packages/core/src/friend-cards.ts, pinned to it by
// friend-cards-fixtures.json (FriendCardsFixtureTests).
//
// Online friends first; one card per friend with their living mascot,
// "N games waiting on you", and a compact strip of game tiles (the game's art +
// a one-word state). "Their turn" games collapse into one quiet line. Everyone
// else lives in the "All friends" list.

/// The slice of a friend the cards need.
public struct CardFriend: Codable, Equatable {
    public var id: String
    public var username: String
    /// Heartbeat under two minutes old (isOnline).
    public var online: Bool
    /// What they are doing now ("Classic", "Muddle"), when online and known.
    public var activity: String?
    public var lastSeenMs: Double?

    public init(id: String, username: String, online: Bool, activity: String? = nil, lastSeenMs: Double? = nil) {
        self.id = id; self.username = username; self.online = online
        self.activity = activity; self.lastSeenMs = lastSeenMs
    }
}

/// The slice of an active pocket game the cards need.
public struct CardGame: Codable, Equatable {
    public var id: String
    public var kind: FriendlyKind
    public var opponentId: String
    /// Only used when the opponent is not in the friend list.
    public var opponentName: String
    public var me: FriendlySide
    public var state: FriendlyState
    public var yourTurn: Bool
    /// ISO time of the last move.
    public var updatedAt: String

    public init(id: String, kind: FriendlyKind, opponentId: String, opponentName: String,
                me: FriendlySide, state: FriendlyState, yourTurn: Bool, updatedAt: String) {
        self.id = id; self.kind = kind; self.opponentId = opponentId; self.opponentName = opponentName
        self.me = me; self.state = state; self.yourTurn = yourTurn; self.updatedAt = updatedAt
    }
}

public struct GameTile: Codable, Equatable, Identifiable {
    public var gameId: String
    public var kind: FriendlyKind
    /// One short word: "Your pick", "Your move", "1 of 6", "GHO…".
    public var word: String
    public var yourTurn: Bool
    public var id: String { gameId }

    public init(gameId: String, kind: FriendlyKind, word: String, yourTurn: Bool) {
        self.gameId = gameId; self.kind = kind; self.word = word; self.yourTurn = yourTurn
    }
}

public struct FriendCard: Codable, Equatable, Identifiable {
    public var friendId: String
    public var name: String
    public var online: Bool
    /// "playing Classic" / "on now" while online, else nil (the card shows nothing).
    public var presence: String?
    /// How many games wait on you.
    public var waiting: Int
    /// "6 games waiting on you" / "1 game waiting on you" / "" (no games waiting).
    public var headline: String
    /// Your-turn tiles, newest first.
    public var tiles: [GameTile]
    /// Their-turn games, collapsed: newest first (expanded on tap).
    public var theirTurn: [GameTile]
    /// "3 waiting on Johnny" or "" when none.
    public var theirTurnLine: String
    public var id: String { friendId }
}

public struct FriendsLayout: Codable, Equatable {
    /// Online friends and friends with active games: the cards.
    public var cards: [FriendCard]
    /// Everyone else, A to Z: the "All friends" dropdown.
    public var rest: [String]
}

public enum FriendCards {
    private static let maxFragment = 6

    /// The one-word state under a game tile.
    public static func tileWord(kind: FriendlyKind, state: FriendlyState, me: FriendlySide, yourTurn: Bool) -> String {
        switch kind {
        // Plain words under the game's name (founder 10-09; core friend-cards.ts tileWord).
        case .rps: return yourTurn ? "Pick rock, paper or scissors" : "Waiting for their pick"
        case .ttt: return yourTurn ? "Your turn to place a tile" : "Waiting for their move"
        case .coin: return yourTurn ? "Call heads or tails" : "Waiting for their call"
        case .pass:
            var used = 0
            if case .pass(let p) = state { used = p.guesses.count }
            let cap = FriendlyGames.passMaxGuesses
            return yourTurn ? "Your guess (\(min(used + 1, cap)) of \(cap))" : "Waiting for their guess"
        case .ghost:
            if !yourTurn { return "Waiting for their letter" }
            var f = ""
            if case .ghost(let g) = state { f = g.fragment.uppercased() }
            if f.isEmpty { return "Start the word: add a letter" }
            return "Add a letter to \(f.count > maxFragment ? "\(String(f.prefix(maxFragment)))…" : f)"
        case .chain:
            if !yourTurn { return "Waiting for their word" }
            if case .chain(let c) = state, let last = c.words.last?.word.last {
                return "Your word must start with \(String(last).uppercased())"
            }
            return "Start the chain with any word"
        }
    }

    /// "6 games waiting on you" / "1 game waiting on you" / "".
    public static func waitingHeadline(_ n: Int) -> String {
        if n <= 0 { return "" }
        return n == 1 ? "1 game waiting on you" : "\(n) games waiting on you"
    }

    /// The quiet collapsed line: "3 waiting on Johnny".
    public static func theirTurnLine(_ n: Int, name: String) -> String {
        n <= 0 ? "" : "\(n) waiting on \(name)"
    }

    /// "playing Classic" while they are in a game, "on now" otherwise; nil when offline.
    public static func cardPresence(online: Bool, activity: String?) -> String? {
        if !online { return nil }
        if let a = activity, !a.isEmpty { return "playing \(a)" }
        return "on now"
    }

    /// The label on the collapsed list: "All friends · 12".
    public static func allFriendsLabel(_ count: Int) -> String { "All friends · \(count)" }

    /// Whether any card has a game waiting on you.
    public static func hasYourTurn(_ layout: FriendsLayout) -> Bool {
        layout.cards.contains { $0.waiting > 0 }
    }

    private static func lowerLess(_ a: String, _ b: String) -> Bool {
        a.lowercased().compare(b.lowercased(), locale: Locale(identifier: "en")) == .orderedAscending
    }

    /// The Friends tab layout. Cards: online friends first, then friends with games
    /// waiting on you, then friends with only their-turn games. Within a group: more
    /// games waiting on you first, then the newest move, then A to Z. Friends with no
    /// active game who are offline go to `rest`.
    public static func friendsLayout(friends: [CardFriend], games: [CardGame]) -> FriendsLayout {
        var byFriend: [String: [CardGame]] = [:]
        var order: [String] = []
        for g in games {
            if byFriend[g.opponentId] == nil { order.append(g.opponentId) }
            byFriend[g.opponentId, default: []].append(g)
        }
        // A game with someone no longer in the list still deserves its card.
        let known = Set(friends.map(\.id))
        var all = friends
        for id in order where !known.contains(id) {
            all.append(CardFriend(id: id, username: byFriend[id]![0].opponentName, online: false))
        }

        struct Entry { let card: FriendCard; let newest: String; let rank: Int; let index: Int }
        var entries: [Entry] = []
        var rest: [String] = []
        for f in all {
            // Newest first; ties keep their input order (JS sort is stable).
            let mine = (byFriend[f.id] ?? []).enumerated()
                .sorted { l, r in
                    if l.element.updatedAt != r.element.updatedAt { return l.element.updatedAt > r.element.updatedAt }
                    return l.offset < r.offset
                }.map(\.element)
            if !f.online && mine.isEmpty { rest.append(f.username); continue }
            func toTile(_ g: CardGame) -> GameTile {
                GameTile(gameId: g.id, kind: g.kind,
                         word: tileWord(kind: g.kind, state: g.state, me: g.me, yourTurn: g.yourTurn),
                         yourTurn: g.yourTurn)
            }
            let tiles = mine.filter { $0.yourTurn }.map(toTile)
            let theirTurn = mine.filter { !$0.yourTurn }.map(toTile)
            let card = FriendCard(
                friendId: f.id, name: f.username, online: f.online,
                presence: cardPresence(online: f.online, activity: f.activity),
                waiting: tiles.count, headline: waitingHeadline(tiles.count),
                tiles: tiles, theirTurn: theirTurn,
                theirTurnLine: theirTurnLine(theirTurn.count, name: f.username))
            entries.append(Entry(card: card, newest: mine.first?.updatedAt ?? "",
                                 rank: f.online ? 0 : (tiles.isEmpty ? 2 : 1), index: entries.count))
        }
        entries.sort { a, b in
            if a.rank != b.rank { return a.rank < b.rank }
            if a.card.waiting != b.card.waiting { return a.card.waiting > b.card.waiting }
            if a.newest != b.newest { return a.newest > b.newest }
            if a.card.name.lowercased() != b.card.name.lowercased() { return lowerLess(a.card.name, b.card.name) }
            return a.index < b.index
        }
        let sortedRest = rest.enumerated().sorted { l, r in
            if l.element.lowercased() != r.element.lowercased() { return lowerLess(l.element, r.element) }
            return l.offset < r.offset
        }.map(\.element)
        return FriendsLayout(cards: entries.map(\.card), rest: sortedRest)
    }
}
