package com.wordocious.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.ui.draw.alpha
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
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

        // Weekly race podium (§212) — who owns the week among your circle.
        val podium = remember(version) {
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
            all.sortedByDescending { it.pts }.take(3)
        }
        val raceStarted = podium.any { it.pts > 0 }
        // §216: the week's leader wears the crown — only once someone scored.
        val crownId = if (raceStarted) podium.firstOrNull()?.id else null
        if (podium.isNotEmpty()) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            ) {
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
                            modifier = Modifier.padding(top = if (i == 0) 0.dp else 8.dp),
                        ) {
                            Text(if (raceStarted) listOf("🥇", "🥈", "🥉")[i] else "🏁", fontSize = if (i == 0) 20.sp else 14.sp)
                            PodiumAvatar(e)
                            Text(
                                e.username, fontSize = 10.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                                color = if (e.isMe) Color(0xFF7C3AED) else WTheme.text, maxLines = 1,
                            )
                            Text(
                                "${e.pts} pts", fontSize = 9.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = WTheme.textMuted,
                            )
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.clickableNoRipple { onOpenProfile(f.id) },
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
                    } else if (f.playedToday == 0) {
                        // Slacker bell — one-tap taunt (§207 picker).
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
                    Text(
                        "Lvl ${f.level}", fontSize = 10.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = WTheme.textMuted,
                    )
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
            Text(it, fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, color = WTheme.textMuted)
        }
    }
    }
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

/** "5/9 today · 🔥12 · 7–4 you" — the row's engagement digest (§212). */
private fun statusLine(f: FriendsService.FriendProfile, played: Int): String {
    val parts = mutableListOf<String>()
    if (played > 0) {
        var lead = "$played/9 today"
        f.streak?.takeIf { it > 0 }?.let { lead += " · 🔥$it" }
        parts.add(lead)
    } else {
        parts.add("hasn't played today")
    }
    val w = f.h2hW ?: 0; val l = f.h2hL ?: 0
    if (w + l > 0) parts.add(if (w >= l) "$w–$l you" else "$l–$w them")
    return parts.joinToString(" · ")
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
        Spacer(Modifier.height(24.dp))
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
