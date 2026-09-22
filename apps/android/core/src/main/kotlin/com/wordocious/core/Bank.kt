package com.wordocious.core

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
