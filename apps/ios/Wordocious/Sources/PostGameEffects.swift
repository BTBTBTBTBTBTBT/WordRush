import SwiftUI
import WordociousCore

// MARK: - XP toast

/// Animated XP-earned toast shown after a game (ports effects/xp-toast.tsx):
/// purple gradient pill, "+N XP", bonus chips, and a level-up line.
/// Auto-dismisses after 3s.
struct XpToastView: View {
    let result: GameResultsService.XpResult
    var onDismiss: () -> Void
    @State private var shown = false

    var body: some View {
        VStack {
            HStack(spacing: 12) {
                // FINISH_SPEC §A1 / §A2: a tinted pill, the XP as a soft number.
                Icon3D(.trophy, size: 26)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text("+\(result.totalXp)").softNumber(18)
                        Text("XP").font(Brand.font(11, .black)).foregroundStyle(A11yInk.on(Color(hex: 0x6D28D9)))
                    }
                    HStack(spacing: 8) {
                        if result.streakBonus > 0 {
                            Text("+\(result.streakBonus) streak").font(Brand.font(10, .bold)).foregroundStyle(A11yInk.on(Color(hex: 0x6D28D9)))
                        }
                        if result.dailyBonus > 0 {
                            Text("+\(result.dailyBonus) daily").font(Brand.font(10, .bold)).foregroundStyle(A11yInk.on(Color(hex: 0x6D28D9)))
                        }
                        // Web parity: distinct sweep (pink) / flawless (gold) chips.
                        if result.sweepBonus > 0 {
                            Text("+\(result.sweepBonus) sweep").font(Brand.font(10, .bold)).foregroundStyle(A11yInk.on(Color(hex: 0xBE185D)))
                        }
                        if result.flawlessBonus > 0 {
                            // §244: a live streak outranks the raw bonus number.
                            Text(result.flawlessStreak >= 2 ? "FLAWLESS ×\(result.flawlessStreak)" : "+\(result.flawlessBonus) flawless")
                                .font(Brand.font(10, .black)).foregroundStyle(A11yInk.on(Color(hex: 0xB45309)))
                        }
                    }
                    if result.leveledUp {
                        // §V3: the new tier badge + level in soft numbers.
                        HStack(spacing: 5) {
                            Text("Level up!").font(Brand.font(10, .black)).foregroundStyle(A11yInk.on(Color(hex: 0xB45309)))
                            LevelBadge(level: result.newLevel, size: 18)
                        }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 10)
            .tintedPill(Color(hex: 0x7C3AED), radius: 18)
            .shadow(color: Color(hex: 0x7C3AED).opacity(0.25), radius: 12, x: 0, y: 6)
            // Web parity: fade-in-up — rise 8px with a 300ms ease-out fade
            // (xp-toast.tsx), not a springy drop from above.
            .offset(y: shown ? 0 : 8)
            .opacity(shown ? 1 : 0)
            Spacer()
        }
        .padding(.top, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .allowsHitTesting(false)
        .onAppear {
            withAnimation(Theme.animation(.easeOut(duration: 0.3))) { shown = true }
            // §V3: crossing into a new tier gets the small level-up popup.
            if result.leveledUp, LevelTier.forLevel(result.newLevel) != LevelTier.forLevel(max(1, result.newLevel - 1)) {
                let level = result.newLevel
                Task { @MainActor in AchievementUnlockCenter.shared.enqueueLevelUp(newLevel: level) }
            }
            // Web parity: stretch 3s → 5s when a sweep/flawless bonus fired so the
            // bigger payout is actually readable.
            let dwell: Double = (result.sweepBonus + result.flawlessBonus) > 0 ? 5 : 3
            DispatchQueue.main.asyncAfter(deadline: .now() + dwell) {
                withAnimation(Theme.animation(.easeIn(duration: 0.3))) { shown = false }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { onDismiss() }
            }
        }
    }
}

// MARK: - Victory overlay

/// Celebration overlay on a win (ports effects/victory-animation.tsx): confetti,
/// gradient "VICTORY!", the solution word(s), optional definition, and stats.
/// Tap anywhere to dismiss.
/// One button on the victory card (see `VictoryOverlay.actions`).
struct VictoryAction {
    let label: String
    var primary = false
    let action: () -> Void
}

struct VictoryOverlay: View {
    let won: Bool
    let guesses: Int
    let maxGuesses: Int
    let timeSeconds: Int
    let boardsSolved: Int
    let totalBoards: Int
    /// Single-board solution (drives the definition lookup); nil for multi-board.
    let solution: String?
    /// Multi-board solutions (shown as a word grid); empty for single board.
    let solutions: [String]
    /// ProperNoundle answers are proper nouns (not in the dictionary) — its
    /// Wikipedia clue/photo stands in for the definition, so skip the card.
    var showDefinition = true
    /// The stat under the count — "GUESSES" for word modes; mistake-scored
    /// modes (Sudoku, Starsweep) pass "MISTAKES" (founder: "1 guesses is
    /// confusing" on the first Sudoku win, 2026-09-22).
    var statLabel = "GUESSES"
    /// Composite score of the run — a third stat on the card (founder,
    /// 2026-09-22: the points are the number players care about).
    var points: Int? = nil
    /// §242 (founder: "go right into the next game without going back"): a
    /// Play/Try-again button on the card itself. Callers pass it ONLY on
    /// unlimited (non-daily) games — same gate as the finished screen's button.
    var onPlayAgain: (() -> Void)? = nil
    /// Hubbub (founder, 2026-09-28): explicit choices on the card instead of
    /// tap-anywhere — "Keep playing" / "I'm done". When non-empty the card no
    /// longer dismisses on a background tap; every other game passes nothing.
    var actions: [VictoryAction] = []
    /// The game on screen (MASCOT_SPEC §3/§5): on a win its host pops in above
    /// VICTORY (a cast member seeded by the day + game when it has none); a loss
    /// shows R, static.
    var game: GameMode? = nil
    var onDismiss: () -> Void

    private var winHost: MascotID {
        game.flatMap { Mascots.host($0) } ?? Mascots.dailyPick(salt: game?.rawValue ?? "victory")
    }

    private var isMulti: Bool { totalBoards > 1 }
    /// "35:17", not "35m 17s" — the long form wrapped inside the stat cell on a
    /// long Hubbub session (founder, 2026-09-28).
    private var timeStr: String { timeSeconds < 60 ? "\(timeSeconds)s" : "\(timeSeconds / 60):\(String(format: "%02d", timeSeconds % 60))" }

    // MARK: FINISH_SPEC §R1 — the shared win / lose popup for every game

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var hostIn = false
    @State private var bob = false
    @State private var raysTurn = false
    @State private var sweep: CGFloat = -1
    @State private var tilesIn = false
    @State private var shownPoints: Double = 0
    @State private var sparkle = false
    @ObservedObject private var power = PowerMode.shared

    private var still: Bool { envReduce || Theme.reduceMotion }
    /// §AD: Low Power Mode (or Reduce Motion) stops the turning rays and the bob.
    private var calm: Bool { Motion.calm(envReduce) }
    /// The game's accent (purple when the caller names no game).
    private var accent: Color { game.map { ModeStyle.accent($0) } ?? Color(hex: 0x7C3AED) }
    private var answers: [String] { solution.map { [$0] } ?? solutions }

    var body: some View {
        let dark = Theme.isDark
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        ZStack {
            Color(hex: 0x18182E).opacity(0.6).ignoresSafeArea()
            // §R1: one confetti burst on a win (not looping); none with Reduce Motion.
            if won && !still { ConfettiView() }
            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    hostStage
                    lettering
                    if !answers.isEmpty { answerTray }
                    if let sol = solution, showDefinition { DefinitionCard(solution: sol, showWord: false) }
                    statChips
                    if let onPlayAgain {
                        // FINISH_SPEC §A8: the glossy candy button.
                        Button(action: onPlayAgain) {
                            CandyLabel(title: won ? "Play again" : "Try again", symbol: "arrow.clockwise")
                        }
                        .buttonStyle(CandyButtonStyle(variant: won ? .purple : .pink, size: .medium, fullWidth: false))
                    }
                    if actions.isEmpty {
                        // §R1: a candy CONTINUE instead of "Tap anywhere to continue" (tap-anywhere still works).
                        Button(action: onDismiss) { CandyLabel(title: "Continue", symbol: "arrow.right") }
                            .buttonStyle(CandyButtonStyle(variant: won ? .purple : .peach, size: .large))
                    } else {
                        HStack(spacing: 10) {
                            ForEach(actions.indices, id: \.self) { i in
                                let a = actions[i]
                                Button(action: a.action) { CandyLabel(title: a.label) }
                                    .buttonStyle(CandyButtonStyle(variant: a.primary ? .purple : .peach, size: .medium))
                            }
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 18)
                .background {
                    // §R1: no near-white — the accent at ~10% → ~4% over warm cream (dark: a deep accent tint).
                    ZStack(alignment: .top) {
                        if dark {
                            shape.fill(Theme.surface)
                            shape.fill(LinearGradient(colors: [accent.opacity(0.22), accent.opacity(0.08)], startPoint: .top, endPoint: .bottom))
                        } else {
                            shape.fill(LinearGradient(colors: [accent.mixed(over: Color(hex: 0xFFF8F1), 0.10),
                                                               accent.mixed(over: Color(hex: 0xFFF8F1), 0.04)],
                                                      startPoint: .top, endPoint: .bottom))
                        }
                        LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                                       startPoint: .leading, endPoint: .trailing)
                            .frame(height: 8)
                    }
                    .clipShape(shape)
                }
                .overlay(shape.stroke(dark ? accent.opacity(0.35) : accent.wash(0.28), lineWidth: 1.5))
                .shadow(color: accent.opacity(0.35), radius: 26, x: 0, y: 12)
                .padding(.horizontal, 22)
                .frame(maxWidth: 400)
                .padding(.vertical, 30)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .contentShape(Rectangle())
        .onTapGesture { if actions.isEmpty { onDismiss() } }
        .onAppear(perform: start)
        // No haptic here: the game screen already fires Haptics.success/error at
        // the moment of finishing — the old unconditional success() buzzed a
        // CELEBRATION haptic on losses too.
    }

    private func start() {
        let target = Double(points ?? 0)
        if still {
            hostIn = true; tilesIn = true; shownPoints = target
            return
        }
        withAnimation(.spring(response: 0.36, dampingFraction: 0.6)) { hostIn = true }   // §AQ1: faster
        if !calm {
            withAnimation(.linear(duration: 24).repeatForever(autoreverses: false)) { raysTurn = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { bob = true }
            }
        }
        // The lettering lands, then one gloss sweep 0.4 s later.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(.easeInOut(duration: 0.8)) { sweep = 1.4 }
        }
        withAnimation(.easeOut(duration: 0.01)) { tilesIn = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.easeOut(duration: 0.7)) { shownPoints = target }
        }
        // §U: the count-up ticks (≤ 12/s) while the points climb.
        if target > 0 {
            for k in 0..<8 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3 + Double(k) / 12) { Feedback.tick() }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            guard points != nil else { return }
            withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { sparkle = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { withAnimation(.easeOut(duration: 0.3)) { sparkle = false } }
        }
    }

    /// §R1: the host on a stage — a soft radial glow, slow-turning light rays (accent,
    /// 12%, 24 s a turn), a ground shadow, a spring-in with a 1.06 overshoot, then a bob.
    private var hostStage: some View {
        let host = won ? winHost : Mascots.loss
        let size: CGFloat = won ? 92 : 84
        return ZStack {
            RadialGradient(colors: [accent.opacity(0.30), accent.opacity(0)], center: .center, startRadius: 4, endRadius: 80)
                .frame(width: 170, height: 150)
            if !calm {
                LightRays(color: accent.opacity(0.12))
                    .frame(width: 170, height: 170)
                    .rotationEffect(.degrees(raysTurn ? 360 : 0))
                    .mask(RadialGradient(colors: [.black, .clear], center: .center, startRadius: 10, endRadius: 85))
            }
            Ellipse().fill(Color(hex: 0x3C1E6E).opacity(0.16))
                .frame(width: size * 0.8, height: size * 0.16)
                .blur(radius: 4)
                .offset(y: size * 0.5)
            MascotView(host, size: size)
                .scaleEffect(hostIn ? 1 : 0.4)
                .opacity(hostIn ? 1 : 0)
                .offset(y: bob && !calm ? -4 : 0)
        }
        .frame(height: 130)
        .accessibilityHidden(true)
    }

    /// The moment lettering with ONE gloss sweep across it after it lands.
    private var lettering: some View {
        let art = MomentLettering(won ? .victory : .soclose) {
            Text(won ? "VICTORY!" : "GAME OVER")
                .font(Brand.font(36, .black))
                .foregroundStyle(won
                    ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)], startPoint: .leading, endPoint: .trailing))
                    : AnyShapeStyle(Color(hex: 0xF87171)))
        }
        return art.overlay {
            if !still {
                GeometryReader { g in
                    LinearGradient(colors: [.white.opacity(0), .white.opacity(0.7), .white.opacity(0)], startPoint: .leading, endPoint: .trailing)
                        .frame(width: g.size.width * 0.35)
                        .offset(x: sweep * g.size.width)
                }
                .mask(art)
                .allowsHitTesting(false)
            }
        }
    }

    /// §R1: the answers on small glossy tiles in a tinted inner tray (no border),
    /// one word per row (multi-board: two columns, each with a check badge),
    /// flipping in left → right 40 ms apart. A loss shows them on slate with a label.
    private var answerTray: some View {
        let multi = answers.count > 1
        let tile: CGFloat = answers.count > 4 ? 17 : (multi ? 22 : 28)
        let face: GlossyFace = won ? .correct : .absent
        var offsets: [Int] = []
        var acc = 0
        for w in answers { offsets.append(acc); acc += w.count }
        return VStack(spacing: 6) {
            if !won {
                Text(answers.count > 1 ? "THE ANSWERS" : "THE ANSWER")
                    .font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(FinishInk.secondary)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: multi ? 2 : 1), spacing: 6) {
                ForEach(answers.indices, id: \.self) { i in
                    HStack(spacing: 3) {
                        ForEach(Array(answers[i].uppercased().enumerated()), id: \.offset) { j, ch in
                            GlossyTile(face: face, letter: String(ch), width: tile)
                                .rotation3DEffect(.degrees(tilesIn ? 0 : 90), axis: (x: 1, y: 0, z: 0))
                                .animation(still ? nil : .easeOut(duration: 0.3).delay(Double(offsets[i] + j) * 0.04), value: tilesIn)
                        }
                        if multi && won { Icon3D(.badgeCheck, size: tile * 0.8, label: "Solved") }
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(answers[i])
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(Theme.isDark ? accent.opacity(0.14) : accent.wash(0.08)))
    }

    /// §R1: stat chips — each a tinted pill with a small glyph, the value in soft
    /// numbers and a small caps label; POINTS (gold) counts up over 700 ms with a sparkle.
    private var statChips: some View {
        HStack(spacing: 6) {
            if isMulti { chip("square.grid.2x2.fill", "\(boardsSolved)/\(totalBoards)", "BOARDS", accent) }
            chip("scope", maxGuesses > 0 ? "\(guesses)/\(maxGuesses)" : "\(guesses)", statLabel, accent)
            chip("clock.fill", timeStr, "TIME", accent)
            if let points {
                VStack(spacing: 1) {
                    Image(systemName: "star.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: 0xF5A524))
                        .scaleEffect(sparkle ? 1.5 : 1)
                    Text("\(Int(shownPoints.rounded()))")
                        .modifier(CountUpText(value: shownPoints))
                        .softNumber(18).lineLimit(1).minimumScaleFactor(0.6)
                    Text("POINTS").font(Brand.font(9, .black)).tracking(0.8).foregroundStyle(FinishInk.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7).padding(.horizontal, 3)
                .tintedPill(Color(hex: 0xF5A524), radius: 12)
                .overlay(alignment: .topTrailing) {
                    if sparkle { Image(systemName: "sparkles").font(.system(size: 12, weight: .bold)).foregroundStyle(Color(hex: 0xF5A524)).offset(x: 2, y: -4) }
                }
                .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            (isMulti ? "\(boardsSolved) of \(totalBoards) boards solved. " : "")
            + "\(guesses)\(maxGuesses > 0 ? " of \(maxGuesses)" : "") \(statLabel.lowercased()). Time \(timeStr)"
            + (points.map { ". \($0) points" } ?? ""))
    }

    private func chip(_ glyph: String, _ value: String, _ label: String, _ c: Color) -> some View {
        VStack(spacing: 1) {
            Image(systemName: glyph).font(.system(size: 11, weight: .bold)).foregroundStyle(c)
            Text(value).softNumber(18).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(Brand.font(9, .black)).tracking(0.8).foregroundStyle(FinishInk.secondary)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 7).padding(.horizontal, 3)
        .tintedPill(c, radius: 12)
    }
}

/// The POINTS count-up: re-renders the number as `value` animates (§R1).
private struct CountUpText: AnimatableModifier {
    var value: Double
    var animatableData: Double {
        get { value }
        set { value = newValue }
    }
    func body(content: Content) -> some View {
        Text(Int(value.rounded()).formatted(.number.grouping(.automatic)))
    }
}

/// Twelve soft light rays from the center (the host's stage).
private struct LightRays: View {
    let color: Color
    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let r = max(size.width, size.height) / 2
            for k in 0..<12 {
                let a = Double(k) / 12 * 2 * .pi
                var p = Path()
                p.move(to: c)
                p.addLine(to: CGPoint(x: c.x + r * cos(a - 0.09), y: c.y + r * sin(a - 0.09)))
                p.addLine(to: CGPoint(x: c.x + r * cos(a + 0.09), y: c.y + r * sin(a + 0.09)))
                p.closeSubpath()
                ctx.fill(p, with: .color(color))
            }
        }
    }
}

/// Lightweight confetti — pure SwiftUI port of web effects/confetti.tsx:
/// 50 pieces, 12×12 rounded squares, 8-color palette, random 0–0.5s delay,
/// 2–4s LINEAR fall with 720° spin, fading out over the full height.
struct ConfettiView: View {
    private static let colors = [Color(hex: 0xFFD700), Color(hex: 0xFF6B9D), Color(hex: 0xC084FC),
                                 Color(hex: 0x60A5FA), Color(hex: 0x34D399), Color(hex: 0xFBBF24),
                                 Color(hex: 0xF97316), Color(hex: 0xEC4899)]
    @State private var animate = false
    /// §AD: Low Power Mode (or Reduce Motion) halves the pieces.
    private let count = Motion.particles(50, calm: Motion.calm())

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(0..<count, id: \.self) { i in
                    // Deterministic pseudo-random spread per piece (matches the
                    // web's Math.random() ranges without per-render churn).
                    let startX = geo.size.width * CGFloat((i * 37 + 11) % 100) / 100
                    let delay = Double((i * 13) % 100) / 100 * 0.5
                    let duration = 2.0 + Double((i * 29) % 100) / 100 * 2.0
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Self.colors[(i * 7) % Self.colors.count])
                        .frame(width: 12, height: 12)
                        .rotationEffect(.degrees(animate ? 720 : 0))
                        .position(x: startX, y: animate ? geo.size.height + 20 : -20)
                        .opacity(animate ? 0 : 1)
                        .animation(Theme.animation(.linear(duration: duration).delay(delay)), value: animate)
                }
            }
        }
        .allowsHitTesting(false)
        .onAppear { animate = true }
    }
}
