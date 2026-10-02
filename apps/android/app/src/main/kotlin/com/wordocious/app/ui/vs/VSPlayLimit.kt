package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.MascotId
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics

/** Seconds until the next LOCAL midnight (daily VS resets locally). */
private fun vsLimitSecondsUntilMidnight(): Long {
    val cal = java.util.Calendar.getInstance()
    val now = cal.timeInMillis
    cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
    cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0)
    cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
    return ((cal.timeInMillis - now) / 1000).coerceAtLeast(0)
}

/**
 * "Daily VS Used" modal — ports iOS VSLobbyView.VSLimitModal (web
 * vs-limit-modal.tsx). Shown when a free player taps the grayed-out
 * "Play Daily VS" card: live countdown to midnight, Go Pro, Maybe later.
 */
@Composable
fun VSDailyLimitModal(onGoPro: () -> Unit, onClose: () -> Unit) {
    VsLimitWindow(
        title = "DAILY VS USED",
        body = "You've played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.",
        secondsUntilReset = ::vsLimitSecondsUntilMidnight,
        onGoPro = onGoPro, onClose = onClose,
        // A7: the lobby's host is S (and W stands in the faceoff) — U waits for tomorrow.
        pose = MascotId.U to "waiting",
    )
}

/**
 * The VS limit window (FINISH_SPEC G5 "limit-reached window" + D3): a dim scrim (tap
 * to close, no squish), the gold-tinted card family with its gold top bar, a waiting
 * cast [pose], the reset clock as a soft number in a tinted pill, GO PRO = the large
 * amber candy, MAYBE LATER = peach. The card itself swallows taps.
 */
@Composable
fun VsLimitWindow(
    title: String,
    body: String,
    secondsUntilReset: () -> Long,
    onGoPro: () -> Unit,
    onClose: () -> Unit,
    pose: Pair<MascotId, String>,
) {
    val scrim = remember { MutableInteractionSource() }
    val card = remember { MutableInteractionSource() }
    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f))
            .clickable(interactionSource = scrim, indication = null, onClickLabel = "Close", onClick = onClose)
            .statusBarsPadding().navigationBarsPadding(),
        Alignment.Center,
    ) {
        VsTintedCard(
            Modifier.padding(horizontal = 24.dp).widthIn(max = 420.dp).fillMaxWidth()
                .clickable(interactionSource = card, indication = null) { },
            accent = VS_GOLD_ACCENT, corner = 22.dp, barHeight = 10.dp,
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 20.dp),
        ) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                VsCastPose(pose.first, pose.second, 112.dp)
                Text(
                    title, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = Color(0xFF78350F),
                    modifier = Modifier.semantics { heading() },
                )
                Text(body, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FinishInk.muted, textAlign = TextAlign.Center)
                var tick by remember { mutableStateOf(0) }
                LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
                @Suppress("UNUSED_EXPRESSION") tick
                val s = secondsUntilReset()
                val clock = "%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)
                Row(
                    Modifier.vsPill(VS_GOLD_ACCENT, 50.dp).padding(start = 14.dp, end = 14.dp, top = 8.dp, bottom = 5.dp)
                        .semantics(mergeDescendants = true) { contentDescription = "Resets in $clock" },
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    VsCapsLabel("RESETS IN", color = Color(0xFF92400E), fontSize = 11.sp)
                    VsNumber(clock, 16.sp)
                }
                CandyButtonFill("GO PRO", { onClose(); onGoPro() }, color = CandyColor.AMBER)
                CandyButtonFill("MAYBE LATER", onClose, color = CandyColor.PEACH, size = CandySize.MEDIUM)
            }
        }
    }
}
