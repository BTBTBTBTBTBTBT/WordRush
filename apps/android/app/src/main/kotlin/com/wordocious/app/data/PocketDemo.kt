package com.wordocious.app.data

import android.util.Log
import com.wordocious.app.BuildConfig
import com.wordocious.core.CHAIN_WORD_MAX
import com.wordocious.core.ChainState
import com.wordocious.core.CoinFace
import com.wordocious.core.CoinState
import com.wordocious.core.FriendlyKind
import com.wordocious.core.FriendlyMove
import com.wordocious.core.FriendlyState
import com.wordocious.core.FriendlyWinner
import com.wordocious.core.GhostState
import com.wordocious.core.MoveContext
import com.wordocious.core.MoveResult
import com.wordocious.core.PassState
import com.wordocious.core.RpsPick
import com.wordocious.core.RpsState
import com.wordocious.core.Side
import com.wordocious.core.TttState
import com.wordocious.core.applyFriendlyMove
import com.wordocious.core.friendlyStateFor
import com.wordocious.core.friendlyWinner
import com.wordocious.core.whoseTurn
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * DEBUG / benchmark-only perf + playthrough harness for the pocket games (founder 10-13). Pocket games are two-player and
 * server-driven, so no guest can reach one; this plays one LOCAL game through the real core rules (applyFriendlyMove) with a
 * scripted "Doug" on the other side and no network at all. Started by `--es dressDemo pocket-<kind> [--ez autoplay true]
 * [--el pace 3500]` (MainActivity). With autoplay my side is scripted too, so the whole game plays itself to the finished
 * screen; without it my taps go through the same send path as a real game and Doug answers after a beat.
 *
 * [BuildConfig.POCKET_DEMO] is a constant false in the shipping release build (true only for debug and the debug-signed
 * benchmarkRelease), so R8 strips all of this from what ships.
 */
object PocketDemo {
    val enabled: Boolean get() = BuildConfig.POCKET_DEMO
    const val PREFIX = "debug-pocket-"
    private const val TAG = "PocketDemo"

    fun isDemo(id: String): Boolean = enabled && id.startsWith(PREFIX)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var job: Job? = null
    private var kind = FriendlyKind.RPS
    private var variant = ""
    private var state: FriendlyState = RpsState()
    private var seq = 0
    private var base = 0L
    private var startedAt = 0L

    /** "rps" | "ttt" | "coin" | "pass" | "passfull" | "ghost" | "chain" -> the kind, or null. */
    fun parse(name: String): FriendlyKind? {
        if (!enabled) return null
        val n = name.removePrefix("pocket-")
        return FriendlyKind.entries.firstOrNull { it.raw == n } ?: when (n) {
            "passfull" -> FriendlyKind.PASS
            "chainlong", "chainshort" -> FriendlyKind.CHAIN
            else -> null
        }
    }

    // ── Layout log (no screen shifting): board / keyboard / entry row bounds, logged when they change ─────────

    private val lastBounds = HashMap<String, FloatArray>()

    /** Log [name]'s top (y) and height in dp whenever either moves by more than 0.5 dp; the perf tour reads the max shift. */
    fun bounds(name: String, yPx: Float, hPx: Float, density: Float) {
        if (!enabled) return
        val y = yPx / density
        val h = hPx / density
        val p = lastBounds[name]
        if (p == null || kotlin.math.abs(p[0] - y) > 0.5f || kotlin.math.abs(p[1] - h) > 0.5f) {
            lastBounds[name] = floatArrayOf(y, h)
            Log.i(TAG, "bounds $name y=${"%.1f".format(y)} h=${"%.1f".format(h)} dy=${"%.1f".format(if (p == null) 0f else y - p[0])} dh=${"%.1f".format(if (p == null) 0f else h - p[1])} t=${System.currentTimeMillis() - startedAt}")
        }
    }

    // ── Scripts ─────────────────────────────────────────────────────────────

    private val ghostWords = listOf("STRAND", "PLANT")
    private val coinWinners = listOf(Side.A, Side.B, Side.A, Side.B, Side.A)
    private val chainMine = listOf("STUPENDOUS", "STRAIGHTFORWARD", "LIGHTHOUSE", "YESTERDAY", "FANTASTIC")
    private val chainTheirs = listOf("SERENDIPITOUS", "DEVELOPMENTAL", "EXTRAORDINARY", "YOURSELF")
    private val tttMine = listOf(listOf(0, 4, 8), listOf(0, 4, 8))
    private val tttTheirs = listOf(listOf(1, 2), listOf(1, 2, 3))

    private fun myMove(s: FriendlyState): FriendlyMove? = when (s) {
        is RpsState -> if (s.picks[Side.A] != null) null else FriendlyMove.Rps(listOf(RpsPick.ROCK, RpsPick.PAPER, RpsPick.SCISSORS)[s.rounds.size % 3])
        is TttState -> if (s.turn != Side.A) null else FriendlyMove.Ttt(tttMine[s.games.size.coerceAtMost(1)][s.board.count { it == Side.A }.coerceAtMost(2)])
        is CoinState -> if (s.caller != Side.A) null else FriendlyMove.Coin(if (s.rounds.size % 4 == 0) CoinFace.HEADS else CoinFace.TAILS)
        is PassState -> if (s.turn != Side.A) null else {
            val mine = if (variant == "full") listOf("CRANE", "BLAND", "QUILT") else listOf("CRANE", "BLAND", "PLANT")
            FriendlyMove.Pass(mine[s.guesses.count { it.by == Side.A }.coerceAtMost(2)])
        }
        is GhostState -> if (s.turn != Side.A) null else FriendlyMove.Ghost(ghostWords[s.rounds.size.coerceAtMost(1)][s.fragment.length].toString())
        is ChainState -> if (s.turn != Side.A) null else FriendlyMove.Chain(chainMine[s.words.count { it.by == Side.A }.coerceAtMost(4)])
    }

    private fun theirMove(s: FriendlyState): FriendlyMove? = when (s) {
        is RpsState -> {
            // Doug picks first on rounds 1 and 3 (the "PICKED" face-down fist), after me on round 2.
            val ready = s.picks[Side.B] == null && (s.rounds.size % 2 == 0 || s.picks[Side.A] != null)
            if (!ready) null else FriendlyMove.Rps(listOf(RpsPick.SCISSORS, RpsPick.SCISSORS, RpsPick.PAPER)[s.rounds.size % 3])
        }
        is TttState -> if (s.turn != Side.B) null else {
            val opts = tttTheirs[s.games.size.coerceAtMost(1)]
            val want = opts[s.board.count { it == Side.B }.coerceAtMost(opts.size - 1)]
            FriendlyMove.Ttt(if (s.board[want] == null) want else s.board.indexOfFirst { it == null })
        }
        is CoinState -> if (s.caller != Side.B) null else FriendlyMove.Coin(CoinFace.TAILS)
        is PassState -> if (s.turn != Side.B) null else {
            val theirs = listOf("SLOTH", "GLINT", "FUDGY")
            FriendlyMove.Pass(theirs[s.guesses.count { it.by == Side.B }.coerceAtMost(2)])
        }
        is GhostState -> if (s.turn != Side.B) null else FriendlyMove.Ghost(ghostWords[s.rounds.size.coerceAtMost(1)][s.fragment.length].toString())
        is ChainState -> if (s.turn != Side.B) null else FriendlyMove.Chain(chainTheirs[s.words.count { it.by == Side.B }.coerceAtMost(3)])
    }

    private fun ctxFor(s: FriendlyState, by: Side, move: FriendlyMove): MoveContext {
        val solution = "PLANT"
        return MoveContext(
            random = {
                // Call It: the scripted winner of this round wins the flip.
                val m = move as? FriendlyMove.Coin
                if (m == null) 0.5 else {
                    val want = coinWinners[(s as CoinState).rounds.size.coerceAtMost(4)]
                    val flip = if (want == by) m.call else if (m.call == CoinFace.HEADS) CoinFace.TAILS else CoinFace.HEADS
                    if (flip == CoinFace.HEADS) 0.2 else 0.8
                }
            },
            solution = solution,
            isValidWord = { true },
            isWord = { w -> if (s is GhostState) w in ghostWords else true },
            hasPrefix = { p -> ghostWords.any { it.startsWith(p) } },
        )
    }

    // ── The local game ──────────────────────────────────────────────────────

    /** The viewer's GameView (an open friend pick is hidden until mine is in). */
    private fun view(): FriendlyGamesService.GameView {
        val s = state
        val w = friendlyWinner(s)
        val shown = friendlyStateFor(s, Side.A)
        seq++
        val t = java.time.Instant.ofEpochMilli(base + seq * 50L).toString()
        return FriendlyGamesService.GameView(
            id = PREFIX + kind.raw, kind = kind, title = kind.title, me = Side.A,
            opponent = FriendlyGamesService.Opponent("5d0e0000-0000-4000-8000-000000000013", "Doug", null, null),
            state = shown, status = if (w == null) "active" else "done",
            yourTurn = w == null && whoseTurn(s)?.includes(Side.A) == true,
            result = when (w) { null -> null; FriendlyWinner.A -> "win"; FriendlyWinner.B -> "loss"; FriendlyWinner.DRAW -> "draw" },
            line = "", answer = if (kind == FriendlyKind.PASS && w != null) "PLANT" else null,
            createdAt = t, updatedAt = t,
        )
    }

    private var last: FriendlyGamesService.GameView? = null

    private fun publish() {
        val g = view()
        last = g
        FriendlyGamesService.demoPublish(g)
    }

    /** Apply a move by [by] to the local state. Returns the core's error, or null. */
    private fun apply(by: Side, mv: FriendlyMove): String? {
        val r = applyFriendlyMove(state, by, mv, ctxFor(state, by, mv))
        return when (r) {
            is MoveResult.Err -> r.error
            is MoveResult.Ok -> { state = r.state; publish(); null }
        }
    }

    /** The seed: a fresh game on my turn (a mid-game for Word Chain / Ghost is just the start of the script). */
    fun start(k: FriendlyKind, name: String, autoplay: Boolean, paceMs: Long): String {
        if (!enabled) return ""
        job?.cancel()
        lastBounds.clear()
        kind = k
        variant = if (name.endsWith("full")) "full" else ""
        seq = 0
        base = System.currentTimeMillis()
        startedAt = base
        state = when {
            // Static boards for the long-word layout check: 15 + 13 letters, or 5 + 5, on my turn.
            name.endsWith("chainlong") -> ChainState(listOf(com.wordocious.core.ChainWord(Side.A, "STRAIGHTFORWARD", 15), com.wordocious.core.ChainWord(Side.B, "DEVELOPMENTAL", 13)), Side.A)
            name.endsWith("chainshort") -> ChainState(listOf(com.wordocious.core.ChainWord(Side.A, "CRANE", 5), com.wordocious.core.ChainWord(Side.B, "EAGLE", 5)), Side.A)
            else -> com.wordocious.core.newFriendlyState(k)
        }
        // Ghost / Word Chain start on my turn with an empty board (the script opens the chain); keep it playable.
        publish()
        Log.i(TAG, "start kind=${k.raw} autoplay=$autoplay pace=$paceMs t=0")
        job = if (name.contains("chainlong") || name.contains("chainshort")) null else scope.launch { run(autoplay, paceMs) }
        return PREFIX + k.raw
    }

    /** My tap-driven move (the real send path calls this through FriendlyGamesService.move). */
    fun move(mv: FriendlyMove): FriendlyGamesService.MoveOutcome {
        val err = apply(Side.A, mv)
        return if (err != null) FriendlyGamesService.MoveOutcome.Rejected(err)
        else FriendlyGamesService.MoveOutcome.Moved(last ?: view())
    }

    fun current(): FriendlyGamesService.GameView = last ?: view()

    private suspend fun run(autoplay: Boolean, paceMs: Long) {
        delay(1500) // let the screen show the opening board first
        var lastRounds = roundsOf(state)
        while (true) {
            delay(250)
            val s = state
            if (friendlyWinner(s) != null) {
                Log.i(TAG, "done kind=${kind.raw} t=${System.currentTimeMillis() - startedAt}ms result=${friendlyWinner(s)}")
                break
            }
            val mine = if (autoplay) myMove(s) else null
            val theirs = theirMove(s)
            // Doug answers after a beat; in autoplay my move comes at the pace.
            val acted = when {
                theirs != null -> {
                    delay(if (autoplay) paceMs / 2 else 1100)
                    apply(Side.B, theirs)
                    true
                }
                mine != null -> { delay(paceMs); apply(Side.A, mine); true }
                else -> false
            }
            if (acted) {
                val r = roundsOf(state)
                // A finished round / flip plays an animation: leave it room before the next move.
                if (r > lastRounds && (kind == FriendlyKind.RPS || kind == FriendlyKind.COIN)) delay(4300) else delay(150)
                lastRounds = r
            }
        }
    }

    private fun roundsOf(s: FriendlyState): Int = when (s) {
        is RpsState -> s.rounds.size
        is CoinState -> s.rounds.size
        is TttState -> s.games.size
        is GhostState -> s.rounds.size
        else -> 0
    }
}
