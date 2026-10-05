import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

// Founder 10-05 ("I love the Stage idea … with the Dressing Room", docs/design/profile-2026-10-05):
// the shared pieces of the dress-up flow — the router every door opens through, the living mascot
// (breathe + blink, hop on tap), the stage set (backdrop · curtains · podium, ChatGPT art) and the gold
// title ribbon. Edit Profile (the Stage), the Dressing Room (MascotBuilderView `.room`) and the Title
// Shelves all draw from here; iOS / Android (DressUp.kt) / web (components/profile/dress-up.tsx) parity.

/// One request to open the Stage (or straight into the Dressing Room).
struct DressUpRequest: Identifiable, Equatable {
    let id = UUID()
    let door: DressUp.Door
}

@MainActor
final class DressUp: ObservableObject {
    static let shared = DressUp()

    enum Door: Equatable {
        /// Edit Profile, the Stage.
        case stage
        /// Straight into the Dressing Room on a tab.
        case room(MascotBuilderTab)
        /// The one-time "Party hat?" offer: the room on Hats with the party hat already on.
        case partyHat
        /// The Stage with the Title Shelves open ("Wear it").
        case titles
    }

    /// RootTabView presents Edit Profile for this.
    @Published var request: DressUpRequest?
    /// The one-time "Party hat?" card (after the first win) is waiting on Home.
    @Published var partyHatOffer = false
    /// Bumps when a one-time flag changes (views that read `done` re-evaluate).
    @Published private(set) var version = 0

    /// Opens the Stage (signed-in players only: a guest has no profile to dress).
    func open(_ door: Door = .stage) {
        guard AuthService.shared.profile != nil, !AuthService.shared.isGuest else { return }
        Haptics.tap()
        request = DressUpRequest(door: door)
    }

    /// Whether `userId` is the signed-in player (their avatar is a door to the Stage).
    static func isOwn(_ userId: String?) -> Bool {
        guard let userId, !userId.isEmpty, let me = AuthService.shared.profile?.id, !AuthService.shared.isGuest else { return false }
        return me.lowercased() == userId.lowercased()
    }

    // MARK: One-time nudges (per account; never repeat once acted on or dismissed)

    enum Nudge: String { case hostInvite = "host", partyHat = "partyhat" }

    private func key(_ n: Nudge) -> String {
        "wd_dressup_\(n.rawValue)_v1:\((AuthService.shared.profile?.id ?? "guest").lowercased())"
    }
    func done(_ n: Nudge) -> Bool { _ = version; return UserDefaults.standard.bool(forKey: key(n)) }
    func finish(_ n: Nudge) {
        UserDefaults.standard.set(true, forKey: key(n))
        if n == .partyHat { partyHatOffer = false }
        version += 1
    }

    /// After a win: the first one (signed in, hatless mascot, never offered) queues the party-hat card.
    func noteWin() {
        guard let p = AuthService.shared.profile, !AuthService.shared.isGuest, !done(.partyHat) else { return }
        let own = MascotLooks.shared.ownConfig(p)
        if let own, own.head != "none" { finish(.partyHat); return }
        partyHatOffer = true
    }

    /// Saving any look ends the Home "Make me yours!" invite for good.
    func noteSaved() { if !done(.hostInvite) { finish(.hostInvite) } }

    #if DEBUG
    /// `-storeDemo` shots reset the nudges so every capture starts fresh.
    func resetForDemo() {
        for n in [Nudge.hostInvite, .partyHat] { UserDefaults.standard.removeObject(forKey: key(n)) }
        SeasonNudge.resetForDemo()
        version += 1
    }
    #endif

    // MARK: Pre-decoding (founder: "everything loads instantly")

    static let art = ["art-dress-podium", "art-dress-curtain-l", "art-dress-curtain-r", "art-dress-bulbs",
                      "art-dress-ribbon-l", "art-dress-ribbon-m", "art-dress-ribbon-r", "art-dress-tag-new",
                      "art-dress-tag-pro", "art-dress-tag-dressup", "art-dress-bubble", "art-dress-partyhat",
                      "art-dress-none", "art-dress-shelf-l", "art-dress-shelf-m", "art-dress-shelf-r", "art-dress-plaque", "art-dress-title", "art-dress-lock"]
        + MascotBuilderTab.roomTabs.map { "art-dress-tab-\($0.artId)" }

    /// Decode the stage set + tab icons at their display sizes (utility thread), and compose the
    /// signed-in player's stage mascot frames once, so the Stage and the room open on a ready frame.
    static func prewarm() {
        ArtThumbs.prewarm(art.map { ($0, $0.hasPrefix("art-dress-tab-") ? 34 : 280) })
        Task { @MainActor in
            await Task.yield()
            guard let p = AuthService.shared.profile else { return }
            let c = MascotLooks.shared.ownConfig(p) ?? MascotLooks.display(saved: nil, castId: nil, frame: nil, username: p.username,
                                                                           accentHex: p.accentColor)
            LiveMascotCache.prewarm(c, initial: AvatarCatalog.initial(p.username), size: StageMetrics.mascot)
        }
    }
}

/// A row link: your own row opens your Stage, anyone else's their public profile (NavigationLink value).
struct OwnOrProfileLink<Label: View>: View {
    let id: String
    var own: Bool = false
    @ViewBuilder var label: () -> Label
    var body: some View {
        if own || DressUp.isOwn(id) {
            Button { DressUp.shared.open() } label: { label() }
        } else {
            NavigationLink(value: id) { label() }
        }
    }
}

// MARK: - Stage metrics (shared by the Stage, the room and the shelves)

enum StageMetrics {
    static let height: CGFloat = 268
    static let roomHeight: CGFloat = 250
    static let mascot: CGFloat = 176
    static let podiumWidth: CGFloat = 232
    /// The stage header's side slots (× left, SAVE / DONE right): equal, so the heading centers.
    static let sideSlot: CGFloat = 86
}

// MARK: - The living mascot

/// The three frames a living mascot swaps between (the maker's own layers: eyes swap for the blink,
/// eyes + mouth for the tap grin). Composed once per config into bitmaps (LiveMascotCache).
enum LiveFrame: Int, CaseIterable { case rest, blink, cheer }

#if canImport(UIKit)
@MainActor
enum LiveMascotCache {
    private static let cache: NSCache<NSString, UIImage> = { let c = NSCache<NSString, UIImage>(); c.countLimit = 48; return c }()

    /// Eyes that can't close (lenses / one big eye) never blink.
    static let noBlink: Set<String> = ["glasses", "sunglasses", "cyclops", "happy", "none"]

    static func config(_ c: AvatarConfig, _ f: LiveFrame) -> AvatarConfig {
        var v = c
        v.frame = "none"
        guard f != .rest else { return v }
        if !noBlink.contains(c.eyes), let fit = MascotParts.fit, AvatarFit.pickConflict(v, field: "eyes", id: "happy", manifest: fit) == nil {
            v.eyes = "happy"
        }
        if f == .cheer, let fit = MascotParts.fit, c.mouth != "laugh", c.mouth != "none",
           AvatarFit.pickConflict(v, field: "mouth", id: "laugh", manifest: fit) == nil {
            v.mouth = "laugh"
        }
        return v
    }

    static func key(_ c: AvatarConfig, _ initial: String, _ size: CGFloat, _ f: LiveFrame) -> String {
        "\(config(c, f).cacheKey)|\(initial)|\(Int(size))"
    }

    static func image(_ c: AvatarConfig, initial: String, size: CGFloat, frame f: LiveFrame) -> UIImage? {
        cache.object(forKey: key(c, initial, size, f) as NSString)
    }

    /// Renders (on main, one frame per turn) whatever frames are missing.
    @discardableResult
    static func render(_ c: AvatarConfig, initial: String, size: CGFloat, frame f: LiveFrame) -> UIImage? {
        let k = key(c, initial, size, f) as NSString
        if let hit = cache.object(forKey: k) { return hit }
        let r = ImageRenderer(content: MascotCutout(config: config(c, f), initial: initial, size: size))
        r.scale = UIScreen.main.scale
        r.isOpaque = false
        guard let img = r.uiImage else { return nil }
        cache.setObject(img, forKey: k)
        return img
    }

    static func prewarm(_ c: AvatarConfig, initial: String, size: CGFloat) {
        Task { @MainActor in
            for f in LiveFrame.allCases {
                await Task.yield()
                render(c, initial: initial, size: size, frame: f)
            }
        }
    }
}
#endif

/// Your mascot, alive (founder 10-05; the cast-rig idea on the maker's layers): an idle breathe
/// (a 1.8% squash on a 3.4 s loop), a blink every few seconds (the eyes layer swaps), and a hop +
/// grin on tap. Bitmaps + transforms only (60 fps); Reduce Motion keeps it still (a tap still grins).
struct LiveMascot: View {
    let config: AvatarConfig
    let initial: String
    var size: CGFloat = StageMetrics.mascot
    /// Bump to hop from outside (the room's Done, a part change).
    var hopToken: Int = 0
    var tappable = true

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var frame: LiveFrame = .rest
    @State private var breathe = false
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1
    @State private var ready = 0

    var body: some View {
        ZStack {
            ForEach(LiveFrame.allCases, id: \.rawValue) { f in
                still(f).opacity(frame == f ? 1 : 0)
            }
        }
        .frame(width: size, height: size)
        // Breathe on its own modifier, so the hop's springs never cancel the loop.
        .scaleEffect(x: breathe ? 1.018 : 1, y: breathe ? 0.982 : 1, anchor: .bottom)
        .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
        .offset(y: hop)
        .contentShape(Rectangle())
        .onTapGesture { if tappable { hopNow(sound: true) } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your mascot")
        .accessibilityAddTraits(tappable ? .isButton : [])
        .accessibilityHint(tappable ? "Makes your mascot hop" : "")
        .onAppear {
            guard !Motion.calm(envReduce) else { return }
            withAnimation(.easeInOut(duration: 1.7).repeatForever(autoreverses: true)) { breathe = true }
        }
        .task(id: config.cacheKey + initial) {
            #if canImport(UIKit)
            // Compose the three frames off the presenting frame (one per main-loop turn).
            for f in LiveFrame.allCases where LiveMascotCache.image(config, initial: initial, size: size, frame: f) == nil {
                await Task.yield()
                LiveMascotCache.render(config, initial: initial, size: size, frame: f)
                ready += 1
            }
            #endif
            await blinkLoop()
        }
        .onChange(of: hopToken) { _ in hopNow(sound: false) }
    }

    @ViewBuilder private func still(_ f: LiveFrame) -> some View {
        #if canImport(UIKit)
        let _ = ready
        if let img = LiveMascotCache.image(config, initial: initial, size: size, frame: f) {
            Image(uiImage: img).resizable().interpolation(.high)
        } else if f == .rest {
            MascotCutout(config: LiveMascotCache.config(config, .rest), initial: initial, size: size)
        }
        #else
        MascotCutout(config: config, initial: initial, size: size)
        #endif
    }

    private func blinkLoop() async {
        guard !Motion.calm(envReduce), !LiveMascotCache.noBlink.contains(config.eyes) else { return }
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: UInt64(Double.random(in: 2.6...4.8) * 1e9))
            if Task.isCancelled { return }
            if frame == .rest { frame = .blink }
            try? await Task.sleep(nanoseconds: 140_000_000)
            if frame == .blink { frame = .rest }
        }
    }

    private func hopNow(sound: Bool) {
        if sound { Feedback.hop(volume: 0.8); Haptics.tap() }
        frame = .cheer
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) { if frame == .cheer { frame = .rest } }
        guard !Motion.calm(envReduce) else { return }
        withAnimation(.easeOut(duration: 0.08)) { squash = 0.92 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            withAnimation(.spring(response: 0.24, dampingFraction: 0.55)) { hop = -size * 0.13; squash = 1.04 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            withAnimation(.spring(response: 0.34, dampingFraction: 0.5)) { hop = 0; squash = 1 }
        }
    }
}

// MARK: - The stage set

/// The Stage: the player's backdrop full-bleed, soft curtains at the sides, a spotlight, the podium
/// (ChatGPT stage set, 10-05) and the living mascot (or the framed photo) standing on it.
struct DressStage<Overlay: View>: View {
    let config: AvatarConfig
    let initial: String
    /// The player's photo when "My photo" shows (drawn as a framed portrait, never on a body).
    var photo: (url: String?, username: String, userId: String?)? = nil
    var height: CGFloat = StageMetrics.height
    var mascotSize: CGFloat = StageMetrics.mascot
    var hopToken: Int = 0
    var curtains = true
    var bulbs = false
    @ViewBuilder var overlay: () -> Overlay

    var body: some View {
        let dark = Theme.isDark
        let base = Color(hex: AvatarCatalog.colorValue(config.color))
        let podiumW = min(StageMetrics.podiumWidth, mascotSize * 1.34)
        let podiumH = podiumW * 241 / 555
        ZStack(alignment: .bottom) {
            MascotBackdrop(bg: config.bg, base: base, dark: dark)
            // the spotlight: a soft cream pool on the podium
            RadialGradient(colors: [Color.white.opacity(dark ? 0.16 : 0.42), .clear], center: .bottom,
                           startRadius: 4, endRadius: height * 0.75)
            if curtains {
                HStack(spacing: 0) {
                    StageArt("art-dress-curtain-l", height: height * 0.92)
                    Spacer(minLength: 0)
                    StageArt("art-dress-curtain-r", height: height * 0.92)
                }
                // minWidth 0: on a narrow phone the two curtains are wider than the screen; they tuck
                // under the edges (clipped) instead of widening the stage past the screen.
                .frame(minWidth: 0, maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .offset(y: -height * 0.02)
            }
            if bulbs {
                StageArt("art-dress-bulbs", width: 280)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.top, 6)
            }
            ZStack(alignment: .bottom) {
                StageArt("art-dress-podium", width: podiumW)
                Group {
                    if let photo {
                        AvatarView(url: photo.url, username: photo.username, size: mascotSize * 0.74, userId: photo.userId)
                            .shadow(color: Color(hex: 0x4C1D95).opacity(0.22), radius: 6, y: 4)
                            .padding(.bottom, mascotSize * 0.06)
                    } else {
                        LiveMascot(config: config, initial: initial, size: mascotSize, hopToken: hopToken)
                    }
                }
                // the feet land on the podium's top surface
                .padding(.bottom, podiumH * 0.42)
            }
            .padding(.bottom, 10)
        }
        .frame(height: height)
        .frame(minWidth: 0, maxWidth: .infinity)
        // The controls lay out in the visible stage (never in the art's own, wider box).
        .overlay { overlay() }
        .clipped()
    }
}

/// The Stage / Dressing Room / Title Shelves close: the family's soft 3D X, bare (no bubble). On the stage it is
/// whitened with a deep drop shadow so it reads on the curtains (the pale family X disappeared there); off the
/// stage it wears the deep violet. A 44 pt hit area. Android: StageCloseButton (DressUp.kt), web: StageClose (dress-up.tsx).
struct StageCloseButton: View {
    var onStage = true
    var label = "Close"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if let ui = FamilyArt.shared.image("art-fam-cic-close") {
                    if onStage {
                        Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                            .saturation(0).brightness(0.22)
                    } else {
                        Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                            .colorMultiply(Color(hex: 0x8B5CF6))
                    }
                } else {
                    Image(systemName: "xmark").resizable().scaledToFit().fontWeight(.black)
                        .foregroundStyle(onStage ? Color.white : Color(hex: 0x6D28D9))
                }
            }
            .frame(width: 24, height: 24)
            .shadow(color: onStage ? Color(hex: 0x2E1065).opacity(0.6) : Color(hex: 0x4C1D95).opacity(0.22),
                    radius: onStage ? 2.5 : 2, x: 0, y: onStage ? 2 : 2.5)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishIcon)
        .accessibilityLabel(label)
    }
}

extension DressStage where Overlay == EmptyView {
    init(config: AvatarConfig, initial: String, photo: (url: String?, username: String, userId: String?)? = nil,
         height: CGFloat = StageMetrics.height, mascotSize: CGFloat = StageMetrics.mascot, hopToken: Int = 0,
         curtains: Bool = true, bulbs: Bool = false) {
        self.init(config: config, initial: initial, photo: photo, height: height, mascotSize: mascotSize, hopToken: hopToken,
                  curtains: curtains, bulbs: bulbs, overlay: { EmptyView() })
    }
}

/// A dress-up art piece at a fixed width or height (pre-decoded thumbnail, aspect kept); nothing when it doesn't ship.
struct StageArt: View {
    let name: String
    var width: CGFloat? = nil
    var height: CGFloat? = nil

    init(_ name: String, width: CGFloat? = nil, height: CGFloat? = nil) {
        self.name = name; self.width = width; self.height = height
    }

    var body: some View {
        if let a = ArtAsset.aspect(name) {
            let w = width ?? (height ?? 40) * a
            let h = height ?? (width ?? 40) / a
            ArtThumbs.image(name, points: max(w, h)).resizable().interpolation(.high)
                .frame(width: w, height: h)
                .accessibilityHidden(true)
        }
    }
}

// MARK: - The title ribbon

/// The featured title as a gold ribbon (three-slice ChatGPT art, so it stretches); long titles shrink
/// to fit (never wrap or truncate). `placeholder` = the soft "Choose a title" state.
struct TitleRibbon: View {
    let text: String
    var height: CGFloat = 28
    var maxWidth: CGFloat = 260
    var placeholder = false

    var body: some View {
        let cap = height * 147 / 120
        Text(text.uppercased())
            .font(Brand.font(height * 0.43, .black)).tracking(0.6)
            .foregroundStyle(placeholder ? Color(hex: 0x92400E).opacity(0.7) : Color(hex: 0x7C2D12))
            .lineLimit(1).minimumScaleFactor(0.4)
            .padding(.horizontal, cap * 0.8)
            .frame(height: height)
            .offset(y: -height * 0.07)
            .background {
                HStack(spacing: 0) {
                    slice("art-dress-ribbon-l").frame(width: cap)
                    slice("art-dress-ribbon-m")
                    slice("art-dress-ribbon-r").frame(width: cap)
                }
                .opacity(placeholder ? 0.55 : 1)
            }
            .frame(maxWidth: maxWidth)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(placeholder ? text : "Title, \(text)")
    }

    @ViewBuilder private func slice(_ name: String) -> some View {
        if ArtAsset.exists(name) {
            ArtThumbs.image(name, points: height * 1.3).resizable().interpolation(.high)
        } else {
            LinearGradient(colors: [Color(hex: 0xFDE68A), Color(hex: 0xF5B82E)], startPoint: .top, endPoint: .bottom)
        }
    }
}

// MARK: - The one-time seasonal nudge (10-05)

/// First Home open in a season with a mascot shelf (WordociousCore AvatarSeason.nudgeDue): "Dress up for Halloween?",
/// the party-hat card's pattern. Yes opens the Dressing Room on the seasonal shelf; Yes or x end it for this season
/// (it comes back next year). Only for signed-in players not already wearing one of the season's parts.
@MainActor
enum SeasonNudge {
    private static func key() -> String { "wd_dressup_season_v1:\((AuthService.shared.profile?.id ?? "guest").lowercased())" }
    static var seen: [String] { UserDefaults.standard.stringArray(forKey: key()) ?? [] }
    static func finish(_ season: String) {
        UserDefaults.standard.set(seen + [AvatarSeason.nudgeKey(season, day: AvatarSeason.today())], forKey: key())
    }
    static func due() -> String? {
        guard let p = AuthService.shared.profile, !AuthService.shared.isGuest, let fit = MascotParts.fit else { return nil }
        let own = MascotLooks.shared.ownConfig(p).map(AvatarSeason.worn)
        return AvatarSeason.nudgeDue(day: AvatarSeason.today(), preview: MascotSeasonal.season ?? "none", config: own, seen: seen, manifest: fit)
    }
    #if DEBUG
    static func resetForDemo() { UserDefaults.standard.removeObject(forKey: key()) }
    #endif
}

struct SeasonDressOffer: View {
    @ObservedObject private var dressUp = DressUp.shared
    @State private var gone = false

    var body: some View {
        let _ = dressUp.version
        if !gone, let season = SeasonNudge.due() {
            let title = MascotSeasonal.title ?? "the season"
            HStack(spacing: 10) {
                StageArt("art-av-acc-\(MascotSeasonal.shelf.first?.id ?? "pumpkinhat")", height: 44)
                    .frame(width: 50)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Dress up for \(title)?").font(Brand.font(15, .black))
                        .foregroundStyle(Theme.isDark ? Theme.textPrimary : Color(hex: 0x6D28D9))
                    Text("Free looks for the season.").font(Brand.font(11, .bold))
                        .foregroundStyle(Theme.isDark ? Theme.textSecondary : Color(hex: 0x7A6AA6))
                }
                .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 4)
                Button { SeasonNudge.finish(season); gone = true; dressUp.open(.room(.season)) } label: { CandyLabel(title: "Yes!") }
                    .buttonStyle(CandyButtonStyle(variant: .pink, size: .small, fullWidth: false))
                FamilyCloseButton(size: 22, label: "No thanks") {   // family 3D X
                    Haptics.tap(); SeasonNudge.finish(season); withAnimation(.easeOut(duration: 0.2)) { gone = true }
                }
                .padding(.vertical, -5)
            }
            .padding(.leading, 10).padding(.trailing, 2).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: 0xFFEDD5), Color(hex: 0xEDE9FE)], startPoint: .leading, endPoint: .trailing)
                    .opacity(Theme.isDark ? 0.16 : 1)))
            .transition(.opacity)
        }
    }
}

// MARK: - Door 3: the one-time "Party hat?" offer

/// After the player's first win (once per account): a small soft card on Home — the party hat (ChatGPT
/// art), "First win! Party hat?", YES opens the Dressing Room on Hats with the hat already on; × or YES
/// end it for good. Never on top of a game.
struct PartyHatOffer: View {
    @ObservedObject private var dressUp = DressUp.shared

    var body: some View {
        if dressUp.partyHatOffer && !dressUp.done(.partyHat) {
            HStack(spacing: 10) {
                StageArt("art-dress-partyhat", height: 50)
                VStack(alignment: .leading, spacing: 1) {
                    Text("First win! Party hat?").font(Brand.font(15, .black))
                        .foregroundStyle(Theme.isDark ? Theme.textPrimary : Color(hex: 0x6D28D9))
                    Text("Your mascot wants to celebrate.").font(Brand.font(11, .bold))
                        .foregroundStyle(Theme.isDark ? Theme.textSecondary : Color(hex: 0x7A6AA6))
                }
                .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 4)
                Button { dressUp.open(.partyHat) } label: { CandyLabel(title: "Yes!") }
                    .buttonStyle(CandyButtonStyle(variant: .pink, size: .small, fullWidth: false))
                FamilyCloseButton(size: 22, label: "No thanks") {   // family 3D X
                    Haptics.tap(); withAnimation(.easeOut(duration: 0.2)) { dressUp.finish(.partyHat) }
                }
                .padding(.vertical, -5)
            }
            .padding(.leading, 10).padding(.trailing, 2).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: 0xFCE7F3), Color(hex: 0xEDE9FE)], startPoint: .leading, endPoint: .trailing)
                    .opacity(Theme.isDark ? 0.16 : 1)))
            .transition(.opacity)
        }
    }
}
