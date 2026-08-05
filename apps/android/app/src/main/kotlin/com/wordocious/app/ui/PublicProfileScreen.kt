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
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import io.github.jan.supabase.auth.auth
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
    // Profile-social layer: presence + trophy-case counters.
    @SerialName("last_seen_at") val lastSeenAt: String? = null,
    @SerialName("gold_medals") val goldMedals: Int = 0,
    @SerialName("silver_medals") val silverMedals: Int = 0,
    @SerialName("bronze_medals") val bronzeMedals: Int = 0,
    // PRIVATE PROFILES: world-readable flag + created_at ("Member since") for
    // the teaser card (docs/private-profiles-spec.md §3).
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("is_private") val isPrivate: Boolean = false,
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
    // iOS socialURL: a handle stored as "example.com" needs a scheme or
    // ACTION_VIEW finds no handler and the tap does nothing.
    SocialPlatform("website", "Website", Color(0xFF2563EB)) { if (it.startsWith("http")) it else "https://$it" },
)

@Composable
fun PublicProfileScreen(userId: String, onClose: () -> Unit, onOpenProfile: (String) -> Unit = {}) {
    // iOS PublicProfileView keeps `loading` and `notFound` apart — a null result
    // after the fetch settles means the profile is gone, not still in flight.
    val load by produceState(initialValue = true to null as PublicProfile?, userId) {
        value = false to fetchPublicProfile(userId)
    }
    val profileLoading = load.first
    val profile = load.second

    // ── PRIVATE PROFILES gate (docs/private-profiles-spec.md) ────────────────
    // Everything below the world-readable profiles row is gated: private
    // target + viewer is neither the owner nor an admin → teaser card only,
    // and NO deep fetch fires (the endpoints would 403 anyway; the open
    // tables — user_stats / daily_results / medals — must not be read either).
    val viewerProfile by AuthService.profile.collectAsState()
    val sessionUserId = remember {
        runCatching { SupabaseConfig.client.auth.currentUserOrNull()?.id }.getOrNull()
    }
    val isOwnProfile = userId == AuthService.userId || userId == sessionUserId
    val viewerIsAdmin = viewerProfile?.isAdmin == true
    // Latched when a deep endpoint answers with the typed 403 {private:true}
    // (the profiles row read was stale) — the server's verdict wins.
    var apiGated by remember(userId) { mutableStateOf(false) }
    val gated = apiGated || (profile?.isPrivate == true && !isOwnProfile && !viewerIsAdmin)
    // Hold the gate closed while a signed-in viewer's own profile row is still
    // loading, so the owner never flashes their own teaser (spec §6).
    val authSettled = sessionUserId == null || viewerProfile != null
    val loading = profileLoading || (profile?.isPrivate == true && !authSettled)
    // Deep fetches key on this: null until the profile row is here AND the
    // gate is open — so a gated profile never fires them at all.
    val deepUser = if (profile != null && !loading && !gated) userId else null

    val stats by produceState(initialValue = emptyList<ProfileService.UserStat>(), deepUser) {
        value = if (deepUser != null) ProfileService.fetchUserStats(deepUser) else emptyList()
    }
    val matches by produceState(initialValue = emptyList<ProfileService.RecentMatch>(), deepUser) {
        // Web endpoint, not the RLS-scoped query — matches SELECT is
        // participants-only, so the direct read is empty for anyone else.
        value = if (deepUser != null) {
            when (val res = ProfileService.fetchPublicRecentMatches(deepUser)) {
                is ProfileService.Gated.Ok -> res.value
                is ProfileService.Gated.PrivateProfile -> { apiGated = true; emptyList() }
                is ProfileService.Gated.Failed -> emptyList()
            }
        } else {
            emptyList()
        }
    }
    var playType by remember { mutableStateOf("solo") }
    var selectedMode by remember { mutableStateOf(GameMode.DUEL) }
    var showAllRecent by remember { mutableStateOf(false) }
    val topWords by produceState(
        initialValue = emptyList<com.wordocious.app.data.MatchStatsService.TopWord>(),
        deepUser, selectedMode, playType,
    ) {
        // iOS refetches top words on every tab/mode change (task id "\(tab)-\(mode)").
        // Web endpoint for the same RLS reason as matches above.
        value = if (deepUser != null) {
            ProfileService.fetchPublicTopWords(deepUser, selectedMode.name, playType)
        } else {
            emptyList()
        }
    }
    // iOS loadAll(): default the picker to the player's first mode for this tab
    // so a stranger's profile doesn't open on an all-zero Duel card.
    LaunchedEffect(stats) {
        stats.firstOrNull { it.playType == playType }?.gameMode
            ?.let { runCatching { GameMode.valueOf(it) }.getOrNull() }
            ?.let { selectedMode = it }
    }

    // Moderation (App Review 1.2): report + block from a stranger's profile —
    // ports the iOS PublicProfileView ellipsis menu. Own profile shows no menu.
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

    // ── Profile-social layer loads — every one best-effort: a failed fetch
    // renders nothing new and the classic profile below is untouched. All key
    // on deepUser so nothing fires while the privacy gate is closed. ─────────
    val persona by produceState(initialValue = null as ProfileService.Persona?, deepUser) {
        value = if (deepUser != null) runCatching { ProfileService.fetchPersona(deepUser) }.getOrNull() else null
    }
    val targetDailies by produceState(initialValue = emptyList<ProfileService.DailyRowLite>(), deepUser) {
        value = if (deepUser != null) {
            runCatching { ProfileService.fetchSoloDailyRows(deepUser) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
    }
    val viewerId = AuthService.userId
    val viewerDailies by produceState(initialValue = emptyList<ProfileService.DailyRowLite>(), deepUser, viewerId) {
        value = if (deepUser != null && viewerId != null && viewerId != userId) {
            runCatching { ProfileService.fetchSoloDailyRows(viewerId) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
    }
    val medalHistory by produceState(initialValue = emptyList<ProfileService.UserMedal>(), deepUser) {
        value = if (deepUser != null) {
            runCatching { ProfileService.fetchUserMedals(deepUser, limit = 200) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
    }
    val h2h = remember(viewerDailies, targetDailies) {
        if (viewerDailies.isNotEmpty() && targetDailies.isNotEmpty()) {
            ProfileService.computeH2H(viewerDailies, targetDailies)
        } else {
            null
        }
    }
    val targetName = profile?.username ?: "Player"
    var showArchetype by remember { mutableStateOf(false) }
    var showH2H by remember { mutableStateOf(false) }
    var showMedals by remember { mutableStateOf(false) }
    var showCalendar by remember { mutableStateOf(false) }
    var boardSeed by remember { mutableStateOf<String?>(null) }
    var podiumTarget by remember { mutableStateOf<Pair<String, String>?>(null) }   // (day, mode)

    Column(
        Modifier.fillMaxSize().appBackground()
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
        if (loading) {
            // Loading skeletons (web animate-pulse parity).
            SkeletonBlock(height = 96.dp)
            SkeletonBlock(height = 200.dp)
            return@Column
        }
        if (p == null) {
            // iOS notFoundView — deleted/banned/bad-id profiles get a message and
            // a way out instead of skeletons that never resolve.
            Column(
                Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("Player not found", fontSize = 28.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(
                    "This profile doesn't exist or may have been removed.",
                    fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                androidx.compose.material3.Button(
                    onClick = onClose,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = WTheme.primary),
                ) { Text("Back", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White) }
            }
            return@Column
        }

        // ── PRIVATE PROFILE TEASER (spec §3) — one clean card from the
        // world-readable profiles row; nothing that reveals words or strategy
        // renders. Report/Block stays in the header row above; the deep
        // fetches never fired (deepUser is null while gated). ────────────────
        if (gated) {
            PrivateProfileTeaser(p)
            Row(
                Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                Row(
                    Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                        .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                        .clickableNoRipple(onClose).padding(horizontal = 18.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(14.dp))
                    Text("Back", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED))
                }
            }
            Spacer(Modifier.height(20.dp))
            return@Column
        }

        // ── Header: avatar / gradient username / level badge / XP bar / socials ──
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val avatarUrl = p.avatarUrl?.takeIf { it.isNotBlank() }
            val customAccent = ProfileAccent.isCustom(p.accentColor)
            // Today-progress ring — the target's completed dailies today (mock:
            // ring + "N/9 today" capsule around the avatar).
            val todayCount = targetDailies.count { it.day == com.wordocious.app.todayLocalDate() && it.completed }
            TodayRingAvatar(completed = todayCount) {
                Box(
                    // iOS AvatarView: no accent set = the wordmark gradient, never a flat grey.
                    Modifier.size(96.dp).clip(CircleShape).background(if (customAccent) ProfileAccent.avatarBrush(p.accentColor) else WTheme.wordmarkGradient),
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
                            fontSize = 38.4f.sp, fontWeight = FontWeight.Black, color = Color.White,   // iOS: size * 0.4
                        )
                    }
                }
            }
            if (customAccent) {
                Text(p.username ?: "Player", fontSize = 30.sp, fontWeight = FontWeight.Black, color = ProfileAccent.color(p.accentColor))
            } else {
                Text(
                    p.username ?: "Player",
                    fontSize = 30.sp, fontWeight = FontWeight.Black,
                    style = TextStyle(
                        fontFamily = com.wordocious.app.ui.theme.Nunito,
                        brush = Brush.horizontalGradient(
                            listOf(Color(0xFFFBBF24), Color(0xFFEC4899), Color(0xFFA78BFA)),
                        ),
                    ),
                )
            }
            // PRIVATE PROFILES: the owner (and admins) still see the full page
            // — this muted pill is the reminder that everyone else doesn't.
            if (p.isPrivate) {
                Row(
                    Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                        .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(Icons.Filled.Lock, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                    Text(
                        (if (isOwnProfile) "Your profile is private" else "Private profile").uppercase(),
                        fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.4.sp,
                    )
                }
            }
            // Presence line — pulsing dot + "Played N minutes ago" (mock .presence).
            PresenceLine(p.lastSeenAt)
            ProfilePersonalizationRow(p.accentColor, p.bio, p.featuredAchievement, p.favoriteMode)
            // Chips row: Level (relocated from the old standalone badge) +
            // archetype + best percentile + signature opener (mock .idchips).
            IdentityChipsRow(level = p.level, persona = persona, onArchetypeTap = { showArchetype = true })
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
            // Socials — iOS socialLinksRow(): 30×30 grey circles with an
            // @/globe/chat glyph, not brand-colored word pills (those wrapped
            // out of the header once a player had three or more links).
            val links = p.socialLinks ?: emptyMap()
            val present = SOCIAL_PLATFORMS.filter { !links[it.key].isNullOrBlank() }
            if (present.isNotEmpty()) {
                val ctx = LocalContext.current
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    present.forEach { pf ->
                        Box(
                            Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(WTheme.surfaceHover)
                                .border(1.5.dp, WTheme.border, CircleShape)
                                .clickableNoRipple {
                                    runCatching {
                                        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(pf.url(links[pf.key]!!))))
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            when (pf.key) {
                                "website" -> Icon(Icons.Filled.Language, pf.label, tint = WTheme.textSecondary, modifier = Modifier.size(15.dp))
                                "discord" -> Icon(Icons.AutoMirrored.Filled.Chat, pf.label, tint = WTheme.textSecondary, modifier = Modifier.size(15.dp))
                                else -> Text("@", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary)
                            }
                        }
                    }
                }
            }
        }

        // ── Profile-social sections (approved mock): You-vs-Them → Trophy Case →
        // Highlights → Lately. All render above the existing stat cards; each
        // hides itself when its data didn't load. ───────────────────────────────
        if (!isOwnProfile && h2h != null && h2h.shared.isNotEmpty()) {
            val todayShared = h2h.shared.firstOrNull { it.day == com.wordocious.app.todayLocalDate() }
            YouVsThemCard(
                targetName = targetName,
                h2h = h2h,
                todayShared = todayShared,
                onCardTap = { showH2H = true },
                onTodayTap = { s -> boardSeed = com.wordocious.core.generateDailySeed(s.day, s.gameMode) },
            )
        }
        TrophyCaseCard(
            gold = p.goldMedals, silver = p.silverMedals, bronze = p.bronzeMedals,
            flawless = persona?.flawless,
            onTap = { showMedals = true },
        )
        val highlights = buildList {
            persona?.longestWinStreak?.takeIf { it >= 2 }?.let { streak ->
                add(ProfileHighlight("🏆", "$streak-win streak", "Career best", onTap = { showCalendar = true }))
            }
            stats.filter { it.playType == "solo" }
                .mapNotNull { s -> s.fastestTime?.takeIf { it > 0 }?.let { t -> s.gameMode to t } }
                .minByOrNull { it.second }
                ?.let { (m, t) ->
                    add(ProfileHighlight("⚡", formatShortTime(t), "Fastest ${modeTitleFromDb(m)} solve"))
                }
            val perfectOctos = targetDailies.filter { it.gameMode == "OCTORDLE" && (it.boardsSolved ?: 0) >= 8 }
            if (perfectOctos.isNotEmpty()) {
                val latest = perfectOctos.first()
                add(
                    ProfileHighlight(
                        "💥", "8/8 boards",
                        "Perfect ${modeTitleFromDb("OCTORDLE")}" + if (perfectOctos.size > 1) " ×${perfectOctos.size}" else "",
                        onTap = { boardSeed = com.wordocious.core.generateDailySeed(latest.day, latest.gameMode) },
                    ),
                )
            }
            persona?.flawless?.takeIf { it.count > 0 }?.let { fl ->
                add(ProfileHighlight("💎", "×${fl.count} Flawless", "All 9 dailies won in a day", onTap = { showCalendar = true }))
            }
        }
        HighlightsCard(highlights)
        LatelyCard(
            items = buildLatelyItems(
                medals = medalHistory,
                loginStreak = p.dailyLoginStreak,
                onMedals = { showMedals = true },
                onStreak = { showCalendar = true },
            ),
            nemesis = persona?.nemesis,
            onNemesisTap = { onOpenProfile(it) },
        )

        // ── Overall stat cards (iOS: one 4-across row) ──────────────────────────
        val games = p.totalWins + p.totalLosses
        val winRate = if (games > 0) "%.1f".format(p.totalWins * 100.0 / games) else "0.0"
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OverallCard(Icons.Filled.EmojiEvents, Color(0xFF7C3AED), "${p.totalWins}", "Wins", "$winRate% win rate", Modifier.weight(1f))
            OverallCard(Icons.Filled.LocalFireDepartment, Color(0xFFEA580C), "${p.currentStreak}", "Win Streak", "Best: ${p.bestStreak}", Modifier.weight(1f))
            OverallCard(Icons.Filled.Bolt, Color(0xFF7C3AED), "${p.dailyLoginStreak}", "Daily", "Best: ${p.bestDailyLoginStreak}", Modifier.weight(1f))
            OverallCard(Icons.Filled.TrackChanges, Color(0xFF2563EB), "$games", "Games", "${p.totalLosses} losses", Modifier.weight(1f))
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
            // iOS modeChip: the mode's own glyph over its proper-case title.
            MODE_CARDS.filter { it.engineMode != null }.forEach { card ->
                val m = card.engineMode!!
                val active = m == selectedMode
                Column(
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (active) card.accent.copy(alpha = 0.08f) else WTheme.surface)
                        .border(1.5.dp, if (active) card.accent else WTheme.border, RoundedCornerShape(12.dp))
                        .clickableNoRipple { selectedMode = m }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    ModeIconBox(card, 28.dp)
                    Text(
                        card.title, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1,
                        softWrap = false, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        color = if (active) card.accent else WTheme.textMuted,
                    )
                }
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
                        modeCardFor(selectedMode)?.let { ModeIconBox(it, 28.dp) }
                        Text(modeTitle(selectedMode), fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    }
                    // iOS: an unplayed mode/tab says so instead of showing 0 / 0 / — / —.
                    if (stat != null) {
                        Row(Modifier.fillMaxWidth()) {
                            ModeStat("Wins", "${stat.wins}", Modifier.weight(1f))
                            ModeStat("Losses", "${stat.losses}", Modifier.weight(1f))
                            ModeStat("Best", stat.bestScore?.let { if (it > 0) "${it.toInt()}" else "—" } ?: "—", Modifier.weight(1f))
                            ModeStat(
                                "Fastest",
                                stat.fastestTime?.takeIf { it > 0 }?.let { fmtDuration(it) } ?: "—",
                                Modifier.weight(1f),
                            )
                        }
                    } else {
                        Text(
                            "No $playType games played in this mode yet",
                            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
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

        // ── Recent matches — iOS renders this as a titled surface card ───────────
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = Color(0xFF2563EB), modifier = Modifier.size(14.dp))
                Text("Recent Matches", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            }
            if (matches.isEmpty()) {
                Text("No matches played yet.", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            } else {
                (if (showAllRecent) matches else matches.take(5)).forEach { m -> PublicMatchRow(m, userId) }
                if (matches.size > 5) {
                    Text(
                        if (showAllRecent) "Show less" else "View all ${matches.size} ›",
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.primary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clickableNoRipple { showAllRecent = !showAllRecent }.padding(top = 4.dp),
                    )
                }
            }
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

    // ── Profile-social dialogs/sheets ────────────────────────────────────────
    if (showArchetype) {
        ArchetypeDialog(
            targetName = targetName,
            targetArchetype = persona?.archetype ?: "CHALLENGER",
            onDismiss = { showArchetype = false },
        )
    }
    if (showH2H && h2h != null) {
        H2HDetailDialog(targetName = targetName, h2h = h2h, onDismiss = { showH2H = false })
    }
    boardSeed?.let { seed ->
        GuardedBoardDialog(targetId = userId, targetName = targetName, seed = seed, onDismiss = { boardSeed = null })
    }
    if (showMedals) {
        MedalHistorySheet(
            targetName = targetName,
            medals = medalHistory,
            onPodium = { day, mode -> podiumTarget = day to mode },
            onDismiss = { showMedals = false },
        )
    }
    podiumTarget?.let { (day, mode) ->
        PodiumDialog(
            day = day, gameMode = mode,
            onOpenProfile = { id ->
                podiumTarget = null
                showMedals = false
                onOpenProfile(id)
            },
            onDismiss = { podiumTarget = null },
        )
    }
    if (showCalendar) {
        // Distinct completed modes per day over the target's daily rows.
        val counts = targetDailies.filter { it.completed }
            .groupBy { it.day }
            .mapValues { (_, rows) -> rows.map { it.gameMode }.distinct().size }
        StreakCalendarDialog(targetName = targetName, dayCounts = counts, onDismiss = { showCalendar = false })
    }
}

// ── Private-profile teaser (docs/private-profiles-spec.md §3) ───────────────

private data class TeaserTier(val label: String, val bg: Color, val border: Color, val color: Color)

/** Same tier ladder as the own-profile page (Bronze <11 … Diamond 100+). */
private fun teaserTier(level: Int): TeaserTier = when {
    level >= 100 -> TeaserTier("Diamond", Color(0xFFEFF6FF), Color(0xFFBFDBFE), Color(0xFF1D4ED8))
    level >= 51 -> TeaserTier("Platinum", Color(0xFFF5F3FF), Color(0xFFC4B5FD), Color(0xFF6D28D9))
    level >= 26 -> TeaserTier("Gold", Color(0xFFFEF9EC), Color(0xFFFDE68A), Color(0xFF92400E))
    level >= 11 -> TeaserTier("Silver", Color(0xFFF3F4F6), Color(0xFFD1D5DB), Color(0xFF374151))
    else -> TeaserTier("Bronze", Color(0xFFFEF2E8), Color(0xFFFED7AA), Color(0xFF9A3412))
}

private val TEASER_MONTHS = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

/** "Mon YYYY" from an ISO created_at (ProfileScreen.memberSince parity). */
private fun teaserMemberSince(createdAt: String?): String? {
    val s = createdAt ?: return null
    if (s.length < 7) return null
    val y = s.substring(0, 4)
    val m = s.substring(5, 7).toIntOrNull() ?: return null
    return "${TEASER_MONTHS[(m - 1).coerceIn(0, 11)]} $y"
}

/**
 * One clean card styled like the profile header — identity + headline numbers,
 * all from the world-readable profiles row. Nothing that reveals words or
 * strategy renders; the deep endpoints 403 anyway, this is the face on that
 * rule. Matches the iOS teaser / web app/profile/[id]/page.tsx.
 */
@Composable
private fun PrivateProfileTeaser(p: PublicProfile) {
    val tier = teaserTier(p.level)
    val customAccent = ProfileAccent.isCustom(p.accentColor)
    val avatarUrl = p.avatarUrl?.takeIf { it.isNotBlank() }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(96.dp).clip(CircleShape)
                .background(if (customAccent) ProfileAccent.avatarBrush(p.accentColor) else WTheme.wordmarkGradient),
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
                    fontSize = 38.4f.sp, fontWeight = FontWeight.Black, color = Color.White,
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        if (customAccent) {
            Text(p.username ?: "Player", fontSize = 30.sp, fontWeight = FontWeight.Black, color = ProfileAccent.color(p.accentColor))
        } else {
            Text(
                p.username ?: "Player",
                fontSize = 30.sp, fontWeight = FontWeight.Black,
                style = TextStyle(
                    fontFamily = com.wordocious.app.ui.theme.Nunito,
                    brush = Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFEC4899), Color(0xFFA78BFA))),
                ),
            )
        }
        Spacer(Modifier.height(8.dp))
        // Lock badge — the notation the founder asked for.
        Row(
            Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(50))
                .padding(horizontal = 12.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Icon(Icons.Filled.Lock, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
            Text(
                "This profile is private".uppercase(),
                fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.5.sp,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            "${p.username ?: "Player"} keeps their words and strategies to themselves. You can still meet them on the daily leaderboards.",
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.width(240.dp),
        )
        Spacer(Modifier.height(16.dp))
        // Level + tier chip, member since — same chips as the profile header.
        Row(
            Modifier.clip(RoundedCornerShape(50)).background(tier.bg)
                .border(1.5.dp, tier.border, RoundedCornerShape(50))
                .padding(horizontal = 12.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Icon(Icons.Filled.Star, null, tint = tier.color, modifier = Modifier.size(13.dp))
            Text("Level ${p.level}", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = tier.color)
            Text("·", fontSize = 12.sp, color = tier.color.copy(alpha = 0.7f))
            Text(tier.label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = tier.color)
        }
        teaserMemberSince(p.createdAt)?.let {
            Spacer(Modifier.height(6.dp))
            Text("Member since $it", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Spacer(Modifier.height(16.dp))
        // Medal counts
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf("🥇" to p.goldMedals, "🥈" to p.silverMedals, "🥉" to p.bronzeMedals).forEach { (emoji, count) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(emoji, fontSize = 17.sp)
                    Text("$count", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
        Spacer(Modifier.height(12.dp))
        // Headline numbers
        Row(Modifier.fillMaxWidth()) {
            listOf(
                "Wins" to p.totalWins,
                "Games" to (p.totalWins + p.totalLosses),
                "Daily Streak" to p.dailyLoginStreak,
            ).forEach { (label, value) ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("$value", fontSize = 17.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.6.sp, maxLines = 1)
                }
            }
        }
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
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.4.sp)
        Text(sub, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
    }
}

@Composable
private fun ModeStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        // iOS deliberately renders all four values in primary text, not the cell color.
        Text(value, fontSize = 17.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/** A mode's glyph in its accent-tinted rounded square — iOS ModeIconView(box:). */
@Composable
private fun ModeIconBox(card: ModeCard, box: androidx.compose.ui.unit.Dp) {
    Box(
        Modifier.size(box).clip(RoundedCornerShape(box * 0.27f)).background(card.accent.copy(alpha = 0.08f)),
        contentAlignment = Alignment.Center,
    ) {
        ModeGlyph(card, tint = card.accent, box = box)
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
    val card = mode?.let { modeCardFor(it) }
    val dateTime = runCatching {
        val inst = java.time.Instant.parse(if (m.createdAt.endsWith("Z") || m.createdAt.contains('+')) m.createdAt else m.createdAt + "Z")
        val zdt = inst.atZone(java.time.ZoneId.systemDefault())
        zdt.format(java.time.format.DateTimeFormatter.ofPattern("MMM d · h:mm a"))
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
        // iOS RecentMatchRow leads with the mode's own glyph, not a win/loss tick.
        if (card != null) {
            ModeIconBox(card, 36.dp)
        } else {
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFFD97706).copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.Bolt, null, tint = Color(0xFFD97706), modifier = Modifier.size(15.dp)) }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(card?.title ?: m.gameMode, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
                Text(if (isVs) "VS" else "Solo", fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
                if (m.forfeit == true) {
                    Text(
                        "FORFEIT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFFB45309),
                        modifier = Modifier.clip(RoundedCornerShape(5.dp)).background(Color(0xFFFEF3C7))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            Text(
                "$guesses ${if (guesses == 1) "guess" else "guesses"} · ${if (time > 0) fmtDuration(time) else "—"}",
                fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(if (won) "Win" else "Loss", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            Text(dateTime, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}
