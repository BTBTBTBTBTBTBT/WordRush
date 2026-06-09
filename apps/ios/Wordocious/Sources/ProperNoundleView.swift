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

    /// Fetch the answer's Wikipedia photo for the result screen (web parity).
    func loadWikiImage() async {
        guard wikiImageURL == nil, let p = puzzle else { return }
        wikiImageURL = await WikipediaHint.fetchImageURL(displayName: p.display, wikiTitle: p.wikiTitle)
    }

    private var startMs = Date().timeIntervalSince1970 * 1000
    /// Reset the clock so the game-start ad's time isn't counted.
    func beginTimer() { startMs = Date().timeIntervalSince1970 * 1000 }
    private var recorded = false
    var answerLen: Int { puzzle.map { ProperNoundle.normalize($0.answer).count } ?? 0 }
    var maxGuesses: Int { ProperNoundle.maxGuesses }
    var isFinished: Bool { status != .playing }
    var hintsUsed: Int { [clue, revealedVowel, revealedConsonant].compactMap { $0 }.count }
    var elapsed: Int { finalTimeSeconds ?? max(0, Int((Date().timeIntervalSince1970 * 1000 - startMs) / 1000)) }

    // VS hooks (set by VSMatchViewModel when this drives a VS match).
    let isVersus: Bool
    var onGuessCommitted: ((String) -> Void)?
    var onCompleted: ((GameStatus, Int) -> Void)?

    /// Solo → today's daily puzzle. VS → a deterministic puzzle from the match
    /// seed so both players get the same one.
    init(seed: String? = nil, isVersus: Bool = false) {
        self.isVersus = isVersus
        puzzle = seed.flatMap { ProperNoundle.puzzle(forSeed: $0) } ?? ProperNoundle.dailyPuzzle()
    }

    func type(_ l: String) { guard !isFinished, input.count < answerLen else { return }; input += l.lowercased() }
    func delete() { if !input.isEmpty { input.removeLast() } }

    func submit() {
        guard !isFinished, let p = puzzle else { return }
        guard input.count == answerLen else { flash("Not enough letters"); SoundManager.shared.playInvalid(); return }
        let word = input
        let tiles = ProperNoundle.evaluate(guess: word, answer: p.answer)
        guesses.append((word, tiles)); input = ""
        onGuessCommitted?(word)
        if ProperNoundle.isWin(tiles) { status = .won; finish() }
        else if guesses.count >= maxGuesses { status = .lost; finish() }
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
    func revealClue() {
        guard clue == nil, !loadingClue, let p = puzzle else { return }
        loadingClue = true
        Task {
            let fetched = await WikipediaHint.fetch(displayName: p.display, wikiTitle: p.wikiTitle)
            self.clue = fetched ?? p.hint ?? "Category: \(categoryLabel(p.themeCategory))"
            self.loadingClue = false
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
        let pool = Set(chars.filter { c in c >= "A" && c <= "Z" && (vowels ? vset.contains(c) : !vset.contains(c)) })
        guard let pick = pool.randomElement() else {
            if vowels { revealedVowel = "None" } else { revealedConsonant = "None" }
            return
        }
        let tiles: [NTile] = chars.map { $0 == pick ? .correct : .hintUsed }
        let word = String(chars.map { $0 == pick ? $0 : " " }).lowercased()
        guesses.append((word: word, tiles: tiles))
        if vowels { revealedVowel = String(pick) } else { revealedConsonant = String(pick) }
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

    private func finish() {
        finalTimeSeconds = elapsed
        if status == .won { Haptics.success(); SoundManager.shared.playSuccess() }
        else { Haptics.error(); SoundManager.shared.playGameOver() }
        // VS: relay completion to the match; the VS view model records the
        // vs result, so skip the solo recording below.
        if isVersus { onCompleted?(status, guesses.count); return }
        guard !recorded else { return }; recorded = true
        let seed = generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: GameMode.propernoundle.rawValue)
        let won = status == .won, secs = elapsed, gc = guesses.count, used = hintsUsed
        let answer = puzzle.map { ProperNoundle.normalize($0.answer) } ?? ""
        let guessWords = guesses.map { $0.word }
        Task {
            await GameResultsService.record(gameMode: .propernoundle, won: won, guessCount: gc,
                                            timeSeconds: secs, boardsSolved: won ? 1 : 0, totalBoards: 1,
                                            seed: seed, hintsUsed: used)
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
    @StateObject private var vm = ProperNoundleVM()
    @Environment(\.dismiss) private var dismiss
    @State private var adShown = false
    @State private var showVictory = false

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if vm.puzzle == nil {
                Text("No puzzle available").foregroundStyle(Theme.textMuted)
            } else if vm.isFinished {
                ScrollView { VStack(spacing: 8) { header; NoundleBoard(vm: vm); result }.padding(.horizontal, 10) }
            } else {
                VStack(spacing: 8) {
                    header
                    Spacer(minLength: 4)
                    NoundleBoard(vm: vm)
                    Spacer(minLength: 4)
                    hints; NoundleKeyboard(vm: vm).padding(.bottom, 6)
                }
                .padding(.horizontal, 10)
            }
            if let toast = vm.toast {
                Text(toast).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
                    .padding(.top, 100).frame(maxHeight: .infinity, alignment: .top)
            }
            if showVictory, let p = vm.puzzle {
                VictoryOverlay(
                    won: vm.status == .won, guesses: vm.guesses.count, maxGuesses: vm.maxGuesses,
                    timeSeconds: vm.finalTimeSeconds ?? vm.elapsed, boardsSolved: vm.status == .won ? 1 : 0,
                    totalBoards: 1, solution: p.display, solutions: [],
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.2))) { showVictory = false } })
                .transition(.opacity)
            }
            // Corner Home button — matches the web GameHomeButton (red accent) and
            // every other game's screen, in play and on the completed screen.
            Button { dismiss() } label: {
                Image(systemName: "house.fill").font(.system(size: 20)).foregroundStyle(ModeStyle.accent(.propernoundle))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(ModeStyle.accent(.propernoundle), lineWidth: 2))
                    .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, 8).padding(.leading, 8)
        }
        .navigationBarTitleDisplayMode(.inline)
        .hidesBottomNav()
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .onChange(of: vm.status) { s in
            if s == .won || s == .lost { withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showVictory = true } }
        }
        .onAppear {
            // Free users watch the game-start ad first; reset the clock after.
            if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.beginTimer() } }
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("PROPERNOUNDLE").font(Brand.font(24, .black)).foregroundStyle(pnAccent)
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
                            Text("\(vm.elapsed / 60):\(String(format: "%02d", vm.elapsed % 60))")
                        }
                        .font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
            if let clue = vm.clue {
                Text(clue).font(Brand.body(12)).foregroundStyle(Theme.textSecondary).italic()
                    .multilineTextAlignment(.center).padding(.horizontal, 20)
            }
        }
        .padding(.top, 6)
    }

    private var hints: some View { NoundleHints(vm: vm) }

    private var result: some View {
        let secs = vm.finalTimeSeconds ?? vm.elapsed
        return VStack(spacing: 10) {
            Text(vm.status == .won ? "🎉 Solved in \(vm.guesses.count) \(vm.guesses.count == 1 ? "guess" : "guesses")!" : "Out of guesses")
                .font(Brand.headline(18)).foregroundStyle(Theme.textPrimary)
            // Wikipedia photo of the answer (web parity — result thumbnail).
            if let urlStr = vm.wikiImageURL, let url = URL(string: urlStr) {
                AsyncImage(url: url) { img in img.resizable().aspectRatio(contentMode: .fill) }
                    placeholder: { Color(hex: 0xE5E7EB) }
                    .frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(vm.status == .won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626), lineWidth: 2))
            }
            if let p = vm.puzzle { Text(p.display).font(Brand.title(20)).foregroundStyle(pnAccent) }
            // Home / Share row (web parity).
            HStack(spacing: 18) {
                Button { dismiss() } label: { Label("Home", systemImage: "house.fill").font(Brand.font(13, .black)) }
                Button { shareResult() } label: { Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(13, .black)) }
            }
            .foregroundStyle(pnAccent).padding(.top, 2)
            DailyRankBadge(gameMode: .propernoundle)
            ScoreBreakdownView(gameMode: GameMode.propernoundle.rawValue, completed: vm.status == .won,
                               guessCount: vm.guesses.count, timeSeconds: secs,
                               boardsSolved: vm.status == .won ? 1 : 0, totalBoards: 1, hintsUsed: vm.hintsUsed)
        }
        .padding(.vertical, 12)
        .task { await vm.loadWikiImage() }
    }

    private func shareResult() {
        ShareService.share(kind: .single(grid: vm.shareGrid()), mode: .propernoundle,
                           modeLabel: "ProperNoundle", accent: pnAccent, won: vm.status == .won,
                           guesses: vm.guesses.count, maxGuesses: vm.maxGuesses,
                           timeSeconds: vm.finalTimeSeconds ?? vm.elapsed)
    }
}

/// Clue / Vowel / Consonant hint row — shared by the solo screen and the VS
/// board (web shows hints in both). Buttons disable + grey out once used.
struct NoundleHints: View {
    @ObservedObject var vm: ProperNoundleVM
    var body: some View {
        HStack(spacing: 8) {
            hintButton("Clue", systemImage: vm.loadingClue ? "hourglass" : "lightbulb", used: vm.clue != nil || vm.loadingClue,
                       text: Color(hex: 0x9333EA), border: Color(hex: 0xD8B4FE), bg: Color(hex: 0xFAF5FF)) { vm.revealClue() }
            hintButton(vm.revealedVowel.map { $0 } ?? "Vowel", systemImage: "eye", used: vm.revealedVowel != nil,
                       text: Color(hex: 0x2563EB), border: Color(hex: 0x93C5FD), bg: Color(hex: 0xEFF6FF)) { vm.revealVowel() }
            hintButton(vm.revealedConsonant.map { $0 } ?? "Consonant", systemImage: "number", used: vm.revealedConsonant != nil,
                       text: Color(hex: 0x16A34A), border: Color(hex: 0x86EFAC), bg: Color(hex: 0xF0FDF4)) { vm.revealConsonant() }
        }
        .padding(.bottom, 4)
    }

    private func hintButton(_ label: String, systemImage: String, used: Bool,
                            text: Color, border: Color, bg: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: systemImage).font(Brand.font(11, .heavy))
                .foregroundStyle(used ? Color(hex: 0xD1D5DB) : text)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(Capsule().fill(used ? Color.clear : bg))
                .overlay(Capsule().stroke(used ? Color(hex: 0xE5E7EB) : border, lineWidth: 1.5))
        }
        .buttonStyle(.plain).disabled(used)
    }
}

/// Word-group tile board for ProperNoundle.
struct NoundleBoard: View {
    @ObservedObject var vm: ProperNoundleVM

    var body: some View {
        let groups = vm.puzzle.map { ProperNoundle.wordGroups($0.display) } ?? [vm.answerLen]
        let total = groups.reduce(0, +)
        let gap: CGFloat = 4, groupGap: CGFloat = 14
        let avail: CGFloat = 350
        let tile = min(40, floor((avail - gap * CGFloat(max(0, total - 1)) - groupGap * CGFloat(max(0, groups.count - 1))) / CGFloat(max(1, total))))
        return VStack(spacing: gap) {
            ForEach(0..<vm.maxGuesses, id: \.self) { row in
                rowView(row, groups: groups, tile: tile, gap: gap, groupGap: groupGap)
            }
        }
    }

    @ViewBuilder
    private func rowView(_ row: Int, groups: [Int], tile: CGFloat, gap: CGFloat, groupGap: CGFloat) -> some View {
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
                        nTile(ch, st, size: tile)
                    }
                }
            }
        }
    }

    private func nTile(_ letter: String, _ state: NTile, size: CGFloat) -> some View {
        let filled = state != .empty
        let color: Color = {
            switch state {
            case .correct: return Theme.correct
            case .present: return Theme.present
            case .absent: return Theme.absent
            case .hintUsed: return Color(hex: 0xD1D5DB) // web HINT_USED = gray
            case .empty: return .white
            }
        }()
        return Text(letter).font(Brand.font(size * 0.5, .heavy))
            .foregroundStyle(filled ? .white : Theme.textPrimary)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.14).fill(color))
            .overlay(RoundedRectangle(cornerRadius: size * 0.14).stroke(letter.isEmpty ? Theme.emptyBorder : Theme.textPrimary.opacity(0.25), lineWidth: 2))
    }
}

/// QWERTY keyboard for ProperNoundle (per-key colour from guesses).
struct NoundleKeyboard: View {
    @ObservedObject var vm: ProperNoundleVM
    private let rows: [[String]] = ["QWERTYUIOP".map { String($0) }, "ASDFGHJKL".map { String($0) }, "ZXCVBNM".map { String($0) }]

    var body: some View {
        VStack(spacing: 7) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: 5) {
                    if r == 2 { iconAction("delete.left") { vm.delete(); Haptics.tap(); SoundManager.shared.playKeyTap() } }
                    ForEach(rows[r], id: \.self) { key in letterKey(key) }
                    if r == 2 { action("ENTER") { vm.submit(); Haptics.tap(); SoundManager.shared.playKeyTap() } }
                }
            }
        }.padding(.horizontal, 4)
    }

    private func letterKey(_ l: String) -> some View {
        let st = vm.keyState(l)
        // Map ProperNoundle's NTile to the engine TileState for the shared key palette.
        let bg: Color = st.map { s in
            switch s {
            case .correct: return Theme.keyCorrect
            case .present, .hintUsed: return Theme.keyPresent
            case .absent: return Theme.keyAbsent
            default: return Theme.keyDefault
            }
        } ?? Theme.keyDefault
        return Button { vm.type(l); Haptics.tap(); SoundManager.shared.playKeyTap() } label: {
            Text(l).font(Brand.font(18, .bold)).foregroundStyle(st == nil ? Theme.textPrimary : .white)
                .frame(maxWidth: .infinity).frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 6).fill(bg))
        }.buttonStyle(.plain)
    }

    private func action(_ label: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Text(label).font(Brand.font(14, .bold)).foregroundStyle(Theme.textPrimary)
                .frame(width: 54, height: 52).background(RoundedRectangle(cornerRadius: 6).fill(Theme.keyDefault))
        }.buttonStyle(.plain)
    }

    private func iconAction(_ systemName: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Image(systemName: systemName).font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.textPrimary)
                .frame(width: 54, height: 52).background(RoundedRectangle(cornerRadius: 6).fill(Theme.keyDefault))
        }.buttonStyle(.plain)
    }
}

/// Compact ProperNoundle board + keyboard for the VS match screen. Drives a
/// ProperNoundleVM (built by VSMatchViewModel with isVersus = true) that relays
/// each guess + completion to the live match. Reuses the solo NoundleBoard /
/// NoundleKeyboard so the play surface matches the solo game.
struct ProperNoundleVSBoard: View {
    @ObservedObject var vm: ProperNoundleVM
    var body: some View {
        VStack(spacing: 6) {
            if let p = vm.puzzle {
                HStack(spacing: 6) {
                    Text(categoryLabel(p.themeCategory)).font(Brand.caption(11)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(categoryColors[p.themeCategory ?? ""] ?? Color(hex: 0x7C3AED)))
                    Text("\(vm.answerLen) letters").font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                }
                .padding(.top, 4)
            }
            NoundleBoard(vm: vm)
            Spacer(minLength: 4)
            if !vm.isFinished { NoundleHints(vm: vm) }
            NoundleKeyboard(vm: vm)
        }
        .padding(.horizontal, 10).padding(.bottom, 6)
    }
}
