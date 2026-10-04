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
    /// The saved beat's soft glow pulse (off with Reduce Motion).
    @State private var glow = false
    @Environment(\.accessibilityReduceMotion) private var envReduce

    /// FINISH_SPEC §G2: the purple header (the shield popup family).
    private static let header = LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)],
                                               startPoint: .topLeading, endPoint: .bottomTrailing)

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
            // FINISH_SPEC §A1: a soft lavender wash instead of plain white.
            .background(Theme.isDark ? Theme.surface : Color(hex: 0xF5EFFF))
            .clipShape(shape)
            .overlay(alignment: .topTrailing) {
                if !saved {
                    Button { onClose() } label: {
                        Image(systemName: "xmark").font(.system(size: 16, weight: .heavy))
                            .foregroundStyle(.white)
                            .shadow(color: Color(hex: 0x3B1A78).opacity(0.4), radius: 1, x: 0, y: 1)
                            .frame(width: 36, height: 36).contentShape(Rectangle())
                    }
                    .buttonStyle(.squish)
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
            Feedback.whoosh()
            withAnimation(Theme.animation(.spring(response: 0.35, dampingFraction: 0.8))) { shown = true }
        }
    }

    /// The shield-guard art (U shielding the streak flame), or the 3D shield.
    @ViewBuilder private func guardArt(height: CGFloat) -> some View {
        if ArtAsset.exists("art-scene-shield-guard") {
            Image("art-scene-shield-guard").resizable().interpolation(.high).scaledToFit()
                .frame(maxWidth: height * 1.5, maxHeight: height)
                .accessibilityHidden(true)
        } else {
            Icon3D(.shield, size: height * 0.6)
        }
    }

    private var askCard: some View {
        VStack(spacing: 0) {
            // §G2: the purple header with U guarding the flame.
            VStack(spacing: 2) {
                guardArt(height: 128)
                Text("STREAK AT RISK").font(Brand.font(12, .black)).tracking(1.4).foregroundStyle(.white.opacity(0.92))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 22).padding(.bottom, 14).padding(.horizontal, 24)
            .background(Self.header)

            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    Icon3D(.flame, size: 34)
                    Text("\(streak)").softNumber(44)
                    Text("DAY\nSTREAK").font(Brand.font(11, .black)).tracking(1.1)
                        .foregroundStyle(A11yInk.on(Color(hex: 0x6D28D9))).multilineTextAlignment(.leading)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(streak) day streak")
                HeadingArtView(.savestreak)   // BJ16: lettering, not plain text
                Text("Your \(streak)-day streak ends if you don't play today.")
                    .font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Icon3D(.shield, size: 18)
                    Text("\(shields) \(shieldWord(shields))").font(Brand.font(12, .black))
                }
                .foregroundStyle(A11yInk.on(Color(hex: 0x6D28D9)))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(Color(hex: 0x7C3AED))

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
                        // FINISH_SPEC §A8: the glossy candy button.
                        CandyLabel(title: loading == "shield" ? "Using a shield…" : "Use a shield") {
                            Icon3D(.shield, size: 22)
                        }
                    }
                    .buttonStyle(CastButtonStyle()).disabled(loading != nil)
                    .padding(.top, 4)
                } else {
                    Text("You're out of shields. Pro members get 4 every billing period.")
                        .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }

                Button {
                    loading = "decline"
                    Task { await onDecline(); loading = nil }
                } label: {
                    // §G2: the quiet peach candy.
                    CandyLabel(title: "Let it reset")
                }
                .buttonStyle(CandyButtonStyle(variant: .peach, size: .large)).disabled(loading != nil)
            }
            .padding(.vertical, 20).padding(.horizontal, 24)
        }
    }

    /// Post-use confirmation beat — the shield's work was invisible before:
    /// tap, modal gone, nothing acknowledged the save.
    private var savedBeat: some View {
        let still = envReduce || Theme.reduceMotion
        return VStack(spacing: 0) {
            ZStack {
                // §G2: the art with a soft glow + confetti.
                // §AZ: a radial-gradient glow (opacity animates) — no 26-pt live blur.
                Circle().fill(RadialGradient(colors: [Color(hex: 0xFDE68A), Color(hex: 0xFDE68A).opacity(0)],
                                             center: .center, startRadius: 0, endRadius: 100))
                    .frame(width: 200, height: 200)
                    .opacity(glow ? 0.65 : 0.35)
                guardArt(height: 140)
                if !still { ConfettiView() }
            }
            .frame(maxWidth: .infinity).frame(height: 170)
            .padding(.top, 22).padding(.horizontal, 24)
            .background(Self.header)
            .clipped()
            VStack(spacing: 8) {
                HeadingArtView(.streaksaved, height: 52)   // BJ16
                HStack(spacing: 8) {
                    Icon3D(.flame, size: 26)
                    Text("\(streak)").softNumber(30)
                    Text("days safe").font(Brand.font(12, .black)).foregroundStyle(FinishInk.secondary)
                }
                Text("\(shieldsAfter) \(shieldWord(shieldsAfter)) left")
                    .font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
            }
            .accessibilityElement(children: .combine)
            .padding(.vertical, 20).padding(.horizontal, 24)
        }
        .onAppear {
            Feedback.streak()   // §U: shield saved — streak · medium
            guard !still, !Motion.calm() else { return }   // §AD: no glow pulse in Low Power Mode
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { glow = true }
        }
    }
}
