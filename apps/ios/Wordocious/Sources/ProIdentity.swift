import SwiftUI
import StoreKit
import WordociousCore

// FINISH_SPEC §AA (founder 10-02: "there is no Pro identifier anymore, we need to
// cleverly get that inputted back somewhere nicely"): the crowned W in the living
// cast header (AA1), the gold ring + crown on Pro avatars (AA2) and the WORDOCIOUS
// PRO member card at the top of Settings (AA3). The shared pieces live here.

// MARK: - The crown sprite

/// The small gold crown (`art-badge-pro-crown-sprite`, 256²), falling back to the
/// 3D crown icon when the sprite doesn't ship. Decorative.
struct ProCrownSprite: View {
    var size: CGFloat

    var body: some View {
        Group {
            if ArtAsset.exists("art-badge-pro-crown-sprite") {
                Image("art-badge-pro-crown-sprite").resizable().interpolation(.high).scaledToFit()
                    .frame(width: size, height: size)
            } else {
                Icon3D(.crown, size: size)
            }
        }
        .accessibilityHidden(true)
    }
}

/// §AA1: W's crown in the living cast header — tilted ~-8°, a tiny sparkle twinkle
/// every ~8 s (none with Reduce Motion), and the ONLY tappable thing in the row:
/// it opens the "You're Pro" sheet. It rides inside W's transforms, so it moves
/// with W's hop, personality move and the landing flourish.
struct CastCrown: View {
    var size: CGFloat
    var still: Bool
    var onTap: () -> Void

    @State private var twinkle = false
    /// FINISH_SPEC §AP: held hidden under Welcome to Pro, then dropped onto W.
    @ObservedObject private var welcome = ProWelcomeCenter.shared
    @State private var dropY: CGFloat = 0
    @State private var dropBurst = false
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        Button(action: onTap) {
            ProCrownSprite(size: size)
                .rotationEffect(.degrees(-8))
                .offset(y: dropY)
                .overlay {
                    // §AP: the landing sparkle (one burst of four).
                    ZStack {
                        ForEach(0..<4, id: \.self) { i in
                            Image(systemName: "sparkle")
                                .font(.system(size: size * 0.32, weight: .black))
                                .foregroundStyle(LinearGradient(colors: [.white, Color(hex: 0xFFE08A)], startPoint: .top, endPoint: .bottom))
                                .shadow(color: Color(hex: 0xF5A524).opacity(0.8), radius: 2)
                                .offset(x: dropBurst ? CGFloat([-1, 1, -1, 1][i]) * size * 0.6 : 0,
                                        y: dropBurst ? CGFloat([-1, -1, 1, 1][i]) * size * 0.45 : 0)
                                .scaleEffect(dropBurst ? 1 : 0.2)
                                .opacity(dropBurst ? 1 : 0)
                        }
                    }
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
                .overlay(alignment: .topTrailing) {
                    Image(systemName: "sparkle")
                        .font(.system(size: size * 0.42, weight: .black))
                        .foregroundStyle(LinearGradient(colors: [.white, Color(hex: 0xFFE08A)], startPoint: .top, endPoint: .bottom))
                        .shadow(color: Color(hex: 0xF5A524).opacity(0.8), radius: 2)
                        .scaleEffect(twinkle ? 1 : 0.01)
                        .rotationEffect(.degrees(twinkle ? 45 : 0))
                        .opacity(twinkle ? 1 : 0)
                        .offset(x: size * 0.12, y: -size * 0.12)
                        .accessibilityHidden(true)
                }
                // A comfortable tap area around the small crown.
                .padding(10)
                .contentShape(Rectangle())
        }
        .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23
        .padding(-10)
        .opacity(welcome.crownHeld ? 0 : 1)
        .onChange(of: welcome.crownDropToken) { _ in drop() }
        .accessibilityLabel("You're Pro")
        .accessibilityHint("Shows your Pro membership")
        .task {
            guard !still else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 8_000_000_000)
                if Task.isCancelled || Theme.reduceMotion { continue }
                withAnimation(.easeOut(duration: 0.3)) { twinkle = true }
                try? await Task.sleep(nanoseconds: 450_000_000)
                withAnimation(.easeIn(duration: 0.35)) { twinkle = false }
            }
        }
    }

    /// §AP: the crown falls onto W's head with a bounce, then a sparkle burst.
    /// Reduce Motion (`still`): it simply appears.
    private func drop() {
        guard !envReduce, !Theme.reduceMotion else { return }   // Low Power keeps one-shot springs (§AD)
        var t = SwiftUI.Transaction(); t.disablesAnimations = true
        withTransaction(t) { dropY = -size * 3.2; dropBurst = false }
        DispatchQueue.main.async {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.5)) { dropY = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) {
                Feedback.hop(volume: 0.6)
                withAnimation(.easeOut(duration: 0.35)) { dropBurst = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
                    withAnimation(.easeIn(duration: 0.3)) { dropBurst = false }
                }
            }
        }
    }
}

// MARK: - Membership facts

/// What the Pro sheet / member card says about the membership: the plan and its
/// renewal (or end) date. Read-only — from StoreKit's current entitlements when an
/// App Store subscription is active, else the profile's Pro window (referral /
/// comp / Day Pass time).
struct ProPlanInfo: Equatable {
    var plan: String
    var dateLine: String?

    static func formatted(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d, yyyy"
        return f.string(from: d)
    }

    /// The fallback from the profile alone (no StoreKit lookup).
    static func fromProfile(_ p: Profile?) -> ProPlanInfo {
        if let d = p?.proExpiryDate { return ProPlanInfo(plan: "Wordocious Pro", dateLine: "Pro until \(formatted(d))") }
        return ProPlanInfo(plan: "Wordocious Pro", dateLine: nil)
    }

    @MainActor
    static func load(profile: Profile?) async -> ProPlanInfo {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, t.revocationDate == nil,
                  let plan = StoreManager.Plan(rawValue: t.productID), plan != .day else { continue }
            if let exp = t.expirationDate, exp < Date() { continue }
            let name = plan == .yearly ? "Yearly plan" : "Monthly plan"
            var renews = true
            if let statuses = try? await StoreManager.shared.product(for: plan)?.subscription?.status {
                for s in statuses {
                    if case .verified(let r) = s.renewalInfo, r.currentProductID == t.productID || r.originalTransactionID == t.originalID {
                        renews = r.willAutoRenew
                    }
                }
            }
            guard let exp = t.expirationDate else { return ProPlanInfo(plan: name, dateLine: nil) }
            return ProPlanInfo(plan: name, dateLine: renews ? "Renews \(formatted(exp))" : "Pro until \(formatted(exp))")
        }
        return fromProfile(profile)
    }
}

/// "Member since <month year>" from the profile's created_at.
enum ProMemberSince {
    static func text(_ p: Profile?) -> String? {
        guard let c = p?.createdAt, let d = parseTimestamp(c) else { return nil }
        let f = DateFormatter(); f.dateFormat = "MMMM yyyy"; f.locale = Locale(identifier: "en_US")
        return "Member since \(f.string(from: d))"
    }
}

/// Apple's manage-subscriptions sheet (the same path as Settings' Manage
/// Subscription row), with the App Store URL as the fallback. BJ11: never opened
/// cold — every entry point shows `ProManageHandoffSheet` first.
enum ProManage {
    /// Shows Apple's sheet and returns once the player closes it.
    @MainActor
    static func show() async {
        if let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
            try? await AppStore.showManageSubscriptions(in: scene)
        } else if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
            await UIApplication.shared.open(url)
        }
    }
}

// MARK: - BJ11 The subscription hand-off

/// FINISH_SPEC BJ11 (founder 10-03: "When I clicked check subscription somewhere the
/// Apple menu popped up"): before Apple's own subscription sheet opens, a short sheet in
/// our look says what is about to open — W points the way, one line, why it's Apple's
/// page, the candy CTA, and Restore Purchases (Guideline 3.1.1 keeps it visible). It
/// stays under Apple's sheet and closes itself when the player comes back.
struct ProManageHandoffSheet: View {
    @ObservedObject private var store = StoreManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var opening = false
    @State private var restoring = false
    private let copy = SubscriptionCopy.handoff(.apple)

    var body: some View {
        ZStack {
            PageBackground(tint: .home)
            VStack(spacing: 10) {
                Capsule().fill(ProGold.accent.opacity(0.35)).frame(width: 40, height: 5).padding(.top, 8)
                PoseImage(.w, "point", height: 96)
                Text(copy.line)
                    .font(Brand.font(19, .black)).foregroundStyle(FinishInk.number)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text(copy.body)
                    .font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 6)
                Button {
                    opening = true
                    Task {
                        await ProManage.show()
                        opening = false
                        dismiss()
                    }
                } label: { CandyLabel(title: copy.cta, symbol: "arrow.up.right") }
                    .buttonStyle(CastButtonStyle(color: .gold, size: .large))
                    .disabled(opening)
                    .padding(.top, 4)
                Button {
                    restoring = true
                    Task { await store.restore(); restoring = false }
                } label: { CandyLabel(title: restoring ? "Restoring…" : "Restore Purchases", symbol: "arrow.clockwise") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                    .disabled(restoring)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 22)
        }
        .presentationDetents([.medium])
        .alert("Restore issue", isPresented: Binding(get: { store.lastError != nil }, set: { if !$0 { store.lastError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(store.lastError ?? "") }
    }
}

extension View {
    /// BJ11: present the subscription hand-off (instead of opening Apple's sheet cold).
    func proManageHandoff(_ isPresented: Binding<Bool>) -> some View {
        sheet(isPresented: isPresented) { ProManageHandoffSheet() }
    }
}

private enum ProGold {
    static let accent = Color(hex: 0xF5A524)
    static let bar = [Color(hex: 0xF5A524), Color(hex: 0xFFD166)]
    static let ink = Color(hex: 0x8A4A12)
    static var inkAdaptive: Color { Theme.isDark ? Color(hex: 0xFFD166) : ink }
}

// MARK: - §AA1 The "You're Pro" sheet

struct ProMemberSheet: View {
    @ObservedObject private var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var info: ProPlanInfo = .fromProfile(AuthService.shared.profile)
    @State private var showManage = false

    var body: some View {
        ZStack {
            PageBackground(tint: .home)
            VStack(spacing: 14) {
                Capsule().fill(ProGold.accent.opacity(0.35)).frame(width: 40, height: 5).padding(.top, 8)
                ProCrownSprite(size: 74)
                    .rotationEffect(.degrees(-8))
                    .shadow(color: ProGold.accent.opacity(0.45), radius: 10, x: 0, y: 4)
                HeadingArtView(.yourepro, height: 44)   // BJ16
                VStack(spacing: 4) {
                    Text(info.plan).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                    if let line = info.dateLine {
                        Text(line).font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    if let since = ProMemberSince.text(auth.profile) {
                        Text(since).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14).padding(.horizontal, 16)
                .tintedCard(accent: ProGold.accent, bar: ProGold.bar, radius: 20, barHeight: 8, tint: 0.12, line: 0.32)

                Button { showManage = true } label: { CandyLabel(title: "Manage subscription", symbol: "creditcard.fill") }
                    .buttonStyle(CastButtonStyle(color: .gold, size: .large))
                Button { dismiss() } label: { CandyLabel(title: "Close") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
        }
        .presentationDetents([.medium])
        .proManageHandoff($showManage)
        .task { info = await ProPlanInfo.load(profile: auth.profile) }
    }
}

// MARK: - §AA3 The member card at the top of Settings

/// Pro: a gold-tinted WORDOCIOUS PRO card (the Pro level badge, Member since, the
/// plan and a candy Manage subscription). Free: the same slot as the G1 upsell
/// ("Go Pro" with the pro-crown art) opening the Pro page.
struct SettingsProCard: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var info: ProPlanInfo?
    @State private var showPro = false
    @State private var showManage = false

    var body: some View {
        Group {
            if auth.isProActive { member } else { upsell }
        }
        .softSheet(isPresented: $showPro) { ProView() }
    }

    private var member: some View {
        let plan = info ?? .fromProfile(auth.profile)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Group {
                    if ArtAsset.exists("art-badge-level-pro") {
                        Image("art-badge-level-pro").resizable().interpolation(.high).scaledToFit()
                    } else {
                        ProCrownSprite(size: 56)
                    }
                }
                .frame(width: 62, height: 62)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("WORDOCIOUS PRO")
                        .font(Brand.font(17, .black)).tracking(1.2)
                        .foregroundStyle(ProGold.inkAdaptive)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
                    if let since = ProMemberSince.text(auth.profile) {
                        Text(since).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    Text(plan.dateLine.map { "\(plan.plan) · \($0)" } ?? plan.plan)
                        .font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.heading)
                        .lineLimit(2).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
            }
            Button { showManage = true } label: { CandyLabel(title: "Manage subscription", symbol: "creditcard.fill") }
                .buttonStyle(CastButtonStyle(color: .gold, size: .medium))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedCard(accent: ProGold.accent, bar: ProGold.bar, radius: 20, barHeight: 8, tint: 0.14, line: 0.34)
        .task(id: auth.profile?.id) { info = await ProPlanInfo.load(profile: auth.profile) }
        .proManageHandoff($showManage)
    }

    private var upsell: some View {
        VStack(spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("GO PRO")
                        .font(Brand.font(22, .black))
                        .foregroundStyle(FinishInk.number)
                        .accessibilityAddTraits(.isHeader)
                    // BJ11: a former member's upsell names the day their Pro ended.
                    Text(SubscriptionCopy.lapsedLine(expiresAt: auth.profile?.proExpiryDate, proActive: auth.isProActive)
                            .map { "\($0). Switch it back on any time." }
                         ?? "Unlimited games, VS on every mode, no ads and 4 streak shields every month.")
                        .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if ArtAsset.exists("art-scene-pro-crown") {
                    Image("art-scene-pro-crown").resizable().interpolation(.high).scaledToFit()
                        .frame(width: 96, height: 96)
                        .accessibilityHidden(true)
                } else {
                    ProCrownSprite(size: 64)
                }
            }
            Button { showPro = true } label: { CandyLabel(title: "Go Pro") }
                .buttonStyle(CastButtonStyle(color: .gold, size: .medium))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedCard(accent: ProGold.accent, bar: ProGold.bar, radius: 20, barHeight: 8, tint: 0.12, line: 0.32)
    }
}

// MARK: - §AA2 Pro avatars

extension View {
    /// §AA2: a Pro player's avatar — a thin gold ring following the avatar's outline
    /// (circle for a photo, rounded square for a letter tile) and the tiny crown
    /// sprite on the top-right corner (≈35% of the avatar). No-op when `pro` is false.
    @ViewBuilder
    func proAvatarMark(_ pro: Bool, size: CGFloat, tile: Bool) -> some View {
        if pro {
            self
                .overlay(
                    AvatarOutline(tile: tile)
                        .strokeBorder(LinearGradient(colors: [Color(hex: 0xFFE08A), Color(hex: 0xF5A524), Color(hex: 0xD97706)],
                                                     startPoint: .topLeading, endPoint: .bottomTrailing),
                                      lineWidth: max(1.5, size * 0.045))
                        .allowsHitTesting(false)
                )
                .overlay(alignment: .topTrailing) {
                    ProCrownSprite(size: size * 0.35)
                        .rotationEffect(.degrees(14))
                        .offset(x: size * 0.10, y: -size * 0.13)
                        .allowsHitTesting(false)
                }
        } else {
            self
        }
    }
}
