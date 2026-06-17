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
 * Single-sourced static copy (FAQ / Help / About / Support), fetched from
 * wordocious.com/api/content so the prose stays in one place (web
 * lib/content/static-content.ts). Mirrors GuideService but PERSISTS the last
 * fetch to SharedPreferences, so content renders offline after the first load.
 * Privacy + Terms are NOT here — they stay hardcoded for offline / pre-sign-in.
 */
object ContentService {
    private val json = Json { ignoreUnknownKeys = true }
    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_prefs", Context.MODE_PRIVATE)
    }
    private const val CACHE_KEY = "static-content-cache-v1"

    @Serializable data class FaqItem(val q: String, val a: String)
    @Serializable data class FaqSection(val heading: String, val items: List<FaqItem> = emptyList())
    @Serializable data class HelpMode(val title: String, val desc: String, val accent: String, val glyph: String? = null)
    @Serializable data class SubItem(val heading: String, val body: String, val accent: String? = null)
    @Serializable data class Section(val heading: String, val paragraphs: List<String> = emptyList(), val items: List<SubItem> = emptyList())
    @Serializable data class Payload(
        val faq: List<FaqSection> = emptyList(),
        val helpModes: List<HelpMode> = emptyList(),
        val helpFaq: List<FaqItem> = emptyList(),
        val about: List<Section> = emptyList(),
        val support: List<Section> = emptyList(),
    )

    private var memCache: Payload? = null

    /** Last-persisted payload for an instant first render (web sessionStorage parity). */
    fun cached(): Payload? {
        memCache?.let { return it }
        val raw = prefs.getString(CACHE_KEY, null) ?: return null
        return runCatching { json.decodeFromString(Payload.serializer(), raw) }.getOrNull()?.also { memCache = it }
    }

    /** Fetch the live copy; persists on success. Falls back to the cache. */
    suspend fun load(): Payload? = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/content").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val result = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val payload = json.decodeFromString(Payload.serializer(), body)
                memCache = payload
                prefs.edit().putString(CACHE_KEY, body).apply()
                payload
            } else null
            conn.disconnect()
            result
        }.getOrNull() ?: cached()
    }
}
