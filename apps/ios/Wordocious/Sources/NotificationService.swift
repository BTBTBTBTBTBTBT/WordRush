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
        if granted {
            await schedule()
            // Re-register for APNs the moment permission exists. Launch-time
            // registration yields a token even while unauthorized, but iOS
            // won't DISPLAY anything sent to it — and the app never appears
            // under Settings > Notifications until authorization is requested.
            await PushRegistration.register()
        }
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

    /// Schedule (or reschedule) a one-shot reminder for the next 18:00 local on
    /// a day the player hasn't touched:
    ///   - ANY daily already recorded today, or it's past 18:00 → tomorrow 18:00
    ///   - otherwise → today 18:00
    ///
    /// "Any", not "all nine": a single daily secures the streak, so someone who
    /// played one puzzle this morning is done being nudged tonight. Gating on
    /// all 9 meant a player who'd already locked in their streak still got a
    /// "streak at risk" banner in the evening — a claim that was simply false.
    /// Copy is streak-aware: a daily-login streak ≥ 3 names the streak so the
    /// nudge carries real loss-aversion weight; below that, the generic body.
    @MainActor
    static func schedule() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderId])

        let content = UNMutableNotificationContent()
        // iOS owns the banner chrome — type and color aren't themeable — so the
        // branding lives in the app icon plus the game's all-caps headline voice
        // (FLAWLESS VICTORY!, DAILY SWEEP!). Kept in step with the server copy in
        // apps/web/app/api/cron/daily-reminder.
        let streak = AuthService.shared.profile?.dailyLoginStreak ?? 0
        content.title = streak >= 3 ? "STREAK AT RISK! 🔥" : "DAILY CHALLENGE 🧩"
        content.body = streak >= 3
            ? "Your \(streak)-day streak ends at midnight. One quick game keeps it alive."
            : "Today's nine puzzles are live. Keep the streak going."
        content.sound = .default

        let cal = Calendar.current
        let now = Date()
        guard var target = cal.date(bySettingHour: reminderHour, minute: 0, second: 0, of: now) else { return }
        // One daily is enough to keep the streak — see the note above.
        let playedToday = DailyCompletionsStore.cachedTodayCount() > 0
        if playedToday || now >= target {
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
