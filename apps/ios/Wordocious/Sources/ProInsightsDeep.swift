import SwiftUI
import WordociousCore

/// Pro Insights deep layer (restat R4) — ports components/profile/
/// pro-insights-deep.tsx: Skill Radar, Rivalries, and the per-mode deep card
/// (opener yield, position accuracy, gauntlet stage breakdown, hint honesty,
/// Word Almanac). Every card self-fetches; free users see static sample
/// content blurred behind the Pro pill.

// MARK: - Skill Radar

/// Five-axis pentagon — drawn with SwiftUI Path; labels are laid out with
/// edge-aware alignment plus horizontal card padding so they never clip.
private struct RadarShape: Shape {
    let values: [Double]   // 0–1 per axis, 5 axes
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY)
        for (i, v) in values.enumerated() {
            let a = -Double.pi / 2 + Double(i) * 2 * .pi / Double(values.count)
            let r = radius * max(0.04, v)
            let pt = CGPoint(x: c.x + r * CGFloat(cos(a)), y: c.y + r * CGFloat(sin(a)))
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }
}

private struct RadarRing: Shape {
    let fraction: CGFloat
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY)
        for i in 0..<5 {
            let a = -Double.pi / 2 + Double(i) * 2 * .pi / 5
            let pt = CGPoint(x: c.x + radius * fraction * CGFloat(cos(a)), y: c.y + radius * fraction * CGFloat(sin(a)))
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }
}

private struct RadarSpokes: Shape {
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY)
        for i in 0..<5 {
            let a = -Double.pi / 2 + Double(i) * 2 * .pi / 5
            p.move(to: c)
            p.addLine(to: CGPoint(x: c.x + radius * CGFloat(cos(a)), y: c.y + radius * CGFloat(sin(a))))
        }
        return p
    }
}

private struct RadarChartView: View {
    let data: StatsDeepService.SkillRadarData
    private let radius: CGFloat = 84
    private let axes = ["Speed", "Accuracy", "Consistency", "Endurance", "Versatility"]
    // F4: the shape grows out from the center (0→1) on first appear.
    @State private var draw: CGFloat = 0

    private var values: [Int] {
        [data.speed, data.accuracy, data.consistency, data.endurance, data.versatility]
    }

    var body: some View {
        GeometryReader { geo in
            let c = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2 + 8)
            ZStack {
                // Rings + spokes + shape, centered slightly below middle (web cy = H/2 + 8).
                Group {
                    ForEach([0.33, 0.66, 1.0], id: \.self) { f in
                        RadarRing(fraction: f, radius: radius).stroke(Theme.border, lineWidth: 1)
                    }
                    RadarSpokes(radius: radius).stroke(Theme.border, lineWidth: 1)
                    RadarShape(values: values.map { Double($0) / 100 * Double(draw) }, radius: radius)
                        .fill(Theme.primary.opacity(0.2))
                    RadarShape(values: values.map { Double($0) / 100 * Double(draw) }, radius: radius)
                        .stroke(Theme.primary, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
                }
                .offset(y: 8)   // web cy = H/2 + 8

                // Edge-aware labels at R+16 (web: side labels anchor away from
                // the edge so "Versatility 97" / "Accuracy 88" never clip).
                ForEach(0..<5, id: \.self) { i in
                    let a = -Double.pi / 2 + Double(i) * 2 * .pi / 5
                    let x = c.x + (radius + 16) * CGFloat(cos(a))
                    let y = c.y + (radius + 16) * CGFloat(sin(a))
                    // Edge-aware anchoring: right-side labels grow rightward,
                    // left-side leftward, top label centered — via a fixed
                    // 110pt slot aligned toward the free side.
                    let slot: CGFloat = 110
                    let align: Alignment = x > c.x + 8 ? .leading : (x < c.x - 8 ? .trailing : .center)
                    let cx = align == .leading ? x + slot / 2 : (align == .trailing ? x - slot / 2 : x)
                    Text("\(axes[i]) \(values[i])")
                        .font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .frame(width: slot, alignment: align)
                        .position(x: cx, y: y)
                }
            }
        }
        .frame(height: 240)
        .onAppear {
            guard !Theme.reduceMotion else { draw = 1; return }
            withAnimation(.easeOut(duration: 0.6)) { draw = 1 }
        }
    }
}

/// Skill Radar section — the five-axis signature chart (Pro).
struct SkillRadarCard: View {
    let isPro: Bool
    @State private var data: StatsDeepService.SkillRadarData?

    /// Locked preview uses the web's static sample so free users see the shape.
    private static let sample = StatsDeepService.SkillRadarData(
        speed: 62, accuracy: 74, consistency: 55, endurance: 40, versatility: 68)

    var body: some View {
        Group {
            if let d = isPro ? data : Self.sample {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Skill Radar", accent: Theme.primary)
                    let card = KitCard {
                        VStack(spacing: 4) {
                            RadarLabeledChart(data: d)
                            Text("Speed · win rate · steadiness · Gauntlet clears · mode spread — all 0–100")
                                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                        }
                    }
                    if isPro { card } else {
                        ProLockOverlay(label: "Unlock Skill Radar with Pro") { card }
                    }
                }
            }
        }
        .task(id: isPro) { if isPro { data = await StatsDeepService.skillRadar() } }
    }
}

/// Wrapper that lays the radar out with generous horizontal padding so the
/// side labels ("Versatility 97", "Accuracy 88") stay inside the card.
private struct RadarLabeledChart: View {
    let data: StatsDeepService.SkillRadarData
    var body: some View {
        RadarChartView(data: data)
            .padding(.horizontal, 8)
    }
}

// MARK: - Rivalries (VS)

/// Most-faced opponents with head-to-head W–L + win-share bar (Pro).
struct RivalriesCard: View {
    let isPro: Bool
    @State private var rows: [StatsDeepService.Rivalry] = []

    private static let sample: [StatsDeepService.Rivalry] = [
        .init(opponentId: "1", username: "WordSmith", wins: 4, losses: 2, draws: 0, total: 6),
        .init(opponentId: "2", username: "LexiconLou", wins: 1, losses: 3, draws: 1, total: 5),
    ]

    var body: some View {
        let display = isPro ? rows : Self.sample
        Group {
            if !(isPro && display.isEmpty) {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Rivalries", accent: Color(hex: 0xEC4899))
                    let card = KitCard {
                        VStack(spacing: 6) {
                            ForEach(display) { r in rivalryRow(r) }
                        }
                    }
                    if isPro { card } else {
                        ProLockOverlay(label: "Unlock Rivalries with Pro") { card }
                    }
                }
                .asyncEntrance(rows.count)   // F3: fade+rise when the fetch lands
            }
        }
        .task(id: isPro) { if isPro { rows = await StatsDeepService.rivalries(limit: 5) } }
    }

    private func rivalryRow(_ r: StatsDeepService.Rivalry) -> some View {
        let pct = r.total > 0 ? Double(r.wins) / Double(r.total) : 0
        return VStack(spacing: 6) {
            HStack(spacing: 8) {
                Image("swords").renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 14, height: 14).foregroundStyle(Theme.primary)
                Text(r.username).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Spacer()
                Text("\(r.wins)–\(r.losses)\(r.draws > 0 ? "–\(r.draws)" : "")")
                    .font(Brand.font(12, .black))
                    .foregroundStyle(r.wins >= r.losses ? Theme.primary : Color(hex: 0xDC2626))
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(hex: 0xDC2626).opacity(0.2))
                    Capsule().fill(Theme.primary).frame(width: g.size.width * pct)
                }
            }
            .frame(height: 6)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
    }
}

// MARK: - Per-mode deep card

/// Deep Insights (restat R4): opener yield, position accuracy, stage
/// breakdown (Gauntlet), hint honesty, Word Almanac. Pro-gated with a static
/// sample preview for free users.
struct ProDeepModeCard: View {
    let gameMode: String
    let isPro: Bool
    let accent: Color
    /// Page-level Solo/VS/VS-CPU toggle (restat B1). No per-game rows exist for
    /// CPU practice — the card hides entirely on vs_cpu (the panel shows a
    /// "totals only" note instead), matching pro-insights-deep.tsx.
    var playType: String = "solo"

    private struct DeepData {
        var openers: [StatsDeepService.OpenerDeepStat] = []
        var positions: StatsDeepService.PositionAccuracy?
        var almanac: [StatsDeepService.AlmanacEntry] = []
        var hints: StatsDeepService.HintHonesty?
        var gauntlet: [StatsDeepService.GauntletStageStat] = []
        var hasAny: Bool {
            !openers.isEmpty || positions != nil || !almanac.isEmpty || hints != nil || !gauntlet.isEmpty
        }
    }

    @State private var data: DeepData?

    /// Locked preview uses static sample content so free users see the shape.
    private static let sample = DeepData(
        openers: [.init(word: "CRANE", count: 12, avgGreens: 1.2, avgYellows: 1.6, winRate: 75)],
        positions: .init(wordLength: 5, pct: [34, 22, 28, 31, 41], sampleGuesses: 120),
        almanac: [
            .init(word: "PIQUE", won: true, guesses: 4, time: 88, date: "sample-1"),
            .init(word: "KNOLL", won: false, guesses: 6, time: 240, date: "sample-2"),
        ],
        hints: nil, gauntlet: [])

    var body: some View {
        let d = isPro ? data : Self.sample
        Group {
            if let d, d.hasAny, playType != "vs_cpu" {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Deep Insights", accent: accent)
                    let inner = VStack(spacing: 12) {
                        if !d.openers.isEmpty { openerYield(d.openers) }
                        if let p = d.positions { positionAccuracy(p) }
                        if !d.gauntlet.isEmpty { stageBreakdown(d.gauntlet) }
                        if let h = d.hints { hintsCard(h) }
                        if !d.almanac.isEmpty { almanacCard(d.almanac) }
                    }
                    if isPro { inner } else {
                        ProLockOverlay(label: "Unlock Deep Insights with Pro") { inner }
                    }
                }
            }
        }
        .task(id: "\(gameMode)-\(isPro)-\(playType)") {
            guard isPro, playType != "vs_cpu" else { return }
            data = nil
            async let openers = StatsDeepService.openerDeep(gameMode: gameMode, limit: 4, playType: playType)
            async let positions = StatsDeepService.positionAccuracy(gameMode: gameMode, playType: playType)
            async let almanac = StatsDeepService.wordAlmanac(gameMode: gameMode, limit: 24, playType: playType)
            let hints = HINT_MODES.contains(gameMode) ? await StatsDeepService.hintHonesty(gameMode: gameMode, playType: playType) : nil
            let gauntlet = gameMode == "GAUNTLET" ? await StatsDeepService.gauntletStageStats(playType: playType) : []
            data = DeepData(openers: await openers, positions: await positions,
                            almanac: await almanac, hints: hints, gauntlet: gauntlet)
        }
    }

    // MARK: Sub-cards

    private func cardTitle(_ icon: String, _ title: String, color: Color? = nil) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 13)).foregroundStyle(color ?? accent)
            Text(title).font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
        }
    }

    private func caption(_ text: String) -> some View {
        Text(text).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            .frame(maxWidth: .infinity).multilineTextAlignment(.center)
    }

    private func openerYield(_ openers: [StatsDeepService.OpenerDeepStat]) -> some View {
        KitCard {
            VStack(alignment: .leading, spacing: 8) {
                cardTitle("lightbulb.fill", "Opener Yield")
                VStack(spacing: 6) {
                    ForEach(openers) { o in
                        HStack(spacing: 8) {
                            Text(o.word).font(Brand.font(14, .black)).tracking(1.2)
                                .foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Text("\(fmt1(o.avgGreens)) 🟩").font(Brand.font(10, .bold)).foregroundStyle(Theme.primary)
                            Text("\(fmt1(o.avgYellows)) 🟨").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xF59E0B))
                            Text("\(o.count)× · \(o.winRate)%").font(Brand.font(10, .bold))
                                .foregroundStyle(Theme.textMuted).frame(width: 60, alignment: .trailing)
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                    }
                }
                caption("Average greens / yellows revealed by your first guess")
            }
        }
    }

    private func positionAccuracy(_ p: StatsDeepService.PositionAccuracy) -> some View {
        KitCard {
            VStack(alignment: .leading, spacing: 8) {
                cardTitle("square.grid.3x3.fill", "Position Accuracy")
                HStack(spacing: 6) {
                    Spacer(minLength: 0)
                    ForEach(Array(p.pct.enumerated()), id: \.offset) { i, pct in
                        VStack(spacing: 4) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(accent.opacity(0.08 + Double(pct) / 100 * 0.78))
                                    .frame(width: 44, height: 44)
                                Text("\(pct)%").font(Brand.font(12, .black))
                                    .foregroundStyle(pct > 45 ? .white : Theme.textPrimary)
                            }
                            Text("\(i + 1)").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                        }
                    }
                    Spacer(minLength: 0)
                }
                caption("How often each slot is green across \(p.sampleGuesses) guesses")
            }
        }
    }

    private func stageBreakdown(_ stages: [StatsDeepService.GauntletStageStat]) -> some View {
        KitCard {
            VStack(alignment: .leading, spacing: 8) {
                cardTitle("theatermasks.fill", "Stage Breakdown", color: Color(hex: 0xD97706))
                VStack(spacing: 6) {
                    ForEach(stages) { s in
                        let clearPct = s.runs > 0 ? Int((Double(s.clears) / Double(s.runs) * 100).rounded()) : 0
                        HStack(spacing: 8) {
                            Text("\(s.stage + 1)").font(Brand.font(10, .black))
                                .foregroundStyle(Theme.textMuted).frame(width: 16)
                            Text(s.name ?? "Stage \(s.stage + 1)").font(Brand.font(12, .heavy))
                                .foregroundStyle(Theme.textPrimary).lineLimit(1)
                            Spacer()
                            if s.avgTimeSecs > 0 {
                                Text("~\(s.avgTimeSecs)s").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            }
                            Text("\(clearPct)%").font(Brand.font(12, .black))
                                .foregroundStyle(clearPct >= 50 ? Theme.primary : Color(hex: 0xDC2626))
                                .frame(width: 44, alignment: .trailing)
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                    }
                }
                caption("Clear rate + average time per stage")
            }
        }
    }

    private func hintsCard(_ h: StatsDeepService.HintHonesty) -> some View {
        KitCard {
            VStack(spacing: 10) {
                HStack {
                    Text("💡 Hints").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text("\(h.gamesCounted) games").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
                HStack {
                    Spacer()
                    VStack(spacing: 2) {
                        Text("\(h.hintlessWinRate)%").font(Brand.font(18, .black)).foregroundStyle(Theme.primary)
                        Text("HINTLESS WINS").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                    VStack(spacing: 2) {
                        Text(fmt1(h.avgHintsPerGame)).font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
                        Text("HINTS / GAME").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                }
            }
        }
    }

    private func almanacCard(_ entries: [StatsDeepService.AlmanacEntry]) -> some View {
        KitCard {
            VStack(alignment: .leading, spacing: 8) {
                cardTitle("book.fill", "Word Almanac")
                ScrollView {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
                        ForEach(entries) { a in
                            VStack(spacing: 1) {
                                Text(a.word).font(Brand.font(11, .black)).tracking(0.6)
                                    .foregroundStyle(a.won ? Color(hex: 0x6D28D9) : Color(hex: 0xDC2626))
                                    .lineLimit(1).minimumScaleFactor(0.7)
                                Text(a.won ? "\(a.guesses)g" : "✗").font(Brand.font(8, .bold))
                                    .foregroundStyle(Theme.textMuted)
                            }
                            .padding(6).frame(maxWidth: .infinity)
                            .background(RoundedRectangle(cornerRadius: 8)
                                .fill(a.won ? Color(hex: 0xF5F3FF) : Color(hex: 0xFEF2F2)))
                            .overlay(RoundedRectangle(cornerRadius: 8)
                                .stroke(a.won ? Color(hex: 0xDDD6FE) : Color(hex: 0xFECACA), lineWidth: 1))
                        }
                    }
                }
                .frame(maxHeight: 224)
                caption("Every solution you've faced recently — solved in purple")
            }
        }
    }

    private func fmt1(_ v: Double) -> String {
        v == v.rounded() ? "\(Int(v))" : String(format: "%.1f", v)
    }
}
