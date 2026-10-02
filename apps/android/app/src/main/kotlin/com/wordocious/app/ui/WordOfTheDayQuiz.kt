package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.HomeStreaksService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val LETTERS = listOf("A", "B", "C")
private const val REVEAL_MS = 2200L

/** Where the /api/wotd fetch stands: still loading, failed, or answered with an entry. */
private sealed interface WotdLoad {
    data object Loading : WotdLoad
    data object Failed : WotdLoad
    data class Ready(val info: HomeStreaksService.WotdInfo) : WotdLoad
}

/**
 * Word of the Day, now a three-choice quiz (founder-approved home redesign,
 * 2026-10-01; spec §4). Before answering, the definition is hidden behind three
 * choices (one real; /api/wotd picks the same two decoys for everyone each
 * day). A tap shows a ~2.2 s right/wrong beat, then the card settles into
 * today's ordinary card with ONLY the real definition, plus a small flame and
 * the word streak after a right answer. The wrong choices never come back that
 * day. No quiz today (choices null) or a failed request: the plain card, as
 * before. Mirrors web components/home/word-of-the-day.tsx.
 *
 * "Past words" opens the archive in every state; while the quiz is asking only
 * that link does (a tap on a choice answers), and once answered the whole card
 * opens it again, as it always has.
 *
 * ART_SPEC §12 / §19.2: the whole-cast WORD OF THE DAY art is the section header
 * ABOVE the card, centered (same size as the DAILIES / PUZZLES headers), with "Past
 * words" small and centered under it; the card keeps its content.
 */
/** ART_SPEC §21.5: the Word of the Day card's top band — I's green (the WOTD host). */
internal val WOTD_CARD_ACCENT = Color(0xFF4CC77A)

@Composable
internal fun WordOfTheDayCard(onPastWords: () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionTitleArt(TitleArt.WOTD, below = { PastWordsLink(onPastWords) })
        WordOfTheDayCardBody(onPastWords)
    }
}

/** "Past words ›" — the archive link centered under the WORD OF THE DAY title (§19.2). */
@Composable
private fun PastWordsLink(onPastWords: () -> Unit) {
    // A1 / A9: a navigation link as a tinted chip in I's green that squishes.
    CappedFontScale {
        InfoLinkChip("Past words \u203A", WOTD_CARD_ACCENT, Modifier.padding(top = 2.dp), onClick = onPastWords)
    }
}

@Composable
private fun WordOfTheDayCardBody(onPastWords: () -> Unit) {
    val day = remember { com.wordocious.app.todayLocalDate() }
    val load by produceState<WotdLoad>(
        initialValue = HomeStreaksService.cachedWotd(day)?.let { WotdLoad.Ready(it) } ?: WotdLoad.Loading,
    ) {
        val fresh = HomeStreaksService.fetchWotd(day)
        value = when {
            fresh != null -> WotdLoad.Ready(fresh)
            value is WotdLoad.Ready -> value // offline: keep today's cached entry
            else -> WotdLoad.Failed
        }
    }
    when (val l = load) {
        WotdLoad.Loading -> WotdSkeleton()
        WotdLoad.Failed -> PlainWordOfTheDayCard(onClick = onPastWords)
        is WotdLoad.Ready -> if (l.info.hasQuiz) QuizCard(l.info, day, onPastWords) else PlainWordOfTheDayCard(onClick = onPastWords)
    }
}

@Composable
private fun QuizCard(info: HomeStreaksService.WotdInfo, day: String, onPastWords: () -> Unit) {
    val choices = info.choices!!
    val answerIdx = info.answer!!
    val authed by com.wordocious.app.data.AuthService.isAuthenticated.collectAsState()
    var answer by remember(authed) { mutableStateOf<HomeStreaksService.QuizAnswer?>(null) }
    var answerLoaded by remember(authed) { mutableStateOf(false) }
    var streak by remember(authed) { mutableIntStateOf(0) }
    var revealing by remember { mutableStateOf(false) }
    LaunchedEffect(authed, day) {
        runCatching { HomeStreaksService.quizState(day) }.getOrNull()?.let { s ->
            if (answer == null) answer = s.today
            streak = s.streak
        }
        answerLoaded = true
    }
    LaunchedEffect(revealing) {
        if (revealing) { delay(REVEAL_MS); revealing = false }
    }
    val asking = answerLoaded && answer == null
    // With a quiz, the definition stays hidden until we know the player has answered (never flash it).
    val settled = answerLoaded && answer != null
    val definition = choices[answerIdx]
    val partOfSpeech = info.quizPartOfSpeech?.takeIf { it.isNotBlank() } ?: info.partOfSpeech
    val showFlame = answer?.correct == true && !revealing && streak > 0

    val pick: (Int) -> Unit = pick@{ i ->
        if (answer != null) return@pick
        val result = HomeStreaksService.QuizAnswer(picked = i, correct = i == answerIdx)
        answer = result
        streak = if (result.correct) streak + 1 else 0
        revealing = true
        // Fire-and-forget: the answer must land even if Home leaves the composition.
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            HomeStreaksService.saveQuizAnswer(day, info.word, result)
        }
    }

    // ART_SPEC §21.5: the Home game-card treatment with I's green band.
    // Once answered, the whole card opens Past Words again (today's behavior).
    GameCardFrame(WOTD_CARD_ACCENT, onClick = if (settled && !revealing) onPastWords else null) {
        CappedFontScale {
            // The WORD OF THE DAY title + "Past words" are the section header above (§12).
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val display = info.word.first().uppercase() + info.word.drop(1).lowercase()
                Text(display, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                if (info.phonetic.isNotBlank()) {
                    Text(info.phonetic, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                if (partOfSpeech.isNotBlank()) {
                    Text(
                        partOfSpeech.lowercase(), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                        fontStyle = FontStyle.Italic, color = purpleTextInk,
                    )
                }
                if (showFlame) {
                    Spacer(Modifier.weight(1f))
                    StreakFlame(streak, flame = 14.dp, fontSize = 13)
                }
            }
        }

        if (asking) {
            Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Which one is it?", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = darkSafe(Color(0xFF4B5563), WTheme.textSecondary))
                choices.forEachIndexed { i, c ->
                    // A1 / A9: each choice a tinted row that squishes.
                    Row(
                        Modifier.fillMaxWidth()
                            .squishClickable("Choice ${LETTERS[i]}: $c") { pick(i) }
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(accentWash(Color(0xFF7C3AED), 0.08f))
                            .border(1.5.dp, accentLine(Color(0xFF7C3AED), 0.28f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CappedFontScale {
                            Box(Modifier.size(20.dp).clip(CircleShape).background(Color(0xFFEDE9FE)), contentAlignment = Alignment.Center) {
                                Text(LETTERS[i], fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFF5B21B6))
                            }
                        }
                        Text(c, fontSize = 12.sp, lineHeight = 1.3.em, fontWeight = FontWeight.Bold, color = WTheme.text)
                    }
                }
            }
        }

        val a = answer
        if (revealing && a != null) {
            val ink = if (a.correct) Color(0xFF15803D) else Color(0xFFB91C1C)
            Row(
                Modifier.padding(top = 6.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp))
                    .background(if (a.correct) Color(0xFFDCFCE7) else Color(0xFFFEE2E2))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.AutoAwesome, null, tint = ink, modifier = Modifier.size(20.dp))
                Column {
                    Text(if (a.correct) "Nice! You knew it." else "Not this time.", fontSize = 14.sp, fontWeight = FontWeight.Black, color = ink)
                    Text(
                        if (a.correct) "Word streak: $streak"
                        else "You picked ${LETTERS[a.picked.coerceIn(0, 2)]}. It's ${LETTERS[answerIdx]}: $definition",
                        fontSize = 11.sp, lineHeight = 1.3.em, fontWeight = FontWeight.ExtraBold, color = ink,
                    )
                }
            }
        }

        if (settled && !revealing) {
            Text(definition, fontSize = 11.sp, lineHeight = 1.3.em, fontWeight = FontWeight.Bold, color = darkSafe(Color(0xFF4B5563), WTheme.textSecondary), modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/** Web parity: structural pulse skeleton while today's entry loads, never a "…" placeholder. */
@Composable
private fun WotdSkeleton() {
    GameCardFrame(WOTD_CARD_ACCENT) {
        SkeletonBlock(height = 16.dp, width = 70.dp, cornerRadius = 6.dp)
        Spacer(Modifier.height(6.dp))
        SkeletonBlock(height = 10.dp, cornerRadius = 5.dp)
    }
}
