import XCTest
@testable import WordociousCore

/// Home headline pool parity guard (iOS side): HomeHeadlinePool + the generated HomeHeadlineBank must produce the
/// same buckets, packs, weekdays, bank and selections as packages/core/src/home-headline-pool.ts for every fixture
/// case, so the Home headline reads identically on web, iOS and Android.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class HomeHeadlinePoolFixtureTests: XCTestCase {
    private struct Bucket: Decodable { let hour: Int; let bucket: String }
    private struct Calendar: Decodable { let dateKey: String; let pack: String?; let weekday: Int }
    private struct StreaksIn: Decodable { let word: GroupStreaks; let puzzles: GroupStreaks }
    private struct LastGameIn: Decodable { let title: String; let won: Bool; let minutesAgo: Int; let record: Bool? }
    private struct Ctx: Decodable {
        let name: String
        let hour: Int
        let dateKey: String
        let word: GroupProgress
        let puzzles: GroupProgress
        let streaks: StreaksIn?
        let unlimited: Bool?
        let nextGame: String?
        let lastGame: LastGameIn?
        let holiday: String?
        let slotWidth: Double?
        let userSeed: String?
        let history: [String]?
    }
    private struct Selection: Decodable {
        let ctx: Ctx
        let text: String
        let id: String
        let context: String
        let bucket: String
    }
    private struct Fixtures: Decodable {
        let buckets: [Bucket]
        let calendar: [Calendar]
        let bank: [String: [String]]
        let selections: [Selection]
    }

    private func load() throws -> (Fixtures, bankOrder: [String]) {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "home-headline-pool-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        let data = try Data(contentsOf: url)
        let f = try JSONDecoder().decode(Fixtures.self, from: data)
        // JSON object key order is the TS bank order; JSONSerialization drops it, so read the tags off the raw text.
        let text = try XCTUnwrap(String(data: data, encoding: .utf8))
        let bankStart = try XCTUnwrap(text.range(of: "\"bank\":"))
        let bankText = text[bankStart.upperBound...]
        var order: [String] = []
        var depth = 0
        var i = bankText.startIndex
        var seenOpen = false
        while i < bankText.endIndex {
            let ch = bankText[i]
            if ch == "{" || ch == "[" { depth += 1; seenOpen = true }
            else if ch == "}" || ch == "]" { depth -= 1; if seenOpen && depth == 0 { break } }
            else if ch == "\"" {
                // Skip every string (lines carry "{name}" braces); only a depth-1 string is a tag.
                let close = try XCTUnwrap(bankText[bankText.index(after: i)...].firstIndex(of: "\""))
                if depth == 1 { order.append(String(bankText[bankText.index(after: i)..<close])) }
                i = close
            }
            i = bankText.index(after: i)
        }
        return (f, order)
    }

    func testBucketsAndCalendarMatchSharedFixtures() throws {
        let (f, _) = try load()
        XCTAssertFalse(f.buckets.isEmpty)
        for c in f.buckets { XCTAssertEqual(HomeHeadlinePool.timeBucket(c.hour).rawValue, c.bucket, "hour \(c.hour)") }
        XCTAssertFalse(f.calendar.isEmpty)
        for c in f.calendar {
            XCTAssertEqual(HomeHeadlinePool.headlinePack(c.dateKey), c.pack, "pack \(c.dateKey)")
            XCTAssertEqual(HomeHeadlinePool.weekdayOf(c.dateKey), c.weekday, "weekday \(c.dateKey)")
        }
    }

    /// The generated bank: the same tags in the same order with the same lines as the TS bank.
    func testBankMatchesSharedFixtures() throws {
        let (f, order) = try load()
        XCTAssertEqual(order.count, f.bank.count)
        XCTAssertEqual(HomeHeadlineBank.pools.map(\.tag), order)
        for p in HomeHeadlineBank.pools {
            XCTAssertEqual(p.lines, f.bank[p.tag], "bank \(p.tag)")
            XCTAssertEqual(HomeHeadlineBank.pool(p.tag), p.lines)
        }
        XCTAssertEqual(HomeHeadlineBank.pool("no/such/tag"), [])
    }

    func testSelectionsMatchSharedFixtures() throws {
        let (f, _) = try load()
        XCTAssertEqual(f.selections.count, 1890)
        for (i, s) in f.selections.enumerated() {
            let c = s.ctx
            let ctx = HomeHeadlinePool.Context(
                name: c.name, hour: c.hour, dateKey: c.dateKey, word: c.word, puzzles: c.puzzles,
                streaks: c.streaks.map { .init(word: $0.word, puzzles: $0.puzzles) },
                unlimited: c.unlimited ?? false, nextGame: c.nextGame,
                lastGame: c.lastGame.map { .init(title: $0.title, won: $0.won, minutesAgo: $0.minutesAgo, record: $0.record ?? false) },
                holiday: c.holiday, slotWidth: c.slotWidth, userSeed: c.userSeed, history: c.history ?? [])
            let got = HomeHeadlinePool.select(ctx)
            XCTAssertEqual(got.text, s.text, "selection #\(i) text")
            XCTAssertEqual(got.id, s.id, "selection #\(i) id")
            XCTAssertEqual(got.context.rawValue, s.context, "selection #\(i) context")
            XCTAssertEqual(got.bucket.rawValue, s.bucket, "selection #\(i) bucket")
        }
    }

    func testFillAndFitHelpers() {
        XCTAssertEqual(HomeHeadlinePool.fillHeadline("Nice {last}, {name}!", slots: ["last": "Muddle", "name": "bmt"]), "NICE MUDDLE, BMT!")
        XCTAssertNil(HomeHeadlinePool.fillHeadline("NEXT UP: {next}", slots: [:]))
        XCTAssertNil(HomeHeadlinePool.fillHeadline("{left} LEFT", slots: ["left": ""]))
        XCTAssertEqual(HomeHeadlinePool.fillHeadline("{foo} stays", slots: [:]), "{FOO} STAYS")
        XCTAssertTrue(HomeHeadlinePool.headlineFitsSlot("GOOD MORNING, BMT!", name: "BMT", slotWidth: 294))
        XCTAssertEqual(HomeHeadlinePool.lastGameFreshMinutes, 20)
        XCTAssertEqual(HomeHeadlinePool.historyDays, 10)
        XCTAssertEqual(HomeHeadlinePool.seasonRate, 3)
        XCTAssertEqual(HomeHeadlinePool.surpriseRate, 12)
        XCTAssertEqual(HomeHeadlinePool.minFitScale, 0.85)
        XCTAssertEqual(HomeHeadlinePool.defaultSlotWidth, 294)
    }
}
