package com.wordocious.app.ui.game

// FINISH_SPEC B5: ONE board-sizing rule for every game. The board fills the space
// between the title / status line and the keyboard: as wide as the screen allows (a
// small side margin) and centered in the height that is left. Multi-board games size
// their whole grid the same way. Pure (dp as Float, no Android) so every phone shape is
// unit-tested; the mockup's rule is `min(width × .96, height × .98 × cols / rows)`
// (docs/design/brand/mockups/game-kit.html `fit`).

object BoardSizing {
    /** The small side margin: the board spans at most 96% of the width it is given. */
    const val WIDTH_FRACTION = 0.96f
    /** A sliver of breathing room above and below. */
    const val HEIGHT_FRACTION = 0.98f
    /** Never wider than this (tablets / landscape), in dp. */
    const val MAX_WIDTH = 560f

    /** A board's size (dp) and the cell (tile) size inside it. [cellW] == [cellH] for square cells. */
    data class Fit(val width: Float, val height: Float, val cellW: Float, val cellH: Float)

    /**
     * A single board of [cols] × [rows] SQUARE tiles with [gap] dp between them (plus
     * [extraWidth] dp of fixed width, e.g. ProperNoundle's wider word gaps), as big as
     * fits [availW] × [availH]: the width side is capped at [WIDTH_FRACTION] of the
     * width (and [maxWidth]); the height at [HEIGHT_FRACTION]. The tighter side wins.
     */
    fun fitSquare(
        availW: Float,
        availH: Float,
        cols: Int,
        rows: Int,
        gap: Float,
        extraWidth: Float = 0f,
        maxWidth: Float = MAX_WIDTH,
    ): Fit {
        // A board mid-load can have no solution yet: never divide by zero.
        val cols = cols.coerceAtLeast(1)
        val rows = rows.coerceAtLeast(1)
        val maxW = (minOf(availW * WIDTH_FRACTION, maxWidth) - extraWidth).coerceAtLeast(0f)
        val maxH = (availH * HEIGHT_FRACTION).coerceAtLeast(0f)
        val fromW = (maxW - gap * (cols - 1)) / cols
        val fromH = (maxH - gap * (rows - 1)) / rows
        val cell = minOf(fromW, fromH).coerceAtLeast(0f)
        return Fit(
            width = cell * cols + gap * (cols - 1) + extraWidth,
            height = cell * rows + gap * (rows - 1),
            cellW = cell,
            cellH = cell,
        )
    }

    /**
     * A multi-board grid ([boardCols] × [boardRows] boards, each [tileCols] × [tileRows]
     * tiles with [tileGap] between, plus [boardChrome] dp of padding / border / gutter per
     * board on each axis): the grid takes the full width ([WIDTH_FRACTION], capped at
     * [maxWidth]); its height is what square tiles would need, centered in the space —
     * but never taller than [HEIGHT_FRACTION] of [availH]. On a short space the tiles go
     * a little wide rather than the grid shrinking (minimal empty space on every phone).
     */
    fun fitGrid(
        availW: Float,
        availH: Float,
        boardCols: Int,
        boardRows: Int,
        tileCols: Int,
        tileRows: Int,
        tileGap: Float,
        boardChrome: Float,
        maxWidth: Float = MAX_WIDTH,
    ): Fit {
        val boardCols = boardCols.coerceAtLeast(1)
        val boardRows = boardRows.coerceAtLeast(1)
        val tileCols = tileCols.coerceAtLeast(1)
        val tileRows = tileRows.coerceAtLeast(1)
        val width = minOf(availW * WIDTH_FRACTION, maxWidth).coerceAtLeast(0f)
        val boardW = width / boardCols
        val cellW = ((boardW - boardChrome - tileGap * (tileCols - 1)) / tileCols).coerceAtLeast(0f)
        val boardHSquare = cellW * tileRows + tileGap * (tileRows - 1) + boardChrome
        val maxH = (availH * HEIGHT_FRACTION).coerceAtLeast(0f)
        val height = minOf(boardHSquare * boardRows, maxH)
        val cellH = ((height / boardRows - boardChrome - tileGap * (tileRows - 1)) / tileRows).coerceAtLeast(0f)
        return Fit(width = width, height = height, cellW = cellW, cellH = cellH)
    }

    /** BI18 Crosswordocious: the play floor and cap (dp); letters and numbers scale with the cell. */
    const val CROSSWORD_MIN_CELL = 14f
    const val CROSSWORD_MAX_CELL = 42f

    /**
     * FINISH_SPEC BI18 (founder 10-03: "the daily today required you to scroll"): in play
     * the crossword grid owns the band between the compact header and the pinned clue bar /
     * controls / keyboard, its cell sized from [availW] AND [availH] (null = width only) for
     * the puzzle's real [cols] × [rows] once [chromeX] / [chromeY] (tray padding, the
     * selection ring's room) come off. Floored to whole dp, clamped to [minCell, maxCell] —
     * the same numbers as iOS CrosswordFit and web crosswordCell.
     */
    fun crosswordCell(
        availW: Float,
        availH: Float?,
        cols: Int,
        rows: Int,
        gap: Float,
        chromeX: Float = 0f,
        chromeY: Float = 0f,
        maxCell: Float = CROSSWORD_MAX_CELL,
        minCell: Float = CROSSWORD_MIN_CELL,
    ): Float {
        val c = cols.coerceAtLeast(1)
        val r = rows.coerceAtLeast(1)
        var t = (availW - chromeX - gap * (c - 1)) / c
        if (availH != null && availH.isFinite() && availH > 0f) t = minOf(t, (availH - chromeY - gap * (r - 1)) / r)
        return kotlin.math.floor(minOf(t, maxCell)).coerceAtLeast(minCell)
    }
}
