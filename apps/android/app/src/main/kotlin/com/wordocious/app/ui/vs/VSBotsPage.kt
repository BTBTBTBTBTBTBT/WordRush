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
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandyIcon
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.squishClickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import com.wordocious.core.BotCast
import com.wordocious.core.BotLadderState
import com.wordocious.core.GameMode
import com.wordocious.core.RungState
import com.wordocious.core.VsDayResult
import com.wordocious.core.ladderRungs
import com.wordocious.core.vsClock

private val ORANGE = Color(0xFFC2410C)

/**
 * The Bots page (VS overhaul §8, founder 2026-10-01; FINISH_SPEC D1–D3): the Bot of
 * the Day (the day host's bot, free once per UTC day — Classic for free players) as
 * its character, THE LADDER (the ten cast bots Rip → Webster, three wins in a row
 * clear a rung; core ladderRungs) as tinted rungs with each bot's character, Webster
 * crowned as the boss, and Beat your best — Your Ghost, the player's own faded letter
 * tile. Free players see the ladder and the ghost locked, routed to the Pro page.
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
    val botOfDay = remember(today) { BotCast.botOfTheDay(today) }
    val rungsTotal = com.wordocious.core.VsLobby.LADDER_BOTS.size
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
            BotOfTheDayCard(botOfDay.id, prog.botOfDayToday(today), prog.botOfDayStreak) {
                onPlay(playMode, VsLaunch.Bot(CpuKind.DAILY, castId = botOfDay.id))
            }

            // THE LADDER
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                VsSectionLabel("THE LADDER", Modifier.weight(1f))
                Row(
                    Modifier.vsPill(ORANGE, 50.dp).padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 3.dp)
                        .semantics(mergeDescendants = true) { contentDescription = "Streak ${prog.streak}, best ${prog.bestStreak}" },
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, 14.dp)
                    VsCapsLabel("STREAK", color = ORANGE, fontSize = 9.sp)
                    VsNumber("${prog.streak}", 13.sp)
                    VsCapsLabel("· BEST", color = ORANGE, fontSize = 9.sp)
                    VsNumber("${prog.bestStreak}", 13.sp)
                }
            }
            // The whole ladder cleared: the celebration art + the ladder trophy on top.
            if (prog.ladderCleared >= rungsTotal) {
                VsTintedCard(Modifier.fillMaxWidth(), accent = VS_GOLD_ACCENT, corner = 18.dp, contentPadding = PaddingValues(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        androidx.compose.foundation.Image(
                            androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.art_scene_ladder_cleared), contentDescription = null,
                            modifier = Modifier.size(84.dp).clearAndSetSemantics { },
                        )
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                LadderTrophy(26.dp)
                                Text("LADDER CLEARED!", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F), modifier = Modifier.semantics { heading() })
                            }
                            Text("You beat all ten bots. Webster’s still up for a rematch any time.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FinishInk.muted)
                        }
                    }
                }
            }
            val rungs = ladderRungs(BotLadderState(prog.ladderCleared, prog.ladderRun))
            Column {
                rungs.forEachIndexed { i, rung ->
                    LadderRow(i + 1, rung.id, rung.state, rung.line, locked = !isPro, boss = i == rungs.size - 1) {
                        if (!isPro) onGoPro()
                        else if (rung.state != RungState.LOCKED) onPlay(playMode, VsLaunch.Bot(CpuKind.forLadder(rung.id), castId = rung.id))
                    }
                    if (i < rungs.size - 1) {
                        // Teal up to the next rung, a soft gray after it.
                        val reached = i < prog.ladderCleared
                        Row { Spacer(Modifier.width(38.dp)); VsLadderLine(if (reached) VS_ACCENT else vsLine(Color(0xFF94A3B8)), 12.dp) }
                    }
                }
            }

            // BEAT YOUR BEST — Your Ghost (the player's own faded letter tile).
            best?.let { (g, t) ->
                val race = { if (isPro) onPlay(playMode, VsLaunch.Bot(CpuKind.GHOST, ghostGuesses = g, ghostTimeMs = t)) else onGoPro() }
                Row(
                    Modifier.fillMaxWidth()
                        .squishClickable("Beat your best. Your best ${vsModeName(playMode)}: $g guesses, ${vsClock(t.toLong())}" + if (isPro) "" else ". Pro", onClick = race)
                        .vsRow(VsPurple.ink, 16.dp).padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    VsGhostTile(40.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Your Ghost · Beat your best", fontSize = 14.sp, fontWeight = FontWeight.Black, color = FinishInk.heading)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Best ${vsModeName(playMode)}:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                            VsNumber("$g", 13.sp)
                            Text("guesses ·", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                            VsNumber(vsClock(t.toLong()), 13.sp)
                        }
                    }
                    if (isPro) VsSoftPill("RACE IT", color = CandyColor.PURPLE, onClick = race)
                    else VsLock()
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/**
 * The Bot of the Day (FINISH_SPEC D2): the day host's bot in its "ready" pose on a
 * tinted card with its top bar, "BOT OF THE DAY · <NAME>", its tier line, the streak
 * in soft numbers, and PLAY (teal candy) or today's result naming the bot.
 */
@Composable
private fun BotOfTheDayCard(botId: String, today: VsDayResult, streak: Int, onPlay: () -> Unit) {
    val name = BotPersonas.name(botId)
    val mascot = vsBotMascot(botId)
    VsTintedCard(
        Modifier.fillMaxWidth(), corner = 18.dp, barHeight = 10.dp,
        contentPadding = PaddingValues(0.dp), verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        Column(Modifier.fillMaxWidth().background(vsWash(VS_ACCENT, 0.20f)).padding(horizontal = 12.dp, vertical = 9.dp)) {
            Text(
                "BOT OF THE DAY · ${name.uppercase()}", fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                color = VsTeal.deep, modifier = Modifier.semantics { heading() },
            )
            VsCapsLabel("SAME BOT, SAME PUZZLE FOR EVERYONE", color = VsTeal.ink, fontSize = 9.5.sp)
        }
        Row(
            Modifier.fillMaxWidth().padding(start = 6.dp, end = 12.dp, top = 6.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (mascot != null) VsCastPose(mascot, "ready", 72.dp) else BotAvatar(botId, 52.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(BotPersonas.tierLine(botId), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep)
                if (streak > 0) {
                    Row(
                        Modifier.semantics(mergeDescendants = true) { contentDescription = "$streak ${if (streak == 1) "day" else "days"} in a row" },
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, 16.dp)
                        VsNumber("$streak", 15.sp)
                        Text(if (streak == 1) "day in a row" else "days in a row", fontSize = 11.sp, fontWeight = FontWeight.Black, color = ORANGE)
                    }
                }
            }
            when (today) {
                VsDayResult.OPEN -> VsTealButton("PLAY", icon = CandyIcon.PLAY, onClick = onPlay)
                VsDayResult.WON -> ResultChip("Beat $name", VS_ACCENT)
                VsDayResult.LOST -> ResultChip("Lost to $name", Color(0xFF64748B))
                VsDayResult.DRAW -> ResultChip("Draw with $name", Color(0xFF64748B))
            }
        }
    }
}

@Composable
private fun ResultChip(text: String, accent: Color) {
    Text(
        text, fontSize = 11.sp, fontWeight = FontWeight.Black, color = vsInk(accent), maxLines = 1,
        modifier = Modifier.vsPill(accent, 50.dp).padding(start = 10.dp, end = 10.dp, top = 7.dp, bottom = 4.dp),
    )
}

/**
 * One rung (FINISH_SPEC D1/D3): a tinted row with the bot's character, "Name · Tier"
 * and the rung line. NEXT = the stronger tint + ring; LOCKED = faded with the lock;
 * CLEARED = a check mark. Webster (rung 10) wears the boss crown.
 */
@Composable
private fun LadderRow(rung: Int, id: String, state: RungState, line: String, locked: Boolean, boss: Boolean, onClick: () -> Unit) {
    val next = state == RungState.NEXT
    val cleared = state == RungState.CLEARED
    val isLocked = state == RungState.LOCKED
    val accent = if (boss) VS_GOLD_ACCENT else VS_ACCENT
    val name = BotPersonas.name(id)
    val tier = BotPersonas.tierWord(id)
    val stateWord = when (state) { RungState.CLEARED -> "Cleared"; RungState.NEXT -> "Next"; RungState.LOCKED -> "Locked" }
    Row(
        Modifier.fillMaxWidth()
            .squishClickable("Rung $rung, $name, $tier. $line. $stateWord" + if (locked) ". Pro" else "", onClick = onClick)
            .alpha(if (isLocked) 0.6f else 1f)
            .vsRow(if (isLocked) Color(0xFF94A3B8) else accent, 16.dp, selected = next, amount = if (cleared) 0.16f else Wash.CARD)
            .padding(start = 6.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
        // BJ7: one top line — the bot (40), name and the state top-aligned; ONE detail line 4 under.
        verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(44.dp), Alignment.Center) {
            BotAvatar(id, 40.dp, bg = vsWash(vsBotColor(id), if (next) 0.30f else 0.18f), modifier = Modifier.padding(top = if (boss) 6.dp else 0.dp))
            if (boss) com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.CROWN, 22.dp, Modifier.align(Alignment.TopCenter).offset(y = (-6).dp))
        }
        Column(Modifier.weight(1f).padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                VsNumber("$rung", 12.sp, color = vsInk(accent))
                Text("$name · $tier", fontSize = 13.sp, fontWeight = FontWeight.Black, color = FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                // The boss rung holds the ladder trophy.
                if (boss) LadderTrophy(18.dp)
            }
            Text(line, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (locked || isLocked) VsLock(14.dp)
        val (tag, color) = when (state) {
            RungState.CLEARED -> "CLEARED" to VS_ACCENT
            RungState.NEXT -> "NEXT" to ORANGE
            RungState.LOCKED -> "LOCKED" to Color(0xFF64748B)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            if (cleared) com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, 14.dp)
            VsCapsLabel(tag, color = vsInk(color), fontSize = 9.5.sp)
        }
    }
}

/** The ladder trophy art (art_medal_trophy), decorative. */
@Composable
internal fun LadderTrophy(size: androidx.compose.ui.unit.Dp) {
    androidx.compose.foundation.Image(
        androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.art_medal_trophy), contentDescription = null,
        modifier = Modifier.size(size).clearAndSetSemantics { },
    )
}
