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
    /// "The buttons" card (More Games §19): one row per on-screen control.
    var controls: [Control]? = nil

    var id: String { slug }
    struct Fact: Decodable { let label: String; let value: String }
    struct Tip: Decodable { let heading: String; let body: String }
    struct Control: Decodable { let icon: String; let label: String; let body: String }

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

    /// GameMode → guide slug — from the catalog (modes.json guideSlug), so a new
    /// game can never fall back to Classic's rules (More Games §19).
    static func slug(for mode: GameMode) -> String {
        ModeGen.byDbKey(mode.rawValue)?.guideSlug ?? mode.rawValue.lowercased()
    }

    private struct Payload: Decodable { let guides: [ModeGuide] }

    /// The guides bundled with this build (guides.generated.json, written by
    /// apps/web/scripts/gen-guides-json.ts from lib/guide-content.ts) — the
    /// in-game "?" renders immediately and never depends on production having
    /// the entry yet; the network copy replaces it when it arrives.
    private func loadBundled() {
        guard guides.isEmpty,
              let url = Bundle.main.url(forResource: "guides.generated", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        guides = Dictionary(uniqueKeysWithValues: payload.guides.map { ($0.slug, $0) })
    }

    func load() async {
        loadBundled()
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/guides") else { return }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        // Merge: the network copy wins per slug; bundled-only entries (a game
        // production has not published yet) stay.
        for g in payload.guides { guides[g.slug] = g }
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
                // "The buttons" (founder round 13): every on-screen control, with
                // the SAME icon the button carries, its label, and what it costs.
                if let controls = g.controls, !controls.isEmpty {
                    section("The buttons") {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(controls.indices, id: \.self) { i in
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: Self.symbol(controls[i].icon)).font(.system(size: 14, weight: .bold))
                                        .foregroundStyle(g.accentColor).frame(width: 28, height: 28)
                                        .background(RoundedRectangle(cornerRadius: 8).fill(g.accentColor.opacity(0.1)))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(controls[i].label).font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                                        Text(controls[i].body).font(Brand.font(12, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                                    }
                                }
                            }
                        }
                    }
                }
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

    /// lucide icon name (as written in guide-content.ts) → the SF Symbol the
    /// game's button actually carries, so the sheet shows the SAME icon.
    static func symbol(_ lucide: String) -> String {
        switch lucide {
        case "undo-2": return "arrow.uturn.backward"
        case "eraser": return "eraser"
        case "pencil": return "pencil"
        case "lightbulb": return "lightbulb"
        case "shuffle": return "shuffle"
        case "check": return "checkmark"
        case "delete": return "delete.left"
        case "eye": return "eye"
        case "corner-down-left": return "return"
        case "check-check": return "checkmark.circle"
        case "flag": return "flag"
        case "x-circle": return "xmark.circle"
        case "check-circle-2": return "checkmark.circle.fill"
        case "tag": return "tag"
        case "link-2": return "link"
        case "arrow-left-right": return "arrow.left.arrow.right"
        default: return "circle"
        }
    }
}
