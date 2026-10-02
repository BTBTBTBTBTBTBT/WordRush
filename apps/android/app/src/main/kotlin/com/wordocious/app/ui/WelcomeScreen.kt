package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.SportsScore
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.Profanity
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
        // FINISH_SPEC A1 / G5: the first-launch card is a lavender tinted card with the
        // brand top bar; the inputs are tinted and every action is a candy button.
        TintedCard(
            WELCOME_PURPLE, Modifier.widthIn(max = 380.dp).fillMaxWidth().verticalScroll(rememberScrollState()),
            corner = 24.dp,
            bar = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24))),
            tint = accentWash(WELCOME_PURPLE, 0.09f),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
            verticalArrangement = Arrangement.Top,
        ) {
            Column(Modifier.padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 20.dp)) {
                // Wordmark + tagline, under the whole cast around WELCOME! (ART_SPEC §8).
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    // G5 / A7: a cast pose over the title — O1 cheering (not W, the Home host behind this cover).
                    CastPose(MascotId.O1, "cheer", 84.dp)
                    PageHeadline(TitleArt.WELCOME, Modifier.padding(bottom = 8.dp))
                    Text(
                        "WORDOCIOUS", fontSize = 24.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
                        style = androidx.compose.ui.text.TextStyle(brush = Brush.horizontalGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd)), fontFamily = Nunito),
                    )
                    Text("Welcome to Wordocious", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = welcomeMuted())
                }
                Spacer(Modifier.height(16.dp))

                // Three pillars
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    // A1: each pillar a tinted row in its color with a 3D icon tile.
                    Pillar(painterRes = com.wordocious.app.R.drawable.game_practice, tint = Color(0xFF7C3AED),
                        title = "Daily Puzzles", sub = "Eight daily word games and ten More Games, new every day")
                    Pillar(icon3d = Icon3DName.TAB_FRIENDS, tint = Color(0xFFEC4899),
                        title = "Play with Friends", sub = "Today's Race, a weekly finish and VS with friends")
                    Pillar(icon3d = Icon3DName.TROPHY, tint = Color(0xFFF59E0B),
                        title = "Climb the Leaderboards", sub = "Earn medals, build streaks, and track your stats")
                }
                Spacer(Modifier.height(18.dp))

                // Username field
                FinishLabel("CHOOSE A USERNAME")
                Spacer(Modifier.height(6.dp))
                // Branded field (iOS WelcomeView): bold-15, 12-radius, 1.5 border
                // that turns red on error — not Material's outlined chrome.
                BasicTextField(
                    value = username, onValueChange = { username = it; error = null }, singleLine = true,
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontFamily = Nunito, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                        color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                    ),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(WTheme.primary),
                    decorationBox = { inner ->
                        Box {
                            if (username.isEmpty()) {
                                Text("username", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = welcomeMuted())
                            }
                            inner()
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                        // A1: a tinted input (the purple wash + its line), never a white field.
                        .clip(RoundedCornerShape(14.dp))
                        .background(accentWash(WELCOME_PURPLE, 0.12f))
                        .border(1.5.dp, if (error == null) accentLine(WELCOME_PURPLE, 0.40f) else Color(0xFFDC2626), RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                )
                error?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626), modifier = Modifier.padding(top = 4.dp)) }
                    ?: Text(
                        "3-20 characters. Letters, numbers, and underscores.",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = welcomeMuted(),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                Spacer(Modifier.height(14.dp))

                // Get Started — A8: the large purple candy CTA.
                CandyButton(
                    if (saving) "Saving\u2026" else "Let's Play!",
                    onClick = {
                        if (saving) return@CandyButton
                        val t = username.trim()
                        validateUsername(t)?.let { error = it; return@CandyButton }
                        val uid = profile?.id ?: return@CandyButton
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
                    color = CandyColor.PURPLE, size = CandySize.LARGE, fill = true, icon = CandyIcon.PLAY,
                    modifier = Modifier.fillMaxWidth(),
                )

                // Skip for now — A8: a soft peach candy button (was a text link).
                Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) {
                    CandyButton(
                        "Skip for now",
                        onClick = {
                            if (saving) return@CandyButton
                            val uid = profile?.id ?: return@CandyButton
                            saving = true
                            scope.launch {
                                runCatching {
                                    SupabaseConfig.client.postgrest["profiles"].update({ set("has_onboarded", true) }) { filter { eq("id", uid) } }
                                }
                                AuthService.refreshProfile()
                            }
                        },
                        color = CandyColor.PEACH, size = CandySize.MEDIUM,
                    )
                }
            }
        }
    }
}

private val WELCOME_PURPLE = Color(0xFF7C3AED)

@Composable
private fun welcomeMuted(): Color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted

@Composable
private fun Pillar(
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    painterRes: Int? = null,
    tint: Color, title: String, sub: String,
    icon3d: Icon3DName? = null,
) {
    Row(
        Modifier.fillMaxWidth().tintedPill(tint, 14.dp)
            .padding(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 8.dp)
            .semantics(mergeDescendants = true) { },
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(34.dp).miniGameCard(tint, 10.dp), Alignment.Center) {
            when {
                icon3d != null -> Icon3D(icon3d, 24.dp)
                painterRes != null -> androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(painterRes), null, Modifier.size(26.dp))
                icon != null -> Icon(icon, null, tint = tint, modifier = Modifier.size(16.dp))
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
            Text(sub, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = welcomeMuted(), textAlign = TextAlign.Start)
        }
    }
}

private fun validateUsername(name: String): String? {
    val t = name.trim()
    if (t.length < 3) return "At least 3 characters"
    if (t.length > 20) return "20 characters max"
    if (!t.matches(Regex("^[a-zA-Z0-9_]+$"))) return "Letters, numbers, and underscores only"
    // Content screen (core Profanity mirrors the DB word list) — the write
    // below goes straight to PostgREST, so the DB trigger is the authority;
    // this just gives instant feedback instead of "Something went wrong".
    return Profanity.usernameError(t)
}
