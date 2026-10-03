import XCTest
@testable import WordociousCore

/// BI15 — every daily game's result must reach Home, the leaderboards and the
/// stats under ONE key, and a write that times out must stay queued.
final class DailyResultPipelineTests: XCTestCase {

    // MARK: - Mode map: seed → isDaily → scoring config → Home key → leaderboard key

    private struct CatalogMode: Decodable {
        let id: String
        let dbKey: String?
        let dailyEligible: Bool
        let enabled: Bool
        let guessBase: Int
    }
    private struct Catalog: Decodable { let modes: [CatalogMode] }

    /// The canonical catalog (packages/core/modes.json) — the source the
    /// generated Swift/Kotlin/TS catalogs (Home cards, leaderboard pickers) come from.
    private func dailyModes() throws -> [CatalogMode] {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()               // Tests
            .deletingLastPathComponent()               // apps/ios
            .deletingLastPathComponent()               // apps
            .deletingLastPathComponent()               // repo
            .appendingPathComponent("packages/core/modes.json")
        let catalog = try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: url))
        return catalog.modes.filter { $0.enabled && $0.dailyEligible && $0.dbKey != nil }
    }

    /// Every game the founder named — a mode silently dropping out of the daily
    /// set must fail here, not in the App Store.
    func testEveryNamedDailyGameIsInTheCatalog() throws {
        let keys = Set(try dailyModes().compactMap(\.dbKey))
        let expected: Set<String> = [
            "DUEL", "DUEL_7", "DUEL_6", "QUORDLE", "OCTORDLE", "RESCUE", "SEQUENCE",
            "PROPERNOUNDLE", "GAUNTLET",
            "SCRAMBLE", "HUB", "SUDOKU", "REGIONS", "LADDER", "WORDSEARCH",
            "CRYPTOGRAM", "GROUPS", "CROSSWORD",
        ]
        XCTAssertEqual(keys, expected)
    }

    func testEveryDailyModeMapsConsistentlyEndToEnd() throws {
        let day = "2026-10-02"
        for m in try dailyModes() {
            let key = m.dbKey!
            // The game's finish path records GameMode(rawValue: key); the
            // leaderboard / rank queries filter game_mode = GameMode.rawValue;
            // Home reads completions.byMode[dbKey]. One string all the way through.
            guard let mode = GameMode(rawValue: key) else {
                XCTFail("\(m.id): dbKey \(key) has no GameMode — finish path can't record it"); continue
            }
            XCTAssertEqual(mode.rawValue, key, "\(m.id): leaderboard key != Home key")

            // Seed: generated the way every VM does (generateDailySeed(date:gameMode: GameMode.x.rawValue)).
            let seed = generateDailySeed(date: day, gameMode: mode.rawValue)
            XCTAssertTrue(isDailySeed(seed), "\(m.id): \(seed) not recognized as daily")
            XCTAssertEqual(getDailySeedDate(seed), day, "\(m.id): daily_results.day would be wrong")

            // Scoring: a missing config makes DailyResultsService.record skip the
            // row ("nil ALSO means mode has no daily scoring config").
            XCTAssertNotNil(DailyScoring.config[key], "\(m.id): no V2 scoring config — row never written")
            XCTAssertNotNil(DailyScoring.configV1[key], "\(m.id): no V1 scoring config")

            // A perfect run must clear the plausibility floor, or the best
            // possible result would never reach the leaderboard.
            let c = DailyScoring.config[key]!
            let perfect = c.perfectGuesses ?? m.guessBase
            XCTAssertTrue(Plausibility.isPlausibleDailyResult(
                completed: true, guessCount: perfect, timeSeconds: 300,
                totalBoards: c.totalBoards, gameMode: key), "\(m.id): perfect run rejected")
            XCTAssertGreaterThan(DailyScoring.compositeScore(
                gameMode: key, completed: true, guessCount: perfect, timeSeconds: 300,
                boardsSolved: c.totalBoards, totalBoards: c.totalBoards, dateKey: day), 1000,
                "\(m.id): a win scores nothing")

            // Queue: a registered finish for this seed owes its daily row and
            // shows on today's Home until it lands.
            let store = PendingRecordStore(defaults: freshDefaults())
            store.register(userId: "U", gameMode: key, seed: seed,
                           gameResult: .init(won: true, guessCount: perfect, timeSeconds: 300,
                                             boardsSolved: c.totalBoards, totalBoards: c.totalBoards, hintsUsed: 0))
            XCTAssertTrue(store.payload(gameMode: key, seed: seed)!.dailyRowOutstanding, "\(m.id)")
            XCTAssertEqual(store.outstandingDailies(userId: "u", day: day).map(\.gameMode), [key], "\(m.id)")
        }
    }

    /// The founder's Muddle: a normal win is owed a row under SCRAMBLE.
    func testMuddleWinIsOwedADailyRow() {
        let seed = generateDailySeed(date: "2026-10-02", gameMode: GameMode.scramble.rawValue)
        XCTAssertEqual(seed, "daily-2026-10-02-SCRAMBLE")
        XCTAssertTrue(Plausibility.isPlausibleDailyResult(completed: true, guessCount: 6, timeSeconds: 140,
                                                          totalBoards: 5, gameMode: "SCRAMBLE"))
    }

    // MARK: - Timed-out writes stay queued

    private var suites: [String] = []
    private func freshDefaults() -> UserDefaults {
        let name = "bi15-\(UUID().uuidString)"
        suites.append(name)
        return UserDefaults(suiteName: name)!
    }
    override func tearDown() {
        for s in suites { UserDefaults().removePersistentDomain(forName: s) }
        suites = []
        super.tearDown()
    }

    private let seed = "daily-2026-10-02-SCRAMBLE"
    private func registerMuddle(_ store: PendingRecordStore) {
        store.register(userId: "U", gameMode: "SCRAMBLE", seed: seed,
                       gameResult: .init(won: true, guessCount: 6, timeSeconds: 140,
                                         boardsSolved: 5, totalBoards: 5, hintsUsed: 0),
                       soloMatch: .init(won: true, score: 6, timeSeconds: 140,
                                        solutions: ["A"], guesses: ["A"], hintsUsed: 0))
    }

    func testHungWriteHitsTheDeadlineAndStaysQueued() async {
        let store = PendingRecordStore(defaults: freshDefaults())
        registerMuddle(store)
        let landed = await store.attempt(gameMode: "SCRAMBLE", seed: seed, part: .daily, deadlineSeconds: 0.05) {
            try await Task.sleep(nanoseconds: 5_000_000_000) // the outage: a request that never answers
        }
        XCTAssertFalse(landed)
        let p = store.payload(gameMode: "SCRAMBLE", seed: seed)
        XCTAssertNotNil(p, "a timed-out write must leave the payload queued")
        XCTAssertEqual(p?.outstanding, [.gameResult, .soloMatch, .daily])
        XCTAssertEqual(store.outstandingDailies(userId: "U", day: "2026-10-02").count, 1,
                       "Home must still show the finish while the row is owed")
    }

    func testURLSessionTimeoutErrorStaysQueued() async {
        let store = PendingRecordStore(defaults: freshDefaults())
        registerMuddle(store)
        let landed = await store.attempt(gameMode: "SCRAMBLE", seed: seed, part: .gameResult, deadlineSeconds: 5) {
            throw URLError(.timedOut)
        }
        XCTAssertFalse(landed)
        XCTAssertEqual(store.payload(gameMode: "SCRAMBLE", seed: seed)?.outstanding,
                       [.gameResult, .soloMatch, .daily])
    }

    func testRetryThatLandsReleasesThePayload() async {
        let store = PendingRecordStore(defaults: freshDefaults())
        registerMuddle(store)
        _ = await store.attempt(gameMode: "SCRAMBLE", seed: seed, part: .daily, deadlineSeconds: 0.05) {
            try await Task.sleep(nanoseconds: 5_000_000_000)
        }
        for part in [PendingPart.gameResult, .soloMatch, .daily] {
            let ok = await store.attempt(gameMode: "SCRAMBLE", seed: seed, part: part, deadlineSeconds: 5) {}
            XCTAssertTrue(ok)
        }
        XCTAssertNil(store.payload(gameMode: "SCRAMBLE", seed: seed))
        XCTAssertTrue(store.outstandingDailies(userId: "U", day: "2026-10-02").isEmpty)
    }

    func testDeadlineReturnsValueWhenFast() async throws {
        let v = try await withWriteDeadline(seconds: 5) { 42 }
        XCTAssertEqual(v, 42)
        do {
            _ = try await withWriteDeadline(seconds: 0.05) { () async throws -> Int in
                try await Task.sleep(nanoseconds: 5_000_000_000); return 1
            }
            XCTFail("expected a deadline")
        } catch let e as WriteDeadlineExceeded {
            XCTAssertEqual(e.seconds, 0.05)
        }
    }

    func testInFlightGameIsVisibleToDrain() {
        let store = PendingRecordStore(defaults: freshDefaults())
        let k = PendingRecordStore.key("SCRAMBLE", seed)
        XCTAssertFalse(store.isInFlight(k))
        store.beginFlight(gameMode: "SCRAMBLE", seed: seed) // record()
        store.beginFlight(gameMode: "SCRAMBLE", seed: seed) // recordSoloMatch() concurrently
        store.endFlight(gameMode: "SCRAMBLE", seed: seed)
        XCTAssertTrue(store.isInFlight(k), "drain must wait for BOTH live writes")
        store.endFlight(gameMode: "SCRAMBLE", seed: seed)
        XCTAssertFalse(store.isInFlight(k))
    }

    func testOtherDaysAndOtherUsersAreNotTodaysCompletions() {
        let store = PendingRecordStore(defaults: freshDefaults())
        registerMuddle(store)
        store.register(userId: "U", gameMode: "SUDOKU", seed: "daily-2026-10-01-SUDOKU",
                       gameResult: .init(won: true, guessCount: 1, timeSeconds: 200, boardsSolved: 1, totalBoards: 1, hintsUsed: 0))
        store.register(userId: "U", gameMode: "SUDOKU", seed: "1234-unlimited",
                       gameResult: .init(won: true, guessCount: 1, timeSeconds: 200, boardsSolved: 1, totalBoards: 1, hintsUsed: 0))
        XCTAssertEqual(store.outstandingDailies(userId: "U", day: "2026-10-02").map(\.gameMode), ["SCRAMBLE"])
        XCTAssertTrue(store.outstandingDailies(userId: "someone-else", day: "2026-10-02").isEmpty)
        // A confirmed daily row (progression still owed) no longer needs the Home overlay.
        store.markDone(gameMode: "SCRAMBLE", seed: seed, part: .daily)
        XCTAssertTrue(store.outstandingDailies(userId: "U", day: "2026-10-02").isEmpty)
        XCTAssertNotNil(store.payload(gameMode: "SCRAMBLE", seed: seed))
    }

    /// Payloads queued by builds before the ledger moved into Core still decode.
    func testLegacyPayloadJSONDecodes() throws {
        let json = """
        {"userId":"U","gameMode":"SCRAMBLE","seed":"daily-2026-10-02-SCRAMBLE","savedAt":1,
         "gameResult":{"won":true,"guessCount":6,"timeSeconds":140,"boardsSolved":5,"totalBoards":5,"hintsUsed":0},
         "gameResultDone":true}
        """
        let p = try JSONDecoder().decode(PendingPayload.self, from: Data(json.utf8))
        XCTAssertEqual(p.outstanding, [.daily])
        XCTAssertFalse(p.allDone)
    }
}
