import XCTest
@testable import WordociousCore

/// The musical cast easter egg (docs/cloud-prompts/10): the note map, the transform timing, the melody matcher + tap
/// reducer and the secret achievements — parity with packages/core/src/musical-cast.ts via musical-cast-fixtures.json
/// (web musical-cast.test.ts and Android MusicalCastFixtureTest.kt check the same file).
final class MusicalCastTests: XCTestCase {
    private struct NoteRow: Decodable {
        struct N: Decodable { let castId: String; let index: Int; let midi: Int; let name: String; let sound: String }
        let id: String
        let note: N?
    }
    private struct NameRow: Decodable { let midi: Int; let name: String }
    private struct TransformRow: Decodable { let id: String; let reduce: Bool; let delays: [Int]; let duration: Int }
    private struct Step: Decodable { let id: String; let at: Double; let midi: Int?; let matched: String?; let buffered: Int }
    private struct TapRow: Decodable { let name: String; let steps: [Step] }
    private struct MatchRow: Decodable { let played: [Int]; let matched: String? }
    private struct ListedRow: Decodable {
        struct A: Decodable { let key: String; let hidden: Bool?; let secret: Bool? }
        let a: A
        let unlocked: [String]
        let listed: Bool
    }
    private struct MelodyRow: Decodable { let id: String; let name: String; let achievement: String; let notes: [Int]; let intervals: [Int] }
    private struct Timing: Decodable { let longPressMs: Int; let moveSlop: Double; let staggerMs: Int; let popMs: Int }
    private struct PopKey: Decodable { let t: Double; let sx: Double; let sy: Double; let lift: Double }
    private struct F: Decodable {
        let scale: [Int]
        let timing: Timing
        let popKeys: [PopKey]
        let gapMs: Double
        let melodies: [MelodyRow]
        let secrets: [String]
        let notes: [NoteRow]
        let names: [NameRow]
        let transform: [TransformRow]
        let taps: [TapRow]
        let matches: [MatchRow]
        let listed: [ListedRow]
    }

    private func fixtureData(_ name: String) throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: name, withExtension: "json"))
        return try Data(contentsOf: url)
    }

    private func fixture() throws -> F {
        try JSONDecoder().decode(F.self, from: fixtureData("musical-cast-fixtures"))
    }

    func testFlagIsOnInDebugOffInRelease() {
        XCTAssertTrue(MusicalCast.flag.debug)
        XCTAssertFalse(MusicalCast.flag.release)
        XCTAssertTrue(MusicalCast.enabled(isDebugBuild: true))
        XCTAssertFalse(MusicalCast.enabled(isDebugBuild: false))
    }

    func testScaleAndTiming() throws {
        let f = try fixture()
        XCTAssertEqual(MusicalCast.scale, f.scale)
        XCTAssertEqual(MusicalCast.ids, ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"])
        XCTAssertEqual(MusicalTiming.longPressMs, f.timing.longPressMs)
        XCTAssertEqual(MusicalTiming.moveSlop, f.timing.moveSlop)
        XCTAssertEqual(MusicalTiming.staggerMs, f.timing.staggerMs)
        XCTAssertEqual(MusicalTiming.popMs, f.timing.popMs)
        XCTAssertEqual(MusicalCast.gapMs, f.gapMs)
    }

    func testPopKeys() throws {
        let f = try fixture()
        XCTAssertEqual(MusicalCast.popKeys.count, f.popKeys.count)
        for (k, w) in zip(MusicalCast.popKeys, f.popKeys) {
            XCTAssertEqual(k.t, w.t, accuracy: 1e-9)
            XCTAssertEqual(k.sx, w.sx, accuracy: 1e-9)
            XCTAssertEqual(k.sy, w.sy, accuracy: 1e-9)
            XCTAssertEqual(k.lift, w.lift, accuracy: 1e-9)
            // the pose passes through every key
            let p = MusicalCast.popPose(k.t)
            XCTAssertEqual(p.sx, w.sx, accuracy: 1e-9, "t=\(k.t)")
            XCTAssertEqual(p.sy, w.sy, accuracy: 1e-9, "t=\(k.t)")
            XCTAssertEqual(p.lift, w.lift, accuracy: 1e-9, "t=\(k.t)")
        }
    }

    func testNoteMap() throws {
        let f = try fixture()
        for row in f.notes {
            let n = MusicalCast.note(row.id)
            if let w = row.note {
                let got = try XCTUnwrap(n, row.id)
                XCTAssertEqual(got, MusicalNote(castId: w.castId, index: w.index, midi: w.midi, name: w.name, sound: w.sound), row.id)
            } else {
                XCTAssertNil(n, row.id)
            }
        }
        XCTAssertEqual(MusicalCast.ids.compactMap { MusicalCast.note($0)?.name },
                       ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"])
    }

    func testNoteNames() throws {
        let f = try fixture()
        for row in f.names { XCTAssertEqual(MusicalCast.noteName(row.midi), row.name, "\(row.midi)") }
    }

    func testTransform() throws {
        let f = try fixture()
        XCTAssertFalse(f.transform.isEmpty)
        for row in f.transform {
            XCTAssertEqual(MusicalCast.transformDelays(pressed: row.id, reduceMotion: row.reduce), row.delays, "\(row.id) reduce=\(row.reduce)")
            XCTAssertEqual(MusicalCast.transformDuration(pressed: row.id, reduceMotion: row.reduce), row.duration, "\(row.id) reduce=\(row.reduce)")
        }
    }

    func testMelodiesAndIntervals() throws {
        let f = try fixture()
        XCTAssertEqual(MusicalCast.melodies.count, f.melodies.count)
        for (m, w) in zip(MusicalCast.melodies, f.melodies) {
            XCTAssertEqual(m.id, w.id)
            XCTAssertEqual(m.name, w.name)
            XCTAssertEqual(m.achievement, w.achievement)
            XCTAssertEqual(m.notes, w.notes, m.id)
            XCTAssertEqual(MusicalCast.intervals(m.notes), w.intervals, m.id)
            // every note sits on a cast key
            for n in m.notes { XCTAssertTrue(MusicalCast.scale.contains(n), "\(m.id) \(n)") }
        }
    }

    func testTapSequences() throws {
        let f = try fixture()
        XCTAssertFalse(f.taps.isEmpty)
        for seq in f.taps {
            var s = MelodyState.start
            for (i, step) in seq.steps.enumerated() {
                let r = MusicalCast.tap(s, castId: step.id, atMs: step.at)
                s = r.state
                let at = "\(seq.name) step \(i) (\(step.id) @\(step.at))"
                XCTAssertEqual(r.note?.midi, step.midi, at)
                XCTAssertEqual(r.matched?.id, step.matched, at)
                XCTAssertEqual(r.state.notes.count, step.buffered, at)
            }
        }
    }

    func testMatches() throws {
        let f = try fixture()
        for row in f.matches { XCTAssertEqual(MusicalCast.match(row.played)?.id, row.matched, "\(row.played)") }
    }

    func testUnknownIdIsIgnored() {
        let r = MusicalCast.tap(.start, castId: "zz", atMs: 0)
        XCTAssertEqual(r, MelodyTap(state: .start, note: nil, matched: nil))
    }

    func testSecretsAndListing() throws {
        let f = try fixture()
        XCTAssertEqual(AchievementRules.secretKeys, f.secrets)
        XCTAssertEqual(MusicalCast.achievementKeys, f.secrets)
        for row in f.listed {
            XCTAssertEqual(AchievementRules.listed(key: row.a.key, hidden: row.a.hidden, secret: row.a.secret, unlocked: Set(row.unlocked)),
                           row.listed, "\(row.a.key) \(row.unlocked)")
        }
    }

    /// achievement-rules-fixtures.json `catalog` (NEW_ACHIEVEMENTS) carries `secret` on exactly the tunes' keys, and
    /// none of them is hidden.
    func testCatalogSecretsMatchAchievementRules() throws {
        struct Entry: Decodable { let key: String; let category: String; let icon: String; let hidden: Bool?; let secret: Bool? }
        struct C: Decodable { let catalog: [Entry] }
        let c = try JSONDecoder().decode(C.self, from: fixtureData("achievement-rules-fixtures"))
        let secrets = c.catalog.filter { $0.secret == true }
        XCTAssertEqual(secrets.map(\.key), AchievementRules.secretKeys)
        for e in secrets {
            XCTAssertNil(e.hidden, e.key)
            XCTAssertEqual(e.category, "mascot", e.key)
            XCTAssertEqual(e.icon, "sparkles", e.key)
        }
    }

    /// The app's bundled catalog snapshot (Wordocious/Resources/achievements-catalog.json, the /api/achievements
    /// payload) marks the same keys secret, so a fresh install hides them until earned.
    func testBundledCatalogMarksTheSecrets() throws {
        struct Entry: Decodable { let key: String; let secret: Bool? }
        struct P: Decodable { let achievements: [Entry] }
        let repo = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: repo.appendingPathComponent("apps/ios/Wordocious/Resources/achievements-catalog.json"))
        let p = try JSONDecoder().decode(P.self, from: data)
        XCTAssertEqual(p.achievements.filter { $0.secret == true }.map(\.key), AchievementRules.secretKeys)
    }
}
