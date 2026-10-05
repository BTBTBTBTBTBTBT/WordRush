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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import com.wordocious.app.ui.friends.FRIENDS_CARD_ACCENT
import com.wordocious.app.ui.friends.FriendsPink
import com.wordocious.app.ui.friends.friendsLine
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

// The family ACTION MENU (founder 10-05: "There shouldn't be any plain text menus looking like this").
// Replaces every Material DropdownMenu in user-facing screens with the approved picker look (Pick a Friend
// option 1, 10-03): the calm lavender soft sheet (SoftModalSheet — the picker's soft pop open / quick reverse
// close), the pink grabber, the subject's face + name, the family 3D X, and illustrated candy rows — a frosted
// family coin (white-clay icon tinted like a helper pill, or a full-color 3D icon) + the label in Nunito Black.
// Destructive rows take the family pink (danger) tint. No plain text lists, no chevrons.
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
    /** The picker's lavender (option 1). */
    val SHEET = Color(0xFFF4F0FF)
    val PURPLE = Color(0xFF7C3AED)
    val PINK = Color(0xFFDB2777)
    val AMBER = Color(0xFFD97706)
    val TEAL = Color(0xFF0D9488)
    /** The family danger tint (the same pink as a confirming Remove friend). */
    val DANGER = PINK
    val HEADING = Color(0xFF3B1F6E)
    val SUB = Color(0xFF7A6A95)
}

/**
 * The family action menu sheet. [avatar] = the subject's face (optional); [onDismiss] closes it (X, scrim,
 * back, swipe); a row closes it and then runs its action.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun FamilyActionMenu(
    title: String,
    actions: List<FamilyMenuAction>,
    onDismiss: () -> Unit,
    subtitle: String? = null,
    avatar: (@Composable () -> Unit)? = null,
) {
    // The picked row's action, run once the sheet has closed.
    var pending by remember { mutableStateOf<(() -> Unit)?>(null) }
    var closeReq by remember { mutableStateOf(false) }
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
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                avatar?.invoke()
                Column(Modifier.weight(1f).semantics(mergeDescendants = true) { heading() }) {
                    androidx.compose.material3.Text(
                        title, fontSize = 19.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                        color = FamilyMenuInk.HEADING, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                    if (subtitle != null) {
                        androidx.compose.material3.Text(
                            subtitle, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = Nunito,
                            color = FamilyMenuInk.SUB, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                RoundIconButton(FamChrome.CLOSE, contentDescription = "Close menu", onClick = { closeReq = true })
            }
            actions.forEach { a ->
                FamilyMenuRow(a) {
                    pending = a.run
                    closeReq = true
                }
            }
        }
    }
}

@Composable
private fun FamilyMenuRow(a: FamilyMenuAction, onPick: () -> Unit) {
    val tint = if (a.danger) FamilyMenuInk.DANGER else a.tint
    val colors = helperColors(tint, dark = false)
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val still = WTheme.reducedMotion
    val press by androidx.compose.animation.core.animateFloatAsState(
        if (pressed && !still) 1f else 0f,
        if (pressed) androidx.compose.animation.core.tween(70)
        else androidx.compose.animation.core.spring(dampingRatio = 0.3f, stiffness = 700f),
        label = "famMenuPress",
    )
    val map = famBitmap(FamilyArt.LM_FROST)
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier.fillMaxWidth().height(58.dp)
            .graphicsLayer {
                val s = 1f - 0.04f * press
                scaleX = s; scaleY = s
                alpha = if (a.enabled) 1f else 0.5f
            }
            .shadow(6.dp, shape, ambientColor = tint.copy(alpha = 0.10f), spotColor = tint.copy(alpha = 0.10f))
            .clip(shape)
            .background(if (a.danger) famMix(Color.White, tint, 0.10f) else Color.White.copy(alpha = 0.78f))
            .squishFeedback(interaction)
            .clickable(interactionSource = interaction, indication = null, enabled = a.enabled, onClick = onPick)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = a.contentDescription ?: a.title
            }
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // The frosted family coin: the helper fill + the frost light map, the icon on it.
        Box(
            Modifier.size(40.dp).drawBehind {
                drawRoundRect(colors.fill, cornerRadius = CornerRadius(size.height / 2f))
                map?.let { drawLightMap3(it) }
            },
            contentAlignment = Alignment.Center,
        ) {
            when (val i = a.icon) {
                is FamilyMenuIcon.Clay -> FamIconImage(i.icon, colors.ink, 22.dp)
                is FamilyMenuIcon.Art -> Image(painterResource(i.res), null, contentScale = ContentScale.Fit, modifier = Modifier.size(28.dp))
                is FamilyMenuIcon.Vector -> androidx.compose.material3.Icon(i.image, null, tint = colors.ink, modifier = Modifier.size(20.dp))
            }
        }
        androidx.compose.material3.Text(
            a.title, fontSize = 17.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
            color = if (a.danger) colors.ink else FamilyMenuInk.HEADING, maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.width(0.dp))
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
