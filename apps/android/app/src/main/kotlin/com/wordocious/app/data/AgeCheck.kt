package com.wordocious.app.data

import java.util.Calendar
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * 13+ age check rules (FRIDAY-QUEUE item 29 — COPPA). Pure (JVM-unit-tested: AgeCheckTest);
 * mirrors core age-check.ts and WordociousCore AgeCheck.swift. One neutral question, "When's your
 * birthday year?", no default, no hint that 13 matters; only the year is ever stored.
 *
 * A year alone cannot tell a passed 13th birthday from an upcoming one, so the rule is STRICT (founder:
 * "I don't mind losing the under-13 players if it's safer"): pass only when `currentYear - birthYear >=
 * PASS_OFFSET`, i.e. guaranteed at least 13. Flip PASS_OFFSET to 13 for the permissive reading (and the
 * same constant in the other two ports).
 */
object AgeCheck {
    const val MIN_AGE = 13
    const val PASS_OFFSET = MIN_AGE + 1
    const val MAX_YEARS_BACK = 100
    const val SUPPORT_EMAIL = "privacy@wordocious.com"

    enum class Verdict { PASS, UNDER, INVALID }
    enum class State { OK, UNDER }
    data class Stored(val state: State, val year: Int)

    fun currentYear(): Int = Calendar.getInstance().get(Calendar.YEAR)

    /** Years for the wheel, newest first (no default selection). */
    fun years(now: Int = currentYear()): List<Int> = (0..MAX_YEARS_BACK).map { now - it }

    fun verdict(year: Int, now: Int = currentYear()): Verdict = when {
        year > now || year < now - MAX_YEARS_BACK -> Verdict.INVALID
        now - year >= PASS_OFFSET -> Verdict.PASS
        else -> Verdict.UNDER
    }

    @Serializable
    private data class Dto(val state: String, val year: Int)

    /** A newer build may write more keys beside state + year (item 39): ignore them rather than re-ask the player. */
    private val lenient = Json { ignoreUnknownKeys = true }

    fun encode(s: Stored): String = Json.encodeToString(Dto(s.state.name.lowercase(), s.year))

    /** Re-validates a stored value: a hand-edited "ok" beside a young year reads as "under". */
    fun parse(raw: String?, now: Int = currentYear()): Stored? {
        if (raw.isNullOrBlank()) return null
        return runCatching {
            val d = lenient.decodeFromString<Dto>(raw)
            when (verdict(d.year, now)) {
                Verdict.INVALID -> null
                Verdict.UNDER -> Stored(State.UNDER, d.year)
                Verdict.PASS -> when (d.state) {
                    "ok" -> Stored(State.OK, d.year)
                    "under" -> Stored(State.UNDER, d.year)
                    else -> null
                }
            }
        }.getOrNull()
    }
}
