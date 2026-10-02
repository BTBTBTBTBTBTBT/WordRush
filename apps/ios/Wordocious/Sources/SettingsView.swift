import SwiftUI
import StoreKit

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
    // FINISH_SPEC §U: every haptic is gated by this (Haptics reads UserDefaults).
    @AppStorage("pref-haptics") private var hapticsOn = true
    // Keyboard layout (§213): standard | flipped | michael. Pure rendering —
    // KeyboardView reads this to arrange the same keys three ways.
    @AppStorage("pref-keyboard-layout") private var keyboardLayout = "standard"
    @AppStorage("pref-daily-reminder") private var dailyReminder = false
    /// FINISH_SPEC §X: the admin-only season preview ("halloween" | "" = by date).
    @AppStorage(CastSkin.debugKey) private var debugSeason = ""
    @State private var reminderDenied = false
    @State private var showDeleteConfirm = false
    @State private var deleting = false
    @State private var deleteError = false
    @State private var infoKind: InfoKind?
    @State private var consentError: String?
    // Colorblind + reduced-motion are owned by ThemeManager so changes publish
    // and apply app-wide (tile palette / animation gating).

    private let themes: [(value: String, label: String, desc: String)] = [
        ("default", "Default", "Purple & amber tiles"),
        ("dark", "Dark", "Easy on the eyes"),
        ("ocean", "Ocean", "Blue and teal tones"),
        ("forest", "Forest", "Green and earth tones"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                PageBackground(tint: .home)
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // FINISH_SPEC §AA3: the WORDOCIOUS PRO member card leads Settings
                        // (free players see the Go Pro upsell in the same slot).
                        SettingsProCard()
                        // FINISH_SPEC §G5: every section is a tinted card with its own
                        // top bar (§A1); rows squish (§A9); toggles take the accent.
                        section("THEME", accent: G5Accent.lilac) {
                            VStack(spacing: 8) {
                                ForEach(themes, id: \.value) { t in themeRow(t) }
                            }
                        }
                        section("KEYBOARD", accent: G5Accent.blue) {
                            VStack(spacing: 8) {
                                ForEach(keyboardLayouts, id: \.value) { k in keyboardRow(k) }
                            }
                        }
                        section("SOUND & FEEDBACK", accent: G5Accent.teal) {
                            toggleRow("Sound Effects", "Key taps, win/loss jingles", $soundOn, accent: G5Accent.teal)
                            G5Divider(accent: G5Accent.teal)
                            toggleRow("Haptics", "Gentle taps and buzzes as you play", $hapticsOn, accent: G5Accent.teal)
                        }
                        section("NOTIFICATIONS", accent: G5Accent.pink) {
                            toggleRow("Daily Reminders", "A nudge to play today's puzzles", $dailyReminder, accent: G5Accent.pink)
                            // FINISH_SPEC §C4b: the Friends push categories moved here
                            // from the bell beside the FRIENDS title — the same toggles
                            // and write path (NotificationPrefsToggles), shown only
                            // signed in, like the bell was.
                            if auth.profile != nil {
                                G5Divider(accent: G5Accent.pink)
                                FinishLabel("Friends notifications")
                                NotificationPrefsToggles()
                                Text("Friend requests always come through.")
                                    .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                            }
                        }
                        section("ACCESSIBILITY", accent: G5Accent.green) {
                            VStack(spacing: 0) {
                                toggleRow("Colorblind Mode", "High contrast colors", $themeManager.colorblind, accent: G5Accent.green)
                                G5Divider(accent: G5Accent.green)
                                toggleRow("Reduced Motion", "Minimize animations", $themeManager.reducedMotion, accent: G5Accent.green)
                            }
                        }
                        // FINISH_SPEC §X: admin-only preview of the Halloween cast skins.
                        if auth.profile?.isAdmin == true {
                            section("ADMIN", accent: G5Accent.coral) {
                                toggleRow("Halloween preview", "Show the Halloween cast skins today",
                                          Binding(get: { debugSeason == "halloween" },
                                                  set: { debugSeason = $0 ? "halloween" : ""; CastSkin.invalidate() }),
                                          accent: G5Accent.coral)
                            }
                        }
                        // Which providers open this account + link Google / Apple
                        // to it (founder, 2026-09-30). Signed-in accounts only.
                        if auth.isAuthenticated && SupabaseConfig.isConfigured {
                            LinkedSignInsSection()
                        }
                        section("SUBSCRIPTION", accent: G5Accent.gold) {
                            VStack(spacing: 0) {
                                // Apple's native manage-subscriptions sheet (cancel,
                                // change plan, resubscribe). Works signed-out too —
                                // it's the App Store account's subs, not ours. URL
                                // fallback if no foreground scene is available.
                                Button {
                                    Task {
                                        if let scene = UIApplication.shared.connectedScenes
                                            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                                            try? await AppStore.showManageSubscriptions(in: scene)
                                        } else if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                                            await UIApplication.shared.open(url)
                                        }
                                    }
                                } label: { linkRow("Manage Subscription", accent: G5Accent.gold) }.buttonStyle(.squish)
                            }
                        }
                        section("ABOUT", accent: G5Accent.purple) {
                            VStack(spacing: 0) {
                                // Present as sheets (same as the "?" menu) rather than pushing —
                                // InfoPage hides the nav bar, so pushing it animated the bar
                                // in/out on back (the flicker). Sheets have no nav bar.
                                //
                                // "About Wordocious" led this section until 2026-08-01 —
                                // dropped for the same reason it left the "?" menu: it
                                // restated How to Play in older copy. Section now opens
                                // with Help & Support.
                                Button { infoKind = .support } label: { linkRow("Help & Support") }.buttonStyle(.squish)
                                G5Divider()
                                Button { infoKind = .privacy } label: { linkRow("Privacy Policy") }.buttonStyle(.squish)
                                G5Divider()
                                // Ad-consent withdrawal. UMP requires a
                                // PERSISTENT entry point — the first-launch
                                // form is a one-shot, and the in-app policy
                                // promised a choice users could revisit.
                                // Hidden outside consent regions, where the
                                // form would present nothing.
                                if AdsManager.shared.privacyOptionsRequired {
                                    Button {
                                        AdsManager.shared.showPrivacyOptions { err in
                                            consentError = err
                                        }
                                    } label: { linkRow("Ad Privacy Settings") }.buttonStyle(.squish)
                                    G5Divider()
                                }
                                Button { infoKind = .terms } label: { linkRow("Terms of Service") }.buttonStyle(.squish)
                            }
                        }
                        if auth.isAuthenticated {
                            // §A8 / §G5: the account actions are candy buttons — Sign
                            // Out the quiet peach, Delete the pink (its confirmation
                            // alert is unchanged).
                            VStack(spacing: 10) {
                                Button { Task { await auth.signOut(); dismiss() } } label: {
                                    CandyLabel(title: "Sign Out", symbol: "rectangle.portrait.and.arrow.right")
                                }
                                .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium))

                                // Delete Account — ports the web profile flow (calls
                                // /api/account/delete). Required by App Store 5.1.1(v).
                                Button(role: .destructive) { showDeleteConfirm = true } label: {
                                    CandyLabel(title: "Delete Account", symbol: "trash.fill")
                                }
                                .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium))
                                .disabled(deleting)
                            }
                            .padding(.top, 4)
                        }
                        // §G5 / §A7: a cast pose in the footer — U with her tea (the
                        // Settings host is R, so not R).
                        VStack(spacing: 4) {
                            PoseImage(.u, "tea", height: 86)
                            Text("Wordocious · v1.0.0").font(Brand.font(11, .bold))
                                .foregroundStyle(FinishInk.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)
                    }
                    .padding(16)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    // ART_SPEC §2: the whole-cast SETTINGS art (it carries the cast, so R's host spot is gone).
                    ArtTitle(.settings, maxWidth: 230).frame(maxHeight: 42)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { dismiss() }
                }
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
            // Google's form failed to present (offline / UMP unreachable).
            // Swallowing it silently would leave the user tapping a row that
            // does nothing — the dead end the row exists to remove.
            .alert("Couldn't open ad privacy settings",
                   isPresented: Binding(get: { consentError != nil },
                                        set: { if !$0 { consentError = nil } })) {
                Button("OK", role: .cancel) { consentError = nil }
            } message: {
                Text((consentError ?? "") + "\n\nCheck your connection and try again.")
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

    private func section<C: View>(_ title: String, accent: Color, @ViewBuilder _ content: @escaping () -> C) -> some View {
        G5Card(title, accent: accent) { content() }
    }

    private let keyboardLayouts: [(value: String, label: String, desc: String)] = [
        ("standard", "Standard", "Enter left, delete right"),
        ("flipped", "Flipped", "Delete left, enter right"),
        ("michael", "Michael Keyboard", "4 rows like your phone — delete and enter on both sides"),
    ]

    private func keyboardRow(_ k: (value: String, label: String, desc: String)) -> some View {
        optionRow(label: k.label, desc: k.desc, active: keyboardLayout == k.value, accent: G5Accent.blue) {
            keyboardLayout = k.value
        }
    }

    private func themeRow(_ t: (value: String, label: String, desc: String)) -> some View {
        optionRow(label: t.label, desc: t.desc, active: theme == t.value, accent: G5Accent.lilac) {
            themeManager.theme = t.value
        }
    }

    /// §A1 a selectable mini tile (selected = stronger tint + accent ring), squish (§A9).
    private func optionRow(label: String, desc: String, active: Bool, accent: Color,
                           action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                    Text(desc).font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                }
                Spacer()
                if active { Image(systemName: "checkmark.circle.fill").foregroundStyle(accent) }
            }
            .padding(12)
            .contentShape(Rectangle())
            .g5Option(active: active, accent: accent, radius: 14)
        }
        .buttonStyle(.squish)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private func toggleRow(_ title: String, _ sub: String, _ binding: Binding<Bool>, accent: Color) -> some View {
        Toggle(isOn: binding) {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                Text(sub).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
        }
        .tint(accent).padding(.vertical, 6)
    }

    private func linkRow(_ title: String, accent: Color = G5Accent.purple) -> some View {
        HStack {
            Text(title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .heavy))
                .foregroundStyle(accent.opacity(0.7)).accessibilityHidden(true)
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }
}
