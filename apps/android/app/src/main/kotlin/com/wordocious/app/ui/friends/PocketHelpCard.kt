package com.wordocious.app.ui.friends

import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.wordocious.app.R
import com.wordocious.app.data.TutorialsSeen
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.EdgeToEdgeDialogWindow
import com.wordocious.app.ui.PopupScrim
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.WideLayout
import com.wordocious.app.ui.artPainter
import com.wordocious.app.ui.game.firstPlayButtonLabel
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FriendlyKind
import com.wordocious.core.PocketHelp
import com.wordocious.core.PocketHelpPicture

// "?" -> HOW TO PLAY for every pocket game, and the first-play welcome (FRIDAY-QUEUE items 9c + 12, 2.8 wave 3).
// The words and the pictures come from core PocketHelp.POCKET_HELP (pinned by pocket-help-fixtures.json): three
// steps each with a tiny picture built from the shipped art_pocket_* pieces, the win line and the turns line.
// The same dialog shape as the other games' guide popup (GuideSheet): scrim, spring-in card, one candy button
// ("Let's play!" the first time, "Got it" after). Closing it marks the game's key seen (TutorialsSeen).

/** The art_pocket_* drawable for a core art name ("art-pocket-rps-rock"), by name; 0 = not in this build. */
fun pocketPieceRes(context: Context, name: String): Int =
    context.resources.getIdentifier(name.replace('-', '_'), "drawable", context.packageName)

@Composable
fun PocketHelpDialog(kind: FriendlyKind, onDismiss: () -> Unit) {
    val help = PocketHelp.POCKET_HELP.getValue(kind)
    val label = firstPlayButtonLabel(help.key)
    val close = { TutorialsSeen.mark(help.key); onDismiss() }
    Dialog(
        onDismissRequest = close,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        EdgeToEdgeDialogWindow(dimAmount = 0f)
        PopupScrim(onTap = close) {
            BoxWithConstraints(Modifier.fillMaxSize().systemBarsPadding()) {
                val viewport = maxHeight
                Column(
                    Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = viewport)
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                ) { PocketHelpBody(kind, label, close) }
            }
        }
    }
}

@Composable
private fun PocketHelpBody(kind: FriendlyKind, buttonLabel: String, onClose: () -> Unit) {
    val help = PocketHelp.POCKET_HELP.getValue(kind)
    val still = WTheme.reducedMotion
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    // The shared soft pop (smooth over pretty: a scale + fade only, <= 400 ms; Reduce Motion = a fade).
    val scale by animateFloatAsState(if (shown || still) 1f else 0.94f, tween(260), label = "pocketHelpScale")
    val alpha by animateFloatAsState(if (shown) 1f else 0f, tween(if (still) 120 else 220), label = "pocketHelpAlpha")
    val dark = WTheme.isDark
    val shape = RoundedCornerShape(28.dp)
    val accent = kind.color
    Box(
        Modifier.widthIn(max = WideLayout.POPUP_CARD_DP.dp).fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale; this.alpha = alpha; transformOrigin = TransformOrigin(0.5f, 1f) }
            .semantics { paneTitle = "How to play ${help.title}" }
            .pointerInput(Unit) { detectTapGestures { } },
    ) {
        Column(
            Modifier.fillMaxWidth()
                .shadow(22.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.45f), spotColor = accent.copy(alpha = 0.6f))
                .clip(shape)
                .background(Brush.verticalGradient(listOf(if (dark) Color(0xFF2A1D4A) else Color(0xFFFFF8EC), if (dark) Color(0xFF21163C) else Color(0xFFF6F0FF)))),
        ) {
            Box(Modifier.fillMaxWidth().height(10.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
            Column(
                Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FriendlyGameIcon(kind, 40.dp)
                    Text(
                        help.title.uppercase(), fontSize = 24.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
                        textAlign = TextAlign.Center, maxLines = 1,
                        modifier = Modifier.semantics { heading() },
                        style = TextStyle(fontFamily = Nunito, brush = Brush.horizontalGradient(kind.gradient)),
                    )
                }
                Text(
                    "HOW TO PLAY", fontFamily = Nunito, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em,
                    color = if (dark) WTheme.textMuted else FriendsPink.labelInk,
                )
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    help.steps.forEachIndexed { i, step ->
                        Row(
                            Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "Step ${i + 1}: ${step.text}" },
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            // The step number on the shipped gold coin.
                            Box(Modifier.size(30.dp).clearAndSetSemantics { }, Alignment.Center) {
                                Image(painterResource(R.drawable.art_tut_step_badge), null, contentScale = ContentScale.Fit, modifier = Modifier.size(30.dp))
                                SoftNumber("${i + 1}", 14.sp, color = Color.White)
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    step.text, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 19.sp,
                                    color = if (dark) WTheme.text else FriendsPink.heading,
                                )
                                PocketPicture(step.picture)
                            }
                        }
                    }
                }
                // The win line, then how turns work with a friend (the same promise on every game).
                Text(
                    help.win, fontSize = 14.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                    color = if (dark) WTheme.text else FriendsPink.heading, modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
                )
                Text(
                    help.turns, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, lineHeight = 16.sp,
                    color = if (dark) WTheme.textMuted else FriendsPink.muted, modifier = Modifier.fillMaxWidth(),
                )
                CandyButton(
                    buttonLabel, onClick = onClose, color = CandyColor.PURPLE, size = CandySize.LARGE, fill = true,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** A step's tiny picture: the art pieces left to right, with a short word between pieces when the step has joiners. */
@Composable
private fun PocketPicture(p: PocketHelpPicture, piece: Dp = 44.dp) {
    val context = LocalContext.current
    val big = p.art.size == 1
    Row(
        Modifier.clearAndSetSemantics { },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        p.art.forEachIndexed { i, name ->
            val res = remember(name) { pocketPieceRes(context, name) }
            if (res != 0) Image(artPainter(res, piece * (if (big) 1.5f else 1f)), null, contentScale = ContentScale.Fit, modifier = Modifier.size(if (big) piece * 1.5f else piece))
            p.joiners.getOrNull(i)?.let {
                Text(it, fontSize = 11.sp, fontWeight = FontWeight.Black, color = FriendsPink.muted, maxLines = 1)
            }
        }
    }
}
