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

// FINISH_SPEC X: seasonal cast skins. During a season (Halloween: Oct 17 – Nov 1, local
// date — core currentSeason) the season's costumes (registry `cast` slot, e.g.
// `art_halloween_<id>`, 320², the cast pose framing) replace the hero cast in the living
// cast header, the cold-start intro + its landing flourish, the share-image cast wordmark
// and the loading screen. Admins pick a season preview in Settings (Off (by date) / every
// registry season); what each season swaps lives in season-registry.json (SeasonKit).

/** One cast figure as a skin draws it: the image, its figure crop and the crop's source size. */
data class CastSkinFrame(@DrawableRes val res: Int, val crop: CastCrops.Crop, val source: Int)

object SeasonSkins {
    /** The old Halloween-only switch (still written for Halloween so older builds agree). */
    const val FORCE_KEY = "debug-force-halloween"
    /** Settings → Season preview (is_admin only): a registry season id, "" = Off (by date). Same key as iOS. */
    const val PREVIEW_KEY = "debug-season"

    /** The admin season preview (persisted; null = by date); observable so every screen flips live. */
    var preview by mutableStateOf(readPreview())
        private set

    /** Back-compat: true when a preview is on. */
    val forced: Boolean get() = preview != null

    private fun readPreview(): String? = runCatching {
        SettingsPref.get(PREVIEW_KEY, "").ifBlank { null }?.takeIf { it in Season.ids }
            ?: if (SettingsPref.get(FORCE_KEY, false)) Season.HALLOWEEN else null
    }.getOrNull()

    /** Settings picker: a registry season id, or null = Off (by date). */
    fun pick(season: String?) {
        val s = season?.takeIf { it in Season.ids }
        preview = s
        runCatching {
            SettingsPref.set(PREVIEW_KEY, s ?: "")
            SettingsPref.set(FORCE_KEY, s == Season.HALLOWEEN)
        }
    }

    fun force(on: Boolean) = pick(if (on) Season.HALLOWEEN else null)

    /** The season to draw for [date] (pure: [force] = the Halloween preview). */
    fun seasonFor(date: LocalDate, force: Boolean): String? = if (force) Season.HALLOWEEN else currentSeason(date)

    /** The season to draw for [date] with a [preview] season (pure). */
    fun seasonFor(date: LocalDate, preview: String?): String? = preview ?: currentSeason(date)

    /** The season right now (device-local date + the admin preview). */
    fun current(): String? = seasonFor(LocalDate.now(), preview)

    /**
     * X the Halloween costumes trimmed to their opaque bounds (alpha > 8, measured with
     * PIL on the shipped 320² files; re-measured 10-05 for the on-model layered skins), in
     * 320-px source coordinates.
     */
    const val HALLOWEEN_SOURCE = 320
    val halloweenCrops: Map<MascotId, CastCrops.Crop> = mapOf(
        MascotId.W to CastCrops.Crop(6, 31, 313, 289),
        MascotId.O1 to CastCrops.Crop(6, 9, 313, 310),
        MascotId.R to CastCrops.Crop(21, 6, 298, 313),
        MascotId.D to CastCrops.Crop(36, 6, 283, 313),
        MascotId.O2 to CastCrops.Crop(45, 6, 274, 313),
        MascotId.C to CastCrops.Crop(33, 6, 287, 313),
        MascotId.I to CastCrops.Crop(59, 6, 261, 313),
        MascotId.O3 to CastCrops.Crop(8, 6, 311, 313),
        MascotId.U to CastCrops.Crop(6, 38, 313, 281),
        MascotId.S to CastCrops.Crop(19, 6, 300, 313),
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

    /**
     * The figure [id] draws as in [season] (null = the hero cast, 512² crops): the registry's
     * cast skin with its measured alpha box (castTrim / castSize), when it ships.
     */
    fun frame(id: MascotId, season: String?): CastSkinFrame {
        if (season == Season.HALLOWEEN) return CastSkinFrame(halloweenRes(id), halloweenCrops.getValue(id), HALLOWEEN_SOURCE)
        skin(id, season)?.let { return it }
        return CastSkinFrame(id.res, CastCrops.crops.getValue(id), 512)
    }

    /** A non-Halloween registry season's skin for [id] (name pattern + castTrim), or null. */
    private fun skin(id: MascotId, season: String?): CastSkinFrame? {
        if (season == null) return null
        val ctx = runCatching { com.wordocious.app.App.instance }.getOrNull() ?: return null
        val e = SeasonKit.entry(ctx, season) ?: return null
        val key = id.name.lowercase()
        val res = e.cast?.let { SeasonKit.drawable(ctx, it.replace("{id}", key)) }?.takeIf { it != 0 } ?: return null
        val t = e.castTrim[key] ?: return null
        return CastSkinFrame(res, CastCrops.Crop(t[0], t[1], t[2], t[3]), e.castSize)
    }

    /** The whole-image drawable for [id] in [season] (untrimmed: the loaders' tiles). */
    @DrawableRes
    fun fullRes(id: MascotId, season: String?): Int = if (season == null) id.res else frame(id, season).res

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

    /** The [season]'s Home banner (registry `banner` slot) if it ships; 0 = not there. */
    fun bannerRes(context: android.content.Context, season: String? = Season.HALLOWEEN): Int = SeasonKit.banner(context, season)
}

/** The season the composition draws in (recomposes when the admin preview flips). */
@Composable
fun rememberSeason(): String? {
    val preview = SeasonSkins.preview
    return remember(preview) { SeasonSkins.current() }
}

/**
 * X a Halloween prop for the day titles (`art_halloween_prop_<name>`): drawn only in
 * season AND only when the art has shipped (nothing at all otherwise). Decorative.
 */
@Composable
fun HalloweenPropSlot(name: String, size: Dp, modifier: Modifier = Modifier) {
    val season = rememberSeason() ?: return
    val context = LocalContext.current
    // The registry's props for the season (`name` picks one of the Halloween four by name; any
    // other season uses its own props in the same order).
    val res = remember(name, season) {
        val all = SeasonKit.props(context, season)
        val idx = listOf("pumpkin", "bat", "candy", "ghost").indexOf(name)
        if (season == Season.HALLOWEEN) SeasonSkins.propRes(context, name) else all.getOrNull(idx) ?: 0
    }
    if (res == 0) return
    Image(artPainter(res, size), null, modifier.size(size).clearAndSetSemantics { }, contentScale = ContentScale.Fit)
}

/**
 * X the Halloween Home banner slot (`art_scene_banner_halloween`): in season and when
 * the art has shipped, [content] receives its drawable; otherwise nothing renders.
 */
@Composable
fun HalloweenBannerSlot(content: @Composable (Int) -> Unit) {
    val season = rememberSeason() ?: return
    val context = LocalContext.current
    val res = remember(season) { SeasonSkins.bannerRes(context, season) }
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
            SeasonTips(season)
        }
    }
}

@Composable
private fun SeasonTips(season: String) {
    var tip by remember { mutableStateOf((System.currentTimeMillis() / 1000L % Mascots.loadingTips.size).toInt()) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        while (true) { kotlinx.coroutines.delay(3500); tip = (tip + 1) % Mascots.loadingTips.size }
    }
    Row(
        Modifier.padding(horizontal = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Image(painterResource(SeasonSkins.fullRes(MascotId.D, season)), null, Modifier.size(24.dp))
        Text(Mascots.loadingTips[tip], fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
    }
}
