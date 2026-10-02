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

/// The bell in the FRIENDS card header: the 3D bell, slashed when any category
/// is off; tapping opens the prefs sheet.
struct NotificationPrefsButton: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var open = false

    var body: some View {
        if auth.profile != nil {
            let anyOff = PushCategories.anyOff(auth.profile?.notificationPrefs)
            Button { open = true } label: {
                // A header action: the shared soft white circle (HEADER_SPEC §4).
                // ART_SPEC §5: the 3D bell; slashed + dimmed when a category is off.
                HeaderCircleLabel(glyph: anyOff ? .mutedIcon(.bell) : .icon(.bell), size: 32,
                                  tint: anyOff ? Theme.textMuted : PageHeaderStyle.ink)
            }
            .buttonStyle(.squish)
            .accessibilityLabel("Friends notification settings")
            .sheet(isPresented: $open) {
                NotificationPrefsSheet().presentationDetents([.medium])
            }
        }
    }
}

/// The four categories with toggles; each flip writes profiles.notification_prefs
/// for the owner (the Simulate Pro update → refreshProfile pattern) so every
/// surface agrees.
struct NotificationPrefsSheet: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var saving: String?

    private struct PrefsUpdate: Encodable { let notification_prefs: [String: Bool] }

    var body: some View {
        let prefs = auth.profile?.notificationPrefs ?? [:]
        VStack(alignment: .leading, spacing: 14) {
            Text("Friends notifications")
                .font(Brand.font(10, .black)).tracking(0.8).textCase(.uppercase)
                .foregroundStyle(Theme.textMuted)
            ForEach(PushCategories.all) { c in
                let on = prefs[c.key] != false
                Toggle(isOn: Binding(get: { on }, set: { _ in toggle(c.key, prefs: prefs) })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(c.label).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                        Text(c.hint).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                    }
                }
                .tint(Color(hex: 0x7C3AED))
                .disabled(saving != nil)
                .opacity(saving == c.key ? 0.5 : 1)
            }
            Text("Friend requests always come through.")
                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pageBackground(.home)
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
