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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * Help screen — 1:1 port of iOS HelpView / web help-modal.tsx. Three tabs
 * (How to Play / Game Modes / FAQ) with identical copy, examples, and mode list.
 */
@Composable
fun HelpScreen(onDone: () -> Unit, initialTab: Int = 0, showTabs: Boolean = true) {
    var tab by remember { mutableStateOf(initialTab) }
    val tabs = listOf("How to Play", "Game Modes", "FAQ")
    // Game-mode descriptions + FAQ are single-sourced via /api/content.
    val content by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.ContentService.cached()
    ) { value = com.wordocious.app.data.ContentService.load() }

    Column(Modifier.fillMaxSize().background(WTheme.surface)) {
        // Top accent bar (purple → pink → amber)
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(tabs[tab].uppercase(), fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f), style = TextStyle(brush = WTheme.wordmarkGradient))
            Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onDone))
        }
        // Tab chips — hidden when opened for a single section (e.g. FAQ from the
        // menu / footer), where the pill switcher makes no sense.
        if (showTabs) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                tabs.forEachIndexed { i, t ->
                    Text(
                        t, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = if (tab == i) WTheme.surface else WTheme.textSecondary,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(if (tab == i) WTheme.text else WTheme.surfaceAlt)
                            .clickableNoRipple { tab = i }.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (tab) {
                0 -> HowToPlay()
                1 -> GameModesHelp(content?.helpModes ?: emptyList())
                else -> Faq(content?.helpFaq ?: emptyList())
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun HowToPlay() {
    Text(
        "Guess the 5-letter word. Each guess must be a valid word. After each guess, the tiles change color to show how close you are.",
        fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary,
    )
    ExampleRow(listOf("W", "E", "A", "R", "Y"), 0, Color(0xFF7C3AED), "W", Color(0xFF7C3AED), " is in the word and in the correct spot.")
    ExampleRow(listOf("P", "I", "L", "L", "S"), 1, Color(0xFFF59E0B), "I", Color(0xFFF59E0B), " is in the word but in the wrong spot.")
    ExampleRow(listOf("V", "A", "G", "U", "E"), 3, Color(0xFF6B7280), "U", Color(0xFF6B7280), " is not in the word at all.")
    Text(
        "Daily puzzles reset at your local midnight. Every player gets the same word of the day so you can compare results.",
        fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary,
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.bg)
            .border(1.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
    )
}

@Composable
private fun ExampleRow(letters: List<String>, highlightIdx: Int, fill: Color, hi: String, hiColor: Color, rest: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            letters.forEachIndexed { i, l ->
                val filled = i == highlightIdx
                Box(
                    Modifier.size(36.dp).clip(RoundedCornerShape(4.dp))
                        .background(if (filled) fill else Color.White)
                        .border(2.dp, if (filled) fill else Color(0xFFD1D5DB), RoundedCornerShape(4.dp)),
                    contentAlignment = Alignment.Center,
                ) { Text(l, fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (filled) Color.White else WTheme.text) }
            }
        }
        Row {
            Text(hi, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = hiColor)
            Text(rest, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
        }
    }
}

@Composable
private fun GameModesHelp(modes: List<com.wordocious.app.data.ContentService.HelpMode>) {
    modes.forEach { mode ->
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surfaceHover)
                .border(1.dp, WTheme.divider, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(mode.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(mode.desc, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
        }
    }
}

@Composable
private fun Faq(items: List<com.wordocious.app.data.ContentService.FaqItem>) {
    items.forEach { item ->
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.q, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(item.a, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
        }
    }
}

// ── Info pages (About / Privacy / Terms / Support) ────────────────────────────
private data class InfoSec(val heading: String, val body: String? = null, val bullets: List<String> = emptyList())

@Composable
fun InfoScreen(kind: String, onDone: () -> Unit) {
    val title = when (kind) {
        "about" -> "About Wordocious"; "privacy" -> "Privacy Policy"; "terms" -> "Terms of Service"; else -> "Help & Support"
    }
    val subtitle = when (kind) {
        "about" -> "Epic Word Battles — Daily Puzzles & Multiplayer Showdowns"
        "privacy" -> "Effective April 14, 2026"
        "terms" -> "Effective April 10, 2026"
        else -> "Got a question? We've got answers."
    }
    val contact = when (kind) { "terms" -> "legal@wordocious.com"; "support" -> "support@wordocious.com"; else -> null }
    // About + Support are single-sourced via /api/content; Privacy + Terms stay hardcoded.
    val fromApi = kind == "about" || kind == "support"
    val content by androidx.compose.runtime.produceState(
        initialValue = if (fromApi) com.wordocious.app.data.ContentService.cached() else null
    ) { if (fromApi) value = com.wordocious.app.data.ContentService.load() }
    val contentSections = if (kind == "about") content?.about else content?.support

    Column(Modifier.fillMaxSize().background(WTheme.surface)) {
        // Accent bar — matches How to Play / the other menu screens.
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(title.uppercase(), fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f), style = TextStyle(brush = WTheme.wordmarkGradient))
            Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onDone))
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(subtitle, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            if (fromApi) {
                val cs = contentSections ?: emptyList()
                if (cs.isEmpty()) Text("Loading…", fontSize = 12.sp, color = WTheme.textMuted)
                else cs.forEach { ContentSectionCard(it) }
            } else {
                infoSections(kind).forEach { InfoSectionCard(it) }
            }
            if (contact != null) Text(contact, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.primary)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ContentSectionCard(s: com.wordocious.app.data.ContentService.Section) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(s.heading, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        s.paragraphs.forEach { Text(it, fontSize = 12.sp, color = WTheme.textSecondary, lineHeight = 18.sp) }
        s.items.forEach { item ->
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(item.heading, fontSize = 12.sp, fontWeight = FontWeight.Black,
                    color = item.accent?.let { runCatching { Color(("ff" + it.removePrefix("#")).toLong(16)) }.getOrNull() } ?: WTheme.primary)
                Text(item.body, fontSize = 12.sp, color = WTheme.textSecondary, lineHeight = 18.sp)
            }
        }
    }
}

@Composable
private fun InfoSectionCard(s: InfoSec) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(s.heading, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        s.body?.let { Text(it, fontSize = 12.sp, color = WTheme.textSecondary, lineHeight = 18.sp) }
        s.bullets.forEach { b ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("•", color = WTheme.primary, fontSize = 12.sp)
                Text(b, fontSize = 12.sp, color = WTheme.textSecondary, lineHeight = 18.sp)
            }
        }
    }
}

// Only Privacy + Terms are hardcoded here (offline / pre-sign-in compliance).
// About + Support come from /api/content via ContentService.
private fun infoSections(kind: String): List<InfoSec> = when (kind) {
    "privacy" -> listOf(
        InfoSec("Introduction", "This policy explains what Wordocious collects, how we use it, and your choices."),
        InfoSec("Information We Collect", bullets = listOf("Email address — provided during sign-up or via Google OAuth", "Username / display name — chosen when creating your profile", "Game statistics — scores, win/loss, completion times across all modes", "Streak data — daily streak counts and history", "Device and usage information — browser type, usage patterns, anonymous analytics")),
        InfoSec("How We Use Your Information", bullets = listOf("To create and manage your account", "To track game progress, streaks, and statistics", "To display leaderboards and records", "To improve and maintain the app", "To communicate important service updates")),
        InfoSec("Third-Party Services", bullets = listOf("Supabase — authentication and secure data storage", "Vercel — web hosting", "Google OAuth — optional sign-in; we receive only email + display name", "Google ads — advertisements may be shown to free-tier users; ad-related data collection is governed by Google's privacy policies. Pro subscribers are not shown ads.")),
        InfoSec("Advertising & Data Sharing", "Wordocious may show advertisements to free-tier users, served by Google and subject to Google's Privacy Policy. Pro subscribers enjoy a completely ad-free experience. We do not sell or rent your personal data for marketing beyond what is necessary for ad delivery."),
        InfoSec("Data Security", "We use industry-standard measures to protect your data. No method of transmission or storage is 100% secure, but we work to safeguard your information."),
        InfoSec("Your Rights", "You may request access to, correction of, or deletion of your personal data at any time. You can delete your account from Settings or by contacting us; upon deletion your personal data is removed from our systems."),
        InfoSec("Children's Privacy", "Wordocious is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us data, contact us so we can remove it."),
        InfoSec("Changes to This Policy", "We may update this policy from time to time. Continued use of the app after changes constitutes acceptance of the updated policy."),
        InfoSec("Contact Us", "Questions about this policy or your personal data? Contact us at privacy@wordocious.com."),
    )
    "terms" -> listOf(
        InfoSec("Agreement to Terms", "By using Wordocious you agree to these terms."),
        InfoSec("Eligibility", "You must be at least 13 years of age to use the Service."),
        InfoSec("Your Account", "You're responsible for your account and for activity under it."),
        InfoSec("Acceptable Use", bullets = listOf("No automated tools, bots, scripts, or cheating", "Don't exploit bugs — report them", "No harassment, threats, or abuse", "No offensive/hateful/inappropriate usernames", "Don't access others' accounts or private data", "Don't interfere with or disrupt the Service")),
        InfoSec("Free Tier & Pro Subscription", bullets = listOf("Pro is purchased through Google Play (or the App Store on iOS) via in-app purchase, subject to that store's terms", "Cancel anytime in your Google Play account settings — Pro access continues through the billing period", "Prices may change with advance notice", "Refunds are handled by Google (or Apple) under their policies")),
        InfoSec("Intellectual Property", "Wordocious and its content are owned by us and protected by law."),
        InfoSec("Disclaimer & Limitation of Liability", "The Service is provided \"as is\" without warranties; liability is limited to the extent permitted by law."),
        InfoSec("Termination", "We may suspend or terminate accounts that violate these terms."),
        InfoSec("Contact Us", "Questions about these terms?"),
    )
    else -> emptyList()
}
