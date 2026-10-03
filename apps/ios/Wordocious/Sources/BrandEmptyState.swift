import SwiftUI

/// FINISH_SPEC BI24: the one finished empty / error / not-found state. No generic SF
/// Symbol, no bare spinner, no plain-text line, no bordered box: a cast host (its
/// ART_SPEC §7 `scene` when one fits, else the `host` mascot), the `title` in the
/// brand gradient caps, ONE short `line` in the app's voice, and a candy action when
/// one makes sense. `preview` draws a dimmed glimpse of what will appear (opacity
/// only). Enters with a fade + rise (transform / opacity only; Reduce Motion = none).
struct BrandEmptyState<Preview: View>: View {
    let title: String
    let line: String
    var scene: ArtScene? = nil
    var host: MascotID = .w
    var artHeight: CGFloat = 120
    var colors: [Color] = PageHeaderStyle.purplePink
    var lineColor: Color = FinishInk.secondary
    var actionTitle: String? = nil
    var actionSymbol: String? = nil
    var actionVariant: CandyButtonStyle.Variant = .purple
    var action: (() -> Void)? = nil
    @ViewBuilder var preview: () -> Preview

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        let still = reduceMotion || Theme.reduceMotion
        VStack(spacing: 8) {
            Group {
                if let scene {
                    SceneArt(scene, height: artHeight, fallbackSize: artHeight * 0.8)
                } else {
                    MascotView(host, size: artHeight * 0.8, motion: .bob)
                }
            }
            .padding(.bottom, 2)
            Text(title.uppercased())
                .font(Brand.font(20, .black)).tracking(0.4)
                .foregroundStyle(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
                .multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.7)
                .accessibilityAddTraits(.isHeader)
            Text(line)
                .font(Brand.font(14, .bold)).foregroundStyle(lineColor)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 320)
            if let actionTitle, let action {
                Button(action: action) { CandyLabel(title: actionTitle, symbol: actionSymbol) }
                    .buttonStyle(CandyButtonStyle(variant: actionVariant, size: .medium, fullWidth: false))
                    .padding(.top, 4)
            }
            if Preview.self != EmptyView.self {
                preview()
                    .opacity(0.38)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                    .padding(.top, 6)
            }
        }
        .padding(.horizontal, 24).padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .opacity(shown || still ? 1 : 0)
        .offset(y: shown || still ? 0 : 12)
        .onAppear {
            guard !shown else { return }
            if still { shown = true } else { withAnimation(.easeOut(duration: 0.32)) { shown = true } }
        }
    }
}

extension BrandEmptyState where Preview == EmptyView {
    init(title: String, line: String, scene: ArtScene? = nil, host: MascotID = .w, artHeight: CGFloat = 120,
         colors: [Color] = PageHeaderStyle.purplePink, lineColor: Color = FinishInk.secondary,
         actionTitle: String? = nil, actionSymbol: String? = nil,
         actionVariant: CandyButtonStyle.Variant = .purple, action: (() -> Void)? = nil) {
        self.init(title: title, line: line, scene: scene, host: host, artHeight: artHeight, colors: colors,
                  lineColor: lineColor, actionTitle: actionTitle, actionSymbol: actionSymbol,
                  actionVariant: actionVariant, action: action, preview: { EmptyView() })
    }
}
