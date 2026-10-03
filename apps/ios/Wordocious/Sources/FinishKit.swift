import SwiftUI
import UIKit
import WordociousCore

// The finishing build's shared parts (docs/FINISH_SPEC.md, founder-approved
// 2026-10-02; visual reference docs/design/brand/mockups/game-kit.html and
// finishing-touches.html). ONE kit for iOS so every screen draws the same pieces:
//   §A1 tinted surfaces (`Color.wash`, `.tintedCard`, `TintPill`)
//   §A2 soft numbers (`.softNumber`)
//   §A3 the squish press (`SquishButtonStyle`)
//   §A8 glossy candy buttons (`CandyButtonStyle`, `CandyLabel`, `OutlinedText`)
//   §B1 the glossy tile (`GlossyTile`), §B2 key caps (`KeyCap`, `DeleteKeyIcon`)
//   §B3 the motion kit (`TileMotion`, `KeyframeEffect`, `NudgeEffect`)
//   the art-pose helper (`ArtPose`, `PoseImage`).
// Presentation only. Reduce Motion (the OS setting or the in-app toggle) turns
// every motion here into an instant change.

// MARK: - Theme helpers

extension Theme {
    /// The dark theme is on (it keeps its existing dark surfaces — §A1).
    static var isDark: Bool { ThemeManager.shared.theme == "dark" }
}

extension Color {
    /// `self` at `amount` composited over `base` (opaque result) — CSS
    /// `color-mix(in srgb, self amount, base)`.
    func mixed(over base: Color, _ amount: Double) -> Color {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        guard UIColor(self).getRed(&r1, green: &g1, blue: &b1, alpha: &a1),
              UIColor(base).getRed(&r2, green: &g2, blue: &b2, alpha: &a2) else { return self }
        let k = CGFloat(min(1, max(0, amount)))
        return Color(red: Double(r2 + (r1 - r2) * k), green: Double(g2 + (g1 - g2) * k), blue: Double(b2 + (b1 - b2) * k))
    }

    /// §A1 the soft wash: `self` at `amount` over white (cards ~8%, icon tiles /
    /// pills 12–14%; borders 30–35%).
    func wash(_ amount: Double) -> Color { mixed(over: .white, amount) }
}

/// The finishing build's fixed inks (the mockups' palette).
enum FinishInk {
    /// Soft numbers, typed letters, key letters: dark purple.
    static let softNumber = Color(hex: 0x3B1A78)
    static let softNumberDark = Color(hex: 0xE9DDFF)
    /// Card headings on tinted cards.
    static let title = Color(hex: 0x2A1650)
    static let muted = Color(hex: 0x6F5F8F)
    /// The lavender page card (purple top bar) — mockup `--tint:#f5eeff;--tline:#e2d3ff`.
    static let lavender = Color(hex: 0xF5EEFF)
    static let lavenderLine = Color(hex: 0xE2D3FF)
    static let purple = Color(hex: 0x7C3AED)
    static let deepPurple = Color(hex: 0x6D28D9)

    static var number: Color { Theme.isDark ? softNumberDark : softNumber }
    static var heading: Color { Theme.isDark ? Theme.textPrimary : title }
    static var secondary: Color { Theme.isDark ? Theme.textSecondary : muted }
}

// MARK: - §A2 Soft numbers

/// Every big number: Nunito Black, dark purple, tabular digits, a soft white
/// text-shadow on light backgrounds (dark: light lilac with a dark shadow). Never
/// the gradient / gold digit art.
struct SoftNumberStyle: ViewModifier {
    let size: CGFloat
    var color: Color? = nil

    func body(content: Content) -> some View {
        let dark = Theme.isDark
        return content
            .font(Brand.font(size, .black))
            .monospacedDigit()
            .foregroundStyle(color ?? FinishInk.number)
            .shadow(color: dark ? .black.opacity(0.4) : .white.opacity(0.8), radius: 0, x: 0, y: 1)
            .shadow(color: (dark ? Color.black : Color(hex: 0x4C1D95)).opacity(dark ? 0.35 : 0.18),
                    radius: max(2, size * 0.12), x: 0, y: max(1, size * 0.08))
    }
}

extension View {
    /// §A2: style a number as a soft number at `size` pt.
    func softNumber(_ size: CGFloat, color: Color? = nil) -> some View {
        modifier(SoftNumberStyle(size: size, color: color))
    }
}

// MARK: - §A3 / §A9 The squish

/// FINISH_SPEC §A9: everything tappable squishes — the ONE spongy press for every
/// button, icon button, chip, segmented option, game tile, card and list row:
/// scale down on touch-down (~.92; header icons .86 × .80), then a bouncy spring
/// back past 1 (~1.05) that settles (≈260 ms) on release. Reduce Motion: off.
/// Applied app-wide as `.buttonStyle(.squish)` (`.squishIcon` for bare 3D icons).
struct SquishButtonStyle: ButtonStyle {
    var squash: CGSize = CGSize(width: 0.92, height: 0.92)

    func makeBody(configuration: Configuration) -> some View {
        SquishBody(configuration: configuration, squash: squash)
    }

    /// FINISH_SPEC §A9 / §AK: the press is STATE-driven so it always shows — a quick
    /// tap inside a ScrollView flips `isPressed` on and off almost at once (the scroll
    /// view delays touches), which used to swallow the squash entirely. Touch-down
    /// squashes (and slightly darkens, the lip compressing); release waits until the
    /// squash has been visible for ~90 ms, then springs back past 1 (≈1.02) and settles.
    /// Reading `configuration.isPressed` (no DragGesture) keeps scrolling intact; a
    /// scroll cancels the press silently.
    private struct SquishBody: View {
        let configuration: Configuration
        let squash: CGSize
        @Environment(\.accessibilityReduceMotion) private var envReduce
        @State private var down = false
        @State private var pressedAt: TimeInterval = 0

        var body: some View {
            let still = envReduce || Theme.reduceMotion
            configuration.label
                .scaleEffect(x: down ? squash.width : 1, y: down ? squash.height : 1)
                .brightness(down ? -0.035 : 0)
                // §U: press · soft on touch-down, release on let-go.
                .onChange(of: configuration.isPressed) { pressed in
                    Feedback.press(pressed)
                    guard !still else { return }
                    let now = ProcessInfo.processInfo.systemUptime
                    if pressed {
                        pressedAt = now
                        withAnimation(.easeOut(duration: 0.08)) { down = true }
                    } else {
                        let wait = max(0, 0.09 - (now - pressedAt))
                        DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.45)) { down = false }
                        }
                    }
                }
        }
    }
}

extension ButtonStyle where Self == SquishButtonStyle {
    /// §A9: the shared spongy press (~.92).
    static var squish: SquishButtonStyle { SquishButtonStyle() }
    /// §A3: header icons squash harder (.86 × .80).
    static var squishIcon: SquishButtonStyle { SquishButtonStyle(squash: CGSize(width: 0.86, height: 0.80)) }
    /// §AK: big game cards / tiles press to 0.95.
    static var squishCard: SquishButtonStyle { SquishButtonStyle(squash: CGSize(width: 0.95, height: 0.95)) }
}

// MARK: - §A8 Glossy candy buttons

/// FINISH_SPEC §A8 (founder-approved ChatGPT design, docs/design/brand/buttons/):
/// ONE glossy candy style for every action button — a pill (or circle) filled with
/// a vertical 2-stop gradient in its color, a thin GOLD outline just inside the
/// edge, a thick darker bottom lip (the gradient's bottom color darkened ~35%) plus
/// a soft drop shadow, a glossy white highlight across the top half, and a white
/// Nunito Black label (and optional leading icon) with a dark-purple outline.
/// Press = squish (scale .92, the lip compresses) with the spring back.
struct CandyButtonStyle: ButtonStyle {
    enum Variant {
        /// Primary: purple #a66bff → #6d28d9.
        case purple
        /// Secondary: pink → purple #f472b6 → #a21caf.
        case pink
        /// Amber #ffc56b → #f97316.
        case amber
        /// Teal #5eead4 → #0d9488.
        case teal
        /// Quiet actions: soft peach #ffd6c2 → #fbb38f with dark-purple text.
        case peach

        var top: Color {
            switch self {
            case .purple: return Color(hex: 0xA66BFF)
            case .pink: return Color(hex: 0xF472B6)
            case .amber: return Color(hex: 0xFFC56B)
            case .teal: return Color(hex: 0x5EEAD4)
            case .peach: return Color(hex: 0xFFD6C2)
            }
        }

        var bottom: Color {
            switch self {
            case .purple: return Color(hex: 0x6D28D9)
            case .pink: return Color(hex: 0xA21CAF)
            case .amber: return Color(hex: 0xF97316)
            case .teal: return Color(hex: 0x0D9488)
            case .peach: return Color(hex: 0xFBB38F)
            }
        }

        /// The lip: the bottom color darkened ~35%.
        var lip: Color { Color.black.mixed(over: bottom, 0.35) }
        /// Quiet (peach) buttons carry dark-purple text without the outline.
        var quiet: Bool { self == .peach }
    }

    enum Size {
        /// A full-width primary action (52 pt).
        case large
        /// A medium pill (the Leaderboard play card, 42 pt).
        case medium
        /// A small pill / round button (34 pt, 1-pt outline).
        case small

        var height: CGFloat {
            switch self {
            case .large: return 52
            case .medium: return 42
            case .small: return 34
            }
        }
        var fontSize: CGFloat {
            switch self {
            case .large: return 17
            case .medium: return 15
            case .small: return 13
            }
        }
        var lip: CGFloat { self == .small ? 4 : 5 }
        var outline: CGFloat { self == .small ? 1 : 2 }
    }

    var variant: Variant = .purple
    var size: Size = .large
    /// Fill the offered width (pill) or hug the label.
    var fullWidth: Bool = true
    /// A circle (icon-only round buttons) instead of a pill.
    var circle: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        CandyBody(configuration: configuration, style: self)
    }

    private struct CandyBody: View {
        let configuration: Configuration
        let style: CandyButtonStyle
        @Environment(\.accessibilityReduceMotion) private var envReduce
        @Environment(\.isEnabled) private var enabled

        var body: some View {
            let still = envReduce || Theme.reduceMotion
            let pressed = configuration.isPressed
            let v = style.variant, sz = style.size
            let h = sz.height
            let lip = pressed ? sz.lip * 0.4 : sz.lip
            let shape = Capsule(style: .continuous)
            configuration.label
                .environment(\.candyInk, CandyInk(quiet: v.quiet, size: sz.fontSize))
                .font(Brand.font(sz.fontSize, .black))
                .padding(.horizontal, style.circle ? 0 : (sz == .small ? 14 : 20))
                .frame(maxWidth: style.fullWidth && !style.circle ? .infinity : nil)
                .frame(width: style.circle ? h : nil, height: h)
                .background {
                    ZStack(alignment: .top) {
                        shape.fill(LinearGradient(colors: [v.top, v.bottom], startPoint: .top, endPoint: .bottom))
                        // The gloss across the top half, inset from the edges.
                        shape.fill(LinearGradient(colors: [Color.white.opacity(0.45), Color.white.opacity(0)],
                                                  startPoint: .top, endPoint: .bottom))
                            .frame(height: h * 0.5)
                            .padding(.horizontal, style.circle ? h * 0.16 : h * 0.3)
                            .padding(.top, 3)
                        shape.strokeBorder(Color(hex: 0xF5C542), lineWidth: sz.outline)
                    }
                }
                .background(shape.fill(v.lip).offset(y: lip))
                .shadow(color: Color(hex: 0x3B1A78).opacity(0.22), radius: 6, x: 0, y: lip + 3)
                .offset(y: pressed ? sz.lip - lip : 0)
                .padding(.bottom, sz.lip)
                .scaleEffect(pressed && !still ? 0.92 : 1)
                .opacity(enabled ? 1 : 0.55)
                .animation(still ? nil : (pressed ? .easeOut(duration: 0.08)
                                          : .spring(response: 0.26, dampingFraction: 0.45)),
                           value: pressed)
                // §U: press · soft on touch-down, release on let-go.
                .onChange(of: configuration.isPressed) { Feedback.press($0) }
        }
    }
}

/// The ink a candy label draws with (set by `CandyButtonStyle`).
struct CandyInk: Equatable {
    var quiet: Bool = false
    var size: CGFloat = 17
}

private struct CandyInkKey: EnvironmentKey {
    static let defaultValue = CandyInk()
}

extension EnvironmentValues {
    var candyInk: CandyInk {
        get { self[CandyInkKey.self] }
        set { self[CandyInkKey.self] = newValue }
    }
}

/// White text with a 1.5–2 pt dark-purple (#3b1a78) outline and a soft shadow —
/// drawn as eight offset copies of the text under the white face.
struct OutlinedText: View {
    let text: String
    var size: CGFloat
    var fill: Color = .white
    var outline: Color = Color(hex: 0x3B1A78)
    var width: CGFloat = 1.75

    var body: some View {
        let label = Text(text).font(Brand.font(size, .black))
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) * .pi / 4
                label.foregroundStyle(outline)
                    .offset(x: CGFloat(cos(a)) * width, y: CGFloat(sin(a)) * width)
            }
            label.foregroundStyle(fill)
        }
        .lineLimit(1)
        .shadow(color: Color(hex: 0x3B1A78).opacity(0.35), radius: 1.5, x: 0, y: 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }
}

/// An SF Symbol in the same white-with-outline treatment (▶ play, eye, arrow).
struct OutlinedSymbol: View {
    let name: String
    var size: CGFloat
    var fill: Color = .white
    var outline: Color = Color(hex: 0x3B1A78)
    var width: CGFloat = 1.75

    var body: some View {
        let img = Image(systemName: name).font(.system(size: size, weight: .black))
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) * .pi / 4
                img.foregroundStyle(outline)
                    .offset(x: CGFloat(cos(a)) * width, y: CGFloat(sin(a)) * width)
            }
            img.foregroundStyle(fill)
        }
        .shadow(color: Color(hex: 0x3B1A78).opacity(0.35), radius: 1.5, x: 0, y: 2)
        .accessibilityHidden(true)
    }
}

/// A candy button's label: an optional leading icon (an SF Symbol in the outlined
/// treatment, or any view such as a 3D / game icon) and the caps title. Quiet
/// (peach) buttons draw dark-purple text with no outline.
struct CandyLabel<Icon: View>: View {
    let title: String
    var symbol: String? = nil
    /// Founder 10-02: an optional small second line under the title (the share candy's
    /// "Next Classic in 3h 12m"), inside the button's own height — never a taller button.
    var subtitle: String? = nil
    @ViewBuilder var icon: () -> Icon
    @Environment(\.candyInk) private var ink

    var body: some View {
        if let subtitle {
            HStack(spacing: 6) {
                icon()
                VStack(spacing: 1) {
                    titleText(size: ink.size - 2)
                    if ink.quiet {
                        Text(subtitle).font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.softNumber)
                            .lineLimit(1).minimumScaleFactor(0.75)
                    } else {
                        OutlinedText(text: subtitle, size: 10, width: 1)
                            .minimumScaleFactor(0.75)
                    }
                }
            }
        } else {
            oneLine
        }
    }

    @ViewBuilder private func titleText(size: CGFloat) -> some View {
        if ink.quiet {
            Text(title.uppercased()).font(Brand.font(size, .black)).foregroundStyle(FinishInk.softNumber)
                .lineLimit(1).minimumScaleFactor(0.7)
                .accessibilityLabel(title)
        } else {
            OutlinedText(text: title.uppercased(), size: size, width: size < 14 ? 1.25 : 1.75)
                .minimumScaleFactor(0.7)
                .accessibilityLabel(title)
        }
    }

    private var oneLine: some View {
        HStack(spacing: 8) {
            if let symbol {
                if ink.quiet {
                    Image(systemName: symbol).font(.system(size: ink.size * 0.9, weight: .black))
                        .foregroundStyle(FinishInk.softNumber).accessibilityHidden(true)
                } else {
                    OutlinedSymbol(name: symbol, size: ink.size * 0.9, width: ink.size < 14 ? 1.25 : 1.75)
                }
            }
            icon()
            if ink.quiet {
                Text(title.uppercased()).font(Brand.font(ink.size, .black)).foregroundStyle(FinishInk.softNumber)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .accessibilityLabel(title)
            } else {
                OutlinedText(text: title.uppercased(), size: ink.size, width: ink.size < 14 ? 1.25 : 1.75)
                    .minimumScaleFactor(0.7)
                    .accessibilityLabel(title)
            }
        }
    }
}

extension CandyLabel where Icon == EmptyView {
    init(title: String, symbol: String? = nil) {
        self.init(title: title, symbol: symbol) { EmptyView() }
    }
}

// MARK: - §A1 Tinted cards and pills

/// A page card with no plain white: a soft wash of its accent, a 1.5-pt accent
/// border and (optionally) the game card's top bar. Dark mode keeps the dark
/// surface with a faint accent wash.
struct TintedCard: ViewModifier {
    let accent: Color
    /// The top bar's colors (left → right); nil = no bar.
    var bar: [Color]? = nil
    var radius: CGFloat = 20
    var barHeight: CGFloat = 10
    /// The wash and border strengths (mockup page cards ≈ 7% / 22%).
    var tint: Double = 0.08
    var line: Double = 0.24

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let dark = Theme.isDark
        return VStack(spacing: 0) {
            if let bar {
                LinearGradient(colors: bar.count > 1 ? bar : [bar.first ?? accent, bar.first ?? accent],
                               startPoint: .leading, endPoint: .trailing)
                    .frame(height: barHeight)
            }
            content
        }
        .background(ZStack {
            shape.fill(dark ? Theme.surface : accent.wash(tint))
            if dark { shape.fill(accent.opacity(0.08)) }
        })
        .clipShape(shape)
        .overlay(shape.stroke(dark ? accent.opacity(0.35) : accent.wash(line), lineWidth: 1.5))
        // §AQ2: the soft shadow is cast by ONE plain shape under the card, not by the
        // whole card's content (a content shadow re-rasterizes every text run and
        // icon in an offscreen pass each frame while a list scrolls).
        .background(shape.fill(dark ? Theme.surface : accent.wash(tint))
            .shadow(color: Color(hex: 0x3C1E6E).opacity(0.10), radius: 10, x: 0, y: 8))
    }
}

extension View {
    /// §A1: wrap in a tinted page card (soft accent wash + border + optional top bar).
    func tintedCard(accent: Color, bar: [Color]? = nil, radius: CGFloat = 20, barHeight: CGFloat = 10,
                    tint: Double = 0.08, line: Double = 0.24) -> some View {
        modifier(TintedCard(accent: accent, bar: bar, radius: radius, barHeight: barHeight, tint: tint, line: line))
    }

    /// §A1 pills / chips / small tiles: the 12% wash, a 30% border and the 4-pt
    /// inset accent bar along the top.
    func tintedPill(_ accent: Color, radius: CGFloat? = nil) -> some View {
        modifier(TintedPillChrome(accent: accent, radius: radius))
    }
}

private struct TintedPillChrome: ViewModifier {
    let accent: Color
    let radius: CGFloat?

    func body(content: Content) -> some View {
        let dark = Theme.isDark
        return content
            .background(GeometryReader { g in
                let r = radius ?? g.size.height / 2
                let shape = RoundedRectangle(cornerRadius: r, style: .continuous)
                ZStack(alignment: .top) {
                    shape.fill(dark ? Theme.surface : accent.wash(0.12))
                    if dark { shape.fill(accent.opacity(0.10)) }
                    accent.frame(height: 4).allowsHitTesting(false)
                }
                .clipShape(shape)
                .overlay(shape.stroke(dark ? accent.opacity(0.4) : accent.wash(0.30), lineWidth: 1.5))
                .shadow(color: accent.opacity(0.12), radius: 5, x: 0, y: 3)
            })
    }
}

/// The finished screen's result pill: a 3D icon, a soft number and a small label
/// on a tinted pill (purple guesses, blue time).
struct TintPill: View {
    let icon: Icon3DName
    let value: String
    let label: String
    let accent: Color

    var body: some View {
        HStack(spacing: 6) {
            Icon3D(icon, size: 24)
            Text(value).softNumber(17)
            Text(label).font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
        }
        .padding(.leading, 7).padding(.trailing, 12).padding(.vertical, 6)
        .tintedPill(accent)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(label)")
    }
}

// MARK: - Art poses

/// The cast pose art (`art-pose-<character>-<pose>`, 62 image sets): pick a pose
/// by character + pose name.
enum ArtPose {
    static func assetName(_ id: MascotID, _ pose: String) -> String { "art-pose-\(id.rawValue)-\(pose)" }
    static func exists(_ id: MascotID, _ pose: String) -> Bool { ArtAsset.exists(assetName(id, pose)) }
}

/// One pose image at `height` pt (width from the art's aspect), decorative. Falls
/// back to the character's hero image when the pose doesn't ship.
struct PoseImage: View {
    let id: MascotID
    let pose: String
    var height: CGFloat

    init(_ id: MascotID, _ pose: String, height: CGFloat) {
        self.id = id
        self.pose = pose
        self.height = height
    }

    var body: some View {
        let name = ArtPose.assetName(id, pose)
        Group {
            if ArtAsset.exists(name) {
                Image(name).resizable().interpolation(.high).scaledToFit().frame(height: height)
            } else {
                Image(id.assetName).resizable().interpolation(.high).scaledToFit().frame(width: height, height: height)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - §B1 The glossy tile

/// The game kit's tile faces (ART_SPEC §20 recipe, game-kit.html `.tile`).
enum GlossyFace: Equatable {
    /// Frosted glass: white ~55% over the wallpaper with a faint lilac border.
    case empty
    /// White face, purple border, dark purple letter.
    case typed
    case correct, present, absent
    /// Sudoku's given clue: a plain light tile with a dark purple digit.
    case given
    /// Sudoku's conflicting entry.
    case conflict
    /// A hint-used ghost (Six / Seven): frosted with a faint letter.
    case hintUsed
    /// Not a word: the typed tile with a red ring and red letters.
    case bad
    /// FINISH_SPEC BI6 Sudocious: every other cell holding the selected digit — a
    /// medium lavender face with a deep purple digit (secondary to the selected cell).
    case sudokuSame
    /// BI6: a given / an empty cell in the selected cell's row, column or box — a pale
    /// lavender tint, lighter than `sudokuSame`.
    case sudokuWashGiven, sudokuWashEmpty
}

/// The palette for one colored state: light (gradient top), base (70%), bottom,
/// edge (the thick lip).
struct TilePalette {
    let light: Color, base: Color, bottom: Color, edge: Color

    static let purple = TilePalette(light: Color(hex: 0xA66BFF), base: Color(hex: 0x7C3AED),
                                    bottom: Color(hex: 0x6A2BD6), edge: Color(hex: 0x4C1D95))
    static let gold = TilePalette(light: Color(hex: 0xFFD166), base: Color(hex: 0xF5A524),
                                  bottom: Color(hex: 0xE8901A), edge: Color(hex: 0xB0650B))
    static let slate = TilePalette(light: Color(hex: 0x8D99B0), base: Color(hex: 0x6B7891),
                                   bottom: Color(hex: 0x5D6981), edge: Color(hex: 0x3F4A5E))
    static let red = TilePalette(light: Color(hex: 0xFF8A9B), base: Color(hex: 0xF0435F),
                                 bottom: Color(hex: 0xD9324E), edge: Color(hex: 0xB4233C))

    /// Derived from any base (colorblind palette, custom accents).
    static func from(_ base: Color) -> TilePalette {
        TilePalette(light: Color.white.mixed(over: base, 0.32), base: base,
                    bottom: Color.black.mixed(over: base, 0.10), edge: Color.black.mixed(over: base, 0.38))
    }

    /// Right spot (purple; the colorblind palette's orange when that's on).
    static var correct: TilePalette { ThemeManager.shared.colorblind ? from(Theme.correct) : purple }
    /// Wrong spot (gold; colorblind blue).
    static var present: TilePalette { ThemeManager.shared.colorblind ? from(Theme.present) : gold }
    static var absent: TilePalette { slate }

    var faceGradient: LinearGradient {
        LinearGradient(stops: [.init(color: light, location: 0), .init(color: base, location: 0.7),
                               .init(color: bottom, location: 1)], startPoint: .top, endPoint: .bottom)
    }
}

/// One glossy tile, drawn in code so it stays crisp at every size: a rounded square
/// (22% radius) whose `edge` shows as a thick bottom lip (7%), a gradient face, a
/// gloss over the top 38%, and a white Nunito Black letter. Non-square sizes (the
/// multi-board fill) round by the shorter side. Decorative; callers label rows.
struct GlossyTile: View {
    let face: GlossyFace
    var letter: String = ""
    var width: CGFloat
    var height: CGFloat? = nil
    /// Letter size as a fraction of the tile's shorter side.
    var letterScale: CGFloat = 0.56
    /// An animated glow around the face (reveal bloom, hint pulse).
    var glow: Color = .clear
    var glowAmount: CGFloat = 0
    /// The hint's gold ring (pulses with `glowAmount`).
    var goldRing: Bool = false

    var body: some View {
        let h = height ?? width
        let s = min(width, h)
        let r = s * 0.22
        let lip = max(1.5, h * 0.07)
        let faceShape = RoundedRectangle(cornerRadius: r, style: .continuous)
        let st = Self.style(face)
        ZStack(alignment: .top) {
            faceShape.fill(st.edge)
            ZStack(alignment: .top) {
                faceShape.fill(st.face)
                if let ring = st.ring {
                    faceShape.strokeBorder(ring, lineWidth: max(1, s * st.ringWidth))
                }
                if goldRing && glowAmount > 0 {
                    faceShape.strokeBorder(Color(hex: 0xF5C542).opacity(Double(glowAmount)), lineWidth: max(1.5, s * 0.05))
                }
                // The gloss: inset 8% left / right, 6% from the top, 38% tall.
                RoundedRectangle(cornerRadius: s * 0.18, style: .continuous)
                    .fill(LinearGradient(colors: [Color.white.opacity(st.gloss), Color.white.opacity(0)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: width * 0.84, height: (h - lip) * 0.38)
                    .padding(.top, (h - lip) * 0.06)
                    .allowsHitTesting(false)
                if !letter.isEmpty {
                    Text(letter)
                        .font(Brand.fixedFont(s * letterScale, .black))
                        .tracking(-0.02 * s * letterScale)
                        .foregroundStyle(st.ink)
                        .shadow(color: st.letterShadow, radius: s * 0.02, x: 0, y: s * 0.03)
                        .lineLimit(1).minimumScaleFactor(0.5)
                        .frame(width: width, height: h - lip)
                }
            }
            .frame(width: width, height: h - lip)
            // §AQ2: only a revealing tile carries the glow (a plain shape's shadow under
            // the face); a settled / typed / empty tile — hundreds on a multi board —
            // draws no shadow pass at all. `glow` is fixed per tile, so the structure
            // never changes mid-animation.
            .background {
                if glow != .clear {
                    // §AU4: a fixed glow whose OPACITY animates (GPU-cheap) — never an
                    // animated blur radius.
                    faceShape.fill(glow)
                        .shadow(color: glow, radius: s * 0.27)
                        .opacity(Double(glowAmount))
                }
            }
        }
        .frame(width: width, height: h)
    }

    struct Style {
        var edge: AnyShapeStyle
        var face: AnyShapeStyle
        var ring: Color? = nil
        var ringWidth: CGFloat = 0.035
        var gloss: Double = 0.55
        var ink: Color = .white
        var letterShadow: Color = .black.opacity(0.25)
    }

    static func style(_ face: GlossyFace) -> Style {
        let dark = Theme.isDark
        switch face {
        case .empty:
            return dark
                ? Style(edge: AnyShapeStyle(Color.white.opacity(0.07)), face: AnyShapeStyle(Color.white.opacity(0.10)),
                        ring: Color(hex: 0xA78BFA).opacity(0.28), gloss: 0.12, ink: Theme.textMuted, letterShadow: .clear)
                : Style(edge: AnyShapeStyle(Color(hex: 0xD8C8F3).opacity(0.55)), face: AnyShapeStyle(Color.white.opacity(0.58)),
                        ring: Color(hex: 0x7C3AED).opacity(0.16), gloss: 0.35, ink: Color(hex: 0x8A78AD), letterShadow: .clear)
        case .hintUsed:
            return dark
                ? Style(edge: AnyShapeStyle(Color.white.opacity(0.07)), face: AnyShapeStyle(Color.white.opacity(0.10)),
                        ring: Color(hex: 0xA78BFA).opacity(0.2), gloss: 0.12, ink: Color.white.opacity(0.35), letterShadow: .clear)
                : Style(edge: AnyShapeStyle(Color(hex: 0xD8C8F3).opacity(0.45)), face: AnyShapeStyle(Color.white.opacity(0.5)),
                        ring: Color(hex: 0x7C3AED).opacity(0.10), gloss: 0.3, ink: Color(hex: 0xC4B8DA), letterShadow: .clear)
        case .typed:
            return Style(edge: AnyShapeStyle(Color(hex: 0xC9B2F2)), face: AnyShapeStyle(Color.white),
                         ring: Color(hex: 0x8B5CF6), ringWidth: 0.045, ink: FinishInk.softNumber,
                         letterShadow: Color(hex: 0x7C3AED).opacity(0.18))
        case .bad:
            return Style(edge: AnyShapeStyle(Color(hex: 0xF2B8C2)), face: AnyShapeStyle(Color(hex: 0xFFF5F7)),
                         ring: Color(hex: 0xF0435F), ringWidth: 0.05, ink: Color(hex: 0xC2183A),
                         letterShadow: Color(hex: 0xF0435F).opacity(0.2))
        case .correct: return colored(.correct, shadow: Color(hex: 0x2E0C63).opacity(0.55))
        case .present: return colored(.present, shadow: Color(hex: 0x783C00).opacity(0.45))
        case .absent:
            var s = colored(.absent, shadow: Color(hex: 0x191E2D).opacity(0.45))
            s.gloss = 0.32
            return s
        case .conflict: return colored(.red, shadow: Color(hex: 0x6E0F1E).opacity(0.45))
        case .given:
            return Style(edge: AnyShapeStyle(Color(hex: 0xD8C8F3)), face: AnyShapeStyle(Color(hex: 0xFBF8FF)),
                         ring: Color(hex: 0x7C3AED).opacity(0.14), ringWidth: 0.025, ink: FinishInk.title, letterShadow: .clear)
        case .sudokuSame:
            return Style(edge: AnyShapeStyle(Color(hex: 0x9F7AEA)), face: AnyShapeStyle(Color(hex: 0xC4A6F7)),
                         ring: Color(hex: 0x7C3AED).opacity(0.55), ringWidth: 0.04, gloss: 0.4,
                         ink: Color(hex: 0x3B0F8C), letterShadow: .clear)
        case .sudokuWashGiven:
            return Style(edge: AnyShapeStyle(Color(hex: 0xC9B0F3)), face: AnyShapeStyle(Color(hex: 0xEADFFF)),
                         ring: Color(hex: 0x7C3AED).opacity(0.18), ringWidth: 0.025, gloss: 0.4, ink: FinishInk.title, letterShadow: .clear)
        case .sudokuWashEmpty:
            return dark
                ? Style(edge: AnyShapeStyle(Color(hex: 0xA78BFA).opacity(0.5)), face: AnyShapeStyle(Color(hex: 0xA78BFA).opacity(0.30)),
                        ring: Color(hex: 0xA78BFA).opacity(0.4), gloss: 0.12, ink: Theme.textMuted, letterShadow: .clear)
                : Style(edge: AnyShapeStyle(Color(hex: 0xC9B0F3)), face: AnyShapeStyle(Color(hex: 0xEADFFF)),
                        ring: Color(hex: 0x7C3AED).opacity(0.18), gloss: 0.35, ink: Color(hex: 0x8A78AD), letterShadow: .clear)
        }
    }

    private static func colored(_ p: TilePalette, shadow: Color) -> Style {
        Style(edge: AnyShapeStyle(p.edge), face: AnyShapeStyle(p.faceGradient), ring: nil, gloss: 0.5, ink: .white, letterShadow: shadow)
    }

    /// The reveal bloom's color per state (game-kit `--glow`).
    static func bloom(_ face: GlossyFace) -> Color {
        switch face {
        case .correct: return ThemeManager.shared.colorblind ? Theme.correct.opacity(0.6) : Color(red: 150 / 255, green: 90 / 255, blue: 1).opacity(0.6)
        case .present: return ThemeManager.shared.colorblind ? Theme.present.opacity(0.65) : Color(red: 1, green: 190 / 255, blue: 70 / 255).opacity(0.65)
        case .absent: return Color(red: 140 / 255, green: 150 / 255, blue: 175 / 255).opacity(0.35)
        default: return .clear
        }
    }
}

extension GlossyFace {
    /// A revealed engine state's face.
    init(revealed state: TileState) {
        switch state {
        case .correct: self = .correct
        case .present: self = .present
        case .absent: self = .absent
        case .hintUsed: self = .hintUsed
        case .empty: self = .empty
        }
    }
}

// MARK: - §B3 The motion kit

/// The game kit's timings (game-kit.html motion table), shared by every board.
/// FINISH_SPEC §AQ1 / §BI5: the reveal clock lives in core `RevealTiming` (unit
/// tested) — the pre-overhaul pacing: 0.5 s flips, 150 ms apart on a single board;
/// 0.3 s, 80 ms apart on a multi-board (mini) board.
enum TileMotion {
    /// Type a letter / place a number: a quick soft spring (never blocks typing).
    static let pop: Double = 0.22
    /// Reveal (single board): each tile turns over in 0.5 s, 150 ms apart, color
    /// swaps at the half.
    static let flip: Double = RevealTiming.flip
    static let flipStagger: Double = RevealTiming.flipStagger
    /// Reveal (multi-board mini boards): 0.3 s, 80 ms apart.
    static let miniFlip: Double = RevealTiming.miniFlip
    static let miniFlipStagger: Double = RevealTiming.miniFlipStagger
    static func flipDuration(mini: Bool) -> Double { RevealTiming.flipDuration(mini: mini) }
    static func stagger(mini: Bool) -> Double { RevealTiming.stagger(mini: mini) }
    /// The soft color glow after landing.
    static let bloom: Double = RevealTiming.bloom
    /// Not a word (web REVEAL parity): the 360 ms row nudge, the 700 ms red hold,
    /// then letters clear 60 ms apart. Typing during the hold replaces the rejected
    /// row (never blocks input).
    static let nudge: Double = 0.36
    static let rejectHold: Double = 0.7
    static let rejectStep: Double = 0.06
    /// Win: a hop wave, 400 ms each, 60 ms apart.
    static let hop: Double = RevealTiming.hop
    static let hopStagger: Double = RevealTiming.hopStagger
    /// Lose: wobble + sink.
    static let sink: Double = RevealTiming.sink
    static let sinkStagger: Double = RevealTiming.sinkStagger
    /// Hint: a gold glow pulse, twice.
    static let hintPulse: Double = 0.9

    /// How long a `columns`-wide row takes to finish revealing.
    static func rowReveal(columns: Int, mini: Bool = false) -> Double {
        RevealTiming.rowReveal(columns: columns, mini: mini)
    }

    static let popFrames: [(Double, CastPose)] = [
        (0, CastPose(sx: 0.9, sy: 0.9)), (0.55, CastPose(sx: 1.07, sy: 1.07)), (1, .identity),
    ]
    static let popEasing = CubicBezier(0.34, 1.45, 0.64, 1)

    static let hopFrames: [(Double, CastPose)] = [
        (0, .identity), (0.35, CastPose(ty: -0.34, sx: 1.06, sy: 0.96)),
        (0.6, CastPose(ty: 0.04, sx: 0.97, sy: 1.04)), (1, .identity),
    ]
    static let hopEasing = CubicBezier(0.3, 1.5, 0.5, 1)

    static let sinkFrames: [(Double, CastPose)] = [
        (0, .identity), (0.4, CastPose(rotation: -4)), (0.7, CastPose(ty: 0.03, rotation: 3)), (1, CastPose(ty: 0.02)),
    ]

    /// The row nudge in points at 58-pt tiles (scaled by the caller).
    static let nudgeFrames: [(Double, CastPose)] = [
        (0, .identity), (0.15, CastPose(tx: -2)), (0.3, CastPose(tx: 5)), (0.45, CastPose(tx: -6)),
        (0.55, CastPose(tx: -6)), (0.7, CastPose(tx: 5)), (0.85, CastPose(tx: -2)), (1, .identity),
    ]
    static let nudgeEasing = CubicBezier(0.36, 0.07, 0.19, 0.97)
}

/// Plays a keyframe set as `progress` animates 0 → 1. Translations are fractions
/// of `size` (CSS `translate(%)`), unless `points` (then raw points).
struct KeyframeEffect: ViewModifier, Animatable {
    var progress: Double
    let frames: [(Double, CastPose)]
    let easing: CubicBezier
    var size: CGSize
    var anchor: UnitPoint = .center
    var points: Bool = false
    /// Fade 0.6 → 1 over the first 55% (the type pop).
    var fadeIn: Bool = false
    /// Desaturate to 70% as the sink settles.
    var desaturate: Bool = false

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let p = Keyframes.sample(frames, at: progress, easing: easing)
        let tx = points ? p.tx : p.tx * Double(size.width)
        let ty = points ? p.ty : p.ty * Double(size.height)
        let skew = CGFloat(tan(p.skewX * .pi / 180))
        return content
            .scaleEffect(x: CGFloat(p.sx), y: CGFloat(p.sy), anchor: anchor)
            .rotationEffect(.degrees(p.rotation), anchor: anchor)
            .transformEffect(CGAffineTransform(a: 1, b: 0, c: skew, d: 1, tx: -skew * size.height * anchor.y, ty: 0))
            .offset(x: CGFloat(tx), y: CGFloat(ty))
            .opacity(fadeIn ? 0.6 + 0.4 * min(1, progress / 0.55) : 1)
            .saturation(desaturate ? 1 - 0.3 * min(1, progress) : 1)
    }
}

/// §B3 "not a word": the row's small nudge, driven by an incrementing counter
/// (each step plays the 520 ms keyframes once; whole numbers rest).
struct NudgeEffect: GeometryEffect {
    var animatableData: CGFloat
    var scale: CGFloat = 1

    func effectValue(size: CGSize) -> ProjectionTransform {
        let frac = Double(animatableData - floor(animatableData))
        guard frac > 0 else { return ProjectionTransform(.identity) }
        let p = Keyframes.sample(TileMotion.nudgeFrames, at: frac, easing: TileMotion.nudgeEasing)
        return ProjectionTransform(CGAffineTransform(translationX: CGFloat(p.tx) * scale, y: 0))
    }
}

/// §B3 the typed pop: when `letter` goes from empty to a letter, the tile fades in
/// as it swells to 1.07 and eases back (300 ms soft spring).
struct TypePop: ViewModifier {
    let letter: String
    let size: CGSize
    @State private var progress: Double = 1

    func body(content: Content) -> some View {
        content
            .modifier(KeyframeEffect(progress: progress, frames: TileMotion.popFrames, easing: TileMotion.popEasing,
                                     size: size, fadeIn: progress < 1))
            .onChange(of: letter) { new in
                guard !new.isEmpty, !Theme.reduceMotion else { return }
                var reset = Transaction()
                reset.disablesAnimations = true
                withTransaction(reset) { progress = 0 }
                // Next runloop, so the reset renders before the pop animates.
                DispatchQueue.main.async {
                    withAnimation(.linear(duration: TileMotion.pop)) { progress = 1 }
                }
            }
    }
}

// MARK: - §B2 Key caps

/// A keyboard key drawn as a tile: a lilac lip (3 pt) under a light face with dark
/// purple ink; after a reveal it takes the state's colors (purple / gold / slate).
struct KeyCap<Label: View>: View {
    let state: TileState?
    /// A solid override (Codebreaker's settled letters).
    var fill: Color? = nil
    var height: CGFloat
    var width: CGFloat? = nil
    @ViewBuilder var label: () -> Label

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 9, style: .continuous)
        let colors = Self.colors(state, fill: fill)
        ZStack(alignment: .top) {
            shape.fill(colors.edge)
            shape.fill(colors.face).padding(.bottom, 3)
            label()
                .foregroundStyle(colors.ink)
                // §AB: at 200% Larger Text the letter shrinks to fit its key.
                .lineLimit(1).minimumScaleFactor(0.5)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.bottom, 3)
        }
        .frame(width: width, height: height)
        .frame(maxWidth: width == nil ? .infinity : nil)
    }

    static func colors(_ state: TileState?, fill: Color?) -> (edge: Color, face: AnyShapeStyle, ink: Color) {
        if let fill {
            return (Color.black.mixed(over: fill, 0.3), AnyShapeStyle(fill), .white)
        }
        guard let state else {
            return (Color(hex: 0xCDB9F0), AnyShapeStyle(Color.white.opacity(0.92)), FinishInk.softNumber)
        }
        let p: TilePalette
        switch state {
        case .correct: p = .correct
        case .present, .hintUsed: p = .present
        case .absent:
            return (TilePalette.slate.edge,
                    AnyShapeStyle(LinearGradient(colors: [TilePalette.slate.light, TilePalette.slate.base], startPoint: .top, endPoint: .bottom)),
                    Color(hex: 0xEEF1F6))
        case .empty:
            return (Color(hex: 0xCDB9F0), AnyShapeStyle(Color.white.opacity(0.92)), FinishInk.softNumber)
        }
        return (p.edge, AnyShapeStyle(LinearGradient(colors: [p.light, p.base], startPoint: .top, endPoint: .bottom)), .white)
    }
}

/// The key press: sinks 2 pt into its lip and dips to 94% (150 ms).
struct KeyPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        let still = Theme.reduceMotion
        let pressed = configuration.isPressed && !still
        return configuration.label
            .offset(y: pressed ? 2 : 0)
            .scaleEffect(pressed ? 0.94 : 1)
            .animation(still ? nil : .easeOut(duration: 0.075), value: pressed)
    }
}

/// The chunky purple backspace (game-kit.html's delete key): a rounded arrow tag
/// in #5b2bb5 with a white ✕.
struct DeleteKeyIcon: View {
    var width: CGFloat = 30

    var body: some View {
        let h = width * 24 / 32
        Canvas { ctx, size in
            let sx = size.width / 32, sy = size.height / 24
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * sx, y: y * sy) }
            var tag = Path()
            tag.move(to: p(10.2, 2.5))
            tag.addLine(to: p(27.5, 2.5))
            tag.addQuadCurve(to: p(30.5, 5.5), control: p(30.5, 2.5))
            tag.addLine(to: p(30.5, 18.5))
            tag.addQuadCurve(to: p(27.5, 21.5), control: p(30.5, 21.5))
            tag.addLine(to: p(10.2, 21.5))
            tag.addQuadCurve(to: p(7.9, 20.4), control: p(8.9, 21.5))
            tag.addLine(to: p(2.2, 13.9))
            tag.addQuadCurve(to: p(2.2, 10.1), control: p(0.9, 12))
            tag.addLine(to: p(7.9, 3.6))
            tag.addQuadCurve(to: p(10.2, 2.5), control: p(8.9, 2.5))
            tag.closeSubpath()
            ctx.fill(tag, with: .color(Color(hex: 0x5B2BB5)))
            var x = Path()
            x.move(to: p(15.2, 8.3)); x.addLine(to: p(22.6, 15.7))
            x.move(to: p(22.6, 8.3)); x.addLine(to: p(15.2, 15.7))
            ctx.stroke(x, with: .color(.white), style: StrokeStyle(lineWidth: 3 * sx, lineCap: .round))
        }
        .frame(width: width, height: h)
        .shadow(color: .white.opacity(0.6), radius: 0, x: 0, y: 1)
        .accessibilityHidden(true)
    }
}
