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
    @ObservedObject private var dressUp = DressUp.shared
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
                .allowsHitTesting(false)
            figure
                .rotationEffect(.degrees(waveAngle), anchor: .bottom)
                .offset(y: hop)
                // only the invite host is a button; every other host lets taps through
                .allowsHitTesting(directory.ownHostChoice() == .w && directory.ownHostInvite() != nil)
        }
        .frame(width: size, height: size)
        .overlay(alignment: .topLeading) {
            if directory.ownHostChoice() == .w, directory.ownHostInvite() != nil { inviteBubble }
        }
        .onAppear(perform: waveOnce)
        .onAppear { DressUp.prewarm() }
    }

    /// Door 2 (founder 10-05): "Make me yours!" beside the plain host; tap → the Dressing Room,
    /// × dismisses it for good. Subtle: a small soft bubble, once per account.
    private var inviteBubble: some View {
        Button {
            DressUp.shared.finish(.hostInvite)
            DressUp.shared.open(.room(.body))
        } label: {
            Text("Make me yours!")
                .font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0x6D28D9))
                .lineLimit(1).fixedSize()
                .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 13)
                .background {
                    if ArtAsset.exists("art-dress-bubble") {
                        ArtThumbs.image("art-dress-bubble", points: 130).resizable().interpolation(.high)
                    } else {
                        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white)
                    }
                }
        }
        .buttonStyle(.squish)
        .overlay(alignment: .topTrailing) {
            // The family 3D X (README §3); 44 pt hit area, so the offset keeps its center on the bubble's corner.
            FamilyCloseButton(size: 18, label: "Dismiss") { Haptics.tap(); DressUp.shared.finish(.hostInvite) }
                .offset(x: 17, y: -17)
        }
        .accessibilityLabel("Make me yours! Dress up your mascot")
        .offset(x: size * 0.82, y: size * 0.04)
        .transition(.opacity)
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
            // FINISH_SPEC BJ6 (coordinator 10-03): the host is a full-body CUTOUT — no backdrop
            // tile, no frame, no border — standing free on the cap like W. (Everywhere else the
            // avatar keeps its backdrop + frame.)
            MascotCutout(config: config, initial: AvatarCatalog.initial(AuthService.shared.profile?.username), size: size)
                .shadow(color: Color(hex: 0x4C1D95).opacity(0.16), radius: 2.5, x: 0, y: 2)
        case .w:
            if let invite = directory.ownHostInvite() {
                // Door 2: your own plain mascot hosts until you make it yours.
                Button { DressUp.shared.finish(.hostInvite); DressUp.shared.open(.room(.body)) } label: {
                    MascotCutout(config: invite, initial: AvatarCatalog.initial(AuthService.shared.profile?.username), size: size)
                        .shadow(color: Color(hex: 0x4C1D95).opacity(0.16), radius: 2.5, x: 0, y: 2)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("Your mascot. Make it yours")
            } else if ArtAsset.exists(Self.wPose) {
            // Decoded ahead of Home's first frame (prewarm), drawn at its display size.
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

/// BJ6: a player's mascot drawn as a free-standing figure — the same layered art (or the
/// code-drawn placeholder) the avatar renders, minus its backdrop stage, tile clip, border and
/// frame. Static: one Canvas, drawn once per config.
struct MascotCutout: View {
    let config: AvatarConfig
    let initial: String
    let size: CGFloat

    var body: some View {
        var c = config
        c.frame = "none"
        let small = size <= MascotParts.smallSize
        return Group {
            if let fit = MascotParts.fit, MascotParts.art("body", c.body) != nil {
                let layout = AvatarFit.layout(c, small: small, manifest: fit)
                Canvas { ctx, _ in
                    MascotArtPainter.paint(ctx, side: size, layout: layout, config: c, initial: initial, small: small)
                }
            } else {
                let hasHat = c.head != "none"
                let u = size * (hasHat ? 0.84 : 0.94)
                Canvas { ctx, _ in MascotPainter.paint(ctx, u: u, config: c, initial: initial, small: small) }
                    .frame(width: u, height: u)
                    .position(x: size / 2, y: size - u / 2)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
