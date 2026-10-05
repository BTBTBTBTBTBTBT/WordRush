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
    /// Round 2: blush / freckles moved here from `nose` (old configs migrate on decode + validate).
    public var cheeks: String
    public var mouth: String
    public var head: String
    public var face: String
    public var neck: String
    /// 10-05 integrated parts (docs/design/brand/avatar/INTEGRATION.md): held item, body wrap, shoes, companion,
    /// brows, face extra. Missing in older configs (= "none").
    public var held: String = "none"
    public var wrap: String = "none"
    public var feet: String = "none"
    public var pet: String = "none"
    public var brows: String = "none"
    public var extra: String = "none"
    /// The tint for white accessories (`AvatarCatalog.tintable`): a swatch id, or "default".
    public var accColor: String
    public var frame: String
    /// The backdrop id (`AvatarCatalog.backdropIds`); "auto" = a light tint of the body color.
    public var bg: String
    /// Which avatar shows for a player who has a photo: "mascot" | "photo".
    /// Picking the mascot never clears avatar_url. Default: "photo" when the
    /// profile has avatar_url, else "mascot" (`defaultAvatar(…, hasPhoto:)`).
    public var display: String

    public init(v: Int = 1, body: String, color: String, pattern: String, patternColor: String, eyes: String,
                nose: String, cheeks: String = "none", mouth: String, head: String, face: String, neck: String,
                accColor: String = "default", frame: String, bg: String = "auto", display: String = "mascot") {
        self.v = v; self.body = body; self.color = color; self.pattern = pattern; self.patternColor = patternColor
        self.eyes = eyes; self.nose = nose; self.cheeks = cheeks; self.mouth = mouth; self.head = head; self.face = face
        self.neck = neck; self.accColor = accColor; self.frame = frame; self.bg = bg; self.display = display
    }

    private enum CodingKeys: String, CodingKey {
        case v, body, color, pattern, patternColor, eyes, nose, cheeks, mouth, head, face, neck, accColor, frame, bg, display
        case held, wrap, feet, pet, brows, extra
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
        if let ch = try? c.decodeIfPresent(String.self, forKey: .cheeks) {
            cheeks = ch
        } else if nose == "blush" || nose == "freckles" {
            cheeks = nose; nose = "none"
        } else {
            cheeks = "none"
        }
        mouth = try c.decode(String.self, forKey: .mouth)
        head = try c.decode(String.self, forKey: .head)
        face = try c.decode(String.self, forKey: .face)
        neck = try c.decode(String.self, forKey: .neck)
        held = (try? c.decodeIfPresent(String.self, forKey: .held)) ?? "none"
        wrap = (try? c.decodeIfPresent(String.self, forKey: .wrap)) ?? "none"
        feet = (try? c.decodeIfPresent(String.self, forKey: .feet)) ?? "none"
        pet = (try? c.decodeIfPresent(String.self, forKey: .pet)) ?? "none"
        brows = (try? c.decodeIfPresent(String.self, forKey: .brows)) ?? "none"
        extra = (try? c.decodeIfPresent(String.self, forKey: .extra)) ?? "none"
        accColor = (try? c.decodeIfPresent(String.self, forKey: .accColor)) ?? "default"
        frame = try c.decode(String.self, forKey: .frame)
        bg = (try? c.decodeIfPresent(String.self, forKey: .bg)) ?? "auto"
        display = (try? c.decodeIfPresent(String.self, forKey: .display)) ?? "mascot"
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(1, forKey: .v)
        try c.encode(body, forKey: .body); try c.encode(color, forKey: .color)
        try c.encode(pattern, forKey: .pattern); try c.encode(patternColor, forKey: .patternColor)
        try c.encode(eyes, forKey: .eyes); try c.encode(nose, forKey: .nose); try c.encode(cheeks, forKey: .cheeks)
        try c.encode(mouth, forKey: .mouth)
        try c.encode(head, forKey: .head); try c.encode(face, forKey: .face); try c.encode(neck, forKey: .neck)
        // 10-05 integrated parts: only the worn ones are written (missing = "none"), like packages/core validateAvatar
        for (key, val) in [(CodingKeys.held, held), (.wrap, wrap), (.feet, feet), (.pet, pet), (.brows, brows), (.extra, extra)] where val != "none" {
            try c.encode(val, forKey: key)
        }
        try c.encode(accColor, forKey: .accColor)
        try c.encode(frame, forKey: .frame); try c.encode(bg, forKey: .bg)
        try c.encode(display, forKey: .display)
    }

    /// The config as a JSON object (what profiles.avatar_config stores).
    public var jsonObject: [String: Any] {
        var o: [String: Any] = ["v": 1, "body": body, "color": color, "pattern": pattern, "patternColor": patternColor,
                                "eyes": eyes, "nose": nose, "cheeks": cheeks, "mouth": mouth, "head": head, "face": face, "neck": neck,
                                "accColor": accColor, "frame": frame, "bg": bg, "display": display]
        for (k, val) in [("held", held), ("wrap", wrap), ("feet", feet), ("pet", pet), ("brows", brows), ("extra", extra)] where val != "none" { o[k] = val }
        return o
    }

    /// A stable string key for the DRAWN mascot (caches; `display` doesn't change the drawing).
    public var cacheKey: String {
        [body, color, pattern, patternColor, eyes, nose, cheeks, mouth, head, face, neck, accColor, frame, bg,
         held, wrap, feet, pet, brows, extra].joined(separator: "|")
    }
}

/// A body / pattern / accessory swatch (packages/core AvatarColor): `hex` is the flat tint; Pro specials carry
/// gradient `stops` (`dir` h = left→right, v = top→bottom, d = diagonal) multiplied onto the white art.
public struct AvatarColor: Equatable {
    public let id: String
    public let hex: String
    public let group: String
    public let pro: Bool
    public let stops: [String]
    public let dir: String
    public init(_ id: String, _ hex: String, _ group: String, pro: Bool = false, stops: [String] = [], dir: String = "v") {
        self.id = id; self.hex = hex; self.group = group; self.pro = pro; self.stops = stops; self.dir = dir
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
    // Round 2 (founder 10-03): ~2× every category, CHEEKS, 33 colors + 5 Pro specials, 14 patterns, accColor.
    public static let bodies = ["classic", "tall", "wide", "blob", "bean", "star", "drop", "pear", "cloud", "chunky", "mini", "hex"]
    public static let patterns = ["solid", "twotone", "stripes", "dots", "gradient", "sparkle",
                                  "hearts", "stars", "zigzag", "checkers", "tiedye", "leopard", "galaxy", "colorblock"]
    public static let eyes = ["beady", "happy", "sparkly", "sleepy", "wink", "hearts", "stars", "glasses", "cyclops",
                              "sunglasses", "determined", "anime", "joy", "droopy", "biground", "sideglance", "dizzy"]
    public static let mouths = ["smile", "grin", "tongue", "o", "cat", "toothy", "smirk", "tiny", "gasp",
                                "laugh", "whistle", "fang", "kissy", "braces", "oops", "tongueside", "teeth"]
    public static let noses = ["none", "button", "red", "pointy", "bignose", "cat", "piggy", "clownstar"]
    public static let cheeks = ["none", "blush", "freckles", "hearts", "starfreckles", "sparkle", "bandage"]
    /// Hats (AN addendum: 21 + round 2: 12, + none). Pro-only: crown, halo, tiara.
    public static let heads = ["none", "crown", "party", "beanie", "sprout", "nightcap", "headphones", "bow", "wizard", "pirate",
                               "cowboy", "chef", "grad", "halo", "flower", "tophat", "propeller", "catears", "bunnyears", "tiara",
                               "viking", "sweatband",
                               "cap", "beret", "minicrown", "flowercrown", "bucket", "santa", "witch", "astronaut", "bigbow",
                               "pombeanie", "bearears", "mohawk",
                               // seasonal (avatar-parts.json `season`; AvatarSeason decides when they show): Halloween 10-05
                               "pumpkinhat", "candycornhat", "witchnight", "batears"]
    /// Face extras (AN addendum + round 2).
    public static let faces = ["none", "mustache", "heart-glasses", "monocle", "starglasses", "roundglasses", "eyepatch",
                               "facepaint", "mask", "curlymustache"]
    /// Neck / back extras (AN addendum + round 2). Pro-only: wings, chain.
    public static let necks = ["none", "cape", "wings", "bowtie", "scarf", "chain", "medal", "backpack", "bubbletea", "guitar",
                               "supercape", "fairywings", "batwings", "cattail"]
    /// 10-05 integrated parts (packages/core AVATAR_HELD …): drawn per body, never bolted on.
    public static let held = ["none", "mug", "book", "pencil-big", "balloon", "trophy", "magnifier", "flashlight", "umbrella",
                              "icecream", "spatula", "mic", "wand-star", "candypail"]
    /// Body wraps (the necktie and sash were dropped 10-05: no room for a tie blade; the sash read as a stripe across the letter).
    public static let wraps = ["none", "bandana", "belt", "apron", "lei", "cape-drape", "vampirecollar"]
    public static let feet = ["none", "sneakers", "boots", "slippers", "skates"]
    public static let pets = ["none", "bird", "kitten", "puppy", "snail", "bat", "ghost", "blackcat"]
    public static let brows = ["none", "happy", "worried", "determined", "surprised", "cheeky", "sleepy"]
    public static let extras = ["none", "sweat", "tear", "steam", "heart"]
    /// The integrated config fields + their options, in the maker's tab order.
    public static let integratedFields: [(field: String, options: [String])] =
        [("held", held), ("wrap", wraps), ("feet", feet), ("pet", pets), ("brows", brows), ("extra", extras)]
    public static let proOnlyHeld: Set<String> = ["wand-star"]
    public static let proOnlyWraps: Set<String> = ["cape-drape"]
    /// Parts that carry the maker's NEW tag (the 10-05 additions + the 7 rebuilt parts; brows as "brows:<id>").
    public static let newParts: Set<String> = {
        var out: [String] = []
        // the 10-05 integrated additions only (seasonal parts carry their season tag instead)
        for list in [Array(held.prefix(13)), Array(wraps.prefix(6)), feet, Array(pets.prefix(5)), extras] { out.append(contentsOf: list.dropFirst()) }
        out.append(contentsOf: brows.dropFirst().map { "brows:\($0)" })
        out.append(contentsOf: ["backpack", "scarf", "chain", "bubbletea", "guitar", "cape", "supercape"])
        return Set(out)
    }()
    /// One-tap looks (packages/core AVATAR_BUNDLES): field -> id picks, applied with AvatarFit.applyPick.
    public static let bundles: [(id: String, label: String, pro: Bool, picks: [(String, String)])] = [
        ("bookworm", "Bookworm", false, [("held", "book"), ("face", "roundglasses"), ("brows", "happy")]),
        ("athlete", "Athlete", false, [("held", "trophy"), ("head", "sweatband"), ("feet", "sneakers"), ("wrap", "belt")]),
        ("chef", "Chef", false, [("held", "spatula"), ("wrap", "apron"), ("head", "chef")]),
        ("explorer", "Explorer", false, [("neck", "backpack"), ("held", "magnifier"), ("head", "bucket")]),
        ("rockstar", "Rock star", true, [("held", "mic"), ("face", "starglasses"), ("neck", "chain")]),
        ("rainyday", "Rainy day", false, [("held", "umbrella"), ("feet", "boots")]),
        ("magic", "Magic", true, [("held", "wand-star"), ("wrap", "cape-drape"), ("head", "wizard")]),
        ("summer", "Summer", false, [("held", "icecream"), ("wrap", "lei")]),
    ]
    /// White glossy accessories that take the accessory color.
    public static let tintable = ["supercape", "backpack", "wings", "chef", "astronaut"]
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

    /// The swatches in rows (packages/core AVATAR_COLORS): the original 16 first (stable ids; the seeded
    /// default only picks from them), then round 2's 17 and the 5 Pro-only specials (gradient `stops`).
    public static let colors: [AvatarColor] = [
        .init("purple", "#7c3aed", "bright"), .init("violet", "#8b5cf6", "bright"), .init("pink", "#ec4899", "bright"), .init("red", "#ef4444", "bright"),
        .init("orange", "#f97316", "bright"), .init("amber", "#f5a524", "bright"), .init("yellow", "#eab308", "bright"), .init("green", "#22c55e", "bright"),
        .init("emerald", "#10b981", "bright"), .init("teal", "#0d9488", "bright"), .init("sky", "#0ea5e9", "bright"), .init("blue", "#2563eb", "bright"),
        .init("lilac", "#c4b5fd", "pastel"), .init("peach", "#fdba74", "pastel"), .init("mint", "#86efac", "pastel"), .init("slate", "#64748b", "neutral"),
        .init("rose", "#fb7185", "bright"), .init("lime", "#84cc16", "bright"),
        .init("bubblegum", "#f9a8d4", "pastel"), .init("babyblue", "#93c5fd", "pastel"), .init("butter", "#fde68a", "pastel"),
        .init("coral", "#fca5a5", "pastel"), .init("seafoam", "#99f6e4", "pastel"),
        .init("navy", "#1e3a8a", "deep"), .init("plum", "#6b21a8", "deep"), .init("forest", "#166534", "deep"),
        .init("maroon", "#881337", "deep"), .init("charcoal", "#374151", "deep"), .init("chocolate", "#78350f", "deep"),
        .init("white", "#f8fafc", "neutral"), .init("cream", "#fef3c7", "neutral"), .init("sand", "#d6c7a1", "neutral"), .init("stone", "#a8a29e", "neutral"),
        .init("gold", "#f5b82e", "special", pro: true, stops: ["#fff1b8", "#f5b82e", "#b7791f"], dir: "v"),
        .init("silver", "#cbd5e1", "special", pro: true, stops: ["#ffffff", "#cbd5e1", "#7c8798"], dir: "v"),
        .init("rainbow", "#a855f7", "special", pro: true, stops: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6"], dir: "h"),
        .init("holo", "#c4b5fd", "special", pro: true, stops: ["#f9a8d4", "#c4b5fd", "#99f6e4", "#fde68a", "#f9a8d4"], dir: "d"),
        .init("neon", "#39ff14", "special", pro: true, stops: ["#d9ff6b", "#39ff14", "#00e5a0"], dir: "d"),
    ]
    public static let colorGroups = ["bright", "pastel", "deep", "neutral", "special"]
    public static var colorIds: [String] { colors.map(\.id) }
    public static var proOnlyColors: [String] { colors.filter(\.pro).map(\.id) }
    /// A swatch by id (unknown → purple).
    public static func color(_ id: String) -> AvatarColor { colors.first { $0.id == id } ?? colors[0] }

    /// Pro-only options (free players see the gold PRO pill → the Go Pro page).
    public static let proOnlyHeads = ["crown", "halo", "tiara"]
    public static let proOnlyNecks = ["wings", "chain"]
    public static let proOnlyFrames = ["diamond", "pro"]
    public static let proOnlyBackdrops = ["aurora", "galaxy"]
    public static func isProOnly(color: String) -> Bool { proOnlyColors.contains(color) }

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
        for c in colors.prefix(16) {
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
            nose: "none", cheeks: "none",
            mouth: defaultMouths[Int((h >> 16) & 0xff) % defaultMouths.count],
            head: "none", face: "none", neck: "none", accColor: "default", frame: "none", bg: "auto",
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
        // Round 2: blush / freckles were noses; a config without `cheeks` carries them over (nose → none).
        let rawNose = r["nose"] as? String
        let legacyCheeks: String? = r["cheeks"] == nil && (rawNose == "blush" || rawNose == "freckles") ? rawNose : nil
        let acc = (r["accColor"] as? String).flatMap { $0 == "default" || ids.contains($0) ? $0 : nil } ?? fallback.accColor
        var out = AvatarConfig(
            body: pick(r["body"], bodies, fallback.body),
            color: color,
            pattern: pick(r["pattern"], patterns, fallback.pattern),
            patternColor: patternColor,
            // founder 10-05: None on any body part — eyes / mouth may be "none" (draws nothing)
            eyes: (r["eyes"] as? String) == "none" ? "none" : pick(r["eyes"], eyes, fallback.eyes),
            nose: legacyCheeks != nil ? "none" : pick(r["nose"], noses, fallback.nose),
            cheeks: legacyCheeks ?? pick(r["cheeks"], cheeks, fallback.cheeks),
            mouth: (r["mouth"] as? String) == "none" ? "none" : pick(r["mouth"], mouths, fallback.mouth),
            head: pick(r["head"], heads, fallback.head),
            face: pick(r["face"], faces, fallback.face),
            neck: pick(r["neck"], necks, fallback.neck),
            accColor: acc,
            frame: pick(r["frame"], frames, fallback.frame),
            bg: pick(r["bg"], backdropIds, fallback.bg),
            display: (r["display"] as? String).flatMap { displays.contains($0) ? $0 : nil } ?? fallback.display)
        out.held = pick(r["held"], held, fallback.held)
        out.wrap = pick(r["wrap"], wraps, fallback.wrap)
        out.feet = pick(r["feet"], feet, fallback.feet)
        out.pet = pick(r["pet"], pets, fallback.pet)
        out.brows = pick(r["brows"], brows, fallback.brows)
        out.extra = pick(r["extra"], extras, fallback.extra)
        return out
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
        if proOnlyHeld.contains(c.held) { out.held = "none" }
        if proOnlyWraps.contains(c.wrap) { out.wrap = "none" }
        if proOnlyFrames.contains(c.frame) { out.frame = "none" }
        if proOnlyBackdrops.contains(c.bg) { out.bg = "auto" }
        if isProOnly(color: c.color) { out.color = "purple" }
        if isProOnly(color: c.patternColor) { out.patternColor = out.color }
        if isProOnly(color: c.accColor) { out.accColor = "default" }
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
                            nose: "none", cheeks: "none", mouth: "smile", head: "none", face: "none", neck: "none",
                            accColor: "default", frame: "none", bg: "auto", display: "mascot")
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

    /// Built-in copy of the shipped manifest's v1 anchors (used when the bundled file is missing / malformed).
    public static let builtIn = AvatarParts(
        version: 2, placeholder: false,
        bodies: [
            "classic": Body(faceCenter: [0.499, 0.4621], eyeY: 0.3898, mouthY: 0.5343, cheekY: 0.491, headTop: HeadTop(x: 0.5015, y: 0.1544, w: 0.6143), neckY: 0.574, letterBox: [0.289, 0.5849, 0.42, 0.2457]),
            "tall": Body(faceCenter: [0.498, 0.3124], eyeY: 0.246, mouthY: 0.3787, cheekY: 0.3373, headTop: HeadTop(x: 0.4995, y: 0.0407, w: 0.3037), neckY: 0.4327, letterBox: [0.387, 0.4451, 0.2221, 0.3319]),
            "wide": Body(faceCenter: [0.499, 0.5927], eyeY: 0.5329, mouthY: 0.6525, cheekY: 0.6145, headTop: HeadTop(x: 0.5039, y: 0.3581, w: 0.6328), neckY: 0.6824, letterBox: [0.289, 0.6906, 0.42, 0.174]),
            "blob": Body(faceCenter: [0.4985, 0.4595], eyeY: 0.3847, mouthY: 0.5342, cheekY: 0.4894, headTop: HeadTop(x: 0.5005, y: 0.1702, w: 0.4463), neckY: 0.5753, letterBox: [0.2885, 0.5865, 0.42, 0.2392]),
            "bean": Body(faceCenter: [0.5522, 0.3497], eyeY: 0.2792, mouthY: 0.4202, cheekY: 0.3787, headTop: HeadTop(x: 0.5913, y: 0.0686, w: 0.333), neckY: 0.4742, letterBox: [0.4043, 0.4866, 0.2959, 0.2987]),
            "star": Body(faceCenter: [0.5005, 0.4381], eyeY: 0.3719, mouthY: 0.5043, cheekY: 0.4573, headTop: HeadTop(x: 0.5015, y: 0.0949, w: 0.2471), neckY: 0.5384, letterBox: [0.356, 0.5512, 0.2891, 0.205]),
            "drop": Body(faceCenter: [0.4985, 0.4892], eyeY: 0.4206, mouthY: 0.5577, cheekY: 0.5161, headTop: HeadTop(x: 0.5, y: 0.1629, w: 0.248), neckY: 0.5909, letterBox: [0.4195, 0.6034, 0.1581, 0.1993]),
            "pear": Body(faceCenter: [0.501, 0.4182], eyeY: 0.3456, mouthY: 0.4908, cheekY: 0.4451, headTop: HeadTop(x: 0.5005, y: 0.0826, w: 0.2412), neckY: 0.5405, letterBox: [0.3803, 0.553, 0.2414, 0.2489]),
            "cloud": Body(faceCenter: [0.4995, 0.5499], eyeY: 0.4856, mouthY: 0.6142, cheekY: 0.5756, headTop: HeadTop(x: 0.5034, y: 0.3574, w: 0.6201), neckY: 0.6495, letterBox: [0.2895, 0.6592, 0.42, 0.1736]),
            "chunky": Body(faceCenter: [0.498, 0.4315], eyeY: 0.3581, mouthY: 0.505, cheekY: 0.4609, headTop: HeadTop(x: 0.5, y: 0.1408, w: 0.6406), neckY: 0.5528, letterBox: [0.288, 0.5638, 0.42, 0.2498]),
            "mini": Body(faceCenter: [0.4976, 0.6255], eyeY: 0.5709, mouthY: 0.6801, cheekY: 0.6453, headTop: HeadTop(x: 0.4985, y: 0.451, w: 0.3486), neckY: 0.7074, letterBox: [0.3227, 0.7148, 0.3498, 0.1488]),
            "hex": Body(faceCenter: [0.4961, 0.4639], eyeY: 0.3919, mouthY: 0.5359, cheekY: 0.4927, headTop: HeadTop(x: 0.499, y: 0.1755, w: 0.416), neckY: 0.5755, letterBox: [0.2861, 0.5863, 0.42, 0.2304]),
        ],
        parts: ["eyes": Part(slot: "eyeY", scale: 0.37), "mouth": Part(slot: "mouthY", scale: 0.19), "nose": Part(slot: "cheekY", scale: 0.12), "cheeks": Part(slot: "cheekY", scale: 0.5), "head": Part(slot: "headTop", scale: 1.0), "face": Part(slot: "eyeY", scale: 0.4), "neck": Part(slot: "neckY", scale: 0.32)])
}
