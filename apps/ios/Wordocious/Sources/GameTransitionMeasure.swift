#if DEBUG
import SwiftUI
import UIKit
import QuartzCore
import WordociousCore

// FINISH_SPEC BJ9 — DEBUG-only measurement of the game open / close transitions.
//
// Launched with `-bj9Measure`, the app (on Home) opens Classic and OctoWord from
// their Home cards (the real route: the card is armed, then the widget's daily
// deep link opens it — the grow path) and closes them with the Home button's
// route, three times each, while the BJ3 CADisplayLink monitor (PerfMonitor)
// measures every open and close. The table is printed with a `BJ9|` prefix and
// written to Documents/perf/bj9-transitions.md, then the app exits.
//
// `-bj9Slow` instead slows every Core Animation animation 10x and loops one open /
// close slowly, so headless screenshots can catch the transition mid-flight.
//
// Booted by the first launch-card probe that reaches a window (no other file
// touched); idle without the launch arguments.
@MainActor
enum GameTransitionMeasure {
    static let measure = ProcessInfo.processInfo.arguments.contains("-bj9Measure")
    static let slow = ProcessInfo.processInfo.arguments.contains("-bj9Slow")
    /// `-bj9Menu`: every Core Animation animation 20x slower from Home on (tap a menu by hand).
    static let menu = ProcessInfo.processInfo.arguments.contains("-bj9Menu")
    private static var started = false

    static func bootOnce() {
        guard (measure || slow || menu), !started else { return }
        started = true
        Task { @MainActor in await run() }
    }

    private static func sleep(_ s: Double) async { try? await Task.sleep(nanoseconds: UInt64(s * 1_000_000_000)) }

    private static func open(_ key: String, _ mode: GameMode) {
        GameTransition.shared.arm(key)
        DeepLink.shared.dailyMode = mode
    }

    private static func close() {
        NotificationCenter.default.post(name: HomeNav.goHome, object: nil)
    }

    private static func setSpeed(_ speed: Float) {
        for w in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap(\.windows) {
            w.layer.speed = speed
        }
    }

    static func run() async {
        while !LaunchGate.isOpen { await sleep(0.05) }
        DictionaryLoader.ensureInitialized()
        await sleep(3.0)
        if menu {
            setSpeed(0.05)
            print("BJ9|MENU slow"); fflush(stdout)
            return
        }
        if slow {
            // A slow loop for mid-transition screenshots (10x slower Core Animation).
            print("BJ9|SLOW start \(CACurrentMediaTime())")
            for i in 0..<20 {
                setSpeed(0.1)
                print("BJ9|SLOW open \(i) \(CACurrentMediaTime())"); fflush(stdout)
                open("home:practice", .duel)
                await sleep(9.0)
                print("BJ9|SLOW close \(i) \(CACurrentMediaTime())"); fflush(stdout)
                setSpeed(0.1)
                close()
                await sleep(9.0)
            }
            return
        }
        let monitor = PerfMonitor.shared
        monitor.start()
        monitor.reset()
        let frames = FrameLog()
        frames.start()
        for (label, key, mode) in [("classic", "home:practice", GameMode.duel), ("octo", "home:octordle", GameMode.octordle)] {
            for _ in 0..<3 {
                monitor.begin("\(label).open")
                frames.mark("\(label).open")
                open(key, mode)
                await sleep(1.3)
                monitor.end()
                await sleep(1.2)
                monitor.begin("\(label).close")
                frames.mark("\(label).close")
                close()
                await sleep(1.0)
                monitor.end()
                frames.mark(nil)
                await sleep(1.5)
            }
        }
        write(monitor.finished, expected: monitor.expected, long: frames.long)
        exit(0)
    }

    private static func write(_ rows: [PerfMonitor.Stat], expected: CFTimeInterval, long: [String]) {
        var md = "# BJ9 game transitions\n\n\(UIDevice.current.name) · display \(Int((1 / expected).rounded())) Hz"
        md += " · reduce motion \(GameTransition.reduceMotion)\n\n"
        md += "| step | s | frames | >25ms | >50ms | worst ms | main busy % |\n|---|---:|---:|---:|---:|---:|---:|\n"
        for r in rows {
            let busy = r.durationMs > 0 ? r.busyMs / r.durationMs * 100 : 0
            md += String(format: "| %@ | %.2f | %d | %d | %d | %.0f | %.0f |\n",
                         r.name, r.durationMs / 1000, r.frames, r.over25, r.over50, r.worstMs, busy)
        }
        md += "\nFrames over 25 ms (step @ ms after the trigger: frame ms):\n\n" + long.map { "- \($0)" }.joined(separator: "\n") + "\n"
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("perf", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? md.write(to: dir.appendingPathComponent("bj9-transitions.md"), atomically: true, encoding: .utf8)
        for l in md.split(separator: "\n") { print("BJ9|\(l)") }
        print("BJ9|DONE")
        fflush(stdout)
    }
}

/// Every display-link frame over 25 ms, with its offset from the step's trigger.
final class FrameLog: NSObject {
    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private var stepAt: CFTimeInterval = 0
    private var step: String?
    private(set) var long: [String] = []

    func start() {
        let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
        l.add(to: .main, forMode: .common)
        link = l
    }

    func mark(_ name: String?) { step = name; stepAt = CACurrentMediaTime() }

    @objc private func tick(_ l: CADisplayLink) {
        defer { last = l.timestamp }
        guard last > 0, let step else { return }
        let dt = (l.timestamp - last) * 1000
        if dt > 25 { long.append(String(format: "%@ @ %.0f: %.0f", step, (last - stepAt) * 1000, dt)) }
    }
}
#endif
