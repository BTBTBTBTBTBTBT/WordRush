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
    )

    @Serializable
    data class Leader(val username: String, val count: Int)

    @Serializable
    private data class LeaderboardResponse(val leaders: List<Leader> = emptyList())

    suspend fun myInvites(): List<ReferralRow> = runCatching {
        val userId = AuthService.userId ?: return emptyList()
        client.postgrest["referrals"]
            .select(Columns.raw("id, code, status, created_at, expires_at")) {
                filter { eq("inviter_id", userId) }
                order("created_at", Order.DESCENDING)
                limit(20)
            }
            .decodeList<ReferralRow>()
    }.getOrDefault(emptyList())

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

    private fun apiPost(path: String, body: String? = null): String? = runCatching {
        val token = client.auth.currentSessionOrNull()?.accessToken ?: return null
        val conn = URL("https://wordocious.com$path").openConnection() as HttpURLConnection
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
