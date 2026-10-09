import SwiftUI
import WordociousCore

// Muddle (More Games §5) — the iOS twin of components/scramble/*.
// The newspaper scramble in the founder's classic one-column layout: the
// cartoon panel on top, the caption with its blank beneath, four scrambled
// words stacked on one left edge with their answer boxes on a fixed six-column
// grid (the circled letters ringed INSIDE the boxes), then a divider and the
// punchline row grouped by word. A full word checks itself: right locks it,
// wrong shakes it and the letters return. Every check counts (guess_count =
// checks, perfect 5); thirteen lose. Hints never count: Letter (1) pins the
// next correct letter, Solve (2) fills the word. boards_solved = words + punchline.

private let muddleAccent = Color(hex: 0xF97316)
/// The cream paper of the cartoon panel (web CartoonPanel).
private let mdPaper = Color(hex: 0xFDF8EC)
/// The solved caption's punchline ink.
private let mdPurple = Color(hex: 0x7C3AED)
private let mdLilacText = Color(hex: 0x5B21B6)
private let mdCols = 6

/// The bundled bank (Resources/scramble-puzzles.json — sha-guarded to match the web copy).
enum ScrambleBankStore {
    static let shared: ScrambleBank? = {
        guard let url = Bundle.main.url(forResource: "scramble-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return ScrambleBank.load(from: data)
    }()
}

private extension ScrambleAction {
    /// The row an action addresses (nil for FINISH) — the web's `(a as { row?: number }).row`.
    var row: Int? {
        switch self {
        case .type(let r, _), .back(let r), .clear(let r), .revealLetter(let r), .solveWord(let r): return r
        case .finish: return nil
        }
    }
}

@MainActor
final class MuddleVM: ObservableObject {
    @Published private(set) var state: ScrambleState
    /// The row the player is working on (0–3 words, 4 punchline); follows the game after a check.
    @Published private(set) var row: Int = 0
    /// Per-row shake counters — a wrong check bumps its row's counter (drives ShakeEffect).
    @Published private(set) var shakes: [CGFloat] = Array(repeating: 0, count: SCRAMBLE_TOTAL_BOARDS)
    @Published var toast: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    let isDaily: Bool
    let seed: String
    /// The bank entry (cartoon + alt text live here, not in the state).
    let puzzle: ScramblePuzzle
    /// The holiday list this puzzle came from (nil on an ordinary day).
    let holidayKey: String?

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    private var pauseReasons: Set<String> = []
    private var pauseStart: Double?
    private var timerStarted = false
    private var recorded = false
    private(set) var restoredFinished = false

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        let today = LeaderboardService.todayLocal()
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.scramble.rawValue)
        let bank = ScrambleBankStore.shared ?? ScrambleBank(version: 1, epoch: SCRAMBLE_DAILY_EPOCH, daily: [], extra: [])
        let fallback = ScramblePuzzle(
            id: "none",
            words: [
                ScrambleWord(answer: "KEEPS", scramble: "SPEEK", circled: [0, 1, 2, 3]),
                ScrambleWord(answer: "CALMS", scramble: "MLASC", circled: [0, 1, 2, 3]),
                ScrambleWord(answer: "PIANO", scramble: "ONAIP", circled: []),
                ScrambleWord(answer: "NIGHT", scramble: "THGIN", circled: []),
            ],
            final: ScrambleFinal(answer: "KEEP CALM", pattern: [4, 4]),
            caption: "The lifeguard's only advice as the storm rolled in was to ____.",
            altText: "A lifeguard on a tall chair points calmly at a dark cloud over the beach.")
        let chosen = (seed == nil ? scramblePuzzleForDay(bank, day: today, holidays: HolidayTable.bundled) : scramblePuzzleForSeed(bank, seed: self.seed)) ?? fallback
        var s = createScrambleState(chosen, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        var restoredElapsed: Double = 0, finished = false, elapsedFinal: Int?
        if let snap = Self.loadSnapshot(isDaily: self.isDaily, seed: self.seed) {
            s = snap.state
            restoredElapsed = Double(snap.elapsed) * 1000
            if s.status != .playing { finished = true; elapsedFinal = snap.elapsed }
        }
        // The saved state may name a different bank entry (the daily bank rolled): find its cartoon by id.
        let all = bank.daily + bank.extra + (bank.holiday ?? [:]).values.flatMap { $0 }
        let entry = all.first(where: { $0.id == s.id }) ?? chosen
        puzzle = entry
        holidayKey = bank.holiday?.first(where: { $0.value.contains { $0.id == entry.id } })?.key
        state = s
        restoredElapsedMs = restoredElapsed
        if finished { finalTimeSeconds = elapsedFinal; recorded = true; restoredFinished = true }
        row = scrambleActiveRow(s) ?? 0
    }
    /// Read-only: a finished board rebuilt from a matches row (the Completed-today dropdown). Never saves or records.
    init(display s: ScrambleState, puzzle p: ScramblePuzzle) {
        isDaily = true; seed = s.seed; puzzle = p; holidayKey = nil; state = s; finalTimeSeconds = 0; recorded = true; restoredFinished = true
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { scrambleDailyNumber(LeaderboardService.todayLocal()) }
    var holidayTitle: String? { HolidayTitles.title(holidayKey) }
    var guessCount: Int { scrambleGuessCount(state) }
    var boardsSolved: Int { scrambleBoardsSolved(state) }
    var finalOpen: Bool { scrambleFinalOpen(state) }
    var checksLabel: String { "\(state.checks) check\(state.checks == 1 ? "" : "s")" }
    var leftLabel: String { "\(max(0, SCRAMBLE_MAX_CHECKS - state.checks)) left" }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.scramble.rawValue, completed: state.status == .won, guessCount: guessCount,
                                   timeSeconds: elapsed, boardsSolved: boardsSolved, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
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

    // MARK: - Persistence (mirrors components/scramble/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: ScrambleState; let elapsed: Int; let savedAt: Double }
    private static func storageKey(isDaily: Bool, seed: String) -> String { isDaily ? "scramble-save-daily" : "scramble-save-\(seed)" }
    private var storageKey: String { Self.storageKey(isDaily: isDaily, seed: seed) }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000

    private func persist() {
        // A finished Unlimited game is never resumed — drop its save (founder, 2026-09-29).
        if !isDaily && isFinished { UserDefaults.standard.removeObject(forKey: storageKey); return }
        let snap = Snapshot(seed: seed, date: LeaderboardService.todayLocal(), state: state, elapsed: elapsed, savedAt: Date().timeIntervalSince1970 * 1000)
        if let data = try? JSONEncoder().encode(snap) { UserDefaults.standard.set(data, forKey: storageKey) }
    }

    /// The saved game for this seed — nil (and the stale entry dropped) when it is another seed, another day, or an expired practice run.
    private static func loadSnapshot(isDaily: Bool, seed: String) -> Snapshot? {
        let key = storageKey(isDaily: isDaily, seed: seed)
        guard let data = UserDefaults.standard.data(forKey: key),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return nil }
        let stale = snap.seed != seed
            || (isDaily && snap.date != LeaderboardService.todayLocal())
            || (!isDaily && Date().timeIntervalSince1970 * 1000 - snap.savedAt > practiceTTLms)
        if stale { UserDefaults.standard.removeObject(forKey: key); return nil }
        return snap
    }

    // MARK: - Actions

    private func dispatch(_ a: ScrambleAction) {
        guard !isFinished else { return }
        let prev = state
        state = scrambleReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if state.checks != prev.checks, let judged = state.lastRow {
            switch state.lastResult {
            case .wrong:
                flash(judged == SCRAMBLE_FINAL ? "Not the punchline" : "Not that word")
                Haptics.warning(); SoundManager.shared.playInvalid()
                withAnimation(Theme.animation(.linear(duration: 0.4))) { shakes[judged] += 1 }
            case .correct:
                SoundManager.shared.playFound(); Haptics.tap()
            case .none: break
            }
        }
        // Follow the game: the active row moves to the next open word, then the punchline.
        let solvedHere = a.row.map { state.solved[$0] } ?? false
        if let active = scrambleActiveRow(state), solvedHere || state.checks != prev.checks { row = active }
        if state.status != .playing { finish() }
        persist()
    }

    /// Tap a row: it becomes the active row. The closed punchline row explains itself.
    func select(_ r: Int) {
        guard !isFinished, !state.solved[r] else { return }
        if r == SCRAMBLE_FINAL && !finalOpen { flash("Solve the four words first"); return }
        if r != row { SoundManager.shared.playKeyTap() }
        row = r
    }
    /// Tap a scrambled (or circled) letter: the row becomes active and the letter is placed.
    func tapTile(_ r: Int, _ letter: String) {
        guard !isFinished, !state.solved[r] else { return }
        if r == SCRAMBLE_FINAL && !finalOpen { flash("Solve the four words first"); return }
        row = r
        SoundManager.shared.playKeyTap()
        dispatch(.type(row: r, letter: letter))
    }
    func typeLetter(_ letter: String) {
        guard !isFinished else { return }
        if row == SCRAMBLE_FINAL && !finalOpen { flash("Solve the four words first"); return }
        if state.solved[row] { return }
        dispatch(.type(row: row, letter: letter))
    }
    func deleteLetter() { guard !isFinished else { return }; dispatch(.back(row: row)) }
    func clearRow() { guard !isFinished else { return }; dispatch(.clear(row: row)) }
    /// ENTER jumps to the row the game wants next.
    func nextRow() { guard !isFinished, let next = scrambleActiveRow(state) else { return }; row = next }
    /// ↑ / ↓ on a hardware keyboard (web muddle-game keydown): step the active row, clamped.
    func moveRow(_ delta: Int) { guard !isFinished else { return }; row = min(SCRAMBLE_FINAL, max(0, row + delta)) }
    func revealLetter(_ r: Int) { guard !isFinished else { return }; Haptics.tap(); dispatch(.revealLetter(row: r)) }
    func solveWord(_ r: Int) { guard !isFinished else { return }; Haptics.tap(); dispatch(.solveWord(row: r)) }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = guessCount, used = state.hintsUsed, solved = boardsSolved
        let matchRow = scrambleMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .scramble, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: solved, totalBoards: SCRAMBLE_TOTAL_BOARDS,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .scramble, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: matchRow.solutions, guesses: matchRow.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.scramble.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

// MARK: - Compact geometry (founder, 2026-09-23, TestFlight 186: "make it smaller so it can all fit on one screen")
//
// FINISH_SPEC BI8 (founder 10-02, 2.7 (240) pulled: "The picture and the tagline need
// to appear the whole time"): fixed priorities, no overflow. The cartoon + caption get a
// guaranteed floor FIRST, the rows next, and the cartoon grows into what is left (cap 36 %
// of the screen). Room comes from compacting everything else: a small title in the
// corner-button row, one full block only for the ACTIVE word (the others are one slim
// line each, the solved ones a 2×2 grid of locked tiles once the punchline opens), and
// shorter keys. If the rows still cannot fit, only the ROWS scroll — never the picture.
private enum MdSize {
    /// Short phones (the SE family, < 700 pt tall) take the tighter sizes.
    static var short: Bool { UIScreen.main.bounds.height < 700 }
    /// The active word's answer boxes on the six-column grid.
    static var tile: CGFloat { short ? 30 : 32 }
    static let tileGap: CGFloat = 6
    /// Scrambled letters (rule 16–17 pt bold, light tracking).
    static let scrambleFont: CGFloat = 17
    static let scrambleTracking: CGFloat = 0.8
    /// Letter · Solve icon-only circles (rule 28–30) inside a 44 pt hit frame.
    static let hintButton: CGFloat = 30
    static let hitTarget: CGFloat = 44
    /// Open punchline tiles — shrink toward the floor to keep a long word on one line.
    static var punchTile: CGFloat { short ? 28 : 30 }
    static let punchTileFloor: CGFloat = 24
    static let punchGap: CGFloat = 5
    static let punchWordGap: CGFloat = 12
    /// Between words, and between the stacked sections.
    static let wordGap: CGFloat = 4
    static let gap: CGFloat = 4
    /// BI8: the cartoon (4:3) — a 150 pt floor that comes first, a 36 % cap it grows to.
    static let cartoonCap: CGFloat = 0.36
    static let cartoonFloor: CGFloat = 150
    static let captionFont: CGFloat = 14.5
    /// Delete · Clear capsules.
    static let capsuleHeight: CGFloat = 30
    /// §L: the word rows' compact game tray padding.
    static let trayPad: CGFloat = 8
    /// §I3: the active word's scrambled-letter chips (~70% of a tile).
    static var chip: CGFloat { short ? 21 : 22 }
    /// BI8: a compact line — small chips, small tiles; the locked punchline's rings.
    static let compactChip: CGFloat = 20
    static let compactTile: CGFloat = 22
    static let compactGap: CGFloat = 3
    static let lockedRing: CGFloat = 16
    /// BI8: the punchline tray chips.
    static var punchChip: CGFloat { short ? 21 : 22 }
    /// BI8: the play header's title art cap (it sits in the corner-button row).
    static let titleCap: CGFloat = 48
    /// BI8: Muddle's keys.
    static var keyHeight: CGFloat { short ? 40 : 42 }
    /// Horizontal padding of the play column and of a word block.
    static let columnPad: CGFloat = 10
    static let rowPad: CGFloat = 6
}

/// The measured caption height (1–2 lines) so the cartoon can take exactly what is left.
private struct MdHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// BI8: the rows' natural height (measured unconstrained inside their scroll view).
private struct MdRowsKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

private struct MdNoBounceIfFits: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) { content.scrollBounceBehavior(.basedOnSize) } else { content }
    }
}

struct MuddleView: View {
    @StateObject private var vm: MuddleVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false
    /// Measured caption height (two 14.5 pt lines until the first layout reports).
    @State private var captionHeight: CGFloat = 36
    /// BI8: the rows' natural height (the word phase's estimate until the first layout reports).
    @State private var rowsHeight: CGFloat = 230
    /// BI8: the finished board's caption + punchline + "See all" height (measured).
    @State private var finishedRest: CGFloat = 170
    /// §R2: the finished screen's "See all" (the four words).
    @State private var showAllWords = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: MuddleVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.scramble))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the cartoon +
                // filled caption + the punchline scaled to the height left (the four
                // words fold behind "See all"), the dock; the breakdown below it.
                FinishedScreenLayout {
                    // BI8: the compact play header here too, so the cartoon keeps its floor on the SE.
                    VStack(spacing: 4) { playHeader; resultHeadline }
                } board: { size in
                    finishedBoard(size)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "SCRAMBLE", game: "Muddle", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    result
                }
                .padding(.horizontal, MdSize.columnPad)
            } else {
                playing
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                // The web passes the check count with label "Checks"; a single
                // "board" here keeps the card to CHECKS · TIME · POINTS.
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.checks, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "CHECKS", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    game: .scramble,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .softSheet(isPresented: $showGuide) { GuideSheet(mode: .scramble) }
                .firstPlayGuide(mode: .scramble, show: $showGuide)
        }
        .navigationBarTitleDisplayMode(.inline)
        // No bar items live up there (the corner buttons are overlays); hiding the
        // empty bar hands its height back to the puzzle.
        .toolbar(.hidden, for: .navigationBar)
        .onPreferenceChange(MdHeightKey.self) { h in if h > 0, abs(h - captionHeight) > 0.5 { captionHeight = h } }
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.scramble))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("SCRAMBLE")
        .swipeToGoBack { dismiss() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.row)
        .onChange(of: vm.state.status) { s in
            if s != .playing, !vm.restoredFinished { withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showOverlay = true } }
            if s == .won { RatingsPrompt.recordWin(); RatingsPrompt.maybeAsk() }
        }
        .onAppear {
            if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.beginTimer() } }
        }
    }

    /// The one-screen play layout (BI8): a compact header, then the middle area —
    /// cartoon + caption on top, ALWAYS whole, the rows beneath — then Delete · Clear
    /// and the keys pinned at the bottom.
    private var playing: some View {
        VStack(spacing: MdSize.gap) {
            playHeader
            GeometryReader { geo in
                middle(geo.size)
            }
            HStack(spacing: 8) {
                capsule("Delete", "delete.left") { SoundManager.shared.playDelete(); vm.deleteLetter() }
                capsule("Clear", "xmark.circle") { SoundManager.shared.playDelete(); vm.clearRow() }
            }
            .gameFeedbackToast(vm.toast, alignment: .top)  // §BI9: under the board, never over the title art
            // Hardware keys (founder, 2026-09-30): web muddle-game keydown —
            // A–Z / Delete as the keys, Return or Tab = next row, ↑ ↓ step rows.
            StagedSlot(key: "muddleKeys", estimate: 3 * MdSize.keyHeight + 24) {   // BJ14
            LetterKeyboard(onLetter: { vm.typeLetter($0) }, onEnter: { vm.nextRow() }, onDelete: { vm.deleteLetter() },
                           onHardwareKey: { key in
                               switch key {
                               case .tab: vm.nextRow()
                               case .up: vm.moveRow(-1)
                               case .down: vm.moveRow(1)
                               default: return false
                               }
                               return true
                           },
                           keyHeightOverride: MdSize.keyHeight)
                .padding(.bottom, 4)
            }
        }
        .padding(.horizontal, MdSize.columnPad)
        .onPreferenceChange(MdRowsKey.self) { h in if h > 0, abs(h - rowsHeight) > 0.5 { rowsHeight = h } }
    }

    /// BI8 priorities: the cartoon's floor + the caption come first, then the rows,
    /// then the cartoon grows into the leftover (≤ 36 % of the screen, ≤ the 4:3
    /// width). Rows that still do not fit scroll inside their own box — the cartoon
    /// and caption never move.
    private func middle(_ size: CGSize) -> some View {
        let gaps = MdSize.gap * 2
        let cap = min(floor(UIScreen.main.bounds.height * MdSize.cartoonCap), floor(min(size.width, 420) * 0.75))
        // The floor yields only when the whole middle area cannot even hold it (never on a supported phone).
        let floorH = min(MdSize.cartoonFloor, max(60, size.height - captionHeight - gaps - 60))
        let h = max(floorH, min(cap, size.height - captionHeight - rowsHeight - gaps))
        let rowsRoom = max(0, size.height - h - captionHeight - gaps)
        return VStack(spacing: MdSize.gap) {
            MuddleCartoonPanel(cartoon: vm.puzzle.cartoon, altText: vm.puzzle.altText)
                .frame(height: h)
            caption(finished: false)
            Spacer(minLength: 0)
            ScrollView(.vertical, showsIndicators: false) {
                playRows
                    .background(GeometryReader { g in Color.clear.preference(key: MdRowsKey.self, value: g.size.height) })
            }
            .modifier(MdNoBounceIfFits())
            .frame(height: min(rowsHeight, rowsRoom))
        }
        .frame(width: size.width, height: size.height, alignment: .top)
    }

    /// §L: the words and the punchline on the shared game tray. BI8: only the active
    /// word is a full block; the others are one slim line; once the punchline opens the
    /// four solved words fold into a 2 × 2 grid of small locked tiles.
    private var playRows: some View {
        VStack(spacing: MdSize.wordGap) {
            if vm.finalOpen {
                Grid(horizontalSpacing: 8, verticalSpacing: 4) {
                    ForEach(0..<2, id: \.self) { r in
                        GridRow {
                            ForEach(0..<2, id: \.self) { c in
                                MuddleSolvedLine(vm: vm, row: r * 2 + c, cell: true)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            } else {
                ForEach(0..<SCRAMBLE_WORDS, id: \.self) { i in
                    Group {
                        if vm.state.solved[i] {
                            MuddleSolvedLine(vm: vm, row: i, cell: false)
                        } else if vm.row == i {
                            MuddleWordRow(vm: vm, row: i, finished: false)
                        } else {
                            MuddleCompactRow(vm: vm, row: i)
                        }
                    }
                    .modifier(ShakeEffect(animatableData: vm.shakes[i]))
                }
            }
            MuddleFinalRow(vm: vm, finished: false)
                .modifier(ShakeEffect(animatableData: vm.shakes[SCRAMBLE_FINAL]))
        }
        .gameTray(accent: muddleAccent, radius: 18, padding: MdSize.trayPad)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
    }

    /// The caption with the blank as an accent underline — the punchline fills it
    /// in lowercase purple once solved. At most two lines; its height is reported
    /// up so the cartoon can take exactly what remains.
    private func caption(finished: Bool) -> some View {
        muddleCaption(vm.state, solved: finished || vm.state.solved[SCRAMBLE_FINAL])
            .background(GeometryReader { g in Color.clear.preference(key: MdHeightKey.self, value: g.size.height) })
    }

    /// The corner controls (HEADER_SPEC §4): Home as a soft white circle, Help with the 3D icon.
    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        GameCornerButton(kind: symbol == "questionmark" ? .help : .home, action: action)
    }

    /// §A8: Delete · Clear as small quiet (peach) candy pills.
    private func capsule(_ label: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        PuzCandyAction(title: label, symbol: symbol, variant: .peach, action: action)
    }

    /// BI8: the play header — the title art small (≤ 48 pt) IN the corner-button row,
    /// between Home and Sound · Help, then the one meta line.
    private var playHeader: some View {
        VStack(spacing: 1) {
            Group {
                if let art = GameTitleArt.forMode(.scramble) {
                    GameTitleArtView(asset: art.asset, label: art.label, maxHeight: MdSize.titleCap - 4, minHeight: 0)
                } else {
                    Text("MUDDLE").font(Brand.font(20, .black)).foregroundStyle(muddleAccent)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .frame(height: GameCornerButton.rowHeight - GameCornerButton.topInset)
            .padding(.horizontal, 2 * 44 + GameCornerButton.sideInset - MdSize.columnPad + 2)
            metaLine
        }
        .padding(.top, GameCornerButton.topInset)
    }

    private var metaLine: some View {
        HStack(spacing: 6) {
            if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(11)).foregroundStyle(Theme.textMuted) }
            if let holiday = vm.holidayTitle { Text(holiday).font(Brand.caption(11)).foregroundStyle(muddleAccent) }
            Text("\(vm.boardsSolved)/\(SCRAMBLE_TOTAL_BOARDS) solved").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
            Text("\(vm.checksLabel) · \(vm.leftLabel)").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
            if !vm.isFinished {
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    HStack(spacing: 2) {
                        Image(systemName: "clock").font(.system(size: 9))
                        Text(timeText(vm.elapsed, clock: true))
                    }
                    .font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                }
            }
        }
        .lineLimit(1).minimumScaleFactor(0.75)
        .padding(.horizontal, 34)
    }

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.state.status == .won
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? (vm.state.checks == 5 && vm.state.hintsUsed == 0 ? "Muddle solved clean" : "Muddle solved") : "Out of checks",
                                won: won)
            PuzResultLine(won: won, items: [("\(vm.state.checks)", vm.state.checks == 1 ? "check" : "checks"),
                                                  (puzClock(vm.elapsed), "time")],
                                points: vm.points)
        }
    }

    /// §R2: the finished puzzle in the height left — the cartoon takes what the
    /// caption, the punchline and the "See all" leave; the four words expand in
    /// place under the punchline (the area scrolls once expanded).
    private func finishedBoard(_ size: CGSize) -> some View {
        // BI8: the cartoon takes what the MEASURED caption + punchline + "See all"
        // leave (no estimates), with the same 150 pt floor and 36 % cap as play.
        let gap = MdSize.wordGap
        let cap = min(floor(UIScreen.main.bounds.height * MdSize.cartoonCap), floor(min(size.width, 420) * 0.75))
        let cartoon = max(min(MdSize.cartoonFloor, floor(size.height * 0.5)), min(cap, size.height - finishedRest - gap))
        let won = vm.state.status == .won
        return ScrollView(showsIndicators: false) {
            VStack(spacing: gap) {
                MuddleCartoonPanel(cartoon: vm.puzzle.cartoon, altText: vm.puzzle.altText)
                    .frame(height: cartoon)
                VStack(spacing: gap) {
                    caption(finished: true)
                    MuddleFinalRow(vm: vm, finished: true)
                        .gameTray(accent: muddleAccent, state: won ? .won : .lost, radius: 18, padding: MdSize.trayPad)
                    PuzSeeAllToggle(expanded: $showAllWords, title: "See all words")
                }
                .background(GeometryReader { g in Color.clear.preference(key: MdRowsKey.self, value: g.size.height) })
                if showAllWords {
                    VStack(spacing: MdSize.wordGap) {
                        ForEach(0..<SCRAMBLE_WORDS, id: \.self) { i in MuddleWordRow(vm: vm, row: i, finished: true) }
                    }
                    .gameTray(accent: muddleAccent, state: won ? .won : .lost, radius: 18, padding: MdSize.trayPad)
                }
            }
            .frame(maxWidth: 420)
            .frame(maxWidth: .infinity, minHeight: size.height)
        }
        .scrollDisabled(!showAllWords && cartoon + gap + finishedRest <= size.height + 0.5)
        .onPreferenceChange(MdRowsKey.self) { h in if h > 0, abs(h - finishedRest) > 0.5 { finishedRest = h } }
    }

    /// Below the dock (§R2): the full summary line, the daily rank and the breakdown.
    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.guessCount
        let hints = vm.state.hintsUsed
        return VStack(spacing: 10) {
            Text("\(vm.boardsSolved)/\(SCRAMBLE_TOTAL_BOARDS) solved · \(vm.checksLabel) · \(timeText(secs))\(hints > 0 ? " · \(hints) hint\(hints == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(muddleAccent)
            if vm.isDaily { DailyRankBadge(gameMode: .scramble) }
            ScoreBreakdownView(gameMode: GameMode.scramble.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: vm.boardsSolved, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: hints,
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
        ShareEvents.log(kind: "image", gameMode: GameMode.scramble.rawValue, surface: "post_game")
        let n = vm.isDaily ? vm.dailyNumber : nil
        let won = vm.state.status == .won
        let caption = "Wordocious Muddle\(n.map { " #\($0)" } ?? "") — Score \(vm.points) pts · Time \(timeText(vm.elapsed, clock: true)) · \(vm.boardsSolved)/\(SCRAMBLE_TOTAL_BOARDS) solved · \(vm.checksLabel) · wordocious.com/muddle"
        ShareService.share(kind: .scramble(wordLengths: vm.state.words.map { $0.answer.count }, circled: vm.state.words.map { $0.circled },
                                           pattern: vm.state.final.pattern, checks: vm.state.checks, solvedCount: vm.boardsSolved, puzzleNumber: n),
                           mode: .scramble, modeLabel: "MUDDLE", accent: muddleAccent, won: won,
                           guesses: vm.guessCount, maxGuesses: SCRAMBLE_MAX_CHECKS, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: n, caption: caption)
    }
}

// MARK: - Board pieces

/// The caption with the blank as an accent underline; once solved the punchline fills it in lowercase purple. At most two lines.
private func muddleCaption(_ s: ScrambleState, solved: Bool) -> some View {
    let parts = s.caption.components(separatedBy: "____")
    // BI8: the blank never wraps onto a line by itself (it rode the last word as
    // bare underlined spaces, which a line break swallowed): the word before it
    // holds on with a no-break space, and the open blank is drawn as accent rules.
    var lead = parts.first ?? ""
    if lead.hasSuffix(" ") { lead = String(lead.dropLast()) + "\u{00A0}" }
    let blankText: Text = solved
        ? Text("\(s.final.answer.lowercased()) ").foregroundColor(mdLilacText).underline(true, color: muddleAccent)
        : Text(String(repeating: "_", count: 7)).foregroundColor(muddleAccent)
    return (Text(lead)
            + blankText
            + Text(parts.count > 1 ? parts[1...].joined(separator: "____") : ""))
        .font(Brand.font(MdSize.captionFont, .heavy)).foregroundStyle(Theme.textPrimary)
        .multilineTextAlignment(.center)
        .lineLimit(2).minimumScaleFactor(0.8)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 4)
        .accessibilityLabel(solved ? s.caption.replacingOccurrences(of: "____", with: s.final.answer.lowercased()) : s.caption.replacingOccurrences(of: "____", with: "blank"))
}

/// The finished puzzle, read-only: cartoon, filled caption, the four words and the punchline
/// (founder, 2026-09-29: the Completed-today dropdown shows the board like the classic games).
struct MuddleFinishedBoard: View {
    @ObservedObject var vm: MuddleVM
    var cartoonHeight: CGFloat = 150

    var body: some View {
        VStack(spacing: MdSize.wordGap) {
            MuddleCartoonPanel(cartoon: vm.puzzle.cartoon, altText: vm.puzzle.altText).frame(height: cartoonHeight)
            muddleCaption(vm.state, solved: true)
            ForEach(0..<SCRAMBLE_WORDS, id: \.self) { i in MuddleWordRow(vm: vm, row: i, finished: true) }
            MuddleFinalRow(vm: vm, finished: true)
        }
        .frame(maxWidth: 420)
    }
}

/// The cartoon panel (More Games §5/§8): a standard card in the cream paper
/// tone at 4:3 with the puzzle's image. The caption is ALWAYS typeset by the app
/// beneath the panel, never drawn into the picture. The caller sets the height;
/// the 4:3 fit centers it horizontally. Founder 10-03 (no placeholder states): the
/// art is decoded before the screen shows (`MuddleCartoons.prewarm`, from Home) and
/// drawn on the first frame; if it is not decoded yet the slot stays the plain paper
/// card at its exact size until it is — never a sketch or "pending" text.
struct MuddleCartoonPanel: View {
    let cartoon: String?
    let altText: String
    @State private var loaded: UIImage?

    var body: some View {
        let image = loaded ?? cartoon.flatMap { MuddleCartoons.cached($0) }
        ZStack {
            mdPaper
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            }
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        // §I4 / §A1: the cream paper card keeps its tone with the A1 border + shadow.
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .stroke(Theme.isDark ? muddleAccent.opacity(0.4) : muddleAccent.wash(0.32), lineWidth: 1.5))
        .shadow(color: Color(hex: 0x3C1E6E).opacity(0.10), radius: 10, x: 0, y: 8)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(altText)
        .task(id: cartoon) {
            guard let cartoon, MuddleCartoons.cached(cartoon) == nil else { return }
            loaded = await MuddleCartoons.load(cartoon)
        }
    }
}

/// Founder 10-03: the Muddle cartoons, downloaded (URLCache: the /muddle/ URLs are immutable)
/// AND decoded off main, kept in memory so the panel draws them on its first frame.
enum MuddleCartoons {
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 6
        return c
    }()

    static func url(_ cartoon: String) -> URL? { URL(string: "https://wordocious.com/muddle/\(cartoon)") }

    static func cached(_ cartoon: String) -> UIImage? { cache.object(forKey: cartoon as NSString) }

    /// Download (or read from URLCache) + decode; nil on failure.
    static func load(_ cartoon: String) async -> UIImage? {
        if let hit = cached(cartoon) { return hit }
        guard let url = url(cartoon),
              let (data, _) = try? await URLSession.shared.data(for: URLRequest(url: url)),
              let raw = UIImage(data: data) else { return nil }
        let decoded = await Task.detached(priority: .utility) { raw.preparingForDisplay() ?? raw }.value
        cache.setObject(decoded, forKey: cartoon as NSString)
        return decoded
    }
}

/// Which tray letters are already placed — marked left-to-right by multiset (web `dimmed`).
private func muddleDimmed(tray: [Character], remaining: String) -> [Bool] {
    var left = Array(remaining)
    return tray.map { ch in
        if let k = left.firstIndex(of: ch) { left.remove(at: k); return false }
        return true
    }
}

/// The first letter index of each punchline word.
private func muddleStarts(_ pattern: [Int]) -> [Int] {
    var out: [Int] = [], pos = 0
    for len in pattern { out.append(pos); pos += len }
    return out
}

/// The width a word block's left column may use: the column minus the row
/// padding, the spacer and the two 44 pt hint targets at the right.
private func muddleColumnWidth() -> CGFloat {
    min(UIScreen.main.bounds.width, 420) - 2 * MdSize.columnPad - 2 * MdSize.trayPad - 2 * MdSize.rowPad - MdSize.gap - 2 * MdSize.hitTarget
}

/// The tile side on the fixed six-column grid: 36 pt, or less only on a phone
/// narrower than the grid plus the hint buttons.
private func muddleTileSide() -> CGFloat {
    min(MdSize.tile, floor((muddleColumnWidth() - MdSize.tileGap * CGFloat(mdCols - 1)) / CGFloat(mdCols)))
}

/// How an answer slot reads.
private enum MdLook: Equatable { case empty, typed, pinned, solved }

/// The coin letter ink: white with the tile shadow (dark amber on the gold coin).
private let mdCoinShadow = Color(hex: 0x2E0C63).opacity(0.55)
private let mdAmberInk = Color(hex: 0x7A3D00)

/// The frosted empty cell under a gold ring (B1 empty: white ~58% + faint lilac).
private struct MdFrostedRing: View {
    let side: CGFloat
    var body: some View {
        ZStack {
            Circle().fill(Theme.isDark ? Color.white.opacity(0.10) : Color.white.opacity(0.58))
                .overlay(Circle().strokeBorder(Color(hex: 0x7C3AED).opacity(Theme.isDark ? 0.28 : 0.16), lineWidth: 1))
                .padding(side * 0.07)
            Image("art-muddle-coin-empty").resizable().interpolation(.high).scaledToFit()
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}

/// One answer box (FINISH_SPEC §I1). An uncircled slot is the B1 glossy square
/// tile (frosted empty, typed white face, purple once solved, a hint letter
/// purple with the gold ring); a circled slot is a round coin in the same
/// footprint — the gold ring over a frosted cell when empty, purple with a gold
/// rim once a letter is in, violet with a sparkle for a hint letter — its letter
/// ~52% of the coin. A placed letter pops in (§B3 type); a solved word turns
/// over and glows (the reveal flip, staggered by `index`).
private struct MuddleTile: View {
    let letter: String
    let look: MdLook
    let ring: Bool
    let side: CGFloat
    var rowSolved: Bool = false
    var index: Int = 0

    var body: some View {
        face
            .frame(width: side, height: side)
            .modifier(TypePop(letter: look == .typed || look == .pinned ? letter : "", size: CGSize(width: side, height: side)))
            .modifier(PuzSolveFlip(solved: rowSolved, delay: Double(index) * TileMotion.flipStagger * 0.5, size: side))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(letter.isEmpty ? "empty" : letter)\(ring ? ", circled" : "")")
    }

    @ViewBuilder private var face: some View {
        if ring {
            if look == .empty {
                MdFrostedRing(side: side)
            } else {
                ZStack {
                    Image(look == .pinned ? "art-muddle-coin-hint" : "art-muddle-coin-filled")
                        .resizable().interpolation(.high).scaledToFit()
                        .accessibilityHidden(true)
                    Text(letter)
                        .font(Brand.fixedFont(side * 0.52, .black))
                        .foregroundStyle(.white)
                        .shadow(color: mdCoinShadow, radius: side * 0.02, x: 0, y: side * 0.03)
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
            }
        } else {
            let tileFace: GlossyFace = {
                switch look {
                case .empty: return .empty
                case .typed: return .typed
                case .pinned, .solved: return .correct
                }
            }()
            GlossyTile(face: tileFace, letter: letter, width: side, letterScale: 0.52,
                       glowAmount: look == .pinned ? 0.9 : 0, goldRing: look == .pinned)
        }
    }
}

/// One punchline slot (FINISH_SPEC §I2): a gold coin with a dark amber letter;
/// empty = the gold ring on frosted. The solved punchline hops in a wave.
private struct MuddlePunchCoin: View {
    let letter: String
    let side: CGFloat
    let solved: Bool
    let index: Int

    var body: some View {
        Group {
            if letter.isEmpty {
                MdFrostedRing(side: side)
            } else {
                ZStack {
                    Image("art-muddle-coin-punchline").resizable().interpolation(.high).scaledToFit()
                        .accessibilityHidden(true)
                    Text(letter)
                        .font(Brand.fixedFont(side * 0.52, .black))
                        .foregroundStyle(mdAmberInk)
                        .shadow(color: Color.white.opacity(0.5), radius: 0, x: 0, y: 1)
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
            }
        }
        .frame(width: side, height: side)
        .modifier(TypePop(letter: solved ? "" : letter, size: CGSize(width: side, height: side)))
        .modifier(PuzHop(on: solved, delay: Double(index) * TileMotion.hopStagger, size: CGSize(width: side, height: side)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(letter.isEmpty ? "empty" : letter)
    }
}

/// Letter · Solve as small round candy buttons (§I4: amber bulb, pink eye)
/// inside a 44 pt hit frame. The label is the accessibility label ("Reveal a
/// letter" / "Solve this word").
private func hintButton(_ label: String, _ symbol: String, action: @escaping () -> Void) -> some View {
    PuzCandyIcon(symbol: symbol, label: label, variant: symbol == "eye" ? .pink : .amber, action: action)
        .frame(width: MdSize.hitTarget, height: MdSize.hitTarget)
}

/// A tappable tray letter (§I3): a small glossy letter chip (the B1 tile recipe
/// at ~70% size, light amber face, dark-purple letter). A used letter sinks
/// (scale .9, faded to 35%). The hit shape is grown to ≈ 44 pt around it.
private func trayLetter(_ letter: Character, size: CGFloat, color: Color, dimmed: Bool, chip: CGFloat = MdSize.chip, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Text(String(letter)).font(Brand.fixedFont(chip * 0.6, .black))
            .foregroundStyle(color)
            .frame(width: chip, height: chip - 3)
            .puzChip(Color(hex: 0xFFD98A), light: Color(hex: 0xFFF1CF), edge: Color(hex: 0xE0A43A),
                     radius: chip * 0.24, lip: chip < 22 ? 2 : 3, gloss: 0.6)
            .scaleEffect(dimmed ? 0.9 : 1)
            .opacity(dimmed ? 0.35 : 1)
            .animation(Theme.reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.6), value: dimmed)
            .contentShape(Rectangle().inset(by: -8))
    }
    .buttonStyle(.squish)
    .disabled(dimmed)
    .accessibilityLabel("Place \(letter)")
}

/// One word as ONE compact block: the scrambled letters (17 pt bold, light
/// tracking) with the answer boxes directly beneath on the fixed six-column
/// grid (the sixth slot simply empty for a five-letter word), and Letter · Solve
/// as icon circles at the block's right. Tapping a scrambled letter places it;
/// used letters dim. No card frame — the active row wears a light lilac tint.
struct MuddleWordRow: View {
    @ObservedObject var vm: MuddleVM
    let row: Int
    let finished: Bool

    var body: some View {
        let s = vm.state
        let w = s.words[row]
        let entry = Array(s.entries[row]), answer = Array(w.answer), scramble = Array(w.scramble)
        let solved = s.solved[row]
        let active = vm.row == row && !finished
        let revealed = Array(s.revealed[row])
        let circled = Set(w.circled)
        let dimmed = muddleDimmed(tray: scramble, remaining: scrambleRemaining(pool: w.scramble, entry: s.entries[row]))
        let side = muddleTileSide()
        HStack(alignment: .center, spacing: MdSize.gap) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    ForEach(0..<scramble.count, id: \.self) { i in
                        trayLetter(scramble[i], size: MdSize.scrambleFont, color: FinishInk.softNumber, dimmed: dimmed[i] || solved) {
                            vm.tapTile(row, String(scramble[i]))
                        }
                        .disabled(solved || finished || dimmed[i])
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Scrambled letters \(scramble.map(String.init).joined(separator: " "))")
                HStack(spacing: MdSize.tileGap) {
                    ForEach(0..<mdCols, id: \.self) { i in
                        if i < answer.count {
                            let ch: String = solved ? String(answer[i]) : (i < entry.count ? String(entry[i]) : "")
                            let pinned = !solved && i < revealed.count && revealed[i] != "_"
                            MuddleTile(letter: ch, look: solved ? .solved : (ch.isEmpty ? .empty : (pinned ? .pinned : .typed)),
                                       ring: circled.contains(i), side: side, rowSolved: solved, index: i)
                        } else {
                            Color.clear.frame(width: side, height: side)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
            if !solved && !finished {
                HStack(spacing: 0) {
                    hintButton("Reveal a letter", "lightbulb") { vm.revealLetter(row) }
                    hintButton("Solve this word", "eye") { vm.solveWord(row) }
                }
            }
        }
        .padding(.horizontal, MdSize.rowPad).padding(.vertical, 3)
        // §I4: the active word row is a tinted card (A1) on the tray.
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(active ? PuzKit.face(muddleAccent, 0.2) : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(active ? PuzKit.line(muddleAccent, 0.5) : Color.clear, lineWidth: 1.5))
        .contentShape(Rectangle())
        .onTapGesture { if !solved && !finished { vm.select(row) } }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Word \(row + 1)\(solved ? ", solved" : active ? ", active" : "")")
    }
}

/// BI8: an unsolved word that is not the active one — ONE slim line: its scrambled
/// letters as small chips at the left (tapping one makes the row active and places
/// it), the answer boxes small at the right with whatever is typed so far. Tapping
/// the line makes it the active (full) row.
struct MuddleCompactRow: View {
    @ObservedObject var vm: MuddleVM
    let row: Int

    var body: some View {
        let s = vm.state
        let w = s.words[row]
        let entry = Array(s.entries[row]), answer = Array(w.answer), scramble = Array(w.scramble)
        let revealed = Array(s.revealed[row])
        let circled = Set(w.circled)
        let dimmed = muddleDimmed(tray: scramble, remaining: scrambleRemaining(pool: w.scramble, entry: s.entries[row]))
        HStack(spacing: MdSize.gap) {
            HStack(spacing: MdSize.compactGap) {
                ForEach(0..<scramble.count, id: \.self) { i in
                    trayLetter(scramble[i], size: MdSize.scrambleFont, color: FinishInk.softNumber, dimmed: dimmed[i], chip: MdSize.compactChip) {
                        vm.tapTile(row, String(scramble[i]))
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Scrambled letters \(scramble.map(String.init).joined(separator: " "))")
            Spacer(minLength: 0)
            HStack(spacing: MdSize.compactGap) {
                ForEach(0..<mdCols, id: \.self) { i in
                    if i < answer.count {
                        let ch: String = i < entry.count ? String(entry[i]) : ""
                        let pinned = i < revealed.count && revealed[i] != "_"
                        MuddleTile(letter: ch, look: ch.isEmpty ? .empty : (pinned ? .pinned : .typed),
                                   ring: circled.contains(i), side: MdSize.compactTile)
                    } else {
                        Color.clear.frame(width: MdSize.compactTile, height: MdSize.compactTile)
                    }
                }
            }
        }
        .padding(.horizontal, MdSize.rowPad).padding(.vertical, 2)
        .contentShape(Rectangle())
        .onTapGesture { vm.select(row) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Word \(row + 1)")
        .accessibilityAddTraits(.isButton)
    }
}

/// BI8: a solved word as a slim line of small locked (purple) tiles, the circled
/// letters ringed, with a check at the end. `cell`: a 2 × 2 grid cell once the
/// punchline opens (centered, no row padding).
struct MuddleSolvedLine: View {
    @ObservedObject var vm: MuddleVM
    let row: Int
    let cell: Bool

    var body: some View {
        let w = vm.state.words[row]
        let answer = Array(w.answer)
        let circled = Set(w.circled)
        HStack(spacing: MdSize.compactGap) {
            ForEach(0..<answer.count, id: \.self) { i in
                MuddleTile(letter: String(answer[i]), look: .solved, ring: circled.contains(i), side: MdSize.compactTile)
            }
            if !cell {
                Spacer(minLength: 0)
                Image(systemName: "checkmark.circle.fill").font(.system(size: 15, weight: .bold))
                    .foregroundStyle(mdPurple.opacity(0.8))
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, cell ? 0 : MdSize.rowPad).padding(.vertical, cell ? 0 : 2)
        .frame(maxWidth: cell ? .infinity : nil)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Word \(row + 1), solved: \(w.answer)")
    }
}

/// The punchline under a divider, grouped by word, in the light lilac tint with
/// purple text; its tray is the circled letters in word order. It opens only
/// after the four words and checks the same way. Compact: label, the tray
/// (while open) and the ≈ 32 pt tiles stacked tight, the Letter circle at the right.
struct MuddleFinalRow: View {
    @ObservedObject var vm: MuddleVM
    let finished: Bool

    var body: some View {
        let s = vm.state
        let open = vm.finalOpen
        let entry = Array(s.entries[SCRAMBLE_FINAL])
        let solved = s.solved[SCRAMBLE_FINAL]
        let target = Array(scrambleTarget(s, SCRAMBLE_FINAL))
        let tray = Array(scrambleTray(s, SCRAMBLE_FINAL))
        let dimmed = muddleDimmed(tray: tray, remaining: scrambleRemaining(pool: scrambleTray(s, SCRAMBLE_FINAL), entry: s.entries[SCRAMBLE_FINAL]))
        let active = vm.row == SCRAMBLE_FINAL && !finished
        let showTray = open && !solved && !finished
        let pattern = s.final.pattern
        // Founder (2026-09-25, on build 191): the one-line squeeze looked "jammed". The tiles
        // keep their full size and the punchline WRAPS BY WORD like the newspaper answer boxes
        // (web and Android already do); a tile only shrinks, toward the floor, when a single
        // word is longer than the row.
        let width = muddleColumnWidth() - MdSize.rowPad * 2
        let longest = CGFloat(pattern.max() ?? 1)
        let locked = !open && !finished
        // BI8: while locked the pattern shows as small rings (one slim line); the open
        // punchline keeps readable coins.
        let full = locked ? MdSize.lockedRing : (finished ? 32 : MdSize.punchTile)
        let gapK: CGFloat = locked ? 3 : MdSize.punchGap
        let side = locked ? full : max(MdSize.punchTileFloor, min(full, floor((width - gapK * (longest - 1)) / longest)))
        let starts = muddleStarts(pattern)
        HStack(alignment: .center, spacing: MdSize.gap) {
            if locked {
                // BI8: locked = ONE slim line — the label and the pattern as small rings.
                HStack(alignment: .center, spacing: 8) {
                    HStack(spacing: 3) {
                        Image(systemName: "lock.fill").font(.system(size: 9, weight: .black))
                        Text("PUNCHLINE").font(Brand.font(10, .black)).tracking(1.2)
                    }
                    .foregroundStyle(FinishInk.secondary)
                    .fixedSize()
                    .accessibilityLabel("Solve the four words to unlock the punchline")
                    WordWrapLayout(spacing: locked ? 8 : MdSize.punchWordGap, lineSpacing: locked ? 2 : 4) {
                        ForEach(0..<pattern.count, id: \.self) { wi in
                            HStack(spacing: gapK) {
                                ForEach(0..<pattern[wi], id: \.self) { k in
                                    let idx = starts[wi] + k
                                    let ch: String = (solved || finished) ? (idx < target.count ? String(target[idx]) : "")
                                        : (idx < entry.count ? String(entry[idx]) : "")
                                    MuddlePunchCoin(letter: ch, side: side, solved: solved, index: idx)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    Text("THE PUNCHLINE")
                        .font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(FinishInk.secondary)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    if showTray {
                        WordWrapLayout(spacing: 5, lineSpacing: 3) {
                            ForEach(0..<tray.count, id: \.self) { i in
                                trayLetter(tray[i], size: MdSize.scrambleFont, color: FinishInk.softNumber, dimmed: dimmed[i], chip: MdSize.punchChip) {
                                    vm.tapTile(SCRAMBLE_FINAL, String(tray[i]))
                                }
                            }
                        }
                        .accessibilityElement(children: .contain)
                        .accessibilityLabel("Circled letters")
                    }
                    WordWrapLayout(spacing: locked ? 8 : MdSize.punchWordGap, lineSpacing: locked ? 2 : 4) {
                        ForEach(0..<pattern.count, id: \.self) { wi in
                            HStack(spacing: gapK) {
                                ForEach(0..<pattern[wi], id: \.self) { k in
                                    let idx = starts[wi] + k
                                    let ch: String = (solved || finished) ? (idx < target.count ? String(target[idx]) : "")
                                        : (idx < entry.count ? String(entry[idx]) : "")
                                    MuddlePunchCoin(letter: ch, side: side, solved: solved, index: idx)
                                }
                            }
                        }
                    }
                }
            }
            if showTray {
                Spacer(minLength: 0)
                hintButton("Reveal a letter", "lightbulb") { vm.revealLetter(SCRAMBLE_FINAL) }
            }
        }
        .padding(.horizontal, MdSize.rowPad).padding(.top, locked ? 5 : 8).padding(.bottom, locked ? 1 : 4)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(active ? PuzKit.face(Color(hex: 0xF5A524), 0.2) : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(active ? PuzKit.line(Color(hex: 0xF5A524), 0.5) : Color.clear, lineWidth: 1.5))
        // A soft seam in the tray's color divides the punchline (no gray rule).
        .overlay(alignment: .top) { Capsule().fill(GameTray.seam(muddleAccent)).frame(height: 1.5).padding(.horizontal, 4) }
        .opacity(open || finished ? 1 : 0.55)
        .contentShape(Rectangle())
        .onTapGesture { if !solved && !finished { vm.select(SCRAMBLE_FINAL) } }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Punchline\(solved ? ", solved" : open ? "" : ", locked")")
    }
}
