package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.ui.text.font.FontWeight
import com.wordocious.app.R
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.Season
import com.wordocious.core.currentSeason
import java.time.LocalDate
import kotlin.math.PI
import kotlin.math.sin

// FINISH_SPEC X: seasonal cast skins. During Halloween (Oct 24 – Nov 1, local date —
// core currentSeason) the ten Halloween costumes (`art_halloween_<id>`, 320², the cast
// pose framing) replace the hero cast in the living cast header, the cold-start intro
// + its landing flourish, the share-image cast wordmark and the loading screen.
// Admins can force the season on from Settings (a debug toggle).

/** One cast figure as a skin draws it: the image, its figure crop and the crop's source size. */
data class CastSkinFrame(@DrawableRes val res: Int, val crop: CastCrops.Crop, val source: Int)

object SeasonSkins {
    /** Settings → DEVELOPER (is_admin only): force the Halloween skins on. */
    const val FORCE_KEY = "debug-force-halloween"

    /** The admin preview switch (persisted); observable so the header swaps live. */
    var forced by mutableStateOf(runCatching { SettingsPref.get(FORCE_KEY, false) }.getOrDefault(false))
        private set

    fun force(on: Boolean) {
        forced = on
        runCatching { SettingsPref.set(FORCE_KEY, on) }
    }

    /** The season to draw for [date] (pure: [force] = the admin preview). */
    fun seasonFor(date: LocalDate, force: Boolean): String? = if (force) Season.HALLOWEEN else currentSeason(date)

    /** The season right now (device-local date + the admin preview). */
    fun current(): String? = seasonFor(LocalDate.now(), forced)

    /**
     * X the Halloween costumes trimmed to their opaque bounds (alpha > 8, measured with
     * PIL on the shipped 320² files), in 320-px source coordinates.
     */
    const val HALLOWEEN_SOURCE = 320
    val halloweenCrops: Map<MascotId, CastCrops.Crop> = mapOf(
        MascotId.W to CastCrops.Crop(6, 10, 313, 310),
        MascotId.O1 to CastCrops.Crop(11, 6, 308, 313),
        MascotId.R to CastCrops.Crop(26, 6, 294, 313),
        MascotId.D to CastCrops.Crop(24, 6, 296, 313),
        MascotId.O2 to CastCrops.Crop(23, 6, 296, 313),
        MascotId.C to CastCrops.Crop(52, 6, 268, 313),
        MascotId.I to CastCrops.Crop(41, 6, 278, 313),
        MascotId.O3 to CastCrops.Crop(6, 11, 313, 309),
        MascotId.U to CastCrops.Crop(13, 6, 307, 313),
        MascotId.S to CastCrops.Crop(36, 6, 284, 313),
    )

    @DrawableRes
    fun halloweenRes(id: MascotId): Int = when (id) {
        MascotId.W -> R.drawable.art_halloween_w
        MascotId.O1 -> R.drawable.art_halloween_o1
        MascotId.R -> R.drawable.art_halloween_r
        MascotId.D -> R.drawable.art_halloween_d
        MascotId.O2 -> R.drawable.art_halloween_o2
        MascotId.C -> R.drawable.art_halloween_c
        MascotId.I -> R.drawable.art_halloween_i
        MascotId.O3 -> R.drawable.art_halloween_o3
        MascotId.U -> R.drawable.art_halloween_u
        MascotId.S -> R.drawable.art_halloween_s
    }

    /** The figure [id] draws as in [season] (null = the hero cast, 512² crops). */
    fun frame(id: MascotId, season: String?): CastSkinFrame =
        if (season == Season.HALLOWEEN) CastSkinFrame(halloweenRes(id), halloweenCrops.getValue(id), HALLOWEEN_SOURCE)
        else CastSkinFrame(id.res, CastCrops.crops.getValue(id), 512)

    /** The whole-image drawable for [id] in [season] (untrimmed: the loaders' tiles). */
    @DrawableRes
    fun fullRes(id: MascotId, season: String?): Int = if (season == Season.HALLOWEEN) halloweenRes(id) else id.res

    /**
     * The shared figure height for a row [width] wide in [season]: the ten trimmed
     * figures at one height, tucked [CastCrops.OVERLAP] × width nine times, fill the width
     * (CastCrops.figureHeight with the season's aspects).
     */
    fun figureHeight(width: Float, season: String?): Float {
        val sum = MascotId.entries.sumOf { frame(it, season).crop.aspect.toDouble() }.toFloat()
        return width * (1f + CastCrops.OVERLAP * (MascotId.entries.size - 1)) / sum
    }

    // ── X hidden art slots (the props + the Home banner arrive later) ──────

    /** `art_halloween_prop_<name>` (pumpkin, bat, candy, ghost …) if it ships; 0 = not there. */
    fun propRes(context: android.content.Context, name: String): Int =
        context.resources.getIdentifier("art_halloween_prop_$name", "drawable", context.packageName)

    /** `art_scene_banner_halloween` if it ships; 0 = not there. */
    fun bannerRes(context: android.content.Context): Int =
        context.resources.getIdentifier("art_scene_banner_halloween", "drawable", context.packageName)
}

/** The season the composition draws in (recomposes when the admin preview flips). */
@Composable
fun rememberSeason(): String? {
    val forced = SeasonSkins.forced
    return remember(forced) { SeasonSkins.current() }
}

/**
 * X a Halloween prop for the day titles (`art_halloween_prop_<name>`): drawn only in
 * season AND only when the art has shipped (nothing at all otherwise). Decorative.
 */
@Composable
fun HalloweenPropSlot(name: String, size: Dp, modifier: Modifier = Modifier) {
    if (rememberSeason() != Season.HALLOWEEN) return
    val context = LocalContext.current
    val res = remember(name) { SeasonSkins.propRes(context, name) }
    if (res == 0) return
    Image(artPainter(res, size), null, modifier.size(size).clearAndSetSemantics { }, contentScale = ContentScale.Fit)
}

/**
 * X the Halloween Home banner slot (`art_scene_banner_halloween`): in season and when
 * the art has shipped, [content] receives its drawable; otherwise nothing renders.
 */
@Composable
fun HalloweenBannerSlot(content: @Composable (Int) -> Unit) {
    if (rememberSeason() != Season.HALLOWEEN) return
    val context = LocalContext.current
    val res = remember { SeasonSkins.bannerRes(context) }
    if (res != 0) content(res)
}

/**
 * X the loading screen in season: the Halloween cast in the CastLoader wave (22 dp
 * tiles, the same hop) over D's rotating tips; out of season it IS [CastLoader].
 */
@Composable
fun SeasonalCastLoader(label: String?, modifier: Modifier = Modifier, tips: Boolean = false) {
    val season = rememberSeason()
    if (season == null) {
        CastLoader(label, modifier, tips = tips)
        return
    }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val still = WTheme.reducedMotion
        val hopMs = 380
        val stagger = 70
        val period = 1100
        val clock = if (still) remember { mutableStateOf(-1f) } else rememberInfiniteTransition(label = "seasonWave").animateFloat(
            0f, period.toFloat(), infiniteRepeatable(tween(period, easing = LinearEasing), RepeatMode.Restart), label = "t",
        )
        Row(Modifier.clearAndSetSemantics { }, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
            Mascots.cast.forEachIndexed { i, id ->
                Box(
                    Modifier.size(22.dp).graphicsLayer {
                        val now = clock.value
                        if (now >= 0f) {
                            val local = (now % period) - i * stagger
                            if (local in 0f..hopMs.toFloat()) translationY = -8.dp.toPx() * sin(PI * local / hopMs).toFloat()
                        }
                    },
                ) {
                    Image(artPainter(SeasonSkins.fullRes(id, season), 22.dp), null, Modifier.size(22.dp))
                }
            }
        }
        if (label != null) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp, color = WTheme.textSecondary)
        }
        if (tips) {
            // D's rotating tips (the shared lines), D in costume.
            SeasonTips()
        }
    }
}

@Composable
private fun SeasonTips() {
    var tip by remember { mutableStateOf((System.currentTimeMillis() / 1000L % Mascots.loadingTips.size).toInt()) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        while (true) { kotlinx.coroutines.delay(3500); tip = (tip + 1) % Mascots.loadingTips.size }
    }
    Row(
        Modifier.padding(horizontal = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Image(painterResource(SeasonSkins.halloweenRes(MascotId.D)), null, Modifier.size(24.dp))
        Text(Mascots.loadingTips[tip], fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
    }
}
