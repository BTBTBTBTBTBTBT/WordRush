import SwiftUI
import UIKit
import WordociousCore

// FINISH_SPEC §AO (supersedes §W): the first-run welcome + guided profile setup.
// After the cold-start intro lands, a brand-new player sees: 1 WELCOME (the cast),
// 2 the four-card QUICK TOUR, 3 sign up (the existing AuthView) + a USERNAME with a
// live availability check, 4 MAKE YOUR MASCOT (the §AN builder in onboarding mode
// with W's coach marks + a spotlight), 5 ALL SET (their mascot hops in next to W,
// confetti) → "Play today's Classic" / "Explore first". Guests skip 3–4. Shown once
// (flag `onboarded-v2`); existing players (v1 flag, any game data locally or on the
// profile) get the flag silently. How to Play's "Take the tour" replays steps 1–2.
// `whoosh` between steps; Reduce Motion: crossfades.

enum Onboarding {
    /// UserDefaults: true once the first-run flow has been seen, skipped or ruled out.
    static let flagKey = "onboarded-v2"
    /// The §W tour's flag: anyone who has it is an existing player.
    static let legacyFlagKey = "onboarded-v1"

    /// The profile says this player has played (games, medals, XP, a streak).
    static func hasPlayed(_ p: Profile) -> Bool {
        p.totalWins + p.totalLosses > 0 || p.xp > 0 || p.level > 1
            || p.currentStreak > 0 || p.bestStreak > 0
            || p.dailyLoginStreak > 0 || p.bestDailyLoginStreak > 0
            || p.goldMedals + p.silverMedals + p.bronzeMedals > 0
            || p.lastPlayedAt != nil
    }

    /// Any game data on this device (saved boards, today's completions, unlimited
    /// runs, elapsed timers, a cached streak).
    @MainActor
    static func hasLocalPlay() -> Bool {
        if DailyCompletionsStore.cachedTodayCount() > 0 { return true }
        if (AuthService.cachedStreak ?? 0) > 0 { return true }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        if let files = try? FileManager.default.contentsOfDirectory(atPath: base.appendingPathComponent("games").path),
           !files.isEmpty { return true }
        let prefixes = ["wordocious-elapsed-", "wordocious-hints-", "unlimited-current-", "pn-save-", "daily-completions-cache"]
        return UserDefaults.standard.dictionaryRepresentation().keys.contains { k in prefixes.contains { k.hasPrefix($0) } }
    }

    /// Open today's Classic daily from the tab root (the same notification the
    /// post-game Next Daily CTA uses). Any presented sheet/cover (How to Play's
    /// replay) is dismissed first so the root can present the game.
    @MainActor
    static func playClassic() {
        let post = { NotificationCenter.default.post(name: NextDailyCTA.playNextDaily, object: "DUEL") }
        let root = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows.first(where: \.isKeyWindow) }
            .first?.rootViewController
        if let root, root.presentedViewController != nil {
            root.dismiss(animated: true) { DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: post) }
        } else {
            post()
        }
    }
}

/// Decides when the first-run flow shows: after the intro, once auth has settled,
/// only for brand-new players (fresh installs show it over the sign-in gate).
/// Lives in the cold-start overlay (above the app and the auth gate).
struct OnboardingHost: View {
    /// The cold-start intro has landed (or never ran).
    let introDone: Bool

    @ObservedObject private var auth = AuthService.shared
    @AppStorage(Onboarding.flagKey) private var onboarded = false
    @AppStorage(Onboarding.legacyFlagKey) private var legacyOnboarded = false
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var showing = false

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    /// Everything the decision depends on.
    private var stateKey: String {
        let p = auth.profile
        return "\(introDone)|\(auth.isLoading)|\(auth.isAuthenticated)|\(auth.isGuest)|\(p?.id ?? "-")"
    }

    var body: some View {
        ZStack {
            if showing {
                OnboardingFlow { play in finish(play: play) }
                    .transition(.opacity)
            }
        }
        .onAppear { evaluate() }
        .onChange(of: stateKey) { _ in evaluate() }
    }

    private func evaluate() {
        guard !onboarded, !showing, introDone, !auth.isLoading else { return }
        // Existing players never see it: set the flag silently.
        if legacyOnboarded { onboarded = true; return }
        if auth.isAuthenticated {
            guard let p = auth.profile else { return }
            if Onboarding.hasPlayed(p) { onboarded = true; return }
        }
        if Onboarding.hasLocalPlay() { onboarded = true; return }
        withAnimation(still ? .easeInOut(duration: 0.2) : .easeOut(duration: 0.3)) { showing = true }
    }

    private func finish(play: Bool) {
        onboarded = true
        withAnimation(still ? .easeInOut(duration: 0.2) : .easeOut(duration: 0.25)) { showing = false }
        if play {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { Onboarding.playClassic() }
        }
    }
}

/// How to Play / Guides "Take the tour": steps 1–2 (welcome + the four cards).
/// `onFinish(true)` = "Play today's Classic", `false` = Close.
struct OnboardingView: View {
    var replay: Bool = false
    var onFinish: (Bool) -> Void

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var welcomed = false
    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    var body: some View {
        ZStack {
            PageBackground(tint: .home).ignoresSafeArea()
            if welcomed {
                OnboardingTour(skipTitle: "Close", lastTitle: "Play today's Classic", onSkip: { onFinish(false) },
                               onDone: { onFinish(true) })
                    .transition(still ? .opacity : .move(edge: .trailing).combined(with: .opacity))
            } else {
                OnboardingWelcome(showSignIn: false, onGo: {
                    Feedback.whoosh()
                    withAnimation(still ? .easeInOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.9)) { welcomed = true }
                }, onSignIn: {})
                .overlay(alignment: .topTrailing) {
                    Button { onFinish(false) } label: { CandyLabel(title: "Close") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                        .padding(.horizontal, 16).padding(.top, 8)
                }
                .transition(.opacity)
            }
        }
    }
}

// MARK: - The flow

/// Steps 1–5. `onFinish(true)` = "Play today's Classic".
struct OnboardingFlow: View {
    var onFinish: (Bool) -> Void

    enum Step: Equatable { case welcome, tour, signUp, signIn, username, mascot, allSet }

    @ObservedObject private var auth = AuthService.shared
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var step: Step = .welcome
    @State private var savedMascot: AvatarConfig?
    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    private var authKey: String {
        "\(auth.isAuthenticated)|\(auth.isGuest)|\(auth.profile?.id ?? "-")|\(auth.profile?.hasOnboarded ?? false)"
    }

    var body: some View {
        ZStack {
            PageBackground(tint: .home).ignoresSafeArea()
            Group {
                switch step {
                case .welcome:
                    OnboardingWelcome(showSignIn: !auth.isAuthenticated, onGo: { go(.tour) }, onSignIn: { go(.signIn) })
                case .tour:
                    OnboardingTour(skipTitle: "Skip", lastTitle: "Next", onSkip: { afterTour() }, onDone: { afterTour() })
                case .signUp, .signIn:
                    AuthView(showsCloseButton: false, initialMode: step == .signUp ? .signup : .signin)
                        .overlay(alignment: .topTrailing) { skipButton { onFinish(false) } }
                case .username:
                    OnboardingUsername(onDone: { go(.mascot) })
                        .overlay(alignment: .topTrailing) { skipButton { skipUsername() } }
                case .mascot:
                    OnboardingMascotStep(onSaved: { c in savedMascot = c; go(.allSet) }, onLater: { go(.allSet) })
                case .allSet:
                    OnboardingAllSet(config: savedMascot, onPlay: { onFinish(true) }, onExplore: { onFinish(false) })
                }
            }
            .id(step)
            .transition(still ? .opacity : .asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                                      removal: .move(edge: .leading).combined(with: .opacity)))
        }
        .onChange(of: authKey) { _ in authChanged() }
    }

    private func skipButton(_ action: @escaping () -> Void) -> some View {
        Button(action: action) { CandyLabel(title: "Skip") }
            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
            .padding(.horizontal, 16).padding(.top, 8)
    }

    private func go(_ s: Step) {
        guard s != step else { return }
        Feedback.whoosh()
        withAnimation(still ? .easeInOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.9)) { step = s }
    }

    /// After the tour: guests skip 3–4; signed-in players go to username / mascot.
    private func afterTour() {
        if auth.isAuthenticated, let p = auth.profile { go(p.hasOnboarded ? .mascot : .username) }
        else if auth.isGuest { go(.allSet) }
        else { go(.signUp) }
    }

    private func authChanged() {
        switch step {
        case .signIn:
            // "I already have an account": straight to Home once signed in (or as a guest).
            if auth.isAuthenticated || auth.isGuest { onFinish(false) }
        case .signUp:
            if auth.isGuest { go(.allSet) }
            else if auth.isAuthenticated, let p = auth.profile {
                if Onboarding.hasPlayed(p) { onFinish(false) } else { go(p.hasOnboarded ? .mascot : .username) }
            }
        default:
            break
        }
    }

    private func skipUsername() {
        guard let uid = auth.profile?.id else { go(.mascot); return }
        struct SkipUpdate: Encodable { let has_onboarded: Bool }
        Task {
            _ = try? await auth.client.from("profiles").update(SkipUpdate(has_onboarded: true)).eq("id", value: uid).execute()
            await auth.refreshProfile()
        }
        go(.mascot)
    }
}

/// The cast row stand-in until `art-scene-welcome-cast` / `art-scene-all-set` land.
private struct OnboardingCastRow: View {
    var size: CGFloat = 34
    var body: some View {
        HStack(spacing: -4) {
            ForEach(Mascots.cast) { m in
                Image(m.assetName).resizable().interpolation(.high).scaledToFit().frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Step 1: WELCOME TO WORDOCIOUS!
struct OnboardingWelcome: View {
    var showSignIn: Bool
    var onGo: () -> Void
    var onSignIn: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 8)
            Group {
                if ArtAsset.exists("art-scene-welcome-cast") {
                    Image("art-scene-welcome-cast").resizable().interpolation(.high).scaledToFit()
                        .frame(maxHeight: 260).accessibilityHidden(true)
                } else {
                    OnboardingCastRow(size: 34)
                }
            }
            // BJ16 quick win: the WELCOME! lettering (label keeps the full line).
            ArtTitle(.welcome, maxWidth: 260, label: "Welcome to Wordocious!")
                .frame(maxHeight: 72)
            Text("Daily word games, a cast of friends, and bragging rights.")
                .font(Brand.font(16, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button(action: onGo) { CandyLabel(title: "Let's go!", symbol: "arrow.right") }
                .buttonStyle(CastButtonStyle(size: .large))
            if showSignIn {
                Button(action: onSignIn) {
                    // BJ15 round 2: a secondary text link in the brand ink (no underline, the family TextLinkLabel).
                    TextLinkLabel(title: "I already have an account").frame(minHeight: 44)
                }
                .buttonStyle(.squish)
            }
        }
        .padding(.horizontal, 28).padding(.bottom, 24)
    }
}

/// Step 2: the four tour cards with page dots.
struct OnboardingTour: View {
    var skipTitle: String
    var lastTitle: String
    var onSkip: () -> Void
    var onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var page = 0
    private static let count = 4
    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }
    private var last: Bool { page == Self.count - 1 }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button(action: onSkip) { CandyLabel(title: skipTitle) }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
            }
            .padding(.horizontal, 16).padding(.top, 8)
            pager.frame(maxHeight: .infinity)
            dots.padding(.bottom, 16)
            Button {
                if last { onDone() } else { go(page + 1) }
            } label: {
                if last { CandyLabel(title: lastTitle, symbol: lastTitle == "Next" ? "arrow.right" : "play.fill") }
                else { CandyLabel(title: "Next", symbol: "arrow.right") }
            }
            .buttonStyle(CastButtonStyle(size: .large))
            .padding(.horizontal, 24).padding(.bottom, 20)
        }
        .onChange(of: page) { _ in Feedback.whoosh() }
    }

    private func go(_ p: Int) {
        let target = min(Self.count - 1, max(0, p))
        guard target != page else { return }
        withAnimation(still ? .easeInOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.9)) { page = target }
    }

    @ViewBuilder private var pager: some View {
        if still {
            ZStack {
                OnboardingCard(index: page, active: true, still: true).id(page).transition(.opacity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 24).onEnded { v in
                if v.translation.width < -50 { go(page + 1) } else if v.translation.width > 50 { go(page - 1) }
            })
        } else {
            TabView(selection: $page) {
                ForEach(0..<Self.count, id: \.self) { i in
                    OnboardingCard(index: i, active: page == i, still: false).tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }

    private var dots: some View {
        HStack(spacing: 8) {
            ForEach(0..<Self.count, id: \.self) { i in
                Capsule()
                    .fill(i == page ? FinishInk.purple : FinishInk.purple.opacity(0.25))
                    .frame(width: i == page ? 24 : 9, height: 9)
            }
        }
        .animation(Theme.animation(.spring(response: 0.35, dampingFraction: 0.8)), value: page)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(page + 1) of \(Self.count)")
    }
}

/// Step 3b: pick a username — live availability (green check / "taken" shake) + suggestion chips.
struct OnboardingUsername: View {
    var onDone: () -> Void

    enum Status: Equatable { case idle, checking, available, taken, invalid(String) }

    @ObservedObject private var auth = AuthService.shared
    @State private var name = ""
    @State private var status: Status = .idle
    @State private var shake: CGFloat = 0
    @State private var saving = false
    @State private var suggestions: [String] = []
    @State private var checkTask: Task<Void, Never>?

    private struct SaveUpdate: Encodable { let username: String; let has_onboarded: Bool }

    var body: some View {
        VStack(spacing: 16) {
            Spacer(minLength: 8)
            PoseImage(.w, "point", height: 120)
            HeadingArtView(.username, height: 48, maxWidth: 340)   // BJ16
            Text("It's how friends find you and how you show up on the leaderboards.")
                .font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                TextField("username", text: $name)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .font(Brand.font(17, .bold)).foregroundStyle(FinishInk.heading)
                statusIcon
            }
            .g5Field(G5Accent.purple, error: isBad)
            .offset(x: shake)
            .onChange(of: name) { _ in scheduleCheck() }
            statusLine
            if !suggestions.isEmpty {
                HStack(spacing: 8) {
                    ForEach(suggestions, id: \.self) { s in
                        Button { name = s } label: {
                            Text(s).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .g5Option(active: false, accent: G5Accent.purple, radius: 14)
                        }
                        .buttonStyle(.squish)
                        .accessibilityLabel("Use \(s)")
                    }
                }
            }
            Spacer(minLength: 8)
            Button(action: save) { CandyLabel(title: saving ? "Saving…" : "That's me!", symbol: "checkmark") }
                .buttonStyle(CastButtonStyle(size: .large))
                .disabled(saving || status != .available)
        }
        .padding(.horizontal, 28).padding(.bottom, 24)
        .onAppear {
            name = auth.profile?.username ?? ""
            scheduleCheck()
        }
    }

    private var isBad: Bool {
        if case .invalid = status { return true }
        return status == .taken
    }

    @ViewBuilder private var statusIcon: some View {
        switch status {
        case .checking: ProgressView().scaleEffect(0.8)
        case .available: Image(systemName: "checkmark.circle.fill").foregroundStyle(G5Accent.green).font(.system(size: 20, weight: .bold))
        case .taken, .invalid: Image(systemName: "xmark.circle.fill").foregroundStyle(G5Accent.coral).font(.system(size: 20, weight: .bold))
        case .idle: EmptyView()
        }
    }

    @ViewBuilder private var statusLine: some View {
        switch status {
        case .available: Text("Nice, it's yours!").font(Brand.font(12, .bold)).foregroundStyle(G5Accent.green)
        case .taken: Text("That one's taken. Try one of these:").font(Brand.font(12, .bold)).foregroundStyle(G5Accent.coral)
        case .invalid(let m): Text(m).font(Brand.font(12, .bold)).foregroundStyle(G5Accent.coral)
        default: Text("3-20 characters.").font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
        }
    }

    private func scheduleCheck() {
        checkTask?.cancel()
        let t = name.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { status = .idle; suggestions = []; return }
        if let err = Profanity.usernameError(t) { status = .invalid(err); suggestions = []; return }
        status = .checking
        checkTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            let free = await Self.isAvailable(t, ownId: auth.profile?.id)
            guard !Task.isCancelled, t == name.trimmingCharacters(in: .whitespaces) else { return }
            if free {
                status = .available; suggestions = []
            } else {
                status = .taken
                bump()
                suggestions = await Self.suggestions(for: t, ownId: auth.profile?.id)
            }
        }
    }

    private func bump() {
        Haptics.warning()
        guard !Theme.reduceMotion else { return }
        withAnimation(.easeInOut(duration: 0.05).repeatCount(5, autoreverses: true)) { shake = 8 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { withAnimation(.easeOut(duration: 0.05)) { shake = 0 } }
    }

    /// A case-insensitive lookup on profiles.username (yours counts as available).
    static func isAvailable(_ name: String, ownId: String?) async -> Bool {
        struct Row: Decodable { let id: String }
        let escaped = name.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%").replacingOccurrences(of: "_", with: "\\_")
        guard let rows: [Row] = try? await AuthService.shared.client.from("profiles")
            .select("id").ilike("username", pattern: escaped).limit(2).execute().value else { return true }
        return rows.allSatisfy { $0.id.lowercased() == ownId?.lowercased() }
    }

    /// Up to three free variations of a taken name.
    static func suggestions(for name: String, ownId: String?) async -> [String] {
        let base = String(name.prefix(16))
        var candidates = [base + "\(Int.random(in: 10...99))", base + "_" + ["wins", "plays", "fan", "pro"].randomElement()!,
                          base + "\(Int.random(in: 100...999))", "the_" + String(name.prefix(14))]
        candidates = candidates.filter { Profanity.usernameError($0) == nil }
        var out: [String] = []
        for c in candidates where out.count < 3 {
            if await isAvailable(c, ownId: ownId) { out.append(c) }
        }
        return out
    }

    private func save() {
        let t = name.trimmingCharacters(in: .whitespaces)
        guard let uid = auth.profile?.id, status == .available else { return }
        saving = true
        Task {
            do {
                try await auth.client.from("profiles").update(SaveUpdate(username: t, has_onboarded: true)).eq("id", value: uid).execute()
                await auth.refreshProfile()
                saving = false
                onDone()
            } catch {
                saving = false
                status = .taken
                bump()
            }
        }
    }
}

/// Step 4: the §AN builder in onboarding mode with W's coach marks + a spotlight.
struct OnboardingMascotStep: View {
    var onSaved: (AvatarConfig) -> Void
    var onLater: () -> Void

    @ObservedObject private var auth = AuthService.shared
    @State private var config: AvatarConfig = AvatarCatalog.defaultAvatar(userId: "")
    @State private var ready = false
    @State private var tip = 0
    @State private var saving = false

    private struct MascotUpdate: Encodable { let avatar_config: AvatarConfig }

    private static let tips: [(text: String, anchor: MascotBuilderAnchor)] = [
        ("This is you! Your initial is on your belly.", .preview),
        ("Change your body, colors, face and hats here.", .tab(.body)),
        ("Stuck? Let me pick!", .randomize),
        ("Love it? Save it!", .save),
    ]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 12) {
                    HeadingArtView(.mascot, height: 44, maxWidth: 340)   // BJ16: lettering, not plain text
                    if ready {
                        MascotBuilderView(initial: AvatarCatalog.initial(auth.profile?.username),
                                          config: config, mode: .onboarding,
                                          hasPhoto: false, level: auth.profile?.level ?? 1, isPro: auth.isProActive,
                                          saveTitle: "Save", saving: saving,
                                          onChange: { config = $0 },
                                          onSave: { save($0) }, onSkip: onLater)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 60)
            }
            .onChange(of: tip) { t in
                guard t < Self.tips.count else { return }
                let id = Self.tips[t].anchor.id
                if Theme.reduceMotion { proxy.scrollTo(id, anchor: .center) }
                else { withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(id, anchor: .center) } }
            }
        }
        .overlayPreferenceValue(MascotBuilderAnchorKey.self) { anchors in
            if ready, tip < Self.tips.count {
                GeometryReader { geo in
                    let t = Self.tips[tip]
                    let rect = anchors[t.anchor].map { geo[$0] }
                    coach(t.text, hole: rect, in: geo.size)
                }
            }
        }
        .onAppear {
            guard !ready, let p = auth.profile else { ready = true; return }
            config = MascotLooks.shared.ownConfig(p)
                ?? MascotLooks.display(saved: nil, castId: nil, frame: nil, username: p.username,
                                       accentHex: LetterTileAvatar.defaultAccentHex(username: p.username, accentHex: p.accentColor))
            ready = true
        }
    }

    /// The dim spotlight (everything but the pointed control) + W's speech-bubble card. Tap to advance.
    private func coach(_ text: String, hole: CGRect?, in size: CGSize) -> some View {
        let cut = hole?.insetBy(dx: -8, dy: -8)
        let below = (cut?.midY ?? 0) < size.height * 0.5
        return ZStack(alignment: below ? .bottom : .top) {
            Path { p in
                p.addRect(CGRect(origin: .zero, size: size))
                if let cut { p.addRoundedRect(in: cut, cornerSize: CGSize(width: 16, height: 16)) }
            }
            .fill(Color.black.opacity(0.5), style: FillStyle(eoFill: true))
            .ignoresSafeArea()
            if let cut {
                RoundedRectangle(cornerRadius: 16).strokeBorder(Color.white.opacity(0.9), lineWidth: 2)
                    .frame(width: cut.width, height: cut.height)
                    .position(x: cut.midX, y: cut.midY)
            }
            HStack(spacing: 10) {
                PoseImage(.w, "point", height: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text(text).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(tip < Self.tips.count - 1 ? "Tap to continue" : "Tap to start building")
                        .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .tintedCard(accent: G5Accent.purple, bar: G5Accent.bar(G5Accent.purple), radius: 20, barHeight: 8)
            .padding(.horizontal, 20).padding(.vertical, 28)
        }
        .frame(width: size.width, height: size.height)
        .contentShape(Rectangle())
        .onTapGesture {
            Feedback.whoosh()
            withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { tip += 1 }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
        .accessibilityHint("Double-tap to continue")
        .accessibilityAddTraits(.isButton)
    }

    private func save(_ c: AvatarConfig) {
        guard let p = auth.profile else { onSaved(c); return }
        var m = c
        m.display = "mascot"
        saving = true
        Task {
            var accepted = false
            do {
                try await auth.client.from("profiles").update(MascotUpdate(avatar_config: m)).eq("id", value: p.id).execute()
                accepted = true
            } catch { accepted = false }
            MascotLooks.shared.applyOwn(userId: p.id, username: p.username, config: m, serverAccepted: accepted)
            saving = false
            onSaved(m)
        }
    }
}

/// Step 5: ALL SET — the new mascot hops into the cast row next to W, confetti.
struct OnboardingAllSet: View {
    var config: AvatarConfig?
    var onPlay: () -> Void
    var onExplore: () -> Void

    @ObservedObject private var auth = AuthService.shared
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var landed = false
    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    private var mine: AvatarConfig {
        if let config { return config }
        let name = auth.profile?.username ?? "guest"
        return MascotLooks.display(saved: auth.profile.flatMap { MascotLooks.shared.ownConfig($0) }, castId: nil, frame: nil,
                                   username: auth.isGuest ? "guest" : name,
                                   accentHex: LetterTileAvatar.defaultAccentHex(username: name, accentHex: auth.profile?.accentColor))
    }

    var body: some View {
        ZStack {
            if !still { ConfettiView().allowsHitTesting(false).ignoresSafeArea() }
            VStack(spacing: 18) {
                Spacer(minLength: 8)
                ZStack(alignment: .bottom) {
                    if ArtAsset.exists("art-scene-all-set") {
                        Image("art-scene-all-set").resizable().interpolation(.high).scaledToFit()
                            .frame(maxHeight: 220).accessibilityHidden(true)
                    }
                    HStack(alignment: .bottom, spacing: 6) {
                        if !ArtAsset.exists("art-scene-all-set") { PoseImage(.w, "wave", height: 120) }
                        MascotAvatar(config: mine, initial: AvatarCatalog.initial(auth.isGuest ? "G" : auth.profile?.username),
                                     size: 96, cached: false)
                            .offset(y: landed ? 0 : -160)
                            .opacity(landed ? 1 : 0)
                    }
                }
                HeadingArtView(.yourein, height: 56)   // BJ16
                Text("Meet the gang. Your first puzzle is ready.")
                    .font(Brand.font(16, .bold)).foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center)
                Spacer(minLength: 8)
                Button(action: onPlay) { CandyLabel(title: "Play today's Classic", symbol: "play.fill") }
                    .buttonStyle(CastButtonStyle(size: .large))
                Button(action: onExplore) { CandyLabel(title: "Explore first") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium))
            }
            .padding(.horizontal, 28).padding(.bottom, 24)
        }
        .onAppear {
            Feedback.hop()
            Feedback.celebrate()
            if still { landed = true }
            else { withAnimation(.spring(response: 0.5, dampingFraction: 0.55).delay(0.15)) { landed = true } }
        }
    }
}

/// One card: the art springing in, the lettering headline, one friendly line and a
/// small visual (the real tile colors / medals / the streak).
struct OnboardingCard: View {
    let index: Int
    let active: Bool
    let still: Bool

    @State private var shown = false

    private var art: (asset: String, fallback: MascotID, pose: String) {
        switch index {
        case 0: return ("art-scene-onboard-tiles", .w, "point")
        case 1: return ("art-scene-onboard-score", .d, "cheer")
        case 2: return ("art-scene-shield-guard", .u, "lotus")
        default: return ("art-scene-friends-match", .i, "cheer")
        }
    }

    /// BJ16: the tour titles align to web / Android (DAILY GAMES, SCORE BIG, KEEP YOUR STREAK, PLAY TOGETHER).
    private var heading: HeadingArt { [HeadingArt.tourDaily, .tourScore, .tourStreak, .tourTogether][min(max(index, 0), 3)] }

    private var line: String {
        switch index {
        case 0: return "New puzzles every day. Guess the word, solve the board."
        case 1: return "Fewer guesses and faster times earn more points."
        case 2: return "Play daily to grow your streak. Shields save it."
        default: return "Race friends, react, and battle the cast."
        }
    }

    var body: some View {
        GeometryReader { geo in
            let artHeight = min(300, geo.size.height * 0.46)
            VStack(spacing: 14) {
                Spacer(minLength: 4)
                Group {
                    if ArtAsset.exists(art.asset) {
                        Image(art.asset).resizable().interpolation(.high).scaledToFit()
                            .frame(maxWidth: geo.size.width - 40, maxHeight: artHeight)
                            .accessibilityHidden(true)
                    } else {
                        PoseImage(art.fallback, art.pose, height: artHeight * 0.85)
                    }
                }
                .frame(height: artHeight)
                .scaleEffect(shown ? 1 : 0.6, anchor: .bottom)
                .opacity(shown ? 1 : 0)

                HeadingArtView(heading, height: 52, maxWidth: 340)   // BJ16: lettering, not plain text

                Text(line)
                    .font(Brand.font(16, .bold))
                    .foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                visual.padding(.top, 4)
                Spacer(minLength: 4)
            }
            .padding(.horizontal, 28)
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .onAppear { if active { springIn() } }
        .onChange(of: active) { a in if a { springIn() } }
    }

    private func springIn() {
        if still { shown = true; return }
        shown = false
        withAnimation(.spring(response: 0.5, dampingFraction: 0.6).delay(0.05)) { shown = true }
    }

    @ViewBuilder private var visual: some View {
        switch index {
        case 0:
            // The app's real tile semantics (purple right spot, gold wrong spot, slate
            // not in the word — the colorblind palette when that's on).
            HStack(alignment: .top, spacing: 18) {
                legend(.correct, "W", "Right spot")
                legend(.present, "O", "Wrong spot")
                legend(.absent, "R", "Not in word")
            }
        case 1:
            HStack(spacing: 14) {
                medal(1, "GOLD", Color(hex: 0xF5A524))
                medal(2, "SILVER", Color(hex: 0x8D99B0))
                medal(3, "BRONZE", Color(hex: 0xC2703D))
            }
        case 3:
            HStack(spacing: -6) {
                ForEach([MascotID.o2, .c, .s], id: \.self) { m in
                    Image(m.assetName).resizable().scaledToFit().frame(width: 44, height: 44)
                }
            }
            .accessibilityHidden(true)
        default:
            HStack(spacing: 10) {
                Icon3D(.flame, size: 34)
                Text("7").softNumber(30)
                Text("DAY STREAK").font(Brand.font(12, .black)).tracking(1.2).foregroundStyle(FinishInk.secondary)
                Icon3D(.shield, size: 34)
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .tintedPill(Color(hex: 0xF5A524))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("A 7-day streak, protected by a shield")
        }
    }

    private func legend(_ face: GlossyFace, _ letter: String, _ caption: String) -> some View {
        VStack(spacing: 6) {
            GlossyTile(face: face, letter: letter, width: 46)
            Text(caption).font(Brand.font(11, .black)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.center)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(letter): \(caption)")
    }

    private func medal(_ place: Int, _ label: String, _ accent: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(place)").softNumber(24)
                .frame(width: 50, height: 50)
                .tintedPill(accent, radius: 25)
            Text(label).font(Brand.font(10, .black)).tracking(1).foregroundStyle(FinishInk.secondary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label.capitalized) medal")
    }
}
