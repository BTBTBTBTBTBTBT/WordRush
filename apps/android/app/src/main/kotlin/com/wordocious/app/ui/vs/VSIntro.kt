package com.wordocious.app.ui.vs

import com.wordocious.app.ui.ProAvatarCrown
import com.wordocious.app.ui.proAvatarRing
import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.pageBackground
import com.wordocious.app.ui.theme.Nunito

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import com.wordocious.core.GameMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.HeadToHeadService
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.FinishInk
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** One intro/header/result player identity. Null avatar → letter tile (ART_SPEC §20). */
data class IntroPlayer(val username: String, val avatarUrl: String?, val level: Int?, val accentHex: String? = null, val avatarEmoji: String? = null)

private const val INTRO_DURATION_MS = 2500L

/**
 * The 2.5 s match intro (VS polish §2, founder 2026-10-01): a teal one-window
 * card on the VS page — the mode chip in the frosted strip, your avatar and
 * theirs facing each other around a teal VS, names in caps, then the all-time
 * head-to-head line. Cards slam in from opposite sides; tap to skip.
 * Anonymous opponents (null) render as "Anonymous" with the initials avatar
 * and no head-to-head line.
 */
@Composable
fun MatchIntro(
    mode: GameMode,
    me: IntroPlayer,
    opponent: IntroPlayer?,                                  // null = anonymous
    headToHead: HeadToHeadService.HeadToHeadRecord?,         // null while loading / anonymous
    onDone: () -> Unit,
) {
    LaunchedEffect(Unit) {
        // Spec U: VS match found = vs · medium.
        SoundManager.fire(com.wordocious.app.data.FeedbackEvent.VS)
        delay(INTRO_DURATION_MS)
        onDone()
    }
    val opp = opponent ?: IntroPlayer("Anonymous", null, null)
    val shape = RoundedCornerShape(18.dp)

    // The whole screen skips on tap (no squish: a full-screen surface, A9).
    val skip = androidx.compose.runtime.remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    Box(
        Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)
            .clickable(interactionSource = skip, indication = null, onClickLabel = "Skip", onClick = onDone)
            .statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // FINISH_SPEC D3: the versus card — a tinted card (A1) with its top bar.
            VsTintedCard(
                Modifier.widthIn(max = 440.dp).fillMaxWidth(), corner = 20.dp, barHeight = 10.dp,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().background(vsWash(VS_ACCENT, 0.20f)).padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    VsModeChip(mode)
                    Spacer(Modifier.weight(1f))
                    VsCapsLabel("MATCH FOUND", color = VsTeal.ink, fontSize = 11.sp, modifier = Modifier.semantics { heading() })
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 22.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    IntroPlayerCard(me, fromLeft = true, modifier = Modifier.weight(1f))
                    VsPop()
                    // The two cards land a beat apart (opponent +0.12s) for a duel feel — iOS parity.
                    IntroPlayerCard(opp, fromLeft = false, delayMs = 120, modifier = Modifier.weight(1f))
                }
                if (opponent != null && headToHead != null) {
                    Box(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, bottom = 16.dp), Alignment.Center) {
                        H2HLine(HeadToHeadService.headToHeadLine(opp.username, headToHead))
                    }
                }
            }
            VsCapsLabel("TAP TO SKIP", color = VsTeal.label)
        }
    }
}

/** Avatar card slamming in from its side with overshoot (web vs-slam keyframes). */
@Composable
private fun IntroPlayerCard(player: IntroPlayer, fromLeft: Boolean, delayMs: Long = 0, modifier: Modifier = Modifier) {
    val offset = remember { Animatable(if (WTheme.reducedMotion) 0f else if (fromLeft) -1.3f else 1.3f) }
    val alpha = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) {
            if (delayMs > 0) delay(delayMs)
            // Spring with mild bounce ≈ cubic-bezier(0.22, 1.4, 0.36, 1) overshoot.
            coroutineScope {
                launch {
                    offset.animateTo(0f, spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMediumLow))
                }
                launch { alpha.animateTo(1f, tween(250)) }
            }
        }
    }
    Column(
        modifier
            .graphicsLayer {
                translationX = offset.value * 120.dp.toPx()
                this.alpha = alpha.value
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val botId = player.avatarUrl?.takeIf { it.startsWith("bot:") }?.removePrefix("bot:")
        if (botId != null) {
            // D3: a bot stands in as its character, "ready" to play (the ghost: your faded tile).
            Box(Modifier.size(96.dp), Alignment.Center) { VsBotPose(botId, "ready", 96.dp) }
        } else {
            val avatarShape = if (player.avatarUrl.isNullOrBlank()) com.wordocious.app.ui.letterTileShape(72.dp) else CircleShape
            Box(Modifier.padding(vertical = 12.dp).shadow(6.dp, avatarShape, ambientColor = Color(0x334C1D95), spotColor = Color(0x334C1D95))) {
                VsAvatar(
                    player.username, player.avatarUrl, size = 72.dp, borderWidth = 3.dp, borderColor = Color.White,
                    emoji = player.avatarEmoji, accentHex = player.accentHex,
                )
            }
        }
        Text(
            player.username.uppercase(), fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = FinishInk.heading,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
        )
        if (botId != null && botId != com.wordocious.core.BotCast.GHOST_ID) {
            Text(
                com.wordocious.app.data.BotPersonas.tierLine(botId), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                color = VsTeal.ink, maxLines = 2, textAlign = TextAlign.Center,
            )
        }
        player.level?.takeIf { it > 0 }?.let { lv ->
            Row(
                Modifier.vsPill(VS_ACCENT, 50.dp).padding(start = 9.dp, end = 9.dp, top = 5.dp, bottom = 2.dp)
                    .semantics(mergeDescendants = true) { contentDescription = "Level $lv" },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                VsCapsLabel("LV", color = VsTeal.ink, fontSize = 9.sp)
                VsNumber("$lv", 13.sp)
            }
        }
    }
}

/** A solid teal "VS" disc — scale-pop with overshoot, 0.5s after the cards. */
@Composable
private fun VsPop() {
    val scale = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) {
            delay(500)
            scale.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMedium))
        }
    }
    // The candy disc (A8 look, not a button): teal gradient, gold ring, gloss, outlined label.
    Box(
        Modifier.size(56.dp)
            .graphicsLayer {
                scaleX = scale.value; scaleY = scale.value
                rotationZ = -8f
                alpha = if (scale.value > 0.05f) 1f else 0f
            }
            .shadow(6.dp, CircleShape, ambientColor = VS_ACCENT.copy(alpha = 0.4f), spotColor = VS_ACCENT.copy(alpha = 0.5f))
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(Color(0xFF5EEAD4), VS_ACCENT)))
            .drawWithContent {
                drawOval(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.45f), Color.White.copy(alpha = 0f)), endY = size.height * 0.5f),
                    topLeft = Offset(size.width * 0.16f, size.height * 0.06f),
                    size = androidx.compose.ui.geometry.Size(size.width * 0.68f, size.height * 0.42f),
                )
                drawContent()
            }
            .border(2.dp, Color(0xFFF5C542), CircleShape)
            .clearAndSetSemantics { },
        Alignment.Center,
    ) {
        com.wordocious.app.ui.CandyLabel("VS", 20.sp)
    }
}

/** Head-to-head line slides up + fades in (0.85s delay, after the VS settles). */
@Composable
private fun H2HLine(text: String) {
    val progress = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!WTheme.reducedMotion) { delay(850); progress.animateTo(1f, tween(450)) }
    }
    Text(
        text, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = FinishInk.heading, textAlign = TextAlign.Center,
        modifier = Modifier.vsPill(VS_ACCENT, 12.dp).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 5.dp).graphicsLayer {
            translationY = (1f - progress.value) * 10.dp.toPx()
            alpha = progress.value
        },
    )
}

/**
 * Player avatar: a Coil image in a circle when avatarUrl is set, else the
 * ART_SPEC §20 letter tile (rounded square; the border follows its shape).
 */
@Composable
fun VsAvatar(
    username: String, avatarUrl: String?, size: Dp,
    borderWidth: Dp = 1.5.dp, borderColor: Color = Color.White.copy(alpha = 0.4f),
    emoji: String? = null, accentHex: String? = null,
    /** AA2: the Pro ring + crown (match rows carry no Pro flag: the signed-in Pro player's own avatar). */
    pro: Boolean = com.wordocious.app.ui.isOwnProAvatar(username),
) {
    // Bot art (VS overhaul §9): "bot:<id>" draws the picture in the circle.
    if (avatarUrl?.startsWith("bot:") == true) {
        val id = avatarUrl.removePrefix("bot:")
        // D1: Your Ghost is the player's own faded letter tile (no circle).
        if (id == com.wordocious.core.BotCast.GHOST_ID) { VsGhostTile(size); return }
        Box(Modifier.size(size).border(borderWidth, borderColor, CircleShape).clip(CircleShape)) {
            BotAvatar(id, size)
        }
        return
    }
    // AH/AN: a worn character or saved mascot beats the photo; no photo → the mascot (AN5).
    val tile = com.wordocious.app.ui.avatarTileShape(size)
    if (com.wordocious.app.data.MascotAvatars.wearsMascot(username) || avatarUrl.isNullOrBlank()) {
        Box(Modifier.size(size)) {
            com.wordocious.app.ui.LetterTileAvatar(username.ifBlank { "?" }, size, accentHex = accentHex, emoji = emoji, pro = pro)
            Box(Modifier.matchParentSize().border(borderWidth, borderColor, tile))
        }
        return
    }
    // AN6: the photo is a rounded square with the player's frame.
    Box(Modifier.size(size)) {
        com.wordocious.app.ui.PhotoAvatar(
            avatarUrl, size, frame = com.wordocious.app.data.MascotAvatars.photoFrame(username),
            pro = pro, contentDescription = username,
        )
        Box(Modifier.matchParentSize().border(borderWidth, borderColor, tile))
    }
}

