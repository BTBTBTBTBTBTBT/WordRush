package com.wordocious.app.data

/**
 * FINISH_SPEC BI25: the live previews on the Settings THEME / KEYBOARD tiles and the
 * single-fire rule for the header buttons that open Settings / Help. Parity: iOS
 * Core `SettingsPreviews` (SettingsPreviewsTests), web `lib/settings-previews.ts`.
 */
object SettingsPreviews {
    data class Tile(val letter: String, val hex: Int)
    data class ThemeSpec(val page: Int, val tiles: List<Tile>)

    const val WORD = "WORD"

    /** Four mini glossy tiles in the theme's colors on its page wash ("light" = Default). */
    fun theme(key: String): ThemeSpec {
        val (page, colors) = when (key) {
            "dark" -> 0x1A1A2E to listOf(0x7C3AED, 0xF59E0B, 0x4C1D95, 0x475569)
            "ocean" -> 0xE3F0F7 to listOf(0x0EA5E9, 0x14B8A6, 0x0369A1, 0x67C6E3)
            "forest" -> 0xE8F2E4 to listOf(0x16A34A, 0xB45309, 0x166534, 0x84A98C)
            else -> 0xF3F0FF to listOf(0x7C3AED, 0xF59E0B, 0x7C3AED, 0x94A3B8)
        }
        return ThemeSpec(page, WORD.map { it.toString() }.zip(colors) { l, c -> Tile(l, c) })
    }

    const val ENTER = "ENTER"
    const val DELETE = "DEL"
    const val SPACE = "SPACE"

    /** The mini key rows: where Enter and Delete sit (the Z row; Michael adds a 4th row). */
    fun keyRows(layout: String): List<List<String>> {
        val letters = listOf("Z", "X", "C", "V")
        return when (layout) {
            "flipped" -> listOf(listOf(DELETE) + letters + ENTER)
            "michael" -> listOf(listOf(DELETE) + letters + DELETE, listOf(ENTER, SPACE, ENTER))
            else -> listOf(listOf(ENTER) + letters + DELETE)
        }
    }

    /** Repeat taps within this window are the same tap. */
    const val SHEET_DEBOUNCE_MS = 600L

    /** Whether a sheet-opening tap fires: never while one is up, never within the debounce. */
    fun sheetTapFires(nowMs: Long, lastFireMs: Long?, presenting: Boolean): Boolean {
        if (presenting) return false
        if (lastFireMs == null) return true
        val dt = nowMs - lastFireMs
        return dt < 0 || dt >= SHEET_DEBOUNCE_MS
    }
}
