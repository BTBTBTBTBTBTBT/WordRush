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

    /// The Today card's soft blue (FINISH_SPEC §C3: tint ~#eaf2ff, bar #0a6cff → #60a5fa).
    private static let blue = Color(hex: 0x0A6CFF)
    private static let blueInk = Color(hex: 0x2456A8)

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
        // A full day keeps its banner treatment: gold card on Flawless, purple on a Sweep.
        let cardAccent: Color = !allDone ? Self.blue : (flawless ? Color(hex: 0xF5A524) : Color(hex: 0x7C3AED))
        let cardBar: [Color] = !allDone ? [Self.blue, Color(hex: 0x60A5FA)]
            : (flawless ? [Color(hex: 0xF5A524), Color(hex: 0xFFD166)] : [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)])

        VStack(spacing: 12) {
            VStack(spacing: 10) {
                // Header: the date + N / 8, or the Sweep / Flawless banner on a full day.
                if allDone {
                    HStack(spacing: 8) {
                        SymbolGlyph(flawless ? "trophy.fill" : "sparkles", size: flawless ? 18 : 15, color: flawless ? Color(hex: 0xB45309) : Color(hex: 0x7C3AED))
                        Text(flawless ? "FLAWLESS VICTORY!" : "DAILY SWEEP!")
                            .font(Brand.font(16, .black))
                            .foregroundStyle(Theme.isDark ? Theme.textPrimary : (flawless ? Color(hex: 0xA2560C) : Color(hex: 0x6D28D9)))
                        SymbolGlyph(flawless ? "trophy.fill" : "sparkles", size: flawless ? 18 : 15, color: flawless ? Color(hex: 0xB45309) : Color(hex: 0xEC4899))
                    }
                } else {
                    HStack {
                        FinishLabel("Today · \(dateLabel)", color: Self.blueInk)
                        Spacer()
                        Text("\(completed) / \(total)")
                            .softNumber(15, color: Theme.isDark ? nil : Self.blueInk)
                            .accessibilityLabel("\(completed) of \(total) dailies played")
                    }
                }

                // The eight sweep tiles as mini game cards with today's W / L — tap plays
                // (or reopens) that daily.
                PickerTileRow(gap: 5, maxSide: 44) {
                    ForEach(sweepModes) { m in sweepTile(m) }
                }

                if allDone {
                    if flawless {
                        // §244: streak-aware footer + the brag-card share button.
                        FlawlessBannerFooter(total: total)
                    } else {
                        Text("All \(total) dailies completed · +200 XP earned")
                            .font(Brand.font(11, .heavy)).foregroundStyle(Theme.isDark ? Theme.textSecondary : Color(hex: 0x6D28D9))
                    }
                }

                // The rest of the day: Puzzles (magenta), VS (teal), where you stand (gold).
                HStack(spacing: 6) {
                    pill(label: "Puzzles", value: moreDaily.isEmpty ? "—" : "\(morePlayed) of \(moreDaily.count)",
                         color: Color(hex: 0xC026D3)) {
                        onJump(moreDaily.first?.dbKey ?? StatsRailKey.today)
                    }
                    pill(label: "VS Battle", value: vsDailyWon == nil ? "—" : (vsDailyWon! ? "W" : "L"),
                         color: Color(hex: 0x0D9488), won: vsDailyWon) { onJump(StatsRailKey.vs) }
                    pill(label: "Standing", value: standing.map { "Top \($0.topPercent)%" } ?? "—",
                         color: Color(hex: 0xF5A524), action: nil)
                }
                .padding(.top, 2)

                // The ten Puzzles as tiny chips, so the day reads at a glance.
                if !moreDaily.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(moreDaily) { m in miniChip(m) }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 14)
            .frame(maxWidth: .infinity)
            .tintedCard(accent: cardAccent, bar: cardBar, tint: 0.08, line: 0.22)

            // Streaks + the best thing that happened today: two tinted tiles with 3D icons.
            HStack(spacing: 10) {
                // Wordocious, then Puzzles: the same two runs the home banner shows.
                StatsTile(label: "Sweep streak", value: "\(sweepStreak)",
                          sub: streakLine(run: sweepStreak, flawless: flawlessStreak),
                          sub2: "Puzzles " + streakLine(run: puzzleStreaks.sweep, flawless: puzzleStreaks.flawless),
                          accent: StatsTileColor.gold.accent, ink: StatsTileColor.gold.ink) {
                    if ArtAsset.exists("game-sweep") { GameArtImage(asset: "game-sweep", size: 22) }
                    else { Icon3D(.flame, size: 22) }
                }
                let parts = Self.momentParts(moment?.text)
                Button { if let k = moment?.key { onJump(k) } } label: {
                    StatsTile(label: "Best moment", value: parts.value, sub: parts.sub,
                              accent: StatsTileColor.pink.accent, ink: StatsTileColor.pink.ink) {
                        Icon3D(moment?.text.hasPrefix("Perfect") == true ? .badgeCheck : .trophy, size: 22)
                    }
                }
                .buttonStyle(.squish)
            }
            // Both tiles take the taller height.
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Splits the best-moment line into the tile's big value + its small line:
    /// "Perfect Classic in 3 guesses" → ("Perfect", "Classic in 3 guesses");
    /// "Fastest win: Classic in 1:12" → ("1:12", "Fastest win · Classic").
    static func momentParts(_ text: String?) -> (value: String, sub: String) {
        guard let text else { return ("—", "Play a daily to start your day") }
        if text.hasPrefix("Perfect ") { return ("Perfect", String(text.dropFirst("Perfect ".count))) }
        if text.hasPrefix("Fastest win: "), let r = text.range(of: " in ", options: .backwards) {
            let title = text[text.index(text.startIndex, offsetBy: "Fastest win: ".count)..<r.lowerBound]
            return (String(text[r.upperBound...]), "Fastest win · \(title)")
        }
        return (text, "")
    }

    /// "4 days · 3 flawless" — the flawless run shows from 2 days, as before.
    private func streakLine(run: Int, flawless: Int) -> String {
        "\(run) \(run == 1 ? "day" : "days")" + (flawless >= 2 ? " · \(flawless) flawless" : "")
    }

    private var dateLabel: String {
        let f = DateFormatter(); f.dateFormat = "MMM d"; f.locale = Locale(identifier: "en_US")
        return f.string(from: Date())
    }

    /// One sweep tile — a mini game card (§A1 picker tile) tinted by its game, with
    /// today's W / L badge in the corner once played.
    private func sweepTile(_ m: HomeMode) -> some View {
        let result = m.dbKey.flatMap { byMode[$0] }
        return Button { onOpenDaily(m) } label: {
            PickerTile(accent: m.accent, result: result.map { $0.completed }) { side in
                if let art = m.icon.gameArt {
                    GameArtImage(asset: art, size: side * 0.72)
                } else {
                    ModeIconView(icon: m.icon, accent: m.accent, box: side * 0.6)
                }
            }
        }
        .buttonStyle(.squish)
        .accessibilityLabel(ModeGen.byId(m.id)?.shortTitle ?? m.title)
        .accessibilityValue(result.map { $0.completed ? "Won today" : "Lost today" } ?? "Not played yet")
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

    /// One of the three day pills (mockup `.pill`): a tinted pill in its color with
    /// a soft number (or today's 3D W / L badge) over a small caps label.
    @ViewBuilder
    private func pill(label: String, value: String, color: Color, won: Bool? = nil, action: (() -> Void)?) -> some View {
        let tile = VStack(spacing: 3) {
            if let won {
                Text(won ? "W" : "L").softNumber(18)
            } else {
                Text(value).softNumber(18).lineLimit(1).minimumScaleFactor(0.6)
            }
            Text(label.uppercased()).font(Brand.font(9, .black)).tracking(0.7)
                .foregroundStyle(Theme.isDark ? Theme.textSecondary : color.mixed(over: .black, 0.72))
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity).padding(.top, 9).padding(.bottom, 7).padding(.horizontal, 4)
        .tintedPill(color, radius: 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(won.map { $0 ? "won" : "lost" } ?? value)")
        if let action {
            Button { action() } label: { tile }.buttonStyle(.squish)
        } else {
            // The Standing pill has no destination: a plain tile, no press.
            tile
        }
    }
}
