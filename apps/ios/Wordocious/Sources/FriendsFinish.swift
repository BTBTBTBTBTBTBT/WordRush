import SwiftUI
import WordociousCore

// The finishing build on the Friends surfaces (docs/FINISH_SPEC.md §A1, §A2, §C4;
// visual reference docs/design/brand/mockups/stats-friends-polish.html, the Friends
// phone). The Friends pages keep their LIGHT wallpaper in dark mode
// (`pageBackground(.friends, lightOnly: true)`), so these pieces stay light too —
// a light tinted card with dark ink is legible in both modes, where the shared
// dark-aware `tintedCard` would draw a dark card under the page's fixed dark ink.

/// The Friends phone's fixed inks (mockup values).
enum FriendsInk {
    /// Card headings / names (#2a1650).
    static let heading = Color(hex: 0x2A1650)
    /// Small lines under names (#6f5f8f / rows #7a6a95).
    static let muted = Color(hex: 0x6F5F8F)
    static let rowSub = Color(hex: 0x7A6A95)
    /// The race banner's headline + clock (pink card).
    static let bannerHead = Color(hex: 0x7A1F55)
    static let bannerLabel = Color(hex: 0xB0306F)
    static let faces = Color(hex: 0x8A4A6E)
    /// Section labels on the pink wallpaper.
    static let section = Color(hex: 0x8A2D63)
    /// The gold card's label.
    static let gold = Color(hex: 0x8A4A12)
    /// The lavender card's label.
    static let lavender = Color(hex: 0x5B3C96)
    /// Race chip text.
    static let chip = Color(hex: 0x5A2342)

    static let pink = Color(hex: 0xEC4899)
    static let amber = Color(hex: 0xF59E0B)
    static let goldAccent = Color(hex: 0xF5A524)
    static let purple = Color(hex: 0x7C3AED)
    static let online = Color(hex: 0x22C55E)

    /// Medal colors for ranks 1–3 (gold, silver, bronze); everyone else purple.
    static func medal(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(hex: 0xF5A524)
        case 2: return Color(hex: 0xAAB3C5)
        case 3: return Color(hex: 0xD9844A)
        default: return purple
        }
    }
}

/// §A1 on a light-only Friends page: a soft wash of the accent, a 1.5-pt accent
/// border, an optional top bar and the soft lift. `followsDark` swaps in the shared
/// dark-aware `tintedCard` when the app is dark (for content drawn with the flipping
/// `FinishInk` colors, e.g. the shared `PodiumView`).
struct FriendsCardChrome: ViewModifier {
    let accent: Color
    var bar: [Color]? = nil
    var radius: CGFloat = 20
    var barHeight: CGFloat = 10
    var tint: Double = 0.08
    var line: Double = 0.24
    var followsDark = false

    @ViewBuilder func body(content: Content) -> some View {
        if followsDark && Theme.isDark {
            content.tintedCard(accent: accent, bar: bar, radius: radius, barHeight: barHeight, tint: tint, line: line)
        } else {
            let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
            VStack(spacing: 0) {
                if let bar {
                    LinearGradient(colors: bar.count > 1 ? bar : [bar.first ?? accent, bar.first ?? accent],
                                   startPoint: .leading, endPoint: .trailing)
                        .frame(height: barHeight)
                }
                content
            }
            .background(shape.fill(accent.wash(tint)))
            .clipShape(shape)
            .overlay(shape.stroke(accent.wash(line), lineWidth: 1.5).allowsHitTesting(false))
            .shadow(color: Color(hex: 0x3C1E6E).opacity(0.10), radius: 10, x: 0, y: 8)
        }
    }
}

extension View {
    /// §A1 Friends card (light-only; see `FriendsCardChrome`).
    func friendsCard(accent: Color, bar: [Color]? = nil, radius: CGFloat = 20, barHeight: CGFloat = 10,
                     tint: Double = 0.08, line: Double = 0.24, followsDark: Bool = false) -> some View {
        modifier(FriendsCardChrome(accent: accent, bar: bar, radius: radius, barHeight: barHeight,
                                   tint: tint, line: line, followsDark: followsDark))
    }

    /// The soft striped row on a light Friends card (mockup `.frow`): every other
    /// row a faint wash of the card's accent, a hairline between rows.
    func friendsStripe(_ index: Int, accent: Color = FriendsInk.purple, divider: Bool = true) -> some View {
        background(index % 2 == 1 ? accent.wash(0.10).opacity(0.7) : Color.clear)
            .overlay(alignment: .top) {
                if divider && index > 0 {
                    Rectangle().fill(accent.opacity(0.10)).frame(height: 1).allowsHitTesting(false)
                }
            }
    }

    /// §A1 small light chip: a 12% wash of the accent with a 30% border.
    func friendsChip(_ accent: Color, strong: Bool = false) -> some View {
        background(Capsule().fill(accent.wash(strong ? 0.24 : 0.12)))
            .overlay(Capsule().stroke(strong ? accent : accent.wash(0.32), lineWidth: strong ? 2 : 1.5))
    }
}

/// The small caps label on the Friends cards (mockup `.lbl`): 11 pt Nunito Black,
/// 0.12 em tracking, in a fixed card ink (no dark flip — the cards stay light).
struct FriendsLabel: View {
    let text: String
    var color: Color = FriendsInk.section

    init(_ text: String, color: Color = FriendsInk.section) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text.uppercased())
            .font(Brand.font(11, .black)).tracking(1.3)
            .foregroundStyle(color)
            .lineLimit(1).minimumScaleFactor(0.7)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A non-action status chip (WAITING, counts): tinted, small caps.
struct FriendsStatusChip: View {
    let title: String
    var accent: Color = FriendsInk.purple

    var body: some View {
        Text(title.uppercased())
            .font(Brand.font(10.5, .black)).tracking(0.6)
            .foregroundStyle(Color.black.mixed(over: accent, 0.35))
            .padding(.horizontal, 10).frame(minHeight: 26)
            .friendsChip(accent)
            .lineLimit(1).fixedSize()
    }
}

// MARK: - §T friend invites + gift-a-week-of-Pro pieces

/// A §T scene image (`art-scene-invite-sent`, `-friends-match`, `-gift-pro`, …) at
/// `height`, decorative. `spring` pops it in (scale .6 → 1 with a bouncy spring) on
/// appear; Reduce Motion shows it in place.
struct FriendsSceneArt: View {
    let asset: String
    var height: CGFloat
    var maxWidth: CGFloat? = nil
    var spring = true
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var shown = false

    var body: some View {
        let still = envReduce || Theme.reduceMotion || !spring
        Group {
            if ArtAsset.exists(asset) {
                // §AQ2: the 800–1200 px scene downsampled to its small slot.
                ArtThumbs.image(asset, points: max(maxWidth ?? 0, height * max(1, ArtAsset.aspect(asset) ?? 1)))
                    .resizable().interpolation(.high).scaledToFit()
                    .frame(maxWidth: maxWidth, maxHeight: height)
            } else {
                MascotView(.i, size: height * 0.7, motion: .bob)
            }
        }
        .scaleEffect(still || shown ? 1 : 0.6)
        .opacity(still || shown ? 1 : 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            guard !still, !shown else { return }
            withAnimation(.spring(response: 0.45, dampingFraction: 0.55)) { shown = true }
        }
    }
}

/// §T3 one confetti + heart burst: pieces fly out from the center once, then fade.
/// Reduce Motion: nothing is drawn.
struct FriendsHeartBurst: View {
    var colors: [Color] = [Color(hex: 0xEC4899), Color(hex: 0xF5A524), Color(hex: 0x7C3AED), Color(hex: 0x22C55E), Color(hex: 0xFF8FB8)]
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var go = false

    var body: some View {
        GeometryReader { geo in
            if !(envReduce || Theme.reduceMotion) {
                ZStack {
                    ForEach(0..<22, id: \.self) { i in
                        let angle = Double(i) / 22 * 2 * .pi + Double(i % 3) * 0.15
                        let dist = min(geo.size.width, geo.size.height) * (0.38 + CGFloat(i % 4) * 0.07)
                        Group {
                            if i % 3 == 0 {
                                Image(systemName: "heart.fill").font(.system(size: 13 + CGFloat(i % 2) * 4, weight: .black))
                                    .foregroundStyle(Color(hex: 0xEC4899))
                            } else {
                                RoundedRectangle(cornerRadius: 2).fill(colors[i % colors.count]).frame(width: 8, height: 8)
                                    .rotationEffect(.degrees(go ? Double(i * 40) : 0))
                            }
                        }
                        .position(x: geo.size.width / 2 + (go ? CGFloat(cos(angle)) * dist : 0),
                                  y: geo.size.height / 2 + (go ? CGFloat(sin(angle)) * dist : 0))
                        .opacity(go ? 0 : 1)
                        .scaleEffect(go ? 1 : 0.4)
                    }
                }
                .onAppear { withAnimation(.easeOut(duration: 1.3)) { go = true } }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// §T1 a name / code on a small glossy pill (the candy recipe without the press).
struct FriendsGlossyPill: View {
    let text: String
    var accent: Color = FriendsInk.pink
    var size: CGFloat = 13

    var body: some View {
        let shape = Capsule(style: .continuous)
        OutlinedText(text: text, size: size, width: size < 14 ? 1.25 : 1.5)
            .padding(.horizontal, size * 0.95).padding(.vertical, size * 0.42)
            .background {
                ZStack(alignment: .top) {
                    shape.fill(LinearGradient(colors: [accent.mixed(over: .white, 0.7), accent], startPoint: .top, endPoint: .bottom))
                    shape.fill(LinearGradient(colors: [Color.white.opacity(0.45), Color.white.opacity(0)], startPoint: .top, endPoint: .center))
                        .padding(.horizontal, size * 0.6).padding(.top, 2)
                    shape.strokeBorder(Color(hex: 0xF5C542), lineWidth: 1)
                }
            }
            .background(shape.fill(Color.black.mixed(over: accent, 0.35)).offset(y: 2.5))
            .padding(.bottom, 2.5)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text)
    }
}

/// §T1 an invite code spelled on the game kit's glossy letter tiles (§B1).
struct FriendsCodeTiles: View {
    let code: String
    var tile: CGFloat = 32

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(code.uppercased().enumerated()), id: \.offset) { i, ch in
                GlossyTile(face: i % 2 == 0 ? .correct : .present, letter: String(ch), width: tile)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Code \(code.map(String.init).joined(separator: " "))")
    }
}

/// §T1 "INVITE SENT!": the Friends-accent card with I tossing the star envelope
/// (springing in), the lettered headline in soft-number ink, the friend's name on a
/// glossy pill and candy "Send another" / "Done".
struct FriendsInviteSentCard: View {
    let name: String?
    var line: String? = nil
    let onSendAnother: () -> Void
    var onDone: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 10) {
            FriendsSceneArt(asset: "art-scene-invite-sent", height: 120)
            Text("INVITE SENT!").softNumber(26, color: FinishInk.softNumber).tracking(0.6)
                .accessibilityAddTraits(.isHeader)
            if let name { FriendsGlossyPill(text: "@\(name)") }
            if let line {
                Text(line).font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 10) {
                Button(action: onSendAnother) { CandyLabel(title: "Send another", symbol: "paperplane.fill") }
                    .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium))
                if let onDone {
                    Button(action: onDone) { CandyLabel(title: "Done") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium))
                }
            }
            .padding(.top, 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .friendsCard(accent: FriendsInk.pink, bar: [FriendsInk.pink, FriendsInk.amber])
    }
}

/// §T3 "NEW FRIENDS!": I + pink O high-fiving (full card width) with one confetti +
/// heart burst, both avatars side by side and candy "Challenge them" / "See friends".
struct FriendsNewFriendsCard: View {
    let me: Profile?
    let friendName: String
    var friendAvatar: String? = nil
    var friendEmoji: String? = nil
    let onChallenge: () -> Void
    let onSeeFriends: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            FriendsSceneArt(asset: "art-scene-friends-match", height: 150)
                .frame(maxWidth: .infinity)
                .overlay { FriendsHeartBurst() }
            Text("NEW FRIENDS!").softNumber(26, color: FinishInk.softNumber).tracking(0.6)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 10) {
                if let me {
                    AvatarView(url: me.avatarUrl, username: me.username, size: 44, accentHex: me.accentColor, emoji: me.avatarEmoji, pro: Wordocious.isProActive(me))
                }
                Image(systemName: "heart.fill").font(.system(size: 16, weight: .black)).foregroundStyle(FriendsInk.pink)
                    .accessibilityHidden(true)
                AvatarView(url: friendAvatar, username: friendName, size: 44, emoji: friendEmoji)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("You and \(friendName) are now friends")
            HStack(spacing: 10) {
                Button(action: onChallenge) { CandyLabel(title: "Challenge them") { Image("swords").renderingMode(.template).resizable().scaledToFit().frame(width: 14, height: 14).foregroundStyle(.white) } }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium))
                Button(action: onSeeFriends) { CandyLabel(title: "See friends") }
                    .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .friendsCard(accent: FriendsInk.pink, bar: [FriendsInk.pink, FriendsInk.purple])
    }
}
