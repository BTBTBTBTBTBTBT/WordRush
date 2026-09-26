import SwiftUI
import WordociousCore

/// The More Games band (founder + JP, 2026-09-26): a full-width tile directly
/// UNDER the game grid — indigo accent, the ten small game icons in catalog
/// order, "N of 10 played", chevron — so nobody hunts for the extra games but
/// the page still opens on the Daily Challenge and the eight word games.
///
/// It is also the More Games "hero": every More Games daily played → filled
/// indigo, "MORE GAMES SWEEP!"; every one won → the gold Flawless treatment,
/// "FLAWLESS MORE GAMES!". Purely visual — derived from today's completions,
/// never a bonus row, XP or a leaderboard. Tap opens the sheet; Share (sweep
/// states only) shares the More Games card. Mirrors web more-games-band.tsx.
struct MoreGamesBand: View {
    let mode: HomeMode
    /// The More Games titles visible to this viewer (catalog ∩ remote flags).
    let modes: [HomeMode]
    let playMode: PlayMode
    let byMode: [String: DailyCompletion]
    let onOpen: () -> Void
    let onShare: () -> Void

    private let indigo = Color(hex: 0x4F46E5)

    var body: some View {
        let daily = moreDailyModes(modes)
        let tier: MoreSweepTier? = playMode == .daily ? moreSweepTier(byMode: byMode, modes: modes) : nil
        let gold = tier == .flawless
        let totals = moreTotals(byMode: byMode, modes: modes)
        let titleC: Color = tier == nil ? Theme.textPrimary : (gold ? Color(hex: 0x92400E) : .white)
        let subC: Color = tier == nil ? Theme.textMuted : (gold ? Color(hex: 0xB45309) : Color(hex: 0xE0E7FF))
        let subtitle: String = {
            if let t = tier, t == tier {
                let mins = Int(totals.totalTimeSeconds) / 60, secs = Int(totals.totalTimeSeconds) % 60
                return "All \(totals.total) \(gold ? "won" : "played") · \(mins):\(String(format: "%02d", secs)) · \(formatScore(totals.totalScore)) pts"
            }
            return playMode == .daily ? morePlayedText(completedKeys: Set(byMode.keys), modes: modes) : mode.desc
        }()

        ZStack(alignment: .topTrailing) {
            Button(action: onOpen) {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8).fill(tier == nil ? indigo.opacity(0.08) : Color.white.opacity(0.25))
                        if gold {
                            Image(systemName: "trophy.fill").font(.system(size: 18)).foregroundStyle(Color(hex: 0xB45309))
                        } else if tier != nil {
                            Image(systemName: "sparkles").font(.system(size: 18)).foregroundStyle(.white)
                        } else {
                            Image(systemName: "square.grid.2x2").font(.system(size: 18, weight: .bold)).foregroundStyle(indigo)
                        }
                    }
                    .frame(width: 36, height: 36)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(tier?.title ?? mode.title).font(Brand.font(13, .black)).foregroundStyle(titleC).lineLimit(1)
                        // The ten game icons, catalog order; in a sweep state every tile is a check.
                        HStack(spacing: 4) {
                            ForEach(daily) { m in
                                let done = m.dbKey.map { byMode[$0] != nil } ?? false
                                if tier != nil {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 5).fill(Color.white.opacity(0.9))
                                        Image(systemName: "checkmark").font(.system(size: 10, weight: .black))
                                            .foregroundStyle(gold ? Color(hex: 0xB45309) : indigo)
                                    }
                                    .frame(width: 18, height: 18)
                                } else if done {
                                    // Played today = a SOLID accent chip with a white glyph (founder, 2026-09-26:
                                    // "I finished Spyglass and you can barely tell" — the ring alone was too quiet).
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 5).fill(m.accent)
                                        ModeIconView(icon: m.icon, accent: .white, box: 18)
                                    }
                                    .frame(width: 18, height: 18)
                                    .shadow(color: m.accent.opacity(0.45), radius: 3, y: 1)
                                } else {
                                    // Still to play = faded tint.
                                    ModeIconView(icon: m.icon, accent: m.accent, box: 18)
                                        .overlay(RoundedRectangle(cornerRadius: 5).stroke(m.accent.opacity(0.25), lineWidth: 1))
                                        .opacity(0.5)
                                }
                            }
                        }
                        .accessibilityHidden(true)
                        Text(subtitle).font(Brand.font(10, .bold)).foregroundStyle(subC).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right").font(.system(size: 15, weight: .bold))
                        .foregroundStyle(tier == nil ? indigo : (gold ? Color(hex: 0xB45309) : .white))
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 14).fill(background(tier: tier, gold: gold))
                        .overlay(tier != nil ? BannerShimmer().clipShape(RoundedRectangle(cornerRadius: 14)) : nil)
                )
                .overlay(alignment: .leading) {
                    if tier == nil {
                        RoundedRectangle(cornerRadius: 14).fill(indigo).frame(width: 4).padding(.vertical, 6).padding(.leading, 0)
                    }
                }
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(tier == nil ? Theme.border : (gold ? Color(hex: 0xF59E0B) : indigo), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tier?.short ?? "More Games")
            .accessibilityHint(subtitle)

            if tier != nil {
                Button(action: onShare) {
                    Text("Share").font(Brand.font(10, .black))
                        .foregroundStyle(gold ? Color(hex: 0xB45309) : indigo)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(Color.white.opacity(0.85)))
                }
                .buttonStyle(.plain)
                .padding(.top, 8).padding(.trailing, 36)
            }
        }
    }

    private func background(tier: MoreSweepTier?, gold: Bool) -> LinearGradient {
        if tier == nil { return LinearGradient(colors: [Theme.surface, Theme.surface], startPoint: .leading, endPoint: .trailing) }
        return gold
            ? LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)], startPoint: .topLeading, endPoint: .bottomTrailing)
            : LinearGradient(colors: [indigo, Color(hex: 0x6366F1)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}
