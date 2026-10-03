import Foundation

/// Stats scroll-jump fix (founder, build 237): the Stats page's swipe-to-change-game.
/// A slightly diagonal VERTICAL scroll (e.g. past Achievements) used to count as a
/// sideways swipe — measured in the scrolling content's own coordinates, the vertical
/// travel cancels out — so it swapped the game page and the page snapped back up to the
/// picker. Now only a clearly horizontal swipe (≥ 70 pt AND at least twice as wide as
/// tall, in screen space) moves one game; anything else is a scroll.
public enum StatsSwipe {
    public static let minDistance: Double = 70

    /// +1 (next game, swipe left), −1 (previous, swipe right) or nil (not a page swipe).
    public static func step(dx: Double, dy: Double) -> Int? {
        guard abs(dx) >= minDistance, abs(dx) >= 2 * abs(dy) else { return nil }
        return dx < 0 ? 1 : -1
    }
}
