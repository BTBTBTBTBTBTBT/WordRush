package com.wordocious.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong

/**
 * VS lobby rules (founder-approved VS overhaul, 2026-10-01; spec
 * docs/VS_REDESIGN_SPEC.md). 1:1 port of packages/core/src/vs-lobby.ts;
 * pinned by vs-lobby-fixtures.json (VsLobbyFixtureTest). The VS page gets the
 * home banner's shape: a frosted headline strip over TODAY (the Daily Battle
 * and the Bot of the Day) and RECORD (people, bots, the ladder). Async friend
 * challenges ("race my run") are scored with the same rule as a live match.
 *
 * Everything here is pure so web, iOS and Android read the SAME words and
 * reach the SAME outcomes.
 */
object VsLobby {
    /** The nine VS modes in lobby-strip order (db keys). */
    val VS_MODE_ORDER = listOf("DUEL", "DUEL_6", "DUEL_7", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "GAUNTLET", "PROPERNOUNDLE")

    /**
     * Ladder order (FINISH_SPEC D1, BotCast): Rip → Ivy → Ollie → Opal → Cosmo →
     * Umi (adaptive) → Ozzy → Dewey → Scoot → Webster (the boss).
     */
    val LADDER_BOTS: List<String> = BotCast.IDS

    /** Wins in a row against the next bot that clear its rung. */
    const val LADDER_CLEAR_RUN = 3

    /** 45 seconds of speed is worth one guess (apps/server endMatch). */
    const val VS_TIME_WEIGHT_S = 45
}

enum class VsDayResult(val raw: String) {
    OPEN("open"), WON("won"), LOST("lost"), DRAW("draw");

    companion object {
        fun from(raw: String?): VsDayResult = values().firstOrNull { it.raw == raw } ?: OPEN
    }
}

data class VsBannerInput(
    /** The player's username; empty for none. */
    val name: String,
    /** Today's Daily Battle (a person, or the bot that stepped in). */
    val battle: VsDayResult,
    /** Today's Bot of the Day. */
    val botOfDay: VsDayResult,
    /** Username of the newest open challenge sent to the player, if any. */
    val incomingFrom: String? = null,
    /** Current bot win streak (the same progression store Stats reads). */
    val streak: Int = 0,
)

private fun upper(s: String) = s.trim().uppercase()

/** Both of today's battles won: the banner turns gold. */
fun vsSweep(battle: VsDayResult, botOfDay: VsDayResult): Boolean =
    battle == VsDayResult.WON && botOfDay == VsDayResult.WON

/**
 * The VS banner headline, always upper case. An open challenge leads; then a
 * VS sweep; then a hot streak; then today's own news; then a greeting.
 */
fun vsBannerHeadline(i: VsBannerInput): String {
    val from = i.incomingFrom
    if (!from.isNullOrBlank()) return "${upper(from)} CHALLENGED YOU!"
    if (vsSweep(i.battle, i.botOfDay)) return "VS SWEEP!"
    if (i.streak >= 3) return "ON A ROLL · ${i.streak} WINS IN A ROW"
    if (i.battle == VsDayResult.WON) return "DAILY BATTLE WON!"
    if (i.botOfDay == VsDayResult.WON) return "BOT OF THE DAY BEATEN!"
    if (i.battle != VsDayResult.OPEN || i.botOfDay != VsDayResult.OPEN) return "BACK FOR MORE?"
    val name = upper(i.name)
    return if (name.isNotEmpty()) "READY TO RACE, $name?" else "READY TO RACE?"
}

/**
 * The line under the headline. `clock` is the HH:MM:SS countdown to the next
 * UTC midnight (the Daily Battle and Bot of the Day are UTC-seeded);
 * `challengeLeft` is the open challenge's time left, e.g. "17H".
 */
fun vsBannerClockLine(i: VsBannerInput, clock: String, free: Boolean = false, challengeLeft: String? = null): String {
    val from = i.incomingFrom
    if (!from.isNullOrBlank()) return "RACE ${upper(from)}’S RUN · ${challengeLeft ?: "24H"} LEFT"
    val done = (if (i.battle != VsDayResult.OPEN) 1 else 0) + (if (i.botOfDay != VsDayResult.OPEN) 1 else 0)
    if (done == 2) return "NEW BATTLES IN $clock"
    if (done == 0) return if (free) "TWO FREE BATTLES A DAY · RESET IN $clock" else "DAILY BATTLE + BOT OF THE DAY · RESET IN $clock"
    return "RESETS IN $clock"
}

/** The TODAY row's status: "0/2", "1/2", "2/2", or "SWEEP · 2/2 WON". */
fun vsTodayStatus(battle: VsDayResult, botOfDay: VsDayResult): String {
    if (vsSweep(battle, botOfDay)) return "SWEEP · 2/2 WON"
    val done = (if (battle != VsDayResult.OPEN) 1 else 0) + (if (botOfDay != VsDayResult.OPEN) 1 else 0)
    return "$done/2"
}

data class WinLoss(val wins: Int, val losses: Int)

/**
 * The RECORD row: "PEOPLE 12–7 · BOTS 31–9 · LADDER 2/4". People and bots are
 * summed exactly like the Stats page's VS section (user_stats play_type 'vs'
 * and 'vs_cpu'), so the two can never disagree. The ladder is left out when
 * `ladder` is null (free players).
 */
fun vsRecordLine(people: WinLoss, bots: WinLoss, ladder: Int?): String {
    val parts = mutableListOf("PEOPLE ${people.wins}–${people.losses}", "BOTS ${bots.wins}–${bots.losses}")
    val n = VsLobby.LADDER_BOTS.size
    if (ladder != null) parts.add(if (ladder >= n) "LADDER CLEARED" else "LADDER $ladder/$n")
    return parts.joinToString(" · ")
}

// ── Async challenges ("race my run") ────────────────────────────────────────

/** One side of a VS game: the same numbers a live match compares. */
data class VsRun(
    val solved: Boolean,
    val boardsSolved: Int,
    /** Guess count (the VS score unit). */
    val guesses: Int,
    val timeMs: Long,
)

enum class VsOutcome(val raw: String) { WIN("win"), LOSS("loss"), DRAW("draw") }

private fun composite(r: VsRun): Double = r.guesses + r.timeMs / 1000.0 / VsLobby.VS_TIME_WEIGHT_S

/**
 * Who won, from `me`'s side. Mirrors the live server: a solve beats no solve;
 * two solves compare boards, then guesses + time/45s (within 0.01 is a draw).
 * Two failed runs (the live server scores both as losses) compare boards
 * solved, and are otherwise a draw.
 */
fun vsOutcome(me: VsRun, them: VsRun): VsOutcome {
    if (me.solved != them.solved) return if (me.solved) VsOutcome.WIN else VsOutcome.LOSS
    if (me.boardsSolved != them.boardsSolved) return if (me.boardsSolved > them.boardsSolved) VsOutcome.WIN else VsOutcome.LOSS
    if (!me.solved) return VsOutcome.DRAW
    val a = composite(me)
    val b = composite(them)
    if (abs(a - b) < 0.01) return VsOutcome.DRAW
    return if (a < b) VsOutcome.WIN else VsOutcome.LOSS
}

/** "1:05" from milliseconds (whole seconds, rounded half up like JS Math.round). */
fun vsClock(ms: Long): String {
    val s = max(0L, Math.floor(ms / 1000.0 + 0.5).roundToLong())
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
}

/**
 * What decided it, from the winner's side: "ONLY ONE SOLVE", "2 MORE BOARDS",
 * "1 FEWER GUESS", "FASTER BY 0:12"; a draw reads "DEAD EVEN".
 */
fun vsMargin(me: VsRun, them: VsRun): String {
    val out = vsOutcome(me, them)
    if (out == VsOutcome.DRAW) return "DEAD EVEN"
    val (w, l) = if (out == VsOutcome.WIN) me to them else them to me
    if (w.solved != l.solved) return "ONLY ONE SOLVE"
    if (w.boardsSolved != l.boardsSolved) {
        val d = w.boardsSolved - l.boardsSolved
        return "$d MORE ${if (d == 1) "BOARD" else "BOARDS"}"
    }
    if (w.guesses < l.guesses) {
        val d = l.guesses - w.guesses
        return "$d FEWER ${if (d == 1) "GUESS" else "GUESSES"}"
    }
    return "FASTER BY ${vsClock(l.timeMs - w.timeMs)}"
}

/** The challenge result headline: "YOU BEAT DOUG’S RUN!" / "DOUG’S RUN HELD!" / "DEAD HEAT WITH DOUG!". */
fun challengeHeadline(outcome: VsOutcome, from: String): String {
    val n = upper(from).ifEmpty { "THEIR" }
    return when (outcome) {
        VsOutcome.WIN -> "YOU BEAT $n’S RUN!"
        VsOutcome.LOSS -> "$n’S RUN HELD!"
        VsOutcome.DRAW -> "DEAD HEAT WITH $n!"
    }
}

// ── The bot ladder ──────────────────────────────────────────────────────────

data class BotLadderState(
    /** Rungs cleared, 0–10. */
    val cleared: Int,
    /** Current wins in a row against the next bot (LADDER_BOTS[cleared]). */
    val run: Int,
)

/**
 * Fold one finished bot game into the ladder. Only games against the NEXT
 * bot count: a win adds to the run (three clear the rung), a loss resets the
 * run. Games against other bots (or the Bot of the Day / Beat your best)
 * leave the ladder alone. Old ids (rook, lexi, nova, adapt) count as their
 * cast replacement (BotCast.canonicalId).
 */
fun ladderAfterGame(s: BotLadderState, botId: String, won: Boolean): BotLadderState {
    val bots = VsLobby.LADDER_BOTS
    if (s.cleared >= bots.size) return BotLadderState(bots.size, 0)
    if (BotCast.canonicalId(botId) != bots[s.cleared]) return s.copy()
    if (!won) return BotLadderState(s.cleared, 0)
    val run = s.run + 1
    return if (run >= VsLobby.LADDER_CLEAR_RUN) BotLadderState(s.cleared + 1, 0) else BotLadderState(s.cleared, run)
}

enum class RungState(val raw: String) { CLEARED("cleared"), NEXT("next"), LOCKED("locked") }

data class LadderRung(val id: String, val state: RungState, val line: String)

/** Each rung's state and its line ("Cleared", "Win 3 in a row to clear · 1 so far", "Clear Rip to unlock"). */
fun ladderRungs(s: BotLadderState): List<LadderRung> {
    fun name(id: String) = BotCast.member(id)?.name ?: id
    return VsLobby.LADDER_BOTS.mapIndexed { i, id ->
        when {
            i < s.cleared -> LadderRung(id, RungState.CLEARED, "Cleared")
            i == s.cleared -> LadderRung(id, RungState.NEXT, "Win ${VsLobby.LADDER_CLEAR_RUN} in a row to clear · ${s.run} so far")
            else -> LadderRung(id, RungState.LOCKED, "Clear ${name(VsLobby.LADDER_BOTS[i - 1])} to unlock")
        }
    }
}
