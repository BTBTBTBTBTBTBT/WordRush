import SwiftUI
import WordociousCore

/// VS Battle as a full-width tile at the very bottom of the game area (founder +
/// JP, 2026-09-26): the VS card and the old LIVE bar merged — VS icon and accent,
/// "VS Battle", the live pulse + player count, Invite for Pro. The grid above is
/// exactly the eight sweep games. Mirrors web vs-live-tile.tsx.
struct VSLiveTile<Destination: View>: View {
    let mode: HomeMode
    /// nil while the presence endpoint has not answered yet.
    let liveCount: Int?
    /// Today's daily VS result: true won, false lost, nil not played (Daily mode only).
    let vsDailyWon: Bool?
    let playMode: PlayMode
    let isPro: Bool
    let onInvite: () -> Void
    @ViewBuilder let destination: () -> Destination

    var body: some View {
        let accent = mode.accent
        let done = playMode == .daily && vsDailyWon != nil
        let countText: String = {
            guard let n = liveCount else { return "Players online" }
            return "\(n) \(n == 1 ? "player" : "players") online"
        }()
        let subtitle: String = done
            ? ((vsDailyWon ?? false) ? "Today's battle won" : "Today's battle lost")
            : (playMode == .daily ? "Today's shared battle" : mode.desc)

        HStack(spacing: 12) {
            NavigationLink(destination: destination) {
                HStack(spacing: 12) {
                    ModeIconView(icon: mode.icon, accent: accent, box: 36)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(mode.title).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                        HStack(spacing: 6) {
                            LivePulseDot()
                            Text("LIVE").font(Brand.font(10, .black)).foregroundStyle(Theme.textPrimary)
                            Text("· \(countText)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                        }
                        Text(subtitle).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("VS Battle, \(countText)")

            if isPro {
                Button(action: onInvite) {
                    Text("Invite").font(Brand.font(10, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(RoundedRectangle(cornerRadius: 6).fill(
                            LinearGradient(colors: [Color(hex: 0xEC4899), Color(hex: 0xDB2777)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                        .shadow(color: Color(hex: 0x9F1239), radius: 0, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        // Completed daily: the same accent glow the mode cards wear (ModeCardView done
        // tint + accent border) so today's battle never looks unplayed (founder, 2026-09-26).
        .background(RoundedRectangle(cornerRadius: 14).fill(done ? accent.opacity(0.10) : Theme.surface))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 14).fill(accent).frame(width: 4).padding(.vertical, 6)
        }
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(done ? accent.opacity(0.55) : Theme.border, lineWidth: 1.5))
        .overlay(alignment: .topTrailing) {
            // W / L pill in the top-right corner — the same badge the mode cards show.
            if done {
                Text((vsDailyWon ?? false) ? "W" : "L").font(Brand.font(10, .black)).foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(RoundedRectangle(cornerRadius: 6).fill((vsDailyWon ?? false) ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626)))
                    .padding(.top, 8).padding(.trailing, 10)
            }
        }
        .shadow(color: done ? accent.opacity(0.25) : .clear, radius: 8, y: 2)
    }
}
