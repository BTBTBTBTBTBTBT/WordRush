package com.wordocious.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * ProperNoundle "Clue" hint — 1:1 port of iOS WikipediaHint.swift /
 * web components/propernoundle/wikipedia.ts. Fetches the Wikipedia REST summary
 * for the puzzle's title, returns the first two sentences with the answer name
 * redacted. Returns null on any failure (caller falls back to the static hint).
 */
object WikipediaHint {
    private const val API = "https://en.wikipedia.org/api/rest_v1/page/summary"
    private val json = Json { ignoreUnknownKeys = true }

    private val abbreviations = listOf(
        "No", "Nos", "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "Mt", "Ft",
        "Inc", "Ltd", "Co", "Corp", "Bros", "etc", "vs", "cf", "al", "e.g", "i.e",
        "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
        "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat", "Sun",
    )

    // redact=false keeps the answer name in the text — the post-game result
    // screen shows the full clue as the "definition" (proper nouns aren't in
    // the dictionary).
    suspend fun fetch(displayName: String, wikiTitle: String?, redact: Boolean = true): String? = withContext(Dispatchers.IO) {
        runCatching {
            val raw = (if (!wikiTitle.isNullOrEmpty()) wikiTitle else displayName)
                .replace(Regex("\\s+"), "_")
            // encodeURIComponent-equivalent: keep unreserved + !~*'()
            val title = URLEncoder.encode(raw, "UTF-8")
                .replace("+", "%20").replace("%21", "!").replace("%7E", "~")
                .replace("%2A", "*").replace("%27", "'").replace("%28", "(").replace("%29", ")")
            val conn = (URL("$API/$title").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                connectTimeout = 5000; readTimeout = 5000
            }
            if (conn.responseCode !in 200..299) return@runCatching null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val extract = json.parseToJsonElement(body).jsonObject["extract"]?.jsonPrimitive?.content
            if (extract.isNullOrEmpty()) null else sanitize(extract, displayName, redact)
        }.getOrNull()
    }

    /** The answer's Wikipedia photo for the post-game result thumbnail — reads
     *  thumbnail/originalimage from the same REST summary. Null on any failure. */
    suspend fun fetchImageUrl(displayName: String, wikiTitle: String?): String? = withContext(Dispatchers.IO) {
        runCatching {
            val raw = (if (!wikiTitle.isNullOrEmpty()) wikiTitle else displayName)
                .replace(Regex("\\s+"), "_")
            val title = URLEncoder.encode(raw, "UTF-8")
                .replace("+", "%20").replace("%21", "!").replace("%7E", "~")
                .replace("%2A", "*").replace("%27", "'").replace("%28", "(").replace("%29", ")")
            val conn = (URL("$API/$title").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                connectTimeout = 5000; readTimeout = 5000
            }
            if (conn.responseCode !in 200..299) return@runCatching null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val obj = json.parseToJsonElement(body).jsonObject
            obj["thumbnail"]?.jsonObject?.get("source")?.jsonPrimitive?.content
                ?: obj["originalimage"]?.jsonObject?.get("source")?.jsonPrimitive?.content
        }.getOrNull()
    }

    private fun sanitize(extract: String, displayName: String, redact: Boolean = true): String {
        // Protect multi-letter capitalized abbreviations (U.S., U.K.).
        var s = protectDots(extract, "\\b([A-Z])\\.\\s?([A-Z])\\.(\\s?[A-Z]\\.)?", RegexOption.UNIX_LINES)
        // Protect common single-word abbreviations (case-insensitive).
        for (abbr in abbreviations) {
            s = protectDots(s, "\\b${Regex.escape(abbr)}\\.", RegexOption.IGNORE_CASE)
        }
        // First 2 sentences.
        var sentences = Regex("[^.!?]+[.!?]+").findAll(s).map { it.value }.toList()
        if (sentences.isEmpty()) sentences = listOf(s)
        var hint = sentences.take(2).joinToString(" ").trim()
        hint = hint.replace("###", ".")
        // Post-game (redact=false) keeps the answer in the text.
        if (!redact) return hint
        // Redact full name, then each word > 2 chars. Match diacritic-
        // insensitively: the display name is plain ASCII ("Shogun") but the
        // Wikipedia extract often carries the accented spelling ("Shōgun") — a
        // literal match misses it and the clue leaks the answer. Decompose the
        // hint to NFD (accents → base + combining mark) and build each pattern
        // to tolerate combining marks between letters (web/iOS parity).
        hint = java.text.Normalizer.normalize(hint, java.text.Normalizer.Form.NFD)
        val parts = displayName.split(Regex("\\s+")).filter { it.length > 2 }
        for (pattern in listOf(displayName) + parts) {
            hint = Regex(diacriticTolerantPattern(pattern), RegexOption.IGNORE_CASE).replace(hint, "______")
        }
        hint = java.text.Normalizer.normalize(hint, java.text.Normalizer.Form.NFC)
        hint = Regex("(______\\s*)+").replace(hint, "______")
        hint = Regex("______(\\w)").replace(hint, "______ $1")
        return hint
    }

    /** Build a regex matching [name] ignoring diacritics: strip accents from
     *  the name, then allow a run of combining marks between letters (so
     *  "Shogun" matches the NFD form of "Shōgun"). Whitespace matches any run. */
    private fun diacriticTolerantPattern(name: String): String {
        val combining = "[\\u0300-\\u036f]*"
        val base = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
        return base.map { ch ->
            if (ch.isWhitespace()) "\\s+" else Regex.escape(ch.toString()) + combining
        }.joinToString("")
    }

    /** Replace every "." with "###" inside each match of [pattern]. */
    private fun protectDots(s: String, pattern: String, vararg opts: RegexOption): String {
        val re = Regex(pattern, opts.toSet())
        return re.replace(s) { m -> m.value.replace(".", "###") }
    }
}
