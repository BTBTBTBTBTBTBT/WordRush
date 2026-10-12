import SwiftUI
import WordociousCore

/// FINISH_SPEC §F2 / §AQ3: the cold-start intro. The static launch screen (Info.plist
/// `UILaunchScreen`: the Home wallpaper color only — no image, so the system never
/// shows a second W of a different size or skin) hands off to this overlay on the
/// same color: the W pops in at the center, glides into the first slot of a centered WORDOCIOUS row
/// while the other nine cast heroes pop in one after another (60 ms apart, spring),
/// then the whole row glides up into the Home header's cast row as the backdrop
/// fades and Home shows underneath. ≤ 1.6 s, tap to skip, cold start only (never on
/// resume / warm start). Reduce Motion: a 200 ms crossfade. Decorative.
struct ColdStartIntroHost: View {
    /// Once per process: a warm start never replays it.
    private static var played = false
    @State private var visible = !ColdStartIntroHost.played

    var body: some View {
        ZStack {
            // FINISH_SPEC §W: first-run onboarding — only once the intro has landed
            // (never under it), only for players who have never played.
            OnboardingHost(introDone: !visible)
            if visible {
                ColdStartIntro { flourish in
                    ColdStartIntroHost.played = true
                    visible = false
                    // §AU5: the deferred startup work runs now — but after the landing flourish (founder 10-12: a
                    // "stutter drop" right after the cast lands; recorded, the hops drew every 3-8 frames while the
                    // auth / network / cache work started in the same frame). The 4.5 s fail-safe still applies.
                    if flourish {
                        DispatchQueue.main.asyncAfter(deadline: .now() + CastMoves.flourishDuration() + 0.1) { LaunchGate.open() }
                    } else {
                        LaunchGate.open()
                    }
                }
                .onAppear {
                    ColdStartIntroHost.played = true
                    CastHandoff.shared.introStarted = true
                }
            }
        }
        .onAppear { if !visible { LaunchGate.open() } }
    }
}

/// FINISH_SPEC §AU5: heavy startup work (network, caches, mascot composition,
/// widget refresh, art prefetch) waits until the cold-start intro has landed, so the
/// intro owns the main thread for its ~1.6 s. Opens at the landing, at once when
/// no intro plays, and by a 3-s fail-safe no matter what.
@MainActor
enum LaunchGate {
    private(set) static var isOpen = false
    private static var waiters: [CheckedContinuation<Void, Never>] = []
    private static var armed = false

    static func open() {
        guard !isOpen else { return }
        isOpen = true
        let ws = waiters
        waiters = []
        ws.forEach { $0.resume() }
    }

    /// Returns once the intro has landed (immediately after that).
    static func wait() async {
        if isOpen { return }
        if !armed {
            armed = true
            // The intro can hold up to 1.5 s on the launch color before its 1.55 s run.
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) { open() }
        }
        await withCheckedContinuation { waiters.append($0) }
    }
}

/// §AU5: every intro image decoded BEFORE the first intro frame (off the main
/// thread), so no figure decodes mid-animation. The plain launch color stays up
/// until they're ready — at most `timeout`.
@MainActor
enum IntroArt {
    private(set) static var images: [MascotID: UIImage] = [:]
    /// The night wall behind an in-season intro, decoded off-main with the figures.
    private(set) static var wall: UIImage?

    /// The wall the intro draws behind the figures (nil = the plain lilac launch color).
    static var wallName: String? {
        guard CastSkin.season != nil, CastSkin.introSeasonOn else { return nil }
        return SeasonKit.wall(PageTint.home.wallpaper, dark: true)
    }

    static func image(_ m: MascotID) -> Image {
        if let ui = images[m] { return Image(uiImage: ui) }
        return Image(CastSkin.introAssetName(for: m))
    }

    static func prepare(timeout: Double) async {
        let wallName = Self.wallName
        // Founder 10-10 (smoothness): the wall decodes here, off the main thread, before the first intro frame.
        let wallDecode = Task.detached(priority: .userInitiated) { () -> UIImage? in
            guard let wallName, let ui = UIImage(named: wallName) else { return nil }
            return ui.preparingForDisplay() ?? ui
        }
        // Founder 10-10 (smoothness, launch): the figures began decoding at launch (LaunchWarm.start), not here.
        let decode = LaunchWarm.figuresTask()
        let timer = Task { try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000)) }
        // Whichever finishes first: the decode, or the launch-color cap.
        let done = await withTaskGroup(of: [(MascotID, UIImage)]?.self) { g -> [(MascotID, UIImage)]? in
            g.addTask { await decode.value }
            g.addTask { await timer.value; return nil }
            let first = await g.next() ?? nil
            timer.cancel()
            return first
        }
        if let done { for (m, ui) in done { images[m] = ui } }
        wall = await wallDecode.value
    }
}

/// Perf audit (founder: "the load in intro graphic is not smooth"): waits until the
/// main thread is steady — 8 frames in a row on time, i.e. the page under the intro
/// has finished its first build and render — or `cap` seconds, whichever is first.
@MainActor
final class IntroSettle: NSObject {
    private var cont: CheckedContinuation<Void, Never>?
    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private var run = 0
    private var deadline: CFTimeInterval = 0

    static func wait(cap: Double) async {
        let settle = IntroSettle()
        await withCheckedContinuation { c in settle.start(c, cap: cap) }
    }

    private func start(_ c: CheckedContinuation<Void, Never>, cap: Double) {
        cont = c
        deadline = CACurrentMediaTime() + cap
        let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
        l.add(to: .main, forMode: .common)
        link = l
    }

    @objc private func tick(_ l: CADisplayLink) {
        let t = l.timestamp
        let frame = max(1.0 / 120, l.targetTimestamp - l.timestamp)
        if last > 0 { run = (t - last) <= frame * 1.5 ? run + 1 : 0 }
        last = t
        if run >= 8 || CACurrentMediaTime() >= deadline { finish() }
    }

    private func finish() {
        link?.invalidate()
        link = nil
        cont?.resume()
        cont = nil
    }
}

/// FINISH_SPEC §F2 fix (founder, iOS 234: "there are two of them and the one that
/// animates whips off the screen while the duplicate stays in place"): the hand-off
/// between the cold-start intro and the REAL Home header cast row.
///   1. While the intro runs, the real row is hidden (opacity 0, still laid out).
///   2. The real row reports each character's on-screen frame here; the intro glides
///      its row to exactly those frames (ease, no overshoot).
///   3. On landing, in the same frame, the real row shows and the intro is removed.
///   4. Then the real row plays the all-cast hop flourish (`CastMoves.flourishPose`).
@MainActor
final class CastHandoff: ObservableObject {
    static let shared = CastHandoff()

    /// The real header row is hidden while this is true. A cold process starts
    /// with it on (the intro is about to cover the screen); a fail-safe turns it
    /// off if the intro never runs.
    @Published var introRunning = true
    /// Each character's frame in the real row (global coordinates), reported by
    /// LivingCastHeader while the intro runs.
    @Published var frames: [MascotID: CGRect] = [:]
    /// When the landing flourish started (nil = none playing).
    @Published var flourishStart: Date?
    var introStarted = false

    private init() {
        // Fail-safe: never leave the real row hidden (the intro is ≤ 1.6 s).
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            guard let self, self.introRunning else { return }
            self.introRunning = false
        }
    }

    /// Step 3 + 4: show the real row (same frame the intro is removed in), then
    /// the flourish unless `flourish` is false (Reduce Motion).
    func land(flourish: Bool) {
        introRunning = false
        guard flourish else { return }
        let start = Date()
        flourishStart = start
        // §U: the landing flourish's hops (the sound's min gap thins them to a quick cascade).
        for i in 0..<CastMoves.ids.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * CastMoves.flourishStagger) { Feedback.hop(volume: 0.7) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + CastMoves.flourishDuration() + 0.05) { [weak self] in
            if self?.flourishStart == start { self?.flourishStart = nil }
        }
    }
}

/// The real row's per-character frames (global).
struct CastFramesKey: PreferenceKey {
    static var defaultValue: [MascotID: CGRect] = [:]
    static func reduce(value: inout [MascotID: CGRect], nextValue: () -> [MascotID: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}

private struct ColdStartIntro: View {
    /// Called once the intro is removed; `true` when the landing flourish is playing.
    let onDone: (Bool) -> Void

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @ObservedObject private var handoff = CastHandoff.shared
    @State private var start = Date()
    @State private var fade: Double = 1
    @State private var finishing = false
    /// §AU5: the intro images are decoded (or the 300 ms cap passed).
    @State private var ready = false

    /// The W's size at the center (the old launch image's 512 px @3x).
    private static let launchSize: CGFloat = 512 / 3
    /// BI20 (founder 10-03: "slow down the intro … not make it seem rushed … don't lose the
    /// fluidity"): the whole choreography plays 1.4× slower — same curves, same order.
    static let pace: Double = 1.4
    /// The glide lands at 1.55 s of choreography time (≈ 2.2 s on the clock); the intro ends then.
    private static let landing: Double = 1.55 * pace
    private static let background = Color(hex: 0xF1D7F6)

    /// The intro's backdrop: in season (and unless the `opening_animation_season` switch is off) the
    /// Halloween night wall Home draws underneath, aspect-filled and centered over the full screen so
    /// its details land on the same pixels; otherwise the lilac launch color.
    @ViewBuilder
    private func backdropView(_ size: CGSize) -> some View {
        if let wall = IntroArt.wallName {
            (IntroArt.wall.map { Image(uiImage: $0) } ?? Image(wall))
                .resizable()
                .interpolation(.high)
                .scaledToFill()
                .frame(width: size.width, height: size.height)
                .clipped()
        } else {
            Self.background
        }
    }

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let safeTop = geo.safeAreaInsets.top
            let origin = geo.frame(in: .global).origin
            ZStack {
                if !ready {
                    // §AU5: the plain launch color (in season: the night wall) until every intro image is decoded.
                    backdropView(size)
                } else if still {
                    backdropView(size)
                    IntroArt.image(.w).resizable().interpolation(.high).scaledToFit()
                        .frame(width: Self.launchSize, height: Self.launchSize)
                        .position(x: size.width / 2, y: size.height / 2)
                } else {
                    // Founder 10-10 (smoothness): the choreography is sampled once into Core Animation keyframes
                    // (the same curves, 120 samples a second) and run by the render server: the main thread does
                    // nothing per frame while it plays (the TimelineView version re-ran SwiftUI's render pass for
                    // all ten figures every frame, 300+ ms of main time in a 2 s intro).
                    IntroLayers(build: { plan(size: size, safeTop: safeTop, origin: origin) })
                        .frame(width: size.width, height: size.height)
                }
            }
            .opacity(fade)
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        // Tap to skip: straight to the landing (step 3), then the flourish.
        .onTapGesture { land() }
        .accessibilityHidden(true)
        .task {
            // §AU5: decode first (≤ 300 ms on the launch color); §AQ3: the clock
            // starts on the first intro frame, so a busy launch never skips ahead.
            await IntroArt.prepare(timeout: 0.3)
            // Perf audit: hold the opening pose (the launch color) until the page
            // underneath has built and frames are steady, so Home's first build never
            // lands mid-animation (it caused 400-600 ms stalls inside the intro).
            await IntroSettle.wait(cap: 1.2)
            start = Date()
            ready = true
            #if DEBUG
            if PerfTour.requested { PerfMonitor.shared.begin("launch.choreo") }  // measurement only: splits the intro pre-roll from the choreography
            #endif
            // The intro jingle (Sound Lab pick "Marimba Parade"): its first note is the W's pop,
            // its notes are cut to the choreography's beats. Animated intro only.
            if !still { SoundManager.shared.playIntro() }
            if still {
                // Reduce Motion: a 200 ms crossfade over the real row, no flourish.
                handoff.introRunning = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    guard !finishing else { return }
                    finishing = true
                    withAnimation(.easeOut(duration: 0.2)) { fade = 0 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { onDone(false) }
                }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + Self.landing) { land() }
            }
        }
    }

    /// Step 3: in ONE frame the real row turns visible and the intro row is removed
    /// (no crossfade overlap, no second copy); step 4 the real row's flourish.
    private func land() {
        guard !finishing else { return }
        finishing = true
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            handoff.land(flourish: !still)
            onDone(!still)
        }
    }

    // MARK: The choreography (t in seconds)

    private func ease(_ x: Double) -> Double { CubicBezier.easeInOut.value(at: min(1, max(0, x))) }
    /// The glide eases OUT into the real row — it never passes its target.
    private func easeOut(_ x: Double) -> Double { CubicBezier.easeOut.value(at: min(1, max(0, x))) }

    /// The slot centers of a WORDOCIOUS row laid out like the living cast header
    /// (same figure size, packing and stagger), with its bottom edge at `bottom`.
    private func slots(width: CGFloat, bottom: CGFloat) -> [CGPoint] {
        let s = LivingCastHeader.figure
        var x = LivingCastHeader.inset
        return Mascots.cast.enumerated().map { i, m in
            let w = s * (LivingCastHeader.visibleWidth[m] ?? 1)
            let c = CGPoint(x: x + w / 2, y: bottom - s / 2 - (i % 2 == 1 ? LivingCastHeader.stagger : 0))
            x += w - s * LivingCastHeader.overlap
            return c
        }
    }

    /// Step 2: the real row's measured frames (in this overlay's coordinates) — the
    /// computed header slots only when the real row hasn't reported yet.
    private func targets(size: CGSize, safeTop: CGFloat, origin: CGPoint) -> [(center: CGPoint, side: CGFloat)] {
        let s = LivingCastHeader.figure
        // §AS2: the controls row sits above the cast row now.
        let fallback = slots(width: size.width,
                             bottom: safeTop + HeaderControl.tap + 2 + LivingCastHeader.height(pro: AuthService.shared.isProActive))
        return Mascots.cast.enumerated().map { i, m in
            if let f = handoff.frames[m], f.width > 0 {
                return (CGPoint(x: f.midX - origin.x, y: f.midY - origin.y), f.width)
            }
            return (fallback[i], s)
        }
    }

    /// The whole choreography sampled at 120 Hz: per figure the bottom-center point, the scale and the opacity.
    private func plan(size: CGSize, safeTop: CGFloat, origin: CGPoint) -> IntroPlan {
        let s = LivingCastHeader.figure
        let mid = slots(width: size.width, bottom: size.height / 2 + s / 2)
        let header = targets(size: size, safeTop: safeTop, origin: origin)
        let end = Self.landing / Self.pace
        let n = Int((end * 120).rounded(.up)) + 1
        var figures = [[IntroPose]](repeating: [], count: Mascots.cast.count)
        var backdrop: [Float] = []
        for k in 0..<n {
            let t = min(end, Double(k) / 120)
            // 1.15 → 1.55 s: the backdrop fades out as the row glides up into the real header.
            backdrop.append(Float(1 - ease((t - 1.15) / 0.4)))
            let glide = easeOut((t - 1.2) / 0.35)
            for i in 0..<Mascots.cast.count {
                figures[i].append(pose(i, t: t, s: s, mid: mid[i], header: header[i], glide: glide, size: size))
            }
        }
        let images: [UIImage?] = Mascots.cast.map { IntroArt.images[$0] ?? UIImage(named: CastSkin.introAssetName(for: $0)) }
        return IntroPlan(size: size, duration: Self.landing, figures: figures, backdrop: backdrop, images: images,
                         wall: IntroArt.wallName == nil ? nil : (IntroArt.wall ?? IntroArt.wallName.flatMap { UIImage(named: $0) }),
                         color: UIColor(Self.background), figureSide: [s] + [CGFloat](repeating: s, count: Mascots.cast.count - 1),
                         launchSide: Self.launchSize)
    }

    private func pose(_ i: Int, t: Double, s: CGFloat, mid: CGPoint, header: (center: CGPoint, side: CGFloat),
                      glide: Double, size: CGSize) -> IntroPose {
        let rowPoint = CGPoint(x: mid.x + (header.center.x - mid.x) * glide, y: mid.y + (header.center.y - mid.y) * glide)
        let rowSide = s + (header.side - s) * glide
        if i == 0 {
            // W: pops in on the launch color (0–0.32 s, the only W on screen) → into
            // slot 0 (0.32–0.6 s).
            let bounce = Keyframes.sample([(0, CastPose(sx: 0.55, sy: 0.55)), (0.55, CastPose(ty: -0.04, sx: 1.08, sy: 1.08)),
                                           (0.8, CastPose(sx: 0.97, sy: 0.97)), (1, .identity)],
                                          at: min(1, max(0, t) / 0.32), easing: .easeInOut)
            let k = ease((t - 0.32) / 0.28)
            let side = Self.launchSize + (rowSide - Self.launchSize) * k
            let center = CGPoint(x: size.width / 2 + (rowPoint.x - size.width / 2) * k,
                                 y: size.height / 2 + (rowPoint.y - size.height / 2) * k)
            let k0 = side / Self.launchSize
            let dx = center.x - size.width / 2
            let dy = center.y - size.height / 2 + CGFloat(bounce.ty) * side - (Self.launchSize - side) / 2
            // The frame is launchSize square, centered, scaled about its bottom center, then offset.
            return IntroPose(x: size.width / 2 + dx, y: size.height / 2 + Self.launchSize / 2 + dy,
                             sx: CGFloat(bounce.sx) * k0, sy: CGFloat(bounce.sy) * k0, alpha: CGFloat(min(1, max(0, t) / 0.12)))
        }
        // The other nine pop in, 60 ms apart, with a spring.
        let start = 0.42 + Double(i - 1) * 0.06
        let p = (t - start) / 0.3
        // Never a zero (singular) scale.
        let pop = p <= 0 ? CastPose(sx: 0.2, sy: 0.2)
            : Keyframes.sample([(0, CastPose(sx: 0.2, sy: 0.2)), (0.6, CastPose(sx: 1.12, sy: 1.12)), (1, .identity)],
                               at: min(1, p), easing: CubicBezier(0.3, 1.4, 0.5, 1))
        let k1 = rowSide / s
        let dx = rowPoint.x - size.width / 2
        let dy = rowPoint.y - size.height / 2 - (s - rowSide) / 2
        return IntroPose(x: size.width / 2 + dx, y: size.height / 2 + s / 2 + dy,
                         sx: CGFloat(pop.sx) * k1, sy: CGFloat(pop.sy) * k1, alpha: p <= 0 ? 0 : 1)
    }
}

/// One figure at one instant: the bottom-center point of its frame (overlay coordinates), its scale about that point,
/// its opacity.
struct IntroPose { var x: CGFloat; var y: CGFloat; var sx: CGFloat; var sy: CGFloat; var alpha: CGFloat }

struct IntroPlan {
    let size: CGSize
    let duration: Double
    let figures: [[IntroPose]]
    let backdrop: [Float]
    let images: [UIImage?]
    let wall: UIImage?
    let color: UIColor
    let figureSide: [CGFloat]
    let launchSide: CGFloat
}

/// The intro's figures + backdrop as layers: one set of sampled keyframe animations, then the render server plays them.
private struct IntroLayers: UIViewRepresentable {
    let build: () -> IntroPlan

    func makeUIView(context: Context) -> IntroLayersView { IntroLayersView(plan: build()) }
    func updateUIView(_ v: IntroLayersView, context: Context) {}
}

private final class IntroLayersView: UIView {
    private let plan: IntroPlan
    private var started = false

    init(plan: IntroPlan) {
        self.plan = plan
        super.init(frame: CGRect(origin: .zero, size: plan.size))
        isUserInteractionEnabled = false
        backgroundColor = .clear
        let scale = UIScreen.main.scale

        let back = CALayer()
        back.frame = CGRect(origin: .zero, size: plan.size)
        back.masksToBounds = true
        if let wall = plan.wall {
            back.contents = wall.cgImage
            back.contentsGravity = .resizeAspectFill
        } else {
            back.backgroundColor = plan.color.cgColor
        }
        back.contentsScale = scale
        back.opacity = plan.backdrop.first ?? 1
        back.name = "back"
        layer.addSublayer(back)

        for (i, samples) in plan.figures.enumerated() {
            let side = i == 0 ? plan.launchSide : plan.figureSide[i]
            let l = CALayer()
            l.name = "fig\(i)"
            l.bounds = CGRect(x: 0, y: 0, width: side, height: side)
            l.anchorPoint = CGPoint(x: 0.5, y: 1)
            l.contents = plan.images[i]?.cgImage
            l.contentsGravity = .resizeAspect
            l.contentsScale = scale
            l.minificationFilter = .trilinear
            l.magnificationFilter = .linear
            if let p = samples.first {
                l.position = CGPoint(x: p.x, y: p.y)
                l.transform = CATransform3DMakeScale(p.sx, p.sy, 1)
                l.opacity = Float(p.alpha)
            }
            layer.addSublayer(l)
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil, !started else { return }
        started = true
        let begin = CACurrentMediaTime()
        func add(_ l: CALayer, _ key: String, _ values: [Any]) {
            let a = CAKeyframeAnimation(keyPath: key)
            a.values = values
            a.calculationMode = .linear
            a.duration = plan.duration
            a.beginTime = begin
            a.fillMode = .both
            a.isRemovedOnCompletion = false
            l.add(a, forKey: key)
        }
        for l in layer.sublayers ?? [] {
            if l.name == "back" { add(l, "opacity", plan.backdrop); continue }
            guard let name = l.name, name.hasPrefix("fig"), let i = Int(name.dropFirst(3)) else { continue }
            let f = plan.figures[i]
            add(l, "position", f.map { NSValue(cgPoint: CGPoint(x: $0.x, y: $0.y)) })
            add(l, "transform.scale.x", f.map { Float($0.sx) })
            add(l, "transform.scale.y", f.map { Float($0.sy) })
            add(l, "opacity", f.map { Float($0.alpha) })
        }
    }
}
