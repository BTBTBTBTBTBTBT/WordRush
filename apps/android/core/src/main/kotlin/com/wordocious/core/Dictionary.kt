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
/**
 * First daily date (YYYY-MM-DD) governed by the curated answer list. Daily
 * seeds strictly before this use the legacy list. Plain string compare.
 * Mirrors packages/core SOLUTIONS_CUTOVER_DATE — keep in lockstep.
 */
const val SOLUTIONS_CUTOVER_DATE = "2026-07-08"

object GameDictionary {
    private var allowedWords: Set<String> = emptySet()
    private var allowedWordsList: List<String> = emptyList()   // ordered (prefill picks by index — order matters)
    private var solutionWords: List<String> = emptyList()
    // Pre-curation 5-letter answer bank (see the TS gate). Pre-cutover daily
    // dates resolve against this so replays + the archive keep the played words.
    private var legacySolutionWords: List<String> = emptyList()
    private val lengthDictionaries = HashMap<Int, Pair<Set<String>, List<String>>>()

    fun init(allowed: List<String>, solutions: List<String>, legacySolutions: List<String> = emptyList()) {
        val up = allowed.map { it.uppercase() }
        allowedWords = up.toHashSet()
        allowedWordsList = up
        solutionWords = solutions.map { it.uppercase() }
        legacySolutionWords = legacySolutions.map { it.uppercase() }
    }

    /** 5-letter answer pool for a daily date (or null for non-daily seeds).
     *  Pre-cutover daily dates → legacy list; else curated. Throws if a
     *  pre-cutover date is requested with no legacy list loaded — a silent
     *  fall-through would corrupt pre-cutover replays/archive invisibly. */
    fun solutionPool(dateKey: String?): List<String> {
        if (dateKey != null && dateKey < SOLUTIONS_CUTOVER_DATE) {
            check(legacySolutionWords.isNotEmpty()) {
                "Legacy solutions not initialized — pre-cutover seed cannot be resolved"
            }
            return legacySolutionWords
        }
        return solutionWords
    }

    /** Ordered allowed-words list (uppercased) — prefill indexes into it. */
    fun getAllowedWords(): List<String> = allowedWordsList

    fun initForLength(length: Int, allowed: List<String>, solutions: List<String>) {
        val up = allowed.map { it.uppercase() }
        lengthDictionaries[length] = up.toHashSet() to solutions.map { it.uppercase() }
        lengthAllowedLists[length] = up
    }

    private val lengthAllowedLists = HashMap<Int, List<String>>()

    /** Length-keyed allowed list (6/7 have their own dictionaries); falls back
     *  to the master 5-letter list. The bot draws real fillers from this — the
     *  master list has only a couple of 6/7-letter strays, which made Six/Seven
     *  bots repeat the same word. */
    fun getAllowedWordsForLength(length: Int): List<String> =
        lengthAllowedLists[length] ?: allowedWordsList

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
            // legacy list feeds the pre-cutover answer pool (date-gated).
            GameDictionary.init(read("data/allowed.json"), read("data/solutions.json"), read("data/solutions-legacy.json"))
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
