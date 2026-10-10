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

enum HomeHostChoice: Hashable {
    case photo
    case mascot(AvatarConfig)
    case w
}

struct HomeHostMascot: View {
    var size: CGFloat = 84
    /// 2.8 item 13: the Stats card reuses the host standing free, without Home's one-time wave or invite bubble.
    var showsInvite: Bool = true
    var waves: Bool = true
    /// Founder 10-09: on a Flawless / Sweep day the host shows off over the headline (a backflip, a twirl, a
    /// bounce, in turn, every few seconds) like the celebrating cast below it, instead of standing still.
    var celebrates: Bool = false

    @ObservedObject private var directory = AvatarDirectory.shared
    @ObservedObject private var mascots = MascotLooks.shared
    @ObservedObject private var looks = CastAvatars.shared
    @ObservedObject private var dressUp = DressUp.shared
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    /// One wave per launch (not per Home visit).
    private static var wavedThisLaunch = false
    @State private var waveAngle: Double = 0
    @State private var hop: CGFloat = 0
    @State private var flip: Double = 0
    @State private var twirl: Double = 0
    @State private var squash: CGFloat = 1

    var body: some View {
        ZStack(alignment: .bottom) {
            // The soft floor shadow the host stands on.
            Ellipse()
                .fill(RadialGradient(colors: [Color(hex: 0x4C1D95).opacity(0.20), .clear],
                                     center: .center, startRadius: 0, endRadius: size * 0.36))
                .frame(width: size * 0.78, height: size * 0.13)
                .offset(y: size * 0.03)
                .allowsHitTesting(false)
            // Founder 10-05: the first frame is the player's cached look (HostLookCache); a look that
            // changed on another device crossfades in (~200 ms), never a hard pop. Same look = no change.
            ZStack(alignment: .bottom) {
                figure
                    .id(choice)
                    .transition(.opacity)
            }
            .frame(width: size, height: size, alignment: .bottom)
            .animation(.easeInOut(duration: HostLookRules.crossfadeSeconds), value: choice)
            .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
            .rotation3DEffect(.degrees(twirl), axis: (x: 0, y: 1, z: 0), perspective: 0.4)
            .rotationEffect(.degrees(flip))
            .rotationEffect(.degrees(waveAngle), anchor: .bottom)
            .offset(y: hop)
            // The invite host is a button; YOUR living mascot answers a tap (founder 10-09: hop + its sound); the cast
            // host still lets taps through to the card.
            .allowsHitTesting((choice == .w && directory.ownHostInvite() != nil) || ownIsAlive)
        }
        .frame(width: size, height: size)
        .overlay(alignment: .topLeading) {
            if showsInvite, choice == .w, directory.ownHostInvite() != nil { inviteBubble }
        }
        .animation(.easeInOut(duration: HostLookRules.crossfadeSeconds), value: directory.ownHostInvite() != nil)
        .onAppear { if waves { waveOnce() } }
        .onAppear { DressUp.prewarm() }
        .task(id: celebrates) { await showOff() }
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

    private var choice: HomeHostChoice { directory.ownHostChoice() }
    /// Your own mascot is showing and alive (the living mascot is on): it takes taps.
    private var ownIsAlive: Bool {
        if case .mascot(let config) = choice { return LivingMascotView.canAnimate(config) }
        return false
    }

    @ViewBuilder private var figure: some View {
        switch choice {
        case .photo:
            // The framed portrait: the photo whole, never on a body (AvatarView's photo branch
            // wears the chosen frame, else the player's tier art frame). Launch window: the cached
            // photo + frame, drawn as given (the profile row isn't in hand yet).
            if let h = directory.ownHostPhoto() {
                Group {
                    if h.cached {
                        AvatarView(url: h.url, username: h.username, size: size * 0.92, pro: h.pro, frame: h.frame,
                                   lookup: false, userId: h.userId)
                    } else {
                        AvatarView(url: h.url, username: h.username, size: size * 0.92, userId: h.userId)
                    }
                }
                .shadow(color: Color(hex: 0x4C1D95).opacity(0.18), radius: 4, x: 0, y: 3)
                .padding(.bottom, size * 0.02)
            }
        case .mascot(let config):
            // FINISH_SPEC BJ6 (coordinator 10-03): the host is a full-body CUTOUT — no backdrop
            // tile, no frame, no border — standing free on the cap like W. (Everywhere else the
            // avatar keeps its backdrop + frame.)
            Group {
                if LivingMascotView.canAnimate(config) {
                    // Alive in its saved pose: it breathes, blinks, reacts to moments, and (founder 10-09) a tap makes it hop
                    // with its sound.
                    LivingMascotView(config: config, initial: AvatarCatalog.initial(AuthService.shared.profile?.username ?? HostLookCache.load()?.username), size: size,
                                     cutout: true, interactive: true)
                } else {
                    MascotCutout(config: config, initial: AvatarCatalog.initial(AuthService.shared.profile?.username ?? HostLookCache.load()?.username), size: size)
                }
            }
            .shadow(color: Color(hex: 0x4C1D95).opacity(0.16), radius: 2.5, x: 0, y: 2)
        case .w:
            if let invite = directory.ownHostInvite() {
                // Door 2: your own plain mascot hosts until you make it yours.
                Button { DressUp.shared.finish(.hostInvite); DressUp.shared.open(.room(.body)) } label: {
                    MascotCutout(config: invite, initial: AvatarCatalog.initial(AuthService.shared.profile?.username ?? HostLookCache.load()?.username), size: size)
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

    /// The celebration loop: one trick every ~4.5 s while `celebrates` (transform only; off under reduce motion).
    private func showOff() async {
        guard celebrates, !Motion.calm(envReduceMotion) else { return }
        try? await Task.sleep(nanoseconds: 1_600_000_000)
        var n = 0
        while !Task.isCancelled && celebrates {
            await trick(n % 3)
            n += 1
            try? await Task.sleep(nanoseconds: 4_500_000_000)
        }
    }

    private func wait(_ s: Double) async { try? await Task.sleep(nanoseconds: UInt64(s * 1_000_000_000)) }

    @MainActor private func trick(_ kind: Int) async {
        // Crouch, launch, the move in the air, land with a squash, settle.
        withAnimation(.easeOut(duration: 0.12)) { squash = 0.86 }
        await wait(0.12)
        let air = kind == 2 ? 0.26 : 0.5
        let rise: CGFloat = kind == 2 ? -14 : -size * 0.34
        withAnimation(.easeOut(duration: air / 2)) { hop = rise; squash = 1.06 }
        switch kind {
        case 0: withAnimation(.easeInOut(duration: air)) { flip = -360 }        // backflip
        case 1: withAnimation(.easeInOut(duration: air)) { twirl = 360 }        // twirl
        default: withAnimation(.easeInOut(duration: air / 2)) { waveAngle = 9 } // happy bounce
        }
        await wait(air / 2)
        withAnimation(.easeIn(duration: air / 2)) { hop = 0; squash = 1; if kind == 2 { waveAngle = -9 } }
        await wait(air / 2)
        withAnimation(.easeOut(duration: 0.1)) { squash = 0.88 }
        await wait(0.1)
        withAnimation(.spring(response: 0.32, dampingFraction: 0.55)) { squash = 1; waveAngle = 0 }
        // Wind the turn back to 0 unseen (360 = 0), so the next trick starts clean.
        var t = Transaction(); t.disablesAnimations = true
        withTransaction(t) { flip = 0; twirl = 0 }
        if kind == 2 {
            await wait(0.18)
            withAnimation(.easeOut(duration: 0.13)) { hop = -9 }
            await wait(0.13)
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { hop = 0 }
        }
    }

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
