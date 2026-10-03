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
// WORDOCIOUS DAILIES title (§12) and the W / L row badges (§13). Fifth pass: game
// titles sized by the header width (§14, `GameTitleArtView`), the per-game page tint
// behind solo game screens (§15, `PageTint.forGame`), the title art pop-in + idle float
// (§16, `.titleArtMotion`) and the share-card chrome (§17, `ShareArt`). Sixth pass
// (§19): the `art-wall-*` wallpapers replace the tint + tile drawing in
// `PageBackground`, the Home section titles center (`SectionTitleArt`) and the solo
// game titles grow below the corner-button row (`.soloGameTitle` in Mascots.swift,
// `GameTitleArtView.soloCap`). Art is presentation only: every caller keeps its behavior.

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

    private static var aspects: [String: CGFloat] = [:]

    /// An image set's width ÷ height (cached); nil when it doesn't ship.
    static func aspect(_ name: String) -> CGFloat? {
        lock.lock(); defer { lock.unlock() }
        if let hit = aspects[name] { return hit }
        guard let img = UIImage(named: name), img.size.width > 0, img.size.height > 0 else { return nil }
        let a = img.size.width / img.size.height
        aspects[name] = a
        return a
    }
}

// MARK: - §1 Leaderboard day titles

/// `art-day-<weekday>`: the day's title lettering with that day's host, one graphic.
enum DayTitleArt {
    /// Sunday first, matching core `LeaderboardTitle.weekdayTitles`.
    private static let days = ArtTitleLabels.dayOrder
    /// The art's own words, for VoiceOver (§AB: the Core registry, unit tested).
    private static let labels = days.map { ArtTitleLabels.days[$0] ?? $0.capitalized }

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
            .titleArtMotion(float: false)   // FINISH_SPEC §A6: headlines don't float
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
    /// FINISH_SPEC §C6: each footer / info page's own title (one shared height).
    case guides, strategy, words, faq, privacy, terms
    /// FINISH_SPEC §O1: the lettering-only VS BATTLE Home section title.
    case vsbattle
    /// FINISH_SPEC §AS1: the MENU sheet title (art-title-menu; LiveHeadline until it ships).
    case menu

    var assetName: String { "art-title-\(rawValue)" }

    /// The title text the art carries (its accessibility label, and the text
    /// fallback when the art is missing) — §AB: from the Core registry (unit tested).
    var label: String { ArtTitleLabels.titles[rawValue] ?? rawValue.capitalized }
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
                .titleArtMotion(float: false)   // FINISH_SPEC §A6: headlines don't float
                .accessibilityLabel(label ?? name.label)
                .accessibilityAddTraits(.isHeader)
        } else {
            PageTitle(label ?? name.label, colors: colors)
        }
    }
}

/// ART_SPEC §19.2: a Home section title (DAILIES, PUZZLES, WORD OF THE DAY) centered
/// above its section, all three on one width rule — ≈78% of the content width, at
/// most 340 pt; the height follows the art's aspect ratio.
struct SectionTitleArt: View {
    let name: ArtTitleName
    /// FINISH_SPEC §N1: the Home section titles follow the page-title rule —
    /// ≈62% of the content width, at most 300 pt wide and 64 pt tall.
    static let fraction: CGFloat = 0.62
    static let maxWidth: CGFloat = 300
    static let maxHeight: CGFloat = 64

    /// FINISH_SPEC BH2: DAILIES / PUZZLES over the compact game cards, ~25% smaller.
    var scale: CGFloat = 1

    init(_ name: ArtTitleName, compact: Bool = false) {
        self.name = name
        self.scale = compact ? HomeCardSpec.sectionTitleScale : 1
    }

    var body: some View {
        CenteredFractionLayout(fraction: Self.fraction * scale, maxWidth: Self.maxWidth * scale) {
            ArtTitle(name, maxWidth: Self.maxWidth * scale)
                .frame(maxHeight: Self.maxHeight * scale)
        }
    }
}

/// Offers its child `fraction` of the proposed width (≤ `maxWidth`), takes the full
/// width itself and centers the child in it.
private struct CenteredFractionLayout: Layout {
    let fraction: CGFloat
    let maxWidth: CGFloat

    private func inner(_ width: CGFloat) -> CGFloat { min(width * fraction, maxWidth) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? maxWidth / fraction
        let child = subviews.first?.sizeThatFits(ProposedViewSize(width: inner(width), height: nil)) ?? .zero
        return CGSize(width: width, height: child.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let w = inner(bounds.width)
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: w, height: nil))
            view.place(at: CGPoint(x: bounds.midX, y: bounds.minY), anchor: .top,
                       proposal: ProposedViewSize(width: w, height: size.height))
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

    /// The words on the art (its accessibility label) — §AB: from the Core registry.
    var label: String { ArtTitleLabels.moments[rawValue] ?? rawValue.capitalized }

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

/// A game title as art (§14), sized by the WIDTH it is offered: width = the offered
/// width (up to `maxWidth`), height follows the art's aspect ratio, capped at
/// `maxHeight`. When the width rule gives less than `minHeight`, the slot stays
/// `minHeight` tall and the art centers in it. Never stretched; labeled with the
/// game's title as a header. Pops in once (§16; no idle float — game headers stay
/// still during play).
struct GameTitleArtView: View {
    /// §19.3: the solo game header's title cap — 120 pt, 84 pt on short screens
    /// (height < 700 pt).
    static var soloCap: CGFloat { UIScreen.main.bounds.height < 700 ? 84 : 120 }

    let asset: String
    let label: String
    /// The height cap (72 pt in game headers and the guide sheet, 52 on the Play cards).
    var maxHeight: CGFloat = 72
    /// The slot's floor (44 pt in game headers so short names don't look tiny).
    var minHeight: CGFloat = 0
    var maxWidth: CGFloat = .infinity
    var alignment: HorizontalAlignment = .center
    /// Game headers: the corner buttons' vertical center measured from the header's
    /// top. The art is pushed down (never up) so its center meets the buttons'.
    var centerY: CGFloat? = nil
    /// BA1: the finished screen's short-screen cap.
    @Environment(\.finishedTitleCap) private var finishedCap

    var body: some View {
        let maxHeight = min(self.maxHeight, finishedCap ?? .infinity)
        let minHeight = min(self.minHeight, maxHeight)
        WidthFitLayout(aspect: ArtAsset.aspect(asset) ?? 4, minHeight: minHeight, maxHeight: maxHeight,
                       maxWidth: maxWidth, leading: alignment == .leading, centerY: centerY) {
            Image(asset)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .titleArtMotion(float: false)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isHeader)
        }
    }
}

/// §14's sizing rule as a layout: the art takes the offered width (≤ `maxWidth`,
/// ≤ the width at which it reaches `maxHeight`), its height from the aspect ratio;
/// the slot is at least `minHeight` tall. Offered no width (ideal size), it asks for
/// the art at its cap.
private struct WidthFitLayout: Layout {
    let aspect: CGFloat
    let minHeight: CGFloat
    let maxHeight: CGFloat
    let maxWidth: CGFloat
    let leading: Bool
    let centerY: CGFloat?

    private var idealWidth: CGFloat { min(maxWidth, maxHeight * aspect) }

    private func art(width: CGFloat) -> CGSize {
        let w = max(0, min(width, idealWidth))
        return CGSize(width: w, height: w / aspect)
    }

    private func slot(_ art: CGSize) -> CGFloat { max(art.height, minHeight) }

    private func topInset(_ art: CGSize) -> CGFloat {
        guard let centerY else { return 0 }
        return max(0, centerY - slot(art) / 2)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let offered = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? idealWidth
        let a = art(width: offered)
        return CGSize(width: proposal.width == nil ? a.width : offered, height: slot(a) + topInset(a))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let a = art(width: bounds.width)
        let y = bounds.minY + topInset(a) + (slot(a) - a.height) / 2
        let x = leading ? bounds.minX : bounds.midX - a.width / 2
        for view in subviews {
            view.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(a))
        }
    }
}

// MARK: - §16 Title art motion

/// §16: title art pops in once when its page appears — scale 0.94 → 1.03 → 1.0 with
/// opacity 0 → 1 over 420 ms (ease-out, spring-ish) — then, for page and day titles
/// (`float`), a very slow idle float (translateY 0 → −2 → 0 over 4 s, forever). Game
/// headers pass `float: false` (still during play). Reduce Motion (the OS setting or
/// the in-app toggle): static, no animation.
private struct TitleArtMotion: ViewModifier {
    let float: Bool

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var scale: CGFloat
    @State private var opacity: Double
    @State private var settled: Bool
    @State private var start = Date()
    /// §AQ2: the idle float pauses while a page scrolls / off screen.
    @ObservedObject private var scroll = ScrollMotion.shared
    @State private var onScreen = true

    init(float: Bool) {
        self.float = float
        let still = Theme.reduceMotion
        _scale = State(initialValue: still ? 1 : 0.94)
        _opacity = State(initialValue: still ? 1 : 0)
        _settled = State(initialValue: still)
    }

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    func body(content: Content) -> some View {
        if still {
            content
        } else if settled && float && !Motion.calm(envReduceMotion) {   // §AD: no idle float in Low Power Mode
            TimelineView(.animation(minimumInterval: 1 / 20, paused: scroll.scrolling || !onScreen)) { ctx in
                content.offset(y: Self.floatOffset(ctx.date.timeIntervalSince(start)))
            }
            .tracksScrollVisibility($onScreen)
        } else {
            content
                .scaleEffect(scale)
                .opacity(opacity)
                .onAppear(perform: pop)
        }
    }

    private func pop() {
        guard !settled else { return }
        withAnimation(.easeOut(duration: 0.26)) { scale = 1.03; opacity = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.26) {
            withAnimation(.easeInOut(duration: 0.16)) { scale = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) {
            start = Date()
            settled = true
        }
    }

    /// 0 → −2 → 0 over 4 s, ease-in-out (a cosine is exactly that curve).
    static func floatOffset(_ t: TimeInterval) -> CGFloat {
        let phase = t.truncatingRemainder(dividingBy: 4) / 4
        return CGFloat(-2 * (1 - cos(2 * .pi * phase)) / 2)
    }
}

extension View {
    /// §16: the one-time pop-in (+ the idle float for page / day titles).
    func titleArtMotion(float: Bool) -> some View { modifier(TitleArtMotion(float: float)) }
}

// MARK: - §11 Page backgrounds (page tint + tiles)

/// The page's tint: picks the background gradient and the accent its cards'
/// shadows lean toward.
enum PageTint: Equatable {
    /// Home, Settings, Pro, Help / Guides, profile, and the default.
    case home
    /// Leaderboard and Records.
    case leaderboard
    case stats
    case friends
    /// The VS pages.
    case vs
    /// §15: a solo game screen, tinted from its accent (0xRRGGBB); `id` is the
    /// catalog id that names its §19 wallpaper.
    case game(UInt, id: String)

    /// §15: a game's tint from its catalog accent (`accentHex`).
    static func forGame(_ mode: GameMode) -> PageTint {
        let g = ModeGen.byDbKey(mode.rawValue)
        return .game(g.flatMap { UInt($0.accentHex.dropFirst(), radix: 16) } ?? 0x7C3AED, id: g?.id ?? "")
    }

    /// §19.1: the page's wallpaper image set (`art-wall-<name>` / `art-wall-game-<id>`).
    var wallpaper: String {
        switch self {
        case .home: return "art-wall-home"
        case .leaderboard: return "art-wall-leaderboard"
        case .stats: return "art-wall-stats"
        case .friends: return "art-wall-friends"
        case .vs: return "art-wall-vs"
        case .game(_, let id): return "art-wall-game-\(id)"
        }
    }

    /// §19.1: the dark-mode overlay of #120D1F over the wallpaper — 58% on pages,
    /// 62% on game screens.
    var darkOverlay: Double {
        if case .game = self { return 0.62 }
        return 0.58
    }

    /// The diagonal gradient's three stops (top-left → bottom-right). Since §19 the
    /// page draws its wallpaper; the stops stay for strips, share cards and the
    /// fallback when a wallpaper is missing.
    func stops(dark: Bool) -> [Color] {
        switch (self, dark) {
        // §15: accent at 6% / 10% over white → 4% over #FFF7FB; dark: 10% / 14% over
        // #120D1F → 8% over #120D1F.
        case (.game(let a, _), false):
            return [Self.mix(a, 0.06, over: 0xFFFFFF), Self.mix(a, 0.10, over: 0xFFFFFF), Self.mix(a, 0.04, over: 0xFFF7FB)]
        case (.game(let a, _), true):
            return [Self.mix(a, 0.10, over: 0x120D1F), Self.mix(a, 0.14, over: 0x120D1F), Self.mix(a, 0.08, over: 0x120D1F)]
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
        case .game(let a, _): return Color(hex: a)
        }
    }

    /// The tile pattern's opacity on this tint. §18: the v2 pattern has its
    /// opacity baked in — 100% light / 60% dark on the menus, quieter on game
    /// screens (55% / 35%).
    func tileOpacity(dark: Bool) -> Double {
        if case .game = self { return dark ? 0.35 : 0.55 }
        return dark ? 0.6 : 1
    }

    /// `accent` at `alpha` composited over the opaque `base` (both 0xRRGGBB).
    static func mix(_ accent: UInt, _ alpha: Double, over base: UInt) -> Color {
        func ch(_ v: UInt, _ shift: UInt) -> Double { Double((v >> shift) & 0xFF) / 255 }
        func blend(_ shift: UInt) -> Double { ch(base, shift) + (ch(accent, shift) - ch(base, shift)) * alpha }
        return Color(red: blend(16), green: blend(8), blue: blend(0))
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

/// ART_SPEC §19.1: the page backdrop is the tint's wallpaper (`art-wall-*`, 1080 px
/// wide, opaque): aspect-FILLED and centered, fixed to the screen (it never scrolls
/// with content), edge to edge behind the status bar. Dark mode lays #120D1F over it
/// (58% pages / 62% games). Reduce Transparency or Increase Contrast keeps the
/// wallpaper but adds a 20% white (light) / 70% #120D1F (dark) overlay. If the image
/// is missing, the tint's old diagonal gradient (§11) draws instead. Decorative.
struct PageBackground: View {
    let tint: PageTint
    /// The VS and Friends pages are drawn light in every theme (their cards and
    /// ink are fixed light colors), so their backdrop stays on the light look.
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
        let a11y = reduceTransparency || contrast == .increased
        let wall = tint.wallpaper
        Group {
            if ArtAsset.exists(wall) {
                GeometryReader { geo in
                    Image(wall)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                        .overlay(overlay(dark: dark, a11y: a11y))
                        .overlay(alignment: .top) { headerFade(dark: dark) }
                }
                .ignoresSafeArea()
            } else {
                LinearGradient(colors: tint.stops(dark: dark), startPoint: .topLeading, endPoint: .bottomTrailing)
                    .ignoresSafeArea()
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// FINISH_SPEC §N2: a very soft fade under the header area — the page tint at
    /// 55% → 0% over the top ~170 pt (plus the status bar) so the cast sits on calm
    /// color. Menu pages only (game screens have no cast header).
    @ViewBuilder private func headerFade(dark: Bool) -> some View {
        if case .game = tint {
            EmptyView()
        } else {
            let c = tint.stops(dark: dark)[0]
            LinearGradient(colors: [c.opacity(dark ? 0.45 : 0.55), c.opacity(0)], startPoint: .top, endPoint: .bottom)
                .frame(height: 230)
                .allowsHitTesting(false)
        }
    }

    private func overlay(dark: Bool, a11y: Bool) -> Color {
        if dark { return Color(hex: 0x120D1F).opacity(a11y ? 0.70 : tint.darkOverlay) }
        return Color.white.opacity(a11y ? 0.20 : 0)
    }
}

extension View {
    /// §11 / §19: draw the page's wallpaper behind this page and tint its cards' shadows.
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

// MARK: - §17 Share-card chrome

/// The share images' cast pieces (ART_SPEC §17), drawn STATIC (ImageRenderer
/// snapshots one frame, so nothing here animates): the page-tint backdrop, the
/// title art header and the cast strip above the footer. Every piece falls back to
/// what the card drew before when its image is missing.
enum ShareArt {
    /// One mascot in the cast strip on a 1080-wide card, and the gap between them.
    static let castSize: CGFloat = 40
    static let castGap: CGFloat = 6
    /// The title art band in a card header.
    static let titleArtHeight: CGFloat = 76
    static let titleArtMaxWidth: CGFloat = 820

    /// The letter-tile pattern at its natural 720 px per tile (the card is drawn at
    /// scale 1 on a 1080 px canvas, about the ratio the pages use on a phone).
    fileprivate static let tiles: UIImage? = {
        guard let src = UIImage(named: "art-bg-tiles"), let cg = src.cgImage else { return nil }
        return UIImage(cgImage: cg, scale: 1, orientation: .up)
    }()

    /// The card backdrop: the tint's light gradient (top-left → bottom-right) with
    /// the letter tiles on top at the tint's light opacity (100% menus, 55% games).
    struct Background: View {
        let tint: PageTint

        var body: some View {
            ZStack {
                LinearGradient(colors: tint.stops(dark: false), startPoint: .topLeading, endPoint: .bottomTrailing)
                if let tile = ShareArt.tiles {
                    Image(uiImage: tile)
                        .resizable(resizingMode: .tile)
                        .opacity(tint.tileOpacity(dark: false))
                }
            }
        }
    }

    /// A title image (`art-game-*` / `art-title-*`) fit inside `maxWidth` ×
    /// `height`, centered, never stretched; nil when the image doesn't ship.
    @ViewBuilder
    static func title(_ asset: String?, height: CGFloat = titleArtHeight, maxWidth: CGFloat = titleArtMaxWidth) -> some View {
        if let asset, ArtAsset.exists(asset) {
            Image(asset)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(maxWidth: maxWidth, maxHeight: height)
                .frame(height: height)
        }
    }

    /// The ten in WORDOCIOUS order, one centered row (static).
    struct CastStrip: View {
        var size: CGFloat = ShareArt.castSize
        var gap: CGFloat = ShareArt.castGap

        var body: some View {
            HStack(spacing: gap) {
                ForEach(Mascots.cast, id: \.self) { m in
                    Image(m.assetName)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFit()
                        .frame(width: size, height: size)
                }
            }
        }
    }
}
