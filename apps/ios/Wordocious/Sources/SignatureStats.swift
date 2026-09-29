import SwiftUI
import Supabase
import WordociousCore

/// New stats from the audit (Stats + Friends redesign D2, founder 2026-09-26),
/// all derived from data the profile already reads — no schema change. Port of
/// web `lib/signature-stats.ts` (pure, tested there) + `signature-cards.tsx`.
///
///   Free:  Best day (most wins in one day), Best week (most wins Mon–Sun),
///          Comebacks (wins on the very last row), Perfect games.
///   Pro:   Standing trend — your average "Top X%" per day over the last 30
///          days, the same badge formula everywhere.
enum SignatureStats {

    private static var client: SupabaseClient { AuthService.shared.client }

    /// Last-row wins: the mode's maximum guess count for word engines (a "comeback").
    static let modeMaxGuesses: [String: Int] = [
        "DUEL": 6, "QUORDLE": 9, "OCTORDLE": 13, "SEQUENCE": 10, "RESCUE": 6, "PROPERNOUNDLE": 6, "DUEL_6": 7, "DUEL_7": 8,
    ]

    struct Row {
        let day: String        // yyyy-MM-dd, local
        let gameMode: String
        let won: Bool
        let guessCount: Int
    }

    struct Signature: Equatable {
        struct Best: Equatable { let key: String; let wins: Int }
        let bestDay: Best?
        let bestWeek: Best?
        let comebacks: Int
        let perfectGames: Int
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func localDay(_ date: Date) -> String { dayFormatter.string(from: date) }
    static func parseDay(_ day: String) -> Date? { dayFormatter.date(from: day) }

    /// The Monday (local) of the week containing `day` — web `localWeekStartOf`.
    static func localWeekStart(of day: String) -> String {
        guard let d = parseDay(day) else { return day }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        let jsDay = cal.component(.weekday, from: d) - 1     // 0 = Sunday, like JS getDay()
        let monday = cal.date(byAdding: .day, value: -((jsDay + 6) % 7), to: d) ?? d
        return dayFormatter.string(from: monday)
    }

    /// Pure: fold match rows into the four signature facts (web `computeSignature`).
    static func computeSignature(_ rows: [Row]) -> Signature {
        var byDay: [String: Int] = [:]
        var byWeek: [String: Int] = [:]
        var comebacks = 0, perfect = 0
        for r in rows where r.won {
            byDay[r.day, default: 0] += 1
            byWeek[localWeekStart(of: r.day), default: 0] += 1
            if let max = modeMaxGuesses[r.gameMode], r.guessCount == max { comebacks += 1 }
            if let meta = ModeGen.byDbKey(r.gameMode), r.guessCount <= meta.guessBase { perfect += 1 }
        }
        // Most wins; a tie goes to the later key (web parity).
        func top(_ m: [String: Int]) -> Signature.Best? {
            var best: (String, Int)? = nil
            for (k, v) in m {
                if let b = best, !(v > b.1 || (v == b.1 && k > b.0)) { continue }
                best = (k, v)
            }
            return best.map { Signature.Best(key: $0.0, wins: $0.1) }
        }
        return Signature(bestDay: top(byDay), bestWeek: top(byWeek), comebacks: comebacks, perfectGames: perfect)
    }

    private struct MatchRow: Decodable {
        let created_at: String
        let game_mode: String
        let winner_id: String?
        let player1_score: Int?
        let player1_id: String
    }

    /// The player's solo `matches` rows (up to 1000) folded into a Signature.
    static func fetchSignature(userId: String) async -> Signature {
        let rows: [MatchRow] = (try? await client.from("matches")
            .select("created_at, game_mode, winner_id, player1_score, player1_id, player2_id")
            .or("player1_id.eq.\(userId),player2_id.eq.\(userId)")
            .is("player2_id", value: nil)
            .order("created_at", ascending: false)
            .limit(1000)
            .execute().value) ?? []
        let uid = userId.lowercased()
        return computeSignature(rows.compactMap { r in
            guard let d = parseTimestamp(r.created_at) else { return nil }
            return Row(day: localDay(d), gameMode: r.game_mode,
                       won: r.winner_id?.lowercased() == uid, guessCount: r.player1_score ?? 0)
        })
    }

    // MARK: - Standing trend (Pro)

    struct DailyScore: Decodable, Equatable {
        let day: String
        let game_mode: String
        let composite_score: Double?
    }

    struct StandingPoint: Equatable {
        let day: String
        let topPercent: Int
        let modes: Int
    }

    /// Pure: per-day average of the badge percentile over the dailies I played
    /// (web `computeStandingTrend`). Fields of fewer than two players are skipped.
    static func computeStandingTrend(mine: [DailyScore], field: [DailyScore]) -> [StandingPoint] {
        var scores: [String: [Double]] = [:]
        for f in field { scores["\(f.day)|\(f.game_mode)", default: []].append(f.composite_score ?? 0) }
        var perDay: [String: [Int]] = [:]
        for m in mine {
            let arr = scores["\(m.day)|\(m.game_mode)"] ?? []
            guard arr.count >= 2 else { continue }
            let my = m.composite_score ?? 0
            let better = arr.filter { $0 > my }.count
            // Badge formula (Format.topPercentLabel): percentile of the field you beat — one "Top X%" everywhere.
            let pct = max(1, 100 - Int(((1 - Double(better) / Double(arr.count)) * 100).rounded()))
            perDay[m.day, default: []].append(pct)
        }
        return perDay.map { day, pcts in
            StandingPoint(day: day, topPercent: Int((Double(pcts.reduce(0, +)) / Double(pcts.count)).rounded()), modes: pcts.count)
        }
        .sorted { $0.day < $1.day }
    }

    /// My solo daily_results over the last `days` + the field's rows for those modes/days.
    static func fetchStandingTrend(userId: String, days: Int = 30) async -> [StandingPoint] {
        let to = Date()
        let from = Calendar.current.date(byAdding: .day, value: -(days - 1), to: to) ?? to
        let fromDay = localDay(from), toDay = localDay(to)
        let mine: [DailyScore] = (try? await client.from("daily_results")
            .select("day, game_mode, composite_score")
            .eq("user_id", value: userId).eq("play_type", value: "solo")
            .gte("day", value: fromDay).lte("day", value: toDay)
            .execute().value) ?? []
        guard !mine.isEmpty else { return [] }
        let modes = Array(Set(mine.map(\.game_mode)))
        let field: [DailyScore] = (try? await client.from("daily_results")
            .select("day, game_mode, composite_score")
            .eq("play_type", value: "solo")
            .gte("day", value: fromDay).lte("day", value: toDay)
            .in("game_mode", values: modes)
            .limit(20000)
            .execute().value) ?? []
        return computeStandingTrend(mine: mine, field: field)
    }

    // MARK: - Labels

    /// "Sep 22" (en_US month/day, like the web's toLocaleDateString).
    static func dayLabel(_ day: String) -> String {
        guard let d = parseDay(day) else { return "" }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "MMM d"
        return f.string(from: d)
    }

    /// "Sep 15–21" — the Mon–Sun range of a week.
    static func weekLabel(_ monday: String) -> String {
        guard let m = parseDay(monday), let s = Calendar.current.date(byAdding: .day, value: 6, to: m) else { return monday }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "d"
        return "\(dayLabel(monday))–\(f.string(from: s))"
    }
}

// MARK: - Signature card (free)

/// Best day · Best week · Comebacks · Perfect — four StatCells on one card,
/// hidden until the matches fold in (web `SignatureCard`).
struct SignatureCard: View {
    let userId: String
    @State private var stats: SignatureStats.Signature?

    /// Memo in the first frame (founder, 2026-09-29) — the card popped in under its header.
    init(userId: String) {
        self.userId = userId
        _stats = State(initialValue: StatsMemo.shared.get("signature:\(userId)"))
    }

    var body: some View {
        Group {
            if stats == nil {
                SkeletonBlock(height: 76, cornerRadius: 16)
            } else if let s = stats {
                KitCard {
                    HStack(spacing: 8) {
                        StatCell(icon: "calendar", label: "Best day",
                                 value: s.bestDay.map { "\($0.wins)" } ?? "—",
                                 sub: s.bestDay.map { "\(SignatureStats.dayLabel($0.key)) · wins" },
                                 color: Color(hex: 0x7C3AED))
                        StatCell(icon: "calendar.badge.clock", label: "Best week",
                                 value: s.bestWeek.map { "\($0.wins)" } ?? "—",
                                 sub: s.bestWeek.map { "\(SignatureStats.weekLabel($0.key)) · wins" },
                                 color: Color(hex: 0x2563EB))
                        StatCell(icon: "arrow.uturn.backward", label: "Comebacks", value: "\(s.comebacks)",
                                 sub: "last-row wins", color: Color(hex: 0xF97316))
                        StatCell(icon: "star.fill", label: StatLabels.perfect, value: "\(s.perfectGames)",
                                 sub: "games", color: Theme.win)
                    }
                }
            }
        }
        .task(id: userId) {
            if let memo: SignatureStats.Signature = StatsMemo.shared.get("signature:\(userId)") { stats = memo }
            let fresh = await SignatureStats.fetchSignature(userId: userId)
            stats = fresh
            StatsMemo.shared.set("signature:\(userId)", fresh)
        }
    }
}

// MARK: - Standing trend card (Pro)

/// Your average Top X% per day over the last 30 days as a sparkline (1 % at
/// the top, dashed Top-25 % line, amber dots at or under it). Free players see
/// a fixed sample curve behind the Pro lock; Pro hides it under two points.
struct StandingTrendCard: View {
    let userId: String
    let isPro: Bool
    @State private var points: [SignatureStats.StandingPoint]?

    /// Memo in the first frame (founder, 2026-09-29).
    init(userId: String, isPro: Bool) {
        self.userId = userId; self.isPro = isPro
        _points = State(initialValue: isPro ? StatsMemo.shared.get("standingTrend:\(userId)") : nil)
    }

    private static let purple = Color(hex: 0x7C3AED)
    private static let amber = Color(hex: 0xD97706)
    private static let sample: [SignatureStats.StandingPoint] =
        [38, 31, 27, 22, 25, 18, 14, 16, 12, 9].enumerated().map { .init(day: "d\($0.offset)", topPercent: $0.element, modes: 3) }

    private var data: [SignatureStats.StandingPoint] { isPro ? (points ?? []) : Self.sample }

    var body: some View {
        Group {
            if isPro, let p = points, p.count < 2 {
                EmptyView()
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Standing Trend", accent: Self.purple)
                    if isPro && points == nil {
                        SkeletonBlock(height: 130, cornerRadius: 16)
                    } else if isPro {
                        chart
                    } else {
                        ProLockOverlay(label: "Standing trend — Pro") { chart }
                    }
                }
            }
        }
        .task(id: "\(userId)-\(isPro)") {
            guard isPro else { points = []; return }
            if let memo: [SignatureStats.StandingPoint] = StatsMemo.shared.get("standingTrend:\(userId)") { points = memo }
            let fresh = await SignatureStats.fetchStandingTrend(userId: userId, days: 30)
            points = fresh
            StatsMemo.shared.set("standingTrend:\(userId)", fresh)
        }
    }

    private var chart: some View {
        let d = data
        let latest = d.last, first = d.first
        let improving = (latest?.topPercent ?? 0) < (first?.topPercent ?? 0)
        return ChartCard(
            title: "Standing trend",
            hint: latest.map { "Last 30 days · now Top \($0.topPercent)%\(improving ? " · climbing" : "")" },
            empty: d.isEmpty ? "Play a few dailies to see your standing over time." : nil
        ) {
            VStack(spacing: 6) {
                Sparkline(points: d.map(\.topPercent))
                    .frame(height: 80)
                    .accessibilityLabel("Average daily standing, lower is better")
                HStack {
                    Text(first.map { Self.dayLabel($0.day) } ?? "")
                    Spacer()
                    HStack(spacing: 3) {
                        Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 9, weight: .bold))
                        Text("dashed = Top 25%")
                    }
                    Spacer()
                    Text(latest.map { Self.dayLabel($0.day) } ?? "")
                }
                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
    }

    /// Real days only — the sample curve's "d0…" keys render blank.
    private static func dayLabel(_ day: String) -> String {
        SignatureStats.parseDay(day) == nil ? "" : SignatureStats.dayLabel(day)
    }

    /// The line: 1 % at the top, 100 % at the bottom, a dashed Top-25 % rule.
    private struct Sparkline: View {
        let points: [Int]
        var body: some View {
            Canvas { ctx, size in
                let pad: CGFloat = 6
                let w = size.width, h = size.height
                func y(_ pct: Int) -> CGFloat { pad + CGFloat(pct - 1) / 99 * (h - pad * 2) }
                var rule = Path()
                rule.move(to: CGPoint(x: pad, y: y(25))); rule.addLine(to: CGPoint(x: w - pad, y: y(25)))
                ctx.stroke(rule, with: .color(Theme.border), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                guard !points.isEmpty else { return }
                let step = (w - pad * 2) / CGFloat(max(1, points.count - 1))
                let pts = points.enumerated().map { CGPoint(x: pad + CGFloat($0.offset) * step, y: y($0.element)) }
                var line = Path()
                for (i, p) in pts.enumerated() { i == 0 ? line.move(to: p) : line.addLine(to: p) }
                ctx.stroke(line, with: .color(StandingTrendCard.purple),
                           style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                for (i, p) in pts.enumerated() {
                    let dot = Path(ellipseIn: CGRect(x: p.x - 2.5, y: p.y - 2.5, width: 5, height: 5))
                    ctx.fill(dot, with: .color(points[i] <= 25 ? StandingTrendCard.amber : StandingTrendCard.purple))
                }
            }
        }
    }
}
