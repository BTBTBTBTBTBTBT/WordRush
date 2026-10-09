import Foundation

// Mascot item gating — exact port of packages/core/src/avatar-access.ts (pinned by
// Tests/Fixtures/avatar-access-fixtures.json, AvatarAccessTests). Who may SAVE which part (docs/cloud-prompts/11,
// decisions in docs/design/brand/avatar/UNLOCKS-AND-SHOP.md). Every option has an access rule (avatar-access.json,
// the PROPOSED table — the founder approves it later):
//   free · pro (included with Pro) · buy (a direct purchase at a price tier) · earn (a condition on existing Stats /
//   achievements) · season (free in its window, AvatarSeason) · limited (the buy route only opens in the window).
// Try-on rule: ANY part can be previewed; only saving checks access (`saveCheck` / `enforce`). A part the player
// already SAVED is never stripped (grandfathered), like the seasonal rule.
//
// Everything ships behind AvatarAccessConfig.itemGating (OFF): with it off, `rule` returns today's rules (the Pro-only
// lists + the level-earned tier frames + seasons) so nothing changes for anyone. No real purchases yet: ownership
// comes in as a list of owned keys (the server-side owned_items ledger, docs/sql/20261010-owned-items.sql — NOT applied).

/// The feature flag (OFF until the founder approves the table and the purchase flow ships).
public enum AvatarAccessConfig {
    public static let itemGating: Bool = false
}

/// One earn condition: an existing achievement, or a stat (level | currentStreak | bestStreak | bestLoginStreak) at
/// least `min`. `label` is the locked card's copy.
public struct AvatarEarnCondition: Codable, Equatable, Hashable {
    public var label: String
    public var achievement: String?
    public var stat: String?
    public var min: Double?
    public init(label: String, achievement: String? = nil, stat: String? = nil, min: Double? = nil) {
        self.label = label; self.achievement = achievement; self.stat = stat; self.min = min
    }
}

/// A part's access rule (avatar-access.json `parts[key]`).
public struct AvatarAccessRule: Codable, Equatable, Hashable {
    public var free: Bool?
    public var pro: Bool?
    /// A price tier ("t1" … "t4", AvatarAccessTable.tiers).
    public var buy: String?
    public var earn: AvatarEarnCondition?
    /// A seasonal part (its season id): free while the season is on.
    public var season: String?
    /// The buy / earn routes only open while `season` is on (out of season: retired until next year).
    public var limited: Bool?
    public init(free: Bool? = nil, pro: Bool? = nil, buy: String? = nil, earn: AvatarEarnCondition? = nil,
                season: String? = nil, limited: Bool? = nil) {
        self.free = free; self.pro = pro; self.buy = buy; self.earn = earn; self.season = season; self.limited = limited
    }
}

/// avatar-access.json: the price tiers and every part's rule, keyed "<field>:<id>" (`order` keeps the file's order —
/// `earnedKeys` walks the table in it, like the TS Object.entries).
public struct AvatarAccessTable: Equatable {
    public var version: Int
    public var tiers: [String: Double]
    public var parts: [String: AvatarAccessRule]
    /// The parts' keys in file order.
    public var order: [String]

    public init(version: Int = 1, tiers: [String: Double] = [:], parts: [String: AvatarAccessRule] = [:], order: [String]? = nil) {
        self.version = version; self.tiers = tiers; self.parts = parts
        self.order = order ?? parts.keys.sorted()
    }

    /// No rules (gating on: every part free).
    public static let empty = AvatarAccessTable()

    private struct Raw: Decodable {
        var version: Int?
        var tiers: [String: Double]?
        var parts: [String: AvatarAccessRule]
    }

    /// Decode the bundled avatar-access.json (the key order is read from the raw text: JSONDecoder's dictionaries are unordered).
    public static func decode(_ data: Data) throws -> AvatarAccessTable {
        let raw = try JSONDecoder().decode(Raw.self, from: data)
        var order = partsKeyOrder(data).filter { raw.parts[$0] != nil }
        var seen = Set<String>()
        order = order.filter { seen.insert($0).inserted }
        order += raw.parts.keys.filter { !seen.contains($0) }.sorted()
        return AvatarAccessTable(version: raw.version ?? 1, tiers: raw.tiers ?? [:], parts: raw.parts, order: order)
    }

    /// The direct keys of the top-level "parts" object, in file order (a tiny scanner: strings, braces, brackets).
    static func partsKeyOrder(_ data: Data) -> [String] {
        let b = [UInt8](data)
        let quote = UInt8(ascii: "\""), backslash = UInt8(ascii: "\\"), colon = UInt8(ascii: ":")
        let opens: Set<UInt8> = [UInt8(ascii: "{"), UInt8(ascii: "[")], closes: Set<UInt8> = [UInt8(ascii: "}"), UInt8(ascii: "]")]
        let space: Set<UInt8> = [0x20, 0x09, 0x0A, 0x0D]
        var keys: [String] = []
        var depth = 0
        var pending = false
        var partsDepth = -1
        var i = 0
        while i < b.count {
            let c = b[i]
            if c == quote {
                var j = i + 1
                var bytes: [UInt8] = []
                while j < b.count, b[j] != quote {
                    if b[j] == backslash, j + 1 < b.count { bytes.append(b[j]); j += 1 }
                    bytes.append(b[j]); j += 1
                }
                i = j + 1
                var k = i
                while k < b.count, space.contains(b[k]) { k += 1 }
                if k < b.count, b[k] == colon {
                    let s = String(decoding: bytes, as: UTF8.self)
                    if depth == 1, s == "parts" { pending = true }
                    else if partsDepth >= 0, depth == partsDepth { keys.append(s) }
                }
                continue
            }
            if opens.contains(c) {
                depth += 1
                if pending { pending = false; if c == UInt8(ascii: "{") { partsDepth = depth } }
            } else if closes.contains(c) {
                if depth == partsDepth { return keys }
                depth -= 1
            } else if pending, !space.contains(c), c != colon {
                pending = false   // "parts" holds something other than an object
            }
            i += 1
        }
        return keys
    }
}

/// What the earn evaluator reads: profile stats + the player's unlocked achievement keys.
public struct AvatarEarnStats: Codable, Equatable {
    public var level: Double?
    public var currentStreak: Double?
    public var bestStreak: Double?
    public var bestLoginStreak: Double?
    public var achievements: [String]?
    public init(level: Double? = nil, currentStreak: Double? = nil, bestStreak: Double? = nil, bestLoginStreak: Double? = nil,
                achievements: [String]? = nil) {
        self.level = level; self.currentStreak = currentStreak; self.bestStreak = bestStreak
        self.bestLoginStreak = bestLoginStreak; self.achievements = achievements
    }

    /// An earn stat by name (nil when unknown or missing).
    public func value(_ stat: String) -> Double? {
        switch stat {
        case "level": return level
        case "currentStreak": return currentStreak
        case "bestStreak": return bestStreak
        case "bestLoginStreak": return bestLoginStreak
        default: return nil
        }
    }
}

/// Where the player is on one earn condition.
public struct AvatarEarnProgress: Codable, Equatable {
    public var met: Bool
    /// A stat value, capped at target; an achievement: 0 or 1.
    public var current: Int
    public var target: Int
    public var label: String
    public init(met: Bool, current: Int, target: Int, label: String) {
        self.met = met; self.current = current; self.target = target; self.label = label
    }
}

/// The player's side of an access check.
public struct AvatarAccessContext {
    public var isPro: Bool
    /// Owned keys ("<field>:<id>", the owned_items ledger: bought or earned).
    public var owned: [String]
    public var stats: AvatarEarnStats?
    /// "yyyy-MM-dd" (local) — for seasons.
    public var date: String
    /// The admin Season preview (AvatarSeason.active).
    public var previewSeason: String?
    /// The player's SAVED config as field -> id: a part it wears is never stripped.
    public var saved: [String: String]?
    public var gating: Bool

    public init(isPro: Bool, owned: [String] = [], stats: AvatarEarnStats? = nil, date: String, previewSeason: String? = nil,
                saved: AvatarConfig? = nil, gating: Bool = AvatarAccessConfig.itemGating) {
        self.isPro = isPro; self.owned = owned; self.stats = stats; self.date = date; self.previewSeason = previewSeason
        self.saved = saved.map(AvatarAccess.fieldMap); self.gating = gating
    }
}

public enum AvatarAccessReason: String, Codable {
    case free, pro, owned, earned, season, saved, locked
}

/// One way to get a locked part (the locked card lists them earn · pro · buy · season).
public enum AvatarAccessRoute: Equatable {
    case buy(tier: String, price: Double)
    case pro
    case earn(AvatarEarnProgress)
    case season(String)

    public var kind: String {
        switch self {
        case .buy: return "buy"
        case .pro: return "pro"
        case .earn: return "earn"
        case .season: return "season"
        }
    }
}

public struct AvatarPartAccess: Equatable {
    public var unlocked: Bool
    public var reason: AvatarAccessReason
    /// The routes that apply (shown on the locked card; also present when unlocked, for the item's info).
    public var routes: [AvatarAccessRoute]
    public var rule: AvatarAccessRule
}

public struct AvatarSaveCheck: Equatable {
    public var ok: Bool
    /// The worn parts the player can't save yet (try-on only), in maker order.
    public var locked: [AvatarPart]
}

public enum AvatarAccess {
    /// The fields gating covers, in the maker's order (patternColor / accColor share the color keys).
    public static let fields = ["body", "color", "pattern", "patternColor", "eyes", "brows", "nose", "cheeks", "mouth", "extra",
                                "head", "face", "neck", "held", "wrap", "feet", "pet", "accColor", "frame", "bg", "pose"]

    /// The level a tier frame is earned at (today's rule: FRAME_UNLOCK_LEVEL on every platform).
    public static let frameLevel: [String: Int] = ["bronze": 1, "silver": 11, "gold": 26, "platinum": 51]

    /// What a locked part falls back to when saving anyway (else "none").
    static let fallback: [String: String] = ["body": "classic", "color": "purple", "pattern": "solid", "patternColor": "purple",
                                             "accColor": "default", "bg": "auto", "frame": "none"]

    /// The fields whose "none" is a missing key (integrated parts + the pose).
    static let removable: Set<String> = ["held", "wrap", "feet", "pet", "brows", "extra", "pose"]

    // MARK: Keys + rules

    /// The table key of a part: "<field>:<id>"; the three color fields share "color:<id>".
    public static func key(field: String, id: String) -> String {
        let f = field == "patternColor" || field == "accColor" ? "color" : field
        return "\(f):\(id)"
    }

    /// Ids that are always free (the empty choice of every field).
    public static func alwaysFree(field: String, id: String) -> Bool {
        if id.isEmpty || id == "none" { return true }
        if field == "pattern" && id == "solid" { return true }
        if field == "bg" && id == "auto" { return true }
        if field == "accColor" && id == "default" { return true }
        return false
    }

    /// The season a part belongs to (only the manifest's part fields carry one), or nil.
    static func partSeason(field: String, id: String, manifest: AvatarManifest) -> String? {
        guard AvatarFit.fieldKind[field] != nil || field == "body" else { return nil }
        return AvatarSeason.partSeason(field: field, id: id, manifest: manifest)
    }

    static func proOnly(_ key: String) -> [String] {
        switch key {
        case "head": return AvatarCatalog.proOnlyHeads
        case "neck": return AvatarCatalog.proOnlyNecks
        case "held": return Array(AvatarCatalog.proOnlyHeld)
        case "wrap": return Array(AvatarCatalog.proOnlyWraps)
        case "frame": return AvatarCatalog.proOnlyFrames
        case "bg": return AvatarCatalog.proOnlyBackdrops
        case "color": return AvatarCatalog.proOnlyColors
        default: return []
        }
    }

    /// Today's rules (gating OFF): Pro-only lists, level frames, seasons; everything else free.
    public static func legacyRule(field: String, id: String, manifest: AvatarManifest) -> AvatarAccessRule {
        if alwaysFree(field: field, id: id) { return AvatarAccessRule(free: true) }
        // Seasonal parts never disappear (founder 10-07): free in their season, Pro the rest of the year.
        if let season = partSeason(field: field, id: id, manifest: manifest) { return AvatarAccessRule(pro: true, season: season) }
        if let mp = AvatarSeason.partManifestPro(field: field, id: id, manifest: manifest) {   // 2.8 packs
            return mp ? AvatarAccessRule(pro: true) : AvatarAccessRule(free: true)
        }
        if field == "frame", let n = frameLevel[id] {
            return AvatarAccessRule(earn: AvatarEarnCondition(label: "Reach level \(n)", stat: "level", min: Double(n)))
        }
        let k = field == "patternColor" || field == "accColor" ? "color" : field
        return proOnly(k).contains(id) ? AvatarAccessRule(pro: true) : AvatarAccessRule(free: true)
    }

    /// A part's rule. Gating on: the table's (a part missing from the table is free — never lock what nobody priced);
    /// the manifest's `season` always wins the season field. Gating off: today's rules (`legacyRule`).
    public static func rule(field: String, id: String, gating: Bool = AvatarAccessConfig.itemGating,
                            table: AvatarAccessTable, manifest: AvatarManifest) -> AvatarAccessRule {
        if !gating { return legacyRule(field: field, id: id, manifest: manifest) }
        if alwaysFree(field: field, id: id) { return AvatarAccessRule(free: true) }
        var r = table.parts[key(field: field, id: id)] ?? AvatarAccessRule(free: true)
        if let season = partSeason(field: field, id: id, manifest: manifest) { r.season = season }
        return r
    }

    // MARK: The earn evaluator

    /// Evaluate one earn condition against the player's stats + achievements. Pure.
    public static func evaluateEarn(_ cond: AvatarEarnCondition, _ stats: AvatarEarnStats?) -> AvatarEarnProgress {
        if let a = cond.achievement, !a.isEmpty {
            let met = (stats?.achievements ?? []).contains(a)
            return AvatarEarnProgress(met: met, current: met ? 1 : 0, target: 1, label: cond.label)
        }
        if let stat = cond.stat, !stat.isEmpty {
            let m = cond.min ?? 1
            let target = m.isFinite ? Int(Swift.max(1, Swift.min(m, 1e9)).rounded(.down)) : 1
            let raw = stats?.value(stat) ?? 0
            let value = raw.isFinite ? Swift.max(0, raw.rounded(.down)) : 0
            return AvatarEarnProgress(met: value >= Double(target), current: Int(Swift.min(value, Double(target))), target: target,
                                      label: cond.label)
        }
        return AvatarEarnProgress(met: false, current: 0, target: 1, label: cond.label)
    }

    /// The parts a player's stats have earned (what the server writes to owned_items with source 'earn').
    /// Every table key whose earn condition is met, in table order.
    public static func earnedKeys(_ stats: AvatarEarnStats?, table: AvatarAccessTable) -> [String] {
        table.order.filter { k in
            guard let earn = table.parts[k]?.earn else { return false }
            return evaluateEarn(earn, stats).met
        }
    }

    // MARK: Access

    /// A config's value for a gating field (nil for an unknown field).
    public static func value(_ c: AvatarConfig, _ field: String) -> String? {
        switch field {
        case "body": return c.body
        case "color": return c.color
        case "pattern": return c.pattern
        case "patternColor": return c.patternColor
        case "accColor": return c.accColor
        case "frame": return c.frame
        case "bg": return c.bg
        case "pose": return c.pose
        default: return AvatarFit.fieldKind[field] != nil ? AvatarFit.value(c, field) : nil
        }
    }

    /// A config with a gating field set ("none" on an integrated part / the pose = the field missing).
    public static func setting(_ c: AvatarConfig, _ field: String, _ id: String) -> AvatarConfig {
        var o = c
        switch field {
        case "body": o.body = id
        case "color": o.color = id
        case "pattern": o.pattern = id
        case "patternColor": o.patternColor = id
        case "accColor": o.accColor = id
        case "frame": o.frame = id
        case "bg": o.bg = id
        case "pose": o.pose = id
        default: o = AvatarFit.setting(o, field, id)
        }
        return o
    }

    /// A config's gating fields as field -> id.
    public static func fieldMap(_ c: AvatarConfig) -> [String: String] {
        var out: [String: String] = [:]
        for f in fields { out[f] = value(c, f) }
        return out
    }

    /// Does the saved config wear this part (in this field — or, for a color, as any of the three color fields)?
    static func savedWears(_ saved: [String: String]?, field: String, id: String) -> Bool {
        guard let saved else { return false }
        if field == "color" || field == "patternColor" || field == "accColor" {
            return ["color", "patternColor", "accColor"].contains { saved[$0] == id }
        }
        return saved[field] == id
    }

    /// May this player save this part, and if not, how can they get it? Pure.
    public static func partAccess(_ part: AvatarPart, _ ctx: AvatarAccessContext, table: AvatarAccessTable,
                                  manifest: AvatarManifest) -> AvatarPartAccess {
        let r = rule(field: part.field, id: part.id, gating: ctx.gating, table: table, manifest: manifest)
        let season = (r.season?.isEmpty ?? true) ? nil : r.season
        let inSeason = season != nil && AvatarSeason.active(day: ctx.date, preview: ctx.previewSeason) == season
        var routes: [AvatarAccessRoute] = []
        if let season { routes.append(.season(season)) }
        let routesOpen = r.limited != true || inSeason
        if let tier = r.buy, !tier.isEmpty, routesOpen { routes.append(.buy(tier: tier, price: table.tiers[tier] ?? 0)) }
        if r.pro == true { routes.append(.pro) }
        let earn: AvatarEarnProgress? = routesOpen ? r.earn.map { evaluateEarn($0, ctx.stats) } : nil
        if let earn { routes.append(.earn(earn)) }
        func done(_ reason: AvatarAccessReason) -> AvatarPartAccess {
            AvatarPartAccess(unlocked: reason != .locked, reason: reason, routes: routes, rule: r)
        }

        if r.free == true { return done(.free) }
        if inSeason { return done(.season) }
        if r.pro == true && ctx.isPro { return done(.pro) }
        if ctx.owned.contains(key(field: part.field, id: part.id)) { return done(.owned) }
        if earn?.met == true { return done(.earned) }
        if savedWears(ctx.saved, field: part.field, id: part.id) { return done(.saved) }
        return done(.locked)
    }

    /// The parts a config wears that gating covers (skipping the empty choices and unused color fields).
    public static func wornParts(_ config: AvatarConfig) -> [AvatarPart] {
        var out: [AvatarPart] = []
        for f in fields {
            guard let id = value(config, f), !alwaysFree(field: f, id: id) else { continue }
            if f == "patternColor" && config.pattern == "solid" { continue }
            out.append(AvatarPart(field: f, id: id))
        }
        return out
    }

    /// The try-on rule: anything previews; saving needs every worn part unlocked.
    public static func saveCheck(_ draft: AvatarConfig, _ ctx: AvatarAccessContext, table: AvatarAccessTable,
                                 manifest: AvatarManifest) -> AvatarSaveCheck {
        let locked = wornParts(draft).filter { !partAccess($0, ctx, table: table, manifest: manifest).unlocked }
        return AvatarSaveCheck(ok: locked.isEmpty, locked: locked)
    }

    /// Strip the locked parts (save-time enforcement, like AvatarCatalog.enforcePro): each locked part reverts to the
    /// SAVED config's value when that one is unlocked, else to the field's free default ("none" for parts; integrated
    /// parts and the pose revert to "none" = the field missing).
    public static func enforce(_ draft: AvatarConfig, _ ctx: AvatarAccessContext, table: AvatarAccessTable,
                               manifest: AvatarManifest) -> AvatarConfig {
        let locked = saveCheck(draft, ctx, table: table, manifest: manifest).locked
        if locked.isEmpty { return draft }
        var out = draft
        for p in locked {
            let prior = ctx.saved?[p.field]
            var next = fallback[p.field] ?? "none"
            if let prior, !prior.isEmpty, prior != p.id,
               alwaysFree(field: p.field, id: prior)
                || partAccess(AvatarPart(field: p.field, id: prior), ctx, table: table, manifest: manifest).unlocked {
                next = prior
            }
            out = setting(out, p.field, next)
        }
        return out
    }

    /// The gating-OFF save path for seasonal parts: free in season, Pro (or owned, or already on the SAVED look) the rest
    /// of the year. Reverts only seasonal parts a free player can't keep (the Pro lists and level frames keep their own
    /// enforcement). Mirrors enforceSeasonalAccess in avatar-access.ts.
    public static func enforceSeasonal(_ draft: AvatarConfig, _ ctx: AvatarAccessContext, table: AvatarAccessTable,
                                       manifest: AvatarManifest) -> AvatarConfig {
        var legacy = ctx
        legacy.gating = false
        let locked = wornParts(draft).filter {
            (partSeason(field: $0.field, id: $0.id, manifest: manifest) != nil
                || AvatarSeason.partManifestPro(field: $0.field, id: $0.id, manifest: manifest) == true)
                && !partAccess($0, legacy, table: table, manifest: manifest).unlocked
        }
        if locked.isEmpty { return draft }
        var out = draft
        for p in locked {
            let prior = ctx.saved?[p.field]
            var next = fallback[p.field] ?? "none"
            if let prior, !prior.isEmpty, prior != p.id,
               alwaysFree(field: p.field, id: prior)
                || partAccess(AvatarPart(field: p.field, id: prior), legacy, table: table, manifest: manifest).unlocked {
                next = prior
            }
            out = setting(out, p.field, next)
        }
        return out
    }

    /// Owned items save without Pro. enforcePro (the gating-OFF save path) strips every Pro-only part for a free player; this
    /// puts back the ones the player OWNS (an admin grant, an earn, a purchase). Mirrors keepOwnedParts (web).
    public static func keepOwned(original: AvatarConfig, enforced: AvatarConfig, owned: [String]) -> AvatarConfig {
        if owned.isEmpty { return enforced }
        let was = fieldMap(original), now = fieldMap(enforced)
        var out = enforced
        for (field, id) in was where now[field] != id && !id.isEmpty && owned.contains(key(field: field, id: id)) {
            out = setting(out, field, id)
        }
        return out
    }

    // MARK: The locked card

    /// A price for display ("$1.99").
    public static func priceLabel(_ price: Double) -> String { String(format: "$%.2f", price) }

    /// One line of the locked card per route ("Buy $1.99" · "Included with Pro" · "Earn: … (12 / 30)" · "Free during Halloween").
    public static func routeLine(_ route: AvatarAccessRoute) -> String {
        switch route {
        case .buy(_, let price): return "Buy \(priceLabel(price))"
        case .pro: return "Included with Pro"
        case .earn(let p): return p.target > 1 ? "Earn: \(p.label) (\(p.current) / \(p.target))" : "Earn: \(p.label)"
        case .season(let s):
            return "Free during " + s.split(separator: "-", omittingEmptySubsequences: false)
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
        }
    }

    static let routeOrder = ["earn": 0, "pro": 1, "buy": 2, "season": 3]

    /// The locked card's routes, in order: earn first (play beats pay), then Pro, then buy; season info last.
    public static func lockedCardRoutes(_ access: AvatarPartAccess) -> [AvatarAccessRoute] {
        access.routes.enumerated()
            .sorted { (routeOrder[$0.element.kind] ?? 9, $0.offset) < (routeOrder[$1.element.kind] ?? 9, $1.offset) }
            .map(\.element)
    }

    /// The locked card's lines (`lockedCardRoutes` as `routeLine`s).
    public static func lockedCardLines(_ access: AvatarPartAccess) -> [String] {
        lockedCardRoutes(access).map(routeLine)
    }
}
