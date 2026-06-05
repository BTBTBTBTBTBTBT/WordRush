package com.wordocious.app.ui.placeholder

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * Placeholder screens for tabs 2-4. Each gets replaced with the
 * full audit-then-match screen in subsequent passes.
 * Web source of truth: /daily, /profile, /records pages.
 */

@Composable
fun LeaderboardScreen() {
    PlaceholderScreen("Leaderboard", "Daily rankings coming with Supabase data layer")
}

@Composable
fun ProfileScreen() {
    PlaceholderScreen("Profile", "Stats, XP, medals coming with Supabase data layer")
}

@Composable
fun RecordsScreen() {
    PlaceholderScreen("Records", "All-time hall of records coming with Supabase data layer")
}

@Composable
private fun PlaceholderScreen(title: String, subtitle: String) {
    Column(
        modifier = Modifier.fillMaxSize().background(WTheme.bg).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "WORDOCIOUS", fontSize = 20.sp, fontWeight = FontWeight.Black,
            style = androidx.compose.ui.text.TextStyle(brush = WTheme.wordmarkGradient),
        )
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(title, fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(subtitle, fontSize = 13.sp, color = WTheme.textMuted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}
