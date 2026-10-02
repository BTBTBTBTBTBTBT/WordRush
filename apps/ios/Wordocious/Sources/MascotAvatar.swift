import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

// FINISH_SPEC §AN1 / §AN2 / §AN5 — the build-your-own-mascot renderer (iOS).
//
// ONE shared view draws every player mascot at any size (16–200 pt): a tinted
// rounded-square stage (the §AN6 tile shape) with the layered mascot on it, back →
// front: frame back (the stage), cape-type accessory, the body (white art ×
// the color by MULTIPLY so the gloss survives), the pattern (clipped to the body
// alpha, multiplied with it), the player's INITIAL as the white body letter
// (Nunito Black, soft emboss + shadow like the cast letters, in the manifest's
// letterBox), cheeks / nose, eyes, mouth, face accessory, head accessory, front
// frame. ≤ 28 pt drops the pattern + every accessory except hats.
//
// The art (art-av-body-<shape>, art-av-eyes-<id>, art-av-mouth-<id>,
// art-av-nose-<id>, art-av-acc-<id>) is used automatically once it ships; until
// then every part is a simple code-drawn placeholder. Anchors come from the
// bundled avatar-parts.json (AvatarParts, a placeholder the coordinator replaces).

/// The bundled part manifest + art lookups.
enum MascotParts {
    static let manifest: AvatarParts = {
        guard let url = Bundle.main.url(forResource: "avatar-parts", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let parts = try? AvatarParts.decode(data) else { return .builtIn }
        return parts
    }()

    /// The art set for a part when it has shipped ("body", "eyes", "mouth", "nose", "acc"), else nil.
    static func art(_ kind: String, _ id: String) -> String? {
        guard id != "none" else { return nil }
        let name = "art-av-\(kind)-\(id)"
        return ArtAsset.exists(name) ? name : nil
    }

    /// Below this size the pattern and every non-hat accessory drop out (§AN5).
    static let smallSize: CGFloat = 28

    /// Neck / back extras drawn BEHIND the body.
    static let behind: Set<String> = ["cape", "wings"]
}

// MARK: - The view

/// A player's mascot avatar. Decorative (the row / button around it carries the
/// name). `cached` composes small avatars once per config + size into a bitmap
/// (lists scroll smoothly); the builder's live preview passes false.
struct MascotAvatar: View {
    let config: AvatarConfig
    let initial: String
    var size: CGFloat = 40
    var cached: Bool = true
    /// Share images are always light (ShareKit).
    var alwaysLight: Bool = false

    @Environment(\.displayScale) private var displayScale

    init(config: AvatarConfig, initial: String, size: CGFloat = 40, cached: Bool = true, alwaysLight: Bool = false) {
        self.config = config
        self.initial = initial
        self.size = size
        self.cached = cached
        self.alwaysLight = alwaysLight
    }

    var body: some View {
        let dark = Theme.isDark && !alwaysLight
        let s = min(240, max(12, size))
        Group {
            #if canImport(UIKit)
            let useCache = cached && s <= 96
            let key = "\(config.cacheKey)|\(initial)|\(Int(s * 4))|\(dark ? 1 : 0)|\(Int(displayScale))"
            if useCache, let img = MascotImageCache.image(key) {
                Image(uiImage: img).resizable().interpolation(.high).frame(width: s, height: s)
            } else {
                MascotComposition(config: config, initial: initial, size: s, dark: dark)
                    .onAppear {
                        guard useCache else { return }
                        MascotImageCache.store(key, scale: displayScale) {
                            MascotComposition(config: config, initial: initial, size: s, dark: dark)
                        }
                    }
            }
            #else
            MascotComposition(config: config, initial: initial, size: s, dark: dark)
            #endif
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

#if canImport(UIKit)
/// Composed mascot bitmaps per config + initial + size + theme (§AN5 "cache composed bitmaps").
@MainActor
enum MascotImageCache {
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 400
        return c
    }()

    static func image(_ key: String) -> UIImage? { cache.object(forKey: key as NSString) }

    private static var pending: [(key: String, render: () -> UIImage?)] = []
    private static var queued: Set<String> = []
    private static var draining = false

    /// Queue a composition to be rendered into the cache. Renders run a few per
    /// main-loop turn, so a long list appearing at once never hitches.
    static func store<V: View>(_ key: String, scale: CGFloat, @ViewBuilder _ content: () -> V) {
        guard cache.object(forKey: key as NSString) == nil, !queued.contains(key) else { return }
        let view = content()
        let s = max(1, scale)
        queued.insert(key)
        pending.append((key, {
            let renderer = ImageRenderer(content: view)
            renderer.scale = s
            renderer.isOpaque = false
            return renderer.uiImage
        }))
        scheduleDrain()
    }

    private static func scheduleDrain() {
        guard !draining else { return }
        draining = true
        Task { @MainActor in
            await Task.yield()
            let batch = pending.prefix(4)
            pending.removeFirst(batch.count)
            for job in batch {
                if let img = job.render() { cache.setObject(img, forKey: job.key as NSString) }
                queued.remove(job.key)
            }
            draining = false
            if !pending.isEmpty { scheduleDrain() }
        }
    }

    /// New art landed / a manifest swap: drop everything.
    static func clear() { cache.removeAllObjects() }
}
#endif

/// The full avatar box: stage (frame back) + mascot + front frame.
struct MascotComposition: View {
    let config: AvatarConfig
    let initial: String
    let size: CGFloat
    let dark: Bool

    var body: some View {
        let framed = config.frame != "none"
        let inner = framed ? size - AvatarCastArt.frameWidth(size) * 2 : size
        let hasHat = config.head != "none"
        let u = inner * (hasHat ? 0.76 : 0.86)
        let top = inner * (hasHat ? 0.21 : 0.09)
        let base = Color(hex: AvatarCatalog.colorValue(config.color))
        let shape = AvatarOutline(tile: true)
        let small = size <= MascotParts.smallSize
        ZStack {
            ZStack {
                MascotBackdrop(bg: config.bg, base: base, dark: dark)
                Canvas { ctx, _ in
                    MascotPainter.paint(ctx, u: u, config: config, initial: initial, small: small)
                }
                .frame(width: u, height: u)
                .position(x: inner / 2, y: top + u / 2)
            }
            .frame(width: inner, height: inner)
            .clipShape(shape)
            .overlay(framed ? nil : shape.strokeBorder(base.opacity(dark ? 0.55 : 0.32), lineWidth: max(1, size * 0.03)))
            if framed { MascotFrame(frame: config.frame, size: size) }
        }
        .frame(width: size, height: size)
    }
}

/// The front frame: a level-tier frame (art or the code-drawn metal) or the Pro
/// gold frame with the tiny crown (§AA2 / §AN6 — rounded squares, never rings).
struct MascotFrame: View {
    let frame: String
    let size: CGFloat

    var body: some View {
        if frame == "pro" {
            let w = AvatarCastArt.frameWidth(size)
            ZStack {
                AvatarOutline(tile: true)
                    .strokeBorder(LinearGradient(colors: [Color(hex: 0xFFE08A), Color(hex: 0xF5A524), Color(hex: 0xD97706), Color(hex: 0xFFE08A)],
                                                 startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: w)
                AvatarOutline(tile: true, inset: w).strokeBorder(Color.white.opacity(0.45), lineWidth: max(0.5, w * 0.18))
            }
            .frame(width: size, height: size)
            .overlay(alignment: .topTrailing) {
                ProCrownSprite(size: size * 0.35)
                    .rotationEffect(.degrees(14))
                    .offset(x: size * 0.10, y: -size * 0.13)
            }
            .allowsHitTesting(false).accessibilityHidden(true)
        } else {
            AvatarFrameRing(frame: frame, size: size)
        }
    }
}

// MARK: - Painter (one Canvas per mascot)

enum MascotPainter {
    /// Feature ink (eyes, mouths): a deep purple-black like the cast's beady eyes.
    static let ink = Color(hex: 0x22113D)
    static let pink = Color(hex: 0xFF5C93)
    static let gold = Color(hex: 0xF5B82E)
    static let goldDeep = Color(hex: 0xB0650B)

    // MARK: Entry

    static func paint(_ ctx: GraphicsContext, u: CGFloat, config c: AvatarConfig, initial: String, small: Bool) {
        let a = MascotParts.manifest.body(c.body)
        let base = Color(hex: AvatarCatalog.colorValue(c.color))
        let rect = CGRect(x: 0, y: 0, width: u, height: u)

        // Cape-type accessories (behind the body): cape, wings.
        if !small && MascotParts.behind.contains(c.neck) {
            if let art = MascotParts.art("acc", c.neck) { drawArt(ctx, art, cx: a.faceX * u, cy: a.neckY * u, w: partW("neck", u) * 1.6) }
            else if c.neck == "wings" { wings(ctx, u: u, a: a) }
            else { cape(ctx, u: u, a: a) }
        }

        // Body: the white art (or the placeholder silhouette in white / light grey).
        let bodyArt = MascotParts.art("body", c.body)
        let pieces = silhouette(c.body, u: u)
        if let bodyArt {
            ctx.draw(Image(bodyArt), in: rect)
        } else {
            for (i, p) in pieces.enumerated() {
                let shade: [Color] = i == pieces.count - 1
                    ? [.white, Color(hex: 0xECE8F4), Color(hex: 0xC9C1DA)]
                    : [Color(hex: 0xE4DEEE), Color(hex: 0xBDB4D0)]
                ctx.fill(p, with: .linearGradient(Gradient(colors: shade), startPoint: CGPoint(x: u * 0.5, y: p.boundingRect.minY),
                                                  endPoint: CGPoint(x: u * 0.5, y: p.boundingRect.maxY)))
            }
        }

        // Paint: the color (+ pattern in its own color), clipped to the body alpha,
        // MULTIPLIED onto the white body so the shading survives.
        var paint = ctx
        paint.blendMode = .multiply
        paint.drawLayer { layer in
            if let bodyArt {
                layer.clipToLayer { $0.draw(Image(bodyArt), in: rect) }
            } else {
                layer.clipToLayer { l in for p in pieces { l.fill(p, with: .color(.black)) } }
            }
            layer.fill(Path(rect), with: .color(base))
            if !small { pattern(layer, c.pattern, ink: patternInk(c), base: base, u: u) }
        }

        // Placeholder gloss + edge (real art carries its own).
        if bodyArt == nil, let main = pieces.last {
            ctx.drawLayer { g in
                g.clip(to: main)
                let b = main.boundingRect
                g.fill(Path(ellipseIn: CGRect(x: b.minX + b.width * 0.12, y: b.minY + b.height * 0.04,
                                               width: b.width * 0.5, height: b.height * 0.26)),
                       with: .color(.white.opacity(0.42)))
            }
            ctx.stroke(main, with: .color(Color.black.mixed(over: base, 0.38).opacity(0.55)), lineWidth: max(0.6, u * 0.014))
        }

        // The white body letter (the player's initial) in the letterBox.
        letter(ctx, initial, a: a, u: u, base: base)

        // Neck-front accessories (bow tie, flower).
        if !small && c.neck != "none" && !MascotParts.behind.contains(c.neck) {
            if let art = MascotParts.art("acc", c.neck) { drawArt(ctx, art, cx: a.faceX * u, cy: a.neckY * u, w: partW("neck", u)) }
            else { neck(ctx, c.neck, a: a, u: u) }
        }

        // Cheeks / nose.
        if c.nose != "none" {
            if let art = MascotParts.art("nose", c.nose) { drawArt(ctx, art, cx: a.faceX * u, cy: slotY("nose", a, u), w: partW("nose", u)) }
            else { nose(ctx, c.nose, a: a, u: u) }
        }
        // Eyes.
        if let art = MascotParts.art("eyes", c.eyes) { drawArt(ctx, art, cx: a.faceX * u, cy: slotY("eyes", a, u), w: partW("eyes", u)) }
        else { eyes(ctx, c.eyes, a: a, u: u) }
        // Mouth.
        if let art = MascotParts.art("mouth", c.mouth) { drawArt(ctx, art, cx: a.faceX * u, cy: slotY("mouth", a, u), w: partW("mouth", u)) }
        else { mouth(ctx, c.mouth, a: a, u: u) }
        // Face accessory.
        if !small && c.face != "none" {
            if let art = MascotParts.art("acc", c.face) { drawArt(ctx, art, cx: a.faceX * u, cy: slotY("face", a, u), w: partW("face", u)) }
            else { face(ctx, c.face, a: a, u: u) }
        }
        // Head accessory (kept at every size).
        if c.head != "none" {
            let w = a.headTop.w * u * MascotParts.manifest.part("head").scale
            if let art = MascotParts.art("acc", c.head) { drawArt(ctx, art, cx: a.headTop.x * u, cy: a.headTop.y * u, w: w) }
            else { head(ctx, c.head, x: a.headTop.x * u, y: a.headTop.y * u, w: w) }
        }
    }

    // MARK: Helpers

    private static func slotY(_ kind: String, _ a: AvatarParts.Body, _ u: CGFloat) -> CGFloat {
        a.y(slot: MascotParts.manifest.part(kind).slot) * u
    }

    private static func partW(_ kind: String, _ u: CGFloat) -> CGFloat { MascotParts.manifest.part(kind).scale * u }

    /// Draws a part's art centered on its anchor at width `w` (aspect kept).
    private static func drawArt(_ ctx: GraphicsContext, _ name: String, cx: CGFloat, cy: CGFloat, w: CGFloat) {
        let img = ctx.resolve(Image(name))
        let sz = img.size
        let h = sz.width > 0 ? w * sz.height / sz.width : w
        ctx.draw(img, in: CGRect(x: cx - w / 2, y: cy - h / 2, width: w, height: h))
    }

    private static func patternInk(_ c: AvatarConfig) -> Color {
        let base = Color(hex: AvatarCatalog.colorValue(c.color))
        if c.patternColor == c.color {
            // Same color: a lighter tint of it so the pattern still reads.
            return Color.white.mixed(over: base, c.pattern == "gradient" ? 0.0 : 0.5)
        }
        return Color(hex: AvatarCatalog.colorValue(c.patternColor))
    }

    private static func circle(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
    }

    private static func oval(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: x - w / 2, y: y - h / 2, width: w, height: h))
    }

    private static func heart(_ x: CGFloat, _ y: CGFloat, _ s: CGFloat) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: x, y: y + 0.4 * s))
        p.addCurve(to: CGPoint(x: x - 0.5 * s, y: y - 0.05 * s), control1: CGPoint(x: x - 0.15 * s, y: y + 0.25 * s), control2: CGPoint(x: x - 0.5 * s, y: y + 0.15 * s))
        p.addCurve(to: CGPoint(x: x, y: y - 0.22 * s), control1: CGPoint(x: x - 0.5 * s, y: y - 0.42 * s), control2: CGPoint(x: x - 0.06 * s, y: y - 0.45 * s))
        p.addCurve(to: CGPoint(x: x + 0.5 * s, y: y - 0.05 * s), control1: CGPoint(x: x + 0.06 * s, y: y - 0.45 * s), control2: CGPoint(x: x + 0.5 * s, y: y - 0.42 * s))
        p.addCurve(to: CGPoint(x: x, y: y + 0.4 * s), control1: CGPoint(x: x + 0.5 * s, y: y + 0.15 * s), control2: CGPoint(x: x + 0.15 * s, y: y + 0.25 * s))
        p.closeSubpath()
        return p
    }

    private static func star(_ x: CGFloat, _ y: CGFloat, outer: CGFloat, inner: CGFloat, points: Int = 5) -> Path {
        var p = Path()
        for i in 0..<(points * 2) {
            let r = i % 2 == 0 ? outer : inner
            let ang = -Double.pi / 2 + Double(i) * Double.pi / Double(points)
            let pt = CGPoint(x: x + r * CGFloat(cos(ang)), y: y + r * CGFloat(sin(ang)))
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }

    /// A curve from a to b bowing through `bow` (positive = down), as a quad.
    private static func curve(_ a: CGPoint, _ b: CGPoint, control: CGPoint) -> Path {
        var p = Path()
        p.move(to: a)
        p.addQuadCurve(to: b, control: control)
        return p
    }

    private static func round(_ w: CGFloat) -> StrokeStyle { StrokeStyle(lineWidth: w, lineCap: .round, lineJoin: .round) }

    // MARK: Body silhouettes (placeholders)

    /// The placeholder body: feet + arms first, the main body LAST.
    static func silhouette(_ kind: String, u: CGFloat) -> [Path] {
        func r(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect { CGRect(x: x * u, y: y * u, width: w * u, height: h * u) }
        var main: Path
        var left: CGFloat = 0.1, right: CGFloat = 0.9, bottom: CGFloat = 0.9, armY: CGFloat = 0.6
        switch kind {
        case "tall":
            main = RoundedRectangle(cornerRadius: u * 0.2, style: .continuous).path(in: r(0.22, 0.04, 0.56, 0.86))
            left = 0.22; right = 0.78; bottom = 0.9; armY = 0.56
        case "wide":
            main = RoundedRectangle(cornerRadius: u * 0.26, style: .continuous).path(in: r(0.04, 0.14, 0.92, 0.74))
            left = 0.04; right = 0.96; bottom = 0.88; armY = 0.6
        case "blob":
            var p = Path()
            p.move(to: CGPoint(x: 0.5 * u, y: 0.08 * u))
            p.addCurve(to: CGPoint(x: 0.93 * u, y: 0.55 * u), control1: CGPoint(x: 0.8 * u, y: 0.06 * u), control2: CGPoint(x: 0.96 * u, y: 0.3 * u))
            p.addCurve(to: CGPoint(x: 0.5 * u, y: 0.9 * u), control1: CGPoint(x: 0.9 * u, y: 0.8 * u), control2: CGPoint(x: 0.74 * u, y: 0.9 * u))
            p.addCurve(to: CGPoint(x: 0.07 * u, y: 0.55 * u), control1: CGPoint(x: 0.26 * u, y: 0.9 * u), control2: CGPoint(x: 0.1 * u, y: 0.8 * u))
            p.addCurve(to: CGPoint(x: 0.5 * u, y: 0.08 * u), control1: CGPoint(x: 0.04 * u, y: 0.3 * u), control2: CGPoint(x: 0.2 * u, y: 0.06 * u))
            p.closeSubpath()
            main = p
            left = 0.07; right = 0.93; bottom = 0.9; armY = 0.6
        case "bean":
            let cap = Capsule(style: .continuous).path(in: r(0.22, 0.04, 0.56, 0.86))
            let t = CGAffineTransform(translationX: 0.5 * u, y: 0.47 * u).rotated(by: 0.14).translatedBy(x: -0.5 * u, y: -0.47 * u)
            main = cap.applying(t)
            left = 0.2; right = 0.82; bottom = 0.9; armY = 0.56
        case "star":
            let cx = 0.5 * u, cy = 0.52 * u
            var pts: [CGPoint] = []
            for i in 0..<10 {
                let rr = (i % 2 == 0 ? 0.47 : 0.3) * u
                let ang = -Double.pi / 2 + Double(i) * Double.pi / 5
                pts.append(CGPoint(x: cx + rr * CGFloat(cos(ang)), y: cy + rr * CGFloat(sin(ang))))
            }
            var p = Path()
            func mid(_ a: CGPoint, _ b: CGPoint) -> CGPoint { CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2) }
            p.move(to: mid(pts[9], pts[0]))
            for i in 0..<10 { p.addQuadCurve(to: mid(pts[i], pts[(i + 1) % 10]), control: pts[i]) }
            p.closeSubpath()
            main = p
            return [oval(0.38 * u, 0.9 * u, 0.18 * u, 0.09 * u), oval(0.62 * u, 0.9 * u, 0.18 * u, 0.09 * u), main]
        default: // classic
            main = RoundedRectangle(cornerRadius: u * 0.26, style: .continuous).path(in: r(0.1, 0.06, 0.8, 0.82))
            left = 0.1; right = 0.9; bottom = 0.88; armY = 0.6
        }
        let footW = 0.2 * u, footH = 0.1 * u
        let span = right - left
        let feet = [oval((left + span * 0.3) * u, bottom * u, footW, footH), oval((right - span * 0.3) * u, bottom * u, footW, footH)]
        let arms = [oval((left + 0.01) * u, armY * u, 0.12 * u, 0.18 * u), oval((right - 0.01) * u, armY * u, 0.12 * u, 0.18 * u)]
        return feet + arms + [main]
    }

    // MARK: Patterns (drawn inside the paint layer, already clipped to the body)

    static func pattern(_ g: GraphicsContext, _ kind: String, ink: Color, base: Color, u: CGFloat) {
        switch kind {
        case "twotone":
            g.fill(Path(CGRect(x: 0, y: u * 0.56, width: u, height: u * 0.44)), with: .color(ink))
        case "stripes":
            var y = u * 0.1
            while y < u {
                g.fill(Path(CGRect(x: 0, y: y, width: u, height: u * 0.065)), with: .color(ink))
                y += u * 0.15
            }
        case "dots":
            var row = 0
            var y = u * 0.12
            while y < u {
                var x = row % 2 == 0 ? u * 0.12 : u * 0.22
                while x < u { g.fill(circle(x, y, u * 0.045), with: .color(ink)); x += u * 0.2 }
                y += u * 0.16; row += 1
            }
        case "gradient":
            g.fill(Path(CGRect(x: 0, y: 0, width: u, height: u)),
                   with: .linearGradient(Gradient(colors: [ink.opacity(0), ink]), startPoint: CGPoint(x: u / 2, y: u * 0.2), endPoint: CGPoint(x: u / 2, y: u * 0.92)))
        case "sparkle":
            let spots: [(CGFloat, CGFloat, CGFloat)] = [(0.22, 0.22, 0.05), (0.72, 0.18, 0.04), (0.84, 0.46, 0.05), (0.16, 0.56, 0.04),
                                                        (0.5, 0.3, 0.03), (0.32, 0.8, 0.05), (0.7, 0.74, 0.04), (0.58, 0.9, 0.03)]
            for (x, y, r) in spots { g.fill(star(x * u, y * u, outer: r * u, inner: r * u * 0.35, points: 4), with: .color(ink)) }
        default:
            break
        }
    }

    // MARK: Letter

    static func letter(_ ctx: GraphicsContext, _ initial: String, a: AvatarParts.Body, u: CGFloat, base: Color) {
        let lb = a.letterBox
        guard lb.count >= 4 else { return }
        let box = CGRect(x: lb[0] * u, y: lb[1] * u, width: lb[2] * u, height: lb[3] * u)
        let glyph = String(initial.prefix(1)).uppercased()
        let wide = glyph == "W" || glyph == "M"
        let fontSize = min(box.height * 1.08, box.width * (wide ? 0.95 : 1.15))
        let text = Text(glyph).font(Brand.fixedFont(fontSize, .black)).foregroundColor(.white)
        let center = CGPoint(x: box.midX, y: box.midY)
        let deep = Color.black.mixed(over: base, 0.45)
        var l = ctx
        // Soft emboss: a deep drop under the glyph + a faint glow, like the cast letters.
        l.addFilter(.shadow(color: deep.opacity(0.55), radius: max(0.5, u * 0.012), x: 0, y: max(0.5, u * 0.022)))
        l.draw(text, at: center, anchor: .center)
        var hi = ctx
        hi.opacity = 0.35
        hi.draw(Text(glyph).font(Brand.fixedFont(fontSize, .black)).foregroundColor(.white),
                at: CGPoint(x: center.x, y: center.y - max(0.4, u * 0.006)), anchor: .center)
    }

    // MARK: Eyes

    static func eyes(_ g: GraphicsContext, _ id: String, a: AvatarParts.Body, u: CGFloat) {
        let cx = a.faceX * u
        let cy = a.y(slot: MascotParts.manifest.part("eyes").slot) * u
        let w = MascotParts.manifest.part("eyes").scale * u
        let dx = w * 0.25
        let r = w * 0.1
        func beady(_ x: CGFloat) {
            g.fill(oval(x, cy, r * 1.7, r * 2.1), with: .color(ink))
            g.fill(circle(x - r * 0.3, cy - r * 0.4, r * 0.32), with: .color(.white))
        }
        func happyArc(_ x: CGFloat) {
            g.stroke(curve(CGPoint(x: x - r, y: cy + r * 0.4), CGPoint(x: x + r, y: cy + r * 0.4), control: CGPoint(x: x, y: cy - r * 1.2)),
                     with: .color(ink), style: round(r * 0.6))
        }
        switch id {
        case "happy":
            happyArc(cx - dx); happyArc(cx + dx)
        case "sparkly":
            for x in [cx - dx, cx + dx] {
                g.fill(oval(x, cy, r * 2.3, r * 2.6), with: .color(ink))
                g.fill(circle(x - r * 0.4, cy - r * 0.5, r * 0.45), with: .color(.white))
                g.fill(circle(x + r * 0.35, cy + r * 0.45, r * 0.22), with: .color(.white))
            }
        case "sleepy":
            for x in [cx - dx, cx + dx] {
                g.stroke(curve(CGPoint(x: x - r, y: cy), CGPoint(x: x + r, y: cy), control: CGPoint(x: x, y: cy + r * 1.1)),
                         with: .color(ink), style: round(r * 0.55))
            }
        case "wink":
            beady(cx - dx); happyArc(cx + dx)
        case "hearts":
            for x in [cx - dx, cx + dx] {
                g.fill(heart(x, cy, r * 2.6), with: .color(pink))
                g.fill(circle(x - r * 0.45, cy - r * 0.35, r * 0.25), with: .color(.white.opacity(0.85)))
            }
        case "stars":
            for x in [cx - dx, cx + dx] {
                let s = star(x, cy, outer: r * 1.45, inner: r * 0.65)
                g.fill(s, with: .color(gold))
                g.stroke(s, with: .color(goldDeep), style: round(max(0.5, r * 0.18)))
            }
        case "glasses":
            beady(cx - dx); beady(cx + dx)
            let rr = r * 1.85
            g.stroke(circle(cx - dx, cy, rr), with: .color(ink), lineWidth: max(0.6, r * 0.38))
            g.stroke(circle(cx + dx, cy, rr), with: .color(ink), lineWidth: max(0.6, r * 0.38))
            g.stroke(curve(CGPoint(x: cx - dx + rr, y: cy - r * 0.2), CGPoint(x: cx + dx - rr, y: cy - r * 0.2), control: CGPoint(x: cx, y: cy - r * 0.8)),
                     with: .color(ink), style: round(max(0.6, r * 0.32)))
        case "cyclops":
            g.fill(oval(cx, cy, r * 4.2, r * 3.8), with: .color(.white))
            g.stroke(oval(cx, cy, r * 4.2, r * 3.8), with: .color(ink), lineWidth: max(0.6, r * 0.3))
            g.fill(circle(cx, cy + r * 0.1, r * 1.25), with: .color(ink))
            g.fill(circle(cx - r * 0.45, cy - r * 0.4, r * 0.4), with: .color(.white))
        default: // beady
            beady(cx - dx); beady(cx + dx)
        }
    }

    // MARK: Mouth

    static func mouth(_ g: GraphicsContext, _ id: String, a: AvatarParts.Body, u: CGFloat) {
        let cx = a.faceX * u
        let cy = a.y(slot: MascotParts.manifest.part("mouth").slot) * u
        let m = MascotParts.manifest.part("mouth").scale * u
        let hw = m / 2
        let line = max(0.7, m * 0.12)
        func dShape(_ depth: CGFloat) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: cx - hw, y: cy - m * 0.12))
            p.addLine(to: CGPoint(x: cx + hw, y: cy - m * 0.12))
            p.addQuadCurve(to: CGPoint(x: cx - hw, y: cy - m * 0.12), control: CGPoint(x: cx, y: cy + m * depth))
            p.closeSubpath()
            return p
        }
        switch id {
        case "grin":
            let d = dShape(0.9)
            g.fill(d, with: .color(ink))
            var t = g
            t.clip(to: d)
            t.fill(oval(cx, cy + m * 0.3, hw * 0.9, m * 0.3), with: .color(pink))
        case "tongue":
            g.fill(oval(cx + hw * 0.15, cy + m * 0.2, hw * 0.55, m * 0.42), with: .color(pink))
            g.stroke(oval(cx + hw * 0.15, cy + m * 0.2, hw * 0.55, m * 0.42), with: .color(ink), lineWidth: max(0.5, line * 0.5))
            g.stroke(curve(CGPoint(x: cx - hw * 0.8, y: cy - m * 0.08), CGPoint(x: cx + hw * 0.8, y: cy - m * 0.08), control: CGPoint(x: cx, y: cy + m * 0.32)),
                     with: .color(ink), style: round(line))
        case "o":
            g.fill(oval(cx, cy + m * 0.04, hw * 0.55, m * 0.5), with: .color(ink))
        case "cat":
            g.stroke(curve(CGPoint(x: cx - hw * 0.7, y: cy), CGPoint(x: cx, y: cy), control: CGPoint(x: cx - hw * 0.35, y: cy + m * 0.45)),
                     with: .color(ink), style: round(line))
            g.stroke(curve(CGPoint(x: cx, y: cy), CGPoint(x: cx + hw * 0.7, y: cy), control: CGPoint(x: cx + hw * 0.35, y: cy + m * 0.45)),
                     with: .color(ink), style: round(line))
        case "toothy":
            let d = dShape(0.85)
            g.fill(d, with: .color(ink))
            var t = g
            t.clip(to: d)
            t.fill(Path(CGRect(x: cx - hw, y: cy - m * 0.14, width: m, height: m * 0.2)), with: .color(.white))
            t.fill(Path(CGRect(x: cx - line * 0.2, y: cy - m * 0.14, width: max(0.4, line * 0.4), height: m * 0.2)), with: .color(ink.opacity(0.5)))
        case "smirk":
            g.stroke(curve(CGPoint(x: cx - hw * 0.6, y: cy + m * 0.06), CGPoint(x: cx + hw * 0.8, y: cy - m * 0.14), control: CGPoint(x: cx + hw * 0.15, y: cy + m * 0.3)),
                     with: .color(ink), style: round(line))
        case "tiny":
            g.stroke(curve(CGPoint(x: cx - hw * 0.38, y: cy), CGPoint(x: cx + hw * 0.38, y: cy), control: CGPoint(x: cx, y: cy + m * 0.22)),
                     with: .color(ink), style: round(line * 0.9))
        case "gasp":
            g.fill(oval(cx, cy + m * 0.08, hw * 0.8, m * 0.78), with: .color(ink))
            g.fill(oval(cx, cy + m * 0.26, hw * 0.45, m * 0.24), with: .color(pink))
        default: // smile
            g.stroke(curve(CGPoint(x: cx - hw * 0.8, y: cy - m * 0.05), CGPoint(x: cx + hw * 0.8, y: cy - m * 0.05), control: CGPoint(x: cx, y: cy + m * 0.45)),
                     with: .color(ink), style: round(line))
        }
    }

    // MARK: Nose / cheeks

    static func nose(_ g: GraphicsContext, _ id: String, a: AvatarParts.Body, u: CGFloat) {
        let cx = a.faceX * u
        let cheekY = a.y(slot: MascotParts.manifest.part("nose").slot) * u
        let n = MascotParts.manifest.part("nose").scale * u
        let noseY = (a.eyeY + a.mouthY) / 2 * u
        switch id {
        case "button":
            g.fill(oval(cx, noseY, n * 0.11, n * 0.075), with: .color(ink.opacity(0.75)))
        case "red":
            g.fill(circle(cx, noseY, n * 0.085), with: .color(Color(hex: 0xEF3B4A)))
            g.fill(circle(cx - n * 0.03, noseY - n * 0.03, n * 0.025), with: .color(.white.opacity(0.85)))
        case "blush":
            for x in [cx - n * 0.48, cx + n * 0.48] { g.fill(oval(x, cheekY, n * 0.22, n * 0.12), with: .color(pink.opacity(0.55))) }
        case "freckles":
            for side: CGFloat in [-1, 1] {
                let x0 = cx + side * n * 0.46
                for (dx, dy) in [(-0.05, -0.02), (0.04, -0.03), (0.0, 0.035)] as [(CGFloat, CGFloat)] {
                    g.fill(circle(x0 + dx * n, cheekY + dy * n, max(0.5, n * 0.018)), with: .color(Color(hex: 0x8A4A12).opacity(0.6)))
                }
            }
        default:
            break
        }
    }

    // MARK: Face accessories

    static func face(_ g: GraphicsContext, _ id: String, a: AvatarParts.Body, u: CGFloat) {
        let cx = a.faceX * u
        let f = MascotParts.manifest.part("face").scale * u
        switch id {
        case "heart-glasses":
            let y = a.y(slot: MascotParts.manifest.part("face").slot) * u
            let dx = f * 0.22
            for x in [cx - dx, cx + dx] {
                let h = heart(x, y, f * 0.34)
                g.fill(h, with: .color(pink.opacity(0.92)))
                g.stroke(h, with: .color(Color(hex: 0xC2185B)), lineWidth: max(0.5, f * 0.025))
                g.fill(circle(x - f * 0.06, y - f * 0.04, f * 0.025), with: .color(.white.opacity(0.85)))
            }
            g.stroke(curve(CGPoint(x: cx - dx + f * 0.12, y: y - f * 0.03), CGPoint(x: cx + dx - f * 0.12, y: y - f * 0.03), control: CGPoint(x: cx, y: y - f * 0.1)),
                     with: .color(Color(hex: 0xC2185B)), style: round(max(0.5, f * 0.03)))
        case "monocle":
            let y = a.y(slot: MascotParts.manifest.part("face").slot) * u
            let ex = cx + MascotParts.manifest.part("eyes").scale * u * 0.25
            let r = f * 0.17
            g.fill(circle(ex, y, r), with: .color(Color(hex: 0xBAE6FD).opacity(0.35)))
            g.stroke(circle(ex, y, r), with: .color(gold), lineWidth: max(0.6, f * 0.035))
            g.stroke(curve(CGPoint(x: ex + r * 0.7, y: y + r * 0.7), CGPoint(x: ex + r * 1.1, y: y + f * 0.55), control: CGPoint(x: ex + r * 1.4, y: y + f * 0.25)),
                     with: .color(gold), style: round(max(0.4, f * 0.015)))
        case "mustache":
            let y = (a.eyeY * 0.35 + a.mouthY * 0.65) * u
            let brown = Color(hex: 0x5B3A1A)
            for side: CGFloat in [-1, 1] {
                var p = Path()
                p.move(to: CGPoint(x: cx, y: y))
                p.addCurve(to: CGPoint(x: cx + side * f * 0.3, y: y - f * 0.03),
                           control1: CGPoint(x: cx + side * f * 0.08, y: y + f * 0.1), control2: CGPoint(x: cx + side * f * 0.24, y: y + f * 0.08))
                p.addQuadCurve(to: CGPoint(x: cx, y: y - f * 0.03), control: CGPoint(x: cx + side * f * 0.14, y: y - f * 0.06))
                p.closeSubpath()
                g.fill(p, with: .color(brown))
            }
        default:
            break
        }
    }

    // MARK: Neck accessories

    static func cape(_ g: GraphicsContext, u: CGFloat, a: AvatarParts.Body) {
        let y = (a.neckY - 0.22) * u
        var p = Path()
        p.move(to: CGPoint(x: 0.3 * u, y: y))
        p.addLine(to: CGPoint(x: 0.7 * u, y: y))
        p.addQuadCurve(to: CGPoint(x: 0.97 * u, y: 0.96 * u), control: CGPoint(x: 0.95 * u, y: 0.6 * u))
        p.addQuadCurve(to: CGPoint(x: 0.03 * u, y: 0.96 * u), control: CGPoint(x: 0.5 * u, y: 1.0 * u))
        p.addQuadCurve(to: CGPoint(x: 0.3 * u, y: y), control: CGPoint(x: 0.05 * u, y: 0.6 * u))
        p.closeSubpath()
        g.fill(p, with: .linearGradient(Gradient(colors: [Color(hex: 0xF0435F), Color(hex: 0xB91C3C)]),
                                       startPoint: CGPoint(x: 0.5 * u, y: y), endPoint: CGPoint(x: 0.5 * u, y: u)))
    }

    static func neck(_ g: GraphicsContext, _ id: String, a: AvatarParts.Body, u: CGFloat) {
        let cx = a.faceX * u
        let y = a.y(slot: MascotParts.manifest.part("neck").slot) * u
        let k = MascotParts.manifest.part("neck").scale * u
        switch id {
        case "bowtie":
            let w = k * 0.24, h = k * 0.14
            for side: CGFloat in [-1, 1] {
                var p = Path()
                p.move(to: CGPoint(x: cx, y: y))
                p.addLine(to: CGPoint(x: cx + side * w, y: y - h))
                p.addQuadCurve(to: CGPoint(x: cx + side * w, y: y + h), control: CGPoint(x: cx + side * w * 1.2, y: y))
                p.closeSubpath()
                g.fill(p, with: .color(Color(hex: 0xEF4444)))
            }
            g.fill(oval(cx, y, k * 0.08, k * 0.1), with: .color(Color(hex: 0xB91C1C)))
        case "scarf":
            let w = k * 0.9
            g.fill(Path(roundedRect: CGRect(x: cx - w / 2, y: y - k * 0.07, width: w, height: k * 0.14), cornerRadius: k * 0.07),
                   with: .color(Color(hex: 0xEF4444)))
            g.fill(Path(roundedRect: CGRect(x: cx + w * 0.18, y: y, width: k * 0.13, height: k * 0.3), cornerRadius: k * 0.04),
                   with: .color(Color(hex: 0xDC2626)))
            for i in 0..<3 {
                g.fill(Path(CGRect(x: cx - w / 2 + CGFloat(i) * w * 0.34 + w * 0.08, y: y - k * 0.07, width: k * 0.05, height: k * 0.14)),
                       with: .color(.white.opacity(0.75)))
            }
        case "chain":
            var p = Path()
            p.move(to: CGPoint(x: cx - k * 0.42, y: y - k * 0.08))
            p.addQuadCurve(to: CGPoint(x: cx + k * 0.42, y: y - k * 0.08), control: CGPoint(x: cx, y: y + k * 0.22))
            g.stroke(p, with: .color(gold), style: StrokeStyle(lineWidth: max(0.8, k * 0.05), lineCap: .round, dash: [k * 0.05, k * 0.03]))
            g.fill(circle(cx, y + k * 0.11, k * 0.07), with: .color(Color(hex: 0xFFD166)))
            g.stroke(circle(cx, y + k * 0.11, k * 0.07), with: .color(goldDeep), lineWidth: max(0.4, k * 0.015))
        default:
            break
        }
    }

    static func wings(_ g: GraphicsContext, u: CGFloat, a: AvatarParts.Body) {
        let y = (a.neckY - 0.12) * u
        for side: CGFloat in [-1, 1] {
            var p = Path()
            let root = CGPoint(x: 0.5 * u + side * 0.18 * u, y: y)
            p.move(to: root)
            p.addQuadCurve(to: CGPoint(x: 0.5 * u + side * 0.5 * u, y: y - 0.3 * u), control: CGPoint(x: 0.5 * u + side * 0.32 * u, y: y - 0.36 * u))
            p.addQuadCurve(to: CGPoint(x: 0.5 * u + side * 0.44 * u, y: y + 0.02 * u), control: CGPoint(x: 0.5 * u + side * 0.56 * u, y: y - 0.1 * u))
            p.addQuadCurve(to: root, control: CGPoint(x: 0.5 * u + side * 0.3 * u, y: y + 0.1 * u))
            p.closeSubpath()
            g.fill(p, with: .linearGradient(Gradient(colors: [.white, Color(hex: 0xE0E7FF)]),
                                           startPoint: CGPoint(x: 0.5 * u, y: y - 0.3 * u), endPoint: CGPoint(x: 0.5 * u, y: y + 0.1 * u)))
            g.stroke(p, with: .color(Color(hex: 0xA5B4FC)), lineWidth: max(0.5, u * 0.012))
        }
    }

    // MARK: Hats (x, y = headTop anchor; w = hat width)

    static func head(_ g: GraphicsContext, _ id: String, x: CGFloat, y: CGFloat, w: CGFloat) {
        let hb = y + w * 0.12  // the brim line, a touch into the body top
        let half = w / 2
        func dome(_ width: CGFloat, _ height: CGFloat, at bottom: CGFloat) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: x - width / 2, y: bottom))
            p.addCurve(to: CGPoint(x: x + width / 2, y: bottom),
                       control1: CGPoint(x: x - width / 2, y: bottom - height * 1.33), control2: CGPoint(x: x + width / 2, y: bottom - height * 1.33))
            p.closeSubpath()
            return p
        }
        func shade(_ top: Color, _ bottom: Color, _ y0: CGFloat, _ y1: CGFloat) -> GraphicsContext.Shading {
            .linearGradient(Gradient(colors: [top, bottom]), startPoint: CGPoint(x: x, y: y0), endPoint: CGPoint(x: x, y: y1))
        }
        switch id {
        case "crown":
            let h = w * 0.42, cw = w * 0.72
            var p = Path()
            p.move(to: CGPoint(x: x - cw / 2, y: hb))
            p.addLine(to: CGPoint(x: x - cw / 2, y: hb - h))
            p.addLine(to: CGPoint(x: x - cw / 4, y: hb - h * 0.5))
            p.addLine(to: CGPoint(x: x, y: hb - h * 1.05))
            p.addLine(to: CGPoint(x: x + cw / 4, y: hb - h * 0.5))
            p.addLine(to: CGPoint(x: x + cw / 2, y: hb - h))
            p.addLine(to: CGPoint(x: x + cw / 2, y: hb))
            p.closeSubpath()
            g.fill(p, with: shade(Color(hex: 0xFFE08A), Color(hex: 0xF5A524), hb - h, hb))
            g.stroke(p, with: .color(goldDeep), style: round(max(0.5, w * 0.025)))
            g.fill(circle(x, hb - h * 0.3, w * 0.05), with: .color(Color(hex: 0xEF3B4A)))
        case "nightcap":
            var p = Path()
            p.move(to: CGPoint(x: x - half * 0.9, y: hb))
            p.addQuadCurve(to: CGPoint(x: x + half * 1.2, y: hb - w * 0.2), control: CGPoint(x: x - half * 0.1, y: hb - w * 0.75))
            p.addQuadCurve(to: CGPoint(x: x + half * 0.9, y: hb), control: CGPoint(x: x + half * 0.6, y: hb - w * 0.3))
            p.closeSubpath()
            g.fill(p, with: shade(Color(hex: 0x60A5FA), Color(hex: 0x2563EB), hb - w * 0.6, hb))
            g.fill(Path(roundedRect: CGRect(x: x - half * 0.95, y: hb - w * 0.1, width: w * 0.95, height: w * 0.14), cornerRadius: w * 0.07), with: .color(.white))
            g.fill(circle(x + half * 1.2, hb - w * 0.2, w * 0.08), with: .color(.white))
        case "sweatband":
            g.fill(Path(roundedRect: CGRect(x: x - half * 0.95, y: hb - w * 0.02, width: w * 0.95, height: w * 0.15), cornerRadius: w * 0.07),
                   with: .color(Color(hex: 0xEF4444)))
            g.fill(Path(CGRect(x: x - half * 0.95, y: hb + w * 0.045, width: w * 0.95, height: w * 0.025)), with: .color(.white))
        case "sprout":
            g.stroke(curve(CGPoint(x: x, y: hb), CGPoint(x: x, y: hb - w * 0.34), control: CGPoint(x: x + w * 0.05, y: hb - w * 0.18)),
                     with: .color(Color(hex: 0x16A34A)), style: round(max(0.6, w * 0.05)))
            for side: CGFloat in [-1, 1] {
                var leaf = Path(ellipseIn: CGRect(x: 0, y: 0, width: w * 0.24, height: w * 0.12))
                leaf = leaf.applying(CGAffineTransform(translationX: -w * 0.12, y: -w * 0.06)
                    .concatenating(CGAffineTransform(rotationAngle: side * -0.5))
                    .concatenating(CGAffineTransform(translationX: x + side * w * 0.12, y: hb - w * 0.34)))
                g.fill(leaf, with: .color(Color(hex: 0x4ADE80)))
            }
        case "beanie":
            let d = dome(w * 0.92, w * 0.4, at: hb)
            g.fill(d, with: shade(Color(hex: 0x2DD4BF), Color(hex: 0x0D9488), hb - w * 0.5, hb))
            g.fill(Path(roundedRect: CGRect(x: x - w * 0.48, y: hb - w * 0.1, width: w * 0.96, height: w * 0.16), cornerRadius: w * 0.06),
                   with: .color(Color(hex: 0x0F766E)))
            g.fill(circle(x, hb - w * 0.55, w * 0.08), with: .color(Color(hex: 0x99F6E4)))
        case "bow":
            let bx = x + half * 0.5, by = hb - w * 0.08
            for side: CGFloat in [-1, 1] {
                var p = Path()
                p.move(to: CGPoint(x: bx, y: by))
                p.addQuadCurve(to: CGPoint(x: bx + side * w * 0.26, y: by - w * 0.14), control: CGPoint(x: bx + side * w * 0.1, y: by - w * 0.2))
                p.addQuadCurve(to: CGPoint(x: bx, y: by), control: CGPoint(x: bx + side * w * 0.34, y: by + w * 0.12))
                p.closeSubpath()
                g.fill(p, with: .color(Color(hex: 0xEC4899)))
            }
            g.fill(circle(bx, by, w * 0.05), with: .color(Color(hex: 0xBE185D)))
        case "headphones":
            var band = Path()
            band.move(to: CGPoint(x: x - half * 1.02, y: hb + w * 0.3))
            band.addCurve(to: CGPoint(x: x + half * 1.02, y: hb + w * 0.3),
                          control1: CGPoint(x: x - half * 1.05, y: hb - w * 0.45), control2: CGPoint(x: x + half * 1.05, y: hb - w * 0.45))
            g.stroke(band, with: .color(Color(hex: 0x475569)), style: round(max(0.8, w * 0.07)))
            for side: CGFloat in [-1, 1] {
                g.fill(Path(roundedRect: CGRect(x: x + side * half * 1.02 - w * 0.08, y: hb + w * 0.18, width: w * 0.16, height: w * 0.26),
                            cornerRadius: w * 0.07), with: .color(Color(hex: 0xEC4899)))
            }
        case "wizard":
            var p = Path()
            p.move(to: CGPoint(x: x - half * 0.75, y: hb))
            p.addQuadCurve(to: CGPoint(x: x + w * 0.12, y: hb - w * 0.85), control: CGPoint(x: x - w * 0.1, y: hb - w * 0.4))
            p.addQuadCurve(to: CGPoint(x: x + half * 0.75, y: hb), control: CGPoint(x: x + w * 0.2, y: hb - w * 0.3))
            p.closeSubpath()
            g.fill(p, with: shade(Color(hex: 0x8B5CF6), Color(hex: 0x5B21B6), hb - w * 0.85, hb))
            g.fill(oval(x, hb, w * 1.1, w * 0.16), with: .color(Color(hex: 0x4C1D95)))
            g.fill(star(x, hb - w * 0.3, outer: w * 0.08, inner: w * 0.035), with: .color(gold))
        case "party":
            var p = Path()
            p.move(to: CGPoint(x: x - w * 0.28, y: hb))
            p.addLine(to: CGPoint(x: x, y: hb - w * 0.72))
            p.addLine(to: CGPoint(x: x + w * 0.28, y: hb))
            p.closeSubpath()
            g.fill(p, with: .color(Color(hex: 0xFACC15)))
            var stripes = g
            stripes.clip(to: p)
            for i in 0..<4 {
                let sy = hb - w * (0.1 + CGFloat(i) * 0.18)
                stripes.fill(Path(CGRect(x: x - w * 0.4, y: sy - w * 0.04, width: w * 0.8, height: w * 0.07)), with: .color(Color(hex: 0xEC4899)))
            }
            g.fill(circle(x, hb - w * 0.74, w * 0.07), with: .color(Color(hex: 0x38BDF8)))
        case "pirate":
            var p = Path()
            p.move(to: CGPoint(x: x - half * 1.1, y: hb))
            p.addQuadCurve(to: CGPoint(x: x, y: hb - w * 0.42), control: CGPoint(x: x - half * 0.8, y: hb - w * 0.45))
            p.addQuadCurve(to: CGPoint(x: x + half * 1.1, y: hb), control: CGPoint(x: x + half * 0.8, y: hb - w * 0.45))
            p.addQuadCurve(to: CGPoint(x: x - half * 1.1, y: hb), control: CGPoint(x: x, y: hb - w * 0.1))
            p.closeSubpath()
            g.fill(p, with: .color(Color(hex: 0x1F1B2E)))
            g.stroke(curve(CGPoint(x: x - half * 1.05, y: hb - w * 0.02), CGPoint(x: x + half * 1.05, y: hb - w * 0.02), control: CGPoint(x: x, y: hb - w * 0.12)),
                     with: .color(gold), style: round(max(0.5, w * 0.03)))
            g.fill(circle(x, hb - w * 0.24, w * 0.06), with: .color(.white))
        case "cowboy":
            g.fill(Path(roundedRect: CGRect(x: x - w * 0.3, y: hb - w * 0.42, width: w * 0.6, height: w * 0.42), cornerRadius: w * 0.14),
                   with: shade(Color(hex: 0xC08A4F), Color(hex: 0x8A5A2B), hb - w * 0.42, hb))
            g.fill(oval(x, hb, w * 1.3, w * 0.2), with: .color(Color(hex: 0x7A4E22)))
            g.fill(Path(CGRect(x: x - w * 0.3, y: hb - w * 0.12, width: w * 0.6, height: w * 0.06)), with: .color(Color(hex: 0x3F2A14)))
        case "chef":
            g.fill(Path(roundedRect: CGRect(x: x - w * 0.3, y: hb - w * 0.22, width: w * 0.6, height: w * 0.24), cornerRadius: w * 0.04), with: .color(.white))
            for (dx, r) in [(-0.2, 0.17), (0.2, 0.17), (0.0, 0.22)] as [(CGFloat, CGFloat)] {
                g.fill(circle(x + dx * w, hb - w * 0.36, r * w), with: .color(.white))
            }
            var edge = g
            edge.opacity = 0.6
            for (dx, r) in [(-0.2, 0.17), (0.2, 0.17), (0.0, 0.22)] as [(CGFloat, CGFloat)] {
                edge.stroke(circle(x + dx * w, hb - w * 0.36, r * w), with: .color(Color(hex: 0xCBC3DC)), lineWidth: max(0.4, w * 0.015))
            }
        case "grad":
            g.fill(Path(roundedRect: CGRect(x: x - w * 0.26, y: hb - w * 0.2, width: w * 0.52, height: w * 0.22), cornerRadius: w * 0.04),
                   with: .color(Color(hex: 0x1F1B2E)))
            var board = Path()
            board.move(to: CGPoint(x: x, y: hb - w * 0.4))
            board.addLine(to: CGPoint(x: x + w * 0.55, y: hb - w * 0.24))
            board.addLine(to: CGPoint(x: x, y: hb - w * 0.08))
            board.addLine(to: CGPoint(x: x - w * 0.55, y: hb - w * 0.24))
            board.closeSubpath()
            g.fill(board, with: .color(Color(hex: 0x2E2943)))
            g.stroke(curve(CGPoint(x: x, y: hb - w * 0.24), CGPoint(x: x + w * 0.42, y: hb - w * 0.02), control: CGPoint(x: x + w * 0.4, y: hb - w * 0.24)),
                     with: .color(gold), style: round(max(0.5, w * 0.03)))
        case "flower":
            let fx = x + half * 0.45, fy = hb - w * 0.06, r = w * 0.1
            for i in 0..<5 {
                let ang = Double(i) * 2 * Double.pi / 5 - Double.pi / 2
                g.fill(circle(fx + r * 1.1 * CGFloat(cos(ang)), fy + r * 1.1 * CGFloat(sin(ang)), r * 0.85), with: .color(Color(hex: 0xFF8FB8)))
            }
            g.fill(circle(fx, fy, r * 0.7), with: .color(gold))
        case "tophat":
            g.fill(Path(roundedRect: CGRect(x: x - w * 0.27, y: hb - w * 0.62, width: w * 0.54, height: w * 0.62), cornerRadius: w * 0.05),
                   with: shade(Color(hex: 0x3B3552), Color(hex: 0x1F1B2E), hb - w * 0.62, hb))
            g.fill(Path(CGRect(x: x - w * 0.27, y: hb - w * 0.2, width: w * 0.54, height: w * 0.08)), with: .color(Color(hex: 0xEF4444)))
            g.fill(oval(x, hb, w * 0.95, w * 0.14), with: .color(Color(hex: 0x1F1B2E)))
        case "propeller":
            let d = dome(w * 0.8, w * 0.32, at: hb)
            g.fill(d, with: shade(Color(hex: 0xFACC15), Color(hex: 0xEAB308), hb - w * 0.4, hb))
            var sliceRed = g
            sliceRed.clip(to: d)
            sliceRed.fill(Path(CGRect(x: x - w * 0.13, y: hb - w * 0.5, width: w * 0.26, height: w * 0.5)), with: .color(Color(hex: 0xEF4444)))
            g.stroke(curve(CGPoint(x: x, y: hb - w * 0.42), CGPoint(x: x, y: hb - w * 0.54), control: CGPoint(x: x, y: hb - w * 0.48)),
                     with: .color(Color(hex: 0x475569)), style: round(max(0.5, w * 0.03)))
            g.fill(oval(x - w * 0.18, hb - w * 0.56, w * 0.34, w * 0.08), with: .color(Color(hex: 0x38BDF8)))
            g.fill(oval(x + w * 0.18, hb - w * 0.56, w * 0.34, w * 0.08), with: .color(Color(hex: 0x22C55E)))
        case "catears", "bunnyears":
            let bunny = id == "bunnyears"
            for side: CGFloat in [-1, 1] {
                let bx = x + side * w * 0.26
                var ear = Path()
                if bunny {
                    ear = oval(bx, hb - w * 0.34, w * 0.2, w * 0.62)
                } else {
                    ear.move(to: CGPoint(x: bx - w * 0.15, y: hb + w * 0.02))
                    ear.addLine(to: CGPoint(x: bx + side * w * 0.04, y: hb - w * 0.32))
                    ear.addLine(to: CGPoint(x: bx + w * 0.15, y: hb + w * 0.02))
                    ear.closeSubpath()
                }
                g.fill(ear, with: .color(bunny ? .white : Color(hex: 0x4B4458)))
                g.stroke(ear, with: .color(bunny ? Color(hex: 0xD6CFE3) : Color(hex: 0x2E2943)), lineWidth: max(0.4, w * 0.02))
                let inner = bunny ? oval(bx, hb - w * 0.32, w * 0.1, w * 0.44)
                                  : oval(bx + side * w * 0.01, hb - w * 0.08, w * 0.1, w * 0.16)
                g.fill(inner, with: .color(pink.opacity(0.8)))
            }
        case "tiara":
            var p = Path()
            p.move(to: CGPoint(x: x - w * 0.36, y: hb))
            p.addQuadCurve(to: CGPoint(x: x, y: hb - w * 0.34), control: CGPoint(x: x - w * 0.22, y: hb - w * 0.18))
            p.addQuadCurve(to: CGPoint(x: x + w * 0.36, y: hb), control: CGPoint(x: x + w * 0.22, y: hb - w * 0.18))
            p.addQuadCurve(to: CGPoint(x: x - w * 0.36, y: hb), control: CGPoint(x: x, y: hb - w * 0.08))
            p.closeSubpath()
            g.fill(p, with: shade(Color(hex: 0xF5F3FF), Color(hex: 0xC4B5FD), hb - w * 0.34, hb))
            g.stroke(p, with: .color(Color(hex: 0x8B5CF6)), lineWidth: max(0.4, w * 0.02))
            g.fill(circle(x, hb - w * 0.2, w * 0.06), with: .color(Color(hex: 0xEC4899)))
            g.fill(circle(x - w * 0.18, hb - w * 0.09, w * 0.035), with: .color(Color(hex: 0x38BDF8)))
            g.fill(circle(x + w * 0.18, hb - w * 0.09, w * 0.035), with: .color(Color(hex: 0x38BDF8)))
        case "viking":
            for side: CGFloat in [-1, 1] {
                var horn = Path()
                horn.move(to: CGPoint(x: x + side * w * 0.3, y: hb - w * 0.12))
                horn.addQuadCurve(to: CGPoint(x: x + side * w * 0.6, y: hb - w * 0.55), control: CGPoint(x: x + side * w * 0.62, y: hb - w * 0.15))
                horn.addQuadCurve(to: CGPoint(x: x + side * w * 0.36, y: hb - w * 0.24), control: CGPoint(x: x + side * w * 0.48, y: hb - w * 0.26))
                horn.closeSubpath()
                g.fill(horn, with: .color(Color(hex: 0xFFF7E6)))
                g.stroke(horn, with: .color(Color(hex: 0xC9B48A)), lineWidth: max(0.4, w * 0.02))
            }
            let d = dome(w * 0.86, w * 0.36, at: hb)
            g.fill(d, with: shade(Color(hex: 0xCBD5E1), Color(hex: 0x94A3B8), hb - w * 0.45, hb))
            g.fill(Path(roundedRect: CGRect(x: x - w * 0.45, y: hb - w * 0.08, width: w * 0.9, height: w * 0.12), cornerRadius: w * 0.04),
                   with: .color(Color(hex: 0xB45309)))
        case "halo":
            let ring = oval(x, hb - w * 0.3, w * 0.8, w * 0.2)
            g.stroke(ring, with: .color(Color(hex: 0xFFE08A)), lineWidth: max(0.8, w * 0.07))
            g.stroke(ring, with: .color(gold), lineWidth: max(0.4, w * 0.025))
        default:
            break
        }
    }
}

// MARK: - Backdrop (the tile behind the mascot, AN addendum)

/// The avatar tile background: "auto" = a light tint of the body color (dark mode:
/// the body color over the dark surface); a backdrop id draws its solid / gradient
/// / code-drawn pattern from `AvatarCatalog.backdrops`.
struct MascotBackdrop: View {
    let bg: String
    let base: Color
    let dark: Bool

    var body: some View {
        if let b = AvatarCatalog.backdrop(bg) {
            let cs = b.colors.map { Color(hex: UInt($0.dropFirst(), radix: 16) ?? 0xEDE9FE) }
            switch b.kind {
            case .solid:
                Rectangle().fill(cs.first ?? base.wash(0.2))
            case .gradient:
                Rectangle().fill(LinearGradient(colors: cs.count > 1 ? cs : [cs.first ?? base, cs.first ?? base],
                                                startPoint: .topLeading, endPoint: .bottomTrailing))
            case .pattern:
                Canvas { ctx, size in MascotBackdrop.pattern(ctx, id: b.id, colors: cs, size: size) }
            }
        } else {
            Rectangle().fill(LinearGradient(colors: dark ? [base.mixed(over: Theme.surface, 0.26), base.mixed(over: Theme.surface, 0.42)]
                                                         : [base.wash(0.14), base.wash(0.30)],
                                            startPoint: .top, endPoint: .bottom))
        }
    }

    static func pattern(_ g: GraphicsContext, id: String, colors: [Color], size: CGSize) {
        let w = size.width, h = size.height
        let bg = colors.first ?? .white
        let ink = colors.count > 1 ? colors[1] : .white
        g.fill(Path(CGRect(origin: .zero, size: size)), with: .color(bg))
        func dot(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ c: Color) {
            g.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(c))
        }
        func star(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ c: Color, points: Int = 5) {
            var p = Path()
            for i in 0..<(points * 2) {
                let rr = i % 2 == 0 ? r : r * 0.42
                let ang = -Double.pi / 2 + Double(i) * Double.pi / Double(points)
                let pt = CGPoint(x: x + rr * CGFloat(cos(ang)), y: y + rr * CGFloat(sin(ang)))
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            p.closeSubpath()
            g.fill(p, with: .color(c))
        }
        // Fixed scatter positions (0–1) so every render of a backdrop is identical.
        let scatter: [(CGFloat, CGFloat)] = [(0.12, 0.14), (0.78, 0.1), (0.9, 0.42), (0.08, 0.5), (0.46, 0.06), (0.3, 0.86),
                                             (0.7, 0.8), (0.55, 0.93), (0.2, 0.32), (0.86, 0.66), (0.62, 0.26), (0.38, 0.6)]
        switch id {
        case "galaxy":
            g.fill(Path(ellipseIn: CGRect(x: -w * 0.2, y: h * 0.25, width: w * 1.4, height: h * 0.5)),
                   with: .radialGradient(Gradient(colors: [Color(hex: 0xA78BFA).opacity(0.55), .clear]),
                                         center: CGPoint(x: w / 2, y: h / 2), startRadius: 0, endRadius: w * 0.6))
            for (i, s) in scatter.enumerated() {
                if i % 3 == 0 { star(s.0 * w, s.1 * h, w * 0.035, ink, points: 4) } else { dot(s.0 * w, s.1 * h, w * 0.012, ink.opacity(0.85)) }
            }
        case "polka":
            var row = 0
            var y = h * 0.1
            while y < h + h * 0.1 {
                var x = row % 2 == 0 ? w * 0.1 : w * 0.24
                while x < w + w * 0.1 { dot(x, y, w * 0.045, ink.opacity(0.7)); x += w * 0.28 }
                y += h * 0.2; row += 1
            }
        case "starry":
            for (i, s) in scatter.enumerated() { star(s.0 * w, s.1 * h, w * (i % 2 == 0 ? 0.04 : 0.025), ink) }
        case "sunburst":
            let c = CGPoint(x: w / 2, y: h * 0.62)
            let rays = 16
            for i in 0..<rays where i % 2 == 0 {
                let a0 = Double(i) * 2 * Double.pi / Double(rays)
                let a1 = Double(i + 1) * 2 * Double.pi / Double(rays)
                var p = Path()
                p.move(to: c)
                p.addLine(to: CGPoint(x: c.x + w * 1.2 * CGFloat(cos(a0)), y: c.y + w * 1.2 * CGFloat(sin(a0))))
                p.addLine(to: CGPoint(x: c.x + w * 1.2 * CGFloat(cos(a1)), y: c.y + w * 1.2 * CGFloat(sin(a1))))
                p.closeSubpath()
                g.fill(p, with: .color(ink.opacity(0.45)))
            }
        case "checkers":
            let n = 6
            let cw = w / CGFloat(n), ch = h / CGFloat(n)
            for r in 0..<n { for col in 0..<n where (r + col) % 2 == 0 {
                g.fill(Path(CGRect(x: CGFloat(col) * cw, y: CGFloat(r) * ch, width: cw, height: ch)), with: .color(ink))
            } }
        case "confetti":
            let inks = colors.count > 1 ? Array(colors.dropFirst()) : [ink]
            for (i, s) in scatter.enumerated() {
                let c = inks[i % inks.count]
                let rect = CGRect(x: -w * 0.025, y: -w * 0.012, width: w * 0.05, height: w * 0.024)
                let t = CGAffineTransform(rotationAngle: CGFloat(i) * 0.7).concatenating(CGAffineTransform(translationX: s.0 * w, y: s.1 * h))
                g.fill(Path(roundedRect: rect, cornerRadius: w * 0.008).applying(t), with: .color(c))
            }
        default:
            break
        }
    }
}
