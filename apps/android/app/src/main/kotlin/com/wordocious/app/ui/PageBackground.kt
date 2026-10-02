package com.wordocious.app.ui

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
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme

// ART_SPEC §11 "page tint + tiles" (founder pick, 2026-10-02 morning): one shared page
// background behind every tab / page — a soft 3-stop diagonal gradient per tint, the
// seamless letter-tile pattern (`art_bg_tiles.webp`; §18.1 v2: 720 px, opacity baked
// in) repeated on top at 100% (light) / 60% (dark), 360 dp per tile, and cards whose
// shadow leans toward the page's accent. §15 game screens use the game's own tint with
// the tiles at 55% / 35%. Mirrors the web and iOS PageBackground.

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

/** The tint of the page a composable sits on (null off the tinted pages: game screens, sheets). */
val LocalPageTint = compositionLocalOf<PageTint?> { null }

/**
 * §18.1 Tile pattern v2: `art_bg_tiles` is a 720 px seamless pattern of big glossy,
 * softly blurred letter tiles with its opacity BAKED IN — drawn at 360 dp per tile,
 * 100% in light mode and 60% in dark on the menu pages.
 */
private val PAGE_TILE_SIZE: Dp = 360.dp
private const val TILE_ALPHA_LIGHT = 1f
private const val TILE_ALPHA_DARK = 0.6f

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
 * §11 The page background as a modifier: [tint]'s gradient (light / dark by the app
 * theme) plus the tile pattern, both anchored to the WINDOW rather than to this
 * node — so the background behind the header, a tab and a page pushed inside a tab
 * line up seamlessly, and a nested page of the same tint repaints identical pixels.
 * Drawn behind the content (fixed: the page's scroll content moves over it).
 * [alwaysLight]: the VS and Friends pages are fixed-light designs (white cards, fixed
 * ink) in every theme, so they keep the light stops there too.
 */
fun Modifier.pageBackground(tint: PageTint, alwaysLight: Boolean = false): Modifier =
    tintBackground(tint.light, tint.dark, TILE_ALPHA_LIGHT, TILE_ALPHA_DARK, alwaysLight)

/**
 * The shared tint painter behind §11 pages and §15 game screens: a 3-stop diagonal
 * gradient across the window ([light] / [dark] stops by the theme) with the tile
 * pattern on top at [tileLight] / [tileDark] alpha (dropped under the contrast
 * settings: gradient only).
 */
private fun Modifier.tintBackground(
    light: List<Color>,
    dark: List<Color>,
    tileLight: Float,
    tileDark: Float,
    alwaysLight: Boolean = false,
): Modifier = composed {
    val isDark = WTheme.isDark && !alwaysLight
    val tiles: ImageBitmap = ImageBitmap.imageResource(R.drawable.art_bg_tiles)
    val tileBrush = remember(tiles) { ShaderBrush(ImageShader(tiles, TileMode.Repeated, TileMode.Repeated)) }
    val highContrast = rememberHighContrast()
    var origin by remember { mutableStateOf(Offset.Zero) }
    var rootSize by remember { mutableStateOf(Size.Zero) }
    val stops = if (isDark) dark else light
    val tileAlpha = if (isDark) tileDark else tileLight
    this
        .onGloballyPositioned { c ->
            origin = c.positionInRoot()
            rootSize = c.findRootCoordinates().size.toSize()
        }
        .drawBehind {
            val root = if (rootSize.width > 0f && rootSize.height > 0f) rootSize else size
            // Top-left → bottom-right of the window, in this node's coordinates.
            drawRect(Brush.linearGradient(stops, start = -origin, end = Offset(root.width, root.height) - origin))
            if (!highContrast && tiles.width > 0) {
                val s = PAGE_TILE_SIZE.toPx() / tiles.width
                val w = size.width
                val h = size.height
                translate(-origin.x, -origin.y) {
                    scale(s, pivot = Offset.Zero) {
                        drawRect(
                            tileBrush,
                            topLeft = Offset(origin.x / s, origin.y / s),
                            size = Size(w / s, h / s),
                            alpha = tileAlpha,
                        )
                    }
                }
            }
        }
}

// ── §15 Game screens: a soft tint in the game's color ─────────────────────

/** §15 / §18.1 Tiles behind a game: quieter than the menus (55% light / 35% dark of the baked-in pattern). */
private const val GAME_TILE_ALPHA_LIGHT = 0.55f
private const val GAME_TILE_ALPHA_DARK = 0.35f

/**
 * The accent of the solo game on screen (§15), provided by MainScreen around the
 * game screens; null everywhere else (menus, VS matches, pocket games).
 */
val LocalGameTint = compositionLocalOf<Color?> { null }

/**
 * §15 The game screen background: the game's accent ([LocalGameTint]) as a 3-stop
 * diagonal gradient (see [TintMath.gameLight] / [TintMath.gameDark]) with the tiles
 * at 8% / 5%. Boards, keyboards and tiles draw their own opaque fills on top, so
 * play is never affected. Off a game (no tint provided) it keeps [fallback], the
 * screen's old flat background.
 */
fun Modifier.gameBackground(fallback: Modifier.() -> Modifier): Modifier = composed {
    val accent = LocalGameTint.current
    if (accent == null) fallback()
    else {
        val argb = accent.toArgb()
        val light = remember(argb) { TintMath.gameLight(argb).map { Color(it) } }
        val dark = remember(argb) { TintMath.gameDark(argb).map { Color(it) } }
        tintBackground(light, dark, GAME_TILE_ALPHA_LIGHT, GAME_TILE_ALPHA_DARK)
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
