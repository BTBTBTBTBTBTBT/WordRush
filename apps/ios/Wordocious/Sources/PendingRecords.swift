import Foundation
import Supabase
import WordociousCore

/// Crash/offline protection for solo result recording — the iOS port of web
/// stats-service.ts's pending-record queue (PENDING_RECORD_PREFIX /
/// drainPendingRecords). Closes the wave-3 audit backlog item "systemic
/// lost-result risk": natives persisted the terminal game state locally but
/// fired the network record best-effort, so a finish in a dead spot silently
/// lost the result (and streak/XP credit) forever.
///
/// Semantics (mirrors web exactly):
/// - A payload is persisted (UserDefaults) BEFORE any network write, keyed by
///   mode+seed. It has two independently-completing parts: the stats/XP/daily
///   progression (`gameResult`, GameResultsService.record) and the matches
///   history row (`soloMatch`, recordSoloMatch). Each marks itself done on
///   success; the key is removed when all registered parts are done.
/// - drain() re-runs leftovers once per launch after auth is ready. It first
///   checks the server for an existing `matches` row for that seed+mode — if
///   one exists the original calls (or a prior drain) landed, so the key is
///   cleared WITHOUT re-running anything (user_stats/XP can never
///   double-increment from a payload whose writes landed but whose clear
///   didn't).
/// - Solo only. VS results are server-coordinated (designated writer) and are
///   never retried from here; CPU games are pure practice and not tracked.
/// - Payloads older than 7 days, or belonging to a different signed-in user,
///   are dropped / left alone respectively (web parity).
enum PendingRecords {
    private static let keyPrefix = "wordocious.pending-record."
    private static let maxAgeMs: Double = 7 * 24 * 60 * 60 * 1000

    struct GameResultArgs: Codable {
        var won: Bool
        var guessCount: Int
        var timeSeconds: Int
        var boardsSolved: Int
        var totalBoards: Int
        var hintsUsed: Int
        var stagesCompleted: Int?
        var bestCorrectLetters: Int?
    }

    struct SoloMatchArgs: Codable {
        var won: Bool
        var score: Int
        var timeSeconds: Int
        var solutions: [String]
        var guesses: [String]
        var hintsUsed: Int
    }

    struct Payload: Codable {
        var userId: String
        var gameMode: String
        var seed: String
        var savedAt: Double // ms since epoch
        var gameResult: GameResultArgs?
        var gameResultDone: Bool?
        var soloMatch: SoloMatchArgs?
        var soloMatchDone: Bool?
    }

    enum Part { case gameResult, soloMatch }

    private static func key(_ gameMode: String, _ seed: String) -> String {
        keyPrefix + gameMode + "-" + seed
    }

    private static func read(_ key: String) -> Payload? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Payload.self, from: data)
    }

    private static func write(_ key: String, _ payload: Payload) {
        if let data = try? JSONEncoder().encode(payload) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /// Merge one part's args into the payload for this game (creating it if
    /// absent). Called at the TOP of the recording functions, before network.
    static func register(userId: String, gameMode: String, seed: String,
                         gameResult: GameResultArgs? = nil,
                         soloMatch: SoloMatchArgs? = nil) {
        let k = key(gameMode, seed)
        var p = read(k) ?? Payload(userId: userId, gameMode: gameMode, seed: seed,
                                   savedAt: Date().timeIntervalSince1970 * 1000)
        p.userId = userId
        if let g = gameResult { p.gameResult = g; p.gameResultDone = false }
        if let s = soloMatch { p.soloMatch = s; p.soloMatchDone = false }
        write(k, p)
    }

    /// Mark one part complete; remove the key when all registered parts are done.
    static func markDone(gameMode: String, seed: String, part: Part) {
        let k = key(gameMode, seed)
        guard var p = read(k) else { return }
        switch part {
        case .gameResult: p.gameResultDone = true
        case .soloMatch: p.soloMatchDone = true
        }
        let allDone = (p.gameResult == nil || p.gameResultDone == true)
            && (p.soloMatch == nil || p.soloMatchDone == true)
        if allDone { UserDefaults.standard.removeObject(forKey: k) } else { write(k, p) }
    }

    /// Guard against re-entrant registration while drain() itself re-runs the
    /// record functions (they call register() again, which is fine, but drain
    /// must not pick up keys it is currently replaying on a later iteration).
    private static var draining = false

    /// Re-fire any solo results whose record calls were cut off (app killed
    /// mid-flight, network drop at the final guess). Call once per launch
    /// after auth bootstrap. Safe to call repeatedly; no-ops when signed out.
    static func drain() async {
        if draining { return }
        draining = true
        defer { draining = false }

        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        let userId = session.user.id.uuidString

        let keys = UserDefaults.standard.dictionaryRepresentation().keys
            .filter { $0.hasPrefix(keyPrefix) }
        for k in keys {
            guard let p = read(k), !p.userId.isEmpty, !p.gameMode.isEmpty, !p.seed.isEmpty else {
                UserDefaults.standard.removeObject(forKey: k)
                continue
            }
            // Too stale to be meaningful — drop regardless of owner.
            if Date().timeIntervalSince1970 * 1000 - p.savedAt > maxAgeMs {
                UserDefaults.standard.removeObject(forKey: k)
                continue
            }
            // Another account's pending result — leave it for that account.
            if p.userId.lowercased() != userId.lowercased() { continue }
            guard let mode = GameMode(rawValue: p.gameMode) else {
                UserDefaults.standard.removeObject(forKey: k)
                continue
            }

            // Dedupe: an existing matches row for this seed+mode means the
            // original flow landed — clear, never re-run.
            struct IdRow: Decodable { let id: String }
            do {
                let rows: [IdRow] = try await client.from("matches")
                    .select("id")
                    .eq("player1_id", value: userId)
                    .eq("seed", value: p.seed)
                    .eq("game_mode", value: p.gameMode)
                    .limit(1).execute().value
                if rows.first != nil {
                    UserDefaults.standard.removeObject(forKey: k)
                    continue
                }
            } catch {
                continue // can't verify (offline?) — retry on a later drain
            }

            // Re-run the missing parts. Each re-registers against the same key
            // and clears it on success, so a failure here simply leaves the
            // payload in place for the next launch.
            if let g = p.gameResult, p.gameResultDone != true {
                _ = await GameResultsService.record(
                    gameMode: mode, playType: "solo", won: g.won,
                    guessCount: g.guessCount, timeSeconds: g.timeSeconds,
                    boardsSolved: g.boardsSolved, totalBoards: g.totalBoards,
                    seed: p.seed, hintsUsed: g.hintsUsed,
                    stagesCompleted: g.stagesCompleted,
                    bestCorrectLetters: g.bestCorrectLetters)
            }
            if let s = p.soloMatch, p.soloMatchDone != true {
                await GameResultsService.recordSoloMatch(
                    gameMode: mode, won: s.won, score: s.score,
                    timeSeconds: s.timeSeconds, seed: p.seed,
                    solutions: s.solutions, guesses: s.guesses,
                    hintsUsed: s.hintsUsed)
            }
        }
    }
}
