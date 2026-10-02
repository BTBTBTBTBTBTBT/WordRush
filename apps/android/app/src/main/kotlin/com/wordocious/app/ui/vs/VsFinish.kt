package com.wordocious.app.ui.vs

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import com.wordocious.app.ui.squishClickable
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.BotArt
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.HeaderBackButton
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.TintedCard
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.softNumberStyle
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BotCast

// The finishing build on the VS screens (docs/FINISH_SPEC.md D3 with A1 / A2 / A7 /
// A8 / A9): the VS pages are ALWAYS light (pageBackground alwaysLight), so their
// tinted surfaces and soft numbers are the light ones in every theme — these thin
// wrappers pin the finishing kit's light values instead of its dark-mode fallbacks.

/** The VS page accent (FINISH_SPEC A1: VS teal #0D9488). */
val VS_ACCENT = Color(0xFF0D9488)
/** The results' home purple (VS §5). */
val VS_RESULT_ACCENT = Color(0xFF7C3AED)
/** Streaks, milestones and the Go Pro family. */
val VS_GOLD_ACCENT = Color(0xFFF59E0B)

/** A1 the always-light wash of [accent] (VS pages never turn dark). */
fun vsWash(accent: Color = VS_ACCENT, amount: Float = Wash.CARD): Color = Wash.mix(accent, amount)

/** A1 the always-light 1.5 dp line of [accent]. */
fun vsLine(accent: Color = VS_ACCENT, amount: Float = Wash.LINE): Color = Wash.mix(accent, amount)

/** A label ink for [accent] on its wash (the accent darkened ~45%). */
fun vsInk(accent: Color): Color = com.wordocious.app.ui.darkenInk(accent)

/**
 * A1 a tinted VS card: the wash, the 1.5 dp line, the game-card top bar ([bar] =
 * false for a bare card) and the soft violet lift — always light.
 */
@Composable
fun VsTintedCard(
    modifier: Modifier = Modifier,
    accent: Color = VS_ACCENT,
    corner: Dp = 18.dp,
    bar: Boolean = true,
    barColor: Color = accent,
    barHeight: Dp = 8.dp,
    tintAmount: Float = Wash.CARD,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(8.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    TintedCard(
        accent, modifier, corner = corner,
        bar = if (bar) SolidColor(barColor) else null, barHeight = barHeight,
        tint = vsWash(accent, tintAmount), line = vsLine(accent),
        contentPadding = contentPadding, verticalArrangement = verticalArrangement, content = content,
    )
}

/**
 * A1 a tinted row / tile (no bar): the wash, the line, radius [corner]. [selected] =
 * the stronger tint, a full-accent border and the soft accent ring (A1 "selected").
 */
fun Modifier.vsRow(accent: Color = VS_ACCENT, corner: Dp = 14.dp, selected: Boolean = false, amount: Float = Wash.CARD): Modifier = composed {
    val shape = RoundedCornerShape(corner)
    val a = accent.copy(alpha = 1f)
    this
        .then(
            if (selected) Modifier.border(3.dp, a.copy(alpha = 0.22f), RoundedCornerShape(corner + 3.dp)).padding(3.dp)
            else Modifier,
        )
        .shadow(3.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
        .clip(shape)
        .background(Wash.mix(a, if (selected) Wash.SELECTED else amount))
        .border(if (selected) 2.dp else 1.5.dp, if (selected) a else Wash.mix(a, Wash.LINE), shape)
}

/** A1 a tinted pill (`.pill`): wash, line and a 4 dp accent band inset across the top — always light. */
fun Modifier.vsPill(accent: Color = VS_ACCENT, corner: Dp = 12.dp, amount: Float = 0.12f): Modifier {
    val shape = RoundedCornerShape(corner)
    return this.clip(shape)
        .background(Wash.mix(accent, amount))
        .drawWithContent {
            drawContent()
            drawRect(accent, Offset.Zero, Size(size.width, 4.dp.toPx()))
        }
        .border(1.5.dp, Wash.mix(accent, 0.30f), shape)
}

/** A2 a soft number on a light VS surface (Nunito Black, #3b1a78, tnum, soft white highlight). */
@Composable
fun VsNumber(text: String, fontSize: TextUnit, modifier: Modifier = Modifier, color: Color = FinishInk.softNumber) {
    val px = LocalDensity.current.density
    Text(
        text, modifier = modifier, maxLines = 1, softWrap = false,
        style = softNumberStyle(fontSize, color).copy(shadow = Shadow(Color.White.copy(alpha = 0.8f), Offset(0f, 1f * px), 0f)),
    )
}

/** A caps label on a light VS surface (11 sp Black, .1em) in [color]. */
@Composable
fun VsCapsLabel(text: String, modifier: Modifier = Modifier, color: Color = FinishInk.label, fontSize: TextUnit = 10.sp) {
    Text(
        text, fontSize = fontSize, fontWeight = FontWeight.Black, letterSpacing = 0.1.em, color = color,
        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = modifier,
    )
}

/**
 * A stat tile on a VS screen (TintedStatTile, always light): a caps [label] over a big
 * soft [value] and an optional [sub] line. TalkBack reads it as one item.
 */
@Composable
fun VsStatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    accent: Color = VS_ACCENT,
    sub: String? = null,
    valueSize: TextUnit = 22.sp,
) {
    Column(
        modifier.vsPill(accent, 14.dp).padding(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 9.dp)
            .semantics(mergeDescendants = true) { },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        VsNumber(value, valueSize)
        VsCapsLabel(label, color = vsInk(accent))
        if (sub != null) {
            Text(sub, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = FinishInk.muted, maxLines = 2)
        }
    }
}

/**
 * The VS top row where the page shows its title as a headline below it: the back
 * control and a right slot (status, mode chip), no text title.
 */
@Composable
fun VsTopRow(onBack: () -> Unit, right: @Composable RowScope.() -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HeaderBackButton(onBack)
        Spacer(Modifier.weight(1f))
        right()
    }
}

/** The character a bot id plays (null for the ghost / an unknown id). */
fun vsBotMascot(id: String?): MascotId? = BotArt.mascot(id)

/**
 * A7 a cast member for a secondary spot that is none of [exclude] (the page host,
 * the bot on screen…), from [preferred] first. Pure.
 */
fun vsSpareCast(vararg exclude: MascotId?, preferred: List<MascotId> = listOf(MascotId.U, MascotId.O1, MascotId.C, MascotId.I, MascotId.W, MascotId.O2, MascotId.D, MascotId.R, MascotId.O3, MascotId.S)): MascotId {
    val ex = exclude.filterNotNull().toSet()
    return preferred.firstOrNull { it !in ex } ?: preferred.first()
}

/** A VS pose ("ready" / "waiting" / "victory" / "goodgame") of a cast character, decorative. */
@Composable
fun VsCastPose(id: MascotId, pose: String, size: Dp, modifier: Modifier = Modifier) {
    com.wordocious.app.ui.CastPose(id, pose, size, modifier)
}

/**
 * A bot in one of its VS poses (FINISH_SPEC D3): the character's pose for a cast bot,
 * the player's faded letter tile for Your Ghost. Decorative (the name sits beside it).
 */
@Composable
fun VsBotPose(botId: String, pose: String, size: Dp, modifier: Modifier = Modifier) {
    if (botId == BotCast.GHOST_ID) {
        VsGhostTile(size, modifier)
        return
    }
    Image(
        painterResource(BotArt.pose(botId, pose)), contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size).clearAndSetSemantics { },
    )
}

/**
 * "Your Ghost" (FINISH_SPEC D1): the player's own letter tile, faded (alpha .45),
 * with a soft dashed-feel ring. Falls back to the ghost art for a signed-out player.
 */
@Composable
fun VsGhostTile(size: Dp, modifier: Modifier = Modifier) {
    val profile by AuthService.profile.collectAsState()
    val p = profile
    if (p == null) {
        Image(
            painterResource(com.wordocious.app.R.drawable.bot_ghost), contentDescription = null,
            modifier = modifier.size(size).alpha(0.6f).clearAndSetSemantics { },
        )
        return
    }
    Box(modifier.size(size).clearAndSetSemantics { }) {
        com.wordocious.app.ui.LetterTileAvatar(
            p.username, size, Modifier.alpha(0.45f), accentHex = p.accentColor, emoji = p.avatarEmoji,
        )
        Box(Modifier.matchParentSize().border(1.5.dp, FinishInk.label.copy(alpha = 0.35f), com.wordocious.app.ui.letterTileShape(size)))
    }
}

/** A speech bubble's shape: a rounded rect with a small tail on the top-left (pointing at the bot). */
private fun bubbleShape(radiusPx: Float, tailPx: Float) = GenericShape { size, _ ->
    val r = radiusPx
    val top = tailPx
    addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, top, size.width, size.height, r, r))
    moveTo(r + tailPx * 0.4f, top + 1f)
    lineTo(r + tailPx * 0.9f, 0f)
    lineTo(r + tailPx * 2.0f, top + 1f)
    close()
}

/**
 * The bot's banter (FINISH_SPEC D3, per-character kind lines): a small tinted speech
 * bubble in the bot's color. Announced politely to TalkBack as "<Name> says …". Pops
 * in with a soft spring; with Reduce Motion it simply appears.
 */
@Composable
fun VsBanterBubble(text: String?, botName: String, accent: Color = VS_ACCENT, modifier: Modifier = Modifier) {
    val still = WTheme.reducedMotion
    AnimatedVisibility(
        visible = text != null,
        enter = if (still) EnterTransition.None else fadeIn() + scaleIn(spring(dampingRatio = 0.55f, stiffness = 500f), initialScale = 0.8f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.1f, 0f)),
        exit = if (still) ExitTransition.None else fadeOut(),
        modifier = modifier,
    ) {
        val line = text ?: return@AnimatedVisibility
        val density = LocalDensity.current
        val shape = with(density) { bubbleShape(12.dp.toPx(), 7.dp.toPx()) }
        Box(
            Modifier.widthIn(max = 300.dp)
                .shadow(4.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
                .clip(shape)
                .background(Wash.mix(accent, 0.16f))
                .border(1.5.dp, Wash.mix(accent, 0.40f), shape)
                .padding(start = 12.dp, end = 12.dp, top = 7.dp + 7.dp, bottom = 7.dp)
                .semantics {
                    liveRegion = LiveRegionMode.Polite
                    contentDescription = "$botName says $line"
                },
        ) {
            Text(line, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = FinishInk.heading, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** A bot's own color (its cast color) as a Compose color; teal for the ghost / unknown. */
fun vsBotColor(id: String?): Color = BotCast.member(id)?.color?.let { Color(it) } ?: VS_ACCENT

/** A small round mark on a tile corner (W / L / ✓). */
@Composable
fun VsCornerMark(text: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier.size(18.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(color.copy(alpha = 0.85f), color)))
            .border(1.dp, Color.White, CircleShape),
        Alignment.Center,
    ) { Text(text, fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White) }
}

/** A full-width primary candy button (A8: LARGE, [color]). */
@Composable
fun CandyButtonFill(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: com.wordocious.app.ui.CandyColor = com.wordocious.app.ui.CandyColor.PURPLE,
    size: com.wordocious.app.ui.CandySize = com.wordocious.app.ui.CandySize.LARGE,
    icon: com.wordocious.app.ui.CandyIcon? = null,
    enabled: Boolean = true,
) {
    com.wordocious.app.ui.CandyButton(
        text, onClick = { if (enabled) onClick() }, modifier = modifier.fillMaxWidth(),
        color = color, size = size, icon = icon, fill = true, enabled = enabled,
    )
}

/**
 * K1 an in-app notice on the VS screens (challenge received, a friend beat your run,
 * rematch offered…): a tinted card in the event's [accent] with its top bar, the
 * sender's [avatar] (letter tile / the bot's character), a small cast [pose] that fits
 * the event (A7), the [content] headline (Nunito Black, soft numbers) and a candy
 * [action]. Slides in with a spring (instant with Reduce Motion); squishes on tap.
 * [label] is the whole notice for TalkBack.
 */
@Composable
fun VsNoticeCard(
    accent: Color,
    label: String,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    avatar: (@Composable () -> Unit)? = null,
    pose: Pair<MascotId, String>? = null,
    action: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val still = WTheme.reducedMotion
    val slide = androidx.compose.runtime.remember { androidx.compose.animation.core.Animatable(if (still) 0f else 1f) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (!still) slide.animateTo(0f, spring(dampingRatio = 0.62f, stiffness = 380f))
    }
    VsTintedCard(
        modifier.fillMaxWidth()
            .graphicsLayer {
                translationY = slide.value * 28.dp.toPx()
                alpha = 1f - slide.value.coerceIn(0f, 1f) * 0.9f
            }
            .then(
                if (onClick != null) Modifier.squishClickable(label, onClick = onClick)
                else Modifier.semantics(mergeDescendants = true) { contentDescription = label },
            ),
        accent = accent, corner = 16.dp, barHeight = 6.dp,
        contentPadding = PaddingValues(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (avatar != null) avatar()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp), content = content)
            if (pose != null) VsCastPose(pose.first, pose.second, 44.dp)
            if (action != null) action()
        }
    }
}
