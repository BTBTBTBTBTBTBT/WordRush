import SwiftUI
import WordociousCore

// Daily Sudocious (More Games §4; catalog id `sudoku`) — the iOS twin of
// components/sudoku/*. One fixed
// Medium puzzle a day generated on the device from the daily seed; Pro
// Unlimited picks Easy / Medium / Hard. Three wrong digits lose; hints fill a
// cell and cost score but never a mistake. guess_count = mistakes + 1.

private let sudokuAccent = Color(hex: 0x1E40AF)
/// Player-facing name, read from the catalog (rename-proof: the id stays `sudoku`).
private let sudokuTitle = ModeGen.byId("sudoku")?.title ?? "Sudocious"
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
    private var pauseReasons: Set<String> = []
    private var pauseStart: Double?
    private var timerStarted = false
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
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { sudokuDailyNumber(LeaderboardService.todayLocal()) }

    func beginTimer() {
        let now = Date().timeIntervalSince1970 * 1000
        startMs = now - restoredElapsedMs; timerStarted = true
        if pauseStart != nil { pauseStart = now }
    }
    /// The clock stops while any pause reason is held (guide, background) and runs again once all are gone.
    func pauseClock(_ reason: String) {
        guard !isFinished else { return }
        pauseReasons.insert(reason)
        if pauseStart == nil { pauseStart = Date().timeIntervalSince1970 * 1000 }
    }
    func resumeClock(_ reason: String) {
        pauseReasons.remove(reason)
        guard pauseReasons.isEmpty, let s = pauseStart else { return }
        startMs += Date().timeIntervalSince1970 * 1000 - s; pauseStart = nil
    }
    func pauseForGuide() { pauseClock("guide") }
    func resumeFromGuide() { resumeClock("guide") }
    /// Leaving the app stops the clock and saves, so time away never counts even if iOS ends the app (founder, 2026-09-29).
    func setBackground(_ away: Bool) {
        if away { pauseClock("background"); if timerStarted && finalTimeSeconds == nil { persist() } } else { resumeClock("background") }
    }

    // MARK: - Persistence (mirrors components/sudoku/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: SudokuState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "sudoku-save-daily" : "sudoku-save-\(seed)" }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000

    private func persist() {
        // A finished Unlimited game is never resumed — drop its save (founder, 2026-09-29).
        if !isDaily && isFinished { UserDefaults.standard.removeObject(forKey: storageKey); return }
        let snap = Snapshot(seed: seed, date: LeaderboardService.todayLocal(), state: state, elapsed: elapsed, savedAt: Date().timeIntervalSince1970 * 1000)
        if let data = try? JSONEncoder().encode(snap) { UserDefaults.standard.set(data, forKey: storageKey) }
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        // Fail-closed: exact seed; the daily also re-checks the local date; practice honors the TTL.
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
        if wrong && !isFinished { Haptics.warning(); SoundManager.shared.playInvalid() } else { SoundManager.shared.playKeyTap() }
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
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
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
    @Environment(\.scenePhase) private var scenePhase
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
            PageBackground(tint: .forGame(.sudoku))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the board scaled
                // to the height left, the dock; the breakdown sits below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 6) { header; resultHeadline }
                } board: { _ in
                    board.padding(.horizontal, 6)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "SUDOKU", game: sudokuTitle, onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?(vm.state.difficulty) } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    result
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // FINISH_SPEC §Z: the Unlimited picker's slot is reserved in Daily too
                    // (empty there), so a Pro's board sits at the same spot in both modes.
                    let slots = GameHeaderLayout.slots(mode: vm.isDaily ? .daily : .unlimited, offersPicker: isPro)
                    if slots.pickerHeight > 0 {
                        difficultyPicker
                            .frame(height: CGFloat(slots.pickerHeight))
                            .opacity(slots.showsPicker ? 1 : 0)
                            .allowsHitTesting(slots.showsPicker)
                            .accessibilityHidden(!slots.showsPicker)
                    }
                    Spacer(minLength: 4)
                    board.padding(.horizontal, 6)
                    Spacer(minLength: 4)
                    // // §BI9: the feedback popup hangs from the line under the board — never over the title art or the board.
                    SudokuPad(vm: vm).padding(.bottom, 6).gameFeedbackToast(vm.toast, alignment: .top)
                }
                .padding(.horizontal, 10)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.mistakes, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISTAKES",
                    points: Int(DailyScoring.breakdown(gameMode: GameMode.sudoku.rawValue, completed: vm.state.status == .won,
                                                       guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                                                       boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                                                       hintsUsed: vm.hintsUsed).total),
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?(vm.state.difficulty) } : nil,
                    game: .sudoku,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            // Corner Home + "?" buttons — the same pair as every game (§19).
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .sudoku) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.sudoku))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("SUDOKU")
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

    /// The corner controls (HEADER_SPEC §4): Home as a soft white circle, Help with the 3D icon.
    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        GameCornerButton(kind: symbol == "questionmark" ? .help : .home, action: action)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text(ModeStyle.title(.sudoku)).font(Brand.font(24, .black)).foregroundStyle(sudokuAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.sudoku)
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
                            Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))").monospacedDigit()
                        }
                        .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
    }

    /// Pro Unlimited: Easy · Medium · Hard capsules; switching starts a fresh puzzle.
    private var difficultyPicker: some View {
        HStack(spacing: 8) {
            ForEach(SudokuDifficulty.allCases, id: \.self) { d in
                let active = d == vm.state.difficulty
                Button { if !active { onPlayAgain?(d) } } label: {
                    // §A1 / §A9: tinted options; the selected one the stronger tint + ring.
                    Text(difficultyLabel[d] ?? d.rawValue).font(Brand.font(11, .black))
                        .foregroundStyle(active ? (Theme.isDark ? Color.white : sudokuAccent) : FinishInk.secondary)
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Capsule().fill(PuzKit.face(sudokuAccent, active ? 0.24 : 0.08)))
                        .overlay(Capsule().stroke(active ? sudokuAccent : PuzKit.line(sudokuAccent, 0.3), lineWidth: active ? 2 : 1.5))
                }
                .buttonStyle(.squish)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
    }

    private var board: some View {
        SudokuBoardView(state: vm.state, selected: vm.isFinished ? nil : vm.selected,
                        revealSolution: vm.state.status == .lost, tray: true) { cell in
            if !vm.isFinished { vm.selected = cell; Haptics.tap() }
        }
    }

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.state.status == .won
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? "\(sudokuTitle) solved" : "Out of mistakes", won: won)
            PuzResultLine(won: won, items: [("\(vm.mistakes)", vm.mistakes == 1 ? "mistake" : "mistakes"),
                                                  (puzClock(vm.elapsed), "time")],
                                points: points)
        }
    }

    private var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.sudoku.rawValue, completed: vm.state.status == .won,
                                   guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                                   boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                                   hintsUsed: vm.hintsUsed).total)
    }

    /// Below the dock (§R2): the full summary line, the daily rank and the breakdown.
    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let remaining = sudokuRemaining(vm.state)
        return VStack(spacing: 10) {
            Text(won
                 ? "\(formatGuessStat(semantics: "mistakes", guessBase: 1, guessCount: vm.mistakes + 1)) · \(timeText(secs))\(vm.hintsUsed > 0 ? " · \(vm.hintsUsed) hint\(vm.hintsUsed == 1 ? "" : "s")" : "")"
                 : "\(remaining) cell\(remaining == 1 ? "" : "s") left · \(timeText(secs))")
                .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(sudokuAccent)
            if vm.isDaily { DailyRankBadge(gameMode: .sudoku) }
            ScoreBreakdownView(gameMode: GameMode.sudoku.rawValue, completed: won,
                               guessCount: vm.mistakes + 1, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.vertical, 12)
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.sudoku.rawValue, surface: "post_game")
        ShareService.share(kind: .sudoku(givens: vm.state.givens, board: vm.state.board, hintMask: vm.state.hintMask,
                                         mistakes: vm.mistakes, difficulty: difficultyLabel[vm.state.difficulty] ?? "Medium",
                                         puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .sudoku, modeLabel: ModeStyle.title(.sudoku), accent: sudokuAccent, won: vm.state.status == .won,
                           guesses: vm.mistakes + 1, maxGuesses: SUDOKU_MAX_MISTAKES + 1, timeSeconds: vm.elapsed,
                           points: Int(DailyScoring.breakdown(gameMode: GameMode.sudoku.rawValue, completed: vm.state.status == .won,
                                                              guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                                                              boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                                                              hintsUsed: vm.hintsUsed).total),
                           puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}

// MARK: - Board

/// ONE continuous ruled grid (§8, founder round 5): hairline lilac rules
/// between cells, heavy rules around each 3 × 3 box and the edge, no per-cell
/// radius. Givens dark and heaviest, the player's digits purple, hint digits
/// violet, a wrong digit red; the selected cell the solid purple tile with a
/// deep ring, every other cell holding its digit the medium lavender tile, its
/// row, column and box pale lavender (FINISH_SPEC BI6). Pencil marks: the
/// standard 3 × 3 mini-grid, the selected digit's mark bold purple.
struct SudokuBoardView: View {
    let state: SudokuState
    let selected: Int?
    var revealSolution = false
    /// §L: sit the grid on the shared game tray (the live game; recaps tray at
    /// their own call sites).
    var tray = false
    let onSelect: (Int) -> Void

    private let rule = Color(hex: 0xC4B5FD), heavy = Color(hex: 0x4C1D95)
    private let selectedFill = Color(hex: 0xDDD6FE), sameFill = Color(hex: 0xEDE9FE)
    private let player = Color(hex: 0x7C3AED), hint = Color(hex: 0x8B5CF6), wrong = Color(hex: 0xDC2626)

    private func boxOf(_ i: Int) -> Int { ((i / 9) / 3) * 3 + (i % 9) / 3 }
    private func ch(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }

    var body: some View {
        GeometryReader { geo in
            // FINISH_SPEC §B5: the shared board-sizing rule (2% side margin, centered).
            // §L: the tray's padding (both sides) and lip come out of the budget first.
            let pad: CGFloat = tray ? GameTray.padding * 2 : 0
            let lip: CGFloat = tray ? GameTray.lip : 0
            let cell = CGFloat(BoardSizing.fitTile(widthUnits: 9, heightUnits: 9,
                                                   width: Double(geo.size.width - pad / CGFloat(BoardSizing.widthFill)),
                                                   height: Double(geo.size.height - (pad + lip) / CGFloat(BoardSizing.heightFill)),
                                                   maxTile: 420 / 9, minTile: 10))
            let side = cell * 9
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
                // §L: the tiles separate the cells; the 3 × 3 boxes are parted by
                // soft darker seams in the tray color — never black lines.
                Canvas { ctx, _ in
                    let seam = GameTray.seam(sudokuAccent, strong: true)
                    for k in [3, 6] {
                        let w: CGFloat = max(2, cell * 0.07)
                        let p = CGFloat(k) * cell
                        ctx.fill(Path(roundedRect: CGRect(x: p - w / 2, y: cell * 0.1, width: w, height: side - cell * 0.2),
                                      cornerRadius: w / 2), with: .color(seam))
                        ctx.fill(Path(roundedRect: CGRect(x: cell * 0.1, y: p - w / 2, width: side - cell * 0.2, height: w),
                                      cornerRadius: w / 2), with: .color(seam))
                    }
                }
                .allowsHitTesting(false)
            }
            .frame(width: side, height: side)
            .modifier(SudokuTrayChrome(tray: tray, state: state.status == .won ? .won : (state.status == .lost ? .lost : .normal)))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 420)
        .accessibilityLabel("\(sudokuTitle) board")
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
        let bg: Color = isSelected ? selectedFill.opacity(Theme.isDark ? 0.35 : 1) : sameDigit ? sameFill.opacity(Theme.isDark ? 0.25 : 1)
            : inWash ? sudokuAccent.opacity(Theme.isDark ? 0.14 : 0.07) : Color.clear
        // FINISH_SPEC §B1: digits ride the game-kit tiles — a given clue is a plain
        // light tile with a dark purple digit; your numbers are purple tiles (a hint
        // too), a wrong entry the red conflict tile; empty cells are frosted glass.
        // FINISH_SPEC BI6: selection reads at a glance on the tile faces themselves
        // (the old fill behind the tile hid under it). The selected cell is the solid
        // purple tile with a deep ring; every other cell with its digit the medium
        // lavender tile; its row, column and box a pale lavender. Red stays on top.
        let face: GlossyFace = {
            if revealed { return .hintUsed }
            if isWrong && value != nil { return .conflict }
            if isSelected { return .correct }
            if sameDigit { return .sudokuSame }
            if value == nil { return inWash ? .sudokuWashEmpty : .empty }
            if given { return inWash ? .sudokuWashGiven : .given }
            return .correct
        }()
        let tileSide = cell * 0.9
        let digit = value.map(String.init) ?? ""
        Button { onSelect(i) } label: {
            ZStack {
                RoundedRectangle(cornerRadius: cell * 0.18, style: .continuous).fill(bg)
                GlossyTile(face: face, letter: revealed ? "" : digit, width: tileSide,
                           letterScale: given ? 0.58 : 0.56)
                    .modifier(TypePop(letter: given ? "" : digit, size: CGSize(width: tileSide, height: tileSide)))
                    .overlay {
                        if revealed {
                            Text(digit).font(Brand.fixedFont(tileSide * 0.5, .heavy)).foregroundStyle(color)
                        }
                        if isSelected {
                            RoundedRectangle(cornerRadius: tileSide * 0.22, style: .continuous)
                                .strokeBorder(Color(hex: 0x2E1065), lineWidth: max(2, tileSide * 0.075))
                        }
                    }
                if value == nil && state.notes[i] != 0 {
                    let m = state.notes[i]
                    VStack(spacing: 0) {
                        ForEach(0..<3, id: \.self) { rr in
                            HStack(spacing: 0) {
                                ForEach(0..<3, id: \.self) { cc in
                                    let d = rr * 3 + cc
                                    // BI6: the selected digit's pencil mark goes bold purple.
                                    let match = selDigit == Character("\(d + 1)") && (m & (1 << d)) != 0
                                    Text((m & (1 << d)) != 0 ? "\(d + 1)" : " ")
                                        .font(Brand.font(max(9, cell * (match ? 0.27 : 0.24)), match ? .black : .bold))
                                        .foregroundStyle(isSelected ? Color.white : match ? Color(hex: 0x6D28D9) : Color(hex: 0x8A78AD))
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                }
                            }
                        }
                    }
                    .padding(cell * 0.1)
                }
            }
            .frame(width: cell, height: cell)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
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
                capsule("Undo", "arrow.uturn.backward", variant: .peach, dim: vm.state.history.isEmpty) { vm.undo() }
                capsule("Erase", "eraser", variant: .peach) { vm.erase() }
                capsule("Notes", "pencil", variant: vm.state.notesMode ? .purple : .teal, active: vm.state.notesMode) { vm.toggleNotes() }
                capsule("Hint", "lightbulb", variant: .amber, count: vm.hintsUsed) { vm.hint() }
            }
            HStack(spacing: 5) {
                ForEach(1...9, id: \.self) { d in
                    let done = vm.completeDigits.contains(d)
                    Button { vm.place(d) } label: {
                        // FINISH_SPEC §B2: the number keys are key tiles too.
                        KeyCap(state: nil, fill: vm.state.notesMode ? sudokuAccent.wash(0.18) : nil, height: 48) {
                            Text("\(d)").font(Brand.font(20, .black))
                                .foregroundStyle(vm.state.notesMode ? sudokuAccent : FinishInk.softNumber)
                        }
                        .opacity(done ? 0.4 : 1)
                    }
                    .buttonStyle(KeyPressStyle())
                    .accessibilityLabel("\(vm.state.notesMode ? "Note " : "")\(d)")
                }
            }
        }
        .padding(.horizontal, 2)
        // Hardware keys (founder, 2026-09-30): web sudoku-game keydown — 1–9
        // place, Delete / 0 erase, N notes, H hint, ⌘Z undo, arrows move.
        .hardwareKeyboard(enabled: !vm.isFinished) { key in
            switch key {
            case .digit(let d) where d >= 1: vm.place(d)
            case .digit, .delete: vm.erase()
            case .letter("N"): vm.toggleNotes()
            case .letter("H"): vm.hint()
            case .undo: vm.undo()
            case .up, .down, .left, .right:
                // Nothing selected yet: the first arrow lands on the top-left
                // cell without moving (web sudoku-game, 14914522).
                guard let cur = vm.selected else { vm.selected = 0; return true }
                let r = cur / 9, c = cur % 9
                switch key {
                case .up where r > 0: vm.selected = cur - 9
                case .down where r < 8: vm.selected = cur + 9
                case .left where c > 0: vm.selected = cur - 1
                case .right where c < 8: vm.selected = cur + 1
                default: break
                }
            default: return false
            }
            return true
        }
    }

    /// §A8: the action row's small candy pills (peach Undo / Erase, teal Notes —
    /// purple while on — amber Hint). Four share the row, so the pills flex.
    private func capsule(_ label: String, _ symbol: String, variant: CandyButtonStyle.Variant, active: Bool = false, dim: Bool = false,
                         count: Int = 0, action: @escaping () -> Void) -> some View {
        // Four pills share one row: the icons ride along only on wide phones.
        // §BI22: a used count is the gold corner coin, never part of the label.
        Button(action: action) { CandyLabel(title: label, symbol: UIScreen.main.bounds.width >= 400 ? symbol : nil) }
        .buttonStyle(CandyButtonStyle(variant: variant, size: .small, fullWidth: true))
        .hintCountBadge(count)
        .disabled(dim)
        .accessibilityLabel(count > 0 ? "\(label) (\(count) used)" : label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

// MARK: - Completed-today card for custom engines

/// The Records / Profile "completed today" card for a More Games title: the
/// summary line (through the mode's guess semantics), then — expanded — the
/// finished puzzle rebuilt from today's matches row (CompletedCustomBoard;
/// founder, 2026-09-29) above the score breakdown. A row that can't be rebuilt
/// shows the breakdown alone.
struct CustomCompletedDailyCard: View {
    let mode: GameMode
    @State private var data: MatchStatsService.SolvedDaily?
    @State private var board: CompletedCustomBoard?
    @State private var progress: CompletedCustomBoard.Progress?
    @State private var expanded = false
    @State private var reloadToken = 0
    /// BJ7: inside the Leaderboard result card the toggle reads YOUR BOARD alone (no duplicate line).
    @Environment(\.lbCardEmbedded) private var embedded

    /// The header paints from the day's disk copy in the first frame (founder, 2026-09-29).
    init(mode: GameMode) {
        self.mode = mode
        _data = State(initialValue: CompletedDailyCard.readCache(mode: mode, seed: DailySeed.today(mode: mode)))
    }

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
                            Text(embedded ? "YOUR BOARD" : won ? "COMPLETED TODAY" : "ATTEMPTED TODAY")
                                .font(Brand.font(10, .heavy)).tracking(0.6)
                                .foregroundStyle(won ? Color(hex: 0x7C3AED) : Theme.textMuted)
                            Spacer()
                            if !embedded {
                                Text("\(formatGuessStat(semantics: g?.guessSemantics ?? "guesses", guessBase: g?.guessBase ?? 1, guessCount: d.guessCount)) · \(formatShortTime(d.timeSeconds))")
                                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            }
                            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.textMuted).rotationEffect(.degrees(expanded ? 180 : 0))
                        }
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .contentShape(Rectangle())
                    }.buttonStyle(.squish)
                    if expanded {
                        VStack(spacing: 8) {
                            if let board { CompletedCustomBoardView(board: board) }
                            ScoreBreakdownView(gameMode: mode.rawValue, completed: won, guessCount: d.guessCount,
                                               timeSeconds: d.timeSeconds, boardsSolved: progress?.boardsSolved ?? (won ? 1 : 0),
                                               totalBoards: progress?.totalBoards ?? 1, hintsUsed: progress?.hintsUsed ?? d.hintsUsed,
                                               day: LeaderboardService.todayLocal())
                        }
                        .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                    }
                }
                // The soft completed-board card (Leaderboard / Records redesign): radius 14,
                // soft shadow, no border.
                .lbCard()
            } else {
                Color.clear.frame(height: 0)
            }
        }
        .onDailyRecorded { reloadToken += 1 }
        .task(id: "\(mode.rawValue)-\(reloadToken)") {
            let seed = DailySeed.today(mode: mode)
            // The day's disk copy first (seeded in init for the header), then the board from it, then
            // a silent refresh — this card used to wait on the network on every mode switch.
            if let d = data, board == nil {
                let built = CompletedCustomBoard.build(mode: mode, seed: seed, row: d)
                board = built.board; progress = built.progress
            }
            guard let fresh = await MatchStatsService.solvedDaily(mode: mode, seed: seed) else { return }
            CompletedDailyCard.writeCache(fresh, mode: mode, seed: seed)
            let built = CompletedCustomBoard.build(mode: mode, seed: seed, row: fresh)
            board = built.board; progress = built.progress; data = fresh
        }
    }
}

/// §L: the Sudocious grid's chrome — the shared game tray in the live game (won
/// purple / lost slate), or a soft tinted panel (no dark rule) in a recap.
private struct SudokuTrayChrome: ViewModifier {
    let tray: Bool
    let state: GameTrayState

    @ViewBuilder
    func body(content: Content) -> some View {
        if tray {
            content.gameTray(accent: sudokuAccent, state: state)
        } else {
            let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
            content
                .padding(4)
                .background(shape.fill(PuzKit.face(sudokuAccent, 0.09)))
                .overlay(shape.strokeBorder(PuzKit.line(sudokuAccent, 0.3), lineWidth: 1.5))
        }
    }
}
