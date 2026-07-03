package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.offset
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.graphics.toArgb
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import kotlinx.coroutines.launch

/**
 * Profile screen — ported from web /profile/page.tsx. Sections:
 *   A. Header: avatar, username + PRO, level-tier pill, XP bar, member-since, Go Pro
 *   B. Today's Dailies grid (5+4 badges with W/L)
 *   C. Global Summary row (Wins / Win Rate / Streak / Daily — 4 icon cards)
 *   D. Daily Medals (gold/silver/bronze counts)
 *   E. Stats by mode + Recent Matches
 *   F. Sign out
 * (ProfileDashboard charts, 72-item Achievements + Edit Profile are follow-ups.)
 */
private val DAILY_MODES = listOf("DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "DUEL_6", "DUEL_7", "GAUNTLET", "PROPERNOUNDLE")

@Composable
fun ProfileScreen(onGoPro: () -> Unit = {}, onEditProfile: () -> Unit = {}, onPlayDaily: (GameMode) -> Unit = {}) {
    val profile by AuthService.profile.collectAsState()
    val scope = rememberCoroutineScope()
    var stats by remember { mutableStateOf<List<ProfileService.UserStat>>(emptyList()) }
    var recentMatches by remember { mutableStateOf<List<ProfileService.RecentMatch>>(emptyList()) }
    // VS opponents' usernames for the "· vs <name>" line (web profile parity).
    var opponentNames by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var medals by remember { mutableStateOf<List<ProfileService.UserMedal>>(emptyList()) }
    var todayDailies by remember { mutableStateOf<Map<String, DailyCompletionsService.Completion>>(emptyMap()) }
    var unlockedAchievements by remember { mutableStateOf<Set<String>>(emptySet()) }
    var guessDist by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.GuessBucket>>(emptyList()) }
    var activity7 by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.DayActivity>>(emptyList()) }
    var activityCal by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.DayActivity>>(emptyList()) }
    var solveTimes by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.SolvePoint>>(emptyList()) }
    var timeOfDay by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.HourBucket>>(emptyList()) }
    var topWords by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.TopWord>>(emptyList()) }
    var proInsights by remember { mutableStateOf(com.wordocious.app.data.MatchStatsService.ProInsights()) }
    // Sweep COUNTS moved to Records → You (single home); profile keeps only the
    // Daily Points trend, so only the points series is fetched here.
    var sweepPoints by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.DailyPointsPoint>>(emptyList()) }
    // Per-mode dashboard filter — null == "All" (global view). Mirrors iOS ProfileModePicker.
    var selectedMode by remember { mutableStateOf<String?>(null) }
    // Solo/VS toggle (web profile/page.tsx) — filters user_stats by play_type.
    var activeTab by remember { mutableStateOf("solo") }
    // Per-mode win streak (current, best) from match history — mirrors web
    // mode-stats-card / iOS mode-detail streak. Play-type-scoped (restat B1),
    // so it reloads when the Solo/VS/VS-CPU toggle changes.
    var modeStreaks by remember { mutableStateOf<Map<String, Pair<Int, Int>>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }
    // Account section (web §H) — Delete Account inline confirm + error/in-flight state.
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf(false) }
    // Daily Reminders toggle (web §H NotificationToggle parity) — backed by the
    // existing NotificationService (WorkManager chain) + SettingsPref, identical
    // to the Settings screen toggle.
    val context = androidx.compose.ui.platform.LocalContext.current
    var dailyReminder by remember { mutableStateOf(SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) }
    val notifPermLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) com.wordocious.app.data.NotificationService.schedule(context) }

    val userId = profile?.id
    // Re-run the instant a daily is recorded (completionTick) so Today's Dailies
    // + stats update immediately, without a tab round-trip.
    val tick by DailyCompletionsService.completionTick.collectAsState()
    LaunchedEffect(userId, tick) {
        if (userId != null) {
            stats = ProfileService.fetchUserStats(userId)
            recentMatches = ProfileService.fetchRecentMatches(userId)
            val oppIds = recentMatches.filter { it.player2Id != null }
                .map { if (it.player1Id == userId) it.player2Id!! else it.player1Id }
                .distinct()
            opponentNames = ProfileService.fetchUsernames(oppIds)
            medals = ProfileService.fetchUserMedals(userId, limit = 100)
            todayDailies = DailyCompletionsService.fetchTodayCompletions()
            unlockedAchievements = com.wordocious.app.data.AchievementService.fetchUnlocked(userId)
            activityCal = com.wordocious.app.data.MatchStatsService.dailyCalendar(userId, days = 90)
            sweepPoints = com.wordocious.app.data.MatchStatsService.dailyPointsOverTime(days = 30)
        }
        loading = false
    }
    // Mode-scoped chart data — reloads whenever the picker OR the play-type
    // toggle changes (restat B1: every per-game stat is scoped to the toggle;
    // vs_cpu fetchers return empty and a "totals only" note shows instead).
    val isProActive = AuthService.isProActive
    LaunchedEffect(userId, selectedMode, isProActive, activeTab, tick) {
        val uid = userId ?: return@LaunchedEffect
        val m = selectedMode
        guessDist = com.wordocious.app.data.MatchStatsService.guessDistribution(uid, m, activeTab)
        // LAST 7 DAYS is GLOBAL (web fetchActivityByDay takes no mode and no
        // play-type) and only rendered in the All view — load it unfiltered.
        activity7 = com.wordocious.app.data.MatchStatsService.activity(uid, days = 7, mode = null)
        solveTimes = com.wordocious.app.data.MatchStatsService.solveTimes(uid, m, playType = activeTab)
        timeOfDay = com.wordocious.app.data.MatchStatsService.timeOfDay(uid, m, activeTab)
        topWords = com.wordocious.app.data.MatchStatsService.topWords(uid, m, playType = activeTab)
        proInsights = if (m != null && isProActive) com.wordocious.app.data.MatchStatsService.proInsights(uid, m, activeTab)
        else com.wordocious.app.data.MatchStatsService.ProInsights()
        // Per-mode win streak for each mode the player has stats in (scoped to
        // the toggle — waits on `stats` from the main effect via the tick key).
        modeStreaks = ProfileService.fetchUserStats(uid).map { it.gameMode }.distinct()
            .associateWith { com.wordocious.app.data.MatchStatsService.modeWinStreak(uid, it, activeTab) }
    }

    val isGuest by AuthService.isGuest.collectAsState()
    if (isGuest) {
        // Guest — profile/stats are account-based. Prompt sign-in (web/iOS parity).
        Column(
            Modifier.fillMaxSize().background(WTheme.bg).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Text("Sign in to track your stats", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text, textAlign = TextAlign.Center)
            Text("Save your streaks, climb the daily leaderboards, and unlock achievements.", fontSize = 13.sp, color = WTheme.textMuted, textAlign = TextAlign.Center)
            Box(
                Modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.primary)
                    .clickableNoRipple { AuthService.exitGuest() }.padding(horizontal = 32.dp, vertical = 13.dp),
                contentAlignment = Alignment.Center,
            ) { Text("Sign in", color = Color.White, fontWeight = FontWeight.Black, fontSize = 15.sp) }
            Spacer(Modifier.weight(1f))
        }
        return
    }
    LazyColumn(
        // navigationBarsPadding keeps the bottom of the scroll (Sign Out / Delete
        // Account) clear of the system gesture-nav inset; the host Scaffold already
        // reserves the bottom-nav height. Extra 24dp tail matches web's pb-32.
        modifier = Modifier.fillMaxSize().background(WTheme.bg).navigationBarsPadding()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(Modifier.height(8.dp)) }

        // ── A. Header ─────────────────────────────────────────────
        item {
            ProfileHeader(profile, onGoPro, onEditProfile, onShare = {
                profile?.let { pr ->
                    val total = pr.totalWins + pr.totalLosses
                    val achTotal = com.wordocious.app.data.AchievementCatalog.cached().size
                    com.wordocious.app.data.ProfileShare.share(context, com.wordocious.app.data.ProfileShare.ProfileInput(
                        username = pr.username ?: "Player",
                        level = pr.level, tier = levelTier(pr.level).label,
                        accent = ProfileAccent.color(pr.accentColor).toArgb(),
                        totalWins = pr.totalWins,
                        winRate = if (total > 0) Math.round(pr.totalWins * 100f / total) else 0,
                        currentStreak = pr.currentStreak, dailyStreak = pr.dailyLoginStreak,
                        gold = pr.goldMedals, silver = pr.silverMedals, bronze = pr.bronzeMedals,
                        achievementsUnlocked = unlockedAchievements.size,
                        achievementsTotal = if (achTotal > 0) achTotal else 72,
                    ))
                }
            })
        }

        // ── B. Today's Dailies ────────────────────────────────────
        item { TodaysDailies(todayDailies, onPlayDaily) }

        // ── C. Snapshot hero (lifetime headline stats + this-week strip,
        //       merged into ONE card — web snapshot-hero.tsx) ────────
        item {
            SnapshotHero(
                totalWins = profile?.totalWins ?: 0,
                totalLosses = profile?.totalLosses ?: 0,
                currentStreak = profile?.currentStreak ?: 0,
                bestStreak = profile?.bestStreak ?: 0,
                dailyStreak = profile?.dailyLoginStreak ?: 0,
                bestDailyStreak = profile?.bestDailyLoginStreak ?: 0,
                gamesThisWeek = activity7.sumOf { it.played },
                level = profile?.level ?: 1,
                xpToNext = 1000 - ((profile?.xp ?: 0) % 1000),
                isPro = isProActive, onGoPro = onGoPro,
            )
        }

        // Daily standing — "top X% today · across N dailies" (hidden until a
        // daily is played today; refetches on completionTick).
        item { DailyStandingStrip(reloadToken = tick) }

        // ── Solo/VS toggle (web profile/page.tsx §D) ────────────────
        item { SoloVsToggle(activeTab) { activeTab = it } }

        // Tab-specific summary cards (VS record / Rivalries / CPU record) —
        // F1: fade+rise on each Solo/VS/VS CPU swap instead of snapping. One
        // AnimatedContent item keyed on activeTab drives the transition.
        item {
            SwapFade(targetState = activeTab) { tab ->
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (tab == "vs") {
                        VsRecordCard(stats)
                        // Rivalries — most-faced opponents with head-to-head bars
                        // (Pro), only once there's an actual VS record (web parity).
                        val vsTotal = stats.filter { it.playType == "vs" }.sumOf { it.wins + it.losses }
                        if (vsTotal > 0) RivalriesCard(isPro = isProActive, onGoPro = onGoPro)
                    }
                    if (tab == "vs_cpu") CpuRecordCard(stats)
                }
            }
        }

        // ── Dashboard: per-mode picker + charts ────────────────────
        // The mode picker itself does NOT re-animate (web/iOS parity); only the
        // content below it fades on swap.
        item {
            val filtered = stats.filter { it.playType == activeTab }
            val gamesPerMode = filtered.groupBy { it.gameMode }.mapValues { (_, rows) -> rows.sumOf { it.totalGames } }
            ProfileModePicker(selected = selectedMode, gamesPerMode = gamesPerMode, onSelect = { selectedMode = it })
        }
        // F1: dashboard content eases in on mode / play-type swap. One
        // AnimatedContent item keyed on (activeTab, selectedMode).
        item {
            SwapFade(targetState = activeTab to selectedMode) { (tab, mode) ->
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (mode == null) {
                        // ── "All" global view — web Trends order (restat R1).
                        // CPU practice records totals only — per-game charts draw
                        // from match rows CPU games never write (restat B1).
                        if (tab == "vs_cpu") {
                            Text(
                                "CPU practice records totals only — charts track Solo and VS matches.",
                                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                textAlign = TextAlign.Center,
                            )
                        }
                        if (activityCal.any { it.played > 0 }) DailyCalendarCard(activityCal)
                        if (activity7.isNotEmpty()) ActivityCard(activity7)
                        // All view hides empty charts (web gates on data).
                        if (guessDist.any { it.count > 0 }) GuessDistributionCard(guessDist)
                        if (solveTimes.size >= 2) SolveTimeCard(solveTimes)
                        // Daily points trend (sweep/flawless days marked).
                        DailyPointsChartCard(sweepPoints)
                        if (topWords.isNotEmpty()) TopWordsCard(topWords)
                        // Opener Lab (basic): favorite starting words + conversion.
                        OpenerLabCard(playType = tab)
                        // Weekday form: your best day of the week.
                        WeekdayFormCard(playType = tab)
                        // Insights — up to two derived one-liners.
                        val insights = profileInsights(stats, activity7, profile, todayDailies)
                        if (insights.isNotEmpty()) InsightsCard(insights)
                        // Pro Stats (global view; SOLO rows only).
                        if (!isProActive || stats.isNotEmpty()) {
                            ProStatsCard(stats.filter { it.playType == "solo" }, isProActive, onGoPro)
                        }
                        // Skill Radar — the five-axis signature chart (Pro).
                        SkillRadarCard(isPro = isProActive, onGoPro = onGoPro)
                    } else {
                        // ── Mode-detail view (web mode-detail-panel.tsx). ──
                        ModeDetailHeader(mode, tab)
                        val tabStats = stats.filter { it.playType == tab && it.gameMode == mode }
                        if (tabStats.isEmpty()) {
                            Box(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                                    .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(24.dp),
                                Alignment.Center,
                            ) {
                                Text(
                                    "No ${if (tab == "solo") "solo" else if (tab == "vs") "VS" else "VS CPU"} games played in this mode yet",
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                )
                            }
                        } else {
                            ModeStatsGrid(tabStats, modeStreaks[mode])
                        }
                        // Gauntlet: 50 guesses across 21 boards — histogram meaningless.
                        if (mode != "GAUNTLET") GuessDistributionCard(guessDist)
                        if (solveTimes.size >= 2) SolveTimeCard(solveTimes)
                        if (topWords.isNotEmpty()) TopWordsCard(topWords)
                        // WHEN YOU PLAY (time-of-day) — standalone here (Android extra).
                        if (timeOfDay.any { it.played > 0 }) WhenYouPlayCard(timeOfDay)
                        // Per-mode Pro Insights — self-gates.
                        if (!isProActive || proInsights != com.wordocious.app.data.MatchStatsService.ProInsights()) {
                            ProInsightsCard(proInsights, isProActive, onGoPro)
                        }
                        // Deep Insights (restat R4). Hidden on vs_cpu (restat B1).
                        if (tab != "vs_cpu") {
                            val accent = runCatching { modeAccent(GameMode.valueOf(mode)) }.getOrDefault(WTheme.primary)
                            ProDeepModeCard(gameMode = mode, isPro = isProActive, accent = accent, onGoPro = onGoPro, playType = tab)
                        } else {
                            Text(
                                "CPU practice records totals only — per-game charts track Solo and VS matches.",
                                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }

        // ── Progression: medals + achievements under one banner (BOTH views) ──
        item { SectionHeader("Progression", accent = Color(0xFFF59E0B)) }
        item { DailyMedals(profile, medals) }
        item { AchievementsSection(unlockedAchievements, profile) }

        if (loading) {
            item { Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) { CircularProgressIndicator(color = WTheme.primary) } }
        }

        // ── Recent matches ────────────────────────────────────────
        // Web parity (profile/page.tsx): skeleton rows while loading, then the
        // matches or "No matches played yet." — the section never just vanishes.
        item { SectionLabel("RECENT MATCHES") }
        if (loading) {
            item {
                Column { repeat(5) { SkeletonBlock(height = 52.dp, cornerRadius = 12.dp); Spacer(Modifier.height(8.dp)) } }
            }
        } else if (recentMatches.isEmpty()) {
            item {
                Text(
                    "No matches played yet.", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        } else {
            items(recentMatches) { m ->
                val oppId = if (m.player2Id == null) null else if (m.player1Id == userId) m.player2Id else m.player1Id
                RecentMatchRow(m, userId, opponentName = oppId?.let { opponentNames[it] ?: "Unknown" })
                Spacer(Modifier.height(8.dp))
            }
        }

        // (Account actions — Daily Reminders / Sign Out / Delete Account — live
        // in Settings now; removed from the profile page per product direction.)
    }
}

// ── A. Header ───────────────────────────────────────────────────────────────
private data class Tier(val label: String, val bg: Color, val border: Color, val color: Color)

private fun levelTier(level: Int): Tier = when {
    level >= 100 -> Tier("Diamond", Color(0xFFEFF6FF), Color(0xFFBFDBFE), Color(0xFF1D4ED8))
    level >= 51 -> Tier("Platinum", Color(0xFFF5F3FF), Color(0xFFC4B5FD), Color(0xFF6D28D9))
    level >= 26 -> Tier("Gold", Color(0xFFFEF9EC), Color(0xFFFDE68A), Color(0xFF92400E))
    level >= 11 -> Tier("Silver", Color(0xFFF3F4F6), Color(0xFFD1D5DB), Color(0xFF374151))
    else -> Tier("Bronze", Color(0xFFFEF2E8), Color(0xFFFED7AA), Color(0xFF9A3412))
}

private val MONTHS = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
/** "Member since Mon YYYY" from an ISO created_at (YYYY-MM-...). */
private fun memberSince(createdAt: String?): String? {
    val s = createdAt ?: return null
    val y = s.substring(0, 4)
    val m = s.substring(5, 7).toIntOrNull() ?: return null
    return "${MONTHS[(m - 1).coerceIn(0, 11)]} $y"
}

@Composable
private fun ProfileHeader(profile: com.wordocious.app.data.Profile?, onGoPro: () -> Unit = {}, onEditProfile: () -> Unit = {}, onShare: () -> Unit = {}) {
    val level = profile?.level ?: 1
    val xp = profile?.xp ?: 0
    val tier = levelTier(level)
    val levelProgress = (xp % 1000) / 10f / 100f       // (xp%1000)/10 as a 0..1 fraction
    val xpToNext = 1000 - (xp % 1000)
    val initial = (profile?.username?.firstOrNull() ?: 'P').uppercaseChar().toString()

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Avatar — real image (avatar_url) via Coil, else the initial in a gradient circle.
        val avatarUrl = profile?.avatarUrl?.takeIf { it.isNotBlank() }
        Box(
            Modifier.size(96.dp).clip(CircleShape)
                .background(if (ProfileAccent.isCustom(profile?.accentColor)) ProfileAccent.avatarBrush(profile?.accentColor) else Brush.linearGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd))),
            contentAlignment = Alignment.Center,
        ) {
            if (avatarUrl != null) {
                coil.compose.AsyncImage(
                    model = avatarUrl, contentDescription = "Avatar",
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                )
            } else {
                Text(profile?.avatarEmoji?.takeIf { it.isNotBlank() } ?: initial, fontSize = 40.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (ProfileAccent.isCustom(profile?.accentColor)) {
                Text(profile?.username ?: "Player", fontSize = 28.sp, fontWeight = FontWeight.Black, color = ProfileAccent.color(profile?.accentColor))
            } else {
                Text(
                    profile?.username ?: "Player", fontSize = 28.sp, fontWeight = FontWeight.Black,
                    style = androidx.compose.ui.text.TextStyle(
                        brush = Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFEC4899), Color(0xFFA78BFA))),
                    ),
                )
            }
            if (profile?.isPro == true) {
                Text(
                    "PRO", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp))
                        .background(Brush.linearGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd)))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }

        ProfilePersonalizationRow(profile)

        // Level-tier pill
        Row(
            modifier = Modifier.clip(RoundedCornerShape(50)).background(tier.bg)
                .border(1.5.dp, tier.border, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Icon(Icons.Filled.Star, null, tint = tier.color, modifier = Modifier.size(13.dp))
            Text("Level $level", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = tier.color)
            Text("·", fontSize = 12.sp, color = tier.color.copy(alpha = 0.7f))
            Text(tier.label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = tier.color)
        }

        // XP bar + "{n} XP to next"
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.width(160.dp).height(6.dp).clip(RoundedCornerShape(3.dp)).background(WTheme.border)) {
                Box(
                    Modifier.fillMaxWidth(levelProgress.coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFF97316)))),
                )
            }
            Text("$xpToNext XP to next", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(top = 2.dp))
        }
        memberSince(profile?.createdAt)?.let {
            Text("Member since $it", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }

        // Edit profile + Share — pills (web EditProfileButton + Share).
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(
                modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                    .pressScale { onEditProfile() }.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(Icons.Filled.Edit, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(12.dp))
                Text("Edit profile", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF7C3AED))
            }
            Row(
                modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                    .pressScale { onShare() }.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(Icons.Filled.Share, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(12.dp))
                Text("Share", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF7C3AED))
            }
        }

        // Go Pro (non-Pro) + Simulate/Disable Pro (admin) — side by side (web `flex gap-2`).
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (profile?.isPro != true) {
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                        .clickableNoRipple(onGoPro).padding(horizontal = 16.dp, vertical = 6.dp),
                ) { Text("Go Pro", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color.White) }
            }
            // DEV-ONLY (web parity): is_admin-gated Simulate/Disable Pro — flips is_pro.
            if (profile?.isAdmin == true) {
                val pro = profile.isPro
                Box(
                    Modifier.clip(RoundedCornerShape(8.dp))
                        .background(if (pro) Color(0xFFFEF2F2) else Color(0xFFF0FDF4))
                        .border(1.5.dp, if (pro) Color(0xFFFCA5A5) else Color(0xFF86EFAC), RoundedCornerShape(8.dp))
                        .clickableNoRipple { com.wordocious.app.data.AuthService.setProDev(!pro) }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(
                        if (pro) "Disable Pro" else "Simulate Pro",
                        fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (pro) Color(0xFFDC2626) else Color(0xFF16A34A),
                    )
                }
            }
        }
    }
}

// ── B. Today's Dailies ────────────────────────────────────────────────────────
private val MODE_GLYPH = mapOf("QUORDLE" to "IV", "OCTORDLE" to "VIII", "DUEL_6" to "6", "DUEL_7" to "7")

@Composable
private fun TodaysDailies(today: Map<String, DailyCompletionsService.Completion>, onPlayDaily: (GameMode) -> Unit = {}) {
    val completed = DAILY_MODES.count { today.containsKey(it) }
    val wins = DAILY_MODES.count { today[it]?.completed == true }
    val total = DAILY_MODES.size
    val allDone = completed >= total
    val flawless = allDone && wins == total

    val cardBg = when {
        flawless -> Brush.linearGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A)))
        allDone -> Brush.linearGradient(listOf(Color(0xFFF5F3FF), Color(0xFFFCE7F3)))
        else -> Brush.linearGradient(listOf(WTheme.surface, WTheme.surface))
    }
    val cardBorder = if (flawless) Color(0xFFF59E0B) else if (allDone) Color(0xFFC4B5FD) else WTheme.border

    if (!allDone) {
        Row(Modifier.fillMaxWidth().padding(bottom = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("TODAY'S DAILIES", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Text("$completed/$total", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
    }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(cardBg)
            .border(1.5.dp, cardBorder, RoundedCornerShape(16.dp)).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (allDone) {
            Text(
                if (flawless) "Flawless Victory!" else "Daily Sweep!",
                fontSize = if (flawless) 18.sp else 16.sp, fontWeight = FontWeight.Black,
                color = if (flawless) Color(0xFFB45309) else Color(0xFF7C3AED),
            )
        }
        listOf(DAILY_MODES.take(5), DAILY_MODES.drop(5)).forEach { rowModes ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                rowModes.forEach { id -> DailyBadge(id, today[id], onPlayDaily) }
            }
        }
        if (allDone) {
            Text(
                if (flawless) "All $total dailies won today · +600 XP earned" else "All $total dailies completed · +200 XP earned",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                color = if (flawless) Color(0xFFB45309) else Color(0xFF6D28D9),
            )
        }
    }
}

@Composable
private fun DailyBadge(modeId: String, completion: DailyCompletionsService.Completion?, onPlayDaily: (GameMode) -> Unit = {}) {
    val played = completion != null
    val won = completion?.completed == true
    val mode = runCatching { GameMode.valueOf(modeId) }.getOrNull()
    val accent = mode?.let { modeAccent(it) } ?: WTheme.primary
    val tileBg = if (!played) WTheme.bg else if (won) Color(0xFF7C3AED) else Color(0xFFDC2626)
    val tileBorder = if (!played) WTheme.border else tileBg

    // Web parity: each badge is a Link to the mode's daily game — tap opens the
    // daily (completed-puzzle screen if played, fresh puzzle if not).
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(44.dp).then(if (mode != null) Modifier.clickableNoRipple { onPlayDaily(mode) } else Modifier),
    ) {
        Box(
            Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(tileBg).border(1.5.dp, tileBorder, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (played) Text(if (won) "W" else "L", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
            else runCatching { GameMode.valueOf(modeId) }.getOrNull()?.let { ModeGlyph(it, accent, glyphSize = 11.sp, iconSize = 14.dp) }
        }
        Text(modeLabel(modeId), fontSize = 8.sp, fontWeight = FontWeight.Bold, color = if (played) WTheme.text else WTheme.textMuted, maxLines = 1)
    }
}

// ── Recent match row (web parity: icon box + Solo/VS pill + guesses·time + Win/Loss + date) ──
@Composable
private fun RecentMatchRow(m: ProfileService.RecentMatch, userId: String?, opponentName: String? = null) {
    val isPlayer1 = m.player1Id == userId
    val isVs = m.player2Id != null
    val won = m.winnerId == userId
    val score = ((if (isPlayer1) m.player1Score else m.player2Score) ?: 0.0).toInt()
    val timeSec = ((if (isPlayer1) m.player1Time else m.player2Time) ?: 0.0).toInt()
    val mode = runCatching { GameMode.valueOf(m.gameMode) }.getOrNull()
    val accent = mode?.let { modeAccent(it) } ?: WTheme.primary
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.12f)), Alignment.Center) {
            mode?.let { ModeGlyph(it, accent, glyphSize = 11.sp, iconSize = 16.dp) }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(modeLabel(m.gameMode), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1)
                Text(
                    if (isVs) "VS" else "Solo", fontSize = 9.sp, fontWeight = FontWeight.ExtraBold,
                    color = if (isVs) Color(0xFF7C3AED) else Color(0xFF2563EB),
                    modifier = Modifier.clip(RoundedCornerShape(4.dp))
                        .background(if (isVs) Color(0xFFEDE9F6) else Color(0xFFEFF6FF)).padding(horizontal = 6.dp, vertical = 2.dp),
                )
                // Web parity: amber "FORFEIT" chip when this row was a forfeit win.
                if (m.forfeit == true) {
                    Text(
                        "FORFEIT", fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFB45309),
                        modifier = Modifier.clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFFFEF3C7)).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                // Web parity: "· vs <username>" inline on VS rows.
                if (isVs && opponentName != null) {
                    Text(
                        "· vs $opponentName", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        color = WTheme.textMuted, maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                }
            }
            Text(
                "$score ${if (score == 1) "guess" else "guesses"} · ${if (timeSec > 0) fmtMatchTime(timeSec) else "—"}",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(if (won) "Win" else "Loss", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            Text(fmtMatchDate(m.createdAt), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

private fun fmtMatchTime(s: Int): String = if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"

/** "Jun 8 · 3:56 PM" in local time (web toLocaleDateString + toLocaleTimeString). */
private fun fmtMatchDate(iso: String): String {
    val millis = runCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
        .recoverCatching { java.time.Instant.parse(if (iso.endsWith("Z")) iso else "${iso}Z").toEpochMilli() }
        .getOrNull() ?: return iso.take(10)
    return java.text.SimpleDateFormat("MMM d · h:mm a", java.util.Locale.US)
        .apply { timeZone = java.util.TimeZone.getDefault() }.format(java.util.Date(millis))
}

// ── Mode-detail header + stats grid (web mode-detail-panel.tsx) ───────────────
/** Mode icon tile + title in the mode accent, and a read-only play-type chip
 *  that reflects the page-level Solo/VS/VS-CPU toggle. */
@Composable
private fun ModeDetailHeader(modeId: String, activeTab: String) {
    val mode = runCatching { GameMode.valueOf(modeId) }.getOrNull()
    val accent = mode?.let { modeAccent(it) } ?: WTheme.primary
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.08f)), Alignment.Center) {
            mode?.let { ModeGlyph(it, accent, glyphSize = 11.sp, iconSize = 16.dp) }
        }
        Spacer(Modifier.width(8.dp))
        Text(modeLabel(modeId), fontSize = 14.sp, fontWeight = FontWeight.Black, color = accent)
        Spacer(Modifier.weight(1f))
        Row(
            Modifier.clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.08f))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            when (activeTab) {
                "solo" -> Icon(Icons.Filled.Person, null, tint = accent, modifier = Modifier.size(12.dp))
                "vs" -> Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                    tint = accent, modifier = Modifier.size(12.dp),
                )
                else -> Text("🤖", fontSize = 10.sp)
            }
            Text(
                if (activeTab == "solo") "Solo" else if (activeTab == "vs") "VS" else "VS CPU",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = accent,
            )
        }
    }
}

/** 4×2 stats grid for the selected mode (web ModeStatsCard). */
@Composable
private fun ModeStatsGrid(rows: List<ProfileService.UserStat>, streak: Pair<Int, Int>?) {
    val wins = rows.sumOf { it.wins }
    val losses = rows.sumOf { it.losses }
    val games = rows.sumOf { it.totalGames }
    val winRate = if (games > 0) Math.round(wins.toFloat() / games * 100) else 0
    val best = rows.mapNotNull { it.bestScore }.filter { it > 0 }.minOrNull()
    val fastest = rows.mapNotNull { it.fastestTime }.filter { it > 0 }.minOrNull()
    val cells = listOf(
        "Wins" to "$wins", "Losses" to "$losses", "Games" to "$games", "Win Rate" to "$winRate%",
        "Best" to (best?.let { "${it.toInt()}" } ?: "-"),
        "Fastest" to (fastest?.let { if (it < 60) "${it}s" else "${it / 60}m ${it % 60}s" } ?: "-"),
        "Streak" to "${streak?.first ?: 0}", "Best Streak" to "${streak?.second ?: 0}",
    )
    KitCard {
        cells.chunked(4).forEachIndexed { i, row ->
            if (i > 0) Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value) ->
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
                        Text(
                            label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold,
                            color = WTheme.textMuted, letterSpacing = 0.4.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

// ── Insights (All view, web profile/page.tsx `insights` IIFE) ─────────────────
/** Up to two derived one-liners: strongest mode, weekly volume, XP-to-next,
 *  today's dailies progress. */
private fun profileInsights(
    stats: List<ProfileService.UserStat>,
    activity7: List<com.wordocious.app.data.MatchStatsService.DayActivity>,
    profile: com.wordocious.app.data.Profile?,
    todayDailies: Map<String, DailyCompletionsService.Completion>,
): List<String> {
    val out = ArrayList<String>()
    // Strongest mode by win rate among modes with ≥3 games (all play types,
    // matching the web which uses the unfiltered stats).
    val qualifying = stats.filter { it.totalGames >= 3 }
    qualifying.maxByOrNull { it.wins.toDouble() / maxOf(1, it.totalGames) }?.let { strongest ->
        val rate = Math.round(strongest.wins * 100.0 / strongest.totalGames)
        out.add("Your strongest mode is ${modeLabel(strongest.gameMode)} at $rate% win rate.")
    }
    val weekTotal = activity7.sumOf { it.played }
    if (weekTotal >= 10) out.add("You've played $weekTotal games this week — on a roll!")
    else if (weekTotal in 1..4) out.add("Only $weekTotal game${if (weekTotal == 1) "" else "s"} this week — warm up with a daily.")
    val xpToNext = 1000 - ((profile?.xp ?: 0) % 1000)
    if (xpToNext <= 300) out.add("Just $xpToNext XP away from Level ${(profile?.level ?: 1) + 1}.")
    val total = DAILY_MODES.size
    if (todayDailies.size == total) {
        val allWon = DAILY_MODES.all { todayDailies[it]?.completed == true }
        out.add(if (allWon) "Flawless Victory — all $total dailies won today." else "All $total dailies done today. Legendary.")
    } else if (todayDailies.size >= 3) {
        out.add("${todayDailies.size}/$total dailies complete today — keep going.")
    }
    return out.take(2)
}

@Composable
private fun InsightsCard(insights: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Insights", accent = WTheme.primary)
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                .background(Brush.linearGradient(listOf(Color(0xFFF5F3FF), Color(0xFFEEF2FF))))
                .border(1.5.dp, Color(0xFFDDD6FE), RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            insights.forEach { text ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(14.dp))
                    Text(text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1A1A2E), lineHeight = 16.sp)
                }
            }
        }
    }
}

// ── D. Daily Medals ───────────────────────────────────────────────────────────
@Composable
private fun DailyMedals(profile: com.wordocious.app.data.Profile?, medals: List<ProfileService.UserMedal>) {
    // Prefer the aggregate columns; fall back to counting the medals list by type.
    val gold = profile?.goldMedals?.takeIf { it > 0 } ?: medals.count { it.medalType == "gold" }
    val silver = profile?.silverMedals?.takeIf { it > 0 } ?: medals.count { it.medalType == "silver" }
    val bronze = profile?.bronzeMedals?.takeIf { it > 0 } ?: medals.count { it.medalType == "bronze" }
    if (gold == 0 && silver == 0 && bronze == 0 && medals.isEmpty()) return

    var showAll by remember { mutableStateOf(false) }
    SectionLabel("DAILY MEDALS")
    Spacer(Modifier.height(8.dp))
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MedalCard(crown = true, count = gold, label = "Gold", color = Color(0xFFD97706), modifier = Modifier.weight(1f))
            MedalCard(crown = false, count = silver, label = "Silver", color = WTheme.textMuted, modifier = Modifier.weight(1f))
            MedalCard(crown = false, count = bronze, label = "Bronze", color = Color(0xFFB45309), modifier = Modifier.weight(1f))
        }
        if (medals.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                (if (showAll) medals else medals.take(5)).forEach { MedalHistoryRow(it) }
            }
            if (medals.size > 5) {
                Text(
                    if (showAll) "Show less" else "View all ${medals.size} medals ›",
                    fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.primary,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().clickableNoRipple { showAll = !showAll },
                )
            }
        }
    }
}

@Composable
private fun MedalHistoryRow(m: ProfileService.UserMedal) {
    val color = when (m.medalType) {
        "gold" -> Color(0xFFD97706); "silver" -> WTheme.textMuted; "bronze" -> Color(0xFFB45309)
        "streak_7" -> Color(0xFFEA580C); "streak_30" -> Color(0xFFDC2626); "streak_100" -> Color(0xFF7C3AED)
        "perfect" -> Color(0xFF7C3AED); else -> WTheme.textMuted
    }
    val label = when (m.medalType) {
        "streak_7" -> "7-Day Streak"; "streak_30" -> "30-Day Streak"; "streak_100" -> "100-Day Streak"
        "perfect" -> "Perfect!"
        else -> MODE_OPTIONS.firstOrNull { it.first == m.gameMode }?.second ?: (m.gameMode ?: "")
    }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when (m.medalType) {
            "gold" -> Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = color, modifier = Modifier.size(14.dp))
            "streak_7", "streak_30", "streak_100" -> Icon(Icons.Filled.LocalFireDepartment, null, tint = color, modifier = Modifier.size(14.dp))
            "perfect" -> Icon(Icons.Filled.Star, null, tint = color, modifier = Modifier.size(14.dp))
            else -> Icon(Icons.Filled.MilitaryTech, null, tint = color, modifier = Modifier.size(14.dp))
        }
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
        Spacer(Modifier.weight(1f))
        Text(shortMedalDate(m.day), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

private fun shortMedalDate(day: String): String = runCatching {
    val d = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(day)!!
    java.text.SimpleDateFormat("MMM d", java.util.Locale.US).format(d)
}.getOrDefault(day)

@Composable
private fun MedalCard(crown: Boolean, count: Int, label: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.bg).padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (crown) Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = color, modifier = Modifier.size(24.dp))
        else Icon(Icons.Filled.MilitaryTech, null, tint = color, modifier = Modifier.size(24.dp))
        Text("$count", fontSize = 20.sp, fontWeight = FontWeight.Black, color = color)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
}

// ── Dashboard charts ──────────────────────────────────────────────────────────
/** Guess-distribution horizontal bars (1..6), bar width ∝ count. */
@Composable
private fun GuessDistributionCard(buckets: List<com.wordocious.app.data.MatchStatsService.GuessBucket>) {
    val max = (buckets.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("GUESS DISTRIBUTION")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (buckets.none { it.count > 0 }) {
                // Web parity: chart-specific empty copy (guess-distribution.tsx).
                Text(
                    "Win a game to see your guess distribution", fontSize = 12.sp,
                    fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                return@Column
            }
            buckets.forEach { b ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(b.label, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary, modifier = Modifier.width(24.dp))
                    Box(Modifier.weight(1f).height(20.dp), contentAlignment = Alignment.CenterStart) {
                        val frac = (b.count.toFloat() / max).coerceIn(0f, 1f)
                        Box(
                            Modifier.fillMaxWidth(frac.coerceAtLeast(if (b.count > 0) 0.06f else 0f)).height(20.dp)
                                .clip(RoundedCornerShape(4.dp)).background(WTheme.correct),
                            contentAlignment = Alignment.CenterEnd,
                        ) {
                            if (b.count > 0) Text("${b.count}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, modifier = Modifier.padding(end = 6.dp))
                        }
                    }
                }
            }
        }
    }
}

/** Last-7-days activity bars (height ∝ games played; won portion in green). */
@Composable
private fun ActivityCard(activity: List<com.wordocious.app.data.MatchStatsService.DayActivity>) {
    val max = (activity.maxOfOrNull { it.played } ?: 1).coerceAtLeast(1)
    val total = activity.sumOf { it.played }
    val barBrush = Brush.verticalGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED)))
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SectionLabel("LAST 7 DAYS")
            Text("$total ${if (total == 1) "game" else "games"}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom,
        ) {
            activity.forEach { d ->
                // Web: heightPct = count==0 ? 6 : 12 + (count/max)*88, over a 48px area.
                val frac = (if (d.played == 0) 0.06f else 0.12f + (d.played.toFloat() / max) * 0.88f).coerceIn(0.06f, 1f)
                val dow = runCatching {
                    java.time.LocalDate.parse(d.day).dayOfWeek.getDisplayName(java.time.format.TextStyle.NARROW, java.util.Locale.US)
                }.getOrDefault("")
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.BottomCenter) {
                        val barMod = Modifier.fillMaxWidth().fillMaxHeight(frac).clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                        if (d.played == 0) Box(barMod.background(WTheme.border))
                        else Box(barMod.background(barBrush))
                    }
                    Text(dow.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                }
            }
        }
    }
}

/** GitHub-style 90-day activity heatmap — ports web DailyCalendar (10dp cells,
 *  3dp gaps, win-ratio/intensity color ramp, month labels, Less..More legend). */
@Composable
private fun DailyCalendarCard(data: List<com.wordocious.app.data.MatchStatsService.DayActivity>) {
    if (data.isEmpty()) return
    val maxGames = (data.maxOfOrNull { it.played } ?: 1).coerceAtLeast(1)
    val totalDaysPlayed = data.count { it.played > 0 }
    val totalGames = data.sumOf { it.played }

    // Build week-columns: pad leading nulls up to the first day's weekday (Sun=0).
    val firstDow = runCatching { java.time.LocalDate.parse(data.first().day).dayOfWeek.value % 7 }.getOrDefault(0)
    val cells = ArrayList<com.wordocious.app.data.MatchStatsService.DayActivity?>()
    repeat(firstDow) { cells.add(null) }
    cells.addAll(data)
    while (cells.size % 7 != 0) cells.add(null)
    val weeks = cells.chunked(7)

    // Month labels keyed to the week-column where the month first appears.
    val monthLabels = ArrayList<Pair<String, Int>>()
    var lastMonth = ""
    weeks.forEachIndexed { wi, week ->
        val firstDay = week.firstOrNull { it != null } ?: return@forEachIndexed
        val m = runCatching {
            java.time.LocalDate.parse(firstDay.day).month.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US)
        }.getOrDefault("")
        if (m.isNotEmpty() && m != lastMonth) { monthLabels.add(m to wi); lastMonth = m }
    }

    fun cellColor(d: com.wordocious.app.data.MatchStatsService.DayActivity?): Color {
        if (d == null || d.played == 0) return WTheme.surfaceHover
        val intensity = d.played.toFloat() / maxGames
        val winRatio = d.won.toFloat() / d.played
        return if (winRatio >= 0.8f) {
            when { intensity > 0.6f -> Color(0xFF7C3AED); intensity > 0.3f -> Color(0xFFA78BFA); else -> Color(0xFFDDD6FE) }
        } else {
            when { intensity > 0.6f -> Color(0xFF7C3AED); intensity > 0.3f -> Color(0xFFA78BFA); else -> Color(0xFFC4B5FD) }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("ACTIVITY")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        ) {
            if (monthLabels.isNotEmpty()) {
                Box(Modifier.fillMaxWidth().height(14.dp)) {
                    monthLabels.forEach { (label, wi) ->
                        Text(
                            label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                            modifier = Modifier.offset(x = (wi * 13).dp),
                        )
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().horizontalScroll(androidx.compose.foundation.rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                weeks.forEach { week ->
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        week.forEach { d ->
                            Box(Modifier.size(10.dp).clip(RoundedCornerShape(2.dp)).background(cellColor(d)))
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Less", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    listOf(0xFFF3F0FF, 0xFFC4B5FD, 0xFFA78BFA, 0xFF7C3AED, 0xFF6D28D9).forEach { c ->
                        Box(Modifier.size(8.dp).clip(RoundedCornerShape(2.dp)).background(Color(c)))
                    }
                    Text("More", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Text("$totalDaysPlayed days · $totalGames games", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Achievements ──────────────────────────────────────────────────────────────
private val ACH_CATEGORIES = listOf(
    Triple("beginner", "Getting Started", 0xFF7C3AEDL),
    Triple("consistency", "Consistency", 0xFFF97316L),
    Triple("skill", "Skill", 0xFF2563EBL),
    Triple("social", "Social", 0xFF0D9488L),
    Triple("collection", "Collection", 0xFFD97706L),
)

@Composable
private fun AchievementsSection(unlocked: Set<String>, profile: com.wordocious.app.data.Profile?) {
    // Single-sourced via /api/achievements (cached); detection stays per-platform.
    val all by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.AchievementCatalog.cached()
    ) { value = com.wordocious.app.data.AchievementCatalog.load() }
    val medalsTotal = (profile?.goldMedals ?: 0) + (profile?.silverMedals ?: 0) + (profile?.bronzeMedals ?: 0)
    val dailyStreak = profile?.dailyLoginStreak ?: 0
    fun prog(key: String): Pair<Int, Int>? {
        val m = when (key) {
            "streak_7" -> dailyStreak to 7; "streak_30" -> dailyStreak to 30
            "medal_10" -> medalsTotal to 10; "medal_50" -> medalsTotal to 50
            else -> null
        }
        return m?.takeIf { it.first < it.second }
    }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("ACHIEVEMENTS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "${unlocked.size}/${all.size}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xFFF3F0FF)).padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
        ACH_CATEGORIES.forEach { (catKey, catLabel, catColor) ->
            val items = all.filter { it.category == catKey }
            if (items.isNotEmpty()) {
                val n = items.count { unlocked.contains(it.key) }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(catLabel.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(catColor), letterSpacing = 0.4.sp)
                        Text("$n/${items.size}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                    items.chunked(3).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { a ->
                                val on = unlocked.contains(a.key)
                                val p = if (on) null else prog(a.key)
                                Column(
                                    Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                                        .background(if (on) Color(0xFFF3F0FF) else Color(0xFFFAFAFA))
                                        .border(1.5.dp, if (on) Color(0xFFC4B5FD) else WTheme.border, RoundedCornerShape(12.dp))
                                        .padding(10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                                ) {
                                    Text(if (on) "✓" else "?", fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (on) WTheme.primary else WTheme.textMuted)
                                    Text(a.name, fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                                    Text(a.description, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 2, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                                    if (p != null) {
                                        Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
                                            Box(Modifier.fillMaxWidth((p.first.toFloat() / p.second).coerceIn(0f, 1f)).height(4.dp).clip(RoundedCornerShape(50)).background(WTheme.primary))
                                        }
                                        Text("${p.first}/${p.second}", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                    }
                                }
                            }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
    }
}

// ── Solo/VS toggle + VS RECORD (web profile/page.tsx §D) ─────────────────────────
@Composable
private fun SoloVsToggle(active: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("solo" to "Solo", "vs" to "VS", "vs_cpu" to "VS CPU").forEach { (key, label) ->
            val isActive = active == key
            val accent = if (isActive) Color(0xFF7C3AED) else WTheme.textMuted
            Row(
                Modifier.clip(RoundedCornerShape(12.dp))
                    .background(if (isActive) WTheme.surface else WTheme.surfaceHover)
                    .border(1.5.dp, if (isActive) Color(0xFF7C3AED) else WTheme.border, RoundedCornerShape(12.dp))
                    .pressScale { onSelect(key) }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                when (key) {
                    "solo" -> Icon(Icons.Filled.Person, null, tint = accent, modifier = Modifier.size(14.dp))
                    "vs" -> Icon(
                        androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                        tint = accent, modifier = Modifier.size(14.dp),
                    )
                    else -> Text("🤖", fontSize = 12.sp)
                }
                Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = accent)
            }
        }
    }
}

/** VS RECORD summary card — W–L, win rate, total VS games (all modes). */
@Composable
private fun CpuRecordCard(stats: List<ProfileService.UserStat>) {
    val cpuStats = stats.filter { it.playType == "vs_cpu" }
    val wins = cpuStats.sumOf { it.wins }
    val losses = cpuStats.sumOf { it.losses }
    val total = wins + losses
    // Always shown on the VS tab (even at 0–0) so the practice record is
    // discoverable before the first bot match; it fills in once you play one.
    val winRate = if (total > 0) Math.round(wins.toFloat() / total * 100) else 0
    val bestStreak = com.wordocious.app.data.CpuProgressionStore.load().bestStreak
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF64748B).copy(alpha = 0.10f)), Alignment.Center) {
            Text("🤖", fontSize = 18.sp)
        }
        Column(Modifier.weight(1f)) {
            Text("VS CPU", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = Color(0xFF64748B))
            Text("$wins–$losses", fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            if (total == 0) Text("Beat a bot to start your record", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
            else if (bestStreak > 0) Text("🔥 Best streak: $bestStreak", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFF97316))
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(if (total == 0) "—" else "$winRate%", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF64748B))
            Text(if (total == 0) "No games yet" else "Win rate · $total ${if (total == 1) "match" else "matches"}", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun VsRecordCard(stats: List<ProfileService.UserStat>) {
    val vsStats = stats.filter { it.playType == "vs" }
    val wins = vsStats.sumOf { it.wins }
    val losses = vsStats.sumOf { it.losses }
    val total = wins + losses
    val winRate = if (total > 0) Math.round(wins.toFloat() / total * 100) else 0
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFF5F3FF), Color(0xFFFCE7F3))))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(
            Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF7C3AED).copy(alpha = 0.08f)),
            Alignment.Center,
        ) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp),
            )
        }
        Column(Modifier.weight(1f)) {
            Text("VS RECORD", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = Color(0xFF6D28D9))
            Text("$wins–$losses", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF1A1A2E))
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("$winRate%", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED))
            Text(
                "Win rate · $total ${if (total == 1) "match" else "matches"}",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted,
            )
        }
    }
}

// ── Per-mode picker ─────────────────────────────────────────────────────────────
/** Horizontal "All" + per-mode chip row driving the dashboard filter (iOS ProfileModePicker). */
@Composable
private fun ProfileModePicker(selected: String?, gamesPerMode: Map<String, Int>, onSelect: (String?) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ModeChip(label = "All", modeId = null, accent = WTheme.primary, count = 0, active = selected == null) { onSelect(null) }
        DAILY_MODES.forEach { m ->
            val accent = runCatching { modeAccent(GameMode.valueOf(m)) }.getOrDefault(WTheme.primary)
            ModeChip(
                label = shortModeLabel(m), modeId = m,
                accent = accent, count = gamesPerMode[m] ?: 0, active = selected == m,
            ) { onSelect(if (selected == m) null else m) }
        }
    }
}

@Composable
private fun ModeChip(label: String, modeId: String?, accent: Color, count: Int, active: Boolean, onClick: () -> Unit) {
    val iconTint = if (active) accent else WTheme.textMuted
    // Ultra-compact chips matching web density — minimal padding/spacing, smaller icon/text
    Column(
        Modifier.width(56.dp).clip(RoundedCornerShape(12.dp))
            .background(if (active) accent.copy(alpha = 0.08f) else WTheme.surface)
            .border(1.5.dp, if (active) accent else WTheme.border, RoundedCornerShape(12.dp))
            .pressScale { onClick() }.padding(horizontal = 6.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        Box(Modifier.size(24.dp).clip(RoundedCornerShape(6.dp)).background(if (active) accent.copy(alpha = 0.12f) else WTheme.surfaceAlt), Alignment.Center) {
            if (modeId == null) Icon(Icons.Filled.BarChart, null, tint = iconTint, modifier = Modifier.size(12.dp))
            else runCatching { GameMode.valueOf(modeId) }.getOrNull()?.let { ModeGlyph(it, iconTint, glyphSize = 9.sp, iconSize = 12.dp) }
        }
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = if (active) accent else WTheme.textMuted, maxLines = 1)
        // Always reserve the count line (blank when 0) so chips are identical height
        // whether or not a mode has games played — matches web's even row.
        Text(if (count > 0) "$count" else " ", fontSize = 7.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
    }
}

// ── Solve-time line chart ────────────────────────────────────────────────────────
@Composable
private fun SolveTimeCard(points: List<com.wordocious.app.data.MatchStatsService.SolvePoint>) {
    val secs = points.map { it.seconds }
    val avg = if (secs.isEmpty()) 0 else secs.sum() / secs.size
    val maxV = (secs.maxOrNull() ?: 1).coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("SOLVE TIME — LAST ${points.size} WINS")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (points.size < 2) {
                // Web parity: chart-specific empty copy (solve-time-chart.tsx).
                Text(
                    "Win more games to see your solve time trend", fontSize = 12.sp,
                    fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                return@Column
            }
            androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(120.dp)) {
                if (points.size < 2) return@Canvas
                val w = size.width; val h = size.height
                fun x(i: Int) = w * i / (points.size - 1)
                fun y(v: Int) = h - (h * v / maxV)
                // average rule line (dashed)
                val ay = y(avg)
                drawLine(
                    WTheme.textMuted.copy(alpha = 0.5f), androidx.compose.ui.geometry.Offset(0f, ay),
                    androidx.compose.ui.geometry.Offset(w, ay), strokeWidth = 1.5f,
                    pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 6f)),
                )
                // area fill
                val areaPath = androidx.compose.ui.graphics.Path().apply {
                    moveTo(0f, h)
                    points.forEachIndexed { i, p -> lineTo(x(i), y(p.seconds)) }
                    lineTo(w, h); close()
                }
                drawPath(areaPath, brush = Brush.verticalGradient(listOf(WTheme.primary.copy(alpha = 0.25f), Color.Transparent)))
                // line
                val linePath = androidx.compose.ui.graphics.Path().apply {
                    points.forEachIndexed { i, p -> if (i == 0) moveTo(x(i), y(p.seconds)) else lineTo(x(i), y(p.seconds)) }
                }
                drawPath(linePath, WTheme.primary, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
                points.forEachIndexed { i, p -> drawCircle(WTheme.primary, radius = 4f, center = androidx.compose.ui.geometry.Offset(x(i), y(p.seconds))) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TimeStat("Fastest", secs.minOrNull() ?: 0, WTheme.correct)
                TimeStat("Average", avg, WTheme.text)
                TimeStat("Slowest", secs.maxOrNull() ?: 0, Color(0xFFEF4444))
            }
        }
    }
}

@Composable
private fun TimeStat(label: String, seconds: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        Text(fmtTime(seconds), fontSize = 13.sp, fontWeight = FontWeight.Black, color = color)
    }
}

// ── When you play (time-of-day) ──────────────────────────────────────────────────
@Composable
private fun WhenYouPlayCard(hours: List<com.wordocious.app.data.MatchStatsService.HourBucket>) {
    val maxPlayed = (hours.maxOfOrNull { it.played } ?: 1).coerceAtLeast(1)
    val peak = hours.maxByOrNull { it.played }?.takeIf { it.played > 0 }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("WHEN YOU PLAY")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(Modifier.fillMaxWidth().height(40.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
                hours.forEach { h ->
                    val alpha = if (h.played == 0) 0.08f else 0.2f + (h.played.toFloat() / maxPlayed) * 0.8f
                    Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(2.dp)).background(WTheme.primary.copy(alpha = alpha)))
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf("12a", "6a", "12p", "6p", "12a").forEach {
                    Text(it, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
            if (peak != null) {
                Text("Peak: ${hourLabelLower(peak.hour)} · ${peak.played} games", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Top words ────────────────────────────────────────────────────────────────────
@Composable
private fun TopWordsCard(words: List<com.wordocious.app.data.MatchStatsService.TopWord>) {
    val maxCount = (words.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("TOP WORDS")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            words.forEachIndexed { i, w ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${i + 1}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.width(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        w.word.take(7).forEach { ch ->
                            Box(Modifier.size(18.dp).clip(RoundedCornerShape(3.dp)).background(WTheme.surfaceAlt), Alignment.Center) {
                                Text(ch.toString(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                            }
                        }
                    }
                    Box(Modifier.weight(1f).height(6.dp), contentAlignment = Alignment.CenterStart) {
                        Box(Modifier.fillMaxWidth((w.count.toFloat() / maxCount).coerceIn(0.04f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(WTheme.primary.copy(alpha = 0.25f)))
                    }
                    Text("${w.count}x", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                    Text("${if (w.count > 0) w.wins * 100 / w.count else 0}%", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.width(34.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                }
            }
        }
    }
}

// ── Pro Insights (per-mode, Pro-gated) ─────────────────────────────────────────────
@Composable
private fun ProInsightsCard(s: com.wordocious.app.data.MatchStatsService.ProInsights, isPro: Boolean, onGoPro: () -> Unit) {
    val gold = Color(0xFFD97706)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("PRO INSIGHTS")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (!isPro) {
                ProLockedTeaser("Deep Insights", onGoPro)
            } else if (!s.hasData) {
                Text("No games yet — play to build your stats.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(vertical = 24.dp))
            } else {
                val cells = buildList {
                    s.fastestTime?.let { add(Triple("Fastest Win", fmtTime(it), Icons.Filled.Bolt)) }
                    s.fewestGuesses?.let { add(Triple("Fewest Guesses", "$it", Icons.Filled.TrackChanges)) }
                    add(Triple("Perfect Games", "${s.perfectGames}", Icons.Filled.Star))
                    if (s.consistencySample >= 3) add(Triple("Consistency", "${s.consistency}", Icons.Filled.TrackChanges))
                    if (s.currentStreak > 0) add(Triple("Win Streak", "${s.currentStreak}", Icons.Filled.LocalFireDepartment))
                    if (s.avgGuesses > 0) add(Triple("Avg Guesses", fmtG(s.avgGuesses), Icons.Filled.TrackChanges))
                    if (s.firstTryRate > 0) add(Triple("First Try Rate", "${s.firstTryRate}%", Icons.Filled.Star))
                    s.peakHour?.let { add(Triple("Peak Hour", hourLabelUpper(it), Icons.Filled.Bolt)) }
                    s.luckyWord?.let { add(Triple("Lucky Word", it, Icons.Filled.Star)) }
                }
                cells.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (label, value, icon) -> ProStatCell(label, value, icon, gold, Modifier.weight(1f)) }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
                if (s.nemesisWord != null && s.nemesisLosses >= 2) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_skull), null, tint = gold, modifier = Modifier.size(15.dp))
                        Text("Nemesis: ", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                        Text(s.nemesisWord, fontSize = 12.sp, fontWeight = FontWeight.Black, color = gold)
                        Spacer(Modifier.weight(1f))
                        Text("Lost ${s.nemesisLosses}×", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
                if (s.vsTotal > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Filled.EmojiEvents, null, tint = gold, modifier = Modifier.size(15.dp))
                        Text("VS Record", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                        Spacer(Modifier.weight(1f))
                        Text("${s.vsWins}W · ${s.vsLosses}L · ${s.vsWinRate}%", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    }
                }
                if (s.recentAvg > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(if (s.improving) "↓" else "↑", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (s.improving) WTheme.correct else Color(0xFFEF4444))
                        Text(if (s.improving) "Trending faster" else "Trending slower", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                        Spacer(Modifier.weight(1f))
                        Text("${kotlin.math.abs(s.percentChange)}% · last 10 avg ${fmtTime(s.recentAvg)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProStatCell(label: String, value: String, icon: ImageVector, color: Color, modifier: Modifier = Modifier) {
    Row(
        modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.bg).border(1.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(16.dp))
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
            Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
    }
}

// ── Pro Stats (global "All" view, Pro-gated) ───────────────────────────────────────
@Composable
private fun ProStatsCard(stats: List<ProfileService.UserStat>, isPro: Boolean, onGoPro: () -> Unit) {
    data class Bar(val label: String, val winRate: Int, val avgTime: Int)
    val order = listOf("DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "DUEL_6", "DUEL_7", "GAUNTLET", "PROPERNOUNDLE")
    val shortLabel = mapOf("DUEL" to "Classic", "QUORDLE" to "Quad", "OCTORDLE" to "Octo", "SEQUENCE" to "Succ",
        "RESCUE" to "Deliv", "DUEL_6" to "Six", "DUEL_7" to "Seven", "GAUNTLET" to "Gaunt", "PROPERNOUNDLE" to "Proper")
    val bars = order.mapNotNull { m ->
        val rows = stats.filter { it.gameMode == m }
        val games = rows.sumOf { it.totalGames }
        if (games == 0) return@mapNotNull null
        val wins = rows.sumOf { it.wins }
        val weighted = rows.sumOf { it.averageTime * it.totalGames }
        Bar(shortLabel[m] ?: m, wins * 100 / games, weighted / games)
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("PRO STATS")
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (!isPro) {
                ProLockedTeaser("Pro Feature", onGoPro)
            } else if (bars.isEmpty()) {
                Text("No games yet — play to build your stats.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(vertical = 24.dp))
            } else {
                Text("Win Rate by Mode", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                bars.forEach { b -> ProBarRow(b.label, "${b.winRate}%", b.winRate.toFloat() / 100f, Color(0xFFFACC15)) }
                Text("Avg Solve Time by Mode", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                val maxT = (bars.maxOfOrNull { it.avgTime } ?: 1).coerceAtLeast(1)
                bars.forEach { b -> ProBarRow(b.label, fmtTime(b.avgTime), b.avgTime.toFloat() / maxT, Color(0xFFA78BFA)) }
            }
        }
    }
}

@Composable
private fun ProBarRow(label: String, value: String, frac: Float, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary, modifier = Modifier.width(54.dp))
        Box(Modifier.weight(1f).height(16.dp), contentAlignment = Alignment.CenterStart) {
            Box(Modifier.fillMaxWidth(frac.coerceIn(0.02f, 1f)).height(16.dp).clip(RoundedCornerShape(3.dp)).background(color))
        }
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.width(48.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
    }
}

/** Frosted locked teaser — lock glyph + label + Upgrade-to-Pro button (iOS locked overlay). */
@Composable
private fun ProLockedTeaser(label: String, onGoPro: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("🔒", fontSize = 26.sp)
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        Row(
            Modifier.clip(RoundedCornerShape(10.dp))
                .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                .clickableNoRipple(onGoPro).padding(horizontal = 16.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = Color.White, modifier = Modifier.size(13.dp))
            Text("Upgrade to Pro", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
    }
}

/** "1m 23s" / "45s" — matches iOS fmt(seconds). */
private fun fmtTime(s: Int): String = if (s < 60) "${s}s" else "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
private fun fmtG(v: Double): String = if (v == v.toInt().toDouble()) "${v.toInt()}" else "$v"
/** "1am" / "12pm" lower (WhenYouPlay peak). */
private fun hourLabelLower(h: Int): String { val am = h < 12; val t = if (h % 12 == 0) 12 else h % 12; return "$t${if (am) "am" else "pm"}" }
/** "1 PM" / "12 AM" upper (Pro Insights peak hour). */
private fun hourLabelUpper(h: Int): String { val ampm = if (h >= 12) "PM" else "AM"; val h12 = if (h == 0) 12 else if (h > 12) h - 12 else h; return "$h12 $ampm" }

private fun modeLabel(mode: String) = when (mode) {
    "DUEL" -> "Classic"; "QUORDLE" -> "QuadWord"; "OCTORDLE" -> "OctoWord"
    "SEQUENCE" -> "Succession"; "RESCUE" -> "Deliverance"
    "DUEL_6" -> "Six"; "DUEL_7" -> "Seven"
    "GAUNTLET" -> "Gauntlet"; "PROPERNOUNDLE" -> "ProperNoundle"
    else -> mode
}

/** Short titles for the mode-picker chips — matches web PROFILE_MODES.shortTitle. */
private fun shortModeLabel(mode: String) = when (mode) {
    "DUEL" -> "Classic"; "QUORDLE" -> "Quad"; "OCTORDLE" -> "Octo"
    "SEQUENCE" -> "Succ."; "RESCUE" -> "Deliv."
    "DUEL_6" -> "Six"; "DUEL_7" -> "Seven"
    "GAUNTLET" -> "Gauntlet"; "PROPERNOUNDLE" -> "Proper"
    else -> mode
}
