package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
)

val INFO_NAV = listOf(
    InfoNavItem("help", "How to Play", "Rules, tiles & scoring", Icons.AutoMirrored.Filled.HelpOutline, Color(0xFF7C3AED)),
    InfoNavItem("guides", "Guides", "Strategy for all 9 modes", Icons.Filled.MenuBook, Color(0xFF3B82F6)),
    InfoNavItem("strategy", "Strategy", "Solve faster, in fewer guesses", Icons.Filled.Lightbulb, Color(0xFFF59E0B)),
    InfoNavItem("words", "Words", "Every Word of the Day", Icons.Filled.CalendarMonth, Color(0xFFEC4899)),
    InfoNavItem("about", "About", "What is Wordocious?", Icons.Filled.Info, Color(0xFF14B8A6)),
    InfoNavItem("faq", "FAQ", "Common questions", Icons.Filled.QuestionAnswer, Color(0xFF8B5CF6)),
    InfoNavItem("privacy", "Privacy", "How we handle your data", Icons.Filled.Lock, Color(0xFF10B981)),
    InfoNavItem("terms", "Terms", "Terms of service", Icons.Filled.Description, Color(0xFF6B7280)),
)

/** Styled "?" menu — a welcoming, on-brand list (colour-accented icon tiles +
 *  title + subtitle) instead of the flat grey system dropdown. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoMenuSheet(onNav: (String) -> Unit, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = WTheme.bg, dragHandle = null) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Menu", fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f), style = TextStyle(brush = WTheme.wordmarkGradient))
            Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onDismiss))
        }
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            INFO_NAV.forEach { item ->
                Row(infoCardMod().clickableNoRipple { onNav(item.route) }.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(item.accent.copy(alpha = 0.14f)), Alignment.Center) {
                        Icon(item.icon, null, tint = item.accent, modifier = Modifier.size(20.dp))
                    }
                    Column(Modifier.weight(1f)) {
                        Text(item.label, fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(item.subtitle, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                    Icon(Icons.Filled.ChevronRight, null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

// ── Services (mirror GuideService: fetch web JSON, memory-cache) ───────────────

object StrategyService {
    private val json = Json { ignoreUnknownKeys = true }
    @Serializable data class Article(val slug: String, val title: String, val dek: String, val minutes: Int, val sections: List<Section> = emptyList())
    @Serializable data class Section(val heading: String, val body: List<String> = emptyList())
    @Serializable private data class Payload(val articles: List<Article> = emptyList())
    private var cache: List<Article>? = null

    suspend fun articles(): List<Article> = withContext(Dispatchers.IO) {
        cache ?: runCatching {
            val conn = (URL("https://wordocious.com/api/strategy").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val out = if (conn.responseCode in 200..299)
                json.decodeFromString(Payload.serializer(), conn.inputStream.bufferedReader().use { it.readText() }).articles
            else emptyList()
            conn.disconnect(); cache = out; out
        }.getOrDefault(emptyList())
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
    private var cache: List<Entry>? = null

    suspend fun words(): List<Entry> = withContext(Dispatchers.IO) {
        cache ?: runCatching {
            val conn = (URL("https://wordocious.com/api/words").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val out = if (conn.responseCode in 200..299)
                json.decodeFromString(Payload.serializer(), conn.inputStream.bufferedReader().use { it.readText() }).words
            else emptyList()
            conn.disconnect(); cache = out; out
        }.getOrDefault(emptyList())
    }
}

private fun prettyDate(key: String): String = runCatching {
    val inFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val out = SimpleDateFormat("MMM d, yyyy", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    out.format(inFmt.parse(key)!!)
}.getOrDefault(key)

// ── Shared chrome ─────────────────────────────────────────────────────────────

@Composable
private fun OverlayScaffold(title: String, onDone: () -> Unit, leading: (@Composable () -> Unit)? = null, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().background(WTheme.surface)) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (leading != null) { leading(); Spacer(Modifier.size(8.dp)) }
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f), style = TextStyle(brush = WTheme.wordmarkGradient))
            Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onDone))
        }
        content()
    }
}

@Composable
private fun infoCardMod() = Modifier
    .fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
    .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))

// ── Strategy ──────────────────────────────────────────────────────────────────

@Composable
fun StrategyScreen(onDone: () -> Unit) {
    val articles by produceState(initialValue = emptyList<StrategyService.Article>()) { value = StrategyService.articles() }
    var selected by remember { mutableStateOf<StrategyService.Article?>(null) }

    selected?.let { a ->
        androidx.activity.compose.BackHandler { selected = null }
        OverlayScaffold(a.title, onDone = onDone, leading = {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple { selected = null })
        }) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("STRATEGY · ${a.minutes} MIN READ", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.primary)
                Text(a.dek, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                a.sections.forEach { s ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(s.heading, fontSize = 17.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        s.body.forEach { Text(it, fontSize = 13.sp, color = WTheme.textSecondary, lineHeight = 19.sp) }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
        return
    }

    OverlayScaffold("Strategy", onDone) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Practical, original strategy for solving daily word puzzles faster and in fewer guesses.", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            if (articles.isEmpty()) {
                CircularProgressIndicator(color = WTheme.primary, modifier = Modifier.padding(top = 32.dp).align(Alignment.CenterHorizontally))
            } else articles.forEach { a ->
                Row(infoCardMod().clickableNoRipple { selected = a }.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(Color(0xFFF59E0B).copy(alpha = 0.14f)), Alignment.Center) {
                        Icon(Icons.Filled.Lightbulb, null, tint = Color(0xFFF59E0B), modifier = Modifier.size(20.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("${a.minutes} MIN READ", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color(0xFFF59E0B))
                        Text(a.title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(a.dek, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ── Words (Word of the Day archive) ───────────────────────────────────────────

@Composable
fun WordsScreen(onDone: () -> Unit) {
    val words by produceState(initialValue = emptyList<WordsService.Entry>()) { value = WordsService.words() }
    var selected by remember { mutableStateOf<WordsService.Entry?>(null) }

    selected?.let { w ->
        androidx.activity.compose.BackHandler { selected = null }
        WordDetail(w, onDone = onDone, onBack = { selected = null })
        return
    }

    OverlayScaffold("Words", onDone) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Every day Wordocious surfaces a Word of the Day — the shared answer thousands of players race to solve.", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            if (words.isEmpty()) {
                CircularProgressIndicator(color = WTheme.primary, modifier = Modifier.padding(top = 32.dp).align(Alignment.CenterHorizontally))
            } else words.forEach { w ->
                Row(infoCardMod().clickableNoRipple { selected = w }.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)).background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9)))), Alignment.Center) {
                        Text(w.word.take(1).uppercase(), fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(w.word.uppercase(), fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(prettyDate(w.date), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                    Icon(Icons.Filled.ChevronRight, null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun WordDetail(w: WordsService.Entry, onDone: () -> Unit, onBack: () -> Unit) {
    val word = w.word.uppercase()
    OverlayScaffold(word, onDone = onDone, leading = {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = WTheme.textMuted, modifier = Modifier.size(20.dp).clickableNoRipple(onBack))
    }) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // Gradient hero band — white tiles on a purple→pink panel.
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899)))).padding(vertical = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("WORD OF THE DAY · ${prettyDate(w.date)}", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = Color.White.copy(alpha = 0.9f))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    word.forEach { c ->
                        Box(Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)).background(Color.White), Alignment.Center) {
                            Text(c.toString(), fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9))
                        }
                    }
                }
                if (w.phonetic.isNotEmpty() || w.partOfSpeech.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (w.phonetic.isNotEmpty()) Text(w.phonetic, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.95f))
                        if (w.partOfSpeech.isNotEmpty()) Text(w.partOfSpeech, fontSize = 11.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, color = Color.White)
                    }
                }
            }
            if (w.definition.isNotEmpty()) {
                WordSectionCard("Meaning", Icons.Filled.MenuBook, Color(0xFF7C3AED)) {
                    Text(w.definition, fontSize = 13.sp, color = WTheme.text, lineHeight = 18.sp)
                    if (w.example.isNotEmpty()) Text("“${w.example}”", fontSize = 12.sp, fontStyle = FontStyle.Italic, color = WTheme.textMuted)
                    w.extraSenses.forEach { Text("${it.partOfSpeech}  ${it.definition}", fontSize = 12.sp, color = WTheme.textMuted) }
                }
            }
            WordSectionCard("$word as a puzzle answer", Icons.Filled.Lightbulb, Color(0xFFF59E0B)) {
                Text(w.analysisSummary, fontSize = 13.sp, color = WTheme.textSecondary, lineHeight = 18.sp)
                Text(w.analysisStrategy, fontSize = 13.sp, color = WTheme.textSecondary, lineHeight = 18.sp)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun WordSectionCard(title: String, icon: ImageVector, tint: Color, content: @Composable () -> Unit) {
    Column(infoCardMod().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Box(Modifier.size(26.dp).clip(RoundedCornerShape(8.dp)).background(tint.copy(alpha = 0.14f)), Alignment.Center) {
                Icon(icon, null, tint = tint, modifier = Modifier.size(14.dp))
            }
            Text(title.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = WTheme.text)
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}

// ── Guides index (list 9 modes → GuideSheet) ──────────────────────────────────

@Composable
fun GuidesIndexScreen(onDone: () -> Unit) {
    val modes = listOf(GameMode.DUEL, GameMode.DUEL_6, GameMode.DUEL_7, GameMode.QUORDLE, GameMode.OCTORDLE, GameMode.SEQUENCE, GameMode.RESCUE, GameMode.GAUNTLET, GameMode.PROPERNOUNDLE)
    val guides by produceState(initialValue = emptyList<Pair<GameMode, com.wordocious.app.data.GuideService.ModeGuide?>>()) {
        value = modes.map { it to com.wordocious.app.data.GuideService.guide(it) }
    }
    var selected by remember { mutableStateOf<GameMode?>(null) }

    selected?.let { mode ->
        androidx.activity.compose.BackHandler { selected = null }
        GuideSheet(mode = mode, onDismiss = { selected = null })
        return
    }

    OverlayScaffold("Guides", onDone) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            (guides.ifEmpty { modes.map { it to null } }).forEach { (mode, g) ->
                Row(infoCardMod().clickableNoRipple { selected = mode }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(g?.title ?: mode.name, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        if (g?.tagline != null) Text(g.tagline, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                    Icon(Icons.Filled.ChevronRight, null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ── Home footer link row (web footer parity) ──────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun InfoFooter(onNav: (String) -> Unit) {
    FlowRow(
        Modifier.fillMaxWidth().padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        INFO_NAV.forEach { item ->
            Text(item.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.clickableNoRipple { onNav(item.route) })
        }
    }
}
