package com.wordocious.app.ui.game

import androidx.compose.foundation.focusable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.key.utf16CodePoint

/**
 * Physical keyboard support (founder, 2026-09-30; iOS parity — Chromebooks, tablets with a
 * keyboard, Bluetooth keyboards). Every game used to react only to the on-screen KeyboardView.
 *
 * One key press, decoded. Mirrors the web boards' window `keydown` handlers (apps/web
 * components/<game>/<game>-game.tsx): letters, digits, Enter, Backspace/Delete, arrows, Tab,
 * Space and Ctrl/Cmd+Z. Anything else with Ctrl/Cmd/Alt held is left alone (system shortcuts).
 */
sealed interface HwKey {
    data class Letter(val ch: Char) : HwKey // always uppercase A–Z
    data class Digit(val n: Int) : HwKey // 0–9
    data object Enter : HwKey
    data object Backspace : HwKey
    data object Delete : HwKey // forward delete
    data object Up : HwKey
    data object Down : HwKey
    data object Left : HwKey
    data object Right : HwKey
    data object Tab : HwKey
    data object Space : HwKey
    data object Undo : HwKey // Ctrl/Cmd+Z

    /** Backspace and forward Delete both erase, as on the web. */
    val isErase: Boolean get() = this == Backspace || this == Delete
}

/** Decodes a KeyDown into an [HwKey]; null for key-ups and keys no game uses. Pure — unit-tested. */
fun decodeHwKey(
    key: Key,
    char: Int,
    ctrl: Boolean,
    meta: Boolean,
    alt: Boolean,
): HwKey? {
    if ((ctrl || meta) && !alt && (key == Key.Z || char == 'z'.code || char == 'Z'.code || char == 26)) return HwKey.Undo
    if (ctrl || meta || alt) return null
    when (key) {
        Key.Enter, Key.NumPadEnter -> return HwKey.Enter
        Key.Backspace -> return HwKey.Backspace
        Key.Delete -> return HwKey.Delete
        Key.DirectionUp -> return HwKey.Up
        Key.DirectionDown -> return HwKey.Down
        Key.DirectionLeft -> return HwKey.Left
        Key.DirectionRight -> return HwKey.Right
        Key.Tab -> return HwKey.Tab
        Key.Spacebar -> return HwKey.Space
    }
    // The printed character follows the keyboard's layout (AZERTY etc.), like the web's e.key.
    val c = char.toChar()
    if (c in 'a'..'z' || c in 'A'..'Z') return HwKey.Letter(c.uppercaseChar())
    if (c in '0'..'9') return HwKey.Digit(c - '0')
    return null
}

private fun KeyEvent.toHwKey(): HwKey? {
    if (type != KeyEventType.KeyDown) return null
    return decodeHwKey(key, utf16CodePoint, isCtrlPressed, isMetaPressed, isAltPressed)
}

/**
 * Makes this (the game screen's root) a focus target that hears a physical keyboard, and takes
 * focus whenever [enabled] turns true (the board shows, an overlay closes). [onKey] returns true
 * when it used the key; unused keys fall through to the system (focus navigation, Back, …).
 *
 * - Finished games / overlays pass `enabled = false`, so the board goes inert.
 * - Dialogs and sheets are separate windows: their keys never reach this node.
 * - A real text field focused under this root keeps its keys (the web's `isTypingTarget`):
 *   games that host one pass [yieldTo] = true while it has focus.
 */
@Composable
fun Modifier.hardwareKeys(
    enabled: Boolean,
    yieldTo: Boolean = false,
    onKey: (HwKey) -> Boolean,
): Modifier {
    val requester = remember { FocusRequester() }
    val latestOnKey by rememberUpdatedState(onKey)
    val latestEnabled by rememberUpdatedState(enabled)
    val latestYield by rememberUpdatedState(yieldTo)
    LaunchedEffect(enabled) {
        if (enabled) runCatching { requester.requestFocus() }
    }
    return this
        .focusRequester(requester)
        .onPreviewKeyEvent { ev ->
            if (!latestEnabled || latestYield) return@onPreviewKeyEvent false
            val k = ev.toHwKey() ?: return@onPreviewKeyEvent false
            latestOnKey(k)
        }
        .focusable()
}

/**
 * The common case: a game driven by [KeyboardView] — A–Z types, Enter submits, Backspace/Delete
 * erases, each exactly like tapping that key (the same callbacks, the same key-tap sound).
 * [letterAllowed] mirrors a key the game disables or ignores.
 */
fun keyboardViewKeys(
    onKey: (Char) -> Unit,
    onDelete: () -> Unit,
    onEnter: () -> Unit,
    letterAllowed: (Char) -> Boolean = { true },
): (HwKey) -> Boolean = { k ->
    when {
        k is HwKey.Letter -> {
            if (letterAllowed(k.ch)) {
                com.wordocious.app.data.SoundManager.playKeyTap()
                onKey(k.ch)
            }
            true
        }
        k == HwKey.Enter -> { com.wordocious.app.data.SoundManager.playKeyTap(); onEnter(); true }
        k.isErase -> { com.wordocious.app.data.SoundManager.playKeyTap(); onDelete(); true }
        else -> false
    }
}
