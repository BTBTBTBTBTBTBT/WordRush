import Foundation
import WordociousCore

/// Persists in-progress games to disk so backgrounding/relaunch resumes the
/// exact board. Keyed by seed+mode, mirroring the web app's localStorage keys.
final class GamePersistence {
    static let shared = GamePersistence()
    private init() {}

    /// Save-format version, gating schema evolution the way the web's
    /// SAVE_VERSION does (use-game-snapshot.ts): a decodable-but-older save is
    /// DISCARDED on mismatch instead of silently restored into a newer
    /// reducer. Bump when GameState's persisted shape changes meaning.
    static let saveVersion = 1

    /// A game started close to local midnight can cross the day boundary.
    /// Keep yesterday's IN-PROGRESS daily loadable for this window instead of
    /// wiping it at the first launch after midnight (web
    /// DAILY_CROSS_MIDNIGHT_GRACE_MS parity — 4h).
    static let crossMidnightGraceSeconds: TimeInterval = 4 * 60 * 60

    /// Versioned on-disk envelope. Legacy files are a bare GameState — decoded
    /// as v1 by the fallback in load(), so shipping this doesn't wipe anyone's
    /// in-flight game.
    private struct VersionedSave: Codable {
        let version: Int
        let state: GameState
    }

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("games", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func key(seed: String, mode: GameMode) -> String {
        let safeSeed = seed.replacingOccurrences(of: "/", with: "_")
        return "wordocious-\(mode.rawValue)-\(safeSeed)"
    }

    private func url(seed: String, mode: GameMode) -> URL {
        directory.appendingPathComponent("\(key(seed: seed, mode: mode)).json")
    }

    func save(_ state: GameState) {
        let envelope = VersionedSave(version: Self.saveVersion, state: state)
        guard let data = try? encoder.encode(envelope) else { return }
        try? data.write(to: url(seed: state.seed, mode: state.mode), options: .atomic)
    }

    func load(seed: String, mode: GameMode) -> GameState? {
        let u = url(seed: seed, mode: mode)
        guard let data = try? Data(contentsOf: u) else { return nil }
        if let envelope = try? decoder.decode(VersionedSave.self, from: data) {
            guard envelope.version == Self.saveVersion else {
                // Versioned but older/newer: discard rather than restore a
                // shape this reducer no longer means the same thing by.
                try? FileManager.default.removeItem(at: u)
                return nil
            }
            return envelope.state
        }
        // Legacy pre-envelope file (bare GameState) — today's shape IS v1.
        return try? decoder.decode(GameState.self, from: data)
    }

    /// If today's daily has no save but YESTERDAY's daily for this mode is
    /// still in progress and was last saved within the cross-midnight grace
    /// window, return yesterday's seed so the caller can resume it (it records
    /// to yesterday — the day always derives from the seed, never the clock).
    /// Web parity: use-game-snapshot.ts's stillPlaying + withinGrace check.
    func gracedYesterdaySeed(todaySeed: String, mode: GameMode) -> String? {
        guard let todayStr = getDailySeedDate(todaySeed),
              let today = dateFromDayString(todayStr),
              let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: today)
        else { return nil }
        let yesterdayStr = dayString(from: yesterday)
        let seed = generateDailySeed(date: yesterdayStr, gameMode: mode.rawValue)
        let u = url(seed: seed, mode: mode)
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: u.path),
              let modified = attrs[.modificationDate] as? Date,
              Date().timeIntervalSince(modified) < Self.crossMidnightGraceSeconds,
              let state = load(seed: seed, mode: mode),
              state.status == .playing
        else { return nil }
        return seed
    }

    private func dayString(from date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func dateFromDayString(_ s: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: s)
    }

    func clear(seed: String, mode: GameMode) {
        try? FileManager.default.removeItem(at: url(seed: seed, mode: mode))
    }

    /// Wipe ALL on-device game saves (every mode/seed) plus the elapsed/hint
    /// keys. Called on sign-out so the next session — a guest, or a different
    /// account — never inherits the previous user's in-progress or finished
    /// boards (which the completed-daily card reads from local persistence).
    func clearAllSaves() {
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            for f in files { try? fm.removeItem(at: f) }
        }
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys
        where key.hasPrefix("wordocious-elapsed-") || key.hasPrefix("wordocious-hints-")
            || key.hasPrefix("pn-save-") {
            defaults.removeObject(forKey: key)
        }
    }

    // MARK: - Active-play elapsed (milliseconds), persisted per seed+mode

    private func elapsedKey(seed: String, mode: GameMode) -> String {
        "wordocious-elapsed-\(mode.rawValue)-\(seed.replacingOccurrences(of: "/", with: "_"))"
    }

    func saveElapsed(_ ms: Double, seed: String, mode: GameMode) {
        UserDefaults.standard.set(ms, forKey: elapsedKey(seed: seed, mode: mode))
    }

    func loadElapsed(seed: String, mode: GameMode) -> Double {
        UserDefaults.standard.double(forKey: elapsedKey(seed: seed, mode: mode))
    }

    /// Storage hygiene: daily games are keyed by date, so their save files (and
    /// elapsed/hint keys) accumulate forever. Remove any daily entry for a date
    /// other than today. Call once at launch. (Web has no such buildup — it uses
    /// a single per-mode localStorage key.)
    func cleanupStaleDailyGames() {
        let today = LeaderboardService.todayLocal()
        // Yesterday's saves get the cross-midnight grace: an IN-PROGRESS daily
        // last touched within the window survives the sweep so
        // gracedYesterdaySeed can resume it (web parity — this sweep used to
        // wipe a 11:58pm game at the 12:05am relaunch).
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date()).map(dayString(from:))
        var keptDates: Set<String> = [today]
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.contentModificationDateKey]) {
            for f in files {
                let base = f.lastPathComponent.replacingOccurrences(of: ".json", with: "")
                guard let r = base.range(of: "-daily-") else { continue }
                let date = String(base[r.upperBound...].prefix(10))   // YYYY-MM-DD
                guard date.count == 10, date != today else { continue }
                if date == yesterday,
                   let attrs = try? fm.attributesOfItem(atPath: f.path),
                   let modified = attrs[.modificationDate] as? Date,
                   Date().timeIntervalSince(modified) < Self.crossMidnightGraceSeconds,
                   let data = try? Data(contentsOf: f),
                   let state = (try? decoder.decode(VersionedSave.self, from: data))?.state
                       ?? (try? decoder.decode(GameState.self, from: data)),
                   state.status == .playing {
                    keptDates.insert(date)
                    continue
                }
                try? fm.removeItem(at: f)
            }
        }
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys
        where key.contains("-daily-") && (key.hasPrefix("wordocious-elapsed-") || key.hasPrefix("wordocious-hints-")) {
            if let r = key.range(of: "-daily-") {
                let date = String(key[r.upperBound...].prefix(10))
                if date.count == 10, !keptDates.contains(date) { defaults.removeObject(forKey: key) }
            }
        }
    }
}
