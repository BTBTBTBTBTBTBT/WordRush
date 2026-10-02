import SwiftUI
import WordociousCore

/// The pickers' "More" chip target (More Games §18): the More Games titles in
/// their catalog sections, as tappable rows, returning the chosen GameMode. Used by
/// HModePicker (Leaderboard / Records) when the grid cannot hold every daily
/// mode in its 5-over-N layout.
struct MoreModePickerSheet: View {
    let onPick: (GameMode) -> Void
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var flags = FlagsService.shared

    var body: some View {
        MenuScaffold("More Games") {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(moreSections(moreModes.filter { $0.dailyEligible && flags.isOn($0.flagKey) })) { section in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(section.title.uppercased())
                                .font(Brand.font(11, .heavy)).foregroundStyle(Theme.textMuted).tracking(1)
                            ForEach(section.modes) { m in
                                if let gm = m.mode ?? m.dbKey.flatMap({ GameMode(rawValue: $0) }) {
                                    Button { onPick(gm); dismiss() } label: { row(m) }.buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
    }

    private func row(_ m: HomeMode) -> some View {
        HStack(spacing: 12) {
            ModeIconView(icon: m.icon, accent: m.accent, box: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(m.title).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                Text(m.desc).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(12).padding(.top, 4).frame(maxWidth: .infinity, alignment: .leading)
        // The shared game-tile chrome (docs/GAME_TILE_STYLE.md) on the row layout.
        .gameTile(accent: m.accent)
    }
}
