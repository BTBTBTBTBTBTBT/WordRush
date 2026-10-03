package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Email
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import kotlinx.coroutines.launch
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameDictionary
import kotlinx.coroutines.delay

/**
 * Home screen — ported from the web `app/page.tsx` (source of truth). Static
 * data-driven bits (daily completions, live player count, Pro toggle, invites)
 * render their faithful shells; they get wired once the Android Supabase/socket
 * layer lands (later phase). Layout, colors, copy and the mode grid are 1:1.
 */
@Composable
fun HomeScreen(
    onSelectMode: (ModeCard, Boolean) -> Unit,
    onGoPro: () -> Unit = {},
    onVs: (ModeCard) -> Unit = {},
    onJoinInvite: (com.wordocious.core.GameMode, String) -> Unit = { _, _ -> },
    onNavigate: (String) -> Unit = {},
) {
    // Today's daily completions (W/L per mode) — keyed by DB game_mode (DUEL/QUORDLE/…)
    // Seed from the day-keyed cache so cold launches don't flash unbadged
    // cards while the network fetch runs (web sessionStorage parity).
    // Re-fetch the instant a daily is recorded (completionTick) so a just-finished
    // game's badge/tint shows immediately on return — no tab round-trip.
    val tick by com.wordocious.app.data.DailyCompletionsService.completionTick.collectAsState()
    // Also refetch once a row LANDS (recordedTick) — a queued result retried by
    // PendingRecords.drain() after an outage swaps its optimistic entry for the
    // server row.
    val landedTick by com.wordocious.app.data.DailyCompletionsService.recordedTick.collectAsState()
    val completions by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.DailyCompletionsService.readCache(), key1 = tick, key2 = landedTick
    ) {
        value = com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions()
    }
    // A home screen kept composed across LOCAL midnight must refetch the new
    // day's (empty) completions — otherwise yesterday's badges linger. On resume,
    // bump the tick if the local day rolled over (iOS build-99 parity).
    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val obs = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                com.wordocious.app.data.DailyCompletionsService.refreshIfDayChanged()
            }
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }
    // Today's daily VS outcome (true=won, false=lost, null=not played) → drives
    // the VS card's W/L badge + tint, since VS has no solo daily_results row.
    val vsDailyWon by androidx.compose.runtime.produceState<Boolean?>(initialValue = null, key1 = tick) {
        value = com.wordocious.app.data.DailyResultsService.dailyVsResult()
    }
    // Pro/Unlimited dimension (web parity): free users get one daily play per
    // mode; once played, the card LOCKS (dimmed + tap → ModeLimitModal). Pro
    // users get a Daily/Unlimited toggle and replay unlimited (fresh seeds).
    val isPro = com.wordocious.app.data.AuthService.isProActive
    var limitModal by remember { mutableStateOf<ModeCard?>(null) }
    // Contextual Pro prompt (web pro-prompt-modal.tsx): streak >= 7, not Pro,
    // not previously dismissed (local pref for instant gating + server
    // profiles.pro_prompt_shown for cross-device honor).
    val authProfile by com.wordocious.app.data.AuthService.profile.collectAsState()
    var proPromptDismissed by remember {
        mutableStateOf(com.wordocious.app.data.SettingsPref.get("pro-prompt-shown", false))
    }
    val showProPrompt = !proPromptDismissed && authProfile?.proPromptShown != true &&
        !isPro && (authProfile?.dailyLoginStreak ?: 0) >= 7
    val dismissProPrompt: () -> Unit = {
        proPromptDismissed = true
        com.wordocious.app.data.SettingsPref.set("pro-prompt-shown", true)
        com.wordocious.app.data.AuthService.markProPromptShown()
    }
    // iOS @AppStorage("pref-play-mode") parity — session-scoped by design: the
    // pref carries the Pro Daily⇄Unlimited choice across MainScreen disposing
    // Home (game/settings routes), but App.onCreate resets it to "daily" on
    // every cold start, so reopening the app always lands on the Daily surface
    // (founder-approved UX).
    var playMode by remember {
        mutableStateOf(
            if (com.wordocious.app.data.SettingsPref.get("pref-play-mode", "daily") == "unlimited") {
                PlayMode.UNLIMITED
            } else {
                PlayMode.DAILY
            }
        )
    }
    // Warm-resume day rollover: snap the toggle back to Daily (cold-start
    // parity). MainScreen resets the PREF + nav; this resets the already-
    // composed state here, which the pref write alone can't reach. Same-day
    // resumes keep the user's choice.
    var lastPlayModeDay by remember { mutableStateOf(com.wordocious.app.todayLocalDate()) }
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val obs = androidx.lifecycle.LifecycleEventObserver { _, event ->
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_RESUME -> {
                    val today = com.wordocious.app.todayLocalDate()
                    if (today != lastPlayModeDay) {
                        lastPlayModeDay = today
                        playMode = PlayMode.DAILY
                        com.wordocious.app.data.SettingsPref.set("pref-play-mode", "daily")
                    }
                }
                androidx.lifecycle.Lifecycle.Event.ON_PAUSE -> {
                    lastPlayModeDay = com.wordocious.app.todayLocalDate()
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }
    val unlimitedMode = isPro && playMode == PlayMode.UNLIMITED
    val signOutScope = androidx.compose.runtime.rememberCoroutineScope()
    var inviteOpen by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current

    // One-time-per-day Daily Sweep / Flawless Victory celebration. Keyed on the
    // local day; re-fires on sweep→flawless upgrade (web/iOS parity). Holds a
    // SNAPSHOT of the completions that earned it, so a concurrent refetch (e.g.
    // the new day's empty set after a midnight rollover) can never blank the
    // stats mid-celebration — the iOS widget-launch "0/9 WON · 0:00 · 0 pts"
    // sweep-modal bug.
    // 2026-10-03 (CelebrationGate): every sweep celebration is QUEUED and shown by
    // CelebrationQueueHost at a calm moment — the Home tab at its root, nothing presented, no
    // other popup — never the moment a late write lands. Each carries its day; a queued one
    // from a past day is dropped. The once-per-day tokens are written when it actually shows.
    // (Home stays composed under a game, 2026-09-29, so detection runs here regardless.)
    val homeHidden by LocalTabHidden.current
    val showingSweep = CelebrationQueue.showingSweep
    androidx.compose.runtime.LaunchedEffect(completions) {
        val tier = moreSweepTier(completions, MORE_CARDS) ?: return@LaunchedEffect
        CelebrationQueue.enqueueSweep(
            CelebrationQueue.Item.Sweep(
                more = true, day = com.wordocious.app.todayLocalDate(),
                flawless = tier == MoreSweepTier.FLAWLESS, byMode = completions,
            )
        )
    }
    androidx.compose.runtime.LaunchedEffect(completions) {
        if (com.wordocious.app.data.DailyCompletionsService.sweepOnly(completions).size < com.wordocious.app.data.DailyCompletionsService.TOTAL_DAILY_MODES) return@LaunchedEffect
        val totals = com.wordocious.app.data.DailyCompletionsService.totals(completions)
        // Hard guard (iOS parity): a "sweep" with zero recorded wins is by
        // definition stale/degenerate data — never a real day of play.
        if (totals.won == 0) return@LaunchedEffect
        CelebrationQueue.enqueueSweep(
            CelebrationQueue.Item.Sweep(
                more = false, day = com.wordocious.app.todayLocalDate(),
                flawless = totals.flawless, byMode = completions,
            )
        )
        // FINISH_SPEC AI: the review ask now fires when the celebration CLOSES (SweepCelebration).
    }
    // FINISH_SPEC AI: a won game that hit a 7-day streak milestone asks for a review once
    // Home is back on screen with no celebration up (gates in StoreReview).
    androidx.compose.runtime.LaunchedEffect(homeHidden, showingSweep) {
        if (homeHidden || showingSweep != null) return@LaunchedEffect
        delay(1_200)
        if (com.wordocious.app.data.StoreReview.takePendingStreakMilestone()) {
            (context as? android.app.Activity)?.let {
                com.wordocious.app.data.StoreReview.maybeAsk(it, com.wordocious.app.data.StoreReview.Moment.STREAK_MILESTONE)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(modifier = Modifier.fillMaxSize().pageBackground(PageTint.HOME)) {
        // (Shared AppHeader is rendered by MainScreen above all tabs.)
        val homeScroll = rememberScrollState()
        ScrollToTopOnReselect(homeScroll) // AJ/BI11: only a re-tap of Home at its root scrolls to the top.
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(homeScroll)
                .padding(horizontal = 16.dp).padding(bottom = TAB_CONTENT_BOTTOM_PAD), // AS3
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Proportional line boxes for the whole page (see homeTightTextStyle):
            // a CompositionLocalProvider adds no layout node, so the Column's
            // spacedBy(8.dp) still applies to each child individually.
            ProvideTextStyle(homeTightTextStyle()) {
            // Admin-authored announcements (web/iOS AnnouncementsBanner parity).
            AnnouncementsBanner()
            // Pending VS invites banner (web pending-invites-banner.tsx).
            PendingInvitesBanner(onJoinInvite = onJoinInvite)

            // Home redesign (founder, 2026-10-01; docs/HOME_REDESIGN_SPEC.md): ONE banner
            // replaces the Pro Daily/Unlimited pill, the Daily Challenge / Unlimited /
            // Sweep heroes and the top Word of the Day card. Its rows are the two
            // sections below: the eight Wordocious dailies and the ten Puzzles (the
            // More Games dailies, remote flags honored).
            val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
            val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
            val visibleCards = MODE_CARDS.filter { com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }
            val visibleMore = MORE_CARDS.filter { com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }
            val wordCards = visibleCards.filter { !it.homeWide }
            val puzzleCards = moreDailyModes(visibleMore)
            val wordKeys = wordCards.mapNotNull { it.dbKey }
            val puzzleKeys = puzzleCards.mapNotNull { it.dbKey }
            fun progress(keys: List<String>) = com.wordocious.core.GroupProgress(
                played = keys.count { it in completions }, won = keys.count { completions[it]?.completed == true }, total = keys.size,
            )
            // Row runs: the Wordocious row reads the existing Daily Sweep stats (the
            // Stats tab's daily_bonuses walk); the Puzzles row walks the player's solo
            // daily_results for the visible Puzzles (shared dayStreaks). Seeded from the
            // day-stamped cache so the flames paint at once; both refetch the moment a
            // daily's row is on the server.
            val recordedTick by com.wordocious.app.data.DailyCompletionsService.recordedTick.collectAsState()
            val authUserId = authProfile?.id
            val cachedRows = remember { com.wordocious.app.data.HomeStreaksService.cachedRowStreaks() }
            val wordStreaks by produceState(
                initialValue = com.wordocious.core.DayStreaks(cachedRows?.wordSweep ?: 0, cachedRows?.wordFlawless ?: 0),
                recordedTick, authUserId,
            ) {
                if (authUserId == null) { value = com.wordocious.core.DayStreaks(0, 0); return@produceState }
                val s = com.wordocious.app.data.MatchStatsService.dailySweepStats()
                value = com.wordocious.core.DayStreaks(s.currentSweepStreak, s.currentFlawlessStreak)
            }
            val puzzleStreaks by produceState(
                initialValue = com.wordocious.core.DayStreaks(cachedRows?.puzzlesSweep ?: 0, cachedRows?.puzzlesFlawless ?: 0),
                recordedTick, authUserId, puzzleKeys,
            ) {
                value = if (authUserId == null) com.wordocious.core.DayStreaks(0, 0)
                        else com.wordocious.app.data.HomeStreaksService.puzzleStreaks(puzzleKeys)
            }
            // Keep the widget's row runs in step with the banner's.
            androidx.compose.runtime.LaunchedEffect(wordStreaks, puzzleStreaks, authUserId) {
                if (authUserId != null) com.wordocious.app.data.HomeStreaksService.cacheRowStreaks(wordStreaks, puzzleStreaks)
            }
            // Unlimited's "N PLAYED TODAY": refetched whenever Unlimited is on and Home comes
            // back on screen (a finished unlimited game records on the way out).
            var unlimitedCounts by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
            androidx.compose.runtime.LaunchedEffect(unlimitedMode, homeHidden, authUserId) {
                if (unlimitedMode && !homeHidden) unlimitedCounts = com.wordocious.app.data.HomeStreaksService.unlimitedCountsToday()
            }
            val secs by rememberMidnightCountdown()
            // Free-user lock: one daily per mode; a played card opens ModeLimitModal (web parity).
            val openCard: (ModeCard) -> Unit = { card ->
                val played = card.dbKey?.let { it in completions } == true
                if (!isPro && !unlimitedMode && played) limitModal = card
                else onSelectMode(card, unlimitedMode && card.engineMode != null)
            }
            // X: the Halloween Home banner art (only in season and once the art ships), above the
            // banner in both modes so the Daily ⇄ Unlimited switch never moves anything (Z).
            HalloweenBannerSlot { res ->
                androidx.compose.foundation.Image(
                    androidx.compose.ui.res.painterResource(res), contentDescription = null,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                    contentScale = androidx.compose.ui.layout.ContentScale.FillWidth,
                )
            }
            HomeBannerView(
                word = BannerRow(wordCards, progress(wordKeys), wordStreaks, wordKeys.sumOf { unlimitedCounts[it] ?: 0 }),
                puzzles = BannerRow(puzzleCards, progress(puzzleKeys), puzzleStreaks, puzzleKeys.sumOf { unlimitedCounts[it] ?: 0 }),
                completions = completions,
                unlimited = unlimitedMode,
                isPro = isPro,
                onModeChange = {
                    playMode = it
                    com.wordocious.app.data.SettingsPref.set("pref-play-mode", it.name.lowercase())
                },
                name = authProfile?.username.orEmpty(),
                clock = formatCountdown(secs),
                onOpen = openCard,
                onShare = { headline -> com.wordocious.app.data.DailySweepShare.shareTodayProgress(context, completions, headline) },
            )

            // U2: first-game suggestion for brand-new accounts — signed in with
            // ZERO recorded games (total_wins + total_losses == 0; the profiles
            // row's direct games count, bumped on every recorded game). Points
            // them at the Classic daily. X dismisses permanently; the card also
            // disappears on its own once any game is recorded (profile refresh).
            val isAuthedForCard by com.wordocious.app.data.AuthService.isAuthenticated.collectAsState()
            var firstGameCardDismissed by remember {
                mutableStateOf(com.wordocious.app.data.SettingsPref.get("first-game-card-dismissed", false))
            }
            val zeroGames = authProfile?.let { it.totalWins + it.totalLosses == 0 } == true
            if (isAuthedForCard && zeroGames && !firstGameCardDismissed) {
                FirstGameCard(
                    onPlay = {
                        MODE_CARDS.firstOrNull { it.id == "practice" }?.let { onSelectMode(it, false) }
                    },
                    onHowToPlay = { onNavigate("help") },
                    onDismiss = {
                        firstGameCardDismissed = true
                        com.wordocious.app.data.SettingsPref.set("first-game-card-dismissed", true)
                    },
                )
            }

            // Two sections of the SAME mode card, two across: the Wordocious dailies,
            // then the Puzzles (the old More Games sheet's cards, catalog order, same
            // lock/badge rules). The More Games band and sheet are gone.
            // ART_SPEC §12 / §19.2: each section's header is its whole-cast title art (≈78%
            // width, max 340, centered) — DAILIES, PUZZLES, then WORD OF THE DAY above its card.
            SectionTitleArt(TitleArt.DAILIES, scale = HomeCardSpec.SECTION_TITLE_SCALE)
            ModeCardGrid(wordCards, completions, unlimitedMode, isPro, onOpen = openCard)
            SectionTitleArt(TitleArt.PUZZLES, scale = HomeCardSpec.SECTION_TITLE_SCALE)
            ModeCardGrid(puzzleCards, completions, unlimitedMode, isPro, onOpen = openCard)

            WordOfTheDayCard(onPastWords = { onNavigate("pastwords") })

            // VS Battle merged with the old LIVE bar, last in the game area. FINISH_SPEC O1:
            // its own VS BATTLE section title above the card, the same size + spacing as
            // DAILIES / PUZZLES / WORD OF THE DAY (Home reads … → WORD OF THE DAY → VS BATTLE).
            visibleCards.firstOrNull { it.id == "vs" }?.let { vs ->
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionTitleArt(TitleArt.VSBATTLE)
                    VSLiveTile(
                        card = vs, vsDailyWon = vsDailyWon, unlimitedMode = unlimitedMode, isPro = isPro,
                        // VS overhaul (2026-10-01): the tile always opens the VS lobby; a used
                        // free Daily Battle reads "Played today" there instead of a lock here.
                        onOpen = { onSelectMode(vs, unlimitedMode) },
                        onInvite = { inviteOpen = true },
                    )
                }
            }
            // Sign Out (web + iOS home footer parity) — subtle muted text button.
            // Only when there's a real session: a guest has nothing to sign out
            // of (the header shows "Sign In").
            val isAuthed by com.wordocious.app.data.AuthService.isAuthenticated.collectAsState()
            if (isAuthed) {
                // FINISH_SPEC A8: a small soft peach candy button (was a muted text link).
                Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
                    CandyButton(
                        "Sign Out", onClick = { signOutScope.launch { com.wordocious.app.data.AuthService.signOut() } },
                        color = CandyColor.PEACH, size = CandySize.SMALL,
                    )
                }
            }
            FooterLinks(onNavigate)
            Spacer(Modifier.height(16.dp))
            } // ProvideTextStyle(homeTightTextStyle())
        }
    }
        // Free-user daily-limit modal (web ModeLimitModal). "View Solved Puzzle"
        // opens the finished daily (GameScreen resumes → post-game screen).
        limitModal?.let { card ->
            // iOS `showViewSolved: m.id != "vs"` — VS has no solo solved board to
            // review, so that card falls through to "Come back tomorrow".
            val viewPuzzle: (() -> Unit)? =
                if (card.id == "vs") null else { { onSelectMode(card, false) } }
            ModeLimitModal(
                modeName = card.title,
                onClose = { limitModal = null },
                onGoPro = onGoPro,
                onViewPuzzle = viewPuzzle,
                // R3: a purchase from the limit screen starts this mode's Unlimited game
                // directly (VS has no Unlimited puzzle: its lobby opens instead).
                onPlayUnlimited = { onSelectMode(card, card.engineMode != null) },
            )
        }

        // Pro-prompt banner pinned to the bottom (web: fixed bottom-16 card).
        if (showProPrompt) {
            ProPromptBanner(
                modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = 16.dp, vertical = 16.dp),
                onGoPro = { dismissProPrompt(); onGoPro() },
                onDismiss = dismissProPrompt,
            )
        }
        // One-time Daily Sweep / Flawless Victory celebration overlay —
        // rendered from the snapshot captured at fire time, never live state.
        showingSweep?.let { celeb ->
            androidx.compose.runtime.key(celeb) {
                SweepCelebration(
                    byMode = celeb.byMode, more = celeb.more,
                    onShare = {
                        if (celeb.more) com.wordocious.app.data.DailySweepShare.shareMore(context, celeb.byMode)
                        else com.wordocious.app.data.DailySweepShare.share(context, celeb.byMode)
                    },
                    onClose = { CelebrationQueue.finishSweep() },
                )
            }
        }
    }
    // Pro-only "Invite a friend to VS" modal (web InviteModal / iOS InviteSheet).
    if (inviteOpen) InviteSheet(onDismiss = { inviteOpen = false })
    // CelebrationGate: Home's own sheets / modals keep late celebrations waiting.
    ReportPresented(inviteOpen || limitModal != null)
}

/**
 * U2: compact dismissible "start here" card for brand-new accounts — sparkle
 * icon, Classic pitch, a Play button that launches the Classic DAILY (same
 * route as the Classic mode card) and a "How to play" text link.
 */
@Composable
private fun FirstGameCard(onPlay: () -> Unit, onHowToPlay: () -> Unit, onDismiss: () -> Unit) {
    // Classic's catalog accent — matches iOS, which reads it off the mode card.
    val accent = Color(0xFF7C3AED)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            // FINISH_SPEC A1: a tinted card in Classic's color with its top band.
            .tintedPill(accent, 16.dp)
            .padding(start = 12.dp, end = 4.dp, top = 14.dp, bottom = 12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // The icon tile is a mini game card (A1).
        Box(
            Modifier.size(32.dp).miniGameCard(accent, 9.dp),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.AutoAwesome, null, tint = accent, modifier = Modifier.size(16.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("New here? Start with Classic", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(
                "The original 5-letter challenge — a fresh puzzle every day.",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
            Row(
                modifier = Modifier.padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Flat accent capsule with a play glyph + soft drop shadow (iOS btn).
                // FINISH_SPEC A8: the glossy candy PLAY pill.
                CandyButton("Play", onClick = onPlay, color = CandyColor.PURPLE, size = CandySize.SMALL, icon = CandyIcon.PLAY)
                // A8: a soft peach candy button (was an underlined text link).
                CandyButton("How to play", onClick = onHowToPlay, color = CandyColor.PEACH, size = CandySize.SMALL)
            }
        }
        HomeDismissX(onDismiss)
    }
}

/**
 * Web modals/pro-prompt-modal.tsx: gold-bordered surface card with a Crown,
 * "You're on a streak!" copy, a Go Pro gradient button, and an X dismiss.
 */
@Composable
private fun ProPromptBanner(modifier: Modifier = Modifier, onGoPro: () -> Unit, onDismiss: () -> Unit) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            // iOS floats this banner above the page (.shadow radius 16, y 8).
            .shadow(16.dp, RoundedCornerShape(16.dp), spotColor = Color.Black.copy(alpha = 0.1f), ambientColor = Color.Black.copy(alpha = 0.1f))
            // FINISH_SPEC G1: the gold card family (wash, line, gold band) — never white.
            .tintedPill(Color(0xFFF5A524), 16.dp)
            .padding(start = 14.dp, end = 4.dp, top = 16.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon3D(Icon3DName.CROWN, 30.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("You're on a streak!", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Text(
                "Upgrade to Pro for ad-free play, stats, shields, and more.",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
        // FINISH_SPEC A8: a small glossy candy pill.
        CandyButton("Go Pro", onClick = onGoPro, color = CandyColor.AMBER, size = CandySize.SMALL)
        HomeDismissX(onDismiss)
    }
}

/**
 * Home text discipline (iOS density parity). Every Text here inherits Material3
 * bodyLarge, whose DEFAULT lineHeight is a flat 24sp — so a 10sp caption rides
 * a 24sp line box, and the user's fontScale multiplies that box AGAIN (Samsung
 * "Large" text ≈ 31sp per line). iOS line boxes are font-proportional, which is
 * why identical content scrolled ~2x taller here. Pin line boxes to 1.3x the
 * resolved fontSize (em, so it scales WITH each Text, unlike the flat sp
 * default) with font padding off — the TileView/ModeGlyph fix class, applied
 * page-wide via ProvideTextStyle. Texts passing an explicit TextStyle (the
 * brush-gradient hero titles) already have an unspecified → font-metric line
 * height and are unaffected.
 */
@Composable
internal fun homeTightTextStyle(): TextStyle =
    // §227: WordociousTheme now applies this at the root for every screen;
    // kept as the one definition Home names so the two can't drift.
    com.wordocious.app.ui.theme.tightTextStyle(LocalTextStyle.current)

/**
 * Fixed-visual card chrome (heroes, mode cards, play-mode toggle, WOTD
 * title/word rows): cap the effective fontScale at 1.3x — the LeaderboardScreen
 * ModePickerRow rule — so huge system text can't balloon layout chrome or
 * overflow the fixed 78dp hero. Genuinely reflowable copy (the WOTD definition)
 * stays OUTSIDE the cap and scales freely with the user's setting.
 */
@Composable
internal fun CappedFontScale(max: Float = 1.3f, content: @Composable () -> Unit) {
    val d = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(d.density, d.fontScale.coerceAtMost(max)),
        content = content,
    )
}

/** Today's Word of the Day plus the dictionary entry that qualified it. */
private data class WordOfTheDay(
    val word: String,
    val definition: com.wordocious.app.data.DefinitionService.WordDefinition?,
)

/**
 * Words never FEATURED as Word of the Day. The card prints the word with its
 * dictionary definition, and these read as clinical anatomy, excretion, drugs,
 * or -- BLOOD -- a street gang. They stay valid puzzle ANSWERS: removing them
 * from the solutions list would shift every later day's index and rewrite
 * already-played history. Mirror of packages/core/src/wotd-blocklist.ts.
 */
private val WOTD_BLOCKED = setOf("HYMEN", "OVARY", "PUBIC", "GROIN", "BOSOM", "FECES", "FECAL", "URINE", "VOMIT", "ENEMA", "BOWEL", "MUCUS", "OPIUM", "BOOZE", "LEPER", "TUMOR", "ULCER", "BLOOD")

private fun WordsService.Entry.toWotd() = WordOfTheDay(
    word,
    if (definition.isNotEmpty()) com.wordocious.app.data.DefinitionService.WordDefinition(phonetic, partOfSpeech, definition) else null,
)

/**
 * Today's plain Word of the Day card (word, phonetic, part of speech, definition).
 * Since the home redesign (2026-10-01) it is the quiz card's fallback: shown when
 * /api/wotd has no quiz for the day or the request fails (WordOfTheDayQuiz.kt).
 */
@Composable
internal fun PlainWordOfTheDayCard(onClick: () -> Unit = {}) {
    // Nothing here may block the UI thread (founder, 2026-09-29): the card used to call
    // DictionaryLoader.ensureLoaded() on main during cold start. It now paints from the
    // last-persisted /api/words copy first (memory, then disk decoded off-main), and the
    // dictionary loads on Dispatchers.Default only for the offline fallback walk.
    val localDay = remember { com.wordocious.app.todayLocalDate() }
    val wotd by produceState(initialValue = WordsService.cachedInMemory()?.firstOrNull { it.date == localDay }?.toWotd()) {
        if (value == null) kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            WordsService.cached()?.firstOrNull { it.date == localDay }
        }?.let { value = it.toWotd() }
        // SERVER FIRST (iOS/web parity): /api/words is rendered by the same
        // module as the Past Words archive, so taking today's entry from it
        // makes the card and the archive agree by construction. The local walk
        // below is the offline fallback only — its live dictionaryapi.dev
        // checks use a different dictionary than the server's committed
        // dataset, which made the two surfaces feature different words.
        runCatching { WordsService.words().firstOrNull { it.date == localDay } }.getOrNull()?.let { e ->
            value = e.toWotd()
            return@produceState
        }
        if (value != null) return@produceState // offline: keep the cached server word
        // Pool for THIS displayed local date — pre-cutover dates keep the legacy
        // word (matches the archive), curated after.
        val sols = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            DictionaryLoader.ensureLoaded(); GameDictionary.solutionPool(localDay)
        }
        if (sols.isEmpty()) return@produceState
        // Day index of the LOCAL calendar date (not currentTimeMillis/86400000,
        // which rolls at UTC midnight — 7 PM Central — and flipped the card to
        // tomorrow's word mid-evening). LocalDate.toEpochDay() is exactly the
        // local date's UTC-midnight day index, matching web (commit ad2ef44).
        val daysSinceEpoch = java.time.LocalDate.parse(localDay).toEpochDay().toInt()
        // iOS WordOfTheDayView.fetch(): walk up to 20 candidates from today's
        // index and display the FIRST one dictionaryapi.dev actually defines —
        // otherwise the platforms show different words on a no-entry day.
        // (DefinitionService caches hits AND misses per local day, so a repeat
        // visit costs no network.)
        for (offset in 0 until 20) {
            val candidate = sols[(daysSinceEpoch + offset) % sols.size]
            if (candidate.uppercase() in WOTD_BLOCKED) continue
            val d = com.wordocious.app.data.DefinitionService.fetch(candidate)
            if (d != null) {
                value = WordOfTheDay(candidate, d)
                return@produceState
            }
        }
        // Walk to the first non-blocked word so a day where nothing resolves
        // still can't surface one.
        value = WordOfTheDay(
            (0 until sols.size)
                .map { sols[(daysSinceEpoch + it) % sols.size] }
                .firstOrNull { it.uppercase() !in WOTD_BLOCKED }
                ?: sols[daysSinceEpoch % sols.size],
            null,
        )
    }
    // FINISH_SPEC BI17: the guide-family WOTD card (WordOfTheDayQuiz.kt), same as the quiz card.
    val w = wotd   // local capture: produceState delegate can't smart-cast
    if (w == null) WotdPlainSkeleton()
    else WotdPlainCard(w.word, w.definition?.phonetic.orEmpty(), w.definition?.partOfSpeech.orEmpty(), w.definition?.definition.orEmpty(), onClick)
}

@Composable
private fun PendingInvitesBanner(onJoinInvite: (com.wordocious.core.GameMode, String) -> Unit) {
    val userId = com.wordocious.app.data.AuthService.userId
    var invites by remember {
        mutableStateOf<List<com.wordocious.app.data.InviteService.MatchInvite>>(emptyList())
    }
    var inviterNames by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    androidx.compose.runtime.LaunchedEffect(userId) {
        if (userId == null) return@LaunchedEffect
        val list = com.wordocious.app.data.InviteService.fetchPendingInvitesForUser(userId)
        invites = list
        // One batched profiles query for every inviter (not one per invite).
        inviterNames = com.wordocious.app.data.InviteService.lookupInviterUsernames(list.map { it.inviterId })
    }
    val top = invites.firstOrNull() ?: return
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    // Whole catalog: a ProperNoundle invite must still read "ProperNoundle" (Stage 9 moved it under More).
    val modeTitle = modeCardForKey(top.gameMode)?.title ?: top.gameMode

    Row(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFFDF4FF), Color(0xFFFCE7F3))))
            .border(1.5.dp, Color(0xFFF5D0FE), RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(34.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Color(0xFFEC4899)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(androidx.compose.material.icons.Icons.Filled.Email, null, tint = Color.White, modifier = Modifier.size(14.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "@${inviterNames[top.inviterId] ?: "A friend"} invited you to $modeTitle",
                // AD: the banner is fixed light in every theme, so its ink is too.
                fontSize = 12.sp, fontWeight = FontWeight.Black, color = FinishInk.heading,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            if (invites.size > 1) {
                Text("+${invites.size - 1} more pending", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA21CAF))
            }
        }
        // FINISH_SPEC A8: a small glossy candy pill.
        CandyButton(
            "Play",
            onClick = {
                runCatching { com.wordocious.core.GameMode.valueOf(top.gameMode) }.getOrNull()?.let { m ->
                    onJoinInvite(m, top.inviteCode)
                }
            },
            color = CandyColor.PINK, size = CandySize.SMALL, icon = CandyIcon.PLAY,
        )
        Box(
            // A1 / A9: a tinted pink dismiss circle that squishes (was a white circle).
            Modifier.squishClickable("Dismiss", icon = true) {
                    scope.launch {
                        com.wordocious.app.data.InviteService.markInviteDeclined(top.id)
                        invites = invites.filter { it.id != top.id }
                        // Next inviter's name is already in the batched map — no extra query.
                    }
                }
                .size(28.dp).clip(androidx.compose.foundation.shape.CircleShape)
                .background(accentWash(Color(0xFFEC4899), 0.14f))
                .border(1.5.dp, accentLine(Color(0xFFEC4899)), androidx.compose.foundation.shape.CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(androidx.compose.material.icons.Icons.Filled.Close, null, tint = Color(0xFFA21CAF), modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun LiveBanner(isPro: Boolean = false, onInvite: () -> Unit = {}) {
    // Web useLivePlayerCount: poll {server}/presence every 10s for body.online;
    // null until the first success, keep last value on errors.
    val hidden = LocalTabHidden.current
    val count by androidx.compose.runtime.produceState<Int?>(initialValue = null) {
        // Defer the FIRST request ~2s so it doesn't compete with the home
        // screen's initial loads; 10s cadence after as before.
        kotlinx.coroutines.delay(2_000)
        while (true) {
            hidden.awaitShown() // no polling under a game or another tab (founder, 2026-09-29)
            val online = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                runCatching {
                    val conn = java.net.URL(com.wordocious.app.data.VSConfig.SERVER_URL + "/presence")
                        .openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 8000; conn.readTimeout = 8000
                    val body = conn.inputStream.bufferedReader().readText()
                    conn.disconnect()
                    kotlinx.serialization.json.Json.parseToJsonElement(body)
                        .let { it as? kotlinx.serialization.json.JsonObject }
                        ?.get("online")?.let { el ->
                            (el as? kotlinx.serialization.json.JsonPrimitive)?.content?.toIntOrNull()
                        }
                }.getOrNull()
            }
            if (online != null) value = online
            kotlinx.coroutines.delay(10_000)
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth()
            // FINISH_SPEC A1: a tinted teal (VS) pill, not the plain surface.
            .tintedPill(Color(0xFF0D9488), 14.dp)
            .padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LivePulseDot()
        Text("LIVE", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(
            count?.let { "$it ${if (it == 1) "player" else "players"} online" } ?: "Players online",
            fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        // Pro-only Invite button (web page.tsx + iOS HomeView LIVE banner parity).
        if (isPro) {
            Spacer(Modifier.weight(1f))
            // FINISH_SPEC A8: a small glossy candy pill.
            CandyButton("Invite", onClick = onInvite, color = CandyColor.PINK, size = CandySize.SMALL)
        }
    }
}

/**
 * LIVE pulse dot — breathes 35%→100% on a 0.9s cycle (iOS LivePulseDot); held
 * solid under Reduced Motion.
 */
@Composable
fun LivePulseDot() {
    // AQ2: alpha applied in the layer (no per-frame recomposition); still while scrolling/hidden.
    val dim: androidx.compose.runtime.State<Float> = if (WTheme.reducedMotion || ambientMotionPaused()) {
        remember { androidx.compose.runtime.mutableFloatStateOf(1f) }
    } else {
        val transition = rememberInfiniteTransition(label = "livePulse")
        transition.animateFloat(
            initialValue = 1f, targetValue = 0.35f,
            animationSpec = infiniteRepeatable(
                tween(900, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                RepeatMode.Reverse,
            ),
            label = "dim",
        )
    }
    Box(Modifier.size(8.dp).graphicsLayer { alpha = dim.value }.clip(RoundedCornerShape(4.dp)).background(Color(0xFF22C55E)))
}

@Composable
private fun FooterLinks(onNavigate: (String) -> Unit = {}) {
    // Full site-nav footer (How to Play / Guides / Strategy / Words / About / FAQ
    // / Privacy / Terms) — parity with the web home footer + the header dropdown.
    InfoFooter(onNav = onNavigate)
}

@Composable
internal fun rememberMidnightCountdown(): androidx.compose.runtime.State<Long> {
  val hidden = LocalTabHidden.current
  return produceState(initialValue = secondsUntilLocalMidnight()) {
    while (true) {
        hidden.awaitShown()
        value = secondsUntilLocalMidnight()
        delay(1000)
    }
  }
}

/**
 * Seconds until the next LOCAL midnight — the daily resets at local midnight
 * (matches the local-date puzzle/leaderboard grouping), not UTC.
 */
private fun secondsUntilLocalMidnight(): Long {
    val cal = java.util.Calendar.getInstance().apply {
        add(java.util.Calendar.DAY_OF_YEAR, 1)
        set(java.util.Calendar.HOUR_OF_DAY, 0)
        set(java.util.Calendar.MINUTE, 0)
        set(java.util.Calendar.SECOND, 0)
        set(java.util.Calendar.MILLISECOND, 0)
    }
    return ((cal.timeInMillis - System.currentTimeMillis()) / 1000L).coerceAtLeast(0)
}

internal fun formatCountdown(secs: Long): String {
    val h = secs / 3600
    val m = (secs % 3600) / 60
    val s = secs % 60
    return "%02d:%02d:%02d".format(h, m, s)
}

/**
 * A home section's 2-column grid (web grid-cols-2 gap-2) of the shared mode card.
 * Daily: today's W/L badge + tint, and a free player's played card locks (dimmed;
 * tap → ModeLimitModal). Unlimited (Pro): no badges, no lock, no infinity mark (Y),
 * and every tap starts a fresh puzzle.
 */
@Composable
private fun ModeCardGrid(
    cards: List<ModeCard>,
    completions: Map<String, com.wordocious.app.data.DailyCompletionsService.Completion>,
    unlimitedMode: Boolean,
    isPro: Boolean,
    onOpen: (ModeCard) -> Unit,
) {
    // FINISH_SPEC BH2: 10 dp gaps both ways between the compact cards.
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HomeCardSpec.GAP.dp)) {
    cards.chunked(2).forEach { rowCards ->
        Row(horizontalArrangement = Arrangement.spacedBy(HomeCardSpec.GAP.dp), modifier = Modifier.fillMaxWidth()) {
            rowCards.forEach { card ->
                val completion = card.dbKey?.let { completions[it] }
                val shownCompletion = if (unlimitedMode) null else completion
                val isLocked = !isPro && !unlimitedMode && completion != null
                ModeCardView(
                    card, shownCompletion, isLocked, showVs = false, Modifier.weight(1f),
                    unlimited = unlimitedMode, onVs = {},
                ) { onOpen(card) }
            }
            if (rowCards.size == 1) Spacer(Modifier.weight(1f))
        }
    }
    }
}

/** A bare dismiss X (no bubble) in a 44 dp tap area that squishes (A3 / A9). */
@Composable
private fun HomeDismissX(onDismiss: () -> Unit) {
    Box(
        Modifier.size(SOFT_CONTROL_TAP).squishClickable("Dismiss", icon = true, onClick = onDismiss),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.Close, null, tint = if (WTheme.isDark) WTheme.textMuted else FinishInk.label, modifier = Modifier.size(16.dp))
    }
}
