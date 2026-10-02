import SwiftUI
import WordociousCore

/// The Stats tab's landing page — "your day in one card" (Stats + Friends
/// redesign D2, founder 2026-09-26): the eight sweep tiles with today's W/L,
/// then Puzzles N of 10, VS W/L, today's field standing (the ONE formula
/// the standing strip used), the sweep streaks and a "best moment" line. Free
/// tier throughout — today's facts. Sweep/Flawless days keep the banner
/// treatment the old Today's Dailies card had (the §244 footer included).
/// Twin of web components/stats/today-card.tsx.
struct TodayCard: View {
    let sweepModes: [HomeMode]
    /// The Puzzles dailies this viewer can see (catalog ∩ flags).
    let visibleMore: [HomeMode]
    let byMode: [String: DailyCompletion]
    let vsDailyWon: Bool?
    let standing: StatsDeepService.DailyStanding?
    let sweepStreak: Int
    let flawlessStreak: Int
    /// The Puzzles row's runs (founder, 2026-10-01 stats audit; the home banner shows them too).
    var puzzleStreaks = GroupStreaks(sweep: 0, flawless: 0)
    /// Rail jump: a dbKey, StatsRailKey.today, or StatsRailKey.vs (All-time's VS section since 2026-10-01).
    let onJump: (String) -> Void
    /// Tap on a sweep tile — play (or reopen) that daily, exactly as the tile did.
    let onOpenDaily: (HomeMode) -> Void

    private let lossRed = Color(hex: 0xDC2626)

    /// The single best thing that happened today: a perfect game first, else
    /// the fastest win. Pure over today's completions — no fetch. Walks the
    /// catalog order so two equal candidates resolve the same way every render.
    static func bestMomentToday(_ byMode: [String: DailyCompletion]) -> (text: String, key: String)? {
        var perfect: (key: String, title: String, n: Int, noun: String, semantics: String)?
        var fastest: (key: String, title: String, secs: Int)?
        for m in (homeModes + moreModes) {
            guard let key = m.dbKey, let r = byMode[key], r.completed, let meta = ModeGen.byDbKey(key) else { continue }
            if r.guessCount <= meta.guessBase && perfect == nil {
                let noun = WordociousCore.ModeStats.guessNoun(meta.guessSemantics)
                perfect = (key, meta.title, r.guessCount, r.guessCount == 1 ? noun.one : noun.many, meta.guessSemantics)
            }
            let secs = Int(r.timeSeconds)
            if secs > 0 && (fastest == nil || secs < fastest!.secs) { fastest = (key, meta.title, secs) }
        }
        if let p = perfect {
            let detail = p.semantics == "guesses" ? " in \(p.n) \(p.noun)" : ""
            return ("Perfect \(p.title)\(detail)", p.key)
        }
        if let f = fastest { return ("Fastest win: \(f.title) in \(Self.clock(f.secs))", f.key) }
        return nil
    }

    private static func clock(_ s: Int) -> String {
        s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s"
    }

    var body: some View {
        let played = sweepModes.filter { $0.dbKey.map { byMode[$0] != nil } ?? false }
        let completed = played.count
        let wins = played.filter { byMode[$0.dbKey!]?.completed == true }.count
        let total = sweepModes.count
        let allDone = total > 0 && completed >= total
        let flawless = allDone && wins == total
        let moreDaily = visibleMore.filter { $0.dailyEligible && $0.dbKey != nil }
        let morePlayed = moreDaily.filter { byMode[$0.dbKey!] != nil }.count
        let moment = Self.bestMomentToday(byMode)

        VStack(spacing: 12) {
            VStack(spacing: 8) {
                // Header: the date + N/8, or the Sweep / Flawless banner on a full day.
                if allDone {
                    HStack(spacing: 8) {
                        SymbolGlyph(flawless ? "trophy.fill" : "sparkles", size: flawless ? 18 : 15, color: flawless ? Color(hex: 0xB45309) : Color(hex: 0x7C3AED))
                        Text(flawless ? "FLAWLESS VICTORY!" : "DAILY SWEEP!")
                            .font(Brand.font(16, .black))
                            .foregroundStyle(LinearGradient(colors: flawless ? [Color(hex: 0xD97706), Color(hex: 0xB45309)] : [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        SymbolGlyph(flawless ? "trophy.fill" : "sparkles", size: flawless ? 18 : 15, color: flawless ? Color(hex: 0xB45309) : Color(hex: 0xEC4899))
                    }
                } else {
                    HStack {
                        Text("TODAY · \(dateLabel)").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                        Spacer()
                        Text("\(completed)/\(total)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }

                // The eight sweep tiles, ONE row — tap plays (or reopens) that daily.
                HStack(spacing: 4) {
                    ForEach(sweepModes) { m in sweepTile(m) }
                }

                if allDone {
                    if flawless {
                        // §244: streak-aware footer + the brag-card share button.
                        FlawlessBannerFooter(total: total)
                    } else {
                        Text("All \(total) dailies completed · +200 XP earned")
                            .font(Brand.font(11, .heavy)).foregroundStyle(Color(hex: 0x6D28D9))
                    }
                }

                // The rest of the day: Puzzles, VS, where you stand.
                HStack(spacing: 8) {
                    pill(label: "Puzzles", value: moreDaily.isEmpty ? "—" : "\(morePlayed) of \(moreDaily.count)",
                         color: Color(hex: 0x4F46E5), icon: .game("more", .symbol("square.grid.2x2"))) {
                        onJump(moreDaily.first?.dbKey ?? StatsRailKey.today)
                    }
                    pill(label: "VS Battle", value: vsDailyWon == nil ? "—" : (vsDailyWon! ? "W" : "L"),
                         color: Color(hex: 0xEC4899), icon: .game("vs", .asset("swords")), won: vsDailyWon) { onJump(StatsRailKey.vs) }
                    pill(label: "Standing", value: standing.map { "Top \($0.topPercent)%" } ?? "—",
                         color: Color(hex: 0x7C3AED), icon: .symbol("chart.line.uptrend.xyaxis"), action: nil)
                }
                .padding(.top, 4)

                // The ten Puzzles as tiny chips, so the day reads at a glance.
                if !moreDaily.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(moreDaily) { m in miniChip(m) }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(12).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(allDone
                ? AnyShapeStyle(LinearGradient(colors: flawless ? [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)] : [Color(hex: 0xF5F3FF), Color(hex: 0xFCE7F3)], startPoint: .topLeading, endPoint: .bottomTrailing))
                : AnyShapeStyle(Theme.surface)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(allDone ? (flawless ? Color(hex: 0xF59E0B) : Color(hex: 0xC4B5FD)) : Theme.border, lineWidth: 1.5))

            // Streaks + the best thing that happened today.
            HStack(spacing: 8) {
                infoCard(icon: "flame.fill", iconColor: Color(hex: 0xF97316), label: "Sweep streaks") {
                    // Wordocious, then Puzzles: the same two runs the home banner shows.
                    VStack(alignment: .leading, spacing: 1) {
                        streakLine("Wordocious", run: sweepStreak, flawless: flawlessStreak)
                        streakLine("Puzzles", run: puzzleStreaks.sweep, flawless: puzzleStreaks.flawless)
                    }
                }
                Button { if let k = moment?.key { onJump(k) } } label: {
                    infoCard(icon: moment?.text.hasPrefix("Perfect") == true ? "star.fill" : "timer",
                             iconColor: moment?.text.hasPrefix("Perfect") == true ? Theme.win : Color(hex: 0x2563EB),
                             label: "Best moment") {
                        Text(moment?.text ?? "Play a daily to start your day")
                            .font(Brand.font(11, .black)).foregroundStyle(Theme.textPrimary)
                            .lineLimit(1).minimumScaleFactor(0.75)
                    }
                }
                .buttonStyle(.squish)
            }
            // The streak card holds two lines now: both cards take the taller height.
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// "WORDOCIOUS 4 days · 3 flawless" — the flawless run shows from 2 days, as before.
    private func streakLine(_ label: String, run: Int, flawless: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(label.uppercased()).font(Brand.font(8, .black)).foregroundStyle(Theme.textMuted)
            Text("\(run) \(run == 1 ? "day" : "days")").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
            if flawless >= 2 {
                Text("· \(flawless) flawless").font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0xB45309))
            }
        }
        .lineLimit(1).minimumScaleFactor(0.6)
    }

    private var dateLabel: String {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d"; f.locale = Locale(identifier: "en_US")
        return f.string(from: Date())
    }

    /// One sweep tile — the old Today's Dailies badge: W/L filled when played,
    /// the mode icon when not, 8pt label under it.
    private func sweepTile(_ m: HomeMode) -> some View {
        let result = m.dbKey.flatMap { byMode[$0] }
        let played = result != nil
        let won = result?.completed == true
        let bg: Color = !played ? Theme.background : won ? Theme.win : lossRed
        let border: Color = !played ? Theme.border : won ? Theme.win : lossRed
        return Button { onOpenDaily(m) } label: {
            VStack(spacing: 3) {
                ZStack {
                    if played {
                        // ART_SPEC §4: the 3D W / L badge is the result tile.
                        ResultBadge(won: won, size: 38)
                    } else {
                        RoundedRectangle(cornerRadius: 12).fill(bg).frame(width: 36, height: 36)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(border, lineWidth: 1.5))
                        ModeIconView(icon: m.icon, accent: m.accent, box: 26)
                    }
                }
                .frame(width: 38, height: 38)
                .opacity(played ? 1 : 0.7)
                Text(ModeGen.byId(m.id)?.shortTitle ?? m.title).font(Brand.font(8, .bold))
                    .foregroundStyle(played ? Theme.textPrimary : Theme.textMuted)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.squish)
    }

    /// A 20pt Puzzles chip: solid accent + white glyph when won, red when
    /// lost, a faint tint when unplayed. Tap → that game's page.
    private func miniChip(_ m: HomeMode) -> some View {
        let r = m.dbKey.flatMap { byMode[$0] }
        let done = r != nil
        let bg: Color = !done ? m.accent.opacity(0.13) : (r!.completed ? m.accent : lossRed)
        let fg: Color = done ? .white : m.accent
        return Button { if let k = m.dbKey { onJump(k) } } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 5).fill(bg).frame(width: 20, height: 20)
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(done ? Color.clear : m.accent.opacity(0.33), lineWidth: 1))
                if m.icon.gameArt != nil {
                    // ART_SPEC §3: the 3D game icon (on a white disc over a solid result fill).
                    BannerGlyph(icon: m.icon, ink: fg, accent: m.accent, solid: done, size: 13)
                } else {
                    glyph(m.icon, color: fg, fallback: ModeGen.byId(m.id)?.glyph ?? String(m.title.prefix(1)))
                }
            }
        }
        .buttonStyle(.squish)
        .accessibilityLabel(m.title)
    }

    @ViewBuilder
    private func glyph(_ icon: ModeIconKind, color: Color, fallback: String) -> some View {
        if let art = icon.gameArt {
            GameArtImage(asset: art, size: 14)
        } else {
            plainGlyph(icon.glyph, color: color, fallback: fallback)
        }
    }

    @ViewBuilder
    private func plainGlyph(_ icon: ModeIconKind, color: Color, fallback: String) -> some View {
        switch icon {
        case .symbol(let name):
            Image(systemName: name).font(.system(size: 10, weight: .bold)).foregroundStyle(color)
        case .asset(let name):
            Image(name).renderingMode(.template).resizable().scaledToFit().frame(width: 11, height: 11).foregroundStyle(color)
        default:
            Text(fallback).font(Brand.font(9, .black)).foregroundStyle(color)
        }
    }

    private func pill(label: String, value: String, color: Color, icon: ModeIconKind, won: Bool? = nil, action: (() -> Void)?) -> some View {
        Button { action?() } label: {
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    glyph(icon, color: color, fallback: "")
                    Text(label.uppercased()).font(Brand.font(9, .black)).tracking(0.6)
                }
                .foregroundStyle(color)
                .lineLimit(1).minimumScaleFactor(0.7)
                if let won {
                    // ART_SPEC §4: a known daily result reads as the 3D W / L badge.
                    ResultBadge(won: won, size: 20)
                } else {
                    Text(value).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .frame(maxWidth: .infinity).padding(.vertical, 8).padding(.horizontal, 4)
            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        }
        // The Standing pill has no destination: keep it flat (no press scale).
        .buttonStyle(PressableStyle(scale: action == nil ? 1 : 0.96))
        .allowsHitTesting(action != nil)
    }

    private func infoCard<V: View>(icon: String, iconColor: Color, label: String, @ViewBuilder value: () -> V) -> some View {
        HStack(spacing: 8) {
            SymbolGlyph(icon, size: 14, color: iconColor)
            VStack(alignment: .leading, spacing: 1) {
                Text(label.uppercased()).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
                value()
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface).pageCardShadow())
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }
}
