import SwiftUI
import WordociousCore

/// The share cards' HERO BAND (FRIDAY-QUEUE item 46; rules in Core ShareHero): the SENDER's own mascot, big, posed by
/// the result (cheer + crown on a win, jump on a gold glow for a flawless, a good-sport shrug on a loss, a wave
/// otherwise), on a soft glow (gold for a flawless, orange in the Halloween season). The real resolver renders it (the
/// same AvatarDirectory look every avatar uses); a photo avatar shows as its framed portrait. A guest has no band.
/// Static: share images render once through ImageRenderer.
struct ShareHeroBand: View {
    let result: ShareHero.Result

    /// A signed-in player has a mascot to celebrate with; a guest's card has no band (height 0).
    @MainActor static var available: Bool { AuthService.shared.profile != nil }

    /// The band's layout height for a card (band + gap), 0 for a guest.
    @MainActor static var layoutHeight: CGFloat { CGFloat(ShareHero.band(hasHero: available)) }

    @MainActor private var halloween: Bool { CastSkin.season != nil }

    var body: some View {
        let spec = ShareHero.spec(result, halloween: halloween)
        let glow = Color(hexString: spec.glow) ?? .purple
        let side = CGFloat(ShareHero.height) * 0.9
        ZStack {
            RadialGradient(colors: [glow.opacity(0.55), glow.opacity(0.18), glow.opacity(0)],
                           center: .center, startRadius: 0, endRadius: CGFloat(ShareHero.height) * 0.62)
                .frame(width: CGFloat(ShareHero.height) * 1.24, height: CGFloat(ShareHero.height) * 1.24)
            if spec.gold {
                Circle().strokeBorder(Color(hex: 0xF59E0B).opacity(0.85), lineWidth: 8)
                    .frame(width: CGFloat(ShareHero.height) * 0.94, height: CGFloat(ShareHero.height) * 0.94)
            }
            mascot(spec: spec, side: side)
            if spec.crown {
                Icon3D(.crown, size: CGFloat(ShareHero.height) * 0.3)
                    .rotationEffect(.degrees(-7))
                    .offset(x: side * 0.12, y: -CGFloat(ShareHero.height) * 0.4)
            }
        }
        .frame(width: 1080, height: CGFloat(ShareHero.height))
        .padding(.bottom, CGFloat(ShareHero.gap))
        .accessibilityHidden(true)
    }

    @MainActor @ViewBuilder
    private func mascot(spec: ShareHero.Spec, side: CGFloat) -> some View {
        if let p = AuthService.shared.profile {
            let r = AvatarDirectory.shared.look(username: p.username, userId: p.id, url: p.avatarUrl, castId: nil, frame: nil,
                                                mascot: nil, accentHex: p.accentColor, lookup: true).resolved
            if r.photoUrl == nil, LivingMascotView.canAnimate(r.config) {
                let posed: AvatarConfig = { var c = r.config; c.pose = spec.pose; return c }()
                LivingMascotView(config: posed, initial: AvatarCatalog.initial(p.username), size: side, cutout: true,
                                 interactive: false, own: false)
                    .frame(width: side, height: side)
            } else {
                AvatarView(url: p.avatarUrl, username: p.username, size: side * 0.8, accentHex: p.accentColor,
                           userId: p.id, alwaysLight: true)
            }
        }
    }
}
