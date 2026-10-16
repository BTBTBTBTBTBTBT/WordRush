import SwiftUI
import UIKit

/// Living wallpapers (FRIDAY-QUEUE items 15 + 45): slow drifting things on a MENU page's wall. Letter tiles
/// (Default / Dark), bubbles (Ocean), leaves (Forest) and, while Seasonal is on, bats + a witch fly-by + fog + stars
/// (Halloween) or a slow V of geese (Thanksgiving, 10-16).
/// Never in a game board or a VS board (PageBackground only mounts it on menu tints).
/// Founder 10-10 (smoothness, measured): the wall is REAL Core Animation now. Each drifting thing is one small CALayer
/// with looping CABasicAnimation / CAKeyframeAnimation (same art, density, speeds, paths), so the render server moves
/// them at the display's rate and the main thread does nothing per frame (the Canvas + TimelineView version re-ran
/// SwiftUI's whole render pass 20 times a second). Static (the same picture, frozen) under Reduce Motion (OS or the
/// in-app toggle), Low Power Mode and a hot device; fewer particles on a warm one; off with the `living_wallpapers` switch.
struct LivingWallpaper: View {
    let theme: String
    let season: String?

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var flags = FlagsService.shared
    /// Smoothness pass (10-10): the wall only animates while its page is showing (another tab, a pushed page or a game
    /// cover on top pauses it).
    @State private var onScreen = false
    @State private var appearGen = 0
    /// A game cover on top never fires onDisappear, so the wall also pauses while one is up.
    @ObservedObject private var chrome = ChromeVisibility.shared
    @ObservedObject private var pageSwitch = PageSwitch.shared

    var body: some View {
        if flags.isLive("living_wallpapers") {
            let still = envReduce || Theme.reduceMotion || ProcessInfo.processInfo.isLowPowerModeEnabled
                || ProcessInfo.processInfo.thermalState.rawValue >= ProcessInfo.ThermalState.serious.rawValue
            let trim = ProcessInfo.processInfo.thermalState == .fair ? 0.6 : 1.0
            let running = !still && scenePhase == .active && onScreen && !chrome.bottomNavHidden && !pageSwitch.switching
            WallpaperLayers(theme: theme, season: season, trim: trim, still: still, running: running)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
                // Founder 10-10 (smoothness): the wall starts drifting ~0.5 s after its page opens, so it never competes
                // with building the page (a tab switch, a cover closing); the first frame shows the same picture, still.
                .onAppear {
                    appearGen += 1
                    let gen = appearGen
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { if gen == appearGen { onScreen = true } }
                }
                .onDisappear { appearGen += 1; onScreen = false }
        }
    }
}

/// Where the Halloween walls paint their moon (measured: every wall's moon sits at the same spot), mapped through
/// the wall's aspect-fill, so the witch's moon pass lines up with the art. Phones use the 1290x2796 wall.
enum WitchMoon {
    static func center(in size: CGSize) -> CGPoint {
        let iw: CGFloat = 1290, ih: CGFloat = 2796
        let s = max(size.width / iw, size.height / ih)
        return CGPoint(x: (size.width - iw * s) / 2 + 0.74 * iw * s, y: (size.height - ih * s) / 2 + 0.071 * ih * s)
    }
}

/// The wall's layers. `running == false` freezes the render server's clock for this view (the animations stay put and
/// carry on from where they stopped).
private struct WallpaperLayers: UIViewRepresentable {
    let theme: String
    let season: String?
    let trim: Double
    let still: Bool
    let running: Bool

    func makeUIView(context: Context) -> WallpaperView { WallpaperView() }

    func updateUIView(_ v: WallpaperView, context: Context) {
        v.apply(WallpaperView.Config(theme: theme, season: season, trim: trim, still: still))
        v.setRunning(running)
    }
}

final class WallpaperView: UIView {
    struct Config: Equatable { let theme: String; let season: String?; let trim: Double; let still: Bool }

    private var config: Config?
    private var builtFor: (Config, CGSize)?
    private var running = false
    private let holder = CALayer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        backgroundColor = .clear
        isOpaque = false
        layer.addSublayer(holder)
        // Parked until the page says go (the animations are added already; the clock is frozen).
        layer.speed = 0
        layer.timeOffset = 0
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    func apply(_ c: Config) {
        guard c != config else { return }
        config = c
        rebuild()
    }

    func setRunning(_ run: Bool) {
        guard run != running else { return }
        running = run
        if run {
            ensureAnimating()
            let paused = layer.timeOffset
            layer.speed = 1
            layer.timeOffset = 0
            layer.beginTime = 0
            layer.beginTime = layer.convertTime(CACurrentMediaTime(), from: nil) - paused
        } else {
            let t = layer.convertTime(CACurrentMediaTime(), from: nil)
            layer.speed = 0
            layer.timeOffset = t
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        holder.frame = bounds
        if let c = config, builtFor?.1 != bounds.size || builtFor?.0 != c { rebuild() }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil { ensureAnimating() }
    }

    /// Core Animation drops a layer's animations when its view leaves the window (and on backgrounding): put them back.
    private func ensureAnimating() {
        guard let c = config, !c.still, bounds.width > 0 else { return }
        if holder.sublayers?.first?.animationKeys()?.isEmpty ?? true { rebuild() }
    }

    // MARK: Layers

    private func rebuild() {
        guard let c = config, bounds.width > 0, bounds.height > 0 else { return }
        builtFor = (c, bounds.size)
        holder.sublayers?.forEach { $0.removeFromSuperlayer() }
        holder.frame = bounds
        let b = Builder(holder: holder, size: bounds.size, still: c.still, trim: c.trim, scale: window?.screen.scale ?? UIScreen.main.scale)
        if let a = ThemeKit.seasonal(c.season)?.ambient {
            b.seasonal(a)
        } else if let e = ThemeKit.entry(c.theme) {
            b.theme(e.ambient)
        }
    }

    private static var images: [String: CGImage] = [:]
    fileprivate static func sprite(_ name: String) -> CGImage? {
        if let hit = images[name] { return hit }
        let img = UIImage(named: name)?.cgImage
        if let img { images[name] = img }
        return img
    }

    /// Builds one wall's layers + animations. Every position is a function of the clock exactly as the Canvas version
    /// computed it; each looping thing starts at the point of its cycle the clock is at now.
    private struct Builder {
        let holder: CALayer
        let size: CGSize
        let still: Bool
        let trim: Double
        let scale: CGFloat
        let now = Date().timeIntervalSinceReferenceDate

        // A deterministic 0...1 sequence (same as web theme-wall.tsx `unit`): the layout never changes between builds.
        func unit(_ i: Int, _ salt: Double) -> Double {
            let x = sin(Double(i + 1) * 12.9898 + salt * 78.233) * 43758.5453
            return x - floor(x)
        }
        func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }
        func wrap(_ x: Double) -> Double { x - floor(x) }

        func layer(_ contents: CGImage?, _ w: CGFloat, _ h: CGFloat, opacity: Double = 1) -> CALayer {
            let l = CALayer()
            l.bounds = CGRect(x: 0, y: 0, width: w, height: h)
            l.contents = contents
            l.contentsGravity = .resize
            l.contentsScale = scale
            l.opacity = Float(opacity)
            l.allowsEdgeAntialiasing = true
            holder.addSublayer(l)
            return l
        }

        /// A looping animation of `dur` seconds that begins `frac` of the way through its cycle.
        func loop<A: CAAnimation>(_ a: A, _ dur: Double, _ frac: Double) -> A {
            a.duration = dur
            a.repeatCount = .infinity
            a.timeOffset = wrap(frac) * dur
            a.isRemovedOnCompletion = false
            a.fillMode = .both
            return a
        }

        func linear(_ key: String, _ from: Any, _ to: Any, _ dur: Double, _ frac: Double) -> CABasicAnimation {
            let a = CABasicAnimation(keyPath: key)
            a.fromValue = from; a.toValue = to
            a.timingFunction = CAMediaTimingFunction(name: .linear)
            return loop(a, dur, frac)
        }

        /// A curve sampled `n` times over one cycle (linear in between).
        func sampled(_ key: String, _ n: Int, _ dur: Double, _ frac: Double, _ f: (Double) -> Any) -> CAKeyframeAnimation {
            let a = CAKeyframeAnimation(keyPath: key)
            a.values = (0...n).map { f(Double($0) / Double(n)) }
            a.calculationMode = .linear
            return loop(a, dur, frac)
        }

        // MARK: Themes (tiles / bubbles / leaves)

        func theme(_ a: ThemeKit.Ambient) {
            let n = max(2, Int((Double(a.count) * trim).rounded()))
            for i in 0..<n {
                let s = lerp(a.size[0], a.size[1], unit(i, 1))
                let dur = lerp(a.duration[0], a.duration[1], unit(i, 4))
                let phase = unit(i, 5)
                // `still`: the phase alone places the particle (a frozen frame of the same picture).
                let f0 = still ? phase : wrap(now / dur + phase)
                let sway = lerp(-18, 18, unit(i, 6)) / 100 * size.width
                let rot = lerp(-25, 25, unit(i, 7))
                func yAt(_ f: Double) -> Double {
                    switch a.kind {
                    case "leaves": return lerp(-0.18, 1.12, f) * size.height
                    default: return lerp(1.08, -0.22, f) * size.height
                    }
                }
                func angleAt(_ f: Double) -> Double {
                    switch a.kind {
                    case "leaves": return rot * f
                    case "bubbles": return 0
                    default: return lerp(-rot, rot, f)
                    }
                }
                func centerAt(_ f: Double) -> CGPoint {
                    CGPoint(x: unit(i, 2) * 0.92 * size.width + sway * f + s / 2, y: yAt(f) + s / 2)
                }
                let contents: CGImage?
                if !a.sprites.isEmpty {
                    contents = WallpaperView.sprite("ambient-\(a.sprites[i % a.sprites.count])")
                } else {
                    contents = tile(i, s)
                }
                let l = layer(contents, s, s, opacity: a.opacity)
                l.position = centerAt(f0)
                l.transform = CATransform3DMakeRotation(CGFloat(angleAt(f0) * .pi / 180), 0, 0, 1)
                if !still {
                    l.add(linear("position", NSValue(cgPoint: centerAt(0)), NSValue(cgPoint: centerAt(1)), dur, f0), forKey: "drift")
                    if a.kind != "bubbles" {
                        l.add(linear("transform.rotation.z", angleAt(0) * .pi / 180, angleAt(1) * .pi / 180, dur, f0), forKey: "turn")
                    }
                }
            }
        }

        /// A letter tile (a vertical gradient rounded square with a white rounded letter), drawn once.
        func tile(_ i: Int, _ s: CGFloat) -> CGImage? {
            let key = "tile-\(i)-\(Int(s * 10))-\(Int(scale))"
            if let hit = WallpaperView.images[key] { return hit }
            let palette: [UInt32] = [0x7C3AED, 0xEC4899, 0xF59E0B, 0x10B981, 0x3B82F6]
            let hex = palette[i % palette.count]
            let hue = UIColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
            let fmt = UIGraphicsImageRendererFormat.default()
            fmt.scale = scale
            let img = UIGraphicsImageRenderer(size: CGSize(width: s, height: s), format: fmt).image { r in
                let cg = r.cgContext
                let rect = CGRect(x: 0, y: 0, width: s, height: s)
                cg.saveGState()
                UIBezierPath(roundedRect: rect, cornerRadius: s * 0.24).addClip()
                let space = CGColorSpaceCreateDeviceRGB()
                if let g = CGGradient(colorsSpace: space, colors: [hue.withAlphaComponent(0.75).cgColor, hue.cgColor] as CFArray, locations: [0, 1]) {
                    cg.drawLinearGradient(g, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: s), options: [])
                }
                cg.restoreGState()
                var font = UIFont.systemFont(ofSize: s * 0.55, weight: .black)
                if let d = font.fontDescriptor.withDesign(.rounded) { font = UIFont(descriptor: d, size: s * 0.55) }
                let letter = String(Array("WORDCISU")[i % 8]) as NSString
                let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.white]
                let ts = letter.size(withAttributes: attrs)
                letter.draw(at: CGPoint(x: (s - ts.width) / 2, y: (s - ts.height) / 2), withAttributes: attrs)
            }.cgImage
            if let img { WallpaperView.images[key] = img }
            return img
        }

        // MARK: Seasonal (stars, fog, bats, witch)

        func seasonal(_ a: ThemeKit.SeasonalAmbient) {
            // Every part is optional (Halloween: stars + fog + bats + witch; Thanksgiving: a flock of geese + a few stars).
            // Stars twinkle in the upper half.
            let stars = a.stars.map { Int((Double($0.count) * trim).rounded()) } ?? 0
            let starColor = UIColor(Color(hexString: a.stars?.color ?? "") ?? .yellow)
            for i in 0..<stars {
                let dur = lerp(3, 7, unit(i, 13))
                let phase = unit(i, 14)
                let p = CGPoint(x: unit(i, 11) * 0.96 * size.width, y: unit(i, 12) * 0.55 * size.height)
                let l = CALayer()
                l.bounds = CGRect(x: 0, y: 0, width: 3, height: 3)
                l.position = CGPoint(x: p.x + 1.5, y: p.y + 1.5)
                l.cornerRadius = 1.5
                l.backgroundColor = starColor.cgColor
                holder.addSublayer(l)
                let tw = { (f: Double) in 0.2 + 0.75 * abs(sin(.pi * f)) }
                if still {
                    l.opacity = 0.8
                } else {
                    // Stepped on one shared 8 Hz grid: the render server re-composites the page once per step for all the
                    // stars together, instead of every frame because ten stars are always mid-fade. 8 steps a second
                    // is finer than the eye resolves on a 3 pt dot.
                    let n = max(8, Int(dur * 8))
                    let k0 = Int(wrap(now / dur + phase) * Double(n))
                    l.opacity = Float(tw(Double(k0) / Double(n)))
                    let a = CAKeyframeAnimation(keyPath: "opacity")
                    a.values = (0..<n).map { Float(tw(Double($0) / Double(n))) }
                    a.calculationMode = .discrete
                    a.duration = Double(n) / 8
                    a.repeatCount = .infinity
                    a.timeOffset = Double(k0) / 8
                    a.isRemovedOnCompletion = false
                    a.fillMode = .both
                    l.add(a, forKey: "twinkle")
                }
            }
            // Fog drifting along the bottom.
            if let fog = a.fog, let fogImg = WallpaperView.sprite("ambient-\(fog.sprite)") {
                let fogW = size.width * 1.3
                let fogH = fogW * CGFloat(fogImg.height) / max(CGFloat(fogImg.width), 1)
                let l = layer(fogImg, fogW, fogH, opacity: fog.opacity)
                let cy = size.height - fogH / 2
                let cx = { (fp: Double) in -size.width * 0.14 + fp * size.width * 0.1 + fogW / 2 }
                let fp = { (f: Double) in (1 + sin(f * .pi * 2)) / 2 }
                let f0 = still ? 0.0 : wrap(now / fog.duration)
                l.position = CGPoint(x: cx(still ? 0.5 : fp(f0)), y: cy)
                if !still {
                    // The drift is ~1 pt/s: stepped 5 times a second (a device pixel at a time) it looks the same, and the
                    // render server re-composites this wide translucent layer 5x a second instead of every frame.
                    let steps = max(8, Int(fog.duration * 5))
                    let fogAnim = CAKeyframeAnimation(keyPath: "position.x")
                    fogAnim.values = (0..<steps).map { cx(fp(Double($0) / Double(steps))) }
                    fogAnim.calculationMode = .discrete
                    l.add(loop(fogAnim, fog.duration, f0), forKey: "fog")
                }
            }
            // Bats cross the sky at their own heights.
            if let batsSpec = a.bats, let batImg = WallpaperView.sprite("ambient-\(batsSpec.sprite)") {
                let bats = max(1, Int((Double(batsSpec.count) * trim).rounded()))
                for i in 0..<bats {
                    let w = lerp(batsSpec.size[0], batsSpec.size[1], unit(i, 21))
                    let h = w * 0.69
                    let dur = lerp(batsSpec.duration[0], batsSpec.duration[1], unit(i, 23))
                    let phase = unit(i, 24)
                    let f0 = still ? 0.7 : wrap(now / dur + phase)
                    func center(_ f: Double) -> CGPoint {
                        let x = lerp(-0.14, 1.16, f) * size.width
                        let y = (0.06 + unit(i, 22) * 0.4) * size.height + sin(f * .pi * 4) * 14
                        return CGPoint(x: x + w / 2, y: y + h / 2)
                    }
                    let l = layer(batImg, w, h)
                    l.position = center(f0)
                    if !still {
                        // A soft wingbeat (~1.7/s, each bat out of step): the wings squash toward the body and open again.
                        let flapPhase = unit(i, 25)
                        let flap = { (f: Double) in 0.78 + 0.22 * sin((f + 0) * .pi * 2) }
                        let g0 = wrap(now / 0.6 + flapPhase)
                        l.transform = CATransform3DMakeScale(1, CGFloat(flap(g0)), 1)
                        l.add(sampled("position", 64, dur, f0) { NSValue(cgPoint: center($0)) }, forKey: "cross")
                        l.add(sampled("transform.scale.y", 12, 0.6, g0) { flap($0) }, forKey: "flap")
                    }
                }
            }
            if let flock = a.flock { self.flock(flock) }
            guard let witch = a.witch else { return }
            // The witch flies by once per `every` seconds (hidden while frozen). Every third pass she crosses the wall's own
            // moon (a silhouette against it), on a gentle climb: one 3-pass cycle, shown for the first 20% of each pass.
            #if DEBUG
            // Visual check only: `debug-witch-moon` parks the witch mid moon pass.
            let parkOnMoon = UserDefaults.standard.bool(forKey: "debug-witch-moon")
            #else
            let parkOnMoon = false
            #endif
            guard !still || parkOnMoon, let witchImg = WallpaperView.sprite("ambient-\(witch.sprite)") else { return }
            let w = CGFloat(witch.size)
            let h = w * CGFloat(witchImg.height) / max(CGFloat(witchImg.width), 1)
            let moon = WitchMoon.center(in: size)
            /// The witch's center at progress `p` (0...1) of a pass; `moonPass` = the climb across the moon.
            func center(_ p: Double, _ moonPass: Bool) -> CGPoint {
                let x = lerp(-0.24, 1.24, p) * size.width
                var y = size.height * 0.14 + sin(p * .pi) * -28
                if moonPass { y = moon.y + (moon.x - (x + w / 2)) * 0.12 - h / 2 }
                return CGPoint(x: x + w / 2, y: y + h / 2)
            }
            let l = layer(witchImg, w, h, opacity: 0.95)
            if parkOnMoon {
                l.position = moon
                return
            }
            let every = witch.every
            let cycle = every * 3
            var times: [NSNumber] = [], pts: [NSValue] = [], opTimes: [NSNumber] = [], ops: [Float] = []
            let eps = 0.0005
            for k in 0..<3 {
                let start = Double(k) * every, end = start + every * 0.2
                for j in 0...16 {
                    let p = Double(j) / 16
                    times.append(NSNumber(value: (start + p * every * 0.2) / cycle))
                    pts.append(NSValue(cgPoint: center(p, k == 2)))
                }
                if k > 0 { opTimes.append(NSNumber(value: start / cycle - eps)); ops.append(0) }
                opTimes.append(NSNumber(value: start / cycle)); ops.append(0.95)
                opTimes.append(NSNumber(value: end / cycle)); ops.append(0.95)
                opTimes.append(NSNumber(value: end / cycle + eps)); ops.append(0)
            }
            times.append(1); pts.append(pts.last!)
            opTimes.append(1); ops.append(0)
            let frac = wrap(now / cycle)
            let pos = CAKeyframeAnimation(keyPath: "position")
            pos.values = pts; pos.keyTimes = times; pos.calculationMode = .linear
            let op = CAKeyframeAnimation(keyPath: "opacity")
            op.values = ops; op.keyTimes = opTimes; op.calculationMode = .linear
            l.opacity = 0
            l.add(loop(pos, cycle, frac), forKey: "fly")
            l.add(loop(op, cycle, frac), forKey: "show")
        }

        // MARK: Flock (the V of geese, 10-16)

        /// The V the Thanksgiving wall engine baked (geese_v: lead + two trailing arms, 0.92 L step, 0.30 spread, the
        /// upper arm a little tighter), from one goose sprite so each bird beats its wings with the bats' scaleY squash
        /// (slower, about the body at the bottom of the sprite), out of step. Same numbers as web theme-wall.tsx
        /// flockGeese / Android ThemeKit.flockGeese. Returns each goose's offset from the lead (pt), width, index.
        func flockGeese(_ count: Int, _ size: Double, _ direction: Double, _ salt: Double) -> (geese: [(x: Double, y: Double, w: Double, k: Int)], trail: Double) {
            let L = size * 0.56                       // the sprite is 1.78 L wide (goose() spans -0.70 L .. 1.00 L + padding)
            let perArm = (count - 1) / 2
            var geese: [(x: Double, y: Double, w: Double, k: Int)] = [(0, 0, size, 0)]
            var k = 1
            for (dy, tight, extra) in [(-1.0, 0.78, 0), (1.0, 1.0, (count - 1) % 2)] {
                if perArm + extra >= 1 {
                    for i in 1...(perArm + extra) {
                        geese.append((
                            x: -direction * (Double(i) * L * 0.92 + lerp(-0.05, 0.05, unit(k, salt + 1)) * L),
                            y: dy * Double(i) * L * 0.30 * tight + lerp(-0.06, 0.06, unit(k, salt + 2)) * L,
                            w: size * lerp(0.86, 1.0, unit(k, salt + 3)),
                            k: k))
                        k += 1
                    }
                }
            }
            return (geese, Double(perArm) * L * 0.92 + size)
        }

        /// Two flocks: 0 = always on its way across (one slow linear pass, 40-70 s, with a gentle rise and fall);
        /// 1 = a smaller one that passes once every third cycle and is hidden the rest of the time (like the witch).
        /// Frozen: the main flock parks mid sky (where the wall used to bake it), the rare one stays hidden.
        func flock(_ f: ThemeKit.SeasonalAmbient.Flock) {
            guard let img = WallpaperView.sprite("ambient-\(f.sprite)") else { return }
            let direction: Double = f.direction < 0 ? -1 : 1
            for which in 0...(trim >= 1 ? 1 : 0) {
                let rare = which == 1
                let count = rare ? max(3, f.count - 2) : f.count
                let gw = lerp(f.size[0], f.size[1], unit(which, 31)) * (rare ? 0.8 : 1)   // one goose's width (pt)
                let dur = lerp(f.duration[0], f.duration[1], unit(which, 32)) * (rare ? 1.15 : 1)
                let (geese, trail) = flockGeese(count, gw, direction, 40 + Double(which) * 10)
                let top = lerp(f.band[0], f.band[1], unit(which, 33)) / 100 * size.height
                // Heading right: the lead enters at -10% and leaves at 110% + trail (the last goose off screen both ends).
                let x0 = direction > 0 ? -0.1 * size.width : 1.1 * size.width + trail
                let x1 = direction > 0 ? 1.1 * size.width + trail : -0.1 * size.width
                func leadAt(_ p: Double) -> CGPoint { CGPoint(x: lerp(x0, x1, p), y: top + sin(p * .pi * 2) * -0.012 * size.height) }
                if rare && still { continue }
                let group = CALayer()
                group.bounds = CGRect(x: 0, y: 0, width: 1, height: 1)
                group.allowsEdgeAntialiasing = true
                holder.addSublayer(group)
                for g in geese {
                    let l = CALayer()
                    l.bounds = CGRect(x: 0, y: 0, width: g.w, height: g.w / 2)
                    l.contents = img
                    l.contentsGravity = .resize
                    l.contentsScale = scale
                    l.allowsEdgeAntialiasing = true
                    l.anchorPoint = CGPoint(x: 0.5, y: 0.85)      // the body: the wings beat about it
                    l.position = CGPoint(x: g.x, y: g.y + g.w / 2 * 0.35)
                    group.addSublayer(l)
                    if still {
                        l.transform = CATransform3DMakeScale(CGFloat(direction), 1, 1)
                    } else {
                        let flapPhase = unit(g.k, 35 + Double(which))
                        let flap = { (f: Double) in 0.80 + 0.20 * sin(f * .pi * 2) }
                        let g0 = wrap(now / 1.1 + flapPhase)
                        l.transform = CATransform3DMakeScale(CGFloat(direction), CGFloat(flap(g0)), 1)
                        l.add(sampled("transform.scale.y", 12, 1.1, g0) { flap($0) }, forKey: "flap")
                    }
                }
                if still {
                    group.position = leadAt(0.5)
                    continue
                }
                if !rare {
                    let f0 = wrap(now / dur + unit(which, 34))
                    group.position = leadAt(f0)
                    group.add(sampled("position", 96, dur, f0) { NSValue(cgPoint: leadAt($0)) }, forKey: "cross")
                } else {
                    let cycle = dur * 3
                    var times: [NSNumber] = [], pts: [NSValue] = []
                    for j in 0...48 {
                        let p = Double(j) / 48
                        times.append(NSNumber(value: p / 3)); pts.append(NSValue(cgPoint: leadAt(p)))
                    }
                    times.append(1); pts.append(pts.last!)
                    let frac = wrap(now / cycle)
                    let pos = CAKeyframeAnimation(keyPath: "position")
                    pos.values = pts; pos.keyTimes = times; pos.calculationMode = .linear
                    let op = CAKeyframeAnimation(keyPath: "opacity")
                    let eps = 0.0005
                    op.values = [1, 1, 0, 0] as [Float]; op.keyTimes = [0, NSNumber(value: 1.0 / 3), NSNumber(value: 1.0 / 3 + eps), 1]; op.calculationMode = .linear
                    group.opacity = 0
                    group.add(loop(pos, cycle, frac), forKey: "cross")
                    group.add(loop(op, cycle, frac), forKey: "show")
                }
            }
        }
    }
}
