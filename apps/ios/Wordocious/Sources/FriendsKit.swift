import SwiftUI
import WordociousCore

/// Shared pieces of the Friends overhaul (founder-approved 2026-10-01; spec
/// docs/FRIENDS_REDESIGN_SPEC.md §0): the pink palette, the four pocket-game
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
        }
    }

    /// The game screen's title gradient (§4).
    static func gradient(_ k: FriendlyKind) -> [Color] {
        switch k {
        case .rps: return [Color(hex: 0xF97316), Color(hex: 0xDB2777)]
        case .ttt: return [Color(hex: 0x7C3AED), Color(hex: 0xDB2777)]
        case .coin: return [Color(hex: 0xCA8A04), Color(hex: 0xDB2777)]
        case .pass: return [Color(hex: 0x2563EB), Color(hex: 0x7C3AED)]
        }
    }

    /// The PLAY WITH FRIENDS sub line (§2.5).
    static func sub(_ k: FriendlyKind) -> String {
        switch k {
        case .rps: return "Best of 3 · our tiles"
        case .ttt: return "Three in a row, best of 3"
        case .coin: return "Heads or tails, best of 5"
        case .pass: return "One board, take turns"
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

    /// The friend row for an id (presence, streaks, rivalry).
    static func friend(_ id: String) -> FriendsService.FriendProfile? {
        FriendsService.friends.first { $0.id.caseInsensitiveCompare(id) == .orderedSame }
    }
}

// MARK: - Section rows

/// 11/900 gray section label with an optional right side.
struct FriendsSectionHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(spacing: 8) {
            VSSectionLabel(text: title)
            Spacer(minLength: 6)
            trailing()
        }
        .padding(.horizontal, 2)
    }
}

extension FriendsSectionHeader where Trailing == EmptyView {
    init(title: String) { self.init(title: title) { EmptyView() } }
}

/// Solid or soft pink pill (PLAY / Challenge / Nudge / WAITING).
struct FriendsPill: View {
    let title: String
    var solid = true
    var muted = false
    var body: some View {
        Text(title).font(Brand.font(11, .black)).tracking(0.5)
            .foregroundStyle(muted ? FriendsKit.label : solid ? .white : FriendsKit.solid)
            .padding(.horizontal, 12).frame(height: 28)
            .background(Capsule().fill(muted ? Color(hex: 0xF3F4F6) : solid ? FriendsKit.solid : FriendsKit.soft))
            .lineLimit(1).fixedSize()
    }
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

/// A pocket game's icon: a white 2.4-stroke outline in a rounded square of the
/// game's color, glowing in the same color.
struct FriendlyGameIcon: View {
    let kind: FriendlyKind
    var size: CGFloat = 40
    var glow = true

    var body: some View {
        let color = FriendsKit.color(kind)
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(color)
                .shadow(color: glow ? color.opacity(0.5) : .clear, radius: size * 0.14, y: 2)
            glyph.foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    @ViewBuilder private var glyph: some View {
        let g = size * 0.5
        switch kind {
        case .rps:
            Image(systemName: "scissors").font(.system(size: g * 0.9, weight: .semibold))
        case .ttt:
            Image(systemName: "number").font(.system(size: g * 0.9, weight: .semibold))
        case .coin:
            CoinOutline().stroke(Color.white, style: StrokeStyle(lineWidth: max(1.6, size * 0.06), lineCap: .round))
                .frame(width: g, height: g)
        case .pass:
            Image(systemName: "arrow.left.arrow.right").font(.system(size: g * 0.85, weight: .semibold))
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
        AvatarView(url: url, username: username, size: size, emoji: emoji)
            .padding(online && ring ? 3 : 0)
            .background {
                if online && ring {
                    ZStack {
                        if !Theme.reduceMotion {
                            Circle().stroke(FriendsKit.green.opacity(0.45), lineWidth: 3)
                                .scaleEffect(pulse ? 1.18 : 1).opacity(pulse ? 0 : 1)
                        }
                        Circle().stroke(FriendsKit.green, lineWidth: 2)
                    }
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if online {
                    Circle().fill(FriendsKit.green)
                        .frame(width: max(8, size * 0.26), height: max(8, size * 0.26))
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                }
            }
            .onAppear {
                guard online, ring, !Theme.reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true }
            }
    }
}
