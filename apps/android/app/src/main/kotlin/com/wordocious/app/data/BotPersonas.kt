package com.wordocious.app.data

import com.wordocious.app.ui.MascotId
import com.wordocious.core.BotCast
import com.wordocious.core.BotCastMember
import com.wordocious.core.BotCastTier

/**
 * CPU opponent personas + banter for VS-vs-CPU. FINISH_SPEC D1 (founder-approved
 * 2026-10-02): the bots ARE the cast — the ten WORDOCIOUS characters on a ten-rung
 * ladder (core BotCast, the same table web and iOS read). Each borrows an old engine
 * tier for its think time and miss chance and narrows the solve range to its own.
 */

enum class BotDifficulty { EASY, MEDIUM, HARD, ADAPTIVE }

/** Concrete (non-adaptive) skill tier a persona is anchored to. */
enum class BotTier { EASY, MEDIUM, HARD }

data class BotPersona(
    val id: String,
    val name: String,
    val color: Long,      // 0xFFRRGGBB
    val tier: BotTier,
    val tagline: String,
)

/** The engine tier a cast member borrows (Umi's adaptive engine anchors at medium). */
val BotCastMember.botTier: BotTier get() = when (tier) {
    BotCastTier.EASY -> BotTier.EASY
    BotCastTier.MEDIUM, BotCastTier.ADAPTIVE -> BotTier.MEDIUM
    BotCastTier.HARD -> BotTier.HARD
}

/** The character a cast member is. */
val BotCastMember.mascot: MascotId get() = when (castId) {
    "r" -> MascotId.R; "i" -> MascotId.I; "o1" -> MascotId.O1; "o2" -> MascotId.O2; "c" -> MascotId.C
    "u" -> MascotId.U; "o3" -> MascotId.O3; "d" -> MascotId.D; "s" -> MascotId.S; else -> MascotId.W
}

/**
 * The bots' pictures (FINISH_SPEC D1/D3): every cast bot is its character — the hero
 * image in avatar spots, the VS poses (`art_pose_<cast>_ready|waiting|victory|goodgame`)
 * on the VS screens. "Your Ghost" keeps its own art (shown faded beside the player's
 * letter tile on the redesigned screens). Old ids map to their cast replacement.
 */
object BotArt {
    /** The character for a bot id (old ids map), or null for the ghost / unknown. */
    fun mascot(id: String?): MascotId? = BotCast.member(id)?.mascot

    /** The avatar image: the cast hero image, the ghost's own art otherwise. */
    fun res(id: String): Int = mascot(id)?.res ?: com.wordocious.app.R.drawable.bot_ghost

    /** A VS pose for a bot ("ready", "waiting", "victory", "goodgame"); the hero image when missing. */
    fun pose(id: String, pose: String): Int {
        val m = mascot(id) ?: return res(id)
        return com.wordocious.app.ui.CastPoses.res(m, pose) ?: m.res
    }

    /** The avatar-url form VsAvatar understands ("bot:<id>"), so the match
     *  header, intro and strips draw the art through the one avatar path. */
    fun avatarUrl(id: String): String = "bot:$id"
}

object BotPersonas {
    /** The cast member a tier falls back to (old callers): easy → Ivy, medium → Opal, hard → Dewey. */
    fun persona(tier: BotTier): BotPersona = when (tier) {
        BotTier.EASY -> forCast("ivy"); BotTier.MEDIUM -> forCast("opal"); BotTier.HARD -> forCast("dewey")
    }

    /** The persona for a cast id (old ids map; unknown → Opal). */
    fun forCast(id: String): BotPersona {
        val m = BotCast.member(id) ?: BotCast.member("opal")!!
        return BotPersona(m.id, m.name, m.color, m.botTier, m.trait)
    }

    fun tierLabel(tier: BotTier): String = when (tier) {
        BotTier.EASY -> "Easy"; BotTier.MEDIUM -> "Medium"; BotTier.HARD -> "Hard"
    }

    /** Display name for a ladder / bot id ("rip" → "Rip"; old ids map; "ghost" → "Your Ghost"). */
    fun name(id: String): String = when (id) {
        BotCast.GHOST_ID -> "Your Ghost"
        else -> BotCast.member(id)?.name ?: id.replaceFirstChar { it.uppercaseChar() }
    }

    /** The difficulty word for a bot id: "Easy" / "Medium" / "Hard" / "Adaptive" / "Boss". */
    fun tierWord(id: String): String {
        val m = BotCast.member(id) ?: return "Adaptive"
        if (m.rung == BotCast.MEMBERS.size) return "Boss"
        return when (m.tier) {
            BotCastTier.EASY -> "Easy"; BotCastTier.MEDIUM -> "Medium"
            BotCastTier.HARD -> "Hard"; BotCastTier.ADAPTIVE -> "Adaptive"
        }
    }

    /** The bot's line on the Bots page ("Medium · solves in 4–5"; core BotCast.solveLine). */
    fun tierLine(id: String): String {
        val m = BotCast.member(id) ?: return "Adaptive · matches your form"
        return "${tierWord(id)} · ${BotCast.solveLine(m).replaceFirstChar { it.lowercaseChar() }}"
    }

    enum class BotEvent { MATCH_START, BOT_SOLVED_BOARD, PLAYER_OVERTAKES, PLAYER_NEAR_MISS, BOT_WIN, BOT_LOSS }

    /**
     * Banter per character (FINISH_SPEC D3: rewritten per personality, kind, never
     * mean). Keyed by cast id; old ids map through BotCast.canonicalId.
     */
    private val banter: Map<String, Map<BotEvent, List<String>>> = mapOf(
        // R · Rip: sleepy, easy going.
        "rip" to mapOf(
            BotEvent.MATCH_START to listOf("*yawn* Okay, I’m up. Let’s play!", "Go easy on me, I just woke up."),
            BotEvent.BOT_SOLVED_BOARD to listOf("Whoa, I got one!", "Did I… do that? Neat."),
            BotEvent.PLAYER_OVERTAKES to listOf("You’re quick! I’ll catch up… after a nap.", "Wow, nice pace!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("Ooh, so close!", "Almost had it!"),
            BotEvent.BOT_WIN to listOf("I won? I must be dreaming!", "Lucky snooze, I promise."),
            BotEvent.BOT_LOSS to listOf("Good game! You earned that one.", "Nicely done. Time for cocoa!"),
        ),
        // I · Ivy: shy but steady.
        "ivy" to mapOf(
            BotEvent.MATCH_START to listOf("Hi… good luck! You too, I mean.", "I’ll do my best, quietly."),
            BotEvent.BOT_SOLVED_BOARD to listOf("Oh! I got it.", "One down… eep."),
            BotEvent.PLAYER_OVERTAKES to listOf("You’re really good at this.", "Wow, you’re ahead!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("So close! You’ve got this.", "Almost there!"),
            BotEvent.BOT_WIN to listOf("I… won? Thank you for playing with me!", "That was fun. Again?"),
            BotEvent.BOT_LOSS to listOf("Well played! I learned a lot.", "You’re amazing. Good game!"),
        ),
        // O1 · Ollie: the cheerleader.
        "ollie" to mapOf(
            BotEvent.MATCH_START to listOf("Gimme a W! Let’s gooo!", "Pom-poms up, here we go!"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Woo-hoo, got one!", "Cartwheel time!"),
            BotEvent.PLAYER_OVERTAKES to listOf("Go, go, go! Love that pace!", "You’re on fire!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("Sooo close! Keep going!", "Almost! You’ve got this!"),
            BotEvent.BOT_WIN to listOf("Victory cheer! Rematch?", "Yay! Great game, friend!"),
            BotEvent.BOT_LOSS to listOf("Three cheers for you!", "You won! Hip hip hooray!"),
        ),
        // O2 · Opal: a little dramatic.
        "opal" to mapOf(
            BotEvent.MATCH_START to listOf("Darling, the stage is set!", "Let the show begin!"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Ta-da! Encore!", "A sparkling solve!"),
            BotEvent.PLAYER_OVERTAKES to listOf("Gasp! What a twist!", "Stealing the spotlight, I see!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("Ooh, the suspense!", "So close, darling!"),
            BotEvent.BOT_WIN to listOf("And scene! Take a bow with me.", "What a performance! Rematch?"),
            BotEvent.BOT_LOSS to listOf("Bravo! A standing ovation for you!", "You stole the show. Magnificent!"),
        ),
        // C · Cosmo: the curious explorer, bold openers.
        "cosmo" to mapOf(
            BotEvent.MATCH_START to listOf("Adventure time! Bold openers ready.", "Let’s explore this puzzle!"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Discovered it!", "Mapped that one out!"),
            BotEvent.PLAYER_OVERTAKES to listOf("Ooh, you found a shortcut!", "Great route!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("Almost there, explorer!", "You’re right on the trail!"),
            BotEvent.BOT_WIN to listOf("What a journey! Again?", "Fun expedition, partner!"),
            BotEvent.BOT_LOSS to listOf("You charted that perfectly!", "Great find! Good game."),
        ),
        // U · Umi: zen, matches your form.
        "umi" to mapOf(
            BotEvent.MATCH_START to listOf("Breathe in… and let’s begin.", "I’ll flow at your pace."),
            BotEvent.BOT_SOLVED_BOARD to listOf("Calm and solved.", "Balance found."),
            BotEvent.PLAYER_OVERTAKES to listOf("Lovely rhythm.", "You’re in the flow!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("So close. Stay calm.", "Breathe. You’re nearly there."),
            BotEvent.BOT_WIN to listOf("A peaceful game. Thank you.", "Well matched. Again?"),
            BotEvent.BOT_LOSS to listOf("Beautifully played.", "Your focus wins today. Namaste."),
        ),
        // O3 · Ozzy: the trickster (friendly pranks).
        "ozzy" to mapOf(
            BotEvent.MATCH_START to listOf("Heh, I’ve got a few tricks ready!", "Watch out for my sneaky guesses!"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Surprise! Got one!", "Ta-daa, didn’t see that coming?"),
            BotEvent.PLAYER_OVERTAKES to listOf("Ha! You saw through me!", "Clever you!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("Ooh, nearly! Tricky one, huh?", "So close!"),
            BotEvent.BOT_WIN to listOf("Gotcha! All in good fun.", "Hehe, rematch?"),
            BotEvent.BOT_LOSS to listOf("You out-tricked the trickster!", "Ha, well played!"),
        ),
        // D · Dewey: the studious one.
        "dewey" to mapOf(
            BotEvent.MATCH_START to listOf("I’ve studied every letter. Good luck!", "Notes ready. Let’s play!"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Eureka!", "Just as my notes said."),
            BotEvent.PLAYER_OVERTAKES to listOf("Fascinating strategy!", "Impressive reasoning!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("Nearly! Check the vowels.", "One letter off!"),
            BotEvent.BOT_WIN to listOf("A well-studied win. Good game!", "Great match. Shall we review it?"),
            BotEvent.BOT_LOSS to listOf("Top marks for you!", "I’ll add that to my notes. Well done!"),
        ),
        // S · Scoot: the speedster.
        "scoot" to mapOf(
            BotEvent.MATCH_START to listOf("Ready, set, zoom!", "Let’s race!"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Zoom! Got it!", "Speedy solve!"),
            BotEvent.PLAYER_OVERTAKES to listOf("Whoa, you’re fast!", "Nice speed!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("So close! Keep zooming!", "Almost!"),
            BotEvent.BOT_WIN to listOf("Photo finish! Great race!", "Zoom! Rematch?"),
            BotEvent.BOT_LOSS to listOf("You beat me to the line!", "Wow, you’re speedy! Good game!"),
        ),
        // W · Webster: the friendly boss.
        "webster" to mapOf(
            BotEvent.MATCH_START to listOf("Welcome to the top rung! Let’s have a great one.", "The boss is ready. Are you?"),
            BotEvent.BOT_SOLVED_BOARD to listOf("Boss move!", "Wordocious!"),
            BotEvent.PLAYER_OVERTAKES to listOf("Now that’s championship play!", "You’re making this a real match!"),
            BotEvent.PLAYER_NEAR_MISS to listOf("So close! You’ve got the boss sweating.", "Almost!"),
            BotEvent.BOT_WIN to listOf("Great climb! Come back for a rematch.", "A worthy match. Again?"),
            BotEvent.BOT_LOSS to listOf("You beat the boss! Take a bow.", "Champion! What a game!"),
        ),
    )

    fun line(personaId: String, event: BotEvent): String? =
        banter[BotCast.canonicalId(personaId)]?.get(event)?.randomOrNull()
}
