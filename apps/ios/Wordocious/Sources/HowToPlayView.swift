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
        // FINISH_SPEC §C6: back + help icons, the HOW TO PLAY headline, the intro card,
        // then tinted section cards with top bars. Help here opens the FAQ.
        MenuScaffold("How to Play", host: Mascots.help, art: .howto, help: .faq) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    InfoIntroCard(heading: "How Wordocious works",
                                  line: "Everything you need to know to get started")

                    // §W: replay the three-card first-run tour.
                    Button { showTour = true } label: { CandyLabel(title: "Take the tour", symbol: "sparkles") }
                        .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium, fullWidth: false))
                        .frame(maxWidth: .infinity)

                    if service.sections.isEmpty {
                        CastLoader(showTips: false).frame(maxWidth: .infinity).padding(.top, 40)
                    } else {
                        ForEach(Array(service.sections.enumerated()), id: \.element.id) { i, sec in
                            section(sec, accent: Self.accents[i % Self.accents.count])
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
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

    @ViewBuilder
    private func section(_ s: HTPSection, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(s.title).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)

            if let intro = s.intro {
                Text(intro).font(Brand.font(12, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(2)
            }

            if let bullets = s.bullets {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(bullets.indices, id: \.self) { i in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("•").font(Brand.font(12, .black)).foregroundStyle(accent)
                            bulletText(bullets[i])
                        }
                    }
                }
            }

            if let heading = s.tilesHeading {
                Text(heading).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading).padding(.top, 2)
            }
            if let tiles = s.tiles {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(tiles.indices, id: \.self) { i in tileRow(tiles[i]) }
                }
            }

            if let modes = s.modes {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(modes.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(modes[i].name).font(Brand.font(12, .black)).foregroundStyle(htpColor(modes[i].accent))
                            Text(modes[i].body).font(Brand.font(12, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(2)
                        }
                    }
                }
            }

            if let outro = s.outro {
                Text(outro).font(Brand.font(12, .regular)).foregroundStyle(FinishInk.secondary).lineSpacing(2).padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(16).infoCard(accent)
    }

    private func bulletText(_ b: HTPBullet) -> Text {
        if let strong = b.strong {
            return Text(strong).font(Brand.font(12, .black)).foregroundColor(FinishInk.heading)
                + Text(b.text).font(Brand.font(12, .regular)).foregroundColor(FinishInk.secondary)
        }
        return Text(b.text).font(Brand.font(12, .regular)).foregroundColor(FinishInk.secondary)
    }

    private func tileRow(_ row: HTPTileRow) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(row.letters.indices, id: \.self) { i in tile(row.letters[i]) }
            }
            (Text(row.strong).font(Brand.font(12, .black)).foregroundColor(htpColor(row.strongColor))
             + Text(row.rest).font(Brand.font(12, .regular)).foregroundColor(FinishInk.secondary))
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
