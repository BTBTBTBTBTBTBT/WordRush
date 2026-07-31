package com.wordocious.app.ui.game

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.graphics.graphicsLayer
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
import com.wordocious.app.ui.appBackground
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
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: ((GameMode) -> Unit)? = null,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val won = state.status == GameStatus.WON
    val board = state.boards[0]
    val solution = board.solution.uppercase()

    val guessCount = state.boards.maxOf { it.guesses.size } // web parity: max across boards
    val boardsSolved = state.boards.count { it.status == GameStatus.WON }
    val totalBoards = state.boards.size
    val multiBoard = totalBoards > 1
    // Loss-credit breakdown inputs. Gauntlet: use the WHOLE-run cumulative
    // boards/total + stages-cleared so the displayed total equals the recorded
    // leaderboard score (state.boards holds only the final stage). Single-board:
    // best green (correct-position) count across the player's own guesses (hint
    // rows excluded).
    val gauntletProgress = state.gauntlet?.takeIf { mode == GameMode.GAUNTLET }
    val cardBoardsSolved = if (gauntletProgress != null) gauntletProgress.stageResults.sumOf { r ->
        if (r.status == GameStatus.WON) (gauntletProgress.stages.getOrNull(r.stageIndex)?.boardCount ?: 0)
        else (r.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0)
    } else (if (won) boardsSolved else 0)
    val cardTotalBoards = if (gauntletProgress != null) (gauntletProgress.stages.sumOf { it.boardCount }.takeIf { it > 0 } ?: 21) else totalBoards
    val stagesCompleted = gauntletProgress?.stageResults?.count { it.status == GameStatus.WON }
    val bestCorrectLetters = if (mode != GameMode.GAUNTLET && totalBoards == 1) {
        val b0 = state.boards[0]
        b0.guesses.fold(0) { best, gw ->
            if (b0.hintEvaluations?.containsKey(gw) == true) best
            else maxOf(best, com.wordocious.core.evaluateGuess(b0.solution, gw).tiles.count { it.state == com.wordocious.core.TileState.CORRECT })
        }
    } else null

    // NOTE: the daily_results row is written exclusively by GameScreen's record
    // pipeline (GameResultsService.record → recordDailyResult) with run-correct
    // values. A second writer here used FINAL-STAGE values for Gauntlet
    // (solved/4 instead of solved/21) and could out-score the correct row in
    // the best-score upsert — removed.

    val accent = modeAccent(mode)
    val share = { reveal: Boolean ->
        val text = com.wordocious.app.data.ShareHelper.buildShareText(state, mode, elapsedSeconds)
        // Render the web-parity share card (1080px PNG) and share image + text.
        val pn = if (mode == GameMode.PROPERNOUNDLE)
            com.wordocious.core.ProperNoundle.puzzleFor(state.boards[0].solution) else null
        val bitmap = runCatching {
            com.wordocious.app.data.ShareImage.render(
                context = context, state = state, mode = mode,
                modeLabel = com.wordocious.app.data.ShareHelper.modeLabel(mode),
                elapsedSeconds = elapsedSeconds,
                category = pn?.themeCategory,
                wordGroups = pn?.display?.split(" ")?.map { it.length }?.takeIf { it.size > 1 },
                reveal = reveal,
                solutionDisplay = pn?.display,
            )
        }.getOrNull()
        com.wordocious.app.data.ShareEvents.log(
            kind = if (bitmap != null) "image" else "text",
            gameMode = mode.name.lowercase(),
            surface = "post_game",
        )
        if (bitmap != null) com.wordocious.app.data.ShareImage.share(context, bitmap, text, state, mode, elapsedSeconds, reveal)
        else com.wordocious.app.data.ShareHelper.share(context, text)
    }
    // Gauntlet's card is stage chips (zero tiles — already spoiler-free), so it
    // shares directly; every other mode gets the two-option chooser.
    var showShareChooser by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val onSharePressed = { if (mode == GameMode.GAUNTLET) share(false) else showShareChooser = true }
    if (showShareChooser) {
        com.wordocious.app.ui.ShareVariantSheet(
            onPick = { reveal -> showShareChooser = false; share(reveal) },
            onDismiss = { showShareChooser = false },
        )
    }

    // iOS GameScreen routes EVERY Gauntlet finish (win or loss) to the dedicated
    // animated GauntletResultsView — the generic header below reports the FINAL
    // STAGE's boards/guesses, not the run's.
    if (gauntletProgress != null) {
        Box(modifier = Modifier.fillMaxSize().appBackground().statusBarsPadding()) {
            GauntletResultsScreen(
                g = gauntletProgress, won = won, seed = seed, elapsedSeconds = elapsedSeconds,
                hintsUsed = hintsUsed, onHome = onBack, onShare = onSharePressed,
                onPlayAgain = if (seed.startsWith("unlimited-") &&
                    com.wordocious.app.data.AuthService.isProActive
                ) onPlayAgain else null,
                onOpenDaily = onOpenDaily,
            )
            CornerHomeButton(accent, onBack)
        }
        return
    }

    Box(modifier = Modifier.fillMaxSize().appBackground().statusBarsPadding()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp).padding(top = 12.dp, bottom = 24.dp),
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
                // iOS stacks the thumbnail ABOVE a centered 20pt name.
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    imageUrl?.let { url ->
                        coil.compose.AsyncImage(
                            model = url, contentDescription = null,
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp))
                                .border(2.dp, if (won) Color(0xFF7C3AED) else Color(0xFFDC2626), RoundedCornerShape(12.dp)),
                        )
                    }
                    Text(
                        if (won) (puzzle?.display ?: solution) else "The answer was: ${puzzle?.display ?: solution}",
                        fontSize = 20.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                        color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444),
                    )
                }
                // Full (un-redacted) Wikipedia clue — doubles as the definition.
                val clue by androidx.compose.runtime.produceState<String?>(initialValue = null, key1 = puzzle?.id) {
                    value = puzzle?.let { com.wordocious.app.data.WikipediaHint.fetch(it.display, it.wikiTitle, redact = false) ?: it.hint }
                }
                clue?.let {
                    Text(
                        it, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
            }
            FinishedStatsHeader(
                mode = mode, won = won, guessCount = guessCount, maxGuesses = board.maxGuesses,
                timeSeconds = elapsedSeconds, boardsSolved = boardsSolved, totalBoards = totalBoards,
                onHome = onBack, onShare = onSharePressed,
                // Web parity: Play Again only on non-daily (Unlimited) games for Pro.
                onPlayAgain = if (seed.startsWith("unlimited-") &&
                    com.wordocious.app.data.AuthService.isProActive
                ) onPlayAgain else null,
            )

            // Daily-only, like iOS GameScreen (`if vm.isDaily`) — an Unlimited
            // game's result has nothing to do with today's leaderboard.
            if (seed == com.wordocious.app.todayLocalSeed(mode.name)) DailyRankBadge(mode)

            // Board reveal (the actual finished board with colors).
            if (multiBoard) {
                // Compact uniform recap (completed-daily-board sizing) — the
                // in-play MultiBoardLayout rendered 2-column modes
                // (QuadWord/Deliverance) zoomed huge post-game while OctoWord's
                // 4 columns looked right (iOS build-87 parity).
                CompletedBoardsRecapGrid(state.boards)
            } else {
                Box(
                    modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    SingleBoard(
                        board = board, currentGuess = "",
                        modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                        // The in-play board splits a multi-word ProperNoundle answer
                        // on its word boundaries (iOS NoundleBoard); omitting the
                        // groups here made the SAME answer collapse into one flat
                        // run of tiles the moment the game ended — "TAYLOR SWIFT"
                        // finished as eleven undifferentiated squares.
                        wordGroups = if (mode == GameMode.PROPERNOUNDLE) {
                            com.wordocious.core.ProperNoundle.puzzleFor(board.solution)
                                ?.let { com.wordocious.core.ProperNoundle.wordGroups(it.display) }
                        } else null,
                    )
                }
            }

            ScoreBreakdownCard(
                mode = mode, won = won, guessCount = guessCount, elapsedSeconds = elapsedSeconds,
                boardsSolved = cardBoardsSolved, totalBoards = cardTotalBoards, hintsUsed = hintsUsed,
                stagesCompleted = stagesCompleted, bestCorrectLetters = bestCorrectLetters,
                day = seed?.let { com.wordocious.core.getDailySeedDate(it) },
            )

            // U3: next-daily handoff — DAILY games only (seed == today's daily
            // seed for this mode; unlimited seeds are "unlimited-…" and VS has
            // its own screen). Keeps the 9-mode daily loop moving.
            if (onOpenDaily != null && seed == com.wordocious.app.todayLocalSeed(mode.name)) {
                NextDailyRow(currentMode = mode, onOpenDaily = onOpenDaily)
            }

            // Single-board modes: word definition (with "No definition" fallback).
            if (!multiBoard && mode != GameMode.PROPERNOUNDLE) {
                DefinitionCard(solution)
            }
        }

        CornerHomeButton(accent, onBack)
    }
}

/** Corner Home button (top-left) — accent circle, matches the in-game one. */
@Composable
private fun CornerHomeButton(accent: Color, onBack: () -> Unit) {
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

/**
 * Full Gauntlet results screen — ports iOS GauntletResultsView: 60dp trophy /
 * ✗ icon, CLEARED/FAILED gradient headline, Home·Share·Play Again links, daily
 * rank badge, three boxed RUN-level stat cards (the run's stages/guesses/time,
 * not the final stage's), score breakdown, next-daily handoff, then the stage
 * breakdown — all on a staggered fade-and-rise entrance.
 */
@Composable
private fun GauntletResultsScreen(
    g: com.wordocious.core.GauntletProgress, won: Boolean, seed: String, elapsedSeconds: Int, hintsUsed: Int,
    onHome: () -> Unit, onShare: () -> Unit,
    onPlayAgain: (() -> Unit)?, onOpenDaily: ((GameMode) -> Unit)?,
) {
    val cleared = g.stageResults.count { it.status == GameStatus.WON }
    val totalGuesses = g.stageResults.sumOf { it.guesses }
    val totalTimeMs = g.stageResults.sumOf { it.timeMs }.takeIf { it > 0 } ?: (elapsedSeconds * 1000)
    val cumBoards = g.stageResults.sumOf { r ->
        if (r.status == GameStatus.WON) (g.stages.firstOrNull { it.stageIndex == r.stageIndex }?.boardCount ?: 0)
        else (r.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0)
    }
    val cumTotal = max(1, g.stages.sumOf { it.boardCount })
    val isDaily = seed == com.wordocious.app.todayLocalSeed(GameMode.GAUNTLET.name)

    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val iconScale by androidx.compose.animation.core.animateFloatAsState(
        if (appeared) 1f else 0.6f,
        androidx.compose.animation.core.tween(if (WTheme.reducedMotion) 0 else 400, 50, androidx.compose.animation.core.EaseOut),
        label = "gauntletIcon",
    )

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp).padding(top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                if (won) Icons.Filled.EmojiEvents else Icons.Filled.Cancel, null,
                tint = if (won) Color(0xFFD97706) else Color(0xFFF87171),
                modifier = Modifier.size(60.dp)
                    .graphicsLayer { scaleX = iconScale; scaleY = iconScale; alpha = iconScale },
            )
            if (won) {
                Text(
                    "GAUNTLET CLEARED!", fontSize = 34.sp, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center, modifier = Modifier.riseIn(appeared, 150),
                    style = TextStyle(
                        brush = Brush.horizontalGradient(listOf(Color(0xFFFACC15), Color(0xFFF472B6), Color(0xFFC084FC))),
                        fontFamily = Nunito,
                    ),
                )
            } else {
                Text(
                    "GAUNTLET FAILED", fontSize = 34.sp, fontWeight = FontWeight.Black,
                    color = Color(0xFFFCA5A5), textAlign = TextAlign.Center,
                    modifier = Modifier.riseIn(appeared, 150),
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.riseIn(appeared, 250),
            ) {
                Text(
                    "Home", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    textDecoration = TextDecoration.Underline, modifier = Modifier.clickableNoRipple(onHome),
                )
                Text(
                    "Share", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF3B82F6),
                    textDecoration = TextDecoration.Underline, modifier = Modifier.clickableNoRipple(onShare),
                )
                if (onPlayAgain != null) {
                    Text(
                        "Play Again", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA855F7),
                        textDecoration = TextDecoration.Underline, modifier = Modifier.clickableNoRipple(onPlayAgain),
                    )
                }
            }
            if (isDaily) Box(Modifier.riseIn(appeared, 300)) { DailyRankBadge(GameMode.GAUNTLET) }
        }

        Row(
            modifier = Modifier.fillMaxWidth().riseIn(appeared, 400),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GauntletStatCard(Icons.Filled.EmojiEvents, Color(0xFF7C3AED), "$cleared/${g.totalStages}", "Stages", Modifier.weight(1f))
            GauntletStatCard(Icons.Filled.Tag, Color(0xFF60A5FA), "$totalGuesses", "Guesses", Modifier.weight(1f))
            GauntletStatCard(Icons.Filled.Schedule, Color(0xFFFB923C), fmtRunTime(totalTimeMs), "Time", Modifier.weight(1f))
        }

        Box(Modifier.riseIn(appeared, 500)) {
            ScoreBreakdownCard(
                mode = GameMode.GAUNTLET, won = won, guessCount = totalGuesses,
                elapsedSeconds = totalTimeMs / 1000, boardsSolved = cumBoards, totalBoards = cumTotal,
                hintsUsed = hintsUsed, stagesCompleted = cleared,
                day = com.wordocious.core.getDailySeedDate(seed),
            )
        }

        if (onOpenDaily != null && isDaily) {
            Box(Modifier.riseIn(appeared, 550)) { NextDailyRow(currentMode = GameMode.GAUNTLET, onOpenDaily = onOpenDaily) }
        }

        // Same breakdown the Completed-Today card and the VS result screen use —
        // iOS reuses one GauntletCompletedView here too. This screen previously
        // had its own card whose rows put the ✓/✗ on the RIGHT with no badge, no
        // stage time and no expand affordance, and opened a hardcoded-white
        // Dialog (unreadable in dark) instead of expanding in place.
        Box(Modifier.riseIn(appeared, 600)) {
            GauntletStageBreakdown(
                g = g,
                totalMs = totalTimeMs,
                showSummary = false,      // the boxed stat cards above already say it
                showStageHeader = true,
            )
        }
    }
}

/** iOS RiseIn: fade in while rising 14pt, eased out after [delayMs]. */
@Composable
private fun Modifier.riseIn(appeared: Boolean, delayMs: Int): Modifier {
    val reduced = WTheme.reducedMotion
    val t by androidx.compose.animation.core.animateFloatAsState(
        if (appeared) 1f else 0f,
        androidx.compose.animation.core.tween(
            if (reduced) 0 else 400, if (reduced) 0 else delayMs, androidx.compose.animation.core.EaseOut,
        ),
        label = "riseIn",
    )
    return this.graphicsLayer { alpha = t; translationY = (1f - t) * 14.dp.toPx() }
}

/** Boxed run stat (iOS GauntletResultsView.statCard). */
@Composable
private fun GauntletStatCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color,
    value: String, label: String, modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(14.dp)).background(WTheme.surfaceHover)
            .border(1.dp, WTheme.border, RoundedCornerShape(14.dp)).padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
        Text(value, fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/** iOS GauntletResultsView.fmt — compact "45s" / "2m 5s" from milliseconds. */
private fun fmtRunTime(ms: Int): String {
    val s = ms / 1000
    return if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"
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
    onHome: () -> Unit, onShare: () -> Unit, onPlayAgain: (() -> Unit)? = null,
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
            style = TextStyle(brush = Brush.horizontalGradient(modeTitleGradient(mode)), fontFamily = Nunito),
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
            color = if (won) Color(0xFF7C3AED) else Color(0xFFF87171), textAlign = TextAlign.Center,
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
            // Pro Unlimited only (web: amber "Play Again" on non-daily games).
            if (onPlayAgain != null) {
                Text(
                    if (won) "Play Again" else "Try Again",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD97706),
                    textDecoration = TextDecoration.Underline, modifier = Modifier.clickableNoRipple(onPlayAgain),
                )
            }
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
    // Count-query rank (web/iOS parity) — replaces the legacy fetch-1000-and-
    // scan userRankAndTotal, which broke silently past 1,000 players and
    // labeled a never-played user "rank N+1" instead of showing nothing.
    val rank by produceState<LeaderboardService.RankInfo?>(initialValue = null, key1 = mode, key2 = userId) {
        value = if (userId != null) LeaderboardService.getUserDailyRank(userId, mode.name) else null
    }
    val r = rank ?: return
    val (position, total) = r
    if (total < 2) return
    // Shared ROUNDING semantics (ui/Format.kt) — this badge truncated where
    // web rounded, so the same rank read "Top 13%" here, "Top 12%" on web.
    val badge = com.wordocious.app.ui.topPercentLabel(position, total)
    val gold = badge.gold

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
            "${badge.label} · #$position of $total", fontSize = 10.sp, fontWeight = FontWeight.Black,
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
    stagesCompleted: Int? = null, bestCorrectLetters: Int? = null,
    // The PUZZLE's day (YYYY-MM-DD) — pre-cutover days render with the frozen
    // V1 formula so the card always matches the recorded score. null = current.
    day: String? = null,
) {
    val b = DailyScoring.breakdown(mode.name, won, guessCount, elapsedSeconds, boardsSolved, totalBoards, hintsUsed, stagesCompleted, bestCorrectLetters, day)
    val guessesLeft = max(0, b.maxGuesses - guessCount)
    val timeUnder = max(0, b.timeCap - elapsedSeconds)

    Column(
        // iOS caps the card at 400pt so tablet/landscape doesn't stretch the rows.
        modifier = Modifier.widthIn(max = 400.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(WTheme.bg).border(1.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("SCORE BREAKDOWN", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
            Text("${b.total.toInt()} pts", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        }
        ScoreRow(if (won) "Win bonus" else "Did not finish", if (won) "" else "no win bonus", b.basePoints)
        if (won && b.guessBonusApplies) ScoreRow("Guess bonus", "$guessesLeft unused × ${b.guessWeight}", b.guessBonus)
        if (won) ScoreRow("Speed bonus", "${fmtSecs(timeUnder)} under ${fmtSecs(b.timeCap)}", b.timeBonus)
        if (b.completionBonus > 0) {
            val (compLabel, compDetail) = when {
                won -> "Completion bonus" to (if (totalBoards > 1) "$boardsSolved/$totalBoards boards" else "puzzle solved")
                mode == GameMode.GAUNTLET -> "Stage progress" to "${stagesCompleted ?: 0}/5 stages cleared"
                totalBoards == 1 -> {
                    val n = bestCorrectLetters ?: 0
                    "Near miss" to "$n correct letter${if (n == 1) "" else "s"}"
                }
                else -> "Completion bonus" to "$boardsSolved/$totalBoards boards"
            }
            ScoreRow(compLabel, compDetail, b.completionBonus)
        }
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
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (pure) Color(0xFF7C3AED) else WTheme.text)
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
 * U3: compact handoff row under the score breakdown of a DAILY result — points
 * at the FIRST still-unplayed daily mode in the home-grid order (MODE_CARDS,
 * the canonical order) in that mode's accent; tap closes this game and opens
 * that mode's daily (same route as the home cards / leaderboard Play CTA).
 * All 9 done → static "Sweep complete!" line.
 */
@Composable
private fun NextDailyRow(currentMode: GameMode, onOpenDaily: (GameMode) -> Unit) {
    // Dailies only record for signed-in accounts; guests get nothing — so a
    // guest's completions map is always empty and "next" would be a lie (iOS
    // PostGameViews wraps the whole CTA in the same check).
    if (AuthService.profile.value == null) return
    // Seed from the day-keyed cache (updated the instant this game recorded via
    // noteCompletion), then confirm against the server; re-fetch on completionTick.
    val tick by com.wordocious.app.data.DailyCompletionsService.completionTick.collectAsState()
    val completions by produceState(
        initialValue = com.wordocious.app.data.DailyCompletionsService.readCache(), key1 = tick,
    ) {
        value = com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions()
    }
    // First unplayed daily in home-grid order. The just-finished mode is
    // excluded outright — its row can lag the record pipeline (or never exist
    // for guests) and it's never a sensible "next".
    val next = com.wordocious.app.ui.MODE_CARDS.firstOrNull { c ->
        c.engineMode != null && c.engineMode != currentMode && completions[c.engineMode.name] == null
    }
    val allDone = next == null &&
        completions.size >= com.wordocious.app.data.DailyCompletionsService.TOTAL_DAILY_MODES
    // next == null with count < 9 can't normally happen (next covers every
    // gap); render nothing rather than a wrong claim if state is mid-flight.
    if (next == null && !allDone) return

    // iOS renders a compact accent-tinted CAPSULE (two-tone label + arrow glyph),
    // not a full-width neutral card.
    if (next != null) {
        Row(
            modifier = Modifier.clip(RoundedCornerShape(50))
                .background(next.accent.copy(alpha = 0.08f))
                .border(1.5.dp, next.accent.copy(alpha = 0.5f), RoundedCornerShape(50))
                .then(
                    if (next.engineMode != null) Modifier.clickableNoRipple { onOpenDaily(next.engineMode) }
                    else Modifier
                )
                .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Next Daily:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(next.title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = next.accent)
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = next.accent, modifier = Modifier.size(11.dp))
        }
    } else {
        Text(
            "All 9 dailies done — Sweep complete! 🏆",
            fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED),
            modifier = Modifier.padding(vertical = 4.dp),
        )
    }
}

/**
 * Dictionary definition card (ports iOS DefinitionCard). Always populates once
 * loaded — shows "No definition available for this word." rather than a blank
 * gap when the dictionary has no entry.
 */
@Composable
internal fun DefinitionCard(word: String) {
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
                // Themed, not a fixed #4A4A6A slate: on the Dark card that was
                // 2.02:1 and the definition read as a rendering fault next to
                // the muted lines beside it.
                Text(d.definition, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary)
            }
        } else {
            Text(
                "No definition available for this word.",
                fontSize = 13.sp, fontWeight = FontWeight.Medium, fontStyle = FontStyle.Italic, color = WTheme.textMuted,
            )
        }
    }
}
