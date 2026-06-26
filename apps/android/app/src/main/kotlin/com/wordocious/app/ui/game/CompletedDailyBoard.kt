package com.wordocious.app.ui.game

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DefinitionService
import com.wordocious.app.data.GamePersistence
import com.wordocious.app.todayLocalSeed
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameAction
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.GauntletProgress
import com.wordocious.core.TileState
import com.wordocious.core.createInitialState
import com.wordocious.core.gameReducer

/**
 * Completed-daily "dropdown" shown above the leaderboard for the selected mode —
 * ports the web CompletedDailyBoard / CollapsibleCompletedCard. Reads the local
 * finished daily session (GamePersistence) for today's seed; collapsed by
 * default, expands to the board(s) + solution + definition + score breakdown.
 * Renders nothing if the user hasn't finished today's daily for this mode.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CompletedDailyBoard(modeId: String) {
    val mode = remember(modeId) { runCatching { GameMode.valueOf(modeId) }.getOrNull() } ?: return
    val seed = remember(modeId) { todayLocalSeed(modeId) }
    val localState = remember(modeId) { GamePersistence.load(seed, mode) }
    // Cross-device: a daily finished on another device (native/web) has no local
    // save, so this card used to render nothing. Replay the recorded matches row
    // through the engine (same loop GameScreen uses) so "Completed Today" shows
    // everywhere. Gauntlet is excluded (its replay needs stage advancement).
    var serverState by remember(modeId) { mutableStateOf<GameState?>(null) }
    var serverTime by remember(modeId) { mutableStateOf(0) }
    // Gauntlet has no flat guess-replay (player1_guesses holds only the final
    // stage), so the cross-device card rebuilds from the persisted per-stage
    // breakdown (matches.gauntlet_stages) — iOS CompletedDailyCard parity.
    var serverGauntlet by remember(modeId) { mutableStateOf<com.wordocious.app.data.GameResultsService.GauntletStagesData?>(null) }
    // ProperNoundle: the generic engine replay can't rebuild a multi-word proper-
    // noun board, so capture the raw recorded guesses and render a dedicated card
    // (tiles re-derived against today's answer, laid out in word groups).
    var pnGuesses by remember(modeId) { mutableStateOf<List<String>?>(null) }
    LaunchedEffect(modeId) {
        if (mode == GameMode.PROPERNOUNDLE) {
            val row = com.wordocious.app.data.GameResultsService.fetchRecordedDailyMatch(seed)
            if (row != null && row.player1Guesses.isNotEmpty()) {
                pnGuesses = row.player1Guesses
                serverTime = row.player1Time
            }
            return@LaunchedEffect
        }
        if (localState != null) return@LaunchedEffect
        if (mode == GameMode.GAUNTLET) {
            serverGauntlet = com.wordocious.app.data.GameResultsService.fetchGauntletStages(seed)
            serverTime = com.wordocious.app.data.GameResultsService.fetchRecordedDailyMatch(seed)?.player1Time ?: 0
            return@LaunchedEffect
        }
        val row = com.wordocious.app.data.GameResultsService.fetchRecordedDailyMatch(seed) ?: return@LaunchedEffect
        if (row.player1Guesses.isEmpty()) return@LaunchedEffect
        var replayed = createInitialState(seed, mode)
        val applyAll = replayed.boards.size > 1 && mode != GameMode.SEQUENCE
        for (g in row.player1Guesses.take(200)) {
            if (replayed.status != GameStatus.PLAYING) break
            replayed = if (mode == GameMode.SEQUENCE) {
                val idx = replayed.boards.indexOfFirst { it.status == GameStatus.PLAYING }
                if (idx < 0) break
                gameReducer(replayed, GameAction.SubmitGuess(g, boardIndex = idx, applyToAll = false))
            } else {
                gameReducer(replayed, GameAction.SubmitGuess(g, applyToAll = applyAll))
            }
        }
        if (replayed.status != GameStatus.PLAYING) { serverState = replayed; serverTime = row.player1Time }
    }

    // Gauntlet: dedicated stage-breakdown card (3-stat summary + per-stage rows +
    // score breakdown), reconstructed from local state or server gauntlet_stages.
    if (mode == GameMode.GAUNTLET) {
        val g = localState?.gauntlet ?: serverGauntlet?.takeIf { it.stages.isNotEmpty() }?.let {
            GauntletProgress(
                currentStage = it.stages.size, totalStages = it.stages.size,
                stages = it.stages, stageResults = it.stageResults,
                stageStartTime = 0.0, allSolutions = emptyList(),
            )
        } ?: return
        val gTime = if (localState != null) (GamePersistence.loadElapsed(seed, mode) ?: 0) else serverTime
        GauntletCompletedDailyCard(g = g, elapsedSeconds = gTime)
        return
    }

    // ProperNoundle: dedicated card — real board reconstructed from the recorded
    // guesses, tiles re-derived against today's answer, multi-word layout.
    if (mode == GameMode.PROPERNOUNDLE) {
        val pg = pnGuesses ?: return
        if (pg.isEmpty()) return
        val pnPuzzle = com.wordocious.core.ProperNoundle.dailyPuzzle(com.wordocious.app.todayLocalDate()) ?: return
        ProperNoundleCompletedDailyCard(guesses = pg, puzzle = pnPuzzle, timeSeconds = serverTime)
        return
    }

    val state = localState ?: serverState ?: return
    if (state.status == GameStatus.PLAYING) return

    val won = state.status == GameStatus.WON
    val boards = state.boards
    val isMulti = boards.size > 1
    val boardsSolved = boards.count { it.status == GameStatus.WON }
    val totalBoards = boards.size
    val guesses = boards.maxOfOrNull { it.guesses.size } ?: 0 // MAX across boards (board 0 stops at its solve)
    val maxGuesses = boards.firstOrNull()?.maxGuesses ?: 6
    val timeSeconds = if (localState != null) (GamePersistence.loadElapsed(seed, mode) ?: 0) else serverTime
    val hints = boards.firstOrNull()?.hintEvaluations?.size ?: 0
    val hintLabel = formatHints(mode, hints)

    val summary = if (isMulti)
        "$boardsSolved/$totalBoards · ${guesses}g · ${fmt(timeSeconds)}"
    else
        "$guesses/$maxGuesses · ${fmt(timeSeconds)}${hintLabel?.let { " · $it" } ?: ""}"

    var expanded by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        // Top accent bar (green won / gray attempted)
        Box(
            Modifier.fillMaxWidth().height(4.dp).background(
                Brush.horizontalGradient(
                    if (won) listOf(Color(0xFF7C3AED), Color(0xFFA78BFA))
                    else listOf(Color(0xFF9CA3AF), Color(0xFFD1D5DB)),
                ),
            ),
        )
        // Header
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(16.dp).clip(CircleShape).background(if (won) Color(0xFFF5F3FF) else Color(0xFFFEE2E2)), Alignment.Center) {
                Text(if (won) "✓" else "✗", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            }
            Spacer(Modifier.width(8.dp))
            Text(
                if (won) "COMPLETED TODAY" else "ATTEMPTED TODAY",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp,
                color = if (won) Color(0xFF7C3AED) else WTheme.textMuted,
            )
            Spacer(Modifier.weight(1f))
            Text(summary, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Filled.KeyboardArrowDown, null, tint = WTheme.textMuted, modifier = Modifier.size(16.dp).rotate(if (expanded) 180f else 0f))
        }
        // Collapsible content
        AnimatedVisibility(visible = expanded) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (isMulti) {
                    FlowRow(horizontalArrangement = Arrangement.Center, verticalArrangement = Arrangement.Center) {
                        boards.forEach { b ->
                            // Aspect ratio (cols/rows) gives the weight-based MiniBoardView a
                            // concrete height so its rows don't collapse to ~0.
                            Box(Modifier.padding(4.dp).width(if (totalBoards > 4) 64.dp else 96.dp)
                                .aspectRatio(b.solution.length.toFloat() / b.maxGuesses)) {
                                MiniBoardView(board = b)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    StatsRow(listOf("$boardsSolved/$totalBoards" to "Boards", "$guesses" to "Guesses", fmt(timeSeconds) to "Time"))
                } else {
                    Box(Modifier.width(180.dp).aspectRatio(boards[0].solution.length.toFloat() / boards[0].maxGuesses)) {
                        MiniBoardView(board = boards[0])
                    }
                    Spacer(Modifier.height(12.dp))
                    val solution = boards[0].solution.uppercase()
                    Text(solution, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = WTheme.text)
                    // Definition (Classic-style single-board modes only).
                    if (mode != GameMode.PROPERNOUNDLE) DefinitionBlock(solution)
                    Spacer(Modifier.height(12.dp))
                    StatsRow(listOf("$guesses/$maxGuesses" to "Guesses", fmt(timeSeconds) to "Time"))
                }
                Spacer(Modifier.height(12.dp))
                ScoreBreakdownCard(
                    mode = mode, won = won, guessCount = guesses, elapsedSeconds = timeSeconds,
                    boardsSolved = boardsSolved, totalBoards = totalBoards, hintsUsed = hints,
                )
            }
        }
    }
}

@Composable
private fun DefinitionBlock(solution: String) {
    var def by remember(solution) { mutableStateOf<DefinitionService.WordDefinition?>(null) }
    var loaded by remember(solution) { mutableStateOf(false) }
    LaunchedEffect(solution) { def = DefinitionService.fetch(solution); loaded = true }
    if (!loaded) return
    Spacer(Modifier.height(8.dp))
    Column(
        Modifier.widthIn(max = 320.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg)
            .border(1.dp, WTheme.border, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        val d = def
        if (d != null && d.definition.isNotBlank()) {
            if (d.partOfSpeech.isNotBlank()) {
                Text(d.partOfSpeech.lowercase(), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF7C3AED))
            }
            Text(d.definition, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary, modifier = Modifier.padding(top = 2.dp))
        } else {
            Text("No definition available for this word.", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun StatsRow(stats: List<Pair<String, String>>) {
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        stats.forEach { (value, label) ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(value, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp, color = WTheme.textMuted, textAlign = TextAlign.Center)
            }
        }
    }
}

private fun formatHints(mode: GameMode, hints: Int): String? {
    if (hints <= 0) return null
    if (mode != GameMode.DUEL_6 && mode != GameMode.DUEL_7 && mode != GameMode.PROPERNOUNDLE) return null
    return "$hints hint${if (hints > 1) "s" else ""}"
}

private fun fmt(s: Int): String = if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"
private fun fmtMs(ms: Int): String = fmt(ms / 1000)
private fun fmtShort(s: Int): String = if (s < 60) "${s}s" else "${s / 60}m"

/**
 * Gauntlet "Completed Today" card — ports iOS CompletedDailyCard's gauntlet
 * branch (GauntletCompletedView + ScoreBreakdownView): collapsible header with a
 * "C/5 · Ng · Xm" summary, then a 3-stat row (Stages / Guesses / Time), the
 * per-stage rows (✓/✗ badge + name + "Ng · time", tap → StageReviewModal), and
 * the score breakdown.
 */
@Composable
private fun GauntletCompletedDailyCard(g: GauntletProgress, elapsedSeconds: Int) {
    val cleared = g.stageResults.count { it.status == GameStatus.WON }
    val won = g.stageResults.size == g.totalStages && cleared == g.totalStages
    val totalGuesses = g.stageResults.sumOf { it.guesses }
    val stageMs = g.stageResults.sumOf { it.timeMs }
    val totalMs = if (stageMs > 0) stageMs else elapsedSeconds * 1000
    val totalSecs = totalMs / 1000
    // Cumulative boards solved across stages — same tally the score is recorded
    // with (matches the post-game breakdown). Denominator = every stage's boards.
    val cumBoards = g.stageResults.sumOf { r ->
        val st = g.stages.firstOrNull { it.stageIndex == r.stageIndex }
        if (st == null) 0
        else if (r.status == GameStatus.WON) st.boardCount
        else (r.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0)
    }
    val cumTotal = (g.stages.sumOf { it.boardCount }).coerceAtLeast(1)

    var expanded by remember { mutableStateOf(false) }
    var expandedStage by remember { mutableStateOf<Int?>(null) }

    Column(
        Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        Box(
            Modifier.fillMaxWidth().height(4.dp).background(
                Brush.horizontalGradient(
                    if (won) listOf(Color(0xFF7C3AED), Color(0xFFA78BFA))
                    else listOf(Color(0xFF9CA3AF), Color(0xFFD1D5DB)),
                ),
            ),
        )
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(16.dp).clip(CircleShape).background(if (won) Color(0xFFF5F3FF) else Color(0xFFFEE2E2)), Alignment.Center) {
                Text(if (won) "✓" else "✗", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            }
            Spacer(Modifier.width(8.dp))
            Text(
                if (won) "COMPLETED TODAY" else "ATTEMPTED TODAY",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp,
                color = if (won) Color(0xFF7C3AED) else WTheme.textMuted,
            )
            Spacer(Modifier.weight(1f))
            Text("$cleared/${g.totalStages} · ${totalGuesses}g · ${fmtShort(totalSecs)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Filled.KeyboardArrowDown, null, tint = WTheme.textMuted, modifier = Modifier.size(16.dp).rotate(if (expanded) 180f else 0f))
        }
        AnimatedVisibility(visible = expanded) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 16.dp, top = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // 3-stat summary (Stages / Guesses / Time)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    StatsRow(listOf("$cleared/${g.totalStages}" to "Stages", "$totalGuesses" to "Guesses", fmtMs(totalMs) to "Time"))
                }
                // Per-stage rows (tap → inline expand: ANSWERS + final boards)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    g.stages.forEach { stage ->
                        val r = g.stageResults.firstOrNull { it.stageIndex == stage.stageIndex } ?: return@forEach
                        val sWon = r.status == GameStatus.WON
                        val hasBoards = !r.boardsSnapshot.isNullOrEmpty()
                        val isExpanded = expandedStage == stage.stageIndex
                        Column {
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                                    .background(if (sWon) Color(0xFFF5F3FF) else Color(0xFFFEF2F2))
                                    .border(1.dp, if (sWon) Color(0xFFDDD6FE) else Color(0xFFFECACA), RoundedCornerShape(10.dp))
                                    .then(if (hasBoards) Modifier.clickableNoRipple { expandedStage = if (isExpanded) null else stage.stageIndex } else Modifier)
                                    .padding(horizontal = 10.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(Modifier.size(14.dp).clip(CircleShape).background(if (sWon) Color(0xFFF5F3FF) else Color(0xFFFEE2E2)), Alignment.Center) {
                                    Text(if (sWon) "✓" else "✗", fontSize = 8.sp, fontWeight = FontWeight.Black, color = if (sWon) Color(0xFF7C3AED) else Color(0xFFDC2626))
                                }
                                Spacer(Modifier.width(6.dp))
                                Text(stage.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.text, modifier = Modifier.weight(1f))
                                Text("${r.guesses}g · ${fmtMs(r.timeMs)}", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                if (hasBoards) {
                                    Spacer(Modifier.width(6.dp))
                                    Icon(Icons.Filled.KeyboardArrowDown, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp).rotate(if (isExpanded) 180f else 0f))
                                }
                            }
                            AnimatedVisibility(visible = isExpanded && hasBoards) {
                                Box(Modifier.padding(top = 6.dp, start = 4.dp, end = 4.dp, bottom = 2.dp)) {
                                    GauntletStageInlineReview(r)
                                }
                            }
                        }
                    }
                }
                // Score breakdown (cumulative run values — same as post-game).
                ScoreBreakdownCard(
                    mode = GameMode.GAUNTLET, won = won, guessCount = totalGuesses, elapsedSeconds = totalSecs,
                    boardsSolved = cumBoards, totalBoards = cumTotal, hintsUsed = 0,
                )
            }
        }
    }
}

/// Completed ProperNoundle card — real board reconstructed from recorded guesses,
/// tiles re-derived against today's answer, laid out in the answer's word groups.
/// Mirrors the web `CompletedProperNoundleMiniBoard` + the single-board card chrome.
@Composable
private fun ProperNoundleCompletedDailyCard(
    guesses: List<String>,
    puzzle: com.wordocious.core.NPuzzle,
    timeSeconds: Int,
) {
    val lastTiles = guesses.lastOrNull()
        ?.let { com.wordocious.core.ProperNoundle.evaluate(it, puzzle.answer) } ?: emptyList()
    val won = com.wordocious.core.ProperNoundle.isWin(lastTiles)
    val guessCount = guesses.size
    val summary = "$guessCount/6 · ${fmt(timeSeconds)}"
    var expanded by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        Box(
            Modifier.fillMaxWidth().height(4.dp).background(
                Brush.horizontalGradient(
                    if (won) listOf(Color(0xFF7C3AED), Color(0xFFA78BFA))
                    else listOf(Color(0xFF9CA3AF), Color(0xFFD1D5DB)),
                ),
            ),
        )
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(16.dp).clip(CircleShape).background(if (won) Color(0xFFF5F3FF) else Color(0xFFFEE2E2)), Alignment.Center) {
                Text(if (won) "✓" else "✗", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            }
            Spacer(Modifier.width(8.dp))
            Text(
                if (won) "COMPLETED TODAY" else "ATTEMPTED TODAY",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp,
                color = if (won) Color(0xFF7C3AED) else WTheme.textMuted,
            )
            Spacer(Modifier.weight(1f))
            Text(summary, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Filled.KeyboardArrowDown, null, tint = WTheme.textMuted, modifier = Modifier.size(16.dp).rotate(if (expanded) 180f else 0f))
        }
        AnimatedVisibility(visible = expanded) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                ProperNoundleMiniBoard(guesses = guesses, puzzle = puzzle)
                Spacer(Modifier.height(12.dp))
                Text(puzzle.display.uppercase(), fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = WTheme.text)
                Spacer(Modifier.height(12.dp))
                StatsRow(listOf("$guessCount/6" to "Guesses", fmt(timeSeconds) to "Time"))
                Spacer(Modifier.height(12.dp))
                ScoreBreakdownCard(
                    mode = GameMode.PROPERNOUNDLE, won = won, guessCount = guessCount, elapsedSeconds = timeSeconds,
                    boardsSolved = if (won) 1 else 0, totalBoards = 1, hintsUsed = 0,
                )
            }
        }
    }
}

@Composable
private fun ProperNoundleMiniBoard(guesses: List<String>, puzzle: com.wordocious.core.NPuzzle) {
    val groups = com.wordocious.core.ProperNoundle.wordGroups(puzzle.display)
    val starts = groups.runningFold(0) { acc, len -> acc + len }   // start offset per group
    val total = groups.sum().coerceAtLeast(1)
    val tileSize = (220f / total).coerceIn(10f, 18f).dp
    Column(verticalArrangement = Arrangement.spacedBy(3.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        for (r in 0 until 6) {
            val isPast = r < guesses.size
            val letters = if (isPast) com.wordocious.core.ProperNoundle.normalize(guesses[r]) else ""
            val tiles = if (isPast) com.wordocious.core.ProperNoundle.evaluate(guesses[r], puzzle.answer) else emptyList()
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                groups.forEachIndexed { gi, len ->
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        for (k in 0 until len) {
                            val i = starts[gi] + k
                            val letter = if (isPast && i < letters.length) letters[i].toString().uppercase() else ""
                            val state = if (isPast && i < tiles.size) tiles[i] else TileState.EMPTY
                            TileView(letter = letter, state = state, cornerRadius = 3.dp, fontSize = 8f, square = true, modifier = Modifier.size(tileSize))
                        }
                    }
                }
            }
        }
    }
}
