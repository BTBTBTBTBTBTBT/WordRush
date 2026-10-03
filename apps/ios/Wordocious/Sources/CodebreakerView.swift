import SwiftUI
import WordociousCore

// Codebreaker (More Games §16) — the iOS twin of components/cryptogram/*.
// Decode a saying written in a substitution cipher. Three letters are given.
// Letters are pencil — set, change and clear freely. Check (counts,
// guess_count = min(checks,3)+1) locks right letters and clears wrong ones;
// Hint reveals the most frequent unresolved letter; Reveal (after 5:00) shows
// the answer and records a loss. The puzzle completes itself the moment every
// letter is right.

private let codebreakerAccent = Color(hex: 0x92400E)
private let codebreakerHint = Color(hex: 0x8B5CF6)
private let codebreakerWrong = Color(hex: 0xDC2626)

/// The bundled bank (Resources/cryptogram-puzzles.json — sha-guarded to match the web copy).
enum CryptogramBankStore {
    static let shared: CryptogramBank? = {
        guard let url = Bundle.main.url(forResource: "cryptogram-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return CryptogramBank.load(from: data)
    }()
}

/// Holiday key → display name (apps/web/lib/holidays.ts parity, More Games §20).
enum HolidayTitles {
    static let titles: [String: String] = [
        "newyear": "New Year", "mlkday": "MLK Day", "groundhog": "Groundhog Day", "valentines": "Valentine's Day", "presidents": "Presidents' Day",
        "leapday": "Leap Day", "mardigras": "Mardi Gras", "stpatricks": "St Patrick's Day", "aprilfools": "April Fools", "easter": "Easter",
        "earthday": "Earth Day", "cincodemayo": "Cinco de Mayo", "mothersday": "Mother's Day", "memorial": "Memorial Day", "fathersday": "Father's Day",
        "juneteenth": "Juneteenth", "july4": "Fourth of July", "labor": "Labor Day", "indigenous": "Harvest Moon", "halloween": "Halloween",
        "veterans": "Veterans Day", "thanksgiving": "Thanksgiving", "christmas": "Christmas", "kwanzaa": "Kwanzaa", "lunarnewyear": "Lunar New Year",
        "passover": "Passover", "diwali": "Diwali", "hanukkah": "Hanukkah",
    ]
    static func title(_ key: String?) -> String? { key.flatMap { titles[$0] } }
}

@MainActor
final class CodebreakerVM: ObservableObject {
    @Published private(set) var state: CryptogramState
    @Published var selected: String?
    @Published var toast: String?
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
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.cryptogram.rawValue)
        let bank = CryptogramBankStore.shared ?? CryptogramBank(version: 1, epoch: CRYPTOGRAM_DAILY_EPOCH, daily: [], extra: [])
        let fallback = CryptogramPuzzle(id: "none", text: "Keep going.", key: "BCDEFGHIJKLMNOPQRSTUVWXYZA", given: ["E"])
        let puzzle = (seed == nil ? cryptogramPuzzleForDay(bank, day: today, holidays: HolidayTable.bundled) : cryptogramPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        holidayKey = bank.holiday?.first(where: { $0.value.contains { $0.id == puzzle.id } })?.key
        state = CryptogramState(puzzle: puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
        selected = nextOpen(state, after: nil)
    }
    /// Read-only: a finished board rebuilt from a matches row (the Completed-today dropdown). Never saves or records.
    init(display s: CryptogramState) {
        isDaily = true; seed = s.seed; holidayKey = nil; state = s; finalTimeSeconds = 0; recorded = true; restoredFinished = true
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }
    var dailyNumber: Int { cryptogramDailyNumber(LeaderboardService.todayLocal()) }
    var holidayTitle: String? { HolidayTitles.title(holidayKey) }
    var guessCount: Int { cryptogramGuessCount(state.checks) }
    var revealIn: Int { max(0, CRYPTOGRAM_REVEAL_AFTER_SECONDS - elapsed) }
    var codes: [String] { cryptogramCodeLetters(state.cipher) }
    var resolved: Int { codes.filter { state.locked.contains($0) || state.mapping[$0] != nil }.count }
    /// Plain letters already settled (given, checked-correct, hinted) — their keys fill in the accent.
    var usedPlain: Set<String> { Set(state.locked.compactMap { state.mapping[$0] }) }
    var conflicts: [String] { cryptogramConflicts(state.mapping) }
    var checksLabel: String { state.checks == 0 ? "No checks" : "\(state.checks) check\(state.checks == 1 ? "" : "s")" }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.cryptogram.rawValue, completed: state.status == .won, guessCount: guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.status == .won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
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

    // MARK: - Persistence (mirrors components/cryptogram/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: CryptogramState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "cryptogram-save-daily" : "cryptogram-save-\(seed)" }
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

    // MARK: - Selection

    /// Reading-order code letters that are not yet resolved (unmapped, or mapped but not locked).
    private func nextOpen(_ s: CryptogramState, after: String?) -> String? {
        var order: [String] = []
        for ch in s.cipher { let c = String(ch); if CRYPTOGRAM_ALPHABET.contains(c), !order.contains(c) { order.append(c) } }
        let open = order.filter { !s.locked.contains($0) && s.mapping[$0] == nil }
        if open.isEmpty {
            let any = order.filter { !s.locked.contains($0) }
            return any.first(where: { $0 != after }) ?? any.first
        }
        let i = after.flatMap { order.firstIndex(of: $0) } ?? -1
        return open.first(where: { (order.firstIndex(of: $0) ?? -1) > i }) ?? open.first
    }

    func select(_ code: String) { guard !isFinished else { return }; selected = code }
    func advance() { guard !isFinished else { return }; selected = nextOpen(state, after: selected) }
    /// ← / → on a hardware keyboard (web cryptogram-game, 14914522): step
    /// through every unlocked code letter in reading order, filled or not,
    /// wrapping at both ends. Return / Tab still jump to the next OPEN letter.
    func step(_ delta: Int) {
        guard !isFinished else { return }
        var order: [String] = []
        for ch in state.cipher {
            let c = String(ch)
            if CRYPTOGRAM_ALPHABET.contains(c), !order.contains(c), !state.locked.contains(c) { order.append(c) }
        }
        guard !order.isEmpty else { return }
        guard let sel = selected, let i = order.firstIndex(of: sel) else {
            selected = delta > 0 ? order.first : order.last; return
        }
        selected = order[(i + delta + order.count) % order.count]
    }

    // MARK: - Actions

    private func dispatch(_ a: CryptogramAction) {
        guard !isFinished else { return }
        state = cryptogramReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if case .check = a {
            let n = state.lastWrong.count
            if n > 0 { flash("\(n) wrong letter\(n == 1 ? "" : "s") cleared"); Haptics.warning(); SoundManager.shared.playInvalid() }
            else { flash("Everything penciled is right"); SoundManager.shared.playFound() }
            Task { try? await Task.sleep(nanoseconds: 700_000_000); if !state.lastWrong.isEmpty { state.lastWrong = [] } }
        }
        if state.status != .playing { finish() }
        persist()
    }

    func setLetter(_ plain: String) {
        guard !isFinished, let code = selected else { return }
        if state.locked.contains(code) { flash("That letter is locked"); return }
        dispatch(.set(code: code, plain: plain.uppercased()))
        SoundManager.shared.playKeyTap()
        selected = nextOpen(state, after: code)
    }
    func clearLetter() {
        guard !isFinished, let code = selected else { return }
        if state.locked.contains(code) { flash("That letter is locked"); return }
        if state.mapping[code] != nil { dispatch(.set(code: code, plain: nil)) }
        SoundManager.shared.playDelete()
    }
    func check() {
        guard !isFinished else { return }
        if state.mapping.keys.contains(where: { !state.locked.contains($0) }) { dispatch(.check) } else { flash("Pencil some letters first") }
    }
    func hint() { guard !isFinished else { return }; dispatch(.hint); Haptics.tap(); if let sel = selected, state.locked.contains(sel) { selected = nextOpen(state, after: sel) } }
    func reveal() { guard !isFinished, revealIn == 0 else { return }; Haptics.error(); dispatch(.reveal) }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = guessCount, used = state.hintsUsed
        let row = cryptogramMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .cryptogram, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .cryptogram, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.cryptogram.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct CodebreakerView: View {
    @StateObject private var vm: CodebreakerVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: CodebreakerVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.cryptogram))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + result strip, the saying scaled
                // to the height left, the dock; the decoded saying card + breakdown
                // below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 4) { header; resultHeadline }
                } board: { size in
                    let trayW = GameTray.padding * 2, trayH = GameTray.padding * 2 + GameTray.lip
                    let cell = CodebreakerSizing.cell(for: vm.state.cipher, width: size.width - 12 - trayW,
                                                      height: size.height - 8 - trayH, withStrip: false)
                    // A saying too long even at the floor size scrolls inside its area.
                    ScrollView(showsIndicators: false) {
                        CipherBoardView(vm: vm, finished: true, cell: cell, tray: true)
                            .padding(.horizontal, 6)
                            .frame(maxWidth: .infinity, minHeight: size.height)
                    }
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "CRYPTOGRAM", game: "Codebreaker", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() }, onShare: { _ in share() })
                } extras: {
                    VStack(spacing: 10) {
                        // §A1: the decoded saying on a tinted card.
                        Text("“\(vm.state.text)”").font(Brand.font(16, .heavy)).foregroundStyle(FinishInk.heading)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 14).padding(.vertical, 12)
                            .frame(maxWidth: .infinity)
                            .tintedCard(accent: codebreakerAccent, bar: [Color(hex: 0xF59E0B), codebreakerAccent], radius: 16, barHeight: 6)
                            .frame(maxWidth: 420).padding(.horizontal, 12)
                        result
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // Layout rule (founder, 2026-09-24, §16): the board and the
                    // frequency strip are ONE block centered in the band between
                    // the header and the capsule row; the cell scales to the band
                    // (64 pt down to 40 pt) so the cipher's wrapped lines plus the
                    // strip fit. The ScrollView only ever scrolls if a saying
                    // still overflows at the floor.
                    // Founder, 2026-09-26 (a long saying): the frequency strip must ALWAYS
                    // show over the keyboard and the board must never need a scroll. The
                    // strip is pinned below the band (outside the ScrollView); the board
                    // alone fills the band, shrinking as far as 26 pt so every saying fits.
                    GeometryReader { geo in
                        // §L: the board's tray (padding both sides + the lip) comes out of the band first.
                        let trayW = GameTray.padding * 2, trayH = GameTray.padding * 2 + GameTray.lip
                        let cell = CodebreakerSizing.cell(for: vm.state.cipher, width: geo.size.width - 12 - trayW, height: geo.size.height - 8 - trayH, withStrip: false)
                        ScrollView {
                            VStack(spacing: 8) {
                                CipherBoardView(vm: vm, finished: false, cell: cell, tray: true).padding(.horizontal, 6)
                                let conflicts = vm.conflicts
                                if !conflicts.isEmpty {
                                    Text("\(conflicts.joined(separator: ", ")) used for two code letters").font(Brand.font(11, .bold)).foregroundStyle(codebreakerWrong)
                                }
                            }
                            .padding(.vertical, 4)
                            .frame(maxWidth: .infinity, minHeight: geo.size.height)
                        }
                        .scrollDisabled(CodebreakerSizing.boardHeight(cipher: vm.state.cipher, cell: cell, width: geo.size.width - 12 - trayW) + 32 + trayH <= geo.size.height)
                    }
                    FrequencyStripView(vm: vm, fontSize: 12).padding(.bottom, 2)
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        // §A8: candy pills — peach Delete, purple Check, amber Hint, peach
                        // Reveal (faded until it unlocks). One row when it fits, else two.
                        let delete = capsule("Delete", nil, variant: .peach) { Haptics.tap(); vm.clearLetter() }
                        let check = capsule(vm.state.checks > 0 ? "Check · \(vm.state.checks)" : "Check", nil, variant: .purple) { Haptics.tap(); SoundManager.shared.playKeyTap(); vm.check() }
                        let hint = capsule(vm.state.hintsUsed > 0 ? "Hint · \(vm.state.hintsUsed)" : "Hint", "lightbulb", variant: .amber) { SoundManager.shared.playKeyTap(); vm.hint() }
                        let reveal = capsule(vm.revealIn > 0 ? "Reveal · \(timeText(vm.revealIn, clock: true))" : "Reveal", "eye", variant: .peach, dim: vm.revealIn > 0) { vm.reveal() }
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 6) { delete; check; hint; reveal }
                            VStack(spacing: 6) {
                                HStack(spacing: 6) { delete; check }
                                HStack(spacing: 6) { hint; reveal }
                            }
                        }
                    }
                    // Hardware keys (founder, 2026-09-30): web cryptogram-game keydown —
                    // A–Z pencils the selected code letter, Delete clears it,
                    // Return / Tab move to the next open code letter, ← → step
                    // through every unlocked letter (wrapping).
                    LetterKeyboard(onLetter: { vm.setLetter($0) }, onEnter: { vm.advance() }, onDelete: { vm.clearLetter() },
                                   keyFill: { vm.usedPlain.contains($0) ? codebreakerAccent : nil },
                                   onHardwareKey: { key in
                                       switch key {
                                       case .tab: vm.advance(); SoundManager.shared.playKeyTap()
                                       case .right: vm.step(1)
                                       case .left: vm.step(-1)
                                       default: return false
                                       }
                                       return true
                                   })
                        .padding(.bottom, 6)
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
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.checks, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "CHECKS", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    game: .cryptogram,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .cryptogram) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.cryptogram))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("CRYPTOGRAM")
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

    /// §A8: a small candy pill; `dim` disables it (the candy fades).
    private func capsule(_ label: String, _ symbol: String?, variant: CandyButtonStyle.Variant, dim: Bool = false,
                         action: @escaping () -> Void) -> some View {
        PuzCandyAction(title: label, symbol: symbol, variant: variant, action: action)
            .disabled(dim)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("CODEBREAKER").font(Brand.font(24, .black)).foregroundStyle(codebreakerAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.cryptogram)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                if let holiday = vm.holidayTitle { Text(holiday).font(Brand.caption(12)).foregroundStyle(codebreakerAccent) }
                Text("\(vm.resolved)/\(vm.codes.count) letters").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
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
        }
    }

    /// §R2: the headline + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.state.status == .won
        return VStack(spacing: 6) {
            PuzFinishedHeadline(text: won ? (vm.state.checks == 0 ? "Code cracked clean" : "Code cracked") : "Answer revealed", won: won)
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
                .tintedPill(codebreakerAccent)
            if vm.isDaily { DailyRankBadge(gameMode: .cryptogram) }
            ScoreBreakdownView(gameMode: GameMode.cryptogram.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: hints,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.vertical, 12)
    }

    /// `clock` always reads m:ss (the header and the Reveal countdown); the
    /// result line shortens under a minute to "42s" like the web formatTime.
    private func timeText(_ s: Int, clock: Bool = false) -> String {
        (clock || s >= 60) ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s"
    }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.cryptogram.rawValue, surface: "post_game")
        let n = vm.isDaily ? vm.dailyNumber : nil
        let won = vm.state.status == .won
        let caption = "Wordocious Codebreaker\(n.map { " #\($0)" } ?? "") — Score \(vm.points) pts · Time \(timeText(vm.elapsed, clock: true)) · \(won ? vm.checksLabel : "Answer revealed") · wordocious.com/codebreaker"
        ShareService.share(kind: .cryptogram(cipher: vm.state.cipher, checks: vm.state.checks, puzzleNumber: n),
                           mode: .cryptogram, modeLabel: "CODEBREAKER", accent: codebreakerAccent, won: won,
                           guesses: vm.guessCount, maxGuesses: CRYPTOGRAM_MAX_CHECKS + 1, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: n, caption: caption)
    }
}

// MARK: - Sizing (layout rule, founder 2026-09-24, §16)

/// Pure geometry for the cipher board: the cell side that lets the whole
/// saying — wrapped word by word, words never split — sit in the band between
/// the header and the capsule row together with the frequency strip. Start at
/// 64 pt and step down 4 pt at a time; floor 40 pt. The code letter under each
/// cell (10–13 pt) and the frequency chips (11–14 pt) scale with the cell.
enum CodebreakerSizing {
    static let maxCell: CGFloat = 64
    /// Floor 26 pt (was 40): a long saying must still fit the band without a scroll
    /// (founder, 2026-09-26). Fonts scale from `fontFloor`, so a 26 pt cell keeps the
    /// 10 pt code letter and 11 pt chips of the old floor instead of shrinking further.
    static let minCell: CGFloat = 26
    private static let fontFloor: CGFloat = 40
    static let step: CGFloat = 2
    /// Gap between the letters of one word (the board's HStack spacing).
    static let letterGap: CGFloat = 3
    /// Gap between wrapped lines of the board.
    static let lineGap: CGFloat = 10
    /// Gap between words on a line.
    static func wordGap(_ cell: CGFloat) -> CGFloat { cell * 0.5 }
    /// Cell height (the Classic tile geometry).
    static func cellHeight(_ cell: CGFloat) -> CGFloat { cell * 1.14 }

    /// 0 at the floor, 1 at the top end.
    private static func t(_ cell: CGFloat) -> CGFloat { min(1, max(0, (cell - fontFloor) / (maxCell - fontFloor))) }
    /// The monospace code letter under a cell: 10 pt at the floor, 13 pt at the top end.
    static func codeFont(_ cell: CGFloat) -> CGFloat { (10 + 3 * t(cell)).rounded() }
    /// The frequency chips: 11 pt at the floor, 14 pt at the top end.
    static func chipFont(_ cell: CGFloat) -> CGFloat { (11 + 3 * t(cell)).rounded() }

    /// A word's width on the board: letters are cells, punctuation is narrow text.
    static func wordWidth(_ word: String, cell: CGFloat) -> CGFloat {
        var w: CGFloat = 0
        for (i, ch) in word.enumerated() {
            if i > 0 { w += letterGap }
            w += CRYPTOGRAM_ALPHABET.contains(String(ch)) ? cell : cell * 0.4 + 2
        }
        return w
    }

    /// How many lines the cipher wraps to at `cell` in `width`. Words never split:
    /// a word that fits on the current line goes there, otherwise on the next.
    static func lineCount(cipher: String, cell: CGFloat, width: CGFloat) -> Int {
        let words = cipher.split(separator: " ").map(String.init)
        guard !words.isEmpty else { return 1 }
        var lines = 1, x: CGFloat = 0, first = true
        for word in words {
            let w = wordWidth(word, cell: cell)
            if !first && x + wordGap(cell) + w > width { lines += 1; x = 0; first = true }
            x += (first ? 0 : wordGap(cell)) + w
            first = false
        }
        return lines
    }

    /// One board row: the cell, the 2 pt gap, and the code letter's line.
    static func rowHeight(_ cell: CGFloat) -> CGFloat { cellHeight(cell) + 2 + codeFont(cell) * 1.25 }

    static func boardHeight(cipher: String, cell: CGFloat, width: CGFloat) -> CGFloat {
        let n = lineCount(cipher: cipher, cell: cell, width: width)
        return CGFloat(n) * rowHeight(cell) + CGFloat(n - 1) * lineGap
    }

    /// The frequency strip at the chip size that goes with `cell`, assuming every
    /// chip already shows its "→ A" suffix so the size never jumps as letters fill.
    static func stripHeight(cipher: String, cell: CGFloat, width: CGFloat) -> CGFloat {
        let freq = cryptogramFrequencies(cipher)
        guard !freq.isEmpty else { return 0 }
        let f = chipFont(cell)
        let chipH = f * 1.25 + 8
        let avail = width - 16
        var lines = 1, x: CGFloat = 0, first = true
        for (_, count) in freq {
            let digits = CGFloat(String(count).count)
            let w = 16 + 0.65 * f + 4 + 0.65 * f * digits + 4 + 1.4 * f
            if !first && x + 4 + w > avail { lines += 1; x = 0; first = true }
            x += (first ? 0 : 4) + w
            first = false
        }
        return CGFloat(lines) * chipH + CGFloat(lines - 1) * 4
    }

    /// The cell side for a band `width` × `height`. `height == nil` (the results
    /// page, which scrolls) gives the compact floor size. Below the floor the cell
    /// only shrinks when the longest word would not fit the width otherwise —
    /// words never break across lines and never run off the screen.
    static func cell(for cipher: String, width: CGFloat, height: CGFloat?, withStrip: Bool = true) -> CGFloat {
        var cell = height == nil ? fontFloor : maxCell
        if let height {
            // Board (+ 10 gap + strip when the strip shares the band), with room for the one-line conflict notice.
            while cell > minCell {
                let strip = withStrip ? 10 + stripHeight(cipher: cipher, cell: cell, width: width) : 0
                let block = boardHeight(cipher: cipher, cell: cell, width: width) + strip + 24
                if block <= height { break }
                cell -= step
            }
            cell = max(minCell, cell)
        }
        let longest = longestWord(cipher)
        while cell > 20, wordWidth(longest, cell: cell) > width { cell -= 2 }
        return cell
    }

    private static func longestWord(_ cipher: String) -> String {
        cipher.split(separator: " ").map(String.init).max { wordWidth($0, cell: minCell) < wordWidth($1, cell: minCell) } ?? ""
    }
}

// MARK: - Board

/// Rows of whole words: each word chunk is placed on the current line when it
/// fits, else on the next. The word chunks never break across lines.
struct WordWrapLayout: Layout {
    var spacing: CGFloat = 14
    var lineSpacing: CGFloat = 10

    private func rows(_ subviews: Subviews, width: CGFloat) -> [[Int]] {
        var rows: [[Int]] = [[]], x: CGFloat = 0
        for i in subviews.indices {
            let w = subviews[i].sizeThatFits(.unspecified).width
            if !rows[rows.count - 1].isEmpty && x + spacing + w > width { rows.append([]); x = 0 }
            x += (rows[rows.count - 1].isEmpty ? 0 : spacing) + w
            rows[rows.count - 1].append(i)
        }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rs = rows(subviews, width: width)
        var h: CGFloat = 0, maxW: CGFloat = 0
        for r in rs {
            let rowH = r.map { subviews[$0].sizeThatFits(.unspecified).height }.max() ?? 0
            let rowW = r.map { subviews[$0].sizeThatFits(.unspecified).width }.reduce(0, +) + spacing * CGFloat(max(0, r.count - 1))
            h += rowH; maxW = max(maxW, rowW)
        }
        h += lineSpacing * CGFloat(max(0, rs.count - 1))
        return CGSize(width: width.isFinite ? width : maxW, height: h)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for r in rows(subviews, width: bounds.width) {
            let sizes = r.map { subviews[$0].sizeThatFits(.unspecified) }
            let rowH = sizes.map { $0.height }.max() ?? 0
            let rowW = sizes.map { $0.width }.reduce(0, +) + spacing * CGFloat(max(0, r.count - 1))
            var x = bounds.minX + (bounds.width - rowW) / 2
            for (k, i) in r.enumerated() {
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sizes[k]))
                x += sizes[k].width + spacing
            }
            y += rowH + lineSpacing
        }
    }
}

/// One letter of the cipher (FINISH_SPEC §J3): a B1 glossy tile with the
/// penciled plain letter inside (it pops in) and the CODE letter as a small chip
/// beneath (filled in the accent while that code letter is selected).
private struct CipherTile: View {
    let plain: String
    let code: String
    var face: GlossyFace = .empty
    var hinted = false
    var selected = false
    var width: CGFloat = 28

    var body: some View {
        let h = CodebreakerSizing.cellHeight(width)
        let r = width * 0.22
        let codeSize = CodebreakerSizing.codeFont(width)
        VStack(spacing: 2) {
            GlossyTile(face: face, letter: plain, width: width, height: h, letterScale: 0.55,
                       glowAmount: hinted ? 0.85 : 0, goldRing: hinted)
                .modifier(TypePop(letter: face == .typed ? plain : "", size: CGSize(width: width, height: h)))
                .overlay(selected ? RoundedRectangle(cornerRadius: r + 3, style: .continuous).stroke(codebreakerAccent, lineWidth: 2).padding(-3) : nil)
            Text(code).font(.system(size: codeSize, weight: .heavy, design: .monospaced))
                .foregroundStyle(selected ? Color.white : (Theme.isDark ? Theme.textSecondary : codebreakerAccent))
                .frame(minWidth: max(codeSize * 1.3, width * 0.62), minHeight: codeSize * 1.25)
                .background(Capsule().fill(selected ? codebreakerAccent : PuzKit.face(codebreakerAccent, 0.14)))
                .overlay(Capsule().strokeBorder(selected ? codebreakerAccent : PuzKit.line(codebreakerAccent, 0.3), lineWidth: 0.75))
        }
    }
}

/// The saying as the player sees it: words never break across lines; the three
/// given letters are filled in the accent and locked; hinted letters violet;
/// Check-locked letters an accent tint; a plain letter used for two code
/// letters reads red; the code letters a Check just cleared flash red. Tapping
/// any cell selects its code letter everywhere.
struct CipherBoardView: View {
    @ObservedObject var vm: CodebreakerVM
    let finished: Bool
    /// Cell side from `CodebreakerSizing.cell(for:width:height:)`.
    let cell: CGFloat
    /// §L: sit the saying on the shared game tray (the live game; recaps tray at
    /// their own call sites). Callers size `cell` for the tray's padding.
    var tray = false

    var body: some View {
        let s = vm.state
        let conflicts = Set(vm.conflicts)
        let words = s.cipher.split(separator: " ", omittingEmptySubsequences: false).map(String.init)
        let tw = cell
        WordWrapLayout(spacing: CodebreakerSizing.wordGap(tw), lineSpacing: CodebreakerSizing.lineGap) {
            ForEach(Array(words.enumerated()), id: \.offset) { _, w in
                HStack(alignment: .top, spacing: CodebreakerSizing.letterGap) {
                    ForEach(Array(w.enumerated()), id: \.offset) { _, ch in
                        let code = String(ch)
                        if CRYPTOGRAM_ALPHABET.contains(code) {
                            tile(code, state: s, conflicts: conflicts, width: tw)
                        } else {
                            Text(code).font(Brand.font(tw * 0.6, .black)).foregroundStyle(PuzKit.ink)
                                .frame(width: tw * 0.4, height: CodebreakerSizing.cellHeight(tw)).padding(.horizontal, 1)
                        }
                    }
                }
            }
        }
        .modifier(CipherTrayChrome(on: tray, state: finished ? (s.status == .won ? .won : .lost) : .normal))
        .accessibilityLabel("Coded saying")
    }

    private func tile(_ code: String, state s: CryptogramState, conflicts: Set<String>, width: CGFloat) -> some View {
        let plain = s.mapping[code] ?? ""
        let locked = s.locked.contains(code)
        let hinted = s.hinted.contains(code)
        let isSel = vm.selected == code && !finished
        let wrong = s.lastWrong.contains(code)
        let conflict = !plain.isEmpty && conflicts.contains(plain) && !locked
        let correct = finished && plain == cryptogramPlainFor(code, key: s.key)
        // §B1 faces: a given letter the plain light tile, a hint purple with the gold
        // ring, Check-locked (and finished-right) letters purple, a conflict or a
        // just-cleared letter red, a pencil mark the typed tile, empty frosted.
        let face: GlossyFace
        if locked && hinted { face = .correct }
        else if locked && s.given.contains(plain) { face = .given }
        else if locked { face = .correct }
        else if conflict || wrong { face = .bad }
        else if correct { face = .correct }
        else { face = plain.isEmpty ? .empty : .typed }
        return Button { vm.select(code); SoundManager.shared.playKeyTap() } label: {
            CipherTile(plain: plain, code: code, face: face, hinted: locked && hinted, selected: isSel, width: width)
        }
        .buttonStyle(.squish)
        .disabled(finished)
        .accessibilityLabel("Code letter \(code)\(plain.isEmpty ? "" : ", pencilled \(plain)")\(locked ? ", locked" : "")")
    }
}

/// Code letters by how often they occur, with the penciled letter shown; tap to select.
struct FrequencyStripView: View {
    @ObservedObject var vm: CodebreakerVM
    /// Chip type size — scales with the board cell (11 pt at the floor, 14 pt at the top end).
    var fontSize: CGFloat = 11

    var body: some View {
        let s = vm.state
        let freq = cryptogramFrequencies(s.cipher)
        let codes = freq.keys.sorted { (freq[$0] ?? 0) != (freq[$1] ?? 0) ? (freq[$0] ?? 0) > (freq[$1] ?? 0) : $0 < $1 }
        WordWrapLayout(spacing: 4, lineSpacing: 4) {
            ForEach(codes, id: \.self) { c in
                let plain = s.mapping[c]
                let locked = s.locked.contains(c)
                let isSel = vm.selected == c
                Button { vm.select(c) } label: {
                    HStack(spacing: 4) {
                        Text(c).font(.system(size: fontSize, weight: .bold, design: .monospaced))
                        Text("\(freq[c] ?? 0)").font(Brand.font(fontSize, .bold)).opacity(0.7)
                        if let plain { Text("→\(plain)").font(Brand.font(fontSize, .black)).foregroundStyle(locked ? codebreakerAccent : PuzKit.ink) }
                    }
                    .foregroundStyle(locked ? codebreakerAccent : FinishInk.secondary)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    // §A1: tinted chips; the selected one the stronger tint + accent ring.
                    .background(Capsule().fill(PuzKit.face(codebreakerAccent, isSel ? 0.22 : 0.09)))
                    .overlay(Capsule().stroke(isSel ? codebreakerAccent : PuzKit.line(codebreakerAccent, 0.28), lineWidth: isSel ? 1.5 : 1))
                }
                .buttonStyle(.squish)
                .accessibilityLabel("Code letter \(c), \(freq[c] ?? 0) times\(plain.map { ", pencilled \($0)" } ?? "")")
            }
        }
        .padding(.horizontal, 8)
        .accessibilityLabel("Letter frequencies")
    }
}

/// §L: the saying on the shared game tray (opt-in).
private struct CipherTrayChrome: ViewModifier {
    let on: Bool
    let state: GameTrayState

    @ViewBuilder
    func body(content: Content) -> some View {
        if on { content.gameTray(accent: codebreakerAccent, state: state) } else { content }
    }
}
