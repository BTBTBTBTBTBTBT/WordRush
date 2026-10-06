import XCTest
@testable import WordociousCore

/// 2.7.1 cast puppets: iOS reads the SAME rig bundle as web and Android (byte-identical
/// copies written by ship-rigs.py) and draws the same frames as the reference evaluator
/// (rig-engine/rig-golden.json; web cast-rig.test.ts and Android CastRigTest.kt check it too).
final class CastRigTests: XCTestCase {
    private var repo: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
    }
    private func read(_ path: String) throws -> Data { try Data(contentsOf: repo.appendingPathComponent(path)) }
    private let iosPath = "apps/ios/Wordocious/Resources/Assets.xcassets/cast-rigs.dataset/cast-rigs.json"

    func testSameBundleOnAllThreePlatforms() throws {
        let ios = try read(iosPath)
        XCTAssertEqual(ios, try read("apps/web/public/art/rig/cast-rigs.json"))
        XCTAssertEqual(ios, try read("apps/android/app/src/main/res/raw/cast_rigs.json"))
    }

    func testEveryLayerHasAnImageSet() throws {
        let b = try CastRigBundle.decode(try read(iosPath))
        XCTAssertEqual(b.cast, ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"])
        for id in b.cast {
            let rig = try XCTUnwrap(b.rigs[id])
            XCTAssertGreaterThan(rig.gestureSeconds, 1, id)
            for layer in rig.lay.keys {
                let p = "apps/ios/Wordocious/Resources/Assets.xcassets/rig-\(id)-\(layer).imageset/rig-\(id)-\(layer).png"
                XCTAssertTrue(FileManager.default.fileExists(atPath: repo.appendingPathComponent(p).path), p)
            }
        }
    }

    func testLaughFadesInAndOut() throws {
        let b = try CastRigBundle.decode(try read(iosPath))
        XCTAssertEqual(CastRig.kfVal(b.tap.laugh, 0), 0)
        XCTAssert((0.2...0.8).contains(CastRig.kfVal(b.tap.laugh, 0.075)))
        XCTAssertEqual(CastRig.kfVal(b.tap.laugh, 0.5), 1)
        XCTAssertEqual(CastRig.kfVal(b.tap.laugh, 0.99), 0)
    }

    func testMatchesGoldenFrames() throws {
        let b = try CastRigBundle.decode(try read(iosPath))
        let golden = try XCTUnwrap(JSONSerialization.jsonObject(with: try read("docs/design/brand/animation/rig-engine/rig-golden.json")) as? [[String: Any]])
        XCTAssertGreaterThan(golden.count, 90)
        XCTAssert(golden.contains { ($0["ambient"] as? Bool) == false })
        for f in golden {
            let id = f["id"] as! String
            let t = (f["t"] as! NSNumber).doubleValue
            let g = (f["g"] as? NSNumber)?.doubleValue
            let tap = (f["tap"] as? NSNumber)?.doubleValue
            let still = f["still"] as! Bool
            let ambient = f["ambient"] as? Bool ?? true
            let want = f["ops"] as! [[Any]]
            let ops = b.rigs[id]!.evaluate(b, t: t, gr: g, tap: tap, still: still, ambient: ambient)
            let at = "\(id) t=\(t) g=\(String(describing: g)) tap=\(String(describing: tap)) still=\(still) ambient=\(ambient)"
            XCTAssertEqual(ops.map(\.layer), want.map { $0[0] as! String }, at)
            guard ops.count == want.count else { continue }
            for (op, w) in zip(ops, want) {
                let m = (w[1] as! [NSNumber]).map(\.doubleValue)
                for k in 0..<6 { XCTAssertEqual(op.m[k], m[k], accuracy: 2e-3, "\(at) \(op.layer) m\(k)") }
                XCTAssertEqual(op.alpha, (w[2] as! NSNumber).doubleValue, accuracy: 2e-3, "\(at) \(op.layer) alpha")
            }
        }
    }
}
