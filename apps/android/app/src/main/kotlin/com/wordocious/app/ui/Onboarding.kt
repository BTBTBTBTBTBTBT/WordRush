package com.wordocious.app.ui

import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.Profile
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import kotlinx.coroutines.launch

// FINISH_SPEC AO (supersedes W): the first-run welcome + guided profile setup. After the
// cold-start intro, a brand-new player sees 1 WELCOME → 2 QUICK TOUR (4 swipe cards) →
// 3 MAKE YOUR PROFILE (the existing auth screen, then a username) → 4 MAKE YOUR MASCOT
// (the AN builder with W coaching) → 5 ALL SET. Every screen: the wallpaper, lettering
// headline, cast art, candy buttons, squish, a whoosh between steps, page dots, Skip
// top-right on 2–4; Reduce Motion / calm motion = crossfades. Existing players never see
// it (their flag is set silently); How to Play → "Take the tour" replays steps 1–2.
// The routing is the pure OnboardingFlow (OnboardingFlowTest); steps 3–5 live in
// OnboardingProfile.kt and OnboardingMascot.kt.

/**
 * AO who sees the flow. Pure (no Android), unit-tested in OnboardingGateTest.
 *
 * At launch ([prime]) a device with no earlier launch on record and no local game data
 * is marked PENDING (a brand-new player); any other device is marked done silently (an
 * existing player) — including anyone who already finished or skipped W's tour
 * (`onboarded-v1`). The flow then shows for a pending device once the intro is out of
 * the way — unless the signed-in profile shows that this account has already played
 * somewhere (a reinstall / new phone): then it is marked done without showing.
 */
object OnboardingGate {
    const val FLAG = "onboarded-v2"
    const val PENDING = "onboard-pending-v2"
    /** The step a pending first run was left on (resume after the app is closed mid-flow). */
    const val STEP = "onboard-step-v2"
    /** W's flags: done there = an existing player here; pending there = still brand new. */
    const val LEGACY_FLAG = "onboarded-v1"
    const val LEGACY_PENDING = "onboard-pending-v1"

    enum class Prime { MARK_PENDING, MARK_DONE, NOTHING }

    /** The launch-time verdict. [firstLaunchEver] = no launch recorded before this one. */
    fun prime(
        flagged: Boolean,
        pending: Boolean,
        firstLaunchEver: Boolean,
        hasLocalGameData: Boolean,
        legacyDone: Boolean = false,
        legacyPending: Boolean = false,
    ): Prime = when {
        flagged || pending -> Prime.NOTHING
        hasLocalGameData || legacyDone -> Prime.MARK_DONE
        firstLaunchEver || legacyPending -> Prime.MARK_PENDING
        else -> Prime.MARK_DONE
    }

    enum class Decision { SHOW, MARK_DONE, WAIT, NONE }

    /**
     * The in-app verdict. [signedIn] = a real account (not a guest); [profile] = its
     * row (null while it loads); [blocked] = the cold-start intro is up.
     */
    fun decide(flagged: Boolean, pending: Boolean, signedIn: Boolean, profile: Profile?, blocked: Boolean): Decision = when {
        flagged || !pending -> Decision.NONE
        signedIn && profile == null -> Decision.WAIT
        signedIn && hasPlayed(profile) -> Decision.MARK_DONE
        blocked -> Decision.WAIT
        else -> Decision.SHOW
    }

    /** Whether a profile row shows any play at all (results, a streak, medals). */
    fun hasPlayed(p: Profile?): Boolean = p != null && (
        p.totalWins + p.totalLosses > 0 || p.lastPlayedAt != null || p.bestStreak > 0 ||
            p.goldMedals + p.silverMedals + p.bronzeMedals > 0
        )
}

/** AO the runtime side: the flags, the launch prime, the step on screen and the replay. */
object Onboarding {
    /** True while a replay (How to Play → Take the tour) is asked for. */
    var replaying by mutableStateOf(false)
        private set

    /** The step on screen; null = the flow is not showing. */
    var step by mutableStateOf<OnboardingStep?>(null)
        private set

    /** The flow on screen is a replay (steps 1–2 only, no flags touched). */
    var isReplay by mutableStateOf(false)
        private set

    /** The first run finished for a signed-in account: its username card is handled. */
    private var welcomeHandled by mutableStateOf(false)

    /**
     * True while the flow is up, or once it handled the account's username — MainActivity
     * then keeps the account Welcome card (WelcomeScreen) down so it never shows twice.
     */
    val coversWelcome: Boolean get() = step != null || welcomeHandled

    /** Bumped when the flags change so the host re-decides. */
    private var version by mutableIntStateOf(0)

    private fun flagged() = runCatching { SettingsPref.get(OnboardingGate.FLAG, false) }.getOrDefault(true)
    private fun pending() = runCatching { SettingsPref.get(OnboardingGate.PENDING, false) }.getOrDefault(false)

    /**
     * Call once in MainActivity.onCreate BEFORE the launch version is recorded:
     * [previousLaunchVersion] = the stored last-launched version code (-1 = never).
     */
    fun prime(previousLaunchVersion: Int) {
        runCatching {
            val verdict = OnboardingGate.prime(
                flagged(), pending(), previousLaunchVersion == -1, hasLocalGameData(),
                legacyDone = SettingsPref.get(OnboardingGate.LEGACY_FLAG, false),
                legacyPending = SettingsPref.get(OnboardingGate.LEGACY_PENDING, false),
            )
            when (verdict) {
                OnboardingGate.Prime.MARK_PENDING -> SettingsPref.set(OnboardingGate.PENDING, true)
                OnboardingGate.Prime.MARK_DONE -> SettingsPref.set(OnboardingGate.FLAG, true)
                OnboardingGate.Prime.NOTHING -> Unit
            }
            SettingsPref.remove(OnboardingGate.LEGACY_PENDING)
        }
    }

    /** Any saved board, recorded result, CPU ladder or VS history on this device. */
    private fun hasLocalGameData(): Boolean {
        val ctx = com.wordocious.app.App.instance
        return listOf("wordocious_games", "wordocious_recorded_matches", "wordocious_cpu", "wordocious_vs").any { name ->
            runCatching { ctx.getSharedPreferences(name, android.content.Context.MODE_PRIVATE).all.isNotEmpty() }.getOrDefault(false)
        }
    }

    /** How to Play / the in-game help → "Take the tour": steps 1–2 again. */
    fun replay() { replaying = true }

    internal fun begin(replay: Boolean, signedIn: Boolean, guest: Boolean) {
        isReplay = replay
        step = if (replay) OnboardingFlow.START else {
            val stored = runCatching { SettingsPref.get(OnboardingGate.STEP, "") }.getOrNull()?.takeIf { it.isNotEmpty() }
            OnboardingFlow.resume(stored, signedIn, guest)
        }
    }

    private fun moveTo(next: OnboardingStep) {
        step = next
        if (!isReplay) runCatching { SettingsPref.set(OnboardingGate.STEP, next.name) }
    }

    /** Apply a player action / an observed sign-in to the step on screen. */
    fun dispatch(event: OnboardingEvent) {
        val s = step ?: return
        val guest = AuthService.isGuest.value
        val signedIn = AuthService.isAuthenticated.value && !guest
        when (val move = OnboardingFlow.next(s, event, OnboardingContext(signedIn, guest, isReplay))) {
            is OnboardingMove.Go -> moveTo(move.step)
            is OnboardingMove.Finish -> complete(move, signedIn)
            OnboardingMove.Stay -> Unit
        }
    }

    private fun complete(move: OnboardingMove.Finish, signedIn: Boolean) {
        if (move.asGuest) runCatching { AuthService.enterGuest() }
        if (!isReplay && signedIn) {
            welcomeHandled = true
            // Skipped before the username was saved: the account still counts as onboarded,
            // so the old Welcome card doesn't pop up afterwards.
            val p = AuthService.profile.value
            if (p != null && !p.hasOnboarded) OnboardingAccount.markOnboarded(p.id)
        }
        finish()
        // MainScreen opens a mode's daily from this one-shot route (the widget chips use it too).
        if (move.playClassic) com.wordocious.app.data.DeepLinkRouter.dailyMode.value = GameMode.DUEL
    }

    /** The username was saved (has_onboarded = true is in the same write). */
    internal fun usernameHandled() { welcomeHandled = true }

    /** Done (finished or skipped): never again unless replayed. */
    fun finish() {
        runCatching {
            SettingsPref.set(OnboardingGate.FLAG, true)
            SettingsPref.remove(OnboardingGate.PENDING)
            SettingsPref.remove(OnboardingGate.STEP)
        }
        replaying = false
        isReplay = false
        step = null
        version++
    }

    internal fun markDoneSilently() {
        runCatching {
            SettingsPref.set(OnboardingGate.FLAG, true)
            SettingsPref.remove(OnboardingGate.PENDING)
            SettingsPref.remove(OnboardingGate.STEP)
        }
        version++
    }

    @Composable
    internal fun decision(signedIn: Boolean, profile: Profile?, blocked: Boolean): OnboardingGate.Decision {
        val v = version
        val flags = remember(v) { flagged() to pending() }
        return OnboardingGate.decide(flags.first, flags.second, signedIn, profile, blocked)
    }
}

/**
 * AO the hook (MainActivity, over the whole app — the sign-in gate included, since a
 * brand-new install starts signed out): shows the flow when [Onboarding] says so.
 * [signedIn] = a real account (not a guest); [blocked] = the cold-start intro is on screen.
 */
@Composable
fun OnboardingHost(signedIn: Boolean, blocked: Boolean) {
    val profile by AuthService.profile.collectAsState()
    val guest by AuthService.isGuest.collectAsState()
    val decision = Onboarding.decision(signedIn, profile, blocked)
    val step = Onboarding.step
    LaunchedEffect(decision, step == null) {
        when {
            // Signed into an account that has already played: straight to Home, flow done.
            step != null && !Onboarding.isReplay && decision == OnboardingGate.Decision.MARK_DONE -> Onboarding.finish()
            step == null && decision == OnboardingGate.Decision.MARK_DONE -> Onboarding.markDoneSilently()
            step == null && decision == OnboardingGate.Decision.SHOW -> Onboarding.begin(replay = false, signedIn, guest)
        }
    }
    LaunchedEffect(Onboarding.replaying, blocked) {
        if (Onboarding.replaying && !blocked && Onboarding.step == null) Onboarding.begin(replay = true, signedIn, guest)
    }
    if (step != null) OnboardingFlowScreen(step, signedIn, guest, profile)
    ReportPresented(step != null) // CelebrationGate: late celebrations wait for onboarding
}

@Composable
private fun OnboardingFlowScreen(step: OnboardingStep, signedIn: Boolean, guest: Boolean, profile: Profile?) {
    val calm = WTheme.calmMotion
    // A session (or a guest entry) arriving on the auth steps moves the flow on.
    LaunchedEffect(step, signedIn, profile?.id, guest) {
        if (!OnboardingFlow.watchesAuth(step)) return@LaunchedEffect
        if (signedIn && profile != null) {
            Onboarding.dispatch(
                OnboardingEvent.Authenticated(
                    needsUsername = !profile.hasOnboarded,
                    hasMascot = runCatching { com.wordocious.app.data.MascotAvatars.ownConfig(profile) != null }.getOrDefault(false),
                ),
            )
        } else if (guest) {
            Onboarding.dispatch(OnboardingEvent.Guest)
        }
    }
    // U: a whoosh between steps.
    var shown by remember { mutableStateOf(step) }
    LaunchedEffect(step) {
        if (step != shown) { shown = step; onboardWhoosh() }
    }
    BackHandler { Onboarding.dispatch(OnboardingEvent.Back) }

    Box(
        Modifier.fillMaxSize()
            .background(WTheme.bg)
            // A cover: nothing underneath takes a tap.
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { },
    ) {
        AnimatedContent(
            targetState = step,
            transitionSpec = {
                if (calm) {
                    fadeIn(tween(220)) togetherWith fadeOut(tween(180))
                } else {
                    val forward = targetState.section >= initialState.section
                    val dir = if (forward) 1 else -1
                    // AZ: the shared spring family for the slide (transform + opacity only), a quick matching exit.
                    (slideInHorizontally(Motion.springIn()) { w -> dir * w / 3 } + fadeIn(tween(220))) togetherWith
                        (slideOutHorizontally(Motion.exit()) { w -> -dir * w / 3 } + fadeOut(Motion.exit()))
                }
            },
            label = "onboarding",
            modifier = Modifier.fillMaxSize(),
        ) { s ->
            when (s) {
                OnboardingStep.WELCOME -> WelcomeStep(replay = Onboarding.isReplay)
                OnboardingStep.TOUR -> TourStep(replay = Onboarding.isReplay, signedIn = signedIn, guest = guest)
                OnboardingStep.SIGN_IN -> AuthScreen(
                    onAuthenticated = { /* the auth watch above moves on once the profile loads */ },
                    onDismiss = { Onboarding.dispatch(OnboardingEvent.Back) },
                    initialMode = "signin",
                )
                OnboardingStep.SIGN_UP -> AuthScreen(
                    onAuthenticated = { },
                    onDismiss = { Onboarding.dispatch(OnboardingEvent.Back) },
                    initialMode = "signup",
                )
                OnboardingStep.PROFILE -> ProfileStep()
                OnboardingStep.USERNAME -> UsernameStep(profile)
                OnboardingStep.MASCOT -> MascotStep(profile)
                OnboardingStep.ALL_SET -> AllSetStep(profile, guest)
            }
        }
    }
}

// ── The shared chrome ────────────────────────────────────────────────────────────

internal val ONBOARD_ACCENT = Color(0xFF7C3AED)

/**
 * One onboarding screen: the Home wallpaper, Skip top-right ([onSkip] null = none),
 * the content, then the page dots ([dots] = current to count; null = the content draws its own).
 */
@Composable
internal fun OnboardingFrame(
    onSkip: (() -> Unit)?,
    dots: Pair<Int, Int>?,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize().pageBackground(PageTint.HOME).statusBarsPadding().padding(bottom = 16.dp)) {
        Row(
            Modifier.fillMaxWidth().height(52.dp).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onSkip != null) {
                CandyButton("Skip", onClick = onSkip, color = CandyColor.PEACH, size = CandySize.SMALL, contentDescription = "Skip this step")
            }
        }
        Column(Modifier.weight(1f).fillMaxWidth(), content = content)
        dots?.let { (current, count) ->
            OnboardDots(current, count, Modifier.align(Alignment.CenterHorizontally).padding(top = 12.dp))
        }
    }
}

/** The step dots for a step (replays count two steps). */
internal fun stepDots(step: OnboardingStep, replay: Boolean = false): Pair<Int, Int> =
    step.section to (if (replay) 2 else 5)

/**
 * A scrolling column that centers its content when it fits — every step's body.
 * [minHeight] = the viewport height (from BoxWithConstraints).
 */
@Composable
internal fun OnboardBody(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.(maxHeight: Dp) -> Unit,
) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val h = maxHeight
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = h).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) { content(h) }
    }
}

/** A6-style lettering in the soft-number ink (Nunito Black caps, the soft shadow). */
@Composable
internal fun OnboardLettering(text: String, size: TextUnit = 34.sp, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        modifier = modifier.semantics { heading() },
        style = softNumberStyle(size).copy(
            letterSpacing = 0.03.em, lineHeight = (size.value + 3).sp, textAlign = TextAlign.Center,
        ),
        maxLines = 3,
    )
}

/** The one line under a headline. */
@Composable
internal fun OnboardLine(text: String, modifier: Modifier = Modifier) {
    Text(
        text, fontFamily = Nunito, fontSize = 16.sp, fontWeight = FontWeight.Bold,
        lineHeight = 1.35.em, textAlign = TextAlign.Center,
        color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.heading,
        modifier = modifier.widthIn(max = 360.dp),
    )
}

/** A drawable that may not have landed yet (tonight's art): its id, or null. */
@Composable
internal fun optionalArt(name: String): Int? {
    val ctx = LocalContext.current
    return remember(name) {
        @Suppress("DiscouragedApi")
        ctx.resources.getIdentifier(name, "drawable", ctx.packageName).takeIf { it != 0 }
    }
}

/** The page dots: the current one a wider purple pill. Decorative (the label says where you are). */
@Composable
internal fun OnboardDots(current: Int, count: Int, modifier: Modifier = Modifier, noun: String = "Step") {
    val still = WTheme.reducedMotion
    Row(
        modifier.clearAndSetSemantics { contentDescription = "$noun ${current + 1} of $count" },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(count) { i ->
            val on = i == current
            val w by animateDpAsState(if (on) 22.dp else 8.dp, if (still) tween(0) else tween(220), label = "dot")
            Box(
                Modifier.width(w).height(8.dp).clip(RoundedCornerShape(50))
                    .background(if (on) ONBOARD_ACCENT else accentLine(ONBOARD_ACCENT, 0.35f)),
            )
        }
    }
}

/** U the between-steps / between-cards whoosh (SoundManager honors the Sound Effects setting). */
internal fun onboardWhoosh() {
    runCatching { com.wordocious.app.data.SoundManager.playWhoosh() }
}

/** The CTA width rule: full width up to 360 dp. */
internal val ONBOARD_CTA = Modifier.widthIn(max = 360.dp).fillMaxWidth()

// ── 1 WELCOME ────────────────────────────────────────────────────────────────────

@Composable
private fun WelcomeStep(replay: Boolean) {
    val welcomeArt = optionalArt("art_scene_welcome_cast")
    OnboardingFrame(onSkip = null, dots = stepDots(OnboardingStep.WELCOME, replay)) {
        OnboardBody { h ->
            if (welcomeArt != null) {
                SceneArtPop(welcomeArt, (h * 0.42f).coerceAtMost(320.dp), delayMs = 60L)
            } else {
                // Until tonight's art lands: the whole cast waving.
                BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    val tile = ((maxWidth - 18.dp) / 10).coerceAtMost(34.dp)
                    CastRow(tile, motion = MascotMotion.WAVE, hop = 10.dp, staggerMs = 80, loopMs = 2400)
                }
            }
            Spacer(Modifier.height(20.dp))
            // BJ16 quick win: the WELCOME! lettering (TalkBack keeps the full line).
            PageHeadline(TitleArt.WELCOME.res, "Welcome to Wordocious!", maxHeight = 72.dp)
            Spacer(Modifier.height(10.dp))
            OnboardLine("Daily word games, a cast of friends, and bragging rights.")
            Spacer(Modifier.height(28.dp))
            CastButton(
                "Let's go!", onClick = { Onboarding.dispatch(OnboardingEvent.LetsGo) },
                size = CastSize.L, fill = true,
                modifier = ONBOARD_CTA,
            )
            if (!replay) {
                Spacer(Modifier.height(12.dp))
                // The link chip: a quiet peach candy (A8 — no plain-text action links).
                CandyButton(
                    "I already have an account", onClick = { Onboarding.dispatch(OnboardingEvent.HaveAccount) },
                    color = CandyColor.PEACH, size = CandySize.SMALL,
                    contentDescription = "I already have an account. Sign in",
                )
            }
        }
    }
}

// ── 2 QUICK TOUR ─────────────────────────────────────────────────────────────────

private data class TourCard(@DrawableRes val art: Int, val title: String, val line: String, val heading: Heading)

private val TOUR = listOf(
    TourCard(R.drawable.art_scene_onboard_tiles, "Daily games", "New puzzles every day. Guess the word, solve the board.", Heading.TOUR_DAILY),
    TourCard(R.drawable.art_scene_onboard_score, "Score big", "Fewer guesses and faster times earn more points.", Heading.TOUR_SCORE),
    TourCard(R.drawable.art_scene_shield_guard, "Keep your streak", "Play daily to grow your streak. Shields save it.", Heading.TOUR_STREAK),
    TourCard(R.drawable.art_scene_friends_match, "Play together", "Race friends, react, and battle the cast.", Heading.TOUR_TOGETHER),
)

/** AO step 2: four swipe cards, one sentence each, with their own card dots. */
@Composable
private fun TourStep(replay: Boolean, signedIn: Boolean, guest: Boolean) {
    val still = WTheme.calmMotion
    val pager = rememberPagerState(pageCount = { TOUR.size })
    var stillPage by remember { mutableIntStateOf(0) }
    val page = if (still) stillPage else pager.currentPage
    val scope = rememberCoroutineScope()
    fun goTo(p: Int) {
        val target = p.coerceIn(0, TOUR.lastIndex)
        if (still) stillPage = target else scope.launch { pager.animateScrollToPage(target) }
    }
    // U: a whoosh between cards.
    LaunchedEffect(pager, still) {
        if (still) return@LaunchedEffect
        var last = pager.currentPage
        snapshotFlow { pager.currentPage }.collect { p -> if (p != last) { last = p; onboardWhoosh() } }
    }
    // Back walks the cards first, then leaves the tour.
    BackHandler(enabled = page > 0) { goTo(page - 1); if (still) onboardWhoosh() }

    OnboardingFrame(onSkip = { Onboarding.dispatch(OnboardingEvent.Skip) }, dots = null) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (still) {
                // Reduce Motion / calm: no slide, a crossfade (swipes still change the card).
                Crossfade(
                    stillPage, label = "tour",
                    modifier = Modifier.fillMaxSize().pointerInput(Unit) {
                        var dx = 0f
                        detectHorizontalDragGestures(
                            onDragStart = { dx = 0f },
                            onDragEnd = {
                                if (dx < -60f && stillPage < TOUR.lastIndex) { stillPage += 1; onboardWhoosh() }
                                else if (dx > 60f && stillPage > 0) { stillPage -= 1; onboardWhoosh() }
                            },
                        ) { _, d -> dx += d }
                    },
                ) { p -> TourPage(p) }
            } else {
                HorizontalPager(pager, Modifier.fillMaxSize()) { p -> TourPage(p) }
            }
        }
        OnboardDots(page, TOUR.size, Modifier.align(Alignment.CenterHorizontally).padding(vertical = 14.dp), noun = "Card")
        val last = page == TOUR.lastIndex
        val finalLabel = when {
            replay -> "Got it!"
            !signedIn && !guest -> "Make my profile"
            else -> "Next"
        }
        CandyButton(
            if (last) finalLabel else "Next",
            onClick = {
                if (last) Onboarding.dispatch(OnboardingEvent.TourDone) else {
                    if (still) onboardWhoosh()
                    goTo(page + 1)
                }
            },
            color = CandyColor.PURPLE,
            size = CandySize.LARGE,
            trailing = if (last && replay) null else "›",
            fill = true,
            modifier = Modifier.align(Alignment.CenterHorizontally).then(ONBOARD_CTA).padding(horizontal = 24.dp),
        )
    }
}

/** One card: the scene art springing in, the lettering headline and its one sentence. */
@Composable
private fun TourPage(index: Int) {
    val card = TOUR[index]
    OnboardBody { h ->
        SceneArtPop(card.art, (h * 0.5f).coerceAtMost(340.dp), delayMs = 60L)
        Spacer(Modifier.height(16.dp))
        HeadingArt(card.heading, height = 52.dp, maxWidth = 340.dp)   // BJ16
        Spacer(Modifier.height(10.dp))
        OnboardLine(card.line)
    }
}
