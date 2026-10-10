package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import com.wordocious.app.ui.friends.FRIENDS_CARD_ACCENT
import com.wordocious.app.ui.friends.FriendCardCopy
import com.wordocious.app.ui.friends.FriendsPink
import com.wordocious.app.ui.friends.friendsLine
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

// The family ACTION MENU (founder 10-05: "There shouldn't be any plain text menus looking like this").
// Replaces every Material DropdownMenu in user-facing screens with the approved picker look (Pick a Friend
// option 1, 10-03): the calm lavender soft sheet (SoftModalSheet — the picker's soft pop open / quick reverse
// close), the pink grabber, the subject's face + name, the family 3D X, and candy actions.
// Founder 10-09: the sheet follows the season (a dark season = its night glass with light ink); non-danger actions are
// family CAST buttons in the color nearest their tint (white clay icon or full-color art), two across, an odd last one
// full width; Unfriend / Remove is one quiet centered line under them; a person's menu draws their name in the bubble
// lettering in their own color; a menu of sentences (React's quick notes) lists them as speech bubbles. No boxes.
// A picked row closes the sheet first, then runs (so a confirmation it opens presents cleanly).
// iOS: FamilyActionMenu.swift · web: components/ui/family-action-menu.tsx.

/** A row's icon: a white-clay family icon (tinted) or a full-color 3D art drawable. */
sealed class FamilyMenuIcon {
    data class Clay(val icon: FamIcon) : FamilyMenuIcon()
    data class Art(@DrawableRes val res: Int) : FamilyMenuIcon()
    /** A Material glyph with no family art yet (camera, photo library), drawn in the row's ink. */
    data class Vector(val image: androidx.compose.ui.graphics.vector.ImageVector) : FamilyMenuIcon()
}

data class FamilyMenuAction(
    val id: String,
    val title: String,
    val icon: FamilyMenuIcon,
    val tint: Color = FamilyMenuInk.PURPLE,
    val danger: Boolean = false,
    val enabled: Boolean = true,
    val contentDescription: String? = null,
    val run: () -> Unit,
)

object FamilyMenuInk {
    /** The picker's lavender (option 1). A dark season swaps in its night card ([sheet]). */
    val SHEET_LIGHT = Color(0xFFF4F0FF)
    val PURPLE = Color(0xFF7C3AED)
    val PINK = Color(0xFFDB2777)
    val AMBER = Color(0xFFD97706)
    val TEAL = Color(0xFF0D9488)
    /** The family danger tint (the same pink as a confirming Remove friend). */
    val DANGER = PINK

    // Founder 10-09 ("hideous, needs to match the aesthetic"): the sheet follows the season. Off season it is the
    // picker's lavender; under a dark season (Halloween) it is the season's night glass with light ink, like the cards.
    val night: Boolean get() = com.wordocious.app.ui.vs.vsDarkSeason
    val SHEET: Color get() = if (night) (WTheme.season?.card ?: Color(0xFF1C0F30)) else SHEET_LIGHT
    val HEADING: Color get() = if (night) FriendsPink.heading else Color(0xFF3B1F6E)
    val SUB: Color get() = if (night) FriendsPink.muted else Color(0xFF7A6A95)

    /** The tile / note / danger-line heights (iOS FamilyMenuInk). */
    val TILE_GAP = 10.dp
    val NOTE_HEIGHT = 54.dp
    val DANGER_HEIGHT = 40.dp
}

/**
 * The family action menu sheet. [avatar] = the subject's face (optional); [onDismiss] closes it (X, scrim,
 * back, swipe); a row closes it and then runs its action. [titleColor] = a person's menu draws their name in the
 * bubble lettering in this color (their backdrop; [FriendCardCopy.nameColorArgb]).
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun FamilyActionMenu(
    title: String,
    actions: List<FamilyMenuAction>,
    onDismiss: () -> Unit,
    subtitle: String? = null,
    avatar: (@Composable () -> Unit)? = null,
    titleColor: Color? = null,
) {
    // The picked row's action, run once the sheet has closed.
    var pending by remember { mutableStateOf<(() -> Unit)?>(null) }
    var closeReq by remember { mutableStateOf(false) }
    val plain = actions.filter { !it.danger }
    val danger = actions.filter { it.danger }
    val notes = FriendCardCopy.isNotesMenu(actions.map { it.title to it.danger })
    val pick: (FamilyMenuAction) -> Unit = { a ->
        pending = a.run
        closeReq = true
    }
    SoftModalSheet(
        onDismissRequest = {
            val run = pending
            pending = null
            onDismiss()
            run?.invoke()
        },
        containerColor = FamilyMenuInk.SHEET,
        closeRequest = closeReq,
        dragHandle = {
            Box(
                Modifier.padding(top = 10.dp, bottom = 4.dp).size(width = 40.dp, height = 5.dp)
                    .clip(RoundedCornerShape(50)).background(friendsLine(FRIENDS_CARD_ACCENT, 0.5f)),
            )
        },
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 20.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                Modifier.fillMaxWidth().height(48.dp).padding(bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                avatar?.invoke()
                Column(Modifier.weight(1f).semantics(mergeDescendants = true) { heading() }) {
                    if (titleColor != null) {
                        BubbleText(
                            title.uppercase(), ThemeKit.accentPalette(titleColor), maxSize = 26, minSize = 15,
                            sound = false, align = androidx.compose.ui.text.style.TextAlign.Start,
                        )
                    } else {
                        androidx.compose.material3.Text(
                            title, fontSize = 19.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                            color = FamilyMenuInk.HEADING, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (subtitle != null) {
                        androidx.compose.material3.Text(
                            subtitle, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = Nunito,
                            color = FamilyMenuInk.SUB, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                RoundIconButton(FamChrome.CLOSE, contentDescription = "Close menu", onClick = { closeReq = true })
            }
            if (notes) {
                // Sentences (React's quick notes): one per row as speech bubbles, scrollable.
                Column(
                    Modifier.fillMaxWidth().heightIn(max = 440.dp).verticalScroll(rememberScrollState()).padding(bottom = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(FamilyMenuInk.TILE_GAP),
                ) { plain.forEach { a -> FamilyMenuNote(a) { pick(a) } } }
            } else {
                // Two across; an odd last one takes the whole row (never a lone half-width button).
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(FamilyMenuInk.TILE_GAP)) {
                    plain.chunked(2).forEach { pair ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(FamilyMenuInk.TILE_GAP)) {
                            pair.forEach { a -> FamilyMenuTile(a, Modifier.weight(1f)) { pick(a) } }
                        }
                    }
                }
            }
            danger.forEach { a -> FamilyMenuDanger(a) { pick(a) } }
        }
    }
}

/**
 * Founder 10-09 ("why do these still look so ugly"): each action is the family candy button in the cast color nearest its
 * tint, two across, with its icon in white clay or full-color art. No boxes.
 */
@Composable
private fun FamilyMenuTile(a: FamilyMenuAction, modifier: Modifier, onPick: () -> Unit) {
    CastButton(
        a.title, onClick = onPick, modifier = modifier,
        color = castColorForAccent(a.tint.red, a.tint.green, a.tint.blue), size = CastSize.M, fill = true,
        enabled = a.enabled, contentDescription = a.contentDescription ?: a.title, capScale = 0.82f,
        leading = {
            when (val i = a.icon) {
                is FamilyMenuIcon.Clay -> FamIconImage(i.icon, Color.White, 16.dp)
                is FamilyMenuIcon.Art -> Image(painterResource(i.res), null, contentScale = ContentScale.Fit, modifier = Modifier.size(20.dp))
                is FamilyMenuIcon.Vector -> androidx.compose.material3.Icon(i.image, null, tint = Color.White, modifier = Modifier.size(16.dp))
            }
        },
    )
}

/** The frosted family coin the notes and the danger line carry their icon on: the helper fill + the frost light map. */
@Composable
private fun MenuCoin(a: FamilyMenuAction, tint: Color, size: Dp) {
    val colors = helperColors(tint, dark = false)
    val map = famBitmap(FamilyArt.LM_FROST)
    Box(
        Modifier.size(size).drawBehind {
            drawRoundRect(colors.fill, cornerRadius = CornerRadius(this.size.height / 2f))
            map?.let { drawLightMap3(it) }
        },
        contentAlignment = Alignment.Center,
    ) {
        when (val i = a.icon) {
            is FamilyMenuIcon.Clay -> FamIconImage(i.icon, colors.ink, size * 0.55f)
            is FamilyMenuIcon.Art -> Image(painterResource(i.res), null, contentScale = ContentScale.Fit, modifier = Modifier.size(size * 0.7f))
            is FamilyMenuIcon.Vector -> androidx.compose.material3.Icon(i.image, null, tint = colors.ink, modifier = Modifier.size(size * 0.5f))
        }
    }
}

/** A quiet press for the menu's non-cast rows: the family squish (a spring back), dimmed when disabled. */
@Composable
private fun Modifier.menuPress(a: FamilyMenuAction, scaleBy: Float, onPick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val still = WTheme.reducedMotion
    val press by androidx.compose.animation.core.animateFloatAsState(
        if (pressed && !still) 1f else 0f,
        if (pressed) androidx.compose.animation.core.tween(70)
        else androidx.compose.animation.core.spring(dampingRatio = 0.3f, stiffness = 700f),
        label = "famMenuPress",
    )
    return this
        .graphicsLayer {
            val s = 1f - scaleBy * press
            scaleX = s; scaleY = s
            alpha = if (a.enabled) 1f else 0.5f
        }
        .squishFeedback(interaction)
        .clickable(interactionSource = interaction, indication = null, enabled = a.enabled, onClick = onPick)
        .semantics(mergeDescendants = true) {
            role = Role.Button
            contentDescription = a.contentDescription ?: a.title
        }
}

/** Unfriend / Remove: one quiet centered line in the danger pink under the tiles (never a big red row). */
@Composable
private fun FamilyMenuDanger(a: FamilyMenuAction, onPick: () -> Unit) {
    val tint = FamilyMenuInk.DANGER
    val ink = helperColors(tint, dark = false).ink
    Row(
        Modifier.fillMaxWidth().height(FamilyMenuInk.DANGER_HEIGHT).menuPress(a, 0.04f, onPick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally),
    ) {
        MenuCoin(a, tint, 26.dp)
        androidx.compose.material3.Text(
            a.title, fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
            color = if (FamilyMenuInk.night) Color(0xFFF9A8D4) else ink, maxLines = 1,
        )
    }
}

/**
 * A quick note as a speech bubble from you: the whole sentence (two lines at most), its icon in a candy coin, a little
 * tail bottom-left and a paper plane at the end. Tap sends it.
 */
@Composable
private fun FamilyMenuNote(a: FamilyMenuAction, onPick: () -> Unit) {
    val tint = a.tint
    val night = FamilyMenuInk.night
    val shape = RoundedCornerShape(20.dp)
    val top = if (night) tint.copy(alpha = 0.42f) else Color.White
    val bottom = if (night) tint.copy(alpha = 0.26f) else famMix(Color.White, tint, 0.10f)
    val tailColor = if (night) tint.copy(alpha = 0.26f) else Color.White
    Row(
        Modifier.fillMaxWidth().padding(bottom = 6.dp).heightIn(min = FamilyMenuInk.NOTE_HEIGHT)
            .menuPress(a, 0.02f, onPick)
            .drawBehind {
                // The little tail: a soft triangle pointing down-left, hanging just below the bubble.
                val w = 14.dp.toPx()
                val h = 10.dp.toPx()
                val x = 18.dp.toPx()
                val y = size.height - 2.dp.toPx()
                val p = androidx.compose.ui.graphics.Path().apply {
                    moveTo(x, y); lineTo(x + w, y)
                    quadraticBezierTo(x + w / 2f + 1f, y + h / 2f, x + 1f, y + h)
                    close()
                }
                drawPath(p, tailColor)
            }
            .shadow(6.dp, shape, ambientColor = tint.copy(alpha = 0.25f), spotColor = tint.copy(alpha = 0.25f))
            .clip(shape)
            .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(top, bottom)))
            .padding(start = 10.dp, end = 14.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MenuCoin(a, tint, 32.dp)
        androidx.compose.material3.Text(
            a.title, modifier = Modifier.weight(1f), fontSize = 14.5.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
            color = if (night) Color.White else FamilyMenuInk.HEADING, maxLines = 2, overflow = TextOverflow.Ellipsis,
        )
        androidx.compose.material3.Icon(
            androidx.compose.material.icons.Icons.AutoMirrored.Filled.Send, null,
            tint = tint.copy(alpha = if (night) 0.9f else 0.7f), modifier = Modifier.size(15.dp),
        )
    }
}

/** DEBUG screenshot harness (MainActivity `--es menuDemo friend|profile|photo`): the menu over a plain page; tap to reopen. */
@Composable
fun FamilyActionMenuDemo(kind: String) {
    var open by remember { mutableStateOf(true) }
    Box(
        Modifier.fillMaxWidth().height(600.dp).clickable { open = true },
        contentAlignment = Alignment.Center,
    ) { androidx.compose.material3.Text("Tap to open the menu", fontFamily = Nunito, color = FamilyMenuInk.SUB) }
    if (!open) return
    val close = { open = false }
    when (kind) {
        "profile" -> FamilyActionMenu(
            title = "Lexi", subtitle = "Keep Wordocious friendly", onDismiss = close,
            avatar = { PlayerAvatar("Lexi", 44.dp, contentDescription = null) },
            actions = listOf(
                FamilyMenuAction("report", "Report user", FamilyMenuIcon.Clay(FamIcon.FLAG), danger = true) {},
                FamilyMenuAction("block", "Block user", FamilyMenuIcon.Clay(FamIcon.XMARK), danger = true) {},
            ),
        )
        "photo" -> FamilyActionMenu(
            title = "Change Photo", subtitle = "A new photo or one from your library", onDismiss = close,
            actions = listOf(
                FamilyMenuAction("camera", "Take photo", FamilyMenuIcon.Vector(androidx.compose.material.icons.Icons.Filled.PhotoCamera)) {},
                FamilyMenuAction("library", "Choose from library", FamilyMenuIcon.Vector(androidx.compose.material.icons.Icons.Filled.PhotoLibrary), FamilyMenuInk.TEAL) {},
                FamilyMenuAction("remove", "Remove photo", FamilyMenuIcon.Clay(FamIcon.XMARK), danger = true) {},
            ),
        )
        else -> FamilyActionMenu(
            title = "Lexi", subtitle = "On now · playing Classic", onDismiss = close,
            avatar = { PlayerAvatar("Lexi", 44.dp, contentDescription = null) },
            actions = listOf(
                FamilyMenuAction("profile", "View profile", FamilyMenuIcon.Clay(FamIcon.EYE)) {},
                FamilyMenuAction("play", "Play a game", FamilyMenuIcon.Clay(FamIcon.PLAY), FamilyMenuInk.PINK) {},
                FamilyMenuAction("taunt", "Taunt", FamilyMenuIcon.Art(Icon3DName.BELL.res), FamilyMenuInk.AMBER) {},
                FamilyMenuAction("challenge", "Challenge", FamilyMenuIcon.Art(GlyphArt.SWORDS.res)) {},
                FamilyMenuAction("gift", "Gift a shield", FamilyMenuIcon.Art(Icon3DName.SHIELD.res), FamilyMenuInk.TEAL) {},
                FamilyMenuAction("unfriend", "Unfriend", FamilyMenuIcon.Clay(FamIcon.XMARK), danger = true) {},
            ),
        )
    }
}
