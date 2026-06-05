package com.wordocious.core

/**
 * Deterministic prefilled-row generation (Deliverance/Rescue) — mirrors
 * `apps/ios/Sources/Core/Prefill.swift`. Picks 3 words from the 5-letter
 * allowed pool by hashing `"{seed}-prefill-{i}-{attempt}"`, re-rolling if the
 * pick is one of the board solutions (max 100 tries). Order-sensitive: the
 * allowed-word pool order must match across platforms (it's the same list).
 */
fun generatePrefillWords(seed: String, solutions: List<String>, allowedWords: List<String>): List<String> {
    val solutionSet = solutions.mapTo(HashSet()) { it.uppercase() }
    val fiveLetter = allowedWords.filter { it.length == 5 }
    val pool = if (fiveLetter.isEmpty()) allowedWords else fiveLetter
    val words = ArrayList<String>(3)
    for (i in 0 until 3) {
        var attempt = 0
        var word: String
        do {
            val hash = simpleHash("$seed-prefill-$i-$attempt")
            val index = hash % pool.size
            word = pool[index]
            attempt++
        } while (word in solutionSet && attempt < 100)
        words.add(word)
    }
    return words
}

fun generatePrefillGuesses(words: List<String>, solution: String): List<PrefilledGuess> {
    val sol = solution.uppercase()
    return words.map { PrefilledGuess(it, evaluateGuess(sol, it)) }
}
