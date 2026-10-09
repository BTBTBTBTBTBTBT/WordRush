import SwiftUI
import WordociousCore

/// Shared visual grammar for the Profile + Records stat pages — ports
/// components/profile/stat-kit.tsx. Every section uses SectionHeader; every
/// stat cell uses StatCell inside a StatGrid; every chart sits in a ChartCard;
/// every Pro gate uses ProStatsInvite. One look, defined once.

/// Uppercase tracked section label with an accent tick + optional right control.
struct SectionHeader<Right: View>: View {
    let label: String
    var accent: Color = Theme.primary
    @ViewBuilder var right: Right

    init(_ label: String, accent: Color = Theme.primary, @ViewBuilder right: () -> Right) {
        self.label = label
        self.accent = accent
        self.right = right()
    }

    var body: some View {
        // 2.8 item 16: section titles in the bubble lettering, tinted in the section's cast color
        // (core StatsProfile.sectionTitleColor; an unlisted title takes `accent`), right on the wallpaper.
        let named = StatsProfile.sectionTitleColor(label)
        let tint: Color = named == StatsProfile.castW ? accent : .cast(named)
        HStack {
            BubbleTextView(text: label.uppercased(), palette: .accent(tint), maxSize: 22, minSize: 13, alignment: .leading)
                .frame(maxWidth: 240)
            Spacer(minLength: 0)
            right
        }
        .padding(.horizontal, 4)
    }
}

extension SectionHeader where Right == EmptyView {
    init(_ label: String, accent: Color = Theme.primary) {
        self.init(label, accent: accent) { EmptyView() }
    }
}

/// The standard card surface: 16pt radius, 1.5pt border, optional 3pt top
/// accent bar (mode color), like the leaderboard card.
struct KitCard<Content: View>: View {
    var accent: Color? = nil
    var padded: Bool = true
    @ViewBuilder var content: Content

    init(accent: Color? = nil, padded: Bool = true, @ViewBuilder content: () -> Content) {
        self.accent = accent
        self.padded = padded
        self.content = content()
    }

    var body: some View {
        content.padding(padded ? 16 : 0).frame(maxWidth: .infinity, alignment: .leading)
            .statsCard(accent: accent)
    }
}

/// The Stats page's card palette (FINISH_SPEC §A1 / §C3, mockup stats-friends-polish).
enum StatsInk {
    /// The lavender chart-card family (#f6f1ff).
    static let lavender = Color(hex: 0x7C3AED)
    /// Rows inside a tinted card: a slightly stronger wash of the card's accent
    /// (never plain white); dark mode a faint light lift.
    static func rowFill(_ accent: Color = Color(hex: 0x7C3AED)) -> Color {
        Theme.isDark ? Color.white.opacity(0.05) : accent.wash(0.11)
    }
}

extension View {
    /// §A1 / §C3: a Stats card — the soft wash of its accent (lavender when none),
    /// a 1.5-pt border and, when an accent is given, the accent top bar.
    func statsCard(accent: Color? = nil, radius: CGFloat = 18) -> some View {
        let a = accent ?? StatsInk.lavender
        return tintedCard(accent: a, bar: accent.map { [$0, $0.mixed(over: .white, 0.6)] },
                          radius: radius, barHeight: 6, tint: 0.07, line: 0.24)
    }
}

/// FINISH_SPEC §C3: a stat tile in its own color (mockup `.mini`) — a tinted card
/// in `accent`, a 3D icon + 10-pt caps label in `ink`, a 28-pt soft number and a
/// small muted line (or two). Streak / best-moment tiles and the four all-time tiles.
struct StatsTile<Icon: View>: View {
    let label: String
    let value: String
    var sub: String? = nil
    var sub2: String? = nil
    let accent: Color
    /// The caps label color (the accent darkened, mockup `--lc`).
    var ink: Color
    /// Count the value up from 0 on appear (F4); `value` stays the fallback.
    var countUp: Int? = nil
    var countSuffix: String = ""
    @ViewBuilder var icon: () -> Icon

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                icon().frame(width: 22, height: 22)
                Text(label.uppercased()).font(Brand.font(10, .black)).tracking(1.0)
                    .foregroundStyle(Theme.isDark ? Theme.textSecondary : ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            Group {
                if let n = countUp {
                    CountUpNumber(value: n, suffix: countSuffix, font: Brand.font(28, .black),
                                  color: FinishInk.number, soft: 28)
                } else {
                    Text(value).softNumber(28)
                }
            }
            .lineLimit(1).minimumScaleFactor(0.5)
            ForEach([sub, sub2].compactMap { $0 }, id: \.self) { line in
                Text(line).font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .tintedCard(accent: accent, tint: 0.10, line: 0.28)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([label, value, sub, sub2].compactMap { $0 }.joined(separator: ", "))
    }
}

/// The Stats tiles' palette (mockup `.mini` cards): accent + label ink.
enum StatsTileColor {
    static let purple = (accent: Color(hex: 0x7C3AED), ink: Color(hex: 0x6D28D9))
    static let green = (accent: Color(hex: 0x22C55E), ink: Color(hex: 0x137A3D))
    static let gold = (accent: Color(hex: 0xF5A524), ink: Color(hex: 0xA2560C))
    static let pink = (accent: Color(hex: 0xEC4899), ink: Color(hex: 0xA0336B))
    static let blue = (accent: Color(hex: 0x0A6CFF), ink: Color(hex: 0x2456A8))
}

/// The glossy medal art (`art-medal-gold|silver|bronze|trophy`) for medal counts and
/// rows — decorative; falls back to the old SF symbol when the art is missing.
struct MedalArt: View {
    /// "gold" | "silver" | "bronze" | "trophy".
    let kind: String
    var size: CGFloat = 22
    var fallbackSymbol: String = "medal.fill"
    var fallbackColor: Color = Theme.textMuted

    var body: some View {
        let asset = "art-medal-\(kind)"
        Group {
            if ArtAsset.exists(asset) {
                Image(asset).resizable().interpolation(.high).scaledToFit()
                    .frame(width: size, height: size)
            } else {
                SymbolGlyph(fallbackSymbol, size: size * 0.8, color: fallbackColor)
            }
        }
        .accessibilityHidden(true)
    }
}

/// One stat: icon, big value, small uppercase label, optional sub line.
struct StatCell: View {
    let icon: String?
    let label: String
    let value: String
    var sub: String? = nil
    var color: Color? = nil
    /// When set, the big value counts up from 0 on appear (F4). `value` stays
    /// the fallback for Reduced Motion / non-integer cells.
    var countUp: Int? = nil
    var countSuffix: String = ""

    var body: some View {
        VStack(spacing: 2) {
            if let icon {
                SymbolGlyph(icon, size: 16, color: color ?? Theme.textMuted)
            }
            // §A2: every big number is a soft number.
            if let n = countUp {
                CountUpNumber(value: n, suffix: countSuffix, font: Brand.font(18, .black),
                              color: FinishInk.number, soft: 18)
            } else {
                Text(value).softNumber(18)
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
            Text(label.uppercased()).font(Brand.font(9, .black)).tracking(0.6)
                .foregroundStyle(FinishInk.secondary)
            // Always reserve the sub line so grids of cells stay equal-height.
            Text(sub ?? " ").font(Brand.font(9, .bold)).foregroundStyle(FinishInk.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Grid of StatCells on one KitCard (defaults 4-up like the summary row).
struct StatGrid: View {
    let stats: [StatCell]
    var cols: Int = 4
    var accent: Color? = nil

    var body: some View {
        KitCard(accent: accent) {
            EagerGrid(items: stats, columns: cols, rowSpacing: 12) { s in s }
        }
    }
}

/// Chart frame: title row + optional timeframe hint + consistent empty state.
struct ChartCard<Content: View>: View {
    let title: String
    var hint: String? = nil
    /// When set, renders the empty-state message instead of children.
    var empty: String? = nil
    var accent: Color? = nil
    @ViewBuilder var content: Content

    init(title: String, hint: String? = nil, empty: String? = nil, accent: Color? = nil,
         @ViewBuilder content: () -> Content) {
        self.title = title
        self.hint = hint
        self.empty = empty
        self.accent = accent
        self.content = content()
    }

    var body: some View {
        KitCard(accent: accent) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                    Spacer()
                    if let hint {
                        Text(hint).font(Brand.font(9, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                }
                if let empty {
                    Text(empty).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 24)
                        .multilineTextAlignment(.center)
                } else {
                    content
                }
            }
        }
    }
}

/// FINISH_SPEC BJ17: the GO PRO sign cast (ChatGPT / API art, art-gopro-sign-<id>): all ten
/// each holding the gold GO PRO lettering. The Stats locked sections and the free finish-screen
/// upsell use them; every size is decoded off main at launch (AppWarmup) so none pops in.
enum GoProSign {
    static let cast = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]   // cast order (web GOPRO_SIGN_CAST)
    static func asset(_ id: String) -> String { "art-gopro-sign-\(id)" }
    /// A deterministic pick from the local date, so the finish upsell's character changes daily.
    static func ofDay(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        let n = (c.year ?? 0) * 372 + (c.month ?? 0) * 31 + (c.day ?? 0)
        return cast[n % cast.count]
    }
    /// Longest-side sizes in use: the Stats full / compact blocks and the finish card.
    static let points: [CGFloat] = [116, 60, 64]
    static func prewarm() {
        ArtThumbs.prewarm(cast.flatMap { id in points.map { (asset(id), $0) } })
    }
}

/// The single Pro gate (FINISH_SPEC BJ17, founder 10-03: "a mascot saying go pro… instead of it
/// being blurred out"): no blur and no sample numbers behind glass. The section keeps its own header;
/// in place of the stats, W holds up the gold GO PRO sign, one line says what Pro unlocks HERE, and
/// the gold cast GO PRO button opens ProView. `compact` = the small W beside the line + a small
/// button, for every locked section after the first on a page (one big W per page).
struct ProStatsInvite: View {
    let line: String
    var compact: Bool = false
    /// Which cast member holds the sign (GoProSign.cast): each locked section has its own.
    var cast: String = "w"
    @State private var showPro = false

    private var art: String { GoProSign.asset(cast) }
    /// Display sizes (longest side, pt) — GoProSign.prewarm decodes both off main ahead of time.
    static let fullPoints: CGFloat = 116, compactPoints: CGFloat = 60

    var body: some View {
        Group {
            if compact {
                HStack(spacing: 12) {
                    ArtThumbs.image(art, points: Self.compactPoints)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: Self.compactPoints, height: Self.compactPoints)
                    VStack(alignment: .leading, spacing: 8) {
                        lineText.multilineTextAlignment(.leading)
                        button(.small)
                    }
                    .frame(maxWidth: 230, alignment: .leading)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            } else {
                VStack(spacing: 8) {
                    ArtThumbs.image(art, points: Self.fullPoints)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: Self.fullPoints, height: Self.fullPoints)
                    lineText.multilineTextAlignment(.center).frame(maxWidth: 280)
                    button(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
        }
        .accessibilityElement(children: .contain)
        .softSheet(isPresented: $showPro) { ProView() }
    }

    private var lineText: some View {
        Text(line).font(Brand.font(13, .heavy)).foregroundStyle(FinishInk.heading)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func button(_ size: CandyButtonStyle.Size) -> some View {
        Button { showPro = true } label: { CandyLabel(title: "Go Pro") { EmptyView() } }
            .buttonStyle(CastButtonStyle(color: .gold, size: size, fullWidth: false))
            .accessibilityLabel("Go Pro")
            .accessibilityHint(line)
    }
}


/// A number that counts up from 0 to `value` on first appear (F4). For the
/// marquee profile stats — respects Reduced Motion (snaps to final).
struct CountUpNumber: View {
    let value: Int
    var suffix: String = ""
    var font: Font
    var color: Color
    /// §A2: draw as a soft number at this size (overrides `font` / `color`).
    var soft: CGFloat? = nil
    @State private var shown = 0
    /// BJ1: a value counts up ONCE per session — the Stats page is lazy now, so a card that
    /// scrolls back into view would otherwise replay 24 re-layouts mid-scroll.
    private static var counted = Set<String>()

    @ViewBuilder private var label: some View {
        if let soft {
            Text("\(shown)\(suffix)").softNumber(soft)
        } else {
            Text("\(shown)\(suffix)").font(font).foregroundStyle(color).monospacedDigit()
        }
    }

    var body: some View {
        label
            .onAppear {
                let key = "\(value)\(suffix)"
                guard !Theme.reduceMotion, value > 0, !ScrollMotion.shared.scrolling,
                      Self.counted.insert(key).inserted else { shown = value; return }
                let steps = min(value, 24)
                let stepDur = 0.5 / Double(steps)
                for i in 1...steps {
                    DispatchQueue.main.asyncAfter(deadline: .now() + stepDur * Double(i)) {
                        shown = Int((Double(value) * Double(i) / Double(steps)).rounded())
                    }
                }
            }
            .onChange(of: value) { shown = $0 }   // toggle/refresh → snap, no re-count
    }
}

/// F3: fades + rises a self-fetching card in the moment its data lands, instead
/// of popping. Drive with a token that changes when loading completes (e.g.
/// `loaded` bool or row count). Reserves nothing — pair with a min-height
/// placeholder where layout shift matters.
extension View {
    func asyncEntrance(_ token: some Equatable) -> some View {
        self.transition(.opacity.combined(with: .offset(y: 8)))
            .animation(Theme.animation(.easeOut(duration: 0.3)), value: token)
    }
}

// MARK: - Session stats memo (P-cache)

/// Session-lived, type-erased memo for the profile dashboards' fetch results —
/// SWR-style: a `.task` seeds its @State from here (instant repaint when the
/// user re-enters the tab or re-taps a mode), then fetches fresh exactly as
/// before and stores the result back. Purely additive: what is fetched and how
/// it renders are unchanged. Key by a stable string that includes the user id,
/// mode and play type, e.g. "guessDist:\(uid):\(mode):\(playType)".
///
/// FINISH_SPEC BI19: Codable values are also persisted (Caches/stats-memo.json,
/// versioned, size-bounded), so a COLD launch paints the last stats too instead
/// of skeletons. The Codable overloads below are picked automatically; anything
/// else stays session-only, exactly as before.
@MainActor
final class StatsMemo {
    static let shared = StatsMemo()
    private var store: [String: Any] = [:]
    private let disk: PersistentMemoStore? = FileManager.default
        .urls(for: .cachesDirectory, in: .userDomainMask).first
        .map { PersistentMemoStore(url: $0.appendingPathComponent("stats-memo.json")) }
    private var flushWork: DispatchWorkItem?
    private init() {}

    func get<T>(_ key: String) -> T? { store[key] as? T }
    func set<T>(_ key: String, _ value: T) { store[key] = value }

    /// Memory first, then the last launch's value from disk.
    func get<T: Decodable>(_ key: String) -> T? {
        if let v = store[key] as? T { return v }
        guard let v = disk?.get(key, as: T.self) else { return nil }
        store[key] = v
        return v
    }

    func set<T: Encodable>(_ key: String, _ value: T) {
        store[key] = value
        disk?.set(key, value)
        // Coalesce a page's burst of sets into one write, off the main thread.
        flushWork?.cancel()
        let disk = disk
        let work = DispatchWorkItem { DispatchQueue.global(qos: .utility).async { disk?.flush() } }
        flushWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
    }

    /// The signed-in id every memo key carries ("anon" before auth lands).
    static var uid: String { AuthService.shared.profile?.id ?? "anon" }
}

/// Where a self-fetching stats card will land, on its FIRST load of the session (nothing in
/// StatsMemo yet): a pulsing block in the card's slot instead of a zero-height view that pops
/// in, or an empty-state line that flashes before the real data (founder, 2026-09-29). Later
/// visits never show it — every card seeds its @State from the memo in init.
struct StatsCardPlaceholder: View {
    var title: String? = nil
    var accent: Color = Theme.primary
    var height: CGFloat = 120
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title { SectionHeader(title, accent: accent) }
            SkeletonBlock(height: height, cornerRadius: 16)
        }
    }
}

/// Visible "no data yet" chrome for a stats card whose fetch returned nothing.
/// Replaces silent hiding: an invisible card reads as a broken build (exactly
/// how the missing Skill Radar was reported on 126), and the visible hint
/// doubles as a diagnostic — a card stuck on this state for an account with
/// real history means its FETCH is failing, not the data.
struct StatsEmptyCard: View {
    let title: String
    var accent: Color = Theme.primary
    var hint: String = "Not enough data yet — keep playing to unlock this insight."
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title, accent: accent)
            KitCard {
                // BI24: D (the stats host) beside the line, never a generic SF Symbol.
                HStack(spacing: 10) {
                    MascotView(Mascots.stats, size: 34)
                    Text(hint).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 10)
            }
        }
    }
}

/// Left-aligned wrapping row (iOS 16 Layout) — a wrapping row of chips
/// (the Stats tab used it for its action row before the §296 player card)
/// flows onto a second line instead of squeezing or scrolling.
struct ActionWrapRow: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    private func rows(_ subviews: Subviews, width: CGFloat) -> [[Int]] {
        var rows: [[Int]] = [[]], x: CGFloat = 0
        for i in subviews.indices {
            let w = subviews[i].sizeThatFits(.unspecified).width
            if !rows[rows.count - 1].isEmpty && x + spacing + w > width { rows.append([]); x = 0 }
            x += (rows[rows.count - 1].isEmpty ? 0 : spacing) + w
            rows[rows.count - 1].append(i)
        }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rs = rows(subviews, width: width)
        var h: CGFloat = 0, maxW: CGFloat = 0
        for r in rs {
            let sizes = r.map { subviews[$0].sizeThatFits(.unspecified) }
            h += sizes.map(\.height).max() ?? 0
            maxW = max(maxW, sizes.map(\.width).reduce(0, +) + spacing * CGFloat(max(0, r.count - 1)))
        }
        h += lineSpacing * CGFloat(max(0, rs.count - 1))
        return CGSize(width: width.isFinite ? width : maxW, height: h)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for r in rows(subviews, width: bounds.width) {
            let sizes = r.map { subviews[$0].sizeThatFits(.unspecified) }
            let rowH = sizes.map(\.height).max() ?? 0
            var x = bounds.minX
            for (k, i) in r.enumerated() {
                // Center each item vertically in its line so 30pt circles and 28pt capsules align.
                subviews[i].place(at: CGPoint(x: x, y: y + (rowH - sizes[k].height) / 2), proposal: ProposedViewSize(sizes[k]))
                x += sizes[k].width + spacing
            }
            y += rowH + lineSpacing
        }
    }
}

/// Stats scroll-jump fix: a NON-lazy grid (core `GridRows`) for the Stats page — rows of
/// equal-width cells, top-aligned, built up front so the page's content height never
/// swings while scrolling (a LazyVGrid inside the page's plain ScrollView did).
struct EagerGrid<Item, Cell: View>: View {
    let items: [Item]
    var columns: Int
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8
    @ViewBuilder var cell: (Item) -> Cell

    var body: some View {
        VStack(spacing: rowSpacing) {
            ForEach(GridRows.chunk(items.count, columns: columns), id: \.self) { row in
                HStack(alignment: .top, spacing: spacing) {
                    ForEach(row, id: \.self) { i in cell(items[i]).frame(maxWidth: .infinity) }
                    ForEach(0..<max(0, columns - row.count), id: \.self) { _ in
                        Color.clear.frame(maxWidth: .infinity, maxHeight: 0)
                    }
                }
            }
        }
    }
}
