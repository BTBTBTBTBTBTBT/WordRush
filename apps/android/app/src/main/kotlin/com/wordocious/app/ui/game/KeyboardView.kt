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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState

private val ROWS = listOf("QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM")

/**
 * On-screen keyboard — audit-then-match of the web `keyboard.tsx`.
 * - 3 QWERTY rows; ⌫ left of bottom row, ↵ right
 * - Keys are responsive: each letter key gets equal width (weight 1f),
 *   wide keys get weight 1.5f — exactly like the web's flex-equal layout.
 * - Key height is 48dp (matches the web's h-14 ≈ 56px / ~42dp native).
 * - Letter-state colouring: CORRECT=green-600, PRESENT=yellow-600,
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
) {
    // Web parity (keyboard.tsx): light haptic on letters, medium on ENTER, none on BACK.
    val haptics = LocalHapticFeedback.current
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp), // spec row spacing 7
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ROWS.forEachIndexed { rowIdx, row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(5.dp), // spec key spacing 5
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (rowIdx == 2) WideKey("BACK") { onDelete() }
                row.forEach { ch ->
                    val tap = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onKey(ch)
                    }
                    if (perBoardStates != null) {
                        QuadrantKey(ch.toString(), perBoardStates, tap)
                    } else {
                        val state = letterStates[ch.toString()] ?: TileState.EMPTY
                        LetterKey(ch.toString(), WTheme.keyColor(state), tap)
                    }
                }
                if (rowIdx == 2) WideKey("ENTER") {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onEnter()
                }
            }
        }
    }
}

/**
 * Quadrant key — per spec Part 2: a grid of sub-cells (cols 2 for ≤4 boards, 4
 * for octo), each colored by that board's letter state (board-tile 500 palette).
 * All-absent → solid gray. Letter overlaid; white (w/ shadow) if any board has
 * info, else dark gray.
 */
@Composable
private fun RowScope.QuadrantKey(
    letter: String,
    perBoardStates: List<Map<String, TileState>>,
    onClick: () -> Unit,
) {
    val n = perBoardStates.size
    val cols = if (n <= 4) 2 else 4
    val rows = (n + cols - 1) / cols
    val cellStates = perBoardStates.map { it[letter] ?: TileState.EMPTY }
    val hasAny = cellStates.any { it != TileState.EMPTY }
    val allAbsent = cellStates.isNotEmpty() && cellStates.all { it == TileState.ABSENT }

    Box(
        modifier = Modifier
            .weight(1f)
            .height(52.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(if (allAbsent) Color(0xFF9CA3AF) else WTheme.keyDefault)
            .border(1.5.dp, WTheme.borderAlt, RoundedCornerShape(6.dp))
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (!allAbsent && hasAny) {
            // Sub-cell grid
            Column(Modifier.fillMaxSize()) {
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
            color = if (hasAny) Color.White else Color(0xFF374151),
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            // Web: text-shadow on the overlaid letter so it reads over sub-cells.
            style = if (hasAny) TextStyle(shadow = Shadow(Color(0x80000000), blurRadius = 3f)) else TextStyle.Default,
        )
    }
}

/** Board-tile (500) palette for quadrant sub-cells (NOT the darker key palette).
 *  Colorblind-aware — web's [data-colorblind] overrides recolor these cells too. */
private fun quadColor(state: TileState): Color = when (state) {
    TileState.CORRECT -> if (WTheme.colorblind) Color(0xFFF5793A) else Color(0xFF22C55E)
    TileState.PRESENT, TileState.HINT_USED -> if (WTheme.colorblind) Color(0xFF85C0F9) else Color(0xFFEAB308)
    TileState.ABSENT -> Color(0xFF9CA3AF)
    TileState.EMPTY -> Color(0xFFE8E5F0)
}

// Spec Part 2 Keyboard: letter key 52 tall, rounded6, Nunito font-black 18;
// unstated keys get a 1.5px border (web: `1.5px solid var(--color-border)`);
// colored (stated) keys are borderless — exactly like keyboard.tsx.
@Composable
private fun RowScope.LetterKey(label: String, bg: Color, onClick: () -> Unit) {
    val unstated = bg == WTheme.keyDefault
    Box(
        modifier = Modifier
            .weight(1f)
            .height(52.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .then(if (unstated) Modifier.border(1.5.dp, WTheme.borderAlt, RoundedCornerShape(6.dp)) else Modifier)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (unstated) WTheme.text else Color.White,
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
        )
    }
}

// Action keys — web: BACK = lucide Delete (backspace) icon, ENTER = text, font-black.
@Composable
private fun RowScope.WideKey(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(1.5f)
            .height(52.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(WTheme.keyDefault)
            .border(1.5.dp, WTheme.borderAlt, RoundedCornerShape(6.dp))
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (label == "BACK") {
            Icon(Icons.AutoMirrored.Outlined.Backspace, contentDescription = "Backspace", tint = WTheme.text, modifier = Modifier.size(20.dp))
        } else {
            Text(label, color = WTheme.text, fontWeight = FontWeight.Black, fontSize = 13.sp)
        }
    }
}
