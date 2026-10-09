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
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
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
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.ModerationService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.StatsProfile
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription

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
    // FINISH_SPEC AN3 (additive; select * — the column may not exist yet → null).
    @SerialName("avatar_config") val avatarConfig: kotlinx.serialization.json.JsonElement? = null,
    // FINISH_SPEC BJ5 (select *): the worn cast hero + tier frame for the shared resolver.
    @SerialName("avatar_cast_id") val avatarCastId: String? = null,
    @SerialName("avatar_frame") val avatarFrame: String? = null,
)

/** BJ5: this profile's look for the shared avatar resolver. */
private fun PublicProfile.avatarFields() = com.wordocious.app.data.AvatarFields(
    id, username, avatarUrl, avatarConfig, avatarCastId, avatarFrame, accentColor, complete = true,
)

private suspend fun fetchPublicProfile(id: String): PublicProfile? = runCatching {
    SupabaseConfig.client.postgrest["profiles"]
        .select { filter { eq("id", id) }; limit(1) }
        .decodeSingleOrNull<PublicProfile>()
        // AN3: their mascot shows on every avatar of them from now on.
        ?.also { runCatching { com.wordocious.app.data.MascotAvatars.recordRaw(it.username, it.avatarConfig) } }
        // BJ5: and the shared avatar directory (every surface that shows them).
        ?.also { p -> runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) { com.wordocious.app.data.PlayerAvatars.record(p.avatarFields()) } } }
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
fun PublicProfileScreen(
    userId: String, onClose: () -> Unit, onOpenProfile: (String) -> Unit = {},
    /** 2.8 item 17: the action row's doors — a pocket game's screen, the private VS lobby (Challenge), Race my run, Go Pro. */
    onOpenGame: (String) -> Unit = {},
    onJoinInvite: (GameMode, String) -> Unit = { _, _ -> },
    onRaceRun: (String) -> Unit = {},
) {
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
    // FRIENDS (§207): "private" means "friends only" — an accepted friend sees
    // the full profile (the server gate opens the same way). friendsVersion is
    // the snapshot read that recomposes the gate when the cache changes.
    var friendsVersion by remember { mutableStateOf(FriendsService.version) }
    DisposableEffect(Unit) {
        val remove = FriendsService.addListener { friendsVersion = FriendsService.version }
        onDispose { remove() }
    }
    LaunchedEffect(sessionUserId) { if (sessionUserId != null) FriendsService.load() }
    val viewerIsFriend = friendsVersion >= 0 && FriendsService.isFriend(userId)
    // A fresh friendship reopens a server-latched gate (iOS re-runs loadAll).
    LaunchedEffect(viewerIsFriend) { if (viewerIsFriend) apiGated = false }
    val gated = apiGated || (
        profile?.isPrivate == true && !isOwnProfile && !viewerIsAdmin && !viewerIsFriend
    )
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

    // FRIENDS (§207): Add Friend button state (iOS addFriendButton parity).
    var confirmUnfriend by remember(userId) { mutableStateOf(false) }
    // 2.8 item 17: the hero's friendship state (core rules), "Friends since", and the action row's sheets.
    val friendState = StatsProfile.friendshipState(
        isSelf = isOwnProfile, isFriend = viewerIsFriend,
        incoming = friendsVersion >= 0 && !isOwnProfile && FriendsService.hasIncomingFrom(userId),
        requested = friendsVersion >= 0 && !isOwnProfile && FriendsService.hasRequested(userId),
    )
    val friendsSince = if (viewerIsFriend) FriendsService.friends.firstOrNull { it.id == userId }?.since else null
    var quickPlay by remember { mutableStateOf<com.wordocious.app.ui.friends.QuickPlayRequest?>(null) }
    var reactOpen by remember { mutableStateOf(false) }
    var actionBusy by remember { mutableStateOf(false) }
    LaunchedEffect(confirmUnfriend) { if (confirmUnfriend) { delay(3_000); confirmUnfriend = false } }

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

    // 2.8 item 17: Pocket game opens the quick-play sheet with this friend preselected (the Friends tab's flow); React sends one
    // canned note (the Friends taunts), one per day per friend.
    quickPlay?.let { req ->
        com.wordocious.app.ui.friends.QuickPlaySheet(
            request = req, friends = FriendsService.friends,
            onDismiss = { quickPlay = null },
            onOpenGame = { id -> quickPlay = null; onOpenGame(id) },
            onVsBattle = { f ->
                quickPlay = null
                moderationScope.launch {
                    when (val r = FriendsService.challenge(f.id, "DUEL")) {
                        is FriendsService.ChallengeOutcome.Sent -> onJoinInvite(GameMode.DUEL, r.code)
                        is FriendsService.ChallengeOutcome.Failed -> moderationToast = r.message
                    }
                }
            },
            onRaceRun = { id -> quickPlay = null; onRaceRun(id) },
        )
    }
    if (reactOpen) {
        FamilyActionMenu(
            title = "React", subtitle = "Send $targetName a quick note",
            onDismiss = { reactOpen = false },
            actions = com.wordocious.app.data.FriendTaunts.ALL.map { t ->
                // No emoji in UI (§AM3): the id's canned line without its leading emoji.
                val line = t.text.substringAfter(' ')
                FamilyMenuAction(t.id, line, FamilyMenuIcon.Clay(FamIcon.HEART), FamilyMenuInk.PINK, contentDescription = line) {
                    moderationScope.launch {
                        moderationToast = when (FriendsService.taunt(userId, t.id, com.wordocious.app.todayLocalDate())) {
                            FriendsService.TauntOutcome.SENT -> "Sent!"
                            FriendsService.TauntOutcome.ALREADY_SENT -> "You already reacted to $targetName today"
                            FriendsService.TauntOutcome.FAILED -> "Could not send. Try again."
                        }
                    }
                }
            },
        )
    }

    Column(
        Modifier.fillMaxSize().pageBackground(PageTint.HOME)
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
            // The shared back circle (HEADER_SPEC §4).
            HeaderBackButton(onClose)
            // App Review 1.2: users must be able to report/block each other
            // wherever strangers' content (usernames/bios/avatars) renders.
            if (!isOwnProfile) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                // FRIENDS (§207): Add Friend pill beside the moderation kebab —
                // iOS addFriendButton states: Add Friend → Requested (tap =
                // cancel) · Accept request · Friends ✓ (tap → confirm unfriend).
                if (gated && sessionUserId != null && !blocked) {
                    // A8: every friend state is a small candy button (same taps as before).
                    when {
                        viewerIsFriend && confirmUnfriend -> CandyButton(
                            "Remove friend?", onClick = {
                                confirmUnfriend = false
                                moderationScope.launch { FriendsService.remove(userId) }
                            },
                            color = CandyColor.PINK, size = CandySize.SMALL,
                        )
                        viewerIsFriend -> CandyButton(
                            "Friends", onClick = { confirmUnfriend = true },
                            color = CandyColor.TEAL, size = CandySize.SMALL, contentDescription = "Friends. Tap to remove",
                            leading = { Icon3D(Icon3DName.BADGE_CHECK, 16.dp) },
                        )
                        FriendsService.hasIncomingFrom(userId) -> CandyButton(
                            "Accept request", onClick = { moderationScope.launch { FriendsService.accept(userId) } },
                            color = CandyColor.PURPLE, size = CandySize.SMALL,
                        )
                        FriendsService.hasRequested(userId) -> CandyButton(
                            "Requested", onClick = { moderationScope.launch { FriendsService.decline(userId) } },
                            color = CandyColor.PEACH, size = CandySize.SMALL, contentDescription = "Requested. Tap to cancel",
                        )
                        else -> CandyButton(
                            "Add Friend", onClick = { moderationScope.launch { FriendsService.request(addresseeId = userId) } },
                            color = CandyColor.PURPLE, size = CandySize.SMALL,
                        )
                    }
                }
                Box {
                    // A right-side action: the same white circle (HEADER_SPEC §4).
                    HeaderCircle(onClick = { menuOpen = true }, contentDescription = "More options", size = 34.dp) {
                        Icon(Icons.Filled.MoreVert, null, tint = HeaderInk.control, modifier = Modifier.size(20.dp))
                    }
                    // The family action menu (founder 10-05: no plain-text menus) — same actions + confirmations.
                    if (menuOpen) {
                        val who = profile
                        FamilyActionMenu(
                            title = who?.username ?: "Player",
                            subtitle = "Keep Wordocious friendly",
                            avatar = who?.let { pr ->
                                {
                                    val f = pr.avatarFields()
                                    PlayerAvatar(
                                        pr.username ?: "P", 44.dp, userId = f.userId, avatarUrl = pr.avatarUrl, config = f.config,
                                        castId = f.castId, frame = f.frame, accentHex = f.accentHex, contentDescription = null,
                                    )
                                }
                            },
                            onDismiss = { menuOpen = false },
                            actions = buildList {
                                // 2.8 item 17: Unfriend / Block / Report all live in the ⋯ menu (Unfriend only for friends).
                                if (viewerIsFriend && !gated) add(FamilyMenuAction("unfriend", "Unfriend", FamilyMenuIcon.Clay(FamIcon.XMARK), danger = true,
                                    contentDescription = "Unfriend this player") { moderationScope.launch { FriendsService.remove(userId) } })
                                add(FamilyMenuAction("report", "Report user", FamilyMenuIcon.Clay(FamIcon.FLAG), danger = true,
                                    contentDescription = "Report this user") { showReportDialog = true })
                                if (blocked) {
                                    add(FamilyMenuAction("unblock", "Unblock user", FamilyMenuIcon.Clay(FamIcon.CHECK), FamilyMenuInk.TEAL) {
                                        moderationScope.launch {
                                            ModerationService.unblock(userId)
                                            blocked = false
                                            moderationToast = "User unblocked"
                                        }
                                    })
                                } else {
                                    add(FamilyMenuAction("block", "Block user", FamilyMenuIcon.Clay(FamIcon.XMARK), danger = true,
                                        contentDescription = "Block this user") { showBlockConfirm = true })
                                }
                            },
                        )
                    }
                }
                }
            }
        }
        // Brief moderation confirmation (iOS toast parity; auto-clears in 2.5s).
        moderationToast?.let { t ->
            // The finished candy message: a success / error coin and the soft candy pill.
            com.wordocious.app.ui.game.CandyMessagePill(
                t, com.wordocious.app.ui.game.FeedbackToast.statusTone(t),
                Modifier.align(Alignment.CenterHorizontally).padding(bottom = 3.dp),
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
            // O3's not-found scene (ART_SPEC §7) + BI24 headline, line and the way out.
            BrandEmptyState(
                title = "PLAYER NOT FOUND",
                heading = Heading.NOTFOUND,   // BJ16
                line = "This profile doesn't exist or may have been removed.",
                modifier = Modifier.padding(top = 24.dp),
                scene = SceneArt.NOT_FOUND, artHeight = 140.dp,
                actionLabel = "Back", onAction = onClose,
            )
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
                CandyButton(
                    "Back", onClick = onClose, color = CandyColor.PEACH, size = CandySize.MEDIUM,
                    leading = { Icon3D(Icon3DName.BACK, 17.dp) }, // ART_SPEC §5
                )
            }
            Spacer(Modifier.height(20.dp))
            return@Column
        }

        // ── Header: avatar / gradient username / level badge / XP bar / socials ──
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // Today-progress pill — the target's completed SWEEP dailies today ("N/total today"). A More Games
            // result (ProperNoundle, Sudoku…) is not part of the sweep.
            val sweepSet = com.wordocious.app.ModeGen.sweepModesFor(com.wordocious.app.todayLocalDate())
            val todayCount = targetDailies.count { it.day == com.wordocious.app.todayLocalDate() && it.completed && it.gameMode in sweepSet }
            // Item 17: the mascot full-body on a mini Stage (alive while living_mascot is on) with the today pill.
            ProfileStageHero(
                p.username ?: "Player", p.id, p.avatarUrl?.takeIf { it.isNotBlank() }, p.avatarConfig, p.avatarCastId, p.avatarFrame, p.accentColor,
            ) {
                if (todayCount > 0) {
                    Text(
                        "$todayCount/${sweepSet.size} today", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp)
                            .clip(RoundedCornerShape(50)).background(WTheme.primary).padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
            ProfileIdentityBlock(p.username ?: "Player", p.accentColor, viewerIsFriend, friendsSince)
            // PRIVATE PROFILES: the owner (and admins) still see the full page
            // — this muted pill is the reminder that everyone else doesn't.
            if (p.isPrivate) {
                Row(
                    Modifier.tintedPill(PROFILE_PURPLE, 50.dp)
                        .padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 4.dp),
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
            ProfileRankStrip(p.level, p.xp)
            // Challenge · Pocket game · React · Add friend / Requested / Accept–Decline (core profileActions).
            if (!isOwnProfile && sessionUserId != null && !blocked) {
                ProfileActionRow(
                    state = friendState, busy = actionBusy,
                    onChallenge = {
                        if (!actionBusy) {
                            actionBusy = true
                            moderationScope.launch {
                                when (val r = FriendsService.challenge(userId, "DUEL")) {
                                    is FriendsService.ChallengeOutcome.Sent -> onJoinInvite(GameMode.DUEL, r.code)
                                    is FriendsService.ChallengeOutcome.Failed -> moderationToast = r.message
                                }
                                actionBusy = false
                            }
                        }
                    },
                    onPocket = { quickPlay = com.wordocious.app.ui.friends.QuickPlayRequest(userId) },
                    onReact = { reactOpen = true },
                    onAddFriend = { moderationScope.launch { FriendsService.request(addresseeId = userId) } },
                    onCancelRequest = { moderationScope.launch { FriendsService.decline(userId) } },
                    onAccept = { moderationScope.launch { FriendsService.accept(userId) } },
                    onDecline = { moderationScope.launch { FriendsService.decline(userId) } },
                )
            }
            // Socials — iOS socialLinksRow(): 30×30 gray circles with an
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
                                .background(accentWash(PROFILE_PURPLE, 0.12f))
                                .border(1.5.dp, accentLine(PROFILE_PURPLE), CircleShape)
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
        if (!isOwnProfile && viewerIsFriend) {
            FriendsService.friends.firstOrNull { it.id == userId }?.let { ProfileHeadToHeadStrip(it, targetName) }
        }
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
                add(ProfileHighlight(GlyphArt.TROPHY, "$streak-win streak", "Career best", onTap = { showCalendar = true }))
            }
            stats.filter { it.playType == "solo" }
                .mapNotNull { s -> s.fastestTime?.takeIf { it > 0 }?.let { t -> s.gameMode to t } }
                .minByOrNull { it.second }
                ?.let { (m, t) ->
                    add(ProfileHighlight(GlyphArt.ZAP, formatShortTime(t), "Fastest ${modeTitleFromDb(m)} solve"))
                }
            val perfectOctos = targetDailies.filter { it.gameMode == "OCTORDLE" && (it.boardsSolved ?: 0) >= 8 }
            if (perfectOctos.isNotEmpty()) {
                val latest = perfectOctos.first()
                add(
                    ProfileHighlight(
                        GlyphArt.TARGET, "8/8 boards",
                        "Perfect ${modeTitleFromDb("OCTORDLE")}" + if (perfectOctos.size > 1) " ×${perfectOctos.size}" else "",
                        onTap = { boardSeed = com.wordocious.core.generateDailySeed(latest.day, latest.gameMode) },
                    ),
                )
            }
            persona?.flawless?.takeIf { it.count > 0 }?.let { fl ->
                add(ProfileHighlight(GlyphArt.DIAMOND, "×${fl.count} Flawless", "Every Daily Sweep game won in a day", onTap = { showCalendar = true }))
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

        // ── The headline numbers, once (item 17): the four hero stats. The daily streak lives in LATELY; level + XP are the strip above. ──
        val fastestSolo = stats.filter { it.playType == "solo" }.mapNotNull { it.fastestTime?.takeIf { t -> t > 0 } }.minOrNull() ?: 0
        KitCard(accent = Color(0xFF7C3AED)) {
            HeroStatsRow(p.totalWins, p.totalLosses, p.currentStreak, p.bestStreak, fastestSolo.toDouble(), Color(0xFF7C3AED))
        }

        // ── Game mode statistics ────────────────────────────────────────────────
        FinishLabel("GAME MODE STATISTICS")
        // The candy Solo | VS toggle (night art 10-03 sprites; was outlined chips with no Tab semantics).
        CandySegmentedToggle(listOf("solo" to "Solo", "vs" to "VS"), playType, { playType = it })
        // Mode picker chips
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // iOS modeChip: the mode's own glyph over its proper-case title —
            // every daily mode this viewer can see (sweep + visible More Games
            // titles, ProperNoundle included), since the row scrolls.
            // The square game tile (docs/GAME_TILE_STYLE.md) at the rail's size, short names.
            visibleDailyCards().forEach { card ->
                val m = card.engineMode!!
                val active = m == selectedMode
                GameTileSquare(
                    accent = card.accent, label = com.wordocious.app.ModeGen.byId(card.id)?.shortTitle ?: card.title,
                    selected = active, modifier = Modifier.padding(vertical = 6.dp).width(66.dp),
                    onClick = { selectedMode = m },
                ) { chip -> ModeGlyph(card, tint = card.accent, box = chip) }
            }
        }
        // Per-mode stats card (web: accent top bar + Wins/Losses/Best/Fastest)
        run {
            // user_stats has one row per (mode, play_type); ProfileService.fetchUserStats
            // returns all — filter for the selected mode is best-effort by mode name.
            val stat = stats.firstOrNull { it.gameMode == selectedMode.name && it.playType == playType }
            val accent = modeAccent(selectedMode)
            // A1: the mode's tinted card with its top bar.
            TintedCard(accent, Modifier.fillMaxWidth(), corner = 16.dp, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                        BrandEmptyState(
                            title = "NOT PLAYED YET",
                            line = "No ${if (playType == "vs") "VS" else playType} games in this mode yet.",
                            scene = SceneArt.NO_STATS, artHeight = 72.dp,
                        )
                    }
                }
            }
        }
        // Top words (web TopWordsCard, shown when non-empty)
        if (topWords.isNotEmpty()) {
            TintedCard(
                PROFILE_PURPLE, Modifier.fillMaxWidth(), corner = 16.dp,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FinishLabel("TOP WORDS")
                topWords.forEach { w ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(w.word.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        SoftNumber("×${w.count}", 13.sp)
                    }
                }
            }
        }

        // ── Recent matches — iOS renders this as a titled surface card ───────────
        TintedCard(
            Color(0xFF2563EB), Modifier.fillMaxWidth(), corner = 16.dp,
            // BJ7: 12 padding, a 25% smaller header, 6 between rows.
            contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = Color(0xFF2563EB), modifier = Modifier.size(12.dp))
                Text("Recent Matches", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            }
            if (matches.isEmpty()) {
                BrandEmptyState(
                    title = "NO MATCHES YET", line = "Games will show up here as they're played.",
                    scene = SceneArt.ASLEEP, artHeight = 72.dp,
                )
            } else {
                (if (showAllRecent) matches else matches.take(5)).forEach { m -> PublicMatchRow(m, userId) }
                if (matches.size > 5) {
                    CandyButton(
                        if (showAllRecent) "Show less" else "View all ${matches.size}", onClick = { showAllRecent = !showAllRecent },
                        color = CandyColor.PEACH, size = CandySize.SMALL,
                        modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 4.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(20.dp))
    }

    // Report reason picker (iOS confirmationDialog parity, context "public_profile").
    if (showReportDialog) {
        androidx.compose.material3.AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { showReportDialog = false },
            containerColor = accentWash(PROFILE_PINK, 0.10f),
            title = { Text("Report this user?", fontWeight = FontWeight.Black, color = WTheme.text) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Reports are reviewed by the Wordocious team.", fontSize = 12.sp, color = WTheme.textMuted)
                    Spacer(Modifier.height(2.dp))
                    listOf(
                        "Inappropriate username",
                        "Inappropriate profile content",
                        "Cheating / fake scores",
                        "Other",
                    ).forEach { reason ->
                        // A8: each reason is a candy button (tap = submit, as before).
                        CandyButton(
                            reason,
                            onClick = {
                                showReportDialog = false
                                moderationScope.launch {
                                    val ok = ModerationService.report(userId, reason, "public_profile")
                                    moderationToast = if (ok) "Report submitted — thank you" else "Could not submit report"
                                }
                            },
                            color = CandyColor.PINK, size = CandySize.MEDIUM, modifier = Modifier.fillMaxWidth(), fill = true,
                        )
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                CandyButton("Cancel", onClick = { showReportDialog = false }, color = CandyColor.PEACH, size = CandySize.MEDIUM)
            },
        )
    }
    // Block confirmation (iOS confirmationDialog parity).
    if (showBlockConfirm) {
        androidx.compose.material3.AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { showBlockConfirm = false },
            containerColor = accentWash(PROFILE_PINK, 0.10f),
            title = { Text("Block this user?", fontWeight = FontWeight.Black, color = WTheme.text) },
            text = { Text("You won't see this player on leaderboards or records.", color = WTheme.textSecondary) },
            confirmButton = {
                CandyButton(
                    "Block",
                    onClick = {
                        showBlockConfirm = false
                        moderationScope.launch {
                            ModerationService.block(userId)
                            blocked = true
                            moderationToast = "User blocked"
                        }
                    },
                    color = CandyColor.PINK, size = CandySize.MEDIUM,
                )
            },
            dismissButton = {
                CandyButton("Cancel", onClick = { showBlockConfirm = false }, color = CandyColor.PEACH, size = CandySize.MEDIUM)
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
    TintedCard(
        PROFILE_PURPLE, Modifier.fillMaxWidth(), corner = 18.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
    ) {
    Column(
        Modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // BJ5: THE shared resolver (photo / saved mascot / worn cast / seeded).
        PlayerAvatar(
            p.username ?: "P", 96.dp, userId = p.id, avatarUrl = avatarUrl, config = p.avatarConfig,
            castId = p.avatarCastId, frame = p.avatarFrame, accentHex = p.accentColor, contentDescription = "Avatar",
        )
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
            Modifier.tintedPill(PROFILE_PURPLE, 50.dp)
                .padding(start = 12.dp, end = 12.dp, top = 7.dp, bottom = 5.dp),
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
        // FINISH_SPEC V3: the tier badge + "LVL N" in soft numbers + the tier, on a tier-tinted pill.
        Row(
            Modifier.tintedPill(TierInk.accent(com.wordocious.core.levelTier(p.level)), 50.dp)
                .padding(start = 7.dp, end = 13.dp, top = 6.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) { LevelBadge(p.level, 32.dp, numberSize = 16.sp, prefix = "LVL", showTier = true, labelColor = tier.color) }
        teaserMemberSince(p.createdAt)?.let {
            Spacer(Modifier.height(6.dp))
            Text("Member since $it", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Spacer(Modifier.height(16.dp))
        // Medal counts
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            // AL addendum 2: the medal art, not 🥇 🥈 🥉 emoji; TalkBack reads "3 gold medals".
            listOf(Triple(GlyphArt.GOLD, p.goldMedals, "gold"), Triple(GlyphArt.SILVER, p.silverMedals, "silver"), Triple(GlyphArt.BRONZE, p.bronzeMedals, "bronze")).forEach { (art, count, name) ->
                Row(
                    Modifier.clearAndSetSemantics { contentDescription = "$count $name medals" },
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    GlyphArtImage(art, 20.dp)
                    SoftNumber("$count", 15.sp)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(accentLine(PROFILE_PURPLE)))
        Spacer(Modifier.height(12.dp))
        // Headline numbers
        Row(Modifier.fillMaxWidth()) {
            listOf(
                "Wins" to p.totalWins,
                "Games" to (p.totalWins + p.totalLosses),
                "Daily Streak" to p.dailyLoginStreak,
            ).forEach { (label, value) ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    SoftNumber("$value", 20.sp)
                    Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.6.sp, maxLines = 1)
                }
            }
        }
    }
    }
}

@Composable
private fun OverallCard(icon: Any, tint: Color, value: String, label: String, sub: String, modifier: Modifier = Modifier) {
    // A1: a tinted tile in the stat's color (4 dp band on top); A2: the soft number.
    Column(
        modifier
            .tintedPill(tint, 16.dp)
            .padding(start = 8.dp, end = 8.dp, top = 14.dp, bottom = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        // An ImageVector, or a 3D set icon (HEADER_SPEC §2: wins → trophy, streak → flame).
        when (icon) {
            is Icon3DName -> Icon3D(icon, 22.dp)
            is androidx.compose.ui.graphics.vector.ImageVector -> Icon(icon, null, tint = tint, modifier = Modifier.size(18.dp))
        }
        SoftNumber(value, 20.sp)
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.4.sp, maxLines = 1)
        Text(sub, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
    }
}

@Composable
private fun ModeStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        // A2: the four values as soft numbers (one ink, not the cell color — iOS parity).
        SoftNumber(value, 18.sp)
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

    // A1: the row in its mode's soft wash.
    val rowAccent = card?.accent ?: Color(0xFFD97706)
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            // BJ7: no outline; one top line (icon, title, W / L top-aligned).
            .background(accentWash(rowAccent, 0.12f))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Top,
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
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
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
            // ART_SPEC §4 / §13: the 3D W / L badge (~18) in place of the Win / Loss word.
            ResultBadge(won, ROW_RESULT_BADGE_SIZE, contentDescription = if (won) "Win" else "Loss")
            Text(dateTime, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

/** The public profile's purple (the Home / profile page accent) and the moderation pink. */
private val PROFILE_PURPLE = Color(0xFF7C3AED)
private val PROFILE_PINK = Color(0xFFEC4899)
