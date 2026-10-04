import SwiftUI
import UIKit

// FINISH_SPEC BJ15 — cast-color buttons + art labels (docs/design/brand/buttons/cast/README.md,
// cast/labels.json, labels/labels.json). One shared button for every primary candy CTA:
//   · skin   art-btn-<color>-<s|m|l>[-pressed][-dark] (three-slice; only the middle column stretches)
//   · label  art-btnlabel-<slug> (ChatGPT/API lettering) at ONE cap height = 0.42 × the button height;
//            dynamic text (names, prices, countdowns…) → the live Nunito Black fallback at the same cap height
//   · width  label + 2 × max(0.6 × h, 14 pt @44) — the button widens; a fixed-width slot shrinks the label
//   · press  the -pressed skin + the label drops 1 pt + the existing squish; dark mode = the -dark skins
// Performance (founder rule #1): every skin and every label is decoded off main at launch
// (`CastArt.prewarm`, from AppWarmup) and the labels are pre-scaled to their exact pixel size per
// button size, so nothing decodes or resamples on a presenting frame or during a tap.

/// The menu cast colors (the same mapping as the cast titles).
enum CastColor: String, CaseIterable {
    case purple, teal, green, blue, gold, slate, orange, pink

    /// labels.json `stroke` / `shadow`: a deeper shade of the same hue.
    var deep: Color {
        switch self {
        case .purple: return Color(hex: 0x4F0192)
        case .gold: return Color(hex: 0x936801)
        case .slate: return Color(hex: 0x3B3F51)
        case .orange: return Color(hex: 0x934400)
        case .pink: return Color(hex: 0x931048)
        case .teal: return Color(hex: 0x016774)
        case .green: return Color(hex: 0x1A7724)
        case .blue: return Color(hex: 0x003091)
        }
    }

    /// Per-screen colors: Stats slate, Puzzles teal, Go Pro gold, Friends pink, VS blue,
    /// WOTD green, Guides orange; everything else purple.
    static let stats = CastColor.slate, puzzles = CastColor.teal, goPro = CastColor.gold,
               friends = CastColor.pink, vs = CastColor.blue, wotd = CastColor.green, guides = CastColor.orange
}

extension CandyButtonStyle.Size {
    /// The cast skin heights: s 32 · m 44 · l 56.
    var castHeight: CGFloat {
        switch self {
        case .large: return 56
        case .medium: return 44
        case .small: return 32
        }
    }
    var castKey: String {
        switch self {
        case .large: return "l"
        case .medium: return "m"
        case .small: return "s"
        }
    }
}

/// The label-art slugs, keyed by the label's letters (uppercased, A–Z / 0–9 only),
/// with each image's aspect (width / height, trimmed to the letters). ship-labels.py prints this.
enum CastLabels {
    static let art: [String: (slug: String, aspect: CGFloat)] = [
        "PLAY": ("play", 3.125), "SIGNIN": ("signin", 4.5938), "DONE": ("done", 3.4792),
        "GOPRO": ("gopro", 4.7396), "REMATCH": ("rematch", 5.9792), "HINT": ("hint", 2.8021),
        "ADDAFRIEND": ("addfriend", 5.9167), "TAKETHETOUR": ("tour", 8.3229), "SEEALL": ("seeall", 4.3125),
        "SHARERESULTS": ("shareresults", 8.4792), "SHARE": ("share", 3.6458), "ACCEPT": ("accept", 4.2604),
        "NEXT": ("next", 2.8229), "PLAYAGAIN": ("playagain", 6.4583), "TRYAGAIN": ("tryagain", 5.9062),
        "DECLINE": ("decline", 4.6354), "SENDAGIFT": ("sendgift", 6.7604), "UPGRADETOPRO": ("upgrade", 9.5312),
        "GOTIT": ("gotit", 3.6771), "SEEPRO": ("seepro", 4.6042), "LETSPLAY": ("letsplay", 5.2292),
        "CHALLENGETHEM": ("challengethem", 9.2917), "SEEFRIENDS": ("seefriends", 6.1146),
        "STARTPLAYING": ("startplaying", 7.4479), "UNDO": ("undo", 2.9167), "CONTINUE": ("continue", 4.9271),
        "HOWTOPLAY": ("howtoplay", 7.1354), "SKIP": ("skip", 2.4792), "SHARELINK": ("sharelink", 6.5208),
        "ERASE": ("erase", 3.4167), "KEEPPLAYING": ("keepplaying", 6.7292), "SAVE": ("save", 2.7917),
        "NOTNOW": ("notnow", 5.1458), "START": ("start", 3.4479), "SIGNUP": ("signup", 3.875),
        "INVITE": ("invite", 3.1875), "HEADS": ("heads", 3.1562), "TAILS": ("tails", 2.7292),
        "COPIED": ("copied", 3.6562),
    ]

    static func key(_ text: String) -> String {
        String(text.uppercased().unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) && $0.isASCII }
            .map(Character.init))
    }

    static func lookup(_ text: String) -> (slug: String, aspect: CGFloat)? { art[key(text)] }

    /// The cap height (points) for a button `height`, snapped to whole pixels so the
    /// pre-scaled label draws 1:1.
    static func capHeight(_ height: CGFloat, scale: CGFloat) -> CGFloat {
        (height * 0.42 * scale).rounded() / scale
    }

    /// The inset from each cap: max(0.6 × h, 14 pt at 44).
    static func inset(_ height: CGFloat) -> CGFloat { max(0.6 * height, 14 * height / 44) }
}

/// The decoded skins + pre-scaled labels (thread-safe; filled off main by `prewarm`).
final class CastArt: @unchecked Sendable {
    static let shared = CastArt()
    private let lock = NSLock()
    private var skins: [String: UIImage] = [:]
    private var labels: [String: UIImage] = [:]
    private static let sizes: [CandyButtonStyle.Size] = [.large, .medium, .small]

    private static var screenScale: CGFloat {
        let s = UITraitCollection.current.displayScale
        return s > 0 ? s : 3
    }

    /// Decode every skin and every label (at each button size's exact pixel height) on a
    /// utility thread. Call on main at launch (AppWarmup.start).
    static func prewarm() {
        let scale = screenScale
        DispatchQueue.global(qos: .utility).async {
            for c in CastColor.allCases {
                for sz in sizes {
                    for p in [false, true] { for d in [false, true] { _ = shared.skin(c, sz, pressed: p, dark: d) } }
                }
            }
            for (_, v) in CastLabels.art {
                for sz in sizes { _ = shared.label(v.slug, height: CastLabels.capHeight(sz.castHeight, scale: scale), scale: scale) }
            }
        }
    }

    /// A skin as a @3x image whose middle 1-px column stretches.
    func skin(_ c: CastColor, _ sz: CandyButtonStyle.Size, pressed: Bool, dark: Bool) -> UIImage? {
        let name = "art-btn-\(c.rawValue)-\(sz.castKey)\(pressed ? "-pressed" : "")\(dark ? "-dark" : "")"
        lock.lock()
        if let hit = skins[name] { lock.unlock(); return hit }
        lock.unlock()
        guard let raw = UIImage(named: name)?.cgImage else { return nil }
        let img = UIImage(cgImage: raw, scale: 3, orientation: .up)
        let decoded = img.preparingForDisplay() ?? img
        lock.lock(); skins[name] = decoded; lock.unlock()
        return decoded
    }

    /// A label pre-scaled to `height` points at `scale` (drawn 1:1 — never resampled on screen).
    func label(_ slug: String, height: CGFloat, scale: CGFloat) -> UIImage? {
        let key = "\(slug)@\(Int((height * scale).rounded()))"
        lock.lock()
        if let hit = labels[key] { lock.unlock(); return hit }
        lock.unlock()
        guard let src = UIImage(named: "art-btnlabel-\(slug)"), src.size.height > 0 else { return nil }
        let px = CGSize(width: max(1, (src.size.width * src.scale * height * scale / (src.size.height * src.scale)).rounded()),
                        height: max(1, (height * scale).rounded()))
        guard let thumb = src.preparingThumbnail(of: px), let cg = thumb.cgImage else { return nil }
        let out = UIImage(cgImage: cg, scale: scale, orientation: .up)
        lock.lock(); labels[key] = out; lock.unlock()
        return out
    }
}

// MARK: - Environment: the screen's cast color

private struct CastColorKey: EnvironmentKey { static let defaultValue: CastColor = .purple }
/// Set by `CastButtonStyle` for `CandyLabel` (nil = a plain candy button).
private struct CastInkKey: EnvironmentKey { static let defaultValue: CastInk? = nil }

struct CastInk: Equatable {
    var color: CastColor
    var height: CGFloat
}

extension EnvironmentValues {
    /// The screen's cast color (default purple) — `CastButtonStyle()` without a color uses it.
    var castColor: CastColor {
        get { self[CastColorKey.self] }
        set { self[CastColorKey.self] = newValue }
    }
    var castInk: CastInk? {
        get { self[CastInkKey.self] }
        set { self[CastInkKey.self] = newValue }
    }
}

extension View {
    /// FINISH_SPEC BJ15: the cast color of every `CastButtonStyle()` under this screen.
    func castColor(_ c: CastColor) -> some View { environment(\.castColor, c) }
}

// MARK: - The button

/// FINISH_SPEC BJ15 THE primary button: a cast-color skin with an art label. Use with
/// `CandyLabel(title:)` (the label art is looked up by its text; dynamic text falls back
/// to live lettering). `color` nil = the screen's `castColor`.
struct CastButtonStyle: ButtonStyle {
    var color: CastColor? = nil
    var size: CandyButtonStyle.Size = .large
    var fullWidth: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        CastBody(configuration: configuration, style: self)
    }

    private struct CastBody: View {
        let configuration: Configuration
        let style: CastButtonStyle
        @Environment(\.accessibilityReduceMotion) private var envReduce
        @Environment(\.isEnabled) private var enabled
        @Environment(\.colorScheme) private var scheme
        @Environment(\.castColor) private var screenColor

        var body: some View {
            let still = envReduce || Theme.reduceMotion
            let pressed = configuration.isPressed
            let c = style.color ?? screenColor
            let h = style.size.castHeight
            configuration.label
                .environment(\.castInk, CastInk(color: c, height: h))
                .offset(y: pressed ? 1 : 0)   // labels.json pressedDropPt
                .padding(.horizontal, CastLabels.inset(h))
                .frame(maxWidth: style.fullWidth ? .infinity : nil)
                .frame(minWidth: h * 1.6)
                .frame(height: h)
                .background { CastButtonSkin(color: c, size: style.size, pressed: pressed, dark: scheme == .dark) }
                .contentShape(Capsule())
                .scaleEffect(pressed && !still ? 0.92 : 1)
                .opacity(enabled ? 1 : 0.55)
                .animation(still ? nil : (pressed ? .easeOut(duration: 0.08)
                                          : .spring(response: 0.26, dampingFraction: 0.45)),
                           value: pressed)
                .onChange(of: configuration.isPressed) { Feedback.press($0) }
        }
    }
}

/// `CastButtonRow`: this item keeps its natural width (a round / chip / hug-width button); unmarked items
/// are the row's cast buttons and share the line's spare width.
struct CastRowFixed: LayoutValueKey { static let defaultValue = false }

extension View {
    /// FINISH_SPEC BJ17: keep this item at its natural width inside a `CastButtonRow`.
    func castRowFixed() -> some View { layoutValue(key: CastRowFixed.self, value: true) }
}

/// FINISH_SPEC BJ17: a row of cast buttons whose labels all render at ONE cap height (the finished
/// dock's SHARE RESULTS beside Next / Leaderboard was squeezed to ~64% while its neighbor stayed
/// full size). Every item is measured at its ideal width; a line takes items while its cast buttons
/// fit at EQUAL widths (each as wide as the widest of them) beside the fixed ones, then they split
/// the line equally. When they cannot, the next item wraps to a full-width line of its own, so a
/// label never shrinks. Items align to the top (the share candy's countdown hangs below it).
/// Android: CastButtonRow (CastButton.kt), web: .cast-row (cast-button.css).
struct CastButtonRow: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    private struct Line { var items: [Int]; var widths: [CGFloat] = []; var height: CGFloat = 0 }

    private func lines(_ width: CGFloat?, _ subviews: Subviews) -> (CGFloat, [Line]) {
        let natural = subviews.map { $0.sizeThatFits(.unspecified).width }
        let fixed = subviews.map { $0[CastRowFixed.self] }
        let maxW = width ?? (natural.reduce(0, +) + spacing * CGFloat(max(0, subviews.count - 1)))
        func fits(_ items: [Int]) -> Bool {
            let f = items.filter { fixed[$0] }.reduce(CGFloat(0)) { $0 + natural[$1] }
            let flex = items.filter { !fixed[$0] }
            let widest = flex.map { natural[$0] }.max() ?? 0
            return f + spacing * CGFloat(items.count - 1) + widest * CGFloat(flex.count) <= maxW + 0.5
        }
        var out: [Line] = []
        var cur: [Int] = []
        for i in subviews.indices {
            if cur.isEmpty || fits(cur + [i]) { cur.append(i) } else { out.append(Line(items: cur)); cur = [i] }
        }
        if !cur.isEmpty { out.append(Line(items: cur)) }
        for li in out.indices {
            let items = out[li].items
            let f = items.filter { fixed[$0] }.reduce(CGFloat(0)) { $0 + min(natural[$1], maxW) }
            let nFlex = items.filter { !fixed[$0] }.count
            let share = nFlex > 0 ? max(0, (maxW - f - spacing * CGFloat(items.count - 1)) / CGFloat(nFlex)) : 0
            out[li].widths = items.map { fixed[$0] ? min(natural[$0], maxW) : share }
            out[li].height = zip(items, out[li].widths).map { i, w in
                subviews[i].sizeThatFits(ProposedViewSize(width: w, height: nil)).height
            }.max() ?? 0
        }
        return (maxW, out)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let (w, ls) = lines(proposal.width, subviews)
        let h = ls.reduce(CGFloat(0)) { $0 + $1.height } + lineSpacing * CGFloat(max(0, ls.count - 1))
        return CGSize(width: w, height: h)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (w, ls) = lines(bounds.width, subviews)
        var y = bounds.minY
        for line in ls {
            let used = line.widths.reduce(0, +) + spacing * CGFloat(max(0, line.items.count - 1))
            var x = bounds.minX + max(0, (w - used) / 2)
            for (i, itemW) in zip(line.items, line.widths) {
                subviews[i].place(at: CGPoint(x: x, y: y), anchor: .topLeading,
                                  proposal: ProposedViewSize(width: itemW, height: nil))
                x += itemW + spacing
            }
            y += line.height + lineSpacing
        }
    }
}

/// The three-slice skin: caps drawn as is, the middle 1-px column stretched.
struct CastButtonSkin: View {
    let color: CastColor
    let size: CandyButtonStyle.Size
    var pressed = false
    var dark = false

    var body: some View {
        if let ui = CastArt.shared.skin(color, size, pressed: pressed, dark: dark) {
            let w = ui.size.width, half = (w * ui.scale / 2).rounded(.down) / ui.scale
            Image(uiImage: ui)
                .resizable(capInsets: EdgeInsets(top: 0, leading: half, bottom: 0, trailing: max(0, w - half - 1 / ui.scale)),
                           resizingMode: .stretch)
                .accessibilityHidden(true)
        }
    }
}

/// A cast button's label: the art lettering when `title` has art, else the live fallback —
/// both at the same cap height (0.42 × the button height).
struct CastLabelView: View {
    let title: String
    let ink: CastInk
    /// < 1 shrinks the cap (the two-line subtitle variant).
    var capScale: CGFloat = 1
    @Environment(\.displayScale) private var scale

    var body: some View {
        let cap = CastLabels.capHeight(ink.height * capScale, scale: scale)
        if let hit = CastLabels.lookup(title),
           let ui = CastArt.shared.label(hit.slug, height: cap, scale: scale) {
            let w = ui.size.width
            Image(uiImage: ui)
                .resizable()
                .interpolation(.high)
                .aspectRatio(contentMode: .fit)
                .frame(maxWidth: w, maxHeight: cap)
                .background {
                    if ink.color == .gold {
                        // labels.json gold.artHalo: a deeper-amber halo behind the cream label.
                        Image(uiImage: ui).resizable().renderingMode(.template).aspectRatio(contentMode: .fit)
                            .foregroundStyle(Color(hex: 0x9A5A00).opacity(0.55))
                            .padding(-0.75)
                            .blur(radius: 1.75 / 2)
                    }
                }
                .shadow(color: ink.color.deep.opacity(0.56), radius: 1, x: 0, y: 1)
                .accessibilityLabel(title)
        } else {
            CastLiveText(text: title.uppercased(), color: ink.color, cap: cap)
                .accessibilityLabel(title)
        }
    }
}

/// BJ15 round 2: text links / tertiary actions stay text (never a cast pill) — the brand purple,
/// heavy, no outline (Forgot password?, Sign up, Play without an account).
struct TextLinkLabel: View {
    let title: String
    var size: CGFloat = 14
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Text(title)
            .font(Brand.font(size, .black))
            .foregroundStyle(scheme == .dark ? Color(hex: 0xC4A5FF) : Color(hex: 0x7C3AED))
            .lineLimit(1).minimumScaleFactor(0.8)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
    }
}

/// labels.json live fallback: white Nunito Black, one thin same-hue stroke, a soft same-hue
/// shadow; sized so its cap height matches the art labels (cap ratio 0.75: Nunito Black caps read ≈ 0.75 em with the stroke — round 2, matched to the art).
struct CastLiveText: View {
    let text: String
    let color: CastColor
    let cap: CGFloat

    var body: some View {
        let size = cap / 0.75
        let label = Text(text).font(Brand.fixedFont(size, .black))
        let w: CGFloat = 1.1
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) * .pi / 4
                label.foregroundStyle(color.deep)
                    .offset(x: CGFloat(cos(a)) * w, y: CGFloat(sin(a)) * w)
            }
            label.foregroundStyle(.white)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.4)
        .shadow(color: color.deep.opacity(0.35), radius: 1, x: 0, y: 1)
    }
}

extension CandyButtonStyle.Variant {
    /// The cast color for an old candy variant: purple → the screen's color, amber → gold (Pro),
    /// peach (quiet) → slate, teal / pink kept.
    func cast(screen: CastColor? = nil) -> CastColor? {
        switch self {
        case .purple: return screen
        case .amber: return .gold
        case .peach: return .slate
        case .teal: return .teal
        case .pink: return .pink
        }
    }
}

#if DEBUG
/// BJ15 visual check (DEBUG only): `-bj15Screen pro|invite|finish` presents that real screen
/// over the app at launch (UIKit, on top of whatever is up), so the cast buttons can be screenshotted headless.
struct CastShowcaseHost: View {
    var body: some View {
        Color.clear
            .allowsHitTesting(false)
            .task {
                guard let arg = PerfTour.argument("-bj15Screen") else { return }
                try? await Task.sleep(nanoseconds: 3_000_000_000)   // after the cold-start intro lands
                let root: AnyView
                switch arg {
                case "pro": root = AnyView(ProView())
                case "invite": root = AnyView(InviteSheet())
                case "gopro": root = AnyView(CastShowcaseBoard())
                case "share":
                    // The finished screen's action row (BJ18): SHARE (+ the countdown caption) and NEXT with
                    // the next game's 3D icon in ONE CastButtonRow, plus the slate CTA row.
                    root = AnyView(VStack(spacing: 16) {
                        CastButtonRow {
                            FinishedShareCTA(nextGame: "Classic", onShare: { _ in })
                            Button {} label: {
                                CandyLabel(title: "Next") { GameArtImage(asset: "game-six", size: 26) }
                            }
                            .buttonStyle(CastButtonStyle(color: .gold, size: .medium))
                        }
                        CastButtonRow {
                            FinishedShareCTA(nextGame: "Classic", onShare: { _ in })
                            Button {} label: { CandyLabel(title: "Ranks") { Icon3D(.trophy, size: 26) } }
                                .buttonStyle(CastButtonStyle(color: .purple, size: .medium))
                        }
                        HStack(alignment: .top, spacing: 10) {
                            FinishedShareCTA(nextGame: "Classic", onShare: { _ in })
                            Button {} label: { CandyLabel(title: "New puzzle") }
                                .buttonStyle(CastButtonStyle(color: .slate, size: .medium))
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(hex: 0xF3EEFF)))
                default:
                    root = AnyView(ZStack {
                        Color.black.opacity(0.35).ignoresSafeArea()
                        VictoryOverlay(won: true, guesses: 3, maxGuesses: 6, timeSeconds: 74, boardsSolved: 1, totalBoards: 1,
                                       solution: "CRANE", solutions: [], points: 840, onPlayAgain: {},
                                       actions: [VictoryAction(label: "Share", primary: true, action: {}),
                                                 VictoryAction(label: "Keep playing", action: {})],
                                       game: .duel, onDismiss: {})
                    })
                }
                let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
                guard var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController ?? scene?.windows.first?.rootViewController
                else { return }
                while let next = top.presentedViewController { top = next }
                let host = UIHostingController(rootView: root)
                host.modalPresentationStyle = .fullScreen
                top.present(host, animated: false)
            }
    }
}

/// The Go Pro card (Settings) + every cast color with a short and a long label, light and dark.
private struct CastShowcaseBoard: View {
    private let rows: [(CastColor, String, String)] = [
        (.purple, "Play again", "Keep playing"), (.gold, "Go Pro", "Upgrade to Pro"), (.pink, "Invite", "Add a friend"),
        (.blue, "Rematch", "Challenge them"), (.green, "Next", "Share results"), (.teal, "Hint", "Take the tour"),
        (.slate, "Not now", "See friends"), (.orange, "Erase", "Starts with R…"),
    ]
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                SettingsProCard()
                ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                    VStack(spacing: 10) {
                        ForEach(rows.indices, id: \.self) { i in
                            HStack(spacing: 10) {
                                Button {} label: { CandyLabel(title: rows[i].1) }
                                    .buttonStyle(CastButtonStyle(color: rows[i].0, size: .medium, fullWidth: false))
                                Button {} label: { CandyLabel(title: rows[i].2) }
                                    .buttonStyle(CastButtonStyle(color: rows[i].0, size: .small, fullWidth: false))
                            }
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(scheme == .dark ? Color(hex: 0x1E1838) : Color(hex: 0xF3EEFF))
                    .environment(\.colorScheme, scheme)
                }
            }
            .padding(16)
        }
    }
}
#endif
