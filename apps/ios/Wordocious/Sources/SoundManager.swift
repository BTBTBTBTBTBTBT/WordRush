import AVFoundation
import SwiftUI
import UIKit

// FINISH_SPEC §U — sound + haptics.
//
// `SoundManager` is THE sound service: the 16-sound pack
// (Resources/Sounds/sfx-<name>.m4a, docs/design/brand/sounds/make-sounds.py) is
// decoded once into PCM buffers and played through a small AVAudioEngine voice
// pool (each voice = player node → varispeed, so `tap` can wobble its pitch ±3%).
// The session is `.ambient` + `.mixWithOthers`: the ring/mute switch silences it
// and the user's music keeps playing. Master volume 0.6. Gated by `pref-sound`
// (default on; Sound off mutes everything). Reduce Motion never mutes sound.
//
// `Haptics` is the haptic service, gated by `pref-haptics` (default on).
// `Feedback` is the spec's event map (sound · haptic) — prefer it at call sites.

final class SoundManager {
    /// The sound pack (file `sfx-<rawValue>.m4a`): the 16 sounds + the founder's Sound Lab
    /// picks (docs/design/brand/sounds/make-sounds.py PICKS).
    enum Effect: String, CaseIterable {
        case tap, delete, flip, press, release, hop, invalid, win, lose
        case celebrate, streak, tick, notify, unlock, vs, whoosh
        /// The cold-start intro jingle (pick: "Marimba Parade"), ≈ 3 s.
        case intro
        /// Classic's own picks (Sound Lab "Classic" rows): played instead of the pack sound while
        /// the Classic game screen is up (`classicSounds()`); every other game keeps the pack's.
        case classicInvalid = "classic-invalid"
        case classicStreak = "classic-streak"
        case classicLose = "classic-lose"
        case classicWin = "classic-win"

        /// Classic's version of this pack sound, if it has one.
        var classic: Effect? {
            switch self {
            case .invalid: return .classicInvalid
            case .streak: return .classicStreak
            case .lose: return .classicLose
            case .win: return .classicWin
            default: return nil
            }
        }

        /// The player's level going up (pick: "Rising Stairs").
        case levelup
        /// A game opening (pick: "Page Breeze").
        case open
        /// Hubbub pangram (all seven letters): a 1-up (Johnny 10-05; pick: "Triple Coin Climb").
        case pangram
        /// Each header hero's giggle (pick: "Giggles"), file `sfx-laugh-<id>.m4a`.
        case laughW = "laugh-w", laughO1 = "laugh-o1", laughR = "laugh-r", laughD = "laugh-d", laughO2 = "laugh-o2"
        case laughC = "laugh-c", laughI = "laugh-i", laughO3 = "laugh-o3", laughU = "laugh-u", laughS = "laugh-s"

        /// A header hero's giggle (`id` = MascotID raw value), nil for an unknown id.
        static func laugh(_ id: String) -> Effect? {
            guard let e = Effect(rawValue: "laugh-\(id)"), e.isLaugh else { return nil }
            return e
        }
        var isLaugh: Bool { rawValue.hasPrefix("laugh-") }

        /// Per-sound gain under the master volume (the tiny UI sounds sit lower).
        var gain: Float {
            switch self {
            case .tap: return 0.8
            case .delete: return 0.8
            case .flip: return 0.75
            case .press: return 0.55
            case .release: return 0.45
            case .tick: return 0.55
            case .hop: return 0.6
            case .whoosh: return 0.6
            default: return 1
            }
        }

        /// The shortest gap between two plays of this sound (multi-board flips land
        /// together; the count-up tick is capped at 12/s; jingles never stack).
        var minGap: TimeInterval {
            switch self {
            case .tap, .delete: return 0.02
            case .flip: return 0.045
            case .press, .release: return 0.06
            case .tick: return 1.0 / 12
            case .hop: return 0.12
            case .whoosh: return 0.2
            case .invalid, .classicInvalid: return 0.2
            case .notify: return 0.25
            case .intro: return 5
            // One hero's giggle: longer than the longest giggle, so taps never machine-gun it.
            case _ where isLaugh: return 0.7
            default: return 0.5
            }
        }
    }

    static let shared = SoundManager()
    static let masterVolume: Float = 0.6

    /// `pref-sound`, default ON unless the user explicitly turned it off.
    static var enabled: Bool {
        UserDefaults.standard.object(forKey: "pref-sound") == nil
            ? true
            : UserDefaults.standard.bool(forKey: "pref-sound")
    }

    private final class Voice {
        let node = AVAudioPlayerNode()
        let pitch = AVAudioUnitVarispeed()
        var busyUntil: TimeInterval = 0
    }

    /// All engine work happens on this queue (never the main thread).
    private let queue = DispatchQueue(label: "com.wordocious.sound", qos: .userInitiated)
    private let engine = AVAudioEngine()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    private var voices: [Voice] = []
    private var buffers: [Effect: AVAudioPCMBuffer] = [:]
    private var lastPlayed: [Effect: TimeInterval] = [:]
    private var sessionReady = false
    private static let voiceCount = 6

    private init() {
        queue.async { self.setUp() }
        // Let the engine go while backgrounded; the next play restarts it.
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification,
                                               object: nil, queue: nil) { [weak self] _ in
            self?.queue.async { self?.engine.pause() }
        }
    }

    /// Touch at launch so the 16 sounds decode before the first key press.
    func preload() {}

    // MARK: Playing

    /// >0 while the Classic game screen is up (main thread).
    static var classicDepth = 0

    /// Play one sound from the pack (no-op when Sound is off). Inside Classic, its own picks.
    func play(_ requested: Effect, volume: Float = 1) {
        guard Self.enabled else { return }
        let effect = Self.classicDepth > 0 ? (requested.classic ?? requested) : requested
        let now = ProcessInfo.processInfo.systemUptime
        queue.async { self.fire(effect, at: now, volume: volume) }
    }

    // Legacy names (callers keep compiling) mapped onto the new pack.
    /// Key press: `tap`, its pitch varied ±3% per press.
    func playKeyTap() { play(.tap) }
    /// Backspace / delete.
    func playDelete() { play(.delete) }
    /// The match-intro splash stinger.
    func playVsStinger() { play(.vs) }
    /// The opponent landing a guess row (a soft tile flip).
    func playOpponentThunk() { play(.flip, volume: 0.8) }
    /// Not a word / a wrong move.
    func playInvalid() { play(.invalid) }
    /// The win popup.
    func playSuccess() { play(.win) }
    /// The loss popup.
    func playGameOver() { play(.lose) }
    /// A partial success mid-game (a found word, a solved group / board / stage —
    /// never the finish): `notify` at 0.7. Partial successes never play `win`.
    func playFound() { play(.notify, volume: 0.7) }
    /// A Hubbub pangram: the 1-up instead of the found-word sound.
    func playPangram() { play(.pangram) }

    /// The intro jingle's own length: the cast hops it covers stay quiet meanwhile.
    private static let introQuiet: TimeInterval = 3.0

    private func fire(_ e: Effect, at now: TimeInterval, volume: Float) {
        if let last = lastPlayed[e], now - last < e.minGap { return }
        // The intro jingle owns the cold start: its landing "ta-da" replaces the landing hops.
        if e == .hop || e == .open, let intro = lastPlayed[.intro], now - intro < Self.introQuiet { return }
        guard let buf = buffers[e], startIfNeeded() else { return }
        lastPlayed[e] = now
        let v = voices.first(where: { $0.busyUntil <= now }) ?? voices.min(by: { $0.busyUntil < $1.busyUntil })!
        let rate: Float = e == .tap ? Float.random(in: 0.97...1.03) : 1
        v.pitch.rate = rate
        v.node.volume = min(1, e.gain * volume)
        v.busyUntil = now + Double(buf.frameLength) / format.sampleRate / Double(rate)
        v.node.scheduleBuffer(buf, at: nil, options: .interrupts, completionHandler: nil)
        if !v.node.isPlaying { v.node.play() }
        #if DEBUG
        playCount[e, default: 0] += 1
        NSLog("[sfx] %@ %d", e.rawValue, playCount[e] ?? 0)
        #endif
    }
    #if DEBUG
    /// DEBUG verification aid: how many times each sound actually started.
    private var playCount: [Effect: Int] = [:]
    #endif

    // MARK: Setup

    private func setUp() {
        for e in Effect.allCases {
            if let url = Self.url(for: e), let buf = load(url) { buffers[e] = buf }
        }
        for _ in 0..<Self.voiceCount {
            let v = Voice()
            engine.attach(v.node)
            engine.attach(v.pitch)
            engine.connect(v.node, to: v.pitch, format: format)
            engine.connect(v.pitch, to: engine.mainMixerNode, format: format)
            voices.append(v)
        }
        engine.mainMixerNode.outputVolume = Self.masterVolume
        engine.prepare()
    }

    /// Start the session + engine on first use (and after an interruption, a route
    /// change or the app coming back — the engine stops itself in those cases).
    private func startIfNeeded() -> Bool {
        if engine.isRunning { return true }
        guard !voices.isEmpty else { return false }
        do {
            let session = AVAudioSession.sharedInstance()
            if !sessionReady {
                try session.setCategory(.ambient, options: [.mixWithOthers])
                sessionReady = true
            }
            try session.setActive(true)
            try engine.start()
            return true
        } catch {
            return false
        }
    }

    private static func url(for e: Effect) -> URL? {
        let name = "sfx-\(e.rawValue)"
        return Bundle.main.url(forResource: name, withExtension: "m4a")
            ?? Bundle.main.url(forResource: name, withExtension: "m4a", subdirectory: "Sounds")
    }

    /// Decode a file into a buffer in the engine's format (converting if needed).
    private func load(_ url: URL) -> AVAudioPCMBuffer? {
        guard let file = try? AVAudioFile(forReading: url) else { return nil }
        let src = file.processingFormat
        guard let raw = AVAudioPCMBuffer(pcmFormat: src, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: raw)) != nil else { return nil }
        if src.sampleRate == format.sampleRate && src.channelCount == format.channelCount
            && src.commonFormat == format.commonFormat && src.isInterleaved == format.isInterleaved {
            return raw
        }
        guard let conv = AVAudioConverter(from: src, to: format) else { return nil }
        let cap = AVAudioFrameCount(Double(raw.frameLength) * format.sampleRate / src.sampleRate) + 1024
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: cap) else { return nil }
        var fed = false
        var err: NSError?
        _ = conv.convert(to: out, error: &err) { _, status in
            if fed { status.pointee = .endOfStream; return nil }
            fed = true
            status.pointee = .haveData
            return raw
        }
        return err == nil && out.frameLength > 0 ? out : nil
    }
}

// MARK: - Haptics

/// Native haptics — gated by the Settings "Haptics" toggle (`pref-haptics`,
/// default on); no-ops cleanly off-device. Safe to call from any thread.
enum Haptics {
    /// `pref-haptics`, default ON unless the user explicitly turned it off.
    static var enabled: Bool {
        UserDefaults.standard.object(forKey: "pref-haptics") == nil
            ? true
            : UserDefaults.standard.bool(forKey: "pref-haptics")
    }

    /// Light impact (key press, delete, row land, notices).
    static func tap() { light() }
    static func light() { impact(.light) }
    static func medium() { impact(.medium) }
    static func heavy() { impact(.heavy) }
    /// The candy / squish press.
    static func soft() { impact(.soft) }

    /// A selection tick (each tile of a reveal).
    static func selection() {
        run { selectionGen.selectionChanged(); selectionGen.prepare() }
    }

    static func success() { notify(.success) }
    static func error() { notify(.error) }
    static func warning() { notify(.warning) }

    /// Sweep / Flawless / Gauntlet champion / ladder cleared: success, then a heavy thump.
    static func celebrate() {
        success()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) { heavy() }
    }

    // FINISH_SPEC §AQ1: one long-lived, prepared generator per style (a fresh
    // generator per key press spun the Taptic Engine up cold every tap — extra main-
    // thread work and a late buzz when typing fast).
    private static var impactGens: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
    private static let selectionGen = UISelectionFeedbackGenerator()
    private static let notifyGen = UINotificationFeedbackGenerator()

    private static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        run {
            let g = impactGens[style] ?? UIImpactFeedbackGenerator(style: style)
            impactGens[style] = g
            g.impactOccurred()
            g.prepare()
        }
    }

    private static func notify(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        run { notifyGen.notificationOccurred(type); notifyGen.prepare() }
    }

    private static func run(_ body: @escaping () -> Void) {
        guard enabled else { return }
        if Thread.isMainThread { body() } else { DispatchQueue.main.async(execute: body) }
    }
}

// MARK: - The event map (FINISH_SPEC §U)

/// One call per moment: the spec's sound · haptic pair, deduped so moments that
/// fire together (multi-board flips, the notice + the Friends badge) land once.
enum Feedback {
    private static var last: [String: TimeInterval] = [:]
    private static let lock = NSLock()

    /// True when `key` hasn't fired within `gap` seconds (and marks it fired).
    private static func once(_ key: String, _ gap: TimeInterval) -> Bool {
        let now = ProcessInfo.processInfo.systemUptime
        lock.lock(); defer { lock.unlock() }
        if let t = last[key], now - t < gap { return false }
        last[key] = now
        return true
    }

    /// Key press: tap · light.
    static func keyTap() { SoundManager.shared.playKeyTap(); Haptics.light() }
    /// Delete / backspace: delete · light.
    static func delete() { SoundManager.shared.playDelete(); Haptics.light() }
    /// Each tile of a reveal: flip · selection.
    static func flip() {
        guard once("flip", 0.045) else { return }
        SoundManager.shared.play(.flip); Haptics.selection()
    }
    /// The correct row lands: — · light.
    static func rowLand() { if once("rowLand", 0.3) { Haptics.light() } }
    /// Not a word: invalid · warning.
    static func notAWord() {
        guard once("invalid", 0.2) else { return }
        SoundManager.shared.playInvalid(); Haptics.warning()
    }

    /// Candy / squish buttons: press · soft on touch-down, release · — on let-go
    /// (only right after a press, so a cancelled scroll-touch stays quiet).
    static func press(_ down: Bool) {
        if down {
            guard once("press", 0.06) else { return }
            pressedAt = ProcessInfo.processInfo.systemUptime
            SoundManager.shared.play(.press); Haptics.soft()
        } else {
            guard let t = pressedAt, ProcessInfo.processInfo.systemUptime - t < 1.5 else { return }
            pressedAt = nil
            SoundManager.shared.play(.release)
        }
    }
    private static var pressedAt: TimeInterval?

    /// A partial success (found word, solved group / board / stage): notify @0.7 · light.
    static func found() { SoundManager.shared.playFound(); Haptics.light() }
    /// A cast hop / mascot spring-in: hop · —.
    static func hop(volume: Float = 1) { SoundManager.shared.play(.hop, volume: volume) }
    /// The win popup: win · success.
    static func win() { if once("end", 0.8) { SoundManager.shared.playSuccess(); Haptics.success() } }
    /// The loss popup: lose · soft.
    static func lose() { if once("end", 0.8) { SoundManager.shared.playGameOver(); Haptics.soft() } }
    /// Sweep / Flawless / Gauntlet champion / ladder cleared: celebrate · success+heavy.
    static func celebrate() {
        guard once("celebrate", 1.5) else { return }
        SoundManager.shared.play(.celebrate); Haptics.celebrate()
    }
    /// Streak +1 / shield saved: streak · medium.
    static func streak() {
        guard once("streak", 1.5) else { return }
        SoundManager.shared.play(.streak); Haptics.medium()
    }
    /// The points count-up: tick · — (≤ 12/s).
    static func tick() { SoundManager.shared.play(.tick) }
    /// In-app notice / Friends badge arrival: notify · light.
    static func notify() {
        guard once("notify", 1.0) else { return }
        SoundManager.shared.play(.notify); Haptics.light()
    }
    /// The level goes up (the XP toast's "Level up!", or the tier popup when it crosses a
    /// tier — one jingle per level-up): levelup · success.
    static func levelUp() {
        guard once("levelup", 1.5) else { return }
        SoundManager.shared.play(.levelup); Haptics.success()
    }
    /// Achievement unlock: unlock · success.
    static func unlock() {
        guard once("unlock", 0.8) else { return }
        SoundManager.shared.play(.unlock); Haptics.success()
    }
    /// VS match found / start: vs · medium.
    static func vs() {
        guard once("vs", 0.8) else { return }
        SoundManager.shared.playVsStinger(); Haptics.medium()
    }
    /// A game opens (GameTransition.beginOpen: Home / Puzzles / VS covers): open · —.
    static func gameOpen() { SoundManager.shared.play(.open) }
    /// A popup / sheet opening: whoosh · —.
    static func whoosh() { SoundManager.shared.play(.whoosh) }
}

// MARK: - Streak +1

/// Fires `Feedback.streak()` when the watched daily streak grows by one while the
/// view is alive (after the win jingle has had its moment). Usage:
/// `.streakBumpFeedback(auth.headerStreak)`.
private struct StreakBumpFeedback: ViewModifier {
    let streak: Int?
    @State private var seen: Int?

    func body(content: Content) -> some View {
        content
            .onAppear { if seen == nil { seen = streak } }
            .onChange(of: streak) { new in
                if let new, let old = seen, new == old + 1 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { Feedback.streak() }
                }
                if let new { seen = new }
            }
    }
}

extension View {
    /// Classic's own Sound Lab picks while this view is on screen (SoundManager.Effect.classic).
    func classicSounds(_ on: Bool) -> some View {
        onAppear { if on { SoundManager.classicDepth += 1 } }
            .onDisappear { if on { SoundManager.classicDepth = max(0, SoundManager.classicDepth - 1) } }
    }

    /// FINISH_SPEC §U: streak +1 → streak · medium.
    func streakBumpFeedback(_ streak: Int?) -> some View { modifier(StreakBumpFeedback(streak: streak)) }
}

// MARK: - Sound.castLaugh (2.7.1 cast puppets)

extension SoundManager {
    /// Sound.castLaugh — a header character was tapped and hops + laughs (LivingCastHeader,
    /// the puppet tap and the season costume tap hop): that hero's own giggle (Sound Lab pick
    /// "Giggles"), at most once per 0.7 s per hero (Effect.minGap).
    /// Web: castLaugh() in lib/sounds.ts; Android: SoundManager.castLaugh().
    func castLaugh(_ id: String) {
        guard let e = Effect.laugh(id) else { return }
        play(e)
    }
}
