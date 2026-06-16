import SwiftUI
import WordociousCore

/// One mode's strategy guide (the public /guides/[slug] content, minus the
/// "Keep reading" links). Fetched from the web so the prose stays single-sourced
/// in lib/guide-content.ts.
struct ModeGuide: Decodable, Identifiable {
    let slug: String
    let title: String
    let accent: String
    let tagline: String
    let facts: [Fact]
    let rules: [String]
    let scoring: [String]
    let tips: [Tip]

    var id: String { slug }
    struct Fact: Decodable { let label: String; let value: String }
    struct Tip: Decodable { let heading: String; let body: String }

    var accentColor: Color {
        let hex = accent.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        return UInt(hex, radix: 16).map { Color(hex: $0) } ?? Theme.primary
    }
}

/// Loads + memory-caches the per-mode guides from the web JSON endpoint.
@MainActor
final class GuideService: ObservableObject {
    static let shared = GuideService()
    private init() {}

    @Published private(set) var guides: [String: ModeGuide] = [:]
    private var loaded = false

    /// GameMode → guide slug (matches lib/guide-content.ts).
    static func slug(for mode: GameMode) -> String {
        switch mode {
        case .duel: return "classic"
        case .duel6: return "six"
        case .duel7: return "seven"
        case .quordle: return "quadword"
        case .octordle: return "octoword"
        case .sequence: return "succession"
        case .rescue: return "deliverance"
        case .gauntlet: return "gauntlet"
        case .propernoundle: return "propernoundle"
        default: return "classic"
        }
    }

    func load() async {
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/guides") else { return }
        struct Payload: Decodable { let guides: [ModeGuide] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        guides = Dictionary(uniqueKeysWithValues: payload.guides.map { ($0.slug, $0) })
        loaded = true
    }

    func guide(for mode: GameMode) -> ModeGuide? { guides[Self.slug(for: mode)] }
}

/// In-game help sheet — renders one mode's guide (facts / How it works / How
/// scoring works / Strategy). Presented via `.sheet`, so it gets the native
/// drag-to-dismiss grabber + swipe-down close for free.
struct GuideSheet: View {
    let mode: GameMode
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var service = GuideService.shared

    var body: some View {
        NavigationStack {
            Group {
                if let g = service.guide(for: mode) {
                    content(g)
                } else {
                    VStack(spacing: 12) {
                        ProgressView().controlSize(.large).tint(Theme.primary)
                        Text("Loading guide…").font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        .task { await service.load() }
    }

    @ViewBuilder
    private func content(_ g: ModeGuide) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Title + tagline
                VStack(alignment: .leading, spacing: 4) {
                    Text(g.title.uppercased()).font(Brand.font(26, .black))
                        .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
                    Text(g.tagline).font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                }

                // Quick facts (2-col grid of label/value chips)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(g.facts.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(g.facts[i].label.uppercased()).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
                            Text(g.facts[i].value).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(card)
                    }
                }

                section("How it works") { paragraphs(g.rules) }
                section("How scoring works") { paragraphs(g.scoring) }
                section("Strategy") {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(g.tips.indices, id: \.self) { i in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(g.tips[i].heading).font(Brand.font(12, .black)).foregroundStyle(g.accentColor)
                                Text(g.tips[i].body).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ inner: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            inner()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16).background(card)
    }

    private func paragraphs(_ ps: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(ps.indices, id: \.self) { i in
                Text(ps[i]).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
            }
        }
    }

    private var card: some View {
        RoundedRectangle(cornerRadius: 14).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }
}
