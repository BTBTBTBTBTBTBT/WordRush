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
    private var guidePauseStart: Double?
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

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
    var dailyNumber: Int { cryptogramDailyNumber(LeaderboardService.todayLocal()) }
    var holidayTitle: String? { HolidayTitles.title(holidayKey) }
    var guessCount: Int { cryptogramGuessCount(state.checks) }
    var revealIn: Int { max(0, CRYPTOGRAM_REVEAL_AFTER_SECONDS - elapsed) }
    var codes: [String] { cryptogramCodeLetters(state.cipher) }
    var resolved: Int { codes.filter { state.locked.contains($0) || state.mapping[$0] != nil }.count }
    var conflicts: [String] { cryptogramConflicts(state.mapping) }
    var checksLabel: String { state.checks == 0 ? "No checks" : "\(state.checks) check\(state.checks == 1 ? "" : "s")" }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.cryptogram.rawValue, completed: state.status == .won, guessCount: guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.status == .won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
    }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/cryptogram/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: CryptogramState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "cryptogram-save-daily" : "cryptogram-save-\(seed)" }
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

    // MARK: - Actions

    private func dispatch(_ a: CryptogramAction) {
        guard !isFinished else { return }
        state = cryptogramReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if case .check = a {
            let n = state.lastWrong.count
            if n > 0 { flash("\(n) wrong letter\(n == 1 ? "" : "s") cleared"); Haptics.error(); SoundManager.shared.playInvalid() }
            else { flash("Everything pencilled is right"); SoundManager.shared.playSuccess() }
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
        SoundManager.shared.playKeyTap()
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
        else { Haptics.error(); SoundManager.shared.playGameOver() }
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
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView {
                    VStack(spacing: 10) {
                        header
                        CipherBoardView(vm: vm, finished: true).padding(.horizontal, 6)
                        Text("“\(vm.state.text)”").font(Brand.font(16, .heavy)).foregroundStyle(Theme.textPrimary)
                            .multilineTextAlignment(.center).frame(maxWidth: 420).padding(.horizontal, 12)
                        result
                    }
                    .padding(.horizontal, 10)
                }
            } else {
                VStack(spacing: 8) {
                    header
                    ScrollView {
                        VStack(spacing: 10) {
                            CipherBoardView(vm: vm, finished: false).padding(.horizontal, 6)
                            let conflicts = vm.conflicts
                            if !conflicts.isEmpty {
                                Text("\(conflicts.joined(separator: ", ")) used for two code letters").font(Brand.font(11, .bold)).foregroundStyle(codebreakerWrong)
                            }
                            FrequencyStripView(vm: vm)
                        }
                        .padding(.vertical, 4)
                    }
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 8) {
                            capsule("Delete", "delete.left") { Haptics.tap(); vm.clearLetter() }
                            capsule(vm.state.checks > 0 ? "Check · \(vm.state.checks)" : "Check", "checkmark.circle") { Haptics.tap(); SoundManager.shared.playKeyTap(); vm.check() }
                            capsule(vm.state.hintsUsed > 0 ? "Hint · \(vm.state.hintsUsed)" : "Hint", "lightbulb") { SoundManager.shared.playKeyTap(); vm.hint() }
                            capsule(vm.revealIn > 0 ? "Reveal · \(timeText(vm.revealIn, clock: true))" : "Reveal", "eye", dim: vm.revealIn > 0) { vm.reveal() }
                        }
                    }
                    LetterKeyboard(onLetter: { vm.setLetter($0) }, onEnter: { vm.advance() }, onDelete: { vm.clearLetter() })
                        .padding(.bottom, 6)
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
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.checks, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "CHECKS", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .cryptogram) }
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
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(codebreakerAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(codebreakerAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    private func capsule(_ label: String, _ symbol: String, dim: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .foregroundStyle(dim ? Theme.textMuted.opacity(0.5) : codebreakerAccent)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(Capsule().fill(dim ? Color.clear : codebreakerAccent.opacity(0.05)))
                .overlay(Capsule().stroke(dim ? Theme.border : codebreakerAccent.opacity(0.4), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(dim)
        .accessibilityLabel(label)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("CODEBREAKER").font(Brand.font(24, .black)).foregroundStyle(codebreakerAccent)
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
        .padding(.top, 6)
    }

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.guessCount
        let hints = vm.state.hintsUsed
        return VStack(spacing: 10) {
            Text(won ? (vm.state.checks == 0 ? "Code cracked clean" : "Code cracked") : "Answer revealed")
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
            .foregroundStyle(codebreakerAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .cryptogram) }
            ScoreBreakdownView(gameMode: GameMode.cryptogram.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: hints,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "CRYPTOGRAM") }
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

/// One letter of the cipher — the Classic tile geometry (14% corner,
/// proportional stroke) with the pencilled plain letter inside and the CODE
/// letter in small monospace beneath.
private struct CipherTile: View {
    let plain: String
    let code: String
    var fill: Color = Theme.surface
    var border: Color = Theme.emptyBorder
    var ink: Color = Theme.textPrimary
    var selected = false
    var width: CGFloat = 28

    var body: some View {
        let h = width * 1.14, r = width * 0.14
        VStack(spacing: 2) {
            Text(plain).font(Brand.font(width * 0.55, .black)).foregroundStyle(ink)
                .frame(width: width, height: h)
                .background(RoundedRectangle(cornerRadius: r).fill(fill))
                .overlay(RoundedRectangle(cornerRadius: r).strokeBorder(border, lineWidth: max(1.5, width * 0.06)))
                .overlay(selected ? RoundedRectangle(cornerRadius: r + 3).stroke(codebreakerAccent, lineWidth: 2).padding(-3) : nil)
            Text(code).font(.system(size: 10, weight: .heavy, design: .monospaced)).foregroundStyle(selected ? codebreakerAccent : Theme.textMuted)
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

    /// Tile width that lets the longest word sit on one line of a phone.
    private var tileWidth: CGFloat {
        let longest = vm.state.cipher.split(separator: " ").map { $0.filter { CRYPTOGRAM_ALPHABET.contains($0) }.count }.max() ?? 1
        let available = UIScreen.main.bounds.width - 44
        return min(30, max(20, floor((available - 3 * CGFloat(max(0, longest - 1))) / CGFloat(max(1, longest)))))
    }

    var body: some View {
        let s = vm.state
        let conflicts = Set(vm.conflicts)
        let words = s.cipher.split(separator: " ", omittingEmptySubsequences: false).map(String.init)
        let tw = tileWidth
        WordWrapLayout(spacing: tw * 0.5, lineSpacing: 10) {
            ForEach(Array(words.enumerated()), id: \.offset) { _, w in
                HStack(alignment: .top, spacing: 3) {
                    ForEach(Array(w.enumerated()), id: \.offset) { _, ch in
                        let code = String(ch)
                        if CRYPTOGRAM_ALPHABET.contains(code) {
                            tile(code, state: s, conflicts: conflicts, width: tw)
                        } else {
                            Text(code).font(Brand.font(tw * 0.6, .black)).foregroundStyle(Theme.textPrimary)
                                .frame(height: tw * 1.14).padding(.horizontal, 1)
                        }
                    }
                }
            }
        }
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
        var fill = Theme.surface, border = Theme.emptyBorder, ink = Theme.textPrimary
        if locked && hinted { fill = codebreakerHint; border = codebreakerHint; ink = .white }
        else if locked && s.given.contains(plain) { fill = codebreakerAccent; border = codebreakerAccent; ink = .white }
        else if locked { fill = codebreakerAccent.opacity(0.13); border = codebreakerAccent; ink = codebreakerAccent }
        else if conflict || wrong { border = codebreakerWrong; ink = codebreakerWrong }
        else if correct { ink = codebreakerAccent }
        return Button { vm.select(code); SoundManager.shared.playKeyTap() } label: {
            CipherTile(plain: plain, code: code, fill: fill, border: border, ink: ink, selected: isSel, width: width)
        }
        .buttonStyle(.plain)
        .disabled(finished)
        .accessibilityLabel("Code letter \(code)\(plain.isEmpty ? "" : ", pencilled \(plain)")\(locked ? ", locked" : "")")
    }
}

/// Code letters by how often they occur, with the pencilled letter shown; tap to select.
struct FrequencyStripView: View {
    @ObservedObject var vm: CodebreakerVM

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
                        Text(c).font(.system(size: 11, weight: .bold, design: .monospaced))
                        Text("\(freq[c] ?? 0)").font(Brand.font(11, .bold)).opacity(0.7)
                        if let plain { Text("→\(plain)").font(Brand.font(11, .black)).foregroundStyle(locked ? codebreakerAccent : Theme.textPrimary) }
                    }
                    .foregroundStyle(locked ? codebreakerAccent : Theme.textMuted)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(isSel ? codebreakerAccent.opacity(0.07) : Theme.surface))
                    .overlay(Capsule().stroke(isSel ? codebreakerAccent : Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Code letter \(c), \(freq[c] ?? 0) times\(plain.map { ", pencilled \($0)" } ?? "")")
            }
        }
        .padding(.horizontal, 8)
        .accessibilityLabel("Letter frequencies")
    }
}
