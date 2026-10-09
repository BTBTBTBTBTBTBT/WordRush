import SwiftUI
import UIKit
import WordociousCore

// Letter Ladder (More Games §15) — the iOS twin of components/ladder/*. Change
// one letter at a time from START to END. Rejected entries are free; every
// accepted word is a move; the budget is par + 5; Undo is free but spent moves
// stay spent; Hint places the next rung on a shortest path and counts as a
// move. guess_count = moves − par + 1.

private let ladderAccent = Color(hex: 0x0284C7)

/// The bundled bank (Resources/ladder-puzzles.json — sha-guarded to match the web copy).
enum LadderBankStore {
    static let shared: LadderBank? = {
        guard let url = Bundle.main.url(forResource: "ladder-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return LadderBank.load(from: data)
    }()
    /// Letter Ladder's accepted rungs (Resources/ladder-words.json, the web's data/ladder-words.json):
    /// common American words only — never the full guess list (tester Doug, 2026-10-05: THAVE).
    static let words: Set<String>? = {
        guard let url = Bundle.main.url(forResource: "ladder-words", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([String].self, from: data), !list.isEmpty else { return nil }
        return Set(list)
    }()
}

@MainActor
final class LadderVM: ObservableObject {
    @Published private(set) var state: LadderState
    @Published var typing = ""
    @Published var invalid = false
    @Published var toast: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    let isDaily: Bool
    let seed: String
    let allowed: Set<String>

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
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.ladder.rawValue)
        let bank = LadderBankStore.shared ?? LadderBank(version: 1, epoch: LADDER_DAILY_EPOCH, daily: [], extra: [])
        let fallback = LadderPuzzle(id: "none", start: "STONE", end: "STARE", par: 2, path: ["STONE", "STORE", "STARE"])
        let puzzle = (seed == nil ? ladderPuzzleForDay(bank, day: today) : ladderPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        allowed = LadderBankStore.words ?? Set(GameDictionary.shared.getAllowedWordsForLength(5).filter { $0.count == 5 }.map { $0.uppercased() })
        state = LadderState(puzzle: puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
    }
    /// Read-only: a finished board rebuilt from a matches row (the Completed-today dropdown). Never saves or records.
    init(display s: LadderState) {
        isDaily = true; seed = s.seed; allowed = []; state = s; finalTimeSeconds = 0; recorded = true; restoredFinished = true
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { ladderDailyNumber(LeaderboardService.todayLocal()) }
    var movesLeft: Int { max(0, state.maxMoves - state.moves) }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.ladder.rawValue, completed: state.status == .won, guessCount: state.guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.status == .won ? 1 : 0, totalBoards: 1, hintsUsed: state.hintsUsed).total)
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

    // MARK: - Persistence (mirrors components/ladder/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: LadderState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "ladder-save-daily" : "ladder-save-\(seed)" }
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

    // MARK: - Actions

    private func dispatch(_ a: LadderAction) {
        guard !isFinished else { return }
        state = ladderReduce(state, a, allowed: allowed, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    func type(_ letter: String) {
        guard !isFinished, typing.count < LADDER_WORD_LENGTH else { return }
        typing += letter.uppercased()
    }
    func delete() { guard !typing.isEmpty else { return }; typing.removeLast(); SoundManager.shared.playDelete() }
    func submit() {
        guard !isFinished else { return }
        guard typing.count == LADDER_WORD_LENGTH else { flash("Five letters, please"); return }
        let before = state.words.count
        dispatch(.submit(typing))
        if let r = state.reject {
            flash(rejectCopy(r)); Haptics.warning(); SoundManager.shared.playInvalid()
            invalid = true
            Task { try? await Task.sleep(nanoseconds: 500_000_000); invalid = false; typing = "" }
        } else if state.words.count > before {
            typing = ""; if !isFinished { Feedback.found() }   // §U: a rung climbed — notify @0.7 · light
        }
    }
    func undo() { dispatch(.undo); typing = "" }
    func hint() { let before = state.words.count; dispatch(.hint); if state.words.count > before { typing = "" } }

    private func rejectCopy(_ r: LadderReject) -> String {
        switch r {
        case .finished: return "This ladder is finished"
        case .length: return "Five letters, please"
        case .notOneLetter: return "Change exactly one letter"
        case .revisit: return "Already on the ladder"
        case .notWord: return "Not in word list"
        }
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = state.guessCount, used = state.hintsUsed
        let row = ladderMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .ladder, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .ladder, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.ladder.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct LadderView: View {
    @StateObject private var vm: LadderVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false
    /// §R2: the finished ladder's "See all".
    @State private var showAllRungs = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: LadderVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.ladder))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the ladder as a
                // summary scaled to the height left ("See all" expands it in place),
                // the dock; the breakdown sits below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 6) { header; resultHeadline }
                } board: { size in
                    finishedLadder(size)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "LADDER", game: "Letter Ladder", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    result
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // Doug (Android, 10-05; same layout here): the board scrolled as one block, so
                    // a few rungs pushed the REACH row under the controls. The tiles now size to
                    // the height left, and an over-long ladder scrolls only its climbed rungs.
                    GeometryReader { geo in
                        LadderPlayBoard(vm: vm, height: geo.size.height)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    }
                    .padding(.horizontal, 6).padding(.vertical, 4)
                    // // §BI9: the feedback popup hangs from the line under the board — never over the title art or the board.
                    // §BI22: equal halves — "Hint · 2" never widens its pill or nudges Undo.
                    HStack(spacing: 8) {
                        capsule("Undo", "arrow.uturn.backward", variant: .peach, dim: vm.state.words.count <= 1) { vm.undo() }
                        capsule("Hint", "lightbulb", variant: .amber, count: vm.state.hintsUsed) { vm.hint() }
                    }
                    .frame(maxWidth: 300)
                    .gameFeedbackToast(vm.toast, alignment: .top)
                    // Hardware keys (founder, 2026-09-30): web ladder-game keydown —
                    // A–Z / Return / Delete as the keys, plus ⌘Z = Undo.
                    LetterKeyboard(onLetter: { vm.type($0) }, onEnter: { vm.submit() }, onDelete: { vm.delete() },
                                   onHardwareKey: { key in
                                       guard key == .undo else { return false }
                                       vm.undo(); return true
                                   })
                        .padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.moves, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MOVES", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    game: .ladder,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .softSheet(isPresented: $showGuide) { GuideSheet(mode: .ladder) }
                .firstPlayGuide(mode: .ladder, show: $showGuide)
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.ladder))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("LADDER")
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

    /// §A8: small candy pills (peach Undo, amber Hint).
    private func capsule(_ label: String, _ symbol: String, variant: CandyButtonStyle.Variant, dim: Bool = false,
                         count: Int = 0, action: @escaping () -> Void) -> some View {
        PuzCandyAction(title: label, symbol: symbol, variant: variant, fullWidth: true, count: count, action: action)
            .disabled(dim)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("LETTER LADDER").font(Brand.font(24, .black)).foregroundStyle(ladderAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.ladder)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                Text("Par \(vm.state.par)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                Text("\(vm.state.moves) move\(vm.state.moves == 1 ? "" : "s") · \(vm.movesLeft) left").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
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

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.state.status == .won
        let gc = vm.state.guessCount
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? (gc == 1 ? "Ladder climbed on par" : "Ladder climbed") : "Out of moves", won: won)
            PuzResultLine(won: won, items: [("\(vm.state.moves)", vm.state.moves == 1 ? "move" : "moves"),
                                                  (puzClock(vm.elapsed), "time")],
                                points: vm.points)
        }
    }

    /// §R2: the finished ladder in the height left — collapsed to a summary with a
    /// "See all" that expands it in place (the area scrolls once expanded).
    private func finishedLadder(_ size: CGSize) -> some View {
        let s = vm.state
        let hasHidden = LadderBoardView.hasHidden(s, revealPath: s.status == .lost)
        let collapsed = hasHidden && !showAllRungs
        let rows = CGFloat((collapsed ? min(s.words.count, 2) : s.words.count) + (s.current != s.end ? 1 : 0))
        let chrome: CGFloat = GameTray.padding * 2 + GameTray.lip + (hasHidden ? 48 : 0) + (collapsed ? 26 : 0) + (s.current != s.end ? 18 : 0)
        let tile = collapsed ? max(24, min(44, (size.height - chrome) / max(1, rows) - 6)) : 44
        return ScrollView(showsIndicators: false) {
            VStack(spacing: 8) {
                LadderBoardView(vm: vm, revealPath: s.status == .lost, tray: true, collapsed: collapsed, tileSize: tile)
                    .padding(.horizontal, 6)
                if hasHidden { PuzSeeAllToggle(expanded: $showAllRungs, title: "See all rungs") }
            }
            .frame(maxWidth: .infinity, minHeight: size.height)
        }
        .scrollDisabled(collapsed)
    }

    /// Below the dock (§R2): the full summary line, the daily rank and the breakdown.
    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.state.guessCount
        let parLabel = formatGuessStat(semantics: "overPar", guessBase: 1, guessCount: gc)
        return VStack(spacing: 10) {
            Text("\(vm.state.moves) move\(vm.state.moves == 1 ? "" : "s") · Par \(vm.state.par)\(won ? " · \(parLabel)" : "") · \(timeText(secs))\(vm.state.hintsUsed > 0 ? " · \(vm.state.hintsUsed) hint\(vm.state.hintsUsed == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(ladderAccent)
            if vm.isDaily { DailyRankBadge(gameMode: .ladder) }
            ScoreBreakdownView(gameMode: GameMode.ladder.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: vm.state.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.vertical, 12)
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.ladder.rawValue, surface: "post_game")
        ShareService.share(kind: .ladder(start: vm.state.start, end: vm.state.end, words: vm.state.words, hintMask: vm.state.hintMask,
                                         par: vm.state.par, moves: vm.state.moves, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .ladder, modeLabel: "LETTER LADDER", accent: ladderAccent, won: vm.state.status == .won,
                           guesses: vm.state.guessCount, maxGuesses: 6, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}

// MARK: - Board

/// One tile of the ladder in the game kit's glossy look (FINISH_SPEC §B1 / §J):
/// START purple, a changed letter in the ladder's sky accent (a hint rung purple
/// with the gold ring), plain rungs the light "given" tile, the typing row
/// frosted → typed (it pops in) → red when not a word, END a frosted target with
/// a dashed accent ring, the revealed route ghosted.
private enum LadderLook: Equatable { case start, changed, hint, plain, empty, typed, invalid, end, reveal }

private struct LadderTile: View {
    let letter: String
    let look: LadderLook
    var size: CGFloat = 44

    var body: some View {
        Group {
            switch look {
            case .changed:
                PuzPaletteTile(palette: TilePalette.from(ladderAccent), letter: letter, width: size)
            case .end:
                GlossyTile(face: .empty, letter: "", width: size)
                    .overlay(
                        RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                            .strokeBorder(style: StrokeStyle(lineWidth: max(1.5, size * 0.05), dash: [5, 4]))
                            .foregroundStyle(ladderAccent.opacity(0.55))
                            .padding(.bottom, size * 0.07)
                    )
                    .overlay(
                        Text(letter).font(Brand.fixedFont(size * 0.5, .black)).foregroundStyle(ladderAccent)
                            .padding(.bottom, size * 0.07)
                    )
            default:
                GlossyTile(face: face, letter: letter, width: size, letterScale: 0.5,
                           glowAmount: look == .hint ? 0.9 : 0, goldRing: look == .hint)
            }
        }
        .modifier(TypePop(letter: look == .typed ? letter : "", size: CGSize(width: size, height: size)))
    }

    private var face: GlossyFace {
        switch look {
        case .start, .hint: return .correct
        case .plain: return .given
        case .typed: return .typed
        case .invalid: return .bad
        case .reveal: return .hintUsed
        default: return .empty
        }
    }
}

struct LadderBoardView: View {
    @ObservedObject var vm: LadderVM
    let revealPath: Bool
    /// §L: sit the rungs on the shared game tray (the live game; recaps tray at
    /// their own call sites).
    var tray = false
    /// §R2: the finished screen's summary — START, a "N more rungs" pill, the last
    /// rung (and the target); the shortest route stays hidden until "See all".
    var collapsed = false
    /// The tile side (the finished screen shrinks it to fit the height left).
    var tileSize: CGFloat = 44

    /// Whether `collapsed` actually hides anything.
    static func hasHidden(_ s: LadderState, revealPath: Bool) -> Bool { s.words.count > 3 || (revealPath && !s.path.isEmpty) }

    private func row(_ word: String, prev: String?, kind: String, invalid: Bool = false) -> some View {
        LadderRowView(word: word, prev: prev, kind: kind, invalid: invalid, tileSize: tileSize)
    }

    var body: some View {
        let s = vm.state
        let hints = Array(s.hintMask)
        let fold = collapsed && s.words.count > 3
        let shown: [Int] = fold ? [0, s.words.count - 1] : Array(s.words.indices)
        VStack(spacing: 6) {
            ForEach(shown, id: \.self) { i in
                if fold && i == s.words.count - 1 {
                    // The hidden middle rungs as one summary pill.
                    let hidden = s.words.count - 2
                    Text("⋯ \(hidden) more rung\(hidden == 1 ? "" : "s") ⋯")
                        .font(Brand.font(11, .black)).foregroundStyle(FinishInk.secondary)
                        .padding(.horizontal, 10).padding(.vertical, 3)
                        .tintedPill(ladderAccent)
                }
                row(s.words[i], prev: i > 0 ? s.words[i - 1] : nil, kind: i == 0 ? "start" : (i < hints.count && hints[i] == "1" ? "hint" : "rung"))
            }
            if s.status == .playing { row(vm.typing, prev: s.current, kind: "typing", invalid: vm.invalid) }
            if s.current != s.end {
                Text("↓ \(s.status == .playing ? "REACH" : "TARGET")").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(ladderAccent.opacity(0.7))
                row(s.end, prev: nil, kind: "end")
            }
            if revealPath && !collapsed {
                Text("ONE SHORTEST ROUTE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(FinishInk.secondary).padding(.top, 8)
                ForEach(Array(s.path.enumerated()), id: \.offset) { i, w in row(w, prev: i > 0 ? s.path[i - 1] : nil, kind: "reveal") }
            }
        }
        .modifier(LadderTrayChrome(on: tray, state: s.status == .won ? .won : (s.status == .lost ? .lost : .normal)))
        .accessibilityLabel("Letter Ladder")
    }
}

/// One rung: five ladder tiles (START / rung / hint / typing / end / reveal).
private struct LadderRowView: View {
    let word: String
    let prev: String?
    let kind: String
    var invalid = false
    var tileSize: CGFloat = 44

    var body: some View {
        let chars = Array(word.padding(toLength: 5, withPad: " ", startingAt: 0))
        let prevChars = prev.map(Array.init)
        HStack(spacing: 5) {
            ForEach(0..<5, id: \.self) { i in
                let ch = chars[i] == " " ? "" : String(chars[i])
                let changed = prevChars.map { $0[i] != chars[i] } ?? false
                switch kind {
                case "start": LadderTile(letter: ch, look: .start, size: tileSize)
                case "rung", "hint":
                    if changed { LadderTile(letter: ch, look: kind == "hint" ? .hint : .changed, size: tileSize) }
                    else { LadderTile(letter: ch, look: .plain, size: tileSize) }
                case "typing": LadderTile(letter: ch, look: ch.isEmpty ? .empty : (invalid ? .invalid : .typed), size: tileSize)
                case "end": LadderTile(letter: ch, look: .end, size: tileSize)
                default: LadderTile(letter: ch, look: .reveal, size: tileSize)
                }
            }
        }
    }
}

/// The live ladder's tile size for the height it has (Android LadderFit twin).
enum LadderFit {
    static let maxTile: CGFloat = 44
    static let minTile: CGFloat = 26
    struct Fit: Equatable { let tile: CGFloat; let gap: CGFloat; let scrolls: Bool }

    /// `rungs` climbed words (START included) + the typing row (+ the REACH label of
    /// `labelLine` pt and the target when `showEnd`) inside the tray's chrome, in `height`.
    static func fit(height: CGFloat, rungs: Int, showEnd: Bool, labelLine: CGFloat) -> Fit {
        let rows = CGFloat(rungs + 1 + (showEnd ? 1 : 0))
        let chrome = GameTray.padding * 2 + GameTray.lip
        for (gap, floor) in [(CGFloat(6), CGFloat(36)), (4, minTile)] {
            let fixed = chrome + (showEnd ? labelLine + gap : 0)
            let t = min(maxTile, (height - fixed - gap * (rows - 1)) / rows)
            if t >= floor { return Fit(tile: t.rounded(.down), gap: gap, scrolls: false) }
        }
        return Fit(tile: minTile, gap: 4, scrolls: true)
    }
}

/// The live ladder: every rung, the typing row and the target fit `height`; when
/// even the smallest tile is too tall, only the climbed rungs scroll (kept at the
/// newest) and the typing row + REACH + target stay pinned in view.
private struct LadderPlayBoard: View {
    @ObservedObject var vm: LadderVM
    let height: CGFloat

    var body: some View {
        let s = vm.state
        let hints = Array(s.hintMask)
        let showEnd = s.current != s.end
        let label = ceil(min(UIFontMetrics.default.scaledValue(for: 10), 20) * 1.3)
        let f = LadderFit.fit(height: height, rungs: s.words.count, showEnd: showEnd, labelLine: label)
        let rungs = VStack(spacing: f.gap) {
            ForEach(Array(s.words.enumerated()), id: \.offset) { i, w in
                LadderRowView(word: w, prev: i > 0 ? s.words[i - 1] : nil,
                              kind: i == 0 ? "start" : (i < hints.count && hints[i] == "1" ? "hint" : "rung"), tileSize: f.tile)
                    .id(i)
            }
        }
        // The rungs' share of the height when they scroll: the slot minus the tray
        // chrome and the pinned rows below them.
        let pinned = f.tile + f.gap + (showEnd ? label + f.tile + f.gap * 2 : 0)
        let rungsH = max(f.tile, height - GameTray.padding * 2 - GameTray.lip - pinned)
        VStack(spacing: f.gap) {
            if f.scrolls {
                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) { rungs }
                        .frame(height: rungsH)
                        .onAppear { proxy.scrollTo(s.words.count - 1, anchor: .bottom) }
                        .onChange(of: s.words.count) { n in withAnimation(Theme.animation(.easeOut(duration: 0.2))) { proxy.scrollTo(n - 1, anchor: .bottom) } }
                }
            } else {
                rungs
            }
            LadderRowView(word: vm.typing, prev: s.current, kind: "typing", invalid: vm.invalid, tileSize: f.tile)
            if showEnd {
                Text("↓ REACH").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(ladderAccent.opacity(0.7))
                    .lineLimit(1).frame(height: label)
                LadderRowView(word: s.end, prev: nil, kind: "end", tileSize: f.tile)
            }
        }
        .gameTray(accent: ladderAccent, state: .normal)
        .accessibilityLabel("Letter Ladder")
    }
}

/// §L: the rungs on the shared game tray (opt-in).
private struct LadderTrayChrome: ViewModifier {
    let on: Bool
    let state: GameTrayState

    @ViewBuilder
    func body(content: Content) -> some View {
        if on { content.gameTray(accent: ladderAccent, state: state) } else { content }
    }
}
