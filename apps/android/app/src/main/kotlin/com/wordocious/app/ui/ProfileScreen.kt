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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Profile screen — ported from web /profile/page.tsx.
 * Shows: avatar + username + level/XP, stats summary, mode stats, recent matches, sign out.
 */
@Composable
fun ProfileScreen() {
    val profile by AuthService.profile.collectAsState()
    val scope = rememberCoroutineScope()
    var stats by remember { mutableStateOf<List<ProfileService.UserStat>>(emptyList()) }
    var recentMatches by remember { mutableStateOf<List<ProfileService.RecentMatch>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    val userId = profile?.id
    LaunchedEffect(userId) {
        if (userId != null) {
            stats = ProfileService.fetchUserStats(userId)
            recentMatches = ProfileService.fetchRecentMatches(userId)
        }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(WTheme.bg).padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(Modifier.height(8.dp)) }

        // ── Header ────────────────────────────────────────────────
        item {
            Column(
                modifier = Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Avatar placeholder
                Box(
                    Modifier.size(64.dp).clip(CircleShape).background(WTheme.primary.copy(0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Person, null, tint = WTheme.primary, modifier = Modifier.size(36.dp))
                }
                Text(
                    profile?.username ?: "Player",
                    fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                )
                if (profile?.isPro == true) {
                    Text(
                        "PRO",
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Brush.linearGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd)))
                            .padding(horizontal = 8.dp, vertical = 2.dp),
                        fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                    )
                }
                // Level + XP
                val level = profile?.level ?: 1
                val xp = profile?.xp ?: 0
                Text("Level $level", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                // XP progress bar
                val xpToNext = level * 500
                val progress = (xp % xpToNext).toFloat() / xpToNext
                Box(
                    modifier = Modifier.fillMaxWidth(0.7f).height(6.dp)
                        .clip(RoundedCornerShape(3.dp)).background(WTheme.surfaceAlt),
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(Brush.horizontalGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd))),
                    )
                }
                Text("$xp XP", fontSize = 11.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold)
            }
        }

        // ── Stats summary (from profiles: total_wins/total_losses/current_streak) ──
        item {
            val totalWins = profile?.totalWins ?: 0
            val totalLosses = profile?.totalLosses ?: 0
            val streak = profile?.currentStreak ?: 0
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StatPill("Wins", "$totalWins", Modifier.weight(1f))
                StatPill("Losses", "$totalLosses", Modifier.weight(1f))
                StatPill("Streak", "$streak 🔥", Modifier.weight(1f))
            }
        }

        // ── Mode stats ────────────────────────────────────────────
        if (loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
                    CircularProgressIndicator(color = WTheme.primary)
                }
            }
        } else if (stats.isNotEmpty()) {
            item {
                Text(
                    "STATS BY MODE",
                    fontSize = 10.sp, fontWeight = FontWeight.Black,
                    color = WTheme.textMuted, letterSpacing = 1.sp,
                )
            }
            items(stats) { s ->
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(WTheme.surface)
                        .border(1.dp, WTheme.border, RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
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
            item {
                Text(
                    "RECENT MATCHES",
                    fontSize = 10.sp, fontWeight = FontWeight.Black,
                    color = WTheme.textMuted, letterSpacing = 1.sp,
                )
            }
            items(recentMatches) { m ->
                val won = m.winnerId == userId
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(WTheme.surface)
                        .border(1.dp, WTheme.border, RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(modeLabel(m.gameMode), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(m.createdAt.take(10), fontSize = 10.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold)
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        m.player1Score?.let {
                            Text("${it.toInt()} pts", fontSize = 11.sp, color = WTheme.textSecondary, fontWeight = FontWeight.Bold)
                        }
                        Box(
                            Modifier.size(24.dp, 20.dp).clip(RoundedCornerShape(4.dp))
                                .background(if (won) WTheme.winText else WTheme.lossText),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(if (won) "W" else "L", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White)
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
        }

        // ── Sign out ──────────────────────────────────────────────
        item {
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { scope.launch { AuthService.signOut() } },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                colors = ButtonDefaults.buttonColors(containerColor = WTheme.surfaceAlt),
            ) {
                Text("Sign Out", color = WTheme.textSecondary, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StatPill(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(10.dp))
            .background(WTheme.surface).border(1.dp, WTheme.border, RoundedCornerShape(10.dp))
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

private fun modeLabel(mode: String) = when (mode) {
    "DUEL" -> "Classic"; "QUORDLE" -> "QuadWord"; "OCTORDLE" -> "OctoWord"
    "SEQUENCE" -> "Succession"; "RESCUE" -> "Deliverance"
    "DUEL_6" -> "Six"; "DUEL_7" -> "Seven"
    "GAUNTLET" -> "Gauntlet"; "PROPERNOUNDLE" -> "ProperNoundle"
    else -> mode
}

