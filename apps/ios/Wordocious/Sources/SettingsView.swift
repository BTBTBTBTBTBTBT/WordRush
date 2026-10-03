import SwiftUI
import StoreKit
import WordociousCore

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
    /// BJ11: Manage Subscription shows the branded hand-off before Apple's sheet.
    @State private var showManage = false
    @State private var deleting = false
    @State private var deleteError = false
    @State private var infoKind: InfoKind?
    @State private var consentError: String?
    /// BI25: the sheet has finished presenting — heavier, below-the-fold pieces load now.
    @State private var settled = false
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
                    // FINISH_SPEC BJ3: lazy — the sheet's presenting frame builds only the
                    // sections on screen (measured: the gear's open stalled 240–580 ms).
                    // BJ7: 12 between sections (was 16).
                    LazyVStack(alignment: .leading, spacing: 12) {
                        // FINISH_SPEC §AA3: the WORDOCIOUS PRO member card leads Settings
                        // (free players see the Go Pro upsell in the same slot).
                        SettingsProCard()
                        // FINISH_SPEC §G5: every section is a tinted card with its own
                        // top bar (§A1); rows squish (§A9); toggles take the accent.
                        section("THEME", accent: G5Accent.lilac) {
                            VStack(spacing: 6) {
                                ForEach(themes, id: \.value) { t in themeRow(t) }
                            }
                        }
                        section("KEYBOARD", accent: G5Accent.blue) {
                            VStack(spacing: 6) {
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
                        // BI25: built after the sheet lands (its identity load + Google
                        // art stay off the presenting frame); it sits below the fold.
                        if settled && auth.isAuthenticated && SupabaseConfig.isConfigured {
                            LinkedSignInsSection()
                        }
                        section("SUBSCRIPTION", accent: G5Accent.gold) {
                            VStack(spacing: 0) {
                                // Apple's native manage-subscriptions sheet (cancel,
                                // change plan, resubscribe). Works signed-out too —
                                // it's the App Store account's subs, not ours. BJ11: the
                                // row says what opens, and the hand-off sheet comes first.
                                Button { showManage = true } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text("Manage Subscription").font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                                            Text(SubscriptionCopy.handoff(.apple).line)
                                                .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                                        }
                                        Spacer()
                                        Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .heavy))
                                            .foregroundStyle(G5Accent.gold.opacity(0.8)).accessibilityHidden(true)
                                    }
                                    .padding(.vertical, 8)
                                    .frame(minHeight: 44)
                                    .contentShape(Rectangle())
                                }.buttonStyle(.squish)
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
                            VStack(spacing: 8) {
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
                            PoseImage(.u, "tea", height: 68)
                            Text("Wordocious · v1.0.0").font(Brand.font(11, .bold))
                                .foregroundStyle(FinishInk.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
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
            .proManageHandoff($showManage)
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
            .softSheet(item: $infoKind) { InfoPage($0).presentationDetents([.large]) }
        }
        .task {
            // BI25: after the slide-up (~0.35 s), never on the tap frame.
            try? await Task.sleep(nanoseconds: 380_000_000)
            settled = true
        }
    }

    private func section<C: View>(_ title: String, accent: Color, @ViewBuilder _ content: @escaping () -> C) -> some View {
        G5Card(title, accent: accent) { content() }
    }

    private let keyboardLayouts: [(value: String, label: String, desc: String)] = [
        ("standard", "Standard", "Enter left, delete right"),
        ("flipped", "Flipped", "Delete left, enter right"),
        ("michael", "Michael Keyboard", "4 rows, delete + enter on both sides"),
    ]

    private func keyboardRow(_ k: (value: String, label: String, desc: String)) -> some View {
        SettingsOptionTile(label: k.label, desc: k.desc, active: keyboardLayout == k.value, accent: G5Accent.blue) {
            KeyRowPreview(layout: k.value)
        } action: {
            keyboardLayout = k.value
        }
    }

    private func themeRow(_ t: (value: String, label: String, desc: String)) -> some View {
        SettingsOptionTile(label: t.label, desc: t.desc, active: theme == t.value, accent: G5Accent.lilac) {
            ThemeTilesPreview(theme: t.value)
        } action: {
            themeManager.theme = t.value
        }
    }

    private func toggleRow(_ title: String, _ sub: String, _ binding: Binding<Bool>, accent: Color) -> some View {
        Toggle(isOn: binding) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                Text(sub).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        // The candy on/off switch (night art 10-03 sprites, proposal 3); still a Toggle for VoiceOver.
        .toggleStyle(.candy).padding(.vertical, 4)
    }

    private func linkRow(_ title: String, accent: Color = G5Accent.purple) -> some View {
        HStack {
            Text(title).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .heavy))
                .foregroundStyle(accent.opacity(0.7)).accessibilityHidden(true)
        }
        .padding(.vertical, 10)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }
}

// MARK: - BI25 option tiles (no outlines)

/// BI25: a THEME / KEYBOARD choice as a soft filled tile — unselected a pale wash of
/// the section's color (no stroke); selected a glossy filled tile in that color with
/// white text and a small white check badge. A live preview sits on the right. The
/// selected look cross-fades (opacity only); the press squishes (transform).
struct SettingsOptionTile<Preview: View>: View {
    let label: String
    let desc: String
    let active: Bool
    let accent: Color
    @ViewBuilder var preview: () -> Preview
    let action: () -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let dark = Theme.isDark
        Button(action: action) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(Brand.font(14, .black))
                        .foregroundStyle(active ? Color.white : FinishInk.heading)
                    Text(desc).font(Brand.font(10, .bold))
                        .foregroundStyle(active ? Color.white.opacity(0.88) : FinishInk.secondary)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }
                Spacer(minLength: 6)
                preview()
                ZStack {
                    Circle().fill(Color.white)
                    Image(systemName: "checkmark").font(.system(size: 10, weight: .black)).foregroundStyle(accent)
                }
                .frame(width: 20, height: 20)
                .shadow(color: Color.black.opacity(0.15), radius: 1.5, x: 0, y: 1)
                .opacity(active ? 1 : 0)
                .accessibilityHidden(true)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .frame(minHeight: 44)
            .background {
                ZStack {
                    shape.fill(dark ? accent.opacity(0.16) : accent.wash(0.11))
                    // The glossy selected face: the accent, lighter at the top, a soft
                    // top sheen and a darker lip — opacity-faded in, never a ring.
                    ZStack(alignment: .top) {
                        shape.fill(LinearGradient(colors: [Color.white.mixed(over: accent, 0.22), accent,
                                                           Color.black.mixed(over: accent, 0.12)],
                                                  startPoint: .top, endPoint: .bottom))
                        shape.fill(LinearGradient(colors: [Color.white.opacity(0.32), Color.white.opacity(0)],
                                                  startPoint: .top, endPoint: .center))
                            .padding(2)
                    }
                    .shadow(color: accent.opacity(0.35), radius: 6, x: 0, y: 4)
                    .opacity(active ? 1 : 0)
                }
            }
            .contentShape(shape)
            .animation(.easeOut(duration: 0.18), value: active)
        }
        .buttonStyle(.squish)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
    }
}

/// BI25: a live THEME preview — four mini glossy letter tiles in the theme's colors on
/// a chip of that theme's page wash (rules: Core `SettingsPreviews`, unit tested ×3).
struct ThemeTilesPreview: View {
    let theme: String

    var body: some View {
        let spec = SettingsPreviews.theme(theme)
        HStack(spacing: 2) {
            ForEach(Array(spec.tiles.enumerated()), id: \.offset) { _, t in
                ZStack {
                    RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                        .fill(LinearGradient(colors: [Color.white.mixed(over: Color(hex: UInt(t.hex)), 0.25), Color(hex: UInt(t.hex))],
                                             startPoint: .top, endPoint: .bottom))
                    RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                        .fill(LinearGradient(colors: [Color.white.opacity(0.35), .clear], startPoint: .top, endPoint: .center))
                        .padding(1)
                    Text(t.letter).font(Brand.font(9, .black)).foregroundStyle(.white)
                }
                .frame(width: 15, height: 15)
            }
        }
        .padding(4)
        .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(Color(hex: UInt(spec.page))))
        .accessibilityHidden(true)
    }
}

/// BI25: a mini key row showing where Enter and Delete sit for a keyboard layout.
struct KeyRowPreview: View {
    let layout: String

    var body: some View {
        VStack(spacing: 2) {
            ForEach(Array(SettingsPreviews.keyRows(layout).enumerated()), id: \.offset) { _, row in
                HStack(spacing: 2) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, key in keyCap(key) }
                }
            }
        }
        .padding(4)
        .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(Color.white.opacity(Theme.isDark ? 0.12 : 0.55)))
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func keyCap(_ key: String) -> some View {
        let special = key == SettingsPreviews.enter || key == SettingsPreviews.delete
        let shape = RoundedRectangle(cornerRadius: 2.5, style: .continuous)
        ZStack {
            shape.fill(special ? Color(hex: 0xF59E0B) : Color.white)
                .shadow(color: Color.black.opacity(0.12), radius: 0, x: 0, y: 1)
            switch key {
            case SettingsPreviews.enter:
                Image(systemName: "return").font(.system(size: 6.5, weight: .black)).foregroundStyle(.white)
            case SettingsPreviews.delete:
                Image(systemName: "delete.left.fill").font(.system(size: 6.5, weight: .black)).foregroundStyle(.white)
            case SettingsPreviews.space:
                EmptyView()
            default:
                Text(key).font(Brand.font(6.5, .black)).foregroundStyle(FinishInk.softNumber)
            }
        }
        .frame(width: special ? 15 : (key == SettingsPreviews.space ? 26 : 8), height: 11)
    }
}
