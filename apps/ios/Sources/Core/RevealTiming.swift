import Foundation

/// FINISH_SPEC §AQ1 / §BI5: the word boards' reveal clock, shared by the board
/// flip, the keyboard's per-tile key colors and the finish hold. Pure, so the
/// timings and the key-color-per-tile rule are unit tested.
///
/// §BI5 (founder 10-02 on 2.7 (239): "it seemed really rushed … way too zippy";
/// "the older builds before the aesthetic updates had much better flow"): the
/// pre-overhaul pacing is back — a single board turns each tile over in 0.5 s,
/// 150 ms apart (a 5-letter row ≈ 1.1 s); a multi-board ("mini") reveal 0.3 s,
/// 80 ms apart. (B3 was 720 ms / 300 ms; AQ1 220 ms / 70 ms.) The finish hold
/// waits out the whole row (and a win's hop wave) plus the old 0.2 s beat.
public enum RevealTiming {
    /// One tile's turn-over on a single board (the color swaps at the half).
    public static let flip: Double = 0.5
    /// The gap between neighboring tiles starting their flip (single board).
    public static let flipStagger: Double = 0.15
    /// A multi-board ("mini") tile's turn-over.
    public static let miniFlip: Double = 0.3
    /// The gap between neighboring mini tiles starting their flip.
    public static let miniFlipStagger: Double = 0.08
    /// The soft color glow after a tile lands (web: 600 ms).
    public static let bloom: Double = 0.6
    /// The winning row's hop wave (web REVEAL parity: 400 ms, 60 ms apart).
    public static let hop: Double = 0.40
    public static let hopStagger: Double = 0.06
    /// A lost board's last-row wobble + sink (web: 500 ms).
    public static let sink: Double = 0.5
    public static let sinkStagger: Double = 0.05
    /// The pre-overhaul beat between the board settling and the result popup.
    public static let finishBeat: Double = 0.2

    /// One tile's turn-over: single board or mini (multi-board).
    public static func flipDuration(mini: Bool) -> Double { mini ? miniFlip : flip }
    /// The gap between neighboring tiles: single board or mini (multi-board).
    public static func stagger(mini: Bool) -> Double { mini ? miniFlipStagger : flipStagger }

    /// Seconds after the row commits when tile `column` lands (its flip ends).
    public static func tileLands(column: Int, mini: Bool = false) -> Double {
        Double(max(0, column)) * stagger(mini: mini) + flipDuration(mini: mini)
    }

    /// How long a `columns`-wide row takes to finish revealing.
    public static func rowReveal(columns: Int, mini: Bool = false) -> Double {
        tileLands(column: max(0, columns - 1), mini: mini)
    }

    /// How many of a `columns`-wide row's tiles have landed `elapsed` seconds
    /// after it committed (tile i lands at `tileLands(column: i)`).
    public static func tilesLanded(elapsed: Double, columns: Int, mini: Bool = false) -> Int {
        let f = flipDuration(mini: mini)
        guard columns > 0, elapsed >= f - 1e-6 else { return 0 }
        let n = Int(floor((elapsed - f) / stagger(mini: mini) + 1e-6)) + 1
        return min(columns, max(0, n))
    }

    /// How long a `columns`-wide win hop wave takes.
    public static func hopWave(columns: Int) -> Double {
        hop + Double(max(0, columns - 1)) * hopStagger
    }

    /// The finished board's hold before the popup: the final row's whole reveal,
    /// then (a win) its hop wave, then the 0.2 s beat. Never cut short — the
    /// popup always waits for the slower row to finish.
    public static func finishHold(columns: Int, winHop: Bool, mini: Bool = false) -> Double {
        rowReveal(columns: columns, mini: mini) + (winHop ? hopWave(columns: columns) : 0) + finishBeat
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
