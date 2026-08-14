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
    // iOS parity (KeyboardView.swift): playKeyTap on EVERY key, and the SAME
    // light `Haptics.tap()` on letters, ⌫ and ENTER alike.
    val haptics = LocalHapticFeedback.current
    val layout = KeyboardLayoutPref.value
    // Michael Keyboard is a row taller — shorter keys keep total height close
    // to the 3-row layouts so tight boards (OctoWord) don't squeeze.
    val keyH = if (layout == "michael") 44.dp else 52.dp
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
        verticalArrangement = Arrangement.spacedBy(7.dp), // spec row spacing 7
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ROWS.forEachIndexed { rowIdx, row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(5.dp), // spec key spacing 5
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
                    if (perBoardStates != null) {
                        QuadrantKey(ch.toString(), perBoardStates, keyH, tap)
                    } else {
                        val state = letterStates[ch.toString()] ?: TileState.EMPTY
                        LetterKey(ch.toString(), WTheme.keyColor(state), state, keyH, tap)
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

/** Decorative space bar (§213): reacts like a key, does nothing. */
@Composable
private fun RowScope.SpaceKey(h: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(4f)
            .height(h)
            .clip(RoundedCornerShape(6.dp))
            .background(WTheme.keyDefault)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(6.dp))
            .semantics { role = Role.Button; contentDescription = "Space (decorative)" }
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text("space", color = Color(0xFF8A86A0), fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
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
    h: androidx.compose.ui.unit.Dp,
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
            .height(h)
            .clip(RoundedCornerShape(6.dp))
            .background(if (allAbsent) Color(0xFF9CA3AF) else WTheme.keyDefault)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(6.dp))
            .semantics {
                role = Role.Button
                // Spoken per-board summary, e.g. "A, board 1 correct, board 3 not in word".
                val parts = cellStates.mapIndexedNotNull { i, st ->
                    tileStateName(st).takeIf { it.isNotEmpty() }?.let { "board ${i + 1} $it" }
                }
                contentDescription = if (parts.isEmpty()) letter else "$letter, ${parts.joinToString(", ")}"
            }
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
    TileState.CORRECT -> if (WTheme.colorblind) Color(0xFFF5793A) else Color(0xFF7C3AED)
    TileState.PRESENT, TileState.HINT_USED -> if (WTheme.colorblind) Color(0xFF85C0F9) else Color(0xFFF59E0B)
    TileState.ABSENT -> WTheme.keyAbsent
    TileState.EMPTY -> Color(0xFFE8E5F0)
}

// Keyboard letter key: 52 tall, rounded6, Nunito bold 18. iOS letterKey
// (KeyboardView.swift:46-51) is a flat fill with NO stroke — only the wide
// action keys and the quadrant keys are stroked.
@Composable
private fun RowScope.LetterKey(label: String, bg: Color, state: TileState, h: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    val unstated = bg == WTheme.keyDefault
    val stateName = tileStateName(state)
    Box(
        modifier = Modifier
            .weight(1f)
            .height(h)
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .semantics {
                role = Role.Button
                contentDescription = if (stateName.isEmpty()) label else "$label, $stateName"
            }
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            // Fixed ink on the fixed key surface — WTheme.text is near-white
            // in Dark and disappeared against it.
            color = if (unstated) WTheme.keyInk else Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
        )
    }
}

// Action keys — web: BACK = lucide Delete (backspace) icon, ENTER = text, font-black.
@Composable
private fun RowScope.WideKey(label: String, h: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(1.7f)
            .height(h)
            .clip(RoundedCornerShape(6.dp))
            .background(WTheme.keyDefault)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(6.dp))
            .semantics {
                role = Role.Button
                contentDescription = if (label == "BACK") "Delete" else "Submit guess"
            }
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (label == "BACK") {
            Icon(Icons.AutoMirrored.Outlined.Backspace, contentDescription = "Backspace", tint = WTheme.keyInk, modifier = Modifier.size(20.dp))
        } else {
            // maxLines/softWrap + a slightly smaller face: "ENTER" wrapped to
            // "ENTE / R" on a Galaxy S23, where the key is narrower than the
            // label at 14sp. Never let this key wrap.
            Text(
                label,
                color = WTheme.keyInk,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 13.sp,
                maxLines = 1,
                softWrap = false,
            )
        }
    }
}
