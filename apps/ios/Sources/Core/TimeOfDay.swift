import Foundation

/// Time of day (founder 10-16, docs/design/brand/seasons/time-of-day/NOTES.md v2): while a season shows, its wall, Home stage
/// and window surfaces follow the device's LOCAL clock in four slots. Mirrors core `timeOfDay` / `nextTimeOfDayChange`
/// (time-of-day-fixtures.json pins it): morning 5-10, day 10-16, evening 16-19, night 19-5.
public enum TimeOfDay: String, CaseIterable, Codable, Sendable {
    case morning, day, evening, night

    /// The slot boundaries (local hours), in clock order from dawn.
    public static let starts: [(time: TimeOfDay, hour: Int)] = [(.morning, 5), (.day, 10), (.evening, 16), (.night, 19)]

    /// The slot for a local clock hour (0-23; fractional hours and out-of-range values wrap into a day).
    public static func at(hour: Double) -> TimeOfDay {
        var h = hour.truncatingRemainder(dividingBy: 24)
        if h < 0 { h += 24 }
        if h >= 19 || h < 5 { return .night }
        if h >= 16 { return .evening }
        if h >= 10 { return .day }
        return .morning
    }

    /// The slot for a Date, read in `calendar` (local by default).
    public static func at(_ date: Date, calendar: Calendar = .current) -> TimeOfDay {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return at(hour: Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60)
    }

    /// The next local instant (strictly after `date`) at which the slot changes: 05:00, 10:00, 16:00 or 19:00.
    /// The app arms ONE timer to it (no polling) and re-reads on foreground.
    public static func nextChange(after date: Date, calendar: Calendar = .current) -> Date {
        for s in starts {
            if let t = calendar.date(bySettingHour: s.hour, minute: 0, second: 0, of: date), t > date { return t }
        }
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: date) ?? date.addingTimeInterval(86_400)
        return calendar.date(bySettingHour: starts[0].hour, minute: 0, second: 0, of: tomorrow) ?? tomorrow
    }

    /// The slot cross-fade (walls, stage and window colors share this curve), seconds.
    public static let fadeSeconds: Double = 0.6
}
