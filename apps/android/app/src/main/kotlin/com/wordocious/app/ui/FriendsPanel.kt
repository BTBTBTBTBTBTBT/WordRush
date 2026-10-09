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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.em
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendlyGamesService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.friends.FlameCount
import com.wordocious.app.ui.friends.FriendCardsSection
import com.wordocious.app.ui.friends.buildFriendsLayout
import com.wordocious.app.ui.friends.FriendFace
import com.wordocious.app.ui.friends.FriendlyGameGlyph
import com.wordocious.app.ui.friends.FriendlyGameIcon
import com.wordocious.app.ui.friends.FriendsBannerView
import com.wordocious.app.ui.friends.FriendsLabel
import com.wordocious.app.ui.friends.FriendsNotice
import com.wordocious.app.ui.friends.FriendsPink
import com.wordocious.app.ui.friends.FRIENDS_CARD_ACCENT
import com.wordocious.app.ui.friends.friendsLine
import com.wordocious.app.ui.friends.friendsWash
import com.wordocious.app.ui.friends.QuickPlayRequest
import com.wordocious.app.ui.friends.QuickPlaySheet
import com.wordocious.app.ui.friends.color
import com.wordocious.app.ui.friends.friendsCard
import com.wordocious.app.ui.friends.sub
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FRIENDLY_KINDS
import com.wordocious.core.FriendCards
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
    /** BI23: the guest pitch's "Play without an account" → the Home root. */
    onGoHome: (() -> Unit)? = null,
    /** BI23: the guest pitch's SIGN IN — the same sign-in sheet as the AppHeader's. */
    onSignIn: (() -> Unit)? = null,
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
    // 2.8 wave 3 (item 9): the friend ⋯ / long-press family menu, and the resign confirm it opens.
    var menuFriend by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    var resignTarget by remember { mutableStateOf<FriendlyGamesService.GameView?>(null) }
    val scope = rememberCoroutineScope()
    val addRequester = remember { BringIntoViewRequester() }
    val addFocus = remember { FocusRequester() }
    // FINISH_SPEC T1 / T3: the invite-sent card (a request now pending, in Add a friend)
    // and the NEW FRIENDS card (a request accepted — theirs by you, yours by them, or a
    // mutual add).
    var requestSentTo by remember { mutableStateOf<String?>(null) }
    var newFriend by remember { mutableStateOf<NewFriend?>(null) }
    val context = LocalContext.current
    // T3, the inviter's side: watch my outgoing requests (per account, across launches);
    // one that turns into a friend gets the NEW FRIENDS card once.
    LaunchedEffect(version, myProfile?.id) {
        val uid = myProfile?.id ?: return@LaunchedEffect
        if (!FriendsService.loaded) return@LaunchedEffect
        val prefs = context.getSharedPreferences(INVITE_WATCH_PREFS, android.content.Context.MODE_PRIVATE)
        val key = "watch_friend_requests_$uid"
        val t = InviteScreens.trackRequests(
            InviteScreens.parseWatched(prefs.getString(key, null)),
            FriendsService.outgoing, FriendsService.friends.map { it.id },
        )
        prefs.edit().putString(key, InviteScreens.formatWatched(t.watch)).apply()
        if (newFriend == null) {
            t.accepted.firstNotNullOfOrNull { id -> FriendsService.friends.firstOrNull { it.id.equals(id, ignoreCase = true) } }
                ?.let { newFriend = NewFriend.of(it) }
        }
    }

    // The existing free live VS challenge (§289): a private Classic battle, pushed to the friend.
    fun challenge(f: FriendsService.FriendProfile) {
        if (challenging != null) return
        challenging = f.id
        scope.launch {
            try {
                when (val r = FriendsService.challenge(f.id, "DUEL")) {
                    is FriendsService.ChallengeOutcome.Sent -> {
                        note = "Challenge sent to ${f.username}!"
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

    // One card per friend (core FriendCards): online friends and friends with games; everyone else in All friends.
    val cardsLayout = remember(friends, games, now / 20_000L) { buildFriendsLayout(friends, games, now) }

    if (!signedIn) {
        // FINISH_SPEC BI23: guests get a finished signed-out state (no empty skeleton list, no
        // add-by-username card): the FRIENDS title art, then O1 + I as a duo, the headline,
        // one line and the candy SIGN IN, centered under the pinned AppHeader.
        Column(
            Modifier.fillMaxSize().pageBackground(PageTint.FRIENDS, alwaysLight = true)
                .padding(horizontal = 16.dp).padding(top = 12.dp),
        ) {
            PageHeadline(TitleArt.FRIENDS, Modifier.fillMaxWidth())
            GuestPitch(
                hosts = listOf(Mascots.friends, Mascots.addFriends), title = "Play with friends", heading = Heading.PLAYWITHFRIENDS,
                subtitle = "Sign in to add friends, race them every day and play pocket games together.",
                colors = GuestPitchContent.friendsColors, preview = GuestPreview.None,
                onSignIn = { onSignIn?.invoke() ?: AuthService.exitGuest() }, onPlay = onGoHome,
                modifier = Modifier.weight(1f), subColor = FriendsPink.sub,
            )
        }
        return
    }
    val friendsScroll = rememberScrollState()
    ScrollToTopOnReselect(friendsScroll) // AJ: a re-tap of Friends scrolls to the top.
    Column(
        Modifier.fillMaxSize().pageBackground(PageTint.FRIENDS, alwaysLight = true)
            .verticalScroll(friendsScroll)
            .padding(horizontal = 16.dp, vertical = 10.dp).padding(bottom = TAB_CONTENT_BOTTOM_PAD), // AS3
        // BJ7: 12 between sections (was 16).
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // 1. The FRIENDS headline (FINISH_SPEC A6 / C4b / N1): the FRIENDS lettering as a
        // calm centered headline (PageHeadline sizes it), nothing beside it. The bell moved into Settings ›
        // Notifications; "Add a friend" is a candy button in the YOUR FRIENDS header.
        PageHeadline(TitleArt.FRIENDS, Modifier.fillMaxWidth())
        // K1: the note as a notice card — springs in, squishes, taps or swipes away.
        FriendsNotice(note, onDismiss = { note = null })

        // 9f: the branded Invites row and ONE obvious "Have a code?" button (both hide themselves when
        // branded_invites is off). Accepting hands the code to the same DeepLinkRouter state the app links use,
        // so MainScreen opens the private match / the race exactly like a tapped link.
        val inviteUriHandler = androidx.compose.ui.platform.LocalUriHandler.current
        InvitesRow(onAccept = { item ->
            if (item.variant == com.wordocious.core.InviteRowItem.Variant.RACE) {
                com.wordocious.app.data.DeepLinkRouter.vsChallenge.value = item.code
            } else {
                runCatching { com.wordocious.core.GameMode.valueOf(item.gameMode) }.getOrNull()?.let { com.wordocious.app.data.DeepLinkRouter.vsInvite.value = it to item.code }
            }
        })
        HaveACodeButton(color = CandyColor.PINK, onResolved = { r ->
            when (r) {
                is HaveACodeResult.Race -> com.wordocious.app.data.DeepLinkRouter.vsChallenge.value = r.code
                is HaveACodeResult.Live -> com.wordocious.app.data.DeepLinkRouter.vsInvite.value = r.mode to r.code
                is HaveACodeResult.Friend -> inviteUriHandler.openUri("https://wordocious.com/join/${r.code}")
            }
        })

        // 2. The Friends banner (the race, told once: the pills; the countdown small in its header)
        FriendsBannerView(
            friends = friends, rows = raceRows, nowMs = now,
            onRace = { if (friends.isNotEmpty()) showRace = true },
        )

        // 4. One card per friend (item 9 / 9e): online friends first, each with their living mascot, the games
        // waiting on you as a strip of tiles (tap = straight into that game); their-turn games collapse.
        FriendCardsSection(
            layout = cardsLayout, friends = friends,
            onOpenGame = onOpenGame,
            onPlayWith = { quickPlay = QuickPlayRequest(it.id) },
            onMenu = { menuFriend = it },
        )

        // 5. PLAY WITH FRIENDS
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                FriendsLabel("PLAY WITH FRIENDS")
                Spacer(Modifier.weight(1f))
                FriendsLabel("TAP A GAME, PICK A FRIEND")
            }
            // Six games, 3 across × 2 rows (§9); each row's cards share one height. C4: each a
            // small card tinted in its own color with its own top bar.
            FRIENDLY_KINDS.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { k ->
                        PocketGameCard(k, Modifier.weight(1f).fillMaxHeight()) {
                            if (friends.isEmpty()) {
                                note = "Add a friend first — then pick a game"
                                scope.launch { addRequester.bringIntoView() }
                            } else quickPlay = QuickPlayRequest(null, k, kindChosen = true)
                        }
                    }
                }
            }
        }

        // 6. THIS WEEK'S RACE
        if (friends.isNotEmpty()) WeeklyRaceSection(version, onOpenProfile)

        // T3: NEW FRIENDS! — the high-five, both avatars, Challenge them / See friends.
        newFriend?.let { nf ->
            val f = friends.firstOrNull { (nf.id != null && it.id.equals(nf.id, ignoreCase = true)) || it.username.equals(nf.person.name, ignoreCase = true) }
            val me = myProfile
            NewFriendsCard(
                me = InvitePerson(me?.username ?: "You", me?.avatarUrl, me?.avatarEmoji, me?.accentColor, userId = me?.id),
                friend = nf.person,
                onSeeFriends = { newFriend = null },
                // The existing challenge path (a private Classic VS battle, pushed to the friend).
                onChallenge = f?.let { { newFriend = null; challenge(it) } },
                light = true,
            )
        }

        // 7. YOUR FRIENDS
        YourFriendsSection(
            friends = friends, nowMs = now, version = version, challengingId = challenging,
            restNames = if (cardsLayout.cards.isEmpty()) null else cardsLayout.rest,
            onOpenProfile = onOpenProfile,
            onPlay = { quickPlay = QuickPlayRequest(it.id) },
            onChallenge = { challenge(it) },
            onTaunt = { tauntTarget = it },
            onMenu = { menuFriend = it },
            onNote = { note = it },
            // C4b: the old header add-friend circle's flow — jump to Add by username and focus it.
            onAdd = {
                // Back from the invite-sent card to the field first (T1), then focus it.
                val wasSent = requestSentTo != null
                requestSentTo = null
                scope.launch { if (wasSent) delay(60); addRequester.bringIntoView(); runCatching { addFocus.requestFocus() } }
            },
        )

        // INVITES (only while something is pending) — under YOUR FRIENDS (founder 2026-10-01).
        if (incoming.isNotEmpty() || outgoing.isNotEmpty()) {
            InvitesSection(
                incoming, outgoing, onOpenProfile,
                // A7: the invite-sent art shows once — not while Add a friend wears it.
                showArt = requestSentTo == null,
                onAccepted = { newFriend = NewFriend.of(it) },
            )
        }

        // 8. MOMENTS
        ActivityFeed(onOpenProfile = onOpenProfile, onRematch = { kind, friendId -> quickPlay = QuickPlayRequest(friendId, kind, kindChosen = true) })

        // 9. Add by username + share link, then the gift-Pro panel.
        AddFriendSection(
            Modifier.bringIntoViewRequester(addRequester), addFocus,
            sentTo = requestSentTo,
            onSent = { requestSentTo = it },
            onSentDone = { requestSentTo = null },
            onNewFriend = { name, id ->
                val f = friends.firstOrNull { (id != null && it.id.equals(id, ignoreCase = true)) || it.username.equals(name, ignoreCase = true) }
                newFriend = f?.let { NewFriend.of(it) } ?: NewFriend(id, InvitePerson(name, userId = id))
            },
        ) { note = it }
        InvitePanel()
        // The tab sits under the BottomNav — clear it so the last card's tail is reachable.
        Spacer(Modifier.height(84.dp))
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
        // A1: a pink-tinted sheet (no white).
        SoftModalSheet(onDismissRequest = { showRace = false }, sheetState = sheetState, containerColor = FRIENDS_SHEET) {
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PageTitleText("TODAY’S RACE", accent = PageAccent.friends, fontSize = 17.sp)
                Column(Modifier.fillMaxWidth().friendsCard(16.dp, bar = FRIENDS_CARD_ACCENT).padding(start = 12.dp, end = 12.dp, top = 14.dp, bottom = 10.dp)) {
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

    // The friend ⋯ / long-press family menu (profile, play a game, taunt, challenge, gift, resign a game, unfriend).
    menuFriend?.let { f ->
        FriendMenuHost(
            f = f, nowMs = now, canGift = (myProfile?.streakShields ?: 0) > 0, challengingId = challenging,
            games = games.filter { it.opponent.id == f.id },
            onDismiss = { menuFriend = null },
            onOpenProfile = onOpenProfile,
            onPlay = { quickPlay = QuickPlayRequest(it.id) },
            onTaunt = { tauntTarget = it },
            onChallenge = { challenge(it) },
            onUnfriend = { unfriendTarget = it },
            onResign = { resignTarget = it },
            onNote = { note = it },
        )
    }

    // Resign confirm: Resign lives here now, not inside the game (item 9).
    resignTarget?.let { g ->
        AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth,
            onDismissRequest = { resignTarget = null },
            containerColor = FRIENDS_SHEET,
            title = { Text("Resign ${g.title}?", fontWeight = FontWeight.Black, fontFamily = Nunito, color = FriendsPink.heading) },
            text = { Text("${g.opponent.username} wins this game. You can start another any time.", fontFamily = Nunito, fontWeight = FontWeight.Bold, color = FriendsPink.muted) },
            confirmButton = {
                CastButton("Resign", onClick = {
                    val id = g.id
                    resignTarget = null
                    scope.launch { FriendlyGamesService.resign(id); FriendlyGamesService.load() }
                }, color = CastColor.PINK, size = CastSize.M)
            },
            dismissButton = {
                CastButton("Keep playing", onClick = { resignTarget = null }, color = CastColor.SLATE, size = CastSize.M)
            },
        )
    }

    // Unfriend confirm (§225).
    unfriendTarget?.let { target ->
        AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { unfriendTarget = null },
            containerColor = FRIENDS_SHEET,
            title = { Text("Unfriend ${target.username}?", fontWeight = FontWeight.Black, fontFamily = Nunito, color = FriendsPink.heading) },
            text = { Text("You can re-add them anytime.", fontFamily = Nunito, fontWeight = FontWeight.Bold, color = FriendsPink.muted) },
            confirmButton = {
                CastButton("Unfriend", onClick = {
                    val id = target.id
                    unfriendTarget = null
                    scope.launch { FriendsService.remove(id); FriendsService.load(force = true) }
                }, color = CastColor.PINK, size = CastSize.M)
            },
            dismissButton = {
                CastButton("Keep", onClick = { unfriendTarget = null }, color = CastColor.SLATE, size = CastSize.M)
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
    showArt: Boolean = true,
    onAccepted: (FriendsService.FriendProfile) -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    var inviteNote by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(inviteNote) { if (inviteNote != null) { delay(2_500); inviteNote = null } }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.padding(start = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FriendsLabel("INVITES")
            // M: requests waiting on you wear the tab's candy count badge; sent ones the soft count.
            if (incoming.isNotEmpty()) FriendsCountBadge(incoming.size, arrivals = 0, pulsing = false, height = 16.dp)
            else CountPill(outgoing.size)
        }
        // T2: each request received is its own pink card — the sender's tile over I tossing
        // the envelope (the art once per screen, A7), "<Name> wants to be friends!", the soft
        // Decline and the Accept candy (TEAL: FinishKit has no green candy). Accepting opens
        // the NEW FRIENDS card (T3).
        incoming.forEachIndexed { i, r ->
            InviteReceivedCard(
                inviter = InvitePerson(r.username, r.avatarUrl, r.avatarEmoji, userId = r.id),
                onAccept = { scope.launch { if (FriendsService.accept(r.id)) onAccepted(r) } },
                onDecline = { scope.launch { FriendsService.decline(r.id) } },
                modifier = Modifier.fillMaxWidth(),
                showArt = showArt && i == 0,
                onOpenProfile = { onOpenProfile(r.id) },
                light = true,
            )
        }
        if (outgoing.isNotEmpty()) {
            Column(
                Modifier.fillMaxWidth().friendsCard(16.dp, bar = FRIENDS_CARD_ACCENT).padding(start = 12.dp, end = 12.dp, top = 14.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FriendsLabel("SENT — WAITING")
                outgoing.forEach { r ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            Modifier.weight(1f).squishClickable(label = "@${r.username}, pending, sent ${agoShort(r.requestedAt)}, open profile") { onOpenProfile(r.id) },
                            verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            FriendAvatar(r)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "@${r.username}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                                )
                                // T1: a small "Pending" glossy pill on the request-pending row.
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    PendingPill()
                                    Text(agoShort(r.requestedAt), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted, maxLines = 1)
                                }
                            }
                        }
                        // §212: the invite usually died unseen — re-push, 1/24h.
                        val reminded = withinDay(r.remindedAt)
                        CastButton(
                            if (reminded) "Reminded" else "Remind",
                            onClick = {
                                scope.launch {
                                    inviteNote = when (FriendsService.remind(r.id)) {
                                        FriendsService.RemindOutcome.REMINDED -> "Reminder sent to ${r.username}!"
                                        FriendsService.RemindOutcome.ALREADY -> "Already reminded today"
                                        FriendsService.RemindOutcome.FAILED -> "Could not remind"
                                    }
                                }
                            },
                            color = CastColor.GOLD, size = CastSize.S, enabled = !reminded,
                        )
                        CandyButton(
                            "Cancel", onClick = { scope.launch { FriendsService.decline(r.id) } },
                            color = CandyColor.PEACH, size = CandySize.SMALL, contentDescription = "Cancel request to ${r.username}",
                        )
                    }
                }
                inviteNote?.let {
                    Text(
                        it, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.sub,
                        modifier = Modifier.squishClickable(label = null) { inviteNote = null },
                    )
                }
            }
        }
    }
}

/** T3 the friend the NEW FRIENDS card celebrates ([id] null = known by name only). */
private data class NewFriend(val id: String?, val person: InvitePerson) {
    companion object {
        fun of(f: FriendsService.FriendProfile) = NewFriend(f.id, InvitePerson(f.username, f.avatarUrl, f.avatarEmoji, userId = f.id))
    }
}

/** T3 where the inviter's watched outgoing requests live (SharedPreferences). */
private const val INVITE_WATCH_PREFS = "wordocious_invites"

// ── THIS WEEK'S RACE ───────────────────────────────────────────────────────

/** C4 the weekly race card's gold (stats-friends-polish: #fff7ec / #f8e2c4, bar #f5a524 → #ffd166). */
private val RACE_GOLD = Color(0xFFF59E0B)
private val RACE_INK = Color(0xFF8A4A12)

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
    val dark = WTheme.isDark
    val ink = if (dark) WTheme.text else RACE_INK
    val sub = if (dark) WTheme.textMuted else FriendsPink.muted

    // C4: this week's race on a gold card with the Leaderboard's medal podium.
    TintedCard(
        RACE_GOLD, Modifier.fillMaxWidth(),
        bar = Brush.horizontalGradient(listOf(Color(0xFFF5A524), Color(0xFFFFD166))),
        tint = if (dark) WTheme.surface else Color(0xFFFFF7EC),
        line = if (dark) WTheme.border else Color(0xFFF8E2C4),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FriendsLabel("THIS WEEK’S RACE", Modifier.weight(1f, fill = false), color = ink)
            Spacer(Modifier.weight(1f))
            WeekEndsCountdown(ink)
            if (raceStarted) {
                // A3: the bare 3D share icon with the squish.
                SoftControl(
                    Icon3DName.SHARE, contentDescription = "Share weekly race",
                    onClick = {
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
                    iconSize = 20.dp, alpha = if (sharingRace) 0.4f else 1f,
                )
            }
        }
        // §294 (D3.3) — the Sunday finish, settled server-side.
        val lastWeekResult = remember(version) { FriendsService.lastWeek }
        lastWeekResult?.let { r ->
            val win = r.rank == 1
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
                    .tintedPill(if (win) RACE_GOLD else FRIENDS_CARD_ACCENT)
                    .padding(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 6.dp),
            ) {
                if (win) Icon3D(Icon3DName.CROWN, 22.dp) else GlyphArtImage(GlyphArt.medal(r.rank) ?: GlyphArt.MEDAL, 22.dp)
                Text(
                    buildAnnotatedString {
                        append("Last week you finished ")
                        withStyle(SpanStyle(fontWeight = FontWeight.Black)) { append("${ordinal(r.rank)} of ${r.circleSize}") }
                        append(" · ${fmtPts(r.points)} pts")
                        if (!win && !r.winnerName.isNullOrBlank()) {
                            withStyle(SpanStyle(color = sub)) {
                                append(" · "); appendIcon3D(Icon3DName.CROWN); append(" ${r.winnerName} ${fmtPts(r.winnerPoints)}")
                            }
                        }
                    },
                    inlineContent = icon3DInline(),
                    fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                    color = if (dark) WTheme.text else if (win) Color(0xFF92400E) else FriendsPink.heading, fontFamily = Nunito,
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
                modifier = Modifier.fillMaxWidth().then(
                    if (pastWeeks.size > 1) Modifier.squishClickable(label = null) { showPastWeeks = !showPastWeeks } else Modifier,
                ),
            ) {
                Text(
                    buildAnnotatedString { append("Last week: "); appendIcon3D(Icon3DName.CROWN); append(" $name · ${fmtPts(pts)} pts") },
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = sub, fontFamily = Nunito,
                    inlineContent = icon3DInline(),
                )
                if (pastWeeks.size > 1) {
                    Icon(
                        Icons.Filled.KeyboardArrowDown, "Past weeks", tint = sub,
                        modifier = Modifier.size(14.dp).rotate(if (showPastWeeks) 180f else 0f),
                    )
                }
            }
        }
        if (showPastWeeks) {
            pastWeeks.filter { it.first > 0 }.forEach { (k, name, pts) ->
                Text(
                    buildAnnotatedString { append("${pastWeekLabel(k)}: "); appendIcon3D(Icon3DName.CROWN); append(" $name · ${fmtPts(pts)} pts") },
                    fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    color = sub, fontFamily = Nunito, modifier = Modifier.fillMaxWidth().padding(start = 4.dp),
                    inlineContent = icon3DInline(),
                )
            }
        }
        // C4: the shared medal podium (gold / silver / bronze steps, letter tiles, crown on 1st).
        MedalPodium(
            podium.mapIndexed { i, e ->
                PodiumSpot(
                    place = i + 1, name = e.username, points = fmtPts(e.pts), username = e.avatarName,
                    accentHex = e.accentHex, emoji = e.avatarEmoji,
                    onClick = { onOpenProfile(e.id) },
                )
            },
            stepScale = 0.84f, avatar = 40.dp,
        )
        if (standings.size > 3) {
            Column(Modifier.fillMaxWidth().padding(top = 4.dp).clip(RoundedCornerShape(12.dp))) {
                standings.drop(3).forEachIndexed { i, e ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                            .squishClickable(label = "${ordinal(i + 4)}, ${e.username}, ${fmtPts(e.pts)} points") { onOpenProfile(e.id) }
                            .stripedRow(i, RACE_GOLD)
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                    ) {
                        Text(
                            ordinal(i + 4), style = softNumberStyle(12.sp, if (dark) null else FinishInk.softNumber),
                            modifier = Modifier.width(32.dp), textAlign = TextAlign.End,
                        )
                        Text(
                            e.username, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                            color = if (e.isMe) FriendsPink.solid else ink,
                            fontFamily = Nunito, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                        )
                        Text(fmtPts(e.pts), style = softNumberStyle(13.sp, if (dark) null else FinishInk.softNumber))
                    }
                }
            }
        }
        if (!raceStarted) {
            Text(
                "Race resets Mondays — first daily takes the lead.",
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = sub, fontFamily = Nunito,
                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// ── YOUR FRIENDS ───────────────────────────────────────────────────────────

/** C4 the friends list's lavender (stats-friends-polish: #f6f0ff / #e4d6ff). */
private val LIST_TINT: Color get() = if (com.wordocious.app.ui.vs.vsDarkSeason) WTheme.season?.cardFill ?: Color(0xEB1C0F30) else Color(0xFFF6F0FF)
private val LIST_LINE = Color(0xFFE4D6FF)

@Composable
private fun YourFriendsSection(
    friends: List<FriendsService.FriendProfile>,
    nowMs: Long,
    version: Int,
    challengingId: String?,
    /** Non-null = the friend cards above own the online / in-play friends; this is the collapsible "All friends · N" of everyone else. */
    restNames: List<String>?,
    onOpenProfile: (String) -> Unit,
    onPlay: (FriendsService.FriendProfile) -> Unit,
    onChallenge: (FriendsService.FriendProfile) -> Unit,
    onTaunt: (FriendsService.FriendProfile) -> Unit,
    onMenu: (FriendsService.FriendProfile) -> Unit,
    onNote: (String) -> Unit,
    onAdd: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val shown = if (restNames == null) friends else friends.filter { f -> restNames.any { it.equals(f.username, ignoreCase = true) } }
    val collapsible = restNames != null && shown.isNotEmpty()
    var open by remember(collapsible) { mutableStateOf(!collapsible) }
    // §216: the week's leader wears the crown — only once someone scored.
    val crownId = remember(version) {
        val me = FriendsService.meDigest?.weekPoints ?: 0
        val top = friends.maxByOrNull { it.weekPoints ?: 0 }
        top?.takeIf { (it.weekPoints ?: 0) > 0 && (it.weekPoints ?: 0) > me }?.id
    }
    val sweepSize = com.wordocious.app.ModeGen.sweep.size
    val slackers = friends.filter { it.playedToday == 0 && !isNewFriend(it) }
    val shape = RoundedCornerShape(20.dp)
    // C4: the list on a lavender card; the section header carries the candy actions (C4b).
    Column(
        Modifier.fillMaxWidth()
            .shadow(6.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
            .clip(shape).background(LIST_TINT), // BI23: no outline
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 12.dp, end = 10.dp, top = 10.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                Modifier.weight(1f).then(
                    if (collapsible) Modifier.squishClickable(label = FriendCards.allFriendsLabel(shown.size) + if (open) ", expanded" else ", collapsed") { open = !open } else Modifier,
                ),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                FriendsLabel(
                    when {
                        friends.isEmpty() -> "YOUR FRIENDS"
                        collapsible -> FriendCards.allFriendsLabel(shown.size)
                        else -> "YOUR FRIENDS · ${friends.size}"
                    },
                    Modifier.weight(1f, fill = false), color = com.wordocious.app.ui.vs.VsInk.label,
                )
                if (collapsible) {
                    Icon(
                        Icons.Filled.KeyboardArrowDown, null, tint = com.wordocious.app.ui.vs.VsInk.label,
                        modifier = Modifier.size(16.dp).rotate(if (open) 180f else 0f),
                    )
                }
            }
            if (slackers.isNotEmpty()) {
                CastButton(
                    "Nudge all",
                    onClick = {
                        scope.launch {
                            var n = 0
                            for (f in slackers) {
                                if (FriendsService.taunt(f.id, "slowpoke", com.wordocious.app.todayLocalDate()) == FriendsService.TauntOutcome.SENT) n++
                            }
                            onNote(if (n > 0) "Nudged $n friend${if (n == 1) "" else "s"}!" else "Everyone already nudged today")
                        }
                    },
                    color = CastColor.GOLD, size = CastSize.S,
                    contentDescription = "Nudge all who haven't played",
                )
            }
            // C4b: "Add a friend" moved here from the header circle (same flow).
            CastButton("Add a friend", onClick = onAdd, color = CastColor.PINK, size = CastSize.S)
        }
        if (friends.isEmpty()) {
            Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                // No friends yet: I's invite scene above the line (ART_SPEC §7).
                BrandEmptyState(
                    title = "NO FRIENDS YET", line = Mascots.addFriendLine, scene = SceneArt.INVITE,
                    accent = PageAccent.friends, lineColor = FriendsPink.sub,
                )
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
        if (open) shown.sortedWith(compareByDescending<FriendsService.FriendProfile> { it.isOnline(nowMs) }.thenBy { it.username.lowercase() })
            .forEachIndexed { idx, f ->
                val on = f.isOnline(nowMs)
                val played = f.playedToday ?: 0
                Box {
                    // BJ7: one top line — avatar, name + chips and the streak / action
                    // top-aligned; the presence line 4 under the name.
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                            .combinedClickableNoRipple(onLongClick = { onMenu(f) }, onClick = { onOpenProfile(f.id) })
                            .stripedRow(idx, Color(0xFF7C3AED), first = false)
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                    ) {
                        FriendFace(f.username, f.avatarUrl, f.avatarEmoji, 36.dp, online = on, userId = f.id)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    buildAnnotatedString {
                                        append("@${f.username}")
                                        if (f.id == crownId) { append(" "); appendIcon3D(Icon3DName.CROWN) }
                                    },
                                    fontSize = 14.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                                    inlineContent = icon3DInline(),
                                )
                                if ((f.flawlessStreak ?: 0) >= 2) MiniChip("×${f.flawlessStreak}", Color(0xFFB45309), Color(0xFFF59E0B), Icon3DName.TROPHY)
                                friendversary(f)?.let { MiniChip("$it DAYS", FriendsPink.solid, FriendsPink.solid, art = GlyphArt.SPARKLES) }
                                if (isNewFriend(f)) MiniChip("NEW", PURPLE, PURPLE)
                            }
                            val line = presenceLine(f.lastSeenMs, f.activity, nowMs)
                                ?: if (played > 0) "$played/$sweepSize today" else "Hasn't played today"
                            Text(
                                line, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                color = if (on) FriendsPink.green else if (com.wordocious.app.ui.vs.vsDarkSeason) FriendsPink.muted else Color(0xFF7A6A95), maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        }
                        (f.friendStreak ?: 0).takeIf { it > 0 }?.let { Box(Modifier.heightIn(min = 34.dp), contentAlignment = Alignment.Center) { FlameCount("$it") } }
                        // C4: chunky candy actions — Play / Challenge purple, Nudge amber.
                        when {
                            on -> CastButton("Play", onClick = { onPlay(f) }, color = CastColor.PINK, size = CastSize.S, contentDescription = "Play with ${f.username}")
                            played > 0 || (f.todayPoints ?: 0) > 0 -> CastButton(
                                if (challengingId == f.id) "Sending…" else "Challenge",
                                onClick = { onChallenge(f) },
                                color = CastColor.PINK, size = CastSize.S,
                                enabled = challengingId == null, contentDescription = "Challenge ${f.username}",
                            )
                            else -> CastButton("Nudge", onClick = { onTaunt(f) }, color = CastColor.GOLD, size = CastSize.S, contentDescription = "Nudge ${f.username}")
                        }
                    }
                }
            }
        Spacer(Modifier.height(2.dp))
    }
}

/**
 * The friend family action menu (founder 10-05: no plain-text menus; iOS order), hosted by the Friends screen so
 * a friend card's ⋯ and a list row's long-press open the same sheet. 2.8 wave 3: "Resign <game>" (danger) for each
 * game in play with this friend lives HERE; the in-game Leave dialog no longer resigns.
 */
@Composable
private fun FriendMenuHost(
    f: FriendsService.FriendProfile,
    nowMs: Long,
    canGift: Boolean,
    challengingId: String?,
    games: List<FriendlyGamesService.GameView>,
    onDismiss: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onPlay: (FriendsService.FriendProfile) -> Unit,
    onTaunt: (FriendsService.FriendProfile) -> Unit,
    onChallenge: (FriendsService.FriendProfile) -> Unit,
    onUnfriend: (FriendsService.FriendProfile) -> Unit,
    onResign: (FriendlyGamesService.GameView) -> Unit,
    onNote: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val sweepSize = com.wordocious.app.ModeGen.sweep.size
    val played = f.playedToday ?: 0
    FamilyActionMenu(
        title = f.username,
        subtitle = presenceLine(f.lastSeenMs, f.activity, nowMs)
            ?: if (played > 0) "$played/$sweepSize today" else "Hasn't played today",
        avatar = { FriendAvatar44(f) },
        onDismiss = onDismiss,
        actions = buildList {
            add(FamilyMenuAction("profile", "View profile", FamilyMenuIcon.Clay(FamIcon.EYE)) { onOpenProfile(f.id) })
            add(FamilyMenuAction("play", "Play a game", FamilyMenuIcon.Clay(FamIcon.PLAY), FamilyMenuInk.PINK) { onPlay(f) })
            add(FamilyMenuAction("taunt", "Taunt", FamilyMenuIcon.Art(Icon3DName.BELL.res), FamilyMenuInk.AMBER,
                contentDescription = "Taunt ${f.username}") { onTaunt(f) })
            add(FamilyMenuAction("challenge", "Challenge", FamilyMenuIcon.Art(GlyphArt.SWORDS.res),
                enabled = challengingId == null, contentDescription = "Challenge ${f.username}") { onChallenge(f) })
            if (canGift) {
                add(FamilyMenuAction("gift", "Gift a shield", FamilyMenuIcon.Art(Icon3DName.SHIELD.res), FamilyMenuInk.TEAL) {
                    scope.launch {
                        when (val r = FriendsService.giftShield(f.id)) {
                            is FriendsService.GiftOutcome.Sent -> {
                                onNote("${SHIELD_NOTE}Shield sent to ${f.username} · ${r.shieldsLeft} left")
                                AuthService.refreshProfile()
                            }
                            is FriendsService.GiftOutcome.Failed -> onNote(r.message)
                        }
                    }
                })
            }
            games.forEach { g ->
                add(FamilyMenuAction("resign-${g.id}", "Resign ${g.title}", FamilyMenuIcon.Clay(FamIcon.FLAG), danger = true,
                    contentDescription = "Resign ${g.title} against ${f.username}") { onResign(g) })
            }
            add(FamilyMenuAction("unfriend", "Unfriend", FamilyMenuIcon.Clay(FamIcon.XMARK), danger = true,
                contentDescription = "Unfriend ${f.username}") { onUnfriend(f) })
        },
    )
}

/** The gift note's marker: the note row swaps it for the 3D shield. */
private const val SHIELD_NOTE = com.wordocious.app.ui.friends.FRIENDS_SHIELD_NOTE

@Composable
private fun MiniChip(text: String, ink: Color, tint: Color, icon3d: Icon3DName? = null, art: GlyphArt? = null) {
    Row(
        Modifier.clip(RoundedCornerShape(4.dp)).background(tint.copy(alpha = 0.13f)).padding(horizontal = 4.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (icon3d != null) Icon3D(icon3d, 11.dp)
        if (art != null) GlyphArtImage(art, 11.dp)
        Text(text, fontSize = 8.sp, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito, maxLines = 1)
    }
}

/** A small soft-number count on a pink pill (YOUR TURN / INVITES). */
@Composable
private fun CountPill(n: Int) {
    Text(
        "$n", style = softNumberStyle(12.sp, com.wordocious.app.ui.vs.VsInk.softNumber), maxLines = 1,
        modifier = Modifier.lightTintedPill(FRIENDS_CARD_ACCENT, 50.dp).padding(start = 8.dp, end = 8.dp, top = 4.dp, bottom = 1.dp),
    )
}

/**
 * C4 a PLAY WITH FRIENDS card: a small card tinted in the pocket game's own color with
 * its own top bar (stats-friends-polish `.gt`), the 3D game art, the name and its line.
 */
@Composable
private fun PocketGameCard(kind: com.wordocious.core.FriendlyKind, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    CappedFontScale {
        Column(
            modifier
                .squishClickable(label = "${kind.title}, ${kind.sub}. Pick a friend to play") { onClick() }
                .shadow(5.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
                .clip(shape)
                // BI23 / BJ7: wash only, no outline.
                .background(friendsWash(kind.color, 0.14f)),
        ) {
            Box(Modifier.fillMaxWidth().height(5.dp).background(kind.color))
            // BJ7: the card hugs its content — icon, a one-line name, the detail (2 lines
            // reserved so the row's cards match).
            Column(
                Modifier.fillMaxWidth().padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                FriendlyGameGlyph(kind, 32.dp)
                FitText(
                    kind.title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
                )
                Text(
                    kind.sub, fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted,
                    maxLines = 2, minLines = 2, overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** A1 the Friends sheets / dialogs / menus: a soft pink wash instead of white. */
internal val FRIENDS_SHEET: Color get() = if (com.wordocious.app.ui.vs.vsDarkSeason) WTheme.season?.card ?: Color(0xFF1C0F30) else Color(0xFFFFF3F9)

// ── Add by username + share link ───────────────────────────────────────────

@Composable
private fun AddFriendSection(
    modifier: Modifier,
    focus: FocusRequester,
    sentTo: String? = null,
    onSent: (String) -> Unit = {},
    onSentDone: () -> Unit = {},
    onNewFriend: (name: String, id: String?) -> Unit = { _, _ -> },
    onNote: (String) -> Unit,
) {
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
                // T3 / T1: a mutual add → NEW FRIENDS!; a pending request → INVITE SENT!
                is FriendsService.RequestOutcome.Accepted -> { onNewFriend(name, null); username = "" }
                is FriendsService.RequestOutcome.Pending -> { onSent(name); username = "" }
                is FriendsService.RequestOutcome.Failed -> onNote(r.message)
            }
            sending = false
        }
    }
    fun shareInvite() {
        val myId = AuthService.userId ?: return
        val myName = AuthService.profile.value?.username ?: return
        if (sharingInvite) return
        sharingInvite = true
        scope.launch {
            try {
                // S4 invite copy; the link (profile, or a Pro gift's join link) stays.
                var text = com.wordocious.app.data.ShareHelper.inviteText("https://wordocious.com/profile/$myId")
                if (AuthService.isProActive) {
                    val now = java.time.Instant.now()
                    val open = com.wordocious.app.data.ReferralService.myInvites().firstOrNull { r ->
                        r.status == "pending" && (AuthService.parseTimestamp(r.expiresAt)?.isAfter(now) ?: false)
                    }
                    if (open != null) {
                        text = com.wordocious.app.data.ShareHelper.inviteText("https://wordocious.com/join/${open.code}")
                    }
                }
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                context.startActivity(Intent.createChooser(send, "Invite a friend"))
            } finally { sharingInvite = false }
        }
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FriendsLabel("ADD A FRIEND", Modifier.padding(start = 4.dp))
        // T1: the request went out — I tossing the envelope, INVITE SENT!, the friend on a
        // glossy pill, "Send another" (back to the field) and "Done".
        if (sentTo != null) {
            InviteSentCard(
                onDone = onSentDone,
                modifier = Modifier.fillMaxWidth(),
                name = "@$sentTo",
                note = "It's waiting on their Friends tab.",
                onSendAnother = { onSentDone(); scope.launch { delay(60); runCatching { focus.requestFocus() } } },
                light = true,
            )
            return@Column
        }
        Box(Modifier.fillMaxWidth()) {
            Column(
                Modifier.fillMaxWidth().friendsCard(16.dp, bar = FRIENDS_CARD_ACCENT)
                    .padding(start = 12.dp, end = 12.dp, top = 14.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Find them by username, or send your link.", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                    color = FriendsPink.heading, modifier = Modifier.padding(end = 64.dp),
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = username, onValueChange = { username = it },
                        placeholder = { Text("Add by username", fontSize = 12.sp, color = FriendsPink.muted) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                        shape = RoundedCornerShape(14.dp),
                        colors = friendsFieldColors(),
                        modifier = Modifier.weight(1f).focusRequester(focus),
                    )
                    CastButton(
                        if (sending) "…" else "Add", onClick = { add() },
                        color = CastColor.PINK, size = CastSize.M,
                        enabled = !sending && username.trim().isNotEmpty(), contentDescription = "Send friend request",
                    )
                }
                suggestions.forEach { u ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                            .squishClickable(label = "Add ${u.username}, level ${u.level}") {
                                if (sending) return@squishClickable
                                sending = true
                                suggestions = emptyList()
                                scope.launch {
                                    when (val r = FriendsService.request(addresseeId = u.id)) {
                                        is FriendsService.RequestOutcome.Accepted -> { onNewFriend(u.username, u.id); username = "" }
                                        is FriendsService.RequestOutcome.Pending -> { onSent(u.username); username = "" }
                                        is FriendsService.RequestOutcome.Failed -> onNote(r.message)
                                    }
                                    sending = false
                                }
                            }
                            .lightTintedPill(Color(0xFF7C3AED), 12.dp) // AD: inside the fixed-light card
                            .padding(start = 10.dp, end = 10.dp, top = 7.dp, bottom = 6.dp),
                    ) {
                        FriendAvatar(u)
                        Text(u.username, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.heading, maxLines = 1, modifier = Modifier.weight(1f))
                        // V3: the level-tier badge with the level in soft numbers.
                        LevelBadge(u.level, 18.dp, numberSize = 12.sp, prefix = "LVL")
                    }
                }
                // §225/§289: the share link covers the "get them on the app" direction.
                CastButton(
                    "Share invite link", onClick = { shareInvite() },
                    color = CastColor.PINK, size = CastSize.S,
                    enabled = !sharingInvite,
                )
            }
            // A7: W waving hello beside the line (the banner host is O1).
            CastPose(MascotId.W, "wave", 48.dp, Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp))
        }
    }
}

/** The Friends text fields: a soft pink-tinted container (A1, no white) with the pink focus line. */
@Composable
internal fun friendsFieldColors() = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
    // BI23 (founder: no outlined boxes): a soft filled field — no outline; focus deepens the fill.
    focusedContainerColor = friendsWash(FRIENDS_CARD_ACCENT, 0.20f),
    unfocusedContainerColor = friendsWash(FRIENDS_CARD_ACCENT, 0.12f),
    focusedBorderColor = Color.Transparent,
    unfocusedBorderColor = Color.Transparent,
    focusedTextColor = FriendsPink.heading,
    unfocusedTextColor = FriendsPink.heading,
    cursorColor = FRIENDS_CARD_ACCENT,
)

// ── Taunt picker ───────────────────────────────────────────────────────────

@Composable
private fun TauntDialog(target: FriendsService.FriendProfile, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<String?>(null) }
    androidx.compose.ui.window.Dialog(onDismissRequest = onDone) {
        // K1: a nudge — amber card with its top bar, the friend's tile and R, sleepy.
        Column(
            com.wordocious.app.ui.PopupWidth.fillMaxWidth().friendsCard(20.dp, accent = Color(0xFFF59E0B), bar = Color(0xFFF59E0B)),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 18.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                FriendFace(target.username, target.avatarUrl, target.avatarEmoji, 34.dp, online = false, userId = target.id)
                // BJ16: the NUDGE! lettering; who rides under it.
                Column(Modifier.weight(1f)) {
                    HeadingArt(Heading.NUDGE, height = 30.dp, maxWidth = 140.dp, contentDescription = "Nudge ${target.username}", alignment = Alignment.CenterStart)
                    Text(
                        "@${target.username}",
                        fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }
                CastPose(MascotId.R, "sleepwalk", 48.dp)
            }
            val s = status
            if (s != null) {
                // The nudge result as the finished candy message (coin + pill), not bare text.
                Box(Modifier.fillMaxWidth().padding(vertical = 28.dp), contentAlignment = Alignment.Center) {
                    com.wordocious.app.ui.game.CandyMessagePill(s, com.wordocious.app.ui.game.FeedbackToast.statusTone(s))
                }
            } else {
                com.wordocious.app.data.FriendTaunts.ALL.forEachIndexed { i, taunt ->
                    Text(
                        // AM3: the taunt's emoji travels only in the push text, never on screen.
                        withoutEmoji(taunt.text), fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = FriendsPink.heading,
                        modifier = Modifier.fillMaxWidth().squishClickable(label = null) {
                            scope.launch {
                                status = when (FriendsService.taunt(target.id, taunt.id, com.wordocious.app.todayLocalDate())) {
                                    FriendsService.TauntOutcome.SENT -> "Sent!"
                                    FriendsService.TauntOutcome.ALREADY_SENT -> "Already nudged them today"
                                    FriendsService.TauntOutcome.FAILED -> "Could not send"
                                }
                                delay(1400)
                                onDone()
                            }
                        }.stripedRow(i, Color(0xFFF59E0B), first = false).padding(horizontal = 16.dp, vertical = 13.dp),
                    )
                }
                CandyButton(
                    "Cancel", onClick = onDone, color = CandyColor.PEACH, size = CandySize.MEDIUM,
                    modifier = Modifier.align(Alignment.CenterHorizontally).padding(vertical = 12.dp),
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
    // A9: the row squishes on press.
    return this.pressSquish(interaction).combinedClickable(interactionSource = interaction, indication = null, onLongClick = onLongClick, onClick = onClick)
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

internal data class PodiumEntry(
    val id: String, val username: String, val avatarUrl: String?,
    val avatarEmoji: String?, val pts: Int, val isMe: Boolean,
    /** §20 letter tile: initials + accent come from the real profile, not the "You" label. */
    val avatarName: String = username, val accentHex: String? = null,
)

// FRIENDS row (§207 Tier 3) — the compact card on the OWN profile screen
// pointing at the Friends tab: Users icon, gradient FRIENDS, count, red pending
// pill (ART_SPEC §21.4: no chevron).
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

    // A1 / A9: a purple-tinted card with its top bar, squishing on tap.
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .squishClickable(label = null, onClick = onOpen)
            .then(
                if (WTheme.isDark) Modifier.clip(RoundedCornerShape(20.dp)).background(WTheme.surface)
                else Modifier.friendsCard(20.dp, accent = PURPLE, bar = PURPLE, barHeight = 6.dp)
            )
            .padding(start = 14.dp, end = 14.dp, top = 16.dp, bottom = 12.dp),
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
            Text("$friendCount", style = softNumberStyle(14.sp))
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

/** The family action menu's header face (the shared resolver, 44 dp). */
@Composable
private fun FriendAvatar44(f: FriendsService.FriendProfile) = PlayerAvatar(
    f.username, 44.dp, userId = f.id, avatarUrl = f.avatarUrl, config = f.avatarConfig,
    castId = f.avatarCastId, frame = f.avatarFrame, contentDescription = null,
)

// Shared with TodaysRace.kt / ActivityFeed.kt (§289/§290) — one avatar idiom.
@Composable
internal fun FriendAvatar(f: FriendsService.FriendProfile, accentHex: String? = null) {
    // BJ5: THE shared resolver (photo / saved mascot / worn cast / seeded), a rounded square.
    PlayerAvatar(
        f.username, 36.dp, userId = f.id, avatarUrl = f.avatarUrl, config = f.avatarConfig,   // BJ7: 36 in lists
        castId = f.avatarCastId, frame = f.avatarFrame, accentHex = accentHex, contentDescription = f.username,
    )
}

/** "ends Sunday · 2d 04:12:09" — the weekly race's live clock (weeks run Mon-Sun, reset Monday 00:00 local). */
@Composable
private fun WeekEndsCountdown(color: Color = FriendsPink.label) {
    val hidden = LocalTabHidden.current
    val label by produceState(weekEndsLabel()) {
        while (true) { delay(1_000); hidden.awaitShown(); value = weekEndsLabel() }
    }
    Text(label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = color, fontFamily = Nunito, maxLines = 1)
}

private fun weekEndsLabel(): String {
    val now = java.time.LocalDateTime.now()
    val end = now.toLocalDate().plusDays((8 - now.dayOfWeek.value).toLong()).atStartOfDay()
    val secs = java.time.Duration.between(now, end).seconds.coerceAtLeast(0)
    val d = secs / 86400
    val clock = String.format(java.util.Locale.US, "%02d:%02d:%02d", (secs % 86400) / 3600, (secs % 3600) / 60, secs % 60)
    return if (d >= 1) "ends Sunday · ${d}d $clock" else "ends tonight · $clock"
}
