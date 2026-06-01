import SwiftUI

/// Settings — mirrors components/settings-dialog.tsx (theme picker + Sound /
/// Colorblind / Reduced-motion toggles) plus account + info links + version.
/// Toggles + theme choice persist to UserDefaults. NOTE: applying the
/// non-default themes (Dark/Ocean/Forest) app-wide is deferred infra — the
/// choice is saved but only Default is fully styled today.
struct SettingsView: View {
    @ObservedObject var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss

    @AppStorage("pref-theme") private var theme = "default"
    @AppStorage("pref-sound") private var soundOn = true
    @AppStorage("pref-colorblind") private var colorblind = false
    @AppStorage("pref-reduced-motion") private var reducedMotion = false

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
                        section("PREFERENCES") {
                            VStack(spacing: 0) {
                                toggleRow("Sound Effects", "Tile flips and key taps", $soundOn)
                                Divider().overlay(Theme.border)
                                toggleRow("Colorblind Mode", "High-contrast tile colors", $colorblind)
                                Divider().overlay(Theme.border)
                                toggleRow("Reduced Motion", "Minimize animations", $reducedMotion)
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        section("ABOUT") {
                            VStack(spacing: 0) {
                                NavigationLink { InfoPage(.about) } label: { linkRow("About Wordocious") }
                                Divider().overlay(Theme.border)
                                NavigationLink { InfoPage(.support) } label: { linkRow("Help & Support") }
                                Divider().overlay(Theme.border)
                                NavigationLink { InfoPage(.privacy) } label: { linkRow("Privacy Policy") }
                                Divider().overlay(Theme.border)
                                NavigationLink { InfoPage(.terms) } label: { linkRow("Terms of Service") }
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        if auth.isAuthenticated {
                            Button { Task { await auth.signOut(); dismiss() } } label: {
                                Text("Sign out").font(Brand.body(15)).frame(maxWidth: .infinity).frame(height: 46)
                            }.buttonStyle(.bordered).tint(Color(hex: 0xDC2626))
                        }
                        Text("Wordocious · v1.0.0").font(Brand.font(11, .bold))
                            .foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            content()
        }
    }

    private func themeRow(_ t: (value: String, label: String, desc: String)) -> some View {
        let active = theme == t.value
        return Button { theme = t.value } label: {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.label).font(Brand.headline(14)).foregroundStyle(Theme.textPrimary)
                    Text(t.desc).font(Brand.body(11)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
                if active { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.primary) }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surfaceHover : Theme.surface))
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
