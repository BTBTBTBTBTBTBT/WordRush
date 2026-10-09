package com.wordocious.core

/**
 * Live pocket games (FRIDAY-QUEUE item 9b) — the pure rules, mirrored 1:1 from
 * packages/core/src/friendly-live.ts (pinned by FriendlyLiveTest; TS twin friendly-live.test.ts).
 *
 * Gate: FlagsService.isLive(FriendlyLive.SWITCH_KEY). Off = the old 2 s poll.
 * On: Realtime channel `fg:<gameId>` — broadcast "move" (the receiver's view, sent by the server
 * the instant a move is saved), postgres_changes on friendly_game_pings (backup: only says
 * "refetch"), presence, broadcast "react". The GET stays the source of truth + keep-alive.
 */
object FriendlyLive {
    const val SWITCH_KEY = "live_play"

    fun topic(gameId: String) = "fg:$gameId"
    const val EVENT_MOVE = "move"
    const val EVENT_REACT = "react"
    const val PING_TABLE = "friendly_game_pings"

    val REACTIONS = listOf("clap", "fire", "wow", "grr", "rematch")
    fun isReaction(s: String?) = s != null && s in REACTIONS
    const val REACT_COOLDOWN_MS = 1200L
    const val REACT_LIFETIME_MS = 2400L

    /** Poll cadence in ms: switch off = 2000; on + socket up = 20 s keep-alive; on + socket down = 4 s. */
    fun pollIntervalMs(liveOn: Boolean, socketUp: Boolean): Long =
        if (!liveOn) 2_000L else if (socketUp) 20_000L else 4_000L

    /** How long an optimistic move may wait for the server before it is rolled back. */
    const val OPTIMISTIC_TIMEOUT_MS = 8_000L

    // ── Presence ────────────────────────────────────────────────────────────

    enum class PresenceLabel { HERE, THINKING, LEFT, AWAY }

    fun presenceLabel(peerPresent: Boolean, everSeen: Boolean, theirTurn: Boolean, peerThinking: Boolean = false): PresenceLabel =
        if (peerPresent) (if (theirTurn || peerThinking) PresenceLabel.THINKING else PresenceLabel.HERE)
        else if (everSeen) PresenceLabel.LEFT else PresenceLabel.AWAY

    fun presenceCopy(l: PresenceLabel): String = when (l) {
        PresenceLabel.HERE -> "HERE NOW"
        PresenceLabel.THINKING -> "THINKING…"
        PresenceLabel.LEFT -> "LEFT THE GAME"
        PresenceLabel.AWAY -> ""
    }

    // ── Staleness + change detection ────────────────────────────────────────

    /** ISO-8601 instant in epoch ms ("+00:00" or "Z", with or without fractions); 0 if unparseable. */
    fun instantMs(iso: String): Long =
        runCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
            .recoverCatching { java.time.Instant.parse(iso).toEpochMilli() }.getOrDefault(0L)

    /** True when [next] is a strictly newer save than [cur] (or nothing is on screen yet). */
    fun isNewer(cur: String?, next: String): Boolean = cur == null || instantMs(next) > instantMs(cur)

    data class Change(val moved: Boolean = false, val yourTurnStarted: Boolean = false, val ended: Boolean = false)

    /** The slice of a game view the live rules need (FriendlyGamesService.GameView implements it). */
    interface View {
        val id: String
        val me: Side
        val state: FriendlyState
        val active: Boolean
        val yourTurn: Boolean
        val updatedAt: String
    }

    fun describeChange(prev: View?, next: View): Change =
        if (prev == null) Change() else Change(
            moved = prev.state != next.state,
            yourTurnStarted = !prev.yourTurn && next.yourTurn && next.active,
            ended = prev.active && !next.active,
        )

    // ── Optimistic moves ────────────────────────────────────────────────────

    /**
     * The state after MY move when the client can know it: Tic-Tac-Tile always; Rock Paper Scissors
     * before the friend's pick; Word Chain (shape rules only, the list check is the server's).
     * Call It, Pass the Puzzle and Ghost wait for the server (null).
     */
    fun predictMove(state: FriendlyState, side: Side, move: FriendlyMove): FriendlyState? {
        fun ok(r: MoveResult): FriendlyState? = (r as? MoveResult.Ok)?.state
        return when (state) {
            is TttState -> ok(applyFriendlyMove(state, side, move))
            is RpsState -> {
                if (move !is FriendlyMove.Rps || state.picks[side] != null || state.picks[side.other] != null) null
                else ok(applyFriendlyMove(state, side, move))
            }
            is ChainState -> if (move is FriendlyMove.Chain) ok(applyFriendlyMove(state, side, move)) else null
            else -> null
        }
    }

    data class Pending(val move: FriendlyMove, val predicted: FriendlyState, val baseUpdatedAt: String)

    /**
     * The confirmed game plus my in-flight prediction. Immutable: every call returns the next
     * snapshot. [overlay] copies a view with a different state / turn flag.
     */
    data class Snapshot<V : View>(val confirmed: V? = null, val pending: Pending? = null) {
        /** What to draw: the confirmed game with my predicted state over it while the move is in flight. */
        fun displayed(overlay: (V, FriendlyState, Boolean) -> V): V? {
            val c = confirmed ?: return null
            val p = pending
            if (p == null || p.baseUpdatedAt != c.updatedAt) return c
            val turn = whoseTurn(p.predicted)
            return overlay(c, p.predicted, turn != null && turn.includes(c.me))
        }

        /** I tapped. [attached] = a prediction was made. */
        fun beginMove(move: FriendlyMove): Pair<Snapshot<V>, Boolean> {
            val c = confirmed
            if (c == null || !c.active || pending != null) return this to false
            val predicted = predictMove(c.state, c.me, move) ?: return this to false
            return copy(pending = Pending(move, predicted, c.updatedAt)) to true
        }

        /** The server accepted my move: its answer replaces the prediction (never an older save). */
        fun confirmMove(server: V): Snapshot<V> =
            Snapshot(if (confirmed == null || isNewer(confirmed.updatedAt, server.updatedAt)) server else confirmed, null)

        /** The server said no, or the call failed. [rolledBack] = a prediction was dropped (the UI shakes). */
        fun rejectMove(): Pair<Snapshot<V>, Boolean> = copy(pending = null) to (pending != null)

        data class Received<V : View>(val snap: Snapshot<V>, val applied: Boolean, val change: Change)

        /** A view from somewhere other than my own move's reply (broadcast, backup refetch, keep-alive). */
        fun receive(incoming: V): Received<V> {
            if (!isNewer(confirmed?.updatedAt, incoming.updatedAt)) return Received(this, false, Change())
            val change = describeChange(confirmed, incoming)
            val still = pending != null && pending.baseUpdatedAt == incoming.updatedAt
            return Received(Snapshot(incoming, if (still) pending else null), true, change)
        }
    }
}
