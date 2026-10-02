package com.wordocious.app.ui

import android.content.Intent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendlyGamesService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.friends.FlameCount
import com.wordocious.app.ui.friends.FriendFace
import com.wordocious.app.ui.friends.FriendlyGameGlyph
import com.wordocious.app.ui.friends.FriendlyGameIcon
import com.wordocious.app.ui.friends.FriendsBannerView
import com.wordocious.app.ui.friends.FriendsLabel
import com.wordocious.app.ui.friends.FriendsPink
import com.wordocious.app.ui.friends.PinkPill
import com.wordocious.app.ui.friends.QuickPlayRequest
import com.wordocious.app.ui.friends.QuickPlaySheet
import com.wordocious.app.ui.friends.color
import com.wordocious.app.ui.friends.friendsCard
import com.wordocious.app.ui.friends.sub
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FRIENDLY_KINDS
import com.wordocious.core.presenceLine
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// The Friends tab (§207 → D3 → the Friends overhaul, founder-approved
// 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md §2). Top to bottom (under the
// shared AppHeader): the controls row (bell = notification prefs, add-friend =
// jump to Add by username), the
// Friends banner, YOUR TURN, PLAY WITH FRIENDS, THIS WEEK'S RACE, YOUR
// FRIENDS, INVITES, MOMENTS, Add by username + share link, then the gift-Pro panel. The
// look is the home / VS redesign in a pink accent (ui/friends/FriendsKit.kt).

private val PURPLE = Color(0xFF7C3AED)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun FriendsScreen(
    onOpenProfile: (String) -> Unit = {},
    onJoinInvite: (com.wordocious.core.GameMode, String) -> Unit = { _, _ -> },
    /** Open a pocket game's screen. */
    onOpenGame: (String) -> Unit = {},
    /** "Race my run": the VS Friend page with this friend preselected (Pro). */
    onRaceRun: (String) -> Unit = {},
) {
    val signedIn = AuthService.userId != null
    var version by remember { mutableIntStateOf(FriendsService.version) }
    DisposableEffect(Unit) {
        val remove = FriendsService.addListener { version = FriendsService.version }
        onDispose { remove() }
    }
    // Revalidate each time the tab comes back on screen and when a daily lands; while it is
    // on screen, refresh every ~30 s so "On now" and the games stay current.
    val panelHidden by LocalTabHidden.current
    val recordedTick by com.wordocious.app.data.DailyCompletionsService.recordedTick.collectAsState()
    LaunchedEffect(panelHidden, recordedTick) {
        if (panelHidden || !signedIn) return@LaunchedEffect
        FriendsService.load()
        FriendlyGamesService.load()
        while (true) {
            delay(31_000)
            FriendsService.load()
            FriendlyGamesService.load()
        }
    }
    val hiddenState = LocalTabHidden.current
    val now by produceState(System.currentTimeMillis()) {
        while (true) { delay(20_000); hiddenState.awaitShown(); value = System.currentTimeMillis() }
    }
    val myProfile by AuthService.profile.collectAsState()
    val games by FriendlyGamesService.active.collectAsState()

    val friends = remember(version) { FriendsService.friends }
    val incoming = remember(version) { FriendsService.incoming }
    val outgoing = remember(version) { FriendsService.outgoingProfiles }

    var note by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(note) { if (note != null) { delay(2_500); note = null } }
    var tauntTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    var unfriendTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    var challenging by remember { mutableStateOf<String?>(null) }
    var quickPlay by remember { mutableStateOf<QuickPlayRequest?>(null) }
    var showRace by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val addRequester = remember { BringIntoViewRequester() }
    val addFocus = remember { FocusRequester() }

    // The existing free live VS challenge (§289): a private Classic battle, pushed to the friend.
    fun challenge(f: FriendsService.FriendProfile) {
        if (challenging != null) return
        challenging = f.id
        scope.launch {
            try {
                when (val r = FriendsService.challenge(f.id, "DUEL")) {
                    is FriendsService.ChallengeOutcome.Sent -> {
                        note = "Challenge sent to ${f.username} ⚔️"
                        onJoinInvite(com.wordocious.core.GameMode.DUEL, r.code)
                    }
                    is FriendsService.ChallengeOutcome.Failed -> note = r.message
                }
            } finally { challenging = null }
        }
    }

    val raceRows = remember(version, myProfile?.id) {
        val me = myProfile ?: return@remember emptyList()
        rankToday(
            friends.map { RaceEntrant(it.id, it.username, it.todayPoints ?: 0, it.playedToday ?: 0, me = false) } +
                RaceEntrant(me.id, me.username ?: "You", FriendsService.meDigest?.todayPoints ?: 0, FriendsService.meDigest?.playedToday ?: 0, me = true),
        )
    }

    Column(
        Modifier.fillMaxSize().pageBackground(PageTint.FRIENDS, alwaysLight = true)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 1. Title + controls row (founder, 2026-10-02: the shared AppHeader above every
        // tab is the Friends header too, so the FRIENDS text title row is gone). The
        // whole-cast FRIENDS art (ART_SPEC §2) leads; the bell and add-friend circles
        // sit right-aligned beside it.
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                PageTitleArt(TitleArt.FRIENDS, alignment = Alignment.CenterStart)
            }
            NotificationPrefsButton(myProfile)
            if (signedIn) {
                HeaderCircle(
                    onClick = { scope.launch { addRequester.bringIntoView(); runCatching { addFocus.requestFocus() } } },
                    contentDescription = "Add a friend",
                ) { Icon3D(Icon3DName.ADD_FRIEND, 23.dp) }
            }
        }
        if (!signedIn) {
            Text(
                "Sign in to add friends, race them every day and play pocket games together.",
                fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub,
            )
            return@Column
        }
        note?.let {
            // A shield note wears the 3D shield (HEADER_SPEC §2) instead of the emoji.
            val shieldNote = it.startsWith(SHIELD_NOTE)
            Row(
                Modifier.clip(RoundedCornerShape(50)).background(FriendsPink.soft)
                    .clickableNoRipple { note = null }.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                if (shieldNote) Icon3D(Icon3DName.SHIELD, 16.dp)
                Text(
                    if (shieldNote) it.removePrefix(SHIELD_NOTE) else it,
                    fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.solid,
                )
            }
        }

        // 2. The Friends banner
        FriendsBannerView(
            friends = friends, rows = raceRows, nowMs = now,
            onFace = { quickPlay = QuickPlayRequest(it.id) },
            onRace = { if (friends.isNotEmpty()) showRace = true },
        )

        // 4. YOUR TURN
        if (games.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FriendsLabel("YOUR TURN")
                    val mine = games.count { it.yourTurn }
                    if (mine > 0) {
                        Text(
                            "$mine", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                            modifier = Modifier.clip(RoundedCornerShape(50)).background(FriendsPink.solid).padding(horizontal = 7.dp, vertical = 1.dp),
                        )
                    }
                }
                // Your turn first, then the most recently moved.
                games.sortedWith(compareByDescending<FriendlyGamesService.GameView> { it.yourTurn }.thenByDescending { it.updatedAt }).forEach { g ->
                    Row(
                        Modifier.fillMaxWidth().friendsCard().clickableNoRipple { onOpenGame(g.id) }.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        FriendlyGameIcon(g.kind, 34.dp)
                        Column(Modifier.weight(1f)) {
                            Text(
                                "${g.title} vs @${g.opponent.username}", fontSize = 13.sp, fontWeight = FontWeight.Black,
                                color = FriendsPink.ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                            Text(g.line, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = FriendsPink.solid, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        PinkPill(if (g.yourTurn) "PLAY" else "WAITING", solid = g.yourTurn) { onOpenGame(g.id) }
                    }
                }
            }
        }

        // 5. PLAY WITH FRIENDS
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                FriendsLabel("PLAY WITH FRIENDS")
                Spacer(Modifier.weight(1f))
                Text("TAP A GAME, PICK A FRIEND", fontSize = 9.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.label, maxLines = 1)
            }
            // Six games, 3 across × 2 rows (§9); each row's cards share one height.
            FRIENDLY_KINDS.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { k ->
                        // The home mode card's tile (docs/GAME_TILE_STYLE.md): accent wash, top bar,
                        // the 3D pocket game art (ART_SPEC §9) on its soft chip.
                        GameTileCard(
                            accent = k.color, title = k.title, sub = k.sub,
                            modifier = Modifier.weight(1f).fillMaxHeight(),
                            surface = Color.White, titleColor = GameTileStyle.INK, subColor = FriendsPink.label,
                            titleMaxLines = 2,
                            onClick = {
                                if (friends.isEmpty()) {
                                    note = "Add a friend first — then pick a game"
                                    scope.launch { addRequester.bringIntoView() }
                                } else quickPlay = QuickPlayRequest(null, k)
                            },
                        ) { FriendlyGameGlyph(k, 26.dp) }
                    }
                }
            }
        }

        // 6. THIS WEEK'S RACE
        if (friends.isNotEmpty()) WeeklyRaceSection(version, onOpenProfile)

        // 7. YOUR FRIENDS
        YourFriendsSection(
            friends = friends, nowMs = now, version = version, challengingId = challenging,
            canGift = (myProfile?.streakShields ?: 0) > 0,
            onOpenProfile = onOpenProfile,
            onPlay = { quickPlay = QuickPlayRequest(it.id) },
            onChallenge = { challenge(it) },
            onTaunt = { tauntTarget = it },
            onUnfriend = { unfriendTarget = it },
            onNote = { note = it },
        )

        // INVITES (only while something is pending) — under YOUR FRIENDS (founder 2026-10-01).
        if (incoming.isNotEmpty() || outgoing.isNotEmpty()) {
            InvitesSection(incoming, outgoing, onOpenProfile)
        }

        // 8. MOMENTS
        ActivityFeed(onOpenProfile = onOpenProfile, onRematch = { kind, friendId -> quickPlay = QuickPlayRequest(friendId, kind) })

        // 9. Add by username + share link, then the gift-Pro panel.
        AddFriendSection(Modifier.bringIntoViewRequester(addRequester), addFocus) { note = it }
        InvitePanel()
        // The tab sits under the BottomNav — clear it so the last card's tail is reachable.
        Spacer(Modifier.height(96.dp))
    }

    // The quick-play sheet (§3).
    quickPlay?.let { req ->
        QuickPlaySheet(
            request = req, friends = friends,
            onDismiss = { quickPlay = null },
            onOpenGame = { id -> quickPlay = null; onOpenGame(id) },
            onVsBattle = { f -> quickPlay = null; challenge(f) },
            onRaceRun = { id -> quickPlay = null; onRaceRun(id) },
        )
    }

    // The full Today's Race (the TODAY'S RACE row of the banner).
    if (showRace) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { showRace = false }, sheetState = sheetState, containerColor = FriendsPink.page) {
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PageTitleText("TODAY’S RACE", accent = PageAccent.friends, fontSize = 17.sp)
                Column(Modifier.fillMaxWidth().friendsCard().padding(12.dp)) {
                    TodaysRaceCard(
                        friends = friends,
                        meDigest = FriendsService.meDigest,
                        challengingId = challenging,
                        onOpenProfile = { showRace = false; onOpenProfile(it) },
                        onTaunt = { tauntTarget = it },
                        onChallenge = { showRace = false; challenge(it) },
                    )
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    // Unfriend confirm (§225).
    unfriendTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { unfriendTarget = null },
            title = { Text("Unfriend ${target.username}?", fontWeight = FontWeight.Black, fontFamily = Nunito) },
            text = { Text("You can re-add them anytime.", fontFamily = Nunito) },
            confirmButton = {
                TextButton(onClick = {
                    val id = target.id
                    unfriendTarget = null
                    scope.launch { FriendsService.remove(id); FriendsService.load(force = true) }
                }) { Text("Unfriend", color = Color(0xFFDC2626), fontWeight = FontWeight.Black) }
            },
            dismissButton = {
                TextButton(onClick = { unfriendTarget = null }) { Text("Keep", fontWeight = FontWeight.Black) }
            },
        )
    }

    // Taunt picker — the leaderboard dialog's twin (§207 fixed phrases).
    tauntTarget?.let { target -> TauntDialog(target) { tauntTarget = null } }
}

// ── INVITES ────────────────────────────────────────────────────────────────

@Composable
private fun InvitesSection(
    incoming: List<FriendsService.FriendProfile>,
    outgoing: List<FriendsService.FriendProfile>,
    onOpenProfile: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var inviteNote by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(inviteNote) { if (inviteNote != null) { delay(2_500); inviteNote = null } }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FriendsLabel("INVITES")
            Text(
                "${incoming.size + outgoing.size}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(FriendsPink.solid).padding(horizontal = 7.dp, vertical = 1.dp),
            )
        }
        Column(Modifier.fillMaxWidth().friendsCard().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (incoming.isNotEmpty()) {
                FriendsLabel("FRIEND REQUESTS")
                incoming.forEach { r ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        FriendAvatar(r)
                        Text(
                            "@${r.username}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.ink, maxLines = 1,
                            modifier = Modifier.weight(1f).clickableNoRipple { onOpenProfile(r.id) },
                        )
                        Box(
                            Modifier.size(30.dp).clip(CircleShape).background(FriendsPink.solid)
                                .clickableNoRipple { scope.launch { FriendsService.accept(r.id) } },
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Filled.Check, "Accept ${r.username}", tint = Color.White, modifier = Modifier.size(15.dp)) }
                        Box(
                            Modifier.size(30.dp).clip(CircleShape).background(FriendsPink.soft)
                                .clickableNoRipple { scope.launch { FriendsService.decline(r.id) } },
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Filled.Close, "Decline ${r.username}", tint = FriendsPink.solid, modifier = Modifier.size(15.dp)) }
                    }
                }
            }
            if (outgoing.isNotEmpty()) {
                FriendsLabel("SENT — WAITING")
                outgoing.forEach { r ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FriendAvatar(r)
                        Text(
                            buildAnnotatedString {
                                append("@${r.username}")
                                withStyle(SpanStyle(color = FriendsPink.label, fontSize = 10.sp)) { append("  · ${agoShort(r.requestedAt)}") }
                            },
                            fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.ink, maxLines = 1,
                            modifier = Modifier.weight(1f).clickableNoRipple { onOpenProfile(r.id) },
                        )
                        // §212: the invite usually died unseen — re-push, 1/24h.
                        val reminded = withinDay(r.remindedAt)
                        PinkPill(if (reminded) "Reminded" else "Remind", solid = false, enabled = !reminded) {
                            scope.launch {
                                inviteNote = when (FriendsService.remind(r.id)) {
                                    FriendsService.RemindOutcome.REMINDED -> "Reminder sent to ${r.username} 🔔"
                                    FriendsService.RemindOutcome.ALREADY -> "Already reminded today"
                                    FriendsService.RemindOutcome.FAILED -> "Could not remind"
                                }
                            }
                        }
                        Text(
                            "Cancel", fontSize = 11.sp, fontWeight = FontWeight.Black, color = FriendsPink.label,
                            modifier = Modifier.clickableNoRipple { scope.launch { FriendsService.decline(r.id) } }.padding(4.dp),
                        )
                    }
                }
            }
            inviteNote?.let {
                Text(it, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.sub, modifier = Modifier.clickableNoRipple { inviteNote = null })
            }
        }
    }
}

// ── THIS WEEK'S RACE ───────────────────────────────────────────────────────

@Composable
private fun WeeklyRaceSection(version: Int, onOpenProfile: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var sharingRace by remember { mutableStateOf(false) }
    var showPastWeeks by remember { mutableStateOf(false) }
    // Weekly race standings (§212/§238) — me + friends by this week's daily points, best first.
    val standings = remember(version) {
        val friendEntries = FriendsService.friends.map {
            PodiumEntry(it.id, it.username, it.avatarUrl, it.avatarEmoji, it.weekPoints ?: 0, isMe = false)
        }
        val p = AuthService.profile.value
        val all = if (p != null && friendEntries.isNotEmpty()) {
            friendEntries + PodiumEntry(
                p.id, "You", p.avatarUrl, p.avatarEmoji, FriendsService.meDigest?.weekPoints ?: 0, isMe = true,
                avatarName = p.username ?: "You", accentHex = p.accentColor,
            )
        } else friendEntries
        all.sortedByDescending { it.pts }
    }
    val podium = standings.take(3)
    val raceStarted = standings.any { it.pts > 0 }
    if (podium.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FriendsLabel("THIS WEEK’S RACE")
            Spacer(Modifier.weight(1f))
            WeekEndsCountdown()
            if (raceStarted) {
                Icon3D(Icon3DName.SHARE, 18.dp, contentDescription = "Share weekly race", alpha = if (sharingRace) 0.4f else 1f, modifier = Modifier.padding(start = 8.dp).clickableNoRipple {
                        if (!sharingRace) {
                            sharingRace = true
                            scope.launch {
                                try {
                                    com.wordocious.app.data.LeaderboardShare.shareWeeklyRaceCard(
                                        context, FriendsService.friends, FriendsService.meDigest,
                                        AuthService.profile.value?.username ?: "You",
                                    )
                                } finally { sharingRace = false }
                            }
                        }
                    },
                )
            }
        }
        Column(
            Modifier.fillMaxWidth().friendsCard().padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // §294 (D3.3) — the Sunday finish, settled server-side.
            val lastWeekResult = remember(version) { FriendsService.lastWeek }
            lastWeekResult?.let { r ->
                val win = r.rank == 1
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            if (win) Brush.linearGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A))) else SolidColor(FriendsPink.page),
                            RoundedCornerShape(12.dp),
                        )
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    if (win) Icon3D(Icon3DName.CROWN, 22.dp) else Text("🏁", fontSize = 16.sp)
                    Text(
                        buildAnnotatedString {
                            append("Last week you finished ")
                            withStyle(SpanStyle(fontWeight = FontWeight.Black)) { append("${ordinal(r.rank)} of ${r.circleSize}") }
                            append(" · ${fmtPts(r.points)} pts")
                            if (!win && !r.winnerName.isNullOrBlank()) {
                                withStyle(SpanStyle(color = FriendsPink.label)) {
                                    append(" · "); appendIcon3D(Icon3DName.CROWN); append(" ${r.winnerName} ${fmtPts(r.winnerPoints)}")
                                }
                            }
                        },
                        inlineContent = icon3DInline(),
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (win) Color(0xFF92400E) else FriendsPink.ink, fontFamily = Nunito,
                        lineHeight = 14.sp, modifier = Modifier.weight(1f),
                    )
                }
            }
            // §232/§238: last week's winner, and the settled-week history.
            val lastWeek = remember(version) {
                val entries = FriendsService.friends.map { it.username to (it.lastWeekPoints ?: 0) } +
                    listOfNotNull(AuthService.profile.value?.let { "You" to (FriendsService.meDigest?.lastWeekPoints ?: 0) })
                entries.maxByOrNull { it.second }?.takeIf { it.second > 0 }
            }
            val pastWeeks = remember(version) {
                val meArr = FriendsService.meDigest?.pastWeekPoints ?: emptyList()
                val len = maxOf(meArr.size, FriendsService.friends.maxOfOrNull { it.pastWeekPoints?.size ?: 0 } ?: 0)
                (0 until len).mapNotNull { k ->
                    val entries = FriendsService.friends.map { it.username to (it.pastWeekPoints?.getOrNull(k) ?: 0) } +
                        listOfNotNull(AuthService.profile.value?.let { "You" to (meArr.getOrNull(k) ?: 0) })
                    entries.maxByOrNull { it.second }?.takeIf { it.second > 0 }?.let { Triple(k, it.first, it.second) }
                }
            }
            lastWeek?.let { (name, pts) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().clickableNoRipple { if (pastWeeks.size > 1) showPastWeeks = !showPastWeeks },
                ) {
                    Text(
                        buildAnnotatedString { append("Last week: "); appendIcon3D(Icon3DName.CROWN); append(" $name · ${fmtPts(pts)} pts") },
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, fontFamily = Nunito,
                        inlineContent = icon3DInline(),
                    )
                    if (pastWeeks.size > 1) {
                        Icon(
                            Icons.Filled.KeyboardArrowDown, "Past weeks", tint = FriendsPink.label,
                            modifier = Modifier.size(14.dp).rotate(if (showPastWeeks) 180f else 0f),
                        )
                    }
                }
            }
            if (showPastWeeks) {
                pastWeeks.filter { it.first > 0 }.forEach { (k, name, pts) ->
                    Text(
                        buildAnnotatedString { append("${pastWeekLabel(k)}: "); appendIcon3D(Icon3DName.CROWN); append(" $name · ${fmtPts(pts)} pts") },
                        fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        color = FriendsPink.label, fontFamily = Nunito, modifier = Modifier.fillMaxWidth().padding(start = 4.dp),
                        inlineContent = icon3DInline(),
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(22.dp, Alignment.CenterHorizontally),
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            ) {
                listOf(1, 0, 2).filter { it < podium.size }.forEach { i ->
                    val e = podium[i]
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                        modifier = Modifier.padding(top = if (i == 0) 0.dp else 8.dp).clickableNoRipple { onOpenProfile(e.id) },
                    ) {
                        Text(if (raceStarted) listOf("🥇", "🥈", "🥉")[i] else "🏁", fontSize = if (i == 0) 20.sp else 14.sp)
                        PodiumAvatar(e)
                        Text(
                            e.username, fontSize = 10.sp, fontWeight = FontWeight.Black,
                            color = if (e.isMe) FriendsPink.solid else FriendsPink.ink,
                            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 80.dp),
                        )
                        Text("${fmtPts(e.pts)} pts", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label)
                    }
                }
            }
            if (standings.size > 3) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth().padding(top = 2.dp, start = 8.dp, end = 8.dp),
                ) {
                    standings.drop(3).forEachIndexed { i, e ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth().clickableNoRipple { onOpenProfile(e.id) },
                        ) {
                            Text(
                                ordinal(i + 4), fontSize = 10.sp, fontWeight = FontWeight.Black, color = FriendsPink.label,
                                fontFamily = Nunito, modifier = Modifier.width(28.dp), textAlign = TextAlign.End,
                            )
                            Text(
                                e.username, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                                color = if (e.isMe) FriendsPink.solid else FriendsPink.ink,
                                fontFamily = Nunito, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                            )
                            Text("${fmtPts(e.pts)} pts", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, fontFamily = Nunito)
                        }
                    }
                }
            }
            if (!raceStarted) {
                Text(
                    "Race resets Mondays — first daily takes the lead.",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, fontFamily = Nunito,
                )
            }
        }
    }
}

// ── YOUR FRIENDS ───────────────────────────────────────────────────────────

@Composable
private fun YourFriendsSection(
    friends: List<FriendsService.FriendProfile>,
    nowMs: Long,
    version: Int,
    challengingId: String?,
    canGift: Boolean,
    onOpenProfile: (String) -> Unit,
    onPlay: (FriendsService.FriendProfile) -> Unit,
    onChallenge: (FriendsService.FriendProfile) -> Unit,
    onTaunt: (FriendsService.FriendProfile) -> Unit,
    onUnfriend: (FriendsService.FriendProfile) -> Unit,
    onNote: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var menuTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    // §216: the week's leader wears the crown — only once someone scored.
    val crownId = remember(version) {
        val me = FriendsService.meDigest?.weekPoints ?: 0
        val top = friends.maxByOrNull { it.weekPoints ?: 0 }
        top?.takeIf { (it.weekPoints ?: 0) > 0 && (it.weekPoints ?: 0) > me }?.id
    }
    val sweepSize = com.wordocious.app.ModeGen.sweep.size
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FriendsLabel(if (friends.isEmpty()) "YOUR FRIENDS" else "YOUR FRIENDS · ${friends.size}")
            Spacer(Modifier.weight(1f))
            val slackers = friends.filter { it.playedToday == 0 && !isNewFriend(it) }
            if (slackers.isNotEmpty()) {
                Text(
                    "Nudge all who haven't played", fontSize = 11.sp, fontWeight = FontWeight.Black, color = FriendsPink.solid, maxLines = 1,
                    modifier = Modifier.clickableNoRipple {
                        scope.launch {
                            var n = 0
                            for (f in slackers) {
                                if (FriendsService.taunt(f.id, "slowpoke", com.wordocious.app.todayLocalDate()) == FriendsService.TauntOutcome.SENT) n++
                            }
                            onNote(if (n > 0) "Nudged $n friend${if (n == 1) "" else "s"} 🔔" else "Everyone already nudged today")
                        }
                    },
                )
            }
        }
        if (friends.isEmpty()) {
            Column(Modifier.fillMaxWidth().friendsCard().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                // No friends yet: I's invite scene above the line (ART_SPEC §7).
                SceneEmptyState(SceneArt.INVITE, Mascots.addFriendLine, height = 120.dp, color = FriendsPink.sub)
                Text(
                    "1. Add friends below by username, or from the Add Friend button on any player's profile.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub, fontFamily = Nunito,
                )
                Text("2. Requests you send and receive land right here.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub, fontFamily = Nunito)
                Text(
                    "3. Then race them every day, and play Rock Paper Scissors, Tic-Tac-Tile and more.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub, fontFamily = Nunito,
                )
            }
            return@Column
        }
        Column(Modifier.fillMaxWidth().friendsCard().padding(vertical = 4.dp)) {
            friends.sortedWith(compareByDescending<FriendsService.FriendProfile> { it.isOnline(nowMs) }.thenBy { it.username.lowercase() })
                .forEachIndexed { idx, f ->
                    if (idx > 0) Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).background(Color(0xFFF3F0FF)))
                    val on = f.isOnline(nowMs)
                    val played = f.playedToday ?: 0
                    Box {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                                .combinedClickableNoRipple(onLongClick = { menuTarget = f }, onClick = { onOpenProfile(f.id) })
                                .padding(horizontal = 12.dp, vertical = 9.dp),
                        ) {
                            FriendFace(f.username, f.avatarUrl, f.avatarEmoji, 38.dp, online = on)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(
                                        buildAnnotatedString {
                                            append("@${f.username}")
                                            if (f.id == crownId) { append(" "); appendIcon3D(Icon3DName.CROWN) }
                                        },
                                        fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.ink,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                                        inlineContent = icon3DInline(),
                                    )
                                    if ((f.flawlessStreak ?: 0) >= 2) MiniChip("×${f.flawlessStreak}", Color(0xFFB45309), Color(0xFFF59E0B), Icon3DName.TROPHY)
                                    friendversary(f)?.let { MiniChip("🎉 $it DAYS", FriendsPink.solid, FriendsPink.solid) }
                                    if (isNewFriend(f)) MiniChip("NEW", PURPLE, PURPLE)
                                }
                                val line = presenceLine(f.lastSeenMs, f.activity, nowMs)
                                    ?: if (played > 0) "$played/$sweepSize today" else "Hasn't played today"
                                Text(
                                    line, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                    color = if (on) FriendsPink.green else FriendsPink.label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                )
                            }
                            (f.friendStreak ?: 0).takeIf { it > 0 }?.let { FlameCount("$it") }
                            when {
                                on -> PinkPill("Play", solid = true) { onPlay(f) }
                                played > 0 || (f.todayPoints ?: 0) > 0 -> PinkPill(
                                    if (challengingId == f.id) "Sending…" else "Challenge", solid = false,
                                    enabled = challengingId == null,
                                ) { onChallenge(f) }
                                else -> PinkPill("Nudge", solid = false) { onTaunt(f) }
                            }
                        }
                        // §225: long-press menu — profile / taunt / challenge / gift / unfriend.
                        DropdownMenu(expanded = menuTarget?.id == f.id, onDismissRequest = { menuTarget = null }) {
                            MenuItem("View profile") { menuTarget = null; onOpenProfile(f.id) }
                            MenuItem("Taunt") { menuTarget = null; onTaunt(f) }
                            MenuItem("Play a game", FriendsPink.solid) { menuTarget = null; onPlay(f) }
                            MenuItem("Challenge ⚔️", Color(0xFFEC4899)) { menuTarget = null; onChallenge(f) }
                            if (canGift) {
                                MenuItem("Gift a shield", Color(0xFF0D9488), Icon3DName.SHIELD) {
                                    menuTarget = null
                                    scope.launch {
                                        when (val r = FriendsService.giftShield(f.id)) {
                                            is FriendsService.GiftOutcome.Sent -> {
                                                onNote("${SHIELD_NOTE}Shield sent to ${f.username} · ${r.shieldsLeft} left")
                                                AuthService.refreshProfile()
                                            }
                                            is FriendsService.GiftOutcome.Failed -> onNote(r.message)
                                        }
                                    }
                                }
                            }
                            MenuItem("Unfriend", Color(0xFFDC2626)) { menuTarget = null; onUnfriend(f) }
                        }
                    }
                }
        }
    }
}

/** The gift note's marker: the note row swaps it for the 3D shield. */
private const val SHIELD_NOTE = "🛡️ "

@Composable
private fun MiniChip(text: String, ink: Color, tint: Color, icon3d: Icon3DName? = null) {
    Row(
        Modifier.clip(RoundedCornerShape(4.dp)).background(tint.copy(alpha = 0.13f)).padding(horizontal = 4.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (icon3d != null) Icon3D(icon3d, 11.dp)
        Text(text, fontSize = 8.sp, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito, maxLines = 1)
    }
}

@Composable
private fun MenuItem(text: String, color: Color = Color.Unspecified, icon3d: Icon3DName? = null, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(text, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = Nunito, color = color) },
        onClick = onClick,
        leadingIcon = icon3d?.let { { Icon3D(it, 20.dp) } },
    )
}

// ── Add by username + share link ───────────────────────────────────────────

@Composable
private fun AddFriendSection(modifier: Modifier, focus: FocusRequester, onNote: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var username by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var sharingInvite by remember { mutableStateOf(false) }
    // Typeahead (Aug 11): 2+ letters → matching users, so invites go to the right Carlie.
    var suggestions by remember { mutableStateOf<List<FriendsService.FriendProfile>>(emptyList()) }
    LaunchedEffect(username) {
        val q = username.trim().trimStart('@')
        if (q.length < 2) { suggestions = emptyList(); return@LaunchedEffect }
        delay(250)
        suggestions = FriendsService.search(q).filter { !FriendsService.isFriend(it.id) && !FriendsService.hasRequested(it.id) }
    }
    fun add() {
        val name = username.trim().trimStart('@')
        if (name.isEmpty() || sending) return
        sending = true
        scope.launch {
            when (val r = FriendsService.request(username = name)) {
                is FriendsService.RequestOutcome.Accepted -> { onNote("You're now friends! 🎉"); username = "" }
                is FriendsService.RequestOutcome.Pending -> { onNote("Request sent 🤝"); username = "" }
                is FriendsService.RequestOutcome.Failed -> onNote(r.message)
            }
            sending = false
        }
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FriendsLabel("ADD A FRIEND")
        Column(Modifier.fillMaxWidth().friendsCard().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = username, onValueChange = { username = it },
                    placeholder = { Text("Add by username", fontSize = 12.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                    modifier = Modifier.weight(1f).focusRequester(focus),
                )
                PinkPill(if (sending) "…" else "Add", solid = true, enabled = !sending && username.trim().isNotEmpty()) { add() }
            }
            suggestions.forEach { u ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(FriendsPink.page)
                        .clickableNoRipple {
                            if (sending) return@clickableNoRipple
                            sending = true
                            suggestions = emptyList()
                            scope.launch {
                                when (val r = FriendsService.request(addresseeId = u.id)) {
                                    is FriendsService.RequestOutcome.Accepted -> { onNote("You're now friends! 🎉"); username = "" }
                                    is FriendsService.RequestOutcome.Pending -> { onNote("Request sent to ${u.username} 🤝"); username = "" }
                                    is FriendsService.RequestOutcome.Failed -> onNote(r.message)
                                }
                                sending = false
                            }
                        }
                        .padding(horizontal = 10.dp, vertical = 7.dp),
                ) {
                    FriendAvatar(u)
                    Text(u.username, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.ink, maxLines = 1, modifier = Modifier.weight(1f))
                    Text("Lvl ${u.level}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label)
                }
            }
            // §225/§289: the share link covers the "get them on the app" direction.
            Row(
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.alpha(if (sharingInvite) 0.55f else 1f).clickableNoRipple {
                    val myId = AuthService.userId ?: return@clickableNoRipple
                    val myName = AuthService.profile.value?.username ?: return@clickableNoRipple
                    if (sharingInvite) return@clickableNoRipple
                    sharingInvite = true
                    scope.launch {
                        try {
                            var text = "Add me on Wordocious — I'm $myName\nhttps://wordocious.com/profile/$myId"
                            if (AuthService.isProActive) {
                                val now = java.time.Instant.now()
                                val open = com.wordocious.app.data.ReferralService.myInvites().firstOrNull { r ->
                                    r.status == "pending" && (AuthService.parseTimestamp(r.expiresAt)?.isAfter(now) ?: false)
                                }
                                if (open != null) {
                                    text = "I'm gifting you 7 days of Wordocious Pro — add me once you're in: $myName\nhttps://wordocious.com/join/${open.code}"
                                }
                            }
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, text)
                            }
                            context.startActivity(Intent.createChooser(send, null))
                        } finally { sharingInvite = false }
                    }
                },
            ) {
                Icon3D(Icon3DName.SHARE, 17.dp, contentDescription = null, modifier = Modifier)
                Text("Share invite link", fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.solid, fontFamily = Nunito)
            }
        }
    }
}

// ── Taunt picker ───────────────────────────────────────────────────────────

@Composable
private fun TauntDialog(target: FriendsService.FriendProfile, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<String?>(null) }
    androidx.compose.ui.window.Dialog(onDismissRequest = onDone) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White)) {
            Text(
                "NUDGE ${target.username.uppercase()}",
                fontSize = 11.sp, fontWeight = FontWeight.Black, color = FriendsPink.label, letterSpacing = 1.2.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            )
            PanelDivider()
            val s = status
            if (s != null) {
                Text(
                    s, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.ink, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                )
            } else {
                com.wordocious.app.data.FriendTaunts.ALL.forEach { taunt ->
                    Text(
                        taunt.text, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.ink,
                        modifier = Modifier.fillMaxWidth().clickableNoRipple {
                            scope.launch {
                                status = when (FriendsService.taunt(target.id, taunt.id, com.wordocious.app.todayLocalDate())) {
                                    FriendsService.TauntOutcome.SENT -> "Sent 😈"
                                    FriendsService.TauntOutcome.ALREADY_SENT -> "Already nudged them today"
                                    FriendsService.TauntOutcome.FAILED -> "Could not send"
                                }
                                delay(1400)
                                onDone()
                            }
                        }.padding(horizontal = 16.dp, vertical = 13.dp),
                    )
                    PanelDivider()
                }
                Text(
                    "Cancel", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.label, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().clickableNoRipple(onDone).padding(vertical = 13.dp),
                )
            }
        }
    }
}

// §225: tap opens the profile, long-press opens the row menu.
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Modifier.combinedClickableNoRipple(onLongClick: () -> Unit, onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    return this.combinedClickable(interactionSource = interaction, indication = null, onLongClick = onLongClick, onClick = onClick)
}

/** §238: "1,504" — US-grouped points for the race surfaces. */
private fun fmtPts(n: Int): String = String.format(java.util.Locale.US, "%,d", n)

/** §238: "Aug 10–16" — the local Mon–Sun range k+1 Mondays back. */
private fun pastWeekLabel(k: Int): String {
    val mon = java.time.LocalDate.now()
        .minusDays(((java.time.LocalDate.now().dayOfWeek.value - 1) + 7L * (k + 1)))
    val sun = mon.plusDays(6)
    val f = java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)
    return "${mon.format(f)}–${sun.format(f)}"
}

/** "2d" / "5h" / "now" — how long a sent invite has been waiting (§212). */
private fun agoShort(iso: String?): String {
    val t = parseIsoMs(iso) ?: return ""
    val h = ((System.currentTimeMillis() - t) / 3_600_000L).toInt()
    return when {
        h < 1 -> "now"
        h < 24 -> "${h}h"
        else -> "${h / 24}d"
    }
}

private fun withinDay(iso: String?): Boolean {
    val t = parseIsoMs(iso) ?: return false
    return System.currentTimeMillis() - t < 24 * 60 * 60 * 1000L
}

private fun parseIsoMs(iso: String?): Long? {
    if (iso == null) return null
    return runCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
        .recoverCatching { java.time.Instant.parse(iso).toEpochMilli() }
        .getOrNull()
}

@Composable
private fun PanelDivider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF3F0FF)))
}

internal data class PodiumEntry(
    val id: String, val username: String, val avatarUrl: String?,
    val avatarEmoji: String?, val pts: Int, val isMe: Boolean,
    /** §20 letter tile: initials + accent come from the real profile, not the "You" label. */
    val avatarName: String = username, val accentHex: String? = null,
)

@Composable
private fun PodiumAvatar(e: PodiumEntry) {
    FriendFace(e.avatarName, e.avatarUrl, e.avatarEmoji, 36.dp, online = false, ring = if (e.isMe) FriendsPink.solid else null, accentHex = e.accentHex)
}

// FRIENDS row (§207 Tier 3) — the compact card on the OWN profile screen
// pointing at the Friends tab: Users icon, gradient FRIENDS, count, red pending
// pill, chevron.
@Composable
fun FriendsRowLink(onOpen: () -> Unit) {
    if (AuthService.userId == null) return

    var version by remember { mutableIntStateOf(FriendsService.version) }
    DisposableEffect(Unit) {
        val remove = FriendsService.addListener { version = FriendsService.version }
        onDispose { remove() }
    }
    LaunchedEffect(Unit) { FriendsService.load() }
    val friendCount = remember(version) { FriendsService.friends.size }
    val pending = remember(version) { FriendsService.incoming.size }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(WTheme.surface, RoundedCornerShape(20.dp))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
            .clickableNoRipple(onOpen)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.People, null, tint = PURPLE, modifier = Modifier.size(16.dp))
        Text(
            "FRIENDS",
            fontSize = 15.sp, fontWeight = FontWeight.Black,
            style = TextStyle(brush = Brush.linearGradient(listOf(PURPLE, Color(0xFFEC4899))), fontFamily = Nunito),
        )
        if (friendCount > 0) {
            Text("$friendCount", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        Spacer(Modifier.weight(1f))
        if (pending > 0) {
            Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0xFFEF4444)).padding(horizontal = 7.dp, vertical = 2.dp)) {
                Text(
                    if (pending == 1) "1 request" else "$pending requests",
                    fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, fontFamily = Nunito,
                )
            }
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp))
    }
}

/** Accepted within the last 24h — wears the NEW chip (Tier 2, Aug 11). */
private fun isNewFriend(f: FriendsService.FriendProfile): Boolean {
    val t = parseIsoMs(f.since) ?: return false
    return System.currentTimeMillis() - t < 24 * 60 * 60 * 1000L
}

/** §216: friendship age in days when today is a milestone (7/30/100/365). */
private fun friendversary(f: FriendsService.FriendProfile): Int? {
    val t = parseIsoMs(f.since) ?: return null
    val days = ((System.currentTimeMillis() - t) / 86_400_000L).toInt()
    return if (days in listOf(7, 30, 100, 365)) days else null
}

// Shared with TodaysRace.kt / ActivityFeed.kt (§289/§290) — one avatar idiom.
@Composable
internal fun FriendAvatar(f: FriendsService.FriendProfile, accentHex: String? = null) {
    val url = f.avatarUrl?.takeIf { it.isNotBlank() }
    if (url == null) {
        // ART_SPEC §20: no photo → the letter tile.
        LetterTileAvatar(f.username, 32.dp, accentHex = accentHex, emoji = f.avatarEmoji)
        return
    }
    coil.compose.AsyncImage(
        model = url, contentDescription = f.username,
        modifier = Modifier.size(32.dp).clip(CircleShape),
        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
    )
}

/** "ends Sunday · 2d 04:12:09" — the weekly race's live clock (weeks run Mon-Sun, reset Monday 00:00 local). */
@Composable
private fun WeekEndsCountdown() {
    val hidden = LocalTabHidden.current
    val label by produceState(weekEndsLabel()) {
        while (true) { delay(1_000); hidden.awaitShown(); value = weekEndsLabel() }
    }
    Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, fontFamily = Nunito)
}

private fun weekEndsLabel(): String {
    val now = java.time.LocalDateTime.now()
    val end = now.toLocalDate().plusDays((8 - now.dayOfWeek.value).toLong()).atStartOfDay()
    val secs = java.time.Duration.between(now, end).seconds.coerceAtLeast(0)
    val d = secs / 86400
    val clock = String.format(java.util.Locale.US, "%02d:%02d:%02d", (secs % 86400) / 3600, (secs % 3600) / 60, secs % 60)
    return if (d >= 1) "ends Sunday · ${d}d $clock" else "ends tonight · $clock"
}
