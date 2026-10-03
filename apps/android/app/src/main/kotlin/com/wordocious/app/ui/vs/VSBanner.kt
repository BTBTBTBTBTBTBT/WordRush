package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.BANNER_HOST_CLEAR
import com.wordocious.app.ui.BANNER_HOST_PEEK
import com.wordocious.app.ui.BannerHost
import com.wordocious.app.ui.CappedFontScale
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.miniGameCard
import com.wordocious.app.ui.squishClickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.semantics.semantics
import com.wordocious.core.BotCast
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.VsBannerInput
import com.wordocious.core.VsDayResult
import com.wordocious.core.vsBannerClockLine
import com.wordocious.core.vsBannerHeadline
import com.wordocious.core.vsSweep
import com.wordocious.core.vsTodayStatus

/** One TODAY tile: its result and the line under the title. */
data class VsTodayTile(val result: VsDayResult, val line: String)

/**
 * The VS banner (VS overhaul §1, founder 2026-10-01; FINISH_SPEC D3): one tinted
 * window (A1) — the teal wash with its top bar, the core headline and clock line, a
 * TODAY row (Daily Battle + Bot of the Day tiles; the Bot of the Day tile shows the
 * day's bot as its character) and a RECORD row in soft numbers (A2) plus the bot
 * win-streak flame. Gold on a VS sweep, one shimmer once either of today's battles is
 * won. Words come from core VsLobby so web and iOS print the same thing.
 */
@Composable
fun VsBannerView(
    input: VsBannerInput,
    free: Boolean,
    /** HH:MM:SS to the next UTC midnight. */
    clock: String,
    /** Hours left on the newest open incoming challenge ("17H"). */
    challengeLeft: String?,
    battle: VsTodayTile,
    botOfDay: VsTodayTile,
    recordLine: String,
    botStreak: Int,
    onBattle: () -> Unit,
    onBotOfDay: () -> Unit,
    /** Today's Bot of the Day (core BotCast.botOfTheDay), drawn as its character on its tile. */
    botOfDayId: String = BotCast.botOfTheDay(com.wordocious.app.data.CpuProgressionStore.todayUtc()).id,
    /** The lobby hero art across the top of the window (W vs S face-off); null = the peeking host instead. */
    heroArt: Int? = com.wordocious.app.R.drawable.art_scene_vs_faceoff,
) {
    val gold = vsSweep(input.battle, input.botOfDay)
    val headline = vsBannerHeadline(input)
    val clockLine = vsBannerClockLine(input, clock, free = free, challengeLeft = challengeLeft)
    val accent = if (gold) VS_GOLD_ACCENT else VS_ACCENT
    val headInk = if (gold) Color(0xFF78350F) else VsTeal.deep
    val subInk = if (gold) Color(0xFF92400E) else VsTeal.ink
    val shimmer = (input.battle == VsDayResult.WON || input.botOfDay == VsDayResult.WON) && !WTheme.reducedMotion
    val botMascot = vsBotMascot(botOfDayId)
    // A7: the banner's host (S) never doubles the day's bot drawn on its tile.
    val host = if (botMascot == Mascots.vs) vsSpareCast(botMascot, preferred = listOf(MascotId.O1, MascotId.C)) else Mascots.vs
    CappedFontScale {
        // The host peeks over the window's top edge (only without the hero art: the
        // face-off already stars the cast, A7).
        Box(Modifier.fillMaxWidth().padding(top = if (heroArt == null) BANNER_HOST_PEEK else 0.dp)) {
        VsTintedCard(
            Modifier.fillMaxWidth().then(if (gold) Modifier.vsBannerGlow(true) else Modifier)
                .then(if (shimmer) Modifier.clip(RoundedCornerShape(18.dp)).bannerShimmer() else Modifier),
            accent = accent, corner = 18.dp, barHeight = 10.dp,
            contentPadding = PaddingValues(0.dp), verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            if (heroArt != null) {
                androidx.compose.foundation.Image(
                    com.wordocious.app.ui.artPainter(heroArt, androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp), contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                    // BJ7: the faceoff capped at 124 tall (was the full-width aspect, ~190).
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(116.dp).clearAndSetSemantics { },
                )
            }
            Column(
                Modifier.fillMaxWidth().background(vsWash(accent, 0.20f))
                    .padding(start = 12.dp, top = 10.dp, end = 8.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(Modifier.heightIn(min = 30.dp).padding(end = if (heroArt == null) BANNER_HOST_CLEAR else 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (gold) com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, 22.dp)
                    // AR: the VS status headline in the live lettering (teal → blue; gold on a gold day).
                    com.wordocious.app.ui.LiveHeadline(
                        headline,
                        if (gold) com.wordocious.app.ui.HeadlinePalette.CELEBRATION else com.wordocious.app.ui.HeadlinePalette.VS,
                        Modifier.weight(1f), maxSize = 17.sp, minSize = 12.sp, align = androidx.compose.ui.text.style.TextAlign.Start,
                    )
                }
                Text(clockLine, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = subInk, modifier = Modifier.padding(end = 4.dp))
            }
            // TODAY
            Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    VsCapsLabel("TODAY", color = subInk)
                    VsNumber(vsTodayStatus(input.battle, input.botOfDay), 11.sp)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TodayTile("DAILY BATTLE", battle, Modifier.weight(1f), onBattle) {
                        Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsTeal.ink, modifier = Modifier.size(16.dp))
                    }
                    TodayTile("BOT OF THE DAY", botOfDay, Modifier.weight(1f), onBotOfDay, art = true) {
                        if (botMascot != null) VsCastPose(botMascot, "ready", 40.dp)
                    }
                }
            }
            // RECORD (A2: the numbers soft)
            Row(
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 10.dp)
                    .semantics(mergeDescendants = true) { contentDescription = "Record: " + recordLine.lowercase() },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                VsCapsLabel("RECORD", color = subInk)
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                    vsRecordParts(recordLine).forEach { (label, value) ->
                        Row(
                            Modifier.vsPill(accent, 10.dp).padding(start = 6.dp, end = 6.dp, top = 6.dp, bottom = 3.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            VsCapsLabel(label, color = subInk, fontSize = 8.5.sp)
                            if (value.any { it.isDigit() }) VsNumber(value, 12.sp) else if (value.isNotEmpty()) VsCapsLabel(value, color = subInk, fontSize = 8.5.sp)
                        }
                    }
                }
                if (botStreak > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, 16.dp, contentDescription = "Bot win streak")
                        VsNumber("$botStreak", 14.sp)
                    }
                }
            }
        }
        if (heroArt == null) BannerHost(host, Modifier.align(Alignment.TopEnd))
        }
    }
}

/**
 * One TODAY tile: a mini game card (A1). Open = the teal wash + top bar; won = the
 * stronger tint + ring and a W mark; lost / draw = a quiet gray wash. Squishes (A9).
 */
@Composable
private fun TodayTile(title: String, tile: VsTodayTile, modifier: Modifier, onClick: () -> Unit, art: Boolean = false, icon: @Composable () -> Unit) {
    val open = tile.result == VsDayResult.OPEN
    val won = tile.result == VsDayResult.WON
    val accent = when {
        open || won -> VS_ACCENT
        else -> Color(0xFF94A3B8)
    }
    Box(modifier) {
        Row(
            Modifier.fillMaxWidth()
                .squishClickable("$title, ${tile.line}", enabled = open) { if (open) onClick() }
                .miniGameCard(accent, 12.dp, selected = won)
                .padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 6.dp),
            // BJ7: icon + title top-aligned, the line 4 under the title.
            verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (art) Box(Modifier.size(40.dp), Alignment.Center) { icon() }
            else VsIconSquare(accent) { icon() }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                VsCapsLabel(title, color = vsInk(accent), fontSize = 9.5.sp)
                Text(tile.line, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        when (tile.result) {
            VsDayResult.WON -> VsCornerMark("W", VS_ACCENT, Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp))
            VsDayResult.LOST -> VsCornerMark("L", Color(0xFF64748B), Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp))
            VsDayResult.DRAW -> VsCornerMark("=", Color(0xFF64748B), Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp))
            VsDayResult.OPEN -> {}
        }
    }
}

/** Soft violet shadow normally; on a VS sweep a gold glow all around (0 0 26 rgba(245,158,11,0.8)). */
private fun Modifier.vsBannerGlow(gold: Boolean): Modifier = drawBehind {
    val blur = (if (gold) 26.dp else 14.dp).toPx()
    val dy = if (gold) 0f else 4.dp.toPx()
    val color = if (gold) Color(0xFFF59E0B).copy(alpha = 0.8f) else Color(0xFF4C1D95).copy(alpha = 0.08f)
    val r = 16.dp.toPx()
    drawIntoCanvas { canvas ->
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color.toArgb()
            maskFilter = android.graphics.BlurMaskFilter(blur / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
        }
        canvas.nativeCanvas.drawRoundRect(0f, dy, size.width, size.height + dy, r, r, paint)
    }
}

/**
 * The RECORD line's parts for the soft-number pills (pure, unit-tested): core
 * vsRecordLine "PEOPLE 12–7 · BOTS 31–9 · LADDER 2/10" → (PEOPLE, 12–7), (BOTS, 31–9),
 * (LADDER, 2/10); "LADDER CLEARED" → (LADDER, CLEARED). A part without a space is all label.
 */
fun vsRecordParts(line: String): List<Pair<String, String>> =
    line.split(" · ").filter { it.isNotBlank() }.map { part ->
        val p = part.trim()
        if (' ' in p) p.substringBeforeLast(' ') to p.substringAfterLast(' ') else p to ""
    }
