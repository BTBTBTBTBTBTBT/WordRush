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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameDictionary
import kotlinx.coroutines.delay

/**
 * Home screen — ported from the web `app/page.tsx` (source of truth). Static
 * data-driven bits (daily completions, live player count, Pro toggle, invites)
 * render their faithful shells; they get wired once the Android Supabase/socket
 * layer lands (later phase). Layout, colors, copy and the mode grid are 1:1.
 */
@Composable
fun HomeScreen(
    onSelectMode: (ModeCard, Boolean) -> Unit,
    onGoPro: () -> Unit = {},
    onVs: (ModeCard) -> Unit = {},
) {
    // Today's daily completions (W/L per mode) — keyed by DB game_mode (DUEL/QUORDLE/…)
    // Seed from the day-keyed cache so cold launches don't flash unbadged
    // cards while the network fetch runs (web sessionStorage parity).
    val completions by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.DailyCompletionsService.readCache()
    ) {
        value = com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions()
    }
    // Pro/Unlimited dimension (web parity): free users get one daily play per
    // mode; once played, the card LOCKS (dimmed + tap → ModeLimitModal). Pro
    // users get a Daily/Unlimited toggle and replay unlimited (fresh seeds).
    val isPro = com.wordocious.app.data.AuthService.isProActive
    var limitModal by remember { mutableStateOf<ModeCard?>(null) }
    var playMode by remember { mutableStateOf(PlayMode.DAILY) }
    val unlimitedMode = isPro && playMode == PlayMode.UNLIMITED

    Box(modifier = Modifier.fillMaxSize()) {
    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // (Shared AppHeader is rendered by MainScreen above all tabs.)
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Pro-only Daily/Unlimited toggle; Unlimited swaps the daily hero.
            // Daily hero shows Daily Sweep! / Flawless Victory! once all 9 are done.
            val dailyDone = completions.size
            val dailyWins = completions.values.count { it.completed }
            if (isPro) PlayModeToggle(playMode) { playMode = it }
            if (unlimitedMode) UnlimitedHero() else DailyHero(dailyDone, dailyWins)
            WordOfTheDayCard()

            Text(
                "GAME MODES",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = WTheme.textMuted,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 4.dp),
            )

            // 2-column grid (web grid-cols-2 gap-2)
            MODE_CARDS.chunked(2).forEach { rowCards ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    rowCards.forEach { card ->
                        val completion = card.engineMode?.let { completions[it.name] }
                        // Unlimited mode: these aren't the daily puzzle — never show the
                        // daily W/L result or lock; every tap starts a fresh puzzle (web parity).
                        val shownCompletion = if (unlimitedMode) null else completion
                        val isLocked = !isPro && completion != null
                        val showVs = unlimitedMode && card.id != "vs"
                        val unlimited = unlimitedMode && card.engineMode != null
                        ModeCardView(card, shownCompletion, isLocked, showVs, Modifier.weight(1f), onVs = { onVs(card) }) {
                            if (isLocked) limitModal = card else onSelectMode(card, unlimited)
                        }
                    }
                    if (rowCards.size == 1) Spacer(Modifier.weight(1f))
                }
            }

            LiveBanner()
            FooterLinks()
            Spacer(Modifier.height(16.dp))
        }
    }
        // Free-user daily-limit modal (web ModeLimitModal). "View Solved Puzzle"
        // opens the finished daily (GameScreen resumes → post-game screen).
        limitModal?.let { card ->
            ModeLimitModal(
                modeName = card.title,
                onClose = { limitModal = null },
                onGoPro = onGoPro,
                onViewPuzzle = { onSelectMode(card, false) },
            )
        }
    }
}

/** Shared fixed height for ALL home heroes (Daily / Sweep / Flawless / Unlimited)
 *  so toggling Daily<->Unlimited never shifts the game-cards grid (web parity). */
internal val HERO_HEIGHT = 78.dp

@Composable
private fun DailyHero(completed: Int, wins: Int) {
    val secs by rememberMidnightCountdown()
    val total = 9
    val allDone = completed >= total
    val flawless = allDone && wins >= total
    // Sweep/Flawless variants replace the daily challenge once all 9 are done (web parity).
    val grad = when {
        flawless -> listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A))
        allDone -> listOf(Color(0xFFF5F3FF), Color(0xFFFCE7F3))
        else -> listOf(Color(0xFFEDE9FE), Color(0xFFDDD6FE))
    }
    val border = when { flawless -> Color(0xFFF59E0B); allDone -> Color(0xFFC4B5FD); else -> Color(0xFFA78BFA) }
    Column(
        modifier = Modifier.fillMaxWidth().height(HERO_HEIGHT)
            .clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(grad))
            .border(1.5.dp, border, RoundedCornerShape(14.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (allDone) {
            val titleGrad = if (flawless) listOf(Color(0xFFD97706), Color(0xFFB45309)) else listOf(Color(0xFFA78BFA), Color(0xFFEC4899))
            val subColor = if (flawless) Color(0xFFB45309) else Color(0xFF6D28D9)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (flawless) {
                    Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                    Text("Flawless Victory!", fontSize = 18.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.linearGradient(titleGrad)))
                    Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                } else {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(16.dp))
                    Text("Daily Sweep!", fontSize = 16.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.linearGradient(titleGrad)))
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color(0xFFEC4899), modifier = Modifier.size(16.dp))
                }
            }
            Text(
                if (flawless) "All $total dailies won today · +600 XP earned" else "All $total dailies completed · +200 XP earned",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = subColor, modifier = Modifier.padding(top = 2.dp),
            )
            Text("Next puzzles in ${formatCountdown(secs)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = subColor.copy(alpha = 0.75f), modifier = Modifier.padding(top = 2.dp))
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_star), null, tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp))
                Text("Daily Challenge", fontSize = 18.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF4F46E5)))))
                Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_star), null, tint = Color(0xFF4F46E5), modifier = Modifier.size(20.dp))
            }
            Text("9 puzzles · Leaderboards & medals", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9), modifier = Modifier.padding(top = 2.dp))
            Text("Resets in ${formatCountdown(secs)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9), modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun WordOfTheDayCard() {
    val word by produceState<String?>(initialValue = null) {
        DictionaryLoader.ensureLoaded()
        val sols = GameDictionary.allSolutions()
        val daysSinceEpoch = (System.currentTimeMillis() / 86_400_000L).toInt()
        value = if (sols.isNotEmpty()) sols[daysSinceEpoch % sols.size] else null
    }
    // Definition from dictionaryapi.dev (same source as the post-game card).
    val def by produceState<com.wordocious.app.data.DefinitionService.WordDefinition?>(initialValue = null, key1 = word) {
        value = word?.let { com.wordocious.app.data.DefinitionService.fetch(it) }
    }
    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_book_open), null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
            Text("WORD OF THE DAY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
        }
        val w = word   // local capture: produceState delegate can't smart-cast
        if (w == null) {
            // Web parity: structural animate-pulse skeleton, not a "…" placeholder.
            Spacer(Modifier.height(4.dp))
            SkeletonBlock(height = 16.dp, width = 70.dp, cornerRadius = 6.dp)
            Spacer(Modifier.height(6.dp))
            SkeletonBlock(height = 10.dp, cornerRadius = 5.dp)
            return@Column
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val display = w.first().uppercase() + w.drop(1).lowercase()
            Text(display, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            def?.takeIf { it.partOfSpeech.isNotBlank() }?.let {
                // Web parity (page.tsx): plain italic purple text, no background pill.
                Text(
                    it.partOfSpeech.lowercase(), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, color = Color(0xFF7C3AED),
                )
            }
        }
        def?.takeIf { it.definition.isNotBlank() }?.let {
            Text(it.definition, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF4B5563), maxLines = 2, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun ModeCardView(
    card: ModeCard,
    completion: com.wordocious.app.data.DailyCompletionsService.Completion?,
    isLocked: Boolean,
    showVs: Boolean,
    modifier: Modifier,
    onVs: () -> Unit,
    onClick: () -> Unit,
) {
    val isDone = completion != null
    // Completed daily: soft tint in the mode's accent + accent border (web parity).
    // Locked (free user, played today): dimmed 60% + gray border.
    val cardBg = if (isDone) card.accent.copy(alpha = 0.06f) else WTheme.surface
    val cardBorder = if (isLocked) Color(0xFFD1D5DB) else if (isDone) card.accent.copy(alpha = 0.4f) else WTheme.border

    Box(
        modifier = modifier
            .cardShadow(14.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(cardBg)
            .border(1.5.dp, cardBorder, RoundedCornerShape(14.dp))
            .then(if (isLocked) Modifier.alpha(0.6f) else Modifier)
            .clickableNoRipple(onClick),
    ) {
        // Top accent bar (web h-1 gradient accent → accent88)
        Box(
            modifier = Modifier.fillMaxWidth().height(4.dp)
                .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
                .background(Brush.horizontalGradient(listOf(card.accent, card.accent.copy(alpha = 0.53f)))),
        )
        Column(modifier = Modifier.padding(12.dp)) {
            // Icon box (8x8 rounded, accent @ ~8% bg)
            Box(
                modifier = Modifier.size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(card.accent.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center,
            ) {
                ModeGlyph(card, card.accent, glyphSize = 11.sp, iconSize = 16.dp)
            }
            Spacer(Modifier.height(6.dp))
            Text(card.title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            // Completed daily shows guesses · time; else the mode description (web parity).
            Text(
                if (isDone) {
                    val g = completion!!.guessCount
                    "$g ${if (g == 1) "guess" else "guesses"} · ${fmtShort(completion.timeSeconds)}"
                } else card.desc,
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }

        // W/L pill top-right when today's daily is on the books (web parity).
        if (isDone) {
            Box(
                modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)
                    .size(20.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (completion!!.completed) Color(0xFF16A34A) else Color(0xFFDC2626)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (completion.completed) "W" else "L",
                    fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                )
            }
        }

        // VS swords button (Pro + Unlimited) — quick-match this mode (web parity).
        if (showVs) {
            Box(
                modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).size(26.dp)
                    .clip(RoundedCornerShape(8.dp)).background(Color(0xFF0D9488).copy(alpha = 0.12f))
                    .border(1.dp, Color(0xFF0D9488).copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                    .clickableNoRipple(onVs),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords),
                    contentDescription = "VS", tint = Color(0xFF0D9488), modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}

private fun fmtShort(secs: Int): String =
    if (secs <= 0) "—" else if (secs < 60) "${secs}s" else "${secs / 60}m ${secs % 60}s"

@Composable
private fun LiveBanner() {
    Row(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFF22C55E)))
        Text("LIVE", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text("Players online", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

@Composable
private fun FooterLinks() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
    ) {
        listOf("About", "How to Play", "Privacy", "Terms").forEach {
            Text(it, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun rememberMidnightCountdown() = produceState(initialValue = secondsUntilLocalMidnight()) {
    while (true) {
        value = secondsUntilLocalMidnight()
        delay(1000)
    }
}

/**
 * Seconds until the next LOCAL midnight — the daily resets at local midnight
 * (matches the local-date puzzle/leaderboard grouping), not UTC.
 */
private fun secondsUntilLocalMidnight(): Long {
    val cal = java.util.Calendar.getInstance().apply {
        add(java.util.Calendar.DAY_OF_YEAR, 1)
        set(java.util.Calendar.HOUR_OF_DAY, 0)
        set(java.util.Calendar.MINUTE, 0)
        set(java.util.Calendar.SECOND, 0)
        set(java.util.Calendar.MILLISECOND, 0)
    }
    return ((cal.timeInMillis - System.currentTimeMillis()) / 1000L).coerceAtLeast(0)
}

private fun formatCountdown(secs: Long): String {
    val h = secs / 3600
    val m = (secs % 3600) / 60
    val s = secs % 60
    return "%02d:%02d:%02d".format(h, m, s)
}
