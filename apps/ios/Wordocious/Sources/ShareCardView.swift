import SwiftUI
import WordociousCore

/// Faithful port of the web share image (lib/share-image.ts) — single, multi,
/// and gauntlet layouts — rendered to PNG via ImageRenderer. Same palette,
/// wordmark gradient, mode label, stats line + Win/Loss pill, and footer.
struct ShareCardView: View {
    enum Kind {
        case single(grid: [[TileState]])
        case multi(boards: [(grid: [[TileState]], won: Bool)], boardsSolved: Int, totalBoards: Int)
        case gauntlet(stages: [GauntletStageShare], stagesCompleted: Int, totalStages: Int)
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
        case .single: return CGSize(width: 1080, height: 1080)
        }
    }

    var body: some View {
        ZStack {
            bg
            VStack(spacing: 0) {
                Text("WORDOCIOUS")
                    .font(.custom("Nunito", size: 56).weight(.black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 44)
                Text(modeLabel).font(.custom("Nunito", size: 38).weight(.black)).foregroundStyle(accent).padding(.top, 10)
                HStack(spacing: 12) {
                    Text(statsText).font(.custom("Nunito", size: 24).weight(.bold)).foregroundStyle(textMuted)
                    // ProperNoundle category pill (web drawCategoryPill — accent
                    // capsule, white 18px label, between stats and Win/Loss).
                    if let category {
                        Text(category).font(.custom("Nunito", size: 18).weight(.bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).frame(height: 30)
                            .background(RoundedRectangle(cornerRadius: 14).fill(accent))
                    }
                    Text(won ? "Win" : "Loss").font(.custom("Nunito", size: 22).weight(.bold))
                        .foregroundStyle(won ? winFG : lossFG)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(won ? winBG : lossBG))
                }
                .padding(.top, 22)

                Spacer()
                body(for: kind)
                Spacer()

                Text("wordocious.com").font(.custom("Nunito", size: 22).weight(.bold))
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
        }
    }

    @ViewBuilder
    private func body(for kind: Kind) -> some View {
        switch kind {
        case .single(let grid):
            boardCard(grid: grid, won: won, maxSide: 760, groups: wordGroups)
        case .multi(let boards, _, _):
            let cols = boards.count <= 4 ? 2 : 4
            let side: CGFloat = boards.count <= 4 ? 380 : 220
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(side), spacing: 24), count: cols), spacing: 24) {
                ForEach(0..<boards.count, id: \.self) { i in
                    boardCard(grid: boards[i].grid, won: boards[i].won, maxSide: side)
                }
            }
        case .gauntlet(let stages, _, _):
            VStack(spacing: 16) {
                ForEach(0..<stages.count, id: \.self) { i in gauntletChip(i + 1, stages[i]) }
            }
            .padding(.horizontal, 60)
        }
    }

    private func boardCard(grid: [[TileState]], won: Bool, maxSide: CGFloat, groups: [Int]? = nil) -> some View {
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
        return VStack(spacing: gap) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: groupGap) {
                    ForEach(0..<chunks.count, id: \.self) { gi in
                        HStack(spacing: gap) {
                            ForEach(chunks[gi], id: \.self) { c in
                                RoundedRectangle(cornerRadius: max(4, tile * 0.12)).fill(tileColor(grid[r][c]))
                                    .frame(width: tile, height: tile)
                                    .overlay(grid[r][c] == .empty ? RoundedRectangle(cornerRadius: max(4, tile * 0.12))
                                        .stroke(Color(hex: 0xD1D5DB), lineWidth: 1.5) : nil)
                            }
                        }
                    }
                }
            }
        }
        .padding(pad)
        .background(RoundedRectangle(cornerRadius: 18).fill(won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(won ? winFG : lossFG, lineWidth: 4))
    }

    private func gauntletChip(_ index: Int, _ s: GauntletStageShare) -> some View {
        HStack(spacing: 16) {
            Text("\(index)").font(.custom("Nunito", size: 32).weight(.black)).foregroundStyle(s.won ? winFG : lossFG)
            VStack(alignment: .leading, spacing: 2) {
                Text(s.name).font(.custom("Nunito", size: 30).weight(.black)).foregroundStyle(Color(hex: 0x1A1A2E))
                Text("\(s.boardsSolved)/\(s.totalBoards) boards · \(s.guesses) guesses")
                    .font(.custom("Nunito", size: 20).weight(.bold)).foregroundStyle(textMuted)
            }
            Spacer()
            Text(s.won ? "✓" : "✗").font(.custom("Nunito", size: 48).weight(.black)).foregroundStyle(s.won ? winFG : lossFG)
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
