import XCTest
@testable import WordociousCore

final class GauntletHeaderTests: XCTestCase {
    func testSlotsMatchTheShippedSocketMap() throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../../docs/design/brand/gauntlet/header-slots.json")
        let json = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let slots = (json["slots"] as! [[String: Double]]).map {
            GauntletHeaderSpec.Slot(x: CGFloat($0["x"]!), y: CGFloat($0["y"]!), d: CGFloat($0["d"]!))
        }
        XCTAssertEqual(slots, GauntletHeaderSpec.slots)
    }

    func testMedalStates() {
        XCTAssertEqual(GauntletHeaderSpec.medals(stageCount: 5, current: 2, cleared: [0, 1]),
                       [.cleared, .cleared, .current, .locked, .locked])
        XCTAssertEqual(GauntletHeaderSpec.medals(stageCount: 5, current: 4, cleared: [0, 1, 2, 3, 4]),
                       Array(repeating: .cleared, count: 5))
    }

    func testMedalFrameSitsInTheHeader() {
        let w: CGFloat = 150
        let f = GauntletHeaderSpec.medalFrame(2, width: w)
        XCTAssertEqual(f.center.x, 0.5016 * w, accuracy: 0.01)
        XCTAssertLessThanOrEqual(f.center.y + f.side / 2, w / GauntletHeaderSpec.aspect + 1)
        XCTAssertEqual(GauntletHeaderSpec.label(current: 2, stageCount: 5, stageName: "Succession"),
                       "Gauntlet, stage 3 of 5, Succession")
    }
}
