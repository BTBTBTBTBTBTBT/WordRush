import SwiftUI

/// One game-tile style everywhere (founder, 2026-10-01; docs/GAME_TILE_STYLE.md).
/// The reference is the home mode card in its completed state (ModeCardView,
/// web components/home/mode-card.tsx): the accent at ~6% over the surface, a
/// 1.5 pt border in the accent at 40%, a 4 pt top bar (accent → accent at 53%),
/// and a 32 pt icon chip (accent at ~8%, radius 8) with the glyph in the accent.
///
/// `.gameTile(accent:)` paints that chrome on any layout; `GameTileCard` is the
/// card variant (icon chip, 13/900 title, 10/700 sub) and `GameTileSquare` the
/// 1 : 1 selector variant (chip + short label, up to two centered lines). Selected squares get a
/// 2 pt full-accent border, a soft accent glow and a ~12% tint.
struct GameTileChrome: ViewModifier {
    let accent: Color
    var selected: Bool = false
    var radius: CGFloat = 14
    var bar: CGFloat = 4
    /// The surface under the tint: nil = the themed surface (dark mode keeps the
    /// same alphas over the dark surface); `.white` on the light-only Friends / VS pages.
    var base: Color? = nil

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius)
        return content
            .background(
                ZStack {
                    shape.fill(base ?? Theme.surface)
                    shape.fill(accent.opacity(selected ? 0.12 : 0.06))
                }
            )
            .overlay(alignment: .top) {
                LinearGradient(colors: [accent, accent.opacity(0.53)], startPoint: .leading, endPoint: .trailing)
                    .frame(height: bar)
                    .allowsHitTesting(false)
            }
            .clipShape(shape)
            .overlay(shape.stroke(selected ? accent : accent.opacity(0.4), lineWidth: selected ? 2 : 1.5))
            .shadow(color: selected ? accent.opacity(0.4) : .clear, radius: 5)
            .contentShape(shape)
    }
}

extension View {
    /// The shared game-tile chrome (tint, border, top bar; glow when selected).
    func gameTile(accent: Color, selected: Bool = false, radius: CGFloat = 14,
                  bar: CGFloat = 4, base: Color? = nil) -> some View {
        modifier(GameTileChrome(accent: accent, selected: selected, radius: radius, bar: bar, base: base))
    }
}

/// Text colors for a tile: themed by default, fixed light ink on the light-only pages.
enum GameTileInk {
    static let lightTitle = Color(hex: 0x1A1A2E)
    static let lightMuted = Color(hex: 0x6B7280)
    static func title(_ light: Bool) -> Color { light ? lightTitle : Theme.textPrimary }
    static func muted(_ light: Bool) -> Color { light ? lightMuted : Theme.textMuted }
}

/// The card variant: the home mode card's layout (12 pt padding under the 4 pt
/// bar, 32 pt chip, 13/900 title, 10/700 sub).
struct GameTileCard<Icon: View>: View {
    let accent: Color
    let title: String
    var sub: String? = nil
    var titleLines: Int = 1
    var subLines: Int = 2
    var minHeight: CGFloat? = nil
    /// Light-only page (Friends / VS): white base and fixed ink.
    var light: Bool = false
    @ViewBuilder var icon: () -> Icon

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            icon()
            Text(title).font(Brand.font(13, .black)).foregroundStyle(GameTileInk.title(light))
                .lineLimit(titleLines).minimumScaleFactor(titleLines == 1 ? 0.6 : 0.8)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            if let sub {
                Text(sub).font(Brand.font(10, .bold)).foregroundStyle(GameTileInk.muted(light))
                    .lineLimit(subLines).minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12).padding(.bottom, 12).padding(.top, 16)
        .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
        .gameTile(accent: accent, base: light ? .white : nil)
    }
}

/// The square selector variant: 1 : 1, chip then a short label, centered.
/// `side` nil fills the width the row offers (grids); a number fixes the size
/// (horizontal rails). `label` nil draws the icon alone (tight strips). The
/// icon closure receives the chip size to draw at.
struct GameTileSquare<Icon: View>: View {
    let accent: Color
    var label: String? = nil
    var selected: Bool = false
    var side: CGFloat? = nil
    var radius: CGFloat = 14
    /// Labels may wrap to two centered lines (web parity) instead of ellipsizing.
    var labelLines: Int = 2
    var light: Bool = false
    /// Top bar height (4 pt; the small Leaderboard banner squares use 3).
    var bar: CGFloat = 4
    @ViewBuilder var icon: (CGFloat) -> Icon

    var body: some View {
        Group {
            if let side {
                content(side).frame(width: side, height: side)
            } else {
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .overlay { GeometryReader { g in content(g.size.width).frame(width: g.size.width, height: g.size.height) } }
            }
        }
        .gameTile(accent: accent, selected: selected, radius: radius, bar: bar, base: light ? .white : nil)
    }

    private func content(_ s: CGFloat) -> some View {
        let chip = floor(label == nil ? min(32, s * 0.6) : min(32, s * 0.44))
        return VStack(spacing: max(2, s * 0.05)) {
            icon(chip)
            if let label {
                Text(label).font(Brand.font(s < 60 ? 9.5 : 10.5, .heavy))
                    .foregroundStyle(selected ? accent : GameTileInk.title(light))
                    .lineLimit(labelLines).minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
            }
        }
        .padding(.top, bar) // optically center under the top bar
    }
}
