package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.LeaderboardService
import com.wordocious.app.data.LeaderboardShare
import com.wordocious.app.data.MatchStatsService
import com.wordocious.app.data.ModeStats
import com.wordocious.app.data.ProfileService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * YOUR RECORDS, folded into the Stats tab (Stats + Friends redesign D2 step 3,
 * founder 2026-09-26: the Records tab goes "so long as the information expected
 * still populates elsewhere"). Every row the old Records → You view had lives
 * here, mirroring web components/stats/your-records.tsx: Next Up (shield +
 * record chases) and the Daily Sweeps window, Medals + Global Records held and
 * the Trophy Shelf on the All-time page; the per-game bests (Fastest Win ·
 * Fewest Guesses · Games Played · Win–Loss plus the records you hold in that
 * game and your closest chase) on each game page.
 *
 * The record table / formatters (RECORD_CFG, recordCfgFor) moved here from
 * RecordsScreen so both the global Hall of Fame and these cards read one table.
 */

// ── Record label/format/icon config (mirrors web RECORD_LABELS) ──────────────
internal data class RecordCfg(val label: String, val icon: ImageVector?, val crown: Boolean, val format: (Int) -> String)

internal val RECORD_CFG: Map<String, RecordCfg> = mapOf(
    "fastest_win" to RecordCfg("Fastest Win", Icons.Filled.Schedule, false) { v -> if (v < 60) "${v}s" else "${v / 60}m ${v % 60}s" },
    "fewest_guesses" to RecordCfg("Fewest Guesses", Icons.Filled.TrackChanges, false) { v -> "$v guesses" },
    "most_games_played" to RecordCfg("Most Games Played", Icons.Filled.Bolt, false) { v -> "$v games" },
    "longest_streak" to RecordCfg("Longest Streak", Icons.Filled.LocalFireDepartment, false) { v -> "$v wins" },
    "most_gold_medals" to RecordCfg("Most Gold Medals", null, true) { v -> "$v golds" },
    "highest_level" to RecordCfg("Highest Level", Icons.Filled.EmojiEvents, false) { v -> "Level $v" },
    "most_daily_completions" to RecordCfg("Most Dailies Completed", Icons.Filled.TrackChanges, false) { v -> "$v dailies" },
)

/**
 * The record config read through a mode's guess semantics (More Games §18):
 * "fewest_guesses" on Sudoku is "Fewest Mistakes · 0 mistakes", on Letter
 * Ladder "Best vs Par · Par", on Hubbub "Best Rank · Hubbub". Word modes (and
 * every other record type) keep RECORD_CFG untouched.
 */
internal fun recordCfgFor(type: String, gameMode: String?): RecordCfg? {
    val base = RECORD_CFG[type] ?: return null
    if (type != "fewest_guesses" || gameMode == null) return base
    val meta = com.wordocious.app.ModeGen.byDbKey(gameMode) ?: return base
    if (meta.guessSemantics == "guesses") return base
    return RecordCfg(ModeStats.fewestRecordLabel(meta.guessSemantics), base.icon, base.crown) { v ->
        formatGuessStat(meta.guessSemantics, meta.guessBase, v)
    }
}

// Streak shields are granted every 7 days (web /api/shields/grant-milestone
// MILESTONE_EVERY=7) — the "next shield" card counts toward the next multiple
// of 7, NOT the [7, 30, 100] streak MEDAL milestones.
internal const val SHIELD_EVERY = 7
// MODE_OPTIONS is the sweep picker only — a More Games record (ProperNoundle…) reads the catalog title.
internal fun recModeTitle(key: String) = MODE_OPTIONS.firstOrNull { it.first == key }?.second ?: modeTitleForKey(key)
internal fun fmtRecordSecs(v: Int) = if (v < 60) "${v}s" else "${v / 60}m ${v % 60}s"

private val GOLD = Color(0xFFD97706)

/** One beatable all-time record: label, gap copy, progress (record/mine %), the game it's in. */
data class RecordChase(val label: String, val gap: String, val pct: Int, val gameMode: String?)

/** The fetches the old Records → You view made, minus user_stats (the Stats page has them). */
data class YourRecordsData(
    val recordsHeld: List<LeaderboardService.AllTimeRecord> = emptyList(),
    /** EVERY beatable record, closest first — NextUpCard takes three, GameRecordsCard its game's first. */
    val chases: List<RecordChase> = emptyList(),
    val sweepRankToday: LeaderboardService.RankInfo? = null,
    val sweepRankAllTime: LeaderboardService.RankInfo? = null,
    val loading: Boolean = true,
)

/**
 * All-time records held + record chases + the sweep board ranks — one call from
 * ProfileScreen; re-keyed on the user and the size of the user_stats list (the
 * chases read your own bests). Mirrors web `useYourRecords`.
 */
@Composable
fun rememberYourRecords(userId: String?, statsRows: List<ProfileService.UserStat>): YourRecordsData {
    var data by remember { mutableStateOf(YourRecordsData()) }
    LaunchedEffect(userId, statsRows.size) {
        if (userId == null) { data = data.copy(loading = false); return@LaunchedEffect }
        val s = statsRows
        val (recs, rankToday, rankAllTime) = coroutineScope {
            val recsD = async { LeaderboardService.fetchAllTimeRecords() }
            val todayD = async { LeaderboardService.getUserSweepRank(userId) }
            val allD = async { LeaderboardService.getUserAllTimeSweepRank(userId) }
            Triple(recsD.await(), todayD.await(), allD.await())
        }
        // One shelf row per (record type, mode): all_time_records keeps a
        // separate row per play_type ('solo' and 'vs'), and listing both made
        // e.g. "Six · Most Games Played" appear twice — the 54-game solo
        // record next to a 1-game VS record. Prefer the solo row, same rule as
        // the All-Time per-mode grid. Also drives the Global Records count, so
        // held solo+vs pairs no longer double-count. (iOS/web parity.)
        val heldByKey = LinkedHashMap<String, LeaderboardService.AllTimeRecord>()
        for (r in recs) {
            if (r.holderId != userId) continue
            val key = "${r.recordType}|${r.gameMode ?: "global"}"
            val existing = heldByKey[key]
            if (existing == null || (existing.playType != "solo" && r.playType == "solo")) heldByKey[key] = r
        }
        // Record Chase: EVERY beatable all-time record with your gap, sorted by
        // how close you are (relative gap). Lower-is-better types only.
        // Ports the web loop in your-records.tsx exactly.
        data class Cand(val chase: RecordChase, val rel: Double)
        val all = ArrayList<Cand>()
        for (r in recs) {
            if (r.holderId == userId || r.gameMode == null || r.playType != "solo") continue
            val mine = s.find { it.gameMode == r.gameMode && it.playType == "solo" } ?: continue
            val ft = mine.fastestTime ?: 0
            val bs = mine.bestScore ?: 0.0
            if (r.recordType == "fastest_win" && ft > 0 && ft.toDouble() > r.recordValue) {
                val gap = ft - r.recordValue
                all.add(Cand(RecordChase(
                    label = "${recModeTitle(r.gameMode!!)} fastest win",
                    gap = "${gap.toInt()}s away",
                    pct = Math.round(r.recordValue / ft * 100).toInt(),
                    gameMode = r.gameMode,
                ), gap / maxOf(1.0, r.recordValue)))
            } else if (r.recordType == "fewest_guesses" && bs > 0 && bs > r.recordValue) {
                val gap = bs - r.recordValue
                all.add(Cand(RecordChase(
                    label = "${recModeTitle(r.gameMode!!)} ${(recordCfgFor("fewest_guesses", r.gameMode)?.label ?: "Fewest Guesses").lowercase()}",
                    gap = "${gap.toInt()} away",
                    pct = Math.round(r.recordValue / bs * 100).toInt(),
                    gameMode = r.gameMode,
                ), gap / maxOf(1.0, r.recordValue)))
            }
        }
        data = YourRecordsData(
            recordsHeld = heldByKey.values.toList(),
            chases = all.sortedBy { it.rel }.map { it.chase },
            sweepRankToday = rankToday,
            sweepRankAllTime = rankAllTime,
            loading = false,
        )
    }
    return data
}

// ── The cards ────────────────────────────────────────────────────────────────

/** Next Up — the next streak shield and your three closest record chases. */
@Composable
fun NextUpCard(dailyStreak: Int, chases: List<RecordChase>) {
    val nextShield = (dailyStreak / SHIELD_EVERY + 1) * SHIELD_EVERY
    val top = chases.take(3)
    CardShell(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))) {
        Text("NEXT UP", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.LocalFireDepartment, null, tint = Color(0xFFF97316), modifier = Modifier.size(14.dp))
            Spacer(Modifier.size(4.dp))
            Text("$nextShield-day streak shield", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Spacer(Modifier.weight(1f))
            Text("$dailyStreak/$nextShield", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
        }
        Spacer(Modifier.height(4.dp))
        Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
            Box(
                Modifier.fillMaxWidth((dailyStreak.toFloat() / nextShield).coerceIn(0f, 1f)).height(8.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Brush.horizontalGradient(listOf(Color(0xFFF97316), Color(0xFFFBBF24)))),
            )
        }
        top.forEach { c ->
            Spacer(Modifier.height(8.dp))
            ChaseLine(c, WTheme.primary, Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED))))
        }
    }
}

/** "You're <gap> from the <label> record" + its progress bar. */
@Composable
private fun ChaseLine(c: RecordChase, iconTint: Color, barBrush: Brush) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(Icons.Filled.TrendingUp, null, tint = iconTint, modifier = Modifier.size(14.dp))
        Row(Modifier.weight(1f)) {
            Text("You're ", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
            Text(c.gap, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
            Text(
                " from the ${c.label} record", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                color = WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
    Spacer(Modifier.height(2.dp))
    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
        Box(
            Modifier.fillMaxWidth((c.pct / 100f).coerceIn(0f, 1f)).height(6.dp)
                .clip(RoundedCornerShape(50)).background(barBrush),
        )
    }
}

/** Daily Sweeps — count, flawless, streak, best time, today's + all-time board ranks. */
@Composable
fun SweepRecordsCard(
    sweep: MatchStatsService.DailySweepStats,
    sweepRankToday: LeaderboardService.RankInfo?,
    sweepRankAllTime: LeaderboardService.RankInfo?,
) {
    CardShell(Brush.horizontalGradient(listOf(SWEEP_ACCENT, SWEEP_ACCENT.copy(alpha = 0.53f)))) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ModeIconBox(SWEEP_ID, SWEEP_ACCENT)
            Text("Daily Sweeps", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        }
        Spacer(Modifier.height(2.dp))
        if (sweep.hasData) {
            Row(Modifier.fillMaxWidth()) {
                Box(Modifier.weight(1f)) { MeCell(Icons.Filled.AutoAwesome, "${sweep.sweepCount}", "Daily Sweeps", Color(0xFF7C3AED)) }
                Box(Modifier.weight(1f)) { MeCell(Icons.Filled.EmojiEvents, "${sweep.flawlessCount}", "Flawless Victories", GOLD) }
            }
            Row(Modifier.fillMaxWidth()) {
                Box(Modifier.weight(1f)) { MeCell(Icons.Filled.LocalFireDepartment, "${sweep.currentSweepStreak}", "Current Sweep Streak", Color(0xFFF97316)) }
                Box(Modifier.weight(1f)) { MeCell(Icons.Filled.Schedule, if (sweep.bestSweepSecs > 0) fmtRecordSecs(sweep.bestSweepSecs) else "—", "Best Sweep Time", Color(0xFF2563EB), dim = sweep.bestSweepSecs == 0) }
            }
            // Sweep leaderboard standing — today's daily board + all-time
            // (getUserSweepRank / getUserAllTimeSweepRank).
            if (sweepRankToday != null || sweepRankAllTime != null || sweep.currentFlawlessStreak > 0) {
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(painterResource(R.drawable.ic_broom), null, tint = SWEEP_ACCENT, modifier = Modifier.size(13.dp))
                    sweepRankToday?.let { r ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("Today", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            Text("#${r.rank}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = GOLD)
                            Text("of ${r.totalPlayers}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                    }
                    sweepRankAllTime?.let { r ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("All-Time", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            Text("#${r.rank}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = GOLD)
                            Text("of ${r.totalPlayers}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                    }
                    // §244: the flawless-streak notation rides the same row.
                    if (sweep.currentFlawlessStreak > 0) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("🏆 Flawless", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            Text("×${sweep.currentFlawlessStreak}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = GOLD)
                            if (sweep.bestFlawlessStreak > sweep.currentFlawlessStreak) {
                                Text("· best ${sweep.bestFlawlessStreak}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            }
                        }
                    }
                }
            }
        } else {
            Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.5f), modifier = Modifier.size(28.dp))
                Spacer(Modifier.height(8.dp))
                Text("No sweeps yet", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

/**
 * One game's personal bests (the old Records → You "bests by mode" card for
 * this game) + the all-time records you hold in it + your closest chase.
 * `my` is the user_stats SOLO row for the game.
 */
@Composable
fun GameRecordsCard(
    dbKey: String,
    my: ProfileService.UserStat?,
    recordsHeld: List<LeaderboardService.AllTimeRecord>,
    chases: List<RecordChase>,
) {
    val accent = pickerGameModeOrNull(dbKey)?.let { modeAccent(it) } ?: WTheme.primary
    val held = recordsHeld.filter { it.gameMode == dbKey }
    val chase = chases.firstOrNull { it.gameMode == dbKey }
    CardShell(Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.53f)))) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Your Records", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Spacer(Modifier.weight(1f))
            if (held.isNotEmpty()) {
                Row(
                    Modifier.clip(RoundedCornerShape(50)).background(WTheme.highlightGold).padding(horizontal = 8.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(painterResource(R.drawable.ic_crown), null, tint = GOLD, modifier = Modifier.size(11.dp))
                    Text("${held.size} all-time record${if (held.size == 1) "" else "s"}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = GOLD)
                }
            }
        }
        Spacer(Modifier.height(2.dp))
        Row(Modifier.fillMaxWidth()) {
            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.Schedule, if ((my?.fastestTime ?: 0) > 0) fmtRecordSecs(my!!.fastestTime!!) else "—", "Fastest Win", accent, dim = (my?.fastestTime ?: 0) == 0) }
            // Through the mode's guess semantics (More Games §18): Sudoku reads "Fewest Mistakes · 0 mistakes".
            val fewestCfg = recordCfgFor("fewest_guesses", dbKey)
            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.TrackChanges, if ((my?.bestScore ?: 0.0) > 0) (fewestCfg?.format?.invoke(my!!.bestScore!!.toInt()) ?: "${my!!.bestScore!!.toInt()} guesses") else "—", fewestCfg?.label ?: "Fewest Guesses", accent, dim = (my?.bestScore ?: 0.0) == 0.0) }
        }
        Row(Modifier.fillMaxWidth()) {
            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.Bolt, if (my != null) "${my.totalGames} games" else "—", "Games Played", accent, dim = my == null) }
            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.EmojiEvents, if (my != null) "${my.wins}–${my.losses}" else "—", "Win–Loss", accent, dim = my == null) }
        }
        if (held.isNotEmpty() || chase != null) {
            Spacer(Modifier.height(6.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
            held.forEach { r ->
                val cfg = recordCfgFor(r.recordType, dbKey)
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(painterResource(R.drawable.ic_crown), null, tint = GOLD, modifier = Modifier.size(14.dp))
                    Row(Modifier.weight(1f)) {
                        Text("You hold the all-time ", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
                        Text(cfg?.label ?: r.recordType, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
                        Text(" record", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(
                        cfg?.format?.invoke(r.recordValue.toInt()) ?: "${r.recordValue.toInt()}",
                        fontSize = 11.sp, fontWeight = FontWeight.Black, color = GOLD,
                    )
                }
            }
            chase?.let { c ->
                Spacer(Modifier.height(8.dp))
                ChaseLine(c, accent, Brush.horizontalGradient(listOf(accent.copy(alpha = 0.53f), accent)))
            }
        }
    }
}

/** Medals tally + count of global records held, side by side; the records tile opens the Hall of Fame. */
@Composable
fun RecordsHeldRow(recordsHeld: List<LeaderboardService.AllTimeRecord>, onOpenRecords: () -> Unit = {}) {
    val profile by AuthService.profile.collectAsState()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(
            Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
        ) {
            Text("MEDALS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MedalCount(R.drawable.ic_crown, GOLD, profile?.goldMedals ?: 0)
                MedalCount(Icons.Filled.MilitaryTech, Color(0xFF9CA3AF), profile?.silverMedals ?: 0)
                MedalCount(Icons.Filled.MilitaryTech, Color(0xFFB45309), profile?.bronzeMedals ?: 0)
            }
            Spacer(Modifier.height(4.dp))
            Text("Daily top-3 finishes", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Column(
            Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                .clickableNoRipple(onOpenRecords).padding(14.dp),
        ) {
            Text("GLOBAL RECORDS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
            Spacer(Modifier.height(2.dp))
            // Star icon + 13sp count (iOS Label(…, systemImage: "star.fill")),
            // so this card doesn't outweigh the MEDALS card beside it.
            val starTint = if (recordsHeld.isEmpty()) WTheme.textMuted else GOLD
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Icon(Icons.Filled.Star, null, tint = starTint, modifier = Modifier.size(14.dp))
                Text("${recordsHeld.size}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = starTint)
            }
            Text("all-time record${if (recordsHeld.size == 1) "" else "s"} held", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            // The door to the global Hall of Fame (RecordsScreen) now that the RECORDS row is gone.
            Text("Hall of Fame →", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED))
        }
    }
}

/**
 * Trophy shelf (§245, founder: "it is an eyesore as it sits today") — marquee
 * jewels up top (most impressive records, auto-picked), then type-grouped
 * shelves of mode-accented glyph tiles; the repeated record label becomes the
 * shelf header, said once (web parity). Renders nothing with no records held.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TrophyShelf(recordsHeld: List<LeaderboardService.AllTimeRecord>) {
    if (recordsHeld.isEmpty()) return
    val marquee = remember(recordsHeld) {
        fun bestOf(type: String) = recordsHeld
            .filter { it.recordType == type && it.gameMode != null }
            .minByOrNull { it.recordValue }
        listOfNotNull(bestOf("fastest_win"), bestOf("fewest_guesses"))
    }
    val marqueeKeys = marquee.map { "${it.recordType}|${it.gameMode}" }.toSet()
    val shelfOrder = listOf("fastest_win", "fewest_guesses", "longest_streak", "most_games_played",
        "most_gold_medals", "highest_level", "most_daily_completions")
    val groups = shelfOrder
        .map { t -> t to recordsHeld.filter { it.recordType == t && "${it.recordType}|${it.gameMode}" !in marqueeKeys } }
        .filter { it.second.isNotEmpty() }
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var sharingShelf by remember { mutableStateOf(false) }
    CardShell(Brush.horizontalGradient(listOf(Color(0xFFFBBF24), GOLD))) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("YOUR TROPHY SHELF", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
            Spacer(Modifier.weight(1f))
            Icon(
                Icons.Filled.Share, "Share trophy shelf",
                tint = WTheme.textMuted.copy(alpha = if (sharingShelf) 0.4f else 1f),
                modifier = Modifier.size(15.dp).clickableNoRipple {
                    if (!sharingShelf) {
                        sharingShelf = true
                        scope.launch {
                            try {
                                LeaderboardShare.shareTrophyCaseCard(ctx, recordsHeld, AuthService.profile.value?.username)
                            } finally { sharingShelf = false }
                        }
                    }
                },
            )
        }
        Spacer(Modifier.height(6.dp))
        // Marquee jewels — the records worth a plinth of their own.
        marquee.forEach { r ->
            val cfg = recordCfgFor(r.recordType, r.gameMode)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFFFFBEB), Color(0xFFFEF3C7))))
                    .border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                TrophyGlyphBox(r.gameMode, 40.dp)
                Column(Modifier.weight(1f)) {
                    Text(
                        "${r.gameMode?.let { recModeTitle(it) } ?: "Global"} · ${cfg?.label ?: r.recordType}".uppercase(),
                        fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFF92400E),
                        letterSpacing = 0.6.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        cfg?.format?.invoke(r.recordValue.toInt()) ?: "${r.recordValue.toInt()}",
                        fontSize = 22.sp, fontWeight = FontWeight.Black, color = GOLD,
                    )
                }
                heldSince(r.achievedAt)?.let { since ->
                    Column(horizontalAlignment = Alignment.End) {
                        Text("held since", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB45309))
                        Text(since, fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFFB45309))
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
        }
        // Type-grouped shelves.
        groups.forEach { (type, rows) ->
            val cfg = RECORD_CFG[type]
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (cfg?.crown == true) {
                    Icon(painterResource(R.drawable.ic_crown), null, tint = GOLD, modifier = Modifier.size(11.dp))
                } else {
                    Icon(cfg?.icon ?: Icons.Filled.Star, null, tint = GOLD, modifier = Modifier.size(11.dp))
                }
                Text((cfg?.label ?: type).uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.7.sp)
            }
            Spacer(Modifier.height(4.dp))
            // Wrapping tile row — FlowRow keeps the shelf dense.
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                rows.forEach { r ->
                    val accent = r.gameMode?.let { gm -> pickerGameModeOrNull(gm)?.let { modeAccent(it) } } ?: GOLD
                    Row(
                        Modifier.clip(RoundedCornerShape(9.dp)).background(WTheme.bg)
                            .padding(horizontal = 6.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        TrophyGlyphBox(r.gameMode, 20.dp)
                        Text(
                            recordCfgFor(type, r.gameMode)?.format?.invoke(r.recordValue.toInt()) ?: "${r.recordValue.toInt()}",
                            fontSize = 11.sp, fontWeight = FontWeight.Black, color = accent,
                        )
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFFDE68A).copy(alpha = 0.33f)))
            Spacer(Modifier.height(6.dp))
        }
    }
}

// ── Shared chrome ────────────────────────────────────────────────────────────

/** §245: mode glyph in an accent-tinted box; global records get a gold star. */
@Composable
internal fun TrophyGlyphBox(gameMode: String?, box: Dp) {
    val engine = gameMode?.let { pickerGameModeOrNull(it) }
    val accent = engine?.let { modeAccent(it) } ?: GOLD
    Box(
        Modifier.size(box).clip(RoundedCornerShape(box * 0.27f)).background(accent.copy(alpha = 0.08f)),
        contentAlignment = Alignment.Center,
    ) {
        if (engine != null) ModeGlyph(engine, accent, box = box)
        else Icon(Icons.Filled.Star, null, tint = accent, modifier = Modifier.size(box * 0.5f))
    }
}

/** §245: "Aug 12" from an ISO timestamp — the marquee card's "held since". */
internal fun heldSince(iso: String?): String? {
    if (iso == null) return null
    return runCatching {
        val inst = runCatching { java.time.OffsetDateTime.parse(iso).toInstant() }
            .recoverCatching { java.time.Instant.parse(iso) }.getOrThrow()
        java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)
            .withZone(java.time.ZoneId.systemDefault()).format(inst)
    }.getOrNull()
}

/** Bordered surface card with a 3dp gradient bar on top and 14dp inner padding. */
@Composable
internal fun CardShell(barBrush: Brush, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))) {
        Box(Modifier.fillMaxWidth().height(3.dp).background(barBrush))
        Column(Modifier.padding(14.dp), content = content)
    }
}

/** Centered icon-over-value-over-label tile (iOS `meCell`) — dimmed when there is none yet. */
@Composable
internal fun MeCell(
    icon: ImageVector,
    value: String,
    label: String,
    color: Color,
    dim: Boolean = false,
) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(icon, null, tint = if (dim) WTheme.textMuted else color, modifier = Modifier.size(16.dp))
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (dim) WTheme.textMuted else WTheme.text, maxLines = 1)
        Text(
            label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            textAlign = TextAlign.Center, maxLines = 2,
        )
    }
}

@Composable
internal fun MedalCount(res: Int, tint: Color, n: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(painterResource(res), null, tint = tint, modifier = Modifier.size(14.dp))
        Text("$n", fontSize = 13.sp, fontWeight = FontWeight.Black, color = tint)
    }
}

/** Vector-icon medal tally — iOS uses a medal glyph for silver/bronze, a crown for gold. */
@Composable
internal fun MedalCount(icon: ImageVector, tint: Color, n: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(14.dp))
        Text("$n", fontSize = 13.sp, fontWeight = FontWeight.Black, color = tint)
    }
}
