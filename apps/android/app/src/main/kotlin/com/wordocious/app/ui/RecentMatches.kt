package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.width
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.data.ProfileService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode

// Recent games — one row per match (solo and VS, daily and unlimited alike),
// newest first: the mode's icon, the stat through the mode's semantics, the
// time, the opponent, Win/Loss, date and time. Founder (2026-09-26): the same
// rows sit on the Today page ("the most recent games played, even the
// unlimited games") capped at five with "See all N in All-time →", and on
// All-time as the full list with View all / Show less. Android twin of web
// components/stats/recent-matches.tsx.

/**
 * The list. [limit] rows show before the expander; with [onSeeAll] set (Today)
 * the tail is a "See all N in All-time →" link instead of expanding in place.
 * Skeleton rows while [loading]; "No games played yet." when empty — the
 * section never just vanishes.
 */
@Composable
fun RecentMatchesList(
    matches: List<ProfileService.RecentMatch>,
    opponentNames: Map<String, String>,
    userId: String?,
    loading: Boolean,
    limit: Int = 5,
    onSeeAll: (() -> Unit)? = null,
    /** Empty-state line (Today: "No games yet today…"). */
    emptyText: String = "No games played yet.",
    /** A scene above [emptyText] (Stats: D's no-stats scene, ART_SPEC §7); null keeps the plain line. */
    emptyScene: SceneArt? = null,
) {
    var showAll by remember { mutableStateOf(false) }
    if (loading) {
        Column { repeat(minOf(5, limit)) { SkeletonBlock(height = 52.dp, cornerRadius = 12.dp); Spacer(Modifier.height(8.dp)) } }
        return
    }
    if (matches.isEmpty()) {
        if (emptyScene != null) {
            // A1 / A7: a tinted card with a cast pose (not D, the Stats host).
            StatsEmptyState(StatsPoses.noGames, emptyText, swatch = StatsInk.BLUE, title = "NO MATCHES YET")
            return
        }
        Text(
            emptyText, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            color = WTheme.textMuted,
            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
            textAlign = TextAlign.Center,
        )
        return
    }
    val shown = if (showAll && onSeeAll == null) matches else matches.take(limit)
    // A1 + C2: the rows sit in ONE tinted card (the page's blue, its top bar) as soft stripes.
    MatchesCard {
        shown.forEachIndexed { i, m ->
            key(m.id) { RecentMatchRow(m, userId, opponentName = opponentOf(m, userId, opponentNames), index = i) }
        }
    }
    if (matches.size > limit) {
        Box(Modifier.fillMaxWidth().padding(top = 2.dp), contentAlignment = Alignment.Center) {
            if (onSeeAll != null) {
                CandyButton(
                    "See all ${matches.size} in All-time", onSeeAll,
                    color = CandyColor.PEACH, size = CandySize.SMALL, icon = CandyIcon.ARROW,
                )
            } else {
                CandyButton(
                    if (showAll) "Show less" else "View all ${matches.size}", { showAll = !showAll },
                    color = CandyColor.PEACH, size = CandySize.SMALL,
                )
            }
        }
    }
}

/** The one tinted card the match rows stripe inside (no padding: the stripes run edge to edge). */
@Composable
private fun MatchesCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    StatsCard(
        StatsInk.BLUE, bar = androidx.compose.ui.graphics.SolidColor(StatsInk.accent), barHeight = 8.dp, corner = 18.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
        verticalArrangement = Arrangement.Top, content = content,
    )
}

// ── Recent match row (web parity: icon box + Solo/VS pill + guesses·time + Win/Loss + date) ──
@Composable
internal fun RecentMatchRow(m: ProfileService.RecentMatch, userId: String?, opponentName: String? = null, index: Int = 0) {
    val isPlayer1 = m.player1Id == userId
    val isVs = m.player2Id != null
    val won = m.winnerId == userId
    val score = ((if (isPlayer1) m.player1Score else m.player2Score) ?: 0.0).toInt()
    val timeSec = ((if (isPlayer1) m.player1Time else m.player2Time) ?: 0.0).toInt()
    val mode = remember(m.gameMode) { runCatching { GameMode.valueOf(m.gameMode) }.getOrNull() }
    val card = remember(m.gameMode) { modeCardForKey(m.gameMode) }
    val accent = card?.accent ?: mode?.let { modeAccent(it) } ?: WTheme.primary
    val date = remember(m.createdAt) { fmtMatchDate(m.createdAt) }
    val dark = WTheme.isDark
    Row(
        Modifier.fillMaxWidth().stripedRow(index, StatsInk.accent).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MatchIcon(card, mode, accent)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    modeLabel(m.gameMode), fontSize = 13.sp, fontWeight = FontWeight.Black,
                    color = if (dark) WTheme.text else FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                val chip = if (isVs) Color(0xFF7C3AED) else Color(0xFF2563EB)
                Text(
                    if (isVs) "VS" else "Solo", fontSize = 9.sp, fontWeight = FontWeight.Black,
                    color = if (dark) chip else darkenInk(chip),
                    modifier = Modifier.clip(RoundedCornerShape(5.dp))
                        .background(if (dark) chip.copy(alpha = 0.18f) else Wash.mix(chip, 0.16f)).padding(horizontal = 6.dp, vertical = 2.dp),
                )
                // Web parity: amber "FORFEIT" chip when this row was a forfeit win.
                if (m.forfeit == true) {
                    Text(
                        "FORFEIT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFFB45309),
                        modifier = Modifier.clip(RoundedCornerShape(5.dp))
                            .background(Color(0xFFFEF3C7)).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            // Through the mode's guess semantics (More Games §11): Sudoku reads "0 mistakes".
            val meta = com.wordocious.app.ModeGen.byDbKey(m.gameMode)
            Text(
                "${formatGuessStat(meta?.guessSemantics ?: "guesses", meta?.guessBase ?: 1, score)} · ${if (timeSec > 0) fmtMatchTime(timeSec) else "—"}" +
                    // Web parity: "· vs <username>" on VS rows.
                    if (isVs && opponentName != null) " · vs $opponentName" else "",
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (dark) WTheme.textMuted else FinishInk.muted,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        // C2a: the W / L badge in its own column, left of the right-aligned date.
        ResultBadgeColumn(won)
        Text(
            date, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (dark) WTheme.textMuted else FinishInk.muted,
            textAlign = TextAlign.End, maxLines = 2, modifier = Modifier.width(64.dp),
        )
    }
}

/** A row's game icon as a mini game card (A1): the game art, else its glyph. */
@Composable
private fun MatchIcon(card: ModeCard?, mode: GameMode?, accent: Color) {
    Box(Modifier.size(36.dp).miniGameCard(accent, 10.dp), Alignment.Center) {
        val art = gameArtRes(card?.id)
        if (art != null) Image(painterResource(art), null, Modifier.size(26.dp).padding(top = 2.dp))
        else mode?.let { ModeGlyph(it, accent, box = 32.dp) }
    }
}

private fun opponentOf(m: ProfileService.RecentMatch, userId: String?, names: Map<String, String>): String? {
    val oppId = if (m.player2Id == null) null else if (m.player1Id == userId) m.player2Id else m.player1Id
    return oppId?.let { names[it] ?: "Unknown" }
}

// ── Today's Games (founder, 2026-09-29) ──────────────────────────────────────
// Dailies and VS games keep one row each; a game mode's Unlimited solo games fold
// into ONE summary row ("Starsweep Unlimited · 34 played · 31 wins · best 1:12")
// at the position of its newest game, tapping open to the games beneath. A group
// of one is a normal row. Free players' Unlimited games are left out entirely.

internal sealed interface TodayRow { val key: String }
internal data class TodaySingle(val m: ProfileService.RecentMatch) : TodayRow { override val key: String get() = m.id }
internal data class TodayUnlimited(val mode: String, val games: List<ProfileService.RecentMatch>, val wins: Int, val bestSeconds: Int?) : TodayRow {
    override val key: String get() = "unlimited:$mode"
}

/** Solo and known-Unlimited — the only rows that fold. VS and dailies (or unknown) stay individual. */
private fun ProfileService.RecentMatch.isGroupable() = player2Id == null && isDaily == false

/** The Today list, built once per source list (each stamp parsed once, here, not per recomposition). */
internal fun todayRows(
    matches: List<ProfileService.RecentMatch>, userId: String?, showUnlimited: Boolean,
    zone: java.time.ZoneId = java.time.ZoneId.systemDefault(), today: java.time.LocalDate = java.time.LocalDate.now(zone),
): List<TodayRow> {
    val order = ArrayList<Any>()   // a match, or a mode key standing for its group
    val groups = HashMap<String, MutableList<ProfileService.RecentMatch>>()
    for (m in matches) {
        if (!playedOn(m.createdAt, zone, today)) continue
        if (!m.isGroupable()) { order.add(m); continue }
        if (!showUnlimited) continue
        groups.getOrPut(m.gameMode) { order.add(m.gameMode); ArrayList() }.add(m)
    }
    return order.map { o ->
        if (o is ProfileService.RecentMatch) TodaySingle(o)
        else groups.getValue(o as String).let { g ->
            if (g.size == 1) TodaySingle(g[0])
            else {
                val won = g.filter { it.winnerId != null && it.winnerId == userId }
                val best = won.mapNotNull { (if (it.player1Id == userId) it.player1Time else it.player2Time)?.toInt()?.takeIf { t -> t > 0 } }.minOrNull()
                TodayUnlimited(o, g, won.size, best)
            }
        }
    }
}

/** Whether a Supabase `created_at` stamp (UTC ISO-8601, microseconds, "+00:00") falls on [day]
 *  in [zone]. Parses the first 19 characters as UTC. */
private fun playedOn(createdAt: String, zone: java.time.ZoneId, day: java.time.LocalDate): Boolean = runCatching {
    java.time.LocalDateTime.parse(createdAt.take(19)).atOffset(java.time.ZoneOffset.UTC).atZoneSameInstant(zone).toLocalDate() == day
}.getOrDefault(false)

@Composable
fun TodayGamesList(
    matches: List<ProfileService.RecentMatch>, opponentNames: Map<String, String>, userId: String?,
    loading: Boolean, showUnlimited: Boolean,
    /** A scene for the empty state (Stats: D's no-stats scene, ART_SPEC §7). */
    emptyScene: SceneArt? = null,
    emptyText: String = "No games yet today — play a daily to start the list.",
) {
    val today = java.time.LocalDate.now()
    val rows = remember(matches, userId, showUnlimited, today) { todayRows(matches, userId, showUnlimited, today = today) }
    var open by remember { mutableStateOf(emptySet<String>()) }
    if (loading) {
        Column { repeat(3) { SkeletonBlock(height = 52.dp, cornerRadius = 12.dp); Spacer(Modifier.height(8.dp)) } }
        return
    }
    if (rows.isEmpty()) {
        if (emptyScene != null) {
            // A1 / A7: a tinted card with a cast pose (not D, the Stats host).
            StatsEmptyState(StatsPoses.noGames, emptyText, swatch = StatsInk.BLUE, title = "NO GAMES TODAY")
            return
        }
        Text(
            emptyText, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            color = WTheme.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
        )
        return
    }
    MatchesCard {
        rows.forEachIndexed { i, r ->
            key(r.key) {
                when (r) {
                    is TodaySingle -> RecentMatchRow(r.m, userId, opponentName = opponentOf(r.m, userId, opponentNames), index = i)
                    is TodayUnlimited -> {
                        val expanded = r.mode in open
                        UnlimitedGroupRow(r, expanded, i) { open = if (expanded) open - r.mode else open + r.mode }
                        if (expanded) Column(Modifier.padding(start = 16.dp)) {
                            r.games.forEachIndexed { j, m -> key(m.id) { RecentMatchRow(m, userId, index = i + 1 + j) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UnlimitedGroupRow(g: TodayUnlimited, expanded: Boolean, index: Int, onToggle: () -> Unit) {
    val mode = remember(g.mode) { runCatching { GameMode.valueOf(g.mode) }.getOrNull() }
    val card = remember(g.mode) { modeCardForKey(g.mode) }
    val accent = card?.accent ?: mode?.let { modeAccent(it) } ?: WTheme.primary
    val line = "${g.games.size} played · ${g.wins} win${if (g.wins == 1) "" else "s"}" + (g.bestSeconds?.let { " · best ${it / 60}:${"%02d".format(it % 60)}" } ?: "")
    val dark = WTheme.isDark
    Row(
        Modifier.fillMaxWidth()
            .squishClickable("${modeLabel(g.mode)} Unlimited, $line. ${if (expanded) "Hide games" else "Show games"}", onClick = onToggle)
            .stripedRow(index, StatsInk.accent).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MatchIcon(card, mode, accent)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("${modeLabel(g.mode)} Unlimited", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.text else FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(line, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (dark) WTheme.textMuted else FinishInk.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(
            Icons.Filled.KeyboardArrowDown, null, tint = if (dark) WTheme.textMuted else darkenInk(StatsInk.accent),
            modifier = Modifier.size(20.dp).rotate(if (expanded) 180f else 0f),
        )
    }
}

private fun fmtMatchTime(s: Int): String = if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"

/** "Jun 8 · 3:56 PM" in local time (web toLocaleDateString + toLocaleTimeString). */
private fun fmtMatchDate(iso: String): String {
    val millis = runCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
        .recoverCatching { java.time.Instant.parse(if (iso.endsWith("Z")) iso else "${iso}Z").toEpochMilli() }
        .getOrNull() ?: return iso.take(10)
    return java.text.SimpleDateFormat("MMM d · h:mm a", java.util.Locale.US)
        .apply { timeZone = java.util.TimeZone.getDefault() }.format(java.util.Date(millis))
}

/** The mode's display title for a matches.game_mode key (VS-only keys included). */
internal fun modeLabel(mode: String) = when (mode) {
    "DUEL" -> "Classic"; "QUORDLE" -> "QuadWord"; "OCTORDLE" -> "OctoWord"
    "SEQUENCE" -> "Succession"; "RESCUE" -> "Deliverance"
    "DUEL_6" -> "Six"; "DUEL_7" -> "Seven"
    "GAUNTLET" -> "Gauntlet"; "PROPERNOUNDLE" -> "ProperNoundle"
    else -> com.wordocious.app.ModeGen.byDbKey(mode)?.title ?: mode
}
