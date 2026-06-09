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
                Image(systemName: "star.fill").font(.system(size: 18)).foregroundStyle(Color(hex: 0xFDE047))
                VStack(alignment: .leading, spacing: 2) {
                    Text("+\(result.totalXp) XP").font(Brand.font(15, .black)).foregroundStyle(.white)
                    HStack(spacing: 8) {
                        if result.streakBonus > 0 {
                            Text("+\(result.streakBonus) streak").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xDDD6FE))
                        }
                        if result.dailyBonus > 0 {
                            Text("+\(result.dailyBonus) daily").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xDDD6FE))
                        }
                        // Web parity: distinct sweep (pink) / flawless (yellow) chips.
                        if result.sweepBonus > 0 {
                            Text("+\(result.sweepBonus) sweep").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xFBCFE8))
                        }
                        if result.flawlessBonus > 0 {
                            Text("+\(result.flawlessBonus) flawless").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xFDE047))
                        }
                    }
                    if result.leveledUp {
                        Text("Level up! Lv.\(result.newLevel)").font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0xFDE047))
                    }
                }
            }
            .padding(.horizontal, 18).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 18).fill(
                LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .shadow(color: Color(hex: 0x7C3AED).opacity(0.35), radius: 16, x: 0, y: 8)
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
    var onDismiss: () -> Void

    private var isMulti: Bool { totalBoards > 1 }
    private var timeStr: String { timeSeconds < 60 ? "\(timeSeconds)s" : "\(timeSeconds / 60)m \(timeSeconds % 60)s" }

    var body: some View {
        ZStack {
            Color(hex: 0x18182E).opacity(0.6).ignoresSafeArea()
            // Confetti is a WIN-only celebration — web losses show a quiet
            // fade-in card (game-over-animation.tsx) with no confetti.
            if won { ConfettiView() }
            VStack(spacing: 0) {
                LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)],
                               startPoint: .leading, endPoint: .trailing).frame(height: 6)
                VStack(spacing: 12) {
                    Text(won ? "VICTORY!" : "GAME OVER")
                        .font(Brand.font(36, .black))
                        .foregroundStyle(won
                            ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)], startPoint: .leading, endPoint: .trailing))
                            : AnyShapeStyle(Color(hex: 0xF87171)))

                    if let sol = solution {
                        Text(sol.uppercased()).font(Brand.font(22, .black)).tracking(2).foregroundStyle(Theme.textPrimary)
                        DefinitionCard(solution: sol, showWord: false)
                    } else if !solutions.isEmpty {
                        let cols = solutions.count > 4 ? 4 : 2
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: cols), spacing: 6) {
                            ForEach(solutions.indices, id: \.self) { i in
                                Text(solutions[i].uppercased())
                                    .font(Brand.font(solutions.count > 8 ? 13 : 16, .black)).tracking(1)
                                    .foregroundStyle(Theme.textPrimary)
                            }
                        }
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }

                    HStack(spacing: 20) {
                        if isMulti {
                            statBlock("\(boardsSolved)/\(totalBoards)", "BOARDS")
                        }
                        statBlock(maxGuesses > 0 ? "\(guesses)/\(maxGuesses)" : "\(guesses)", "GUESSES")
                        statBlock(timeStr, "TIME")
                    }
                    .padding(.top, 4)

                    Text("Tap anywhere to continue").font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0xC4B5FD)).padding(.top, 4)
                }
                .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 18)
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.18), radius: 30, x: 0, y: 20)
            .padding(.horizontal, 24)
            .frame(maxWidth: 380)
        }
        .contentShape(Rectangle())
        .onTapGesture { onDismiss() }
        // No haptic here: the game screen already fires Haptics.success/error at
        // the moment of finishing — the old unconditional success() buzzed a
        // CELEBRATION haptic on losses too.
    }

    private func statBlock(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(Brand.font(20, .black)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.font(10, .bold)).tracking(0.6).foregroundStyle(Theme.textMuted)
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

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(0..<50, id: \.self) { i in
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
