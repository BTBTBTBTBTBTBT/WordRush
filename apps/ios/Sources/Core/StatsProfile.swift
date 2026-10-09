import Foundation

// FRIDAY-QUEUE items 16 + 17 + 20 (2.8 wave 4): a 1:1 port of packages/core/src/stats-profile.ts — the Stats page's
// hero stats / VS picker split / bots line / pocket records, the player profile's friendship state + action row, and
// the Go Pro scene picker. Same words and same decisions as web and Android (assert against Tests/StatsProfileTests).

public enum StatsProfile {
    // MARK: VS picker: 9 games as 5 over 4
    /// 9 -> 5 + 4 (top row the longer one). Five or fewer stay on one row.
    public static func pickerSplit<T>(_ items: [T]) -> (top: [T], bottom: [T]) {
        if items.count <= 5 { return (items, []) }
        let n = (items.count + 1) / 2
        return (Array(items.prefix(n)), Array(items.dropFirst(n)))
    }

    // MARK: Hero stats
    public static func winRatePct(_ wins: Int, _ losses: Int) -> Int {
        let total = wins + losses
        return total > 0 ? Int((Double(wins) / Double(total) * 100).rounded()) : 0
    }

    /// "16s" / "1m 5s" / "2m" / "—".
    public static func formatFastest(_ seconds: Double) -> String {
        if !(seconds > 0) { return "—" }
        if seconds < 60 { return "\(Int(seconds.rounded()))s" }
        let m = Int(seconds / 60)
        let s = Int(seconds.truncatingRemainder(dividingBy: 60).rounded())
        return s > 0 ? "\(m)m \(s)s" : "\(m)m"
    }

    public enum HeroKey: String { case record, winRate, streak, fastest }
    public struct HeroStat: Equatable {
        public let key: HeroKey
        public let label: String
        public let value: String
        public let sub: String?
        /// The shipped stat icon (art-stat-<icon>): crown, donut, bolt, stopwatch.
        public let icon: String
    }

    public static func heroStats(wins: Int, losses: Int, streak: Int, bestStreak: Int, fastestSeconds: Double) -> [HeroStat] {
        let played = wins + losses > 0
        return [
            HeroStat(key: .record, label: "Record", value: "\(wins)–\(losses)", sub: nil, icon: "crown"),
            HeroStat(key: .winRate, label: "Win rate", value: played ? "\(winRatePct(wins, losses))%" : "—", sub: nil, icon: "donut"),
            HeroStat(key: .streak, label: "Streak", value: String(streak), sub: bestStreak > 0 ? "Best \(bestStreak)" : nil, icon: "bolt"),
            HeroStat(key: .fastest, label: "Fastest", value: formatFastest(fastestSeconds), sub: nil, icon: "stopwatch"),
        ]
    }

    /// The guess chart stays hidden until there is a win.
    public static func showGuessDistribution(_ counts: [Int]) -> Bool { counts.contains { $0 > 0 } }

    // MARK: Record bar + bots line
    public static func recordBar(wins: Int, losses: Int) -> (winFrac: Double, lossFrac: Double, empty: Bool) {
        let t = wins + losses
        if t <= 0 { return (0, 0, true) }
        return (Double(wins) / Double(t), Double(losses) / Double(t), false)
    }

    /// VS Bots in one line: "26–17 · 60%".
    public static func botsLine(wins: Int, losses: Int) -> String {
        if wins + losses == 0 { return "Beat a bot to start" }
        return "\(wins)–\(losses) · \(winRatePct(wins, losses))%"
    }

    // MARK: Pocket games
    public struct PocketRecord: Equatable, Codable {
        public var wins: Int
        public var losses: Int
        public var draws: Int
        public init(wins: Int = 0, losses: Int = 0, draws: Int = 0) { self.wins = wins; self.losses = losses; self.draws = draws }
        public var played: Bool { wins + losses + draws > 0 }
    }
    public struct PocketKindRecord: Equatable, Codable {
        public var kind: FriendlyKind
        public var wins: Int
        public var losses: Int
        public var draws: Int
        public var bestChain: Int
        public var record: PocketRecord { PocketRecord(wins: wins, losses: losses, draws: draws) }
    }
    public struct PocketFriendRecord: Equatable, Codable {
        public var total: PocketRecord
        public var byKind: [String: PocketRecord]
    }
    public struct PocketRecords: Equatable, Codable {
        public var byKind: [PocketKindRecord]
        public var byFriend: [String: PocketFriendRecord]
        public var total: PocketRecord
    }
    /// A finished-game slice (a friendly_games row).
    public struct PocketGameRow {
        public let kind: FriendlyKind
        public let playerA: String
        public let playerB: String
        public let status: String   // active | done | resigned | expired
        public let winner: String?
        public let chainWords: Int
        public init(kind: FriendlyKind, playerA: String, playerB: String, status: String, winner: String?, chainWords: Int = 0) {
            self.kind = kind; self.playerA = playerA; self.playerB = playerB; self.status = status; self.winner = winner; self.chainWords = chainWords
        }
    }

    public static let pocketOrder: [FriendlyKind] = [.rps, .ttt, .coin, .pass, .ghost, .chain]

    /// Records for `me` from their finished pocket games (expired / unfinished games never count).
    public static func pocketRecords(_ rows: [PocketGameRow], me: String) -> PocketRecords {
        var kinds: [FriendlyKind: PocketKindRecord] = [:]
        for k in pocketOrder { kinds[k] = PocketKindRecord(kind: k, wins: 0, losses: 0, draws: 0, bestChain: 0) }
        var byFriend: [String: PocketFriendRecord] = [:]
        var total = PocketRecord()
        for g in rows {
            guard g.status == "done" || g.status == "resigned" else { continue }
            guard g.playerA == me || g.playerB == me else { continue }
            let opp = g.playerA == me ? g.playerB : g.playerA
            func bump(_ r: inout PocketRecord) { if g.winner == me { r.wins += 1 } else if g.winner != nil { r.losses += 1 } else { r.draws += 1 } }
            var k = kinds[g.kind]!
            var kr = k.record; bump(&kr); k.wins = kr.wins; k.losses = kr.losses; k.draws = kr.draws
            var slot = byFriend[opp] ?? PocketFriendRecord(total: PocketRecord(), byKind: [:])
            bump(&slot.total)
            var ks = slot.byKind[g.kind.rawValue] ?? PocketRecord(); bump(&ks); slot.byKind[g.kind.rawValue] = ks
            byFriend[opp] = slot
            bump(&total)
            if g.kind == .chain && g.winner == me && g.chainWords > k.bestChain { k.bestChain = g.chainWords }
            kinds[g.kind] = k
        }
        return PocketRecords(byKind: pocketOrder.map { kinds[$0]! }, byFriend: byFriend, total: total)
    }

    /// "3–1" / "3–1–1" with draws / "No games yet".
    public static func pocketLine(_ r: PocketRecord) -> String {
        if !r.played { return "No games yet" }
        return r.draws > 0 ? "\(r.wins)–\(r.losses)–\(r.draws)" : "\(r.wins)–\(r.losses)"
    }

    public static func pocketTileLine(_ r: PocketKindRecord) -> String {
        if r.kind == .chain && r.bestChain > 0 { return "\(pocketLine(r.record)) · best \(r.bestChain)" }
        return pocketLine(r.record)
    }

    // MARK: Player profile
    public enum FriendshipState { case myself, friends, incoming, requested, none }

    public static func friendshipState(isSelf: Bool, isFriend: Bool, incoming: Bool, requested: Bool) -> FriendshipState {
        if isSelf { return .myself }
        if isFriend { return .friends }
        if incoming { return .incoming }
        if requested { return .requested }
        return .none
    }

    public enum ProfileAction: String { case challenge, pocket, react, addFriend, requested, accept, decline }
    public enum ProfileMenuAction: String { case unfriend, block, report }

    /// Challenge · Pocket game · React for friends; a clear Add friend when not; Requested while pending; Accept / Decline
    /// when they asked you. Block + Report always (someone else); Unfriend only for friends.
    public static func profileActions(_ state: FriendshipState) -> (row: [ProfileAction], menu: [ProfileMenuAction]) {
        switch state {
        case .myself: return ([], [])
        case .friends: return ([.challenge, .pocket, .react], [.unfriend, .block, .report])
        case .incoming: return ([.accept, .decline], [.block, .report])
        case .requested: return ([.requested], [.block, .report])
        case .none: return ([.addFriend], [.block, .report])
        }
    }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// "Friends since Sep 2026" from an ISO time (UTC month), or nil.
    public static func friendsSinceLine(_ iso: String?) -> String? {
        guard let iso = iso else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let g = ISO8601DateFormatter()
        g.formatOptions = [.withInternetDateTime]
        guard let d = f.date(from: iso) ?? g.date(from: iso) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month], from: d)
        guard let y = c.year, let m = c.month else { return nil }
        return "Friends since \(months[m - 1]) \(y)"
    }

    /// Under two highlights fold into Lately; two or more show as an even 2-column grid (odd last dropped), max four.
    public static func highlightsLayout(count: Int) -> (fold: Bool, shown: Int) {
        if count < 2 { return (true, count) }
        let capped = min(count, 4)
        return (false, capped - (capped % 2))
    }

    /// "VS 3–1 · Pocket 2–2"; a side with no games is left out.
    public static func headToHeadLine(vs: PocketRecord, pocket: PocketRecord) -> String {
        var parts: [String] = []
        if vs.played { parts.append("VS \(pocketLine(vs))") }
        if pocket.played { parts.append("Pocket \(pocketLine(pocket))") }
        return parts.isEmpty ? "No games together yet" : parts.joined(separator: " · ")
    }

    // MARK: Section title colors (cast body colors)
    public static let castW = "#7c3aed", castC = "#0d9488", castI = "#16a34a", castD = "#2563eb", castS = "#f59e0b", castR = "#64748b", castO = "#f97316"

    public static let sectionTitleColors: [String: String] = [
        "MY GAMES": castW, "HEAD TO HEAD": castD, "BOTS": castC, "GUESSES": castI, "ACTIVITY": castO, "POCKET GAMES": castS,
        "MORE STATS": castR, "TROPHY CASE": castS, "HIGHLIGHTS": castO, "LATELY": castC, "VS": castD,
    ]

    public static func sectionTitleColor(_ title: String) -> String { sectionTitleColors[title.uppercased()] ?? castW }

    // MARK: Go Pro scenes
    public enum ProBenefit: String, CaseIterable { case unlimited, items, vsBots, stats, noLimits }

    public static let proBenefitOrder: [ProBenefit] = [.unlimited, .items, .vsBots, .stats, .noLimits]
    /// art-pro-<name> asset names (the pedestal is the free mascot's stage).
    public static let proScenes: [ProBenefit: String] = [
        .unlimited: "art-pro-unlimited", .items: "art-pro-items", .vsBots: "art-pro-vs-bots", .stats: "art-pro-stats", .noLimits: "art-pro-no-limits",
    ]
    public static let proPedestal = "art-pro-stage-pedestal"
    public static let proBenefitCaption: [ProBenefit: String] = [
        .unlimited: "Every game, any time", .items: "Wear every Pro mascot item", .vsBots: "VS on every game, bots included",
        .stats: "Stats that go deeper", .noLimits: "No limits. No ads.",
    ]

    public static func proBenefit(forReason reason: String?) -> ProBenefit {
        let r = (reason ?? "").lowercased()
        func has(_ s: String) -> Bool { r.contains(s) }
        if has("mascot") || has("item") || has("style") || has("dress") { return .items }
        if has("unlimited") { return .unlimited }
        if has("bot") || has("vs") || has("versus") { return .vsBots }
        if has("stat") || has("insight") || has("trend") { return .stats }
        if has("no limit") || has("ad-free") || has("ads") { return .noLimits }
        return .unlimited
    }
}
