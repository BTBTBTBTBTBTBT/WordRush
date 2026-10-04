package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import io.github.jan.supabase.auth.auth
import com.wordocious.app.data.FeedbackEvent
import com.wordocious.app.data.ProActivation
import com.wordocious.app.data.ProWelcomeRules
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// FINISH_SPEC AP "Welcome to Pro" (founder 10-02): a full-screen thank-you + the benefits
// rundown, shown ONCE per account right after the first Pro purchase (restores never). The
// rules are pure (data/ProWelcomeRules.kt); this file holds the runtime state, the app-wide
// host (MainActivity), the screen, and the AA1 crown drop onto W in the cast header.

/**
 * AP the welcome's runtime state. StoreManager [armForPurchase]s it BEFORE writing a fresh
 * purchase's grant, then [settle]s it: the welcome shows once the account is actually Pro
 * (the Play webhook may take a few seconds to land the entitlement), or quietly stands
 * down if it never does. While it is armed or on screen, follow-ups that would race it
 * (the R3 paywall launching the Unlimited game) wait via [deferUntilWelcomed] and run
 * after "LET'S PLAY!".
 */
object ProWelcome {
    data class Request(val source: ProActivation, val userId: String, val shieldsBefore: Int?)

    private val lock = Any()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val main = android.os.Handler(android.os.Looper.getMainLooper())

    @Volatile private var armed: Request? = null
    private val queued = mutableListOf<() -> Unit>()

    private val _showing = MutableStateFlow<Request?>(null)
    /** The welcome on screen (the host shows it), or null. */
    val showing: StateFlow<Request?> = _showing.asStateFlow()

    private val _crownDrop = MutableStateFlow(false)
    /** AA1: a crown drop waiting for the cast header (set when the welcome closes). */
    val crownDropPending: StateFlow<Boolean> = _crownDrop.asStateFlow()

    /** How long [settle] waits for the Pro entitlement to land before standing down. */
    private const val SETTLE_TIMEOUT_MS = 90_000L
    private const val SETTLE_POLL_MS = 3_000L

    /**
     * A fresh Play purchase is about to be granted: decide (before the grant changes the
     * profile) whether it earns the welcome. Returns true when armed — the caller then
     * owes one [settle].
     */
    fun armForPurchase(isNewPurchase: Boolean): Boolean {
        val profile = AuthService.profile.value
        val uid = profile?.id
        val welcome = ProWelcomeRules.shouldWelcome(
            source = ProActivation.PURCHASE,
            isNewPurchase = isNewPurchase,
            alreadyWelcomed = uid != null && SettingsPref.get(ProWelcomeRules.flagKey(uid), false),
            wasProActive = AuthService.isProActive,
            signedIn = uid != null,
        )
        if (!welcome || uid == null) return false
        synchronized(lock) {
            if (armed != null || _showing.value != null) return false
            armed = Request(ProActivation.PURCHASE, uid, profile.streakShields)
        }
        return true
    }

    /**
     * After the grant attempt: show the welcome once the account reads Pro (polling the
     * profile while the webhook lands it), or stand down after [SETTLE_TIMEOUT_MS].
     */
    fun settle() {
        val req = synchronized(lock) { armed } ?: return
        scope.launch {
            val start = System.currentTimeMillis()
            fun isPro() = AuthService.userId == req.userId && AuthService.isProActive
            while (!isPro() && System.currentTimeMillis() - start < SETTLE_TIMEOUT_MS) {
                delay(SETTLE_POLL_MS)
                if (AuthService.userId != req.userId) break
                runCatching { AuthService.loadProfile(req.userId) }
            }
            if (isPro()) {
                SettingsPref.set(ProWelcomeRules.flagKey(req.userId), true)
                synchronized(lock) {
                    _showing.value = req
                    armed = null
                }
            } else {
                synchronized(lock) { armed = null }
                runQueued()
            }
        }
    }

    @Volatile private var giftCheckedFor: String? = null

    /**
     * FINISH_SPEC AP (gifted weeks): Android never redeems a referral itself, so a gift redeemed
     * on the web / another device is first seen here as a Pro profile. Once per account per run:
     * when Pro is live, the account wasn't welcomed and the expiry has a gift week's shape, ask
     * the server marker (GET /api/pro/gift, the caller's redeemed referral) and welcome the gift.
     */
    fun checkGift() {
        val profile = AuthService.profile.value ?: return
        val uid = profile.id
        if (!AuthService.isProActive || SettingsPref.get(ProWelcomeRules.flagKey(uid), false)) return
        val exp = profile.proExpiresAt?.let { AuthService.parseTimestamp(it)?.toEpochMilli() }
        if (!ProWelcomeRules.giftShaped(exp, System.currentTimeMillis())) return
        synchronized(lock) {
            if (giftCheckedFor == uid || armed != null || _showing.value != null) return
            giftCheckedFor = uid
        }
        scope.launch {
            val token = com.wordocious.app.data.SupabaseConfig.client.auth.currentSessionOrNull()?.accessToken ?: return@launch
            val redeemedAt = runCatching {
                val conn = java.net.URL("https://wordocious.com/api/pro/gift").openConnection() as java.net.HttpURLConnection
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.connectTimeout = 10_000; conn.readTimeout = 10_000
                val body = try { if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null } finally { conn.disconnect() }
                body?.let { org.json.JSONObject(it).optJSONObject("gift")?.optString("redeemedAt") }
                    ?.takeIf { it.isNotBlank() }
                    ?.let { AuthService.parseTimestamp(it)?.toEpochMilli() }
            }.getOrNull()
            if (!ProWelcomeRules.giftWelcomeDue(redeemedAt, System.currentTimeMillis())) return@launch
            if (AuthService.userId != uid || SettingsPref.get(ProWelcomeRules.flagKey(uid), false)) return@launch
            SettingsPref.set(ProWelcomeRules.flagKey(uid), true)
            synchronized(lock) {
                if (armed == null && _showing.value == null) _showing.value = Request(ProActivation.GIFT, uid, null)
            }
        }
    }

    /**
     * Run [action] after the welcome closes when one is armed or showing (returns true);
     * otherwise returns false and the caller runs it now.
     */
    fun deferUntilWelcomed(action: () -> Unit): Boolean = synchronized(lock) {
        if (armed == null && _showing.value == null) return false
        queued += action
        true
    }

    /** "LET'S PLAY!" (or back): close the welcome, run what waited, then drop the crown. */
    fun finish() {
        synchronized(lock) { _showing.value = null }
        _crownDrop.value = true
        runQueued()
    }

    /** AA1: the first live cast header to see the pending drop plays it. */
    internal fun consumeCrownDrop(): Boolean {
        if (!_crownDrop.value) return false
        _crownDrop.value = false
        return true
    }

    private fun runQueued() {
        val run = synchronized(lock) { queued.toList().also { queued.clear() } }
        if (run.isEmpty()) return
        main.post { run.forEach { runCatching { it() } } }
    }
}

// ── The host ─────────────────────────────────────────────────────────────────

/** AP the app-wide host (MainActivity, over everything): the welcome while it is up. */
@Composable
fun ProWelcomeHost() {
    // AP gifted weeks: a Pro profile in a gift week's shape asks the server marker once.
    val profile by AuthService.profile.collectAsState()
    androidx.compose.runtime.LaunchedEffect(profile?.id, profile?.proExpiresAt, profile?.isPro) { ProWelcome.checkGift() }
    val req by ProWelcome.showing.collectAsState()
    val r = req ?: return
    ReportPopup() // CelebrationGate: Pro welcome holds late celebrations
    androidx.activity.compose.BackHandler { ProWelcome.finish() }
    key(r) { ProWelcomeScreen(r, onPlay = { ProWelcome.finish() }) }
}

// ── The screen ───────────────────────────────────────────────────────────────

private val WELCOME_GOLD = Color(0xFFF5A524)
private val WELCOME_CONFETTI = listOf(
    Color(0xFFF5A524), Color(0xFFFFD66B), Color(0xFFFFE9A8), // gold
    Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFF0D9488), Color(0xFF2563EB), Color(0xFFF97316), // the cast
)

private data class WelcomeBenefit(val title: String, val line: String, @DrawableRes val art: Int, val accent: Color)

private val WELCOME_BENEFITS = listOf(
    WelcomeBenefit("Play unlimited", "Fresh puzzles in every game, any time", R.drawable.art_scene_unlimited_loop, Color(0xFFF97316)),
    WelcomeBenefit("No ads, ever", "Nothing between you and the next word", R.drawable.icon3d_badge_check, Color(0xFF10B981)),
    WelcomeBenefit("VS everything", "Challenge anyone in every mode", R.drawable.art_badge_swords, Color(0xFF0D9488)),
    WelcomeBenefit("Battle the cast", "Take on all ten of the cast", R.drawable.art_scene_ladder_cleared, Color(0xFF7C3AED)),
    WelcomeBenefit("4 shields a cycle", "Fresh streak shields every billing period", R.drawable.art_scene_shield_guard, Color(0xFF2563EB)),
    WelcomeBenefit("Gift Pro", "Send friends a free week", R.drawable.art_scene_gift_pro, Color(0xFFEC4899)),
    WelcomeBenefit("The Pro look", "A crown on W, gold frames, Pro hats + backdrops", R.drawable.art_badge_level_pro, WELCOME_GOLD),
    WelcomeBenefit("Deeper stats", "Trends and speed in every mode", R.drawable.art_badge_trending_up, Color(0xFF6366F1)),
)

/** When the benefit cards start popping in (after the crown art lands). */
private const val CARDS_BASE_MS = 520L

@Composable
private fun ProWelcomeScreen(req: ProWelcome.Request, onPlay: () -> Unit) {
    val dark = WTheme.isDark
    val calm = WTheme.calmMotion
    val view = androidx.compose.ui.platform.LocalView.current
    val profile by AuthService.profile.collectAsState()
    val headline = ProWelcomeRules.headline(req.source)
    var gift by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        // `celebrate` + the success haptic (spec U), once.
        SoundManager.fire(FeedbackEvent.CELEBRATE, view)
        // The +4 shields come from the Play webhook; look again for the chip.
        delay(4_000)
        AuthService.refreshProfile()
    }
    val credited = ProWelcomeRules.shieldsCredited(req.shieldsBefore, profile?.streakShields)
    val heading = if (dark) WTheme.text else FinishInk.heading
    val muted = if (dark) WTheme.textSecondary else FinishInk.muted

    Box(
        Modifier.fillMaxSize()
            .background(
                if (dark) Brush.verticalGradient(listOf(WTheme.bg, WTheme.bg))
                else Brush.verticalGradient(listOf(Color(0xFFFFF1CF), Color(0xFFFFF8EA), Wash.mix(Color(0xFF7C3AED), 0.06f))),
            )
            // Full screen: nothing underneath takes a tap.
            .pointerInput(Unit) { detectTapGestures { } }
            .semantics { paneTitle = headline },
    ) {
        WelcomeRays(spin = !calm, modifier = Modifier.fillMaxWidth().height(460.dp))
        Column(
            Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                SceneArtPop(R.drawable.art_scene_pro_crown, height = 176.dp, glow = Color(0xFFFFE08A), delayMs = 120L)
                GoldLettering(
                    headline,
                    Modifier.fillMaxWidth().semantics(mergeDescendants = true) {
                        heading()
                        liveRegion = LiveRegionMode.Polite
                    },
                )
                Text(
                    ProWelcomeRules.thanksLine(profile?.username),
                    fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = muted, textAlign = TextAlign.Center,
                    lineHeight = 1.3.em, modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                )
                Spacer(Modifier.height(2.dp))
                WELCOME_BENEFITS.chunked(2).forEachIndexed { row, pair ->
                    Row(
                        Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        pair.forEachIndexed { col, b ->
                            BenefitCard(
                                b, heading, muted,
                                delayMs = ProWelcomeRules.cardDelayMs(row * 2 + col, CARDS_BASE_MS),
                                modifier = Modifier.weight(1f).fillMaxHeight(),
                            )
                        }
                    }
                }
                if (credited != null) ShieldChip(ProWelcomeRules.shieldChip(credited))
                Spacer(Modifier.height(2.dp))
                CastButton(
                    "LET'S PLAY!", onClick = onPlay, color = CastColor.GOLD, size = CastSize.L,
                    fill = true, contentDescription = "Let's play",
                    modifier = Modifier.fillMaxWidth(),
                )
                GiftLinkChip { gift = true }
            }
        }
        // Falling gold + cast confetti: a few bursts, one under calm motion (Battery Saver);
        // none with Reduce Motion (PopupConfetti draws nothing then).
        var burst by remember { mutableIntStateOf(0) }
        LaunchedEffect(calm) {
            if (calm) return@LaunchedEffect
            repeat(2) { delay(3_600); burst++ }
        }
        key(burst) { PopupConfetti(WELCOME_CONFETTI, count = 72) }
    }
    if (gift) GiftWeekSheet(onDismiss = { gift = false })
}

/** AP the gold sunburst behind the crown art, slowly turning (static when [spin] is off). Decorative. */
@Composable
private fun WelcomeRays(spin: Boolean, modifier: Modifier = Modifier) {
    val turn = if (!spin) null else rememberInfiniteTransition(label = "welcomeRays").animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(60_000, easing = LinearEasing), RepeatMode.Restart),
        label = "rays",
    )
    val status = with(LocalDensity.current) {
        androidx.compose.foundation.layout.WindowInsets.statusBars.getTop(this).toFloat()
    }
    Canvas(modifier.clearAndSetSemantics { }) {
        val c = Offset(size.width / 2f, status + 12.dp.toPx() + 96.dp.toPx())
        val r = maxOf(size.width, size.height) * 0.9f
        val rays = Path()
        var deg = 0f
        while (deg < 360f) {
            val a0 = deg * PI.toFloat() / 180f
            val a1 = (deg + 9f) * PI.toFloat() / 180f
            rays.moveTo(c.x, c.y)
            rays.lineTo(c.x + r * cos(a0), c.y + r * sin(a0))
            rays.lineTo(c.x + r * cos(a1), c.y + r * sin(a1))
            rays.close()
            deg += 20f
        }
        rotate(turn?.value ?: 0f, c) {
            drawPath(
                rays,
                Brush.radialGradient(
                    0f to WELCOME_GOLD.copy(alpha = 0.30f), 0.5f to WELCOME_GOLD.copy(alpha = 0.14f), 1f to WELCOME_GOLD.copy(alpha = 0f),
                    center = c, radius = r,
                ),
            )
        }
        val g = 150.dp.toPx()
        drawCircle(
            Brush.radialGradient(0f to Color(0xFFFFE08A).copy(alpha = 0.5f), 1f to Color(0xFFFFE08A).copy(alpha = 0f), center = c, radius = g),
            radius = g, center = c,
        )
    }
}

/**
 * AP the lettering-style headline: Nunito Black in a gold gradient with a dark-purple
 * outline and a soft drop (the title-art look, live text so it reads and scales).
 */
@Composable
private fun GoldLettering(text: String, modifier: Modifier = Modifier) {
    val px = LocalDensity.current.density
    val base = TextStyle(
        fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = 34.sp, lineHeight = 1.08.em,
        letterSpacing = 0.02.em, textAlign = TextAlign.Center,
    )
    Box(modifier, contentAlignment = Alignment.Center) {
        Text(
            text, modifier = Modifier.fillMaxWidth().clearAndSetSemantics { },
            style = base.copy(
                color = Color(0xFF3B1A78),
                drawStyle = Stroke(width = 6f * px, join = StrokeJoin.Round),
                shadow = androidx.compose.ui.graphics.Shadow(Color(0x663B1A78), Offset(0f, 3f * px), 6f * px),
            ),
        )
        Text(
            text, modifier = Modifier.fillMaxWidth(),
            style = base.copy(
                brush = Brush.verticalGradient(listOf(Color(0xFFFFF1B0), Color(0xFFFFC94A), Color(0xFFF59E0B), Color(0xFFE07B0C))),
            ),
        )
    }
}

/** AP one benefit: a tinted card with its top bar, the 3D art, a short title + one line, popping in. */
@Composable
private fun BenefitCard(b: WelcomeBenefit, heading: Color, muted: Color, delayMs: Long, modifier: Modifier = Modifier) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(still) {
        if (still) { pop.snapTo(1f); return@LaunchedEffect }
        delay(delayMs)
        pop.animateTo(1f, Motion.springIn()) // AZ: the shared spring family
    }
    TintedCard(
        b.accent,
        modifier
            .graphicsLayer {
                val s = 0.6f + 0.4f * pop.value
                scaleX = s; scaleY = s
                alpha = pop.value.coerceIn(0f, 1f)
            }
            .semantics(mergeDescendants = true) { },
        corner = 18.dp,
        bar = SolidColor(b.accent),
        barHeight = 8.dp,
        contentPadding = PaddingValues(start = 10.dp, end = 10.dp, top = 10.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Image(
            painterResource(b.art), contentDescription = null, contentScale = ContentScale.Fit,
            modifier = Modifier.size(58.dp).align(Alignment.CenterHorizontally),
        )
        Text(
            b.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = heading, textAlign = TextAlign.Center,
            lineHeight = 1.15.em, modifier = Modifier.fillMaxWidth(),
        )
        Text(
            b.line, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = muted, textAlign = TextAlign.Center,
            lineHeight = 1.25.em, modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** AP the "Your 4 streak shields are ready" chip (only when shields were credited). */
@Composable
private fun ShieldChip(text: String) {
    val shield = MomentInk.shield
    Row(
        Modifier.tintedPill(shield, corner = 18.dp).padding(start = 8.dp, end = 14.dp, top = 8.dp, bottom = 6.dp)
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Image(painterResource(R.drawable.art_scene_shield_guard), null, Modifier.size(34.dp))
        Text(
            text, fontSize = 13.sp, fontWeight = FontWeight.Black,
            color = if (WTheme.isDark) WTheme.text else darkenInk(shield),
        )
    }
}

/** AP the "Gift a friend a free week" link chip (→ the T4 gift panel). */
@Composable
private fun GiftLinkChip(onClick: () -> Unit) {
    val pink = Color(0xFFEC4899)
    Row(
        Modifier.squishClickable("Gift a friend a free week of Pro", onClick = onClick)
            .tintedPill(pink, corner = 18.dp)
            .heightIn(min = 40.dp)
            .padding(start = 8.dp, end = 14.dp, top = 6.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Image(painterResource(R.drawable.art_scene_gift_pro), null, Modifier.size(28.dp).clearAndSetSemantics { })
        Text(
            "Gift a friend a free week", fontSize = 13.sp, fontWeight = FontWeight.Black,
            color = if (WTheme.isDark) WTheme.text else darkenInk(pink),
        )
    }
}

/** AP the T4 gift panel ("GIFT A WEEK OF PRO", ui/InvitePanel.kt) in a tinted sheet over the welcome. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GiftWeekSheet(onDismiss: () -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    SoftModalSheet(
        onDismissRequest = onDismiss, sheetState = state,
        containerColor = if (WTheme.isDark) WTheme.bg else Wash.mix(WELCOME_GOLD, 0.08f),
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 14.dp, end = 14.dp, bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            InvitePanel()
            CastButton("Close", onClick = onDismiss, color = CastColor.SLATE, size = CastSize.M)
        }
    }
}

// ── AA1 the crown drop ───────────────────────────────────────────────────────

/**
 * AA1 after the welcome: the crown on W in the cast header drops in from above with a
 * bounce and a sparkle, once. Applied to the crown sprite (ui/CastHeader.kt CrownOnW).
 * While the welcome is up (or the drop waits) the crown stays hidden so it arrives with
 * the drop. Reduce Motion: it simply appears (no drop, no sparkle).
 */
fun Modifier.proCrownDrop(): Modifier = composed {
    val showing by ProWelcome.showing.collectAsState()
    val pending by ProWelcome.crownDropPending.collectAsState()
    val hidden by LocalTabHidden.current
    val still = WTheme.reducedMotion
    val drop = remember { Animatable(0f) }
    val fade = remember { Animatable(1f) }
    val sparkle = remember { Animatable(0f) }
    var go by remember { mutableIntStateOf(0) }
    // Claim the pending drop (re-keyed by the claim itself, so the animation lives in its
    // own effect below). The crown is parked up high + invisible BEFORE the claim, so it
    // never flashes in place for a frame.
    LaunchedEffect(pending, hidden, showing) {
        if (!pending || hidden || showing != null) return@LaunchedEffect
        if (!still) { drop.snapTo(1f); fade.snapTo(0f) }
        if (ProWelcome.consumeCrownDrop()) { if (!still) go++ }
        else { drop.snapTo(0f); fade.snapTo(1f) }
    }
    LaunchedEffect(go) {
        if (go == 0) return@LaunchedEffect
        delay(260)
        launch { fade.animateTo(1f, tween(160)) }
        drop.animateTo(0f, Motion.springIn()) // AZ: the shared spring family
        SoundManager.fire(FeedbackEvent.HOP)
        sparkle.snapTo(0f)
        sparkle.animateTo(1f, tween(720, easing = LinearEasing))
        sparkle.snapTo(0f)
    }
    val waiting = showing != null || pending
    this
        .graphicsLayer {
            translationY = -drop.value * size.height * 2.4f
            alpha = if (waiting) 0f else fade.value
        }
        .drawWithContent {
            drawContent()
            val t = sparkle.value
            if (t <= 0f || t >= 1f) return@drawWithContent
            val k = if (t < 0.5f) t * 2f else (1f - t) * 2f
            val c = Offset(size.width / 2f, size.height / 2f)
            val reach = size.minDimension * (0.45f + 0.35f * t)
            for (i in 0 until 5) {
                val a = (-150f + i * 30f) * PI.toFloat() / 180f
                val p = Offset(c.x + reach * cos(a), c.y + reach * sin(a))
                val r = size.minDimension * (if (i % 2 == 0) 0.16f else 0.11f) * k
                val w = r * 0.3f
                val star = Path().apply {
                    moveTo(p.x, p.y - r); lineTo(p.x + w, p.y - w); lineTo(p.x + r, p.y); lineTo(p.x + w, p.y + w)
                    lineTo(p.x, p.y + r); lineTo(p.x - w, p.y + w); lineTo(p.x - r, p.y); lineTo(p.x - w, p.y - w); close()
                }
                drawCircle(Color(0xFFFFF4C2).copy(alpha = 0.5f * k), radius = r * 0.7f, center = p)
                drawPath(star, Color.White.copy(alpha = k))
            }
        }
}
