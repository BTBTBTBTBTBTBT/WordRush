import SwiftUI
import Supabase
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

// LEADERBOARD SHARE — the daily-leaderboard share card (solo / VS / yesterday's
// podium) + its share flow. Mirrors web lib/leaderboard-share.ts (pure input
// builders), lib/share-image.ts drawLeaderboardCard (1080² canvas renderer),
// and lib/leaderboard-share-flow.ts + share-utils.ts shareResult linkOnly (the
// /s/ unfurl IS the card, so the share sheet gets the URL alone — image+link
// would render twice in Messages; the image attaches only when upload fails).
// Keep copy strings, layout coordinates, and URL params identical to web.

// MARK: - Card input model (web ShareLeaderboardInput parity)

struct LbShareRow {
    let rank: Int
    let name: String
    let scoreDisplay: String
    /// Full-stats subline ("4 guesses · 3:44 · Win" / "3-1 today"). Nil on the
    /// compressed top-5 rows of the sharer-below-top-5 layout.
    var subline: String? = nil
    /// Sharer's own row — gold "you" highlight + "· YOU" label.
    var isYou: Bool = false
}

struct LbShareDelta {
    let text: String
    let improved: Bool
}

enum LbShareVariant: String {
    case solo, vs, podium
    // FRIENDS (§207): friends-only board + settled friends podium — same
    // geometry, indigo identity, dense friend ranks in rows/you/shareRank.
    case friends, friendsPodium
    // SWEEP (§231): the cross-mode Sweep board + its settled podium — same
    // geometry, the Daily Sweep violet/pink identity, rows from SweepEntry
    // (RPC tie-aware ranks, "time · X/9 · Sweep|Flawless" sublines).
    case sweep, sweepPodium

    /// /s/ kind — also the storage-key prefix (web leaderboardKind()).
    var kind: String {
        switch self {
        case .solo: return "Leaderboard"
        case .vs: return "VsLeaderboard"
        case .podium: return "Podium"
        case .friends: return "FriendsBoard"
        case .friendsPodium: return "FriendsPodium"
        case .sweep: return "SweepBoard"
        case .sweepPodium: return "SweepPodium"
        }
    }
}

struct LbShareInput {
    let variant: LbShareVariant
    /// Web ShareMode name ("Six", "Classic") — drives the URL `lm` param + key.
    let shareMode: String
    /// DB mode key ("DUEL_6") — share_events game_mode tag.
    let gameModeRaw: String
    /// Mode chip accent (VS teal on the VS variant, catalog accent otherwise).
    let modeAccent: Color
    /// Mode chip text ("Classic Six", "Classic Six VS").
    let modeChip: String
    /// Date chip text ("Aug 7, 2026 · #123 · as of 11:15 AM" / "Aug 6, 2026 · Final").
    let dateChip: String
    /// Top rows (≤5; podium ≤3), ordered by rank.
    let rows: [LbShareRow]
    /// Sharer's row when ranked below the top rows (after a "• • •" divider).
    var you: LbShareRow? = nil
    /// "#12 of 87" under the out-of-top you-row.
    var youRankLine: String? = nil
    /// Rank-vs-yesterday pill; nil = didn't play yesterday / unchanged.
    var delta: LbShareDelta? = nil
    /// Footer hook line.
    let footer: String
    /// Board day (yyyy-MM-dd) — the storage-key date.
    let day: String
    var shareRank: Int? = nil
    var sharePlayers: Int? = nil
}

// MARK: - Pure builders (web lib/leaderboard-share.ts parity)

enum LeaderboardShareBuilder {
    struct RankedEntry {
        let rank: Int
        let entry: LeaderboardEntry
    }

    /// Day #1 of the daily system (web DAILY_PUZZLE_EPOCH) — drives the "#123"
    /// puzzle number on the date chip.
    static let dailyPuzzleEpoch = (year: 2026, month: 4, day: 7)

    /// 1-based daily puzzle number for a yyyy-MM-dd day; nil for bad input or
    /// pre-epoch days.
    static func puzzleNumber(forDay day: String) -> Int? {
        let parts = day.split(separator: "-")
        guard parts.count == 3,
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let epoch = cal.date(from: DateComponents(year: dailyPuzzleEpoch.year,
                                                        month: dailyPuzzleEpoch.month,
                                                        day: dailyPuzzleEpoch.day)),
              let date = cal.date(from: DateComponents(year: y, month: m, day: d)) else { return nil }
        let n = Int((date.timeIntervalSince(epoch) / 86400).rounded()) + 1
        return n >= 1 ? n : nil
    }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// "Aug 7, 2026" from a yyyy-MM-dd day string (no Date/timezone involved).
    static func formatBoardDate(_ day: String) -> String {
        let parts = day.split(separator: "-")
        guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]),
              m >= 1, m <= 12 else { return day }
        return "\(months[m - 1]) \(d), \(parts[0])"
    }

    /// "11:15 AM" — device-local clock time for the snapshot stamp.
    static func clockTime(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        let h24 = c.hour ?? 0
        let ampm = h24 >= 12 ? "PM" : "AM"
        let h = h24 % 12 == 0 ? 12 : h24 % 12
        return "\(h):\(String(format: "%02d", c.minute ?? 0)) \(ampm)"
    }

    /// The "▲3 vs yesterday" / "▼2 vs yesterday" pill. Nil when the sharer
    /// didn't play yesterday or their rank is unchanged.
    static func rankDelta(yesterdayRank: Int?, todayRank: Int) -> LbShareDelta? {
        guard let y = yesterdayRank else { return nil }
        let d = y - todayRank
        if d == 0 { return nil }
        return d > 0
            ? LbShareDelta(text: "▲\(d) vs yesterday", improved: true)
            : LbShareDelta(text: "▼\(-d) vs yesterday", improved: false)
    }

    private static func fmtClock(_ seconds: Double) -> String {
        let s = max(0, Int(seconds))
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }

    static func soloSubline(_ e: LeaderboardEntry) -> String {
        "\(e.guessCount) guesses · \(fmtClock(e.timeSeconds)) · \(e.completed ? "Win" : "Loss")"
    }

    static func vsSubline(_ e: LeaderboardEntry) -> String {
        // W-L today. vs_losses excludes draws; rows without the column fall
        // back to games-minus-wins (web parity).
        let wins = e.vsWins ?? 0
        let losses = e.vsLosses ?? max(0, (e.vsGames ?? 0) - wins)
        return "\(wins)-\(losses) today"
    }

    private static func row(_ r: RankedEntry, userId: String?,
                            subline: ((LeaderboardEntry) -> String)?,
                            scoreLabels: [Double: String] = [:]) -> LbShareRow {
        LbShareRow(rank: r.rank,
                   name: r.entry.username,
                   scoreDisplay: scoreLabels[r.entry.compositeScore] ?? formatScore(r.entry.compositeScore),
                   subline: subline.map { $0(r.entry) },
                   isYou: userId != nil && r.entry.userId == userId)
    }

    /// Today's-board card. Top 5 rows with full stats; a sharer below the top 5
    /// compresses the top rows to name+score and adds their highlighted
    /// full-stats row after a "• • •" divider with "#R of TOTAL". A sharer who
    /// hasn't played today gets no you-row. Nil for an empty board.
    static func buildDailyInput(
        variant: LbShareVariant, shareMode: String, modeLabel: String,
        gameModeRaw: String, modeAccent: Color,
        day: String, now: Date = Date(),
        ranked: [RankedEntry], userId: String?,
        userRank: (rank: Int, total: Int)?, userEntry: LeaderboardEntry?,
        yesterdayRank: Int?
    ) -> LbShareInput? {
        let top = Array(ranked.prefix(5))
        guard !top.isEmpty else { return nil }

        let subline: (LeaderboardEntry) -> String = variant == .vs ? vsSubline : soloSubline
        let youInTop = userId != nil && top.contains { $0.entry.userId == userId }
        let belowTop = !youInTop && userId != nil && userRank != nil && userEntry != nil
        let delta = userRank.flatMap { rankDelta(yesterdayRank: yesterdayRank, todayRank: $0.rank) }

        let puzzle = puzzleNumber(forDay: day)
        // TIE-AWARE scores (board parity): rows sharing a whole number on THIS
        // card render the decimals that rank them — the sharer's below-fold
        // row joins the collision set.
        let cardLabels = tieAwareScoreLabels(
            top.map(\.entry.compositeScore) + (belowTop ? [userEntry!.compositeScore] : []))
        // "as of h:mm" marks the card as a SNAPSHOT of a live board — today's
        // standings keep moving. The settled Podium card says "· Final" instead.
        let dateChip = "\(formatBoardDate(day))\(puzzle.map { " · #\($0)" } ?? "") · as of \(clockTime(now))"

        var input = LbShareInput(
            variant: variant, shareMode: shareMode, gameModeRaw: gameModeRaw,
            modeAccent: modeAccent,
            modeChip: variant == .vs ? "\(modeLabel) VS" : modeLabel,
            dateChip: dateChip,
            // Sharer below the top 5 → compress top rows to name+score only.
            rows: top.map { row($0, userId: userId, subline: belowTop ? nil : subline, scoreLabels: cardLabels) },
            footer: variant == .friends
                ? "Add your friends — play free at wordocious.com"
                : variant == .vs
                    ? "Think you can take them? wordocious.com"
                    : "Can you beat them? Play free at wordocious.com",
            day: day)
        input.delta = delta
        input.shareRank = userRank?.rank
        input.sharePlayers = userRank?.total

        if belowTop, let r = userRank, let e = userEntry {
            input.you = LbShareRow(rank: r.rank, name: e.username,
                                   scoreDisplay: cardLabels[e.compositeScore] ?? formatScore(e.compositeScore),
                                   subline: subline(e), isYou: true)
            input.youRankLine = "#\(r.rank) of \(r.total)"
        }
        return input
    }

    /// The settled variant for Yesterday's Winners / Podium: "YESTERDAY'S
    /// PODIUM" identity, "MMM D, YYYY · Final" chip, top-3 full-stats rows.
    /// Nil when yesterday had no finishers.
    static func buildPodiumInput(
        playType: LbShareVariant, friends: Bool = false,
        shareMode: String, modeLabel: String,
        gameModeRaw: String, modeAccent: Color,
        day: String, ranked: [RankedEntry], userId: String?,
        userRank: (rank: Int, total: Int)? = nil,
        userEntry: LeaderboardEntry? = nil
    ) -> LbShareInput? {
        // Top 5 + sharer's final rank — daily-card parity (founder, Aug 10).
        let top = Array(ranked.prefix(5))
        guard !top.isEmpty else { return nil }
        let subline: (LeaderboardEntry) -> String = playType == .vs ? vsSubline : soloSubline
        let youInTop = userId != nil && top.contains { $0.entry.userId == userId }
        let belowTop = !youInTop && userId != nil && userRank != nil && userEntry != nil
        let cardLabels = tieAwareScoreLabels(
            top.map(\.entry.compositeScore) + (belowTop ? [userEntry!.compositeScore] : []))
        var input = LbShareInput(
            variant: friends ? .friendsPodium : .podium,
            shareMode: shareMode, gameModeRaw: gameModeRaw,
            modeAccent: modeAccent,
            modeChip: playType == .vs ? "\(modeLabel) VS" : modeLabel,
            dateChip: "\(formatBoardDate(day)) · Final",
            rows: top.map { row($0, userId: userId, subline: belowTop ? nil : subline, scoreLabels: cardLabels) },
            footer: "Today’s board is open — wordocious.com",
            day: day)
        input.shareRank = userRank?.rank
        input.sharePlayers = userRank?.total
        if belowTop, let r = userRank, let e = userEntry {
            input.you = LbShareRow(rank: r.rank, name: e.username,
                                   scoreDisplay: cardLabels[e.compositeScore] ?? formatScore(e.compositeScore),
                                   subline: subline(e), isYou: true)
            input.youRankLine = "#\(r.rank) of \(r.total)"
        }
        return input
    }

    // MARK: Sweep (§231)

    /// Web ShareMode for the Daily Sweep — the `lm` URL param + key segment.
    static let sweepShareMode = "SWEEP"
    /// share_events game_mode tag — the existing Daily Sweep card's mode.
    static let sweepGameModeRaw = "DailySweep"
    static let sweepModeChip = "Daily Sweep"
    static let sweepAccent = Color(hex: 0x7C3AED)

    /// "12m 4s · 9/9 · Flawless" — the sweep row's full-stats subline. The
    /// sweep has no guess count; time + modes-won + the sweep tier are what
    /// the board itself shows.
    static func sweepSubline(_ e: SweepEntry) -> String {
        "\(formatShortTime(e.totalTime)) · \(e.modesWon)/9 · \(e.isFlawless ? "Flawless" : "Sweep")"
    }

    private static func sweepRow(_ e: SweepEntry, userId: String?,
                                 scoreLabels: [Double: String]) -> LbShareRow {
        // Sublines stay on every row (web parity) — a sweep card is at most
        // 5 + 1 rows, so there's room without the daily card's compression.
        LbShareRow(rank: e.rank, name: e.username,
                   scoreDisplay: scoreLabels[e.totalScore] ?? formatScore(e.totalScore),
                   subline: sweepSubline(e),
                   isYou: userId != nil && e.userId == userId)
    }

    /// Sweep board / sweep podium card from the page's SweepEntry rows. Ranks
    /// come from the entries themselves (the RPC is tie-aware), so no
    /// RankedEntry wrapping. `podium` → yesterday's settled top 3 with the
    /// "· Final" chip; otherwise today's top 5 "as of h:mm". The sharer below
    /// the top rows gets their you-row only when the board holds it (no extra
    /// window read — a sweep board is tiny) plus "#R of TOTAL" from the sweep
    /// rank; absent either, the card simply omits it. No delta pill: sweeping
    /// two days running is rare enough that "vs yesterday" would almost
    /// always be blank. Nil for an empty board.
    static func buildSweepInput(
        podium: Bool, day: String, now: Date = Date(),
        entries: [SweepEntry], userId: String?,
        userRank: (rank: Int, total: Int)?
    ) -> LbShareInput? {
        let top = Array(entries.prefix(podium ? 3 : 5))
        guard !top.isEmpty else { return nil }
        let youInTop = userId != nil && top.contains { $0.userId == userId }
        let userEntry = userId.flatMap { uid in entries.first { $0.userId == uid } }
        let belowTop = !youInTop && userRank != nil && userEntry != nil
        let cardLabels = tieAwareScoreLabels(
            top.map(\.totalScore) + (belowTop ? [userEntry!.totalScore] : []))
        let puzzle = puzzleNumber(forDay: day)
        let dateChip = podium
            ? "\(formatBoardDate(day)) · Final"
            : "\(formatBoardDate(day))\(puzzle.map { " · #\($0)" } ?? "") · as of \(clockTime(now))"

        var input = LbShareInput(
            variant: podium ? .sweepPodium : .sweep,
            shareMode: sweepShareMode, gameModeRaw: sweepGameModeRaw,
            modeAccent: sweepAccent, modeChip: sweepModeChip,
            dateChip: dateChip,
            rows: top.map { sweepRow($0, userId: userId, scoreLabels: cardLabels) },
            footer: "Can you sweep all nine? Play free at wordocious.com",
            day: day)
        input.shareRank = userRank?.rank
        input.sharePlayers = userRank?.total
        if belowTop, let r = userRank, let e = userEntry {
            input.you = sweepRow(e, userId: userId, scoreLabels: cardLabels)
            input.youRankLine = "#\(r.rank) of \(r.total)"
        }
        return input
    }
}

// MARK: - Card renderer (web drawLeaderboardCard parity, 1080×1080)

#if canImport(UIKit)
struct LeaderboardShareCardView: View {
    let input: LbShareInput
    var size: CGSize { CGSize(width: 1080, height: 1080) }

    // Per-variant identity: lavender for the daily board + podium, mint/teal
    // for the VS battle board (web LB_THEME).
    private struct LbTheme {
        let bg: Color; let label: Color; let panelBorder: Color; let footer: Color
    }
    private var theme: LbTheme {
        switch input.variant {
        case .solo:
            return LbTheme(bg: Color(hex: 0xF5F3FF), label: Color(hex: 0x7C3AED),
                           panelBorder: Color(hex: 0xA78BFA, alpha: 1.0 / 3), footer: Color(hex: 0x7C3AED))
        case .vs:
            return LbTheme(bg: Color(hex: 0xF0FDFA), label: Color(hex: 0x0D9488),
                           panelBorder: Color(hex: 0x0D9488, alpha: 1.0 / 3), footer: Color(hex: 0x0D9488))
        case .podium:
            return LbTheme(bg: Color(hex: 0xF5F3FF), label: Color(hex: 0xD97706),
                           panelBorder: Color(hex: 0xF59E0B, alpha: 1.0 / 3), footer: Color(hex: 0x7C3AED))
        // Friends (§207): indigo — the leaderboard tab's own accent family.
        case .friends:
            return LbTheme(bg: Color(hex: 0xEEF2FF), label: Color(hex: 0x4F46E5),
                           panelBorder: Color(hex: 0x6366F1, alpha: 1.0 / 3), footer: Color(hex: 0x4F46E5))
        case .friendsPodium:
            return LbTheme(bg: Color(hex: 0xEEF2FF), label: Color(hex: 0xD97706),
                           panelBorder: Color(hex: 0xF59E0B, alpha: 1.0 / 3), footer: Color(hex: 0x4F46E5))
        // Sweep (§231): the Daily Sweep card's violet→pink family on a blush
        // ground, so a sweep board reads as the sweep's own surface.
        case .sweep:
            return LbTheme(bg: Color(hex: 0xFDF2F8), label: Color(hex: 0x7C3AED),
                           panelBorder: Color(hex: 0xEC4899, alpha: 0x55 / 255.0), footer: Color(hex: 0x7C3AED))
        case .sweepPodium:
            return LbTheme(bg: Color(hex: 0xFDF2F8), label: Color(hex: 0xD97706),
                           panelBorder: Color(hex: 0xF59E0B, alpha: 0x55 / 255.0), footer: Color(hex: 0x7C3AED))
        }
    }
    private var labelText: String {
        switch input.variant {
        case .solo: return "DAILY LEADERBOARD"
        case .vs: return "VS BATTLE LEADERBOARD"
        case .podium: return "YESTERDAY’S PODIUM"
        case .friends: return "FRIENDS LEADERBOARD"
        case .friendsPodium: return "FRIENDS PODIUM"
        case .sweep: return "DAILY SWEEP BOARD"
        case .sweepPodium: return "YESTERDAY’S SWEEP PODIUM"
        }
    }

    private let textDark = Color(hex: 0x1A1A2E)
    private let textMuted = Color(hex: 0x6B7280)

    var body: some View {
        Canvas(rendersAsynchronously: false) { ctx, _ in
            draw(ctx)
        }
        .frame(width: size.width, height: size.height)
    }

    // ── Text helpers ─────────────────────────────────────────────────────

    private func resolved(_ ctx: GraphicsContext, _ s: String, _ size: CGFloat,
                          _ weight: Font.Weight, _ color: Color,
                          tracking: CGFloat = 0) -> GraphicsContext.ResolvedText {
        var t = Text(s).font(Brand.fixedFont(size, weight))
        if tracking > 0 { t = t.tracking(tracking) }
        return ctx.resolve(t.foregroundColor(color))
    }

    private func width(of t: GraphicsContext.ResolvedText) -> CGFloat {
        t.measure(in: CGSize(width: 10_000, height: 1_000)).width
    }

    /// Truncate with an ellipsis to fit maxWidth (web clampText).
    private func clamp(_ ctx: GraphicsContext, _ text: String, _ size: CGFloat,
                       _ weight: Font.Weight, maxWidth: CGFloat) -> String {
        if width(of: resolved(ctx, text, size, weight, .black)) <= maxWidth { return text }
        var t = text
        while t.count > 1,
              width(of: resolved(ctx, t + "…", size, weight, .black)) > maxWidth {
            t = String(t.dropLast())
        }
        return t + "…"
    }

    /// Canvas-parity: draw at an alphabetic BASELINE y (web textBaseline
    /// 'alphabetic') — approximated by centering on the cap-height midpoint.
    private func drawAtBaseline(_ ctx: GraphicsContext, _ t: GraphicsContext.ResolvedText,
                                x: CGFloat, baseline: CGFloat, fontSize: CGFloat) {
        ctx.draw(t, at: CGPoint(x: x, y: baseline - fontSize * 0.36), anchor: .center)
    }

    private func tintedImage(_ ctx: GraphicsContext, asset: String, color: Color) -> GraphicsContext.ResolvedImage? {
        // SwiftUI's Image(uiImage:) IGNORES UIKit's withTintColor — the Aug 10
        // template+tint attempt still shipped the original black artwork
        // (founder caught it again Aug 18: ink crown/medals on a shared card).
        // ResolvedImage.shading is the GraphicsContext-native tint: it fills
        // template images with the given shading at draw time.
        var img = ctx.resolve(Image(asset).renderingMode(.template))
        img.shading = .color(color)
        return img
    }

    private func tintedSymbol(_ ctx: GraphicsContext, _ name: String, pointSize: CGFloat,
                              color: Color) -> GraphicsContext.ResolvedImage? {
        // Same shading approach as tintedImage — SF symbols are template by
        // nature; the old UIImage withTintColor was equally ignored. pointSize
        // now only informs the caller's draw rect (see drawRankGlyph).
        _ = pointSize
        var img = ctx.resolve(Image(systemName: name).renderingMode(.template))
        img.shading = .color(color)
        return img
    }

    // ── Rank iconography (web drawLbRankGlyph: crown gold, medal silver,
    //    medal bronze — crown from the shared lucide asset). ───────────────

    private func drawRankGlyph(_ ctx: GraphicsContext, rank: Int, cx: CGFloat, cy: CGFloat) {
        let gold = Color(hex: 0xD97706), silver = Color(hex: 0x9CA3AF), bronze = Color(hex: 0xB45309)
        switch rank {
        case 1:
            if let img = tintedImage(ctx, asset: "crown", color: gold) {
                ctx.draw(img, in: CGRect(x: cx - 20, y: cy - 20, width: 40, height: 40))
            }
        case 2, 3:
            if let img = tintedSymbol(ctx, "medal.fill", pointSize: 32,
                                      color: rank == 2 ? silver : bronze) {
                // Fit the symbol's aspect into a 36pt box (the resolved size
                // is the default body-text glyph, no longer the 32pt config).
                let target: CGFloat = 36
                let s = img.size
                let scale = target / max(s.width, s.height, 1)
                let w = s.width * scale, h = s.height * scale
                ctx.draw(img, in: CGRect(x: cx - w / 2, y: cy - h / 2, width: w, height: h))
            }
        default:
            let t = resolved(ctx, "\(rank)", 30, .black, textMuted)
            ctx.draw(t, at: CGPoint(x: cx, y: cy + 1), anchor: .center)
        }
    }

    // ── One leaderboard row (web drawLbRow parity). ──────────────────────

    private struct RowOpts {
        var rankLine: String? = nil
        var delta: LbShareDelta? = nil
        var separator = false
        /// You-row at the panel's first/last slot — bleed the highlight to the
        /// panel edge and match its corner radius there.
        var edgeTop = false
        var edgeBottom = false
        /// Panel inner padding to consume when bleeding.
        var bleed: CGFloat = 16
    }

    private func drawRow(_ ctx: GraphicsContext, _ row: LbShareRow,
                         x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat, opts: RowOpts) {
        // Gold "you" highlight — full-bleed across the panel with a soft amber
        // glow instead of a hard border, flush to the panel edge at the
        // first/last slot (web founder polish, Aug 7).
        if row.isYou {
            let hy = opts.edgeTop ? y - opts.bleed + 2 : y + 4
            let hb = opts.edgeBottom ? y + h + opts.bleed - 2 : y + h - 4
            let rTop: CGFloat = opts.edgeTop ? 26 : 16
            let rBot: CGFloat = opts.edgeBottom ? 26 : 16
            let gx = x + 2, gw = w - 4
            var gold = Path()
            gold.move(to: CGPoint(x: gx + rTop, y: hy))
            gold.addLine(to: CGPoint(x: gx + gw - rTop, y: hy))
            gold.addArc(tangent1End: CGPoint(x: gx + gw, y: hy),
                        tangent2End: CGPoint(x: gx + gw, y: hy + rTop), radius: rTop)
            gold.addLine(to: CGPoint(x: gx + gw, y: hb - rBot))
            gold.addArc(tangent1End: CGPoint(x: gx + gw, y: hb),
                        tangent2End: CGPoint(x: gx + gw - rBot, y: hb), radius: rBot)
            gold.addLine(to: CGPoint(x: gx + rBot, y: hb))
            gold.addArc(tangent1End: CGPoint(x: gx, y: hb),
                        tangent2End: CGPoint(x: gx, y: hb - rBot), radius: rBot)
            gold.addLine(to: CGPoint(x: gx, y: hy + rTop))
            gold.addArc(tangent1End: CGPoint(x: gx, y: hy),
                        tangent2End: CGPoint(x: gx + rTop, y: hy), radius: rTop)
            gold.closeSubpath()

            // Canvas shadowBlur 26 ≈ Gaussian radius 13.
            ctx.drawLayer { layer in
                layer.addFilter(.shadow(color: Color(hex: 0xF59E0B, alpha: 0.5),
                                        radius: 13, x: 0, y: 0))
                layer.fill(gold, with: .color(Color(hex: 0xFEF3C7)))
            }
            ctx.stroke(gold, with: .linearGradient(
                Gradient(colors: [Color(hex: 0xFCD34D, alpha: 0.55),
                                  Color(hex: 0xF59E0B, alpha: 0.25)]),
                startPoint: CGPoint(x: x, y: hy), endPoint: CGPoint(x: x, y: hb)),
                lineWidth: 2)
        }

        let midY = y + h / 2
        drawRankGlyph(ctx, rank: row.rank, cx: x + 56, cy: midY)

        // Right block: bold score, optional subline underneath.
        let rightX = x + w - 30
        let score = resolved(ctx, row.scoreDisplay, 34, .black, textDark)
        ctx.draw(score, at: CGPoint(x: rightX, y: row.subline != nil ? midY - 13 : midY), anchor: .trailing)
        var rightBlockW = width(of: score)
        if let sub = row.subline {
            let s = resolved(ctx, sub, 21, .bold, textMuted)
            ctx.draw(s, at: CGPoint(x: rightX, y: midY + 16), anchor: .trailing)
            rightBlockW = max(rightBlockW, width(of: s))
        }

        // Left block: name (+ YOU label + delta pill), optional "#R of TOTAL".
        let nameX = x + 96
        let nameMaxW = w - 96 - 30 - rightBlockW - 24
        let nameY = opts.rankLine != nil ? midY - 14 : midY
        var reserved: CGFloat = 0
        if row.isYou {
            reserved = width(of: resolved(ctx, " · YOU", 24, .black, textDark))
        }
        let name = clamp(ctx, row.name, 30, .black, maxWidth: max(60, nameMaxW - reserved))
        let nameT = resolved(ctx, name, 30, .black, textDark)
        ctx.draw(nameT, at: CGPoint(x: nameX, y: nameY), anchor: .leading)
        var cursorX = nameX + width(of: nameT)
        if row.isYou {
            let youT = resolved(ctx, " · YOU", 24, .black, Color(hex: 0xD97706))
            ctx.draw(youT, at: CGPoint(x: cursorX, y: nameY + 1), anchor: .leading)
            cursorX += width(of: youT)
        }

        // Rank-delta pill ("▲3 vs yesterday" green / "▼2 vs yesterday" red) —
        // under the name when the "#R of TOTAL" line isn't there, sharing the
        // second line with it otherwise.
        if row.isYou, opts.delta != nil || opts.rankLine != nil {
            let lineY = midY + 17
            var lx = nameX
            if let rankLine = opts.rankLine {
                let t = resolved(ctx, rankLine, 21, .heavy, Color(hex: 0xB45309))
                ctx.draw(t, at: CGPoint(x: lx, y: lineY), anchor: .leading)
                lx += width(of: t) + 12
            }
            if let delta = opts.delta {
                let fg = delta.improved ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626)
                let bg = delta.improved ? Color(hex: 0xDCFCE7) : Color(hex: 0xFEE2E2)
                let t = resolved(ctx, delta.text, 18, .heavy, fg)
                let pillW = width(of: t) + 20
                let pillH: CGFloat = 28
                // No rank line → pill rides the name line instead.
                let pillY = opts.rankLine != nil ? lineY - pillH / 2 : nameY - pillH / 2
                let pillX = opts.rankLine != nil ? lx : cursorX + 12
                let pill = Path(roundedRect: CGRect(x: pillX, y: pillY, width: pillW, height: pillH),
                                cornerRadius: 14)
                ctx.fill(pill, with: .color(bg))
                ctx.draw(t, at: CGPoint(x: pillX + 10, y: pillY + pillH / 2 + 1), anchor: .leading)
            }
        }

        if opts.separator, !row.isYou {
            var sep = Path()
            sep.move(to: CGPoint(x: x + 26, y: y + h))
            sep.addLine(to: CGPoint(x: x + w - 26, y: y + h))
            ctx.stroke(sep, with: .color(Color(hex: 0xE5E7EB)), lineWidth: 1.5)
        }
    }

    // ── The card. ────────────────────────────────────────────────────────

    private func draw(_ ctx: GraphicsContext) {
        let cw = size.width, ch = size.height

        // Variant-tinted background (lavender / mint).
        ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(theme.bg))

        // Wordmark — the established two-tone (violet→pink) treatment.
        let wordmarkY: CGFloat = 96
        var wm = ctx.resolve(Text("WORDOCIOUS").font(Brand.fixedFont(60, .black)))
        wm.shading = .linearGradient(
            Gradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)]),
            startPoint: CGPoint(x: cw / 2 - 220, y: wordmarkY - 52),
            endPoint: CGPoint(x: cw / 2 + 220, y: wordmarkY + 8))
        drawAtBaseline(ctx, wm, x: cw / 2, baseline: wordmarkY, fontSize: 60)

        // Letterspaced variant label.
        let labelY = wordmarkY + 74
        let label = resolved(ctx, labelText, 36, .black, theme.label, tracking: 10)
        drawAtBaseline(ctx, label, x: cw / 2, baseline: labelY, fontSize: 36)

        // Chips: mode (accent bg; swords glyph on the VS variant) + date chip.
        let chipH: CGFloat = 56
        let chipY = labelY + 36
        let swordsSize: CGFloat = input.variant == .vs ? 30 : 0
        let swordsGap: CGFloat = input.variant == .vs ? 10 : 0
        let modeText = resolved(ctx, input.modeChip, 27, .heavy, .white)
        let modeChipW = width(of: modeText) + swordsSize + swordsGap + 48
        let dateText = resolved(ctx, input.dateChip, 27, .heavy, textMuted)
        let dateChipW = width(of: dateText) + 44
        let chipGap: CGFloat = 16
        var chipX = (cw - modeChipW - chipGap - dateChipW) / 2

        let modeRect = CGRect(x: chipX, y: chipY, width: modeChipW, height: chipH)
        ctx.fill(Path(roundedRect: modeRect, cornerRadius: chipH / 2), with: .color(input.modeAccent))
        var modeTextX = chipX + 24
        if input.variant == .vs, let swords = tintedImage(ctx, asset: "swords", color: .white) {
            ctx.draw(swords, in: CGRect(x: modeTextX, y: chipY + chipH / 2 - swordsSize / 2,
                                        width: swordsSize, height: swordsSize))
            modeTextX += swordsSize + swordsGap
        }
        ctx.draw(modeText, at: CGPoint(x: modeTextX, y: chipY + chipH / 2 + 1), anchor: .leading)

        chipX += modeChipW + chipGap
        let dateRect = CGRect(x: chipX, y: chipY, width: dateChipW, height: chipH)
        let datePath = Path(roundedRect: dateRect, cornerRadius: chipH / 2)
        ctx.fill(datePath, with: .color(.white))
        ctx.stroke(datePath, with: .color(Color(hex: 0xE5E7EB)), lineWidth: 2)
        ctx.draw(dateText, at: CGPoint(x: chipX + 22, y: chipY + chipH / 2 + 1), anchor: .leading)

        // Rows panel — sized to its content, centered between chips and footer,
        // so short boards don't strand dead padding (web founder note, Aug 7).
        let panelX: CGFloat = 64
        let panelW = cw - panelX * 2
        let areaTop = chipY + chipH + 40
        let footerY = ch - 52
        let areaBottom = footerY - 46
        let pad: CGFloat = 16
        let dividerH: CGFloat = input.you != nil ? 46 : 0
        let nRows = CGFloat(input.rows.count + (input.you != nil ? 1 : 0))
        guard nRows > 0 else { return }
        // Max row height — roomier for the 3-row podium than a 6-slot board.
        // Podium carries the same top 5 (+ you-row) as the daily card now.
        let band: CGFloat = 130
        let rowH = min(band, (areaBottom - areaTop - pad * 2 - dividerH) / nRows)
        let contentH = rowH * nRows + dividerH + pad * 2
        let panelTop = areaTop + (areaBottom - areaTop - contentH) / 2
        let panel = Path(roundedRect: CGRect(x: panelX, y: panelTop, width: panelW, height: contentH),
                         cornerRadius: 28)
        ctx.fill(panel, with: .color(.white))
        ctx.stroke(panel, with: .color(theme.panelBorder), lineWidth: 3)
        var y = panelTop + pad

        for (i, row) in input.rows.enumerated() {
            drawRow(ctx, row, x: panelX, y: y, w: panelW, h: rowH, opts: RowOpts(
                delta: row.isYou ? input.delta : nil,
                separator: i < input.rows.count - 1 || input.you != nil,
                edgeTop: i == 0,
                edgeBottom: i == input.rows.count - 1 && input.you == nil,
                bleed: pad))
            y += rowH
        }

        if let you = input.you {
            // "• • •" divider between the compressed top rows and the sharer's.
            let dots = resolved(ctx, "• • •", 26, .black, textMuted)
            ctx.draw(dots, at: CGPoint(x: cw / 2, y: y + dividerH / 2 + 1), anchor: .center)
            y += dividerH
            drawRow(ctx, you, x: panelX, y: y, w: panelW, h: rowH, opts: RowOpts(
                rankLine: input.youRankLine,
                delta: input.delta,
                edgeBottom: true,
                bleed: pad))
        }

        // Footer hook.
        let footer = resolved(ctx, input.footer, 29, .heavy, theme.footer)
        drawAtBaseline(ctx, footer, x: cw / 2, baseline: footerY + 30, fontSize: 29)
    }
}
#endif

// MARK: - Share flow (web leaderboard-share-flow.ts + shareResult linkOnly)

extension ShareService {
    /// Render the leaderboard card, upload it, and share the /s/ URL ALONE —
    /// the /s/ unfurl IS the card, so attaching image+link would render the
    /// card twice in the Messages compose sheet. The rendered image attaches
    /// only as the fallback when the upload (or URL build) fails.
    @MainActor
    static func shareLeaderboard(_ input: LbShareInput) {
        #if canImport(UIKit)
        let card = LeaderboardShareCardView(input: input)
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        guard let image = renderer.uiImage, let png = image.pngData() else { return }

        Task {
            let url = await uploadLeaderboardURL(png: png, input: input)
            await MainActor.run {
                if let url {
                    ShareEvents.log(kind: "other", gameMode: input.gameModeRaw, surface: "leaderboard")
                    present(items: [url])
                } else {
                    // Upload failed → image-attach fallback (web parity).
                    ShareEvents.log(kind: "image", gameMode: input.gameModeRaw, surface: "leaderboard")
                    present(items: [image])
                }
            }
        }
        #endif
    }

    /// Upload to share-images/<uid>/<Kind>-<Mode>-<date>.png and build the
    /// /s/ URL with m/lm/r/tp/w/h/v — identical to web uploadAndBuildShareUrl's
    /// leaderboard branch.
    private static func uploadLeaderboardURL(png: Data, input: LbShareInput) async -> URL? {
        let client = AuthService.shared.client
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased() else { return nil }

        let key = "\(uid)/\(input.variant.kind)-\(input.shareMode)-\(input.day)"
        do {
            try await client.storage.from("share-images").upload(
                "\(key).png", data: png,
                options: FileOptions(contentType: "image/png", upsert: true))
        } catch { return nil }

        var q: [String: String] = [
            "m": input.variant.kind, "lm": input.shareMode,
            "w": "1080", "h": "1080",
            // Unlike a puzzle result, a board changes all day — a minute-granular
            // buster makes a later re-share re-scrape the fresh standings.
            "v": "lb\(input.shareRank ?? 0)-\(Int(Date().timeIntervalSince1970 / 60))",
        ]
        if let r = input.shareRank { q["r"] = "\(r)" }
        if let tp = input.sharePlayers { q["tp"] = "\(tp)" }

        var comps = URLComponents(string: "https://wordocious.com/s/\(key)")
        comps?.queryItems = q.map { URLQueryItem(name: $0.key, value: $0.value) }
        return comps?.url
    }
}

/// Fetch-and-share glue for the leaderboard Share buttons (daily tab + Records
/// daily view). Pure card assembly lives in LeaderboardShareBuilder; this adds
/// the two cheap lookups the card needs beyond the page's own state — the
/// sharer's row when they rank below the visible list, and yesterday's final
/// rank for the "▲N vs yesterday" delta pill (web leaderboard-share-flow.ts).
enum LeaderboardShareFlow {
    /// Share today's board (solo or VS per the page's toggle). `entries` /
    /// `rankWindow` / `userRank` are the page's already-fetched state.
    @MainActor
    static func shareDaily(mode: GameMode, playType: String,
                           entries: [LeaderboardEntry],
                           rankWindow: (startRank: Int, entries: [LeaderboardEntry])?,
                           userId: String?,
                           userRank: (rank: Int, total: Int)?,
                           friends: Bool = false) async {
        guard let meta = ModeGen.byDbKey(mode.rawValue), !entries.isEmpty else { return }
        // FRIENDS (§207): friends identity + dense friend ranks; the page's
        // `entries` already IS the whole friends board.
        let variant: LbShareVariant = friends ? .friends : (playType == "vs" ? .vs : .solo)
        let ranked = entries.enumerated().map {
            LeaderboardShareBuilder.RankedEntry(rank: $0.offset + 1, entry: $0.element)
        }

        let inTop5 = userId != nil && entries.prefix(5).contains { $0.userId == userId }

        // Sharer's row when they rank below the top 5 — from the page's rank
        // window if it holds it, else a small window read around their offset
        // (ties can shift the exact offset — the window absorbs that). Not
        // found → the card simply omits the you-row.
        var userEntry = userId.flatMap { uid in
            entries.first { $0.userId == uid } ?? rankWindow?.entries.first { $0.userId == uid }
        }
        if let uid = userId, let rank = userRank, !inTop5, userEntry == nil, !friends {
            // Global board only — a friends board is entirely in `entries`.
            let offset = max(0, rank.rank - 6)
            let windowRows = (try? await LeaderboardService.fetch(
                gameMode: mode, playType: playType, limit: 11, offset: offset)) ?? []
            userEntry = windowRows.first { $0.userId == uid }
        }

        // Yesterday's final rank for the delta pill — only meaningful when the
        // sharer is on today's board at all; nil = didn't play yesterday.
        // Friends mode compares friend-rank to friend-rank (dense index into
        // yesterday's friends-filtered board).
        var yesterdayRank: Int? = nil
        if let uid = userId, userRank != nil {
            if friends {
                let ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
                let yRows = (try? await LeaderboardService.fetch(
                    gameMode: mode, day: LeaderboardService.yesterdayLocal(),
                    playType: playType, userIds: ids)) ?? []
                yesterdayRank = yRows.firstIndex { $0.userId == uid }.map { $0 + 1 }
            } else {
                yesterdayRank = await LeaderboardService.userRank(
                    gameMode: mode, userId: uid, playType: playType,
                    day: LeaderboardService.yesterdayLocal())?.rank
            }
        }

        guard let input = LeaderboardShareBuilder.buildDailyInput(
            variant: variant, shareMode: meta.title, modeLabel: meta.shareLabel,
            gameModeRaw: mode.rawValue,
            modeAccent: variant == .vs ? Color(hex: 0x0D9488) : meta.accent,
            day: LeaderboardService.todayLocal(),
            ranked: ranked, userId: userId,
            userRank: userRank, userEntry: userEntry,
            yesterdayRank: yesterdayRank) else { return }
        ShareService.shareLeaderboard(input)
    }

    /// Share yesterday's settled podium (top 5 + sharer's final rank,
    /// "· Final" chip — daily-card parity, founder ask 2026-08-10).
    @MainActor
    static func sharePodium(mode: GameMode, playType: String,
                            top3: [LeaderboardEntry], userId: String?,
                            friends: Bool = false) async {
        guard let meta = ModeGen.byDbKey(mode.rawValue) else { return }
        let variant: LbShareVariant = playType == "vs" ? .vs : .solo
        let day = LeaderboardService.yesterdayLocal()
        let ranked = top3.enumerated().map {
            LeaderboardShareBuilder.RankedEntry(rank: $0.offset + 1, entry: $0.element)
        }
        // Sharer's FINAL rank yesterday + their own row for the below-top-5
        // treatment. Friends mode dense-ranks the friends-filtered board.
        var userRank: (rank: Int, total: Int)? = nil
        var userEntry: LeaderboardEntry? = userId.flatMap { uid in top3.first { $0.userId == uid } }
        if let uid = userId {
            if friends {
                let ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
                if let board = try? await LeaderboardService.fetch(
                    gameMode: mode, day: day, playType: playType, userIds: ids),
                   let idx = board.firstIndex(where: { $0.userId == uid }) {
                    userRank = (rank: idx + 1, total: board.count)
                    if userEntry == nil { userEntry = board[idx] }
                }
            } else {
                userRank = await LeaderboardService.userRank(
                    gameMode: mode, userId: uid, playType: playType, day: day,
                    topEntries: top3, topLimit: 5)
                if userRank != nil, userEntry == nil {
                    userEntry = (try? await LeaderboardService.fetch(
                        gameMode: mode, day: day, playType: playType, limit: 1, userIds: [uid]))?.first
                }
            }
        }
        guard let input = LeaderboardShareBuilder.buildPodiumInput(
            playType: variant, friends: friends,
            shareMode: meta.title, modeLabel: meta.shareLabel,
            gameModeRaw: mode.rawValue,
            // Web parity: the podium chip keeps the catalog accent even for a
            // VS podium — teal + swords belong to the live VS variant only.
            modeAccent: meta.accent,
            day: day,
            ranked: ranked, userId: userId,
            userRank: userRank, userEntry: userEntry) else { return }
        ShareService.shareLeaderboard(input)
    }

    /// SWEEP (§231): share today's Sweep board or yesterday's sweep podium.
    /// Everything the card needs is already on the page (entries carry RPC
    /// ranks; the sweep rank banner's tuple is the sharer's rank), so unlike
    /// the per-mode flows there are no extra lookups.
    @MainActor
    static func shareSweep(podium: Bool, entries: [SweepEntry],
                           userId: String?, userRank: (rank: Int, total: Int)? = nil) {
        guard let input = LeaderboardShareBuilder.buildSweepInput(
            podium: podium,
            day: podium ? LeaderboardService.yesterdayLocal() : LeaderboardService.todayLocal(),
            entries: entries, userId: userId, userRank: userRank) else { return }
        ShareService.shareLeaderboard(input)
    }
}
