import SwiftUI
import UIKit
import WordociousCore

// 2.8 item 6: the bubble-lettering renderer. ANY string is drawn from the glyph atlas (asset catalog
// `bubble-<stem>`: A-Z 0-9 star excl quest comma apos dot hyphen amp period colon plus percent — tint MAPS, see
// BubbleGlyphTint) tinted per word through THIS API; a line the atlas can't cover (or with the `bubble_atlas`
// switch off) is drawn by `LiveHeadline` (the live headline font). The fit — scale UP to fill the slot, down to
// a min, then a balanced 2-3 line wrap, never "..." — is core's `BubbleText.fit` (parity-pinned with web + Android).

private struct BubbleWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// One fitted line: the atlas when it covers the whole line, else the live font.
struct BubbleLineView: View {
    let text: String
    var palette: HeadlinePalette = .home
    var size: CGFloat
    var names: [String] = []
    var animated: Bool = true
    var alignment: TextAlignment = .center

    var body: some View {
        // `bubble_atlas` off-switch (fail-open): off = the live headline font everywhere.
        if BubbleText.atlasCovers(text) && FlagsService.shared.isLive("bubble_atlas") {
            // The fit measured the line at `size * Dynamic Type`; draw the atlas at that same size.
            let dyn = min(UIFontMetrics.default.scaledValue(for: 100) / 100, Brand.maxScale)
            BubbleAtlasLine(text: text, size: size * dyn, palette: palette, names: names, alignment: alignment)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(text)
                .accessibilityAddTraits(.isHeader)
        } else {
            // A safety scale (0.6) only ever bites when a font metric disagrees with the fit's
            // table by a hair; an exact fit never shrinks and NEVER truncates.
            LiveHeadline(text: text, palette: palette, size: size, names: names, alignment: alignment,
                         maxLines: 1, minimumScale: 0.6, animated: animated)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// The atlas path: one tinted glyph image per placed glyph (core layout, cap-height units), numbers gold, names in the accent.
private struct BubbleAtlasLine: View {
    let text: String
    let size: CGFloat
    let palette: HeadlinePalette
    let names: [String]
    let alignment: TextAlignment
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion

    var body: some View {
        let layout = BubbleText.atlasLayout(text)
        let cap = size * CGFloat(BubbleText.capEm)
        let kinds = Self.kinds(text, names)
        let still = Motion.calm(envReduceMotion)
        ZStack(alignment: .topLeading) {
            ForEach(Array(layout.places.enumerated()), id: \.offset) { i, g in
                let kind = g.ci < kinds.count ? kinds[g.ci] : .text
                let tint: (Color, Color) = kind == .number ? (palette.numberTop, palette.numberBottom)
                    : (kind == .name ? (palette.nameTop, palette.nameBottom) : (palette.top, palette.bottom))
                BubbleGlyphView(stem: g.stem, w: CGFloat(g.w) * cap, h: CGFloat(g.h) * cap,
                                f0: g.y - (layout.asc - 1), f1: g.y + g.h - (layout.asc - 1), top: tint.0, bottom: tint.1)
                    .modifier(BubbleGlyphPop(index: i, still: still))
                    // Keyed by position + glyph: only a glyph that CHANGED remounts and pops.
                    .id("\(i)-\(g.stem)-\(g.ci)")
                    .offset(x: CGFloat(g.x) * cap, y: CGFloat(g.y) * cap)
            }
        }
        .frame(width: CGFloat(layout.width) * cap, height: CGFloat(layout.asc + layout.desc) * cap, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : (alignment == .trailing ? .trailing : .center))
    }

    /// The token kind of every character (code point), so numbers and names can wear their own tint.
    private static func kinds(_ text: String, _ names: [String]) -> [HeadlineTokenKind] {
        var out: [HeadlineTokenKind] = []
        for t in HeadlineTokens.split(text.uppercased(), names: names) {
            out.append(contentsOf: Array(repeating: t.kind, count: t.text.unicodeScalars.count))
        }
        return out
    }
}

/// One tinted glyph (cached bitmap, see BubbleGlyphTint).
private struct BubbleGlyphView: View {
    let stem: String
    let w: CGFloat
    let h: CGFloat
    let f0: Double
    let f1: Double
    let top: Color
    let bottom: Color

    var body: some View {
        if let ui = BubbleGlyphTint.glyph(stem: stem, width: w, height: h, f0: f0, f1: f1, top: top, bottom: bottom) {
            Image(uiImage: ui).resizable().interpolation(.high).frame(width: w, height: h)
                .shadow(color: Color(hex: 0x1E0A46).opacity(0.2), radius: 1.5, x: 0, y: 1.5)
        } else {
            Color.clear.frame(width: w, height: h)
        }
    }
}

/// Any changing headline: measures its slot, fits it (core fit), draws each line centered.
struct BubbleTextView: View {
    let text: String
    var palette: HeadlinePalette = .home
    var names: [String] = []
    var maxSize: CGFloat = 38
    var minSize: CGFloat = 26
    /// Fixed slot width; nil = measure the container.
    var slotWidth: CGFloat?
    var animated: Bool = true
    var alignment: TextAlignment = .center

    @State private var measured: CGFloat = 0

    var body: some View {
        let width = slotWidth ?? measured
        // Item 25: a non-default theme tints page headlines with its accent (a season / the gold celebration keep theirs).
        let palette = (SeasonKit.current == nil && self.palette != .celebration) ? (ThemeKit.headlineAccent.map { HeadlinePalette.accent($0) } ?? self.palette) : self.palette
        let dyn = min(UIFontMetrics.default.scaledValue(for: 100) / 100, Brand.maxScale)
        VStack(alignment: alignment == .leading ? .leading : (alignment == .trailing ? .trailing : .center), spacing: 0) {
            if width > 0 {
                let fit = BubbleText.fit(text, slotWidth: Double(width), maxSize: Double(maxSize), minSize: Double(minSize))
                ForEach(Array(fit.lines.enumerated()), id: \.offset) { _, line in
                    BubbleLineView(text: line, palette: palette, size: CGFloat(fit.size) / dyn, names: names, animated: animated, alignment: alignment)
                }
            } else {
                Color.clear.frame(height: maxSize)
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : (alignment == .trailing ? .trailing : .center))
        .background(GeometryReader { g in Color.clear.preference(key: BubbleWidthKey.self, value: g.size.width) })
        .onPreferenceChange(BubbleWidthKey.self) { measured = $0 }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isHeader)
    }
}

/// The staggered bounce-in (25 ms a glyph) on first show, and the pop of a glyph whose character
/// changed. Reduce Motion / Low Power = static.
private struct BubbleGlyphPop: ViewModifier {
    let index: Int
    let still: Bool
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(shown || still ? 1 : 0.6)
            .opacity(shown || still ? 1 : 0)
            .onAppear {
                guard !still else { return }
                withAnimation(.spring(response: 0.28, dampingFraction: 0.55).delay(Double(index) * 0.025)) { shown = true }
            }
    }
}
