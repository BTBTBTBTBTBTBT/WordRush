import SwiftUI
import WordociousCore

// FINISH_SPEC §H — Starsweep in the new look (founder 10-02), plus §L's shared
// game tray for its board. The pieces Starsweep's board draws:
//   - `StarsweepPalette`: nine friendly pastels (lilac, peach, mint, sky, butter,
//     pink, aqua, coral, lavender), region index → color deterministically.
//   - `StarsweepGlyph`: the glossy piece art (`art-starsweep-*`) at ~78% of a cell.
//   - `StarsweepCell`: one soft glossy candy tile (rounded 6–8 pt, faint top gloss,
//     1.5-pt darker lip) on its region's bed; region borders read as a slightly
//     thicker gap with a darker seam (never black lines).
//   - The §B3 motion: placing a star / cross = the type pop; playing a star = the
//     flip-and-glow (purple when right, red glow + a small shake when wrong); a hint
//     = the flip with a gold glow pulsing twice. Reduce Motion → instant changes.
// Presentation only — the board's input, logic and accessibility stay in RegionsView.

// MARK: - Palette

/// One region's colors: the pastel face and a deeper tone the lip / bed derive from.
struct StarsweepTone {
    let pastel: Color
    let deep: Color

    /// The tile face gradient: a lighter top easing into the pastel.
    var faceTop: Color { Theme.isDark ? deep.mixed(over: Self.darkBase, 0.40) : Color.white.mixed(over: pastel, 0.45) }
    var faceBottom: Color { Theme.isDark ? deep.mixed(over: Self.darkBase, 0.30) : pastel }
    /// The 1.5-pt bottom lip.
    var lip: Color { Theme.isDark ? deep.mixed(over: Self.darkBase, 0.55) : deep.wash(0.50) }
    /// The region's bed (shows in the small gaps between tiles of one region).
    var bed: Color { Theme.isDark ? deep.mixed(over: Self.darkBase, 0.20) : deep.wash(0.30) }

    private static var darkBase: Color { Theme.surface }
}

enum StarsweepPalette {
    /// Fixed, in order: lilac, peach, mint, sky, butter, pink, aqua, coral, lavender.
    static let tones: [StarsweepTone] = [
        StarsweepTone(pastel: Color(hex: 0xC7A8FF), deep: Color(hex: 0xA78BFA)),   // lilac
        StarsweepTone(pastel: Color(hex: 0xFFB98A), deep: Color(hex: 0xFB923C)),   // peach
        StarsweepTone(pastel: Color(hex: 0x8EE6B4), deep: Color(hex: 0x34D399)),   // mint
        StarsweepTone(pastel: Color(hex: 0x9CCBFF), deep: Color(hex: 0x60A5FA)),   // sky
        StarsweepTone(pastel: Color(hex: 0xFFDD66), deep: Color(hex: 0xEAB308)),   // butter
        StarsweepTone(pastel: Color(hex: 0xFFA6CF), deep: Color(hex: 0xF472B6)),   // pink
        StarsweepTone(pastel: Color(hex: 0x84E3DC), deep: Color(hex: 0x2DD4BF)),   // aqua
        StarsweepTone(pastel: Color(hex: 0xFFA096), deep: Color(hex: 0xFB7185)),   // coral
        StarsweepTone(pastel: Color(hex: 0xB4B9FF), deep: Color(hex: 0x818CF8)),   // lavender
    ]

    static func tone(_ region: Int) -> StarsweepTone { tones[max(0, region) % tones.count] }
}

// MARK: - Glyphs

/// What a cell shows. The art is decorative — each cell's accessibility label says its state.
enum StarsweepGlyph: Equatable {
    case none
    /// A black (navy) star: placed, not yet played.
    case placed
    /// A played star that is right (also a hint star).
    case correct
    /// A played star that is wrong.
    case wrong
    case cross
    /// A lost board's missed star, shown faintly.
    case missing

    init(mark: Character, wrong: Bool, missing: Bool) {
        switch mark {
        case "*": self = wrong ? .wrong : .correct
        case "o": self = .placed
        case "x": self = .cross
        default: self = missing ? .missing : .none
        }
    }

    var asset: String? {
        switch self {
        case .none: return nil
        case .placed: return "art-starsweep-star-placed"
        case .correct, .missing: return "art-starsweep-star-correct"
        case .wrong: return "art-starsweep-star-wrong"
        case .cross: return "art-starsweep-cross"
        }
    }

    /// The drawn fallback (only if the art ever fails to load).
    var fallback: (symbol: String, color: Color)? {
        switch self {
        case .none: return nil
        case .placed: return ("star.fill", Color(hex: 0x1E2A5A))
        case .correct, .missing: return ("star.fill", Color(hex: 0x7C3AED))
        case .wrong: return ("star.fill", Color(hex: 0xF0435F))
        case .cross: return ("xmark", Color(hex: 0xA78BFA))
        }
    }
}

/// One piece image at `size` (the glyph box), decorative.
struct StarsweepGlyphView: View {
    let glyph: StarsweepGlyph
    let size: CGFloat

    var body: some View {
        Group {
            if let name = glyph.asset, ArtAsset.exists(name) {
                Image(name).resizable().interpolation(.high).scaledToFit()
                    .frame(width: glyph == .cross ? size * 0.86 : size, height: glyph == .cross ? size * 0.86 : size)
            } else if let f = glyph.fallback {
                Image(systemName: f.symbol)
                    .font(.system(size: size * (glyph == .cross ? 0.5 : 0.66), weight: .black))
                    .foregroundStyle(f.color)
            }
        }
        .opacity(glyph == .missing ? 0.42 : 1)
        .saturation(glyph == .missing ? 0.35 : 1)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - The cell

/// Which sides of a cell sit on a region border (the seam shows there).
struct StarsweepEdges: Equatable {
    var top = false, bottom = false, leading = false, trailing = false
}

/// The board's spacing for a `cell`-pt grid: the small gap between tiles of one
/// region and the extra seam inset where regions meet.
enum StarsweepMetrics {
    static func gap(_ cell: CGFloat) -> CGFloat { max(1.5, cell * 0.05) }
    static func seam(_ cell: CGFloat) -> CGFloat { max(1.25, cell * 0.035) }
    static func radius(_ tile: CGFloat) -> CGFloat { min(8, max(4, tile * 0.2)) }
    static func lip(_ cell: CGFloat) -> CGFloat { cell < 30 ? 1.25 : 1.5 }
}

/// The tile face + glyph, drawn as a turn-over: `progress` 0 → 1 rotates it edge-on
/// and back (a 2D stand-in for the 3D flip), swapping `before` → `after` at the half.
private struct StarsweepTileFace: View, Animatable {
    var progress: Double
    let before: StarsweepGlyph
    let after: StarsweepGlyph
    let tone: StarsweepTone
    let width: CGFloat
    let height: CGFloat
    let cell: CGFloat
    let hinted: Bool
    let focused: Bool

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let angle = (progress < 0.5 ? progress : 1 - progress) * .pi
        let swell = CGFloat(1 + 0.05 * sin(.pi * progress))
        let glyph = progress < 0.5 ? before : after
        let lip = StarsweepMetrics.lip(cell)
        let r = StarsweepMetrics.radius(min(width, height))
        let shape = RoundedRectangle(cornerRadius: r, style: .continuous)
        let dark = Theme.isDark
        ZStack(alignment: .top) {
            shape.fill(tone.lip)
            ZStack {
                shape.fill(LinearGradient(colors: [tone.faceTop, tone.faceBottom], startPoint: .top, endPoint: .bottom))
                // The faint lighter top gloss.
                RoundedRectangle(cornerRadius: max(2, r * 0.8), style: .continuous)
                    .fill(LinearGradient(colors: [Color.white.opacity(dark ? 0.14 : 0.6), Color.white.opacity(0)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: width * 0.84, height: (height - lip) * 0.42)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.top, (height - lip) * 0.06)
                    .allowsHitTesting(false)
                if hinted {
                    shape.strokeBorder(Color(hex: 0xF5C542).opacity(0.85), lineWidth: max(1.25, cell * 0.04))
                }
                StarsweepGlyphView(glyph: glyph, size: cell * 0.78)
                if focused {
                    shape.strokeBorder(Color(hex: 0x7C3AED), lineWidth: 2)
                }
            }
            .frame(width: width, height: height - lip)
        }
        .frame(width: width, height: height)
        .scaleEffect(x: swell, y: CGFloat(cos(angle)) * swell, anchor: .center)
    }
}

/// The state a cell animates on (mark + its hint / wrong flags change together).
private struct StarsweepCellKey: Equatable {
    let mark: Character
    let hinted: Bool
    let wrong: Bool
}

/// One Starsweep cell: its region bed (seams on region borders) and the candy tile
/// on top, with the §B3 motion. The caller wraps it in the cell's Button and labels it.
struct StarsweepCell: View {
    let mark: Character
    let hinted: Bool
    let wrong: Bool
    let missing: Bool
    let focused: Bool
    let region: Int
    let edges: StarsweepEdges
    let cell: CGFloat

    @State private var last: StarsweepCellKey?
    @State private var flip: Double = 1
    @State private var flipFrom: StarsweepGlyph = .none
    @State private var pop: Double = 1
    @State private var glow: CGFloat = 0
    @State private var glowColor: Color = .clear
    @State private var shake: CGFloat = 0
    @State private var generation = 0

    private var key: StarsweepCellKey { StarsweepCellKey(mark: mark, hinted: hinted, wrong: wrong) }

    var body: some View {
        let tone = StarsweepPalette.tone(region)
        let seam = StarsweepMetrics.seam(cell)
        let half = StarsweepMetrics.gap(cell) / 2
        let inset = EdgeInsets(top: half + (edges.top ? seam : 0), leading: half + (edges.leading ? seam : 0),
                               bottom: half + (edges.bottom ? seam : 0), trailing: half + (edges.trailing ? seam : 0))
        let w = cell - inset.leading - inset.trailing
        let h = cell - inset.top - inset.bottom
        let glyph = StarsweepGlyph(mark: mark, wrong: wrong, missing: missing)
        let box = CGSize(width: w, height: h)
        ZStack {
            // The region's bed; the board's seam color shows where regions meet.
            Rectangle().fill(tone.bed)
                .padding(EdgeInsets(top: edges.top ? seam : 0, leading: edges.leading ? seam : 0,
                                    bottom: edges.bottom ? seam : 0, trailing: edges.trailing ? seam : 0))
            StarsweepTileFace(progress: flip, before: flipFrom, after: glyph, tone: tone,
                              width: w, height: h, cell: cell, hinted: hinted, focused: focused)
                .modifier(KeyframeEffect(progress: pop, frames: TileMotion.popFrames, easing: TileMotion.popEasing,
                                         size: box, fadeIn: pop < 1))
                .shadow(color: glowColor.opacity(Double(glow)), radius: max(3, cell * 0.27) * glow)
                .modifier(NudgeEffect(animatableData: shake, scale: max(0.4, cell / 58)))
                .padding(inset)
        }
        .frame(width: cell, height: cell)
        .onAppear { last = key }
        .onChange(of: key) { new in animate(to: new) }
    }

    private func animate(to new: StarsweepCellKey) {
        let old = last
        last = new
        guard !Theme.reduceMotion, let old else {
            flip = 1; pop = 1; glow = 0; return
        }
        generation += 1
        let gen = generation
        if new.mark == "*" && old.mark != "*" {
            // Playing a star (or a hint placing one): the flip-and-glow.
            flipFrom = StarsweepGlyph(mark: old.mark, wrong: false, missing: false)
            var reset = Transaction()
            reset.disablesAnimations = true
            withTransaction(reset) { flip = 0; pop = 1; glow = 0 }
            DispatchQueue.main.async {
                withAnimation(.timingCurve(0.37, 0, 0.63, 1, duration: TileMotion.flip)) { flip = 1 }
            }
            let land = TileMotion.flip
            if new.hinted {
                glowColor = Color(hex: 0xF5C542).opacity(0.75)
                for k in 0..<2 {
                    let t = land + Double(k) * TileMotion.hintPulse
                    after(t, gen) { withAnimation(.easeInOut(duration: TileMotion.hintPulse / 2)) { glow = 1 } }
                    after(t + TileMotion.hintPulse / 2, gen) {
                        withAnimation(.easeInOut(duration: TileMotion.hintPulse / 2)) { glow = 0 }
                    }
                }
            } else {
                glowColor = new.wrong ? Color(hex: 0xF0435F).opacity(0.7) : Color(red: 150 / 255, green: 90 / 255, blue: 1).opacity(0.65)
                after(land, gen) {
                    withAnimation(.easeOut(duration: TileMotion.bloom * 0.35)) { glow = 1 }
                    if new.wrong { withAnimation(.linear(duration: TileMotion.nudge)) { shake = floor(shake) + 0.999 } }
                }
                after(land + TileMotion.bloom * 0.35, gen) {
                    withAnimation(.easeOut(duration: TileMotion.bloom * 0.65)) { glow = 0 }
                }
                if new.wrong {
                    after(land + TileMotion.nudge + 0.02, gen) {
                        var t = Transaction(); t.disablesAnimations = true
                        withTransaction(t) { shake = ceil(shake) }
                    }
                }
            }
        } else if (new.mark == "o" || new.mark == "x") && old.mark != "*" && old.mark != new.mark {
            // Placing a black star or a cross: the type pop.
            var reset = Transaction()
            reset.disablesAnimations = true
            withTransaction(reset) { flip = 1; pop = 0; glow = 0 }
            DispatchQueue.main.async {
                withAnimation(.linear(duration: TileMotion.pop)) { pop = 1 }
            }
        } else {
            var reset = Transaction()
            reset.disablesAnimations = true
            withTransaction(reset) { flip = 1; pop = 1; glow = 0 }
        }
    }

    /// Runs `body` after `delay` unless a newer change has started its own motion.
    private func after(_ delay: Double, _ gen: Int, _ body: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard gen == generation else { return }
            body()
        }
    }
}

// MARK: - Pad tools

/// A pad tool: a small round candy button with its icon, captioned underneath.
struct StarsweepTool: View {
    let label: String
    let symbol: String
    var variant: CandyButtonStyle.Variant = .peach
    var active: Bool = false
    var dim: Bool = false
    /// §BI22: a used count (Hint) — the gold corner coin on the circle, never in the caption.
    var count: Int = 0
    let action: () -> Void

    var body: some View {
        VStack(spacing: 3) {
            Button(action: action) {
                StarsweepToolIcon(symbol: symbol)
            }
            // Button family: a helper circle; the active tool wears the selected look.
            .buttonStyle(HelperButtonStyle(circle: true, selected: active))
            .hintCountBadge(count)
            .disabled(dim)
            .accessibilityLabel(count > 0 ? "\(label) (\(count) used)" : label)
            .accessibilityAddTraits(active ? .isSelected : [])
            Text(label)
                .font(Brand.font(10, .heavy))
                .foregroundStyle(dim ? FinishInk.secondary.opacity(0.55) : (active ? FinishInk.purple : FinishInk.secondary))
                .lineLimit(1).minimumScaleFactor(0.75)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
    }
}

/// The icon inside a round candy tool (white with the outline; dark purple on peach).
private struct StarsweepToolIcon: View {
    let symbol: String
    var body: some View {
        FamilyInkIcon(symbol: symbol)   // button family: the 3D icon in the helper's ink
    }
}

// MARK: - Status

/// The three mistake slots as small glossy dots (coral once used, frosted when free).
struct StarsweepMistakeDots: View {
    let used: Int
    let total: Int

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<total, id: \.self) { i in
                let on = i < used
                ZStack(alignment: .top) {
                    Circle().fill(on ? TilePalette.red.edge : Color(hex: 0xD8C8F3).opacity(Theme.isDark ? 0.35 : 0.8))
                    Circle()
                        .fill(on ? AnyShapeStyle(TilePalette.red.faceGradient)
                                 : AnyShapeStyle(Color.white.opacity(Theme.isDark ? 0.14 : 0.75)))
                        .padding(.bottom, 1.5)
                    Circle().fill(Color.white.opacity(on ? 0.45 : 0.3)).frame(width: 4, height: 2.5).padding(.top, 2)
                }
                .frame(width: 11, height: 11)
            }
        }
    }
}
