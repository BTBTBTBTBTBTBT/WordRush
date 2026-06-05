package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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
) {
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
                if (rowIdx == 2) WideKey("⌫") { onDelete() }
                row.forEach { ch ->
                    val state = letterStates[ch.toString()] ?: TileState.EMPTY
                    LetterKey(ch.toString(), WTheme.keyColor(state)) { onKey(ch) }
                }
                if (rowIdx == 2) WideKey("↵") { onEnter() }
            }
        }
    }
}

// Spec Part 2 Keyboard: letter key 52 tall, rounded6, Nunito Bold 18;
// action keys keyDefault #E8E5F0, Bold 14.
@Composable
private fun RowScope.LetterKey(label: String, bg: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(1f)
            .height(52.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (bg == WTheme.keyDefault) WTheme.text else Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
        )
    }
}

@Composable
private fun RowScope.WideKey(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(1.5f)
            .height(52.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(WTheme.keyDefault)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = WTheme.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}
