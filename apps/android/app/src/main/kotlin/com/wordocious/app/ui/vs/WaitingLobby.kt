package com.wordocious.app.ui.vs

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.BubbleText
import com.wordocious.app.ui.HeadlinePalette
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.PlayerAvatar
import com.wordocious.app.ui.tileClickable
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.WaitingKind
import com.wordocious.core.WaitingRoom
import kotlinx.coroutines.delay

// VS / pocket waiting rooms as a little lobby (FRIDAY-QUEUE item 22, 2.8 wave 3). The words and the clock math are
// core WaitingRoom (pinned by waiting-room-fixtures.json): ONE status line, a REAL counting timer (m:ss from a stored
// start time, ticking each second), the keepy-uppy tile line and the idle chirps. The scene is the shipped lobby art:
// the stage with your mascot center stage and the "?" seat medallion where your opponent will appear. Under it a
// little keepy-uppy tile mini-play: nothing saved, and it ends the moment this screen leaves (the match starts).

/**
 * The lobby scene + status + timer + keepy-uppy for one waiting [kind]. [startedAtMs] is the stored start time of the
 * wait (the timer counts from it), [name] the invited friend when known. Callers put their own buttons below
 * (Share / Copy code / Cancel) and anything special for their wait (the bot step-in card).
 */
@Composable
fun WaitingScene(kind: WaitingKind, name: String?, startedAtMs: Long, modifier: Modifier = Modifier) {
    val now by produceState(System.currentTimeMillis(), startedAtMs) {
        while (true) { delay(1_000); value = System.currentTimeMillis() }
    }
    val seconds = WaitingRoom.waitedSeconds(startedAtMs, now)
    val line = WaitingRoom.waitingStatusLine(kind, name)
    val bit = WaitingRoom.idleBit(seconds.toInt())
    val profile by AuthService.profile.collectAsState()

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // The stage: you on the podium, the "?" medallion opposite.
        Row(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "You, waiting. Your opponent has not joined yet." },
            horizontalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom,
        ) {
            Box(Modifier.size(width = 150.dp, height = 140.dp), contentAlignment = Alignment.BottomCenter) {
                Image(
                    painterResource(R.drawable.art_lobby_stage), null, contentScale = ContentScale.Fit,
                    modifier = Modifier.size(150.dp, 136.dp).clearAndSetSemantics { },
                )
                // Your mascot standing full-body on the stage (the living cutout, the podium's figure) when the player has one;
                // a photo player (or the living mascot off) keeps the framed tile. A guest gets the cast's waiting pose.
                val p = profile
                val stands = p != null && com.wordocious.app.ui.podiumStands(
                    p.username, p.id, p.avatarUrl, p.avatarConfig, p.avatarCastId, p.avatarFrame, p.accentColor,
                )
                Box(Modifier.offset(y = (-34).dp)) {
                    if (p != null) {
                        PlayerAvatar(
                            p.username ?: "You", if (stands) 112.dp else 84.dp, userId = p.id, avatarUrl = p.avatarUrl, config = p.avatarConfig,
                            castId = p.avatarCastId, frame = p.avatarFrame, accentHex = p.accentColor, contentDescription = null, live = true,
                            standing = true,
                        )
                    } else VsCastPose(MascotId.I, "waiting", 84.dp)
                }
            }
            // Where your opponent will appear: a quiet "?" medallion.
            Image(
                painterResource(R.drawable.art_lobby_seat_medallion), null, contentScale = ContentScale.Fit,
                modifier = Modifier.padding(bottom = 18.dp).size(84.dp).graphicsLayer { alpha = 0.92f }.clearAndSetSemantics { },
            )
        }
        // ONE status line in the bubble lettering. The atlas has no ellipsis, so the dots are dropped there (the live
        // timer and the "?" say it is still going); the spoken line keeps the real one.
        Box(Modifier.fillMaxWidth().semantics { contentDescription = line }) {
            BubbleText(
                line.removeSuffix("…").uppercase(), HeadlinePalette.VS, Modifier.fillMaxWidth().clearAndSetSemantics { },
                names = listOfNotNull(name?.trim()?.trimStart('@')?.takeIf { it.isNotEmpty() }),
                maxSize = 26, minSize = 16,
            )
        }
        // The timer, a real counting clock.
        VsNumber(WaitingRoom.waitClock(seconds), 24.sp, Modifier.semantics { contentDescription = "Waited " + WaitingRoom.waitClock(seconds) })
        // Your mascot's idle bits, never more than one per six seconds.
        Box(Modifier.height(16.dp)) {
            if (bit != null) {
                Text(
                    "Your mascot $bit", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center, maxLines = 1,
                )
            }
        }
        KeepyUppy()
    }
}

/**
 * The mindless thing to do while you wait: a tile you keep in the air. Each tap pops it up (240 ms up, 300 ms down,
 * transforms only); a tap before it lands adds one to the count; landing ends the run (best is kept for this visit
 * only, nothing is saved). It exists only while the waiting screen does.
 */
@Composable
fun KeepyUppy() {
    val y = remember { Animatable(0f) }
    var count by remember { mutableIntStateOf(0) }
    var best by remember { mutableIntStateOf(0) }
    var tapTick by remember { mutableIntStateOf(0) }
    LaunchedEffect(tapTick) {
        if (tapTick == 0) return@LaunchedEffect
        y.animateTo(-1f, tween(240, easing = FastOutSlowInEasing))
        y.animateTo(0f, tween(300, easing = FastOutLinearInEasing))
        // Landed with no tap to catch it: the run is over.
        if (count > best) best = count
        count = 0
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(width = 72.dp, height = 96.dp), contentAlignment = Alignment.BottomCenter) {
            Image(
                painterResource(R.drawable.art_pocket_tile_purple), null, contentScale = ContentScale.Fit,
                modifier = Modifier.size(56.dp)
                    .graphicsLayer { translationY = y.value * 34f * density }
                    .tileClickable(card = false, label = "Bounce the tile. ${WaitingRoom.keepyLine(count, best)}") {
                        count += 1
                        tapTick += 1
                    },
            )
        }
        Text(
            WaitingRoom.keepyLine(count, best), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub,
            textAlign = TextAlign.Center, maxLines = 1,
        )
    }
}

/**
 * The pocket-game wait (item 22): when it is their turn, a quiet strip above the board (the board stays visible) with
 * the "?" seat, ONE status line ("Waiting for Johnny…") in the bubble lettering, how long they have had it while that is
 * still a live number (under an hour), their [avatar], and a small "Bounce a tile" button that opens the keepy-uppy tile
 * (collapsed by default so the board keeps the room). [sinceMs] is when the move went to them (the game's last update).
 */
@Composable
fun PocketWaitStrip(name: String, sinceMs: Long?, avatar: @Composable () -> Unit, modifier: Modifier = Modifier) {
    val now by produceState(System.currentTimeMillis()) {
        while (true) { delay(1_000); value = System.currentTimeMillis() }
    }
    var play by remember { mutableStateOf(false) }
    val line = WaitingRoom.waitingStatusLine(WaitingKind.POCKET, name)
    val waited = if (sinceMs != null) WaitingRoom.waitedSeconds(sinceMs, now) else 0.0
    Column(
        modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = line },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            Image(
                painterResource(R.drawable.art_lobby_seat_medallion), null, contentScale = ContentScale.Fit,
                modifier = Modifier.size(34.dp).graphicsLayer { alpha = 0.9f }.clearAndSetSemantics { },
            )
            Box(Modifier.weight(1f, fill = false).widthIn(max = 240.dp)) {
                BubbleText(
                    line.removeSuffix("…").uppercase(), HeadlinePalette.FRIENDS, Modifier.fillMaxWidth().clearAndSetSemantics { },
                    names = listOf(name.trim().trimStart('@')).filter { it.isNotEmpty() }, maxSize = 22, minSize = 16,
                )
            }
            avatar()
        }
        if (sinceMs != null && waited < 3600) {
            Text(
                WaitingRoom.waitClock(waited), fontSize = 12.sp, fontWeight = FontWeight.Black, color = VsTeal.label,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
        if (play) KeepyUppy()
        else com.wordocious.app.ui.QuietButton("Bounce a tile while you wait", onClick = { play = true }, size = com.wordocious.app.ui.CandySize.SMALL)
    }
}
