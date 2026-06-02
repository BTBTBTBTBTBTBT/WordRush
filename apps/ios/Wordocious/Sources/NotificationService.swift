import Foundation
import UserNotifications

/// Local daily-reminder notification — the native counterpart to the web's
/// push daily-reminder (apps/web/api/cron/daily-reminder). Native uses an
/// on-device repeating local notification (no server / APNs needed): a single
/// reminder at a fixed local hour nudging the player to keep their streak.
enum NotificationService {
    static let reminderId = "daily-reminder"
    /// Local hour (24h) the reminder fires — evening, before the day rolls over.
    static let reminderHour = 18

    /// Request permission and, if granted, (re)schedule the daily reminder.
    /// Returns whether notifications are authorized.
    @discardableResult
    static func requestAndSchedule() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { schedule() }
        return granted
    }

    /// Schedule (or reschedule) the repeating daily reminder.
    static func schedule() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderId])

        let content = UNMutableNotificationContent()
        content.title = "Wordocious"
        content.body = "Your daily puzzles are ready — keep your streak alive! 🔥"
        content.sound = .default

        var when = DateComponents()
        when.hour = reminderHour
        let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
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
