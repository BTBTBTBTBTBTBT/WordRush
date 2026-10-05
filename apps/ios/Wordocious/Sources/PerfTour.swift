#if DEBUG
import SwiftUI
import UIKit
import Combine
import QuartzCore
import os
import WordociousCore

// FINISH_SPEC BJ3 — the reusable perf harness (docs/PERF_HARNESS.md).
//
// DEBUG-only. Launched with `-perfTour`, the app plays itself through every major
// surface (cold start, Home, the tabs, the sheets, the games) while a CADisplayLink
// frame monitor and a main-run-loop busy meter measure each step. Every step is an
// os_signpost interval (subsystem com.wordocious.perf, Points of Interest), every
// stall over 50 ms a signpost event, so an Instruments trace lines up with the table.
// At the end the per-surface table is written to Documents/perf/ and printed with a
// `PERFTOUR|` prefix, and the app exits.
//
// Launch arguments:
//   -perfTour                   run the tour
//   -perfTourOnly home,games    run only the steps whose name starts with one of these
//   -perfTourLoops 2            run the tour N times (one table per loop)
//   -perfTourStay               don't exit at the end
//
// The driver uses the app's own routes (tab selection, the post-game "play
// unlimited" notification, sheets, the hardware-key path every board listens to)
// and scrolls the page's UIScrollView frame by frame, so nothing here changes a
// Release code path. Guest mode is forced on a signed-out install (nothing records).

@MainActor
enum PerfTour {
    static let requested = ProcessInfo.processInfo.arguments.contains("-perfTour")

    static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    /// Commands a few screens listen to (only while the tour runs).
    enum Command: Equatable {
        case selectTab(AppTab)
        case sheet(Sheet?)
        case cover(Cover?)
        case strategyArticle(Int)
        case wordDetail(Int)
        /// BJ14: zoom an OctoWord mini board in (index) / back out (nil).
        case zoomBoard(Int?)
        /// 2.7.1 gate: the Dressing Room's tab (MascotBuilder) and its mascot hop.
        case builderTab(MascotBuilderTab)
        case builderHop
        /// 2.7.1 gate: ProperNoundle's whole-clue card open / closed.
        case noundleClue(Bool)
    }

    enum Sheet: String, Identifiable { case settings, help, strategy, words, quickPlay; var id: String { rawValue } }
    enum Cover: String, Identifiable { case vsBot; var id: String { rawValue } }

    static let commands = PassthroughSubject<Command, Never>()
    static func send(_ c: Command) { commands.send(c) }

    /// A/B switches for a measurement run (`-perfFlag noPop` …, repeatable). Read only
    /// from DEBUG code; never ship a check of one.
    nonisolated static let flags: Set<String> = {
        let a = ProcessInfo.processInfo.arguments
        return Set(a.indices.filter { a[$0] == "-perfFlag" && $0 + 1 < a.count }.map { a[$0 + 1] })
    }()
    nonisolated static func flag(_ f: String) -> Bool { flags.contains(f) }

    /// BJ14: a timestamped trace line (`-perfMarks <host path>`), for lining up
    /// events with the monitor's long frames.
    nonisolated static let marksPath: String? = {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-perfMarks"), i + 1 < a.count else { return nil }
        return a[i + 1]
    }()
    nonisolated static func mark(_ s: String) {
        guard let p = marksPath else { return }
        let line = String(format: "%.4f %@\n", CACurrentMediaTime(), s)
        if let h = FileHandle(forWritingAtPath: p) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); h.closeFile() }
        else { try? line.write(toFile: p, atomically: false, encoding: .utf8) }
    }

    /// The word board on screen (GameViewModel registers itself), for Gauntlet's answer.
    static weak var game: GameViewModel?
    /// Every live hardware-key catcher (KeyCaptureView registers itself).
    static let keyViews = NSHashTable<KeyCaptureView>.weakObjects()

    /// Called from the app delegate's didFinishLaunching.
    static func bootIfRequested() {
        guard requested else { return }
        PerfMonitor.shared.start()
        PerfMonitor.shared.begin("launch.intro")
        // A fresh perf simulator lands on the app, not the sign-in gate / first-run flow.
        UserDefaults.standard.set(true, forKey: Onboarding.flagKey)
        if !AuthService.hadPersistedSession, !StoreDemo.active { AuthService.shared.isGuest = true }
        Task { @MainActor in await PerfTourDriver.run() }
    }

    /// Send one key to the frontmost live key catcher (+ the on-screen key's haptic).
    @discardableResult
    static func key(_ k: HardwareKey) -> Bool {
        for v in keyViews.allObjects where v.perfSend(k) {
            Haptics.tap()
            return true
        }
        return false
    }
}

// MARK: - Monitor

/// CADisplayLink frame deltas + a main-run-loop observer summing the main thread's
/// awake time, bucketed by step.
final class PerfMonitor: NSObject {
    static let shared = PerfMonitor()

    struct Stat: Codable {
        var name: String
        var frames = 0
        var over25 = 0
        var over50 = 0
        var worstMs = 0.0
        var hitchMs = 0.0
        var busyMs = 0.0
        var durationMs = 0.0
        /// The first frame after the step's action (a new element's first appearance).
        var firstMs = 0.0
    }

    private var link: CADisplayLink?
    private var observer: CFRunLoopObserver?
    private var last: CFTimeInterval = 0
    private(set) var expected: CFTimeInterval = 1.0 / 60
    private var awakeAt: CFTimeInterval = 0
    private var current: Stat?
    private var startedAt: CFTimeInterval = 0
    private(set) var finished: [Stat] = []

    private let signposter = OSSignposter(subsystem: "com.wordocious.perf", category: .pointsOfInterest)
    private var interval: OSSignpostIntervalState?

    func start() {
        guard link == nil else { return }
        let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
        l.add(to: .main, forMode: .common)
        link = l
        let activities = CFRunLoopActivity.afterWaiting.rawValue | CFRunLoopActivity.beforeWaiting.rawValue
        let obs = CFRunLoopObserverCreateWithHandler(nil, activities, true, 0) { [weak self] _, act in
            guard let self else { return }
            let now = CACurrentMediaTime()
            if act == .afterWaiting {
                self.awakeAt = now
            } else if self.awakeAt > 0 {
                if self.current != nil { self.current!.busyMs += (now - self.awakeAt) * 1000 }
                self.awakeAt = 0
            }
        }
        CFRunLoopAddObserver(CFRunLoopGetMain(), obs, .commonModes)
        observer = obs
    }

    @objc private func tick(_ l: CADisplayLink) {
        let nominal = l.targetTimestamp - l.timestamp
        if nominal > 0.004 { expected = nominal }
        defer { last = l.timestamp }
        guard last > 0, current != nil else { return }
        let dt = l.timestamp - last
        let ms = dt * 1000
        current!.frames += 1
        if current!.frames == 1 { current!.firstMs = ms }
        current!.worstMs = max(current!.worstMs, ms)
        if ms > 25 { current!.over25 += 1 }
        if ms > 50 {
            PerfTour.mark("HITCH \(current!.name) \(Int(ms)) end")
            current!.over50 += 1
            signposter.emitEvent("hitch", "\(self.current!.name, privacy: .public) \(Int(ms)) ms")
        }
        if dt > expected * 1.5 { current!.hitchMs += (dt - expected) * 1000 }
    }

    func begin(_ name: String) {
        end()
        let now = CACurrentMediaTime()
        current = Stat(name: name)
        PerfTour.mark("STEP \(name)")
        startedAt = now
        // Busy time of the wake already in progress counts from now.
        if awakeAt > 0 { awakeAt = now }
        interval = signposter.beginInterval("step", "\(name, privacy: .public)")
    }

    func end() {
        guard var s = current else { return }
        let now = CACurrentMediaTime()
        if awakeAt > 0 { s.busyMs += (now - awakeAt) * 1000; awakeAt = now }
        s.durationMs = (now - startedAt) * 1000
        finished.append(s)
        current = nil
        if let i = interval { signposter.endInterval("step", i); interval = nil }
    }

    func reset() { end(); finished = [] }
}

// MARK: - Driving the UI

@MainActor
enum PerfDrive {
    static func sleep(_ s: Double) async { try? await Task.sleep(nanoseconds: UInt64(max(0, s) * 1_000_000_000)) }

    static var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow)
    }

    /// The page's vertical scroll view: the largest visible one in the frontmost
    /// presented screen.
    static func pageScrollView() -> UIScrollView? {
        guard let window = keyWindow else { return nil }
        var top = window.rootViewController
        while let p = top?.presentedViewController, !p.isBeingDismissed { top = p }
        guard let root = top?.view else { return nil }
        var best: (view: UIScrollView, area: CGFloat)?
        func walk(_ v: UIView) {
            if v.isHidden || v.alpha < 0.01 { return }
            if let s = v as? UIScrollView, !(v is UITextView), s.isScrollEnabled,
               s.contentSize.height > s.bounds.height + 40 {
                let r = s.convert(s.bounds, to: window).intersection(window.bounds)
                let area = r.isNull ? 0 : r.width * r.height
                if area > (best?.area ?? 0) { best = (s, area) }
            }
            v.subviews.forEach(walk)
        }
        walk(root)
        return best?.view
    }

    /// Scroll the page to `fraction` (0 = top, 1 = bottom) at ~`speed` pt/s, one
    /// offset per display frame (ease in/out, like a drag + fling). The idle loops
    /// see the same "scrolling" signal a finger gives them.
    static func scroll(to fraction: CGFloat, speed: CGFloat = 1800) async {
        guard let s = pageScrollView() else { return }
        let minY = -s.adjustedContentInset.top
        let maxY = max(minY, s.contentSize.height - s.bounds.height + s.adjustedContentInset.bottom)
        let from = s.contentOffset.y
        let to = minY + (maxY - minY) * fraction
        let distance = abs(to - from)
        guard distance > 1 else { return }
        let duration = max(0.35, Double(distance / speed))
        ScrollMotion.shared.set(true)
        await PerfTicker.run(duration: duration) { t in
            let e = t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2
            s.contentOffset = CGPoint(x: s.contentOffset.x, y: from + (to - from) * CGFloat(e))
        }
        ScrollMotion.shared.set(false)
    }

    static func type(_ word: String, gap: Double = 0.11) async {
        for ch in word {
            PerfTour.key(.letter(String(ch)))
            await sleep(gap)
        }
    }

    static func enter() { PerfTour.key(.enter) }

    /// Close every game / cover / sheet the way the top-left Home button does.
    static func goHome() {
        NotificationCenter.default.post(name: HomeNav.goHome, object: nil)
    }

    /// Open a fresh unlimited board of `dbKey` from the tab root (the post-game
    /// "Keep playing" route — a new seed every run, nothing daily touched).
    static func playUnlimited(_ dbKey: String) {
        NotificationCenter.default.post(name: NextDailyCTA.playUnlimited, object: dbKey)
    }
}

/// Runs a closure once per display frame for `duration` seconds (t in 0...1).
final class PerfTicker: NSObject {
    private var link: CADisplayLink?
    private var start: CFTimeInterval = 0
    private let duration: Double
    private let step: (Double) -> Void
    private var done: CheckedContinuation<Void, Never>?

    private init(duration: Double, step: @escaping (Double) -> Void) {
        self.duration = duration
        self.step = step
    }

    @MainActor
    static func run(duration: Double, _ step: @escaping (Double) -> Void) async {
        let t = PerfTicker(duration: duration, step: step)
        await withCheckedContinuation { c in
            t.done = c
            let l = CADisplayLink(target: t, selector: #selector(PerfTicker.tick(_:)))
            l.add(to: .main, forMode: .common)
            t.link = l
        }
    }

    @objc private func tick(_ l: CADisplayLink) {
        if start == 0 { start = l.timestamp }
        let t = min(1, (l.timestamp - start) / duration)
        step(t)
        if t >= 1 {
            l.invalidate()
            link = nil
            done?.resume()
            done = nil
        }
    }
}

// MARK: - The tour

@MainActor
enum PerfTourDriver {
    private static var only: [String] = (PerfTour.argument("-perfTourOnly") ?? "")
        .split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }

    private static func wanted(_ name: String) -> Bool {
        only.isEmpty || only.contains { name.hasPrefix($0) }
    }

    /// One measured step: `body` runs, then `hold` more seconds are measured, then
    /// an unmeasured `rest` lets the next step start calm.
    private static func step(_ name: String, hold: Double = 0.4, rest: Double = 0.6, always: Bool = false,
                             _ body: () async -> Void = {}) async {
        guard wanted(name) else {
            // A step another selected step depends on (opening its game) still runs, unmeasured.
            if always { await body(); await PerfDrive.sleep(hold + rest) }
            return
        }
        PerfMonitor.shared.begin(name)
        await body()
        await PerfDrive.sleep(hold)
        PerfMonitor.shared.end()
        await PerfDrive.sleep(rest)
    }

    /// Steps that need a game on screen: open it unmeasured, measure, close it.
    private static func game(_ prefix: String, dbKey: String, settle: Double = 2.2,
                             _ body: () async -> Void) async {
        guard only.isEmpty || only.contains(where: { $0.hasPrefix(prefix) || prefix.hasPrefix($0) }) else { return }
        await step("\(prefix).open", hold: settle, rest: 0, always: true) { PerfDrive.playUnlimited(dbKey) }
        await body()
        await step("\(prefix).close", hold: 1.0, always: true) { PerfDrive.goHome() }
    }

    static func run() async {
        let monitor = PerfMonitor.shared
        // Cold start: process launch → the intro lands (LaunchGate), then the
        // deferred startup work that follows the landing.
        while !LaunchGate.isOpen { await PerfDrive.sleep(0.05) }
        // Never build a board before the word lists exist (RootTabView loads them too;
        // this keeps the tour safe even if that ever moves).
        DictionaryLoader.ensureInitialized()
        monitor.begin("launch.settle")
        await PerfDrive.sleep(3.0)
        monitor.end()
        let launch = monitor.finished
        await PerfDrive.sleep(1.0)

        let loops = max(1, Int(PerfTour.argument("-perfTourLoops") ?? "") ?? 1)
        var tables: [[PerfMonitor.Stat]] = []
        for loop in 0..<loops {
            monitor.reset()
            await tour()
            monitor.end()
            tables.append((loop == 0 ? launch.filter { wanted($0.name) } : []) + monitor.finished)
        }
        PerfReport.write(tables, expected: monitor.expected)
        if !ProcessInfo.processInfo.arguments.contains("-perfTourStay") { exit(0) }
    }

    private static func tour() async {
        // MARK: Home
        PerfTour.send(.selectTab(.home))
        await PerfDrive.sleep(0.8)
        await step("home.idle", hold: 2.0)
        await step("home.scrollDown") { await PerfDrive.scroll(to: 1) }
        await step("home.scrollUp") { await PerfDrive.scroll(to: 0) }
        await step("home.switch", hold: 0.8) {
            // The Daily | Unlimited switch (Pro only; a guest's switch stays on Daily).
            let key = "pref-play-mode"
            let now = UserDefaults.standard.string(forKey: key) ?? PlayMode.daily.rawValue
            UserDefaults.standard.set(now == PlayMode.daily.rawValue ? PlayMode.unlimited.rawValue : PlayMode.daily.rawValue, forKey: key)
            await PerfDrive.sleep(0.8)
            UserDefaults.standard.set(PlayMode.daily.rawValue, forKey: key)
        }
        await step("home.flingMid") {
            await PerfDrive.scroll(to: 0.5, speed: 2600)
            await PerfDrive.scroll(to: 0, speed: 2600)
        }

        // MARK: Tabs
        await step("tabs.toLeaderboard", hold: 1.2) { PerfTour.send(.selectTab(.leaderboard)) }
        await step("leaderboard.scroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("leaderboard.picker", hold: 0.8) {
            // The same note the post-game "Leaderboard" CTA posts (preselects the mode).
            for key in ["QUORDLE", "OCTORDLE", "GAUNTLET", "DUEL"] {
                NotificationCenter.default.post(name: NextDailyCTA.openLeaderboard, object: key)
                await PerfDrive.sleep(0.7)
            }
        }
        await step("tabs.toStats", hold: 1.5) { PerfTour.send(.selectTab(.stats)) }
        await step("stats.scroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("tabs.toFriends", hold: 1.2) { PerfTour.send(.selectTab(.friends)) }
        await step("friends.scroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("tabs.toHome", hold: 1.2) { PerfTour.send(.selectTab(.home)) }

        // MARK: Sheets + popups
        await step("settings.open", hold: 1.2) { PerfTour.send(.sheet(.settings)) }
        await step("settings.scroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("toggle.flips", hold: 0.6) {
            // The candy switches in Settings (Colorblind / Reduced Motion), flipped and flipped back.
            let tm = ThemeManager.shared
            await PerfDrive.scroll(to: 0.45)
            for _ in 0..<2 { tm.colorblind.toggle(); await PerfDrive.sleep(0.6) }
            for _ in 0..<2 { tm.reducedMotion.toggle(); await PerfDrive.sleep(0.6) }
        }
        await step("settings.close", hold: 0.9) { PerfTour.send(.sheet(nil)) }

        // MARK: Season preview (Halloween on vs off), Home scroll
        await step("season.on", hold: 1.2) {
            UserDefaults.standard.set("halloween", forKey: CastSkin.debugKey); CastSkin.invalidate()
        }
        await step("season.homeScrollDown") { await PerfDrive.scroll(to: 1) }
        await step("season.homeScrollUp") { await PerfDrive.scroll(to: 0) }
        await step("season.toLeaderboard", hold: 1.2) { PerfTour.send(.selectTab(.leaderboard)) }
        await step("season.leaderboardScroll") { await PerfDrive.scroll(to: 1); await PerfDrive.scroll(to: 0) }
        await step("season.toHome", hold: 1.2) { PerfTour.send(.selectTab(.home)) }
        await step("season.off", hold: 1.2) {
            UserDefaults.standard.removeObject(forKey: CastSkin.debugKey); CastSkin.invalidate()
        }

        // MARK: Dress-up (the Stage, the Dressing Room, the Title Shelves; signed-in only: `--demo`)
        if AuthService.shared.profile != nil, !AuthService.shared.isGuest {
            await step("dress.stageOpen", hold: 1.4) { DressUp.shared.open() }
            await step("dress.stageClose", hold: 1.0) { DressUp.shared.request = nil }
            await step("dress.roomOpen", hold: 1.4) { DressUp.shared.open(.room(.body)) }
            await step("dress.roomTabs", hold: 0.6) {
                for t in [MascotBuilderTab.color, .eyes, .hats, .extras, .backdrop, .frame, .body] {
                    PerfTour.send(.builderTab(t)); await PerfDrive.sleep(0.55)
                }
            }
            await step("dress.hop", hold: 0.8) {
                for _ in 0..<3 { PerfTour.send(.builderHop); await PerfDrive.sleep(0.7) }
            }
            await step("dress.roomClose", hold: 1.0) { DressUp.shared.request = nil }
            await step("dress.titlesOpen", hold: 1.4) { DressUp.shared.open(.titles) }
            await step("dress.titlesScroll") { await PerfDrive.scroll(to: 1); await PerfDrive.scroll(to: 0) }
            await step("dress.titlesClose", hold: 1.0) { DressUp.shared.request = nil }
        }
        await step("help.open", hold: 1.2) { PerfTour.send(.sheet(.help)) }
        await step("help.close", hold: 0.9) { PerfTour.send(.sheet(nil)) }
        await step("popup.open", hold: 1.2) { HeaderPopups.shared.toggle(.flawless) }
        await step("popup.close", hold: 0.9) { HeaderPopups.shared.close() }
        await step("wotd.open", hold: 1.5) { PerfTour.send(.sheet(.words)) }
        await step("wotd.scroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("wotd.word", hold: 1.2) { PerfTour.send(.wordDetail(0)) }
        await step("wotd.close", hold: 0.9) { PerfTour.send(.sheet(nil)) }
        await step("strategy.open", hold: 1.5) { PerfTour.send(.sheet(.strategy)) }
        await step("strategy.scroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("strategy.article", hold: 1.2) { PerfTour.send(.strategyArticle(0)) }
        await step("strategy.articleScroll") {
            await PerfDrive.scroll(to: 1)
            await PerfDrive.scroll(to: 0)
        }
        await step("strategy.close", hold: 0.9) { PerfTour.send(.sheet(nil)) }

        // MARK: Word games
        await game("classic", dbKey: "DUEL") {
            await step("classic.type", hold: 0.3) { await PerfDrive.type("CRANE") }
            await step("classic.submit", hold: 2.0) { PerfDrive.enter() }
            await step("classic.type2", hold: 0.3) { await PerfDrive.type("SLOTH") }
            await step("classic.submit2", hold: 2.0) { PerfDrive.enter() }
            await step("classic.reject", hold: 1.0) {
                await PerfDrive.type("QZXQZ", gap: 0.08)
                PerfDrive.enter()
                await PerfDrive.sleep(0.6)
                for _ in 0..<5 { PerfTour.key(.delete); await PerfDrive.sleep(0.08) }
            }
            await step("classic.finish", hold: 6.0) {
                // Win: the reveal, the win card, then the finished screen built under it.
                if let a = PerfTour.game?.boards.first?.solution.uppercased() { await PerfDrive.type(a); PerfDrive.enter() }
            }
        }
        await game("quad", dbKey: "QUORDLE") {
            await step("quad.type", hold: 0.3) { await PerfDrive.type("CRANE") }
            await step("quad.submit", hold: 2.0) { PerfDrive.enter() }
            await step("quad.type2", hold: 0.3) { await PerfDrive.type("SLOTH") }
            await step("quad.submit2", hold: 2.0) { PerfDrive.enter() }
        }
        await game("octo", dbKey: "OCTORDLE") {
            await step("octo.type", hold: 0.3) { await PerfDrive.type("CRANE") }
            await step("octo.submit", hold: 2.0) { PerfDrive.enter() }
            await step("octo.type2", hold: 0.3) { await PerfDrive.type("SLOTH") }
            await step("octo.submit2", hold: 2.0) { PerfDrive.enter() }
            // BJ14: the founder's zoom — tap a (partly filled) mini board, type in the
            // zoomed board, back out.
            let zoomHold = PerfTour.flag("slowZoom") ? 6.0 : 0.9
            await step("octo.zoomIn", hold: zoomHold) { PerfTour.send(.zoomBoard(2)) }
            await step("octo.zoomType", hold: 0.3) {
                await PerfDrive.type("ST")
                await PerfDrive.sleep(PerfTour.flag("slowZoom") ? 3 : 0)
                _ = PerfTour.key(.delete); await PerfDrive.sleep(0.11); _ = PerfTour.key(.delete)
            }
            await step("octo.zoomOut", hold: zoomHold) { PerfTour.send(.zoomBoard(nil)) }
            // Solve every board: the win card, then (BJ2) the finished screen built under it.
            let answers = PerfTour.game?.boards.filter { $0.status == .playing }.map { $0.solution.uppercased() } ?? []
            await step("octo.solve", hold: 0.5) {
                for a in answers.dropLast() { await PerfDrive.type(a, gap: 0.08); PerfDrive.enter(); await PerfDrive.sleep(0.9) }
            }
            await step("octo.finish", hold: 6.0) {
                if let last = answers.last { await PerfDrive.type(last, gap: 0.08); PerfDrive.enter() }
            }
        }
        await game("gauntlet", dbKey: "GAUNTLET") {
            await step("gauntlet.type", hold: 0.3) { await PerfDrive.type("CRANE") }
            await step("gauntlet.submit", hold: 1.8) { PerfDrive.enter() }
            // Solve stage 1 → the stage card.
            await step("gauntlet.stageCard", hold: 4.0) {
                if let answer = PerfTour.game?.boards.first(where: { $0.status == .playing })?.solution {
                    await PerfDrive.type(answer.uppercased())
                    PerfDrive.enter()
                }
            }
        }

        // MARK: Puzzles
        await game("hubbub", dbKey: "HUB") {
            await step("hubbub.taps", hold: 0.6) {
                // Every letter is offered; only the puzzle's seven type (the hub's own rule).
                var typed = 0
                for ch in "ETAOINSRHLDCUMPGBYFWKVXZJQ" where typed < 6 {
                    if PerfTour.key(.letter(String(ch))) { typed += 1; await PerfDrive.sleep(0.12) }
                }
                PerfDrive.enter()
                await PerfDrive.sleep(0.5)
                PerfTour.key(.space)   // shuffle
                await PerfDrive.sleep(0.5)
                for _ in 0..<6 { PerfTour.key(.delete); await PerfDrive.sleep(0.08) }
            }
        }
        await game("sudocious", dbKey: "SUDOKU") {
            await step("sudocious.taps", hold: 0.6) {
                PerfTour.key(.right)
                for i in 0..<14 {
                    PerfTour.key(i % 3 == 2 ? .down : .right)
                    await PerfDrive.sleep(0.09)
                    PerfTour.key(.digit(i % 9 + 1))
                    await PerfDrive.sleep(0.14)
                }
            }
        }
        await game("muddle", dbKey: "SCRAMBLE") {
            await step("muddle.type", hold: 0.6) {
                await PerfDrive.type("STARE")
                PerfDrive.enter()
                await PerfDrive.sleep(0.5)
                await PerfDrive.type("PLANT")
            }
        }
        await game("crossword", dbKey: "CROSSWORD") {
            await step("crossword.type", hold: 0.6) {
                await PerfDrive.type("STARELINE")
                PerfDrive.enter()
                await PerfDrive.sleep(0.3)
                await PerfDrive.type("ROUTE")
            }
        }

        await game("noundle", dbKey: "PROPERNOUNDLE") {
            await step("noundle.clueOpen", hold: 1.6) { PerfTour.send(.noundleClue(true)) }
            await step("noundle.clueClose", hold: 0.9) { PerfTour.send(.noundleClue(false)) }
            await step("noundle.clueReopen", hold: 0.9) { PerfTour.send(.noundleClue(true)) }
            await step("noundle.clueClose2", hold: 0.9) { PerfTour.send(.noundleClue(false)) }
        }

        // MARK: VS + pocket games
        if wanted("vs") {
            await step("vs.botStart", hold: 5.0) { PerfTour.send(.cover(.vsBot)) }
            await step("vs.type", hold: 2.0) {
                await PerfDrive.type("CRANE")
                PerfDrive.enter()
            }
            await step("vs.close", hold: 1.0) { PerfTour.send(.cover(nil)) }
        }
        await step("pocket.open", hold: 1.2) { PerfTour.send(.sheet(.quickPlay)) }
        await step("pocket.close", hold: 0.9) { PerfTour.send(.sheet(nil)) }
    }
}

// MARK: - Report

@MainActor
enum PerfReport {
    static func write(_ tables: [[PerfMonitor.Stat]], expected: CFTimeInterval) {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd_HHmmss"
        let stamp = fmt.string(from: Date())
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"
        let device = UIDevice.current.name
        var md = "# Perf tour \(stamp)\n\nbuild \(build) · \(device) · display \(Int((1 / expected).rounded())) Hz"
        md += " · guest \(AuthService.shared.isGuest)\n"
        for (i, rows) in tables.enumerated() {
            md += "\n## Loop \(i + 1)\n\n"
            md += "| step | s | frames | >25ms | >50ms | worst ms | first ms | hitch ms/s | main busy % |\n"
            md += "|---|---:|---:|---:|---:|---:|---:|---:|---:|\n"
            for r in rows { md += line(r) }
            var total = PerfMonitor.Stat(name: "TOTAL")
            for r in rows {
                total.frames += r.frames; total.over25 += r.over25; total.over50 += r.over50
                total.worstMs = max(total.worstMs, r.worstMs); total.hitchMs += r.hitchMs
                total.busyMs += r.busyMs; total.durationMs += r.durationMs
            }
            md += line(total)
        }
        let fm = FileManager.default
        let dir = fm.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("perf", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent("perf-tour-\(stamp).md")
        try? md.write(to: file, atomically: true, encoding: .utf8)
        try? md.write(to: dir.appendingPathComponent("perf-tour-latest.md"), atomically: true, encoding: .utf8)
        if let json = try? JSONEncoder().encode(tables) {
            try? json.write(to: dir.appendingPathComponent("perf-tour-latest.json"))
        }
        // `-perfTourOut <host path>`: the simulator app can write the host's disk, so the
        // runner gets the report even if the shared simulator reinstalls the app after.
        if let out = PerfTour.argument("-perfTourOut") {
            try? md.write(toFile: out, atomically: true, encoding: .utf8)
            if let json = try? JSONEncoder().encode(tables) {
                try? json.write(to: URL(fileURLWithPath: (out as NSString).deletingPathExtension + ".json"))
            }
        }
        for l in md.split(separator: "\n") { print("PERFTOUR|\(l)") }
        print("PERFTOUR|DONE \(file.path)")
        fflush(stdout)
    }

    private static func line(_ r: PerfMonitor.Stat) -> String {
        let s = r.durationMs / 1000
        let ratio = s > 0 ? r.hitchMs / s : 0
        let busy = r.durationMs > 0 ? r.busyMs / r.durationMs * 100 : 0
        return String(format: "| %@ | %.1f | %d | %d | %d | %.0f | %.0f | %.1f | %.0f |\n",
                      r.name, s, r.frames, r.over25, r.over50, r.worstMs, r.firstMs, ratio, busy)
    }
}

// MARK: - The tour's presenter (sheets, the VS bot cover, tab selection)

/// Lives behind RootTabView (DEBUG only); idle unless `-perfTour`.
struct PerfTourHost: View {
    let selectTab: (AppTab) -> Void
    @State private var sheet: PerfTour.Sheet?
    @State private var cover: PerfTour.Cover?
    @State private var helpSelection: InfoMenuDestination?

    var body: some View {
        if PerfTour.requested || StoreDemo.active {
            Color.clear
                .onReceive(PerfTour.commands) { c in
                    switch c {
                    case .selectTab(let t): selectTab(t)
                    case .sheet(let s): sheet = s
                    case .cover(let v): cover = v
                    default: break
                    }
                }
                .sheet(item: $sheet) { s in
                    switch s {
                    case .settings: SettingsView()
                    case .help: MenuSheet(selection: $helpSelection).presentationDetents([.large])
                    case .strategy: StrategyView().presentationDetents([.large])
                    case .words: WordsView(navTitle: "Word of the Day").presentationDetents([.large])
                    case .quickPlay:
                        FriendsQuickPlaySheet(friend: nil, kind: .ttt, onStarted: { _ in }, onVSBattle: { _ in }, onRaceMyRun: { _ in })
                    }
                }
                .fullScreenCover(item: $cover) { _ in
                    NavigationStack { VSGameView(mode: .duel, intent: .bot(.opal)) }
                }
        }
    }
}

extension View {
    /// DEBUG: run `handler` for tour commands (idle unless `-perfTour`).
    func onPerfTour(_ handler: @escaping (PerfTour.Command) -> Void) -> some View {
        onReceive(PerfTour.commands) { handler($0) }
    }
}
#endif
