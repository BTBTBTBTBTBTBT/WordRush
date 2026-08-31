package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import com.wordocious.app.todayLocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL

/**
 * Fetches a word definition from dictionaryapi.dev — mirrors the web
 * `useWordDefinition` hook. Returns null on any failure (no definition,
 * network error). Runs off the main thread.
 *
 * Results are cached in SharedPreferences keyed by local day + word, so the
 * home screen's Word of the Day (and post-game definition cards) hit the
 * network at most once per word per day. A no-definition/network-failure
 * result is cached too (as a sentinel) so a flaky day doesn't refetch on
 * every visit. Cache is cleared when the local day rolls over.
 */
object DefinitionService {

    data class WordDefinition(
        val phonetic: String,
        val partOfSpeech: String,
        val definition: String,
    )

    private val json = Json { ignoreUnknownKeys = true }

    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_definition_cache", Context.MODE_PRIVATE)
    }
    private const val DAY_KEY = "cache_day"
    /** Sentinel stored when the API had no definition (or the fetch failed). */
    private const val MISS = "__none__"
    private const val SEP = "\u0001"

    private fun cacheKey(word: String) = "def:${word.lowercase()}"

    /** Returns the cached result for today. Outer null = no cache entry; inner null = cached miss. */
    @Synchronized
    private fun cachedToday(word: String): CachedResult? {
        if (prefs.getString(DAY_KEY, null) != todayLocalDate()) {
            // Day rolled over — drop yesterday's entries so the file stays small.
            prefs.edit().clear().putString(DAY_KEY, todayLocalDate()).apply()
            return null
        }
        val raw = prefs.getString(cacheKey(word), null) ?: return null
        if (raw == MISS) return CachedResult(null)
        val parts = raw.split(SEP)
        if (parts.size != 3) return null
        return CachedResult(WordDefinition(phonetic = parts[0], partOfSpeech = parts[1], definition = parts[2]))
    }

    @Synchronized
    private fun store(word: String, def: WordDefinition?) {
        val raw = def?.let { "${it.phonetic}$SEP${it.partOfSpeech}$SEP${it.definition}" } ?: MISS
        prefs.edit()
            .putString(DAY_KEY, todayLocalDate())
            .putString(cacheKey(word), raw)
            .apply()
    }

    private class CachedResult(val definition: WordDefinition?)

    /** §250: the committed local dictionary (assets/word-definitions.json —
     *  the same dataset web ships). Loaded once, lazily. The API below is
     *  only the fallback for words outside it, so a dictionaryapi.dev outage
     *  (founder, Aug 29: blank EQUAL / ERMINE) can't blank covered words. */
    @kotlinx.serialization.Serializable
    private data class LocalSense(val pos: String? = null, val def: String? = null)
    @kotlinx.serialization.Serializable
    private data class LocalRecord(val miss: Boolean? = null, val phonetic: String? = null, val senses: List<LocalSense>? = null)
    private val localDict: Map<String, LocalRecord> by lazy {
        runCatching {
            App.instance.assets.open("word-definitions.json").bufferedReader().use { r ->
                json.decodeFromString<Map<String, LocalRecord>>(r.readText())
            }
        }.getOrElse { emptyMap() }
    }

    fun localDefinition(word: String): WordDefinition? {
        val rec = localDict[word.lowercase()] ?: return null
        if (rec.miss == true) return null
        val sense = rec.senses?.firstOrNull() ?: return null
        val def = sense.def ?: return null
        if (def.isBlank()) return null
        return WordDefinition(phonetic = rec.phonetic ?: "", partOfSpeech = sense.pos ?: "", definition = def)
    }

    suspend fun fetch(word: String): WordDefinition? = withContext(Dispatchers.IO) {
        localDefinition(word)?.let { return@withContext it }
        cachedToday(word)?.let { return@withContext it.definition }
        // §250: transport failures / non-404 statuses must NOT become day-long
        // cached misses — one outage used to blank a word until midnight even
        // after the API recovered. Only a real 200-with-no-entry (or 404)
        // stores the miss sentinel.
        var transient = false
        val result = runCatching {
            val url = URL("https://api.dictionaryapi.dev/api/v2/entries/en/${word.lowercase()}")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            val code = conn.responseCode
            if (code != 200) {
                if (code != 404) transient = true
                return@runCatching null
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val arr = json.parseToJsonElement(body).jsonArray
            val entry = arr.firstOrNull()?.jsonObject ?: return@runCatching null

            // phonetic: first phonetics[].text, else entry.phonetic
            val phonetic = entry["phonetics"]?.jsonArray
                ?.firstNotNullOfOrNull { it.jsonObject["text"]?.jsonPrimitive?.contentOrNull }
                ?: entry["phonetic"]?.jsonPrimitive?.contentOrNull
                ?: ""

            val meaning = entry["meanings"]?.jsonArray?.firstOrNull()?.jsonObject
            val partOfSpeech = meaning?.get("partOfSpeech")?.jsonPrimitive?.contentOrNull ?: ""
            val def = meaning?.get("definitions")?.jsonArray?.firstOrNull()
                ?.jsonObject?.get("definition")?.jsonPrimitive?.contentOrNull ?: ""

            if (def.isBlank()) null
            else WordDefinition(phonetic = phonetic, partOfSpeech = partOfSpeech, definition = def)
        }.getOrElse { transient = true; null }
        if (result != null || !transient) store(word, result)
        result
    }
}

private val kotlinx.serialization.json.JsonPrimitive.contentOrNull: String?
    get() = if (this is kotlinx.serialization.json.JsonNull) null else content
