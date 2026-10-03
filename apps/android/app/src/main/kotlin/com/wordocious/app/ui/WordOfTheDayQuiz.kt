package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.HomeStreaksService
import com.wordocious.app.ui.game.GameTileFace
import com.wordocious.app.ui.game.TileFace
import com.wordocious.app.ui.game.WinPopupMath
import com.wordocious.app.ui.theme.Nunito
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
    // BJ7: the compact section title (DAILIES / PUZZLES size), 6 under it.
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        SectionTitleArt(TitleArt.WOTD, below = { PastWordsLink(onPastWords) }, scale = HomeCardSpec.SECTION_TITLE_SCALE)
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

/**
 * FINISH_SPEC BI17: the Word of the Day card chrome — the guide hero card in I's green
 * (no stroke, the rainbow bar, the accent gradient over cream, one soft shadow), radius
 * 24, content leading. Shared with the plain (no-quiz / failed) card on Home.
 */
@Composable
internal fun WotdCardFrame(onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    GuideHeroCard(
        WOTD_CARD_ACCENT,
        if (onClick != null) Modifier.squishClickable(card = true, onClick = onClick) else Modifier,
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 12.dp),
        spacing = 8.dp,
        radius = 20.dp,
        horizontalAlignment = Alignment.Start,
        content = content,
    )
}

/** I's ready pose (~52) on a small soft glow (decorative). */
@Composable
private fun WotdHostGlow() {
    Box(Modifier.size(44.dp).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        val glow = WOTD_CARD_ACCENT.copy(alpha = if (WTheme.isDark) 0.42f else 0.32f)
        Canvas(Modifier.size(44.dp)) {
            val r = size.minDimension / 2f
            drawCircle(Brush.radialGradient(0f to glow, 1f to glow.copy(alpha = 0f), center = center, radius = r), radius = r)
        }
        CastPose(MascotId.I, "ready", 42.dp)
    }
}

/** The word in the brand caps (one line, shrinks to fit), phonetic and the part-of-speech chip. */
@Composable
private fun WotdWordColumn(word: String, phonetic: String, partOfSpeech: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        LiveHeadline(
            word, HeadlinePalette.HOME, Modifier.fillMaxWidth(),
            maxSize = 22.sp, minSize = 14.sp, align = TextAlign.Start, maxLines = 1, sound = false,
        )
        if (phonetic.isNotBlank() || partOfSpeech.isNotBlank()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (phonetic.isNotBlank()) {
                    Text(phonetic, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted, maxLines = 1)
                }
                if (partOfSpeech.isNotBlank()) GuideChip(partOfSpeech.uppercase(), GUIDE_BRAND)
            }
        }
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

/** A choice tile's look during the quiz. */
private enum class ChoiceLook { ASK, RIGHT, WRONG, DIM }

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
        // Outage-safe (BI17 §3): a failed database read falls back to this device's history.
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

    // Once answered, the whole card opens Past Words again (today's behavior).
    WotdCardFrame(onClick = if (settled && !revealing) onPastWords else null) {
        CappedFontScale {
            // The WORD OF THE DAY title + "Past words" are the section header above (§12).
            // BJ7: one top line — I, the word and the streak top-aligned.
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                WotdHostGlow()
                WotdWordColumn(info.word, info.phonetic, partOfSpeech, Modifier.weight(1f))
                if (showFlame) StreakFlame(streak, flame = 15.dp, fontSize = 16)
            }
        }

        val a = answer
        if (asking || (revealing && a != null)) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (asking) {
                    Text(
                        "WHICH ONE IS IT?", fontFamily = Nunito, fontSize = 10.sp, fontWeight = FontWeight.Black,
                        letterSpacing = 1.2.sp, color = guideAccentInk(GUIDE_BRAND),
                    )
                }
                choices.forEachIndexed { i, c ->
                    val look = when {
                        a == null -> ChoiceLook.ASK
                        i == answerIdx -> ChoiceLook.RIGHT
                        i == a.picked -> ChoiceLook.WRONG
                        else -> ChoiceLook.DIM
                    }
                    CandyChoice(LETTERS[i], c, look, onClick = if (asking) ({ pick(i) }) else null)
                }
            }
        }

        if (revealing && a != null) {
            val ink = if (a.correct) darkSafe(Color(0xFF15803D), Color(0xFF86EFAC)) else darkSafe(Color(0xFFB91C1C), Color(0xFFFDA4AF))
            val wash = guideField(if (a.correct) Color(0xFF22C55E) else Color(0xFFF43F5E), 0.14f, 0.24f)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(wash)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // §G5 / §A7: a small pose — O1 cheers a right answer, R sits a wrong one (iOS parity).
                CastPose(if (a.correct) MascotId.O1 else MascotId.R, if (a.correct) "cheer" else "sit", 40.dp)
                Column(Modifier.weight(1f)) {
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
            Text(definition, fontSize = 14.sp, lineHeight = 1.35.em, fontWeight = FontWeight.Bold, color = InfoInk.muted)
        }
    }
}

/**
 * One glossy candy choice (BI17): full width, radius 16, min height 48, a vertical lilac
 * gradient with a soft white top gloss and one soft shadow — no stroke. Revealed: the
 * right answer turns green candy (and pops once), a wrong pick rose, the others fade.
 */
@Composable
private fun CandyChoice(letter: String, text: String, look: ChoiceLook, onClick: (() -> Unit)?) {
    val shape = RoundedCornerShape(16.dp)
    val dark = WTheme.isDark
    val surface = WTheme.surface.toArgb()
    val purple = GUIDE_BRAND.toArgb()
    val (top, bottom) = when (look) {
        ChoiceLook.RIGHT -> Color(0xFF34D399) to Color(0xFF059669)
        ChoiceLook.WRONG -> Color(0xFFFB7185) to Color(0xFFE11D48)
        else -> if (dark) Color(WinPopupMath.cardWash(purple, 0.26f, surface)) to Color(WinPopupMath.cardWash(purple, 0.14f, surface))
        else Color(0xFFF3EDFF) to Color(0xFFE4D8FF)
    }
    val solid = look == ChoiceLook.RIGHT || look == ChoiceLook.WRONG
    val shadowTint = when (look) {
        ChoiceLook.RIGHT -> Color(0xFF059669)
        ChoiceLook.WRONG -> Color(0xFFE11D48)
        else -> GUIDE_BRAND
    }
    val still = WTheme.reducedMotion
    // The right tile pops 1 → 1.04 → 1 once (transform only): progress 0 → 1 over a sine bump.
    val pop = remember { Animatable(0f) }
    LaunchedEffect(look == ChoiceLook.RIGHT) {
        if (look != ChoiceLook.RIGHT || still) return@LaunchedEffect
        pop.snapTo(0f)
        pop.animateTo(1f, androidx.compose.animation.core.tween(380, easing = FastOutSlowInEasing))
    }
    val fade = if (look == ChoiceLook.DIM) 0.4f else 1f
    val label = "Choice $letter: $text"
    Row(
        Modifier.fillMaxWidth()
            .graphicsLayer {
                val k = 1f + 0.04f * kotlin.math.sin(Math.PI.toFloat() * pop.value)
                scaleX = k; scaleY = k; alpha = fade
            }
            .then(
                if (onClick != null) Modifier.squishClickable(label, onClick = onClick)
                else Modifier.semantics(mergeDescendants = true) { contentDescription = label },
            )
            .heightIn(min = 44.dp)
            .shadow(5.dp, shape, clip = false, ambientColor = shadowTint.copy(alpha = 0.25f), spotColor = shadowTint.copy(alpha = 0.30f))
            .clip(shape)
            .background(Brush.verticalGradient(listOf(top, bottom)))
            .drawBehind {
                val h = size.height * 0.45f
                drawRect(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = if (dark && !solid) 0.10f else 0.35f), Color.White.copy(alpha = 0f)), endY = h),
                    topLeft = Offset.Zero, size = Size(size.width, h),
                )
            }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CappedFontScale {
            GameTileFace(
                letter, if (look == ChoiceLook.RIGHT) TileFace.CORRECT else TileFace.TYPED,
                Modifier.size(28.dp).clearAndSetSemantics { },
            )
        }
        Text(
            text, fontFamily = Nunito, fontSize = 14.sp, lineHeight = 1.3.em, fontWeight = FontWeight.Bold,
            color = if (solid) Color.White else InfoInk.heading, modifier = Modifier.weight(1f),
        )
    }
}

/** Web parity: structural pulse skeleton while today's entry loads, never a "…" placeholder. */
@Composable
private fun WotdSkeleton() {
    WotdCardFrame {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            WotdHostGlow()
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SkeletonBlock(height = 22.dp, width = 120.dp, cornerRadius = 6.dp)
                SkeletonBlock(height = 12.dp, width = 80.dp, cornerRadius = 5.dp)
            }
        }
        SkeletonBlock(height = 12.dp, cornerRadius = 5.dp)
    }
}

/** The skeleton for Home's plain card (no quiz today) while its word loads. */
@Composable
internal fun WotdPlainSkeleton() = WotdSkeleton()

/**
 * The plain Word of the Day card (no quiz today, or /api/wotd failed): the same
 * guide-family top row, then the definition. The whole card opens Past Words.
 */
@Composable
internal fun WotdPlainCard(word: String, phonetic: String, partOfSpeech: String, definition: String, onClick: () -> Unit) {
    WotdCardFrame(onClick = onClick) {
        CappedFontScale {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                WotdHostGlow()
                WotdWordColumn(word, phonetic, partOfSpeech, Modifier.weight(1f))
            }
        }
        // Not capped: the definition reflows at the user's full text size.
        if (definition.isNotBlank()) {
            Text(definition, fontSize = 14.sp, lineHeight = 1.35.em, fontWeight = FontWeight.Bold, color = InfoInk.muted)
        }
    }
}

