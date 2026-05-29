import SwiftUI
import WordociousCore

struct ContentView: View {
    var body: some View {
        RootTabView()
    }
}

/// Computes today's daily seed in UTC, matching the web app's
/// generateDailySeed(date, mode) convention.
enum DailySeed {
    static func today(mode: GameMode) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        let date = f.string(from: Date())
        return generateDailySeed(date: date, gameMode: mode.rawValue)
    }
}
