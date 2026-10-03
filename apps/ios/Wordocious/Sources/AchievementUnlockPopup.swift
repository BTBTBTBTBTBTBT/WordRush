import SwiftUI
import UIKit
import WordociousCore

// FINISH_SPEC §V2 (+ the §V3 level-up popup): the unlock moment. When
// `AchievementService.checkAchievements` reports newly unlocked keys, each one gets a
// popup in the §R1 card language — the badge springs in big on a stage with turning
// rays + one confetti burst, "ACHIEVEMENT UNLOCKED" in lettering-style ink, its name
// and description, the `unlock` sound + a success haptic, and a candy "Nice!".
// Several unlocks queue one after another. A level-up that crosses into a new tier
// (XpToastView) queues a smaller "NEW TIER" popup with the tier badge.
//
// Games run in full-screen covers, so the popup is drawn in its own overlay window
// above every presentation (created while something is queued, removed after).
// `AchievementUnlockHost` is mounted once at the app root and arms the center.

@MainActor
final class AchievementUnlockCenter: ObservableObject {
    static let shared = AchievementUnlockCenter()

    enum Moment: Identifiable, Equatable {
        /// `unlocked` / `total` = "3 of 111 unlocked" (0 total = unknown); `xp` = reward.
        case achievement(key: String, name: String, description: String, icon: String?,
                         category: String = "", xp: Int? = nil, unlocked: Int = 0, total: Int = 0)
        case levelUp(level: Int)

        var id: String {
            switch self {
            case .achievement(let key, _, _, _, _, _, _, _): return "a:\(key)"
            case .levelUp(let level): return "l:\(level)"
            }
        }
    }

    @Published private(set) var queue: [Moment] = []
    var current: Moment? { queue.first }

    /// Set by the root host — nothing presents before the app UI exists.
    private var attached = false
    /// Every moment already shown this session (never celebrate twice).
    private var seen: Set<String> = []
    private var pending: [Moment] = []
    private var window: UIWindow?
    private var hideWork: DispatchWorkItem?
    /// FINISH_SPEC BF2: reasons the popup must wait (the win popup is up, a live VS
    /// match) — moments hold in `pending` and show once every block lifts.
    private var blocks: Set<String> = []

    private init() {}

    func attach() {
        guard !attached else { return }
        attached = true
        flush()
    }

    // MARK: BF2 gating

    func block(_ reason: String) { blocks.insert(reason) }

    func unblock(_ reason: String) {
        guard blocks.remove(reason) != nil, blocks.isEmpty else { return }
        // A beat after the win card leaves, never on top of it.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in self?.flush() }
    }

    private func flush() {
        guard attached, blocks.isEmpty, !pending.isEmpty else { return }
        let p = pending
        pending = []
        add(p)
    }

    // MARK: BF1 detection — the persisted "seen" set

    private static func seenKey(_ uid: String) -> String { "achievements-seen-v1-\(uid.lowercased())" }

    private static func loadSeen(_ uid: String) -> Set<String>? {
        (UserDefaults.standard.array(forKey: seenKey(uid)) as? [String]).map(Set.init)
    }

    private static func saveSeen(_ s: Set<String>, _ uid: String) {
        UserDefaults.standard.set(Array(s).sorted(), forKey: seenKey(uid))
    }

    /// On launch / foreground / after a result lands: celebrate any achievement the
    /// player has earned (anywhere — server awards, crons, other devices) but hasn't
    /// seen here. The first run after this update seeds the set silently.
    func sync() async {
        guard let uid = AuthService.shared.profile?.id else { return }
        let dates = await AchievementService.fetchUnlockedDates(userId: uid)
        guard !dates.isEmpty || Self.loadSeen(uid) != nil else {
            // Nothing earned yet: start an empty set so the first unlock celebrates.
            Self.saveSeen([], uid); return
        }
        let earned = dates.map { AchievementSeen.Earned(key: $0.key, at: $0.value) }
        let r = AchievementSeen.diff(earned: earned, seen: Self.loadSeen(uid))
        Self.saveSeen(r.seen, uid)
        await present(keys: r.celebrate, unlockedCount: dates.count)
    }

    /// Newly unlocked achievement keys (from checkAchievements / a result response).
    /// Each is marked seen (so a later sync never repeats it) and queued.
    func enqueue(keys: [String]) async {
        var fresh = keys.filter { !seen.contains("a:\($0)") }
        if let uid = AuthService.shared.profile?.id {
            let stored = Self.loadSeen(uid) ?? []
            fresh = AchievementSeen.unseen(fresh, seen: stored)
            Self.saveSeen(stored.union(fresh), uid)
        }
        guard !fresh.isEmpty else { return }
        // A beat so a game's own win popup lands (and holds the queue) first.
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        await present(keys: fresh, unlockedCount: nil)
    }

    private func present(keys: [String], unlockedCount: Int?) async {
        guard !keys.isEmpty else { return }
        let catalog = AchievementCatalog.shared
        if keys.contains(where: { catalog.find($0) == nil }) { await catalog.load() }
        var unlocked = unlockedCount ?? 0
        if unlockedCount == nil, let uid = AuthService.shared.profile?.id {
            unlocked = await AchievementService.fetchUnlocked(userId: uid).count
        }
        let total = catalog.all.count
        let moments: [Moment] = keys.compactMap { key in
            if let d = catalog.find(key) {
                // Hidden achievements stay hidden (their tracking hasn't shipped).
                if d.hidden == true { return nil }
                return .achievement(key: key, name: d.name, description: d.description, icon: d.icon,
                                    category: d.category, xp: d.xp, unlocked: max(unlocked, 1), total: total)
            }
            return .achievement(key: key, name: Self.prettify(key), description: "", icon: nil,
                                unlocked: max(unlocked, 1), total: total)
        }
        add(moments)
    }

    /// §V3: a level-up that crossed into a new tier.
    func enqueueLevelUp(newLevel: Int) {
        add([.levelUp(level: newLevel)])
    }

    /// "Awesome!" — on to the next queued moment (or close).
    func advance() {
        if !queue.isEmpty { queue.removeFirst() }
        if queue.isEmpty { scheduleHide() }
    }

    /// Close everything now (See all / share).
    func dismissAll() {
        queue.removeAll()
        scheduleHide()
    }

    private func add(_ moments: [Moment]) {
        let fresh = moments.filter { !seen.contains($0.id) }
        guard !fresh.isEmpty else { return }
        guard attached, blocks.isEmpty else { pending.append(contentsOf: fresh.filter { m in !pending.contains(m) }); return }
        fresh.forEach { seen.insert($0.id) }
        queue.append(contentsOf: fresh)
        showWindow()
    }

    private func showWindow() {
        hideWork?.cancel(); hideWork = nil
        if let window { window.isHidden = false; return }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else { return }
        let w = UIWindow(windowScene: scene)
        w.windowLevel = .alert
        w.backgroundColor = .clear
        let host = UIHostingController(rootView: AchievementUnlockLayer())
        host.view.backgroundColor = .clear
        w.rootViewController = host
        w.overrideUserInterfaceStyle = ThemeManager.shared.colorScheme == .dark ? .dark : .light
        w.isHidden = false
        window = w
    }

    /// Let the card animate out, then drop the window (unless something new queued).
    private func scheduleHide() {
        hideWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.queue.isEmpty else { return }
            self.window?.isHidden = true
            self.window = nil
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
    }

    private static func prettify(_ key: String) -> String {
        key.split(separator: "_").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }
}

/// BF2: a view that holds the unlock popups while it's on screen (the win popup, a
/// live VS match).
private struct HoldsAchievementPopups: ViewModifier {
    let reason: String
    let active: Bool
    func body(content: Content) -> some View {
        content
            .onAppear { if active { AchievementUnlockCenter.shared.block(reason) } }
            .onChange(of: active) { on in
                if on { AchievementUnlockCenter.shared.block(reason) } else { AchievementUnlockCenter.shared.unblock(reason) }
            }
            .onDisappear { AchievementUnlockCenter.shared.unblock(reason) }
    }
}

extension View {
    /// BF2: achievement popups wait while this is on screen (and `active`).
    func holdsAchievementPopups(_ reason: String, active: Bool = true) -> some View {
        modifier(HoldsAchievementPopups(reason: reason, active: active))
    }
}

/// Mounted once at the app root (WordociousApp): arms the unlock center. Draws nothing.
struct AchievementUnlockHost: View {
    var body: some View {
        Color.clear.frame(width: 0, height: 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear { AchievementUnlockCenter.shared.attach() }
    }
}

/// The overlay window's content: the current moment's popup over a dim backdrop.
private struct AchievementUnlockLayer: View {
    @ObservedObject private var center = AchievementUnlockCenter.shared
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        let still = envReduce || Theme.reduceMotion
        ZStack {
            if let m = center.current {
                Color(hex: 0x18182E).opacity(0.6).ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture { center.advance() }
                AchievementUnlockPopup(moment: m, remaining: center.queue.count - 1) { center.advance() }
                    .id(m.id)
                    .transition(still ? .opacity : .scale(scale: 0.85).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(still ? .easeInOut(duration: 0.2) : .spring(response: 0.4, dampingFraction: 0.75), value: center.current?.id)
        .preferredColorScheme(ThemeManager.shared.colorScheme)
    }
}

/// §V2: one unlock (or new-tier) popup in the §R1 card language.
struct AchievementUnlockPopup: View {
    let moment: AchievementUnlockCenter.Moment
    var remaining: Int = 0
    let onNice: () -> Void

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var badgeIn = false
    @State private var bob = false
    @State private var raysTurn = false
    @State private var sweep: CGFloat = -1
    @State private var confetti = false
    @ObservedObject private var power = PowerMode.shared

    private var still: Bool { envReduce || Theme.reduceMotion }
    /// §AD: Low Power Mode (or Reduce Motion) stops the turning rays and the bob.
    private var calm: Bool { Motion.calm(envReduce) }

    private var accent: Color {
        switch moment {
        case .achievement: return Color(hex: 0x7C3AED)
        case .levelUp(let level): return BadgeArt.tierAccent(LevelTier.forLevel(level))
        }
    }

    private var badgeAsset: String {
        switch moment {
        case .achievement(let key, _, _, let icon, let category, _, _, _):
            return BadgeArt.achievementAsset(key: key, icon: icon, category: category)
        case .levelUp(let level): return LevelTier.forLevel(level).assetName
        }
    }

    private var headline: String {
        switch moment {
        case .achievement: return "ACHIEVEMENT UNLOCKED"
        case .levelUp: return "NEW TIER!"
        }
    }

    private var title: String {
        switch moment {
        case .achievement(_, let name, _, _, _, _, _, _): return name
        case .levelUp(let level): return "Level \(level) · \(LevelTier.forLevel(level).label)"
        }
    }

    private var detail: String {
        switch moment {
        case .achievement(_, _, let description, _, _, _, _, _): return description
        case .levelUp(let level): return "You reached the \(LevelTier.forLevel(level).label) tier. Keep it rolling!"
        }
    }

    private var isLevel: Bool { if case .levelUp = moment { return true } else { return false } }

    /// BF2: the XP reward and the "N of M unlocked" progress (achievements only).
    private var xp: Int? { if case .achievement(_, _, _, _, _, let xp, _, _) = moment { return xp } else { return nil } }
    private var progress: (Int, Int)? {
        if case .achievement(_, _, _, _, _, _, let n, let total) = moment, total > 0 { return (min(n, total), total) }
        return nil
    }
    private var achievementName: String {
        if case .achievement(_, let name, _, _, _, _, _, _) = moment { return name } else { return "" }
    }
    /// BF2: the presenting pair (until art-scene-achievement ships).
    private static let presenters: [(MascotID, String)] = [(.i, "cheer"), (.d, "cheer")]

    var body: some View {
        let dark = Theme.isDark
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        let badgeSize: CGFloat = isLevel ? 120 : 150
        ZStack {
            if confetti && !still { ConfettiView().ignoresSafeArea() }
            VStack(spacing: 12) {
                // The badge on a stage: glow, turning rays, ground shadow, spring-in, bob.
                ZStack {
                    RadialGradient(colors: [accent.opacity(0.34), accent.opacity(0)], center: .center, startRadius: 6, endRadius: 110)
                        .frame(width: 230, height: 200)
                    if !calm {
                        BadgeRays(color: accent.opacity(0.14))
                            .frame(width: 230, height: 230)
                            .mask(RadialGradient(colors: [.black, .clear], center: .center, startRadius: 14, endRadius: 115))
                            .drawingGroup()   // §AZ: rasterized, then only rotated
                            .rotationEffect(.degrees(raysTurn ? 360 : 0))
                    }
                    Ellipse().fill(RadialGradient(colors: [Color(hex: 0x3C1E6E).opacity(0.2), Color(hex: 0x3C1E6E).opacity(0)],
                                                  center: .center, startRadius: 0, endRadius: badgeSize * 0.34))
                        .frame(width: badgeSize * 0.7, height: badgeSize * 0.14)   // §AZ: no live blur
                        .offset(y: badgeSize * 0.52)
                    // BF2: a mascot pair presents the badge — the art-scene-achievement
                    // stage when it ships (badge composited on its glowing frame), else
                    // two cast poses beside it.
                    if !isLevel && ArtAsset.exists("art-scene-achievement") {
                        Image("art-scene-achievement").resizable().interpolation(.high).scaledToFit()
                            .frame(height: 190)
                            .opacity(badgeIn ? 1 : 0)
                    } else if !isLevel {
                        HStack(spacing: badgeSize * 0.62) {
                            PoseImage(Self.presenters[0].0, Self.presenters[0].1, height: 82)
                            PoseImage(Self.presenters[1].0, Self.presenters[1].1, height: 82)
                                .scaleEffect(x: -1, y: 1)
                        }
                        .offset(y: 26)
                        .opacity(badgeIn ? 1 : 0)
                    }
                    Image(badgeAsset)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: isLevel ? badgeSize : badgeSize * 0.78, height: isLevel ? badgeSize : badgeSize * 0.78)
                        .shadow(color: accent.opacity(0.45), radius: 16, x: 0, y: 6)
                        .scaleEffect(badgeIn ? 1 : 0.3)
                        .opacity(badgeIn ? 1 : 0)
                        .offset(y: (bob && !calm ? -5 : 0) - (isLevel ? 0 : 8))
                }
                .frame(height: isLevel ? 160 : 190)
                .accessibilityHidden(true)

                if !isLevel {
                    // BF2: the gold live lettering, the NAME big, the PURPOSE line.
                    LiveHeadline(text: "ACHIEVEMENT UNLOCKED!", palette: .celebration, size: 22, maxLines: 1, minimumScale: 0.6)
                    VStack(spacing: 6) {
                        Text(achievementName).softNumber(26)
                            .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                        if !detail.isEmpty {
                            Text(detail).font(Brand.font(15, .bold)).foregroundStyle(FinishInk.heading)
                                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                        }
                        HStack(spacing: 8) {
                            if let xp {
                                HStack(spacing: 4) {
                                    Icon3D(.trophy, size: 16)
                                    Text("+\(xp) XP").softNumber(14)
                                }
                                .padding(.horizontal, 10).padding(.top, 6).padding(.bottom, 4)
                                .tintedPill(Color(hex: 0xF5A524))
                            }
                            if let (n, total) = progress {
                                Text("\(n) of \(total) unlocked").font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
                            }
                        }
                    }
                    .padding(.horizontal, 6)
                    .accessibilityElement(children: .combine)
                } else {
                // "NEW TIER!" in lettering-style ink + one gloss sweep.
                let ink = OutlinedText(text: headline, size: 26, fill: Color(hex: 0xFFD166), width: 2)
                ink.overlay {
                    if !still {
                        GeometryReader { g in
                            LinearGradient(colors: [.white.opacity(0), .white.opacity(0.75), .white.opacity(0)],
                                           startPoint: .leading, endPoint: .trailing)
                                .frame(width: g.size.width * 0.35)
                                .offset(x: sweep * g.size.width)
                        }
                        .mask(ink)
                        .allowsHitTesting(false)
                    }
                }
                .minimumScaleFactor(0.6)

                VStack(spacing: 5) {
                    if case .levelUp(let level) = moment {
                        LevelBadge(level: level, size: 26, showTier: true)
                    } else {
                        Text(title).font(Brand.font(22, .black)).foregroundStyle(FinishInk.heading)
                            .multilineTextAlignment(.center)
                    }
                    if !detail.isEmpty {
                        Text(detail).font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
                            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 6)
                }

                Button(action: onNice) { CandyLabel(title: isLevel ? "Nice!" : "Awesome!") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
                    .padding(.top, 4)
                if !isLevel {
                    // BF2: See all (→ Stats achievements) + share the badge card.
                    HStack(spacing: 10) {
                        Button { seeAll() } label: { CandyLabel(title: "See all") }
                            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                        Button { shareBadge() } label: {
                            Icon3D(.share, size: 26).frame(width: 44, height: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.squishIcon)
                        .accessibilityLabel("Share achievement")
                    }
                }
                if remaining > 0 {
                    Text("\(remaining) more").font(Brand.font(11, .black)).foregroundStyle(FinishInk.secondary)
                        .padding(.horizontal, 10).padding(.top, 5).padding(.bottom, 3)
                        .tintedPill(Color(hex: 0x7C3AED))
                }
            }
            .padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 18)
            .background {
                // §R1: the accent at ~10% → ~4% over warm cream (dark: a deep accent tint) + the rainbow bar.
                ZStack(alignment: .top) {
                    if dark {
                        shape.fill(Theme.surface)
                        shape.fill(LinearGradient(colors: [accent.opacity(0.24), accent.opacity(0.08)], startPoint: .top, endPoint: .bottom))
                    } else {
                        shape.fill(LinearGradient(colors: [accent.mixed(over: Color(hex: 0xFFF8F1), 0.10),
                                                           accent.mixed(over: Color(hex: 0xFFF8F1), 0.04)],
                                                  startPoint: .top, endPoint: .bottom))
                    }
                    LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                                   startPoint: .leading, endPoint: .trailing)
                        .frame(height: 8)
                }
                .clipShape(shape)
            }
            .overlay(shape.stroke(dark ? accent.opacity(0.35) : accent.wash(0.28), lineWidth: 1.5))
            .shadow(color: accent.opacity(0.35), radius: 26, x: 0, y: 12)
            .padding(.horizontal, 28)
            .frame(maxWidth: 400)
            .accessibilityElement(children: .contain)
            .accessibilityAddTraits(.isModal)
        }
        .onAppear(perform: start)
    }

    /// BF2 "See all": close the popups, close any game, open Stats → All-time (achievements).
    private func seeAll() {
        AchievementUnlockCenter.shared.dismissAll()
        TabRouterModel.dismissAllOverlays(animated: true)
        StatsJump.requestAchievements()
    }

    /// BF2: share the badge card as an image (S-style), after the popup closes.
    private func shareBadge() {
        let card = AchievementShareCard(name: achievementName, detail: detail, badge: badgeAsset)
        let r = ImageRenderer(content: card)
        r.scale = 3
        let image = r.uiImage
        AchievementUnlockCenter.shared.dismissAll()
        guard let image else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            ShareService.present(items: [image, "I unlocked \(achievementName) on Wordocious! wordocious.com"])
        }
    }

    private func start() {
        // §U: the `unlock` sound + a success haptic.
        UnlockFeedback.play()
        UIAccessibility.post(notification: .screenChanged, argument: "\(headline.capitalized). \(title)")
        if still { badgeIn = true; return }
        confetti = true
        withAnimation(.spring(response: 0.5, dampingFraction: 0.5)) { badgeIn = true }
        if !calm {
            withAnimation(.linear(duration: 24).repeatForever(autoreverses: false)) { raysTurn = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { bob = true }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(.easeInOut(duration: 0.8)) { sweep = 1.4 }
        }
    }
}

/// §U hook: the achievement-unlock sound + success haptic in one place.
enum UnlockFeedback {
    static func play() {
        Feedback.unlock()
    }
}


/// BF2: the shareable badge card — the badge on a soft lilac stage, the name, the
/// purpose line and the wordmark.
private struct AchievementShareCard: View {
    let name: String
    let detail: String
    let badge: String

    var body: some View {
        VStack(spacing: 10) {
            Text("ACHIEVEMENT UNLOCKED!").font(Brand.fixedFont(18, .black)).tracking(1)
                .foregroundStyle(Color(hex: 0xB45309))
            Image(badge).resizable().interpolation(.high).scaledToFit().frame(width: 150, height: 150)
            Text(name).font(Brand.fixedFont(26, .black)).foregroundStyle(Color(hex: 0x3B1A78))
                .multilineTextAlignment(.center)
            if !detail.isEmpty {
                Text(detail).font(Brand.fixedFont(15, .bold)).foregroundStyle(Color(hex: 0x5A4A72))
                    .multilineTextAlignment(.center)
            }
            Text("wordocious.com").font(Brand.fixedFont(13, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                .padding(.top, 4)
        }
        .padding(28)
        .frame(width: 360)
        .background(LinearGradient(colors: [Color(hex: 0xF3E8FF), Color(hex: 0xFFF1E0)], startPoint: .top, endPoint: .bottom))
    }
}
