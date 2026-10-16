package com.wordocious.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Share cards: spoiler-free models for the puzzle games (share-cards-1016/SPEC.md "Spoilers").
 * 1:1 port of packages/core/src/share-spoilers.ts; pinned by
 * share-spoilers-fixtures.json (ShareSpoilersFixtureTest).
 *
 * Every puzzle game offers the chooser (`No spoilers` / `Full results`). These pure functions turn a FINISHED game
 * into a small, serializable model that the renderer just draws. The `clean` variant never carries the answer: no
 * digits, letters, words, stars or quote text; only shapes, masks, colors and counts. The `full` variant adds the
 * answer fields; in `clean` those same fields are null, so a renderer branches on null, never on the variant.
 *
 * Field order in every model matches the TypeScript object literal (the fixtures are compared byte for byte, with
 * `encodeDefaults = true` so the `kind` tag is written).
 */

enum class ShareVariant(val id: String) { CLEAN("clean"), FULL("full");
    companion object { fun from(id: String?): ShareVariant? = values().firstOrNull { it.id == id } }
}

@Serializable
data class ShareVariantSide(val title: String, val subtitle: String)
@Serializable
data class ShareVariantCopy(val clean: ShareVariantSide, val full: ShareVariantSide)

object ShareSpoilers {
    /** Chooser subtitles per catalog mode id; anything else (the word games) keeps the colors / letters rule. */
    val SUBTITLES: Map<String, Pair<String, String>> = mapOf(
        "regions" to ("Regions only" to "Stars revealed"),
        "sudoku" to ("Givens only" to "Digits revealed"),
        "crossword" to ("Grid only" to "Letters revealed"),
        "groups" to ("Colors only" to "Words revealed"),
        "wordsearch" to ("Paths only" to "Letters revealed"),
        "hub" to ("Rank only" to "Words revealed"),
        "scramble" to ("Stats only" to "Answer revealed"),
        "ladder" to ("Rungs only" to "Words revealed"),
        "cryptogram" to ("Shape only" to "Quote revealed"),
    )

    val DEFAULT_SUBTITLES: Pair<String, String> = "Colors only" to "Letters revealed"

    fun variantCopy(mode: String): ShareVariantCopy {
        val (clean, full) = SUBTITLES[mode] ?: DEFAULT_SUBTITLES
        return ShareVariantCopy(ShareVariantSide("No spoilers", clean), ShareVariantSide("Full results", full))
    }

    internal fun <T> only(variant: ShareVariant, value: T): T? = if (variant == ShareVariant.FULL) value else null

    /** Letter count per word of the quote, in reading order (punctuation dropped, zero-letter tokens skipped). */
    fun codebreakerShape(text: String): List<Int> =
        text.split(Regex("\\s+")).map { tok -> tok.count { it in 'A'..'Z' || it in 'a'..'z' } }.filter { it > 0 }
}

// ── Starsweep (regions) ───────────────────────────────────────────────────

@Serializable
data class StarsweepShareModel(
    val kind: String = "starsweep",
    val n: Int,
    /** One digit per cell (row-major): the region index. */
    val regions: String,
    /** Palette slot per region index (regionColorSlots). */
    val slots: List<Int>,
    val solved: Boolean,
    /** Cells holding a committed star; full only. */
    val stars: List<Int>?,
    /** Cells crossed out; full only. */
    val crosses: List<Int>?,
)

data class StarsweepShareInput(val n: Int, val regions: String, val solution: String, val board: String)

fun starsweepShareModel(g: StarsweepShareInput, variant: ShareVariant): StarsweepShareModel {
    val stars = ArrayList<Int>(); val crosses = ArrayList<Int>()
    for (i in g.board.indices) { if (g.board[i] == '*') stars.add(i) else if (g.board[i] == 'x') crosses.add(i) }
    var solved = true
    for (r in 0 until g.n) {
        val col = if (r < g.solution.length) g.solution[r].code - 48 else Int.MIN_VALUE
        val idx = r * g.n + col
        if (idx < 0 || idx >= g.board.length || g.board[idx] != '*') solved = false
    }
    return StarsweepShareModel(n = g.n, regions = g.regions, slots = regionColorSlots(g.n, g.regions), solved = solved,
        stars = ShareSpoilers.only(variant, stars), crosses = ShareSpoilers.only(variant, crosses))
}

// ── Sudocious (sudoku) ────────────────────────────────────────────────────

@Serializable
data class SudociousShareModel(
    val kind: String = "sudocious",
    /** 81 chars, '0' empty: the given digits (the puzzle, shown in both variants). */
    val givens: String,
    /** 81 chars: 'g' given, 'f' filled right, 'w' filled wrong, '.' empty. */
    val cells: String,
    val solved: Boolean,
    /** 81 chars, the player's board; full only. */
    val board: String?,
)

data class SudociousShareInput(val givens: String, val solution: String, val board: String)

fun sudociousShareModel(g: SudociousShareInput, variant: ShareVariant): SudociousShareModel {
    val cells = StringBuilder(81)
    for (i in 0 until 81) {
        val given = g.givens.getOrNull(i) ?: '0'
        val b = g.board.getOrNull(i) ?: '0'
        cells.append(
            when {
                given != '0' -> 'g'
                b == '0' -> '.'
                i < g.solution.length && b == g.solution[i] -> 'f'
                else -> 'w'
            },
        )
    }
    return SudociousShareModel(givens = g.givens, cells = cells.toString(), solved = g.board == g.solution, board = ShareSpoilers.only(variant, g.board))
}

// ── Crosswordocious (crossword) ───────────────────────────────────────────

@Serializable
data class CrosswordShareModel(
    val kind: String = "crossword",
    val w: Int,
    val h: Int,
    /** w*h chars: '.' block, '#' filled right, 'x' filled wrong, '_' empty. */
    val cells: String,
    val solved: Boolean,
    /** w*h chars, the player's fill ('.' block, '_' empty); full only. */
    val letters: String?,
)

data class CrosswordShareInput(val w: Int, val h: Int, val solution: String, val fill: String)

fun crosswordShareModel(g: CrosswordShareInput, variant: ShareVariant): CrosswordShareModel {
    val cells = StringBuilder(g.solution.length)
    var solved = true
    for (i in g.solution.indices) {
        val s = g.solution[i]
        val f = g.fill.getOrNull(i) ?: '_'
        when {
            s == '.' -> cells.append('.')
            f == '_' || f == '.' -> { cells.append('_'); solved = false }
            f == s -> cells.append('#')
            else -> { cells.append('x'); solved = false }
        }
    }
    return CrosswordShareModel(w = g.w, h = g.h, cells = cells.toString(), solved = solved, letters = ShareSpoilers.only(variant, g.fill))
}

// ── Kindred (groups) ──────────────────────────────────────────────────────

@Serializable
data class KindredShareRow(
    val tier: Int,
    val solved: Boolean,
    /** The group's label; full only. */
    val label: String?,
    /** The four words; full only. */
    val words: List<String>?,
)

@Serializable
data class KindredShareModel(
    val kind: String = "kindred",
    /** Solved groups in the order solved, then the unsolved ones by tier. */
    val rows: List<KindredShareRow>,
    val mistakes: Int,
    val solved: Boolean,
)

data class KindredShareInput(val groups: List<GroupsGroup>, val solvedTiers: List<Int>, val mistakes: Int)

fun kindredShareModel(g: KindredShareInput, variant: ShareVariant): KindredShareModel {
    val order = g.solvedTiers + g.groups.map { it.tier }.filter { it !in g.solvedTiers }.sorted()
    val rows = ArrayList<KindredShareRow>()
    for (tier in order) {
        val grp = g.groups.firstOrNull { it.tier == tier } ?: continue
        rows.add(KindredShareRow(tier = tier, solved = tier in g.solvedTiers,
            label = ShareSpoilers.only(variant, grp.label), words = ShareSpoilers.only(variant, grp.words.toList())))
    }
    return KindredShareModel(rows = rows, mistakes = g.mistakes, solved = rows.isNotEmpty() && rows.all { it.solved })
}

// ── Spyglass (wordsearch) ─────────────────────────────────────────────────

@Serializable
data class SpyglassSharePath(
    /** Grid cells the stroke runs through, first letter first. */
    val cells: List<Int>,
    /** The word on the stroke; full only. */
    val word: String?,
)

@Serializable
data class SpyglassShareModel(
    val kind: String = "spyglass",
    val n: Int,
    /** One stroke per found word, in the order found. */
    val paths: List<SpyglassSharePath>,
    val found: Int,
    val total: Int,
    val solved: Boolean,
    /** n*n letters; full only. */
    val letters: String?,
)

data class SpyglassShareInput(val grid: String, val words: List<WordsearchPlacement>, val found: List<String>)

fun spyglassShareModel(g: SpyglassShareInput, variant: ShareVariant): SpyglassShareModel {
    val n = Math.round(Math.sqrt(g.grid.length.toDouble())).toInt()
    val paths = ArrayList<SpyglassSharePath>()
    for (w in g.found) {
        val p = g.words.firstOrNull { it.w == w } ?: continue
        paths.add(SpyglassSharePath(cells = wordsearchCells(n, p), word = ShareSpoilers.only(variant, p.w)))
    }
    return SpyglassShareModel(n = n, paths = paths, found = paths.size, total = g.words.size,
        solved = g.words.isNotEmpty() && paths.size == g.words.size, letters = ShareSpoilers.only(variant, g.grid))
}

// ── Hubbub (hub) ──────────────────────────────────────────────────────────

@Serializable
data class HubbubShareModel(
    val kind: String = "hubbub",
    /** The seven letters, center first (the puzzle, shown in both variants). */
    val letters: String,
    val rank: Int,
    val rankName: String,
    val points: Int,
    val max: Int,
    val found: Int,
    val total: Int,
    val pangrams: Int,
    val pangramTotal: Int,
    /** The found scoring words in the order found; full only. */
    val words: List<String>?,
)

data class HubbubShareInput(val letters: String, val found: List<String>, val points: Int, val max: Int, val wordCount: Int, val pangramCount: Int)

fun hubbubShareModel(g: HubbubShareInput, variant: ShareVariant): HubbubShareModel {
    val rank = hubRankIndex(g.points, g.max)
    return HubbubShareModel(
        letters = g.letters, rank = rank, rankName = HUB_RANKS[rank].first, points = g.points, max = g.max,
        found = g.found.size, total = g.wordCount, pangrams = g.found.count { hubIsPangram(it, g.letters) }, pangramTotal = g.pangramCount,
        words = ShareSpoilers.only(variant, g.found.toList()),
    )
}

// ── Muddle (scramble) ─────────────────────────────────────────────────────

@Serializable
data class MuddleShareModel(
    val kind: String = "muddle",
    /** Letter counts of the four words and the punchline (spaces dropped), for blank tiles. */
    val lengths: List<Int>,
    /** Which of the five rows were solved. */
    val solved: List<Boolean>,
    val boardsSolved: Int,
    val checks: Int,
    val mistakes: Int,
    val hintsUsed: Int,
    val won: Boolean,
    /** The four words and the punchline; full only. */
    val answers: List<String>?,
    /** The cartoon's caption; full only (null when the game has none). */
    val caption: String?,
)

data class MuddleShareInput(val words: List<String>, val final: String, val solved: List<Boolean>, val checks: Int, val mistakes: Int, val hintsUsed: Int)

fun muddleShareModel(g: MuddleShareInput, variant: ShareVariant, caption: String? = null): MuddleShareModel {
    val answers = g.words + g.final
    val solved = List(5) { i -> g.solved.getOrNull(i) == true }
    return MuddleShareModel(
        lengths = answers.map { a -> a.count { it in 'A'..'Z' } }, solved = solved, boardsSolved = solved.count { it },
        checks = g.checks, mistakes = g.mistakes, hintsUsed = g.hintsUsed, won = solved[4],
        answers = ShareSpoilers.only(variant, answers), caption = if (variant == ShareVariant.FULL && !caption.isNullOrEmpty()) caption else null,
    )
}

// ── Letter Ladder (ladder) ────────────────────────────────────────────────

@Serializable
enum class LadderRungColor(val id: String) {
    @SerialName("start") START("start"),
    @SerialName("step") STEP("step"),
    @SerialName("hint") HINT("hint"),
    @SerialName("end") END("end"),
}

@Serializable
data class LadderShareRung(
    val color: LadderRungColor,
    /** The rung's word; full only. */
    val word: String?,
)

@Serializable
data class LadderShareModel(
    val kind: String = "ladder",
    val rungs: List<LadderShareRung>,
    val rungCount: Int,
    val par: Int,
    val moves: Int,
    val solved: Boolean,
)

data class LadderShareInput(val start: String, val end: String, val words: List<String>, val hintMask: String, val par: Int, val moves: Int)

fun ladderShareModel(g: LadderShareInput, variant: ShareVariant): LadderShareModel {
    val last = g.words.size - 1
    val solved = last >= 0 && g.words[last] == g.end
    val rungs = g.words.mapIndexed { i, w ->
        val color = when {
            i == 0 -> LadderRungColor.START
            solved && i == last -> LadderRungColor.END
            g.hintMask.getOrNull(i) == '1' -> LadderRungColor.HINT
            else -> LadderRungColor.STEP
        }
        LadderShareRung(color = color, word = ShareSpoilers.only(variant, w))
    }
    return LadderShareModel(rungs = rungs, rungCount = rungs.size, par = g.par, moves = g.moves, solved = solved)
}

// ── Codebreaker (cryptogram) ──────────────────────────────────────────────

@Serializable
data class CodebreakerShareModel(
    val kind: String = "codebreaker",
    /** Letter count per word of the quote, in reading order (punctuation dropped, zero-letter tokens skipped). */
    val shape: List<Int>,
    val correct: Int,
    val total: Int,
    val checks: Int,
    val solved: Boolean,
    /** The quote as displayed; full only. */
    val text: String?,
)

data class CodebreakerShareInput(val text: String, val correct: Int, val total: Int, val checks: Int, val solved: Boolean)

fun codebreakerShareModel(g: CodebreakerShareInput, variant: ShareVariant): CodebreakerShareModel =
    CodebreakerShareModel(shape = ShareSpoilers.codebreakerShape(g.text), correct = g.correct, total = g.total, checks = g.checks,
        solved = g.solved, text = ShareSpoilers.only(variant, g.text))
