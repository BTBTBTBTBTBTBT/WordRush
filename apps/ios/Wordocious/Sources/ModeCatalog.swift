import SwiftUI
import WordociousCore

/// Icon rendering kind per mode, mirroring app/page.tsx MODE_CARDS.
enum ModeIconKind {
    case asset(String)          // template SVG, tinted by accent (lucide)
    case original(String)       // colored SVG, rendered as-is
    case roman(String)          // "IV" / "VIII"
    case hand(String, String)   // hand SVG asset + number digit
}

struct HomeMode: Identifiable {
    let id: String
    let title: String
    let desc: String
    let accent: Color
    let icon: ModeIconKind
    /// Engine mode if playable on iOS today; nil = coming soon (VS, ProperNoundle).
    let mode: GameMode?
    /// daily_results.game_mode key for the completed-today lookup.
    let dbKey: String?

    /// Title/desc/accent/dbKey come from the single-source catalog (modes.json →
    /// ModeCatalog.generated.swift); only icon + engine mode stay native here.
    init(genId: String, icon: ModeIconKind, mode: GameMode?) {
        let g = ModeGen.byId(genId)!
        self.id = g.id
        self.title = g.title
        self.desc = g.desc
        self.accent = g.accent
        self.icon = icon
        self.mode = mode
        self.dbKey = g.dbKey
    }
}

/// The home grid; order + copy + accent come from ModeGen, icons stay native.
let homeModes: [HomeMode] = [
    HomeMode(genId: "practice",      icon: .original("wordle-grid"),    mode: .duel),
    HomeMode(genId: "vs",            icon: .asset("swords"),            mode: nil),
    HomeMode(genId: "quordle",       icon: .roman("IV"),                mode: .quordle),
    HomeMode(genId: "octordle",      icon: .roman("VIII"),              mode: .octordle),
    HomeMode(genId: "sequence",      icon: .asset("trending-up"),       mode: .sequence),
    HomeMode(genId: "rescue",        icon: .asset("shield"),            mode: .rescue),
    HomeMode(genId: "six",           icon: .hand("six-hand", "6"),      mode: .duel6),
    HomeMode(genId: "seven",         icon: .hand("seven-hand", "7"),    mode: .duel7),
    HomeMode(genId: "gauntlet",      icon: .asset("skull"),             mode: .gauntlet),
    HomeMode(genId: "propernoundle", icon: .asset("crown"),             mode: nil),
]

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
        }
    }
}
