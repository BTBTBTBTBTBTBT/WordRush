package com.wordocious.app.data

import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL

/**
 * FRIENDS (bible §207) — Android twin of apps/web/lib/friends-service.ts and
 * iOS FriendsService.swift.
 *
 * All mutations go through the /api/friends web routes (friendships has NO
 * client write policies — the pair-block check and pushes live server-side);
 * the one GET brings friends + requests with profile chrome in a single
 * round trip. Caches are in-memory per launch, the ModerationService shape:
 * synchronous accessors for render-time filtering, optimistic mutations,
 * everything no-throw.
 */
object FriendsService {
    private val client get() = SupabaseConfig.client
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    data class FriendProfile(
        val id: String,
        val username: String,
        @SerialName("avatar_url") val avatarUrl: String? = null,
        val level: Int = 0,
        val since: String? = null,
        val requestedAt: String? = null,
    )

    @Serializable
    private data class FriendsPayload(
        val friends: List<FriendProfile> = emptyList(),
        val incoming: List<FriendProfile> = emptyList(),
        val outgoing: List<String> = emptyList(),
    )

    /** Accepted friend ids (lowercased) — the leaderboard filter set. */
    var friendIds: Set<String> = emptySet(); private set
    var friends: List<FriendProfile> = emptyList(); private set
    var incoming: List<FriendProfile> = emptyList(); private set
    var outgoing: Set<String> = emptySet(); private set
    var loaded = false; private set

    /** Bumped on every cache change — Compose observes via snapshot polling
     *  (LaunchedEffect keys) exactly like LeaderboardService reload tokens. */
    @Volatile var version = 0; private set
    private val listeners = mutableSetOf<() -> Unit>()

    fun addListener(l: () -> Unit): () -> Unit {
        synchronized(listeners) { listeners.add(l) }
        return { synchronized(listeners) { listeners.remove(l) } }
    }

    private fun notifyChanged() {
        version += 1
        val copy = synchronized(listeners) { listeners.toList() }
        copy.forEach { runCatching(it) }
    }

    fun isFriend(userId: String) = friendIds.contains(userId.lowercase())
    fun hasRequested(userId: String) = outgoing.contains(userId.lowercase())
    fun hasIncomingFrom(userId: String) = incoming.any { it.id.equals(userId, ignoreCase = true) }

    /** Load once per launch (force to refresh). No-throw. */
    suspend fun load(force: Boolean = false) {
        if (loaded && !force) return
        val resp = api("GET", "/api/friends") ?: return
        val payload = runCatching { json.decodeFromString<FriendsPayload>(resp.second) }.getOrNull() ?: return
        if (resp.first != 200) return
        friends = payload.friends
        incoming = payload.incoming
        friendIds = payload.friends.map { it.id.lowercase() }.toSet()
        outgoing = payload.outgoing.map { it.lowercase() }.toSet()
        loaded = true
        notifyChanged()
    }

    sealed class RequestOutcome {
        data object Pending : RequestOutcome()
        data object Accepted : RequestOutcome()
        data class Failed(val message: String) : RequestOutcome()
    }

    /** Send a friend request by id or exact username (mutual → auto-accept). */
    suspend fun request(addresseeId: String? = null, username: String? = null): RequestOutcome {
        val body = when {
            addresseeId != null -> """{"addresseeId":"$addresseeId"}"""
            username != null -> {
                val esc = username.replace("\\", "\\\\").replace("\"", "\\\"")
                """{"username":"$esc"}"""
            }
            else -> "{}"
        }
        val resp = api("POST", "/api/friends/request", body)
            ?: return RequestOutcome.Failed("Network error")
        val obj = runCatching { Json.parseToJsonElement(resp.second) as? JsonObject }.getOrNull()
        if (resp.first != 200) {
            return RequestOutcome.Failed(obj?.get("error")?.jsonPrimitive?.content ?: "Could not send request")
        }
        val friendId = obj?.get("friendId")?.jsonPrimitive?.content.orEmpty()
        return if (obj?.get("status")?.jsonPrimitive?.content == "accepted") {
            friendIds = friendIds + friendId.lowercase()
            incoming = incoming.filterNot { it.id.equals(friendId, ignoreCase = true) }
            load(force = true)   // pull profile chrome for the new friend
            notifyChanged()
            RequestOutcome.Accepted
        } else {
            outgoing = outgoing + friendId.lowercase()
            notifyChanged()
            RequestOutcome.Pending
        }
    }

    suspend fun accept(requesterId: String): Boolean {
        incoming.firstOrNull { it.id == requesterId }?.let { friends = friends + it }
        incoming = incoming.filterNot { it.id == requesterId }
        friendIds = friendIds + requesterId.lowercase()
        notifyChanged()
        return api("POST", "/api/friends/accept", """{"requesterId":"$requesterId"}""")?.first == 200
    }

    suspend fun decline(requesterId: String): Boolean {
        incoming = incoming.filterNot { it.id == requesterId }
        outgoing = outgoing - requesterId.lowercase()
        notifyChanged()
        return api("POST", "/api/friends/decline", """{"requesterId":"$requesterId"}""")?.first == 200
    }

    suspend fun remove(friendId: String): Boolean {
        friendIds = friendIds - friendId.lowercase()
        friends = friends.filterNot { it.id == friendId }
        outgoing = outgoing - friendId.lowercase()
        notifyChanged()
        return api("POST", "/api/friends/remove", """{"friendId":"$friendId"}""")?.first == 200
    }

    /** Fire-and-forget overtake check after a daily result saves (§207). */
    suspend fun beatCheck(day: String, gameMode: String, playType: String = "solo") {
        api("POST", "/api/friends/beat-check",
            """{"day":"$day","gameMode":"$gameMode","playType":"$playType"}""")
    }

    enum class TauntOutcome { SENT, ALREADY_SENT, FAILED }

    /** One-tap canned taunt (ids from FriendTaunts.ALL; 1/friend/day). */
    suspend fun taunt(friendId: String, tauntId: String, day: String): TauntOutcome {
        val resp = api("POST", "/api/friends/taunt",
            """{"friendId":"$friendId","tauntId":"$tauntId","day":"$day"}""")
            ?: return TauntOutcome.FAILED
        return when (resp.first) {
            200 -> TauntOutcome.SENT
            429 -> TauntOutcome.ALREADY_SENT
            else -> TauntOutcome.FAILED
        }
    }

    /** (statusCode, bodyText) or null — the ReferralService apiPost shape. */
    private suspend fun api(method: String, path: String, body: String? = null): Pair<Int, String>? =
        withContext(Dispatchers.IO) {
            runCatching {
                val token = client.auth.currentSessionOrNull()?.accessToken ?: return@withContext null
                val conn = URL("https://wordocious.com$path").openConnection() as HttpURLConnection
                conn.requestMethod = method
                conn.setRequestProperty("Authorization", "Bearer $token")
                if (body != null) {
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    conn.outputStream.use { it.write(body.toByteArray()) }
                }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                code to (stream?.bufferedReader()?.readText().orEmpty())
            }.getOrNull()
        }
}

/** The canned taunt list — MUST mirror apps/web/lib/friends-taunts.ts. */
object FriendTaunts {
    data class Taunt(val id: String, val text: String)
    val ALL = listOf(
        Taunt("sweep", "🧹 Swept it. Your move."),
        Taunt("silver", "🥈 Silver looks good on you"),
        Taunt("slowpoke", "🐢 Still waiting on you today…"),
        Taunt("scoreboard", "👀 The scoreboard has spoken"),
        Taunt("warmup", "📈 Cute score. Was that a warm-up?"),
        Taunt("crown", "👑 The crown stays here"),
        Taunt("rentfree", "🏠 Top of the board — rent free"),
        Taunt("alarm", "⏰ Your daily puzzles miss you"),
    )
}
