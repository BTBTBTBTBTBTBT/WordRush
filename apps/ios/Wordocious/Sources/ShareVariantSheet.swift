import SwiftUI

/// The Share chooser — "No spoilers" vs "Full results".
///
/// Deliberately built from the same parts as the header "?" menu
/// (`MenuScaffold` chrome + the accent-tiled row of `MenuSheet`) rather than a
/// system `confirmationDialog`, which rendered as flat grey iOS chrome that
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
        MenuScaffold("Share") {
            VStack(spacing: 8) {
                Button { selection = false; dismiss() } label: {
                    row(icon: "eye.slash.fill", accent: Color(hex: 0x7C3AED),
                        title: "No spoilers", subtitle: "Colors only")
                }.buttonStyle(.plain)

                Button { selection = true; dismiss() } label: {
                    row(icon: "eye.fill", accent: Color(hex: 0xEC4899),
                        title: "Full results", subtitle: "Letters revealed")
                }.buttonStyle(.plain)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 20)
        }
    }

    /// 1:1 with MenuSheet.row — accent icon tile, uppercase title, muted
    /// subtitle, trailing chevron, on the shared card background.
    private func row(icon: String, accent: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 16, weight: .bold)).foregroundStyle(accent)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 11).fill(accent.opacity(0.14)))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Brand.font(15, .black)).textCase(.uppercase).foregroundStyle(Theme.textPrimary)
                Text(subtitle).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16).fill(Theme.surface)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        )
    }
}
