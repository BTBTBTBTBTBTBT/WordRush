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

/// Tier ramp (More Games §14): one hue, four lightnesses — plus pips, never colour alone.
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
    private var guidePauseStart: Double?
    private var recorded = false
    private(set) var restoredFinished = false

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        let today = LeaderboardService.todayLocal()
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.groups.rawValue)
        let bank = GroupsBankStore.shared ?? GroupsBank(version: 1, epoch: GROUPS_DAILY_EPOCH, daily: [], extra: [])
        let fallback = GroupsPuzzle(id: "none", groups: [
            GroupsGroup(tier: 1, label: "COLOURS", words: ["RED", "BLUE", "GREEN", "GOLD"]),
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
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
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

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/groups/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: GroupsState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "groups-save-daily" : "groups-save-\(seed)" }
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

    // MARK: - Actions

    private func dispatch(_ a: GroupsAction) {
        guard !isFinished else { return }
        state = groupsReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if case .submit = a {
            switch state.lastResult {
            case .correct: Haptics.tap(); SoundManager.shared.playSuccess()
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
        SoundManager.shared.playInvalid(); Haptics.error()
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
        else { Haptics.error(); SoundManager.shared.playGameOver() }
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
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: KindredVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView {
                    VStack(spacing: 10) {
                        header
                        VStack(spacing: 6) {
                            ForEach(vm.state.solved, id: \.tier) { g in KindredGroupBar(group: g) }
                            ForEach(vm.unsolved, id: \.tier) { g in KindredGroupBar(group: g, revealed: true) }
                        }
                        .frame(maxWidth: 420)
                        result
                    }
                    .padding(.horizontal, 10)
                }
            } else {
                VStack(spacing: 8) {
                    header
                    ScrollView {
                        VStack(spacing: 8) {
                            if !vm.state.solved.isEmpty {
                                VStack(spacing: 6) {
                                    ForEach(vm.state.solved, id: \.tier) { g in KindredGroupBar(group: g) }
                                }
                            }
                            let revealed = vm.revealedLabels
                            if !revealed.isEmpty {
                                WordWrapLayout(spacing: 6, lineSpacing: 6) {
                                    ForEach(revealed, id: \.tier) { g in KindredCategoryChip(group: g) }
                                }
                            }
                            KindredTileGrid(vm: vm)
                                .modifier(ShakeEffect(animatableData: vm.shakeCount))
                            KindredMistakeDots(mistakes: vm.state.mistakes, max: GROUPS_MAX_MISTAKES)
                        }
                        .frame(maxWidth: 420)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                    }
                    VStack(spacing: 8) {
                        HStack(spacing: 8) {
                            capsule("Shuffle", "shuffle") { vm.shuffle() }
                            capsule("Deselect", "xmark.circle", dim: vm.state.selected.isEmpty) { vm.deselect() }
                            capsule("Submit", "checkmark.circle.fill", dim: vm.state.selected.count != 4, filled: true) { vm.submit() }
                        }
                        HStack(spacing: 8) {
                            capsule("Name a category", "tag") { SoundManager.shared.playKeyTap(); vm.hintLabel() }
                            capsule(vm.state.hintsUsed > 0 ? "Show a pair · \(vm.state.hintsUsed)" : "Show a pair", "link") { SoundManager.shared.playKeyTap(); vm.hintPair() }
                        }
                    }
                    .padding(.bottom, 10)
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
                // The web passes the mistake count with label "Mistakes"; a single
                // "board" here keeps the card to MISTAKES · TIME · POINTS.
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.mistakes, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISTAKES", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .groups) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .hidesBottomNav()
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

    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(kindredAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(kindredAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    /// Accent-outlined capsule; `filled` (Submit) turns solid when live; `dim` disables.
    private func capsule(_ label: String, _ symbol: String, dim: Bool = false, filled: Bool = false, action: @escaping () -> Void) -> some View {
        let live = !dim && filled
        return Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .foregroundStyle(dim ? Theme.textMuted.opacity(0.5) : live ? Color.white : kindredAccent)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(Capsule().fill(dim ? Color.clear : live ? kindredAccent : kindredAccent.opacity(0.05)))
                .overlay(Capsule().stroke(dim ? Theme.border : live ? kindredAccent : kindredAccent.opacity(0.4), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(dim)
        .accessibilityLabel(label)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("KINDRED").font(Brand.font(24, .black)).foregroundStyle(kindredAccent)
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
        .padding(.top, 6)
    }

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.guessCount
        let hints = vm.state.hintsUsed
        return VStack(spacing: 10) {
            Text(won ? (vm.state.mistakes == 0 ? "Flawless — all four groups" : "All four groups found") : "Out of mistakes")
                .font(Brand.title(20)).foregroundStyle(won ? Theme.win : Theme.lossText)
                .multilineTextAlignment(.center)
            Text("\(vm.state.solved.count)/\(GROUPS_TOTAL_BOARDS) groups · \(vm.mistakesLabel) · \(timeText(secs))\(hints > 0 ? " · \(hints) hint\(hints == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain() } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Theme.gold)
                }
            }
            .foregroundStyle(kindredAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .groups) }
            ScoreBreakdownView(gameMode: GameMode.groups.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: vm.boardsSolved, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: hints,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "GROUPS") }
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

/// 1–4 pips for the tier — the colour-independent reading of the ramp.
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
        let st = KindredTierStyle.of(group.tier)
        VStack(spacing: 2) {
            HStack(spacing: 8) {
                KindredPips(tier: group.tier, color: st.fg)
                Text(group.label).font(Brand.font(14, .black))
            }
            Text(group.words.joined(separator: ", ")).font(Brand.font(12, .bold)).tracking(0.4)
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(st.fg)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12).fill(st.bg))
        .overlay(revealed ? RoundedRectangle(cornerRadius: 12).strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [6, 4])).foregroundStyle(Color.white.opacity(0.5)) : nil)
        .opacity(revealed ? 0.85 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(revealed ? "Missed: " : "")\(group.label): \(group.words.joined(separator: ", "))")
    }
}

/// A Name-a-category hint: the label as a tier-tinted chip with its pips.
struct KindredCategoryChip: View {
    let group: GroupsGroup
    var body: some View {
        let st = KindredTierStyle.of(group.tier)
        HStack(spacing: 6) {
            KindredPips(tier: group.tier, size: 4, color: st.fg)
            Text(group.label).font(Brand.font(11, .black))
        }
        .foregroundStyle(st.fg)
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(Capsule().fill(st.bg))
        .accessibilityLabel("Category named: \(group.label)")
    }
}

/// The unsolved words as a 4-wide grid of Classic-style tiles; selected tiles
/// fill with the accent; hinted pairs wear a violet ring; long words shrink.
struct KindredTileGrid: View {
    @ObservedObject var vm: KindredVM

    var body: some View {
        let s = vm.state
        let ringed = vm.ringed
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
            ForEach(s.tiles, id: \.self) { w in
                let sel = s.selected.contains(w)
                let long = w.count > 8
                Button { vm.toggle(w) } label: {
                    Text(w).font(Brand.font(long ? 10 : 12, .black))
                        .lineLimit(1).minimumScaleFactor(0.55)
                        .foregroundStyle(sel ? Color.white : Theme.textPrimary)
                        .padding(.horizontal, 4)
                        .frame(maxWidth: .infinity).frame(height: 56)
                        .background(RoundedRectangle(cornerRadius: 8).fill(sel ? kindredAccent : Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(sel ? kindredAccent : Theme.border, lineWidth: 2))
                        .overlay(ringed.contains(w) ? RoundedRectangle(cornerRadius: 11).stroke(kindredPairRing, lineWidth: 2).padding(-3) : nil)
                }
                .buttonStyle(PressableStyle())
                .disabled(vm.isFinished)
                .accessibilityLabel(w)
                .accessibilityAddTraits(sel ? .isSelected : [])
            }
        }
        .padding(.horizontal, 2)
        .animation(Theme.animation(.easeInOut(duration: 0.25)), value: s.tiles)
        .accessibilityLabel("Words")
    }
}

/// Four dots: filled while a mistake remains.
struct KindredMistakeDots: View {
    let mistakes: Int
    let max: Int
    var body: some View {
        HStack(spacing: 6) {
            Text("Mistakes left").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            ForEach(0..<max, id: \.self) { i in
                Circle().fill(i < max - mistakes ? kindredAccent : Theme.border).frame(width: 10, height: 10)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(max - mistakes) mistakes remaining")
    }
}
