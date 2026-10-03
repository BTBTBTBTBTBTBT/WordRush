import SwiftUI

/// FINISH_SPEC BJ1: the Stats page's two section headers — TODAY first, ALL-TIME beneath (the
/// Today | All-time toggle is gone). Brand gradient caps + a short gradient rule, and a small
/// muted note on the right (the date, "Since Mar 2025"). Static — no animation, no box, no
/// border — so it costs nothing to scroll past. Twins: Android StatsSectionBanner (StatsFinish.kt),
/// web components/stats/stats-section-banner.tsx.
struct StatsSectionBanner: View {
    let today: Bool
    var note: String? = nil

    static let todayColors = [Color(hex: 0x2563EB), Color(hex: 0x7C3AED)]
    static let allTimeColors = [Color(hex: 0xD97706), Color(hex: 0xDB2777)]

    var body: some View {
        let gradient = LinearGradient(colors: today ? Self.todayColors : Self.allTimeColors,
                                      startPoint: .leading, endPoint: .trailing)
        HStack(alignment: .bottom, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(today ? "TODAY" : "ALL-TIME")
                    .font(Brand.font(24, .black)).tracking(1.6)
                    .foregroundStyle(gradient)
                    .lineLimit(1)
                Capsule().fill(gradient).frame(width: 44, height: 4)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(today ? "Today" : "All-time")
            .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            if let note {
                Text(note.uppercased())
                    .font(Brand.font(11, .heavy)).tracking(0.9)
                    .foregroundStyle(FinishInk.secondary)
                    .lineLimit(1).minimumScaleFactor(0.8)
                    .padding(.bottom, 4)
            }
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity)
    }
}
