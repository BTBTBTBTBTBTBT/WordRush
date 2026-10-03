import SwiftUI
import WordociousCore

/// Shared pieces of the Friends overhaul (founder-approved 2026-10-01; spec
/// docs/FRIENDS_REDESIGN_SPEC.md §0, §9): the pink palette, the six pocket-game
/// outline icons, pills and section rows. Same rules as the home and VS pages:
/// `#f8f7ff` page, caps 900 headlines, 11/900 gray section labels, white cards
/// (radius 14, soft shadow, no borders), one shimmer.
enum FriendsKit {
    static let ink = Color(hex: 0x831843)
    static let mid = Color(hex: 0x9D174D)
    static let solid = Color(hex: 0xDB2777)
    static let soft = Color(hex: 0xFCE7F3)
    static let titleGradient = [Color(hex: 0xDB2777), Color(hex: 0x7C3AED)]
    static let green = Color(hex: 0x10B981)
    static let page = VsLobbyKit.page
    static let label = VsLobbyKit.label
    static let sub = VsLobbyKit.sub
    /// Our tiles: purple = right / you, amber = present / them, slate = absent.
    static let purple = Color(hex: 0x7C3AED)
    static let amber = Color(hex: 0xF59E0B)
    static let slate = Color(hex: 0xCBD5E1)

    static func color(_ k: FriendlyKind) -> Color {
        switch k {
        case .rps: return Color(hex: 0xF97316)
        case .ttt: return Color(hex: 0x7C3AED)
        case .coin: return Color(hex: 0xCA8A04)
        case .pass: return Color(hex: 0x2563EB)
        case .ghost: return Color(hex: 0x9F1239)
        case .chain: return Color(hex: 0x059669)
        }
    }

    /// FINISH_SPEC §C4: each friend game's card accent + top bar (mockup `.gt`).
    static func tileAccent(_ k: FriendlyKind) -> Color {
        switch k {
        case .rps: return Color(hex: 0xF97316)
        case .ttt: return Color(hex: 0x7C3AED)
        case .coin: return Color(hex: 0xEAB308)
        case .pass: return Color(hex: 0x0EA5E9)
        case .ghost: return Color(hex: 0x8B5CF6)
        case .chain: return Color(hex: 0x10B981)
        }
    }

    /// The game screen's title gradient (§4).
    static func gradient(_ k: FriendlyKind) -> [Color] {
        switch k {
        case .rps: return [Color(hex: 0xF97316), Color(hex: 0xDB2777)]
        case .ttt: return [Color(hex: 0x7C3AED), Color(hex: 0xDB2777)]
        case .coin: return [Color(hex: 0xCA8A04), Color(hex: 0xDB2777)]
        case .pass: return [Color(hex: 0x2563EB), Color(hex: 0x7C3AED)]
        case .ghost: return [Color(hex: 0x9F1239), Color(hex: 0x7C3AED)]
        case .chain: return [Color(hex: 0x059669), Color(hex: 0x2563EB)]
        }
    }

    /// The PLAY WITH FRIENDS sub line (§2.5, §9).
    static func sub(_ k: FriendlyKind) -> String {
        switch k {
        case .rps: return "Best of 3 · our tiles"
        case .ttt: return "Three in a row, best of 3"
        case .coin: return "Heads or tails, best of 5"
        case .pass: return "One board, take turns"
        case .ghost: return "Add a letter; don't finish a word"
        case .chain: return "Last letter starts the next"
        }
    }

    /// "You lead 5–3" / "They lead 5–3" / "Tied 2–2" — nil before any game.
    static func rivalry(_ f: FriendsService.FriendProfile) -> String? {
        let w = f.h2hW ?? 0, l = f.h2hL ?? 0
        guard w + l > 0 else { return nil }
        return w == l ? "Tied \(w)–\(l)" : w > l ? "You lead \(w)–\(l)" : "They lead \(l)–\(w)"
    }

    /// "12-day friend streak" — nil at 0.
    static func streakText(_ n: Int?) -> String? {
        guard let n, n > 0 else { return nil }
        return "\(n)-day friend streak"
    }

    /// The friend's today line when no presence line applies: "6/8 today" / "Hasn't played today".
    static func todayLine(_ f: FriendsService.FriendProfile) -> String {
        let played = f.playedToday ?? 0
        return played > 0 ? "\(played)/\(DailyCompletionsStore.totalDailyModes) today" : "Hasn't played today"
    }

    /// Two words for the ON NOW faces: "in Muddle" / "on now".
    static func doing(_ f: FriendsService.FriendProfile) -> String {
        if let a = f.activity, !a.isEmpty { return "in \(a)" }
        return "on now"
    }

    // MARK: BJ13 — the pocket-game friend picker (web lib/friends-play.ts parity)

    /// The one rules line under the game's title: "Best of 3 · first to 2", "First to 30 points".
    static func rules(_ k: FriendlyKind) -> String {
        switch k {
        case .pass: return "\(FriendlyGames.passMaxGuesses == 6 ? "Six" : "\(FriendlyGames.passMaxGuesses)") guesses, shared board"
        case .chain: return "First to \(k.target) points"
        default: return "Best of \(2 * k.target - 1) · first to \(k.target)"
        }
    }

    /// A grid cell's one short status: "On now", "20 min ago", "5 h ago", "Played today", a rivalry note, else "Away".
    static func pickerStatus(_ f: FriendsService.FriendProfile, now: Date = Date()) -> (text: String, online: Bool) {
        if f.isOnline(now: now) { return ("On now", true) }
        if let last = FriendsService.ms(f.lastSeenAt) {
            let nowMs = FriendsService.ms(now)
            if nowMs >= last {
                let m = (nowMs - last) / 60_000
                if m < 60 { return ("\(max(1, m)) min ago", false) }
                if m < 60 * 24 { return ("\(m / 60) h ago", false) }
            }
        }
        if (f.playedToday ?? 0) > 0 { return ("Played today", false) }
        if let r = rivalry(f) { return (r, false) }
        return ("Away", false)
    }

    /// The grid's numbers (founder mockup pick-friend-1, 10-03): an 8 pt gap, cells ≤ 96
    /// wide before another column joins (3 across on phones, 4 on wide sheets), and the
    /// avatar tile FILLS its cell (≤ 124).
    enum PickerGrid {
        static let gap: CGFloat = 8
        static let maxCell: CGFloat = 96
        static let avatarMax: CGFloat = 124
        /// Name + status + spacing under each tile.
        static let captionHeight: CGFloat = 40
        static let rowSpacing: CGFloat = 12

        static func layout(width: CGFloat) -> (cols: Int, avatar: CGFloat) {
            let cols = max(3, Int(((width + gap) / (maxCell + gap)).rounded(.down)))
            let cell = (width - gap * CGFloat(cols - 1)) / CGFloat(cols)
            return (cols, min(avatarMax, cell).rounded(.down))
        }

        /// The picker sheet's opening height: the header plus two full rows (never cut off).
        static func twoRowHeight(width: CGFloat) -> CGFloat {
            let a = layout(width: width).avatar
            return 170 + 2 * (a + captionHeight) + rowSpacing + 28
        }
    }

    /// The pocket game's title art (docs/design/brand/titles/cast-colors/pocket-<id>.png),
    /// picked up by name once the image set ships.
    static func pocketTitleAsset(_ k: FriendlyKind) -> String { "art-titlecast-pocket-\(k.rawValue)" }
    /// WHO ARE YOU PLAYING? as title art (cast-colors/pick-friend.png), by name.
    static let pickFriendTitleAsset = "art-titlecast-pick-friend"

    /// The friend row for an id (presence, streaks, rivalry).
    static func friend(_ id: String) -> FriendsService.FriendProfile? {
        FriendsService.friends.first { $0.id.caseInsensitiveCompare(id) == .orderedSame }
    }
}

// MARK: - Section rows

/// The section label (FINISH_SPEC §C4: the mockup's 11/900 `.lbl` in the Friends
/// pink ink) with an optional right side.
struct FriendsSectionHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(spacing: 8) {
            FriendsLabel(title)
            Spacer(minLength: 6)
            trailing()
        }
        .padding(.horizontal, 2)
    }
}

extension FriendsSectionHeader where Trailing == EmptyView {
    init(title: String) { self.init(title: title) { EmptyView() } }
}

// MARK: - Pocket-game icons (outline, §0)

/// The coin outline: two concentric circles and a short vertical line.
struct CoinOutline: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: r.midX, y: r.midY)
        let outer = min(r.width, r.height) / 2
        p.addEllipse(in: CGRect(x: c.x - outer, y: c.y - outer, width: outer * 2, height: outer * 2))
        let inner = outer * 0.62
        p.addEllipse(in: CGRect(x: c.x - inner, y: c.y - inner, width: inner * 2, height: inner * 2))
        p.move(to: CGPoint(x: c.x, y: c.y - inner * 0.5))
        p.addLine(to: CGPoint(x: c.x, y: c.y + inner * 0.5))
        return p
    }
}

/// The ghost outline (lucide "ghost" on a 24 grid): rounded head, wavy hem.
/// The eyes are drawn separately as dots.
struct GhostOutline: Shape {
    func path(in r: CGRect) -> Path {
        let k = min(r.width, r.height) / 24
        let ox = r.midX - 12 * k, oy = r.midY - 12 * k
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * k, y: oy + y * k) }
        var p = Path()
        p.move(to: pt(12, 2))
        p.addArc(tangent1End: pt(4, 2), tangent2End: pt(4, 10), radius: 8 * k)
        p.addLine(to: pt(4, 22))
        p.addLine(to: pt(7, 19))
        p.addLine(to: pt(9.5, 21.5))
        p.addLine(to: pt(12, 19))
        p.addLine(to: pt(14.5, 21.5))
        p.addLine(to: pt(17, 19))
        p.addLine(to: pt(20, 22))
        p.addLine(to: pt(20, 10))
        p.addArc(tangent1End: pt(20, 2), tangent2End: pt(12, 2), radius: 8 * k)
        p.closeSubpath()
        return p
    }
}

/// A pocket game's icon: a white 2.4-stroke outline in a rounded square of the
/// game's color, glowing in the same color. `tinted` draws the game-tile chip
/// instead (docs/GAME_TILE_STYLE.md): the outline in the game's color on a soft
/// chip of it (accent at ~8%, radius 8 at 32 pt), no glow.
/// ART_SPEC §9: when its `game-pocket-<kind>` art ships, the glossy 3D icon fills a
/// soft chip of the game's color instead (same size; the art never sits on its
/// own solid color, where it would melt in). The outline is the fallback.
struct FriendlyGameIcon: View {
    let kind: FriendlyKind
    var size: CGFloat = 40
    var glow = true
    var tinted = false

    var body: some View {
        let color = FriendsKit.color(kind)
        if let art = kind.pocketArt {
            ZStack {
                RoundedRectangle(cornerRadius: size * (tinted ? 0.25 : 0.28), style: .continuous)
                    .fill(color.opacity(tinted ? 0.08 : 0.14))
                GameArtImage(asset: art, size: size * 0.94)
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        } else {
            outline(color)
        }
    }

    private func outline(_ color: Color) -> some View {
        ZStack {
            if tinted {
                RoundedRectangle(cornerRadius: size * 0.25).fill(color.opacity(0.08))
            } else {
                RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(color)
                    .shadow(color: glow ? color.opacity(0.5) : .clear, radius: size * 0.14, y: 2)
            }
            glyph(ink: tinted ? color : .white).foregroundStyle(tinted ? color : .white)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    @ViewBuilder private func glyph(ink: Color) -> some View {
        let g = size * 0.5
        switch kind {
        case .rps:
            Image(systemName: "scissors").font(.system(size: g * 0.9, weight: .semibold))
        case .ttt:
            Image(systemName: "number").font(.system(size: g * 0.9, weight: .semibold))
        case .coin:
            CoinOutline().stroke(ink, style: StrokeStyle(lineWidth: max(1.6, size * 0.06), lineCap: .round))
                .frame(width: g, height: g)
        case .pass:
            Image(systemName: "arrow.left.arrow.right").font(.system(size: g * 0.85, weight: .semibold))
        case .ghost:
            let lw = max(1.6, size * 0.06)
            ZStack {
                GhostOutline().stroke(ink, style: StrokeStyle(lineWidth: lw, lineCap: .round, lineJoin: .round))
                HStack(spacing: max(1, g * 0.25 - lw * 1.3)) {
                    Circle().fill(ink).frame(width: lw * 1.3, height: lw * 1.3)
                    Circle().fill(ink).frame(width: lw * 1.3, height: lw * 1.3)
                }
                .offset(y: -g / 12)
            }
            .frame(width: g, height: g)
        case .chain:
            Image(systemName: "link").font(.system(size: g * 0.85, weight: .semibold))
        }
    }
}

/// An avatar with the on-now ring (2 px green, soft pulse) and the green dot.
struct FriendsPresenceAvatar: View {
    let url: String?
    let username: String
    var emoji: String? = nil
    var size: CGFloat = 40
    var online = false
    var ring = true
    @State private var pulse = false

    var body: some View {
        // §20: the on-now ring follows the avatar — circle around a photo,
        // rounded square around a letter tile.
        let tile = AvatarView.showsTile(url, username: username)
        AvatarView(url: url, username: username, size: size, emoji: emoji)
            .padding(online && ring ? 3 : 0)
            .background {
                if online && ring {
                    ZStack {
                        if !Theme.reduceMotion {
                            AvatarOutline(tile: tile).stroke(FriendsKit.green.opacity(0.45), lineWidth: 3)
                                .scaleEffect(pulse ? 1.18 : 1).opacity(pulse ? 0 : 1)
                        }
                        AvatarOutline(tile: tile).stroke(FriendsKit.green, lineWidth: 2)
                    }
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if online {
                    // FINISH_SPEC §C4: a 12-pt green dot with a 2-pt white ring, bottom-right.
                    let dot = size >= 30 ? 12 : max(8, size * 0.3)
                    Circle().fill(FriendsInk.online)
                        .frame(width: dot, height: dot)
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .offset(x: 3, y: 1)
                        .accessibilityHidden(true)
                }
            }
            .onAppear {
                guard online, ring, !Theme.reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true }
            }
    }
}
