package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.text.Normalizer

/**
 * ProperNoundle — a SEPARATE engine (not the reducer). A guess-the-name game:
 * the answer is a normalized name ("taylorswift"), tiles colour like Wordle, the
 * board lays out word groups from `display` ("Taylor Swift" → 6+5).
 * 1:1 port of iOS `ProperNoundleEngine.swift` / web components/propernoundle/.
 */
@Serializable
data class NPuzzle(
    val id: String,
    val answer: String,
    val display: String,
    val category: String,
    val themeCategory: String? = null,
    val hint: String? = null,
    val wikiTitle: String? = null,
)

object ProperNoundle {
    const val MAX_GUESSES = 6
    private const val EPOCH = "2024-01-01"
    private const val MAX_ANSWER_LENGTH = 15

    private val json = Json { ignoreUnknownKeys = true }

    private val all: List<NPuzzle> by lazy {
        val text = javaClass.classLoader
            ?.getResourceAsStream("data/propernoundle-puzzles.json")
            ?.bufferedReader()?.use { it.readText() } ?: return@lazy emptyList()
        runCatching { json.decodeFromString<List<NPuzzle>>(text) }
            .getOrElse { emptyList() }
            .filter { it.answer.length <= MAX_ANSWER_LENGTH }
    }

    private val byCategory: Map<String, List<NPuzzle>> by lazy {
        all.groupBy { it.themeCategory ?: "general" }
    }
    private val categoryCycle: List<String> by lazy { byCategory.keys.sorted() }

    /** lowercase, strip diacritics + spaces, keep alnum + ' + - (mirrors normalizeString). */
    fun normalize(s: String): String {
        val folded = Normalizer.normalize(s, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")  // drop combining diacritical marks
            .lowercase()
        return folded.filter { it.isLetterOrDigit() || it == '\'' || it == '-' }
    }

    /** Tile states for a guess vs answer (Wordle two-pass), length-gated. */
    fun evaluate(guess: String, answer: String): List<TileState> {
        val g = normalize(guess).toCharArray()
        val a = normalize(answer).toCharArray()
        if (g.size != a.size) return List(g.size) { TileState.ABSENT }
        val result = Array(g.size) { TileState.ABSENT }
        val used = BooleanArray(a.size)
        for (i in g.indices) if (g[i] == a[i]) { result[i] = TileState.CORRECT; used[i] = true }
        for (i in g.indices) if (result[i] != TileState.CORRECT) {
            for (j in a.indices) if (!used[j] && a[j] == g[i]) { result[i] = TileState.PRESENT; used[j] = true; break }
        }
        return result.toList()
    }

    fun isWin(tiles: List<TileState>): Boolean = tiles.isNotEmpty() && tiles.all { it == TileState.CORRECT }

    /** Word lengths from the display string (for the tile-group layout). */
    fun wordGroups(display: String): List<Int> {
        val groups = display.split(" ").map { normalize(it).length }.filter { it > 0 }
        return if (groups.isEmpty()) listOf(normalize(display).length) else groups
    }

    /** Daily puzzle — alphabetical category round-robin (epoch 2024-01-01 UTC). */
    fun dailyPuzzle(date: String): NPuzzle? {
        if (categoryCycle.isEmpty()) return null
        val day = daysSinceEpoch(date)
        val catIdx = ((day % categoryCycle.size) + categoryCycle.size) % categoryCycle.size
        val cat = categoryCycle[catIdx]
        val list = byCategory[cat] ?: return null
        if (list.isEmpty()) return null
        val idx = (day / categoryCycle.size) % list.size
        return list[maxOf(0, idx)]
    }

    /** Deterministic puzzle from a VS seed (FNV-1a 64-bit → index). */
    fun puzzleForSeed(seed: String): NPuzzle? {
        if (all.isEmpty()) return null
        var h = 1469598103934665603uL
        for (b in seed.toByteArray(Charsets.UTF_8)) {
            h = (h xor (b.toInt() and 0xFF).toULong()) * 1099511628211uL
        }
        return all[(h % all.size.toULong()).toInt()]
    }

    private fun daysSinceEpoch(dateString: String): Int {
        // dates are "yyyy-MM-dd" UTC; diff in whole days from EPOCH.
        return try {
            val target = java.time.LocalDate.parse(dateString)
            val e = java.time.LocalDate.parse(EPOCH)
            java.time.temporal.ChronoUnit.DAYS.between(e, target).toInt()
        } catch (_: Exception) { 0 }
    }
}
