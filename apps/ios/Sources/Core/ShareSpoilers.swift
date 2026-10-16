import Foundation

// Share cards: spoiler-free models for the puzzle games (share-cards-1016/SPEC.md "Spoilers").
// Swift port of packages/core/src/share-spoilers.ts, pinned to it by
// share-spoilers-fixtures.json (ShareSpoilersFixtureTests).
//
// Every puzzle game offers the chooser (`No spoilers` / `Full results`). These pure functions turn a FINISHED game
// into a small, serializable model that the renderer just draws. The `clean` variant never carries the answer: no
// digits, letters, words, stars or quote text; only shapes, masks, colors and counts. The `full` variant adds the
// answer fields; in `clean` those same fields are nil, so a renderer branches on nil, never on the variant.
//
// Every model encodes with explicit `null`s for the answer fields (the chooser fixtures are compared byte for byte),
// so each one spells out its `encode(to:)` instead of leaning on the synthesized `encodeIfPresent`.

public enum ShareVariant: String, Codable, CaseIterable {
    case clean, full
}

public struct ShareVariantCopy: Equatable {
    public struct Side: Equatable {
        public let title: String
        public let subtitle: String
    }
    public let clean: Side
    public let full: Side
}

public enum ShareSpoilers {
    /// Chooser subtitles per catalog mode id; anything else (the word games) keeps the colors / letters rule.
    public static let subtitles: [String: (clean: String, full: String)] = [
        "regions": ("Regions only", "Stars revealed"),
        "sudoku": ("Givens only", "Digits revealed"),
        "crossword": ("Grid only", "Letters revealed"),
        "groups": ("Colors only", "Words revealed"),
        "wordsearch": ("Paths only", "Letters revealed"),
        "hub": ("Rank only", "Words revealed"),
        "scramble": ("Stats only", "Answer revealed"),
        "ladder": ("Rungs only", "Words revealed"),
        "cryptogram": ("Shape only", "Quote revealed"),
    ]

    public static let defaultSubtitles: (clean: String, full: String) = ("Colors only", "Letters revealed")

    public static func variantCopy(_ mode: String) -> ShareVariantCopy {
        let s = subtitles[mode] ?? defaultSubtitles
        return ShareVariantCopy(clean: .init(title: "No spoilers", subtitle: s.clean), full: .init(title: "Full results", subtitle: s.full))
    }

    static func only<T>(_ variant: ShareVariant, _ value: T) -> T? { variant == .full ? value : nil }

    /// Letter count per word of the quote, in reading order (punctuation dropped, zero-letter tokens skipped).
    public static func codebreakerShape(_ text: String) -> [Int] {
        text.components(separatedBy: .whitespacesAndNewlines)
            .map { tok in tok.unicodeScalars.filter { ($0 >= "A" && $0 <= "Z") || ($0 >= "a" && $0 <= "z") }.count }
            .filter { $0 > 0 }
    }
}

// MARK: - Starsweep (regions)

public struct StarsweepShareModel: Encodable, Equatable {
    public let kind = "starsweep"
    public let n: Int
    /// One digit per cell (row-major): the region index.
    public let regions: String
    /// Palette slot per region index (regionColorSlots).
    public let slots: [Int]
    public let solved: Bool
    /// Cells holding a committed star; full only.
    public let stars: [Int]?
    /// Cells crossed out; full only.
    public let crosses: [Int]?

    enum CodingKeys: String, CodingKey { case kind, n, regions, slots, solved, stars, crosses }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(n, forKey: .n); try c.encode(regions, forKey: .regions)
        try c.encode(slots, forKey: .slots); try c.encode(solved, forKey: .solved)
        try c.encode(stars, forKey: .stars); try c.encode(crosses, forKey: .crosses)
    }
}

public struct StarsweepShareInput: Decodable, Equatable {
    public let n: Int
    public let regions: String
    public let solution: String
    public let board: String
    public init(n: Int, regions: String, solution: String, board: String) { self.n = n; self.regions = regions; self.solution = solution; self.board = board }
}

public func starsweepShareModel(_ g: StarsweepShareInput, _ variant: ShareVariant) -> StarsweepShareModel {
    let board = Array(g.board), solution = Array(g.solution.unicodeScalars)
    var stars: [Int] = [], crosses: [Int] = []
    for i in 0..<board.count { if board[i] == "*" { stars.append(i) } else if board[i] == "x" { crosses.append(i) } }
    var solved = true
    for r in 0..<g.n {
        let col = r < solution.count ? Int(solution[r].value) - 48 : Int.min
        let idx = r * g.n + col
        if idx < 0 || idx >= board.count || board[idx] != "*" { solved = false }
    }
    return StarsweepShareModel(n: g.n, regions: g.regions, slots: regionColorSlots(g.n, g.regions), solved: solved,
                               stars: ShareSpoilers.only(variant, stars), crosses: ShareSpoilers.only(variant, crosses))
}

// MARK: - Sudocious (sudoku)

public struct SudociousShareModel: Encodable, Equatable {
    public let kind = "sudocious"
    /// 81 chars, '0' empty: the given digits (the puzzle, shown in both variants).
    public let givens: String
    /// 81 chars: 'g' given, 'f' filled right, 'w' filled wrong, '.' empty.
    public let cells: String
    public let solved: Bool
    /// 81 chars, the player's board; full only.
    public let board: String?

    enum CodingKeys: String, CodingKey { case kind, givens, cells, solved, board }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(givens, forKey: .givens); try c.encode(cells, forKey: .cells)
        try c.encode(solved, forKey: .solved); try c.encode(board, forKey: .board)
    }
}

public struct SudociousShareInput: Decodable, Equatable {
    public let givens: String
    public let solution: String
    public let board: String
    public init(givens: String, solution: String, board: String) { self.givens = givens; self.solution = solution; self.board = board }
}

public func sudociousShareModel(_ g: SudociousShareInput, _ variant: ShareVariant) -> SudociousShareModel {
    let givens = Array(g.givens), board = Array(g.board), solution = Array(g.solution)
    var cells = ""
    for i in 0..<81 {
        let given: Character = i < givens.count ? givens[i] : "0"
        let b: Character = i < board.count ? board[i] : "0"
        if given != "0" { cells.append("g") }
        else if b == "0" { cells.append(".") }
        else if i < solution.count && b == solution[i] { cells.append("f") }
        else { cells.append("w") }
    }
    return SudociousShareModel(givens: g.givens, cells: cells, solved: g.board == g.solution, board: ShareSpoilers.only(variant, g.board))
}

// MARK: - Crosswordocious (crossword)

public struct CrosswordShareModel: Encodable, Equatable {
    public let kind = "crossword"
    public let w: Int
    public let h: Int
    /// w*h chars: '.' block, '#' filled right, 'x' filled wrong, '_' empty.
    public let cells: String
    public let solved: Bool
    /// w*h chars, the player's fill ('.' block, '_' empty); full only.
    public let letters: String?

    enum CodingKeys: String, CodingKey { case kind, w, h, cells, solved, letters }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(w, forKey: .w); try c.encode(h, forKey: .h)
        try c.encode(cells, forKey: .cells); try c.encode(solved, forKey: .solved); try c.encode(letters, forKey: .letters)
    }
}

public struct CrosswordShareInput: Decodable, Equatable {
    public let w: Int
    public let h: Int
    public let solution: String
    public let fill: String
    public init(w: Int, h: Int, solution: String, fill: String) { self.w = w; self.h = h; self.solution = solution; self.fill = fill }
}

public func crosswordShareModel(_ g: CrosswordShareInput, _ variant: ShareVariant) -> CrosswordShareModel {
    let solution = Array(g.solution), fill = Array(g.fill)
    var cells = "", solved = true
    for i in 0..<solution.count {
        let s = solution[i], f: Character = i < fill.count ? fill[i] : "_"
        if s == "." { cells.append(".") }
        else if f == "_" || f == "." { cells.append("_"); solved = false }
        else if f == s { cells.append("#") }
        else { cells.append("x"); solved = false }
    }
    return CrosswordShareModel(w: g.w, h: g.h, cells: cells, solved: solved, letters: ShareSpoilers.only(variant, g.fill))
}

// MARK: - Kindred (groups)

public struct KindredShareRow: Encodable, Equatable {
    public let tier: Int
    public let solved: Bool
    /// The group's label; full only.
    public let label: String?
    /// The four words; full only.
    public let words: [String]?

    enum CodingKeys: String, CodingKey { case tier, solved, label, words }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(tier, forKey: .tier); try c.encode(solved, forKey: .solved)
        try c.encode(label, forKey: .label); try c.encode(words, forKey: .words)
    }
}

public struct KindredShareModel: Encodable, Equatable {
    public let kind = "kindred"
    /// Solved groups in the order solved, then the unsolved ones by tier.
    public let rows: [KindredShareRow]
    public let mistakes: Int
    public let solved: Bool

    enum CodingKeys: String, CodingKey { case kind, rows, mistakes, solved }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(rows, forKey: .rows)
        try c.encode(mistakes, forKey: .mistakes); try c.encode(solved, forKey: .solved)
    }
}

public struct KindredShareInput: Decodable, Equatable {
    public let groups: [GroupsGroup]
    public let solvedTiers: [Int]
    public let mistakes: Int
    public init(groups: [GroupsGroup], solvedTiers: [Int], mistakes: Int) { self.groups = groups; self.solvedTiers = solvedTiers; self.mistakes = mistakes }
}

public func kindredShareModel(_ g: KindredShareInput, _ variant: ShareVariant) -> KindredShareModel {
    let order = g.solvedTiers + g.groups.map { $0.tier }.filter { !g.solvedTiers.contains($0) }.sorted()
    var rows: [KindredShareRow] = []
    for tier in order {
        guard let grp = g.groups.first(where: { $0.tier == tier }) else { continue }
        rows.append(KindredShareRow(tier: tier, solved: g.solvedTiers.contains(tier),
                                    label: ShareSpoilers.only(variant, grp.label), words: ShareSpoilers.only(variant, grp.words)))
    }
    return KindredShareModel(rows: rows, mistakes: g.mistakes, solved: !rows.isEmpty && rows.allSatisfy { $0.solved })
}

// MARK: - Spyglass (wordsearch)

public struct SpyglassSharePath: Encodable, Equatable {
    /// Grid cells the stroke runs through, first letter first.
    public let cells: [Int]
    /// The word on the stroke; full only.
    public let word: String?

    enum CodingKeys: String, CodingKey { case cells, word }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(cells, forKey: .cells); try c.encode(word, forKey: .word)
    }
}

public struct SpyglassShareModel: Encodable, Equatable {
    public let kind = "spyglass"
    public let n: Int
    /// One stroke per found word, in the order found.
    public let paths: [SpyglassSharePath]
    public let found: Int
    public let total: Int
    public let solved: Bool
    /// n*n letters; full only.
    public let letters: String?

    enum CodingKeys: String, CodingKey { case kind, n, paths, found, total, solved, letters }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(n, forKey: .n); try c.encode(paths, forKey: .paths)
        try c.encode(found, forKey: .found); try c.encode(total, forKey: .total); try c.encode(solved, forKey: .solved)
        try c.encode(letters, forKey: .letters)
    }
}

public struct SpyglassShareInput: Decodable, Equatable {
    public let grid: String
    public let words: [WordsearchPlacement]
    public let found: [String]
    public init(grid: String, words: [WordsearchPlacement], found: [String]) { self.grid = grid; self.words = words; self.found = found }
}

public func spyglassShareModel(_ g: SpyglassShareInput, _ variant: ShareVariant) -> SpyglassShareModel {
    let n = Int(Double(g.grid.count).squareRoot().rounded())
    var paths: [SpyglassSharePath] = []
    for w in g.found {
        if let p = g.words.first(where: { $0.w == w }) {
            paths.append(SpyglassSharePath(cells: wordsearchCells(n, p), word: ShareSpoilers.only(variant, p.w)))
        }
    }
    return SpyglassShareModel(n: n, paths: paths, found: paths.count, total: g.words.count,
                              solved: !g.words.isEmpty && paths.count == g.words.count, letters: ShareSpoilers.only(variant, g.grid))
}

// MARK: - Hubbub (hub)

public struct HubbubShareModel: Encodable, Equatable {
    public let kind = "hubbub"
    /// The seven letters, center first (the puzzle, shown in both variants).
    public let letters: String
    public let rank: Int
    public let rankName: String
    public let points: Int
    public let max: Int
    public let found: Int
    public let total: Int
    public let pangrams: Int
    public let pangramTotal: Int
    /// The found scoring words in the order found; full only.
    public let words: [String]?

    enum CodingKeys: String, CodingKey { case kind, letters, rank, rankName, points, max, found, total, pangrams, pangramTotal, words }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(letters, forKey: .letters); try c.encode(rank, forKey: .rank)
        try c.encode(rankName, forKey: .rankName); try c.encode(points, forKey: .points); try c.encode(max, forKey: .max)
        try c.encode(found, forKey: .found); try c.encode(total, forKey: .total); try c.encode(pangrams, forKey: .pangrams)
        try c.encode(pangramTotal, forKey: .pangramTotal); try c.encode(words, forKey: .words)
    }
}

public struct HubbubShareInput: Decodable, Equatable {
    public let letters: String
    public let found: [String]
    public let points: Int
    public let max: Int
    public let wordCount: Int
    public let pangramCount: Int
    public init(letters: String, found: [String], points: Int, max: Int, wordCount: Int, pangramCount: Int) {
        self.letters = letters; self.found = found; self.points = points; self.max = max; self.wordCount = wordCount; self.pangramCount = pangramCount
    }
}

public func hubbubShareModel(_ g: HubbubShareInput, _ variant: ShareVariant) -> HubbubShareModel {
    let rank = hubRankIndex(points: g.points, max: g.max)
    return HubbubShareModel(letters: g.letters, rank: rank, rankName: HUB_RANKS[rank].name, points: g.points, max: g.max,
                            found: g.found.count, total: g.wordCount, pangrams: g.found.filter { hubIsPangram($0, letters: g.letters) }.count,
                            pangramTotal: g.pangramCount, words: ShareSpoilers.only(variant, g.found))
}

// MARK: - Muddle (scramble)

public struct MuddleShareModel: Encodable, Equatable {
    public let kind = "muddle"
    /// Letter counts of the four words and the punchline (spaces dropped), for blank tiles.
    public let lengths: [Int]
    /// Which of the five rows were solved.
    public let solved: [Bool]
    public let boardsSolved: Int
    public let checks: Int
    public let mistakes: Int
    public let hintsUsed: Int
    public let won: Bool
    /// The four words and the punchline; full only.
    public let answers: [String]?
    /// The cartoon's caption; full only (nil when the game has none).
    public let caption: String?

    enum CodingKeys: String, CodingKey { case kind, lengths, solved, boardsSolved, checks, mistakes, hintsUsed, won, answers, caption }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(lengths, forKey: .lengths); try c.encode(solved, forKey: .solved)
        try c.encode(boardsSolved, forKey: .boardsSolved); try c.encode(checks, forKey: .checks); try c.encode(mistakes, forKey: .mistakes)
        try c.encode(hintsUsed, forKey: .hintsUsed); try c.encode(won, forKey: .won)
        try c.encode(answers, forKey: .answers); try c.encode(caption, forKey: .caption)
    }
}

public struct MuddleShareInput: Decodable, Equatable {
    public let words: [String]
    public let final: String
    public let solved: [Bool]
    public let checks: Int
    public let mistakes: Int
    public let hintsUsed: Int
    public init(words: [String], final: String, solved: [Bool], checks: Int, mistakes: Int, hintsUsed: Int) {
        self.words = words; self.final = final; self.solved = solved; self.checks = checks; self.mistakes = mistakes; self.hintsUsed = hintsUsed
    }
}

public func muddleShareModel(_ g: MuddleShareInput, _ variant: ShareVariant, caption: String? = nil) -> MuddleShareModel {
    let answers = g.words + [g.final]
    let solved = (0..<5).map { i in i < g.solved.count && g.solved[i] }
    let fullCaption: String? = (variant == .full && !(caption ?? "").isEmpty) ? caption : nil
    return MuddleShareModel(lengths: answers.map { a in a.unicodeScalars.filter { $0 >= "A" && $0 <= "Z" }.count },
                            solved: solved, boardsSolved: solved.filter { $0 }.count,
                            checks: g.checks, mistakes: g.mistakes, hintsUsed: g.hintsUsed, won: solved[4],
                            answers: ShareSpoilers.only(variant, answers), caption: fullCaption)
}

// MARK: - Letter Ladder (ladder)

public enum LadderRungColor: String, Codable, Equatable { case start, step, hint, end }

public struct LadderShareRung: Encodable, Equatable {
    public let color: LadderRungColor
    /// The rung's word; full only.
    public let word: String?

    enum CodingKeys: String, CodingKey { case color, word }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(color, forKey: .color); try c.encode(word, forKey: .word)
    }
}

public struct LadderShareModel: Encodable, Equatable {
    public let kind = "ladder"
    public let rungs: [LadderShareRung]
    public let rungCount: Int
    public let par: Int
    public let moves: Int
    public let solved: Bool

    enum CodingKeys: String, CodingKey { case kind, rungs, rungCount, par, moves, solved }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(rungs, forKey: .rungs); try c.encode(rungCount, forKey: .rungCount)
        try c.encode(par, forKey: .par); try c.encode(moves, forKey: .moves); try c.encode(solved, forKey: .solved)
    }
}

public struct LadderShareInput: Decodable, Equatable {
    public let start: String
    public let end: String
    public let words: [String]
    public let hintMask: String
    public let par: Int
    public let moves: Int
    public init(start: String, end: String, words: [String], hintMask: String, par: Int, moves: Int) {
        self.start = start; self.end = end; self.words = words; self.hintMask = hintMask; self.par = par; self.moves = moves
    }
}

public func ladderShareModel(_ g: LadderShareInput, _ variant: ShareVariant) -> LadderShareModel {
    let last = g.words.count - 1
    let solved = last >= 0 && g.words[last] == g.end
    let mask = Array(g.hintMask)
    let rungs = g.words.enumerated().map { (i, w) -> LadderShareRung in
        let color: LadderRungColor = i == 0 ? .start : (solved && i == last) ? .end : (i < mask.count && mask[i] == "1") ? .hint : .step
        return LadderShareRung(color: color, word: ShareSpoilers.only(variant, w))
    }
    return LadderShareModel(rungs: rungs, rungCount: rungs.count, par: g.par, moves: g.moves, solved: solved)
}

// MARK: - Codebreaker (cryptogram)

public struct CodebreakerShareModel: Encodable, Equatable {
    public let kind = "codebreaker"
    /// Letter count per word of the quote, in reading order (punctuation dropped, zero-letter tokens skipped).
    public let shape: [Int]
    public let correct: Int
    public let total: Int
    public let checks: Int
    public let solved: Bool
    /// The quote as displayed; full only.
    public let text: String?

    enum CodingKeys: String, CodingKey { case kind, shape, correct, total, checks, solved, text }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind); try c.encode(shape, forKey: .shape); try c.encode(correct, forKey: .correct)
        try c.encode(total, forKey: .total); try c.encode(checks, forKey: .checks); try c.encode(solved, forKey: .solved)
        try c.encode(text, forKey: .text)
    }
}

public struct CodebreakerShareInput: Decodable, Equatable {
    public let text: String
    public let correct: Int
    public let total: Int
    public let checks: Int
    public let solved: Bool
    public init(text: String, correct: Int, total: Int, checks: Int, solved: Bool) {
        self.text = text; self.correct = correct; self.total = total; self.checks = checks; self.solved = solved
    }
}

public func codebreakerShareModel(_ g: CodebreakerShareInput, _ variant: ShareVariant) -> CodebreakerShareModel {
    CodebreakerShareModel(shape: ShareSpoilers.codebreakerShape(g.text), correct: g.correct, total: g.total, checks: g.checks,
                          solved: g.solved, text: ShareSpoilers.only(variant, g.text))
}
