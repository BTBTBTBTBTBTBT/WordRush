import Foundation
import SwiftUI
import UIKit

// FINISH_SPEC §AD: Low Power Mode and Reduce Motion both calm the app down — the
// light rays stop turning, continuous bobbing / glowing / wobbling stops, the living
// cast header's idle moves stop and confetti counts halve. One-shot springs (the
// squish, pop-ins, a celebration's entrance) stay. Every idle loop gates through
// `Motion.calm(_:)`; a view that should react live when Low Power Mode flips holds
// `@ObservedObject private var power = PowerMode.shared`.

/// Publishes Low Power Mode (iOS `ProcessInfo.isLowPowerModeEnabled`) so idle
/// motion stops / resumes the moment the player toggles it.
final class PowerMode: ObservableObject {
    static let shared = PowerMode()

    @Published private(set) var lowPower: Bool = ProcessInfo.processInfo.isLowPowerModeEnabled
    private var token: NSObjectProtocol?

    private init() {
        token = NotificationCenter.default.addObserver(
            forName: .NSProcessInfoPowerStateDidChange, object: nil, queue: .main
        ) { [weak self] _ in
            let on = ProcessInfo.processInfo.isLowPowerModeEnabled
            if self?.lowPower != on { self?.lowPower = on }
        }
    }
}

enum Motion {
    /// Low Power Mode is on right now.
    static var lowPower: Bool { ProcessInfo.processInfo.isLowPowerModeEnabled }

    /// §AD: idle / continuous motion is off — the in-app Reduce Motion toggle, the
    /// OS setting (`env` = `@Environment(\.accessibilityReduceMotion)`), or Low
    /// Power Mode.
    static func calm(_ env: Bool = false) -> Bool {
        env || Theme.reduceMotion || lowPower
    }

    /// §AD: a confetti / sparkle count, halved when calm (never below 1 when the
    /// full count is positive).
    static func particles(_ count: Int, calm: Bool) -> Int {
        calm ? max(count > 0 ? 1 : 0, count / 2) : count
    }
}
