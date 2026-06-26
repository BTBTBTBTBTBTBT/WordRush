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
    private init() {}
    @Published private(set) var sections: [HTPSection] = []
    private var loaded = false

    func load() async {
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/howtoplay") else { return }
        struct Payload: Decodable { let sections: [HTPSection] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        sections = payload.sections
        loaded = true
    }
}

/// Parse a "#rrggbb" string into a Color (falls back to the brand purple).
func htpColor(_ hex: String) -> Color {
    let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    return UInt(h, radix: 16).map { Color(hex: $0) } ?? Color(hex: 0x7C3AED)
}

struct HowToPlayView: View {
    @ObservedObject private var service = HowToPlayService.shared

    private var card: some View {
        RoundedRectangle(cornerRadius: 16).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    var body: some View {
        MenuScaffold("How to Play") {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Everything you need to know to get started")
                        .font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)

                    if service.sections.isEmpty {
                        ProgressView().controlSize(.large).tint(Theme.primary).frame(maxWidth: .infinity).padding(.top, 40)
                    } else {
                        ForEach(service.sections) { section(_: $0) }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
        .task { await service.load() }
    }

    @ViewBuilder
    private func section(_ s: HTPSection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(s.title).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)

            if let intro = s.intro {
                Text(intro).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
            }

            if let bullets = s.bullets {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(bullets.indices, id: \.self) { i in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("•").font(Brand.font(12, .black)).foregroundStyle(Theme.primary)
                            bulletText(bullets[i])
                        }
                    }
                }
            }

            if let heading = s.tilesHeading {
                Text(heading).font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary).padding(.top, 2)
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
                            Text(modes[i].body).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                        }
                    }
                }
            }

            if let outro = s.outro {
                Text(outro).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2).padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(card)
    }

    private func bulletText(_ b: HTPBullet) -> Text {
        if let strong = b.strong {
            return Text(strong).font(Brand.font(12, .black)).foregroundColor(Theme.textPrimary)
                + Text(b.text).font(Brand.font(12, .regular)).foregroundColor(Theme.textSecondary)
        }
        return Text(b.text).font(Brand.font(12, .regular)).foregroundColor(Theme.textSecondary)
    }

    private func tileRow(_ row: HTPTileRow) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(row.letters.indices, id: \.self) { i in tile(row.letters[i]) }
            }
            (Text(row.strong).font(Brand.font(12, .black)).foregroundColor(htpColor(row.strongColor))
             + Text(row.rest).font(Brand.font(12, .regular)).foregroundColor(Theme.textSecondary))
        }
    }

    private func tile(_ l: HTPLetter) -> some View {
        let filled = l.color != "empty"
        let fill: Color = {
            switch l.color {
            case "green": return Color(hex: 0x7C3AED)
            case "yellow": return Color(hex: 0xF59E0B)
            case "gray": return Color(hex: 0x64748B)
            default: return Theme.surface
            }
        }()
        let border: Color = filled ? fill : Theme.border
        return Text(l.ch).font(Brand.font(13, .black)).foregroundStyle(filled ? .white : Theme.textPrimary)
            .frame(width: 34, height: 34)
            .background(RoundedRectangle(cornerRadius: 5).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(border, lineWidth: 2))
    }
}
