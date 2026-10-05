import SwiftUI
import UIKit
import WordociousCore

// The button FAMILY (founder 10-05: "let's prioritize getting all of the buttons designed… for the new build";
// docs/design/brand/buttons/family/README.md, gallery options.html). Everything that is not a primary cast button:
//   · helper pill  — the small game control (Delete · Shuffle · Hint · Check…): a pale wash of the GAME color in the
//                    ChatGPT frosted-jelly finish, a soft 3D white-clay icon + Nunito Black label in the deep tint
//   · quiet pill   — Not now / Skip / Sign out / See all: the same finish in lavender, deep-purple ink
//   · round icon   — the bare soft 3D icon (no bubble — founder rule for header icons)
//   · keys         — state fill + the key light map (KeyCap)
// Technique: FILL + LIGHT MAP. `art-fam-lm-*` is the ChatGPT gloss + shading as a white-or-black overlay with alpha;
// a plain fill under it becomes that color in the ChatGPT finish (any game tint, pressed, dark, colorblind palettes).
// `CandyButtonStyle` routes every old candy call site here (FamilyRouter), so ~110 call sites switch at once.
// Performance: the light maps are pre-scaled to each pill height at launch (FamilyArt.prewarm, from AppWarmup)
// and every icon is decoded off main, so nothing decodes or resamples on a presenting frame.
// Android: FamilyButtons.kt · web: components/ui/family-button.tsx.

enum FamilyMetrics {
    static let helperHeight: CGFloat = 34
    static let helperFont: CGFloat = 12.5
    static let helperIcon: CGFloat = 18
    static func quietHeight(_ s: CandyButtonStyle.Size) -> CGFloat {
        switch s {
        case .large: return 44
        case .medium: return 40
        case .small: return 34
        }
    }
    static let roundIcon: CGFloat = 28
}

/// The helper / quiet inks (README §1–2).
enum FamilyInk {
    static func helperFill(_ tint: Color, dark: Bool, pressed: Bool) -> Color {
        dark ? tint.mixed(over: Color(hex: 0x231C40), pressed ? 0.42 : 0.34) : tint.mixed(over: .white, pressed ? 0.27 : 0.20)
    }
    static func helperInk(_ tint: Color, dark: Bool) -> Color {
        dark ? Color.white.mixed(over: tint, 0.65) : Color.black.mixed(over: tint, 0.32)
    }
    static func quietFill(dark: Bool, pressed: Bool) -> Color {
        dark ? Color(hex: pressed ? 0x463A74 : 0x3B3163) : Color(hex: pressed ? 0xE2D7FF : 0xECE4FF)
    }
    static func quietInk(dark: Bool) -> Color { dark ? Color(hex: 0xDDD0FF) : Color(hex: 0x5B21B6) }

    /// An old candy variant's helper tint (outside a game screen).
    static func tint(_ v: CandyButtonStyle.Variant) -> Color {
        switch v {
        case .purple: return Color(hex: 0x7C3AED)
        case .pink: return Color(hex: 0xDB2777)
        case .amber: return Color(hex: 0xD97706)
        case .teal: return Color(hex: 0x0D9488)
        case .peach: return Color(hex: 0x7C6FA8)
        }
    }
}

/// SF Symbol → the family's white-clay 3D icon (README §1).
enum FamilyIcons {
    static let map: [String: String] = [
        "delete.left": "delete", "delete.left.fill": "delete", "shuffle": "shuffle", "return": "enter",
        "lightbulb": "hint", "lightbulb.fill": "hint", "eye": "eye", "eye.fill": "eye", "flag": "flag", "flag.fill": "flag",
        "checkmark": "check", "checkmark.circle": "check", "checkmark.circle.fill": "check",
        "arrow.uturn.backward": "undo", "arrow.uturn.left": "undo", "arrow.counterclockwise": "undo",
        "arrow.right": "next", "forward.fill": "next", "arrow.clockwise": "refresh", "repeat": "refresh",
        "sparkles": "sparkles", "pencil": "pencil", "eraser": "erase", "eraser.fill": "erase",
        "xmark": "xmark", "xmark.circle": "xmark", "xmark.circle.fill": "xmark", "play.fill": "play", "chart.bar.fill": "chart",
    ]
    static func art(_ symbol: String) -> String? { map[symbol].map { "art-fam-ic-\($0)" } }
    static var allArt: [String] { Array(Set(map.values)).map { "art-fam-ic-\($0)" } }
}

/// The decoded light maps (pre-scaled per height) + icons. Thread-safe; filled off main by `prewarm`.
final class FamilyArt: @unchecked Sendable {
    static let shared = FamilyArt()
    private let lock = NSLock()
    private var cache: [String: UIImage] = [:]

    private static var screenScale: CGFloat {
        let s = UITraitCollection.current.displayScale
        return s > 0 ? s : 3
    }

    /// Call on main at launch (AppWarmup.start): decodes every light map at every pill height + every icon.
    static func prewarm() {
        let scale = screenScale
        DispatchQueue.global(qos: .utility).async {
            let heights: [CGFloat] = [FamilyMetrics.helperHeight, 40, 44]
            for h in heights { for p in [false, true] { _ = shared.pill(pressed: p, height: h, scale: scale) } }
            for name in FamilyIcons.allArt + ["art-fam-cic-close", "art-fam-cic-info", "art-fam-cic-gem"] {
                _ = shared.image(name)
            }
            _ = shared.key()
        }
    }

    /// A decoded image (icons, the key light map at its native @3x).
    func image(_ name: String) -> UIImage? {
        lock.lock()
        if let hit = cache[name] { lock.unlock(); return hit }
        lock.unlock()
        guard let src = UIImage(named: name) else { return nil }
        let img = src.preparingForDisplay() ?? src
        lock.lock(); cache[name] = img; lock.unlock()
        return img
    }

    /// The key light map as a @3x image (124 × 150 px → 41.3 × 50 pt; nine-slice corners 31 px = 10.33 pt).
    func key() -> UIImage? {
        lock.lock()
        if let hit = cache["key@3"] { lock.unlock(); return hit }
        lock.unlock()
        guard let raw = UIImage(named: "art-fam-lm-key")?.cgImage else { return nil }
        let img = UIImage(cgImage: raw, scale: 3, orientation: .up)
        let out = img.preparingForDisplay() ?? img
        lock.lock(); cache["key@3"] = out; lock.unlock()
        return out
    }

    /// The frosted pill light map pre-scaled to `height` points (drawn 1:1, three-sliced with caps = h/2).
    func pill(pressed: Bool, height: CGFloat, scale: CGFloat) -> UIImage? {
        let name = pressed ? "art-fam-lm-frost-pressed" : "art-fam-lm-frost"
        let key = "\(name)@\(Int((height * scale).rounded()))"
        lock.lock()
        if let hit = cache[key] { lock.unlock(); return hit }
        lock.unlock()
        guard let src = UIImage(named: name), src.size.height > 0 else { return nil }
        let pxH = max(1, (height * scale).rounded())
        let px = CGSize(width: max(1, (src.size.width * pxH / src.size.height).rounded()), height: pxH)
        guard let thumb = src.preparingThumbnail(of: px), let cg = thumb.cgImage else { return nil }
        // Three-slice source: the two end caps (h/2 each) + the 1-px middle column, so only that column
        // stretches and a pill can be as narrow as a circle (w = h).
        let cap = Int(pxH / 2), w = cg.width
        guard w > 2 * cap,
              let left = cg.cropping(to: CGRect(x: 0, y: 0, width: cap, height: cg.height)),
              let mid = cg.cropping(to: CGRect(x: w / 2, y: 0, width: 1, height: cg.height)),
              let right = cg.cropping(to: CGRect(x: w - cap, y: 0, width: cap, height: cg.height)),
              let ctx = CGContext(data: nil, width: 2 * cap + 1, height: cg.height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return nil }
        let h = CGFloat(cg.height)
        ctx.draw(left, in: CGRect(x: 0, y: 0, width: CGFloat(cap), height: h))
        ctx.draw(mid, in: CGRect(x: CGFloat(cap), y: 0, width: 1, height: h))
        ctx.draw(right, in: CGRect(x: CGFloat(cap + 1), y: 0, width: CGFloat(cap), height: h))
        guard let sliced = ctx.makeImage() else { return nil }
        let out = UIImage(cgImage: sliced, scale: scale, orientation: .up)
        lock.lock(); cache[key] = out; lock.unlock()
        return out
    }
}

// MARK: - Environment: the label ink a family button hands its CandyLabel

struct FamilyLabelInk: Equatable {
    var ink: Color
    var size: CGFloat
    var icon: CGFloat
}

private struct FamilyInkKey: EnvironmentKey { static let defaultValue: FamilyLabelInk? = nil }

extension EnvironmentValues {
    /// Set by the helper / quiet pills for `CandyLabel` (nil = not a family pill).
    var familyInk: FamilyLabelInk? {
        get { self[FamilyInkKey.self] }
        set { self[FamilyInkKey.self] = newValue }
    }
}

// MARK: - Skin

/// A capsule fill + the frosted light map three-sliced over it (caps = h/2).
struct FamilyPillSkin: View {
    let fill: Color
    var pressed = false
    var dark = false
    let height: CGFloat
    @Environment(\.displayScale) private var scale

    var body: some View {
        ZStack {
            Capsule(style: .circular).fill(fill)
            if let ui = FamilyArt.shared.pill(pressed: pressed, height: height, scale: scale) {
                let cap = (ui.size.width - 1 / ui.scale) / 2
                Image(uiImage: ui)
                    .resizable(capInsets: EdgeInsets(top: 0, leading: cap, bottom: 0, trailing: cap), resizingMode: .stretch)
                    .opacity(dark ? 0.85 : 1)
            }
        }
        .accessibilityHidden(true)
    }
}

/// A family icon: the white-clay 3D art tinted by multiply, else the SF Symbol in the ink.
struct FamilyIcon: View {
    let symbol: String
    var size: CGFloat = FamilyMetrics.helperIcon
    let ink: Color

    var body: some View {
        if let name = FamilyIcons.art(symbol), let ui = FamilyArt.shared.image(name) {
            Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .colorMultiply(ink)
                .accessibilityHidden(true)
        } else {
            Image(systemName: symbol).font(.system(size: size * 0.78, weight: .black))
                .foregroundStyle(ink)
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        }
    }
}

/// The helper / quiet label: icon + Nunito Black uppercase in the ink (used by CandyLabel under a family pill).
struct FamilyLabelView<Icon: View>: View {
    let title: String
    let symbol: String?
    var subtitle: String? = nil
    let ink: FamilyLabelInk
    @ViewBuilder var icon: () -> Icon

    var body: some View {
        HStack(spacing: 5) {
            if let symbol { FamilyIcon(symbol: symbol, size: ink.icon, ink: ink.ink) }
            icon()
            if !title.isEmpty {
                VStack(spacing: 0) {
                    Text(title.uppercased())
                        .font(Brand.font(ink.size, .black)).tracking(ink.size * 0.02)
                        .lineLimit(1).minimumScaleFactor(0.75)
                    if let subtitle {
                        Text(subtitle).font(Brand.font(9, .heavy)).lineLimit(1).minimumScaleFactor(0.75).opacity(0.8)
                    }
                }
                .foregroundStyle(ink.ink)
                .accessibilityLabel(title)
            }
        }
    }
}

// MARK: - Styles

/// README §1: the game helper pill (34 pt), tinted by the screen's game color (or `tint`).
struct HelperButtonStyle: ButtonStyle {
    /// An explicit tint (overrides the game color).
    var tint: Color? = nil
    /// The tint off a game screen (on one, the game color wins).
    var fallback: Color? = nil
    var circle = false
    var fullWidth = false
    /// The "used" look (a spent hint): desaturated, half strength, still tappable.
    var used = false
    /// The "selected" look (an on state: Notes on, the active tool): the solid tint, white ink. Inside a game
    /// every helper shares the game color, so an on state reads by this, never by a hue change.
    var selected = false

    func makeBody(configuration: Configuration) -> some View {
        HelperBody(configuration: configuration, style: self)
    }

    private struct HelperBody: View {
        let configuration: Configuration
        let style: HelperButtonStyle
        @Environment(\.accessibilityReduceMotion) private var envReduce
        @Environment(\.isEnabled) private var enabled
        @Environment(\.colorScheme) private var scheme
        @Environment(\.pageTint) private var page

        var body: some View {
            let still = envReduce || Theme.reduceMotion
            let pressed = configuration.isPressed
            let dark = scheme == .dark
            let tint = style.tint ?? page.gameAccent ?? style.fallback ?? Color(hex: 0x7C3AED)
            let h = FamilyMetrics.helperHeight
            let ink = style.selected ? Color.white : FamilyInk.helperInk(tint, dark: dark)
            let fill = style.selected ? (pressed ? Color.black.mixed(over: tint, 0.12) : tint)
                                      : FamilyInk.helperFill(tint, dark: dark, pressed: pressed)
            let dim = style.used || !enabled
            configuration.label
                .environment(\.familyInk, FamilyLabelInk(ink: ink, size: FamilyMetrics.helperFont, icon: FamilyMetrics.helperIcon))
                .environment(\.castInk, nil)
                .foregroundStyle(ink)
                .offset(y: pressed ? 1 : 0)
                .padding(.leading, style.circle ? 0 : h * 0.34)
                .padding(.trailing, style.circle ? 0 : h * 0.42)
                .frame(maxWidth: style.fullWidth && !style.circle ? .infinity : nil)
                .frame(width: style.circle ? h : nil, height: h)
                .background { FamilyPillSkin(fill: fill, pressed: pressed, dark: dark, height: h) }
                .contentShape(Capsule())
                .saturation(dim ? 0.25 : 1)
                .opacity(dim ? 0.5 : 1)
                .scaleEffect(pressed && !still ? 0.94 : 1)
                .animation(still ? nil : (pressed ? .easeOut(duration: 0.08) : .spring(response: 0.26, dampingFraction: 0.5)), value: pressed)
                .onChange(of: configuration.isPressed) { Feedback.press($0) }
        }
    }
}

/// README §2: the quiet pill (Not now · Skip · Sign out · See all…).
struct QuietButtonStyle: ButtonStyle {
    var size: CandyButtonStyle.Size = .medium
    var fullWidth = false

    func makeBody(configuration: Configuration) -> some View {
        QuietBody(configuration: configuration, style: self)
    }

    private struct QuietBody: View {
        let configuration: Configuration
        let style: QuietButtonStyle
        @Environment(\.accessibilityReduceMotion) private var envReduce
        @Environment(\.isEnabled) private var enabled
        @Environment(\.colorScheme) private var scheme

        var body: some View {
            let still = envReduce || Theme.reduceMotion
            let pressed = configuration.isPressed
            let dark = scheme == .dark
            let h = FamilyMetrics.quietHeight(style.size)
            let ink = FamilyInk.quietInk(dark: dark)
            configuration.label
                .environment(\.familyInk, FamilyLabelInk(ink: ink, size: style.size == .small ? 12.5 : 13.5, icon: style.size == .small ? 17 : 19))
                .environment(\.castInk, nil)
                .foregroundStyle(ink)
                .offset(y: pressed ? 1 : 0)
                .padding(.horizontal, h * 0.45)
                .frame(maxWidth: style.fullWidth ? .infinity : nil)
                .frame(minWidth: h * 1.6)
                .frame(height: h)
                .background { FamilyPillSkin(fill: FamilyInk.quietFill(dark: dark, pressed: pressed), pressed: pressed, dark: dark, height: h) }
                .contentShape(Capsule())
                .opacity(enabled ? 1 : 0.5)
                .scaleEffect(pressed && !still ? 0.94 : 1)
                .animation(still ? nil : (pressed ? .easeOut(duration: 0.08) : .spring(response: 0.26, dampingFraction: 0.5)), value: pressed)
                .onChange(of: configuration.isPressed) { Feedback.press($0) }
        }
    }
}

/// README §3: a round icon button = the bare soft 3D icon (28 pt) in a 44 pt hit area, squish on press.
struct RoundIconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
            .scaleEffect(configuration.isPressed && !Theme.reduceMotion ? 0.9 : 1)
            .animation(Theme.reduceMotion ? nil : .spring(response: 0.25, dampingFraction: 0.55), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { Feedback.press($0) }
    }
}

/// The family close button: the soft 3D X (README §3).
struct FamilyCloseButton: View {
    var size: CGFloat = 26
    var label = "Close"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            if let ui = FamilyArt.shared.image("art-fam-cic-close") {
                Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                    .frame(width: size, height: size)
            }
        }
        .buttonStyle(RoundIconButtonStyle())
        .accessibilityLabel(label)
    }
}

/// The CandyButtonStyle router (README "Mapping"): small → helper, circle → helper circle, peach → quiet,
/// any other medium / large → the cast primary.
struct FamilyRouterBody: View {
    let configuration: ButtonStyleConfiguration
    let style: CandyButtonStyle
    @Environment(\.castColor) private var screen
    @Environment(\.pageTint) private var page

    /// On a game screen every helper takes the GAME color (one calm row, the board stays the star; the old
    /// pink / amber / teal candy mix read as a rainbow); off a game, the variant's own tint.
    private var explicitTint: Color? { nil }

    var body: some View {
        if style.circle {
            HelperButtonStyle(tint: explicitTint, fallback: FamilyInk.tint(style.variant), circle: true).makeBody(configuration: configuration)
        } else if style.size == .small, style.variant == .peach, page.gameAccent == nil {
            // A small quiet action off the game screens (Skip, Not now in a card).
            QuietButtonStyle(size: .small, fullWidth: style.fullWidth).makeBody(configuration: configuration)
        } else if style.size == .small {
            HelperButtonStyle(tint: explicitTint, fallback: FamilyInk.tint(style.variant), fullWidth: style.fullWidth)
                .makeBody(configuration: configuration)
        } else if style.variant == .peach {
            QuietButtonStyle(size: style.size, fullWidth: style.fullWidth).makeBody(configuration: configuration)
        } else {
            CastButtonStyle(color: style.variant.cast(screen: screen) ?? screen, size: style.size, fullWidth: style.fullWidth)
                .makeBody(configuration: configuration)
        }
    }
}

extension PageTint {
    /// The game screen's accent, nil on menu pages.
    var gameAccent: Color? {
        if case .game(let a, _) = self { return Color(hex: a) }
        return nil
    }
}

/// An icon-only label that takes the family pill's ink (falls back to the old outlined symbol).
struct FamilyInkIcon: View {
    let symbol: String
    var size: CGFloat = 14
    @Environment(\.familyInk) private var family

    var body: some View {
        if let family {
            FamilyIcon(symbol: symbol, size: family.icon, ink: family.ink)
        } else {
            OutlinedSymbol(name: symbol, size: size, width: 1.25)
        }
    }
}

/// README §5: the key light map nine-sliced over a key face (corners 10.33 pt).
struct FamilyKeyGloss: View {
    var body: some View {
        if let ui = FamilyArt.shared.key() {
            let c: CGFloat = 31 / 3
            Image(uiImage: ui)
                .resizable(capInsets: EdgeInsets(top: c, leading: c, bottom: c, trailing: c), resizingMode: .stretch)
                .opacity(Theme.isDark ? 0.85 : 1)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }
}

/// Hubbub: a rarer word's chip wears this tiny glossy gem on its top-right corner (13 pt, 6 right / 7 up).
struct RareWordGem: View {
    var body: some View {
        if let gem = FamilyArt.shared.image("art-fam-cic-gem") {
            Image(uiImage: gem).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                .frame(width: 13, height: 13).offset(x: 6, y: -7)
                .allowsHitTesting(false).accessibilityHidden(true)
        }
    }
}

#if DEBUG
/// Button family visual check (DEBUG): `-bj15Screen family` — helpers (normal / used / disabled) in four game
/// tints, quiet pills, the close X, candy switches + segmented, and key caps in every state, light + dark.
struct FamilyShowcaseBoard: View {
    @State private var on = true
    @State private var seg = false
    private let tints: [UInt] = [0xC026D3, 0x475569, 0xDC2626, 0x0284C7, 0xD97706]
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                    VStack(spacing: 8) {
                        ForEach(tints, id: \.self) { t in
                            HStack(spacing: 6) {
                                Button {} label: { CandyLabel(title: "Shuffle", symbol: "shuffle") }
                                    .buttonStyle(HelperButtonStyle(tint: Color(hex: t)))
                                Button {} label: { CandyLabel(title: "Hint", symbol: "lightbulb") }
                                    .buttonStyle(HelperButtonStyle(tint: Color(hex: t), used: true))
                                Button {} label: { CandyLabel(title: "Undo", symbol: "arrow.uturn.backward") }
                                    .buttonStyle(HelperButtonStyle(tint: Color(hex: t))).disabled(true)
                                Button {} label: { FamilyInkIcon(symbol: "xmark") }
                                    .buttonStyle(HelperButtonStyle(tint: Color(hex: t), circle: true))
                            }
                        }
                        HStack(spacing: 8) {
                            Button {} label: { CandyLabel(title: "Not now") }.buttonStyle(QuietButtonStyle())
                            Button {} label: { CandyLabel(title: "Sign out") }.buttonStyle(QuietButtonStyle(size: .small))
                            FamilyCloseButton {}
                        }
                        HStack {
                            SoftSegmented(options: [(key: false, label: "Everyone"), (key: true, label: "Friends")], selection: $seg)
                            Toggle(isOn: $on) { Text("Sound").font(Brand.font(14, .black)) }.toggleStyle(.candy)
                        }
                        HStack(spacing: 4) {
                            KeyCap(state: nil, height: 50) { Text("Q").font(Brand.font(18, .black)) }
                            KeyCap(state: .correct, height: 50) { Text("W").font(Brand.font(18, .black)) }
                            KeyCap(state: .present, height: 50) { Text("E").font(Brand.font(18, .black)) }
                            KeyCap(state: .absent, height: 50) { Text("R").font(Brand.font(18, .black)) }
                            KeyCap(state: nil, height: 50, width: 54) { Text("ENTER").font(Brand.font(11, .black)) }
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(scheme == .dark ? Color(hex: 0x1E1838) : Color(hex: 0xF3EEFF))
                    .environment(\.colorScheme, scheme)
                }
            }
            .padding(14)
        }
    }
}
#endif
