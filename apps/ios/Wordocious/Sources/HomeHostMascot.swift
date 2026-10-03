import SwiftUI
import WordociousCore

// FINISH_SPEC BJ6 — the Good Morning card's host, ONE component (so the founder's
// option B — the player standing at the end of the WORDOCIOUS cast row with a small
// "YOU" tag — is a placement change, not a rewrite).
//
// Founder 10-03: "swap the purple main character … for your own created guy" and then
// "the created mascot can be a little more prominent on the main menu bar" (plan A): the
// host stands on the LEFT of the card at ~2× the old corner size on a soft floor shadow.
// Who stands there:
//   • a signed-in player whose avatar shows their uploaded PHOTO → the photo whole, as a
//     framed portrait (their chosen frame, else their level tier's art-frame-<tier>) —
//     founder: "I don't just want the profile pics tacked on to a body as if it were a face";
//   • else a player with a custom mascot (saved avatar_config, or a worn cast hero) → the
//     full mascot;
//   • else (guests, no custom look) → W, waving.
// It waves once per launch when Home appears (transform only), then rests.

enum HomeHostChoice: Equatable {
    case photo
    case mascot(AvatarConfig)
    case w
}

struct HomeHostMascot: View {
    var size: CGFloat = 84

    @ObservedObject private var directory = AvatarDirectory.shared
    @ObservedObject private var mascots = MascotLooks.shared
    @ObservedObject private var looks = CastAvatars.shared
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    /// One wave per launch (not per Home visit).
    private static var wavedThisLaunch = false
    @State private var waveAngle: Double = 0
    @State private var hop: CGFloat = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            // The soft floor shadow the host stands on.
            Ellipse()
                .fill(RadialGradient(colors: [Color(hex: 0x4C1D95).opacity(0.20), .clear],
                                     center: .center, startRadius: 0, endRadius: size * 0.36))
                .frame(width: size * 0.78, height: size * 0.13)
                .offset(y: size * 0.03)
            figure
                .rotationEffect(.degrees(waveAngle), anchor: .bottom)
                .offset(y: hop)
        }
        .frame(width: size, height: size)
        .onAppear(perform: waveOnce)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    @ViewBuilder private var figure: some View {
        switch directory.ownHostChoice() {
        case .photo:
            // The framed portrait: the photo whole, never on a body (AvatarView's photo branch
            // wears the chosen frame, else the player's tier art frame).
            if let p = AuthService.shared.profile {
                AvatarView(url: p.avatarUrl, username: p.username, size: size * 0.92, userId: p.id)
                    .shadow(color: Color(hex: 0x4C1D95).opacity(0.18), radius: 4, x: 0, y: 3)
                    .padding(.bottom, size * 0.02)
            }
        case .mascot(let config):
            MascotAvatar(config: config, initial: AvatarCatalog.initial(AuthService.shared.profile?.username),
                         size: size * 0.92)
                .shadow(color: Color(hex: 0x4C1D95).opacity(0.14), radius: 3, x: 0, y: 2)
                .padding(.bottom, size * 0.02)
        case .w:
            // Decoded ahead of Home's first frame (prewarm), drawn at its display size.
            if ArtAsset.exists(Self.wPose) {
                ArtThumbs.image(Self.wPose, points: size).resizable().interpolation(.high).scaledToFit()
                    .frame(height: size)
            } else {
                PoseImage(.w, "wave", height: size)
            }
        }
    }

    static let wPose = "art-pose-w-wave"

    /// FINISH_SPEC BJ6 (founder: "loads instantly"): decode W's wave pose off main at launch so
    /// the host never pops in (the cap, sparkles and confetti are code-drawn shapes).
    static func prewarm() { ArtThumbs.prewarm([(wPose, HomeBannerView.hostSize)]) }

    private func waveOnce() {
        guard !Self.wavedThisLaunch else { return }
        Self.wavedThisLaunch = true
        guard !Motion.calm(envReduceMotion) else { return }
        // A small hop with a friendly ±10° wag, twice, then rest (≈ 1 s, transform only).
        let beat = 0.22
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            withAnimation(.easeOut(duration: beat)) { hop = -6; waveAngle = 10 }
            DispatchQueue.main.asyncAfter(deadline: .now() + beat) {
                withAnimation(.easeInOut(duration: beat)) { waveAngle = -8 }
                DispatchQueue.main.asyncAfter(deadline: .now() + beat) {
                    withAnimation(.easeInOut(duration: beat)) { waveAngle = 8 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + beat) {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { hop = 0; waveAngle = 0 }
                    }
                }
            }
        }
    }
}
