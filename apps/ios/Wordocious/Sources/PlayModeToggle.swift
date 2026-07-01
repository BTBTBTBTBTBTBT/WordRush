import SwiftUI

/// Daily ⇄ Unlimited play mode (Pro-only). Ports the web PlayMode type.
enum PlayMode: String { case daily, unlimited }

/// Shared fixed height for the three home hero cards (DailyChallengeHero,
/// UnlimitedHero, and the Sweep/Flawless banner). Pinning them to one height
/// guarantees the Daily⇄Unlimited toggle never shifts anything below it.
let heroHeight: CGFloat = 78

/// Segmented Daily | Unlimited pill — ports components/ui/play-mode-toggle.tsx.
/// Shown to Pro users only; free users are forced to Daily.
struct PlayModeToggle: View {
    @Binding var value: PlayMode

    var body: some View {
        HStack(spacing: 0) {
            seg(.daily, "star.fill", "Daily")
            seg(.unlimited, "infinity", "Unlimited")
        }
        .padding(2)
        .background(Capsule().fill(Theme.surfaceHover))
        .overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
    }

    private func seg(_ m: PlayMode, _ icon: String, _ label: String) -> some View {
        let active = value == m
        return Button { value = m } label: {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 12, weight: .bold))
                Text(label).font(Brand.font(12, .heavy))
            }
            .foregroundStyle(active ? Theme.primary : Theme.textMuted)
            .frame(maxWidth: .infinity).padding(.vertical, 7)
            .background(Capsule().fill(active ? Theme.surface : Color.clear))
            .shadow(color: active ? Theme.primary.opacity(0.12) : .clear, radius: 3, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

/// Daily-mode hero — "★ Daily Challenge ★ / N puzzles · Leaderboards & medals /
/// Resets in HH:MM:SS". Sized to match UnlimitedHero exactly (same py + three
/// lines) so toggling Daily⇄Unlimited never shifts the cards below. Ports the
/// web Daily hero (app/page.tsx).
struct DailyChallengeHero: View {
    var body: some View {
        VStack(spacing: 3) {
            HStack(spacing: 8) {
                Image(systemName: "star.fill").font(.system(size: 17)).foregroundStyle(Color(hex: 0x7C3AED))
                Text("Daily Challenge").font(Brand.font(18, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x4F46E5)], startPoint: .leading, endPoint: .trailing))
                Image(systemName: "star.fill").font(.system(size: 17)).foregroundStyle(Color(hex: 0x4F46E5))
            }
            Text("\(DailyCompletionsStore.totalDailyModes) puzzles · Leaderboards & medals")
                .font(Brand.font(11, .heavy)).foregroundStyle(Color(hex: 0x6D28D9))
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Text("Resets in \(Self.countdown())").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0x6D28D9).opacity(0.9))
            }
        }
        .frame(maxWidth: .infinity).frame(height: heroHeight)
        .background(RoundedRectangle(cornerRadius: 14).fill(
            LinearGradient(colors: [Color(hex: 0xEDE9FE), Color(hex: 0xDDD6FE)], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xA78BFA), lineWidth: 1.5))
    }

    private static func countdown() -> String {
        let s = secondsUntilLocalMidnight()
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}

/// "∞ Unlimited Play ∞" hero shown when Unlimited is selected — ports
/// UnlimitedHero in play-mode-toggle.tsx.
struct UnlimitedHero: View {
    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 8) {
                Image(systemName: "infinity").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.primary)
                Text("Unlimited Play").font(Brand.font(18, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: "infinity").font(.system(size: 18, weight: .bold)).foregroundStyle(Color(hex: 0xEC4899))
            }
            Text("Infinite puzzles · All stats count").font(Brand.font(10, .bold)).foregroundStyle(Theme.primary)
        }
        .frame(maxWidth: .infinity).frame(height: heroHeight)
        .background(RoundedRectangle(cornerRadius: 14).fill(
            LinearGradient(colors: [Color(hex: 0xFCE7F3), Color(hex: 0xEDE9FE)], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
    }
}
