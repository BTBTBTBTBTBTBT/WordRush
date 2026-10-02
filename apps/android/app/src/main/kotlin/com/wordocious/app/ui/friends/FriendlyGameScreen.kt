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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendlyGamesService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.clickableNoRipple
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
private val GHOST_RED = Color(0xFF9F1239)

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
    var game by remember(gameId) {
        mutableStateOf(
            FriendlyGamesService.active.value.firstOrNull { it.id == gameId }
                ?: FriendlyGamesService.recent.value.firstOrNull { it.id == gameId },
        )
    }
    var busy by remember(gameId) { mutableStateOf(false) }
    var error by remember(gameId) { mutableStateOf<String?>(null) }
    var notFound by remember(gameId) { mutableStateOf(false) }
    var confirmClose by remember { mutableStateOf(false) }

    // 2 s poll while the screen is on and the app is in the foreground.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(gameId) {
        var misses = 0
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                val g = FriendlyGamesService.get(gameId)
                if (g != null) { if (!busy) game = g; misses = 0; notFound = false }
                else if (game == null && ++misses >= 3) notFound = true
                delay(2_000)
            }
        }
    }

    fun send(move: FriendlyMove) {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            when (val r = FriendlyGamesService.move(gameId, move)) {
                is FriendlyGamesService.MoveOutcome.Moved -> game = r.game
                is FriendlyGamesService.MoveOutcome.Rejected -> error = r.message
                is FriendlyGamesService.MoveOutcome.Retry -> {
                    error = r.message
                    FriendlyGamesService.get(gameId)?.let { game = it }
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
    Column(Modifier.fillMaxSize().background(FriendsPink.page)) {
        // Top bar: close (pink) + centered title in the game's gradient.
        Box(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
            Box(Modifier.size(36.dp).clip(CircleShape).clickableNoRipple { requestClose() }.align(Alignment.CenterStart), Alignment.Center) {
                Icon(Icons.Filled.Close, "Close", tint = FriendsPink.solid, modifier = Modifier.size(22.dp))
            }
            Text(
                (game?.title ?: kind.title).uppercase(), fontSize = 19.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, maxLines = 1,
                style = TextStyle(brush = Brush.horizontalGradient(kind.gradient), fontFamily = Nunito),
                modifier = Modifier.align(Alignment.Center).padding(horizontal = 44.dp),
            )
        }
        val g = game
        if (g == null) {
            Box(Modifier.fillMaxSize(), Alignment.Center) {
                if (notFound) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("This game isn't available.", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = FriendsPink.sub)
                        PinkPill("FRIENDS", solid = false, onClick = onFriends)
                    }
                } else CircularProgressIndicator(color = FriendsPink.solid)
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
            ScoreWindow(g, theyOn)
            when (val s = g.state) {
                is RpsState -> RpsBoard(s, g.me, them, enabled = myTurn && !busy) { send(FriendlyMove.Rps(it)) }
                is TttState -> TttBoard(s, g.me, them, myTurn = myTurn && !busy) { send(FriendlyMove.Ttt(it)) }
                is CoinState -> CoinBoard(gameId, s, g.me, them, myTurn = myTurn && !busy) { send(FriendlyMove.Coin(it)) }
                is PassState -> PassBoard(gameId, s, g.me, g.opponent, myTurn = myTurn, busy = busy, answer = g.answer) { send(FriendlyMove.Pass(it)) }
                is GhostState -> GhostBoard(s, g.me, them, myTurn = myTurn, busy = busy) { send(FriendlyMove.Ghost(it.toString())) }
                is ChainState -> ChainBoard(gameId, s, g.me, them, myTurn = myTurn, busy = busy, onError = { error = it }) { send(FriendlyMove.Chain(it)) }
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

    if (confirmClose) {
        AlertDialog(
            onDismissRequest = { confirmClose = false },
            containerColor = Color.White,
            title = { Text("Leave the game?", fontWeight = FontWeight.Black, color = FriendsPink.ink) },
            text = { Text("It waits right here — come back any time. Or resign to end it now.", fontWeight = FontWeight.Bold, color = FriendsPink.sub) },
            confirmButton = {
                Row {
                    TextButton(onClick = {
                        confirmClose = false
                        scope.launch { FriendlyGamesService.resign(gameId)?.let { game = it } }
                    }) { Text("RESIGN", fontWeight = FontWeight.Black, color = Color(0xFFDC2626)) }
                    TextButton(onClick = { confirmClose = false; onClose() }) {
                        Text("LEAVE", fontWeight = FontWeight.Black, color = FriendsPink.solid)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmClose = false }) { Text("KEEP PLAYING", fontWeight = FontWeight.Black, color = FriendsPink.label) }
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
private fun ScoreWindow(g: FriendlyGamesService.GameView, theyOn: Boolean) {
    val won = g.result == "win"
    val lost = g.result == "loss"
    val leftBg = if (won) YOU_WON else YOU_TINT
    val rightBg = if (lost) THEM_WON else THEM_TINT
    val score = scoreOf(g.state)
    val me = AuthService.profile.value
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
            .then(if (won && !WTheme.reducedMotion) Modifier.bannerShimmer() else Modifier),
    ) {
        Column(
            Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f)).padding(start = 12.dp, top = 10.dp, end = 10.dp, bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FriendlyGameIcon(g.kind, 24.dp)
                Text(headlineFor(g), fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, lineHeight = 1.2.em, color = DEEP, maxLines = 2)
            }
            Text(subLineFor(g, theyOn), fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = FriendsPink.mid)
        }
        val turn = if (g.active) whoseTurn(g.state) else null
        Row(Modifier.fillMaxWidth().padding(vertical = 14.dp)) {
            ScoreSide("YOU", me?.username ?: "You", me?.avatarUrl, me?.avatarEmoji, false, score?.get(g.me), turn?.includes(g.me) == true, Modifier.weight(1f))
            ScoreSide("@${g.opponent.username.uppercase()}", g.opponent.username, g.opponent.avatarUrl, g.opponent.avatarEmoji, theyOn, score?.get(g.me.other), turn?.includes(g.me.other) == true, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ScoreSide(label: String, name: String, url: String?, emoji: String?, online: Boolean, score: Int?, toPlay: Boolean, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        // The half whose turn it is wears a small TO PLAY marker (an invisible one keeps both halves level).
        Text(
            "TO PLAY", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = Color.White, maxLines = 1,
            modifier = Modifier.alpha(if (toPlay) 1f else 0f).clip(RoundedCornerShape(50)).background(FriendsPink.solid)
                .padding(horizontal = 7.dp, vertical = 2.dp),
        )
        FriendFace(name, url, emoji, 44.dp, online = online)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = DEEP, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (score != null) Text("$score", fontSize = 30.sp, fontWeight = FontWeight.Black, color = DEEP)
    }
}

// ── Rock Paper Scissors ─────────────────────────────────────────────────────

@Composable
private fun RpsBoard(s: RpsState, me: Side, them: String, enabled: Boolean, onPick: (RpsPick) -> Unit) {
    val theirs = s.picks[me.other]
    val mine = s.picks[me]
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        // Their card, face down.
        Box(
            Modifier.size(104.dp, 118.dp).shadow(4.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x224C1D95), spotColor = Color(0x224C1D95))
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.linearGradient(listOf(FriendsPink.soft, FriendsPink.lavender))),
            Alignment.Center,
        ) { Text("?", fontSize = 48.sp, fontWeight = FontWeight.Black, color = FriendsPink.solid.copy(alpha = 0.7f)) }
        if (theirs == RpsPick.HIDDEN) {
            Text("✓ ${them.uppercase()} PICKED", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = FriendsPink.green)
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
                    Text("vs", fontSize = 13.sp, fontWeight = FontWeight.Black, color = FriendsPink.label)
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
                            else Modifier.friendsCard(16.dp),
                        )
                        .alpha(if (enabled || selected) 1f else 0.55f)
                        .clickableNoRipple { if (enabled && mine == null) onPick(p) }
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                ) {
                    Image(painterResource(rpsArt(p)), p.raw, contentScale = ContentScale.Fit, modifier = Modifier.size(70.dp))
                    Text(p.raw.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = if (selected) Color.White else DEEP)
                }
            }
        }
        Text("Both picks flip at once.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = FriendsPink.label)
    }
}

@Composable
private fun RevealArt(label: String, pick: RpsPick, glow: Boolean) {
    val shape = RoundedCornerShape(14.dp)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier.size(72.dp)
                .then(
                    if (glow) Modifier.shadow(10.dp, shape, ambientColor = FriendsTiles.purple.copy(alpha = 0.8f), spotColor = FriendsTiles.purple.copy(alpha = 0.8f)).clip(shape).background(FriendsTiles.purple)
                    else Modifier.clip(shape).background(FriendsPink.page),
                ),
            Alignment.Center,
        ) { Image(painterResource(rpsArt(pick)), pick.raw, contentScale = ContentScale.Fit, modifier = Modifier.size(56.dp)) }
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
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            val tile: Dp = min(98.dp, (maxWidth - 20.dp) / 3)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                (0 until 3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        (0 until 3).forEach { col ->
                            val i = row * 3 + col
                            TttTile(s.board[i], me, tile, hint = i in winning, enabled = myTurn && s.board[i] == null) { onCell(i) }
                        }
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            LegendDot(FriendsTiles.purple, "YOU · X")
            LegendDot(FriendsTiles.amber, "${them.uppercase()} · O")
        }
    }
}

@Composable
private fun TttTile(mark: Side?, me: Side, size: Dp, hint: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val bg = when (mark) { null -> Color.White; me -> FriendsTiles.purple; else -> FriendsTiles.amber }
    val glow = when {
        mark == me -> FriendsTiles.purple.copy(alpha = 0.5f)
        mark != null -> FriendsTiles.amber.copy(alpha = 0.5f)
        hint -> FriendsTiles.purple.copy(alpha = 0.55f)
        else -> Color(0x184C1D95)
    }
    Box(
        Modifier.size(size).shadow(if (hint) 10.dp else 4.dp, shape, ambientColor = glow, spotColor = glow).clip(shape).background(bg)
            .then(if (hint) Modifier.dashedBorder(2.dp, FriendsTiles.purple, 16.dp) else Modifier)
            .clickableNoRipple { if (enabled) onClick() },
        Alignment.Center,
    ) {
        if (mark != null) {
            Canvas(Modifier.size(size * 0.42f)) {
                val w = 4.dp.toPx()
                if (mark == me) {
                    drawLine(Color.White, Offset(0f, 0f), Offset(this.size.width, this.size.height), w, StrokeCap.Round)
                    drawLine(Color.White, Offset(this.size.width, 0f), Offset(0f, this.size.height), w, StrokeCap.Round)
                } else {
                    drawCircle(Color.White, this.size.minDimension / 2f - w / 2f, style = Stroke(w))
                }
            }
        }
    }
}

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
    val angle = spin.value * 1800f
    val shown = if (((angle / 180f).toInt()) % 2 == 0) face else if (face == CoinFace.HEADS) CoinFace.TAILS else CoinFace.HEADS
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        Image(
            painterResource(coinArt(shown)), shown.raw, contentScale = ContentScale.Fit,
            modifier = Modifier.size(150.dp).graphicsLayer { rotationY = angle; cameraDistance = 14f * density },
        )
        last?.let { r ->
            Text(
                "${r.flip.raw.uppercase()} · ${if (r.winner == me) "YOU TAKE ROUND ${s.rounds.size}" else "${them.uppercase()} TAKES ROUND ${s.rounds.size}"}",
                fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = DEEP,
            )
        }
        if (myTurn) {
            FriendsLabel("YOUR CALL")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(FriendsTiles.purple)
                        .clickableNoRipple { onCall(CoinFace.HEADS) }.padding(vertical = 14.dp),
                    Alignment.Center,
                ) { Text("HEADS", fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color.White) }
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(FriendsPink.lavender)
                        .clickableNoRipple { onCall(CoinFace.TAILS) }.padding(vertical = 14.dp),
                    Alignment.Center,
                ) { Text("TAILS", fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color(0xFF6D28D9)) }
            }
        } else if (whoseTurn(s) != null) {
            FriendsLabel("${them.uppercase()} CALLS")
        }
        FriendsLabel("WHAT'S ON THE LINE")
        Text(
            s.stake, fontSize = 12.sp, fontWeight = FontWeight.Black, color = FriendsPink.solid,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.White)
                .border(2.dp, FriendsPink.solid, RoundedCornerShape(50)).padding(horizontal = 14.dp, vertical = 7.dp),
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
                        g != null && g.by == me -> FriendFace(profile?.username ?: "You", profile?.avatarUrl, profile?.avatarEmoji, 24.dp, online = false)
                        g != null -> FriendFace(opp.username, opp.avatarUrl, opp.avatarEmoji, 24.dp, online = false)
                    }
                }
                (0 until 5).forEach { i ->
                    val shape = RoundedCornerShape(8.dp)
                    if (g != null) {
                        val t = g.tiles.getOrNull(i) ?: TileState.ABSENT
                        Box(Modifier.size(44.dp).clip(shape).background(tileColor(t)), Alignment.Center) {
                            Text(g.word.getOrNull(i)?.toString() ?: "", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White)
                        }
                    } else {
                        val ch = if (typingRow) typed.getOrNull(i) else null
                        Box(
                            Modifier.size(44.dp).clip(shape).background(Color.White)
                                .border(if (typingRow) 2.dp else 1.5.dp, if (typingRow && ch != null) FriendsTiles.purple else Color(0xFFE5E7EB), shape),
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
                            bg = st?.let { tileColor(it) } ?: Color.White,
                            ink = if (st == null) DEEP else Color.White,
                            enabled = !busy,
                        ) { if (typed.length < 5) typed += k }
                    }
                    if (r == 2) {
                        Box(
                            Modifier.weight(1.6f).height(46.dp).clip(RoundedCornerShape(8.dp)).background(Color.White)
                                .clickableNoRipple { if (typed.isNotEmpty()) typed = typed.dropLast(1) },
                            Alignment.Center,
                        ) { Icon(Icons.AutoMirrored.Filled.Backspace, "Delete", tint = DEEP, modifier = Modifier.size(18.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun KeyCap(label: String, modifier: Modifier, bg: Color, ink: Color, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier.height(46.dp).shadow(1.dp, RoundedCornerShape(8.dp)).clip(RoundedCornerShape(8.dp)).background(bg)
            .alpha(if (enabled) 1f else 0.5f)
            .clickableNoRipple { if (enabled) onClick() },
        Alignment.Center,
    ) { Text(label, fontSize = if (label.length > 1) 11.sp else 15.sp, fontWeight = FontWeight.Black, color = ink, maxLines = 1) }
}

// ── Ghost (§9) ──────────────────────────────────────────────────────────────

/** A letter tile colored by who played it (yours purple, theirs amber), white letter. */
@Composable
private fun PlayerTile(letter: Char, mine: Boolean, size: Dp, radius: Dp, glow: Boolean = false) {
    val shape = RoundedCornerShape(radius)
    val c = if (mine) FriendsTiles.purple else FriendsTiles.amber
    Box(
        Modifier.size(size)
            .shadow(if (glow) 10.dp else 2.dp, shape, ambientColor = c.copy(alpha = if (glow) 0.9f else 0.35f), spotColor = c.copy(alpha = if (glow) 0.9f else 0.35f))
            .clip(shape).background(c)
            .then(if (glow) Modifier.border(2.dp, Color.White, shape) else Modifier),
        Alignment.Center,
    ) { Text(letter.toString(), fontSize = (size.value * 0.46f).sp, fontWeight = FontWeight.Black, color = Color.White) }
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
                            Modifier.size(tile).clip(RoundedCornerShape(10.dp)).background(if (picked != null) YOU_TINT else Color.White)
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
                        KeyCap(k.toString(), Modifier.weight(1f), bg = if (on) FriendsTiles.purple else Color.White, ink = if (on) Color.White else DEEP, enabled = !busy) { picked = k }
                    }
                    if (keys.length < 10) Spacer(Modifier.weight((10 - keys.length) / 2f))
                }
            }
            val letter = picked
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(GHOST_RED)
                    .alpha(if (letter != null && !busy) 1f else 0.5f)
                    .clickableNoRipple { if (letter != null && !busy) onLetter(letter) }
                    .padding(horizontal = 16.dp, vertical = 13.dp),
                Alignment.Center,
            ) {
                Text(
                    if (letter != null) "ADD $letter" else "PICK A LETTER", fontSize = 14.sp, fontWeight = FontWeight.Black,
                    letterSpacing = 0.6.sp, color = Color.White, maxLines = 1,
                )
            }
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
                        Modifier.size(40.dp).clip(shape).background(if (isLocked) YOU_TINT else Color.White)
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
                        KeyCap(k.toString(), Modifier.weight(1f), bg = Color.White, ink = DEEP, enabled = !busy) { if (typed.length < WORD_MAX) typed += k }
                    }
                    if (r == 2) {
                        Box(
                            Modifier.weight(1.6f).height(46.dp).clip(RoundedCornerShape(8.dp)).background(Color.White)
                                .clickableNoRipple { if (typed.length > locked) typed = typed.dropLast(1) },
                            Alignment.Center,
                        ) { Icon(Icons.AutoMirrored.Filled.Backspace, "Delete", tint = DEEP, modifier = Modifier.size(18.dp)) }
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
