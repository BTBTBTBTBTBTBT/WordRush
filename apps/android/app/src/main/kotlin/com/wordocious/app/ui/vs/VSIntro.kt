package com.wordocious.app.ui.vs

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import com.wordocious.core.GameMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.HeadToHeadService
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** One intro/header/result player identity. Null avatar → initials circle. */
data class IntroPlayer(val username: String, val avatarUrl: String?, val level: Int?)

private const val INTRO_DURATION_MS = 2500L

/**
 * The 2.5 s match intro (VS polish §2, founder 2026-10-01): a teal one-window
 * card on the VS page — the mode chip in the frosted strip, your avatar and
 * theirs facing each other around a teal VS, names in caps, then the all-time
 * head-to-head line. Cards slam in from opposite sides; tap to skip.
 * Anonymous opponents (null) render as "Anonymous" with the initials avatar
 * and no head-to-head line.
 */
@Composable
fun MatchIntro(
    mode: GameMode,
    me: IntroPlayer,
    opponent: IntroPlayer?,                                  // null = anonymous
    headToHead: HeadToHeadService.HeadToHeadRecord?,         // null while loading / anonymous
    onDone: () -> Unit,
) {
    LaunchedEffect(Unit) {
        SoundManager.playVsStinger()
        delay(INTRO_DURATION_MS)
        onDone()
    }
    val opp = opponent ?: IntroPlayer("Anonymous", null, null)
    val shape = RoundedCornerShape(18.dp)

    Box(
        Modifier.fillMaxSize().background(VsTeal.page).clickableNoRipple(onDone)
            .statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Column(
                Modifier.widthIn(max = 440.dp).fillMaxWidth()
                    .shadow(8.dp, shape, ambientColor = Color(0x1A4C1D95), spotColor = Color(0x1A4C1D95))
                    .clip(shape)
                    .drawBehind {
                        drawRect(Brush.verticalGradient(listOf(Color(0xFFD5F5EE), Color(0xFFE0F2FE))))
                        drawRect(Brush.linearGradient(
                            0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                            start = Offset.Zero, end = Offset(size.width, size.height),
                        ))
                    },
            ) {
                Row(
                    Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f)).padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    VsModeChip(mode)
                    Spacer(Modifier.weight(1f))
                    Text("MATCH FOUND", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = VsTeal.ink)
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 22.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    IntroPlayerCard(me, fromLeft = true, modifier = Modifier.weight(1f))
                    VsPop()
                    // The two cards land a beat apart (opponent +0.12s) for a duel feel — iOS parity.
                    IntroPlayerCard(opp, fromLeft = false, delayMs = 120, modifier = Modifier.weight(1f))
                }
                if (opponent != null && headToHead != null) {
                    Box(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, bottom = 16.dp), Alignment.Center) {
                        H2HLine(HeadToHeadService.headToHeadLine(opp.username, headToHead))
                    }
                }
            }
            Text("TAP TO SKIP", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.6.sp, color = VsTeal.grey)
        }
    }
}

/** Avatar card slamming in from its side with overshoot (web vs-slam keyframes). */
@Composable
private fun IntroPlayerCard(player: IntroPlayer, fromLeft: Boolean, delayMs: Long = 0, modifier: Modifier = Modifier) {
    val offset = remember { Animatable(if (WTheme.reducedMotion) 0f else if (fromLeft) -1.3f else 1.3f) }
    val alpha = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) {
            if (delayMs > 0) delay(delayMs)
            // Spring with mild bounce ≈ cubic-bezier(0.22, 1.4, 0.36, 1) overshoot.
            coroutineScope {
                launch {
                    offset.animateTo(0f, spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMediumLow))
                }
                launch { alpha.animateTo(1f, tween(250)) }
            }
        }
    }
    Column(
        modifier
            .graphicsLayer {
                translationX = offset.value * 120.dp.toPx()
                this.alpha = alpha.value
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.shadow(6.dp, CircleShape, ambientColor = Color(0x334C1D95), spotColor = Color(0x334C1D95))) {
            VsAvatar(player.username, player.avatarUrl, size = 72.dp, borderWidth = 3.dp, borderColor = Color.White)
        }
        Text(
            player.username.uppercase(), fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsTeal.deep,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
        )
        player.level?.takeIf { it > 0 }?.let { lv ->
            Text(
                "LV $lv", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsTeal.ink,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(VsTeal.soft)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
    }
}

/** A solid teal "VS" disc — scale-pop with overshoot, 0.5s after the cards. */
@Composable
private fun VsPop() {
    val scale = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) {
            delay(500)
            scale.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMedium))
        }
    }
    Box(
        Modifier.size(52.dp)
            .graphicsLayer {
                scaleX = scale.value; scaleY = scale.value
                rotationZ = -8f
                alpha = if (scale.value > 0.05f) 1f else 0f
            }
            .clip(CircleShape).background(VsTeal.ink),
        Alignment.Center,
    ) {
        Text("VS", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White)
    }
}

/** Head-to-head line slides up + fades in (0.85s delay, after the VS settles). */
@Composable
private fun H2HLine(text: String) {
    val progress = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) { delay(850); progress.animateTo(1f, tween(450)) }
    }
    Text(
        text, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep, textAlign = TextAlign.Center,
        modifier = Modifier.graphicsLayer {
            translationY = (1f - progress.value) * 10.dp.toPx()
            alpha = progress.value
        },
    )
}

/**
 * Circular avatar: Coil image when avatarUrl is set, else the first two
 * letters of the username on the purple→pink gradient (web IntroAvatar).
 */
@Composable
fun VsAvatar(username: String, avatarUrl: String?, size: Dp, borderWidth: Dp = 1.5.dp, borderColor: Color = Color.White.copy(alpha = 0.4f)) {
    // Bot art (VS overhaul §9): "bot:<id>" draws the picture in the circle.
    if (avatarUrl?.startsWith("bot:") == true) {
        Box(Modifier.size(size).border(borderWidth, borderColor, CircleShape).clip(CircleShape)) {
            BotAvatar(avatarUrl.removePrefix("bot:"), size)
        }
        return
    }
    val initials = username.ifBlank { "?" }.take(2).uppercase()
    Box(
        Modifier.size(size).clip(CircleShape)
            .background(Brush.linearGradient(listOf(Color(0xFFA855F7), Color(0xFFEC4899))))
            .border(borderWidth, borderColor, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (!avatarUrl.isNullOrBlank()) {
            coil.compose.AsyncImage(
                model = avatarUrl, contentDescription = username,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(
                initials, color = Color.White, fontWeight = FontWeight.Black,
                fontSize = (size.value * 0.35f).sp,
            )
        }
    }
}

