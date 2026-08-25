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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// FRIENDS (§207) — the Friends card on the OWN profile screen: friends list
// with counts, incoming requests (Accept / Decline), and the Add-by-username
// field. Same card shell + type scale as the referral InvitePanel next to it
// (web FriendsPanel / iOS FriendsPanelView parity).
@Composable
fun FriendsPanel(onOpenProfile: (String) -> Unit = {}) {
    if (AuthService.userId == null) return

    var version by remember { mutableIntStateOf(FriendsService.version) }
    DisposableEffect(Unit) {
        val remove = FriendsService.addListener { version = FriendsService.version }
        onDispose { remove() }
    }
    LaunchedEffect(Unit) { FriendsService.load() }

    var username by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<String?>(null) }
    // Typeahead (Aug 11): 2+ letters → matching users, so invites go to the
    // right Carlie instead of a blind exact-match fire.
    var suggestions by remember { mutableStateOf<List<FriendsService.FriendProfile>>(emptyList()) }
    // §212: one-tap taunts from friend rows (leaderboard dialog twin).
    var tauntTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    var tauntStatus by remember { mutableStateOf<String?>(null) }
    // §225: long-press row menu + unfriend confirm — unfriend was only
    // reachable by drilling into the friend's profile page.
    var menuTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    var unfriendTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    // §234: weekly-race share in flight — one card render/upload at a time.
    var sharingRace by remember { mutableStateOf(false) }
    // §238: the "Last week" line unfolds into the settled-week history.
    var showPastWeeks by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(note) { if (note != null) { delay(2_500); note = null } }
    LaunchedEffect(username) {
        val q = username.trim().trimStart('@')
        if (q.length < 2) { suggestions = emptyList(); return@LaunchedEffect }
        delay(250)   // debounce; recomposition cancels stale searches
        suggestions = FriendsService.search(q).filter {
            !FriendsService.isFriend(it.id) && !FriendsService.hasRequested(it.id)
        }
    }

    // The version read keeps this card recomposing on cache changes.
    val friends = remember(version) { FriendsService.friends }
    val incoming = remember(version) { FriendsService.incoming }
    val outgoing = remember(version) { FriendsService.outgoingProfiles }

    fun add() {
        val name = username.trim().trimStart('@')
        if (name.isEmpty() || sending) return
        sending = true
        scope.launch {
            when (val r = FriendsService.request(username = name)) {
                is FriendsService.RequestOutcome.Accepted -> { note = "You're now friends! 🎉"; username = "" }
                is FriendsService.RequestOutcome.Pending -> { note = "Request sent 🤝"; username = "" }
                is FriendsService.RequestOutcome.Failed -> note = r.message
            }
            sending = false
        }
    }

    // Two cards (founder ask, Aug 17): requests in flight moved out of the
    // FRIENDS box into their own INVITES card — the roster reads finished
    // even while invites are pending.
    var inviteNote by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(inviteNote) { if (inviteNote != null) { delay(2_500); inviteNote = null } }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WTheme.surface, RoundedCornerShape(20.dp))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.People, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(16.dp))
            Text(
                "FRIENDS",
                fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                style = TextStyle(
                    brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899))),
                    fontFamily = Nunito,
                ),
            )
            if (friends.isNotEmpty()) {
                Text(
                    "${friends.size}", fontSize = 12.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Black, color = WTheme.textMuted,
                )
            }
            Spacer(Modifier.weight(1f))
            // §216: one-tap nudge for everyone who hasn't played today
            // (server still enforces 1 taunt per friend per day).
            val slackers = friends.filter { it.playedToday == 0 && !isNewFriend(it) }
            if (slackers.isNotEmpty()) {
                Box(
                    Modifier.clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFF7C3AED).copy(alpha = 0.09f))
                        .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(10.dp))
                        .clickableNoRipple {
                            scope.launch {
                                var n = 0
                                for (f in slackers) {
                                    if (FriendsService.taunt(f.id, "slowpoke", com.wordocious.app.todayLocalDate()) == FriendsService.TauntOutcome.SENT) n++
                                }
                                note = if (n > 0) "Nudged $n friend${if (n == 1) "" else "s"} 🔔" else "Everyone already nudged today"
                            }
                        }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        "🔔 Nudge slackers", fontSize = 10.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        color = Color(0xFF7C3AED), fontFamily = Nunito,
                    )
                }
            }
        }

        // Weekly race standings (§212/§238) — me + friends by this week's
        // daily points, best first. Podium wears the medals; 4th+ get rows.
        val standings = remember(version) {
            val friendEntries = FriendsService.friends.map {
                PodiumEntry(it.id, it.username, it.avatarUrl, it.avatarEmoji, it.weekPoints ?: 0, isMe = false)
            }
            val p = com.wordocious.app.data.AuthService.profile.value
            val all = if (p != null && friendEntries.isNotEmpty()) {
                friendEntries + PodiumEntry(
                    p.id, "You", p.avatarUrl, p.avatarEmoji,
                    FriendsService.meDigest?.weekPoints ?: 0, isMe = true,
                )
            } else friendEntries
            // Always on (§216): a Monday-morning zero-point podium still
            // shows the race — medals wait for the first score.
            all.sortedByDescending { it.pts }
        }
        val podium = standings.take(3)
        val raceStarted = standings.any { it.pts > 0 }
        // §216: the week's leader wears the crown — only once someone scored.
        val crownId = if (raceStarted) standings.firstOrNull()?.id else null
        if (podium.isNotEmpty()) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            ) {
                // §218/§226 (founder asks): the podium is the WEEKLY race, but
                // bare "pts" read as today's score — name the window and when
                // it closes. Weeks run Mon-Sun, reset Monday 00:00 local.
                // Live clock (a static "4d" carried no urgency) — ticks every
                // second like the daily countdown.
                var raceTick by remember { mutableIntStateOf(0) }
                LaunchedEffect(Unit) { while (true) { delay(1_000); raceTick++ } }
                val weekEndsLabel = remember(raceTick) {
                    val now = java.time.LocalDateTime.now()
                    val end = now.toLocalDate()
                        .plusDays((8 - now.dayOfWeek.value).toLong())
                        .atStartOfDay()
                    val secs = java.time.Duration.between(now, end).seconds.coerceAtLeast(0)
                    val d = secs / 86400
                    val clock = String.format(
                        "%02d:%02d:%02d", (secs % 86400) / 3600, (secs % 3600) / 60, secs % 60,
                    )
                    if (d >= 1) "ends Sunday · ${d}d $clock" else "ends tonight · $clock"
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "THIS WEEK'S RACE", fontSize = 9.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                        letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        weekEndsLabel, fontSize = 10.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        color = WTheme.textMuted, fontFamily = Nunito,
                    )
                    // §234: share the race as a card — the panel's own cached
                    // digest is the whole input, so no fetch. Hidden until
                    // anyone scored (a zero-point board brags about nothing).
                    if (raceStarted) {
                        Icon(
                            Icons.Filled.Share, "Share weekly race",
                            tint = WTheme.textMuted.copy(alpha = if (sharingRace) 0.4f else 1f),
                            modifier = Modifier.padding(start = 8.dp).size(14.dp).clickableNoRipple {
                                if (!sharingRace) {
                                    sharingRace = true
                                    scope.launch {
                                        try {
                                            com.wordocious.app.data.LeaderboardShare.shareWeeklyRaceCard(
                                                context, FriendsService.friends, FriendsService.meDigest,
                                                // Real username on the sharer's row — the card
                                                // travels to feeds where "You" names nobody.
                                                AuthService.profile.value?.username ?: "You",
                                            )
                                        } finally { sharingRace = false }
                                    }
                                }
                            },
                        )
                    }
                }
                // §232: Monday's question — "who won last week?" — answered in
                // place. lastWeekPoints is the settled previous week from the
                // digest; hidden until anyone actually scored.
                val lastWeek = remember(version) {
                    val entries = FriendsService.friends.map {
                        it.username to (it.lastWeekPoints ?: 0)
                    } + listOfNotNull(
                        com.wordocious.app.data.AuthService.profile.value?.let {
                            "You" to (FriendsService.meDigest?.lastWeekPoints ?: 0)
                        },
                    )
                    entries.maxByOrNull { it.second }?.takeIf { it.second > 0 }
                }
                // §238: winner per settled week — index 0 = last week; weeks
                // nobody scored in are dropped.
                val pastWeeks = remember(version) {
                    val meArr = FriendsService.meDigest?.pastWeekPoints ?: emptyList()
                    val len = maxOf(meArr.size, FriendsService.friends.maxOfOrNull { it.pastWeekPoints?.size ?: 0 } ?: 0)
                    (0 until len).mapNotNull { k ->
                        val entries = FriendsService.friends.map {
                            it.username to (it.pastWeekPoints?.getOrNull(k) ?: 0)
                        } + listOfNotNull(
                            com.wordocious.app.data.AuthService.profile.value?.let {
                                "You" to (meArr.getOrNull(k) ?: 0)
                            },
                        )
                        entries.maxByOrNull { it.second }?.takeIf { it.second > 0 }?.let { Triple(k, it.first, it.second) }
                    }
                }
                lastWeek?.let { (name, pts) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().clickableNoRipple {
                            if (pastWeeks.size > 1) showPastWeeks = !showPastWeeks
                        },
                    ) {
                        Text(
                            "Last week: 👑 $name · ${fmtPts(pts)} pts", fontSize = 10.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            color = WTheme.textMuted, fontFamily = Nunito,
                        )
                        if (pastWeeks.size > 1) {
                            Icon(
                                Icons.Filled.KeyboardArrowDown, "Past weeks",
                                tint = WTheme.textMuted,
                                modifier = Modifier.size(14.dp)
                                    .rotate(if (showPastWeeks) 180f else 0f),
                            )
                        }
                    }
                }
                if (showPastWeeks) {
                    pastWeeks.filter { it.first > 0 }.forEach { (k, name, pts) ->
                        Text(
                            "${pastWeekLabel(k)}: 👑 $name · ${fmtPts(pts)} pts", fontSize = 10.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            color = WTheme.textMuted, fontFamily = Nunito,
                            modifier = Modifier.fillMaxWidth().padding(start = 4.dp),
                        )
                    }
                }
                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(22.dp, Alignment.CenterHorizontally),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    listOf(1, 0, 2).filter { it < podium.size }.forEach { i ->
                        val e = podium[i]
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                            modifier = Modifier.padding(top = if (i == 0) 0.dp else 8.dp)
                                // §225 dead-tap report: the podium looked
                                // tappable but went nowhere — into the profile.
                                .clickableNoRipple { onOpenProfile(e.id) },
                        ) {
                            Text(if (raceStarted) listOf("🥇", "🥈", "🥉")[i] else "🏁", fontSize = if (i == 0) 20.sp else 14.sp)
                            PodiumAvatar(e)
                            Text(
                                // §225: 9.sp + capped width fits ~14 chars
                                // before the ellipsis ("TheRealMich…" ask).
                                e.username, fontSize = 9.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                                color = if (e.isMe) Color(0xFF7C3AED) else WTheme.text,
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.widthIn(max = 80.dp),
                            )
                            Text(
                                "${fmtPts(e.pts)} pts", fontSize = 9.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = WTheme.textMuted,
                            )
                        }
                    }
                }
                // §238: everyone past the medals, ranked. Score stays
                // unshrunk and the name truncates — the §236 lesson.
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
                                    ordinal(i + 4), fontSize = 10.sp,
                                    fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                                    color = WTheme.textMuted, fontFamily = Nunito,
                                    modifier = Modifier.width(28.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.End,
                                )
                                Text(
                                    e.username, fontSize = 10.sp,
                                    fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                                    color = if (e.isMe) Color(0xFF7C3AED) else WTheme.text,
                                    fontFamily = Nunito, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    "${fmtPts(e.pts)} pts", fontSize = 10.sp,
                                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                    color = WTheme.textMuted, fontFamily = Nunito,
                                )
                            }
                        }
                    }
                }
                if (!raceStarted) {
                    Text(
                        "Race resets Mondays — first daily takes the lead.",
                        fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        color = WTheme.textMuted, fontFamily = Nunito,
                    )
                }
            }
        }

        // §216: today's race — how many friends you've topped so far.
        val myToday = FriendsService.meDigest?.todayPoints ?: 0
        if (myToday > 0 && friends.isNotEmpty()) {
            val topped = friends.count { (it.todayPoints ?: 0) < myToday }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "TODAY'S RACE", fontSize = 9.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                        letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "topped $topped of ${friends.size} friend${if (friends.size == 1) "" else "s"}",
                        fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        color = WTheme.textMuted, fontFamily = Nunito,
                    )
                }
                Box(
                    Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
                        .background(WTheme.surfaceHover),
                ) {
                    Box(
                        Modifier.fillMaxWidth(topped.toFloat() / friends.size.coerceAtLeast(1))
                            .height(6.dp).clip(RoundedCornerShape(3.dp))
                            .background(Brush.horizontalGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899)))),
                    )
                }
            }
        }

        // Friends list — avatar rows into their profiles (H2H lives there).
        if (friends.isNotEmpty()) {
            friends.forEach { f ->
                // §225: Box anchors the long-press DropdownMenu to this row.
                Box {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.combinedClickableNoRipple(
                        onLongClick = { menuTarget = f },
                        onClick = { onOpenProfile(f.id) },
                    ),
                ) {
                    FriendAvatar(f)
                    Column(
                        verticalArrangement = Arrangement.spacedBy(1.dp),
                        modifier = Modifier.weight(1f),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                // §216: the week's leader wears the crown.
                                if (f.id == crownId) "${f.username} 👑" else f.username,
                                fontSize = 12.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                                color = WTheme.text, maxLines = 1,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            // §216: friendversary chip on milestone days.
                            friendversary(f)?.let { days ->
                                Box(
                                    Modifier.clip(RoundedCornerShape(4.dp))
                                        .background(Color(0xFFEC4899).copy(alpha = 0.13f))
                                        .padding(horizontal = 4.dp, vertical = 1.dp),
                                ) {
                                    Text(
                                        "🎉 $days DAYS", fontSize = 8.sp,
                                        fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                                        color = Color(0xFFEC4899), fontFamily = Nunito,
                                    )
                                }
                            }
                            if (isNewFriend(f)) {
                                Box(
                                    Modifier.clip(RoundedCornerShape(4.dp))
                                        .background(Color(0xFF7C3AED).copy(alpha = 0.13f))
                                        .padding(horizontal = 4.dp, vertical = 1.dp),
                                ) {
                                    Text(
                                        "NEW", fontSize = 8.sp,
                                        fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                                        color = Color(0xFF7C3AED), fontFamily = Nunito,
                                    )
                                }
                            }
                        }
                        // §212: today's progress, streak, rivalry — the live row.
                        f.playedToday?.let { played ->
                            Text(
                                statusLine(f, played), fontSize = 10.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                color = WTheme.textMuted, maxLines = 1, fontFamily = Nunito,
                            )
                        }
                    }
                    if (isNewFriend(f)) {
                        Box(
                            Modifier.clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF7C3AED).copy(alpha = 0.09f))
                                .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(10.dp))
                                .clickableNoRipple {
                                    scope.launch {
                                        note = when (FriendsService.taunt(f.id, "hi", com.wordocious.app.todayLocalDate())) {
                                            FriendsService.TauntOutcome.SENT -> "👋 sent to ${f.username}!"
                                            FriendsService.TauntOutcome.ALREADY_SENT -> "Already said hi today"
                                            FriendsService.TauntOutcome.FAILED -> "Could not send"
                                        }
                                    }
                                }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text(
                                "👋 Say hi", fontSize = 10.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                color = Color(0xFF7C3AED), fontFamily = Nunito,
                            )
                        }
                    }
                    // §225: every row reserves the bell's 26.dp so the Lvl
                    // labels sit in a clean column, bell or no bell.
                    Box(Modifier.size(26.dp), contentAlignment = Alignment.Center) {
                        if (!isNewFriend(f) && f.playedToday == 0) {
                            // Slacker bell — one-tap taunt (§207 picker). Its
                            // own click target; the row tap opens the profile.
                            Box(
                                Modifier.size(26.dp).clip(CircleShape).background(WTheme.surfaceHover)
                                    .border(1.5.dp, WTheme.border, CircleShape)
                                    .clickableNoRipple { tauntTarget = f },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Outlined.Notifications, "Taunt ${f.username}",
                                    tint = Color(0xFF7C3AED), modifier = Modifier.size(14.dp),
                                )
                            }
                        }
                    }
                    Text(
                        "Lvl ${f.level}", fontSize = 10.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = WTheme.textMuted,
                    )
                    // §225: rows read tappable now that they navigate.
                    Icon(
                        Icons.AutoMirrored.Filled.KeyboardArrowRight, null,
                        tint = WTheme.textMuted, modifier = Modifier.size(14.dp),
                    )
                }
                // §225: long-press menu — profile / taunt / unfriend without
                // the profile-page detour.
                DropdownMenu(
                    expanded = menuTarget?.id == f.id,
                    onDismissRequest = { menuTarget = null },
                ) {
                    DropdownMenuItem(
                        text = { Text("View profile", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, fontFamily = Nunito) },
                        onClick = { menuTarget = null; onOpenProfile(f.id) },
                    )
                    DropdownMenuItem(
                        text = { Text("Taunt", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, fontFamily = Nunito) },
                        onClick = { menuTarget = null; tauntTarget = f },
                    )
                    DropdownMenuItem(
                        text = { Text("Unfriend", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, fontFamily = Nunito, color = Color(0xFFDC2626)) },
                        onClick = { menuTarget = null; unfriendTarget = f },
                    )
                }
                }
            }
        } else if (incoming.isEmpty() && outgoing.isEmpty()) {
            // Teaching empty state (Tier 1) — the three-step loop, web parity.
            val purple = Color(0xFF7C3AED)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    buildAnnotatedString {
                        append("1. Add friends below by username, or from the ")
                        withStyle(SpanStyle(color = purple)) { append("Add Friend") }
                        append(" button on any player's profile.")
                    },
                    fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    color = WTheme.textMuted, fontFamily = Nunito,
                )
                Text(
                    "2. Requests you send and receive land right here.",
                    fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    color = WTheme.textMuted, fontFamily = Nunito,
                )
                Text(
                    buildAnnotatedString {
                        append("3. Once a friend accepts, flip the leaderboard to ")
                        withStyle(SpanStyle(color = purple)) { append("FRIENDS") }
                        append(" for your own private race.")
                    },
                    fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    color = WTheme.textMuted, fontFamily = Nunito,
                )
            }
        }

        // Add by username — exact match, same lookup as VS invites.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = username, onValueChange = { username = it },
                placeholder = { Text("Add by username", fontSize = 12.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                modifier = Modifier.weight(1f),
            )
            Button3D(
                onClick = { add() },
                face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
                shadow = Color(0xFF4C1D95),
                enabled = !sending && username.trim().isNotEmpty(),
            ) {
                Text(
                    if (sending) "…" else "Add",
                    color = Color.White, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                    fontSize = 13.sp, fontFamily = Nunito,
                )
            }
        }
        // §225: adding by username only works when the friend is already
        // here — the share link covers the "get them on the app" direction.
        Text(
            "Share invite link", fontSize = 11.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            color = WTheme.textMuted, fontFamily = Nunito,
            modifier = Modifier.clickableNoRipple {
                val myId = AuthService.userId ?: return@clickableNoRipple
                val myName = AuthService.profile.value?.username ?: return@clickableNoRipple
                // Plain-text ACTION_SEND, InvitePanel.share idiom (ShareHelper
                // is image-first, so no fit there).
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(
                        Intent.EXTRA_TEXT,
                        "Add me on Wordocious — I'm $myName\nhttps://wordocious.com/profile/$myId",
                    )
                }
                context.startActivity(Intent.createChooser(send, null))
            },
        )
        // Typeahead results — tap sends to that exact account (by id).
        if (suggestions.isNotEmpty()) {
            suggestions.forEach { u ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(WTheme.surfaceHover)
                        .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                        .clickableNoRipple {
                            if (sending) return@clickableNoRipple
                            sending = true
                            suggestions = emptyList()
                            scope.launch {
                                when (val r = FriendsService.request(addresseeId = u.id)) {
                                    is FriendsService.RequestOutcome.Accepted -> { note = "You're now friends! 🎉"; username = "" }
                                    is FriendsService.RequestOutcome.Pending -> { note = "Request sent to ${u.username} 🤝"; username = "" }
                                    is FriendsService.RequestOutcome.Failed -> note = r.message
                                }
                                sending = false
                            }
                        }
                        .padding(horizontal = 10.dp, vertical = 7.dp),
                ) {
                    FriendAvatar(u)
                    Text(
                        u.username, fontSize = 12.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                        color = WTheme.text, maxLines = 1, modifier = Modifier.weight(1f),
                    )
                    Text(
                        "Lvl ${u.level}", fontSize = 10.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
            }
        }
        note?.let {
            Text(it, fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, color = WTheme.textMuted)
        }
    }

    // INVITES card — requests in flight (incoming + sent), split out of the
    // FRIENDS card so the roster reads finished (founder ask, Aug 17).
    // Renders only when something is actually pending.
    if (incoming.isNotEmpty() || outgoing.isNotEmpty()) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WTheme.surface, RoundedCornerShape(20.dp))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.AutoMirrored.Filled.Send, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(15.dp))
            Text(
                "INVITES",
                fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                style = TextStyle(
                    brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899))),
                    fontFamily = Nunito,
                ),
            )
            Text(
                "${incoming.size + outgoing.size}", fontSize = 12.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black, color = WTheme.textMuted,
            )
        }

        // Incoming requests first — they're the actionable part.
        if (incoming.isNotEmpty()) {
            Text(
                "FRIEND REQUESTS", fontSize = 10.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito,
            )
            incoming.forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    FriendAvatar(r)
                    Text(
                        r.username, fontSize = 12.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                        color = WTheme.text, maxLines = 1,
                        modifier = Modifier.weight(1f).clickableNoRipple { onOpenProfile(r.id) },
                    )
                    Box(
                        Modifier.size(28.dp).clip(CircleShape).background(Color(0xFF7C3AED))
                            .clickableNoRipple { scope.launch { FriendsService.accept(r.id) } },
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.Check, "Accept ${r.username}", tint = Color.White, modifier = Modifier.size(14.dp)) }
                    Box(
                        Modifier.size(28.dp).clip(CircleShape).background(WTheme.surfaceHover)
                            .border(1.5.dp, WTheme.border, CircleShape)
                            .clickableNoRipple { scope.launch { FriendsService.decline(r.id) } },
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.Close, "Decline ${r.username}", tint = WTheme.textMuted, modifier = Modifier.size(14.dp)) }
                }
            }
        }

        // Sent requests — the loop's missing feedback (Tier 1, Aug 11):
        // sending a request now visibly puts something here, with a cancel.
        if (outgoing.isNotEmpty()) {
            Text(
                "SENT — WAITING", fontSize = 10.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito,
            )
            outgoing.forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    FriendAvatar(r)
                    Text(
                        buildAnnotatedString {
                            append(r.username)
                            withStyle(SpanStyle(color = WTheme.textMuted, fontSize = 10.sp)) {
                                append("  · ${agoShort(r.requestedAt)}")
                            }
                        },
                        fontSize = 12.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                        color = WTheme.text, maxLines = 1,
                        modifier = Modifier.weight(1f).clickableNoRipple { onOpenProfile(r.id) },
                    )
                    // §212: the invite usually died unseen — re-push, 1/24h.
                    val reminded = withinDay(r.remindedAt)
                    Box(
                        Modifier.clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFF7C3AED).copy(alpha = 0.09f))
                            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(10.dp))
                            .clickableNoRipple {
                                if (reminded) return@clickableNoRipple
                                scope.launch {
                                    inviteNote = when (FriendsService.remind(r.id)) {
                                        FriendsService.RemindOutcome.REMINDED -> "Reminder sent to ${r.username} 🔔"
                                        FriendsService.RemindOutcome.ALREADY -> "Already reminded today"
                                        FriendsService.RemindOutcome.FAILED -> "Could not remind"
                                    }
                                }
                            }
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                            .alpha(if (reminded) 0.55f else 1f),
                    ) {
                        Text(
                            if (reminded) "Reminded" else "Remind", fontSize = 10.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            color = Color(0xFF7C3AED), fontFamily = Nunito,
                        )
                    }
                    Box(
                        Modifier.clip(RoundedCornerShape(10.dp)).background(WTheme.surfaceHover)
                            .border(1.5.dp, WTheme.border, RoundedCornerShape(10.dp))
                            .clickableNoRipple { scope.launch { FriendsService.decline(r.id) } }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text(
                            "Cancel", fontSize = 10.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            color = WTheme.textMuted, fontFamily = Nunito,
                        )
                    }
                }
            }
        }

        inviteNote?.let {
            // Tap dismisses early (the 2.5s auto-clear above is the default).
            Text(
                it, fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                color = WTheme.textMuted,
                modifier = Modifier.clickableNoRipple { inviteNote = null },
            )
        }
    }
    }
    }

    // §225: unfriend confirm — reachable from the row menu now, not just the
    // buried profile-page button. FriendsService.remove drops the cached row
    // immediately; the forced reload refreshes podium/digest to match.
    unfriendTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { unfriendTarget = null },
            title = { Text("Unfriend ${target.username}?", fontWeight = androidx.compose.ui.text.font.FontWeight.Black, fontFamily = Nunito) },
            text = { Text("You can re-add them anytime.", fontFamily = Nunito) },
            confirmButton = {
                TextButton(onClick = {
                    val id = target.id
                    unfriendTarget = null
                    scope.launch { FriendsService.remove(id); FriendsService.load(force = true) }
                }) { Text("Unfriend", color = Color(0xFFDC2626), fontWeight = androidx.compose.ui.text.font.FontWeight.Black) }
            },
            dismissButton = {
                TextButton(onClick = { unfriendTarget = null }) { Text("Keep", fontWeight = androidx.compose.ui.text.font.FontWeight.Black) }
            },
        )
    }

    // Taunt picker — the leaderboard dialog's twin (§207 fixed phrases).
    tauntTarget?.let { target ->
        androidx.compose.ui.window.Dialog(onDismissRequest = { tauntTarget = null; tauntStatus = null }) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
            ) {
                Text(
                    "TAUNT ${target.username.uppercase()}",
                    fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                    color = WTheme.textMuted, letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                )
                PanelDivider()
                val status = tauntStatus
                if (status != null) {
                    Text(
                        status, fontSize = 14.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, color = WTheme.text,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    )
                } else {
                    com.wordocious.app.data.FriendTaunts.ALL.forEach { taunt ->
                        Text(
                            taunt.text, fontSize = 13.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, color = WTheme.text,
                            modifier = Modifier.fillMaxWidth().clickableNoRipple {
                                scope.launch {
                                    val outcome = FriendsService.taunt(
                                        target.id, taunt.id, com.wordocious.app.todayLocalDate())
                                    tauntStatus = when (outcome) {
                                        FriendsService.TauntOutcome.SENT -> "Sent 😈"
                                        FriendsService.TauntOutcome.ALREADY_SENT -> "Already taunted them today"
                                        FriendsService.TauntOutcome.FAILED -> "Could not send"
                                    }
                                    delay(1400)
                                    tauntTarget = null
                                    tauntStatus = null
                                }
                            }.padding(horizontal = 16.dp, vertical = 13.dp),
                        )
                        PanelDivider()
                    }
                    Text(
                        "Cancel", fontSize = 12.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, color = WTheme.textMuted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clickableNoRipple { tauntTarget = null }
                            .padding(vertical = 13.dp),
                    )
                }
            }
        }
    }
}

// §225: tap opens the profile, long-press opens the row menu — the no-ripple
// twin of Util.clickableNoRipple for rows that need both gestures.
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Modifier.combinedClickableNoRipple(onLongClick: () -> Unit, onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    return this.combinedClickable(
        interactionSource = interaction, indication = null,
        onLongClick = onLongClick, onClick = onClick,
    )
}

/** "5/9 today · 🔥12 · 7–4 you" — the row's engagement digest (§212). */
private fun statusLine(f: FriendsService.FriendProfile, played: Int): String {
    val parts = mutableListOf<String>()
    if (played > 0) {
        var lead = "$played/9 today"
        // §225: played rows show today's score — "5/9 today · 2,116 pts".
        // The digest carries todayPoints since §216; US locale pins the
        // comma grouping the copy spec shows. §238: points ride right after
        // the count so "N pts" clearly belongs to "today"; streak follows.
        f.todayPoints?.takeIf { it > 0 }?.let { lead += " · ${String.format(java.util.Locale.US, "%,d", it)} pts" }
        f.streak?.takeIf { it > 0 }?.let { lead += " · 🔥$it" }
        parts.add(lead)
    } else {
        parts.add("hasn't played today")
    }
    // §238 (founder: "18–7 you doesn't really make sense"): the rivalry
    // record now says who's ahead in plain words.
    val w = f.h2hW ?: 0; val l = f.h2hL ?: 0
    if (w + l > 0) parts.add(
        when {
            w == l -> "tied $w–$l"
            w > l -> "you lead $w–$l"
            else -> "they lead $l–$w"
        },
    )
    return parts.joinToString(" · ")
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

/** §238: 4th/5th/…/21st/22nd — the ranked rows under the podium. */
private fun ordinal(n: Int): String {
    val v = n % 100
    if (v in 11..13) return "${n}th"
    return n.toString() + when (n % 10) { 1 -> "st"; 2 -> "nd"; 3 -> "rd"; else -> "th" }
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
    Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
}

internal data class PodiumEntry(
    val id: String, val username: String, val avatarUrl: String?,
    val avatarEmoji: String?, val pts: Int, val isMe: Boolean,
)

@Composable
private fun PodiumAvatar(e: PodiumEntry) {
    val url = e.avatarUrl?.takeIf { it.isNotBlank() }
    Box(
        Modifier.size(34.dp).clip(CircleShape)
            .background(if (url == null) Color(0xFF7C3AED).copy(alpha = 0.13f) else Color.Transparent),
        contentAlignment = Alignment.Center,
    ) {
        if (url != null) {
            coil.compose.AsyncImage(
                model = url, contentDescription = e.username,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
        } else {
            val emoji = e.avatarEmoji?.trim().orEmpty()
            Text(
                if (emoji.isNotEmpty()) emoji else e.username.take(1).uppercase(),
                fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                color = Color(0xFF7C3AED),
            )
        }
    }
}

// FRIENDS row (§207 Tier 3, Aug 11) — the compact card on the OWN profile
// screen pointing at the dedicated Friends screen. Web FriendsRowLink / iOS
// FriendsRowLink parity: Users icon, gradient FRIENDS, count, red pending
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
        Icon(Icons.Filled.People, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(16.dp))
        Text(
            "FRIENDS",
            fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
            style = TextStyle(
                brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899))),
                fontFamily = Nunito,
            ),
        )
        if (friendCount > 0) {
            Text(
                "$friendCount", fontSize = 12.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black, color = WTheme.textMuted,
            )
        }
        Spacer(Modifier.weight(1f))
        if (pending > 0) {
            Box(
                Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0xFFEF4444))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
            ) {
                Text(
                    if (pending == 1) "1 request" else "$pending requests",
                    fontSize = 9.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                    color = Color.White, fontFamily = Nunito,
                )
            }
        }
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight, null,
            tint = WTheme.textMuted, modifier = Modifier.size(18.dp),
        )
    }
}

// The dedicated Friends screen (§207 Tier 3) — the full panel with room to
// breathe, pushed in-tab like PublicProfileScreen (web /friends parity).
@Composable
fun FriendsScreen(onClose: () -> Unit, onOpenProfile: (String) -> Unit = {}) {
    Column(
        Modifier.fillMaxSize().background(WTheme.bg)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            Modifier.clickableNoRipple(onClose).padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color(0xFF7C3AED), modifier = Modifier.size(18.dp))
            Text(
                "Back", fontSize = 13.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black, color = Color(0xFF7C3AED),
            )
        }
        FriendsPanel(onOpenProfile = onOpenProfile)
        // §212: recruiting and friending are the same motion — the gift-Pro
        // panel lives here too.
        InvitePanel()
        // §218: the pushed screen renders under the BottomNav — clear it so
        // the gift-Pro card's tail is reachable (iOS chrome.bottomInset twin).
        Spacer(Modifier.height(96.dp))
    }
}

/** Accepted within the last 24h — wears the NEW chip (Tier 2, Aug 11). */
private fun isNewFriend(f: FriendsService.FriendProfile): Boolean {
    val since = f.since ?: return false
    val t = runCatching { java.time.OffsetDateTime.parse(since).toInstant().toEpochMilli() }
        .recoverCatching { java.time.Instant.parse(since).toEpochMilli() }
        .getOrNull() ?: return false
    return System.currentTimeMillis() - t < 24 * 60 * 60 * 1000L
}

/** §216: friendship age in days when today is a milestone (7/30/100/365). */
private fun friendversary(f: FriendsService.FriendProfile): Int? {
    val since = f.since ?: return null
    val t = runCatching { java.time.OffsetDateTime.parse(since).toInstant().toEpochMilli() }
        .recoverCatching { java.time.Instant.parse(since).toEpochMilli() }
        .getOrNull() ?: return null
    val days = ((System.currentTimeMillis() - t) / 86_400_000L).toInt()
    return if (days in listOf(7, 30, 100, 365)) days else null
}

@Composable
private fun FriendAvatar(f: FriendsService.FriendProfile) {
    val url = f.avatarUrl?.takeIf { it.isNotBlank() }
    Box(
        Modifier.size(32.dp).clip(CircleShape)
            .background(if (url == null) Color(0xFF7C3AED).copy(alpha = 0.13f) else Color.Transparent),
        contentAlignment = Alignment.Center,
    ) {
        if (url != null) {
            coil.compose.AsyncImage(
                model = url, contentDescription = f.username,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
        } else {
            // Chosen emoji beats the initial (Aug 11 — profile-avatar parity).
            val emoji = f.avatarEmoji?.trim().orEmpty()
            Text(
                if (emoji.isNotEmpty()) emoji else f.username.take(1).uppercase(),
                fontSize = 12.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black, color = Color(0xFF7C3AED),
            )
        }
    }
}
