import SwiftUI

/// Shared top header across all four tabs — a 1:1 port of the web AppHeader
/// (components/ui/app-header.tsx): the WORDOCIOUS wordmark (no background) + a
/// PRO badge when active, then help, settings, daily-streak, and streak-shield
/// controls. Help/Settings open their sheets; the streak/shield pills show the
/// real profile values and open an explanatory popover on tap.
struct AppHeaderView: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var showHelp = false
    @State private var showSettings = false
    @State private var showStreak = false
    @State private var showShield = false

    var body: some View {
        HStack(spacing: 6) {
            // Wordmark scales down (rather than clipping the PRO badge) when the
            // PRO badge + controls crowd the row.
            Text("WORDOCIOUS")
                .font(Brand.wordmark(20)).tracking(0.5)
                .foregroundStyle(Theme.wordmarkGradient)
                .lineLimit(1).minimumScaleFactor(0.6)
            if auth.isProActive {
                Text("PRO").font(Brand.font(9, .black)).tracking(0.5).foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)],
                                                              startPoint: .topLeading, endPoint: .bottomTrailing)))
                    .fixedSize()
            }
            Spacer(minLength: 6)

            circleButton("questionmark") { showHelp = true }
            circleButton("gearshape.fill") { showSettings = true }

            if let p = auth.profile, p.dailyLoginStreak > 0 {
                Button { showStreak = true } label: {
                    pill(asset: "flame", iconColor: Color(hex: 0xF97316), text: "\(p.dailyLoginStreak)",
                         textColor: Color(hex: 0x92400E),
                         bg: [Color(hex: 0xFFFBEB), Color(hex: 0xFFF7ED)], border: Color(hex: 0xFDE68A))
                }
                .buttonStyle(.plain)
                .popover(isPresented: $showStreak) { streakPopover(p).modifier(CompactPopover()) }
            }
            if let p = auth.profile {
                Button { showShield = true } label: {
                    pill(asset: "shield", iconColor: Color(hex: 0x8B5CF6), text: "\(p.streakShields)",
                         textColor: Color(hex: 0x5B21B6),
                         bg: [Theme.surfaceHover, Theme.surfaceHover], border: Color(hex: 0xC4B5FD))
                }
                .buttonStyle(.plain)
                .popover(isPresented: $showShield) { shieldPopover(p).modifier(CompactPopover()) }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .sheet(isPresented: $showHelp) { HelpView().presentationDetents([.large]) }
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    // MARK: - Pieces

    private func circleButton(_ system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.textMuted)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Theme.surfaceAlt))
                .overlay(Circle().stroke(Theme.borderAlt, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func pill(asset: String, iconColor: Color, text: String, textColor: Color,
                      bg: [Color], border: Color) -> some View {
        HStack(spacing: 4) {
            Image(asset).renderingMode(.template).resizable().scaledToFit()
                .frame(width: 13, height: 13).foregroundStyle(iconColor)
            Text(text).font(Brand.font(13, .heavy)).foregroundStyle(textColor)
                .lineLimit(1)
        }
        .fixedSize()   // never compress/wrap — keeps both pills the same pill shape
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(Capsule().fill(LinearGradient(colors: bg, startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(Capsule().stroke(border, lineWidth: 1.5))
    }

    private func streakPopover(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image("flame").renderingMode(.template).resizable().scaledToFit().frame(width: 16, height: 16).foregroundStyle(Color(hex: 0xF97316))
                Text("Daily Streak").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
            }
            statRow("Current", "\(p.dailyLoginStreak) \(p.dailyLoginStreak == 1 ? "day" : "days")")
            statRow("Best", "\(p.bestDailyLoginStreak) \(p.bestDailyLoginStreak == 1 ? "day" : "days")")
            Divider().overlay(Theme.divider)
            Text("Play any daily puzzle each day to keep your streak going. Miss a day and it resets — unless you use a streak shield.")
                .font(Brand.font(11, .medium)).foregroundStyle(Theme.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(width: 240).background(Theme.surface)
    }

    private func shieldPopover(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image("shield").renderingMode(.template).resizable().scaledToFit().frame(width: 16, height: 16).foregroundStyle(Color(hex: 0x8B5CF6))
                Text("Streak Shields").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
            }
            statRow("Available", "\(p.streakShields) \(p.streakShields == 1 ? "shield" : "shields")")
            Divider().overlay(Theme.divider)
            Text("Shields protect your streak if you miss a day. Earn a free shield every 7-day streak milestone. PRO members get 4 shields each billing period.")
                .font(Brand.font(11, .medium)).foregroundStyle(Theme.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(width: 240).background(Theme.surface)
    }

    private func statRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            Spacer()
            Text(value).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
        }
    }
}

/// Force the popover to stay a popover (not a sheet) on iPhone where available;
/// falls back to the default adaptation on iOS < 16.4.
private struct CompactPopover: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) { content.presentationCompactAdaptation(.popover) }
        else { content }
    }
}
