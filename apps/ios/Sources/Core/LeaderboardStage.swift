import Foundation

// FRIDAY-QUEUE items 11 + 11b: the Leaderboard living stage's shared constants — a 1:1 port of
// packages/core/src/leaderboard-stage.ts (host table, tint alphas, ledge step positions).

public enum LeaderboardStage {
    public struct Host: Equatable {
        public let castId: String
        public let pose: String
    }

    /// Sunday ... Saturday. W never hosts; Wednesday is U the wizard.
    public static let dayHosts: [Host] = [
        Host(castId: "s", pose: "trophy"),   // SUNDAY SUPERSTARS
        Host(castId: "d", pose: "lean"),     // MONDAY MASTERS
        Host(castId: "c", pose: "lean"),     // TUESDAY TITANS
        Host(castId: "u", pose: "spin"),     // WEDNESDAY WIZARDS
        Host(castId: "r", pose: "lean"),     // THURSDAY THUNDER
        Host(castId: "i", pose: "lean"),     // FRIDAY'S FINEST
        Host(castId: "s", pose: "flex"),     // SATURDAY STARS
    ]

    /// 0 = Sunday ... 6 = Saturday for the player's local YYYY-MM-DD.
    public static func weekday(_ day: String) -> Int {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return 0 }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        guard let d = cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return 0 }
        return cal.component(.weekday, from: d) - 1
    }

    public static func host(day: String) -> Host { dayHosts[weekday(day)] }

    /// The backdrop's alphas of the selected game's accent (sky top / mid / bottom, sunburst light, floor glow).
    public static let skyTop = 0.26
    public static let skyMid = 0.14
    public static let skyBottom = 0.0
    public static let rays = 0.7
    public static let floorGlow = 0.3

    public static let topMaxHeight: Double = 330
    public static let standardPhoneUsableHeight: Double = 650
    public static let podiumBlockHeight: Double = 250

    /// Mini steps on the Yesterday ledge art (394 x 160): place 2 left, 1 centre, 3 right.
    public struct LedgeStep: Equatable { public let place: Int; public let x: Double; public let top: Double }
    public static let ledgeSteps: [LedgeStep] = [
        LedgeStep(place: 2, x: 0.215, top: 0.5),
        LedgeStep(place: 1, x: 0.5, top: 0.36),
        LedgeStep(place: 3, x: 0.785, top: 0.58),
    ]
    public static let ledgeFigureFraction = 0.2

    public static func podiumFits(stageTopHeight: Double, usable: Double = standardPhoneUsableHeight) -> Bool {
        stageTopHeight + podiumBlockHeight <= usable
    }
}
