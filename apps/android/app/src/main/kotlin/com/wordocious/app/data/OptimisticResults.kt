package com.wordocious.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * BI19 optimistic results (founder, 2026-10-03: "the W and L will populate immediately now upon
 * return to the main menu as well as the leaderboard immediately populating the results").
 *
 * The moment a daily finishes — before any network — its result is written locally, keyed by
 * user + day + mode, and persisted so it survives a relaunch until the server confirms it:
 * - Home's W/L badge ([completionsFor]; DailyCompletionsService also keeps its day cache),
 * - the player's own row on the daily per-game and overall (Sweep) boards ([mergeLeaderboard],
 *   [mergeSweep]), placed in rank order and flagged optimistic,
 * - the Stats "today" strip and the widget (both read the completions).
 *
 * Reconcile: once server data for that day + mode includes the player, the server wins silently
 * and the local row is dropped ([reconcile]). Past days are dropped ([pruneDays]).
 *
 * The rules are pure and JVM-tested (OptimisticResultsTest); [Store] is the persisted map.
 */
object OptimisticResults {
    @Serializable
    data class LocalResult(
        val userId: String,
        val day: String,
        val gameMode: String,
        val completed: Boolean,
        val guessCount: Int,
        val timeSeconds: Int,
        val score: Double,
        val boardsSolved: Int = 1,
        val totalBoards: Int = 1,
        val hintsUsed: Int = 0,
        val username: String? = null,
        val avatarUrl: String? = null,
        val avatarEmoji: String? = null,
        val savedAtMs: Long = 0L,
    ) {
        val key: String get() = key(userId, day, gameMode)
    }

    fun key(userId: String, day: String, gameMode: String) = "${userId.lowercase()}|$day|$gameMode"

    /**
     * Add [r] to [current]. The daily keeps its best result (the server's best-score-wins upsert):
     * a lower score never replaces a higher one, and a loss never replaces a win.
     */
    fun applyLocalResult(current: Map<String, LocalResult>, r: LocalResult): Map<String, LocalResult> {
        val existing = current[r.key]
        if (existing != null) {
            if (existing.completed && !r.completed) return current
            if (existing.completed == r.completed && r.score <= existing.score) return current
        }
        return current + (r.key to r)
    }

    /** Home's W/L map for [userId] on [day] (game_mode → completion). */
    fun completionsFor(local: Map<String, LocalResult>, userId: String, day: String): Map<String, DailyCompletionsService.Completion> =
        local.values
            .filter { it.userId.equals(userId, ignoreCase = true) && it.day == day }
            .associate {
                it.gameMode to DailyCompletionsService.Completion(
                    gameMode = it.gameMode, completed = it.completed,
                    guessCount = it.guessCount, timeSeconds = it.timeSeconds, score = it.score,
                )
            }

    /** The board's order: score desc, then time asc; a new row goes after its exact ties
     *  (the server breaks those by created_at, and ours is the newest). */
    private fun ranksAhead(rowScore: Double, rowTime: Int, score: Double, time: Int): Boolean =
        rowScore > score || (rowScore == score && rowTime <= time)

    /**
     * The server's rows with the player's [local] row inserted in rank order and flagged
     * [LeaderboardService.LeaderboardEntry.isOptimistic] — unless the server already has the
     * player (the server wins), there is no local row, or it is for another user.
     */
    fun mergeLeaderboard(
        serverRows: List<LeaderboardService.LeaderboardEntry>,
        local: LocalResult?,
        userId: String?,
        /** A full server page: a row that would land past it isn't inserted (the rank window
         *  below the list covers it). Null = the list is the whole board. */
        limit: Int? = null,
    ): List<LeaderboardService.LeaderboardEntry> {
        if (local == null || userId == null || !local.userId.equals(userId, ignoreCase = true)) return serverRows
        val base = serverRows.filterNot { it.isOptimistic }
        if (base.any { it.userId.equals(userId, ignoreCase = true) }) return base
        val row = LeaderboardService.LeaderboardEntry(
            userId = userId,
            profiles = LeaderboardService.ProfileRef(local.username, local.avatarUrl, local.avatarEmoji),
            compositeScore = local.score,
            guessCount = local.guessCount,
            timeSeconds = local.timeSeconds,
            boardsSolved = local.boardsSolved,
            totalBoards = local.totalBoards,
            hintsUsed = local.hintsUsed,
            completed = local.completed,
            isOptimistic = true,
        )
        val at = base.indexOfFirst { !ranksAhead(it.compositeScore, it.timeSeconds, local.score, local.timeSeconds) }
            .let { if (it < 0) base.size else it }
        if (limit != null && at >= limit) return base
        return base.toMutableList().apply { add(at, row) }
    }

    /** True for the signed-in player's own row. */
    fun isMe(entry: LeaderboardService.LeaderboardEntry, userId: String?): Boolean =
        userId != null && entry.userId.equals(userId, ignoreCase = true)

    /**
     * The overall (Daily Sweep) board: once the player's local results cover every sweep mode
     * ([sweepKeys]) and the server board doesn't list them yet, their row goes in at its rank
     * (total score desc, total time asc), flagged by a rank of 0 until the server confirms.
     */
    fun mergeSweep(
        serverRows: List<LeaderboardService.SweepEntry>,
        local: Map<String, LocalResult>,
        userId: String?,
        day: String,
        sweepKeys: Set<String>,
        serverCompletions: Map<String, DailyCompletionsService.Completion> = emptyMap(),
    ): List<LeaderboardService.SweepEntry> {
        if (userId == null || sweepKeys.isEmpty()) return serverRows
        if (serverRows.any { it.userId.equals(userId, ignoreCase = true) }) return serverRows
        val mine = local.values.filter { it.userId.equals(userId, ignoreCase = true) && it.day == day && it.gameMode in sweepKeys }
            .associateBy { it.gameMode }
        // Every sweep mode must be known — locally, or already on the server.
        if (sweepKeys.any { it !in mine && it !in serverCompletions }) return serverRows
        if (mine.isEmpty()) return serverRows
        var score = 0.0; var time = 0; var won = 0
        for (k in sweepKeys) {
            val l = mine[k]
            if (l != null) {
                score += Math.round(l.score).toDouble(); time += l.timeSeconds; if (l.completed) won++
            } else {
                val c = serverCompletions.getValue(k)
                score += Math.round(c.score).toDouble(); time += c.timeSeconds; if (c.completed) won++
            }
        }
        val any = mine.values.first()
        val row = LeaderboardService.SweepEntry(
            userId = userId, username = any.username, avatarUrl = any.avatarUrl,
            totalScore = score, totalTime = time, modesWon = won,
            isFlawless = won == sweepKeys.size, rank = 0,
        )
        val at = serverRows.indexOfFirst { !ranksAhead(it.totalScore, it.totalTime, score, time) }
            .let { if (it < 0) serverRows.size else it }
        return serverRows.toMutableList().apply { add(at, row) }
    }

    /**
     * Server data for ([day], [gameMode]) landed: drop the local row when the server now includes
     * the player ([serverHasUser]) — the server wins silently, whatever its values. A server copy
     * without the player keeps the local row.
     */
    fun reconcile(
        local: Map<String, LocalResult>,
        userId: String,
        day: String,
        gameMode: String,
        serverHasUser: Boolean,
    ): Map<String, LocalResult> =
        if (serverHasUser) local - key(userId, day, gameMode) else local

    /** Only today's results are kept. */
    fun pruneDays(local: Map<String, LocalResult>, today: String): Map<String, LocalResult> =
        local.filterValues { it.day == today }

    /**
     * The persisted map (one JSON list under one key). Thread-safe; every read prunes past days.
     * A new instance over the same [KeyValueStore] reads what the last one wrote (relaunch).
     */
    class Store(private val kv: KeyValueStore) {
        private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
        private val lock = Any()
        @Volatile private var memo: Map<String, LocalResult>? = null

        private fun load(): Map<String, LocalResult> = memo ?: runCatching {
            kv.get(KEY)?.let { raw ->
                json.decodeFromString(ListSerializer(LocalResult.serializer()), raw).associateBy { it.key }
            }
        }.getOrNull().orEmpty().also { memo = it }

        private fun save(map: Map<String, LocalResult>) {
            memo = map
            runCatching {
                if (map.isEmpty()) kv.remove(KEY)
                else kv.put(KEY, json.encodeToString(ListSerializer(LocalResult.serializer()), map.values.toList()))
            }
        }

        /** Today's local results (past days pruned). */
        fun all(today: String): Map<String, LocalResult> = synchronized(lock) {
            val cur = load()
            val pruned = pruneDays(cur, today)
            if (pruned.size != cur.size) save(pruned)
            pruned
        }

        fun get(userId: String, day: String, gameMode: String): LocalResult? = synchronized(lock) {
            load()[key(userId, day, gameMode)]?.takeIf { it.day == day }
        }

        /** Write a finished daily (synchronous, before any network). */
        fun apply(r: LocalResult, today: String) = synchronized(lock) {
            save(applyLocalResult(pruneDays(load(), today), r))
        }

        fun reconcile(userId: String, day: String, gameMode: String, serverHasUser: Boolean) = synchronized(lock) {
            val cur = load()
            val next = OptimisticResults.reconcile(cur, userId, day, gameMode, serverHasUser)
            if (next.size != cur.size) save(next)
        }

        fun clear() = synchronized(lock) { save(emptyMap()) }

        private companion object { const val KEY = "optimistic-results-v1" }
    }
}
