package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FlagsService
import com.wordocious.app.data.TutorialsSeen
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.WhatsNew

/**
 * FRIDAY-QUEUE item 41 (Android): the one-time "What's new in 2.8" tour for players who update (never brand-new ones).
 * Six short pages, each a bubble-lettered title over a framed illustration (the art/driver tutorial frame,
 * `art_tut_frame`), two plain lines, page dots, Next, and Skip on every page but the last. Pages + the decision are
 * core [WhatsNew] (parity with core whats-new.ts); "seen" is the synced tutorials list ([TutorialsSeen], key
 * `whats-new-28`). Gate: the `whats_new_28` off-switch. Web: whats-new-tour.tsx · iOS: WhatsNewTour.swift.
 */
@Composable
fun WhatsNewHost(blocked: Boolean) {
    val profile by AuthService.profile.collectAsState()
    val seen by TutorialsSeen.seen.collectAsState()
    var open by remember { mutableStateOf(false) }
    var decided by remember { mutableStateOf(false) }
    val uid = profile?.id
    LaunchedEffect(uid) { TutorialsSeen.ensureLoaded() }
    LaunchedEffect(uid, seen, blocked) {
        if (decided || open) return@LaunchedEffect
        val p = profile
        val d = WhatsNew.decision(
            live = FlagsService.isLive(WhatsNew.FLAG), seen = seen, signedIn = p != null,
            hasOnboarded = p?.hasOnboarded, createdAt = p?.createdAt,
        )
        when (d) {
            WhatsNew.Decision.RECORD -> { decided = true; TutorialsSeen.mark(WhatsNew.KEY) }
            WhatsNew.Decision.SHOW -> {
                kotlinx.coroutines.delay(1400)
                if (!blocked) { decided = true; open = true }
            }
            WhatsNew.Decision.NONE -> decided = true
            WhatsNew.Decision.WAIT -> Unit
        }
    }
    if (open) WhatsNewTour(onClose = { TutorialsSeen.mark(WhatsNew.KEY); open = false })
}

private val TOUR_PALETTES = listOf(
    HeadlinePalette.LEADERBOARD, HeadlinePalette.HOME, HeadlinePalette.STATS, HeadlinePalette.FRIENDS, HeadlinePalette.VS, HeadlinePalette.LEADERBOARD,
)
private val TOUR_BAR = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))

@Composable
fun WhatsNewTour(onClose: () -> Unit) {
    val pages = remember { WhatsNew.pages("android") }
    var index by remember { mutableIntStateOf(0) }
    val page = pages[index.coerceIn(0, pages.size - 1)]
    val last = index >= pages.size - 1
    val ctx = LocalContext.current
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.widthIn(max = 380.dp).fillMaxWidth().padding(horizontal = 20.dp)
                .clip(RoundedCornerShape(28.dp)).background(if (WTheme.isDark) WTheme.surface else Color(0xFFFFFBF5))
                .semantics { paneTitle = "What's new in Wordocious 2.8" },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.fillMaxWidth().height(10.dp).background(TOUR_BAR))
            Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("NEW IN 2.8", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.6.sp, color = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK)
                BubbleText(page.title, TOUR_PALETTES[index % TOUR_PALETTES.size], Modifier.semantics { heading() }, maxSize = 28, minSize = 18)
                // the framed illustration (the art/driver tutorial frame behind it)
                Box(Modifier.size(width = 240.dp, height = 246.dp), contentAlignment = Alignment.Center) {
                    Image(painterResource(R.drawable.art_tut_frame), null, Modifier.size(width = 240.dp, height = 246.dp), contentScale = ContentScale.FillBounds)
                    when (val a = page.art) {
                        is WhatsNew.Art.Mascot -> StageOwnMascot(150.dp)
                        is WhatsNew.Art.Image -> {
                            val res = remember(a.name) { ctx.resources.getIdentifier(a.name.replace('-', '_'), "drawable", ctx.packageName) }
                            if (res != 0) Image(artPainter(res, 140.dp), null, Modifier.height(140.dp), contentScale = ContentScale.Fit)
                        }
                        is WhatsNew.Art.Icons -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            a.names.forEach { n ->
                                val res = remember(n) { ctx.resources.getIdentifier(n.replace('-', '_'), "drawable", ctx.packageName) }
                                val s = if (a.names.size == 1) 120.dp else 76.dp
                                if (res != 0) Image(artPainter(res, s), null, Modifier.size(s))
                            }
                        }
                    }
                }
                page.lines.forEach {
                    Text(it, fontFamily = Nunito, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = lbSubInk(), textAlign = TextAlign.Center, lineHeight = 20.sp)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.semantics { contentDescription = "Page ${index + 1} of ${pages.size}" }) {
                    pages.indices.forEach { i ->
                        Image(painterResource(if (i == index) R.drawable.art_tut_dot_on else R.drawable.art_tut_dot_off), null, Modifier.size(14.dp))
                    }
                }
                CandyButton(
                    text = if (last) "Let's go!" else "Next",
                    onClick = { if (last) onClose() else index += 1 },
                    color = CandyColor.PURPLE, size = CandySize.MEDIUM, icon = if (last) null else CandyIcon.ARROW,
                )
                if (!last) QuietButton("Skip", onClick = onClose, size = CandySize.SMALL)
            }
        }
    }
}
