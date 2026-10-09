import XCTest
@testable import WordociousCore

/// Parity: packages/core avatar-access.ts (avatar-access-fixtures.json) against the app's bundled avatar-access.json +
/// avatar-parts.json (mascot item gating, docs/cloud-prompts/11).
final class AvatarAccessTests: XCTestCase {
    private static let app = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Wordocious/Resources")

    struct Ctx: Decodable {
        let isPro: Bool; let date: String; let gating: Bool
        let owned: [String]?; let stats: AvatarEarnStats?; let saved: AvatarConfig?; let previewSeason: String?
        var context: AvatarAccessContext {
            AvatarAccessContext(isPro: isPro, owned: owned ?? [], stats: stats, date: date, previewSeason: previewSeason,
                                saved: saved, gating: gating)
        }
    }
    struct Named: Decodable { let name: String; let ctx: Ctx }
    struct Rule: Decodable { let field: String; let id: String; let gating: Bool; let key: String; let rule: AvatarAccessRule }
    struct Route: Decodable {
        let kind: String; let tier: String?; let price: Double?; let progress: AvatarEarnProgress?; let season: String?
        var route: AvatarAccessRoute? {
            switch kind {
            case "buy": return tier.map { .buy(tier: $0, price: price ?? 0) }
            case "pro": return .pro
            case "earn": return progress.map { .earn($0) }
            case "season": return season.map { .season($0) }
            default: return nil
            }
        }
    }
    struct Access: Decodable {
        let ctx: String; let part: AvatarPart; let unlocked: Bool; let reason: String; let routes: [Route]; let lines: [String]
    }
    struct Save: Decodable { let ctx: String; let draft: AvatarConfig; let ok: Bool; let locked: [AvatarPart]; let enforced: AvatarConfig }
    struct Earn: Decodable { let cond: AvatarEarnCondition; let stats: AvatarEarnStats?; let progress: AvatarEarnProgress }
    struct Earned: Decodable { let stats: AvatarEarnStats?; let keys: [String] }
    struct F: Decodable {
        let contexts: [Named]; let rules: [Rule]; let access: [Access]; let saves: [Save]; let earn: [Earn]; let earned: [Earned]
        let tableSize: Int
    }

    private func load() throws -> (F, AvatarAccessTable, AvatarManifest) {
        let m = try AvatarManifest.decode(Data(contentsOf: Self.app.appendingPathComponent("avatar-parts.json")))
        let t = try AvatarAccessTable.decode(Data(contentsOf: Self.app.appendingPathComponent("avatar-access.json")))
        let url = try XCTUnwrap(Bundle.module.url(forResource: "avatar-access-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "avatar-access-fixtures", withExtension: "json"))
        let f = try JSONDecoder().decode(F.self, from: Data(contentsOf: url))
        return (f, t, m)
    }

    func testShipsOff() {
        XCTAssertFalse(AvatarAccessConfig.itemGating)
    }

    func testTableMatchesFixture() throws {
        let (f, t, _) = try load()
        XCTAssertEqual(t.parts.count, f.tableSize)
        XCTAssertEqual(t.order.count, f.tableSize)
        XCTAssertEqual(Set(t.order), Set(t.parts.keys))
        XCTAssertEqual(t.order.first, "body:classic")   // file order, not sorted
        XCTAssertEqual(t.tiers["t3"], 2.99)
    }

    func testRulesMatchFixture() throws {
        let (f, t, m) = try load()
        XCTAssertFalse(f.rules.isEmpty)
        for c in f.rules {
            XCTAssertEqual(AvatarAccess.key(field: c.field, id: c.id), c.key)
            XCTAssertEqual(AvatarAccess.rule(field: c.field, id: c.id, gating: c.gating, table: t, manifest: m), c.rule,
                           "\(c.field):\(c.id) gating=\(c.gating)")
        }
    }

    func testAccessMatchesFixture() throws {
        let (f, t, m) = try load()
        let ctxs = Dictionary(uniqueKeysWithValues: f.contexts.map { ($0.name, $0.ctx.context) })
        XCTAssertFalse(f.access.isEmpty)
        for c in f.access {
            let ctx = try XCTUnwrap(ctxs[c.ctx], c.ctx)
            let a = AvatarAccess.partAccess(c.part, ctx, table: t, manifest: m)
            let tag = "\(c.ctx) \(c.part.field):\(c.part.id)"
            XCTAssertEqual(a.unlocked, c.unlocked, tag)
            XCTAssertEqual(a.reason.rawValue, c.reason, tag)
            XCTAssertEqual(a.routes, c.routes.compactMap(\.route), tag)
            XCTAssertEqual(c.routes.compactMap(\.route).count, c.routes.count, tag)
            XCTAssertEqual(AvatarAccess.lockedCardLines(a), c.lines, tag)
        }
    }

    func testSavesMatchFixture() throws {
        let (f, t, m) = try load()
        let ctxs = Dictionary(uniqueKeysWithValues: f.contexts.map { ($0.name, $0.ctx.context) })
        XCTAssertFalse(f.saves.isEmpty)
        for (i, c) in f.saves.enumerated() {
            let ctx = try XCTUnwrap(ctxs[c.ctx], c.ctx)
            let check = AvatarAccess.saveCheck(c.draft, ctx, table: t, manifest: m)
            XCTAssertEqual(check.ok, c.ok, "#\(i) \(c.ctx)")
            XCTAssertEqual(check.locked, c.locked, "#\(i) \(c.ctx)")
            let out = AvatarAccess.enforce(c.draft, ctx, table: t, manifest: m)
            XCTAssertEqual(out, c.enforced, "#\(i) \(c.ctx)")
            // field by field (the JSON the server stores: integrated parts / pose written only when worn)
            XCTAssertEqual(Set(out.jsonObject.keys), Set(c.enforced.jsonObject.keys), "#\(i) \(c.ctx)")
            XCTAssertEqual(out.jsonObject.compactMapValues { $0 as? String }, c.enforced.jsonObject.compactMapValues { $0 as? String },
                           "#\(i) \(c.ctx)")
        }
    }

    func testEarnMatchesFixture() throws {
        let (f, t, _) = try load()
        XCTAssertFalse(f.earn.isEmpty)
        for c in f.earn { XCTAssertEqual(AvatarAccess.evaluateEarn(c.cond, c.stats), c.progress, "\(c.cond.label) \(String(describing: c.stats))") }
        for c in f.earned { XCTAssertEqual(AvatarAccess.earnedKeys(c.stats, table: t), c.keys, String(describing: c.stats)) }
    }

    func testLockedCardCopy() {
        XCTAssertEqual(AvatarAccess.priceLabel(2.99), "$2.99")
        XCTAssertEqual(AvatarAccess.priceLabel(0.99), "$0.99")
        XCTAssertEqual(AvatarAccess.routeLine(.season("winter-holidays")), "Free during Winter Holidays")
        XCTAssertEqual(AvatarAccess.routeLine(.earn(AvatarEarnProgress(met: false, current: 3, target: 26, label: "Reach level 26"))),
                       "Earn: Reach level 26 (3 / 26)")
        XCTAssertEqual(AvatarAccess.routeLine(.earn(AvatarEarnProgress(met: false, current: 0, target: 1, label: "Beat Webster"))),
                       "Earn: Beat Webster")
        let stats = AvatarEarnStats(level: .nan)
        XCTAssertEqual(AvatarAccess.evaluateEarn(AvatarEarnCondition(label: "s", stat: "level", min: 10), stats).current, 0)
    }
}
