import Foundation

// BI15 — the storage + bookkeeping half of the app's PendingRecords queue,
// moved into WordociousCore so it is unit-testable without Supabase. The app
// target (PendingRecords.swift) keeps the network replay (drain); everything
// that decides "is this result still owed to the server?" lives here.
//
// Contract: a finished solo game is registered BEFORE any network write; each
// part (progression / matches row / daily_results row) is marked done only on a
// CONFIRMED success. Any other outcome — an error, a URLSession timeout, the
// write deadline below, a cancel, an app kill — leaves the part outstanding,
// and the next drain (launch, foreground, network back) replays it.

public struct PendingGameResultArgs: Codable, Equatable {
    public var won: Bool
    public var guessCount: Int
    public var timeSeconds: Int
    public var boardsSolved: Int
    public var totalBoards: Int
    public var hintsUsed: Int
    public var stagesCompleted: Int?
    public var bestCorrectLetters: Int?
    public init(won: Bool, guessCount: Int, timeSeconds: Int, boardsSolved: Int, totalBoards: Int,
                hintsUsed: Int, stagesCompleted: Int? = nil, bestCorrectLetters: Int? = nil) {
        self.won = won; self.guessCount = guessCount; self.timeSeconds = timeSeconds
        self.boardsSolved = boardsSolved; self.totalBoards = totalBoards; self.hintsUsed = hintsUsed
        self.stagesCompleted = stagesCompleted; self.bestCorrectLetters = bestCorrectLetters
    }
}

public struct PendingSoloMatchArgs: Codable, Equatable {
    public var won: Bool
    public var score: Int
    public var timeSeconds: Int
    public var solutions: [String]
    public var guesses: [String]
    public var hintsUsed: Int
    public init(won: Bool, score: Int, timeSeconds: Int, solutions: [String], guesses: [String], hintsUsed: Int) {
        self.won = won; self.score = score; self.timeSeconds = timeSeconds
        self.solutions = solutions; self.guesses = guesses; self.hintsUsed = hintsUsed
    }
}

/// One finished game's outstanding writes (JSON shape unchanged from the
/// app-target struct it replaces, so payloads queued by older builds decode).
public struct PendingPayload: Codable, Equatable {
    public var userId: String
    public var gameMode: String
    public var seed: String
    public var savedAt: Double // ms since epoch
    public var gameResult: PendingGameResultArgs?
    public var gameResultDone: Bool?
    public var soloMatch: PendingSoloMatchArgs?
    public var soloMatchDone: Bool?
    /// daily_results row landed (daily seeds only). nil on old payloads = outstanding.
    public var dailyDone: Bool?

    public init(userId: String, gameMode: String, seed: String, savedAt: Double) {
        self.userId = userId; self.gameMode = gameMode; self.seed = seed; self.savedAt = savedAt
    }

    /// Every tracked write landed. The daily leg applies only to daily seeds
    /// whose progression part is registered.
    public var allDone: Bool {
        (gameResult == nil || gameResultDone == true)
            && (soloMatch == nil || soloMatchDone == true)
            && (gameResult == nil || dailyDone == true || !isDailySeed(seed))
    }

    /// The daily_results row for this game is still owed to the server.
    public var dailyRowOutstanding: Bool {
        gameResult != nil && isDailySeed(seed) && dailyDone != true
    }

    public var outstanding: Set<PendingPart> {
        var s: Set<PendingPart> = []
        if gameResult != nil && gameResultDone != true { s.insert(.gameResult) }
        if soloMatch != nil && soloMatchDone != true { s.insert(.soloMatch) }
        if dailyRowOutstanding { s.insert(.daily) }
        return s
    }
}

public enum PendingPart: String, Codable, Hashable { case gameResult, soloMatch, daily }

/// Thrown by `withWriteDeadline` when a write has not settled in time. The
/// outage of 2026-10-02 had REST requests hanging ~30 s: a hung write must fail
/// into the queue, never hold the finish flow (or the Home flip) hostage.
public struct WriteDeadlineExceeded: Error, Equatable {
    public let seconds: Double
    public init(seconds: Double) { self.seconds = seconds }
}

/// Run `operation`, throwing `WriteDeadlineExceeded` (and cancelling it) if it
/// has not finished within `seconds`.
public func withWriteDeadline<T: Sendable>(
    seconds: Double, _ operation: @escaping @Sendable () async throws -> T
) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(max(0, seconds) * 1_000_000_000))
            throw WriteDeadlineExceeded(seconds: seconds)
        }
        defer { group.cancelAll() }
        guard let first = try await group.next() else { throw WriteDeadlineExceeded(seconds: seconds) }
        return first
    }
}

/// UserDefaults-backed pending-record ledger (injectable for tests).
public final class PendingRecordStore: @unchecked Sendable {
    public static let keyPrefix = "wordocious.pending-record."
    public static let maxAgeMs: Double = 7 * 24 * 60 * 60 * 1000

    private let defaults: UserDefaults
    private let lock = NSLock()
    /// Live record calls per key. drain() must never replay a game whose live
    /// write is still hanging — that double-counts stats/XP when both land.
    private var inFlight: [String: Int] = [:]

    public init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    public static func key(_ gameMode: String, _ seed: String) -> String { keyPrefix + gameMode + "-" + seed }

    public func read(_ key: String) -> PendingPayload? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PendingPayload.self, from: data)
    }
    public func payload(gameMode: String, seed: String) -> PendingPayload? { read(Self.key(gameMode, seed)) }
    public func hasPayload(gameMode: String, seed: String) -> Bool { payload(gameMode: gameMode, seed: seed) != nil }

    public func write(_ key: String, _ payload: PendingPayload) {
        if let data = try? JSONEncoder().encode(payload) { defaults.set(data, forKey: key) }
    }
    public func remove(_ key: String) { defaults.removeObject(forKey: key) }

    public func keys() -> [String] {
        defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(Self.keyPrefix) }
    }

    /// Merge one part's args into the payload for this game (creating it if
    /// absent). Called BEFORE any network write.
    public func register(userId: String, gameMode: String, seed: String,
                         gameResult: PendingGameResultArgs? = nil,
                         soloMatch: PendingSoloMatchArgs? = nil,
                         now: Date = Date()) {
        lock.lock(); defer { lock.unlock() }
        let k = Self.key(gameMode, seed)
        var p = read(k) ?? PendingPayload(userId: userId, gameMode: gameMode, seed: seed,
                                          savedAt: now.timeIntervalSince1970 * 1000)
        p.userId = userId
        if let g = gameResult { p.gameResult = g; p.gameResultDone = false }
        if let s = soloMatch { p.soloMatch = s; p.soloMatchDone = false }
        write(k, p)
    }

    /// Mark one part complete (confirmed success only); remove the key when
    /// every registered part is done.
    public func markDone(gameMode: String, seed: String, part: PendingPart) {
        lock.lock(); defer { lock.unlock() }
        let k = Self.key(gameMode, seed)
        guard var p = read(k) else { return }
        switch part {
        case .gameResult: p.gameResultDone = true
        case .soloMatch: p.soloMatchDone = true
        case .daily: p.dailyDone = true
        }
        if p.allDone { remove(k) } else { write(k, p) }
    }

    // MARK: In-flight tracking

    public func beginFlight(gameMode: String, seed: String) {
        lock.lock(); defer { lock.unlock() }
        inFlight[Self.key(gameMode, seed), default: 0] += 1
    }
    public func endFlight(gameMode: String, seed: String) {
        lock.lock(); defer { lock.unlock() }
        let k = Self.key(gameMode, seed)
        let n = (inFlight[k] ?? 1) - 1
        if n <= 0 { inFlight.removeValue(forKey: k) } else { inFlight[k] = n }
    }
    public func isInFlight(_ key: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return (inFlight[key] ?? 0) > 0
    }

    /// One tracked write: the part is marked done ONLY when `op` returns
    /// normally within the deadline. A throw — server error, URLError.timedOut,
    /// WriteDeadlineExceeded, cancellation — leaves it outstanding for drain().
    @discardableResult
    public func attempt(gameMode: String, seed: String, part: PendingPart, deadlineSeconds: Double,
                        _ op: @escaping @Sendable () async throws -> Void) async -> Bool {
        do {
            try await withWriteDeadline(seconds: deadlineSeconds, op)
            markDone(gameMode: gameMode, seed: seed, part: part)
            return true
        } catch {
            return false
        }
    }

    /// Today's daily results that finished on THIS device but whose
    /// daily_results row has not been confirmed yet — Home shows them as
    /// completed (W/L) while the queue retries, so an outage never makes a
    /// finished daily look unplayed.
    public func outstandingDailies(userId: String, day: String, now: Date = Date()) -> [PendingPayload] {
        keys().compactMap { read($0) }.filter { p in
            p.userId.lowercased() == userId.lowercased()
                && p.dailyRowOutstanding
                && getDailySeedDate(p.seed) == day
                && now.timeIntervalSince1970 * 1000 - p.savedAt <= Self.maxAgeMs
        }
    }
}
