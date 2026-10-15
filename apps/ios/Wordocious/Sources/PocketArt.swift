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
    /// Founder 10-12: the RPS reveal's wrestling ring (back + side ropes only, open at the front; free-ChatGPT art,
    /// docs/design/brand/2.8/pocket/ring). The two hands square off on its canvas.
    static var ring: String? { ArtAsset.exists("art-pocket-ring") ? "art-pocket-ring" : nil }
    /// Founder 10-13: the matching boards for the other pocket games (free-ChatGPT art, docs/design/brand/2.8/pocket). Each
    /// is a static image laid out once; nil = the code-drawn tray fallback.
    /// Tic-Tac-Tile (option B, classic #): 780x776, cells measured in `PocketBoard.tttCols` / `tttRows`.
    static var tttGrid: String? { ArtAsset.exists("art-pocket-ttt-grid") ? "art-pocket-ttt-grid" : nil }
    /// Call It: the velvet stage the coin floats over (1100x472) and the theater wallpaper behind it (1200x592).
    static var coinStage: String? { ArtAsset.exists("art-pocket-coin-stage") ? "art-pocket-coin-stage" : nil }
    static var coinBackdrop: String? { ArtAsset.exists("art-pocket-coin-backdrop") ? "art-pocket-coin-backdrop" : nil }
    /// Pass the Puzzle: the puzzle-piece tray (770x914), body rect x 62-620, y 176-829.
    static var passTray: String? { ArtAsset.exists("art-pocket-pass-tray") ? "art-pocket-pass-tray" : nil }
    /// Word Chain: the gold chain frame (1100x581, interior x 110-985, y 206-462) and the vertical double link (213x458).
    static var chainBoard: String? { ArtAsset.exists("art-pocket-chain-board") ? "art-pocket-chain-board" : nil }
    static var chainLink: String? { ArtAsset.exists("art-pocket-chain-link") ? "art-pocket-chain-link" : nil }
    /// Ghost: the ghost-shaped tray (1200x307), tile panel x 256-1078, y 101-226.
    static var ghostTray: String? { ArtAsset.exists("art-pocket-ghost-tray") ? "art-pocket-ghost-tray" : nil }
    /// Founder 10-13: the RPS reveal card's wallpaper (1200x475 audience + spotlight) and the outlined hands that stand in the ring
    /// (plain hand + baked deep-plum outline and drop shadow, ~8% padding each side). Pick buttons keep the plain hands.
    static var rpsBackdrop: String? { ArtAsset.exists("art-pocket-rps-backdrop") ? "art-pocket-rps-backdrop" : nil }
    static func rpsRing(_ p: RpsPick) -> String? { ArtAsset.exists("art-pocket-rps-\(p.rawValue)-ring") ? "art-pocket-rps-\(p.rawValue)-ring" : nil }
    static var rpsHiddenRing: String? { ArtAsset.exists("art-pocket-rps-hidden-ring") ? "art-pocket-rps-hidden-ring" : nil }
    /// The ring art's on-screen size when the visible hand keeps the plain hand's size in a `box` x `box` frame (the ring art is the
    /// plain hand + ~8% padding, so it scales by the same factor as the plain art would).
    static func rpsRingSize(_ p: RpsPick?, box: CGFloat) -> CGSize {
        // (plain px, ring px)
        let t: (CGSize, CGSize)
        switch p {
        case .rock?: t = (CGSize(width: 230, height: 206), CGSize(width: 262, height: 238))
        case .paper?: t = (CGSize(width: 247, height: 278), CGSize(width: 287, height: 318))
        case .scissors?: t = (CGSize(width: 215, height: 284), CGSize(width: 247, height: 316))
        case nil: t = (CGSize(width: 222, height: 281), CGSize(width: 254, height: 313))
        }
        let k = box / max(t.0.width, t.0.height)
        return CGSize(width: t.1.width * k, height: t.1.height * k)
    }
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

/// A pocket board image laid out once at the available width (never stretched: the art's own aspect), with its content
/// placed in the art's pixel space. `content` gets points-per-pixel and draws inside a frame the size of the image; use
/// `.placed(_:scale:)` to put a view over a rect measured in image pixels. Founder 10-13: the matching boards.
struct PocketBoardArt<Content: View>: View {
    let art: String
    let pixels: CGSize
    var maxWidth: CGFloat = 480
    /// Founder 10-13: when set, the board is narrowed (aspect kept) so it is no taller than this.
    var maxHeight: CGFloat? = nil
    @ViewBuilder var content: (_ scale: CGFloat) -> Content
    @Environment(\.widthClass) private var widthClass

    /// Slice 5 (pocket games on iPad): the board's width cap grows with the tablet page (phones unchanged). The max height
    /// (Pass the Puzzle, Word Chain fit above the keyboard) is NOT scaled: it already states the room left on screen.
    private var boardScale: CGFloat {
        switch widthClass {
        case .compact: return 1
        case .medium: return 1.5
        case .expanded: return 1.9
        }
    }

    var body: some View {
        Image(art).resizable().interpolation(.high)
            .aspectRatio(pixels.width / pixels.height, contentMode: .fit)
            .accessibilityHidden(true)
            .layoutLog("art")
            .overlay {
                GeometryReader { geo in
                    let scale = geo.size.width / pixels.width
                    ZStack(alignment: .topLeading) { content(scale) }
                        .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                }
            }
            .frame(maxWidth: maxHeight.map { min(maxWidth * boardScale, max(120, $0) * pixels.width / pixels.height) } ?? maxWidth * boardScale)
            .frame(maxWidth: .infinity)
    }
}

extension View {
    /// Centers this view in `rect` (image pixels) scaled by `scale`, sized to it.
    func placed(_ rect: CGRect, scale: CGFloat) -> some View {
        frame(width: rect.width * scale, height: rect.height * scale)
            .position(x: rect.midX * scale, y: rect.midY * scale)
    }
}

/// Measured geometry of the pocket boards' art (image pixels).
enum PocketBoard {
    static let tttPixels = CGSize(width: 780, height: 776)
    /// The nine cells between the # bars: columns / rows (x0, x1) / (y0, y1).
    static let tttCols: [(CGFloat, CGFloat)] = [(45, 256), (296, 479), (519, 735)]
    static let tttRows: [(CGFloat, CGFloat)] = [(45, 259), (281, 474), (498, 731)]
    static func tttCell(_ i: Int) -> CGRect {
        let c = tttCols[i % 3], r = tttRows[i / 3]
        return CGRect(x: c.0, y: r.0, width: c.1 - c.0, height: r.1 - r.0)
    }

    static let passPixels = CGSize(width: 770, height: 914)
    static let passBody = CGRect(x: 62, y: 176, width: 558, height: 653)

    static let chainPixels = CGSize(width: 1100, height: 581)
    static let chainInterior = CGRect(x: 110, y: 206, width: 875, height: 256)
    static let chainLinkAspect: CGFloat = 213.0 / 458.0

    static let ghostPixels = CGSize(width: 1200, height: 307)
    static let ghostPanel = CGRect(x: 256, y: 101, width: 822, height: 125)

    static let coinStagePixels = CGSize(width: 1100, height: 472)
    static let coinBackdropPixels = CGSize(width: 1200, height: 592)
}

/// The Tic-Tac-Tile win strike: the strike art drawn through the three winning cells, drawn in
/// from the first cell (a quick scale, no motion under Reduce Motion). Laid out in the grid art's own
/// pixel space (`scale` = points per pixel), so it lines up with the cells it sits over.
struct TttStrikeView: View {
    let cells: [Int]
    let scale: CGFloat
    @State private var drawn = Theme.reduceMotion

    var body: some View {
        if let art = PocketArt.tttStrike, let a = cells.first, let b = cells.last, a != b {
            let ra = PocketBoard.tttCell(a), rb = PocketBoard.tttCell(b)
            let start = CGPoint(x: ra.midX * scale, y: ra.midY * scale)
            let end = CGPoint(x: rb.midX * scale, y: rb.midY * scale)
            let cell = ra.width * scale
            let length = hypot(end.x - start.x, end.y - start.y) + cell * 0.7
            let angle = atan2(end.y - start.y, end.x - start.x)
            Image(art).resizable().interpolation(.high)
                .frame(width: length, height: cell * 0.34)
                .scaleEffect(x: drawn ? 1 : 0.05, y: 1, anchor: .leading)
                .opacity(drawn ? 1 : 0)
                .rotationEffect(.radians(Double(angle)), anchor: .center)
                .position(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
                .onAppear {
                    guard !drawn else { return }
                    withAnimation(.easeOut(duration: 0.3)) { drawn = true }
                }
        }
    }
}

/// "YOUR TURN" over a pocket board while it is your move: pops in once, then rests. Founder 10-10: the old blank lavender
/// flag art read as a stray icon — a small gold label with the words instead.
struct PocketYourTurnFlag: View {
    @State private var shown = Theme.reduceMotion

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "flag.fill").font(.system(size: 11, weight: .black))
            Text("YOUR TURN").font(Brand.font(12, .black)).tracking(0.8)
        }
        .foregroundStyle(Color(hex: 0x3B2300))
        .padding(.horizontal, 12).padding(.vertical, 5)
        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xFDE68A), Color(hex: 0xF5B82E)], startPoint: .top, endPoint: .bottom)))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.55), lineWidth: 1))
        .shadow(color: Color(hex: 0xF59E0B).opacity(0.35), radius: 5, y: 2)
        .scaleEffect(shown ? 1 : 0.7)
        .opacity(shown ? 1 : 0)
        .onAppear {
            guard !shown else { return }
            withAnimation(.spring(response: 0.35, dampingFraction: 0.65)) { shown = true }
        }
        .accessibilityLabel("Your turn")
    }
}
