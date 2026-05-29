import SwiftUI
import WordociousCore

struct ContentView: View {
    var body: some View {
        RootTabView()
    }
}

/// Computes today's daily seed using the player's LOCAL date, matching the
/// web app's generateDailySeed(getTodayLocal(), mode) — puzzles reset at
/// local midnight (and daily_results.day is local too).
enum DailySeed {
    static func today(mode: GameMode) -> String {
        generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: mode.rawValue)
    }
}
