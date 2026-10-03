package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.AvatarDirectoryRules
import com.wordocious.app.data.HomeHostPick
import com.wordocious.app.data.MascotConfigRules
import com.wordocious.app.data.PlayerAvatars
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** BJ6 Plan A: the Good Morning host's box (≈ 2× the old corner host). */
internal val HOME_HOST_BOX = 84.dp

/** BJ6 Plan A: the headline's symmetric side room (the corner share button never crowds it). */
internal val HOME_HEADLINE_SIDE = 28.dp

/** BJ6: the host waves once per app launch (process-level). */
internal object HomeHostWave {
    @Volatile var played = false
}

/**
 * FINISH_SPEC BJ6 Plan A — the Good Morning card's host, standing INSIDE the card on the left
 * of the frosted headline strip, on a soft elliptical floor shadow. One component, so the
 * founder's option B (the player at the end of the cast row) is a placement change only:
 *  • a signed-in player whose resolved avatar is a PHOTO → the photo whole as a framed portrait
 *    (~86% of the box; the chosen frame, else their tier frame — never on a mascot body);
 *  • a saved mascot / worn cast hero → their full mascot;
 *  • guests and seeded players → W in its wave pose, full box height.
 * Waves ONCE per launch when Home appears (a −6 dp hop with a +10° / −8° / +8° wag around the
 * feet, ~220 ms beats, ~350 ms in, then springs to rest; skipped under Reduce / calm motion),
 * then rests — no idle bob. [wVisible] false (the celebration art is up) hides a W host
 * (alpha 0, slot kept); the player's own host stays. Transform / opacity only.
 */
@Composable
internal fun HomeHost(size: Dp = HOME_HOST_BOX, modifier: Modifier = Modifier, wVisible: Boolean = true) {
    val profile by AuthService.profile.collectAsState()
    val p = profile
    // ownFields() reads the directory's own patch (snapshot state): an edit swaps the host at once.
    val pick = if (p != null) {
        AvatarDirectoryRules.hostPick(PlayerAvatars.ownFields(), level = p.level, pro = AuthService.isProActive)
    } else HomeHostPick.W
    val still = WTheme.reducedMotion || WTheme.calmMotion
    val hop = remember { Animatable(0f) }
    val wag = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        if (HomeHostWave.played || still) return@LaunchedEffect
        HomeHostWave.played = true
        delay(350)
        coroutineScope {
            launch {
                hop.animateTo(-6f, tween(220))
                delay(440)
                hop.animateTo(0f, spring(dampingRatio = 0.5f))
            }
            launch {
                wag.animateTo(10f, tween(220))
                wag.animateTo(-8f, tween(220))
                wag.animateTo(8f, tween(220))
                wag.animateTo(0f, spring(dampingRatio = 0.5f))
            }
        }
    }
    val hidden = pick is HomeHostPick.W && !wVisible
    Box(
        modifier.size(size).clearAndSetSemantics { }
            .graphicsLayer { alpha = if (hidden) 0f else 1f }
            .drawBehind {
                // The soft floor shadow at its feet: radial purple-black ~20% → clear, 78% × 13%.
                val w = this.size.width * 0.78f
                val h = this.size.height * 0.13f
                val top = this.size.height - h
                drawOval(
                    Brush.radialGradient(
                        listOf(Color(0xFF1E0B3A).copy(alpha = 0.20f), Color(0xFF1E0B3A).copy(alpha = 0f)),
                        center = Offset(this.size.width / 2f, top + h / 2f), radius = w / 2f,
                    ),
                    topLeft = Offset((this.size.width - w) / 2f, top), size = Size(w, h),
                )
            },
        contentAlignment = Alignment.BottomCenter,
    ) {
        val motion = Modifier.graphicsLayer {
            transformOrigin = TransformOrigin(0.5f, 1f)
            translationY = hop.value * density
            rotationZ = wag.value
        }
        when (pick) {
            is HomeHostPick.Portrait -> PhotoAvatar(
                pick.url, size * 0.86f, motion.padding(bottom = size * 0.05f), frame = pick.frame,
                pro = AuthService.isProActive,
            )
            is HomeHostPick.Mascot -> {
                val initial = remember(p?.username) { MascotConfigRules.initialOf(p?.username) }
                // A host, not a list tile: no frame ring around the mascot.
                val drawn = remember(pick.config) { pick.config.copy(frame = "none") }
                MascotAvatar(drawn, initial, size, motion)
            }
            HomeHostPick.W -> Image(
                artPainter(com.wordocious.app.R.drawable.art_pose_w_wave, size), contentDescription = null,
                contentScale = ContentScale.Fit, modifier = motion.fillMaxHeight(),
            )
        }
    }
}
