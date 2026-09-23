import SwiftUI
import WordociousCore

// Spyglass (More Games §17) — the iOS twin of components/wordsearch/*. Ten
// themed words hidden in a 10 × 10 grid, four forward directions in the daily.
// Tap-start / tap-end or drag to select; a straight line of four or more
// letters that spells no list word is a miss. Hint pulses a first letter
// (score cost, never a miss). Reveal (after five minutes) records a loss with
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
    private var guidePauseStart: Double?
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

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
    var dailyNumber: Int { wordsearchDailyNumber(LeaderboardService.todayLocal()) }
    var canReveal: Bool { elapsed >= revealAfterSeconds }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.wordsearch.rawValue, completed: state.status == .won, guessCount: state.guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.found.count, totalBoards: state.words.count, hintsUsed: state.hintsUsed).total)
    }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence

    private struct Snapshot: Codable { let seed: String; let date: String; let state: WordsearchState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "wordsearch-save-daily" : "wordsearch-save-\(seed)" }
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

    private func dispatch(_ a: WordsearchAction) {
        guard !isFinished else { return }
        state = wordsearchReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    func select(from: Int, to: Int) {
        guard !isFinished else { return }
        let before = state
        dispatch(.select(from: from, to: to))
        if state.found.count > before.found.count { Haptics.tap(); SoundManager.shared.playSuccess() }
        else if state.misses > before.misses { Haptics.error(); SoundManager.shared.playInvalid(); flash("Not one of the words") }
    }
    func hint() { let before = state.hintsUsed; dispatch(.hint); if state.hintsUsed > before { SoundManager.shared.playKeyTap() } }
    func reveal() {
        guard canReveal else { flash("Reveal unlocks at \(revealAfterSeconds / 60):00"); return }
        dispatch(.reveal)
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.error(); SoundManager.shared.playGameOver() }
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
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView { VStack(spacing: 10) { header; SpyglassGridView(vm: vm, revealMissing: vm.state.status == .lost).padding(.horizontal, 6); wordChips; result }.padding(.horizontal, 10) }
            } else {
                VStack(spacing: 8) {
                    header
                    SpyglassGridView(vm: vm, revealMissing: false).padding(.horizontal, 6).padding(.top, 2)
                    wordChips
                    Spacer(minLength: 4)
                    HStack(spacing: 8) {
                        capsule(vm.state.hintsUsed > 0 ? "Hint · \(vm.state.hintsUsed)" : "Hint", "lightbulb") { vm.hint() }
                        TimelineView(.periodic(from: .now, by: 1)) { _ in
                            capsule(vm.canReveal ? "Reveal" : "Reveal · \(timeText(max(0, revealAfterSeconds - vm.elapsed)))", "eye", dim: !vm.canReveal) { vm.reveal() }
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
                    .padding(.top, 110).frame(maxHeight: .infinity, alignment: .top)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(
                    won: vm.state.status == .won, guesses: vm.state.misses, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.found.count, totalBoards: vm.state.words.count,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MISSES", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .wordsearch) }
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
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(spyglassAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(spyglassAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    private func capsule(_ label: String, _ symbol: String, dim: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .foregroundStyle(dim ? Theme.textMuted.opacity(0.5) : spyglassAccent)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(dim ? Color.clear : spyglassAccent.opacity(0.05)))
                .overlay(Capsule().stroke(dim ? Theme.border : spyglassAccent.opacity(0.4), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var header: some View {
        VStack(spacing: 3) {
            Text("SPYGLASS").font(Brand.font(24, .black)).foregroundStyle(spyglassAccent)
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
        .padding(.top, 6)
    }

    /// The word list as chips: struck through when found, accent-ringed when hinted.
    private var wordChips: some View {
        let s = vm.state
        return FlowChips(items: s.words.map(\.w)) { w in
            let found = s.found.contains(w), hinted = s.hinted.contains(w) && !found
            Text(w).font(Brand.font(11, .bold)).strikethrough(found)
                .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                .foregroundStyle(found ? spyglassInk : Theme.textPrimary)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(found ? spyglassAccent.opacity(0.14) : Theme.surface))
                .overlay(Capsule().stroke(found ? spyglassAccent.opacity(0.35) : (hinted ? spyglassAccent : Theme.border), lineWidth: 1))
        }
        .padding(.horizontal, 6)
    }

    private var result: some View {
        let s = vm.state
        let won = s.status == .won
        let secs = vm.elapsed
        return VStack(spacing: 10) {
            Text(won ? (s.misses == 0 ? "Clean clear" : "Grid cleared") : "Revealed")
                .font(Brand.title(20)).foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xEF4444))
            Text("\(s.found.count)/\(s.words.count) found · \(formatGuessStat(semantics: "misses", guessBase: 10, guessCount: s.guessCount)) · \(timeText(secs))\(s.hintsUsed > 0 ? " · \(s.hintsUsed) hint\(s.hintsUsed == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain() } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Color(hex: 0xD97706))
                }
            }
            .foregroundStyle(spyglassAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .wordsearch) }
            ScoreBreakdownView(gameMode: GameMode.wordsearch.rawValue, completed: won,
                               guessCount: s.guessCount, timeSeconds: secs,
                               boardsSolved: s.found.count, totalBoards: s.words.count, hintsUsed: s.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "WORDSEARCH") }
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
/// centred, so a long word (WOODPECKER) pushes its neighbours to the next line
/// instead of breaking mid-word. (Fixed rows of five did the latter.)
private struct FlowChips<Content: View>: View {
    let items: [String]
    @ViewBuilder let content: (String) -> Content
    var body: some View {
        WrapLayout(spacing: 5, lineSpacing: 5) { ForEach(items, id: \.self) { content($0) } }
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
    @State private var anchor: Int?
    @State private var hover: Int?
    @State private var pendingTap: Int?

    private let heavy = Color(hex: 0x4C1D95)
    private let rule = Color(hex: 0x4C1D95).opacity(0.16)

    var body: some View {
        let s = vm.state, n = s.n
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let cell = side / CGFloat(n)
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
                    for w in s.words where s.found.contains(w.w) { let c = wordsearchCells(n, w); capsule(c[0], c[c.count - 1], spyglassAccent.opacity(0.28)) }
                    if revealMissing { for w in s.words where !s.found.contains(w.w) { let c = wordsearchCells(n, w); capsule(c[0], c[c.count - 1], Color(hex: 0xDC2626).opacity(0.45), dashed: true) } }
                    if let a = anchor, let h = hover, h != a, preview != nil { capsule(a, h, spyglassAccent.opacity(0.18)) }
                    for k in 1..<n {
                        let p = CGFloat(k) * cell
                        ctx.fill(Path(CGRect(x: p - 0.5, y: 0, width: 1, height: side)), with: .color(rule))
                        ctx.fill(Path(CGRect(x: 0, y: p - 0.5, width: side, height: 1)), with: .color(rule))
                    }
                }
                VStack(spacing: 0) {
                    ForEach(0..<n, id: \.self) { r in
                        HStack(spacing: 0) {
                            ForEach(0..<n, id: \.self) { c in
                                let i = r * n + c
                                ZStack {
                                    if i == anchor || i == pendingTap { Rectangle().fill(spyglassAccent.opacity(0.2)) }
                                    else if previewSet.contains(i) { Rectangle().fill(spyglassAccent.opacity(0.08)) }
                                    if hintCells.contains(i) { Rectangle().stroke(spyglassAccent, lineWidth: 2).padding(1) }
                                    Text(String(chars[i])).font(Brand.font(min(20, cell * 0.5), .black))
                                        .foregroundStyle(foundCells.contains(i) ? spyglassInk : Theme.textPrimary)
                                }
                                .frame(width: cell, height: cell)
                            }
                        }
                    }
                }
            }
            .frame(width: side, height: side)
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(heavy, lineWidth: 2.5))
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
