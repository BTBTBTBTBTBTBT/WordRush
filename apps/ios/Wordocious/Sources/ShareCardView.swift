import SwiftUI
import WordociousCore

/// Faithful port of the web share image (lib/share-image.ts) — single, multi,
/// and gauntlet layouts — rendered to PNG via ImageRenderer. Same palette,
/// wordmark gradient, mode label, stats line + Win/Loss pill, and footer.
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

    private let bg = Color(hex: 0xF8F7FF)
    private let textMuted = Color(hex: 0x6B7280)
    private let winFG = Color(hex: 0x7C3AED), winBG = Color(hex: 0xF5F3FF)
    private let lossFG = Color(hex: 0xDC2626), lossBG = Color(hex: 0xFEE2E2)
    private let boardWinTint = Color(hex: 0xF5F3FF), boardLossTint = Color(hex: 0xFEF2F2)

    /// Canvas matches the web: 1350 tall for OctoWord(8 boards) + Gauntlet, else 1080.
    var size: CGSize {
        switch kind {
        case .gauntlet: return CGSize(width: 1080, height: 1350)
        case .multi(let boards, _, _): return CGSize(width: 1080, height: boards.count > 4 ? 1350 : 1080)
        case .single, .sudoku, .regions, .ladder, .wordsearch: return CGSize(width: 1080, height: 1080)
        }
    }

    var body: some View {
        ZStack {
            bg
            VStack(spacing: 0) {
                Text("WORDOCIOUS")
                    .font(Brand.font(56, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 44)
                Text(modeLabel).font(Brand.font(38, .black)).foregroundStyle(accent).padding(.top, 10)
                HStack(spacing: 12) {
                    Text(statsText).font(Brand.font(24, .bold)).foregroundStyle(textMuted)
                    // ProperNoundle category pill (web drawCategoryPill — accent
                    // capsule, white 18px label, between stats and Win/Loss).
                    if let category {
                        Text(category).font(Brand.font(18, .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).frame(height: 30)
                            .background(RoundedRectangle(cornerRadius: 14).fill(accent))
                    }
                    Text(won ? "Win" : "Loss").font(Brand.font(22, .bold))
                        .foregroundStyle(won ? winFG : lossFG)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(won ? winBG : lossBG))
                }
                .padding(.top, 22)

                Spacer()
                body(for: kind)
                Spacer()

                Text("wordocious.com").font(Brand.font(22, .bold))
                    .foregroundStyle(Color(hex: 0x9CA3AF)).padding(.bottom, 40)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    private var statsText: String {
        let g = won ? "\(guesses)" : "X"
        let t = "\(timeSeconds / 60):\(String(format: "%02d", timeSeconds % 60))"
        switch kind {
        case .single: return "\(g)/\(maxGuesses) · \(t) · \(dateStr)"
        case .multi(_, let solved, let total): return "\(solved)/\(total) boards · \(g)/\(maxGuesses) · \(t) · \(dateStr)"
        case .gauntlet(_, let done, let total): return "\(done)/\(total) stages · \(guesses) guesses · \(t) · \(dateStr)"
        case .sudoku(_, _, _, let mistakes, let difficulty, let number):
            // Semantics-aware (More Games §11): mistakes, never "guesses".
            let m = "\(mistakes) mistake\(mistakes == 1 ? "" : "s")"
            let num = number.map { "#\($0) · " } ?? ""
            return "\(num)\(difficulty) · \(won ? m : "Out of mistakes") · \(t) · \(dateStr)"
        case .regions(_, _, _, _, let mistakes, let sizeLabel, let number):
            let m = "\(mistakes) mistake\(mistakes == 1 ? "" : "s")"
            let num = number.map { "#\($0) · " } ?? ""
            return "\(num)\(sizeLabel) · \(won ? m : "Out of mistakes") · \(t) · \(dateStr)"
        case .ladder(_, _, _, _, let par, let moves, let number):
            let over = moves - par
            let num = number.map { "#\($0) · " } ?? ""
            return "\(num)Par \(par) · \(won ? (over <= 0 ? "On par" : "+\(over)") : "Out of moves") · \(t) · \(dateStr)"
        case .wordsearch(_, let words, let found, let misses, _, let number):
            let num = number.map { "#\($0) · " } ?? ""
            return "\(num)\(found.count)/\(words.count) · \(misses) miss\(misses == 1 ? "" : "es") · \(t) · \(dateStr)"
        }
    }

    @ViewBuilder
    private func body(for kind: Kind) -> some View {
        switch kind {
        case .single(let grid):
            boardCard(grid: grid, letters: reveal ? letters : nil, won: won,
                      maxSide: reveal && !won ? 716 : 760, groups: wordGroups,
                      answerCaption: reveal && !won ? solutionDisplay : nil)
        case .multi(let boards, _, _):
            let cols = boards.count <= 4 ? 2 : 4
            // Revealing reserves a caption strip under every board — shrink the
            // board budget so cell+caption keeps the original grid footprint.
            let side: CGFloat = (boards.count <= 4 ? 380 : 220) - (reveal ? 40 : 0)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(side), spacing: 24), count: cols), spacing: 24) {
                ForEach(0..<boards.count, id: \.self) { i in
                    boardCard(grid: boards[i].grid, letters: reveal ? boards[i].letters : nil,
                              won: boards[i].won, maxSide: side,
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
        }
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
                ctx.fill(Path(ellipseIn: CGRect(x: ce.x - cell * 0.12, y: ce.y - cell * 0.12, width: cell * 0.24, height: cell * 0.24)), with: .color(Color(hex: 0xC4B5FD)))
            } }
        }
        .frame(width: side, height: side)
        .background(RoundedRectangle(cornerRadius: 28).fill(won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(won ? winFG : lossFG, lineWidth: 3))
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
                                RoundedRectangle(cornerRadius: radius).fill(start)
                                Text(String(chars[c])).font(Brand.font(tile * 0.5, .black)).foregroundStyle(.white)
                            case "end":
                                RoundedRectangle(cornerRadius: radius).strokeBorder(style: StrokeStyle(lineWidth: 3, dash: [8, 6])).foregroundStyle(accent.opacity(0.55))
                                Text(String(chars[c])).font(Brand.font(tile * 0.5, .black)).foregroundStyle(accent)
                            default:
                                if changed { RoundedRectangle(cornerRadius: radius).fill(row.kind == "hint" ? hint : accent) }
                                else { RoundedRectangle(cornerRadius: radius).fill(Color.white); RoundedRectangle(cornerRadius: radius).strokeBorder(Color(hex: 0xD1D5DB), lineWidth: 3) }
                            }
                        }
                        .frame(width: tile, height: tile)
                    }
                }
            }
        }
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
                            RoundedRectangle(cornerRadius: max(4, cell * 0.18)).fill(regionsTints[max(0, g) % regionsTints.count])
                            if b.count == count * count && b[i] == "*" {
                                Circle().fill(h.count == count * count && h[i] == "1" ? Color(hex: 0x8B5CF6) : Color(hex: 0x1A1A2E))
                                    .frame(width: cell * 0.48, height: cell * 0.48)
                            }
                        }
                        .frame(width: cell, height: cell)
                    }
                }
            }
        }
        .padding(pad)
        .background(RoundedRectangle(cornerRadius: 28).fill(won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(won ? winFG : lossFG, lineWidth: 3))
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
                        let color: Color = (g.count == 81 && g[i] != "0") ? Color(hex: 0x1A1A2E)
                            : (h.count == 81 && h[i] == "1") ? Color(hex: 0x8B5CF6)
                            : (b.count == 81 && b[i] != "0") ? Color(hex: 0x7C3AED) : Color(hex: 0xE9E5F5)
                        RoundedRectangle(cornerRadius: max(4, cell * 0.18)).fill(color).frame(width: cell, height: cell)
                        if c < 8 { Spacer().frame(width: c % 3 == 2 ? boxGap : gap) }
                    }
                }
                if r < 8 { Spacer().frame(height: r % 3 == 2 ? boxGap : gap) }
            }
        }
        .padding(pad)
        .background(RoundedRectangle(cornerRadius: 28).fill(won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(won ? winFG : lossFG, lineWidth: 3))
    }

    private func boardCard(grid: [[TileState]], letters: [[String]]? = nil, won: Bool,
                           maxSide: CGFloat, groups: [Int]? = nil,
                           answerCaption: String? = nil, reserveCaption: Bool = false) -> some View {
        let cols = grid.first?.count ?? 5
        let rows = grid.count
        let gap: CGFloat = max(3, maxSide * 0.012)
        let pad: CGFloat = maxSide * 0.04
        let inner = maxSide - pad * 2
        // Web parity (share-image.ts): multi-word answers get a full tile-width
        // gap between name groups. Two-pass sizing — uniform tile first, derive
        // the group gap from it, then re-fit the row with the gaps baked in.
        let validGroups: [Int]? = (groups?.reduce(0, +) == cols && (groups?.count ?? 0) > 1) ? groups : nil
        let tile1 = floor(min((inner - gap * CGFloat(cols - 1)) / CGFloat(cols),
                              (inner - gap * CGFloat(rows - 1)) / CGFloat(max(rows, 1))))
        let groupGap: CGFloat = validGroups != nil ? max(gap * 4, tile1) : gap
        let extra: CGFloat = validGroups != nil ? CGFloat(validGroups!.count - 1) * (groupGap - gap) : 0
        let tile = floor(min((inner - gap * CGFloat(cols - 1) - extra) / CGFloat(cols),
                             (inner - gap * CGFloat(rows - 1)) / CGFloat(max(rows, 1))))
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
                                    RoundedRectangle(cornerRadius: max(4, tile * 0.12)).fill(tileColor(grid[r][c]))
                                        .frame(width: tile, height: tile)
                                        .overlay(grid[r][c] == .empty ? RoundedRectangle(cornerRadius: max(4, tile * 0.12))
                                            .stroke(Color(hex: 0xD1D5DB), lineWidth: 1.5) : nil)
                                        .overlay(tileLetter(letters?[safe: r]?[safe: c], state: grid[r][c], tile: tile))
                                }
                            }
                        }
                    }
                }
            }
            .padding(pad)
            .background(RoundedRectangle(cornerRadius: 18).fill(won ? boardWinTint : boardLossTint))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(won ? winFG : lossFG, lineWidth: 4))
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

    /// "Full results" glyph — white, black-weight, centered; EMPTY tiles and
    /// missing letters draw nothing (the spoiler-free variant passes nil rows).
    @ViewBuilder
    private func tileLetter(_ letter: String?, state: TileState, tile: CGFloat) -> some View {
        if let letter, !letter.isEmpty, state != .empty {
            Text(letter.uppercased())
                .font(Brand.font(max(10, tile * 0.55), .black))
                .foregroundStyle(.white)
        }
    }

    private func gauntletChip(_ index: Int, _ s: GauntletStageShare) -> some View {
        HStack(spacing: 16) {
            Text("\(index)").font(Brand.font(32, .black)).foregroundStyle(s.won ? winFG : lossFG)
            VStack(alignment: .leading, spacing: 2) {
                Text(s.name).font(Brand.font(30, .black)).foregroundStyle(Color(hex: 0x1A1A2E))
                Text("\(s.boardsSolved)/\(s.totalBoards) boards · \(s.guesses) guesses")
                    .font(Brand.font(20, .bold)).foregroundStyle(textMuted)
            }
            Spacer()
            Text(s.won ? "✓" : "✗").font(Brand.font(48, .black)).foregroundStyle(s.won ? winFG : lossFG)
        }
        .padding(.horizontal, 24).padding(.vertical, 18)
        .background(RoundedRectangle(cornerRadius: 16).fill(s.won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(s.won ? winFG : lossFG, lineWidth: 3))
    }

    private func tileColor(_ s: TileState) -> Color {
        switch s {
        case .correct: return Color(hex: 0x7C3AED)
        case .present: return Color(hex: 0xF59E0B)
        case .absent, .hintUsed: return Color(hex: 0x9CA3AF)
        case .empty: return Color(hex: 0xE5E7EB)
        }
    }
}

struct GauntletStageShare {
    let name: String
    let won: Bool
    let guesses: Int
    let boardsSolved: Int
    let totalBoards: Int
}
