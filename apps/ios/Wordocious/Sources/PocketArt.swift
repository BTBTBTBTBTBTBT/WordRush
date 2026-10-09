import SwiftUI
import WordociousCore

/// The shipped pocket-game pieces (`art-pocket-*`, 2.8 wave 3 item 9d), with the older art as the
/// fallback so a missing imageset never leaves a hole.
enum PocketArt {
    private static func prefer(_ name: String, _ fallback: String) -> String {
        ArtAsset.exists(name) ? name : fallback
    }

    /// A hand for Rock Paper Scissors.
    static func rps(_ p: RpsPick) -> String { prefer("art-pocket-rps-\(p.rawValue)", "friends-\(p.rawValue)") }
    /// The face-down hand (nil = draw the old "?" card).
    static var rpsHidden: String? { ArtAsset.exists("art-pocket-rps-hidden") ? "art-pocket-rps-hidden" : nil }
    /// The clash burst between two revealed hands.
    static var clashBurst: String? { ArtAsset.exists("art-pocket-clash-burst") ? "art-pocket-clash-burst" : nil }

    /// Tic-Tac-Tile pieces: mine is the purple X, theirs the O.
    static func ttt(mine: Bool) -> String? {
        let name = mine ? "art-pocket-ttt-x" : "art-pocket-ttt-o"
        if ArtAsset.exists(name) { return name }
        let old = mine ? "art-piece-ttt-x" : "art-piece-ttt-o"
        return ArtAsset.exists(old) ? old : nil
    }
    static var tttStrike: String? { ArtAsset.exists("art-pocket-ttt-strike") ? "art-pocket-ttt-strike" : nil }

    /// Call It: heads is the W, tails the crest.
    static func coin(_ face: CoinFace) -> String {
        face == .heads ? prefer("art-pocket-coin-heads-w", "friends-heads") : prefer("art-pocket-coin-tails-crest", "friends-tails")
    }
    static var coinTilt: String? { ArtAsset.exists("art-pocket-coin-tilt") ? "art-pocket-coin-tilt" : nil }
    static var coinEdge: String? { ArtAsset.exists("art-pocket-coin-edge") ? "art-pocket-coin-edge" : nil }
    static var coinShadow: String? { ArtAsset.exists("art-pocket-coin-shadow") ? "art-pocket-coin-shadow" : nil }
    static var coinSparkle: String? { ArtAsset.exists("art-pocket-coin-sparkle-ring") ? "art-pocket-coin-sparkle-ring" : nil }

    /// The "YOUR TURN" flag shown over the board while it is your move.
    static var yourTurnFlag: String? { ArtAsset.exists("art-pocket-yourturn-flag") ? "art-pocket-yourturn-flag" : nil }
}

/// The Tic-Tac-Tile win strike: the strike art drawn through the three winning cells, drawn in
/// from the first cell (a quick scale, no motion under Reduce Motion). `cell` and `gap` are the
/// board's own numbers (92 and 10), so it lines up with the grid it sits over.
struct TttStrikeView: View {
    let cells: [Int]
    let cell: CGFloat
    let gap: CGFloat
    @State private var drawn = Theme.reduceMotion

    var body: some View {
        if let art = PocketArt.tttStrike, let a = cells.first, let b = cells.last, a != b {
            let pitch = cell + gap
            let size = pitch * 3 - gap
            let start = CGPoint(x: CGFloat(a % 3) * pitch + cell / 2, y: CGFloat(a / 3) * pitch + cell / 2)
            let end = CGPoint(x: CGFloat(b % 3) * pitch + cell / 2, y: CGFloat(b / 3) * pitch + cell / 2)
            let length = hypot(end.x - start.x, end.y - start.y) + cell * 0.7
            let angle = atan2(end.y - start.y, end.x - start.x)
            Image(art).resizable().interpolation(.high)
                .frame(width: length, height: cell * 0.34)
                .scaleEffect(x: drawn ? 1 : 0.05, y: 1, anchor: .leading)
                .opacity(drawn ? 1 : 0)
                .rotationEffect(.radians(Double(angle)), anchor: .center)
                .position(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
                .frame(width: size, height: size)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
                .onAppear {
                    guard !drawn else { return }
                    withAnimation(.easeOut(duration: 0.3)) { drawn = true }
                }
        }
    }
}

/// The "YOUR TURN" flag over a pocket board while it is your move: pops in once, then rests.
struct PocketYourTurnFlag: View {
    @State private var shown = Theme.reduceMotion

    var body: some View {
        if let art = PocketArt.yourTurnFlag {
            Image(art).resizable().interpolation(.high).scaledToFit()
                .frame(height: 30)
                .scaleEffect(shown ? 1 : 0.7)
                .opacity(shown ? 1 : 0)
                .onAppear {
                    guard !shown else { return }
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.65)) { shown = true }
                }
                .accessibilityLabel("Your turn")
        }
    }
}
