import SwiftUI

// FINISH_SPEC §AG (iPad / wide screens, width ≥ 600): the same readable column the
// phone has — game screens and pages capped at a max width and centered on their
// wallpaper (the wallpaper itself stays full-bleed: apply this to the CONTENT, not
// the view that carries the PageBackground), popups capped at ~440 pt.
//
// Every cap is wider than any iPhone (the widest is 440 pt), so on phones these are
// no-ops; they only take effect on iPad. NOTE: the app target is iPhone-only today
// (project.yml TARGETED_DEVICE_FAMILY "1", portrait), so iPad runs it in iPhone
// compatibility mode — this keeps the layout width-safe for when the family widens.

enum WideColumn {
    /// Game screens (board + keyboard + finished screen): boards keep the phone
    /// sizing rule (BoardSizing fits the capped width AND the available height, so
    /// landscape never breaks the fit).
    case game
    /// Home / Leaderboard / Stats / Friends and pushed pages.
    case page
    /// Popups and sheet content.
    case popup

    var maxWidth: CGFloat {
        switch self {
        case .game: return 560
        case .page: return 740
        case .popup: return 440
        }
    }
}

extension View {
    /// §AG: cap this content at the column's max width, centered in the space it is
    /// offered (the surrounding background keeps the full width).
    func wideColumn(_ column: WideColumn) -> some View {
        frame(maxWidth: column.maxWidth).frame(maxWidth: .infinity)
    }
}
