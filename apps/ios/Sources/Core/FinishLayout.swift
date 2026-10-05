import Foundation

// Pure helpers for the finishing build (docs/FINISH_SPEC.md, founder-approved
// 2026-10-02). Kept in the Core package so the math is unit-tested; the SwiftUI
// app reads them for the board sizing (§B5) and the living cast header (§A5).

// MARK: - B5 One board-sizing rule for every game

/// FINISH_SPEC §B5: every game's board fills the space between the title / status
/// line and the keyboard — as wide as the screen allows (a small side margin) and
/// centered in the remaining height. Multi-board games size their WHOLE grid the
/// same way. Mirrors the game-kit mockup's `fit()`: width ≤ 96% of the area,
/// height ≤ 98% of it.
public enum BoardSizing {
    /// The share of the area's width a board may take (a 2% margin each side).
    public static let widthFill: Double = 0.96
    /// The share of the area's height a board may take.
    public static let heightFill: Double = 0.98
    /// Single-board gap between tiles, as a fraction of the tile.
    public static let gapRatio: Double = 0.1

    /// Board columns for a multi-board grid (web multi-board.tsx): 1 board = 1,
    /// 2–4 boards = 2, more (OctoWord) = 4.
    public static func boardColumns(boardCount: Int) -> Int {
        boardCount <= 1 ? 1 : (boardCount > 4 ? 4 : 2)
    }

    /// Board rows for a multi-board grid.
    public static func boardRows(boardCount: Int) -> Int {
        let c = boardColumns(boardCount: boardCount)
        return max(1, (max(1, boardCount) + c - 1) / c)
    }

    /// The core of the rule: a board whose width is `widthUnits` × tile +
    /// `fixedWidth` (gaps that don't scale, group gaps…) and whose height is
    /// `heightUnits` × tile + `fixedHeight` gets the largest tile that fits
    /// `widthFill` of `width` and (when given) `heightFill` of `height`, clamped
    /// to [`minTile`, `maxTile`]. Every board (word grids, Sudoku, ProperNoundle's
    /// grouped rows) reduces to this.
    public static func fitTile(widthUnits: Double, fixedWidth: Double = 0,
                               heightUnits: Double, fixedHeight: Double = 0,
                               width: Double, height: Double?,
                               widthFill: Double = BoardSizing.widthFill,
                               heightFill: Double = BoardSizing.heightFill,
                               maxTile: Double = 84, minTile: Double = 8) -> Double {
        var tile = (max(0, width) * widthFill - fixedWidth) / max(0.0001, widthUnits)
        if let h = height, h.isFinite, h > 0 {
            tile = min(tile, (h * heightFill - fixedHeight) / max(0.0001, heightUnits))
        }
        return min(maxTile, max(minTile, tile))
    }

    /// Width-bound boards (ProperNoundle's long answers: ten tiles across a phone) used to
    /// leave the spare HEIGHT as dead bands above and below (founder, 2026-10-05: "always fix
    /// empty space issues"). Given the tile WIDTH the row allows, this spends that height:
    /// tiles grow taller (up to `maxRatio` × the width), then the row gaps grow (up to
    /// `maxGapRatio` × the tile height). When height is the binding side the tile stays
    /// square (`tileHeight == tileWidth` capped by the height). Mirrors web
    /// lib/board-fit.ts `fillRows` and Android BoardSizing.fillRows.
    public static func fillRows(tileWidth: Double, height: Double?, rows: Int, gap: Double,
                                heightFill: Double = BoardSizing.heightFill,
                                maxRatio: Double = 1.25, maxGapRatio: Double = 0.5) -> (tileWidth: Double, tileHeight: Double, rowGap: Double) {
        let r = Double(max(1, rows))
        guard let h0 = height, h0.isFinite, h0 > 0 else { return (tileWidth, tileWidth, gap) }
        let h = h0 * heightFill
        let byH = (h - (r - 1) * gap) / r
        if byH <= tileWidth { let t = max(1, floor(byH)); return (t, t, gap) }
        let tileH = floor(min(tileWidth * maxRatio, byH))
        let spare = r > 1 ? (h - r * tileH) / (r - 1) : gap
        let rowGap = floor(min(max(gap, spare), max(gap, tileH * maxGapRatio)))
        return (tileWidth, tileH, rowGap)
    }

    /// The largest SQUARE tile for a `columns` × `rows` grid whose gaps are
    /// `gapRatio` × the tile.
    public static func squareTile(columns: Int, rows: Int, width: Double, height: Double?,
                                  gapRatio: Double = BoardSizing.gapRatio,
                                  widthFill: Double = BoardSizing.widthFill,
                                  heightFill: Double = BoardSizing.heightFill,
                                  maxTile: Double = 84, minTile: Double = 8) -> Double {
        let c = Double(max(1, columns)), r = Double(max(1, rows))
        return fitTile(widthUnits: c + (c - 1) * gapRatio, heightUnits: r + (r - 1) * gapRatio,
                       width: width, height: height, widthFill: widthFill, heightFill: heightFill,
                       maxTile: maxTile, minTile: minTile)
    }

    /// A multi-board fill layout: the whole grid takes `widthFill` of the width and
    /// (in play) the full height budget; each board's tiles stretch to fill their
    /// cell (web `1fr` rows) with a fixed `tileGap`.
    public struct Multi: Equatable {
        public let boardColumns: Int
        public let boardRows: Int
        public let cellWidth: Double
        /// nil when sized by width only (a scrolling recap): tiles are square.
        public let cellHeight: Double?
        public let tileWidth: Double
        public let tileHeight: Double
        /// The whole grid's width (cells + gaps).
        public let gridWidth: Double
    }

    public static func multi(boardCount: Int, wordLength: Int, rowsPerBoard: Int,
                             width: Double, height: Double?,
                             boardGap: Double = 8, tileGap: Double = 2, framePad: Double = 8,
                             minTile: Double = 6) -> Multi {
        let cols = boardColumns(boardCount: boardCount)
        let rows = boardRows(boardCount: boardCount)
        let gridW = max(0, width) * widthFill
        let cellW = (gridW - Double(cols - 1) * boardGap) / Double(cols)
        let wl = Double(max(1, wordLength)), rpb = Double(max(1, rowsPerBoard))
        let tileW = max(minTile, (cellW - framePad - (wl - 1) * tileGap) / wl)
        var cellH: Double? = nil
        if let h = height, h.isFinite, h > 0 {
            cellH = (h * heightFill - Double(rows - 1) * boardGap) / Double(rows)
        }
        let tileH = max(minTile, cellH.map { ($0 - framePad - (rpb - 1) * tileGap) / rpb } ?? tileW)
        return Multi(boardColumns: cols, boardRows: rows, cellWidth: cellW, cellHeight: cellH,
                     tileWidth: tileW, tileHeight: tileH, gridWidth: gridW)
    }
}

// MARK: - BI18 Crosswordocious fits one screen

/// FINISH_SPEC BI18 (founder 10-03: "the daily today required you to scroll"):
/// in play the crossword grid owns the band between the compact header and the
/// pinned clue bar / controls / keyboard, its cell sized from the band's width
/// AND height for the puzzle's real columns × rows (10 × 11 dailies are common).
/// Same numbers as the web (lib/board-fit.ts crosswordCell) and Android
/// (BoardSizing.crosswordCell): 3-pt gaps, the tray chrome off first, 14–42 pt.
public enum CrosswordFit {
    public static let gap: Double = 3
    public static let maxCell: Double = 42
    /// The play floor (letters and numbers scale down with the cell to here).
    public static let minCell: Double = 14

    /// The largest square cell that fits `columns` × `rows` cells (with `gap`
    /// between) in `width` × `height` once `chromeX` / `chromeY` (the tray's
    /// padding, lip, the selection ring's room) are taken off; `height` nil =
    /// by width only. Floored to whole points and clamped to [minCell, maxCell].
    public static func cell(columns: Int, rows: Int, width: Double, height: Double?,
                            chromeX: Double = 0, chromeY: Double = 0, gap: Double = CrosswordFit.gap,
                            maxCell: Double = CrosswordFit.maxCell, minCell: Double = CrosswordFit.minCell) -> Double {
        let c = Double(max(1, columns)), r = Double(max(1, rows))
        var t = (width - chromeX - gap * (c - 1)) / c
        if let h = height, h.isFinite, h > 0 { t = min(t, (h - chromeY - gap * (r - 1)) / r) }
        return max(minCell, min(maxCell, floor(t)))
    }
}

// MARK: - A5 The living cast header

/// One sampled transform of a cast member: translations as fractions of the
/// figure's box (CSS `translate(%)`), rotation and skew in degrees, scale factors.
public struct CastPose: Equatable {
    public var tx: Double = 0
    public var ty: Double = 0
    public var rotation: Double = 0
    public var sx: Double = 1
    public var sy: Double = 1
    public var skewX: Double = 0

    public init(tx: Double = 0, ty: Double = 0, rotation: Double = 0, sx: Double = 1, sy: Double = 1, skewX: Double = 0) {
        self.tx = tx; self.ty = ty; self.rotation = rotation; self.sx = sx; self.sy = sy; self.skewX = skewX
    }

    public static let identity = CastPose()

    public func lerp(_ to: CastPose, _ k: Double) -> CastPose {
        CastPose(tx: tx + (to.tx - tx) * k, ty: ty + (to.ty - ty) * k,
                 rotation: rotation + (to.rotation - rotation) * k,
                 sx: sx + (to.sx - sx) * k, sy: sy + (to.sy - sy) * k,
                 skewX: skewX + (to.skewX - skewX) * k)
    }
}

/// A CSS `cubic-bezier(x1, y1, x2, y2)` timing function.
public struct CubicBezier: Equatable {
    public let x1: Double, y1: Double, x2: Double, y2: Double
    public init(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) {
        self.x1 = x1; self.y1 = y1; self.x2 = x2; self.y2 = y2
    }

    public static let easeInOut = CubicBezier(0.42, 0, 0.58, 1)
    public static let easeOut = CubicBezier(0, 0, 0.58, 1)
    public static let linear = CubicBezier(0, 0, 1, 1)

    private func bez(_ t: Double, _ a: Double, _ b: Double) -> Double {
        let u = 1 - t
        return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
    }

    /// y for an x in [0, 1] (bisection on the monotonic x curve).
    public func value(at x: Double) -> Double {
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        var lo = 0.0, hi = 1.0, t = x
        for _ in 0..<40 {
            t = (lo + hi) / 2
            let bx = bez(t, x1, x2)
            if abs(bx - x) < 1e-6 { break }
            if bx < x { lo = t } else { hi = t }
        }
        return bez(t, y1, y2)
    }
}

/// The ten cast moves (FINISH_SPEC §A5, the mockup's `.castrow` keyframes).
public enum CastMoves {
    /// The cast in WORDOCIOUS order (the mascot ids).
    public static let ids = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]
    /// The pause between two moves: 2.6–5 s.
    public static let minInterval: Double = 2.6
    public static let maxInterval: Double = 5.0
    /// The first move waits this long after the header appears.
    public static let firstDelay: Double = 1.2

    public struct Move {
        public let duration: Double
        public let easing: CubicBezier
        /// The transform origin as a fraction of the figure's box (x, y).
        public let anchor: (x: Double, y: Double)
        /// (offset 0…1, pose) keyframes, first at 0 and last at 1.
        public let frames: [(Double, CastPose)]
    }

    private static let spring15 = CubicBezier(0.3, 1.5, 0.5, 1)
    private static let spring14 = CubicBezier(0.3, 1.4, 0.5, 1)
    private static let id = CastPose.identity

    public static let moves: [String: Move] = [
        // O1: spin 360 (900 ms).
        "o1": Move(duration: 0.9, easing: CubicBezier(0.45, 0, 0.25, 1), anchor: (0.5, 0.55),
                   frames: [(0, id), (0.85, CastPose(rotation: 372)), (1, CastPose(rotation: 360))]),
        // W: hop + squash (700 ms).
        "w": Move(duration: 0.7, easing: spring15, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.15, CastPose(sx: 1.06, sy: 0.9)), (0.45, CastPose(ty: -0.22, sx: 0.96, sy: 1.05)),
                           (0.8, CastPose(sx: 1.06, sy: 0.93)), (1, id)]),
        // R: nod off + jolt (1.6 s).
        "r": Move(duration: 1.6, easing: .easeInOut, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.55, CastPose(ty: 0.04, rotation: -10)), (0.7, CastPose(ty: 0.04, rotation: -10)),
                           (0.8, CastPose(ty: -0.06, rotation: 4)), (1, id)]),
        // D: double bounce (760 ms).
        "d": Move(duration: 0.76, easing: .easeOut, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.2, CastPose(ty: -0.1)), (0.4, id), (0.6, CastPose(ty: -0.07)), (0.8, id), (1, id)]),
        // O2: star pulse + tilt (820 ms).
        "o2": Move(duration: 0.82, easing: spring15, anchor: (0.5, 0.85),
                   frames: [(0, id), (0.4, CastPose(rotation: -6, sx: 1.16, sy: 1.16)),
                            (0.7, CastPose(rotation: 3, sx: 0.97, sy: 0.97)), (1, id)]),
        // C: curious lean (1.2 s).
        "c": Move(duration: 1.2, easing: .easeInOut, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.3, CastPose(tx: 0.08, rotation: 9)), (0.65, CastPose(tx: 0.08, rotation: 9)), (1, id)]),
        // I: shy wiggle (900 ms).
        "i": Move(duration: 0.9, easing: .easeInOut, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.2, CastPose(rotation: -9)), (0.4, CastPose(rotation: 8)),
                           (0.6, CastPose(rotation: -6)), (0.8, CastPose(rotation: 4)), (1, id)]),
        // O3: jump (760 ms).
        "o3": Move(duration: 0.76, easing: spring14, anchor: (0.5, 0.85),
                   frames: [(0, id), (0.2, CastPose(sx: 1.08, sy: 0.88)), (0.5, CastPose(ty: -0.3, rotation: -8)),
                            (0.82, CastPose(sx: 1.05, sy: 0.94)), (1, id)]),
        // U: levitate (1.8 s).
        "u": Move(duration: 1.8, easing: .easeInOut, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.5, CastPose(ty: -0.14)), (1, id)]),
        // S: dash jitter (700 ms).
        "s": Move(duration: 0.7, easing: .easeInOut, anchor: (0.5, 0.85),
                  frames: [(0, id), (0.15, CastPose(tx: -0.06, skewX: 8)), (0.35, CastPose(tx: 0.10, skewX: -10)),
                           (0.55, CastPose(tx: -0.04, skewX: 4)), (0.75, CastPose(tx: 0.03)), (1, id)]),
    ]

    public static func duration(_ id: String) -> Double { moves[id]?.duration ?? 0 }

    /// ONE random character, never the same as `last`.
    public static func pick<G: RandomNumberGenerator>(after last: String?, using rng: inout G) -> String {
        let pool = ids.filter { $0 != last }
        return pool.randomElement(using: &rng) ?? ids[0]
    }

    public static func pick(after last: String?) -> String {
        var g = SystemRandomNumberGenerator()
        return pick(after: last, using: &g)
    }

    /// The wait before the next move for a uniform `unit` in [0, 1]: 2.6–5 s.
    public static func interval(unit: Double) -> Double {
        minInterval + (maxInterval - minInterval) * min(1, max(0, unit))
    }

    // MARK: F2 fix — the landing flourish

    /// FINISH_SPEC §F2 fix step 4: once the cold-start intro lands, every character
    /// hops once — the W hop keyframes compressed to 420 ms, 50 ms apart, left to
    /// right — before the one-at-a-time moves resume.
    public static let flourishHop: Double = 0.42
    public static let flourishStagger: Double = 0.05

    /// The whole flourish's length for `count` characters.
    public static func flourishDuration(count: Int = ids.count) -> Double {
        flourishHop + Double(max(0, count - 1)) * flourishStagger
    }

    /// Character `index`'s pose `elapsed` seconds after the flourish started.
    public static func flourishPose(index: Int, elapsed: Double) -> CastPose {
        guard let hop = moves["w"] else { return .identity }
        let local = elapsed - Double(index) * flourishStagger
        guard local > 0, local < flourishHop else { return .identity }
        return Keyframes.sample(hop.frames, at: local / flourishHop, easing: hop.easing)
    }

    /// The pose of `id` at `elapsed` seconds into its move (identity outside it).
    /// Each keyframe segment is eased with the move's timing function, as CSS does.
    public static func pose(_ id: String, elapsed: Double) -> CastPose {
        guard let m = moves[id], elapsed > 0, elapsed < m.duration else { return .identity }
        return Keyframes.sample(m.frames, at: elapsed / m.duration, easing: m.easing)
    }
}

/// CSS-style keyframe sampling: the timing function eases each segment between two
/// keyframes (not the whole run). Shared by the cast moves and the game-kit tile
/// motion (hop, sink, pop, nudge).
public enum Keyframes {
    public static func sample(_ frames: [(Double, CastPose)], at progress: Double, easing: CubicBezier) -> CastPose {
        guard let first = frames.first else { return .identity }
        if progress <= first.0 { return first.1 }
        for k in 1..<frames.count {
            let (t0, a) = frames[k - 1], (t1, b) = frames[k]
            if progress <= t1 {
                let local = t1 > t0 ? (progress - t0) / (t1 - t0) : 1
                return a.lerp(b, easing.value(at: local))
            }
        }
        return frames.last?.1 ?? .identity
    }
}

// MARK: - C5 The streak popup's week

/// FINISH_SPEC §C5: the streak popup shows this week (Monday first) as seven day
/// tiles, filled for each day the current streak covers. The streak ends today when
/// today's daily is played, otherwise yesterday (the streak is still alive until
/// midnight). `todayIndex` is today's position in the week (Monday = 0 … Sunday = 6).
public enum StreakWeek {
    public static func days(streak: Int, playedToday: Bool, todayIndex: Int) -> [Bool] {
        let t = min(6, max(0, todayIndex))
        let end = playedToday ? t : t - 1
        return (0..<7).map { i in
            i <= end && streak > 0 && end - i < streak
        }
    }

    /// Monday = 0 … Sunday = 6 for a Gregorian weekday (Sunday = 1 … Saturday = 7).
    public static func mondayIndex(weekday: Int) -> Int { (weekday + 5) % 7 }
}
