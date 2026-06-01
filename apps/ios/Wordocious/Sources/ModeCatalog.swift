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
}

/// The home grid, in the exact order + copy + accent colors as the web.
let homeModes: [HomeMode] = [
    HomeMode(id: "practice", title: "Classic", desc: "1 word, 6 tries", accent: Color(hex: 0x7C3AED),
             icon: .original("wordle-grid"), mode: .duel, dbKey: "DUEL"),
    HomeMode(id: "vs", title: "VS Battle", desc: "Real-time PvP", accent: Color(hex: 0x0D9488),
             icon: .asset("swords"), mode: nil, dbKey: nil),
    HomeMode(id: "quordle", title: "QuadWord", desc: "4 words at once", accent: Color(hex: 0xEC4899),
             icon: .roman("IV"), mode: .quordle, dbKey: "QUORDLE"),
    HomeMode(id: "octordle", title: "OctoWord", desc: "8 boards, 13 tries", accent: Color(hex: 0x7E22CE),
             icon: .roman("VIII"), mode: .octordle, dbKey: "OCTORDLE"),
    HomeMode(id: "sequence", title: "Succession", desc: "4 words, one by one", accent: Color(hex: 0x2563EB),
             icon: .asset("trending-up"), mode: .sequence, dbKey: "SEQUENCE"),
    HomeMode(id: "rescue", title: "Deliverance", desc: "4 prefilled boards", accent: Color(hex: 0x059669),
             icon: .asset("shield"), mode: .rescue, dbKey: "RESCUE"),
    HomeMode(id: "six", title: "Six", desc: "6 letters, 7 tries", accent: Color(hex: 0x06B6D4),
             icon: .hand("six-hand", "6"), mode: .duel6, dbKey: "DUEL_6"),
    HomeMode(id: "seven", title: "Seven", desc: "7 letters, 8 tries", accent: Color(hex: 0x84CC16),
             icon: .hand("seven-hand", "7"), mode: .duel7, dbKey: "DUEL_7"),
    HomeMode(id: "gauntlet", title: "Gauntlet", desc: "5 escalating stages", accent: Color(hex: 0xD97706),
             icon: .asset("skull"), mode: .gauntlet, dbKey: "GAUNTLET"),
    HomeMode(id: "propernoundle", title: "ProperNoundle", desc: "Guess famous names", accent: Color(hex: 0xDC2626),
             icon: .asset("crown"), mode: nil, dbKey: "PROPERNOUNDLE"),
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
            Text(text).font(Brand.font(box * (text.count > 2 ? 0.34 : 0.42), .black))
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
