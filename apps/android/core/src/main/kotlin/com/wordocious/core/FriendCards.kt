package com.wordocious.core

/**
 * Friends tab, one card per friend (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3).
 * 1:1 port of packages/core/src/friend-cards.ts; pinned by
 * friend-cards-fixtures.json (FriendCardsFixtureTest).
 *
 * Online friends first, one card per friend with their living mascot,
 * "N games waiting on you" and a compact strip of game tiles (the game's art +
 * a one-word state). "Their turn" games collapse into one quiet line. Everyone
 * else lives in an "All friends" list. Pure so the three apps print the same words.
 */

/** The slice of a friend the cards need. */
data class CardFriend(
    val id: String,
    val username: String,
    /** Heartbeat under two minutes old (isOnline). */
    val online: Boolean,
    /** What they are doing now ("Classic", "Muddle"), when online and known. */
    val activity: String? = null,
    val lastSeenMs: Long? = null,
)

/** The slice of an active pocket game the cards need. */
data class CardGame(
    val id: String,
    val kind: FriendlyKind,
    /** The friend this game is with. */
    val opponentId: String,
    /** Only used when the opponent is not in the friend list. */
    val opponentName: String,
    val me: Side,
    val state: FriendlyState,
    val yourTurn: Boolean,
    /** ISO time of the last move. */
    val updatedAt: String,
)

data class GameTile(
    val gameId: String,
    val kind: FriendlyKind,
    /** One short word: "Your pick", "Your move", "1 of 6", "GHO…". */
    val word: String,
    val yourTurn: Boolean,
)

data class FriendCard(
    val friendId: String,
    val name: String,
    val online: Boolean,
    /** "playing Classic" / "on now" while online, else null. */
    val presence: String?,
    /** How many games wait on you. */
    val waiting: Int,
    /** "6 games waiting on you" / "1 game waiting on you" / "". */
    val headline: String,
    /** Your-turn tiles, newest first. */
    val tiles: List<GameTile>,
    /** Their-turn games, collapsed (expanded on tap), newest first. */
    val theirTurn: List<GameTile>,
    /** "3 waiting on Johnny" or "". */
    val theirTurnLine: String,
)

data class FriendsLayout(
    /** Online friends and friends with active games: the cards. */
    val cards: List<FriendCard>,
    /** Everyone else, A to Z: the "All friends" dropdown. */
    val rest: List<String>,
)

object FriendCards {
    private const val MAX_FRAGMENT = 6

    /** The one-word state under a game tile. */
    fun tileWord(kind: FriendlyKind, state: FriendlyState, me: Side, yourTurn: Boolean): String = when (kind) {
        // Plain words under the game's name (founder 10-09; core friend-cards.ts tileWord).
        FriendlyKind.RPS -> if (yourTurn) "Pick rock, paper or scissors" else "Waiting for their pick"
        FriendlyKind.TTT -> if (yourTurn) "Your turn to place a tile" else "Waiting for their move"
        FriendlyKind.COIN -> if (yourTurn) "Call heads or tails" else "Waiting for their call"
        FriendlyKind.PASS -> {
            val used = (state as? PassState)?.guesses?.size ?: 0
            if (yourTurn) "Your guess (${minOf(used + 1, PASS_MAX_GUESSES)} of $PASS_MAX_GUESSES)" else "Waiting for their guess"
        }
        FriendlyKind.GHOST -> {
            if (!yourTurn) {
                "Waiting for their letter"
            } else {
                val f = ((state as? GhostState)?.fragment ?: "").uppercase()
                if (f.isEmpty()) "Start the word: add a letter"
                else "Add a letter to ${if (f.length > MAX_FRAGMENT) "${f.take(MAX_FRAGMENT)}…" else f}"
            }
        }
        FriendlyKind.CHAIN -> {
            if (!yourTurn) {
                "Waiting for their word"
            } else {
                val last = (state as? ChainState)?.words?.lastOrNull()
                if (last != null && last.word.isNotEmpty()) "Your word must start with ${last.word.last().uppercaseChar()}" else "Start the chain with any word"
            }
        }
    }

    /** "6 games waiting on you" / "1 game waiting on you" / "". */
    fun waitingHeadline(n: Int): String = when {
        n <= 0 -> ""
        n == 1 -> "1 game waiting on you"
        else -> "$n games waiting on you"
    }

    /** The quiet collapsed line: "3 waiting on Johnny". */
    fun theirTurnLine(n: Int, name: String): String = if (n <= 0) "" else "$n waiting on $name"

    /** "playing Classic" while they are in a game, "on now" otherwise; null when offline. */
    fun cardPresence(online: Boolean, activity: String?): String? {
        if (!online) return null
        return if (!activity.isNullOrEmpty()) "playing $activity" else "on now"
    }

    /** The label on the collapsed list: "All friends · 12". */
    fun allFriendsLabel(count: Int): String = "All friends · $count"

    /** Whether any card has a game waiting on you. */
    fun hasYourTurn(layout: FriendsLayout): Boolean = layout.cards.any { it.waiting > 0 }

    private class Ranked(val card: FriendCard, val newest: String, val rank: Int)

    /**
     * The Friends tab layout. Cards: online friends first, then friends with games
     * waiting on you, then friends with only their-turn games. Within a group: more
     * games waiting on you first, then the newest move, then A to Z. Friends with no
     * active game who are offline go to `rest`.
     */
    fun friendsLayout(friends: List<CardFriend>, games: List<CardGame>): FriendsLayout {
        val byFriend = LinkedHashMap<String, MutableList<CardGame>>()
        for (g in games) byFriend.getOrPut(g.opponentId) { mutableListOf() }.add(g)
        // A game with someone no longer in the list still deserves its card.
        val known = friends.map { it.id }.toSet()
        val all = friends.toMutableList()
        for ((id, list) in byFriend) {
            if (id !in known) all.add(CardFriend(id = id, username = list[0].opponentName, online = false))
        }

        val ranked = mutableListOf<Ranked>()
        val rest = mutableListOf<String>()
        for (f in all) {
            val mine = (byFriend[f.id] ?: emptyList<CardGame>()).sortedWith { a, b -> b.updatedAt.compareTo(a.updatedAt) }
            if (!f.online && mine.isEmpty()) {
                rest.add(f.username)
                continue
            }
            val toTile = { g: CardGame -> GameTile(g.id, g.kind, tileWord(g.kind, g.state, g.me, g.yourTurn), g.yourTurn) }
            val tiles = mine.filter { it.yourTurn }.map(toTile)
            val theirTurn = mine.filter { !it.yourTurn }.map(toTile)
            val card = FriendCard(
                friendId = f.id, name = f.username, online = f.online, presence = cardPresence(f.online, f.activity),
                waiting = tiles.size, headline = waitingHeadline(tiles.size), tiles = tiles, theirTurn = theirTurn,
                theirTurnLine = theirTurnLine(theirTurn.size, f.username),
            )
            ranked.add(Ranked(card, mine.firstOrNull()?.updatedAt ?: "", if (f.online) 0 else if (tiles.isNotEmpty()) 1 else 2))
        }
        val sorted = ranked.sortedWith { a, b ->
            val r = a.rank.compareTo(b.rank)
            if (r != 0) return@sortedWith r
            val w = b.card.waiting.compareTo(a.card.waiting)
            if (w != 0) return@sortedWith w
            val n = b.newest.compareTo(a.newest)
            if (n != 0) return@sortedWith n
            a.card.name.lowercase().compareTo(b.card.name.lowercase())
        }
        return FriendsLayout(sorted.map { it.card }, rest.sortedBy { it.lowercase() })
    }
}
