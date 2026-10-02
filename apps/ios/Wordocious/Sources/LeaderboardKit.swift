import SwiftUI
import WordociousCore

/// The pieces the Leaderboard tab and the Records screens share, so both pages wear
/// one look (docs/LEADERBOARD_REDESIGN_SPEC.md §2, docs/RECORDS_REDESIGN_SPEC.md §2):
/// soft white cards (radius 14, soft shadow, no border), caps section labels, medal
/// discs, the gold "your rank" card, the soft pill segmented control, the bare share
/// icon, your-row tint + ring, and the game-tile CARD header.
enum LbStyle {
    /// Medal disc colors for ranks 1–3 (gold / silver / bronze); nil after.
    static func medal(_ rank: Int) -> Color? {
        switch rank {
        case 1: return Color(hex: 0xF59E0B)
        case 2: return Color(hex: 0x9CA3AF)
        case 3: return Color(hex: 0xCD7F32)
        default: return nil
        }
    }

    /// Deeper medal ink for the big rank numerals on the gold card.
    static func medalInk(_ rank: Int) -> Color? {
        switch rank {
        case 1: return Color(hex: 0xD97706)
        case 2: return Color(hex: 0x6B7280)
        case 3: return Color(hex: 0xB45309)
        default: return nil
        }
    }
}

extension View {
    /// The soft white card: radius 14, soft shadow, no border.
    func lbCard() -> some View {
        background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            // ART_SPEC §11: the lift is tinted toward the page's accent (amber on
            // Leaderboard / Records), drawn by the backing shape so rows stay crisp.
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.surface).pageCardShadow())
    }

    /// Your own row: tinted gold with a 1.5 pt amber ring, inset inside the card.
    @ViewBuilder func youRow(_ isMe: Bool) -> some View {
        if isMe {
            background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.highlightGold))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(hex: 0xF59E0B), lineWidth: 1.5))
                .padding(.horizontal, 4)
        } else {
            padding(.horizontal, 4)
        }
    }
}

/// Section label: 11 / 900, letter-spacing 1.2, muted.
struct LbSectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(Brand.font(11, .black)).tracking(1.2).foregroundStyle(Theme.textMuted)
            .lineLimit(1).fixedSize()
    }
}

/// Medal discs for 1–3, the plain number after.
struct LbRankBadge: View {
    let rank: Int
    var body: some View {
        if let c = LbStyle.medal(rank) {
            Text("\(rank)").font(Brand.font(11, .black)).foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Circle().fill(c))
                .shadow(color: c.opacity(0.35), radius: 2, x: 0, y: 1)
        } else {
            Text("\(rank)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted)
                .lineLimit(1).minimumScaleFactor(0.6).frame(width: 22)
        }
    }
}

/// The bare share icon every board header uses.
struct LbShareButton: View {
    let busy: Bool
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Icon3D(.share, size: 18)
                .frame(width: 30, height: 30).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(busy ? 0.4 : 1)
        .accessibilityLabel(label)
    }
}

/// The soft pill segmented control (Everyone | Friends, Solo | VS): a muted capsule
/// track with the selected segment as a raised surface pill in the accent ink.
struct LbPillSwitch<Value: Hashable>: View {
    struct Option { let value: Value; let label: String; var symbol: String? = nil }
    let options: [Option]
    let value: Value
    let accent: Color
    let onChange: (Value) -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.value) { o in
                let on = o.value == value
                Button { if !on { onChange(o.value) } } label: {
                    HStack(spacing: 4) {
                        if let s = o.symbol { Image(systemName: s).font(.system(size: 10, weight: .bold)) }
                        Text(o.label).font(Brand.font(10, .heavy))
                    }
                    .foregroundStyle(on ? accent : Theme.textMuted)
                    .padding(.horizontal, 10).frame(height: 24)
                    .background(Capsule().fill(on ? Theme.surface : Color.clear)
                        .shadow(color: on ? Color.black.opacity(0.08) : .clear, radius: 2, x: 0, y: 1))
                    .contentShape(Capsule())
                }
                .buttonStyle(InstantButtonStyle())
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(2)
        .background(Capsule().fill(Theme.textMuted.opacity(0.12)))
        .fixedSize()
    }
}

/// Your rank: a soft gold card — the rank in big numerals (medal tint for the top 3),
/// the "OF N TODAY" line (+ the movement badge), and your points at the right.
struct LbRankCard<Delta: View>: View {
    let rank: Int
    let ofLine: String
    var points: String? = nil
    var pointsLabel: String = "POINTS"
    @ViewBuilder var delta: () -> Delta

    var body: some View {
        let ink = Color(hex: 0x92400E)
        let deep = Color(hex: 0x78350F)
        HStack(alignment: .center, spacing: 12) {
            Text("#\(rank)")
                .font(Brand.font(34, .black)).monospacedDigit()
                .foregroundStyle(LbStyle.medalInk(rank) ?? deep)
                .lineLimit(1).minimumScaleFactor(0.6)
            VStack(alignment: .leading, spacing: 2) {
                Text("YOUR RANK").font(Brand.font(10, .black)).tracking(1).foregroundStyle(ink)
                HStack(spacing: 4) {
                    Text(ofLine)
                        .font(Brand.font(12, .black)).tracking(0.4).foregroundStyle(deep)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    delta()
                }
            }
            Spacer(minLength: 6)
            if let points {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(points).font(Brand.font(20, .black)).foregroundStyle(deep)
                        .lineLimit(1).fixedSize()
                    Text(pointsLabel).font(Brand.font(9, .black)).tracking(1).foregroundStyle(ink)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(
            LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xFFFBEB)], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .shadow(color: Color(hex: 0x92400E).opacity(0.10), radius: 6, x: 0, y: 2)
        .accessibilityElement(children: .combine)
    }
}

extension LbRankCard where Delta == EmptyView {
    init(rank: Int, ofLine: String, points: String? = nil, pointsLabel: String = "POINTS") {
        self.init(rank: rank, ofLine: ofLine, points: points, pointsLabel: pointsLabel) { EmptyView() }
    }
}

/// The game-tile CARD header (tint, border, top bar in the game's color; icon chip;
/// game name 15 / 900; a muted sub line), with optional trailing controls and an
/// extra row underneath (the Records Solo | VS / Everyone | Friends pills).
struct LbGameHeaderCard<Right: View, Extra: View>: View {
    let accent: Color
    let icon: ModeIconKind
    let title: String
    var sub: String? = nil
    var subSymbol: String? = nil
    /// ART_SPEC §10 / §14: the card's game — its title art (filling the room left of
    /// the trailing controls, ≤ 52 pt tall) replaces the name text.
    var mode: GameMode? = nil
    @ViewBuilder var right: () -> Right
    @ViewBuilder var extra: () -> Extra

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ModeIconView(icon: icon, accent: accent, box: 32)
                VStack(alignment: .leading, spacing: 2) {
                    if let art = mode.flatMap(GameTitleArt.forMode) {
                        GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 52, alignment: .leading)
                    } else {
                        Text(title).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    if let sub {
                        HStack(spacing: 4) {
                            if let subSymbol { Image(systemName: subSymbol).font(.system(size: 10)) }
                            Text(sub).font(Brand.font(10, .bold)).lineLimit(1).minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(Theme.textMuted)
                    }
                }
                // §14: the art fills the room left of the controls (offered first, ahead of the spacer).
                .layoutPriority(1)
                Spacer(minLength: 6)
                right()
            }
            extra()
        }
        .padding(.horizontal, 12).padding(.top, 16).padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .gameTile(accent: accent)
    }
}

extension LbGameHeaderCard where Right == EmptyView, Extra == EmptyView {
    init(accent: Color, icon: ModeIconKind, title: String, sub: String? = nil, subSymbol: String? = nil) {
        self.init(accent: accent, icon: icon, title: title, sub: sub, subSymbol: subSymbol, right: { EmptyView() }, extra: { EmptyView() })
    }
}

/// Row separator inside the soft cards (inset hairline).
struct LbDivider: View {
    var body: some View { Divider().overlay(Theme.border.opacity(0.6)).padding(.horizontal, 14) }
}
