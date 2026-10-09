import SwiftUI
import WordociousCore

// Hubbub (More Games §12) — the iOS twin of components/hub/*. Seven letters,
// one required center, words of 4+ letters. Finalizes ONCE (Hubbub = win, End
// below it = loss); play continues after the win and each later rank-up goes
// through GameResultsService.improve (leaderboard + matches row, never XP twice).

private let hubAccent = Color(hex: 0xC026D3)

enum HubBankStore {
    static let shared: HubBank? = {
        guard let url = Bundle.main.url(forResource: "hub-puzzles", withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return HubBank.load(from: data)
    }()
}

@MainActor
final class HubVM: ObservableObject {
    @Published private(set) var state: HubState
    @Published var typing = ""
    @Published var outer: [Character]
    @Published var toast: String?
    /// §BI9: bumps on every flash so a repeated "+1" replays its burst.
    @Published var toastSeq = 0
    @Published var showResults = false
    @Published var shake = false
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?
    /// Active seconds at the last finalize / improve — the time the current rank
    /// was recorded with. After the win this is what the results, breakdown and
    /// share show; the header clock keeps counting the hunt (founder, 2026-09-28).
    @Published private(set) var recordedSeconds = 0

    let isDaily: Bool
    let seed: String

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    /// The clock runs only while the board is in front: the guide, the victory
    /// card and the results view each hold a pause reason (founder, 2026-09-28).
    private var pauseReasons: Set<String> = []
    private var pauseStart: Double?
    private var timerStarted = false
    /// The rank already sent to recordGameResult / improve; -1 = never finalized.
    private var recordedRank = -1
    private(set) var restoredFinished = false

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        let today = LeaderboardService.todayLocal()
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.hub.rawValue)
        let bank = HubBankStore.shared ?? HubBank(version: 1, epoch: HUB_DAILY_EPOCH, daily: [], extra: [])
        let fallback = HubPuzzle(id: "none", letters: "UDELMNP", words: ["DUDE"], bonus: [], pangrams: [], max: 1)
        let puzzle = (seed == nil ? hubPuzzleForDay(bank, day: today) : hubPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        state = HubState(puzzle: puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        outer = Array(puzzle.letters.dropFirst())
        restore()
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int {
        if let f = finalTimeSeconds { return f }
        let now = pauseStart ?? Date().timeIntervalSince1970 * 1000
        return max(0, Int((now - startMs) / 1000))
    }
    /// Time shown for the result: the recorded time once won, the live clock before.
    var displaySeconds: Int { state.status == .won && recordedSeconds > 0 ? recordedSeconds : elapsed }
    var dailyNumber: Int { hubDailyNumber(LeaderboardService.todayLocal()) }
    var centre: Character { state.centre }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.hub.rawValue, completed: state.status == .won, guessCount: state.guessCount,
                                   timeSeconds: displaySeconds, boardsSolved: state.boardsSolved, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
    }
    var pct: Int { state.max > 0 ? (state.points * 100) / state.max : 0 }
    var pangramsFound: Int { state.found.filter { state.pangrams.contains($0) }.count }

    func beginTimer() {
        let now = Date().timeIntervalSince1970 * 1000
        startMs = now - restoredElapsedMs; timerStarted = true
        if pauseStart != nil { pauseStart = now }   // restored straight into results: nothing counted before the first look
    }
    func pauseClock(_ reason: String) {
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
    /// Results in front = clock paused; back to the board = it runs again.
    func setResults(_ on: Bool) {
        showResults = on
        if on { pauseClock("results") } else { resumeClock("results") }
    }
    func setOverlay(_ on: Bool) { if on { pauseClock("overlay") } else { resumeClock("overlay") } }

    // MARK: - Persistence
    private struct Snapshot: Codable { let seed: String; let date: String; let state: HubState; let elapsed: Int; let savedAt: Double; let recordedRank: Int; let recordedSeconds: Int? }
    private var storageKey: String { isDaily ? "hub-save-daily" : "hub-save-\(seed)" }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000
    private func persist() {
        // A finished (ended) Unlimited game is never resumed — drop its save (founder, 2026-09-29).
        if !isDaily && state.ended { UserDefaults.standard.removeObject(forKey: storageKey); return }
        let snap = Snapshot(seed: seed, date: LeaderboardService.todayLocal(), state: state, elapsed: elapsed, savedAt: Date().timeIntervalSince1970 * 1000, recordedRank: recordedRank, recordedSeconds: recordedSeconds)
        if let data = try? JSONEncoder().encode(snap) { UserDefaults.standard.set(data, forKey: storageKey) }
    }
    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: storageKey), let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        let stale = snap.seed != seed || (isDaily && snap.date != LeaderboardService.todayLocal()) || (!isDaily && Date().timeIntervalSince1970 * 1000 - snap.savedAt > Self.practiceTTLms)
        if stale { UserDefaults.standard.removeObject(forKey: storageKey); return }
        state = snap.state; recordedRank = snap.recordedRank
        restoredElapsedMs = Double(snap.elapsed) * 1000
        // Older saves carried no recordedSeconds: the saved elapsed is the best stand-in.
        if recordedRank >= 0 { recordedSeconds = snap.recordedSeconds ?? snap.elapsed }
        if state.status != .playing { restoredFinished = true }
        if state.ended { finalTimeSeconds = state.status == .won && recordedSeconds > 0 ? recordedSeconds : snap.elapsed; setResults(true) }
        // A won puzzle that is not finished re-opens on its results, clock paused,
        // with Keep going to resume the hunt (founder, 2026-09-28).
        else if state.status == .won { setResults(true) }
    }

    // MARK: - Actions
    private func dispatch(_ a: HubAction) {
        guard !state.ended else { return }
        let before = state
        state = hubReduce(state, a, now: Date().timeIntervalSince1970 * 1000)
        afterChange(from: before)
        persist()
    }
    func type(_ ch: Character) { guard !state.ended, typing.count < 19 else { return }; typing.append(ch); SoundManager.shared.playKeyTap() }
    func delete() { guard !typing.isEmpty else { return }; typing.removeLast(); SoundManager.shared.playDelete() }
    func shuffle() { outer.shuffle(); SoundManager.shared.playKeyTap() }
    func submit() {
        guard !state.ended else { return }
        guard typing.count >= HUB_MIN_WORD else { flash("Four letters or more"); return }
        let word = typing.uppercased()
        dispatch(.submit(word))
        if let r = state.reject {
            flash(rejectCopy(r)); Haptics.warning(); SoundManager.shared.playInvalid()
            // Like the word games: the rejected entry shakes, then erases so the next word starts clean.
            shake = true; Task { try? await Task.sleep(nanoseconds: 450_000_000); shake = false; typing = "" }
        } else {
            typing = ""
            // Every accepted word scores (founder, 2026-09-25) — one message for all of them.
            Haptics.tap(); if hubIsPangram(word, letters: state.letters) { SoundManager.shared.playPangram() } else { SoundManager.shared.playFound() }; flash(hubIsPangram(word, letters: state.letters) ? "Pangram! +\(hubWordScore(word, letters: state.letters))" : "+\(hubWordScore(word, letters: state.letters))")
        }
    }
    func hintStart() { dispatch(.hintStart) }
    func hintReveal() { dispatch(.hintReveal) }
    /// "I'm done" / Finish after the win, "End puzzle" before it. Freezes the
    /// clock at the recorded time once won (the hunt after Hubbub is not scored).
    func end() {
        dispatch(.end)
        finalTimeSeconds = state.status == .won && recordedSeconds > 0 ? recordedSeconds : elapsed
        setResults(true)
    }

    private func rejectCopy(_ r: HubReject) -> String {
        switch r {
        case .ended: return "This puzzle is finished"
        case .short: return "Four letters or more"
        case .centre: return "Must use the center letter"
        case .letters: return "Only the seven letters"
        case .found: return "Already found"
        case .notword: return "Not a word we know"
        }
    }

    /// First finalization records once; later rank-ups after the win improve in place.
    private func afterChange(from before: HubState) {
        if state.status != .playing && recordedRank < 0 {
            if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() } else { Haptics.soft(); SoundManager.shared.playGameOver() }
            finalise()
        } else if state.status == .won && state.rank > before.rank && recordedRank >= 0 {
            improve()
            flash("Rank up: \(state.rankName)")
        }
    }
    private func finalise() {
        recordedRank = state.rank
        recordedSeconds = elapsed
        let won = state.status == .won, secs = elapsed, gc = state.guessCount, used = state.hintsUsed, boards = state.boardsSolved
        let row = hubMatchRow(state), seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .hub, won: won, guessCount: gc, timeSeconds: secs, boardsSolved: boards, totalBoards: HUB_TOTAL_BOARDS, seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .hub, won: won, score: gc, timeSeconds: secs, seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(userId: uid, gameMode: GameMode.hub.rawValue, playType: "solo", won: won, guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }
    private func improve() {
        guard state.rank > recordedRank else { return }
        recordedRank = state.rank
        recordedSeconds = elapsed
        guard isDaily else { return }
        let gc = state.guessCount, secs = elapsed, used = state.hintsUsed, boards = state.boardsSolved, row = hubMatchRow(state), seed = self.seed
        Task { await GameResultsService.improve(gameMode: .hub, seed: seed, completed: true, guessCount: gc, timeSeconds: secs, boardsSolved: boards, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: used, guesses: row.guesses) }
    }
    private func flash(_ m: String) {
        toastSeq += 1; toast = m
        let seq = toastSeq
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toastSeq == seq { toast = nil } }
    }
}

struct HubView: View {
    @StateObject private var vm: HubVM
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: HubVM(seed: seed)); self.onPlayAgain = onPlayAgain
    }
    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.hub))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.showResults {
                results.padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header()
                    board
                }
                .padding(.horizontal, 10)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                let won = vm.state.status == .won
                VictoryOverlay(won: won, guesses: vm.state.found.count, maxGuesses: 0, timeSeconds: vm.displaySeconds,
                               boardsSolved: vm.state.boardsSolved, totalBoards: HUB_TOTAL_BOARDS, solution: nil, solutions: [], showDefinition: false,
                               statLabel: "WORDS", points: vm.points,
                               onPlayAgain: (!won && onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                               // After Hubbub the player chooses (founder, 2026-09-28): keep hunting
                               // with the clock running, or finish and see the answers.
                               actions: won ? [
                                   VictoryAction(label: "Keep playing", primary: true) { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } },
                                   VictoryAction(label: "I'm done") { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false }; vm.end() },
                               ] : [],
                               game: .hub,
                               onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
            cornerButton("questionmark") { showGuide = true }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
                .softSheet(isPresented: $showGuide) { GuideSheet(mode: .hub) }
                .firstPlayGuide(mode: .hub, show: $showGuide)
        }
        .navigationBarTitleDisplayMode(.inline)
        // Hardware keys (founder, 2026-09-30): web hub-game keydown — Return
        // enters, Delete deletes, Space shuffles, and only the puzzle's seven
        // letters type. Board view only; off under the victory card.
        .hardwareKeyboard(enabled: !vm.state.ended && !vm.showResults && !showOverlay) { key in
            switch key {
            case .enter: vm.submit()
            case .delete: vm.delete()
            case .space: vm.shuffle()
            case .letter(let l):
                guard let ch = l.first, vm.state.letters.contains(ch) else { return false }
                vm.type(ch)
            default: return false
            }
            return true
        }
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .onChange(of: showOverlay) { vm.setOverlay($0) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.hub))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("HUB")
        .swipeToGoBack { dismiss() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .onChange(of: vm.state.status) { s in
            if s != .playing { FinishArt.prewarm() }   // BJ2: the card's art, off main
            if s != .playing, !vm.restoredFinished { withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showOverlay = true } }
            if s == .won { RatingsPrompt.recordWin(); RatingsPrompt.maybeAsk() }
        }
        .onAppear { if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.beginTimer() } } }
    }

    /// The corner controls (HEADER_SPEC §4): Home as a soft white circle, Help with the 3D icon.
    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        GameCornerButton(kind: symbol == "questionmark" ? .help : .home, action: action)
    }

    /// §A8: the control row's small candy pills (purple Enter, teal Shuffle, amber
    /// hint, pink reveal, peach Delete).
    private func capsule(_ label: String, _ symbol: String, variant: CandyButtonStyle.Variant, action: @escaping () -> Void) -> some View {
        PuzCandyAction(title: label, symbol: symbol, variant: variant, action: action)
    }

    /// `counts: false` on results, where the result line carries the word count.
    private func header(counts: Bool = true) -> some View {
        VStack(spacing: 4) {
            Text("HUBBUB").font(Brand.font(24, .black)).foregroundStyle(hubAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.hub)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                // The one "N/M words · pts" line (hubWordsLabel); results say it in the result line instead.
                if counts {
                    Text(hubWordsLabel(vm.state)).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    Text("\(vm.state.points)/\(vm.state.max) pts").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                }
                if !vm.state.ended {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 2) {
                            Image(systemName: "clock").font(.system(size: 9)); Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))").monospacedDigit()
                            // The clock keeps counting the hunt after Hubbub; say so (founder, 2026-09-28).
                            if vm.state.status == .won { Text("· playing on").font(Brand.caption(10)) }
                        }
                        .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
    }

    /// `points: false` on the board, where the header already says "N/M pts".
    private func rankBar(points: Bool = true) -> some View {
        let s = vm.state, rank = s.rank
        let next: String? = rank < 9 ? "\(hubRankThreshold(rank + 1, max: s.max) - s.points) to \(HUB_RANKS[rank + 1].name)" : "maximum"
        return VStack(spacing: 4) {
            HStack {
                Text(s.rankName).font(Brand.font(12, .black)).foregroundStyle(hubAccent)
                Spacer()
                HStack(spacing: 3) {
                    if points { Text("\(s.points)").softNumber(13) }
                    Text(points ? "pts · \(next ?? "")" : (next ?? "")).font(Brand.caption(11)).foregroundStyle(FinishInk.secondary)
                }
            }
            HStack(spacing: 4) {
                ForEach(0..<HUB_RANKS.count, id: \.self) { i in
                    Capsule().fill(i <= rank ? hubAccent : PuzKit.face(hubAccent, 0.16)).frame(height: 8)
                        .overlay(i == HUB_SOLVED_RANK ? Capsule().stroke(hubAccent.opacity(0.5), lineWidth: 2) : nil)
                }
            }
        }
        .frame(maxWidth: 420).padding(.horizontal, 4)
        .accessibilityLabel("Rank \(s.rankName), \(s.points) of \(s.max) points")
    }

    private func letterTile(_ ch: Character, centre: Bool, side: CGFloat) -> some View {
        HubHexKey(letter: ch, centre: centre, side: side, disabled: vm.state.ended) { vm.type(ch) }
    }

    private func chip(_ w: String, dim: Bool = false) -> some View {
        let s = vm.state, pangram = s.pangrams.contains(w), revealed = s.revealed.contains(w)
        let bonus = !pangram && hubIsBonus(s.bonusFound, w)
        // §A1: found words are tinted pills in the accent (pangrams stronger); a rarer word
        // (scores, outside the N/M words count) wears a tiny glossy gem on its corner (button family,
        // 10-05 — no "bonus" on player screens since 09-25).
        return Text(pangram ? "\(w) ★" : w).font(Brand.font(11, .black))
        .accessibilityElement(children: .ignore).accessibilityLabel(bonus ? "\(w), rare word" : pangram ? "\(w), pangram" : w)
        .foregroundStyle(pangram ? hubAccent : revealed ? Color(hex: 0x8B5CF6) : PuzKit.ink)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Capsule().fill(PuzKit.face(hubAccent, pangram ? 0.2 : 0.09)))
        .overlay(Capsule().stroke(pangram ? hubAccent : revealed ? Color(hex: 0x8B5CF6) : PuzKit.line(hubAccent, 0.28), lineWidth: 1))
        .overlay(alignment: .topTrailing) { if bonus { RareWordGem() } }
        .opacity(dim ? 0.6 : 1)
    }

    /// §BI22: a pending "Starts with…" hint — a soft filled amber candy chip with a
    /// lightbulb (no dashed outline), first in the found-word flow.
    private func hintChip(_ w: String) -> some View {
        let amber = Color(hex: 0xF5A524)
        return HStack(spacing: 4) {
            Image(systemName: "lightbulb.fill").font(.system(size: 9, weight: .black)).foregroundStyle(amber)
            Text("\(w.prefix(2))… · \(w.count) letters").font(Brand.font(11, .black)).foregroundStyle(PuzKit.ink)
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Capsule().fill(PuzKit.face(amber, 0.2)))
        .accessibilityLabel("Hint: starts with \(w.prefix(2)), \(w.count) letters")
    }

    private func chipRows(_ words: [String], dim: Bool = false) -> some View {
        let rows = stride(from: 0, to: words.count, by: 4).map { Array(words[$0..<min($0 + 4, words.count)]) }
        return VStack(spacing: 5) { ForEach(0..<rows.count, id: \.self) { r in HStack(spacing: 5) { ForEach(rows[r], id: \.self) { chip($0, dim: dim) } } } }
    }

    // MARK: - Board layout (founder rule, plan §12, 2026-09-24)
    // The 2-3-2 cluster is the hero and scales to the screen. Everything in the
    // board column other than the cluster and the found-word flow is a fixed
    // row; their heights are estimated here so the tile can be sized before the
    // first layout pass: tile = clamp(remaining / 3.3, 72, 100).
    private static let rankBarHeight: CGFloat = 27      // rank name + 8 pt capsules
    private static let entryLineHeight: CGFloat = 44    // 28 pt entry, min height
    private static let controlRowHeight: CGFloat = 38   // one candy row (34 pt + lip, ×2)
    private static let foundHeaderHeight: CGFloat = 12  // "N OF M WORDS"
    private static let endLinkHeight: CGFloat = 44      // pinned End candy + bottom pad
    /// §L: the honeycomb's tray (padding both sides + the 4-pt lip).
    private static let trayHeight: CGFloat = GameTray.padding * 2 + GameTray.lip
    private static let boardRowSpacing: CGFloat = 8
    private static let boardFixedRows = 7               // rows around the cluster band
    private static let tileMin: CGFloat = 64, tileMax: CGFloat = 100

    private static func tileSide(boardHeight h: CGFloat) -> CGFloat {
        let reserved = rankBarHeight + entryLineHeight + controlRowHeight * 2 + foundHeaderHeight + endLinkHeight + trayHeight + boardRowSpacing * CGFloat(boardFixedRows)
        // FINISH_SPEC §B5: the shared sizing rule over the honeycomb's height
        // (three hexes tall plus gaps ≈ 2.9 pieces; 3.3 leaves the found-words room).
        return CGFloat(BoardSizing.fitTile(widthUnits: 1, heightUnits: 3.3, fixedHeight: Double(reserved),
                                           width: .infinity, height: Double(h), heightFill: 1,
                                           maxTile: Double(tileMax), minTile: Double(tileMin))).rounded(.down)
    }

    /// The word in progress: 28 pt bold, center letter in the accent, placeholder when
    /// empty. Shakes on a rejected entry and is erased by the view-model afterwards.
    private var entryLine: some View {
        Group {
            if vm.typing.isEmpty {
                Text("Tap letters or type").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            } else {
                vm.typing.reduce(Text("")) { acc, ch in
                    acc + Text(String(ch)).foregroundColor(ch == vm.centre ? hubAccent : Theme.textPrimary)
                }
                .font(Brand.font(28, .bold)).kerning(2).lineLimit(1).minimumScaleFactor(0.5)
            }
        }
        .frame(maxWidth: .infinity, minHeight: Self.entryLineHeight)
        .offset(x: vm.shake ? 6 : 0)
        .animation(vm.shake ? .default.repeatCount(3, autoreverses: true).speed(6) : .default, value: vm.shake)
        .accessibilityLabel(vm.typing.isEmpty ? "Tap letters or type" : "Entry \(vm.typing)")
    }

    /// FINISH_SPEC §J1: the honeycomb — the gold center hexagon with the six lilac
    /// hexagons around it (flat-top pieces: one above, one below, two each side),
    /// sitting on the shared game tray (§L).
    private func cluster(side: CGFloat) -> some View {
        let o = vm.outer + Array(repeating: Character(" "), count: max(0, 6 - vm.outer.count))
        // Piece centers relative to the middle: vertical step ≈ the hex's height,
        // side neighbors ¾ of its width across and half a step up / down.
        let v = side * 0.95, h = side * 0.77
        let spots: [CGPoint] = [
            CGPoint(x: 0, y: -v), CGPoint(x: h, y: -v / 2), CGPoint(x: h, y: v / 2),
            CGPoint(x: 0, y: v), CGPoint(x: -h, y: v / 2), CGPoint(x: -h, y: -v / 2),
        ]
        let w = side + 2 * h, ht = side + 2 * v
        return ZStack {
            ForEach(0..<6, id: \.self) { i in
                letterTile(o[i], centre: false, side: side).offset(x: spots[i].x, y: spots[i].y)
            }
            letterTile(vm.centre, centre: true, side: side)
        }
        .frame(width: w, height: ht)
        .accessibilityElement(children: .contain)
        .gameTray(accent: hubAccent)
    }

    private var board: some View {
        let s = vm.state
        return GeometryReader { geo in
            let side = Self.tileSide(boardHeight: geo.size.height)
            let pending = s.hinted.filter { !s.found.contains($0) }
            VStack(spacing: Self.boardRowSpacing) {
                rankBar(points: false)  // the header already says "N/M pts"
                // §BI9: the feedback popup sits on the entry line, just above the
                // honeycomb — never over the HUBBUB title art or the board.
                entryLine.gameFeedbackToast(vm.toast, seq: vm.toastSeq)
                // The cluster band: everything between the entry line and the controls,
                // cluster centered inside it.
                cluster(side: side)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                HStack(spacing: 8) {
                    capsule("Delete", "delete.left", variant: .peach) { vm.delete() }
                    capsule("Shuffle", "shuffle", variant: .teal) { vm.shuffle() }
                    capsule("Enter", "return", variant: .purple) { vm.submit() }
                }
                HStack(spacing: 8) {
                    capsule("Starts with…", "lightbulb", variant: .amber) { vm.hintStart() }
                    capsule("Reveal a word", "eye", variant: .pink) { vm.hintReveal() }
                }
                // A label, never a second count: the header's hubWordsLabel is the one word count (Doug 10-05: 8 vs 18).
                Text(HUB_FOUND_LABEL).font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                // Found words: newest first in a wrapping flow that fills the lower area
                // and scrolls once it overflows.
                ScrollView(showsIndicators: false) {
                    HubWrapLayout(spacing: 5, lineSpacing: 5) {
                        // §BI22: "Starts with…" hints lead the found-word flow INSIDE its
                        // scroll area — they used to be a row of their own in the column,
                        // which squeezed the honeycomb band (the board shrank on a hint).
                        ForEach(pending, id: \.self) { hintChip($0) }
                        // Every accepted word, newest first, in the order found (the event log spans both lists).
                        ForEach(hubFoundInOrder(s).reversed(), id: \.self) { chip($0) }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 7).padding(.horizontal, 7)   // room for a rare word's corner gem (the scroll clips)
                    .padding(.vertical, 2)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if s.status == .won { PuzCandyAction(title: "Finish", symbol: "flag", variant: .purple) { vm.end() } }
                else { PuzCandyAction(title: "End puzzle and see answers", symbol: "flag", variant: .peach) { vm.end() } }
            }
            .padding(.bottom, 6)
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    /// FINISH_SPEC §R2: one screen — header + result strip + the rank bar, the word
    /// list scaled into the height left (it scrolls inside its area), the dock (Keep
    /// going before the end, share, the daily CTAs / the Unlimited card); the full
    /// summary + breakdown below the dock.
    private var results: some View {
        let s = vm.state, won = s.status == .won, secs = vm.displaySeconds, count = hubWordCount(s)
        return FinishedScreenLayout {
            VStack(spacing: 6) {
                header(counts: false)
                PuzFinishedHeadline(text: won ? (s.rank == 9 ? "Pandemonium — every word" : s.rankName) : "\(s.rankName) — below Hubbub", won: won)
                PuzResultLine(won: won, items: [("\(count.found)/\(count.total)", "words"), (puzClock(secs), "time")],
                                    points: vm.points)
                rankBar()
            }
        } board: { size in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 8) {
                    Text(s.ended ? "ALL WORDS" : "FOUND SO FAR · \(s.words.count - s.found.count) MORE TO FIND").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(FinishInk.secondary)
                    if s.ended {
                        let all = (s.words + s.bonusFound).sorted()
                        let rows = stride(from: 0, to: all.count, by: 4).map { Array(all[$0..<min($0 + 4, all.count)]) }
                        VStack(spacing: 5) { ForEach(0..<rows.count, id: \.self) { r in HStack(spacing: 5) { ForEach(rows[r], id: \.self) { w in
                            if s.found.contains(w) || s.bonusFound.contains(w) { chip(w) } else { Text(w).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0x8D99B0)).padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(PuzKit.face(Color(hex: 0x6B7891), 0.08))).overlay(Capsule().stroke(PuzKit.line(Color(hex: 0x6B7891), 0.22), lineWidth: 1)) }
                        } } } }
                    } else { chipRows((s.found + s.bonusFound).sorted()) }
                }
                .frame(maxWidth: .infinity)
                // §L: the word list on the tray (purple once Hubbub is reached).
                .gameTray(accent: hubAccent, state: won ? .won : .normal, padding: 10)
                .frame(maxWidth: .infinity, minHeight: size.height, alignment: .top)
            }
        } dock: {
            PuzFinishedDock(isDaily: vm.isDaily, currentMode: "HUB", game: "Hubbub", onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && isPro) ? { onPlayAgain?() } : nil,
                            onOtherGames: { dismiss() },
                            keepGoing: s.ended ? nil : { vm.setResults(false) }, onShare: { _ in share() })
        } extras: {
            VStack(spacing: 10) {
                // Words, points and time are already in the result line and rank bar above — never twice.
                Text("\(vm.pangramsFound)/\(s.pangrams.count) pangram\(s.pangrams.count == 1 ? "" : "s")\(s.hintsUsed > 0 ? " · \(s.hintsUsed) hint\(s.hintsUsed == 1 ? "" : "s")" : "")")
                    .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary).multilineTextAlignment(.center)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .tintedPill(hubAccent)
                if vm.isDaily { DailyRankBadge(gameMode: .hub) }
                ScoreBreakdownView(gameMode: GameMode.hub.rawValue, completed: won, guessCount: s.guessCount, timeSeconds: secs,
                                   boardsSolved: s.boardsSolved, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: s.hintsUsed,
                                   day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            }
            .padding(.vertical, 12)
        }
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        let s = vm.state
        ShareEvents.log(kind: "image", gameMode: GameMode.hub.rawValue, surface: "post_game")
        ShareService.share(kind: .hub(rankName: s.rankName, pct: vm.pct, wordsFound: s.found.count, wordCount: s.words.count, pangramsFound: vm.pangramsFound, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .hub, modeLabel: "HUBBUB", accent: hubAccent, won: s.status == .won,
                           guesses: s.guessCount, maxGuesses: 10, timeSeconds: vm.displaySeconds, points: vm.points, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}

// MARK: - Wrapping flow for found-word chips (local copy of SpyglassView's WrapLayout;
// files never import across each other).
private struct HubWrapLayout: Layout {
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

/// Every accepted word in the order it was found — the event log carries "+" (core list), "=" (rarer word) and "!" (revealed).
func hubFoundInOrder(_ s: HubState) -> [String] {
    var out: [String] = []
    for ev in s.events where ev.first == "+" || ev.first == "=" || ev.first == "!" {
        let w = String(ev.dropFirst()); if !out.contains(w) { out.append(w) }
    }
    return out
}

/// FINISH_SPEC §J1: one hive letter as a glossy hexagon — `art-piece-hex-center`
/// (gold) for the required center, `art-piece-hex` (lilac) for the six around it —
/// with the letter drawn on top in code (white Nunito Black with the tile shadow;
/// dark amber #7a3d00 on the gold center). Tap = squish + type pop.
private struct HubHexKey: View {
    let letter: Character
    let centre: Bool
    let side: CGFloat
    let disabled: Bool
    let action: () -> Void
    @State private var taps = 0

    var body: some View {
        Button {
            taps += 1
            action()
            Haptics.tap()
        } label: {
            ZStack {
                Image(centre ? "art-piece-hex-center" : "art-piece-hex")
                    .resizable().interpolation(.high).scaledToFit()
                    .accessibilityHidden(true)
                Text(String(letter))
                    .font(Brand.fixedFont((side * 0.4).rounded(), .black))
                    .foregroundStyle(centre ? Color(hex: 0x7A3D00) : .white)
                    .shadow(color: centre ? Color.white.opacity(0.45) : Color(hex: 0x4C1D95).opacity(0.45),
                            radius: side * 0.012, x: 0, y: side * 0.02)
                    // The faces' optical center sits a touch above the frame center (the lip).
                    .offset(y: -side * 0.03)
            }
            .frame(width: side, height: side)
            .contentShape(HubHexShape())
            .modifier(PuzTapPop(trigger: taps, size: CGSize(width: side, height: side)))
        }
        .buttonStyle(.squish)
        .disabled(disabled)
        .accessibilityLabel(centre ? "\(letter), center letter" : String(letter))
    }
}

/// The flat-top hexagon hit shape (so neighbors never steal each other's taps).
private struct HubHexShape: Shape {
    func path(in r: CGRect) -> Path {
        let inset = r.width * 0.04
        let x0 = r.minX + inset, x1 = r.maxX - inset
        let q = (x1 - x0) / 4
        var p = Path()
        p.move(to: CGPoint(x: x0, y: r.midY))
        p.addLine(to: CGPoint(x: x0 + q, y: r.minY + inset))
        p.addLine(to: CGPoint(x: x1 - q, y: r.minY + inset))
        p.addLine(to: CGPoint(x: x1, y: r.midY))
        p.addLine(to: CGPoint(x: x1 - q, y: r.maxY - inset))
        p.addLine(to: CGPoint(x: x0 + q, y: r.maxY - inset))
        p.closeSubpath()
        return p
    }
}
