import SwiftUI
import WordociousCore

/// Per-mode header style (title + gradient) — mirrors the gradient titles in
/// the web game pages. Single-board gradients are audited from practice-game;
/// others derive from the mode accent.
enum ModeStyle {
    static func title(_ mode: GameMode) -> String {
        // Single-sourced: uppercased shareLabel from the mode catalog.
        ModeGen.byDbKey(mode.rawValue).map { $0.shareLabel.uppercased() } ?? "WORDOCIOUS"
    }
    /// Share-image mode label (special-cases Six/Seven like the web).
    static func shareLabel(_ mode: GameMode) -> String { title(mode) }

    static func accent(_ mode: GameMode) -> Color {
        // Single-sourced from the mode catalog (modes.json → ModeGen).
        ModeGen.byDbKey(mode.rawValue)?.accent ?? Theme.primary
    }

    static func gradient(_ mode: GameMode) -> [Color] {
        switch mode {
        case .duel: return [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)]
        case .duel6: return [Color(hex: 0x06B6D4), Color(hex: 0x22D3EE)]
        case .duel7: return [Color(hex: 0x84CC16), Color(hex: 0xA3E635)]
        default:
            let a = accent(mode)
            return [a, a.opacity(0.65)]
        }
    }

    /// Bright 3-stop title gradients used by the VS screens — 1:1 with the web's
    /// MODE_TITLE_GRADIENTS (vs-game.tsx). Default falls back to the DUEL stops.
    static func titleGradient(_ mode: GameMode) -> [Color] {
        switch mode {
        case .duel:          return [Color(hex: 0x22D3EE), Color(hex: 0x60A5FA), Color(hex: 0x2DD4BF)]
        case .quordle:       return [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)]
        case .octordle:      return [Color(hex: 0x22D3EE), Color(hex: 0xC084FC), Color(hex: 0xF472B6)]
        case .sequence:      return [Color(hex: 0xFACC15), Color(hex: 0xFB923C), Color(hex: 0xF87171)]
        case .rescue:        return [Color(hex: 0x818CF8), Color(hex: 0xC084FC), Color(hex: 0xE879F9)]
        case .propernoundle: return [Color(hex: 0xF87171), Color(hex: 0xFB7185), Color(hex: 0xFB923C)]
        case .duel6:         return [Color(hex: 0x22D3EE), Color(hex: 0x2DD4BF), Color(hex: 0x38BDF8)]
        case .duel7:         return [Color(hex: 0xA3E635), Color(hex: 0x4ADE80), Color(hex: 0x34D399)]
        case .gauntlet:      return [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)]
        default:             return [Color(hex: 0x22D3EE), Color(hex: 0x60A5FA), Color(hex: 0x2DD4BF)]
        }
    }
}

/// Web-parity finished-game header (ports the completion header in
/// octordle/quordle/rescue-game.tsx): gradient title, a stat row with the amber
/// trophy + boards-solved, total guesses, and the blue clock + time, a green
/// (won) or red (lost) summary line, then Home / Share links. Shared by the
/// live post-game screen and the reconstructed Solved-Puzzle view.
struct FinishedStatsHeader: View {
    let mode: GameMode
    let won: Bool
    let guessCount: Int
    let maxGuesses: Int            // 0 = unknown (hide the "/N")
    let timeSeconds: Int
    let boardsSolved: Int
    let totalBoards: Int
    var onHome: () -> Void
    /// Bool = "Full results" (letters revealed); false = spoiler-free card.
    var onShare: ((Bool) -> Void)? = nil
    /// False for shares with no tiles to spoil (Gauntlet's stage-chip card) —
    /// the Share link then skips the variant chooser and shares directly.
    var shareHasSpoilers: Bool = true
    /// Pro Unlimited only (web: amber "Play Again" on non-daily games).
    var onPlayAgain: (() -> Void)? = nil

    private var timeStr: String { "\(timeSeconds / 60):\(String(format: "%02d", timeSeconds % 60))" }
    private var isMulti: Bool { totalBoards > 1 }

    var body: some View {
        VStack(spacing: 8) {
            Text(ModeStyle.title(mode)).font(Brand.font(28, .black))
                .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
                .lineLimit(1).minimumScaleFactor(0.7)
                .soloGameTitle(mode, fallbackInset: 52)

            // FINISH_SPEC §B6: the result line is tinted pills (purple guesses, blue
            // time; gold boards on multi-board games) with 3D icons + soft numbers,
            // and Share is the bare 3D share icon. No "Home" text link (the house at
            // the top already does that).
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { pills; shareButton }
                VStack(spacing: 6) {
                    HStack(spacing: 8) { pills }
                    shareButton
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(summary)

            if !won {
                Text(summary)
                    .font(Brand.font(12, .bold))
                    .foregroundStyle(Color(hex: 0xE11D48))
                    .multilineTextAlignment(.center)
            }

            if let onPlayAgain {
                Button(action: onPlayAgain) {
                    CandyLabel(title: won ? "Play Again" : "Try Again", symbol: "arrow.clockwise")
                }
                .buttonStyle(CandyButtonStyle(variant: .amber, size: .medium, fullWidth: false))
            }
        }
    }

    @ViewBuilder private var pills: some View {
        if isMulti {
            TintPill(icon: .trophy, value: "\(boardsSolved)/\(totalBoards)", label: "solved", accent: Color(hex: 0xF5A524))
        }
        TintPill(icon: .crown, value: maxGuesses > 0 && !won ? "\(guessCount)/\(maxGuesses)" : "\(guessCount)",
                 label: guessCount == 1 ? "guess" : "guesses", accent: Color(hex: 0x7C3AED))
        TintPill(icon: .trophy, value: timeStr, label: "time", accent: Color(hex: 0x2563EB))
    }

    @ViewBuilder private var shareButton: some View {
        if let onShare {
            FinishedShareButton(hasSpoilers: shareHasSpoilers, onShare: onShare)
        }
    }

    private var summary: String {
        if won {
            return isMulti
                ? "All \(totalBoards) solved in \(guessCount) guesses  ·  \(timeStr)"
                : "Solved in \(guessCount) guesses  ·  \(timeStr)"
        }
        return isMulti
            ? "\(boardsSolved)/\(totalBoards) solved  ·  \(timeStr)"
            : "Out of guesses  ·  \(timeStr)"
    }
}

/// The finished screen's 3D share icon (B6) with the spoiler chooser — shared by
/// the stats header and the §R2 dock.
struct FinishedShareButton: View {
    /// False for shares with no tiles to spoil — skips the variant chooser.
    var hasSpoilers: Bool = true
    var size: CGFloat = 32
    /// Bool = "Full results" (letters revealed); false = spoiler-free card.
    let onShare: (Bool) -> Void

    @State private var showShareOptions = false
    /// The chooser's pick, consumed by the sheet's onDismiss (see ShareVariantSheet).
    @State private var shareReveal: Bool?

    var body: some View {
        Button {
            if hasSpoilers { showShareOptions = true } else { onShare(false) }
        } label: {
            Icon3D(.share, size: size)
                .shadow(color: Color(hex: 0x4C1D95).opacity(0.2), radius: 2.5, x: 0, y: 3)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.squishIcon)
        .accessibilityLabel("Share")
        .sheet(isPresented: $showShareOptions,
               onDismiss: { if let r = shareReveal { shareReveal = nil; onShare(r) } }) {
            ShareVariantSheet(selection: $shareReveal).presentationDetents([.height(260)])
        }
    }
}

/// FINISH_SPEC §R2: the finished screen's compact header — the game's title art
/// (capped short so the board and the dock fit one screen) and the one-line result
/// strip (badge · solved · guesses · time · points).
struct FinishedCompactHeader: View {
    let mode: GameMode
    let won: Bool
    let guessCount: Int
    let maxGuesses: Int            // 0 = unknown (hide the "/N")
    let timeSeconds: Int
    let boardsSolved: Int
    let totalBoards: Int
    var points: Int? = nil

    private var timeStr: String { "\(timeSeconds / 60):\(String(format: "%02d", timeSeconds % 60))" }

    private var items: [(value: String, label: String)] {
        var out: [(value: String, label: String)] = []
        if totalBoards > 1 { out.append(("\(boardsSolved)/\(totalBoards)", "solved")) }
        out.append((maxGuesses > 0 && !won ? "\(guessCount)/\(maxGuesses)" : "\(guessCount)",
                    guessCount == 1 ? "guess" : "guesses"))
        out.append((timeStr, "time"))
        return out
    }

    /// "SOLVED IN 4" · "ALL 4 SOLVED" · "3 OF 4 SOLVED" · "SO CLOSE".
    private var stripHeadline: String {
        if totalBoards > 1 {
            return boardsSolved == totalBoards ? "ALL \(totalBoards) SOLVED" : "\(boardsSolved) OF \(totalBoards) SOLVED"
        }
        return won ? "SOLVED IN \(guessCount)" : "SO CLOSE"
    }

    var body: some View {
        VStack(spacing: 6) {
            // Between the corner Home / Help controls (56 pt clear each side).
            Group {
                if let art = GameTitleArt.forMode(mode) {
                    GameTitleArtView(asset: art.asset, label: art.label,
                                     maxHeight: UIScreen.main.bounds.height < 700 ? 52 : 68, minHeight: 36)
                } else {
                    Text(ModeStyle.title(mode)).font(Brand.font(24, .black))
                        .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .gameHost(mode, size: 26)
                }
            }
            .padding(.horizontal, 54)
            .padding(.top, 4)
            // FINISH_SPEC §AR: the result strip's headline in live lettering.
            LiveHeadline(text: stripHeadline, palette: .home, size: 20, maxLines: 1, minimumScale: 0.6)
                .padding(.horizontal, 12)
            FinishedResultStrip(won: won, items: items, points: points)
                .padding(.horizontal, 4)
        }
    }
}

/// FINISH_SPEC §R2: a multi-board game's finished boards as the compact mini grid
/// (2 × 2, or 4 across for 8 boards), scaled to fit exactly `size` — the tiles may
/// shrink below their playing size. Each mini board keeps its own tray (framed).
struct FinishedMiniGrid: View {
    let boards: [BoardState]
    let rowCount: Int
    let size: CGSize
    var revealMissed: Bool = false

    private static let gap: CGFloat = CompletedBoardLayout.gridSpacing

    var body: some View {
        let n = boards.count
        let cols = CompletedBoardLayout.cols(n)
        let rows = Int(ceil(Double(n) / Double(max(1, cols))))
        let tile = Self.tile(boardCount: n, wordLen: boards.first?.solution.count ?? 5, rowCount: rowCount,
                             size: size, revealMissed: revealMissed)
        VStack(spacing: Self.gap) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: Self.gap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let i = r * cols + c
                        if i < n {
                            CompletedMiniBoardView(board: boards[i], tileSize: tile, rowCount: rowCount,
                                                   revealMissed: revealMissed)
                        }
                    }
                }
            }
        }
        .frame(width: size.width, height: size.height)
    }

    /// The largest tile that fits every board in its cell (mini tray padding + lip +
    /// the ✓ badge's float + the missed-answer line), capped at a comfortable 30 pt.
    static func tile(boardCount n: Int, wordLen: Int, rowCount: Int, size: CGSize, revealMissed: Bool) -> CGFloat {
        let cols = CompletedBoardLayout.cols(n)
        let rows = Int(ceil(Double(n) / Double(max(1, cols))))
        let cellW = (size.width - CGFloat(cols - 1) * gap) / CGFloat(max(1, cols))
        let cellH = (size.height - CGFloat(rows - 1) * gap) / CGFloat(max(1, rows))
        let w = max(1, wordLen), h = max(1, rowCount)
        let tw = (cellW - 16) / (CGFloat(w) + CGFloat(w - 1) * 0.1)
        let th = (cellH - 22 - (revealMissed ? 16 : 0)) / (CGFloat(h) + CGFloat(h - 1) * 0.1)
        return max(6, min(30, tw, th))
    }
}

/// Your daily-leaderboard standing on the post-game screen — ports
/// daily-rank-badge.tsx. Hidden until ≥2 players have a result today.
struct DailyRankBadge: View {
    let gameMode: GameMode
    var playType: String = "solo"
    @State private var rank: (rank: Int, total: Int)?

    var body: some View {
        Group {
            if let r = rank, r.total >= 2 {
                // Shared ROUNDING semantics (Core Format.swift) — this badge
                // truncated where web rounded, so the same rank read
                // "Top 13%" here and "Top 12%" on wordocious.com.
                let badge = topPercentLabel(rank: r.rank, totalPlayers: r.total)
                let gold = badge.gold
                HStack(spacing: 4) {
                    Icon3D(.trophy, size: 12)
                    Text("\(badge.label) · #\(r.rank) of \(r.total)").font(Brand.font(10, .black))
                }
                .foregroundStyle(gold ? (Theme.isDark ? Color(hex: 0xFCD34D) : Color(hex: 0x92400E)) : FinishInk.secondary)
                .padding(.horizontal, 9).padding(.top, 6).padding(.bottom, 4)
                // §A1: a tinted pill (gold for a top finish, lilac otherwise).
                .tintedPill(gold ? Color(hex: 0xF59E0B) : Color(hex: 0x8B5CF6))
            }
        }
        .task(id: gameMode.rawValue) {
            guard let uid = AuthService.shared.profile?.id else { return }
            rank = await LeaderboardService.userRank(gameMode: gameMode, userId: uid, playType: playType)
        }
    }
}

/// Post-game composite-score breakdown — ports score-breakdown.tsx.
struct ScoreBreakdownView: View {
    let gameMode: String
    let completed: Bool
    let guessCount: Int
    let timeSeconds: Int
    let boardsSolved: Int
    let totalBoards: Int
    var hintsUsed: Int = 0
    var stagesCompleted: Int? = nil
    var bestCorrectLetters: Int? = nil
    /// The PUZZLE's day (YYYY-MM-DD) — pre-cutover days render with the frozen
    /// V1 formula so the card always matches the recorded score. nil = current.
    var day: String? = nil

    var body: some View {
        let b = DailyScoring.breakdown(gameMode: gameMode, completed: completed, guessCount: guessCount,
                                       timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
                                       hintsUsed: hintsUsed, stagesCompleted: stagesCompleted,
                                       bestCorrectLetters: bestCorrectLetters, dateKey: day)
        let guessesLeft = max(0, b.maxGuesses - guessCount)
        let timeUnder = max(0, b.timeCap - timeSeconds)
        // FINISH_SPEC §B6: a lavender card with a purple top bar, dashed dividers,
        // purple values and the total as a big soft number.
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center) {
                Text("SCORE BREAKDOWN").font(Brand.font(11, .black)).tracking(1.3)
                    .foregroundStyle(Theme.isDark ? Color(hex: 0xC4B5FD) : Color(hex: 0x5B3C96))
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(Int(b.total).formatted()).softNumber(30)
                    Text("PTS").font(Brand.font(12, .black)).tracking(1.2).foregroundStyle(Self.valueInk)
                }
                .accessibilityElement(children: .combine)
            }
            VStack(spacing: 0) {
                row(completed ? "Win bonus" : "Did not finish", completed ? "" : "no win bonus", b.basePoints, first: true)
                // The row reads through the mode's guess semantics (More Games §11):
                // Sudoku and Starsweep count mistakes, so theirs says "Mistake bonus".
                let bonusLabel: String = {
                    switch ModeGen.byDbKey(gameMode)?.guessSemantics {
                    case "mistakes": return "Mistake bonus"
                    case "checks": return "Check bonus"
                    case "misses": return "Miss bonus"
                    case "overPar": return "Par bonus"
                    case "rank": return "Rank bonus"
                    default: return "Guess bonus"
                    }
                }()
                if completed && b.guessBonusApplies { row(bonusLabel, "\(guessesLeft) unused × \(b.guessWeight)", b.guessBonus) }
                if completed { row("Speed bonus", timeSeconds > b.timeCap ? "\(fmt(timeSeconds - b.timeCap)) over \(fmt(b.timeCap))" : "\(fmt(timeUnder)) under \(fmt(b.timeCap))", b.timeBonus) }
                if b.completionBonus > 0 { completionRow(b.completionBonus) }
                if b.hasHints {
                    let detail = hintsUsed > 0 ? "\(hintsUsed) hint\(hintsUsed == 1 ? "" : "s") × \(Int(b.hintPenalty) / max(1, hintsUsed))" : "no hints — full credit"
                    row("Hint penalty", detail, -b.hintPenalty, pure: completed && hintsUsed == 0)
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedCard(accent: Color(hex: 0x7C3AED), bar: [Color(hex: 0x7C3AED), Color(hex: 0xA855F7)])
        .frame(maxWidth: 400)
    }

    private static var valueInk: Color { Theme.isDark ? Color(hex: 0xC4B5FD) : Color(hex: 0x6D28D9) }

    /// Completion / progress row — relabels on a loss (Gauntlet stage progress,
    /// single-board near-miss) to match the new loss-credit scoring.
    private func completionRow(_ bonus: Double) -> some View {
        let label: String
        let detail: String
        if completed {
            label = "Completion bonus"
            detail = totalBoards > 1 ? "\(boardsSolved)/\(totalBoards) boards" : "puzzle solved"
        } else if gameMode == "GAUNTLET" {
            label = "Stage progress"
            detail = "\(stagesCompleted ?? 0)/5 stages cleared"
        } else if totalBoards == 1 {
            let n = bestCorrectLetters ?? 0
            label = "Near miss"
            detail = "\(n) correct letter\(n == 1 ? "" : "s")"
        } else {
            label = "Completion bonus"
            detail = "\(boardsSolved)/\(totalBoards) boards"
        }
        return row(label, detail, bonus)
    }

    private func row(_ label: String, _ detail: String, _ value: Double, pure: Bool = false, first: Bool = false) -> some View {
        let sign = value > 0 ? "+" : value < 0 ? "−" : ""
        let abs = Swift.abs((value * 100).rounded() / 100)
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label).font(Brand.font(14, .black))
                .foregroundStyle(pure ? Color(hex: 0x7C3AED) : FinishInk.heading)
            if !detail.isEmpty {
                Text(detail).font(Brand.font(11.5, .bold)).foregroundStyle(Theme.isDark ? Theme.textMuted : Color(hex: 0x7A6A95))
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 6)
            Text("\(sign)\(Int(abs).formatted())").font(Brand.font(15, .black)).monospacedDigit()
                .foregroundStyle(value < 0 ? Color(hex: 0xDC2626) : (value > 0 ? Self.valueInk : Theme.textMuted))
        }
        .padding(.vertical, 6).padding(.horizontal, 2)
        .overlay(alignment: .top) {
            if !first {
                Line().stroke(Color(hex: 0x7C3AED).opacity(0.18), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .frame(height: 1)
            }
        }
    }

    /// A horizontal hairline (dashed by the caller's stroke style).
    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            return p
        }
    }

    private func fmt(_ s: Int) -> String { s <= 0 ? "0s" : (s >= 60 ? "\(s/60)m \(s%60)s" : "\(s)s") }
}

/// Next-daily handoff on DAILY post-game screens — keeps the daily loop
/// moving: one compact row under the score breakdown pointing at the first
/// unplayed daily (canonical homeModes order), styled in that mode's accent.
/// Tapping it dismisses the current game and asks RootTabView to launch that
/// mode's daily via the same GameScreen(DailySeed.today)/ProperNoundleView()
/// path the Leaderboard tab's Play CTA uses — a root-level presenter works no
/// matter which surface (Home / Leaderboard / Profile) presented this game.
/// Every sweep daily recorded → a static "Sweep complete" line instead.
struct NextDailyCTA: View {
    /// Posted (object = the mode's dbKey) when the player taps the CTA;
    /// RootTabView observes and presents that mode's daily.
    static let playNextDaily = Notification.Name("wordocious.play-next-daily")

    /// Posted (object = the mode's dbKey) when a Pro player taps "Keep playing:
    /// Unlimited <Mode>"; RootTabView mints a fresh unlimited seed for that mode
    /// (like HomeView does) and presents the game from the tab root.
    static let playUnlimited = Notification.Name("wordocious.play-unlimited")

    /// §214 (Lindsay): posted (object = the mode's dbKey) when the player taps
    /// "View Leaderboard" on a finished daily. RootTabView switches to the
    /// Leaderboard tab; LeaderboardTab preselects the mode.
    static let openLeaderboard = Notification.Name("wordocious.open-leaderboard")
    /// §264: the mode the Leaderboard tab should show when it next appears.
    /// TabView builds a tab's view LAZILY, on first selection — so when the
    /// player had not opened the Leaderboard tab yet this session, nobody was
    /// listening for `openLeaderboard` and the tab came up on its default
    /// (Classic). Founder: "I just beat Deliverance and clicked to view the
    /// Deliverance leaderboard and it brought me to the Classic leaderboard."
    /// Set before the note is posted; LeaderboardTab consumes it on appear.
    static var pendingLeaderboardMode: String?

    /// The dbKey of the game THIS results screen belongs to. Excluded
    /// explicitly (web parity): its own recording can lag the render —
    /// Gauntlet's multi-write chain especially — so without this the CTA
    /// suggested the mode the player JUST finished, and tapping it re-opened
    /// the same results screen.
    var currentMode: String? = nil
    /// §R2: inside the finished screen's dock — medium candies, tighter spacing.
    var compact: Bool = false

    /// Seeds instantly from the day-keyed cache (which already includes the
    /// just-finished game via completionPosted); load() confirms from the server.
    @StateObject private var completions = DailyCompletionsStore()
    @Environment(\.dismiss) private var dismiss

    /// The Next Daily target (More Games §18d). A sweep finish walks the SWEEP
    /// set in canonical home-grid order (VS has no daily row — dbKey nil — so it
    /// is skipped automatically). A More Games finish hands off to the next
    /// unplayed More Games title first (catalog order, flag-visible, daily-
    /// eligible — ProperNoundle among them since Stage 9), then to the sweep.
    /// More Games titles are never "next" after a sweep game.
    private var nextMode: HomeMode? {
        let unplayed: (HomeMode) -> Bool = { m in
            guard let key = m.dbKey, key != currentMode else { return false }
            return completions.byMode[key] == nil
        }
        let fromMoreGames = currentMode.map { key in moreModes.contains { $0.dbKey == key } } ?? false
        if fromMoreGames,
           let next = moreModes.first(where: { $0.dailyEligible && FlagsService.shared.isOn($0.flagKey) && unplayed($0) }) {
            return next
        }
        return homeModes.first { m in
            guard let key = m.dbKey, DailyCompletionsStore.sweepKeys.contains(key) else { return false }
            return unplayed(m)
        }
    }

    var body: some View {
        Group {
            // Dailies only record for signed-in accounts; guests get nothing.
            if AuthService.shared.profile != nil {
                VStack(spacing: compact ? 6 : 10) {
                    if let next = nextMode, let key = next.dbKey {
                        Button {
                            dismiss()
                            // Let the dismiss animation finish before the root
                            // presents the next cover (competing presentations drop).
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                                NotificationCenter.default.post(name: Self.playNextDaily, object: key)
                            }
                        } label: {
                            // FINISH_SPEC §B6 / §A8: the gold (amber) candy button
                            // with the next game's icon.
                            CandyLabel(title: "Next daily: \(next.title)") { gameIcon(next) }
                        }
                        .buttonStyle(CandyButtonStyle(variant: .amber, size: compact ? .medium : .large))
                        .accessibilityLabel("Next daily: \(next.title)")
                    } else if nextMode == nil {
                        // §AM3: the 3D trophy, not the emoji.
                        HStack(spacing: 6) {
                            Text("All \(DailyCompletionsStore.totalDailyModes) dailies done. Sweep complete!")
                                .font(Brand.font(13, .black)).foregroundStyle(A11yInk.on(Color(hex: 0x7C3AED)))
                            Icon3D(.trophy, size: 20)
                        }
                        .padding(.vertical, 4)
                    }
                    viewLeaderboard
                    keepPlayingUnlimited
                }
                .frame(maxWidth: 400)
                .padding(.top, compact ? 0 : 4)
            } else {
                // FINISH_SPEC §R3 (founder 10-02): guests see the Unlimited card too —
                // it opens the Go Pro paywall, which signs them in first.
                keepPlayingUnlimited
                    .frame(maxWidth: 400)
            }
        }
        .task { await completions.load() }
    }

    /// §214 (Lindsay): straight from the finish line to the scoreboard — a
    /// capsule in the mode's accent that lands on this mode's daily board.
    @ViewBuilder private var viewLeaderboard: some View {
        if let key = currentMode,
           let mode = (homeModes + moreModes).first(where: { $0.dbKey == key }) {
            Button {
                dismiss()
                // Same choreography as playNextDaily: let this cover's dismiss
                // finish before the root switches tabs.
                Self.pendingLeaderboardMode = key
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    NotificationCenter.default.post(name: Self.openLeaderboard, object: key)
                }
            } label: {
                // §B6 / §A8: the purple candy button with the 3D trophy.
                CandyLabel(title: "\(mode.title) Leaderboard") { Icon3D(.trophy, size: 26) }
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: compact ? .medium : .large))
            .accessibilityLabel("View \(mode.title) Leaderboard")
        }
    }

    /// "Keep playing: Unlimited <Mode>" — the handoff into an Unlimited game of
    /// the SAME mode the player just finished (tester-reported dead end: after
    /// the daily — especially a completed sweep — players had no visible path to
    /// keep playing; the home Daily/Unlimited toggle went undiscovered).
    @ViewBuilder private var keepPlayingUnlimited: some View {
        // §R3 (founder 10-02): everyone sees the card — for free players it opens
        // the Pro paywall itself and starts the game after a purchase.
        if let key = currentMode,
           let mode = (homeModes + moreModes).first(where: { $0.dbKey == key }) {
            // FINISH_SPEC §R3: the peach KEEP PLAYING card with U's loop art; the
            // same post of playUnlimited.
            UnlimitedKeepPlayingCard(game: ModeGen.byDbKey(key)?.title ?? mode.title) {
                dismiss()
                // Same choreography as playNextDaily: let this cover's dismiss
                // finish before the root presents the unlimited game.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    NotificationCenter.default.post(name: Self.playUnlimited, object: key)
                }
            }
        }
    }

    /// A game's glossy icon at the candy label's icon size.
    @ViewBuilder private func gameIcon(_ m: HomeMode) -> some View {
        if let art = m.icon.gameArt { GameArtImage(asset: art, size: 26) }
    }
}

/// Dictionary definition card for single-word post-game — ports
/// post-game-summary.tsx (uses dictionaryapi.dev).
/// Solution word + dictionary definition shown on single-board completed
/// screens (Classic / Six / Seven), ported 1:1 from the web completed-daily
/// "Solution + Definition" block: the word in bold, then a box with the
/// phonetic + part-of-speech pill + definition — or "No definition available
/// for this word." when the dictionary has no entry (so it always populates,
/// never a blank gap). `showWord` lets the live finished board (which already
/// spells the word in green tiles) omit the redundant heading.
struct DefinitionCard: View {
    let solution: String
    var showWord: Bool = true
    /// The card's small caps label (FINISH_SPEC §B6: "TODAY'S WORD" on a daily).
    var label: String = "THE WORD"
    @State private var def: WordOfTheDayView.WordInfo?
    @State private var loaded = false

    private static let green = Color(hex: 0x22A866)

    var body: some View {
        Group {
            if showWord {
                // FINISH_SPEC §B6: the word spelled in purple tiles on a soft green
                // card with a green part-of-speech chip + the definition.
                VStack(alignment: .leading, spacing: 8) {
                    Text(label).font(Brand.font(11, .black)).tracking(1.3)
                        .foregroundStyle(Theme.isDark ? Color(hex: 0x86EFAC) : Color(hex: 0x137A3D))
                    wordTiles.frame(maxWidth: .infinity)
                    if loaded { details }
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .tintedCard(accent: Self.green, bar: [Self.green, Color(hex: 0x5ED59A)])
                .frame(maxWidth: 400)
            } else if loaded {
                details
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .tintedCard(accent: Self.green, radius: 14)
            }
        }
        .task(id: solution) {
            def = await WordDefinitions.definition(for: solution)
            loaded = true
        }
    }

    private var wordTiles: some View {
        let letters = Array(solution.uppercased())
        return GeometryReader { g in
            let n = CGFloat(max(1, letters.count))
            let side = min(38, (g.size.width - (n - 1) * 5) / n)
            HStack(spacing: 5) {
                ForEach(letters.indices, id: \.self) { i in
                    GlossyTile(face: .correct, letter: String(letters[i]), width: side)
                }
            }
            .frame(width: g.size.width, height: g.size.height)
        }
        .frame(height: 38)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(solution.uppercased())
    }

    @ViewBuilder private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let d = def {
                HStack(spacing: 8) {
                    if let pos = d.partOfSpeech, !pos.isEmpty {
                        Text(pos.uppercased()).font(Brand.font(11, .black)).tracking(1.1)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 3)
                            .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0x5ED59A), Self.green],
                                                                      startPoint: .top, endPoint: .bottom)))
                            .background(Capsule().fill(Color(hex: 0x157A48)).offset(y: 2))
                    }
                    if let p = d.phonetic, !p.isEmpty {
                        Text(p).font(Brand.font(12, .semibold)).foregroundStyle(Theme.textMuted)
                    }
                }
                if let def = d.definition {
                    Text(def).font(Brand.font(14, .bold))
                        .foregroundStyle(Theme.isDark ? Theme.textSecondary : Color(hex: 0x4B3D66))
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                Text("No definition available for this word.")
                    .font(Brand.font(13, .medium)).italic().foregroundStyle(Theme.textMuted)
            }
        }
    }
}
