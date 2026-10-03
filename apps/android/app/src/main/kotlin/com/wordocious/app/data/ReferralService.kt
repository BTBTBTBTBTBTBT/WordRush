package com.wordocious.app.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL

// Referral program client — reads own rows via PostgREST (RLS:
// inviter-read-only); create/cancel go through the web API routes
// (service-role writes) with the session token. Mirrors iOS InvitePanelView.
object ReferralService {
    private val client get() = SupabaseConfig.client

    @Serializable
    data class ReferralRow(
        val id: String,
        val code: String,
        val status: String,
        @SerialName("created_at") val createdAt: String,
        @SerialName("expires_at") val expiresAt: String,
        // §251: who redeemed it (resolved to a username for settled rows).
        @SerialName("invitee_id") val inviteeId: String? = null,
        @SerialName("converted_plan") val convertedPlan: String? = null,
    )

    @Serializable
    data class Leader(val username: String, val count: Int)

    @Serializable
    private data class LeaderboardResponse(val leaders: List<Leader> = emptyList())

    suspend fun myInvites(): List<ReferralRow> = runCatching {
        val userId = AuthService.userId ?: return emptyList()
        client.postgrest["referrals"]
            .select(Columns.raw("id, code, status, created_at, expires_at, invitee_id, converted_plan")) {
                filter { eq("inviter_id", userId) }
                order("created_at", Order.DESCENDING)
                limit(20)
            }
            .decodeList<ReferralRow>()
    }.getOrDefault(emptyList())

    /** §251: invitee_id → username — profiles is world-readable, one batch. */
    @Serializable
    private data class NameRow(val id: String, val username: String? = null)

    suspend fun inviteeNames(ids: List<String>): Map<String, String> = runCatching {
        if (ids.isEmpty()) return emptyMap()
        client.postgrest["profiles"]
            .select(Columns.raw("id, username")) { filter { isIn("id", ids) } }
            .decodeList<NameRow>()
            .mapNotNull { r -> r.username?.let { r.id to it } }
            .toMap()
    }.getOrDefault(emptyMap())

    suspend fun leaderboard(): List<Leader> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val body = URL("https://wordocious.com/api/referrals/leaderboard").readText()
                Json { ignoreUnknownKeys = true }.decodeFromString<LeaderboardResponse>(body).leaders
            }.getOrDefault(emptyList())
        }

    /** Returns (code, error) — code null on failure. */
    suspend fun createInvite(): Pair<String?, String?> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val resp = apiPost("/api/referrals/create")
                ?: return@withContext null to "Could not create an invite."
            val json = runCatching { Json.parseToJsonElement(resp) as? JsonObject }.getOrNull()
            val code = json?.get("code")?.jsonPrimitive?.content
            val error = json?.get("error")?.jsonPrimitive?.content
            code to error
        }

    suspend fun cancelInvite(id: String) {
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            apiPost("/api/referrals/cancel", """{"id":"$id"}""")
        }
    }

    /** Founder 10-03: the caller's dismissed credit notices on other devices (GET /api/referrals/dismiss). */
    suspend fun dismissedIds(): List<String> = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        runCatching {
            val token = client.auth.currentSessionOrNull()?.accessToken ?: return@runCatching emptyList<String>()
            val conn = URL("https://wordocious.com/api/referrals/dismiss").openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000; conn.readTimeout = 10_000
            conn.setRequestProperty("Authorization", "Bearer $token")
            val text = try { if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null } finally { conn.disconnect() }
            val arr = text?.let { org.json.JSONObject(it).optJSONArray("ids") } ?: return@runCatching emptyList<String>()
            (0 until arr.length()).map { arr.getString(it) }
        }.getOrDefault(emptyList())
    }

    /** Founder 10-03: flag credit notices dismissed for the player's other devices (best effort). */
    suspend fun dismiss(ids: List<String>) {
        if (ids.isEmpty()) return
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            apiPost("/api/referrals/dismiss", org.json.JSONObject().put("ids", org.json.JSONArray(ids)).toString())
        }
    }

    /** /join landing: GET /api/referrals/lookup → (status, inviter name). Null on a network failure. */
    suspend fun lookup(code: String): Pair<String, String?>? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        runCatching {
            val text = URL("https://wordocious.com/api/referrals/lookup?code=$code").readText()
            val o = org.json.JSONObject(text)
            o.optString("status", "notfound") to o.optString("inviterName").takeIf { it.isNotBlank() && it != "null" }
        }.getOrNull()
    }

    /** /join landing: POST /api/referrals/redeem {code} → (ok, reason). reason "network" when unreachable. */
    suspend fun redeem(code: String): Pair<Boolean, String?> = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val text = apiPost("/api/referrals/redeem", """{"code":"$code"}""") ?: return@withContext false to "network"
        runCatching {
            val o = org.json.JSONObject(text)
            o.optBoolean("ok", false) to o.optString("reason").takeIf { it.isNotBlank() }
        }.getOrDefault(false to "network")
    }

    private fun apiPost(path: String, body: String? = null): String? = runCatching {
        val token = client.auth.currentSessionOrNull()?.accessToken ?: return null
        val conn = URL("https://wordocious.com$path").openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000; conn.readTimeout = 15_000
        conn.requestMethod = "POST"
        conn.setRequestProperty("Authorization", "Bearer $token")
        if (body != null) {
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.outputStream.use { it.write(body.toByteArray()) }
        }
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        stream?.bufferedReader()?.readText()
    }.getOrNull()
}
