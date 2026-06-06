package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.ProfileService
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
fun ProfileScreen(onGoPro: () -> Unit = {}, onEditProfile: () -> Unit = {}) {
    val profile by AuthService.profile.collectAsState()
    val scope = rememberCoroutineScope()
    var stats by remember { mutableStateOf<List<ProfileService.UserStat>>(emptyList()) }
    var recentMatches by remember { mutableStateOf<List<ProfileService.RecentMatch>>(emptyList()) }
    var medals by remember { mutableStateOf<List<ProfileService.UserMedal>>(emptyList()) }
    var todayDailies by remember { mutableStateOf<Map<String, DailyCompletionsService.Completion>>(emptyMap()) }
    var unlockedAchievements by remember { mutableStateOf<Set<String>>(emptySet()) }
    var guessDist by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.GuessBucket>>(emptyList()) }
    var activity7 by remember { mutableStateOf<List<com.wordocious.app.data.MatchStatsService.DayActivity>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    val userId = profile?.id
    LaunchedEffect(userId) {
        if (userId != null) {
            stats = ProfileService.fetchUserStats(userId)
            recentMatches = ProfileService.fetchRecentMatches(userId)
            medals = ProfileService.fetchUserMedals(userId, limit = 100)
            todayDailies = DailyCompletionsService.fetchTodayCompletions()
            unlockedAchievements = com.wordocious.app.data.AchievementService.fetchUnlocked(userId)
            guessDist = com.wordocious.app.data.MatchStatsService.guessDistribution(userId)
            activity7 = com.wordocious.app.data.MatchStatsService.activity(userId, days = 7)
        }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(WTheme.bg).padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(Modifier.height(8.dp)) }

        // ── A. Header ─────────────────────────────────────────────
        item { ProfileHeader(profile, onGoPro, onEditProfile) }

        // ── B. Today's Dailies ────────────────────────────────────
        item { TodaysDailies(todayDailies) }

        // ── C. Global Summary ─────────────────────────────────────
        item {
            GlobalSummaryRow(
                totalWins = profile?.totalWins ?: 0,
                totalLosses = profile?.totalLosses ?: 0,
                currentStreak = profile?.currentStreak ?: 0,
                bestStreak = profile?.bestStreak ?: 0,
                dailyStreak = profile?.dailyLoginStreak ?: 0,
                bestDailyStreak = profile?.bestDailyLoginStreak ?: 0,
            )
        }

        // ── Dashboard: Guess Distribution + Last 7 Days ───────────
        if (guessDist.any { it.count > 0 }) {
            item { GuessDistributionCard(guessDist) }
        }
        if (activity7.isNotEmpty()) {
            item { ActivityCard(activity7) }
        }

        // ── D. Daily Medals ───────────────────────────────────────
        item { DailyMedals(profile, medals) }

        // ── Achievements (collapsible 72-item grid) ───────────────
        item { AchievementsSection(unlockedAchievements) }

        // ── E. Stats by mode ──────────────────────────────────────
        if (loading) {
            item { Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) { CircularProgressIndicator(color = WTheme.primary) } }
        } else if (stats.isNotEmpty()) {
            item { SectionLabel("STATS BY MODE") }
            items(stats) { s ->
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                        .background(WTheme.surface).border(1.dp, WTheme.border, RoundedCornerShape(10.dp)).padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(modeLabel(s.gameMode), fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("${s.wins}W ${s.losses}L", fontSize = 12.sp, color = WTheme.textSecondary, fontWeight = FontWeight.Bold)
                        if (s.bestScore != null) Text("Best: ${s.bestScore.toInt()}", fontSize = 11.sp, color = WTheme.primary, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
        }

        // ── Recent matches ────────────────────────────────────────
        if (recentMatches.isNotEmpty()) {
            item { SectionLabel("RECENT MATCHES") }
            items(recentMatches) { m ->
                val won = m.winnerId == userId
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                        .background(WTheme.surface).border(1.dp, WTheme.border, RoundedCornerShape(10.dp)).padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(modeLabel(m.gameMode), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(m.createdAt.take(10), fontSize = 10.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold)
                    }
                    Box(
                        Modifier.size(24.dp, 20.dp).clip(RoundedCornerShape(4.dp)).background(if (won) WTheme.winText else WTheme.lossText),
                        contentAlignment = Alignment.Center,
                    ) { Text(if (won) "W" else "L", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White) }
                }
                Spacer(Modifier.height(4.dp))
            }
        }

        // ── F. Sign out ───────────────────────────────────────────
        item {
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { scope.launch { AuthService.signOut() } },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                colors = ButtonDefaults.buttonColors(containerColor = WTheme.surfaceAlt),
            ) { Text("Sign Out", color = WTheme.textSecondary, fontWeight = FontWeight.Black) }
            Spacer(Modifier.height(24.dp))
        }
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
private fun ProfileHeader(profile: com.wordocious.app.data.Profile?, onGoPro: () -> Unit = {}, onEditProfile: () -> Unit = {}) {
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
                .background(Brush.linearGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd))),
            contentAlignment = Alignment.Center,
        ) {
            if (avatarUrl != null) {
                coil.compose.AsyncImage(
                    model = avatarUrl, contentDescription = "Avatar",
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                )
            } else {
                Text(initial, fontSize = 40.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(profile?.username ?: "Player", fontSize = 28.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            if (profile?.isPro == true) {
                Text(
                    "PRO", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp))
                        .background(Brush.linearGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd)))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }

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

        // Edit Profile
        Text(
            "Edit Profile", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
            modifier = Modifier.clip(RoundedCornerShape(8.dp)).border(1.5.dp, WTheme.border, RoundedCornerShape(8.dp))
                .clickableNoRipple(onEditProfile).padding(horizontal = 14.dp, vertical = 6.dp),
        )

        // Go Pro (only for non-Pro)
        if (profile?.isPro != true) {
            Box(
                Modifier.clip(RoundedCornerShape(8.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                    .clickableNoRipple(onGoPro)
                    .padding(horizontal = 16.dp, vertical = 6.dp),
            ) { Text("Go Pro", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color.White) }
        }
    }
}

// ── B. Today's Dailies ────────────────────────────────────────────────────────
private val MODE_GLYPH = mapOf("QUORDLE" to "IV", "OCTORDLE" to "VIII", "DUEL_6" to "6", "DUEL_7" to "7")

@Composable
private fun TodaysDailies(today: Map<String, DailyCompletionsService.Completion>) {
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
                rowModes.forEach { id -> DailyBadge(id, today[id]) }
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
private fun DailyBadge(modeId: String, completion: DailyCompletionsService.Completion?) {
    val played = completion != null
    val won = completion?.completed == true
    val accent = runCatching { modeAccent(GameMode.valueOf(modeId)) }.getOrDefault(WTheme.primary)
    val tileBg = if (!played) WTheme.bg else if (won) Color(0xFF16A34A) else Color(0xFFDC2626)
    val tileBorder = if (!played) WTheme.border else tileBg

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(44.dp)) {
        Box(
            Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(tileBg).border(1.5.dp, tileBorder, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (played) Text(if (won) "W" else "L", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
            else Text(MODE_GLYPH[modeId] ?: modeLabel(modeId).take(1), fontSize = 11.sp, fontWeight = FontWeight.Black, color = accent)
        }
        Text(modeLabel(modeId), fontSize = 8.sp, fontWeight = FontWeight.Bold, color = if (played) WTheme.text else WTheme.textMuted, maxLines = 1)
    }
}

// ── C. Global Summary ─────────────────────────────────────────────────────────
@Composable
private fun GlobalSummaryRow(totalWins: Int, totalLosses: Int, currentStreak: Int, bestStreak: Int, dailyStreak: Int, bestDailyStreak: Int) {
    val totalGames = totalWins + totalLosses
    val winRate = if (totalGames > 0) Math.round(totalWins.toFloat() / totalGames * 100) else 0
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SummaryCard(Icons.Filled.EmojiEvents, "WINS", "$totalWins", null, Color(0xFF16A34A), Modifier.weight(1f))
        SummaryCard(Icons.Filled.TrackChanges, "WIN RATE", "$winRate%", null, Color(0xFF2563EB), Modifier.weight(1f))
        SummaryCard(Icons.Filled.Bolt, "STREAK", "$currentStreak", "Best: $bestStreak", Color(0xFF7C3AED), Modifier.weight(1f))
        SummaryCard(Icons.Filled.LocalFireDepartment, "DAILY", "$dailyStreak", "Best: $bestDailyStreak", Color(0xFFF97316), Modifier.weight(1f))
    }
}

@Composable
private fun SummaryCard(icon: ImageVector, label: String, value: String, sub: String?, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.surface).border(1.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(16.dp))
        Text(value, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text, lineHeight = 18.sp)
        Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.5.sp)
        if (sub != null) Text(sub, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
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

    SectionLabel("DAILY MEDALS")
    Spacer(Modifier.height(8.dp))
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MedalCard(crown = true, count = gold, label = "Gold", color = Color(0xFFD97706), modifier = Modifier.weight(1f))
            MedalCard(crown = false, count = silver, label = "Silver", color = WTheme.textMuted, modifier = Modifier.weight(1f))
            MedalCard(crown = false, count = bronze, label = "Bronze", color = Color(0xFFB45309), modifier = Modifier.weight(1f))
        }
    }
}

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
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            buckets.forEach { b ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${b.guesses}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary, modifier = Modifier.width(12.dp))
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
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SectionLabel("LAST 7 DAYS")
            Text("$total ${if (total == 1) "game" else "games"}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp).height(80.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom,
        ) {
            activity.forEach { d ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                    val frac = (d.played.toFloat() / max).coerceIn(0.04f, 1f)
                    Box(
                        Modifier.fillMaxWidth(0.7f).fillMaxHeight(frac).clip(RoundedCornerShape(3.dp))
                            .background(if (d.won > 0) WTheme.correct else WTheme.absent.copy(alpha = 0.4f)),
                    )
                    Text(d.day.takeLast(2), fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

// ── Achievements ──────────────────────────────────────────────────────────────
@Composable
private fun AchievementsSection(unlocked: Set<String>) {
    val all = com.wordocious.app.data.AchievementService.all
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { open = !open }.padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("ACHIEVEMENTS", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
            Text(
                "${unlocked.size}/${all.size}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceAlt).padding(horizontal = 6.dp, vertical = 2.dp),
            )
            Spacer(Modifier.weight(1f))
            Icon(
                if (open) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp),
            )
        }
        if (open) {
            Spacer(Modifier.height(8.dp))
            all.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { a ->
                        val on = unlocked.contains(a.key)
                        Column(
                            Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                                .background(if (on) Color(0xFFF3F0FF) else Color(0xFFFAFAFA))
                                .border(1.5.dp, if (on) Color(0xFFC4B5FD) else WTheme.border, RoundedCornerShape(12.dp))
                                .padding(10.dp),
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(if (on) "✓" else "?", fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (on) WTheme.primary else WTheme.textMuted)
                            Text(a.name, fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            Text(a.description, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 3, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        }
                    }
                    // pad incomplete final row so cells keep equal width
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

private fun modeLabel(mode: String) = when (mode) {
    "DUEL" -> "Classic"; "QUORDLE" -> "QuadWord"; "OCTORDLE" -> "OctoWord"
    "SEQUENCE" -> "Succession"; "RESCUE" -> "Deliverance"
    "DUEL_6" -> "Six"; "DUEL_7" -> "Seven"
    "GAUNTLET" -> "Gauntlet"; "PROPERNOUNDLE" -> "ProperNoundle"
    else -> mode
}
