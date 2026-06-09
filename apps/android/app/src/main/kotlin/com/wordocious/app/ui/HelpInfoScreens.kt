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
fun HelpScreen(onDone: () -> Unit) {
    var tab by remember { mutableStateOf(0) }
    val tabs = listOf("How to Play", "Game Modes", "FAQ")

    Column(Modifier.fillMaxSize().background(WTheme.surface)) {
        // Top accent bar (purple → pink → amber)
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(tabs[tab], fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onDone))
        }
        // Tab chips
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
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (tab) {
                0 -> HowToPlay()
                1 -> GameModesHelp()
                else -> Faq()
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
    ExampleRow(listOf("W", "E", "A", "R", "Y"), 0, Color(0xFF22C55E), "W", Color(0xFF16A34A), " is in the word and in the correct spot.")
    ExampleRow(listOf("P", "I", "L", "L", "S"), 1, Color(0xFFEAB308), "I", Color(0xFFEAB308), " is in the word but in the wrong spot.")
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

private val HELP_MODES = listOf(
    "Classic" to "1 word, 6 guesses. The original formula.",
    "VS Battle" to "Race an opponent in real-time. First to solve wins.",
    "QuadWord" to "4 words at once. 9 guesses total. Each guess applies to all 4 boards.",
    "OctoWord" to "8 words at once. 13 guesses. Same idea, bigger challenge.",
    "Succession" to "4 words solved in order. Solve one to unlock the next. 10 guesses total.",
    "Deliverance" to "4 boards with pre-filled hints to get you started. 6 guesses to solve them all.",
    "Six" to "Guess a 6-letter word in 7 tries. Same rules as Classic, bigger vocabulary.",
    "Seven" to "Guess a 7-letter word in 8 tries. The ultimate single-word challenge.",
    "Gauntlet" to "5 stages of increasing difficulty — Classic through OctoWord. Survive them all.",
    "ProperNoundle" to "Guess famous names instead of dictionary words. Themed daily puzzles.",
)

@Composable
private fun GameModesHelp() {
    HELP_MODES.forEach { (title, desc) ->
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surfaceHover)
                .border(1.dp, WTheme.divider, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(desc, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
        }
    }
}

private val FAQ = listOf(
    "How are scores calculated?" to "Solving earns a 1,000-point base, plus a speed bonus (your mode's time cap minus your solve time — faster is better) and a completion bonus of up to 200, scaled by how many boards you solved. Six, Seven, and ProperNoundle also add a guess bonus for solving in fewer guesses. Example: a Classic solve in 27s scores 1,000 + 273 (speed) + 200 (completion) = 1,473. Your daily-leaderboard rank is based on this composite score.",
    "Do hints affect my score?" to "Yes. In Six, Seven, and ProperNoundle you can reveal a hint, but each one is subtracted from your score — 120 points per hint in ProperNoundle and 150 in Six and Seven. Hints never push a winning score below zero, and modes without hint buttons are unaffected.",
    "How do XP and levels work?" to "Win = 100 XP, loss = 25 XP. Bonuses: +50 for a win streak, +50 for a daily challenge, and medal XP (gold +100, silver +50, bronze +25). Play all 9 of the day's puzzles for a Daily Sweep (+200 XP), and win every one for a Flawless Victory (+400 XP more — 600 total). Every 1,000 XP = 1 level.",
    "How do medals work?" to "Finish in the top three of a mode's daily leaderboard to earn a gold, silver, or bronze medal, with extra medals for streak milestones and perfect games. Your medal tally is shown on your profile.",
    "Are there achievements?" to "Yes — 70 achievements to unlock across beginner, consistency, skill, social, and collection challenges, from your First Win to a flawless Gauntlet run, 30-day streaks, winning 50 games in a single mode, and big medal hauls. They unlock automatically as you play, and your full collection (with progress toward each one) lives on your profile.",
    "What's a streak?" to "Play at least one daily puzzle each day to build your daily streak. Puzzles reset at your local midnight, and missing a day resets the streak — unless a Streak Shield saves it.",
    "What are Streak Shields?" to "A Streak Shield automatically protects your streak the first time you miss a day. You earn shields through gameplay milestones, and your current count appears in the header.",
    "What does PRO unlock?" to "PRO removes all ads and unlocks unlimited replays (free players get one play per mode per day), Unlimited mode for endless fresh puzzles, deep Pro Insights stats, and VS extras like sending invites and rematches.",
    "Do daily puzzles use the same words for everyone?" to "Yes! Every player gets the same daily puzzles, so you can compare results on the leaderboard.",
)

@Composable
private fun Faq() {
    FAQ.forEach { (q, a) ->
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(q, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(a, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary)
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
    val sections = infoSections(kind)

    Column(Modifier.fillMaxSize().background(WTheme.bg)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onDone))
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(subtitle, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            sections.forEach { InfoSectionCard(it) }
            if (contact != null) Text(contact, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.primary)
            Spacer(Modifier.height(24.dp))
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

private fun infoSections(kind: String): List<InfoSec> = when (kind) {
    "about" -> listOf(
        InfoSec("What is Wordocious?", "A daily word-puzzle game with 10 modes — from the classic single-board to multi-board challenges, a 5-stage Gauntlet, and real-time VS battles."),
        InfoSec("10 Game Modes", bullets = listOf("Classic — 1 word, 6 tries", "VS Battle — real-time PvP", "QuadWord — 4 boards", "OctoWord — 8 boards", "Succession — 4 words in order", "Deliverance — 4 prefilled boards", "Six / Seven — 6- and 7-letter words", "Gauntlet — 5 escalating stages", "ProperNoundle — famous names")),
        InfoSec("Daily Challenges & Streaks", "Every player gets the same daily puzzles. Play each day to build your streak — streak shields protect it if you miss a day."),
        InfoSec("Leaderboards & Competition", "Compete on daily leaderboards per mode and chase the all-time hall of records."),
        InfoSec("How Scoring Works", "A 1,000-point base for solving, plus time and completion bonuses (and a guess bonus on hint modes). Fewer guesses and faster solves rank higher."),
        InfoSec("Free to Play", "All daily puzzles are free. Pro unlocks unlimited replays, VS on every mode, and more."),
    )
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
        InfoSec("Free Tier & Pro Subscription", bullets = listOf("Pro is billed through Stripe (web), the App Store (iOS), or Google Play (Android)", "Cancel anytime — Pro access continues through the billing period", "Prices may change with advance notice", "Refunds handled case-by-case")),
        InfoSec("Intellectual Property", "Wordocious and its content are owned by us and protected by law."),
        InfoSec("Disclaimer & Limitation of Liability", "The Service is provided \"as is\" without warranties; liability is limited to the extent permitted by law."),
        InfoSec("Termination", "We may suspend or terminate accounts that violate these terms."),
        InfoSec("Contact Us", "Questions about these terms?"),
    )
    else -> listOf(
        InfoSec("How do I play Wordocious?", "Guess the hidden word in the allotted tries; tiles show green (correct spot), yellow (wrong spot), gray (not in word)."),
        InfoSec("What are the different game modes?", "10 modes from Classic to multi-board, Gauntlet, and VS — see About for the full list."),
        InfoSec("How are daily scores calculated?", "A base of 1,000 for completing, a guess bonus (hint modes), a speed bonus for finishing fast, and a completion bonus on multi-board modes."),
        InfoSec("How do XP and levels work?", "Win = 100 XP, loss = 25 XP, with streak + daily bonuses. Every 1,000 XP is a level."),
        InfoSec("How do streaks work?", "Play a daily each day to build your streak; streak shields protect it if you miss."),
        InfoSec("What is Wordocious Pro?", "Unlimited replays, VS on every mode, streak shields, a Pro badge, and extended stats."),
        InfoSec("My stats aren't showing up?", "Make sure you're signed in — stats and leaderboards require an account."),
        InfoSec("Found a bug or have a suggestion?", "We'd love to hear it — reach out below."),
    )
}
