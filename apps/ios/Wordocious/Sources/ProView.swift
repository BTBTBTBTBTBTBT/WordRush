import SwiftUI
import StoreKit
import WordociousCore

/// Pro / subscription screen — matches app/pro/page.tsx (header, benefits,
/// monthly/yearly plans, day pass, active-Pro state). Real StoreKit 2 purchases
/// via StoreManager; prices come live from the App Store (App Store Connect /
/// the local .storekit config). Per Apple rules we never link to web checkout.
struct ProView: View {
    @ObservedObject var auth = AuthService.shared
    @ObservedObject var store = StoreManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var showAuth = false
    /// BJ11: Manage subscription (active members) shows the hand-off before Apple's sheet.
    @State private var showManage = false
    @State private var info: ProPlanInfo = .fromProfile(AuthService.shared.profile)

    private let gold = Color(hex: 0xD97706)
    /// FINISH_SPEC §G1: the gold card family (tint, line, top bar).
    private static let goldTint = Color(hex: 0xF5A524)
    private static let goldBar = [Color(hex: 0xF5A524), Color(hex: 0xFFD166)]
    private static let ink = Color(hex: 0x8A4A12)

    /// Fallback prices (PRO_PLANS in lib/payment/types.ts) shown only if the
    /// App Store products haven't loaded yet.
    private let monthlyPrice = "6.99", yearlyPrice = "59.99", dayPrice = "1"

    private func displayPrice(_ plan: StoreManager.Plan, fallback: String) -> String {
        store.product(for: plan)?.displayPrice ?? "$\(fallback)"
    }
    private func isPurchasing(_ plan: StoreManager.Plan) -> Bool { store.purchasingId == plan.rawValue }
    private func buy(_ plan: StoreManager.Plan) { Task { await store.purchase(plan) } }

    /// §G1: each benefit row wears a 3D icon (a game icon where one fits).
    private enum BenefitIcon { case icon(Icon3DName), game(String) }
    private struct Benefit { let icon: BenefitIcon; let text: String }
    private let benefits: [Benefit] = [
        .init(icon: .icon(.lock), text: "Ad-free experience — no interruptions, ever"),
        .init(icon: .game("game-practice"), text: "Unlimited replays of every game mode, any time"),
        .init(icon: .game("game-vs"), text: "VS mode on every game — challenge friends in every mode"),
        .init(icon: .icon(.trophy), text: "Battle all ten of the cast — Rip to Webster, any time"),
        .init(icon: .icon(.addFriend), text: "Invite friends to private matches by link or username"),
        .init(icon: .icon(.shield), text: "4 streak shields credited each billing period"),
        .init(icon: .icon(.crown), text: "Pro badge on profile & leaderboards"),
        .init(icon: .icon(.tabStats), text: "Extended stats — win rate trends & avg speed per mode"),
        .init(icon: .icon(.flame), text: "Early access to new game modes"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                PageBackground(tint: .home)
                ScrollView {
                    VStack(spacing: 0) {
                        header
                        if !auth.isAuthenticated { guestPrompt }
                        else if auth.isProActive { activePro } else { plansContent }
                    }
                    .padding(.horizontal, 14).padding(.bottom, 24)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HeaderCircleButton(.icon(.back), size: 44, label: "Close") { dismiss() }
                }
            }
            .alert("Purchase issue", isPresented: Binding(get: { store.lastError != nil }, set: { if !$0 { store.lastError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(store.lastError ?? "")
            }
            .softSheet(isPresented: $showAuth) { AuthView() }
            .proManageHandoff($showManage)
        }
        // FINISH_SPEC §AP: LET'S PLAY on Welcome to Pro takes the player back to where
        // they were — the Pro page closes itself behind it.
        .onReceive(ProWelcomeCenter.shared.$finishToken.dropFirst()) { _ in
            if auth.isProActive { dismiss() }
        }
    }

    // Pro is account-based — a guest must sign in before subscribing so the
    // purchase can be tied to an account (appAccountToken → entitlement).
    private var guestPrompt: some View {
        VStack(spacing: 14) {
            Text("Sign in to go Pro")
                .font(Brand.font(18, .black)).foregroundStyle(FinishInk.heading)
            Text("Create a free account or sign in first — Pro unlocks unlimited replays, VS on every mode, and more, tied to your account.")
                .font(Brand.font(13, .medium)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
            Button { showAuth = true } label: { CandyLabel(title: "Sign in", symbol: "person.fill") }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
        }
        .padding(20)
        .tintedCard(accent: Self.goldTint, bar: Self.goldBar, tint: 0.10, line: 0.30)
        .padding(.top, 8)
    }

    /// §G1 + BJ11: the GO PRO lettering as the page headline (web / Android parity),
    /// then the crowned W (`art-scene-pro-crown`) large under it.
    private var header: some View {
        VStack(spacing: 6) {
            PageHeadline(.gopro)
            if ArtAsset.exists("art-scene-pro-crown") {
                Image("art-scene-pro-crown").resizable().interpolation(.high).scaledToFit()
                    .frame(maxWidth: 300, maxHeight: 170)
                    .accessibilityHidden(true)
            }
            Text("Play unlimited & ad-free — every mode, any time")
                .font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary).multilineTextAlignment(.center)
        }
        .padding(.top, 4).padding(.bottom, 18)
    }

    /// BJ11: the member state — the plan and its renewal, Manage subscription (the
    /// branded hand-off, then Apple's sheet) and Restore Purchases, all in one card.
    private var activePro: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Icon3D(.crown, size: 26)
                Text("ACTIVE PRO").font(Brand.font(15, .black)).tracking(1.2).foregroundStyle(Self.ink)
            }
            Text("You're enjoying all Pro benefits!").font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
            Text(info.dateLine.map { "\(info.plan) · \($0)" } ?? info.plan)
                .font(Brand.font(13, .heavy)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.center)
            Button { showManage = true } label: { CandyLabel(title: "Manage subscription", symbol: "creditcard.fill") }
                .buttonStyle(CandyButtonStyle(variant: .amber, size: .large))
                .padding(.top, 4)
            Text(SubscriptionCopy.handoff(.apple).line)
                .font(Brand.font(11, .heavy)).foregroundStyle(Self.ink.opacity(0.8))
            Button { Task { await store.restore() } } label: {
                CandyLabel(title: "Restore Purchases", symbol: "arrow.clockwise")
            }
            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
        }
        .padding(20).frame(maxWidth: .infinity)
        .tintedCard(accent: Self.goldTint, bar: Self.goldBar, tint: 0.12, line: 0.32)
        .task(id: auth.profile?.id) { info = await ProPlanInfo.load(profile: auth.profile) }
    }

    /// BJ11: a former member — W waves them back, with the day their Pro ended.
    @ViewBuilder private var lapsedCard: some View {
        if let line = SubscriptionCopy.lapsedLine(expiresAt: auth.profile?.proExpiryDate, proActive: auth.isProActive) {
            HStack(spacing: 12) {
                PoseImage(.w, "wave", height: 64)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Welcome back").font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                    Text(line).font(Brand.font(12, .heavy)).foregroundStyle(Self.ink)
                    Text(SubscriptionCopy.lapsedBody).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .tintedCard(accent: Self.goldTint, bar: Self.goldBar, tint: 0.12, line: 0.30)
            .accessibilityElement(children: .combine)
        }
    }

    private var plansContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            lapsedCard
            FinishLabel("Benefits", color: Self.ink)
            VStack(spacing: 0) {
                ForEach(0..<benefits.count, id: \.self) { i in benefitRow(benefits[i]).stripedRow(i, accent: Self.goldTint) }
            }
            .padding(.bottom, 4)
            .tintedCard(accent: Self.goldTint, bar: Self.goldBar, tint: 0.08, line: 0.26)

            FinishLabel("Choose your plan", color: Self.ink).padding(.top, 8)
            planCard(title: "Monthly", price: displayPrice(.monthly, fallback: monthlyPrice), unit: "/mo", note: "Cancel anytime",
                     accent: Color(hex: 0x7C3AED), variant: .purple, best: false,
                     loading: isPurchasing(.monthly), action: { buy(.monthly) }, cta: "Subscribe Monthly")
            planCard(title: "Yearly", price: displayPrice(.yearly, fallback: yearlyPrice), unit: "/yr", note: "$5/mo billed annually",
                     accent: Self.goldTint, variant: .amber, best: true,
                     loading: isPurchasing(.yearly), action: { buy(.yearly) }, cta: "Subscribe Yearly")

            HStack(spacing: 10) {
                Rectangle().fill(Self.goldTint.opacity(0.3)).frame(height: 1)
                Text("OR TRY IT FIRST").font(Brand.font(10, .heavy)).tracking(0.5).foregroundStyle(FinishInk.secondary)
                Rectangle().fill(Self.goldTint.opacity(0.3)).frame(height: 1)
            }.padding(.top, 6)
            Button { buy(.day) } label: {
                HStack(spacing: 8) {
                    if isPurchasing(.day) { ProgressView().tint(.white) }
                    CandyLabel(title: "Just today — \(displayPrice(.day, fallback: dayPrice)) for 24 hours", symbol: "bolt.fill")
                }
            }
            .buttonStyle(CandyButtonStyle(variant: .teal, size: .medium))
            .disabled(store.purchasingId != nil)
            Text("Eight day passes cost more than a month of Pro.")
                .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                .frame(maxWidth: .infinity).multilineTextAlignment(.center)

            // Restore + required subscription disclosure (App Store Review Guideline 3.1.2).
            Button { Task { await store.restore() } } label: {
                CandyLabel(title: "Restore Purchases", symbol: "arrow.clockwise")
            }
            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
            .frame(maxWidth: .infinity)
            .padding(.top, 4)

            subscriptionDisclosure.padding(.top, 2)
        }
    }

    private var subscriptionDisclosure: some View {
        VStack(spacing: 6) {
            // BJ11: the live App Store prices (localized), not the US fallback.
            Text(SubscriptionCopy.appleDisclosure(monthly: displayPrice(.monthly, fallback: monthlyPrice),
                                                  yearly: displayPrice(.yearly, fallback: yearlyPrice)))
                .font(Brand.font(10, .regular)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 6) {
                Link("Terms of Service", destination: URL(string: "https://wordocious.com/terms")!)
                Text("·").foregroundStyle(FinishInk.secondary)
                Link("Privacy Policy", destination: URL(string: "https://wordocious.com/privacy")!)
            }
            .font(Brand.font(10, .bold)).tint(Theme.isDark ? Color(hex: 0xC4B5FD) : Color(hex: 0x6D28D9))
        }
    }

    private func benefitRow(_ b: Benefit) -> some View {
        HStack(spacing: 12) {
            Group {
                switch b.icon {
                case .icon(let i): Icon3D(i, size: 26)
                case .game(let g):
                    if ArtAsset.exists(g) { GameArtImage(asset: g, size: 28) } else { Icon3D(.crown, size: 26) }
                }
            }
            .frame(width: 30)
            Text(b.text).font(Brand.font(13, .bold)).foregroundStyle(FinishInk.heading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// §G1: a plan as a tinted card; the best-value plan wears the stronger tint + a
    /// 2-pt gold ring, and its CTA is the large amber candy.
    private func planCard(title: String, price: String, unit: String, note: String,
                          accent: Color, variant: CandyButtonStyle.Variant, best: Bool, loading: Bool,
                          action: @escaping () -> Void, cta: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased()).font(Brand.font(12, .black)).tracking(1.2).foregroundStyle(FinishInk.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(price).softNumber(30)
                Text(unit).font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Text(note).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary).padding(.bottom, 8)
            Button(action: action) {
                HStack(spacing: 8) {
                    if loading { ProgressView().tint(.white) }
                    CandyLabel(title: loading ? "Processing…" : cta, symbol: loading ? nil : "crown.fill")
                }
            }
            .buttonStyle(CandyButtonStyle(variant: variant, size: .large))
            .disabled(store.purchasingId != nil)
        }
        .padding(16)
        .tintedCard(accent: accent, bar: best ? Self.goldBar : [accent, accent.wash(0.55)],
                    tint: best ? 0.16 : 0.08, line: best ? 0.40 : 0.26)
        // BI25: the best-value card glows gold instead of an outline.
        .shadow(color: Color(hex: 0xF5C542).opacity(best ? 0.55 : 0), radius: 10, x: 0, y: 4)
        .overlay(alignment: .topTrailing) {
            if best {
                Text("BEST VALUE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Self.ink)
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .tintedPill(Self.goldTint)
                    .padding(.trailing, 14).padding(.top, 18)
            }
        }
    }
}
