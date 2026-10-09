package com.wordocious.core

/**
 * FRIDAY-QUEUE item 41: the one-time "What's new in 2.8" tour — a 1:1 port of packages/core/src/whats-new.ts
 * (pages + the show / record / wait / none decision). Brand-new players never see it.
 */
object WhatsNew {
    const val KEY = "whats-new-28"
    const val FLAG = "whats_new_28"
    /** Accounts created on or after this local date are 2.8-era players: no tour. Set to the 2.8 go-live date. */
    const val CUTOFF = "2026-10-15"

    sealed interface Art {
        data class Image(val name: String) : Art
        object Mascot : Art
        data class Icons(val names: List<String>) : Art
    }

    data class Page(val id: String, val title: String, val lines: List<String>, val art: Art, val platforms: List<String>)

    private val ALL = listOf("web", "ios", "android")
    private val APPS = listOf("ios", "android")

    val PAGES = listOf(
        Page("season", "HALLOWEEN IS HERE",
            listOf("The whole cast is in costume, with spooky screens and tunes.", "Pick a seasonal theme in Settings, or switch it off any time."),
            Art.Image("art-halloween-prop-pumpkin"), ALL),
        Page("alive", "YOUR MASCOT IS ALIVE",
            listOf("Your mascot breathes, blinks and reacts as you play.", "Tap it to say hi."), Art.Mascot, ALL),
        Page("order", "PUT GAMES IN YOUR ORDER",
            listOf("Tap the pencil by Dailies or Puzzles, or press and hold a game, then drag it.", "Classic always stays first."),
            Art.Icons(listOf("game-practice", "game-quordle", "game-octordle")), ALL),
        Page("invites", "INVITES AND POCKET GAMES",
            listOf("One link per invite, straight to the right screen.", "Pocket games play live now: watch your friend move as it happens."),
            Art.Icons(listOf("game-pocket-rps", "game-pocket-ttt", "game-pocket-coin")), ALL),
        Page("widgets", "NEW WIDGETS",
            listOf("Widgets with your mascot show today’s games, your streak and a live countdown.", "Add one from your home screen."),
            Art.Icons(listOf("game-sweep")), APPS),
        Page("packs", "MASCOT PACKS",
            listOf("New bodies, costumes and parts in the Dressing Room.", "Make your mascot truly yours."),
            Art.Image("art-pose-o1-cheer"), ALL),
    )

    fun pages(platform: String): List<Page> = PAGES.filter { platform in it.platforms }

    enum class Decision { SHOW, RECORD, WAIT, NONE }

    /** SHOW: open the tour. RECORD: a brand-new player, write the key quietly. WAIT: not decidable yet. NONE: nothing to do. */
    fun decision(
        live: Boolean, seen: List<String>?, signedIn: Boolean, hasOnboarded: Boolean?, createdAt: String?, cutoff: String = CUTOFF,
    ): Decision {
        if (!live || !signedIn) return Decision.NONE
        if (seen == null || hasOnboarded == null) return Decision.WAIT
        if (KEY in seen) return Decision.NONE
        val created = (createdAt ?: "").take(10)
        val brandNew = !hasOnboarded || (created.isNotEmpty() && created >= cutoff)
        return if (brandNew) Decision.RECORD else Decision.SHOW
    }
}
