import Foundation
import WordociousCore

/// Async VS challenges, "race my run" (VS overhaul, founder 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md §3–§4, §11). The challenger plays a fresh seed and
/// sends the run; each friend races a ghost of it within 24 hours. Every call
/// goes to https://wordocious.com/api/vs/challenges… bearer-authed exactly like
/// the /api/friends/* calls (FriendsService). No-throw: failures come back as
/// nil / .failure with the server's message.

/// A stored run: the numbers a live match compares, plus the words for the
/// result screen's mini board. `guesses` is the VS score unit.
struct VsChallengeRun: Codable, Equatable {
    var solved: Bool
    var boardsSolved: Int
    var totalBoards: Int
    var guesses: Int
    var timeMs: Int
    var guessLog: [String]
    var solutions: [String]

    var vsRun: VsRun { VsRun(solved: solved, boardsSolved: boardsSolved, guesses: guesses, timeMs: timeMs) }

    /// "solved in 4 · 1:52" / "not solved".
    var summary: String { solved ? "solved in \(guesses) · \(VsLobby.vsClock(timeMs))" : "not solved" }

    init(solved: Bool, boardsSolved: Int, totalBoards: Int, guesses: Int, timeMs: Int, guessLog: [String], solutions: [String]) {
        self.solved = solved; self.boardsSolved = boardsSolved; self.totalBoards = totalBoards
        self.guesses = guesses; self.timeMs = timeMs; self.guessLog = guessLog; self.solutions = solutions
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        solved = try c.decodeIfPresent(Bool.self, forKey: .solved) ?? false
        boardsSolved = try c.decodeIfPresent(Int.self, forKey: .boardsSolved) ?? 0
        totalBoards = try c.decodeIfPresent(Int.self, forKey: .totalBoards) ?? 1
        guesses = try c.decodeIfPresent(Int.self, forKey: .guesses) ?? 0
        timeMs = try c.decodeIfPresent(Int.self, forKey: .timeMs) ?? 0
        guessLog = try c.decodeIfPresent([String].self, forKey: .guessLog) ?? []
        solutions = try c.decodeIfPresent([String].self, forKey: .solutions) ?? []
    }
}

/// One challenge as the API's ChallengeView.
struct VsChallenge: Codable, Identifiable, Equatable {
    struct Challenger: Codable, Equatable {
        let id: String
        let username: String
        let avatarUrl: String?
    }
    let code: String
    let gameMode: String
    let seed: String
    let challenger: Challenger
    let run: VsChallengeRun
    let createdAt: String?
    let expiresAt: String?
    let isLink: Bool?

    var id: String { code }
    var mode: GameMode { GameMode(rawValue: gameMode) ?? .duel }
    var expiresDate: Date? { expiresAt.flatMap(VsChallengeService.parseDate) }
    var createdDate: Date? { createdAt.flatMap(VsChallengeService.parseDate) }

    /// Whole hours left on the 24-hour window, at least 1 (the banner's "17H").
    var hoursLeft: Int {
        guard let end = expiresDate else { return 24 }
        return max(1, Int((end.timeIntervalSinceNow / 3600).rounded(.up)))
    }
}

/// A challenge the player sent, with each friend's result from the SENDER's side.
struct VsSentChallenge: Codable, Identifiable, Equatable {
    struct Result: Codable, Equatable {
        let username: String
        /// win | loss | draw — already from the sender's side.
        let outcome: String
        let guesses: Int?
        let timeMs: Int?
        let solved: Bool?
    }
    let code: String
    let gameMode: String
    let createdAt: String?
    let expiresAt: String?
    let invitees: Int
    let results: [Result]

    var id: String { code }
    var mode: GameMode { GameMode(rawValue: gameMode) ?? .duel }
    var createdDate: Date? { createdAt.flatMap(VsChallengeService.parseDate) }
}

/// The caller's own finished race of a challenge (GET …/<code> `entry`).
struct VsChallengeEntry: Codable, Equatable {
    let outcome: String
    let solved: Bool
    let boardsSolved: Int
    let guesses: Int
    let timeMs: Int
    let guessLog: [String]?

    var vsRun: VsRun { VsRun(solved: solved, boardsSolved: boardsSolved, guesses: guesses, timeMs: timeMs) }
}

/// GET /api/vs/challenges/<code>.
struct VsChallengeDetail: Decodable {
    let challenge: VsChallenge
    let isMine: Bool
    let expired: Bool
    let entry: VsChallengeEntry?
}

enum VsChallengeService {
    private static let base = "https://wordocious.com/api/vs/challenges"

    struct APIError: LocalizedError {
        let message: String
        let status: Int
        var errorDescription: String? { message }
    }

    struct Lists: Decodable {
        let incoming: [VsChallenge]
        let sent: [VsSentChallenge]
    }

    struct Created: Decodable {
        let code: String
        let url: String
        let invitees: Int
    }

    struct Posted: Decodable {
        let outcome: String
        let margin: String?
        let alreadyRecorded: Bool?
    }

    /// Postgres timestamps carry microseconds ("…:00.123456+00:00"), which
    /// ISO8601DateFormatter refuses — drop the fraction before parsing.
    static func parseDate(_ s: String) -> Date? {
        let trimmed = s.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        return ISO8601DateFormatter().date(from: trimmed)
    }

    private static func send(_ path: String, method: String = "GET", body: [String: Any]? = nil) async -> (Int, Data)? {
        guard let url = URL(string: base + path) else { return nil }
        var req = await PublicProfileService.authedRequest(url)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        guard let (data, resp) = try? await Net.api.data(for: req),
              let http = resp as? HTTPURLResponse else { return nil }
        return (http.statusCode, data)
    }

    private static func failure(_ status: Int, _ data: Data, fallback: String) -> APIError {
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        return APIError(message: (json?["error"] as? String) ?? fallback, status: status)
    }

    /// GET — open challenges waiting for me (newest first) + my recent sends.
    static func list() async -> Lists? {
        guard let (status, data) = await send(""), status == 200 else { return nil }
        return try? JSONDecoder().decode(Lists.self, from: data)
    }

    /// GET /<code> — one challenge to race (or my own, or one I already raced).
    static func get(code: String) async -> Result<VsChallengeDetail, APIError> {
        let c = code.trimmingCharacters(in: .whitespaces).uppercased()
        guard !c.isEmpty, let enc = c.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            return .failure(APIError(message: "Challenge not found", status: 404))
        }
        guard let (status, data) = await send("/\(enc)") else {
            return .failure(APIError(message: "Network error", status: 0))
        }
        guard status == 200, let d = try? JSONDecoder().decode(VsChallengeDetail.self, from: data) else {
            return .failure(failure(status, data, fallback: "Challenge not found"))
        }
        return .success(d)
    }

    /// POST — store my run and push each listed friend. Sending is Pro (403 otherwise).
    static func create(gameMode: GameMode, seed: String, run: VsChallengeRun, friendIds: [String], link: Bool) async -> Result<Created, APIError> {
        let body: [String: Any] = [
            "gameMode": gameMode.rawValue, "seed": seed, "run": runBody(run),
            "friendIds": friendIds, "link": link,
        ]
        guard let (status, data) = await send("", method: "POST", body: body) else {
            return .failure(APIError(message: "Network error", status: 0))
        }
        guard status == 200, let c = try? JSONDecoder().decode(Created.self, from: data) else {
            return .failure(failure(status, data, fallback: "Could not send the challenge"))
        }
        return .success(c)
    }

    /// POST /<code>/result — the racer finished; the server scores it, writes the
    /// shared matches row and the challenger's side, and pushes them.
    static func postResult(code: String, run: VsChallengeRun, quit: Bool = false) async -> Result<Posted, APIError> {
        guard let enc = code.uppercased().addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            return .failure(APIError(message: "Challenge not found", status: 404))
        }
        guard let (status, data) = await send("/\(enc)/result", method: "POST", body: quit ? ["run": runBody(run), "quit": true] : ["run": runBody(run)]) else {
            return .failure(APIError(message: "Network error", status: 0))
        }
        guard status == 200, let p = try? JSONDecoder().decode(Posted.self, from: data) else {
            return .failure(failure(status, data, fallback: "Could not save your result"))
        }
        return .success(p)
    }

    private static func runBody(_ r: VsChallengeRun) -> [String: Any] {
        ["solved": r.solved, "boardsSolved": r.boardsSolved, "totalBoards": r.totalBoards,
         "guesses": r.guesses, "timeMs": r.timeMs, "guessLog": r.guessLog, "solutions": r.solutions]
    }

    /// The link a challenge shares, and the text that rides with it.
    static func shareURL(_ code: String) -> URL { URL(string: "https://wordocious.com/vs/challenge/\(code)")! }
    static func shareText(mode: GameMode, code: String) -> String {
        "Race my Wordocious \(VsLobbyKit.modeName(mode)) run — code \(code)"
    }
}

/// "Ping me when someone's looking" (spec §13). KEEP WAITING on a Pro live
/// random search calls POST https://wordocious.com/api/vs/looking {gameMode}
/// → {pinged, throttled}; the server pushes the Pro players who opted in
/// (`profiles.notification_prefs.vsLooking`, a missing key = OFF).
enum VsLookingService {
    /// The opt-in key in profiles.notification_prefs.
    static let prefKey = "vsLooking"

    struct Pinged: Decodable {
        let pinged: Int
        let throttled: Bool
    }

    /// Opted in only when the key is explicitly true (missing = OFF, unlike the friends categories).
    static func isOn(_ prefs: [String: Bool]?) -> Bool { prefs?[prefKey] == true }

    /// nil on any failure (the card simply keeps "We’ll keep looking").
    static func ping(gameMode: GameMode) async -> Pinged? {
        guard let url = URL(string: "https://wordocious.com/api/vs/looking") else { return nil }
        var req = await PublicProfileService.authedRequest(url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["gameMode": gameMode.rawValue])
        guard let (data, resp) = try? await Net.api.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONDecoder().decode(Pinged.self, from: data)
    }

    /// The card line under the buttons after KEEP WAITING; nil when throttled
    /// (the card stays "We’ll keep looking").
    static func line(_ p: Pinged) -> String? {
        if p.throttled { return nil }
        if p.pinged <= 0 { return "Nobody has pings on yet. We’ll keep looking." }
        return p.pinged == 1 ? "We pinged 1 player who plays live." : "We pinged \(p.pinged) players who play live."
    }
}

/// A race result the server hasn't accepted yet (spec §14).
struct VsPendingRace: Codable, Equatable {
    let code: String
    let gameMode: String
    let seed: String
    let run: VsChallengeRun
    /// ms since epoch.
    let savedAt: Double
    /// The signed-in racer it belongs to (retried only under that account).
    var userId: String?
    /// Quit mid-race: the racer's side records as a loss whatever the server scores.
    var quit: Bool?
}

/// Race results never get lost (spec §14). A race's result POST that fails with
/// a network error or a 5xx is kept in UserDefaults `wordocious-vs-pending-races`
/// (one per code) and retried each time the VS lobby loads and on app start:
/// accepted (`alreadyRecorded: false`) → record the racer's side (+ XP), drop;
/// `alreadyRecorded: true` → drop; a 4xx → drop (401 keeps); network / 5xx → keep; anything
/// older than 3 days → drop.
@MainActor
enum VsPendingRaces {
    static let key = "wordocious-vs-pending-races"
    private static let maxAgeMs: Double = 3 * 24 * 60 * 60 * 1000
    private static var retrying = false

    static let savedNote = "Saved. We’ll send your result when you’re back online."

    enum Submitted {
        /// Accepted: the racer's side was recorded (XP when signed in).
        case recorded(GameResultsService.XpResult?)
        /// The server already had this racer's result — the first one stands.
        case alreadyRecorded
        /// Offline / server error: kept for a later retry.
        case saved
        /// Refused for good (4xx) — dropped.
        case failed(String)
    }

    static func load() -> [VsPendingRace] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let list = try? JSONDecoder().decode([VsPendingRace].self, from: data) else { return [] }
        return list
    }

    private static func store(_ list: [VsPendingRace]) {
        if list.isEmpty { UserDefaults.standard.removeObject(forKey: key); return }
        if let data = try? JSONEncoder().encode(list) { UserDefaults.standard.set(data, forKey: key) }
    }

    /// One per code: a newer save replaces the old one.
    private static func save(_ race: VsPendingRace) {
        store(load().filter { $0.code != race.code } + [race])
    }

    private static func remove(code: String) {
        store(load().filter { $0.code != code })
    }

    /// Network error (status 0), a 5xx, or a 401 (no session yet) keeps the
    /// result for later; the 3-day cap still clears it.
    static func isRetryable(_ e: VsChallengeService.APIError) -> Bool { e.status == 0 || e.status == 401 || e.status >= 500 }

    /// A fresh pending item for the signed-in racer.
    static func make(code: String, mode: GameMode, seed: String, run: VsChallengeRun, quit: Bool = false) -> VsPendingRace {
        VsPendingRace(code: code, gameMode: mode.rawValue, seed: seed, run: run,
                      savedAt: Date().timeIntervalSince1970 * 1000,
                      userId: AuthService.shared.profile?.id, quit: quit ? true : nil)
    }

    /// POST the result; on acceptance record the racer's side through the normal
    /// live-VS path (XP, achievements) — never a client matches row, never vs_cpu.
    static func submit(_ race: VsPendingRace) async -> Submitted {
        switch await VsChallengeService.postResult(code: race.code, run: race.run, quit: race.quit == true) {
        case .success(let posted):
            remove(code: race.code)
            if posted.alreadyRecorded == true { return .alreadyRecorded }
            let outcome: VsOutcome = race.quit == true ? .loss : (VsOutcome(rawValue: posted.outcome) ?? .loss)
            return .recorded(await recordSide(race, outcome: outcome))
        case .failure(let e):
            if isRetryable(e) { save(race); return .saved }
            remove(code: race.code)
            return .failed(e.message)
        }
    }

    /// The racer's own side, with XP. A draw is NOT a loss: isDraw counts the game only.
    private static func recordSide(_ race: VsPendingRace, outcome: VsOutcome) async -> GameResultsService.XpResult? {
        guard AuthService.shared.profile != nil, let mode = GameMode(rawValue: race.gameMode) else { return nil }
        let r = race.run
        let secs = Int((Double(r.timeMs) / 1000).rounded())
        let xp = await GameResultsService.record(
            gameMode: mode, playType: "vs", won: outcome == .win, guessCount: r.guesses,
            timeSeconds: secs, boardsSolved: r.boardsSolved, totalBoards: r.totalBoards,
            seed: race.seed, isDraw: outcome == .draw)
        if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
            await AchievementService.checkAchievements(
                userId: uid, gameMode: mode.rawValue, playType: "vs", won: outcome == .win,
                guessCount: r.guesses, timeSeconds: secs, seed: race.seed, hintsUsed: 0)
        }
        return xp
    }

    /// Retry every pending race (VS lobby load, app start). Returns true when a
    /// result was recorded, so the caller can refresh what it shows.
    @discardableResult
    static func retryAll() async -> Bool {
        guard !retrying, let me = AuthService.shared.profile?.id else { return false }
        let now = Date().timeIntervalSince1970 * 1000
        let all = load()
        let fresh = all.filter { now - $0.savedAt <= maxAgeMs }
        if fresh.count != all.count { store(fresh) }
        guard !fresh.isEmpty else { return false }
        retrying = true
        defer { retrying = false }
        var recorded = false
        for race in fresh where race.userId == nil || race.userId == me {
            if case .recorded = await submit(race) { recorded = true }
        }
        return recorded
    }
}
