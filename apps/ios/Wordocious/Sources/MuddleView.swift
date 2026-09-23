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
/// Placed tiles purple, pinned/revealed tiles violet; the punchline row in the lilac tint.
private let mdPurple = Color(hex: 0x7C3AED), mdHint = Color(hex: 0x8B5CF6)
private let mdLilac = Color(hex: 0xF5F3FF), mdLilacBorder = Color(hex: 0xC4B5FD), mdLilacText = Color(hex: 0x5B21B6)
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
    private var guidePauseStart: Double?
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

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
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

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/scramble/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: ScrambleState; let elapsed: Int; let savedAt: Double }
    private static func storageKey(isDaily: Bool, seed: String) -> String { isDaily ? "scramble-save-daily" : "scramble-save-\(seed)" }
    private var storageKey: String { Self.storageKey(isDaily: isDaily, seed: seed) }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000

    private func persist() {
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
                Haptics.error(); SoundManager.shared.playInvalid()
                withAnimation(Theme.animation(.linear(duration: 0.4))) { shakes[judged] += 1 }
            case .correct:
                SoundManager.shared.playSuccess(); Haptics.tap()
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
    func revealLetter(_ r: Int) { guard !isFinished else { return }; Haptics.tap(); dispatch(.revealLetter(row: r)) }
    func solveWord(_ r: Int) { guard !isFinished else { return }; Haptics.tap(); dispatch(.solveWord(row: r)) }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.error(); SoundManager.shared.playGameOver() }
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
// The whole puzzle sits on one 390 × 844 screen with the keyboard pinned at the
// bottom. Everything below the cartoon is fixed-height; the cartoon takes what
// is left (capped at 26 % of the screen) and, on a phone too short for even the
// floor, ONLY the cartoon + caption area scrolls — never the words or the keys.
private enum MdSize {
    /// Answer boxes on the six-column grid (rule 36–40; the low end buys the cartoon room).
    static let tile: CGFloat = 36
    static let tileGap: CGFloat = 6
    /// Scrambled letters (rule 16–17 pt bold, light tracking).
    static let scrambleFont: CGFloat = 17
    static let scrambleTracking: CGFloat = 0.8
    /// Letter · Solve icon-only circles (rule 28–30) inside a 44 pt hit frame.
    static let hintButton: CGFloat = 30
    static let hitTarget: CGFloat = 44
    /// Punchline tiles (rule ≈ 32) — shrink toward the floor to keep a long punchline on one line.
    static let punchTile: CGFloat = 32
    static let punchTileFloor: CGFloat = 26
    static let punchGap: CGFloat = 6
    static let punchWordGap: CGFloat = 12
    /// Between words, and between the stacked sections.
    static let wordGap: CGFloat = 8
    static let gap: CGFloat = 4
    /// Cartoon: 4:3, at most this share of the screen height; below the floor the top area scrolls instead.
    static let cartoonCap: CGFloat = 0.26
    static let cartoonFloor: CGFloat = 96
    static let captionFont: CGFloat = 14.5
    /// Delete · Clear capsules.
    static let capsuleHeight: CGFloat = 30
    /// Horizontal padding of the play column and of a word block.
    static let columnPad: CGFloat = 10
    static let rowPad: CGFloat = 6
}

/// The measured caption height (1–2 lines) so the cartoon can take exactly what is left.
private struct MdHeightKey: PreferenceKey {
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
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false
    /// Measured caption height (two 14.5 pt lines until the first layout reports).
    @State private var captionHeight: CGFloat = 36

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: MuddleVM(seed: seed))
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
                        board(finished: true)
                        result
                    }
                    .padding(.horizontal, MdSize.columnPad)
                }
            } else {
                playing
            }
            if let toast = vm.toast {
                Text(toast).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.horizontal, 24)
                    .padding(.top, 100).frame(maxHeight: .infinity, alignment: .top)
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
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .scramble) }
        }
        .navigationBarTitleDisplayMode(.inline)
        // No bar items live up there (the corner buttons are overlays); hiding the
        // empty bar hands its height back to the puzzle.
        .toolbar(.hidden, for: .navigationBar)
        .onPreferenceChange(MdHeightKey.self) { h in if h > 0, abs(h - captionHeight) > 0.5 { captionHeight = h } }
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .hidesBottomNav()
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

    /// The one-screen play layout: header, the flexible cartoon + caption area,
    /// then the fixed stack — four words, the punchline, Delete · Clear, keys.
    private var playing: some View {
        VStack(spacing: MdSize.gap) {
            header
            GeometryReader { geo in
                topArea(available: geo.size.height)
            }
            VStack(spacing: MdSize.wordGap) {
                ForEach(0..<SCRAMBLE_WORDS, id: \.self) { i in
                    MuddleWordRow(vm: vm, row: i, finished: false)
                        .modifier(ShakeEffect(animatableData: vm.shakes[i]))
                }
            }
            .frame(maxWidth: 420)
            MuddleFinalRow(vm: vm, finished: false)
                .modifier(ShakeEffect(animatableData: vm.shakes[SCRAMBLE_FINAL]))
                .frame(maxWidth: 420)
            HStack(spacing: 8) {
                capsule("Delete", "delete.left") { SoundManager.shared.playKeyTap(); vm.deleteLetter() }
                capsule("Clear", "xmark.circle") { SoundManager.shared.playKeyTap(); vm.clearRow() }
            }
            .padding(.top, 2)
            LetterKeyboard(onLetter: { vm.typeLetter($0) }, onEnter: { vm.nextRow() }, onDelete: { vm.deleteLetter() })
                .padding(.bottom, 4)
        }
        .padding(.horizontal, MdSize.columnPad)
        // If a phone is too short for even the cartoon floor, the overflow goes
        // off the TOP behind the header — the keys stay pinned.
        .frame(maxHeight: .infinity, alignment: .bottom)
    }

    /// The cartoon at the height that is left (capped at 26 % of the screen),
    /// centred, with the caption beneath. Scrolls only when the floor does not fit.
    private func topArea(available: CGFloat) -> some View {
        let cap = floor(UIScreen.main.bounds.height * MdSize.cartoonCap)
        let fit = available - captionHeight - MdSize.gap
        let h = max(MdSize.cartoonFloor, min(cap, fit))
        return ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: MdSize.gap) {
                MuddleCartoonPanel(cartoon: vm.puzzle.cartoon, altText: vm.puzzle.altText)
                    .frame(height: h)
                caption(finished: false)
            }
            .frame(maxWidth: .infinity, minHeight: max(0, available))
        }
        .modifier(MdNoBounceIfFits())
    }

    /// The finished-state column (scrolls with the results beneath): cartoon at
    /// its cap, caption, the four words, divider, punchline.
    private func board(finished: Bool) -> some View {
        VStack(spacing: MdSize.wordGap) {
            MuddleCartoonPanel(cartoon: vm.puzzle.cartoon, altText: vm.puzzle.altText)
                .frame(height: floor(UIScreen.main.bounds.height * MdSize.cartoonCap))
            caption(finished: finished)
            VStack(spacing: MdSize.wordGap) {
                ForEach(0..<SCRAMBLE_WORDS, id: \.self) { i in
                    MuddleWordRow(vm: vm, row: i, finished: finished)
                        .modifier(ShakeEffect(animatableData: vm.shakes[i]))
                }
                MuddleFinalRow(vm: vm, finished: finished)
                    .modifier(ShakeEffect(animatableData: vm.shakes[SCRAMBLE_FINAL]))
            }
        }
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
    }

    /// The caption with the blank as an accent underline — the punchline fills it
    /// in lowercase purple once solved. At most two lines; its height is reported
    /// up so the cartoon can take exactly what remains.
    private func caption(finished: Bool) -> some View {
        let parts = vm.state.caption.components(separatedBy: "____")
        let solved = finished || vm.state.solved[SCRAMBLE_FINAL]
        let blank = solved ? " \(vm.state.final.answer.lowercased()) " : String(repeating: "\u{00A0}", count: 8)
        return (Text(parts.first ?? "")
                + Text(blank).foregroundColor(mdLilacText).underline(true, color: muddleAccent)
                + Text(parts.count > 1 ? parts[1...].joined(separator: "____") : ""))
            .font(Brand.font(MdSize.captionFont, .heavy)).foregroundStyle(Theme.textPrimary)
            .multilineTextAlignment(.center)
            .lineLimit(2).minimumScaleFactor(0.8)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
            .background(GeometryReader { g in Color.clear.preference(key: MdHeightKey.self, value: g.size.height) })
            .accessibilityLabel(solved ? vm.state.caption.replacingOccurrences(of: "____", with: vm.state.final.answer.lowercased()) : vm.state.caption.replacingOccurrences(of: "____", with: "blank"))
    }

    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(muddleAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(muddleAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    /// Accent-outlined 30 pt capsule (the web's Delete · Clear controls); the hit
    /// shape is grown to 44 pt around the visible pill.
    private func capsule(_ label: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(12, .heavy))
                .foregroundStyle(muddleAccent)
                .padding(.horizontal, 14)
                .frame(height: MdSize.capsuleHeight)
                .background(Capsule().fill(muddleAccent.opacity(0.05)))
                .overlay(Capsule().stroke(muddleAccent.opacity(0.4), lineWidth: 1.5))
                .contentShape(Rectangle().inset(by: -(MdSize.hitTarget - MdSize.capsuleHeight) / 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// Title plus ONE meta line, tight.
    private var header: some View {
        VStack(spacing: 1) {
            Text("MUDDLE").font(Brand.font(20, .black)).foregroundStyle(muddleAccent)
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
        }
        .padding(.top, 2)
        .padding(.horizontal, 44)
    }

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.guessCount
        let hints = vm.state.hintsUsed
        return VStack(spacing: 10) {
            Text(won ? (vm.state.checks == 5 && hints == 0 ? "Muddle solved clean" : "Muddle solved") : "Out of checks")
                .font(Brand.title(20)).foregroundStyle(won ? Theme.win : Theme.lossText)
                .multilineTextAlignment(.center)
            Text("\(vm.boardsSolved)/\(SCRAMBLE_TOTAL_BOARDS) solved · \(vm.checksLabel) · \(timeText(secs))\(hints > 0 ? " · \(hints) hint\(hints == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain() } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Theme.gold)
                }
            }
            .foregroundStyle(muddleAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .scramble) }
            ScoreBreakdownView(gameMode: GameMode.scramble.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: vm.boardsSolved, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: hints,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "SCRAMBLE") }
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

/// The cartoon panel (More Games §5/§8): a standard card in the cream paper
/// tone at 4:3. The puzzle's image when the founder's batch has produced one;
/// until then the placeholder sketch. The caption is ALWAYS typeset by the app
/// beneath the panel, never drawn into the picture. The caller sets the height;
/// the 4:3 fit centres it horizontally.
struct MuddleCartoonPanel: View {
    let cartoon: String?
    let altText: String

    var body: some View {
        ZStack {
            mdPaper
            if let cartoon, let url = URL(string: "https://wordocious.com/muddle/\(cartoon)") {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() } else { placeholder }
                }
            } else {
                placeholder
            }
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .frame(maxWidth: .infinity)
        .accessibilityLabel(altText)
    }

    /// The web's placeholder SVG (a 400 × 300 viewBox) drawn to scale.
    private var placeholder: some View {
        Canvas { ctx, size in
            let sx = size.width / 400, sy = size.height / 300
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * sx, y: y * sy) }
            let ink = Color(hex: 0x1A1A2E)
            let stroke = StrokeStyle(lineWidth: 3 * min(sx, sy), lineCap: .round, lineJoin: .round)
            // Dashed frame
            var frame = Path()
            frame.addRoundedRect(in: CGRect(x: 34 * sx, y: 30 * sy, width: 332 * sx, height: 240 * sy), cornerSize: CGSize(width: 18 * sx, height: 18 * sy))
            ctx.stroke(frame, with: .color(ink.opacity(0.35)), style: StrokeStyle(lineWidth: 3 * min(sx, sy), lineCap: .round, dash: [10 * sx, 8 * sx]))
            // Smile arc
            var arc = Path()
            arc.move(to: pt(120, 215)); arc.addQuadCurve(to: pt(280, 215), control: pt(200, 120))
            ctx.stroke(arc, with: .color(ink), style: stroke)
            // Face
            ctx.stroke(Path(ellipseIn: CGRect(x: 166 * sx, y: 96 * sy, width: 68 * sx, height: 68 * sy)), with: .color(ink), style: stroke)
            var eyes = Path()
            eyes.move(to: pt(186, 124)); eyes.addQuadCurve(to: pt(198, 124), control: pt(192, 116))
            eyes.move(to: pt(202, 124)); eyes.addQuadCurve(to: pt(214, 124), control: pt(208, 116))
            ctx.stroke(eyes, with: .color(ink), style: stroke)
            var mouth = Path()
            mouth.move(to: pt(188, 146)); mouth.addQuadCurve(to: pt(212, 146), control: pt(200, 158))
            ctx.stroke(mouth, with: .color(ink), style: stroke)
            // Accent dots
            ctx.fill(Path(ellipseIn: CGRect(x: 286 * sx, y: 76 * sy, width: 28 * sx, height: 28 * sy)), with: .color(muddleAccent.opacity(0.9)))
            ctx.fill(Path(ellipseIn: CGRect(x: 91 * sx, y: 81 * sy, width: 18 * sx, height: 18 * sy)), with: .color(mdPurple.opacity(0.9)))
            ctx.draw(Text("Cartoon panel — art batch pending").font(Brand.font(14 * min(sx, sy), .heavy)).foregroundColor(Color(hex: 0x6B7280)),
                     at: pt(200, 258))
        }
        .accessibilityHidden(true)
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
    min(UIScreen.main.bounds.width, 420) - 2 * MdSize.columnPad - 2 * MdSize.rowPad - MdSize.gap - 2 * MdSize.hitTarget
}

/// The tile side on the fixed six-column grid: 36 pt, or less only on a phone
/// narrower than the grid plus the hint buttons.
private func muddleTileSide() -> CGFloat {
    min(MdSize.tile, floor((muddleColumnWidth() - MdSize.tileGap * CGFloat(mdCols - 1)) / CGFloat(mdCols)))
}

/// One answer box: a placed letter is a purple tile with white ink (violet when
/// pinned by a hint); a circled position is a ring ≈ 60 % of the tile drawn
/// INSIDE the box — white on a filled tile, purple on an empty one — never an
/// outline around the tile. Letters ≥ 17 pt (half the tile) and Dynamic Type still scales them.
private struct MuddleTile: View {
    let letter: String
    let filled: Bool
    let pinned: Bool
    let ring: Bool
    let side: CGFloat

    var body: some View {
        let bg = filled ? (pinned ? mdHint : mdPurple) : Theme.surface
        let border = filled ? bg : Theme.border
        ZStack {
            RoundedRectangle(cornerRadius: 7).fill(bg)
            RoundedRectangle(cornerRadius: 7).strokeBorder(border, lineWidth: 1.5)
            Text(letter).font(Brand.font(max(17, side * 0.5), .black)).foregroundStyle(filled ? Color.white : Theme.textPrimary)
            if ring {
                Circle().stroke(filled ? Color.white : mdPurple, lineWidth: 2).padding(side * 0.2).opacity(0.9)
            }
        }
        .frame(width: side, height: side)
        .accessibilityLabel("\(letter.isEmpty ? "empty" : letter)\(ring ? ", circled" : "")")
    }
}

/// Letter · Solve as a 28–30 pt icon-only accent circle inside a 44 pt hit
/// frame. The label is the accessibility label ("Reveal a letter" / "Solve this word").
private func hintButton(_ label: String, _ symbol: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: symbol).font(.system(size: 14, weight: .bold))
            .foregroundStyle(muddleAccent)
            .frame(width: MdSize.hintButton, height: MdSize.hintButton)
            .background(Circle().fill(muddleAccent.opacity(0.06)))
            .overlay(Circle().stroke(muddleAccent.opacity(0.45), lineWidth: 1.5))
            .frame(width: MdSize.hitTarget, height: MdSize.hitTarget)
            .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
}

/// A tappable tray letter (scrambled or circled): the glyph sits in a short
/// line, the hit shape is grown to ≈ 44 pt around it.
private func trayLetter(_ letter: Character, size: CGFloat, color: Color, dimmed: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Text(String(letter)).font(Brand.font(size, .bold)).tracking(MdSize.scrambleTracking)
            .foregroundStyle(color)
            .opacity(dimmed ? 0.25 : 1)
            .frame(minWidth: 20, minHeight: 24)
            .contentShape(Rectangle().inset(by: -10))
    }
    .buttonStyle(.plain)
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
                HStack(spacing: 6) {
                    ForEach(0..<scramble.count, id: \.self) { i in
                        trayLetter(scramble[i], size: MdSize.scrambleFont, color: Theme.textPrimary, dimmed: dimmed[i] || solved) {
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
                            MuddleTile(letter: ch, filled: !ch.isEmpty, pinned: !solved && i < revealed.count && revealed[i] != "_",
                                       ring: circled.contains(i), side: side)
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
        .padding(.horizontal, MdSize.rowPad).padding(.vertical, 2)
        .background(RoundedRectangle(cornerRadius: 10).fill(active ? mdLilac : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? mdLilacBorder.opacity(0.8) : Color.clear, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture { if !solved && !finished { vm.select(row) } }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Word \(row + 1)\(solved ? ", solved" : active ? ", active" : "")")
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
        let total = max(1, pattern.reduce(0, +))
        // One line when it fits: the column minus the single hint target at the right.
        let width = muddleColumnWidth() + MdSize.hitTarget
        let side = max(MdSize.punchTileFloor, min(MdSize.punchTile,
                       floor((width - MdSize.punchGap * CGFloat(total - pattern.count) - MdSize.punchWordGap * CGFloat(pattern.count - 1)) / CGFloat(total))))
        let starts = muddleStarts(pattern)
        HStack(alignment: .center, spacing: MdSize.gap) {
            VStack(alignment: .leading, spacing: 3) {
                Text(open || finished ? "THE PUNCHLINE" : "SOLVE THE FOUR WORDS TO UNLOCK THE PUNCHLINE")
                    .font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(Theme.textMuted)
                    .lineLimit(1).minimumScaleFactor(0.7)
                if showTray {
                    WordWrapLayout(spacing: 6, lineSpacing: 2) {
                        ForEach(0..<tray.count, id: \.self) { i in
                            trayLetter(tray[i], size: MdSize.scrambleFont, color: mdLilacText, dimmed: dimmed[i]) {
                                vm.tapTile(SCRAMBLE_FINAL, String(tray[i]))
                            }
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Circled letters")
                }
                WordWrapLayout(spacing: MdSize.punchWordGap, lineSpacing: 4) {
                    ForEach(0..<pattern.count, id: \.self) { wi in
                        HStack(spacing: MdSize.punchGap) {
                            ForEach(0..<pattern[wi], id: \.self) { k in
                                let idx = starts[wi] + k
                                let ch: String = (solved || finished) ? (idx < target.count ? String(target[idx]) : "")
                                    : (idx < entry.count ? String(entry[idx]) : "")
                                let filled = !ch.isEmpty
                                ZStack {
                                    RoundedRectangle(cornerRadius: 7).fill(filled ? mdLilac : Theme.surface)
                                    RoundedRectangle(cornerRadius: 7).strokeBorder(filled ? mdLilacBorder : Theme.border, lineWidth: 1.5)
                                    Text(ch).font(Brand.font(max(17, side * 0.55), .black)).foregroundStyle(mdLilacText)
                                    Circle().stroke(mdPurple, lineWidth: 1.5).padding(side * 0.2).opacity(filled ? 0.9 : 0.35)
                                }
                                .frame(width: side, height: side)
                                .accessibilityLabel(ch.isEmpty ? "empty" : ch)
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
        .padding(.horizontal, MdSize.rowPad).padding(.top, 8).padding(.bottom, 4)
        .background(RoundedRectangle(cornerRadius: 10).fill(active ? mdLilac.opacity(0.7) : Color.clear))
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1.5).padding(.horizontal, 4) }
        .opacity(open || finished ? 1 : 0.55)
        .contentShape(Rectangle())
        .onTapGesture { if !solved && !finished { vm.select(SCRAMBLE_FINAL) } }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Punchline\(solved ? ", solved" : open ? "" : ", locked")")
    }
}
