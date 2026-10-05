import Foundation

// The mascot FIT SYSTEM — exact port of packages/core/src/avatar-layout.ts (pinned by
// Tests/Fixtures/avatar-layout-fixtures.json, AvatarLayoutTests). One layout every renderer draws:
// per-body anchors place AND scale every part, hats clear the eyes, conflicting picks swap out, and the
// whole composition is scaled uniformly into the padded tile (never cropping a hat or wing).
// Rects are fractions of the avatar's CONTENT square (inside its frame band).

public struct AvatarRect: Equatable, Codable {
    public var x: Double, y: Double, w: Double, h: Double
    public init(x: Double, y: Double, w: Double, h: Double) { self.x = x; self.y = y; self.w = w; self.h = h }
}

/// avatar-parts.json v2 (the fit manifest). Decoded leniently: v1 files decode with empty items.
public struct AvatarManifest: Decodable {
    public struct XW: Decodable { public var x: Double; public var w: Double }
    public struct XY: Decodable { public var x: Double; public var y: Double }
    public struct XYW: Decodable { public var x: Double; public var y: Double; public var w: Double }
    public struct Y: Decodable { public var y: Double }
    public struct Override: Decodable { public var dx: Double?; public var dy: Double?; public var scale: Double? }
    public struct Body: Decodable {
        public var faceCenter: [Double]
        public var eyeY: Double, mouthY: Double, cheekY: Double
        public var headTop: XYW
        public var neckY: Double
        public var letterBox: [Double]
        public var face: XW
        public var mustacheY: Double
        public var shoulderW: Double
        public var back: XYW
        public var cape: Y
        public var hand: XY
        public var bounds: [Double]
        public var overrides: [String: Override]?
    }
    public struct Item: Decodable {
        public var w: Double, aspect: Double
        public var anchor: [Double]
        public var slot: String, layer: String
        public var overlap: Double?
        public var tint: Bool?
        public var overFace: Bool?
        /// Integrated parts drawn per body (the scarf): art `art-av-<kind>-<id>-<body>` at [x, y, w, h] body units.
        public var perBody: [String: [Double]]?
    }
    public struct Fit: Decodable { public var pad: Double; public var maxBody: Double; public var minBody: Double }
    public struct Conflict: Decodable { public var a: String; public var aIds: [String]; public var b: String; public var bIds: [String] }

    public var fit: Fit
    public var layerOrder: [String]
    public var bodies: [String: Body]
    public var items: [String: Item]
    public var conflicts: [Conflict]

    public static func decode(_ data: Data) throws -> AvatarManifest { try JSONDecoder().decode(AvatarManifest.self, from: data) }
}

public struct AvatarLayoutLayer: Equatable {
    public var layer: String
    public var field: String
    public var id: String
    public var art: String
    public var rect: AvatarRect
    public var tint: Bool
}

public struct AvatarLayout: Equatable {
    public var scale: Double
    public var body: AvatarRect
    public var letter: AvatarRect
    public var layers: [AvatarLayoutLayer]
    public var bounds: AvatarRect
}

public enum AvatarFit {
    public static let partFields = ["cheeks", "eyes", "nose", "mouth", "face", "head", "neck"]
    static let fieldKind: [String: String] = ["cheeks": "cheeks", "eyes": "eyes", "nose": "nose", "mouth": "mouth", "face": "acc", "head": "acc", "neck": "acc"]
    public static let hatEyeClearance = 0.012
    /// Sizes at or below this draw only the body, eyes, mouth, nose and hat.
    public static let smallSize: Double = 28

    static func r4(_ v: Double) -> Double { (v * 10000).rounded() / 10000 }

    static func value(_ c: AvatarConfig, _ field: String) -> String {
        switch field {
        case "cheeks": return c.cheeks
        case "eyes": return c.eyes
        case "nose": return c.nose
        case "mouth": return c.mouth
        case "face": return c.face
        case "head": return c.head
        case "neck": return c.neck
        default: return "none"
        }
    }

    static func setting(_ c: AvatarConfig, _ field: String, _ id: String) -> AvatarConfig {
        var o = c
        switch field {
        case "cheeks": o.cheeks = id
        case "eyes": o.eyes = id
        case "nose": o.nose = id
        case "mouth": o.mouth = id
        case "face": o.face = id
        case "head": o.head = id
        case "neck": o.neck = id
        case "body": o.body = id
        default: break
        }
        return o
    }

    /// The (field, id) a pick would swap out, else nil.
    public static func pickConflict(_ worn: [String: String], field: String, id: String, manifest: AvatarManifest) -> (field: String, id: String)? {
        if id == "none" { return nil }
        for c in manifest.conflicts {
            for (mine, mineIds, other, otherIds) in [(c.a, c.aIds, c.b, c.bIds), (c.b, c.bIds, c.a, c.aIds)] {
                guard mine == field, mineIds.contains(id) || mineIds.contains("*") else { continue }
                if let w = worn[other], w != "none", otherIds.contains(w) || otherIds.contains("*") { return (other, w) }
            }
        }
        return nil
    }

    public static func pickConflict(_ config: AvatarConfig, field: String, id: String, manifest: AvatarManifest) -> (field: String, id: String)? {
        var worn: [String: String] = [:]
        for f in partFields { worn[f] = value(config, f) }
        return pickConflict(worn, field: field, id: id, manifest: manifest)
    }

    /// What a swapped-out field resets to (eyes and mouth always draw something).
    public static let pickReset = ["eyes": "beady", "mouth": "smile"]

    /// Set field = id and swap out whatever it conflicts with.
    public static func applyPick(_ config: AvatarConfig, field: String, id: String, manifest: AvatarManifest) -> AvatarConfig {
        var next = setting(config, field, id)
        for _ in 0..<4 {
            guard let hit = pickConflict(next, field: field, id: id, manifest: manifest) else { break }
            next = setting(next, hit.field, pickReset[hit.field] ?? "none")
        }
        return next
    }

    static func wornParts(_ config: AvatarConfig, small: Bool, manifest: AvatarManifest) -> [(String, String)] {
        var out: [(String, String)] = []
        var kept: [String: String] = [:]
        for f in ["eyes", "mouth", "head", "nose", "cheeks", "neck", "face"] {
            let id = value(config, f)
            if id.isEmpty || id == "none" { continue }
            if small && !["eyes", "mouth", "head", "nose"].contains(f) { continue }
            guard manifest.items["\(fieldKind[f]!):\(id)"] != nil else { continue }
            if pickConflict(kept, field: f, id: id, manifest: manifest) != nil { continue }
            kept[f] = id
            out.append((f, id))
        }
        return out
    }

    static func slotPoint(_ b: AvatarManifest.Body, _ slot: String) -> (x: Double, y: Double, base: Double) {
        switch slot {
        case "eyes", "glasses": return (b.face.x, b.eyeY, b.face.w)
        case "nose", "cheeks": return (b.face.x, b.cheekY, b.face.w)
        case "mouth": return (b.face.x, b.mouthY, b.face.w)
        case "mustache": return (b.face.x, b.mustacheY, b.face.w)
        case "head": return (b.headTop.x, b.headTop.y, b.headTop.w)
        case "neck": return (b.face.x, b.neckY, b.shoulderW)
        case "hand": return (b.hand.x, b.hand.y, b.back.w)
        case "cape": return (b.back.x, b.cape.y, b.back.w)
        default: return (b.back.x, b.back.y, b.back.w)
        }
    }

    /// Where every layer of `config` goes (content-square fractions).
    public static func layout(_ config: AvatarConfig, small: Bool = false, manifest: AvatarManifest) -> AvatarLayout {
        guard let b = manifest.bodies[config.body] ?? manifest.bodies["classic"] else {
            let unit = AvatarRect(x: 0.07, y: 0.07, w: 0.86, h: 0.86)
            return AvatarLayout(scale: 0.86, body: unit, letter: unit, layers: [], bounds: unit)
        }
        struct P { var layer: String; var field: String; var id: String; var art: String; var rect: AvatarRect; var tint: Bool }
        var placed: [P] = []
        for (field, id) in wornParts(config, small: small, manifest: manifest) {
            let key = "\(fieldKind[field]!):\(id)"
            let m = manifest.items[key]!
            if let pb = m.perBody?[config.body], pb.count == 4 {
                placed.append(P(layer: m.layer, field: field, id: id, art: "art-av-\(fieldKind[field]!)-\(id)-\(config.body)",
                                rect: AvatarRect(x: pb[0], y: pb[1], w: pb[2], h: pb[3]),
                                tint: (m.tint ?? false) && AvatarCatalog.tintable.contains(id)))
                continue
            }
            let p = slotPoint(b, m.slot)
            let o = b.overrides?[key]
            let w = p.base * m.w * (o?.scale ?? 1)
            let h = w * m.aspect
            placed.append(P(layer: m.layer, field: field, id: id, art: "art-av-\(fieldKind[field]!)-\(id)",
                            rect: AvatarRect(x: p.x - m.anchor[0] * w + (o?.dx ?? 0), y: p.y - m.anchor[1] * h + (o?.dy ?? 0), w: w, h: h),
                            tint: (m.tint ?? false) && AvatarCatalog.tintable.contains(id)))
        }
        // hats clear the face
        let faceTops = placed.filter { $0.layer == "eyes" || ($0.layer == "face" && manifest.items["acc:\($0.id)"]?.slot == "glasses") }.map(\.rect.y)
        if let faceTop = faceTops.min() {
            for i in placed.indices where placed[i].layer == "head" && !(manifest.items["acc:\(placed[i].id)"]?.overFace ?? false) {
                let limit = faceTop - hatEyeClearance
                let bottom = placed[i].rect.y + placed[i].rect.h
                if bottom > limit { placed[i].rect.y -= bottom - limit }
            }
        }
        var x0 = b.bounds[0], y0 = b.bounds[1], x1 = b.bounds[2], y1 = b.bounds[3]
        for p in placed {
            x0 = min(x0, p.rect.x); y0 = min(y0, p.rect.y)
            x1 = max(x1, p.rect.x + p.rect.w); y1 = max(y1, p.rect.y + p.rect.h)
        }
        let avail = 1 - 2 * manifest.fit.pad
        let s = min(manifest.fit.maxBody, avail / (x1 - x0), avail / (y1 - y0))
        let tx = 0.5 - ((x0 + x1) / 2) * s
        let ty = 0.5 - ((y0 + y1) / 2) * s
        func map(_ r: AvatarRect) -> AvatarRect {
            AvatarRect(x: r4(tx + r.x * s), y: r4(ty + r.y * s), w: r4(r.w * s), h: r4(r.h * s))
        }
        let bodyRect = map(AvatarRect(x: 0, y: 0, w: 1, h: 1))
        var all: [(Int, AvatarLayoutLayer)] = [(0, AvatarLayoutLayer(layer: "body", field: "body", id: config.body, art: "art-av-body-\(config.body)", rect: bodyRect, tint: false))]
        for (i, p) in placed.enumerated() {
            all.append((i + 1, AvatarLayoutLayer(layer: p.layer, field: p.field, id: p.id, art: p.art, rect: map(p.rect), tint: p.tint)))
        }
        let order = manifest.layerOrder
        func rank(_ l: String) -> Int { order.firstIndex(of: l) ?? -1 }
        all.sort { (a, c) in rank(a.1.layer) != rank(c.1.layer) ? rank(a.1.layer) < rank(c.1.layer) : a.0 < c.0 }
        let lb = b.letterBox
        return AvatarLayout(scale: r4(s), body: bodyRect, letter: map(AvatarRect(x: lb[0], y: lb[1], w: lb[2], h: lb[3])),
                            layers: all.map(\.1), bounds: map(AvatarRect(x: x0, y: y0, w: x1 - x0, h: y1 - y0)))
    }

    // MARK: Patterns (shared shapes, body-square units)

    public enum Shape: Equatable {
        case rect(x: Double, y: Double, w: Double, h: Double, c: String, a: Double)
        case circle(x: Double, y: Double, r: Double, c: String, a: Double)
        case star(x: Double, y: Double, r: Double, inner: Double, n: Int, c: String, a: Double)
        case heart(x: Double, y: Double, s: Double, c: String, a: Double)
        case poly(pts: [(Double, Double)], c: String, a: Double)
        case grad(x1: Double, y1: Double, x2: Double, y2: Double, stops: [(Double, String, Double)])

        public static func == (l: Shape, r: Shape) -> Bool { String(describing: l) == String(describing: r) }
    }

    public static func patternShapes(_ pattern: String) -> [Shape] {
        var out: [Shape] = []
        func grid(_ step: Double, _ f: (Double, Double, Int) -> Void) {
            var row = 0
            var y = step / 2
            while y < 1.05 {
                var x = row % 2 == 1 ? step : step / 2
                while x < 1.05 { f(r4(x), r4(y), row); x += step }
                y += step; row += 1
            }
        }
        switch pattern {
        case "twotone": out.append(.rect(x: 0, y: 0.56, w: 1, h: 0.44, c: "ink", a: 1))
        case "stripes":
            var y = 0.1
            while y < 1 { out.append(.rect(x: 0, y: r4(y), w: 1, h: 0.065, c: "ink", a: 1)); y += 0.15 }
        case "dots": grid(0.17) { x, y, _ in out.append(.circle(x: x, y: y, r: 0.045, c: "ink", a: 1)) }
        case "gradient": out.append(.grad(x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.92, stops: [(0, "ink", 0), (1, "ink", 1)]))
        case "sparkle":
            for (x, y, r) in [(0.22, 0.22, 0.05), (0.72, 0.18, 0.04), (0.84, 0.46, 0.05), (0.16, 0.56, 0.04), (0.5, 0.3, 0.03), (0.32, 0.8, 0.05), (0.7, 0.74, 0.04), (0.58, 0.9, 0.03)] {
                out.append(.star(x: x, y: y, r: r, inner: r4(r * 0.35), n: 4, c: "ink", a: 1))
            }
        case "hearts": grid(0.2) { x, y, _ in out.append(.heart(x: x, y: y, s: 0.075, c: "ink", a: 1)) }
        case "stars": grid(0.2) { x, y, _ in out.append(.star(x: x, y: y, r: 0.055, inner: 0.024, n: 5, c: "ink", a: 1)) }
        case "zigzag":
            var y = 0.12
            while y < 1.05 {
                var pts: [(Double, Double)] = []
                for i in 0...10 { pts.append((r4(Double(i) / 10), r4(y + (i % 2 == 1 ? -0.045 : 0.045)))) }
                for i in stride(from: 10, through: 0, by: -1) { pts.append((r4(Double(i) / 10), r4(y + 0.06 + (i % 2 == 1 ? -0.045 : 0.045)))) }
                out.append(.poly(pts: pts, c: "ink", a: 1))
                y += 0.2
            }
        case "checkers":
            for r in 0..<8 { for c in 0..<8 where (r + c) % 2 == 0 { out.append(.rect(x: r4(Double(c) / 8), y: r4(Double(r) / 8), w: 0.125, h: 0.125, c: "ink", a: 1)) } }
        case "tiedye":
            for i in stride(from: 7, through: 1, by: -1) {
                out.append(.circle(x: 0.42, y: 0.46, r: r4(Double(i) * 0.11), c: i % 2 == 1 ? "ink" : "light", a: i % 2 == 1 ? 0.85 : 0.5))
            }
        case "leopard":
            grid(0.22) { x, y, row in
                let dx = row % 2 == 1 ? 0.02 : -0.02
                out.append(.circle(x: r4(x + dx), y: y, r: 0.055, c: "ink", a: 1))
                out.append(.circle(x: r4(x + dx + 0.012), y: r4(y - 0.008), r: 0.03, c: "base", a: 1))
            }
        case "galaxy":
            out.append(.grad(x1: 0, y1: 0, x2: 1, y2: 1, stops: [(0, "ink", 0.95), (1, "ink", 0.55)]))
            for (x, y, r) in [(0.18, 0.2, 0.012), (0.7, 0.14, 0.016), (0.42, 0.34, 0.01), (0.86, 0.38, 0.012), (0.25, 0.55, 0.014), (0.6, 0.6, 0.01), (0.8, 0.78, 0.014), (0.35, 0.85, 0.012), (0.12, 0.74, 0.01)] {
                out.append(.circle(x: x, y: y, r: r, c: "light", a: 1))
            }
            for (x, y) in [(0.55, 0.24), (0.2, 0.4), (0.72, 0.5), (0.5, 0.82)] { out.append(.star(x: x, y: y, r: 0.04, inner: 0.012, n: 4, c: "light", a: 1)) }
        case "colorblock": out.append(.rect(x: 0.5, y: 0, w: 0.5, h: 1, c: "ink", a: 1))
        default: break
        }
        return out
    }
}
