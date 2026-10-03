import SwiftUI
import UIKit
import WordociousCore

// FINISH_SPEC §AR: live lettering for the rotating, personalized headlines. Drawn
// in code (they change all day, so they can't be pre-made art) in the title-art
// style: Nunito Black caps with tight tracking, a vertical gradient fill per
// palette, a thin outline behind the fill, a 3-step 3D edge underneath in the
// palette's deep shade, a soft white gloss over the top ~40% and a soft drop
// shadow. Tokens (core `HeadlineTokens`): NUMBERS as soft numbers a touch bigger,
// the NAME in the palette's accent gradient, "·" as the tiny gold star sprite.
// Motion: on first show and whenever the text changes the line pops in, revealed
// left → right (25 ms a letter) with a tiny tick; idle = a slow gloss sweep every
// ~6 s. Reduce Motion / Low Power: no pop, no sweep.
//
// Cost: every static layer (outline, edge, fill, gloss) is one Text layout
// rasterized together by `.drawingGroup()`; only the sweep band moves on top.

/// A headline palette (fill top → bottom, the deep 3D edge, the outline, the
/// name accent, the number ink).
struct HeadlinePalette: Equatable {
    var top: Color
    var bottom: Color
    var deep: Color
    var outline: Color
    var nameTop: Color
    var nameBottom: Color
    var numberTop: Color
    var numberBottom: Color
    /// Celebration sparkle (gold palette).
    var sparkle = false

    private static let goldTop = Color(hex: 0xFFE07A)
    private static let goldBottom = Color(hex: 0xF5A524)
    private static let gold = Color(hex: 0xF5C542)

    /// Home banner: purple → magenta, gold numbers.
    static let home = HeadlinePalette(top: Color(hex: 0xA855F7), bottom: Color(hex: 0xDB2777), deep: Color(hex: 0x4C1D95),
                                      outline: gold, nameTop: Color(hex: 0xF472B6), nameBottom: Color(hex: 0xF97316),
                                      numberTop: goldTop, numberBottom: goldBottom)
    /// Friends race: pink → orange.
    static let friends = HeadlinePalette(top: Color(hex: 0xF472B6), bottom: Color(hex: 0xF97316), deep: Color(hex: 0x9D174D),
                                         outline: gold, nameTop: Color(hex: 0xA855F7), nameBottom: Color(hex: 0x6D28D9),
                                         numberTop: goldTop, numberBottom: goldBottom)
    /// Leaderboard / Records: gold → amber (numbers + names in purple so they read on gold).
    static let leaderboard = HeadlinePalette(top: Color(hex: 0xFCD34D), bottom: Color(hex: 0xF59E0B), deep: Color(hex: 0x92400E),
                                             outline: Color(hex: 0xFFF7D6), nameTop: Color(hex: 0xA855F7), nameBottom: Color(hex: 0x6D28D9),
                                             numberTop: Color(hex: 0xA855F7), numberBottom: Color(hex: 0x6D28D9))
    /// VS: teal → blue.
    static let vs = HeadlinePalette(top: Color(hex: 0x2DD4BF), bottom: Color(hex: 0x3B82F6), deep: Color(hex: 0x1E3A8A),
                                    outline: gold, nameTop: Color(hex: 0xF472B6), nameBottom: Color(hex: 0xDB2777),
                                    numberTop: goldTop, numberBottom: goldBottom)
    /// Stats: blue → violet.
    static let stats = HeadlinePalette(top: Color(hex: 0x60A5FA), bottom: Color(hex: 0x8B5CF6), deep: Color(hex: 0x3730A3),
                                       outline: gold, nameTop: Color(hex: 0xF472B6), nameBottom: Color(hex: 0xDB2777),
                                       numberTop: goldTop, numberBottom: goldBottom)
    /// FINISH_SPEC BB1: a game's own accent (light → accent, a deep edge).
    static func accent(_ c: Color) -> HeadlinePalette {
        HeadlinePalette(top: Color.white.mixed(over: c, 0.3), bottom: c, deep: Color.black.mixed(over: c, 0.45),
                        outline: Color(hex: 0xF5C542), nameTop: Color(hex: 0xF472B6), nameBottom: Color(hex: 0xDB2777),
                        numberTop: Color(hex: 0xFFE07A), numberBottom: Color(hex: 0xF5A524))
    }
    /// Celebrations (DOUBLE SWEEP!, FLAWLESS): gold with sparkle.
    static let celebration = HeadlinePalette(top: Color(hex: 0xFFE07A), bottom: Color(hex: 0xF59E0B), deep: Color(hex: 0x92400E),
                                             outline: Color(hex: 0xFFF7D6), nameTop: Color(hex: 0xA855F7), nameBottom: Color(hex: 0x6D28D9),
                                             numberTop: Color(hex: 0xA855F7), numberBottom: Color(hex: 0x6D28D9), sparkle: true)
}

/// The star sprite (and a same-size clear stand-in for the layers that must not
/// repeat it), rendered once per point size.
private enum HeadlineStar {
    private static var cache: [Int: (star: UIImage, clear: UIImage)] = [:]

    static func images(points: CGFloat) -> (star: UIImage, clear: UIImage) {
        let key = Int((points * 2).rounded())
        if let hit = cache[key] { return hit }
        let side = max(6, points)
        let size = CGSize(width: side, height: side)
        let fmt = UIGraphicsImageRendererFormat.preferred()
        fmt.opaque = false
        let r = UIGraphicsImageRenderer(size: size, format: fmt)
        let src = UIImage(named: "art-badge-icon-star-sprite")
        let star = r.image { _ in
            if let src {
                src.draw(in: CGRect(origin: .zero, size: size))
            } else {
                UIColor(red: 0.96, green: 0.77, blue: 0.26, alpha: 1).setFill()
                UIBezierPath(ovalIn: CGRect(origin: .zero, size: size).insetBy(dx: side * 0.25, dy: side * 0.25)).fill()
            }
        }
        let clear = r.image { _ in }
        cache[key] = (star, clear)
        return (star, clear)
    }
}

struct LiveHeadline: View {
    let text: String
    var palette: HeadlinePalette = .home
    var size: CGFloat = 22
    /// Names to style with the accent gradient (any case).
    var names: [String] = []
    var alignment: TextAlignment = .center
    var maxLines: Int = 2
    /// Shrink to fit before wrapping (one line first).
    var minimumScale: CGFloat = 0.6
    /// Pop in on first show / text change.
    var animated: Bool = true

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @ObservedObject private var scroll = ScrollMotion.shared
    @State private var reveal: CGFloat = 1
    @State private var pop: CGFloat = 1
    @State private var sweep: CGFloat = -0.4
    @State private var shownText: String?

    private var calm: Bool { Motion.calm(envReduceMotion) }
    /// Before the first entrance runs: hidden, so the first frame never flashes
    /// the whole line ahead of its pop.
    private var pending: Bool { animated && !calm && shownText == nil && !Self.played.contains(text) }
    private var tokens: [HeadlineToken] { HeadlineTokens.split(text.uppercased(), names: names) }

    /// The tracked caps font (numbers ride 12% bigger).
    private func font(_ number: Bool) -> Font { Brand.font(number ? size * 1.12 : size, .black) }

    private enum Layer { case fillTop, fillBottom, solid }

    /// One full Text of the headline for a layer. `colors`: per-token color for the
    /// layer; `star`: whether the separator shows the sprite (else a clear stand-in).
    private func line(_ color: (HeadlineTokenKind) -> Color, star: Bool) -> Text {
        let imgs = HeadlineStar.images(points: size * 0.62)
        var out = Text("")
        for t in tokens {
            switch t.kind {
            case .star:
                out = out + Text(Image(uiImage: star ? imgs.star : imgs.clear)).baselineOffset(size * 0.06)
            case .number:
                out = out + Text(t.text).font(font(true)).foregroundColor(color(.number))
            default:
                out = out + Text(t.text).font(font(false)).foregroundColor(color(t.kind))
            }
        }
        return out
    }

    private func styled(_ t: Text) -> some View {
        t.tracking(size * 0.01)
            .multilineTextAlignment(alignment)
            .lineLimit(maxLines)
            .minimumScaleFactor(minimumScale)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func top(_ k: HeadlineTokenKind) -> Color {
        switch k { case .number: return palette.numberTop; case .name: return palette.nameTop; default: return palette.top }
    }
    private func bottom(_ k: HeadlineTokenKind) -> Color {
        switch k { case .number: return palette.numberBottom; case .name: return palette.nameBottom; default: return palette.bottom }
    }

    /// The static lettering: outline, 3D edge, two-tone fill, gloss — one raster.
    private var lettering: some View {
        let o = max(1, size * 0.06)
        let outline = styled(line({ _ in palette.outline }, star: false))
        let edge = styled(line({ _ in palette.deep }, star: false))
        return ZStack {
            // Outline: the gold glyphs nudged around the fill (drawn behind it).
            ForEach(0..<8, id: \.self) { k in
                let a = Double(k) * .pi / 4
                outline.offset(x: CGFloat(cos(a)) * o, y: CGFloat(sin(a)) * o)
            }
            // The 3D edge: three 1-step offsets down in the deep shade.
            ForEach(1...3, id: \.self) { k in
                edge.offset(y: CGFloat(k) * max(1, size * 0.045))
            }
            // Fill: bottom colors, then the top colors fading out downward.
            styled(line(bottom, star: true))
            styled(line(top, star: true))
                .mask(LinearGradient(colors: [.white, .white.opacity(0)], startPoint: .top, endPoint: .bottom))
            // Gloss on the top ~40%.
            styled(line({ _ in .white }, star: false))
                .mask(LinearGradient(stops: [.init(color: .white.opacity(0.5), location: 0),
                                             .init(color: .white.opacity(0), location: 0.42)],
                                     startPoint: .top, endPoint: .bottom))
        }
        .padding(o + 1)
        .padding(.bottom, size * 0.14)
        .drawingGroup()
    }

    /// The glyphs alone (same layout + padding as `lettering`), for the sweep's mask.
    private var glyphMask: some View {
        styled(line({ _ in .white }, star: true))
            .padding(max(1, size * 0.06) + 1)
            .padding(.bottom, size * 0.14)
    }

    var body: some View {
        lettering
            .overlay {
                // Idle: the slow gloss sweep (a soft band masked to the glyphs).
                if !calm {
                    GeometryReader { g in
                        LinearGradient(colors: [.white.opacity(0), .white.opacity(0.55), .white.opacity(0)],
                                       startPoint: .leading, endPoint: .trailing)
                            .frame(width: g.size.width * 0.3)
                            .offset(x: g.size.width * sweep)
                    }
                    .mask(glyphMask)
                    .allowsHitTesting(false)
                }
            }
            .mask(alignment: .leading) {
                GeometryReader { g in
                    Rectangle().frame(width: g.size.width * (pending ? 0 : reveal))
                }
            }
            .scaleEffect(pending ? 0.6 : pop, anchor: .center)
            .shadow(color: palette.deep.opacity(0.28), radius: size * 0.12, x: 0, y: size * 0.08)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text.capitalized)
            .accessibilityAddTraits(.isHeader)
            .onAppear { entrance() }
            .onChange(of: text) { _ in entrance() }
            .task(id: text) { await idleSweep() }
    }

    private func entrance() {
        guard shownText != text else { return }
        shownText = text
        // Perf audit: each headline pops in on its FIRST appearance per launch only —
        // returning to a tab rebuilt every headline and replayed 16 entrances at once.
        guard animated, !calm, !Self.played.contains(text) else { reveal = 1; pop = 1; return }
        Self.played.insert(text)
        let letters = max(1, text.count)
        let dur = min(0.9, Double(letters) * 0.025)
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) { reveal = 0; pop = 0.6 }
        // Next turn, so the reset lands before the animation starts from it.
        DispatchQueue.main.async {
            withAnimation(.linear(duration: dur)) { reveal = 1 }
            withAnimation(.spring(response: 0.28, dampingFraction: 0.55)) { pop = 1 }
        }
        // BI7: rotating headlines are silent — they change on their own, not on a tap.
    }

    /// Headline texts that already played their entrance this launch.
    private static var played: Set<String> = []

    private func idleSweep() async {
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 6_000_000_000)
            guard !Task.isCancelled else { return }
            if calm || scroll.scrolling { continue }
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) { sweep = -0.4 }
            try? await Task.sleep(nanoseconds: 50_000_000)
            withAnimation(.easeInOut(duration: 1.1)) { sweep = 1.1 }
        }
    }
}
