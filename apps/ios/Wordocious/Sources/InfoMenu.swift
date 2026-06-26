import SwiftUI
import WordociousCore

/// The site-nav items shown in the header "?" dropdown AND the home footer link
/// row — a 1:1 parity of the web footer (How to Play, Guides, Strategy, Words,
/// About, FAQ, Privacy, Terms). Each presents its native screen as a sheet.
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

    var icon: String {
        switch self {
        case .howToPlay: return "questionmark.circle"
        case .guides:    return "book"
        case .strategy:  return "lightbulb"
        case .words:     return "calendar"
        case .about:     return "info.circle"
        case .faq:       return "bubble.left.and.bubble.right"
        case .privacy:   return "lock.shield"
        case .terms:     return "doc.text"
        }
    }
}

/// The screen each menu item presents. Used by both the header dropdown and the
/// home footer so the destinations are defined once.
@ViewBuilder
func infoMenuDestinationView(_ dest: InfoMenuDestination) -> some View {
    switch dest {
    case .howToPlay: HelpView(initialTab: .howToPlay)
    case .faq:       HelpView(initialTab: .faq)
    case .guides:    GuidesIndexView()
    case .strategy:  StrategyView()
    case .words:     WordsView()
    case .about:     InfoSheet(.about)
    case .privacy:   InfoSheet(.privacy)
    case .terms:     InfoSheet(.terms)
    }
}

/// Wraps a pushed `InfoPage` so it can be presented as a sheet (nav bar + Done).
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

// MARK: - Shared card style

private var infoCard: some View {
    RoundedRectangle(cornerRadius: 14).fill(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
}

// MARK: - Guides index (list the 9 mode guides → GuideSheet)

struct GuidesIndexView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var service = GuideService.shared
    @State private var selected: GameMode?

    private let modes: [GameMode] = [.duel, .duel6, .duel7, .quordle, .octordle, .sequence, .rescue, .gauntlet, .propernoundle]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(modes, id: \.self) { mode in
                        Button { selected = mode } label: { row(mode) }.buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Guides")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        .task { await service.load() }
        .sheet(item: Binding(get: { selected.map { ModeBox(mode: $0) } }, set: { selected = $0?.mode })) { box in
            GuideSheet(mode: box.mode).presentationDetents([.large])
        }
    }

    private func row(_ mode: GameMode) -> some View {
        let g = service.guide(for: mode)
        return HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(g?.title ?? GuideService.slug(for: mode).capitalized).font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                if let tagline = g?.tagline {
                    Text(tagline).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).lineLimit(2).multilineTextAlignment(.leading)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(infoCard)
    }

    private struct ModeBox: Identifiable { let mode: GameMode; var id: Int { mode.hashValue } }
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
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var service = StrategyService.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Practical, original strategy for solving daily word puzzles faster and in fewer guesses.")
                        .font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                    if service.articles.isEmpty {
                        ProgressView().controlSize(.large).tint(Theme.primary).frame(maxWidth: .infinity).padding(.top, 40)
                    } else {
                        ForEach(service.articles) { a in
                            NavigationLink { StrategyArticleView(article: a) } label: { card(a) }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Strategy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        .task { await service.load() }
    }

    private func card(_ a: StrategyArticleModel) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(a.minutes) MIN READ").font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Theme.primary)
            Text(a.title).font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary).multilineTextAlignment(.leading)
            Text(a.dek).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(infoCard)
    }
}

struct StrategyArticleView: View {
    let article: StrategyArticleModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("STRATEGY · \(article.minutes) MIN READ").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.primary)
                    Text(article.title).font(Brand.font(24, .black)).foregroundStyle(Theme.textPrimary)
                    Text(article.dek).font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                }
                ForEach(article.sections.indices, id: \.self) { i in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(article.sections[i].heading).font(Brand.font(17, .black)).foregroundStyle(Theme.textPrimary)
                        ForEach(article.sections[i].body.indices, id: \.self) { j in
                            Text(article.sections[i].body[j]).font(Brand.font(13, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(3)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("").navigationBarTitleDisplayMode(.inline)
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
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var service = WordsService.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Every day Wordocious surfaces a Word of the Day — the shared answer thousands of players race to solve.")
                        .font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                    if service.words.isEmpty {
                        ProgressView().controlSize(.large).tint(Theme.primary).frame(maxWidth: .infinity).padding(.top, 40)
                    } else {
                        ForEach(service.words) { w in
                            NavigationLink { WordDetailView(entry: w) } label: { row(w) }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Words")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        .task { await service.load() }
    }

    private func row(_ w: WordArchiveEntry) -> some View {
        HStack(spacing: 12) {
            Text(String(w.word.prefix(1)).uppercased()).font(Brand.font(15, .black)).foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 8).fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
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

struct WordDetailView: View {
    let entry: WordArchiveEntry
    private var w: String { entry.word.uppercased() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("WORD OF THE DAY · \(prettyDate(entry.date))").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                // Tiles
                HStack(spacing: 6) {
                    ForEach(Array(w).indices, id: \.self) { i in
                        Text(String(Array(w)[i])).font(Brand.font(20, .black)).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(RoundedRectangle(cornerRadius: 6).fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(w).font(Brand.font(30, .black)).foregroundStyle(Theme.textPrimary)
                    HStack(spacing: 8) {
                        if !entry.phonetic.isEmpty { Text(entry.phonetic).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted) }
                        if !entry.partOfSpeech.isEmpty { Text(entry.partOfSpeech).font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary) }
                    }
                }
                if !entry.definition.isEmpty {
                    card("Meaning") {
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
                card("\(w) as a word-puzzle answer") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(entry.analysisSummary).font(Brand.font(13, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                        Text(entry.analysisStrategy).font(Brand.font(13, .regular)).foregroundStyle(Theme.textSecondary).lineSpacing(2)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("").navigationBarTitleDisplayMode(.inline)
    }

    private func card<C: View>(_ title: String, @ViewBuilder _ inner: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(Brand.font(12, .black)).tracking(0.4).foregroundStyle(Theme.textPrimary)
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
        FlexibleLinkRow(items: order) { dest = $0 }
            .sheet(item: $dest) { infoMenuDestinationView($0) }
    }
}

/// A centered, wrapping row of text links (web footer parity).
private struct FlexibleLinkRow: View {
    let items: [InfoMenuDestination]
    let onTap: (InfoMenuDestination) -> Void
    var body: some View {
        // Two centered rows keeps it tidy without a full flow-layout dependency.
        let half = (items.count + 1) / 2
        VStack(spacing: 8) {
            line(Array(items.prefix(half)))
            line(Array(items.suffix(items.count - half)))
        }
        .padding(.vertical, 12)
    }
    private func line(_ row: [InfoMenuDestination]) -> some View {
        HStack(spacing: 14) {
            ForEach(row) { d in
                Button { onTap(d) } label: {
                    Text(d.title).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                }.buttonStyle(.plain)
            }
        }
    }
}
