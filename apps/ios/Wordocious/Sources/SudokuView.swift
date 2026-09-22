import SwiftUI
import WordociousCore

// Daily Sudoku (More Games §4) — the iOS twin of components/sudoku/*. One fixed
// Medium puzzle a day generated on the device from the daily seed; Pro
// Unlimited picks Easy / Medium / Hard. Three wrong digits lose; hints fill a
// cell and cost score but never a mistake. guess_count = mistakes + 1.

private let sudokuAccent = Color(hex: 0x1E40AF)
private let difficultyLabel: [SudokuDifficulty: String] = [.easy: "Easy", .medium: "Medium", .hard: "Hard"]

@MainActor
final class SudokuVM: ObservableObject {
    @Published private(set) var state: SudokuState
    @Published var selected: Int?
    @Published var toast: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    /// nil seed = today's daily (Medium); an Unlimited seed carries its difficulty.
    let isDaily: Bool
    let seed: String

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    private var guidePauseStart: Double?
    private var recorded = false
    /// True when a finished board was restored — the overlay must not replay.
    private(set) var restoredFinished = false

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        self.seed = seed ?? generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: GameMode.sudoku.rawValue)
        let puzzle = generateSudoku(self.seed, difficulty: seed == nil ? .medium : sudokuDifficultyForSeed(self.seed))
        state = SudokuState(puzzle: puzzle, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
    }

    var isFinished: Bool { state.status != .playing }
    var mistakes: Int { state.mistakes }
    var hintsUsed: Int { state.hintsUsed }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
    var dailyNumber: Int { sudokuDailyNumber(LeaderboardService.todayLocal()) }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/sudoku/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: SudokuState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "sudoku-save-daily" : "sudoku-save-\(seed)" }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000

    private func persist() {
        let snap = Snapshot(seed: seed, date: LeaderboardService.todayLocal(), state: state, elapsed: elapsed, savedAt: Date().timeIntervalSince1970 * 1000)
        if let data = try? JSONEncoder().encode(snap) { UserDefaults.standard.set(data, forKey: storageKey) }
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        // Fail-closed: exact seed; the daily also re-checks the local date; practice honours the TTL.
        let stale = snap.seed != seed
            || (isDaily && snap.date != LeaderboardService.todayLocal())
            || (!isDaily && Date().timeIntervalSince1970 * 1000 - snap.savedAt > Self.practiceTTLms)
        if stale { UserDefaults.standard.removeObject(forKey: storageKey); return }
        state = snap.state
        restoredElapsedMs = Double(snap.elapsed) * 1000
        if state.status != .playing { finalTimeSeconds = snap.elapsed; recorded = true; restoredFinished = true }
    }

    // MARK: - Actions

    private func dispatch(_ a: SudokuAction) {
        guard !isFinished else { return }
        state = sudokuReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    func place(_ digit: Int) {
        guard !isFinished else { return }
        guard let cell = selected else { flash("Tap a cell first"); return }
        guard state.givens[state.givens.index(state.givens.startIndex, offsetBy: cell)] == "0" else { SoundManager.shared.playInvalid(); return }
        let wrong = !state.notesMode && state.solution[state.solution.index(state.solution.startIndex, offsetBy: cell)] != Character(String(digit))
        dispatch(.place(cell: cell, digit: digit))
        if wrong && !isFinished { Haptics.error(); SoundManager.shared.playInvalid() } else { SoundManager.shared.playKeyTap() }
    }
    func erase() { guard let cell = selected else { return }; dispatch(.erase(cell: cell)) }
    func undo() { dispatch(.undo) }
    func toggleNotes() { dispatch(.toggleNotes) }
    func hint() { dispatch(.hint(cell: selected)) }

    /// Digits with all nine correct placements — dimmed on the pad.
    var completeDigits: Set<Int> {
        var done = Set<Int>()
        let b = Array(state.board), s = Array(state.solution)
        for d in 1...9 {
            let ch = Character(String(d))
            if (0..<81).filter({ b[$0] == ch && s[$0] == ch }).count == 9 { done.insert(d) }
        }
        return done
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.error(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = state.mistakes + 1, used = state.hintsUsed
        let row = sudokuMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .sudoku, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .sudoku, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.sudoku.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_200_000_000); if toast == m { toast = nil } }
    }
}

struct SudokuView: View {
    @StateObject private var vm: SudokuVM
    /// Pro Unlimited "Play Again" / difficulty switch — HomeView swaps in a fresh seed.
    var onPlayAgain: ((SudokuDifficulty) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: ((SudokuDifficulty) -> Void)? = nil) {
        _vm = StateObject(wrappedValue: SudokuVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView { VStack(spacing: 10) { header; board.padding(.horizontal, 6); result }.padding(.horizontal, 10) }
            } else {
                VStack(spacing: 8) {
                    header
                    if !vm.isDaily && isPro { difficultyPicker }
                    Spacer(minLength: 4)
                    board.padding(.horizontal, 6)
                    Spacer(minLength: 4)
                    SudokuPad(vm: vm).padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            if let toast = vm.toast {
                Text(toast).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.top, 100).frame(maxHeight: .infinity, alignment: .top)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.mistakes, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?(vm.state.difficulty) } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            // Corner Home + "?" buttons — the same pair as every game (§19).
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .sudoku) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .hidesBottomNav()
        .swipeToGoBack { dismiss() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .onChange(of: vm.state.status) { s in
            if s != .playing, !vm.restoredFinished { withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showOverlay = true } }
            if s == .won { RatingsPrompt.recordWin(); RatingsPrompt.maybeAsk() }
        }
        .onAppear {
            if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.beginTimer() } }
        }
    }

    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(sudokuAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(sudokuAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("SUDOKU").font(Brand.font(24, .black)).foregroundStyle(sudokuAccent)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                Text(difficultyLabel[vm.state.difficulty] ?? "Medium").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                HStack(spacing: 3) {
                    Text("Mistakes").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    ForEach(0..<SUDOKU_MAX_MISTAKES, id: \.self) { i in
                        Circle().fill(i < vm.mistakes ? Color(hex: 0xDC2626) : Theme.borderLight).frame(width: 8, height: 8)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(vm.mistakes) of \(SUDOKU_MAX_MISTAKES) mistakes")
                if !vm.isFinished {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 2) {
                            Image(systemName: "clock").font(.system(size: 9))
                            Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))")
                        }
                        .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
        .padding(.top, 6)
    }

    /// Pro Unlimited: Easy · Medium · Hard capsules; switching starts a fresh puzzle.
    private var difficultyPicker: some View {
        HStack(spacing: 8) {
            ForEach(SudokuDifficulty.allCases, id: \.self) { d in
                let active = d == vm.state.difficulty
                Button { if !active { onPlayAgain?(d) } } label: {
                    Text(difficultyLabel[d] ?? d.rawValue).font(Brand.font(11, .heavy))
                        .foregroundStyle(active ? .white : sudokuAccent)
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Capsule().fill(active ? sudokuAccent : Color.clear))
                        .overlay(Capsule().stroke(sudokuAccent.opacity(active ? 1 : 0.35), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
    }

    private var board: some View {
        SudokuBoardView(state: vm.state, selected: vm.isFinished ? nil : vm.selected,
                        revealSolution: vm.state.status == .lost) { cell in
            if !vm.isFinished { vm.selected = cell; Haptics.tap() }
        }
    }

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let remaining = sudokuRemaining(vm.state)
        return VStack(spacing: 10) {
            Text(won ? "Sudoku solved" : "Out of mistakes")
                .font(Brand.title(20)).foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xEF4444))
            Text(won
                 ? "\(formatGuessStat(semantics: "mistakes", guessBase: 1, guessCount: vm.mistakes + 1)) · \(timeText(secs))\(vm.hintsUsed > 0 ? " · \(vm.hintsUsed) hint\(vm.hintsUsed == 1 ? "" : "s")" : "")"
                 : "\(remaining) cell\(remaining == 1 ? "" : "s") left · \(timeText(secs))")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain(vm.state.difficulty) } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Color(hex: 0xD97706))
                }
            }
            .foregroundStyle(sudokuAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .sudoku) }
            ScoreBreakdownView(gameMode: GameMode.sudoku.rawValue, completed: won,
                               guessCount: vm.mistakes + 1, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "SUDOKU") }
        }
        .padding(.vertical, 12)
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.sudoku.rawValue, surface: "post_game")
        ShareService.share(kind: .sudoku(givens: vm.state.givens, board: vm.state.board, hintMask: vm.state.hintMask,
                                         mistakes: vm.mistakes, difficulty: difficultyLabel[vm.state.difficulty] ?? "Medium",
                                         puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .sudoku, modeLabel: "SUDOKU", accent: sudokuAccent, won: vm.state.status == .won,
                           guesses: vm.mistakes + 1, maxGuesses: SUDOKU_MAX_MISTAKES + 1, timeSeconds: vm.elapsed)
    }
}

// MARK: - Board

/// ONE continuous ruled grid (§8, founder round 5): hairline lilac rules
/// between cells, heavy rules around each 3 × 3 box and the edge, no per-cell
/// radius. Givens dark and heaviest, the player's digits purple, hint digits
/// violet, a wrong digit red; the selected cell in the stronger lilac fill
/// with its row, column and box washed; every cell holding the selected digit
/// emphasised. Pencil marks: the standard 3 × 3 mini-grid.
struct SudokuBoardView: View {
    let state: SudokuState
    let selected: Int?
    var revealSolution = false
    let onSelect: (Int) -> Void

    private let rule = Color(hex: 0xC4B5FD), heavy = Color(hex: 0x4C1D95)
    private let selectedFill = Color(hex: 0xDDD6FE), sameFill = Color(hex: 0xEDE9FE)
    private let player = Color(hex: 0x7C3AED), hint = Color(hex: 0x8B5CF6), wrong = Color(hex: 0xDC2626)

    private func boxOf(_ i: Int) -> Int { ((i / 9) / 3) * 3 + (i % 9) / 3 }
    private func ch(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let cell = side / 9
            let selRow = selected.map { $0 / 9 } ?? -1, selCol = selected.map { $0 % 9 } ?? -1, selBox = selected.map(boxOf) ?? -1
            let selDigit: Character? = selected.flatMap { ch(state.board, $0) == "0" ? nil : ch(state.board, $0) }
            ZStack {
                // Cells
                VStack(spacing: 0) {
                    ForEach(0..<9, id: \.self) { r in
                        HStack(spacing: 0) {
                            ForEach(0..<9, id: \.self) { c in
                                let i = r * 9 + c
                                cellView(i, cell: cell, inWash: r == selRow || c == selCol || boxOf(i) == selBox,
                                         isSelected: i == selected, selDigit: selDigit)
                            }
                        }
                    }
                }
                // Rules — hairlines everywhere, heavy on the box boundaries.
                Canvas { ctx, _ in
                    for k in 1..<9 {
                        let heavyLine = k % 3 == 0
                        let w: CGFloat = heavyLine ? 2 : 1
                        let color = heavyLine ? heavy : rule
                        let p = CGFloat(k) * cell
                        ctx.fill(Path(CGRect(x: p - w / 2, y: 0, width: w, height: side)), with: .color(color))
                        ctx.fill(Path(CGRect(x: 0, y: p - w / 2, width: side, height: w)), with: .color(color))
                    }
                }
                .allowsHitTesting(false)
            }
            .frame(width: side, height: side)
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(heavy, lineWidth: 2.5))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 420)
        .accessibilityLabel("Sudoku board")
    }

    @ViewBuilder
    private func cellView(_ i: Int, cell: CGFloat, inWash: Bool, isSelected: Bool, selDigit: Character?) -> some View {
        let given = ch(state.givens, i) != "0"
        let boardCh = ch(state.board, i)
        let revealed = revealSolution && boardCh == "0"
        let value: Character? = boardCh != "0" ? boardCh : (revealed ? ch(state.solution, i) : nil)
        let isWrong = ch(state.wrongMask, i) == "1"
        let hinted = ch(state.hintMask, i) == "1"
        let sameDigit = selDigit != nil && value == selDigit && !isSelected
        let color: Color = revealed ? Theme.textMuted : isWrong ? wrong : hinted ? hint : given ? Theme.textPrimary : player
        let bg: Color = isSelected ? selectedFill : sameDigit ? sameFill : inWash ? Theme.winBG : Color.clear
        Button { onSelect(i) } label: {
            ZStack {
                Rectangle().fill(bg)
                if let value {
                    Text(String(value)).font(Brand.font(min(24, cell * 0.55), given ? .black : .heavy)).foregroundStyle(color)
                } else if state.notes[i] != 0 {
                    let m = state.notes[i]
                    VStack(spacing: 0) {
                        ForEach(0..<3, id: \.self) { rr in
                            HStack(spacing: 0) {
                                ForEach(0..<3, id: \.self) { cc in
                                    let d = rr * 3 + cc
                                    Text((m & (1 << d)) != 0 ? "\(d + 1)" : " ")
                                        .font(Brand.font(max(9, cell * 0.24), .bold)).foregroundStyle(Theme.textSecondary)
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                }
                            }
                        }
                    }
                    .padding(cell * 0.08)
                }
            }
            .frame(width: cell, height: cell)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Row \(i / 9 + 1) column \(i % 9 + 1)\(value.map { ", \($0)" } ?? ", empty")\(given ? ", given" : "")\(isWrong ? ", wrong" : "")")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - Pad

/// Nine keys styled like KeyboardView's keys ("a smaller keyboard"), under the
/// action row: Undo · Erase · Notes · Hint, each with its icon (founder round
/// 13). Notes is a toggle: fixed label, state shown by filling with the accent.
struct SudokuPad: View {
    @ObservedObject var vm: SudokuVM

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                capsule("Undo", "arrow.uturn.backward", dim: vm.state.history.isEmpty) { vm.undo() }
                capsule("Erase", "eraser") { vm.erase() }
                capsule("Notes", "pencil", active: vm.state.notesMode) { vm.toggleNotes() }
                capsule(vm.hintsUsed > 0 ? "Hint · \(vm.hintsUsed)" : "Hint", "lightbulb") { vm.hint() }
            }
            HStack(spacing: 5) {
                ForEach(1...9, id: \.self) { d in
                    let done = vm.completeDigits.contains(d)
                    Button { vm.place(d) } label: {
                        Text("\(d)").font(Brand.font(20, .black)).foregroundStyle(Theme.keyInk)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(RoundedRectangle(cornerRadius: 6).fill(vm.state.notesMode ? sudokuAccent.opacity(0.08) : Theme.keyDefault))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(vm.state.notesMode ? sudokuAccent.opacity(0.35) : Theme.border, lineWidth: 1.5))
                            .opacity(done ? 0.4 : 1)
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("\(vm.state.notesMode ? "Note " : "")\(d)")
                }
            }
        }
        .padding(.horizontal, 2)
    }

    private func capsule(_ label: String, _ symbol: String, active: Bool = false, dim: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .foregroundStyle(dim ? Theme.textMuted.opacity(0.5) : active ? .white : sudokuAccent)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(active ? sudokuAccent : (dim ? Color.clear : sudokuAccent.opacity(0.05))))
                .overlay(Capsule().stroke(dim ? Theme.border : (active ? sudokuAccent : sudokuAccent.opacity(0.4)), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(dim)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

// MARK: - Completed-today card for custom engines

/// The Records / Profile "completed today" card for a More Games title: the
/// word-board reconstruction does not apply, so this shows the summary line
/// (through the mode's guess semantics) and the score breakdown.
struct CustomCompletedDailyCard: View {
    let mode: GameMode
    @State private var data: MatchStatsService.SolvedDaily?
    @State private var expanded = false
    @State private var reloadToken = 0

    var body: some View {
        Group {
            if let d = data {
                let g = ModeGen.byDbKey(mode.rawValue)
                let won = d.won
                VStack(spacing: 0) {
                    LinearGradient(colors: won ? [Color(hex: 0x7C3AED), Color(hex: 0xA78BFA)] : [Color(hex: 0x9CA3AF), Color(hex: 0xD1D5DB)],
                                   startPoint: .leading, endPoint: .trailing).frame(height: 4)
                    Button { withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { expanded.toggle() } } label: {
                        HStack(spacing: 8) {
                            Text(won ? "✓" : "✗").font(Brand.font(9, .black)).foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626))
                                .frame(width: 16, height: 16)
                                .background(Circle().fill(won ? Color(hex: 0xF5F3FF) : Color(hex: 0xFEE2E2)))
                            Text(won ? "COMPLETED TODAY" : "ATTEMPTED TODAY")
                                .font(Brand.font(10, .heavy)).tracking(0.6)
                                .foregroundStyle(won ? Color(hex: 0x7C3AED) : Theme.textMuted)
                            Spacer()
                            Text("\(formatGuessStat(semantics: g?.guessSemantics ?? "guesses", guessBase: g?.guessBase ?? 1, guessCount: d.guessCount)) · \(formatShortTime(d.timeSeconds))")
                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.textMuted).rotationEffect(.degrees(expanded ? 180 : 0))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }.buttonStyle(.plain)
                    if expanded {
                        ScoreBreakdownView(gameMode: mode.rawValue, completed: won, guessCount: d.guessCount,
                                           timeSeconds: d.timeSeconds, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                           hintsUsed: d.hintsUsed, day: LeaderboardService.todayLocal())
                            .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            } else {
                Color.clear.frame(height: 0)
            }
        }
        .onDailyRecorded { reloadToken += 1 }
        .task(id: "\(mode.rawValue)-\(reloadToken)") {
            data = nil
            let seed = generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: mode.rawValue)
            data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
        }
    }
}
