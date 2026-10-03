import Foundation
import Network
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
///   mode+seed. It has independently-completing parts: the stats/XP
///   progression (`gameResult`, GameResultsService.record), the matches
///   history row (`soloMatch`, recordSoloMatch), and — for daily seeds — the
///   daily_results leaderboard row (`dailyDone`, written inside record() but
///   tracked separately because it can fail on its own). Each marks itself
///   done on a CONFIRMED success only; an error, a timeout or a kill leaves it
///   outstanding. The key is removed when all registered parts are done.
/// - drain() re-runs leftovers after auth is ready: at launch, on every
///   foreground and whenever the network comes back (BI15 — it used to run
///   once per launch, so a write lost to the 2026-10-02 outage sat unretried
///   for the rest of the session). It never replays a game whose live record
///   call is still in flight (that would double-count stats when both land).
///   The `matches` row for the seed settles ONLY the `soloMatch` part.
/// - Solo only. VS results are server-coordinated (designated writer) and are
///   never retried from here; CPU games are pure practice and not tracked.
/// - Payloads older than 7 days, or belonging to a different signed-in user,
///   are dropped / left alone respectively (web parity).
/// The bookkeeping itself lives in WordociousCore (PendingLedger.swift) so it
/// is unit-tested; this file is the network side.
enum PendingRecords {
    typealias GameResultArgs = PendingGameResultArgs
    typealias SoloMatchArgs = PendingSoloMatchArgs
    typealias Payload = PendingPayload
    typealias Part = PendingPart

    static let store = PendingRecordStore()

    /// Whether a payload exists for this game — the launch sweep skips seeds
    /// the queue already owns (drain() replays those, not the sweep).
    static func hasPayload(gameMode: String, seed: String) -> Bool {
        store.hasPayload(gameMode: gameMode, seed: seed)
    }

    /// Merge one part's args into the payload for this game (creating it if
    /// absent). Called at the TOP of the recording functions, before network.
    static func register(userId: String, gameMode: String, seed: String,
                         gameResult: GameResultArgs? = nil,
                         soloMatch: SoloMatchArgs? = nil) {
        store.register(userId: userId, gameMode: gameMode, seed: seed,
                       gameResult: gameResult, soloMatch: soloMatch)
    }

    /// Mark one part complete; remove the key when all registered parts are done.
    static func markDone(gameMode: String, seed: String, part: Part) {
        store.markDone(gameMode: gameMode, seed: seed, part: part)
    }

    /// A live record call for this game started / finished (drain skips it meanwhile).
    static func beginFlight(gameMode: String, seed: String) { store.beginFlight(gameMode: gameMode, seed: seed) }
    static func endFlight(gameMode: String, seed: String) { store.endFlight(gameMode: gameMode, seed: seed) }

    /// BI15: today's finished dailies whose daily_results row is still queued,
    /// as completions — merged into Home's completed state so a result the
    /// server hasn't taken yet (outage, offline finish, killed mid-write) still
    /// shows its W/L on the card, across relaunches, until the retry lands.
    static func pendingTodayCompletions(day: String) -> [DailyCompletion] {
        guard let userId = localUserId() else { return [] }
        return store.outstandingDailies(userId: userId, day: day).compactMap { p in
            guard let g = p.gameResult, DailyResultsService.owesDailyRow(
                gameMode: p.gameMode, completed: g.won, guessCount: g.guessCount,
                timeSeconds: g.timeSeconds, totalBoards: g.totalBoards) else { return nil }
            let score = DailyScoring.compositeScore(
                gameMode: p.gameMode, completed: g.won, guessCount: g.guessCount,
                timeSeconds: g.timeSeconds, boardsSolved: g.boardsSolved, totalBoards: g.totalBoards,
                hintsUsed: g.hintsUsed, stagesCompleted: g.stagesCompleted,
                bestCorrectLetters: g.bestCorrectLetters, dateKey: getDailySeedDate(p.seed))
            var c = DailyCompletion(gameMode: p.gameMode, completed: g.won, guessCount: g.guessCount,
                                    timeSeconds: Double(g.timeSeconds), score: score)
            c.boardsSolved = g.boardsSolved; c.totalBoards = g.totalBoards; c.hintsUsed = g.hintsUsed
            return c
        }
    }

    // MARK: - Retry triggers (BI15)

    private static var monitor: NWPathMonitor?
    private static var lastPathSatisfied = true

    /// Drain on every foreground and whenever connectivity returns. Call once
    /// after the launch drain. Idempotent.
    @MainActor
    static func startAutoRetry() {
        guard monitor == nil else { return }
        let m = NWPathMonitor()
        m.pathUpdateHandler = { path in
            let ok = path.status == .satisfied
            Task { @MainActor in
                // Only the offline → online edge; the first callback reports the current state.
                if ok && !lastPathSatisfied {
                    // BI16: a session refresh the outage failed retries first (its
                    // success drains too); then the queue.
                    await AuthService.shared.retrySessionIfNeeded()
                    await drain()
                }
                lastPathSatisfied = ok
            }
        }
        m.start(queue: DispatchQueue(label: "wordocious.pending-records.path"))
        monitor = m
    }

    /// Guard against overlapping drains (launch + foreground + network-back can
    /// all fire together). Main-actor isolated so the flag check is race-free.
    @MainActor private static var draining = false

    /// Re-fire any solo results whose record calls were cut off (app killed
    /// mid-flight, network drop or timeout at the final guess). Safe to call
    /// repeatedly; no-ops when signed out.
    @MainActor
    static func drain() async {
        if draining { return }
        draining = true
        defer { draining = false }

        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        let userId = session.user.id.uuidString

        for k in store.keys() {
            guard var p = store.read(k), !p.userId.isEmpty, !p.gameMode.isEmpty, !p.seed.isEmpty else {
                store.remove(k)
                continue
            }
            // Too stale to be meaningful — drop regardless of owner.
            if Date().timeIntervalSince1970 * 1000 - p.savedAt > PendingRecordStore.maxAgeMs {
                store.remove(k)
                continue
            }
            // Another account's pending result — leave it for that account.
            if p.userId.lowercased() != userId.lowercased() { continue }
            // Its live record call is still running (a hung write mid-outage) —
            // replaying now would double stats/XP when both land.
            if store.isInFlight(k) { continue }
            guard let mode = GameMode(rawValue: p.gameMode) else {
                store.remove(k)
                continue
            }

            // Dedupe, per PART. A matches row for this seed+mode proves the
            // `soloMatch` half landed and nothing more — the progression half
            // is a separate call that fails on its own. So the row only settles
            // the match half, and the done-flags decide what gets replayed.
            struct IdRow: Decodable { let id: String }
            do {
                let rows: [IdRow] = try await client.from("matches")
                    .select("id")
                    .eq("player1_id", value: userId)
                    .eq("seed", value: p.seed)
                    .eq("game_mode", value: p.gameMode)
                    .limit(1).execute().value
                if rows.first != nil, p.soloMatch != nil, p.soloMatchDone != true {
                    markDone(gameMode: p.gameMode, seed: p.seed, part: .soloMatch)
                    p.soloMatchDone = true
                }
            } catch {
                continue // can't verify (offline?) — retry on a later drain
            }

            // Everything registered has landed (incl. the daily row for daily seeds).
            if p.allDone {
                store.remove(k)
                continue
            }

            // Re-run the missing parts. Each re-registers against the same key
            // and clears it on success, so a failure here simply leaves the
            // payload in place for the next drain.
            if let g = p.gameResult, p.gameResultDone != true {
                let xp = await GameResultsService.record(
                    gameMode: mode, playType: "solo", won: g.won,
                    guessCount: g.guessCount, timeSeconds: g.timeSeconds,
                    boardsSolved: g.boardsSolved, totalBoards: g.totalBoards,
                    seed: p.seed, hintsUsed: g.hintsUsed,
                    stagesCompleted: g.stagesCompleted,
                    bestCorrectLetters: g.bestCorrectLetters)
                // The live finish checks achievements after its writes; a
                // replayed progression must too, or a result that needed the
                // retry never unlocks what it earned.
                if xp != nil {
                    await AchievementService.checkAchievements(
                        userId: userId.lowercased(), gameMode: mode.rawValue, playType: "solo",
                        won: g.won, guessCount: g.guessCount, timeSeconds: g.timeSeconds,
                        seed: p.seed, hintsUsed: g.hintsUsed, source: .replay)
                }
            } else if let g = p.gameResult, p.dailyRowOutstanding {
                // Progression landed but the daily_results tail was cut — replay
                // just the daily leg (idempotent best-score upsert). Re-running
                // the whole record() here would double stats/XP/streaks.
                let landed = await DailyResultsService.record(
                    gameMode: mode, completed: g.won, guessCount: g.guessCount,
                    timeSeconds: g.timeSeconds, boardsSolved: g.boardsSolved,
                    totalBoards: g.totalBoards, hintsUsed: g.hintsUsed, seed: p.seed,
                    stagesCompleted: g.stagesCompleted,
                    bestCorrectLetters: g.bestCorrectLetters) != nil
                if landed || !DailyResultsService.owesDailyRow(
                    gameMode: mode.rawValue, completed: g.won, guessCount: g.guessCount,
                    timeSeconds: g.timeSeconds, totalBoards: g.totalBoards) {
                    markDone(gameMode: p.gameMode, seed: p.seed, part: .daily)
                }
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
