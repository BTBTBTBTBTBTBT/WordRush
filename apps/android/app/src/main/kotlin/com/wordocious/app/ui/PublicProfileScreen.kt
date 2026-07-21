package com.wordocious.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.ModerationService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Public profile — audit-then-match of web /profile/[id]/page.tsx (and the
 * verified iOS PublicProfileView): header (avatar, gradient username, level
 * badge, XP-to-next bar, socials), 4 overall stat cards, Solo/VS + mode-picker
 * per-mode stats, top words, and the 10 most recent matches.
 */
@Serializable
data class PublicProfile(
    val id: String,
    val username: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    val level: Int = 1,
    val xp: Int = 0,
    @SerialName("total_wins") val totalWins: Int = 0,
    @SerialName("total_losses") val totalLosses: Int = 0,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("daily_login_streak") val dailyLoginStreak: Int = 0,
    @SerialName("best_daily_login_streak") val bestDailyLoginStreak: Int = 0,
    @SerialName("social_links") val socialLinks: Map<String, String>? = null,
    val bio: String? = null,
    @SerialName("featured_achievement") val featuredAchievement: String? = null,
    @SerialName("accent_color") val accentColor: String? = null,
    @SerialName("favorite_mode") val favoriteMode: String? = null,
    @SerialName("avatar_emoji") val avatarEmoji: String? = null,
)

private suspend fun fetchPublicProfile(id: String): PublicProfile? = runCatching {
    SupabaseConfig.client.postgrest["profiles"]
        .select { filter { eq("id", id) }; limit(1) }
        .decodeSingleOrNull<PublicProfile>()
}.getOrNull()

// Web social-links.tsx PLATFORMS — label, brand color, URL builder.
private data class SocialPlatform(val key: String, val label: String, val color: Color, val url: (String) -> String)
private val SOCIAL_PLATFORMS = listOf(
    SocialPlatform("twitter", "Twitter / X", Color(0xFF000000)) { "https://twitter.com/$it" },
    SocialPlatform("instagram", "Instagram", Color(0xFFE1306C)) { "https://instagram.com/$it" },
    SocialPlatform("tiktok", "TikTok", Color(0xFF000000)) { "https://tiktok.com/@$it" },
    SocialPlatform("threads", "Threads", Color(0xFF000000)) { "https://threads.net/@$it" },
    SocialPlatform("discord", "Discord", Color(0xFF5865F2)) { "https://discord.com/users/$it" },
    SocialPlatform("website", "Website", Color(0xFF2563EB)) { it },
)

@Composable
fun PublicProfileScreen(userId: String, onClose: () -> Unit) {
    val profile by produceState<PublicProfile?>(initialValue = null, userId) {
        value = fetchPublicProfile(userId)
    }
    val stats by produceState(initialValue = emptyList<ProfileService.UserStat>(), userId) {
        value = ProfileService.fetchUserStats(userId)
    }
    val matches by produceState(initialValue = emptyList<ProfileService.RecentMatch>(), userId) {
        value = ProfileService.fetchRecentMatches(userId, limit = 10)
    }
    var playType by remember { mutableStateOf("solo") }
    var selectedMode by remember { mutableStateOf(GameMode.DUEL) }
    val topWords by produceState(
        initialValue = emptyList<com.wordocious.app.data.MatchStatsService.TopWord>(),
        userId, selectedMode,
    ) {
        value = com.wordocious.app.data.MatchStatsService.topWords(userId, selectedMode.name, 5)
    }

    // Moderation (App Review 1.2): report + block from a stranger's profile —
    // ports the iOS PublicProfileView ellipsis menu. Own profile shows no menu.
    val isOwnProfile = userId == AuthService.userId
    var menuOpen by remember { mutableStateOf(false) }
    var showReportDialog by remember { mutableStateOf(false) }
    var showBlockConfirm by remember { mutableStateOf(false) }
    var moderationToast by remember { mutableStateOf<String?>(null) }
    var blocked by remember { mutableStateOf(ModerationService.isBlocked(userId)) }
    val moderationScope = rememberCoroutineScope()
    LaunchedEffect(userId) {
        ModerationService.loadBlockedIds()   // no-op after the launch warm-up
        blocked = ModerationService.isBlocked(userId)
    }
    LaunchedEffect(moderationToast) {
        if (moderationToast != null) { delay(2_500); moderationToast = null }
    }

    Column(
        Modifier.fillMaxSize().background(WTheme.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        // Back + moderation overflow (iOS PublicProfileView header parity)
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                Modifier.clickableNoRipple(onClose).padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color(0xFF7C3AED), modifier = Modifier.size(18.dp))
                Text("Back", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED))
            }
            // App Review 1.2: users must be able to report/block each other
            // wherever strangers' content (usernames/bios/avatars) renders.
            if (!isOwnProfile) {
                Box {
                    Icon(
                        Icons.Filled.MoreVert, "More options", tint = WTheme.textMuted,
                        modifier = Modifier.clickableNoRipple { menuOpen = true }.padding(4.dp).size(20.dp),
                    )
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Report user", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) },
                            onClick = { menuOpen = false; showReportDialog = true },
                        )
                        if (blocked) {
                            DropdownMenuItem(
                                text = { Text("Unblock user", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.text) },
                                onClick = {
                                    menuOpen = false
                                    moderationScope.launch {
                                        ModerationService.unblock(userId)
                                        blocked = false
                                        moderationToast = "User unblocked"
                                    }
                                },
                            )
                        } else {
                            DropdownMenuItem(
                                text = { Text("Block user", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) },
                                onClick = { menuOpen = false; showBlockConfirm = true },
                            )
                        }
                    }
                }
            }
        }
        // Brief moderation confirmation (iOS toast parity; auto-clears in 2.5s).
        moderationToast?.let { t ->
            Text(
                t, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .clip(RoundedCornerShape(50))
                    .background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            )
        }

        val p = profile
        if (p == null) {
            // Loading skeletons (web animate-pulse parity).
            SkeletonBlock(height = 96.dp)
            SkeletonBlock(height = 200.dp)
            return@Column
        }

        // ── Header: avatar / gradient username / level badge / XP bar / socials ──
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val avatarUrl = p.avatarUrl?.takeIf { it.isNotBlank() }
            val customAccent = ProfileAccent.isCustom(p.accentColor)
            Box(
                Modifier.size(96.dp).clip(CircleShape).background(if (customAccent) ProfileAccent.avatarBrush(p.accentColor) else Brush.linearGradient(listOf(WTheme.surfaceAlt, WTheme.surfaceAlt))),
                contentAlignment = Alignment.Center,
            ) {
                if (avatarUrl != null) {
                    coil.compose.AsyncImage(
                        model = avatarUrl, contentDescription = "Avatar",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    )
                } else {
                    Text(
                        p.avatarEmoji?.takeIf { it.isNotBlank() } ?: (p.username?.take(2) ?: "P").uppercase(),
                        fontSize = 30.sp, fontWeight = FontWeight.Black, color = if (customAccent) Color.White else WTheme.textMuted,
                    )
                }
            }
            if (customAccent) {
                Text(p.username ?: "Player", fontSize = 34.sp, fontWeight = FontWeight.Black, color = ProfileAccent.color(p.accentColor))
            } else {
                Text(
                    p.username ?: "Player",
                    fontSize = 34.sp, fontWeight = FontWeight.Black,
                    style = TextStyle(
                        brush = Brush.horizontalGradient(
                            listOf(Color(0xFFFBBF24), Color(0xFFEC4899), Color(0xFFA78BFA)),
                        ),
                    ),
                )
            }
            ProfilePersonalizationRow(p.accentColor, p.bio, p.featuredAchievement, p.favoriteMode)
            // Level badge (web: star + "Level N", gold bg/border)
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(WTheme.highlightGold)
                    .border(1.5.dp, WTheme.goldBorder, RoundedCornerShape(50))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(Icons.Filled.Star, null, tint = Color(0xFFD97706), modifier = Modifier.size(12.dp))
                Text("Level ${p.level}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            }
            // XP bar to next level
            val intoLevel = p.xp % 1000
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(Modifier.width(160.dp).height(6.dp).clip(RoundedCornerShape(50)).background(WTheme.surfaceAlt)) {
                    Box(
                        Modifier.fillMaxSize().fillMaxWidth(intoLevel / 1000f)
                            .background(Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFF97316)))),
                    )
                }
                Text("${1000 - intoLevel} XP to next level", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
            // Socials (web SocialLinksDisplay: brand-colored pills opening the link)
            val links = p.socialLinks ?: emptyMap()
            val present = SOCIAL_PLATFORMS.filter { !links[it.key].isNullOrBlank() }
            if (present.isNotEmpty()) {
                val ctx = LocalContext.current
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    present.forEach { pf ->
                        Text(
                            pf.label,
                            fontSize = 10.sp, fontWeight = FontWeight.Black, color = pf.color,
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(WTheme.surface)
                                .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                                .clickableNoRipple {
                                    runCatching {
                                        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(pf.url(links[pf.key]!!))))
                                    }
                                }
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                        )
                    }
                }
            }
        }

        // ── Overall stat cards (web 4-card row; 2×2 on phone) ───────────────────
        val games = p.totalWins + p.totalLosses
        val winRate = if (games > 0) "%.1f".format(p.totalWins * 100.0 / games) else "0.0"
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OverallCard(Icons.Filled.EmojiEvents, Color(0xFF7C3AED), "${p.totalWins}", "Total Wins", "$winRate% win rate", Modifier.weight(1f))
            OverallCard(Icons.Filled.LocalFireDepartment, Color(0xFFEA580C), "${p.currentStreak}", "Win Streak", "Best: ${p.bestStreak}", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OverallCard(Icons.Filled.Bolt, Color(0xFF7C3AED), "${p.dailyLoginStreak}", "Daily Streak", "Best: ${p.bestDailyLoginStreak}", Modifier.weight(1f))
            OverallCard(Icons.Filled.TrackChanges, Color(0xFF2563EB), "$games", "Total Games", "${p.totalLosses} losses", Modifier.weight(1f))
        }

        // ── Game mode statistics ────────────────────────────────────────────────
        Text("GAME MODE STATISTICS", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("solo" to "Solo", "vs" to "VS").forEach { (key, label) ->
                val active = playType == key
                Text(
                    label,
                    fontSize = 12.sp, fontWeight = FontWeight.Black,
                    color = if (active) Color(0xFF7C3AED) else WTheme.textMuted,
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (active) Color(0xFF7C3AED).copy(alpha = 0.08f) else WTheme.surface)
                        .border(1.5.dp, if (active) Color(0xFF7C3AED) else WTheme.border, RoundedCornerShape(10.dp))
                        .clickableNoRipple { playType = key }
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                )
            }
        }
        // Mode picker chips
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            MODE_CARDS.mapNotNull { it.engineMode }.forEach { m ->
                val active = m == selectedMode
                val accent = modeAccent(m)
                Text(
                    modeTitle(m),
                    fontSize = 10.sp, fontWeight = FontWeight.Black,
                    color = if (active) Color.White else WTheme.textSecondary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (active) accent else WTheme.surface)
                        .border(1.5.dp, if (active) accent else WTheme.border, RoundedCornerShape(50))
                        .clickableNoRipple { selectedMode = m }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
        }
        // Per-mode stats card (web: accent top bar + Wins/Losses/Best/Fastest)
        run {
            // user_stats has one row per (mode, play_type); ProfileService.fetchUserStats
            // returns all — filter for the selected mode is best-effort by mode name.
            val stat = stats.firstOrNull { it.gameMode == selectedMode.name && it.playType == playType }
            val accent = modeAccent(selectedMode)
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
            ) {
                Box(Modifier.fillMaxWidth().height(3.dp).background(accent))
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(modeTitle(selectedMode).take(1), fontSize = 13.sp, fontWeight = FontWeight.Black, color = accent)
                        }
                        Text(modeTitle(selectedMode), fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    }
                    Row(Modifier.fillMaxWidth()) {
                        ModeStat("Wins", "${stat?.wins ?: 0}", Color(0xFF7C3AED), Modifier.weight(1f))
                        ModeStat("Losses", "${stat?.losses ?: 0}", Color(0xFFDC2626), Modifier.weight(1f))
                        ModeStat("Best", stat?.bestScore?.let { if (it > 0) "${it.toInt()}" else "—" } ?: "—", Color(0xFFD97706), Modifier.weight(1f))
                        ModeStat(
                            "Fastest",
                            stat?.fastestTime?.takeIf { it > 0 }?.let { fmtDuration(it) } ?: "—",
                            Color(0xFF2563EB), Modifier.weight(1f),
                        )
                    }
                }
            }
        }
        // Top words (web TopWordsCard, shown when non-empty)
        if (topWords.isNotEmpty()) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("TOP WORDS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                topWords.forEach { w ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(w.word.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text("×${w.count}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
        }

        // ── Recent matches (10) ──────────────────────────────────────────────────
        Text("RECENT MATCHES", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
        if (matches.isEmpty()) {
            Text("No matches played yet.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        } else {
            matches.forEach { m -> PublicMatchRow(m, userId) }
        }
        Spacer(Modifier.height(20.dp))
    }

    // Report reason picker (iOS confirmationDialog parity, context "public_profile").
    if (showReportDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showReportDialog = false },
            title = { Text("Report this user?", fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Reports are reviewed by the Wordocious team.", fontSize = 12.sp, color = WTheme.textMuted)
                    Spacer(Modifier.height(6.dp))
                    listOf(
                        "Inappropriate username",
                        "Inappropriate profile content",
                        "Cheating / fake scores",
                        "Other",
                    ).forEach { reason ->
                        Text(
                            reason,
                            fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickableNoRipple {
                                    showReportDialog = false
                                    moderationScope.launch {
                                        val ok = ModerationService.report(userId, reason, "public_profile")
                                        moderationToast = if (ok) "Report submitted — thank you" else "Could not submit report"
                                    }
                                }
                                .padding(vertical = 8.dp),
                        )
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showReportDialog = false }) { Text("Cancel") }
            },
        )
    }
    // Block confirmation (iOS confirmationDialog parity).
    if (showBlockConfirm) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showBlockConfirm = false },
            title = { Text("Block this user?", fontWeight = FontWeight.Black) },
            text = { Text("You won't see this player on leaderboards or records.") },
            confirmButton = {
                androidx.compose.material3.TextButton(
                    onClick = {
                        showBlockConfirm = false
                        moderationScope.launch {
                            ModerationService.block(userId)
                            blocked = true
                            moderationToast = "User blocked"
                        }
                    },
                ) { Text("Block", color = Color(0xFFDC2626), fontWeight = FontWeight.Black) }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showBlockConfirm = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun OverallCard(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, value: String, label: String, sub: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(18.dp))
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        Text(sub, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

@Composable
private fun ModeStat(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Black, color = color)
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

private fun fmtDuration(secs: Int): String {
    val m = secs / 60; val s = secs % 60
    return if (m > 0) (if (s > 0) "${m}m ${s}s" else "${m}m") else "${s}s"
}

@Composable
private fun PublicMatchRow(m: ProfileService.RecentMatch, userId: String) {
    val isVs = m.player2Id != null
    val won = m.winnerId == userId
    val isP1 = m.player1Id == userId
    val guesses = (if (isP1) m.player1Score else m.player2Score)?.toInt() ?: 0
    val time = (if (isP1) m.player1Time else m.player2Time)?.toInt() ?: 0
    val mode = runCatching { GameMode.valueOf(m.gameMode) }.getOrNull()
    val dateTime = runCatching {
        val inst = java.time.Instant.parse(if (m.createdAt.endsWith("Z") || m.createdAt.contains('+')) m.createdAt else m.createdAt + "Z")
        val zdt = inst.atZone(java.time.ZoneId.systemDefault())
        zdt.format(java.time.format.DateTimeFormatter.ofPattern("M/d/yy, h:mm a"))
    }.getOrDefault("")

    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            if (won) Icons.Filled.CheckCircle else Icons.Filled.Cancel, null,
            tint = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626),
            modifier = Modifier.size(20.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(mode?.let { modeTitle(it) } ?: m.gameMode, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(if (isVs) "VS" else "Solo", fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
            }
            Text(dateTime, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(if (won) "Win" else "Loss", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            Text("$guesses guesses · ${fmtDuration(time)}", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}
