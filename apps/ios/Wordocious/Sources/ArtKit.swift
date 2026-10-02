import SwiftUI
import UIKit
import WordociousCore

// The art pass (founder 2026-10-02; spec docs/ART_SPEC.md). ONE shared kit for the
// new images (web components/ui/art, Android ui/ArtKit.kt): the Leaderboard day
// titles (§1), the whole-cast page titles (§2), the glossy 3D game icons (§3) and
// the W / L / ✓ completion badges (§4). The extra UI icons (§5) join the Icon3D set
// in HeaderKit.swift. Second pass: the moment lettering (§6), the empty / error /
// done scenes (§7, drawn by `MascotMessage` in Mascots.swift), the WELCOME! and
// LEADERBOARD whole-cast titles (§8) and the pocket game icons (§9, drawn by
// `FriendlyGameIcon` in FriendsKit.swift). Third pass: the game title art (§10, the
// game headers via `.gameTitleArt` in Mascots.swift, the guide sheet top and the
// Leaderboard / Records game cards). Fourth pass: the page tint + tiles
// backgrounds and their tinted card shadows (§11, `PageBackground`), the
// WORDOCIOUS DAILIES title (§12) and the W / L row badges (§13). Art is
// presentation only: every caller keeps its behavior.

/// Whether an image set ships in the bundle (cached), so a missing piece of art
/// falls back to the old text / glyph instead of drawing blank.
enum ArtAsset {
    private static let lock = NSLock()
    private static var known: [String: Bool] = [:]

    static func exists(_ name: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        if let hit = known[name] { return hit }
        let found = UIImage(named: name) != nil
        known[name] = found
        return found
    }
}

// MARK: - §1 Leaderboard day titles

/// `art-day-<weekday>`: the day's title lettering with that day's host, one graphic.
enum DayTitleArt {
    /// Sunday first, matching core `LeaderboardTitle.weekdayTitles`.
    private static let days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    /// The art's own words, for VoiceOver.
    private static let labels = ["Sunday Superstars", "Monday Masters", "Tuesday Titans", "Wednesday Wizards",
                                 "Thursday Thunder", "Friday\u{2019}s Finest", "Saturday Stars"]

    /// The art for a core `leaderboardTitle` string: a weekday title maps to its
    /// day's graphic; a holiday title ("<HOLIDAY> HEROES") or missing art → nil
    /// (the caller keeps the text treatment).
    static func forTitle(_ title: String) -> (asset: String, label: String)? {
        guard let i = LeaderboardTitle.weekdayTitles.firstIndex(of: title), i < days.count else { return nil }
        let asset = "art-day-\(days[i])"
        return ArtAsset.exists(asset) ? (asset, labels[i]) : nil
    }
}

/// The day title graphic, centered, height-capped (≈96–120 pt), never stretched.
struct DayTitleArtView: View {
    let asset: String
    let label: String
    var maxHeight: CGFloat = 112

    var body: some View {
        Image(asset)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(maxWidth: 420, maxHeight: maxHeight)
            .frame(maxWidth: .infinity)
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - §2 Whole-cast page titles

/// `art-title-<page>`: page lettering with the whole cast perched on it.
enum ArtTitleName: String, CaseIterable {
    case friends, stats, records, vs, puzzles, wotd, settings, howto, gopro, moregames
    /// §8: the whole cast around WELCOME! (sign-in / onboarding) and LEADERBOARD
    /// (the Leaderboard banner on holidays).
    case welcome, leaderboard
    /// §12: the whole cast around WORDOCIOUS DAILIES (the Home daily games header).
    case dailies

    var assetName: String { "art-title-\(rawValue)" }

    /// The title text the art carries (its accessibility label, and the text
    /// fallback when the art is missing).
    var label: String {
        switch self {
        case .friends: return "Friends"
        case .stats: return "Stats"
        case .records: return "All-Time Records"
        case .vs: return "VS Battle"
        case .puzzles: return "Puzzles"
        case .wotd: return "Word of the Day"
        case .settings: return "Settings"
        case .howto: return "How to Play"
        case .gopro: return "Go Pro"
        case .moregames: return "More Games"
        case .welcome: return "Welcome"
        case .leaderboard: return "Leaderboard"
        case .dailies: return "Wordocious Dailies"
        }
    }
}

/// A page title as art: fills the offered width up to `maxWidth` (≈420 pt), the
/// height follows the aspect ratio, never stretched. Labeled with the title text;
/// falls back to the gradient caps `PageTitle` if the image is missing.
struct ArtTitle: View {
    let name: ArtTitleName
    var maxWidth: CGFloat = 420
    var label: String? = nil
    /// Fallback text colors (the page's accent).
    var colors: [Color] = PageHeaderStyle.purplePink

    init(_ name: ArtTitleName, maxWidth: CGFloat = 420, label: String? = nil,
         colors: [Color] = PageHeaderStyle.purplePink) {
        self.name = name
        self.maxWidth = maxWidth
        self.label = label
        self.colors = colors
    }

    var body: some View {
        if ArtAsset.exists(name.assetName) {
            Image(name.assetName)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(maxWidth: maxWidth)
                .accessibilityLabel(label ?? name.label)
                .accessibilityAddTraits(.isHeader)
        } else {
            PageTitle(label ?? name.label, colors: colors)
        }
    }
}

// MARK: - §3 Game icons

/// `game-<mode id>`: the glossy 3D game icon (256 sq), decorative.
struct GameArtImage: View {
    let asset: String
    let size: CGFloat

    var body: some View {
        Image(asset)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - §4 Completion badges

/// The daily result badge: `icon3d-badge-w` (won) / `icon3d-badge-l` (lost) /
/// `icon3d-badge-check` (done, result unknown) at 26 pt, labeled for VoiceOver.
struct ResultBadge: View {
    enum Kind { case win, loss, done }
    let kind: Kind
    var size: CGFloat = 26

    init(_ kind: Kind, size: CGFloat = 26) {
        self.kind = kind
        self.size = size
    }

    /// Won / lost from a Bool.
    init(won: Bool, size: CGFloat = 26) {
        self.init(won ? .win : .loss, size: size)
    }

    var body: some View {
        switch kind {
        case .win: Icon3D(.badgeW, size: size, label: "Won")
        case .loss: Icon3D(.badgeL, size: size, label: "Lost")
        case .done: Icon3D(.badgeCheck, size: size, label: "Played")
        }
    }
}

// MARK: - §6 Moment lettering

/// `art-moment-<name>`: glossy result / celebration lettering (≈900 wide).
enum MomentArt: String, CaseIterable {
    case victory, soclose, sweep, flawless, youwin, youlose, draw, newrecord, streak

    var assetName: String { "art-moment-\(rawValue)" }

    /// The words on the art (its accessibility label).
    var label: String {
        switch self {
        case .victory: return "Victory!"
        case .soclose: return "So close!"
        case .sweep: return "Sweep!"
        case .flawless: return "Flawless!"
        case .youwin: return "You win!"
        case .youlose: return "You lose"
        case .draw: return "Draw"
        case .newrecord: return "New record!"
        case .streak: return "Streak!"
        }
    }

    var isAvailable: Bool { ArtAsset.exists(assetName) }
}

/// A result / celebration headline as lettering art: ~70% of the card width
/// (`maxWidth`), at most ≈72 pt tall, never stretched, labeled with its words as a
/// header. Falls back to the caller's text headline when the image is missing.
struct MomentLettering<Fallback: View>: View {
    let moment: MomentArt
    var maxWidth: CGFloat
    var maxHeight: CGFloat
    let fallback: Fallback

    init(_ moment: MomentArt, maxWidth: CGFloat = 250, maxHeight: CGFloat = 72,
         @ViewBuilder fallback: () -> Fallback) {
        self.moment = moment
        self.maxWidth = maxWidth
        self.maxHeight = maxHeight
        self.fallback = fallback()
    }

    var body: some View {
        if moment.isAvailable {
            Image(moment.assetName)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(maxWidth: maxWidth, maxHeight: maxHeight)
                .accessibilityLabel(moment.label)
                .accessibilityAddTraits(.isHeader)
        } else {
            fallback
        }
    }
}

// MARK: - §7 Scenes (empty / error / done)

/// `art-scene-<name>`: one cast member with a prop (≈600 wide), decorative.
enum ArtScene: String, CaseIterable {
    /// Empty lists / boards ("nobody's on yet", empty leaderboard / friends feeds).
    case asleep = "r-asleep"
    /// Offline / failed-to-load / error screens.
    case unplugged = "r-unplugged"
    /// All dailies done / played-today limit / "fresh puzzles in …".
    case allDone = "u-alldone"
    /// Profile-not-found and missing-item states.
    case notFound = "o3-notfound"
    /// Empty Friends ("add a friend") states and the invite sheet header.
    case invite = "i-invite"
    /// Stats empty ("play a game and I'll crunch the numbers").
    case noStats = "d-nostats"

    var assetName: String { "art-scene-\(rawValue)" }

    /// The scene's character, drawn alone when the art is missing.
    var host: MascotID {
        switch self {
        case .asleep, .unplugged: return .r
        case .allDone: return .u
        case .notFound: return .o3
        case .invite: return .i
        case .noStats: return .d
        }
    }

    var isAvailable: Bool { ArtAsset.exists(assetName) }
}

/// A scene at ~140 pt tall (≈60% of a phone's width at most), never stretched,
/// hidden from VoiceOver. Falls back to the scene's character alone (a plain
/// `MascotView`) when the image is missing.
struct SceneArt: View {
    let scene: ArtScene
    var height: CGFloat = 140
    var fallbackSize: CGFloat = 96
    var fallbackMotion: MascotMotion = .bob

    init(_ scene: ArtScene, height: CGFloat = 140, fallbackSize: CGFloat = 96, fallbackMotion: MascotMotion = .bob) {
        self.scene = scene
        self.height = height
        self.fallbackSize = fallbackSize
        self.fallbackMotion = fallbackMotion
    }

    var body: some View {
        if scene.isAvailable {
            Image(scene.assetName)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(maxWidth: height * 1.6, maxHeight: height)
                .accessibilityHidden(true)
        } else {
            MascotView(scene.host, size: fallbackSize, motion: fallbackMotion)
        }
    }
}

// MARK: - §9 Pocket game icons

extension FriendlyKind {
    /// `game-pocket-<kind>`: the glossy 3D pocket game icon (256 sq), when it ships.
    var pocketArt: String? {
        let name = "game-pocket-\(rawValue)"
        return ArtAsset.exists(name) ? name : nil
    }
}

// MARK: - §10 Game title art

/// `art-game-<mode id>`: the game's name lettered in its accent color with its host
/// (MASCOT_SPEC §5) at the end (≈900 wide), keyed by the catalog id of the engine mode.
enum GameTitleArt {
    /// The art + its words (the catalog title the lettering spells, e.g. "Classic Six")
    /// for a mode, when the image ships; nil → the caller keeps its text title + host.
    static func forMode(_ mode: GameMode) -> (asset: String, label: String)? {
        guard let g = ModeGen.byDbKey(mode.rawValue) else { return nil }
        let asset = "art-game-\(g.id)"
        return ArtAsset.exists(asset) ? (asset, g.shareLabel) : nil
    }
}

/// A game title as art: fits the offered width up to `maxWidth`, at most `height`
/// tall, never stretched, labeled with the game's title as a header.
struct GameTitleArtView: View {
    let asset: String
    let label: String
    var height: CGFloat = 38
    var maxWidth: CGFloat = 320
    var alignment: Alignment = .center

    var body: some View {
        Image(asset)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(maxWidth: maxWidth, alignment: alignment)
            .frame(height: height)
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - §11 Page backgrounds (page tint + tiles)

/// The page's tint: picks the background gradient and the accent its cards'
/// shadows lean toward.
enum PageTint {
    /// Home, Settings, Pro, Help / Guides, profile, and the default.
    case home
    /// Leaderboard and Records.
    case leaderboard
    case stats
    case friends
    /// The VS pages.
    case vs

    /// The diagonal gradient's three stops (top-left → bottom-right).
    func stops(dark: Bool) -> [Color] {
        switch (self, dark) {
        case (.home, false): return [Color(hex: 0xF3EEFF), Color(hex: 0xFBEFFF), Color(hex: 0xFFF1F7)]
        case (.home, true): return [Color(hex: 0x160F26), Color(hex: 0x1C1231), Color(hex: 0x22122C)]
        case (.leaderboard, false): return [Color(hex: 0xFFF8E6), Color(hex: 0xFFEFD2), Color(hex: 0xFDE9F2)]
        case (.leaderboard, true): return [Color(hex: 0x1E1608), Color(hex: 0x23160D), Color(hex: 0x241221)]
        case (.stats, false): return [Color(hex: 0xEEF4FF), Color(hex: 0xEEEBFF), Color(hex: 0xF4EEFF)]
        case (.stats, true): return [Color(hex: 0x0E1530), Color(hex: 0x141433), Color(hex: 0x1A1233)]
        case (.friends, false): return [Color(hex: 0xFFF0F7), Color(hex: 0xFCE7F3), Color(hex: 0xF3E8FF)]
        case (.friends, true): return [Color(hex: 0x241024), Color(hex: 0x22102A), Color(hex: 0x1A1030)]
        case (.vs, false): return [Color(hex: 0xE9FBF8), Color(hex: 0xECF6FF), Color(hex: 0xF1EEFF)]
        case (.vs, true): return [Color(hex: 0x08201E), Color(hex: 0x0E1A2A), Color(hex: 0x15142B)]
        }
    }

    /// An opaque header / bar strip over a light-only page (VS, Friends): the
    /// gradient's top-left stop, so the strip reads as the page.
    var barColor: Color { stops(dark: false)[0] }

    /// The accent a card's shadow is tinted toward.
    var accent: Color {
        switch self {
        case .home: return Color(hex: 0x7C3AED)
        case .leaderboard: return Color(hex: 0xF59E0B)
        case .stats: return Color(hex: 0x2563EB)
        case .friends: return Color(hex: 0xEC4899)
        case .vs: return Color(hex: 0x0D9488)
        }
    }
}

private struct PageTintKey: EnvironmentKey {
    static let defaultValue: PageTint = .home
}

extension EnvironmentValues {
    /// The tint of the page a view sits on (set by `.pageBackground`), read by
    /// the card styles to tint their shadows.
    var pageTint: PageTint {
        get { self[PageTintKey.self] }
        set { self[PageTintKey.self] = newValue }
    }
}

/// The shipped seamless letter-tile pattern (`art-bg-tiles`, 640 px) re-scaled so
/// one tile draws at 320 pt.
private enum TilePattern {
    static let image: UIImage? = {
        guard let src = UIImage(named: "art-bg-tiles"), let cg = src.cgImage else { return nil }
        return UIImage(cgImage: cg, scale: CGFloat(cg.width) / 320, orientation: .up)
    }()
}

/// ART_SPEC §11: the page backdrop. A soft diagonal gradient per tint (light or
/// dark stops from the color scheme), with the letter-tile pattern repeated on top
/// at 12% (light) / 7% (dark), fixed to the page, edge to edge behind the status
/// bar. Reduce Transparency or Increase Contrast → the gradient alone. Decorative.
struct PageBackground: View {
    let tint: PageTint
    /// The VS and Friends pages are drawn light in every theme (their cards and
    /// ink are fixed light colors), so their backdrop stays on the light stops.
    var lightOnly = false

    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    init(tint: PageTint, lightOnly: Bool = false) {
        self.tint = tint
        self.lightOnly = lightOnly
    }

    var body: some View {
        let dark = scheme == .dark && !lightOnly
        ZStack {
            LinearGradient(colors: tint.stops(dark: dark), startPoint: .topLeading, endPoint: .bottomTrailing)
            if !reduceTransparency, contrast != .increased, let tile = TilePattern.image {
                Image(uiImage: tile)
                    .resizable(resizingMode: .tile)
                    .opacity(dark ? 0.07 : 0.12)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

extension View {
    /// §11: draw the page tint + tiles behind this page and tint its cards' shadows.
    func pageBackground(_ tint: PageTint, lightOnly: Bool = false) -> some View {
        background(PageBackground(tint: tint, lightOnly: lightOnly))
            .environment(\.pageTint, tint)
    }

    /// §11.3: a card's lift off the page tint — a shadow tinted toward the page's
    /// accent (~11% alpha, radius 14, y 5).
    func pageCardShadow() -> some View { modifier(PageCardShadow()) }
}

private struct PageCardShadow: ViewModifier {
    @Environment(\.pageTint) private var tint
    func body(content: Content) -> some View {
        content.shadow(color: tint.accent.opacity(0.11), radius: 14, x: 0, y: 5)
    }
}

// MARK: - §13 W / L row badges

/// A Leaderboard / Records / recent-match row's "Win" / "Loss" chip as the 3D badge
/// art at ~18 pt, keeping the chip's words as its accessibility label.
struct RowResultBadge: View {
    let won: Bool
    var size: CGFloat = 18
    var label: String? = nil

    var body: some View {
        Icon3D(won ? .badgeW : .badgeL, size: size, label: label ?? (won ? "Win" : "Loss"))
    }
}
