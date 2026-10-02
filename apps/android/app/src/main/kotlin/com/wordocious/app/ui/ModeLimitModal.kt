package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.draw.drawBehind
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.em
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.theme.WTheme

/**
 * Daily-limit modal — ports the web ModeLimitModal. Shown when a FREE user taps
 * a mode they've already played today: "{mode} — Played Today", upsell copy, a live
 * "play again tomorrow" countdown, the Unlimited offer, and an optional "View Solved
 * Puzzle" button.
 *
 * FINISH_SPEC R3 (founder 10-02): the limit screen speaks the Unlimited card's
 * language — U with her loop of candy tiles, a peach "KEEP PLAYING · Unlimited
 * <mode> · Fresh puzzles, no waiting" card with the gold PRO pill and a peach "Play"
 * candy (Y: no infinity glyph), candy buttons, no white. Its tap opens the redesigned Go Pro paywall (guests sign in there first).
 * With [onPlayUnlimited] the paywall opens in place and a successful purchase starts
 * the Unlimited game directly; without it the old route ([onGoPro]) is used.
 */
@Composable
fun ModeLimitModal(
    modeName: String,
    onClose: () -> Unit,
    onGoPro: () -> Unit,
    onViewPuzzle: (() -> Unit)? = null,
    onPlayUnlimited: (() -> Unit)? = null,
) {
    val secs by produceState(initialValue = secondsUntilLocalMidnightLimit()) {
        while (true) { value = secondsUntilLocalMidnightLimit(); kotlinx.coroutines.delay(1000) }
    }
    val countdown = "%02d:%02d:%02d".format(secs / 3600, (secs % 3600) / 60, secs % 60)
    var paywall by remember { mutableStateOf(false) }
    val goUnlimited = {
        if (onPlayUnlimited != null) paywall = true else { onClose(); onGoPro() }
    }
    if (paywall && onPlayUnlimited != null) {
        com.wordocious.app.ui.game.ProPaywallDialog(
            onDismiss = { paywall = false },
            onPro = { paywall = false; onClose(); onPlayUnlimited() },
        )
    }

    // FINISH_SPEC G5 + R3: a lavender popup card with the purple → pink top bar, U's
    // loop art (A7: not the Home host W), the countdown as a soft number in a tinted
    // pill, the peach Unlimited card and candy buttons.
    val purple = Color(0xFF7C3AED)
    val peach = com.wordocious.app.ui.game.UNLIMITED_PEACH
    val shape = RoundedCornerShape(24.dp)
    val dark = WTheme.isDark
    PopupScrim(onTap = onClose, modifier = Modifier.padding(0.dp)) {
        Box(
            Modifier.padding(24.dp).widthIn(max = 360.dp).fillMaxWidth()
                .shadow(20.dp, shape, ambientColor = Color(0x59280F50), spotColor = Color(0x59280F50))
                .clip(shape)
                .background(accentWash(purple, 0.09f))
                .border(1.5.dp, accentLine(purple, 0.26f), shape)
                .clickableNoRipple {},
        ) {
            Column(Modifier.fillMaxWidth()) {
                Box(Modifier.fillMaxWidth().height(10.dp).background(Brush.horizontalGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899)))))
                Column(
                    Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // R3: U floating with her loop of candy tiles (slow wobble, still with Reduce Motion).
                    com.wordocious.app.ui.game.UnlimitedLoopArt(128.dp)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "$modeName — Played Today", fontSize = 19.sp, fontWeight = FontWeight.Black,
                        color = if (dark) WTheme.text else FinishInk.heading, textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { heading() },
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "You've used your free play of $modeName for today. Upgrade to Pro for unlimited replays and ad-free gameplay across every mode.",
                        fontSize = 13.sp, fontWeight = FontWeight.Bold,
                        color = if (dark) WTheme.textSecondary else FinishInk.muted, textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                    // A2: the countdown as a soft number in a tinted pill.
                    Column(
                        Modifier.tintedPill(purple, 14.dp).padding(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 8.dp)
                            .semantics(mergeDescendants = true) { },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            "PLAY AGAIN TOMORROW IN", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.1.em,
                            color = if (dark) WTheme.textSecondary else FinishInk.label,
                        )
                        SoftNumber(countdown, 24.sp)
                    }
                    Spacer(Modifier.height(14.dp))
                    // R3 the peach Unlimited card: the whole card opens the Go Pro paywall.
                    Row(
                        Modifier.fillMaxWidth()
                            .squishClickable("Keep playing: Unlimited $modeName, a Pro feature") { goUnlimited() }
                            .clip(RoundedCornerShape(18.dp))
                            .background(accentWash(peach, 0.14f))
                            .drawBehind { drawRect(peach, androidx.compose.ui.geometry.Offset.Zero, androidx.compose.ui.geometry.Size(size.width, 4.dp.toPx())) }
                            .border(1.5.dp, accentLine(peach, 0.34f), RoundedCornerShape(18.dp))
                            .padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    "KEEP PLAYING", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                                    color = if (dark) Color(0xFFFDBA74) else darkenInk(peach),
                                )
                                com.wordocious.app.ui.game.ProPill()
                            }
                            Text(
                                "Unlimited $modeName", fontSize = 14.sp, fontWeight = FontWeight.Black,
                                color = if (dark) WTheme.text else FinishInk.heading, maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            )
                            Text(
                                "Fresh puzzles, no waiting", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                color = if (dark) WTheme.textMuted else FinishInk.muted, maxLines = 1,
                            )
                        }
                        // FINISH_SPEC Y: the card's action just reads "Play" (no infinity glyph).
                        CandyButton(
                            "Play", onClick = goUnlimited,
                            color = CandyColor.PEACH, size = CandySize.SMALL,
                            contentDescription = "Play Unlimited $modeName, a Pro feature",
                        )
                    }
                    Spacer(Modifier.height(14.dp))
                    // A8: the large amber candy CTA (the Go Pro paywall).
                    CandyButton(
                        "Upgrade to Pro", onClick = goUnlimited,
                        color = CandyColor.AMBER, size = CandySize.LARGE, fill = true,
                        leading = { Icon3D(Icon3DName.CROWN, 22.dp) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    if (onViewPuzzle != null) {
                        CandyButton(
                            "View Solved Puzzle", onClick = { onClose(); onViewPuzzle() },
                            color = CandyColor.PURPLE, size = CandySize.MEDIUM, icon = CandyIcon.EYE,
                        )
                    } else {
                        CandyButton("Come back tomorrow", onClick = onClose, color = CandyColor.PEACH, size = CandySize.MEDIUM)
                    }
                }
            }
            PopupClose(onClose, Modifier.align(Alignment.TopEnd).padding(top = 8.dp), tint = if (dark) WTheme.text else FinishInk.label)
        }
    }
}

private fun secondsUntilLocalMidnightLimit(): Long {
    val cal = java.util.Calendar.getInstance()
    val now = cal.timeInMillis
    cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
    cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0)
    cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
    return ((cal.timeInMillis - now) / 1000).coerceAtLeast(0)
}
