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
 * The neutral, on-brand 13+ age check (FRIDAY-QUEUE item 29): D (glasses + pencil) asks ONE question,
 * "When's your birthday year?", on a year wheel with NO default and no hint that 13 matters. Layered art
 * from docs/design/brand/2.8/agecheck (ChatGPT props; the canonical cast art placed as is). State,
 * storage, the server mirror and the service gating live in data/AgeCheckStore.kt. iOS: AgeCheckView.swift.
 */

private val Ink = Color(0xFF5B21B6)

/** Root overlay: above the app until this device has answered (and forever for "under"). */
@Composable
fun AgeGateOverlay() {
    val context = LocalContext.current
    remember { AgeCheckStore.load(); true }   // synchronous: a returning, already-passed device never flashes the question
    val stored by AgeCheckStore.stored.collectAsState()
    val flags by FlagsService.flags.collectAsState()
    val serverDone by AgeCheckStore.serverCheckDone.collectAsState()
    val profile by AuthService.profile.collectAsState()
    var waitedOut by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { delay(6_000); waitedOut = true }
    LaunchedEffect(profile?.id) { if (profile != null) AgeCheckStore.syncWithServer() }

    when {
        stored?.state == AgeCheck.State.UNDER -> AgeCheckUnder()
        stored == null && FlagsService.isLive("age_check", flags) -> {
            // A returning signed-in player on a fresh device may already be confirmed server-side: give the
            // lookup a moment before asking (never longer than 6 s).
            if (AuthService.hadPersistedSession() && !serverDone && !waitedOut) {
                Box(Modifier.fillMaxSize().background(WTheme.bg))
            } else {
                AgeCheckQuestion(onAnswer = { AgeCheckStore.answer(context, it) })
            }
        }
        else -> Unit
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
            Modifier.widthIn(max = 420.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(painterResource(R.drawable.age_bunting), null, Modifier.width(209.dp))

            // D's speech bubble: the one question.
            Text(
                "When's your birthday year?",
                modifier = Modifier.fillMaxWidth().offset(y = (-34).dp)
                    .shadow(10.dp, RoundedCornerShape(34.dp), ambientColor = Color(0x337C3AED), spotColor = Color(0x337C3AED))
                    .background(Brush.verticalGradient(listOf(Color(0xFFF6EFFF), Color(0xFFE6D6FF))), RoundedCornerShape(34.dp))
                    .padding(start = 20.dp, end = 20.dp, top = 30.dp, bottom = 24.dp)
                    .semantics { heading() },
                fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = 28.sp, lineHeight = 31.sp,
                color = Ink, textAlign = TextAlign.Center,
            )

            YearWheel(years, picked, onPick = { picked = it }, modifier = Modifier.offset(y = (-22).dp))

            Row(Modifier.fillMaxWidth().offset(y = (-14).dp), verticalAlignment = Alignment.Bottom) {
                Image(painterResource(R.drawable.age_cake), null, Modifier.width(90.dp))
                Box(Modifier.weight(1f))
                Image(painterResource(R.drawable.mascot_d), null, Modifier.width(150.dp))
            }

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
            .semantics { contentDescription = "Birthday year" },
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
            Modifier.widthIn(max = 420.dp).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(
                painterResource(R.drawable.age_under13),
                contentDescription = "13 and up. See you soon! The Wordocious cast waves from under a rainbow.",
                modifier = Modifier.weight(1f, fill = false).fillMaxWidth(),
                contentScale = ContentScale.Fit,
            )
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
