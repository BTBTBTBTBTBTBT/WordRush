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
import androidx.compose.material.icons.filled.Bolt
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
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
fun HomeScreen(onSelectMode: (ModeCard) -> Unit) {
    // Today's daily completions (W/L per mode) — keyed by DB game_mode (DUEL/QUORDLE/…)
    val completions by androidx.compose.runtime.produceState(
        initialValue = emptyMap<String, com.wordocious.app.data.DailyCompletionsService.Completion>()
    ) {
        value = com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions()
    }

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // Header (web AppHeader) — wordmark; profile/streak chips are data-driven, deferred.
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "WORDOCIOUS",
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                style = TextStyle(brush = WTheme.wordmarkGradient),
            )
        }

        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DailyHero()
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
                        ModeCardView(card, completion, Modifier.weight(1f)) { onSelectMode(card) }
                    }
                    if (rowCards.size == 1) Spacer(Modifier.weight(1f))
                }
            }

            LiveBanner()
            FooterLinks()
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun DailyHero() {
    val secs by rememberMidnightCountdown()
    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFEDE9FE), Color(0xFFDDD6FE))))
            .border(1.5.dp, Color(0xFFA78BFA), RoundedCornerShape(14.dp))
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_star), null, tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp))
            Text(
                "Daily Challenge",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                style = TextStyle(brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF4F46E5)))),
            )
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_star), null, tint = Color(0xFF4F46E5), modifier = Modifier.size(20.dp))
        }
        Text("9 puzzles · Leaderboards & medals", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9))
        Text("Resets in ${formatCountdown(secs)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9))
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
        val display = word?.let { it.first().uppercase() + it.drop(1).lowercase() } ?: "…"
        Text(display, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        // (Definition needs the dictionary API — wired with the networking layer.)
    }
}

@Composable
private fun ModeCardView(
    card: ModeCard,
    completion: com.wordocious.app.data.DailyCompletionsService.Completion?,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val isDone = completion != null
    // Completed daily: soft tint in the mode's accent + accent border (web parity).
    val cardBg = if (isDone) card.accent.copy(alpha = 0.06f) else WTheme.surface
    val cardBorder = if (isDone) card.accent.copy(alpha = 0.4f) else WTheme.border

    Box(
        modifier = modifier
            .cardShadow(14.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(cardBg)
            .border(1.5.dp, cardBorder, RoundedCornerShape(14.dp))
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
                when {
                    card.glyph != null -> Text(card.glyph, fontSize = 11.sp, fontWeight = FontWeight.Black, color = card.accent)
                    else -> {
                        val res = modeIconRes(card.lucide)
                        if (res != null) Icon(
                            painter = androidx.compose.ui.res.painterResource(res),
                            contentDescription = null,
                            tint = card.accent,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
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
    }
}

private fun fmtShort(secs: Int): String =
    if (secs <= 0) "—" else if (secs < 60) "${secs}s" else "${secs / 60}m ${secs % 60}s"

/** Exact lucide / custom icon drawable per mode (matches web MODE_CARDS icons). */
private fun modeIconRes(lucide: String?): Int? = when (lucide) {
    "WordleGrid" -> com.wordocious.app.R.drawable.ic_wordle_grid
    "Swords" -> com.wordocious.app.R.drawable.ic_swords
    "TrendingUp" -> com.wordocious.app.R.drawable.ic_trending_up
    "Shield" -> com.wordocious.app.R.drawable.ic_shield
    "Skull" -> com.wordocious.app.R.drawable.ic_skull
    "Crown" -> com.wordocious.app.R.drawable.ic_crown
    else -> null
}

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
private fun rememberMidnightCountdown() = produceState(initialValue = secondsUntilMidnightUtc()) {
    while (true) {
        value = secondsUntilMidnightUtc()
        delay(1000)
    }
}

private fun secondsUntilMidnightUtc(): Long {
    val msInDay = 86_400_000L
    val now = System.currentTimeMillis()
    return (msInDay - (now % msInDay)) / 1000L
}

private fun formatCountdown(secs: Long): String {
    val h = secs / 3600
    val m = (secs % 3600) / 60
    val s = secs % 60
    return "%02d:%02d:%02d".format(h, m, s)
}
