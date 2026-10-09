package com.wordocious.core

import java.time.Instant
import java.time.ZoneOffset
import kotlin.math.roundToInt

/**
 * FRIDAY-QUEUE items 16 + 17 + 20 (2.8 wave 4): a 1:1 port of packages/core/src/stats-profile.ts — the Stats page's hero
 * stats / VS picker split / bots line / pocket records, the player profile's friendship state + action row, and the Go
 * Pro scene picker. Same words and same decisions as web and iOS (asserted by StatsProfileTest).
 */
object StatsProfile {
    // ---- VS picker: 9 games as 5 over 4 ----------------------------------------------------------------------------
    data class Split<T>(val top: List<T>, val bottom: List<T>)

    /** 9 -> 5 + 4 (top row the longer one). Five or fewer stay on one row. */
    fun <T> pickerSplit(items: List<T>): Split<T> {
        if (items.size <= 5) return Split(items, emptyList())
        val n = (items.size + 1) / 2
        return Split(items.take(n), items.drop(n))
    }

    // ---- Hero stats ------------------------------------------------------------------------------------------------
    fun winRatePct(wins: Int, losses: Int): Int {
        val total = wins + losses
        return if (total > 0) ((wins.toDouble() / total) * 100).roundToInt() else 0
    }

    /** "16s" / "1m 5s" / "2m" / "—". */
    fun formatFastest(seconds: Double): String {
        if (!(seconds > 0)) return "—"
        if (seconds < 60) return "${seconds.roundToInt()}s"
        val m = (seconds / 60).toInt()
        val s = (seconds % 60).roundToInt()
        return if (s > 0) "${m}m ${s}s" else "${m}m"
    }

    enum class HeroKey { RECORD, WIN_RATE, STREAK, FASTEST }

    /** [icon] is the shipped stat icon (art_stat_<icon>): crown, donut, bolt, stopwatch. */
    data class HeroStat(val key: HeroKey, val label: String, val value: String, val sub: String?, val icon: String)

    fun heroStats(wins: Int, losses: Int, streak: Int, bestStreak: Int, fastestSeconds: Double): List<HeroStat> {
        val played = wins + losses > 0
        return listOf(
            HeroStat(HeroKey.RECORD, "Record", "$wins–$losses", null, "crown"),
            HeroStat(HeroKey.WIN_RATE, "Win rate", if (played) "${winRatePct(wins, losses)}%" else "—", null, "donut"),
            HeroStat(HeroKey.STREAK, "Streak", streak.toString(), if (bestStreak > 0) "Best $bestStreak" else null, "bolt"),
            HeroStat(HeroKey.FASTEST, "Fastest", formatFastest(fastestSeconds), null, "stopwatch"),
        )
    }

    /** The guess chart stays hidden until there is a win. */
    fun showGuessDistribution(counts: List<Int>): Boolean = counts.any { it > 0 }

    // ---- Record bar + bots line ------------------------------------------------------------------------------------
    data class RecordBar(val winFrac: Double, val lossFrac: Double, val empty: Boolean)

    fun recordBar(wins: Int, losses: Int): RecordBar {
        val t = wins + losses
        return if (t <= 0) RecordBar(0.0, 0.0, true) else RecordBar(wins.toDouble() / t, losses.toDouble() / t, false)
    }

    /** VS Bots in one line: "26–17 · 60%". */
    fun botsLine(wins: Int, losses: Int): String =
        if (wins + losses == 0) "Beat a bot to start" else "$wins–$losses · ${winRatePct(wins, losses)}%"

    // ---- Pocket games ----------------------------------------------------------------------------------------------
    data class PocketRecord(val wins: Int = 0, val losses: Int = 0, val draws: Int = 0) {
        val played: Boolean get() = wins + losses + draws > 0
    }

    data class PocketKindRecord(val kind: FriendlyKind, val record: PocketRecord, val bestChain: Int)
    data class PocketFriendRecord(val total: PocketRecord, val byKind: Map<FriendlyKind, PocketRecord>)
    data class PocketRecords(val byKind: List<PocketKindRecord>, val byFriend: Map<String, PocketFriendRecord>, val total: PocketRecord)

    /** A finished-game slice (a friendly_games row). [status]: active | done | resigned | expired. */
    data class PocketGameRow(val kind: FriendlyKind, val playerA: String, val playerB: String, val status: String, val winner: String?, val chainWords: Int = 0)

    val POCKET_ORDER = listOf(FriendlyKind.RPS, FriendlyKind.TTT, FriendlyKind.COIN, FriendlyKind.PASS, FriendlyKind.GHOST, FriendlyKind.CHAIN)

    private fun bump(r: PocketRecord, winner: String?, me: String): PocketRecord = when {
        winner == me -> r.copy(wins = r.wins + 1)
        winner != null -> r.copy(losses = r.losses + 1)
        else -> r.copy(draws = r.draws + 1)
    }

    /** Records for [me] from their finished pocket games (expired / unfinished games never count). */
    fun pocketRecords(rows: List<PocketGameRow>, me: String): PocketRecords {
        val kinds = POCKET_ORDER.associateWith { PocketKindRecord(it, PocketRecord(), 0) }.toMutableMap()
        val byFriend = HashMap<String, PocketFriendRecord>()
        var total = PocketRecord()
        for (g in rows) {
            if (g.status != "done" && g.status != "resigned") continue
            if (g.playerA != me && g.playerB != me) continue
            val opp = if (g.playerA == me) g.playerB else g.playerA
            val k = kinds.getValue(g.kind)
            val best = if (g.kind == FriendlyKind.CHAIN && g.winner == me && g.chainWords > k.bestChain) g.chainWords else k.bestChain
            kinds[g.kind] = PocketKindRecord(g.kind, bump(k.record, g.winner, me), best)
            val slot = byFriend[opp] ?: PocketFriendRecord(PocketRecord(), emptyMap())
            val ks = bump(slot.byKind[g.kind] ?: PocketRecord(), g.winner, me)
            byFriend[opp] = PocketFriendRecord(bump(slot.total, g.winner, me), slot.byKind + (g.kind to ks))
            total = bump(total, g.winner, me)
        }
        return PocketRecords(POCKET_ORDER.map { kinds.getValue(it) }, byFriend, total)
    }

    /** "3–1" / "3–1–1" with draws / "No games yet". */
    fun pocketLine(r: PocketRecord): String = when {
        !r.played -> "No games yet"
        r.draws > 0 -> "${r.wins}–${r.losses}–${r.draws}"
        else -> "${r.wins}–${r.losses}"
    }

    fun pocketTileLine(r: PocketKindRecord): String =
        if (r.kind == FriendlyKind.CHAIN && r.bestChain > 0) "${pocketLine(r.record)} · best ${r.bestChain}" else pocketLine(r.record)

    // ---- Player profile --------------------------------------------------------------------------------------------
    enum class FriendshipState { SELF, FRIENDS, INCOMING, REQUESTED, NONE }

    fun friendshipState(isSelf: Boolean, isFriend: Boolean, incoming: Boolean, requested: Boolean): FriendshipState = when {
        isSelf -> FriendshipState.SELF
        isFriend -> FriendshipState.FRIENDS
        incoming -> FriendshipState.INCOMING
        requested -> FriendshipState.REQUESTED
        else -> FriendshipState.NONE
    }

    enum class ProfileAction { CHALLENGE, POCKET, REACT, ADD_FRIEND, REQUESTED, ACCEPT, DECLINE }
    enum class ProfileMenuAction { UNFRIEND, BLOCK, REPORT }
    data class ProfileActions(val row: List<ProfileAction>, val menu: List<ProfileMenuAction>)

    /** Challenge · Pocket game · React for friends; a clear Add friend when not; Requested while pending; Accept / Decline when they asked you. */
    fun profileActions(state: FriendshipState): ProfileActions = when (state) {
        FriendshipState.SELF -> ProfileActions(emptyList(), emptyList())
        FriendshipState.FRIENDS -> ProfileActions(
            listOf(ProfileAction.CHALLENGE, ProfileAction.POCKET, ProfileAction.REACT),
            listOf(ProfileMenuAction.UNFRIEND, ProfileMenuAction.BLOCK, ProfileMenuAction.REPORT),
        )
        FriendshipState.INCOMING -> ProfileActions(listOf(ProfileAction.ACCEPT, ProfileAction.DECLINE), listOf(ProfileMenuAction.BLOCK, ProfileMenuAction.REPORT))
        FriendshipState.REQUESTED -> ProfileActions(listOf(ProfileAction.REQUESTED), listOf(ProfileMenuAction.BLOCK, ProfileMenuAction.REPORT))
        FriendshipState.NONE -> ProfileActions(listOf(ProfileAction.ADD_FRIEND), listOf(ProfileMenuAction.BLOCK, ProfileMenuAction.REPORT))
    }

    private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

    /** "Friends since Sep 2026" from an ISO time (UTC month), or null. */
    fun friendsSinceLine(iso: String?): String? {
        if (iso == null) return null
        val t = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
        val d = t.atZone(ZoneOffset.UTC)
        return "Friends since ${MONTHS[d.monthValue - 1]} ${d.year}"
    }

    data class HighlightsLayout(val fold: Boolean, val shown: Int)

    /** Under two highlights fold into Lately; two or more show as an even 2-column grid (odd last dropped), max four. */
    fun highlightsLayout(count: Int): HighlightsLayout {
        if (count < 2) return HighlightsLayout(true, count)
        val capped = minOf(count, 4)
        return HighlightsLayout(false, capped - (capped % 2))
    }

    /** "VS 3–1 · Pocket 2–2"; a side with no games is left out. */
    fun headToHeadLine(vs: PocketRecord, pocket: PocketRecord): String {
        val parts = ArrayList<String>()
        if (vs.played) parts.add("VS ${pocketLine(vs)}")
        if (pocket.played) parts.add("Pocket ${pocketLine(pocket)}")
        return if (parts.isEmpty()) "No games together yet" else parts.joinToString(" · ")
    }

    // ---- Section title colors (cast body colors) -------------------------------------------------------------------
    const val CAST_W = "#7c3aed"
    const val CAST_C = "#0d9488"
    const val CAST_I = "#16a34a"
    const val CAST_D = "#2563eb"
    const val CAST_S = "#f59e0b"
    const val CAST_R = "#64748b"
    const val CAST_O = "#f97316"

    val SECTION_TITLE_COLORS = mapOf(
        "MY GAMES" to CAST_W, "HEAD TO HEAD" to CAST_D, "BOTS" to CAST_C, "GUESSES" to CAST_I, "ACTIVITY" to CAST_O, "POCKET GAMES" to CAST_S,
        "MORE STATS" to CAST_R, "TROPHY CASE" to CAST_S, "HIGHLIGHTS" to CAST_O, "LATELY" to CAST_C, "VS" to CAST_D,
    )

    fun sectionTitleColor(title: String): String = SECTION_TITLE_COLORS[title.uppercase()] ?: CAST_W

    // ---- Go Pro scenes ---------------------------------------------------------------------------------------------
    enum class ProBenefit { UNLIMITED, ITEMS, VS_BOTS, STATS, NO_LIMITS }

    val PRO_BENEFIT_ORDER = listOf(ProBenefit.UNLIMITED, ProBenefit.ITEMS, ProBenefit.VS_BOTS, ProBenefit.STATS, ProBenefit.NO_LIMITS)

    /** The drawable names (art_pro_<name>); the pedestal is the free mascot's stage. */
    val PRO_SCENES = mapOf(
        ProBenefit.UNLIMITED to "art_pro_unlimited", ProBenefit.ITEMS to "art_pro_items", ProBenefit.VS_BOTS to "art_pro_vs_bots",
        ProBenefit.STATS to "art_pro_stats", ProBenefit.NO_LIMITS to "art_pro_no_limits",
    )
    const val PRO_PEDESTAL = "art_pro_stage_pedestal"
    val PRO_BENEFIT_CAPTION = mapOf(
        ProBenefit.UNLIMITED to "Every game, any time", ProBenefit.ITEMS to "Wear every Pro mascot item",
        ProBenefit.VS_BOTS to "VS on every game, bots included", ProBenefit.STATS to "Stats that go deeper", ProBenefit.NO_LIMITS to if (ADS_SERVING) "No limits. No ads." else "No limits. No waiting.",
    )

    fun proBenefitForReason(reason: String?): ProBenefit {
        val r = (reason ?: "").lowercase()
        return when {
            "mascot" in r || "item" in r || "style" in r || "dress" in r -> ProBenefit.ITEMS
            "unlimited" in r -> ProBenefit.UNLIMITED
            "bot" in r || "vs" in r || "versus" in r -> ProBenefit.VS_BOTS
            "stat" in r || "insight" in r || "trend" in r -> ProBenefit.STATS
            "no limit" in r || "ad-free" in r || "ads" in r -> ProBenefit.NO_LIMITS
            else -> ProBenefit.UNLIMITED
        }
    }
}
