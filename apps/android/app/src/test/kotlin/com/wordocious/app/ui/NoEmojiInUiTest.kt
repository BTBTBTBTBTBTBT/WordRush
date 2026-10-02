package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * FINISH_SPEC AL addendum 2 + AM3: no system emoji anywhere in the app UI — every icon is
 * our 3D art (GlyphArt / Icon3D / ReactionGlyph). Emoji are allowed only in plain-text
 * channels that can't show images: share captions, push notification text and the
 * message text sent to friends. This scans every Kotlin source (comments excluded) and
 * the string / layout resources for emoji code points outside the allowlist below.
 */
class NoEmojiInUiTest {
    private val kotlinRoot = File("src/main/kotlin/com/wordocious/app")
    private val resRoot = File("src/main/res")

    /**
     * path (relative to [kotlinRoot]) -> the only lines that may carry emoji there (null =
     * the whole file). Keep this list short and say why.
     */
    private val allow: Map<String, Regex?> = mapOf(
        // Share caption text (the emoji grid / ✅ ❌ / ⏱ lines of the copied result).
        "data/ShareHelper.kt" to null,
        // Push notification text.
        "data/NotificationService.kt" to null,
        // The canned taunts are message text (they travel as the friend's push, mirrored
        // with apps/web/lib/friends-taunts.ts); the UI shows them through withoutEmoji().
        "data/FriendsService.kt" to Regex("""^\s*Taunt\("""),
        // Parses stored Scramble guess codes ("3✓"), never shown.
        "data/ModeStats.kt" to Regex("""SCRAMBLE_SOLVED"""),
        // Starsweep demo tokens; GuideSheet draws the board's star art for them.
        "ui/game/GuideSteps.kt" to Regex("""STAR_TOKEN|^\s*step\("""),
    )

    private fun codePoints(s: String): List<Int> {
        val out = ArrayList<Int>()
        var i = 0
        while (i < s.length) {
            val cp = s.codePointAt(i)
            out += cp
            i += Character.charCount(cp)
        }
        return out
    }

    /** [line] with // and /* */ comments removed ([inBlock] carries a block comment across lines). */
    private fun stripComments(line: String, inBlock: BooleanArray): String {
        val sb = StringBuilder()
        var i = 0
        var quotes = 0
        while (i < line.length) {
            if (inBlock[0]) {
                val end = line.indexOf("*/", i)
                if (end < 0) return sb.toString()
                inBlock[0] = false
                i = end + 2
                continue
            }
            if (quotes % 2 == 0 && line.startsWith("/*", i)) { inBlock[0] = true; i += 2; continue }
            if (quotes % 2 == 0 && line.startsWith("//", i)) return sb.toString()
            val c = line[i]
            if (c == '"' && (i == 0 || line[i - 1] != '\\')) quotes++
            sb.append(c)
            i++
        }
        return sb.toString()
    }

    /** \uXXXX escapes that spell an emoji (incl. surrogate halves of a pictograph). */
    private fun escapedEmoji(code: String): Boolean =
        Regex("""\\u([0-9A-Fa-f]{4})""").findAll(code).any {
            val cp = it.groupValues[1].toInt(16)
            EmojiRanges.isEmoji(cp) || cp in 0xD83C..0xD83E
        }

    @Test
    fun no_emoji_in_app_sources_outside_the_allowlist() {
        assertTrue("run from the app module", kotlinRoot.isDirectory)
        val hits = mutableListOf<String>()
        kotlinRoot.walkTopDown().filter { it.isFile && it.extension == "kt" }.forEach { f ->
            val rel = f.relativeTo(kotlinRoot).invariantSeparatorsPath
            val inBlock = booleanArrayOf(false)
            f.readLines().forEachIndexed { n, line ->
                val code = stripComments(line, inBlock)
                val bad = codePoints(code).any { EmojiRanges.isEmoji(it) } || escapedEmoji(code)
                if (!bad) return@forEachIndexed
                if (allow.containsKey(rel)) {
                    val rule = allow[rel]
                    if (rule == null || rule.containsMatchIn(line)) return@forEachIndexed
                }
                hits += "$rel:${n + 1}: ${line.trim()}"
            }
        }
        assertTrue(
            "System emoji in app UI (use GlyphArt / Icon3D / ReactionGlyph art or plain words — FINISH_SPEC AL addendum 2 / AM3):\n" +
                hits.joinToString("\n"),
            hits.isEmpty(),
        )
    }

    @Test
    fun no_emoji_in_string_or_layout_resources() {
        val hits = mutableListOf<String>()
        resRoot.listFiles()?.filter { it.isDirectory && (it.name.startsWith("values") || it.name.startsWith("layout") || it.name == "xml") }
            ?.forEach { dir ->
                dir.listFiles()?.filter { it.extension == "xml" }?.forEach { f ->
                    f.readLines().forEachIndexed { n, line ->
                        if (codePoints(line).any { EmojiRanges.isEmoji(it) }) hits += "${dir.name}/${f.name}:${n + 1}: ${line.trim()}"
                    }
                }
            }
        assertTrue("System emoji in resources:\n" + hits.joinToString("\n"), hits.isEmpty())
    }

    @Test
    fun emoji_ranges_cover_the_icons_and_spare_typography() {
        listOf("🔥", "⭐", "✓", "✗", "🏆", "🏅", "🛡", "👑", "⚡", "🎯", "💎", "🧹", "🎁", "👏", "💡", "⏱", "📋", "★", "⚔", "🥇", "🔒", "😈", "🟩")
            .forEach { e -> assertTrue(e, EmojiRanges.isEmoji(e.codePointAt(0))) }
        listOf("’", "…", "·", "–", "—", "×", "→", "≈", "∞", "●", "▾", "▲", "─", "“", "é")
            .forEach { t -> assertFalse(t, EmojiRanges.isEmoji(t.codePointAt(0))) }
    }

    @Test
    fun without_emoji_keeps_the_words() {
        assertEquals("Swept it. Your move.", withoutEmoji("🧹 Swept it. Your move."))
        assertEquals("The crown stays here", withoutEmoji("👑 The crown stays here"))
        assertEquals("Hey! Glad we're friends — game on.", withoutEmoji("👋 Hey! Glad we're friends — game on."))
        assertEquals("Day 12", withoutEmoji("🔥 Day 12"))
        assertEquals("Shield", withoutEmoji("🛡️ Shield"))
        assertEquals("plain text", withoutEmoji("plain text"))
    }

    @Test
    fun reactions_have_words_never_emoji() {
        listOf("clap", "fire", "wow", "grr", "rematch", "heart").forEach { k ->
            val w = ReactionArt.word(k)
            assertTrue(k, w.isNotBlank())
            assertFalse(k, codePoints(w).any { EmojiRanges.isEmoji(it) })
        }
        assertEquals("Clap!", ReactionArt.word("clap"))
        assertEquals("Rematch", ReactionArt.word("rematch"))
        assertEquals("Love!", ReactionArt.word("heart"))
        assertEquals("Wow", ReactionArt.spoken("wow"))
    }
}
