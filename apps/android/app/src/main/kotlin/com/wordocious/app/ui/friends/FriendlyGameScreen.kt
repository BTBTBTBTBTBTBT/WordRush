package com.wordocious.app.ui.friends

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.togetherWith
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
import com.wordocious.app.ui.BubbleText
import com.wordocious.app.ui.ScaledChrome
import com.wordocious.app.ui.WidthClass
import com.wordocious.app.ui.chromeScale
import com.wordocious.app.ui.pocketBoardScale
import com.wordocious.app.ui.pocketScale
import com.wordocious.app.ui.rememberWidthClass
import com.wordocious.app.ui.tabletPageInset
import com.wordocious.app.ui.titleArtScale
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.filled.Flag
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
import androidx.compose.ui.draw.clipToBounds
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
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.ui.layout.onSizeChanged
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.ui.unit.times
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
import kotlin.math.roundToInt
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
import com.wordocious.core.CHAIN_WORD_MAX
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
import com.wordocious.core.WORD_MIN
import com.wordocious.core.applyFriendlyMove
import com.wordocious.core.friendlyHeadline
import com.wordocious.core.scoreOf
import com.wordocious.core.tttLine
import com.wordocious.core.whoseTurn
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// 2.8 item 24: under a dark season (Halloween) the fixed-light chips become the season's night glass and the deep ink its
// light text (PocketNight, pure + contrast-tested); out of season each value is the original light one.
private val YOU_TINT: Color get() = PocketNight.youTint()
private val THEM_TINT: Color get() = PocketNight.themTint()
private val YOU_WON: Color get() = PocketNight.youWon()
private val THEM_WON: Color get() = PocketNight.themWon()
private val DEEP: Color get() = PocketNight.ink()
/** The deep ink on the shipped light tile art (it stays white in every season). */
private val TILE_INK = Color(0xFF4C1D95)
/** A1 the leave dialog's soft pink wash (the season card under a dark season). */
private val DIALOG_TINT: Color get() = PocketNight.dialog()

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
        // The friend moved: an old error ("The game moved on") is stale (iOS parity).
        if (r.change.moved) error = null
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

    // DEBUG / benchmark demo (data/PocketDemo): a scripted move shows the moment it lands, no 2 s poll.
    LaunchedEffect(gameId) {
        if (com.wordocious.app.data.PocketDemo.isDemo(gameId)) {
            FriendlyGamesService.active.collect { list -> list.firstOrNull { it.id == gameId }?.let { accept(it) } }
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
                    // Read the new state first (it clears a stale error), then say why the move didn't land.
                    FriendlyGamesService.get(gameId)?.let { accept(it) }
                    error = r.message
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
    // Tablet pocket page (founder 10-14): the page inset replaces the phone's 12 / 16 dp, the header and corner buttons scale.
    val wc = rememberWidthClass()
    val side = if (wc == WidthClass.COMPACT) 12.dp else tabletPageInset(wc)
    // Finished games of this kind in the recent list = an existing player: no card, the key is recorded quietly.
    val recentGames by FriendlyGamesService.recent.collectAsState()
    val firstPlay = rememberFirstPlayAutoShow(PocketHelp.pocketTutorialKey(kind), recentGames.any { it.kind == kind }) && game != null && !com.wordocious.app.data.PocketDemo.isDemo(gameId) // the demo harness opens the card only on a tap of the ?
    LaunchedEffect(firstPlay) { if (firstPlay) showHelp = true }
    // A1: the Friends wallpaper (fixed light), never a flat white page.
    Column(Modifier.fillMaxSize().pageBackground(com.wordocious.app.ui.PageTint.FRIENDS, alwaysLight = true)) {
        // Top bar: close (pink) + centered title in the game's gradient.
        Box(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = side, vertical = 8.dp)) {
            // The shared white close circle (HEADER_SPEC §4).
            com.wordocious.app.ui.HeaderBackButton({ requestClose() }, Modifier.align(Alignment.CenterStart), close = true, size = 38.dp * chromeScale(wc))
            // Founder 10-14 (iOS parity): the title is the game's BIG bubble lettering in its accent, beside its 3D icon
            // (one line, fits between the X and the ?). Tablets scale the icon and the lettering with titleArtScale.
            val tt = titleArtScale(wc)
            Row(
                // Symmetric room for the right corner's TWO buttons (sound + ?), so the centered title never runs under the speaker.
                Modifier.align(Alignment.Center).fillMaxWidth().padding(horizontal = 92.dp * chromeScale(wc)),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp * tt, Alignment.CenterHorizontally),
            ) {
                FriendlyGameIcon(kind, 28.dp * tt)
                BubbleText(
                    (game?.title ?: kind.title).uppercase(), com.wordocious.app.ui.ThemeKit.accentPalette(kind.color),
                    Modifier.weight(1f), maxSize = (32f * tt).roundToInt(), minSize = (14f * tt).roundToInt(), align = TextAlign.Center,
                )
            }
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
        // Pass the Puzzle / Word Chain / Ghost keep their keyboard pinned under the scrolling page (iOS parity): the boards register it here.
        val kbSlot = remember(gameId) {
            // Seeded with the keyboard's height (3 rows of 40 dp; Ghost adds its ADD button) so the board is sized for it from the very
            // first frame, never re-fitted when the keyboard registers a frame later.
            // Tablets: the keys are 68 dp (the solo keyboard's tablet key), so the seed grows by three rows of 28 dp.
            val keyGrow = if (wc == WidthClass.COMPACT) 0f else 3f * (PINNED_KEY_TABLET_DP - PINNED_KEY_PHONE_DP)
            KbSlot().also { it.heightDp = when (game?.kind) { FriendlyKind.PASS, FriendlyKind.CHAIN -> 146f + keyGrow; FriendlyKind.GHOST -> 194f + keyGrow; else -> 0f } }
        }
        val dens = androidx.compose.ui.platform.LocalDensity.current
        var viewportPx by remember { mutableIntStateOf(0) }
        var boardTopPx by remember { mutableIntStateOf(0) }
        val boardMaxH = with(dens) { (viewportPx - boardTopPx).toDp() }
        androidx.compose.runtime.CompositionLocalProvider(
            LocalPinnedKeyboard provides kbSlot,
            LocalBoardMaxH provides (if (viewportPx > 0) boardMaxH else Dp.Unspecified),
        ) {
        Column(
            Modifier.weight(1f).fillMaxWidth().onSizeChanged { viewportPx = it.height }
                .verticalScroll(rememberScrollState()).padding(horizontal = if (wc == WidthClass.COMPACT) 16.dp else side),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // 9b presence: the friend's mascot is "here now" (alive ring) while they are in the channel,
            // "thinking…" on their turn, "left the game" when they go. Off / socket down = the old online dot.
            val presence = if (liveOn && socketUp && g.active)
                FriendlyLive.presenceLabel(peerPresent, peerEverSeen, theirTurn = whoseTurn(g.state)?.includes(g.me.other) == true && !myTurn)
            else null
            ScaledChrome(chromeScale(wc)) { ScoreWindow(g, if (presence != null) peerPresent else theyOn, presence) }
            // Founder 10-13 (no screen shifting): ONE fixed-height pill slot above the board. YOUR TURN (founder 10-10: a small gold
            // capsule) or WAITING FOR <name> take it in turn; it is empty (not collapsed) when the game is over.
            val theirTurn = g.active && !myTurn && whoseTurn(g.state)?.includes(g.me.other) == true
            Box(Modifier.fillMaxWidth().height(30.dp * chromeScale(wc)), contentAlignment = Alignment.Center) {
                if (g.active && myTurn) ScaledChrome(chromeScale(wc)) { YourTurnLabel() }
                else if (theirTurn) ScaledChrome(chromeScale(wc)) { TurnPill("WAITING FOR ${them.uppercase()}") }
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
                Modifier.fillMaxWidth().onGloballyPositioned {
                    boardTopPx = it.positionInParent().y.toInt()
                    com.wordocious.app.data.PocketDemo.bounds("board", it.positionInRoot().y, it.size.height.toFloat(), dens.density)
                }.graphicsLayer {
                    scaleX = boardScale.value; scaleY = boardScale.value; translationX = shakeX.value * this.density
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
            // 22: their turn = "Waiting for <name>…", how long they have had it, their face and the keepy-uppy tile, under the board
            // (it used to sit above it and push the board down every turn).
            if (theirTurn) {
                com.wordocious.app.ui.vs.PocketWaitStrip(
                    name = them, sinceMs = g.updatedMs,
                    avatar = { FriendFace(them, g.opponent.avatarUrl, g.opponent.avatarEmoji, 32.dp, online = theyOn) },
                )
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
                // Item 46: the pocket-game result card (the sender's mascot cheering, or the good-sport shrug, and the final score).
                val shareContext = androidx.compose.ui.platform.LocalContext.current
                PinkButton("SHARE RESULT", modifier = Modifier.fillMaxWidth(), solid = false) {
                    val sc = scoreOf(g.state)
                    val won = when (g.result) { "win" -> true; "loss" -> false; else -> null }
                    com.wordocious.app.data.MomentCard.share(
                        shareContext,
                        com.wordocious.core.MomentShare.pocketResult(g.kind.title, won, sc?.get(g.me), sc?.get(g.me.other), g.opponent.username),
                    )
                }
                PinkButton("FRIENDS", modifier = Modifier.fillMaxWidth(), solid = false, onClick = onFriends)
            }
            Spacer(Modifier.height(28.dp))
        }
        // The pinned keyboard (Pass / Chain on my turn): always on screen, never scrolled away.
        // Its height is kept once seen, so the board above never resizes when the keyboard goes quiet (their turn, game over).
        if (kbSlot.heightDp > 0f || kbSlot.content != null) {
            Box(
                Modifier.fillMaxWidth().padding(horizontal = if (wc == WidthClass.COMPACT) 16.dp else side)
                    .then(if (wc == WidthClass.COMPACT) Modifier else Modifier.navigationBarsPadding()).padding(top = 6.dp, bottom = 8.dp)
                    .then(if (wc == WidthClass.COMPACT) Modifier else Modifier.wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = 820.dp))
                    .defaultMinSize(minHeight = (kbSlot.heightDp - 14f).dp)
                    .onSizeChanged { val h = it.height / dens.density + 14f; if (kbSlot.content != null && kotlin.math.abs(h - kbSlot.heightDp) > 0.5f) kbSlot.heightDp = maxOf(h, kbSlot.heightDp) }
                    .onGloballyPositioned { com.wordocious.app.data.PocketDemo.bounds("keyboard", it.positionInRoot().y, it.size.height.toFloat(), dens.density) },
            ) { kbSlot.content?.invoke() }
        }
        }
    }

    if (showHelp) PocketHelpDialog(kind, onDismiss = { showHelp = false })

    if (confirmClose) {
        // 9: ONE themed button. The game waits; Resign now lives in the Friends tab's ⋯ menu.
        // Parity audit 10-16: the family sheet on the pocket night glass, not a Material dialog.
        com.wordocious.app.ui.FamilyDialogSheet(
            onDismissRequest = { confirmClose = false },
            containerColor = DIALOG_TINT,
            body = {
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
            // iOS parity: which game of the (at most five) the match is on.
            parts += "BEST OF 3 · GAME ${minOf(s.games.size + 1, 5)}"
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
        is PassState -> parts += "ONE BOARD · SIX GUESSES"
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
    val frost = PocketNight.frost()
    val line = friendsLine(g.kind.color)
    val score = scoreOf(g.state)
    val me = AuthService.profile.value
    // The result's host (MASCOT_SPEC §3): O3, the prankster, pops on a win; R on a loss.
    val host = if (won) com.wordocious.app.ui.Mascots.pocketWin else if (lost) com.wordocious.app.ui.Mascots.loss else null
    Box(Modifier.fillMaxWidth().padding(top = com.wordocious.app.ui.BANNER_HOST_PEEK)) {
        Column(
            Modifier.fillMaxWidth()
                .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
                .clip(RoundedCornerShape(16.dp))
                .drawBehind {
                    drawRect(leftBg, size = Size(size.width / 2f, size.height))
                    drawRect(rightBg, topLeft = Offset(size.width / 2f, 0f), size = Size(size.width / 2f, size.height))
                    drawRect(Brush.linearGradient(
                        0f to Color.White.copy(alpha = frost), 0.55f to Color.White.copy(alpha = 0f),
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
                Row(Modifier.height(26.dp).padding(end = if (host != null) com.wordocious.app.ui.BANNER_HOST_CLEAR else 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FriendlyGameIcon(g.kind, 24.dp)
                    FitLine(headlineFor(g), 16f, 11f, Modifier.weight(1f), FontWeight.Black, DEEP, 0.4.sp)
                }
                // Founder 10-10 (the tiny line was hard to read): plain 12 sp heavy text, pink on the night card / raspberry on the day one.
                Box(Modifier.fillMaxWidth().height(18.dp), Alignment.CenterStart) {
                    FitLine(subLineFor(g, theyOn), 12f, 8.5f, Modifier.fillMaxWidth(), FontWeight.ExtraBold,
                        if (FriendsPink.dark) Color(0xFFF9A8D4) else Color(0xFFB0306F), 0.3.sp)
                }
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
        // 9d: the shipped turn marker (the gold arrow disc) sits beside the TO PLAY pill (an invisible one keeps both halves level).
        Row(Modifier.alpha(if (toPlay || chip != null) 1f else 0f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (chip == null) Image(painterResource(R.drawable.art_pocket_turn_marker), null, contentScale = ContentScale.Fit, modifier = Modifier.size(15.dp).clearAndSetSemantics { })
            Text(
                chip?.first ?: "TO PLAY", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = Color.White, maxLines = 1,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(chip?.second ?: FriendsPink.solid).padding(horizontal = 7.dp, vertical = 2.dp),
            )
        }
        FriendFace(name, url, emoji, 44.dp, online = online, accentHex = accentHex)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = DEEP, maxLines = 1, overflow = TextOverflow.Ellipsis)
        // A2: the score as a soft number.
        if (score != null) com.wordocious.app.ui.SoftNumber("$score", 30.sp, color = com.wordocious.app.ui.vs.VsInk.softNumber)
    }
}

/** "YOUR TURN" over a pocket board while it is your move: a gold capsule (flag + words) that pops in once, then rests. */
@Composable
private fun YourTurnLabel() {
    val reduce = WTheme.reducedMotion
    val pop = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) { if (!reduce) pop.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.65f, stiffness = 380f)) }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(50)
        Row(
            Modifier
                .graphicsLayer { val k = 0.7f + 0.3f * pop.value; scaleX = k; scaleY = k; alpha = pop.value.coerceIn(0f, 1f) }
                .shadow(5.dp, shape, ambientColor = Color(0x59F59E0B), spotColor = Color(0x59F59E0B))
                .clip(shape)
                .background(Brush.verticalGradient(listOf(Color(0xFFFDE68A), Color(0xFFF5B82E))))
                .border(1.dp, Color.White.copy(alpha = 0.55f), shape)
                .padding(horizontal = 12.dp, vertical = 5.dp)
                .semantics(mergeDescendants = true) { contentDescription = "Your turn" },
            horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Flag, null, tint = Color(0xFF3B2300), modifier = Modifier.size(12.dp))
            Text("YOUR TURN", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, fontFamily = Nunito, color = Color(0xFF3B2300))
        }
    }
}

/** The quiet twin of YOUR TURN: a frosted capsule saying whose move it is while the friend has it. Same size slot, so nothing moves. */
@Composable
private fun TurnPill(text: String) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier.clip(shape).background(Color.White.copy(alpha = 0.16f)).border(1.dp, Color.White.copy(alpha = 0.3f), shape)
            .padding(horizontal = 12.dp, vertical = 5.dp).semantics(mergeDescendants = true) { contentDescription = text },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, fontFamily = Nunito, color = FriendsPink.sub, maxLines = 1)
    }
}

// ── Pinned keyboard (founder 10-13, iOS parity) ─────────────────────────────────────────────────────────────

/** Where a board hands its keyboard so the screen pins it to the bottom (outside the scroll); null = draw it inline. */
private val LocalPinnedKeyboard = androidx.compose.runtime.staticCompositionLocalOf<KbSlot?> { null }

/** The pinned keyboard's slot: the content, and the tallest it has been (kept as a minimum so nothing moves when it goes quiet). */
@androidx.compose.runtime.Stable
private class KbSlot {
    var content by mutableStateOf<(@Composable () -> Unit)?>(null)
    var heightDp by androidx.compose.runtime.mutableFloatStateOf(0f)
}

/** How tall the board may be: the scroll viewport (already net of the pinned keyboard) below the board's top. Unspecified = no cap. */
/** The pinned keyboard's key height: 40 dp on a phone, 68 dp on a tablet (the solo keyboard's tablet key). */
private const val PINNED_KEY_PHONE_DP = 40f
private const val PINNED_KEY_TABLET_DP = 68f

/** A key's height: 46 dp inline, 40 dp in the pinned keyboard (more room for the board above it). */
private val LocalKeyH = androidx.compose.runtime.compositionLocalOf { 46.dp }

private val LocalBoardMaxH = androidx.compose.runtime.compositionLocalOf { Dp.Unspecified }

/** Draw [content] pinned at the bottom of the screen while this is composed (inline when there is no slot). */
@Composable
private fun PinKeyboard(content: @Composable () -> Unit) {
    val slot = LocalPinnedKeyboard.current
    if (slot == null) { content(); return }
    // Tablets (MEDIUM / EXPANDED): 68 dp keys, the solo KeyboardView's tablet key (52 x 1.3), inside the 820 dp keyboard column.
    val keyH = if (rememberWidthClass() == WidthClass.COMPACT) PINNED_KEY_PHONE_DP.dp else PINNED_KEY_TABLET_DP.dp
    val latest = androidx.compose.runtime.rememberUpdatedState(content)
    androidx.compose.runtime.DisposableEffect(slot, keyH) {
        slot.content = { androidx.compose.runtime.CompositionLocalProvider(LocalKeyH provides keyH) { latest.value() } }
        onDispose { slot.content = null }
    }
}

/** One line of text that shrinks (down to [minSp]) instead of wrapping, so a header strip never changes height. */
@Composable
private fun FitLine(
    text: String, sp: Float, minSp: Float, modifier: Modifier = Modifier, weight: FontWeight, color: Color,
    letterSpacing: androidx.compose.ui.unit.TextUnit = androidx.compose.ui.unit.TextUnit.Unspecified, center: Boolean = false, shadow: Boolean = false,
) {
    var size by remember(text) { mutableStateOf(sp) }
    Text(
        text, fontSize = size.sp, fontWeight = weight, letterSpacing = letterSpacing, color = color, maxLines = 1, softWrap = false, modifier = modifier,
        textAlign = if (center) TextAlign.Center else null,
        style = if (shadow) TextStyle(shadow = androidx.compose.ui.graphics.Shadow(Color(0xCC1E0A3C), Offset(0f, 2f), 6f)) else TextStyle.Default,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { if (it.hasVisualOverflow && size > minSp) size -= 0.5f },
    )
}

// ── Rock Paper Scissors ─────────────────────────────────────────────────────

@Composable
private fun RpsBoard(s: RpsState, me: Side, them: String, enabled: Boolean, onPick: (RpsPick) -> Unit) {
    val k = pocketScale(rememberWidthClass())
    val theirs = s.picks[me.other]
    val mine = s.picks[me]
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp * k), modifier = Modifier.fillMaxWidth()) {
        // Founder 10-10: while they are picking, their hand cycles rock, paper, scissors (the same art as the "Your pick" buttons, 80 dp
        // at 75%; one cheap swap every 0.42 s from a periodic tick, no running animation; a still rock at 60% under Reduce Motion /
        // animator scale 0). Once their pick is in: the face-down fist (the art's fist only, the bottom 63%, clipped; no "?" bubble).
        if (theirs != RpsPick.HIDDEN) {
            val still = WTheme.reducedMotion
            var cycle by remember { mutableStateOf(0) }
            if (!still) LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(420); cycle = (cycle + 1) % RpsPick.PLAYABLE.size } }
            Image(
                painterResource(rpsPiece(if (still) RpsPick.ROCK else RpsPick.PLAYABLE[cycle])), null, contentScale = ContentScale.Fit,
                modifier = Modifier.size(80.dp * k).alpha(if (still) 0.6f else 0.75f).clearAndSetSemantics { },
            )
        } else {
            Box(Modifier.size(92.dp * k, 80.dp * k).clearAndSetSemantics { }, contentAlignment = Alignment.BottomCenter) {
              Box(Modifier.size(92.dp * k, 66.dp * k).clipToBounds(), contentAlignment = Alignment.BottomCenter) {
                Image(
                    painterResource(R.drawable.art_pocket_rps_hidden), null, contentScale = ContentScale.Crop, alignment = Alignment.BottomCenter,
                    modifier = Modifier.requiredSize(92.dp * k, 116.dp * k),
                )
              }
            }
        }
        // Founder 10-13 (no screen shifting): the PICKED badge row is taller than the HASN'T PICKED text, so the board moved
        // 1 dp (phone) / 2.6 dp (tablet) on every pick. One fixed slot the height of the badge holds either line.
        Box(Modifier.height(14.dp * k), contentAlignment = Alignment.Center) {
            if (theirs == RpsPick.HIDDEN) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, 14.dp * k)
                    Text("${them.uppercase()} PICKED", fontSize = (11f * k).sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.green, style = captionHalo())
                }
            } else {
                Text("${them.uppercase()} HASN'T PICKED", fontSize = (11f * k).sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.label, style = captionHalo())
            }
        }

        // The last round, revealed: ROCK... PAPER... SCISSORS... SHOOT! (both fists pump), then both cards turn over together to
        // the picks, and only then the winner glows (founder 10-10, iOS RpsReveal).
        // The arena is there from the first frame (two face-down fists on the mat), so round 1's reveal fills it instead of pushing
        // the picks down (founder 10-13: no screen shifting).
        val r = s.rounds.lastOrNull()
        if (r != null) {
            RpsRevealCard(
                round = s.rounds.size, mine = if (me == Side.A) r.a else r.b, theirs = if (me == Side.A) r.b else r.a,
                winner = r.winner, me = me, them = them, scale = k,
            )
        } else {
            RpsRevealCard(round = 0, mine = RpsPick.HIDDEN, theirs = RpsPick.HIDDEN, winner = null, me = me, them = them, static = true, scale = k)
        }

        FriendsLabel("YOUR PICK", modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp * k), modifier = Modifier.fillMaxWidth()) {
            RpsPick.PLAYABLE.forEach { p ->
                val selected = mine == p
                val shape = RoundedCornerShape(16.dp)
                Column(
                    Modifier.weight(1f).height(118.dp * k)
                        .then(
                            if (selected) Modifier.shadow(10.dp, shape, ambientColor = FriendsTiles.purple.copy(alpha = 0.7f), spotColor = FriendsTiles.purple.copy(alpha = 0.7f)).clip(shape).background(FriendsTiles.purple)
                            else Modifier.friendsCard(16.dp, accent = FriendlyKind.RPS.color),
                        )
                        .alpha(if (enabled || selected) 1f else 0.55f)
                        .clickableNoRipple { if (enabled && mine == null) onPick(p) }
                        .padding(8.dp * k),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                ) {
                    Image(painterResource(rpsPiece(p)), p.raw, contentScale = ContentScale.Fit, modifier = Modifier.size(70.dp * k))
                    Text(p.raw.uppercase(), fontSize = (11f * k).sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = if (selected) Color.White else DEEP)
                }
            }
        }
        Text("Both picks flip at once.", fontSize = (12f * k).sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, style = captionHalo())
    }
}

/** The shipped hand art (art_pocket_rps_*). */
private fun rpsPiece(pick: RpsPick): Int = when (pick) {
    RpsPick.ROCK -> R.drawable.art_pocket_rps_rock
    RpsPick.PAPER -> R.drawable.art_pocket_rps_paper
    RpsPick.SCISSORS -> R.drawable.art_pocket_rps_scissors
    RpsPick.HIDDEN -> R.drawable.art_pocket_rps_hidden
}

/** The outlined hands for the ring (art_pocket_rps_*_ring): the same pose with a baked plum outline + shadow. */
private fun rpsRingPiece(pick: RpsPick): Int = when (pick) {
    RpsPick.ROCK -> R.drawable.art_pocket_rps_rock_ring
    RpsPick.PAPER -> R.drawable.art_pocket_rps_paper_ring
    RpsPick.SCISSORS -> R.drawable.art_pocket_rps_scissors_ring
    RpsPick.HIDDEN -> R.drawable.art_pocket_rps_hidden_ring
}

/**
 * The ring art's size so the visible hand matches the plain art shown at 56 dp (long side): each ring file is the plain
 * hand plus outline/padding, so it scales by the same dp-per-pixel as its plain twin (plain px -> ring px below).
 */
private fun rpsRingSize(pick: RpsPick): Pair<Dp, Dp> {
    // (plain w, plain h, ring w, ring h) in pixels
    val d = when (pick) {
        RpsPick.ROCK -> floatArrayOf(230f, 206f, 262f, 238f)
        RpsPick.PAPER -> floatArrayOf(247f, 278f, 287f, 318f)
        RpsPick.SCISSORS -> floatArrayOf(215f, 284f, 247f, 316f)
        RpsPick.HIDDEN -> floatArrayOf(222f, 281f, 254f, 313f)
    }
    val f = 56f / maxOf(d[0], d[1])
    return Pair((d[2] * f).dp, (d[3] * f).dp)
}

/** The words of the suspense beat (index 3 = SHOOT!). */
private val RPS_WORDS = listOf("ROCK...", "PAPER...", "SCISSORS...", "SHOOT!")

/**
 * Founder 10-10 (iOS RpsReveal): the last round, revealed with suspense. Both fists pump three times (0.4 s each, a light tick on
 * each) as ROCK... PAPER... SCISSORS... pop in the middle slot, SHOOT! (gold, bigger) lands, then both cards turn over together
 * around the vertical axis (only the art turns; labels never mirror), a heavy thump, a success buzz if you won, and only then
 * the winner's glow. Reduce Motion: the cards simply show the result.
 */
@Composable
private fun RpsRevealCard(round: Int, mine: RpsPick, theirs: RpsPick, winner: Side?, me: Side, them: String, static: Boolean = false, scale: Float = 1f) {
    val still = WTheme.reducedMotion || static
    var beat by remember(round) { mutableIntStateOf(-1) }
    var flipped by remember(round) { mutableStateOf(still) }
    val bob = remember(round) { Animatable(0f) }
    val turn = remember(round) { Animatable(if (still) 0f else 180f) }
    val pop = remember(round) { Animatable(if (still) 1f else 0.85f) }
    LaunchedEffect(round) {
        if (still) return@LaunchedEffect
        launch { pop.animateTo(1f, tween(260, easing = FastOutSlowInEasing)) }
        for (i in 0..2) {
            beat = i
            bob.animateTo(-18f, tween(150, easing = FastOutSlowInEasing))
            bob.animateTo(0f, tween(130, easing = androidx.compose.animation.core.FastOutLinearInEasing))
            com.wordocious.app.data.Haptics.light()
            delay(120)
        }
        beat = 3
        com.wordocious.app.data.Haptics.medium()
        delay(220)
        kotlinx.coroutines.coroutineScope {
            launch { turn.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = 0.72f, stiffness = 160f)) }
            delay(180)
            flipped = true
            com.wordocious.app.data.Haptics.heavy()
            if (winner == me) { delay(200); com.wordocious.app.data.Haptics.success() }
        }
    }
    // Founder 10-13: the card is the arena. The audience/spotlight backdrop (art_pocket_rps_backdrop, 1200 x 475) fills it
    // (crop, rounded corners); the ring spans the full card width, bottom-aligned, with no side padding; ROUND N sits on top.
    Box(
        Modifier.fillMaxWidth().graphicsLayer { scaleX = pop.value; scaleY = pop.value }.clip(RoundedCornerShape(16.dp)),
    ) {
        Image(
            painterResource(R.drawable.art_pocket_rps_backdrop), null, contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize().clearAndSetSemantics { },
        )
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "ROUND ${maxOf(round, 1)}", fontSize = (11f * scale).sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = Color.White,
                style = TextStyle(shadow = androidx.compose.ui.graphics.Shadow(Color(0xCC1E0A3C), Offset(0f, 2f), 6f)),
                modifier = Modifier.padding(top = 10.dp, bottom = 6.dp),
            )
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                Image(
                    painterResource(R.drawable.art_pocket_ring), null, contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxWidth().clearAndSetSemantics { },
                )
                // The ring art is open at the front: ropes behind, the outlined hands standing on the mat.
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 26.dp * scale).padding(bottom = 6.dp * scale),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    RevealArt("YOU", mine, glow = flipped && winner == me, angle = turn.value, bob = if (flipped) 0f else bob.value, revealed = flipped, scale = scale)
                    // The middle slot: the countdown words, then (9d) the clash burst between the two hands once they turn over.
                    Box(Modifier.width(64.dp * scale).height(40.dp * scale), contentAlignment = Alignment.Center) {
                        Image(
                            painterResource(R.drawable.art_pocket_clash_burst), null, contentScale = ContentScale.Fit,
                            modifier = Modifier.size(40.dp * scale).alpha(if (flipped) 1f else 0f).clearAndSetSemantics { },
                        )
                        if (!flipped && beat >= 0) {
                            androidx.compose.animation.AnimatedContent(
                                targetState = beat,
                                transitionSpec = {
                                    (androidx.compose.animation.scaleIn(androidx.compose.animation.core.spring(dampingRatio = 0.6f, stiffness = 500f), initialScale = 0.5f) +
                                        androidx.compose.animation.fadeIn(tween(90))) togetherWith androidx.compose.animation.fadeOut(tween(70))
                                },
                                label = "rpsWord",
                            ) { b ->
                                if (b == 3) {
                                    // SHOOT! is big lettering: it keeps the bubble style.
                                    com.wordocious.app.ui.BubbleOneLine(RPS_WORDS[3], com.wordocious.app.ui.HeadlinePalette.LEADERBOARD, 17f, minScale = 0.5f)
                                } else {
                                    // The small count-in words are plain caps (founder 10-10: clean capitals, no outline), one line, same
                                    // slot height; white with the arena's soft shadow so they read on the mat.
                                    FitLine(
                                        RPS_WORDS[b.coerceIn(0, 2)], 13f, 6.5f, Modifier.fillMaxWidth().wrapContentHeight(), FontWeight.Black, Color.White, 0.6.sp,
                                        center = true, shadow = true,
                                    )
                                }
                            }
                        }
                    }
                    RevealArt(them.uppercase(), theirs, glow = flipped && winner == me.other, angle = turn.value, bob = if (flipped) 0f else bob.value, revealed = flipped, scale = scale)
                }
            }
        }
    }
}

@Composable
private fun RevealArt(label: String, pick: RpsPick, glow: Boolean, angle: Float = 0f, bob: Float = 0f, revealed: Boolean = true, scale: Float = 1f) {
    val shape = RoundedCornerShape(14.dp)
    // The pick turns over from the pumping fist: the fist until the turn passes 90 degrees, then the pick; it narrows to its edge
    // mid-turn. Never mirrored (a scale magnitude, not a flip), and only the art turns.
    val c = kotlin.math.cos(Math.toRadians(angle.toDouble())).toFloat()
    val shown = if (c >= 0f) pick else RpsPick.ROCK
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp * scale)) {
        // In the ring the hands stand on the canvas bare (no box); the winner glows behind its hand. The outlined ring art
        // (deep-plum outline + drop shadow baked in, ~8% clear padding) is scaled so the visible hand stays 56 dp, and a static
        // soft ellipse under it grounds it on the mat.
        val ring = rpsRingSize(shown)
        Box(
            Modifier.size(72.dp * scale)
                .then(
                    if (glow) Modifier.background(androidx.compose.ui.graphics.Brush.radialGradient(listOf(FriendsTiles.purple.copy(alpha = 0.6f), Color.Transparent)), androidx.compose.foundation.shape.CircleShape)
                    else Modifier,
                ),
            Alignment.Center,
        ) {
            Box(
                Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp * scale).size(58.dp * scale, 13.dp * scale)
                    .background(
                        androidx.compose.ui.graphics.Brush.radialGradient(listOf(Color(0x6628084F), Color(0x0028084F))),
                        androidx.compose.foundation.shape.CircleShape,
                    ).clearAndSetSemantics { },
            )
            Image(
                painterResource(rpsRingPiece(shown)), if (revealed) pick.raw else "Hidden pick", contentScale = ContentScale.Fit,
                modifier = Modifier.requiredSize(ring.first * scale, ring.second * scale).graphicsLayer {
                    scaleX = maxOf(0.06f, kotlin.math.abs(c))
                    translationY = bob * density
                },
            )
        }
        Text(label, fontSize = (10f * scale).sp, fontWeight = FontWeight.Black, color = Color(0xFF3B0F75), maxLines = 1)
    }
}

// ── Tic-Tac-Tile ────────────────────────────────────────────────────────────

/**
 * The shipped # board (art_pocket_ttt_grid, 780 x 776): a lilac slab with purple bars. Founder 10-13: the pieces go to the
 * cell edges. The cells are the lilac areas between the bars, measured in the art's own pixels (cols 45-256 / 296-479 /
 * 519-735, rows 45-259 / 281-474 / 498-731), so the layout scales with the board width and taps hit those rects.
 */
private const val TTT_W = 780f
private const val TTT_H = 776f
private val TTT_COLS = floatArrayOf(45f, 256f, 296f, 479f, 519f, 735f)
private val TTT_ROWS = floatArrayOf(45f, 259f, 281f, 474f, 498f, 731f)

@Composable
private fun TttBoard(s: TttState, me: Side, them: String, myTurn: Boolean, onCell: (Int) -> Unit) {
    val wc = rememberWidthClass()
    val winning = remember(s, me, myTurn) {
        if (!myTurn) emptySet() else (0..8).filter { i ->
            s.board[i] == null && tttLine(s.board.toMutableList().also { it[i] = me })?.side == me
        }.toSet()
    }
    // J2: the winning three glow once a board is won.
    val won = remember(s.board) { tttLine(s.board)?.cells?.toSet() ?: emptySet() }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            val boardW: Dp = min(maxWidth, 340.dp * pocketBoardScale(wc))
            val k = boardW / TTT_W
            val boardH = TTT_H * k
            val winLine = remember(s.board) { tttLine(s.board)?.cells }
            Box(Modifier.size(boardW, boardH)) {
                Image(
                    painterResource(R.drawable.art_pocket_ttt_grid), null, contentScale = ContentScale.FillBounds,
                    modifier = Modifier.matchParentSize().clearAndSetSemantics { },
                )
                (0 until 9).forEach { i ->
                    val row = i / 3
                    val col = i % 3
                    val x0 = TTT_COLS[col * 2]; val x1 = TTT_COLS[col * 2 + 1]
                    val y0 = TTT_ROWS[row * 2]; val y1 = TTT_ROWS[row * 2 + 1]
                    TttTile(
                        s.board[i], me, Modifier.offset(x = x0 * k, y = y0 * k).size((x1 - x0) * k, (y1 - y0) * k),
                        hint = i in winning, win = i in won,
                        label = "Row ${row + 1}, column ${col + 1}, " + when (s.board[i]) {
                            null -> "empty"; me -> "your X"; else -> "${them}'s O"
                        },
                        enabled = myTurn && s.board[i] == null,
                    ) { onCell(i) }
                }
                // 9d: the won line gets the shipped strike (a soft fade-in; static under Reduce Motion).
                winLine?.let { TttStrike(it, k) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            LegendDot(FriendsTiles.purple, "YOU · X")
            LegendDot(TTT_PINK, "${them.uppercase()} · O")
        }
    }
}

/**
 * A Tic-Tac-Tile cell: bare on the board (the art is the cell); a placed piece (art_pocket_ttt_x / _o) fills the cell to
 * its edges (4% inset) dropping in with the type pop (swell 1.07 over [TileMotion.TYPE_MS]); the winning three get a soft
 * wash, the winning-move hint a dashed outline. Static draws only, no shadows. Reduce Motion: no pop. TalkBack reads [label].
 */
@Composable
private fun TttTile(mark: Side?, me: Side, modifier: Modifier, hint: Boolean, win: Boolean, label: String, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    val tone = if (mark == null || mark == me) FriendsTiles.purple else TTT_PINK
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
        modifier
            .then(if (enabled) Modifier.squishClickable(label = label, onClick = onClick) else Modifier.semantics { contentDescription = label })
            .clip(shape)
            .then(if (win) Modifier.background(tone.copy(alpha = 0.22f)) else Modifier)
            .then(if (hint) Modifier.dashedBorder(2.dp, Color(0xFFF59E0B), 10.dp) else Modifier),
        Alignment.Center,
    ) {
        if (mark != null) {
            Image(
                painterResource(if (mark == me) R.drawable.art_pocket_ttt_x else R.drawable.art_pocket_ttt_o),
                contentDescription = null, contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(0.96f).graphicsLayer { scaleX = pop.value; scaleY = pop.value }.clearAndSetSemantics { },
            )
        }
    }
}

/**
 * The strike across the winning three (art_pocket_ttt_strike, a gold bar with sparkles, ~1.46 : 1): centered on the
 * line's midpoint (in the grid art's pixels, scaled by [k] dp per pixel), long enough to cover the three cells, rotated
 * to the line's angle (rows 0, columns 90, diagonals +-45). A transform-only fade-in over 320 ms.
 */
@Composable
private fun TttStrike(cells: List<Int>, k: Dp) {
    fun cx(i: Int) = (TTT_COLS[(i % 3) * 2] + TTT_COLS[(i % 3) * 2 + 1]) / 2f
    fun cy(i: Int) = (TTT_ROWS[(i / 3) * 2] + TTT_ROWS[(i / 3) * 2 + 1]) / 2f
    val first = cells.first()
    val last = cells.last()
    val dx = cx(last) - cx(first)
    val dy = cy(last) - cy(first)
    val cell = 200f
    val len = (hypot(dx, dy) + cell * 0.9f) * k
    val h = len * (244f / 356f)
    val mx = (cx(first) + cx(last)) / 2f * k
    val my = (cy(first) + cy(last)) / 2f * k
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
        Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.sub, maxLines = 1, style = captionHalo())
    }
}

// ── Call It ─────────────────────────────────────────────────────────────────

@Composable
private fun CoinBoard(gameId: String, s: CoinState, me: Side, them: String, myTurn: Boolean, onCall: (CoinFace) -> Unit) {
    val wc = rememberWidthClass()
    val last = s.rounds.lastOrNull()
    val face = last?.flip ?: CoinFace.HEADS
    // Founder 10-10 (iOS SpinningCoin, "smoother and a bit more suspenseful"): on each NEW flip the coin crouches, launches, turns
    // end over end five times in real 3D (the face is picked per frame from the turn angle; the art squashes to its edge), slowing
    // as it falls (~1.55 s), lands with a squash, a small bounce and a teeter, THEN the gold glow and only then the result line.
    // Haptic ticks slow down with the spin. Reduce Motion: the face, no flip. Everything is a transform read in graphicsLayer.
    val still = WTheme.reducedMotion
    var seen by remember(gameId) { mutableIntStateOf(s.rounds.size) }
    var landedFace by remember(gameId) { mutableStateOf(face) }
    var settled by remember(gameId) { mutableStateOf(true) }
    val angle = remember(gameId) { Animatable(0f) }
    val hop = remember(gameId) { Animatable(0f) }
    val squashA = remember(gameId) { Animatable(1f) }
    val teeter = remember(gameId) { Animatable(0f) }
    val glow = remember(gameId) { Animatable(0f) }
    LaunchedEffect(s.rounds.size) {
        if (s.rounds.size > seen) {
            seen = s.rounds.size
            if (still) { landedFace = face; settled = true; return@LaunchedEffect }
            // Start from the face showing now; end on the result after five whole turns (+ a half if it changes).
            val before = landedFace
            settled = false
            glow.snapTo(0f)
            landedFace = face
            angle.snapTo(if (before == face) 0f else 180f)
            squashA.animateTo(0.86f, tween(140, easing = FastOutSlowInEasing))
            com.wordocious.app.data.Haptics.medium()
            val spin = 1550
            val rise = (spin * 0.46f).toInt()
            val fall = spin - rise
            kotlinx.coroutines.coroutineScope {
                launch { angle.animateTo(1800f, tween(spin, easing = androidx.compose.animation.core.CubicBezierEasing(0.12f, 0.55f, 0.2f, 1f))) }
                launch { squashA.animateTo(1.06f, tween(120, easing = FastOutSlowInEasing)) }
                launch { hop.animateTo(-110f, tween(rise, easing = androidx.compose.animation.core.LinearOutSlowInEasing)) }
                // ticks that slow with the spin
                launch { for (gap in longArrayOf(120, 130, 150, 180, 220, 270, 340)) { delay(gap); com.wordocious.app.data.Haptics.selection() } }
                delay(rise.toLong())
                launch { hop.animateTo(0f, tween(fall, easing = androidx.compose.animation.core.FastOutLinearInEasing)) }
                launch { squashA.animateTo(1f, tween(fall, easing = androidx.compose.animation.core.FastOutLinearInEasing)) }
                delay(fall.toLong())
            }
            // land: a squash + a small bounce, then a teeter before it settles
            com.wordocious.app.data.Haptics.heavy()
            squashA.animateTo(0.88f, tween(80, easing = FastOutSlowInEasing))
            kotlinx.coroutines.coroutineScope {
                launch { squashA.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.5f, stiffness = 500f)) }
                launch { hop.animateTo(-12f, androidx.compose.animation.core.spring(dampingRatio = 0.5f, stiffness = 500f)) }
                delay(140)
                launch { hop.animateTo(0f, tween(140, easing = androidx.compose.animation.core.FastOutLinearInEasing)) }
                teeter.animateTo(7f, tween(160, easing = androidx.compose.animation.core.FastOutSlowInEasing))
                teeter.animateTo(-5f, tween(160, easing = androidx.compose.animation.core.FastOutSlowInEasing))
                launch { teeter.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = 0.6f, stiffness = 400f)) }
                delay(120)
            }
            // the reveal: the glow, the success buzz, and only now the result line
            com.wordocious.app.data.Haptics.success()
            settled = true
            glow.animateTo(1f, tween(300))
            delay(900)
            glow.animateTo(0f, tween(500))
        } else {
            seen = s.rounds.size
            if (settled) landedFace = face
        }
    }
    val c = kotlin.math.cos(Math.toRadians(angle.value.toDouble())).toFloat()
    val other = if (landedFace == CoinFace.HEADS) CoinFace.TAILS else CoinFace.HEADS
    val frame = coinArt2(if (c >= 0f) landedFace else other)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        // Founder 10-13: Call It plays on a theater stage. The backdrop (art_pocket_coin_backdrop, 1200 x 592) fills the card
        // aspect-fill with rounded corners; the velvet stage (art_pocket_coin_stage, 1100 x 472) sits 90% wide at the bottom;
        // the coin floats over the stage's top surface (its centre is ~32% down the stage art) and is never clipped: only the
        // backdrop image clips to the card radius, the coin and its glow draw unclipped above it.
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            val cardW: Dp = min(maxWidth, 360.dp * pocketScale(wc))
            val stageW = cardW * 0.9f
            val stageH = stageW * (472f / 1100f)
            val coin = cardW * 0.34f
            val feetPad = 4.dp + stageH * 0.68f
            // Tablets: the card grows with the stage and the coin's full hop (1.8x coin above its feet), so the coin never rides up over the turn line.
            val cardH = if (wc == WidthClass.COMPACT) cardW * 0.66f else maxOf(cardW * 0.66f, feetPad + coin * 1.8f + 8.dp)
            val hopK = coin.value / 140f
            Box(Modifier.size(cardW, cardH), contentAlignment = Alignment.BottomCenter) {
                Image(
                    painterResource(R.drawable.art_pocket_coin_backdrop), null, contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize().clip(RoundedCornerShape(16.dp)).clearAndSetSemantics { },
                )
                Image(
                    painterResource(R.drawable.art_pocket_coin_stage), null, contentScale = ContentScale.Fit,
                    modifier = Modifier.padding(bottom = 4.dp).size(stageW, stageH).clearAndSetSemantics { },
                )
                // the contact shadow shrinks and fades as the coin rises
                Image(
                    painterResource(R.drawable.art_pocket_coin_shadow), null, contentScale = ContentScale.Fit,
                    modifier = Modifier.padding(bottom = feetPad - coin * 0.12f).size(coin * 0.9f, coin * 0.28f)
                        .graphicsLayer { val up = (-hop.value / 110f).coerceIn(0f, 1f); val k = 1f - 0.3f * up; scaleX = k; scaleY = k; alpha = 0.9f - 0.45f * up }
                        .clearAndSetSemantics { },
                )
                // the coin's own frame: its feet on the stage surface
                Box(Modifier.padding(bottom = feetPad).size(coin), contentAlignment = Alignment.BottomCenter) {
                    // the reveal glow, warm gold behind the coin
                    Box(
                        Modifier.align(Alignment.Center).requiredSize(coin * 1.6f).graphicsLayer { alpha = glow.value; val k = 0.6f + 0.4f * glow.value; scaleX = k; scaleY = k }
                            .drawBehind {
                                drawCircle(
                                    androidx.compose.ui.graphics.Brush.radialGradient(
                                        listOf(Color(0xB3FDE68A), Color(0x00FDE68A)), center = center, radius = size.minDimension / 2f,
                                    ),
                                )
                            }.clearAndSetSemantics { },
                    )
                    // 9d: a won call wears the shipped sparkle ring once the coin has landed (a fade, no spin; static under Reduce Motion).
                    val ringAlpha by androidx.compose.animation.core.animateFloatAsState(
                        if (last?.winner == me && settled) 1f else 0f, tween(if (still) 0 else 320), label = "coinRing",
                    )
                    if (ringAlpha > 0f) {
                        Image(
                            painterResource(R.drawable.art_pocket_coin_sparkle_ring), null, contentScale = ContentScale.Fit,
                            modifier = Modifier.align(Alignment.Center).requiredSize(coin * 1.25f).alpha(ringAlpha).clearAndSetSemantics { },
                        )
                    }
                    // squash / teeter / hop about the feet (outer), the end-over-end turn about the middle (inner)
                    Box(
                        Modifier.fillMaxSize()
                            .graphicsLayer {
                                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
                                scaleX = 2f - squashA.value
                                scaleY = squashA.value
                                rotationZ = teeter.value
                                translationY = hop.value * hopK * density
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        val edge = 1f - kotlin.math.abs(c)
                        Image(
                            painterResource(frame), if (settled) landedFace.raw else "Coin flipping", contentScale = ContentScale.Fit,
                            // it darkens a touch on the far side of the turn
                            colorFilter = androidx.compose.ui.graphics.ColorFilter.colorMatrix(
                                androidx.compose.ui.graphics.ColorMatrix().apply { setToScale(1f - 0.18f * edge, 1f - 0.18f * edge, 1f - 0.18f * edge, 1f) },
                            ),
                            modifier = Modifier.fillMaxSize().graphicsLayer { scaleY = maxOf(0.07f, kotlin.math.abs(c)) },
                        )
                    }
                }
            }
        }
        // The result line's slot is held from the start (empty before round 1), and the call slot is one fixed band in both turns,
        // so the stage, the buttons and the stake never move (founder 10-13: no screen shifting).
        Box(Modifier.fillMaxWidth().height(18.dp), Alignment.Center) {
            last?.let { r ->
                // The result line appears only once the coin has landed (no spoiler mid-flip).
                val lineAlpha by androidx.compose.animation.core.animateFloatAsState(if (settled) 1f else 0f, tween(if (still) 0 else 250), label = "coinLine")
                Text(
                    "${r.flip.raw.uppercase()} · ${if (r.winner == me) "YOU TAKE ROUND ${s.rounds.size}" else "${them.uppercase()} TAKES ROUND ${s.rounds.size}"}",
                    fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = DEEP, maxLines = 1,
                    modifier = Modifier.alpha(lineAlpha),
                )
            }
        }
        Column(Modifier.fillMaxWidth().height(96.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
    val wc = rememberWidthClass()
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        // Founder 10-13: the guesses live on the puzzle-piece tray (art_pocket_pass_tray, 770 x 914: knobs top + right, notch left +
        // bottom). Its body is x 62-620, y 176-829; the six rows (a small marker + five tiles) sit centered as ONE group in that
        // body, the marker close to the tiles (gap ~12% of a tile). Tile size comes from the body width (marker 0.6 + gap 0.12 +
        // 5 tiles + 4 gaps of 0.1) and the body height (6 tiles + 5 gaps), whichever binds.
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            // The whole tray stays on screen above the pinned keyboard: width capped so its height fits the room left under the
            // turn pill (less the tray's padding and the line under it); aspect kept, so it narrows on short phones.
            val room = LocalBoardMaxH.current
            val capW: Dp = if (room == Dp.Unspecified) 340.dp else maxOf(120.dp, (room - 22.dp - 4.dp) * (770f / 914f))
            val trayW: Dp = min(min(maxWidth, 340.dp * pocketBoardScale(wc)), capW)
            val k = trayW / 770f
            val trayH = 914f * k
            val bodyW = (620f - 62f) * k
            val bodyH = (829f - 176f) * k
            val t: Dp = min(bodyW / 6.2f, bodyH / 6.5f) * 0.97f
            val gap = t * 0.1f
            val marker = t * 0.6f
            val groupW = marker + t * 0.12f + t * 5 + gap * 4
            val groupH = t * 6 + gap * 5
            // the group's top-left inside the tray: centered on the body rect
            val gx = 62f * k + (bodyW - groupW) / 2
            val gy = 176f * k + (bodyH - groupH) / 2
            Box(Modifier.size(trayW, trayH)) {
                Image(
                    painterResource(R.drawable.art_pocket_pass_tray), null, contentScale = ContentScale.FillBounds,
                    modifier = Modifier.matchParentSize().clearAndSetSemantics { },
                )
                Column(Modifier.offset(x = gx, y = gy), verticalArrangement = Arrangement.spacedBy(gap)) {
                    (0 until PASS_MAX_GUESSES).forEach { row ->
                        val g = s.guesses.getOrNull(row)
                        val typingRow = g == null && row == s.guesses.size && myTurn
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // the marker: a gold ring, holding the guesser's face once the row is played
                            Box(Modifier.size(marker), Alignment.Center) {
                                when {
                                    g != null && g.by == me -> FriendFace(profile?.username ?: "You", profile?.avatarUrl, profile?.avatarEmoji, marker, online = false, accentHex = profile?.accentColor)
                                    g != null -> FriendFace(opp.username, opp.avatarUrl, opp.avatarEmoji, marker, online = false)
                                    else -> Box(Modifier.size(marker * 0.8f).border(1.5.dp, Color(0xFFFBBF24), androidx.compose.foundation.shape.CircleShape).clearAndSetSemantics { })
                                }
                            }
                            Spacer(Modifier.width(t * 0.12f))
                            Row(horizontalArrangement = Arrangement.spacedBy(gap)) { (0 until 5).forEach { i ->
                                val t5 = if (g != null) (g.tiles.getOrNull(i) ?: TileState.ABSENT) else null
                                val ch = if (g != null) g.word.getOrNull(i) else if (typingRow) typed.getOrNull(i) else null
                                // 9d: the shipped tiles (purple = right spot, gold = wrong spot, white = not in the word / still empty).
                                Box(Modifier.size(t), Alignment.Center) {
                                    Image(
                                        painterResource(when (t5) {
                                            TileState.CORRECT -> R.drawable.art_pocket_tile_purple
                                            TileState.PRESENT -> R.drawable.art_pocket_tile_gold
                                            else -> R.drawable.art_pocket_tile_white
                                        }),
                                        null, contentScale = ContentScale.FillBounds, modifier = Modifier.matchParentSize().clearAndSetSemantics { },
                                    )
                                    if (ch != null) {
                                        Text(
                                            ch.toString(), fontSize = (t.value * 0.46f).sp, fontWeight = FontWeight.Black,
                                            color = when (t5) { TileState.CORRECT -> Color(0xFF3B0764); TileState.PRESENT -> Color(0xFF5B3A00); else -> TILE_INK },
                                        )
                                    }
                                }
                            } }
                        }
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(24.dp), Alignment.Center) {
            if (answer != null) {
                Text("THE WORD WAS ${answer.uppercase()}", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = DEEP, maxLines = 1, style = captionHalo())
            } else if (whoseTurn(s) != null && !myTurn) {
                FriendsLabel("${opp.username.uppercase()} IS GUESSING")
            }
        }
        // The keyboard stays put (quiet on their turn, gone only when the game is over) so the tray above never resizes.
        if (whoseTurn(s) != null) PinKeyboard {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            KEY_ROWS.forEachIndexed { r, keys ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                    if (r == 2) {
                        KeyCap("ENTER", Modifier.weight(1.6f), bg = FriendsPink.solid, ink = Color.White, enabled = myTurn && !busy && typed.length == 5) { onGuess(typed) }
                    }
                    keys.forEach { k ->
                        val st = best[k]
                        KeyCap(
                            k.toString(), Modifier.weight(1f),
                            bg = st?.let { tileColor(it) } ?: KEY_FACE,
                            ink = if (st == null) DEEP else Color.White,
                            enabled = myTurn && !busy,
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
}

/** B2 a key as a tile: a light lilac face (or its state color) on a thicker lip, squishing on tap. */
@Composable
private fun KeyCap(label: String, modifier: Modifier, bg: Color, ink: Color, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier.height(LocalKeyH.current)
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
        modifier.height(LocalKeyH.current)
            .squishClickable(label = "Delete", onClick = onClick)
            .clip(shape).background(keyLip(KEY_FACE))
            .padding(bottom = 3.dp)
            .clip(shape).background(KEY_FACE),
        Alignment.Center,
    ) { Icon(Icons.AutoMirrored.Filled.Backspace, null, tint = PocketNight.purpleInk(), modifier = Modifier.size(22.dp)) }
}

/** B2 the keys' light lilac face. */
private val KEY_FACE: Color get() = PocketNight.keyFace()

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
        // Founder 10-13: the fragment sits on the ghost tray (art_pocket_ghost_tray, 1200 x 307, the face on the left). Its plum panel
        // is x 256-1078, y 101-226; the letter tiles are centered in it. Every letter is purple, the newest gold; on your turn a
        // dashed gold outline marks the next slot (it shows the picked letter).
        val count = s.fragment.length + 1 // the next slot's room is always counted, so the tiles keep their size from turn to turn
        BoxWithConstraints(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
            val trayW: Dp = maxWidth
            val k = trayW / 1200f
            val trayH = 307f * k
            val panelW = (1078f - 256f) * k
            val panelH = (226f - 101f) * k
            // tiles: ~82% of the panel's height (founder 10-13: 80-85%), shrinking so `count` tiles + 12% gaps fit its width
            val tile: Dp = min(panelH * 0.82f, panelW * 0.94f / (count + 0.12f * (count - 1)))
            val gap = tile * 0.12f
            Box(Modifier.size(trayW, trayH)) {
                Image(
                    painterResource(R.drawable.art_pocket_ghost_tray), null, contentScale = ContentScale.FillBounds,
                    modifier = Modifier.matchParentSize().clearAndSetSemantics { },
                )
                Box(Modifier.offset(x = 256f * k, y = 101f * k).size(panelW, panelH), Alignment.Center) {
                    if (s.fragment.isEmpty() && !myTurn) {
                        Text(
                            if (whoseTurn(s) != null) "${them.uppercase()} STARTS THE WORD" else "THE ROUNDS ARE IN",
                            fontSize = (11f * pocketScale(rememberWidthClass())).sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color.White.copy(alpha = 0.9f), maxLines = 1,
                        )
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.CenterVertically) {
                            s.fragment.forEachIndexed { i, ch -> PlayerTile(ch, mine = i != s.fragment.lastIndex, tile, tile * 0.2f) }
                            if (myTurn) {
                                Box(
                                    Modifier.size(tile).clip(RoundedCornerShape(tile * 0.2f)).then(if (picked != null) Modifier.background(Color(0x33FBBF24)) else Modifier)
                                        .dashedBorder(2.dp, Color(0xFFFBBF24), tile * 0.2f),
                                    Alignment.Center,
                                ) { Text(picked?.toString() ?: "", fontSize = (tile.value * 0.46f).sp, fontWeight = FontWeight.Black, color = Color(0xFFFDE68A)) }
                            }
                        }
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(18.dp), Alignment.Center) {
            if (whoseTurn(s) != null && !myTurn) FriendsLabel("${them.uppercase()} IS PICKING A LETTER")
        }

        // The last round's result ("GHOST - Doug spelled a word" / "QZ - no word starts with that") REPLACES the hint in ONE fixed
        // slot, so a finished round never pushes the board (founder 10-13: no screen shifting).
        Box(Modifier.fillMaxWidth().height(112.dp), Alignment.Center) {
            val r = s.rounds.lastOrNull()
            if (r == null) {
                Text(
                    "Spell a word and you lose the round. Leave a dead end and you lose it too.",
                    fontSize = (12f * pocketScale(rememberWidthClass())).sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, textAlign = TextAlign.Center, style = captionHalo(),
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
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
                        textAlign = TextAlign.Center, maxLines = 1,
                    )
                }
            }
        }

        if (whoseTurn(s) != null) PinKeyboard {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            KEY_ROWS.forEach { keys ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                    if (keys.length < 10) Spacer(Modifier.weight((10 - keys.length) / 2f))
                    keys.forEach { k ->
                        val on = picked == k
                        KeyCap(k.toString(), Modifier.weight(1f), bg = if (on) FriendsTiles.purple else KEY_FACE, ink = if (on) Color.White else DEEP, enabled = myTurn && !busy) { picked = k }
                    }
                    if (keys.length < 10) Spacer(Modifier.weight((10 - keys.length) / 2f))
                }
            }
            val letter = picked
            CandyButton(
                if (letter != null) "ADD $letter" else "PICK A LETTER",
                onClick = { if (letter != null && !busy) onLetter(letter) },
                color = CandyColor.PURPLE, size = CandySize.LARGE,
                enabled = myTurn && letter != null && !busy, modifier = Modifier.fillMaxWidth(), fill = true,
            )
            }
        }
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
    val pk = pocketScale(rememberWidthClass())
    val dens = androidx.compose.ui.platform.LocalDensity.current
    // The needed first letter is pre-filled and locked; a landed word resets the row.
    var typed by remember(gameId, s.words.size) { mutableStateOf(needed?.toString() ?: "") }
    val locked = if (needed != null) 1 else 0
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        // Founder 10-13: the chain hangs on the gold chain board (art_pocket_chain_board, 1100 x 581; interior x 110-985, y 206-462).
        ChainStairs(s, me)
        // The entry row's slot is ONE fixed 40 dp band in both turns (the tiles shrink inside it, in place; on their turn it holds the
        // "needs a word" line), so neither the row nor anything under it ever moves.
        BoxWithConstraints(
            Modifier.fillMaxWidth().height(40.dp * pk)
                .onGloballyPositioned { com.wordocious.app.data.PocketDemo.bounds("entry", it.positionInRoot().y, it.size.height.toFloat(), dens.density) },
            contentAlignment = Alignment.Center,
        ) {
            if (myTurn) {
                // Your word (5-15 letters): the typed letters plus ONE empty next slot (dashed once the word is long enough to send); the
                // locked first letter stays in its soft purple tile; the tiles shrink smoothly as the word grows so it always fits one row.
                val slots = typed.length + if (typed.length < CHAIN_WORD_MAX) 1 else 0
                val fit = maxWidth / (slots + 0.12f * (slots - 1))
                val target = maxOf(16.dp, min(40.dp * pk, fit))   // floor (×3 parity): a 0-width pass never yields a 0 tile
                val tile by androidx.compose.animation.core.animateDpAsState(target, tween(if (WTheme.reducedMotion) 0 else 120), label = "chainEntry")
                val gap = tile * 0.12f
                val shape = RoundedCornerShape(tile * 0.2f)
                Row(horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.CenterVertically) {
                    (0 until slots).forEach { i ->
                        val ch = typed.getOrNull(i)
                        val isLocked = i < locked
                        val optional = ch == null && i >= WORD_MIN
                        Box(
                            Modifier.size(tile).clip(shape).background(if (isLocked) YOU_TINT else if (ch != null) PocketNight.cell() else PocketNight.cellEmpty())
                                .then(
                                    if (optional) Modifier.dashedBorder(2.dp, PocketNight.cellLine(), tile * 0.2f)
                                    else Modifier.border(2.dp, if (ch != null) PocketNight.purpleInk() else PocketNight.cellLine(), shape),
                                ),
                            Alignment.Center,
                        ) { Text(ch?.toString() ?: "", fontSize = (tile.value * 0.45f).sp, fontWeight = FontWeight.Black, color = if (isLocked) PocketNight.purpleInk() else DEEP, maxLines = 1) }
                    }
                }
            } else if (whoseTurn(s) != null) {
                FriendsLabel(if (needed != null) "${them.uppercase()} NEEDS A WORD WITH $needed" else "${them.uppercase()} IS THINKING")
            }
        }
        // The keyboard stays put (quiet on their turn, gone only when the game is over), so the board above never resizes.
        if (whoseTurn(s) != null) {
            PinKeyboard {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            KEY_ROWS.forEachIndexed { r, keys ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                    if (r == 2) {
                        KeyCap("ENTER", Modifier.weight(1.6f), bg = FriendsPink.solid, ink = Color.White, enabled = myTurn && !busy && typed.length >= WORD_MIN) {
                            // The core's own checks first (length, first letter, repeat); the word list is the server's.
                            when (val res = applyFriendlyMove(s, me, FriendlyMove.Chain(typed))) {
                                is MoveResult.Err -> onError(res.error)
                                is MoveResult.Ok -> onWord(typed)
                            }
                        }
                    }
                    keys.forEach { k ->
                        KeyCap(k.toString(), Modifier.weight(1f), bg = KEY_FACE, ink = DEEP, enabled = myTurn && !busy) { if (typed.length < CHAIN_WORD_MAX) typed += k }
                    }
                    if (r == 2) {
                        DeleteKey(Modifier.weight(1.6f)) { if (typed.length > locked) typed = typed.dropLast(1) }
                    }
                }
            }
            }
            }
        }
        Text(
            "Start with the last letter. No repeats. Each letter scores a point; first to $CHAIN_TARGET wins.",
            fontSize = (12f * pocketScale(rememberWidthClass())).sp, fontWeight = FontWeight.Bold, color = FriendsPink.label, textAlign = TextAlign.Center, style = captionHalo(),
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        )
    }
}

/**
 * The staircase on the chain board: the previous word on top, the newest below, starting under the previous word's last
 * letter and joined to it by the gold link (art_pocket_chain_link, 213 x 458: the same letter ends one word and opens the
 * next). Shows the last two words (three when they fit at a readable size). Tiles are as large as the interior allows
 * (max 36 dp, min 13 dp) with 16% gaps; if the staircase would run past the interior's right edge the new word shifts left
 * as far as needed (to the edge at most) and the link follows the slant from the previous last letter to the new first one.
 * Players keep their colors (purple = you, gold = them). All laid out once, static images.
 */
@Composable
private fun ChainStairs(s: ChainState, me: Side) {
    val tMax = 36f * pocketScale(rememberWidthClass())
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        // Board + entry row + keyboard all fit above the fold: the board's width is capped so its height leaves room for the entry
        // row, the "needs a word" line and the hint under it (aspect kept; it narrows on short phones).
        val room = LocalBoardMaxH.current
        // Full content width (like the Ghost tray); only if the height doesn't fit does it narrow, never below 85% of the width.
        val capW: Dp = if (room == Dp.Unspecified) maxWidth else maxOf(maxWidth * 0.85f, (room - 22.dp - 58.dp) * (1100f / 581f))
        val boardW: Dp = min(maxWidth, capW)
        val k = boardW.value / 1100f
        val boardH = 581f * k
        val iw = (985f - 110f) * k
        val ih = (462f - 206f) * k
        val live = whoseTurn(s) != null
        // how many words, and how big the tiles are
        // Long words (either visible word over 10 letters): no staircase. The two rows stack left-aligned across the whole interior,
        // with tighter gaps, so a 15-letter word still gets big tiles; the link runs from the previous last letter to the new first one.
        val longMode = s.words.size >= 2 && s.words.takeLast(2).any { it.word.length > 10 }
        val g = if (longMode) 0.04f else 0.16f
        fun tNatural(n: Int): Float {
            val ws = s.words.takeLast(n)
            val steps = ws.sumOf { it.word.length - 1 }
            return minOf(iw / (steps * (1f + g) + 1f), ih / (1f + 1.4f * (n - 1)), tMax)
        }
        val n: Int
        val t: Float
        if (longMode) {
            n = 2
            val longest = s.words.takeLast(2).maxOf { it.word.length }
            t = minOf(iw / ((longest - 1) * (1f + g) + 1f), ih / 2.4f, tMax)
        }
        else if (s.words.size >= 3 && tNatural(3) >= 18f) { n = 3; t = tNatural(3) }
        else if (s.words.size >= 2) {
            n = 2
            val nat = tNatural(2)
            val longest = s.words.takeLast(2).maxOf { it.word.length }
            t = if (nat >= 18f) nat else maxOf(13f, minOf(ih / 2.4f, iw / ((longest - 1) * (1f + g) + 1f), tMax))
        } else {
            n = s.words.size
            t = if (n == 0) 30f else maxOf(13f, tNatural(1))
        }
        val shown = s.words.takeLast(n)
        val step = t * (1f + g)
        // each word's left edge: the staircase, centered as a group, then pulled back inside the interior
        val natural = FloatArray(n)
        for (i in 1 until n) natural[i] = natural[i - 1] + (shown[i - 1].word.length - 1) * step
        val groupW = if (n == 0) 0f else natural[n - 1] + (shown[n - 1].word.length - 1) * step + t
        val offset = maxOf(0f, (iw - groupW) / 2f)
        val xs = FloatArray(n) { i -> if (longMode) 0f else (offset + natural[i]).coerceIn(0f, maxOf(0f, iw - ((shown[i].word.length - 1) * step + t))) }
        val pitch = t * 1.4f
        val totalH = if (n == 0) 0f else t + pitch * (n - 1) / 1f
        val y0 = (ih - totalH) / 2f
        Box(Modifier.size(boardW, boardH.dp)) {
            Image(
                painterResource(R.drawable.art_pocket_chain_board), null, contentScale = ContentScale.FillBounds,
                modifier = Modifier.matchParentSize().clearAndSetSemantics { },
            )
            Box(Modifier.offset(x = (110f * k).dp, y = (206f * k).dp).size(iw.dp, ih.dp)) {
                if (n == 0) {
                    Text(
                        "Any $WORD_MIN- to $CHAIN_WORD_MAX-letter word opens the chain.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.9f), textAlign = TextAlign.Center,
                        modifier = Modifier.align(Alignment.Center).padding(horizontal = 12.dp),
                    )
                }
                shown.forEachIndexed { wi, w ->
                    val mine = w.by == me
                    val newest = w === s.words.last()
                    Row(
                        Modifier.offset(x = xs[wi].dp, y = (y0 + pitch * wi).dp),
                        horizontalArrangement = Arrangement.spacedBy((t * g).dp),
                    ) {
                        w.word.forEachIndexed { i, ch -> PlayerTile(ch, mine, t.dp, (t * 0.22f).dp, glow = newest && i == w.word.lastIndex && live) }
                    }
                }
                // the links, over the tile edges: one upright link when the word starts under the last letter, else a slanted run
                for (wi in 1 until n) {
                    val ax = xs[wi - 1] + (shown[wi - 1].word.length - 1) * step + t / 2f
                    val ay = y0 + pitch * (wi - 1) + t
                    val bx = xs[wi] + t / 2f
                    val by = y0 + pitch * wi
                    val dx = bx - ax
                    val dy = by - ay
                    val lh = t * 0.8f
                    val lw = lh * (213f / 458f)
                    val dist = hypot(dx, dy)
                    val count = if (kotlin.math.abs(dx) < 1f) 1 else minOf(24, kotlin.math.ceil(dist / (lh * 0.7f)).toInt())
                    val angle = Math.toDegrees(atan2(-dx, dy).toDouble()).toFloat()
                    for (j in 0 until count) {
                        val f = (j + 0.5f) / count
                        val cx = ax + dx * f
                        val cy = ay + dy * f
                        Image(
                            painterResource(R.drawable.art_pocket_chain_link), null, contentScale = ContentScale.Fit,
                            modifier = Modifier.offset(x = (cx - lw / 2f).dp, y = (cy - lh / 2f).dp).size(lw.dp, lh.dp)
                                .graphicsLayer { rotationZ = if (count == 1) 0f else angle }.clearAndSetSemantics { },
                        )
                    }
                }
            }
        }
    }
}
