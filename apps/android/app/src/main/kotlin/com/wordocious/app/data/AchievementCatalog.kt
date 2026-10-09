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
    private const val CACHE_KEY = "achievements-catalog-v2"

    @Serializable
    private data class Payload(val achievements: List<AchievementService.AchievementDef> = emptyList())

    private var mem: List<AchievementService.AchievementDef>? = null

    /** BE: hidden achievements (their tracking hasn't shipped) never show in the grid or popups. */
    fun visible(all: List<AchievementService.AchievementDef>): List<AchievementService.AchievementDef> = all.filter { !it.hidden }

    /**
     * What a player's lists show (the badge grid, the Title Shelves, the counts): every visible achievement, a
     * `secret` one (the musical cast's tunes) only once [unlocked] has it — core achievementListed.
     */
    fun listed(all: List<AchievementService.AchievementDef>, unlocked: (String) -> Boolean): List<AchievementService.AchievementDef> =
        all.filter { com.wordocious.core.achievementListed(it.hidden, it.secret, it.key, unlocked) }

    /**
     * The last fetch, else the bundled snapshot (assets/achievements-catalog.json, pinned to web
     * ACHIEVEMENT_CATALOG by lib/achievements-catalog-snapshot.test.ts), so the Title Shelves and the badge
     * grid are never bare on a first offline open; the live fetch replaces it.
     */
    fun cached(): List<AchievementService.AchievementDef> {
        mem?.let { return it }
        val raw = prefs.getString(CACHE_KEY, null)
        val fromCache = raw?.let { r -> runCatching { visible(json.decodeFromString(Payload.serializer(), r).achievements) }.getOrNull() }
        val list = fromCache?.takeIf { it.isNotEmpty() } ?: bundled()
        return list.also { if (it.isNotEmpty() && fromCache != null) mem = it }
    }

    private var bundledMem: List<AchievementService.AchievementDef>? = null
    fun bundled(): List<AchievementService.AchievementDef> = bundledMem ?: runCatching {
        val body = App.instance.assets.open("achievements-catalog.json").bufferedReader().use { it.readText() }
        visible(json.decodeFromString(Payload.serializer(), body).achievements)
    }.getOrDefault(emptyList()).also { bundledMem = it }

    suspend fun load(): List<AchievementService.AchievementDef> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/achievements").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000; useCaches = false
            }
            val result = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val list = visible(json.decodeFromString(Payload.serializer(), body).achievements)
                mem = list
                prefs.edit().putString(CACHE_KEY, body).apply()
                list
            } else null
            conn.disconnect()
            result
        }.getOrNull() ?: cached()
    }
}
