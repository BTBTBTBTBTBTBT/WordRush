import SwiftUI

/// The Share chooser — "No spoilers" vs "Full results".
///
/// Deliberately built from the same parts as the header "?" menu
/// (`MenuScaffold` chrome + the accent-tiled row of `MenuSheet`) rather than a
/// system `confirmationDialog`, which rendered as flat gray iOS chrome that
/// looked nothing like the app. Presented as a sheet with a fixed detent so it
/// reads as a compact menu, not a full-screen takeover.
struct ShareVariantSheet: View {
    /// true = "Full results" (letters revealed); false = the spoiler-free card.
    ///
    /// The presenter reads this in the sheet's `onDismiss` rather than taking a
    /// callback — the same handshake AppHeaderView uses for MenuSheet →
    /// destination. Presenting the UIActivityViewController from inside the
    /// button action would race this sheet's own dismissal.
    @Binding var selection: Bool?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        MenuScaffold("Share", heading: .share) {   // BJ16
            VStack(spacing: 8) {
                Button { selection = false; dismiss() } label: {
                    row(icon: "eye.slash.fill", accent: Color(hex: 0x7C3AED),
                        title: "No spoilers", subtitle: "Colors only")
                }.buttonStyle(.squish)

                Button { selection = true; dismiss() } label: {
                    row(icon: "eye.fill", accent: Color(hex: 0xEC4899),
                        title: "Full results", subtitle: "Letters revealed")
                }.buttonStyle(.squish)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 20)
        }
    }

    /// Like MenuSheet.row — accent icon tile, uppercase title, muted subtitle (no
    /// chevron, ART_SPEC §21.4) — on a tinted card in the option's accent (§A1).
    private func row(icon: String, accent: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            // §A1 icon tile = a mini game card: accent wash, border, inset top bar.
            Image(systemName: icon).font(.system(size: 16, weight: .bold)).foregroundStyle(accent)
                .frame(width: 40, height: 40)
                .tintedPill(accent, radius: 11)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Brand.font(15, .black)).textCase(.uppercase).foregroundStyle(FinishInk.heading)
                Text(subtitle).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Spacer()
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        // §A1: a tinted row in the option's accent (no plain white; dark keeps its surface).
        .tintedCard(accent: accent, radius: 16, tint: 0.09, line: 0.28)
    }
}
