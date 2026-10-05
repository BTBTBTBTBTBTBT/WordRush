package com.wordocious.app.ui.vs

import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.pageBackground
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.CpuOpponent
import com.wordocious.app.data.VSCountsService
import com.wordocious.app.data.VsChallengeService
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandyIcon
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.data.BotPersonas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.saveNotificationPref
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.vsClock
import kotlinx.coroutines.launch

/** The bot steps in after this long with nobody found (§6). */
private const val STEP_IN_MS = 15_000L

/** The opt-in key for "Ping me when someone's looking" (§13) — a missing key is OFF. */
private const val VS_LOOKING_KEY = "vsLooking"

/** The step-in card's line after KEEP WAITING pinged (§13); null (throttled or
 *  failed) leaves the card's `We'll keep looking` (web keepWaitingPingLine). */
internal fun keepWaitingPingLine(ping: VsChallengeService.Looking?): String? = when {
    ping == null || ping.throttled -> null
    ping.pinged <= 0 -> "Nobody has pings on yet. We’ll keep looking."
    ping.pinged == 1 -> "We pinged 1 player who plays live."
    else -> "We pinged ${ping.pinged} players who play live."
}

/**
 * The live search (VS overhaul §6, founder 2026-10-01) — never a dead end.
 * A ring timer counts up while the human queue runs; a step-in card names the
 * bot that takes over at 0:15 unless KEEP WAITING was tapped (PLAY NOW stays
 * either way). A person who joins first still wins the race: match_found from
 * the socket moves the screen on before the bot does.
 */
@Composable
fun LiveSearchScreen(vm: VSMatchViewModel, queueSize: Int, message: String?, onCancel: () -> Unit) {
    val startedAt = remember { System.currentTimeMillis() }
    // Per-frame elapsed (founder 2026-10-01: the 15 s step-in read choppy when
    // it moved in 250 ms jumps). Only DRAW phases read it — the ring arc and the
    // step-in bar — so a frame tick redraws them without recomposing the page;
    // the clock digits recompose once a second off [elapsedSec].
    val frameMs = remember { mutableLongStateOf(0L) }
    val elapsedSec by remember { derivedStateOf { frameMs.longValue / 1000L } }
    var keepWaiting by remember { mutableStateOf(false) }
    var waiting by remember { mutableStateOf<Int?>(null) }
    val kind = remember { vm.stepInKind }
    val bot = remember(kind) { CpuOpponent.identity(CpuOpponent.opponentId(kind, vm.stepInCastId)) }
    val modeName = vsModeName(vm.mode)
    // §13: Pro, live random queue only (not the Daily Battle, not a private invite).
    val scope = rememberCoroutineScope()
    val profile by AuthService.profile.collectAsState()
    val lookingEligible = vm.isPro && vm.isLiveRandomQueue && profile != null
    var pingLine by remember { mutableStateOf<String?>(null) }
    // Optimistic copy of profiles.notification_prefs.vsLooking (missing = OFF);
    // the profile refresh confirms it.
    var lookingOn by remember(profile?.notificationPrefs) { mutableStateOf(profile?.notificationPrefs?.get(VS_LOOKING_KEY) == true) }
    var lookingSaving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameMillis { }
            frameMs.longValue = System.currentTimeMillis() - startedAt
            // KEEP WAITING keeps the clock running past the deadline.
            if (frameMs.longValue >= STEP_IN_MS && !keepWaiting) { vm.stepIn(); break }
        }
    }
    // Who else is waiting in this mode (the queue includes me).
    LaunchedEffect(vm.mode) {
        while (true) {
            val c = VSCountsService.fetch()[vm.mode.name]
            waiting = c?.let { maxOf(0, it.waiting - 1) } ?: maxOf(0, queueSize - 1)
            kotlinx.coroutines.delay(5000)
        }
    }

    Column(
        Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true),
    ) {
        // A7: the page host (S) steps aside when Scoot is the bot waiting on this screen.
        val botMascot = vsBotMascot(bot.artId)
        VsNavBar("VS BATTLE", onBack = onCancel, art = com.wordocious.app.ui.TitleArt.VSBATTLE, host = com.wordocious.app.ui.Mascots.vs.takeIf { it != botMascot }) { VsModeChip(vm.mode) }
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        ) {
            RingTimer(elapsedSec * 1000L) { frameMs.longValue }
            VsCapsLabel("SEARCHING", color = VsTeal.label, fontSize = 11.sp)
            // BJ16: the FINDING A RIVAL lettering, not plain text.
            com.wordocious.app.ui.HeadingArt(com.wordocious.app.ui.Heading.FINDINGRIVAL, height = 40.dp, maxWidth = 320.dp, contentDescription = "Looking for a rival")
            val n = waiting ?: 0
            if (n > 0) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                VsNumber("$n", 16.sp)
                Text("waiting in $modeName", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
            } else Text(
                "Nobody else is waiting in $modeName right now",
                fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center,
            )
            // Step-in card (A1 tinted, D3: the step-in bot waits in its own "waiting" pose).
            VsTintedCard(
                Modifier.widthIn(max = 380.dp).fillMaxWidth(), corner = 18.dp,
                contentPadding = PaddingValues(start = 10.dp, end = 14.dp, top = 8.dp, bottom = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VsBotPose(bot.artId, "waiting", 76.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        if (keepWaiting) Text("We’ll keep looking", fontSize = 15.sp, fontWeight = FontWeight.Black, color = VsTeal.deep)
                        else Row(
                            Modifier.semantics(mergeDescendants = true) { },
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Text("${bot.name} steps in at", fontSize = 15.sp, fontWeight = FontWeight.Black, color = VsTeal.deep)
                            VsNumber("0:15", 16.sp)
                        }
                        Text(BotPersonas.tierLine(bot.artId), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.ink)
                        Text("If a person joins first, you get them.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                    }
                }
                if (!keepWaiting) {
                    // Drawn, not laid out: the fill follows every frame.
                    Box(
                        Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(vsWash(VS_ACCENT, 0.24f))
                            .drawWithContent {
                                drawContent()
                                val f = (frameMs.longValue.toFloat() / STEP_IN_MS).coerceIn(0f, 1f)
                                drawRoundRect(
                                    Brush.horizontalGradient(listOf(Color(0xFF5EEAD4), VS_ACCENT)), size = Size(size.width * f, size.height),
                                    cornerRadius = CornerRadius(size.height / 2f),
                                )
                            }
                            .clearAndSetSemantics { },
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VsTealButton("PLAY ${bot.name.uppercase()} NOW", Modifier.weight(1f), fill = true, icon = CandyIcon.PLAY) { vm.stepIn() }
                    if (!keepWaiting) {
                        VsTealButton("KEEP WAITING", Modifier.weight(1f), fill = true, color = CandyColor.PEACH) {
                            keepWaiting = true
                            // §13: KEEP WAITING also pings the players who opted in.
                            if (lookingEligible) scope.launch { pingLine = keepWaitingPingLine(VsChallengeService.looking(vm.mode.name)) }
                        }
                    }
                }
                if (keepWaiting) pingLine?.let {
                    Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.deep, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                }
            }
            // §13: "Ping me when someone's looking for <Mode>" (Pro, live random queue).
            val p = profile
            if (lookingEligible && p != null) {
                fun toggle() {
                    if (lookingSaving) return
                    val next = !lookingOn
                    lookingOn = next
                    lookingSaving = true
                    scope.launch {
                        try { saveNotificationPref(p, VS_LOOKING_KEY, next) } finally { lookingSaving = false }
                    }
                }
                Row(
                    Modifier.widthIn(max = 380.dp).fillMaxWidth()
                        .squishClickable(role = androidx.compose.ui.semantics.Role.Switch) { toggle() }
                        .semantics(mergeDescendants = true) { stateDescription = if (lookingOn) "On" else "Off" }
                        .vsCard(16.dp).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BELL, 20.dp)
                    Text(
                        "Ping me when someone’s looking for $modeName",
                        fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep, modifier = Modifier.weight(1f),
                    )
                    // The candy switch (family rule: every on/off switch is the candy toggle); the row owns the tap.
                    com.wordocious.app.ui.CandySwitch(lookingOn, Modifier.alpha(if (lookingSaving) 0.5f else 1f))
                }
            }
            VsSoftPill("CANCEL", color = CandyColor.PEACH, onClick = onCancel)
            message?.let {
                Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** Teal ring on #ccfbf1 counting up, with a soft pulse behind it. The arc
 *  reads [frameMs] inside the draw phase, so it sweeps continuously; the
 *  digits ([clockMs]) tick once a second. */
@Composable
private fun RingTimer(clockMs: Long, frameMs: () -> Long) {
    Box(Modifier.size(132.dp), Alignment.Center) {
        if (!WTheme.reducedMotion) {
            val t = rememberInfiniteTransition(label = "ringPulse")
            val s by t.animateFloat(0.85f, 1.15f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "s")
            Box(Modifier.size(120.dp).scale(s).clip(CircleShape).background(vsWash(VS_ACCENT, 0.22f).copy(alpha = 0.7f)))
        }
        Canvas(Modifier.size(112.dp)) {
            val w = 8.dp.toPx()
            val inset = w / 2
            val arc = Size(size.width - w, size.height - w)
            drawArc(vsWash(VS_ACCENT, 0.24f), 0f, 360f, false, topLeft = Offset(inset, inset), size = arc, style = Stroke(w))
            val frac = ((frameMs() % 60_000L).toFloat() / 60_000f)
            drawArc(VS_ACCENT, -90f, 360f * frac, false, topLeft = Offset(inset, inset), size = arc, style = Stroke(w, cap = StrokeCap.Round))
        }
        // A1 the dial takes the teal wash; A2 the clock is a soft number.
        Box(
            Modifier.size(96.dp).clip(CircleShape).background(vsWash(VS_ACCENT, 0.10f)).border(1.5.dp, vsLine(VS_ACCENT), CircleShape)
                .semantics { contentDescription = "Searching for " + vsClock(clockMs) },
            Alignment.Center,
        ) {
            VsNumber(vsClock(clockMs), 26.sp, Modifier.clearAndSetSemantics { })
        }
    }
}
