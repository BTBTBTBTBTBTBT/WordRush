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
        /** "The buttons" card (More Games §19): one row per on-screen control. */
        val controls: List<Control> = emptyList(),
    )
    @Serializable data class Fact(val label: String, val value: String)
    @Serializable data class Tip(val heading: String, val body: String)
    @Serializable data class Control(val icon: String, val label: String, val body: String)
    @Serializable private data class Payload(val guides: List<ModeGuide> = emptyList())

    private var cache: Map<String, ModeGuide>? = null
    private var networkLoaded = false

    /** GameMode → guide slug — from the catalog (modes.json guideSlug), so a new
     *  game can never fall back to Classic's rules (More Games §19). */
    fun slugFor(mode: GameMode): String =
        com.wordocious.app.ModeGen.byDbKey(mode.name)?.guideSlug ?: mode.name.lowercase()

    /** The guides bundled with this build (assets/guides.generated.json, written
     *  by apps/web/scripts/gen-guides-json.ts) — the "?" sheet renders at once
     *  and never depends on production having the entry yet. */
    private fun loadBundled() {
        if (cache != null) return
        cache = runCatching {
            com.wordocious.app.App.instance.assets.open("guides.generated.json").bufferedReader().use { it.readText() }
        }.mapCatching { json.decodeFromString(Payload.serializer(), it).guides.associateBy { g -> g.slug } }.getOrNull()
    }

    suspend fun guide(mode: GameMode): ModeGuide? = withContext(Dispatchers.IO) {
        loadBundled()
        if (!networkLoaded) {
            runCatching {
                val conn = (URL("https://wordocious.com/api/guides").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
                }
                if (conn.responseCode in 200..299) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    // Merge: the network copy wins per slug; bundled-only entries (a
                    // game production has not published yet) stay.
                    val fetched = json.decodeFromString(Payload.serializer(), body).guides.associateBy { it.slug }
                    cache = (cache ?: emptyMap()) + fetched
                    networkLoaded = true
                }
                conn.disconnect()
            }
        }
        cache?.get(slugFor(mode))
    }
}
