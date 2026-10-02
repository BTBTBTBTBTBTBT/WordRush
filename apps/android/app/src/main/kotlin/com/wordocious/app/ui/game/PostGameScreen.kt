package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
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
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.draw.drawWithContent
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
 * DefinitionCard (single-board), with corner Home + "?" buttons. NO colored
 * banner. ProperNoundle instead mirrors iOS ProperNoundleView's finished
 * ScrollView — its in-play header (red title + category/number/letters meta
 * row), the BOARD, then the result block (photo → name → solved line → full
 * clue → action row → rank badge) above the shared score card.
 */
@Composable
fun PostGameScreen(
    state: GameState,
    mode: GameMode,
    seed: String,
    elapsedSeconds: Int = 0,
    hintsUsed: Int = 0,
    /** ProperNoundle only: the redacted Clue if the player revealed it —
     *  iOS keeps it in the header on the finished screen. */
    pnRevealedClue: String? = null,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: ((GameMode) -> Unit)? = null,
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
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
    // §233 (founder, Doug's Deliverance-loss screenshot): this used to pass 0
    // boards on a loss, so a 3/4 loss read "0 pts / Did not finish" while the
    // recorded composite was ~150 — computeRunScore feeds the REAL solved count
    // into the same DailyScoring.breakdown, so the card was lying about the
    // number on the leaderboard. iOS GameScreen passes the actual solved count
    // for wins AND losses; match it.
    val cardBoardsSolved = if (gauntletProgress != null) gauntletProgress.stageResults.sumOf { r ->
        if (r.status == GameStatus.WON) (gauntletProgress.stages.getOrNull(r.stageIndex)?.boardCount ?: 0)
        else (r.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0)
    } else boardsSolved
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
        Box(modifier = Modifier.fillMaxSize().gameBackground { appBackground() }.statusBarsPadding()) {
            GauntletResultsScreen(
                g = gauntletProgress, won = won, seed = seed, elapsedSeconds = elapsedSeconds,
                hintsUsed = hintsUsed, onHome = onBack, onShare = onSharePressed,
                onPlayAgain = if (seed.startsWith("unlimited-") &&
                    com.wordocious.app.data.AuthService.isProActive
                ) onPlayAgain else null,
                onOpenDaily = onOpenDaily,
                onOpenUnlimited = onOpenUnlimited,
                onOpenLeaderboard = onOpenLeaderboard,
            )
            CornerHomeButton(accent, onBack)
            PostGameHelpButton(mode, accent)
        }
        return
    }

    Box(modifier = Modifier.fillMaxSize().gameBackground { appBackground() }.statusBarsPadding()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp)
                // B6: the controls row overlays the top; the title art (non-PN) clears it itself.
                .padding(top = if (mode == GameMode.PROPERNOUNDLE) 12.dp else 0.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Web parity: Play Again only on non-daily (Unlimited) games for Pro.
            val playAgain = if (seed.startsWith("unlimited-") &&
                com.wordocious.app.data.AuthService.isProActive
            ) onPlayAgain else null
            val isDailySeed = seed == com.wordocious.app.todayLocalSeed(mode.name)
            val pnPuzzle = if (mode == GameMode.PROPERNOUNDLE) {
                androidx.compose.runtime.remember(board.solution) {
                    com.wordocious.core.ProperNoundle.puzzleFor(board.solution)
                }
            } else null

            if (mode == GameMode.PROPERNOUNDLE) {
                // iOS ProperNoundleView keeps its IN-PLAY header on the finished
                // screen (`isFinished` renders header → NoundleBoard → result):
                // flat red 24sp title, then the category capsule / daily puzzle
                // number / letter-count meta row (only the live timer hides on
                // finish), then the revealed Clue if the player bought it. This
                // screen used to drop the header entirely, so the post-game
                // opened cold on the result text with no mode identity.
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        com.wordocious.app.ui.modeTitle(mode),
                        color = Color(0xFFDC2626), fontSize = 24.sp, fontWeight = FontWeight.Black,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pnPuzzle?.themeCategory?.let { PnCategoryPill(it) }
                        if (seed.startsWith("daily-")) {
                            Text(
                                "#${com.wordocious.core.ProperNoundle.dailyPuzzleNumber(com.wordocious.app.todayLocalDate())}",
                                color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                            )
                        }
                        Text(
                            "${board.solution.length} letters",
                            color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        )
                    }
                    pnRevealedClue?.let {
                        Text(
                            it, color = WTheme.textSecondary, fontSize = 12.sp,
                            fontStyle = FontStyle.Italic, fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 20.dp),
                        )
                    }
                }
            } else {
                // B6 / B4: the game's title art under the controls row, then the result line.
                com.wordocious.app.ui.HostedGameTitle(mode.name) {
                    Text(
                        modeTitle(mode), fontSize = 28.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(brush = Brush.horizontalGradient(modeTitleGradient(mode)), fontFamily = Nunito),
                        modifier = Modifier.padding(top = com.wordocious.app.ui.GAME_CORNER_ROW),
                    )
                }
                FinishedResultLine(
                    won = won, guessCount = guessCount, maxGuesses = board.maxGuesses,
                    timeSeconds = elapsedSeconds, boardsSolved = boardsSolved, totalBoards = totalBoards,
                    onShare = onSharePressed,
                )
                if (playAgain != null) {
                    com.wordocious.app.ui.CandyButton(
                        if (won) "Play again" else "Try again", onClick = playAgain,
                        color = com.wordocious.app.ui.CandyColor.PINK, size = com.wordocious.app.ui.CandySize.MEDIUM,
                        icon = com.wordocious.app.ui.CandyIcon.PLAY,
                    )
                }
                // Daily-only, like iOS GameScreen (`if vm.isDaily`) — an Unlimited
                // game's result has nothing to do with today's leaderboard.
                // (ProperNoundle's badge sits under its action row instead, below.)
                if (isDailySeed) DailyRankBadge(mode)
            }

            // Board reveal (the actual finished board with colors). iOS puts the
            // board directly under the header in EVERY mode — ProperNoundle
            // included: its result block (photo/name/bio) renders BELOW the
            // board, not above it.
            if (multiBoard) {
                // Compact uniform recap (completed-daily-board sizing) — the
                // in-play MultiBoardLayout rendered 2-column modes
                // (QuadWord/Deliverance) zoomed huge post-game while OctoWord's
                // 4 columns looked right (iOS build-87 parity). §233: on a loss
                // the unsolved boards spell out their missed word — the tap-
                // through GAME OVER overlay was the only reveal, and Doug's
                // screenshot showed the persistent screen kept the answer secret.
                CompletedBoardsRecapGrid(state.boards, revealMissed = !won)
            } else {
                Box(
                    modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    SingleBoard(
                        board = board, currentGuess = "",
                        modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                        animateLastRow = false,
                        // The in-play board splits a multi-word ProperNoundle answer
                        // on its word boundaries (iOS NoundleBoard); omitting the
                        // groups here made the SAME answer collapse into one flat
                        // run of tiles the moment the game ended — "TAYLOR SWIFT"
                        // finished as eleven undifferentiated squares.
                        wordGroups = pnPuzzle?.let { com.wordocious.core.ProperNoundle.wordGroups(it.display) },
                    )
                }
            }

            // ProperNoundle result block — iOS ProperNoundleView.result, in its
            // exact order: Wikipedia photo → display name (win = purple name;
            // loss = "The answer was: X" in red) → win-only solved line → full
            // un-redacted clue (the bio doubles as the definition) → icon action
            // row → rank badge. The score card follows below, shared.
            if (mode == GameMode.PROPERNOUNDLE) {
                val imageUrl by androidx.compose.runtime.produceState<String?>(initialValue = null, key1 = pnPuzzle?.id) {
                    value = pnPuzzle?.let { com.wordocious.app.data.WikipediaHint.fetchImageUrl(it.display, it.wikiTitle) }
                }
                imageUrl?.let { url ->
                    coil.compose.AsyncImage(
                        // Explicit request so the load carries an app-identifying
                        // User-Agent: upload.wikimedia.org 403s Coil/OkHttp's
                        // default "okhttp/x" UA (Wikimedia UA policy), which left
                        // a bordered-but-EMPTY photo frame on real devices while
                        // iOS's URLSession UA sailed through.
                        model = coil.request.ImageRequest.Builder(context)
                            .data(url)
                            .setHeader("User-Agent", com.wordocious.app.data.WikipediaHint.USER_AGENT)
                            .build(),
                        contentDescription = null,
                        // Whole image, no crop (founder, Aug 11): Crop in a
                        // 64dp square beheaded portrait engravings — fit the
                        // intrinsic aspect within a 160dp cap.
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                        modifier = Modifier
                            .sizeIn(maxWidth = 160.dp, maxHeight = 160.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(2.dp, if (won) Color(0xFF7C3AED) else Color(0xFFDC2626), RoundedCornerShape(12.dp)),
                    )
                }
                Text(
                    if (won) (pnPuzzle?.display ?: solution) else "The answer was: ${pnPuzzle?.display ?: solution}",
                    fontSize = 20.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                    color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444),
                )
                if (won) {
                    Text(
                        "Solved in $guessCount ${if (guessCount == 1) "guess" else "guesses"} · ${pnTime(elapsedSeconds)}",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
                // Full (un-redacted) Wikipedia clue — doubles as the definition.
                val clue by androidx.compose.runtime.produceState<String?>(initialValue = null, key1 = pnPuzzle?.id) {
                    value = pnPuzzle?.let { com.wordocious.app.data.WikipediaHint.fetch(it.display, it.wikiTitle, redact = false) ?: it.hint }
                }
                clue?.let {
                    Text(
                        it, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
                PnResultActions(onHome = onBack, onShare = onSharePressed, onPlayAgain = playAgain)
                if (isDailySeed) DailyRankBadge(mode)
            }

            ScoreBreakdownCard(
                mode = mode, won = won, guessCount = guessCount, elapsedSeconds = elapsedSeconds,
                boardsSolved = cardBoardsSolved, totalBoards = cardTotalBoards, hintsUsed = hintsUsed,
                stagesCompleted = stagesCompleted, bestCorrectLetters = bestCorrectLetters,
                day = seed?.let { com.wordocious.core.getDailySeedDate(it) },
            )

            // B6: today's word on its green card (single-board modes; "No definition" fallback).
            if (!multiBoard && mode != GameMode.PROPERNOUNDLE) {
                DefinitionCard(solution, showTiles = true)
            }

            // U3 / B6: the CTAs — next daily (gold), this game's leaderboard (purple), keep
            // playing Unlimited (soft) — DAILY games only (seed == today's daily seed).
            if (onOpenDaily != null && seed == com.wordocious.app.todayLocalSeed(mode.name)) {
                NextDailyRow(currentMode = mode, onOpenDaily = onOpenDaily, onOpenUnlimited = onOpenUnlimited, onOpenLeaderboard = onOpenLeaderboard)
            }
        }

        CornerHomeButton(accent, onBack)
        PostGameHelpButton(mode, accent)
    }
}

/**
 * Top-right "?" + guide sheet. iOS keeps BOTH corner buttons (Home and "?") on
 * the finished screen — they live in the game ZStack outside the finished
 * branch — while Android's separate post-game screen only carried Home.
 */
@Composable
private fun androidx.compose.foundation.layout.BoxScope.PostGameHelpButton(mode: GameMode, accent: Color) {
    var showGuide by remember { mutableStateOf(false) }
    CornerHelpButton(
        accent = accent,
        onClick = { showGuide = true },
        modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET),
    )
    if (showGuide) GuideSheet(mode = mode, onDismiss = { showGuide = false })
}

/** Corner Home button (top-left) — the in-game one, inset 8 dp. */
@Composable
internal fun CornerHomeButton(accent: Color, onBack: () -> Unit) {
    CornerHomeButton(accent, onClick = onBack, modifier = Modifier.padding(GAME_CONTROLS_INSET))
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
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
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
            if (won) {
                com.wordocious.app.ui.Icon3D(
                    com.wordocious.app.ui.Icon3DName.TROPHY, 64.dp,
                    Modifier.graphicsLayer { scaleX = iconScale; scaleY = iconScale; alpha = iconScale },
                )
            } else {
                Icon(
                    Icons.Filled.Cancel, null,
                    tint = Color(0xFFF87171),
                    modifier = Modifier.size(60.dp)
                        .graphicsLayer { scaleX = iconScale; scaleY = iconScale; alpha = iconScale },
                )
            }
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
            // B6: no "Home" text link (the house in the controls row goes home); Share is the
            // 3D share icon; Play Again a candy button (A8).
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.riseIn(appeared, 250),
            ) {
                @Suppress("UNUSED_VARIABLE") val home = onHome
                com.wordocious.app.ui.SoftControl(com.wordocious.app.ui.Icon3DName.SHARE, "Share", onClick = onShare, iconSize = 32.dp)
                if (onPlayAgain != null) {
                    com.wordocious.app.ui.CandyButton(
                        "Play again", onClick = onPlayAgain,
                        color = com.wordocious.app.ui.CandyColor.PINK, size = com.wordocious.app.ui.CandySize.MEDIUM,
                        icon = com.wordocious.app.ui.CandyIcon.PLAY,
                    )
                }
            }
            if (isDaily) Box(Modifier.riseIn(appeared, 300)) { DailyRankBadge(GameMode.GAUNTLET) }
        }

        Row(
            modifier = Modifier.fillMaxWidth().riseIn(appeared, 400),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GauntletStatCard(com.wordocious.app.ui.Icon3DName.TROPHY, Color(0xFF7C3AED), "$cleared/${g.totalStages}", "Stages", Modifier.weight(1f))
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
            Box(Modifier.riseIn(appeared, 550)) {
                NextDailyRow(currentMode = GameMode.GAUNTLET, onOpenDaily = onOpenDaily, onOpenUnlimited = onOpenUnlimited, onOpenLeaderboard = onOpenLeaderboard)
            }
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
    /** An ImageVector, or a 3D set icon (HEADER_SPEC §2). */
    icon: Any, color: Color,
    value: String, label: String, modifier: Modifier = Modifier,
) {
    // A1 / A2: a tinted stat tile in its own color with a top bar and a soft number.
    Column(
        modifier = modifier.clip(RoundedCornerShape(14.dp))
            .background(com.wordocious.app.ui.accentWash(color, 0.12f))
            .drawWithContent { drawContent(); drawRect(color, size = androidx.compose.ui.geometry.Size(size.width, 4.dp.toPx())) }
            .border(1.5.dp, com.wordocious.app.ui.accentLine(color, 0.30f), RoundedCornerShape(14.dp)).padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        when (icon) {
            is com.wordocious.app.ui.Icon3DName -> com.wordocious.app.ui.Icon3D(icon, 22.dp)
            is androidx.compose.ui.graphics.vector.ImageVector -> Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
        }
        com.wordocious.app.ui.SoftNumber(value, 22.sp)
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

/** Web/iOS ProperNoundle formatTime: "m:ss" at a minute or more, else "Ns". */
private fun pnTime(s: Int): String = if (s >= 60) "%d:%02d".format(s / 60, s % 60) else "${s}s"

/**
 * ProperNoundle result actions — iOS ProperNoundleView.result renders Home /
 * Share / Play Again as icon+label buttons tinted the PN accent, not as the
 * generic underlined text links every other mode uses.
 */
@Composable
private fun PnResultActions(@Suppress("UNUSED_PARAMETER") onHome: () -> Unit, onShare: () -> Unit, onPlayAgain: (() -> Unit)?) {
    // B6 / A8: no text links — the 3D share icon and a candy Play Again (the house in
    // the controls row goes home).
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 2.dp),
    ) {
        com.wordocious.app.ui.SoftControl(com.wordocious.app.ui.Icon3DName.SHARE, "Share", onClick = onShare, iconSize = 32.dp)
        onPlayAgain?.let {
            com.wordocious.app.ui.CandyButton(
                "Play again", onClick = it,
                color = com.wordocious.app.ui.CandyColor.PINK, size = com.wordocious.app.ui.CandySize.MEDIUM,
                icon = com.wordocious.app.ui.CandyIcon.PLAY,
            )
        }
    }
}

/**
 * FINISH_SPEC B6 the finished game's result line: tinted pills with 3D icons and soft
 * numbers — guesses (purple), time (blue), plus boards solved (gold) on multi-board
 * games — and the 3D share icon (no "Home" / "Share" text links: the house in the
 * controls row goes home). A loss adds one short line under it.
 */
@Composable
private fun FinishedResultLine(
    won: Boolean, guessCount: Int, maxGuesses: Int,
    timeSeconds: Int, boardsSolved: Int, totalBoards: Int,
    onShare: () -> Unit,
) {
    val isMulti = totalBoards > 1
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        ) {
            if (isMulti) {
                ResultPill(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, "$boardsSolved/$totalBoards", "boards", Color(0xFFF5A524))
            }
            ResultPill(
                com.wordocious.app.ui.Icon3DName.CROWN,
                if (won || maxGuesses <= 0) "$guessCount" else "$guessCount/$maxGuesses",
                if (guessCount == 1) "guess" else "guesses", Color(0xFF7C3AED),
            )
            ResultPill(com.wordocious.app.ui.Icon3DName.TROPHY, clock(timeSeconds), "time", Color(0xFF2563EB))
            com.wordocious.app.ui.SoftControl(
                com.wordocious.app.ui.Icon3DName.SHARE, "Share", onClick = onShare, iconSize = 32.dp,
            )
        }
        if (!won) {
            Text(
                if (isMulti) "$boardsSolved of $totalBoards solved" else "Out of guesses",
                fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFE0526B), textAlign = TextAlign.Center,
            )
        }
    }
}

/** B6 a result pill: the accent's wash + line, a 4 dp accent bar, a 3D icon, a soft number and its label. */
@Composable
internal fun ResultPill(icon: com.wordocious.app.ui.Icon3DName, value: String, label: String, accent: Color) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier
            .shadow(3.dp, shape, clip = false, ambientColor = Color(0x1A4C1D95), spotColor = Color(0x1A4C1D95))
            .clip(shape)
            .background(com.wordocious.app.ui.accentWash(accent, 0.12f))
            .drawWithContent {
                drawContent()
                drawRect(accent, size = androidx.compose.ui.geometry.Size(size.width, 3.dp.toPx()))
            }
            .border(1.5.dp, com.wordocious.app.ui.accentLine(accent, 0.30f), shape)
            .padding(start = 6.dp, end = 12.dp, top = 6.dp, bottom = 6.dp)
            .semantics(mergeDescendants = true) { contentDescription = "$value $label" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        com.wordocious.app.ui.Icon3D(icon, 24.dp)
        com.wordocious.app.ui.SoftNumber(value, 17.sp)
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else Color(0xFF6F5F8F))
    }
}

/**
 * Daily-leaderboard standing capsule (ports iOS DailyRankBadge). Hidden until
 * ≥2 players have a result today. Gold styling at ≥75th percentile.
 */
@Composable
internal fun DailyRankBadge(mode: GameMode) {
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

    // A1: a tinted pill (gold at the top quarter, lavender otherwise), never white.
    val tone = if (gold) Color(0xFFF5A524) else Color(0xFF7C3AED)
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(com.wordocious.app.ui.accentWash(tone, 0.14f))
            .border(1.dp, com.wordocious.app.ui.accentLine(tone, 0.32f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, 13.dp, alpha = if (gold) 1f else 0.6f, colorFilter = if (gold) null else com.wordocious.app.ui.Icon3DMuted)
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

    // FINISH_SPEC B6: the score breakdown on a lavender card with a purple top bar,
    // dashed dividers, purple values and a big soft total. iOS caps it at 400 pt.
    com.wordocious.app.ui.TintedCard(
        accent = Color(0xFF7C3AED),
        modifier = Modifier.widthIn(max = 400.dp).fillMaxWidth(),
        tint = if (WTheme.isDark) WTheme.surface else com.wordocious.app.ui.FinishInk.lavender,
        line = if (WTheme.isDark) WTheme.border else com.wordocious.app.ui.FinishInk.lavenderLine,
        bar = Brush.horizontalGradient(listOf(Color(0xFF7C3AED), Color(0xFFA855F7))),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("SCORE BREAKDOWN", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textMuted else Color(0xFF5B3C96), letterSpacing = 1.3.sp)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "${b.total.toInt()} points" }) {
                com.wordocious.app.ui.SoftNumber("%,d".format(b.total.toInt()), 30.sp)
                Text("PTS", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9), letterSpacing = 1.2.sp, modifier = Modifier.padding(bottom = 3.dp))
            }
        }
        var first = true
        @Composable
        fun row(label: String, detail: String, value: Double, pure: Boolean = false) {
            ScoreRow(label, detail, value, pure, divider = !first)
            first = false
        }
        row(if (won) "Win bonus" else "Did not finish", if (won) "" else "no win bonus", b.basePoints)
        // The row reads through the mode's guess semantics (More Games §11):
        // Sudoku and Starsweep count mistakes, so theirs says "Mistake bonus".
        val bonusLabel = when (com.wordocious.app.ModeGen.byDbKey(mode.name)?.guessSemantics) {
            "mistakes" -> "Mistake bonus"
            "checks" -> "Check bonus"
            "misses" -> "Miss bonus"
            "overPar" -> "Par bonus"
            "rank" -> "Rank bonus"
            else -> "Guess bonus"
        }
        if (won && b.guessBonusApplies) row(bonusLabel, "$guessesLeft unused × ${b.guessWeight}", b.guessBonus)
        if (won) row("Speed bonus", if (elapsedSeconds > b.timeCap) "${fmtSecs(elapsedSeconds - b.timeCap)} over ${fmtSecs(b.timeCap)}" else "${fmtSecs(timeUnder)} under ${fmtSecs(b.timeCap)}", b.timeBonus)
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
            row(compLabel, compDetail, b.completionBonus)
        }
        if (b.hasHints) {
            val detail = if (hintsUsed > 0) "$hintsUsed hint${if (hintsUsed == 1) "" else "s"} × ${b.hintCost}" else "no hints — full credit"
            row("Hint penalty", detail, -b.hintPenalty, pure = won && hintsUsed == 0)
        }
    }
}

/** B6 a breakdown row: a dashed divider above, the label (+ small detail) and the purple value. */
@Composable
private fun ScoreRow(label: String, detail: String, value: Double, pure: Boolean = false, divider: Boolean = true) {
    val dash = Color(0x2E7C3AED)
    Row(
        modifier = Modifier.fillMaxWidth()
            .drawWithContent {
                if (divider) drawLine(
                    dash, androidx.compose.ui.geometry.Offset(0f, 0f), androidx.compose.ui.geometry.Offset(size.width, 0f),
                    strokeWidth = 1.dp.toPx(),
                    pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
                )
                drawContent()
            }
            .padding(vertical = 6.dp, horizontal = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f, fill = false)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (pure) Color(0xFF7C3AED) else if (WTheme.isDark) WTheme.text else Color(0xFF2A1650))
            if (detail.isNotEmpty()) Text(detail, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else Color(0xFF7A6A95), maxLines = 1)
        }
        val sign = if (value > 0) "+" else if (value < 0) "−" else ""
        Text(
            "$sign${"%,d".format(abs(value).toInt())}", fontSize = 15.sp, fontWeight = FontWeight.Black,
            style = TextStyle(fontFeatureSettings = "tnum", fontFamily = Nunito),
            color = if (value > 0) Color(0xFF6D28D9) else if (value < 0) Color(0xFFDC2626) else WTheme.textMuted,
        )
    }
}

private fun fmtSecs(s: Int): String = if (s <= 0) "0s" else if (s >= 60) "${s / 60}m ${s % 60}s" else "${s}s"

/**
 * U3: compact handoff row under the score breakdown of a DAILY result — points
 * at the FIRST still-unplayed daily mode in the home-grid order (MODE_CARDS,
 * the canonical order) in that mode's accent; tap closes this game and opens
 * that mode's daily (same route as the home cards / leaderboard Play CTA).
 * Whole sweep done (and, from a More Games title, no visible More Games daily
 * left) → static "Sweep complete!" line.
 */
@Composable
internal fun NextDailyRow(
    currentMode: GameMode,
    onOpenDaily: (GameMode) -> Unit,
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
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
    // Handoff order (More Games Stage 4/9): a sweep game hands to the next
    // unplayed sweep game; a More Games title (ProperNoundle, Sudoku…) hands to
    // the next unplayed More Games title this viewer can see, THEN the sweep.
    // The sweep never hands into More Games.
    val sweepKeys = com.wordocious.app.data.DailyCompletionsService.SWEEP_KEYS
    val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
    val fromMoreGames = currentMode.name !in sweepKeys
    val nextMore = if (!fromMoreGames) null else com.wordocious.app.ui.MORE_CARDS.firstOrNull { c ->
        c.engineMode != null && c.dailyEligible && c.engineMode != currentMode &&
            com.wordocious.app.data.FlagsService.isOn(c.flagKey, flagTable, flagsLoaded) &&
            completions[c.engineMode.name] == null
    }
    val nextSweep = com.wordocious.app.ui.MODE_CARDS.firstOrNull { c ->
        c.engineMode != null && c.engineMode.name in sweepKeys && c.engineMode != currentMode && completions[c.engineMode.name] == null
    }
    val next = nextMore ?: nextSweep
    val sweepTotal = com.wordocious.app.data.DailyCompletionsService.TOTAL_DAILY_MODES
    val allDone = next == null &&
        com.wordocious.app.data.DailyCompletionsService.sweepOnly(completions).size >= sweepTotal
    // next == null with the sweep incomplete can't normally happen (next covers
    // every gap); render nothing rather than a wrong claim if state is mid-flight.
    if (next == null && !allDone) return

    // FINISH_SPEC B6 / A8: the CTAs are glossy candy buttons with icons — gold (amber)
    // next daily, purple leaderboard, soft (peach) Unlimited — squishing on press.
    Column(
        Modifier.widthIn(max = 440.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (next != null) {
            if (next.engineMode != null) {
                com.wordocious.app.ui.CandyButton(
                    "Next daily: ${next.title}",
                    onClick = { onOpenDaily(next.engineMode) },
                    modifier = Modifier.fillMaxWidth(),
                    color = com.wordocious.app.ui.CandyColor.AMBER,
                    fill = true, fontSize = 16.sp, trailing = "›",
                    leading = { CtaGameIcon(next.id) },
                )
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, 20.dp)
                Text(
                    "All $sweepTotal dailies done. Sweep complete!",
                    fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED),
                )
            }
        }

        // §214 (Lindsay): straight from the finish line to the scoreboard — this
        // mode's daily board.
        if (onOpenLeaderboard != null) {
            val lbTitle = com.wordocious.app.ModeGen.byDbKey(currentMode.name)?.title
                ?: com.wordocious.app.ui.modeCardFor(currentMode)?.title ?: currentMode.name
            com.wordocious.app.ui.CandyButton(
                "$lbTitle Leaderboard",
                onClick = { onOpenLeaderboard(currentMode) },
                modifier = Modifier.fillMaxWidth(),
                color = com.wordocious.app.ui.CandyColor.PURPLE,
                fill = true, fontSize = 16.sp, trailing = "›",
                leading = { com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, 26.dp) },
            )
        }

        // "Keep playing: Unlimited <Mode>" — Pro-only handoff into an Unlimited game of
        // the SAME mode the player just finished (tester-reported dead end after the
        // daily sweep).
        if (onOpenUnlimited != null && AuthService.isProActive) {
            // Full mode name per founder ("Unlimited Succession", not "Succ.").
            val fullTitle = com.wordocious.app.ModeGen.byDbKey(currentMode.name)?.title
                ?: com.wordocious.app.ui.modeCardFor(currentMode)?.title ?: currentMode.name
            com.wordocious.app.ui.CandyButton(
                "Keep playing: Unlimited $fullTitle",
                onClick = { onOpenUnlimited(currentMode) },
                modifier = Modifier.fillMaxWidth(),
                color = com.wordocious.app.ui.CandyColor.PEACH,
                fill = true, fontSize = 15.sp, trailing = "›",
                leading = { CtaGameIcon(com.wordocious.app.ModeGen.byDbKey(currentMode.name)?.id) },
            )
        }
    }
}

/** A CTA's leading game icon (the glossy 3D game art), decorative. */
@Composable
private fun CtaGameIcon(modeId: String?) {
    val art = com.wordocious.app.ui.gameArtRes(modeId)
    if (art != null) {
        androidx.compose.foundation.Image(
            androidx.compose.ui.res.painterResource(art), contentDescription = null, modifier = Modifier.size(28.dp),
        )
    } else {
        com.wordocious.app.ui.CandyGlyph(com.wordocious.app.ui.CandyIcon.ARROW, 20.dp)
    }
}

/**
 * FINISH_SPEC B6 today's word: the word spelled in purple tiles ([showTiles]) on a
 * soft green card with a green top bar, a green part-of-speech chip and the
 * definition (ports iOS DefinitionCard). Always populates once loaded — "No
 * definition available for this word." rather than a blank gap.
 */
@Composable
internal fun DefinitionCard(word: String, showTiles: Boolean = false) {
    var loaded by remember(word) { mutableStateOf(false) }
    val def by produceState<com.wordocious.app.data.DefinitionService.WordDefinition?>(initialValue = null, key1 = word) {
        value = com.wordocious.app.data.DefinitionService.fetch(word)
        loaded = true
    }
    if (!loaded) return
    val green = Color(0xFF22A866)
    val dark = WTheme.isDark
    com.wordocious.app.ui.TintedCard(
        accent = green,
        modifier = Modifier.widthIn(max = 440.dp).fillMaxWidth(),
        tint = if (dark) WTheme.surface else Color(0xFFECFAF2),
        line = if (dark) WTheme.border else Color(0xFFC9EFDA),
        bar = Brush.horizontalGradient(listOf(green, Color(0xFF5ED59A))),
    ) {
        Text(
            "TODAY'S WORD", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.3.sp,
            color = if (dark) Color(0xFF5ED59A) else Color(0xFF137A3D),
        )
        if (showTiles && word.isNotBlank()) {
            Row(
                Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = word },
                horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
            ) {
                val tile = if (word.length > 8) 28.dp else 34.dp
                word.forEach { ch ->
                    GameTileFace(ch.toString(), TileFace.CORRECT, Modifier.size(tile))
                }
            }
        }
        val d = def
        if (d != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (d.partOfSpeech.isNotBlank()) {
                    // The green part-of-speech chip with its little lip (0 2 0 #157a48).
                    Text(
                        d.partOfSpeech.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp,
                        color = Color.White,
                        modifier = Modifier
                            .drawWithContent {
                                drawRoundRect(Color(0xFF157A48), topLeft = androidx.compose.ui.geometry.Offset(0f, 2.dp.toPx()), cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2))
                                drawRoundRect(Brush.verticalGradient(listOf(Color(0xFF5ED59A), green)), cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2))
                                drawContent()
                            }
                            .padding(horizontal = 10.dp, vertical = 3.dp),
                    )
                }
                if (d.phonetic.isNotBlank()) Text(d.phonetic, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted)
            }
            if (d.definition.isNotBlank()) {
                Text(
                    d.definition, fontSize = 14.sp, fontWeight = FontWeight.Bold, lineHeight = 20.sp,
                    color = if (dark) WTheme.textSecondary else Color(0xFF4B3D66),
                )
            }
        } else {
            Text(
                "No definition available for this word.",
                fontSize = 13.sp, fontWeight = FontWeight.Medium, fontStyle = FontStyle.Italic, color = WTheme.textMuted,
            )
        }
    }
}
