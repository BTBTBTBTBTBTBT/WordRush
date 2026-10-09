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

    /// The gold down-arrow disc beside whose turn it is.
    static var turnMarker: String? { ArtAsset.exists("art-pocket-turn-marker") ? "art-pocket-turn-marker" : nil }
    /// The lilac disc under the Rock Paper Scissors reveal.
    static var arenaPlate: String? { ArtAsset.exists("art-pocket-arena-plate") ? "art-pocket-arena-plate" : nil }
    /// The ghost, the puzzle piece and the gold chain links: small markers for Ghost, Pass the Puzzle and Word Chain.
    static var ghostMarker: String? { ArtAsset.exists("art-pocket-ghost-marker") ? "art-pocket-ghost-marker" : nil }
    static var puzzlePiece: String? { ArtAsset.exists("art-pocket-puzzle-piece") ? "art-pocket-puzzle-piece" : nil }
    static var chainLinks: String? { ArtAsset.exists("art-pocket-chain-links") ? "art-pocket-chain-links" : nil }

    /// The shipped tile art (art-pocket-tile-white / -purple / -gold). OFF until reviewed on the model: art-pocket-tile-purple
    /// is a pink-mauve face with a ragged top-left edge and tile-white has a smudged bottom edge, neither is the house purple
    /// of the code-drawn GlossyTile. While off, PocketTile draws the house GlossyTile (same sizes, same pop-in). Flip to true
    /// once the art is re-keyed, nothing else changes.
    static let tileArtOnModel = false

    /// The tile art for a face (purple = mine / right spot, gold = theirs / wrong spot, white = empty / typed); nil = draw the house tile.
    static func tile(_ face: GlossyFace) -> String? {
        guard tileArtOnModel else { return nil }
        let name: String
        switch face {
        case .correct: name = "art-pocket-tile-purple"
        case .present: name = "art-pocket-tile-gold"
        case .empty, .typed: name = "art-pocket-tile-white"
        default: return nil
        }
        return ArtAsset.exists(name) ? name : nil
    }
}

/// One pocket-game letter tile (Ghost, Word Chain, Pass the Puzzle): the shipped tile art with the letter on top in the house
/// font when `PocketArt.tileArtOnModel`, else the house GlossyTile, and in both cases a pop-in when it is first placed
/// (<= 250 ms spring, nothing under Reduce Motion). `pop` = this tile is a placed letter (not an empty slot or the initial board).
struct PocketTile: View {
    let face: GlossyFace
    var letter: String = ""
    let width: CGFloat
    var glow: Color = .clear
    var glowAmount: CGFloat = 0
    var pop: Bool = false
    @State private var landed: Bool

    init(face: GlossyFace, letter: String = "", width: CGFloat, glow: Color = .clear, glowAmount: CGFloat = 0, pop: Bool = false) {
        self.face = face
        self.letter = letter
        self.width = width
        self.glow = glow
        self.glowAmount = glowAmount
        self.pop = pop
        _landed = State(initialValue: !pop || Theme.reduceMotion || letter.isEmpty)
    }

    var body: some View {
        Group {
            if let art = PocketArt.tile(face) {
                ZStack {
                    Image(art).resizable().interpolation(.high).scaledToFit()
                    if !letter.isEmpty {
                        let light = face == .empty || face == .typed
                        Text(letter).font(Brand.font(width * 0.52, .black))
                            .foregroundStyle(light ? Color(hex: 0x2A1650) : Color.white)
                            .shadow(color: .black.opacity(light ? 0 : 0.25), radius: 1, y: 1)
                    }
                }
                .frame(width: width, height: width)
            } else {
                GlossyTile(face: face, letter: letter, width: width, glow: glow, glowAmount: glowAmount)
            }
        }
        .scaleEffect(landed ? 1 : 0.8)
        .opacity(landed ? 1 : 0.4)
        .onAppear {
            guard !landed else { return }
            withAnimation(.spring(response: 0.22, dampingFraction: 0.62)) { landed = true }
        }
    }
}

/// A small pocket marker image (turn marker, ghost, puzzle piece, chain links) that pops in once. Decorative.
struct PocketMarker: View {
    let art: String?
    let size: CGFloat
    @State private var shown = Theme.reduceMotion

    var body: some View {
        if let art {
            Image(art).resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
                .scaleEffect(shown ? 1 : 0.7)
                .opacity(shown ? 1 : 0)
                .onAppear {
                    guard !shown else { return }
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.65)) { shown = true }
                }
                .accessibilityHidden(true)
        }
    }
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
