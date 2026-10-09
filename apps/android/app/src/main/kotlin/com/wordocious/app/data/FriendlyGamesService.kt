package com.wordocious.app.data

import com.wordocious.core.FriendlyKind
import com.wordocious.core.FriendlyMove
import com.wordocious.core.FriendlyState
import com.wordocious.core.Side
import com.wordocious.core.decodeFriendlyState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

/**
 * Friends pocket games (Friends overhaul, founder 2026-10-01; spec
 * docs/FRIENDS_REDESIGN_SPEC.md §4) — Rock Paper Scissors, Tic-Tac-Tile, Call
 * It and Pass the Puzzle against a friend. The server runs the rules (core
 * applyFriendlyMove) and is the only writer; this client lists, starts, polls
 * and moves through /api/friends/games, bearer-authed like FriendsService.
 * Every call is no-throw.
 */
object FriendlyGamesService {
    data class Opponent(val id: String, val username: String, val avatarUrl: String?, val avatarEmoji: String?)

    /** One game as the viewer sees it (the server's GameView). */
    data class GameView(
        override val id: String,
        val kind: FriendlyKind,
        val title: String,
        override val me: Side,
        val opponent: Opponent,
        override val state: FriendlyState,
        /** active | done | resigned | expired */
        val status: String,
        override val yourTurn: Boolean,
        /** win | loss | draw, or null while active. */
        val result: String?,
        val line: String,
        /** Pass the Puzzle's answer, once it is over. */
        val answer: String?,
        val createdAt: String,
        override val updatedAt: String,
    ) : com.wordocious.core.FriendlyLive.View {
        override val active: Boolean get() = status == "active"
        val updatedMs: Long? get() = runCatching { java.time.OffsetDateTime.parse(updatedAt).toInstant().toEpochMilli() }
            .recoverCatching { java.time.Instant.parse(updatedAt).toEpochMilli() }.getOrNull()
    }

    private val _active = MutableStateFlow<List<GameView>>(emptyList())
    /** My games in play, your-turn first. */
    val active: StateFlow<List<GameView>> = _active.asStateFlow()
    private val _recent = MutableStateFlow<List<GameView>>(emptyList())
    /** Games that ended in the last 7 days. */
    val recent: StateFlow<List<GameView>> = _recent.asStateFlow()

    private fun JsonObject.str(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull

    /** Decode one GameView; null when it is not a shape this build understands. */
    fun decodeGame(el: JsonElement?): GameView? {
        val o = el as? JsonObject ?: return null
        val kind = FriendlyKind.from(o.str("kind")) ?: return null
        val state = decodeFriendlyState(o["state"]) ?: return null
        val opp = o["opponent"] as? JsonObject
        return GameView(
            id = o.str("id") ?: return null,
            kind = kind,
            title = o.str("title") ?: kind.title,
            me = Side.from(o.str("me")) ?: return null,
            opponent = Opponent(
                id = opp?.str("id").orEmpty(),
                username = opp?.str("username") ?: "Friend",
                avatarUrl = opp?.str("avatarUrl"),
                avatarEmoji = opp?.str("avatarEmoji"),
            ),
            state = state,
            status = o.str("status") ?: "active",
            yourTurn = (o["yourTurn"] as? JsonPrimitive)?.booleanOrNull ?: false,
            result = o.str("result"),
            line = o.str("line").orEmpty(),
            answer = o.str("answer"),
            createdAt = o.str("createdAt").orEmpty(),
            updatedAt = o.str("updatedAt").orEmpty(),
        )
    }

    private fun parse(body: String): JsonObject? = runCatching { Json.parseToJsonElement(body) as? JsonObject }.getOrNull()

    /** GET /api/friends/games → {active, recent}. Keeps the last good lists on failure. */
    suspend fun load() {
        val resp = FriendsService.api("GET", "/api/friends/games") ?: return
        if (resp.first != 200) return
        val o = parse(resp.second) ?: return
        _active.value = (o["active"] as? JsonArray)?.mapNotNull { decodeGame(it) } ?: emptyList()
        _recent.value = (o["recent"] as? JsonArray)?.mapNotNull { decodeGame(it) } ?: emptyList()
    }

    /** Fold a fresh copy of one game into the cached lists (badge + YOUR TURN stay current). */
    private fun fold(g: GameView) {
        val rest = _active.value.filterNot { it.id == g.id }
        if (g.active) {
            _active.value = (rest + g).sortedByDescending { it.yourTurn }
        } else {
            _active.value = rest
            _recent.value = (listOf(g) + _recent.value.filterNot { it.id == g.id }).take(10)
        }
    }

    sealed class StartOutcome {
        data class Started(val game: GameView, val existing: Boolean) : StartOutcome()
        data class Failed(val message: String) : StartOutcome()
    }

    /** POST /api/friends/games {kind, friendId, stake?} — one open game per kind per pair (returns it). */
    suspend fun start(kind: FriendlyKind, friendId: String, stake: String? = null): StartOutcome {
        val body = buildJsonObject {
            put("kind", kind.raw)
            put("friendId", friendId)
            if (stake != null) put("stake", stake)
        }.toString()
        val resp = FriendsService.api("POST", "/api/friends/games", body) ?: return StartOutcome.Failed("Network error")
        val o = parse(resp.second)
        if (resp.first != 200) return StartOutcome.Failed(o?.str("error") ?: "Could not start the game")
        val g = decodeGame(o?.get("game")) ?: return StartOutcome.Failed("Could not start the game")
        fold(g)
        return StartOutcome.Started(g, (o?.get("existing") as? JsonPrimitive)?.booleanOrNull ?: false)
    }

    /** GET /api/friends/games/<id> — the game screen polls this every 2 s (it also marks me as watching). */
    suspend fun get(id: String): GameView? {
        val resp = FriendsService.api("GET", "/api/friends/games/$id") ?: return null
        if (resp.first != 200) return null
        return decodeGame(parse(resp.second)?.get("game"))?.also { fold(it) }
    }

    sealed class MoveOutcome {
        data class Moved(val game: GameView) : MoveOutcome()
        /** 400: a bad move — show [message] inline. */
        data class Rejected(val message: String) : MoveOutcome()
        /** 409 {retry:true}: the game moved on — refetch and let the player try again. */
        data class Retry(val message: String) : MoveOutcome()
        data class Failed(val message: String) : MoveOutcome()
    }

    /** POST /api/friends/games/<id>/move {move}. */
    suspend fun move(id: String, move: FriendlyMove): MoveOutcome {
        val body = buildJsonObject { put("move", move.toJson()) }.toString()
        val resp = FriendsService.api("POST", "/api/friends/games/$id/move", body) ?: return MoveOutcome.Failed("Network error — try again")
        val o = parse(resp.second)
        val err = o?.str("error")
        return when (resp.first) {
            200 -> decodeGame(o?.get("game"))?.let { fold(it); MoveOutcome.Moved(it) } ?: MoveOutcome.Failed("Something went wrong")
            400 -> MoveOutcome.Rejected(err ?: "That move doesn't work")
            409 -> if ((o?.get("retry") as? JsonPrimitive)?.booleanOrNull == true) MoveOutcome.Retry(err ?: "The game moved on — try again")
            else MoveOutcome.Rejected(err ?: "This game is over")
            else -> MoveOutcome.Failed(err ?: "Something went wrong")
        }
    }

    /** POST /api/friends/games/<id>/resign. */
    suspend fun resign(id: String): GameView? {
        val resp = FriendsService.api("POST", "/api/friends/games/$id/resign", "{}") ?: return null
        if (resp.first != 200) return null
        return decodeGame(parse(resp.second)?.get("game"))?.also { fold(it) }
    }
}
