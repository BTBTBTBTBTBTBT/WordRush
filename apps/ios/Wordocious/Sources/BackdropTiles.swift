import SwiftUI

// FINISH_SPEC BJ8 (founder 10-03: "I don't ever want the backgrounds to be a
// distraction"): the floating 3D letter tiles behind pages and games are no longer
// baked into the wallpapers (docs/design/brand/walls/calm-walls.py made calm bases).
// The few that remain are drawn from THIS one config — tune counts, sizes and
// opacities here only. Android: ui/BackdropTiles.kt, web: lib/backdrop-tiles.ts
// (same numbers).
//
// Rules: games get 4 tiny, faint tiles (0.2) that sit only in the side gutters
// between the header and the keyboard (never behind the board or keys); pages get 6
// small tiles (0.35) in the 16-pt gutters beside the cards and the cast row. All are
// static, desaturated toward the page tint, and rasterized once (one layer, no blur).

enum BackdropTiles {
    struct Tile {
        /// Which side gutter, and the tile's center offset from that edge (pt).
        let leading: Bool
        let inset: CGFloat
        /// Vertical center as a share of the screen height.
        let y: CGFloat
        let size: CGFloat
        let rotation: Double
        let letter: String
        /// Candy face (blended toward the page tint by `tintMix`).
        let color: UInt
    }

    struct Look {
        let tiles: [Tile]
        let opacity: Double
        let saturation: Double
        /// How far each face is pulled toward the page's accent (0 = its own candy color).
        let tintMix: Double
    }

    /// Every game screen and finished screen: very subtle, static.
    static let game = Look(tiles: [
        Tile(leading: true, inset: 7, y: 0.24, size: 11, rotation: -12, letter: "W", color: 0xA855F7),
        Tile(leading: false, inset: 7, y: 0.33, size: 12, rotation: 10, letter: "O", color: 0xF472B6),
        Tile(leading: true, inset: 6, y: 0.47, size: 10, rotation: 8, letter: "R", color: 0x34D399),
        Tile(leading: false, inset: 6, y: 0.58, size: 10, rotation: -9, letter: "D", color: 0xFB923C),
    ], opacity: 0.2, saturation: 0.55, tintMix: 0.35)

    /// Home, Leaderboard, Stats, Friends and the info pages: calm, static.
    static let page = Look(tiles: [
        Tile(leading: true, inset: 9, y: 0.10, size: 14, rotation: -12, letter: "W", color: 0xA855F7),
        Tile(leading: false, inset: 9, y: 0.16, size: 13, rotation: 11, letter: "O", color: 0xF472B6),
        Tile(leading: true, inset: 8, y: 0.38, size: 12, rotation: 9, letter: "R", color: 0x34D399),
        Tile(leading: false, inset: 8, y: 0.52, size: 13, rotation: -10, letter: "D", color: 0x60A5FA),
        Tile(leading: true, inset: 8, y: 0.70, size: 12, rotation: -7, letter: "S", color: 0xFB923C),
        Tile(leading: false, inset: 8, y: 0.84, size: 12, rotation: 8, letter: "Y", color: 0xA855F7),
    ], opacity: 0.35, saturation: 0.75, tintMix: 0.25)

    static func look(for tint: PageTint) -> Look {
        if case .game = tint { return game }
        return page
    }
}

/// The tile layer for a page backdrop: drawn once and flattened (`drawingGroup`),
/// never animated.
struct BackdropTileLayer: View {
    let tint: PageTint

    var body: some View {
        let look = BackdropTiles.look(for: tint)
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(look.tiles.indices, id: \.self) { i in
                    let t = look.tiles[i]
                    BackdropTileFace(letter: t.letter,
                                     color: Color(hex: t.color).mixed(over: tint.accent, 1 - look.tintMix),
                                     size: t.size)
                        .rotationEffect(.degrees(t.rotation))
                        .position(x: t.leading ? t.inset : geo.size.width - t.inset, y: geo.size.height * t.y)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .drawingGroup()
            .saturation(look.saturation)
            .opacity(look.opacity)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// One small candy tile: a rounded face with a darker lip and a white letter.
private struct BackdropTileFace: View {
    let letter: String
    let color: Color
    let size: CGFloat

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
        ZStack {
            shape.fill(Color.black.mixed(over: color, 0.3)).offset(y: size * 0.08)
            shape.fill(LinearGradient(colors: [Color.white.mixed(over: color, 0.3), color],
                                      startPoint: .top, endPoint: .bottom))
            Text(letter).font(Brand.fixedFont(size * 0.58, .black)).foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}
