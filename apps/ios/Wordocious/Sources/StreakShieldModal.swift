import SwiftUI

/// "Streak at Risk!" modal — ports components/modals/streak-shield-modal.tsx.
/// Shown on app open when the player has a daily-login streak that's about to
/// lapse. They can spend a shield to preserve it or let it reset.
struct StreakShieldModal: View {
    let streak: Int
    let shields: Int
    var onUseShield: () async -> Void
    var onDecline: () async -> Void
    var onClose: () -> Void

    @State private var loading: String?
    @State private var shown = false

    private let lilac = Color(hex: 0xC4B5FD)

    var body: some View {
        ZStack {
            Color.black.opacity(0.4).ignoresSafeArea()
                .onTapGesture { onClose() }

            VStack(spacing: 16) {
                // Flame with "!" badge
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 52))
                        .foregroundStyle(Color(hex: 0xF97316))
                    Text("!")
                        .font(Brand.font(11, .black)).foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(Circle().fill(Color(hex: 0xEF4444)))
                        .offset(x: 6, y: -6)
                }
                .padding(.top, 8)

                Text("Streak at Risk!")
                    .font(Brand.font(20, .black)).foregroundStyle(Theme.textPrimary)

                Text("\(streak)")
                    .font(Brand.font(48, .black)).foregroundStyle(Theme.textPrimary)
                Text("day streak will be lost if you don't play today")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)

                // Shield count pill
                HStack(spacing: 6) {
                    Image(systemName: "shield.fill").font(.system(size: 13))
                    Text("\(shields)").font(Brand.font(12, .heavy))
                }
                .foregroundStyle(Color(hex: 0x5B21B6))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(Capsule().fill(Theme.surfaceHover))
                .overlay(Capsule().stroke(lilac, lineWidth: 1.5))

                // Actions
                VStack(spacing: 8) {
                    if shields > 0 {
                        Button {
                            loading = "shield"
                            Task { await onUseShield(); loading = nil }
                        } label: {
                            Text(loading == "shield" ? "Using Shield..." : "Use Shield (\(shields) left)")
                                .font(Brand.font(14, .black)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity).padding(.vertical, 13)
                                .background(RoundedRectangle(cornerRadius: 12).fill(
                                    LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)],
                                                   startPoint: .topLeading, endPoint: .bottomTrailing)))
                                .shadow(color: Color(hex: 0x4C1D95), radius: 0, x: 0, y: 4)
                        }
                        .buttonStyle(.plain).disabled(loading != nil).opacity(loading != nil ? 0.5 : 1)
                    } else {
                        Text("You have no streak shields. Pro subscribers get 4 shields per billing period.")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        loading = "decline"
                        Task { await onDecline(); loading = nil }
                    } label: {
                        Text("Let Streak Reset")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.plain).disabled(loading != nil).opacity(loading != nil ? 0.5 : 1)
                }
                .padding(.top, 4)
            }
            .padding(24)
            .frame(maxWidth: 340)
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(lilac, lineWidth: 1.5))
            .overlay(alignment: .topTrailing) {
                Button { onClose() } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.textMuted).padding(16)
                }.buttonStyle(.plain)
            }
            .shadow(color: .black.opacity(0.12), radius: 30, x: 0, y: 20)
            .padding(.horizontal, 24)
            .scaleEffect(shown ? 1 : 0.9).opacity(shown ? 1 : 0)
        }
        .onAppear {
            Haptics.warning()
            withAnimation(Theme.animation(.spring(response: 0.35, dampingFraction: 0.8))) { shown = true }
        }
    }
}
