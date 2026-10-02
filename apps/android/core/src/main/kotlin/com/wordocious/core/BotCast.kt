package com.wordocious.core

import java.time.LocalDate

// The bot cast (founder-approved finishing build, docs/FINISH_SPEC.md D1–D2,
// 2026-10-02): the VS bots ARE the ten WORDOCIOUS characters, on a ten-rung
// ladder (three wins in a row clear a rung). 1:1 port of
// packages/core/src/bot-cast.ts — web, iOS and Android read THIS table
// (vs-lobby-fixtures.json pins the ladder words; BotCastTest pins the rest).
//
//  rung  id       name     cast  tier      guesses  trait
//   1    rip      Rip      R     easy      6–6      Easy going
//   2    ivy      Ivy      I     easy      5–6      Shy but steady
//   3    ollie    Ollie    O1    easy      5–5      Cheers every guess
//   4    opal     Opal     O2    medium    4–5      A little dramatic
//   5    cosmo    Cosmo    C     medium    4–5      Bold openers
//   6    umi      Umi      U     adaptive  —        Matches your form
//   7    ozzy     Ozzy     O3    medium    4–5      Tricky guesses
//   8    dewey    Dewey    D     hard      3–4      Studies every letter
//   9    scoot    Scoot    S     hard      2–4      Lightning fast
//  10    webster  Webster  W     hard      2–3      The boss
//
// `tier` is the old engine difficulty each bot borrows (its think time per guess
// and its miss chance); `guesses` narrows the tier's solve range to the bot's
// own. Umi has no fixed range: the adaptive engine shadows the player. "Your
// Ghost" (the player's best run, replayed) is not part of the cast and keeps
// its id `ghost`.
//
// Old ids (before 2026-10-02) map by difficulty, so old matches and stats keep
// counting: rook → ivy, lexi → opal, nova → dewey, adapt → umi. The old
// four-rung ladder's cleared count N (0–4 over rook, lexi, nova, adapt) becomes
// [0, 2, 4, 7, 10][N] (the run in progress resets to 0).
//
// Bot of the Day rotates with the Leaderboard day host (UTC weekday of the
// day's date): Sun ozzy · Mon dewey · Tue ivy · Wed umi · Thu scoot · Fri opal
// · Sat ollie.

/** The old engine tier a cast bot borrows. */
enum class BotCastTier(val raw: String) { EASY("easy"), MEDIUM("medium"), HARD("hard"), ADAPTIVE("adaptive") }

data class BotCastMember(
    val id: String,
    val name: String,
    /** The character it is: the mascot / pose art id ("r", "i", "o1", …). */
    val castId: String,
    /** Ladder rung, 1–10. */
    val rung: Int,
    val tier: BotCastTier,
    /** The solve range in guesses (Classic), or null for the adaptive bot. */
    val guesses: IntRange?,
    /** One short line about how it plays. */
    val trait: String,
    /** Its accent color (the character's own color), 0xFFRRGGBB. */
    val color: Long,
)

object BotCast {
    /** The ten bots in ladder order. */
    val MEMBERS: List<BotCastMember> = listOf(
        BotCastMember("rip", "Rip", "r", 1, BotCastTier.EASY, 6..6, "Easy going", 0xFF22C55E),
        BotCastMember("ivy", "Ivy", "i", 2, BotCastTier.EASY, 5..6, "Shy but steady", 0xFF10B981),
        BotCastMember("ollie", "Ollie", "o1", 3, BotCastTier.EASY, 5..5, "Cheers every guess", 0xFFF97316),
        BotCastMember("opal", "Opal", "o2", 4, BotCastTier.MEDIUM, 4..5, "A little dramatic", 0xFFEC4899),
        BotCastMember("cosmo", "Cosmo", "c", 5, BotCastTier.MEDIUM, 4..5, "Bold openers", 0xFF0EA5E9),
        BotCastMember("umi", "Umi", "u", 6, BotCastTier.ADAPTIVE, null, "Matches your form", 0xFF8B5CF6),
        BotCastMember("ozzy", "Ozzy", "o3", 7, BotCastTier.MEDIUM, 4..5, "Tricky guesses", 0xFFEAB308),
        BotCastMember("dewey", "Dewey", "d", 8, BotCastTier.HARD, 3..4, "Studies every letter", 0xFF2563EB),
        BotCastMember("scoot", "Scoot", "s", 9, BotCastTier.HARD, 2..4, "Lightning fast", 0xFFEF4444),
        BotCastMember("webster", "Webster", "w", 10, BotCastTier.HARD, 2..3, "The boss", 0xFF7C3AED),
    )

    /** The ten ids in ladder order. */
    val IDS: List<String> = MEMBERS.map { it.id }

    /** "Your Ghost" — the player's best run, replayed (not part of the cast). */
    const val GHOST_ID = "ghost"

    private val byId: Map<String, BotCastMember> = MEMBERS.associateBy { it.id }

    /** Old bot ids → their cast replacement (by difficulty). */
    val LEGACY_BOT_IDS: Map<String, String> = mapOf("rook" to "ivy", "lexi" to "opal", "nova" to "dewey", "adapt" to "umi")

    /** Old ladder cleared count N (0–4) → the new cleared count. */
    val LEGACY_LADDER_CLEARED: List<Int> = listOf(0, 2, 4, 7, 10)

    /** Bot of the Day by UTC weekday, Sunday first (JS getUTCDay order). */
    val BOT_OF_DAY_BY_WEEKDAY: List<String> = listOf("ozzy", "dewey", "ivy", "umi", "scoot", "opal", "ollie")

    /**
     * A bot id in the current cast: old ids map (rook → ivy, …); cast ids, `ghost`,
     * `daily` and anything unknown pass through unchanged.
     */
    fun canonicalId(id: String): String = LEGACY_BOT_IDS[id] ?: id

    /** The cast member for an id (old ids map first), or null (ghost, daily, unknown). */
    fun member(id: String?): BotCastMember? = if (id.isNullOrEmpty()) null else byId[canonicalId(id)]

    /** "Solves in 5–6" / "Solves in 6" / "Matches your form" (adaptive). */
    fun solveLine(b: BotCastMember): String {
        val g = b.guesses ?: return "Matches your form"
        return if (g.first == g.last) "Solves in ${g.first}" else "Solves in ${g.first}–${g.last}"
    }

    /** The new ladder cleared count for an old (four-rung) one. */
    fun migrateLegacyLadderCleared(oldCleared: Int): Int =
        LEGACY_LADDER_CLEARED[oldCleared.coerceIn(0, LEGACY_LADDER_CLEARED.size - 1)]

    /** Today's Bot of the Day for a yyyy-MM-dd [day] (the UTC day it is seeded on). */
    fun botOfTheDay(day: String): BotCastMember {
        // java.time DayOfWeek: MONDAY = 1 … SUNDAY = 7 → Sunday-first index.
        val wd = runCatching { LocalDate.parse(day).dayOfWeek.value % 7 }.getOrDefault(0)
        return byId.getValue(BOT_OF_DAY_BY_WEEKDAY[wd])
    }
}
