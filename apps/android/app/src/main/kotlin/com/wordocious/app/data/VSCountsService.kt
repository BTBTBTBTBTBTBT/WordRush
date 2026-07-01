package com.wordocious.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Live per-mode VS activity — players WAITING in queue + players PLAYING an
 * active match — from the socket server's /vs/counts. The lobby polls this to
 * show a "N playing · M waiting" line on each mode row. Best-effort (returns an
 * empty map on any failure).
 */
object VSCountsService {
    data class Count(val waiting: Int, val playing: Int)

    suspend fun fetch(): Map<String, Count> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("${VSConfig.SERVER_URL}/vs/counts").openConnection() as HttpURLConnection).apply {
                connectTimeout = 4000; readTimeout = 4000
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            val obj = JSONObject(body)
            val waiting = obj.optJSONObject("waiting") ?: JSONObject()
            val playing = obj.optJSONObject("playing") ?: JSONObject()
            val keys: Set<String> = (waiting.keys().asSequence() + playing.keys().asSequence()).map { it.toString() }.toSet()
            keys.associateWith { k -> Count(waiting.optInt(k, 0), playing.optInt(k, 0)) }
        }.getOrDefault(emptyMap())
    }
}
