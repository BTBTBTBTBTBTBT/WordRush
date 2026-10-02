package com.wordocious.core

/**
 * Share copy (docs/FINISH_SPEC.md S4) — port of packages/core/src/share-captions.ts.
 * Short, fun, makes sense, no em dashes, American spelling, never mean. ONE bank
 * shared by web, iOS and Android; the line is picked deterministically so all
 * three platforms agree:
 *
 *   key   = "$date|$game"               (date = the result's yyyy-MM-dd, game = its display name)
 *   hash  = FNV-1a 32-bit over the key's UTF-16 code units (start 2166136261, prime 16777619)
 *   index = hash % bank.size            (unsigned)
 *
 * Then the {placeholders} are filled; a result share with a streak of 3+ appends
 * " 🔥 Day {d}". Parity: share-captions-fixtures.json (ShareCaptionsFixtureTest).
 */
object ShareCaptions {
    enum class Kind(val key: String, val result: Boolean) {
        WIN("win", true),
        MULTI_WIN("multiWin", true),
        FLAWLESS("flawless", true),
        LOSE("lose", true),
        SWEEP("sweep", true),
        GAUNTLET_WIN("gauntletWin", true),
        GAUNTLET_LOSE("gauntletLose", true),
        VS_WIN("vsWin", true),
        VS_LOSE("vsLose", true),
        VS_DRAW("vsDraw", true),
        INVITE("invite", false),
        VS_INVITE("vsInvite", false),
    }

    /** The caption bank, by kind. Order matters (the hash indexes it). */
    val BANK: Map<Kind, List<String>> = linkedMapOf(
        Kind.WIN to listOf(
            "{game} solved in {n} guesses. Your move 😎",
            "Cracked {game} in {t} ⚡ Beat that!",
            "{game} in {n}. The letters never stood a chance.",
        ),
        Kind.MULTI_WIN to listOf("All {b} {game} boards cleared in {n} guesses 🧠✨"),
        Kind.FLAWLESS to listOf("Flawless {game}! 💎 Not one wasted guess."),
        Kind.LOSE to listOf(
            "{game} got me today 😅 Can you crack it?",
            "So close on {game}! Think you can do better?",
        ),
        Kind.SWEEP to listOf("Swept every Wordocious daily today 🧹✨"),
        Kind.GAUNTLET_WIN to listOf("Cleared all 5 Gauntlet stages 🏆"),
        Kind.GAUNTLET_LOSE to listOf("Reached stage {k} of the Gauntlet. Can you go further?"),
        Kind.VS_WIN to listOf("Beat {opp} at {game} ⚔️"),
        Kind.VS_LOSE to listOf("{opp} edged me at {game}. Rematch incoming 🔁"),
        Kind.VS_DRAW to listOf("{opp} and I tied at {game}. Rematch? ⚔️"),
        Kind.INVITE to listOf("Come play Wordocious with me! 🎉 {url}"),
        Kind.VS_INVITE to listOf("Race me at {game}! ⚡ {url}"),
    )

    /** Toasts after a share falls back to the clipboard / a download. */
    const val TOAST_COPIED = "Image copied! Paste it anywhere 📋"
    const val TOAST_SAVED = "Saved! Share it anywhere 🖼️"

    /** FNV-1a 32-bit over UTF-16 code units, as an unsigned value in a Long. */
    fun captionHash(key: String): Long {
        var h = 0x811C9DC5.toInt() // 2166136261
        for (ch in key) {
            h = h xor ch.code
            h *= 16777619 // Int overflow == Math.imul
        }
        return h.toLong() and 0xFFFFFFFFL
    }

    /** The bank index for a kind + key (exposed for the parity fixtures). */
    fun index(kind: Kind, date: String, game: String): Int =
        (captionHash("$date|$game") % BANK.getValue(kind).size).toInt()

    /** The fill-in values; null leaves a placeholder empty (web parity). */
    data class Vars(
        /** The result's day, yyyy-MM-dd (part of the pick key). */
        val date: String,
        /** The game's display name (part of the pick key), e.g. "QuadWord". */
        val game: String,
        /** Guesses. */
        val n: Any? = null,
        /** Time, already formatted ("0:48"). */
        val t: String? = null,
        /** Boards. */
        val b: Any? = null,
        /** Streak day (3+ appends " 🔥 Day {d}" to result shares). */
        val d: Int? = null,
        /** Gauntlet stage reached. */
        val k: Any? = null,
        /** Opponent name. */
        val opp: String? = null,
        /** Invite link. */
        val url: String? = null,
    )

    private val PLACEHOLDER = Regex("\\{(\\w+)\\}")

    /** The caption for a share: the deterministic pick, filled in, plus the streak suffix. */
    fun caption(kind: Kind, v: Vars): String {
        val line = BANK.getValue(kind)[index(kind, v.date, v.game)]
        val filled = PLACEHOLDER.replace(line) { m ->
            when (m.groupValues[1]) {
                "date" -> v.date
                "game" -> v.game
                "n" -> v.n?.toString() ?: ""
                "t" -> v.t ?: ""
                "b" -> v.b?.toString() ?: ""
                "d" -> v.d?.toString() ?: ""
                "k" -> v.k?.toString() ?: ""
                "opp" -> v.opp ?: ""
                "url" -> v.url ?: ""
                else -> ""
            }
        }
        return if (kind.result && v.d != null && v.d >= 3) "$filled 🔥 Day ${v.d}" else filled
    }

    /** The kind keyed by its web name ("multiWin"), for the fixtures. */
    fun kindOf(key: String): Kind? = Kind.entries.firstOrNull { it.key == key }
}
