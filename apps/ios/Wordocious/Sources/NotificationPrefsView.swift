import SwiftUI
import Supabase

/// Per-event notification preferences for the Friends pushes (Stats + Friends
/// redesign D3.5, founder 2026-09-26, bible §294). Stored in
/// profiles.notification_prefs (jsonb; a missing key means ON) and honored
/// server-side by lib/push/broadcast.ts for every friends push that names a
/// category. Friend requests always arrive — they are not a category here.
/// Native twin of components/friends/notification-prefs.tsx.
enum PushCategories {
    struct Category: Identifiable { let key: String; let label: String; let hint: String; var id: String { key } }
    static let all: [Category] = [
        .init(key: "race", label: "Race finish & overtakes", hint: "Monday's recap and when a friend passes you"),
        .init(key: "challenge", label: "Challenges & games", hint: "VS challenges, and your turn in a quick game"),
        .init(key: "nudge", label: "Nudges & taunts", hint: "The canned one-liners"),
        .init(key: "feed", label: "Moments", hint: "Reactions, shield gifts and other circle moments"),
    ]

    static func anyOff(_ prefs: [String: Bool]?) -> Bool {
        all.contains { prefs?[$0.key] == false }
    }
}

/// The four Friends push categories as toggles — one tinted row each (§A1). Each
/// flip writes profiles.notification_prefs for the owner (the Simulate Pro update →
/// refreshProfile pattern) so every surface agrees. Used by Settings → Notifications.
struct NotificationPrefsToggles: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var saving: String?

    private struct PrefsUpdate: Encodable { let notification_prefs: [String: Bool] }

    var body: some View {
        let prefs = auth.profile?.notificationPrefs ?? [:]
        // BJ7: 6 between toggles, 7 vertical padding, the hint 4 under the label.
        VStack(alignment: .leading, spacing: 6) {
            ForEach(PushCategories.all) { c in
                let on = prefs[c.key] != false
                Toggle(isOn: Binding(get: { on }, set: { _ in toggle(c.key, prefs: prefs) })) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(c.label).font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                        Text(c.hint).font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary).lineLimit(1)
                    }
                }
                .toggleStyle(.candy)   // button family §4
                .disabled(saving != nil)
                .opacity(saving == c.key ? 0.5 : 1)
                .padding(.horizontal, 12).padding(.vertical, 7)
                .tintedPill(Color(hex: 0x7C3AED), radius: 14)
            }
        }
    }

    private func toggle(_ key: String, prefs: [String: Bool]) {
        guard saving == nil, let uid = auth.profile?.id else { return }
        saving = key
        var next = prefs
        next[key] = prefs[key] == false   // off → on; on or missing → off
        Task {
            _ = try? await auth.client.from("profiles")
                .update(PrefsUpdate(notification_prefs: next))
                .eq("id", value: uid).execute()
            await auth.refreshProfile()
            saving = nil
        }
    }
}

/// One explicit notification_prefs key written the same way the sheet's toggles
/// write (merge into the existing object, then refresh the profile) — the live
/// search's "Ping me when someone's looking" switch (VS spec §13).
@MainActor
enum NotificationPrefsWriter {
    private struct PrefsUpdate: Encodable { let notification_prefs: [String: Bool] }

    static func set(_ key: String, _ on: Bool, saving: Binding<Bool>) {
        let auth = AuthService.shared
        guard !saving.wrappedValue, let uid = auth.profile?.id else { return }
        saving.wrappedValue = true
        var next = auth.profile?.notificationPrefs ?? [:]
        next[key] = on
        Task {
            _ = try? await auth.client.from("profiles")
                .update(PrefsUpdate(notification_prefs: next))
                .eq("id", value: uid).execute()
            await auth.refreshProfile()
            saving.wrappedValue = false
        }
    }
}
