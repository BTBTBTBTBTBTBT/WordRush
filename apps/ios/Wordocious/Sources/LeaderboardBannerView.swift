import SwiftUI
import WordociousCore

/// The Leaderboard banner (founder, 2026-10-01; spec docs/LEADERBOARD_REDESIGN_SPEC.md §1;
/// web app/daily/page.tsx). The home / VS / Friends one-window shape in gold-to-lilac:
/// a frosted strip with the day's title (core leaderboardTitle — "FRIDAY’S FINEST",
/// "HALLOWEEN HEROES" on a holiday), the date + reset clock and ALL-TIME →, over two
/// rows of square game tiles (docs/GAME_TILE_STYLE.md): WORDOCIOUS (the eight sweep
/// dailies, home order) with the SWEEP chip, and PUZZLES (the ten More Games dailies,
/// home order). Exactly one selection across both rows and the chip. Replaces the old
/// gradient title, the date/countdown row and the HModePicker grid.
struct LeaderboardBannerView: View {
    @Binding var selected: GameMode
    @Binding var isSweep: Bool
    let onAllTime: () -> Void

    @ObservedObject private var flags = FlagsService.shared

    private static let head = Color(hex: 0x78350F)
    private static let sub = Color(hex: 0x92400E)
    private static let gold = Color(hex: 0xF59E0B)

    /// WORDOCIOUS DAILIES — the home order (core tiles, flag-gated, the wide VS / More tiles excluded).
    private var wordModes: [HomeMode] {
        homeModes.filter { flags.isOn($0.flagKey) && !$0.homeWide && $0.dbKey != nil }
    }
    /// PUZZLES — the home order (the More Games dailies behind their flags; menu.more switches the row off).
    private var puzzleModes: [HomeMode] {
        guard homeModes.contains(where: { $0.id == "more" && flags.isOn($0.flagKey) }) else { return [] }
        return moreDailyModes(moreModes.filter { flags.isOn($0.flagKey) })
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let puzzles = puzzleModes
        VStack(spacing: 0) {
            strip
            wordRow
                .padding(.top, 10).padding(.horizontal, 12).padding(.bottom, puzzles.isEmpty ? 12 : 6)
            if !puzzles.isEmpty {
                puzzleRow(puzzles)
                    .padding(.top, 8).padding(.horizontal, 12).padding(.bottom, 12)
            }
        }
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xEDE9FE)], startPoint: .top, endPoint: .bottom)
                // The same white sheen as home.
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .clipShape(shape)
        .shadow(color: Color(hex: 0x92400E).opacity(0.10), radius: 7, x: 0, y: 4)
    }

    // MARK: Frosted strip

    private var strip: some View {
        // Ticks once a second for the reset clock; the title and date flip at local midnight.
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let day = LeaderboardService.todayLocal()
            let holiday = HolidayTitles.title(holidayKeyForDay(day, table: HolidayTable.bundled))
            let left = secondsUntilLocalMidnight()
            let clock = String(format: "%02d:%02d:%02d", left / 3600, (left % 3600) / 60, left % 60)
            let date = ctx.date.formatted(.dateTime.month(.abbreviated).day()).uppercased()
            VStack(alignment: .leading, spacing: 4) {
                Text(leaderboardTitle(day, holiday))
                    .font(Brand.font(22, .black)).tracking(0.4)
                    .foregroundStyle(Self.head)
                    .shadow(color: Self.gold.opacity(0.55), radius: 8)
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                HStack(spacing: 8) {
                    Text("\(date) · RESETS IN \(clock)")
                        .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                        .foregroundStyle(Self.sub)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button(action: onAllTime) {
                        Text("ALL-TIME →")
                            .font(Brand.font(10.5, .black)).tracking(0.4)
                            .foregroundStyle(Self.sub)
                            .lineLimit(1).fixedSize()
                            .padding(.vertical, 4).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("All-time records")
                }
            }
        }
        .padding(.top, 12).padding(.horizontal, 12).padding(.bottom, 10)
        .background(Color.white.opacity(0.5))
    }

    // MARK: Rows

    private func label(_ text: String) -> some View {
        Text(text).font(Brand.font(10, .black)).tracking(1).foregroundStyle(Self.sub)
    }

    private var wordRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                label("WORDOCIOUS")
                Spacer(minLength: 4)
                sweepChip
            }
            SquareTileRow(maxSide: 38, minSide: 28, gap: 7) {
                ForEach(wordModes) { m in tile(m, radius: 10) }
            }
        }
    }

    private func puzzleRow(_ modes: [HomeMode]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            label("PUZZLES")
            SquareTileRow(maxSide: 31, minSide: 28, gap: 4) {
                ForEach(modes) { m in tile(m, radius: 9) }
            }
        }
    }

    /// The cross-mode Sweep board: soft gold pill, solid gold with white ink when selected.
    private var sweepChip: some View {
        Button { isSweep = true } label: {
            HStack(spacing: 4) {
                Image("broom").renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 11, height: 11)
                Text("SWEEP").font(Brand.font(10, .black)).tracking(0.8)
            }
            .foregroundStyle(isSweep ? Color.white : Self.sub)
            .padding(.horizontal, 10).frame(height: 22)
            .background(Capsule().fill(isSweep ? Self.gold : Self.gold.opacity(0.18)))
            .shadow(color: isSweep ? Self.gold.opacity(0.4) : .clear, radius: 5)
            .contentShape(Capsule())
        }
        .buttonStyle(InstantButtonStyle())
        .accessibilityLabel("Daily Sweep board")
        .accessibilityAddTraits(isSweep ? .isSelected : [])
    }

    /// One game as an icon-only square tile (accent tint, 1.5 border at 40%, 3 pt top bar;
    /// selected = 2 pt full-accent border + glow + stronger tint).
    private func tile(_ m: HomeMode, radius: CGFloat) -> some View {
        let active = !isSweep && m.dbKey == selected.rawValue
        return Button {
            isSweep = false
            selected = m.mode ?? GameMode(rawValue: m.dbKey ?? "") ?? selected
        } label: {
            GameTileSquare(accent: m.accent, selected: active, radius: radius, light: true, bar: 3) { chip in
                BannerGlyph(icon: m.icon, ink: m.accent, accent: m.accent, solid: false, size: floor(chip * 0.78))
            }
        }
        .buttonStyle(InstantButtonStyle())
        .accessibilityLabel(m.title)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

/// One row of equal squares: each side is the row's width shared out (minus the gaps),
/// clamped to [minSide, maxSide]; the row stays centered at that size on wide screens
/// and never wraps.
private struct SquareTileRow: Layout {
    let maxSide: CGFloat
    let minSide: CGFloat
    let gap: CGFloat

    private func side(_ width: CGFloat?, _ n: Int) -> CGFloat {
        guard n > 0 else { return 0 }
        guard let w = width, w.isFinite else { return maxSide }
        let fit = (w - gap * CGFloat(n - 1)) / CGFloat(n)
        return max(minSide, min(maxSide, floor(fit)))
    }

    private func total(_ s: CGFloat, _ n: Int) -> CGFloat { s * CGFloat(n) + gap * CGFloat(max(0, n - 1)) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let n = subviews.count
        let s = side(proposal.width, n)
        let w = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? total(s, n)
        return CGSize(width: w, height: s)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let n = subviews.count
        let s = side(bounds.width, n)
        var x = bounds.minX + max(0, (bounds.width - total(s, n)) / 2)
        for v in subviews {
            v.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: s, height: s))
            x += s + gap
        }
    }
}
