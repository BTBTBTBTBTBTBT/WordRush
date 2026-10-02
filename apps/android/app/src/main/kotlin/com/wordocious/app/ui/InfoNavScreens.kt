package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.em
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.game.GuideSheet
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** The site-nav items in the header "?" menu and the home footer (web parity). */
data class InfoNavItem(
    val route: String, val label: String, val subtitle: String,
    val icon: ImageVector, val accent: Color,
    /** The 3D icon set's glyph where one exists (HEADER_SPEC §2: help → `help`). */
    val icon3d: Icon3DName? = null,
)

val INFO_NAV = listOf(
    InfoNavItem("help", "How to Play", "Rules, tiles & scoring", Icons.AutoMirrored.Filled.HelpOutline, Color(0xFF7C3AED), Icon3DName.HELP),
    InfoNavItem("guides", "Guides", "Strategy for every mode", Icons.Filled.MenuBook, Color(0xFF3B82F6)),
    InfoNavItem("strategy", "Strategy", "Solve faster, in fewer guesses", Icons.Filled.Lightbulb, Color(0xFFF59E0B)),
    InfoNavItem("words", "Words", "Every Word of the Day", Icons.Filled.CalendarMonth, Color(0xFFEC4899)),
    // "About" sat here until 2026-07-31. It restated How to Play in older, dryer
    // copy, so two adjacent rows answered the same question. Dropped from this
    // list, which feeds BOTH the "?" menu and the home footer. The about screen
    // itself still renders (HelpInfoScreens "about") — it is only unlinked.
    InfoNavItem("faq", "FAQ", "Common questions", Icons.Filled.QuestionAnswer, Color(0xFF8B5CF6)),
    InfoNavItem("privacy", "Privacy", "How we handle your data", Icons.Filled.Lock, Color(0xFF10B981)),
    InfoNavItem("terms", "Terms", "Terms of service", Icons.Filled.Description, Color(0xFF6366F1)),
)

/** Styled "?" menu — a welcoming, on-brand list (FINISH_SPEC A1: each row a tinted
 *  card in its page's color with a mini-game-card icon tile, squishing on press). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoMenuSheet(onNav: (String) -> Unit, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = accentWash(Color(0xFF7C3AED), 0.08f), dragHandle = null,
    ) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        PageHeader("MENU", onClose = onDismiss, contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp))
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            INFO_NAV.forEach { item ->
                SheetRow(item.accent, item.label, item.subtitle, { onNav(item.route) }) {
                    if (item.icon3d != null) Icon3D(item.icon3d, 26.dp)
                    else Icon(item.icon, null, tint = item.accent, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

/**
 * The Share chooser — "No spoilers" vs "Full results".
 *
 * Same chrome and row anatomy as [InfoMenuSheet] (accent bar, wordmark-gradient
 * uppercase title, close X, tinted rows with mini-game-card icon tiles) rather than a
 * plain AlertDialog, which looked nothing like the app. iOS/web parity:
 * ShareVariantSheet.swift / share-variant-modal.tsx.
 *
 * onPick(true) = "Full results" (letters revealed); false = the spoiler-free card.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareVariantSheet(onPick: (Boolean) -> Unit, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss, sheetState = sheetState,
        containerColor = accentWash(Color(0xFF7C3AED), 0.08f), dragHandle = null,
    ) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        PageHeader("SHARE", onClose = onDismiss, titleSize = 20.sp, contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp))
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ShareVariantRow(Icons.Filled.VisibilityOff, Color(0xFF7C3AED), "No spoilers", "Colors only") { onPick(false) }
            ShareVariantRow(Icons.Filled.Visibility, Color(0xFFEC4899), "Full results", "Letters revealed") { onPick(true) }
        }
    }
}

/** 1:1 with the InfoMenuSheet row. */
@Composable
private fun ShareVariantRow(
    icon: ImageVector, accent: Color, title: String, subtitle: String, onClick: () -> Unit,
) {
    SheetRow(accent, title, subtitle, onClick) { Icon(icon, null, tint = accent, modifier = Modifier.size(20.dp)) }
}

/** A sheet row: a tinted card in [accent] (wash, line, top band) that squishes, an icon tile, caps title + subtitle. */
@Composable
private fun SheetRow(accent: Color, title: String, subtitle: String, onClick: () -> Unit, icon: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().squishClickable("$title, $subtitle", onClick = onClick)
            .tintedPill(accent, corner = 16.dp)
            .padding(start = 12.dp, end = 12.dp, top = 14.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        InfoIconTile(accent, 40.dp, icon)
        Column(Modifier.weight(1f)) {
            Text(title.uppercase(), fontSize = 15.sp, fontWeight = FontWeight.Black, color = InfoInk.heading)
            Text(subtitle, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted)
        }
    }
}

// ── Services (mirror ContentService: fetch web JSON, PERSIST to prefs so the
//    content renders instantly on cold open; network refresh updates silently) ──

/** Shared prefs handle for the info-content caches (same file ContentService uses). */
private val infoPrefs by lazy {
    com.wordocious.app.App.instance.getSharedPreferences("wordocious_prefs", android.content.Context.MODE_PRIVATE)
}

object StrategyService {
    private val json = Json { ignoreUnknownKeys = true }
    @Serializable data class Article(val slug: String, val title: String, val dek: String, val minutes: Int, val sections: List<Section> = emptyList())
    @Serializable data class Section(val heading: String, val body: List<String> = emptyList())
    @Serializable private data class Payload(val articles: List<Article> = emptyList())
    private const val CACHE_KEY = "strategy-cache-v1"
    private var memCache: List<Article>? = null

    /** Last-persisted articles for an instant first render (ContentService parity). */
    fun cached(): List<Article>? {
        memCache?.let { return it }
        val raw = infoPrefs.getString(CACHE_KEY, null) ?: return null
        return runCatching { json.decodeFromString(Payload.serializer(), raw).articles }.getOrNull()?.also { memCache = it }
    }

    /** Fetch the live copy; persists on success. Falls back to the cache. */
    suspend fun articles(): List<Article> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/strategy").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val out = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val articles = json.decodeFromString(Payload.serializer(), body).articles
                memCache = articles
                infoPrefs.edit().putString(CACHE_KEY, body).apply()
                articles
            } else null
            conn.disconnect()
            out
        }.getOrNull() ?: cached() ?: emptyList()
    }
}

object WordsService {
    private val json = Json { ignoreUnknownKeys = true }
    @Serializable data class Entry(
        val date: String, val word: String, val phonetic: String = "", val partOfSpeech: String = "",
        val definition: String = "", val example: String = "", val extraSenses: List<Sense> = emptyList(),
        val analysisSummary: String = "", val analysisStrategy: String = "",
    )
    @Serializable data class Sense(val partOfSpeech: String = "", val definition: String = "")
    @Serializable private data class Payload(val words: List<Entry> = emptyList())
    private const val CACHE_KEY = "words-cache-v1"
    @Volatile private var memCache: List<Entry>? = null

    /** The in-memory copy only — never touches disk, safe on the UI thread. */
    fun cachedInMemory(): List<Entry>? = memCache

    /** Last-persisted words for an instant first render (ContentService parity). */
    fun cached(): List<Entry>? {
        memCache?.let { return it }
        val raw = infoPrefs.getString(CACHE_KEY, null) ?: return null
        return runCatching { json.decodeFromString(Payload.serializer(), raw).words }.getOrNull()?.also { memCache = it }
    }

    /** Fetch the live copy; persists on success. Falls back to the cache. */
    suspend fun words(): List<Entry> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/words").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val out = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val words = json.decodeFromString(Payload.serializer(), body).words
                memCache = words
                infoPrefs.edit().putString(CACHE_KEY, body).apply()
                words
            } else null
            conn.disconnect()
            out
        }.getOrNull() ?: cached() ?: emptyList()
    }
}

private fun prettyDate(key: String): String = runCatching {
    val inFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val out = SimpleDateFormat("MMM d, yyyy", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    out.format(inFmt.parse(key)!!)
}.getOrDefault(key)

// ── Shared chrome (C6: every info page is an InfoPage) ────────────────────────

@Composable
private fun OverlayScaffold(
    title: String,
    onDone: () -> Unit,
    /** A nested page's back (an article, a word) — the back control goes there instead of closing. */
    onBack: (() -> Unit)? = null,
    /** The page's own title art (C6), at the shared footer height. */
    art: TitleArt? = null,
    /** Word of the Day keeps its full-width page headline. */
    pageHeadline: Boolean = false,
    intro: Pair<String, String?>? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    InfoPage(
        title = title, onBack = onBack ?: onDone, art = art, pageHeadline = pageHeadline,
        backLabel = if (onBack != null) "Back" else "Close", intro = intro, content = content,
    )
}

private val STRATEGY_ACCENT = Color(0xFFF59E0B)
private val WORDS_ACCENT = Color(0xFFEC4899)

// ── Strategy ──────────────────────────────────────────────────────────────────

@Composable
fun StrategyScreen(onDone: () -> Unit) {
    val articles by produceState(initialValue = StrategyService.cached() ?: emptyList()) { value = StrategyService.articles() }
    var selected by remember { mutableStateOf<StrategyService.Article?>(null) }

    selected?.let { a ->
        androidx.activity.compose.BackHandler { selected = null }
        OverlayScaffold(
            a.title, onDone = onDone, onBack = { selected = null }, art = TitleArt.STRATEGY,
            intro = a.title to a.dek,
        ) {
            Text(
                "STRATEGY · ${a.minutes} MIN READ", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp,
                color = darkenInk(STRATEGY_ACCENT), modifier = Modifier.padding(horizontal = 4.dp),
            )
            a.sections.forEach { s ->
                InfoSectionCard(STRATEGY_ACCENT, title = s.heading) {
                    s.body.forEach { InfoBody(it) }
                }
            }
        }
        return
    }

    OverlayScaffold(
        "Strategy", onDone, art = TitleArt.STRATEGY,
        intro = "Solve faster, in fewer guesses" to "Practical, original strategy for solving daily word puzzles faster and in fewer guesses.",
    ) {
        if (articles.isEmpty()) {
            CastLoader(null, Modifier.padding(top = 32.dp).align(Alignment.CenterHorizontally))
        } else articles.forEach { a ->
            InfoGuideCard(
                STRATEGY_ACCENT, a.title, a.dek, onClick = { selected = a }, kicker = "${a.minutes} MIN READ",
            ) {
                InfoIconTile(STRATEGY_ACCENT) {
                    Icon(Icons.Filled.Lightbulb, null, tint = STRATEGY_ACCENT, modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

// ── Words (Word of the Day archive) ───────────────────────────────────────────

@Composable
fun WordsScreen(onDone: () -> Unit, navTitle: String = "Words") {
    val words by produceState(initialValue = WordsService.cached() ?: emptyList()) { value = WordsService.words() }
    var selected by remember { mutableStateOf<WordsService.Entry?>(null) }
    // ART_SPEC §2 / C6: opened as the Word of the Day page, the page keeps the WOTD headline;
    // the Words footer page shows its own WORDS title.
    val wotd = navTitle == "Word of the Day"

    selected?.let { w ->
        androidx.activity.compose.BackHandler { selected = null }
        WordDetail(w, wotd, onDone = onDone, onBack = { selected = null })
        return
    }

    OverlayScaffold(
        navTitle, onDone, art = if (wotd) TitleArt.WOTD else TitleArt.WORDS, pageHeadline = wotd,
        intro = "Every Word of the Day" to "Every day Wordocious surfaces a Word of the Day — the shared answer thousands of players race to solve.",
    ) {
        if (words.isEmpty()) {
            CastLoader(null, Modifier.padding(top = 32.dp).align(Alignment.CenterHorizontally))
        } else words.forEach { w ->
            InfoGuideCard(WORDS_ACCENT, w.word.uppercase(), prettyDate(w.date), onClick = { selected = w }) {
                LetterCandyTile(w.word.take(1).uppercase(), 40.dp, 18.sp)
            }
        }
    }
}

/** A purple candy letter tile (the mockup's spelled-word tiles): gradient face, darker lip, white letter. */
@Composable
private fun LetterCandyTile(letter: String, size: androidx.compose.ui.unit.Dp, fontSize: androidx.compose.ui.unit.TextUnit) {
    val shape = RoundedCornerShape(size * 0.22f)
    Box(
        Modifier.size(size).clip(shape).background(Color(0xFF4C1D95))
            .padding(bottom = 3.dp).clip(shape)
            .background(Brush.verticalGradient(listOf(Color(0xFFA66BFF), Color(0xFF7C3AED), Color(0xFF6A2BD6)))),
        contentAlignment = Alignment.Center,
    ) {
        Text(letter, fontSize = fontSize, fontWeight = FontWeight.Black, color = Color.White)
    }
}

@Composable
private fun WordDetail(w: WordsService.Entry, wotd: Boolean, onDone: () -> Unit, onBack: () -> Unit) {
    val word = w.word.uppercase()
    OverlayScaffold(word, onDone = onDone, onBack = onBack, art = if (wotd) TitleArt.WOTD else TitleArt.WORDS, pageHeadline = wotd) {
        // The word spelled in purple candy tiles on a soft green card (finishing-touches "Today's word").
        TintedCard(
            WOTD_CARD_ACCENT, Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(vertical = 16.dp, horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "WORD OF THE DAY · ${prettyDate(w.date).uppercase()}", fontSize = 10.sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp, color = if (WTheme.isDark) WTheme.textSecondary else darkenInk(WOTD_CARD_ACCENT),
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
            androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                val n = word.length.coerceAtLeast(1)
                val tile = minOf(40.dp, (maxWidth - 6.dp * (n - 1)) / n)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.semantics(mergeDescendants = true) { }) {
                    word.forEach { c -> LetterCandyTile(c.toString(), tile, (tile.value * 0.5f).sp) }
                }
            }
            if (w.phonetic.isNotEmpty() || w.partOfSpeech.isNotEmpty()) {
                Row(
                    Modifier.align(Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (w.phonetic.isNotEmpty()) Text(w.phonetic, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = InfoInk.body)
                    if (w.partOfSpeech.isNotEmpty()) {
                        Text(
                            w.partOfSpeech.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.1.em,
                            color = Color.White,
                            modifier = Modifier.clip(RoundedCornerShape(50))
                                .background(Brush.verticalGradient(listOf(Color(0xFF5ED59A), Color(0xFF22A866))))
                                .padding(horizontal = 10.dp, vertical = 3.dp),
                        )
                    }
                }
            }
        }
        if (w.definition.isNotEmpty()) {
            WordSectionCard("Meaning", Icons.Filled.MenuBook, Color(0xFF7C3AED)) {
                InfoBody(w.definition)
                if (w.example.isNotEmpty()) Text("“${w.example}”", fontSize = 12.5.sp, fontStyle = FontStyle.Italic, color = InfoInk.muted)
                w.extraSenses.forEach {
                    Text(buildAnnotatedString {
                        withStyle(SpanStyle(fontWeight = FontWeight.Black, color = purpleTextInk)) { append(it.partOfSpeech + " ") }
                        append(it.definition)
                    }, fontSize = 12.5.sp, color = InfoInk.body)
                }
            }
        }
        WordSectionCard("$word as a puzzle answer", Icons.Filled.Lightbulb, STRATEGY_ACCENT) {
            InfoBody(w.analysisSummary)
            InfoBody(w.analysisStrategy)
        }
    }
}

@Composable
private fun WordSectionCard(title: String, icon: ImageVector, tint: Color, content: @Composable () -> Unit) {
    InfoSectionCard(
        tint, title = title.uppercase(),
        leading = { InfoIconTile(tint, 28.dp) { Icon(icon, null, tint = tint, modifier = Modifier.size(15.dp)) } },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}

// ── Guides index (every visible daily mode → GuideSheet) ─────────────────────

@Composable
fun GuidesIndexScreen(onDone: () -> Unit) {
    // Every daily mode this viewer can play — the sweep word games, then the
    // More Games titles whose flag is on (ProperNoundle among them) — from the
    // catalog, never a hand-typed list.
    val modes = visibleDailyCards().mapNotNull { it.engineMode }
    val guides by produceState(initialValue = emptyList<Pair<GameMode, com.wordocious.app.data.GuideService.ModeGuide?>>(), modes) {
        value = modes.map { it to com.wordocious.app.data.GuideService.guide(it) }
    }
    var selected by remember { mutableStateOf<GameMode?>(null) }

    selected?.let { mode ->
        androidx.activity.compose.BackHandler { selected = null }
        GuideSheet(mode = mode, onDismiss = { selected = null })
        return
    }

    // C6: Guides shows its OWN title (no longer the How to Play art).
    OverlayScaffold(
        "Guides", onDone, art = TitleArt.GUIDES,
        intro = "How every game works" to "Pick a game for its rules, tips and a worked example.",
    ) {
        (guides.ifEmpty { modes.map { it to null } }).forEach { (mode, g) ->
            val accent = modeAccent(mode)
            // Before /api/guides resolves, iOS falls back to the capitalized slug ("Six"), not the enum name.
            val title = g?.title ?: com.wordocious.app.data.GuideService.slugFor(mode).replaceFirstChar { it.uppercase() }
            // The mockup's `.guidecard`: the game's own color, top bar and 3D icon.
            InfoGuideCard(accent, title, g?.tagline, onClick = { selected = mode }) {
                // ART_SPEC §3: the game's 3D icon; the book stays for a mode without a card.
                if (modeCardFor(mode) != null) ModeGlyph(mode, accent, 42.dp)
                else InfoIconTile(accent) { Icon(Icons.Filled.MenuBook, null, tint = accent, modifier = Modifier.size(18.dp)) }
            }
        }
    }
}

// ── Home footer link row (web footer parity) ──────────────────────────────────

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun InfoFooter(onNav: (String) -> Unit) {
    // iOS splits the links into two fixed rows rather than letting them wrap by
    // measured width, so the grid stays balanced on every device. A1 / A9: each link
    // is a tinted chip in its page's color that squishes (navigation, not an action).
    val half = (INFO_NAV.size + 1) / 2
    Column(
        Modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf(INFO_NAV.take(half), INFO_NAV.drop(half)).forEach { line ->
            // A link that does not fit wraps to the next line whole (a narrow phone at a
            // large font clipped "WORDS" — Doug, 2026-09-27).
            androidx.compose.foundation.layout.FlowRow(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                line.forEach { item -> InfoLinkChip(item.label, item.accent) { onNav(item.route) } }
            }
        }
    }
}

// ── How to Play (renders the web /how-to-play doc, fed from /api/howtoplay) ────

object HowToPlayService {
    private val json = Json { ignoreUnknownKeys = true }
    @Serializable data class Section(
        val title: String, val intro: String? = null, val bullets: List<Bullet>? = null,
        val tilesHeading: String? = null, val tiles: List<TileRow>? = null,
        val modes: List<ModeItem>? = null, val outro: String? = null,
    )
    @Serializable data class Bullet(val strong: String? = null, val text: String = "")
    @Serializable data class ModeItem(val name: String, val accent: String, val body: String)
    @Serializable data class Letter(val ch: String, val color: String)
    @Serializable data class TileRow(val letters: List<Letter>, val strong: String, val strongColor: String, val rest: String)
    @Serializable private data class Payload(val sections: List<Section> = emptyList())
    private const val CACHE_KEY = "howtoplay-cache-v1"
    private var memCache: List<Section>? = null

    /** Last-persisted sections for an instant first render (ContentService parity). */
    fun cached(): List<Section>? {
        memCache?.let { return it }
        val raw = infoPrefs.getString(CACHE_KEY, null) ?: return null
        return runCatching { json.decodeFromString(Payload.serializer(), raw).sections }.getOrNull()?.also { memCache = it }
    }

    /** Fetch the live copy; persists on success. Falls back to the cache. */
    suspend fun sections(): List<Section> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/howtoplay").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val out = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val sections = json.decodeFromString(Payload.serializer(), body).sections
                memCache = sections
                infoPrefs.edit().putString(CACHE_KEY, body).apply()
                sections
            } else null
            conn.disconnect()
            out
        }.getOrNull() ?: cached() ?: emptyList()
    }
}

private fun htpColor(hex: String): Color =
    runCatching { Color(("FF" + hex.removePrefix("#")).toLong(16)) }.getOrDefault(Color(0xFF7C3AED))

@Composable
fun HowToPlayScreen(onDone: () -> Unit) {
    val sections by produceState(initialValue = HowToPlayService.cached() ?: emptyList()) { value = HowToPlayService.sections() }
    OverlayScaffold(
        "How to Play", onDone, art = TitleArt.HOWTO,
        intro = "New to Wordocious?" to "Everything you need to know to get started.",
    ) {
        // FINISH_SPEC W: replay the first-run tour (closes this page under it).
        InfoLinkChip("Take the tour", Color(0xFF7C3AED), Modifier.align(Alignment.CenterHorizontally)) {
            Onboarding.replay()
            onDone()
        }
        if (sections.isEmpty()) {
            CastLoader(null, Modifier.padding(top = 32.dp).align(Alignment.CenterHorizontally))
        } else sections.forEach { HtpSectionCard(it) }
    }
}

@Composable
private fun HtpSectionCard(s: HowToPlayService.Section) {
    val accent = Color(0xFF7C3AED)
    InfoSectionCard(accent, title = s.title) {
        s.intro?.let { InfoBody(it) }
        s.bullets?.let { bullets ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                bullets.forEach { b ->
                    InfoBullet(accent) {
                        Text(buildAnnotatedString {
                            b.strong?.let { withStyle(SpanStyle(fontWeight = FontWeight.Black, color = InfoInk.heading)) { append(it) } }
                            append(b.text)
                        }, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = InfoInk.body, lineHeight = 1.45.em)
                    }
                }
            }
        }
        s.tilesHeading?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Black, color = InfoInk.heading) }
        s.tiles?.let { tiles ->
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                tiles.forEach { row ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            row.letters.forEach { HtpTile(it) }
                        }
                        Text(buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.Black, color = htpColor(row.strongColor))) { append(row.strong) }
                            append(row.rest)
                        }, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = InfoInk.body, lineHeight = 1.4.em)
                    }
                }
            }
        }
        s.modes?.let { modes ->
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                modes.forEach { m ->
                    val c = htpColor(m.accent)
                    Column(
                        Modifier.fillMaxWidth().tintedPill(c).padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(m.name, fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) c else darkenInk(c))
                        Text(m.body, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = InfoInk.body, lineHeight = 1.4.em)
                    }
                }
            }
        }
        s.outro?.let { InfoBody(it) }
    }
}

@Composable
private fun HtpTile(l: HowToPlayService.Letter) {
    val filled = l.color != "empty"
    val fill = when (l.color) {
        "green" -> Color(0xFF7C3AED); "yellow" -> Color(0xFFF59E0B); "gray" -> Color(0xFF64748B); else -> accentWash(Color(0xFF7C3AED), 0.10f)
    }
    val border = if (filled) fill else accentLine(Color(0xFF7C3AED))
    Box(Modifier.size(34.dp).clip(RoundedCornerShape(6.dp)).background(fill).border(2.dp, border, RoundedCornerShape(6.dp)), Alignment.Center) {
        Text(l.ch, fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (filled) Color.White else InfoInk.heading)
    }
}
