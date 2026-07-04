package com.wordocious.app.ui

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import kotlinx.coroutines.launch
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
    val completions by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.DailyCompletionsService.readCache(), key1 = tick
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
    var playMode by remember { mutableStateOf(PlayMode.DAILY) }
    val unlimitedMode = isPro && playMode == PlayMode.UNLIMITED
    val signOutScope = androidx.compose.runtime.rememberCoroutineScope()
    var inviteOpen by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current

    // One-time-per-day Daily Sweep / Flawless Victory celebration. Keyed on the
    // local day; re-fires on sweep→flawless upgrade (web/iOS parity).
    var showSweep by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(completions) {
        if (completions.size < com.wordocious.app.data.DailyCompletionsService.TOTAL_DAILY_MODES) return@LaunchedEffect
        val totals = com.wordocious.app.data.DailyCompletionsService.totals(completions)
        val day = com.wordocious.app.todayLocalDate()
        val token = "$day:${if (totals.flawless) "flawless" else "sweep"}"
        val seen = com.wordocious.app.data.SettingsPref.get("sweep-celebrated-day", "")
        if (seen == token || seen == "$day:flawless") return@LaunchedEffect
        com.wordocious.app.data.SettingsPref.set("sweep-celebrated-day", token)
        showSweep = true
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // (Shared AppHeader is rendered by MainScreen above all tabs.)
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Pro-only Daily/Unlimited toggle; Unlimited swaps the daily hero.
            // Daily hero shows Daily Sweep! / Flawless Victory! once all 9 are done.
            // Pending VS invites banner (web pending-invites-banner.tsx).
            PendingInvitesBanner(onJoinInvite = onJoinInvite)
            if (isPro) PlayModeToggle(playMode) { playMode = it }
            if (unlimitedMode) UnlimitedHero()
            else DailyHero(completions) { com.wordocious.app.data.DailySweepShare.share(context, completions) }
            WordOfTheDayCard(onClick = { onNavigate("pastwords") })

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

            Text(
                "GAME MODES",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = WTheme.textMuted,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 4.dp),
            )

            // 2-column grid (web grid-cols-2 gap-2)
            MODE_CARDS.chunked(2).forEach { rowCards ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    rowCards.forEach { card ->
                        val isVsCard = card.id == "vs"
                        val completion = card.engineMode?.let { completions[it.name] }
                        // Unlimited mode: these aren't the daily puzzle — never show the
                        // daily W/L result or lock; every tap starts a fresh puzzle (web parity).
                        val shownCompletion = if (unlimitedMode) null else completion
                        // VS card (daily only): reflect today's daily-VS W/L (no solo row).
                        val vsWon = if (!unlimitedMode && isVsCard) vsDailyWon else null
                        // Free user who used today's daily VS → locked like other modes.
                        val isLocked = !isPro && (completion != null || (isVsCard && vsDailyWon != null))
                        // Per-card VS swords shortcut removed (redundant) — VS is
                        // reachable only from the dedicated VS Battle card.
                        val showVs = false
                        // The VS card needs the unlimited flag too (no engineMode) so the
                        // handler can choose lobby (unlimited) vs daily match.
                        val unlimited = unlimitedMode && (card.engineMode != null || isVsCard)
                        ModeCardView(card, shownCompletion, isLocked, showVs, Modifier.weight(1f), vsWon = vsWon, onVs = { onVs(card) }) {
                            if (isLocked) limitModal = card else onSelectMode(card, unlimited)
                        }
                    }
                    if (rowCards.size == 1) Spacer(Modifier.weight(1f))
                }
            }

            LiveBanner(isPro = isPro, onInvite = { inviteOpen = true })
            // Sign Out (web + iOS home footer parity) — subtle muted text button.
            // Only when there's a real session: a guest has nothing to sign out
            // of (the header shows "Sign In").
            val isAuthed by com.wordocious.app.data.AuthService.isAuthenticated.collectAsState()
            if (isAuthed) {
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .clickableNoRipple { signOutScope.launch { com.wordocious.app.data.AuthService.signOut() } }
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.AutoMirrored.Filled.Logout, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Sign Out", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
            FooterLinks(onNavigate)
            Spacer(Modifier.height(16.dp))
        }
    }
        // Free-user daily-limit modal (web ModeLimitModal). "View Solved Puzzle"
        // opens the finished daily (GameScreen resumes → post-game screen).
        limitModal?.let { card ->
            ModeLimitModal(
                modeName = card.title,
                onClose = { limitModal = null },
                onGoPro = onGoPro,
                onViewPuzzle = { onSelectMode(card, false) },
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
        // One-time Daily Sweep / Flawless Victory celebration overlay.
        if (showSweep) {
            SweepCelebration(
                byMode = completions,
                onShare = { com.wordocious.app.data.DailySweepShare.share(context, completions) },
                onClose = { showSweep = false },
            )
        }
    }
    // Pro-only "Invite a friend to VS" modal (web InviteModal / iOS InviteSheet).
    if (inviteOpen) InviteSheet(onDismiss = { inviteOpen = false })
}

/**
 * U2: compact dismissible "start here" card for brand-new accounts — sparkle
 * icon, Classic pitch, a Play button that launches the Classic DAILY (same
 * route as the Classic mode card) and a "How to play" text link.
 */
@Composable
private fun FirstGameCard(onPlay: () -> Unit, onHowToPlay: () -> Unit, onDismiss: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            Icons.Filled.AutoAwesome, null,
            tint = Color(0xFF7C3AED), modifier = Modifier.size(28.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("New here? Start with Classic", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Text(
                "The original 5-letter challenge — a fresh puzzle every day.",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
            Text(
                "How to play",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED),
                textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline,
                modifier = Modifier.clickableNoRipple(onHowToPlay).padding(top = 2.dp),
            )
        }
        Box(
            Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF4F46E5))))
                .clickableNoRipple(onPlay)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Text("Play", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
        Icon(
            Icons.Filled.Close, null,
            tint = WTheme.textMuted,
            modifier = Modifier.size(16.dp).clickableNoRipple(onDismiss),
        )
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
            .clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface)
            .border(1.5.dp, Color(0xFFFDE68A), RoundedCornerShape(16.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            androidx.compose.material.icons.Icons.Filled.WorkspacePremium, null,
            tint = Color(0xFFD97706), modifier = Modifier.size(32.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("You're on a streak!", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Text(
                "Upgrade to Pro for ad-free play, stats, shields, and more.",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
        Box(
            Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                .clickableNoRipple(onGoPro)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Text("Go Pro", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
        Icon(
            androidx.compose.material.icons.Icons.Filled.Close, null,
            tint = WTheme.textMuted,
            modifier = Modifier.size(16.dp).clickableNoRipple(onDismiss),
        )
    }
}

/** Shared fixed height for ALL home heroes (Daily / Sweep / Flawless / Unlimited)
 *  so toggling Daily<->Unlimited never shifts the game-cards grid (web parity). */
internal val HERO_HEIGHT = 78.dp

@Composable
private fun DailyHero(
    completions: Map<String, com.wordocious.app.data.DailyCompletionsService.Completion>,
    onShare: () -> Unit = {},
) {
    val secs by rememberMidnightCountdown()
    val total = 9
    val completed = completions.size
    val wins = completions.values.count { it.completed }
    val allDone = completed >= total
    val flawless = allDone && wins >= total
    val totals = remember(completions) { com.wordocious.app.data.DailyCompletionsService.totals(completions) }
    val totalTime = "%d:%02d".format(totals.totalTimeSeconds / 60, totals.totalTimeSeconds % 60)
    // Sweep/Flawless variants replace the daily challenge once all 9 are done (web parity).
    val grad = when {
        flawless -> listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A))
        allDone -> listOf(Color(0xFFF5F3FF), Color(0xFFFCE7F3))
        else -> listOf(Color(0xFFEDE9FE), Color(0xFFDDD6FE))
    }
    val border = when { flawless -> Color(0xFFF59E0B); allDone -> Color(0xFFC4B5FD); else -> Color(0xFFA78BFA) }
    Column(
        modifier = Modifier.fillMaxWidth().height(HERO_HEIGHT)
            .clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(grad))
            .then(if (allDone) Modifier.heroShimmer() else Modifier)
            .then(if (allDone) Modifier.clickableNoRipple { onShare() } else Modifier)
            .border(1.5.dp, border, RoundedCornerShape(14.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (allDone) {
            val titleGrad = if (flawless) listOf(Color(0xFFD97706), Color(0xFFB45309)) else listOf(Color(0xFFA78BFA), Color(0xFFEC4899))
            val subColor = if (flawless) Color(0xFFB45309) else Color(0xFF6D28D9)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (flawless) {
                    Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                    Text("Flawless Victory!", fontSize = 18.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.linearGradient(titleGrad)))
                    Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                } else {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(16.dp))
                    Text("Daily Sweep!", fontSize = 16.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.linearGradient(titleGrad)))
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color(0xFFEC4899), modifier = Modifier.size(16.dp))
                }
            }
            Text(
                if (flawless) "All $total won · $totalTime · ${totals.totalScore} pts" else "All $total done · $totalTime · ${totals.totalScore} pts",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = subColor, modifier = Modifier.padding(top = 2.dp),
            )
            Text("Tap to share · Next in ${formatCountdown(secs)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = subColor.copy(alpha = 0.75f), modifier = Modifier.padding(top = 2.dp))
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_star), null, tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp))
                Text("Daily Challenge", fontSize = 18.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF4F46E5)))))
                Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_star), null, tint = Color(0xFF4F46E5), modifier = Modifier.size(20.dp))
            }
            Text("9 puzzles · Leaderboards & medals", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9), modifier = Modifier.padding(top = 2.dp))
            Text("Resets in ${formatCountdown(secs)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9), modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun WordOfTheDayCard(onClick: () -> Unit = {}) {
    val word by produceState<String?>(initialValue = null) {
        DictionaryLoader.ensureLoaded()
        val sols = GameDictionary.allSolutions()
        val daysSinceEpoch = (System.currentTimeMillis() / 86_400_000L).toInt()
        value = if (sols.isNotEmpty()) sols[daysSinceEpoch % sols.size] else null
    }
    // Definition from dictionaryapi.dev (same source as the post-game card).
    val def by produceState<com.wordocious.app.data.DefinitionService.WordDefinition?>(initialValue = null, key1 = word) {
        value = word?.let { com.wordocious.app.data.DefinitionService.fetch(it) }
    }
    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
            .clickableNoRipple(onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_book_open), null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(6.dp))
            Text("WORD OF THE DAY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Spacer(Modifier.weight(1f))
            Text("Past words", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC4B5FD))
            Icon(Icons.Filled.ChevronRight, null, tint = Color(0xFFC4B5FD), modifier = Modifier.size(12.dp))
        }
        val w = word   // local capture: produceState delegate can't smart-cast
        if (w == null) {
            // Web parity: structural animate-pulse skeleton, not a "…" placeholder.
            Spacer(Modifier.height(4.dp))
            SkeletonBlock(height = 16.dp, width = 70.dp, cornerRadius = 6.dp)
            Spacer(Modifier.height(6.dp))
            SkeletonBlock(height = 10.dp, cornerRadius = 5.dp)
            return@Column
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val display = w.first().uppercase() + w.drop(1).lowercase()
            Text(display, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            def?.takeIf { it.partOfSpeech.isNotBlank() }?.let {
                // Web parity (page.tsx): plain italic purple text, no background pill.
                Text(
                    it.partOfSpeech.lowercase(), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, color = Color(0xFF7C3AED),
                )
            }
        }
        def?.takeIf { it.definition.isNotBlank() }?.let {
            Text(it.definition, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF4B5563), maxLines = 2, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun ModeCardView(
    card: ModeCard,
    completion: com.wordocious.app.data.DailyCompletionsService.Completion?,
    isLocked: Boolean,
    showVs: Boolean,
    modifier: Modifier,
    vsWon: Boolean? = null,
    onVs: () -> Unit,
    onClick: () -> Unit,
) {
    // VS has no solo completion row; vsWon carries today's daily-VS outcome.
    val vsDone = vsWon != null
    val isDone = completion != null || vsDone
    val doneWon = completion?.completed ?: (vsWon == true)
    // Completed daily: soft tint in the mode's accent + accent border (web parity).
    // Locked (free user, played today): dimmed 60% + gray border.
    val cardBg = if (isDone) card.accent.copy(alpha = 0.06f) else WTheme.surface
    val cardBorder = if (isLocked) Color(0xFFD1D5DB) else if (isDone) card.accent.copy(alpha = 0.4f) else WTheme.border

    Box(
        modifier = modifier
            .cardShadow(14.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(cardBg)
            .border(1.5.dp, cardBorder, RoundedCornerShape(14.dp))
            .then(if (isLocked) Modifier.alpha(0.6f) else Modifier)
            .clickableNoRipple(onClick),
    ) {
        // Top accent bar (web h-1 gradient accent → accent88)
        Box(
            modifier = Modifier.fillMaxWidth().height(4.dp)
                .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
                .background(Brush.horizontalGradient(listOf(card.accent, card.accent.copy(alpha = 0.53f)))),
        )
        Column(modifier = Modifier.padding(12.dp)) {
            // Icon box (8x8 rounded, accent @ ~8% bg)
            Box(
                modifier = Modifier.size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(card.accent.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center,
            ) {
                ModeGlyph(card, card.accent, glyphSize = 11.sp, iconSize = 16.dp)
            }
            Spacer(Modifier.height(6.dp))
            Text(card.title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            // Completed daily shows guesses · time; else the mode description (web parity).
            Text(
                if (completion != null) {
                    val g = completion.guessCount
                    "$g ${if (g == 1) "guess" else "guesses"} · ${fmtShort(completion.timeSeconds)}"
                } else if (vsDone) "Played today" else card.desc,
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }

        // W/L pill top-right when today's daily is on the books (web parity).
        if (isDone) {
            Box(
                modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)
                    .size(20.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (doneWon) Color(0xFF7C3AED) else Color(0xFFDC2626)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (doneWon) "W" else "L",
                    fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                )
            }
        }

        // VS swords button (Pro + Unlimited) — quick-match this mode (web parity).
        if (showVs) {
            Box(
                modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).size(26.dp)
                    .clip(RoundedCornerShape(8.dp)).background(Color(0xFF0D9488).copy(alpha = 0.12f))
                    .border(1.dp, Color(0xFF0D9488).copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                    .clickableNoRipple(onVs),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords),
                    contentDescription = "VS", tint = Color(0xFF0D9488), modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}

private fun fmtShort(secs: Int): String =
    if (secs <= 0) "—" else if (secs < 60) "${secs}s" else "${secs / 60}m ${secs % 60}s"

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
    val modeTitle = MODE_CARDS.firstOrNull { it.engineMode?.name == top.gameMode }?.title ?: top.gameMode

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
            Modifier.size(36.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Color(0xFFEC4899)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(androidx.compose.material.icons.Icons.Filled.Email, null, tint = Color.White, modifier = Modifier.size(16.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                "@${inviterNames[top.inviterId] ?: "A friend"} invited you to $modeTitle",
                fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            if (invites.size > 1) {
                Text("+${invites.size - 1} more pending", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA21CAF))
            }
        }
        Text(
            "Play",
            fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White,
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFFEC4899))
                .clickableNoRipple {
                    runCatching { com.wordocious.core.GameMode.valueOf(top.gameMode) }.getOrNull()?.let { m ->
                        onJoinInvite(m, top.inviteCode)
                    }
                }
                .padding(horizontal = 12.dp, vertical = 7.dp),
        )
        Box(
            Modifier.size(28.dp).clip(androidx.compose.foundation.shape.CircleShape)
                .background(WTheme.surface)
                .border(1.5.dp, Color(0xFFF5D0FE), androidx.compose.foundation.shape.CircleShape)
                .clickableNoRipple {
                    scope.launch {
                        com.wordocious.app.data.InviteService.markInviteDeclined(top.id)
                        invites = invites.filter { it.id != top.id }
                        // Next inviter's name is already in the batched map — no extra query.
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(androidx.compose.material.icons.Icons.Filled.Close, "Dismiss", tint = Color(0xFFA21CAF), modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun LiveBanner(isPro: Boolean = false, onInvite: () -> Unit = {}) {
    // Web useLivePlayerCount: poll {server}/presence every 10s for body.online;
    // null until the first success, keep last value on errors.
    val count by androidx.compose.runtime.produceState<Int?>(initialValue = null) {
        // Defer the FIRST request ~2s so it doesn't compete with the home
        // screen's initial loads; 10s cadence after as before.
        kotlinx.coroutines.delay(2_000)
        while (true) {
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
            .clip(RoundedCornerShape(14.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFF22C55E)))
        Text("LIVE", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(
            count?.let { "$it ${if (it == 1) "player" else "players"} online" } ?: "Players online",
            fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        // Pro-only Invite button (web page.tsx + iOS HomeView LIVE banner parity).
        if (isPro) {
            Spacer(Modifier.weight(1f))
            Text(
                "Invite",
                fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFEC4899), Color(0xFFDB2777))))
                    .clickable { onInvite() }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun FooterLinks(onNavigate: (String) -> Unit = {}) {
    // Full site-nav footer (How to Play / Guides / Strategy / Words / About / FAQ
    // / Privacy / Terms) — parity with the web home footer + the header dropdown.
    InfoFooter(onNav = onNavigate)
}

@Composable
private fun rememberMidnightCountdown() = produceState(initialValue = secondsUntilLocalMidnight()) {
    while (true) {
        value = secondsUntilLocalMidnight()
        delay(1000)
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

private fun formatCountdown(secs: Long): String {
    val h = secs / 3600
    val m = (secs % 3600) / 60
    val s = secs % 60
    return "%02d:%02d:%02d".format(h, m, s)
}

/** Subtle diagonal foil shimmer sweeping across the Sweep/Flawless banner. */
private fun Modifier.heroShimmer(): Modifier = composed {
    val transition = rememberInfiniteTransition(label = "heroShimmer")
    val x by transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(2400, easing = LinearEasing), RepeatMode.Restart),
        label = "x",
    )
    drawWithContent {
        drawContent()
        val w = size.width
        val bandW = w * 0.4f
        val start = -bandW + x * (w + bandW * 2f)
        drawRect(
            brush = Brush.horizontalGradient(
                colors = listOf(Color.Transparent, Color.White.copy(alpha = 0.4f), Color.Transparent),
                startX = start, endX = start + bandW,
            ),
        )
    }
}
