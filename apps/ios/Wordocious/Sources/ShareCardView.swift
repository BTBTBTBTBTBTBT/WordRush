import SwiftUI
import WordociousCore

/// Pixel-faithful port of the web share image (lib/share-image.ts, single
/// layout) — 1080×1350, rendered to PNG via ImageRenderer. Same palette,
/// wordmark gradient, mode label, stats line + Win/Loss pill, tinted board
/// card with colored border, and wordocious.com footer.
struct ShareCardView: View {
    let modeLabel: String       // e.g. "CLASSIC", "CLASSIC SIX", "QUADWORD"
    let accent: Color
    let won: Bool
    let guesses: Int
    let maxGuesses: Int
    let timeSeconds: Int
    let dateStr: String
    let grid: [[TileState]]     // padded to maxGuesses rows

    // Palette from share-image.ts
    private let bg = Color(hex: 0xF8F7FF)
    private let textMuted = Color(hex: 0x6B7280)
    private let winFG = Color(hex: 0x16A34A), winBG = Color(hex: 0xDCFCE7)
    private let lossFG = Color(hex: 0xDC2626), lossBG = Color(hex: 0xFEE2E2)
    private let boardWinTint = Color(hex: 0xF0FDF4), boardLossTint = Color(hex: 0xFEF2F2)

    static let size = CGSize(width: 1080, height: 1350)

    var body: some View {
        ZStack {
            bg
            VStack(spacing: 0) {
                Text("WORDOCIOUS")
                    .font(.custom("Nunito", size: 56).weight(.black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 44)
                Text(modeLabel)
                    .font(.custom("Nunito", size: 38).weight(.black))
                    .foregroundStyle(accent)
                    .padding(.top, 10)
                HStack(spacing: 12) {
                    Text(statsText).font(.custom("Nunito", size: 24).weight(.bold)).foregroundStyle(textMuted)
                    Text(won ? "Win" : "Loss")
                        .font(.custom("Nunito", size: 22).weight(.bold))
                        .foregroundStyle(won ? winFG : lossFG)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(won ? winBG : lossBG))
                }
                .padding(.top, 22)

                Spacer()
                boardCard
                Spacer()

                Text("wordocious.com")
                    .font(.custom("Nunito", size: 22).weight(.bold)).foregroundStyle(Color(hex: 0x9CA3AF))
                    .padding(.bottom, 40)
            }
        }
        .frame(width: Self.size.width, height: Self.size.height)
    }

    private var statsText: String {
        let g = won ? "\(guesses)" : "X"
        let m = timeSeconds / 60, s = timeSeconds % 60
        return "\(g)/\(maxGuesses) · \(m):\(String(format: "%02d", s)) · \(dateStr)"
    }

    private var boardCard: some View {
        let cols = grid.first?.count ?? 5
        let rows = grid.count
        let gap: CGFloat = 8
        let cardPad: CGFloat = 24
        let maxBoardW: CGFloat = 760
        let maxBoardH: CGFloat = 760
        let tile = floor(min((maxBoardW - gap * CGFloat(cols - 1)) / CGFloat(cols),
                             (maxBoardH - gap * CGFloat(rows - 1)) / CGFloat(max(rows, 1))))
        return VStack(spacing: gap) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let state = grid[r][c]
                        RoundedRectangle(cornerRadius: max(6, tile * 0.12))
                            .fill(tileColor(state))
                            .frame(width: tile, height: tile)
                            .overlay(state == .empty ? RoundedRectangle(cornerRadius: max(6, tile * 0.12))
                                .stroke(Color(hex: 0xD1D5DB), lineWidth: 2) : nil)
                    }
                }
            }
        }
        .padding(cardPad)
        .background(RoundedRectangle(cornerRadius: 28).fill(won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(won ? winFG : lossFG, lineWidth: 6))
    }

    /// Share-image tile palette (note: ABSENT is #9ca3af here, lighter than
    /// the in-app gray — matches share-image.ts).
    private func tileColor(_ s: TileState) -> Color {
        switch s {
        case .correct: return Color(hex: 0x16A34A)
        case .present: return Color(hex: 0xEAB308)
        case .absent, .hintUsed: return Color(hex: 0x9CA3AF)
        case .empty: return Color(hex: 0xE5E7EB)
        }
    }
}
