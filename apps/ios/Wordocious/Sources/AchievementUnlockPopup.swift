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
        case achievement(key: String, name: String, description: String, icon: String?)
        case levelUp(level: Int)

        var id: String {
            switch self {
            case .achievement(let key, _, _, _): return "a:\(key)"
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

    private init() {}

    func attach() {
        guard !attached else { return }
        attached = true
        if !pending.isEmpty { let p = pending; pending = []; add(p) }
    }

    /// Newly unlocked achievement keys (from checkAchievements). Waits a beat so the
    /// game's own win popup lands first, then queues one popup per key.
    func enqueue(keys: [String]) async {
        let fresh = keys.filter { !seen.contains("a:\($0)") }
        guard !fresh.isEmpty else { return }
        let catalog = AchievementCatalog.shared
        if fresh.contains(where: { k in !catalog.all.contains { $0.key == k } }) { await catalog.load() }
        let moments: [Moment] = fresh.map { key in
            if let d = catalog.all.first(where: { $0.key == key }) {
                return .achievement(key: key, name: d.name, description: d.description, icon: d.icon)
            }
            return .achievement(key: key, name: Self.prettify(key), description: "", icon: nil)
        }
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        add(moments)
    }

    /// §V3: a level-up that crossed into a new tier.
    func enqueueLevelUp(newLevel: Int) {
        add([.levelUp(level: newLevel)])
    }

    /// "Nice!" — on to the next queued moment (or close).
    func advance() {
        if !queue.isEmpty { queue.removeFirst() }
        if queue.isEmpty { scheduleHide() }
    }

    private func add(_ moments: [Moment]) {
        let fresh = moments.filter { !seen.contains($0.id) }
        guard !fresh.isEmpty else { return }
        guard attached else { pending.append(contentsOf: fresh); return }
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
        case .achievement(_, _, _, let icon): return BadgeArt.achievementAsset(icon)
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
        case .achievement(_, let name, _, _): return name
        case .levelUp(let level): return "Level \(level) · \(LevelTier.forLevel(level).label)"
        }
    }

    private var detail: String {
        switch moment {
        case .achievement(_, _, let description, _): return description
        case .levelUp(let level): return "You reached the \(LevelTier.forLevel(level).label) tier. Keep it rolling!"
        }
    }

    private var isLevel: Bool { if case .levelUp = moment { return true } else { return false } }

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
                            .rotationEffect(.degrees(raysTurn ? 360 : 0))
                            .mask(RadialGradient(colors: [.black, .clear], center: .center, startRadius: 14, endRadius: 115))
                    }
                    Ellipse().fill(Color(hex: 0x3C1E6E).opacity(0.18))
                        .frame(width: badgeSize * 0.62, height: badgeSize * 0.12)
                        .blur(radius: 4)
                        .offset(y: badgeSize * 0.52)
                    Image(badgeAsset)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: badgeSize, height: badgeSize)
                        .shadow(color: accent.opacity(0.45), radius: 16, x: 0, y: 6)
                        .scaleEffect(badgeIn ? 1 : 0.3)
                        .opacity(badgeIn ? 1 : 0)
                        .offset(y: bob && !calm ? -5 : 0)
                }
                .frame(height: isLevel ? 160 : 190)
                .accessibilityHidden(true)

                // "ACHIEVEMENT UNLOCKED" in lettering-style ink + one gloss sweep.
                let ink = OutlinedText(text: headline, size: isLevel ? 26 : 22, fill: Color(hex: 0xFFD166), width: 2)
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

                Button(action: onNice) { CandyLabel(title: "Nice!") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
                    .padding(.top, 4)
                if remaining > 0 {
                    Text("\(remaining) more to see").font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
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
