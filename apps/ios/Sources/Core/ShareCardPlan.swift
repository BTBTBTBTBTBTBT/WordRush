import Foundation

/// The share card's vertical plan (web lib/share-fit.ts planShareCard + titleRect, Android
/// ShareCard.layout). Founder 10-06: the Classic 4/6 card sent in iMessage showed only the
/// bottom of the CLASSIC title — the card's column was centered in the canvas, so anything
/// taller than the canvas pushed the title off the top. Now every card is planned top-down:
/// the FULL title art, scaled to fit the card width inside 90-px margins (never taller than
/// 210), pinned 40 px below the top; then the date · guesses · time line, the board block
/// (scaled down by height when the card would pass 9:16), the stat windows and the cast
/// wordmark. Pure, so WordociousCoreTests checks every game's title box sits inside its card.
public enum ShareCardPlan {
    public static let width: Double = 1080
    /// 4:5 … 9:16.
    public static let minHeight: Double = 1350
    public static let maxHeight: Double = 1920
    /// The title art: centered, inside these side margins, never taller than `titleMaxH`.
    public static let titleMargin: Double = 90
    public static let titleMaxW: Double = width - titleMargin * 2
    public static let titleMaxH: Double = 210
    /// The lettered title's height when the art doesn't ship.
    public static let titleFallbackH: Double = 96
    /// Card top → title.
    public static let topPad: Double = 40

    public struct Size: Equatable {
        public var width: Double
        public var height: Double
        public init(width: Double, height: Double) { self.width = width; self.height = height }
    }

    /// The title art's drawn size: the whole art contain-fit in `titleMaxW` × `titleMaxH`
    /// (aspect = width / height; nil = no art, the lettered fallback's band).
    public static func titleSize(aspect: Double?) -> Size {
        guard let a = aspect, a > 0, a.isFinite else { return Size(width: titleMaxW, height: titleFallbackH) }
        let w = min(titleMaxW, titleMaxH * a)
        return Size(width: w, height: w / a)
    }

    public struct Card: Equatable {
        /// The canvas height (rounded, clamped 4:5 … 9:16).
        public var height: Double
        public var titleTop: Double
        public var title: Size
        /// The board block's scale and drawn height.
        public var boardScale: Double
        public var boardH: Double
        /// Canvas left over under the 4:5 floor: the board block's box is `boardH + slack`
        /// (the board centers in it), so nothing else moves.
        public var slack: Double

        /// The title box's left edge (centered on the card).
        public var titleX: Double { (ShareCardPlan.width - title.width) / 2 }
        /// Everything the column stacks, top to bottom (equals `height` unless the
        /// non-board blocks alone pass 9:16).
        public func columnHeight(fixed: Double) -> Double { fixed + boardH + slack }
    }

    /// Plans a card: `fixed` = every block's height except the board (top pad and title
    /// included — use `fixedHeight`), `board` = the board block's natural size, `boardMaxW`
    /// = the widest it may be drawn, `maxScale` = the most it may be enlarged.
    public static func plan(titleAspect: Double?, fixed: Double, board: Size,
                            boardMaxW: Double = 950, maxScale: Double = 1.5) -> Card {
        let title = titleSize(aspect: titleAspect)
        let nw = max(1, board.width), nh = max(0, board.height)
        var s = min(boardMaxW / nw, maxScale)
        if nh > 0, fixed + nh * s > maxHeight { s = max(0.2, (maxHeight - fixed) / nh) }
        let boardH = nh * s
        let height = min(maxHeight, max(minHeight, fixed + boardH)).rounded()
        let slack = max(0, height - fixed - boardH)
        return Card(height: height, titleTop: topPad, title: title, boardScale: s, boardH: boardH, slack: slack)
    }

    /// The fixed part of a card: top pad + title + `rest` (info line, gaps, stats, cast…).
    public static func fixedHeight(titleAspect: Double?, rest: Double) -> Double {
        topPad + titleSize(aspect: titleAspect).height + rest
    }

    /// True when the title box sits fully on the card, inside the side margins.
    public static func titleFits(_ card: Card) -> Bool {
        card.titleX >= titleMargin - 0.5
            && card.titleX + card.title.width <= width - titleMargin + 0.5
            && card.titleTop >= 0
            && card.titleTop + card.title.height <= card.height
    }
}
