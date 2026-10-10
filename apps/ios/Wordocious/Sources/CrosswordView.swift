import SwiftUI
import WordociousCore

// Crosswordocious (More Games §13) — the iOS twin of components/crossword/*.
// A themed fill-in sayings crossword: a sparse criss-cross of purple tiles
// where every clue is a familiar phrase with one blank and the answer is the
// missing word; the title is the theme. Tap a cell or a clue, type; letters
// are free to set and clear. Check locks right letters, clears wrong ones and
// counts (guess_count = min(checks, 98) + 1). Reveal a letter (1 hint) or a
// word (2 hints). "Reveal all" is the only loss. The grid completes itself the
// moment every cell is right.

private let crosswordAccent = Color(hex: 0x475569)
/// One purple look (founder, §13): every cell the purple tile tint, every number purple; nothing marks the theme.
private let cwCellBG = Color(hex: 0xEDE9FE), cwCellBorder = Color(hex: 0xC4B5FD), cwCellText = Color(hex: 0x5B21B6)
private let cwPurple = Color(hex: 0x7C3AED), cwLockedBG = Color(hex: 0xDDD6FE), cwHint = Color(hex: 0x8B5CF6), cwWrong = Color(hex: 0xDC2626)

/// The bundled bank (Resources/crossword-puzzles.json — sha-guarded to match the web copy).
enum CrosswordBankStore {
    static let shared: CrosswordBank? = {
        guard let url = Bundle.main.url(forResource: "crossword-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return CrosswordBank.load(from: data)
    }()
}

@MainActor
final class CrosswordVM: ObservableObject {
    @Published private(set) var state: CrosswordState
    @Published private(set) var selected: Int?
    @Published private(set) var dir: CrosswordDir = .across
    @Published private(set) var armReveal = false
    @Published var toast: String?
    /// BI18: the clue list in place of the grid (the Clues toggle beside the clue bar).
    @Published var showClues = false
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    let isDaily: Bool
    let seed: String
    /// The holiday list this puzzle came from (nil on an ordinary day).
    let holidayKey: String?

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    private var pauseReasons: Set<String> = []
    private var pauseStart: Double?
    private var timerStarted = false
    private var recorded = false
    private(set) var restoredFinished = false
    private var armTask: Task<Void, Never>?

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        let today = LeaderboardService.todayLocal()
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.crossword.rawValue)
        let bank = CrosswordBankStore.shared ?? CrosswordBank(version: 1, epoch: CROSSWORD_DAILY_EPOCH, daily: [], extra: [])
        let fallback = CrosswordPuzzle(id: "none", title: "Keep At It", theme: "keep", w: 4, h: 4, entries: [
            CrosswordEntry(n: 1, dir: .across, r: 0, c: 0, answer: "KEEP", clue: "___ calm and carry on"),
            CrosswordEntry(n: 1, dir: .down, r: 0, c: 0, answer: "KIND", clue: "One of a ___"),
        ])
        let puzzle = (seed == nil ? crosswordPuzzleForDay(bank, day: today, holidays: HolidayTable.bundled) : crosswordPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        holidayKey = bank.holiday?.first(where: { $0.value.contains { $0.id == puzzle.id } })?.key
        state = createCrosswordState(puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
        selected = Self.firstOpenCell(state)
        dir = state.entries.first?.dir ?? .across
    }
    /// Read-only: a finished board rebuilt from a matches row (the Completed-today dropdown). Never saves or records.
    init(display s: CrosswordState) {
        isDaily = true; seed = s.seed; holidayKey = nil; state = s; finalTimeSeconds = 0; recorded = true; restoredFinished = true
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { crosswordDailyNumber(LeaderboardService.todayLocal()) }
    var holidayTitle: String? { HolidayTitles.title(holidayKey) }
    var guessCount: Int { crosswordGuessCount(state.checks) }
    var filled: Int { crosswordCorrectCount(state) }
    var total: Int { crosswordLetterCount(state) }
    var checksLabel: String { state.checks == 0 ? "No checks" : "\(state.checks) check\(state.checks == 1 ? "" : "s")" }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.crossword.rawValue, completed: state.status == .won, guessCount: guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.status == .won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
    }
    /// The entry the cursor is on in the current direction (else whichever passes through the cell).
    var activeEntry: CrosswordEntry? {
        guard !isFinished else { return nil }
        return crosswordActiveEntry(state, cell: selected, dir: dir)
    }
    var activeCells: [Int] { activeEntry.map { crosswordEntryCells(state, $0) } ?? [] }
    /// Clue number shown at each entry's first cell.
    var numbers: [Int: Int] {
        var out: [Int: Int] = [:]
        for e in state.entries { let start = e.r * state.w + e.c; if out[start] == nil { out[start] = e.n } }
        return out
    }

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

    // MARK: - Persistence (mirrors components/crossword/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: CrosswordState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "crossword-save-daily" : "crossword-save-\(seed)" }
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
        let stale = snap.seed != seed
            || (isDaily && snap.date != LeaderboardService.todayLocal())
            || (!isDaily && Date().timeIntervalSince1970 * 1000 - snap.savedAt > Self.practiceTTLms)
        if stale { UserDefaults.standard.removeObject(forKey: storageKey); return }
        state = snap.state
        restoredElapsedMs = Double(snap.elapsed) * 1000
        if state.status != .playing { finalTimeSeconds = snap.elapsed; recorded = true; restoredFinished = true }
    }

    // MARK: - Selection (web selectCell / pickEntry / advance parity)

    private static func firstOpenCell(_ s: CrosswordState) -> Int? {
        guard let e = s.entries.first else { return nil }
        let cells = crosswordEntryCells(s, e), fill = Array(s.fill)
        return cells.first(where: { fill[$0] == CROSSWORD_EMPTY }) ?? cells.first
    }

    /// Tap a cell: a second tap on the cursor switches Across/Down when both pass through it.
    func selectCell(_ cell: Int) {
        guard !isFinished, Array(state.solution)[cell] != CROSSWORD_BLOCK else { return }
        SoundManager.shared.playKeyTap()
        let here = crosswordEntriesAt(state, cell: cell)
        if cell == selected { dir = crosswordToggleDir(state, cell: cell, dir: dir); return }
        if !here.isEmpty, !here.contains(where: { $0.dir == dir }) { dir = here[0].dir }
        selected = cell
    }
    /// Tap a clue: its first empty cell (else its first cell) in its direction.
    func pickEntry(_ e: CrosswordEntry) {
        guard !isFinished else { return }
        SoundManager.shared.playKeyTap()
        let cells = crosswordEntryCells(state, e), fill = Array(state.fill)
        dir = e.dir
        selected = cells.first(where: { fill[$0] == CROSSWORD_EMPTY }) ?? cells.first
        showClues = false  // BI18: a picked clue goes back to the grid
    }
    /// The clue bar / Space: flips only where Across and Down both pass through the cursor's cell.
    func toggleDirection() { guard !isFinished else { return }; SoundManager.shared.playKeyTap(); dir = crosswordToggleDir(state, cell: selected, dir: dir) }
    /// Arrow keys on a hardware keyboard (web crossword-game keydown): hop to
    /// the next open cell that way, skipping blocks; direction follows the arrow.
    func moveCursor(dr: Int, dc: Int) {
        guard !isFinished, let sel = selected else { return }
        let sol = Array(state.solution), w = state.w, h = state.h
        var r = sel / w, c = sel % w
        for _ in 0..<max(w, h) {
            r += dr; c += dc
            if r < 0 || c < 0 || r >= h || c >= w { return }
            let i = r * w + c
            if sol[i] != CROSSWORD_BLOCK { selected = i; dir = dr != 0 ? .down : .across; return }
        }
    }

    /// After typing (core crosswordCursorAfterType): the typed entry owns the direction until it is complete,
    /// so a cell that starts another word never turns it (Doug 10-05: 1-Across ran down 2-Down).
    private func advance(from: Int, entry: CrosswordEntry?) {
        guard let next = crosswordCursorAfterType(state, from: from, entry: entry) else { return }
        dir = next.dir; selected = next.cell
    }

    // MARK: - Actions

    private func dispatch(_ a: CrosswordAction) {
        guard !isFinished else { return }
        state = crosswordReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if case .check = a {
            let n = state.lastWrong.count
            if n > 0 { flash("\(n) wrong letter\(n == 1 ? "" : "s") cleared"); Haptics.warning(); SoundManager.shared.playInvalid() }
            else { flash("Everything filled is right"); SoundManager.shared.playFound() }
            Task { try? await Task.sleep(nanoseconds: 700_000_000); if !state.lastWrong.isEmpty { state.lastWrong = [] } }
        }
        if state.status != .playing { finish() }
        persist()
    }

    func setLetter(_ letter: String) {
        guard !isFinished, let sel = selected else { return }
        if Array(state.locked)[sel] == "1" { flash("That letter is locked"); return }
        let entry = activeEntry
        dispatch(.set(cell: sel, letter: letter.uppercased()))
        guard !isFinished else { return }
        advance(from: sel, entry: entry)
    }
    func deleteLetter() {
        guard !isFinished, let sel = selected else { return }
        let fill = Array(state.fill), locked = Array(state.locked)
        if fill[sel] != CROSSWORD_EMPTY, locked[sel] == "0" { dispatch(.clear(cell: sel)); return }
        let cells = activeCells
        if let k = cells.firstIndex(of: sel), k > 0 {
            let prev = cells[k - 1]
            if let e = activeEntry { dir = e.dir }
            selected = prev
            if locked[prev] == "0" { dispatch(.clear(cell: prev)) }
        }
    }
    /// ENTER jumps to the next unfinished entry.
    func nextEntry() {
        guard !isFinished, let entry = activeEntry, let next = crosswordNextEntryCursor(state, entry: entry) else { return }
        dir = next.dir; selected = next.cell
    }
    func check() {
        guard !isFinished else { return }
        let fill = Array(state.fill), locked = Array(state.locked)
        let any = fill.indices.contains { fill[$0] != CROSSWORD_EMPTY && fill[$0] != CROSSWORD_BLOCK && locked[$0] == "0" }
        if any { dispatch(.check) } else { flash("Fill in some letters first") }
    }
    func revealLetter() { guard !isFinished, let sel = selected else { return }; Haptics.tap(); dispatch(.revealLetter(cell: sel)) }
    func revealWord() { guard !isFinished, let e = activeEntry else { return }; Haptics.tap(); dispatch(.revealWord(n: e.n, dir: e.dir)) }
    /// Two-tap: the first tap arms for three seconds and warns; the second reveals the grid and records a loss.
    func revealPuzzle() {
        guard !isFinished else { return }
        if !armReveal {
            armReveal = true
            flash("Tap again to reveal the whole puzzle (records a loss)")
            armTask?.cancel()
            armTask = Task { try? await Task.sleep(nanoseconds: 3_000_000_000); if !Task.isCancelled { armReveal = false } }
            return
        }
        armTask?.cancel(); armReveal = false
        Haptics.error()
        dispatch(.revealPuzzle)
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = guessCount, used = state.hintsUsed
        let row = crosswordMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .crossword, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .crossword, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.crossword.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct CrosswordView: View {
    @StateObject private var vm: CrosswordVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: CrosswordVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.crossword))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the grid scaled
                // to the height left, the dock; the clues (with their answers) and the
                // breakdown sit below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 4) { header; resultHeadline }
                } board: { size in
                    CrosswordGridView(vm: vm, finished: true, width: size.width, tray: true, maxHeight: size.height)
                        .frame(maxHeight: .infinity)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "CROSSWORD", game: "Crosswordocious", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    VStack(spacing: 12) {
                        CrosswordClueColumns(vm: vm, finished: true)
                        result
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 10)
            } else {
                // BI18 (founder 10-03: "the daily today required you to scroll"): the whole
                // puzzle fits one screen in play — the compact header, the grid sized from
                // the band's width AND height for its real columns × rows (CrosswordFit),
                // the clue bar and the keyboard pinned. The clue list sits behind the
                // Clues toggle beside the clue bar (it scrolls inside the band).
                VStack(spacing: 6) {
                    playHeader
                    GeometryReader { geo in
                        ScrollView {
                            Group {
                                if vm.showClues {
                                    CrosswordClueColumns(vm: vm, finished: false)
                                } else {
                                    CrosswordGridView(vm: vm, finished: false, width: geo.size.width, tray: true,
                                                      maxHeight: geo.size.height, minCell: CGFloat(CrosswordFit.minCell))
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: geo.size.height)
                        }
                        .scrollDisabled(!vm.showClues)
                    }
                    VStack(spacing: 8) {
                        // §BI22: the clue bar's fixed two-line slot is ALWAYS there (empty
                        // with no active entry) so the grid never resizes.
                        HStack(spacing: 6) {
                            CrosswordActiveClueBar(entry: vm.activeEntry) { vm.toggleDirection() }
                            CrosswordCluesToggle(showing: vm.showClues) { SoundManager.shared.playKeyTap(); vm.showClues.toggle() }
                        }
                        .frame(maxWidth: 700)
                        // §A8: candy pills — purple Check, amber Letter, pink Word, peach
                        // Reveal all (pink once armed). §BI22: one row of equal quarters on the
                        // widest phones, else two rows of halves — chosen by the SCREEN, never
                        // the labels ("Word · 1", "Reveal all?" used to flip the rows and
                        // shrink the grid).
                        Group {
                            if Self.pillsInOneRow {
                                HStack(spacing: 6) { controlPills }
                            } else {
                                VStack(spacing: 6) {
                                    HStack(spacing: 6) { checkPill; letterPill }
                                    HStack(spacing: 6) { wordPill; revealPill }
                                }
                            }
                        }
                        .frame(maxWidth: 440)
                        // Hardware keys (founder, 2026-09-30): web crossword-game keydown —
                        // A–Z / Delete as the keys, arrows move the cursor, Return or
                        // Tab = next entry, Space flips Across/Down.
                        StagedSlot(key: "crosswordKeys", estimate: 3 * (UIScreen.main.bounds.height < 700 ? 44 : 52) + 14) {   // BJ14
                        LetterKeyboard(onLetter: { vm.setLetter($0) }, onEnter: { vm.nextEntry() }, onDelete: { vm.deleteLetter() },
                                       onHardwareKey: { key in
                                           switch key {
                                           case .left: vm.moveCursor(dr: 0, dc: -1)
                                           case .right: vm.moveCursor(dr: 0, dc: 1)
                                           case .up: vm.moveCursor(dr: -1, dc: 0)
                                           case .down: vm.moveCursor(dr: 1, dc: 0)
                                           case .tab: vm.nextEntry(); SoundManager.shared.playKeyTap()
                                           case .space: vm.toggleDirection()
                                           default: return false
                                           }
                                           return true
                                       },
                                       // BI18: 44-pt keys on short phones (SE), like Muddle's one-screen rule.
                                       keyHeightOverride: UIScreen.main.bounds.height < 700 ? 44 : nil)
                        }
                    }
                    // §BI9: the feedback popup hangs from the clue bar / controls under the grid — never over the title art or the board.
                    .gameFeedbackToast(vm.toast, alignment: .top)
                    .padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.checks, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "CHECKS", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    game: .crossword,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .softSheet(isPresented: $showGuide) { GuideSheet(mode: .crossword) }
                .firstPlayGuide(mode: .crossword, show: $showGuide)
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.crossword))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("CROSSWORD")
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

    /// §BI22: the four control pills fit one row only on the widest phones.
    private static let pillsInOneRow = UIScreen.main.bounds.width >= 428

    @ViewBuilder private var controlPills: some View { checkPill; letterPill; wordPill; revealPill }
    private var checkPill: some View {
        PuzCandyAction(title: "Check", variant: .purple, fullWidth: true, count: vm.state.checks) {
            Haptics.tap(); SoundManager.shared.playKeyTap(); vm.check()
        }
    }
    private var letterPill: some View {
        PuzCandyAction(title: "Letter", symbol: Self.pillsInOneRow ? nil : "lightbulb", variant: .amber, fullWidth: true) { SoundManager.shared.playKeyTap(); vm.revealLetter() }
    }
    private var wordPill: some View {
        PuzCandyAction(title: "Word", symbol: Self.pillsInOneRow ? nil : "eye", variant: .pink, fullWidth: true, count: vm.state.hintsUsed) {
            SoundManager.shared.playKeyTap(); vm.revealWord()
        }
    }
    /// An armed Reveal all (tap again to confirm) turns from quiet peach to pink.
    private var revealPill: some View {
        PuzCandyAction(title: vm.armReveal ? "Reveal all?" : "Reveal all", variant: vm.armReveal ? .pink : .peach, fullWidth: true) { vm.revealPuzzle() }
    }

    private var header: some View {
        VStack(spacing: 3) {
            BubbleLabel("CROSSWORDOCIOUS", color: crosswordAccent, size: 27, minScale: 0.5, alignment: .center)
                .soloGameTitle(.crossword, fallbackInset: 48)
            BubbleOneLine(text: vm.state.title.uppercased(), palette: .accent(crosswordAccent), size: 15, minScale: 0.5)
                .lineLimit(1).minimumScaleFactor(0.7).padding(.horizontal, 48)
            metaLine
        }
    }

    /// BI18: the play header is compact like Muddle's (BI8) — the title art (≤ 44 pt)
    /// IN the corner-button row between Home and Help, then the title and the meta line.
    private var playHeader: some View {
        VStack(spacing: 2) {
            Group {
                if let art = GameTitleArt.forMode(.crossword) {
                    GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 44, minHeight: 0)
                } else {
                    BubbleLabel("CROSSWORDOCIOUS", color: crosswordAccent, size: 23, minScale: 0.5, alignment: .center)
                }
            }
            .frame(height: GameCornerButton.rowHeight - GameCornerButton.topInset)
            .padding(.horizontal, 44 + GameCornerButton.sideInset + 4)
            BubbleOneLine(text: vm.state.title.uppercased(), palette: .accent(crosswordAccent), size: 15, minScale: 0.5)
                .lineLimit(1).minimumScaleFactor(0.7).padding(.horizontal, 12)
            metaLine
        }
    }

    private var metaLine: some View {
        HStack(spacing: 8) {
            if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
            if let holiday = vm.holidayTitle { Text(holiday).font(Brand.caption(12)).foregroundStyle(crosswordAccent) }
            Text("\(vm.filled)/\(vm.total) letters").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            Text(vm.checksLabel).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            if !vm.isFinished {
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    HStack(spacing: 2) {
                        Image(systemName: "clock").font(.system(size: 9))
                        Text(timeText(vm.elapsed, clock: true))
                    }
                    .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                }
            }
        }
        .lineLimit(1).minimumScaleFactor(0.8)
    }

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.state.status == .won
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? (vm.state.checks == 0 ? "Grid finished clean" : "Grid finished") : "Puzzle revealed", won: won)
            PuzResultLine(won: won, items: [("\(vm.state.checks)", vm.state.checks == 1 ? "check" : "checks"),
                                                  (puzClock(vm.elapsed), "time")],
                                points: vm.points)
        }
    }

    /// Below the dock (§R2): the full summary line, the daily rank and the breakdown.
    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.guessCount
        let hints = vm.state.hintsUsed
        return VStack(spacing: 10) {
            Text("\(vm.checksLabel) · \(timeText(secs))\(hints > 0 ? " · \(hints) hint\(hints == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(cwPurple)
            if vm.isDaily { DailyRankBadge(gameMode: .crossword) }
            ScoreBreakdownView(gameMode: GameMode.crossword.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS, hintsUsed: hints,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.vertical, 12)
    }

    /// `clock` always reads m:ss (the header); the result line shortens under a
    /// minute to "42s" like the web formatTime.
    private func timeText(_ s: Int, clock: Bool = false) -> String {
        (clock || s >= 60) ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s"
    }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.crossword.rawValue, surface: "post_game")
        let n = vm.isDaily ? vm.dailyNumber : nil
        let won = vm.state.status == .won
        let outcome = won ? (vm.state.checks == 0 ? "Clean" : vm.checksLabel) : "Revealed"
        let caption = "Wordocious Crosswordocious\(n.map { " #\($0)" } ?? "") — Score \(vm.points) pts · Time \(timeText(vm.elapsed, clock: true)) · \(outcome) · wordocious.com/crosswordocious"
        ShareService.share(kind: .crossword(w: vm.state.w, h: vm.state.h, solution: vm.state.solution, checks: vm.state.checks, puzzleNumber: n),
                           mode: .crossword, modeLabel: "CROSSWORDOCIOUS", accent: crosswordAccent, won: won,
                           guesses: vm.guessCount, maxGuesses: 6, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: n, caption: caption)
    }
}

// MARK: - Board

/// The grid, always centered: a sparse criss-cross of purple tiles; blocks are
/// simply absent. The letter is centered in its cell exactly like a Classic
/// tile; the clue number is a tiny purple mark top-left that never touches the
/// letter. The active entry wears a 10% accent wash and the selected cell an
/// accent ring; Check-locked cells a deeper purple; revealed cells violet with
/// white ink; the cells a Check just cleared flash red.
struct CrosswordGridView: View {
    @ObservedObject var vm: CrosswordVM
    let finished: Bool
    /// The width to fit (a card narrower than the screen); nil = the phone less the page margins.
    var width: CGFloat? = nil
    /// §L: sit the grid on the shared game tray (the live game; recaps tray at
    /// their own call sites).
    var tray = false
    /// §R2: the height the grid may take (the finished screen scales it to fit;
    /// BI18: the play band, so the whole grid is on screen).
    var maxHeight: CGFloat? = nil
    /// The smallest cell (BI18: 14 pt in play; the finished screen keeps 8).
    var minCell: CGFloat = 8

    private let gap: CGFloat = 3

    /// Cell side that fits the grid's columns AND (when given) rows, capped like the
    /// web (42 pt) — BI18 / FINISH_SPEC §B5 (CrosswordFit, unit-tested; fixed 3-pt
    /// gaps). The tray's padding comes off the width; its padding + lip and the
    /// selection ring's room off the height.
    private var cell: CGFloat {
        CGFloat(CrosswordFit.cell(columns: vm.state.w, rows: vm.state.h,
                                  width: Double(width ?? UIScreen.main.bounds.width - 40), height: maxHeight.map(Double.init),
                                  chromeX: Double(tray ? GameTray.padding * 2 : 0),
                                  chromeY: Double((tray ? GameTray.padding * 2 + GameTray.lip : 0) + 6),
                                  gap: Double(gap), minCell: Double(minCell)))
    }

    var body: some View {
        let s = vm.state
        let sol = Array(s.solution), fill = Array(s.fill), locked = Array(s.locked), revealed = Array(s.revealed)
        let numbers = vm.numbers
        let active = finished ? Set<Int>() : Set(vm.activeCells)
        let wrong = Set(s.lastWrong)
        let side = cell
        VStack(spacing: gap) {
            ForEach(0..<s.h, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<s.w, id: \.self) { c in
                        let i = r * s.w + c
                        if sol[i] == CROSSWORD_BLOCK {
                            Color.clear.frame(width: side, height: side)
                        } else {
                            tile(i, letter: fill[i] == CROSSWORD_EMPTY ? "" : String(fill[i]),
                                 number: numbers[i], locked: locked[i] == "1", revealed: revealed[i] != ".",
                                 inActive: active.contains(i), wrong: wrong.contains(i), side: side)
                        }
                    }
                }
            }
        }
        .modifier(CrosswordTrayChrome(on: tray, state: finished ? (s.status == .won ? .won : .lost) : .normal))
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Crossword grid")
    }

    private func tile(_ i: Int, letter: String, number: Int?, locked: Bool, revealed: Bool, inActive: Bool, wrong: Bool, side: CGFloat) -> some View {
        let isSel = vm.selected == i && !finished
        // §J3: every cell is a B1 glossy tile — frosted when empty, the typed white
        // face once a letter is in, purple when Check locked it, purple with the
        // gold ring when revealed, red when a Check just cleared it.
        let face: GlossyFace = wrong ? .bad : (revealed || locked) ? .correct : (letter.isEmpty ? .empty : .typed)
        let radius = side * 0.22
        // Founder 10-06: every cell's letter is the same size and centered; the number is the small corner badge.
        return Button { vm.selectCell(i) } label: {
            ZStack(alignment: .topLeading) {
                GlossyTile(face: face, letter: letter, width: side, letterScale: side < 26 ? 0.56 : 0.5,
                           glowAmount: revealed ? 0.85 : 0, goldRing: revealed)
                    .modifier(TypePop(letter: (locked || revealed) ? "" : letter, size: CGSize(width: side, height: side)))
                // The active entry wears a soft accent wash over its tiles.
                if inActive && !revealed && !locked {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(cwPurple.opacity(0.10))
                        .frame(width: side, height: side * 0.93)
                        .allowsHitTesting(false)
                }
                if let number {
                    // The clue number: a small muted superscript fully inside the top-left corner (no chip on the
                    // border); the cursor ring is drawn outside the tile, so it never covers it.
                    let inset = CGFloat(CrosswordCellSpec.inset(cell: Double(side)))
                    Text("\(number)").font(Brand.fixedFont(CGFloat(CrosswordCellSpec.numberSize(cell: Double(side))), .black))
                        .foregroundStyle(face == .correct ? Color.white.opacity(0.85) : cwPurple.opacity(0.72))
                        .lineLimit(1).fixedSize()
                        .padding(.leading, inset).padding(.top, inset * 0.7)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .frame(width: side, height: side)
            .overlay(isSel ? RoundedRectangle(cornerRadius: radius + 3, style: .continuous).stroke(cwPurple, lineWidth: 2).padding(-3) : nil)
        }
        .buttonStyle(.squish)
        .disabled(finished)
        .accessibilityLabel("\(number.map { "\($0), " } ?? "")\(letter.isEmpty ? "empty" : letter)\(locked ? ", locked" : "")")
        .accessibilityAddTraits(isSel ? .isSelected : [])
    }
}

/// Across and Down side by side, centered under the board; solved entries are
/// struck through and dimmed, the active one highlighted; a tap selects the
/// entry's first empty cell. Finished, each answer follows its clue in purple.
struct CrosswordClueColumns: View {
    @ObservedObject var vm: CrosswordVM
    let finished: Bool

    var body: some View {
        // §A1: the clue list sits on a tinted card (purple top bar), not plain white.
        HStack(alignment: .top, spacing: 14) {
            column(.across, "Across")
            column(.down, "Down")
        }
        .padding(.horizontal, 10).padding(.vertical, 10)
        .tintedCard(accent: cwPurple, bar: [Color(hex: 0x8B5CF6), Color(hex: 0xC084FC)], radius: 18, barHeight: 6)
        .frame(maxWidth: 700)
        .padding(.horizontal, 4)
    }

    private func column(_ dir: CrosswordDir, _ title: String) -> some View {
        let s = vm.state
        let active = finished ? nil : vm.activeEntry
        return VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased()).font(Brand.font(10, .black)).tracking(1.5).foregroundStyle(FinishInk.secondary)
            ForEach(s.entries.filter { $0.dir == dir }, id: \.n) { e in
                let solved = crosswordEntrySolved(s, e)
                let isActive = active?.n == e.n && active?.dir == e.dir
                Button { vm.pickEntry(e) } label: {
                    HStack(alignment: .top, spacing: 6) {
                        Text("\(e.n)").font(Brand.font(10, .black)).foregroundStyle(FinishInk.softNumber)
                            .frame(width: 20, height: 20)
                            .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(cwCellBG))
                            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(cwCellBorder, lineWidth: 1))
                        (Text(e.clue).font(Brand.font(12, solved ? .semibold : .bold)).strikethrough(solved && !finished)
                         + (finished ? Text(" \(e.answer)").font(Brand.font(12, .black)).foregroundColor(cwPurple) : Text("")))
                            .foregroundStyle(Theme.textPrimary)
                            .opacity(solved && !finished ? 0.5 : 1)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 4).padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(isActive ? cwPurple.opacity(0.12) : Color.clear))
                }
                .buttonStyle(.squish)
                .disabled(finished)
                .accessibilityLabel("\(e.n) \(dir == .across ? "Across" : "Down"): \(e.clue)\(solved ? ", solved" : "")")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The sticky active-clue bar above the keyboard: a "3A" badge and the clue; tapping switches direction.
struct CrosswordActiveClueBar: View {
    /// nil = no active entry: the bar keeps its slot, empty (§BI22).
    let entry: CrosswordEntry?
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 8) {
                if let entry {
                    Text("\(entry.n)\(entry.dir.rawValue)").font(Brand.font(11, .black)).foregroundStyle(FinishInk.softNumber)
                        .frame(width: 26, height: 24)
                        .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(cwCellBG))
                        .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(cwCellBorder, lineWidth: 1))
                    Text(entry.clue).font(Brand.font(15, .heavy)).foregroundStyle(Theme.textPrimary)
                        .multilineTextAlignment(.leading).lineLimit(2).minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "arrow.left.arrow.right").font(.system(size: 14, weight: .bold)).foregroundStyle(crosswordAccent)
                } else {
                    Color.clear.frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            // BI18: a fixed two-line height so the grid never resizes between clues.
            .frame(height: 56)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(PuzKit.face(cwPurple, 0.10)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(PuzKit.line(cwPurple, 0.32), lineWidth: 1.5))
        }
        .buttonStyle(.squish)
        .disabled(entry == nil)
        .frame(maxWidth: 700)
        .accessibilityLabel(entry.map { "Active clue \($0.n) \($0.dir == .across ? "Across" : "Down"): \($0.clue). Tap to switch direction" } ?? "No clue selected")
    }
}

/// BI18: the Clues toggle beside the clue bar — the clue list takes the grid's
/// band (picking a clue goes back to the grid); "Grid" while the list shows.
struct CrosswordCluesToggle: View {
    let showing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: showing ? "square.grid.3x3" : "list.number").font(.system(size: 15, weight: .bold))
                Text(showing ? "Grid" : "Clues").font(Brand.font(10, .black))
            }
            .foregroundStyle(crosswordAccent)
            .frame(width: 52, height: 56)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(PuzKit.face(cwPurple, 0.10)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(PuzKit.line(cwPurple, 0.32), lineWidth: 1.5))
        }
        .buttonStyle(.squish)
        .accessibilityLabel(showing ? "Show the grid" : "Show all clues")
        .accessibilityAddTraits(showing ? .isSelected : [])
    }
}

/// §L: the crossword grid on the shared game tray (opt-in).
private struct CrosswordTrayChrome: ViewModifier {
    let on: Bool
    let state: GameTrayState

    @ViewBuilder
    func body(content: Content) -> some View {
        if on { content.gameTray(accent: cwPurple, state: state) } else { content }
    }
}
