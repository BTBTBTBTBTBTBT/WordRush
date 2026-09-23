package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Epoch-indexed puzzle banks — port of packages/core/src/bank.ts (More Games
 * §11). Day k after a mode's epoch is always bank entry k, whatever the bank's
 * length, so appending entries never changes an already-dated puzzle. Dailies
 * draw from `daily`, Unlimited from `extra`. Parity is pinned by
 * bank-fixtures.json alongside the Swift and TS ports.
 */
object Bank {
    /** Whole UTC days from [epoch] to [day] (both yyyy-MM-dd); null if unparseable. */
    fun dayIndex(day: String, epoch: String): Int? = try {
        java.time.temporal.ChronoUnit.DAYS
            .between(java.time.LocalDate.parse(epoch), java.time.LocalDate.parse(day)).toInt()
    } catch (_: Exception) {
        null
    }

    /**
     * Index for the daily on [day] into a bank of [n] entries. Pre-epoch and
     * past-the-end days fall back to a stable modulo (a runway check keeps that
     * from ever happening in production). 0 for an empty bank.
     */
    fun indexForDay(day: String, n: Int, epoch: String): Int {
        if (n <= 0) return 0
        val idx = dayIndex(day, epoch) ?: return 0
        if (idx in 0 until n) return idx
        return ((idx % n) + n) % n
    }

    /** Index for an Unlimited seed; steps past [avoid] if the hash lands on it. */
    fun indexForSeed(seed: String, n: Int, avoid: Int? = null): Int {
        if (n <= 0) return 0
        val idx = simpleHash(seed) % n
        if (avoid != null && n > 1 && idx == avoid) return (idx + 1) % n
        return idx
    }
}

// ── Holidays (More Games §20) ──────────────────────────────────────────────

/**
 * The shared holiday calendar, emitted as DATA by
 * apps/web/scripts/holidays/gen-holiday-days.mjs (holiday-days.json, bundled on
 * every platform and sha-guarded): `days` maps yyyy-MM-dd to a holiday key
 * ("christmas", "mlkday", …). No platform ports the date rules.
 */
@Serializable
data class HolidayTable(val version: Int, val from: String, val to: String, val days: Map<String, String>) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): HolidayTable? = runCatching { json.decodeFromString<HolidayTable>(text) }.getOrNull()
        /** The bundled calendar (core resources/data/holiday-days.json, sha-guarded to match the web copy). */
        val bundled: HolidayTable? by lazy {
            HolidayTable::class.java.classLoader?.getResourceAsStream("data/holiday-days.json")?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

/** The holiday entry a bank serves on a day: `entries[index]` of the holiday `key`'s list. */
data class BankHolidayPick<T>(val key: String, val index: Int, val entry: T)

/** The holiday key that owns [day], or null on an ordinary day (or outside the table). */
fun holidayKeyForDay(day: String, table: HolidayTable?): String? = table?.days?.get(day)

/**
 * How many days owned by [key] fall strictly BEFORE [day] in the table (string
 * comparison) — the k-th outing of a holiday (Christmas Eve 0, Christmas Day 1,
 * Boxing Day 2 in the first year; 3, 4, 5 the next). Banks pick holiday entry
 * k mod n, so a holiday with several entries walks through them in calendar
 * order and a holiday with one entry repeats it.
 */
fun holidayOccurrence(day: String, key: String, table: HolidayTable?): Int {
    val days = table?.days ?: return 0
    var n = 0
    for ((d, k) in days) if (d < day && k == key) n++
    return n
}

/**
 * The holiday entry a bank should serve on [day]: `entries[k mod n]` where k is
 * the occurrence, or null when the day is ordinary or the bank has nothing for
 * that holiday (then the ordinary epoch index applies — the everyday entry a
 * holiday displaces is simply never dated, so [Bank.indexForDay] and the runway
 * maths are untouched).
 */
fun <T> bankHolidayPick(day: String, table: HolidayTable?, holiday: Map<String, List<T>>?): BankHolidayPick<T>? {
    val key = holidayKeyForDay(day, table) ?: return null
    val entries = holiday?.get(key)
    if (entries.isNullOrEmpty()) return null
    val index = holidayOccurrence(day, key, table) % entries.size
    return BankHolidayPick(key, index, entries[index])
}
