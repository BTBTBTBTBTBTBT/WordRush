import Foundation

/// The cast puppets (2.7.1): the header's ten characters drawn from their rigs (layers cut
/// from the canonical hero art, docs/design/brand/animation/<id>/). The bundle
/// (`cast-rigs.dataset` in Assets.xcassets + `rig-<id>-<layer>` image sets) is written by
/// docs/design/brand/animation/rig-engine/ship-rigs.py, which writes the identical JSON for
/// web and Android. `CastRig.evaluate` is a port of that script's reference evaluator; all
/// three platforms are held to its draw ops by rig-engine/rig-golden.json (CastRigTests).
public struct CastRigBundle: Decodable {
    public let version: Int
    public let layerScale: Double
    public let tap: CastRigTap
    public let cast: [String]
    public let rigs: [String: CastRig]

    public static func decode(_ data: Data) throws -> CastRigBundle {
        try JSONDecoder().decode(CastRigBundle.self, from: data)
    }
}

/// A key: [t, v] or [t, v, ease].
public struct CastRigKey: Decodable {
    public let t: Double
    public let v: Double
    public let ease: String?

    public init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        t = try c.decode(Double.self)
        v = try c.decode(Double.self)
        ease = c.isAtEnd ? nil : try c.decode(String.self)
    }
}

public struct CastRigTap: Decodable {
    public let dur: Double
    public let hop: Double
    public let hopT: [Double]
    public let sq: [CastRigKey]
    public let laugh: [CastRigKey]

    /// The tap's squash and hop (hero px) at `t` s — also drives the costumed (season) figures.
    public func pose(_ t: Double) -> (hop: Double, sq: Double) {
        guard t >= 0, t < dur else { return (0, 0) }
        let h0 = hopT[0], h1 = hopT[1]
        let hp = t >= h0 && t < h1 ? -hop * sin((t - h0) / (h1 - h0) * .pi) : 0
        return (hp, CastRig.kfVal(sq, t))
    }
}

public struct CastRigTrack: Decodable {
    public let kf: [CastRigKey]?
    public let period: Double?
    public let offset: Double?
    public let osc: [Double]?
    public let env: [CastRigKey]?
}

/// A value: a number, a track name, or a summed list of those.
public indirect enum CastRigSpec: Decodable {
    case num(Double)
    case track(String)
    case sum([CastRigSpec])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let d = try? c.decode(Double.self) { self = .num(d) }
        else if let s = try? c.decode(String.self) { self = .track(s) }
        else { self = .sum(try c.decode([CastRigSpec].self)) }
    }
}

public struct CastRigLayer: Decodable {
    public let img: String
    public let pivot: [Double]?
    public let at: [Double]?
    public let pivotInImg: [Double]?
    public let rot, dx, dy, s, sx, sy, alpha: CastRigSpec?
    public let when: String?
    public let shadow: Bool?
}

public struct CastRigBox: Decodable {
    public let x, y, w, h: Double
}

public struct CastRigBreath: Decodable {
    public let origin: [Double]
    public let period, sy, sx: Double
}

public struct CastRigRoot: Decodable {
    public let origin: [Double]?
    public let dx, dy, rot, sx, sy: CastRigSpec?
}

public struct CastRigMascot: Decodable {
    /// mascot px = hero px * s + (ox, oy), in the `size`-px `mascot-<id>` square.
    public let size, s, ox, oy: Double
}

public struct CastRigBlink: Decodable {
    public let half: String?
    public let closed: String?
}

/// One draw: the layer image drawn into (0, 0, w, h) hero px under the affine
/// [a, b, c, d, tx, ty] (x' = a x + c y + tx, y' = b x + d y + ty), at `alpha`.
public struct CastRigOp: Equatable {
    public let layer: String
    public let m: [Double]
    public let alpha: Double
}

public final class CastRig: Decodable {
    public let id: String
    public let name: String
    public let cycle: Double
    public let breath: CastRigBreath?
    public let root: CastRigRoot?
    public let blink: CastRigBlink?
    public let eyesTrack: String?
    public let laugh: [String]
    public let patchAfter: String?
    public let blinkSeed: Double
    public let blinkStart: Double
    public let tracks: [String: CastRigTrack]
    public let layers: [CastRigLayer]
    public let lay: [String: CastRigBox]
    public let mascot: CastRigMascot
    public let warp: [[Double]]
    public let gestureWindow: [Double]?

    private enum CodingKeys: String, CodingKey {
        case id, name, cycle, breath, root, blink, eyesTrack, laugh, patchAfter, blinkSeed, blinkStart
        case tracks, layers, lay, mascot, warp, gestureWindow
    }

    private lazy var blinks: [Double] = CastRig.blinkTimes(seed: blinkSeed, start: blinkStart)

    /// How long (s) the signature move plays in real time (0 = none).
    public var gestureSeconds: Double { gestureWindow == nil ? 0 : (warp.last?[0] ?? 0) }

    // MARK: math

    static let ease: [String: (Double) -> Double] = [
        "linear": { $0 },
        "in": { $0 * $0 },
        "out": { 1 - (1 - $0) * (1 - $0) },
        "inOut": { $0 < 0.5 ? 2 * $0 * $0 : 1 - pow(-2 * $0 + 2, 2) / 2 },
        "sine": { 0.5 - 0.5 * cos(.pi * $0) },
        "inCubic": { $0 * $0 * $0 },
        "outCubic": { 1 - pow(1 - $0, 3) },
        "outBack": { 1 + 2.4 * pow($0 - 1, 3) + 1.4 * pow($0 - 1, 2) },
        "outBackSoft": { 1 + 1.9 * pow($0 - 1, 3) + 0.9 * pow($0 - 1, 2) },
        "step": { $0 < 1 ? 0 : 1 },
    ]

    public static func kfVal(_ kf: [CastRigKey], _ t: Double) -> Double {
        if t <= kf[0].t { return kf[0].v }
        for i in 1..<kf.count where t < kf[i].t {
            let a = kf[i - 1], b = kf[i]
            let p = (t - a.t) / (b.t - a.t)
            let e = ease[b.ease ?? "inOut"] ?? ease["inOut"]!
            return a.v + (b.v - a.v) * e(p)
        }
        return kf[kf.count - 1].v
    }

    public static func blinkTimes(seed: Double, start: Double) -> [Double] {
        var out: [Double] = []
        var t = start
        var s = seed
        while t < 900 {
            out.append(t)
            s = (s * 9301 + 49297).truncatingRemainder(dividingBy: 233280)
            t += 3 + 2 * (s / 233280)
        }
        return out
    }

    private func isFree(_ tr: CastRigTrack) -> Bool {
        if tr.kf != nil { return (tr.period ?? 0) != 0 && abs((tr.period ?? 0) - cycle) > 1e-6 }
        return tr.env == nil
    }

    private func pmod(_ a: Double, _ p: Double) -> Double { ((a.truncatingRemainder(dividingBy: p)) + p).truncatingRemainder(dividingBy: p) }

    /// `t` nil = ambient off: the free-running idle sways hold their rest value.
    func trackVal(_ name: String, _ t: Double?, _ g: Double) -> Double {
        guard let tr = tracks[name] else { return 0 }
        let free = isFree(tr)
        if free && t == nil { return restVal(name) }
        let c = free ? t! : g
        var v = 0.0
        if let kf = tr.kf {
            let P = (tr.period ?? 0) != 0 ? tr.period! : cycle
            let o = tr.offset ?? 0
            v += CastRig.kfVal(kf, free ? pmod(c - o, P) : min(c, P))
        }
        if let osc = tr.osc {
            let amp = osc[0], per = osc[1]
            let t0 = osc.count > 2 ? osc[2] : 0
            let bounce = osc.count > 3 ? osc[3] : 0
            var o = bounce != 0 ? -abs(amp * sin(.pi * (c - t0) / per)) : amp * sin(2 * .pi * (c - t0) / per)
            if let env = tr.env { o *= CastRig.kfVal(env, min(c, cycle)) }
            v += o
        }
        return v
    }

    private func restVal(_ name: String) -> Double { tracks[name]?.kf?.first?.v ?? 0 }

    private func val(_ spec: CastRigSpec?, _ t: Double?, _ g: Double, _ still: Bool, _ dflt: Double) -> Double {
        guard let spec else { return dflt }
        switch spec {
        case .num(let d): return d
        case .track(let n): return still ? restVal(n) : trackVal(n, t, g)
        case .sum(let xs): return xs.reduce(0) { $0 + val($1, t, g, still, 0) }
        }
    }

    private func warpG(_ r: Double) -> Double {
        if r <= warp[0][0] { return warp[0][1] }
        for i in 1..<warp.count where r < warp[i][0] {
            let a = warp[i - 1], b = warp[i]
            return a[1] + (b[1] - a[1]) * (r - a[0]) / (b[0] - a[0])
        }
        return warp[warp.count - 1][1]
    }

    private func blinkState(_ t: Double) -> String? {
        let tt = t.truncatingRemainder(dividingBy: 900)
        for b in blinks {
            if b > tt { break }
            let d = tt - b
            if d < 0.16 { return d < 0.04 || d > 0.12 ? "half" : "closed" }
        }
        return nil
    }

    private typealias M = [Double]
    private static func mul(_ m: M, _ n: M) -> M {
        [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
         m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
         m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
    }
    private static func T(_ x: Double, _ y: Double) -> M { [1, 0, 0, 1, x, y] }
    private static func S(_ x: Double, _ y: Double) -> M { [x, 0, 0, y, 0, 0] }
    private static func Rd(_ deg: Double) -> M {
        let r = deg * .pi / 180
        return [cos(r), sin(r), -sin(r), cos(r), 0, 0]
    }

    /// The draw ops for one frame, back to front. `t` wall clock (s); `gr` seconds since the
    /// signature move started (nil = rest); `tap` seconds since a tap (nil = none); `still`
    /// Reduce Motion (the pose holds; a tap only fades the laughing face in and out).
    public func evaluate(_ B: CastRigBundle, t tw: Double, gr: Double?, tap: Double?, still: Bool, laughOk: Bool = true, ambient: Bool = true) -> [CastRigOp] {
        let TP = B.tap
        // ambient = false: no breathing / idle sways (the rest pose between moves); blinks keep `tw`.
        let t: Double? = ambient ? tw : nil
        let g: Double = (gr == nil || still || gr! >= warp[warp.count - 1][0]) ? 0 : warpG(gr!)
        var hop = 0.0, sq = 0.0, la = 0.0
        if let tap, tap >= 0, tap < TP.dur {
            la = laughOk ? CastRig.kfVal(TP.laugh, tap) : 0
            if !still { (hop, sq) = TP.pose(tap) }
        }
        var ops: [CastRigOp] = []
        for L in layers where L.shadow == true {
            let l = lay[L.img]!
            let f = min(1, max(0, -hop / TP.hop))
            let cx = l.x + l.w / 2, cy = l.y + l.h / 2
            let fl = still ? 0 : val(root?.dy, t, g, still, 0)
            let gg = min(1.2, max(0.5, 1 - 0.35 * f + min(0, fl) * 0.004))
            let m = CastRig.mul(CastRig.mul(CastRig.mul(CastRig.T(cx, cy), CastRig.S(gg, gg)), CastRig.T(-cx, -cy)), CastRig.T(l.x, l.y))
            ops.append(CastRigOp(layer: L.img, m: m, alpha: 1 - 0.45 * f))
        }
        let Br = breath ?? CastRigBreathDefault.value
        let br = still || t == nil ? 0 : sin(t! / Br.period * .pi * 2)
        let sy = 1 + Br.sy * br + sq
        let sx = 1 - Br.sx * br - sq * 0.6
        let o = root?.origin ?? Br.origin
        let rdx = val(root?.dx, t, g, still, 0), rdy = val(root?.dy, t, g, still, 0)
        let rrot = val(root?.rot, t, g, still, 0)
        let rsx = val(root?.sx, t, g, still, 1), rsy = val(root?.sy, t, g, still, 1)
        var rootM = CastRig.mul(CastRig.T(rdx, rdy + hop), CastRig.T(o[0], o[1]))
        rootM = CastRig.mul(CastRig.mul(CastRig.mul(rootM, CastRig.Rd(rrot)), CastRig.S(sx * rsx, sy * rsy)), CastRig.T(-o[0], -o[1]))

        // The laugh face fades in OVER the opaque face (blink lids stay opaque under it), so no
        // frame shows two half-transparent faces; the face under it hides once the laugh is full.
        func patches() {
            if la < 0.998 && !still { blinkPatch() }
            if la > 0.002 {
                for p in laugh { let l = lay[p]!; ops.append(CastRigOp(layer: p, m: CastRig.mul(rootM, CastRig.T(l.x, l.y)), alpha: la)) }
            }
        }
        func blinkPatch() {
            guard let blink else { return }
            var e = blinkState(tw)
            if let et = eyesTrack {
                let v = trackVal(et, t, g)
                if v >= 1.5 { e = "closed" } else if v >= 0.5 && e != "closed" { e = "half" }
            }
            let p = e == "half" ? blink.half : e == "closed" ? blink.closed : nil
            if let p, let l = lay[p] { ops.append(CastRigOp(layer: p, m: CastRig.mul(rootM, CastRig.T(l.x, l.y)), alpha: 1)) }
        }

        var patched = false
        for L in layers where L.shadow != true {
            let aMul = L.when == "laugh" ? la : L.when == "nolaugh" ? (la >= 0.998 ? 0 : 1) : 1
            let l = lay[L.img]!
            let piv = L.pivot ?? [l.x, l.y]
            let at = L.at ?? piv
            let pin = L.pivotInImg ?? [piv[0] - l.x, piv[1] - l.y]
            let rot = val(L.rot, t, g, still, 0), dx = val(L.dx, t, g, still, 0), dy = val(L.dy, t, g, still, 0)
            let s = val(L.s, t, g, still, 1)
            let lsx = val(L.sx, t, g, still, 1) * s, lsy = val(L.sy, t, g, still, 1) * s
            var alpha = L.alpha == nil ? 1 : min(1, max(0, val(L.alpha, t, g, still, 1)))
            alpha *= aMul
            let atRest = abs(rot) < 0.01 && abs(dx) < 0.05 && abs(dy) < 0.05 && abs(lsx - 1) < 1e-3 && abs(lsy - 1) < 1e-3
            if alpha > 0.002 && !(L.when == "active" && atRest) {
                var m = CastRig.mul(rootM, CastRig.T(at[0] + dx, at[1] + dy))
                m = CastRig.mul(CastRig.mul(CastRig.mul(m, CastRig.Rd(rot)), CastRig.S(lsx, lsy)), CastRig.T(-pin[0], -pin[1]))
                ops.append(CastRigOp(layer: L.img, m: m, alpha: alpha))
            }
            if let pa = patchAfter, L.img == pa { patches(); patched = true }
        }
        if !patched { patches() }
        return ops
    }
}

private enum CastRigBreathDefault {
    static let value: CastRigBreath = try! JSONDecoder().decode(
        CastRigBreath.self, from: Data(#"{"origin":[512,960],"period":3.4,"sy":0.012,"sx":0.006}"#.utf8))
}
