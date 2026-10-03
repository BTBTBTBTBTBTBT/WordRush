import SwiftUI
import WordociousCore

// FINISH_SPEC §G5 / §K1 (phase 2, "everything else not yet touched"): the small
// shared pieces the sweep reuses across Settings, Edit profile, sign-in, the
// limit window, sheets, toasts and empty / loading states. Built only from the
// phase-1 kit (FinishKit: `.tintedCard`, `Color.wash`, `FinishInk`, `PoseImage`).
// Presentation only.

/// The sweep's accent palette (the catalog's friendly hues).
enum G5Accent {
    static let purple = Color(hex: 0x7C3AED)
    static let lilac = Color(hex: 0x8B5CF6)
    static let blue = Color(hex: 0x3B82F6)
    static let teal = Color(hex: 0x14B8A6)
    static let green = Color(hex: 0x22C55E)
    static let pink = Color(hex: 0xEC4899)
    static let gold = Color(hex: 0xF59E0B)
    static let coral = Color(hex: 0xF0435F)
    static let slate = Color(hex: 0x6B7891)

    /// A card's top bar: the accent fading to a lighter tint of itself.
    static func bar(_ accent: Color) -> [Color] { [accent, Color.white.mixed(over: accent, 0.35)] }
}

// MARK: - Section card

/// §A1 a page section: a tinted card with the game-card top bar and an optional
/// caps label inside (mockup `.card` + `.lbl`).
struct G5Card<Content: View>: View {
    var title: String?
    var accent: Color
    var bar: [Color]?
    var padding: CGFloat
    var spacing: CGFloat
    @ViewBuilder var content: () -> Content

    init(_ title: String? = nil, accent: Color = G5Accent.purple, bar: [Color]? = nil, padding: CGFloat = 14,
         spacing: CGFloat = 10, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.accent = accent
        self.bar = bar
        self.padding = padding
        self.spacing = spacing
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            if let title { FinishLabel(title) }
            content()
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedCard(accent: accent, bar: bar ?? G5Accent.bar(accent), radius: 20, barHeight: 8)
    }
}

/// A soft divider in the card's accent (no grey rules on tinted cards).
struct G5Divider: View {
    var accent: Color = G5Accent.purple
    var body: some View {
        Rectangle()
            .fill(Theme.isDark ? Theme.border : accent.wash(0.22))
            .frame(height: 1)
            .accessibilityHidden(true)
    }
}

// MARK: - Option tiles, fields

/// §A1 a selectable mini tile (theme / keyboard rows, accent + emoji pickers):
/// the 10% wash, no stroke; selected = the 30% wash + a top sheen and soft glow (BI25).
struct G5OptionChrome: ViewModifier {
    let active: Bool
    var accent: Color = G5Accent.purple
    var radius: CGFloat = 14

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let dark = Theme.isDark
        return content
            // BI25: soft filled, never outlined — selected is a deeper wash with a
            // top sheen and a soft accent glow instead of a ring.
            .background(ZStack(alignment: .top) {
                shape.fill(dark ? Theme.surface : accent.wash(active ? 0.30 : 0.10))
                if dark { shape.fill(accent.opacity(active ? 0.30 : 0.08)) }
                if active {
                    shape.fill(LinearGradient(colors: [Color.white.opacity(dark ? 0.10 : 0.45), .clear],
                                              startPoint: .top, endPoint: .center))
                }
            }
            .shadow(color: accent.opacity(active ? 0.28 : 0), radius: 6, x: 0, y: 3))
    }
}

extension View {
    /// §A1: a selectable mini tile (see `G5OptionChrome`).
    func g5Option(active: Bool, accent: Color = G5Accent.purple, radius: CGFloat = 14) -> some View {
        modifier(G5OptionChrome(active: active, accent: accent, radius: radius))
    }

    /// §A1: a text input on a soft wash of `accent` (never plain white).
    func g5Field(_ accent: Color = G5Accent.purple, error: Bool = false, radius: CGFloat = 12) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let dark = Theme.isDark
        return self
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(ZStack {
                shape.fill(dark ? Theme.background : accent.wash(0.11))
                if dark { shape.fill(accent.opacity(0.12)) }
            })
            // BI25: a soft filled field (no outline); an error tints the fill rose.
            .overlay(shape.fill(Color(hex: 0xF87171).opacity(error ? 0.16 : 0)).allowsHitTesting(false))
    }
}

/// BI25: a used in-game hint ("Vowel: A", "No vowels left") — a soft amber-filled pill,
/// never outlined (the founder's no-outlines rule overrides A8), on the small candy's
/// footprint (34 pt + its 4-pt lip) so nothing moves when a hint is spent.
struct UsedHintPill: View {
    let label: String
    var accent: Color = G5Accent.gold

    var body: some View {
        Text(label)
            .font(Brand.font(13, .black))
            .foregroundStyle(FinishInk.heading)
            .lineLimit(1).minimumScaleFactor(0.7)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity)
            .frame(height: 34)
            .background(Capsule().fill(Theme.isDark ? accent.opacity(0.22) : accent.wash(0.20)))
            .padding(.bottom, 4)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isStaticText)
    }
}

// MARK: - Notices and toasts (§K1)

/// The tone of an in-app notice (its color + a small icon).
enum G5Tone {
    case success, error, info, win, loss, warn

    var accent: Color {
        switch self {
        case .success: return G5Accent.green
        case .error: return G5Accent.coral
        case .info: return G5Accent.lilac  // §BI9: never the generic blue info look
        case .win: return G5Accent.purple
        case .loss: return G5Accent.slate
        case .warn: return G5Accent.gold
        }
    }

    var symbol: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.circle.fill"
        case .info: return "lightbulb.fill"
        case .win: return "star.circle.fill"
        case .loss: return "moon.circle.fill"
        case .warn: return "exclamationmark.triangle.fill"
        }
    }
}

/// An inline notice card (success / error / info lines inside forms and sheets):
/// a tinted rounded card in the tone's color with a small icon and dark-purple text.
struct G5Notice: View {
    let text: String
    var tone: G5Tone = .info

    init(_ text: String, tone: G5Tone = .info) {
        self.text = text
        self.tone = tone
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: tone.symbol)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(tone.accent)
                .accessibilityHidden(true)
            Text(text)
                .font(Brand.font(12, .bold))
                .foregroundStyle(FinishInk.heading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .tintedPill(tone.accent, radius: 14)
    }
}

/// §K1 / §BI9 the toast. A "+N" / "Pangram! +N" flash is a celebratory candy
/// SCORE burst (`G5ScoreBurst`); everything else is a calm candy MESSAGE: a soft
/// tinted pill with a bottom lip, a small glossy 3D coin icon (or a cast pose)
/// and dark-purple Nunito Black text. Never a generic "i". The pieces run their
/// own short entrance (transform/opacity only; Reduce Motion: a fade).
struct G5Toast: View {
    let text: String
    var tone: G5Tone = .info
    /// A small cast pose instead of the coin icon (A7: not the screen's host).
    var pose: (MascotID, String)? = nil

    var body: some View {
        switch FeedbackToast.kind(text) {
        case let .score(points, pangram, label):
            G5ScoreBurst(points: points, pangram: pangram, label: label)
        case .message:
            G5CandyMessage(text: text, tone: tone, pose: pose)
        }
    }

    /// Slide in from the top with a spring; Reduce Motion: a plain fade.
    static var transition: AnyTransition {
        Theme.reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity)
    }

    static var animation: Animation {
        Theme.reduceMotion ? .easeInOut(duration: 0.2) : .spring(response: 0.38, dampingFraction: 0.7)
    }

    /// The toast tone for a game screen message (FeedbackToast parity ×3).
    static func tone(forGameMessage message: String) -> G5Tone {
        switch FeedbackToast.tone(for: message) {
        case .win: return .win
        case .success: return .success
        case .error: return .error
        case .loss: return .loss
        case .warn: return .warn
        case .info: return .info
        }
    }

    /// A small pose that fits the tone (§K1), never `host` (§A7).
    static func pose(for tone: G5Tone, avoiding host: MascotID?) -> (MascotID, String)? {
        let picks: [(MascotID, String)]
        switch tone {
        case .error: picks = [(.o2, "gasp"), (.d, "skeptic")]
        case .win: picks = [(.o1, "cheer"), (.s, "trophy")]
        case .loss: picks = [(.r, "sit"), (.u, "tea")]
        case .success: picks = [(.i, "giggle"), (.w, "proud")]
        default: return nil
        }
        return picks.first { $0.0 != host } ?? picks.last
    }
}

// MARK: - Sheets

/// The light wash behind a sheet's content (never plain white; dark keeps its
/// background).
struct G5SheetBackground: View {
    var accent: Color = G5Accent.purple
    var body: some View {
        (Theme.isDark ? Theme.background : accent.wash(0.05)).ignoresSafeArea()
    }
}
