package com.wordocious.app.data

import com.wordocious.core.FriendlyLive
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.broadcast
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeJoinsAs
import io.github.jan.supabase.realtime.decodeLeavesAs
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

/**
 * Live pocket games, Android client (FRIDAY-QUEUE 9b; rules in core FriendlyLive.kt, TS twin
 * packages/core/src/friendly-live.ts). One Realtime channel per game on [SupabaseConfig.realtimeClient]:
 *  - broadcast "move": the server sends the accepted move's view the instant it is saved
 *  - postgres_changes on friendly_game_pings: the backup, it only says "refetch"
 *  - presence: the friend is in the game / has left (identified by the tracked `user` field)
 *  - broadcast "react": live emoji from the fixed reaction set
 * The screen owns one while a game is open and FriendlyLive.SWITCH_KEY is live. Off, or the socket
 * down: the screen's poll carries everything (FriendlyLive.pollIntervalMs). Never throws.
 */
class FriendlyLiveChannel(private val scope: CoroutineScope) {
    private val _socketUp = MutableStateFlow(false)
    val socketUp: StateFlow<Boolean> = _socketUp.asStateFlow()
    private val _peerPresent = MutableStateFlow(false)
    val peerPresent: StateFlow<Boolean> = _peerPresent.asStateFlow()
    private val _peerEverSeen = MutableStateFlow(false)
    val peerEverSeen: StateFlow<Boolean> = _peerEverSeen.asStateFlow()

    /** A view broadcast for ME (already the receiver's view; my own are filtered out). */
    var onView: ((FriendlyGamesService.GameView) -> Unit)? = null
    /** The backup ping fired, or the socket just (re)connected: refetch through the API. */
    var onRefetch: (() -> Unit)? = null
    var onReaction: ((String) -> Unit)? = null

    @Serializable
    private data class Peer(val user: String = "", val thinking: Boolean = false)

    private var channel: RealtimeChannel? = null
    private var jobs: List<Job> = emptyList()
    private var myId = ""
    private var oppId = ""
    private var gameId = ""
    private var lastReact = 0L

    val isStarted: Boolean get() = channel != null

    fun start(gameId: String, userId: String, opponentId: String) {
        stop()
        this.gameId = gameId
        myId = userId.lowercase()
        oppId = opponentId.lowercase()
        val me = myId
        runCatching {
            val client = SupabaseConfig.realtimeClient
            val ch = client.channel(FriendlyLive.topic(gameId))
            channel = ch
            // Create every flow BEFORE subscribing (the postgres filter is part of the join).
            val moves = ch.broadcastFlow<JsonObject>(FriendlyLive.EVENT_MOVE)
            val reacts = ch.broadcastFlow<JsonObject>(FriendlyLive.EVENT_REACT)
            val pings = ch.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = FriendlyLive.PING_TABLE
                filter("game_id", FilterOperator.EQ, gameId)
            }
            val presence = ch.presenceChangeFlow()
            jobs = listOf(
                scope.launch { runCatching { moves.collect { handleMove(it) } } },
                scope.launch { runCatching { reacts.collect { handleReaction(it) } } },
                scope.launch { runCatching { pings.collect { onRefetch?.invoke() } } },
                scope.launch {
                    runCatching {
                        presence.collect { a ->
                            val joined = runCatching { a.decodeJoinsAs<Peer>() }.getOrDefault(emptyList())
                            val left = runCatching { a.decodeLeavesAs<Peer>() }.getOrDefault(emptyList())
                            if (joined.any { it.user.lowercase() == oppId }) { _peerPresent.value = true; _peerEverSeen.value = true }
                            else if (left.any { it.user.lowercase() == oppId }) _peerPresent.value = false
                        }
                    }
                },
                scope.launch {
                    runCatching {
                        ch.status.collect { s ->
                            when (s) {
                                RealtimeChannel.Status.SUBSCRIBED -> {
                                    _socketUp.value = true
                                    runCatching { ch.track(buildJsonObject { put("user", me); put("thinking", false) }) }
                                    // The channel joined with the anon key; give it the player's JWT so the backup
                                    // postgres_changes (RLS: players only) is delivered.
                                    runCatching { SupabaseConfig.client.auth.currentAccessTokenOrNull()?.let { ch.updateAuth(it) } }
                                    onRefetch?.invoke() // catch up on anything missed while connecting
                                }
                                RealtimeChannel.Status.UNSUBSCRIBED -> _socketUp.value = false
                                else -> {}
                            }
                        }
                    }
                },
                scope.launch { runCatching { ch.subscribe(blockUntilSubscribed = false) } },
            )
        }.onFailure { stop() }
    }

    fun stop() {
        jobs.forEach { it.cancel() }
        jobs = emptyList()
        val ch = channel
        channel = null
        _socketUp.value = false
        _peerPresent.value = false
        _peerEverSeen.value = false
        if (ch != null) scope.launch { runCatching { SupabaseConfig.realtimeClient.realtime.removeChannel(ch) } }
    }

    /** Send a live reaction (throttled). True if it went out. */
    fun sendReaction(key: String): Boolean {
        val ch = channel ?: return false
        val now = System.currentTimeMillis()
        if (!_socketUp.value || !FriendlyLive.isReaction(key) || now - lastReact < FriendlyLive.REACT_COOLDOWN_MS) return false
        lastReact = now
        val me = myId
        scope.launch { runCatching { ch.broadcast(FriendlyLive.EVENT_REACT, buildJsonObject { put("from", me); put("reaction", key) }) } }
        return true
    }

    // ── Incoming ────────────────────────────────────────────────────────────

    /** The flow may hand back the inner payload or the full message; accept both. */
    private fun payloadOf(o: JsonObject): JsonObject = (o["payload"] as? JsonObject) ?: o

    private fun JsonObject.str(k: String): String? = (this[k] as? JsonPrimitive)?.contentOrNull

    private fun handleMove(raw: JsonObject) {
        val p = payloadOf(raw)
        if (p.str("by")?.lowercase() == myId) return
        val game = FriendlyGamesService.decodeGame(p["game"]) ?: return
        if (game.id != gameId) return
        onView?.invoke(game)
    }

    private fun handleReaction(raw: JsonObject) {
        val p = payloadOf(raw)
        if (p.str("from")?.lowercase() == myId) return
        val key = p.str("reaction")
        if (FriendlyLive.isReaction(key)) onReaction?.invoke(key!!)
    }
}
