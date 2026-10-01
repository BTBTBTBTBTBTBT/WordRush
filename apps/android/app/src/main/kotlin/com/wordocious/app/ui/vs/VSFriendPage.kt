package com.wordocious.app.ui.vs

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.StatsDeepService
import com.wordocious.app.ui.InviteSheet
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.core.GameMode

/**
 * The Friend page, `CHALLENGE` (VS overhaul §3, founder 2026-10-01) — Pro to
 * send. RACE MY RUN (default): pick friends and/or a link, play a fresh seed,
 * then the run goes out (they race it any time in 24 h). LIVE NOW: the
 * existing live invite flow (link or @username into a private lobby).
 */
@Composable
fun VsFriendPage(
    mode: GameMode,
    preselect: String?,
    onBack: () -> Unit,
    onSend: (friendIds: List<String>, link: Boolean) -> Unit,
) {
    var liveTab by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var picked by remember { mutableStateOf(preselect?.let { setOf(it.lowercase()) } ?: emptySet()) }
    var link by remember { mutableStateOf(false) }
    var friends by remember { mutableStateOf(FriendsService.friends) }
    var loaded by remember { mutableStateOf(FriendsService.loaded) }
    var rivals by remember { mutableStateOf<Map<String, StatsDeepService.Rivalry>>(emptyMap()) }
    LaunchedEffect(Unit) {
        FriendsService.load()
        friends = FriendsService.friends
        loaded = true
        AuthService.userId?.let { uid -> rivals = StatsDeepService.rivalries(uid, 50).associateBy { it.opponentId.lowercase() } }
    }
    if (showInvite) InviteSheet { showInvite = false }
    Column(Modifier.fillMaxSize().background(VsTeal.page)) {
        VsNavBar("CHALLENGE", onBack = onBack) { VsModeChip(mode) }
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Segmented control on #ccfbf1.
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(VsTeal.soft).padding(3.dp)) {
                listOf(false to ("RACE MY RUN" to "they play any time in 24 h"), true to ("LIVE NOW" to "both online")).forEach { (live, labels) ->
                    val on = liveTab == live
                    Column(
                        Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (on) Color.White else Color.Transparent)
                            .clickableNoRipple { liveTab = live }.padding(vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(labels.first, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.ink)
                        Text(labels.second, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                    }
                }
            }
            if (liveTab) {
                VsCard(padding = 16.dp) {
                    Text("Play live together", fontSize = 15.sp, fontWeight = FontWeight.Black, color = VsTeal.deep)
                    Text(
                        "Send a private match link or invite by @username — the match starts when you’re both in the lobby.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub,
                    )
                    VsTealButton("INVITE TO A LIVE MATCH", Modifier.fillMaxWidth()) { showInvite = true }
                }
            } else {
                VsSectionLabel("FRIENDS")
                if (!loaded) {
                    Box(Modifier.fillMaxWidth().padding(16.dp), Alignment.Center) { CircularProgressIndicator(color = VsTeal.ink) }
                } else if (friends.isEmpty()) {
                    Text("No friends yet — add some on the Friends tab, or send a link.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub)
                }
                friends.forEach { f ->
                    val id = f.id.lowercase()
                    val on = id in picked
                    val r = rivals[id]
                    val h2h = when {
                        r != null -> vsRivalLine(r.wins, r.losses, r.lastMode)
                        (f.h2hW ?: 0) + (f.h2hL ?: 0) > 0 -> vsRivalLine(f.h2hW ?: 0, f.h2hL ?: 0, null)
                        else -> "Never played · new friend"
                    }
                    PickRow(on, onClick = { picked = if (on) picked - id else picked + id }) {
                        VsAvatar(f.username, f.avatarUrl, size = 36.dp, borderColor = Color.Transparent)
                        Column(Modifier.weight(1f)) {
                            Text("@${f.username}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, maxLines = 1)
                            Text(h2h, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, maxLines = 1)
                        }
                    }
                }
                PickRow(link, onClick = { link = !link }) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(VsTeal.soft), Alignment.Center) {
                        Icon(Icons.Filled.Link, null, tint = VsTeal.ink, modifier = Modifier.size(18.dp))
                    }
                    Text("Send a link instead", fontSize = 13.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, modifier = Modifier.weight(1f))
                }
                val n = picked.size
                val cta = when {
                    n == 1 -> "PLAY, THEN SEND TO 1 FRIEND"
                    n > 1 -> "PLAY, THEN SEND TO $n FRIENDS"
                    link -> "PLAY, THEN SHARE A LINK"
                    else -> "PLAY, THEN SEND"
                }
                VsTealButton(cta, Modifier.fillMaxWidth(), enabled = n > 0 || link) {
                    // Keep the server's ids (original case) for the picked rows.
                    val ids = friends.filter { it.id.lowercase() in picked }.map { it.id }
                    onSend(ids, link)
                }
                Text(
                    "They get a notification with your time to beat.",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.label, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** A selectable row: round check on the right, 2px teal ring when picked. */
@Composable
private fun PickRow(on: Boolean, onClick: () -> Unit, content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().vsCard()
            .then(if (on) Modifier.border(2.dp, VsTeal.ink, RoundedCornerShape(14.dp)) else Modifier)
            .clickableNoRipple(onClick).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        content()
        Box(
            Modifier.size(24.dp).clip(CircleShape)
                .background(if (on) VsTeal.ink else Color.White)
                .border(1.5.dp, if (on) VsTeal.ink else Color(0xFFD1D5DB), CircleShape),
            Alignment.Center,
        ) { if (on) Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(14.dp)) }
    }
}
