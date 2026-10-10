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
            VStack(spacing: 12) {
                // Founder 10-09: no plain rows. Two candy cast buttons with the white-clay eye on each.
                Button { selection = false; dismiss() } label: {
                    CandyLabel(title: "No spoilers") {
                        FamClayIcon(name: "eye", size: 20, ink: .white)
                    }
                }
                .buttonStyle(CastButtonStyle(color: .purple, size: .large, fullWidth: true))
                .accessibilityLabel("No spoilers, colors only")
                caption("Colors only")

                Button { selection = true; dismiss() } label: {
                    CandyLabel(title: "Full results") {
                        FamClayIcon(name: "eye", size: 20, ink: .white)
                    }
                }
                .buttonStyle(CastButtonStyle(color: .pink, size: .large, fullWidth: true))
                .accessibilityLabel("Full results, letters revealed")
                caption("Letters revealed")

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 20)
        }
    }

    /// The one short line under each candy.
    private func caption(_ text: String) -> some View {
        Text(text).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
            .accessibilityHidden(true)
            .padding(.top, -6).padding(.bottom, 4)
    }
}
