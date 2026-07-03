import Foundation
import UserNotifications

/// Local daily-reminder notification — the native counterpart to the web's
/// push daily-reminder (apps/web/api/cron/daily-reminder). Native uses an
/// on-device ONE-SHOT local notification (no server / APNs needed): a single
/// reminder scheduled for the next 18:00 local that still has unfinished
/// dailies. Recomputed on every app foreground and on every daily completion
/// (see WordociousApp), so a player who already swept today's 9 dailies is
/// never nagged tonight — the reminder rolls to tomorrow 18:00 instead.
enum NotificationService {
    static let reminderId = "daily-reminder"
    /// Local hour (24h) the reminder fires — evening, before the day rolls over.
    static let reminderHour = 18
    /// The Settings "Daily Reminders" toggle (@AppStorage in SettingsView /
    /// ProfileTab) — reschedule() no-ops while the user has it off.
    static let prefKey = "pref-daily-reminder"

    /// Request permission and, if granted, (re)schedule the daily reminder.
    /// Returns whether notifications are authorized.
    @discardableResult
    static func requestAndSchedule() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { await schedule() }
        return granted
    }

    /// Recompute the pending reminder. No-op when the Settings toggle is off
    /// (the user opted out — cancel() already cleared the pending request) or
    /// when notifications aren't authorized (as before).
    static func reschedule() async {
        guard UserDefaults.standard.bool(forKey: prefKey) else { return }
        guard await isAuthorized() else { return }
        await schedule()
    }

    /// Schedule (or reschedule) a one-shot reminder for the next 18:00 local
    /// that still has unfinished dailies:
    ///   - all 9 dailies already recorded today, or it's past 18:00 → tomorrow 18:00
    ///   - otherwise → today 18:00
    /// Copy is streak-aware: a daily-login streak ≥ 3 names the streak so the
    /// nudge carries real loss-aversion weight; below that, the generic body.
    @MainActor
    static func schedule() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderId])

        let content = UNMutableNotificationContent()
        content.title = "Wordocious"
        let streak = AuthService.shared.profile?.dailyLoginStreak ?? 0
        content.body = streak >= 3
            ? "Don't lose your \(streak)-day streak! Today's puzzles are waiting. 🔥"
            : "Your daily puzzles are ready — keep your streak alive! 🔥"
        content.sound = .default

        let cal = Calendar.current
        let now = Date()
        guard var target = cal.date(bySettingHour: reminderHour, minute: 0, second: 0, of: now) else { return }
        let allDoneToday = DailyCompletionsStore.cachedTodayCount() >= DailyCompletionsStore.totalDailyModes
        if allDoneToday || now >= target {
            guard let tomorrow = cal.date(byAdding: .day, value: 1, to: target) else { return }
            target = tomorrow
        }
        let when = cal.dateComponents([.year, .month, .day, .hour, .minute], from: target)
        let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
        center.add(UNNotificationRequest(identifier: reminderId, content: content, trigger: trigger))
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderId])
    }

    /// Current system authorization status (so the UI can reflect a denial).
    static func isAuthorized() async -> Bool {
        let s = await UNUserNotificationCenter.current().notificationSettings()
        return s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
    }
}
