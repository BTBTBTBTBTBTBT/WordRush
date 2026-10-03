package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// FINISH_SPEC AA (founder 10-02: "there is no Pro identifier anymore, we need to cleverly
// get that inputted back somewhere nicely"). The Pro identity kit:
//  AA1 the crown sprite W wears in the living cast header + the "You're Pro" sheet;
//  AA2 the Pro avatar decoration (thin gold ring + the tiny crown at the top-right);
//  AA3 the gold WORDOCIOUS PRO member card (Settings) / the Go Pro upsell in its slot.
// Pure text helpers live in [ProIdentityText] (ProIdentityTest).

/** The Pro gold (G1). */
internal val PRO_ID_GOLD = Color(0xFFF5A524)

/** AA pure copy helpers (unit-tested). */
object ProIdentityText {
    private val MONTHS = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    )

    /** "Member since October 2026" from a profiles.created_at timestamp; null when absent/malformed. */
    fun memberSince(createdAt: String?): String? {
        val s = createdAt?.trim() ?: return null
        if (s.length < 7 || s[4] != '-') return null
        val y = s.substring(0, 4).toIntOrNull() ?: return null
        val m = s.substring(5, 7).toIntOrNull() ?: return null
        if (m !in 1..12) return null
        return "Member since ${MONTHS[m - 1]} $y"
    }

    /**
     * The Pro window's end as "Oct 30, 2026" (local date) — the renewal date for an
     * auto-renewing plan, the last day for a canceled plan or a Day Pass. Null for a
     * legacy row with no expiry, or an unparseable one.
     */
    fun throughDate(expiresAt: String?, zone: ZoneId = ZoneId.systemDefault()): String? {
        val instant = parseInstant(expiresAt) ?: return null
        // Far-future sentinels (no-expiry grants) read as no end date.
        if (instant.isAfter(Instant.parse("2100-01-01T00:00:00Z"))) return null
        return DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).format(instant.atZone(zone))
    }

    /** The sheet / card's renewal line. */
    fun renewalLine(expiresAt: String?, zone: ZoneId = ZoneId.systemDefault()): String =
        throughDate(expiresAt, zone)?.let { "Renews or ends $it" } ?: "No end date"

    /** The plan line. Play doesn't tell the client which plan is active, so it names the membership. */
    fun planLine(expiresAt: String?): String =
        if (expiresAt == null) "Wordocious Pro · no end date" else "Wordocious Pro · every game unlimited, no ads"

    /** PostgREST timestamptz (…Z or …+00:00, optional fraction) to an Instant. */
    fun parseInstant(ts: String?): Instant? {
        val s = ts?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return runCatching { java.time.OffsetDateTime.parse(s).toInstant() }.getOrNull()
            ?: runCatching { Instant.parse(s) }.getOrNull()
            ?: runCatching { java.time.OffsetDateTime.parse(s.replace(' ', 'T')).toInstant() }.getOrNull()
    }

    /** AA2 a player's avatar is crowned when it is the signed-in Pro player's own. */
    fun isOwnPro(username: String?, ownUsername: String?, ownProActive: Boolean): Boolean =
        ownProActive && !username.isNullOrBlank() && !ownUsername.isNullOrBlank() &&
            username.trim().equals(ownUsername.trim(), ignoreCase = true)
}

/**
 * AA2 whether [username] is the signed-in player AND they are Pro (no backend rows carry
 * other players' Pro flag, so only the own avatar is crowned today). Reads the current
 * profile; recomposes with whatever screen collects the profile.
 */
fun isOwnProAvatar(username: String?): Boolean =
    ProIdentityText.isOwnPro(username, AuthService.profile.value?.username, AuthService.isProActive)

/** Opens Play's manage-subscriptions page for this app (the Settings SUBSCRIPTION action). */
fun openManageSubscription(context: android.content.Context) {
    runCatching {
        context.startActivity(
            android.content.Intent(
                android.content.Intent.ACTION_VIEW,
                android.net.Uri.parse("https://play.google.com/store/account/subscriptions?package=com.wordocious.app"),
            ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}

// ── BJ11 the subscription hand-off ───────────────────────────────────────────

/**
 * FINISH_SPEC BJ11 (founder 10-03: "When I clicked check subscription somewhere the Apple
 * menu popped up"): before Play's own subscriptions page opens, a short sheet in our look
 * says what is about to open — W points the way, one line, why it's Play's page, the
 * candy CTA, and Restore Purchases. Every Manage subscription entry point shows it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageSubscriptionHandoff(onDismiss: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val dark = WTheme.isDark
    val copy = com.wordocious.app.data.SubscriptionCopy.handoff(com.wordocious.app.data.SubscriptionCopy.Store.GOOGLE)
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    SoftModalSheet(
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = if (dark) WTheme.bg else Wash.mix(PRO_ID_GOLD, 0.12f),
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 22.dp, end = 22.dp, bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            CastPose(MascotId.W, "point", 96.dp)
            Text(
                copy.line, fontSize = 19.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                color = if (dark) WTheme.text else FinishInk.heading, textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                copy.body, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = if (dark) WTheme.textMuted else FinishInk.muted,
            )
            CandyButton(
                copy.cta, onClick = { openManageSubscription(context); onDismiss() },
                color = CandyColor.AMBER, size = CandySize.LARGE, fill = true, icon = CandyIcon.ARROW,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
            CandyButton(
                "Restore Purchases", onClick = { com.wordocious.app.data.StoreManager.restore() },
                color = CandyColor.PEACH, size = CandySize.SMALL,
            )
        }
    }
}

// ── AA1 the crown sprite ─────────────────────────────────────────────────────

/**
 * AA1 the gold crown sprite (`art_badge_pro_crown_sprite`), [size] square, tilted
 * [tilt]° — with [twinkle] a tiny sparkle glints on its top-right every ~8 s (never
 * with Reduce Motion). Decorative.
 */
@Composable
fun ProCrownSprite(size: Dp, modifier: Modifier = Modifier, tilt: Float = -8f, twinkle: Boolean = false) {
    val still = WTheme.reducedMotion
    val glint = remember { Animatable(0f) }
    LaunchedEffect(twinkle, still) {
        glint.snapTo(0f)
        if (!twinkle || still) return@LaunchedEffect
        delay(2600)
        while (true) {
            glint.snapTo(0f)
            glint.animateTo(1f, tween(700, easing = LinearEasing))
            glint.snapTo(0f)
            delay(PRO_CROWN_TWINKLE_MS - 700)
        }
    }
    Box(modifier.requiredSize(size).clearAndSetSemantics { }) {
        Image(
            artPainter(R.drawable.art_badge_pro_crown_sprite, size), contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.requiredSize(size).graphicsLayer { rotationZ = tilt },
        )
        if (twinkle && !still) {
            Canvas(Modifier.requiredSize(size)) {
                val t = glint.value
                if (t <= 0f) return@Canvas
                // 0 → 1 → 0 scale with a quarter turn: a four-point star glint.
                val k = if (t < 0.5f) t * 2f else (1f - t) * 2f
                val c = Offset(this.size.width * 0.78f, this.size.height * 0.2f)
                val r = this.size.minDimension * 0.2f * k
                val w = r * 0.28f
                val star = Path().apply {
                    moveTo(c.x, c.y - r); lineTo(c.x + w, c.y - w); lineTo(c.x + r, c.y); lineTo(c.x + w, c.y + w)
                    lineTo(c.x, c.y + r); lineTo(c.x - w, c.y + w); lineTo(c.x - r, c.y); lineTo(c.x - w, c.y - w); close()
                }
                drawCircle(Color(0xFFFFF4C2).copy(alpha = 0.55f * k), radius = r * 0.7f, center = c)
                drawPath(star, Color.White.copy(alpha = k))
            }
        }
    }
}

/** AA1 the crown's twinkle period. */
internal const val PRO_CROWN_TWINKLE_MS = 8000L

// ── AA1 the "You're Pro" sheet ───────────────────────────────────────────────

/** AA1 the small gold-tinted "You're Pro" sheet: the Pro badge, plan, member since, renewal, Manage. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YoureProSheet(onDismiss: () -> Unit) {
    val profile by AuthService.profile.collectAsState()
    val dark = WTheme.isDark
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var manage by remember { mutableStateOf(false) }
    if (manage) ManageSubscriptionHandoff(onDismiss = { manage = false })
    SoftModalSheet(
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = if (dark) WTheme.bg else Wash.mix(PRO_ID_GOLD, 0.12f),
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Image(
                painterResource(R.drawable.art_badge_level_pro), contentDescription = null,
                modifier = Modifier.size(84.dp).clearAndSetSemantics { },
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "You're Pro", fontSize = 22.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                    color = if (dark) WTheme.text else FinishInk.heading,
                    modifier = Modifier.semantics { heading() },
                )
                ProCrownSprite(26.dp)
            }
            ProFacts(profile, dark)
            CandyButton(
                "Manage subscription", onClick = { manage = true },
                color = CandyColor.AMBER, size = CandySize.MEDIUM, fill = true, modifier = Modifier.fillMaxWidth(),
            )
            CandyButton("Close", onClick = onDismiss, color = CandyColor.PEACH, size = CandySize.MEDIUM)
        }
    }
}

/** The plan / member-since / renewal lines in a gold tinted pill. */
@Composable
private fun ProFacts(profile: com.wordocious.app.data.Profile?, dark: Boolean, center: Boolean = true) {
    Column(
        Modifier.fillMaxWidth().tintedPill(PRO_ID_GOLD, 14.dp).padding(horizontal = 14.dp, vertical = 10.dp)
            .semantics(mergeDescendants = true) { },
        horizontalAlignment = if (center) Alignment.CenterHorizontally else Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        val ink = if (dark) WTheme.text else FinishInk.heading
        val muted = if (dark) WTheme.textMuted else FinishInk.muted
        Text(
            ProIdentityText.planLine(profile?.proExpiresAt), fontSize = 13.sp, fontWeight = FontWeight.Black,
            color = ink, textAlign = if (center) TextAlign.Center else TextAlign.Start,
        )
        ProIdentityText.memberSince(profile?.createdAt)?.let {
            Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = muted)
        }
        Text(ProIdentityText.renewalLine(profile?.proExpiresAt), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = muted)
    }
}

// ── AA2 the Pro avatar decoration ────────────────────────────────────────────

/**
 * AA2 → AN6: a Pro avatar's thin gold frame — a ROUNDED SQUARE (radius ≈ 22%, the mascot
 * tile shape; never a ring), drawn 1.5 dp outside the avatar so the face is never
 * covered. [shape] is kept for source compatibility and ignored. No-op unless [pro].
 */
@Suppress("UNUSED_PARAMETER")
fun Modifier.proAvatarRing(pro: Boolean, shape: Shape): Modifier = if (!pro) this else drawBehind {
    val gap = 1.5.dp.toPx()
    val stroke = 1.75.dp.toPx()
    val inset = gap + stroke / 2f
    val w = size.width + inset * 2
    val h = size.height + inset * 2
    val r = minOf(size.width, size.height) * 0.22f + inset
    translate(-inset, -inset) {
        drawRoundRect(
            Brush.linearGradient(listOf(Color(0xFFFFE08A), Color(0xFFF5A524), Color(0xFFD97706))),
            size = Size(w, h),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(r),
            style = Stroke(stroke),
        )
    }
}

/**
 * AA2 the tiny crown on a Pro avatar's top-right corner (≈35% of the avatar [size]),
 * tilted like W's. Place it inside the avatar's (unclipped) Box.
 */
@Composable
fun androidx.compose.foundation.layout.BoxScope.ProAvatarCrown(size: Dp) {
    val c = size * 0.35f
    ProCrownSprite(c, Modifier.align(Alignment.TopEnd).offset(x = c * 0.32f, y = -c * 0.42f), tilt = 12f)
}

/**
 * AA2 any avatar (photo or tile) [size] square in [shape], with the Pro ring + crown
 * when [pro]. For photo helpers: wrap the AsyncImage in this.
 */
@Composable
@Suppress("UNUSED_PARAMETER")
fun ProAvatarFrame(pro: Boolean, size: Dp, shape: Shape, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    // AN6: the Pro gold is the rounded-square frame (not a ring); [shape] is ignored.
    Box(modifier.size(size)) {
        content()
        if (pro) {
            AvatarSquareFrame("pro", size, Modifier.fillMaxSize())
            ProAvatarCrown(size)
        }
    }
}

// ── AA3 the Settings member card / upsell ────────────────────────────────────

/**
 * AA3 the slot at the top of Settings: for Pro members a gold-tinted "WORDOCIOUS PRO"
 * member card (the level-pro badge, plan, member since, renewal, Manage subscription
 * candy); for free players and guests the same slot is a G1 upsell card (W with the
 * pro crown, "Go Pro" amber candy) that opens the redesigned Go Pro paywall in place.
 */
@Composable
fun ProSettingsCard(modifier: Modifier = Modifier) {
    val profile by AuthService.profile.collectAsState()
    val pro = profile != null && AuthService.isProActive
    val dark = WTheme.isDark
    var paywall by remember { mutableStateOf(false) }
    if (paywall) com.wordocious.app.ui.game.ProPaywallDialog(onDismiss = { paywall = false }, onPro = { paywall = false })
    var manage by remember { mutableStateOf(false) }
    if (manage) ManageSubscriptionHandoff(onDismiss = { manage = false })
    TintedCard(
        PRO_ID_GOLD, modifier.fillMaxWidth(), bar = MomentInk.proBar,
        tint = accentWash(PRO_ID_GOLD, 0.16f),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Image(
                painterResource(if (pro) R.drawable.art_badge_level_pro else R.drawable.art_scene_pro_crown),
                contentDescription = null, contentScale = ContentScale.Fit,
                modifier = Modifier.size(if (pro) 64.dp else 76.dp).clearAndSetSemantics { },
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (pro) "WORDOCIOUS PRO" else "GO PRO", fontSize = 15.sp, fontWeight = FontWeight.Black,
                    fontFamily = Nunito, letterSpacing = 1.sp,
                    color = if (dark) Color(0xFFFFD66B) else darkenInk(PRO_ID_GOLD),
                    modifier = Modifier.semantics { heading() },
                )
                if (pro) {
                    ProIdentityText.memberSince(profile?.createdAt)?.let {
                        Text(it, fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.text else FinishInk.heading)
                    }
                    Text(
                        ProIdentityText.planLine(profile?.proExpiresAt), fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = if (dark) WTheme.textMuted else FinishInk.muted,
                    )
                    Text(
                        ProIdentityText.renewalLine(profile?.proExpiresAt), fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = if (dark) WTheme.textMuted else FinishInk.muted,
                    )
                } else {
                    // BJ11: a former member's upsell names the day their Pro ended.
                    val lapsed = com.wordocious.app.data.SubscriptionCopy.lapsedLine(profile?.proExpiresAt, AuthService.isProActive)
                    Text(
                        lapsed?.let { "$it. Switch it back on any time." } ?: "Every game unlimited, no ads, VS on every mode.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = if (dark) WTheme.textMuted else FinishInk.muted,
                    )
                }
            }
        }
        if (pro) {
            CandyButton(
                "Manage subscription", onClick = { manage = true },
                color = CandyColor.AMBER, size = CandySize.MEDIUM, fill = true, modifier = Modifier.fillMaxWidth(),
            )
        } else {
            CandyButton(
                "Go Pro", onClick = { paywall = true },
                color = CandyColor.AMBER, size = CandySize.MEDIUM, fill = true, modifier = Modifier.fillMaxWidth(),
                leading = { ProCrownSprite(22.dp, tilt = 0f) },
            )
        }
    }
}
