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
//   home | classic | octo | finish | stats | leaderboard | friends | vs | vsintro | mascot
// The capture script (scripts/store-screenshots/capture-sim.sh) launches one
// shot per process on a fresh install, waits, and screenshots.
enum StoreDemo {
    static let active = ProcessInfo.processInfo.arguments.contains("-storeDemo")
    /// `-storeDemoFree`: the same player as a FREE signed-in account (no Pro, no Pro frame on the
    /// profile), so the free-tier gates, Go Pro prompts and paywalls can be shot.
    static let free = ProcessInfo.processInfo.arguments.contains("-storeDemoFree")
    /// `-storeAvatarKinds`: the leaderboard leaders cover every avatar kind core `resolveAvatar`
    /// draws — #1 a custom PHOTO (a drawn test picture served for the avatars bucket URL, never a
    /// real photo), #2 a cast pick, #3 WordWiz's built mascot, #4 a seeded default. Off for store shots.
    static let avatarKinds = ProcessInfo.processInfo.arguments.contains("-storeAvatarKinds")
    /// `-storeDemoPhoto`: WordWiz shows a (drawn test) PHOTO; `-storeDemoPlain`: WordWiz has no custom look
    /// (the seeded mascot → the Home "Make me yours!" host). Dress-up captures (10-05).
    static let photoMe = ProcessInfo.processInfo.arguments.contains("-storeDemoPhoto")
    static let plainMe = ProcessInfo.processInfo.arguments.contains("-storeDemoPlain")
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

    /// 10-05 Title Shelves captures: a slice of the live catalog (/api/achievements, 10-05) and the
    /// titles WordWiz has earned (most recent first).
    static let earnedTitles: [String] = ["gauntlet_god", "octo_boss", "dress_up", "speed_demon", "streak_7", "streak_30", "daily_sweep", "first_win", "daily_debut", "all_modes", "centurion", "century_club", "thousand_words", "flawless_victory", "rising_star", "linguist", "wordsmith", "best_buds", "cheerleader", "hive_mind", "crossword_first", "sudoku_first", "self_portrait", "early_bird", "night_owl", "medal_10", "golden_touch", "rival", "vs_veteran", "three_in_a_row", "called_it", "wake_up_call", "meet_the_cast", "spooky_season", "classic_master", "lucky_seven", "six_shooter"]
    static let titleCatalog = #"""
{"achievements":[{"key":"first_win","name":"First Win","description":"Win any game","category":"beginner","icon":"trophy"},{"key":"all_modes","name":"All Modes Played","description":"Play every game mode","category":"beginner","icon":"grid"},{"key":"daily_debut","name":"Daily Debut","description":"Complete your first daily challenge","category":"beginner","icon":"calendar"},{"key":"rising_star","name":"Rising Star","description":"Reach level 10","category":"beginner","icon":"star"},{"key":"linguist","name":"Linguist","description":"Win Classic, Six, and Seven daily in the same day","category":"beginner","icon":"grid"},{"key":"sudoku_first","name":"First Sudocious","description":"Solve a Sudocious puzzle","category":"beginner","icon":"grid"},{"key":"crossword_first","name":"Grid Finished","description":"Finish a Crosswordocious grid","category":"beginner","icon":"quote"},{"key":"extended_vocab","name":"Extended Vocabulary","description":"Win both a Six and Seven daily in the same day","category":"beginner","icon":"grid"},{"key":"regions_first","name":"First Starsweep","description":"Clear a Starsweep board","category":"beginner","icon":"star"},{"key":"ladder_first","name":"First Rung","description":"Climb a Letter Ladder","category":"beginner","icon":"trending-up"},{"key":"streak_7","name":"7-Day Warrior","description":"Play 7 consecutive days","category":"consistency","icon":"flame"},{"key":"streak_30","name":"30-Day Streak","description":"Play 30 consecutive days","category":"consistency","icon":"flame"},{"key":"century_club","name":"Century Club","description":"Win 100 total games","category":"consistency","icon":"trophy"},{"key":"thousand_words","name":"Thousand Words","description":"Win 1,000 total games","category":"consistency","icon":"crown"},{"key":"centurion","name":"Centurion","description":"Complete 100 daily sweeps","category":"consistency","icon":"sparkles"},{"key":"wordsmith","name":"Wordsmith","description":"Win 500 total games","category":"consistency","icon":"trophy"},{"key":"sweep_streak_7","name":"Sweep Streak","description":"Complete the daily sweep 7 days in a row","category":"consistency","icon":"sparkles"},{"key":"iron_will","name":"Iron Will","description":"Complete the daily sweep 30 days in a row","category":"consistency","icon":"flame"},{"key":"dedicated","name":"Dedicated","description":"Play 500 total games","category":"consistency","icon":"flame"},{"key":"obsessed","name":"Obsessed","description":"Play 2,000 total games","category":"consistency","icon":"flame"},{"key":"speed_demon","name":"Speed Demon","description":"Solve Classic in under 30 seconds","category":"skill","icon":"zap"},{"key":"daily_sweep","name":"Daily Sweep","description":"Complete every Daily Sweep game in a single day","category":"skill","icon":"sparkles"},{"key":"flawless_victory","name":"Flawless Victory","description":"Win every Daily Sweep game in a single day","category":"skill","icon":"trophy"},{"key":"octo_boss","name":"Octo Boss","description":"Win 50 OctoWord games","category":"skill","icon":"grid"},{"key":"gauntlet_god","name":"Gauntlet God","description":"Complete Gauntlet without failing any board","category":"skill","icon":"crown"},{"key":"six_shooter","name":"Six Shooter","description":"Win 50 Classic Six games","category":"skill","icon":"zap"},{"key":"lucky_seven","name":"Lucky Seven","description":"Win 50 Classic Seven games","category":"skill","icon":"star"},{"key":"classic_master","name":"Classic Master","description":"Win 100 Classic games","category":"skill","icon":"trophy"},{"key":"blitz","name":"Blitz","description":"Win any game in under 15 seconds","category":"skill","icon":"zap"},{"key":"close_call","name":"Close Call","description":"Win a game on your final guess","category":"skill","icon":"star"},{"key":"vs_veteran","name":"VS Veteran","description":"Win 10 VS matches","category":"social","icon":"swords"},{"key":"rival","name":"Rival","description":"Play 50 VS matches","category":"social","icon":"swords"},{"key":"unstoppable","name":"Unstoppable","description":"Achieve a 5-win streak","category":"social","icon":"flame"},{"key":"untouchable","name":"Untouchable","description":"Achieve a 10-win VS streak","category":"social","icon":"swords"},{"key":"dominant","name":"Dominant","description":"Win 50 VS matches","category":"social","icon":"trophy"},{"key":"versatile_victor","name":"Versatile Victor","description":"Win VS matches in 5 different game modes","category":"social","icon":"swords"},{"key":"triple_threat","name":"Triple Threat","description":"Win 3 VS matches in a single day","category":"social","icon":"swords"},{"key":"vs_centurion","name":"VS Centurion","description":"Win 100 VS matches","category":"social","icon":"trophy"},{"key":"vs_marathoner","name":"VS Marathoner","description":"Play 100 VS matches","category":"social","icon":"swords"},{"key":"medal_10","name":"Medal Collector","description":"Earn 10 medals","category":"collection","icon":"medal"},{"key":"golden_touch","name":"Golden Touch","description":"Earn 10 gold medals","category":"collection","icon":"crown"},{"key":"medal_50","name":"Medal Hoarder","description":"Earn 50 medals","category":"collection","icon":"medal"},{"key":"medal_wall","name":"Medal Wall","description":"Earn 100 medals","category":"collection","icon":"medal"},{"key":"gold_rush","name":"Gold Rush","description":"Earn 50 gold medals","category":"collection","icon":"crown"},{"key":"diamond_hands","name":"Diamond Hands","description":"Earn 100 gold medals","category":"collection","icon":"crown"},{"key":"hive_mind","name":"Hive Mind","description":"Reach the top rank in Hubbub","category":"puzzles","icon":"crown"},{"key":"muddle_master","name":"Muddle Master","description":"Solve 25 Muddles","category":"puzzles","icon":"shuffle"},{"key":"punchline_pro","name":"Punchline Pro","description":"Solve a Muddle without a hint","category":"puzzles","icon":"sparkles"},{"key":"pangram_hunter","name":"Pangram Hunter","description":"Find 10 Hubbub pangrams","category":"puzzles","icon":"sparkles"},{"key":"kindred_spirit","name":"Kindred Spirit","description":"Solve a Kindred with no mistakes","category":"puzzles","icon":"group"},{"key":"kindred_regular","name":"Kindred Fan","description":"Solve 25 Kindreds","category":"puzzles","icon":"group"},{"key":"ladder_climber","name":"Ladder Climber","description":"Solve 25 Letter Ladders","category":"puzzles","icon":"trending-up"},{"key":"code_cracker","name":"Code Cracker","description":"Solve 25 Codebreakers","category":"puzzles","icon":"key-round"},{"key":"sharp_spotter","name":"Sharp Spotter","description":"Solve 25 Spyglass word searches","category":"puzzles","icon":"target"},{"key":"starstruck","name":"Starstruck","description":"Solve 25 Starsweeps","category":"puzzles","icon":"star"},{"key":"wake_up_call","name":"Wake-Up Call","description":"Beat Rip in a VS battle","category":"bots","icon":"swords"},{"key":"meet_the_cast","name":"Meet the Cast","description":"Beat all ten cast bots","category":"bots","icon":"group"},{"key":"halfway_hero","name":"Halfway Hero","description":"Clear five rungs of the bot ladder","category":"bots","icon":"trending-up"},{"key":"boss_battle","name":"Boss Battle","description":"Beat Webster, the final boss","category":"bots","icon":"crown"},{"key":"daily_duelist","name":"Daily Duelist","description":"Beat the Bot of the Day 7 times","category":"bots","icon":"calendar"},{"key":"best_buds","name":"Best Buds","description":"Add your first friend","category":"friends","icon":"group"},{"key":"cheerleader","name":"Cheerleader","description":"Send 25 reactions","category":"friends","icon":"sparkles"},{"key":"squad_goals","name":"Squad Goals","description":"Have 10 friends","category":"friends","icon":"group"},{"key":"race_day","name":"Race Day","description":"Win today's friends race","category":"friends","icon":"trophy"},{"key":"ride_or_die","name":"Ride or Die","description":"Keep a 7-day friend streak","category":"friends","icon":"flame"},{"key":"three_in_a_row","name":"Three in a Row","description":"Win 10 Tic-Tac-Tile matches","category":"pocket","icon":"grid"},{"key":"called_it","name":"Called It","description":"Win 10 Call It matches","category":"pocket","icon":"star"},{"key":"rock_solid","name":"Rock Solid","description":"Win 10 Rock Paper Scissors matches","category":"pocket","icon":"target"},{"key":"team_player","name":"Team Player","description":"Finish 10 Pass the Puzzle games","category":"pocket","icon":"group"},{"key":"spooky_speller","name":"Spooky Speller","description":"Win 10 Ghost games","category":"pocket","icon":"quote"},{"key":"chain_reaction","name":"Chain Reaction","description":"Make a 20-word Word Chain","category":"pocket","icon":"shuffle"},{"key":"pocket_pro","name":"Pocket Pro","description":"Win at least one of every pocket game","category":"pocket","icon":"crown"},{"key":"self_portrait","name":"Self Portrait","description":"Make your own mascot","category":"mascot","icon":"star"},{"key":"dress_up","name":"Dress Up","description":"Save a mascot with a hat, an extra and a backdrop","category":"mascot","icon":"sparkles"},{"key":"spooky_season","name":"Spooky Season","description":"Finish a daily during the Halloween season","category":"seasonal","icon":"calendar"},{"key":"early_bird","name":"Early Bird","description":"Finish a daily before 7 AM","category":"streaks","icon":"calendar"},{"key":"night_owl","name":"Night Owl","description":"Finish a daily between midnight and 4 AM","category":"streaks","icon":"calendar"}]}
"""#

    // MARK: Avatar kinds (-storeAvatarKinds)

    static let photoPath = "/storage/v1/object/public/avatars/store-demo/lexiloop.png"
    static func photoUrl(_ p: Person) -> String? {
        if photoMe && p.id == meId { return SupabaseConfig.url.absoluteString + photoPath }
        guard avatarKinds, p.id == people[0].id else { return nil }
        return SupabaseConfig.url.absoluteString + photoPath
    }
    static func castId(_ p: Person) -> String? { avatarKinds && p.id == people[1].id ? "r" : nil }
    /// The saved builder config: a photo keeps its mascot (display = photo), a cast pick and a
    /// seeded default have none.
    /// `-storeDemoLook key=value,key=value`: overrides on WordWiz's look (10-05 captures: a no-eyes / no-mouth
    /// mascot, a crown or tall hat on the Home host).
    static var lookOverrides: [String: String] {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-storeDemoLook"), i + 1 < a.count else { return [:] }
        return Dictionary(uniqueKeysWithValues: a[i + 1].split(separator: ",").compactMap { kv in
            let parts = kv.split(separator: "=", maxSplits: 1).map(String.init)
            return parts.count == 2 ? (parts[0], parts[1]) : nil
        })
    }

    static func config(_ p: Person) -> [String: String] {
        if p.id == meId && plainMe { return [:] }
        if p.id == meId && !lookOverrides.isEmpty { return p.avatar.merging(lookOverrides) { $1 } }
        if p.id == meId && photoMe { var c = p.avatar; c["display"] = "photo"; return c }
        guard avatarKinds else { return p.avatar }
        if p.id == people[0].id { var c = p.avatar; c["display"] = "photo"; return c }
        if p.id == people[1].id || p.id == people[3].id { return [:] }
        return p.avatar
    }
    static func frame(_ p: Person) -> String { config(p)["frame"] ?? "none" }
    static func json(_ v: String?) -> Any { v.map { $0 as Any } ?? NSNull() }

    /// The test picture behind the demo photo URL: a drawn sunset landscape (no real person).
    static let testPhoto: Data = {
        let size = CGSize(width: 256, height: 256)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext
            let sky = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                 colors: [UIColor(red: 0.98, green: 0.62, blue: 0.42, alpha: 1).cgColor,
                                          UIColor(red: 0.55, green: 0.42, blue: 0.85, alpha: 1).cgColor] as CFArray,
                                 locations: [0, 1])!
            cg.drawLinearGradient(sky, start: CGPoint(x: 0, y: 256), end: .zero, options: [])
            UIColor(red: 1, green: 0.86, blue: 0.45, alpha: 1).setFill()
            cg.fillEllipse(in: CGRect(x: 88, y: 70, width: 80, height: 80))
            UIColor(red: 0.30, green: 0.55, blue: 0.40, alpha: 1).setFill()
            cg.fillEllipse(in: CGRect(x: -60, y: 160, width: 260, height: 200))
            UIColor(red: 0.22, green: 0.44, blue: 0.33, alpha: 1).setFill()
            cg.fillEllipse(in: CGRect(x: 90, y: 180, width: 260, height: 200))
        }
        return img.pngData() ?? Data()
    }()
    static func person(_ id: String) -> Person? { everyone.first { $0.id.lowercased() == id.lowercased() } }

    // MARK: Boot

    /// Called from didFinishLaunching (before any view): first-run gates off, the
    /// canned network on. The session comes from StoreDemoAuthStorage.
    static func bootIfRequested() {
        guard active else { return }
        UserDefaults.standard.set(true, forKey: Onboarding.flagKey)
        // The bot ladder this far (local-only store; each shot runs on a fresh install): 6 of 10, a 4-win streak.
        let ladder: [String: Any] = ["streak": 4, "bestStreak": 9, "rung": 2, "unlocked": [String](), "botOfDayStreak": 3,
                                     "ladderCleared": 6, "ladderRun": 0, "ladderVersion": CpuProgression.castLadderVersion]
        if let data = try? JSONSerialization.data(withJSONObject: ladder) { UserDefaults.standard.set(data, forKey: "wd_cpu_progression_v1") }
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
        if method == "GET", !host.contains("supabase"), !host.hasPrefix("server."), !url.path.hasPrefix("/api/") {
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
        // -storeAvatarKinds: the demo photo (a drawn test picture, never a real user's photo).
        if method == "GET", path == StoreDemo.photoPath {
            return (200, StoreDemo.testPhoto, ["Content-Type": "image/png"])
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
            case "profiles": return (200, json(profiles(idFilter: param("id"), nameFilter: param("username"))), count)
            case "app_flags":
                // Production's flags (all on): the More Games menu + every Puzzles title, so
                // Home reads "18 FRESH PUZZLES" (8 dailies + 10 puzzles) like the live app.
                let keys: [String] = ["menu.more"] + ["sudoku", "scramble", "hub", "crossword", "groups", "ladder", "cryptogram",
                                                      "wordsearch", "regions"].map { "mode." + $0 }
                let rows: [[String: Any]] = keys.map { ["key": $0, "enabled": true, "audience": "all"] }
                return (200, json(rows), count)
            case "daily_results" where (param("select") ?? "").contains("profiles!inner"):
                return (200, json(leaderboard(mode: String((param("game_mode") ?? "eq.DUEL").dropFirst(3)),
                                              ids: param("user_id"))), count)
            case "user_stats": return (200, json(userStats()), count)
            case "achievements":
                // 10-05 Title Shelves captures: WordWiz's earned titles, newest first (recently earned).
                let rows: [[String: Any]] = StoreDemo.earnedTitles.enumerated().map { i, k in
                    ["achievement_key": k, "unlocked_at": StoreDemo.iso(Date(timeIntervalSinceNow: -Double(i + 1) * 86_400 * 3))]
                }
                return (200, json(rows), count)
            case "matches" where (param("select") ?? "").contains("winner_id") && param("or") != nil:
                return (200, json(rivalMatches(or: param("or") ?? "")), count)
            case "daily_results" where param("play_type") == "eq.vs":
                // Today's Daily Battle: won (Stats "VS Battle W").
                let mine: Bool = (param("user_id") ?? "").lowercased() == "eq." + StoreDemo.meId
                let row: [String: Any] = ["id": "demo-vs", "vs_wins": 1, "vs_losses": 0, "vs_games": 1]
                return (200, json(mine ? [row] : [[String: Any]]()), count)
            case "daily_results" where param("select") == "composite_score" && param("user_id") == nil:
                // The day's field for one mode (Stats "Standing"): 160 scores, WordWiz near the top fifth.
                let field: [[String: Any]] = (0..<160).map { i in ["composite_score": Double(180 + (i * 53) % 820)] }
                return (200, json(field), count)
            case "daily_results" where (param("user_id") ?? "").lowercased() == "eq." + StoreDemo.meId:
                return (200, json(myResults(day: param("day"), mode: param("game_mode"))), count)
            default: return (200, json([Any]()), count)
            }
        }
        // The VS server's lobby counts (never the live socket).
        if path.hasSuffix("/vs/counts") { return (200, json(["waiting": ["DUEL": 3, "QUORDLE": 1], "playing": ["DUEL": 8, "OCTORDLE": 2]]), [:]) }
        if path.hasSuffix("/presence") { return (200, json(["online": 46]), [:]) }
        if path.hasPrefix("/api/friends/feed") { return (200, json(["events": feed(), "reactions": [String: Any]()]), [:]) }
        if path == "/api/friends" { return (200, json(friendsPayload()), [:]) }
        if path == "/api/achievements" { return (200, Data(StoreDemo.titleCatalog.utf8), [:]) }
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
        r["id"] = p.id; r["username"] = p.name; r["avatar_url"] = StoreDemo.json(StoreDemo.photoUrl(p)); r["is_pro"] = isMe && !StoreDemo.free
        r["pro_expires_at"] = isMe && StoreDemo.free ? NSNull() : StoreDemo.iso(Date(timeIntervalSinceNow: 86_400 * 200))
        r["is_banned"] = false; r["is_admin"] = false; r["role"] = NSNull(); r["has_onboarded"] = true
        r["level"] = p.level; r["xp"] = p.level * 1450; r["total_wins"] = wins; r["total_losses"] = 64
        r["current_streak"] = p.streak; r["best_streak"] = best
        r["daily_login_streak"] = p.streak; r["best_daily_login_streak"] = best
        r["streak_shields"] = 2; r["last_played_at"] = now; r["last_seen_at"] = now
        r["gold_medals"] = 38; r["silver_medals"] = 27; r["bronze_medals"] = 19
        r["created_at"] = created; r["pro_prompt_shown"] = true
        r["bio"] = "Daily Sweep or bust."; r["featured_achievement"] = NSNull(); r["accent_color"] = NSNull()
        r["favorite_mode"] = "DUEL"; r["avatar_emoji"] = NSNull(); r["is_private"] = false; r["notification_prefs"] = NSNull()
        r["avatar_cast_id"] = StoreDemo.json(StoreDemo.castId(p)); r["avatar_frame"] = StoreDemo.frame(p)
        r["avatar_config"] = StoreDemo.config(p)
        return r
    }

    /// `id=eq.X` / `id=in.(a,b)` → those people; otherwise the whole cast.
    static func profiles(idFilter: String?, nameFilter: String? = nil) -> [[String: Any]] {
        if let n = nameFilter {
            let wanted: String = n.lowercased()
            return StoreDemo.everyone.filter { wanted.contains($0.name.lowercased()) }.map(profileRow)
        }
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
            prof["username"] = p.name; prof["avatar_url"] = StoreDemo.json(StoreDemo.photoUrl(p)); prof["avatar_emoji"] = NSNull()
            prof["accent_color"] = NSNull(); prof["avatar_config"] = StoreDemo.config(p)
            prof["avatar_cast_id"] = StoreDemo.json(StoreDemo.castId(p)); prof["avatar_frame"] = StoreDemo.frame(p)
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
            out = StoreDemo.shot == "home" ? [] : rows(back: 0, count: 6) + puzzlesToday()
        } else {
            out = (1...60).flatMap { rows(back: $0, count: $0 % 5 == 0 ? 6 : 8) } + (StoreDemo.shot == "home" ? [] : rows(back: 0, count: 6))
        }
        if let mode, mode.hasPrefix("eq.") { out = out.filter { ($0["game_mode"] as? String) == String(mode.dropFirst(3)) } }
        return out
    }

    /// All-time per-mode records: solo, VS people (64-41) and VS bots (52-18).
    static func userStats() -> [[String: Any]] {
        let solo: [(String, Int, Int)] = [("DUEL", 312, 9), ("QUORDLE", 188, 14), ("OCTORDLE", 141, 19), ("SEQUENCE", 133, 12),
                                          ("RESCUE", 129, 8), ("DUEL_6", 118, 11), ("DUEL_7", 102, 16), ("GAUNTLET", 97, 23)]
        var out: [[String: Any]] = []
        func row(_ mode: String, _ type: String, _ w: Int, _ l: Int, _ avg: Int, _ fast: Int) -> [String: Any] {
            ["game_mode": mode, "play_type": type, "wins": w, "losses": l, "total_games": w + l,
             "best_score": 990, "average_time": avg, "fastest_time": fast]
        }
        for (m, w, l) in solo { out.append(row(m, "solo", w, l, 96, 31)) }
        out.append(row("DUEL", "vs", 64, 41, 88, 29))
        out.append(row("DUEL", "vs_cpu", 52, 18, 92, 33))
        return out
    }

    /// VS history against three friends (the lobby's RIVALS): LexiLoop 7-5, Quillby 4-6, VowelMaven 5-2.
    static func rivalMatches(or: String) -> [[String: Any]] {
        // The caller's own id exactly as it asked (`player1_id.eq.<uid>,…`), so its comparisons match.
        let first: String = or.trimmingCharacters(in: CharacterSet(charactersIn: "()")).components(separatedBy: ",").first ?? ""
        let uid: String = first.hasPrefix("player1_id.eq.") ? String(first.dropFirst("player1_id.eq.".count)) : StoreDemo.meId
        let p = StoreDemo.people
        let records: [(String, Int, Int)] = [(p[0].id, 7, 5), (p[1].id, 4, 6), (p[3].id, 5, 2)]
        let modes: [String] = ["DUEL", "QUORDLE", "DUEL_6"]
        var out: [[String: Any]] = []
        for (k, (opp, w, l)) in records.enumerated() {
            for i in 0..<(w + l) {
                let winner: String = i < w ? uid : opp
                out.append(["player1_id": uid, "player2_id": opp, "winner_id": winner, "game_mode": modes[k]])
            }
        }
        return out
    }

    /// Four Puzzles finished today (Stats "Puzzles 4 of 10").
    static func puzzlesToday() -> [[String: Any]] {
        let done: [(String, Int, Int)] = [("SUDOKU", 1, 212), ("SCRAMBLE", 4, 96), ("GROUPS", 4, 131), ("LADDER", 1, 74)]
        var list: [[String: Any]] = []
        for (m, boards, secs) in done {
            var r: [String: Any] = [:]
            r["user_id"] = StoreDemo.meId; r["day"] = StoreDemo.today; r["game_mode"] = m; r["play_type"] = "solo"
            r["completed"] = true; r["guess_count"] = boards + 1; r["time_seconds"] = Double(secs)
            r["composite_score"] = Double(640 + secs); r["boards_solved"] = boards; r["total_boards"] = boards
            r["hints_used"] = 0; r["created_at"] = StoreDemo.iso(Date())
            list.append(r)
        }
        return list
    }

    static func friendRow(_ p: StoreDemo.Person, online: Bool, activity: String?) -> [String: Any] {
        let seen: Date = online ? Date() : Date(timeIntervalSinceNow: -60 * 47)
        let past: [Int] = [p.points - 140, p.points - 90]
        var r: [String: Any] = [:]
        r["id"] = p.id; r["username"] = p.name; r["avatar_url"] = StoreDemo.json(StoreDemo.photoUrl(p))
        r["avatar_config"] = StoreDemo.config(p); r["avatar_cast_id"] = StoreDemo.json(StoreDemo.castId(p))
        r["avatar_frame"] = StoreDemo.frame(p); r["level"] = p.level
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
            e["id"] = "demo-\(i)"; e["userId"] = who.id; e["username"] = who.name; e["avatar_url"] = StoreDemo.json(StoreDemo.photoUrl(who))
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
        if let s = StoreDemo.shot, ["stage", "titles", "partyhat", "partyroom", "hostplain"].contains(s) || s.hasPrefix("room-") {
            // the dress-up doors need the signed-in profile
            for _ in 0..<60 where AuthService.shared.profile == nil { await PerfDrive.sleep(0.1) }
            DressUp.shared.resetForDemo()
        }
        switch StoreDemo.shot ?? "home" {
        case "classic": await classic(finish: false)
        case "finish": await classic(finish: true)
        case "finishDaily":
            // Today's Classic Six DAILY (unplayed in the demo), won: the daily finish dock (SHARE + NEXT,
            // RANKS, the Keep playing card) — free or Pro per `-storeDemoFree`.
            NotificationCenter.default.post(name: NextDailyCTA.playNextDaily, object: GameMode.duel6.rawValue)
            await PerfDrive.sleep(2.5)
            guard let answer = PerfTour.game?.boards.first?.solution.uppercased() else { return }
            for w in openers(for: answer).prefix(2) { await PerfDrive.type(w, gap: 0.05); PerfDrive.enter(); await PerfDrive.sleep(1.6) }
            await PerfDrive.type(answer, gap: 0.05); PerfDrive.enter()
        case "octo": await octo()
        // An Unlimited ProperNoundle in play (layout checks; pair with `-pnAnswerLength N`).
        case "propernoundle": PerfDrive.playUnlimited("PROPERNOUNDLE")
        case "stats": PerfTour.send(.selectTab(.stats))
        case "leaderboard": PerfTour.send(.selectTab(.leaderboard))
        case "friends":
            PerfTour.send(.selectTab(.friends))
            await PerfDrive.sleep(2.0)
            PerfTour.send(.sheet(.quickPlay))
        case "vs":
            // The VS lobby, as Home's VS BATTLE tile opens it: the VS banner, today's Daily Battle,
            // PLAY (modes + live / friend / bots), your People | Bots records and RIVALS.
            recordCast()
            present(AnyView(NavigationStack { VSLobbyView() }), full: true)
        case "vsintro":
            // The Match Found card: you vs a friend, both mascots, the VS lettering, your head-to-head.
            let lexi = StoreDemo.people[0]
            recordCast()
            let me = VSMatchIntroView.Player(username: StoreDemo.me.name, avatarUrl: nil, level: StoreDemo.me.level)
            let them = VSMatchIntroView.Player(username: lexi.name, avatarUrl: nil, level: lexi.level)
            present(AnyView(VSMatchIntroView(mode: .duel, me: me, opponent: them,
                                             headToHead: HeadToHeadRecord(myWins: 7, theirWins: 5, draws: 0), onDone: {})),
                    full: true)
        case "mascot": present(AnyView(StoreDemoMascotPage()))
        // 10-05 dress-up captures: the Stage, the Dressing Room per tab, the Title Shelves, the party-hat offer.
        case "stage": DressUp.shared.resetForDemo(); DressUp.shared.open()
        case "titles": DressUp.shared.resetForDemo(); DressUp.shared.open(.titles)
        case "partyhat": DressUp.shared.resetForDemo(); DressUp.shared.partyHatOffer = true; PerfTour.send(.selectTab(.home))
        case "partyroom": DressUp.shared.resetForDemo(); DressUp.shared.open(.partyHat)
        case "hostplain": DressUp.shared.resetForDemo(); PerfTour.send(.selectTab(.home))
        case let s where s.hasPrefix("room-"):
            DressUp.shared.resetForDemo()
            DressUp.shared.open(.room(MascotBuilderTab(rawValue: String(s.dropFirst(5))) ?? .body))
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

    /// Every cast member's look in the avatar directory (screens that draw a player by name).
    private static func recordCast() {
        for p in StoreDemo.everyone {
            AvatarDirectory.shared.record(userId: p.id, username: p.name, url: StoreDemo.photoUrl(p),
                                          config: AvatarConfigRaw(fields: StoreDemo.config(p)),
                                          castId: StoreDemo.castId(p), frame: StoreDemo.frame(p), accent: nil)
        }
    }

    private static func present(_ root: AnyView, full: Bool = false) {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        guard var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController ?? scene?.windows.first?.rootViewController
        else { return }
        while let next = top.presentedViewController { top = next }
        let host = UIHostingController(rootView: root)
        host.modalPresentationStyle = full ? .fullScreen : .pageSheet
        top.present(host, animated: false)
    }
}

/// The mascot maker, as Edit Profile opens it, with WordWiz's look.
private struct StoreDemoMascotPage: View {
    var body: some View {
        // BJ16: the MAKE YOUR MASCOT lettering over the builder, as the real mascot builder
        // (OnboardingView) draws it — no plain-text nav title.
        ScrollView {
            VStack(spacing: 12) {
                HeadingArtView(.mascot, height: 44, maxWidth: 340)
                MascotBuilderView(initial: "W", config: AvatarCatalog.validate(raw: AvatarConfigRaw(fields: StoreDemo.me.avatar)), level: StoreDemo.me.level, isPro: !StoreDemo.free)
            }
            .padding(16)
        }
    }
}
#endif
