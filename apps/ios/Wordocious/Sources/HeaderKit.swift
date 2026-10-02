import SwiftUI

// Headers, menus and icons with the cast's personality (founder 2026-10-02; spec
// docs/HEADER_SPEC.md). ONE shared kit for iOS (web components/ui/icon3d + page-header,
// Android ui/HeaderKit.kt): the ChatGPT 3D icon set (`Icon3D`, §0), the shared page
// header pieces (§4: gradient caps title, soft white circle controls) and the
// SF-symbol bridge that swaps the streak / trophy / shield / crown / gear / help
// glyphs for the icon set wherever a helper still takes a symbol name (§2).

/// The 3D icon set (§0). Art: image sets `icon3d-<name>` (256 px, transparent).
enum Icon3DName: String, CaseIterable {
    case flame, trophy, shield, gear, help, crown
    case tabHome = "tab-home"
    case tabLeaderboard = "tab-leaderboard"
    case tabStats = "tab-stats"
    case tabFriends = "tab-friends"
    // ART_SPEC §4–§5: completion badges and the extra UI icons.
    case badgeW = "badge-w"
    case badgeL = "badge-l"
    case badgeCheck = "badge-check"
    case lock, bell, share, sound, back
    case addFriend = "add-friend"

    var assetName: String { "icon3d-\(rawValue)" }

    /// §2: the SF Symbols the icon set replaces. Anything else stays a symbol.
    static func forSymbol(_ symbol: String) -> Icon3DName? {
        switch symbol {
        case "flame", "flame.fill": return .flame
        case "trophy", "trophy.fill", "trophy.circle.fill": return .trophy
        case "shield", "shield.fill": return .shield
        case "crown", "crown.fill": return .crown
        case "gearshape", "gearshape.fill", "gear": return .gear
        case "questionmark", "questionmark.circle", "questionmark.circle.fill": return .help
        default: return nil
        }
    }

    /// ART_SPEC §5: the header-circle symbols the icon set replaces (back, share,
    /// bell, add-friend, sound, lock). A state the art can't show (bell.slash,
    /// speaker.slash) stays a symbol.
    static func forHeaderSymbol(_ symbol: String) -> Icon3DName? {
        switch symbol {
        case "chevron.left", "arrow.left": return .back
        case "square.and.arrow.up": return .share
        case "bell", "bell.fill": return .bell
        case "person.badge.plus", "person.crop.circle.badge.plus": return .addFriend
        case "speaker.wave.2.fill", "speaker.wave.2", "speaker.fill": return .sound
        case "lock", "lock.fill": return .lock
        default: return forSymbol(symbol)
        }
    }
}

/// One icon from the set at `size` pt (square). Decorative (hidden from VoiceOver)
/// unless `label` is given.
struct Icon3D: View {
    let name: Icon3DName
    var size: CGFloat
    var label: String? = nil

    init(_ name: Icon3DName, size: CGFloat, label: String? = nil) {
        self.name = name
        self.size = size
        self.label = label
    }

    init(name: Icon3DName, size: CGFloat, label: String? = nil) {
        self.init(name, size: size, label: label)
    }

    var body: some View {
        let image = Image(name.assetName)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
        if let label {
            image.accessibilityLabel(label)
        } else {
            image.accessibilityHidden(true)
        }
    }
}

/// §2 bridge: a helper that takes an SF Symbol name draws the icon set for the
/// flame / trophy / shield / crown / gear / help symbols (a touch larger than the
/// glyph's point size, since the 3D art fills its square), and the plain tinted
/// symbol for everything else.
struct SymbolGlyph: View {
    let symbol: String
    var size: CGFloat
    var weight: Font.Weight = .regular
    /// nil = inherit the surrounding foreground style (the plain-symbol fallback only).
    var color: Color? = nil

    init(_ symbol: String, size: CGFloat, weight: Font.Weight = .regular, color: Color? = nil) {
        self.symbol = symbol
        self.size = size
        self.weight = weight
        self.color = color
    }

    /// The 3D icon size for a symbol drawn at `size` pt.
    static func iconSize(_ size: CGFloat) -> CGFloat { max(12, (size * 1.25).rounded()) }

    var body: some View {
        if let icon = Icon3DName.forSymbol(symbol) {
            Icon3D(icon, size: Self.iconSize(size))
        } else if let color {
            Image(systemName: symbol).font(.system(size: size, weight: weight)).foregroundStyle(color)
        } else {
            Image(systemName: symbol).font(.system(size: size, weight: weight))
        }
    }
}

// MARK: - §4 Page headers

enum PageHeaderStyle {
    /// The back / close glyph ink.
    static let ink = Color(hex: 0x6D28D9)
    /// The default title gradient (purple → pink).
    static let purplePink: [Color] = [Color(hex: 0x7C3AED), Color(hex: 0xDB2777)]
    /// Leaderboard / Records / Pro accent.
    static let gold: [Color] = [Color(hex: 0xD97706), Color(hex: 0xB45309)]
    /// The soft white circle controls' size.
    static let circle: CGFloat = 36
    /// The page host beside a title (MASCOT_SPEC §6).
    static let hostSize: CGFloat = 36
}

/// The page title: caps, 900, the purple→pink gradient (or the page's accent).
struct PageTitle: View {
    let text: String
    var colors: [Color] = PageHeaderStyle.purplePink
    var size: CGFloat = 20

    init(_ text: String, colors: [Color] = PageHeaderStyle.purplePink, size: CGFloat = 20) {
        self.text = text
        self.colors = colors
        self.size = size
    }

    var body: some View {
        Text(text.uppercased())
            .font(Brand.font(size, .black)).tracking(0.4)
            .foregroundStyle(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
            .lineLimit(1).minimumScaleFactor(0.6)
            .accessibilityAddTraits(.isHeader)
    }
}

/// The title with the page's host beside it (`bob` where the page isn't a game).
struct PageHostTitle: View {
    let text: String
    var colors: [Color] = PageHeaderStyle.purplePink
    var host: MascotID? = nil
    var size: CGFloat = 20
    var hostSize: CGFloat = PageHeaderStyle.hostSize
    var motion: MascotMotion = .bob

    var body: some View {
        HStack(spacing: 6) {
            PageTitle(text, colors: colors, size: size)
            if let host { MascotView(host, size: hostSize, motion: motion) }
        }
    }
}

extension View {
    /// The soft white circle behind a header control (white = the theme surface,
    /// so the dark theme gets its dark surface), no border, a soft shadow.
    func headerCircle(_ size: CGFloat = PageHeaderStyle.circle) -> some View {
        frame(width: size, height: size)
            .background(Circle().fill(Theme.surface)
                .shadow(color: .black.opacity(0.10), radius: 6, x: 0, y: 2))
            .contentShape(Circle())
    }
}

/// A header control: a soft white circle holding either an SF Symbol in the
/// header ink (back / close / share …) or an icon from the 3D set.
struct HeaderCircleButton: View {
    enum Glyph {
        case symbol(String)
        case icon(Icon3DName)
        /// An icon in its "off" state (bell with a category off, sound muted):
        /// dimmed + desaturated with a slash (ART_SPEC §5).
        case mutedIcon(Icon3DName)
    }

    let glyph: Glyph
    var size: CGFloat = PageHeaderStyle.circle
    var tint: Color = PageHeaderStyle.ink
    let label: String
    let action: () -> Void

    init(_ glyph: Glyph, size: CGFloat = PageHeaderStyle.circle, tint: Color = PageHeaderStyle.ink,
         label: String, action: @escaping () -> Void) {
        self.glyph = glyph
        self.size = size
        self.tint = tint
        self.label = label
        self.action = action
    }

    var body: some View {
        Button(action: action) { HeaderCircleLabel(glyph: glyph, size: size, tint: tint) }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
    }
}

/// The circle visual on its own (for a Menu / NavigationLink / sheet label).
struct HeaderCircleLabel: View {
    let glyph: HeaderCircleButton.Glyph
    var size: CGFloat = PageHeaderStyle.circle
    var tint: Color = PageHeaderStyle.ink

    var body: some View {
        Group {
            switch glyph {
            case .symbol(let s):
                if let icon = Icon3DName.forHeaderSymbol(s) {
                    // §5: the 3D art fills its square, so ~1.2× the old glyph size.
                    Icon3D(icon, size: (size * 0.5).rounded())
                } else {
                    Image(systemName: s)
                        .font(.system(size: (size * 0.42).rounded(), weight: .bold))
                        .foregroundStyle(tint)
                }
            case .icon(let i):
                Icon3D(i, size: (size * 0.6).rounded())
            case .mutedIcon(let i):
                let side = (size * 0.5).rounded()
                ZStack {
                    Icon3D(i, size: side).saturation(0.4).opacity(0.5)
                    Capsule().fill(tint)
                        .frame(width: side * 1.1, height: max(2, side * 0.11))
                        .overlay(Capsule().stroke(Theme.surface, lineWidth: 1))
                        .rotationEffect(.degrees(-45))
                }
            }
        }
        .headerCircle(size)
    }
}

/// The game screens' corner controls (44 pt): Home (the back control) and Help.
struct GameCornerButton: View {
    enum Kind { case home, help }
    let kind: Kind
    let action: () -> Void

    var body: some View {
        switch kind {
        case .home:
            HeaderCircleButton(.symbol("house.fill"), size: 44, label: "Home", action: action)
        case .help:
            HeaderCircleButton(.icon(.help), size: 44, label: "How to play", action: action)
        }
    }
}

/// One shared page header bar: an optional back / close circle on the left, the
/// gradient caps title + host centered, and any right-side circles.
struct PageHeaderBar<Trailing: View>: View {
    enum Leading {
        case none
        case back(() -> Void)
        case close(() -> Void)
    }

    let title: String
    var colors: [Color] = PageHeaderStyle.purplePink
    var host: MascotID? = nil
    var leading: Leading = .none
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        ZStack {
            PageHostTitle(text: title, colors: colors, host: host)
                .padding(.horizontal, 52)
            HStack(spacing: 8) {
                switch leading {
                case .none: EmptyView()
                case .back(let a): HeaderCircleButton(.symbol("chevron.left"), label: "Back", action: a)
                case .close(let a): HeaderCircleButton(.symbol("xmark"), label: "Close", action: a)
                }
                Spacer(minLength: 0)
                trailing()
            }
        }
        .padding(.horizontal, 12).frame(minHeight: 48)
    }
}

extension PageHeaderBar where Trailing == EmptyView {
    init(title: String, colors: [Color] = PageHeaderStyle.purplePink, host: MascotID? = nil, leading: Leading = .none) {
        self.init(title: title, colors: colors, host: host, leading: leading) { EmptyView() }
    }
}
