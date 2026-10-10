import SwiftUI
import WordociousCore

/// Native "How to Play" — renders the exact same document as the web
/// /how-to-play page, fetched from /api/howtoplay so the copy stays single-
/// sourced in lib/how-to-play-content.ts.
struct HTPSection: Decodable, Identifiable {
    let title: String
    let intro: String?
    let bullets: [HTPBullet]?
    let tilesHeading: String?
    let tiles: [HTPTileRow]?
    let modes: [HTPMode]?
    /// 2.8 item 36: one entry per game (Dailies, Puzzles, VS Battle, Pocket games).
    let games: [HTPGame]?
    let outro: String?
    var id: String { title }
}
/// One game's How to Play entry: `id` is the catalog mode id ("practice", "hub", "vs") or "pocket-<kind>".
struct HTPGame: Decodable, Identifiable { let id: String; let title: String; let accent: String; let lines: [String] }
struct HTPBullet: Decodable { let strong: String?; let text: String }
struct HTPMode: Decodable { let name: String; let accent: String; let body: String }
struct HTPLetter: Decodable { let ch: String; let color: String }
struct HTPTileRow: Decodable { let letters: [HTPLetter]; let strong: String; let strongColor: String; let rest: String }

@MainActor
final class HowToPlayService: ObservableObject {
    static let shared = HowToPlayService()
    @Published private(set) var sections: [HTPSection] = []
    private static let cacheKey = "howtoplay-cache-v1"
    private var loaded = false
    private struct Payload: Decodable { let sections: [HTPSection] }

    /// Seed from the UserDefaults cache so the screen renders instantly on
    /// every open after the first-ever fetch (ContentService pattern).
    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.cacheKey),
           let payload = try? JSONDecoder().decode(Payload.self, from: data) {
            sections = payload.sections
        }
    }

    /// Cached copy shows immediately; this refreshes it and persists the result.
    ///
    /// Was once-per-launch AND on `URLSession.shared`, which honors the
    /// response's `max-age=3600` — so a backgrounded app never refetched, and a
    /// cold launch could still serve an hour-old copy. That is two layers of
    /// staleness over content whose whole point is that it updates on a deploy
    /// without a release. See ContentService.load for the same fix.
    func load() async {
        guard let url = URL(string: "https://wordocious.com/api/howtoplay") else { return }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, _) = try? await Net.api.data(for: req),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        sections = payload.sections
        loaded = true
        UserDefaults.standard.set(data, forKey: Self.cacheKey)
    }
}

/// Parse a "#rrggbb" string into a Color (falls back to the brand purple).
func htpColor(_ hex: String) -> Color {
    let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    return UInt(h, radix: 16).map { Color(hex: $0) } ?? Color(hex: 0x7C3AED)
}

struct HowToPlayView: View {
    @ObservedObject private var service = HowToPlayService.shared
    /// "Full guide" / "Watch how" sheets (item 36).
    @State private var sheet: HTPSheet?
    private enum HTPSheet: Identifiable {
        case guide(GameMode, expanded: Bool)
        case pocket(FriendlyKind)
        var id: String {
            switch self {
            case .guide(let m, let e): return "guide-\(m.rawValue)-\(e)"
            case .pocket(let k): return "pocket-\(k.rawValue)"
            }
        }
    }
    /// The section titles' bubble lettering, by section order.
    private static let palettes: [HeadlinePalette] = [.home, .stats, .stats, .vs, .friends, .leaderboard, .home, .stats, .vs, .friends]

    /// §C6: each section card takes the next color of the brand set.
    private static let accents: [Color] = [Color(hex: 0x7C3AED), Color(hex: 0xEC4899), Color(hex: 0xF59E0B),
                                           Color(hex: 0x3B82F6), Color(hex: 0x10B981)]

    var body: some View {
        // FINISH_SPEC BI14: the per-game guide page's language — a hero card (W's ready
        // pose on a soft glow, the heading) then numbered sections with soft
        // numerals and takeaways on soft color fields; no bordered cards. Help opens the FAQ.
        MenuScaffold("How to Play", host: Mascots.help, art: .howto, help: .faq) {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    hero

                    if service.sections.isEmpty {
                        CastLoader(showTips: false).frame(maxWidth: .infinity).padding(.top, 20)
                    } else {
                        ForEach(Array(service.sections.enumerated()), id: \.element.id) { i, sec in
                            section(i + 1, sec, accent: Self.accents[i % Self.accents.count], palette: Self.palettes[i % Self.palettes.count])
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 28)
                .frame(maxWidth: 560).frame(maxWidth: .infinity)
            }
        }
        .task { await service.load() }
        .softSheet(item: $sheet) { item in
            switch item {
            case .guide(let mode, let expanded): GuideSheet(mode: mode, startExpanded: expanded)
            case .pocket(let kind): PocketHelpSheet(kind: kind)
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            GuideHostHero(host: .w, accent: GuideFamily.brand)
            BubbleTextView(text: "HOW WORDOCIOUS WORKS", palette: .accent(GuideFamily.brand), maxSize: 28, minSize: 18, animated: false)
            Text("Everything you need to know to get started").font(Brand.font(14, .bold))
                .foregroundStyle(FinishInk.secondary).multilineTextAlignment(.center)
        }
        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .guideHeroCard(GuideFamily.brand)
        .padding(.top, 6)
    }

    @ViewBuilder
    private func section(_ n: Int, _ s: HTPSection, accent: Color, palette: HeadlinePalette) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHead(n, s.title, accent: accent, palette: palette)

            if let intro = s.intro { GuideTakeaway(text: intro, accent: accent) }

            if let bullets = s.bullets {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(bullets.indices, id: \.self) { i in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Circle().fill(accent).frame(width: 8, height: 8).alignmentGuide(.firstTextBaseline) { d in d[.bottom] }
                            bulletText(bullets[i]).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            if let heading = s.tilesHeading {
                BubbleLabel(heading, color: GuideFamily.brand.bubbleInk, size: 15).padding(.top, 2)
            }
            if let tiles = s.tiles {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(tiles.indices, id: \.self) { i in tileRow(tiles[i]) }
                }
            }

            if let games = s.games {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(games) { g in gameEntry(g) }
                }
            } else if let modes = s.modes {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(modes.indices, id: \.self) { i in modeRow(modes[i]) }
                }
            }

            if let outro = s.outro { GuideParagraph(text: outro) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 2)
    }

    /// A section head in bubble lettering: the soft numeral, then the title (item 36).
    private func sectionHead(_ n: Int, _ title: String, accent: Color, palette: HeadlinePalette) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text("\(n)").softNumber(22, color: GuideFamily.ink(accent))
                .frame(width: 42, height: 42)
                .background(Circle().fill(GuideFamily.washFill(accent, 0.16)))
                .accessibilityHidden(true)
            BubbleTextView(text: title.uppercased(), palette: palette, maxSize: 24, minSize: 16, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(n). \(title)")
                .accessibilityAddTraits(.isHeader)
        }
    }

    /// One game's entry: icon, title art, a few plain lines, then "Full guide" and "Watch how" (its first-play walk-through).
    @ViewBuilder
    private func gameEntry(_ g: HTPGame) -> some View {
        let pocketKind: FriendlyKind? = g.id.hasPrefix("pocket-") ? FriendlyKind(rawValue: String(g.id.dropFirst("pocket-".count))) : nil
        let gen = pocketKind == nil ? ModeGen.byId(g.id) : nil
        let home = (homeModes + moreModes).first { $0.id == g.id }
        let gameMode: GameMode? = gen?.dbKey.flatMap { GameMode(rawValue: $0) }
        let titleAsset = pocketKind != nil ? "art-titlecast-pocket-\(g.id.dropFirst("pocket-".count))" : "art-game-\(g.id)"
        HStack(alignment: .top, spacing: 12) {
            if let pocketKind, ArtAsset.exists("game-pocket-\(pocketKind.rawValue)") {
                GameArtImage(asset: "game-pocket-\(pocketKind.rawValue)", size: 40)
            } else if let home {
                ModeIconView(icon: home.icon, accent: home.accent, box: 40)
            }
            VStack(alignment: .leading, spacing: 5) {
                if ArtAsset.exists(titleAsset) {
                    ArtThumbs.image(titleAsset, points: 220)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(maxWidth: 220, maxHeight: 30, alignment: .leading)
                        .accessibilityLabel(g.title)
                        .accessibilityAddTraits(.isHeader)
                } else {
                    BubbleLabel(g.title, color: htpColor(g.accent).bubbleInk, size: 16)
                        .accessibilityAddTraits(.isHeader)
                }
                ForEach(g.lines.indices, id: \.self) { i in
                    Text(g.lines[i]).font(Brand.font(14, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 8) {
                    if let gameMode, gen?.guideSlug != nil {
                        Button { sheet = .guide(gameMode, expanded: true) } label: { CandyLabel(title: "Full guide", symbol: "book.fill") }
                            .buttonStyle(QuietButtonStyle(size: .small))
                            .accessibilityLabel("Full guide: \(g.title)")
                    }
                    if let gameMode, gen?.guideSlug != nil {
                        Button { sheet = .guide(gameMode, expanded: false) } label: { CandyLabel(title: "Watch how", symbol: "play.fill") }
                            .buttonStyle(QuietButtonStyle(size: .small))
                            .accessibilityLabel("Watch how to play \(g.title)")
                    } else if let pocketKind {
                        Button { sheet = .pocket(pocketKind) } label: { CandyLabel(title: "Watch how", symbol: "play.fill") }
                            .buttonStyle(QuietButtonStyle(size: .small))
                            .accessibilityLabel("Watch how to play \(g.title)")
                    }
                }
                .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// A game in the mode guide: its 3D icon (matched by the name before " — "), the
    /// name in its color and the line.
    private func modeRow(_ m: HTPMode) -> some View {
        let name = m.name.components(separatedBy: " — ").first?.lowercased() ?? ""
        let home = (homeModes + moreModes).first { $0.title.lowercased() == name }
        return HStack(alignment: .top, spacing: 12) {
            if let home {
                ModeIconView(icon: home.icon, accent: home.accent, box: 34)
            }
            VStack(alignment: .leading, spacing: 3) {
                BubbleLabel(m.name, color: htpColor(m.accent).bubbleInk, size: 15)
                Text(m.body).font(Brand.font(14, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func bulletText(_ b: HTPBullet) -> Text {
        if let strong = b.strong {
            return Text(strong).font(Brand.font(15, .black)).foregroundColor(FinishInk.heading)
                + Text(b.text).font(Brand.font(15, .regular)).foregroundColor(FinishInk.secondary)
        }
        return Text(b.text).font(Brand.font(15, .regular)).foregroundColor(FinishInk.secondary)
    }

    private func tileRow(_ row: HTPTileRow) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(row.letters.indices, id: \.self) { i in tile(row.letters[i]) }
            }
            (Text(row.strong).font(Brand.font(14, .black)).foregroundColor(htpColor(row.strongColor))
             + Text(row.rest).font(Brand.font(14, .regular)).foregroundColor(FinishInk.secondary))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// §B1: the example letters as glossy tiles (purple right spot, gold wrong spot,
    /// slate not in the word, frosted empty).
    private func tile(_ l: HTPLetter) -> some View {
        let face: GlossyFace = {
            switch l.color {
            case "green": return .correct
            case "yellow": return .present
            case "gray": return .absent
            default: return .typed
            }
        }()
        return GlossyTile(face: face, letter: l.ch, width: 34)
            .accessibilityLabel(l.ch)
    }
}
