package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState

/**
 * Help screen — 1:1 port of iOS HelpView / web help-modal.tsx. Three tabs
 * (How to Play / Game Modes / FAQ) with identical copy, examples, and mode list.
 * FINISH_SPEC C6: the shared info page — back + help controls, the section's own
 * title art (HOW TO PLAY / GUIDES / FAQ), an intro card, then tinted cards (game
 * modes in each game's color, FAQ as question cards). Tabs are tinted chips that squish.
 */
@Composable
fun HelpScreen(onDone: () -> Unit, initialTab: Int = 0, showTabs: Boolean = true) {
    var tab by remember { mutableStateOf(initialTab) }
    val tabs = listOf("How to Play", "Game Modes", "FAQ")
    // Game-mode descriptions + FAQ are single-sourced via /api/content.
    var contentTry by remember { mutableStateOf(0) }
    var contentDone by remember { mutableStateOf(false) }
    val content by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.ContentService.cached(), contentTry,
    ) { value = com.wordocious.app.data.ContentService.load() ?: value; contentDone = true }
    val art = when (tab) { 0 -> TitleArt.HOWTO; 1 -> TitleArt.GUIDES; else -> TitleArt.FAQ }
    val intro = when (tab) {
        0 -> "Guess the word" to "The basics: tiles, colors and the daily reset."
        1 -> "Every game, at a glance" to "What each daily puzzle asks of you."
        else -> "Questions, answered" to "The things players ask us most."
    }

    InfoPage(tabs[tab], onBack = onDone, art = art, backLabel = "Close", intro = intro) {
        // Tab chips — hidden when opened for a single section (e.g. FAQ from the
        // menu / footer), where the switcher makes no sense.
        if (showTabs) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
                tabs.forEachIndexed { i, t ->
                    HelpTabChip(t, selected = tab == i) { tab = i }
                }
            }
        }
        // Per-tab spacing (iOS: 16 / 8 / 12), so each tab keeps its own rhythm.
        when (tab) {
            0 -> HowToPlay()
            1 -> GameModesHelp(content?.helpModes ?: emptyList())
            else -> if (content?.helpFaq.isNullOrEmpty() && contentDone) {
                HelpOfflineState { contentDone = false; contentTry++ }
            } else Faq(content?.helpFaq ?: emptyList())
        }
    }
}

/** A segmented tab chip (A1 + A9): tinted purple, selected = the stronger tint + ring. */
@Composable
private fun HelpTabChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val accent = Color(0xFF7C3AED)
    Box(
        Modifier.squishClickable(label, role = Role.Tab, onClick = onClick)
            .semantics { this.selected = selected }
            .heightIn(min = 36.dp)
            .miniGameCard(accent, 18.dp, selected = selected)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label, fontSize = 12.5.sp, fontWeight = FontWeight.Black,
            color = if (WTheme.isDark) WTheme.text else if (selected) FinishInk.softNumber else darkenInk(accent),
        )
    }
}

@Composable
private fun HowToPlay() {
    val accent = Color(0xFF7C3AED)
    InfoSectionCard(accent, title = "How to play") {
        InfoBody("Guess the 5-letter word. Each guess must be a valid word. After each guess, the tiles change color to show how close you are.")
        // Example tiles paint from the live tile palette so colorblind mode matches the board.
        Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(vertical = 4.dp)) {
            ExampleRow(listOf("W", "E", "A", "R", "Y"), 0, Color(0xFF7C3AED), "W", Color(0xFF7C3AED), " is in the word and in the correct spot.")
            ExampleRow(listOf("P", "I", "L", "L", "S"), 1, WTheme.tileColor(TileState.PRESENT), "I", WTheme.tileColor(TileState.PRESENT), " is in the word but in the wrong spot.")
            ExampleRow(listOf("V", "A", "G", "U", "E"), 3, WTheme.tileColor(TileState.ABSENT), "U", WTheme.tileColor(TileState.ABSENT), " is not in the word at all.")
        }
    }
    InfoSectionCard(Color(0xFFF59E0B), title = "Daily reset") {
        InfoBody("Daily puzzles reset at your local midnight. Every player gets the same word of the day so you can compare results.")
    }
}

@Composable
private fun ExampleRow(letters: List<String>, highlightIdx: Int, fill: Color, hi: String, hiColor: Color, rest: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            letters.forEachIndexed { i, l ->
                val filled = i == highlightIdx
                // A1: the empty example tiles take a soft lavender wash, never plain white.
                Box(
                    Modifier.size(36.dp).clip(RoundedCornerShape(6.dp))
                        .background(if (filled) fill else accentWash(Color(0xFF7C3AED), 0.10f))
                        .border(2.dp, if (filled) fill else accentLine(Color(0xFF7C3AED)), RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center,
                ) { Text(l, fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (filled) Color.White else InfoInk.heading) }
            }
        }
        Row {
            Text(hi, fontSize = 12.5.sp, fontWeight = FontWeight.Black, color = hiColor)
            Text(rest, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = InfoInk.body)
        }
    }
}

@Composable
private fun GameModesHelp(modes: List<com.wordocious.app.data.ContentService.HelpMode>) {
    // iOS drives this list from the local mode catalog and uses /api/content only to
    // override the description, so the tab is complete offline and keeps its icons.
    // The home tiles (minus the More Games tile itself) followed by every More
    // Games title this viewer can see, so ProperNoundle keeps its help row.
    val helpCards = MODE_CARDS.filter { it.id != "more" } + visibleDailyCards().filter { it !in MODE_CARDS }
    helpCards.forEach { card ->
        // C6: each game in its own color — tinted card, top bar, the game's 3D icon.
        TintedCard(
            card.accent, Modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) { ModeGlyph(card, card.accent, box = 40.dp) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(card.title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = InfoInk.heading)
                    Text(
                        modes.firstOrNull { it.title == card.title }?.desc ?: card.desc,
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted,
                    )
                }
            }
        }
    }
}

/** BI24: content that came back empty (offline, nothing cached): R unplugged + Try again. */
@Composable
private fun HelpOfflineState(onRetry: () -> Unit) {
    BrandEmptyState(
        title = "CAN'T REACH THE SERVER",
        line = "Check your connection and we'll load this page again.",
        modifier = Modifier.padding(top = 16.dp),
        scene = SceneArt.UNPLUGGED,
        actionLabel = "Try again", onAction = onRetry,
    )
}

@Composable
private fun Faq(items: List<com.wordocious.app.data.ContentService.FaqItem>) {
    if (items.isEmpty()) {
        CastLoader(null, Modifier.padding(top = 24.dp).fillMaxWidth())
        return
    }
    // C6: FAQ as question cards — each a tinted card with a Q tile and its answer.
    val accent = Color(0xFF8B5CF6)
    items.forEach { item ->
        InfoSectionCard(
            accent, Modifier.semantics(mergeDescendants = true) { }, title = item.q,
            leading = {
                InfoIconTile(accent, 28.dp) {
                    Text("Q", fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else darkenInk(accent))
                }
            },
        ) {
            InfoBody(item.a)
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
        "about" -> "Daily Word Games — the same puzzles for everyone"
        "privacy" -> "Effective July 30, 2026"
        "terms" -> "Effective April 10, 2026"
        else -> "Got a question? We've got answers."
    }
    val contact = when (kind) { "terms" -> "legal@wordocious.com"; "support" -> "support@wordocious.com"; else -> null }
    // About + Support are single-sourced via /api/content; Privacy + Terms stay hardcoded.
    val fromApi = kind == "about" || kind == "support"
    var contentTry by remember { mutableStateOf(0) }
    var contentDone by remember { mutableStateOf(false) }
    val content by androidx.compose.runtime.produceState(
        initialValue = if (fromApi) com.wordocious.app.data.ContentService.cached() else null, contentTry,
    ) { if (fromApi) { value = com.wordocious.app.data.ContentService.load() ?: value; contentDone = true } }
    val contentSections = if (kind == "about") content?.about else content?.support
    // C6: Privacy and Terms wear their own title art; the section cards take the page's color.
    val art = when (kind) { "privacy" -> TitleArt.PRIVACY; "terms" -> TitleArt.TERMS; else -> null }
    val accent = INFO_NAV.firstOrNull { it.route == kind }?.accent ?: Color(0xFF7C3AED)

    InfoPage(title, onBack = onDone, art = art, backLabel = "Close", intro = title to subtitle) {
        if (fromApi) {
            val cs = contentSections ?: emptyList()
            if (cs.isEmpty() && contentDone) HelpOfflineState { contentDone = false; contentTry++ }
            else if (cs.isEmpty()) CastLoader(null, Modifier.padding(top = 24.dp).fillMaxWidth())
            else cs.forEach { ContentSectionCard(it, accent) }
        } else {
            infoSections(kind).forEach { InfoSectionCardFor(it, accent) }
        }
        if (contact != null) {
            Text(
                contact, fontSize = 13.sp, fontWeight = FontWeight.Black,
                color = if (WTheme.isDark) WTheme.primary else darkenInk(accent),
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

@Composable
private fun ContentSectionCard(s: com.wordocious.app.data.ContentService.Section, accent: Color) {
    InfoSectionCard(accent, title = s.heading) {
        s.paragraphs.forEach { InfoBody(it) }
        s.items.forEach { item ->
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(item.heading, fontSize = 13.sp, fontWeight = FontWeight.Black,
                    color = item.accent?.let { runCatching { Color(("ff" + it.removePrefix("#")).toLong(16)) }.getOrNull() } ?: WTheme.primary)
                InfoBody(item.body)
            }
        }
    }
}

@Composable
private fun InfoSectionCardFor(s: InfoSec, accent: Color) {
    InfoSectionCard(accent, title = s.heading) {
        s.body?.let { InfoBody(it) }
        s.bullets.forEach { b -> InfoBullet(accent) { InfoBody(b) } }
    }
}

// Only Privacy + Terms are hardcoded here (offline / pre-sign-in compliance).
// About + Support come from /api/content via ContentService.
private fun infoSections(kind: String): List<InfoSec> = when (kind) {
    "privacy" -> listOf(
        InfoSec("Introduction", "This policy explains what Wordocious collects, how we use it, and your choices."),
        InfoSec("Information We Collect", bullets = listOf("Email address — provided during sign-up or via Google OAuth", "Username / display name — chosen when creating your profile", "Game statistics — scores, win/loss, completion times across all modes", "Streak data — daily streak counts and history", "Device and usage information — device type, usage patterns, and anonymous analytics", "Advertising identifier — free tier only, and only while ads are enabled: the Google Advertising ID, shared with our advertising partner to serve and measure ads; Pro subscribers see no ads", "Crash and diagnostic data — when the app crashes or hits an error we record the fault, device model, OS version, and app version so we can fix it", "Push notification token — stored only if you enable notifications, so we can send daily-puzzle and match reminders")),
        InfoSec("How We Use Your Information", bullets = listOf("To create and manage your account", "To track game progress, streaks, and statistics", "To display leaderboards and records", "To improve and maintain the app", "To communicate important service updates")),
        InfoSec("Third-Party Services", bullets = listOf("Supabase — authentication and secure data storage", "Vercel — web hosting", "Google OAuth — optional sign-in; we receive only email + display name", "Sentry — crash and error reporting; receives diagnostic data about faults, including your account identifier, so we can trace and fix them", "Firebase Cloud Messaging — delivers push notifications if you enable them", "Google Play — processes Pro purchases made in the app and tells our servers when a subscription starts, renews, or ends", "Stripe — payment processor for purchases made on our website; card details go directly to Stripe and we never see or store them", "Advertising partner — when ads are enabled, a third-party advertising network serves interstitial ads to free-tier players before a game; it receives the device advertising identifier and standard ad-request data under its own privacy policy, and we name it here whenever ads are active")),
        InfoSec("Advertising & Data Sharing", "Free-tier players may be shown an interstitial advertisement before a game session, served by a third-party advertising partner. Where the law requires it we ask for consent first — in the European Economic Area, the United Kingdom and Switzerland no ad is shown without it. You can reset or limit your advertising identifier in your device settings. Pro subscribers enjoy a completely ad-free experience. We do not sell your personal information, and we do not share it with third parties for their own marketing."),
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
        InfoSec("Contact Us", "Questions about these terms? Contact us at legal@wordocious.com."),
    )
    else -> emptyList()
}
