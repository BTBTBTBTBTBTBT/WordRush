package com.wordocious.app.ui.game

import com.wordocious.app.ui.MascotId

// FINISH_SPEC AF: the in-game "?" help popup's quick steps. Each game gets 3–4 short
// steps, shortened from its how-to-play copy (assets/guides.generated.json, the same
// lib/guide-content.ts source the full guide renders), and each step carries a tiny
// example row of real glossy tiles that animates (a guess flipping purple / gold /
// gray, letters typing in, a solved row popping). Pure (no Android): GuideStepsTest.

/** How a step's example row moves. Reduce Motion: every row shows its final state. */
enum class DemoMotion {
    /** Tiles type in left → right (each pops from an empty slot). */
    TYPE,
    /** Tiles start as typed letters and flip one by one to their result. */
    FLIP,
    /** Tiles pop in left → right already in their final look. */
    POP,
}

/** One example tile: [glyph] on [face]; [before] = the glyph shown before a FLIP (null = the same). */
data class DemoTile(val glyph: String, val face: TileFace, val before: String? = null)

/** One quick step: its [text] and the example row ([tiles] may be empty: text only). */
data class GuideStep(val text: String, val tiles: List<DemoTile>, val motion: DemoMotion)

object GuideSteps {
    /** Stagger between tiles, the flip / pop length, and the hold before the row replays. */
    const val STAGGER_MS = 120
    const val TILE_MS = 300
    const val HOLD_MS = 1800
    /** Each step's row starts a little after the one above it. */
    const val STEP_OFFSET_MS = 260
    const val MAX_STEPS = 4
    const val MAX_TEXT = 90
    /**
     * Starsweep demo tokens in the rows below — never shown as text: GuideSheet draws the
     * board's star / cross art for them (FINISH_SPEC AL addendum 2).
     */
    const val STAR_TOKEN = "★"
    const val CROSS_TOKEN = "×"

    /** One full loop of a row of [n] tiles: in, hold, then it replays. */
    fun cycleMs(n: Int): Int = (n.coerceAtLeast(1) - 1) * STAGGER_MS + TILE_MS + HOLD_MS

    /** Tile [i]'s progress (0 = not started, 1 = done) at [clockMs] into the row's cycle. */
    fun tileProgress(clockMs: Float, i: Int, n: Int): Float {
        val cycle = cycleMs(n).toFloat()
        val t = ((clockMs % cycle) + cycle) % cycle
        return ((t - i * STAGGER_MS) / TILE_MS).coerceIn(0f, 1f)
    }

    /**
     * A row from [letters] (one tile per character; a word in a [words] row) and [codes]
     * (one per tile): c = right spot, p = wrong spot, a = not in it, t = typed,
     * e = empty, h = pencil / hint ghost, g = given, x = a mistake, b = not a word.
     */
    fun row(letters: String, codes: String, words: List<String>? = null): List<DemoTile> {
        val glyphs = words ?: letters.map { if (it == '_') "" else it.toString() }
        return glyphs.mapIndexed { i, g -> DemoTile(g, face(codes.getOrElse(i) { 't' })) }
    }

    fun face(code: Char): TileFace = when (code) {
        'c' -> TileFace.CORRECT
        'p' -> TileFace.PRESENT
        'a' -> TileFace.ABSENT
        'e' -> TileFace.EMPTY
        'h' -> TileFace.HINT
        'g' -> TileFace.GIVEN
        'x' -> TileFace.CONFLICT
        'b' -> TileFace.BAD
        else -> TileFace.TYPED
    }

    private fun step(text: String, motion: DemoMotion, letters: String, codes: String) =
        GuideStep(text, row(letters, codes), motion)

    private fun words(text: String, motion: DemoMotion, words: List<String>, codes: String) =
        GuideStep(text, row("", codes, words), motion)

    /** The colors legend, colorblind-safe (it names what each look means, never a color). */
    private val legend = step("Every tile tells you: right spot, wrong spot, or not in the word.", DemoMotion.POP, "WOR", "cpa")

    private fun flipGuess(word: String, codes: String) =
        step("Type a real word and press enter. The tiles flip to show how close you are.", DemoMotion.FLIP, word, codes)

    private val table: Map<String, List<GuideStep>> = mapOf(
        "classic" to listOf(
            step("Find the hidden 5-letter word in six tries.", DemoMotion.TYPE, "CRANE", "ttttt"),
            flipGuess("CRANE", "apcaa"),
            legend,
            step("Use the clues and guess again until the whole row lights up.", DemoMotion.FLIP, "PLANT", "ccccc"),
        ),
        "six" to listOf(
            step("Find the hidden 6-letter word in seven tries.", DemoMotion.TYPE, "PLANET", "tttttt"),
            flipGuess("PLANET", "acpaac"),
            legend,
            step("Stuck? Reveal a vowel or a consonant, 75 points each.", DemoMotion.POP, "__A___", "eeceee"),
        ),
        "seven" to listOf(
            step("Find the hidden 7-letter word in eight tries.", DemoMotion.TYPE, "STORAGE", "ttttttt"),
            flipGuess("STORAGE", "acaapac"),
            legend,
            step("Stuck? Reveal a vowel or a consonant, 75 points each.", DemoMotion.POP, "____E__", "eeeecee"),
        ),
        "quadword" to listOf(
            step("Solve four hidden 5-letter words at once, with nine guesses.", DemoMotion.POP, "1234", "tttt"),
            step("Each guess is tried on all four boards, and each colors its own tiles.", DemoMotion.FLIP, "CRANE", "pacap"),
            legend,
            step("Solve a board and it locks with a check. Clear all four!", DemoMotion.FLIP, "BLOOM", "ccccc"),
        ),
        "octoword" to listOf(
            step("Solve eight hidden 5-letter words at once, with thirteen guesses.", DemoMotion.POP, "12345678", "tttttttt"),
            step("Each guess is tried on all eight boards, and each colors its own tiles.", DemoMotion.FLIP, "SLATE", "apcaa"),
            legend,
            step("Early guesses matter most: test lots of common letters.", DemoMotion.FLIP, "ROUND", "pacap"),
        ),
        "succession" to listOf(
            step("Solve four 5-letter words one at a time, with ten guesses in all.", DemoMotion.POP, "1234", "cttt"),
            flipGuess("TRAIN", "apcaa"),
            legend,
            step("Each new board starts with your earlier guesses already filled in.", DemoMotion.POP, "TRAIN", "pacap"),
        ),
        "deliverance" to listOf(
            step("Four boards, each opening with three guesses already played.", DemoMotion.POP, "HOUSE", "apaac"),
            step("Read those free clues, then finish all four in six guesses.", DemoMotion.FLIP, "SHORE", "pcaac"),
            legend,
            step("Each guess you type is tried on all four boards at once.", DemoMotion.FLIP, "CHOSE", "ccccc"),
        ),
        "gauntlet" to listOf(
            step("Five stages, 21 words, one continuous run.", DemoMotion.POP, "12345", "ctttt"),
            step("Each stage adds boards, up to eight at once in the finale.", DemoMotion.FLIP, "STAGE", "pacap"),
            legend,
            step("Solve every word to advance. Run out of guesses and the run ends.", DemoMotion.FLIP, "CLIMB", "ccccc"),
        ),
        "propernoundle" to listOf(
            step("The answer is a famous name: a person, place, brand or title.", DemoMotion.TYPE, "PARIS", "ttttt"),
            step("A label up top says which kind. Any letters of the right length are allowed.", DemoMotion.FLIP, "PARIS", "capaa"),
            legend,
            step("Stuck? Three hints (a clue, a vowel, a consonant), 60 points each.", DemoMotion.POP, "_A___", "eceee"),
        ),
        "sudocious" to listOf(
            step("Fill every row, column and 3 × 3 box with 1 to 9, once each.", DemoMotion.POP, "5_7_19_8_", "gegeggege"),
            step("Tap an empty cell, then tap a number on the pad.", DemoMotion.TYPE, "534", "gtg"),
            step("A right digit locks in. A wrong one is a mistake; three end the game.", DemoMotion.FLIP, "26", "cx"),
            step("Notes pencil in candidates. They are never judged.", DemoMotion.POP, "124", "hhh"),
        ),
        "starsweep" to listOf(
            step("Place one star in every row, every column and every color region.", DemoMotion.POP, "__★__", "eecee"),
            step("Stars never touch, not even at a corner.", DemoMotion.POP, "×★×", "aca"),
            step("Tap a cell to set a black star (a free note). Double-tap to play it.", DemoMotion.TYPE, "★", "t"),
            step("A right star locks in. A wrong one is a mistake; three end the game.", DemoMotion.FLIP, "★★", "cx"),
        ),
        "letter-ladder" to listOf(
            step("Climb from the start word to the goal word.", DemoMotion.POP, "STONE", "ggggg"),
            step("Each rung changes exactly one letter: STONE to STORE.", DemoMotion.FLIP, "STORE", "ggcgg"),
            step("Words that are not in the list, or change too much, are turned away for free.", DemoMotion.TYPE, "SHARP", "bbbbb"),
            step("Undo is free. Hint places the next rung and counts as a move.", DemoMotion.POP, "STARE", "ccccc"),
        ),
        "spyglass" to listOf(
            step("Find the ten hidden words that fit the theme.", DemoMotion.POP, "QSPOONX", "ggggggg"),
            step("Tap a word's first letter, then its last, or drag across it.", DemoMotion.TYPE, "SPOON", "ttttt"),
            step("Words run across, down or diagonally. Found words light up.", DemoMotion.FLIP, "SPOON", "ccccc"),
            step("Show words lists what's left (never where), but each find then counts as a miss.", DemoMotion.POP, "WHISK", "hhhhh"),
        ),
        "hubbub" to listOf(
            step("Make words of four or more letters from the seven.", DemoMotion.POP, "RACKETS", "gggcggg"),
            step("Every word must use the center letter. Repeat letters freely.", DemoMotion.TYPE, "TRACK", "tttct"),
            step("Longer words score more, and a word using all seven earns a bonus.", DemoMotion.FLIP, "RACKETS", "ccccccc"),
            step("Reach Hubbub to solve it, then keep hunting to climb higher.", DemoMotion.POP, "STACK", "ccccc"),
        ),
        "codebreaker" to listOf(
            step("Every letter of the saying is swapped for another letter.", DemoMotion.POP, "KXZQ", "gggg"),
            GuideStep(
                "If K stands for E, every K in the code is an E.",
                listOf(DemoTile("E", TileFace.TYPED, before = "K"), DemoTile("E", TileFace.TYPED, before = "K"), DemoTile("E", TileFace.TYPED, before = "K")),
                DemoMotion.FLIP,
            ),
            step("Type a letter and it fills every box with that code letter.", DemoMotion.TYPE, "EEE", "ttt"),
            step("Only Check counts: right letters lock, wrong ones clear.", DemoMotion.FLIP, "TEA", "ccx"),
        ),
        "kindred" to listOf(
            words("Sixteen words hide four groups of four that share something.", DemoMotion.POP, listOf("LIME", "KIWI", "FIG", "PLUM"), "tttt"),
            words("Tap four words and press Submit.", DemoMotion.TYPE, listOf("LIME", "KIWI", "FIG", "PLUM"), "tttt"),
            words("A right group locks together. A wrong one spends a mistake.", DemoMotion.FLIP, listOf("LIME", "KIWI", "FIG", "PLUM"), "cccc"),
            words("\"One away…\" means three of your four belong together.", DemoMotion.FLIP, listOf("LIME", "KIWI", "FIG", "MINT"), "ccca"),
        ),
        "crosswordocious" to listOf(
            step("Every clue is a saying with one word blanked out: \"Calm before the ____\".", DemoMotion.POP, "_____", "eeeee"),
            step("Tap a cell or a clue and type the missing word.", DemoMotion.TYPE, "STORM", "ttttt"),
            step("Only Check counts: right letters lock, wrong ones clear.", DemoMotion.FLIP, "STORK", "ccccx"),
            step("Reveal fills a letter or a word for you.", DemoMotion.POP, "STORM", "ccccc"),
        ),
        "muddle" to listOf(
            step("Unscramble the four words under the cartoon.", DemoMotion.POP, "LOHEW", "ggggg"),
            step("Tap the scrambled letters (or type) to fill the boxes.", DemoMotion.TYPE, "WHOLE", "ttttt"),
            step("Right words lock, and their ringed letters spell the punchline.", DemoMotion.FLIP, "WHOLE", "ccccc"),
            step("Every check counts. Five checks is the perfect run.", DemoMotion.POP, "12345", "ccccc"),
        ),
    )

    /** Every slug with hand-shortened steps. */
    val slugs: Set<String> get() = table.keys

    /**
     * The quick steps for guide [slug]; a game without a table entry falls back to the
     * first sentence of each how-to-play paragraph in [rules] (text only, at most four).
     */
    fun stepsFor(slug: String, rules: List<String> = emptyList()): List<GuideStep> =
        table[slug] ?: rules.asSequence()
            .map { firstSentence(it) }
            .filter { it.isNotBlank() }
            .take(MAX_STEPS)
            .map { GuideStep(it, emptyList(), DemoMotion.POP) }
            .toList()

    /** A paragraph's first sentence, clipped to [MAX_TEXT] characters on a word boundary. */
    fun firstSentence(p: String): String {
        val t = p.trim()
        val end = Regex("[.!?](\\s|$)").find(t)?.range?.first?.plus(1) ?: t.length
        val s = t.substring(0, end).trim()
        if (s.length <= MAX_TEXT) return s
        val cut = s.substring(0, MAX_TEXT - 1).substringBeforeLast(' ')
        return "$cut…"
    }

    /** The host's pose at the top of the popup: a helpful, explaining pose per character. */
    fun hostPose(id: MascotId): String = when (id) {
        MascotId.W -> "point"
        MascotId.O1 -> "cheer"
        MascotId.R -> "wake"
        MascotId.D -> "notes"
        MascotId.O2 -> "lean"
        MascotId.C -> "map"
        MascotId.I -> "reach"
        MascotId.O3 -> "laugh"
        MascotId.U -> "tea"
        MascotId.S -> "stopwatch"
    }
}
