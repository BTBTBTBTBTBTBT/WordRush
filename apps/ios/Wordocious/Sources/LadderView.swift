import SwiftUI
import WordociousCore

// Letter Ladder (More Games §15) — the iOS twin of components/ladder/*. Change
// one letter at a time from START to END. Rejected entries are free; every
// accepted word is a move; the budget is par + 5; Undo is free but spent moves
// stay spent; Hint places the next rung on a shortest path and counts as a
// move. guess_count = moves − par + 1.

private let ladderAccent = Color(hex: 0x0284C7)
private let ladderHint = Color(hex: 0x8B5CF6)

/// The bundled bank (Resources/ladder-puzzles.json — sha-guarded to match the web copy).
enum LadderBankStore {
    static let shared: LadderBank? = {
        guard let url = Bundle.main.url(forResource: "ladder-puzzles", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return LadderBank.load(from: data)
    }()
}

@MainActor
final class LadderVM: ObservableObject {
    @Published private(set) var state: LadderState
    @Published var typing = ""
    @Published var invalid = false
    @Published var toast: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published var xpResult: GameResultsService.XpResult?

    let isDaily: Bool
    let seed: String
    let allowed: Set<String>

    private var startMs = Date().timeIntervalSince1970 * 1000
    private var restoredElapsedMs: Double = 0
    private var guidePauseStart: Double?
    private var recorded = false
    private(set) var restoredFinished = false

    init(seed: String? = nil) {
        self.isDaily = seed == nil
        let today = LeaderboardService.todayLocal()
        self.seed = seed ?? generateDailySeed(date: today, gameMode: GameMode.ladder.rawValue)
        let bank = LadderBankStore.shared ?? LadderBank(version: 1, epoch: LADDER_DAILY_EPOCH, daily: [], extra: [])
        let fallback = LadderPuzzle(id: "none", start: "STONE", end: "STARE", par: 2, path: ["STONE", "STORE", "STARE"])
        let puzzle = (seed == nil ? ladderPuzzleForDay(bank, day: today) : ladderPuzzleForSeed(bank, seed: self.seed)) ?? fallback
        allowed = Set(GameDictionary.shared.getAllowedWordsForLength(5).filter { $0.count == 5 }.map { $0.uppercased() })
        state = LadderState(puzzle: puzzle, seed: self.seed, startTime: Date().timeIntervalSince1970 * 1000)
        restore()
    }

    var isFinished: Bool { state.status != .playing }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }
    var dailyNumber: Int { ladderDailyNumber(LeaderboardService.todayLocal()) }
    var movesLeft: Int { max(0, state.maxMoves - state.moves) }
    var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.ladder.rawValue, completed: state.status == .won, guessCount: state.guessCount,
                                   timeSeconds: elapsed, boardsSolved: state.status == .won ? 1 : 0, totalBoards: 1, hintsUsed: state.hintsUsed).total)
    }

    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 - restoredElapsedMs }
    func pauseForGuide() { guard guidePauseStart == nil, !isFinished else { return }; guidePauseStart = Date().timeIntervalSince1970 * 1000 }
    func resumeFromGuide() { guard let s = guidePauseStart else { return }; startMs += Date().timeIntervalSince1970 * 1000 - s; guidePauseStart = nil }

    // MARK: - Persistence (mirrors components/ladder/persistence.ts)

    private struct Snapshot: Codable { let seed: String; let date: String; let state: LadderState; let elapsed: Int; let savedAt: Double }
    private var storageKey: String { isDaily ? "ladder-save-daily" : "ladder-save-\(seed)" }
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

    private func dispatch(_ a: LadderAction) {
        guard !isFinished else { return }
        state = ladderReduce(state, a, allowed: allowed, now: Date().timeIntervalSince1970 * 1000)
        if state.status != .playing { finish() }
        persist()
    }

    func type(_ letter: String) {
        guard !isFinished, typing.count < LADDER_WORD_LENGTH else { return }
        typing += letter.uppercased()
    }
    func delete() { guard !typing.isEmpty else { return }; typing.removeLast() }
    func submit() {
        guard !isFinished else { return }
        guard typing.count == LADDER_WORD_LENGTH else { flash("Five letters, please"); return }
        let before = state.words.count
        dispatch(.submit(typing))
        if let r = state.reject {
            flash(rejectCopy(r)); Haptics.error(); SoundManager.shared.playInvalid()
            invalid = true
            Task { try? await Task.sleep(nanoseconds: 500_000_000); invalid = false }
        } else if state.words.count > before {
            typing = ""; SoundManager.shared.playKeyTap()
        }
    }
    func undo() { dispatch(.undo); typing = "" }
    func hint() { let before = state.words.count; dispatch(.hint); if state.words.count > before { typing = "" } }

    private func rejectCopy(_ r: LadderReject) -> String {
        switch r {
        case .finished: return "This ladder is finished"
        case .length: return "Five letters, please"
        case .notOneLetter: return "Change exactly one letter"
        case .revisit: return "Already on the ladder"
        case .notWord: return "Not in word list"
        }
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if state.status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.error(); SoundManager.shared.playGameOver() }
        guard !recorded else { return }; recorded = true
        let won = state.status == .won, secs = elapsed, gc = state.guessCount, used = state.hintsUsed
        let row = ladderMatchRow(state)
        let seed = self.seed
        Task {
            let xp = await GameResultsService.record(gameMode: .ladder, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                                     seed: seed, hintsUsed: used)
            await MainActor.run { self.xpResult = xp }
            await GameResultsService.recordSoloMatch(gameMode: .ladder, won: won, score: gc, timeSeconds: secs,
                                                     seed: seed, solutions: row.solutions, guesses: row.guesses, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.ladder.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct LadderView: View {
    @StateObject private var vm: LadderVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var adShown = false
    @State private var showOverlay = false
    @State private var showGuide = false

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: LadderVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    private var isPro: Bool { AuthService.shared.isProActive }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.isFinished {
                ScrollView { VStack(spacing: 10) { header; LadderBoardView(vm: vm, revealPath: vm.state.status == .lost).padding(.horizontal, 6); result }.padding(.horizontal, 10) }
            } else {
                VStack(spacing: 8) {
                    header
                    ScrollView { LadderBoardView(vm: vm, revealPath: false).padding(.horizontal, 6).padding(.vertical, 4) }
                    HStack(spacing: 8) {
                        capsule("Undo", "arrow.uturn.backward", dim: vm.state.words.count <= 1) { vm.undo() }
                        capsule(vm.state.hintsUsed > 0 ? "Hint · \(vm.state.hintsUsed)" : "Hint", "lightbulb") { vm.hint() }
                    }
                    LetterKeyboard(onLetter: { vm.type($0) }, onEnter: { vm.submit() }, onDelete: { vm.delete() })
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
                    won: vm.state.status == .won, guesses: vm.state.moves, maxGuesses: 0,
                    timeSeconds: vm.elapsed, boardsSolved: vm.state.status == .won ? 1 : 0, totalBoards: 1,
                    solution: nil, solutions: [], showDefinition: false, statLabel: "MOVES", points: vm.points,
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && isPro) ? { showOverlay = false; onPlayAgain?() } : nil,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showOverlay = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
            cornerButton("house.fill") { dismiss() }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(.top, 8).padding(.leading, 8)
            cornerButton("questionmark") { showGuide = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(.top, 8).padding(.trailing, 8)
                .sheet(isPresented: $showGuide) { GuideSheet(mode: .ladder) }
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
            Image(systemName: symbol).font(.system(size: 20, weight: symbol == "questionmark" ? .bold : .regular)).foregroundStyle(ladderAccent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(ladderAccent, lineWidth: 2))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }

    private func capsule(_ label: String, _ symbol: String, dim: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol).font(Brand.font(11, .heavy))
                .foregroundStyle(dim ? Theme.textMuted.opacity(0.5) : ladderAccent)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(dim ? Color.clear : ladderAccent.opacity(0.05)))
                .overlay(Capsule().stroke(dim ? Theme.border : ladderAccent.opacity(0.4), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(dim)
        .accessibilityLabel(label)
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("LETTER LADDER").font(Brand.font(24, .black)).foregroundStyle(ladderAccent)
            HStack(spacing: 8) {
                if vm.isDaily { Text("#\(vm.dailyNumber)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted) }
                Text("Par \(vm.state.par)").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                Text("\(vm.state.moves) move\(vm.state.moves == 1 ? "" : "s") · \(vm.movesLeft) left").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
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

    private var result: some View {
        let won = vm.state.status == .won
        let secs = vm.elapsed
        let gc = vm.state.guessCount
        let parLabel = formatGuessStat(semantics: "overPar", guessBase: 1, guessCount: gc)
        return VStack(spacing: 10) {
            Text(won ? (gc == 1 ? "Ladder climbed on par" : "Ladder climbed") : "Out of moves")
                .font(Brand.title(20)).foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xEF4444))
            Text("\(vm.state.moves) move\(vm.state.moves == 1 ? "" : "s") · Par \(vm.state.par)\(won ? " · \(parLabel)" : "") · \(timeText(secs))\(vm.state.hintsUsed > 0 ? " · \(vm.state.hintsUsed) hint\(vm.state.hintsUsed == 1 ? "" : "s")" : "")")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { share() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
                if let onPlayAgain, !vm.isDaily, isPro {
                    Button { onPlayAgain() } label: { Label("Play Again", systemImage: "arrow.clockwise").font(Brand.font(13, .black)) }
                        .foregroundStyle(Color(hex: 0xD97706))
                }
            }
            .foregroundStyle(ladderAccent).padding(.top, 2)
            if vm.isDaily { DailyRankBadge(gameMode: .ladder) }
            ScoreBreakdownView(gameMode: GameMode.ladder.rawValue, completed: won,
                               guessCount: gc, timeSeconds: secs,
                               boardsSolved: won ? 1 : 0, totalBoards: 1, hintsUsed: vm.state.hintsUsed,
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
            if vm.isDaily { NextDailyCTA(currentMode: "LADDER") }
        }
        .padding(.vertical, 12)
    }

    private func timeText(_ s: Int) -> String { s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s" }

    private func share() {
        ShareEvents.log(kind: "image", gameMode: GameMode.ladder.rawValue, surface: "post_game")
        ShareService.share(kind: .ladder(start: vm.state.start, end: vm.state.end, words: vm.state.words, hintMask: vm.state.hintMask,
                                         par: vm.state.par, moves: vm.state.moves, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil),
                           mode: .ladder, modeLabel: "LETTER LADDER", accent: ladderAccent, won: vm.state.status == .won,
                           guesses: vm.state.guessCount, maxGuesses: 6, timeSeconds: vm.elapsed,
                           points: vm.points, puzzleNumber: vm.isDaily ? vm.dailyNumber : nil)
    }
}

// MARK: - Board

/// One tile of the ladder — the Classic tile geometry (14% corner, proportional
/// stroke) with the ladder's own fills: START purple, a changed letter in the
/// accent (violet for a hint rung), plain rungs white, END a dashed target,
/// the revealed route muted.
private struct LadderTile: View {
    let letter: String
    var fill: Color = Theme.surface
    var border: Color = Theme.emptyBorder
    var ink: Color = Theme.textPrimary
    var dashed = false
    var ring: Color? = nil
    var size: CGFloat = 44

    var body: some View {
        let r = size * 0.14
        Text(letter).font(Brand.font(size * 0.5, .black)).foregroundStyle(ink)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: r).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: r).strokeBorder(style: StrokeStyle(lineWidth: max(1.5, size * 0.05), dash: dashed ? [5, 4] : [])).foregroundStyle(border))
            .overlay(ring.map { RoundedRectangle(cornerRadius: r + 3).stroke($0.opacity(0.35), lineWidth: 2).padding(-3) })
    }
}

struct LadderBoardView: View {
    @ObservedObject var vm: LadderVM
    let revealPath: Bool

    private func row(_ word: String, prev: String?, kind: String, invalid: Bool = false) -> some View {
        let chars = Array(word.padding(toLength: 5, withPad: " ", startingAt: 0))
        let prevChars = prev.map(Array.init)
        return HStack(spacing: 5) {
            ForEach(0..<5, id: \.self) { i in
                let ch = chars[i] == " " ? "" : String(chars[i])
                let changed = prevChars.map { $0[i] != chars[i] } ?? false
                switch kind {
                case "start": LadderTile(letter: ch, fill: Color(hex: 0x7C3AED), border: Color(hex: 0x7C3AED), ink: .white)
                case "rung", "hint":
                    if changed {
                        let c = kind == "hint" ? ladderHint : ladderAccent
                        LadderTile(letter: ch, fill: c, border: c, ink: .white, ring: c)
                    } else { LadderTile(letter: ch) }
                case "typing": LadderTile(letter: ch, fill: invalid ? Color(hex: 0xFEF2F2) : Theme.surface, border: invalid ? Color(hex: 0xF87171) : (ch.isEmpty ? Theme.emptyBorder : Theme.borderAlt), ink: invalid ? Color(hex: 0xEF4444) : Theme.textPrimary)
                case "end": LadderTile(letter: ch, fill: .clear, border: ladderAccent.opacity(0.55), ink: ladderAccent, dashed: true)
                default: LadderTile(letter: ch, fill: Color(hex: 0xF9FAFB), border: Color(hex: 0xE5E7EB), ink: Color(hex: 0x9CA3AF))
                }
            }
        }
    }

    var body: some View {
        let s = vm.state
        VStack(spacing: 6) {
            ForEach(Array(s.words.enumerated()), id: \.offset) { i, w in
                row(w, prev: i > 0 ? s.words[i - 1] : nil, kind: i == 0 ? "start" : (Array(s.hintMask)[i] == "1" ? "hint" : "rung"))
            }
            if s.status == .playing { row(vm.typing, prev: s.current, kind: "typing", invalid: vm.invalid) }
            if s.current != s.end {
                Text("↓ \(s.status == .playing ? "REACH" : "TARGET")").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(ladderAccent.opacity(0.7))
                row(s.end, prev: nil, kind: "end")
            }
            if revealPath {
                Text("ONE SHORTEST ROUTE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted).padding(.top, 8)
                ForEach(Array(s.path.enumerated()), id: \.offset) { i, w in row(w, prev: i > 0 ? s.path[i - 1] : nil, kind: "reveal") }
            }
        }
        .accessibilityLabel("Letter Ladder")
    }
}
