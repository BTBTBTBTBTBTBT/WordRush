import SwiftUI
import WordociousCore

/// Icon rendering kind per mode, mirroring app/page.tsx MODE_CARDS.
enum ModeIconKind {
    case asset(String)          // template SVG, tinted by accent (lucide)
    case original(String)       // colored SVG, rendered as-is
    case roman(String)          // "IV" / "VIII"
    case hand(String, String)   // hand SVG asset + number digit
    case symbol(String)         // SF Symbol, tinted by accent (More Games titles)
}

struct HomeMode: Identifiable {
    let id: String
    let title: String
    let desc: String
    let accent: Color
    let icon: ModeIconKind
    /// Engine mode if playable through the shared GameScreen; nil = own view
    /// (VS, ProperNoundle, every More Games title) or no engine at all (More tile).
    let mode: GameMode?
    /// daily_results.game_mode key for the completed-today lookup.
    let dbKey: String?
    /// Catalog facts the cards and pickers read (More Games Stage 5).
    let sweep: Bool
    let dailyEligible: Bool
    let category: String?
    let guessSemantics: String
    let guessBase: Int
    /// Remote gate (app_flags key); nil = never gated. Filter lists with FlagsService.isOn.
    let flagKey: String?
    /// Full-width tile UNDER the grid (More Games band, VS Battle live tile), not a grid cell.
    let homeWide: Bool

    /// Title/desc/accent/dbKey come from the single-source catalog (modes.json →
    /// ModeCatalog.generated.swift); only icon + engine mode stay native here.
    init(gen g: GenMode, icon: ModeIconKind, mode: GameMode?) {
        self.id = g.id
        self.title = g.title
        self.desc = g.desc
        self.accent = g.accent
        self.icon = icon
        self.mode = mode
        self.dbKey = g.dbKey
        self.sweep = g.sweep
        self.dailyEligible = g.dailyEligible
        self.category = g.category
        self.guessSemantics = g.guessSemantics
        self.guessBase = g.guessBase
        self.flagKey = g.flagKey
        self.homeWide = g.homeWide
    }

    init(genId: String, icon: ModeIconKind, mode: GameMode?) {
        self.init(gen: ModeGen.byId(genId)!, icon: icon, mode: mode)
    }
}

/// Per-mode icon + engine chrome (native; keyed by catalog id). Order, copy and
/// accent come from ModeGen; a catalog record without a row here gets a plain
/// glyph so a new game can never render blank. The More Games titles have their
/// chrome already so a game cannot land without an icon.
private let modeChrome: [String: (icon: ModeIconKind, mode: GameMode?)] = [
    "practice":      (.original("wordle-grid"),       .duel),
    "vs":            (.asset("swords"),               nil),
    "quordle":       (.roman("IV"),                   .quordle),
    "octordle":      (.roman("VIII"),                 .octordle),
    "sequence":      (.asset("trending-up"),          .sequence),
    "rescue":        (.asset("shield"),               .rescue),
    "six":           (.hand("six-hand", "6"),         .duel6),
    "seven":         (.hand("seven-hand", "7"),       .duel7),
    "gauntlet":      (.asset("skull"),                .gauntlet),
    "propernoundle": (.asset("crown"),                nil),
    "more":          (.symbol("square.grid.2x2"),     nil),
    "sudoku":        (.symbol("grid"),                nil),
    "scramble":      (.symbol("shuffle"),             nil),
    "hub":           (.symbol("hexagon"),             nil),
    "crossword":     (.symbol("quote.opening"),       nil),
    "groups":        (.symbol("rectangle.3.group"),   nil),
    "ladder":        (.symbol("stairs"),              nil),
    "cryptogram":    (.symbol("key"),                 nil),
    "wordsearch":    (.symbol("text.magnifyingglass"), nil),
    "regions":       (.symbol("star"),                nil),
]

private func homeMode(_ g: GenMode) -> HomeMode {
    let c = modeChrome[g.id]
    return HomeMode(gen: g, icon: c?.icon ?? .roman(g.glyph ?? String(g.title.prefix(1))), mode: c?.mode)
}

/// The home grid — every enabled core tile, catalog order.
let homeModes: [HomeMode] = ModeGen.core.map(homeMode)
/// The More Games sheet — every enabled More Games title, catalog order.
let moreModes: [HomeMode] = ModeGen.more.map(homeMode)

/// The sheet's sections (catalog moreCategories order, non-empty only); an
/// uncategorised title falls into a trailing "Other" section. Mirrors
/// apps/web/lib/more-games.ts moreSections().
struct MoreSection: Identifiable { let key: String; let title: String; let modes: [HomeMode]; var id: String { key } }
func moreSections(_ modes: [HomeMode] = moreModes) -> [MoreSection] {
    var sections = ModeGen.moreCategories.map { c in MoreSection(key: c.key, title: c.title, modes: modes.filter { $0.category == c.key }) }
    let known = Set(ModeGen.moreCategories.map(\.key))
    let other = modes.filter { $0.category == nil || !known.contains($0.category!) }
    if !other.isEmpty { sections.append(MoreSection(key: "other", title: "Other", modes: other)) }
    return sections.filter { !$0.modes.isEmpty }
}

/// "N of M played" over the More Games dailies — the More tile's Daily subtitle.
func morePlayedText(completedKeys: Set<String>, modes: [HomeMode] = moreModes) -> String {
    let daily = modes.filter { $0.dailyEligible && $0.dbKey != nil }
    let played = daily.filter { completedKeys.contains($0.dbKey!) }.count
    return "\(played) of \(daily.count) played"
}

/// The More Games dailies — what "N of M played" and the More Games Sweep count over.
func moreDailyModes(_ modes: [HomeMode] = moreModes) -> [HomeMode] {
    modes.filter { $0.dailyEligible && $0.dbKey != nil }
}

/// More Games Sweep / Flawless (founder, 2026-09-26): a purely visual tier from
/// today's completions — every More Games daily played = .sweep, every one won =
/// .flawless. It never touches the Daily Sweep (no bonus, XP, leaderboard, dots).
/// Mirrors apps/web/lib/more-games.ts moreSweepTier().
enum MoreSweepTier { case sweep, flawless
    var title: String { self == .flawless ? "FLAWLESS MORE GAMES!" : "MORE GAMES SWEEP!" }
    var short: String { self == .flawless ? "Flawless More Games" : "More Games Sweep" }
}
func moreSweepTier(byMode: [String: DailyCompletion], modes: [HomeMode] = moreModes) -> MoreSweepTier? {
    let daily = moreDailyModes(modes)
    guard !daily.isEmpty else { return nil }
    let rows = daily.map { byMode[$0.dbKey!] }
    guard rows.allSatisfy({ $0 != nil }) else { return nil }
    return rows.allSatisfy({ $0!.completed }) ? .flawless : .sweep
}
struct MoreTotals { var completed = 0, won = 0, total = 0; var totalTimeSeconds = 0.0, totalScore = 0.0 }
func moreTotals(byMode: [String: DailyCompletion], modes: [HomeMode] = moreModes) -> MoreTotals {
    var t = MoreTotals(); let daily = moreDailyModes(modes); t.total = daily.count
    for m in daily { guard let c = byMode[m.dbKey!] else { continue }
        t.completed += 1; if c.completed { t.won += 1 }; t.totalTimeSeconds += c.timeSeconds; t.totalScore += c.score }
    return t
}

/// Renders a mode's icon inside a rounded accent-tinted square (matches web).
struct ModeIconView: View {
    let icon: ModeIconKind
    let accent: Color
    var box: CGFloat = 40

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: box * 0.27)
                .fill(accent.opacity(0.08))
                .frame(width: box, height: box)
            glyph
        }
    }

    @ViewBuilder
    private var glyph: some View {
        switch icon {
        case .asset(let name):
            Image(name).renderingMode(.template).resizable().scaledToFit()
                .frame(width: box * 0.5, height: box * 0.5).foregroundStyle(accent)
        case .original(let name):
            Image(name).resizable().scaledToFit()
                .frame(width: box * 0.5, height: box * 0.55)
        case .roman(let text):
            // Help screen (box 32) uses a fixed 11pt for both IV/VIII like web;
            // other call sites keep proportional scaling.
            Text(text).font(Brand.font(box == 32 ? 11 : box * (text.count > 2 ? 0.34 : 0.42), .black))
                .foregroundStyle(accent)
        case .hand(let name, let number):
            ZStack(alignment: .center) {
                Image(name).resizable().scaledToFit()
                    .frame(width: box * 0.6, height: box * 0.62)
                Text(number).font(Brand.font(box * 0.3, .black)).foregroundStyle(accent)
                    .offset(y: box * 0.12)
            }
        case .symbol(let name):
            Image(systemName: name).font(.system(size: box * 0.45, weight: .bold))
                .foregroundStyle(accent)
        }
    }
}
