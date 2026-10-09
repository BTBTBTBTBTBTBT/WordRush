package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.size
import androidx.compose.ui.graphics.graphicsLayer
import com.wordocious.app.data.AgeGate
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AgeCheck
import com.wordocious.app.data.AgeCheckStore
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FlagsService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29): D (glasses + pencil) SAYS ONE question,
 * "What year were you born?", in a comic speech bubble set in our bubble lettering, on a year wheel with NO default and
 * no hint that 13 matters. The live WORDOCIOUS cast row stays at the top; below it D and the birthday cake stand on one
 * soft floor as ONE scene (docs/design/brand/2.8/agecheck + bubbles; the canonical cast art placed as is). State,
 * storage, the server mirror and the service gating live in data/AgeCheckStore.kt. iOS: AgeCheckView.swift.
 */

private val Ink = Color(0xFF5B21B6)

/**
 * Root overlay: above the app until this device has answered (and forever for "under"). 2026-10-10: the placeholder is the
 * normal app background (never black), lasts at most [AgeGate.MAX_WAIT_MS], and the server lookup does not wait on the profile.
 */
@Composable
fun AgeGateOverlay() {
    val context = LocalContext.current
    remember { AgeCheckStore.load(); true }   // synchronous: a returning, already-passed device never flashes the question
    val stored by AgeCheckStore.stored.collectAsState()
    val flags by FlagsService.flags.collectAsState()
    val serverDone by AgeCheckStore.serverCheckDone.collectAsState()
    val profile by AuthService.profile.collectAsState()
    var elapsedMs by remember { mutableStateOf(0L) }

    LaunchedEffect(Unit) { delay(AgeGate.MAX_WAIT_MS); elapsedMs = AgeGate.MAX_WAIT_MS }
    // The lookup rides the session's user id (it returns quietly until there is one); a profile arriving re-runs it.
    LaunchedEffect(profile?.id) { AgeCheckStore.syncWithServer() }

    when (AgeGate.view(stored?.state, FlagsService.isLive("age_check", flags), AuthService.hadPersistedSession(), serverDone, elapsedMs)) {
        AgeGate.View.UNDER -> AgeCheckUnder()
        AgeGate.View.QUESTION -> AgeCheckQuestion(onAnswer = { AgeCheckStore.answer(context, it) })
        // The normal app background, never black; swallows touches like the screens it stands in for.
        AgeGate.View.PLACEHOLDER -> PageBackground(PageTint.HOME, Modifier.fillMaxSize().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}) {}
        AgeGate.View.PASS -> Unit
    }
}

private const val ROW_DP = 54
private const val VISIBLE = 5

@Composable
fun AgeCheckQuestion(onAnswer: (Int) -> Unit) {
    val years = remember { AgeCheck.years() }
    var picked by remember { mutableStateOf<Int?>(null) }

    Box(
        Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFFEEE4FF), Color(0xFFFFECF6))))
            .systemBarsPadding()
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // The live WORDOCIOUS cast row stays on top; the question lives below it.
            LivingCastHeader(Modifier.fillMaxWidth(), reportAnchor = false)
            AgeAskScene()
            YearWheel(years, picked, onPick = { picked = it })

            CastButton(
                text = "Continue",
                onClick = { picked?.let(onAnswer) },
                color = CastColor.PURPLE,
                fill = true,
                enabled = picked != null,
            )
        }
    }
}

/** The year wheel: a snapping LazyColumn. No row is selected until the player moves or taps it. */
@Composable
private fun YearWheel(years: List<Int>, picked: Int?, onPick: (Int) -> Unit, modifier: Modifier = Modifier) {
    val state = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val rowPx = with(LocalDensity.current) { ROW_DP.dp.toPx() }
    var touched by remember { mutableStateOf(false) }
    val centerIndex by remember {
        derivedStateOf {
            val total = state.firstVisibleItemIndex * rowPx + state.firstVisibleItemScrollOffset
            Math.round(total / rowPx).coerceIn(0, years.size - 1)
        }
    }
    // A real scroll (not the initial layout) counts as an answer once it settles.
    LaunchedEffect(state.isScrollInProgress) {
        if (state.isScrollInProgress) touched = true
        else if (touched) onPick(years[centerIndex])
    }

    Box(
        modifier.width(168.dp).height((ROW_DP * VISIBLE).dp)
            .shadow(12.dp, RoundedCornerShape(34.dp), ambientColor = Color(0x387C3AED), spotColor = Color(0x387C3AED))
            .background(
                Brush.verticalGradient(listOf(Color(0x99C4B5FD), Color(0xFFE9D5FF), Color(0x99C4B5FD))),
                RoundedCornerShape(34.dp),
            )
            .semantics { contentDescription = "Year you were born" },
    ) {
        // The gold answer band.
        Box(
            Modifier.align(Alignment.Center).offset(y = 0.dp).fillMaxWidth().padding(horizontal = 0.dp).height(ROW_DP.dp)
                .background(Brush.verticalGradient(listOf(Color(0x8CFDE047), Color(0x61FBBF24))), RoundedCornerShape(22.dp)),
        )
        LazyColumn(
            state = state,
            flingBehavior = rememberSnapFlingBehavior(state),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = (ROW_DP * 2).dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            itemsIndexed(years) { i, y ->
                val on = touched && picked == y
                Box(
                    Modifier.fillMaxWidth().height(ROW_DP.dp).clickable(
                        interactionSource = remember { MutableInteractionSource() }, indication = null,
                    ) {
                        touched = true
                        onPick(y)
                        scope.launch { state.animateScrollToItem(i) }
                    },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        y.toString(),
                        fontFamily = Nunito, fontWeight = FontWeight.Black,
                        fontSize = if (on) 32.sp else 24.sp,
                        color = if (on) Color(0xFF4C1D95) else Color(0x806D28D9),
                    )
                }
            }
        }
    }
}

/** A soft elliptical contact shadow on the shared floor. */
@Composable
private fun AgeContact(width: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    Box(
        modifier.width(width).height(16.dp)
            .background(Brush.radialGradient(listOf(Color(0x4D4C1D95), Color.Transparent)), androidx.compose.foundation.shape.CircleShape),
    )
}

/** The speech bubble (tail toward D) with a line of bubble lettering inside. Halloween: the black-violet candy bubble. */
@Composable
private fun AgeSpeechBubble(text: String, halloween: Boolean, modifier: Modifier = Modifier) {
    val aspect = if (halloween) 401f / 327f else 398f / 295f
    Box(modifier.fillMaxWidth().aspectRatio(aspect)) {
        Image(
            painterResource(if (halloween) R.drawable.age_bubble_halloween else R.drawable.age_bubble), null,
            Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds,
        )
        androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize()) {
            val w = maxWidth; val h = maxHeight
            BubbleText(
                text, if (halloween) HeadlinePalette.CELEBRATION else HeadlinePalette.HOME,
                Modifier.align(Alignment.TopStart).offset(x = w * 0.09f, y = h * 0.09f).width(w * 0.82f).height(h * (if (halloween) 0.62f else 0.64f)),
                maxSize = 40, minSize = 20,
            )
        }
    }
}

/** The one scene: D says the question; the cake sits beside him on the same floor, same lighting. */
@Composable
private fun AgeAskScene() {
    val halloween = rememberSeason() != null
    Column(Modifier.widthIn(max = 318.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        AgeSpeechBubble("WHAT YEAR WERE YOU BORN?", halloween, Modifier.fillMaxWidth())
        Box(Modifier.fillMaxWidth().height(150.dp).offset(y = (-26).dp)) {
            // the shared soft floor
            Box(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth(0.92f).height(34.dp)
                    .background(Brush.radialGradient(listOf(Color(0xA6C4B5FD), Color.Transparent)), androidx.compose.foundation.shape.CircleShape),
            )
            AgeContact(120.dp, Modifier.align(Alignment.BottomEnd).offset(x = (-22).dp, y = (-4).dp))
            AgeContact(92.dp, Modifier.align(Alignment.BottomStart).offset(x = 40.dp))
            Image(painterResource(R.drawable.mascot_d), null, Modifier.align(Alignment.BottomEnd).padding(end = 18.dp, bottom = 4.dp).size(142.dp))
            Image(painterResource(R.drawable.age_cake), null, Modifier.align(Alignment.BottomStart).padding(start = 52.dp).width(84.dp))
        }
    }
}

/** The kind scene for an under-13 answer: the lettered headline, a rainbow and the whole cast waving on one floor. */
@Composable
private fun AgeSeeYouScene() {
    val still = WTheme.calmMotion
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "wave")
    val phase by t.animateFloat(
        0f, 1f,
        androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(2400, easing = androidx.compose.animation.core.FastOutSlowInEasing), androidx.compose.animation.core.RepeatMode.Reverse),
        label = "phase",
    )
    val back = listOf(MascotId.R, MascotId.O2, MascotId.C, MascotId.U, MascotId.I)
    val front = listOf(MascotId.W, MascotId.O1, MascotId.D, MascotId.O3, MascotId.S)
    Column(
        Modifier.widthIn(max = 318.dp).fillMaxWidth().semantics(mergeDescendants = true) {
            contentDescription = "13 and up. See you soon! The Wordocious cast waves from under a rainbow."
        },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(painterResource(R.drawable.age_bunting), null, Modifier.width(190.dp))
        BubbleText("13 AND UP \u00B7 SEE YOU SOON!", HeadlinePalette.HOME, Modifier.offset(y = (-62).dp), maxSize = 36, minSize = 22)
        androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth().height(300.dp).offset(y = (-52).dp)) {
            val hw = maxWidth * 0.24f
            val rainbowW = maxWidth * 0.70f
            Image(painterResource(R.drawable.age_rainbow), null, Modifier.align(Alignment.TopCenter).width(rainbowW))
            Box(
                Modifier.align(Alignment.BottomCenter).offset(y = (-20).dp).fillMaxWidth(0.96f).height(44.dp)
                    .background(Brush.radialGradient(listOf(Color(0xB3C4B5FD), Color.Transparent)), androidx.compose.foundation.shape.CircleShape),
            )
            Column(Modifier.align(Alignment.TopCenter).offset(y = rainbowW * 163f / 229f - maxWidth * 0.12f)) {
                @Composable
                fun row(ids: List<MascotId>, k0: Int, modifier: Modifier = Modifier) {
                    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(-hw * 0.16f, Alignment.CenterHorizontally)) {
                        ids.forEachIndexed { i, id ->
                            val k = k0 + i
                            val wob = if (still) 0f else androidx.compose.animation.core.FastOutSlowInEasing.transform(((phase + k * 0.06f) % 1f))
                            Image(
                                painterResource(id.res), null,
                                Modifier.width(hw).graphicsLayer {
                                    translationY = -wob * hw.toPx() * 0.04f
                                    rotationZ = wob * (if (k % 2 == 0) -3f else 2.5f)
                                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
                                },
                            )
                        }
                    }
                }
                row(back, 0)
                row(front, 5, Modifier.offset(y = -hw * 0.30f))
            }
        }
    }
}

/** The kind screen for an under-13 answer: nothing is created, the answer sticks on this device. */
@Composable
fun AgeCheckUnder() {
    val context = LocalContext.current
    Box(
        Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFFE4ECFF), Color(0xFFFDF1E4))))
            .systemBarsPadding()
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // The live WORDOCIOUS cast row stays on top.
            LivingCastHeader(Modifier.fillMaxWidth(), reportAnchor = false)
            AgeSeeYouScene()
            Text(
                "Wordocious is for players 13 and up. We would love to play with you when you are older!",
                fontFamily = Nunito, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, lineHeight = 20.sp,
                color = Ink, textAlign = TextAlign.Center,
            )
            Text(
                "Parents: questions or corrections? ${AgeCheck.SUPPORT_EMAIL}",
                modifier = Modifier.clickable {
                    runCatching {
                        context.startActivity(
                            android.content.Intent(android.content.Intent.ACTION_SENDTO, android.net.Uri.parse("mailto:${AgeCheck.SUPPORT_EMAIL}"))
                                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    }
                },
                fontFamily = Nunito, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                color = Ink.copy(alpha = 0.75f), textAlign = TextAlign.Center,
            )
        }
    }
}
