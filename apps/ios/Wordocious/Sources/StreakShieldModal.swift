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
    /// Post-use confirmation beat — the shield's work was invisible before:
    /// tap, modal gone, nothing acknowledged the save.
    @State private var saved = false

    private var shieldsAfter: Int { max(shields - 1, 0) }
    private func shieldWord(_ n: Int) -> String { n == 1 ? "shield" : "shields" }

    var body: some View {
        // Restyled to the home redesign's look (founder, 2026-10-01: the old card
        // "looks dated"; web streak-shield-modal.tsx): a soft warm header with the
        // flame and the number, an all-caps headline, no bubbles, one flat rounded
        // button. Same actions and timing.
        let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
        ZStack {
            Color(hex: 0x1E1B4B).opacity(0.45).ignoresSafeArea()
                .onTapGesture { if !saved { onClose() } }

            VStack(spacing: 0) {
                if saved { savedBeat.transition(.opacity) } else { askCard }
            }
            .frame(maxWidth: 360)
            .background(Color.white)
            .clipShape(shape)
            .overlay(alignment: .topTrailing) {
                if !saved {
                    Button { onClose() } label: {
                        Image(systemName: "xmark").font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color(hex: 0x92400E))
                            .frame(width: 36, height: 36).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12).padding(.trailing, 12)
                    .accessibilityLabel("Close")
                }
            }
            .shadow(color: Color(hex: 0x4C1D95).opacity(0.25), radius: 30, x: 0, y: 24)
            .padding(.horizontal, 16)
            .scaleEffect(shown ? 1 : 0.9).opacity(shown ? 1 : 0)
        }
        .onAppear {
            Haptics.warning()
            withAnimation(Theme.animation(.spring(response: 0.35, dampingFraction: 0.8))) { shown = true }
        }
    }

    private var askCard: some View {
        VStack(spacing: 0) {
            VStack(spacing: 4) {
                Icon3D(.flame, size: 60)
                Text("\(streak)").font(Brand.font(52, .black)).foregroundStyle(Color(hex: 0x78350F))
                Text("DAY STREAK").font(Brand.font(11, .black)).tracking(1.2).foregroundStyle(Color(hex: 0xB45309))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 32).padding(.bottom, 20).padding(.horizontal, 24)
            .background(LinearGradient(colors: [Color(hex: 0xFFF3E0), Color(hex: 0xFDE7F0)], startPoint: .top, endPoint: .bottom))

            VStack(spacing: 12) {
                Text("DON'T LOSE YOUR STREAK!").font(Brand.font(18, .black)).tracking(0.4)
                    .foregroundStyle(Color(hex: 0x4C1D95))
                    .multilineTextAlignment(.center)
                Text("Your \(streak)-day streak ends if you don't play today.")
                    .font(Brand.font(13, .bold)).foregroundStyle(Color(hex: 0x4B5563))
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Icon3D(.shield, size: 16)
                    Text("\(shields) \(shieldWord(shields))").font(Brand.font(12, .black))
                }
                .foregroundStyle(Color(hex: 0x6D28D9))

                // Shields are the only way to save a streak. No shields: the Pro note.
                if shields > 0 {
                    Button {
                        loading = "shield"
                        Task {
                            await onUseShield()
                            loading = nil
                            withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { saved = true }
                            try? await Task.sleep(nanoseconds: 1_800_000_000)
                            onClose()
                        }
                    } label: {
                        Text(loading == "shield" ? "USING A SHIELD…" : "USE A SHIELD")
                            .font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(
                                LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)],
                                               startPoint: .topLeading, endPoint: .bottomTrailing)))
                            .shadow(color: Color(hex: 0x6D28D9).opacity(0.3), radius: 8, x: 0, y: 6)
                    }
                    .buttonStyle(.plain).disabled(loading != nil).opacity(loading != nil ? 0.5 : 1)
                    .padding(.top, 4)
                } else {
                    Text("You're out of shields. Pro members get 4 every billing period.")
                        .font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0x6B7280))
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }

                Button {
                    loading = "decline"
                    Task { await onDecline(); loading = nil }
                } label: {
                    Text("Let it reset")
                        .font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0x6B7280))
                        .frame(maxWidth: .infinity).padding(.vertical, 8)
                }
                .buttonStyle(.plain).disabled(loading != nil).opacity(loading != nil ? 0.5 : 1)
            }
            .padding(.vertical, 20).padding(.horizontal, 24)
        }
    }

    /// Post-use confirmation beat — the shield's work was invisible before:
    /// tap, modal gone, nothing acknowledged the save.
    private var savedBeat: some View {
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                Icon3D(.shield, size: 70)
                Text("STREAK SAVED!").font(Brand.font(22, .black)).tracking(0.4).foregroundStyle(Color(hex: 0x4C1D95))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 32).padding(.bottom, 24).padding(.horizontal, 24)
            .background(LinearGradient(colors: [Color(hex: 0xEDE9FE), Color(hex: 0xE0E7FF)], startPoint: .top, endPoint: .bottom))
            Text("Your \(streak)-day streak is safe · \(shieldsAfter) \(shieldWord(shieldsAfter)) left")
                .font(Brand.font(13, .bold)).foregroundStyle(Color(hex: 0x4B5563))
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 20).padding(.horizontal, 24)
        }
    }
}
