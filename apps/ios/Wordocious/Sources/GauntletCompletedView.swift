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

    // FINISH_SPEC §L / §A1: won = the purple family, lost = slate (tinted, never white).
    private let wonInk = Color(hex: 0x7C3AED), lostInk = Color(hex: 0x6B7891)

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
                // "SEE RESULTS" hint: the expandable rows weren't discoverable
                // (Doug feedback, Aug 10).
                HStack {
                    FinishLabel("Stage breakdown")
                    Spacer()
                    Text("TAP A STAGE TO SEE RESULTS").font(Brand.font(9, .black)).tracking(0.6)
                        .foregroundStyle(A11yInk.on(Color(hex: 0x7C3AED)))
                }
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
            Text(value).softNumber(16)
            Text(label).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(FinishInk.secondary)
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
                    // §Q: a small W badge per cleared stage (L for the stage that stopped the run).
                    Icon3D(won ? .badgeW : .badgeL, size: 16)
                    // The tinted row flips to the dark surface in Dark, so the ink flips too.
                    Text(stage.name).font(Brand.font(11, .black)).foregroundStyle(FinishInk.heading)
                    Spacer(minLength: 6)
                    Text("\(result.guesses)g · \(fmtTime(result.timeMs))")
                        .font(Brand.font(9, .bold)).foregroundStyle(FinishInk.secondary)
                    if hasBoards {
                        // Win-purple / loss-red so the expander reads as a
                        // door, not decoration (Doug feedback, Aug 10).
                        Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                            .foregroundStyle(won ? wonInk : lostInk)
                            .rotationEffect(.degrees(isExpanded ? 180 : 0))
                    }
                }
                .padding(.horizontal, 10).padding(.top, 9).padding(.bottom, 7)
                .tintedPill(won ? wonInk : lostInk, radius: 11)
                .contentShape(Rectangle())
            }
            .buttonStyle(.squish)
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
            FinishLabel(boards.count == 1 ? "Answer" : "Answers")
                .frame(maxWidth: .infinity, alignment: .leading)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: cols), spacing: 4) {
                ForEach(boards.indices, id: \.self) { i in
                    let bWon = boards[i].status == .won
                    Text(boards[i].solution.uppercased())
                        .font(Brand.font(11, .black))
                        .foregroundStyle(bWon ? wonInk : lostInk)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 6).fill((bWon ? wonInk : lostInk).opacity(Theme.isDark ? 0.22 : 0.12)))
                }
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.isDark ? Theme.surface : Color(hex: 0x8B5CF6).wash(0.07)))
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
    /// Post-game only (GameScreen) — the re-entry review (SolvedPuzzleView)
    /// keeps its default false so the handoff row stays a results-flow nudge.
    var showNextDaily: Bool = false
    var elapsedMsFallback: Int = 0
    var onHome: () -> Void
    var onShare: () -> Void
    /// Pro Unlimited only (web gauntlet-results showPlayAgain).
    var onPlayAgain: (() -> Void)? = nil

    @State private var appeared = false
    /// §Q: how many stars have popped in (90 ms apart; Reduce Motion: all at once).
    @State private var starsShown = 0
    @State private var bob = false
    @State private var confetti = false
    @Environment(\.accessibilityReduceMotion) private var envReduce
    private var still: Bool { envReduce || Theme.reduceMotion }

    /// The Gauntlet accent (amber).
    private static let amber = Color(hex: 0xF59E0B)

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

    /// §Q LOST: the stage that stopped the run — its unsolved answers.
    private var failedAnswers: [String] {
        guard let r = progress.stageResults.first(where: { $0.status != .won }),
              let boards = r.boardsSnapshot else { return [] }
        return boards.filter { $0.status != .won }.map { $0.solution.uppercased() }
    }

    var body: some View {
        // FINISH_SPEC §R2 + §Q: one screen — the headline, the result strip and the
        // star row; the amber hero (champion scene / the two poses + the missed
        // answer) scaled to the height left; then the dock (share + the amber
        // candy + Next daily / Unlimited). Rank, breakdown and the stage list
        // sit below the dock.
        FinishedScreenLayout(minBoardHeight: 110, header: {
            VStack(spacing: 8) {
                title
                FinishedResultStrip(won: won, items: [("\(cleared)/\(progress.totalStages)", "stages"),
                                                      (fmt(totalTimeMs), "time"),
                                                      ("\(totalGuesses)", totalGuesses == 1 ? "guess" : "guesses")])
                starRow
            }
            .padding(.top, 50)   // clear of the corner Home control
            .modifier(RiseIn(appeared: appeared, delay: 0.05))
        }, board: { size in
            heroCard(size)
        }, dock: {
            dock
                .modifier(RiseIn(appeared: appeared, delay: 0.3))
        }, extras: {
            VStack(spacing: 16) {
                if isDaily { DailyRankBadge(gameMode: mode) }
                ScoreBreakdownView(gameMode: "GAUNTLET", completed: won, guessCount: totalGuesses,
                                   timeSeconds: totalTimeMs / 1000, boardsSolved: cumBoards, totalBoards: cumTotal,
                                   stagesCompleted: cleared,
                                   day: isDaily ? LeaderboardService.todayLocal() : nil)
                GauntletCompletedView(progress: progress, totalTimeMs: totalTimeMs, showSummary: false, showStageHeader: true)
            }
            .padding(.top, 16).padding(.bottom, 24)
        })
        .padding(.horizontal, 16)
        .overlay {
            // One confetti burst on a cleared run (Reduce Motion: none).
            if won && confetti && !still { ConfettiView().ignoresSafeArea() }
        }
        .onAppear {
            appeared = true
            if won { Feedback.celebrate() }   // §U: Gauntlet champion — celebrate · success+heavy
            if still {
                starsShown = progress.totalStages
            } else {
                confetti = won
                for i in 0..<max(0, progress.totalStages) {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 + Double(i) * 0.09) {
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.5)) { starsShown = i + 1 }
                    }
                }
                if won && !Motion.calm() {   // §AD: no endless bob in Low Power Mode
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                        withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { bob = true }
                    }
                }
            }
        }
    }

    // MARK: §Q hero card + §R2 dock

    /// The amber hero card filling the board area: the art scaled to fit, plus the
    /// missed answer on glossy tiles after a lost run.
    private func heroCard(_ size: CGSize) -> some View {
        let showTiles = !won && !failedAnswers.isEmpty
        let tilesH: CGFloat = showTiles ? 22 + CGFloat(min(failedAnswers.count, 2)) * 31 : 0
        return VStack(spacing: 8) {
            heroArt
                .frame(maxWidth: .infinity, maxHeight: max(40, size.height - tilesH - 28))
            if showTiles { failedAnswerTiles }
        }
        .padding(14)
        .frame(width: size.width, height: size.height)
        .tintedCard(accent: Self.amber, bar: [Color(hex: 0xFFC56B), Color(hex: 0xF97316)], radius: 22, barHeight: 8,
                    tint: won ? 0.14 : 0.08, line: won ? 0.34 : 0.26)
    }

    /// B6: the 3D share icon + the large amber candy ("Play again tomorrow" / Home);
    /// on the live daily finish, Next daily / Leaderboard (+ the Pro Unlimited card)
    /// below; after an Unlimited run (Pro), the KEEP PLAYING card.
    private var dock: some View {
        let nextDaily = isDaily && showNextDaily
        return VStack(spacing: 6) {
            HStack(spacing: 8) {
                FinishedShareButton(hasSpoilers: false, size: 30, onShare: { _ in onShare() })
                Button(action: onHome) {
                    CandyLabel(title: isDaily ? "Play again tomorrow" : "Home") { Icon3D(.tabHome, size: 20) }
                }
                .buttonStyle(CandyButtonStyle(variant: nextDaily ? .peach : .amber, size: nextDaily ? .medium : .large))
                .accessibilityLabel(isDaily ? "Play again tomorrow. Home" : "Home")
            }
            if nextDaily {
                NextDailyCTA(currentMode: "GAUNTLET", compact: true)
            }
            if let onPlayAgain {
                UnlimitedKeepPlayingCard(game: "Gauntlet", afterUnlimited: true, action: onPlayAgain, onOtherGames: onHome)
            }
        }
        .padding(.bottom, 6)
    }

    @ViewBuilder private var heroArt: some View {
        if won {
            Group {
                if ArtAsset.exists("art-scene-gauntlet-champion") {
                    Image("art-scene-gauntlet-champion").resizable().interpolation(.high).scaledToFit()
                        .accessibilityHidden(true)
                } else {
                    PoseImage(.s, "trophy", height: 150)
                }
            }
            .scaleEffect(appeared || still ? 1 : 0.6)
            .opacity(appeared || still ? 1 : 0)
            .offset(y: bob && !still ? -5 : 0)
            .animation(still ? nil : .spring(response: 0.5, dampingFraction: 0.6).delay(0.05), value: appeared)
        } else {
            // Kind, never sad: R with cocoa and I's good game, side by side.
            // Scales with the hero area (each pose fits half the width).
            HStack(spacing: 6) {
                Image(ArtPose.assetName(.r, "cocoa")).resizable().interpolation(.high).scaledToFit()
                Image(ArtPose.assetName(.i, "goodgame")).resizable().interpolation(.high).scaledToFit()
            }
            .accessibilityHidden(true)
            .frame(maxWidth: .infinity)
            .scaleEffect(appeared || still ? 1 : 0.7)
            .opacity(appeared || still ? 1 : 0)
            .animation(still ? nil : .spring(response: 0.5, dampingFraction: 0.65).delay(0.05), value: appeared)
        }
    }

    /// One star per stage — cleared stages gold, the rest soft grey; they pop in
    /// 90 ms apart (Reduce Motion: all at once).
    private var starRow: some View {
        HStack(spacing: 8) {
            ForEach(0..<max(0, progress.totalStages), id: \.self) { i in
                let lit = i < cleared
                Image(systemName: "star.fill")
                    .font(.system(size: 26, weight: .black))
                    .foregroundStyle(lit
                        ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xFFD66B), Color(hex: 0xF59E0B)], startPoint: .top, endPoint: .bottom))
                        : AnyShapeStyle(Theme.isDark ? Color.white.opacity(0.18) : Color(hex: 0xDAD4E6)))
                    .shadow(color: lit ? Color(hex: 0xB0650B).opacity(0.35) : .clear, radius: 0, x: 0, y: 2)
                    .scaleEffect(i < starsShown ? 1 : 0.2)
                    .opacity(i < starsShown ? 1 : 0)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(cleared) of \(progress.totalStages) stars")
    }

    /// §Q LOST: the failed stage's answer revealed on glossy tiles.
    private var failedAnswerTiles: some View {
        VStack(spacing: 6) {
            FinishLabel(failedAnswers.count == 1 ? "The answer" : "The answers")
            ForEach(Array(failedAnswers.prefix(2).enumerated()), id: \.offset) { _, word in
                HStack(spacing: 3) {
                    ForEach(Array(word.enumerated()), id: \.offset) { _, ch in
                        GlossyTile(face: .correct, letter: String(ch), width: 28)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(word)
            }
        }
    }

    @ViewBuilder private var title: some View {
        // §Q: the headline in soft-number ink (no gradient digit art).
        Text(won ? "GAUNTLET CLEARED!" : "SO CLOSE!")
            .softNumber(30)
            .multilineTextAlignment(.center)
            .lineLimit(1).minimumScaleFactor(0.6)
    }

    private func statCard(_ icon: String, _ color: Color, _ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            SymbolGlyph(icon, size: 18, color: color)
            Text(value).softNumber(22).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
        }
        .frame(maxWidth: .infinity).padding(.top, 16).padding(.bottom, 12)
        // §A1: each stat tile is tinted in its own color with the 4-pt top bar.
        .tintedPill(color, radius: 14)
    }

    private func fmt(_ ms: Int) -> String { let s = ms / 1000; return s < 60 ? "\(s)s" : "\(s / 60)m \(s % 60)s" }
}
