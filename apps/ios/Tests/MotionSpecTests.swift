import XCTest
import CoreGraphics
@testable import WordociousCore

/// FINISH_SPEC BJ9 / BJ10: the game grow / soft rise and the menu soft pop — timing,
/// geometry, and which presentations keep the system sheet.
final class MotionSpecTests: XCTestCase {
    private let screen = CGRect(x: 0, y: 0, width: 402, height: 874)

    // MARK: Timing (the founder-approved demo's numbers)

    func testOpenTiming() {
        XCTAssertEqual(MotionSpec.liftScale, 1.03)
        XCTAssertEqual(MotionSpec.liftRise, 4)
        XCTAssertEqual(MotionSpec.liftDuration, 0.12, accuracy: 1e-9)
        XCTAssertEqual(MotionSpec.growDuration, 0.44, accuracy: 1e-9)
        // The game fades in over the LAST 60% of the grow.
        let r = MotionSpec.revealTiming(kind: .grow)
        XCTAssertEqual(r.delay, 0.12 + 0.44 * 0.4, accuracy: 1e-9)
        XCTAssertEqual(r.duration, 0.44 * 0.6, accuracy: 1e-9)
        XCTAssertEqual(MotionSpec.openDuration(kind: .grow), 0.12 + 0.44, accuracy: 1e-9)
    }

    func testCloseTiming() {
        XCTAssertEqual(MotionSpec.closeFadeDuration, 0.18, accuracy: 1e-9)
        XCTAssertEqual(MotionSpec.shrinkDuration, 0.38, accuracy: 1e-9)
        XCTAssertEqual(MotionSpec.closeDuration(kind: .grow), 0.56, accuracy: 1e-9)
        // Every close is quick: under 0.6 s, and the cross-fade is the shortest.
        for k in [MotionSpec.OpenKind.grow, .rise, .crossFade] {
            XCTAssertLessThan(MotionSpec.closeDuration(kind: k), 0.6)
        }
        XCTAssertLessThan(MotionSpec.closeDuration(kind: .crossFade), MotionSpec.closeDuration(kind: .rise))
    }

    func testOpenKind() {
        XCTAssertEqual(MotionSpec.openKind(hasSource: true, reduceMotion: false), .grow)
        XCTAssertEqual(MotionSpec.openKind(hasSource: false, reduceMotion: false), .rise)
        // Reduce Motion: always a plain cross-fade.
        XCTAssertEqual(MotionSpec.openKind(hasSource: true, reduceMotion: true), .crossFade)
        XCTAssertEqual(MotionSpec.openKind(hasSource: false, reduceMotion: true), .crossFade)
        XCTAssertEqual(MotionSpec.revealTiming(kind: .crossFade).delay, 0)
    }

    // MARK: Geometry

    func testLiftedFrameScalesAboutCenterAndRises() {
        let card = CGRect(x: 16, y: 300, width: 180, height: 120)
        let l = MotionSpec.liftedFrame(card)
        XCTAssertEqual(l.width, 180 * 1.03, accuracy: 1e-9)
        XCTAssertEqual(l.height, 120 * 1.03, accuracy: 1e-9)
        XCTAssertEqual(l.midX, card.midX, accuracy: 1e-9)
        XCTAssertEqual(l.midY, card.midY - 4, accuracy: 1e-9)
    }

    func testRiseStartsSmallerAndLower() {
        let s = MotionSpec.riseStartFrame(screen)
        XCTAssertEqual(s.width, screen.width * 0.96, accuracy: 1e-9)
        XCTAssertEqual(s.midX, screen.midX, accuracy: 1e-9)
        XCTAssertEqual(s.midY, screen.midY + 14, accuracy: 1e-9)
    }

    func testUsableSource() {
        XCTAssertNil(MotionSpec.usableSource(nil, in: screen))
        XCTAssertNil(MotionSpec.usableSource(.zero, in: screen), "a probe outside a window")
        XCTAssertNil(MotionSpec.usableSource(CGRect(x: 16, y: 2000, width: 180, height: 120), in: screen),
                     "a card scrolled off screen falls back to the soft rise")
        XCTAssertNil(MotionSpec.usableSource(CGRect(x: 16, y: 850, width: 180, height: 120), in: screen),
                     "a card mostly below the fold")
        let card = CGRect(x: 16, y: 300, width: 180, height: 120)
        XCTAssertEqual(MotionSpec.usableSource(card, in: screen), card)
    }

    func testCurvesAndLerp() {
        XCTAssertEqual(MotionSpec.expoOut(0), 0, accuracy: 1e-9)
        XCTAssertEqual(MotionSpec.expoOut(1), 1, accuracy: 1e-9)
        XCTAssertGreaterThan(MotionSpec.expoOut(0.4), 0.9, "most of the grow lands early (ease-out-expo)")
        let a = CGRect(x: 0, y: 0, width: 10, height: 10), b = CGRect(x: 10, y: 20, width: 30, height: 50)
        XCTAssertEqual(MotionSpec.lerp(a, b, 0), a)
        XCTAssertEqual(MotionSpec.lerp(a, b, 1), b)
        XCTAssertEqual(MotionSpec.lerp(a, b, 0.5), CGRect(x: 5, y: 10, width: 20, height: 30))
    }

    func testSoftPop() {
        XCTAssertEqual(MotionSpec.popScale, 0.94)
        XCTAssertEqual(MotionSpec.popAnchor, CGPoint(x: 0.5, y: 1), "bottom center")
        XCTAssertLessThan(MotionSpec.popDismissDuration, MotionSpec.popDuration, "dismiss reverses quickly")
    }

    // MARK: The menu exception list

    func testSystemSheetsStayNative() {
        for k in ["share", "purchase", "signInApple", "signInGoogle", "photoPicker", "mail", "safari"] {
            XCTAssertFalse(SoftPopPolicy.usesSoftPop(k), "\(k) keeps the system sheet")
        }
        XCTAssertFalse(SoftPopPolicy.usesSoftPop(SoftPopPolicy.fullScreenGames), "games grow instead")
        for k in ["help", "settings", "streak", "shield", "guide", "strategy", "wotd", "profile", "records",
                  "leaderboardBoard", "vs", "mascotMaker", "pro", "friend", "pocketGame", "achievements"] {
            XCTAssertTrue(SoftPopPolicy.usesSoftPop(k), "\(k) soft-pops")
        }
    }

    /// Every `.sheet(` left in the app is a system presenter from the exception list;
    /// everything else the app presents is a `.softSheet` (BJ10).
    func testOnlySystemSheetsUseTheSystemSlide() throws {
        let iosRoot = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        let src = iosRoot.appendingPathComponent("Wordocious/Sources")
        let files = try FileManager.default.contentsOfDirectory(at: src, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "swift" }
        // SoftPop.swift wraps `.sheet` itself; the DEBUG perf tour drives the raw sheet.
        let skip: Set<String> = ["SoftPop.swift", "PerfTour.swift"]
        var offenders: [String] = []
        for f in files where !skip.contains(f.lastPathComponent) {
            let lines = try String(contentsOf: f, encoding: .utf8).components(separatedBy: "\n")
            // `PerfTour.send(.sheet(...))` is a DEBUG perf-tour command (the tour presents the real sheet), not a presentation.
            for (i, line) in lines.enumerated() where line.contains(".sheet(") && !line.contains("PerfTour.send(.sheet(") && !line.trimmingCharacters(in: .whitespaces).hasPrefix("//") {
                let window = lines[i..<min(lines.count, i + 4)].joined(separator: " ")
                if !SoftPopPolicy.systemSheetTypes.contains(where: { window.contains($0) }) {
                    offenders.append("\(f.lastPathComponent):\(i + 1)")
                }
            }
        }
        XCTAssertEqual(offenders, [], "app-owned sheets must use .softSheet (BJ10)")
    }
}
