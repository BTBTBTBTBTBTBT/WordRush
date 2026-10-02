import Foundation

// FINISH_SPEC §AN — build-your-own-mascot avatars (pure rules).
//
// Exact port of packages/core/src/avatar-config.ts: the option catalogs, the
// validation (unknown / missing ids fall back field by field, never throws), the
// deterministic `defaultAvatar(userId, accent)` every player without a saved
// mascot or photo wears, the Pro-only strip and the ten cast presets. Pinned by
// Tests/Fixtures/avatar-config-fixtures.json (AvatarConfigTests).
//
// The part anchors live in avatar-parts.json (a placeholder until the art-av-*
// art lands); `AvatarParts` decodes it generically so the coordinator can swap
// the file without code changes.

/// profiles.avatar_config (jsonb) — every field is an option id (strings, so a
/// newer client's ids survive a round trip through `validate` as defaults).
public struct AvatarConfig: Codable, Equatable, Hashable {
    public var v: Int
    public var body: String
    /// A swatch id from `AvatarCatalog.colors`.
    public var color: String
    public var pattern: String
    public var patternColor: String
    public var eyes: String
    public var nose: String
    public var mouth: String
    public var head: String
    public var face: String
    public var neck: String
    public var frame: String
    /// The backdrop id (`AvatarCatalog.backdropIds`); "auto" = a light tint of the body color.
    public var bg: String
    /// Which avatar shows for a player who has a photo: "mascot" | "photo".
    /// Picking the mascot never clears avatar_url. Default: "photo" when the
    /// profile has avatar_url, else "mascot" (`defaultAvatar(…, hasPhoto:)`).
    public var display: String

    public init(v: Int = 1, body: String, color: String, pattern: String, patternColor: String, eyes: String,
                nose: String, mouth: String, head: String, face: String, neck: String, frame: String,
                bg: String = "auto", display: String = "mascot") {
        self.v = v; self.body = body; self.color = color; self.pattern = pattern; self.patternColor = patternColor
        self.eyes = eyes; self.nose = nose; self.mouth = mouth; self.head = head; self.face = face
        self.neck = neck; self.frame = frame; self.bg = bg; self.display = display
    }

    private enum CodingKeys: String, CodingKey {
        case v, body, color, pattern, patternColor, eyes, nose, mouth, head, face, neck, frame, bg, display
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        v = (try? c.decodeIfPresent(Int.self, forKey: .v)) ?? 1
        body = try c.decode(String.self, forKey: .body)
        color = try c.decode(String.self, forKey: .color)
        pattern = try c.decode(String.self, forKey: .pattern)
        patternColor = try c.decode(String.self, forKey: .patternColor)
        eyes = try c.decode(String.self, forKey: .eyes)
        nose = try c.decode(String.self, forKey: .nose)
        mouth = try c.decode(String.self, forKey: .mouth)
        head = try c.decode(String.self, forKey: .head)
        face = try c.decode(String.self, forKey: .face)
        neck = try c.decode(String.self, forKey: .neck)
        frame = try c.decode(String.self, forKey: .frame)
        bg = (try? c.decodeIfPresent(String.self, forKey: .bg)) ?? "auto"
        display = (try? c.decodeIfPresent(String.self, forKey: .display)) ?? "mascot"
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(1, forKey: .v)
        try c.encode(body, forKey: .body); try c.encode(color, forKey: .color)
        try c.encode(pattern, forKey: .pattern); try c.encode(patternColor, forKey: .patternColor)
        try c.encode(eyes, forKey: .eyes); try c.encode(nose, forKey: .nose); try c.encode(mouth, forKey: .mouth)
        try c.encode(head, forKey: .head); try c.encode(face, forKey: .face); try c.encode(neck, forKey: .neck)
        try c.encode(frame, forKey: .frame); try c.encode(bg, forKey: .bg)
        try c.encode(display, forKey: .display)
    }

    /// The config as a JSON object (what profiles.avatar_config stores).
    public var jsonObject: [String: Any] {
        var o: [String: Any] = ["v": 1, "body": body, "color": color, "pattern": pattern, "patternColor": patternColor,
                                "eyes": eyes, "nose": nose, "mouth": mouth, "head": head, "face": face, "neck": neck,
                                "frame": frame, "bg": bg, "display": display]
        return o
    }

    /// A stable string key for the DRAWN mascot (caches; `display` doesn't change the drawing).
    public var cacheKey: String {
        [body, color, pattern, patternColor, eyes, nose, mouth, head, face, neck, frame, bg].joined(separator: "|")
    }
}

/// One backdrop (the tile behind the mascot): solid = colors[0]; gradient = a
/// top-left → bottom-right blend; pattern = colors[0] background + colors[1...] motif.
public struct AvatarBackdrop: Equatable {
    public enum Kind: String { case solid, gradient, pattern }
    public let id: String
    public let kind: Kind
    public let colors: [String]
}

/// A raw, untrusted avatar_config from a payload: every field optional and the
/// decode never throws (a malformed value decodes as all-nil), so adding it to a
/// row can never break that row's decoding. Turn it into a real config with
/// `AvatarCatalog.validate(raw, fallback:)`.
public struct AvatarConfigRaw: Codable, Equatable {
    public var fields: [String: String]
    /// False when the payload value was not a JSON object (null / array / string…).
    public var isObject: Bool

    public init(fields: [String: String] = [:], isObject: Bool = true) {
        self.fields = fields; self.isObject = isObject
    }

    public init(_ config: AvatarConfig) {
        var f: [String: String] = [:]
        for (k, v) in config.jsonObject { if let s = v as? String { f[k] = s } }
        self.init(fields: f, isObject: true)
    }

    private struct Key: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }

    public init(from decoder: Decoder) throws {
        guard let c = try? decoder.container(keyedBy: Key.self) else {
            self.init(fields: [:], isObject: false); return
        }
        var f: [String: String] = [:]
        for k in c.allKeys { if let s = try? c.decode(String.self, forKey: k) { f[k.stringValue] = s } }
        self.init(fields: f, isObject: true)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        if fields["v"] == nil, let k = Key(stringValue: "v") { try c.encode(1, forKey: k) }
        for (k, v) in fields { if let key = Key(stringValue: k) { try c.encode(v, forKey: key) } }
    }

    /// The JSON-object view `AvatarCatalog.validate` reads (nil when not an object).
    public var jsonObject: [String: Any]? { isObject ? fields : nil }
}

/// The option catalogs + rules (packages/core avatar-config.ts).
public enum AvatarCatalog {
    public static let bodies = ["classic", "tall", "wide", "blob", "bean", "star"]
    public static let patterns = ["solid", "twotone", "stripes", "dots", "gradient", "sparkle"]
    public static let eyes = ["beady", "happy", "sparkly", "sleepy", "wink", "hearts", "stars", "glasses", "cyclops"]
    public static let mouths = ["smile", "grin", "tongue", "o", "cat", "toothy", "smirk", "tiny", "gasp"]
    public static let noses = ["none", "button", "red", "blush", "freckles"]
    /// Hats (AN addendum: 21 + none). Pro-only: crown, halo, tiara.
    public static let heads = ["none", "crown", "party", "beanie", "sprout", "nightcap", "headphones", "bow", "wizard", "pirate",
                               "cowboy", "chef", "grad", "halo", "flower", "tophat", "propeller", "catears", "bunnyears", "tiara",
                               "viking", "sweatband"]
    /// Face extras (AN addendum).
    public static let faces = ["none", "mustache", "heart-glasses", "monocle"]
    /// Neck / back extras (AN addendum). Pro-only: wings, chain.
    public static let necks = ["none", "cape", "wings", "bowtie", "scarf", "chain"]
    public static let frames = ["none", "bronze", "silver", "gold", "platinum", "diamond", "pro"]
    /// "Which avatar shows" for players with a photo.
    public static let displays = ["mascot", "photo"]

    /// The Backdrop tab (AN addendum). "auto" (the default) = a light tint of the body color.
    public static let backdrops: [AvatarBackdrop] = [
        AvatarBackdrop(id: "lilac", kind: .solid, colors: ["#ede9fe"]),
        AvatarBackdrop(id: "bubblegum", kind: .solid, colors: ["#fce7f3"]),
        AvatarBackdrop(id: "sky", kind: .solid, colors: ["#e0f2fe"]),
        AvatarBackdrop(id: "mint", kind: .solid, colors: ["#dcfce7"]),
        AvatarBackdrop(id: "lemon", kind: .solid, colors: ["#fef9c3"]),
        AvatarBackdrop(id: "peach", kind: .solid, colors: ["#ffedd5"]),
        AvatarBackdrop(id: "cloud", kind: .solid, colors: ["#f1f5f9"]),
        AvatarBackdrop(id: "night", kind: .solid, colors: ["#1e1b4b"]),
        AvatarBackdrop(id: "sunset", kind: .gradient, colors: ["#fb923c", "#ec4899"]),
        AvatarBackdrop(id: "ocean", kind: .gradient, colors: ["#0ea5e9", "#1e40af"]),
        AvatarBackdrop(id: "cottoncandy", kind: .gradient, colors: ["#f9a8d4", "#a5b4fc"]),
        AvatarBackdrop(id: "aurora", kind: .gradient, colors: ["#34d399", "#8b5cf6", "#0ea5e9"]),
        AvatarBackdrop(id: "galaxy", kind: .pattern, colors: ["#4c1d95", "#fde68a"]),
        AvatarBackdrop(id: "polka", kind: .pattern, colors: ["#fce7f3", "#f472b6"]),
        AvatarBackdrop(id: "starry", kind: .pattern, colors: ["#1e3a8a", "#facc15"]),
        AvatarBackdrop(id: "sunburst", kind: .pattern, colors: ["#fde68a", "#f59e0b"]),
        AvatarBackdrop(id: "checkers", kind: .pattern, colors: ["#ede9fe", "#c4b5fd"]),
        AvatarBackdrop(id: "confetti", kind: .pattern, colors: ["#fff7ed", "#ec4899", "#22c55e", "#2563eb", "#f5a524"]),
    ]
    public static var backdropIds: [String] { ["auto"] + backdrops.map(\.id) }
    public static func backdrop(_ id: String) -> AvatarBackdrop? { backdrops.first { $0.id == id } }

    /// The 16 swatches: the cast palette (12) + 4 extras. Ids are stable (stored); hexes are the tint.
    public static let colors: [(id: String, hex: String)] = [
        ("purple", "#7c3aed"), ("violet", "#8b5cf6"), ("pink", "#ec4899"), ("red", "#ef4444"),
        ("orange", "#f97316"), ("amber", "#f5a524"), ("yellow", "#eab308"), ("green", "#22c55e"),
        ("emerald", "#10b981"), ("teal", "#0d9488"), ("sky", "#0ea5e9"), ("blue", "#2563eb"),
        ("lilac", "#c4b5fd"), ("peach", "#fdba74"), ("mint", "#86efac"), ("slate", "#64748b"),
    ]
    public static var colorIds: [String] { colors.map(\.id) }

    /// Pro-only options (free players see the gold PRO pill → the Go Pro page).
    public static let proOnlyHeads = ["crown", "halo", "tiara"]
    public static let proOnlyNecks = ["wings", "chain"]
    public static let proOnlyFrames = ["diamond", "pro"]
    public static let proOnlyBackdrops = ["aurora", "galaxy"]

    /// The friendly subsets the deterministic default picks from (never the odd ones).
    static let defaultEyes = ["beady", "happy", "sparkly", "wink"]
    static let defaultMouths = ["smile", "grin", "tiny", "cat"]
    static let defaultBodies = ["classic", "tall", "wide", "blob", "bean"]

    /// FNV-1a 32-bit over UTF-16 code units (core captionHash).
    public static func hash(_ key: String) -> UInt32 {
        var h: UInt32 = 2166136261
        for c in key.utf16 {
            h ^= UInt32(c)
            h = h &* 16777619
        }
        return h
    }

    /// "#rrggbb" → (r, g, b); nil unless exactly 6 hex digits (after dropping the
    /// first "#" and trimming — JS `hex.replace('#', '').trim()`).
    static func hexRgb(_ hex: String) -> (Int, Int, Int)? {
        var s = hex
        if let r = s.range(of: "#") { s.removeSubrange(r) }
        let h = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard h.count == 6, h.allSatisfy({ $0.isHexDigit && $0.isASCII }), let v = Int(h, radix: 16) else { return nil }
        return ((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff)
    }

    /// The swatch id nearest an accent hex (squared RGB distance; ties → the earlier swatch). Unknown → "purple".
    public static func nearestColor(_ accentHex: String?) -> String {
        guard let accentHex, let a = hexRgb(accentHex) else { return "purple" }
        var best = colors[0].id
        var bestD = Int.max
        for c in colors {
            guard let b = hexRgb(c.hex) else { continue }
            let d = (a.0 - b.0) * (a.0 - b.0) + (a.1 - b.1) * (a.1 - b.1) + (a.2 - b.2) * (a.2 - b.2)
            if d < bestD { bestD = d; best = c.id }
        }
        return best
    }

    /// The deterministic friendly default (`userId` = the seed: the player's LOWERCASED
    /// USERNAME, "" → "guest", web/Android parity): body / eyes / mouth seeded by
    /// FNV-1a(userId) (bits 0–7, 8–15, 16–23 picking from the friendly subsets),
    /// the accent's nearest swatch as the color, solid, no nose / accessory / frame,
    /// the "auto" backdrop; display = "photo" when `hasPhoto`, else "mascot".
    public static func defaultAvatar(userId: String, accentHex: String? = nil, hasPhoto: Bool = false) -> AvatarConfig {
        let h = hash(userId.isEmpty ? "guest" : userId)
        let color = nearestColor(accentHex)
        return AvatarConfig(
            body: defaultBodies[Int(h & 0xff) % defaultBodies.count],
            color: color, pattern: "solid", patternColor: color,
            eyes: defaultEyes[Int((h >> 8) & 0xff) % defaultEyes.count],
            nose: "none",
            mouth: defaultMouths[Int((h >> 16) & 0xff) % defaultMouths.count],
            head: "none", face: "none", neck: "none", frame: "none", bg: "auto",
            display: hasPhoto ? "photo" : "mascot")
    }

    private static func pick(_ value: Any?, _ allowed: [String], _ fallback: String) -> String {
        if let s = value as? String, allowed.contains(s) { return s }
        return fallback
    }

    /// A stored / incoming config made safe: every unknown or missing field falls
    /// back to `fallback` (default: `defaultAvatar("")`). Non-objects → the fallback.
    /// `raw` is a JSONSerialization value ([String: Any], [Any], String, NSNull, nil…).
    public static func validate(_ raw: Any?, fallback: AvatarConfig = defaultAvatar(userId: "")) -> AvatarConfig {
        guard let r = raw as? [String: Any] else { return fallback }
        let ids = colorIds
        let color = (r["color"] as? String).flatMap { ids.contains($0) ? $0 : nil } ?? fallback.color
        let patternColor = (r["patternColor"] as? String).flatMap { ids.contains($0) ? $0 : nil } ?? color
        return AvatarConfig(
            body: pick(r["body"], bodies, fallback.body),
            color: color,
            pattern: pick(r["pattern"], patterns, fallback.pattern),
            patternColor: patternColor,
            eyes: pick(r["eyes"], eyes, fallback.eyes),
            nose: pick(r["nose"], noses, fallback.nose),
            mouth: pick(r["mouth"], mouths, fallback.mouth),
            head: pick(r["head"], heads, fallback.head),
            face: pick(r["face"], faces, fallback.face),
            neck: pick(r["neck"], necks, fallback.neck),
            frame: pick(r["frame"], frames, fallback.frame),
            bg: pick(r["bg"], backdropIds, fallback.bg),
            display: (r["display"] as? String).flatMap { displays.contains($0) ? $0 : nil } ?? fallback.display)
    }

    /// `validate` for a lenient payload field (nil / non-object → the fallback).
    public static func validate(raw: AvatarConfigRaw?, fallback: AvatarConfig = defaultAvatar(userId: "")) -> AvatarConfig {
        validate(raw?.jsonObject, fallback: fallback)
    }

    /// Re-validate a typed config (e.g. one decoded from a local cache).
    public static func validate(config: AvatarConfig, fallback: AvatarConfig = defaultAvatar(userId: "")) -> AvatarConfig {
        validate(config.jsonObject, fallback: fallback)
    }

    /// Strip Pro-only picks for a free player (crown → none, Pro frames → none).
    public static func enforcePro(_ c: AvatarConfig, isPro: Bool) -> AvatarConfig {
        if isPro { return c }
        var out = c
        if proOnlyHeads.contains(c.head) { out.head = "none" }
        if proOnlyNecks.contains(c.neck) { out.neck = "none" }
        if proOnlyFrames.contains(c.frame) { out.frame = "none" }
        if proOnlyBackdrops.contains(c.bg) { out.bg = "auto" }
        return out
    }

    public static func isProOnly(head: String) -> Bool { proOnlyHeads.contains(head) }
    public static func isProOnly(neck: String) -> Bool { proOnlyNecks.contains(neck) }
    public static func isProOnly(frame: String) -> Bool { proOnlyFrames.contains(frame) }
    public static func isProOnly(bg: String) -> Bool { proOnlyBackdrops.contains(bg) }

    /// Whether the PHOTO shows (vs the mascot): `display` decides, and only a
    /// player who has a photo can show one.
    public static func showsPhoto(display: String, hasPhoto: Bool) -> Bool {
        hasPhoto && display == "photo"
    }

    /// Color swatch hex for a swatch id (unknown → purple).
    public static func colorHex(_ id: String) -> String {
        colors.first { $0.id == id }?.hex ?? "#7c3aed"
    }

    /// The swatch as 0xRRGGBB.
    public static func colorValue(_ id: String) -> UInt {
        UInt(colorHex(id).dropFirst(), radix: 16) ?? 0x7C3AED
    }

    /// The ten cast presets ("Start from W" …): the classic body in the
    /// character's bot-cast color (nearest swatch), beady eyes + smile, solid, no accessory.
    public static func castPreset(_ castId: String) -> AvatarConfig {
        let member = BotCast.members.first { $0.mascot == castId }
        let color = nearestColor(member?.color)
        return AvatarConfig(body: "classic", color: color, pattern: "solid", patternColor: color, eyes: "beady",
                            nose: "none", mouth: "smile", head: "none", face: "none", neck: "none", frame: "none", bg: "auto", display: "mascot")
    }

    /// The single white body letter for a username: its first letter or digit,
    /// uppercased ("?" when it has none).
    public static func initial(_ username: String?) -> String {
        let s = (username ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard let ch = s.first(where: { $0.isLetter || $0.isNumber }) else { return "?" }
        return String(ch).uppercased()
    }
}

// MARK: - Part anchors (avatar-parts.json)

/// The part manifest: per body shape the anchors (0–1 body coordinates) and per
/// part slot its anchor + scale. Generic so the coordinator can replace the file.
public struct AvatarParts: Codable, Equatable {
    public struct HeadTop: Codable, Equatable {
        public var x: Double
        public var y: Double
        public var w: Double
    }

    public struct Body: Codable, Equatable {
        /// [x, y]
        public var faceCenter: [Double]
        public var eyeY: Double
        public var mouthY: Double
        public var cheekY: Double
        public var headTop: HeadTop
        public var neckY: Double
        /// [x, y, w, h] — the white body letter's box.
        public var letterBox: [Double]

        public var faceX: Double { faceCenter.first ?? 0.5 }
        public var faceY: Double { faceCenter.count > 1 ? faceCenter[1] : 0.42 }

        /// The y of a named slot ("eyeY", "mouthY", "cheekY", "neckY", "headTop").
        public func y(slot: String) -> Double {
            switch slot {
            case "eyeY": return eyeY
            case "mouthY": return mouthY
            case "cheekY": return cheekY
            case "neckY": return neckY
            case "headTop": return headTop.y
            default: return faceY
            }
        }
    }

    public struct Part: Codable, Equatable {
        public var slot: String
        public var scale: Double
    }

    public var version: Int?
    public var placeholder: Bool?
    public var bodies: [String: Body]
    public var parts: [String: Part]

    /// The anchors for a body shape (unknown → classic → a built-in default).
    public func body(_ shape: String) -> Body {
        bodies[shape] ?? bodies["classic"] ?? Self.builtIn.bodies["classic"]!
    }

    /// The slot + scale for a part kind ("eyes", "mouth", "nose", "head", "face", "neck").
    public func part(_ kind: String) -> Part {
        parts[kind] ?? Self.builtIn.parts[kind] ?? Part(slot: "eyeY", scale: 0.5)
    }

    public static func decode(_ data: Data) throws -> AvatarParts {
        try JSONDecoder().decode(AvatarParts.self, from: data)
    }

    /// Built-in copy of the placeholder manifest (used when the bundled file is missing / malformed).
    public static let builtIn = AvatarParts(
        version: 0, placeholder: true,
        bodies: [
            "classic": Body(faceCenter: [0.5, 0.42], eyeY: 0.36, mouthY: 0.52, cheekY: 0.47, headTop: HeadTop(x: 0.5, y: 0.06, w: 0.62), neckY: 0.7, letterBox: [0.28, 0.56, 0.44, 0.3]),
            "tall": Body(faceCenter: [0.5, 0.36], eyeY: 0.3, mouthY: 0.45, cheekY: 0.4, headTop: HeadTop(x: 0.5, y: 0.04, w: 0.48), neckY: 0.62, letterBox: [0.3, 0.52, 0.4, 0.32]),
            "wide": Body(faceCenter: [0.5, 0.45], eyeY: 0.39, mouthY: 0.55, cheekY: 0.5, headTop: HeadTop(x: 0.5, y: 0.12, w: 0.72), neckY: 0.72, letterBox: [0.27, 0.58, 0.46, 0.26]),
            "blob": Body(faceCenter: [0.5, 0.44], eyeY: 0.38, mouthY: 0.54, cheekY: 0.49, headTop: HeadTop(x: 0.5, y: 0.08, w: 0.6), neckY: 0.72, letterBox: [0.29, 0.57, 0.42, 0.28]),
            "bean": Body(faceCenter: [0.5, 0.4], eyeY: 0.34, mouthY: 0.5, cheekY: 0.45, headTop: HeadTop(x: 0.52, y: 0.06, w: 0.52), neckY: 0.66, letterBox: [0.3, 0.55, 0.4, 0.3]),
            "star": Body(faceCenter: [0.5, 0.46], eyeY: 0.41, mouthY: 0.56, cheekY: 0.51, headTop: HeadTop(x: 0.5, y: 0.02, w: 0.4), neckY: 0.74, letterBox: [0.31, 0.58, 0.38, 0.26]),
        ],
        parts: [
            "eyes": Part(slot: "eyeY", scale: 0.46), "mouth": Part(slot: "mouthY", scale: 0.26),
            "nose": Part(slot: "cheekY", scale: 0.5), "head": Part(slot: "headTop", scale: 1.0),
            "face": Part(slot: "eyeY", scale: 0.56), "neck": Part(slot: "neckY", scale: 0.6),
        ])
}
