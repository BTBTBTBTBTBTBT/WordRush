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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

/**
 * First-run onboarding — ports iOS WelcomeView / web WelcomeModal. Shown once
 * when a new account has `has_onboarded == false`: a welcome card with three
 * pillars and a username picker (Get Started / Skip). Both paths set
 * `has_onboarded = true`; refreshProfile() then dismisses this cover.
 */
@Composable
fun WelcomeScreen() {
    val profile by AuthService.profile.collectAsState()
    val scope = rememberCoroutineScope()
    var username by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(profile?.id) { username = profile?.username ?: "" }

    Box(
        Modifier.fillMaxSize().background(Color(0xFF1A1A2E).copy(alpha = 0.55f)).padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 360.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(20.dp)),
        ) {
            // Top gradient accent bar
            Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))

            Column(Modifier.padding(horizontal = 24.dp).padding(top = 20.dp, bottom = 20.dp)) {
                // Wordmark + tagline
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "WORDOCIOUS", fontSize = 24.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
                        style = androidx.compose.ui.text.TextStyle(brush = Brush.horizontalGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd))),
                    )
                    Text("Welcome to Epic Word Battles", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Spacer(Modifier.height(16.dp))

                // Three pillars
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Pillar(painterRes = com.wordocious.app.R.drawable.ic_star, tint = Color(0xFF7C3AED), bg = Color(0xFFF3F0FF),
                        title = "Daily Puzzles", sub = "New challenges every day across 9 unique game modes")
                    Pillar(painterRes = com.wordocious.app.R.drawable.ic_swords, tint = Color(0xFFEC4899), bg = Color(0xFFFDF2F8),
                        title = "Compete Head-to-Head", sub = "Challenge friends or get matched with random opponents")
                    Pillar(icon = Icons.Filled.EmojiEvents, tint = Color(0xFFD97706), bg = Color(0xFFFFFBEB),
                        title = "Climb the Leaderboards", sub = "Earn medals, build streaks, and track your stats")
                }
                Spacer(Modifier.height(18.dp))

                // Username field
                Text("CHOOSE A USERNAME", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = username, onValueChange = { username = it; error = null }, singleLine = true,
                    placeholder = { Text("username", color = WTheme.textMuted) },
                    isError = error != null,
                    modifier = Modifier.fillMaxWidth(),
                    colors = TextFieldDefaults.colors(focusedContainerColor = WTheme.bg, unfocusedContainerColor = WTheme.bg),
                )
                error?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626), modifier = Modifier.padding(top = 4.dp)) }
                    ?: Text(
                        "3-20 characters. Letters, numbers, and underscores.",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                Spacer(Modifier.height(14.dp))

                // Get Started
                Box(
                    Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(12.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))))
                        .clickableNoRipple {
                            if (saving) return@clickableNoRipple
                            val t = username.trim()
                            validateUsername(t)?.let { error = it; return@clickableNoRipple }
                            val uid = profile?.id ?: return@clickableNoRipple
                            saving = true; error = null
                            scope.launch {
                                val ok = runCatching {
                                    SupabaseConfig.client.postgrest["profiles"].update({
                                        set("username", t); set("has_onboarded", true)
                                    }) { filter { eq("id", uid) } }
                                }
                                if (ok.isSuccess) { AuthService.refreshProfile() }
                                else {
                                    val msg = ok.exceptionOrNull()?.message ?: ""
                                    error = if (msg.contains("23505") || msg.contains("duplicate", true)) "Username already taken" else "Something went wrong"
                                    saving = false
                                }
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(if (saving) "Saving…" else "Let's Play!", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color.White)
                }

                // Skip for now
                Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) {
                    Text(
                        "Skip for now", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        modifier = Modifier.clickableNoRipple {
                            if (saving) return@clickableNoRipple
                            val uid = profile?.id ?: return@clickableNoRipple
                            saving = true
                            scope.launch {
                                runCatching {
                                    SupabaseConfig.client.postgrest["profiles"].update({ set("has_onboarded", true) }) { filter { eq("id", uid) } }
                                }
                                AuthService.refreshProfile()
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun Pillar(
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    painterRes: Int? = null,
    tint: Color, bg: Color, title: String, sub: String,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(bg), Alignment.Center) {
            when {
                icon != null -> Icon(icon, null, tint = tint, modifier = Modifier.size(14.dp))
                painterRes != null -> Icon(androidx.compose.ui.res.painterResource(painterRes), null, tint = tint, modifier = Modifier.size(14.dp))
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(sub, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Start)
        }
    }
}

private fun validateUsername(name: String): String? {
    val t = name.trim()
    if (t.length < 3) return "At least 3 characters"
    if (t.length > 20) return "20 characters max"
    if (!t.matches(Regex("^[a-zA-Z0-9_]+$"))) return "Letters, numbers, and underscores only"
    return null
}
