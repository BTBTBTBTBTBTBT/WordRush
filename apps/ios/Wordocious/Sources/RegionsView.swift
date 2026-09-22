import SwiftUI
import WordociousCore

// Starsweep (More Games §18b) — the iOS twin of components/regions/*. Place one
// star in every row, column and colour region, no two touching. Daily 7 × 7
// Monday–Wednesday, 8 × 8 Thursday–Sunday; Pro Unlimited picks 7 / 8 / 9.
// Tap = cross out, again = star, again = clear. A wrong star is a mistake, the
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
    private var guidePauseStart: Double?
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
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
    var dailyNumber: Int { regionsDailyNumber(LeaderboardService.todayLocal()) }
    var remaining: Int { regionsRemaining(state) }
    var sizeLabel: String { regionsSizeLabel[n] ?? "\(n) × \(n)" }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/regions/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: RegionsState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "regions-save-daily" : "regions-save-\(seed)" }
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

    private func ch(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }

    private func dispatch(_ a: RegionsAction) {
        guard !isFinished else { return }
        state = regionsReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    /// A tap cycles the cell (empty → × → star → empty) and makes it the focus for Erase/Hint.
    func tap(_ cell: Int) {
        guard !isFinished, cell >= 0, cell < n * n else { return }
        focused = cell
        let cur = ch(state.board, cell)
        if cur == "*" && ch(state.hintMask, cell) == "1" { SoundManager.shared.playInvalid(); return }
        let placingWrong = cur == "x" && (Int(ch(state.solution, cell / n).asciiValue!) - 48) != cell % n
        dispatch(.tap(cell: cell))
        if placingWrong && !isFinished { Haptics.error(); SoundManager.shared.playInvalid() } else { SoundManager.shared.playKeyTap() }
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
        else { Haptics.error(); SoundManager.shared.playGameOver() }
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
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView { VStack(spacing: 10) { header; board.padding(.horizontal, 6); result }.padding(.horizontal, 10) }
            } else {
                VStack(spacing: 8) {
                    header
                    if !vm.isDaily && isPro { sizePicker }
                    Spacer(minLength: 4)
                    board.padding(.horizontal, 6)
                    Spacer(minLength: 4)
                    Text(vm.remaining == vm.n && vm.state.history.isEmpty ? "Tap a cell: × first, then a star" : "\(vm.remaining) star\(vm.remaining == 1 ? "" : "s") left")
                        .font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                    RegionsPad(vm: vm).padding(.bottom, 6)
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
                    won: vm.state.status == .won, guesses: vm.mistakes, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISTAKES",
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?(vm.n) } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .regions) }
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
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(regionsAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(regionsAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("STARSWEEP").font(Brand.font(24, .black)).foregroundStyle(regionsAccent)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                Text(vm.sizeLabel).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                HStack(spacing: 3) {
                    Text("Mistakes").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    ForEach(0..<REGIONS_MAX_MISTAKES, id: \.self) { i in
                        Circle().fill(i < vm.mistakes ? Color(hex: 0xDC2626) : Theme.borderLight).frame(width: 8, height: 8)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(vm.mistakes) of \(REGIONS_MAX_MISTAKES) mistakes")
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
        .padding(.top, 6)
    }

    /// Pro Unlimited: 7 × 7 · 8 × 8 · 9 × 9 capsules; switching starts a fresh board.
    private var sizePicker: some View {
        HStack(spacing: 8) {
            ForEach(regionsSizes, id: \.self) { n in
                let active = n == vm.n
                Button { if !active { onPlayAgain?(n) } } label: {
                    Text(regionsSizeLabel[n] ?? "\(n)").font(Brand.font(11, .heavy))
                        .foregroundStyle(active ? .white : regionsAccent)
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Capsule().fill(active ? regionsAccent : Color.clear))
                        .overlay(Capsule().stroke(regionsAccent.opacity(active ? 1 : 0.35), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
    }

    private var board: some View {
        RegionsBoardView(state: vm.state, focused: vm.isFinished ? nil : vm.focused,
                         revealSolution: vm.state.status == .lost) { cell in
            if !vm.isFinished { vm.tap(cell); Haptics.tap() }
        }
    }

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let remaining = vm.remaining
        return VStack(spacing: 10) {
            Text(won ? "Board cleared" : "Out of mistakes")
                .font(Brand.title(20)).foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xEF4444))
            Text(won
                 ? "\(formatGuessStat(semantics: "mistakes", guessBase: 1, guessCount: vm.mistakes + 1)) · \(timeText(secs))\(vm.hintsUsed > 0 ? " · \(vm.hintsUsed) hint\(vm.hintsUsed == 1 ? "" : "s")" : "")"
                 : "\(remaining) star\(remaining == 1 ? "" : "s") left · \(timeText(secs))")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain(vm.n) } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Color(hex: 0xD97706))
                }
            }
            .foregroundStyle(regionsAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .regions) }
            ScoreBreakdownView(gameMode: GameMode.regions.rawValue, completed: won,
                               guessCount: vm.mistakes + 1, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "REGIONS") }
        }
        .padding(.vertical, 12)
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

/// The soft region tints — the same nine the web board and share card use.
let regionsTints: [Color] = [
    Color(hex: 0xEDE9FE), Color(hex: 0xD1FAE5), Color(hex: 0xE0F2FE), Color(hex: 0xFCE7F3), Color(hex: 0xFEF9C3),
    Color(hex: 0xCCFBF1), Color(hex: 0xFFEDD5), Color(hex: 0xECFCCB), Color(hex: 0xE2E8F0),
]

/// ONE continuous ruled board like the Sudoku board: heavy rules between
/// regions, hairlines within a region, regions washed in soft tints (the heavy
/// borders carry the shape, never colour alone). Star in the dark text colour,
/// wrong star red, hint star violet, cross-out a small muted ×. The focused
/// cell wears a thin accent inset ring.
struct RegionsBoardView: View {
    let state: RegionsState
    let focused: Int?
    var revealSolution = false
    let onTap: (Int) -> Void

    private let rule = Color(hex: 0x4C1D95).opacity(0.22), heavy = Color(hex: 0x4C1D95)
    private let hint = Color(hex: 0x8B5CF6), wrong = Color(hex: 0xDC2626), cross = Color(hex: 0x6B7280)

    private func ch(_ s: String, _ i: Int) -> Character { s[s.index(s.startIndex, offsetBy: i)] }

    var body: some View {
        let n = state.n
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let cell = side / CGFloat(n)
            let reg = Array(state.regions), b = Array(state.board), h = Array(state.hintMask), w = Array(state.wrongMask)
            let sol = Array(state.solution)
            ZStack {
                VStack(spacing: 0) {
                    ForEach(0..<n, id: \.self) { r in
                        HStack(spacing: 0) {
                            ForEach(0..<n, id: \.self) { c in
                                let i = r * n + c
                                let g = Int(reg[i].asciiValue!) - 48
                                let missing = revealSolution && b[i] != "*" && (Int(sol[r].asciiValue!) - 48) == c
                                cellView(i, mark: b[i], tint: regionsTints[g % regionsTints.count], hinted: h[i] == "1", isWrong: w[i] == "1",
                                         missing: missing, cell: cell, region: g)
                            }
                        }
                    }
                }
                // Rules — hairline within a region, heavy where the region changes.
                Canvas { ctx, _ in
                    for r in 0..<n {
                        for c in 0..<n {
                            let i = r * n + c
                            if c < n - 1 {
                                let hv = reg[i + 1] != reg[i]
                                let wd: CGFloat = hv ? 2.5 : 1
                                ctx.fill(Path(CGRect(x: CGFloat(c + 1) * cell - wd / 2, y: CGFloat(r) * cell, width: wd, height: cell)), with: .color(hv ? heavy : rule))
                            }
                            if r < n - 1 {
                                let hv = reg[i + n] != reg[i]
                                let wd: CGFloat = hv ? 2.5 : 1
                                ctx.fill(Path(CGRect(x: CGFloat(c) * cell, y: CGFloat(r + 1) * cell - wd / 2, width: cell, height: wd)), with: .color(hv ? heavy : rule))
                            }
                        }
                    }
                }
                .allowsHitTesting(false)
            }
            .frame(width: side, height: side)
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(heavy, lineWidth: 2.5))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 420)
        .accessibilityLabel("Starsweep board")
    }

    @ViewBuilder
    private func cellView(_ i: Int, mark: Character, tint: Color, hinted: Bool, isWrong: Bool, missing: Bool, cell: CGFloat, region: Int) -> some View {
        let n = state.n
        let starColor: Color = isWrong ? wrong : hinted ? hint : Theme.textPrimary
        Button { onTap(i) } label: {
            ZStack {
                Rectangle().fill(tint)
                if mark == "*" {
                    Image(systemName: "star.fill").font(.system(size: cell * 0.5, weight: .bold)).foregroundStyle(starColor)
                } else if mark == "x" {
                    Image(systemName: "xmark").font(.system(size: cell * 0.34, weight: .bold)).foregroundStyle(cross)
                } else if missing {
                    Image(systemName: "star.fill").font(.system(size: cell * 0.5, weight: .bold)).foregroundStyle(Theme.textMuted.opacity(0.55))
                }
                if i == focused { Rectangle().stroke(regionsAccent, lineWidth: 2).padding(1) }
            }
            .frame(width: cell, height: cell)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Row \(i / n + 1) column \(i % n + 1), region \(region + 1), \(mark == "*" ? (isWrong ? "wrong star" : "star") : mark == "x" ? "crossed out" : "empty")")
        .accessibilityAddTraits(i == focused ? .isSelected : [])
    }
}

// MARK: - Pad

/// Action row — Undo · Erase · Auto-cross · Hint, each with its icon (§19).
/// Auto-cross is a toggle: fixed label, state shown by filling with the accent.
struct RegionsPad: View {
    @ObservedObject var vm: RegionsVM

    var body: some View {
        HStack(spacing: 8) {
            capsule("Undo", "arrow.uturn.backward", dim: vm.state.history.isEmpty) { vm.undo() }
            capsule("Erase", "eraser", dim: !vm.canErase) { vm.erase() }
            capsule("Auto-cross", "xmark", active: vm.state.autoCross) { vm.toggleAutoCross() }
            capsule(vm.hintsUsed > 0 ? "Hint · \(vm.hintsUsed)" : "Hint", "lightbulb") { vm.hint() }
        }
        .padding(.horizontal, 2)
    }

    private func capsule(_ label: String, _ symbol: String, active: Bool = false, dim: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .foregroundStyle(dim ? Theme.textMuted.opacity(0.5) : active ? .white : regionsAccent)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(active ? regionsAccent : (dim ? Color.clear : regionsAccent.opacity(0.05))))
                .overlay(Capsule().stroke(dim ? Theme.border : (active ? regionsAccent : regionsAccent.opacity(0.4)), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(dim)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}
