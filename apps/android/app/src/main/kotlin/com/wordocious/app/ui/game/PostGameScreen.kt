package com.wordocious.app.ui.game

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyResultsService
import com.wordocious.app.data.DailyScoring
import com.wordocious.app.data.LeaderboardService
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.modeAccent
import com.wordocious.app.ui.modeTitle
import com.wordocious.app.ui.modeTitleGradient
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import kotlin.math.abs
import kotlin.math.max

/**
 * Post-game screen — ported 1:1 from iOS SolvedPuzzleView + PostGameViews.swift
 * (which mirror the web octordle/quordle/rescue-game completion headers).
 * Order: FinishedStatsHeader → DailyRankBadge → board reveal → ScoreBreakdown →
 * DefinitionCard (single-board), with a corner Home button. NO colored banner.
 */
@Composable
fun PostGameScreen(
    state: GameState,
    mode: GameMode,
    seed: String,
    elapsedSeconds: Int = 0,
    hintsUsed: Int = 0,
    onBack: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val won = state.status == GameStatus.WON
    val board = state.boards[0]
    val solution = board.solution.uppercase()

    val guessCount = board.guesses.size
    val boardsSolved = state.boards.count { it.status == GameStatus.WON }
    val totalBoards = state.boards.size
    val multiBoard = totalBoards > 1

    // Record the daily result once — ONLY for daily seeds. Pro "Unlimited" games
    // use a non-daily seed and must not overwrite the daily leaderboard row (the
    // XP/matches/stats pipeline in GameScreen still records them — "all stats count").
    LaunchedEffect(state.status) {
        if (seed.startsWith("daily-")) {
            DailyResultsService.recordDailyResult(
                mode = mode, completed = won, guessCount = guessCount,
                elapsedSeconds = elapsedSeconds, boardsSolved = boardsSolved,
                totalBoards = totalBoards, hintsUsed = hintsUsed,
            )
        }
    }

    val accent = modeAccent(mode)
    val share = {
        val text = com.wordocious.app.data.ShareHelper.buildShareText(state, mode, elapsedSeconds)
        com.wordocious.app.data.ShareHelper.share(context, text)
    }

    Box(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp).padding(top = 56.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ProperNoundle: Wikipedia photo + display-name result line (web parity:
            // win = name in green; loss = "The answer was: X" in red).
            if (mode == GameMode.PROPERNOUNDLE) {
                val puzzle = androidx.compose.runtime.remember(board.solution) {
                    com.wordocious.core.ProperNoundle.puzzleFor(board.solution)
                }
                val imageUrl by androidx.compose.runtime.produceState<String?>(initialValue = null, key1 = puzzle?.id) {
                    value = puzzle?.let { com.wordocious.app.data.WikipediaHint.fetchImageUrl(it.display, it.wikiTitle) }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    imageUrl?.let { url ->
                        coil.compose.AsyncImage(
                            model = url, contentDescription = null,
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp))
                                .border(2.dp, if (won) Color(0xFF16A34A) else Color(0xFFDC2626), RoundedCornerShape(12.dp)),
                        )
                    }
                    Text(
                        if (won) (puzzle?.display ?: solution) else "The answer was: ${puzzle?.display ?: solution}",
                        fontSize = 18.sp, fontWeight = FontWeight.Black,
                        color = if (won) Color(0xFF16A34A) else Color(0xFFEF4444),
                    )
                }
            }
            FinishedStatsHeader(
                mode = mode, won = won, guessCount = guessCount, maxGuesses = board.maxGuesses,
                timeSeconds = elapsedSeconds, boardsSolved = boardsSolved, totalBoards = totalBoards,
                onHome = onBack, onShare = share,
            )

            DailyRankBadge(mode)

            // Board reveal (the actual finished board with colors).
            Box(
                modifier = Modifier.fillMaxWidth().heightIn(max = if (multiBoard) 320.dp else 360.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (multiBoard) {
                    MultiBoardLayout(
                        boards = state.boards, currentGuess = "",
                        currentBoardIndex = state.currentBoardIndex,
                        isSequential = mode == GameMode.SEQUENCE,
                        modifier = Modifier.fillMaxWidth().heightIn(max = 320.dp),
                    )
                } else {
                    SingleBoard(board = board, currentGuess = "", modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp))
                }
            }

            ScoreBreakdownCard(
                mode = mode, won = won, guessCount = guessCount, elapsedSeconds = elapsedSeconds,
                boardsSolved = if (won) boardsSolved else 0, totalBoards = totalBoards, hintsUsed = hintsUsed,
            )

            // Single-board modes: word definition (with "No definition" fallback).
            if (!multiBoard && mode != GameMode.PROPERNOUNDLE) {
                DefinitionCard(solution)
            }
        }

        // Corner Home button (top-left) — accent circle, matches the in-game one.
        Box(
            modifier = Modifier.padding(8.dp).size(44.dp)
                .shadow(4.dp, CircleShape, clip = false).clip(CircleShape)
                .background(WTheme.surface).border(2.dp, accent, CircleShape)
                .clickableNoRipple(onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Home, "Home", tint = accent, modifier = Modifier.size(20.dp))
        }
    }
}

/** m:ss clock string. */
private fun clock(s: Int): String = "%d:%02d".format(s / 60, s % 60)

/**
 * Finished-game header (ports iOS FinishedStatsHeader): gradient mode title,
 * stat row (trophy+boards / guesses / clock+time), green/red summary line,
 * underlined Home / Share text links.
 */
@Composable
private fun FinishedStatsHeader(
    mode: GameMode, won: Boolean, guessCount: Int, maxGuesses: Int,
    timeSeconds: Int, boardsSolved: Int, totalBoards: Int,
    onHome: () -> Unit, onShare: () -> Unit,
) {
    val isMulti = totalBoards > 1
    val timeStr = clock(timeSeconds)
    val summary = when {
        won && isMulti -> "All $totalBoards solved in $guessCount guesses  ·  $timeStr"
        won -> "Solved in $guessCount guesses  ·  $timeStr"
        isMulti -> "$boardsSolved/$totalBoards solved  ·  $timeStr"
        else -> "Out of guesses  ·  $timeStr"
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            modeTitle(mode), fontSize = 28.sp, fontWeight = FontWeight.Black,
            style = TextStyle(brush = Brush.horizontalGradient(modeTitleGradient(mode))),
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (isMulti) StatItem(Icons.Filled.EmojiEvents, Color(0xFFD97706), "$boardsSolved/$totalBoards")
            Text(
                if (maxGuesses > 0) "$guessCount/$maxGuesses guesses" else "$guessCount guesses",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
            StatItem(Icons.Filled.Schedule, Color(0xFF60A5FA), timeStr)
        }
        Text(
            summary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            color = if (won) Color(0xFF16A34A) else Color(0xFFF87171), textAlign = TextAlign.Center,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                "Home", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                textDecoration = TextDecoration.Underline, modifier = Modifier.clickableNoRipple(onHome),
            )
            Text(
                "Share", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF3B82F6),
                textDecoration = TextDecoration.Underline, modifier = Modifier.clickableNoRipple(onShare),
            )
        }
    }
}

@Composable
private fun StatItem(icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(12.dp))
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/**
 * Daily-leaderboard standing capsule (ports iOS DailyRankBadge). Hidden until
 * ≥2 players have a result today. Gold styling at ≥75th percentile.
 */
@Composable
private fun DailyRankBadge(mode: GameMode) {
    val userId = AuthService.profile.value?.id
    val rank by produceState<Pair<Int, Int>?>(initialValue = null, key1 = mode, key2 = userId) {
        value = if (userId != null) LeaderboardService.userRankAndTotal(userId, mode.name) else null
    }
    val r = rank ?: return
    val (position, total) = r
    if (total < 2) return
    val percentile = ((1 - (position - 1).toDouble() / total) * 100).toInt()
    val top = max(1, 100 - percentile)
    val gold = percentile >= 75

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(if (gold) Color(0xFFFEF3C7) else WTheme.surfaceHover)
            .border(1.dp, if (gold) Color(0xFFFDE68A) else WTheme.border, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(Icons.Filled.EmojiEvents, null, tint = if (gold) Color(0xFF92400E) else WTheme.textMuted, modifier = Modifier.size(10.dp))
        Text(
            "Top $top% · #$position of $total", fontSize = 10.sp, fontWeight = FontWeight.Black,
            color = if (gold) Color(0xFF92400E) else WTheme.textMuted,
        )
    }
}

/**
 * Composite-score breakdown (ports iOS ScoreBreakdownView). Uses the SHARED
 * [DailyScoring.breakdown] so the displayed total always equals the recorded
 * leaderboard score.
 */
@Composable
internal fun ScoreBreakdownCard(
    mode: GameMode, won: Boolean, guessCount: Int, elapsedSeconds: Int,
    boardsSolved: Int, totalBoards: Int, hintsUsed: Int,
) {
    val b = DailyScoring.breakdown(mode.name, won, guessCount, elapsedSeconds, boardsSolved, totalBoards, hintsUsed)
    val guessesLeft = max(0, b.maxGuesses - guessCount)
    val timeUnder = max(0, b.timeCap - elapsedSeconds)

    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(WTheme.bg).border(1.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("SCORE BREAKDOWN", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
            Text("${b.total.toInt()} pts", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        }
        ScoreRow(if (won) "Win bonus" else "Did not finish", if (won) "" else "no win bonus", b.basePoints)
        if (won && b.hasHints) ScoreRow("Guess bonus", "$guessesLeft unused × ${b.guessWeight}", b.guessBonus)
        if (won) ScoreRow("Time bonus", "${fmtSecs(timeUnder)} under ${fmtSecs(b.timeCap)}", b.timeBonus)
        if (won && b.completionBonus > 0) ScoreRow(
            "Completion bonus", if (totalBoards > 1) "$boardsSolved/$totalBoards boards" else "puzzle solved", b.completionBonus,
        )
        if (b.hasHints) {
            val detail = if (hintsUsed > 0) "$hintsUsed hint${if (hintsUsed == 1) "" else "s"} × ${b.hintCost}" else "no hints — full credit"
            ScoreRow("Hint penalty", detail, -b.hintPenalty, pure = won && hintsUsed == 0)
        }
    }
}

@Composable
private fun ScoreRow(label: String, detail: String, value: Double, pure: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f, fill = false)) {
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (pure) Color(0xFF16A34A) else WTheme.text)
            if (detail.isNotEmpty()) Text(detail, fontSize = 10.sp, color = WTheme.textMuted, maxLines = 1)
        }
        val sign = if (value > 0) "+" else if (value < 0) "−" else ""
        Text(
            "$sign${abs(value).toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Black,
            color = if (value > 0) WTheme.text else if (value < 0) Color(0xFFDC2626) else WTheme.textMuted,
        )
    }
}

private fun fmtSecs(s: Int): String = if (s <= 0) "0s" else if (s >= 60) "${s / 60}m ${s % 60}s" else "${s}s"

/**
 * Dictionary definition card (ports iOS DefinitionCard). Always populates once
 * loaded — shows "No definition available for this word." rather than a blank
 * gap when the dictionary has no entry.
 */
@Composable
private fun DefinitionCard(word: String) {
    var loaded by remember(word) { mutableStateOf(false) }
    val def by produceState<com.wordocious.app.data.DefinitionService.WordDefinition?>(initialValue = null, key1 = word) {
        value = com.wordocious.app.data.DefinitionService.fetch(word)
        loaded = true
    }
    if (!loaded) return

    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(WTheme.bg).border(1.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        val d = def
        if (d != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (d.phonetic.isNotBlank()) Text(d.phonetic, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted)
                if (d.partOfSpeech.isNotBlank()) {
                    Text(
                        d.partOfSpeech.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                        color = Color(0xFFA78BFA),
                        modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(WTheme.border).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            if (d.definition.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(d.definition, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color(0xFF4A4A6A))
            }
        } else {
            Text(
                "No definition available for this word.",
                fontSize = 13.sp, fontWeight = FontWeight.Medium, fontStyle = FontStyle.Italic, color = WTheme.textMuted,
            )
        }
    }
}
