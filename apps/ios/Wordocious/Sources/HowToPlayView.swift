import SwiftUI

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
    let outro: String?
    var id: String { title }
}
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
    /// FINISH_SPEC §W: "Take the tour" replays the first-run onboarding.
    @State private var showTour = false

    /// §C6: each section card takes the next color of the brand set.
    private static let accents: [Color] = [Color(hex: 0x7C3AED), Color(hex: 0xEC4899), Color(hex: 0xF59E0B),
                                           Color(hex: 0x3B82F6), Color(hex: 0x10B981)]

    var body: some View {
        // FINISH_SPEC BI14: the per-game guide page's language — a hero card (W's ready
        // pose on a soft glow, the heading, the tour) then numbered sections with soft
        // numerals and takeaways on soft color fields; no bordered cards. Help opens the FAQ.
        MenuScaffold("How to Play", host: Mascots.help, art: .howto, help: .faq) {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    hero

                    if service.sections.isEmpty {
                        CastLoader(showTips: false).frame(maxWidth: .infinity).padding(.top, 20)
                    } else {
                        ForEach(Array(service.sections.enumerated()), id: \.element.id) { i, sec in
                            section(i + 1, sec, accent: Self.accents[i % Self.accents.count])
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 28)
                .frame(maxWidth: 560).frame(maxWidth: .infinity)
            }
        }
        .task { await service.load() }
        .fullScreenCover(isPresented: $showTour) {
            OnboardingView(replay: true) { play in
                showTour = false
                // "Play today's Classic": once the tour is down, close How to Play
                // and open the Classic daily from the tab root.
                if play { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { Onboarding.playClassic() } }
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            GuideHostHero(host: .w, accent: GuideFamily.brand)
            Text("How Wordocious works").font(Brand.font(22, .black)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            Text("Everything you need to know to get started").font(Brand.font(14, .bold))
                .foregroundStyle(FinishInk.secondary).multilineTextAlignment(.center)
            // §W: replay the three-card first-run tour.
            Button { showTour = true } label: { CandyLabel(title: "Take the tour", symbol: "sparkles") }
                .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium, fullWidth: false))
                .padding(.top, 4)
        }
        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .guideHeroCard(GuideFamily.brand)
        .padding(.top, 6)
    }

    @ViewBuilder
    private func section(_ n: Int, _ s: HTPSection, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            GuideSectionHead(number: n, title: s.title, accent: accent)

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
                Text(heading).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading).padding(.top, 2)
            }
            if let tiles = s.tiles {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(tiles.indices, id: \.self) { i in tileRow(tiles[i]) }
                }
            }

            if let modes = s.modes {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(modes.indices, id: \.self) { i in modeRow(modes[i]) }
                }
            }

            if let outro = s.outro { GuideParagraph(text: outro) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 2)
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
                Text(m.name).font(Brand.font(14, .black)).foregroundStyle(htpColor(m.accent))
                    .fixedSize(horizontal: false, vertical: true)
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
