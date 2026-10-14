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

/// Max width of the one centered column every top-level screen uses on tablets.
let tabletColumnMaxWidth: CGFloat = 640

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

extension View {
    /// §AG: cap this content at the single tablet column (640 pt), centered in the
    /// space it is offered. Apply to the CONTENT (header + scroll), not the wallpaper.
    /// COMPACT is a no-op.
    func tabletColumn(max: CGFloat = tabletColumnMaxWidth) -> some View {
        modifier(TabletColumn(max: max))
    }

    /// §AG: cap this content at the column's max width, centered in the space it is
    /// offered (the surrounding background keeps the full width).
    func wideColumn(_ column: WideColumn) -> some View {
        frame(maxWidth: column.maxWidth).frame(maxWidth: .infinity)
    }
}
