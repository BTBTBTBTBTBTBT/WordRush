package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.GameResultsService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.*

/**
 * The finished puzzle inside a More Games "Completed today" dropdown (founder,
 * 2026-09-29: "the completed screen drop downs on the new games only populate
 * the stat results, they need to show the completed puzzles like the other
 * games do"). Rebuilt from the recorded matches row alone — the core
 * reconstruct* functions, as the web's lib/elsewhere-progress.ts does — and
 * drawn with each game's own board composable, read-only and card-sized.
 * Crosswordocious (clue numbers) and Muddle (tray, circles, cartoon, caption)
 * also look the puzzle up in the bundled bank. [FinishedBoard] is null when a
 * board can't be rebuilt; the card then shows the summary alone.
 */
internal sealed class FinishedBoard {
    class Sudoku(val s: SudokuState) : FinishedBoard()
    class Regions(val s: RegionsState) : FinishedBoard()
    class Ladder(val s: LadderState) : FinishedBoard()
    class Hub(val r: HubReconstruction) : FinishedBoard()
    class Cipher(val s: CryptogramState) : FinishedBoard()
    class Groups(val solved: List<GroupsGroup>, val unsolved: List<GroupsGroup>) : FinishedBoard()
    class Crossword(val s: CrosswordState) : FinishedBoard()
    class Muddle(val s: ScrambleState, val puzzle: ScramblePuzzle, val byHint: Set<Int>) : FinishedBoard()
    class Spyglass(val s: WordsearchState, val title: String) : FinishedBoard()
}

internal fun finishedBoard(mode: GameMode, seed: String, row: GameResultsService.RecordedDailyMatch, won: Boolean): FinishedBoard? = runCatching {
    val sol = row.solutions?.takeIf { it.isNotEmpty() } ?: return null
    val g = row.player1Guesses
    when (mode) {
        GameMode.SUDOKU -> reconstructSudoku(sol, g)?.let { r ->
            val wrong = String(CharArray(81) { i -> if (r.board[i] != '0' && r.board[i] != r.solution[i]) '1' else '0' })
            FinishedBoard.Sudoku(SudokuState(
                seed, SUDOKU_DAILY_DIFFICULTY, r.givens, r.solution, r.board, List(81) { 0 }, r.hintMask, wrong, 0, 0, false, true,
                if (won) SudokuStatus.WON else SudokuStatus.LOST, emptyList(), 0, 0,
            ))
        }
        GameMode.REGIONS -> reconstructRegions(sol, g)?.let { r ->
            val n = r.n
            val wrong = String(CharArray(n * n) { i -> if (r.board[i] == '*' && r.solution[i / n] - '0' != i % n) '1' else '0' })
            FinishedBoard.Regions(RegionsState(
                seed, n, r.regions, r.solution, r.board.replace('o', '.'), r.hintMask, wrong, 0, 0, true,
                if (won) RegionsStatus.WON else RegionsStatus.LOST, emptyList(), 0, 0, "0".repeat(n * n),
            ))
        }
        GameMode.LADDER -> reconstructLadder(sol, g)?.let { r ->
            FinishedBoard.Ladder(LadderState(
                seed, "", r.start, r.end, r.par, r.path, r.words, r.hintMask, r.moves, r.hintsUsed, g,
                if (won) LadderStatus.WON else LadderStatus.LOST, null, 0, 0,
            ))
        }
        GameMode.HUB -> reconstructHub(sol, g)?.let { FinishedBoard.Hub(it) }
        GameMode.CRYPTOGRAM -> reconstructCryptogram(sol, g)?.let { r ->
            // Locked = every code letter the finish left right (given, hinted or solved), so a
            // lost saying shows its misses unfilled-looking and its hits in the accent.
            val locked = cryptogramCodeLetters(r.cipher).filter { r.mapping[it] == cryptogramPlainFor(it, r.key) }.sorted()
            FinishedBoard.Cipher(CryptogramState(
                seed, r.id, r.text, r.key, r.cipher, r.given, r.mapping, locked, r.hinted, 0, r.checks, emptyList(), g,
                if (won) CryptogramStatus.WON else CryptogramStatus.LOST, true, 0, 0,
            ))
        }
        GameMode.GROUPS -> reconstructGroups(sol, g)?.let { r ->
            FinishedBoard.Groups(r.solvedTiers.mapNotNull { t -> r.groups.firstOrNull { it.tier == t } }, r.groups.filter { it.tier !in r.solvedTiers })
        }
        GameMode.CROSSWORD -> reconstructCrossword(sol, g)?.let { r ->
            // Clue numbers come from the bank puzzle (matched by id, then today's); without it the grid still draws, unnumbered.
            val bank = CrosswordBank.bundled
            val p = bank?.let { b -> (b.daily + b.extra + b.holiday.orEmpty().values.flatten()).firstOrNull { it.id == r.id } ?: crosswordPuzzleForDay(b, com.wordocious.app.todayLocalDate(), HolidayTable.bundled) }
                ?.takeIf { crosswordSolution(it) == r.solution }
            val locked = String(CharArray(r.solution.length) { i ->
                if (r.solution[i] == CROSSWORD_BLOCK) '.' else if (r.fill[i] != CROSSWORD_EMPTY && r.fill[i] == r.solution[i]) '1' else '0'
            })
            FinishedBoard.Crossword(CrosswordState(
                seed, r.id, r.title, r.w, r.h, p?.entries ?: emptyList(), r.solution, r.fill, locked, r.revealed, r.checks, r.hintsUsed, emptyList(), g,
                if (won) CrosswordStatus.WON else CrosswordStatus.LOST, true, 0, 0,
            ))
        }
        GameMode.SCRAMBLE -> reconstructScramble(sol, g)?.let { r ->
            // The row carries answers only: the tray, circles, caption and cartoon live in the bank entry.
            val bank = ScrambleBank.bundled ?: return null
            fun matches(p: ScramblePuzzle) = p.words.size == r.words.size && p.words.indices.all { p.words[it].answer.uppercase() == r.words[it] } && p.final.answer.uppercase() == r.final
            val p = scramblePuzzleForDay(bank, com.wordocious.app.todayLocalDate(), HolidayTable.bundled)?.takeIf(::matches)
                ?: (bank.daily + bank.extra + bank.holiday.orEmpty().values.flatten()).firstOrNull(::matches) ?: return null
            val base = createScrambleState(p, seed, 0)
            val targets = (0..SCRAMBLE_FINAL).map { scrambleTarget(base, it) }
            FinishedBoard.Muddle(base.copy(
                entries = targets.mapIndexed { i, t -> if (r.solved[i]) t else "" }, solved = r.solved,
                revealed = targets.mapIndexed { i, t -> if (r.solved[i]) t else base.revealed[i] },
                checks = r.checks, mistakes = r.mistakes, events = g, status = if (won) ScrambleStatus.WON else ScrambleStatus.LOST, ended = true,
            ), p, r.solvedByHint.toSet())
        }
        GameMode.WORDSEARCH -> reconstructWordsearch(sol, g)?.let { r ->
            FinishedBoard.Spyglass(WordsearchState(
                seed, "", r.title, WORDSEARCH_N, r.grid, r.words, r.found, r.misses, r.hintsUsed, emptyList(), g,
                if (won) WordsearchStatus.WON else WordsearchStatus.LOST, 0, 0, r.wordsShown, r.lateFinds,
            ), r.title)
        }
        else -> null
    }
}.getOrNull()

/** The board itself, centered and card-width, never interactive (every tap handler is a no-op). */
@Composable
internal fun FinishedBoardView(b: FinishedBoard) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (b) {
            is FinishedBoard.Sudoku -> Box(Modifier.widthIn(max = 260.dp)) { SudokuBoard(b.s, null, revealSolution = b.s.status == SudokuStatus.LOST, digitSize = 16.dp) {} }
            is FinishedBoard.Regions -> Box(Modifier.widthIn(max = 260.dp)) { RegionsBoard(b.s, null, revealSolution = b.s.status == RegionsStatus.LOST) {} }
            is FinishedBoard.Ladder -> LadderBoard(b.s, "", false, revealPath = b.s.status == LadderStatus.LOST, tile = 30.dp)
            is FinishedBoard.Hub -> HubFinishedBoard(b.r)
            is FinishedBoard.Cipher -> {
                CipherBoard(b.s, selected = null, finished = true, maxCell = 24.dp) {}
                BoardCaption("“${b.s.text}”")
            }
            is FinishedBoard.Groups -> Column(Modifier.widthIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                b.solved.forEach { GroupBar(it) }
                b.unsolved.forEach { GroupBar(it, revealed = true) }
            }
            is FinishedBoard.Crossword -> {
                if (b.s.title.isNotBlank()) BoardCaption(b.s.title)
                Box(Modifier.widthIn(max = 280.dp)) { CrosswordGrid(b.s, null, emptySet(), 0, maxCell = 28.dp) {} }
            }
            is FinishedBoard.Muddle -> MuddleFinishedBoard(b.s, b.puzzle, b.byHint)
            is FinishedBoard.Spyglass -> {
                if (b.title.isNotBlank()) BoardCaption(b.title)
                Box(Modifier.widthIn(max = 260.dp)) { SpyglassGrid(b.s, finished = true, revealMissing = b.s.status == WordsearchStatus.LOST, letterSize = 14.dp) { _, _ -> } }
            }
        }
    }
}

@Composable
private fun BoardCaption(text: String) {
    Text(text, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 4.dp))
}

/** Remembered per row: the replay runs once per fetched row, not per recomposition. */
@Composable
internal fun rememberFinishedBoard(mode: GameMode, seed: String, row: GameResultsService.RecordedDailyMatch?, won: Boolean): FinishedBoard? =
    remember(mode, seed, row, won) { row?.let { finishedBoard(mode, seed, it, won) } }
