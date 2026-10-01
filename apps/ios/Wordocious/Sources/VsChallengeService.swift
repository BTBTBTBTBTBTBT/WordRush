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
    static func postResult(code: String, run: VsChallengeRun) async -> Result<Posted, APIError> {
        guard let enc = code.uppercased().addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            return .failure(APIError(message: "Challenge not found", status: 404))
        }
        guard let (status, data) = await send("/\(enc)/result", method: "POST", body: ["run": runBody(run)]) else {
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
