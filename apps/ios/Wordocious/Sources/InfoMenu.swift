import SwiftUI
import WordociousCore

/// The site-nav items shown in the header "?" dropdown AND the home footer link
/// row — a 1:1 parity of the web footer (How to Play, Guides, Strategy, Words,
/// About, FAQ, Privacy, Terms). Each presents its native screen.
enum InfoMenuDestination: String, Identifiable, CaseIterable {
    case howToPlay, guides, strategy, words, about, faq, privacy, terms
    var id: String { rawValue }

    var title: String {
        switch self {
        case .howToPlay: return "How to Play"
        case .guides:    return "Guides"
        case .strategy:  return "Strategy"
        case .words:     return "Words"
        case .about:     return "About"
        case .faq:       return "FAQ"
        case .privacy:   return "Privacy"
        case .terms:     return "Terms"
        }
    }

    /// Short subtitle for the styled menu rows (welcoming, like the home cards).
    var subtitle: String {
        switch self {
        case .howToPlay: return "Rules, tiles & scoring"
        case .guides:    return "Strategy for all 9 modes"
        case .strategy:  return "Solve faster, in fewer guesses"
        case .words:     return "Every Word of the Day"
        case .about:     return "What is Wordocious?"
        case .faq:       return "Common questions"
        case .privacy:   return "How we handle your data"
        case .terms:     return "Terms of service"
        }
    }

    var icon: String {
        switch self {
        case .howToPlay: return "questionmark.circle.fill"
        case .guides:    return "book.fill"
        case .strategy:  return "lightbulb.fill"
        case .words:     return "calendar"
        case .about:     return "info.circle.fill"
        case .faq:       return "bubble.left.and.bubble.right.fill"
        case .privacy:   return "lock.shield.fill"
        case .terms:     return "doc.text.fill"
        }
    }

    /// Per-item accent — keeps the menu colourful + on-brand (mirrors the home
    /// mode-card accents) rather than a flat grey list.
    var accent: Color {
        switch self {
        case .howToPlay: return Color(hex: 0x7C3AED)
        case .guides:    return Color(hex: 0x3B82F6)
        case .strategy:  return Color(hex: 0xF59E0B)
        case .words:     return Color(hex: 0xEC4899)
        case .about:     return Color(hex: 0x14B8A6)
        case .faq:       return Color(hex: 0x8B5CF6)
        case .privacy:   return Color(hex: 0x10B981)
        case .terms:     return Color(hex: 0x6B7280)
        }
    }
}

/// The screen each menu item presents.
@ViewBuilder
func infoMenuDestinationView(_ dest: InfoMenuDestination) -> some View {
    switch dest {
    case .howToPlay: HowToPlayView()
    case .faq:       HelpView(initialTab: .faq)
    case .guides:    GuidesIndexView()
    case .strategy:  StrategyView()
    case .words:     WordsView()
    case .about:     InfoSheet(.about)
    case .privacy:   InfoSheet(.privacy)
    case .terms:     InfoSheet(.terms)
    }
}

// MARK: - Shared chrome (matches HelpView / GuideSheet)

/// The app's standard menu chrome: a 6pt purple→pink→amber accent bar, a
/// wordmark-gradient title, an optional back chevron, and a Close button.
struct MenuScaffold<Content: View>: View {
    let title: String
    var onBack: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    let content: () -> Content

    init(_ title: String, onBack: (() -> Void)? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.onBack = onBack
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                           startPoint: .leading, endPoint: .trailing)
                .frame(height: 6)
            HStack(spacing: 10) {
                if let onBack {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left").font(.system(size: 16, weight: .black)).foregroundStyle(Theme.textMuted)
                    }
                }
                Text(title).font(Brand.font(22, .black)).foregroundStyle(Theme.wordmarkGradient).lineLimit(1)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 14, weight: .black)).foregroundStyle(Theme.textMuted)
                        .frame(width: 30, height: 30).background(Circle().fill(Theme.surfaceAlt))
                }
            }
            .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 10)
            content()
        }
        .background(Theme.background.ignoresSafeArea())
    }
}

private var infoCard: some View {
    RoundedRectangle(cornerRadius: 16).fill(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
}

/// Wraps a pushed `InfoPage` (which sets its own navigationTitle) so it presents
/// cleanly as a sheet. About/Privacy/Terms already match the app aesthetic.
private struct InfoSheet: View {
    let kind: InfoKind
    @Environment(\.dismiss) private var dismiss
    init(_ kind: InfoKind) { self.kind = kind }
    var body: some View {
        NavigationStack {
            InfoPage(kind)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }
}

// MARK: - Styled menu (replaces the plain system dropdown)

/// The "?" menu — a welcoming, on-brand list (colour-accented icon tiles +
/// title + subtitle) instead of the flat grey system dropdown.
struct MenuSheet: View {
    @Binding var selection: InfoMenuDestination?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        MenuScaffold("Menu") {
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(InfoMenuDestination.allCases) { d in
                        Button { selection = d; dismiss() } label: { row(d) }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
    }

    private func row(_ d: InfoMenuDestination) -> some View {
        HStack(spacing: 12) {
            Image(systemName: d.icon).font(.system(size: 16, weight: .bold)).foregroundStyle(d.accent)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 11).fill(d.accent.opacity(0.14)))
            VStack(alignment: .leading, spacing: 1) {
                Text(d.title).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                Text(d.subtitle).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).background(infoCard)
    }
}

// MARK: - Guides index (list the 9 mode guides → GuideSheet)

struct GuidesIndexView: View {
    @ObservedObject private var service = GuideService.shared
    @State private var selected: ModeBox?

    private let modes: [GameMode] = [.duel, .duel6, .duel7, .quordle, .octordle, .sequence, .rescue, .gauntlet, .propernoundle]

    var body: some View {
        MenuScaffold("Guides") {
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(modes, id: \.self) { mode in
                        Button { selected = ModeBox(mode: mode) } label: { row(mode) }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
        .task { await service.load() }
        .sheet(item: $selected) { box in GuideSheet(mode: box.mode).presentationDetents([.large]) }
    }

    private func row(_ mode: GameMode) -> some View {
        let g = service.guide(for: mode)
        let accent = ModeStyle.accent(mode)
        return HStack(spacing: 12) {
            Image(systemName: "book.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(accent)
                .frame(width: 40, height: 40).background(RoundedRectangle(cornerRadius: 11).fill(accent.opacity(0.14)))
            VStack(alignment: .leading, spacing: 2) {
                Text(g?.title ?? GuideService.slug(for: mode).capitalized).font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                if let tagline = g?.tagline {
                    Text(tagline).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).lineLimit(2).multilineTextAlignment(.leading)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).background(infoCard)
    }

    struct ModeBox: Identifiable { let mode: GameMode; var id: Int { mode.hashValue } }
}

// MARK: - Strategy

struct StrategyArticleModel: Decodable, Identifiable {
    let slug: String
    let title: String
    let dek: String
    let minutes: Int
    let sections: [Section]
    var id: String { slug }
    struct Section: Decodable { let heading: String; let body: [String] }
}

@MainActor
final class StrategyService: ObservableObject {
    static let shared = StrategyService()
    private init() {}
    @Published private(set) var articles: [StrategyArticleModel] = []
    private var loaded = false

    func load() async {
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/strategy") else { return }
        struct Payload: Decodable { let articles: [StrategyArticleModel] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        articles = payload.articles
        loaded = true
    }
}

struct StrategyView: View {
    @ObservedObject private var service = StrategyService.shared
    @State private var selected: StrategyArticleModel?

    var body: some View {
        Group {
            if let a = selected {
                MenuScaffold(a.title, onBack: { selected = nil }) { articleBody(a) }
            } else {
                MenuScaffold("Strategy") { list }
            }
        }
        .task { await service.load() }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Practical, original strategy for solving daily word puzzles faster and in fewer guesses.")
                    .font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                if service.articles.isEmpty {
                    ProgressView().controlSize(.large).tint(Theme.primary).frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    ForEach(service.articles) { a in
                        Button { selected = a } label: { card(a) }.buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
        }
    }

    private func card(_ a: StrategyArticleModel) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "lightbulb.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: 0xF59E0B))
                .frame(width: 40, height: 40).background(RoundedRectangle(cornerRadius: 11).fill(Color(hex: 0xF59E0B).opacity(0.14)))
            VStack(alignment: .leading, spacing: 3) {
                Text("\(a.minutes) MIN READ").font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Color(hex: 0xF59E0B))
                Text(a.title).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary).multilineTextAlignment(.leading)
                Text(a.dek).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).background(infoCard)
    }

    private func articleBody(_ a: StrategyArticleModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("STRATEGY · \(a.minutes) MIN READ").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Color(hex: 0xF59E0B))
                Text(a.dek).font(Brand.font(15, .heavy)).foregroundStyle(Theme.textPrimary).lineSpacing(2)
                ForEach(a.sections.indices, id: \.self) { i in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2).fill(Color(hex: 0xF59E0B)).frame(width: 4, height: 16)
                            Text(a.sections[i].heading).font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                        }
                        ForEach(a.sections[i].body.indices, id: \.self) { j in
                            Text(a.sections[i].body[j]).font(Brand.font(13, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(3)
                        }
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(infoCard)
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
        }
    }
}

// MARK: - Words (Word of the Day archive)

struct WordArchiveEntry: Decodable, Identifiable {
    let date: String
    let word: String
    let phonetic: String
    let partOfSpeech: String
    let definition: String
    let example: String
    let extraSenses: [Sense]
    let analysisSummary: String
    let analysisStrategy: String
    var id: String { date }
    struct Sense: Decodable { let partOfSpeech: String; let definition: String }
}

@MainActor
final class WordsService: ObservableObject {
    static let shared = WordsService()
    private init() {}
    @Published private(set) var words: [WordArchiveEntry] = []
    private var loaded = false

    func load() async {
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/words") else { return }
        struct Payload: Decodable { let words: [WordArchiveEntry] }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        words = payload.words
        loaded = true
    }
}

struct WordsView: View {
    @ObservedObject private var service = WordsService.shared
    @State private var selected: WordArchiveEntry?

    var body: some View {
        Group {
            if let w = selected {
                MenuScaffold(w.word.uppercased(), onBack: { selected = nil }) { WordDetailBody(entry: w) }
            } else {
                MenuScaffold("Words") { list }
            }
        }
        .task { await service.load() }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Every day Wordocious surfaces a Word of the Day — the shared answer thousands of players race to solve.")
                    .font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                if service.words.isEmpty {
                    ProgressView().controlSize(.large).tint(Theme.primary).frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    ForEach(service.words) { w in
                        Button { selected = w } label: { row(w) }.buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
        }
    }

    private func row(_ w: WordArchiveEntry) -> some View {
        HStack(spacing: 12) {
            Text(String(w.word.prefix(1)).uppercased()).font(Brand.font(16, .black)).foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 10).fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            VStack(alignment: .leading, spacing: 2) {
                Text(w.word.uppercased()).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                Text(prettyDate(w.date)).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).background(infoCard)
    }
}

/// Rich Word-of-the-Day detail body (used inside MenuScaffold).
struct WordDetailBody: View {
    let entry: WordArchiveEntry
    private var w: String { entry.word.uppercased() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Hero band — gradient tiles on a soft tinted panel.
                VStack(spacing: 10) {
                    Text("WORD OF THE DAY · \(prettyDate(entry.date))").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(.white.opacity(0.9))
                    HStack(spacing: 6) {
                        ForEach(Array(w).indices, id: \.self) { i in
                            Text(String(Array(w)[i])).font(Brand.font(20, .black)).foregroundStyle(Color(hex: 0x6D28D9))
                                .frame(width: 40, height: 40)
                                .background(RoundedRectangle(cornerRadius: 8).fill(.white))
                        }
                    }
                    if !entry.phonetic.isEmpty || !entry.partOfSpeech.isEmpty {
                        HStack(spacing: 8) {
                            if !entry.phonetic.isEmpty { Text(entry.phonetic).font(Brand.font(12, .bold)).foregroundStyle(.white.opacity(0.95)) }
                            if !entry.partOfSpeech.isEmpty { Text(entry.partOfSpeech).font(Brand.font(11, .heavy)).italic().foregroundStyle(.white) }
                        }
                    }
                }
                .padding(.vertical, 18).frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 18).fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .topLeading, endPoint: .bottomTrailing)))

                if !entry.definition.isEmpty {
                    sectionCard("Meaning", icon: "book.fill", tint: Color(hex: 0x7C3AED)) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.definition).font(Brand.font(13, .regular)).foregroundStyle(Theme.textPrimary).lineSpacing(2)
                            if !entry.example.isEmpty {
                                Text("“\(entry.example)”").font(Brand.font(12, .regular)).italic().foregroundStyle(Theme.textMuted)
                            }
                            ForEach(entry.extraSenses.indices, id: \.self) { i in
                                (Text(entry.extraSenses[i].partOfSpeech + " ").font(Brand.font(12, .bold)).foregroundColor(Theme.primary)
                                 + Text(entry.extraSenses[i].definition).font(Brand.font(12, .regular)).foregroundColor(Theme.textMuted))
                            }
                        }
                    }
                }
                sectionCard("\(w) as a puzzle answer", icon: "lightbulb.fill", tint: Color(hex: 0xF59E0B)) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(entry.analysisSummary).font(Brand.font(13, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                        Text(entry.analysisStrategy).font(Brand.font(13, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
        }
    }

    private func sectionCard<C: View>(_ title: String, icon: String, tint: Color, @ViewBuilder _ inner: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(tint)
                    .frame(width: 26, height: 26).background(RoundedRectangle(cornerRadius: 8).fill(tint.opacity(0.14)))
                Text(title.uppercased()).font(Brand.font(12, .black)).tracking(0.4).foregroundStyle(Theme.textPrimary)
            }
            inner()
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(infoCard)
    }
}

// MARK: - Shared date formatting (UTC, matches the web archive)

func prettyDate(_ key: String) -> String {
    let inFmt = DateFormatter()
    inFmt.dateFormat = "yyyy-MM-dd"; inFmt.timeZone = TimeZone(identifier: "UTC")
    guard let d = inFmt.date(from: key) else { return key }
    let out = DateFormatter()
    out.dateFormat = "MMM d, yyyy"; out.timeZone = TimeZone(identifier: "UTC")
    return out.string(from: d)
}

// MARK: - Home footer link row (parity of the web footer)

struct InfoFooterLinks: View {
    @State private var dest: InfoMenuDestination?
    private let order: [InfoMenuDestination] = [.howToPlay, .guides, .strategy, .words, .about, .faq, .privacy, .terms]

    var body: some View {
        let half = (order.count + 1) / 2
        VStack(spacing: 8) {
            line(Array(order.prefix(half)))
            line(Array(order.suffix(order.count - half)))
        }
        .padding(.vertical, 12)
        .sheet(item: $dest) { infoMenuDestinationView($0).presentationDetents([.large]) }
    }

    private func line(_ row: [InfoMenuDestination]) -> some View {
        HStack(spacing: 14) {
            ForEach(row) { d in
                Button { dest = d } label: {
                    Text(d.title).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                }.buttonStyle(.plain)
            }
        }
    }
}
