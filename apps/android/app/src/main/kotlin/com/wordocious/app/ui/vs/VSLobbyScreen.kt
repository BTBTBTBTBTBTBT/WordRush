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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.VSPlayLimit
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.modeTitle
import com.wordocious.app.ui.modeTitleGradient
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode

/**
 * VS Battle lobby — entry from the Home "VS Battle" card. Free users get one
 * daily Classic VS; Pro unlocks all board modes (unlimited). Ports iOS
 * VSLobbyView. Private-match invites + Gauntlet/ProperNoundle VS are deferred to
 * a follow-up (no InviteService / ProperNoundleVM on Android yet).
 */
private val VS_MODES = listOf(
    GameMode.DUEL, GameMode.DUEL_6, GameMode.DUEL_7,
    GameMode.QUORDLE, GameMode.OCTORDLE, GameMode.SEQUENCE, GameMode.RESCUE,
)

@Composable
fun VSLobbyScreen(onPlay: (GameMode, Boolean) -> Unit, onGoPro: () -> Unit, onClose: () -> Unit) {
    val profile by AuthService.profile.collectAsState()
    val isPro = AuthService.isProActive

    Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(WTheme.bg, WTheme.surfaceHover)))) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Back", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.clickableNoRipple(onClose))
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // Header
            Column(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(painterResource(R.drawable.ic_swords), null, tint = Color(0xFF0D9488), modifier = Modifier.size(40.dp))
                Text("VS Battle", fontSize = 30.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text("Race a live opponent on the same puzzle", fontSize = 13.sp, color = WTheme.textMuted)
            }

            if (isPro) {
                SectionLabel("QUICK MATCH")
                VS_MODES.forEach { m -> ModeRow(m) { onPlay(m, false) } }
            } else {
                val used = VSPlayLimit.hasPlayedToday()
                CtaCard(
                    title = "Play Daily VS",
                    subtitle = if (used) "Used today · resets at midnight" else "One free Classic match a day",
                    gradient = if (used) listOf(Color(0xFF94A3B8), Color(0xFF64748B)) else listOf(Color(0xFF14B8A6), Color(0xFF0D9488)),
                ) { if (!used) onPlay(GameMode.DUEL, true) }
                ProUpsell(onGoPro)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
}

@Composable
private fun ModeRow(mode: GameMode, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp)).clickableNoRipple(onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(modeTitle(mode), fontSize = 16.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(modeTitleGradient(mode))))
        Spacer(Modifier.weight(1f))
        Text("›", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
    }
}

@Composable
private fun CtaCard(title: String, subtitle: String, gradient: List<Color>, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(gradient)).clickableNoRipple(onClick).padding(vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
        Text(subtitle, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.85f))
    }
}

@Composable
private fun ProUpsell(onGoPro: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Unlock with Pro", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = WTheme.textMuted)
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("All modes in VS — unlimited matches", "Rematches", "Ad-free battles").forEach { t ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("✓", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
                    Text(t, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                }
            }
        }
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706)))).clickableNoRipple(onGoPro).padding(vertical = 12.dp),
            Alignment.Center,
        ) { Text("Go Pro", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White) }
    }
}
