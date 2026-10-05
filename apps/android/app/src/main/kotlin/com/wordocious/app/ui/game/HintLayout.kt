package com.wordocious.app.ui.game

// FINISH_SPEC BI22 (founder, 2026-10-03: "hitting the hint button caused one of the puzzle
// games to shrink a bit"): pressing a hint, reveal or check — or a feedback toast / hint
// message appearing — NEVER changes a board's size or moves the layout. Hint results live in
// slots that are always reserved (empty when idle) or in already-flexible areas; buttons
// never carry a count (the used count is a corner badge overlay, [hintCountText]); a label
// that does change (a countdown) reserves its widest variant. Pure (dp as Float), unit-tested.

/** BI22 the corner badge's text: "" at 0 (hidden), the count, or "99+" past 99. */
fun hintCountText(count: Int): String = when {
    count <= 0 -> ""
    count > 99 -> "99+"
    else -> count.toString()
}

/** BI22 a counted button's TalkBack description: "Hint" / "Hint (2 used)". */
fun hintCountDescription(label: String, count: Int): String = if (count > 0) "$label ($count used)" else label

object HintLayout {
    /**
     * A countdown capsule's reserve ("Reveal · 4:59" → "Reveal · 8:88"): every digit an 8,
     * so the label never jitters as proportional digits tick.
     */
    fun countdownReserve(label: String): String = label.map { if (it.isDigit()) '8' else it }.joinToString("")

    // ── ProperNoundle clue slot ──
    // Doug (Android, 10-05): the clue read as ONE line ending "His…". The slot was exactly two line
    // heights, so the Text's own font metrics overflowed it and Compose ellipsized at line one. The clue
    // is now 13 sp, three lines (four on tall screens), in a slot with a little slack; the board gives
    // up that height for good (the slot is always reserved, so revealing the clue still never moves it).

    /** Font size of the clue (sp). */
    const val CLUE_SP = 13f
    /** Line height of the clue (1.3 em), in sp. */
    const val CLUE_LINE_SP = CLUE_SP * 1.3f
    /** Space above the clue text. */
    const val CLUE_TOP_PAD = 4f
    /** Slack under the last line so font metrics never push a line out of the slot. */
    const val CLUE_SLACK = 4f
    /** Screens at least this tall (dp) get a fourth clue line. */
    const val CLUE_TALL_SCREEN_DP = 760

    /** Lines the clue wraps to before it ellipsizes (tap opens the whole clue). */
    fun clueLines(screenHeightDp: Int): Int = if (screenHeightDp >= CLUE_TALL_SCREEN_DP) 4 else 3

    /**
     * The clue slot's height (dp) for a clue line [lineDp] dp tall ([CLUE_LINE_SP] at the phone's
     * font scale). It does NOT depend on [clue]: the slot is always present (empty when idle), so
     * revealing the Clue never takes height from the board.
     */
    @Suppress("UNUSED_PARAMETER")
    fun clueSlotHeight(lineDp: Float, clue: String? = null, lines: Int = 3): Float = CLUE_TOP_PAD + lineDp * lines + CLUE_SLACK

    // ── Kindred ──

    /** Kindred's tile height clamp (dp). */
    const val KINDRED_TILE_MIN = 56f
    const val KINDRED_TILE_MAX = 92f

    /**
     * Kindred's tile height (dp) for a band [bandH] dp tall: tile = (band − rail − solved bars
     * − gaps − the named-category slot) / rows, clamped [KINDRED_TILE_MIN]–[KINDRED_TILE_MAX].
     * [chipSlotH] (the "Name a category" chips row + its gap) is ALWAYS taken, so naming a
     * category never shrinks the tiles; [revealedLabels] is accepted only so the regression
     * test can prove it is ignored.
     */
    @Suppress("UNUSED_PARAMETER")
    fun kindredTileHeight(
        bandH: Float, rows: Int, solved: Int, revealedLabels: Int,
        chipSlotH: Float, trayPad: Float, trayLip: Float,
        gap: Float = 8f, railH: Float = 24f, barH: Float = 56f, barGap: Float = 6f, rowGap: Float = 6f,
    ): Float {
        val r = rows.coerceAtLeast(1)
        val barsH = (barH + barGap) * solved
        val gapsH = 8f /* column vertical padding */ + gap /* grid → rail */ + trayPad * 2 + trayLip +
            (if (solved > 0) gap else 0f) /* rail → bars */ + rowGap * (r - 1) + chipSlotH
        return ((bandH - railH - barsH - gapsH) / r).coerceIn(KINDRED_TILE_MIN, KINDRED_TILE_MAX)
    }
}
