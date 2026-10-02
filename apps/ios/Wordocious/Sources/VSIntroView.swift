import SwiftUI
import WordociousCore

/// WORDOCIOUS wordmark for the dark VS overlays (clash splash + countdown) —
/// the header wordmark's gradient/weight, rendered at the SAME fixed position
/// on both overlays so it appears not to move across the clash → countdown
/// transition. Shared by VSMatchIntroView and VSGameView.countdownOverlay.
struct VSOverlayWordmark: View {
    var body: some View {
        GeometryReader { geo in
            Text("WORDOCIOUS")
                .font(Brand.font(58, .black)).tracking(-0.5)
                .lineLimit(1).minimumScaleFactor(0.6)
                .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                startPoint: .leading, endPoint: .trailing))
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                // Centered ~1/4 down the overlay (user-specified placement) —
                // identical on the clash splash and the countdown so it reads
                // as pinned across the transition.
                .position(x: geo.size.width / 2, y: geo.size.height * 0.24)
        }
        .allowsHitTesting(false)
    }
}

/// Full-screen 2.5s match-intro splash shown when a match is found — ports
/// apps/web/components/vs/match-intro.tsx, restyled to the home/VS aesthetic
/// (VS polish spec §2): a one-window card (teal for people and bots, purple
/// for a challenge race) with a frosted MATCH FOUND strip + mode chip, the two
/// avatars facing each other (they still slam in from opposite sides), names
/// in caps and the head-to-head line. Skippable on tap. Anonymous opponents
/// render as "Anonymous" with the initials avatar and no head-to-head line.
struct VSMatchIntroView: View {
    struct Player {
        let username: String
        let avatarUrl: String?
        let level: Int?
        /// A bot's art, drawn instead of a photo (VS overhaul §9).
        var botArt: String? = nil
        /// Replaces the level chip: "BOT", or a challenge's "@doug’s run".
        var subtitle: String? = nil
    }

    let mode: GameMode
    let me: Player
    /// nil = anonymous opponent (no userId from the server).
    let opponent: Player?
    /// nil while loading or when the opponent is anonymous.
    let headToHead: HeadToHeadRecord?
    /// Purple window (a challenge race) instead of VS teal.
    var purple: Bool = false
    let onDone: () -> Void

    // Staggered slam — the two cards clash a beat apart rather than landing
    // simultaneously, which reads more fluid than a single hard snap.
    @State private var meSlammed = false
    @State private var oppSlammed = false
    @State private var vsPopped = false
    @State private var h2hShown = false
    @State private var finished = false

    private var opp: Player { opponent ?? Player(username: "Anonymous", avatarUrl: nil, level: nil) }
    private var headInk: Color { purple ? VsLobbyKit.purpleInk : VsLobbyKit.deep }
    private var subInk: Color { purple ? VsLobbyKit.purpleSub : VsLobbyKit.ink }

    var body: some View {
        ZStack {
            // Opaque VS page — nothing behind (the queue screen) can ghost through.
            PageBackground(tint: .vs, lightOnly: true)

            VSOverlayWordmark()

            VStack(spacing: 16) {
                window
                Text("TAP TO SKIP")
                    .font(Brand.font(10, .black)).tracking(2)
                    .foregroundStyle(VsLobbyKit.label.opacity(0.7))
            }
            .padding(.horizontal, 16)
        }
        .contentShape(Rectangle())
        .onTapGesture { finish() }
        .onAppear {
            SoundManager.shared.playVsStinger()
            // Slam-in with a soft overshoot so the clash glides in instead of
            // snapping; the two sides land a beat apart (opponent +0.12s).
            let slam = Animation.spring(response: 0.72, dampingFraction: 0.72)
            withAnimation(Theme.animation(slam)) { meSlammed = true }
            withAnimation(Theme.animation(slam.delay(0.12))) { oppSlammed = true }
            // "VS" pops once both sides have mostly landed (0.5s).
            withAnimation(Theme.animation(.spring(response: 0.5, dampingFraction: 0.58).delay(0.5))) { vsPopped = true }
            // Head-to-head fades up after the VS settles.
            withAnimation(Theme.animation(.easeOut(duration: 0.45).delay(0.85))) { h2hShown = true }
            // Auto-finish after 2.5s (keeps the countdown beat before match start).
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { finish() }
        }
    }

    private var window: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("MATCH FOUND").font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(headInk)
                Spacer(minLength: 6)
                VSModeChip(mode: mode)
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(Color.white.opacity(0.5))

            VStack(spacing: 14) {
                HStack(alignment: .top, spacing: 6) {
                    playerCard(me)
                        .offset(x: meSlammed ? 0 : -260)
                        .opacity(meSlammed ? 1 : 0)
                    Text("VS")
                        .font(Brand.font(26, .black)).foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(Circle().fill(subInk))
                        .padding(.top, 10)
                        .scaleEffect(vsPopped ? 1 : 0.01)
                        .opacity(vsPopped ? 1 : 0)
                    playerCard(opp)
                        .offset(x: oppSlammed ? 0 : 260)
                        .opacity(oppSlammed ? 1 : 0)
                }

                // Head-to-head line (known opponents only).
                if opponent != nil, let h2h = headToHead {
                    Text(HeadToHeadService.headToHeadLine(opponentName: opp.username, h2h))
                        .font(Brand.font(12, .heavy)).foregroundStyle(subInk)
                        .multilineTextAlignment(.center)
                        .offset(y: h2hShown ? 0 : 8)
                        .opacity(h2hShown ? 1 : 0)
                }
            }
            .padding(.horizontal, 10).padding(.vertical, 18)
        }
        .frame(maxWidth: 420)
        .background {
            ZStack {
                if purple {
                    LinearGradient(colors: [Color(hex: 0xEBD6FD), Color(hex: 0xE2E6FF)], startPoint: .top, endPoint: .bottom)
                } else {
                    LinearGradient(colors: [Color(hex: 0xD5F5EE), Color(hex: 0xE0F2FE)], startPoint: .top, endPoint: .bottom)
                }
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .clipShape(shape)
        .shadow(color: (purple ? VsLobbyKit.purpleInk : VsLobbyKit.deep).opacity(0.08), radius: 7, x: 0, y: 4)
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onDone()
    }

    private func playerCard(_ p: Player) -> some View {
        VStack(spacing: 7) {
            // Avatar + ring share one frame and are rasterized into a single
            // layer, so the ring can never drift off the photo mid-slam.
            ZStack {
                VSPlayerAvatar(url: p.avatarUrl, username: p.username, botArt: p.botArt, size: 72)
                Circle().strokeBorder(.white, lineWidth: 3)
            }
            .frame(width: 72, height: 72)
            .drawingGroup()
            .shadow(color: headInk.opacity(0.12), radius: 5, x: 0, y: 2)
            Text(p.username.uppercased())
                .font(Brand.font(13, .black)).tracking(0.4).foregroundStyle(headInk)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let subtitle = p.subtitle {
                chip(subtitle)
            } else if let level = p.level {
                chip("Lv \(level)")
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(Brand.font(10, .black)).foregroundStyle(subInk)
            .lineLimit(1).minimumScaleFactor(0.7)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(Color.white.opacity(0.75)))
    }
}

/// Three pulsing pink dots — the "is typing" indicator (web animate-pulse dots).
struct TypingDots: View {
    var dotSize: CGFloat = 4
    @State private var on = false

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { i in
                Circle().fill(Color(hex: 0xEC4899))
                    .frame(width: dotSize, height: dotSize)
                    .opacity(on ? 1 : 0.3)
                    .animation(Theme.animation(.easeInOut(duration: 0.6).repeatForever().delay(Double(i) * 0.2)),
                               value: on)
            }
        }
        .onAppear { on = true }
    }
}

/// Top toast for opponent milestone callouts ("<name> got 4 greens! 😱") —
/// a soft white pill with a teal dot (VS polish spec §1), over the board.
struct VSCalloutPill: View {
    let text: String

    var body: some View {
        HStack(spacing: 7) {
            Circle().fill(VsLobbyKit.ink).frame(width: 7, height: 7)
            Text(text)
                .font(Brand.font(12, .black)).foregroundStyle(VsLobbyKit.deep)
                .lineLimit(2).multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background(Capsule().fill(Color.white))
        .shadow(color: VsLobbyKit.deep.opacity(0.14), radius: 8, x: 0, y: 3)
        .padding(.horizontal, 24)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}
