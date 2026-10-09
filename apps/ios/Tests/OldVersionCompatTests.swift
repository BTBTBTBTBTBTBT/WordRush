import XCTest
@testable import WordociousCore

/// Item 39: 2.7.1 and 2.8 players together. Reads Fixtures/compat-fixtures.json, the same file packages/core
/// (compat-2-7-1.test.ts) and Android (OldVersionCompatTest) read. Every shape another version can send must be read
/// without throwing: unknown ids are skipped, unknown keys are ignored, missing newer keys fall back.
final class OldVersionCompatTests: XCTestCase {
    private func fixtures() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "compat-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "compat-fixtures", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    private func parsed(_ p: BrandedInvite.Parsed?) -> [String: String]? {
        p.map { ["kind": $0.kind.rawValue, "code": $0.code] }
    }

    func testInviteLinksOfBothVersionsParseToTheSameInvite() throws {
        let cases = try XCTUnwrap(fixtures()["invites"] as? [[String: Any]])
        XCTAssertGreaterThan(cases.count, 10)
        for c in cases {
            let input = try XCTUnwrap(c["input"] as? String)
            XCTAssertEqual(parsed(BrandedInvite.parse(input)), c["parse"] as? [String: String], "parse \(input)")
            XCTAssertEqual(parsed(BrandedInvite.parseTyped(input)), c["typed"] as? [String: String], "typed \(input)")
        }
    }

    func testUnknownAvatarIdsAreSkippedNeverCrash() throws {
        let cases = try XCTUnwrap(fixtures()["avatars"] as? [[String: Any]])
        XCTAssertGreaterThan(cases.count, 8)
        func dict(_ c: AvatarConfig) throws -> [String: Any] {
            try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(c)) as? [String: Any])
        }
        for c in cases {
            let name = c["name"] as? String ?? "?"
            let src = try XCTUnwrap(c["source"] as? [String: Any])
            let username = src["username"] as? String
            let seeded = try dict(AvatarResolve.resolve(username: username, avatarUrl: nil, config: nil).config)
            let got = AvatarResolve.resolve(username: username, avatarUrl: src["avatarUrl"] as? String, config: src["config"],
                                            castId: src["castId"], frame: src["frame"], accentHex: src["accentHex"] as? String)
            XCTAssertEqual(got.kind.rawValue, c["kind"] as? String, name)
            XCTAssertEqual(got.photoUrl, c["photoUrl"] as? String, name)
            let cfg = try dict(got.config)
            for (k, v) in (c["config"] as? [String: Any]) ?? [:] {
                XCTAssertEqual(cfg[k] as? String, v as? String, "\(name): \(k)")
            }
            for k in (c["seeded"] as? [String]) ?? [] {
                XCTAssertEqual(cfg[k] as? String, seeded[k] as? String, "\(name): \(k) = seeded")
            }
            for k in (c["absent"] as? [String]) ?? [] {
                let v = cfg[k]
                XCTAssertTrue(v == nil || v is NSNull || (v as? String) == "none", "\(name): \(k) absent")
            }
        }
    }

    func testLiveChannelNamesAndReactions() throws {
        let live = try XCTUnwrap(fixtures()["live"] as? [String: Any])
        let topic = try XCTUnwrap(live["topic"] as? [String: String])
        XCTAssertEqual(FriendlyLive.topic(try XCTUnwrap(topic["gameId"])), topic["topic"])
        let events = try XCTUnwrap(live["events"] as? [String: String])
        XCTAssertEqual(FriendlyLive.eventMove, events["move"])
        XCTAssertEqual(FriendlyLive.eventReact, events["react"])
        let reactions = try XCTUnwrap(live["reactions"] as? [String: [String]])
        XCTAssertEqual(FriendlyLive.reactions, reactions["known"])
        for r in reactions["known"] ?? [] { XCTAssertTrue(FriendlyLive.isReaction(r), r) }
        for r in reactions["unknown"] ?? [] { XCTAssertFalse(FriendlyLive.isReaction(r), r) }
        XCTAssertFalse(FriendlyLive.isReaction(nil))
    }

    func testAGameListWithRowsThisBuildCannotReadKeepsTheRest() throws {
        let games = try XCTUnwrap((fixtures()["games"] as? [String: Any])?["list"] as? [String: Any])
        struct Payload: Decodable { let active: LossyList<FriendlyGameView>; let recent: LossyList<FriendlyGameView> }
        let data = try JSONSerialization.data(withJSONObject: ["active": games["active"] as Any, "recent": games["recent"] as Any])
        let p = try JSONDecoder().decode(Payload.self, from: data)
        XCTAssertEqual(p.active.items.map(\.id), games["keptIds"] as? [String])
        XCTAssertEqual(p.recent.items.count, 0)
        // The skipped rows are the unknown kind, a string and a null: the extra keys on a kept row did no harm.
        XCTAssertEqual(p.active.items.first?.kind, .rps)
    }

    func testLossyListSkipsEveryKindOfBadElement() throws {
        let json = #"[1, "x", null, {"id":"a"}, [1,2], true]"#.data(using: .utf8)!
        struct Item: Decodable { let id: String }
        XCTAssertEqual(try JSONDecoder().decode(LossyList<Item>.self, from: json).items.map(\.id), ["a"])
        XCTAssertEqual(try JSONDecoder().decode(LossyList<Item>.self, from: "[]".data(using: .utf8)!).items.count, 0)
    }

    func testMovesFromEitherVersion() throws {
        let moves = try XCTUnwrap((fixtures()["games"] as? [String: Any])?["moves"] as? [[String: Any]])
        for m in moves {
            let name = m["name"] as? String ?? "?"
            let state = try JSONDecoder().decode(FriendlyState.self, from: JSONSerialization.data(withJSONObject: try XCTUnwrap(m["state"])))
            let by = try XCTUnwrap(FriendlySide(rawValue: try XCTUnwrap(m["by"] as? String)))
            // A move this build cannot even decode is a refusal, never a crash.
            let move = try? JSONDecoder().decode(FriendlyMove.self, from: JSONSerialization.data(withJSONObject: try XCTUnwrap(m["move"])))
            var ok = false
            if let move, case .ok = FriendlyGames.applyMove(state, by: by, move) { ok = true }
            XCTAssertEqual(ok, m["ok"] as? Bool, name)
        }
    }

    func testStoredAgeAnswersFromAnyVersion() throws {
        let age = try XCTUnwrap(fixtures()["age"] as? [String: Any])
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let now = cal.date(from: DateComponents(year: try XCTUnwrap(age["nowYear"] as? Int), month: 6, day: 15))!
        for c in try XCTUnwrap(age["stored"] as? [[String: Any]]) {
            let raw = c["raw"] as? String
            let got = AgeCheck.parse(raw?.data(using: .utf8), now: now, calendar: cal)
            if let want = c["expect"] as? [String: Any] {
                XCTAssertEqual(got?.state.rawValue, want["state"] as? String, "\(raw ?? "nil")")
                XCTAssertEqual(got?.year, want["year"] as? Int, "\(raw ?? "nil")")
            } else {
                XCTAssertNil(got, "\(raw ?? "nil")")
            }
        }
    }

    func testRichPushPayloadsFromNewerAndOlderServers() throws {
        let push = try XCTUnwrap(fixtures()["push"] as? [String: Any])
        for c in try XCTUnwrap(push["rich"] as? [[String: Any]]) {
            let name = c["name"] as? String ?? "?"
            let got = PushRich.parse(userInfo: ["aps": ["alert": "x"], "url": "/daily", "rich": c["fields"] as Any])
            guard let want = c["expect"] as? [String: Any] else { XCTAssertNil(got, name); continue }
            let r = try XCTUnwrap(got, name)
            XCTAssertEqual(r.senderId, want["senderId"] as? String, name)
            XCTAssertEqual(r.senderName, want["senderName"] as? String, name)
            XCTAssertEqual(r.senderAvatar?.absoluteString, want["senderAvatar"] as? String, name)
            XCTAssertEqual(r.youAvatar?.absoluteString, want["youAvatar"] as? String, name)
            XCTAssertEqual(r.gameId, want["gameId"] as? String, name)
            XCTAssertEqual(r.gameTitle, want["gameTitle"] as? String, name)
            XCTAssertEqual(r.gameImage?.absoluteString, want["gameImage"] as? String, name)
            XCTAssertEqual(r.thread, want["thread"] as? String, name)
            XCTAssertEqual(r.accent, want["accent"] as? String, name)
            XCTAssertEqual(r.halloween, want["halloween"] as? Bool, name)
            XCTAssertEqual(r.score, want["score"] as? String, name)
            XCTAssertEqual(r.url, want["url"] as? String, name)
        }
        // A legacy push (no rich key at all) and a malformed rich value are both "not rich".
        XCTAssertNil(PushRich.parse(userInfo: ["aps": ["alert": "x"], "url": "/daily"]))
        XCTAssertNil(PushRich.parse(userInfo: ["rich": "not-a-dictionary"]))
    }
}
