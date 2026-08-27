import Foundation
import Sentry
import Supabase
import WordociousCore

/// Report a swallowed Supabase write failure to Sentry (release builds only —
/// Sentry never starts in DEBUG). Recording stays best-effort — capture, never
/// rethrow — but failed stat/result writes are no longer invisible (web
/// reportRejectedWrite parity).
func reportRejectedWrite(_ operation: String, gameMode: String, _ error: Error) {
    // A cancelled task is NOT a rejected write: reporting it here dressed a
    // mid-flight cancellation up as a handled server failure (the Android
    // incident's swallowed-CancellationException hole, ported). The pending
    // payload semantics already treat a cancel like any failure — the part
    // stays outstanding and replays on the next drain — so the only fix needed
    // is to keep the telemetry honest.
    if error is CancellationError { return }
    if let urlError = error as? URLError, urlError.code == .cancelled { return }
    #if !DEBUG
    SentrySDK.capture(error: error) { scope in
        scope.setTag(value: gameMode, key: "game_mode")
        scope.setContext(value: ["operation": operation, "game_mode": gameMode],
                         key: "rejected_write")
    }
    #endif
}

/// Report a finished game that was dropped outright — not "the write failed and
/// will be retried", but "we never even got as far as queueing it". There is no
/// underlying Error for this: it is a state we should not be able to reach, and
/// it silently costs the player a completed game, so it must arrive as evidence
/// rather than as a shrug.
func reportDroppedResult(_ operation: String, gameMode: String, reason: String) {
    #if !DEBUG
    SentrySDK.capture(message: "result dropped: \(operation) — \(reason)") { scope in
        scope.setLevel(.error)
        scope.setTag(value: gameMode, key: "game_mode")
        scope.setContext(value: ["operation": operation, "game_mode": gameMode, "reason": reason],
                         key: "dropped_result")
    }
    #endif
}

/// The signed-in user id read from LOCAL storage only.
///
/// `client.auth.session` refreshes an expired access token, which is a network
/// call — so the recording paths, which used it purely to learn who the player
/// was, threw and bailed in exactly the situation the pending-record queue
/// exists for: a game finished offline. The finished game was dropped before
/// PendingRecords.register() ever ran — no queue entry, no retry, no telemetry,
/// and no self-heal once the connection came back. `currentSession` is a
/// keychain read that cannot fail for lack of a network, and an expired token
/// is irrelevant here: the id is only needed to key the payload, and drain()
/// re-authenticates properly before replaying it.
func localUserId() -> String? {
    AuthService.shared.client.auth.currentSession?.user.id.uuidString
}

/// Records a finished game's full progression, porting the core of
/// lib/stats-service.ts recordGameResult(): user_stats (wins/losses/games/
/// best/avg/fastest), profile XP + level + win-streak + daily-login-streak
/// (+ 7-day shield grant), and the daily_results leaderboard row.
///
/// Deferred vs web (best-effort / fire-and-forget there): all_time_records
/// checkAndUpdateRecord writes and the daily "sweep" bonus. See bible §7.
enum GameResultsService {
    private struct StatsRow: Decodable {
        let id: String
        let wins: Int
        let losses: Int
        let totalGames: Int
        let bestScore: Int
        let averageTime: Int
        let fastestTime: Int
        enum CodingKeys: String, CodingKey {
            case id, wins, losses
            case totalGames = "total_games"
            case bestScore = "best_score"
            case averageTime = "average_time"
            case fastestTime = "fastest_time"
        }
    }

    private struct StatsUpdate: Encodable {
        let wins: Int, losses: Int, total_games: Int
        let best_score: Int, average_time: Int, fastest_time: Int
    }

    /// A solo game as a `matches` row (player2_id = null) — ports
    /// lib/stats-service.ts recordSoloMatch. This is what powers the Profile
    /// charts (guess distribution, activity calendar, solve-time, etc.), which
    /// all query `matches`. Without it, native play wouldn't show up there.
    private struct SoloMatchInsert: Encodable {
        let game_mode: String
        let player1_id: String
        let winner_id: String?      // nil (omitted) on a loss
        let player1_score: Int      // guess count — buckets the distribution
        let player1_time: Int       // seconds
        let seed: String
        let solutions: [String]
        let player1_guesses: [String]
        let hints_used: Int
        let started_at: String
        let completed_at: String
    }

    /// Insert a solo match-history row for a finished game. Registers a
    /// pending-record part BEFORE the network write and clears it on success,
    /// so a kill/offline finish is re-run by PendingRecords.drain() next
    /// launch (web stats-service.ts recordSoloMatch parity).
    static func recordSoloMatch(
        gameMode: GameMode, won: Bool, score: Int, timeSeconds: Int,
        seed: String, solutions: [String], guesses: [String], hintsUsed: Int = 0
    ) async {
        let client = AuthService.shared.client
        // Local id, NOT `try? await client.auth.session` — see localUserId().
        // The refreshing accessor threw offline and returned right here, one
        // line above the register() that exists to survive exactly that, so an
        // offline finish lost its match-history row permanently.
        guard let userId = localUserId() else {
            reportDroppedResult("recordSoloMatch", gameMode: gameMode.rawValue,
                                reason: "no local session while recording a finished game")
            return
        }
        PendingRecords.register(
            userId: userId, gameMode: gameMode.rawValue, seed: seed,
            soloMatch: .init(won: won, score: score, timeSeconds: timeSeconds,
                             solutions: solutions, guesses: guesses, hintsUsed: hintsUsed))
        let now = Date()
        let iso = ISO8601DateFormatter()
        let row = SoloMatchInsert(
            game_mode: gameMode.rawValue, player1_id: userId,
            winner_id: won ? userId : nil, player1_score: score, player1_time: timeSeconds,
            seed: seed, solutions: solutions, player1_guesses: guesses, hints_used: hintsUsed,
            started_at: iso.string(from: now.addingTimeInterval(-Double(timeSeconds))),
            completed_at: iso.string(from: now))
        do {
            try await client.from("matches").insert(row).execute()
            PendingRecords.markDone(gameMode: gameMode.rawValue, seed: seed, part: .soloMatch)
        } catch {
            // Pending payload stays — retried by drain(). Still worth a Sentry
            // breadcrumb: a systematic insert failure would otherwise be silent.
            reportRejectedWrite("recordSoloMatch", gameMode: gameMode.rawValue, error)
        }
    }

    /// A VS match as a `matches` row (player2_id set) so the battle appears in
    /// Recent Matches — ports lib/stats-service.ts recordMatch. Called by ONLY
    /// the designated writer (server sets match_ended.recordMatch on player1),
    /// so exactly one shared row exists per match. Solutions + both players'
    /// guess words come from match_ended (the server reveals the opponent's
    /// letters at match end) so the row matches what the web writes.
    private struct VsMatchInsert: Encodable {
        let game_mode: String
        let player1_id: String
        let player2_id: String
        let winner_id: String?       // nil on a draw
        let player1_score: Int       // my guess count
        let player2_score: Int       // opponent guess count
        let player1_time: Int        // seconds
        let player2_time: Int
        let seed: String
        let solutions: [String]
        let player1_guesses: [String]
        let player2_guesses: [String]
        let started_at: String
        let completed_at: String
        let forfeit: Bool
    }

    /// Insert the VS match-history row. `won`/`isDraw` derive winner_id; on a
    /// loss the opponent is the winner.
    static func recordVsMatch(
        gameMode: GameMode, opponentId: String, won: Bool, isDraw: Bool,
        playerGuesses: Int, opponentGuesses: Int, playerTimeSec: Int, opponentTimeSec: Int,
        seed: String, solutions: [String] = [], myGuesses: [String] = [], theirGuesses: [String] = [],
        forfeit: Bool = false
    ) async {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        let userId = session.user.id.uuidString
        let now = Date()
        let iso = ISO8601DateFormatter()
        let winnerId: String? = isDraw ? nil : (won ? userId : opponentId)
        let row = VsMatchInsert(
            game_mode: gameMode.rawValue, player1_id: userId, player2_id: opponentId,
            winner_id: winnerId, player1_score: playerGuesses, player2_score: opponentGuesses,
            player1_time: playerTimeSec, player2_time: opponentTimeSec,
            seed: seed, solutions: solutions, player1_guesses: myGuesses, player2_guesses: theirGuesses,
            started_at: iso.string(from: now.addingTimeInterval(-Double(playerTimeSec))),
            completed_at: iso.string(from: now), forfeit: forfeit)
        do {
            try await client.from("matches").insert(row).execute()
        } catch {
            // Best-effort stays (the match result itself recorded via record()),
            // but a failed shared-history insert is captured, not swallowed.
            reportRejectedWrite("recordVsMatch", gameMode: gameMode.rawValue, error)
        }
    }

    /// Gauntlet per-stage breakdown stored on the matches row so the results
    /// screen renders cross-device (web ↔ native). Written as a SEPARATE
    /// best-effort update after the insert: if the `gauntlet_stages` column
    /// isn't present yet, this silently no-ops and the match row is unaffected
    /// (the social_links lesson — a missing column must never break recording).
    struct GauntletStagesPayload: Encodable {
        let stages: [GauntletStageConfig]
        let stageResults: [GauntletStageResult]
    }
    private struct GauntletStagesUpdate: Encodable { let gauntlet_stages: GauntletStagesPayload }

    static func recordGauntletStages(seed: String, payload: GauntletStagesPayload) async {
        let client = AuthService.shared.client
        guard let uid = try? await client.auth.session.user.id.uuidString else { return }
        _ = try? await client.from("matches")
            .update(GauntletStagesUpdate(gauntlet_stages: payload))
            .eq("player1_id", value: uid)
            .eq("game_mode", value: "GAUNTLET")
            .eq("seed", value: seed)
            .execute()
    }
    private struct StatsInsert: Encodable {
        let user_id: String, game_mode: String, play_type: String
        let wins: Int, losses: Int, total_games: Int
        let best_score: Int, average_time: Int, fastest_time: Int
    }

    private struct ProfileRow: Decodable {
        let totalWins: Int, totalLosses: Int
        let currentStreak: Int, bestStreak: Int
        let xp: Int
        let level: Int?
        let lastPlayedAt: String?
        let dailyLoginStreak: Int, bestDailyLoginStreak: Int
        let streakShields: Int
        enum CodingKeys: String, CodingKey {
            case xp
            case totalWins = "total_wins"
            case totalLosses = "total_losses"
            case currentStreak = "current_streak"
            case bestStreak = "best_streak"
            case level
            case lastPlayedAt = "last_played_at"
            case dailyLoginStreak = "daily_login_streak"
            case bestDailyLoginStreak = "best_daily_login_streak"
            case streakShields = "streak_shields"
        }
    }

    private struct ProfileUpdate: Encodable {
        let total_wins: Int, total_losses: Int
        let current_streak: Int, best_streak: Int
        let xp: Int, level: Int
        let last_played_at: String
        let daily_login_streak: Int, best_daily_login_streak: Int
        let streak_shields: Int
    }

    @discardableResult
    /// TRUE when the daily_results row for this seed's day + mode exists.
    /// The reconciliation behind the restored-finished backfill (bible §200):
    /// "finished on disk" must be verified against the server, not assumed
    /// recorded. Network failure returns true (skip the backfill this launch —
    /// the next open of the board retries; never churn writes on flaky radio).
    static func dailyRowExists(seed: String, mode: GameMode) async -> Bool {
        guard let userId = localUserId() else { return true }
        // daily-YYYY-MM-DD-MODE → the day this puzzle belongs to.
        let parts = seed.split(separator: "-")
        guard seed.hasPrefix("daily-"), parts.count >= 5 else { return true }
        let day = "\(parts[1])-\(parts[2])-\(parts[3])"
        struct IdRow: Decodable { let id: String }
        let rows: [IdRow]? = try? await AuthService.shared.client
            .from("daily_results")
            .select("id")
            .eq("user_id", value: userId)
            .eq("day", value: day)
            .eq("game_mode", value: mode.rawValue)
            .eq("play_type", value: "solo")
            .limit(1)
            .execute().value
        guard let rows else { return true }
        return !rows.isEmpty
    }

    /// Tri-state `matches`-row probe for the backfill paths: true/false is a
    /// verified answer, nil means "couldn't check" (offline, signed out) — and
    /// a backfill must NEVER full-record on nil, only skip and retry later.
    /// A matches row proves the stats/XP/match leg of record() ran for this
    /// seed; its absence proves the whole record flow never landed.
    static func dailyMatchRowExists(seed: String, mode: GameMode) async -> Bool? {
        guard let userId = localUserId() else { return nil }
        struct IdRow: Decodable { let id: String }
        do {
            let rows: [IdRow] = try await AuthService.shared.client.from("matches")
                .select("id")
                .eq("player1_id", value: userId)
                .eq("seed", value: seed)
                .eq("game_mode", value: mode.rawValue)
                .limit(1).execute().value
            return !rows.isEmpty
        } catch { return nil }
    }

    // MARK: - Run-cumulative scoring inputs (shared)

    /// Inputs for record()/DailyResultsService.record computed from a terminal
    /// GameState — ONE implementation shared by GameViewModel's live finish,
    /// its restored-finished backfill and [backfillFinishedDailySaves], so the
    /// three can never disagree (Android computeRunScore parity). Gauntlet
    /// scores the WHOLE run: guesses summed across stageResults (+ the failed
    /// stage's max on a loss — state.boards only holds the final stage), boards
    /// solved tallied across stages, denominator = every stage's boardCount
    /// (21). Single-board: best green count across the player's OWN guesses —
    /// hintEvaluations is keyed by ROW INDEX, so hint rows are excluded by
    /// index and revealed letters can't inflate the near-miss credit.
    struct RunScore {
        let won: Bool
        let guessCount: Int
        let boardsSolved: Int
        let totalBoards: Int
        let stagesCompleted: Int?
        let bestCorrectLetters: Int?
    }

    static func computeRunScore(_ state: GameState, mode: GameMode) -> RunScore {
        let won = state.status == .won
        if mode == .gauntlet, let g = state.gauntlet {
            let completedStageGuesses = g.stageResults.reduce(0) { $0 + $1.guesses }
            let currentStageGuesses = won ? 0 : state.boards.reduce(0) { max($0, $1.guesses.count) }
            let solved = g.stageResults.reduce(0) { sum, r in
                if r.status == .won { return sum + (g.stages[safe: r.stageIndex]?.boardCount ?? 0) }
                return sum + (r.boardsSnapshot?.filter { $0.status == .won }.count ?? 0)
            }
            let allBoards = g.stages.reduce(0) { $0 + $1.boardCount }
            return RunScore(won: won, guessCount: completedStageGuesses + currentStageGuesses,
                            boardsSolved: solved, totalBoards: allBoards > 0 ? allBoards : 21,
                            stagesCompleted: g.stageResults.filter { $0.status == .won }.count,
                            bestCorrectLetters: nil)
        }
        let guesses = state.boards.map { $0.guesses.count }.max() ?? 0
        let solved = state.boards.filter { $0.status == .won }.count
        var bestCorrect: Int?
        if state.boards.count == 1, let b = state.boards.first {
            bestCorrect = b.guesses.enumerated().reduce(0) { best, pair in
                b.hintEvaluations?[String(pair.offset)] != nil
                    ? best
                    : max(best, evaluateGuess(solution: b.solution, guess: pair.element)
                        .tiles.filter { $0.state == .correct }.count)
            }
        }
        return RunScore(won: won, guessCount: guesses, boardsSolved: solved,
                        totalBoards: state.boards.count, stagesCompleted: nil,
                        bestCorrectLetters: bestCorrect)
    }

    /// Hints for a game reconstructed from disk: hint ROWS live on the board
    /// (hintEvaluations), the zero-candidate "—" uses only in the persisted
    /// hint-UI dict (GameViewModel.persistHintUI) — same approximation the
    /// restored post-game breakdown shows.
    private static func persistedHintsUsed(state: GameState, mode: GameMode, seed: String) -> Int {
        let base = state.boards.first?.hintEvaluations?.count ?? 0
        guard mode == .duel6 || mode == .duel7,
              let d = UserDefaults.standard.dictionary(forKey: "wordocious-hints-\(mode.rawValue)-\(seed)") as? [String: String]
        else { return base }
        return base + (d["vowelRevealed"] == "—" ? 1 : 0) + (d["consonantRevealed"] == "—" ? 1 : 0)
    }

    // MARK: - Launch-time finished-save sweep

    /// Safety net for finishes the record pipeline never SAW (run right after
    /// PendingRecords.drain() each launch — Android backfillFinishedDailySaves
    /// parity). The pending-record queue only protects games whose record call
    /// at least started — register() is its first act. The Android incident
    /// proved a finish can be dropped BEFORE that point (a crash on the finish
    /// frame, a stale already-recorded flag): the terminal board sits in local
    /// persistence, but there is no queue entry, no server rows and no
    /// telemetry, and nothing re-reads that save unless the exact board screen
    /// is reopened. This sweep checks every daily mode's TODAY save each launch:
    ///  - finished save + daily row present   → nothing owed (common, 1 probe)
    ///  - daily row missing + NO matches row  → full record (matches + stats/
    ///    XP + daily; from here the queue owns any further failure)
    ///  - daily row missing + matches row     → re-assert the daily row alone
    ///    (idempotent best-score upsert — a full record() would double stats)
    ///  - either probe failed                 → skip this launch, retry next
    /// Solo daily seeds only. Seeds with a pending payload are drain()'s to
    /// replay, not ours.
    static func backfillFinishedDailySaves() async {
        // The GamePersistence-backed daily modes (ProperNoundle persists via its
        // own snapshot slot and is swept separately below).
        let modes: [GameMode] = [.duel, .quordle, .octordle, .sequence, .rescue, .gauntlet, .duel6, .duel7]
        for mode in modes {
            let seed = DailySeed.today(mode: mode)
            guard let state = GamePersistence.shared.load(seed: seed, mode: mode),
                  state.status != .playing else { continue }
            if PendingRecords.hasPayload(gameMode: mode.rawValue, seed: seed) { continue }
            // Row already there (or the probe failed → next launch retries).
            guard await !dailyRowExists(seed: seed, mode: mode) else { continue }
            guard let matchExists = await dailyMatchRowExists(seed: seed, mode: mode) else { continue }
            let rs = computeRunScore(state, mode: mode)
            let hints = persistedHintsUsed(state: state, mode: mode, seed: seed)
            let elapsed = max(0, Int(GamePersistence.shared.loadElapsed(seed: seed, mode: mode) / 1000))
            if matchExists {
                await DailyResultsService.record(
                    gameMode: mode, completed: rs.won, guessCount: rs.guessCount,
                    timeSeconds: elapsed, boardsSolved: rs.boardsSolved,
                    totalBoards: rs.totalBoards, hintsUsed: hints, seed: seed,
                    stagesCompleted: rs.stagesCompleted, bestCorrectLetters: rs.bestCorrectLetters)
                continue
            }
            // Nothing landed — full record, mirroring GameViewModel's live
            // finish (matches row, stats/XP/daily, gauntlet stage breakdown).
            let guessWords = (mode == .sequence || mode == .gauntlet)
                ? state.boards.flatMap(\.guesses)
                : state.boards.max(by: { $0.guesses.count < $1.guesses.count })?.guesses ?? []
            await recordSoloMatch(
                gameMode: mode, won: rs.won, score: rs.guessCount, timeSeconds: elapsed,
                seed: seed, solutions: state.boards.map(\.solution), guesses: guessWords,
                hintsUsed: hints)
            _ = await record(
                gameMode: mode, won: rs.won, guessCount: rs.guessCount,
                timeSeconds: elapsed, boardsSolved: rs.boardsSolved,
                totalBoards: rs.totalBoards, seed: seed, hintsUsed: hints,
                stagesCompleted: rs.stagesCompleted, bestCorrectLetters: rs.bestCorrectLetters)
            if mode == .gauntlet, let g = state.gauntlet {
                await recordGauntletStages(seed: seed,
                                           payload: .init(stages: g.stages, stageResults: g.stageResults))
            }
        }
        await backfillFinishedPNDailySave()
    }

    /// ProperNoundle's daily save lives in its own UserDefaults slot
    /// ("pn-save-daily", ProperNoundleVM.Snapshot), not GamePersistence — and
    /// its completed-restore path assumes finished ⇒ posted, so a crash on the
    /// finish frame loses the PN daily with no queue entry. Same sweep contract
    /// as above, reading the snapshot's persisted fields directly.
    private static func backfillFinishedPNDailySave() async {
        // Mirror of ProperNoundleVM.Snapshot (decode-only, extra fields ignored).
        struct PNSnap: Decodable {
            let puzzleId: String
            let date: String
            let guessWords: [String]
            let guessTiles: [[NTile]]
            let status: Int
            let clue: String?
            let revealedVowel: String?
            let revealedConsonant: String?
            let elapsed: Int
        }
        guard let data = UserDefaults.standard.data(forKey: "pn-save-daily"),
              let snap = try? JSONDecoder().decode(PNSnap.self, from: data),
              snap.status != 0,
              snap.date == LeaderboardService.todayLocal(),
              let puzzle = ProperNoundle.dailyPuzzle(),
              snap.puzzleId == puzzle.id
        else { return }
        let mode = GameMode.propernoundle
        let seed = DailySeed.today(mode: mode)
        if PendingRecords.hasPayload(gameMode: mode.rawValue, seed: seed) { return }
        guard await !dailyRowExists(seed: seed, mode: mode) else { return }
        guard let matchExists = await dailyMatchRowExists(seed: seed, mode: mode) else { return }
        // Same inputs ProperNoundleVM.finish() derives from its live state.
        let won = snap.status == 1
        let gc = snap.guessWords.count
        let hints = [snap.clue, snap.revealedVowel, snap.revealedConsonant].compactMap { $0 }.count
        let bestCorrect = snap.guessTiles.reduce(0) { best, tiles in
            max(best, tiles.filter { $0 == .correct }.count)
        }
        if matchExists {
            await DailyResultsService.record(
                gameMode: mode, completed: won, guessCount: gc, timeSeconds: snap.elapsed,
                boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: hints, seed: seed,
                bestCorrectLetters: bestCorrect)
            return
        }
        await recordSoloMatch(
            gameMode: mode, won: won, score: gc, timeSeconds: snap.elapsed, seed: seed,
            solutions: [ProperNoundle.normalize(puzzle.answer)], guesses: snap.guessWords,
            hintsUsed: hints)
        _ = await record(
            gameMode: mode, won: won, guessCount: gc, timeSeconds: snap.elapsed,
            boardsSolved: won ? 1 : 0, totalBoards: 1, seed: seed, hintsUsed: hints,
            bestCorrectLetters: bestCorrect)
    }

    static func record(
        gameMode: GameMode,
        playType: String = "solo",
        won: Bool,
        guessCount: Int,
        timeSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        seed: String,
        hintsUsed: Int = 0,
        stagesCompleted: Int? = nil,
        bestCorrectLetters: Int? = nil,
        // VS draw: pass won=false + isDraw=true. A draw counts the game (and
        // its time) but does NOT increment losses or reset the win streak
        // (web stats-service.ts recordGameResult parity).
        isDraw: Bool = false
    ) async -> XpResult? {
        let client = AuthService.shared.client
        // THE line that dropped finished games. This was
        // `guard let session = try? await client.auth.session` — a refreshing,
        // network-touching accessor — so a game finished offline returned nil
        // here, at the very first statement, before the register() below. The
        // one failure the pending-record queue was built for was the one
        // failure that bypassed it: no queue entry, no user feedback, no
        // telemetry, and no self-heal for the rest of the session. localUserId()
        // reads the stored session instead, which is available offline.
        guard let userId = localUserId() else {
            reportDroppedResult("record", gameMode: gameMode.rawValue,
                                reason: "no local session while recording a finished game")
            return nil
        }
        let mode = gameMode.rawValue

        // Crash-protection: persist the args locally BEFORE any network call so
        // a kill/offline finish is re-run by PendingRecords.drain() next launch.
        // Solo only — VS results are server-coordinated and must not retry.
        let trackPending = playType == "solo"
        if trackPending {
            PendingRecords.register(
                userId: userId, gameMode: mode, seed: seed,
                gameResult: .init(won: won, guessCount: guessCount, timeSeconds: timeSeconds,
                                  boardsSolved: boardsSolved, totalBoards: totalBoards,
                                  hintsUsed: hintsUsed, stagesCompleted: stagesCompleted,
                                  bestCorrectLetters: bestCorrectLetters))
        }

        await updateUserStats(client, userId: userId, mode: mode, playType: playType,
                              won: won, guessCount: guessCount, timeSeconds: timeSeconds,
                              isDraw: isDraw)
        let xp = await updateProfileProgression(client, userId: userId, won: won, seed: seed,
                                                isDraw: isDraw, mode: mode)

        var result = xp
        if playType == "vs" {
            // EVERY completed VS match accumulates into the local day's
            // daily_results row (play_type='vs') — vs_wins/vs_losses/vs_games —
            // so the VS daily leaderboard and VS records see all matches, not
            // just daily-seed ones (web stats-service.ts recordDailyVsResult
            // parity: the VS branch records unconditionally). Draws count the
            // game (vs_games+1, completed) without a win OR a loss.
            await DailyResultsService.recordVs(gameMode: gameMode, won: won, isDraw: isDraw)
        } else if isDailySeed(seed) {
            // The daily row's landing is tracked as its OWN pending part: it is
            // written after the progression, so `xp != nil` (the .gameResult
            // proxy below) says nothing about it — a cut daily write used to be
            // released with the leaderboard row still unwritten and nothing
            // queued to retry it. Non-nil return = the row is KNOWN to be on
            // the server (inserted, updated, or already outranking this run).
            let dailyScore = await DailyResultsService.record(
                gameMode: gameMode, completed: won, guessCount: guessCount,
                timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
                hintsUsed: hintsUsed, seed: seed,
                stagesCompleted: stagesCompleted, bestCorrectLetters: bestCorrectLetters
            )
            // nil ALSO means "mode has no daily scoring config" — no row is
            // ever owed then, and the flag must not hold the payload hostage.
            if trackPending, dailyScore != nil || DailyScoring.config[gameMode.rawValue] == nil {
                PendingRecords.markDone(gameMode: mode, seed: seed, part: .daily)
            }
            // Daily Sweep / Flawless bonus once all 9 dailies are in (web parity).
            // Kept SPLIT from dailyBonus so the toast shows distinct
            // "+200 sweep" / "+400 flawless" chips like web xp-toast.tsx.
            let (sweep, flawless) = await MedalService.awardDailyBonusesIfComplete(client, userId: userId)
            if sweep + flawless > 0, let x = result {
                // §244: on the flawless-clinching win, the toast says the
                // STREAK, not just the bonus — one extra daily_bonuses read,
                // at most once a day, which also refreshes the header-pill
                // cache at the exact moment the streak grows.
                let streak = flawless > 0
                    ? (await MatchStatsService.dailySweepStats()).currentFlawlessStreak : 0
                let newTotal = x.totalXp + sweep + flawless
                result = XpResult(xpGain: x.xpGain, streakBonus: x.streakBonus,
                                  dailyBonus: x.dailyBonus, totalXp: newTotal,
                                  newLevel: newTotal / 1000 + 1,
                                  leveledUp: x.leveledUp || (newTotal / 1000 + 1) > x.newLevel,
                                  sweepBonus: sweep, flawlessBonus: flawless,
                                  flawlessStreak: streak)
            }
        }

        // Release the crash-protection payload only now, AFTER the daily row,
        // the streak/perfect medals and the sweep bonus — web's ordering
        // (stats-service.ts marks done below its daily writes). This used to
        // fire right after the progression call, above the block, which left a
        // window where a connection blip between the two cost the player their
        // daily leaderboard row, their medal and the +200/+400 sweep bonus with
        // nothing queued to retry any of it. Success proxy stays the profile
        // progression (a failed/offline run keeps the payload).
        if trackPending && xp != nil {
            PendingRecords.markDone(gameMode: mode, seed: seed, part: .gameResult)
        }

        // Refresh the in-memory profile so XP/streak/Pro reflect immediately.
        await AuthService.shared.refreshProfile()

        // All-time "hall of records" writes (web stats-service.ts parity —
        // previously deferred). Fire-and-forget after stats/profile are updated
        // so the fresh totals (total_games, best_streak, xp, gold_medals) read
        // back correctly. Never blocks the post-game flow.
        Task {
            await RecordsService.updateAfterGame(
                userId: userId, gameMode: mode, playType: playType,
                won: won, guessCount: guessCount, timeSeconds: timeSeconds, seed: seed)
        }
        return result
    }

    /// Record a CPU / bot VS result into its OWN bucket (play_type='vs_cpu').
    /// Pure practice: writes ONLY user_stats — no profiles/XP, no matches row,
    /// no daily_results, no achievements. So CPU games never reach the daily
    /// leaderboard, head-to-head, per-mode streaks, or all-time records, and
    /// never fire a VS achievement. Best-effort.
    static func recordCpuResult(gameMode: GameMode, won: Bool, guessCount: Int, timeSeconds: Int) async {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        let userId = session.user.id.uuidString
        await updateUserStats(client, userId: userId, mode: gameMode.rawValue, playType: "vs_cpu",
                              won: won, guessCount: guessCount, timeSeconds: timeSeconds)
    }

    private static func updateUserStats(
        _ client: SupabaseClient, userId: String, mode: String, playType: String,
        won: Bool, guessCount: Int, timeSeconds: Int, isDraw: Bool = false
    ) async {
        // A drawn VS never counts as a loss (web parity).
        let lossInc = (won || isDraw) ? 0 : 1
        do {
            let rows: [StatsRow] = try await client.from("user_stats")
                .select("id, wins, losses, total_games, best_score, average_time, fastest_time")
                .eq("user_id", value: userId).eq("game_mode", value: mode).eq("play_type", value: playType)
                .limit(1).execute().value

            if let s = rows.first {
                let newTotal = s.totalGames + 1
                let newAvg = s.averageTime > 0 ? Int((Double(s.averageTime * s.totalGames + timeSeconds) / Double(newTotal)).rounded()) : timeSeconds
                let newBest = (guessCount > 0 && (s.bestScore == 0 || guessCount < s.bestScore)) ? guessCount : s.bestScore
                let newFastest = (timeSeconds > 0 && (s.fastestTime == 0 || timeSeconds < s.fastestTime)) ? timeSeconds : s.fastestTime
                let upd = StatsUpdate(wins: s.wins + (won ? 1 : 0), losses: s.losses + lossInc,
                                      total_games: newTotal, best_score: newBest,
                                      average_time: newAvg, fastest_time: newFastest)
                try await client.from("user_stats").update(upd).eq("id", value: s.id).execute()
            } else {
                let ins = StatsInsert(user_id: userId, game_mode: mode, play_type: playType,
                                      wins: won ? 1 : 0, losses: lossInc, total_games: 1,
                                      best_score: guessCount, average_time: timeSeconds, fastest_time: timeSeconds)
                try await client.from("user_stats").insert(ins).execute()
            }
        } catch {
            // Best-effort stays, but the failure is captured, not swallowed.
            reportRejectedWrite("updateUserStats(\(playType))", gameMode: mode, error)
        }
    }

    /// XP earned by a finished game — drives the post-game XP toast.
    /// sweep/flawless are SPLIT from dailyBonus so the toast can render the
    /// distinct "+200 sweep" / "+400 flawless" chips (web xp-toast.tsx parity).
    struct XpResult {
        let xpGain: Int, streakBonus: Int, dailyBonus: Int
        let totalXp: Int, newLevel: Int, leveledUp: Bool
        var sweepBonus: Int = 0
        var flawlessBonus: Int = 0
        /// §244: consecutive flawless days including today (set on flawless days).
        var flawlessStreak: Int = 0
    }

    @discardableResult
    private static func updateProfileProgression(
        _ client: SupabaseClient, userId: String, won: Bool, seed: String,
        isDraw: Bool = false, mode: String = ""
    ) async -> XpResult? {
        do {
            let rows: [ProfileRow] = try await client.from("profiles")
                .select("total_wins,total_losses,current_streak,best_streak,xp,level,last_played_at,daily_login_streak,best_daily_login_streak,streak_shields")
                .eq("id", value: userId).limit(1).execute().value
            guard let p = rows.first else { return nil }

            // Win streak resets on a loss; a draw leaves it untouched (web parity).
            let newWinStreak = won ? p.currentStreak + 1 : (isDraw ? p.currentStreak : 0)
            let newBestWinStreak = max(p.bestStreak, newWinStreak)

            let xpGain = won ? 100 : 25
            let streakBonus = (won && newWinStreak > 1) ? 50 : 0
            let dailyBonus = isDailySeed(seed) ? 50 : 0
            let newXp = p.xp + xpGain + streakBonus + dailyBonus
            let newLevel = newXp / 1000 + 1

            // Daily-login streak (player-local days).
            let today = LeaderboardService.todayLocal()
            let yesterday = localDayString(daysAgo: 1)
            var newDailyStreak = p.dailyLoginStreak
            var grantShield = false
            if let last = p.lastPlayedAt, let lastDate = parseTimestamp(last) {
                let lastDay = localDayString(from: lastDate)
                if lastDay == today { /* same day, no change */ }
                else if lastDay == yesterday {
                    newDailyStreak += 1
                    if newDailyStreak % 7 == 0 { grantShield = true }
                } else { newDailyStreak = 1 }
            } else {
                newDailyStreak = 1
            }
            let newBestDaily = max(p.bestDailyLoginStreak, newDailyStreak)

            let upd = ProfileUpdate(
                total_wins: p.totalWins + (won ? 1 : 0),
                total_losses: p.totalLosses + ((won || isDraw) ? 0 : 1),
                current_streak: newWinStreak, best_streak: newBestWinStreak,
                xp: newXp, level: newLevel,
                last_played_at: ISO8601DateFormatter().string(from: Date()),
                daily_login_streak: newDailyStreak, best_daily_login_streak: newBestDaily,
                // Shields are NOT written here any more. streak_shields is a paid
                // benefit (+4 per billing period) and a referral reward, and a
                // client that can raise it can mint one for free — so the column
                // is server-owned now. The 7-day milestone goes through
                // /api/shields/grant-milestone, which recomputes the streak from
                // daily_results instead of trusting the value we just wrote.
                streak_shields: p.streakShields
            )
            try await client.from("profiles").update(upd).eq("id", value: userId).execute()
            if grantShield { await ShieldService.grantMilestoneShield() }
            return XpResult(xpGain: xpGain, streakBonus: streakBonus, dailyBonus: dailyBonus,
                            totalXp: xpGain + streakBonus + dailyBonus,
                            newLevel: newLevel, leveledUp: newLevel > (p.level ?? 1))
        } catch {
            // Best-effort stays (nil = no XP toast), but capture the failure —
            // a silently failing progression write loses XP/streaks invisibly.
            reportRejectedWrite("updateProfileProgression", gameMode: mode, error)
            return nil
        }
    }

    // MARK: - Local day helpers (match lib/daily-service.ts toLocalDayString)

    private static func localDayString(from date: Date = Date()) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        return f.string(from: date)
    }
    private static func localDayString(daysAgo: Int) -> String {
        localDayString(from: Calendar.current.date(byAdding: .day, value: -daysAgo, to: Date()) ?? Date())
    }
}
