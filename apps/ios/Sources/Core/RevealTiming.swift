import Foundation

/// FINISH_SPEC §AQ1 (fast play): the word boards' reveal clock, shared by the
/// board flip, the keyboard's per-tile key colors and the finish hold. Pure, so
/// the timings and the key-color-per-tile rule are unit tested.
///
/// Was (§B3): 720 ms flips, 300 ms apart, a 560 ms hop wave, ~2.4–3 s before the
/// win popup. Now: ≤ 220 ms flips, ≤ 70 ms apart, a shorter hop and the popup
/// within 1.2 s. Multi-board games flip every board at once (one clock).
public enum RevealTiming {
    /// One tile's turn-over (the color swaps at the half).
    public static let flip: Double = 0.22
    /// The gap between neighboring tiles starting their flip.
    public static let flipStagger: Double = 0.07
    /// The soft color glow after a tile lands (web: 600 ms).
    public static let bloom: Double = 0.6
    /// The winning row's hop wave (web REVEAL parity: 400 ms, 60 ms apart).
    public static let hop: Double = 0.40
    public static let hopStagger: Double = 0.06
    /// A lost board's last-row wobble + sink (web: 500 ms).
    public static let sink: Double = 0.5
    public static let sinkStagger: Double = 0.05
    /// The longest the finished board holds before the result popup springs in.
    public static let finishHoldMax: Double = 1.2

    /// Seconds after the row commits when tile `column` lands (its flip ends).
    public static func tileLands(column: Int) -> Double {
        Double(max(0, column)) * flipStagger + flip
    }

    /// How long a `columns`-wide row takes to finish revealing.
    public static func rowReveal(columns: Int) -> Double {
        tileLands(column: max(0, columns - 1))
    }

    /// How many of a `columns`-wide row's tiles have landed `elapsed` seconds
    /// after it committed (tile i lands at `tileLands(column: i)`).
    public static func tilesLanded(elapsed: Double, columns: Int) -> Int {
        guard columns > 0, elapsed >= flip - 1e-6 else { return 0 }
        let n = Int(floor((elapsed - flip) / flipStagger + 1e-6)) + 1
        return min(columns, max(0, n))
    }

    /// The finished board's hold before the popup: the final row's reveal plus
    /// (a single-board win) its hop wave, never more than `finishHoldMax`.
    public static func finishHold(columns: Int, winHop: Bool) -> Double {
        let wave = winHop ? hop + Double(max(0, columns - 1)) * hopStagger : 0
        return min(finishHoldMax, rowReveal(columns: columns) + wave + 0.05)
    }
}

/// FINISH_SPEC §AQ1: the keyboard's letter colors, built tile by tile — a key
/// takes its color the moment its tile lands, never after the whole row.
public enum KeyReveal {
    /// correct > present (and hint-used) > absent > nothing.
    public static func rank(_ s: TileState) -> Int {
        switch s {
        case .correct: return 3
        case .present: return 2
        case .absent: return 1
        default: return 0
        }
    }

    /// The better-known of two states for one letter.
    public static func merge(_ a: TileState?, _ b: TileState) -> TileState {
        guard let a else { return b }
        return rank(b) > rank(a) ? b : a
    }

    /// The best-known state per letter across `rows`, counting only the first
    /// `visible(rowIndex)` tiles of each row (a row mid-reveal shows only its
    /// landed tiles; settled rows pass `Int.max`).
    public static func letterStates(_ rows: [GuessResult],
                                    visible: (Int) -> Int = { _ in Int.max },
                                    into start: [String: TileState] = [:]) -> [String: TileState] {
        var d = start
        for (r, row) in rows.enumerated() {
            let n = min(row.tiles.count, max(0, visible(r)))
            for tile in row.tiles.prefix(n) where !tile.letter.isEmpty {
                d[tile.letter] = merge(d[tile.letter], tile.state)
            }
        }
        return d
    }
}
