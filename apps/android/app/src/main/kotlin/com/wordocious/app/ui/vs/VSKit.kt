package com.wordocious.app.ui.vs

import com.wordocious.app.ui.CastButton
import com.wordocious.app.ui.CastColor
import com.wordocious.app.ui.CastSize
import com.wordocious.app.ui.cast
import com.wordocious.app.ui.miniGameCard
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandyIcon
import com.wordocious.app.ui.CandySize
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.pageCardShadow
import com.wordocious.app.ui.Icon3DName
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.BotArt
import com.wordocious.app.ui.ModeGlyph
import com.wordocious.app.ui.modeAccent
import com.wordocious.app.ui.modeTitleForKey
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.core.GameMode

// The VS overhaul's look (founder-approved 2026-10-01; spec docs/VS_REDESIGN_SPEC.md
// §0): the new home's aesthetic in a teal accent. Page #f8f7ff, Nunito, caps
// headlines at 900, borderless white cards with a soft violet shadow; results
// screens switch to the home's purple (§5). Shared by the lobby, banner, Friend
// and Bots pages, the live search and the challenge screens.

/** VS teal (§0) plus the shared page/label tones. */
object VsTeal {
    val ink = Color(0xFF0F766E)
    val soft = Color(0xFFCCFBF1)
    val deep = Color(0xFF134E4A)
    val titleGradient = listOf(Color(0xFF0D9488), Color(0xFF0891B2))
    val page = Color(0xFFF8F7FF)
    val label = Color(0xFF6B7280)
    val sub = Color(0xFF4B5563)
    val grey = Color(0xFF9CA3AF)
}

/** The home palette the result screens use (§5). */
object VsPurple {
    val ink = Color(0xFF7C3AED)
    val deep = Color(0xFF4C1D95)
    val mid = Color(0xFF6D28D9)
    val won = Color(0xFFEBD6FD)
    val plain = Color(0xFFE2E6FF)
    val draw = Color(0xFFECE8FF)
    val soft = Color(0xFFEDE9FE)
}

/** Display name for a VS mode ("Classic", "QuadWord", "Six"…). */
fun vsModeName(mode: GameMode): String = modeTitleForKey(mode.name)

/** "PLAY", "RIVALS", "THE LADDER"… — 11 sp, 900, letter-spacing 1.2, grey. */
@Composable
fun VsSectionLabel(text: String, modifier: Modifier = Modifier, color: Color = VsTeal.label) {
    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = color, modifier = modifier, maxLines = 1)
}

/**
 * FINISH_SPEC A1: a tinted VS card — the wash of [accent] (VS teal by default), the
 * 1.5 dp line and the soft violet lift. Always light (the VS pages never turn dark).
 */
fun Modifier.vsCard(radius: Dp = 14.dp, accent: Color = VS_ACCENT): Modifier =
    this.pageCardShadow(radius) { shadow(4.dp, RoundedCornerShape(radius), ambientColor = Color(0x124C1D95), spotColor = Color(0x124C1D95)) }
        .clip(RoundedCornerShape(radius))
        .background(vsWash(accent))
        .border(1.5.dp, vsLine(accent), RoundedCornerShape(radius))

/** A1 a tinted VS card with the game-card top bar. */
@Composable
fun VsCard(modifier: Modifier = Modifier, padding: Dp = 12.dp, accent: Color = VS_ACCENT, content: @Composable ColumnScope.() -> Unit) {
    VsTintedCard(
        modifier.fillMaxWidth(), accent = accent, corner = 16.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(padding), content = content,
    )
}

/**
 * The VS nav row (HEADER_SPEC §4): the shared back control, the teal-gradient
 * caps title, the page host beside it where the page has no banner, and a right slot.
 */
@Composable
fun VsNavBar(
    title: String,
    onBack: () -> Unit,
    /** The page host beside the title (MASCOT_SPEC §6). Null where the VS banner already hosts (§5). */
    host: com.wordocious.app.ui.MascotId? = null,
    /** The whole-cast title art (ART_SPEC §2), replacing the text title. */
    art: com.wordocious.app.ui.TitleArt? = null,
    right: @Composable RowScope.() -> Unit = {},
) {
    com.wordocious.app.ui.PageHeader(
        title,
        Modifier.statusBarsPadding(),
        accent = com.wordocious.app.ui.PageAccent.vs,
        host = host,
        onBack = onBack,
        titleSize = 20.sp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        art = art,
        actions = right,
    )
}

/**
 * The primary VS action (A8): a TEAL candy button. [fill] stretches it to the width
 * its modifier gives (pass true with fillMaxWidth / weight).
 */
@Composable
fun VsTealButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    fill: Boolean = false,
    size: CandySize = CandySize.MEDIUM,
    color: CandyColor = CandyColor.TEAL,
    icon: CandyIcon? = null,
    onClick: () -> Unit,
) {
    CastButton(text, onClick = { if (enabled) onClick() }, modifier = modifier, color = (color).cast(CastColor.BLUE), size = (size).cast, fill = fill, enabled = enabled)
}

/**
 * The small VS action (A8): a SMALL candy pill — TEAL by default, PEACH for the quiet
 * ones (leave, cancel). [bg] / [ink] are the retired flat-pill colors, kept so old
 * call sites compile; a grey [bg] maps to PEACH.
 */
@Composable
fun VsSoftPill(
    text: String,
    modifier: Modifier = Modifier,
    bg: Color = VsTeal.soft,
    @Suppress("UNUSED_PARAMETER") ink: Color = VsTeal.ink,
    color: CandyColor = if (bg == VsTeal.soft) CandyColor.TEAL else CandyColor.PEACH,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    CastButton(text, onClick = { if (enabled) onClick() }, modifier = modifier, color = (color).cast(CastColor.BLUE), size = CastSize.S, enabled = enabled)
}

/**
 * A bot's avatar (FINISH_SPEC D3): the bot's own character (its hero image) on a soft
 * tint of its color; "Your Ghost" is the player's own letter tile, faded.
 */
@Composable
fun BotAvatar(id: String, size: Dp, bg: Color? = null, modifier: Modifier = Modifier) {
    if (id == com.wordocious.core.BotCast.GHOST_ID) {
        Box(modifier.size(size), Alignment.Center) { VsGhostTile(size) }
        return
    }
    val tint = bg ?: vsWash(vsBotColor(id), 0.18f)
    Box(
        modifier.size(size).clip(CircleShape).background(tint)
            .semantics { contentDescription = com.wordocious.app.data.BotPersonas.name(id) },
        Alignment.Center,
    ) {
        Image(
            painterResource(BotArt.res(id)), contentDescription = null,
            contentScale = ContentScale.Fit, modifier = Modifier.size(size * 0.9f).padding(top = size * 0.06f),
        )
    }
}

/** A mode's real icon on a tile (the home card icon set). */
@Composable
fun VsModeTile(mode: GameMode, size: Dp, selected: Boolean = false, modifier: Modifier = Modifier) {
    val accent = modeAccent(mode)
    val shape = RoundedCornerShape(size * 0.26f)
    Box(
        modifier.size(size)
            .then(
                // FINISH_SPEC A1: a mode tile is a mini game card (tint, line, 4 dp top bar);
                // the picked one takes the stronger tint + ring.
                Modifier.miniGameCard(accent, size * 0.26f, selected = selected),
            ),
        Alignment.Center,
    ) { ModeGlyph(mode, accent, size * 0.82f) }
}

/** The nav mode chip: icon tile + the mode name in its color. */
@Composable
fun VsModeChip(mode: GameMode) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        VsModeTile(mode, 26.dp)
        Text(vsModeName(mode).uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = modeAccent(mode), maxLines = 1)
    }
}

/** A small lock for Pro-only rows: the 3D lock (ART_SPEC §5, ~1.2× the old glyph). [tint] is unused since the art. */
@Composable
fun VsLock(size: Dp = 12.dp, @Suppress("UNUSED_PARAMETER") tint: Color = VsTeal.label) {
    Icon3D(Icon3DName.LOCK, size * 1.2f, contentDescription = "Pro")
}

/** The icon square on a lobby tile: a 32 dp mini game card in [accent] (A1). */
@Composable
fun VsIconSquare(accent: Color = VS_ACCENT, content: @Composable () -> Unit) {
    Box(Modifier.size(32.dp).miniGameCard(accent, 9.dp), Alignment.Center) { Box(Modifier.padding(top = 3.dp)) { content() } }
}

/** A thin teal progress bar (0–1) on a soft teal track. */
@Composable
fun VsProgressBar(fraction: Float, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(vsWash(VS_ACCENT, 0.22f))) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(Brush.horizontalGradient(listOf(Color(0xFF5EEAD4), VS_ACCENT))))
    }
}

/** A vertical rule for the ladder. */
@Composable
fun VsLadderLine(color: Color, height: Dp) {
    Box(Modifier.width(3.dp).height(height).background(color))
}

/** "You lead 4–3 · last: QuadWord" / "You trail 1–2 · …" / "Even 2–2 · …" — the Rivals line (§2). */
fun vsRivalLine(wins: Int, losses: Int, lastModeKey: String?): String {
    val head = when {
        wins > losses -> "You lead $wins–$losses"
        losses > wins -> "You trail $wins–$losses"
        else -> "Even $wins–$losses"
    }
    return if (lastModeKey != null) "$head · last: ${modeTitleForKey(lastModeKey)}" else head
}
