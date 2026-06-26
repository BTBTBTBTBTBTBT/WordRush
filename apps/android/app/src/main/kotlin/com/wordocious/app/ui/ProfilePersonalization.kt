package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AchievementCatalog
import com.wordocious.app.data.AchievementService
import com.wordocious.app.data.Profile
import com.wordocious.app.ui.theme.WTheme

/**
 * Accent palette + helpers for profile personalization — mirrors the web
 * `lib/profile-personalization.ts` and iOS ProfilePersonalization.swift so a
 * profile looks identical everywhere. accent_color stores the hex; null = default
 * brand purple.
 */
object ProfileAccent {
    /** (id, hex-string) — id "purple" is the default / "none". */
    val palette: List<Pair<String, String>> = listOf(
        "purple" to "#7C3AED", "blue" to "#2563EB", "teal" to "#0D9488", "green" to "#059669",
        "amber" to "#D97706", "pink" to "#EC4899", "red" to "#DC2626", "slate" to "#475569",
    )
    const val DEFAULT_HEX = "#7C3AED"

    private val darkMap = mapOf(
        "#7C3AED" to "#6D28D9", "#2563EB" to "#1D4ED8", "#0D9488" to "#0F766E", "#059669" to "#047857",
        "#D97706" to "#B45309", "#EC4899" to "#BE185D", "#DC2626" to "#B91C1C", "#475569" to "#334155",
    )

    /** Normalize a stored hex to one of the palette presets, else default. */
    fun hex(stored: String?): String {
        val s = stored?.trim()?.uppercase() ?: return DEFAULT_HEX
        return palette.firstOrNull { it.second.equals(s, true) }?.second ?: DEFAULT_HEX
    }

    fun color(stored: String?): Color = parseHex(hex(stored))
    fun darker(stored: String?): Color = parseHex(darkMap[hex(stored)] ?: hex(stored))
    fun isCustom(stored: String?): Boolean = !stored.isNullOrBlank() && hex(stored) != DEFAULT_HEX

    /** Gradient brush for the avatar fallback when there's no photo. */
    fun avatarBrush(stored: String?): Brush = Brush.linearGradient(listOf(color(stored), darker(stored)))

    private fun parseHex(h: String): Color {
        val v = h.removePrefix("#").toLongOrNull(16) ?: 0x7C3AED
        return Color(0xFF000000 or v)
    }
}

/**
 * Featured-title pill + bio + favorite-mode chip — rendered under the username on
 * the profile header (own + public). Mirrors the web/iOS profile-header.
 */
@Composable
fun ProfilePersonalizationRow(profile: Profile?) {
    if (profile == null) return
    ProfilePersonalizationRow(profile.accentColor, profile.bio, profile.featuredAchievement, profile.favoriteMode)
}

@Composable
fun ProfilePersonalizationRow(accentColor: String?, bioRaw: String?, featuredAchievement: String?, favoriteModeKey: String?) {
    val accent = ProfileAccent.color(accentColor)
    val catalog by produceState(AchievementCatalog.cached(), featuredAchievement) {
        value = AchievementCatalog.load()
    }
    val titleName = featuredAchievement?.let { key -> catalog.firstOrNull { it.key == key }?.name }
    val bio = bioRaw?.trim()?.takeIf { it.isNotEmpty() }
    val favCard = favoriteModeKey?.let { dk -> MODE_CARDS.firstOrNull { it.engineMode?.name == dk } }

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (titleName != null) {
            Row(
                Modifier.background(accent.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("★", fontSize = 10.sp, color = accent)
                Text(titleName.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = accent, letterSpacing = 0.4.sp)
            }
        }
        if (bio != null) {
            Text(bio, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 300.dp))
        }
        if (favCard != null) {
            Row(
                Modifier.background(favCard.accent.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                ModeGlyph(favCard, tint = favCard.accent, glyphSize = 11.sp, iconSize = 14.dp)
                Text(favCard.title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = favCard.accent)
            }
        }
    }
}
