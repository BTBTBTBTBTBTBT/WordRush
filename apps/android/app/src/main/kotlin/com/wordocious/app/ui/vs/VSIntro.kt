package com.wordocious.app.ui.vs

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
 * Full-screen 2.5s splash shown when a match is found, before the countdown
 * finishes — Android port of web components/vs/match-intro.tsx. Avatar cards
 * slam in from opposite sides with spring overshoot, a rotated gradient "VS"
 * pops, then the all-time head-to-head line fades in. Skippable on tap.
 * Anonymous opponents (null) render as "Anonymous" with the initials avatar
 * and no head-to-head line.
 */
@Composable
fun MatchIntro(
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

    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.8f)).clickableNoRipple(onDone),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IntroPlayerCard(me, fromLeft = true)
                VsPop()
                IntroPlayerCard(opp, fromLeft = false)
            }
            if (opponent != null && headToHead != null) {
                H2HLine(HeadToHeadService.headToHeadLine(opp.username, headToHead))
            }
            Text(
                "TAP TO SKIP", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp, color = Color.White.copy(alpha = 0.4f),
            )
        }
    }
}

/** Avatar card slamming in from its side with overshoot (web vs-slam keyframes). */
@Composable
private fun IntroPlayerCard(player: IntroPlayer, fromLeft: Boolean) {
    val offset = remember { Animatable(if (WTheme.reducedMotion) 0f else if (fromLeft) -1.3f else 1.3f) }
    val alpha = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) {
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
        Modifier
            .width(128.dp)
            .graphicsLayer {
                translationX = offset.value * 160.dp.toPx()
                this.alpha = alpha.value
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        VsAvatar(player.username, player.avatarUrl, size = 72.dp, borderWidth = 2.dp)
        Text(
            player.username, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
        )
        player.level?.let { lv ->
            Text(
                "Lv $lv", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color.White,
                modifier = Modifier.clip(RoundedCornerShape(50))
                    .background(Color.White.copy(alpha = 0.15f))
                    .border(1.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(50))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
    }
}

/** Rotated gradient "VS" — scale-pop with overshoot, 0.25s after the cards. */
@Composable
private fun VsPop() {
    val scale = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) {
            delay(250)
            scale.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMedium))
        }
    }
    Text(
        "VS", fontSize = 48.sp, fontWeight = FontWeight.Black,
        style = TextStyle(
            brush = Brush.linearGradient(listOf(Color(0xFFFACC15), Color(0xFFEC4899), Color(0xFFA855F7))),
        ),
        modifier = Modifier.graphicsLayer {
            scaleX = scale.value; scaleY = scale.value
            rotationZ = -12f
            alpha = if (scale.value > 0.05f) 1f else 0f
        },
    )
}

/** Head-to-head line slides up + fades in (web vs-h2h-in, 0.6s delay). */
@Composable
private fun H2HLine(text: String) {
    val progress = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) { delay(600); progress.animateTo(1f, tween(400)) }
    }
    Text(
        text, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold,
        color = Color.White.copy(alpha = 0.9f),
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

