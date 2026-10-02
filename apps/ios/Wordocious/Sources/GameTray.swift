import SwiftUI

/// FINISH_SPEC §L: every board container is ONE shared game tray, drawn in code —
/// rounded 20–22 pt, a soft wash of the game's accent (10–12% over white, never
/// plain white), a 1.5-pt accent border (30%), a 4-pt darker lip at the bottom, a
/// faint inner top gloss, a soft accent drop shadow and 10–12 pt inner padding.
/// The active / zoomed mini board gets a stronger tint + an accent ring; a solved
/// board takes a gentle purple (won) or slate (lost) wash. No black grid lines on
/// any board: seams inside a tray use `GameTray.seam(accent)`.
enum GameTrayState: Equatable {
    case normal
    /// The active / zoomed board of a multi-board game.
    case active
    case won
    case lost
}

enum GameTray {
    static let radius: CGFloat = 21
    static let padding: CGFloat = 11
    static let lip: CGFloat = 4

    /// The tray's face wash for a state.
    static func face(_ accent: Color, _ state: GameTrayState, lightOnly: Bool = false) -> Color {
        if Theme.isDark && !lightOnly {
            switch state {
            case .won: return Color(hex: 0x7C3AED).opacity(0.16)
            case .lost: return Color(hex: 0x6B7891).opacity(0.18)
            case .active: return accent.opacity(0.16)
            case .normal: return accent.opacity(0.09)
            }
        }
        switch state {
        case .won: return Color(hex: 0x7C3AED).wash(0.13)
        case .lost: return Color(hex: 0x6B7891).wash(0.14)
        case .active: return accent.wash(0.17)
        case .normal: return accent.wash(0.11)
        }
    }

    /// The tint every color reads from (won → purple, lost → slate).
    static func ink(_ accent: Color, _ state: GameTrayState) -> Color {
        switch state {
        case .won: return Color(hex: 0x7C3AED)
        case .lost: return Color(hex: 0x6B7891)
        default: return accent
        }
    }

    /// A soft darker seam in the tray's color (Sudoku box lines, crossword / region
    /// seams) — never black.
    static func seam(_ accent: Color, strong: Bool = false) -> Color {
        Theme.isDark ? accent.opacity(strong ? 0.55 : 0.30) : accent.wash(strong ? 0.52 : 0.32)
    }
}

/// The tray chrome (see `GameTray`).
struct GameTrayChrome: ViewModifier {
    let accent: Color
    var state: GameTrayState = .normal
    var radius: CGFloat = GameTray.radius
    var padding: CGFloat = GameTray.padding
    /// Light-only pages (VS, Friends): keep the light tray in dark mode.
    var lightOnly: Bool = false

    func body(content: Content) -> some View {
        let dark = Theme.isDark && !lightOnly
        let ink = GameTray.ink(accent, state)
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return content
            .padding(padding)
            .background {
                ZStack(alignment: .top) {
                    // The darker lip showing under the face.
                    shape.fill(dark ? Color.black.opacity(0.35) : ink.wash(0.34))
                        .offset(y: GameTray.lip)
                    shape.fill(dark ? Theme.surface : Color.white)
                    shape.fill(GameTray.face(accent, state, lightOnly: lightOnly))
                    // The faint inner top gloss.
                    shape.fill(LinearGradient(colors: [Color.white.opacity(dark ? 0.06 : 0.55), Color.white.opacity(0)],
                                              startPoint: .top, endPoint: .center))
                        .padding(2)
                        .allowsHitTesting(false)
                    shape.strokeBorder(dark ? ink.opacity(state == .normal ? 0.35 : 0.6) : ink.wash(state == .normal ? 0.30 : 0.55),
                                       lineWidth: 1.5)
                }
                .shadow(color: ink.opacity(dark ? 0.0 : 0.16), radius: 9, x: 0, y: 6)
            }
            .overlay {
                if state == .active {
                    shape.inset(by: -3).stroke(ink.opacity(0.28), lineWidth: 3).allowsHitTesting(false)
                }
            }
            .padding(.bottom, GameTray.lip)
    }
}

extension View {
    /// §L: sit this board on the shared game tray in `accent` (won / lost / active states).
    func gameTray(accent: Color, state: GameTrayState = .normal, radius: CGFloat = GameTray.radius,
                  padding: CGFloat = GameTray.padding, lightOnly: Bool = false) -> some View {
        modifier(GameTrayChrome(accent: accent, state: state, radius: radius, padding: padding, lightOnly: lightOnly))
    }
}
