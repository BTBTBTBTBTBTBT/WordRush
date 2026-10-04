#if DEBUG
import SwiftUI
import UIKit
import Supabase
import WordociousCore

// App Store screenshot demo mode (scripts/store-screenshots/README.md, "Simulator pipeline").
//
// DEBUG-only, compiled out of Release. Launched with `-storeDemo`, the app runs
// signed in as a sample player ("WordWiz") whose whole world is canned:
//
// - Auth: an in-memory session (StoreDemoAuthStorage) — never the keychain.
// - Network: every request through Net.api / Net.upload / URLSession.shared is
//   answered by StoreDemoURLProtocol from the tables below. Nothing reaches the
//   backend (Supabase or /api, reads and writes alike): unknown reads get an empty
//   answer, writes a bare 204. Only plain static GETs (art, content JSON) load. The VS / presence sockets never open (VSMatchService.connect,
//   PresenceService.start). VS vs a bot plays fully on device.
//
// `-storeShot <name>` then drives the app to one screen (StoreDemoDriver):
//   home | classic | octo | finish | stats | leaderboard | friends | vs | mascot
// The capture script (scripts/store-screenshots/capture-sim.sh) launches one
// shot per process on a fresh install, waits, and screenshots.
enum StoreDemo {
    static let active = ProcessInfo.processInfo.arguments.contains("-storeDemo")
    static var shot: String? {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-storeShot"), i + 1 < a.count else { return nil }
        return a[i + 1]
    }

    // MARK: The cast (real avatar-builder parts)

    struct Person {
        let id: String
        let name: String
        let level: Int
        let streak: Int
        let avatar: [String: String]
        var points: Int = 0
    }

    static let meId = "5d0e0000-0000-4000-8000-000000000001"

    static func uid(_ n: Int) -> String { String(format: "5d0e0000-0000-4000-8000-%012d", n) }

    static let me = Person(id: meId, name: "WordWiz", level: 24, streak: 47, avatar: [
        "v": "1", "body": "classic", "color": "purple", "pattern": "sparkle", "patternColor": "lilac",
        "eyes": "sparkly", "nose": "button", "cheeks": "blush", "mouth": "grin", "head": "wizard",
        "face": "none", "neck": "cape", "accColor": "default", "frame": "gold", "bg": "cottoncandy", "display": "mascot",
    ], points: 2184)

    static let people: [Person] = [
        Person(id: uid(2), name: "LexiLoop", level: 31, streak: 112, avatar: [
            "v": "1", "body": "blob", "color": "pink", "pattern": "dots", "patternColor": "white", "eyes": "happy",
            "nose": "none", "cheeks": "hearts", "mouth": "smile", "head": "flowercrown", "face": "none", "neck": "none",
            "frame": "diamond", "bg": "bubblegum", "display": "mascot"], points: 2460),
        Person(id: uid(3), name: "Quillby", level: 27, streak: 63, avatar: [
            "v": "1", "body": "bean", "color": "sky", "pattern": "stripes", "patternColor": "babyblue", "eyes": "glasses",
            "nose": "button", "cheeks": "freckles", "mouth": "smirk", "head": "beret", "face": "none", "neck": "bowtie",
            "frame": "platinum", "bg": "sky", "display": "mascot"], points: 2302),
        Person(id: uid(4), name: "VowelMaven", level: 22, streak: 29, avatar: [
            "v": "1", "body": "star", "color": "amber", "pattern": "solid", "patternColor": "white", "eyes": "stars",
            "nose": "none", "cheeks": "starfreckles", "mouth": "laugh", "head": "crown", "face": "none", "neck": "cape",
            "frame": "gold", "bg": "sunburst", "display": "mascot"], points: 2095),
        Person(id: uid(5), name: "TileTitan", level: 19, streak: 18, avatar: [
            "v": "1", "body": "chunky", "color": "green", "pattern": "twotone", "patternColor": "mint", "eyes": "determined",
            "nose": "none", "cheeks": "none", "mouth": "toothy", "head": "headphones", "face": "none", "neck": "none",
            "frame": "silver", "bg": "mint", "display": "mascot"], points: 1980),
        Person(id: uid(6), name: "PuzzlePip", level: 16, streak: 34, avatar: [
            "v": "1", "body": "drop", "color": "teal", "pattern": "gradient", "patternColor": "seafoam", "eyes": "wink",
            "nose": "none", "cheeks": "blush", "mouth": "tongue", "head": "propeller", "face": "none", "neck": "none",
            "frame": "silver", "bg": "ocean", "display": "mascot"], points: 1874),
        Person(id: uid(7), name: "Inkwell", level: 14, streak: 9, avatar: [
            "v": "1", "body": "tall", "color": "navy", "pattern": "galaxy", "patternColor": "butter", "eyes": "sleepy",
            "nose": "none", "cheeks": "none", "mouth": "tiny", "head": "nightcap", "face": "monocle", "neck": "none",
            "frame": "bronze", "bg": "starry", "display": "mascot"], points: 1712),
        Person(id: uid(8), name: "AnagramAnn", level: 12, streak: 21, avatar: [
            "v": "1", "body": "pear", "color": "coral", "pattern": "hearts", "patternColor": "white", "eyes": "anime",
            "nose": "none", "cheeks": "sparkle", "mouth": "cat", "head": "bigbow", "face": "none", "neck": "none",
            "frame": "bronze", "bg": "peach", "display": "mascot"], points: 1655),
        Person(id: uid(9), name: "CrosswordCal", level: 10, streak: 6, avatar: [
            "v": "1", "body": "wide", "color": "orange", "pattern": "checkers", "patternColor": "butter", "eyes": "beady",
            "nose": "none", "cheeks": "none", "mouth": "grin", "head": "cap", "face": "mustache", "neck": "none",
            "frame": "none", "bg": "lemon", "display": "mascot"], points: 1530),
    ]

    static var everyone: [Person] { [me] + people }
    static func person(_ id: String) -> Person? { everyone.first { $0.id.lowercased() == id.lowercased() } }

    // MARK: Boot

    /// Called from didFinishLaunching (before any view): first-run gates off, the
    /// canned network on. The session comes from StoreDemoAuthStorage.
    static func bootIfRequested() {
        guard active else { return }
        UserDefaults.standard.set(true, forKey: Onboarding.flagKey)
        URLProtocol.registerClass(StoreDemoURLProtocol.self)
        Task { @MainActor in await StoreDemoDriver.run() }
    }

    /// `-storeLog <host path>`: one line per canned request (the sim writes host paths directly).
    static func log(_ line: String) {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-storeLog"), i + 1 < a.count else { return }
        let p = a[i + 1], data = Data((line + "\n").utf8)
        if let h = FileHandle(forWritingAtPath: p) { h.seekToEndOfFile(); h.write(data); h.closeFile() }
        else { try? data.write(to: URL(fileURLWithPath: p)) }
    }

    static func iso(_ d: Date) -> String { ISO8601DateFormatter().string(from: d) }
    static var today: String { LeaderboardService.todayLocal() }

    /// The session the auth client reads (never expires during a capture).
    static func sessionData() -> Data? {
        let user = User(id: UUID(uuidString: meId)!, appMetadata: [:], userMetadata: [:], aud: "authenticated",
                        email: "wordwiz@example.com", createdAt: Date(timeIntervalSinceNow: -86_400 * 300),
                        updatedAt: Date())
        let s = Session(accessToken: "store-demo", tokenType: "bearer", expiresIn: 86_400 * 365,
                        expiresAt: Date().timeIntervalSince1970 + 86_400 * 365, refreshToken: "store-demo", user: user)
        return try? JSONEncoder().encode(s)
    }
}

/// In-memory auth storage for `-storeDemo`: a fixed signed-in session, nothing persisted.
struct StoreDemoAuthStorage: AuthLocalStorage {
    func store(key: String, value: Data) throws {}
    func retrieve(key: String) throws -> Data? { StoreDemo.sessionData() }
    func remove(key: String) throws {}
}

// MARK: - The canned network

final class StoreDemoURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool {
        guard StoreDemo.active, let s = request.url?.scheme else { return false }
        return s == "http" || s == "https"
    }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        guard let url = request.url else { return }
        let method = request.httpMethod ?? "GET"
        let host = url.host ?? ""
        // Static art (Muddle cartoons, the content JSON) is a plain read: let it load
        // through an un-intercepted session so those screens look real. Never a write.
        if method == "GET", !host.contains("supabase"), !url.path.hasPrefix("/api/") {
            let task = Self.passthrough.dataTask(with: request) { [weak self] data, resp, err in
                guard let self else { return }
                if let resp { self.client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed) }
                if let data { self.client?.urlProtocol(self, didLoad: data) }
                if let err { self.client?.urlProtocol(self, didFailWithError: err) } else { self.client?.urlProtocolDidFinishLoading(self) }
            }
            task.resume()
            return
        }
        let (status, body, headers) = StoreDemoData.answer(method: method, url: url, request: request)
        StoreDemo.log("\(method) \(url.host ?? "")\(url.path)?\(url.query?.removingPercentEncoding ?? "") -> \(status) \(body.count)B")
        var h = ["Content-Type": "application/json"]
        headers.forEach { h[$0] = $1 }
        let resp = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: h)!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    /// A session without this protocol, for passthrough static GETs only.
    private static let passthrough: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.protocolClasses = []
        return URLSession(configuration: c)
    }()
}

enum StoreDemoData {
    static func json(_ v: Any) -> Data { (try? JSONSerialization.data(withJSONObject: v)) ?? Data("[]".utf8) }

    static func answer(method: String, url: URL, request: URLRequest) -> (Int, Data, [String: String]) {
        let path = url.path
        let q = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func param(_ k: String) -> String? { q.first { $0.name == k }?.value }

        // Auth: the canned user; every other auth call is a no-op success.
        if path.hasPrefix("/auth/v1/user") {
            return (200, json(["id": StoreDemo.meId, "aud": "authenticated", "email": "wordwiz@example.com",
                               "created_at": StoreDemo.iso(Date(timeIntervalSinceNow: -86_400 * 300)),
                               "updated_at": StoreDemo.iso(Date()), "app_metadata": [:], "user_metadata": [:]]), [:])
        }
        // Writes never leave the device: a bare success.
        let isRPC = path.contains("/rest/v1/rpc/")
        if method != "GET" && method != "HEAD" && !isRPC && !(path.hasPrefix("/api/") && method == "GET") {
            return (204, Data(), [:])
        }
        let count = ["Content-Range": "0-0/0"]
        if path.hasPrefix("/rest/v1/") {
            let table = String(path.dropFirst("/rest/v1/".count))
            switch table {
            case "profiles": return (200, json(profiles(idFilter: param("id"))), count)
            case "daily_results" where (param("select") ?? "").contains("profiles!inner"):
                return (200, json(leaderboard(mode: String((param("game_mode") ?? "eq.DUEL").dropFirst(3)),
                                              ids: param("user_id"))), count)
            case "daily_results" where (param("user_id") ?? "").lowercased() == "eq." + StoreDemo.meId:
                return (200, json(myResults(day: param("day"), mode: param("game_mode"))), count)
            default: return (200, json([Any]()), count)
            }
        }
        if path.hasPrefix("/api/friends/feed") { return (200, json(["events": feed(), "reactions": [String: Any]()]), [:]) }
        if path == "/api/friends" { return (200, json(friendsPayload()), [:]) }
        return (200, json([Any]()), count)
    }

    // MARK: Rows

    static func profileRow(_ p: StoreDemo.Person) -> [String: Any] {
        let isMe: Bool = p.id == StoreDemo.meId
        let best: Int = max(p.streak, 58)
        let wins: Int = isMe ? 1180 : 980
        let created: String = StoreDemo.iso(Date(timeIntervalSinceNow: -86_400 * 300))
        let now: String = StoreDemo.iso(Date())
        var r: [String: Any] = [:]
        r["id"] = p.id; r["username"] = p.name; r["avatar_url"] = NSNull(); r["is_pro"] = isMe
        r["pro_expires_at"] = StoreDemo.iso(Date(timeIntervalSinceNow: 86_400 * 200))
        r["is_banned"] = false; r["is_admin"] = false; r["role"] = NSNull(); r["has_onboarded"] = true
        r["level"] = p.level; r["xp"] = p.level * 1450; r["total_wins"] = wins; r["total_losses"] = 64
        r["current_streak"] = p.streak; r["best_streak"] = best
        r["daily_login_streak"] = p.streak; r["best_daily_login_streak"] = best
        r["streak_shields"] = 2; r["last_played_at"] = now; r["last_seen_at"] = now
        r["gold_medals"] = 38; r["silver_medals"] = 27; r["bronze_medals"] = 19
        r["created_at"] = created; r["pro_prompt_shown"] = true
        r["bio"] = "Daily Sweep or bust."; r["featured_achievement"] = NSNull(); r["accent_color"] = NSNull()
        r["favorite_mode"] = "DUEL"; r["avatar_emoji"] = NSNull(); r["is_private"] = false; r["notification_prefs"] = NSNull()
        r["avatar_cast_id"] = NSNull(); r["avatar_frame"] = p.avatar["frame"] ?? "none"; r["avatar_config"] = p.avatar
        return r
    }

    /// `id=eq.X` / `id=in.(a,b)` → those people; otherwise the whole cast.
    static func profiles(idFilter: String?) -> [[String: Any]] {
        guard let f = idFilter else { return StoreDemo.everyone.map(profileRow) }
        let ids: [String]
        if f.hasPrefix("eq.") { ids = [String(f.dropFirst(3))] }
        else if f.hasPrefix("in.(") { ids = f.dropFirst(4).dropLast().split(separator: ",").map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "\" ")) } }
        else { ids = [] }
        return ids.compactMap(StoreDemo.person).map(profileRow)
    }

    /// The day's board for one mode: the cast in a fixed order, scores shaped by the mode.
    static func leaderboard(mode: String, ids: String?) -> [[String: Any]] {
        let sizes: [String: Int] = ["QUORDLE": 4, "OCTORDLE": 8, "GAUNTLET": 5, "SEQUENCE": 4, "RESCUE": 4]
        let boards: Int = sizes[mode] ?? 1
        var cast: [StoreDemo.Person] = StoreDemo.everyone.sorted { $0.points > $1.points }
        if let ids, ids.hasPrefix("in.(") {
            let wanted: String = ids.lowercased()
            cast = cast.filter { wanted.contains($0.id.lowercased()) }
        }
        var out: [[String: Any]] = []
        for (i, p) in cast.enumerated() {
            let score: Int = 980 - i * 37 - (i * i) % 11
            let guesses: Int = boards == 1 ? 3 + i / 3 : boards + 4 + i / 2
            let secs: Int = 48 + i * 19 + (i % 3) * 7
            var prof: [String: Any] = [:]
            prof["username"] = p.name; prof["avatar_url"] = NSNull(); prof["avatar_emoji"] = NSNull()
            prof["accent_color"] = NSNull(); prof["avatar_config"] = p.avatar; prof["avatar_cast_id"] = NSNull()
            prof["avatar_frame"] = p.avatar["frame"] ?? "none"
            var r: [String: Any] = [:]
            r["user_id"] = p.id; r["composite_score"] = Double(score); r["guess_count"] = guesses
            r["time_seconds"] = Double(secs); r["boards_solved"] = boards; r["total_boards"] = boards
            r["hints_used"] = 0; r["vs_wins"] = NSNull(); r["vs_losses"] = NSNull(); r["vs_games"] = NSNull()
            r["completed"] = true; r["profiles"] = prof
            out.append(r)
        }
        return out
    }

    /// WordWiz's own results: today's dailies (none on the Home shot, so the hero greets),
    /// and 60 days of history for the Stats charts.
    static func myResults(day: String?, mode: String?) -> [[String: Any]] {
        let modes: [(String, Int, Int)] = [("DUEL", 1, 3), ("GAUNTLET", 5, 14), ("QUORDLE", 4, 7), ("OCTORDLE", 8, 11),
                                           ("SEQUENCE", 4, 8), ("RESCUE", 4, 6), ("DUEL_6", 1, 4), ("DUEL_7", 1, 5)]
        let cal = Calendar.current
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"; fmt.locale = Locale(identifier: "en_US_POSIX")
        func rows(back: Int, count: Int) -> [[String: Any]] {
            let d: Date = cal.date(byAdding: .day, value: -back, to: Date()) ?? Date()
            let dayKey: String = fmt.string(from: d)
            var list: [[String: Any]] = []
            for (i, m) in modes.prefix(count).enumerated() {
                let won: Bool = (back + i) % 9 != 4
                let secs: Int = 55 + ((back * 37 + i * 53) % 160)
                let score: Int = won ? 720 + ((back * 29 + i * 61) % 260) : 120
                var r: [String: Any] = [:]
                r["user_id"] = StoreDemo.meId; r["day"] = dayKey; r["game_mode"] = m.0; r["play_type"] = "solo"
                r["completed"] = won; r["guess_count"] = m.2 + (back + i) % 3; r["time_seconds"] = Double(secs)
                r["composite_score"] = Double(score); r["boards_solved"] = won ? m.1 : max(0, m.1 - 1)
                r["total_boards"] = m.1; r["hints_used"] = 0; r["created_at"] = StoreDemo.iso(d)
                list.append(r)
            }
            return list
        }
        var out: [[String: Any]]
        if let day, day == "eq." + StoreDemo.today {
            out = StoreDemo.shot == "home" ? [] : rows(back: 0, count: 6)
        } else {
            out = (1...60).flatMap { rows(back: $0, count: $0 % 5 == 0 ? 6 : 8) } + (StoreDemo.shot == "home" ? [] : rows(back: 0, count: 6))
        }
        if let mode, mode.hasPrefix("eq.") { out = out.filter { ($0["game_mode"] as? String) == String(mode.dropFirst(3)) } }
        return out
    }

    static func friendRow(_ p: StoreDemo.Person, online: Bool, activity: String?) -> [String: Any] {
        let seen: Date = online ? Date() : Date(timeIntervalSinceNow: -60 * 47)
        let past: [Int] = [p.points - 140, p.points - 90]
        var r: [String: Any] = [:]
        r["id"] = p.id; r["username"] = p.name; r["avatar_url"] = NSNull(); r["avatar_config"] = p.avatar
        r["avatar_frame"] = p.avatar["frame"] ?? "none"; r["level"] = p.level
        r["since"] = StoreDemo.iso(Date(timeIntervalSinceNow: -86_400 * 120))
        r["streak"] = p.streak; r["playedToday"] = min(9, p.points / 280); r["weekPoints"] = p.points
        r["todayPoints"] = p.points / 6; r["lastWeekPoints"] = p.points - 140; r["pastWeekPoints"] = past
        r["flawlessStreak"] = 3; r["h2hW"] = 7; r["h2hL"] = 5
        r["lastSeenAt"] = StoreDemo.iso(seen); r["activity"] = activity ?? NSNull(); r["friendStreak"] = p.streak / 3
        return r
    }

    static func friendsPayload() -> [String: Any] {
        let acts: [String?] = ["Muddle", "OctoWord", nil, nil, nil]
        var friends: [[String: Any]] = []
        for (i, p) in StoreDemo.people.prefix(5).enumerated() { friends.append(friendRow(p, online: i < 2, activity: acts[i])) }
        var me: [String: Any] = [:]
        me["playedToday"] = 7; me["weekPoints"] = StoreDemo.me.points; me["todayPoints"] = 412
        me["lastWeekPoints"] = 1990; me["pastWeekPoints"] = [1990, 2105]; me["flawlessStreak"] = 4
        var last: [String: Any] = [:]
        last["weekStart"] = StoreDemo.today; last["rank"] = 1; last["points"] = 2240; last["circleSize"] = 6
        last["winnerId"] = StoreDemo.meId; last["winnerName"] = "You"; last["winnerPoints"] = 2240
        var r: [String: Any] = [:]
        r["friends"] = friends; r["incoming"] = [Any](); r["outgoing"] = [String](); r["outgoingProfiles"] = [Any]()
        r["me"] = me; r["lastWeek"] = last
        return r
    }

    static func feed() -> [[String: Any]] {
        let p = StoreDemo.people
        func ev(_ i: Int, _ who: StoreDemo.Person, _ minsAgo: Double, _ type: String, _ extra: [String: Any]) -> [String: Any] {
            var e: [String: Any] = [:]
            e["id"] = "demo-\(i)"; e["userId"] = who.id; e["username"] = who.name; e["avatar_url"] = NSNull()
            e["avatar_emoji"] = NSNull(); e["me"] = who.id == StoreDemo.meId; e["day"] = StoreDemo.today
            e["at"] = StoreDemo.iso(Date(timeIntervalSinceNow: -60 * minsAgo)); e["type"] = type
            extra.forEach { e[$0] = $1 }
            return e
        }
        return [
            ev(1, p[0], 12, "sweep", ["value": 9]),
            ev(2, p[1], 38, "medal", ["kind": "gold", "gameMode": "OCTORDLE", "gameTitle": "OctoWord"]),
            ev(3, StoreDemo.me, 55, "record", ["kind": "fastest_win", "gameMode": "DUEL", "gameTitle": "Classic", "value": 41]),
            ev(4, p[2], 80, "flawless", ["value": 4]),
            ev(5, p[3], 140, "game", ["gameKind": "ttt", "otherName": "WordWiz", "otherId": StoreDemo.meId, "score": "2–1"]),
        ]
    }
}

// MARK: - The driver

@MainActor
enum StoreDemoDriver {
    static func run() async {
        while !LaunchGate.isOpen { await PerfDrive.sleep(0.05) }
        DictionaryLoader.ensureInitialized()
        await PerfDrive.sleep(1.5)
        switch StoreDemo.shot ?? "home" {
        case "classic": await classic(finish: false)
        case "finish": await classic(finish: true)
        case "octo": await octo()
        case "stats": PerfTour.send(.selectTab(.stats))
        case "leaderboard": PerfTour.send(.selectTab(.leaderboard))
        case "friends":
            PerfTour.send(.selectTab(.friends))
            await PerfDrive.sleep(2.0)
            PerfTour.send(.sheet(.quickPlay))
        case "vs":
            PerfTour.send(.cover(.vsBot))
            // After the intro + countdown, two guesses; the bot plays on its own clock meanwhile.
            await PerfDrive.sleep(11.0)
            for w in ["CRANE", "MOIST"] { await PerfDrive.type(w, gap: 0.12); PerfDrive.enter(); await PerfDrive.sleep(4.0) }
        case "mascot": present(AnyView(StoreDemoMascotPage()))
        default: PerfTour.send(.selectTab(.home))
        }
    }

    private static func classic(finish: Bool) async {
        PerfDrive.playUnlimited("DUEL")
        await PerfDrive.sleep(2.5)
        guard let answer = PerfTour.game?.boards.first?.solution.uppercased() else { return }
        PerfTour.game?.storeDemoAddElapsed(seconds: finish ? 88 : 61)
        for w in openers(for: answer) { await PerfDrive.type(w, gap: 0.05); PerfDrive.enter(); await PerfDrive.sleep(1.6) }
        if finish { await PerfDrive.type(answer, gap: 0.05); PerfDrive.enter() }
    }

    private static func octo() async {
        PerfDrive.playUnlimited("OCTORDLE")
        await PerfDrive.sleep(2.5)
        let answers = PerfTour.game?.boards.map { $0.solution.uppercased() } ?? []
        PerfTour.game?.storeDemoAddElapsed(seconds: 214)
        for w in ["CRANE", "MOIST"] { await PerfDrive.type(w, gap: 0.05); PerfDrive.enter(); await PerfDrive.sleep(1.4) }
        for a in answers.prefix(3) { await PerfDrive.type(a, gap: 0.05); PerfDrive.enter(); await PerfDrive.sleep(1.4) }
    }

    /// Three real guesses that build toward the answer (a colorful board, never the answer):
    /// CRANE, then a common word with two greens, then one with three or four.
    private static func openers(for answer: String) -> [String] {
        let a = Array(answer)
        func greens(_ w: String) -> Int { zip(Array(w), a).filter { $0 == $1 }.count }
        func yellows(_ w: String) -> Int { Set(w).intersection(Set(answer)).count }
        let pool = GameDictionary.shared.allSolutions().map { $0.uppercased() }
            .filter { $0.count == a.count && $0 != answer && Set($0).count == $0.count }.sorted()
        var out = [answer.hasPrefix("CRAN") ? "SLOTH" : "CRANE"]
        if let w = pool.first(where: { greens($0) == 2 && yellows($0) >= 3 && !out.contains($0) }) ?? pool.first(where: { greens($0) == 2 }) { out.append(w) }
        if let w = pool.first(where: { greens($0) == 4 && !out.contains($0) }) ?? pool.first(where: { greens($0) == 3 && !out.contains($0) }) { out.append(w) }
        return out
    }

    private static func present(_ root: AnyView) {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        guard var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController ?? scene?.windows.first?.rootViewController
        else { return }
        while let next = top.presentedViewController { top = next }
        let host = UIHostingController(rootView: root)
        host.modalPresentationStyle = .pageSheet
        top.present(host, animated: false)
    }
}

/// The mascot maker, as Edit Profile opens it, with WordWiz's look.
private struct StoreDemoMascotPage: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                MascotBuilderView(initial: "W", config: AvatarCatalog.validate(raw: AvatarConfigRaw(fields: StoreDemo.me.avatar)), level: StoreDemo.me.level, isPro: true)
                    .padding(16)
            }
            .navigationTitle("Your mascot")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
#endif
