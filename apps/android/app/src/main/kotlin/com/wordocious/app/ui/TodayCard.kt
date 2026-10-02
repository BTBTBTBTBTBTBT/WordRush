package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.StatsDeepService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode

/**
 * The Stats tab's landing page — "your day in one card" (Stats + Friends
 * redesign D2, founder 2026-09-26; finishing build C3, 2026-10-02): a soft blue card
 * (#eaf2ff / #cfe0ff, the #0a6cff → #60a5fa bar) with "TODAY · OCT 2" + the soft
 * "5 / 8", the eight sweep games as mini game cards each wearing today's W / L badge,
 * then three tinted pills — magenta PUZZLES "N of 10", teal VS BATTLE, gold STANDING
 * "Top X%" (the leaderboard's (better+1)/total — the ONE formula, via
 * StatsDeepService.todayDailyStanding) — and the Puzzles as tiny tiles. Under it the
 * gold sweep-streak tile and the pink best-moment tile. Sweep / Flawless days keep the
 * moment lettering (the §244 footer is passed in). Free tier throughout. Twin of web
 * components/stats/today-card.tsx and iOS TodayCard.
 */

/** Today's best moment, structured: [big] the soft headline ("Perfect" / "1:12"), [small]
 *  the line under it, [text] the one-line form, [key] the game's db key. */
data class BestMoment(val big: String, val small: String, val text: String, val key: String)

/** The single best thing that happened today: a perfect game first, else the
 *  fastest win. Pure over today's completions — no fetch. */
fun bestMomentParts(todayDailies: Map<String, DailyCompletionsService.Completion>): BestMoment? {
    data class Perfect(val key: String, val title: String, val n: Int, val noun: String, val semantics: String)
    data class Fastest(val key: String, val title: String, val secs: Int)
    var perfect: Perfect? = null
    var fastest: Fastest? = null
    // Catalog order so two equal candidates resolve the same way every time.
    for (meta in ModeGen.daily) {
        val key = meta.dbKey ?: continue
        val r = todayDailies[key] ?: continue
        if (!r.completed) continue
        if (r.guessCount <= meta.guessBase && perfect == null) {
            val noun = com.wordocious.app.data.ModeStats.guessNoun(meta.guessSemantics)
            perfect = Perfect(key, meta.title, r.guessCount, if (r.guessCount == 1) noun.one else noun.many, meta.guessSemantics)
        }
        if (r.timeSeconds > 0 && (fastest == null || r.timeSeconds < fastest.secs)) fastest = Fastest(key, meta.title, r.timeSeconds)
    }
    perfect?.let { p ->
        val detail = if (p.semantics == "guesses") " in ${p.n} ${p.noun}" else ""
        return BestMoment("Perfect", "${p.title}$detail", "Perfect ${p.title}$detail", p.key)
    }
    fastest?.let { f ->
        val t = fmtMomentTime(f.secs)
        return BestMoment(t, "Fastest win · ${f.title}", "Fastest win: ${f.title} in $t", f.key)
    }
    return null
}

/** The one-line form of [bestMomentParts]: (text, dbKey). */
fun bestMomentToday(todayDailies: Map<String, DailyCompletionsService.Completion>): Pair<String, String>? =
    bestMomentParts(todayDailies)?.let { it.text to it.key }

/** "2:45" / "45s" — web today-card fmtTime. */
private fun fmtMomentTime(s: Int): String {
    val m = s / 60
    val r = s % 60
    return if (m > 0) "$m:${r.toString().padStart(2, '0')}" else "${r}s"
}

/** The three day pills' accents (C3). */
private val PUZZLES_MAGENTA = Color(0xFFC026D3)
private val VS_TEAL = Color(0xFF0D9488)
private val STANDING_GOLD = Color(0xFFF5A524)

@Composable
fun TodayCard(
    /** The sweep set's dbKeys, canonical order. */
    sweepModes: List<String>,
    /** The More Games titles this viewer can see (daily-eligible, flag on). */
    moreModes: List<ModeCard>,
    todayDailies: Map<String, DailyCompletionsService.Completion>,
    vsDailyWon: Boolean?,
    standing: StatsDeepService.DailyStanding?,
    sweepStreak: Int,
    flawlessStreak: Int,
    /** The Puzzles row's runs (founder, 2026-10-01 stats audit; the home banner shows them too). */
    puzzleStreaks: com.wordocious.core.DayStreaks = com.wordocious.core.DayStreaks(0, 0),
    /** Rendered under the tiles on a Flawless day (the §244 streak + share footer). */
    flawlessFooter: @Composable () -> Unit,
    onPlayDaily: (GameMode) -> Unit,
    onJump: (String) -> Unit,
) {
    val completed = sweepModes.count { todayDailies.containsKey(it) }
    val wins = sweepModes.count { todayDailies[it]?.completed == true }
    val total = sweepModes.size
    val allDone = total > 0 && completed >= total
    val flawless = allDone && wins == total
    val moreDaily = moreModes.filter { it.dailyEligible && it.dbKey != null }
    val morePlayed = moreDaily.count { todayDailies.containsKey(it.dbKey!!) }
    val moment = bestMomentParts(todayDailies)
    val dateLabel = java.text.SimpleDateFormat("MMM d", java.util.Locale.US).format(java.util.Date())

    // Soft blue on a regular day; a Flawless day turns gold and a Sweep day lavender (the
    // old card's celebration, now as tinted swatches).
    val swatch = when {
        flawless -> StatsInk.GOLD
        allDone -> StatsInk.LAVENDER
        else -> StatsInk.BLUE
    }
    val bar = when {
        flawless -> Brush.horizontalGradient(listOf(Color(0xFFF59E0B), Color(0xFFFFD66B)))
        allDone -> StatsInk.playerBar
        else -> StatsInk.todayBar
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatsCard(swatch, bar = bar) {
            if (allDone) {
                // Moment lettering (ART_SPEC §6): FLAWLESS! / SWEEP!, read as the full title.
                MomentTitle(
                    if (flawless) MomentArt.FLAWLESS else MomentArt.SWEEP,
                    widthFraction = 0.6f, maxHeight = 40.dp,
                    contentDescription = if (flawless) "Flawless victory!" else "Daily sweep!",
                )
            } else {
                StatsCardLabel(
                    "TODAY · ${dateLabel.uppercase()}", swatch,
                    Modifier.semantics(mergeDescendants = true) { contentDescription = "Today, $completed of $total dailies played" },
                ) {
                    SoftNumber("$completed / $total", 15.sp, color = if (WTheme.isDark) null else swatch.ink)
                }
            }

            // The eight sweep games as mini game cards with today's W / L — tap plays (or reopens) that daily.
            Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                sweepModes.forEach { id -> SweepTile(id, todayDailies[id], Modifier.weight(1f), onPlayDaily) }
            }

            if (allDone) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    if (flawless) flawlessFooter()
                    else Text(
                        "All $total dailies completed · +200 XP earned",
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = darkSafe(Color(0xFF6D28D9), DarkInk.violet),
                    )
                }
            }

            // The rest of the day: Puzzles, VS, where you stand ("Puzzles", founder 2026-10-01).
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Min).padding(top = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TodayPill(
                    label = "Puzzles", value = if (moreDaily.isNotEmpty()) "$morePlayed of ${moreDaily.size}" else "—",
                    color = PUZZLES_MAGENTA, modifier = Modifier.weight(1f).fillMaxHeight(),
                    onClick = { onJump(moreDaily.firstOrNull()?.dbKey ?: RAIL_TODAY) },
                )
                TodayPill(
                    label = "VS Battle", value = when (vsDailyWon) { null -> "—"; true -> "W"; false -> "L" },
                    color = VS_TEAL, modifier = Modifier.weight(1f).fillMaxHeight(),
                    onClick = { onJump(RAIL_VS) },
                )
                TodayPill(
                    label = "Standing", value = standing?.let { "Top ${it.topPercent}%" } ?: "—",
                    color = STANDING_GOLD, modifier = Modifier.weight(1f).fillMaxHeight(),
                    onClick = null,
                )
            }

            // The ten Puzzles as tiny tiles, so the day reads at a glance.
            if (moreDaily.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
                ) {
                    moreDaily.forEach { c ->
                        val r = todayDailies[c.dbKey!!]
                        val done = r != null
                        val shape = RoundedCornerShape(6.dp)
                        val title = ModeGen.byDbKey(c.dbKey)?.shortTitle ?: c.title
                        Box(
                            Modifier.size(22.dp)
                                .squishClickable(
                                    "$title, ${when { r == null -> "not played today"; r.completed -> "won today"; else -> "lost today" }}",
                                ) { onJump(c.dbKey) }
                                .then(
                                    if (!done) Modifier.miniGameCard(c.accent, 6.dp)
                                    else Modifier.clip(shape).background(if (r!!.completed) c.accent else RAIL_LOSS_RED),
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            ModeGlyph(c, if (done) Color.White else c.accent, box = 22.dp)
                        }
                    }
                }
            }
        }

        // The sweep streaks (gold) + the best thing that happened today (pink).
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatsTile(
                StatsInk.GOLD, StatLabels.sweepStreak, "$sweepStreak",
                Modifier.weight(1f).fillMaxHeight(),
                icon = Icon3DName.FLAME,
                sub = "${if (sweepStreak == 1) "day" else "days"}${if (flawlessStreak >= 1) " · $flawlessStreak flawless" else ""}",
                trailing = {
                    // Wordocious above, then Puzzles: the same two runs the home banner shows
                    // (founder, 2026-10-01 stats audit).
                    Text(
                        "Puzzles: ${puzzleStreaks.sweep} ${if (puzzleStreaks.sweep == 1) "day" else "days"}" +
                            if (puzzleStreaks.flawless >= 2) " · ${puzzleStreaks.flawless} flawless" else "",
                        fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        color = if (WTheme.isDark) WTheme.textMuted else StatsInk.GOLD.ink,
                    )
                },
            )
            StatsTile(
                StatsInk.PINK, "Best moment", moment?.big ?: "—",
                Modifier.weight(1f).fillMaxHeight(),
                icon = Icon3DName.CROWN,
                sub = moment?.small ?: "Play a daily to start your day",
                onClick = moment?.let { m -> { onJump(m.key) } },
            )
        }
    }
}

/** One of the three day pills (A1 `.pill`): the accent wash with its 4 dp top band, the soft
 *  value (A2) over the caps label in the accent's ink. Tappable ones squish (A9). */
@Composable
private fun TodayPill(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier,
    onClick: (() -> Unit)?,
) {
    Column(
        modifier
            .then(if (onClick != null) Modifier.squishClickable("$label: $value", onClick = onClick) else Modifier.semantics(mergeDescendants = true) { contentDescription = "$label: $value" })
            .tintedPill(color)
            .padding(start = 6.dp, end = 6.dp, top = 9.dp, bottom = 7.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
    ) {
        SoftNumber(value, 18.sp)
        Text(
            label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em,
            color = if (WTheme.isDark) WTheme.textSecondary else darkenInk(color), maxLines = 1, textAlign = TextAlign.Center,
        )
    }
}

/** One sweep tile: the game as a mini game card (its icon on its tint, A1) with today's
 *  W / L badge top-end once played; unplayed tiles sit a touch softer. Tap plays the daily. */
@Composable
fun SweepTile(modeId: String, completion: DailyCompletionsService.Completion?, modifier: Modifier = Modifier, onPlayDaily: (GameMode) -> Unit) {
    val played = completion != null
    val won = completion?.completed == true
    val mode = runCatching { GameMode.valueOf(modeId) }.getOrNull()
    val card = modeCardForKey(modeId)
    val accent = card?.accent ?: mode?.let { modeAccent(it) } ?: WTheme.primary
    val title = ModeGen.byDbKey(modeId)?.shortTitle ?: modeId
    val art = gameArtRes(card?.id)
    val state = when { !played -> "not played today"; won -> "won today"; else -> "lost today" }
    Box(
        modifier.aspectRatio(1f)
            .then(
                if (mode != null) Modifier.squishClickable("$title, $state") { onPlayDaily(mode) }
                else Modifier.semantics(mergeDescendants = true) { contentDescription = "$title, $state" },
            ),
    ) {
        Box(
            Modifier.fillMaxSize().miniGameCard(accent, 11.dp).alpha(if (played) 1f else 0.82f),
            contentAlignment = Alignment.Center,
        ) {
            if (art != null) {
                Image(painterResource(art), contentDescription = null, modifier = Modifier.fillMaxSize(0.72f).padding(top = 2.dp))
            } else if (card != null) {
                BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    ModeGlyph(card, accent, box = maxWidth * 0.7f)
                }
            } else if (mode != null) {
                BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    ModeGlyph(mode, accent, box = maxWidth * 0.7f)
                }
            }
        }
        if (played) {
            ResultBadge(won, 16.dp, Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp))
        }
    }
}
