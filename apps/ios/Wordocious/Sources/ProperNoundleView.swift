import SwiftUI
import WordociousCore

private let categoryLabels: [String: String] = [
    "music": "Music", "videogames": "Video Games", "movies": "Movies & TV", "sports": "Sports",
    "history": "History", "science": "Science", "currentevents": "Current Events",
]
/// Per-category pill colors (web CATEGORY_COLORS); unknown → #7C3AED fallback.
private let categoryColors: [String: Color] = [
    "music": Color(hex: 0xEC4899), "videogames": Color(hex: 0x8B5CF6), "movies": Color(hex: 0xF59E0B),
    "sports": Color(hex: 0x10B981), "history": Color(hex: 0x6366F1), "science": Color(hex: 0x06B6D4),
    "currentevents": Color(hex: 0xEF4444),
]
private func categoryLabel(_ cat: String?) -> String { cat.map { categoryLabels[$0] ?? $0 } ?? "" }
private let pnAccent = Color(hex: 0xDC2626)

@MainActor
final class ProperNoundleVM: ObservableObject {
    @Published private(set) var puzzle: NPuzzle?
    @Published private(set) var guesses: [(word: String, tiles: [NTile])] = []
    @Published var input = ""
    @Published private(set) var status: GameStatus = .playing
    @Published var toast: String?
    @Published private(set) var clue: String?
    @Published private(set) var loadingClue = false
    @Published private(set) var revealedVowel: String?
    @Published private(set) var revealedConsonant: String?
    @Published private(set) var finalTimeSeconds: Int?
    @Published private(set) var wikiImageURL: String?
    /// XP earned by this game — drives the post-game XP toast (web parity:
    /// propernoundle-game.tsx renders <XpToast/> after recording).
    @Published var xpResult: GameResultsService.XpResult?

    /// Fetch the answer's Wikipedia photo for the result screen (web parity).
    func loadWikiImage() async {
        guard wikiImageURL == nil, let p = puzzle else { return }
        wikiImageURL = await WikipediaHint.fetchImageURL(displayName: p.display, wikiTitle: p.wikiTitle)
    }

    /// Full (un-redacted) Wikipedia clue for the result screen — doubles as the
    /// definition (proper nouns aren't in the dictionary). Web parity.
    @Published private(set) var resultClue: String?
    func loadResultClue() async {
        guard resultClue == nil, let p = puzzle else { return }
        resultClue = await WikipediaHint.fetch(displayName: p.display, wikiTitle: p.wikiTitle, redact: false) ?? p.hint
    }

    private var startMs = Date().timeIntervalSince1970 * 1000
    /// Reset the clock so the game-start ad's time isn't counted — but keep any
    /// elapsed time carried over from a restored session.
    func beginTimer() {
        let now = Date().timeIntervalSince1970 * 1000
        startMs = now - restoredElapsedMs; timerStarted = true
        if pauseStart != nil { pauseStart = now }
    }

    private var pauseReasons: Set<String> = []
    private var pauseStart: Double?
    private var timerStarted = false
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
    private var recorded = false
    var answerLen: Int { puzzle.map { ProperNoundle.normalize($0.answer).count } ?? 0 }
    var maxGuesses: Int { ProperNoundle.maxGuesses }
    var isFinished: Bool { status != .playing }
    var hintsUsed: Int { [clue, revealedVowel, revealedConsonant].compactMap { $0 }.count }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int(((pauseStart ?? Date().timeIntervalSince1970 * 1000) - startMs) / 1000)) }

    // VS hooks (set by VSMatchViewModel when this drives a VS match).
    let isVersus: Bool
    /// True when playing today's daily puzzle (no explicit seed, not VS) —
    /// gates the "#N" puzzle number in the header (web parity).
    let isDaily: Bool
    var onGuessCommitted: ((String) -> Void)?
    var onCompleted: ((GameStatus, Int) -> Void)?

    /// Solo → today's daily puzzle. VS → a deterministic puzzle from the match
    /// seed so both players get the same one.
    init(seed: String? = nil, isVersus: Bool = false) {
        self.isVersus = isVersus
        self.isDaily = (seed == nil && !isVersus)
        self.gameSeed = seed
        puzzle = seed.flatMap { ProperNoundle.puzzle(forSeed: $0) } ?? ProperNoundle.dailyPuzzle()
        #if DEBUG
        if let n = PerfTour.argument("-pnAnswerLength").flatMap(Int.init), let p = ProperNoundle.debugPuzzle(letters: n) { puzzle = p }
        #endif
        // Resume an in-progress / completed session for this exact puzzle so
        // guesses + hints survive leaving and returning (web parity:
        // propernoundle-game.tsx daily/practice localStorage restore). VS never
        // persists (the match drives it).
        restore()
    }

    /// The seed the VM was created with (unlimited/VS); nil = today's daily.
    private let gameSeed: String?

    // MARK: - Persistence (mirrors web getSaved*/save*State)

    /// Saved snapshot of an in-progress ProperNoundle game.
    private struct Snapshot: Codable {
        let puzzleId: String
        let date: String              // local date — daily save invalidates at rollover
        let guessWords: [String]
        let guessTiles: [[NTile]]
        let status: Int               // 0 playing, 1 won, 2 lost
        let clue: String?
        let revealedVowel: String?
        let revealedConsonant: String?
        let elapsed: Int
        let savedAt: Double
    }

    /// One UserDefaults key per save slot: the daily shares a slot (validated by
    /// date + puzzleId); each unlimited/practice seed gets its own.
    private var storageKey: String? {
        if isVersus { return nil }
        return isDaily ? "pn-save-daily" : "pn-save-\(gameSeed ?? "practice")"
    }
    /// Practice/unlimited saves expire after 24h (web PRACTICE_TTL_MS).
    private static let practiceTTLms: Double = 24 * 60 * 60 * 1000
    /// Elapsed (ms) carried over from a restored session — beginTimer() rebases
    /// the clock by this so the game-start ad gap isn't counted but resumed time is.
    private var restoredElapsedMs: Double = 0

    private func persist() {
        guard let key = storageKey, let p = puzzle else { return }
        // A finished Unlimited game is never resumed — drop its save (founder, 2026-09-29).
        if !isDaily && isFinished { UserDefaults.standard.removeObject(forKey: key); return }
        let snap = Snapshot(
            puzzleId: p.id, date: LeaderboardService.todayLocal(),
            guessWords: guesses.map(\.word), guessTiles: guesses.map(\.tiles),
            status: status == .won ? 1 : (status == .lost ? 2 : 0),
            clue: clue, revealedVowel: revealedVowel, revealedConsonant: revealedConsonant,
            elapsed: elapsed, savedAt: Date().timeIntervalSince1970 * 1000)
        if let data = try? JSONEncoder().encode(snap) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    private func restore() {
        guard let key = storageKey, let p = puzzle,
              let data = UserDefaults.standard.data(forKey: key),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        // Fail-closed: only restore the exact puzzle; daily also re-checks the
        // local date (web getSavedDailyState), practice honors the 24h TTL.
        let stale = snap.puzzleId != p.id
            || (isDaily && snap.date != LeaderboardService.todayLocal())
            || (!isDaily && Date().timeIntervalSince1970 * 1000 - snap.savedAt > Self.practiceTTLms)
        if stale { UserDefaults.standard.removeObject(forKey: key); return }
        guard snap.guessWords.count == snap.guessTiles.count else { return }
        guesses = zip(snap.guessWords, snap.guessTiles).map { (word: $0, tiles: $1) }
        status = snap.status == 1 ? .won : (snap.status == 2 ? .lost : .playing)
        clue = snap.clue
        revealedVowel = snap.revealedVowel
        revealedConsonant = snap.revealedConsonant
        restoredElapsedMs = Double(snap.elapsed) * 1000
        if status != .playing {
            // Completed restore: freeze the clock and block re-recording (web
            // restoredDailyRef short-circuits the game-over effect).
            finalTimeSeconds = snap.elapsed
            recorded = true
        }
    }

    func type(_ l: String) { guard !isFinished, input.count < answerLen else { return }; input += l.lowercased() }
    func delete() { if !input.isEmpty { input.removeLast() } }

    func submit() {
        guard !isFinished, let p = puzzle else { return }
        guard input.count == answerLen else { flash("Not enough letters"); SoundManager.shared.playInvalid(); return }
        // UGC screen: PN guesses aren't dictionary-validated and become
        // permanent board art (completed cards, share images, VS relay), so a
        // guess containing a blocklisted term is rejected like an invalid word.
        guard !Profanity.pnGuessBlocked(guess: input, answer: p.answer) else {
            flash("Not allowed"); SoundManager.shared.playInvalid(); return
        }
        let word = input
        let tiles = ProperNoundle.evaluate(guess: word, answer: p.answer)
        guesses.append((word, tiles)); input = ""
        onGuessCommitted?(word)
        if ProperNoundle.isWin(tiles) { status = .won; finish() }
        else if guesses.count >= maxGuesses { status = .lost; finish() }
        persist()
    }

    func keyState(_ letter: String) -> NTile? {
        var best: NTile?
        for g in guesses {
            let chars = Array(g.word)
            for (i, t) in g.tiles.enumerated() where i < chars.count && String(chars[i]) == letter.lowercased() {
                best = merge(best, t)
            }
        }
        return best
    }
    private func merge(_ a: NTile?, _ b: NTile) -> NTile {
        let r: (NTile) -> Int = { switch $0 { case .correct: return 3; case .present: return 2; case .absent: return 1; default: return 0 } }
        guard let a else { return b }; return r(b) > r(a) ? b : a
    }

    // Hints
    /// Clue hint — fetches the Wikipedia summary (first 2 sentences, name
    /// redacted), exactly like the web. Falls back to the puzzle's static hint
    /// (or category) on any network/parse failure.
    /// Web parity (propernoundle-game.tsx handleHintClue + use-hints.ts
    /// fetchClue): the clue COSTS a board row — an all-gray 'hint-used' row
    /// with no letters is pushed into guesses (success AND fallback), and if
    /// that fills the board the game is LOST.
    func revealClue() {
        guard clue == nil, !loadingClue, !isFinished, let p = puzzle else { return }
        loadingClue = true
        Task {
            let fetched = await WikipediaHint.fetch(displayName: p.display, wikiTitle: p.wikiTitle)
            self.clue = fetched ?? p.hint ?? "Category: \(categoryLabel(p.themeCategory))"
            self.loadingClue = false
            // Consume a row (web: setGuesses([...guesses, hintGuess])) — empty
            // word, every tile 'hint-used' (gray). Counted in guesses.count
            // (recorded guess_count) exactly like a real guess.
            guard !self.isFinished else { return }
            self.guesses.append((word: "", tiles: Array(repeating: NTile.hintUsed, count: self.answerLen)))
            if self.guesses.count >= self.maxGuesses { self.status = .lost; self.finish() }
            self.persist()
        }
    }
    func revealVowel() { reveal(vowels: true) }
    func revealConsonant() { reveal(vowels: false) }

    /// Mirrors web useHints.revealVowel/revealConsonant: pick a RANDOM unique
    /// vowel/consonant from the answer and reveal it as a board ROW (revealed
    /// letter = correct, the rest = hint-used). A no-op label change before was
    /// why "nothing happened" — now it actually reveals on the board.
    private func reveal(vowels: Bool) {
        guard let p = puzzle, !isFinished else { return }
        if vowels ? (revealedVowel != nil) : (revealedConsonant != nil) { return }
        let vset = Set("AEIOU")
        let chars = Array(ProperNoundle.normalize(p.answer).uppercased())
        let classPool = Set(chars.filter { c in c >= "A" && c <= "Z" && (vowels ? vset.contains(c) : !vset.contains(c)) })
        // §243 (founder: the consonant hint "gave me a T" he'd already
        // guessed): prefer letters not in any prior guess — Six/Seven always
        // did; PN pooled the whole answer. Full pool only when every letter of
        // the class is known (the position reveal still informs).
        let guessedLetters = Set(guesses.flatMap { $0.word.uppercased() })
        let fresh = classPool.subtracting(guessedLetters)
        let pool = fresh.isEmpty ? classPool : fresh
        guard let pick = pool.randomElement() else {
            if vowels { revealedVowel = "None" } else { revealedConsonant = "None" }
            persist()
            return
        }
        let tiles: [NTile] = chars.map { $0 == pick ? .correct : .hintUsed }
        let word = String(chars.map { $0 == pick ? $0 : " " }).lowercased()
        guesses.append((word: word, tiles: tiles))
        if vowels { revealedVowel = String(pick) } else { revealedConsonant = String(pick) }
        // Web parity (handleVowelReveal/handleConsonantReveal): a hint row that
        // fills the board loses the game.
        if guesses.count >= maxGuesses, status == .playing { status = .lost; finish() }
        persist()
    }

    /// Share grid (rows of tile states), padded to maxGuesses — for the share card.
    func shareGrid() -> [[TileState]] {
        let map: (NTile) -> TileState = {
            switch $0 {
            case .correct: return .correct
            case .present: return .present
            case .absent: return .absent
            case .hintUsed: return .hintUsed
            case .empty: return .empty
            }
        }
        var rows = guesses.map { $0.tiles.map(map) }
        while rows.count < maxGuesses { rows.append(Array(repeating: .empty, count: answerLen)) }
        return rows
    }

    /// Letter grid matching shareGrid row-for-row ('' pads empty rows) — only
    /// consumed by the "Full results" share variant. Guess words are stored
    /// normalized (spaces/diacritics stripped), one letter per tile.
    func shareLetters() -> [[String]] {
        var rows: [[String]] = guesses.map { g in
            Array(ProperNoundle.normalize(g.word).uppercased()).map(String.init)
        }
        while rows.count < maxGuesses { rows.append(Array(repeating: "", count: answerLen)) }
        return rows
    }

    private func finish() {
        finalTimeSeconds = elapsed
        if status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.soft(); SoundManager.shared.playGameOver() }
        // VS: relay completion to the match; the VS view model records the
        // vs result, so skip the solo recording below.
        if isVersus { onCompleted?(status, guesses.count); return }
        guard !recorded else { return }; recorded = true
        // Unlimited (Pro Play Again) games carry their own seed — recording them
        // under the DAILY seed put random puzzles on the daily leaderboard and
        // corrupted cross-device replay of the real daily (web parity: only
        // daily mode uses the daily seed).
        let seed = isDaily
            ? generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: GameMode.propernoundle.rawValue)
            : (gameSeed ?? "unlimited-PROPERNOUNDLE-\(Int(Date().timeIntervalSince1970))")
        let won = status == .won, secs = elapsed, gc = guesses.count, used = hintsUsed
        let answer = puzzle.map { ProperNoundle.normalize($0.answer) } ?? ""
        let guessWords = guesses.map { $0.word }
        // Near-miss credit on a loss: best green count in any guess (.hintUsed
        // tiles are not .correct, so they don't inflate it).
        let bestCorrect = guesses.reduce(0) { max($0, $1.tiles.filter { $0 == .correct }.count) }
        Task {
            let xp = await GameResultsService.record(gameMode: .propernoundle, won: won, guessCount: gc,
                                                     timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                                     seed: seed, hintsUsed: used,
                                                     bestCorrectLetters: bestCorrect)
            await MainActor.run { self.xpResult = xp }   // post-game XP toast (web parity)
            // Match-history row (powers charts + the pure_proper hintless ladder).
            await GameResultsService.recordSoloMatch(gameMode: .propernoundle, won: won, score: gc,
                                                     timeSeconds: secs, seed: seed, solutions: [answer],
                                                     guesses: guessWords, hintsUsed: used)
            if let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() {
                await AchievementService.checkAchievements(
                    userId: uid, gameMode: GameMode.propernoundle.rawValue, playType: "solo", won: won,
                    guessCount: gc, timeSeconds: secs, seed: seed, hintsUsed: used)
            }
        }
    }

    private func flash(_ m: String) {
        toast = m
        Task { try? await Task.sleep(nanoseconds: 1_400_000_000); if toast == m { toast = nil } }
    }
}

struct ProperNoundleView: View {
    @StateObject private var vm: ProperNoundleVM
    /// Pro Unlimited "Play Again" — HomeView swaps in a fresh non-daily seed.
    var onPlayAgain: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showVictory = false
    @State private var showGuide = false
    /// The whole clue's soft-pop card (opens when the clue lands; "Read clue" reopens it).
    @State private var showFullClue = false
    @State private var showShareOptions = false
    /// The chooser's pick, consumed by the sheet's onDismiss (see ShareVariantSheet).
    @State private var shareReveal: Bool?

    init(seed: String? = nil, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: ProperNoundleVM(seed: seed))
        self.onPlayAgain = onPlayAgain
    }

    var body: some View {
        ZStack {
            PageBackground(tint: .forGame(.propernoundle))  // ART_SPEC §15 / §19: the game's wallpaper
            if vm.puzzle == nil {
                // §A7: the empty state gets its own character (O3 searching), not the host.
                // BI24: brand headline + voice line + Home candy, no bordered card.
                BrandEmptyState(title: "No puzzle yet", line: "I looked everywhere. Today's ProperNoundle is still on its way.",
                                scene: .notFound, artHeight: 130, actionTitle: "Home", actionSymbol: "house.fill",
                                action: { dismiss() })
            } else if vm.isFinished {
                // FINISH_SPEC §R2: one screen — header + the answer + result strip, the
                // board scaled to the height left, the dock; the photo, the full clue
                // and the breakdown sit below the dock.
                FinishedScreenLayout {
                    VStack(spacing: 4) { finishedHeader; resultHeadline }
                } board: { size in
                    NoundleBoard(vm: vm, width: size.width, height: size.height, tray: true)
                } dock: {
                    PuzFinishedDock(isDaily: vm.isDaily, currentMode: "PROPERNOUNDLE", game: "ProperNoundle",
                                    onNewPuzzle: (onPlayAgain != nil && !vm.isDaily && !vm.isVersus && AuthService.shared.isProActive)
                                        ? { onPlayAgain?() } : nil,
                                    onOtherGames: { dismiss() },
                                    showNextDaily: !vm.isVersus,
                                    onShare: { _ in showShareOptions = true })
                        .softSheet(isPresented: $showShareOptions,
                               onDismiss: { if let r = shareReveal { shareReveal = nil; shareResult(reveal: r) } }) {
                            ShareVariantSheet(selection: $shareReveal).presentationDetents([.height(260)])
                        }
                } extras: {
                    result
                }
                .padding(.horizontal, 10)
            } else {
                VStack(spacing: 8) {
                    header
                    // §B5: the board fills the space between the header and the hints.
                    GeometryReader { g in
                        NoundleBoard(vm: vm, width: g.size.width, height: g.size.height, tray: true)
                            .frame(width: g.size.width, height: g.size.height)
                    }
                    .padding(.vertical, 4)
                    // // §BI9: the feedback popup hangs from the line under the board — never over the title art or the board.
                    hints.gameFeedbackToast(vm.toast, alignment: .top); NoundleKeyboard(vm: vm).padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            // Post-game XP toast (web parity — ProperNoundle was the one mode
            // that never showed it).
            if let xp = vm.xpResult {
                XpToastView(result: xp) { vm.xpResult = nil }
            }
            if showVictory, let p = vm.puzzle {
                VictoryOverlay(
                    won: vm.status == .won, guesses: vm.guesses.count, maxGuesses: vm.maxGuesses,
                    timeSeconds: vm.finalTimeSeconds ?? vm.elapsed, boardsSolved: vm.status == .won ? 1 : 0,
                    totalBoards: 1, solution: p.display, solutions: [],
                    showDefinition: false,   // proper noun — no dictionary definition (the clue/photo stands in)
                    points: Int(DailyScoring.breakdown(gameMode: GameMode.propernoundle.rawValue, completed: vm.status == .won,
                                                       guessCount: vm.guesses.count, timeSeconds: vm.finalTimeSeconds ?? vm.elapsed,
                                                       boardsSolved: vm.status == .won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                                                       bestCorrectLetters: vm.guesses.reduce(0) { max($0, $1.tiles.filter { $0 == .correct }.count) },
                                                       dateKey: vm.isDaily ? LeaderboardService.todayLocal() : nil).total),
                    // §242: same non-daily + Pro gate as the finished screen's
                    // Play Again (line below the puzzle meta).
                    onPlayAgain: (onPlayAgain != nil && !vm.isDaily && !vm.isVersus && AuthService.shared.isProActive)
                        ? { showVictory = false; onPlayAgain?() }
                        : nil,
                    game: .propernoundle,
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showVictory = false } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))   // web fade-in-scale 0.8→1.0
            }
            // Corner Home button — matches the web GameHomeButton (red accent) and
            // every other game's screen, in play and on the completed screen.
            GameCornerButton(kind: .home) { dismiss() }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)

            // Help "?" button (top-right) — opens ProperNoundle's guide.
            GameCornerButton(kind: .help) { showGuide = true }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
            .softSheet(isPresented: $showGuide) { GuideSheet(mode: .propernoundle) }
            .firstPlayGuide(mode: .propernoundle, show: $showGuide)
        }
        // The whole clue's soft-pop card, hung under the title art (Johnny 10-05).
        .noundleFullClue(vm.isFinished ? nil : vm.clue, isPresented: $showFullClue)
        // The clue opens as soon as it lands (a restored session's clue doesn't pop).
        .onChange(of: vm.clue) { c in if c != nil, !vm.isFinished { showFullClue = true } }
        #if DEBUG
        .onPerfTour { c in
            guard case .noundleClue(let open) = c else { return }
            if !open { showFullClue = false } else if vm.clue == nil { vm.revealClue() } else { showFullClue = true }
        }
        #endif
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: showGuide) { open in if open { vm.pauseForGuide() } else { vm.resumeFromGuide() } }
        .onChange(of: scenePhase) { vm.setBackground($0 != .active) }
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(.propernoundle))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity("PROPERNOUNDLE")
        // Left-edge swipe → back to Home (parity with the web back gesture).
        .swipeToGoBack { dismiss() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .onChange(of: vm.status) { s in
            if s == .won || s == .lost { withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showVictory = true } }
            // High-point review ask: solo WIN path only (restored finished
            // sessions set status in init, so this never re-fires for them).
            if s == .won, !vm.isVersus { RatingsPrompt.recordWin(); RatingsPrompt.maybeAsk() }
        }
        .onAppear {
            // Free users watch the game-start ad first; reset the clock after.
            if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.beginTimer() } }
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("PROPERNOUNDLE").font(Brand.font(24, .black)).foregroundStyle(pnAccent)
                .lineLimit(1).minimumScaleFactor(0.7).soloGameTitle(.propernoundle)
            HStack(spacing: 8) {
                if let p = vm.puzzle {
                    Text(categoryLabel(p.themeCategory))
                        .font(Brand.caption(11)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(categoryColors[p.themeCategory ?? ""] ?? Color(hex: 0x7C3AED)))
                }
                // Daily puzzle number (web parity — "#{getDailyPuzzleNumber()}" when daily).
                if vm.isDaily {
                    Text("#\(ProperNoundle.dailyPuzzleNumber())").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                }
                Text("\(vm.answerLen) letters").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                if !vm.isFinished {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 2) {
                            Image(systemName: "clock").font(.system(size: 9))
                            Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))").monospacedDigit()
                        }
                        .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
            // FINISH_SPEC §Z: today's holiday line keeps its slot in Unlimited too
            // (empty there), so the board never shifts between the modes.
            if !vm.isVersus, let holiday = HolidayTitles.title(ProperNoundle.dailyHolidayKey()) {
                let shows = GameHeaderLayout.slots(mode: vm.isDaily ? .daily : .unlimited, offersPicker: false).showsHolidayLine
                Text(holiday).font(Brand.caption(12)).foregroundStyle(pnAccent)
                    .opacity(shows ? 1 : 0).accessibilityHidden(!shows)
            }
        }
        // Founder 10-05 ("always fix empty space issues"): no clue band under the header. The
        // whole clue opens as a card hung from the header's bottom edge — on its own when the
        // Clue hint lands, then from the Clue pill ("Read clue") — so the board keeps the room.
        .anchorPreference(key: NoundleClueAnchor.self, value: .bounds) { $0 }
    }

    private var hints: some View { NoundleHints(vm: vm, onShowClue: { showFullClue = true }) }

    /// Founder 10-02: the FINISHED screen's compact header. The solo header's title
    /// art (120 pt) plus the clue overflowed the finished page and collided with the
    /// "+N XP" toast; here the art takes the same cap as every other finished screen
    /// (68 pt, 52 on short phones) between the corner controls, with the category /
    /// number line. The full clue sits below the dock (`result`).
    private var finishedHeader: some View {
        VStack(spacing: 4) {
            Group {
                if let art = GameTitleArt.forMode(.propernoundle) {
                    GameTitleArtView(asset: art.asset, label: art.label,
                                     maxHeight: UIScreen.main.bounds.height < 700 ? 52 : 68, minHeight: 36)
                } else {
                    Text("PROPERNOUNDLE").font(Brand.font(24, .black)).foregroundStyle(pnAccent)
                        .lineLimit(1).minimumScaleFactor(0.6)
                }
            }
            .padding(.horizontal, 54)
            .padding(.top, 4)
            HStack(spacing: 8) {
                if let p = vm.puzzle {
                    Text(categoryLabel(p.themeCategory))
                        .font(Brand.caption(11)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(categoryColors[p.themeCategory ?? ""] ?? Color(hex: 0x7C3AED)))
                }
                if vm.isDaily {
                    Text("#\(ProperNoundle.dailyPuzzleNumber())").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                }
                Text("\(vm.answerLen) letters").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            }
        }
    }

    /// §R2: the answer + the compact one-line result strip.
    private var resultHeadline: some View {
        let won = vm.status == .won
        let secs = vm.finalTimeSeconds ?? vm.elapsed
        return VStack(spacing: 6) {
            if let p = vm.puzzle {
                PuzFinishedHeadline(text: won ? p.display : "The answer was: \(p.display)", won: won)
            }
            PuzResultLine(won: won, items: [("\(vm.guesses.count)/\(vm.maxGuesses)", "guesses"), (puzClock(secs), "time")],
                                points: points)
        }
    }

    private var points: Int {
        Int(DailyScoring.breakdown(gameMode: GameMode.propernoundle.rawValue, completed: vm.status == .won,
                                   guessCount: vm.guesses.count, timeSeconds: vm.finalTimeSeconds ?? vm.elapsed,
                                   boardsSolved: vm.status == .won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                                   bestCorrectLetters: vm.guesses.reduce(0) { max($0, $1.tiles.filter { $0 == .correct }.count) },
                                   dateKey: vm.isDaily ? LeaderboardService.todayLocal() : nil).total)
    }

    /// Below the dock (§R2): the photo, the full clue, the daily rank and the breakdown.
    private var result: some View {
        let secs = vm.finalTimeSeconds ?? vm.elapsed
        return VStack(spacing: 10) {
            // Wikipedia photo of the answer (web parity). Whole image, no crop
            // (founder, Aug 11): .fill in a 64pt square beheaded portrait
            // engravings — fit within 160pt so the full picture shows.
            if let urlStr = vm.wikiImageURL, let url = URL(string: urlStr) {
                AsyncImage(url: url) { img in img.resizable().scaledToFit() }
                    placeholder: { RoundedRectangle(cornerRadius: 12, style: .continuous).fill(PuzKit.face(pnAccent, 0.12)).frame(width: 96, height: 96) }
                    .frame(maxWidth: 160, maxHeight: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(vm.status == .won ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626), lineWidth: 2))
            }
            // Web parity: win → "Solved in N guesses · time" (the name sits in the header).
            if vm.status == .won {
                Text("Solved in \(vm.guesses.count) \(vm.guesses.count == 1 ? "guess" : "guesses") · \(pnTime(secs))")
                    .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .tintedPill(pnAccent)
            }
            // Full Wikipedia clue (un-redacted) — doubles as the definition.
            if let clue = vm.resultClue {
                // §A1: the definition stand-in on a tinted card.
                Text(clue)
                    .font(Brand.font(12, .medium)).foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .frame(maxWidth: .infinity)
                    .tintedCard(accent: pnAccent, bar: [pnAccent, Color(hex: 0xFB923C)], radius: 16, barHeight: 6)
                    .padding(.horizontal, 10).padding(.top, 2)
            }
            DailyRankBadge(gameMode: .propernoundle)
            ScoreBreakdownView(gameMode: GameMode.propernoundle.rawValue, completed: vm.status == .won,
                               guessCount: vm.guesses.count, timeSeconds: secs,
                               boardsSolved: vm.status == .won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed,
                               bestCorrectLetters: vm.guesses.reduce(0) { max($0, $1.tiles.filter { $0 == .correct }.count) },
                               day: vm.isDaily ? LeaderboardService.todayLocal() : nil)
        }
        .padding(.vertical, 12)
        .task { await vm.loadWikiImage(); await vm.loadResultClue() }
    }

    /// Web PN formatTime: "m:ss" at ≥1 minute, otherwise "Ns".
    private func pnTime(_ s: Int) -> String {
        s >= 60 ? "\(s / 60):\(String(format: "%02d", s % 60))" : "\(s)s"
    }

    private func shareResult(reveal: Bool = false) {
        // User picked a chooser variant: Full results → image, No spoilers → text.
        ShareEvents.log(kind: reveal ? "image" : "text",
                        gameMode: GameMode.propernoundle.rawValue, surface: "post_game")
        // Category pill + multi-word name gaps in the share image (web parity).
        let p = vm.puzzle
        ShareService.share(kind: .single(grid: vm.shareGrid()), mode: .propernoundle,
                           modeLabel: "PROPERNOUNDLE", accent: pnAccent, won: vm.status == .won,
                           guesses: vm.guesses.count, maxGuesses: vm.maxGuesses,
                           timeSeconds: vm.finalTimeSeconds ?? vm.elapsed,
                           category: p.map { categoryLabel($0.themeCategory) },
                           wordGroups: p.map { ProperNoundle.wordGroups($0.display) },
                           reveal: reveal,
                           letters: vm.shareLetters(),
                           solutionDisplay: p?.display)
    }
}

/// Clue / Vowel / Consonant hint row — shared by the solo screen and the VS
/// board (web shows hints in both). Buttons disable + gray out once used.
struct NoundleHints: View {
    @ObservedObject var vm: ProperNoundleVM
    /// Opens the whole-clue card: once the Clue hint is used its pill becomes "Read clue"
    /// (the clue has no band of its own on the play screen).
    var onShowClue: (() -> Void)? = nil
    var body: some View {
        HStack(spacing: 8) {
            if vm.clue != nil, let onShowClue {
                hintButton("Read clue", systemImage: "book.fill", used: false, variant: .amber) { onShowClue() }
            } else {
                hintButton("Clue", systemImage: vm.loadingClue ? "hourglass" : "lightbulb", used: vm.clue != nil || vm.loadingClue,
                           variant: .amber) { vm.revealClue() }
            }
            hintButton(vm.revealedVowel.map { $0 } ?? "Vowel", systemImage: "eye", used: vm.revealedVowel != nil,
                       variant: .pink) { vm.revealVowel() }
            hintButton(vm.revealedConsonant.map { $0 } ?? "Consonant", systemImage: "number", used: vm.revealedConsonant != nil,
                       variant: .teal) { vm.revealConsonant() }
        }
        .frame(maxWidth: 420)
        .padding(.bottom, 4)
    }

    /// §A8: small candy pills (amber Clue, pink Vowel, teal Consonant); a used
    /// hint disables (the candy fades) and shows the revealed letter.
    private func hintButton(_ label: String, systemImage: String, used: Bool,
                            variant: CandyButtonStyle.Variant, action: @escaping () -> Void) -> some View {
        // §BI22: equal thirds — "Vowel" → "A" never resizes a pill or nudges the others.
        Button(action: action) { CandyLabel(title: label, symbol: systemImage).frame(maxWidth: .infinity) }
            .buttonStyle(CandyButtonStyle(variant: variant, size: .small))
            .accessibilityLabel(label)
            .disabled(used)
    }
}

/// The header's bounds: the full-clue card hangs from its bottom edge (read by `noundleFullClue`).
struct NoundleClueAnchor: PreferenceKey {
    static var defaultValue: Anchor<CGRect>? = nil
    static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) { value = value ?? nextValue() }
}

extension View {
    /// The whole clue as a soft-pop card over the board: its top edge is just under the
    /// header (so the title art and the category line stay clear), full width with 14 pt
    /// margins, a readable 16 pt, scrolling when a clue outgrows the space down to the
    /// screen's bottom. Tap outside or the X closes it. Apply on the game's root.
    func noundleFullClue(_ clue: String?, isPresented: Binding<Bool>) -> some View {
        overlayPreferenceValue(NoundleClueAnchor.self) { anchor in
            GeometryReader { g in
                if isPresented.wrappedValue, let clue, let anchor {
                    let top = max(0, g[anchor].maxY + 6)
                    ZStack(alignment: .top) {
                        Color.black.opacity(0.22).ignoresSafeArea()
                            .contentShape(Rectangle())
                            .onTapGesture { isPresented.wrappedValue = false }
                            .accessibilityLabel("Close")
                            .accessibilityAddTraits(.isButton)
                            .transition(.opacity)
                        NoundleFullClueCard(clue: clue, maxHeight: max(160, g.size.height - top - 16)) {
                            isPresented.wrappedValue = false
                        }
                        .frame(width: min(460, g.size.width - 28))
                        .padding(.top, top)
                        .transition(SoftPop.transition)
                        .accessibilityAddTraits(.isModal)
                    }
                    .frame(width: g.size.width, height: g.size.height, alignment: .top)
                }
            }
            .animation(Theme.animation(SoftPop.animation), value: isPresented.wrappedValue)
        }
    }
}

/// The full clue: the app's soft card (no outline), the game's red CLUE label with a close X
/// (Android ProperNoundleClueOverlay / web clue-slot parity),
/// the clue in 16 pt; a very long clue scrolls inside the card instead of clipping.
private struct NoundleFullClueCard: View {
    let clue: String
    let maxHeight: CGFloat
    let close: () -> Void


    var body: some View {
        // The card hugs the clue; only a clue taller than the room down to the screen's
        // bottom gets the scrolling version (which takes exactly that room).
        ViewThatFits(in: .vertical) {
            card { clueText(clue) }
            card { ScrollView(showsIndicators: true) { clueText(clue) } }
        }
        .frame(height: maxHeight, alignment: .top)
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill").font(.system(size: 13, weight: .bold))
                Text("CLUE").font(Brand.font(13, .black)).tracking(1.2)
                Spacer(minLength: 0)
                HeaderCircleButton(.symbol("xmark"), size: 30, tint: FinishInk.muted, label: "Close") { close() }
            }
            .foregroundStyle(pnAccent)
            content()
        }
        .padding(.leading, 18).padding(.trailing, 10).padding(.top, 8).padding(.bottom, 16)
        .background(shape.fill(Color(hex: 0xFDF0EF)))   // the clue wash: 8% red on the card
        .clipShape(shape)
        .shadow(color: Color(hex: 0x280F50).opacity(0.30), radius: 18, x: 0, y: 14)
        .contentShape(shape)
        .onTapGesture {}
    }

    private func clueText(_ text: String) -> some View {
        Text(text).font(Brand.body(16)).italic().foregroundStyle(FinishInk.title)
            .lineSpacing(3)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, 8)
            .accessibilityLabel("Clue: \(text)")
    }
}

/// Word-group tile board for ProperNoundle.
struct NoundleBoard: View {
    @ObservedObject var vm: ProperNoundleVM
    /// The area the board may fill (FINISH_SPEC §B5, the shared `BoardSizing`
    /// rule): the screen's content width by default; in play, also the height
    /// left between the header and the hints / keyboard.
    var width: CGFloat = UIScreen.main.bounds.width - 20
    var height: CGFloat? = nil
    /// §L: sit the rows on the shared game tray (its padding + lip come out of
    /// the area first).
    var tray = false

    var body: some View {
        let pad: CGFloat = tray ? GameTray.padding * 2 : 0
        let lip: CGFloat = tray ? GameTray.lip : 0
        let width = self.width - pad / CGFloat(BoardSizing.widthFill)
        let height = self.height.map { $0 - (pad + lip) / CGFloat(BoardSizing.heightFill) }
        let groups = vm.puzzle.map { ProperNoundle.wordGroups($0.display) } ?? [vm.answerLen]
        let total = groups.reduce(0, +)
        let gap: CGFloat = 4, groupGap: CGFloat = 14
        let rows = max(1, vm.maxGuesses)
        // The widest tile the row allows; then fillRows spends the spare height (taller tiles
        // up to 1.5:1, then roomier rows) so a long answer leaves no dead band (2026-10-05).
        let tileW = floor(CGFloat(BoardSizing.fitTile(
            widthUnits: Double(max(1, total)),
            fixedWidth: Double(gap * CGFloat(max(0, total - groups.count)) + groupGap * CGFloat(max(0, groups.count - 1))),
            heightUnits: Double(rows), fixedHeight: 0,
            width: Double(width), height: nil, maxTile: 64)))
        let fit = BoardSizing.fillRows(tileWidth: Double(tileW), height: height.map(Double.init), rows: rows, gap: Double(gap))
        return VStack(spacing: CGFloat(fit.rowGap)) {
            ForEach(0..<vm.maxGuesses, id: \.self) { row in
                rowView(row, groups: groups, tile: CGFloat(fit.tileWidth), tileHeight: CGFloat(fit.tileHeight), gap: gap, groupGap: groupGap)
            }
        }
        .modifier(NoundleTrayChrome(on: tray, state: vm.isFinished ? (vm.status == .won ? .won : .lost) : .normal))
    }

    @ViewBuilder
    private func rowView(_ row: Int, groups: [Int], tile: CGFloat, tileHeight: CGFloat, gap: CGFloat, groupGap: CGFloat) -> some View {
        let committed = row < vm.guesses.count
        let isCurrent = row == vm.guesses.count && !vm.isFinished
        let letters: [Character] = committed ? Array(vm.guesses[row].word) : (isCurrent ? Array(vm.input) : [])
        let states: [NTile]? = committed ? vm.guesses[row].tiles : nil
        HStack(spacing: groupGap) {
            ForEach(0..<groups.count, id: \.self) { gi in
                let start = groups.prefix(gi).reduce(0, +)
                HStack(spacing: gap) {
                    ForEach(0..<groups[gi], id: \.self) { ci in
                        let idx = start + ci
                        let ch = idx < letters.count ? String(letters[idx]).uppercased() : ""
                        let st = states != nil && idx < states!.count ? states![idx] : .empty
                        nTile(ch, st, size: tile, height: tileHeight)
                    }
                }
            }
        }
    }

    /// FINISH_SPEC §B1: the same glossy tiles as every word game.
    private func nTile(_ letter: String, _ state: NTile, size: CGFloat, height: CGFloat) -> some View {
        let face: GlossyFace = {
            switch state {
            case .correct: return .correct
            case .present: return .present
            case .absent: return .absent
            case .hintUsed: return .hintUsed
            case .empty: return letter.isEmpty ? .empty : .typed
            }
        }()
        return GlossyTile(face: face, letter: letter, width: size, height: height)
            .modifier(TypePop(letter: state == .empty ? letter : "", size: CGSize(width: size, height: height)))
    }
}

/// QWERTY keyboard for ProperNoundle (per-key color from guesses).
struct NoundleKeyboard: View {
    @ObservedObject var vm: ProperNoundleVM
    // §213: honors the same layout pref as KeyboardView — this bespoke copy
    // had also missed the §208 swap (delete was still bottom-LEFT here).
    @AppStorage("pref-keyboard-layout") private var layout = "standard"
    private let rows: [[String]] = ["QWERTYUIOP".map { String($0) }, "ASDFGHJKL".map { String($0) }, "ZXCVBNM".map { String($0) }]

    private var keyHeight: CGFloat { layout == "michael" ? 44 : 52 }

    var body: some View {
        VStack(spacing: 7) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 5) {
                    if r == 2 {
                        switch layout {
                        case "flipped", "michael": deleteKey()
                        default: enterKey()
                        }
                    }
                    ForEach(rows[r], id: \.self) { key in letterKey(key) }
                    if r == 2 {
                        switch layout {
                        case "flipped": enterKey()
                        default: deleteKey()
                        }
                    }
                }
            }
            if layout == "michael" {
                HStack(spacing: 5) {
                    enterKey()
                    spaceKey()
                    enterKey()
                }
            }
        }
        .padding(.horizontal, 4)
        // Physical keyboard (founder, 2026-09-30) — web propernoundle-game
        // keydown: Enter / Backspace / A–Z, same actions as the keys above.
        .hardwareKeyboard(enabled: !vm.isFinished) { key in
            switch key {
            case .enter: vm.submit()
            case .delete: vm.delete(); SoundManager.shared.playDelete(); return true
            case .letter(let l): vm.type(l)
            default: return false
            }
            SoundManager.shared.playKeyTap()
            return true
        }
    }

    private func enterKey() -> some View {
        action("ENTER") { vm.submit(); Haptics.tap(); SoundManager.shared.playKeyTap() }
    }

    private func deleteKey() -> some View {
        iconAction("delete.left") { vm.delete(); Haptics.tap(); SoundManager.shared.playDelete() }
    }

    private func spaceKey() -> some View {
        Button { Haptics.tap(); SoundManager.shared.playKeyTap() } label: {
            KeyCap(state: nil, height: keyHeight) { Text("space").font(Brand.font(12, .heavy)) }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel("Space (decorative)")
    }

    /// FINISH_SPEC §B2: the same key tiles as every word game.
    private func letterKey(_ l: String) -> some View {
        // Map ProperNoundle's NTile to the engine TileState for the shared key palette.
        let st: TileState? = vm.keyState(l).flatMap { n in
            switch n {
            case .correct: return .correct
            case .present: return .present
            case .hintUsed: return .hintUsed
            case .absent: return .absent
            case .empty: return nil
            }
        }
        return Button { vm.type(l); Haptics.tap(); SoundManager.shared.playKeyTap() } label: {
            KeyCap(state: st, height: keyHeight) { Text(l).font(Brand.font(18, .black)) }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(l)
        .accessibilityValue(st?.a11yName ?? "")
    }

    private func action(_ label: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            KeyCap(state: nil, height: keyHeight, width: 54) {
                Text(label).font(Brand.font(12, .black)).tracking(0.5)
            }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(label == "ENTER" ? "Submit guess" : label)
    }

    private func iconAction(_ systemName: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            KeyCap(state: nil, height: keyHeight, width: 54) { DeleteKeyIcon(width: 30) }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel("Delete")
    }
}

/// ProperNoundle for the VS match screen (VS polish spec §1): the SOLO play
/// surface — the solo header (title in red, category chip, letters, clock,
/// clue) with a small teal VS pill, then the opponent strip slot, then the
/// solo NoundleBoard / hints row / NoundleKeyboard with the solo spacing.
/// Drives a ProperNoundleVM (built by VSMatchViewModel with isVersus = true)
/// that relays each guess + completion to the live match.
struct ProperNoundleVSBoard<Strip: View>: View {
    @ObservedObject var vm: ProperNoundleVM
    let onHome: () -> Void
    @ViewBuilder var strip: () -> Strip
    /// The whole clue's soft-pop card (opens when the clue lands; "Read clue" reopens it).
    @State private var showFullClue = false

    var body: some View {
        VStack(spacing: 8) {
            HStack(alignment: .top, spacing: 4) {
                VSGameHomeButton(accent: ModeStyle.accent(.propernoundle), action: onHome)
                Spacer(minLength: 0)
                // ART_SPEC §14: the title art takes the whole width between the corners.
                header.layoutPriority(1)
                Spacer(minLength: 0)
                Color.clear.frame(width: 44, height: 44)
            }
            strip()
            GeometryReader { g in
                NoundleBoard(vm: vm, width: g.size.width, height: g.size.height, tray: true)
                    .frame(width: g.size.width, height: g.size.height)
            }
            .padding(.vertical, 4)
            // §BI22: the hint row keeps its slot at the finish (faded, inert) so the
            // board doesn't jump as the final row lands.
            NoundleHints(vm: vm, onShowClue: { showFullClue = true })
                .opacity(vm.isFinished ? 0 : 1)
                .allowsHitTesting(!vm.isFinished)
                .accessibilityHidden(vm.isFinished)
            // §BI9: the VS bounced-guess candy toast hangs from the keyboard, never over the board.
            NoundleKeyboard(vm: vm).padding(.bottom, 6).gameFeedbackToast(vm.toast, alignment: .top)
        }
        .padding(.horizontal, 10)
        .noundleFullClue(vm.clue, isPresented: $showFullClue)
        .onChange(of: vm.clue) { c in if c != nil, !vm.isFinished { showFullClue = true } }
    }

    /// The solo ProperNoundleView header (minus the daily-only number/holiday).
    private var header: some View {
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                Text("PROPERNOUNDLE").font(Brand.font(24, .black)).foregroundStyle(pnAccent)
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .gameTitleArt(.propernoundle)
                VSTagPill()
            }
            HStack(spacing: 8) {
                if let p = vm.puzzle {
                    Text(categoryLabel(p.themeCategory))
                        .font(Brand.caption(11)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(categoryColors[p.themeCategory ?? ""] ?? Color(hex: 0x7C3AED)))
                }
                Text("\(vm.answerLen) letters").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                if !vm.isFinished {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 2) {
                            Image(systemName: "clock").font(.system(size: 9))
                            Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))").monospacedDigit()
                        }
                        .font(Brand.caption(12)).foregroundStyle(Theme.textMuted).monospacedDigit()
                    }
                }
            }
        }
        .padding(.top, 6)
        // No clue band: the card hangs from here (the solo header's rule).
        .anchorPreference(key: NoundleClueAnchor.self, value: .bounds) { $0 }
    }
}

/// §L: the ProperNoundle rows on the shared game tray (opt-in).
private struct NoundleTrayChrome: ViewModifier {
    let on: Bool
    let state: GameTrayState

    @ViewBuilder
    func body(content: Content) -> some View {
        if on { content.gameTray(accent: pnAccent, state: state) } else { content }
    }
}
