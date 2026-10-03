import SwiftUI
import WordociousCore

// Starsweep (More Games §18b) — the iOS twin of components/regions/*. Place one
// star in every row, column and color region, no two touching. Daily 7 × 7
// Monday–Wednesday, 8 × 8 Thursday–Sunday; Pro Unlimited picks 7 / 8 / 9.
// Tap = star, again = cross out, again = clear (founder, 2026-09-28). A wrong star is a mistake, the
// third loses; a hint places one correct star for a score cost, never a
// mistake. guess_count = mistakes + 1 (the Sudoku scoring row).
//
// Wording (§18b guard): always "Starsweep", one word; win copy "Board cleared";
// never "Sweep!" — Starsweep does not count toward the Daily Sweep.

private let regionsAccent = Color(hex: 0xCA8A04)
private let regionsSizeLabel: [Int: String] = [7: "7 × 7", 8: "8 × 8", 9: "9 × 9"]
private let regionsSizes = [7, 8, 9]

@MainActor
final class RegionsVM: ObservableObject {
    @Published private(set) var state: RegionsState
    @Published var focused: Int?
    @Published var toast: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    /// nil seed = today's daily (size by weekday); an Unlimited seed carries its size.
    let isDaily: Bool
    let seed: String

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
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.regions.rawValue)
        let n = seed == nil ? regionsSizeForDay(today) : regionsSizeForSeed(self.seed)
        // generateRegions is nil only if 400 attempts fail — never observed; fall back to a tiny valid board.
        let puzzle = generateRegions(self.seed, n: n) ?? generateRegions(self.seed + "-fallback", n: 7)!
        state = RegionsState(puzzle: puzzle, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
    }

    var isFinished: Bool { state.status != .playing }
    var mistakes: Int { state.mistakes }
    var hintsUsed: Int { state.hintsUsed }
    var n: Int { state.n }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { regionsDailyNumber(LeaderboardService.todayLocal()) }
    var remaining: Int { regionsRemaining(state) }
    var sizeLabel: String { regionsSizeLabel[n] ?? "\(n) × \(n)" }

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

    // MARK: - Persistence (mirrors components/regions/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: RegionsState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "regions-save-daily" : "regions-save-\(seed)" }
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
        if state.status != .playing { finalTimeSeconds = snap.elapsed; recorded = true; restoredFinished = true }        // A board with every star played must end (a save from before the red-star fix could sit
        // solved with the clock running — founder, 2026-09-28).
        else if regionsRemaining(state) == 0 { DispatchQueue.main.async { [weak self] in self?.dispatch(.settle) } }
    }

    // MARK: - Actions

    private func ch(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }

    private func dispatch(_ a: RegionsAction) {
        guard !isFinished else { return }
        state = regionsReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    /// A tap cycles the cell (empty → black star → × → empty) at once and makes it the focus for
    /// Erase/Hint. A second tap on the same cell within `doubleTapWindow`, when the first began
    /// from empty or a black star, is a double tap: undo the first and COMMIT (play) the star —
    /// purple when right, red when wrong (founder, 2026-09-28 afternoon).
    private var lastTap: (cell: Int, at: Date, from: Character)?
    private let doubleTapWindow: TimeInterval = 0.35
    func tap(_ cell: Int) {
        guard !isFinished, cell >= 0, cell < n * n else { return }
        focused = cell
        let cur = ch(state.board, cell)
        if cur == "*" && ch(state.hintMask, cell) == "1" { SoundManager.shared.playInvalid(); return }
        let now = Date()
        if let last = lastTap, last.cell == cell, now.timeIntervalSince(last.at) <= doubleTapWindow, last.from == "." || last.from == "o" {
            lastTap = nil
            let wrong = (Int(ch(state.solution, cell / n).asciiValue!) - 48) != cell % n
            dispatch(.undo)
            dispatch(.commit(cell: cell))
            if wrong && !isFinished { Haptics.warning(); SoundManager.shared.playInvalid() } else { SoundManager.shared.playKeyTap() }
            return
        }
        lastTap = (cell, now, cur)
        dispatch(.tap(cell: cell))
        SoundManager.shared.playKeyTap()
    }
    func erase() { guard let cell = focused else { return }; dispatch(.erase(cell: cell)) }
    func undo() { dispatch(.undo) }
    func toggleAutoCross() { dispatch(.setAutoCross(!state.autoCross)) }
    func hint() { dispatch(.hint(cell: focused)) }

    var canErase: Bool {
        guard let f = focused, f < n * n else { return false }
        let cur = ch(state.board, f)
        return cur != "." && !(cur == "*" && ch(state.hintMask, f) == "1")
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = state.mistakes + 1, used = state.hintsUsed
        let row = regionsMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .regions, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .regions, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.regions.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }
}

struct RegionsView: View {
    @StateObject private var vm: RegionsVM
    /// Pro Unlimited "Play Again" / size switch — HomeView swaps in a fresh seed.
    var onPlayAgain: ((Int) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: ((Int) -> Void)? = nil) {
        _vm = StateObject(wrappedValue: RegionsVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.regions))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — title + the compact result strip, the
                // board on its won / lost tray scaled to the height left, then the dock
                // (share + the daily CTAs / the Unlimited card); the score card below.
                FinishedScreenLayout {
                    VStack(spacing: 6) { header; result }
                } board: { _ in
                    board.padding(.horizontal, 6)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "REGIONS", game: "Starsweep", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?(vm.n) } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    VStack(spacing: 10) {
                        if vm.isDaily { DailyRankBadge(gameMode: .regions) }
                        finishedCards
                    }
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // FINISH_SPEC §Z: the Unlimited picker's slot is reserved in Daily too
                    // (empty there), so a Pro's board sits at the same spot in both modes.
                    let slots = GameHeaderLayout.slots(mode: vm.isDaily ? .daily : .unlimited, offersPicker: isPro)
                    if slots.pickerHeight > 0 {
                        sizePicker
                            .frame(height: CGFloat(slots.pickerHeight))
                            .opacity(slots.showsPicker ? 1 : 0)
                            .allowsHitTesting(slots.showsPicker)
                            .accessibilityHidden(!slots.showsPicker)
                    }
                    Spacer(minLength: 4)
                    board.padding(.horizontal, 6)
                    Spacer(minLength: 4)
                    // // §BI9: the feedback popup hangs from the line under the board — never over the title art or the board.
                    // §BI22: one fixed-height status line — the first move (or a hint)
                    // swaps the 11-pt tip for the 15-pt count without nudging the board.
                    starsLeft.frame(height: 22).gameFeedbackToast(vm.toast, alignment: .top)
                    RegionsPad(vm: vm).padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.mistakes, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISTAKES",
                    points: Int(DailyScoring.breakdown(gameMode: GameMode.regions.rawValue, completed: vm.state.status == .won,
                                                       guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                                                       boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                                                       hintsUsed: vm.hintsUsed).total),
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?(vm.n) } : nil,
                    game: .regions,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .regions) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.regions))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("REGIONS")
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

    /// The status line's ink (the game kit's #6a4fa0; themed in Dark) — matches GameScreen.
    private static var statusInk: Color { Theme.isDark ? Theme.textMuted : Color(hex: 0x6A4FA0) }

    private var header: some View {
        VStack(spacing: 4) {
            Text("STARSWEEP").font(Brand.font(24, .black)).foregroundStyle(regionsAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.regions)
            // FINISH_SPEC §B4: the status line under the title; numbers are soft numbers (§A2).
            HStack(spacing: 10) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").softNumber(13) }
                Text(vm.sizeLabel).font(Brand.font(12, .heavy)).foregroundStyle(Self.statusInk)
                if !vm.isFinished {
                    HStack(spacing: 4) {
                        Text("Mistakes").font(Brand.font(12, .heavy)).foregroundStyle(Self.statusInk)
                        StarsweepMistakeDots(used: vm.mistakes, total: REGIONS_MAX_MISTAKES)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(vm.mistakes) of \(REGIONS_MAX_MISTAKES) mistakes")
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 3) {
                            Image(systemName: "clock").font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: 0x60A5FA))
                            Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))").monospacedDigit().softNumber(13)
                        }
                    }
                }
            }
        }
    }

    /// Under the board: the first-move tip, then "N stars left" with a soft number.
    @ViewBuilder private var starsLeft: some View {
        if vm.remaining == vm.n && vm.state.history.isEmpty {
            Text("Tap for a black star · double-tap to play it")
                .font(Brand.font(11, .heavy)).foregroundStyle(Self.statusInk)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(vm.remaining)").softNumber(15)
                Text("star\(vm.remaining == 1 ? "" : "s") left").font(Brand.font(11, .heavy)).foregroundStyle(Self.statusInk)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(vm.remaining) star\(vm.remaining == 1 ? "" : "s") left")
        }
    }

    /// Pro Unlimited: 7 × 7 · 8 × 8 · 9 × 9 tinted chips (selected = stronger tint +
    /// accent ring); switching starts a fresh board.
    private var sizePicker: some View {
        HStack(spacing: 8) {
            ForEach(regionsSizes, id: \.self) { n in
                let active = n == vm.n
                let dark = Theme.isDark
                let shape = Capsule(style: .continuous)
                Button { if !active { onPlayAgain?(n) } } label: {
                    Text(regionsSizeLabel[n] ?? "\(n)").font(Brand.font(12, .black)).monospacedDigit()
                        .foregroundStyle(active ? FinishInk.number : FinishInk.secondary)
                        .padding(.horizontal, 13).padding(.vertical, 6)
                        .background(shape.fill(dark ? regionsAccent.opacity(active ? 0.28 : 0.12)
                                                    : regionsAccent.wash(active ? 0.26 : 0.12)))
                        .overlay(shape.strokeBorder(active ? regionsAccent : (dark ? regionsAccent.opacity(0.4) : regionsAccent.wash(0.32)),
                                                    lineWidth: active ? 2 : 1.5))
                        .overlay(active ? shape.inset(by: -3).stroke(regionsAccent.opacity(0.22), lineWidth: 3) : nil)
                }
                .buttonStyle(.squish)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(.vertical, 2)
    }

    private var board: some View {
        RegionsBoardView(state: vm.state, focused: vm.isFinished ? nil : vm.focused,
                         revealSolution: vm.state.status == .lost) { cell in
            if !vm.isFinished { vm.tap(cell); Haptics.tap() }
        }
    }

    /// FINISH_SPEC §B6 result line: the headline, then tinted pills (purple mistakes,
    /// blue time) with 3D icons + soft numbers and the bare 3D share icon (no "Home"
    /// text link — the house up top does that); Pro Unlimited's Play Again is an amber
    /// candy button.
    /// FINISH_SPEC §R2 result: the headline and the compact one-line strip (badge ·
    /// mistakes · time · points); the share icon and Play Again live in the dock.
    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let remaining = vm.remaining
        let summary = won
            ? "\(formatGuessStat(semantics: "mistakes", guessBase: 1, guessCount: vm.mistakes + 1)) · \(timeText(secs))\(vm.hintsUsed > 0 ? " · \(vm.hintsUsed) hint\(vm.hintsUsed == 1 ? "" : "s")" : "")"
            : "\(remaining) star\(remaining == 1 ? "" : "s") left · \(timeText(secs))"
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? "Board cleared" : "Out of mistakes", won: won)
            PuzResultLine(won: won, items: [("\(vm.mistakes)", vm.mistakes == 1 ? "mistake" : "mistakes"),
                                                  (puzClock(secs), "time")],
                                points: points)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(summary)
            if !won || vm.hintsUsed > 0 {
                Text(won ? "\(vm.hintsUsed) hint\(vm.hintsUsed == 1 ? "" : "s") used" : "\(remaining) star\(remaining == 1 ? "" : "s") left")
                    .font(Brand.font(12, .bold))
                    .foregroundStyle(won ? FinishInk.secondary : Color(hex: 0xE11D48))
                    .accessibilityHidden(true)
            }
        }
    }

    private var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.regions.rawValue, completed: vm.state.status == .won,
                                   guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                                   boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                                   hintsUsed: vm.hintsUsed).total)
    }

    /// The score card (lavender, phase 1's ScoreBreakdownView) and the next-daily CTAs.
    private var finishedCards: some View {
        let won = vm.state.status == .won
        return VStack(spacing: 10) {
            ScoreBreakdownView(gameMode: GameMode.regions.rawValue, completed: won,
                               guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                               boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.bottom, 12)
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.regions.rawValue, surface: "post_game")
        ShareService.share(kind: .regions(n: vm.n, regions: vm.state.regions, board: vm.state.board, hintMask: vm.state.hintMask,
                                          mistakes: vm.mistakes, sizeLabel: vm.sizeLabel,
                                          puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .regions, modeLabel: "STARSWEEP", accent: regionsAccent, won: vm.state.status == .won,
                           guesses: vm.mistakes + 1, maxGuesses: REGIONS_MAX_MISTAKES + 1, timeSeconds: vm.elapsed,
                           points: Int(DailyScoring.breakdown(gameMode: GameMode.regions.rawValue, completed: vm.state.status == .won,
                                                              guessCount: vm.mistakes + 1, timeSeconds: vm.elapsed,
                                                              boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                                                              hintsUsed: vm.hintsUsed).total),
                           puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}

// MARK: - Board

/// The soft region tints the share card uses (the live board draws `StarsweepPalette`).
let regionsTints: [Color] = [
    Color(hex: 0xEDE9FE), Color(hex: 0xD1FAE5), Color(hex: 0xE0F2FE), Color(hex: 0xFCE7F3), Color(hex: 0xFEF9C3),
    Color(hex: 0xCCFBF1), Color(hex: 0xFFEDD5), Color(hex: 0xECFCCB), Color(hex: 0xE2E8F0),
]

/// FINISH_SPEC §H + §L: the board as soft glossy candy tiles on the shared game
/// tray. Each region is a pastel of its own hue (`StarsweepPalette`, region index →
/// color); tiles of one region sit on the region's bed with a small gap, and region
/// borders read as a slightly thicker gap with a darker seam in the tray color (no
/// black lines, no plain white). Pieces are the glossy `art-starsweep-*` art at
/// ~78% of a cell. The focused cell wears a purple ring. Solved: the tray takes the
/// won (purple) / lost (slate) wash.
struct RegionsBoardView: View {
    let state: RegionsState
    let focused: Int?
    var revealSolution = false
    let onTap: (Int) -> Void

    private func ch(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }

    private var trayState: GameTrayState {
        switch state.status {
        case .won: return .won
        case .lost: return .lost
        case .playing: return .normal
        }
    }

    var body: some View {
        let n = state.n
        let tray = trayState
        GeometryReader { geo in
            // FINISH_SPEC §B5: the shared board-sizing rule (2% side margin, centered),
            // leaving room for the tray's padding on every side + its 4-pt lip.
            let cell = CGFloat(BoardSizing.fitTile(widthUnits: Double(n), fixedWidth: Double(GameTray.padding * 2),
                                                   heightUnits: Double(n), fixedHeight: Double(GameTray.padding * 2 + GameTray.lip),
                                                   width: Double(geo.size.width), height: Double(geo.size.height),
                                                   maxTile: 120, minTile: 4))
            let side = cell * CGFloat(n)
            let reg = Array(state.regions), b = Array(state.board), h = Array(state.hintMask), w = Array(state.wrongMask)
            let sol = Array(state.solution)
            VStack(spacing: 0) {
                ForEach(0..<n, id: \.self) { r in
                    HStack(spacing: 0) {
                        ForEach(0..<n, id: \.self) { c in
                            let i = r * n + c
                            let g = Int(reg[i].asciiValue!) - 48
                            let missing = revealSolution && b[i] != "*" && (Int(sol[r].asciiValue!) - 48) == c
                            let edges = StarsweepEdges(top: r > 0 && reg[i - n] != reg[i],
                                                       bottom: r < n - 1 && reg[i + n] != reg[i],
                                                       leading: c > 0 && reg[i - 1] != reg[i],
                                                       trailing: c < n - 1 && reg[i + 1] != reg[i])
                            cellView(i, mark: b[i], hinted: h[i] == "1", isWrong: w[i] == "1",
                                     missing: missing, cell: cell, region: g, edges: edges)
                        }
                    }
                }
            }
            .frame(width: side, height: side)
            // The seams between regions: a soft darker line in the tray's color.
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(GameTray.seam(GameTray.ink(regionsAccent, tray), strong: true)))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .gameTray(accent: regionsAccent, state: tray)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 420 + GameTray.padding * 2)
        .accessibilityLabel("Starsweep board")
    }

    @ViewBuilder
    private func cellView(_ i: Int, mark: Character, hinted: Bool, isWrong: Bool, missing: Bool, cell: CGFloat,
                          region: Int, edges: StarsweepEdges) -> some View {
        let n = state.n
        Button { onTap(i) } label: {
            StarsweepCell(mark: mark, hinted: hinted, wrong: isWrong, missing: missing, focused: i == focused,
                          region: region, edges: edges, cell: cell)
                .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityLabel("Row \(i / n + 1) column \(i % n + 1), region \(region + 1), \(mark == "*" ? (isWrong ? "wrong star" : "star") : mark == "o" ? "black star, double-tap to play" : mark == "x" ? "crossed out" : "empty")")
        .accessibilityAddTraits(i == focused ? .isSelected : [])
    }
}

// MARK: - Pad

/// Action row — Undo · Erase · Auto-cross · Hint, each with its icon (§19), as
/// small round candy buttons (FINISH_SPEC §A8 / §H) captioned underneath: peach for
/// the quiet tools, Auto-cross purple while it's on (a toggle: fixed label, state
/// shown by the fill), Hint amber.
struct RegionsPad: View {
    @ObservedObject var vm: RegionsVM

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            StarsweepTool(label: "Undo", symbol: "arrow.uturn.backward", dim: vm.state.history.isEmpty) { vm.undo() }
            StarsweepTool(label: "Erase", symbol: "eraser", dim: !vm.canErase) { vm.erase() }
            StarsweepTool(label: "Auto-cross", symbol: "xmark", variant: vm.state.autoCross ? .purple : .peach,
                          active: vm.state.autoCross) { vm.toggleAutoCross() }
            StarsweepTool(label: "Hint", symbol: "lightbulb.fill", variant: .amber, count: vm.hintsUsed) { vm.hint() }
        }
        .padding(.horizontal, 2)
    }
}
