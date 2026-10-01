package com.wordocious.app.data

import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL

/**
 * Async VS challenges, "race my run" (VS overhaul, founder 2026-10-01; spec
 * docs/VS_REDESIGN_SPEC.md §3–§5, §11). Android twin of the web
 * /api/vs/challenges routes, bearer-authed exactly like FriendsService.
 *
 * The challenger plays a fresh seed, then POSTs the run; each friend later
 * races a ghost of it. The server scores the race (core vsOutcome), writes
 * the one shared `matches` row and the challenger's user_stats side; the
 * racer's client records its own side through the normal live-VS path.
 * Everything here is no-throw.
 */
object VsChallengeService {
    private val client get() = SupabaseConfig.client
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** One side of a challenge: the numbers a live match compares, plus the words. */
    @Serializable
    data class Run(
        val solved: Boolean,
        val boardsSolved: Int,
        val totalBoards: Int = 1,
        val guesses: Int,
        val timeMs: Long,
        val guessLog: List<String> = emptyList(),
        val solutions: List<String> = emptyList(),
    ) {
        fun core() = com.wordocious.core.VsRun(solved, boardsSolved, guesses, timeMs)
    }

    @Serializable
    data class Challenger(val id: String, val username: String = "Player", val avatarUrl: String? = null)

    @Serializable
    data class ChallengeView(
        val code: String,
        val gameMode: String,
        val seed: String,
        val challenger: Challenger,
        val run: Run,
        val createdAt: String = "",
        val expiresAt: String = "",
        val isLink: Boolean = false,
    )

    /** The racer's stored result (GET /<code> `entry`). */
    @Serializable
    data class Entry(
        val outcome: String,
        val solved: Boolean = false,
        val boardsSolved: Int = 0,
        val guesses: Int = 0,
        val timeMs: Long = 0,
        val guessLog: List<String> = emptyList(),
    )

    @Serializable
    data class Lookup(
        val challenge: ChallengeView,
        val isMine: Boolean = false,
        val expired: Boolean = false,
        val entry: Entry? = null,
    )

    /** A friend's result on one of MY challenges — outcome from my (the sender's) side. */
    @Serializable
    data class SentResult(
        val username: String = "Player",
        val outcome: String = "draw",
        val guesses: Int = 0,
        val timeMs: Long = 0,
        val solved: Boolean = false,
    )

    @Serializable
    data class Sent(
        val code: String,
        val gameMode: String,
        val createdAt: String = "",
        val expiresAt: String = "",
        val invitees: Int = 0,
        val results: List<SentResult> = emptyList(),
    )

    @Serializable
    data class Listing(val incoming: List<ChallengeView> = emptyList(), val sent: List<Sent> = emptyList())

    @Serializable
    data class ResultResponse(
        val outcome: String = "draw",
        val margin: String = "",
        val challengerRun: Run? = null,
        val alreadyRecorded: Boolean = false,
    )

    @Serializable
    private data class CreateBody(
        val gameMode: String,
        val seed: String,
        val run: Run,
        val friendIds: List<String>,
        val link: Boolean,
    )

    @Serializable
    private data class ResultBody(val run: Run, val quit: Boolean? = null)

    sealed class CreateOutcome {
        data class Sent(val code: String, val invitees: Int) : CreateOutcome()
        data class Failed(val message: String) : CreateOutcome()
    }

    /** POST /api/vs/challenges — store my run and push the picked friends (Pro). */
    suspend fun create(gameMode: String, seed: String, run: Run, friendIds: List<String>, link: Boolean): CreateOutcome {
        val body = json.encodeToString(CreateBody(gameMode, seed, run, friendIds, link))
        val resp = api("POST", "/api/vs/challenges", body) ?: return CreateOutcome.Failed("Network error")
        val obj = runCatching { Json.parseToJsonElement(resp.second) as? JsonObject }.getOrNull()
        if (resp.first != 200) {
            return CreateOutcome.Failed(obj?.get("error")?.jsonPrimitive?.content ?: "Could not send the challenge")
        }
        val code = obj?.get("code")?.jsonPrimitive?.content ?: return CreateOutcome.Failed("Could not send the challenge")
        val invitees = obj["invitees"]?.jsonPrimitive?.content?.toIntOrNull() ?: friendIds.size
        return CreateOutcome.Sent(code, invitees)
    }

    /** GET /api/vs/challenges — open incoming challenges (newest first) and my recent sent ones. */
    suspend fun list(): Listing? {
        val resp = api("GET", "/api/vs/challenges") ?: return null
        if (resp.first != 200) return null
        return runCatching { json.decodeFromString<Listing>(resp.second) }.getOrNull()
    }

    sealed class LookupOutcome {
        data class Found(val lookup: Lookup) : LookupOutcome()
        /** 404 — not a challenge code (the lobby then tries it as a live private-match code). */
        object NotFound : LookupOutcome()
        data class Failed(val message: String) : LookupOutcome()
    }

    /** GET /api/vs/challenges/<code>. */
    suspend fun lookup(code: String): LookupOutcome {
        val resp = api("GET", "/api/vs/challenges/${code.trim().uppercase()}") ?: return LookupOutcome.Failed("Network error")
        if (resp.first == 404) return LookupOutcome.NotFound
        if (resp.first != 200) {
            val obj = runCatching { Json.parseToJsonElement(resp.second) as? JsonObject }.getOrNull()
            return LookupOutcome.Failed(obj?.get("error")?.jsonPrimitive?.content ?: "Could not open the challenge")
        }
        return runCatching { LookupOutcome.Found(json.decodeFromString<Lookup>(resp.second)) }
            .getOrElse { LookupOutcome.Failed("Could not open the challenge") }
    }

    /** How a race result POST went (§14): accepted, refused for good, or worth a retry. */
    sealed class PostOutcome {
        data class Accepted(val response: ResultResponse) : PostOutcome()
        /** A 4xx (400/403/404/410): the server will never take this run — drop it. */
        data class Rejected(val status: Int) : PostOutcome()
        /** A network error, a 5xx or a 401 (no session yet): keep it and send it again later. */
        object Retry : PostOutcome()
    }

    /** POST /api/vs/challenges/<code>/result — the server scores, stores and pushes. */
    suspend fun postResult(code: String, run: Run, quit: Boolean = false): PostOutcome {
        val resp = api("POST", "/api/vs/challenges/${code.uppercase()}/result", json.encodeToString(ResultBody(run, if (quit) true else null)))
            ?: return PostOutcome.Retry
        // 401 = no session yet: keep it (the 3-day cap still clears it).
        if (resp.first in 400..499 && resp.first != 401) return PostOutcome.Rejected(resp.first)
        if (resp.first != 200) return PostOutcome.Retry
        val parsed = runCatching { json.decodeFromString<ResultResponse>(resp.second) }.getOrNull()
        return if (parsed != null) PostOutcome.Accepted(parsed) else PostOutcome.Retry
    }

    @Serializable
    private data class LookingBody(val gameMode: String)

    /** The answer to KEEP WAITING's ping (§13): how many players were pinged, or throttled. */
    data class Looking(val pinged: Int, val throttled: Boolean)

    /** POST /api/vs/looking — ping the Pro players who switched "someone's looking" on (§13). */
    suspend fun looking(gameMode: String): Looking? {
        val resp = api("POST", "/api/vs/looking", json.encodeToString(LookingBody(gameMode))) ?: return null
        if (resp.first != 200) return null
        val obj = runCatching { Json.parseToJsonElement(resp.second) as? JsonObject }.getOrNull() ?: return null
        return Looking(
            pinged = obj["pinged"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
            throttled = obj["throttled"]?.jsonPrimitive?.content == "true",
        )
    }

    /** Whole hours left until `expiresAt` (minimum 1), for "17h left" / "17H". */
    fun hoursLeft(expiresAt: String): Int {
        val ms = runCatching { java.time.Instant.parse(expiresAt).toEpochMilli() - System.currentTimeMillis() }.getOrDefault(0L)
        return maxOf(1, Math.ceil(ms / 3_600_000.0).toInt())
    }

    /** True when `iso` is within the last `hours` hours. */
    fun isRecent(iso: String, hours: Long = 24): Boolean =
        runCatching { System.currentTimeMillis() - java.time.Instant.parse(iso).toEpochMilli() <= hours * 3_600_000L }.getOrDefault(false)

    /** (statusCode, bodyText) or null — the FriendsService.api shape. */
    private suspend fun api(method: String, path: String, body: String? = null): Pair<Int, String>? =
        withContext(Dispatchers.IO) {
            runCatching {
                val token = client.auth.currentSessionOrNull()?.accessToken ?: return@withContext null
                val conn = URL("https://wordocious.com$path").openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000; conn.readTimeout = 15_000
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
