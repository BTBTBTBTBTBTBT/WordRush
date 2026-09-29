import SwiftUI
import WordociousCore

// The finished More Games board for the Records / Stats "Completed today"
// dropdown (founder, 2026-09-29: "the completed screen drop downs on the new
// games only populate the stat results, they need to show the completed
// puzzles like the other games do"). Rebuilt from today's matches row through
// the engine's reconstruct* functions — the iOS twin of web
// lib/elsewhere-progress.ts — and drawn with each game's own board view in its
// finished, read-only mode. Also carries the exact score-breakdown inputs
// (boards solved / total / hints) each game recorded, so the card's total
// matches the recorded score on a loss as well as a win.

enum CompletedCustomBoard {
    case sudoku(SudokuState)
    case regions(RegionsState)
    case ladder(LadderVM)
    case spyglass(SpyglassVM)
    case hub(HubReconstruction, HubPuzzle?)
    case cryptogram(CodebreakerVM)
    case groups(solved: [GroupsGroup], unsolved: [GroupsGroup])
    case crossword(CrosswordVM)
    case muddle(MuddleVM)

    struct Progress { let boardsSolved: Int; let totalBoards: Int; let hintsUsed: Int }

    /// The board (nil when the row can't be rebuilt — the card then shows the summary alone) and the breakdown inputs.
    @MainActor
    static func build(mode: GameMode, seed: String, row d: MatchStatsService.SolvedDaily) -> (board: CompletedCustomBoard?, progress: Progress) {
        let won = d.won, sol = d.solutions, g = d.guesses
        let one = won ? 1 : 0
        func hints(_ replayed: Int) -> Int { d.hintsUsed > 0 ? d.hintsUsed : replayed }
        func ones(_ mask: String) -> Int { mask.filter { $0 == "1" }.count }
        let fallback = Progress(boardsSolved: one, totalBoards: 1, hintsUsed: d.hintsUsed)
        switch mode {
        case .sudoku:
            guard let r = reconstructSudoku(solutions: sol, guesses: g) else { return (nil, fallback) }
            var s = SudokuState(puzzle: SudokuPuzzle(seed: seed, difficulty: SUDOKU_DAILY_DIFFICULTY, givens: r.givens, solution: r.solution, clues: 0, rerolls: 0), startTime: 0)
            s.board = r.board; s.hintMask = r.hintMask
            s.wrongMask = String(zip(r.board, r.solution).map { $0 != "0" && $0 != $1 ? "1" : "0" })
            s.mistakes = max(0, d.guessCount - 1); s.hintsUsed = hints(ones(r.hintMask)); s.status = won ? .won : .lost
            return (.sudoku(s), Progress(boardsSolved: one, totalBoards: 1, hintsUsed: s.hintsUsed))
        case .regions:
            guard let r = reconstructRegions(solutions: sol, guesses: g) else { return (nil, fallback) }
            let n = r.n, solArr = Array(r.solution), b = Array(r.board)
            var s = RegionsState(puzzle: RegionsPuzzle(seed: seed, n: n, regions: r.regions, solution: r.solution, sizes: [], rerolls: 0), startTime: 0)
            s.board = r.board.replacingOccurrences(of: "o", with: "."); s.hintMask = r.hintMask
            s.wrongMask = String((0..<(n * n)).map { i in b[i] == "*" && Int(solArr[i / n].asciiValue!) - 48 != i % n ? "1" : "0" })
            s.autoMask = String(repeating: "0", count: n * n)
            s.mistakes = max(0, d.guessCount - 1); s.hintsUsed = hints(ones(r.hintMask)); s.status = won ? .won : .lost
            return (.regions(s), Progress(boardsSolved: one, totalBoards: 1, hintsUsed: s.hintsUsed))
        case .ladder:
            guard let r = reconstructLadder(solutions: sol, guesses: g) else { return (nil, fallback) }
            var s = LadderState(puzzle: LadderPuzzle(id: "", start: r.start, end: r.end, par: r.par, path: r.path), seed: seed, startTime: 0)
            s.words = r.words; s.hintMask = r.hintMask; s.moves = r.moves; s.hintsUsed = hints(r.hintsUsed); s.events = g; s.status = won ? .won : .lost
            return (.ladder(LadderVM(display: s)), Progress(boardsSolved: one, totalBoards: 1, hintsUsed: s.hintsUsed))
        case .wordsearch:
            guard let r = reconstructWordsearch(solutions: sol, guesses: g) else { return (nil, fallback) }
            var s = WordsearchState(puzzle: WordsearchPuzzle(id: "", theme: "", family: "", title: r.title, grid: r.grid, words: r.words), seed: seed, startTime: 0)
            s.found = r.found; s.misses = r.misses; s.hintsUsed = r.hintsUsed; s.wordsShown = r.wordsShown; s.lateFinds = r.lateFinds; s.events = g
            s.status = won ? .won : .lost
            return (.spyglass(SpyglassVM(display: s)), Progress(boardsSolved: r.found.count, totalBoards: r.words.count, hintsUsed: r.hintsUsed))
        case .hub:
            guard let r = reconstructHub(solutions: sol, guesses: g) else { return (nil, fallback) }
            let bank = HubBankStore.shared
            let puzzle = ((bank?.daily ?? []) + (bank?.extra ?? [])).first { $0.id == r.id && $0.letters == r.letters }
            return (.hub(r, puzzle), Progress(boardsSolved: hubBoardsSolved(points: r.points, max: r.max), totalBoards: HUB_TOTAL_BOARDS, hintsUsed: hints(r.hintsUsed)))
        case .cryptogram:
            guard let r = reconstructCryptogram(solutions: sol, guesses: g) else { return (nil, Progress(boardsSolved: one, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: d.hintsUsed)) }
            var s = CryptogramState(puzzle: CryptogramPuzzle(id: r.id, text: r.text, key: r.key, given: r.given), seed: seed, startTime: 0)
            s.mapping = r.mapping; s.locked = cryptogramCodeLetters(r.cipher).sorted(); s.hinted = r.hinted
            s.hintsUsed = hints(r.hinted.count); s.checks = r.checks; s.events = g; s.status = won ? .won : .lost; s.ended = true
            return (.cryptogram(CodebreakerVM(display: s)), Progress(boardsSolved: one, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: s.hintsUsed))
        case .groups:
            guard let r = reconstructGroups(solutions: sol, guesses: g) else {
                return (nil, Progress(boardsSolved: won ? GROUPS_TOTAL_BOARDS : 0, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: d.hintsUsed))
            }
            let solved = r.solvedTiers.compactMap { t in r.groups.first { $0.tier == t } }
            let unsolved = r.groups.filter { !r.solvedTiers.contains($0.tier) }
            return (.groups(solved: solved, unsolved: unsolved), Progress(boardsSolved: r.solvedTiers.count, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: hints(r.hintsUsed)))
        case .crossword:
            let r = reconstructCrossword(solutions: sol, guesses: g)
            let progress = Progress(boardsSolved: one, totalBoards: CROSSWORD_TOTAL_BOARDS, hintsUsed: hints(r?.hintsUsed ?? 0))
            // The clues live only in the bank: find the day's puzzle by id (holiday lists included).
            guard let r, let bank = CrosswordBankStore.shared,
                  let p = (bank.daily + bank.extra + (bank.holiday ?? [:]).values.flatMap { $0 }).first(where: { $0.id == r.id }) else { return (nil, progress) }
            var s = createCrosswordState(p, seed: seed, startTime: 0)
            guard s.solution == r.solution, r.fill.count == r.solution.count else { return (nil, progress) }
            s.fill = r.fill
            s.locked = String(zip(r.fill, r.solution).map { f, c in c == CROSSWORD_BLOCK ? "." : (f != CROSSWORD_EMPTY && f == c ? "1" : "0") })
            s.revealed = r.revealed; s.checks = r.checks; s.hintsUsed = progress.hintsUsed; s.events = g; s.status = won ? .won : .lost; s.ended = true
            return (.crossword(CrosswordVM(display: s)), progress)
        case .scramble:
            guard let r = reconstructScramble(solutions: sol, guesses: g) else {
                return (nil, Progress(boardsSolved: won ? SCRAMBLE_TOTAL_BOARDS : 0, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: d.hintsUsed))
            }
            let progress = Progress(boardsSolved: r.boardsSolved, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: hints(r.hintsUsed))
            // The cartoon and caption live only in the bank: today's puzzle first, else any entry with these answers.
            guard let bank = ScrambleBankStore.shared else { return (nil, progress) }
            let all = bank.daily + bank.extra + (bank.holiday ?? [:]).values.flatMap { $0 }
            let today = scramblePuzzleForDay(bank, day: LeaderboardService.todayLocal(), holidays: HolidayTable.bundled)
            let matches: (ScramblePuzzle) -> Bool = { p in
                p.words.map { $0.answer.uppercased() } == r.words.map { $0.uppercased() } && p.final.answer.uppercased() == r.final.uppercased()
            }
            guard let p = ([today].compactMap { $0 } + all).first(where: matches) else { return (nil, progress) }
            var s = createScrambleState(p, seed: seed, startTime: 0)
            let targets = (0..<s.solved.count).map { scrambleTarget(s, $0) }
            guard r.solved.count == targets.count else { return (nil, progress) }
            s.entries = targets.indices.map { r.solved[$0] ? targets[$0] : "" }
            s.revealed = targets.indices.map { r.solved[$0] ? targets[$0] : s.revealed[$0] }
            s.solved = r.solved; s.checks = r.checks; s.mistakes = r.mistakes; s.hintsUsed = progress.hintsUsed
            s.events = g; s.status = won ? .won : .lost; s.ended = true
            return (.muddle(MuddleVM(display: s, puzzle: p)), progress)
        default:
            return (nil, fallback)
        }
    }
}

/// Draws a rebuilt board at the card's width, non-interactive.
struct CompletedCustomBoardView: View {
    let board: CompletedCustomBoard
    /// The card's inner width (the page margins and the card padding off the screen), capped like the classic boards.
    private var width: CGFloat { min(360, UIScreen.main.bounds.width - 60) }

    var body: some View {
        content.allowsHitTesting(false).frame(maxWidth: .infinity)
    }

    @ViewBuilder private var content: some View {
        switch board {
        case .sudoku(let s):
            SudokuBoardView(state: s, selected: nil, revealSolution: s.status == .lost) { _ in }.frame(maxWidth: min(300, width))
        case .regions(let s):
            RegionsBoardView(state: s, focused: nil, revealSolution: s.status == .lost) { _ in }.frame(maxWidth: min(300, width))
        case .ladder(let vm):
            LadderBoardView(vm: vm, revealPath: vm.state.status == .lost)
        case .spyglass(let vm):
            VStack(spacing: 8) {
                SpyglassGridView(vm: vm, revealMissing: vm.state.status == .lost).frame(maxWidth: min(300, width))
                WordWrapLayout(spacing: 5, lineSpacing: 5) {
                    ForEach(vm.state.words.map(\.w), id: \.self) { w in
                        let found = vm.state.found.contains(w)
                        Text(w).font(Brand.font(11, .bold)).strikethrough(found).lineLimit(1).fixedSize()
                            .foregroundStyle(found ? Theme.textPrimary : Theme.textMuted)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Capsule().fill(found ? ModeStyle.accent(.wordsearch).opacity(0.14) : Theme.surface))
                            .overlay(Capsule().stroke(found ? ModeStyle.accent(.wordsearch).opacity(0.35) : Theme.border, lineWidth: 1))
                    }
                }
                .frame(maxWidth: width)
            }
        case .hub(let r, let p):
            CompletedHubBoard(r: r, puzzle: p, width: width)
        case .cryptogram(let vm):
            VStack(spacing: 8) {
                CipherBoardView(vm: vm, finished: true, cell: CodebreakerSizing.cell(for: vm.state.cipher, width: width, height: nil))
                Text("“\(vm.state.text)”").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary).multilineTextAlignment(.center)
            }
            .frame(maxWidth: width)
        case .groups(let solved, let unsolved):
            VStack(spacing: 6) {
                ForEach(solved, id: \.tier) { KindredGroupBar(group: $0) }
                ForEach(unsolved, id: \.tier) { KindredGroupBar(group: $0, revealed: true) }
            }
            .frame(maxWidth: width)
        case .crossword(let vm):
            VStack(spacing: 10) {
                CrosswordGridView(vm: vm, finished: true, width: width)
                CrosswordClueColumns(vm: vm, finished: true)
            }
            .frame(maxWidth: width)
        case .muddle(let vm):
            MuddleFinishedBoard(vm: vm, cartoonHeight: min(170, width * 0.5)).frame(maxWidth: width)
        }
    }
}

/// Hubbub finished: the rank reached, the hive, then every word (found solid,
/// missed muted, bonus words after) — the web elsewhere view plus the hive.
private struct CompletedHubBoard: View {
    let r: HubReconstruction
    let puzzle: HubPuzzle?
    let width: CGFloat
    private var accent: Color { ModeStyle.accent(.hub) }

    var body: some View {
        let letters = Array(r.letters)
        VStack(spacing: 8) {
            HStack {
                Text(r.rankName).font(Brand.font(12, .black)).foregroundStyle(accent)
                Spacer()
                Text("\(r.points)/\(r.max) pts · \(r.found.count)\(puzzle.map { "/\($0.words.count)" } ?? "") words").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
            }
            HStack(spacing: 4) {
                ForEach(0..<HUB_RANKS.count, id: \.self) { i in Capsule().fill(i <= r.rank ? accent : Theme.borderLight).frame(height: 6) }
            }
            if letters.count == 7 {
                let o = Array(letters.dropFirst())
                VStack(spacing: 5) {
                    HStack(spacing: 5) { tile(o[0]); tile(o[1]) }
                    HStack(spacing: 5) { tile(o[2]); tile(letters[0], centre: true); tile(o[3]) }
                    HStack(spacing: 5) { tile(o[4]); tile(o[5]) }
                }
                .padding(.vertical, 2)
            }
            Text(puzzle == nil ? "WORDS FOUND" : "ALL WORDS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            WordWrapLayout(spacing: 5, lineSpacing: 5) {
                ForEach(Set((puzzle?.words ?? r.found) + r.bonusFound).sorted(), id: \.self) { w in chip(w) }
            }
        }
        .frame(maxWidth: width)
    }

    private func tile(_ ch: Character, centre: Bool = false) -> some View {
        Text(String(ch)).font(Brand.font(16, .black)).foregroundStyle(centre ? .white : Theme.textPrimary)
            .frame(width: 34, height: 34)
            .background(RoundedRectangle(cornerRadius: 7).fill(centre ? accent : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(centre ? accent : Theme.border, lineWidth: 1.5))
    }

    private func chip(_ w: String) -> some View {
        let got = r.found.contains(w) || r.bonusFound.contains(w)
        let pangram = puzzle?.pangrams.contains(w) ?? false, revealed = r.revealed.contains(w)
        return Text(pangram ? "\(w) ★" : w).font(Brand.font(11, .bold)).lineLimit(1).fixedSize()
            .foregroundStyle(!got ? Color(hex: 0x9CA3AF) : pangram ? accent : revealed ? Color(hex: 0x8B5CF6) : Theme.textPrimary)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(!got ? Color(hex: 0xF9FAFB) : pangram ? accent.opacity(0.14) : Theme.surface))
            .overlay(Capsule().stroke(!got ? Color(hex: 0xE5E7EB) : pangram ? accent : revealed ? Color(hex: 0x8B5CF6) : Theme.border, lineWidth: 1))
    }
}
