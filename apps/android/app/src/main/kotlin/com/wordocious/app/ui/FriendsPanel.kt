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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.People
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
import androidx.compose.ui.text.TextStyle
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
    val scope = rememberCoroutineScope()
    LaunchedEffect(note) { if (note != null) { delay(2_500); note = null } }

    // The version read keeps this card recomposing on cache changes.
    val friends = remember(version) { FriendsService.friends }
    val incoming = remember(version) { FriendsService.incoming }

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

        // Friends list — avatar rows into their profiles (H2H lives there).
        if (friends.isNotEmpty()) {
            friends.forEach { f ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.clickableNoRipple { onOpenProfile(f.id) },
                ) {
                    FriendAvatar(f)
                    Text(
                        f.username, fontSize = 12.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                        color = WTheme.text, maxLines = 1, modifier = Modifier.weight(1f),
                    )
                    Text(
                        "Lvl ${f.level}", fontSize = 10.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
            }
        } else {
            Text(
                "Add friends to unlock the Friends leaderboard — your own private race on every daily board.",
                fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                color = WTheme.textMuted, fontFamily = Nunito,
            )
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
        note?.let {
            Text(it, fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, color = WTheme.textMuted)
        }
    }
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
            Text(
                f.username.take(1).uppercase(), fontSize = 12.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Black, color = Color(0xFF7C3AED),
            )
        }
    }
}
