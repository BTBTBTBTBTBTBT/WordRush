package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
 * On-screen keyboard — matches the web `keyboard.tsx`.
 * - QWERTY / ASDFGHJKL / ZXCVBNM rows
 * - Delete (⌫) on the left of the last row; Enter (↵) on the right
 * - Keys coloured by the best known letter state (combined across all playing boards)
 * - web key palette: keyCorrect = green-600, keyPresent = yellow-600, keyAbsent = gray-400,
 *   keyDefault = #e8e5f0 (light purple-tinted)
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
        verticalArrangement = Arrangement.spacedBy(5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ROWS.forEachIndexed { rowIdx, row ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (rowIdx == 2) KeyButton("⌫", wide = true) { onDelete() }

                row.forEach { ch ->
                    val state = letterStates[ch.toString()] ?: TileState.EMPTY
                    KeyButton(ch.toString(), keyBg = WTheme.keyColor(state)) { onKey(ch) }
                }

                if (rowIdx == 2) KeyButton("↵", wide = true) { onEnter() }
            }
        }
    }
}

@Composable
private fun KeyButton(
    label: String,
    wide: Boolean = false,
    keyBg: Color = WTheme.keyDefault,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .width(if (wide) 46.dp else 30.dp)
            .height(44.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(keyBg)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (keyBg == WTheme.keyDefault) WTheme.text else Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = if (wide) 13.sp else 14.sp,
        )
    }
}
