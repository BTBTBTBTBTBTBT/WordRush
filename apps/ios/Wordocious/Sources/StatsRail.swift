import SwiftUI
import WordociousCore

/// The Stats tab's game rail (Stats + Friends redesign D2, founder 2026-09-26:
/// "I don't want to swipe right through 19 different games … flow like
/// butter"). One horizontal row of chips: Today · the eight sweep games · VS ·
/// the More Games titles · All-time. Tap jumps straight to that page; a swipe
/// on the page below moves one chip; HOLD the Today chip (or tap the grid
/// button) for the whole set as a 5-wide grid so any game is one tap away.
/// Each game chip wears today's W/L dot. Twin of web components/stats/game-rail.tsx.
enum StatsRailKey {
    static let today = "today"
    static let vs = "vs"
    static let all = "all"
}

struct StatsRailItem: Identifiable {
    /// "today" | "vs" | "all" | a daily mode's dbKey.
    let key: String
    let label: String
    let icon: ModeIconKind
    let accent: Color
    /// Today's result on a game chip: nil = not played, true = won, false = lost.
    let dot: Bool?
    var id: String { key }
}

/// Builds the rail in web order from the same catalog lists the page draws.
func buildStatsRailItems(sweep: [HomeMode], more: [HomeMode],
                         byMode: [String: DailyCompletion], vsDailyWon: Bool?) -> [StatsRailItem] {
    func game(_ m: HomeMode) -> StatsRailItem {
        let r = m.dbKey.flatMap { byMode[$0] }
        return StatsRailItem(key: m.dbKey ?? m.id, label: ModeGen.byId(m.id)?.shortTitle ?? m.title,
                             icon: m.icon, accent: m.accent, dot: r.map { $0.completed })
    }
    return [StatsRailItem(key: StatsRailKey.today, label: "Today", icon: .symbol("calendar"), accent: Color(hex: 0x7C3AED), dot: nil)]
        + sweep.map(game)
        + [StatsRailItem(key: StatsRailKey.vs, label: "VS", icon: .asset("swords"), accent: Color(hex: 0xEC4899), dot: vsDailyWon)]
        + more.map(game)
        + [StatsRailItem(key: StatsRailKey.all, label: "All-time", icon: .symbol("trophy.fill"), accent: Color(hex: 0xD97706), dot: nil)]
}

struct StatsRail: View {
    let items: [StatsRailItem]
    @Binding var selected: String
    var onSelect: (String) -> Void

    @State private var gridOpen = false
    /// Set by the Today chip's long press so the tap that ends the hold does
    /// not also select Today (web `held` parity).
    @State private var held = false
    private let holdSeconds = 0.45
    private let gridAccent = Color(hex: 0x7C3AED)

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(items) { it in chip(it, inGrid: false).id(it.key) }
                        }
                        .padding(.horizontal, 1)
                    }
                    // Keep the selected chip in view as the page changes (swipe, grid pick).
                    .onChange(of: selected) { key in
                        withAnimation(Theme.animation(.easeOut(duration: 0.25))) { proxy.scrollTo(key, anchor: .center) }
                    }
                }
                Button {
                    Haptics.tap()
                    withAnimation(Theme.animation(.easeOut(duration: 0.2))) { gridOpen.toggle() }
                } label: {
                    Image(systemName: gridOpen ? "xmark" : "square.grid.2x2")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(gridOpen ? gridAccent : Theme.textMuted)
                        .frame(width: 36, height: 36)
                        .background(RoundedRectangle(cornerRadius: 12).fill(gridOpen ? gridAccent.opacity(0.08) : Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(gridOpen ? gridAccent : Theme.border, lineWidth: 1.5))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Every game")
            }
            if gridOpen {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 5), spacing: 8) {
                    ForEach(items) { it in chip(it, inGrid: true) }
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                .transition(.opacity.combined(with: .offset(y: 6)))
            }
        }
    }

    private func pick(_ key: String) {
        Haptics.tap()
        withAnimation(Theme.animation(.easeOut(duration: 0.2))) { gridOpen = false }
        onSelect(key)
    }

    /// One chip — the HModePicker / ProfileModePicker look: 28pt icon tile,
    /// 10pt heavy label, accent border when selected, today's W/L dot top-right.
    private func chip(_ it: StatsRailItem, inGrid: Bool) -> some View {
        let active = it.key == selected
        let isToday = it.key == StatsRailKey.today
        return Button {
            if held { held = false; return }
            pick(it.key)
        } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: it.icon, accent: it.accent, box: 28)
                Text(it.label).font(Brand.font(10, .heavy))
                    .foregroundStyle(active ? it.accent : Theme.textMuted)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(minWidth: inGrid ? 0 : 62, maxWidth: inGrid ? .infinity : nil)
            .padding(.horizontal, inGrid ? 4 : 10).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? it.accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? it.accent : Theme.border, lineWidth: 1.5))
            .overlay(alignment: .topTrailing) {
                if let won = it.dot {
                    Circle().fill(won ? Theme.win : Color(hex: 0xDC2626))
                        .frame(width: 8, height: 8)
                        .padding(4)
                        .accessibilityLabel(won ? "Won today" : "Lost today")
                }
            }
        }
        .buttonStyle(PressableStyle())
        // HOLD Today for every game as a grid (the grid button does the same).
        // (`.subviews` masks the hold off every other chip while keeping their Button.)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: holdSeconds).onEnded { _ in
                held = true
                Haptics.tap()
                withAnimation(Theme.animation(.easeOut(duration: 0.2))) { gridOpen = true }
            },
            including: isToday && !inGrid ? .all : .subviews
        )
        .accessibilityLabel(isToday && !inGrid ? "Today — hold for every game" : it.label)
    }
}
