package com.wordocious.app.ui

import androidx.compose.ui.input.key.Key
import com.wordocious.app.ui.game.HwKey
import com.wordocious.app.ui.game.decodeHwKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Physical keyboard decoding (founder, 2026-09-30) — mirrors the web boards' keydown handlers. */
class HardwareKeysTest {
    private fun d(key: Key, ch: Char? = null, ctrl: Boolean = false, meta: Boolean = false, alt: Boolean = false) =
        decodeHwKey(key, ch?.code ?: 0, ctrl, meta, alt)

    @Test fun lettersUppercaseFromThePrintedCharacter() {
        assertEquals(HwKey.Letter('A'), d(Key.A, 'a'))
        assertEquals(HwKey.Letter('A'), d(Key.A, 'A'))
        // AZERTY: the key in QWERTY's Q position prints 'a'.
        assertEquals(HwKey.Letter('A'), d(Key.Q, 'a'))
    }

    @Test fun digitsAndEditingKeys() {
        assertEquals(HwKey.Digit(7), d(Key.Seven, '7'))
        assertEquals(HwKey.Digit(0), d(Key.Zero, '0'))
        assertEquals(HwKey.Enter, d(Key.Enter, '\n'))
        assertEquals(HwKey.Enter, d(Key.NumPadEnter))
        assertEquals(HwKey.Backspace, d(Key.Backspace))
        assertEquals(HwKey.Delete, d(Key.Delete))
        assertEquals(HwKey.Up, d(Key.DirectionUp))
        assertEquals(HwKey.Right, d(Key.DirectionRight))
        assertEquals(HwKey.Tab, d(Key.Tab, '\t'))
        assertEquals(HwKey.Space, d(Key.Spacebar, ' '))
    }

    @Test fun modifiersLeaveKeysToTheSystemExceptUndo() {
        assertEquals(HwKey.Undo, d(Key.Z, 'z', ctrl = true))
        assertEquals(HwKey.Undo, d(Key.Z, 'z', meta = true))
        assertNull(d(Key.A, 'a', ctrl = true))
        assertNull(d(Key.Enter, alt = true))
        assertNull(d(Key.Escape))
        assertNull(d(Key.Comma, ','))
    }
}
