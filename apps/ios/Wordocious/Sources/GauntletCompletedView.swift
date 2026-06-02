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
                stageBoards(boards, maxGuesses: stage.maxGuesses)
                    .padding(.top, 6).padding(.bottom, 2)
            }
        }
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
