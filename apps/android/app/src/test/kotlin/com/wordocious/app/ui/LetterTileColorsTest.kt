package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** ART_SPEC §20 — the letter-tile avatar's color pick + initials. */
class LetterTileColorsTest {
    @Test fun castLettersUseCastColors() {
        assertEquals("#8B2CF5", LetterTileColors.baseHex("wordsmith"))
        assertEquals("#FF2F91", LetterTileColors.baseHex("Olive"))
        assertEquals("#8E96A8", LetterTileColors.baseHex("rex"))
        assertEquals("#0A6CFF", LetterTileColors.baseHex("Dot"))
        assertEquals("#00B4BE", LetterTileColors.baseHex("cy"))
        assertEquals("#4CC77A", LetterTileColors.baseHex("Ivy"))
        assertEquals("#9B3DF3", LetterTileColors.baseHex("uma"))
        assertEquals("#F5A623", LetterTileColors.baseHex("Sam"))
    }

    @Test fun otherLettersUsePaletteByCharCodeMod9() {
        // 'A' = 65, 65 mod 9 = 2 → palette[2].
        assertEquals("#0A6CFF", LetterTileColors.baseHex("alice"))
        // 'B' = 66 → 3, 'Z' = 90 → 0.
        assertEquals("#FF2F91", LetterTileColors.baseHex("bob"))
        assertEquals("#8B2CF5", LetterTileColors.baseHex("Zed"))
        // Digits follow the same rule: '7' = 55 → 1.
        assertEquals("#FF9F1A", LetterTileColors.baseHex("7even"))
    }

    @Test fun accentWins() {
        assertEquals("#2563EB", LetterTileColors.baseHex("wordsmith", "#2563EB"))
        assertEquals("#0D9488", LetterTileColors.baseHex("alice", "#0d9488"))
        // The default purple swatch counts when stored explicitly.
        assertEquals("#7C3AED", LetterTileColors.baseHex("alice", "#7C3AED"))
        // Only palette swatches win: an off-palette hex falls back to the letter.
        assertEquals("#8B2CF5", LetterTileColors.baseHex("wordsmith", "#123456"))
        assertEquals("#0A6CFF", LetterTileColors.baseHex("alice", "#FF0000"))
        // Blank / malformed accent falls back to the letter.
        assertEquals("#8B2CF5", LetterTileColors.baseHex("wordsmith", ""))
        assertEquals("#8B2CF5", LetterTileColors.baseHex("wordsmith", null))
        assertEquals("#8B2CF5", LetterTileColors.baseHex("wordsmith", "nope"))
    }

    @Test fun initials() {
        assertEquals("WO", LetterTileColors.initials("wordsmith"))
        assertEquals("Q", LetterTileColors.initials("q"))
        assertEquals("A", LetterTileColors.initials(" a "))
        assertEquals("?", LetterTileColors.initials(""))
        assertEquals("?", LetterTileColors.initials(null))
    }

    @Test fun shading() {
        assertEquals(0x000000, LetterTileColors.darken(0x000000, 0.22f))
        assertEquals(0xFFFFFF, LetterTileColors.lighten(0xFFFFFF, 0.18f))
        assertEquals(0x646464, LetterTileColors.darken(0x808080, 0.22f))   // 128 × 0.78 = 99.84 → 100
    }
}
