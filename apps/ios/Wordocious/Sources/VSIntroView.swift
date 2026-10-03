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
        /// FINISH_SPEC §D3: the cast bot it plays as (banter at match start); nil
        /// for people and Your Ghost.
        var botId: String? = nil
    }

    let mode: GameMode
    let me: Player
    /// nil = anonymous opponent (no userId from the server).
    let opponent: Player?
    /// nil while loading or when the opponent is anonymous.
    let headToHead: HeadToHeadRecord?
    /// Purple window (a challenge race) instead of VS teal.
    var purple: Bool = false
    /// FINISH_SPEC §D3: a CPU bot's kind, in-character hello (nil for people / the ghost).
    var banter: String? = nil
    let onDone: () -> Void

    // Staggered slam — the two cards clash a beat apart rather than landing
    // simultaneously, which reads more fluid than a single hard snap.
    @State private var meSlammed = false
    @State private var oppSlammed = false
    @State private var vsPopped = false
    @State private var h2hShown = false
    @State private var finished = false

    private var opp: Player { opponent ?? Player(username: "Anonymous", avatarUrl: nil, level: nil) }
    private var headInk: Color { VsLobbyKit.titleInk }
    private var subInk: Color { purple ? VsLobbyKit.purpleSub : VsLobbyKit.ink }
    private var accent: Color { purple ? VsLobbyKit.purple : VsLobbyKit.ink }

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
            Feedback.vs()   // §U: vs · medium
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

    /// The versus card (§D3): you (your avatar / letter tile) vs them (a bot in its
    /// "ready" pose, or the person's avatar), names, the candy VS lettering, and the
    /// bot's hello line or the head-to-head.
    private var window: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("MATCH FOUND").font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(headInk)
                Spacer(minLength: 6)
                VSModeChip(mode: mode)
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 6)

            VStack(spacing: 14) {
                HStack(alignment: .center, spacing: 6) {
                    playerCard(me)
                        .offset(x: meSlammed ? 0 : -260)
                        .opacity(meSlammed ? 1 : 0)
                    VSLettering()
                        .scaleEffect(vsPopped ? 1 : 0.01)
                        .opacity(vsPopped ? 1 : 0)
                    playerCard(opp)
                        .offset(x: oppSlammed ? 0 : 260)
                        .opacity(oppSlammed ? 1 : 0)
                }

                // The bot's hello (kind, in character) or the head-to-head (known people).
                if let banter {
                    VSBanterBubble(line: banter, accent: oppAccent)
                        .offset(y: h2hShown ? 0 : 8)
                        .opacity(h2hShown ? 1 : 0)
                } else if opponent != nil, let h2h = headToHead {
                    Text(HeadToHeadService.headToHeadLine(opponentName: opp.username, h2h))
                        .font(Brand.font(12, .heavy)).foregroundStyle(subInk)
                        .multilineTextAlignment(.center)
                        .offset(y: h2hShown ? 0 : 8)
                        .opacity(h2hShown ? 1 : 0)
                }
            }
            .padding(.horizontal, 10).padding(.top, 8).padding(.bottom, 18)
        }
        .frame(maxWidth: 420)
        .vsTinted(accent, bar: purple ? VsLobbyKit.purpleBar : VsLobbyKit.tealBar, tint: 0.10, line: 0.3)
    }

    /// The opponent's own color (a cast bot's), else the window accent.
    private var oppAccent: Color {
        if let id = opponent?.botId { return VsLobbyKit.castColor(id) }
        return accent
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onDone()
    }

    private func playerCard(_ p: Player) -> some View {
        let m = VsLobbyKit.mascot(fromArt: p.botArt)
        return VStack(spacing: 7) {
            if let m {
                // A cast bot stands in character, ready to play.
                PoseImage(m, "ready", height: 96)
                    .frame(height: 96)
            } else {
                // Avatar + ring share one frame and are rasterized into a single
                // layer, so the ring can never drift off the photo mid-slam.
                ZStack {
                    VSPlayerAvatar(url: p.avatarUrl, username: p.username, botArt: p.botArt, size: 72)
                    // §20: rounded-square ring on a letter tile.
                    AvatarOutline(tile: p.botArt == nil && AvatarView.showsTile(p.avatarUrl)).strokeBorder(.white, lineWidth: 3)
                }
                .frame(width: 72, height: 72)
                .drawingGroup()
                .shadow(color: accent.opacity(0.22), radius: 6, x: 0, y: 3)
                .frame(height: 96)
            }
            Text(p.username.uppercased())
                .font(Brand.font(13, .black)).tracking(0.4).foregroundStyle(headInk)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let subtitle = p.subtitle {
                chip(subtitle, accent: m.map { VsLobbyKit.castColor($0) } ?? accent)
            } else if let level = p.level {
                chip("Lv \(level)", accent: accent)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func chip(_ text: String, accent: Color) -> some View {
        Text(text)
            .font(Brand.font(10, .black)).foregroundStyle(VsLobbyKit.titleInk)
            .lineLimit(1).minimumScaleFactor(0.7)
            .padding(.horizontal, 9).padding(.vertical, 3)
            .background(Capsule().fill(accent.wash(0.16)))
            .overlay(Capsule().stroke(accent.wash(0.4), lineWidth: 1))
    }
}

/// The versus card's VS lettering: white Nunito Black with the dark-purple outline
/// on a glossy pink → purple candy disc with the gold rim (§A8 look).
struct VSLettering: View {
    var size: CGFloat = 56

    var body: some View {
        ZStack(alignment: .top) {
            Circle().fill(Color(hex: 0x7A1679)).offset(y: 3)
            Circle().fill(LinearGradient(colors: [Color(hex: 0xF472B6), Color(hex: 0xA21CAF)], startPoint: .top, endPoint: .bottom))
            Circle().fill(LinearGradient(colors: [Color.white.opacity(0.45), Color.white.opacity(0)], startPoint: .top, endPoint: .bottom))
                .frame(width: size * 0.7, height: size * 0.45)
                .padding(.top, 3)
            Circle().strokeBorder(Color(hex: 0xF5C542), lineWidth: 2)
            OutlinedText(text: "VS", size: size * 0.42, width: 1.75)
                .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
        .shadow(color: Color(hex: 0x3B1A78).opacity(0.25), radius: 6, x: 0, y: 4)
        .accessibilityLabel("Versus")
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

/// Top toast for opponent milestone callouts ("<name> got 4 greens!") —
/// a soft white pill with a teal dot (VS polish spec §1), over the board.
struct VSCalloutPill: View {
    let text: String

    var body: some View {
        HStack(spacing: 7) {
            // §BI9: a glossy teal coin, not a plain dot.
            G5Coin(accent: VsLobbyKit.ink, glyph: "bolt.fill", size: 22)
            Text(text)
                .font(Brand.font(12, .black)).foregroundStyle(VsLobbyKit.titleInk)
                .lineLimit(2).multilineTextAlignment(.leading)
        }
        .padding(.leading, 8).padding(.trailing, 14).padding(.vertical, 7)
        // §A1 / §BI9: the calm candy pill — a soft teal wash, its rim and a bottom lip.
        .background(ZStack {
            Capsule().fill(VsLobbyKit.ink.wash(0.38)).offset(y: 2.5)
            Capsule().fill(LinearGradient(colors: [VsLobbyKit.ink.wash(0.06), VsLobbyKit.ink.wash(0.16)],
                                          startPoint: .top, endPoint: .bottom))
            Capsule().strokeBorder(VsLobbyKit.ink.wash(0.45), lineWidth: 1.5)
        })
        .padding(.horizontal, 24)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}
