package com.wordocious.app.ui

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.wordocious.app.App
import com.wordocious.app.data.FlagsService
import com.wordocious.core.HomeHeadlinePool
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * Home headline pool (founder 10-16), gated by the `home_headlines_v2` flag: testers / admins only while the
 * row's audience is "testers"; no row, or flags not loaded = OFF (fail closed, like [ShareSheetFlag]). With the
 * flag off the Home banner prints exactly today's `bannerHeadline` line.
 */
object HomeHeadlinesFlag {
    const val KEY = "home_headlines_v2"
    fun on(): Boolean = FlagsService.isOn(KEY)
}

/**
 * The last daily finished on this device (for the pool's `{last}` reaction, which fades after
 * [HomeHeadlinePool.LAST_GAME_FRESH_MINUTES]). Written by DailyCompletionsService.noteCompletion the moment a
 * daily finishes; a tiny local record (SharedPreferences), never fetched. `record` (a personal best) has no cheap
 * local signal yet, so it is always false for now.
 */
object HomeHeadlineLastGame {
    data class Record(val gameMode: String, val won: Boolean, val finishedAtMs: Long, val record: Boolean)

    private const val PREFS = "home_headlines_v2"
    private val prefs by lazy { App.instance.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }
    private val _latest = MutableStateFlow<Record?>(null)
    /** The latest record; Home recomputes its headline when it changes (a game just finished). */
    val latest: StateFlow<Record?> = _latest.asStateFlow()
    @Volatile private var loaded = false

    fun read(): Record? {
        if (!loaded) {
            loaded = true
            val mode = prefs.getString("last.mode", null)
            if (mode != null) {
                _latest.value = Record(mode, prefs.getBoolean("last.won", false), prefs.getLong("last.at", 0L), prefs.getBoolean("last.record", false))
            }
        }
        return _latest.value
    }

    fun note(gameMode: String, won: Boolean, record: Boolean = false) {
        val r = Record(gameMode, won, System.currentTimeMillis(), record)
        loaded = true
        _latest.value = r
        prefs.edit().putString("last.mode", gameMode).putBoolean("last.won", won).putLong("last.at", r.finishedAtMs).putBoolean("last.record", record).apply()
    }
}

/**
 * The pool's "recently shown" history: ids (templates) shown in the last [HomeHeadlinePool.HISTORY_DAYS] days,
 * local only, key `home_headlines_v2.history` = JSON [{id, day, bucket}]. Home reads it once at mount and appends
 * a line when it is first shown. Entries from today's CURRENT bucket are left out of the selection input so the
 * line Home is showing stays put across remounts in that bucket (the next bucket then avoids it).
 */
object HomeHeadlineHistory {
    private const val KEY = "home_headlines_v2.history"
    private val prefs by lazy { App.instance.getSharedPreferences("wordocious_prefs", Context.MODE_PRIVATE) }

    data class Entry(val id: String, val day: String, val bucket: String)

    private fun parse(raw: String): List<Entry> = runCatching {
        val arr = JSONArray(raw)
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val id = o.optString("id", ""); val day = o.optString("day", "")
            if (id.isEmpty() || day.isEmpty()) null else Entry(id, day, o.optString("bucket", ""))
        }
    }.getOrDefault(emptyList())

    private fun isRecent(day: String, today: String): Boolean = runCatching {
        !LocalDate.parse(day).isBefore(LocalDate.parse(today).minusDays(HomeHeadlinePool.HISTORY_DAYS.toLong()))
    }.getOrDefault(false)

    /** All kept entries (pruned to the last HISTORY_DAYS days). */
    fun load(today: String): List<Entry> = parse(prefs.getString(KEY, "") ?: "").filter { isRecent(it.day, today) }

    /** The ids the selector should avoid: everything kept except today's current bucket. */
    fun idsFor(entries: List<Entry>, today: String, bucket: String): List<String> =
        entries.filter { !(it.day == today && it.bucket == bucket) }.map { it.id }

    /** Persist a shown line (no-op when the same id is already recorded for that day + bucket). */
    fun append(entries: List<Entry>, id: String, today: String, bucket: String): List<Entry> {
        if (entries.any { it.id == id && it.day == today && it.bucket == bucket }) return entries
        val next = entries.filter { isRecent(it.day, today) } + Entry(id, today, bucket)
        val arr = JSONArray()
        for (e in next) arr.put(JSONObject().put("id", e.id).put("day", e.day).put("bucket", e.bucket))
        prefs.edit().putString(KEY, arr.toString()).apply()
        return next
    }
}

/**
 * The pool's pick for the Home banner's DAILY headline (flag on only): the shown text and its lettering fit.
 * Inputs are what Home already holds (progress, streaks, the ordered cards + today's completions for `{next}`,
 * the local last-game record for `{last}`, the bundled holiday table, the user id); no network. Recomputed only
 * when the time bucket changes (a 60 s check that compares buckets), the last-played window closes, progress /
 * streaks / completions change, a game finishes, or the history changes — never per frame. Pool lines are fitted
 * with [com.wordocious.core.bubbleFit] at the device's full size, two lines, never below 85% (the slot already
 * reserves two lines, so nothing below moves); the legacy line keeps [legacyLayout].
 */
@androidx.compose.runtime.Composable
fun rememberPoolHeadline(
    word: BannerRow,
    puzzles: BannerRow,
    completions: Map<String, com.wordocious.app.data.DailyCompletionsService.Completion>,
    name: String,
    usable: Double,
    legacy: String,
    legacyLayout: com.wordocious.core.BubbleFit,
): Pair<String, com.wordocious.core.BubbleFit> {
    fun hourNow() = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    fun minutesAgo(r: HomeHeadlineLastGame.Record) = ((System.currentTimeMillis() - r.finishedAtMs) / 60_000L).coerceIn(0L, Int.MAX_VALUE.toLong()).toInt()
    val today = com.wordocious.app.todayLocalDate()
    var bucket by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(HomeHeadlinePool.timeBucket(hourNow())) }
    androidx.compose.runtime.remember { HomeHeadlineLastGame.read() }
    val lastGame by HomeHeadlineLastGame.latest.collectAsState()
    var lastFresh by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(lastGame?.let { minutesAgo(it) <= HomeHeadlinePool.LAST_GAME_FRESH_MINUTES } ?: false) }
    val tabHidden = LocalTabHidden.current.value
    androidx.compose.runtime.LaunchedEffect(tabHidden) {
        if (tabHidden) return@LaunchedEffect
        while (true) {
            val b = HomeHeadlinePool.timeBucket(hourNow())
            if (b != bucket) bucket = b
            val fresh = HomeHeadlineLastGame.latest.value?.let { minutesAgo(it) <= HomeHeadlinePool.LAST_GAME_FRESH_MINUTES } ?: false
            if (fresh != lastFresh) lastFresh = fresh
            kotlinx.coroutines.delay(60_000)
        }
    }
    var entries by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(HomeHeadlineHistory.load(today)) }
    val historyIds = androidx.compose.runtime.remember(entries, today, bucket) { HomeHeadlineHistory.idsFor(entries, today, bucket) }
    val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
    val userSeed = profile?.id ?: ""
    val choice = androidx.compose.runtime.remember(
        bucket, word.progress, puzzles.progress, word.streaks, puzzles.streaks, word.bestFlawless, word.cards, puzzles.cards,
        completions, name, usable, lastGame, lastFresh, historyIds, userSeed, today,
    ) {
        val cards = word.cards + puzzles.cards
        val next = cards.firstOrNull { it.dbKey != null && it.dbKey !in completions }?.title
        val lg = lastGame?.let { r ->
            cards.firstOrNull { it.dbKey == r.gameMode }?.let { c -> HomeHeadlinePool.LastGame(c.title, r.won, minutesAgo(r), r.record) }
        }
        HomeHeadlinePool.select(
            HomeHeadlinePool.Context(
                name = name, hour = hourNow(), dateKey = today, word = word.progress, puzzles = puzzles.progress,
                streaks = HomeHeadlinePool.Streaks(
                    com.wordocious.core.RowStreaks(word.streaks.sweep, word.streaks.flawless, 0, word.bestFlawless),
                    com.wordocious.core.RowStreaks(puzzles.streaks.sweep, puzzles.streaks.flawless),
                ),
                nextGame = next, lastGame = lg,
                holiday = com.wordocious.core.holidayKeyForDay(today, com.wordocious.core.HolidayTable.bundled),
                slotWidth = usable, userSeed = userSeed, history = historyIds,
            ),
        )
    }
    val poolLine = choice.id != "legacy" && !choice.id.startsWith("streak:")
    // Record a pool line the first time it is shown (today + this bucket); the selection input leaves this bucket's
    // own entries out, so the line stays put across remounts and recomputes within the bucket.
    androidx.compose.runtime.LaunchedEffect(choice.id, today, bucket) {
        if (poolLine) entries = HomeHeadlineHistory.append(entries, choice.id, today, bucket)
    }
    val layout = androidx.compose.runtime.remember(choice.text, choice.id, name, usable, legacy, legacyLayout) {
        when {
            choice.id == "legacy" && choice.text == legacy -> legacyLayout
            !poolLine -> com.wordocious.core.homeHeadlineFit(choice.text, name, usable)
            else -> {
                val full = com.wordocious.core.headlineFontSize(usable)
                com.wordocious.core.bubbleFit(
                    choice.text, usable, maxSize = full,
                    minSize = kotlin.math.ceil(full * HomeHeadlinePool.MIN_FIT_SCALE).toInt(), maxLines = 2,
                )
            }
        }
    }
    return choice.text to layout
}
