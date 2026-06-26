import SwiftUI

/// Settings — mirrors components/settings-dialog.tsx (theme picker + Sound /
/// Colorblind / Reduced-motion toggles) plus account + info links + version.
/// Toggles persist to UserDefaults. The theme choice is owned by
/// `ThemeManager` and recolors the whole app live (Default / Dark / Ocean /
/// Forest), mirroring the web's `[data-theme]` palette switch.
struct SettingsView: View {
    @ObservedObject var auth = AuthService.shared
    @ObservedObject private var themeManager = ThemeManager.shared
    @Environment(\.dismiss) private var dismiss

    // Active theme is owned by ThemeManager (publishes app-wide recolor).
    private var theme: String { themeManager.theme }
    // Sound reads UserDefaults directly in SoundManager; @AppStorage writes it.
    @AppStorage("pref-sound") private var soundOn = true
    @AppStorage("pref-daily-reminder") private var dailyReminder = false
    @State private var reminderDenied = false
    @State private var showDeleteConfirm = false
    @State private var deleting = false
    @State private var deleteError = false
    @State private var infoKind: InfoKind?
    // Colorblind + reduced-motion are owned by ThemeManager so changes publish
    // and apply app-wide (tile palette / animation gating).

    private let themes: [(value: String, label: String, desc: String)] = [
        ("default", "Default", "Classic Wordle colors"),
        ("dark", "Dark", "Easy on the eyes"),
        ("ocean", "Ocean", "Blue and teal tones"),
        ("forest", "Forest", "Green and earth tones"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        section("THEME") {
                            VStack(spacing: 8) {
                                ForEach(themes, id: \.value) { t in themeRow(t) }
                            }
                        }
                        section("SOUND & FEEDBACK") {
                            VStack(spacing: 0) {
                                toggleRow("Sound Effects", "Key taps, win/loss jingles", $soundOn)
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        section("NOTIFICATIONS") {
                            VStack(spacing: 0) {
                                toggleRow("Daily Reminders", "A nudge to play today's puzzles", $dailyReminder)
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        section("ACCESSIBILITY") {
                            VStack(spacing: 0) {
                                toggleRow("Colorblind Mode", "High contrast colors", $themeManager.colorblind)
                                Divider().overlay(Theme.border)
                                toggleRow("Reduced Motion", "Minimize animations", $themeManager.reducedMotion)
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        section("ABOUT") {
                            VStack(spacing: 0) {
                                // Present as sheets (same as the "?" menu) rather than pushing —
                                // InfoPage hides the nav bar, so pushing it animated the bar
                                // in/out on back (the flicker). Sheets have no nav bar.
                                Button { infoKind = .about } label: { linkRow("About Wordocious") }.buttonStyle(.plain)
                                Divider().overlay(Theme.border)
                                Button { infoKind = .support } label: { linkRow("Help & Support") }.buttonStyle(.plain)
                                Divider().overlay(Theme.border)
                                Button { infoKind = .privacy } label: { linkRow("Privacy Policy") }.buttonStyle(.plain)
                                Divider().overlay(Theme.border)
                                Button { infoKind = .terms } label: { linkRow("Terms of Service") }.buttonStyle(.plain)
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        if auth.isAuthenticated {
                            Button { Task { await auth.signOut(); dismiss() } } label: {
                                Text("Sign Out").font(Brand.body(15)).frame(maxWidth: .infinity).frame(height: 46)
                            }.buttonStyle(.bordered).tint(Color(hex: 0xDC2626))

                            // Delete Account — ports the web profile flow (calls
                            // /api/account/delete). Required by App Store 5.1.1(v).
                            Button(role: .destructive) { showDeleteConfirm = true } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "trash").font(.system(size: 15))
                                    Text("Delete Account").font(Brand.font(14, .heavy))
                                    Spacer()
                                }
                                .foregroundStyle(Color(hex: 0xDC2626))
                                .padding(14)
                                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xFECACA), lineWidth: 1.5))
                            }
                            .buttonStyle(.plain)
                            .disabled(deleting)
                        }
                        Text("Wordocious · v1.0.0").font(Brand.font(11, .bold))
                            .foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity)
                    }
                    .padding(16)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("SETTINGS").font(Brand.font(17, .black)).foregroundStyle(Theme.wordmarkGradient)
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
            .onChange(of: dailyReminder) { on in
                if on {
                    Task {
                        let granted = await NotificationService.requestAndSchedule()
                        if !granted { dailyReminder = false; reminderDenied = true }
                    }
                } else {
                    NotificationService.cancel()
                }
            }
            .alert("Notifications are off", isPresented: $reminderDenied) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Enable notifications for Wordocious in iOS Settings to get a daily reminder.")
            }
            .alert("Delete your account?", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button(deleting ? "Deleting…" : "Delete Forever", role: .destructive) {
                    deleting = true
                    Task {
                        let ok = await auth.deleteAccount()
                        deleting = false
                        if ok { dismiss() } else { deleteError = true }
                    }
                }.disabled(deleting)
            } message: {
                Text("This will permanently delete your profile, stats, streak, medals, achievements, and all game data. This action cannot be undone.")
            }
            .alert("Couldn't delete account", isPresented: $deleteError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Please try again or contact support@wordocious.com.")
            }
            .sheet(item: $infoKind) { InfoPage($0).presentationDetents([.large]) }
        }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(Brand.font(11, .heavy)).tracking(1.1).foregroundStyle(Theme.textMuted)
            content()
        }
    }

    private func themeRow(_ t: (value: String, label: String, desc: String)) -> some View {
        let active = theme == t.value
        return Button { themeManager.theme = t.value } label: {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.label).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                    Text(t.desc).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
                if active { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.primary) }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surfaceHover : Theme.background))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Color(hex: 0xC4B5FD) : Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
    }

    private func toggleRow(_ title: String, _ sub: String, _ binding: Binding<Bool>) -> some View {
        Toggle(isOn: binding) {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Brand.headline(14)).foregroundStyle(Theme.textPrimary)
                Text(sub).font(Brand.body(11)).foregroundStyle(Theme.textMuted)
            }
        }
        .tint(Theme.primary).padding(12)
    }

    private func linkRow(_ title: String) -> some View {
        HStack {
            Text(title).font(Brand.headline(14)).foregroundStyle(Theme.textPrimary)
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
        }.padding(12)
    }
}
