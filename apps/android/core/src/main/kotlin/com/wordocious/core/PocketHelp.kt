package com.wordocious.core

/**
 * Pocket-game How to Play + first-play welcome (FRIDAY-QUEUE items 9c + 12,
 * 2.8 wave 3). 1:1 port of packages/core/src/pocket-help.ts; pinned by
 * pocket-help-fixtures.json (PocketHelpFixtureTest).
 *
 * Three short steps per game (each with a tiny picture built from the shipped
 * art-pocket-* pieces), the win rule, and how turns work with a friend. The first
 * time a player opens ANY game the same card opens once; "seen" is kept per player
 * (profiles.tutorials_seen, plus a local copy for guests).
 */

/** One picture on a help step: art names (art-pocket-*), shown left to right. */
data class PocketHelpPicture(val art: List<String>, val joiners: List<String> = emptyList())

data class PocketHelpStep(val text: String, val picture: PocketHelpPicture)

data class PocketHelpCard(
    val kind: FriendlyKind,
    /** The tutorial key, "pocket-rps". */
    val key: String,
    val title: String,
    val steps: List<PocketHelpStep>,
    /** How the game is won, one line. */
    val win: String,
    /** How turns work with a friend (the same promise on every game). */
    val turns: String,
)

object PocketHelp {
    /** Off-switch (feature-switches.ts): fail-open. */
    const val FIRST_PLAY_FLAG = "first_play_tutorials"

    /** The synced column on profiles (20261010000001_tutorials_seen.sql). */
    const val TUTORIALS_SEEN_COLUMN = "tutorials_seen"

    const val POCKET_TURNS_LINE = "Take your turn any time. Your friend gets a ping, and the game waits for you both for 3 days."

    const val TUTORIAL_BUTTON_FIRST = "Let's play!"
    const val TUTORIAL_BUTTON_AGAIN = "Got it"

    private fun p(art: List<String>, joiners: List<String> = emptyList()) = PocketHelpPicture(art, joiners)
    private fun s(text: String, picture: PocketHelpPicture) = PocketHelpStep(text, picture)

    val POCKET_HELP: Map<FriendlyKind, PocketHelpCard> = mapOf(
        FriendlyKind.RPS to PocketHelpCard(
            FriendlyKind.RPS, "pocket-rps", "Rock Paper Scissors",
            listOf(
                s("Pick rock, paper or scissors. Your pick stays hidden.", p(listOf("art-pocket-rps-rock", "art-pocket-rps-paper", "art-pocket-rps-scissors"))),
                s("When you both have picked, the hands flip over together.", p(listOf("art-pocket-rps-rock", "art-pocket-clash-burst", "art-pocket-rps-scissors"))),
                s("Rock beats scissors, scissors beat paper, paper beats rock.", p(listOf("art-pocket-rps-rock", "art-pocket-rps-scissors"), listOf("beats"))),
            ),
            "First to win 2 rounds takes the match.", POCKET_TURNS_LINE,
        ),
        FriendlyKind.TTT to PocketHelpCard(
            FriendlyKind.TTT, "pocket-ttt", "Tic-Tac-Tile",
            listOf(
                s("Take turns placing your tile on the 3 by 3 board. You are the purple X.", p(listOf("art-pocket-ttt-x", "art-pocket-ttt-o"))),
                s("Three of your tiles in a row, across, down or corner to corner, wins the game.", p(listOf("art-pocket-ttt-x", "art-pocket-ttt-x", "art-pocket-ttt-x"))),
                s("Fill the board with no line and the game is a draw.", p(listOf("art-pocket-ttt-board"))),
            ),
            "Win 2 games, out of at most 5, to take the match.", POCKET_TURNS_LINE,
        ),
        FriendlyKind.COIN to PocketHelpCard(
            FriendlyKind.COIN, "pocket-coin", "Call It",
            listOf(
                s("Call heads or tails before the flip.", p(listOf("art-pocket-coin-heads-w", "art-pocket-coin-tails-crest"))),
                s("The coin flips. Call it right and the round is yours.", p(listOf("art-pocket-coin-heads-w", "art-pocket-coin-tilt", "art-pocket-coin-tails-crest"))),
                s("You swap who calls each round. Heads is the W, tails is the crest.", p(listOf("art-pocket-coin-sparkle-ring"))),
            ),
            "First to win 3 flips takes the match, and the stake you picked.", POCKET_TURNS_LINE,
        ),
        FriendlyKind.PASS to PocketHelpCard(
            FriendlyKind.PASS, "pocket-pass", "Pass the Puzzle",
            listOf(
                s("You and your friend share one hidden word and one board.", p(List(5) { "art-pocket-tile-white" })),
                s("Take turns guessing. Purple is the right spot, gold is the wrong spot.", p(listOf("art-pocket-tile-purple", "art-pocket-tile-gold", "art-pocket-tile-white"))),
                s("Use what the last guess showed. There are 6 guesses in all.", p(listOf("art-pocket-puzzle-piece"))),
            ),
            "Whoever finds the word wins. Nobody finds it in 6, it is a draw.", POCKET_TURNS_LINE,
        ),
        FriendlyKind.GHOST to PocketHelpCard(
            FriendlyKind.GHOST, "pocket-ghost", "Ghost",
            listOf(
                s("Take turns adding one letter to a growing word fragment.", p(listOf("art-pocket-tile-purple", "art-pocket-tile-gold", "art-pocket-tile-purple"))),
                s("Every fragment must still be able to become a real word.", p(List(3) { "art-pocket-tile-white" })),
                s("Finish a real word, or play a dead end, and you lose the round.", p(listOf("art-pocket-ghost-marker"))),
            ),
            "Win 2 rounds, out of at most 5, to take the match.", POCKET_TURNS_LINE,
        ),
        FriendlyKind.CHAIN to PocketHelpCard(
            FriendlyKind.CHAIN, "pocket-chain", "Word Chain",
            listOf(
                s("Play a word that starts with the last letter of the word before it.", p(listOf("art-pocket-tile-purple", "art-pocket-chain-connector", "art-pocket-tile-gold"))),
                s("Longer words score more points. No word can be played twice.", p(listOf("art-pocket-chain-links"))),
                s("Build the chain back and forth with your friend.", p(listOf("art-pocket-tile-purple", "art-pocket-tile-gold", "art-pocket-tile-purple"))),
            ),
            "First to 30 points wins.", POCKET_TURNS_LINE,
        ),
    )

    /** The tutorial key for a pocket kind ("pocket-rps"); main games use their mode id. */
    fun pocketTutorialKey(kind: FriendlyKind): String = "pocket-${kind.raw}"

    /**
     * Whether the welcome card opens by itself: the switch is live and this game's key
     * is not in the player's seen list. `seen` is null while it is still loading
     * (never show on a guess: wait).
     */
    fun shouldAutoShowTutorial(live: Boolean, seen: Collection<String>?, key: String): Boolean {
        if (!live || seen == null) return false
        return key !in seen
    }

    /** The seen list after the card closes: the key added once, kept sorted. */
    fun withTutorialSeen(seen: Collection<String>, key: String): List<String> =
        if (key in seen) seen.toList() else (seen + key).sorted()

    /** Two devices both added keys: the union, sorted. */
    fun mergeTutorialsSeen(a: Collection<String>, b: Collection<String>): List<String> = (a.toSet() + b.toSet()).sorted()
}
