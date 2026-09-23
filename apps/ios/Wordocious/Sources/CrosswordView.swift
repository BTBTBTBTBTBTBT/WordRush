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
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    let isDaily: Bool
    let seed: String
    /// The holiday list this puzzle came from (nil on an ordinary day).
    let holidayKey: String?

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    private var guidePauseStart: Double?
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

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
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
        guard let sel = selected, !isFinished else { return nil }
        let here = crosswordEntriesAt(state, cell: sel)
        return here.first(where: { $0.dir == dir }) ?? here.first
    }
    var activeCells: [Int] { activeEntry.map { crosswordEntryCells(state, $0) } ?? [] }
    /// Clue number shown at each entry's first cell.
    var numbers: [Int: Int] {
        var out: [Int: Int] = [:]
        for e in state.entries { let start = e.r * state.w + e.c; if out[start] == nil { out[start] = e.n } }
        return out
    }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/crossword/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: CrosswordState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "crossword-save-daily" : "crossword-save-\(seed)" }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000

    private func persist() {
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
        if cell == selected {
            if here.count > 1 { dir = dir == .across ? .down : .across }
            return
        }
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
    }
    func toggleDirection() { guard !isFinished else { return }; SoundManager.shared.playKeyTap(); dir = dir == .across ? .down : .across }

    /// After typing: the next open cell in the active entry, else the next unfinished entry's first empty cell.
    private func advance(from: Int, entry: CrosswordEntry?) {
        guard let entry else { return }
        let s = state, fill = Array(s.fill), locked = Array(s.locked)
        let cells = crosswordEntryCells(s, entry)
        let k = cells.firstIndex(of: from) ?? -1
        if let nextIn = cells.dropFirst(k + 1).first(where: { fill[$0] == CROSSWORD_EMPTY || locked[$0] == "0" }) { selected = nextIn; return }
        let order = s.entries
        guard let idx = order.firstIndex(where: { $0.n == entry.n && $0.dir == entry.dir }) else { return }
        for step in 1...order.count {
            let e = order[(idx + step) % order.count]
            if crosswordEntrySolved(s, e) { continue }
            let ec = crosswordEntryCells(s, e)
            dir = e.dir; selected = ec.first(where: { fill[$0] == CROSSWORD_EMPTY }) ?? ec.first
            return
        }
    }

    // MARK: - Actions

    private func dispatch(_ a: CrosswordAction) {
        guard !isFinished else { return }
        state = crosswordReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if case .check = a {
            let n = state.lastWrong.count
            if n > 0 { flash("\(n) wrong letter\(n == 1 ? "" : "s") cleared"); Haptics.error(); SoundManager.shared.playInvalid() }
            else { flash("Everything filled is right"); SoundManager.shared.playSuccess() }
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
            selected = prev
            if locked[prev] == "0" { dispatch(.clear(cell: prev)) }
        }
    }
    /// ENTER jumps to the next unfinished entry.
    func nextEntry() {
        guard !isFinished, let entry = activeEntry, let last = activeCells.last else { return }
        advance(from: last, entry: entry)
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
        else { Haptics.error(); SoundManager.shared.playGameOver() }
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
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView {
                    VStack(spacing: 12) {
                        header
                        CrosswordGridView(vm: vm, finished: true)
                        CrosswordClueColumns(vm: vm, finished: true)
                        result
                    }
                    .padding(.horizontal, 10)
                }
            } else {
                VStack(spacing: 8) {
                    header
                    ScrollView {
                        VStack(spacing: 12) {
                            CrosswordGridView(vm: vm, finished: false)
                            CrosswordClueColumns(vm: vm, finished: false)
                        }
                        .padding(.vertical, 4)
                    }
                    VStack(spacing: 8) {
                        if let e = vm.activeEntry { CrosswordActiveClueBar(entry: e) { vm.toggleDirection() } }
                        HStack(spacing: 6) {
                            capsule(vm.state.checks > 0 ? "Check · \(vm.state.checks)" : "Check", "checkmark.circle") { Haptics.tap(); SoundManager.shared.playKeyTap(); vm.check() }
                            capsule("Letter", "lightbulb") { SoundManager.shared.playKeyTap(); vm.revealLetter() }
                            capsule(vm.state.hintsUsed > 0 ? "Word · \(vm.state.hintsUsed)" : "Word", "eye") { SoundManager.shared.playKeyTap(); vm.revealWord() }
                            capsule(vm.armReveal ? "Reveal all?" : "Reveal all", "flag", danger: vm.armReveal) { vm.revealPuzzle() }
                        }
                        LetterKeyboard(onLetter: { vm.setLetter($0) }, onEnter: { vm.nextEntry() }, onDelete: { vm.deleteLetter() })
                    }
                    .padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            if let toast = vm.toast {
                Text(toast).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.horizontal, 24)
                    .padding(.top, 110).frame(maxHeight: .infinity, alignment: .top)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.checks, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "CHECKS", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .crossword) }
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
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(crosswordAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(crosswordAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    /// Accent-outlined capsule; `danger` (an armed Reveal all) turns red.
    private func capsule(_ label: String, _ symbol: String, danger: Bool = false, action: @escaping () -> Void) -> some View {
        let tint = danger ? cwWrong : crosswordAccent
        return Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(tint)
                .padding(.horizontal, 9).padding(.vertical, 7)
                .background(Capsule().fill(tint.opacity(0.05)))
                .overlay(Capsule().stroke(tint.opacity(0.4), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var header: some View {
        VStack(spacing: 3) {
            Text("CROSSWORDOCIOUS").font(Brand.font(24, .black)).foregroundStyle(crosswordAccent)
                .lineLimit(1).minimumScaleFactor(0.6).padding(.horizontal, 48)
            Text(vm.state.title).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                .lineLimit(1).minimumScaleFactor(0.7).padding(.horizontal, 48)
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
        .padding(.top, 6)
    }

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.guessCount
        let hints = vm.state.hintsUsed
        return VStack(spacing: 10) {
            Text(won ? (vm.state.checks == 0 ? "Grid finished clean" : "Grid finished") : "Puzzle revealed")
                .font(Brand.title(20)).foregroundStyle(won ? Theme.win : Theme.lossText)
            Text("\(vm.checksLabel) · \(timeText(secs))\(hints > 0 ? " · \(hints) hint\(hints == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain() } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Theme.gold)
                }
            }
            .foregroundStyle(crosswordAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .crossword) }
            ScoreBreakdownView(gameMode: GameMode.crossword.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS, hintsUsed: hints,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "CROSSWORD") }
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

/// The grid, always centred: a sparse criss-cross of purple tiles; blocks are
/// simply absent. The letter is centred in its cell exactly like a Classic
/// tile; the clue number is a tiny purple mark top-left that never touches the
/// letter. The active entry wears a 10% accent wash and the selected cell an
/// accent ring; Check-locked cells a deeper purple; revealed cells violet with
/// white ink; the cells a Check just cleared flash red.
struct CrosswordGridView: View {
    @ObservedObject var vm: CrosswordVM
    let finished: Bool

    private let gap: CGFloat = 3

    /// Cell side that fits `w` columns on the phone, capped like the web (42px).
    private var cell: CGFloat {
        let available = UIScreen.main.bounds.width - 40
        return min(42, floor((available - gap * CGFloat(vm.state.w - 1)) / CGFloat(max(1, vm.state.w))))
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
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Crossword grid")
    }

    private func tile(_ i: Int, letter: String, number: Int?, locked: Bool, revealed: Bool, inActive: Bool, wrong: Bool, side: CGFloat) -> some View {
        let isSel = vm.selected == i && !finished
        var bg = cwCellBG, border = cwCellBorder, ink = cwCellText
        if revealed { bg = cwHint; border = cwHint; ink = .white }
        else if locked { bg = cwLockedBG; border = cwPurple; ink = cwPurple }
        if inActive && !revealed { bg = crosswordAccent.opacity(0.10) }
        if wrong { border = cwWrong; ink = cwWrong }
        if isSel { border = crosswordAccent }
        let radius = max(4, side * 0.14)
        return Button { vm.selectCell(i) } label: {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: radius).fill(bg)
                RoundedRectangle(cornerRadius: radius).strokeBorder(border, lineWidth: 2)
                Text(letter).font(Brand.font(side * 0.5, .black)).foregroundStyle(ink)
                    .frame(width: side, height: side)
                if let number {
                    Text("\(number)").font(Brand.font(max(7, side * 0.21), .black))
                        .foregroundStyle(revealed ? Color.white : cwPurple)
                        .padding(.top, 1.5).padding(.leading, 2.5)
                }
            }
            .frame(width: side, height: side)
            .overlay(isSel ? RoundedRectangle(cornerRadius: radius + 3).stroke(crosswordAccent, lineWidth: 2).padding(-3) : nil)
        }
        .buttonStyle(.plain)
        .disabled(finished)
        .accessibilityLabel("\(number.map { "\($0), " } ?? "")\(letter.isEmpty ? "empty" : letter)\(locked ? ", locked" : "")")
        .accessibilityAddTraits(isSel ? .isSelected : [])
    }
}

/// Across and Down side by side, centred under the board; solved entries are
/// struck through and dimmed, the active one highlighted; a tap selects the
/// entry's first empty cell. Finished, each answer follows its clue in purple.
struct CrosswordClueColumns: View {
    @ObservedObject var vm: CrosswordVM
    let finished: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            column(.across, "Across")
            column(.down, "Down")
        }
        .frame(maxWidth: 700)
        .padding(.horizontal, 4)
    }

    private func column(_ dir: CrosswordDir, _ title: String) -> some View {
        let s = vm.state
        let active = finished ? nil : vm.activeEntry
        return VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased()).font(Brand.font(10, .black)).tracking(1.5).foregroundStyle(Theme.textMuted)
            ForEach(s.entries.filter { $0.dir == dir }, id: \.n) { e in
                let solved = crosswordEntrySolved(s, e)
                let isActive = active?.n == e.n && active?.dir == e.dir
                Button { vm.pickEntry(e) } label: {
                    HStack(alignment: .top, spacing: 6) {
                        Text("\(e.n)").font(Brand.font(10, .black)).foregroundStyle(cwPurple)
                            .frame(width: 20, height: 20)
                            .background(RoundedRectangle(cornerRadius: 4).fill(cwCellBG))
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(cwCellBorder, lineWidth: 1))
                        (Text(e.clue).font(Brand.font(12, solved ? .semibold : .bold)).strikethrough(solved && !finished)
                         + (finished ? Text(" \(e.answer)").font(Brand.font(12, .black)).foregroundColor(cwPurple) : Text("")))
                            .foregroundStyle(Theme.textPrimary)
                            .opacity(solved && !finished ? 0.5 : 1)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 4).padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 6).fill(isActive ? crosswordAccent.opacity(0.08) : Color.clear))
                }
                .buttonStyle(.plain)
                .disabled(finished)
                .accessibilityLabel("\(e.n) \(dir == .across ? "Across" : "Down"): \(e.clue)\(solved ? ", solved" : "")")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The sticky active-clue bar above the keyboard: a "3A" badge and the clue; tapping switches direction.
struct CrosswordActiveClueBar: View {
    let entry: CrosswordEntry
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 8) {
                Text("\(entry.n)\(entry.dir.rawValue)").font(Brand.font(11, .black)).foregroundStyle(cwPurple)
                    .frame(width: 24, height: 24)
                    .background(RoundedRectangle(cornerRadius: 4).fill(cwCellBG))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(cwCellBorder, lineWidth: 1))
                Text(entry.clue).font(Brand.font(15, .heavy)).foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.leading).lineLimit(2).minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "arrow.left.arrow.right").font(.system(size: 14, weight: .bold)).foregroundStyle(crosswordAccent)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(crosswordAccent.opacity(0.07)))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(crosswordAccent.opacity(0.27), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: 700)
        .accessibilityLabel("Active clue \(entry.n) \(entry.dir == .across ? "Across" : "Down"): \(entry.clue). Tap to switch direction")
    }
}
