import SwiftUI

/// Pro / subscription screen — matches app/pro/page.tsx (header, benefits,
/// monthly/yearly plans, day pass, active-Pro state). Prices from PRO_PLANS.
/// Subscribe is a placeholder until StoreKit 2 is wired (Phase 2 IAP); per
/// Apple rules we never link to external/web checkout.
struct ProView: View {
    @ObservedObject var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var comingSoon = false

    private let gold = Color(hex: 0xD97706)

    // Mirrors PRO_PLANS in lib/payment/types.ts
    private let monthlyPrice = "6.99", yearlyPrice = "59.99", dayPrice = "1"

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
            .alert("Coming soon", isPresented: $comingSoon) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("In-app purchases are coming to the iOS app soon.")
            }
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            Image(systemName: "crown.fill").font(.system(size: 44)).foregroundStyle(gold)
            Text("Go Pro").font(Brand.title(34)).foregroundStyle(Theme.textPrimary)
            Text("Play unlimited & ad-free — all 8 modes, any time")
                .font(Brand.body(14)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
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
            Text("You're enjoying all Pro benefits!").font(Brand.body(14)).foregroundStyle(Theme.textMuted)
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
            planCard(title: "Monthly", price: "$\(monthlyPrice)", unit: "/mo", note: "Cancel anytime",
                     gradient: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], best: false, action: { comingSoon = true }, cta: "Subscribe Monthly")
            planCard(title: "Yearly", price: "$\(yearlyPrice)", unit: "/yr", note: "$4.99/mo billed annually",
                     gradient: [Color(hex: 0xF59E0B), gold], best: true, action: { comingSoon = true }, cta: "Subscribe Yearly")

            HStack(spacing: 10) {
                Rectangle().fill(Theme.border).frame(height: 1)
                Text("OR TRY IT FIRST").font(Brand.font(10, .heavy)).tracking(0.6).foregroundStyle(Theme.textMuted)
                Rectangle().fill(Theme.border).frame(height: 1)
            }.padding(.top, 6)
            Button { comingSoon = true } label: {
                Text("Just today — $\(dayPrice) for 24 hours of Pro →")
                    .font(Brand.font(14, .black)).foregroundStyle(Theme.primary)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            }
            Text("Eight day passes cost more than a month of Pro.")
                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity).multilineTextAlignment(.center)
        }
    }

    private func sectionHeader(_ t: String) -> some View {
        Text(t).font(Brand.font(11, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
    }

    private func benefitRow(_ b: Benefit) -> some View {
        HStack(spacing: 12) {
            Group {
                if let asset = b.asset {
                    Image(asset).renderingMode(.template).resizable().scaledToFit().frame(width: 20, height: 20)
                } else {
                    Image(systemName: b.symbol).font(.system(size: 18))
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
                          gradient: [Color], best: Bool, action: @escaping () -> Void, cta: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(Brand.headline(15)).foregroundStyle(Theme.textPrimary)
                Spacer()
                if best {
                    Text("BEST VALUE").font(Brand.font(10, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Capsule().fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
                }
            }
            (Text(price).font(Brand.font(30, .black)) + Text(unit).font(Brand.font(14, .bold)).foregroundColor(Theme.textMuted))
                .foregroundStyle(Theme.textPrimary)
            Text(note).font(Brand.body(12)).foregroundStyle(Theme.textMuted).padding(.bottom, 8)
            Button(action: action) {
                Text(cta).font(Brand.font(14, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(best ? Color(hex: 0xFDE68A) : Theme.border, lineWidth: 1.5))
    }
}