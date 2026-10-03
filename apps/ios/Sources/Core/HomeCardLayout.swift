import CoreGraphics
import Foundation

/// FINISH_SPEC BH: the compact Home game card + its candy cap trim. One set of numbers for
/// ModeCardView / GameCardChrome (app) and the tests; mirrors web lib/card-trim.ts + MODE_CARD
/// and Android ModeCardView.kt (keep the three in step).
public enum HomeCardSpec {
    /// BH2: ~35% shorter than the old ~104 pt card; founder 10-03 ("align at the tops … clear off
    /// some of the empty space"): one top-aligned row [icon][name][badge], the subtitle 4 under the
    /// name — the card hugs it: trim band 9 + 7 + max(icon 40, 21 + 4 + 16) + 9 = 66.
    public static let height: CGFloat = 66
    public static let radius: CGFloat = 16
    public static let icon: CGFloat = 40
    public static let padTop: CGFloat = 7
    public static let padBottom: CGFloat = 9
    public static let descGap: CGFloat = 4
    public static let name: CGFloat = 17
    public static let desc: CGFloat = 13
    public static let padX: CGFloat = 10
    public static let gap: CGFloat = 10
    /// The W / L badge at the end of the top row.
    public static let badge: CGFloat = 22
    /// DAILIES / PUZZLES title art scale over the compact grid (~25% smaller).
    public static let sectionTitleScale: CGFloat = 0.75
}

/// BH1: the trim is ONE shape — a slim band across the card's top whose bottom edge is a row of
/// shallow frosting drips. `segments(width:)` gives each drip as a quadratic (control, end) walking
/// right → left from the band's bottom-right corner; the control sits 2·drip below the band so
/// the curve peaks exactly `drip` below it.
public enum CardTrimGeometry {
    public static let band: CGFloat = 9
    public static let drip: CGFloat = 4
    public static let bumps = 8

    public struct Segment: Equatable {
        public let control: CGPoint
        public let end: CGPoint
    }

    public static func segments(width: CGFloat, band: CGFloat = band, drip: CGFloat = drip, bumps: Int = bumps) -> [Segment] {
        let bw = width / CGFloat(bumps)
        return (0..<bumps).reversed().map { i in
            Segment(control: CGPoint(x: (CGFloat(i) + 0.5) * bw, y: band + 2 * drip),
                    end: CGPoint(x: CGFloat(i) * bw, y: band))
        }
    }
}

/// BH2 (founder 10-03): a card's subtitle stays ONE line — a long result ("38 guesses · 10m 46s",
/// Gauntlet) takes the short form ("38g · 10m 46s"). Web lib/card-trim.ts compactCardLine parity.
public enum CardLine {
    public static let max = 16

    public static func compact(_ line: String, max: Int = CardLine.max) -> String {
        guard line.count > max else { return line }
        var s = line
        for (pattern, template) in [("(\\d+) guess(es)?\\b", "$1g"), ("(\\d+) mistakes?\\b", "$1 miss"),
                                    ("(\\d+) checks?\\b", "$1 chk"), ("(\\d+) miss(es)?\\b", "$1 miss")] {
            s = s.replacingOccurrences(of: pattern, with: template, options: .regularExpression)
        }
        return s
    }
}
