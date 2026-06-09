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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.ThemePref
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Settings — 1:1 port of iOS SettingsView / web settings-dialog.tsx.
 * THEME radio cards (live recolor) · Sound · Notifications · Accessibility ·
 * About links · Sign out · Delete account · version. Full-screen with Done.
 */
private val THEMES = listOf(
    Triple("light", "Default", "Classic Wordle colors"),
    Triple("dark", "Dark", "Easy on the eyes"),
    Triple("ocean", "Ocean", "Blue and teal tones"),
    Triple("forest", "Forest", "Green and earth tones"),
)

@Composable
fun SettingsScreen(onDone: () -> Unit, onOpenInfo: (String) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var theme by remember { mutableStateOf(ThemePref.current()) }
    var sound by remember { mutableStateOf(SettingsPref.get(SettingsPref.SOUND, true)) }
    var dailyReminder by remember { mutableStateOf(SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) }
    var colorblind by remember { mutableStateOf(SettingsPref.get(SettingsPref.COLORBLIND, false)) }
    var reducedMotion by remember { mutableStateOf(SettingsPref.get(SettingsPref.REDUCED_MOTION, false)) }

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // Title bar with Done
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Settings", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Spacer(Modifier.weight(1f))
            Text(
                "Done", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple(onDone),
            )
        }

        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // THEME
            Section("THEME") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    THEMES.forEach { (key, label, desc) ->
                        val active = theme == key
                        Row(
                            modifier = Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) WTheme.surfaceHover else WTheme.bg)
                                .border(1.5.dp, if (active) Color(0xFFC4B5FD) else WTheme.border, RoundedCornerShape(12.dp))
                                .clickableNoRipple { ThemePref.set(key); theme = key }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(label, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                                Text(desc, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            }
                            if (active) Icon(Icons.Filled.CheckCircle, null, tint = WTheme.primary, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }

            // SOUND & FEEDBACK
            Section("SOUND & FEEDBACK") {
                Card {
                    ToggleRow("Sound Effects", "Key taps, win/loss jingles", sound) {
                        sound = it; SettingsPref.set(SettingsPref.SOUND, it)
                    }
                }
            }

            // NOTIFICATIONS
            Section("NOTIFICATIONS") {
                Card {
                    ToggleRow("Daily Reminders", "A nudge to play today's puzzles", dailyReminder) {
                        dailyReminder = it; SettingsPref.set(SettingsPref.DAILY_REMINDER, it)
                    }
                }
            }

            // ACCESSIBILITY
            Section("ACCESSIBILITY") {
                Card {
                    ToggleRow("Colorblind Mode", "High contrast colors", colorblind) {
                        colorblind = it; SettingsPref.set(SettingsPref.COLORBLIND, it); WTheme.colorblind = it
                    }
                    Divider()
                    ToggleRow("Reduced Motion", "Minimize animations", reducedMotion) {
                        reducedMotion = it; SettingsPref.set(SettingsPref.REDUCED_MOTION, it); WTheme.reducedMotion = it
                    }
                }
            }

            // ABOUT
            Section("ABOUT") {
                Card {
                    LinkRow("About Wordocious") { onOpenInfo("about") }; Divider()
                    LinkRow("Help & Support") { onOpenInfo("support") }; Divider()
                    LinkRow("Privacy Policy") { onOpenInfo("privacy") }; Divider()
                    LinkRow("Terms of Service") { onOpenInfo("terms") }
                }
            }

            // Account
            Text(
                "Sign Out",
                fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.5.dp, Color(0xFFDC2626), RoundedCornerShape(12.dp))
                    .clickableNoRipple { scope.launch { AuthService.signOut(); onDone() } }
                    .padding(vertical = 12.dp),
            )

            Text(
                "Wordocious · v1.0.0",
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.1.sp)
        content()
    }
}

@Composable
private fun Card(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp)),
    ) { content() }
}

@Composable
private fun ToggleRow(title: String, sub: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            Text(sub, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted)
        }
        Switch(
            checked = checked, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = WTheme.primary),
        )
    }
}

@Composable
private fun LinkRow(title: String, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().clickableNoRipple(onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
}
