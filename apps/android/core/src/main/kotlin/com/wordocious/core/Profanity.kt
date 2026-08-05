package com.wordocious.core

/**
 * UGC profanity screening — Kotlin port of packages/core/src/username.ts
 * (iOS mirror: Sources/Core/Profanity.swift).
 *
 * Two consumers:
 *   1. Usernames (EditProfileScreen): client-side pre-check for instant
 *      feedback. The AUTHORITY is the database trigger
 *      (supabase/manual-migrations/20260805000001_username_guard_db.sql) —
 *      profile writes go straight to PostgREST, so this copy is UX only.
 *   2. ProperNoundle guesses (GameViewModel.submit): proper nouns can't be
 *      dictionary-validated, so any typed string used to become permanent
 *      board art (completed cards, share images, VS relay) — "PENISPENISP"
 *      shipped that way on 2026-07-31, typed on this platform.
 *
 * Policy (keep in lockstep with the TS module, the SQL trigger and the Swift
 * port — ProfanityTest mirrors username.test.ts):
 *   Tier 1 ([BLOCKED_SUBSTRINGS]): slurs + strong profanity, matched as
 *     SUBSTRINGS of the collapsed form after known-innocent carrier words
 *     (Scunthorpe, Hitchcock, Dickens…) are stripped.
 *   Tier 2 ([BLOCKED_TOKENS]): mild-but-crude words that occur inside real
 *     names (ASS in Cassandra, TIT in Titan) — matched only as whole tokens,
 *     split at camelCase boundaries and non-letters. Usernames only; a PN
 *     guess is one unbroken letter run so token boundaries don't exist.
 */
object Profanity {
    /** Mirrors USERNAME_BLOCKED_SUBSTRINGS. */
    val BLOCKED_SUBSTRINGS: List<String> = listOf(
        "NEGRO", "NIGER", "NIGGA", "NIGGER", "CHINK", "SPICK", "SPIC", "KIKES", "KIKE",
        "WETBACK", "GOOKS", "GOOK", "DAGOS", "DAGO", "WOPS", "COON", "COONS",
        "TRANNY", "TRANNIES", "FAGGOT", "FAGGY", "FAGS", "DYKES", "DYKE",
        "RETARD", "RETARDS", "CRIPPLE", "MONGOLOID", "SHEMALE", "HEEBS", "HEEB",
        "PAKIS", "PAKI", "ABBOS", "ABBO", "SLANT", "ZIPPERHEAD", "RAGHEAD", "TOWELHEAD",
        "CUNT", "FUCK", "SHIT", "PORN", "RAPE", "RAPIST", "PEDO", "PAEDO", "NAZI", "HITLER",
        "DICK", "COCK", "PENIS", "PUSSY", "BITCH", "WANK", "DILDO", "WHORE", "SLUT",
        "CLIT", "TWAT", "JIZZ", "BLOWJOB",
    )

    /**
     * Mirrors USERNAME_ALLOWED_CONTAINING — stripped from the name BEFORE the
     * substring scan (the Scunthorpe problem). Stripping rather than
     * exact-match allowlisting keeps compounds working: Scunthorpe_Fan
     * passes, ScunthorpeCUNT still fails.
     */
    val ALLOWED_CONTAINING: List<String> = listOf(
        "SCUNTHORPE", "PENISTONE", "SHITAKE", "SHIITAKE", "LIGHTWATER",
        "CLITHEROE", "ASSASSIN", "ASSISI", "COCKBURN", "HANCOCK", "BABCOCK",
        "MATSUSHITA", "THERAPIST", "ARSENAL", "SUSSEX", "MIDDLESEX", "ESSEX",
        "DICKENS", "DICKINSON", "DICKSON", "RIDDICK", "PEACOCK", "HITCHCOCK",
        "WOODCOCK", "GAMECOCK", "SHUTTLECOCK", "COCKATOO", "COCKPIT", "COCKTAIL",
        "COCKER", "HERACLITUS", "ATWATER", "SWANK",
    )

    /** Mirrors USERNAME_BLOCKED_TOKENS. */
    val BLOCKED_TOKENS: Set<String> = setOf(
        "ASS", "ARSE", "ANAL", "BALLS", "DAMN", "PISS", "TIT", "TITS",
        "BOOB", "BOOBS", "SEX",
    )

    /** Leet substitutions undone before matching (mirrors the TS LEET map). */
    private val LEET: Map<Char, Char> = mapOf(
        '0' to 'O', '1' to 'I', '!' to 'I', '|' to 'I', '3' to 'E', '4' to 'A', '@' to 'A',
        '5' to 'S', '$' to 'S', '7' to 'T', '8' to 'B', '9' to 'G', '6' to 'G', '+' to 'T',
    )

    /**
     * Fold to the comparison form: uppercase, leet undone, non-letters
     * dropped, repeated letters collapsed (mirrors normalizeUsername).
     */
    fun normalize(raw: String): String {
        val substituted = raw.uppercase().map { LEET[it] ?: it }
        val lettersOnly = substituted.filter { it in 'A'..'Z' }
        val out = StringBuilder()
        for (ch in lettersOnly) if (out.isEmpty() || out.last() != ch) out.append(ch)
        return out.toString()
    }

    /** Tier-1 scan, shared by usernames and PN guesses. */
    fun containsBlockedTerm(raw: String): Boolean {
        var normalized = normalize(raw)
        for (safe in ALLOWED_CONTAINING) normalized = normalized.replace(normalize(safe), "")
        return BLOCKED_SUBSTRINGS.any { normalized.contains(normalize(it)) }
    }

    /**
     * Tier-2 token split: camelCase boundaries become separators, then any
     * non-letter delimits (mirrors usernameTokens).
     */
    fun tokens(raw: String): List<String> =
        raw.replace(Regex("([a-z])([A-Z])"), "$1 $2")
            .uppercase()
            .split(Regex("[^A-Z]+"))
            .filter { it.isNotEmpty() }

    /**
     * Full username validation: shape first, then content. Returns a
     * user-facing error (never quoting the matched term) or null when OK.
     * Mirrors validateUsername in packages/core/src/username.ts.
     */
    fun usernameError(raw: String): String? {
        val trimmed = raw.trim()
        if (trimmed.length < 3 || trimmed.length > 20) return "Username must be 3-20 characters"
        if (!Regex("^[A-Za-z0-9 ._-]+$").matches(trimmed)) {
            return "Use letters, numbers, spaces, and . _ - only"
        }
        if (!trimmed.any { it.isLetterOrDigit() }) return "Username needs at least one letter or number"
        if (containsBlockedTerm(trimmed) || tokens(trimmed).any { it in BLOCKED_TOKENS }) {
            return "That username isn’t available. Please choose another."
        }
        return null
    }

    /**
     * ProperNoundle guess screening (mirrors pnGuessBlocked): rejected like an
     * invalid word when the guess contains a tier-1 term. The ANSWER is
     * exempt: if the puzzle's own answer trips the scan (Ice Spice contains
     * SPIC), screening is skipped for that whole puzzle — the player must be
     * able to type the answer, and near-guesses in that letter-space are
     * legitimate.
     */
    fun pnGuessBlocked(guess: String, answer: String): Boolean {
        if (containsBlockedTerm(answer)) return false
        return containsBlockedTerm(guess)
    }
}
