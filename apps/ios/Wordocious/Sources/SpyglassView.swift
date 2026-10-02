import SwiftUI
import WordociousCore

// Spyglass (More Games §17) — the iOS twin of components/wordsearch/*. Ten
// themed words hidden in a 10 × 10 grid, four forward directions in the daily.
// Tap-start / tap-end or drag to select; a straight line of four or more
// letters that spells no list word is a miss. Hint pulses a first letter
// (score cost, never a miss). The word list starts HIDDEN (founder, 2026-09-26):
// chips show each word's length; Show words lists the rest and every later find
// counts like a miss. Reveal (after five minutes) records a loss with
// what was found. guess_count = min(10 + misses, 15).

private let spyglassAccent = Color(hex: 0x4D7C0F)
private let spyglassInk = Color(hex: 0x365314)
private let revealAfterSeconds = 300

/// The bundled bank (Resources/wordsearch-puzzles.json — sha-guarded to match the web copy).
enum WordsearchBankStore {
    static let shared: WordsearchBank? = {
        guard let url = Bundle.main.url(forResource: "wordsearch-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return WordsearchBank.load(from: data)
    }()
}

@MainActor
final class SpyglassVM: ObservableObject {
    @Published private(set) var state: WordsearchState
    @Published var toast: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

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
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.wordsearch.rawValue)
        let bank = WordsearchBankStore.shared ?? WordsearchBank(version: 1, epoch: WORDSEARCH_DAILY_EPOCH, daily: [], extra: [])
        let fallback = WordsearchPuzzle(id: "none", theme: "none", family: "none", title: "Spyglass", grid: String(repeating: "A", count: 100), words: [WordsearchPlacement(w: "AAAA", r: 0, c: 0, d: "E")])
        let puzzle = (seed == nil ? wordsearchPuzzleForDay(bank, day: today) : wordsearchPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        state = WordsearchState(puzzle: puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
    }
    /// Read-only: a finished board rebuilt from a matches row (the Completed-today dropdown). Never saves or records.
    init(display s: WordsearchState) {
        isDaily = true; seed = s.seed; state = s; finalTimeSeconds = 0; recorded = true; restoredFinished = true
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { wordsearchDailyNumber(LeaderboardService.todayLocal()) }
    var canReveal: Bool { elapsed >= revealAfterSeconds }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.wordsearch.rawValue, completed: state.status == .won, guessCount: state.guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.found.count, totalBoards: state.words.count, hintsUsed: state.hintsUsed).total)
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

    // MARK: - Persistence

    private struct Snapshot: Codable { let seed: String; let date: String; let state: WordsearchState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "wordsearch-save-daily" : "wordsearch-save-\(seed)" }
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

    private func dispatch(_ a: WordsearchAction) {
        guard !isFinished else { return }
        state = wordsearchReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    func select(from: Int, to: Int) {
        guard !isFinished else { return }
        // A theme word hiding in the filler (founder, 2026-09-30: STARS in Night Sky) — never a miss.
        if let near = wordsearchNearWord(state, from: from, to: to) {
            SoundManager.shared.playKeyTap(); flash("\(near) fits the theme, but it's not one of today's 10"); return
        }
        let before = state
        dispatch(.select(from: from, to: to))
        if state.found.count > before.found.count { Haptics.tap(); SoundManager.shared.playFound() }
        else if state.misses > before.misses { Haptics.warning(); SoundManager.shared.playInvalid(); flash("Not one of the words") }
    }
    func hint() { let before = state.hintsUsed; dispatch(.hint); if state.hintsUsed > before { SoundManager.shared.playKeyTap() } }
    func showWords() { guard !state.wordsShown else { return }; dispatch(.show); flash("Words shown — finds from here count like misses") }
    func reveal() {
        guard canReveal else { flash("Reveal unlocks at \(revealAfterSeconds / 60):00"); return }
        dispatch(.reveal)
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = state.guessCount, used = state.hintsUsed
        let found = state.found.count, total = state.words.count
        let row = wordsearchMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .wordsearch, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: found, totalBoards: total,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .wordsearch, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.wordsearch.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct SpyglassView: View {
    @StateObject private var vm: SpyglassVM
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: SpyglassVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.wordsearch))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the grid scaled to
                // the height left, the dock; the word list + breakdown below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 4) { header; resultHeadline }
                } board: { _ in
                    SpyglassGridView(vm: vm, revealMissing: vm.state.status == .lost, tray: true).padding(.horizontal, 6)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "WORDSEARCH", game: "Spyglass", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() })
                } extras: {
                    VStack(spacing: 10) { wordChips; result }.padding(.top, 8)
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // Grid, word chips and the two capsules are one centered block (founder, 2026-09-24).
                    Spacer(minLength: 6)
                    SpyglassGridView(vm: vm, revealMissing: false, tray: true).padding(.horizontal, 6)
                    wordChips.padding(.top, 4)
                    // §A8: candy pills — amber Hint, teal Show words, peach Reveal
                    // (each fades while it's unavailable). One row when it fits.
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) { hintPill; showPill; revealPill }
                        VStack(spacing: 6) { HStack(spacing: 8) { hintPill; showPill }; revealPill }
                    }
                    .padding(.top, 6)
                    Spacer(minLength: 6)
                    Spacer().frame(height: 4)
                }
                .padding(.horizontal, 10)
            }
            if let toast = vm.toast {
                // FINISH_SPEC §K1: the tinted toast pill in the event's color.
                G5Toast(text: toast, tone: G5Toast.tone(forGameMessage: toast))
                    .padding(.top, 110).frame(maxHeight: .infinity, alignment: .top)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.misses, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.found.count, totalBoards: vm.state.words.count,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISSES", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    game: .wordsearch,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .wordsearch) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.wordsearch))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("WORDSEARCH")
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

    /// §A8: a small candy pill; `dim` shows it faded (it stays tappable — the
    /// view model explains why it can't act yet).
    private func capsule(_ label: String, _ symbol: String, variant: CandyButtonStyle.Variant, dim: Bool = false,
                         action: @escaping () -> Void) -> some View {
        PuzCandyAction(title: label, symbol: symbol, variant: variant, action: action)
            .opacity(dim ? 0.55 : 1)
    }
    private var hintPill: some View {
        capsule(vm.state.hintsUsed > 0 ? "Hint · \(vm.state.hintsUsed)" : "Hint", "lightbulb", variant: .amber) { vm.hint() }
    }
    private var showPill: some View {
        capsule(vm.state.wordsShown ? "Words shown" : "Show words", "list.bullet", variant: .teal, dim: vm.state.wordsShown) { vm.showWords() }
    }
    private var revealPill: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            capsule(vm.canReveal ? "Reveal" : "Reveal · \(timeText(max(0, revealAfterSeconds - vm.elapsed)))", "eye", variant: .peach,
                    dim: !vm.canReveal) { vm.reveal() }
        }
    }

    private var header: some View {
        VStack(spacing: 3) {
            Text("SPYGLASS").font(Brand.font(24, .black)).foregroundStyle(spyglassAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.wordsearch)
            Text(vm.state.title).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                Text("\(vm.state.found.count)/\(vm.state.words.count) found").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                Text("\(vm.state.misses) miss\(vm.state.misses == 1 ? "" : "es")").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
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
    }

    /// The word list as chips: struck through when found, accent-ringed when hinted.
    private var wordChips: some View {
        let s = vm.state
        return FlowChips(items: s.words.map(\.w)) { w in
            let found = s.found.contains(w), hinted = s.hinted.contains(w) && !found
            // Hidden until found or shown: the word's length as dots (founder, 2026-09-26).
            let visible = found || s.wordsShown || s.status != .playing
            // §J3: a found word is a glossy capsule in the accent with a soft glow;
            // the rest are tinted pills (hinted ones ringed in the accent).
            Text(visible ? w : String(repeating: "•", count: w.count)).font(Brand.font(14, found ? .black : .bold))
                .tracking(visible ? 0 : 2)
                .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                .accessibilityLabel(visible ? "\(w)\(found ? ", found" : "")" : "\(w.count)-letter word")
                .foregroundStyle(found ? Color.white : (visible ? PuzKit.ink : FinishInk.secondary))
                .shadow(color: found ? Color(hex: 0x1A2E05).opacity(0.5) : .clear, radius: 0.5, x: 0, y: 1)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background {
                    if !found {
                        Capsule().fill(PuzKit.face(spyglassAccent, 0.10))
                            .overlay(Capsule().stroke(hinted ? spyglassAccent : PuzKit.line(spyglassAccent, 0.3), lineWidth: hinted ? 1.5 : 1))
                    }
                }
                .modifier(SpyglassFoundChip(on: found))
        }
        .padding(.horizontal, 6)
    }

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let s = vm.state
        let won = s.status == .won
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? (s.guessCount == 10 ? "Clean clear" : (s.wordsShown ? "Cleared with the list" : "Grid cleared")) : "Revealed",
                                won: won)
            PuzResultLine(onShare: { share() }, won: won, items: [("\(s.found.count)/\(s.words.count)", "found"),
                                                  (puzClock(vm.elapsed), "time")],
                                points: vm.points)
        }
    }

    /// Below the dock (§R2): the full summary line, the daily rank and the breakdown.
    private var result: some View {
        let s = vm.state
        let won = s.status == .won
        let secs = vm.elapsed
        return VStack(spacing: 10) {
            Text("\(s.found.count)/\(s.words.count) found · \(formatGuessStat(semantics: "misses", guessBase: 10, guessCount: s.guessCount)) · \(timeText(secs))\(s.hintsUsed > 0 ? " · \(s.hintsUsed) hint\(s.hintsUsed == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(spyglassAccent)
            if vm.isDaily { DailyRankBadge(gameMode: .wordsearch) }
            ScoreBreakdownView(gameMode: GameMode.wordsearch.rawValue, completed: won,
                               guessCount: s.guessCount, timeSeconds: secs,
                               boardsSolved: s.found.count, totalBoards: s.words.count, hintsUsed: s.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.vertical, 12)
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.wordsearch.rawValue, surface: "post_game")
        ShareService.share(kind: .wordsearch(n: vm.state.n, words: vm.state.words, found: vm.state.found, misses: vm.state.misses,
                                             title: vm.state.title, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .wordsearch, modeLabel: "SPYGLASS", accent: spyglassAccent, won: vm.state.status == .won,
                           guesses: vm.state.guessCount, maxGuesses: 15, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}

/// A wrapping row of chips (the word list): chips flow by width and each line is
/// centered, so a long word (WOODPECKER) pushes its neighbors to the next line
/// instead of breaking mid-word. (Fixed rows of five did the latter.)
private struct FlowChips<Content: View>: View {
    let items: [String]
    @ViewBuilder let content: (String) -> Content
    var body: some View {
        WrapLayout(spacing: 8, lineSpacing: 8) { ForEach(items, id: \.self) { content($0) } }
    }
}

private struct WrapLayout: Layout {
    var spacing: CGFloat
    var lineSpacing: CGFloat

    private func lines(_ subviews: Subviews, width: CGFloat) -> [[(Int, CGSize)]] {
        var lines: [[(Int, CGSize)]] = [[]]
        var x: CGFloat = 0
        for (i, v) in subviews.enumerated() {
            let size = v.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { lines.append([]); x = 0 }
            lines[lines.count - 1].append((i, size))
            x += size.width + spacing
        }
        return lines
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 10_000
        let ls = lines(subviews, width: width)
        let height = ls.reduce(0) { $0 + ($1.map(\.1.height).max() ?? 0) } + lineSpacing * CGFloat(max(0, ls.count - 1))
        let widest = ls.map { line in line.reduce(0) { $0 + $1.1.width } + spacing * CGFloat(max(0, line.count - 1)) }.max() ?? 0
        return CGSize(width: proposal.width ?? widest, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for line in lines(subviews, width: bounds.width) {
            let lineW = line.reduce(0) { $0 + $1.1.width } + spacing * CGFloat(max(0, line.count - 1))
            let lineH = line.map(\.1.height).max() ?? 0
            var x = bounds.minX + max(0, (bounds.width - lineW) / 2)
            for (i, size) in line {
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += lineH + lineSpacing
        }
    }
}

// MARK: - Grid

/// 10 × 10 letters inside the ruled More Games frame. Found words wear an
/// accent capsule under the letters; the live selection a lighter one. Input is
/// tap-start / tap-end OR a drag — both end in one select. A hinted word's first
/// letter is ringed.
struct SpyglassGridView: View {
    @ObservedObject var vm: SpyglassVM
    let revealMissing: Bool
    /// §L: sit the letters on the shared game tray (the live game; recaps tray at
    /// their own call sites).
    var tray = false
    @State private var anchor: Int?
    @State private var hover: Int?
    @State private var pendingTap: Int?


    var body: some View {
        let s = vm.state, n = s.n
        GeometryReader { geo in
            // FINISH_SPEC §B5: the shared board-sizing rule (2% side margin, centered).
            // §L: the tray's padding (both sides) and lip come out of the budget first.
            let pad: CGFloat = tray ? GameTray.padding * 2 : 8
            let lip: CGFloat = tray ? GameTray.lip : 0
            let cell = CGFloat(BoardSizing.fitTile(widthUnits: Double(n), heightUnits: Double(n),
                                                   width: Double(geo.size.width - pad / CGFloat(BoardSizing.widthFill)),
                                                   height: Double(geo.size.height - (pad + lip) / CGFloat(BoardSizing.heightFill)),
                                                   maxTile: 120, minTile: 4))
            let side = cell * CGFloat(n)
            let chars = Array(s.grid)
            let foundCells: Set<Int> = Set(s.words.filter { s.found.contains($0.w) }.flatMap { wordsearchCells(n, $0) })
            let hintCells: Set<Int> = Set(s.words.filter { s.hinted.contains($0.w) && !s.found.contains($0.w) }.compactMap { wordsearchCells(n, $0).first })
            let preview: [Int]? = (anchor != nil && hover != nil && hover != anchor) ? wordsearchLine(n, from: anchor!, to: hover!) : nil
            let previewSet = Set(preview ?? [])
            ZStack {
                Canvas { ctx, _ in
                    func center(_ i: Int) -> CGPoint { CGPoint(x: (CGFloat(i % n) + 0.5) * cell, y: (CGFloat(i / n) + 0.5) * cell) }
                    func capsule(_ a: Int, _ b: Int, _ color: Color, dashed: Bool = false) {
                        var p = Path(); p.move(to: center(a)); p.addLine(to: center(b))
                        ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: cell * 0.72, lineCap: .round, dash: dashed ? [6, 5] : []))
                    }
                    /// §J3: a found word as a glossy capsule in the accent — a darker
                    /// lip, a light → base face, a gloss on its upper half, a soft glow.
                    func glossyCapsule(_ a: Int, _ b: Int) {
                        let p0 = center(a), p1 = center(b)
                        let len = hypot(p1.x - p0.x, p1.y - p0.y)
                        let angle = Angle(radians: Double(atan2(p1.y - p0.y, p1.x - p0.x)))
                        let w = cell * 0.78
                        let rect = CGRect(x: -w / 2, y: -w / 2, width: len + w, height: w)
                        let shape = Path(roundedRect: rect, cornerRadius: w / 2)
                        ctx.drawLayer { l in
                            l.translateBy(x: p0.x, y: p0.y + w * 0.07)
                            l.rotate(by: angle)
                            l.addFilter(.shadow(color: spyglassAccent.opacity(0.45), radius: w * 0.22))
                            l.fill(shape, with: .color(Color.black.mixed(over: spyglassAccent, 0.3)))
                        }
                        ctx.drawLayer { l in
                            l.translateBy(x: p0.x, y: p0.y)
                            l.rotate(by: angle)
                            l.fill(shape, with: .linearGradient(Gradient(colors: [Color.white.mixed(over: spyglassAccent, 0.45), spyglassAccent]),
                                                                startPoint: CGPoint(x: 0, y: -w / 2), endPoint: CGPoint(x: 0, y: w / 2)))
                            let gloss = Path(roundedRect: CGRect(x: rect.minX + w * 0.25, y: -w / 2 + w * 0.08,
                                                                  width: max(0, rect.width - w * 0.5), height: w * 0.36),
                                             cornerRadius: w * 0.18)
                            l.fill(gloss, with: .linearGradient(Gradient(colors: [Color.white.opacity(0.5), Color.white.opacity(0)]),
                                                                startPoint: CGPoint(x: 0, y: -w / 2), endPoint: CGPoint(x: 0, y: 0)))
                        }
                    }
                    for w in s.words where s.found.contains(w.w) { let c = wordsearchCells(n, w); glossyCapsule(c[0], c[c.count - 1]) }
                    if revealMissing { for w in s.words where !s.found.contains(w.w) { let c = wordsearchCells(n, w); capsule(c[0], c[c.count - 1], Color(hex: 0xDC2626).opacity(0.45), dashed: true) } }
                    if let a = anchor, let h = hover, h != a, preview != nil { capsule(a, h, spyglassAccent.opacity(0.22)) }
                }
                VStack(spacing: 0) {
                    ForEach(0..<n, id: \.self) { r in
                        HStack(spacing: 0) {
                            ForEach(0..<n, id: \.self) { c in
                                let i = r * n + c
                                // §J3: crisp letters on the tinted tray (no grid lines);
                                // a found letter reads white on its glossy capsule.
                                ZStack {
                                    if i == anchor || i == pendingTap { Circle().fill(spyglassAccent.opacity(0.24)).padding(cell * 0.08) }
                                    else if previewSet.contains(i) { Circle().fill(spyglassAccent.opacity(0.10)).padding(cell * 0.08) }
                                    if hintCells.contains(i) { Circle().stroke(Color(hex: 0xF5C542), lineWidth: 2).padding(cell * 0.08) }
                                    Text(String(chars[i])).font(Brand.font(min(20, cell * 0.5), .black))
                                        .foregroundStyle(foundCells.contains(i) ? Color.white : PuzKit.ink)
                                        .shadow(color: foundCells.contains(i) ? Color(hex: 0x1A2E05).opacity(0.5) : .clear, radius: 0.5, x: 0, y: 1)
                                }
                                .frame(width: cell, height: cell)
                            }
                        }
                    }
                }
            }
            .frame(width: side, height: side)
            .contentShape(Rectangle())
            .gesture(vm.isFinished ? nil : DragGesture(minimumDistance: 0)
                .onChanged { g in
                    let i = cellAt(g.location, cell: cell, n: n)
                    if anchor == nil { anchor = i }
                    hover = i
                }
                .onEnded { g in
                    let end = cellAt(g.location, cell: cell, n: n)
                    defer { anchor = nil; hover = nil }
                    guard let a = anchor else { return }
                    if let e = end, e != a { pendingTap = nil; vm.select(from: a, to: e); return }
                    // A tap: the second tap completes a tap-tap selection.
                    if let p = pendingTap, p != a { pendingTap = nil; vm.select(from: p, to: a) } else { pendingTap = a }
                })
            .modifier(SpyglassTrayChrome(on: tray, state: s.status == .won ? .won : (s.status == .lost ? .lost : .normal)))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 440)
        .accessibilityLabel("Spyglass grid: \(vm.state.title)")
    }

    private func cellAt(_ p: CGPoint, cell: CGFloat, n: Int) -> Int? {
        let c = Int(floor(p.x / cell)), r = Int(floor(p.y / cell))
        guard c >= 0, c < n, r >= 0, r < n else { return nil }
        return r * n + c
    }
}

/// §L: the letters on the shared game tray in play; a soft tinted panel (no dark
/// rule) in a recap.
private struct SpyglassTrayChrome: ViewModifier {
    let on: Bool
    let state: GameTrayState

    @ViewBuilder
    func body(content: Content) -> some View {
        if on {
            content.gameTray(accent: spyglassAccent, state: state)
        } else {
            let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
            content
                .padding(4)
                .background(shape.fill(PuzKit.face(spyglassAccent, 0.09)))
                .overlay(shape.strokeBorder(PuzKit.line(spyglassAccent, 0.3), lineWidth: 1.5))
        }
    }
}

/// §J3: a found word chip as a glossy capsule in the accent with a soft glow.
private struct SpyglassFoundChip: ViewModifier {
    let on: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if on {
            content.puzChip(spyglassAccent, radius: 16, lip: 3, gloss: 0.5, glow: spyglassAccent.opacity(0.4))
        } else {
            content
        }
    }
}
