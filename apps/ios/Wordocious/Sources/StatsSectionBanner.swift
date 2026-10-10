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
        HStack(alignment: .bottom, spacing: 12) {
            // Founder 10-09: the section title in the Wordocious bubble lettering (blue Today, amber All-time).
            BubbleOneLine(text: today ? "TODAY" : "ALL-TIME",
                          palette: .accent(today ? Color(hex: 0x3B82F6) : Color(hex: 0xF59E0B)),
                          size: 30, alignment: .leading)
                .frame(width: 190)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(today ? "Today" : "All-time")
            .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            if let note {
                BubbleOneLine(text: note.uppercased(), palette: .accent(Color(hex: 0xA78BFA)), size: 14, alignment: .trailing)
                    .frame(width: 130)
                    .padding(.bottom, 4)
            }
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity)
    }
}
