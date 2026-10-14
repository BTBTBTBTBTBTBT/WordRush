import SwiftUI

// FINISH_SPEC §AG (iPad / wide screens, width ≥ 600): the same readable column the
// phone has — game screens and pages capped at a max width and centered on their
// wallpaper (the wallpaper itself stays full-bleed: apply this to the CONTENT, not
// the view that carries the PageBackground), popups capped at ~440 pt.
//
// Every cap is wider than any iPhone (the widest is 440 pt), so on phones these are
// no-ops; they only take effect on iPad.

/// Window-width class (Android parity: COMPACT < 600 pt, MEDIUM 600–839, EXPANDED ≥ 840).
/// Driven by the container width the root reports (`WidthClassReader`), never by
/// UIScreen or the device idiom, so split view and slide-over classify correctly.
enum WidthClass: Equatable {
    case compact, medium, expanded

    init(width: CGFloat) {
        if width >= 840 { self = .expanded }
        else if width >= 600 { self = .medium }
        else { self = .compact }
    }
}

private struct WidthClassKey: EnvironmentKey {
    static let defaultValue: WidthClass = .compact
}

extension EnvironmentValues {
    /// The app window's width class, set once at the root by `WidthClassReader`.
    var widthClass: WidthClass {
        get { self[WidthClassKey.self] }
        set { self[WidthClassKey.self] = newValue }
    }
}

/// Measures the root's width and publishes its `WidthClass` to the whole tree
/// (sheets and covers inherit it from their presenter).
struct WidthClassReader<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        GeometryReader { geo in
            content.environment(\.widthClass, WidthClass(width: geo.size.width))
        }
    }
}

enum WideColumn {
    /// Game screens (board + keyboard + finished screen): boards keep the phone
    /// sizing rule (BoardSizing fits the capped width AND the available height, so
    /// landscape never breaks the fit).
    case game
    /// Popups and sheet content.
    case popup

    var maxWidth: CGFloat {
        switch self {
        case .game: return 560
        case .popup: return 440
        }
    }
}

/// Max width of the one centered column used by game screens, popups and pages on tablets.
let tabletColumnMaxWidth: CGFloat = 640
/// Max width of the top-level tab pages (Home, Leaderboard, Stats, Friends) on tablets.
let tabletPageMaxWidth: CGFloat = 1000
/// Slice 5: a card grid whose trailing row is CENTERED (3/3/2 reads symmetric). Same cell width as a full row.
/// Used on tablets only; phones keep LazyVGrid.
struct CenteredRowGrid: Layout {
    let columns: Int
    var spacing: CGFloat = 0

    private func cellWidth(_ width: CGFloat) -> CGFloat {
        (width - spacing * CGFloat(columns - 1)) / CGFloat(columns)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        let cell = cellWidth(width)
        var total: CGFloat = 0
        for start in stride(from: 0, to: subviews.count, by: columns) {
            let row = subviews[start..<min(start + columns, subviews.count)]
            if start > 0 { total += spacing }
            total += row.map { $0.sizeThatFits(ProposedViewSize(width: cell, height: nil)).height }.max() ?? 0
        }
        return CGSize(width: width, height: total)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let cell = cellWidth(bounds.width)
        var y = bounds.minY
        for start in stride(from: 0, to: subviews.count, by: columns) {
            let row = Array(subviews[start..<min(start + columns, subviews.count)])
            let height = row.map { $0.sizeThatFits(ProposedViewSize(width: cell, height: nil)).height }.max() ?? 0
            let rowWidth = CGFloat(row.count) * cell + CGFloat(row.count - 1) * spacing
            var x = bounds.minX + (bounds.width - rowWidth) / 2
            for view in row {
                view.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: cell, height: height))
                x += cell + spacing
            }
            y += height + spacing
        }
    }
}

/// Max width of the cast title row on tablets, so it grows with the page without getting huge.
let tabletCastMaxWidth: CGFloat = 820

/// Slice 5: the letter keyboard's width cap on tablets (its keys grow; the page does not).
let tabletKeyboardMaxWidth: CGFloat = 820

/// Slice 5 (R4): game title art height scale on tablets: 1.6x MEDIUM, 2x EXPANDED, 1 on phones.
func tabletTitleScale(_ widthClass: WidthClass) -> CGFloat {
    switch widthClass {
    case .compact: return 1
    case .medium: return 1.6
    case .expanded: return 2
    }
}

/// Slice 5 (R4): the game header's chrome (corner circles, status line, tab bar) scale on tablets: 1.15x MEDIUM, 1.3x EXPANDED.
func tabletChromeScale(_ widthClass: WidthClass) -> CGFloat {
    switch widthClass {
    case .compact: return 1
    case .medium: return 1.15
    case .expanded: return 1.3
    }
}

/// Side margin of a top-level tab page on tablets: 32 on EXPANDED, 24 on MEDIUM, none on phones.
func tabletPageMargin(_ widthClass: WidthClass) -> CGFloat {
    switch widthClass {
    case .compact: return 0
    case .medium: return 24
    case .expanded: return 32
    }
}

private struct TabletColumn: ViewModifier {
    let max: CGFloat
    @Environment(\.widthClass) private var widthClass

    func body(content: Content) -> some View {
        // COMPACT (phones): the content is passed through untouched.
        if widthClass == .compact {
            content
        } else {
            content.frame(maxWidth: max).frame(maxWidth: .infinity)
        }
    }
}

private struct TabletPage: ViewModifier {
    @Environment(\.widthClass) private var widthClass

    func body(content: Content) -> some View {
        // COMPACT (phones): untouched. Otherwise the page is min(width - 2 x margin, 1000), centered.
        if widthClass == .compact {
            content
        } else {
            let margin = tabletPageMargin(widthClass)
            content
                .frame(maxWidth: tabletPageMaxWidth)
                .padding(.horizontal, margin)
                .frame(maxWidth: .infinity)
        }
    }
}

extension View {
    /// §AG: cap this content at the single tablet column (640 pt), centered in the
    /// space it is offered. Apply to the CONTENT (header + scroll), not the wallpaper.
    /// COMPACT is a no-op.
    func tabletColumn(max: CGFloat = tabletColumnMaxWidth) -> some View {
        modifier(TabletColumn(max: max))
    }

    /// Slice 4: the top-level tab pages use the page width (1000 pt max, 32 / 24 pt side
    /// margins). Apply to the CONTENT, not the wallpaper. COMPACT is a no-op.
    func tabletPage() -> some View {
        modifier(TabletPage())
    }

    /// §AG: cap this content at the column's max width, centered in the space it is
    /// offered (the surrounding background keeps the full width).
    func wideColumn(_ column: WideColumn) -> some View {
        frame(maxWidth: column.maxWidth).frame(maxWidth: .infinity)
    }
}
