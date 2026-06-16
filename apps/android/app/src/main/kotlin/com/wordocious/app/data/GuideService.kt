package com.wordocious.app.data

import com.wordocious.core.GameMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL

/**
 * Per-mode strategy guides for the in-game "?" help sheet — fetched from the web
 * (wordocious.com/api/guides) so the prose stays single-sourced in
 * lib/guide-content.ts. Memory-cached for the process.
 */
object GuideService {
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    data class ModeGuide(
        val slug: String,
        val title: String,
        val accent: String,
        val tagline: String,
        val facts: List<Fact> = emptyList(),
        val rules: List<String> = emptyList(),
        val scoring: List<String> = emptyList(),
        val tips: List<Tip> = emptyList(),
    )
    @Serializable data class Fact(val label: String, val value: String)
    @Serializable data class Tip(val heading: String, val body: String)
    @Serializable private data class Payload(val guides: List<ModeGuide> = emptyList())

    private var cache: Map<String, ModeGuide>? = null

    /** GameMode → guide slug (matches lib/guide-content.ts). */
    private fun slugFor(mode: GameMode): String = when (mode) {
        GameMode.DUEL -> "classic"
        GameMode.DUEL_6 -> "six"
        GameMode.DUEL_7 -> "seven"
        GameMode.QUORDLE -> "quadword"
        GameMode.OCTORDLE -> "octoword"
        GameMode.SEQUENCE -> "succession"
        GameMode.RESCUE -> "deliverance"
        GameMode.GAUNTLET -> "gauntlet"
        GameMode.PROPERNOUNDLE -> "propernoundle"
        else -> "classic"
    }

    suspend fun guide(mode: GameMode): ModeGuide? = withContext(Dispatchers.IO) {
        if (cache == null) {
            runCatching {
                val conn = (URL("https://wordocious.com/api/guides").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
                }
                if (conn.responseCode in 200..299) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    cache = json.decodeFromString(Payload.serializer(), body).guides.associateBy { it.slug }
                }
                conn.disconnect()
            }
        }
        cache?.get(slugFor(mode))
    }
}
