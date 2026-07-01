package com.wordocious.app.data

import android.os.Handler
import android.os.Looper
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.serialization.json.Json
import org.json.JSONObject

/**
 * Thin socket.io wrapper for VS — the Android equivalent of iOS VSMatchService /
 * web SocketIOMatchService. Owns the connection and exposes typed emit methods +
 * inbound-event callbacks. The VS state machine lives in VSMatchViewModel. All
 * inbound callbacks are marshalled to the main thread so the UI can update directly.
 */
class VSMatchService : VSTransport {
    private var socket: Socket? = null
    private val main = Handler(Looper.getMainLooper())
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    // Inbound callbacks (set by the view model)
    override var onConnect: (() -> Unit)? = null
    override var onDisconnect: (() -> Unit)? = null
    override var onQueueStatus: ((VSQueueStatus) -> Unit)? = null
    override var onMatchFound: ((VSMatchFound) -> Unit)? = null
    override var onMatchStart: ((VSMatchStart) -> Unit)? = null
    override var onGuessResult: ((VSGuessResult) -> Unit)? = null
    override var onOpponentProgress: ((VSOpponentProgress) -> Unit)? = null
    override var onMatchEnded: ((VSMatchEnded) -> Unit)? = null
    override var onOpponentStageCompleted: ((VSStageEvent) -> Unit)? = null
    override var onRematchOffered: (() -> Unit)? = null
    override var onRematchDeclined: (() -> Unit)? = null
    override var onRematchStart: ((VSRematchStart) -> Unit)? = null
    override var onOpponentLeft: (() -> Unit)? = null
    override var onServerError: ((VSServerError) -> Unit)? = null
    override var onOpponentTyping: (() -> Unit)? = null

    override val isConfigured: Boolean get() = VSConfig.isConfigured

    // ── Connection ──────────────────────────────────────────────────────────────
    override fun connect(presenceId: String?) {
        val opts = IO.Options().apply {
            forceNew = true
            reconnection = true
            transports = arrayOf("websocket")
            // socket.io v3+ handshake auth — server reads handshake.auth.presenceId.
            if (presenceId != null) auth = mapOf("presenceId" to presenceId)
        }
        val s = runCatching { IO.socket(VSConfig.SERVER_URL, opts) }.getOrNull() ?: return
        socket = s
        register(s)
        s.connect()
    }

    override fun disconnect() {
        socket?.let { it.off(); it.disconnect() }
        socket = null
    }

    // ── Outbound (client → server) ────────────────────────────────────────────────
    override fun joinQueue(mode: String, dailySeed: String?, inviteCode: String?) {
        val payload = JSONObject().put("mode", mode)
        dailySeed?.let { payload.put("dailySeed", it) }
        inviteCode?.let { payload.put("inviteCode", it) }
        socket?.emit(VSEvent.JOIN_QUEUE, payload)
    }

    override fun leaveQueue() { socket?.emit(VSEvent.LEAVE_QUEUE) }

    override fun submitGuess(guess: String, boardIndex: Int) {
        socket?.emit(VSEvent.SUBMIT_GUESS, JSONObject().put("guess", guess).put("boardIndex", boardIndex))
    }

    override fun boardSolved(boardIndex: Int) {
        socket?.emit(VSEvent.BOARD_SOLVED, JSONObject().put("boardIndex", boardIndex))
    }

    override fun playerCompleted(status: String, totalGuesses: Int, timeMs: Int) {
        socket?.emit(VSEvent.PLAYER_COMPLETED, JSONObject().put("status", status).put("totalGuesses", totalGuesses).put("timeMs", timeMs))
    }

    override fun stageCompleted(stageIndex: Int) {
        socket?.emit(VSEvent.STAGE_COMPLETED, JSONObject().put("stageIndex", stageIndex))
    }

    /** Throttle upstream (VSMatchViewModel) — at most one ping per 1.5s. */
    override fun emitTyping() { socket?.emit(VSEvent.TYPING) }

    override fun abandonMatch() { socket?.emit(VSEvent.ABANDON_MATCH) }
    override fun offerRematch() { socket?.emit(VSEvent.OFFER_REMATCH) }
    override fun declineRematch() { socket?.emit(VSEvent.DECLINE_REMATCH) }

    // ── Handler registration ────────────────────────────────────────────────────
    private fun register(s: Socket) {
        s.on(Socket.EVENT_CONNECT) { runOnMain { onConnect?.invoke() } }
        s.on(Socket.EVENT_DISCONNECT) { runOnMain { onDisconnect?.invoke() } }

        bind(s, VSEvent.QUEUE_STATUS, VSQueueStatus.serializer()) { onQueueStatus?.invoke(it) }
        bind(s, VSEvent.MATCH_FOUND, VSMatchFound.serializer()) { onMatchFound?.invoke(it) }
        bind(s, VSEvent.MATCH_START, VSMatchStart.serializer()) { onMatchStart?.invoke(it) }
        bind(s, VSEvent.GUESS_RESULT, VSGuessResult.serializer()) { onGuessResult?.invoke(it) }
        bind(s, VSEvent.OPPONENT_PROGRESS, VSOpponentProgress.serializer()) { onOpponentProgress?.invoke(it) }
        bind(s, VSEvent.MATCH_ENDED, VSMatchEnded.serializer()) { onMatchEnded?.invoke(it) }
        bind(s, VSEvent.OPPONENT_STAGE_COMPLETED, VSStageEvent.serializer()) { onOpponentStageCompleted?.invoke(it) }
        bind(s, VSEvent.REMATCH_START, VSRematchStart.serializer()) { onRematchStart?.invoke(it) }
        bind(s, VSEvent.ERROR, VSServerError.serializer()) { onServerError?.invoke(it) }

        s.on(VSEvent.REMATCH_OFFERED) { runOnMain { onRematchOffered?.invoke() } }
        s.on(VSEvent.REMATCH_DECLINED) { runOnMain { onRematchDeclined?.invoke() } }
        s.on(VSEvent.OPPONENT_LEFT) { runOnMain { onOpponentLeft?.invoke() } }
        s.on(VSEvent.OPPONENT_TYPING) { runOnMain { onOpponentTyping?.invoke() } }
    }

    /** Decode args[0] (a JSONObject) into [T] and deliver on the main thread. */
    private fun <T> bind(s: Socket, event: String, deserializer: kotlinx.serialization.DeserializationStrategy<T>, deliver: (T) -> Unit) {
        s.on(event) { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            val value = runCatching { json.decodeFromString(deserializer, obj.toString()) }.getOrNull() ?: return@on
            runOnMain { deliver(value) }
        }
    }

    private fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }
}
