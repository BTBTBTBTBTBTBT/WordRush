import Foundation

// Poses + the living mascot — exact port of packages/core/src/avatar-pose.ts (pinned by
// Tests/Fixtures/avatar-pose-fixtures.json, AvatarPoseTests).
//
// Every player body is rigged ONCE (docs/design/brand/avatar/integration/rig-body.py): the white body art is cut into
// four layers (feet behind, base, two mitten arms), so tint still works and the rest pose is the body exactly. Poses
// are SHARED DATA (avatar-poses.json): a rotation / offset per limb plus a small body squash, so a new body gets every
// pose for free. This file turns a pose into per-layer affine matrices (body units) and evaluates the living mascot
// (breathe, blink, its saved pose, tap = hop + laugh, moment reactions). Pure.
//
// Everything new ships behind AvatarLiveConfig.livingMascot (OFF): with it off no surface draws a pose, the Pose tab
// is hidden and every mascot renders exactly as before.

/// The feature flag + performance rules (founder: smooth over pretty).
public enum AvatarLiveConfig {
    /// OFF until verified on devices: poses, the Pose tab and the living mascot all stand down.
    public static let livingMascot: Bool = false
    /// At most this many mascots animate on one screen (the player's own first); the rest hold their pose frame.
    public static let maxAnimated: Int = 3
    /// Android holds still between moves (like the cast): breathing only while a move / reaction plays.
    public static let androidIdleStill: Bool = true
}

/// [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (the CGAffineTransform order).
public typealias AvatarMatrix = [Double]

public struct AvatarPoseLimb: Codable, Equatable {
    public var rot: Double?
    public var dx: Double?
    public var dy: Double?
    public init(rot: Double? = nil, dx: Double? = nil, dy: Double? = nil) { self.rot = rot; self.dx = dx; self.dy = dy }
}

public struct AvatarPoseSpec: Codable, Equatable {
    public struct Arms: Codable, Equatable {
        public var L: AvatarPoseLimb?
        public var R: AvatarPoseLimb?
        public init(L: AvatarPoseLimb? = nil, R: AvatarPoseLimb? = nil) { self.L = L; self.R = R }
    }
    public struct Body: Codable, Equatable {
        public var dy: Double?
        public var rot: Double?
        public var sx: Double?
        public var sy: Double?
        public init(dy: Double? = nil, rot: Double? = nil, sx: Double? = nil, sy: Double? = nil) {
            self.dy = dy; self.rot = rot; self.sx = sx; self.sy = sy
        }
    }
    public struct Feet: Codable, Equatable {
        public var dy: Double?
        public var sx: Double?
        public var sy: Double?
        public init(dy: Double? = nil, sx: Double? = nil, sy: Double? = nil) { self.dy = dy; self.sx = sx; self.sy = sy }
    }
    public var arms: Arms?
    public var body: Body?
    public var feet: Feet?
    public init(arms: Arms? = nil, body: Body? = nil, feet: Feet? = nil) { self.arms = arms; self.body = body; self.feet = feet }

    func limb(_ side: String) -> AvatarPoseLimb? { side == "L" ? arms?.L : arms?.R }
}

/// A pose in avatar-poses.json: its label, the spec (arms / body / feet) and the living extras.
public struct AvatarPoseDef: Decodable, Equatable {
    public struct Wave: Decodable, Equatable { public var limb: String; public var amp: Double; public var period: Double }
    public struct Bounce: Decodable, Equatable { public var amp: Double; public var period: Double }
    public struct Live: Decodable, Equatable { public var wave: Wave?; public var bounce: Bounce? }

    public var label: String
    public var spec: AvatarPoseSpec
    /// Living extras: a waving arm, a cheer bounce.
    public var live: Live?

    private enum CodingKeys: String, CodingKey { case label, live }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        label = (try? c.decodeIfPresent(String.self, forKey: .label)) ?? ""
        live = try c.decodeIfPresent(Live.self, forKey: .live)
        spec = try AvatarPoseSpec(from: decoder)
    }
}

/// A rigged body (body units): shoulder pivots, hand centers, the hip-line center (feet pivot), the floor.
public struct AvatarBodyRig: Decodable, Equatable {
    public struct Arm: Decodable, Equatable {
        public var pivot: [Double]
        public var hand: [Double]
        public var handR: [Double]?
        public var box: [Double]?
    }
    public struct Feet: Decodable, Equatable {
        public var pivot: [Double]
        public var box: [Double]?
    }
    public var armL: Arm
    public var armR: Arm
    public var feet: Feet
    public var floor: Double
    public var hips: Double?
}

/// avatar-poses.json: the poses, the rigs per body and the per-pose withholds.
public struct AvatarPosesData: Decodable, Equatable {
    public var version: Int
    public var poses: [String: AvatarPoseDef]
    /// Poses that need a new hand drawing, not shipped.
    public var needsHandArt: [String]
    public var rigs: [String: AvatarBodyRig]
    /// pose → body → item keys withheld in that pose (they fail the guards there).
    public var withheld: [String: [String: [String]]]

    private enum CodingKeys: String, CodingKey { case version, poses, needsHandArt, rigs, withheld }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = (try? c.decodeIfPresent(Int.self, forKey: .version)) ?? 1
        poses = try c.decodeIfPresent([String: AvatarPoseDef].self, forKey: .poses) ?? [:]
        needsHandArt = (try? c.decodeIfPresent([String].self, forKey: .needsHandArt)) ?? []
        rigs = try c.decodeIfPresent([String: AvatarBodyRig].self, forKey: .rigs) ?? [:]
        withheld = (try? c.decodeIfPresent([String: [String: [String]]].self, forKey: .withheld)) ?? [:]
    }

    public static func decode(_ data: Data) throws -> AvatarPosesData { try JSONDecoder().decode(AvatarPosesData.self, from: data) }

    /// The app's bundled avatar-poses.json (nil outside the app, e.g. in the package tests).
    public static let bundled: AvatarPosesData? = {
        guard let url = Bundle.main.url(forResource: "avatar-poses", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? decode(data)
    }()
}

/// The per-part matrices of a pose (body units, or content fractions in a layout). `base` = `root`.
public struct AvatarPoseParts: Equatable {
    public var root: AvatarMatrix
    public var armL: AvatarMatrix
    public var armR: AvatarMatrix
    public var handL: AvatarMatrix
    public var handR: AvatarMatrix
    public var feet: AvatarMatrix
    public var base: AvatarMatrix { root }

    public init(root: AvatarMatrix, armL: AvatarMatrix, armR: AvatarMatrix, handL: AvatarMatrix, handR: AvatarMatrix, feet: AvatarMatrix) {
        self.root = root; self.armL = armL; self.armR = armR; self.handL = handL; self.handR = handR; self.feet = feet
    }

    /// The matrix a ride uses ('none' / unknown = identity).
    public subscript(_ ride: String) -> AvatarMatrix {
        switch ride {
        case "root", "base": return root
        case "armL": return armL
        case "armR": return armR
        case "handL": return handL
        case "handR": return handR
        case "feet": return feet
        default: return AvatarPose.identity
        }
    }

    public func map(_ f: (AvatarMatrix) -> AvatarMatrix) -> AvatarPoseParts {
        AvatarPoseParts(root: f(root), armL: f(armL), armR: f(armR), handL: f(handL), handR: f(handR), feet: f(feet))
    }
}

/// A moment the mascot reacts to (win = cheer, loss = shrug, streak +1 = hop, level up = cheer).
public enum AvatarReaction: String, CaseIterable, Equatable {
    case win, loss, streak, levelup

    public var pose: String {
        switch self {
        case .win: return "cheer"
        case .loss: return "shrug"
        case .streak: return "none"
        case .levelup: return "cheer"
        }
    }

    /// How long a reaction plays (s); streak is a hop.
    public var seconds: Double {
        switch self {
        case .win: return 2.4
        case .loss: return 2.2
        case .streak: return 0.9
        case .levelup: return 2.6
        }
    }
}

/// One living-mascot input (see AvatarPose.liveFrame).
public struct AvatarLiveInput: Equatable {
    /// The saved pose ("none" = the body as drawn).
    public var pose: String
    /// Wall clock (s).
    public var t: Double
    /// Seconds since a tap, else nil.
    public var tap: Double?
    /// A reaction playing + seconds since it started, else nil.
    public var reaction: (kind: AvatarReaction, t: Double)?
    /// Press-and-hold squish (0 → 1).
    public var press: Double?
    /// Reduce Motion: the saved pose holds; a tap only shows the laugh.
    public var still: Bool
    /// Ambient off (Android between moves): no breathing / waving, blinks keep going.
    public var ambient: Bool
    /// A per-mascot blink seed (the cast's LCG).
    public var blinkSeed: Double?

    public init(pose: String, t: Double, tap: Double? = nil, reaction: (kind: AvatarReaction, t: Double)? = nil, press: Double? = nil,
                still: Bool = false, ambient: Bool = true, blinkSeed: Double? = nil) {
        self.pose = pose; self.t = t; self.tap = tap; self.reaction = reaction; self.press = press
        self.still = still; self.ambient = ambient; self.blinkSeed = blinkSeed
    }

    public static func == (a: AvatarLiveInput, b: AvatarLiveInput) -> Bool {
        a.pose == b.pose && a.t == b.t && a.tap == b.tap && a.reaction?.kind == b.reaction?.kind && a.reaction?.t == b.reaction?.t
            && a.press == b.press && a.still == b.still && a.ambient == b.ambient && a.blinkSeed == b.blinkSeed
    }
}

public struct AvatarLiveFrame: Equatable {
    public var spec: AvatarPoseSpec
    /// Eyes scaleY about their center: 1 open, ~0.1 closed (blink), 0.45 happy squint (laugh).
    public var eyes: Double
    /// 0 → 1: the laughing face (the mouth stretches open 1.25×).
    public var laugh: Double
    public init(spec: AvatarPoseSpec, eyes: Double, laugh: Double) { self.spec = spec; self.eyes = eyes; self.laugh = laugh }
}

public enum AvatarPose {
    /// The pose ids (stored in the avatar config's `pose`; "none" = the body as drawn).
    public static let ids = ["none", "wave", "cheer", "hips", "shrug", "flex", "hug", "sit", "jump"]
    /// The four rig layers, back → front. Art: art-av-body-<body>-<part>.
    public static let rigParts = ["feet", "base", "armL", "armR"]
    /// A held item tilts with its hand at most this much (degrees).
    public static let heldTilt: Double = 30
    public static let identity: AvatarMatrix = [1, 0, 0, 1, 0, 0]

    /// The tap: hop + laugh (same feel as the cast's tap).
    public static let tapDur: Double = 1.1
    public static let tapHop: Double = 0.07
    public static let tapHopT: (Double, Double) = (0.06, 0.5)
    public static let tapLaughIn: Double = 0.08
    public static let tapLaughOut: Double = 0.85
    /// Ease between the saved pose and a reaction / back (s).
    public static let poseBlend: Double = 0.22

    /// The laugh's pitch per body (the cast laugh sounds, pitched: small bodies higher, big ones lower).
    public static let laughRate: [String: Double] = [
        "mini": 1.32, "bean": 1.16, "star": 1.12, "drop": 1.1, "tall": 1.04, "classic": 1.0, "hex": 0.98, "cloud": 0.96, "pear": 0.94,
        "blob": 0.92, "wide": 0.88, "chunky": 0.84,
    ]

    /// JS Math.round (halves toward +∞), to 5 decimals.
    public static func r5(_ v: Double) -> Double { jsRound(v * 100000) / 100000 }

    /// Exactly JS Math.round: the nearest integer, ties toward +∞.
    public static func jsRound(_ x: Double) -> Double {
        guard x.isFinite else { return x }
        let f = x.rounded(.down)
        return x - f >= 0.5 ? f + 1 : f
    }

    public static func matMul(_ m: AvatarMatrix, _ n: AvatarMatrix) -> AvatarMatrix {
        let a0 = m[0] * n[0] + m[2] * n[1]
        let a1 = m[1] * n[0] + m[3] * n[1]
        let a2 = m[0] * n[2] + m[2] * n[3]
        let a3 = m[1] * n[2] + m[3] * n[3]
        let a4 = m[0] * n[4] + m[2] * n[5] + m[4]
        let a5 = m[1] * n[4] + m[3] * n[5] + m[5]
        return [a0, a1, a2, a3, a4, a5]
    }

    static func T(_ x: Double, _ y: Double) -> AvatarMatrix { [1, 0, 0, 1, x, y] }
    static func S(_ x: Double, _ y: Double) -> AvatarMatrix { [x, 0, 0, y, 0, 0] }
    static func Rd(_ deg: Double) -> AvatarMatrix {
        let r = deg * Double.pi / 180
        return [cos(r), sin(r), -sin(r), cos(r), 0, 0]
    }
    static func chain(_ ms: AvatarMatrix...) -> AvatarMatrix { ms.reduce(identity) { matMul($0, $1) } }

    /// A point through a matrix.
    public static func matApply(_ m: AvatarMatrix, _ x: Double, _ y: Double) -> (Double, Double) {
        (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
    }

    public static func rig(_ body: String, data: AvatarPosesData) -> AvatarBodyRig? { data.rigs[body] }

    /// A pose's definition ("none" / unknown / nil → nil).
    public static func def(_ pose: String?, data: AvatarPosesData) -> AvatarPoseDef? {
        guard let pose, pose != "none" else { return nil }
        return data.poses[pose]
    }

    /// The per-part matrices (body units) of a pose spec on a rigged body. Arm rot is OUTWARD-positive degrees about the
    /// shoulder pivot for both sides (the viewer's-right arm is mirrored), dx outward-positive, dy down-positive. The body
    /// squashes / tilts about the middle of the hip line; body dy lifts the feet too; the feet squash about the floor.
    public static func matrices(_ rig: AvatarBodyRig, _ spec: AvatarPoseSpec) -> AvatarPoseParts {
        let b = spec.body ?? AvatarPoseSpec.Body()
        let hx = rig.feet.pivot[0], hy = rig.feet.pivot[1]
        let lift = T(0, b.dy ?? 0)
        let root = chain(lift, T(hx, hy), Rd(b.rot ?? 0), S(b.sx ?? 1, b.sy ?? 1), T(-hx, -hy))
        func arm(_ side: String) -> AvatarMatrix {
            let q = spec.limb(side) ?? AvatarPoseLimb()
            let sg: Double = side == "L" ? 1 : -1
            let pv = side == "L" ? rig.armL.pivot : rig.armR.pivot
            let px = pv[0], py = pv[1]
            return chain(root, T(px - sg * (q.dx ?? 0), py + (q.dy ?? 0)), Rd(sg * (q.rot ?? 0)), T(-px, -py))
        }
        let f = spec.feet ?? AvatarPoseSpec.Feet()
        let feet = chain(lift, T(hx, rig.floor + (f.dy ?? 0)), S(f.sx ?? 1, f.sy ?? 1), T(-hx, -rig.floor))
        let armL = arm("L"), armR = arm("R")
        // a hand: moves the rest hand center to where the arm carries it, tilted by the arm's angle clamped to ±heldTilt
        func hand(_ m: AvatarMatrix, _ h: [Double]) -> AvatarMatrix {
            let (x, y) = matApply(m, h[0], h[1])
            let deg = atan2(m[1], m[0]) * 180 / Double.pi
            let tilt = max(-heldTilt, min(heldTilt, deg))
            let k = (abs(root[0] * root[3] - root[1] * root[2])).squareRoot()
            return chain(T(x, y), Rd(tilt), S(k, k), T(-h[0], -h[1]))
        }
        return AvatarPoseParts(root: root, armL: armL, armR: armR, handL: hand(armL, rig.armL.hand), handR: hand(armR, rig.armR.hand), feet: feet)
    }

    /// Items withheld in a pose on a body (they fail the per-pose guards).
    public static func withheld(_ pose: String?, body: String, data: AvatarPosesData) -> [String] {
        guard let pose, pose != "none" else { return [] }
        return data.withheld[pose]?[body] ?? []
    }

    // MARK: The living mascot

    static func lerp(_ a: Double, _ b: Double, _ k: Double) -> Double { a + (b - a) * k }
    static func smooth(_ x: Double) -> Double { let c = min(1, max(0, x)); return c * c * (3 - 2 * c) }

    static func limbLerp(_ a: AvatarPoseLimb?, _ b: AvatarPoseLimb?, _ k: Double) -> AvatarPoseLimb {
        let a = a ?? AvatarPoseLimb(), b = b ?? AvatarPoseLimb()
        return AvatarPoseLimb(rot: lerp(a.rot ?? 0, b.rot ?? 0, k), dx: lerp(a.dx ?? 0, b.dx ?? 0, k), dy: lerp(a.dy ?? 0, b.dy ?? 0, k))
    }

    /// Blend two pose specs (k = 0 → a, 1 → b).
    public static func lerpSpec(_ a: AvatarPoseSpec, _ b: AvatarPoseSpec, _ k: Double) -> AvatarPoseSpec {
        let ab = a.body ?? AvatarPoseSpec.Body(), bb = b.body ?? AvatarPoseSpec.Body()
        let af = a.feet ?? AvatarPoseSpec.Feet(), bf = b.feet ?? AvatarPoseSpec.Feet()
        return AvatarPoseSpec(
            arms: AvatarPoseSpec.Arms(L: limbLerp(a.arms?.L, b.arms?.L, k), R: limbLerp(a.arms?.R, b.arms?.R, k)),
            body: AvatarPoseSpec.Body(dy: lerp(ab.dy ?? 0, bb.dy ?? 0, k), rot: lerp(ab.rot ?? 0, bb.rot ?? 0, k),
                                      sx: lerp(ab.sx ?? 1, bb.sx ?? 1, k), sy: lerp(ab.sy ?? 1, bb.sy ?? 1, k)),
            feet: AvatarPoseSpec.Feet(dy: lerp(af.dy ?? 0, bf.dy ?? 0, k), sx: lerp(af.sx ?? 1, bf.sx ?? 1, k), sy: lerp(af.sy ?? 1, bf.sy ?? 1, k)))
    }

    /// The cast's blink schedule (same LCG as cast-rig blinkTimes): a blink starts every 3–5 s.
    public static func blinkTimes(seed: Double, start: Double = 1.3, until: Double = 600) -> [Double] {
        var out: [Double] = []
        var t = start
        var s = seed
        while t < until {
            out.append(t)
            s = (s * 9301 + 49297).truncatingRemainder(dividingBy: 233280)
            t += 3 + 2 * (s / 233280)
        }
        return out
    }

    static func blinkAt(_ seed: Double, _ t: Double) -> Double {
        let tt = (t.truncatingRemainder(dividingBy: 600) + 600).truncatingRemainder(dividingBy: 600)
        for b in blinkTimes(seed: seed) {
            if b > tt { break }
            let d = tt - b
            if d < 0.16 { return d < 0.04 || d > 0.12 ? 0.5 : 0.1 }
        }
        return 1
    }

    /// One frame of the living mascot: the pose spec to draw + the face. Pure (same input → same frame).
    public static func liveFrame(_ input: AvatarLiveInput, data: AvatarPosesData) -> AvatarLiveFrame {
        let t = input.t, still = input.still, ambient = input.ambient
        let saved = def(input.pose, data: data)
        var spec = saved?.spec ?? AvatarPoseSpec()
        // a reaction blends in, holds, and blends back to the saved pose
        let rx = input.reaction
        var hop: Double = 0
        if let rx, !still {
            let dur = rx.kind.seconds
            if rx.t >= 0 && rx.t < dur {
                let target = def(rx.kind.pose, data: data)?.spec ?? saved?.spec ?? AvatarPoseSpec()
                let k = smooth(min(rx.t, dur - rx.t) / poseBlend)
                spec = lerpSpec(spec, target, k)
                if rx.kind == .streak || rx.kind == .win || rx.kind == .levelup {
                    // a hop (the cheers hop twice)
                    let per = rx.kind == .streak ? 0.6 : 0.55
                    let n: Double = rx.kind == .streak ? 1 : 2
                    let tt = rx.t - 0.1
                    if tt > 0 && tt < per * n { hop = max(hop, 0.06 * sin((tt.truncatingRemainder(dividingBy: per) / per) * Double.pi)) }
                }
            }
        }
        var reactionLive: AvatarPoseDef.Live? = nil
        if let rx, !still, rx.t < rx.kind.seconds { reactionLive = def(rx.kind.pose, data: data)?.live }
        let live = reactionLive ?? saved?.live
        var bdy = spec.body?.dy ?? 0, brot = spec.body?.rot ?? 0, bsx = spec.body?.sx ?? 1, bsy = spec.body?.sy ?? 1
        var armsL = spec.arms?.L ?? AvatarPoseLimb()
        var armsR = spec.arms?.R ?? AvatarPoseLimb()
        let feet = spec.feet ?? AvatarPoseSpec.Feet()
        if !still && ambient {
            // breathing (the cast's 3.4 s breath) + the pose's own idle motion
            let br = sin((t / 3.4) * Double.pi * 2)
            bsy *= 1 + 0.012 * br
            bsx *= 1 - 0.006 * br
            if let w = live?.wave {
                let add = w.amp * sin((t / w.period) * Double.pi * 2)
                if w.limb == "L" { armsL.rot = (armsL.rot ?? 0) + add } else { armsR.rot = (armsR.rot ?? 0) + add }
            }
            if let bo = live?.bounce { bdy -= bo.amp * abs(sin((t / bo.period) * Double.pi)) }
        }
        // the tap: hop + squash + laugh (Reduce Motion: only the laugh)
        var laugh: Double = 0
        if let tap = input.tap, tap >= 0, tap < tapDur {
            laugh = smooth(tap / tapLaughIn) * (1 - smooth((tap - tapLaughOut) / (tapDur - tapLaughOut)))
            if !still {
                let h0 = tapHopT.0, h1 = tapHopT.1
                if tap >= h0 && tap < h1 { hop = max(hop, tapHop * sin(((tap - h0) / (h1 - h0)) * Double.pi)) }
                let sq: Double = tap < h0 ? -0.06 * (tap / h0)
                    : tap < h1 ? 0.04 * sin(((tap - h0) / (h1 - h0)) * Double.pi)
                    : -0.05 * sin(min(1, (tap - h1) / 0.25) * Double.pi)
                bsy *= 1 + sq
                bsx *= 1 - sq * 0.6
                // arms fly up a little on the hop
                armsL.rot = (armsL.rot ?? 0) + 40 * (hop / tapHop)
                armsR.rot = (armsR.rot ?? 0) + 40 * (hop / tapHop)
            }
        }
        if hop != 0 { bdy -= hop }
        let press = still ? 0 : (input.press ?? 0)
        if press != 0 { bsy *= 1 - 0.08 * press; bsx *= 1 + 0.06 * press }
        var eyes = still ? 1 : blinkAt(input.blinkSeed ?? 7, t)
        if laugh > 0.5 { eyes = 0.45 }
        func limb(_ l: AvatarPoseLimb) -> AvatarPoseLimb { AvatarPoseLimb(rot: r5(l.rot ?? 0), dx: r5(l.dx ?? 0), dy: r5(l.dy ?? 0)) }
        return AvatarLiveFrame(
            spec: AvatarPoseSpec(arms: AvatarPoseSpec.Arms(L: limb(armsL), R: limb(armsR)),
                                 body: AvatarPoseSpec.Body(dy: r5(bdy), rot: r5(brot), sx: r5(bsx), sy: r5(bsy)),
                                 feet: AvatarPoseSpec.Feet(dy: r5(feet.dy ?? 0), sx: r5(feet.sx ?? 1), sy: r5(feet.sy ?? 1))),
            eyes: eyes,
            laugh: r5(laugh))
    }

    /// The poses the living mascot's fit leaves room for (its reactions + the tap hop never leave the tile).
    public static func liveRoom(data: AvatarPosesData) -> [AvatarPoseSpec] {
        var out: [AvatarPoseSpec] = []
        for id in ["cheer", "shrug", "wave"] { if let p = data.poses[id] { out.append(p.spec) } }
        out.append(AvatarPoseSpec(arms: AvatarPoseSpec.Arms(L: AvatarPoseLimb(rot: 40), R: AvatarPoseLimb(rot: 40)),
                                  body: AvatarPoseSpec.Body(dy: -0.09)))
        return out
    }
}

/// The notification a mascot moment posts (userInfo["kind"] = AvatarReaction raw value: win / loss / streak / levelup).
public extension Notification.Name {
    static let mascotMoment = Notification.Name("mascotMoment")
}

public enum MascotMoment {
    /// Tell the player's living mascot a moment happened (a no-op while the flag is off).
    public static func post(_ kind: AvatarReaction) {
        guard AvatarLiveConfig.livingMascot else { return }
        NotificationCenter.default.post(name: .mascotMoment, object: nil, userInfo: ["kind": kind.rawValue])
    }
}
