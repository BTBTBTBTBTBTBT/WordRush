package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.draw.drawBehind
import com.wordocious.app.ui.squishClickable
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState

private val ROWS = listOf("QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM")

/**
 * Keyboard layout preference (§213): standard | flipped | michael — three
 * arrangements of the same keys, picked in Settings. Snapshot-backed so a
 * change in Settings recomposes any live keyboard instantly.
 */
object KeyboardLayoutPref {
    const val KEY = "pref-keyboard-layout"
    private val state = androidx.compose.runtime.mutableStateOf(
        com.wordocious.app.data.SettingsPref.get(KEY, "standard"),
    )
    var value: String
        get() = state.value
        set(v) {
            state.value = v
            com.wordocious.app.data.SettingsPref.set(KEY, v)
        }
}

/**
 * On-screen keyboard — audit-then-match of the web `keyboard.tsx`.
 * - 3 QWERTY rows; ↵ left of bottom row, ⌫ right (the phone-keyboard position)
 * - Keys are responsive: each letter key gets equal width (weight 1f),
 *   wide keys get weight 1.5f — exactly like the web's flex-equal layout.
 * - Key height is 48dp (matches the web's h-14 ≈ 56px / ~42dp native).
 * - Letter-state coloring: CORRECT=green-600, PRESENT=yellow-600,
 *   ABSENT=gray-400, EMPTY=keyDefault (#e8e5f0).
 */
@Composable
fun KeyboardView(
    letterStates: Map<String, TileState> = emptyMap(),
    onKey: (Char) -> Unit,
    onDelete: () -> Unit,
    onEnter: () -> Unit,
    // Quadrant mode (Quad/Octo/Deliverance): per-board states drive sub-cell colors.
    perBoardStates: List<Map<String, TileState>>? = null,
    /** Override the key height (Muddle's one-screen rule asks for compact keys). */
    keyHeight: androidx.compose.ui.unit.Dp? = null,
    /** Codebreaker (founder, 2026-09-28): letters already settled (given or confirmed by a
     *  Check) fill in the mode accent so the remaining letters stand out. letter → color. */
    keyFills: Map<String, Color> = emptyMap(),
) {
    // iOS parity (KeyboardView.swift): playKeyTap on EVERY key, and the SAME
    // light `Haptics.tap()` on letters, ⌫ and ENTER alike.
    val haptics = LocalHapticFeedback.current
    val layout = KeyboardLayoutPref.value
    // Michael Keyboard is a row taller — shorter keys keep total height close
    // to the 3-row layouts so tight boards (OctoWord) don't squeeze.
    val keyH = keyHeight ?: if (layout == "michael") 44.dp else 52.dp
    val enterTap = {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        com.wordocious.app.data.SoundManager.playKeyTap()
        onEnter()
    }
    val deleteTap = {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        com.wordocious.app.data.SoundManager.playKeyTap()
        onDelete()
    }
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp), // B2 row spacing (game-kit.html .kbd gap 6)
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ROWS.forEachIndexed { rowIdx, row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp), // B2 key spacing (game-kit.html .krow gap 4)
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // standard: ENTER left / ⌫ right (every phone puts backspace
                // bottom-right — founder call, 2026-08-10). flipped: the
                // original mirror. michael: ⌫ at BOTH ends of the Z row, with
                // ENTER ×2 + a decorative space bar on a 4th row (§213).
                if (rowIdx == 2) {
                    when (layout) {
                        "flipped", "michael" -> WideKey("BACK", keyH, deleteTap)
                        else -> WideKey("ENTER", keyH, enterTap)
                    }
                }
                row.forEach { ch ->
                    val tap = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        com.wordocious.app.data.SoundManager.playKeyTap()
                        onKey(ch)
                    }
                    val fill = keyFills[ch.toString()]
                    if (perBoardStates != null) {
                        QuadrantKey(ch.toString(), perBoardStates, keyH, tap)
                    } else if (fill != null) {
                        LetterKey(ch.toString(), TileState.EMPTY, keyH, tap, fill = fill)
                    } else {
                        val state = letterStates[ch.toString()] ?: TileState.EMPTY
                        LetterKey(ch.toString(), state, keyH, tap)
                    }
                }
                if (rowIdx == 2) {
                    when (layout) {
                        "flipped" -> WideKey("ENTER", keyH, enterTap)
                        else -> WideKey("BACK", keyH, deleteTap)
                    }
                }
            }
        }
        if (layout == "michael") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                WideKey("ENTER", keyH, enterTap)
                SpaceKey(keyH) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    com.wordocious.app.data.SoundManager.playKeyTap()
                }
                WideKey("ENTER", keyH, enterTap)
            }
        }
    }
}

// ── FINISH_SPEC B2 · the keys are tiles ──────────────────────────────────

/** B2 a key's paint: the lip (bottom 3 dp), the face gradient and the ink. */
private data class KeyLook(val lip: Color, val faceTop: Color, val faceBottom: Color, val ink: Color)

/** B2 the unplayed key: a lilac lip, a light face, dark purple letters. */
private val KEY_PLAIN = KeyLook(Color(0xFFCDB9F0), Color(0xE6FFFFFF), Color(0xE6FFFFFF), Color(0xFF3B1A78))
private val KEY_PLAIN_DARK = KeyLook(Color(0xFF4A3B6E), Color(0xFF3A2D5C), Color(0xFF33284F), Color(0xFFF1EAFF))

/** B2 a revealed key takes its tile's state colors (the colorblind swap included). */
private fun keyLookFor(state: TileState): KeyLook {
    if (state == TileState.EMPTY) return if (WTheme.isDark) KEY_PLAIN_DARK else KEY_PLAIN
    val face = when (state) {
        TileState.CORRECT -> TileFace.CORRECT
        TileState.PRESENT, TileState.HINT_USED -> TileFace.PRESENT
        else -> TileFace.ABSENT
    }
    val t = TileLooks.of(face, WTheme.colorblind)
    return KeyLook(t.edge, t.faceTop, t.faceMid, if (face == TileFace.ABSENT) Color(0xFFEEF1F6) else Color.White)
}

/** A key filled in a fixed color (Codebreaker's settled letters): that color's face, a darker lip. */
private fun keyLookFill(fill: Color): KeyLook = KeyLook(
    lip = Color(com.wordocious.app.ui.TintMath.over(0xFF000000.toInt(), 0.32f, fill.copy(alpha = 1f).toArgb())),
    faceTop = Color(com.wordocious.app.ui.TintMath.over(0xFFFFFFFF.toInt(), 0.22f, fill.copy(alpha = 1f).toArgb())),
    faceBottom = fill.copy(alpha = 1f),
    ink = Color.White,
)

private val KEY_CORNER = 9.dp
private val KEY_LIP = 3.dp

/** B2 a key tile: the lip under a face inset [KEY_LIP] from the bottom, radius 9; squishes on press (A9). */
private fun Modifier.keyTile(look: KeyLook): Modifier = this.drawBehind {
    val r = androidx.compose.ui.geometry.CornerRadius(KEY_CORNER.toPx())
    drawRoundRect(look.lip, cornerRadius = r)
    val faceH = size.height - KEY_LIP.toPx()
    drawRoundRect(
        Brush.verticalGradient(listOf(look.faceTop, look.faceBottom), endY = faceH),
        size = androidx.compose.ui.geometry.Size(size.width, faceH),
        cornerRadius = r,
    )
}

/** Decorative space bar (§213): reacts like a key, does nothing. */
@Composable
private fun RowScope.SpaceKey(h: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(4f)
            .height(h)
            .squishClickable("Space (decorative)", onClick = onClick)
            .keyTile(if (WTheme.isDark) KEY_PLAIN_DARK else KEY_PLAIN)
            .padding(bottom = KEY_LIP),
        contentAlignment = Alignment.Center,
    ) {
        Text("space", color = Color(0xFF8A78AD), fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
    }
}

/**
 * Quadrant key — per spec Part 2: a grid of sub-cells (cols 2 for ≤4 boards, 4
 * for octo), each colored by that board's letter state (board-tile palette).
 * All-absent → the slate key. Letter overlaid; white (w/ shadow) if any board has
 * info, else dark purple. B2: drawn as a key tile (the sub-cells sit on its face).
 */
@Composable
private fun RowScope.QuadrantKey(
    letter: String,
    perBoardStates: List<Map<String, TileState>>,
    h: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    val n = perBoardStates.size
    val cols = if (n <= 4) 2 else 4
    val rows = (n + cols - 1) / cols
    val cellStates = perBoardStates.map { it[letter] ?: TileState.EMPTY }
    val hasAny = cellStates.any { it != TileState.EMPTY }
    val allAbsent = cellStates.isNotEmpty() && cellStates.all { it == TileState.ABSENT }
    val look = if (allAbsent) keyLookFor(TileState.ABSENT) else if (WTheme.isDark) KEY_PLAIN_DARK else KEY_PLAIN
    val spoken = run {
        // Spoken per-board summary, e.g. "A, board 1 correct, board 3 not in word".
        val parts = cellStates.mapIndexedNotNull { i, st ->
            tileStateName(st).takeIf { it.isNotEmpty() }?.let { "board ${i + 1} $it" }
        }
        if (parts.isEmpty()) letter else "$letter, ${parts.joinToString(", ")}"
    }

    Box(
        modifier = Modifier
            .weight(1f)
            .height(h)
            .squishClickable(spoken, onClick = onClick)
            .keyTile(look),
        contentAlignment = Alignment.Center,
    ) {
        if (!allAbsent && hasAny) {
            // Sub-cell grid on the key's face.
            Column(Modifier.fillMaxSize().padding(bottom = KEY_LIP).clip(RoundedCornerShape(KEY_CORNER))) {
                for (r in 0 until rows) {
                    Row(Modifier.weight(1f).fillMaxWidth()) {
                        for (c in 0 until cols) {
                            val idx = r * cols + c
                            val st = cellStates.getOrElse(idx) { TileState.EMPTY }
                            Box(Modifier.weight(1f).fillMaxSize().background(quadColor(st)))
                        }
                    }
                }
            }
        }
        Text(
            letter,
            color = if (hasAny) Color.White else look.ink,
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
            modifier = Modifier.padding(bottom = KEY_LIP),
            // Web: text-shadow on the overlaid letter so it reads over sub-cells.
            style = if (hasAny) TextStyle(shadow = Shadow(Color(0x80000000), blurRadius = 3f)) else TextStyle.Default,
        )
    }
}

/** Board-tile palette for quadrant sub-cells (NOT the darker key palette).
 *  Colorblind-aware — web's [data-colorblind] overrides recolor these cells too. */
private fun quadColor(state: TileState): Color = when (state) {
    TileState.CORRECT -> if (WTheme.colorblind) Color(0xFFF5793A) else Color(0xFF7C3AED)
    TileState.PRESENT, TileState.HINT_USED -> if (WTheme.colorblind) Color(0xFF85C0F9) else Color(0xFFF5A524)
    TileState.ABSENT -> Color(0xFF6B7891)
    TileState.EMPTY -> Color.Transparent
}

/**
 * B2 a letter key: a tile (lilac lip, light face, dark purple Nunito Black letter)
 * that takes its state colors after a reveal; squishes on press (A9).
 */
@Composable
private fun RowScope.LetterKey(label: String, state: TileState, h: androidx.compose.ui.unit.Dp, onClick: () -> Unit, fill: Color? = null) {
    val look = if (fill != null) keyLookFill(fill) else keyLookFor(state)
    val stateName = if (fill != null) "used" else tileStateName(state)
    Box(
        modifier = Modifier
            .weight(1f)
            .height(h)
            .squishClickable(if (stateName.isEmpty()) label else "$label, $stateName", onClick = onClick)
            .keyTile(look),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = look.ink,
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
            modifier = Modifier.padding(bottom = KEY_LIP),
        )
    }
}

/** B2 the chunky purple backspace (game-kit.html's delete key glyph, viewBox 32 × 24). */
private val BACKSPACE_BODY = androidx.compose.ui.graphics.vector.PathParser()
    .parsePathString("M10.2 2.5h17.3a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H10.2a3 3 0 0 1-2.3-1.1L2.2 13.9a3 3 0 0 1 0-3.8L7.9 3.6a3 3 0 0 1 2.3-1.1z")
    .toPath()

@Composable
private fun ChunkyBackspace(width: androidx.compose.ui.unit.Dp) {
    androidx.compose.foundation.Canvas(Modifier.size(width, width * 0.75f)) {
        val k = size.width / 32f
        val body = androidx.compose.ui.graphics.Path().apply { addPath(BACKSPACE_BODY) }
        drawContext.canvas.save()
        drawContext.canvas.scale(k, k)
        // A faint white highlight under the body (drop-shadow 0 1 0 white 60%).
        drawContext.canvas.translate(0f, 1f)
        drawPath(body, Color.White.copy(alpha = 0.6f))
        drawContext.canvas.translate(0f, -1f)
        drawPath(body, Color(0xFF5B2BB5))
        val stroke = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawLine(Color.White, androidx.compose.ui.geometry.Offset(15.2f, 8.3f), androidx.compose.ui.geometry.Offset(22.6f, 15.7f), strokeWidth = stroke.width, cap = stroke.cap)
        drawLine(Color.White, androidx.compose.ui.geometry.Offset(22.6f, 8.3f), androidx.compose.ui.geometry.Offset(15.2f, 15.7f), strokeWidth = stroke.width, cap = stroke.cap)
        drawContext.canvas.restore()
    }
}

// Action keys (B2): the same key tile; Delete = the chunky purple backspace, ENTER = a 12 sp label.
@Composable
private fun RowScope.WideKey(label: String, h: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    val look = if (WTheme.isDark) KEY_PLAIN_DARK else KEY_PLAIN
    Box(
        modifier = Modifier
            .weight(1.7f)
            .height(h)
            .squishClickable(if (label == "BACK") "Delete" else "Submit guess", onClick = onClick)
            .keyTile(look),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.padding(bottom = KEY_LIP), contentAlignment = Alignment.Center) {
            if (label == "BACK") {
                ChunkyBackspace(30.dp)
            } else {
                // Never let this key wrap; shrinks to fit at a large font scale ("ENTEF" — Doug, 2026-09-27).
                com.wordocious.app.ui.FitText(
                    label,
                    fontSize = 12.sp,
                    color = look.ink,
                    fontWeight = FontWeight.Black,
                )
            }
        }
    }
}
