import XCTest
@testable import WordociousCore

final class WotdQuizLocalTests: XCTestCase {
    typealias D = WotdQuizLocal.Day

    func testOutageUsesTheDeviceCopy() {
        let local = ["2026-10-02": D(picked: 1, correct: true), "2026-10-01": D(picked: 0, correct: true)]
        let r = WotdQuizLocal.merge(server: nil, local: local)
        XCTAssertEqual(r.days, local)
        XCTAssertEqual(r.pending, [])
    }

    func testServerWinsAndDeviceFillsGaps() {
        let server = ["2026-10-01": D(picked: 2, correct: false)]
        let local = ["2026-10-01": D(picked: 0, correct: true), "2026-10-02": D(picked: 1, correct: true)]
        let r = WotdQuizLocal.merge(server: server, local: local)
        XCTAssertEqual(r.days["2026-10-01"], D(picked: 2, correct: false))
        XCTAssertEqual(r.days["2026-10-02"], D(picked: 1, correct: true))
        XCTAssertEqual(r.pending, ["2026-10-02"])
    }

    func testPrune() {
        let local = ["2025-01-01": D(picked: 0, correct: true), "2026-10-02": D(picked: 1, correct: false)]
        XCTAssertEqual(Array(WotdQuizLocal.prune(local, since: "2025-09-01").keys), ["2026-10-02"])
    }
}
