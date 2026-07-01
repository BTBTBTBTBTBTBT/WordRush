import SwiftUI
import WordociousCore

/// Full-screen 2.5s match-intro splash shown when a match is found — ports
/// apps/web/components/vs/match-intro.tsx. Both avatar cards slam in from
/// opposite sides with overshoot, a rotated gradient "VS" pops in, the
/// head-to-head line fades up. Skippable on tap. Anonymous opponents render
/// as "Anonymous" with the initials avatar and no head-to-head line.
struct VSMatchIntroView: View {
    struct Player {
        let username: String
        let avatarUrl: String?
        let level: Int?
    }

    let me: Player
    /// nil = anonymous opponent (no userId from the server).
    let opponent: Player?
    /// nil while loading or when the opponent is anonymous.
    let headToHead: HeadToHeadRecord?
    let onDone: () -> Void

    // Staggered slam — the two cards clash a beat apart rather than landing
    // simultaneously, which reads more fluid than a single hard snap.
    @State private var meSlammed = false
    @State private var oppSlammed = false
    @State private var vsPopped = false
    @State private var h2hShown = false
    @State private var finished = false

    private var opp: Player { opponent ?? Player(username: "Anonymous", avatarUrl: nil, level: nil) }

    var body: some View {
        ZStack {
            // Finished-looking backdrop (a deep radial vignette) rather than flat black.
            RadialGradient(colors: [Color(hex: 0x1E1B3A).opacity(0.96), Color.black.opacity(0.92)],
                           center: .center, startRadius: 60, endRadius: 520)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                HStack(spacing: 12) {
                    playerCard(me)
                        .offset(x: meSlammed ? 0 : -320)
                        .opacity(meSlammed ? 1 : 0)
                    Text("VS")
                        .font(Brand.font(48, .black))
                        .foregroundStyle(LinearGradient(
                            colors: [Color(hex: 0xFACC15), Color(hex: 0xEC4899), Color(hex: 0xA855F7)],
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                        .rotationEffect(.degrees(-12))
                        .scaleEffect(vsPopped ? 1 : 0.01)
                        .opacity(vsPopped ? 1 : 0)
                    playerCard(opp)
                        .offset(x: oppSlammed ? 0 : 320)
                        .opacity(oppSlammed ? 1 : 0)
                }

                // Head-to-head line (known opponents only).
                if opponent != nil, let h2h = headToHead {
                    Text(HeadToHeadService.headToHeadLine(opponentName: opp.username, h2h))
                        .font(Brand.font(14, .heavy))
                        .foregroundStyle(.white.opacity(0.9))
                        .offset(y: h2hShown ? 0 : 10)
                        .opacity(h2hShown ? 1 : 0)
                }

                Text("TAP TO SKIP")
                    .font(Brand.font(10, .bold)).tracking(2)
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(.horizontal, 24)
        }
        .contentShape(Rectangle())
        .onTapGesture { finish() }
        .onAppear {
            SoundManager.shared.playVsStinger()
            // Slam-in with a softer, slower overshoot than before (response .5 →
            // .72, damping .6 → .72) so the clash glides in instead of snapping.
            // The two cards land a beat apart (opponent +0.12s) for a duel feel.
            let slam = Animation.spring(response: 0.72, dampingFraction: 0.72)
            withAnimation(Theme.animation(slam)) { meSlammed = true }
            withAnimation(Theme.animation(slam.delay(0.12))) { oppSlammed = true }
            // "VS" pops once both cards have mostly landed (0.5s), gentler bounce.
            withAnimation(Theme.animation(.spring(response: 0.5, dampingFraction: 0.58).delay(0.5))) { vsPopped = true }
            // Head-to-head fades up after the VS settles.
            withAnimation(Theme.animation(.easeOut(duration: 0.45).delay(0.85))) { h2hShown = true }
            // Auto-finish after 2.5s (keeps the countdown beat before match start).
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { finish() }
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onDone()
    }

    private func playerCard(_ p: Player) -> some View {
        VStack(spacing: 8) {
            // Avatar + ring share one 72×72 frame and are rasterized into a single
            // layer, so the ring can never drift off the photo or lag behind it
            // during the spring slam (they used to composite as separate GPU layers
            // and visibly detached mid-animation).
            ZStack {
                AvatarView(url: p.avatarUrl, username: p.username, size: 72)
                Circle().strokeBorder(.white.opacity(0.4), lineWidth: 2)
            }
            .frame(width: 72, height: 72)
            .drawingGroup()
            Text(p.username)
                .font(Brand.font(14, .black)).foregroundStyle(.white)
                .lineLimit(1)
            if let level = p.level {
                Text("Lv \(level)")
                    .font(Brand.font(10, .heavy)).foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(Capsule().fill(.white.opacity(0.15)))
                    .overlay(Capsule().stroke(.white.opacity(0.25), lineWidth: 1))
            }
        }
        .frame(width: 110)
    }
}

/// Persistent in-match header: you on the left, opponent on the right, and a
/// tug-of-war bar in the middle that fills toward whoever is ahead (purple =
/// you, pink = them). A crown marks the leading side. Ports vs-match-header.tsx.
struct VSMatchHeaderBar: View {
    struct PlayerBits {
        let username: String
        let avatarUrl: String?
        let guesses: Int
        /// Normalized 0..1 lead metric — VSModeInfo.progress.
        let progress: Double
    }

    let me: PlayerBits
    let opponent: PlayerBits
    let opponentTyping: Bool

    var body: some View {
        // Boundary position: 50% when even; shifts by half the progress delta,
        // clamped so neither color ever fully disappears.
        let myShare = min(0.9, max(0.1, 0.5 + (me.progress - opponent.progress) / 2))
        let iLead = me.progress > opponent.progress + 0.001
        let theyLead = opponent.progress > me.progress + 0.001

        VStack(spacing: 6) {
            HStack(spacing: 8) {
                // You
                HStack(spacing: 6) {
                    headerAvatar(me)
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 4) {
                            Text(me.username).font(Brand.font(11, .heavy))
                                .foregroundStyle(Theme.textPrimary).lineLimit(1)
                            if iLead { crown }
                        }
                        Text("\(me.guesses) \(me.guesses == 1 ? "guess" : "guesses")")
                            .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Opponent
                HStack(spacing: 6) {
                    VStack(alignment: .trailing, spacing: 0) {
                        HStack(spacing: 4) {
                            if theyLead { crown }
                            Text(opponent.username).font(Brand.font(11, .heavy))
                                .foregroundStyle(Theme.textPrimary).lineLimit(1)
                        }
                        Text("\(opponent.guesses) \(opponent.guesses == 1 ? "guess" : "guesses")")
                            .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    headerAvatar(opponent)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }

            // Tug-of-war bar
            GeometryReader { geo in
                HStack(spacing: 0) {
                    LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)],
                                   startPoint: .leading, endPoint: .trailing)
                        .frame(width: geo.size.width * myShare)
                    LinearGradient(colors: [Color(hex: 0xEC4899), Color(hex: 0xF472B6)],
                                   startPoint: .leading, endPoint: .trailing)
                }
                .clipShape(Capsule())
                .animation(Theme.animation(.easeInOut(duration: 0.5)), value: myShare)
            }
            .frame(height: 8)

            // Typing indicator — the row's height is ALWAYS reserved (content just
            // fades in/out) so the header, and every board below it, never shift
            // when the opponent starts/stops typing.
            HStack(spacing: 4) {
                Spacer()
                Text("\(opponent.username) is typing")
                    .font(Brand.font(9, .bold)).foregroundStyle(Color(hex: 0xEC4899))
                TypingDots()
            }
            .frame(height: 12)
            .opacity(opponentTyping ? 1 : 0)
            .animation(Theme.animation(.easeInOut(duration: 0.2)), value: opponentTyping)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }

    private var crown: some View {
        Image(systemName: "crown.fill").font(.system(size: 10))
            .foregroundStyle(Color(hex: 0xF59E0B))
    }

    private func headerAvatar(_ p: PlayerBits) -> some View {
        AvatarView(url: p.avatarUrl, username: p.username, size: 28)
            .overlay(Circle().strokeBorder(Theme.border, lineWidth: 1.5))
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
/// purple→pink gradient pill, ports the vs-game.tsx callout span.
struct VSCalloutPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Brand.font(12, .heavy)).foregroundStyle(.white)
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(Capsule().fill(LinearGradient(
                colors: [Color(hex: 0x9333EA), Color(hex: 0xDB2777)],
                startPoint: .leading, endPoint: .trailing)))
            .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
            .transition(.move(edge: .top).combined(with: .opacity))
    }
}
