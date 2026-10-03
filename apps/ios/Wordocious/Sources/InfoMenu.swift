import SwiftUI
import WordociousCore

/// The site-nav items shown in the header "?" dropdown AND the home footer link
/// row — a 1:1 parity of the web footer (How to Play, Guides, Strategy, Words,
/// FAQ, Privacy, Terms). Each presents its native screen.
///
/// "About" used to sit between Words and FAQ. It was dropped everywhere on
/// 2026-07-31: it restated How to Play in older, dryer copy, so two adjacent
/// menu rows answered the same question. The /about PAGE still exists and is
/// still served — it is only unlinked from the app's navigation.
enum InfoMenuDestination: String, Identifiable, CaseIterable {
    case howToPlay, guides, strategy, words, faq, privacy, terms
    var id: String { rawValue }

    var title: String {
        switch self {
        case .howToPlay: return "How to Play"
        case .guides:    return "Guides"
        case .strategy:  return "Strategy"
        case .words:     return "Words"
        case .faq:       return "FAQ"
        case .privacy:   return "Privacy"
        case .terms:     return "Terms"
        }
    }

    /// Short subtitle for the styled menu rows (welcoming, like the home cards).
    var subtitle: String {
        switch self {
        case .howToPlay: return "Rules, tiles & scoring"
        case .guides:    return "Strategy for every mode"
        case .strategy:  return "Solve faster, in fewer guesses"
        case .words:     return "Every Word of the Day"
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
        case .faq:       return "bubble.left.and.bubble.right.fill"
        case .privacy:   return "lock.shield.fill"
        case .terms:     return "doc.text.fill"
        }
    }

    /// Per-item accent — keeps the menu colorful + on-brand (mirrors the home
    /// mode-card accents) rather than a flat gray list.
    var accent: Color {
        switch self {
        case .howToPlay: return Color(hex: 0x7C3AED)
        case .guides:    return Color(hex: 0x3B82F6)
        case .strategy:  return Color(hex: 0xF59E0B)
        case .words:     return Color(hex: 0xEC4899)
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
    case .faq:       HelpView(initialTab: .faq, showTabs: false)
    case .guides:    GuidesIndexView()
    case .strategy:  StrategyView()
    case .words:     WordsView()
    case .privacy:   InfoPage(.privacy)
    case .terms:     InfoPage(.terms)
    }
}

// MARK: - Shared chrome (FINISH_SPEC §C6: one layout for every footer / info page)

/// The footer / info pages' shared look (FINISH_SPEC §C6, mockup finishing-touches
/// "Guides page"): back + help 3D icons, the page's OWN title art as a full-width
/// headline (every footer title the same height), an intro card, then tinted cards
/// with top bars.
enum InfoPageStyle {
    /// §C6: the seven footer titles share one height (each fits the width up to it).
    static let titleHeight: CGFloat = 64
    static let purple = Color(hex: 0x7C3AED)
    static let pink = Color(hex: 0xEC4899)
    static let gold = Color(hex: 0xF59E0B)
    static let green = Color(hex: 0x10B981)
}

/// What the scaffold's help icon opens (the How to Play page offers the FAQ, and
/// the FAQ offers How to Play).
enum MenuHelp { case none, howToPlay, faq }

/// The app's standard menu chrome (FINISH_SPEC §A3 / §A6 / §C6): the bare 3D back
/// icon on the left (back when `onBack` is set, otherwise close), the 3D help icon on
/// the right, then the page's title art as a full-width headline (no box, no float,
/// the shared footer height) — or the caps title + host when the page has no art.
struct MenuScaffold<Content: View>: View {
    let title: String
    /// The page's host beside the title (MASCOT_SPEC §6), 40 pt with an idle bob.
    var host: MascotID? = nil
    /// ART_SPEC §2: the whole-cast title art in place of the text title + host.
    var art: ArtTitleName? = nil
    var onBack: (() -> Void)? = nil
    /// Close action when the scaffold is NOT hosted in a presentation (the More Games
    /// morph panel); nil → the environment dismiss.
    var onClose: (() -> Void)? = nil
    var help: MenuHelp = .none
    @Environment(\.dismiss) private var dismiss
    @State private var helpOpen = false
    let content: () -> Content

    init(_ title: String, host: MascotID? = nil, art: ArtTitleName? = nil, onBack: (() -> Void)? = nil,
         onClose: (() -> Void)? = nil, help: MenuHelp = .none, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.host = host
        self.art = art
        self.onBack = onBack
        self.onClose = onClose
        self.help = help
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                HeaderCircleButton(.icon(.back), size: HeaderControl.tap, label: onBack != nil ? "Back" : "Close") {
                    if let onBack { onBack() } else if let onClose { onClose() } else { dismiss() }
                }
                Spacer(minLength: 0)
                if help != .none {
                    HeaderCircleButton(.icon(.help), size: HeaderControl.tap,
                                       label: help == .faq ? "Questions and answers" : "How to play") { helpOpen = true }
                }
            }
            .padding(.horizontal, 6).padding(.top, 6)
            if let art, ArtAsset.exists(art.assetName) || art != .menu {
                PageHeadline(art, bleed: 0, maxHeight: InfoPageStyle.titleHeight)
                    .padding(.bottom, 8)
            } else if art == .menu {
                // FINISH_SPEC §AS1: never a plain-text MENU — the live lettering until
                // art-title-menu ships (then the art above takes over automatically).
                LiveHeadline(text: "MENU", palette: .home, size: 34, maxLines: 1)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 16).padding(.bottom, 10)
            } else {
                PageHostTitle(text: title, host: host, size: 22, hostSize: 40)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 16).padding(.bottom, 10)
            }
            content()
        }
        .pageBackground(.home)
        .sheet(isPresented: $helpOpen) {
            Group {
                if help == .faq { HelpView(initialTab: .faq, showTabs: false) } else { HowToPlayView() }
            }
            .presentationDetents([.large])
        }
    }
}

/// §C6 the intro card at the top of every footer page: a lavender card with the
/// purple → pink top bar, a 15/900 heading and a 13/700 muted line.
struct InfoIntroCard: View {
    let heading: String
    var line: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(heading).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                .fixedSize(horizontal: false, vertical: true)
            if let line {
                Text(line).font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedCard(accent: InfoPageStyle.purple, bar: [InfoPageStyle.purple, InfoPageStyle.pink])
    }
}

extension View {
    /// §C6 a footer-page card: the accent's soft wash, its border and a solid top bar.
    func infoCard(_ accent: Color = InfoPageStyle.purple) -> some View {
        tintedCard(accent: accent, bar: [accent])
    }
}

// MARK: - Styled menu (replaces the plain system dropdown)

/// The "?" menu — a welcoming, on-brand list (color-accented icon tiles +
/// title + subtitle) instead of the flat gray system dropdown.
struct MenuSheet: View {
    @Binding var selection: InfoMenuDestination?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        MenuScaffold("Menu", host: Mascots.help, art: .menu) {
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(InfoMenuDestination.allCases) { d in
                        Button { selection = d; dismiss() } label: { row(d) }.buttonStyle(.squish)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
    }

    private func row(_ d: InfoMenuDestination) -> some View {
        HStack(spacing: 12) {
            SymbolGlyph(d.icon, size: 16, weight: .bold, color: d.accent)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 11).fill(d.accent.opacity(0.14)))
            VStack(alignment: .leading, spacing: 1) {
                Text(d.title).font(Brand.font(15, .black)).textCase(.uppercase).foregroundStyle(FinishInk.heading)
                Text(d.subtitle).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Spacer()
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).infoCard(d.accent)
    }
}

// MARK: - Guides index (one row per daily mode's guide → GuideSheet)

struct GuidesIndexView: View {
    @ObservedObject private var service = GuideService.shared
    @ObservedObject private var flags = FlagsService.shared
    @State private var selected: ModeBox?

    /// Every daily mode this viewer can see, catalog order — the sweep games
    /// first, then the More Games titles (ProperNoundle among them since Stage
    /// 9). Flag-gated titles stay out until their flag is on, so an unlaunched
    /// game's guide never leaks.
    private var modes: [GameMode] {
        ModeGen.daily
            .filter { flags.isOn($0.flagKey) }
            .compactMap { $0.dbKey.flatMap(GameMode.init(rawValue:)) }
    }

    var body: some View {
        // FINISH_SPEC §C6: Guides wears its OWN title (no longer the How to Play art).
        MenuScaffold("Guides", host: Mascots.help, art: .guides, help: .howToPlay) {
            ScrollView {
                VStack(spacing: 10) {
                    InfoIntroCard(heading: "How every game works",
                                  line: "Pick a game for its rules, tips and a worked example.")
                    ForEach(modes, id: \.self) { mode in
                        Button { selected = ModeBox(mode: mode) } label: { row(mode) }.buttonStyle(.squish)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
        .task { await service.load() }
        .sheet(item: $selected) { box in GuideSheet(mode: box.mode, startExpanded: true).presentationDetents([.large]) }
    }

    private func row(_ mode: GameMode) -> some View {
        let g = service.guide(for: mode)
        let accent = ModeStyle.accent(mode)
        return HStack(spacing: 12) {
            if let h = (homeModes + moreModes).first(where: { $0.dbKey == mode.rawValue }) {
                // ART_SPEC §3: the game's own icon on its guide row.
                ModeIconView(icon: h.icon, accent: accent, box: 40)
            } else {
                Image(systemName: "book.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(accent)
                    .frame(width: 40, height: 40).background(RoundedRectangle(cornerRadius: 11).fill(accent.opacity(0.12)))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(g?.title ?? GuideService.slug(for: mode).capitalized).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                if let tagline = g?.tagline {
                    Text(tagline).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary).lineLimit(2).multilineTextAlignment(.leading)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12).padding(.vertical, 10).frame(maxWidth: .infinity, alignment: .leading)
        // §C6: each game guide is a tinted card in that game's own color with its top bar.
        .infoCard(accent)
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
    @Published private(set) var articles: [StrategyArticleModel] = []
    /// BI24: the last fetch failed with nothing cached (the page shows R unplugged + Try again).
    @Published private(set) var failed = false
    private static let cacheKey = "strategy-cache-v1"
    private var loaded = false
    private struct Payload: Decodable { let articles: [StrategyArticleModel] }

    /// Seed from the UserDefaults cache so the screen renders instantly on
    /// every open after the first-ever fetch (ContentService pattern).
    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.cacheKey),
           let payload = try? JSONDecoder().decode(Payload.self, from: data) {
            articles = payload.articles
        }
    }

    /// Cached copy shows immediately; this refreshes it and persists the result.
    ///
    /// Same fix as HowToPlayService.load / ContentService.load: this was
    /// once-per-launch AND on the URL cache (the endpoint sends max-age=3600),
    /// so a new article on the web — the nine More Games playbooks — could stay
    /// hidden for an hour and until the next cold launch. Fetch every open and
    /// go past the URL cache; the payload is a few KB and the screen is rare.
    func load() async {
        guard let url = URL(string: "https://wordocious.com/api/strategy") else { return }
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        failed = false
        guard let (data, _) = try? await Net.api.data(for: req),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { failed = articles.isEmpty; return }
        articles = payload.articles
        loaded = true
        UserDefaults.standard.set(data, forKey: Self.cacheKey)
    }
}

struct StrategyView: View {
    @ObservedObject private var service = StrategyService.shared
    @State private var selected: StrategyArticleModel?

    /// FINISH_SPEC BI14: the index (Solve smarter + Tip of the day + game-colored tiles
    /// grouped by game) leads into a reader built like the per-game guide page
    /// (StrategyKit.swift). Loading / cache / refresh are unchanged.
    var body: some View {
        Group {
            if let a = selected {
                MenuScaffold("Strategy", host: Mascots.help, art: .strategy, onBack: { selected = nil }, help: .howToPlay) {
                    ScrollView {
                        StrategyReaderBody(article: a, all: service.articles) { selected = $0 }
                            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 28)
                            .frame(maxWidth: 560).frame(maxWidth: .infinity)
                    }
                    // A new article starts at its top.
                    .id(a.slug)
                }
            } else {
                MenuScaffold("Strategy", host: Mascots.help, art: .strategy, help: .howToPlay) { list }
            }
        }
        .task { await service.load() }
    }

    private var list: some View {
        ScrollView {
            Group {
                if service.articles.isEmpty && service.failed {
                    // BI24: never a spinner forever — R unplugged + Try again.
                    BrandEmptyState(title: "Can't reach the playbook", line: "Check your connection and I'll fetch every guide.",
                                    scene: .unplugged, actionTitle: "Try again", actionSymbol: "arrow.clockwise",
                                    action: { Task { await service.load() } })
                    .padding(.top, 24)
                } else if service.articles.isEmpty {
                    CastLoader(label: "LOADING STRATEGY", showTips: false).frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    StrategyIndexBody(articles: service.articles) { selected = $0 }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            .frame(maxWidth: 560).frame(maxWidth: .infinity)
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
    @Published private(set) var words: [WordArchiveEntry] = []
    /// BI24: the last fetch failed with nothing cached (the page shows R unplugged + Try again).
    @Published private(set) var failed = false
    private static let cacheKey = "words-cache-v1"
    private var loaded = false
    private struct Payload: Decodable { let words: [WordArchiveEntry] }

    /// Seed from the UserDefaults cache so the archive renders instantly on
    /// every open after the first-ever fetch (ContentService pattern).
    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.cacheKey),
           let payload = try? JSONDecoder().decode(Payload.self, from: data) {
            words = payload.words
        }
    }

    /// Fetch once per launch; cached copy shows immediately, this silently
    /// refreshes it in the background and persists the fresh payload.
    func load() async {
        guard !loaded else { return }
        guard let url = URL(string: "https://wordocious.com/api/words") else { return }
        failed = false
        guard let (data, _) = try? await Net.api.data(from: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { failed = words.isEmpty; return }
        words = payload.words
        loaded = true
        UserDefaults.standard.set(data, forKey: Self.cacheKey)
    }
}

struct WordsView: View {
    /// "Words" from the menu; "Past words" when opened from the Word-of-the-Day card.
    var navTitle: String = "Words"
    @ObservedObject private var service = WordsService.shared
    @State private var selected: WordArchiveEntry?

    var body: some View {
        Group {
            if let w = selected {
                MenuScaffold(w.word.uppercased(), onBack: { selected = nil }, help: .howToPlay) { WordDetailBody(entry: w) }
            } else {
                // FINISH_SPEC §C6: the Words page wears its own WORDS title art.
                MenuScaffold(navTitle, art: .words, help: .howToPlay) { list }
            }
        }
        .task { await service.load() }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                // BI17: the intro as plain type (no bordered card).
                VStack(alignment: .leading, spacing: 4) {
                    Text("EVERY WORD OF THE DAY").font(Brand.font(13, .black)).tracking(1.2)
                        .foregroundStyle(GuideFamily.ink(GuideFamily.brand))
                    Text("Every day Wordocious surfaces a Word of the Day — the shared answer thousands of players race to solve.")
                        .font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 4).padding(.bottom, 6)
                if service.words.isEmpty && service.failed {
                    // BI24: never a spinner forever — R unplugged + Try again.
                    BrandEmptyState(title: "Can't reach the word vault", line: "Check your connection and I'll bring every word back.",
                                    scene: .unplugged, actionTitle: "Try again", actionSymbol: "arrow.clockwise",
                                    action: { Task { await service.load() } })
                    .padding(.top, 12)
                } else if service.words.isEmpty {
                    CastLoader(label: "LOADING WORDS", showTips: false).frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    ForEach(service.words) { w in
                        Button { selected = w } label: { row(w) }.buttonStyle(.squish)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
        }
    }

    private func row(_ w: WordArchiveEntry) -> some View {
        HStack(spacing: 12) {
            GlossyTile(face: .correct, letter: String(w.word.prefix(1)).uppercased(), width: 40)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(w.word.uppercased()).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                Text(prettyDate(w.date)).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Spacer()
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        // BI17: a borderless soft field (no outlined row cards).
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(GuideFamily.washFill(InfoPageStyle.pink, 0.10)))
    }
}

/// Rich Word-of-the-Day detail body (used inside MenuScaffold). FINISH_SPEC BI17: the
/// guide-page family — a hero card (I's ready pose on a glow, the word in the brand
/// caps, pronunciation + part-of-speech chip), numbered senses with soft numerals, the
/// example as a highlighted line and the puzzle notes; no bordered cards.
struct WordDetailBody: View {
    let entry: WordArchiveEntry
    private var w: String { entry.word.uppercased() }
    private static let host = Color(hex: 0x4CC77A)
    private static let amber = Color(hex: 0xF59E0B)

    private var senses: [(pos: String, def: String)] {
        var out: [(String, String)] = []
        if !entry.definition.isEmpty { out.append((entry.partOfSpeech, entry.definition)) }
        out += entry.extraSenses.map { ($0.partOfSpeech, $0.definition) }
        return out
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                hero
                if !senses.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        label("Meaning")
                        ForEach(senses.indices, id: \.self) { i in senseRow(i + 1, senses[i]) }
                        if !entry.example.isEmpty {
                            GuideTakeaway(text: "\u{201C}\(entry.example)\u{201D}", accent: GuideFamily.brand)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    label("\(w) as a puzzle answer")
                    if !entry.analysisSummary.isEmpty { GuideTakeaway(text: entry.analysisSummary, accent: Self.amber) }
                    if !entry.analysisStrategy.isEmpty { GuideParagraph(text: entry.analysisStrategy) }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 28)
            .frame(maxWidth: 560).frame(maxWidth: .infinity)
        }
    }

    private var hero: some View {
        VStack(spacing: 8) {
            GuideHostHero(host: .i, accent: Self.host, height: 96)
            Text("WORD OF THE DAY \u{00B7} \(prettyDate(entry.date).uppercased())")
                .font(Brand.font(11, .black)).tracking(1.2).foregroundStyle(GuideFamily.ink(GuideFamily.brand))
                .multilineTextAlignment(.center)
            LiveHeadline(text: w, palette: .home, size: 40, maxLines: 1)
                .accessibilityLabel(w)
                .accessibilityAddTraits(.isHeader)
            if !entry.phonetic.isEmpty || !entry.partOfSpeech.isEmpty {
                HStack(spacing: 8) {
                    if !entry.phonetic.isEmpty {
                        Text(entry.phonetic).font(Brand.font(15, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    if !entry.partOfSpeech.isEmpty { GuideChip(text: entry.partOfSpeech, accent: GuideFamily.brand) }
                }
            }
        }
        .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .guideHeroCard(Self.host)
        .padding(.top, 6)
    }

    private func label(_ t: String) -> some View {
        Text(t.uppercased()).font(Brand.font(13, .black)).tracking(1.2).foregroundStyle(FinishInk.heading)
            .padding(.horizontal, 2)
            .accessibilityAddTraits(.isHeader)
    }

    private func senseRow(_ n: Int, _ s: (pos: String, def: String)) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(n)").softNumber(18, color: GuideFamily.ink(GuideFamily.brand))
                .frame(width: 34, height: 34)
                .background(Circle().fill(GuideFamily.washFill(GuideFamily.brand, 0.16)))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                if !s.pos.isEmpty {
                    Text(s.pos.uppercased()).font(Brand.font(10, .black)).tracking(1.0)
                        .foregroundStyle(GuideFamily.ink(GuideFamily.brand))
                }
                Text(s.def).font(Brand.font(16, .regular)).foregroundStyle(FinishInk.heading).lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Sense \(n). \(s.pos). \(s.def)")
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
    private let order: [InfoMenuDestination] = [.howToPlay, .guides, .strategy, .words, .faq, .privacy, .terms]

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
                    Text(d.title).font(Brand.font(11, .bold)).textCase(.uppercase).foregroundStyle(Theme.textMuted)
                }.buttonStyle(.squish)
            }
        }
    }
}
