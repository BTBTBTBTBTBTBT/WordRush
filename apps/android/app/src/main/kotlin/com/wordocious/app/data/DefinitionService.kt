package com.wordocious.app.data

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
 */
object DefinitionService {

    data class WordDefinition(
        val phonetic: String,
        val partOfSpeech: String,
        val definition: String,
    )

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetch(word: String): WordDefinition? = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL("https://api.dictionaryapi.dev/api/v2/entries/en/${word.lowercase()}")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            if (conn.responseCode != 200) return@runCatching null
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
        }.getOrNull()
    }
}

private val kotlinx.serialization.json.JsonPrimitive.contentOrNull: String?
    get() = if (this is kotlinx.serialization.json.JsonNull) null else content
