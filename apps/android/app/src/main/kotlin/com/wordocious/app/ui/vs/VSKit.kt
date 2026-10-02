package com.wordocious.app.ui.vs

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
import androidx.compose.material.icons.filled.Lock
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
import com.wordocious.app.ui.clickableNoRipple
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

/** White, radius 14, soft shadow, no border. */
fun Modifier.vsCard(radius: Dp = 14.dp): Modifier =
    this.shadow(4.dp, RoundedCornerShape(radius), ambientColor = Color(0x124C1D95), spotColor = Color(0x124C1D95))
        .clip(RoundedCornerShape(radius)).background(Color.White)

@Composable
fun VsCard(modifier: Modifier = Modifier, padding: Dp = 12.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().vsCard().padding(padding), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

/**
 * The VS nav row (HEADER_SPEC §4): the shared white back circle, the teal-gradient
 * caps title, the page host beside it where the page has no banner, and a right slot.
 */
@Composable
fun VsNavBar(
    title: String,
    onBack: () -> Unit,
    /** The page host beside the title (MASCOT_SPEC §6). Null where the VS banner already hosts (§5). */
    host: com.wordocious.app.ui.MascotId? = null,
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
        actions = right,
    )
}

/** Solid teal caps button (primary VS action). */
@Composable
fun VsTealButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(12.dp)).background(VsTeal.ink).alpha(if (enabled) 1f else 0.45f)
            .clickableNoRipple { if (enabled) onClick() }.padding(horizontal = 16.dp, vertical = 12.dp),
        Alignment.Center,
    ) { Text(text, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color.White, maxLines = 1) }
}

/** Soft teal pill (#ccfbf1 bg, teal text). */
@Composable
fun VsSoftPill(text: String, modifier: Modifier = Modifier, bg: Color = VsTeal.soft, ink: Color = VsTeal.ink, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(50)).background(bg).clickableNoRipple(onClick).padding(horizontal = 14.dp, vertical = 7.dp),
        Alignment.Center,
    ) { Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = ink, maxLines = 1) }
}

/** A bot's art in a circle (§9). */
@Composable
fun BotAvatar(id: String, size: Dp, bg: Color = VsTeal.soft, modifier: Modifier = Modifier) {
    Box(modifier.size(size).clip(CircleShape).background(bg), Alignment.Center) {
        Image(
            painterResource(BotArt.res(id)), contentDescription = com.wordocious.app.data.BotPersonas.name(id),
            contentScale = ContentScale.Fit, modifier = Modifier.size(size),
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
                if (selected) Modifier.shadow(6.dp, shape, ambientColor = accent.copy(alpha = 0.6f), spotColor = accent.copy(alpha = 0.6f)).clip(shape).background(accent)
                else Modifier.clip(shape).background(Color.White),
            ),
        Alignment.Center,
    ) { ModeGlyph(mode, if (selected) Color.White else accent, size) }
}

/** The nav mode chip: icon tile + the mode name in its color. */
@Composable
fun VsModeChip(mode: GameMode) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        VsModeTile(mode, 26.dp, selected = true)
        Text(vsModeName(mode).uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = modeAccent(mode), maxLines = 1)
    }
}

/** A small lock for Pro-only rows. */
@Composable
fun VsLock(size: Dp = 12.dp, tint: Color = VsTeal.label) {
    Icon(Icons.Filled.Lock, "Pro", tint = tint, modifier = Modifier.size(size))
}

/** The icon square on a lobby tile: 30×30 soft-teal, radius 8. */
@Composable
fun VsIconSquare(content: @Composable () -> Unit) {
    Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(VsTeal.soft), Alignment.Center) { content() }
}

/** A thin teal progress bar (0–1). */
@Composable
fun VsProgressBar(fraction: Float, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(VsTeal.soft)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(VsTeal.ink))
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
