import SwiftUI
import WordociousCore

/// The pieces the Leaderboard tab and the Records screens share, so both pages wear
/// one look (docs/LEADERBOARD_REDESIGN_SPEC.md §2, docs/RECORDS_REDESIGN_SPEC.md §2;
/// FINISH_SPEC §A1 / §A2 / §C2 / §C2a, mockup docs/design/brand/mockups/
/// leaderboard-polish.html): the cream tinted board card, caps section labels, medal
/// discs, the gold result card, the bare share icon, the board row (§C2a W / L
/// column + soft-number points), your-row tint + ring, and the tinted game header card.
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

    /// The Leaderboard / Records page accent (warm gold) and its label ink.
    static let gold = Color(hex: 0xF59E0B)
    static let goldInk = Color(hex: 0x8A4A12)

    // BJ4: the old `podiumFits` (podium only for exactly 1-2-3) is gone — every board
    // stands its leaders from one result up (Core PodiumLayout).
}

// MARK: - Environment

private struct LbCardEmbeddedKey: EnvironmentKey { static let defaultValue = false }
private struct LbOpenProfileKey: EnvironmentKey { static let defaultValue: ((String) -> Void)? = nil }

extension EnvironmentValues {
    /// Inside the result card: `lbCard()` draws no chrome of its own (the completed-
    /// daily card becomes the result card's footer — FINISH_SPEC §C2 "ONE result card").
    var lbCardEmbedded: Bool {
        get { self[LbCardEmbeddedKey.self] }
        set { self[LbCardEmbeddedKey.self] = newValue }
    }

    /// Opens a player's public profile on the page's navigation stack (the podium's
    /// places do what tapping their row did).
    var lbOpenProfile: ((String) -> Void)? {
        get { self[LbOpenProfileKey.self] }
        set { self[LbOpenProfileKey.self] = newValue }
    }
}

// MARK: - Cards

/// §A1: the cream board card (mockup `--tint:#fff8ef;--tline:#f3e3cf`) — no plain white.
private struct LbCardChrome: ViewModifier {
    @Environment(\.lbCardEmbedded) private var embedded

    func body(content: Content) -> some View {
        if embedded {
            content
        } else {
            content.tintedCard(accent: LbStyle.gold, tint: 0.07, line: 0.24)
        }
    }
}

extension View {
    /// The cream tinted board card (radius 20, 1.5 border, soft shadow). Inside the
    /// result card (`lbCardEmbedded`) it draws nothing.
    func lbCard() -> some View { modifier(LbCardChrome()) }

    /// Your own row: a stronger gold tint, inset inside the card (BJ7: no ring — no
    /// outlined boxes; the deeper wash + "(you)" carry it).
    @ViewBuilder func youRow(_ isMe: Bool) -> some View {
        if isMe {
            background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Theme.isDark ? Theme.highlightGold : LbStyle.gold.wash(0.32)))
                .padding(.horizontal, 4).padding(.vertical, 2)
        } else {
            padding(.horizontal, 4).padding(.vertical, 2)
        }
    }
}

/// Drops the top `drop` points of its child (clipped by the caller) — hides the
/// embedded completed-daily card's own 4-pt top bar inside the result card.
struct LbDropTop: Layout {
    var drop: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        let s = v.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil))
        return CGSize(width: proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? s.width, height: max(0, s.height - drop))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: CGPoint(x: bounds.minX, y: bounds.minY - drop), anchor: .topLeading,
                              proposal: ProposedViewSize(width: bounds.width, height: nil))
    }
}

// MARK: - Labels, badges, share

/// Section label (mockup `.bhead .t`): 11 / 900, 0.12 em tracking, warm ink.
struct LbSectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        FinishLabel(text, color: Color(hex: 0x8A6A55)).fixedSize()
    }
}

/// Medal discs for 1–3, the plain muted number after (mockup `.lrow .n`, 15 / 900).
struct LbRankBadge: View {
    let rank: Int
    var body: some View {
        if let c = LbStyle.medal(rank) {
            Text("\(rank)").font(Brand.font(13, .black)).foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(Circle().fill(LinearGradient(colors: [Color.white.mixed(over: c, 0.25), c],
                                                         startPoint: .top, endPoint: .bottom)))
                .shadow(color: c.opacity(0.35), radius: 2, x: 0, y: 1)
        } else {
            Text("\(rank)").font(Brand.font(15, .black)).monospacedDigit()
                .foregroundStyle(Theme.isDark ? Theme.textMuted : Color(hex: 0x8A78AD))
                .lineLimit(1).minimumScaleFactor(0.5).frame(width: 28)
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
            Icon3D(.share, size: 20)
                .frame(width: 34, height: 34).contentShape(Rectangle())
        }
        .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
        .opacity(busy ? 0.4 : 1)
        .accessibilityLabel(label)
    }
}

// MARK: - §C2 The result card

/// FINISH_SPEC §C2: ONE result card on gold (mockup `.result`, tint #fff5df, bar
/// #f5a524 → #ffd166) — the 3D crown over your rank as a soft number, the "OF N TODAY"
/// caps line (+ the movement badge), how you solved it, and your points as a big soft
/// number. `footer` holds the completed-daily dropdown (your solved board + score
/// breakdown), drawn without its own card.
struct LbResultCard<Delta: View, Footer: View>: View {
    var rank: Int?
    let ofLine: String
    var line: String? = nil
    var points: String? = nil
    var pointsLabel: String = "POINTS"
    /// FINISH_SPEC §AR: the live headline over the card ("YOU'RE #3 TODAY").
    var headline: String? = nil
    /// FINISH_SPEC §AU2: ONE compact row — "#2 of 5 · 2,005 PTS · Solved in 4 · 48s"
    /// (+ the movement badge), no headline and no "OF N TODAY" repeat.
    var compact: Bool = false
    @ViewBuilder var delta: () -> Delta
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        if compact { compactBody } else { fullBody }
    }

    private var compactBody: some View {
        let ink = Theme.isDark ? Theme.textSecondary : LbStyle.goldInk
        let rest = [points.map { "\($0) \(pointsLabel == "POINTS" ? "PTS" : pointsLabel)" }, line].compactMap { $0 }
        return VStack(spacing: 0) {
            HStack(spacing: 7) {
                Icon3D(.crown, size: 20)
                Text(rank.map { "#\($0)" } ?? "#–").softNumber(20)
                    .lineLimit(1).fixedSize()
                Text(([ofLine] + rest).joined(separator: " · "))
                    .font(Brand.font(12, .black))
                    .foregroundStyle(ink)
                    .lineLimit(1).minimumScaleFactor(0.65)
                    .frame(maxWidth: .infinity, alignment: .leading)
                delta()
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel((rank.map { "Rank \($0) " } ?? "Not ranked yet ") + ([ofLine] + rest).joined(separator: ", "))
            footer()
                .environment(\.lbCardEmbedded, true)
        }
        .tintedCard(accent: Color(hex: 0xF5A524), bar: [Color(hex: 0xF5A524), Color(hex: 0xFFD166)],
                    radius: 16, barHeight: 4, tint: 0.12, line: 0.30)
    }

    private var fullBody: some View {
        let dark = Theme.isDark
        let ink = dark ? Theme.textSecondary : LbStyle.goldInk
        return VStack(spacing: 0) {
            if let headline {
                BubbleTextView(text: headline, palette: .leaderboard, maxSize: 18, minSize: 12)
                    .padding(.horizontal, 12).padding(.top, 8)
            }
            // BJ7: one top line — crown + rank, the "of" line and the points top-aligned;
            // the solve line ONE line 4 under it.
            HStack(alignment: .top, spacing: 10) {
                VStack(spacing: 0) {
                    Icon3D(.crown, size: 24)
                    Text(rank.map { "#\($0)" } ?? "#–")
                        .softNumber(22)
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
                .frame(minWidth: 48)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(rank.map { "Rank \($0)" } ?? "Not ranked yet")
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Text(ofLine)
                            .font(Brand.font(13, .black)).tracking(1)
                            .foregroundStyle(ink)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        delta()
                    }
                    if let line {
                        Text(line)
                            .font(Brand.font(13, .heavy))
                            .foregroundStyle(FinishInk.secondary)
                            .lineLimit(1).minimumScaleFactor(0.75)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let points {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(points).softNumber(22)
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text(pointsLabel)
                            .font(Brand.font(11, .black)).tracking(1.3)
                            .foregroundStyle(ink)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .accessibilityElement(children: .combine)
            footer()
                .environment(\.lbCardEmbedded, true)
        }
        .tintedCard(accent: Color(hex: 0xF5A524), bar: [Color(hex: 0xF5A524), Color(hex: 0xFFD166)],
                    barHeight: 6, tint: 0.12, line: 0.30)
    }
}

extension LbResultCard where Footer == EmptyView {
    init(rank: Int?, ofLine: String, line: String? = nil, points: String? = nil, pointsLabel: String = "POINTS",
         headline: String? = nil, compact: Bool = false, @ViewBuilder delta: @escaping () -> Delta) {
        self.init(rank: rank, ofLine: ofLine, line: line, points: points, pointsLabel: pointsLabel,
                  headline: headline, compact: compact, delta: delta, footer: { EmptyView() })
    }
}

extension LbResultCard where Delta == EmptyView, Footer == EmptyView {
    init(rank: Int?, ofLine: String, line: String? = nil, points: String? = nil, pointsLabel: String = "POINTS",
         headline: String? = nil) {
        self.init(rank: rank, ofLine: ofLine, line: line, points: points, pointsLabel: pointsLabel,
                  headline: headline, delta: { EmptyView() }, footer: { EmptyView() })
    }
}

/// The completed-daily dropdown as the result card's footer: a dashed divider, then
/// the card's own header row (its 4-pt top bar dropped) — it expands into your
/// solved board + score breakdown exactly as before. Draws nothing while that card
/// has nothing to show.
struct LbResultFooter<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        LbDropTop(drop: 4) { content() }
            .clipped()
            .overlay(alignment: .top) {
                GeometryReader { g in
                    if g.size.height > 1 {
                        Line()
                            .stroke(LbStyle.gold.opacity(Theme.isDark ? 0.35 : 0.40),
                                    style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                            .frame(height: 1)
                            .padding(.horizontal, 14)
                    }
                }
                .allowsHitTesting(false)
            }
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            return p
        }
    }
}

/// "Solved in 4 guesses · 48s" — how a daily result went, through the mode's guess
/// semantics ("Solved · 0 mistakes · 1m 5s", "Not solved · 6 guesses · 2m 3s").
func lbSolveLine(mode: GameMode, completed: Bool, guessCount: Int, timeSeconds: Double,
                 boardsSolved: Int? = nil, totalBoards: Int? = nil) -> String {
    let meta = ModeGen.byDbKey(mode.rawValue)
    let semantics = meta?.guessSemantics ?? "guesses"
    let stat = formatGuessStat(semantics: semantics, guessBase: meta?.guessBase ?? 1, guessCount: guessCount)
    let t = formatShortTime(Int(timeSeconds))
    var head: String
    if completed {
        head = semantics == "guesses" ? "Solved in \(stat)" : "Solved · \(stat)"
    } else {
        head = "Not solved · \(stat)"
    }
    if let b = boardsSolved, let n = totalBoards, n > 1 { head += " · \(b)/\(n) boards" }
    return "\(head) · \(t)"
}

// MARK: - §C2a The board row

/// One board row (mockup `.lrow`): the rank (medal disc / muted number), the player's
/// avatar (BJ5: the one resolver, at 36), the name over a small subtitle (`info`, the link to
/// the public profile), then §C2a the W / L badge in its own fixed column immediately
/// left of the points (an empty slot when there is no badge, so the points line up),
/// and the points as a soft number. `trailing` holds the taunt bell on the Friends board.
struct LbBoardRow<Info: View, Trailing: View>: View {
    /// nil = an unranked ghost row ("–").
    var rank: Int?
    let userId: String
    let username: String
    var avatarUrl: String? = nil
    var emoji: String? = nil
    /// true = won, false = lost, nil = no badge.
    var won: Bool? = nil
    var points: String? = nil
    @ViewBuilder var info: () -> Info
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 10) {
            Group {
                if let rank {
                    LbRankBadge(rank: rank)
                } else {
                    Text("–").font(Brand.font(15, .black)).foregroundStyle(Theme.textMuted)
                }
            }
            .frame(width: 28)
            // Only the player (avatar + name) links to the public profile; your own row opens your
            // Stage (founder 10-05, door 1).
            Group {
                if DressUp.isOwn(userId) {
                    Button { DressUp.shared.open() } label: { player }
                } else {
                    NavigationLink(value: userId) { player }
                }
            }
            .buttonStyle(.squish)
            WLBadgeSlot(won: won)
            if let points {
                Text(points).softNumber(16)
                    .lineLimit(1).fixedSize()
            }
            trailing()
        }
        // BJ7: 7 vertical (was 9) — the 36-pt avatar row still clears 44.
        .padding(.horizontal, 10).padding(.vertical, 7)
    }

    private var player: some View {
                HStack(spacing: 10) {
                    // BJ5: the one resolver (the own row resolves from the live profile).
                    AvatarView(url: avatarUrl, username: username, size: 36, emoji: emoji,
                               pro: userId == AuthService.shared.profile?.id && AuthService.shared.isProActive,
                               userId: userId)
                    info()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
    }
}

extension LbBoardRow where Trailing == EmptyView {
    init(rank: Int?, userId: String, username: String, avatarUrl: String? = nil, emoji: String? = nil,
         won: Bool? = nil, points: String? = nil, @ViewBuilder info: @escaping () -> Info) {
        self.init(rank: rank, userId: userId, username: username, avatarUrl: avatarUrl, emoji: emoji,
                  won: won, points: points, info: info, trailing: { EmptyView() })
    }
}

/// The row's name line (15 / 900) with an optional " (you)".
struct LbRowName: View {
    let name: String
    var isMe: Bool = false
    var body: some View {
        (Text(name) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
            .font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
            .lineLimit(1).minimumScaleFactor(0.7)
    }
}

/// The row's small subtitle (12 / 700, muted).
struct LbRowSub: View {
    let text: String
    var lines: Int = 1
    var body: some View {
        Text(text).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
            .lineLimit(lines).minimumScaleFactor(0.8)
            .fixedSize(horizontal: false, vertical: lines > 1)
    }
}

// MARK: - The game header card

/// The game header card (Records): a tinted card in the game's color with its top
/// bar (§A1), the game's title art (or icon + name), a muted sub line, optional
/// trailing controls and an extra row underneath (the Solo | VS / Everyone | Friends
/// toggles).
struct LbGameHeaderCard<Right: View, Extra: View>: View {
    let accent: Color
    let icon: ModeIconKind
    let title: String
    var sub: String? = nil
    var subSymbol: String? = nil
    /// ART_SPEC §10 / §14: the card's game — its title art (filling the room left of
    /// the trailing controls, ≤ 56 pt tall) replaces the name text.
    var mode: GameMode? = nil
    /// A glossy 3D icon to draw instead of `icon` (the Sweep's `game-sweep`).
    var art: String? = nil
    @ViewBuilder var right: () -> Right
    @ViewBuilder var extra: () -> Extra

    var body: some View {
        let titleArt = mode.flatMap(GameTitleArt.forMode)
        // BJ7: one top line (art / icon + title + controls top-aligned), the sub 4 under it.
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                if titleArt == nil {
                    if let art, ArtAsset.exists(art) {
                        GameArtImage(asset: art, size: 40)
                    } else if let g = icon.gameArt {
                        GameArtImage(asset: g, size: 40)
                    } else {
                        ModeIconView(icon: icon, accent: accent, box: 32)
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    if let titleArt {
                        GameTitleArtView(asset: titleArt.asset, label: titleArt.label, maxHeight: 44, alignment: .leading)
                    } else {
                        Text(title).font(Brand.font(17, .black)).foregroundStyle(FinishInk.heading)
                            .lineLimit(1).minimumScaleFactor(0.7)
                            .accessibilityAddTraits(.isHeader)
                    }
                    if let sub {
                        HStack(spacing: 4) {
                            if let subSymbol { Image(systemName: subSymbol).font(.system(size: 11, weight: .bold)) }
                            Text(sub).font(Brand.font(12, .heavy)).lineLimit(1).minimumScaleFactor(0.75)
                        }
                        .foregroundStyle(FinishInk.secondary)
                    }
                }
                // §14: the art fills the room left of the controls (offered first, ahead of the spacer).
                .layoutPriority(1)
                Spacer(minLength: 6)
                right()
            }
            extra()
        }
        .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedCard(accent: accent, bar: [accent, accent.wash(0.55)], barHeight: 6)
    }
}

extension LbGameHeaderCard where Right == EmptyView, Extra == EmptyView {
    init(accent: Color, icon: ModeIconKind, title: String, sub: String? = nil, subSymbol: String? = nil,
         art: String? = nil) {
        self.init(accent: accent, icon: icon, title: title, sub: sub, subSymbol: subSymbol, art: art,
                  right: { EmptyView() }, extra: { EmptyView() })
    }
}

/// Row separator inside the cards (inset hairline). The striped rows carry their own
/// hairline; this one remains for the "···" rank-window break.
struct LbDivider: View {
    var body: some View {
        Rectangle().fill(Theme.isDark ? Color.white.opacity(0.06) : LbStyle.gold.opacity(0.14))
            .frame(height: 1).padding(.horizontal, 14)
    }
}
