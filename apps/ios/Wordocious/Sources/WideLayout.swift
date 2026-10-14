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

/// Slice 5 (R4): the solo game title's height cap on tablets (long wordmarks like LETTER LADDER would otherwise fill the page).
let tabletSoloTitleMaxHeight: CGFloat = 110
/// Slice 5 (R4): the solo game title takes at most this share of the page width on tablets.
let tabletSoloTitleMaxWidthFraction: CGFloat = 0.6

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
    let max: CGFloat

    func body(content: Content) -> some View {
        // COMPACT (phones): untouched. Otherwise the page is min(width - 2 x margin, max), centered.
        if widthClass == .compact {
            content
        } else {
            let margin = tabletPageMargin(widthClass)
            content
                .frame(maxWidth: max)
                .padding(.horizontal, margin)
                .frame(maxWidth: .infinity)
        }
    }
}

/// Item 2: an app sheet's content column on tablets (sheets present as full pages, so the
/// column is the sheet column, not the 1000 pt tab page).
let tabletSheetMaxWidth: CGFloat = 760
/// Item 3: the classic finished screen's text cards on tablets (phones keep 400).
let tabletFinishTextMaxWidth: CGFloat = 760

/// Item 2: presents an app sheet as a full page on iPad (`.presentationSizing(.page)`, iOS 18+)
/// instead of the ~580 pt form sheet. `page: false` keeps the form sheet (used while a card is
/// showing). COMPACT and iOS 16/17 are untouched.
private struct TabletSheetSizing: ViewModifier {
    @Environment(\.widthClass) private var widthClass
    let page: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), widthClass != .compact {
            if page { content.presentationSizing(.page) } else { content.presentationSizing(.form) }
        } else {
            content
        }
    }
}

/// Item 2: a sheet's content column. Phones keep their own cap (`phoneMax`), or no cap when nil.
private struct SheetColumn: ViewModifier {
    @Environment(\.widthClass) private var widthClass
    let phoneMax: CGFloat?

    func body(content: Content) -> some View {
        if widthClass == .compact {
            if let phoneMax {
                content.frame(maxWidth: phoneMax).frame(maxWidth: .infinity)
            } else {
                content
            }
        } else {
            content.frame(maxWidth: tabletSheetMaxWidth).frame(maxWidth: .infinity)
        }
    }
}

/// Item 3: a finished-screen card's width. Phones keep 400; tablets use the text column (760)
/// or, for share / stat rows (`wide`), the page (1000).
private struct FinishCardWidth: ViewModifier {
    @Environment(\.widthClass) private var widthClass
    let wide: Bool

    func body(content: Content) -> some View {
        if widthClass == .compact {
            content.frame(maxWidth: 400)
        } else {
            content.frame(maxWidth: wide ? tabletPageMaxWidth : tabletFinishTextMaxWidth)
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
    func tabletPage(max: CGFloat = tabletPageMaxWidth) -> some View {
        modifier(TabletPage(max: max))
    }

    /// Item 2: present this sheet as a full page on iPad (iOS 18+). Apply to the sheet's content.
    func tabletSheet(page: Bool = true) -> some View {
        modifier(TabletSheetSizing(page: page))
    }

    /// Item 2: cap a sheet's content at the sheet column (760 on tablets). `phoneMax` keeps the
    /// phone cap the view already had (nil = no cap on phones). Apply to the CONTENT inside the scroll view.
    func sheetColumn(phoneMax: CGFloat?) -> some View {
        modifier(SheetColumn(phoneMax: phoneMax))
    }

    /// Item 3: a finished-screen card's width (phones 400, tablets 760 text / 1000 rows).
    func finishCardWidth(wide: Bool = false) -> some View {
        modifier(FinishCardWidth(wide: wide))
    }

    /// §AG: cap this content at the column's max width, centered in the space it is
    /// offered (the surrounding background keeps the full width).
    func wideColumn(_ column: WideColumn) -> some View {
        frame(maxWidth: column.maxWidth).frame(maxWidth: .infinity)
    }
}
