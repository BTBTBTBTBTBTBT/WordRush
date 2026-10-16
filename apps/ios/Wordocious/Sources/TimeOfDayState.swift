import SwiftUI
import WordociousCore

/// Time of day, app-wide (founder 10-16, docs/design/brand/seasons/time-of-day/NOTES.md v2). While a season shows, its walls,
/// Home stage and window surfaces follow the device's LOCAL clock in four slots (core `TimeOfDay`). ONE state, ONE timer:
///
/// - The slot the UI draws is `appliedSlot` (what `SeasonKit.wall / stage / surfaces` read). It is the admin override
///   (`debug-tod` = auto | morning | day | evening | night; launch arg `-debug-tod day`) else the clock's slot.
/// - A boundary is armed as a single `Timer` at core `TimeOfDay.nextChange` (no polling), and the clock is re-read when the
///   app returns to the foreground.
/// - Applying a new slot recolors the whole tree (the palette tokens are read at render time, like a season pick), so it
///   goes through the root rebuild (`ThemeManager.seasonEpoch` -> `.id`) inside `withAnimation(0.6 s)`: SwiftUI cross-dissolves
///   the old tree into the new one (walls, stage and window colors together). Reduce Motion = an instant swap. A rebuild
///   resets navigation, so an AUTO change waits until nothing immersive is up (no game, no sheet or cover): it is applied at
///   the next safe check (a short retry while pending, the foreground re-read). The admin override applies at once.
/// - The NEXT slot's walls + stage are decoded off the main thread before the boundary so the dissolve never stalls.
final class TimeOfDayState: ObservableObject {
    static let shared = TimeOfDayState()

    /// UserDefaults key of the admin override: auto | morning | day | evening | night (absent = auto).
    static let debugKey = "debug-tod"

    /// The slot the UI is drawing (published for views that want to react; the thread-safe mirror below is what SeasonKit reads).
    @Published private(set) var slot: TimeOfDay

    private static let lock = NSLock()
    private static var applied: TimeOfDay = TimeOfDayState.resolve(Date())

    /// The slot the season art + surfaces are drawn at right now (safe from any thread).
    static var appliedSlot: TimeOfDay { lock.lock(); defer { lock.unlock() }; return applied }

    /// The override, else the clock.
    static func resolve(_ now: Date) -> TimeOfDay {
        if let o = override { return o }
        return TimeOfDay.at(now)
    }

    /// The admin override (nil = auto).
    static var override: TimeOfDay? {
        UserDefaults.standard.string(forKey: debugKey).flatMap { TimeOfDay(rawValue: $0) }
    }

    private var timer: Timer?
    private var retry: Timer?
    private var pending = false

    private init() { slot = Self.appliedSlot }

    // MARK: Lifecycle

    /// App launch: arm the boundary timer (only while a season shows).
    func start() {
        arm()
    }

    /// App foreground (scenePhase .active): re-read the clock, apply if it moved and it is safe, re-arm.
    func foreground() {
        reread(animated: false)
        arm()
    }

    /// The admin picker: write the override and apply at once (the root rebuild, like a season pick).
    func setOverride(_ choice: String) {
        if choice == "auto" { UserDefaults.standard.removeObject(forKey: Self.debugKey) }
        else { UserDefaults.standard.set(choice, forKey: Self.debugKey) }
        pending = false
        apply(Self.resolve(Date()), force: true)
        arm()
    }

    // MARK: Boundary

    private var seasonShowing: Bool { SeasonKit.current != nil }

    /// One timer at the next local boundary (+ a second of slack), plus the prewarm of that slot's art. Nothing out of season.
    private func arm() {
        timer?.invalidate(); timer = nil
        guard seasonShowing, Self.override == nil else { return }
        let now = Date()
        let at = TimeOfDay.nextChange(after: now)
        let next = TimeOfDay.at(at.addingTimeInterval(1))
        prewarm(next)
        let t = Timer(fire: at.addingTimeInterval(0.5), interval: 0, repeats: false) { [weak self] _ in
            self?.boundary()
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func boundary() {
        reread(animated: true)
        arm()
    }

    private func reread(animated: Bool) {
        let target = Self.resolve(Date())
        guard target != Self.appliedSlot else { pending = false; return }
        // Out of season nothing is drawn from the slot: track it silently (a later season start reads the right one).
        guard seasonShowing else { setApplied(target); return }
        if safeToRebuild() { pending = false; apply(target, force: false) }
        else { pending = true; scheduleRetry() }
    }

    /// Nothing immersive is up: no game / pushed immersive screen, no sheet or cover on top.
    private func safeToRebuild() -> Bool {
        !ChromeVisibility.shared.bottomNavHidden && !ChromeVisibility.inModalPresentation()
    }

    /// A pending (deferred) auto change re-checks every 20 s until it lands; it never runs otherwise.
    private func scheduleRetry() {
        guard retry == nil else { return }
        let t = Timer(timeInterval: 20, repeats: true) { [weak self] _ in
            guard let self else { return }
            guard self.pending else { self.retry?.invalidate(); self.retry = nil; return }
            self.reread(animated: true)
            if !self.pending { self.retry?.invalidate(); self.retry = nil }
        }
        RunLoop.main.add(t, forMode: .common)
        retry = t
    }

    private func setApplied(_ s: TimeOfDay) {
        Self.lock.lock(); Self.applied = s; Self.lock.unlock()
        slot = s
    }

    /// Switch the drawn slot and recolor the tree (cross-dissolved unless Reduce Motion).
    private func apply(_ s: TimeOfDay, force: Bool) {
        guard force || s != Self.appliedSlot else { return }
        setApplied(s)
        guard seasonShowing else { return }
        let bump = { ThemeManager.shared.seasonEpoch += 1 }
        if !Theme.reduceMotion { withAnimation(.easeInOut(duration: TimeOfDay.fadeSeconds), bump) } else { bump() }
    }

    // MARK: Prewarm

    /// Decode the next slot's walls + stage off the main thread so the dissolve has its pixels (one at a time, nothing kept).
    private func prewarm(_ next: TimeOfDay) {
        guard let entry = SeasonKit.current else { return }
        var names: [String] = []
        for key in (entry.slots.walls ?? [:]).keys where !key.hasSuffix("*") {
            if let n = SeasonKit.wall(key, dark: true, slot: next) { names.append(n) }
        }
        if let s = SeasonKit.stage(slot: next) { names.append(s) }
        names.append(SeasonKit.podiumStage(slot: next))
        let unique = Array(Set(names)).sorted()
        guard !unique.isEmpty else { return }
        Task.detached(priority: .utility) {
            for n in unique {
                autoreleasepool {
                    if let img = UIImage(named: n) { _ = img.preparingForDisplay() }
                }
                try? await Task.sleep(nanoseconds: 150_000_000)
            }
        }
    }
}

/// Palette roles for the quiet surfaces (chips, pills, key faces, toasts, option tiles): the season's `raised` at the current
/// time when a season shows, else the caller's own normal-look color.
enum SeasonSurface {
    /// The season's `raised` (nil out of season / no raised).
    static var raised: Color? { SeasonKit.surfaces?.raised }
    /// `raised` darker-edge twin for a key's bottom edge (the raised color mixed toward black).
    /// 10-16: the ON-WALL chrome ink (stats-row digits, labels sitting on the bare wall) - dark when this time's wall is light
    /// (`tod.<t>.tone == "light"`), else `normal` (nil = the control's own ink).
    static func wallInk(_ normal: Color? = nil) -> Color? {
        SeasonKit.surfaces?.wallInkDark == true ? Color(hex: 0x1B1230) : normal
    }
    static var raisedEdge: Color? { raised.map { Color.black.mixed(over: $0, 0.35) } }
}
