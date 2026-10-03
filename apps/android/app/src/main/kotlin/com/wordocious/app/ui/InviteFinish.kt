package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.game.GameTileFace
import com.wordocious.app.ui.game.TileFace
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// The friend-invite + gift-a-week-of-Pro screens (docs/FINISH_SPEC.md T1–T4), shared
// by the invite sheet, the Friends tab (add a friend, requests, invites, moments) and
// the gift panel: tinted cards with their top bar (A1), the new scene art
// (art_scene_invite_sent, art_scene_friends_match, art_scene_gift_pro), lettering-style
// headlines in the soft-numbers ink (A2), glossy pills, the invite code on glossy B-kit
// letter tiles and candy buttons (A8). Twin of web components/friends/invite-screens.tsx.
// [light] = the piece sits on a fixed-light page (Friends): fixed-light washes + inks
// whatever the theme. Motion (art spring, hearts, confetti) is off with Reduce Motion.

/** The Friends accent (T1–T3 cards). */
val INVITE_ACCENT = Color(0xFFEC4899)

/** The invite cards' pink → gold top bar. */
val INVITE_BAR: Brush get() = Brush.horizontalGradient(listOf(Color(0xFFEC4899), Color(0xFFF59E0B)))

/** The gold Pro family (T4). */
val GIFT_GOLD = Color(0xFFF5A524)

/** The pending pill's amber. */
private val PENDING_AMBER = Color(0xFFF59E0B)

/** The heart burst's colors (pink, light pink, gold, lilac). */
private val HEART_COLORS = listOf(Color(0xFFEC4899), Color(0xFFF472B6), Color(0xFFF5A524), Color(0xFFA66BFF))

/** The NEW FRIENDS confetti (pinks, gold, lilac). */
private val FRIENDS_CONFETTI = listOf(
    Color(0xFFEC4899), Color(0xFFF472B6), Color(0xFFFBCFE8), Color(0xFFA855F7), Color(0xFFFFD66B), Color(0xFFFFFFFF),
)

// ── Inks + washes (theme, or fixed light) ─────────────────────────────────

private val lightMode: Boolean @Composable get() = !WTheme.isDark

@Composable
private fun headingInk(light: Boolean): Color = if (light || lightMode) FinishInk.heading else WTheme.text

@Composable
private fun labelInk(light: Boolean): Color = if (light || lightMode) FinishInk.label else WTheme.textSecondary

@Composable
private fun softInk(light: Boolean): Color = if (light || lightMode) FinishInk.softNumber else FinishInk.softNumberDark

@Composable
private fun wash(accent: Color, light: Boolean, amount: Float = Wash.CARD): Color =
    if (light) Wash.mix(accent, amount) else accentWash(accent, amount)

@Composable
private fun line(accent: Color, light: Boolean, amount: Float = Wash.LINE): Color =
    if (light) Wash.mix(accent, amount) else accentLine(accent, amount)

/** A1 an invite card: [accent]'s wash, its 1.5 dp line and the [bar] across the top. */
@Composable
fun InviteCard(
    modifier: Modifier = Modifier,
    accent: Color = INVITE_ACCENT,
    bar: Brush = INVITE_BAR,
    light: Boolean = false,
    contentPadding: PaddingValues = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    TintedCard(
        accent, modifier, bar = bar,
        tint = wash(accent, light, 0.12f), line = line(accent, light),
        contentPadding = contentPadding, verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

// ── Lettering, pills, tiles ───────────────────────────────────────────────

/** A lettering-style headline ("INVITE SENT!") in the soft-numbers ink (A2): Nunito Black caps with the soft shadow. */
@Composable
fun InviteLettering(
    text: String,
    fontSize: TextUnit = 28.sp,
    modifier: Modifier = Modifier,
    light: Boolean = false,
    textAlign: TextAlign = TextAlign.Center,
) {
    Text(
        text.uppercase(),
        modifier = modifier.semantics { heading() },
        style = softNumberStyle(fontSize, softInk(light)).copy(letterSpacing = 0.03.em, lineHeight = fontSize * 1.05f, textAlign = textAlign),
        maxLines = 2,
    )
}

/**
 * A glossy pill (not a button): [accent]'s candy gradient, the thin gold outline, a
 * darker lip, the white top gloss and a white Nunito Black label with the dark-purple
 * outline. [small] = the little "PENDING" tag.
 */
@Composable
fun GlossyPill(text: String, modifier: Modifier = Modifier, accent: Color = INVITE_ACCENT, small: Boolean = false) {
    val h = if (small) 20.dp else 32.dp
    val lip = if (small) 2.dp else 3.dp
    val shape = RoundedCornerShape(50)
    val lipColor = Color(TintMath.over(0xFF000000.toInt(), 0.35f, accent.copy(alpha = 1f).toArgb()))
    Box(
        modifier.height(h + lip).semantics(mergeDescendants = true) { contentDescription = text },
    ) {
        Box(
            Modifier.matchParentSize().padding(top = lip)
                .shadow(if (small) 2.dp else 4.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.25f), spotColor = accent.copy(alpha = 0.3f))
                .clip(shape).background(lipColor),
        )
        Box(
            Modifier.height(h)
                .clip(shape)
                .background(Brush.verticalGradient(listOf(Wash.mix(accent, 0.6f), accent)))
                .drawWithContent {
                    val w = size.width
                    val hh = size.height
                    drawRoundRect(
                        Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.5f), Color.White.copy(alpha = 0f)), startY = hh * 0.08f, endY = hh * 0.54f),
                        topLeft = Offset(w * 0.08f, hh * 0.08f),
                        size = Size(w * 0.84f, hh * 0.46f),
                        cornerRadius = CornerRadius(hh * 0.25f),
                    )
                    drawContent()
                }
                .border(if (small) 1.dp else 1.5.dp, Color(0xFFF5C542), shape)
                .padding(horizontal = if (small) 8.dp else 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.clearAndSetSemantics { }) {
                CandyLabel(if (small) text.uppercase() else text, if (small) 10.sp else 15.sp)
            }
        }
    }
}

/** T1 the small "Pending" glossy pill on request-pending rows. */
@Composable
fun PendingPill(modifier: Modifier = Modifier) = GlossyPill("Pending", modifier, accent = PENDING_AMBER, small = true)

/**
 * T1 an invite code on glossy B-kit letter tiles (purple, the right-spot face), with a
 * copy candy (teal + check once [copied]) when [onCopy] is given. The tiles shrink to
 * fit the width they get (never above [tile]).
 */
@Composable
fun InviteCodeTiles(
    code: String,
    modifier: Modifier = Modifier,
    tile: Dp = 30.dp,
    copied: Boolean = false,
    onCopy: (() -> Unit)? = null,
    copyLabel: String = "Copy invite code",
) {
    val tiles = remember(code) { InviteScreens.codeTiles(code) }
    if (tiles.isEmpty()) return
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val gap = 3.dp
        val copyW = if (onCopy != null) 34.dp + 8.dp else 0.dp
        val fit = (maxWidth - copyW - gap * (tiles.size - 1)) / tiles.size
        val side = if (constraints.hasBoundedWidth) minOf(tile, fit).coerceAtLeast(12.dp) else tile
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.semantics(mergeDescendants = true) { contentDescription = "Invite code ${tiles.joinToString(" ")}" },
                horizontalArrangement = Arrangement.spacedBy(gap),
            ) {
                tiles.forEach { ch -> GameTileFace(ch, TileFace.CORRECT, Modifier.size(side).clearAndSetSemantics { }) }
            }
            if (onCopy != null) {
                CandyRoundButton(
                    contentDescription = if (copied) "Copied" else copyLabel,
                    onClick = onCopy,
                    color = if (copied) CandyColor.TEAL else CandyColor.PURPLE,
                    diameter = 34.dp,
                ) {
                    Icon(if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy, null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

/** A player for the avatars on the invite cards: their photo, else their letter tile. */
data class InvitePerson(val name: String, val url: String? = null, val emoji: String? = null, val accentHex: String? = null, val userId: String? = null)

/** A player's avatar: their photo (a circle with a white ring) or their letter tile. Decorative. */
@Composable
fun InviteAvatar(person: InvitePerson, size: Dp, modifier: Modifier = Modifier) {
    // BJ5: THE shared resolver (photo / saved mascot / worn cast / seeded) — never the raw URL.
    PlayerAvatar(
        person.name, size, modifier.clearAndSetSemantics { }, userId = person.userId,
        avatarUrl = person.url, accentHex = person.accentHex,
    )
}

// ── T1 · invite sent ──────────────────────────────────────────────────────

/**
 * T1 invite sent: I tossing the gold-star envelope springs in, "INVITE SENT!", the
 * friend's [name] on a glossy pill and/or the [code] on glossy tiles, a [note], candy
 * "Send another" (when [onSendAnother] is given) + "Done". Announced politely.
 * [framed] = inside its own tinted card (false = the host sheet already is the card).
 */
@Composable
fun InviteSentCard(
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    name: String? = null,
    code: String? = null,
    note: String? = null,
    onSendAnother: (() -> Unit)? = null,
    sendAnotherEnabled: Boolean = true,
    title: String = "Invite sent!",
    framed: Boolean = true,
    light: Boolean = false,
) {
    val body: @Composable () -> Unit = {
        Column(
            Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SceneArtPop(R.drawable.art_scene_invite_sent, height = 118.dp)
            InviteLettering(title, 28.sp, light = light)
            if (name != null) GlossyPill(name, Modifier.widthIn(max = 260.dp))
            if (code != null) InviteCodeTiles(code, Modifier.fillMaxWidth(), tile = 26.dp)
            if (note != null) {
                Text(
                    note, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito,
                    color = labelInk(light), textAlign = TextAlign.Center,
                )
            }
            Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (onSendAnother != null) {
                    CandyButton(
                        "Send another", onClick = onSendAnother, color = CandyColor.PINK, size = CandySize.MEDIUM,
                        modifier = Modifier.weight(1f), fill = true, enabled = sendAnotherEnabled,
                    )
                }
                CandyButton("Done", onClick = onDone, color = CandyColor.PEACH, size = CandySize.MEDIUM, modifier = Modifier.weight(1f), fill = true)
            }
        }
    }
    if (framed) InviteCard(modifier, light = light) { body() } else Box(modifier) { body() }
}

// ── T2 · invite received ──────────────────────────────────────────────────

/**
 * T2 a friend request / invite received: the inviter's avatar over the invite-sent
 * art ([showArt] false = just the avatar, when the art is already on screen — A7),
 * "<Name> wants to be friends!", the soft Decline (peach) and Accept — the spec's
 * green candy is TEAL here (FinishKit has no green candy). Tapping the name row opens
 * the profile ([onOpenProfile]).
 */
@Composable
fun InviteReceivedCard(
    inviter: InvitePerson,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    modifier: Modifier = Modifier,
    showArt: Boolean = true,
    line: String? = null,
    onOpenProfile: (() -> Unit)? = null,
    busy: Boolean = false,
    light: Boolean = false,
) {
    InviteCard(modifier, light = light) {
        val headline = "${inviter.name} wants to be friends!"
        Column(
            Modifier.fillMaxWidth().then(
                if (onOpenProfile != null) Modifier.squishClickable(label = "$headline Open profile", onClick = onOpenProfile) else Modifier,
            ),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (showArt) {
                Box(Modifier.fillMaxWidth().height(124.dp), contentAlignment = Alignment.Center) {
                    SceneArtPop(R.drawable.art_scene_invite_sent, height = 124.dp)
                    // The inviter's tile tucked against the art's lower left.
                    InviteAvatar(inviter, 52.dp, Modifier.align(Alignment.BottomCenter).offset(x = (-64).dp, y = 2.dp))
                }
            } else {
                InviteAvatar(inviter, 44.dp)
            }
            Text(
                headline, fontSize = 18.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                color = softInk(light), textAlign = TextAlign.Center, lineHeight = 22.sp,
                maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
            if (line != null) {
                Text(line, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito, color = labelInk(light), textAlign = TextAlign.Center)
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CandyButton(
                "Decline", onClick = onDecline, color = CandyColor.PEACH, size = CandySize.MEDIUM,
                modifier = Modifier.weight(0.62f), fill = true, enabled = !busy, contentDescription = "Decline ${inviter.name}",
            )
            CandyButton(
                "Accept", onClick = onAccept, color = CandyColor.TEAL, size = CandySize.MEDIUM,
                modifier = Modifier.weight(1f), fill = true, enabled = !busy, contentDescription = "Accept ${inviter.name}",
                leading = { Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(17.dp)) },
            )
        }
    }
}

// ── T3 · accepted ─────────────────────────────────────────────────────────

/** The heart path (24 × 24 view box). */
private val HEART_PATH: Path by lazy {
    PathParser().parsePathString(
        "M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3.1 1.6-1.9 3-3.1 5.2-3.1 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z",
    ).toPath()
}

/** A heart [sizePx] wide centered on [center]: [color] fill, white edge. */
private fun DrawScope.drawHeart(center: Offset, sizePx: Float, color: Color, alpha: Float = 1f) {
    val k = sizePx / 24f
    translate(center.x - sizePx / 2f, center.y - sizePx / 2f) {
        scale(k, k, pivot = Offset.Zero) {
            drawPath(HEART_PATH, color.copy(alpha = color.alpha * alpha))
            drawPath(HEART_PATH, Color.White.copy(alpha = alpha), style = Stroke(width = 1.4f))
        }
    }
}

/** A still heart glyph (decorative). */
@Composable
fun HeartGlyph(size: Dp, modifier: Modifier = Modifier, color: Color = INVITE_ACCENT) {
    Canvas(modifier.size(size).clearAndSetSemantics { }) { drawHeart(center, this.size.minDimension, color) }
}

/**
 * Hearts bursting out from the middle of their box, once (≈1.7 s): [count] hearts fan
 * upward, swell and fade. Nothing with Reduce Motion. Decorative.
 */
@Composable
fun HeartBurst(modifier: Modifier = Modifier, count: Int = 9) {
    if (WTheme.reducedMotion) return
    val clock = remember { Animatable(0f) }
    LaunchedEffect(Unit) { clock.animateTo(1_960f, tween(1_960, easing = LinearEasing)) }
    Canvas(modifier.clearAndSetSemantics { }) {
        val ms = clock.value
        val d = density
        for (i in 0 until count) {
            val deg = -90f + (i - (count - 1) / 2f) * (150f / maxOf(1, count - 1))
            val rad = deg * PI.toFloat() / 180f
            val dist = (70f + (i % 3) * 22f) * d
            val dx = cos(rad) * dist
            val dy = sin(rad) * dist
            val t = ((ms - 260f - i * 45f) / 1_300f).coerceIn(0f, 1f)
            if (t <= 0f || t >= 1f) continue
            // Ease out (cubic-bezier .2,.8,.3,1 ≈ 1 - (1 - t)^3).
            val e = 1f - (1f - t) * (1f - t) * (1f - t)
            val (mx, my, sc, a) = if (e < 0.45f) {
                val u = e / 0.45f
                listOf(dx * 0.6f * u, dy * 0.6f * u, 0.2f + 0.95f * u, u)
            } else {
                val u = (e - 0.45f) / 0.55f
                listOf(dx * (0.6f + 0.4f * u), (dy * (0.6f + 0.4f * u)) - 24f * d * u, 1.15f - 0.25f * u, 1f - u)
            }
            val side = (16f + (i % 3) * 5f) * d * sc
            drawHeart(Offset(center.x + mx, center.y + my), side, HEART_COLORS[i % HEART_COLORS.size], a.coerceIn(0f, 1f))
        }
    }
}

/**
 * T3 "NEW FRIENDS!": I and the pink O high-five full card width with one confetti +
 * heart burst (none with Reduce Motion), both avatars side by side, candy "Challenge
 * them" (the existing VS challenge, [onChallenge] null = hidden) and "See friends".
 */
@Composable
fun NewFriendsCard(
    me: InvitePerson,
    friend: InvitePerson,
    onSeeFriends: () -> Unit,
    modifier: Modifier = Modifier,
    onChallenge: (() -> Unit)? = null,
    onClose: (() -> Unit)? = null,
    light: Boolean = false,
) {
    Box(modifier.fillMaxWidth()) {
        InviteCard(
            Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }, light = light,
            contentPadding = PaddingValues(start = 0.dp, end = 0.dp, top = 6.dp, bottom = 16.dp),
        ) {
            BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                // Full card width at the art's own shape (1200 × 832).
                val h = maxWidth * (832f / 1200f)
                SceneArtPop(R.drawable.art_scene_friends_match, height = h)
                HeartBurst(Modifier.fillMaxWidth().height(h))
            }
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                InviteLettering("New friends!", 32.sp, light = light)
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AvatarFigure(me, me.name, light)
                    HeartGlyph(26.dp, Modifier.padding(bottom = 24.dp))
                    AvatarFigure(friend, "@${friend.name}", light)
                }
                Text(
                    "You and @${friend.name} are now friends. Race them on every daily.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito,
                    color = labelInk(light), textAlign = TextAlign.Center,
                )
                if (onChallenge != null) {
                    CandyButton(
                        "Challenge them", onClick = onChallenge, color = CandyColor.PINK, size = CandySize.LARGE,
                        icon = CandyIcon.PLAY, modifier = Modifier.fillMaxWidth(), fill = true,
                        contentDescription = "Challenge ${friend.name}",
                    )
                }
                CandyButton("See friends", onClick = onSeeFriends, color = CandyColor.PEACH, size = CandySize.MEDIUM, modifier = Modifier.fillMaxWidth(), fill = true)
            }
        }
        if (onClose != null) PopupClose(onClose, Modifier.align(Alignment.TopEnd).padding(top = 10.dp), tint = headingInk(light))
        PopupConfetti(FRIENDS_CONFETTI, Modifier.matchParentSize(), count = 48)
    }
}

@Composable
private fun AvatarFigure(person: InvitePerson, caption: String, light: Boolean) {
    Column(
        Modifier.width(96.dp).semantics(mergeDescendants = true) { },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        InviteAvatar(person, 52.dp)
        Text(
            caption, fontSize = 11.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = headingInk(light),
            maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
    }
}

// ── T4 · gift a week of Pro ───────────────────────────────────────────────

/** T4 the soft-number "7 DAYS" badge on a gold pill. */
@Composable
fun SevenDaysBadge(modifier: Modifier = Modifier, light: Boolean = false) {
    Row(
        modifier.giftPill(GIFT_GOLD, light).semantics(mergeDescendants = true) { contentDescription = "${InviteScreens.GIFT_DAYS} days" }
            .padding(start = 10.dp, end = 10.dp, top = 7.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        SoftNumber("${InviteScreens.GIFT_DAYS}", 22.sp, color = softInk(light))
        Text("DAYS", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em, fontFamily = Nunito, color = headingInk(light))
    }
}

/** T4 the gifts-left counter in soft numbers ("2 / 3 GIFTS LEFT"). */
@Composable
fun GiftsLeftBadge(left: Int, modifier: Modifier = Modifier, slots: Int = InviteScreens.GIFT_SLOTS, light: Boolean = false) {
    Row(
        modifier.giftPill(Color(0xFF7C3AED), light).semantics(mergeDescendants = true) { contentDescription = "$left of $slots gifts left" }
            .padding(start = 10.dp, end = 10.dp, top = 7.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        SoftNumber("$left", 20.sp, color = softInk(light))
        Text("/", fontSize = 11.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = labelInk(light))
        SoftNumber("$slots", 14.sp, color = softInk(light))
        Text("GIFTS LEFT", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em, fontFamily = Nunito, color = headingInk(light))
    }
}

@Composable
private fun Modifier.giftPill(accent: Color, light: Boolean): Modifier {
    val shape = RoundedCornerShape(12.dp)
    val bg = wash(accent, light, 0.14f)
    val ln = line(accent, light, 0.30f)
    return this.clip(shape).background(bg)
        .drawWithContent { drawContent(); drawRect(accent, Offset.Zero, Size(size.width, 3.dp.toPx())) }
        .border(1.5.dp, ln, shape)
}

/**
 * T4 "GIFT A WEEK OF PRO": O3 with the crowned gift box on a gold-tinted card, the
 * soft-number 7 DAYS badge, the gifts-left counter ([giftsLeft] null = hidden) and the
 * gold (AMBER) candy "Send a gift" ([onSend] null = no button). [content] = the
 * program's details; [footer] under the button.
 */
@Composable
fun GiftProCard(
    modifier: Modifier = Modifier,
    giftsLeft: Int? = null,
    slots: Int = InviteScreens.GIFT_SLOTS,
    sendLabel: String = "Send a gift",
    onSend: (() -> Unit)? = null,
    sendEnabled: Boolean = true,
    light: Boolean = false,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit = {},
    footer: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit = {},
) {
    InviteCard(modifier, accent = GIFT_GOLD, bar = MomentInk.proBar, light = light) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f).padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InviteLettering("Gift a week of Pro", 21.sp, light = light, textAlign = TextAlign.Start)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    SevenDaysBadge(light = light)
                    if (giftsLeft != null) GiftsLeftBadge(giftsLeft, slots = slots, light = light)
                }
            }
            Image(
                painterResource(R.drawable.art_scene_gift_pro), contentDescription = null, contentScale = ContentScale.Fit,
                modifier = Modifier.height(92.dp).widthIn(max = 110.dp).offset(x = 4.dp, y = (-2).dp).clearAndSetSemantics { },
            )
        }
        content()
        if (onSend != null) {
            CandyButton(
                sendLabel, onClick = onSend, color = CandyColor.AMBER, size = CandySize.MEDIUM,
                modifier = Modifier.fillMaxWidth(), fill = true, enabled = sendEnabled,
                leading = { Icon(Icons.Filled.CardGiftcard, null, tint = Color.White, modifier = Modifier.size(17.dp)) },
            )
        }
        footer()
    }
}

/** T4 the gift-shield art (U guarding the flame), small, decorative — for gift-shield rows and notices. */
@Composable
fun ShieldGuardArt(height: Dp, modifier: Modifier = Modifier) {
    Image(
        painterResource(R.drawable.art_scene_shield_guard), contentDescription = null, contentScale = ContentScale.Fit,
        modifier = modifier.heightIn(max = height).height(height).widthIn(max = height * (894f / 775f)).clearAndSetSemantics { },
    )
}
