import SwiftUI
import UIKit
import WordociousCore

// FINISH_SPEC BI14: Strategy + How to Play in the per-game guide page's language
// (GuideSheet's R1 card): the host's ready pose on a soft glow, the game's title
// art, a centered title + line, numbered sections with soft numerals, takeaways on
// soft color fields and a big candy PLAY. Founder rules: no bordered boxes (fills,
// one soft shadow and a top color bar only), no emoji / decorative SF Symbols,
// friendly ready poses only, transform/opacity motion only.

// MARK: - Shared pieces (the guide-page family)

enum GuideFamily {
    static let cream = Color(hex: 0xFFF8F1)
    static let rainbow = [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)]
    static let brand = Color(hex: 0x7C3AED)

    /// The accent darkened for text on its own wash (light) or lifted (dark).
    static func ink(_ accent: Color) -> Color {
        Theme.isDark ? accent.mixed(over: .white, 0.62) : accent.mixed(over: Color(hex: 0x2A1650), 0.72)
    }

    static func washFill(_ accent: Color, _ amount: Double) -> Color {
        Theme.isDark ? accent.opacity(amount * 1.6) : accent.wash(amount)
    }
}

extension View {
    /// The guide page's top card without its stroke: the accent ~10% → ~4% over warm
    /// cream (dark: a deep accent tint), the rainbow top bar and one soft shadow.
    func guideHeroCard(_ accent: Color, radius: CGFloat = 28, bar: CGFloat = 8) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let dark = Theme.isDark
        return background {
            ZStack(alignment: .top) {
                if dark {
                    shape.fill(Theme.surface)
                    shape.fill(LinearGradient(colors: [accent.opacity(0.24), accent.opacity(0.08)], startPoint: .top, endPoint: .bottom))
                } else {
                    shape.fill(LinearGradient(colors: [accent.mixed(over: GuideFamily.cream, 0.10),
                                                       accent.mixed(over: GuideFamily.cream, 0.04)],
                                              startPoint: .top, endPoint: .bottom))
                }
                LinearGradient(colors: GuideFamily.rainbow, startPoint: .leading, endPoint: .trailing)
                    .frame(height: bar)
            }
            .clipShape(shape)
            .background(shape.fill(dark ? Theme.surface : GuideFamily.cream)
                .shadow(color: accent.opacity(0.22), radius: 18, x: 0, y: 8))
        }
    }

    /// A game tile: the accent gradient over cream, a solid accent top bar, one soft
    /// shadow — never a border.
    func guideTile(_ accent: Color, radius: CGFloat = 22) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let dark = Theme.isDark
        return background {
            ZStack(alignment: .top) {
                if dark {
                    shape.fill(Theme.surface)
                    shape.fill(LinearGradient(colors: [accent.opacity(0.26), accent.opacity(0.10)], startPoint: .top, endPoint: .bottom))
                } else {
                    shape.fill(LinearGradient(colors: [accent.mixed(over: GuideFamily.cream, 0.16),
                                                       accent.mixed(over: GuideFamily.cream, 0.06)],
                                              startPoint: .top, endPoint: .bottom))
                }
                accent.frame(height: 6)
            }
            .clipShape(shape)
            .background(shape.fill(dark ? Theme.surface : GuideFamily.cream)
                .shadow(color: Color(hex: 0x3C1E6E).opacity(0.10), radius: 10, x: 0, y: 6))
        }
    }
}

/// The host's ready pose on the guide page's soft radial glow + ground shadow,
/// springing in once (Reduce Motion: shown at rest).
struct GuideHostHero: View {
    let host: MascotID
    let accent: Color
    var height: CGFloat = 118
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        ZStack(alignment: .bottom) {
            RadialGradient(colors: [accent.opacity(Theme.isDark ? 0.42 : 0.30), accent.opacity(0)],
                           center: .center, startRadius: 4, endRadius: height * 0.82)
                .frame(width: height * 1.86, height: height * 1.27)
            Ellipse().fill(Color(hex: 0x3C1E6E).opacity(Theme.isDark ? 0.35 : 0.14))
                .frame(width: height * 0.71, height: height * 0.1)
                .offset(y: -2)
            PoseImage(host, "ready", height: height)
                .padding(.bottom, height * 0.05)
                .scaleEffect(shown ? 1 : 0.82, anchor: .bottom)
                .opacity(shown ? 1 : 0)
        }
        .frame(height: height * 1.19)
        .frame(maxWidth: .infinity)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            guard !shown else { return }
            if Mascots.reduceMotion(reduceMotion) { shown = true } else {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.55).delay(0.08)) { shown = true }
            }
        }
    }
}

/// "6 MIN READ": an accent-wash capsule, no stroke.
struct GuideChip: View {
    let text: String
    let accent: Color
    var size: CGFloat = 10

    var body: some View {
        Text(text.uppercased()).font(Brand.font(size, .black)).tracking(0.8)
            .foregroundStyle(GuideFamily.ink(accent))
            .padding(.horizontal, size * 0.9).padding(.vertical, size * 0.45)
            .background(Capsule().fill(GuideFamily.washFill(accent, 0.16)))
    }
}

/// A numbered section's head: a big soft numeral on a filled accent-wash circle + the heading.
struct GuideSectionHead: View {
    let number: Int
    let title: String
    let accent: Color

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text("\(number)").softNumber(22, color: GuideFamily.ink(accent))
                .frame(width: 42, height: 42)
                .background(Circle().fill(GuideFamily.washFill(accent, 0.16)))
                .accessibilityHidden(true)
            Text(title).font(Brand.font(18, .black)).foregroundStyle(FinishInk.heading)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
                .accessibilityLabel("\(number). \(title)")
        }
    }
}

/// The section's key line on a soft color field (no border).
struct GuideTakeaway: View {
    let text: String
    let accent: Color

    var body: some View {
        Text(text).font(Brand.font(15, .black)).foregroundStyle(GuideFamily.ink(accent))
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(GuideFamily.washFill(accent, 0.10)))
    }
}

/// Body copy at a comfortable reading size.
struct GuideParagraph: View {
    let text: String
    var body: some View {
        Text(text).font(Brand.font(15, .regular)).foregroundStyle(FinishInk.secondary)
            .lineSpacing(6)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Which game an article belongs to

struct StrategyGame {
    enum Shelf: Int, CaseIterable { case dailies, puzzles, every
        var title: String {
            switch self {
            case .dailies: return "WORDOCIOUS DAILIES"
            case .puzzles: return "PUZZLES"
            case .every:   return "EVERY GAME"
            }
        }
    }

    let gen: GenMode?
    let host: MascotID
    var accent: Color { gen?.accent ?? GuideFamily.brand }
    var group: Shelf { gen == nil ? .every : (gen?.group == "more" ? .puzzles : .dailies) }
    /// art-game-<id> when it ships.
    var titleArt: (asset: String, label: String)? {
        guard let g = gen else { return nil }
        let asset = "art-game-\(g.id)"
        return ArtAsset.exists(asset) ? (asset, g.shareLabel) : nil
    }
    /// Today's daily to open from PLAY (nil for general articles and VS).
    var playKey: String? { gen?.dailyEligible == true ? gen?.dbKey : nil }

    /// Resolves every article (general articles take the cast in order).
    static func resolve(_ articles: [StrategyArticleModel]) -> [String: StrategyGame] {
        let titles = Dictionary(uniqueKeysWithValues: ModeGen.all.map { ($0.id, $0.title) })
        var out: [String: StrategyGame] = [:]
        var generalIndex = 0
        for a in articles {
            if let id = StrategyPlan.gameId(for: a.slug, titles: titles), let g = ModeGen.byId(id) {
                out[a.slug] = StrategyGame(gen: g, host: g.dbKey.flatMap { Mascots.host(dbKey: $0) } ?? .w)
            } else {
                let cast = StrategyPlan.cast[generalIndex % StrategyPlan.cast.count]
                generalIndex += 1
                out[a.slug] = StrategyGame(gen: nil, host: MascotID(rawValue: cast) ?? .w)
            }
        }
        return out
    }

    /// The index order: dailies, puzzles, every game (API order within each).
    static func ordered(_ articles: [StrategyArticleModel], _ games: [String: StrategyGame]) -> [StrategyArticleModel] {
        Shelf.allCases.flatMap { g in articles.filter { (games[$0.slug]?.group ?? .every) == g } }
    }

    /// Close every presented layer, then open today's daily (same path as the widget / next-daily CTA).
    static func play(_ dbKey: String) {
        let post = { NotificationCenter.default.post(name: NextDailyCTA.playNextDaily, object: dbKey) }
        let root = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows.first(where: \.isKeyWindow) }
            .first?.rootViewController
        if let root, root.presentedViewController != nil {
            root.dismiss(animated: true) { DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: post) }
        } else {
            post()
        }
    }
}

// MARK: - Strategy index

struct StrategyIndexBody: View {
    let articles: [StrategyArticleModel]
    let open: (StrategyArticleModel) -> Void

    var body: some View {
        let games = StrategyGame.resolve(articles)
        let ordered = StrategyGame.ordered(articles, games)
        let featured = ordered.isEmpty ? nil : ordered[StrategyPlan.tipIndex(count: ordered.count)]
        // BJ7: 14 between groups (was 22), tiles that hug their content.
        return VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("SOLVE SMARTER").font(Brand.font(13, .black)).tracking(1.2).foregroundStyle(GuideFamily.ink(GuideFamily.brand))
                Text("Original strategy for every Wordocious game.")
                    .font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
            }
            .padding(.horizontal, 4)

            if let f = featured, let g = games[f.slug] {
                Button { open(f) } label: { featuredCard(f, g) }.buttonStyle(.squish)
            }

            ForEach(StrategyGame.Shelf.allCases, id: \.rawValue) { group in
                let items = ordered.filter { games[$0.slug]?.group == group }
                if !items.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group.title).font(Brand.font(11, .black)).tracking(1.2).foregroundStyle(FinishInk.heading)
                            .padding(.horizontal, 4)
                            .accessibilityAddTraits(.isHeader)
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                            ForEach(items) { a in
                                if let g = games[a.slug] {
                                    Button { open(a) } label: { tile(a, g) }.buttonStyle(.squish)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func featuredCard(_ a: StrategyArticleModel, _ g: StrategyGame) -> some View {
        VStack(spacing: 6) {
            Text("TIP OF THE DAY").font(Brand.font(11, .black)).tracking(1.4).foregroundStyle(GuideFamily.ink(g.accent))
            GuideHostHero(host: g.host, accent: g.accent, height: 64)
            if let art = g.titleArt {
                GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 40, alignment: .center)
                    .frame(maxWidth: .infinity)
            }
            Text(a.title).font(Brand.font(17, .black)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            Text(a.dek).font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center).lineLimit(2)
            GuideChip(text: "\(a.minutes) min read", accent: g.accent)
        }
        .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 12)
        .frame(maxWidth: .infinity)
        .guideHeroCard(g.accent)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tip of the day. \(a.title). \(a.minutes) minute read")
    }

    private func tile(_ a: StrategyArticleModel, _ g: StrategyGame) -> some View {
        // BJ7: the title art, the article title (3 lines reserved so every tile in the
        // grid matches) and the minutes chip right under it — no 170 floor, no chip
        // floating at the bottom.
        VStack(alignment: .leading, spacing: 6) {
            Group {
                if let art = g.titleArt {
                    GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 30, alignment: .leading)
                } else if let gen = g.gen, ArtAsset.exists("art-titlecast-vsbattle"), gen.shortTitle.uppercased() == "VS" {
                    // BJ16: VS wears the VS BATTLE lettering.
                    GameTitleArtView(asset: "art-titlecast-vsbattle", label: "VS Battle", maxHeight: 30, alignment: .leading)
                } else if let gen = g.gen {
                    // VS has no title art: its short name lettered in the accent.
                    Text(gen.shortTitle.uppercased()).font(Brand.font(24, .black)).foregroundStyle(g.accent)
                } else {
                    PoseImage(g.host, "ready", height: 36)
                }
            }
            .frame(height: 36, alignment: .leading)
            .accessibilityHidden(true)
            Text(a.title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.leading).lineLimit(3, reservesSpace: true).minimumScaleFactor(0.85)
            GuideChip(text: "\(a.minutes) min", accent: g.accent, size: 9)
        }
        .padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 10)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .guideTile(g.accent)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(g.gen?.title ?? "Every game"). \(a.title). \(a.minutes) minute read")
    }
}

// MARK: - Strategy article reader

struct StrategyReaderBody: View {
    let article: StrategyArticleModel
    let all: [StrategyArticleModel]
    let open: (StrategyArticleModel) -> Void

    var body: some View {
        let games = StrategyGame.resolve(all)
        let ordered = StrategyGame.ordered(all, games)
        let g = games[article.slug] ?? StrategyGame(gen: nil, host: .w)
        let i = ordered.firstIndex { $0.slug == article.slug }
        let prev = i.flatMap { $0 > 0 ? ordered[$0 - 1] : nil }
        let next = i.flatMap { $0 + 1 < ordered.count ? ordered[$0 + 1] : nil }
        return VStack(alignment: .leading, spacing: 26) {
            hero(g)
            ForEach(article.sections.indices, id: \.self) { s in
                section(s + 1, article.sections[s], accent: g.accent)
            }
            if let key = g.playKey, let gen = g.gen {
                // BJ9: the game grows from this button's frame (its sheet closes first).
                Button { GameTransition.shared.arm("strategy:play", frameOnly: true); StrategyGame.play(key) } label: {
                    CandyLabel(title: "Play \(gen.title)".uppercased(), symbol: "play.fill")
                }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
                    .gameLaunchSource("strategy:play", color: g.accent.wash(0.10), radius: 22)
            }
            if prev != nil || next != nil {
                HStack(alignment: .top, spacing: 12) {
                    neighbor(prev, label: "PREVIOUS", games: games, trailing: false)
                    neighbor(next, label: "NEXT", games: games, trailing: true)
                }
            }
        }
    }

    private func hero(_ g: StrategyGame) -> some View {
        VStack(spacing: 10) {
            GuideHostHero(host: g.host, accent: g.accent)
            if let art = g.titleArt {
                GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 60, alignment: .center)
                    .frame(maxWidth: .infinity)
            }
            Text(article.title).font(Brand.font(22, .black)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(article.dek).font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 4)
            GuideChip(text: "\(article.minutes) min read", accent: g.accent)
                .padding(.top, 2)
        }
        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .guideHeroCard(g.accent)
        .padding(.top, 6)
    }

    private func section(_ n: Int, _ s: StrategyArticleModel.Section, accent: Color) -> some View {
        let split = s.body.first.flatMap(StrategyPlan.takeaway)
        var paragraphs = s.body
        if let split, !paragraphs.isEmpty {
            paragraphs.removeFirst()
            if !split.rest.isEmpty { paragraphs.insert(split.rest, at: 0) }
        }
        return VStack(alignment: .leading, spacing: 12) {
            GuideSectionHead(number: n, title: s.heading, accent: accent)
            if let split { GuideTakeaway(text: split.takeaway, accent: accent) }
            ForEach(paragraphs.indices, id: \.self) { j in GuideParagraph(text: paragraphs[j]) }
        }
        .padding(.horizontal, 2)
    }

    @ViewBuilder
    private func neighbor(_ a: StrategyArticleModel?, label: String, games: [String: StrategyGame], trailing: Bool) -> some View {
        if let a, let g = games[a.slug] {
            Button { open(a) } label: {
                VStack(alignment: trailing ? .trailing : .leading, spacing: 4) {
                    Text(label).font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(GuideFamily.ink(g.accent))
                    Text(a.title).font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                        .multilineTextAlignment(trailing ? .trailing : .leading).lineLimit(2)
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: trailing ? .trailing : .leading)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GuideFamily.washFill(g.accent, 0.12)))
            }
            .buttonStyle(.squish)
            .accessibilityLabel("\(label == "NEXT" ? "Next" : "Previous") article: \(a.title)")
        } else {
            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
        }
    }
}
