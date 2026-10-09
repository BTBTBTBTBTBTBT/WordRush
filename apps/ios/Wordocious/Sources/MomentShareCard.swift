import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// Item 46: the moment shares (a level-up, a pocket-game result, the streak calendar), one card in the shared share look:
/// the Home wallpaper, the lettered headline, the hero band (the sender's mascot, posed by the result), one big soft number
/// with its label, up to three complete lines, the streak days as dots, and the cast wordmark. The copy is Core
/// MomentShare (pinned by moment-share-fixtures.json, the same cards as the web builders and Android). Static and always
/// light, like every share card.
struct MomentShareCardView: View {
    let moment: MomentShare.Moment
    /// Set by the caller (ShareHeroBand.available: a signed-in player); the band's height is then part of the card.
    var heroEnabled = false

    private var heroBand: CGFloat { CGFloat(ShareHero.band(hasHero: heroEnabled)) }
    var size: CGSize { CGSize(width: 1080, height: 1350 + heroBand) }

    private var accent: Color { Color(hexString: moment.accentHex) ?? Color(hex: 0x7C3AED) }

    var body: some View {
        ZStack(alignment: .top) {
            ShareWall(tint: .home)
            VStack(spacing: 0) {
                ShareTitleBand(asset: nil, size: CGSize(width: CGFloat(ShareCardPlan.titleMaxW), height: CGFloat(ShareCardPlan.titleFallbackH)),
                               text: moment.title, color: accent)
                    .padding(.top, CGFloat(ShareCardPlan.topPad))
                if heroBand > 0 { ShareHeroBand(result: moment.hero) }

                Spacer(minLength: 20)
                VStack(spacing: 10) {
                    Text(moment.big)
                        .shareSoftNumber(260, color: accent)
                        .lineLimit(1).minimumScaleFactor(0.3)
                        .padding(.horizontal, 60)
                    ShareDateLine(text: moment.bigLabel, size: 34)
                    VStack(spacing: 18) {
                        ForEach(Array(moment.lines.prefix(3).enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(Brand.fixedFont(44, .black))
                                .foregroundStyle(Color(hex: 0x4C1D95))
                                .lineLimit(1).minimumScaleFactor(0.6)
                                .padding(.horizontal, 60)
                        }
                    }
                    .padding(.top, 22)
                    if !moment.dots.isEmpty {
                        HStack(spacing: 16) {
                            ForEach(Array(moment.dots.suffix(14).enumerated()), id: \.offset) { _, played in
                                Circle()
                                    .fill(played ? accent : Color(hex: 0x7C3AED).opacity(0.16))
                                    .frame(width: 40, height: 40)
                            }
                        }
                        .padding(.top, 24)
                    }
                }
                Spacer(minLength: 20)

                ShareCastWordmark(width: 972)
                    .padding(.bottom, 40)
            }
            .frame(width: size.width, height: size.height, alignment: .top)
        }
        .frame(width: size.width, height: size.height, alignment: .top)
        .clipped()
    }
}

extension ShareService {
    #if canImport(UIKit)
    /// Render + share a moment card, image only (no hosted link), like the stats card.
    @MainActor
    static func shareMoment(_ moment: MomentShare.Moment) {
        var card = MomentShareCardView(moment: moment)
        card.heroEnabled = ShareHeroBand.available
        guard let image = renderCard(card, size: card.size) else { return }
        let game: String
        switch moment.kind {
        case .levelUp: game = "Level up"
        case .pocket: game = "Game result"
        case .streak: game = "Streak"
        }
        presentImages([image], game: game)
    }
    #endif
}

extension Color {
    /// "#RRGGBB" of this color in sRGB (the share builders take an accent as hex text).
    var shareHexString: String {
        #if canImport(UIKit)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X", Int(r * 255 + 0.5), Int(g * 255 + 0.5), Int(b * 255 + 0.5))
        #else
        return MomentShare.purple
        #endif
    }
}
