package com.wordocious.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put

// Friends overhaul (founder, 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md):
// Kotlin port of packages/core/src/friendly-games.ts — the four pocket games you
// play with a friend (Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the
// Puzzle) and the two word games that joined the same night (Ghost, Word Chain),
// plus the Friends banner words, friend streaks and the "on now" rule.
//
// The server is the only writer (it runs applyFriendlyMove and stores the
// state); the client decodes the state it is sent, renders it and prints the
// words below. Every string must stay byte-identical to the TS core — pinned by
// FriendlyGamesFixtureTest against friendly-games-fixtures.json.

enum class FriendlyKind(val raw: String) {
    RPS("rps"), TTT("ttt"), COIN("coin"), PASS("pass"), GHOST("ghost"), CHAIN("chain");

    val title: String get() = FRIENDLY_TITLES.getValue(this)

    companion object {
        fun from(raw: String?): FriendlyKind? = values().firstOrNull { it.raw == raw }
    }
}

enum class Side(val raw: String) {
    A("a"), B("b");

    val other: Side get() = if (this == A) B else A

    companion object {
        fun from(raw: String?): Side? = values().firstOrNull { it.raw == raw }
    }
}

/** An RPS pick. [HIDDEN] only ever appears in a viewer's copy: the friend has picked, the value is withheld. */
enum class RpsPick(val raw: String) {
    ROCK("rock"), PAPER("paper"), SCISSORS("scissors"), HIDDEN("hidden");

    companion object {
        fun from(raw: String?): RpsPick? = values().firstOrNull { it.raw == raw }
        val PLAYABLE = listOf(ROCK, PAPER, SCISSORS)
    }
}

enum class CoinFace(val raw: String) {
    HEADS("heads"), TAILS("tails");

    companion object {
        fun from(raw: String?): CoinFace? = values().firstOrNull { it.raw == raw }
    }
}

/** Whose move it is: one side, both (an open RPS round). Null = the game is over. */
enum class FriendlyTurn(val raw: String) {
    A("a"), B("b"), BOTH("both");

    fun includes(me: Side): Boolean = this == BOTH || raw == me.raw

    companion object {
        fun of(side: Side): FriendlyTurn = if (side == Side.A) A else B
    }
}

/** The match result: a side or a draw. Null = still going. */
enum class FriendlyWinner(val raw: String) {
    A("a"), B("b"), DRAW("draw");

    val side: Side? get() = when (this) { A -> Side.A; B -> Side.B; DRAW -> null }

    companion object {
        fun of(side: Side): FriendlyWinner = if (side == Side.A) A else B
    }
}

val FRIENDLY_KINDS: List<FriendlyKind> = listOf(
    FriendlyKind.RPS, FriendlyKind.TTT, FriendlyKind.COIN, FriendlyKind.PASS, FriendlyKind.GHOST, FriendlyKind.CHAIN,
)

val FRIENDLY_TITLES: Map<FriendlyKind, String> = mapOf(
    FriendlyKind.RPS to "Rock Paper Scissors",
    FriendlyKind.TTT to "Tic-Tac-Tile",
    FriendlyKind.COIN to "Call It",
    FriendlyKind.PASS to "Pass the Puzzle",
    FriendlyKind.GHOST to "Ghost",
    FriendlyKind.CHAIN to "Word Chain",
)

/** Wins needed: best of 3 (RPS, Tic-Tac-Tile, Ghost), best of 5 (Call It); Word Chain is points. */
val FRIENDLY_TARGET: Map<FriendlyKind, Int> = mapOf(
    FriendlyKind.RPS to 2, FriendlyKind.TTT to 2, FriendlyKind.COIN to 3, FriendlyKind.PASS to 1,
    FriendlyKind.GHOST to 2, FriendlyKind.CHAIN to 30,
)

/** Call It stakes — a fixed list (no free text). */
val COIN_STAKES: List<String> = listOf("Bragging rights", "Loser picks tonight's VS mode", "Winner goes first next time")

/** Pass the Puzzle shares one Classic board: six guesses between the two players. */
const val PASS_MAX_GUESSES = 6

/** Ghost and Word Chain play on the 5- to 7-letter word lists. */
const val WORD_MIN = 5
const val WORD_MAX = 7

/** Word Chain: a word scores its letters; first to 30 wins. */
const val CHAIN_TARGET = 30

data class FriendlyScore(val a: Int = 0, val b: Int = 0) {
    operator fun get(side: Side): Int = if (side == Side.A) a else b
    fun plus(side: Side, n: Int = 1): FriendlyScore = if (side == Side.A) copy(a = a + n) else copy(b = b + n)
}

data class RpsRound(val a: RpsPick, val b: RpsPick, val winner: Side?)
data class CoinRound(val caller: Side, val call: CoinFace, val flip: CoinFace, val winner: Side)
data class PassGuess(val by: Side, val word: String, val tiles: List<TileState>)

/** Why a Ghost round ended: the loser spelled a word, or left letters no word starts with. */
enum class GhostReason(val raw: String) {
    WORD("word"), DEAD("dead");

    companion object {
        fun from(raw: String?): GhostReason? = values().firstOrNull { it.raw == raw }
    }
}

data class GhostRound(val fragment: String, val loser: Side, val reason: GhostReason)
data class ChainWord(val by: Side, val word: String, val points: Int)

sealed class FriendlyState {
    abstract val kind: FriendlyKind
}

data class RpsState(
    val picks: Map<Side, RpsPick> = emptyMap(),
    val rounds: List<RpsRound> = emptyList(),
    val score: FriendlyScore = FriendlyScore(),
) : FriendlyState() { override val kind get() = FriendlyKind.RPS }

data class TttState(
    /** Nine cells, row by row: null = empty. */
    val board: List<Side?> = List(9) { null },
    val starter: Side = Side.A,
    val turn: Side = Side.A,
    /** The winner of each finished game (null = a drawn board). */
    val games: List<Side?> = emptyList(),
    val score: FriendlyScore = FriendlyScore(),
) : FriendlyState() { override val kind get() = FriendlyKind.TTT }

data class CoinState(
    val caller: Side = Side.A,
    val rounds: List<CoinRound> = emptyList(),
    val score: FriendlyScore = FriendlyScore(),
    val stake: String = COIN_STAKES[0],
) : FriendlyState() { override val kind get() = FriendlyKind.COIN }

data class PassState(
    val turn: Side = Side.A,
    val guesses: List<PassGuess> = emptyList(),
    val solvedBy: Side? = null,
) : FriendlyState() { override val kind get() = FriendlyKind.PASS }

/** Ghost: add a letter each turn. Spell a whole word, or leave letters no word starts with, and you lose the round. */
data class GhostState(
    val fragment: String = "",
    /** Who played each letter of [fragment]. */
    val letters: List<Side> = emptyList(),
    val turn: Side = Side.A,
    val starter: Side = Side.A,
    val rounds: List<GhostRound> = emptyList(),
    val score: FriendlyScore = FriendlyScore(),
) : FriendlyState() { override val kind get() = FriendlyKind.GHOST }

/** Word Chain: each word starts with the last letter of the one before; a word scores its letters. */
data class ChainState(
    val words: List<ChainWord> = emptyList(),
    val turn: Side = Side.A,
    val score: FriendlyScore = FriendlyScore(),
) : FriendlyState() {
    override val kind get() = FriendlyKind.CHAIN

    /** The letter the next word must start with (null = any word opens). */
    val needed: Char? get() = words.lastOrNull()?.word?.lastOrNull()
}

sealed class FriendlyMove {
    abstract val kind: FriendlyKind
    data class Rps(val pick: RpsPick) : FriendlyMove() { override val kind get() = FriendlyKind.RPS }
    data class Ttt(val cell: Int) : FriendlyMove() { override val kind get() = FriendlyKind.TTT }
    data class Coin(val call: CoinFace) : FriendlyMove() { override val kind get() = FriendlyKind.COIN }
    data class Pass(val word: String) : FriendlyMove() { override val kind get() = FriendlyKind.PASS }
    data class Ghost(val letter: String) : FriendlyMove() { override val kind get() = FriendlyKind.GHOST }
    data class Chain(val word: String) : FriendlyMove() { override val kind get() = FriendlyKind.CHAIN }

    /** The wire shape the server expects: `{kind:'rps', pick:'rock'}` … */
    fun toJson(): JsonObject = buildJsonObject {
        put("kind", kind.raw)
        when (this@FriendlyMove) {
            is Rps -> put("pick", pick.raw)
            is Ttt -> put("cell", cell)
            is Coin -> put("call", call.raw)
            is Pass -> put("word", word)
            is Ghost -> put("letter", letter)
            is Chain -> put("word", word)
        }
    }

    companion object {
        fun fromJson(el: JsonElement?): FriendlyMove? {
            val o = el as? JsonObject ?: return null
            return when (FriendlyKind.from(o.str("kind"))) {
                FriendlyKind.RPS -> RpsPick.from(o.str("pick"))?.let { Rps(it) }
                FriendlyKind.TTT -> o.int("cell")?.let { Ttt(it) }
                FriendlyKind.COIN -> CoinFace.from(o.str("call"))?.let { Coin(it) }
                FriendlyKind.PASS -> o.str("word")?.let { Pass(it) }
                FriendlyKind.GHOST -> o.str("letter")?.let { Ghost(it) }
                FriendlyKind.CHAIN -> o.str("word")?.let { Chain(it) }
                null -> null
            }
        }
    }
}

/**
 * Pure inputs for applyFriendlyMove: server randomness for the coin, Pass the
 * Puzzle's answer + word check, and the Ghost / Word Chain word checks.
 */
class MoveContext(
    val random: () -> Double = { Math.random() },
    val solution: String? = null,
    val isValidWord: ((String) -> Boolean)? = null,
    /** Ghost / Word Chain: a 5–7 letter word on the lists (upper case in). */
    val isWord: ((String) -> Boolean)? = null,
    /** Ghost: some 5–7 letter word starts with these letters. */
    val hasPrefix: ((String) -> Boolean)? = null,
    /** Ghost / Word Chain: letters the app never shows (the blocked-term list). */
    val blocked: ((String) -> Boolean)? = null,
)

sealed class MoveResult {
    data class Ok(val state: FriendlyState, val done: Boolean, val winner: FriendlyWinner?) : MoveResult()
    data class Err(val error: String) : MoveResult()
}

/** A fresh game; side `a` is whoever started it. */
fun newFriendlyState(kind: FriendlyKind, stake: String? = null): FriendlyState = when (kind) {
    FriendlyKind.RPS -> RpsState()
    FriendlyKind.TTT -> TttState()
    FriendlyKind.COIN -> CoinState(stake = if (stake != null && stake in COIN_STAKES) stake else COIN_STAKES[0])
    FriendlyKind.PASS -> PassState()
    FriendlyKind.GHOST -> GhostState()
    FriendlyKind.CHAIN -> ChainState()
}

fun rpsBeats(x: RpsPick, y: RpsPick): Boolean =
    (x == RpsPick.ROCK && y == RpsPick.SCISSORS) || (x == RpsPick.PAPER && y == RpsPick.ROCK) || (x == RpsPick.SCISSORS && y == RpsPick.PAPER)

private val LINES = listOf(
    listOf(0, 1, 2), listOf(3, 4, 5), listOf(6, 7, 8), listOf(0, 3, 6),
    listOf(1, 4, 7), listOf(2, 5, 8), listOf(0, 4, 8), listOf(2, 4, 6),
)

data class TttLine(val side: Side, val cells: List<Int>)

/** The winning line on a Tic-Tac-Tile board, if any. */
fun tttLine(board: List<Side?>): TttLine? {
    for (l in LINES) {
        val m = board.getOrNull(l[0]) ?: continue
        if (m == board.getOrNull(l[1]) && m == board.getOrNull(l[2])) return TttLine(m, l)
    }
    return null
}

/** Whose move it is, or null when the game is over. */
fun whoseTurn(s: FriendlyState): FriendlyTurn? {
    if (friendlyWinner(s) != null) return null
    return when (s) {
        is RpsState -> {
            val a = s.picks[Side.A]; val b = s.picks[Side.B]
            if (a != null && b == null) FriendlyTurn.B else if (b != null && a == null) FriendlyTurn.A else FriendlyTurn.BOTH
        }
        is TttState -> FriendlyTurn.of(s.turn)
        is CoinState -> FriendlyTurn.of(s.caller)
        is PassState -> FriendlyTurn.of(s.turn)
        is GhostState -> FriendlyTurn.of(s.turn)
        is ChainState -> FriendlyTurn.of(s.turn)
    }
}

/** The match winner, a draw, or null while it is still going. */
fun friendlyWinner(s: FriendlyState): FriendlyWinner? {
    if (s is PassState) {
        s.solvedBy?.let { return FriendlyWinner.of(it) }
        return if (s.guesses.size >= PASS_MAX_GUESSES) FriendlyWinner.DRAW else null
    }
    val score = scoreOf(s) ?: return null
    val target = FRIENDLY_TARGET.getValue(s.kind)
    if (score.a >= target) return FriendlyWinner.A
    if (score.b >= target) return FriendlyWinner.B
    // Tic-Tac-Tile stops after five games (draws included), Ghost after five rounds: the leader wins.
    if ((s is TttState && s.games.size >= 5) || (s is GhostState && s.rounds.size >= 5)) {
        return if (score.a == score.b) FriendlyWinner.DRAW else if (score.a > score.b) FriendlyWinner.A else FriendlyWinner.B
    }
    return null
}

/** The running score (null for Pass the Puzzle, which has none). */
fun scoreOf(s: FriendlyState): FriendlyScore? = when (s) {
    is RpsState -> s.score
    is TttState -> s.score
    is CoinState -> s.score
    is PassState -> null
    is GhostState -> s.score
    is ChainState -> s.score
}

/** Apply one move by [by]. Pure: randomness and the answer come from [ctx]. */
fun applyFriendlyMove(s: FriendlyState, by: Side, move: FriendlyMove, ctx: MoveContext = MoveContext()): MoveResult {
    if (move.kind != s.kind) return MoveResult.Err("Wrong game")
    if (friendlyWinner(s) != null) return MoveResult.Err("This game is over")
    val turn = whoseTurn(s)
    if (turn != FriendlyTurn.BOTH && turn != FriendlyTurn.of(by)) return MoveResult.Err("Not your turn")
    fun done(state: FriendlyState): MoveResult {
        val w = friendlyWinner(state)
        return MoveResult.Ok(state, w != null, w)
    }

    when {
        s is RpsState && move is FriendlyMove.Rps -> {
            if (s.picks[by] != null) return MoveResult.Err("Already picked")
            val picks = s.picks + (by to move.pick)
            val a = picks[Side.A]; val b = picks[Side.B]
            if (a == null || b == null) return done(s.copy(picks = picks))
            val winner = if (a == b) null else if (rpsBeats(a, b)) Side.A else Side.B
            val score = if (winner != null) s.score.plus(winner) else s.score
            return done(s.copy(picks = emptyMap(), rounds = s.rounds + RpsRound(a, b, winner), score = score))
        }
        s is TttState && move is FriendlyMove.Ttt -> {
            if (move.cell < 0 || move.cell > 8 || s.board[move.cell] != null) return MoveResult.Err("Pick an empty tile")
            val board = s.board.toMutableList().also { it[move.cell] = by }
            val line = tttLine(board)
            if (line != null || board.all { it != null }) {
                val winner = line?.side
                val score = if (winner != null) s.score.plus(winner) else s.score
                val starter = s.starter.other
                return done(s.copy(board = List(9) { null }, starter = starter, turn = starter, games = s.games + winner, score = score))
            }
            return done(s.copy(board = board, turn = by.other))
        }
        s is CoinState && move is FriendlyMove.Coin -> {
            val r = ctx.random()
            val flip = if (r < 0.5) CoinFace.HEADS else CoinFace.TAILS
            val winner = if (flip == move.call) by else by.other
            return done(s.copy(caller = s.caller.other, rounds = s.rounds + CoinRound(by, move.call, flip, winner), score = s.score.plus(winner)))
        }
        s is PassState && move is FriendlyMove.Pass -> {
            val word = move.word.trim().uppercase()
            if (!Regex("^[A-Z]{5}$").matches(word)) return MoveResult.Err("Five letters, please")
            if (ctx.isValidWord != null && !ctx.isValidWord.invoke(word)) return MoveResult.Err("Not in the word list")
            if (s.guesses.any { it.word == word }) return MoveResult.Err("Already guessed")
            val solution = ctx.solution ?: return MoveResult.Err("No puzzle")
            val tiles = evaluateGuess(solution, word).tiles.map { it.state }
            val solved = word == solution.uppercase()
            return done(s.copy(turn = by.other, guesses = s.guesses + PassGuess(by, word, tiles), solvedBy = if (solved) by else null))
        }
        s is GhostState && move is FriendlyMove.Ghost -> {
            val letter = move.letter.trim().uppercase()
            if (!Regex("^[A-Z]$").matches(letter)) return MoveResult.Err("One letter, please")
            val fragment = s.fragment + letter
            if (ctx.blocked?.invoke(fragment) == true) return MoveResult.Err("Try another letter")
            val spelled = fragment.length >= WORD_MIN && ctx.isWord?.invoke(fragment) == true
            val dead = !spelled && ctx.hasPrefix != null && !ctx.hasPrefix.invoke(fragment)
            if (spelled || dead) {
                val starter = s.starter.other
                return done(
                    s.copy(
                        fragment = "", letters = emptyList(), starter = starter, turn = starter,
                        rounds = s.rounds + GhostRound(fragment, by, if (spelled) GhostReason.WORD else GhostReason.DEAD),
                        score = s.score.plus(by.other),
                    ),
                )
            }
            return done(s.copy(fragment = fragment, letters = s.letters + by, turn = by.other))
        }
        s is ChainState && move is FriendlyMove.Chain -> {
            val word = move.word.trim().uppercase()
            if (!Regex("^[A-Z]+$").matches(word) || word.length < WORD_MIN || word.length > WORD_MAX) {
                return MoveResult.Err("$WORD_MIN to $WORD_MAX letters, please")
            }
            val needed = s.needed
            if (needed != null && word[0] != needed) return MoveResult.Err("Start with $needed")
            if (s.words.any { it.word == word }) return MoveResult.Err("Already played")
            if (ctx.blocked?.invoke(word) == true) return MoveResult.Err("Try another word")
            if (ctx.isWord != null && !ctx.isWord.invoke(word)) return MoveResult.Err("Not in the word list")
            val points = word.length
            return done(s.copy(turn = by.other, words = s.words + ChainWord(by, word, points), score = s.score.plus(by, points)))
        }
    }
    return MoveResult.Err("Bad move")
}

/** What the OTHER player may see: an open RPS pick is hidden until both are in. */
fun friendlyStateFor(s: FriendlyState, viewer: Side): FriendlyState {
    if (s !is RpsState) return s
    val theirs = viewer.other
    if (s.picks[theirs] == null) return s
    return s.copy(picks = s.picks + (theirs to RpsPick.HIDDEN))
}

// ── Decoding the server's state (kotlinx.serialization JSON tree) ──────────

private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
private fun JsonObject.int(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull
private fun JsonObject.arr(key: String): List<JsonElement> = (this[key] as? JsonArray) ?: emptyList()
private fun JsonObject.obj(key: String): JsonObject? = this[key] as? JsonObject

private fun decodeScore(o: JsonObject?): FriendlyScore = FriendlyScore(o?.int("a") ?: 0, o?.int("b") ?: 0)

/**
 * Decode a `state` from the server (GameView.state) — tolerant of missing keys.
 * In RPS the friend's open pick arrives as "hidden" (= they have picked).
 */
fun decodeFriendlyState(el: JsonElement?): FriendlyState? {
    val o = el as? JsonObject ?: return null
    return when (FriendlyKind.from(o.str("kind"))) {
        FriendlyKind.RPS -> {
            val p = o.obj("picks")
            val picks = buildMap {
                RpsPick.from(p?.str("a"))?.let { put(Side.A, it) }
                RpsPick.from(p?.str("b"))?.let { put(Side.B, it) }
            }
            val rounds = o.arr("rounds").mapNotNull { r ->
                val ro = r as? JsonObject ?: return@mapNotNull null
                val a = RpsPick.from(ro.str("a")) ?: return@mapNotNull null
                val b = RpsPick.from(ro.str("b")) ?: return@mapNotNull null
                RpsRound(a, b, Side.from(ro.str("winner")))
            }
            RpsState(picks, rounds, decodeScore(o.obj("score")))
        }
        FriendlyKind.TTT -> {
            val cells = o.arr("board").map { Side.from((it as? JsonPrimitive)?.contentOrNull) }
            val board = List(9) { i -> cells.getOrNull(i) }
            TttState(
                board = board,
                starter = Side.from(o.str("starter")) ?: Side.A,
                turn = Side.from(o.str("turn")) ?: Side.A,
                games = o.arr("games").map { Side.from((it as? JsonObject)?.str("winner")) },
                score = decodeScore(o.obj("score")),
            )
        }
        FriendlyKind.COIN -> CoinState(
            caller = Side.from(o.str("caller")) ?: Side.A,
            rounds = o.arr("rounds").mapNotNull { r ->
                val ro = r as? JsonObject ?: return@mapNotNull null
                CoinRound(
                    Side.from(ro.str("caller")) ?: return@mapNotNull null,
                    CoinFace.from(ro.str("call")) ?: return@mapNotNull null,
                    CoinFace.from(ro.str("flip")) ?: return@mapNotNull null,
                    Side.from(ro.str("winner")) ?: return@mapNotNull null,
                )
            },
            score = decodeScore(o.obj("score")),
            stake = o.str("stake") ?: COIN_STAKES[0],
        )
        FriendlyKind.PASS -> PassState(
            turn = Side.from(o.str("turn")) ?: Side.A,
            guesses = o.arr("guesses").mapNotNull { g ->
                val go = g as? JsonObject ?: return@mapNotNull null
                PassGuess(
                    Side.from(go.str("by")) ?: return@mapNotNull null,
                    go.str("word") ?: return@mapNotNull null,
                    go.arr("tiles").map { t ->
                        runCatching { TileState.valueOf(((t as? JsonPrimitive)?.contentOrNull ?: "").uppercase()) }.getOrDefault(TileState.ABSENT)
                    },
                )
            },
            solvedBy = Side.from(o.str("solvedBy")),
        )
        FriendlyKind.GHOST -> GhostState(
            fragment = o.str("fragment") ?: "",
            letters = o.arr("letters").mapNotNull { Side.from((it as? JsonPrimitive)?.contentOrNull) },
            turn = Side.from(o.str("turn")) ?: Side.A,
            starter = Side.from(o.str("starter")) ?: Side.A,
            rounds = o.arr("rounds").mapNotNull { r ->
                val ro = r as? JsonObject ?: return@mapNotNull null
                GhostRound(
                    ro.str("fragment") ?: return@mapNotNull null,
                    Side.from(ro.str("loser")) ?: return@mapNotNull null,
                    GhostReason.from(ro.str("reason")) ?: GhostReason.WORD,
                )
            },
            score = decodeScore(o.obj("score")),
        )
        FriendlyKind.CHAIN -> ChainState(
            words = o.arr("words").mapNotNull { w ->
                val wo = w as? JsonObject ?: return@mapNotNull null
                val word = wo.str("word") ?: return@mapNotNull null
                ChainWord(Side.from(wo.str("by")) ?: return@mapNotNull null, word, wo.int("points") ?: word.length)
            },
            turn = Side.from(o.str("turn")) ?: Side.A,
            score = decodeScore(o.obj("score")),
        )
        null -> null
    }
}

// ── Words every client shows (parity) ───────────────────────────────────────

private fun ago(m: Int): String = when {
    m < 1 -> "just now"
    m < 60 -> "$m min ago"
    m < 60 * 24 -> "${m / 60} h ago"
    else -> "${m / 1440} d ago"
}

/** The one-line status on a game card: "Your move · Doug moved 4 min ago", "You won 2–1". */
fun friendlyCardLine(state: FriendlyState, me: Side, them: String, minutesAgo: Int): String {
    val w = friendlyWinner(state)
    val score = scoreOf(state)
    val mine = score?.get(me) ?: 0
    val theirs = score?.get(me.other) ?: 0
    if (w != null) {
        if (state is PassState) return if (w == FriendlyWinner.DRAW) "Nobody solved it" else if (w.side == me) "You solved it" else "$them solved it"
        if (w == FriendlyWinner.DRAW) return "Draw $mine–$theirs"
        return if (w.side == me) "You won $mine–$theirs" else "$them won $theirs–$mine"
    }
    val myTurn = whoseTurn(state)?.includes(me) == true
    return when (state) {
        is RpsState -> {
            val round = state.rounds.size + 1
            if (myTurn) "Round $round · your pick" else "Round $round · waiting on $them"
        }
        is PassState -> {
            val used = state.guesses.size
            if (myTurn) "Your guess · $used of $PASS_MAX_GUESSES used" else "$them's guess · $used of $PASS_MAX_GUESSES used"
        }
        is CoinState -> if (myTurn) "Your call · $mine–$theirs" else "$them calls next · $mine–$theirs"
        is TttState -> if (myTurn) "Your move · $them moved ${ago(minutesAgo)}" else "Waiting on $them · $mine–$theirs"
        is GhostState -> if (myTurn) (if (state.fragment.isNotEmpty()) "Your letter · ${state.fragment}" else "Your letter · start it") else "Waiting on $them · $mine–$theirs"
        is ChainState -> {
            val needed = state.needed
            if (myTurn) (if (needed != null) "Your word · starts with $needed" else "Your word · any word") else "$them's word · $mine–$theirs"
        }
    }
}

/** The big headline on the game screen: "ROUND 2", "YOUR MOVE", "YOU WIN!". */
fun friendlyHeadline(s: FriendlyState, me: Side): String {
    val w = friendlyWinner(s)
    if (w != null) {
        return if (w == FriendlyWinner.DRAW) (if (s is PassState) "NOBODY SOLVED IT" else "IT'S A DRAW")
        else if (w.side == me) "YOU WIN!" else "THEY WIN"
    }
    val myTurn = whoseTurn(s)?.includes(me) == true
    return when (s) {
        is RpsState -> "ROUND ${s.rounds.size + 1}"
        is TttState -> if (myTurn) "YOUR MOVE" else "THEIR MOVE"
        is CoinState -> "ROUND ${s.rounds.size + 1} OF 5"
        is PassState -> if (myTurn) "YOUR GUESS · ${s.guesses.size + 1} OF $PASS_MAX_GUESSES" else "THEIR GUESS · ${s.guesses.size + 1} OF $PASS_MAX_GUESSES"
        is GhostState -> if (myTurn) "YOUR LETTER" else "THEIR LETTER"
        is ChainState -> {
            val needed = s.needed
            if (myTurn) (if (needed != null) "YOUR WORD · STARTS WITH $needed" else "YOUR WORD") else "THEIR WORD"
        }
    }
}

// ── Presence, friend streaks, the Friends banner ────────────────────────────

/** A friend is "on now" when their app heartbeat is under two minutes old. */
const val ONLINE_WINDOW_MS = 2L * 60 * 1000

fun isOnline(lastSeenMs: Long?, nowMs: Long): Boolean =
    lastSeenMs != null && nowMs - lastSeenMs < ONLINE_WINDOW_MS && nowMs - lastSeenMs > -ONLINE_WINDOW_MS

/** A friend row's presence line: "On now · in Muddle", "On now", "Here 12 min ago", or null (older than a day). */
fun presenceLine(lastSeenMs: Long?, activity: String?, nowMs: Long): String? {
    if (lastSeenMs == null) return null
    if (isOnline(lastSeenMs, nowMs)) return if (!activity.isNullOrEmpty()) "On now · in $activity" else "On now"
    val m = Math.floorDiv(nowMs - lastSeenMs, 60_000L)
    if (m < 60) return "Here $m min ago"
    if (m < 60 * 24) return "Here ${m / 60} h ago"
    return null
}

/**
 * Days in a row BOTH players finished at least one daily, ending today (or
 * yesterday while today is still open for either of them).
 */
fun friendStreak(myDays: Iterable<String>, theirDays: Iterable<String>, today: String): Int {
    val mine = myDays.toSet()
    val both = theirDays.filter { it in mine }.toSet()
    var cursor: String? = if (today in both) today else shiftDay(today, -1).takeIf { it in both }
    var n = 0
    while (cursor != null && cursor in both) { n += 1; cursor = shiftDay(cursor, -1) }
    return n
}

data class FriendsBannerInput(
    val friendCount: Int,
    /** Usernames of friends on now. */
    val online: List<String>,
    /** Today's race: my rank (1-based) among me + friends, and the points. */
    val myRank: Int,
    val myPoints: Int,
    val leaderName: String,
    val leaderPoints: Int,
    /** Points of the person right behind me (or 0). */
    val nextPoints: Int,
)

private fun bannerOrd(n: Int): String {
    val suffix = if (n % 100 in 11..13) "TH" else when (n % 10) { 1 -> "ST"; 2 -> "ND"; 3 -> "RD"; else -> "TH" }
    return "$n$suffix"
}

private fun grouped(n: Int): String = String.format(java.util.Locale.US, "%,d", n)

/** The Friends banner headline, always upper case. */
fun friendsBannerHeadline(i: FriendsBannerInput): String {
    if (i.friendCount == 0) return "BRING YOUR FRIENDS"
    if (i.online.size == 1) return "${i.online[0].trim().uppercase()} IS ON NOW"
    if (i.online.size > 1) return "${i.online.size} FRIENDS ON NOW"
    if (i.myRank == 1 && i.myPoints > 0) return "YOU LEAD TODAY’S RACE!"
    if (i.leaderPoints > 0) return "${i.leaderName.trim().uppercase()} LEADS TODAY’S RACE"
    return "QUIET IN HERE · START A GAME"
}

/** The line under it. [clock] counts down to local midnight. */
fun friendsBannerClockLine(i: FriendsBannerInput, clock: String): String {
    if (i.friendCount == 0) return "ADD A FRIEND TO RACE, PLAY AND TRADE STREAKS"
    if (i.leaderPoints <= 0 && i.myPoints <= 0) return "TODAY’S RACE IS OPEN · ENDS IN $clock"
    if (i.myRank == 1) return "YOU LEAD BY ${grouped(maxOf(0, i.myPoints - i.nextPoints))} · ENDS IN $clock"
    return "TODAY’S RACE ENDS IN $clock · YOU’RE ${bannerOrd(i.myRank)}, ${grouped(i.leaderPoints - i.myPoints)} BEHIND"
}
