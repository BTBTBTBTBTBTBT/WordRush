import SwiftUI
import UIKit
import WordociousCore

// 2.8 item 6: the bubble-lettering renderer. ANY string is drawn from the glyph atlas
// (asset catalog `bubble-<name>`: A-Z 0-9 star ! ? , ' dot dash & — a neutral white base with
// shading) tinted per word; until the atlas ships (`BubbleText.atlasReady`) every line is drawn
// by `LiveHeadline` (the live headline font) through THIS SAME API, so switching is a drop-in
// of assets plus one flag. The fit — scale UP to fill the slot, down to a min, then a balanced
// 2-3 line wrap, never "..." — is core's `BubbleText.fit` (parity-pinned with web + Android).

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

    var body: some View {
        // `bubble_atlas` off-switch (fail-open): off = the live headline font everywhere.
        if BubbleText.atlasCovers(text) && FlagsService.shared.isLive("bubble_atlas") {
            BubbleAtlasLine(text: text, size: size, top: palette.top, bottom: palette.bottom)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(text)
                .accessibilityAddTraits(.isHeader)
        } else {
            // A safety scale (0.6) only ever bites when a font metric disagrees with the fit's
            // table by a hair; an exact fit never shrinks and NEVER truncates.
            LiveHeadline(text: text, palette: palette, size: size, names: names, alignment: .center,
                         maxLines: 1, minimumScale: 0.6, animated: animated)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// The atlas path: each glyph's PNG tinted by multiplying the word's gradient over the neutral
/// base and clipping to the glyph's own alpha (one composited layer per glyph, cached by SwiftUI).
private struct BubbleAtlasLine: View {
    let text: String
    let size: CGFloat
    let top: Color
    let bottom: Color

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(text.uppercased().enumerated()), id: \.offset) { _, ch in
                let w = CGFloat(BubbleText.widthEm(String(ch))) * size
                if ch == " " {
                    Color.clear.frame(width: w, height: size)
                } else if let name = BubbleText.glyphName(ch) {
                    let glyph = Image("bubble-\(name)").resizable().scaledToFit()
                    glyph
                        .overlay(LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom).blendMode(.multiply))
                        .compositingGroup()
                        .mask(glyph)
                        .frame(width: w, height: size * 1.1)
                } else {
                    Color.clear.frame(width: w, height: size)
                }
            }
        }
        .fixedSize()
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

    @State private var measured: CGFloat = 0

    var body: some View {
        let width = slotWidth ?? measured
        let dyn = min(UIFontMetrics.default.scaledValue(for: 100) / 100, Brand.maxScale)
        VStack(spacing: 0) {
            if width > 0 {
                let fit = BubbleText.fit(text, slotWidth: Double(width), maxSize: Double(maxSize), minSize: Double(minSize))
                ForEach(Array(fit.lines.enumerated()), id: \.offset) { _, line in
                    BubbleLineView(text: line, palette: palette, size: CGFloat(fit.size) / dyn, names: names, animated: animated)
                }
            } else {
                Color.clear.frame(height: maxSize)
            }
        }
        .frame(maxWidth: .infinity)
        .background(GeometryReader { g in Color.clear.preference(key: BubbleWidthKey.self, value: g.size.width) })
        .onPreferenceChange(BubbleWidthKey.self) { measured = $0 }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isHeader)
    }
}
