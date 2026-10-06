import SwiftUI
import WordociousCore

// MARK: - BJ2 finish choreography

/// FINISH_SPEC BJ2 (founder 10-03 on 2.7 (241): "make the completion screens less
/// choppy"): one big thing animates at a time. The win card springs in, its tiles,
/// count-up, gloss and bob follow in turn; CONTINUE builds the finished screen under
/// the card and fades the card; the strip's headline pops once the card has left;
/// then the XP toast; then any achievement / level-up popup. The reveal + finish
/// hold (BI5) are unchanged — nothing here is faster than before, only ordered.
enum FinishMotion {
    /// The finished strip's headline waits for the win card's 0.25 s fade-out.
    static let afterCard: Double = 0.3
    /// The XP toast rises this long after the popups' hold lifts (the card is gone).
    static let xpAfterHold: Double = 0.45
    /// Achievement / level-up popups this long after the hold lifts.
    static let achievementsAfterHold: Double = 0.85
    /// Win card internals, from its spring-in: the answer tiles flip, the points
    /// count up, one gloss sweep, the sparkle, then the idle bob.
    static let tilesStart: Double = 0.25
    static let countStart: Double = 0.45
    static let sweepStart: Double = 0.9
    static let sparkleStart: Double = 1.15
    static let bobStart: Double = 1.2
    /// The finished screen starts building, hidden under the settled card (iOS only:
    /// SwiftUI builds a big recap on the main thread; Compose / the DOM don't need it).
    static let prebuildFinished: Double = 2.0
}

/// BJ2: the win / lose card's art (both moment letterings, every cast host at the
/// card's size) decoded into the display-size cache on a utility thread at launch,
/// so the card's first frame never decodes a 900-px image on the main thread.
enum FinishArt {
    static func prewarm() {
        var items: [(String, CGFloat)] = [(MomentArt.victory.assetName, 250), (MomentArt.soclose.assetName, 250)]
        for m in MascotID.allCases { items.append((m.assetName, 92)) }
        items.append((Mascots.loss.assetName, 84))
        ArtThumbs.prewarm(items)
    }
}

// MARK: - XP toast

/// Animated XP-earned toast shown after a game (ports effects/xp-toast.tsx):
/// purple gradient pill, "+N XP", bonus chips, and a level-up line.
/// Auto-dismisses after 3s.
struct XpToastView: View {
    let result: GameResultsService.XpResult
    var onDismiss: () -> Void
    @State private var shown = false
    @State private var scheduled = false
    /// BJ2: the toast waits while the win card holds the popups.
    @ObservedObject private var celebrations = AchievementUnlockCenter.shared

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
            // BJ2: the glow is the pill SHAPE's shadow (an opaque shape behind the pill),
            // not a shadow of the whole composited toast re-blurred every frame it moves.
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(hex: 0x7C3AED).wash(0.12))
                .shadow(color: Color(hex: 0x7C3AED).opacity(0.25), radius: 12, x: 0, y: 6))
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
            // BJ2: never under the win card — show now if nothing holds the popups,
            // else a beat after the card has gone (see FinishMotion).
            if !celebrations.isHeld { present(after: 0) }
            // §V3: crossing into a new tier gets the small level-up popup.
            if result.leveledUp, LevelTier.forLevel(result.newLevel) != LevelTier.forLevel(max(1, result.newLevel - 1)) {
                let level = result.newLevel
                Task { @MainActor in AchievementUnlockCenter.shared.enqueueLevelUp(newLevel: level) }
            }
        }
        .onChange(of: celebrations.isHeld) { held in
            if !held { present(after: FinishMotion.xpAfterHold) }
        }
    }

    private func present(after delay: Double) {
        guard !scheduled else { return }
        scheduled = true
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            withAnimation(Theme.animation(.easeOut(duration: 0.3))) { shown = true }
            // Level up: the jingle as "Level up!" shows (a tier-crossing level-up plays it on
            // its tier popup instead, so one level-up = one jingle).
            if result.leveledUp, LevelTier.forLevel(result.newLevel) == LevelTier.forLevel(max(1, result.newLevel - 1)) {
                Feedback.levelUp()
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
            // FINISH_SPEC §AU1: the card is centered vertically AND horizontally in the
            // safe area; a card taller than the space scrolls inside.
            GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    hostStage
                    lettering
                    // The tray's inner width: the card (≤ 400 less its 22-pt margins)
                    // less the card's 20-pt and the tray's 10-pt padding each side.
                    if !answers.isEmpty { answerTray(width: min(geo.size.width, 400) - 104) }
                    if let sol = solution, showDefinition { DefinitionCard(solution: sol, showWord: false) }
                    statChips
                    if let onPlayAgain {
                        // FINISH_SPEC §A8: the glossy candy button.
                        Button(action: onPlayAgain) {
                            CandyLabel(title: won ? "Play again" : "Try again", symbol: "arrow.clockwise")
                        }
                        .buttonStyle(CastButtonStyle(color: won ? nil : .pink, size: .medium, fullWidth: false))
                    }
                    if actions.isEmpty {
                        // §R1: a candy CONTINUE instead of "Tap anywhere to continue" (tap-anywhere still works).
                        Button(action: onDismiss) { CandyLabel(title: "Continue", symbol: "arrow.right") }
                            .buttonStyle(CastButtonStyle(color: won ? nil : .slate, size: .large))
                    } else {
                        HStack(spacing: 10) {
                            ForEach(actions.indices, id: \.self) { i in
                                let a = actions[i]
                                Button(action: a.action) { CandyLabel(title: a.label) }
                                    .buttonStyle(CastButtonStyle(color: a.primary ? nil : .slate, size: .medium))
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
                    // BJ2: the glow is the card SHAPE's shadow, drawn behind it — not a
                    // shadow of the whole composited card (host, tiles, chips), which
                    // re-blurred every frame of the spring-in and the tile flips.
                    .background(shape.fill(dark ? Theme.surface : Color(hex: 0xFFF8F1))
                        .shadow(color: accent.opacity(0.35), radius: 26, x: 0, y: 12))
                }
                .overlay(shape.stroke(dark ? accent.opacity(0.35) : accent.wash(0.28), lineWidth: 1.5))
                .padding(.horizontal, 22)
                .frame(maxWidth: 400)
                .padding(.vertical, 30)
                .frame(maxWidth: .infinity, minHeight: geo.size.height, alignment: .center)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if actions.isEmpty { onDismiss() } }
        .onAppear(perform: start)
        // BF2: achievement popups wait until this win / lose card closes.
        .holdsAchievementPopups("victory")
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
        withAnimation(Motion.spring) { hostIn = true }   // §AQ1 / §AZ: the shared spring
        // BJ2: the rays' turn and the host's bob are Core Animation loops (LoopArt).
        // BJ2: one beat at a time — the card lands, the tiles flip, the points count
        // up, then ONE gloss sweep across the lettering.
        DispatchQueue.main.asyncAfter(deadline: .now() + FinishMotion.sweepStart) {
            withAnimation(.easeInOut(duration: 0.8)) { sweep = 1.4 }
        }
        withAnimation(.easeOut(duration: 0.01)) { tilesIn = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + FinishMotion.countStart) {
            withAnimation(.easeOut(duration: 0.7)) { shownPoints = target }
        }
        // §U: the count-up ticks (≤ 12/s) while the points climb.
        if target > 0 {
            for k in 0..<8 {
                DispatchQueue.main.asyncAfter(deadline: .now() + FinishMotion.countStart + Double(k) / 12) { Feedback.tick() }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + FinishMotion.sparkleStart) {
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
                // BJ2: the masked rays drawn once into an image and turned by Core
                // Animation (24 s a turn) — a SwiftUI repeatForever re-rendered the whole
                // screen's display list every frame (the 8-board OctoWord recap included).
                LoopArt(image: LightRaysArt.image(color: UIColor(accent), alpha: 0.12, side: 170),
                        spinPeriod: 24)
                    .frame(width: 170, height: 170)
            }
            // §AZ: a soft gradient ground shadow — no live blur under the moving card.
            Ellipse().fill(RadialGradient(colors: [Color(hex: 0x3C1E6E).opacity(0.18), Color(hex: 0x3C1E6E).opacity(0)],
                                          center: .center, startRadius: 0, endRadius: size * 0.42))
                .frame(width: size * 0.9, height: size * 0.2)
                .offset(y: size * 0.5)
            // BJ2: the spring-in stays SwiftUI (one shot); the idle bob (4 pt, 1.6 s each
            // way, after the entrance beats) runs on Core Animation.
            LoopArt(image: ArtThumbs.uiImage(host.assetName, points: size) ?? UIImage(named: host.assetName),
                    bob: won && !calm ? 4 : 0, bobPeriod: 1.6, startDelay: FinishMotion.bobStart)
                .frame(width: size, height: size)
                .scaleEffect(hostIn ? 1 : 0.4)
                .opacity(hostIn ? 1 : 0)
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
    /// Founder 10-02: a phrase answer ("HUBBLE SPACE TELESCOPE") breaks into one row
    /// per word, and the tiles shrink (to a 12-pt floor) so the longest word always
    /// fits the tray — they used to run off both edges of the card.
    private func answerTray(width: CGFloat) -> some View {
        let multi = answers.count > 1
        let base: CGFloat = answers.count > 4 ? 17 : (multi ? 22 : 28)
        let rows = answers.map { FinishCloseScreen.answerRows($0.uppercased()) }
        let longest = rows.flatMap { $0 }.map(\.count).max() ?? 1
        let colWidth = multi ? (width - 8) / 2 : width
        let badge: CGFloat = multi && won ? base * 0.8 + 3 : 0
        let tile = CGFloat(FinishCloseScreen.fitTile(letters: longest, width: Double(max(0, colWidth)), gap: 3,
                                                     extra: Double(badge), maxTile: Double(base)))
        let face: GlossyFace = won ? .correct : .absent
        // Each word row's first letter index across all the answers (the flip stagger).
        var starts: [[Int]] = []
        var acc = 0
        for words in rows {
            var row: [Int] = []
            for w in words { row.append(acc); acc += w.count }
            starts.append(row)
        }
        return VStack(spacing: 6) {
            if !won {
                Text(answers.count > 1 ? "THE ANSWERS" : "THE ANSWER")
                    .font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(FinishInk.secondary)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: multi ? 2 : 1), spacing: 6) {
                ForEach(answers.indices, id: \.self) { i in
                    HStack(spacing: 3) {
                        VStack(spacing: 4) {
                            ForEach(rows[i].indices, id: \.self) { r in
                                HStack(spacing: 3) {
                                    ForEach(Array(rows[i][r].enumerated()), id: \.offset) { j, ch in
                                        // BJ2: one word flips in tile by tile; a multi-board tray
                                        // (up to 8 words, 40+ tiles) fades in as ONE layer instead
                                        // of 40 separate 3D flips (smooth over ornament).
                                        GlossyTile(face: face, letter: String(ch), width: tile)
                                            .rotation3DEffect(.degrees(tilesIn || multi ? 0 : 90), axis: (x: 1, y: 0, z: 0))
                                            .animation(still || multi ? nil : .easeOut(duration: 0.3).delay(FinishMotion.tilesStart + Double(starts[i][r] + j) * 0.04), value: tilesIn)
                                    }
                                }
                            }
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
        // BJ2: the multi-board tray is static once in — rendered as one layer.
        .modifier(MultiTrayEntrance(multi: multi, shown: tilesIn, still: still))
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

/// BJ2: a multi-board answer tray flattened to one raster that fades + settles in once
/// (opacity / scale only); a single answer keeps its per-tile flips.
private struct MultiTrayEntrance: ViewModifier {
    let multi: Bool
    let shown: Bool
    let still: Bool
    func body(content: Content) -> some View {
        if multi {
            content
                .drawingGroup()
                .opacity(shown ? 1 : 0)
                .scaleEffect(shown || still ? 1 : 0.96)
                .animation(still ? nil : .easeOut(duration: 0.3).delay(FinishMotion.tilesStart), value: shown)
        } else {
            content
        }
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

/// Twelve soft light rays from the center (the host's stage), faded out from the
/// center (radial mask 10 → half the side), drawn once per color into an image.
enum LightRaysArt {
    private static var cache: [String: UIImage] = [:]

    static func image(color: UIColor, alpha: CGFloat, side: CGFloat) -> UIImage {
        let key = "\(color.description)|\(alpha)|\(side)"
        if let hit = cache[key] { return hit }
        let img = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { r in
            let ctx = r.cgContext
            let c = CGPoint(x: side / 2, y: side / 2)
            let rad = side / 2
            ctx.setFillColor(color.withAlphaComponent(alpha).cgColor)
            for k in 0..<12 {
                let a = Double(k) / 12 * 2 * .pi
                ctx.move(to: c)
                ctx.addLine(to: CGPoint(x: c.x + rad * cos(a - 0.09), y: c.y + rad * sin(a - 0.09)))
                ctx.addLine(to: CGPoint(x: c.x + rad * cos(a + 0.09), y: c.y + rad * sin(a + 0.09)))
                ctx.closePath()
            }
            ctx.fillPath()
            // The radial fade (SwiftUI's mask: black → clear from 10 pt to the edge).
            let space = CGColorSpaceCreateDeviceRGB()
            if let g = CGGradient(colorsSpace: space, colors: [UIColor.black.cgColor, UIColor.black.withAlphaComponent(0).cgColor] as CFArray,
                                  locations: [0, 1]) {
                ctx.setBlendMode(.destinationIn)
                ctx.drawRadialGradient(g, startCenter: c, startRadius: 10, endCenter: c, endRadius: rad,
                                       options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            }
        }
        cache[key] = img
        return img
    }
}

/// FINISH_SPEC BJ2: an image whose idle loop — a spin, a bob, or a wobble — runs on
/// Core Animation in the render server. Measured: a SwiftUI `repeatForever` made
/// SwiftUI rebuild the whole screen's display list every frame (40–75% main thread
/// under / on the OctoWord finished screen); these loops cost the main thread nothing.
/// Nothing loops when the game is calm (Reduce Motion / Low Power, §AD) — pass 0s.
struct LoopArt: UIViewRepresentable {
    let image: UIImage?
    /// Seconds per full turn (0 = no spin).
    var spinPeriod: Double = 0
    /// Points the image rises at the top of its bob (0 = none), each way over `bobPeriod`.
    var bob: CGFloat = 0
    var bobPeriod: Double = 1.6
    /// ± degrees of the wobble (0 = none) with ± `wobbleShift` pt of vertical drift.
    var wobble: Double = 0
    var wobbleShift: CGFloat = 0
    var wobblePeriod: Double = 2.6
    var startDelay: Double = 0

    func makeUIView(context: Context) -> LoopArtView {
        let v = LoopArtView()
        v.isUserInteractionEnabled = false
        return v
    }

    func updateUIView(_ v: LoopArtView, context: Context) {
        v.imageView.image = image
        v.apply(self)
    }
}

final class LoopArtView: UIView {
    /// The drift (translation) host; the image inside it turns.
    private let drift = UIView()
    let imageView = UIImageView()
    private var applied: String?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        imageView.contentMode = .scaleAspectFit
        drift.addSubview(imageView)
        addSubview(drift)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func layoutSubviews() {
        super.layoutSubviews()
        drift.bounds = bounds
        drift.center = CGPoint(x: bounds.midX, y: bounds.midY)
        imageView.bounds = bounds
        imageView.center = CGPoint(x: bounds.midX, y: bounds.midY)
    }

    func apply(_ c: LoopArt) {
        let key = "\(c.spinPeriod)|\(c.bob)|\(c.bobPeriod)|\(c.wobble)|\(c.wobbleShift)|\(c.wobblePeriod)"
        guard key != applied else { return }
        applied = key
        drift.layer.removeAllAnimations()
        imageView.layer.removeAllAnimations()
        let begin = CACurrentMediaTime() + c.startDelay
        func loop(_ path: String, _ from: Double, _ to: Double, _ dur: Double, reverse: Bool, ease: Bool) -> CABasicAnimation {
            let a = CABasicAnimation(keyPath: path)
            a.fromValue = from
            a.toValue = to
            a.duration = dur
            a.autoreverses = reverse
            a.repeatCount = .infinity
            a.beginTime = begin
            a.fillMode = .backwards
            a.timingFunction = CAMediaTimingFunction(name: ease ? .easeInEaseOut : .linear)
            a.isRemovedOnCompletion = false
            return a
        }
        if c.spinPeriod > 0 {
            imageView.layer.add(loop("transform.rotation.z", 0, 2 * .pi, c.spinPeriod, reverse: false, ease: false), forKey: "spin")
        }
        if c.bob != 0 {
            drift.layer.add(loop("transform.translation.y", 0, -Double(c.bob), c.bobPeriod, reverse: true, ease: true), forKey: "bob")
        }
        if c.wobble != 0 {
            let r = c.wobble * .pi / 180
            imageView.layer.add(loop("transform.rotation.z", -r, r, c.wobblePeriod, reverse: true, ease: true), forKey: "wobble")
            if c.wobbleShift != 0 {
                drift.layer.add(loop("transform.translation.y", Double(c.wobbleShift), -Double(c.wobbleShift), c.wobblePeriod,
                                     reverse: true, ease: true), forKey: "drift")
            }
        }
    }
}

/// The confetti burst — port of web effects/confetti.tsx: 36 pieces (§AZ cap; halved
/// when calm), 12×12 rounded squares, 8-color palette, 0–0.5 s delays, 2–4 s LINEAR
/// falls with a 720° spin, fading out over the full height.
///
/// FINISH_SPEC BJ2 (measured): the pieces are Core Animation layers, each with ONE
/// animation group (fall + spin + fade) that runs in the render server. The old
/// SwiftUI version (36 animated views in a drawingGroup) re-rendered on the main
/// thread every frame — 86–95% main-thread time and ~12 fps under the win popup
/// for the whole 4.5 s burst. Same pieces, palette, spread and timing; zero
/// per-frame main-thread work.
struct ConfettiView: View {
    /// §AD: Low Power Mode (or Reduce Motion) halves the pieces.
    private let count = Motion.particles(36, calm: Motion.calm())

    var body: some View {
        ConfettiLayerView(count: count, still: Theme.reduceMotion)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// One burst, started the first time the view has a size.
private struct ConfettiLayerView: UIViewRepresentable {
    let count: Int
    let still: Bool

    func makeUIView(context: Context) -> ConfettiBurstView {
        let v = ConfettiBurstView()
        v.count = still ? 0 : count
        v.isUserInteractionEnabled = false
        v.backgroundColor = .clear
        return v
    }

    func updateUIView(_ uiView: ConfettiBurstView, context: Context) {}
}

final class ConfettiBurstView: UIView {
    var count = 36
    private var started = false

    private static func rgb(_ hex: Int) -> UIColor {
        let r = CGFloat((hex >> 16) & 0xFF) / 255
        let g = CGFloat((hex >> 8) & 0xFF) / 255
        let b = CGFloat(hex & 0xFF) / 255
        return UIColor(red: r, green: g, blue: b, alpha: 1)
    }
    private static let palette: [Int] = [0xFFD700, 0xFF6B9D, 0xC084FC, 0x60A5FA, 0x34D399, 0xFBBF24, 0xF97316, 0xEC4899]
    private static let colors: [UIColor] = palette.map(rgb)

    /// Deterministic spread per piece (the web's Math.random() ranges, no churn).
    static func piece(_ i: Int) -> (x: CGFloat, delay: Double, duration: Double, color: Int) {
        (CGFloat((i * 37 + 11) % 100) / 100,
         Double((i * 13) % 100) / 100 * 0.5,
         2.0 + Double((i * 29) % 100) / 100 * 2.0,
         (i * 7) % colors.count)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard !started, bounds.width > 0, bounds.height > 0, count > 0 else { return }
        started = true
        burst()
    }

    private func burst() {
        let w = bounds.width, h = bounds.height
        let now = CACurrentMediaTime()
        var longest = 0.0
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for i in 0..<count {
            let p = Self.piece(i)
            let layer = CALayer()
            layer.bounds = CGRect(x: 0, y: 0, width: 12, height: 12)
            layer.cornerRadius = 2
            layer.backgroundColor = Self.colors[p.color].cgColor
            layer.position = CGPoint(x: w * p.x, y: -20)
            // The model ends where the burst ends (off the bottom, clear).
            layer.opacity = 0

            let fall = CABasicAnimation(keyPath: "position.y")
            fall.fromValue = -20
            fall.toValue = h + 20
            let spin = CABasicAnimation(keyPath: "transform.rotation.z")
            spin.fromValue = 0
            spin.toValue = 4 * Double.pi
            let fade = CABasicAnimation(keyPath: "opacity")
            fade.fromValue = 1
            fade.toValue = 0
            let group = CAAnimationGroup()
            group.animations = [fall, spin, fade]
            group.duration = p.duration
            group.beginTime = now + p.delay
            group.timingFunction = CAMediaTimingFunction(name: .linear)
            group.fillMode = .both
            group.isRemovedOnCompletion = false
            layer.position.y = h + 20
            layer.add(group, forKey: "fall")
            self.layer.addSublayer(layer)
            longest = max(longest, p.delay + p.duration)
        }
        CATransaction.commit()
        // Drop the spent pieces once the last one has landed.
        DispatchQueue.main.asyncAfter(deadline: .now() + longest + 0.1) { [weak self] in
            self?.layer.sublayers?.forEach { $0.removeFromSuperlayer() }
        }
    }
}
