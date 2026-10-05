package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.Nunito

// Headers, menus and icons with the cast's personality (founder 2026-10-02; spec
// docs/HEADER_SPEC.md). The ChatGPT 3D icon set (§0) behind one `Icon3D`, the
// soft white header circles, and the one shared `PageHeader` every page, screen
// and sheet uses (§4). Mirrors web components/icon-3d.tsx and iOS HeaderKit.swift.

/** The 3D icon set (§0, plus ART_SPEC §4–§5), `res/drawable-nodpi/icon3d_<name>`, 256 px transparent. */
enum class Icon3DName(@DrawableRes val res: Int) {
    FLAME(R.drawable.icon3d_flame),
    TROPHY(R.drawable.icon3d_trophy),
    SHIELD(R.drawable.icon3d_shield),
    GEAR(R.drawable.icon3d_gear),
    HELP(R.drawable.icon3d_help),
    CROWN(R.drawable.icon3d_crown),
    TAB_HOME(R.drawable.icon3d_tab_home),
    TAB_LEADERBOARD(R.drawable.icon3d_tab_leaderboard),
    TAB_STATS(R.drawable.icon3d_tab_stats),
    TAB_FRIENDS(R.drawable.icon3d_tab_friends),
    // The art pass (docs/ART_SPEC.md §4–§5), WebP.
    BADGE_W(R.drawable.icon3d_badge_w),
    BADGE_L(R.drawable.icon3d_badge_l),
    BADGE_CHECK(R.drawable.icon3d_badge_check),
    LOCK(R.drawable.icon3d_lock),
    BELL(R.drawable.icon3d_bell),
    ADD_FRIEND(R.drawable.icon3d_add_friend),
    SHARE(R.drawable.icon3d_share),
    SOUND(R.drawable.icon3d_sound),
    BACK(R.drawable.icon3d_back),
}

/**
 * One icon from the 3D set at [size]. Decorative (hidden from TalkBack) unless
 * [contentDescription] labels it. [alpha] / [colorFilter] serve the tab bar's
 * unselected treatment (§3).
 */
@Composable
fun Icon3D(
    name: Icon3DName,
    size: Dp,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    alpha: Float = 1f,
    colorFilter: ColorFilter? = null,
) {
    Image(
        painterResource(name.res),
        contentDescription = contentDescription,
        modifier = modifier.size(size),
        alpha = alpha,
        colorFilter = colorFilter,
    )
}

/** §3 unselected tabs: the icon at 60% saturation. */
val Icon3DMuted: ColorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0.6f) })

/** The header chrome's shared tones (§1, §4). */
object HeaderInk {
    /** Back / close glyphs in the white circles. */
    val control = Color(0xFF6D28D9)
    /** The selected tab label. */
    val tabSelected = Color(0xFF7C3AED)
    val streak = Color(0xFFC2410C)
    val trophy = Color(0xFF92400E)
    val shield = Color(0xFF5B21B6)
    /** Soft violet shadow (the borderless white card look). */
    val shadow = Color(0x2E4C1D95)
}

/** Page title gradients (§4): brand purple→pink, or the page's own accent. */
object PageAccent {
    val brand = listOf(Color(0xFFA78BFA), Color(0xFFEC4899))
    val vs = listOf(Color(0xFF0D9488), Color(0xFF0891B2))
    val friends = listOf(Color(0xFFDB2777), Color(0xFF7C3AED))
    val leaderboard = listOf(Color(0xFFF59E0B), Color(0xFFD97706))
}

/**
 * The header pills' surface. FINISH_SPEC A1/A3 retired the white bubbles: what still
 * uses this gets the soft lilac wash with a faint lilac line instead of plain white
 * (dark mode: the themed surface).
 */
fun Modifier.softWhite(shape: androidx.compose.ui.graphics.Shape = CircleShape, elevation: Dp = 4.dp): Modifier =
    this.shadow(elevation, shape, ambientColor = HeaderInk.shadow, spotColor = HeaderInk.shadow)
        .clip(shape).background(accentWash(Color(0xFF7C3AED), 0.08f))
        .border(1.dp, accentLine(Color(0xFF7C3AED), 0.18f), shape)

/**
 * A header button (FINISH_SPEC A3): NO bubble — the bare soft 3D icon in a [size]
 * tap area (≥ 44 dp effective), squishing on press (.86 / .80 → 1.08 → 1).
 * [contentDescription] labels the whole button for TalkBack.
 */
@Composable
fun HeaderCircle(
    onClick: () -> Unit,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    size: Dp = 38.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier.size(maxOf(size, SOFT_CONTROL_TAP))
            .squishClickable(contentDescription, icon = true, onClick = onClick),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/** A header action from the icon set (A3): the bare 3D icon, 23 dp, in a 44 dp tap area. */
@Composable
fun HeaderIconButton(
    icon: Icon3DName,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 38.dp,
    iconSize: Dp = SOFT_CONTROL_ICON,
) {
    HeaderCircle(onClick, contentDescription, modifier, size) { Icon3D(icon, iconSize) }
}

/**
 * The back (or close) control (A3): the bare 3D `back` icon at 23 dp; close keeps the
 * X in #6d28d9. No circle behind either.
 */
@Composable
fun HeaderBackButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    close: Boolean = false,
    contentDescription: String = if (close) "Close" else "Back",
    size: Dp = 38.dp,
) {
    HeaderCircle(onClick, contentDescription, modifier, size) {
        if (close) {
            FamCloseGlyph(22.dp)   // button family §3: the soft 3D X (iOS HeaderCircleLabel parity)
        } else {
            Icon3D(Icon3DName.BACK, SOFT_CONTROL_ICON)
        }
    }
}

/** A page title: caps, 900, in the page's gradient (§4). */
@Composable
fun PageTitleText(
    title: String,
    modifier: Modifier = Modifier,
    accent: List<Color> = PageAccent.brand,
    fontSize: TextUnit = 22.sp,
    maxLines: Int = 2,
) {
    Text(
        title.uppercase(),
        modifier = modifier.semantics { heading() },
        fontSize = fontSize, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
        maxLines = maxLines, overflow = TextOverflow.Ellipsis,
        style = TextStyle(brush = Brush.horizontalGradient(accent), fontFamily = Nunito),
    )
}

/**
 * The one page header (§4): [onBack] as a white circle on the left, the caps
 * gradient title with the page's [host] beside it (MASCOT_SPEC §6, 40 dp bob),
 * then [actions] (white icon circles) and [onClose] as a white circle on the
 * right. Pages whose banner already carries the host pass `host = null` (§5).
 */
@Composable
fun PageHeader(
    title: String,
    modifier: Modifier = Modifier,
    accent: List<Color> = PageAccent.brand,
    host: MascotId? = null,
    onBack: (() -> Unit)? = null,
    /** Draw the left control as a close X (a modal's Cancel) instead of a back arrow. */
    backAsClose: Boolean = false,
    backLabel: String = if (backAsClose) "Close" else "Back",
    onClose: (() -> Unit)? = null,
    closeLabel: String = "Close",
    titleSize: TextUnit = 22.sp,
    titleMaxLines: Int = 2,
    hostSize: Dp = 40.dp,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
    /** The page's whole-cast title image (ART_SPEC §2): replaces the text title AND the host. */
    art: TitleArt? = null,
    /** AR / AS1: draw [title] in the live lettering with this palette (never plain text). */
    live: HeadlinePalette? = null,
    /** FINISH_SPEC BJ16: a heading lettering (art-titlecast-<slug>) in place of the text title. */
    heading: Heading? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier.fillMaxWidth().padding(contentPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (onBack != null) HeaderBackButton(onBack, close = backAsClose, contentDescription = backLabel)
        // Title + host share ONE weighted cell (a second weighted spacer would cap
        // the title at half the leftover width; see AppHeader's history).
        if (heading != null) {
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                HeadingArt(heading, height = 44.dp, contentDescription = title.lowercase().replaceFirstChar { it.titlecase() })
            }
        } else if (art != null) {
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                PageTitleArt(art)
            }
        } else Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (live != null) LiveHeadline(title, live, Modifier.weight(1f), maxSize = titleSize, minSize = 14.sp, maxLines = titleMaxLines)
            else PageTitleText(title, Modifier.weight(1f, fill = false), accent, titleSize, titleMaxLines)
            if (host != null) TitleHost(host, size = hostSize)
        }
        actions()
        if (onClose != null) HeaderBackButton(onClose, close = true, contentDescription = closeLabel)
    }
}

// ── Inline 3D icons inside a line of text (a winner's crown after a name) ──

private const val ICON3D_INLINE = "icon3d:"

/**
 * Appends [name] as an inline 3D icon (HEADER_SPEC §2) — render the text with
 * `inlineContent = icon3DInline()`. TalkBack reads the icon's plain name.
 */
fun androidx.compose.ui.text.AnnotatedString.Builder.appendIcon3D(name: Icon3DName) {
    appendInlineContent(ICON3D_INLINE + name.name, name.name.lowercase())
}

/** The inline-content map for [appendIcon3D], each icon [size] (em) square, centered on the text. */
fun icon3DInline(size: TextUnit = 1.25.em): Map<String, androidx.compose.foundation.text.InlineTextContent> =
    Icon3DName.entries.associate { n ->
        (ICON3D_INLINE + n.name) to androidx.compose.foundation.text.InlineTextContent(
            androidx.compose.ui.text.Placeholder(size, size, androidx.compose.ui.text.PlaceholderVerticalAlign.TextCenter),
        ) {
            Image(painterResource(n.res), null, Modifier.fillMaxSize())
        }
    }

