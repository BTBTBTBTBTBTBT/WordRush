package com.wordocious.app.ui.friends

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.rememberUpdatedState
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendlyGamesService
import com.wordocious.app.data.FriendlyLiveChannel
import com.wordocious.core.FriendlyLive
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.pageBackground
import com.wordocious.app.ui.game.CornerHelpButton
import com.wordocious.app.ui.game.GAME_CONTROLS_INSET
import com.wordocious.app.ui.game.rememberFirstPlayAutoShow
import com.wordocious.core.PocketHelp
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import com.wordocious.app.ui.game.GameTray
import com.wordocious.app.ui.game.TrayState
import com.wordocious.app.ui.game.TileMotion
import com.wordocious.app.R
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.dashedBorder
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.CHAIN_TARGET
import com.wordocious.core.ChainState
import com.wordocious.core.CoinFace
import com.wordocious.core.CoinState
import com.wordocious.core.FriendlyKind
import com.wordocious.core.FriendlyMove
import com.wordocious.core.GhostReason
import com.wordocious.core.GhostState
import com.wordocious.core.MoveResult
import com.wordocious.core.PASS_MAX_GUESSES
import com.wordocious.core.PassState
import com.wordocious.core.RpsPick
import com.wordocious.core.RpsState
import com.wordocious.core.Side
import com.wordocious.core.TileState
import com.wordocious.core.TttState
import com.wordocious.core.WORD_MAX
import com.wordocious.core.WORD_MIN
import com.wordocious.core.applyFriendlyMove
import com.wordocious.core.friendlyHeadline
import com.wordocious.core.scoreOf
import com.wordocious.core.tttLine
import com.wordocious.core.whoseTurn
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val YOU_TINT = Color(0xFFEDE9FE)
private val THEM_TINT = Color(0xFFFEF3C7)
private val YOU_WON = Color(0xFFDDD6FE)
private val THEM_WON = Color(0xFFFDE68A)
private val DEEP = Color(0xFF4C1D95)
/** A1 the leave dialog's soft pink wash. */
private val DIALOG_TINT = Color(0xFFFFF3F9)

/** One live reaction floating up from the board (9b). [x] is -0.35..0.35 of the board width off center. */
private data class LiveFloater(val id: Long, val key: String, val x: Float)

@Composable
private fun LiveFloat(f: LiveFloater, onDone: () -> Unit) {
    val t = remember { Animatable(0f) }
    LaunchedEffect(f.id) {
        t.animateTo(1f, tween(FriendlyLive.REACT_LIFETIME_MS.toInt(), easing = FastOutSlowInEasing))
        onDone()
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val dx = maxWidth * f.x
        Box(
            Modifier.align(Alignment.BottomCenter)
                .offset(x = dx, y = (-130).dp * t.value)
                .graphicsLayer { alpha = 1f - t.value; val sc = 0.6f + 0.4f * minOf(1f, t.value * 6f); scaleX = sc; scaleY = sc },
        ) { com.wordocious.app.ui.ReactionGlyph(f.key, 34.dp, FriendsPink.solid) }
    }
}

/**
 * A pocket game's screen (Friends overhaul §4, board AE): close + the game's
 * gradient title, the split score window (YOU | @THEM, frosted headline strip
 * from core friendlyHeadline), then the board for Rock Paper Scissors,
 * Tic-Tac-Tile, Call It, Pass the Puzzle, Ghost or Word Chain (§9). Polls the game every 2 s while on
 * screen (which also tells the server you are watching), handles 400 errors
 * inline and 409 retries by refetching. Over: REMATCH and FRIENDS; RESIGN
 * lives in the close confirm while the game is active.
 */
@Composable
fun FriendlyGameScreen(
    gameId: String,
    onClose: () -> Unit,
    onFriends: () -> Unit,
    onOpenGame: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val view = androidx.compose.ui.platform.LocalView.current
    // 9b live play (FlagsService live_play; off = today's 2 s poll, no optimistic moves, no presence).
    val flags by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val liveOn = com.wordocious.app.data.FlagsService.isLive(FriendlyLive.SWITCH_KEY, flags)
    val liveOnNow by rememberUpdatedState(liveOn)
    // The confirmed game plus my in-flight prediction (core FriendlyLive.Snapshot); `game` is what it displays.
    var snap by remember(gameId) {
        mutableStateOf(
            FriendlyLive.Snapshot(
                FriendlyGamesService.active.value.firstOrNull { it.id == gameId }
                    ?: FriendlyGamesService.recent.value.firstOrNull { it.id == gameId },
            ),
        )
    }
    val game: FriendlyGamesService.GameView? = snap.displayed { v, s, mine -> v.copy(state = s, yourTurn = mine) }
    var busy by remember(gameId) { mutableStateOf(false) }
    var error by remember(gameId) { mutableStateOf<String?>(null) }
    var notFound by remember(gameId) { mutableStateOf(false) }
    var confirmClose by remember { mutableStateOf(false) }
    // 9c / 12: the "?" How to Play card, and its first-play auto-show (once per pocket game, synced).
    var showHelp by remember { mutableStateOf(false) }
    var arriveTick by remember(gameId) { mutableIntStateOf(0) }
    var pulseTick by remember(gameId) { mutableIntStateOf(0) }
    var shakeTick by remember(gameId) { mutableIntStateOf(0) }
    val floaters = remember(gameId) { mutableStateListOf<LiveFloater>() }
    val live = remember(gameId) { FriendlyLiveChannel(scope) }
    val socketUp by live.socketUp.collectAsState()
    val peerPresent by live.peerPresent.collectAsState()
    val peerEverSeen by live.peerEverSeen.collectAsState()
    DisposableEffect(gameId) { onDispose { live.stop() } }

    fun addFloater(key: String) {
        floaters.add(LiveFloater(System.nanoTime(), key, (Math.random() * 0.7 - 0.35).toFloat()))
        while (floaters.size > 6) floaters.removeAt(0)
    }

    /**
     * Take a fresh game (poll, broadcast, backup refetch) only if it is strictly newer than the one on
     * screen. [own] = the reply to MY move, which replaces my prediction.
     */
    fun accept(g: FriendlyGamesService.GameView, own: Boolean = false) {
        if (g.id != gameId) return
        if (own) { snap = snap.confirmMove(g); return }
        val r = snap.receive(g)
        if (!r.applied) return
        snap = r.snap
        // A change that lands while my own move is in flight is my move, not the friend's.
        if (liveOnNow && !busy) {
            if (r.change.moved && g.active) {
                com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.KEY, view)
                arriveTick++
            }
            if (r.change.yourTurnStarted) {
                pulseTick++
                scope.launch { delay(140); com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.NOTIFY, view) }
            }
        }
    }

    // Open the game's Realtime channel once the opponent is known (live_play on, game still going).
    val oppId = game?.opponent?.id
    val gameActive = game?.active == true
    LaunchedEffect(liveOn, oppId, gameActive) {
        val uid = AuthService.userId
        if (liveOn && gameActive && oppId != null && !oppId.isEmpty() && uid != null) {
            live.onView = { accept(it) }
            live.onRefetch = { scope.launch { FriendlyGamesService.get(gameId)?.let { accept(it) } } }
            live.onReaction = { addFloater(it) }
            if (!live.isStarted) live.start(gameId, uid, oppId)
        } else live.stop()
    }

    // Poll while the screen is on and the app is in the foreground: live play on + socket up = a slow
    // keep-alive (it also stamps "watching" and repairs a missed broadcast); socket down = 4 s fallback;
    // switch off = today's 2 s.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(gameId) {
        var misses = 0
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                val g = FriendlyGamesService.get(gameId)
                if (g != null) { accept(g); misses = 0; notFound = false }
                else if (snap.confirmed == null && ++misses >= 3) notFound = true
                var waited = 0L
                while (waited < FriendlyLive.pollIntervalMs(liveOnNow, live.socketUp.value)) { delay(250); waited += 250 }
            }
        }
    }

    fun send(move: FriendlyMove) {
        if (busy) return
        busy = true
        error = null
        // Optimistic: my piece / pick / word lands at once with its sound; the server can still say no.
        var optimistic = false
        if (liveOn) {
            val (next, attached) = snap.beginMove(move)
            if (attached) {
                snap = next
                optimistic = true
                com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.KEY, view)
            }
        }
        val wasOptimistic = optimistic
        fun rollBack() {
            val (next, rolled) = snap.rejectMove()
            snap = next
            if (rolled) {
                shakeTick++
                com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.INVALID, view)
            }
        }
        scope.launch {
            val r = if (wasOptimistic)
                kotlinx.coroutines.withTimeoutOrNull(FriendlyLive.OPTIMISTIC_TIMEOUT_MS) { FriendlyGamesService.move(gameId, move) }
                    ?: FriendlyGamesService.MoveOutcome.Failed("Network error. Try again.")
            else FriendlyGamesService.move(gameId, move)
            if (wasOptimistic && r !is FriendlyGamesService.MoveOutcome.Moved) rollBack()
            when (r) {
                is FriendlyGamesService.MoveOutcome.Moved -> accept(r.game, own = true)
                is FriendlyGamesService.MoveOutcome.Rejected -> error = r.message
                is FriendlyGamesService.MoveOutcome.Retry -> {
                    error = r.message
                    FriendlyGamesService.get(gameId)?.let { accept(it) }
                }
                is FriendlyGamesService.MoveOutcome.Failed -> error = r.message
            }
            busy = false
        }
    }

    fun rematch() {
        val g = game ?: return
        if (busy) return
        busy = true
        error = null
        scope.launch {
            val stake = (g.state as? CoinState)?.stake
            when (val r = FriendlyGamesService.start(g.kind, g.opponent.id, stake)) {
                is FriendlyGamesService.StartOutcome.Started -> onOpenGame(r.game.id)
                is FriendlyGamesService.StartOutcome.Failed -> error = r.message
            }
            busy = false
        }
    }

    val requestClose = { if (game?.active == true) confirmClose = true else onClose() }
    androidx.activity.compose.BackHandler { requestClose() }

    val kind = game?.kind ?: FriendlyKind.RPS
    val firstPlay = rememberFirstPlayAutoShow(PocketHelp.pocketTutorialKey(kind)) && game != null
    LaunchedEffect(firstPlay) { if (firstPlay) showHelp = true }
    // A1: the Friends wallpaper (fixed light), never a flat white page.
    Column(Modifier.fillMaxSize().pageBackground(com.wordocious.app.ui.PageTint.FRIENDS, alwaysLight = true)) {
        // Top bar: close (pink) + centered title in the game's gradient.
        Box(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
            // The shared white close circle (HEADER_SPEC §4).
            com.wordocious.app.ui.HeaderBackButton({ requestClose() }, Modifier.align(Alignment.CenterStart), close = true)
            Text(
                (game?.title ?: kind.title).uppercase(), fontSize = 19.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, maxLines = 1,
                style = TextStyle(brush = Brush.horizontalGradient(kind.gradient), fontFamily = Nunito),
                modifier = Modifier.align(Alignment.Center).padding(horizontal = 92.dp),
            )
            // 9c: the same "?" the other games wear in the top-right corner.
            CornerHelpButton(kind.color, onClick = { showHelp = true }, modifier = Modifier.align(Alignment.CenterEnd))
        }
        val g = game
        if (g == null) {
            Box(Modifier.fillMaxSize(), Alignment.Center) {
                if (notFound) {
                    // A missing game gets O3's not-found scene (ART_SPEC §7) + BI24 headline.
                    com.wordocious.app.ui.BrandEmptyState(
                        title = "GAME NOT FOUND",
                        heading = com.wordocious.app.ui.Heading.NOTFOUND,   // BJ16
                        line = "This game isn't available anymore.",
                        scene = com.wordocious.app.ui.SceneArt.NOT_FOUND,
                        accent = com.wordocious.app.ui.PageAccent.friends,
                        lineColor = FriendsPink.sub,
                        secondary = { PinkPill("FRIENDS", solid = false, onClick = onFriends) },
                    )
                } else com.wordocious.app.ui.CastLoader(null)
            }
            return@Column
        }
        val them = g.opponent.username
        val theyOn = FriendsService.friends.firstOrNull { it.id == g.opponent.id }?.isOnline() == true
        val myTurn = g.active && whoseTurn(g.state)?.includes(g.me) == true
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // 9b presence: the friend's mascot is "here now" (alive ring) while they are in the channel,
            // "thinking…" on their turn, "left the game" when they go. Off / socket down = the old online dot.
            val presence = if (liveOn && socketUp && g.active)
                FriendlyLive.presenceLabel(peerPresent, peerEverSeen, theirTurn = whoseTurn(g.state)?.includes(g.me.other) == true && !myTurn)
            else null
            ScoreWindow(g, if (presence != null) peerPresent else theyOn, presence)
            // 9d: the YOUR TURN flag (shipped art) when the move is yours.
            if (g.active && myTurn) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                    Image(painterResource(R.drawable.art_pocket_yourturn_flag), null, contentScale = ContentScale.Fit, modifier = Modifier.size(26.dp).clearAndSetSemantics { })
                    Text("YOUR TURN", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = FriendsPink.solid)
                }
            }
            // L: every pocket board sits in the shared game tray in the game's color (won = purple, lost = slate).
            val tray = when (g.result) { "win" -> TrayState.WON; "loss" -> TrayState.LOST; else -> TrayState.PLAYING }
            val reduce = WTheme.reducedMotion
            val boardScale = remember { Animatable(1f) }
            val shakeX = remember { Animatable(0f) }
            val ring = remember { Animatable(0f) }
            LaunchedEffect(arriveTick) {
                if (arriveTick > 0 && !reduce) { boardScale.animateTo(1.014f, tween(130)); boardScale.animateTo(1f, tween(130)) }
            }
            LaunchedEffect(shakeTick) {
                if (shakeTick > 0 && !reduce) { for (x in listOf(-6f, 5f, -3f, 0f)) shakeX.animateTo(x, tween(70)) }
            }
            LaunchedEffect(pulseTick) {
                if (pulseTick > 0 && !reduce) { ring.animateTo(1f, tween(450)); ring.animateTo(0f, tween(500)) }
            }
            Box(
                Modifier.fillMaxWidth().graphicsLayer {
                    scaleX = boardScale.value; scaleY = boardScale.value; translationX = shakeX.value * density
                },
            ) {
                GameTray(g.kind.color, Modifier.fillMaxWidth(), state = tray) {
                    when (val s = g.state) {
                        is RpsState -> RpsBoard(s, g.me, them, enabled = myTurn && !busy) { send(FriendlyMove.Rps(it)) }
                        is TttState -> TttBoard(s, g.me, them, myTurn = myTurn && !busy) { send(FriendlyMove.Ttt(it)) }
                        is CoinState -> CoinBoard(gameId, s, g.me, them, myTurn = myTurn && !busy) { send(FriendlyMove.Coin(it)) }
                        is PassState -> PassBoard(gameId, s, g.me, g.opponent, myTurn = myTurn, busy = busy, answer = g.answer) { send(FriendlyMove.Pass(it)) }
                        is GhostState -> GhostBoard(s, g.me, them, myTurn = myTurn, busy = busy) { send(FriendlyMove.Ghost(it.toString())) }
                        is ChainState -> ChainBoard(gameId, s, g.me, them, myTurn = myTurn, busy = busy, onError = { error = it }) { send(FriendlyMove.Chain(it)) }
                    }
                }
                // Your-turn pulse: a soft ring that breathes once when the move comes back to you.
                if (ring.value > 0f) {
                    Box(Modifier.matchParentSize().alpha(ring.value).border(2.5.dp, g.kind.color.copy(alpha = 0.55f), RoundedCornerShape(20.dp)))
                }
                // Live reactions float up from the bottom of the board.
                Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(0.dp)) {
                    floaters.forEach { f -> key(f.id) { LiveFloat(f, onDone = { floaters.remove(f) }) } }
                }
            }
            if (g.active && liveOn && socketUp) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                    FriendlyLive.REACTIONS.forEach { key ->
                        com.wordocious.app.ui.RoundIconButton(
                            onClick = {
                                if (live.sendReaction(key)) {
                                    addFloater(key)
                                    com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.KEY, view)
                                }
                            },
                            contentDescription = "Send ${com.wordocious.app.ui.ReactionArt.word(key)}",
                        ) { com.wordocious.app.ui.ReactionGlyph(key, 30.dp, FriendsPink.solid) }
                    }
                }
            }
            error?.let {
                Text(it, fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.solid, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            if (!g.active) {
                PinkButton("REMATCH", modifier = Modifier.fillMaxWidth(), enabled = !busy) { rematch() }
                PinkButton("FRIENDS", modifier = Modifier.fillMaxWidth(), solid = false, onClick = onFriends)
            }
            Spacer(Modifier.height(28.dp))
        }
    }

    if (showHelp) PocketHelpDialog(kind, onDismiss = { showHelp = false })

    if (confirmClose) {
        // 9: ONE themed button. The game waits; Resign now lives in the Friends tab's ⋯ menu.
        AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { confirmClose = false },
            containerColor = DIALOG_TINT,
            title = null,
            text = {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    FriendlyGameIcon(kind, 56.dp)
                    Text(
                        "Your game waits for you", fontSize = 18.sp, fontWeight = FontWeight.Black, color = FriendsPink.heading,
                        textAlign = TextAlign.Center, fontFamily = Nunito,
                    )
                    Spacer(Modifier.height(2.dp))
                    com.wordocious.app.ui.CandyButton(
                        "Back to Friends", onClick = { confirmClose = false; onClose() },
                        color = com.wordocious.app.ui.CandyColor.PURPLE, size = com.wordocious.app.ui.CandySize.LARGE,
                        modifier = Modifier.fillMaxWidth(), fill = true,
                    )
                }
            },
            confirmButton = {},
        )
    }
}

/** The headline: core words, or the resign / expiry ending (web screenHeadline). */
private fun headlineFor(g: FriendlyGamesService.GameView): String = when (g.status) {
    "resigned" -> if (g.result == "win") "THEY RESIGNED" else "YOU RESIGNED"
    "expired" -> "GAME EXPIRED"
    else -> friendlyHeadline(g.state, g.me)
}

/** The sub line: best-of, live while they're on, last round's result (web gameSubLine). */
private fun subLineFor(g: FriendlyGamesService.GameView, theyOn: Boolean): String {
    val me = g.me
    val them = g.opponent.username.uppercase()
    val parts = mutableListOf<String>()
    when (val s = g.state) {
        is RpsState -> {
            parts += "BEST OF 3"
            s.rounds.lastOrNull()?.let { r ->
                val n = s.rounds.size
                parts += if (r.winner == null) "ROUND $n TIED" else "${if (r.winner == me) "YOU" else them} TOOK ROUND $n"
            }
        }
        is TttState -> {
            parts += "BEST OF 3"
            if (s.games.isNotEmpty()) {
                val n = s.games.size
                val w = s.games.last()
                parts += if (w == null) "GAME $n DRAWN" else "${if (w == me) "YOU" else them} TOOK GAME $n"
            }
        }
        is CoinState -> {
            parts += "BEST OF 5"
            s.rounds.lastOrNull()?.let { r -> parts += "${r.flip.raw.uppercase()} · ${if (r.winner == me) "YOU" else them} WON IT" }
        }
        is PassState -> parts += "ONE BOARD, TAKE TURNS"
        is GhostState -> {
            parts += "BEST OF 3"
            s.rounds.lastOrNull()?.let { r -> parts += "${if (r.loser == me) them else "YOU"} TOOK ROUND ${s.rounds.size}" }
        }
        is ChainState -> {
            parts += "FIRST TO $CHAIN_TARGET"
            s.words.lastOrNull()?.let { w -> parts += "${if (w.by == me) "YOU" else them} PLAYED ${w.word} +${w.points}" }
        }
    }
    if (theyOn && whoseTurn(g.state) != null) parts.add(1, "LIVE, $them IS ON")
    return parts.joinToString(" · ")
}

@Composable
private fun ScoreWindow(g: FriendlyGamesService.GameView, theyOn: Boolean, presence: FriendlyLive.PresenceLabel? = null) {
    val won = g.result == "win"
    val lost = g.result == "loss"
    val leftBg = if (won) YOU_WON else YOU_TINT
    val rightBg = if (lost) THEM_WON else THEM_TINT
    val line = friendsLine(g.kind.color)
    val score = scoreOf(g.state)
    val me = AuthService.profile.value
    // The result's host (MASCOT_SPEC §3): O3, the prankster, pops on a win; R on a loss.
    val host = if (won) com.wordocious.app.ui.Mascots.pocketWin else if (lost) com.wordocious.app.ui.Mascots.loss else null
    Box(Modifier.fillMaxWidth().padding(top = if (host != null) com.wordocious.app.ui.BANNER_HOST_PEEK else 0.dp)) {
        Column(
            Modifier.fillMaxWidth()
                .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
                .clip(RoundedCornerShape(16.dp))
                .drawBehind {
                    drawRect(leftBg, size = Size(size.width / 2f, size.height))
                    drawRect(rightBg, topLeft = Offset(size.width / 2f, 0f), size = Size(size.width / 2f, size.height))
                    drawRect(Brush.linearGradient(
                        0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                        start = Offset.Zero, end = Offset(size.width, size.height),
                    ))
                }
                .then(if (won && !WTheme.reducedMotion) Modifier.bannerShimmer() else Modifier)
                .border(1.5.dp, line, RoundedCornerShape(16.dp)),
        ) {
            // A1: the game's color as the top bar; the headline strip in its wash (no white frost).
            Box(Modifier.fillMaxWidth().height(8.dp).background(g.kind.color))
            Column(
                Modifier.fillMaxWidth().background(friendsWash(g.kind.color, 0.10f)).padding(start = 12.dp, top = 10.dp, end = 10.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(Modifier.padding(end = if (host != null) com.wordocious.app.ui.BANNER_HOST_CLEAR else 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FriendlyGameIcon(g.kind, 24.dp)
                    Text(headlineFor(g), fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, lineHeight = 1.2.em, color = DEEP, maxLines = 2)
                }
                Text(subLineFor(g, theyOn), fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = FriendsPink.mid)
            }
            val turn = if (g.active) whoseTurn(g.state) else null
            Row(Modifier.fillMaxWidth().padding(vertical = 14.dp)) {
                ScoreSide("YOU", me?.username ?: "You", me?.avatarUrl, me?.avatarEmoji, false, score?.get(g.me), turn?.includes(g.me) == true, Modifier.weight(1f), accentHex = me?.accentColor)
                // 9b presence: THINKING… / HERE NOW / LEFT THE GAME takes the TO PLAY marker's slot.
                val theirToPlay = turn?.includes(g.me.other) == true
                val chip: Pair<String, Color>? = when (presence) {
                    FriendlyLive.PresenceLabel.THINKING -> FriendlyLive.presenceCopy(presence) to Color(0xFFD97706)
                    FriendlyLive.PresenceLabel.HERE -> if (theirToPlay) null else FriendlyLive.presenceCopy(presence) to Color(0xFF16A34A)
                    FriendlyLive.PresenceLabel.LEFT -> FriendlyLive.presenceCopy(presence) to Color(0xFF94A3B8)
                    else -> null
                }
                ScoreSide("@${g.opponent.username.uppercase()}", g.opponent.username, g.opponent.avatarUrl, g.opponent.avatarEmoji, theyOn, score?.get(g.me.other), theirToPlay, Modifier.weight(1f), chip = chip)
            }
        }
        if (host != null) com.wordocious.app.ui.Mascot(
            host, 56.dp,
            Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = -com.wordocious.app.ui.BANNER_HOST_PEEK),
            motion = if (won) com.wordocious.app.ui.MascotMotion.POP else com.wordocious.app.ui.MascotMotion.NONE,
        )
    }
}

@Composable
private fun ScoreSide(label: String, name: String, url: String?, emoji: String?, online: Boolean, score: Int?, toPlay: Boolean, modifier: Modifier, accentHex: String? = null, chip: Pair<String, Color>? = null) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        // The half whose turn it is wears a small TO PLAY marker (an invisible one keeps both halves level);
        // live play swaps in the friend's presence (THINKING… / HERE NOW / LEFT THE GAME) in the same slot.
        Text(
            chip?.first ?: "TO PLAY", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = Color.White, maxLines = 1,
            modifier = Modifier.alpha(if (toPlay || chip != null) 1f else 0f).clip(RoundedCornerShape(50)).background(chip?.second ?: FriendsPink.solid)
                .padding(horizontal = 7.dp, vertical = 2.dp),
        )
        FriendFace(name, url, emoji, 44.dp, online = online, accentHex = accentHex)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = DEEP, maxLines = 1, overflow = TextOverflow.Ellipsis)
        // A2: the score as a soft number.
        if (score != null) com.wordocious.app.ui.SoftNumber("$score", 30.sp, color = com.wordocious.app.ui.vs.VsInk.softNumber)
    }
}

// ── Rock Paper Scissors ─────────────────────────────────────────────────────

@Composable
private fun RpsBoard(s: RpsState, me: Side, them: String, enabled: Boolean, onPick: (RpsPick) -> Unit) {
    val theirs = s.picks[me.other]
    val mine = s.picks[me]
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        // Their pick, face down: the shipped fist with the "?" (dimmed until they have picked).
        Image(
            painterResource(R.drawable.art_pocket_rps_hidden), null, contentScale = ContentScale.Fit,
            modifier = Modifier.size(104.dp, 118.dp).alpha(if (theirs == RpsPick.HIDDEN) 1f else 0.45f).clearAndSetSemantics { },
        )
        if (theirs == RpsPick.HIDDEN) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, 14.dp)
                Text("${them.uppercase()} PICKED", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.green)
            }
        } else {
            Text("${them.uppercase()} HASN'T PICKED", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.label)
        }

        // The last round, revealed: both picks with the winner glowing.
        s.rounds.lastOrNull()?.let { r ->
            val pop = remember(s.rounds.size) { Animatable(0.7f) }
            LaunchedEffect(s.rounds.size) { pop.animateTo(1f, tween(380, easing = FastOutSlowInEasing)) }
            Column(
                Modifier.fillMaxWidth().friendsCard().padding(10.dp).scale(pop.value),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FriendsLabel("ROUND ${s.rounds.size}")
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    RevealArt("YOU", if (me == Side.A) r.a else r.b, glow = r.winner == me)
                    // 9d: the clash burst between the two hands.
                    Image(
                        painterResource(R.drawable.art_pocket_clash_burst), null, contentScale = ContentScale.Fit,
                        modifier = Modifier.size(40.dp).clearAndSetSemantics { },
                    )
                    RevealArt(them.uppercase(), if (me == Side.A) r.b else r.a, glow = r.winner == me.other)
                }
            }
        }

        FriendsLabel("YOUR PICK", modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            RpsPick.PLAYABLE.forEach { p ->
                val selected = mine == p
                val shape = RoundedCornerShape(16.dp)
                Column(
                    Modifier.weight(1f).height(118.dp)
                        .then(
                            if (selected) Modifier.shadow(10.dp, shape, ambientColor = FriendsTiles.purple.copy(alpha = 0.7f), spotColor = FriendsTiles.purple.copy(alpha = 0.7f)).clip(shape).background(FriendsTiles.purple)
                            else Modifier.friendsCard(16.dp, accent = FriendlyKind.RPS.color),
                        )
                        .alpha(if (enabled || selected) 1f else 0.55f)
                        .clickableNoRipple { if (enabled && mine == null) onPick(p) }
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                ) {
                    Image(painterResource(rpsPiece(p)), p.raw, contentScale = ContentScale.Fit, modifier = Modifier.size(70.dp))
                    Text(p.raw.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = if (selected) Color.White else DEEP)
                }
            }
        }
        Text("Both picks flip at once.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label)
    }
}

/** The shipped hand art (art_pocket_rps_*). */
private fun rpsPiece(pick: RpsPick): Int = when (pick) {
    RpsPick.ROCK -> R.drawable.art_pocket_rps_rock
    RpsPick.PAPER -> R.drawable.art_pocket_rps_paper
    RpsPick.SCISSORS -> R.drawable.art_pocket_rps_scissors
    RpsPick.HIDDEN -> R.drawable.art_pocket_rps_hidden
}

@Composable
private fun RevealArt(label: String, pick: RpsPick, glow: Boolean) {
    val shape = RoundedCornerShape(14.dp)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier.size(72.dp)
                .then(
                    if (glow) Modifier.shadow(10.dp, shape, ambientColor = FriendsTiles.purple.copy(alpha = 0.8f), spotColor = FriendsTiles.purple.copy(alpha = 0.8f)).clip(shape).background(FriendsTiles.purple)
                    else Modifier.clip(shape).background(friendsWash(FriendsTiles.purple, 0.10f)),
                ),
            Alignment.Center,
        ) { Image(painterResource(rpsPiece(pick)), pick.raw, contentScale = ContentScale.Fit, modifier = Modifier.size(56.dp)) }
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (glow) FriendsTiles.purple else FriendsPink.label, maxLines = 1)
    }
}

// ── Tic-Tac-Tile ────────────────────────────────────────────────────────────

@Composable
private fun TttBoard(s: TttState, me: Side, them: String, myTurn: Boolean, onCell: (Int) -> Unit) {
    val winning = remember(s, me, myTurn) {
        if (!myTurn) emptySet() else (0..8).filter { i ->
            s.board[i] == null && tttLine(s.board.toMutableList().also { it[i] = me })?.side == me
        }.toSet()
    }
    // J2: the winning three glow once a board is won.
    val won = remember(s.board) { tttLine(s.board)?.cells?.toSet() ?: emptySet() }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            // L: no grid lines — the cells sit apart on the tray.
            val tile: Dp = min(98.dp, (maxWidth - 20.dp) / 3)
            val winLine = remember(s.board) { tttLine(s.board)?.cells }
            Box {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                (0 until 3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        (0 until 3).forEach { col ->
                            val i = row * 3 + col
                            TttTile(
                                s.board[i], me, tile, hint = i in winning, win = i in won,
                                label = "Row ${row + 1}, column ${col + 1}, " + when (s.board[i]) {
                                    null -> "empty"; me -> "your X"; else -> "${them}'s O"
                                },
                                enabled = myTurn && s.board[i] == null,
                            ) { onCell(i) }
                        }
                    }
                }
            }
            // 9d: the won line gets the shipped strike (a soft fade-in; static under Reduce Motion).
            winLine?.let { TttStrike(it, tile) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            LegendDot(FriendsTiles.purple, "YOU · X")
            LegendDot(TTT_PINK, "${them.uppercase()} · O")
        }
    }
}

/**
 * A Tic-Tac-Tile cell (J2): an empty cell is frosted glass on the tray; a placed piece
 * is the glossy art (`art_piece_ttt_x` purple for you, `art_piece_ttt_o` pink for them)
 * dropping in with the type pop (swell 1.07 over [TileMotion.TYPE_MS]); the winning
 * three glow. Reduce Motion: no pop. TalkBack reads [label].
 */
@Composable
private fun TttTile(mark: Side?, me: Side, size: Dp, hint: Boolean, win: Boolean, label: String, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val tone = when (mark) { null -> FriendsTiles.purple; me -> FriendsTiles.purple; else -> TTT_PINK }
    val glow = when {
        win -> tone.copy(alpha = 0.9f)
        mark != null -> tone.copy(alpha = 0.35f)
        hint -> FriendsTiles.purple.copy(alpha = 0.55f)
        else -> Color(0x184C1D95)
    }
    // The type pop when a piece lands (not on first show of an already-placed piece).
    val pop = remember { Animatable(1f) }
    var seen by remember { mutableStateOf(mark) }
    LaunchedEffect(mark) {
        if (mark != null && seen == null && !WTheme.reducedMotion) {
            pop.snapTo(0.6f)
            pop.animateTo(1.07f, tween(TileMotion.TYPE_MS * 2 / 3, easing = FastOutSlowInEasing))
            pop.animateTo(1f, tween(TileMotion.TYPE_MS / 3))
        }
        seen = mark
    }
    Box(
        Modifier.size(size)
            .then(if (enabled) Modifier.squishClickable(label = label, onClick = onClick) else Modifier.semantics { contentDescription = label })
            .shadow(if (win || hint) 12.dp else 4.dp, shape, ambientColor = glow, spotColor = glow)
            .clip(shape)
            .background(
                when {
                    win -> friendsWash(tone, 0.3f)
                    mark != null -> friendsWash(tone, 0.14f)
                    else -> Color.White.copy(alpha = 0.55f)
                },
            )
            .then(
                when {
                    hint -> Modifier.dashedBorder(2.dp, FriendsTiles.purple, 16.dp)
                    win -> Modifier.border(2.5.dp, tone, shape)
                    else -> Modifier.border(1.5.dp, friendsLine(if (mark == null) FriendsTiles.purple else tone, 0.3f), shape)
                },
            ),
        Alignment.Center,
    ) {
        if (mark != null) {
            Image(
                painterResource(if (mark == me) R.drawable.art_pocket_ttt_x else R.drawable.art_pocket_ttt_o),
                contentDescription = null, contentScale = ContentScale.Fit,
                modifier = Modifier.size(size * 0.88f).graphicsLayer { scaleX = pop.value; scaleY = pop.value }.clearAndSetSemantics { },
            )
        }
    }
}

/**
 * The strike across the winning three (art_pocket_ttt_strike, a gold bar with sparkles, ~1.46 : 1): centered on the
 * line's midpoint, long enough to cover the three cells, rotated to the line's angle (rows 0, columns 90, diagonals
 * +-45). A transform-only fade-in over 320 ms.
 */
@Composable
private fun TttStrike(cells: List<Int>, tile: Dp) {
    val step = tile + 10.dp
    fun cx(i: Int) = step * (i % 3) + tile / 2
    fun cy(i: Int) = step * (i / 3) + tile / 2
    val first = cells.first()
    val last = cells.last()
    val dx = (cx(last) - cx(first)).value
    val dy = (cy(last) - cy(first)).value
    val len = (hypot(dx, dy) + tile.value * 0.9f).dp
    val h = len * (244f / 356f)
    val mx = (cx(first) + cx(last)) / 2
    val my = (cy(first) + cy(last)) / 2
    val angle = Math.toDegrees(atan2(dy, dx).toDouble()).toFloat()
    val fade = remember(cells) { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(cells) { if (!WTheme.reducedMotion) fade.animateTo(1f, tween(320, easing = FastOutSlowInEasing)) }
    Image(
        painterResource(R.drawable.art_pocket_ttt_strike), contentDescription = null, contentScale = ContentScale.Fit,
        modifier = Modifier.offset(x = mx - len / 2, y = my - h / 2).size(len, h)
            .graphicsLayer { rotationZ = angle; alpha = fade.value }.clearAndSetSemantics { },
    )
}

private fun coinArt2(face: CoinFace): Int =
    if (face == CoinFace.HEADS) R.drawable.art_pocket_coin_heads_w else R.drawable.art_pocket_coin_tails_crest

/** J2 the opponent's O pink. */
private val TTT_PINK = Color(0xFFF59E0B)

@Composable
private fun LegendDot(color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(color))
        Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.sub, maxLines = 1)
    }
}

// ── Call It ─────────────────────────────────────────────────────────────────

@Composable
private fun CoinBoard(gameId: String, s: CoinState, me: Side, them: String, myTurn: Boolean, onCall: (CoinFace) -> Unit) {
    val last = s.rounds.lastOrNull()
    val face = last?.flip ?: CoinFace.HEADS
    // Spin briefly on each NEW reveal (not on first open), then land on the server's face.
    var seen by remember(gameId) { mutableIntStateOf(s.rounds.size) }
    val spin = remember(gameId) { Animatable(1f) }
    LaunchedEffect(s.rounds.size) {
        if (s.rounds.size > seen) {
            seen = s.rounds.size
            if (!WTheme.reducedMotion) {
                spin.snapTo(0f)
                spin.animateTo(1f, tween(1100, easing = FastOutSlowInEasing))
            }
        } else seen = s.rounds.size
    }
    // 9d: three flips as frames: face -> tilt -> edge -> tilt -> face, hopping over a shrinking shadow, landing
    // on the server's face. Transforms + frame swaps only; Reduce Motion = no spin (t stays 1).
    val t = spin.value
    val turn = cos(Math.toRadians((t * 1080.0)))
    val squash = abs(turn).toFloat()
    val other = if (face == CoinFace.HEADS) CoinFace.TAILS else CoinFace.HEADS
    val frame = when {
        squash > 0.55f -> coinArt2(if (turn >= 0) face else other)
        squash > 0.2f -> R.drawable.art_pocket_coin_tilt
        else -> R.drawable.art_pocket_coin_edge
    }
    val hop = sin(Math.PI * t).toFloat()
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        Box(Modifier.size(width = 170.dp, height = 170.dp), contentAlignment = Alignment.Center) {
            Image(
                painterResource(R.drawable.art_pocket_coin_shadow), null, contentScale = ContentScale.Fit,
                modifier = Modifier.align(Alignment.BottomCenter).size(130.dp, 40.dp)
                    .graphicsLayer { val k = 1f - 0.3f * hop; scaleX = k; scaleY = k; alpha = 0.85f - 0.4f * hop }.clearAndSetSemantics { },
            )
            Image(
                painterResource(frame), face.raw, contentScale = ContentScale.Fit,
                modifier = Modifier.size(140.dp)
                    .graphicsLayer {
                        translationY = -hop * 34f * density
                        if (squash > 0.55f) scaleX = squash
                    },
            )
        }
        last?.let { r ->
            Text(
                "${r.flip.raw.uppercase()} · ${if (r.winner == me) "YOU TAKE ROUND ${s.rounds.size}" else "${them.uppercase()} TAKES ROUND ${s.rounds.size}"}",
                fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = DEEP,
            )
        }
        if (myTurn) {
            FriendsLabel("YOUR CALL")
            // A8: the two calls as candy buttons.
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                CandyButton("HEADS", onClick = { onCall(CoinFace.HEADS) }, color = CandyColor.PURPLE, size = CandySize.LARGE, modifier = Modifier.weight(1f), fill = true)
                CandyButton("TAILS", onClick = { onCall(CoinFace.TAILS) }, color = CandyColor.PINK, size = CandySize.LARGE, modifier = Modifier.weight(1f), fill = true)
            }
        } else if (whoseTurn(s) != null) {
            FriendsLabel("${them.uppercase()} CALLS")
        }
        FriendsLabel("WHAT'S ON THE LINE")
        Text(
            s.stake, fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.solid,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(friendsWash(FriendlyKind.COIN.color, 0.2f))
                .border(2.dp, FriendlyKind.COIN.color, RoundedCornerShape(50)).padding(horizontal = 14.dp, vertical = 7.dp),
        )
    }
}

// ── Pass the Puzzle ─────────────────────────────────────────────────────────

private val KEY_ROWS = listOf("QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM")

@Composable
private fun PassBoard(
    gameId: String,
    s: PassState,
    me: Side,
    opp: FriendlyGamesService.Opponent,
    myTurn: Boolean,
    busy: Boolean,
    answer: String?,
    onGuess: (String) -> Unit,
) {
    var typed by remember(gameId) { mutableStateOf("") }
    // A landed guess clears the typing row.
    LaunchedEffect(s.guesses.size) { typed = "" }
    val profile = AuthService.profile.value
    val best = remember(s.guesses) {
        val m = mutableMapOf<Char, TileState>()
        fun rank(t: TileState) = when (t) { TileState.CORRECT -> 3; TileState.PRESENT -> 2; TileState.ABSENT -> 1; else -> 0 }
        s.guesses.forEach { g -> g.word.forEachIndexed { i, ch -> val t = g.tiles.getOrNull(i) ?: TileState.ABSENT; if (rank(t) > rank(m[ch] ?: TileState.EMPTY)) m[ch] = t } }
        m
    }
    fun tileColor(t: TileState): Color = when (t) {
        TileState.CORRECT -> FriendsTiles.purple
        TileState.PRESENT -> FriendsTiles.amber
        else -> FriendsTiles.slate
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        (0 until PASS_MAX_GUESSES).forEach { row ->
            val g = s.guesses.getOrNull(row)
            val typingRow = g == null && row == s.guesses.size && myTurn
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(Modifier.size(26.dp), Alignment.Center) {
                    when {
                        g != null && g.by == me -> FriendFace(profile?.username ?: "You", profile?.avatarUrl, profile?.avatarEmoji, 24.dp, online = false, accentHex = profile?.accentColor)
                        g != null -> FriendFace(opp.username, opp.avatarUrl, opp.avatarEmoji, 24.dp, online = false)
                    }
                }
                (0 until 5).forEach { i ->
                    val shape = RoundedCornerShape(8.dp)
                    if (g != null) {
                        val t = g.tiles.getOrNull(i) ?: TileState.ABSENT
                        // 9d: the shipped tiles (purple = right spot, gold = wrong spot, white = not in the word).
                        Box(Modifier.size(44.dp), Alignment.Center) {
                            Image(
                                painterResource(when (t) {
                                    TileState.CORRECT -> R.drawable.art_pocket_tile_purple
                                    TileState.PRESENT -> R.drawable.art_pocket_tile_gold
                                    else -> R.drawable.art_pocket_tile_white
                                }),
                                null, contentScale = ContentScale.FillBounds, modifier = Modifier.matchParentSize().clearAndSetSemantics { },
                            )
                            Text(
                                g.word.getOrNull(i)?.toString() ?: "", fontSize = 20.sp, fontWeight = FontWeight.Black,
                                color = when (t) { TileState.CORRECT -> Color(0xFF3B0764); TileState.PRESENT -> Color(0xFF5B3A00); else -> DEEP },
                            )
                        }
                    } else {
                        val ch = if (typingRow) typed.getOrNull(i) else null
                        // B1: an empty tile is frosted glass (not solid white) with a faint lilac line.
                        Box(
                            Modifier.size(44.dp).clip(shape).background(if (typingRow && ch != null) Color.White else Color.White.copy(alpha = 0.55f))
                                .border(if (typingRow) 2.dp else 1.5.dp, if (typingRow && ch != null) FriendsTiles.purple else Color(0xFFDCCFF5), shape),
                            Alignment.Center,
                        ) { Text(ch?.toString() ?: "", fontSize = 20.sp, fontWeight = FontWeight.Black, color = DEEP) }
                    }
                }
                Spacer(Modifier.width(26.dp))
            }
        }
        if (answer != null) {
            Text("THE WORD WAS ${answer.uppercase()}", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = DEEP, modifier = Modifier.padding(top = 4.dp))
        } else if (whoseTurn(s) != null && !myTurn) {
            FriendsLabel("${opp.username.uppercase()} IS GUESSING", modifier = Modifier.padding(top = 4.dp))
        }
        if (myTurn) {
            Spacer(Modifier.height(4.dp))
            KEY_ROWS.forEachIndexed { r, keys ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                    if (r == 2) {
                        KeyCap("ENTER", Modifier.weight(1.6f), bg = FriendsPink.solid, ink = Color.White, enabled = !busy && typed.length == 5) { onGuess(typed) }
                    }
                    keys.forEach { k ->
                        val st = best[k]
                        KeyCap(
                            k.toString(), Modifier.weight(1f),
                            bg = st?.let { tileColor(it) } ?: KEY_FACE,
                            ink = if (st == null) DEEP else Color.White,
                            enabled = !busy,
                        ) { if (typed.length < 5) typed += k }
                    }
                    if (r == 2) {
                        DeleteKey(Modifier.weight(1.6f)) { if (typed.isNotEmpty()) typed = typed.dropLast(1) }
                    }
                }
            }
        }
    }
}

/** B2 a key as a tile: a light lilac face (or its state color) on a thicker lip, squishing on tap. */
@Composable
private fun KeyCap(label: String, modifier: Modifier, bg: Color, ink: Color, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier.height(46.dp)
            .squishClickable(label = label, enabled = enabled, onClick = onClick)
            .alpha(if (enabled) 1f else 0.5f)
            .clip(shape).background(keyLip(bg))
            .padding(bottom = 3.dp)
            .clip(shape).background(bg),
        Alignment.Center,
    ) { Text(label, fontSize = if (label.length > 1) 11.sp else 15.sp, fontWeight = FontWeight.Black, color = ink, maxLines = 1) }
}

/** B2 the chunky purple backspace key. */
@Composable
private fun DeleteKey(modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier.height(46.dp)
            .squishClickable(label = "Delete", onClick = onClick)
            .clip(shape).background(keyLip(KEY_FACE))
            .padding(bottom = 3.dp)
            .clip(shape).background(KEY_FACE),
        Alignment.Center,
    ) { Icon(Icons.AutoMirrored.Filled.Backspace, null, tint = FriendsTiles.purple, modifier = Modifier.size(22.dp)) }
}

/** B2 the keys' light lilac face. */
private val KEY_FACE = Color(0xFFF1EAFF)

/** A key's lip: its face darkened. */
private fun keyLip(face: Color): Color = Color(com.wordocious.app.ui.TintMath.over(0xFF000000.toInt(), 0.18f, face.toArgb()))

// ── Ghost (§9) ──────────────────────────────────────────────────────────────

/** A letter tile by who played it: the shipped tile art (yours purple, theirs gold) with the letter on it; the newest glows. */
@Composable
private fun PlayerTile(letter: Char, mine: Boolean, size: Dp, radius: Dp, glow: Boolean = false) {
    val c = if (mine) FriendsTiles.purple else FriendsTiles.amber
    val ink = if (mine) Color(0xFF3B0764) else Color(0xFF5B3A00)
    Box(
        Modifier.size(size)
            .then(if (glow) Modifier.shadow(10.dp, RoundedCornerShape(radius), ambientColor = c.copy(alpha = 0.9f), spotColor = c.copy(alpha = 0.9f)) else Modifier),
        Alignment.Center,
    ) {
        Image(
            painterResource(if (mine) R.drawable.art_pocket_tile_purple else R.drawable.art_pocket_tile_gold), null,
            contentScale = ContentScale.FillBounds, modifier = Modifier.matchParentSize().clearAndSetSemantics { },
        )
        Text(letter.toString(), fontSize = (size.value * 0.46f).sp, fontWeight = FontWeight.Black, color = ink)
    }
}

@Composable
private fun GhostBoard(s: GhostState, me: Side, them: String, myTurn: Boolean, busy: Boolean, onLetter: (Char) -> Unit) {
    // A tap only fills the dashed tile; ADD <L> plays it, so a mis-tap can't lose a round.
    var picked by remember(s.fragment, s.rounds.size) { mutableStateOf<Char?>(null) }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        // The fragment as big tiles, each colored by who played it; an empty dashed tile at the end on your turn.
        val count = s.fragment.length + if (myTurn) 1 else 0
        BoxWithConstraints(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
            val gap = 6.dp
            val tile: Dp = if (count == 0) 52.dp else min(52.dp, (maxWidth - gap * (count - 1)) / count)
            if (count == 0) {
                Box(Modifier.height(tile), Alignment.Center) {
                    FriendsLabel(if (whoseTurn(s) != null) "${them.uppercase()} STARTS THE WORD" else "THE ROUNDS ARE IN")
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.CenterVertically) {
                    s.fragment.forEachIndexed { i, ch -> PlayerTile(ch, s.letters.getOrNull(i) == me, tile, 10.dp) }
                    if (myTurn) {
                        Box(
                            Modifier.size(tile).clip(RoundedCornerShape(10.dp)).background(if (picked != null) YOU_TINT else Color.White.copy(alpha = 0.55f))
                                .dashedBorder(2.dp, FriendsTiles.purple, 10.dp),
                            Alignment.Center,
                        ) { Text(picked?.toString() ?: "", fontSize = (tile.value * 0.46f).sp, fontWeight = FontWeight.Black, color = FriendsTiles.purple) }
                    }
                }
            }
        }
        if (whoseTurn(s) != null && !myTurn) FriendsLabel("${them.uppercase()} IS PICKING A LETTER")

        // The last round's result: "GHOST — Doug spelled a word" / "QZ — no word starts with that".
        s.rounds.lastOrNull()?.let { r ->
            val youLost = r.loser == me
            val text = if (r.reason == GhostReason.WORD) "${if (youLost) "you" else them} spelled a word" else "no word starts with that"
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (youLost) THEM_TINT else YOU_TINT).padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Image(painterResource(R.drawable.art_pocket_ghost_marker), null, contentScale = ContentScale.Fit, modifier = Modifier.size(34.dp).clearAndSetSemantics { })
                FriendsLabel("ROUND ${s.rounds.size} · ${if (youLost) "${them.uppercase()} TAKES IT" else "YOU TAKE IT"}")
                Text(
                    "${r.fragment} — $text", fontSize = 15.sp, fontWeight = FontWeight.Black, color = DEEP,
                    textAlign = TextAlign.Center,
                )
            }
        }

        if (myTurn) {
            KEY_ROWS.forEach { keys ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                    if (keys.length < 10) Spacer(Modifier.weight((10 - keys.length) / 2f))
                    keys.forEach { k ->
                        val on = picked == k
                        KeyCap(k.toString(), Modifier.weight(1f), bg = if (on) FriendsTiles.purple else KEY_FACE, ink = if (on) Color.White else DEEP, enabled = !busy) { picked = k }
                    }
                    if (keys.length < 10) Spacer(Modifier.weight((10 - keys.length) / 2f))
                }
            }
            val letter = picked
            CandyButton(
                if (letter != null) "ADD $letter" else "PICK A LETTER",
                onClick = { if (letter != null && !busy) onLetter(letter) },
                color = CandyColor.PURPLE, size = CandySize.LARGE,
                enabled = letter != null && !busy, modifier = Modifier.fillMaxWidth(), fill = true,
            )
        }
        Text(
            "Spell a word and you lose the round. Leave a dead end and you lose it too.",
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// ── Word Chain (§9) ─────────────────────────────────────────────────────────

@Composable
private fun ChainBoard(
    gameId: String,
    s: ChainState,
    me: Side,
    them: String,
    myTurn: Boolean,
    busy: Boolean,
    onError: (String) -> Unit,
    onWord: (String) -> Unit,
) {
    val needed = s.needed
    // The needed first letter is pre-filled and locked; a landed word resets the row.
    var typed by remember(gameId, s.words.size) { mutableStateOf(needed?.toString() ?: "") }
    val locked = if (needed != null) 1 else 0
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        if (s.words.isEmpty()) {
            Text(
                if (myTurn) "Any $WORD_MIN- to $WORD_MAX-letter word opens the chain." else "${them.replaceFirstChar { it.uppercaseChar() }} opens the chain.",
                fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
            )
        }
        // The chain: one pill per word (tiles by player), points chip at the right; the newest word's last letter glows.
        s.words.forEachIndexed { wi, w ->
            if (wi > 0) Image(painterResource(R.drawable.art_pocket_chain_links), null, contentScale = ContentScale.Fit, modifier = Modifier.size(18.dp).clearAndSetSemantics { })
            val mine = w.by == me
            val newest = wi == s.words.lastIndex
            Row(
                Modifier.fillMaxWidth().friendsCard().padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                w.word.forEachIndexed { i, ch -> PlayerTile(ch, mine, 30.dp, 7.dp, glow = newest && i == w.word.lastIndex && whoseTurn(s) != null) }
                Spacer(Modifier.weight(1f))
                Text(
                    "+${w.points}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (mine) FriendsTiles.purple else Color(0xFFB45309),
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(if (mine) YOU_TINT else THEM_TINT).padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
        }
        if (whoseTurn(s) != null && !myTurn) {
            FriendsLabel(
                if (needed != null) "${them.uppercase()} NEEDS A WORD WITH $needed" else "${them.uppercase()} IS THINKING",
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        if (myTurn) {
            // Your word: 7 tiles, the locked first letter in a soft purple tile, tiles 6–7 dashed (optional).
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.padding(top = 6.dp)) {
                (0 until WORD_MAX).forEach { i ->
                    val ch = typed.getOrNull(i)
                    val shape = RoundedCornerShape(8.dp)
                    val isLocked = i < locked
                    val optional = i >= WORD_MIN && ch == null
                    Box(
                        Modifier.size(40.dp).clip(shape).background(if (isLocked) YOU_TINT else if (ch != null) Color.White else Color.White.copy(alpha = 0.55f))
                            .then(
                                if (optional) Modifier.dashedBorder(2.dp, Color(0xFFCBD5E1), 8.dp)
                                else Modifier.border(2.dp, if (ch != null) FriendsTiles.purple else Color(0xFFE5E7EB), shape),
                            ),
                        Alignment.Center,
                    ) { Text(ch?.toString() ?: "", fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (isLocked) FriendsTiles.purple else DEEP) }
                }
            }
            Spacer(Modifier.height(2.dp))
            KEY_ROWS.forEachIndexed { r, keys ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                    if (r == 2) {
                        KeyCap("ENTER", Modifier.weight(1.6f), bg = FriendsPink.solid, ink = Color.White, enabled = !busy && typed.length >= WORD_MIN) {
                            // The core's own checks first (length, first letter, repeat); the word list is the server's.
                            when (val res = applyFriendlyMove(s, me, FriendlyMove.Chain(typed))) {
                                is MoveResult.Err -> onError(res.error)
                                is MoveResult.Ok -> onWord(typed)
                            }
                        }
                    }
                    keys.forEach { k ->
                        KeyCap(k.toString(), Modifier.weight(1f), bg = KEY_FACE, ink = DEEP, enabled = !busy) { if (typed.length < WORD_MAX) typed += k }
                    }
                    if (r == 2) {
                        DeleteKey(Modifier.weight(1.6f)) { if (typed.length > locked) typed = typed.dropLast(1) }
                    }
                }
            }
        }
        Text(
            "Start with the last letter. No repeats. Each letter scores a point; first to $CHAIN_TARGET wins.",
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        )
    }
}
