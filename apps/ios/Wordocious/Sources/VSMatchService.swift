import Foundation
import SocketIO

/// Thin socket.io wrapper for VS — the native equivalent of
/// apps/web/lib/adapters/match-service.ts (SocketIOMatchService). It owns the
/// connection and exposes typed emit methods + inbound-event closures. The VS
/// state machine lives in VSMatchViewModel. All inbound closures fire on the
/// main actor so the UI can update directly.
final class VSMatchService {
    private var manager: SocketManager?
    private var socket: SocketIOClient?

    // MARK: Inbound callbacks (set by the view model)
    var onConnect: (() -> Void)?
    var onDisconnect: (() -> Void)?
    var onQueueStatus: ((VSQueueStatus) -> Void)?
    var onMatchFound: ((VSMatchFound) -> Void)?
    var onMatchStart: ((VSMatchStart) -> Void)?
    var onGuessResult: ((VSGuessResult) -> Void)?
    var onOpponentProgress: ((VSOpponentProgress) -> Void)?
    var onMatchEnded: ((VSMatchEnded) -> Void)?
    var onOpponentStageCompleted: ((VSStageEvent) -> Void)?
    var onRematchOffered: (() -> Void)?
    var onRematchDeclined: (() -> Void)?
    var onRematchStart: ((VSRematchStart) -> Void)?
    var onOpponentLeft: (() -> Void)?
    var onOpponentTyping: (() -> Void)?
    var onServerError: ((VSServerError) -> Void)?

    var isConfigured: Bool { VSConfig.isConfigured }

    // MARK: Connection

    func connect(presenceId: String?) {
        guard let url = VSConfig.serverURL else { return }
        let manager = SocketManager(socketURL: url, config: [
            .log(false), .compress, .forceWebsockets(true), .reconnects(true),
        ])
        self.manager = manager
        let socket = manager.defaultSocket
        self.socket = socket
        register(socket)
        socket.connect(withPayload: presenceId.map { ["presenceId": $0] })
    }

    func disconnect() {
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
    }

    // MARK: Outbound (client → server)

    func joinQueue(mode: String, dailySeed: String?, inviteCode: String?) {
        var payload: [String: Any] = ["mode": mode]
        if let dailySeed { payload["dailySeed"] = dailySeed }
        if let inviteCode { payload["inviteCode"] = inviteCode }
        socket?.emit(VSEvent.joinQueue, payload)
    }

    func leaveQueue() { socket?.emit(VSEvent.leaveQueue) }

    func submitGuess(_ guess: String, boardIndex: Int = 0) {
        socket?.emit(VSEvent.submitGuess, ["guess": guess, "boardIndex": boardIndex])
    }

    func boardSolved(boardIndex: Int) { socket?.emit(VSEvent.boardSolved, ["boardIndex": boardIndex]) }

    func playerCompleted(status: String, totalGuesses: Int, timeMs: Int) {
        socket?.emit(VSEvent.playerCompleted, ["status": status, "totalGuesses": totalGuesses, "timeMs": timeMs])
    }

    func stageCompleted(stageIndex: Int) { socket?.emit(VSEvent.stageCompleted, ["stageIndex": stageIndex]) }
    /// Throttled activity ping (the caller throttles) — relayed as opponent_typing.
    func emitTyping() { socket?.emit(VSEvent.typing) }
    func abandonMatch() { socket?.emit(VSEvent.abandonMatch) }
    func offerRematch() { socket?.emit(VSEvent.offerRematch) }
    func declineRematch() { socket?.emit(VSEvent.declineRematch) }

    // MARK: Handler registration

    private func register(_ socket: SocketIOClient) {
        socket.on(clientEvent: .connect) { [weak self] _, _ in self?.main { self?.onConnect?() } }
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in self?.main { self?.onDisconnect?() } }

        bind(socket, VSEvent.queueStatus, VSQueueStatus.self) { [weak self] in self?.onQueueStatus?($0) }
        bind(socket, VSEvent.matchFound, VSMatchFound.self) { [weak self] in self?.onMatchFound?($0) }
        bind(socket, VSEvent.matchStart, VSMatchStart.self) { [weak self] in self?.onMatchStart?($0) }
        bind(socket, VSEvent.guessResult, VSGuessResult.self) { [weak self] in self?.onGuessResult?($0) }
        bind(socket, VSEvent.opponentProgress, VSOpponentProgress.self) { [weak self] in self?.onOpponentProgress?($0) }
        bind(socket, VSEvent.matchEnded, VSMatchEnded.self) { [weak self] in self?.onMatchEnded?($0) }
        bind(socket, VSEvent.opponentStageCompleted, VSStageEvent.self) { [weak self] in self?.onOpponentStageCompleted?($0) }
        bind(socket, VSEvent.rematchStart, VSRematchStart.self) { [weak self] in self?.onRematchStart?($0) }
        bind(socket, VSEvent.error, VSServerError.self) { [weak self] in self?.onServerError?($0) }

        // Payload-less events.
        socket.on(VSEvent.rematchOffered) { [weak self] _, _ in self?.main { self?.onRematchOffered?() } }
        socket.on(VSEvent.rematchDeclined) { [weak self] _, _ in self?.main { self?.onRematchDeclined?() } }
        socket.on(VSEvent.opponentLeft) { [weak self] _, _ in self?.main { self?.onOpponentLeft?() } }
        socket.on(VSEvent.opponentTyping) { [weak self] _, _ in self?.main { self?.onOpponentTyping?() } }
    }

    /// Decode the first element of a socket payload into `T` and deliver on main.
    private func bind<T: Decodable>(_ socket: SocketIOClient, _ event: String, _ type: T.Type,
                                    _ deliver: @escaping (T) -> Void) {
        socket.on(event) { [weak self] data, _ in
            guard let value: T = Self.decode(type, data) else { return }
            self?.main { deliver(value) }
        }
    }

    /// Shared decoder for inbound socket events — JSONDecoder is safe to reuse
    /// for sequential decodes on one thread (socket.io delivers handlers on its
    /// single handleQueue), and reusing it avoids a fresh allocation per event
    /// on the hot in-match path (guess_result / opponent_progress).
    private static let eventDecoder = JSONDecoder()

    private static func decode<T: Decodable>(_ type: T.Type, _ data: [Any]) -> T? {
        // JSONSerialization.data(withJSONObject:) RAISES an NSException (not a
        // Swift error, so `try?` can't catch it → crash) when `first` isn't a
        // valid top-level JSON object — e.g. a String/Number/NSNull error
        // payload. Guard with isValidJSONObject so a malformed/unexpected
        // socket payload is skipped instead of aborting the app.
        guard let first = data.first,
              JSONSerialization.isValidJSONObject(first),
              let json = try? JSONSerialization.data(withJSONObject: first) else { return nil }
        return try? eventDecoder.decode(T.self, from: json)
    }

    private func main(_ work: @escaping () -> Void) {
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }
}
