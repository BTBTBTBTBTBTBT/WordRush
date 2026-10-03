import CoreGraphics

/// The Gauntlet header (night art 10-03): `art-gauntlet-header` (the GAUNTLET lettering over a gold
/// track of five silver sockets) with a medallion per stage set into its socket. Socket centers +
/// diameters from docs/design/brand/gauntlet/header-slots.json (x, d: fractions of the header
/// WIDTH; y: of its HEIGHT). Mirrors web lib/gauntlet-header.ts + Android GauntletHeaderSpec.
public enum GauntletHeaderSpec {
    public struct Slot: Equatable { public let x: CGFloat; public let y: CGFloat; public let d: CGFloat }
    public enum Medal: String, Equatable { case cleared, current, locked }

    /// art-gauntlet-header's aspect (1200 × 416).
    public static let aspect: CGFloat = 1200.0 / 416.0
    /// It takes the old stepper row + the stage-title row, so the boards don't move.
    public static let height: CGFloat = 52
    public static let medalScale: CGFloat = 1.18
    public static let numeralScale: CGFloat = 0.5
    public static let slots: [Slot] = [
        Slot(x: 0.1193, y: 0.7678, d: 0.1343),
        Slot(x: 0.3115, y: 0.7693, d: 0.1327),
        Slot(x: 0.5016, y: 0.7693, d: 0.1327),
        Slot(x: 0.6914, y: 0.7701, d: 0.1332),
        Slot(x: 0.8826, y: 0.7701, d: 0.1332),
    ]

    public static func medals(stageCount: Int, current: Int, cleared: Set<Int>) -> [Medal] {
        (0..<stageCount).map { cleared.contains($0) ? .cleared : $0 == current ? .current : .locked }
    }

    /// Medallion `i`'s center and side, in points, for a header `width` wide.
    public static func medalFrame(_ i: Int, width: CGFloat) -> (center: CGPoint, side: CGFloat) {
        let s = slots[i]
        let h = width / aspect
        return (CGPoint(x: s.x * width, y: s.y * h), s.d * medalScale * width)
    }

    public static func label(current: Int, stageCount: Int, stageName: String) -> String {
        "Gauntlet, stage \(min(current + 1, stageCount)) of \(stageCount), \(stageName)"
    }
}
