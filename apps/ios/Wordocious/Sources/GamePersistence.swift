import Foundation
import WordociousCore

/// Persists in-progress games to disk so backgrounding/relaunch resumes the
/// exact board. Keyed by seed+mode, mirroring the web app's localStorage keys.
final class GamePersistence {
    static let shared = GamePersistence()
    private init() {}

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
        guard let data = try? encoder.encode(state) else { return }
        try? data.write(to: url(seed: state.seed, mode: state.mode), options: .atomic)
    }

    func load(seed: String, mode: GameMode) -> GameState? {
        let u = url(seed: seed, mode: mode)
        guard let data = try? Data(contentsOf: u),
              let state = try? decoder.decode(GameState.self, from: data) else {
            return nil
        }
        return state
    }

    func clear(seed: String, mode: GameMode) {
        try? FileManager.default.removeItem(at: url(seed: seed, mode: mode))
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
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            for f in files {
                let base = f.lastPathComponent.replacingOccurrences(of: ".json", with: "")
                guard let r = base.range(of: "-daily-") else { continue }
                let date = String(base[r.upperBound...].prefix(10))   // YYYY-MM-DD
                if date.count == 10, date != today { try? fm.removeItem(at: f) }
            }
        }
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys
        where key.contains("-daily-") && (key.hasPrefix("wordocious-elapsed-") || key.hasPrefix("wordocious-hints-")) {
            if let r = key.range(of: "-daily-") {
                let date = String(key[r.upperBound...].prefix(10))
                if date.count == 10, date != today { defaults.removeObject(forKey: key) }
            }
        }
    }
}
