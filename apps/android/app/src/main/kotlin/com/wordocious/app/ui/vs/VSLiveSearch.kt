package com.wordocious.app.ui.vs

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import com.wordocious.app.ui.clickableNoRipple
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
    val bot = remember(kind) { CpuOpponent.identity(CpuOpponent.opponentId(kind)) }
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
        Modifier.fillMaxSize().background(VsTeal.page),
    ) {
        VsNavBar("VS BATTLE", onBack = onCancel, host = com.wordocious.app.ui.Mascots.vs) { VsModeChip(vm.mode) }
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        ) {
            RingTimer(elapsedSec * 1000L) { frameMs.longValue }
            Text("SEARCHING", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = VsTeal.label)
            Text("LOOKING FOR A RIVAL", fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsTeal.deep, textAlign = TextAlign.Center)
            val n = waiting ?: 0
            Text(
                if (n > 0) "$n waiting in $modeName" else "Nobody else is waiting in $modeName right now",
                fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center,
            )
            // Step-in card.
            Column(
                Modifier.widthIn(max = 380.dp).fillMaxWidth().vsCard().padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    BotAvatar(bot.artId, 48.dp)
                    Column(Modifier.weight(1f)) {
                        Text(
                            if (keepWaiting) "We’ll keep looking" else "${bot.name} steps in at 0:15",
                            fontSize = 15.sp, fontWeight = FontWeight.Black, color = VsTeal.deep,
                        )
                        Text("If a person joins first, you get them.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                    }
                }
                if (!keepWaiting) {
                    // Drawn, not laid out: the fill follows every frame.
                    Box(
                        Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(VsTeal.soft)
                            .drawWithContent {
                                drawContent()
                                val f = (frameMs.longValue.toFloat() / STEP_IN_MS).coerceIn(0f, 1f)
                                drawRoundRect(
                                    VsTeal.ink, size = Size(size.width * f, size.height),
                                    cornerRadius = CornerRadius(size.height / 2f),
                                )
                            },
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VsTealButton("PLAY ${bot.name.uppercase()} NOW", Modifier.weight(1f)) { vm.stepIn() }
                    if (!keepWaiting) {
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(VsTeal.soft)
                                .clickableNoRipple {
                                    keepWaiting = true
                                    // §13: KEEP WAITING also pings the players who opted in.
                                    if (lookingEligible) scope.launch { pingLine = keepWaitingPingLine(VsChallengeService.looking(vm.mode.name)) }
                                }.padding(vertical = 12.dp),
                            Alignment.Center,
                        ) { Text("KEEP WAITING", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.ink) }
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
                    Modifier.widthIn(max = 380.dp).fillMaxWidth().vsCard()
                        .clickableNoRipple { toggle() }.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Filled.Notifications, null, tint = VsTeal.ink, modifier = Modifier.size(18.dp))
                    Text(
                        "Ping me when someone’s looking for $modeName",
                        fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep, modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = lookingOn, onCheckedChange = { toggle() }, enabled = !lookingSaving,
                        colors = SwitchDefaults.colors(checkedTrackColor = VsTeal.ink, checkedThumbColor = Color.White),
                    )
                }
            }
            Text("Cancel", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.clickableNoRipple(onCancel))
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
            Box(Modifier.size(120.dp).scale(s).clip(CircleShape).background(VsTeal.soft.copy(alpha = 0.6f)))
        }
        Canvas(Modifier.size(112.dp)) {
            val w = 8.dp.toPx()
            val inset = w / 2
            val arc = Size(size.width - w, size.height - w)
            drawArc(VsTeal.soft, 0f, 360f, false, topLeft = Offset(inset, inset), size = arc, style = Stroke(w))
            val frac = ((frameMs() % 60_000L).toFloat() / 60_000f)
            drawArc(VsTeal.ink, -90f, 360f * frac, false, topLeft = Offset(inset, inset), size = arc, style = Stroke(w, cap = StrokeCap.Round))
        }
        Box(Modifier.size(96.dp).clip(CircleShape).background(Color.White), Alignment.Center) {
            Text(vsClock(clockMs), fontSize = 24.sp, fontWeight = FontWeight.Black, color = VsTeal.deep)
        }
    }
}
