import XCTest
@testable import WordociousCore

/// Friends overhaul parity guard (iOS side): FriendlyGames must replay every
/// pocket-game script to the same states, turns, winners, headlines and card
/// lines as packages/core/src/friendly-games.ts, and produce the same Tic-Tac-
/// Tile lines, presence lines, friend streaks and banner words.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class FriendlyGamesFixtureTests: XCTestCase {
    private struct Step: Decodable {
        let by: FriendlySide
        let move: FriendlyMove
        let ok: Bool
        let state: FriendlyState
        let turn: FriendlyTurn?
        let winner: FriendlyOutcome?
        let headlineA: String
        let headlineB: String
        let cardA: String
        let cardB: String
    }
    private struct Game: Decodable {
        let kind: FriendlyKind
        let steps: [Step]
    }
    private struct Line: Decodable { let side: FriendlySide; let cells: [Int] }
    private struct Board: Decodable {
        let board: [String]
        let line: Line?
    }
    private struct Presence: Decodable {
        let lastSeenMs: Int?
        let activity: String?
        let nowMs: Int
        let online: Bool
        let line: String?
    }
    private struct Streak: Decodable {
        let mine: [String]
        let theirs: [String]
        let today: String
        let streak: Int
    }
    private struct Banner: Decodable {
        let input: FriendsBannerInput
        let headline: String
        let clock: String
    }
    private struct Fixtures: Decodable {
        let games: [Game]
        let boards: [Board]
        let presence: [Presence]
        let streaks: [Streak]
        let banners: [Banner]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "friendly-games-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    /// The generator's coin flips and Pass the Puzzle answer (gen-parity-fixtures.ts).
    private static let flips: [FriendlyKind: [Double]] = [.coin: [0.1, 0.1, 0.1, 0.7, 0.3]]
    private static let solutions: [FriendlyKind: String] = [.pass: "RISKS"]

    func testGamesReplayToTheSharedFixtures() throws {
        let f = try load()
        XCTAssertEqual(Set(f.games.map(\.kind)), Set(FriendlyKind.allCases))
        for g in f.games {
            var s = FriendlyGames.newState(g.kind)
            var flips = Self.flips[g.kind] ?? []
            for (i, c) in g.steps.enumerated() {
                let tag = "\(g.kind.rawValue) step #\(i)"
                let r = FriendlyGames.applyMove(s, by: c.by, c.move,
                                                random: { flips.isEmpty ? 0.1 : flips.removeFirst() },
                                                solution: Self.solutions[g.kind])
                switch r {
                case .ok(let next, let done, let winner):
                    XCTAssertTrue(c.ok, "\(tag) should fail")
                    s = next
                    XCTAssertEqual(done, c.winner != nil, "\(tag) done")
                    XCTAssertEqual(winner, c.winner, "\(tag) move winner")
                case .failure(let msg):
                    XCTAssertFalse(c.ok, "\(tag) unexpected failure: \(msg)")
                }
                XCTAssertEqual(s, c.state, "\(tag) state")
                // The decoded server state drives every word below.
                let st = c.state
                XCTAssertEqual(FriendlyGames.whoseTurn(st), c.turn, "\(tag) turn")
                XCTAssertEqual(FriendlyGames.friendlyWinner(st), c.winner, "\(tag) winner")
                XCTAssertEqual(FriendlyGames.friendlyHeadline(st, me: .a), c.headlineA, "\(tag) headlineA")
                XCTAssertEqual(FriendlyGames.friendlyHeadline(st, me: .b), c.headlineB, "\(tag) headlineB")
                XCTAssertEqual(FriendlyGames.friendlyCardLine(state: st, me: .a, them: "Doug", minutesAgo: 4), c.cardA, "\(tag) cardA")
                XCTAssertEqual(FriendlyGames.friendlyCardLine(state: st, me: .b, them: "BT", minutesAgo: 75), c.cardB, "\(tag) cardB")
            }
        }
    }

    func testStatesRoundTripThroughJSON() throws {
        let f = try load()
        for g in f.games {
            for c in g.steps {
                let data = try JSONEncoder().encode(c.state)
                XCTAssertEqual(try JSONDecoder().decode(FriendlyState.self, from: data), c.state)
                let move = try JSONEncoder().encode(c.move)
                XCTAssertEqual(try JSONDecoder().decode(FriendlyMove.self, from: move), c.move)
            }
        }
    }

    func testHiddenRpsPickDecodes() throws {
        let json = #"{"kind":"rps","picks":{"a":"rock","b":"hidden"},"rounds":[],"score":{"a":0,"b":0}}"#
        let s = try JSONDecoder().decode(FriendlyState.self, from: Data(json.utf8))
        guard case .rps(let r) = s else { return XCTFail("not rps") }
        XCTAssertEqual(r.picks.b, .hidden)
        XCTAssertEqual(r.picks.a?.pick, .rock)
        // Both are in (the round is about to resolve server-side): nobody's turn yet → both.
        XCTAssertEqual(FriendlyGames.whoseTurn(s), .both)
    }

    func testTicTacTileLinesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.boards.isEmpty)
        for (i, c) in f.boards.enumerated() {
            let line = FriendlyGames.tttLine(c.board.map { FriendlySide(rawValue: $0) })
            XCTAssertEqual(line?.side, c.line?.side, "board #\(i) side")
            XCTAssertEqual(line?.cells, c.line?.cells, "board #\(i) cells")
        }
    }

    func testPresenceMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.presence.isEmpty)
        for (i, c) in f.presence.enumerated() {
            XCTAssertEqual(FriendlyGames.isOnline(lastSeenMs: c.lastSeenMs, nowMs: c.nowMs), c.online, "online #\(i)")
            XCTAssertEqual(FriendlyGames.presenceLine(lastSeenMs: c.lastSeenMs, activity: c.activity, nowMs: c.nowMs), c.line, "line #\(i)")
        }
    }

    func testFriendStreaksMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.streaks.isEmpty)
        for (i, c) in f.streaks.enumerated() {
            XCTAssertEqual(FriendlyGames.friendStreak(c.mine, c.theirs, today: c.today), c.streak, "streak #\(i)")
        }
    }

    func testBannersMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.banners.isEmpty)
        for (i, c) in f.banners.enumerated() {
            XCTAssertEqual(FriendlyGames.friendsBannerHeadline(c.input), c.headline, "headline #\(i)")
            // The generator's clock is "04:12:08".
            XCTAssertEqual(FriendlyGames.friendsBannerClockLine(c.input, clock: "04:12:08"), c.clock, "clock #\(i)")
        }
    }

    func testConstantsMatchCore() {
        XCTAssertEqual(FriendlyGames.coinStakes, ["Bragging rights", "Loser picks tonight's VS mode", "Winner goes first next time"])
        XCTAssertEqual(FriendlyKind.allCases.map(\.title), ["Rock Paper Scissors", "Tic-Tac-Tile", "Call It", "Pass the Puzzle"])
        XCTAssertEqual(FriendlyKind(title: "Call It"), .coin)
        XCTAssertEqual(FriendlyGames.commas(11990), "11,990")
        XCTAssertEqual(FriendlyGames.commas(-1234567), "-1,234,567")
    }
}
