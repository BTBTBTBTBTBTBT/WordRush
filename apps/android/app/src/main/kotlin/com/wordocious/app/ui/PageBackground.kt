package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.roundToInt

// ART_SPEC §11 / §19.1: one shared page background behind every tab / page. §19.1
// (founder, 2026-10-02 late morning) replaced the §11 gradient + §18.1 tile layer with
// a wallpaper per page / game (`art_wall_<name>.webp`, 1179 × 2556, portrait, opaque):
// aspect-filled (ContentScale.Crop) and centered on the WINDOW, fixed behind the
// content and the status bar. Dark mode dims it under #120D1F (58% menus, 62% games);
// the contrast settings add a 20% white (light) / 70% night (dark) veil. The tints'
// gradient stays as the fallback when a wallpaper can't load, and their accents still
// lean the card shadows. Mirrors the web and iOS PageBackground.

/** §11 The page tints: light / dark gradient stops (top-left → bottom-right) + the card-shadow accent. */
enum class PageTint(val light: List<Color>, val dark: List<Color>, val accent: Color) {
    /** Home, Settings, Pro, Help / Guides, profile, default. */
    HOME(
        listOf(Color(0xFFF3EEFF), Color(0xFFFBEFFF), Color(0xFFFFF1F7)),
        listOf(Color(0xFF160F26), Color(0xFF1C1231), Color(0xFF22122C)),
        Color(0xFF7C3AED),
    ),
    /** Leaderboard, Records. */
    LEADERBOARD(
        listOf(Color(0xFFFFF8E6), Color(0xFFFFEFD2), Color(0xFFFDE9F2)),
        listOf(Color(0xFF1E1608), Color(0xFF23160D), Color(0xFF241221)),
        Color(0xFFF59E0B),
    ),
    STATS(
        listOf(Color(0xFFEEF4FF), Color(0xFFEEEBFF), Color(0xFFF4EEFF)),
        listOf(Color(0xFF0E1530), Color(0xFF141433), Color(0xFF1A1233)),
        Color(0xFF2563EB),
    ),
    FRIENDS(
        listOf(Color(0xFFFFF0F7), Color(0xFFFCE7F3), Color(0xFFF3E8FF)),
        listOf(Color(0xFF241024), Color(0xFF22102A), Color(0xFF1A1030)),
        Color(0xFFEC4899),
    ),
    /** VS pages. */
    VS(
        listOf(Color(0xFFE9FBF8), Color(0xFFECF6FF), Color(0xFFF1EEFF)),
        listOf(Color(0xFF08201E), Color(0xFF0E1A2A), Color(0xFF15142B)),
        Color(0xFF0D9488),
    ),
}

/** §19.1 The wallpaper behind each page tint (`art_wall_<name>`). */
@DrawableRes
fun PageTint.wallpaperRes(): Int = when (this) {
    PageTint.HOME -> R.drawable.art_wall_home
    PageTint.LEADERBOARD -> R.drawable.art_wall_leaderboard
    PageTint.STATS -> R.drawable.art_wall_stats
    PageTint.FRIENDS -> R.drawable.art_wall_friends
    PageTint.VS -> R.drawable.art_wall_vs
}

/** §19.1 A solo game's wallpaper (`art_wall_game_<id>`) for a catalog mode id, or null (no wallpaper: the tint gradient). */
@DrawableRes
fun gameWallpaperRes(modeId: String?): Int? = when (modeId) {
    "practice" -> R.drawable.art_wall_game_practice
    "gauntlet" -> R.drawable.art_wall_game_gauntlet
    "quordle" -> R.drawable.art_wall_game_quordle
    "octordle" -> R.drawable.art_wall_game_octordle
    "sequence" -> R.drawable.art_wall_game_sequence
    "rescue" -> R.drawable.art_wall_game_rescue
    "six" -> R.drawable.art_wall_game_six
    "seven" -> R.drawable.art_wall_game_seven
    "propernoundle" -> R.drawable.art_wall_game_propernoundle
    "sudoku" -> R.drawable.art_wall_game_sudoku
    "scramble" -> R.drawable.art_wall_game_scramble
    "hub" -> R.drawable.art_wall_game_hub
    "crossword" -> R.drawable.art_wall_game_crossword
    "groups" -> R.drawable.art_wall_game_groups
    "ladder" -> R.drawable.art_wall_game_ladder
    "cryptogram" -> R.drawable.art_wall_game_cryptogram
    "wordsearch" -> R.drawable.art_wall_game_wordsearch
    "regions" -> R.drawable.art_wall_game_regions
    else -> null
}

/** The tint of the page a composable sits on (null off the tinted pages: game screens, sheets). */
val LocalPageTint = compositionLocalOf<PageTint?> { null }

/** §19.1 Dark mode: the wallpaper under #120D1F at 58% (menus) / 62% (games). */
private val NIGHT = Color(0xFF120D1F)
private const val DIM_DARK_PAGE = 0.58f
private const val DIM_DARK_GAME = 0.62f
/** §19.1 Reduce transparency / raised contrast: a 20% white (light) / 70% night (dark) veil. */
private const val CONTRAST_VEIL_LIGHT = 0.20f
private const val CONTRAST_VEIL_DARK = 0.70f

/**
 * The decoded wallpapers, shared by every page that draws one (the header backdrop,
 * each tab and a pushed page of the same tint all paint the same bitmap), bounded
 * by bytes so a few recent ones stay warm. The v3 art is 1179 × 2556 (full phone
 * resolution); it is decoded scaled to the screen's width, so a 1080-px phone holds
 * ≈ 10 MB per wallpaper and the cache keeps the last three or four.
 */
private object Wallpapers {
    private const val ART_WIDTH = 1179
    private val cache = object : android.util.LruCache<Int, ImageBitmap>(40 * 1024 * 1024) {
        override fun sizeOf(key: Int, value: ImageBitmap): Int = value.width * value.height * 4
    }

    fun get(context: android.content.Context, @DrawableRes res: Int): ImageBitmap? =
        cache.get(res) ?: runCatching {
            val screenW = context.resources.displayMetrics.widthPixels
            val opts = android.graphics.BitmapFactory.Options().apply {
                if (screenW in 1 until ART_WIDTH) {   // scale down while decoding, never up
                    inScaled = true; inDensity = ART_WIDTH; inTargetDensity = screenW
                }
            }
            android.graphics.BitmapFactory.decodeResource(context.resources, res, opts)?.asImageBitmap()
        }.getOrNull()?.also { cache.put(res, it) }
}

/**
 * Android's contrast settings (the reduce-transparency / increase-contrast fallback,
 * §11: gradient only): "High contrast text" and, on Android 14+, a raised system
 * contrast level. Sampled once per composition of the page.
 */
@Composable
private fun rememberHighContrast(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        val highText = runCatching {
            android.provider.Settings.Secure.getInt(context.contentResolver, "high_text_contrast_enabled", 0) == 1
        }.getOrDefault(false)
        val raised = android.os.Build.VERSION.SDK_INT >= 34 && runCatching {
            (context.getSystemService(android.content.Context.UI_MODE_SERVICE) as? android.app.UiModeManager)?.contrast?.let { it > 0f } == true
        }.getOrDefault(false)
        highText || raised
    }
}

/**
 * §11 / §19.1 The page background as a modifier: [tint]'s wallpaper, aspect-filled
 * and centered on the WINDOW rather than on this node — so the background behind the
 * header, a tab and a page pushed inside a tab line up seamlessly, and a nested page
 * of the same tint repaints identical pixels. Drawn behind the content (fixed: the
 * page's scroll content moves over it). [alwaysLight]: the VS and Friends pages are
 * fixed-light designs (white cards, fixed ink) in every theme, so they skip the dark
 * dimming there too.
 */
fun Modifier.pageBackground(tint: PageTint, alwaysLight: Boolean = false): Modifier =
    wallpaperBackground(tint.wallpaperRes(), tint.light, tint.dark, DIM_DARK_PAGE, alwaysLight)

/**
 * The shared painter behind §19.1 pages and game screens: wallpaper [res] scaled
 * like ContentScale.Crop to the window and centered on it, clipped to this node;
 * dark mode lays #120D1F at [darkDim] over it and the contrast settings add their
 * veil. If the wallpaper can't load (or [res] is null), the §11 / §15 diagonal
 * gradient ([light] / [dark] stops) across the window instead.
 */
private fun Modifier.wallpaperBackground(
    @DrawableRes res: Int?,
    light: List<Color>,
    dark: List<Color>,
    darkDim: Float,
    alwaysLight: Boolean = false,
): Modifier = composed {
    val isDark = WTheme.isDark && !alwaysLight
    val context = LocalContext.current
    val wall: ImageBitmap? = remember(res) { res?.let { Wallpapers.get(context, it) } }
    val highContrast = rememberHighContrast()
    var origin by remember { mutableStateOf(Offset.Zero) }
    var rootSize by remember { mutableStateOf(Size.Zero) }
    val stops = if (isDark) dark else light
    this
        .onGloballyPositioned { c ->
            origin = c.positionInRoot()
            rootSize = c.findRootCoordinates().size.toSize()
        }
        .drawBehind {
            val root = if (rootSize.width > 0f && rootSize.height > 0f) rootSize else size
            if (wall == null || wall.width <= 0 || wall.height <= 0) {
                // Fallback: the tint's gradient, top-left → bottom-right of the window.
                drawRect(Brush.linearGradient(stops, start = -origin, end = Offset(root.width, root.height) - origin))
            } else {
                val src = Size(wall.width.toFloat(), wall.height.toFloat())
                val scale = ContentScale.Crop.computeScaleFactor(src, root)
                val dw = src.width * scale.scaleX
                val dh = src.height * scale.scaleY
                // Centered on the window, in this node's coordinates.
                val left = (root.width - dw) / 2f - origin.x
                val top = (root.height - dh) / 2f - origin.y
                clipRect {
                    drawImage(
                        wall,
                        dstOffset = IntOffset(left.roundToInt(), top.roundToInt()),
                        dstSize = IntSize(dw.roundToInt(), dh.roundToInt()),
                        filterQuality = FilterQuality.Medium,
                    )
                }
            }
            if (isDark) drawRect(NIGHT, alpha = darkDim)
            if (highContrast) {
                if (isDark) drawRect(NIGHT, alpha = CONTRAST_VEIL_DARK) else drawRect(Color.White, alpha = CONTRAST_VEIL_LIGHT)
            }
        }
}

// ── §15 Game screens: a soft tint in the game's color ─────────────────────

/**
 * The accent of the solo game on screen (§15), provided by MainScreen around the
 * game screens; null everywhere else (menus, VS matches, pocket games).
 */
val LocalGameTint = compositionLocalOf<Color?> { null }

/** §19.1 The solo game's wallpaper (`art_wall_game_<id>`), provided beside [LocalGameTint]; null off a game. */
val LocalGameWallpaper = compositionLocalOf<Int?> { null }

/**
 * §15 / §19.1 The game screen background: the game's wallpaper ([LocalGameWallpaper])
 * dimmed 62% in dark mode, or — without one — the game's accent ([LocalGameTint]) as a
 * 3-stop diagonal gradient (see [TintMath.gameLight] / [TintMath.gameDark]). Boards,
 * keyboards and tiles draw their own opaque fills on top, so play is never affected.
 * Off a game (no tint provided) it keeps [fallback], the screen's old flat background.
 */
fun Modifier.gameBackground(fallback: Modifier.() -> Modifier): Modifier = composed {
    val accent = LocalGameTint.current
    if (accent == null) fallback()
    else {
        val argb = accent.toArgb()
        val light = remember(argb) { TintMath.gameLight(argb).map { Color(it) } }
        val dark = remember(argb) { TintMath.gameDark(argb).map { Color(it) } }
        wallpaperBackground(LocalGameWallpaper.current, light, dark, DIM_DARK_GAME)
    }
}

/**
 * §11 One shared page background: [tint] behind [content] (edge to edge), and the
 * tint provided to the cards inside so their shadows lean toward its accent.
 */
@Composable
fun PageBackground(
    tint: PageTint,
    modifier: Modifier = Modifier,
    alwaysLight: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(modifier.pageBackground(tint, alwaysLight)) {
        CompositionLocalProvider(LocalPageTint provides tint) { content() }
    }
}

/**
 * §11 A card's shadow on a tinted page: the page accent at ~11% (spot) under a soft
 * 5 dp lift, so white cards rise off the tint. Off the tinted pages (no
 * [LocalPageTint]) the card keeps [fallback]. Spot / ambient colors need API 28+;
 * older devices draw the platform's neutral shadow.
 */
internal fun Modifier.pageCardShadow(radius: Dp, fallback: Modifier.() -> Modifier): Modifier = composed {
    // §15 on a game screen the shadow leans toward the game's accent.
    val accent = LocalPageTint.current?.accent ?: LocalGameTint.current
    if (accent == null) fallback()
    else this.shadow(
        elevation = 5.dp,
        shape = RoundedCornerShape(radius),
        clip = false,
        // The platform scales these by its own shadow alphas (spot ≈0.19, ambient ≈0.04),
        // which lands the visible lift at ~11% of the accent.
        ambientColor = accent.copy(alpha = 0.35f),
        spotColor = accent.copy(alpha = 0.6f),
    )
}

/** §11 [PageTint]'s light stops as ARGB ints (the share cards and the home-screen widget). */
fun PageTint.lightArgb(): IntArray = light.map { it.toArgb() }.toIntArray()

/**
 * §15 Pure tint math (ARGB ints, no Android): the per-game gradient stops made from
 * the game's accent. Light: accent at 6% / 10% over white, 4% over #FFF7FB; dark:
 * accent at 10% / 14% / 8% over #120D1F. Shared by the game screens and the
 * share cards (§17) so both paint the same pixels.
 */
object TintMath {
    private const val WHITE = 0xFFFFFFFF.toInt()
    private const val BLUSH = 0xFFFFF7FB.toInt()
    private const val NIGHT = 0xFF120D1F.toInt()

    /** [color] at [alpha] over the opaque [base] (a plain source-over blend), opaque result. */
    fun over(color: Int, alpha: Float, base: Int): Int {
        fun ch(shift: Int): Int {
            val c = (color ushr shift) and 0xFF
            val b = (base ushr shift) and 0xFF
            return Math.round(c * alpha + b * (1f - alpha)).coerceIn(0, 255)
        }
        return (0xFF shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
    }

    /** §15 light stops (top-left → bottom-right) for a game [accent]. */
    fun gameLight(accent: Int): IntArray =
        intArrayOf(over(accent, 0.06f, WHITE), over(accent, 0.10f, WHITE), over(accent, 0.04f, BLUSH))

    /** §15 dark stops for a game [accent]. */
    fun gameDark(accent: Int): IntArray =
        intArrayOf(over(accent, 0.10f, NIGHT), over(accent, 0.14f, NIGHT), over(accent, 0.08f, NIGHT))
}
