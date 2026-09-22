import SwiftUI
import WordociousCore

/// The More Games sheet (More Games §18, Stage 5): the SAME mode card as the
/// home grid, two across, under small section headers from the catalog's
/// moreCategories (Word · Trivia · Logic). Chrome = MenuScaffold (the "?"
/// menu's bar, wordmark title and Close). The Daily/Unlimited toggle is
/// respected inside the sheet exactly as on the grid.
///
/// Taps never navigate from inside the sheet: the selection is handed back
/// through `onSelect` and HomeView routes it once the sheet has dismissed, so
/// a fullScreenCover never fights a dismissing sheet.
struct MoreGamesSheet: View {
    /// The More Games titles visible to this viewer (catalog ∩ remote flags).
    var modes: [HomeMode] = moreModes
    let completions: [String: DailyCompletion]
    let playMode: PlayMode
    let isPro: Bool
    let onSelect: (HomeMode) -> Void
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        MenuScaffold("More Games") {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(playMode == .daily ? "One free daily each · not part of the Daily Sweep" : "Unlimited play")
                        .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 2)
                    let sections = moreSections(modes)
                    if sections.isEmpty {
                        Text("New games are on the way.")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).padding(.vertical, 32)
                    }
                    ForEach(sections) { section in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(section.title.uppercased())
                                .font(Brand.font(11, .heavy)).foregroundStyle(Theme.textMuted)
                                .tracking(1)
                            LazyVGrid(columns: columns, spacing: 8) {
                                ForEach(section.modes) { mode in
                                    let done = playMode == .daily ? mode.dbKey.flatMap { completions[$0] } : nil
                                    let locked = !isPro && done != nil
                                    Button {
                                        onSelect(mode)
                                        dismiss()
                                    } label: {
                                        ModeCardView(mode: mode, done: done, locked: locked)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
            }
        }
    }
}

/// The pickers' "More" chip target (More Games §18): the same sectioned list
/// as the sheet, as tappable rows, returning the chosen GameMode. Used by
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
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5)))
    }
}
