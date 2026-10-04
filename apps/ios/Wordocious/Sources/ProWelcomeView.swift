import SwiftUI
import UIKit
import WordociousCore

// FINISH_SPEC §AP (founder 10-02: "a thanks for joining pro and a rundown of the
// benefits they have now … a custom screen when someone joins the pro version for
// the first time"): the full-screen Welcome to Pro.
//
// Shown ONCE per account on this device (UserDefaults `pro-welcomed-<user id>`):
//   - right after a StoreKit purchase made in THIS session by a player who wasn't
//     Pro when they tapped buy (StoreManager reports the purchase), or
//   - a fresh activation without a StoreKit purchase — the profile flips to Pro for
//     a player who had never been Pro (no is_pro, no pro_expires_at): a gifted week
//     redeemed on the web (headline "YOUR FREE WEEK OF PRO!"), or a brand-new account
//     (≤ 8 days old) whose first look already carries a ~7-day gifted window.
// Restores, launch entitlement syncs, renewals and Transaction.updates deliveries run
// "quiet" (StoreManager brackets them) and never trigger it.
//
// Games and sheets are covers, so it draws in its own overlay window above every
// presentation, exactly like AchievementUnlockPopup. LET'S PLAY closes it, the Pro
// page (if open) closes itself, and the crown then drops onto W in the living cast
// header (§AA1, CastCrown). An Unlimited card that opened the paywall (§R3) defers
// its post-purchase game start until the welcome closes (`afterWelcome`).

@MainActor
final class ProWelcomeCenter: ObservableObject {
    static let shared = ProWelcomeCenter()

    enum Kind: Equatable { case purchase, gift }

    struct Presentation: Equatable {
        let kind: Kind
        let name: String
        /// The player's streak shields before Pro landed — the chip shows only when
        /// the live count rises above it (the ASSN webhook credits the +4).
        let shieldBaseline: Int?
    }

    @Published private(set) var current: Presentation?
    /// Bumped when LET'S PLAY closes the welcome — an open Pro page dismisses itself.
    @Published private(set) var finishToken = 0
    /// §AA1: the header crown stays hidden while the welcome is up …
    @Published private(set) var crownHeld = false
    /// … and drops onto W (with a sparkle) when this bumps.
    @Published private(set) var crownDropToken = 0

    private var attached = false
    private var pending: Presentation?
    private var window: UIWindow?
    private var hideWork: DispatchWorkItem?

    /// A purchase is between "buy" and its fulfillment.
    private var purchaseInFlight = false
    /// The profile when the player tapped buy.
    private var purchaseBefore: Profile?
    private var purchaseWasPro = false
    /// The purchase succeeded and a welcome is expected once it's fulfilled.
    private var armed = false
    /// Restores / entitlement syncs / Transaction.updates in progress.
    private var quietDepth = 0
    /// Actions waiting for the welcome to close (the §R3 Unlimited start).
    private var deferred: [() -> Void] = []

    private init() {}

    // MARK: Flag

    private static func flagKey(_ uid: String) -> String { "pro-welcomed-\(uid)" }
    private static func welcomed(_ uid: String) -> Bool { UserDefaults.standard.bool(forKey: flagKey(uid)) }
    private static func markWelcomed(_ uid: String) { UserDefaults.standard.set(true, forKey: flagKey(uid)) }

    // MARK: Root host

    func attach() {
        guard !attached else { return }
        attached = true
        if let p = pending { pending = nil; show(p) }
    }

    // MARK: StoreManager hooks

    /// The player tapped a plan: remember who they were before.
    func purchaseWillStart() {
        purchaseInFlight = true
        purchaseBefore = AuthService.shared.profile
        purchaseWasPro = AuthService.shared.isProActive
    }

    /// StoreKit returned `.success` (before fulfillment): arm the welcome so an
    /// Unlimited card waiting on the purchase defers its game start.
    func purchaseSucceeded() {
        guard let uid = purchaseBefore?.id ?? AuthService.shared.profile?.id else { return }
        armed = !purchaseWasPro && !Self.welcomed(uid) && current == nil
    }

    /// Fulfillment finished: welcome them if Pro is now active.
    func purchaseHandled() {
        guard armed else { return }
        armed = false
        let auth = AuthService.shared
        if auth.isProActive, let p = auth.profile, !Self.welcomed(p.id) {
            present(Presentation(kind: .purchase, name: p.username, shieldBaseline: purchaseBefore?.streakShields))
        } else {
            flushDeferred()
        }
    }

    /// The purchase call returned (any outcome).
    func purchaseEnded() {
        purchaseInFlight = false
        purchaseBefore = nil
        if armed { armed = false; flushDeferred() }
    }

    /// Restores, launch syncs and Transaction.updates never welcome anyone.
    func beginQuiet() { quietDepth += 1 }
    func endQuiet() { quietDepth = max(0, quietDepth - 1) }

    // MARK: AuthService hook (profile didSet)

    /// A fresh activation without a StoreKit purchase (a gifted week).
    func profileChanged(from old: Profile?, to new: Profile?) {
        guard let new, Wordocious.isProActive(new) else { return }
        guard !purchaseInFlight, !armed, quietDepth == 0, current == nil, pending == nil else { return }
        guard !Self.welcomed(new.id) else { return }
        if let old, old.id == new.id {
            // The flip to Pro, for a player who had NEVER been Pro (a lapsed or
            // renewing subscriber always carries a pro_expires_at).
            guard !Wordocious.isProActive(old), !old.isPro, old.proExpiresAt == nil else { return }
            present(Presentation(kind: Self.giftWindow(new) ? .gift : .purchase,
                                 name: new.username, shieldBaseline: old.streakShields))
        } else {
            // First look at this account this session with Pro in the shape of a gifted
            // week (redeemed on the web / another device): the SERVER marker decides —
            // GET /api/pro/gift (the caller's redeemed referral), welcomed only inside the
            // gift week. (Was a guess from the account's age, which missed older accounts.)
            guard Self.giftWindow(new) else { return }
            let uid = new.id, name = new.username
            Task { @MainActor in
                guard await Self.serverGiftDue() else { return }
                guard AuthService.shared.profile?.id == uid, !Self.welcomed(uid),
                      self.current == nil, self.pending == nil, !self.purchaseInFlight, !self.armed else { return }
                self.present(Presentation(kind: .gift, name: name, shieldBaseline: nil))
            }
        }
    }

    /// The gifted week's server marker: the caller's referral redeemed within the gift week
    /// (web lib/pro-welcome giftWelcomeDue: 8 days). False on any failure (a nicety, never a block).
    private static func serverGiftDue() async -> Bool {
        guard let token = try? await AuthService.shared.client.auth.session.accessToken,
              let url = URL(string: "https://wordocious.com/api/pro/gift") else { return false }
        var req = URLRequest(url: url, timeoutInterval: 10)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let gift = json["gift"] as? [String: Any],
              let at = (gift["redeemedAt"] as? String).flatMap(parseTimestamp) else { return false }
        let age = Date().timeIntervalSince(at)
        return age > -60 && age < 8 * 86_400
    }

    /// Pro that ends 1.5–7.2 days from now: the shape of a gifted week.
    private static func giftWindow(_ p: Profile) -> Bool {
        guard let exp = p.proExpiryDate else { return false }
        let left = exp.timeIntervalSinceNow
        return left > 1.5 * 86_400 && left <= 7.2 * 86_400
    }

    // MARK: Deferred actions

    /// Run `action` once the welcome is closed (now, if none is showing or expected).
    func afterWelcome(_ action: @escaping () -> Void) {
        if current != nil || armed || pending != nil { deferred.append(action) } else { action() }
    }

    private func flushDeferred() {
        let d = deferred
        deferred = []
        d.forEach { $0() }
    }

    // MARK: Presenting

    private func present(_ p: Presentation) {
        if let uid = AuthService.shared.profile?.id { Self.markWelcomed(uid) }
        crownHeld = true
        guard attached else { pending = p; return }
        show(p)
    }

    private func show(_ p: Presentation) {
        // Let the cold-start intro finish first (it covers the screen on launch).
        if CastHandoff.shared.introRunning {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.show(p) }
            return
        }
        current = p
        showWindow()
    }

    /// LET'S PLAY: close, let the Pro page close, then drop the crown onto W.
    func letsPlay() {
        current = nil
        scheduleHide()
        finishToken += 1
        let hadDeferred = !deferred.isEmpty
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in self?.flushDeferred() }
        DispatchQueue.main.asyncAfter(deadline: .now() + (hadDeferred ? 0.35 : 0.6)) { [weak self] in
            guard let self else { return }
            self.crownHeld = false
            self.crownDropToken += 1
        }
    }

    private func showWindow() {
        hideWork?.cancel(); hideWork = nil
        if let window { window.isHidden = false; return }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else { return }
        let w = UIWindow(windowScene: scene)
        w.windowLevel = .alert
        w.backgroundColor = .clear
        let host = UIHostingController(rootView: ProWelcomeLayer())
        host.view.backgroundColor = .clear
        w.rootViewController = host
        w.overrideUserInterfaceStyle = ThemeManager.shared.colorScheme == .dark ? .dark : .light
        w.isHidden = false
        window = w
    }

    private func scheduleHide() {
        hideWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.current == nil else { return }
            self.window?.isHidden = true
            self.window = nil
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: work)
    }
}

/// Mounted once at the app root (WordociousApp): arms the welcome center. Draws nothing.
struct ProWelcomeHost: View {
    var body: some View {
        Color.clear.frame(width: 0, height: 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear { ProWelcomeCenter.shared.attach() }
    }
}

/// The overlay window's content.
private struct ProWelcomeLayer: View {
    @ObservedObject private var center = ProWelcomeCenter.shared
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        let still = envReduce || Theme.reduceMotion
        ZStack {
            if let p = center.current {
                ProWelcomeView(presentation: p) { center.letsPlay() }
                    .transition(still ? .opacity : .opacity.combined(with: .scale(scale: 1.04)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(still ? .easeInOut(duration: 0.2) : .easeOut(duration: 0.3), value: center.current)
        .preferredColorScheme(ThemeManager.shared.colorScheme)
    }
}

// MARK: - The screen

struct ProWelcomeView: View {
    let presentation: ProWelcomeCenter.Presentation
    let onPlay: () -> Void

    @ObservedObject private var auth = AuthService.shared
    @ObservedObject private var power = PowerMode.shared
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var crownIn = false
    @State private var raysTurn = false
    @State private var confetti = false
    @State private var cardsIn = 0
    @State private var showGift = false

    private var still: Bool { envReduce || Theme.reduceMotion }
    /// §AD / §AP: calm = static rays (Reduce Motion or Low Power Mode).
    private var calm: Bool { Motion.calm(envReduce) }

    private static let gold = Color(hex: 0xF5A524)
    private static let goldBar = [Color(hex: 0xF5A524), Color(hex: 0xFFD166)]

    private var headline: String {
        presentation.kind == .gift ? "YOUR FREE WEEK OF PRO!" : "WELCOME TO PRO!"
    }

    private var thanks: String {
        let name = presentation.name.isEmpty ? "friend" : presentation.name
        return presentation.kind == .gift
            ? "Enjoy your free week, \(name)! Here's everything you just unlocked."
            : "Thanks for joining, \(name)! Here's everything you just unlocked."
    }

    /// Shields credited since Pro landed (the live count over the baseline).
    private var shieldsCredited: Int {
        guard let base = presentation.shieldBaseline, let now = auth.profile?.streakShields else { return 0 }
        return max(0, now - base)
    }

    fileprivate struct Benefit: Identifiable {
        let id: Int
        let asset: String
        let fallback: Icon3DName
        let title: String
        let line: String
        let accent: Color
    }

    private static let benefits: [Benefit] = [
        .init(id: 0, asset: "art-scene-unlimited-loop", fallback: .flame, title: "Play unlimited",
              line: "Fresh puzzles in every game, no waiting", accent: Color(hex: 0xFB923C)),
        .init(id: 1, asset: "icon3d-badge-check", fallback: .badgeCheck, title: "No ads, ever",
              line: "Nothing between you and the next puzzle", accent: Color(hex: 0x14B8A6)),
        .init(id: 2, asset: "game-vs", fallback: .trophy, title: "VS everything",
              line: "Race friends in every game mode", accent: Color(hex: 0xEC4899)),
        .init(id: 3, asset: "art-scene-ladder-cleared", fallback: .trophy, title: "Battle the cast",
              line: "All ten of the cast, Rip to Webster", accent: Color(hex: 0x7C3AED)),
        .init(id: 4, asset: "art-scene-shield-guard", fallback: .shield, title: "4 shields a cycle",
              line: "Streak shields every billing period", accent: Color(hex: 0x3B82F6)),
        .init(id: 5, asset: "art-scene-gift-pro", fallback: .crown, title: "Gift Pro",
              line: "Send friends a free week of Pro", accent: Color(hex: 0xF5A524)),
        .init(id: 6, asset: "art-badge-level-pro", fallback: .crown, title: "The Pro look",
              line: "A crown on W, gold frames, Pro hats", accent: Color(hex: 0xD97706)),
        .init(id: 7, asset: "art-badge-trending-up", fallback: .tabStats, title: "Deeper stats",
              line: "Win-rate trends and speed by game", accent: Color(hex: 0x2563EB)),
    ]

    var body: some View {
        ZStack {
            backdrop.ignoresSafeArea()
            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    crownStage
                    // BJ16: WELCOME TO PRO! / FREE WEEK OF PRO! lettering, not outlined text.
                    HeadingArtView(presentation.kind == .gift ? .freeweek : .welcomepro, height: 52, maxWidth: 340,
                                   label: headline.capitalized)
                        .padding(.horizontal, 8)
                    Text(thanks)
                        .font(Brand.font(15, .bold)).foregroundStyle(FinishInk.heading)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 12)
                    if shieldsCredited > 0 { shieldChip.transition(.scale.combined(with: .opacity)) }
                    grid
                    VStack(spacing: 10) {
                        Button(action: onPlay) { CandyLabel(title: "LET'S PLAY!", symbol: "play.fill") }
                            .buttonStyle(CastButtonStyle(color: .gold, size: .large))
                        Button { showGift = true } label: { CandyLabel(title: "Gift a friend a free week", symbol: "gift.fill") }
                            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                    }
                    .padding(.top, 4)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8).padding(.bottom, 28)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            if confetti && !still { ConfettiView().ignoresSafeArea().allowsHitTesting(false) }
        }
        .animation(still ? nil : .spring(response: 0.4, dampingFraction: 0.7), value: shieldsCredited)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .softSheet(isPresented: $showGift) { ProWelcomeGiftSheet() }
        .onAppear(perform: start)
        .task {
            // The ASSN webhook credits the +4 shields a beat after the purchase:
            // re-read the profile a couple of times so the chip can appear.
            guard presentation.shieldBaseline != nil, presentation.kind == .purchase else { return }
            for delay in [2.5, 5.0] {
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                if Task.isCancelled || shieldsCredited > 0 { return }
                await auth.refreshProfile()
            }
        }
    }

    // MARK: Pieces

    /// Full-screen gold wash (dark: the surface with a warm gold tint).
    private var backdrop: some View {
        ZStack {
            if Theme.isDark {
                Theme.surface
                LinearGradient(colors: [Self.gold.opacity(0.26), Self.gold.opacity(0.08)], startPoint: .top, endPoint: .bottom)
            } else {
                LinearGradient(colors: [Self.gold.mixed(over: Color(hex: 0xFFF8F1), 0.22),
                                        Self.gold.mixed(over: Color(hex: 0xFFF8F1), 0.06)],
                               startPoint: .top, endPoint: .bottom)
            }
        }
    }

    /// The crowned W springs in on a stage: glow, gold sunburst rays (turning slowly
    /// unless calm), a ground shadow.
    private var crownStage: some View {
        ZStack {
            RadialGradient(colors: [Color(hex: 0xFFD166).opacity(0.55), Color(hex: 0xFFD166).opacity(0)],
                           center: .center, startRadius: 10, endRadius: 150)
                .frame(width: 320, height: 240)
            BadgeRays(color: Self.gold.opacity(Theme.isDark ? 0.22 : 0.20))
                .frame(width: 340, height: 340)
                .mask(RadialGradient(colors: [.black, .clear], center: .center, startRadius: 20, endRadius: 170))
                .drawingGroup()   // §AZ: rasterized, then only rotated
                .rotationEffect(.degrees(raysTurn ? 360 : 0))
            Ellipse().fill(RadialGradient(colors: [Color(hex: 0x7A3D00).opacity(0.2), Color(hex: 0x7A3D00).opacity(0)],
                                          center: .center, startRadius: 0, endRadius: 70))
                .frame(width: 140, height: 20)   // §AZ: no live blur
                .offset(y: 84)
            Group {
                if ArtAsset.exists("art-scene-pro-crown") {
                    Image("art-scene-pro-crown").resizable().interpolation(.high).scaledToFit()
                } else {
                    ProCrownSprite(size: 120)
                }
            }
            .frame(maxWidth: 260, maxHeight: 190)
            .shadow(color: Self.gold.opacity(0.45), radius: 18, x: 0, y: 8)
            .scaleEffect(crownIn ? 1 : 0.3)
            .opacity(crownIn ? 1 : 0)
        }
        .frame(height: 210)
        .clipped()
        .accessibilityHidden(true)
    }

    private var shieldChip: some View {
        HStack(spacing: 8) {
            Group {
                if ArtAsset.exists("art-scene-shield-guard") {
                    Image("art-scene-shield-guard").resizable().interpolation(.high).scaledToFit()
                } else {
                    Icon3D(.shield, size: 24)
                }
            }
            .frame(width: 30, height: 30)
            .accessibilityHidden(true)
            Text(shieldsCredited == 1 ? "Your streak shield is ready" : "Your \(shieldsCredited) streak shields are ready")
                .font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
        }
        .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 6)
        .tintedPill(Color(hex: 0x3B82F6))
        .accessibilityElement(children: .combine)
    }

    private var grid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(Self.benefits) { b in
                card(b)
                    .scaleEffect(cardsIn > b.id ? 1 : 0.6)
                    .opacity(cardsIn > b.id ? 1 : 0)
            }
        }
    }

    private func card(_ b: Benefit) -> some View {
        VStack(spacing: 6) {
            Group {
                if ArtAsset.exists(b.asset) {
                    Image(b.asset).resizable().interpolation(.high).scaledToFit()
                } else {
                    Icon3D(b.fallback, size: 40)
                }
            }
            .frame(height: 54)
            .accessibilityHidden(true)
            Text(b.title)
                .font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                .lineLimit(1).minimumScaleFactor(0.75)
            Text(b.line)
                .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 10).padding(.top, 14).padding(.bottom, 10)
        .frame(maxWidth: .infinity, minHeight: 140, alignment: .top)
        .tintedCard(accent: b.accent, bar: [b.accent, b.accent.wash(0.55)], radius: 18, barHeight: 6, tint: 0.10, line: 0.28)
        .accessibilityElement(children: .combine)
    }

    // MARK: Motion

    private func start() {
        // §U: the `celebrate` sound + a success haptic.
        Feedback.celebrate()
        UIAccessibility.post(notification: .screenChanged, argument: "\(headline.capitalized) \(thanks)")
        if still {
            crownIn = true
            cardsIn = Self.benefits.count
            return
        }
        confetti = true   // one burst (ConfettiView halves its pieces when calm)
        withAnimation(.spring(response: 0.55, dampingFraction: 0.55)) { crownIn = true }
        if !calm {
            withAnimation(.linear(duration: 40).repeatForever(autoreverses: false)) { raysTurn = true }
        }
        // The cards pop in 70 ms apart once the crown lands.
        for i in 0..<Self.benefits.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35 + Double(i) * 0.07) {
                withAnimation(.spring(response: 0.38, dampingFraction: 0.6)) { cardsIn = max(cardsIn, i + 1) }
            }
        }
    }
}

/// "Gift a friend a free week" → the §T4 gift flow (the invite panel's gift card).
private struct ProWelcomeGiftSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                PageBackground(tint: .friends)
                ScrollView {
                    InvitePanelView()
                        .padding(.horizontal, 16).padding(.vertical, 12)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HeaderCircleButton(.icon(.back), size: 44, label: "Close") { dismiss() }
                }
            }
        }
    }
}
