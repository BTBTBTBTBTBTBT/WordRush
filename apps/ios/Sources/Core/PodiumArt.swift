import Foundation

// 2.8 one-image podium (founder 10-15): ONE stadium image (1536 x 1024) replaces the three podium blocks and the
// per-player stat cards. A 1:1 port of PODIUM_ART in packages/core/src/podium-layout.ts, pinned by the "art" key of
// Fixtures/podium-layout-fixtures.json. Every number is a fraction of the image (x of width, y of height).

public enum PodiumArt {
    public struct Point: Equatable { public let x: Double; public let y: Double }
    public struct Panel: Equatable { public let x0: Double; public let x1: Double; public let y0: Double; public let y1: Double }
    public struct Step: Equatable { public let place: Int; public let feet: Point; public let panel: Panel }

    /// Image width / height (1536 x 1024).
    public static let aspect = 1.5
    /// The mascot lands this many points lower than the step-top center so it looks planted.
    public static let plantPt = 5.0
    /// The name label's BOTTOM sits this many points above the DRAWN head / hat top.
    public static let nameGapPt = 12.0
    /// The first place's crown rises this fraction of the mascot box above the box's top (iOS measures the drawn head instead).
    public static let crownRise = 0.05
    /// Extra points the first place's name clears the crown by, on top of nameGapPt.
    public static let crownGapPt = 10.0
    /// Contact shadow ellipse width as a fraction of the mascot width.
    public static let shadowWidth = 0.9
    /// Panel text: the score line and the two detail lines, as fractions of the panel height.
    public static let scoreHeight = 0.29
    public static let detailHeight = 0.19
    /// Dark purple on all three light satin panels: rgb(70, 30, 100).
    public static let textRgb: (r: Int, g: Int, b: Int) = (70, 30, 100)

    /// Left to right on screen: silver (2), gold (1), bronze (3).
    public static let steps: [Step] = [
        Step(place: 2, feet: Point(x: 0.220, y: 0.435), panel: Panel(x0: 0.103, x1: 0.335, y0: 0.605, y1: 0.810)),
        Step(place: 1, feet: Point(x: 0.500, y: 0.366), panel: Panel(x0: 0.383, x1: 0.620, y0: 0.581, y1: 0.799)),
        Step(place: 3, feet: Point(x: 0.783, y: 0.455), panel: Panel(x0: 0.667, x1: 0.902, y0: 0.615, y1: 0.810)),
    ]

    /// Screen order (left to right) of the places on the podium art: 2, 1, 3.
    public static let order: [Int] = [2, 1, 3]

    /// The art step for a place (1...3).
    public static func step(_ place: Int) -> Step { steps.first { $0.place == min(max(place, 1), 3) }! }
}

/// The Home Halloween curtain stage (`art-celebration-stage-halloween`, 1586 x 992): a port of CELEBRATION_STAGE in
/// packages/core/src/podium-layout.ts (fixture key "celebration"). The cast's FEET land in the three spotlight pools.
public enum CelebrationStage {
    /// Image width / height.
    public static let aspect = 1586.0 / 992.0
    /// Spotlight pool centers, left to right, as fractions of the card width.
    public static let feetX: [Double] = [0.32, 0.5, 0.67]
    /// The pools' y as a fraction of the card height.
    public static let footY = 0.895
}

/// The #1 mascot's one calm load-in on the podium (founder 10-15): a soft gold glow fades + scales in, a few sparkles
/// drift up once, the crown drops on. Transform + opacity only, played once per appearance, a static glow under Reduce
/// Motion. A 1:1 port of PODIUM_WINNER_INTRO in packages/core (fixture key "winnerIntro"); times in milliseconds.
public enum PodiumWinnerIntro {
    public static let glowSize = 1.5                      // diameter, fraction of the mascot box
    public static let glowRgb: (r: Int, g: Int, b: Int) = (255, 200, 61)
    public static let glowFromScale = 0.85
    public static let glowToScale = 1.0
    public static let glowMs = 600.0
    public static let glowEase: [Double] = [0, 0, 0.58, 1]   // CSS ease-out
    public static let glowRestOpacity = 0.5

    /// Offsets from the box center, fractions of the box (x right, y down).
    public static let sparkleOffsets: [[Double]] = [[-0.42, -0.06], [0.4, 0.02], [-0.24, -0.34], [0.26, -0.38]]
    public static let sparkleSize = 0.07                  // fraction of the box
    public static let sparkleMs = 1200.0
    public static let sparkleDelayMs = 300.0
    public static let sparkleStaggerMs = 180.0
    public static let sparkleDriftPt = 8.0
    public static let sparklePeakOpacity = 0.95
    public static let sparkleRgb: (r: Int, g: Int, b: Int) = (255, 236, 170)

    public static let crownDelayMs = 200.0
    public static let crownMs = 250.0
    public static let crownDropPt = 10.0
    public static let crownSettlePt = 1.5
}
