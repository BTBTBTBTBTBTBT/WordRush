package com.wordocious.app.data

import com.wordocious.core.GameMode
import com.wordocious.core.generateDailySeed
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import com.wordocious.core.VsDayResult
import com.wordocious.core.VsLobby
import org.json.JSONObject

/**
 * Small per-device VS lobby state (VS overhaul, 2026-10-01; spec §1, §2, §6):
 *  - the lobby's selected mode (`wordocious-vs-mode`, default Classic), and
 *  - the Daily Battle a BOT stepped in for (`wordocious-vs-daily-<UTC day>` =
 *    {"result":"won|lost|draw","opponent":"Lexi"}). That game records as a bot
 *    game, never a daily_results 'vs' row, so the banner reads it from here.
 *    A person's row wins when both exist.
 */
object VsLobbyStore {
    private const val MODE_KEY = "wordocious-vs-mode"
    private fun dailyKey(dayUtc: String) = "wordocious-vs-daily-$dayUtc"

    fun selectedMode(): GameMode {
        val raw = SettingsPref.get(MODE_KEY, "DUEL")
        return if (raw in VsLobby.VS_MODE_ORDER) runCatching { GameMode.valueOf(raw) }.getOrDefault(GameMode.DUEL) else GameMode.DUEL
    }

    fun setSelectedMode(mode: GameMode) = SettingsPref.set(MODE_KEY, mode.name)

    /** Today's bot-stepped-in Daily Battle, or null. */
    fun dailyBotResult(dayUtc: String = CpuProgressionStore.todayUtc()): Pair<VsDayResult, String>? {
        val raw = SettingsPref.get(dailyKey(dayUtc), "")
        if (raw.isEmpty()) return null
        return runCatching {
            val o = JSONObject(raw)
            VsDayResult.from(o.optString("result")) to o.optString("opponent", "Lexi")
        }.getOrNull()?.takeIf { it.first != VsDayResult.OPEN }
    }

    fun recordDailyBotResult(result: VsDayResult, opponent: String, dayUtc: String = CpuProgressionStore.todayUtc()) {
        val o = JSONObject().put("result", result.raw).put("opponent", opponent)
        SettingsPref.set(dailyKey(dayUtc), o.toString())
    }

    /** Today's Daily Battle: the result and who it was against ("@kate" / "Lexi"; null when unknown). */
    data class Battle(val result: VsDayResult, val opponent: String?)

    /**
     * The banner's Daily Battle (§1): the person row first — the daily Classic
     * VS row for the LOCAL day (it is written with the local day), opponent from
     * the matches row on the day's shared daily seed — else the bot that
     * stepped in (local key, UTC day). Web use-vs-lobby parity.
     */
    suspend fun todayBattle(): Battle {
        val person = DailyResultsService.dailyVsDayResult()
        if (person != VsDayResult.OPEN) {
            val name = AuthService.userId?.let { dailyBattleOpponent(it, generateDailySeed(com.wordocious.app.todayUTCDate(), "DUEL_VS")) }
            return Battle(person, name?.let { "@$it" })
        }
        dailyBotResult()?.let { return Battle(it.first, it.second) }
        return Battle(VsDayResult.OPEN, null)
    }

    @Serializable
    private data class PairRow(
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player2_id") val player2Id: String? = null,
    )

    /** The opponent's username on the newest matches row for `seed` (null when none). */
    private suspend fun dailyBattleOpponent(userId: String, seed: String): String? = runCatching {
        val row = SupabaseConfig.client.postgrest["matches"]
            .select(Columns.raw("player1_id, player2_id")) {
                filter {
                    eq("seed", seed)
                    or { eq("player1_id", userId); eq("player2_id", userId) }
                    filterNot("player2_id", FilterOperator.IS, null)
                }
                order("created_at", Order.DESCENDING)
                limit(1)
            }
            .decodeList<PairRow>().firstOrNull() ?: return@runCatching null
        val opp = (if (row.player1Id == userId) row.player2Id else row.player1Id) ?: return@runCatching null
        ProfileService.fetchUsernames(listOf(opp))[opp]
    }.getOrNull()
}
