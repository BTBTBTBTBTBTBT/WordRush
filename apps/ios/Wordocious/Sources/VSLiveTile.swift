import SwiftUI
import WordociousCore

/// VS Battle as a full-width tile at the very bottom of the game area (founder +
/// JP, 2026-09-26): the VS card and the old LIVE bar merged — VS icon and accent,
/// "VS Battle", the live pulse + player count, Invite for Pro. The grid above is
/// exactly the eight sweep games. Mirrors web vs-live-tile.tsx.
struct VSLiveTile<Destination: View>: View {
    let mode: HomeMode
    /// The live count is observed HERE, not by Home, so a new count redraws
    /// this tile only (founder, 2026-09-29). nil until the endpoint answers.
    @ObservedObject private var live = LivePlayerCount.shared
    /// Today's daily VS result: true won, false lost, nil not played (Daily mode only).
    let vsDailyWon: Bool?
    let playMode: PlayMode
    let isPro: Bool
    let onInvite: () -> Void
    @ViewBuilder let destination: () -> Destination

    init(mode: HomeMode, vsDailyWon: Bool?, playMode: PlayMode, isPro: Bool,
         onInvite: @escaping () -> Void, @ViewBuilder destination: @escaping () -> Destination) {
        self.mode = mode; self.vsDailyWon = vsDailyWon; self.playMode = playMode
        self.isPro = isPro; self.onInvite = onInvite; self.destination = destination
    }

    var body: some View {
        let accent = mode.accent
        let done = playMode == .daily && vsDailyWon != nil
        let countText: String = {
            guard let n = live.count else { return "Players online" }
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
                // A soft pill in the tile's own teal, not the old hot-pink 3D button
                // (founder, 2026-10-01: home redesign).
                Button(action: onInvite) {
                    HStack(spacing: 4) {
                        Image(systemName: "person.badge.plus").font(.system(size: 11, weight: .bold))
                        Text("Invite").font(Brand.font(11, .black))
                    }
                    .foregroundStyle(Color(hex: 0x0F766E))
                    .padding(.horizontal, 12).frame(height: 32)
                    .background(Capsule().fill(Color(hex: 0x0D9488).opacity(0.08)))
                    .overlay(Capsule().stroke(Color(hex: 0x0D9488).opacity(0.33), lineWidth: 1.5))
                    .contentShape(Capsule())
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
            // W / L badge in the top-right corner — the same 3D badge the mode cards show (ART_SPEC §4).
            if done {
                ResultBadge(won: vsDailyWon ?? false, size: 26)
                    .padding(.top, 6).padding(.trailing, 8)
            }
        }
        .shadow(color: done ? accent.opacity(0.25) : .clear, radius: 8, y: 2)
    }
}
