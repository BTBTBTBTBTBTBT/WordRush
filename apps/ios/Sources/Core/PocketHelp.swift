import Foundation

// Pocket-game How to Play + first-play welcome (FRIDAY-QUEUE items 9c + 12, 2.8 wave 3).
// Swift port of packages/core/src/pocket-help.ts, pinned to it by
// pocket-help-fixtures.json (PocketHelpFixtureTests).
//
// Every pocket game gets the same "?" and How to Play card the other games have:
// three short steps (each with a tiny picture built from the shipped art-pocket-*
// pieces), the win rule, and how turns work with a friend. The first time a
// player opens ANY game the same card opens by itself once, with "Let's play!"
// instead of "Got it"; "seen" is kept per player (profiles.tutorials_seen,
// synced, plus a local copy for guests).

/// One picture on a help step: art names (art-pocket-*), shown left to right.
public struct PocketHelpPicture: Codable, Equatable {
    public let art: [String]
    /// A short caption between pieces ("beats"); empty when there is none.
    public let joiners: [String]
}

public struct PocketHelpStep: Codable, Equatable {
    public let text: String
    public let picture: PocketHelpPicture
}

public struct PocketHelpCard: Codable, Equatable {
    public let kind: FriendlyKind
    /// The tutorial key, "pocket-rps".
    public let key: String
    public let title: String
    public let steps: [PocketHelpStep]
    /// How the game is won, one line.
    public let win: String
    /// How turns work with a friend (the same promise on every game).
    public let turns: String
}

public enum PocketHelp {
    /// Off-switch (feature-switches.ts): fail-open.
    public static let firstPlayFlag = "first_play_tutorials"
    /// The synced column on profiles (20261010000001_tutorials_seen.sql).
    public static let tutorialsSeenColumn = "tutorials_seen"

    public static let turnsLine = "Take your turn any time. Your friend gets a ping, and the game waits for you both for 3 days."

    /// The first-play card's button, and the reopened card's button.
    public static let buttonFirst = "Let's play!"
    public static let buttonAgain = "Got it"

    private static func p(_ art: [String], _ joiners: [String] = []) -> PocketHelpPicture {
        PocketHelpPicture(art: art, joiners: joiners)
    }
    private static func s(_ text: String, _ picture: PocketHelpPicture) -> PocketHelpStep {
        PocketHelpStep(text: text, picture: picture)
    }

    /// POCKET_HELP, keyed by kind.
    public static let help: [FriendlyKind: PocketHelpCard] = [
        .rps: PocketHelpCard(
            kind: .rps, key: "pocket-rps", title: "Rock Paper Scissors",
            steps: [
                s("Pick rock, paper or scissors. Your pick stays hidden.", p(["art-pocket-rps-rock", "art-pocket-rps-paper", "art-pocket-rps-scissors"])),
                s("When you both have picked, the hands flip over together.", p(["art-pocket-rps-rock", "art-pocket-clash-burst", "art-pocket-rps-scissors"])),
                s("Rock beats scissors, scissors beat paper, paper beats rock.", p(["art-pocket-rps-rock", "art-pocket-rps-scissors"], ["beats"])),
            ],
            win: "First to win 2 rounds takes the match.",
            turns: turnsLine),
        .ttt: PocketHelpCard(
            kind: .ttt, key: "pocket-ttt", title: "Tic-Tac-Tile",
            steps: [
                s("Take turns placing your tile on the 3 by 3 board. You are the purple X.", p(["art-pocket-ttt-x", "art-pocket-ttt-o"])),
                s("Three of your tiles in a row, across, down or corner to corner, wins the game.", p(["art-pocket-ttt-x", "art-pocket-ttt-x", "art-pocket-ttt-x"])),
                s("Fill the board with no line and the game is a draw.", p(["art-pocket-ttt-board"])),
            ],
            win: "Win 2 games, out of at most 5, to take the match.",
            turns: turnsLine),
        .coin: PocketHelpCard(
            kind: .coin, key: "pocket-coin", title: "Call It",
            steps: [
                s("Call heads or tails before the flip.", p(["art-pocket-coin-heads-w", "art-pocket-coin-tails-crest"])),
                s("The coin flips. Call it right and the round is yours.", p(["art-pocket-coin-heads-w", "art-pocket-coin-tilt", "art-pocket-coin-tails-crest"])),
                s("You swap who calls each round. Heads is the W, tails is the crest.", p(["art-pocket-coin-sparkle-ring"])),
            ],
            win: "First to win 3 flips takes the match, and the stake you picked.",
            turns: turnsLine),
        .pass: PocketHelpCard(
            kind: .pass, key: "pocket-pass", title: "Pass the Puzzle",
            steps: [
                s("You and your friend share one hidden word and one board.", p(Array(repeating: "art-pocket-tile-white", count: 5))),
                s("Take turns guessing. Purple is the right spot, gold is the wrong spot.", p(["art-pocket-tile-purple", "art-pocket-tile-gold", "art-pocket-tile-white"])),
                s("Use what the last guess showed. There are 6 guesses in all.", p(["art-pocket-puzzle-piece"])),
            ],
            win: "Whoever finds the word wins. Nobody finds it in 6, it is a draw.",
            turns: turnsLine),
        .ghost: PocketHelpCard(
            kind: .ghost, key: "pocket-ghost", title: "Ghost",
            steps: [
                s("Take turns adding one letter to a growing word fragment.", p(["art-pocket-tile-purple", "art-pocket-tile-gold", "art-pocket-tile-purple"])),
                s("Every fragment must still be able to become a real word.", p(["art-pocket-tile-white", "art-pocket-tile-white", "art-pocket-tile-white"])),
                s("Finish a real word, or play a dead end, and you lose the round.", p(["art-pocket-ghost-marker"])),
            ],
            win: "Win 2 rounds, out of at most 5, to take the match.",
            turns: turnsLine),
        .chain: PocketHelpCard(
            kind: .chain, key: "pocket-chain", title: "Word Chain",
            steps: [
                s("Play a word that starts with the last letter of the word before it.", p(["art-pocket-tile-purple", "art-pocket-chain-connector", "art-pocket-tile-gold"])),
                s("Longer words score more points. No word can be played twice.", p(["art-pocket-chain-links"])),
                s("Build the chain back and forth with your friend.", p(["art-pocket-tile-purple", "art-pocket-tile-gold", "art-pocket-tile-purple"])),
            ],
            win: "First to 30 points wins.",
            turns: turnsLine),
    ]

    /// The tutorial key for a pocket kind ("pocket-rps"); main games use their mode id ("practice", "hub").
    public static func tutorialKey(_ kind: FriendlyKind) -> String { "pocket-\(kind.rawValue)" }

    /// Whether the welcome card opens by itself: the switch is live and this game's
    /// key is not in the player's seen list. `seen` is nil while it is still loading
    /// (never show on a guess: wait).
    public static func shouldAutoShowTutorial(live: Bool, seen: [String]?, key: String) -> Bool {
        guard live, let seen = seen else { return false }
        return !seen.contains(key)
    }

    /// The seen list after the card closes: the key added once, kept sorted (stable for sync).
    public static func withTutorialSeen(_ seen: [String], key: String) -> [String] {
        seen.contains(key) ? seen : (seen + [key]).sorted()
    }

    /// Two devices both added keys: the union, sorted.
    public static func mergeTutorialsSeen(_ a: [String], _ b: [String]) -> [String] {
        Array(Set(a).union(b)).sorted()
    }
}
