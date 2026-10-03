import SwiftUI
import WordociousCore

// Phase 2 (`puz` area) helpers shared by the puzzle game screens — Muddle,
// Hubbub, Crosswordocious, Kindred, Cipher, Spyglass, Ladder, Sudocious and
// ProperNoundle (docs/FINISH_SPEC.md §A1, §A8, §B6, §I, §J, §L). Built on the
// phase-1 kit (FinishKit.swift / GameTray.swift); presentation only.

enum PuzKit {
    /// §A1 surface: a soft wash of `accent` over white (dark: the dark surface
    /// with a faint accent tint, so dark mode keeps its dark surfaces).
    static func face(_ accent: Color, _ amount: Double = 0.12) -> Color {
        Theme.isDark ? accent.mixed(over: Theme.surface, 0.16) : accent.wash(amount)
    }

    /// §A1 border: the accent at ~30% over white (dark: the accent at 40%).
    static func line(_ accent: Color, _ amount: Double = 0.32) -> Color {
        Theme.isDark ? accent.opacity(0.4) : accent.wash(amount)
    }

    /// Ink that reads on a tinted face in both themes.
    static var ink: Color { Theme.isDark ? Theme.textPrimary : FinishInk.softNumber }
}

// MARK: - Glossy chips (Kindred cards, Muddle letter chips, found-word capsules)

/// A glossy chip in the B1 tile recipe: a face (vertical gradient light → base),
/// a thicker darker bottom lip, a gloss across the top ~40% and an optional
/// border. Used for chips that carry text (Kindred word cards, Muddle's scrambled
/// letters, Spyglass / Hubbub found words).
struct PuzGlossyChip: ViewModifier {
    let base: Color
    var light: Color? = nil
    var edge: Color? = nil
    var border: Color? = nil
    var radius: CGFloat = 10
    var lip: CGFloat = 3
    var gloss: Double = 0.5
    /// A soft glow around the chip (Spyglass found words).
    var glow: Color = .clear

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let top = light ?? Color.white.mixed(over: base, 0.4)
        let lipColor = edge ?? Color.black.mixed(over: base, 0.28)
        return content
            .padding(.bottom, lip)
            .background {
                ZStack(alignment: .top) {
                    shape.fill(lipColor)
                    ZStack(alignment: .top) {
                        shape.fill(LinearGradient(colors: [top, base], startPoint: .top, endPoint: .bottom))
                        GeometryReader { g in
                            RoundedRectangle(cornerRadius: max(2, radius * 0.8), style: .continuous)
                                .fill(LinearGradient(colors: [Color.white.opacity(gloss), Color.white.opacity(0)],
                                                     startPoint: .top, endPoint: .bottom))
                                .frame(width: g.size.width * 0.86, height: g.size.height * 0.42)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 2)
                        }
                        .allowsHitTesting(false)
                        if let border { shape.strokeBorder(border, lineWidth: 1.5) }
                    }
                    .padding(.bottom, lip)
                }
                .shadow(color: glow, radius: glow == .clear ? 0 : 7)
            }
    }
}

extension View {
    /// A glossy chip face (see `PuzGlossyChip`).
    func puzChip(_ base: Color, light: Color? = nil, edge: Color? = nil, border: Color? = nil,
                 radius: CGFloat = 10, lip: CGFloat = 3, gloss: Double = 0.5, glow: Color = .clear) -> some View {
        modifier(PuzGlossyChip(base: base, light: light, edge: edge, border: border, radius: radius,
                               lip: lip, gloss: gloss, glow: glow))
    }
}

// MARK: - Motion (§B3), Reduce Motion → instant

/// The type pop played on demand (a tap rather than a letter change): bump
/// `trigger` and the view swells to 1.07 and settles (300 ms).
struct PuzTapPop: ViewModifier {
    let trigger: Int
    let size: CGSize
    @State private var progress: Double = 1

    func body(content: Content) -> some View {
        content
            .modifier(KeyframeEffect(progress: progress, frames: TileMotion.popFrames, easing: TileMotion.popEasing, size: size))
            .onChange(of: trigger) { _ in
                guard !Theme.reduceMotion else { return }
                var reset = Transaction()
                reset.disablesAnimations = true
                withTransaction(reset) { progress = 0 }
                DispatchQueue.main.async {
                    withAnimation(.linear(duration: TileMotion.pop)) { progress = 1 }
                }
            }
    }
}

/// The flip itself (rotateX stand-in: the face squashes edge-on at the half and
/// swells 1.05), driven by `progress` 0 → 1 (1 = at rest).
private struct PuzFlipEffect: ViewModifier, Animatable {
    var progress: Double

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let angle = (progress < 0.5 ? progress : 1 - progress) * 2 * 90
        let swell = CGFloat(1 + 0.05 * sin(.pi * progress))
        return content.scaleEffect(x: swell, y: CGFloat(cos(angle * .pi / 180)) * swell, anchor: .center)
    }
}

/// §B3 reveal on solve: when `solved` turns true the piece turns over (720 ms,
/// after `delay`) and lands with a soft color glow (bloom, 900 ms).
struct PuzSolveFlip: ViewModifier {
    let solved: Bool
    var delay: Double = 0
    var glow: Color = Color(red: 150 / 255, green: 90 / 255, blue: 1).opacity(0.6)
    var size: CGFloat = 36
    @State private var progress: Double = 1
    @State private var bloom: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .modifier(PuzFlipEffect(progress: progress))
            .shadow(color: glow.opacity(Double(bloom)), radius: size * 0.27 * bloom)
            .onChange(of: solved) { now in
                guard now, !Theme.reduceMotion else { return }
                var reset = Transaction()
                reset.disablesAnimations = true
                withTransaction(reset) { progress = 0 }
                DispatchQueue.main.async {
                    withAnimation(.timingCurve(0.37, 0, 0.63, 1, duration: TileMotion.flip).delay(delay)) { progress = 1 }
                }
                let land = delay + TileMotion.flip
                DispatchQueue.main.asyncAfter(deadline: .now() + land) {
                    withAnimation(.easeOut(duration: TileMotion.bloom * 0.35)) { bloom = 1 }
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + land + TileMotion.bloom * 0.35) {
                    withAnimation(.easeOut(duration: TileMotion.bloom * 0.65)) { bloom = 0 }
                }
            }
    }
}

/// §B3 win: a hop wave — when `on` turns true the piece hops (560 ms) after `delay`.
struct PuzHop: ViewModifier {
    let on: Bool
    var delay: Double = 0
    let size: CGSize
    @State private var progress: Double = 0

    func body(content: Content) -> some View {
        content
            .modifier(KeyframeEffect(progress: progress, frames: TileMotion.hopFrames, easing: TileMotion.hopEasing, size: size))
            .onChange(of: on) { now in
                guard now, !Theme.reduceMotion else { return }
                var reset = Transaction()
                reset.disablesAnimations = true
                withTransaction(reset) { progress = 0 }
                DispatchQueue.main.async {
                    withAnimation(.linear(duration: TileMotion.hop).delay(delay)) { progress = 1 }
                }
            }
    }
}

// MARK: - Candy actions (§A8)

/// A small candy action (Delete · Clear · Shuffle · Hint …) used in the game
/// control rows: the shared §A8 small pill.
struct PuzCandyAction: View {
    let title: String
    var symbol: String? = nil
    var variant: CandyButtonStyle.Variant = .purple
    var size: CandyButtonStyle.Size = .small
    var fullWidth: Bool = false
    /// §BI22: a used-count (hints, checks) — a gold coin on the top-right corner,
    /// never part of the label, so the pill never widens. 0 = no badge.
    var count: Int = 0
    let action: () -> Void

    var body: some View {
        Button(action: action) { CandyLabel(title: title, symbol: symbol) }
            .buttonStyle(CandyButtonStyle(variant: variant, size: size, fullWidth: fullWidth))
            .hintCountBadge(count)
            .accessibilityLabel(count > 0 ? "\(title) (\(count) used)" : title)
    }
}

/// §BI22: the used-count coin (web components/ui/hint-kit.tsx `HintCountBadge`
/// parity): 17 pt gold coin, white rim, a darker lip, dark-amber number. Overlay
/// only — the button's size never changes when it appears or grows.
struct HintCountBadge: View {
    let count: Int

    var body: some View {
        let text = HintLayout.countText(count)
        if !text.isEmpty {
            Text(text)
                .font(Brand.font(10, .black)).monospacedDigit()
                .foregroundStyle(Color(hex: 0x7A3D00))
                .shadow(color: .white.opacity(0.55), radius: 0, x: 0, y: 1)
                .padding(.horizontal, 4)
                .frame(minWidth: 17, minHeight: 17)
                .background(
                    ZStack {
                        Capsule().fill(Color(hex: 0xB45309)).offset(y: 2)
                        Capsule().fill(LinearGradient(colors: [Color(hex: 0xFFE27A), Color(hex: 0xF5A524)],
                                                      startPoint: .top, endPoint: .bottom))
                        Capsule().strokeBorder(Color.white, lineWidth: 1.5)
                    }
                )
                .fixedSize()
                .allowsHitTesting(false)
                .accessibilityHidden(true)
                .transition(.scale(scale: 0.6).combined(with: .opacity))
        }
    }
}

extension View {
    /// §BI22: pins the gold used-count coin to this button's top-right corner
    /// (top −7, right −5, web parity) without changing its size.
    func hintCountBadge(_ count: Int) -> some View {
        overlay(alignment: .topTrailing) {
            HintCountBadge(count: count)
                .alignmentGuide(.top) { $0[.top] + 7 }
                .alignmentGuide(.trailing) { $0[.trailing] - 5 }
                .animation(Theme.reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.6), value: count)
        }
    }
}

/// A round icon-only candy (the small 34-pt circle) inside a 44-pt hit frame.
struct PuzCandyIcon: View {
    let symbol: String
    let label: String
    var variant: CandyButtonStyle.Variant = .purple
    let action: () -> Void

    var body: some View {
        Button(action: action) { OutlinedSymbol(name: symbol, size: 14, width: 1.25) }
            .buttonStyle(CandyButtonStyle(variant: variant, size: .small, fullWidth: false, circle: true))
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
            .accessibilityLabel(label)
    }
}

// MARK: - A glossy tile in any color

/// The B1 glossy tile (same geometry as `GlossyTile`: 22% radius, a 7% bottom
/// lip, gradient face, gloss over the top 38%, white Nunito Black letter) in any
/// `TilePalette` — for pieces that carry a game's own color (Letter Ladder's
/// changed letter, Kindred's tier colors).
struct PuzPaletteTile: View {
    let palette: TilePalette
    var letter: String = ""
    var width: CGFloat
    var height: CGFloat? = nil
    var letterScale: CGFloat = 0.52
    var ink: Color = .white

    var body: some View {
        let h = height ?? width
        let s = min(width, h)
        let lip = max(1.5, h * 0.07)
        let shape = RoundedRectangle(cornerRadius: s * 0.22, style: .continuous)
        ZStack(alignment: .top) {
            shape.fill(palette.edge)
            ZStack(alignment: .top) {
                shape.fill(palette.faceGradient)
                RoundedRectangle(cornerRadius: s * 0.18, style: .continuous)
                    .fill(LinearGradient(colors: [Color.white.opacity(0.5), Color.white.opacity(0)], startPoint: .top, endPoint: .bottom))
                    .frame(width: width * 0.84, height: (h - lip) * 0.38)
                    .padding(.top, (h - lip) * 0.06)
                    .allowsHitTesting(false)
                if !letter.isEmpty {
                    Text(letter)
                        .font(Brand.fixedFont(s * letterScale, .black))
                        .foregroundStyle(ink)
                        .shadow(color: Color.black.mixed(over: palette.edge, 0.4).opacity(0.5), radius: s * 0.02, x: 0, y: s * 0.03)
                        .lineLimit(1).minimumScaleFactor(0.5)
                        .frame(width: width, height: h - lip)
                }
            }
            .frame(width: width, height: h - lip)
        }
        .frame(width: width, height: h)
    }
}

// MARK: - §R2 / §R3 The finished screen's dock

/// FINISH_SPEC §R2: the finished puzzle's action dock (pinned under the board by
/// `FinishedScreenLayout`): an optional "Keep going" (Hubbub before the end), the
/// daily CTAs (`NextDailyCTA`: Next daily + Leaderboard + the §R3 Unlimited card),
/// and — after a Pro UNLIMITED game — the §R3 Unlimited card with NEW PUZZLE as the
/// primary action. Founder 10-02: the centered SHARE RESULTS candy (+ the daily
/// "Next <Game> in …" line) leads the dock.
struct PuzFinishedDock: View {
    let isDaily: Bool
    /// The game's dbKey (NextDailyCTA's `currentMode`).
    let currentMode: String
    /// The game's name for the Unlimited card ("Sudocious").
    let game: String
    /// Pro Unlimited's new-puzzle action (nil = not offered: free / guest / daily).
    var onNewPuzzle: (() -> Void)? = nil
    var onOtherGames: (() -> Void)? = nil
    var keepGoing: (() -> Void)? = nil
    /// ProperNoundle in VS never shows the daily CTAs.
    var showNextDaily: Bool = true
    /// Founder 10-02: the game's share — the dock's centered SHARE RESULTS candy
    /// (it used to float as an icon beside the result line). Bool = full results.
    var onShare: ((Bool) -> Void)? = nil
    /// The share has a spoiler-free / full-results chooser.
    var hasSpoilers: Bool = false

    var body: some View {
        // Founder 10-02 follow-up: the SHARE RESULTS candy (+ "Next <Game> in 3h 12m" inside
        // it on a daily, not in VS) rides an existing action row — never a row of its own
        // when the dock has one.
        let shareCTA = onShare.map { AnyView(FinishedShareCTA(hasSpoilers: hasSpoilers, nextGame: isDaily && showNextDaily ? game : nil, onShare: $0)) }
        let daily = isDaily && showNextDaily
        let card = !isDaily ? onNewPuzzle : nil
        VStack(spacing: 8) {
            if let keepGoing {
                Button(action: keepGoing) { CandyLabel(title: "Keep going", symbol: "arrow.uturn.left") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium))
            }
            // Dailies: Next daily + Leaderboard + the §R3 Unlimited card (NextDailyCTA
            // renders the card for every signed-in player; free ones get the paywall).
            if daily { NextDailyCTA(currentMode: currentMode, compact: true, share: shareCTA) }
            if let card {
                UnlimitedKeepPlayingCard(game: game, afterUnlimited: true, action: card, onOtherGames: onOtherGames, share: shareCTA)
            }
            if !daily && card == nil, let shareCTA { shareCTA }
        }
        .padding(.bottom, 6)
    }
}

/// §R2: the compact one-line result strip, centered on the screen. Founder 10-02:
/// the share icon that floated at its end moved into the dock (`PuzFinishedDock`'s
/// SHARE RESULTS candy), so nothing pulls the strip off-center.
struct PuzResultLine: View {
    let won: Bool
    let items: [(value: String, label: String)]
    var points: Int? = nil

    var body: some View {
        FinishedResultStrip(won: won, items: items, points: points)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity)
    }
}

/// The finished screen's headline under the title (small, so the board keeps room).
struct PuzFinishedHeadline: View {
    let text: String
    let won: Bool

    var body: some View {
        Text(text)
            .font(Brand.font(16, .black))
            .foregroundStyle(won ? (Theme.isDark ? Color(hex: 0xC4B5FD) : Color(hex: 0x7C3AED)) : Color(hex: 0xE11D48))
            .multilineTextAlignment(.center)
            .lineLimit(1).minimumScaleFactor(0.7)
    }
}

/// m:ss for the result strip.
func puzClock(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }

/// §R2 "See all": the small candy that expands a collapsed list in place.
struct PuzSeeAllToggle: View {
    @Binding var expanded: Bool
    var title: String = "See all"

    var body: some View {
        Button {
            withAnimation(Theme.animation(.easeInOut(duration: 0.25))) { expanded.toggle() }
        } label: {
            CandyLabel(title: expanded ? "Show less" : title, symbol: expanded ? "chevron.up" : "chevron.down")
        }
        .buttonStyle(CandyButtonStyle(variant: .pink, size: .small, fullWidth: false))
    }
}
