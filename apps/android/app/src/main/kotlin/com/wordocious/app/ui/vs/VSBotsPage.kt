package com.wordocious.app.ui.vs

import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.pageBackground
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.BotPersonas
import com.wordocious.app.data.CpuKind
import com.wordocious.app.data.CpuProgressionStore
import com.wordocious.app.data.MatchStatsService
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.core.BotLadderState
import com.wordocious.core.GameMode
import com.wordocious.core.RungState
import com.wordocious.core.VsDayResult
import com.wordocious.core.ladderRungs
import com.wordocious.core.vsClock

private val ORANGE = Color(0xFFC2410C)

/**
 * The Bots page (VS overhaul §8, founder 2026-10-01): the Bot of the Day
 * (free once per UTC day — Classic for free players), THE LADDER (Rook →
 * Lexi → Nova → Adapt, three wins in a row clear a rung; core ladderRungs),
 * and Beat your best (a ghost of your best winning run in this mode). Free
 * players see the ladder and the ghost locked, routed to the Pro page.
 */
@Composable
fun VsBotsPage(
    mode: GameMode,
    isPro: Boolean,
    onBack: () -> Unit,
    onPlay: (GameMode, VsLaunch.Bot) -> Unit,
    onGoPro: () -> Unit,
) {
    val playMode = if (isPro) mode else GameMode.DUEL
    val prog = remember { CpuProgressionStore.load() }
    val today = remember { CpuProgressionStore.todayUtc() }
    var best by remember { mutableStateOf<Pair<Int, Double>?>(null) }
    LaunchedEffect(playMode) {
        AuthService.userId?.let { best = MatchStatsService.ghostBestRun(it, playMode.name) }
    }
    Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        VsNavBar("BOTS", onBack = onBack) { VsModeChip(playMode) }
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BotOfTheDayCard(prog.botOfDayToday(today), prog.botOfDayStreak) {
                onPlay(playMode, VsLaunch.Bot(CpuKind.DAILY))
            }

            // THE LADDER
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                VsSectionLabel("THE LADDER", Modifier.weight(1f))
                Text("STREAK ${prog.streak} · BEST ${prog.bestStreak}", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color(0xFFEA580C))
            }
            val rungs = ladderRungs(BotLadderState(prog.ladderCleared, prog.ladderRun))
            Column {
                rungs.forEachIndexed { i, rung ->
                    LadderRow(rung.id, rung.state, rung.line, locked = !isPro) {
                        if (!isPro) onGoPro()
                        else if (rung.state != RungState.LOCKED) onPlay(playMode, VsLaunch.Bot(CpuKind.forLadder(rung.id)))
                    }
                    if (i < rungs.size - 1) {
                        // Teal up to the next rung, grey after it.
                        val reached = i < prog.ladderCleared
                        Row { Spacer(Modifier.width(29.dp)); VsLadderLine(if (reached) VsTeal.ink else Color(0xFFE5E7EB), 12.dp) }
                    }
                }
            }

            // BEAT YOUR BEST
            best?.let { (g, t) ->
                Row(
                    Modifier.fillMaxWidth().vsCard().clickableNoRipple {
                        if (isPro) onPlay(playMode, VsLaunch.Bot(CpuKind.GHOST, ghostGuesses = g, ghostTimeMs = t)) else onGoPro()
                    }.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    BotAvatar("ghost", 40.dp, bg = Color(0xFFF1F5F9))
                    Column(Modifier.weight(1f)) {
                        Text("Beat your best", fontSize = 14.sp, fontWeight = FontWeight.Black, color = VsTeal.deep)
                        Text("Your best ${vsModeName(playMode)}: $g guesses · ${vsClock(t.toLong())}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                    }
                    if (isPro) VsSoftPill("Race it") { onPlay(playMode, VsLaunch.Bot(CpuKind.GHOST, ghostGuesses = g, ghostTimeMs = t)) }
                    else VsLock()
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BotOfTheDayCard(today: VsDayResult, streak: Int, onPlay: () -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
            .clip(RoundedCornerShape(16.dp)).background(Brush.verticalGradient(listOf(Color(0xFFD5F5EE), Color(0xFFE0F2FE)))),
    ) {
        Column(Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f)).padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text("BOT OF THE DAY · LEXI", fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.deep)
            Text("SAME BOT, SAME PUZZLE FOR EVERYONE", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsTeal.ink)
        }
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            BotAvatar("lexi", 48.dp, bg = Color.White)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(BotPersonas.tierLine("lexi"), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep)
                if (streak > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, 14.dp)
                        Text("$streak ${if (streak == 1) "day" else "days"} in a row", fontSize = 11.sp, fontWeight = FontWeight.Black, color = ORANGE)
                    }
                }
            }
            when (today) {
                VsDayResult.OPEN -> VsTealButton("PLAY", onClick = onPlay)
                VsDayResult.WON -> Text("Beat Lexi", fontSize = 12.sp, fontWeight = FontWeight.Black, color = VsTeal.ink)
                VsDayResult.LOST -> Text("Lost to Lexi", fontSize = 12.sp, fontWeight = FontWeight.Black, color = VsTeal.grey)
                VsDayResult.DRAW -> Text("Draw with Lexi", fontSize = 12.sp, fontWeight = FontWeight.Black, color = VsTeal.grey)
            }
        }
    }
}

@Composable
private fun LadderRow(id: String, state: RungState, line: String, locked: Boolean, onClick: () -> Unit) {
    val next = state == RungState.NEXT
    val cleared = state == RungState.CLEARED
    val rowMod = if (next) Modifier.vsCard().border(2.dp, VsTeal.ink, RoundedCornerShape(14.dp)) else Modifier
    Row(
        Modifier.fillMaxWidth().then(rowMod).alpha(if (state == RungState.LOCKED) 0.55f else 1f)
            .clickableNoRipple(onClick).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val ring = when { cleared -> VsTeal.ink; next -> Color(0xFF7C3AED); else -> Color.Transparent }
        val bg = when { cleared -> VsTeal.soft; next -> Color(0xFFEDE9FE); else -> Color(0xFFE5E7EB) }
        val glow = if (next) Modifier.shadow(6.dp, CircleShape, ambientColor = Color(0xFF7C3AED), spotColor = Color(0xFF7C3AED)) else Modifier
        Box(glow.size(36.dp).clip(CircleShape).border(2.dp, ring, CircleShape)) { BotAvatar(id, 36.dp, bg = bg) }
        Column(Modifier.weight(1f)) {
            Text("${BotPersonas.name(id)} · ${BotPersonas.tierWord(id)}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = VsTeal.deep)
            Text(line, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
        }
        if (locked) VsLock()
        val (tag, color) = when (state) {
            RungState.CLEARED -> "CLEARED" to VsTeal.ink
            RungState.NEXT -> "NEXT" to ORANGE
            RungState.LOCKED -> "LOCKED" to VsTeal.grey
        }
        Text(tag, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = color)
    }
}
