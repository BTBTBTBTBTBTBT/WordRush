import Foundation

/// FINISH_SPEC §AT2: every multi-board recap (QuadWord, OctoWord, Deliverance,
/// Succession; win AND loss) draws all its boards at ONE tile size and ONE board
/// size — the row count comes from the largest board, shorter boards pad with empty
/// rows, and the missed-answer line (a lost board's answer) reserves the same slot
/// on every board, so a lost board is never bigger or smaller than a solved one.
public enum RecapSizing {
    /// The shared row count: the most rows any board needs (its guess budget, or its
    /// guesses when it played past it), never below `floor` or 1.
    public static func sharedRows(guessCounts: [Int], budgets: [Int], floor: Int = 1) -> Int {
        max(1, floor, guessCounts.max() ?? 0, budgets.max() ?? 0)
    }

    /// Height of the missed-answer slot under each board (0 when not shown).
    public static func answerSlot(tile: Double, revealMissed: Bool) -> Double {
        revealMissed ? max(12, tile * 0.7) : 0
    }

    /// One board's drawn size (before its tray): `columns` × `rows` tiles at `tile`
    /// with the 10% tile gap, plus the answer slot. The same for every board of a recap.
    public static func boardSize(tile: Double, columns: Int, rows: Int, revealMissed: Bool) -> (width: Double, height: Double) {
        let c = Double(max(1, columns)), r = Double(max(1, rows))
        let gap = tile * 0.1
        let width = c * tile + (c - 1) * gap
        var height = r * tile + (r - 1) * gap
        if revealMissed { height += gap + answerSlot(tile: tile, revealMissed: true) }
        return (width, height)
    }
}
