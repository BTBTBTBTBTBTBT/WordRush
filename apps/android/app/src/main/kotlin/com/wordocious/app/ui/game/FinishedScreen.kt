package com.wordocious.app.ui.game

import com.wordocious.app.ui.CastButton
import com.wordocious.app.ui.CastColor
import com.wordocious.app.ui.CastSize
import com.wordocious.app.ui.cast
import com.wordocious.app.ui.SoftModalSheet
import androidx.compose.foundation.layout.offset
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandyRoundButton
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
import com.wordocious.app.ui.ModeCard
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.accentLine
import com.wordocious.app.ui.accentWash
import com.wordocious.app.ui.darkenInk
import com.wordocious.app.ui.pageBackground
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.tintedPill
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import kotlin.math.ceil
import kotlin.math.roundToInt

// FINISH_SPEC R2 + R3: the ONE finished-screen scaffold every game uses after its
// win / lose popup. Top → bottom: the game's header (controls row + title, as in
// play), a compact one-line result strip (badge · guesses · time · points), the
// board(s) scaled to whatever height is left, then the action dock — the 3D share
// icon, the primary candy (Next daily / Leaderboard) and, for Pro, the peach
// Unlimited card (R3). Extras (score breakdown, definitions, rank badge, clues, word
// lists) live behind the "More" chip's sheet — never above the buttons. Measured,
// not guessed: the header, strip and dock are measured first and the board gets the
// rest ([FinishedSizing.budget]); only when even the board's floor cannot fit does
// the page scroll (and then the dock still sits at the end).

/** R2 the finished screen's pure numbers (dp as Float; unit-tested). */
object FinishedSizing {
    /** The smallest board area (dp) before the page gives up and scrolls. */
    const val MIN_BOARD = 120f
    /** The shortest phone the one-screen rule is promised for (iPhone SE, dp). */
    const val MIN_PHONE_HEIGHT = 667f

    /** The board's height and whether the page has to scroll to show it all. */
    data class Budget(val board: Float, val scrolls: Boolean)

    /**
     * Dock-first height budget: the [viewport] minus the measured [header], [strip],
     * [dock] and the [gaps] between them goes to the board — never below [minBoard]
     * (then [Budget.scrolls] is true and the page scrolls).
     */
    fun budget(viewport: Float, header: Float, strip: Float, dock: Float, gaps: Float, minBoard: Float = MIN_BOARD): Budget {
        val left = viewport - header - strip - dock - gaps
        return if (left >= minBoard) Budget(left, scrolls = false) else Budget(minBoard.coerceAtLeast(0f), scrolls = true)
    }

    /** The board slot's height: the [budget] board, never above an optional [maxBoard] cap (null = no cap). */
    fun cappedBoard(budget: Float, maxBoard: Float?): Float =
        (if (maxBoard != null) minOf(budget, maxBoard) else budget).coerceAtLeast(0f)

    /**
     * Founder 10-02 (finished screens centered): the block's top offset — the leftover
     * [viewport] height above a [content]-tall block splits equally above and below it
     * (0 when the block fills or overflows the page).
     */
    fun centeredTop(viewport: Float, content: Float): Float = ((viewport - content) / 2f).coerceAtLeast(0f)

    /** A square board's side in a [availW] × [availH] slot, never above [maxSide]. */
    fun squareSide(availW: Float, availH: Float, maxSide: Float): Float =
        minOf(availW, availH, maxSide).coerceAtLeast(0f)

    /**
     * One mini board's outer width in a [cols] × [rows] grid that fits [availW] ×
     * [availH] with [gap] between boards: each board shows [tileCols] × [tileRows]
     * SQUARE tiles inside [chromeW] / [chromeH] of tray padding (+ lip), and [label] dp
     * under it (a missed word). The tighter side wins; never above [maxWidth].
     */
    fun miniBoardWidth(
        availW: Float, availH: Float, cols: Int, rows: Int,
        tileCols: Int, tileRows: Int, gap: Float, chromeW: Float, chromeH: Float,
        label: Float = 0f, maxWidth: Float = 200f,
    ): Float {
        val c = cols.coerceAtLeast(1)
        val r = rows.coerceAtLeast(1)
        val fromW = (availW - gap * (c - 1)) / c
        val boardH = (availH - gap * (r - 1)) / r - label
        val fromH = (boardH - chromeH) * tileCols.coerceAtLeast(1) / tileRows.coerceAtLeast(1) + chromeW
        return minOf(fromW, fromH, maxWidth).coerceAtLeast(0f)
    }

    /** The grid shape for [boards] mini boards: 1 → 1×1, 2–4 → 2 columns, more → 4 columns. */
    fun miniGridCols(boards: Int): Int = when {
        boards <= 1 -> 1
        boards <= 4 -> 2
        else -> 4
    }

    /**
     * A list of [rows] rows of tiles (Ladder rungs) in [availH]: the tile side that
     * fits ([gap] between rows, [fixed] dp of labels / tray chrome), capped at
     * [maxTile]; null when even [minTile] cannot fit (collapse to "See all").
     */
    fun rowTile(availH: Float, rows: Int, gap: Float, fixed: Float, maxTile: Float, minTile: Float): Float? {
        val r = rows.coerceAtLeast(1)
        val tile = ((availH - fixed - gap * (r - 1)) / r).coerceAtMost(maxTile)
        return if (tile >= minTile) tile else null
    }
}

// ── The scaffold ──────────────────────────────────────────────────────────

private enum class FinishedSlot { HEADER, STRIP, DOCK, BOARD }

/**
 * R2 the finished screen: [header] (the game's own header), [strip] ([ResultStrip]),
 * [board] — called with the width and the height LEFT after the header, strip and
 * [dock] were measured (never above [maxBoardHeight] when set) — and the [dock]
 * ([FinishedDock]). Founder 10-02: the whole block (header → dock) sits vertically
 * centered in the page — the board stays the flexible part, and whatever height it
 * does not use (a capped or smaller board) splits equally above and below the block.
 */
@Composable
fun FinishedScreen(
    modifier: Modifier = Modifier,
    horizontalPadding: Dp = 10.dp,
    gap: Dp = 8.dp,
    /** Optional cap on the board slot (null = the board takes all the height left). */
    maxBoardHeight: Dp? = null,
    header: @Composable () -> Unit,
    strip: @Composable () -> Unit,
    dock: @Composable () -> Unit,
    board: @Composable (maxWidth: Dp, maxHeight: Dp) -> Unit,
) {
    val scroll = rememberScrollState()
    BoxWithConstraints(modifier.fillMaxSize()) {
        val viewport = if (constraints.hasBoundedHeight) constraints.maxHeight else 2000
        SubcomposeLayout(Modifier.fillMaxWidth().verticalScroll(scroll).padding(horizontal = horizontalPadding)) { c ->
            val w = c.maxWidth
            val loose = Constraints(minWidth = 0, maxWidth = w, minHeight = 0, maxHeight = Constraints.Infinity)
            fun slot(key: FinishedSlot, content: @Composable () -> Unit) =
                subcompose(key) { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) { content() } }.map { it.measure(loose) }
            val headerP = slot(FinishedSlot.HEADER, header)
            val stripP = slot(FinishedSlot.STRIP, strip)
            val dockP = slot(FinishedSlot.DOCK, dock)
            val gapPx = gap.roundToPx()
            val headerH = headerP.maxOfOrNull { it.height } ?: 0
            val stripH = stripP.maxOfOrNull { it.height } ?: 0
            val dockH = dockP.maxOfOrNull { it.height } ?: 0
            val budget = FinishedSizing.budget(
                viewport.toFloat(), headerH.toFloat(), stripH.toFloat(), dockH.toFloat(), gapPx * 3f,
                FinishedSizing.MIN_BOARD.dp.toPx(),
            )
            val boardMax = FinishedSizing.cappedBoard(budget.board, maxBoardHeight?.toPx()).roundToInt().coerceAtLeast(0)
            val boardP = subcompose(FinishedSlot.BOARD) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { board(w.toDp(), boardMax.toDp()) }
            }.map { it.measure(Constraints(minWidth = 0, maxWidth = w, minHeight = 0, maxHeight = boardMax)) }
            // The board's real height (≤ its slot): the block packs header → strip → board →
            // dock and centers as a whole; unused height splits equally above and below.
            val boardH = (boardP.maxOfOrNull { it.height } ?: 0).coerceAtMost(boardMax)
            val block = headerH + stripH + boardH + dockH + gapPx * 3
            val total = maxOf(viewport, block)
            val top = FinishedSizing.centeredTop(total.toFloat(), block.toFloat()).roundToInt()
            layout(w, total) {
                var y = top
                headerP.forEach { it.place(0, y) }
                y += headerH + gapPx
                stripP.forEach { it.place(0, y) }
                y += stripH + gapPx
                boardP.forEach { it.place(0, y + (boardH - it.height) / 2) }
                y += boardH + gapPx
                dockP.forEach { it.place(0, y) }
            }
        }
    }
}

// ── The result strip ──────────────────────────────────────────────────────

/** What a strip chip's little glyph shows. */
enum class StripGlyph { CHECK, CROWN, CLOCK, POINTS }

/** One chip of the [ResultStrip]. */
data class StripItem(val glyph: StripGlyph, val value: String, val label: String, val accent: Color)

/** The purple guesses-style chip (guesses, mistakes, checks, moves, words …). */
fun stripCount(value: String, label: String, glyph: StripGlyph = StripGlyph.CHECK, accent: Color = Color(0xFF7C3AED)) =
    StripItem(glyph, value, label, accent)

/** The blue time chip (m:ss, or "45s" under a minute). */
fun stripTime(seconds: Int) = StripItem(
    StripGlyph.CLOCK, if (seconds >= 60) "${seconds / 60}:${"%02d".format(seconds % 60)}" else "${seconds}s", "time", Color(0xFF2563EB),
)

/** The gold points chip. */
fun stripPoints(points: Int) = StripItem(StripGlyph.POINTS, "%,d".format(points), "pts", Color(0xFFF5A524))

/** The screen-reader sentence for a strip. */
fun stripSentence(won: Boolean, items: List<StripItem>): String =
    (listOf(if (won) "Won" else "Not solved") + items.map { "${it.value} ${if (it.label == "pts") "points" else it.label}" }).joinToString(", ")

/**
 * R2 the compact result strip: ONE line — the W / L badge, then small tinted chips
 * (soft numbers + a tiny label) for guesses · time · points. Scrolls sideways rather
 * than wrap on a very narrow phone. TalkBack reads it as one sentence.
 */
/** The shortest screen (dp) that shows the strip's live headline. */
const val STRIP_HEADLINE_MIN_SCREEN_DP = 700

/** AR the strip's live headline: "SOLVED IN 4 GUESSES" (the first count chip), "SOLVED!", or "SO CLOSE". */
fun stripHeadline(won: Boolean, items: List<StripItem>): String {
    if (!won) return "SO CLOSE"
    val first = items.firstOrNull { it.glyph == StripGlyph.CHECK }
    return if (first != null) "SOLVED IN ${first.value} ${first.label}".uppercase() else "SOLVED!"
}

@Composable
fun ResultStrip(
    won: Boolean,
    items: List<StripItem>,
    modifier: Modifier = Modifier,
    srText: String = stripSentence(won, items),
    /** AR the live headline over the chips (null = chips only). */
    headline: String? = stripHeadline(won, items),
) {
    Column(modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = srText }, horizontalAlignment = Alignment.CenterHorizontally) {
    // Audit (10-02): on a short phone (< 700 dp tall, e.g. 360×640) the headline's ~38 dp goes to
    // the board instead — the chips already carry the result.
    val roomy = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp >= STRIP_HEADLINE_MIN_SCREEN_DP
    if (headline != null && roomy) {
        // BJ16: SOLVED! / NOT TODAY lettering by result (the chips carry the counts).
        com.wordocious.app.ui.HeadingArt(
            if (won) com.wordocious.app.ui.Heading.SOLVED else com.wordocious.app.ui.Heading.NOTTODAY,
            height = 36.dp, contentDescription = headline,
        )
    }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            com.wordocious.app.ui.ResultBadge(won, size = 26.dp)
            items.forEach { StripChip(it) }
            // Founder 10-02: an invisible badge-sized twin on the trailing end, so the chips
            // (not the badge + chips) center on the screen's center line.
            Spacer(Modifier.size(26.dp))
        }
    }
    }
}

@Composable
private fun StripChip(item: StripItem) {
    Row(
        Modifier.tintedPill(item.accent, corner = 14.dp).padding(start = 4.dp, end = 9.dp, top = 5.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            when (item.glyph) {
                StripGlyph.CHECK -> Icon3D(Icon3DName.BADGE_CHECK, 18.dp)
                StripGlyph.CROWN -> Icon3D(Icon3DName.CROWN, 18.dp)
                StripGlyph.POINTS -> Icon3D(Icon3DName.TROPHY, 17.dp)
                StripGlyph.CLOCK -> ClockGlyph(item.accent, 16.dp)
            }
        }
        SoftNumber(item.value, 15.sp)
        Text(item.label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.label, maxLines = 1)
    }
}

/** A small soft clock (the time chip's glyph). */
@Composable
private fun ClockGlyph(color: Color, size: Dp) {
    Canvas(Modifier.size(size)) {
        val r = this.size.minDimension / 2f
        val c = Offset(this.size.width / 2f, this.size.height / 2f)
        drawCircle(color.copy(alpha = 0.18f), r, c)
        drawCircle(color, r * 0.86f, c, style = Stroke(r * 0.22f))
        drawLine(color, c, Offset(c.x, c.y - r * 0.52f), r * 0.2f, StrokeCap.Round)
        drawLine(color, c, Offset(c.x + r * 0.4f, c.y + r * 0.12f), r * 0.2f, StrokeCap.Round)
    }
}

// ── The dock ──────────────────────────────────────────────────────────────

/** The next unplayed daily after [currentMode] (or the whole sweep done). */
internal data class NextDaily(val next: ModeCard?, val allDone: Boolean, val sweepTotal: Int)

/**
 * U3 / More Games Stage 4/9 handoff order: a sweep game hands to the next unplayed
 * sweep game; a More Games title hands to the next unplayed More Games title this
 * viewer can see, THEN the sweep. The sweep never hands into More Games. Seeded from
 * the day-keyed cache (updated the instant this game recorded), then confirmed
 * against the server; re-fetched on every completion tick.
 */
@Composable
internal fun rememberNextDaily(currentMode: GameMode): NextDaily {
    val tick by com.wordocious.app.data.DailyCompletionsService.completionTick.collectAsState()
    val completions by produceState(
        initialValue = com.wordocious.app.data.DailyCompletionsService.readCache(), key1 = tick,
    ) {
        value = com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions()
    }
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
    return NextDaily(next, allDone, sweepTotal)
}

/** The full player-facing title of [mode] ("Unlimited Succession", not "Succ."). */
internal fun finishedModeTitle(mode: GameMode): String =
    com.wordocious.app.ModeGen.byDbKey(mode.name)?.title ?: com.wordocious.app.ui.modeCardFor(mode)?.title ?: mode.name

/**
 * R2 the action dock, at the bottom of the [FinishedScreen] block: ONE 40 dp action row —
 * the "Share results" candy (founder 10-02, [ShareResultsCandy]: on a daily the "Next {Game}
 * in 3h 12m" countdown rides inside it as a second line, no row of its own), the primary
 * candy — on a DAILY game the next unplayed daily (amber, with a round purple Leaderboard
 * beside it) or, once the sweep is done, this game's Leaderboard — any [extra] actions, and
 * the "More" chip ([more] opens in a sheet). Under it, on a
 * daily result, the peach Unlimited card (R3) — for everyone since the founder's 10-02
 * call: free players and guests see it with a gold PRO pill and their tap opens the Go
 * Pro paywall ([ProPaywallDialog]; a purchase plays straight through). After an
 * UNLIMITED game ([onNewPuzzle], Pro) the card IS the primary action: NEW PUZZLE +
 * "Other games" ([onOtherGames]). Guests get no daily CTAs (their dailies never
 * record, so "next" would be a lie).
 */
@Composable
fun FinishedDock(
    mode: GameMode,
    isDaily: Boolean,
    accent: Color,
    onShare: (() -> Unit)?,
    onOpenDaily: ((GameMode) -> Unit)?,
    onOpenLeaderboard: ((GameMode) -> Unit)?,
    onOpenUnlimited: ((GameMode) -> Unit)?,
    onNewPuzzle: (() -> Unit)? = null,
    onOtherGames: (() -> Unit)? = null,
    more: (@Composable ColumnScope.() -> Unit)? = null,
    extra: (@Composable RowScope.() -> Unit)? = null,
) {
    val profile by AuthService.profile.collectAsState()
    val signedIn = profile != null
    val pro = profile != null && AuthService.isProActive
    val newPuzzle = if (!isDaily && pro) onNewPuzzle else null
    Column(
        Modifier.widthIn(max = 440.dp).fillMaxWidth().padding(top = 2.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (newPuzzle != null) {
            UnlimitedCard(mode, onPlay = newPuzzle, newPuzzle = true, onOtherGames = onOtherGames) {
                // The card's action row: Share results · NEW PUZZLE · More (founder 10-02: the
                // share candy takes the old share icon's place — no row of its own, no countdown).
                onShare?.let { ShareResultsCandy(it, countdownFor = null) }
                CastButton(
                    "New puzzle", onClick = newPuzzle, modifier = Modifier.weight(1f),
                    color = CastColor.SLATE, size = CastSize.L, fill = true,
                    contentDescription = "New puzzle: Unlimited ${finishedModeTitle(mode)}",
                )
                extra?.invoke(this)
                if (more != null) MoreChip(accent, more)
            }
            return@Column
        }
        val daily = isDaily && signedIn && onOpenDaily != null
        val nd = if (daily) rememberNextDaily(mode) else null
        if (nd?.allDone == true) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon3D(Icon3DName.TROPHY, 18.dp)
                Text(
                    "All ${nd.sweepTotal} dailies done. Sweep complete!",
                    fontSize = 12.sp, fontWeight = FontWeight.Black, color = com.wordocious.app.ui.purpleTextInk,
                )
            }
        }
        // AT1: the actions center on the SCREEN — one row spanning the dock. Founder 10-02:
        // "Share results" leads it (beside Next / Leaderboard, the two split the row), with
        // the daily countdown inside the candy; nothing floats beside the row.
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        ) {
            val lbTitle = finishedModeTitle(mode)
            val next = nd?.next
            val nextMode = next?.engineMode
            val hasPrimary = nd != null && (onOpenLeaderboard != null || (nextMode != null && onOpenDaily != null))
            onShare?.let {
                ShareResultsCandy(
                    it, countdownFor = if (isDaily) lbTitle else null,
                    modifier = if (hasPrimary) Modifier.weight(1f) else Modifier, fill = hasPrimary,
                )
            }
            if (nd != null && nextMode != null && onOpenDaily != null) {
                CandyButton(
                    "Next: ${next.title}", onClick = { onOpenDaily(nextMode) },
                    modifier = Modifier.weight(1f), color = CandyColor.AMBER, size = CandySize.MEDIUM, fill = true,
                    leading = { CtaGameIcon(next.id, 24.dp) }, trailing = "›",
                    contentDescription = "Next daily: ${next.title}",
                )
                if (onOpenLeaderboard != null) {
                    CandyRoundButton("$lbTitle Leaderboard", onClick = { onOpenLeaderboard(mode) }, color = CandyColor.PURPLE, diameter = 40.dp) {
                        Icon3D(Icon3DName.TROPHY, 22.dp)
                    }
                }
            } else if (nd != null && onOpenLeaderboard != null) {
                CandyButton(
                    "Leaderboard", onClick = { onOpenLeaderboard(mode) },
                    modifier = Modifier.weight(1f), color = CandyColor.PURPLE, size = CandySize.MEDIUM, fill = true,
                    leading = { Icon3D(Icon3DName.TROPHY, 22.dp) }, trailing = "›",
                    contentDescription = "$lbTitle Leaderboard",
                )
            }
            extra?.invoke(this)
            if (more != null) MoreChip(accent, more)
        }
        // R3 "Keep playing: Unlimited <Game>" on a daily result (the tester-reported dead
        // end after the daily sweep). Founder 10-02: free players and guests see it too,
        // with a gold PRO pill — their tap opens the Go Pro paywall (guests sign in there
        // first) and a successful purchase starts the Unlimited game directly.
        if (isDaily && onOpenUnlimited != null) {
            // BA1 (founder 10-02): on a short screen (< 700 dp) the card collapses to ONE small
            // peach candy (mini U loop + "Unlimited") so the board gets the height.
            if (isShortScreen()) UnlimitedMiniButton(mode, onPlay = { onOpenUnlimited(mode) })
            else UnlimitedCard(mode, onPlay = { onOpenUnlimited(mode) }, newPuzzle = false)
        }
    }
}

/** Founder 10-02: the finished dock's "Next {Game} in 3h 12m" countdown text (pure; unit-tested). */
object FinishedCountdown {
    /** "Xh Ym" from one hour up, else "Ym" (never below "1m"). */
    fun format(secondsLeft: Long): String {
        val mins = (secondsLeft.coerceAtLeast(0L) / 60L)
        val h = mins / 60L
        val m = mins % 60L
        return if (h >= 1L) "${h}h ${m}m" else "${m.coerceAtLeast(1L)}m"
    }

    /** "Next Gauntlet in 3h 12m". */
    fun line(gameName: String, secondsLeft: Long): String = "Next $gameName in ${format(secondsLeft)}"

    /**
     * The share candy's second line: [line] on a daily ([gameName] non-null), none after an
     * Unlimited game or on a [short] screen (< 700 dp: the board needs the room).
     */
    fun shareSubtitle(gameName: String?, secondsLeft: Long, short: Boolean): String? =
        if (gameName == null || short) null else line(gameName, secondsLeft)
}

/**
 * Founder 10-02: the finished dock's pink "Share results" candy — the game's own share flow
 * (chooser included: [onShare]) — sitting IN the dock's action row at the row's 40 dp
 * MEDIUM height. On a DAILY result ([countdownFor] = the game's name) a small live "Next
 * {Game} in 3h 12m" second line rides inside it, counting down to the local-midnight daily
 * reset (re-reads every 30 s); on a short screen (< 700 dp) the line is dropped. Replaces
 * the side-floating share icon and Gauntlet's "Play again tomorrow".
 */
@Composable
fun ShareResultsCandy(onShare: () -> Unit, countdownFor: String?, modifier: Modifier = Modifier, fill: Boolean = false) {
    val short = isShortScreen()
    val secs by produceState(initialValue = com.wordocious.app.ui.secondsUntilLocalMidnightLimit(), countdownFor) {
        if (countdownFor == null) return@produceState
        while (true) {
            kotlinx.coroutines.delay(30_000L)
            value = com.wordocious.app.ui.secondsUntilLocalMidnightLimit()
        }
    }
    val sub = FinishedCountdown.shareSubtitle(countdownFor, secs, short)
    CandyButton(
        "Share results", onClick = onShare, modifier = modifier, color = CandyColor.PINK, size = CandySize.MEDIUM,
        // The two-line label needs the glyph's room; it comes back when the line is dropped.
        icon = if (sub == null) com.wordocious.app.ui.CandyIcon.SHARE else null,
        fill = fill, subtitle = sub,
        contentDescription = if (sub != null) "Share results. $sub" else "Share results",
    )
}

/** A CTA's leading game icon (the glossy 3D game art), decorative. */
@Composable
internal fun CtaGameIcon(modeId: String?, size: Dp = 28.dp) {
    val art = com.wordocious.app.ui.gameArtRes(modeId)
    if (art != null) {
        Image(painterResource(art), contentDescription = null, modifier = Modifier.size(size))
    } else {
        com.wordocious.app.ui.CandyGlyph(com.wordocious.app.ui.CandyIcon.ARROW, size * 0.72f)
    }
}

// ── R3 the Unlimited card ─────────────────────────────────────────────────

/** The Unlimited card's peach (web UNLIMITED_PEACH). */
val UNLIMITED_PEACH = Color(0xFFFB923C)

/**
 * R3 the U loop art (U floating with a loop of candy tiles), [width] wide, a slow
 * orbit wobble (off with Reduce Motion). Decorative.
 */
@Composable
fun UnlimitedLoopArt(width: Dp = 64.dp, modifier: Modifier = Modifier) {
    // FINISH_SPEC AD: a continuous wobble — off under Reduce Motion or Battery Saver.
    val still = WTheme.calmMotion
    val t = if (still) null else rememberInfiniteTransition(label = "loopWobble")
    val turn = t?.animateFloat(-3f, 3f, infiniteRepeatable(tween(3200, easing = LinearEasing), RepeatMode.Reverse), label = "loopTurn")
    val bob = t?.animateFloat(-2f, 2f, infiniteRepeatable(tween(2300, easing = LinearEasing), RepeatMode.Reverse), label = "loopBob")
    Image(
        painterResource(R.drawable.art_scene_unlimited_loop),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = modifier.width(width).aspectRatio(900f / 759f)
            .graphicsLayer {
                rotationZ = turn?.value ?: 0f
                translationY = (bob?.value ?: 0f) * density
            }
            .clearAndSetSemantics { },
    )
}

/**
 * R3 the peach "KEEP PLAYING" card: the U loop art left, "Unlimited <Game>" + "Fresh
 * puzzles, no waiting", and a peach "Play" candy ([onPlay]; Y: no infinity mark). With
 * [newPuzzle] (after an UNLIMITED game) it reads "KEEP GOING", shows the small "Other
 * games" chip ([onOtherGames]) and [actions] become its own row (share · NEW PUZZLE ·
 * More) — the card is the primary action.
 */
@Composable
fun UnlimitedCard(
    mode: GameMode,
    onPlay: () -> Unit,
    newPuzzle: Boolean,
    onOtherGames: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    actions: (@Composable RowScope.() -> Unit)? = null,
) {
    val title = finishedModeTitle(mode)
    val peach = UNLIMITED_PEACH
    val profile by AuthService.profile.collectAsState()
    // Free players and guests see the card too (founder 10-02); their tap opens the
    // Go Pro paywall, and turning Pro there plays straight through to [onPlay].
    val locked = !newPuzzle && (profile == null || !AuthService.isProActive)
    var paywall by remember { mutableStateOf(false) }
    if (paywall) ProPaywallDialog(onDismiss = { paywall = false }, onPro = { paywall = false; onPlay() })
    val shape = RoundedCornerShape(18.dp)
    val dark = WTheme.isDark
    Column(
        modifier.fillMaxWidth()
            .clip(shape)
            .background(accentWash(peach, 0.14f))
            .drawBehind { drawRect(peach, Offset.Zero, Size(size.width, 4.dp.toPx())) }
            .border(1.5.dp, accentLine(peach, 0.34f), shape)
            .padding(start = 10.dp, end = 10.dp, top = 10.dp, bottom = 8.dp)
            .semantics { contentDescription = "Keep playing: Unlimited $title" },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            UnlimitedLoopArt(64.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    if (newPuzzle) "KEEP GOING" else "KEEP PLAYING", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                    color = if (dark) Color(0xFFFDBA74) else darkenInk(peach),
                )
                Text(
                    "Unlimited $title", fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                    color = if (dark) WTheme.text else FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "Fresh puzzles, no waiting", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    color = if (dark) WTheme.textMuted else FinishInk.muted, maxLines = 1,
                )
            }
            if (newPuzzle) {
                if (onOtherGames != null) {
                    Text(
                        "Other games", fontSize = 11.sp, fontWeight = FontWeight.Black,
                        color = if (dark) WTheme.text else darkenInk(peach), maxLines = 1,
                        modifier = Modifier.squishClickable("Other games") { onOtherGames() }
                            .tintedPill(peach, corner = 14.dp).padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 4.dp),
                    )
                }
            } else {
                Box {
                    CastButton(
                        "Play", onClick = { if (locked) paywall = true else onPlay() },
                        color = CastColor.SLATE, size = CastSize.S,
                        contentDescription = if (locked) "Play Unlimited $title, a Pro feature" else "Play Unlimited $title",
                        modifier = Modifier.padding(top = if (locked) 6.dp else 0.dp),
                    )
                    if (locked) ProPill(Modifier.align(Alignment.TopEnd))
                }
            }
        }
        if (actions != null) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = actions)
        }
    }
}

/** BA1 the one-screen rule's short phone: under this height (dp) the finished screens compact. */
const val SHORT_SCREEN_DP = 700

@Composable
fun isShortScreen(): Boolean = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp < SHORT_SCREEN_DP

/**
 * BA1 the collapsed "Keep playing: Unlimited" — one small peach candy with the mini U loop art.
 * Free players and guests see it too (a gold PRO pill; the tap opens the Go Pro paywall and a
 * purchase plays straight through), exactly like the full card.
 */
@Composable
fun UnlimitedMiniButton(mode: GameMode, onPlay: () -> Unit, modifier: Modifier = Modifier) {
    val title = finishedModeTitle(mode)
    val profile by AuthService.profile.collectAsState()
    val locked = profile == null || !AuthService.isProActive
    var paywall by remember { mutableStateOf(false) }
    if (paywall) ProPaywallDialog(onDismiss = { paywall = false }, onPro = { paywall = false; onPlay() })
    Box(modifier.padding(top = if (locked) 5.dp else 0.dp)) {
        CastButton(
            "Unlimited", onClick = { if (locked) paywall = true else onPlay() },
            color = CastColor.SLATE, size = CastSize.S,
            leading = { UnlimitedLoopArt(22.dp) },
            contentDescription = if (locked) "Keep playing: Unlimited $title, a Pro feature" else "Keep playing: Unlimited $title",
        )
        if (locked) ProPill(Modifier.align(Alignment.TopEnd).offset(x = 6.dp, y = (-6).dp))
    }
}

/** R3 the small gold PRO pill on a locked Unlimited button. Decorative (the button says it). */
@Composable
fun ProPill(modifier: Modifier = Modifier) {
    Text(
        "PRO", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color(0xFF5A2E00),
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color(0xFFFFE08A), Color(0xFFF5A524))))
            .border(1.dp, Color(0xFFD97706), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 1.dp)
            .clearAndSetSemantics { },
    )
}

/**
 * R3 the Go Pro paywall (G1, ui/ProScreen.kt) over the current screen, for a free
 * player or guest who tapped an Unlimited offer. Guests sign in on the paywall's own
 * sign-in card and land back on it. When the account turns Pro while it is open
 * (a purchase, or signing in to a Pro account) [onPro] runs — the caller starts the
 * Unlimited game directly.
 */
@Composable
fun ProPaywallDialog(onDismiss: () -> Unit, onPro: () -> Unit) {
    val profile by AuthService.profile.collectAsState()
    val wasPro = remember { AuthService.profile.value != null && AuthService.isProActive }
    // FINISH_SPEC AP: a first purchase shows "Welcome to Pro" first — the paywall steps
    // aside and [onPro] (e.g. launching the Unlimited game) runs after "LET'S PLAY!".
    var welcoming by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(profile) {
        if (!wasPro && !welcoming && profile != null && AuthService.isProActive) {
            if (com.wordocious.app.ui.ProWelcome.deferUntilWelcomed(onPro)) welcoming = true else onPro()
        }
    }
    if (welcoming) return
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Box(
            Modifier.fillMaxSize()
                .pageBackground(com.wordocious.app.ui.PageTint.HOME)
                .statusBarsPadding().navigationBarsPadding(),
        ) {
            com.wordocious.app.ui.ProScreen(onDone = onDismiss)
        }
    }
}

// ── "More" + "See all" ────────────────────────────────────────────────────

/** R2 a small tinted chip ("More ▾", "See all") that squishes. */
@Composable
fun FinishedChip(text: String, accent: Color, contentDescription: String = text, onClick: () -> Unit) {
    Row(
        Modifier.squishClickable(contentDescription) { onClick() }
            .tintedPill(accent, corner = 16.dp)
            .heightIn(min = 34.dp)
            .padding(start = 12.dp, end = 10.dp, top = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.label, maxLines = 1)
        Text("▾", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textMuted else accent)
    }
}

/** R2 the "More" disclosure: a tinted chip that opens [content] in a sheet. */
@Composable
fun MoreChip(accent: Color, content: @Composable ColumnScope.() -> Unit) {
    var open by remember { mutableStateOf(false) }
    FinishedChip("More", accent, contentDescription = "More: score and details") { open = true }
    if (open) FinishedSheet("More", accent, onDismiss = { open = false }, content = content)
}

/** R2 a tinted bottom sheet for the finished screen's extras (never white). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinishedSheet(title: String, accent: Color, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    SoftModalSheet(
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = if (WTheme.isDark) WTheme.bg else Wash.mix(accent, 0.07f),
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 14.dp, end = 14.dp, bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                title.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.4.sp,
                color = if (WTheme.isDark) WTheme.textMuted else FinishInk.label,
                modifier = Modifier.semantics { heading() },
            )
            content()
            CastButton("Close", onClick = onDismiss, color = CastColor.SLATE, size = CastSize.M)
        }
    }
}

/**
 * R2 a long list in the board slot (Ladder rungs, Hubbub words, a long saying):
 * shown at most [maxHeight] tall; when it does not fit, the top shows (it still
 * scrolls in place) and a "See all" chip opens the whole list ([full], default
 * [content]) in a sheet.
 */
@Composable
fun FinishedListSlot(
    maxHeight: Dp,
    accent: Color,
    seeAllTitle: String,
    modifier: Modifier = Modifier,
    full: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val state = rememberScrollState()
    var open by remember { mutableStateOf(false) }
    val overflows = state.maxValue in 1 until Int.MAX_VALUE
    Column(modifier.fillMaxWidth().heightIn(max = maxHeight), horizontalAlignment = Alignment.CenterHorizontally) {
        Column(
            Modifier.weight(1f, fill = false).fillMaxWidth().verticalScroll(state),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            content = content,
        )
        if (overflows) {
            Spacer(Modifier.height(6.dp))
            FinishedChip("See all", accent, contentDescription = "See all: $seeAllTitle") { open = true }
        }
    }
    if (open) FinishedSheet(seeAllTitle, accent, onDismiss = { open = false }, content = full ?: content)
}

// ── Boards ────────────────────────────────────────────────────────────────

/** A square board ([content] fills it) as big as the slot allows, never above [maxSide]. */
@Composable
fun FinishedSquare(maxWidth: Dp, maxHeight: Dp, maxSide: Dp = 420.dp, content: @Composable (side: Dp) -> Unit) {
    val side = FinishedSizing.squareSide(maxWidth.value, maxHeight.value, maxSide.value).dp
    Box(Modifier.width(side), contentAlignment = Alignment.Center) { content(side) }
}

/**
 * AT2 (founder 10-02: a Deliverance loss drew its boards at different sizes) the multi-board
 * recap's shared geometry: every board uses the LARGEST board's rows (prefills + its row
 * budget or played rows) × columns, so all boards share one tile size and one height;
 * shorter boards pad with empty rows. Pure (unit tested).
 */
object RecapGeometry {
    /** Rows one board draws on its own (MiniBoardView's count: prefills + max(budget, played)). */
    fun rowsOf(b: BoardState): Int = (b.prefilledGuesses?.size ?: 0) + maxOf(b.maxGuesses, b.guesses.size)

    fun sharedRows(boards: List<BoardState>): Int = boards.maxOfOrNull { rowsOf(it) }?.coerceAtLeast(1) ?: 1

    fun sharedCols(boards: List<BoardState>): Int = boards.maxOfOrNull { it.solution.length }?.coerceAtLeast(1) ?: 1

    /** Empty rows [b] adds to reach the shared height. */
    fun padRows(b: BoardState, boards: List<BoardState>): Int = sharedRows(boards) - rowsOf(b)

    /** Every board's width : height. */
    fun aspect(boards: List<BoardState>): Float = sharedCols(boards).toFloat() / sharedRows(boards)
}

/**
 * R2 the multi-board recap (QuadWord / OctoWord / Deliverance / Succession): the 2×2
 * (or 4-across) mini grid sized to the slot — square tiles, every board its own
 * game tray (purple solved / slate missed); on a loss a missed board spells its word
 * underneath ([revealMissed]).
 */
@Composable
fun FinishedBoardsGrid(boards: List<BoardState>, revealMissed: Boolean, maxWidth: Dp, maxHeight: Dp) {
    if (boards.isEmpty()) return
    val cols = FinishedSizing.miniGridCols(boards.size)
    val rows = ceil(boards.size / cols.toFloat()).toInt()
    // AT2: ONE tile size + ONE board height for every board (the largest board's rows × cols;
    // shorter boards pad with empty rows), win or loss.
    val tileCols = RecapGeometry.sharedCols(boards)
    val tileRows = RecapGeometry.sharedRows(boards)
    val pad = 4f
    val gap = 6f
    val label = if (revealMissed && boards.any { it.status != GameStatus.WON }) 16f else 0f
    val boardW = FinishedSizing.miniBoardWidth(
        maxWidth.value, maxHeight.value, cols, rows, tileCols, tileRows, gap,
        chromeW = pad * 2, chromeH = pad * 2 + GameTrayStyle.LIP.value, label = label,
        maxWidth = if (cols >= 4) 110f else 190f,
    )
    val purple = Color(0xFF7C3AED)
    Column(verticalArrangement = Arrangement.spacedBy(gap.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        boards.chunked(cols).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(gap.dp), verticalAlignment = Alignment.Top) {
                row.forEach { b ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        GameTray(
                            purple, state = if (b.status == GameStatus.WON) TrayState.WON else TrayState.LOST,
                            corner = 12.dp, padding = PaddingValues(pad.dp),
                        ) {
                            Box(Modifier.width((boardW - pad * 2).coerceAtLeast(0f).dp).aspectRatio(RecapGeometry.aspect(boards))) {
                                MiniBoardView(board = b, animateLastRow = false, minTotalRows = tileRows)
                            }
                        }
                        if (revealMissed && b.status != GameStatus.WON) {
                            Text(
                                b.solution.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp, color = Color(0xFFDC2626), maxLines = 1,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * R2 a loss's answer, compact under the board: a small "THE ANSWER" label over the
 * word on slate tiles (the definition card moved into "More").
 */
@Composable
fun FinishedAnswer(word: String, label: String = "THE ANSWER", maxWidth: Dp = 360.dp) {
    if (word.isBlank()) return
    val letters = word.filter { !it.isWhitespace() }
    val n = letters.length.coerceAtLeast(1)
    val tile = ((maxWidth.value - 4f * (n - 1)) / n).coerceIn(16f, 28f).dp
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
        modifier = Modifier.clearAndSetSemantics { contentDescription = "The answer was $word" },
    ) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.label)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            word.forEach { ch ->
                if (ch.isWhitespace()) Spacer(Modifier.width(tile * 0.4f))
                else GameTileFace(ch.uppercase(), TileFace.ABSENT, Modifier.size(tile))
            }
        }
    }
}

/** A small centered result title line under the strip-less boards (e.g. ProperNoundle's name). */
@Composable
fun FinishedNote(text: String, color: Color, modifier: Modifier = Modifier) {
    Text(
        text, fontSize = 15.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = color,
        textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = modifier,
    )
}
