package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Client-side progression for CPU practice (the fun/addictive layer). Persisted
 * per-device in SharedPreferences — CPU play is unranked. W/L totals live in
 * user_stats(vs_cpu); this tracks the streak, boss-ladder rung, cosmetic
 * unlocks, and Bot-of-the-Day streak. Kotlin port of cpu-progression.ts.
 *
 * VS overhaul §7 (2026-10-01) adds the bot ladder (`ladderCleared` rungs of
 * Rook → Lexi → Nova → Adapt, `ladderRun` wins in a row against the next one,
 * folded by core ladderAfterGame) and today's Bot of the Day result
 * (`botOfDayPlayedDay` UTC day + `botOfDayResult` won/lost/draw).
 */
data class CpuProgression(
    val streak: Int = 0,
    val bestStreak: Int = 0,
    val rung: Int = 0,
    val unlocked: Set<String> = emptySet(),
    val botOfDayStreak: Int = 0,
    val botOfDayLastDay: String? = null,
    val ladderCleared: Int = 0,
    val ladderRun: Int = 0,
    val botOfDayPlayedDay: String? = null,
    val botOfDayResult: String? = null,
) {
    /** Today's Bot of the Day: "open" until played this UTC day, then its result. */
    fun botOfDayToday(todayUtc: String): com.wordocious.core.VsDayResult =
        if (botOfDayPlayedDay == todayUtc) com.wordocious.core.VsDayResult.from(botOfDayResult)
        else com.wordocious.core.VsDayResult.OPEN
}

object CpuProgressionStore {
    private val prefs by lazy { App.instance.getSharedPreferences("wordocious_cpu", Context.MODE_PRIVATE) }
    private val milestones = setOf(5, 10, 25, 50, 100)
    private val tierRung = mapOf(BotTier.EASY to 1, BotTier.MEDIUM to 2, BotTier.HARD to 3)

    fun load(): CpuProgression = CpuProgression(
        streak = prefs.getInt("streak", 0),
        bestStreak = prefs.getInt("bestStreak", 0),
        rung = prefs.getInt("rung", 0),
        unlocked = prefs.getStringSet("unlocked", emptySet())?.toSet() ?: emptySet(),
        botOfDayStreak = prefs.getInt("botOfDayStreak", 0),
        botOfDayLastDay = prefs.getString("botOfDayLastDay", null),
        ladderCleared = prefs.getInt("ladderCleared", 0),
        ladderRun = prefs.getInt("ladderRun", 0),
        botOfDayPlayedDay = prefs.getString("botOfDayPlayedDay", null),
        botOfDayResult = prefs.getString("botOfDayResult", null),
    )

    private fun save(p: CpuProgression) {
        prefs.edit()
            .putInt("streak", p.streak).putInt("bestStreak", p.bestStreak).putInt("rung", p.rung)
            .putStringSet("unlocked", p.unlocked)
            .putInt("botOfDayStreak", p.botOfDayStreak).putString("botOfDayLastDay", p.botOfDayLastDay)
            .putInt("ladderCleared", p.ladderCleared).putInt("ladderRun", p.ladderRun)
            .putString("botOfDayPlayedDay", p.botOfDayPlayedDay).putString("botOfDayResult", p.botOfDayResult)
            .apply()
    }

    data class Outcome(val progression: CpuProgression, val milestone: Int?, val unlockedPersona: String?)

    fun recordGame(won: Boolean, tier: BotTier, personaId: String): Outcome {
        var p = load()
        var milestone: Int? = null
        var unlockedPersona: String? = null
        p = if (won) {
            val streak = p.streak + 1
            val best = maxOf(p.bestStreak, streak)
            if (streak in milestones) milestone = streak
            var rung = maxOf(p.rung, tierRung[tier] ?: 1)
            if (tier == BotTier.HARD && streak >= 3) rung = maxOf(rung, 4)
            var unlocked = p.unlocked
            if (tier == BotTier.HARD && personaId !in unlocked) { unlocked = unlocked + personaId; unlockedPersona = personaId }
            p.copy(streak = streak, bestStreak = best, rung = rung, unlocked = unlocked)
        } else {
            p.copy(streak = 0, rung = if (p.rung > 1) p.rung - 1 else p.rung)
        }
        save(p)
        return Outcome(p, milestone, unlockedPersona)
    }

    fun recordBotOfDay(won: Boolean, todayUtc: String): CpuProgression {
        var p = load()
        if (won && p.botOfDayLastDay != todayUtc) {
            val yesterday = runCatching {
                LocalDate.parse(todayUtc).minusDays(1).toString()
            }.getOrNull()
            p = p.copy(
                botOfDayStreak = if (p.botOfDayLastDay == yesterday) p.botOfDayStreak + 1 else 1,
                botOfDayLastDay = todayUtc,
            )
            save(p)
        }
        return p
    }

    /**
     * Fold one finished bot game into the ladder (core ladderAfterGame): only a
     * game against the NEXT rung's bot moves it. `botId` is CpuKind.botId, so
     * the Bot of the Day ("daily") and Beat your best ("ghost") pass through.
     */
    fun recordLadder(botId: String, won: Boolean): CpuProgression {
        val p = load()
        val s = com.wordocious.core.ladderAfterGame(com.wordocious.core.BotLadderState(p.ladderCleared, p.ladderRun), botId, won)
        val next = p.copy(ladderCleared = s.cleared, ladderRun = s.run)
        save(next)
        return next
    }

    /** Mark today's Bot of the Day played with its result ("won" | "lost" | "draw"). */
    fun recordBotOfDayResult(result: String, todayUtc: String): CpuProgression {
        val next = load().copy(botOfDayPlayedDay = todayUtc, botOfDayResult = result)
        save(next)
        return next
    }

    /** The bot the ladder sends next: the first uncleared rung, Adapt once all four are cleared. */
    fun nextLadderBot(p: CpuProgression = load()): String =
        com.wordocious.core.VsLobby.LADDER_BOTS.getOrElse(p.ladderCleared) { "adapt" }

    fun todayUtc(): String = LocalDate.now(ZoneOffset.UTC).toString()
}
