package com.wordocious.core

import kotlinx.serialization.json.Json

/**
 * Word dictionary — mirrors `apps/ios/Sources/Core/Dictionary.swift`
 * (`GameDictionary`). All words stored uppercased. Length-specific dictionaries
 * (6, 7) route `isValidWord` and the solution pools for Six/Seven.
 *
 * Initialized once via [DictionaryLoader.ensureLoaded] from the bundled word
 * lists (the same files the fixtures were generated from).
 */
object GameDictionary {
    private var allowedWords: Set<String> = emptySet()
    private var allowedWordsList: List<String> = emptyList()   // ordered (prefill picks by index — order matters)
    private var solutionWords: List<String> = emptyList()
    private val lengthDictionaries = HashMap<Int, Pair<Set<String>, List<String>>>()

    fun init(allowed: List<String>, solutions: List<String>) {
        val up = allowed.map { it.uppercase() }
        allowedWords = up.toHashSet()
        allowedWordsList = up
        solutionWords = solutions.map { it.uppercase() }
    }

    /** Ordered allowed-words list (uppercased) — prefill indexes into it. */
    fun getAllowedWords(): List<String> = allowedWordsList

    fun initForLength(length: Int, allowed: List<String>, solutions: List<String>) {
        lengthDictionaries[length] =
            allowed.mapTo(HashSet()) { it.uppercase() } to solutions.map { it.uppercase() }
    }

    fun isValidWord(word: String): Boolean {
        val u = word.uppercase()
        lengthDictionaries[u.length]?.let { return u in it.first }
        return u in allowedWords
    }

    fun getSolutionWord(index: Int): String = solutionWords[index]
    fun getSolutionCount(): Int = solutionWords.size

    fun getSolutionWordForLength(length: Int, index: Int): String =
        (lengthDictionaries[length] ?: error("No dictionary for length $length")).second[index]

    fun getSolutionCountForLength(length: Int): Int =
        (lengthDictionaries[length] ?: error("No dictionary for length $length")).second.size

    /** Full 5-letter solutions list (uppercased) — used for Word of the Day. */
    fun allSolutions(): List<String> = solutionWords
}

/**
 * Loads the bundled word lists from classpath resources into [GameDictionary].
 * Idempotent + thread-safe. Call once at app/engine startup (and in tests).
 */
object DictionaryLoader {
    @Volatile private var loaded = false

    fun ensureLoaded() {
        if (loaded) return
        synchronized(this) {
            if (loaded) return
            GameDictionary.init(read("data/allowed.json"), read("data/solutions.json"))
            GameDictionary.initForLength(6, read("data/allowed-6.json"), read("data/solutions-6.json"))
            GameDictionary.initForLength(7, read("data/allowed-7.json"), read("data/solutions-7.json"))
            loaded = true
        }
    }

    private fun read(path: String): List<String> {
        val text = javaClass.classLoader!!.getResourceAsStream(path)
            ?.bufferedReader()?.use { it.readText() }
            ?: error("Missing engine resource: $path")
        return Json.decodeFromString(text)
    }
}
