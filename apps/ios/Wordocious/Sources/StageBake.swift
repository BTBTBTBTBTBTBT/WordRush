import SwiftUI
import UIKit
import CoreImage
import WordociousCore

// Founder 10-10 (smoothness, Leaderboard picker hitch): every static blurred / blended / masked / filtered layer behind
// the Leaderboard stage is drawn ONCE into a plain bitmap, so a game switch swaps two plain images instead of tearing
// down and rebuilding offscreen effects (RenderBox's shared surfaces — the main thread waited on them in
// CA::Context::commit_transaction, ~600 ms per switch in the Simulator).
//
//  - `StageBake`     the stage backdrop (accent wash + softLight sunburst + floor glow) per (accent, dark, season, size)
//  - `HueTint`       the candy sprites / inks pre-tinted to a game's hue (was a live `.hueRotation` animation)
//  - `StageGlowBake` the title row's blurred gold light
//
// Everything is plain Core Graphics (no SwiftUI render pass), so it runs off the main thread too.

// MARK: - Stage backdrop

enum StageBake {
    /// A pixel scale of 1.25 keeps the 8-bit bitmaps small (22 accents x ~1.4 MB) — the wash is a smooth gradient and the rays
    /// are soft, so the upsample is not visible.
    static let scale: CGFloat = 1.25

    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.totalCostLimit = 96 * 1024 * 1024
        return c
    }()
    private static let lock = NSLock()
    private static var inFlight: Set<String> = []

    struct Spec: Hashable {
        var rgba: [CGFloat]      // resolved accent
        var dark: Bool
        var season: String
        var w: Int
        var h: Int
        var key: String {
            "\(rgba.map { String(Int(($0 * 255).rounded())) }.joined(separator: "."))|\(dark ? "d" : "l")|\(season)|\(w)x\(h)"
        }
    }

    @MainActor static func spec(accent: Color, size: CGSize) -> Spec {
        let dark = Theme.isDark
        let ui = UIColor(accent).resolvedColor(with: UITraitCollection(userInterfaceStyle: dark ? .dark : .light))
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        return Spec(rgba: [r, g, b, a], dark: dark, season: CastSkin.season?.rawValue ?? "none",
                    w: max(1, Int(size.width.rounded())), h: max(1, Int(size.height.rounded())))
    }

    /// The cached bitmap, baking it now (a couple of milliseconds) on a miss.
    @MainActor static func image(_ spec: Spec) -> UIImage? {
        if let hit = peek(spec) { return hit }
        let img = render(spec)
        store(img, spec)
        return img
    }

    static func peek(_ spec: Spec) -> UIImage? {
        lock.lock(); defer { lock.unlock() }
        return cache.object(forKey: spec.key as NSString)
    }

    private static func store(_ img: UIImage, _ spec: Spec) {
        lock.lock(); defer { lock.unlock() }
        let cost = Int(img.size.width * img.size.height * scale * scale * 4)
        cache.setObject(img, forKey: spec.key as NSString, cost: cost)
    }

    /// Bakes every spec not yet cached on a utility thread (the Leaderboard's first appearance warms all 22 games).
    static func prewarm(_ specs: [Spec]) {
        let todo: [Spec] = {
            lock.lock(); defer { lock.unlock() }
            return specs.filter { cache.object(forKey: $0.key as NSString) == nil && inFlight.insert($0.key).inserted }
        }()
        guard !todo.isEmpty else { return }
        DispatchQueue.global(qos: .utility).async {
            for s in todo {
                let img = render(s)
                store(img, s)
                lock.lock(); inFlight.remove(s.key); lock.unlock()
            }
        }
    }

    /// Pure Core Graphics: the same layers LeaderboardStageBackdrop used to composite live.
    static func render(_ s: Spec) -> UIImage {
        let size = CGSize(width: s.w, height: s.h)
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = scale
        fmt.opaque = false
        fmt.preferredRange = .standard
        let accent = UIColor(red: s.rgba[0], green: s.rgba[1], blue: s.rgba[2], alpha: s.rgba[3])
        let w = CGFloat(s.w), h = CGFloat(s.h)
        return UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in
            let c = ctx.cgContext
            c.interpolationQuality = .high

            // 1. The sky wash: the accent at skyTop / skyMid / skyBottom down the height, times the mask that fades it in
            //    over the first 60 pt and out over the last 90 pt. Alpha is a function of y only: one 1-pt row at a time.
            func wash(_ t: CGFloat) -> CGFloat {
                let top = CGFloat(LeaderboardStage.skyTop), mid = CGFloat(LeaderboardStage.skyMid), bot = CGFloat(LeaderboardStage.skyBottom)
                return t <= 0.52 ? top + (mid - top) * (t / 0.52) : mid + (bot - mid) * ((t - 0.52) / 0.48)
            }
            func mask(_ y: CGFloat) -> CGFloat {
                var m: CGFloat = 1
                if y < 60 { m = min(m, y / 60) }
                if y > h - 90 { m = min(m, (h - y) / 90) }
                return max(0, m)
            }
            // One smooth gradient sampled every 2 pt (alpha = wash x mask), so there is no row banding.
            let cs0 = CGColorSpaceCreateDeviceRGB()
            var colors: [CGColor] = [], locs: [CGFloat] = []
            let steps = max(2, Int((h / 2).rounded(.up)))
            for i in 0...steps {
                let yy = min(h, CGFloat(i) * h / CGFloat(steps))
                colors.append(accent.withAlphaComponent(wash(yy / h) * mask(yy) * s.rgba[3]).cgColor)
                locs.append(yy / h)
            }
            if let g = CGGradient(colorsSpace: cs0, colors: colors as CFArray, locations: locs) {
                c.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: h), options: [])
            }

            // 2. The sunburst: the white rays art, soft-light blended at `rays`, 1.3x about the bottom centre.
            if let rays = UIImage(named: "art-lb-sunburst")?.cgImage {
                let dw = w * 1.3, dh = w * 0.5 * 1.3
                c.saveGState()
                // The live layer was soft-light blended with whatever the page shows under the stage (so a bitmap can't blend).
                // For WHITE rays, soft light over a backdrop B equals a plain white overlay of alpha rays * (D(B) - B) / (1 - B)
                // (D = the W3C soft-light curve): ~0.18 over the dark (night / Halloween) surfaces, ~0.34 over the light ones.
                let b: CGFloat = s.dark ? 0.13 : 0.88
                let d: CGFloat = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : b.squareRoot()
                c.setAlpha(CGFloat(LeaderboardStage.rays) * (d - b) / (1 - b))
                c.translateBy(x: 0, y: h)
                c.scaleBy(x: 1, y: -1)   // CGImage draws bottom-up
                c.draw(rays, in: CGRect(x: (w - dw) / 2, y: 0, width: dw, height: dh))
                c.restoreGState()
            }

            // 3. The floor glow: a radial wash up from the bottom centre (170 pt radius, 60 pt tall).
            c.saveGState()
            c.clip(to: CGRect(x: 0, y: h - 60, width: w, height: 60))
            let cs = CGColorSpaceCreateDeviceRGB()
            let stops = [accent.withAlphaComponent(CGFloat(LeaderboardStage.floorGlow) * s.rgba[3]).cgColor,
                         accent.withAlphaComponent(0).cgColor]
            if let grad = CGGradient(colorsSpace: cs, colors: stops as CFArray, locations: [0, 1]) {
                c.drawRadialGradient(grad, startCenter: CGPoint(x: w / 2, y: h), startRadius: 0,
                                     endCenter: CGPoint(x: w / 2, y: h), endRadius: 170, options: [])
            }
            c.restoreGState()
        }
    }
}

// MARK: - Cloud bank (mask baked in)

enum StageCloudBake {
    private static var cached: UIImage?

    /// `art-lb-clouds` at 0.85 opacity with the vertical fade mask (clear 0, solid .22-.6, clear .92) multiplied in, once.
    @MainActor static var image: UIImage? {
        if let cached { return cached }
        guard let art = UIImage(named: "art-lb-clouds") else { return nil }
        let size = art.size
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = art.scale
        fmt.opaque = false
        fmt.preferredRange = .standard
        let img = UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in
            let c = ctx.cgContext
            art.draw(in: CGRect(origin: .zero, size: size), blendMode: .normal, alpha: 0.85)
            // multiply by the mask: destinationIn keeps the art where the gradient is opaque
            c.setBlendMode(.destinationIn)
            let cs = CGColorSpaceCreateDeviceRGB()
            let colors = [UIColor(white: 0, alpha: 0).cgColor, UIColor.black.cgColor, UIColor.black.cgColor, UIColor(white: 0, alpha: 0).cgColor]
            if let g = CGGradient(colorsSpace: cs, colors: colors as CFArray, locations: [0, 0.22, 0.6, 0.92]) {
                c.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [.drawsAfterEndLocation])
            }
        }
        cached = img
        return img
    }
}

// MARK: - Hue-tinted candy (replaces the live hueRotation)

private struct CandyHueKey: EnvironmentKey { static let defaultValue: Angle = .zero }

extension EnvironmentValues {
    /// The hue turn the candy sprites + inks inside wear (the Leaderboard's controls follow the selected game's color).
    var candyHue: Angle {
        get { self[CandyHueKey.self] }
        set { self[CandyHueKey.self] = newValue }
    }
}

enum HueTint {
    /// The standard hue-rotate color matrix (what `.hueRotation` applies), row-major 3x3.
    static func matrix(_ angle: Angle) -> [CGFloat] {
        let r = angle.radians, cs = CGFloat(cos(r)), sn = CGFloat(sin(r))
        return [
            0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
            0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
            0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072,
        ]
    }

    /// One color turned through the hue (its alpha kept).
    static func color(_ color: Color, _ angle: Angle) -> Color {
        guard abs(angle.degrees) > 0.01 else { return color }
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        let m = matrix(angle)
        func clamp(_ v: CGFloat) -> Double { Double(min(1, max(0, v))) }
        return Color(.sRGB, red: clamp(m[0] * r + m[1] * g + m[2] * b), green: clamp(m[3] * r + m[4] * g + m[5] * b),
                     blue: clamp(m[6] * r + m[7] * g + m[8] * b), opacity: Double(a))
    }

    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>(); c.countLimit = 120; return c
    }()

    /// `image` with every pixel's color turned through the hue (alpha kept), cached under `key` + the angle.
    static func image(_ image: UIImage, key: String, _ angle: Angle) -> UIImage {
        guard abs(angle.degrees) > 0.01, let cg = image.cgImage else { return image }
        let k = "\(key)|\(Int((angle.degrees * 2).rounded()))" as NSString
        if let hit = cache.object(forKey: k) { return hit }
        let w = cg.width, h = cg.height
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return image }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        let m = matrix(angle)
        for i in stride(from: 0, to: px.count, by: 4) {
            let a = CGFloat(px[i + 3]) / 255
            guard a > 0 else { continue }
            let r = CGFloat(px[i]) / 255 / a, g = CGFloat(px[i + 1]) / 255 / a, b = CGFloat(px[i + 2]) / 255 / a
            func out(_ v: CGFloat) -> UInt8 { UInt8(max(0, min(255, (min(1, max(0, v)) * a * 255).rounded()))) }
            px[i] = out(m[0] * r + m[1] * g + m[2] * b)
            px[i + 1] = out(m[3] * r + m[4] * g + m[5] * b)
            px[i + 2] = out(m[6] * r + m[7] * g + m[8] * b)
        }
        guard let tinted = ctx.makeImage() else { return image }
        let out = UIImage(cgImage: tinted, scale: image.scale, orientation: .up)
        cache.setObject(out, forKey: k)
        return out
    }
}

// MARK: - Title glow (the blurred gold light)

enum StageGlowBake {
    private static var cache: [String: UIImage] = [:]

    /// The gold light behind the title: a radial gradient in the (w+48) x (h+48) rect, scaled 1.25 x .75 about its centre and
    /// blurred by 10 — as ONE bitmap `pad` points larger than the scaled rect on every side (the blur's spread).
    @MainActor static func image(size: CGSize) -> (image: UIImage, outset: CGSize)? {
        let w = (size.width + 48) * 1.25, h = (size.height + 48) * 0.75
        guard w > 8, h > 8 else { return nil }
        let pad: CGFloat = 36
        let key = "\(Int(w.rounded()))x\(Int(h.rounded()))"
        let outset = CGSize(width: pad, height: pad)
        if let hit = cache[key] { return (hit, outset) }
        let total = CGSize(width: w + pad * 2, height: h + pad * 2)
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1.5
        fmt.opaque = false
        fmt.preferredRange = .standard
        // 1. the scaled gradient rect (the gradient is scaled with it: an ellipse 262 x 157 pt about the centre)
        let base = UIGraphicsImageRenderer(size: total, format: fmt).image { ctx in
            let c = ctx.cgContext
            c.clip(to: CGRect(x: pad, y: pad, width: w, height: h))
            c.translateBy(x: total.width / 2, y: total.height / 2)
            c.scaleBy(x: 1.25, y: 0.75)
            let colors = [UIColor(red: 1, green: 0.851, blue: 0.471, alpha: 0.62).cgColor,
                          UIColor(red: 1, green: 0.690, blue: 0.290, alpha: 0.22).cgColor,
                          UIColor(red: 1, green: 0.690, blue: 0.290, alpha: 0).cgColor]
            if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 0.5, 1]) {
                // RadialGradient: startRadius 4 .. endRadius 210; two stops after the first are spread evenly
                c.drawRadialGradient(g, startCenter: .zero, startRadius: 4, endCenter: .zero, endRadius: 210, options: [])
            }
        }
        // 2. the blur (sigma 10 pt = 15 px at 1.5x)
        guard let cg = base.cgImage else { return nil }
        let ci = CIImage(cgImage: cg)
        let blurred = ci.clampedToExtent().applyingGaussianBlur(sigma: 10 * 1.5).cropped(to: ci.extent)
        let context = CIContext(options: [.workingColorSpace: NSNull()])
        guard let out = context.createCGImage(blurred, from: ci.extent) else { return nil }
        let img = UIImage(cgImage: out, scale: 1.5, orientation: .up)
        cache[key] = img
        return (img, outset)
    }
}
