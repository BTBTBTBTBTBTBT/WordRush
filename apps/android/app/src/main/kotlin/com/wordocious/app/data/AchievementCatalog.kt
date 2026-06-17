package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL

/**
 * The achievement display catalog (key/name/description/category/icon), fetched
 * from wordocious.com/api/achievements so the list stays single-sourced in web
 * lib/achievement-service.ts. Persists the last fetch to SharedPreferences so the
 * profile grid renders offline after the first load. Unlock DETECTION stays in
 * AchievementService (key-string logic, independent of this list).
 */
object AchievementCatalog {
    private val json = Json { ignoreUnknownKeys = true }
    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_prefs", Context.MODE_PRIVATE)
    }
    private const val CACHE_KEY = "achievements-catalog-v1"

    @Serializable
    private data class Payload(val achievements: List<AchievementService.AchievementDef> = emptyList())

    private var mem: List<AchievementService.AchievementDef>? = null

    fun cached(): List<AchievementService.AchievementDef> {
        mem?.let { return it }
        val raw = prefs.getString(CACHE_KEY, null) ?: return emptyList()
        return runCatching { json.decodeFromString(Payload.serializer(), raw).achievements }
            .getOrDefault(emptyList()).also { if (it.isNotEmpty()) mem = it }
    }

    suspend fun load(): List<AchievementService.AchievementDef> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/achievements").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val result = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val list = json.decodeFromString(Payload.serializer(), body).achievements
                mem = list
                prefs.edit().putString(CACHE_KEY, body).apply()
                list
            } else null
            conn.disconnect()
            result
        }.getOrNull() ?: cached()
    }
}
