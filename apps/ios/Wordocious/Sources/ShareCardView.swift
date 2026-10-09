import SwiftUI
import WordociousCore

/// The game share image (web lib/share-image.ts layouts — single, multi, gauntlet
/// and the More Games bodies), rendered to PNG via ImageRenderer.
/// FINISH_SPEC §E1 (finishing-touches `.sharecard`): the game's wallpaper, its WHOLE title
/// art (card width inside 90-px margins, pinned to the top — ShareCardPlan), the date line, the result board as GLOSSY tiles on the shared
/// board tray (§L), three tinted stat windows (purple · blue · gold, soft numbers)
/// and a footer: a cast pose that is NOT the game's title host, with no bubble,
/// + "Can you beat me?" / "wordocious.com". Static and always light (see ShareKit).
/// One board of a multi-board share: color grid, optional letters (only used
/// by the "Full results" variant), win/loss, and the answer (drawn under the
/// board when revealing a loss).
struct ShareBoard {
    let grid: [[TileState]]
    var letters: [[String]]? = nil
    let won: Bool
    var solution: String? = nil
}

struct ShareCardView: View {
    enum Kind {
        case single(grid: [[TileState]])
        case multi(boards: [ShareBoard], boardsSolved: Int, totalBoards: Int)
        case gauntlet(stages: [GauntletStageShare], stagesCompleted: Int, totalStages: Int)
        /// Sudoku (More Games §18d): the 9 × 9 as squares — givens dark, the
        /// player's cells purple, hint cells violet — no digits.
        case sudoku(givens: String, board: String, hintMask: String, mistakes: Int, difficulty: String, puzzleNumber: Int?)
        /// Starsweep (More Games §18d): the regions as tinted squares with the
        /// placed stars as dots — no crosses, never the missing stars.
        case regions(n: Int, regions: String, board: String, hintMask: String, mistakes: Int, sizeLabel: String, puzzleNumber: Int?)
        /// Letter Ladder (More Games §18d): START and END spelled out, every rung
        /// between them blank except the changed position (accent; violet for a hint).
        case ladder(start: String, end: String, words: [String], hintMask: String, par: Int, moves: Int, puzzleNumber: Int?)
        /// Spyglass (More Games §18d): a dot grid with the found words as accent capsules — no letters.
        case wordsearch(n: Int, words: [WordsearchPlacement], found: [String], misses: Int, title: String, puzzleNumber: Int?)
        /// Hubbub (More Games §18d): the blank 2-3-2 silhouette with the center filled, rank, % of max — no letters.
        case hub(rankName: String, pct: Int, wordsFound: Int, wordCount: Int, pangramsFound: Int, puzzleNumber: Int?)
        /// Codebreaker (More Games §18d): the CIPHERTEXT only — blank cells with the code letter under each, words wrapped whole — no plain letters.
        case cryptogram(cipher: String, checks: Int, puzzleNumber: Int?)
        /// Kindred (More Games §18d): the solved groups as tier bars in solve order (pips, never words),
        /// the missed tiers dashed beneath on a loss, then the four mistake dots.
        case groups(solvedTiers: [Int], mistakes: Int, maxMistakes: Int, puzzleNumber: Int?)
        /// Crosswordocious (More Games §18d): the grid silhouette only — purple tiles where letters are,
        /// nothing where blocks are; no letters, no numbers.
        case crossword(w: Int, h: Int, solution: String, checks: Int, puzzleNumber: Int?)
        /// Muddle (More Games §18d): four rows of blank tiles on one six-column grid with the circled
        /// positions ringed, a divider, then the punchline row grouped by word in the lilac tint — no letters, no cartoon.
        case scramble(wordLengths: [Int], circled: [[Int]], pattern: [Int], checks: Int, solvedCount: Int, puzzleNumber: Int?)
    }

    let kind: Kind
    let modeLabel: String
    let accent: Color
    let won: Bool
    let guesses: Int
    let maxGuesses: Int
    let timeSeconds: Int
    let dateStr: String
    /// ProperNoundle extras (web share-image.ts parity): the category pill shown
    /// next to the stats line, and word-group sizes for multi-word answers so a
    /// full tile-width gap separates first/last names in the grid.
    var category: String? = nil
    var wordGroups: [Int]? = nil
    /// "Full results" variant: draw the guessed letters in the tiles and the
    /// answer under lost boards. False = today's spoiler-free color-only card.
    var reveal: Bool = false
    /// Single-board letters, row-for-row with the grid ('' = no glyph).
    var letters: [[String]]? = nil
    /// Answer in display form (ProperNoundle keeps its space) for a lost single board.
    var solutionDisplay: String? = nil
    /// The game (ART_SPEC §17): its tint behind the card and its title art header.
    var mode: GameMode? = nil
    /// FINISH_SPEC §E1: the result's points for the gold POINTS window (nil → the
    /// third window shows the mode's own count instead).
    var points: Int? = nil
    /// Item 46: the sender's hero band under the title (nil = none: a guest's card, or an override of the result).
    /// Defaults from the win flag; the band only shows for a signed-in player (ShareHeroBand.available).
    var hero: ShareHero.Result? = nil

    private var heroResult: ShareHero.Result { hero ?? ShareHero.result(won: won) }
    /// Set by the caller (ShareHeroBand.available: a signed-in player); the band's height is then part of the plan.
    var heroEnabled = false
    private var heroBand: CGFloat { CGFloat(ShareHero.band(hasHero: heroEnabled)) }

    private let bg = Color(hex: 0xF5EEFF)
    private let lossFG = Color(hex: 0xDC2626)

    /// §S2: the board body's measured natural size (`ShareService.naturalSize(card.boardBody)`),
    /// set before rendering so the canvas fits the puzzle; nil → the estimate in `boardBox`.
    var boardNatural: CGSize? = nil

    private var titleArt: String? { mode.flatMap(GameTitleArt.forMode)?.asset }

    // MARK: §S2 layout — the canvas is sized to its content

    static let width: CGFloat = 1080
    /// The board block's target width (88%); the 4:5 … 9:16 clamp lives in ShareCardPlan.
    private static let boardWidth: CGFloat = 950

    private static let infoH: CGFloat = 50
    private static let windowH: CGFloat = 124
    private static let castW: CGFloat = 972
    private static let bottomPad: CGFloat = 40

    /// The title art's aspect (nil = the lettered fallback).
    private var titleAspect: Double? {
        guard let art = titleArt, ArtAsset.exists(art), let a = ArtAsset.aspect(art), a > 0 else { return nil }
        return Double(a)
    }

    /// Founder 10-06: the FULL title art, fit to the card width inside 90-px margins (≤ 210 tall).
    private var titleBox: CGSize {
        let t = ShareCardPlan.titleSize(aspect: titleAspect)
        return CGSize(width: t.width, height: t.height)
    }

    /// Everything but the board.
    private var fixedH: CGFloat {
        CGFloat(ShareCardPlan.fixedHeight(titleAspect: titleAspect, rest: Double(
            18 + Self.infoH + 30 + 34 + Self.windowH + 40
                + ShareCastWordmark.height(Self.castW) + Self.bottomPad + Double(heroBand))))
    }

    /// The board body's natural size (measured, else estimated).
    private var natural: CGSize {
        if let n = boardNatural, n.width > 0, n.height > 0 { return n }
        return boardBox
    }

    /// The card planned top-down (Core ShareCardPlan): fill 88% of the width; tall boards
    /// scale by height so the canvas stays inside the clamp; title pinned at the top.
    private var plan: ShareCardPlan.Card {
        ShareCardPlan.plan(titleAspect: titleAspect, fixed: Double(fixedH),
                           board: .init(width: Double(natural.width), height: Double(natural.height)),
                           boardMaxW: Double(Self.boardWidth))
    }

    var size: CGSize { CGSize(width: Self.width, height: CGFloat(plan.height)) }

    /// The result board on its own (what `boardNatural` measures).
    var boardBody: some View { body(for: kind) }

    /// The estimate used when the board wasn't measured.
    private var boardBox: CGSize {
        switch kind {
        case .single: return CGSize(width: 700, height: 880)
        case .multi(let boards, _, _): return boards.count > 4 ? CGSize(width: 934, height: 1160) : CGSize(width: 742, height: 1240)
        case .gauntlet: return CGSize(width: 960, height: 560)
        case .sudoku, .regions, .wordsearch: return CGSize(width: 780, height: 790)
        case .ladder: return CGSize(width: 600, height: 790)
        case .hub, .cryptogram, .groups, .crossword, .scramble: return CGSize(width: 960, height: 730)
        }
    }

    /// The tray's identity: the game's accent, purple when won, slate when lost.
    private var trayState: GameTrayState { won ? .won : .lost }

    var body: some View {
        let p = plan
        let n = natural
        let scale = CGFloat(p.boardScale)
        let boardH = CGFloat(p.boardH)
        ZStack(alignment: .top) {
            if let mode { ShareWall(tint: .forGame(mode)) } else { bg }
            VStack(spacing: 0) {
                ShareTitleBand(asset: titleAspect != nil ? titleArt : nil, size: titleBox,
                               text: modeLabel, color: accent)
                    .padding(.top, CGFloat(ShareCardPlan.topPad))
                if heroBand > 0 { ShareHeroBand(result: heroResult) }
                infoRow.frame(height: Self.infoH).padding(.top, 18)

                // The board block in its planned box (the 4:5 floor's slack centers it).
                body(for: kind)
                    .fixedSize()
                    .frame(width: n.width, height: n.height)
                    .scaleEffect(scale)
                    .frame(width: n.width * scale, height: boardH)
                    .frame(height: boardH + CGFloat(p.slack))
                    .padding(.top, 30)

                ShareStatRow(items: windows, height: Self.windowH)
                    .padding(.horizontal, 54)
                    .padding(.top, 34)
                ShareCastWordmark(width: Self.castW)
                    .padding(.top, 40)
                    .padding(.bottom, Self.bottomPad)
            }
            // Pinned to the top: anything taller than the canvas runs off the bottom,
            // never pushing the title off the top (founder 10-06).
            .frame(width: size.width, height: size.height, alignment: .top)
        }
        .frame(width: size.width, height: size.height, alignment: .top)
        .clipped()
    }

    /// One compact info line: date · guesses · time, the ProperNoundle category pill,
    /// and the W / L badge.
    private var infoRow: some View {
        HStack(spacing: 14) {
            ShareDateLine(text: infoText, size: 30)
            if let category {
                Text(category.uppercased()).font(Brand.fixedFont(22, .black)).tracking(2)
                    .foregroundStyle(accent.mixed(over: .black, 0.75))
                    .padding(.horizontal, 16).frame(height: 40)
                    .background(Capsule().fill(accent.wash(0.16)))
                    .overlay(Capsule().strokeBorder(accent.wash(0.40), lineWidth: 3))
            }
            ShareResultBadge(won: won, size: 46)
        }
        .padding(.horizontal, 48)
    }

    private var infoText: String {
        let g = won ? "\(guesses)" : "X"
        switch kind {
        case .single, .multi: return "\(dateLineText) · \(g)/\(maxGuesses) · \(timeText)"
        case .gauntlet: return "\(dateLineText) · \(guesses) guesses · \(timeText)"
        case .hub: return dateLineText
        default: return "\(dateLineText) · \(timeText)"
        }
    }

    private var timeText: String { "\(timeSeconds / 60):\(String(format: "%02d", timeSeconds % 60))" }
    private func numberPrefix(_ n: Int?) -> String { n.map { " · #\($0)" } ?? "" }

    /// The date line carries whatever the three windows don't (puzzle number,
    /// difficulty / size, par, rank name).
    private var dateLineText: String {
        let d = ShareCast.dateLine(dateStr)
        switch kind {
        case .single, .multi, .gauntlet: return d
        case .sudoku(_, _, _, _, let difficulty, let n): return "\(d)\(numberPrefix(n)) · \(difficulty)"
        case .regions(_, _, _, _, _, let sizeLabel, let n): return "\(d)\(numberPrefix(n)) · \(sizeLabel)"
        case .ladder(_, _, _, _, let par, _, let n): return "\(d)\(numberPrefix(n)) · Par \(par)"
        case .wordsearch(_, _, _, _, _, let n): return "\(d)\(numberPrefix(n))"
        case .hub(_, _, _, _, _, let n): return "\(d)\(numberPrefix(n))"
        case .cryptogram(_, _, let n): return "\(d)\(numberPrefix(n))"
        case .groups(_, _, _, let n): return "\(d)\(numberPrefix(n))"
        case .crossword(_, _, _, _, let n): return "\(d)\(numberPrefix(n))"
        case .scramble(_, _, _, _, _, let n): return "\(d)\(numberPrefix(n))"
        }
    }

    /// The three tinted windows (purple · blue · gold), semantics-aware per mode
    /// (More Games §11: mistakes / checks / moves, never "guesses" where they don't apply).
    private var windows: [(value: String, label: String, tone: ShareStatWindow.Tone)] {
        let g = won ? "\(guesses)" : "X"
        func third(_ fallback: (String, String)) -> (value: String, label: String, tone: ShareStatWindow.Tone) {
            if let points { return (points.formatted(), "POINTS", .gold) }
            return (fallback.0, fallback.1, .gold)
        }
        let time = (value: timeText, label: "TIME", tone: ShareStatWindow.Tone.blue)
        switch kind {
        case .single:
            return [("\(g)/\(maxGuesses)", "GUESSES", .purple), time, third((won ? "WIN" : "LOSS", "RESULT"))]
        case .multi(_, let solved, let total):
            return [("\(g)/\(maxGuesses)", "GUESSES", .purple), time, third(("\(solved)/\(total)", "BOARDS"))]
        case .gauntlet(_, let done, let total):
            return [("\(guesses)", "GUESSES", .purple), time, third(("\(done)/\(total)", "STAGES"))]
        case .sudoku(_, _, _, let mistakes, _, _), .regions(_, _, _, _, let mistakes, _, _):
            return [(won ? "\(mistakes)" : "OUT", "MISTAKES", .purple), time, third((won ? "WIN" : "LOSS", "RESULT"))]
        case .ladder(_, _, _, _, let par, let moves, _):
            let over = moves - par
            return [(won ? (over <= 0 ? "PAR" : "+\(over)") : "OUT", "MOVES", .purple), time, third(("\(moves)", "STEPS"))]
        case .wordsearch(_, let words, let found, let misses, _, _):
            return [("\(found.count)/\(words.count)", "FOUND", .purple), time, third(("\(misses)", "MISSES"))]
        case .hub(_, let pct, let wordsFound, _, let pangramsFound, _):
            return [("\(wordsFound)", "WORDS", .purple), ("\(pangramsFound)", "PANGRAMS", .blue), third(("\(pct)%", "OF MAX"))]
        case .cryptogram(_, let checks, _):
            return [(won ? "\(checks)" : "REVEAL", "CHECKS", .purple), time, third((won ? "WIN" : "LOSS", "RESULT"))]
        case .groups(let solvedTiers, let mistakes, _, _):
            return [("\(solvedTiers.count)/\(GROUPS_TOTAL_BOARDS)", "GROUPS", .purple), time, third(("\(mistakes)", "MISTAKES"))]
        case .crossword(_, _, _, let checks, _):
            return [(won ? (checks == 0 ? "CLEAN" : "\(checks)") : "REVEAL", "CHECKS", .purple), time, third((won ? "WIN" : "LOSS", "RESULT"))]
        case .scramble(_, _, _, let checks, let solvedCount, _):
            return [("\(solvedCount)/\(SCRAMBLE_TOTAL_BOARDS)", "SOLVED", .purple), time, third(("\(checks)", "CHECKS"))]
        }
    }

    @ViewBuilder
    private func body(for kind: Kind) -> some View {
        switch kind {
        case .single(let grid):
            boardCard(grid: grid, letters: reveal ? letters : nil, won: won,
                      maxSide: 760, maxHeight: 1100, groups: wordGroups,
                      answerCaption: reveal && !won ? solutionDisplay : nil)
        case .multi(let boards, _, _):
            // §S2: a tight 2 × 2 (4 × 2 for eight boards), gap ≈ 4% of the width;
            // each board fills its column width (tall boards scale the block by height).
            let cols = boards.count <= 4 ? 2 : 4
            let side: CGFloat = boards.count <= 4 ? 356 : 220
            let gap: CGFloat = boards.count <= 4 ? 30 : 18
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(side), spacing: gap), count: cols), spacing: gap) {
                ForEach(0..<boards.count, id: \.self) { i in
                    boardCard(grid: boards[i].grid, letters: reveal ? boards[i].letters : nil,
                              won: boards[i].won, maxSide: side, maxHeight: side * 3,
                              answerCaption: reveal && !boards[i].won ? boards[i].solution : nil,
                              reserveCaption: reveal)
                }
            }
        case .gauntlet(let stages, _, _):
            VStack(spacing: 16) {
                ForEach(0..<stages.count, id: \.self) { i in gauntletChip(i + 1, stages[i]) }
            }
            .padding(.horizontal, 60)
        case .sudoku(let givens, let board, let hintMask, _, _, _):
            sudokuCard(givens: givens, board: board, hintMask: hintMask)
        case .regions(let n, let regions, let board, let hintMask, _, _, _):
            regionsCard(n: n, regions: regions, board: board, hintMask: hintMask)
        case .ladder(let start, let end, let words, let hintMask, _, _, _):
            ladderCard(start: start, end: end, words: words, hintMask: hintMask)
        case .wordsearch(let n, let words, let found, _, _, _):
            wordsearchCard(n: n, words: words, found: found)
        case .hub(let rankName, let pct, _, _, _, _):
            hubCard(rankName: rankName, pct: pct)
        case .cryptogram(let cipher, _, _):
            cryptogramCard(cipher: cipher)
        case .groups(let solvedTiers, let mistakes, let maxMistakes, _):
            groupsCard(solvedTiers: solvedTiers, mistakes: mistakes, maxMistakes: maxMistakes)
        case .crossword(let w, let h, let solution, _, _):
            crosswordCard(w: w, h: h, solution: solution)
        case .scramble(let wordLengths, let circled, let pattern, _, _, _):
            scrambleCard(wordLengths: wordLengths, circled: circled, pattern: pattern)
        }
    }

    /// Web drawScramble parity: four rows of blank white tiles left-aligned on
    /// one six-column grid, the circled positions ringed in purple; a divider;
    /// then the punchline row grouped by word in the lilac tint, every box
    /// ringed. No letters, no cartoon — the card spoils nothing.
    private func scrambleCard(wordLengths: [Int], circled: [[Int]], pattern: [Int]) -> some View {
        let ring = Color(hex: 0x7C3AED)
        let lilacBorder = Color(hex: 0x8B5CF6)
        let gap: CGFloat = 10, rowGap: CGFloat = 26, cols = 6
        let areaHeight: CGFloat = 660
        let tile = min(84, floor((1080 - 200 - gap * CGFloat(cols - 1)) / CGFloat(cols)), floor((areaHeight - 120 - rowGap * 5) / 5))
        let boardW = CGFloat(cols) * tile + CGFloat(cols - 1) * gap
        let small = floor(tile * 0.78), wordGap: CGFloat = 26
        return VStack(spacing: 0) {
            VStack(spacing: rowGap) {
                ForEach(0..<wordLengths.count, id: \.self) { r in
                    HStack(spacing: gap) {
                        ForEach(0..<wordLengths[r], id: \.self) { i in
                            ShareTile(fill: .frost(), size: tile)
                                .overlay(r < circled.count && circled[r].contains(i)
                                         ? Circle().stroke(ring, lineWidth: 4).frame(width: tile * 0.68, height: tile * 0.68) : nil)
                                .frame(width: tile, height: tile)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(width: boardW)
                }
            }
            Rectangle().fill(accent.wash(0.40)).frame(width: boardW, height: 3).padding(.top, rowGap + 6)
            HStack(spacing: wordGap) {
                ForEach(0..<pattern.count, id: \.self) { wi in
                    HStack(spacing: 6) {
                        ForEach(0..<pattern[wi], id: \.self) { _ in
                            ShareTile(fill: .frost(lilacBorder), size: small)
                                .overlay(Circle().stroke(ring, lineWidth: 3).frame(width: small * 0.64, height: small * 0.64))
                                .frame(width: small, height: small)
                        }
                    }
                }
            }
            .padding(.top, 34)
        }
        .shareTray(accent: accent, state: trayState, padding: 32)
    }

    /// Web drawCrossword parity: the grid silhouette — a purple tile (#ede9fe,
    /// #c4b5fd border) wherever the solution has a letter, nothing where it has
    /// a block; the largest cell that fits the area, centered. No letters, no
    /// numbers — the card spoils nothing.
    private func crosswordCard(w: Int, h: Int, solution: String) -> some View {
        let fill = Color(hex: 0xA78BFA)
        let gap: CGFloat = 6, areaHeight: CGFloat = 660
        let cell = floor(min((1080 - 160 - gap * CGFloat(w - 1)) / CGFloat(max(1, w)), (areaHeight - 60 - gap * CGFloat(h - 1)) / CGFloat(max(1, h))))
        let sol = Array(solution)
        return VStack(spacing: gap) {
            ForEach(0..<h, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<w, id: \.self) { c in
                        let i = r * w + c
                        if i < sol.count, sol[i] != "." {
                            ShareTile(fill: .color(fill), size: cell)
                        } else {
                            Color.clear.frame(width: cell, height: cell)
                        }
                    }
                }
            }
        }
        .shareTray(accent: accent, state: trayState, padding: 28)
    }

    /// Web drawGroups parity: four 720-wide tier bars — the solved tiers filled
    /// from the ramp in solve order with 1–4 pips centered, the unsolved tiers
    /// dashed beneath on a loss — then four mistake dots (accent while a
    /// mistake remains, gray once spent). No words — the card spoils nothing.
    private func groupsCard(solvedTiers: [Int], mistakes: Int, maxMistakes: Int) -> some View {
        let accent = Color(hex: 0x9F1239)
        let ramp: [Int: (bg: Color, fg: Color)] = [
            1: (Color(hex: 0xDDD6FE), Color(hex: 0x3B0764)), 2: (Color(hex: 0xA78BFA), Color(hex: 0x1A1A2E)),
            3: (Color(hex: 0x7C3AED), Color.white), 4: (Color(hex: 0x1A1A2E), Color.white),
        ]
        let missed = (1...GROUPS_TOTAL_BOARDS).filter { !solvedTiers.contains($0) }
        let barW: CGFloat = 720, barH: CGFloat = 108, pip: CGFloat = 22, radius: CGFloat = 24
        func pips(_ tier: Int, _ color: Color) -> some View {
            HStack(spacing: pip * 0.8) {
                ForEach(0..<max(1, min(4, tier)), id: \.self) { _ in Circle().fill(color).frame(width: pip, height: pip) }
            }
        }
        return VStack(spacing: 36) {
            VStack(spacing: 16) {
                ForEach(0..<solvedTiers.count, id: \.self) { i in
                    let st = ramp[solvedTiers[i]] ?? ramp[1]!
                    ShareTile(fill: .color(st.bg), size: barW, height: barH)
                        .overlay(pips(solvedTiers[i], st.fg).padding(.bottom, barH * 0.07))
                }
                ForEach(0..<missed.count, id: \.self) { i in
                    let st = ramp[missed[i]] ?? ramp[1]!
                    RoundedRectangle(cornerRadius: radius).fill(st.bg.opacity(0.18)).frame(width: barW, height: barH)
                        .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(style: StrokeStyle(lineWidth: 4, dash: [16, 12])).foregroundStyle(st.bg.opacity(0.7)))
                        .overlay(pips(missed[i], st.bg.opacity(0.7)))
                }
            }
            HStack(spacing: 22) {
                ForEach(0..<max(1, maxMistakes), id: \.self) { i in
                    Circle().fill(i < maxMistakes - mistakes ? accent : accent.wash(0.18)).frame(width: 40, height: 40)
                }
            }
        }
        .shareTray(accent: self.accent, state: trayState, padding: 32)
    }

    /// Web drawCryptogram parity: the ciphertext as rows of blank white cells
    /// with the code letter in gray monospace beneath each, words wrapped whole,
    /// punctuation in the accent. The largest cell (58 down to 26) whose wrapped
    /// rows fit the area wins. No plain letters — the card spoils nothing.
    private func cryptogramCard(cipher: String) -> some View {
        let accent = Color(hex: 0x92400E), codeInk = Color(hex: 0x9CA3AF)
        let words = cipher.split(separator: " ", omittingEmptySubsequences: false).map(String.init)
        let maxW: CGFloat = 1080 - 70 * 2, areaHeight: CGFloat = 660, gap: CGFloat = 6, wordGap: CGFloat = 22
        func isLetter(_ ch: Character) -> Bool { ch >= "A" && ch <= "Z" }
        func wordWidth(_ w: String, _ cell: CGFloat) -> CGFloat {
            let letters = w.filter(isLetter).count, puncts = w.count - letters
            return CGFloat(letters) * (cell + gap) + CGFloat(puncts) * (cell * 0.45) - gap
        }
        var cell: CGFloat = 58, rows: [[String]] = []
        while cell >= 26 {
            rows = []
            var cur: [String] = [], curW: CGFloat = 0
            for w in words {
                let ww = wordWidth(w, cell)
                if !cur.isEmpty && curW + wordGap + ww > maxW { rows.append(cur); cur = []; curW = 0 }
                curW += (cur.isEmpty ? 0 : wordGap) + ww; cur.append(w)
            }
            if !cur.isEmpty { rows.append(cur) }
            let rowH = cell + 40
            if CGFloat(rows.count) * rowH + CGFloat(rows.count - 1) * 10 <= areaHeight - 40 || cell == 26 { break }
            cell -= 4
        }
        let side = cell
        return VStack(spacing: 10) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(alignment: .top, spacing: wordGap) {
                    ForEach(0..<rows[r].count, id: \.self) { i in
                        HStack(alignment: .top, spacing: gap) {
                            ForEach(Array(rows[r][i].enumerated()), id: \.offset) { _, ch in
                                if isLetter(ch) {
                                    VStack(spacing: 6) {
                                        ShareTile(fill: .frost(), size: side)
                                        Text(String(ch)).font(.system(size: floor(side * 0.34), weight: .heavy, design: .monospaced)).foregroundStyle(codeInk)
                                            .frame(height: 22)
                                    }
                                } else {
                                    Text(String(ch)).font(Brand.fixedFont(floor(side * 0.6), .black)).foregroundStyle(accent)
                                        .frame(width: max(8, side * 0.45 - gap), height: side)
                                }
                            }
                        }
                    }
                }
            }
        }
        .shareTray(accent: self.accent, state: trayState, padding: 28)
    }

    /// Web drawHub parity: the 2-3-2 cluster as blank tiles with the center in
    /// the accent, the rank name large beneath, then % of the maximum.
    private func hubCard(rankName: String, pct: Int) -> some View {
        let tile: CGFloat = 150, gap: CGFloat = 18, accent = Color(hex: 0xC026D3)
        func blank() -> some View { ShareTile(fill: .frost(), size: tile) }
        return VStack(spacing: 24) {
            VStack(spacing: gap) {
                HStack(spacing: gap) { blank(); blank() }
                HStack(spacing: gap) { blank(); ShareTile(fill: .color(accent), size: tile); blank() }
                HStack(spacing: gap) { blank(); blank() }
            }
            Text(rankName.uppercased()).font(Brand.fixedFont(64, .black)).foregroundStyle(accent)
                .shadow(color: .white.opacity(0.8), radius: 0, x: 0, y: 2)
            Text("\(pct)% of the maximum").font(Brand.fixedFont(30, .bold)).foregroundStyle(ShareInk.muted)
        }
        .shareTray(accent: self.accent, state: trayState, padding: 32)
    }

    /// Web drawWordsearch parity: 720pt card, a dot grid with the found words as
    /// accent capsules laid along their lines. No letters.
    private func wordsearchCard(n: Int, words: [WordsearchPlacement], found: [String]) -> some View {
        let side: CGFloat = 720, pad: CGFloat = 24
        let count = max(1, n)
        let cell = (side - pad * 2) / CGFloat(count)
        let accent = Color(hex: 0x4D7C0F)
        return Canvas { ctx, _ in
            func center(_ r: Int, _ c: Int) -> CGPoint { CGPoint(x: pad + (CGFloat(c) + 0.5) * cell, y: pad + (CGFloat(r) + 0.5) * cell) }
            for w in words where found.contains(w.w) {
                let (dr, dc) = WORDSEARCH_DIRS[w.d] ?? (0, 1)
                var p = Path(); p.move(to: center(w.r, w.c)); p.addLine(to: center(w.r + dr * (w.w.count - 1), w.c + dc * (w.w.count - 1)))
                ctx.stroke(p, with: .color(accent.opacity(0.4)), style: StrokeStyle(lineWidth: cell * 0.72, lineCap: .round))
            }
            for r in 0..<count { for c in 0..<count {
                let ce = center(r, c)
                ctx.fill(Path(ellipseIn: CGRect(x: ce.x - cell * 0.12, y: ce.y - cell * 0.12, width: cell * 0.24, height: cell * 0.24)), with: .color(Color(hex: 0x8B5CF6).opacity(0.45)))
            } }
        }
        .frame(width: side, height: side)
        .shareTray(accent: self.accent, state: trayState, padding: 8)
    }

    /// Web drawLadder parity: START purple with letters, END dashed in the accent
    /// with letters, rungs white with only the changed tile filled (accent; violet
    /// for a hint rung). No rung word is ever drawn.
    private func ladderCard(start: String, end: String, words: [String], hintMask: String) -> some View {
        let list = words.isEmpty ? [start] : words
        var rows: [(word: String, prev: String?, kind: String)] = list.enumerated().map { i, w in
            (w, i > 0 ? list[i - 1] : nil, i == 0 ? "start" : (i < hintMask.count && Array(hintMask)[i] == "1" ? "hint" : "rung"))
        }
        if list.last != end { rows.append((end, nil, "end")) }
        let gap: CGFloat = 10, maxTile: CGFloat = 96
        let tile = min(maxTile, floor((720 - gap * CGFloat(rows.count - 1)) / CGFloat(rows.count)), floor((880 - gap * 4) / 5))
        let accent = Color(hex: 0x0284C7), hint = Color(hex: 0x8B5CF6), start = Color(hex: 0x7C3AED)
        return VStack(spacing: gap) {
            ForEach(0..<rows.count, id: \.self) { r in
                let row = rows[r]
                let chars = Array(row.word.padding(toLength: 5, withPad: " ", startingAt: 0))
                let prev = row.prev.map(Array.init)
                HStack(spacing: gap) {
                    ForEach(0..<5, id: \.self) { c in
                        let changed = prev.map { $0[c] != chars[c] } ?? false
                        let radius = max(6, tile * 0.14)
                        ZStack {
                            switch row.kind {
                            case "start":
                                ShareTile(fill: .color(start), letter: String(chars[c]), size: tile)
                            case "end":
                                RoundedRectangle(cornerRadius: radius).strokeBorder(style: StrokeStyle(lineWidth: 3, dash: [8, 6])).foregroundStyle(accent.opacity(0.55))
                                Text(String(chars[c])).font(Brand.fixedFont(tile * 0.5, .black)).foregroundStyle(accent)
                            default:
                                if changed { ShareTile(fill: .color(row.kind == "hint" ? hint : accent), size: tile) }
                                else { ShareTile(fill: .frost(), size: tile) }
                            }
                        }
                        .frame(width: tile, height: tile)
                    }
                }
            }
        }
        .shareTray(accent: self.accent, state: trayState, padding: 28)
    }

    /// Web drawRegions parity: 720pt card, tinted squares gapped 4, placed stars
    /// as dark dots (hint stars violet), inside the win/loss-bordered frame.
    private func regionsCard(n: Int, regions: String, board: String, hintMask: String) -> some View {
        let side: CGFloat = 720, pad: CGFloat = 16, gap: CGFloat = 4
        let count = max(1, n)
        let cell = (side - pad * 2 - gap * CGFloat(count - 1)) / CGFloat(count)
        let reg = Array(regions), b = Array(board), h = Array(hintMask)
        let ok = reg.count == count * count
        return VStack(spacing: gap) {
            ForEach(0..<count, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<count, id: \.self) { c in
                        let i = r * count + c
                        let g = ok ? Int(reg[i].asciiValue ?? 48) - 48 : 0
                        ZStack {
                            ShareTile(fill: .color(StarsweepPalette.tone(g).pastel), size: cell)
                            if b.count == count * count && b[i] == "*" {
                                Circle().fill(h.count == count * count && h[i] == "1" ? Color(hex: 0x8B5CF6) : ShareInk.number)
                                    .frame(width: cell * 0.48, height: cell * 0.48)
                                    .padding(.bottom, cell * 0.07)
                            }
                        }
                        .frame(width: cell, height: cell)
                    }
                }
            }
        }
        .shareTray(accent: accent, state: trayState, padding: pad + 8)
    }

    /// Web drawSudoku parity: 720pt card, squares gapped 4 with a wider 12 gap
    /// between boxes, inside the win/loss-bordered frame the word boards use.
    private func sudokuCard(givens: String, board: String, hintMask: String) -> some View {
        let side: CGFloat = 720, pad: CGFloat = 16, gap: CGFloat = 4, boxGap: CGFloat = 12
        let cell = (side - pad * 2 - gap * 6 - boxGap * 2) / 9
        let g = Array(givens), b = Array(board), h = Array(hintMask)
        return VStack(spacing: 0) {
            ForEach(0..<9, id: \.self) { r in
                HStack(spacing: 0) {
                    ForEach(0..<9, id: \.self) { c in
                        let i = r * 9 + c
                        let color: Color? = (g.count == 81 && g[i] != "0") ? Color(hex: 0x3B1A78)
                            : (h.count == 81 && h[i] == "1") ? Color(hex: 0x8B5CF6)
                            : (b.count == 81 && b[i] != "0") ? Color(hex: 0x7C3AED) : nil
                        ShareTile(fill: color.map { .color($0) } ?? .frost(), size: cell)
                        if c < 8 { Spacer().frame(width: c % 3 == 2 ? boxGap : gap) }
                    }
                }
                if r < 8 { Spacer().frame(height: r % 3 == 2 ? boxGap : gap) }
            }
        }
        .shareTray(accent: accent, state: trayState, padding: pad + 8)
    }

    private func boardCard(grid: [[TileState]], letters: [[String]]? = nil, won: Bool,
                           maxSide: CGFloat, maxHeight: CGFloat? = nil, groups: [Int]? = nil,
                           answerCaption: String? = nil, reserveCaption: Bool = false) -> some View {
        let cols = grid.first?.count ?? 5
        let rows = grid.count
        let gap: CGFloat = max(3, maxSide * 0.012)
        let pad: CGFloat = maxSide * 0.04
        let inner = maxSide - pad * 2
        // The width budget is `maxSide`; the height budget `maxHeight` (default square).
        let innerH = (maxHeight ?? maxSide) - pad * 2
        // Web parity (share-image.ts): multi-word answers get a full tile-width
        // gap between name groups. Two-pass sizing — uniform tile first, derive
        // the group gap from it, then re-fit the row with the gaps baked in.
        let validGroups: [Int]? = (groups?.reduce(0, +) == cols && (groups?.count ?? 0) > 1) ? groups : nil
        let tile1 = floor(min((inner - gap * CGFloat(cols - 1)) / CGFloat(cols),
                              (innerH - gap * CGFloat(rows - 1)) / CGFloat(max(rows, 1))))
        let groupGap: CGFloat = validGroups != nil ? max(gap * 4, tile1) : gap
        let extra: CGFloat = validGroups != nil ? CGFloat(validGroups!.count - 1) * (groupGap - gap) : 0
        let tile = floor(min((inner - gap * CGFloat(cols - 1) - extra) / CGFloat(cols),
                             (innerH - gap * CGFloat(rows - 1)) / CGFloat(max(rows, 1))))
        // Column ranges per group (uniform = one group spanning all columns).
        let chunks: [Range<Int>] = {
            guard let g = validGroups else { return [0..<cols] }
            var out: [Range<Int>] = []; var start = 0
            for size in g { out.append(start..<(start + size)); start += size }
            return out
        }()
        let captionH: CGFloat = (answerCaption != nil || reserveCaption) ? 44 : 0
        return VStack(spacing: 0) {
            VStack(spacing: gap) {
                ForEach(0..<rows, id: \.self) { r in
                    HStack(spacing: groupGap) {
                        ForEach(0..<chunks.count, id: \.self) { gi in
                            HStack(spacing: gap) {
                                ForEach(chunks[gi], id: \.self) { c in
                                    ShareTile(fill: .face(GlossyFace(revealed: grid[r][c])),
                                              letter: tileLetter(letters?[safe: r]?[safe: c], state: grid[r][c]),
                                              size: tile)
                                }
                            }
                        }
                    }
                }
            }
            .shareTray(accent: accent, state: won ? .won : .lost, radius: max(20, maxSide * 0.06), padding: pad)
            // Revealed loss: the answer never appears in the tiles, so spell it
            // out under the board — same treatment as the completed-puzzle page.
            if captionH > 0 {
                Text(answerCaption?.uppercased() ?? " ")
                    .font(Brand.fixedFont(min(30, max(16, tile * 0.6)), .black))   // fixed-size share image
                    .foregroundStyle(lossFG)
                    .lineLimit(1).minimumScaleFactor(0.5)
                    .frame(height: captionH)
            }
        }
    }

    /// "Full results" glyph for a tile; EMPTY tiles and missing letters draw
    /// nothing (the spoiler-free variant passes nil rows).
    private func tileLetter(_ letter: String?, state: TileState) -> String {
        guard let letter, !letter.isEmpty, state != .empty else { return "" }
        return letter.uppercased()
    }

    /// One Gauntlet stage as a tinted card with a top bar (purple cleared / slate
    /// missed), the stage number as a soft number and the W / L badge art.
    private func gauntletChip(_ index: Int, _ s: GauntletStageShare) -> some View {
        let ink = s.won ? Color(hex: 0x7C3AED) : Color(hex: 0x6B7891)
        let shape = RoundedRectangle(cornerRadius: 30, style: .continuous)
        return HStack(spacing: 20) {
            Text("\(index)").shareSoftNumber(44).frame(minWidth: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(s.name).font(Brand.fixedFont(30, .black)).foregroundStyle(ShareInk.heading)
                Text("\(s.boardsSolved)/\(s.totalBoards) boards · \(s.guesses) guesses")
                    .font(Brand.fixedFont(20, .bold)).foregroundStyle(ShareInk.muted)
            }
            Spacer()
            ShareResultBadge(won: s.won, size: 58)
        }
        .padding(.horizontal, 26).padding(.top, 26).padding(.bottom, 16)
        .background(
            ZStack(alignment: .top) {
                shape.fill(ink.wash(0.09))
                LinearGradient(colors: [ink, ink.wash(0.6)], startPoint: .leading, endPoint: .trailing).frame(height: 10)
            }
            .clipShape(shape)
        )
        .overlay(shape.strokeBorder(ink.wash(0.28), lineWidth: 3))
        .shadow(color: Color(hex: 0x3C1E6E).opacity(0.10), radius: 12, x: 0, y: 8)
    }
}

struct GauntletStageShare {
    let name: String
    let won: Bool
    let guesses: Int
    let boardsSolved: Int
    let totalBoards: Int
}
