package com.wordocious.app.ui.vs

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.SmartToy
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
import com.wordocious.app.ui.CappedFontScale
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.dashedBorder
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
 * The VS banner (VS overhaul §1, founder 2026-10-01): one window like the home
 * banner — a frosted strip with the core headline and clock line, a TODAY row
 * (Daily Battle + Bot of the Day tiles) and a RECORD row (people · bots ·
 * ladder, plus the bot win-streak flame). Teal by default, gold on a VS sweep,
 * one shimmer once either of today's battles is won. Words come from core
 * VsLobby so web and iOS print the same thing.
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
) {
    val gold = vsSweep(input.battle, input.botOfDay)
    val headline = vsBannerHeadline(input)
    val clockLine = vsBannerClockLine(input, clock, free = free, challengeLeft = challengeLeft)
    val headInk = if (gold) Color(0xFF78350F) else VsTeal.deep
    val subInk = if (gold) Color(0xFF92400E) else VsTeal.ink
    val shimmer = (input.battle == VsDayResult.WON || input.botOfDay == VsDayResult.WON) && !WTheme.reducedMotion
    val shape = RoundedCornerShape(16.dp)
    val bg = if (gold) listOf(Color(0xFFFDE68A), Color(0xFFFCD979)) else listOf(Color(0xFFD5F5EE), Color(0xFFE0F2FE))
    CappedFontScale {
        Column(
            Modifier.fillMaxWidth()
                .vsBannerGlow(gold)
                .clip(shape)
                .drawBehind {
                    drawRect(Brush.verticalGradient(bg))
                    drawRect(Brush.linearGradient(
                        0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                        start = Offset.Zero, end = Offset(size.width, size.height),
                    ))
                }
                .then(if (shimmer) Modifier.bannerShimmer() else Modifier),
        ) {
            Column(
                Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                    .padding(start = 12.dp, top = 12.dp, end = 8.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(Modifier.heightIn(min = 30.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (gold) Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(18.dp))
                    Text(headline, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, lineHeight = 1.2.em, color = headInk, maxLines = 2)
                }
                Text(clockLine, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = subInk)
            }
            // TODAY
            Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("TODAY", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = subInk)
                    Text(vsTodayStatus(input.battle, input.botOfDay), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = subInk)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TodayTile("DAILY BATTLE", battle, Modifier.weight(1f), onBattle) {
                        Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = it, modifier = Modifier.size(15.dp))
                    }
                    TodayTile("BOT OF THE DAY", botOfDay, Modifier.weight(1f), onBotOfDay) {
                        Icon(Icons.Filled.SmartToy, null, tint = it, modifier = Modifier.size(15.dp))
                    }
                }
            }
            // RECORD
            Row(
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("RECORD", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = subInk)
                Text(
                    recordLine, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = subInk,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                )
                if (botStreak > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        Image(painterResource(com.wordocious.app.R.drawable.ic_flame_gold), "Bot win streak", modifier = Modifier.size(12.dp))
                        Text("$botStreak", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFC2410C))
                    }
                }
            }
        }
    }
}

@Composable
private fun TodayTile(title: String, tile: VsTodayTile, modifier: Modifier, onClick: () -> Unit, icon: @Composable (Color) -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    val open = tile.result == VsDayResult.OPEN
    val won = tile.result == VsDayResult.WON
    val look = when {
        open -> Modifier.clip(shape).background(Color.White.copy(alpha = 0.85f)).dashedBorder(1.5.dp, VsTeal.ink.copy(alpha = 0.45f), 12.dp)
        won -> Modifier.shadow(5.dp, shape, ambientColor = VsTeal.ink.copy(alpha = 0.55f), spotColor = VsTeal.ink.copy(alpha = 0.55f)).clip(shape).background(VsTeal.ink)
        else -> Modifier.clip(shape).background(VsTeal.grey)
    }
    val ink = if (open) VsTeal.deep else Color.White
    Row(
        modifier.then(look).clickableNoRipple { if (open) onClick() }.padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier.size(26.dp).clip(RoundedCornerShape(7.dp)).background(if (open) VsTeal.soft else Color.White.copy(alpha = 0.22f)),
            Alignment.Center,
        ) { icon(if (open) VsTeal.ink else Color.White) }
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = ink, maxLines = 1)
            Text(tile.line, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = if (open) VsTeal.sub else Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
