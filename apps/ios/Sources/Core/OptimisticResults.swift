import Foundation

/// FINISH_SPEC BI19: a finished daily shows everywhere at once — Home's W/L,
/// the player's own leaderboard row in rank order — from the result the phone
/// already holds, then reconciles silently with the server (the server wins).
///
/// Same rules: Android `OptimisticResults`, web `lib/optimistic-results.ts`.
public enum OptimisticResults {
    /// The board's order: composite score desc, then time asc (the server's ORDER BY).
    public static func ranksAbove(score: Double, time: Double, otherScore: Double, otherTime: Double) -> Bool {
        score > otherScore || (score == otherScore && time < otherTime)
    }

    /// Where the player's local row goes in `rows` (already in board order), or
    /// nil when it must not be inserted: the server's rows already hold the
    /// player (reconciled — the server's row wins, whatever its values), the
    /// local result has no score, or it falls past the visible list (`limit`).
    public static func insertionIndex<Row>(
        rows: [Row], userId: String, score: Double, time: Double,
        rowUserId: (Row) -> String, rowScore: (Row) -> Double, rowTime: (Row) -> Double,
        limit: Int = 50
    ) -> Int? {
        guard score > 0 else { return nil }
        let me = userId.lowercased()
        if rows.contains(where: { rowUserId($0).lowercased() == me }) { return nil }
        let i = rows.firstIndex { ranksAbove(score: score, time: time, otherScore: rowScore($0), otherTime: rowTime($0)) }
            ?? rows.count
        return i < limit ? i : nil
    }

    /// `rows` with the local row placed in rank order (see insertionIndex), plus
    /// the player's 1-based rank and the board size when it was placed.
    public static func merge<Row>(
        rows: [Row], playerCount: Int, local: Row?, userId: String, score: Double, time: Double,
        rowUserId: (Row) -> String, rowScore: (Row) -> Double, rowTime: (Row) -> Double,
        limit: Int = 50
    ) -> (rows: [Row], playerCount: Int, rank: (rank: Int, total: Int)?) {
        guard let local, let i = insertionIndex(rows: rows, userId: userId, score: score, time: time,
                                                rowUserId: rowUserId, rowScore: rowScore, rowTime: rowTime,
                                                limit: limit)
        else { return (rows, playerCount, nil) }
        var out = rows
        out.insert(local, at: i)
        let total = max(playerCount + 1, out.count)
        return (out, total, (rank: i + 1, total: total))
    }
}

/// FINISH_SPEC BI19: today's per-mode results on this device (Home's W/L map),
/// persisted so a relaunch paints them before any network. Best-result
/// semantics (a replay never downgrades a recorded win), day-scoped (a finish
/// after local midnight starts a fresh day), and the server wins on reconcile.
public struct CompletionLedger<Result: Codable> {
    public private(set) var day: String
    public private(set) var byMode: [String: Result]
    private let isWin: (Result) -> Bool

    public init(day: String, byMode: [String: Result] = [:], isWin: @escaping (Result) -> Bool) {
        self.day = day; self.byMode = byMode; self.isWin = isWin
    }

    /// A finish, applied synchronously (no network). Returns whether it changed the map.
    @discardableResult
    public mutating func apply(mode: String, result: Result, today: String) -> Bool {
        if day != today { day = today; byMode = [:] }
        if let existing = byMode[mode], isWin(existing), !isWin(result) { return false }
        byMode[mode] = result
        return true
    }

    /// The server's rows for `today` are authoritative; `stillPending` (this
    /// session's finishes the server hasn't surfaced yet, or ones in the write
    /// queue) fill only the modes the server doesn't have.
    public mutating func reconcile(server: [String: Result], stillPending: [String: Result], today: String) {
        var merged = server
        for (k, v) in stillPending where merged[k] == nil { merged[k] = v }
        day = today
        byMode = merged
    }

    // MARK: Persistence (survives relaunch)

    private struct Stored: Codable { let day: String; let byMode: [String: Result] }

    public func save(to defaults: UserDefaults, key: String) {
        if let data = try? JSONEncoder().encode(Stored(day: day, byMode: byMode)) {
            defaults.set(data, forKey: key)
        }
    }

    /// Today's persisted map, or nil when nothing is stored or it is another day's.
    public static func load(from defaults: UserDefaults, key: String, today: String) -> [String: Result]? {
        guard let data = defaults.data(forKey: key),
              let s = try? JSONDecoder().decode(Stored.self, from: data), s.day == today else { return nil }
        return s.byMode
    }
}

/// FINISH_SPEC BI19: cache-first pages. A page paints its last data, then a
/// background fetch swaps in only what changed — and never blanks it.
public enum CacheFirst {
    /// The value to show after a fetch: `fresh`, unless it came back empty while
    /// the cache holds data (a failed or degraded fetch — the services swallow
    /// errors into empties), in which case the cache stays.
    public static func keep<C: Collection>(fresh: C, cached: C) -> C {
        fresh.isEmpty && !cached.isEmpty ? cached : fresh
    }

    /// Optional fetch results: nil (failed) keeps the cache.
    public static func keep<T>(fresh: T?, cached: T?) -> T? { fresh ?? cached }

    /// Whether to assign at all (swap in only if it changed).
    public static func changed<T: Equatable>(_ new: T, from old: T) -> Bool { new != old }
}

/// FINISH_SPEC BI19: a small persisted key → JSON store behind the in-memory
/// page memos, so pages paint their last data on a cold launch too. Versioned
/// (a format change discards old data instead of mis-decoding it) and
/// size-bounded (oldest-written entries go first).
public final class PersistentMemoStore {
    public static let version = 1
    private struct Entry: Codable { var data: Data; var at: Double }
    private struct File: Codable { var version: Int; var entries: [String: Entry] }

    private let url: URL
    private let maxBytes: Int
    private var entries: [String: Entry]
    private let lock = NSLock()

    public init(url: URL, maxBytes: Int = 2_000_000) {
        self.url = url
        self.maxBytes = maxBytes
        if let data = try? Data(contentsOf: url),
           let f = try? JSONDecoder().decode(File.self, from: data), f.version == Self.version {
            entries = f.entries
        } else {
            entries = [:]
        }
    }

    public func get<T: Decodable>(_ key: String, as: T.Type = T.self) -> T? {
        lock.lock(); let e = entries[key]; lock.unlock()
        guard let e else { return nil }
        return try? JSONDecoder().decode(T.self, from: e.data)
    }

    /// Stores in memory; call `flush()` to write (callers debounce).
    public func set<T: Encodable>(_ key: String, _ value: T) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        lock.lock(); entries[key] = Entry(data: data, at: Date().timeIntervalSince1970); lock.unlock()
    }

    public func remove(prefix: String) {
        lock.lock(); entries = entries.filter { !$0.key.hasPrefix(prefix) }; lock.unlock()
    }

    /// Writes to disk, trimming the oldest entries past `maxBytes`.
    public func flush() {
        lock.lock()
        var total = entries.values.reduce(0) { $0 + $1.data.count }
        if total > maxBytes {
            for (k, e) in entries.sorted(by: { $0.value.at < $1.value.at }) where total > maxBytes {
                entries[k] = nil
                total -= e.data.count
            }
        }
        let snapshot = File(version: Self.version, entries: entries)
        lock.unlock()
        if let data = try? JSONEncoder().encode(snapshot) {
            try? data.write(to: url, options: .atomic)
        }
    }
}
