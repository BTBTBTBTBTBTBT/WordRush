import SwiftUI
import WordociousCore

// Hubbub (More Games §12) — the iOS twin of components/hub/*. Seven letters,
// one required centre, words of 4+ letters. Finalises ONCE (Hubbub = win, End
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
    @Published var showResults = false
    @Published var shake = false
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    let isDaily: Bool
    let seed: String

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    private var guidePauseStart: Double?
    /// The rank already sent to recordGameResult / improve; -1 = never finalised.
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
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
    var dailyNumber: Int { hubDailyNumber(LeaderboardService.todayLocal()) }
    var centre: Character { state.centre }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.hub.rawValue, completed: state.status == .won, guessCount: state.guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.boardsSolved, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: state.hintsUsed).total)
    }
    var pct: Int { state.max > 0 ? (state.points * 100) / state.max : 0 }
    var pangramsFound: Int { state.found.filter { state.pangrams.contains($0) }.count }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !state.ended else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence
    private struct Snapshot: Codable { let seed: String; let date: String; let state: HubState; let elapsed: Int; let savedAt: Double; let recordedRank: Int }
    private var storageKey: String { isDaily ? "hub-save-daily" : "hub-save-\(seed)" }
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000
    private func persist() {
        let snap = Snapshot(seed: seed, date: LeaderboardService.todayLocal(), state: state, elapsed: elapsed, savedAt: Date().timeIntervalSince1970 * 1000, recordedRank: recordedRank)
        if let data = try? JSONEncoder().encode(snap) { UserDefaults.standard.set(data, forKey: storageKey) }
    }
    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: storageKey), let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        let stale = snap.seed != seed || (isDaily && snap.date != LeaderboardService.todayLocal()) || (!isDaily && Date().timeIntervalSince1970 * 1000 - snap.savedAt > Self.practiceTTLms)
        if stale { UserDefaults.standard.removeObject(forKey: storageKey); return }
        state = snap.state; recordedRank = snap.recordedRank
        restoredElapsedMs = Double(snap.elapsed) * 1000
        if state.status != .playing { restoredFinished = true }
        if state.ended { finalTimeSeconds = snap.elapsed; showResults = true }
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
    func delete() { guard !typing.isEmpty else { return }; typing.removeLast() }
    func shuffle() { outer.shuffle(); SoundManager.shared.playKeyTap() }
    func submit() {
        guard !state.ended else { return }
        guard typing.count >= HUB_MIN_WORD else { flash("Four letters or more"); return }
        let word = typing.uppercased()
        dispatch(.submit(word))
        if let r = state.reject {
            flash(rejectCopy(r)); Haptics.error(); SoundManager.shared.playInvalid()
            shake = true; Task { try? await Task.sleep(nanoseconds: 450_000_000); shake = false }
        } else {
            typing = ""
            if state.words.contains(word) { Haptics.tap(); SoundManager.shared.playSuccess(); flash(hubIsPangram(word, letters: state.letters) ? "Pangram! +\(hubWordScore(word, letters: state.letters))" : "+\(hubWordScore(word, letters: state.letters))") }
            else { flash("Bonus word — accepted, no points") }
        }
    }
    func hintStart() { dispatch(.hintStart) }
    func hintReveal() { dispatch(.hintReveal) }
    func end() { dispatch(.end); finalTimeSeconds = elapsed; showResults = true }

    private func rejectCopy(_ r: HubReject) -> String {
        switch r {
        case .ended: return "This puzzle is finished"
        case .short: return "Four letters or more"
        case .centre: return "Must use the centre letter"
        case .letters: return "Only the seven letters"
        case .found: return "Already found"
        case .notword: return "Not in word list"
        }
    }

    /// First finalisation records once; later rank-ups after the win improve in place.
    private func afterChange(from before: HubState) {
        if state.status != .playing && recordedRank < 0 {
            if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() } else { Haptics.error(); SoundManager.shared.playGameOver() }
            finalise()
        } else if state.status == .won && state.rank > before.rank && recordedRank >= 0 {
            improve()
            flash("Rank up: \(state.rankName)")
        }
    }
    private func finalise() {
        recordedRank = state.rank
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
        guard isDaily else { return }
        let gc = state.guessCount, secs = elapsed, used = state.hintsUsed, boards = state.boardsSolved, row = hubMatchRow(state), seed = self.seed
        Task { await GameResultsService.improve(gameMode: .hub, seed: seed, completed: true, guessCount: gc, timeSeconds: secs, boardsSolved: boards, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: used, guesses: row.guesses) }
    }
    private func flash(_ m: String) { toast = m; Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } } }
}

struct HubView: View {
    @StateObject private var vm: HubVM
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: HubVM(seed: seed)); self.onPlayAgain = onPlayAgain
    }
    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 8) {
                header
                if vm.showResults { results } else { board }
            }
            .padding(.horizontal, 10)
            if let toast = vm.toast {
                Text(toast).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10).background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.top, 100).frame(maxHeight: .infinity, alignment: .top)
            }
            if let xp = vm.xpResult { XpToastView(result: xp) { vm.xpResult = nil } }
            if showOverlay {
                VictoryOverlay(won: vm.state.status == .won, guesses: vm.state.found.count, maxGuesses: 0, timeSeconds: vm.elapsed,
                               boardsSolved: vm.state.boardsSolved, totalBoards: HUB_TOTAL_BOARDS, solution: nil, solutions: [], showDefinition: false,
                               statLabel: "WORDS", points: vm.points,
                               onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                               onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .hub) }
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
        .onAppear { if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.beginTimer() } } }
    }

    private func cornerButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(hubAccent)
                .frame(width: 44, height: 44).background(Circle().fill(Theme.surface)).overlay(Circle().stroke(hubAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }.buttonStyle(.plain)
    }

    private func capsule(_ label: String, _ symbol: String, filled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy)).foregroundStyle(filled ? .white : hubAccent)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(filled ? hubAccent : hubAccent.opacity(0.05)))
                .overlay(Capsule().stroke(filled ? hubAccent : hubAccent.opacity(0.4), lineWidth: 1.5))
        }.buttonStyle(.plain).accessibilityLabel(label)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("HUBBUB").font(Brand.font(24, .black)).foregroundStyle(hubAccent)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                Text("\(vm.state.found.count)/\(vm.state.words.count) words").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                Text("\(vm.state.points)/\(vm.state.max) pts").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                if !vm.state.ended {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 2) { Image(systemName: "clock").font(.system(size: 9)); Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))") }
                            .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }.padding(.top, 6)
    }

    private var rankBar: some View {
        let s = vm.state, rank = s.rank
        let next: String? = rank < 9 ? "\(hubRankThreshold(rank + 1, max: s.max) - s.points) to \(HUB_RANKS[rank + 1].name)" : "maximum"
        return VStack(spacing: 4) {
            HStack {
                Text(s.rankName).font(Brand.font(12, .black)).foregroundStyle(hubAccent)
                Spacer()
                Text("\(s.points) pts · \(next ?? "")").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
            }
            HStack(spacing: 4) {
                ForEach(0..<HUB_RANKS.count, id: \.self) { i in
                    Capsule().fill(i <= rank ? hubAccent : Theme.borderLight).frame(height: 8)
                        .overlay(i == HUB_SOLVED_RANK ? Capsule().stroke(hubAccent.opacity(0.5), lineWidth: 2) : nil)
                }
            }
        }
        .frame(maxWidth: 420).padding(.horizontal, 4)
        .accessibilityLabel("Rank \(s.rankName), \(s.points) of \(s.max) points")
    }

    private func letterTile(_ ch: Character, centre: Bool) -> some View {
        Button { vm.type(ch); Haptics.tap() } label: {
            Text(String(ch)).font(Brand.font(26, .black)).foregroundStyle(centre ? .white : Theme.textPrimary)
                .frame(width: 58, height: 58)
                .background(RoundedRectangle(cornerRadius: 8).fill(centre ? hubAccent : Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(centre ? hubAccent : Theme.border, lineWidth: 2))
                .shadow(color: .black.opacity(0.06), radius: 0, x: 0, y: 2)
        }
        .buttonStyle(PressableStyle()).disabled(vm.state.ended)
        .accessibilityLabel(centre ? "\(ch), centre letter" : String(ch))
    }

    private func chip(_ w: String, dim: Bool = false) -> some View {
        let s = vm.state, pangram = s.pangrams.contains(w), revealed = s.revealed.contains(w)
        return Text(pangram ? "\(w) ★" : w).font(Brand.font(11, .bold))
            .foregroundStyle(pangram ? hubAccent : revealed ? Color(hex: 0x8B5CF6) : Theme.textPrimary)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(pangram ? hubAccent.opacity(0.14) : Theme.surface))
            .overlay(Capsule().stroke(pangram ? hubAccent : revealed ? Color(hex: 0x8B5CF6) : Theme.border, lineWidth: 1))
            .opacity(dim ? 0.6 : 1)
    }

    private func chipRows(_ words: [String], dim: Bool = false) -> some View {
        let rows = stride(from: 0, to: words.count, by: 4).map { Array(words[$0..<min($0 + 4, words.count)]) }
        return VStack(spacing: 5) { ForEach(0..<rows.count, id: \.self) { r in HStack(spacing: 5) { ForEach(rows[r], id: \.self) { chip($0, dim: dim) } } } }
    }

    private var board: some View {
        let s = vm.state
        return VStack(spacing: 8) {
            ScrollView {
                VStack(spacing: 12) {
                    rankBar
                    HStack(spacing: 4) {
                        if vm.typing.isEmpty { Text("Tap letters or type").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                        else { ForEach(Array(vm.typing.enumerated()), id: \.offset) { _, ch in
                            Text(String(ch)).font(Brand.font(18, .black)).foregroundStyle(ch == vm.centre ? hubAccent : Theme.textPrimary)
                                .frame(width: 34, height: 42).background(RoundedRectangle(cornerRadius: 6).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 2))
                        } }
                    }
                    .frame(minHeight: 44).offset(x: vm.shake ? 6 : 0).animation(vm.shake ? .default.repeatCount(3, autoreverses: true).speed(6) : .default, value: vm.shake)
                    let o = vm.outer + Array(repeating: Character(" "), count: max(0, 6 - vm.outer.count))
                    VStack(spacing: 8) {
                        HStack(spacing: 8) { letterTile(o[0], centre: false); letterTile(o[1], centre: false) }
                        HStack(spacing: 8) { letterTile(o[2], centre: false); letterTile(vm.centre, centre: true); letterTile(o[3], centre: false) }
                        HStack(spacing: 8) { letterTile(o[4], centre: false); letterTile(o[5], centre: false) }
                    }
                    HStack(spacing: 8) {
                        capsule("Delete", "delete.left") { vm.delete() }
                        capsule("Shuffle", "shuffle") { vm.shuffle() }
                        capsule("Enter", "return", filled: true) { vm.submit() }
                    }
                    HStack(spacing: 8) {
                        capsule("Starts with…", "lightbulb") { vm.hintStart() }
                        capsule("Reveal a word", "eye") { vm.hintReveal() }
                    }
                    let pending = s.hinted.filter { !s.found.contains($0) }
                    if !pending.isEmpty {
                        HStack(spacing: 6) { ForEach(pending, id: \.self) { w in Text("\(w.prefix(2))… · \(w.count) letters").font(Brand.caption(11)).foregroundStyle(Theme.textMuted).padding(.horizontal, 8).padding(.vertical, 3).overlay(Capsule().stroke(hubAccent, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))) } }
                    }
                    Text("\(s.found.count) OF \(s.words.count) WORDS\(s.bonusFound.isEmpty ? "" : " · \(s.bonusFound.count) BONUS")").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    chipRows(s.found.sorted())
                    if !s.bonusFound.isEmpty { chipRows(s.bonusFound.sorted(), dim: true) }
                }
                .padding(.vertical, 4)
            }
            if s.status == .won { Button("See results") { vm.showResults = true }.font(Brand.font(12, .bold)).foregroundStyle(hubAccent).underline() }
            else { Button { vm.end() } label: { Label("End puzzle and see answers", systemImage: "flag").font(Brand.font(12, .bold)) }.foregroundStyle(Theme.textMuted).buttonStyle(.plain) }
            Spacer(minLength: 6)
        }
    }

    private var results: some View {
        let s = vm.state, won = s.status == .won, secs = vm.elapsed
        return ScrollView {
            VStack(spacing: 10) {
                rankBar
                Text(won ? (s.rank == 9 ? "Pandemonium — every word" : s.rankName) : "\(s.rankName) — below Hubbub").font(Brand.title(20)).foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xEF4444))
                Text("\(s.points)/\(s.max) pts · \(s.found.count)/\(s.words.count) words · \(vm.pangramsFound)/\(s.pangrams.count) pangram\(s.pangrams.count == 1 ? "" : "s") · \(timeText(secs))\(s.hintsUsed > 0 ? " · \(s.hintsUsed) hint\(s.hintsUsed == 1 ? "" : "s")" : "")")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
                HStack(spacing: 16) {
                    Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                    Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                    if !s.ended { Button { vm.showResults = false } label: { Label("Keep going", systemImage: "arrow.uturn.left").font(Brand.font(13, .black)) } }
                    if let onPlayAgain, !vm.isDaily, isPro { Button { onPlayAgain() } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }.foregroundStyle(Color(hex: 0xD97706)) }
                }
                .foregroundStyle(hubAccent).padding(.top, 2)
                Text(s.ended ? "ALL WORDS" : "FOUND SO FAR · \(s.words.count - s.found.count) MORE TO FIND").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                if s.ended {
                    let all = s.words.sorted()
                    let rows = stride(from: 0, to: all.count, by: 4).map { Array(all[$0..<min($0 + 4, all.count)]) }
                    VStack(spacing: 5) { ForEach(0..<rows.count, id: \.self) { r in HStack(spacing: 5) { ForEach(rows[r], id: \.self) { w in
                        if s.found.contains(w) { chip(w) } else { Text(w).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0x9CA3AF)).padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(Color(hex: 0xF9FAFB))).overlay(Capsule().stroke(Color(hex: 0xE5E7EB), lineWidth: 1)) }
                    } } } }
                } else { chipRows(s.found.sorted()) }
                if vm.isDaily { DailyRankBadge(gameMode: .hub) }
                ScoreBreakdownView(gameMode: GameMode.hub.rawValue, completed: won, guessCount: s.guessCount, timeSeconds: secs,
                                   boardsSolved: s.boardsSolved, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: s.hintsUsed,
                                   day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
                if vm.isDaily { NextDailyCTA(currentMode: "HUB") }
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
                           guesses: s.guessCount, maxGuesses: 10, timeSeconds: vm.elapsed, points: vm.points, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}
