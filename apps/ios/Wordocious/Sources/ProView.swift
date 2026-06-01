import SwiftUI
import StoreKit

/// Pro / subscription screen — matches app/pro/page.tsx (header, benefits,
/// monthly/yearly plans, day pass, active-Pro state). Real StoreKit 2 purchases
/// via StoreManager; prices come live from the App Store (App Store Connect /
/// the local .storekit config). Per Apple rules we never link to web checkout.
struct ProView: View {
    @ObservedObject var auth = AuthService.shared
    @ObservedObject var store = StoreManager.shared
    @Environment(\.dismiss) private var dismiss

    private let gold = Color(hex: 0xD97706)

    /// Fallback prices (PRO_PLANS in lib/payment/types.ts) shown only if the
    /// App Store products haven't loaded yet.
    private let monthlyPrice = "6.99", yearlyPrice = "59.99", dayPrice = "1"

    private func displayPrice(_ plan: StoreManager.Plan, fallback: String) -> String {
        store.product(for: plan)?.displayPrice ?? "$\(fallback)"
    }
    private func isPurchasing(_ plan: StoreManager.Plan) -> Bool { store.purchasingId == plan.rawValue }
    private func buy(_ plan: StoreManager.Plan) { Task { await store.purchase(plan) } }

    private struct Benefit { let symbol: String; let asset: String?; let text: String }
    private let benefits: [Benefit] = [
        .init(symbol: "eye.slash.fill", asset: nil, text: "Ad-free experience — no interruptions, ever"),
        .init(symbol: "square.grid.3x3.fill", asset: "wordle-grid", text: "Unlimited replays of all 8 game modes, any time"),
        .init(symbol: "", asset: "swords", text: "VS mode on every game — challenge friends in all 8 modes"),
        .init(symbol: "envelope.fill", asset: nil, text: "Invite friends to private matches by link or username"),
        .init(symbol: "", asset: "shield", text: "4 streak shields credited each billing period"),
        .init(symbol: "sparkles", asset: nil, text: "Pro badge on profile & leaderboards"),
        .init(symbol: "chart.bar.fill", asset: nil, text: "Extended stats — win rate trends & avg speed per mode"),
        .init(symbol: "bolt.fill", asset: nil, text: "Early access to new game modes"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 0) {
                        header
                        if auth.isProActive { activePro } else { plansContent }
                    }
                    .padding(.horizontal, 14).padding(.bottom, 24)
                }
            }
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close") { dismiss() } } }
            .alert("Purchase issue", isPresented: Binding(get: { store.lastError != nil }, set: { if !$0 { store.lastError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(store.lastError ?? "")
            }
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            Image(systemName: "crown.fill").font(.system(size: 54)).foregroundStyle(gold)
            Text("Go Pro").font(Brand.title(36)).foregroundStyle(Theme.textPrimary)
            Text("Play unlimited & ad-free — all 8 modes, any time")
                .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
        }
        .padding(.top, 12).padding(.bottom, 24)
    }

    private var activePro: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "crown.fill").font(.system(size: 14)).foregroundStyle(.white)
                Text("ACTIVE PRO").font(Brand.caption(13)).foregroundStyle(.white)
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF59E0B), gold], startPoint: .topLeading, endPoint: .bottomTrailing)))
            Text("You're enjoying all Pro benefits!").font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(28).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))
    }

    private var plansContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("BENEFITS")
            ForEach(0..<benefits.count, id: \.self) { i in benefitRow(benefits[i]) }

            sectionHeader("CHOOSE YOUR PLAN").padding(.top, 8)
            planCard(title: "Monthly", price: displayPrice(.monthly, fallback: monthlyPrice), unit: "/mo", note: "Cancel anytime",
                     gradient: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], best: false,
                     loading: isPurchasing(.monthly), action: { buy(.monthly) }, cta: "Subscribe Monthly")
            planCard(title: "Yearly", price: displayPrice(.yearly, fallback: yearlyPrice), unit: "/yr", note: "$4.99/mo billed annually",
                     gradient: [Color(hex: 0xF59E0B), gold], best: true,
                     loading: isPurchasing(.yearly), action: { buy(.yearly) }, cta: "Subscribe Yearly")

            HStack(spacing: 10) {
                Rectangle().fill(Theme.border).frame(height: 1)
                Text("OR TRY IT FIRST").font(Brand.font(10, .heavy)).tracking(0.5).foregroundStyle(Theme.textMuted)
                Rectangle().fill(Theme.border).frame(height: 1)
            }.padding(.top, 6)
            Button { buy(.day) } label: {
                HStack(spacing: 6) {
                    if isPurchasing(.day) { ProgressView().tint(Theme.primary) }
                    Text("Just today — \(displayPrice(.day, fallback: dayPrice)) for 24 hours of Pro →")
                        .font(Brand.font(14, .black)).foregroundStyle(Theme.primary)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            }.disabled(store.purchasingId != nil)
            Text("Eight day passes cost more than a month of Pro.")
                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity).multilineTextAlignment(.center)

            // Restore + required subscription disclosure (App Store Review Guideline 3.1.2).
            Button { Task { await store.restore() } } label: {
                Text("Restore Purchases").font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
            }.padding(.top, 4)

            subscriptionDisclosure.padding(.top, 2)
        }
    }

    private var subscriptionDisclosure: some View {
        VStack(spacing: 6) {
            Text("Monthly ($\(monthlyPrice)) and Yearly ($\(yearlyPrice)) are auto-renewing subscriptions. Payment is charged to your Apple Account at confirmation. Subscriptions renew automatically unless cancelled at least 24 hours before the period ends; manage or cancel in Settings → Apple Account. The Day Pass is a one-time 24-hour purchase and does not renew.")
                .font(Brand.font(10, .regular)).foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 6) {
                Link("Terms of Service", destination: URL(string: "https://wordocious.com/terms")!)
                Text("·").foregroundStyle(Theme.textMuted)
                Link("Privacy Policy", destination: URL(string: "https://wordocious.com/privacy")!)
            }
            .font(Brand.font(10, .bold)).tint(Theme.primary)
        }
    }

    private func sectionHeader(_ t: String) -> some View {
        Text(t).font(Brand.font(11, .heavy)).tracking(1.1).foregroundStyle(Theme.textMuted)
    }

    private func benefitRow(_ b: Benefit) -> some View {
        HStack(spacing: 12) {
            Group {
                if let asset = b.asset {
                    Image(asset).renderingMode(.template).resizable().scaledToFit().frame(width: 20, height: 20)
                } else {
                    Image(systemName: b.symbol).font(.system(size: 20))
                }
            }.foregroundStyle(gold).frame(width: 24)
            Text(b.text).font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func planCard(title: String, price: String, unit: String, note: String,
                          gradient: [Color], best: Bool, loading: Bool, action: @escaping () -> Void, cta: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
            (Text(price).font(Brand.font(30, .black)) + Text(unit).font(Brand.font(14, .bold)).foregroundColor(Theme.textMuted))
                .foregroundStyle(Theme.textPrimary)
            Text(note).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).padding(.bottom, 8)
            Button(action: action) {
                HStack(spacing: 8) {
                    if loading { ProgressView().tint(.white) }
                    Text(loading ? "Processing…" : cta).font(Brand.font(14, .black)).foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)))
            }
            .disabled(store.purchasingId != nil)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(best ? Color(hex: 0xFDE68A) : Theme.border, lineWidth: 1.5))
        .overlay(alignment: .topTrailing) {
            if best {
                Text("BEST VALUE").font(Brand.font(10, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 2)
                    .background(Capsule().fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
                    .padding(.trailing, 16).offset(y: -10)   // float over the top border (web: -top-2.5 right-4)
            }
        }
    }
}