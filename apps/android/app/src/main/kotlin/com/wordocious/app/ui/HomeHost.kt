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

/** BJ6 round 3 (founder: "way more prominent"): the Good Morning host's box (was 72). */
internal val HOME_HOST_BOX = 88.dp

/** BJ6: how far the host's head rises above the card's top edge (the rest overlaps the card). */
internal val HOME_HOST_RISE = 28.dp

/**
 * BJ6 (coordinator, founder hates bloat): the space above the card grows only 16 dp over the
 * compressed banner's 6 dp ([HOME_BANNER_TOP] = 22, iOS parity: Home moves down 16). The host's
 * remaining [HOME_HOST_OVERHANG] (6 dp) rises over the header's empty bottom edge: Home's scroll
 * viewport extends that far up (HomeScreen), so the scroll clip never cuts the host's head.
 */
internal val HOME_BANNER_TOP = 22.dp
internal val HOME_HOST_OVERHANG = HOME_HOST_RISE - HOME_BANNER_TOP

/** BJ6 round 3: the gap from the host's feet to the headline's top. */
internal const val HOME_HOST_TO_HEADLINE = 4f

/**
 * BJ6: the frosted strip's top padding (dp) — it clears the host's lower part (box − rise) + 4
 * to the headline, or a plain 4 when the scene band sits on top (the host then stands on the
 * band) or no host shows. Decided by today's dailies only, so Daily ⇄ Unlimited never moves it.
 */
internal fun homeStripTop(sceneBand: Boolean, hostShown: Boolean = true): Float =
    if (sceneBand || !hostShown) 4f else HOME_HOST_BOX.value - HOME_HOST_RISE.value + HOME_HOST_TO_HEADLINE

/**
 * BJ6 round 3 ("never an empty host slot"): whether the host draws — always, except a W host
 * while the celebration art carries the cast (then its headroom collapses instead).
 */
internal fun homeHostShows(pick: HomeHostPick, wVisible: Boolean): Boolean = pick !is HomeHostPick.W || wVisible

/** The host for the signed-in player (photo portrait / their mascot), else W. Recomposes on an edit. */
@Composable
internal fun rememberHomeHostPick(): HomeHostPick {
    val profile by AuthService.profile.collectAsState()
    val p = profile ?: return HomeHostPick.W
    // ownFields() reads the directory's own patch (snapshot state): an edit swaps the host at once.
    return AvatarDirectoryRules.hostPick(PlayerAvatars.ownFields(), level = p.level, pro = AuthService.isProActive)
}

/** BJ6: the header's share control shows only in Daily once a game is finished (absent otherwise). */
internal fun homeShareVisible(unlimited: Boolean, playedToday: Int): Boolean = !unlimited && playedToday > 0

/**
 * BJ6 round 5: the custom-mascot host's bitmap key — a full-body cutout (no tile, backdrop or
 * frame) at the host's box. [HomeHost] (via MascotAvatar) and [HomeHostPrewarm] build the same key.
 */
internal fun homeHostMascotKey(config: com.wordocious.core.AvatarConfig, initial: String, px: Int, dark: Boolean): MascotKey =
    MascotKey.of(config.copy(frame = "none"), initial, HOME_HOST_BOX.value, px, dark, cutout = true)

/** BJ6: the host waves once per app launch (process-level). */
internal object HomeHostWave {
    @Volatile var played = false
}

/**
 * FINISH_SPEC BJ6 — the Good Morning card's host, centered on the card's top edge (head above
 * the card, feet on the frosted strip) on a soft elliptical floor shadow. One component, so the
 * founder's option B (the player at the end of the cast row) is a placement change only:
 *  • a signed-in player whose resolved avatar is a PHOTO → the photo whole as a framed portrait
 *    (~86% of the box; the chosen frame, else their tier frame — never on a mascot body);
 *  • a saved mascot / worn cast hero → their full mascot;
 *  • guests and seeded players → W in its wave pose, full box height.
 * Waves ONCE per launch when Home appears (a −6 dp hop with a +10° / −8° / +8° wag around the
 * feet, ~220 ms beats, ~350 ms in, then springs to rest; skipped under Reduce / calm motion),
 * then rests — no idle bob. The caller omits a W host while the celebration art is up
 * ([homeHostShows]); the player's own host stays. Never drawn at alpha 0. Transform only.
 */
@Composable
internal fun HomeHost(pick: HomeHostPick, size: Dp = HOME_HOST_BOX, modifier: Modifier = Modifier) {
    val profile by AuthService.profile.collectAsState()
    val p = profile
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
    Box(
        modifier.size(size).clearAndSetSemantics { }
            .drawBehind {
                // The soft floor shadow under its feet (on the strip): radial purple-black ~20% →
                // clear, 78% × 13%, centered on the box's bottom edge.
                val w = this.size.width * 0.78f
                val h = this.size.height * 0.13f
                val top = this.size.height - h / 2f
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
                // BJ6 round 5: a full-body CUTOUT — no tile, backdrop, clip or frame (not a boxed sticker).
                MascotAvatar(drawn, initial, size, motion, cutout = true)
            }
            HomeHostPick.W -> Image(
                artPainter(com.wordocious.app.R.drawable.art_pose_w_wave, size), contentDescription = null,
                contentScale = ContentScale.Fit, modifier = motion.fillMaxHeight(),
            )
        }
    }
}

/**
 * BJ6 round 4 (founder: "no choppiness, loads instantly"): decode the Good Morning host's art
 * before Home's first frame — W's wave pose at the host's size bucket, and (once the profile
 * lands, and again on every profile change) the player's own host mascot, composed in both
 * themes — off the main thread, into the same caches [HomeHost] reads, so nothing pops in.
 */
object HomeHostPrewarm {
    private val started = java.util.concurrent.atomic.AtomicBoolean(false)
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.Default)

    fun start(context: android.content.Context) {
        if (!started.compareAndSet(false, true)) return
        val app = context.applicationContext
        val px = Math.round(HOME_HOST_BOX.value * app.resources.displayMetrics.density).coerceAtLeast(1)
        scope.launch {
            runCatching { ArtBitmaps.get(app, com.wordocious.app.R.drawable.art_pose_w_wave, ArtBitmaps.bucketPx(px)) }
            AuthService.profile.collect { p ->
                if (p == null) return@collect
                runCatching {
                    val pick = AvatarDirectoryRules.hostPick(PlayerAvatars.ownFields(), level = p.level)
                    if (pick is HomeHostPick.Mascot) {
                        val initial = MascotConfigRules.initialOf(p.username)
                        for (dark in listOf(false, true)) MascotComposer.image(app, homeHostMascotKey(pick.config, initial, px, dark))
                    }
                }
            }
        }
    }
}
