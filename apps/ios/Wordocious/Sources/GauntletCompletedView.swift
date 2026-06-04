import SwiftUI
import WordociousCore

/// Native port of the web `GauntletCompletedCard` (completed-daily-board.tsx).
/// Renders the gauntlet run summary (Stages / Guesses / Time) followed by a row
/// per stage — a ✓/✗ badge, the stage name, and its guesses·time — that expands
/// to reveal that stage's mini boards (from the saved `boardsSnapshot`). Drives
/// off the locally-persisted `GauntletProgress`, so it's 1:1 with the web.
struct GauntletCompletedView: View {
    let progress: GauntletProgress
    let totalTimeMs: Int
    /// Inline 3-stat summary row (used by the compact leaderboard card; the
    /// full results screen shows boxed stat cards instead, so it passes false).
    var showSummary: Bool = true
    /// "STAGE BREAKDOWN" header above the rows (full results screen only).
    var showStageHeader: Bool = false

    @State private var expanded: Int?

    // Web palette.
    private let greenBg = Color(hex: 0xF0FDF4), greenBorder = Color(hex: 0xBBF7D0)
    private let greenBadgeBg = Color(hex: 0xDCFCE7), greenBadge = Color(hex: 0x16A34A)
    private let redBg = Color(hex: 0xFEF2F2), redBorder = Color(hex: 0xFECACA)
    private let redBadgeBg = Color(hex: 0xFEE2E2), redBadge = Color(hex: 0xDC2626)

    private var stagesCleared: Int { progress.stageResults.filter { $0.status == .won }.count }
    private var totalGuesses: Int { progress.stageResults.reduce(0) { $0 + $1.guesses } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if showSummary {
                // Inline summary stats (Stages / Guesses / Time).
                HStack(spacing: 20) {
                    summaryStat("\(stagesCleared)/\(progress.totalStages)", "STAGES")
                    summaryStat("\(totalGuesses)", "GUESSES")
                    summaryStat(fmtTime(totalTimeMs), "TIME")
                }
                .frame(maxWidth: .infinity)
            }
            if showStageHeader {
                Text("STAGE BREAKDOWN").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            }
            // One row per stage; tap to expand its boards.
            VStack(spacing: 4) {
                ForEach(progress.stages, id: \.stageIndex) { stage in
                    if let result = progress.stageResults.first(where: { $0.stageIndex == stage.stageIndex }) {
                        stageRow(stage, result)
                    }
                }
            }
        }
    }

    private func summaryStat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.font(9, .bold)).tracking(0.6).foregroundStyle(Theme.textMuted)
        }
    }

    @ViewBuilder
    private func stageRow(_ stage: GauntletStageConfig, _ result: GauntletStageResult) -> some View {
        let won = result.status == .won
        let hasBoards = !(result.boardsSnapshot?.isEmpty ?? true)
        let isExpanded = expanded == stage.stageIndex

        VStack(spacing: 0) {
            Button {
                guard hasBoards else { return }
                withAnimation(Theme.animation(.easeInOut(duration: 0.2))) {
                    expanded = isExpanded ? nil : stage.stageIndex
                }
            } label: {
                HStack(spacing: 6) {
                    Text(won ? "✓" : "✗").font(Brand.font(8, .black))
                        .foregroundStyle(won ? greenBadge : redBadge)
                        .frame(width: 14, height: 14)
                        .background(Circle().fill(won ? greenBadgeBg : redBadgeBg))
                    Text(stage.name).font(Brand.font(11, .bold)).foregroundStyle(Theme.textPrimary)
                    Spacer(minLength: 6)
                    Text("\(result.guesses)g · \(fmtTime(result.timeMs))")
                        .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                    if hasBoards {
                        Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.textMuted)
                            .rotationEffect(.degrees(isExpanded ? 180 : 0))
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(RoundedRectangle(cornerRadius: 10).fill(won ? greenBg : redBg))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(won ? greenBorder : redBorder, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!hasBoards)

            if isExpanded, let boards = result.boardsSnapshot, !boards.isEmpty {
                VStack(spacing: 6) {
                    solutionsReveal(boards)
                    stageBoards(boards, maxGuesses: stage.maxGuesses)
                }
                .padding(.top, 6).padding(.bottom, 2)
            }
        }
    }

    /// Answer pills for the stage — reveals the word(s) (green if that board
    /// was solved, red if missed), matching web StageReviewModal so a losing
    /// player sees what they missed.
    private func solutionsReveal(_ boards: [BoardState]) -> some View {
        let cols = boards.count == 1 ? 1 : (boards.count <= 4 ? 2 : 4)
        return VStack(spacing: 4) {
            Text(boards.count == 1 ? "ANSWER" : "ANSWERS")
                .font(Brand.font(9, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: cols), spacing: 4) {
                ForEach(boards.indices, id: \.self) { i in
                    let bWon = boards[i].status == .won
                    Text(boards[i].solution.uppercased())
                        .font(Brand.font(11, .black))
                        .foregroundStyle(bWon ? greenBadge : redBadge)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 6).fill(bWon ? greenBadgeBg : redBadgeBg))
                }
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color(hex: 0xF9FAFB)))
    }

    /// The stage's boards (1 col / 2 cols / 4 cols by count, web-matching),
    /// rendered with the shared completed mini board.
    @ViewBuilder
    private func stageBoards(_ boards: [BoardState], maxGuesses: Int) -> some View {
        let n = boards.count
        let cols = n == 1 ? 1 : (n <= 4 ? 2 : 4)
        let wordLen = boards.first?.solution.count ?? 5
        let tile = stageTile(boardCount: n, wordLen: wordLen)
        let grid = Array(repeating: GridItem(.flexible(), spacing: 4), count: cols)
        LazyVGrid(columns: grid, spacing: 4) {
            ForEach(boards.indices, id: \.self) { i in
                CompletedMiniBoardView(board: boards[i], tileSize: tile, rowCount: maxGuesses, framed: true)
            }
        }
        .frame(maxWidth: n == 1 ? 140 : (n <= 4 ? 240 : 320))
    }

    /// Tile size so a stage's boards fit the web's per-stage width caps
    /// (140 single / 240 ≤4 / 320 octo), gap-1 between boards, framed padding.
    private func stageTile(boardCount n: Int, wordLen: Int) -> CGFloat {
        let cap: CGFloat = n == 1 ? 140 : (n <= 4 ? 240 : 320)
        let cols = n == 1 ? 1 : (n <= 4 ? 2 : 4)
        let cellW = (cap - CGFloat(cols - 1) * 4) / CGFloat(cols) - 12  // 12 = frame pad+border
        return max(8, cellW / (CGFloat(wordLen) + CGFloat(wordLen - 1) * 0.1))
    }

    private func fmtTime(_ ms: Int) -> String {
        let s = ms / 1000
        if s < 60 { return "\(s)s" }
        return "\(s / 60)m \(s % 60)s"
    }
}

/// Staggered "fade + rise" entrance for the gauntlet results sections (web's
/// animate-fade-in-scale / animate-fade-in-up).
private struct RiseIn: ViewModifier {
    let appeared: Bool
    let delay: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 14)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(delay), value: appeared)
    }
}

/// Full Gauntlet results screen — 1:1 with the web `GauntletResults`, including
/// the animated entrance (icon springs in, title/stats/score/stages fade up,
/// staggered). Shared by the in-game finish (GameScreen) and the re-entry review
/// (SolvedPuzzleView) so a win OR loss always shows the same animated screen.
struct GauntletResultsView: View {
    let progress: GauntletProgress
    let won: Bool
    var mode: GameMode = .gauntlet
    var isDaily: Bool = true
    var elapsedMsFallback: Int = 0
    var onHome: () -> Void
    var onShare: () -> Void

    @State private var appeared = false

    private var cleared: Int { progress.stageResults.filter { $0.status == .won }.count }
    private var totalGuesses: Int { progress.stageResults.reduce(0) { $0 + $1.guesses } }
    private var totalTimeMs: Int {
        let s = progress.stageResults.reduce(0) { $0 + $1.timeMs }
        return s > 0 ? s : elapsedMsFallback
    }
    private var cumBoards: Int {
        progress.stageResults.reduce(0) { acc, r in
            guard let st = progress.stages.first(where: { $0.stageIndex == r.stageIndex }) else { return acc }
            return acc + (r.status == .won ? st.boardCount : (r.boardsSnapshot?.filter { $0.status == .won }.count ?? 0))
        }
    }
    private var cumTotal: Int { max(1, progress.stages.reduce(0) { $0 + $1.boardCount }) }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 8) {
                    Image(systemName: won ? "trophy.fill" : "xmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(won ? Color(hex: 0xD97706) : Color(hex: 0xF87171))
                        .scaleEffect(appeared ? 1 : 0.6).opacity(appeared ? 1 : 0)
                        .animation(Theme.animation(.spring(response: 0.5, dampingFraction: 0.6).delay(0.05)), value: appeared)
                    title.modifier(RiseIn(appeared: appeared, delay: 0.15))
                    HStack(spacing: 16) {
                        Button("Home", action: onHome).font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted).underline()
                        Button("Share", action: onShare).font(Brand.font(13, .bold)).foregroundStyle(Color(hex: 0x3B82F6)).underline()
                    }
                    .modifier(RiseIn(appeared: appeared, delay: 0.25))
                    if isDaily { DailyRankBadge(gameMode: mode).modifier(RiseIn(appeared: appeared, delay: 0.3)) }
                }
                .padding(.top, 4)

                HStack(spacing: 12) {
                    statCard("trophy.fill", Color(hex: 0x22C55E), "\(cleared)/\(progress.totalStages)", "Stages")
                    statCard("number", Color(hex: 0x60A5FA), "\(totalGuesses)", "Guesses")
                    statCard("clock", Color(hex: 0xFB923C), fmt(totalTimeMs), "Time")
                }
                .modifier(RiseIn(appeared: appeared, delay: 0.4))

                ScoreBreakdownView(gameMode: "GAUNTLET", completed: won, guessCount: totalGuesses,
                                   timeSeconds: totalTimeMs / 1000, boardsSolved: cumBoards, totalBoards: cumTotal)
                    .modifier(RiseIn(appeared: appeared, delay: 0.5))

                GauntletCompletedView(progress: progress, totalTimeMs: totalTimeMs, showSummary: false, showStageHeader: true)
                    .modifier(RiseIn(appeared: appeared, delay: 0.6))
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 24)
        }
        .onAppear { appeared = true }
    }

    @ViewBuilder private var title: some View {
        let t = Text(won ? "GAUNTLET CLEARED!" : "GAUNTLET FAILED")
            .font(Brand.font(34, .black)).multilineTextAlignment(.center)
        if won {
            t.foregroundStyle(LinearGradient(colors: [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)],
                                             startPoint: .leading, endPoint: .trailing))
        } else {
            t.foregroundStyle(Color(hex: 0xFCA5A5))
        }
    }

    private func statCard(_ icon: String, _ color: Color, _ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(color)
            Text(value).font(Brand.font(22, .black)).foregroundStyle(Theme.textPrimary).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surfaceHover))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    private func fmt(_ ms: Int) -> String { let s = ms / 1000; return s < 60 ? "\(s)s" : "\(s / 60)m \(s % 60)s" }
}
