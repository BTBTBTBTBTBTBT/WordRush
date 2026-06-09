import SwiftUI

/// Transient "+N / −N" rank-movement pill — ports web components/ui/rank-delta.tsx.
/// Remembers the last rank you saw per (page, mode, playType) for this app session
/// (in-memory, the analogue of the web's sessionStorage) and, when the rank moved
/// since the last look, shows a green/red trend pill that fades after 5s.
enum RankDeltaStore {
    private static var ranks: [String: Int] = [:]

    private static func key(_ pageKey: String, _ mode: String, _ playType: String) -> String {
        "rank:\(pageKey):\(mode):\(playType)"
    }

    /// previous − current: positive = moved UP the board (improved).
    static func delta(pageKey: String, mode: String, playType: String, currentRank: Int) -> Int? {
        guard let prev = ranks[key(pageKey, mode, playType)] else { return nil }
        let d = prev - currentRank
        return d != 0 ? d : nil
    }

    static func save(pageKey: String, mode: String, playType: String, rank: Int) {
        ranks[key(pageKey, mode, playType)] = rank
    }
}

struct RankDeltaBadge: View {
    let mode: String
    let playType: String
    let pageKey: String
    let currentRank: Int

    @State private var delta: Int?
    @State private var visible = true

    var body: some View {
        Group {
            if let delta, visible {
                let improved = delta > 0
                HStack(spacing: 2) {
                    Image(systemName: improved ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 8, weight: .black))
                    Text(improved ? "+\(delta)" : "\(delta)").font(Brand.font(9, .black))
                }
                .padding(.horizontal, 6).padding(.vertical, 2)
                .foregroundStyle(improved ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
                .background(Capsule().fill(improved ? Color(hex: 0xDCFCE7) : Color(hex: 0xFEE2E2)))
                .transition(.opacity)
            }
        }
        .task(id: "\(pageKey):\(mode):\(playType):\(currentRank)") {
            visible = true
            delta = RankDeltaStore.delta(pageKey: pageKey, mode: mode, playType: playType, currentRank: currentRank)
            RankDeltaStore.save(pageKey: pageKey, mode: mode, playType: playType, rank: currentRank)
            if delta != nil {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                withAnimation(Theme.animation(.easeOut(duration: 0.3))) { visible = false }
            }
        }
    }
}
