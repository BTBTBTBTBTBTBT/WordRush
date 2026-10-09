import SwiftUI

/// Living wallpapers (FRIDAY-QUEUE items 15 + 45): slow drifting things on a MENU page's wall. Letter tiles
/// (Default / Dark), bubbles (Ocean), leaves (Forest) and, while Seasonal is on, bats + a witch fly-by + fog + stars.
/// Never in a game board or a VS board (PageBackground only mounts it on menu tints). One Canvas on a ~30 fps
/// TimelineView, every position computed from the clock (no per-particle views, no state): compositor-cheap.
/// Static (the same picture, frozen) under Reduce Motion (OS or the in-app toggle), Low Power Mode and a hot
/// device; fewer particles on a warm one; off with the `living_wallpapers` switch.
struct LivingWallpaper: View {
    let theme: String
    let season: String?

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var flags = FlagsService.shared

    var body: some View {
        if flags.isLive("living_wallpapers") {
            let still = envReduce || Theme.reduceMotion || ProcessInfo.processInfo.isLowPowerModeEnabled
                || ProcessInfo.processInfo.thermalState.rawValue >= ProcessInfo.ThermalState.serious.rawValue
            let trim = ProcessInfo.processInfo.thermalState == .fair ? 0.6 : 1.0
            let paused = still || scenePhase != .active
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: paused)) { tl in
                Canvas(rendersAsynchronously: false) { ctx, size in
                    let t = still ? 0 : tl.date.timeIntervalSinceReferenceDate
                    if let s = ThemeKit.seasonal(season) {
                        drawSeasonal(&ctx, size, s.ambient, t, trim, still)
                    } else if let e = ThemeKit.entry(theme) {
                        drawTheme(&ctx, size, e.ambient, t, trim)
                    }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }

    // A deterministic 0...1 sequence (same as web theme-wall.tsx `unit`): the layout never changes between draws.
    private func unit(_ i: Int, _ salt: Double) -> Double {
        let x = sin(Double(i + 1) * 12.9898 + salt * 78.233) * 43758.5453
        return x - floor(x)
    }
    private func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }

    private func drawTheme(_ ctx: inout GraphicsContext, _ size: CGSize, _ a: ThemeKit.Ambient, _ t: Double, _ trim: Double) {
        let n = max(2, Int((Double(a.count) * trim).rounded()))
        let palette: [Color] = [Color(hex: 0x7C3AED), Color(hex: 0xEC4899), Color(hex: 0xF59E0B), Color(hex: 0x10B981), Color(hex: 0x3B82F6)]
        for i in 0..<n {
            let s = lerp(a.size[0], a.size[1], unit(i, 1))
            let dur = lerp(a.duration[0], a.duration[1], unit(i, 4))
            let phase = unit(i, 5)
            // `still`: t == 0 -> the phase alone places the particle (a frozen frame of the same picture).
            let f = (t / dur + phase).truncatingRemainder(dividingBy: 1)
            let sway = lerp(-18, 18, unit(i, 6)) / 100 * size.width
            let rot = lerp(-25, 25, unit(i, 7))
            let x = unit(i, 2) * 0.92 * size.width + sway * f
            let y: Double
            var angle = 0.0
            switch a.kind {
            case "leaves": y = lerp(-0.18, 1.12, f) * size.height; angle = rot * f
            case "bubbles": y = lerp(1.08, -0.22, f) * size.height
            default: y = lerp(1.08, -0.22, f) * size.height; angle = lerp(-rot, rot, f)
            }
            var c = ctx
            c.opacity = a.opacity
            c.translateBy(x: x + s / 2, y: y + s / 2)
            c.rotate(by: .degrees(angle))
            let rect = CGRect(x: -s / 2, y: -s / 2, width: s, height: s)
            if !a.sprites.isEmpty {
                c.draw(c.resolve(Image("ambient-\(a.sprites[i % a.sprites.count])")), in: rect)
            } else {
                let hue = palette[i % palette.count]
                c.fill(Path(roundedRect: rect, cornerRadius: s * 0.24), with: .linearGradient(
                    Gradient(colors: [hue.opacity(0.75), hue]), startPoint: CGPoint(x: 0, y: rect.minY), endPoint: CGPoint(x: 0, y: rect.maxY)))
                let letter = String(Array("WORDCISU")[i % 8])
                c.draw(c.resolve(Text(letter).font(.system(size: s * 0.55, weight: .black, design: .rounded)).foregroundColor(.white)), at: .zero)
            }
        }
    }

    private func drawSeasonal(_ ctx: inout GraphicsContext, _ size: CGSize, _ a: ThemeKit.SeasonalAmbient, _ t: Double, _ trim: Double, _ still: Bool) {
        // Stars twinkle in the upper half.
        let stars = Int((Double(a.stars.count) * trim).rounded())
        let starColor = Color(hexString: a.stars.color) ?? .yellow
        for i in 0..<stars {
            let dur = lerp(3, 7, unit(i, 13))
            let tw = still ? 0.8 : 0.2 + 0.75 * abs(sin(.pi * (t / dur + unit(i, 14))))
            let p = CGPoint(x: unit(i, 11) * 0.96 * size.width, y: unit(i, 12) * 0.55 * size.height)
            ctx.fill(Path(ellipseIn: CGRect(x: p.x, y: p.y, width: 3, height: 3)), with: .color(starColor.opacity(tw)))
        }
        // Fog drifting along the bottom.
        let fogImg = ctx.resolve(Image("ambient-\(a.fog.sprite)"))
        let fogW = size.width * 1.3
        let fogH = fogW * fogImg.size.height / max(fogImg.size.width, 1)
        let fp = still ? 0.5 : (1 + sin(t / a.fog.duration * .pi * 2)) / 2
        var fog = ctx
        fog.opacity = a.fog.opacity
        fog.draw(fogImg, in: CGRect(x: -size.width * 0.14 + fp * size.width * 0.1, y: size.height - fogH, width: fogW, height: fogH))
        // Bats cross the sky at their own heights.
        let bats = max(1, Int((Double(a.bats.count) * trim).rounded()))
        let batImg = ctx.resolve(Image("ambient-\(a.bats.sprite)"))
        for i in 0..<bats {
            let w = lerp(a.bats.size[0], a.bats.size[1], unit(i, 21))
            let h = w * 0.69
            let dur = lerp(a.bats.duration[0], a.bats.duration[1], unit(i, 23))
            let f = still ? 0.7 : (t / dur + unit(i, 24)).truncatingRemainder(dividingBy: 1)
            let x = lerp(-0.14, 1.16, f) * size.width
            let y = (0.06 + unit(i, 22) * 0.4) * size.height + sin(f * .pi * 4) * 14
            // A soft wingbeat (~1.7/s, each bat out of step): the wings squash toward the body and open again.
            let flap = still ? 1 : 0.78 + 0.22 * sin((t / 0.6 + unit(i, 25)) * .pi * 2)
            var bat = ctx
            bat.translateBy(x: x + w / 2, y: y + h / 2)
            bat.scaleBy(x: 1, y: flap)
            bat.draw(batImg, in: CGRect(x: -w / 2, y: -h / 2, width: w, height: h))
        }
        // The witch flies by once per `every` seconds (hidden while frozen).
        #if DEBUG
        // Visual check only: `debug-witch-moon` parks the witch mid moon pass.
        let parkOnMoon = UserDefaults.standard.bool(forKey: "debug-witch-moon")
        #else
        let parkOnMoon = false
        #endif
        if !still || parkOnMoon {
            let f = parkOnMoon ? 0.1 : (t / a.witch.every).truncatingRemainder(dividingBy: 1)
            if f < 0.2 {
                let p = f / 0.2
                let w = a.witch.size
                let img = ctx.resolve(Image("ambient-\(a.witch.sprite)"))
                let h = w * img.size.height / max(img.size.width, 1)
                var x = lerp(-0.24, 1.24, p) * size.width
                if parkOnMoon { x = WitchMoon.center(in: size).x - w / 2 }
                var y = size.height * 0.14 + sin(p * .pi) * -28
                // Every third pass she crosses the wall's own moon (a silhouette against it), on a gentle climb.
                if Int(t / a.witch.every) % 3 == 2 || parkOnMoon {
                    let moon = WitchMoon.center(in: size)
                    y = moon.y + (moon.x - (x + w / 2)) * 0.12 - h / 2
                }
                var c = ctx
                c.opacity = 0.95
                c.draw(img, in: CGRect(x: x, y: y, width: w, height: h))
            }
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
