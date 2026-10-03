import SwiftUI
import WordociousCore

// Kindred (More Games §14) — the iOS twin of components/groups/*.
// Sixteen words hide four groups of four; find them all with at most four
// mistakes. Submit four → a group locks and becomes a bar with 1–4 pips for
// its tier; three from one group reads "One away"; a set already tried is
// free. Name a category (1 hint) shows the label of the easiest unsolved
// group; Show a pair (2 hints) rings two words that belong together. Neither
// costs a mistake. guess_count = submissions on a win, groups found + 4 on a loss.

private let kindredAccent = Color(hex: 0x9F1239)
/// Hinted pairs wear this ring (web PAIR_RING).
private let kindredPairRing = Color(hex: 0x8B5CF6)

/// Tier ramp (More Games §14): one hue, four lightnesses — plus pips, never color alone.
struct KindredTierStyle {
    let bg: Color
    let fg: Color
    static let ramp: [Int: KindredTierStyle] = [
        1: KindredTierStyle(bg: Color(hex: 0xDDD6FE), fg: Color(hex: 0x3B0764)),
        2: KindredTierStyle(bg: Color(hex: 0xA78BFA), fg: Color(hex: 0x1A1A2E)),
        3: KindredTierStyle(bg: Color(hex: 0x7C3AED), fg: Color(hex: 0xFFFFFF)),
        4: KindredTierStyle(bg: Color(hex: 0x1A1A2E), fg: Color(hex: 0xFFFFFF)),
    ]
    static func of(_ tier: Int) -> KindredTierStyle { ramp[tier] ?? ramp[1]! }
    /// §J3: the card / chip accent per tier (the ramp, deep enough to tint a card).
    static func cardAccent(_ tier: Int) -> Color {
        switch tier {
        case 1: return Color(hex: 0xA78BFA)
        case 2: return Color(hex: 0x8B5CF6)
        case 3: return Color(hex: 0x7C3AED)
        default: return Color(hex: 0x4C1D95)
        }
    }
}

/// The bundled bank (Resources/groups-puzzles.json — sha-guarded to match the web copy).
enum GroupsBankStore {
    static let shared: GroupsBank? = {
        guard let url = Bundle.main.url(forResource: "groups-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return GroupsBank.load(from: data)
    }()
}

@MainActor
final class KindredVM: ObservableObject {
    @Published private(set) var state: GroupsState
    @Published var toast: String?
    /// Incremented on a wrong submit — drives ShakeEffect on the grid.
    @Published private(set) var shakeCount: CGFloat = 0
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

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        let today = LeaderboardService.todayLocal()
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.groups.rawValue)
        let bank = GroupsBankStore.shared ?? GroupsBank(version: 1, epoch: GROUPS_DAILY_EPOCH, daily: [], extra: [])
        let fallback = GroupsPuzzle(id: "none", groups: [
            GroupsGroup(tier: 1, label: "COLORS", words: ["RED", "BLUE", "GREEN", "GOLD"]),
            GroupsGroup(tier: 2, label: "SHAPES", words: ["CUBE", "RING", "CONE", "ARCH"]),
            GroupsGroup(tier: 3, label: "SEASONS", words: ["SPRING", "SUMMER", "AUTUMN", "WINTER"]),
            GroupsGroup(tier: 4, label: "___LIGHT", words: ["DAY", "MOON", "SUN", "SKY"]),
        ])
        let puzzle = (seed == nil ? groupsPuzzleForDay(bank, day: today, holidays: HolidayTable.bundled) : groupsPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        holidayKey = bank.holiday?.first(where: { $0.value.contains { $0.id == puzzle.id } })?.key
        state = createGroupsState(puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { groupsDailyNumber(LeaderboardService.todayLocal()) }
    var holidayTitle: String? { HolidayTitles.title(holidayKey) }
    var guessCount: Int { groupsGuessCount(state) }
    var boardsSolved: Int { groupsBoardsSolved(state) }
    var mistakesLabel: String { "\(state.mistakes) mistake\(state.mistakes == 1 ? "" : "s")" }
    /// Revealed-category chips: hinted labels whose group is still on the board.
    var revealedLabels: [GroupsGroup] {
        state.revealedTiers.compactMap { t in state.groups.first { $0.tier == t } }.filter { g in !state.solved.contains { $0.tier == g.tier } }
    }
    /// Words a Show-a-pair hint ringed that are still on the board.
    var ringed: Set<String> { Set(state.pairs.flatMap { $0 }.filter { state.tiles.contains($0) }) }
    var unsolved: [GroupsGroup] { groupsUnsolved(state) }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.groups.rawValue, completed: state.status == .won, guessCount: guessCount,
                                   timeSeconds: elapsed, boardsSolved: boardsSolved, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
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

    // MARK: - Persistence (mirrors components/groups/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: GroupsState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "groups-save-daily" : "groups-save-\(seed)" }
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

    private func dispatch(_ a: GroupsAction) {
        guard !isFinished else { return }
        state = groupsReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if case .submit = a {
            switch state.lastResult {
            case .correct: Haptics.tap(); SoundManager.shared.playFound()
            case .oneaway: flash("One away…"); wrongSubmit()
            case .wrong: flash("Not a group"); wrongSubmit()
            case .repeat: flash("Already tried that set")
            case .short: flash("Pick four words")
            case .none: break
            }
        }
        if state.status != .playing { finish() }
        persist()
    }

    private func wrongSubmit() {
        SoundManager.shared.playInvalid(); Haptics.warning()
        withAnimation(Theme.animation(.linear(duration: 0.4))) { shakeCount += 1 }
    }

    func toggle(_ word: String) { guard !isFinished else { return }; SoundManager.shared.playKeyTap(); dispatch(.toggle(word: word)) }
    func deselect() { guard !isFinished, !state.selected.isEmpty else { return }; SoundManager.shared.playKeyTap(); dispatch(.deselect) }
    func shuffle() { guard !isFinished else { return }; Haptics.tap(); SoundManager.shared.playKeyTap(); dispatch(.shuffle) }
    func submit() { guard !isFinished else { return }; Haptics.tap(); dispatch(.submit) }
    func hintLabel() {
        guard !isFinished else { return }
        if groupsLabelTarget(state) != nil { dispatch(.hintLabel); Haptics.tap() } else { flash("Every category is already named") }
    }
    func hintPair() {
        guard !isFinished else { return }
        if groupsPairTarget(state) != nil { dispatch(.hintPair); Haptics.tap() } else { flash("Every group already has a pair shown") }
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = guessCount, used = state.hintsUsed, solved = boardsSolved
        let row = groupsMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .groups, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: solved, totalBoards: GROUPS_TOTAL_BOARDS,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .groups, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.groups.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct KindredView: View {
    @StateObject private var vm: KindredVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: KindredVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    // Band estimates for the in-play layout (see body).
    private static let railHeight: CGFloat = 20        // progress rail row
    private static let barHeight: CGFloat = 58         // one solved-group bar (label + words)
    private static let chipRowHeight: CGFloat = 26     // Name-a-category chips row
    private static let tileMin: CGFloat = 56, tileMax: CGFloat = 92

    /// tile = clamp((band − rail − bars − chips − gaps) / rows, 56, 92); each grid cell carries a
    /// 3 pt ring margin on every side, hence the −6.
    private static func tileHeight(band: CGFloat, tiles: Int, bars: Int, chips: Bool) -> CGFloat {
        let rows = CGFloat(max(1, (tiles + 3) / 4))
        // §L: the grid's tray (8-pt padding both sides + the 4-pt lip).
        var reserved = railHeight + CGFloat(bars) * (barHeight + 6) + 8 * 3 + 8 * 2 + GameTray.lip
        if chips { reserved += chipRowHeight + 8 }
        let cell = ((band - reserved) / rows).rounded(.down) - 6
        return min(tileMax, max(tileMin, cell))
    }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.groups))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the four groups
                // in the height left, the dock; the breakdown sits below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 6) { header; resultHeadline }
                } board: { size in
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 6) {
                            ForEach(vm.state.solved, id: \.tier) { g in KindredGroupBar(group: g) }
                            ForEach(vm.unsolved, id: \.tier) { g in KindredGroupBar(group: g, revealed: true) }
                        }
                        // §L: the finished groups on the tray (won purple / lost slate).
                        .gameTray(accent: kindredAccent, state: vm.state.status == .won ? .won : .lost, padding: 8)
                        .frame(maxWidth: 420)
                        .frame(maxWidth: .infinity, minHeight: size.height)
                    }
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "GROUPS", game: "Kindred", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    result
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // Board layout (founder, 2026-09-28: "the whole bottom half is empty"): the
                    // grid is the hero and scales to the band between the header and the pinned
                    // controls; solved groups stack UNDER it (the tiles never move as you solve);
                    // a progress rail (groups found · mistakes left) sits between them from the
                    // first second. Heights below are estimates so the tile can be sized before
                    // the first layout pass — same approach as Hubbub's cluster.
                    GeometryReader { geo in
                        let revealed = vm.revealedLabels
                        let tileH = Self.tileHeight(band: geo.size.height, tiles: vm.state.tiles.count, bars: vm.state.solved.count, chips: !revealed.isEmpty)
                        ScrollView {
                            VStack(spacing: 8) {
                                if !revealed.isEmpty {
                                    WordWrapLayout(spacing: 6, lineSpacing: 6) {
                                        ForEach(revealed, id: \.tier) { g in KindredCategoryChip(group: g) }
                                    }
                                }
                                // §L: the sixteen words sit on the shared game tray.
                                KindredTileGrid(vm: vm, tileHeight: tileH)
                                    .gameTray(accent: kindredAccent, padding: 8)
                                    .modifier(ShakeEffect(animatableData: vm.shakeCount))
                                KindredProgressRail(solvedTiers: Set(vm.state.solved.map { $0.tier }), mistakes: vm.state.mistakes)
                                if !vm.state.solved.isEmpty {
                                    VStack(spacing: 6) {
                                        ForEach(vm.state.solved, id: \.tier) { g in KindredGroupBar(group: g) }
                                    }
                                }
                            }
                            .frame(maxWidth: 420)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                        }
                        .frame(width: geo.size.width, height: geo.size.height)
                    }
                    VStack(spacing: 8) {
                        HStack(spacing: 8) {
                            capsule("Shuffle", "shuffle", variant: .teal) { vm.shuffle() }
                            capsule("Deselect", "xmark.circle", variant: .peach, dim: vm.state.selected.isEmpty) { vm.deselect() }
                            capsule("Submit", "checkmark.circle.fill", variant: .purple, dim: vm.state.selected.count != 4) { vm.submit() }
                        }
                        HStack(spacing: 8) {
                            capsule("Name a category", "tag", variant: .amber) { SoundManager.shared.playKeyTap(); vm.hintLabel() }
                            capsule(vm.state.hintsUsed > 0 ? "Show a pair · \(vm.state.hintsUsed)" : "Show a pair", "link", variant: .pink) { SoundManager.shared.playKeyTap(); vm.hintPair() }
                        }
                    }
                    .padding(.bottom, 10)
                }
                .padding(.horizontal, 10)
            }
            if let toast = vm.toast {
                // FINISH_SPEC §K1: the tinted toast pill in the event's color.
                G5Toast(text: toast, tone: G5Toast.tone(forGameMessage: toast))
                    .padding(.top, 100).frame(maxHeight: .infinity, alignment: .top)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                // The web passes the mistake count with label "Mistakes"; a single
                // "board" here keeps the card to MISTAKES · TIME · POINTS.
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.mistakes, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISTAKES", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    game: .groups,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .groups) }
        }
        .navigationBarTitleDisplayMode(.inline)
        // Hardware keys (founder, 2026-09-30): web groups-game keydown —
        // Return submits the selection, Escape deselects.
        .hardwareKeyboard(enabled: !vm.isFinished && !showOverlay) { key in
            switch key {
            case .enter: vm.submit()
            case .escape: vm.deselect()
            default: return false
            }
            return true
        }
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.groups))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("GROUPS")
        .swipeToGoBack { dismiss() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .animation(Theme.animation(.easeInOut(duration: 0.25)), value: vm.state.solved.count)
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

    /// §A8: small candy pills (purple Submit, teal Shuffle, peach Deselect, amber
    /// category hint, pink pair hint); `dim` disables (the candy fades).
    private func capsule(_ label: String, _ symbol: String, variant: CandyButtonStyle.Variant, dim: Bool = false,
                         action: @escaping () -> Void) -> some View {
        PuzCandyAction(title: label, symbol: symbol, variant: variant, action: action)
            .disabled(dim)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("KINDRED").font(Brand.font(24, .black)).foregroundStyle(kindredAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.groups)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                if let holiday = vm.holidayTitle { Text(holiday).font(Brand.caption(12)).foregroundStyle(kindredAccent) }
                Text("\(vm.state.solved.count)/\(GROUPS_TOTAL_BOARDS) groups").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                Text(vm.mistakesLabel).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
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
        }
    }

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.state.status == .won
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? (vm.state.mistakes == 0 ? "Flawless — all four groups" : "All four groups found") : "Out of mistakes",
                                won: won)
            PuzResultLine(won: won, items: [("\(vm.state.mistakes)", vm.state.mistakes == 1 ? "mistake" : "mistakes"),
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
            Text("\(vm.state.solved.count)/\(GROUPS_TOTAL_BOARDS) groups · \(vm.mistakesLabel) · \(timeText(secs))\(hints > 0 ? " · \(hints) hint\(hints == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .tintedPill(kindredAccent)
            if vm.isDaily { DailyRankBadge(gameMode: .groups) }
            ScoreBreakdownView(gameMode: GameMode.groups.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: vm.boardsSolved, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: hints,
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
        ShareEvents.log(kind: "image", gameMode: GameMode.groups.rawValue, surface: "post_game")
        let n = vm.isDaily ? vm.dailyNumber : nil
        let won = vm.state.status == .won
        let caption = "Wordocious Kindred\(n.map { " #\($0)" } ?? "") — Score \(vm.points) pts · Time \(timeText(vm.elapsed, clock: true)) · \(vm.state.solved.count)/\(GROUPS_TOTAL_BOARDS) groups · \(vm.mistakesLabel) · wordocious.com/kindred"
        ShareService.share(kind: .groups(solvedTiers: vm.state.solved.map { $0.tier }, mistakes: vm.state.mistakes, maxMistakes: GROUPS_MAX_MISTAKES, puzzleNumber: n),
                           mode: .groups, modeLabel: "KINDRED", accent: kindredAccent, won: won,
                           guesses: vm.guessCount, maxGuesses: 7, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: n, caption: caption)
    }
}

// MARK: - Board pieces

/// 1–4 pips for the tier — the color-independent reading of the ramp.
struct KindredPips: View {
    let tier: Int
    var size: CGFloat = 5
    var color: Color = .primary
    var body: some View {
        HStack(spacing: size * 0.8) {
            ForEach(0..<max(1, min(4, tier)), id: \.self) { _ in Circle().fill(color).frame(width: size, height: size) }
        }
        .accessibilityHidden(true)
    }
}

/// A solved (or revealed) group as a full-width bar: pips for the tier, the label, the four words.
struct KindredGroupBar: View {
    let group: GroupsGroup
    var revealed = false

    var body: some View {
        // §J3: a solved group is a tinted card in its tier color with the tier's
        // top bar (pips + label + the four words keep the color-free reading).
        let st = KindredTierStyle.of(group.tier)
        let tint = KindredTierStyle.cardAccent(group.tier)
        VStack(spacing: 2) {
            HStack(spacing: 8) {
                KindredPips(tier: group.tier, color: tint)
                Text(group.label).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
            }
            Text(group.words.joined(separator: ", ")).font(Brand.font(12, .bold)).tracking(0.4)
                .foregroundStyle(FinishInk.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12).padding(.vertical, 7)
        .tintedCard(accent: tint, bar: [st.bg, tint], radius: 12, barHeight: 6, tint: 0.16, line: 0.38)
        .overlay(revealed ? RoundedRectangle(cornerRadius: 12).strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [6, 4])).foregroundStyle(tint.opacity(0.5)) : nil)
        .opacity(revealed ? 0.8 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(revealed ? "Missed: " : "")\(group.label): \(group.words.joined(separator: ", "))")
    }
}

/// A Name-a-category hint: the label as a tier-tinted chip with its pips.
struct KindredCategoryChip: View {
    let group: GroupsGroup
    var body: some View {
        let tint = KindredTierStyle.cardAccent(group.tier)
        HStack(spacing: 6) {
            KindredPips(tier: group.tier, size: 4, color: tint)
            Text(group.label).font(Brand.font(11, .black)).foregroundStyle(FinishInk.heading)
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .tintedPill(tint)
        .accessibilityLabel("Category named: \(group.label)")
    }
}

/// The unsolved words as a 4-wide grid of Classic-style tiles; selected tiles
/// fill with the accent; hinted pairs wear a violet ring; long words shrink.
struct KindredTileGrid: View {
    @ObservedObject var vm: KindredVM
    /// Scaled by the board to fill its band (founder, 2026-09-28); 56 was the fixed height before.
    var tileHeight: CGFloat = 56

    var body: some View {
        let s = vm.state
        let ringed = vm.ringed
        let fontNormal = min(15, max(12, (tileHeight * 0.22).rounded()))
        let fontLong = min(13, max(10, (tileHeight * 0.18).rounded()))
        // Founder (2026-09-25, on build 191): the pair ring was cut off at the screen edge.
        // A lazy grid clips to its own bounds, and the ring is drawn 3 pt OUTSIDE the tile, so
        // the outer columns lost it. Every cell now carries a 3 pt transparent margin (the grid
        // gaps drop to 0 so the visible spacing stays 6) and the ring lives inside the cell.
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 4), spacing: 0) {
            ForEach(s.tiles, id: \.self) { w in
                let sel = s.selected.contains(w)
                let long = w.count > 8
                Button { Haptics.tap(); vm.toggle(w) } label: {
                    // §J3: each word is a glossy chip (tinted face, lip, gloss);
                    // selected fills with the tier ramp's purple.
                    Text(w).font(Brand.font(long ? fontLong : fontNormal, .black))
                        .lineLimit(1).minimumScaleFactor(0.55)
                        .foregroundStyle(sel ? Color.white : PuzKit.ink)
                        .shadow(color: sel ? Color(hex: 0x2E0C63).opacity(0.5) : .clear, radius: 0.5, x: 0, y: 1)
                        .padding(.horizontal, 4)
                        .frame(maxWidth: .infinity).frame(height: tileHeight - 4)
                        .puzChip(sel ? Color(hex: 0x7C3AED) : PuzKit.face(kindredAccent, 0.10),
                                 light: sel ? Color(hex: 0xA66BFF) : (Theme.isDark ? nil : Color.white.mixed(over: kindredAccent.wash(0.10), 0.6)),
                                 edge: sel ? Color(hex: 0x4C1D95) : (Theme.isDark ? Color.black.opacity(0.35) : kindredAccent.wash(0.34)),
                                 border: sel ? nil : PuzKit.line(kindredAccent, 0.28),
                                 radius: 10, lip: 4)
                        .overlay(ringed.contains(w) ? RoundedRectangle(cornerRadius: 13).stroke(kindredPairRing, lineWidth: 2).padding(-3) : nil)
                        .padding(3)
                }
                .buttonStyle(.squish)
                .disabled(vm.isFinished)
                .accessibilityLabel(w)
                .accessibilityAddTraits(sel ? .isSelected : [])
            }
        }
        .padding(.horizontal, -1)
        .animation(Theme.animation(.easeInOut(duration: 0.25)), value: s.tiles)
        .accessibilityLabel("Words")
    }
}

/// Groups found · mistakes left, on one row between the grid and the solved bars
/// (founder, 2026-09-28). The four pips wear the tier ramp: filled once that tier
/// is solved, a ring until then — so the lower band reads as progress from 0 of 4.
struct KindredProgressRail: View {
    let solvedTiers: Set<Int>
    let mistakes: Int
    var body: some View {
        HStack {
            HStack(spacing: 6) {
                Text("Groups").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                Text("\(solvedTiers.count) of \(GROUPS_TOTAL_BOARDS)").softNumber(12)
                ForEach(1...4, id: \.self) { tier in
                    let c = KindredTierStyle.of(tier).bg
                    Circle().fill(solvedTiers.contains(tier) ? c : Color.clear)
                        .overlay(Circle().stroke(c, lineWidth: 1.5))
                        .frame(width: 10, height: 10)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(solvedTiers.count) of \(GROUPS_TOTAL_BOARDS) groups found")
            Spacer(minLength: 12)
            KindredMistakeDots(mistakes: mistakes, max: GROUPS_MAX_MISTAKES)
        }
        .padding(.horizontal, 4)
    }
}

/// Four dots: filled while a mistake remains.
struct KindredMistakeDots: View {
    let mistakes: Int
    let max: Int
    var body: some View {
        HStack(spacing: 6) {
            Text("Mistakes left").font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            ForEach(0..<max, id: \.self) { i in
                Circle().fill(i < max - mistakes ? kindredAccent : PuzKit.face(kindredAccent, 0.22)).frame(width: 10, height: 10)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(max - mistakes) mistakes remaining")
    }
}
