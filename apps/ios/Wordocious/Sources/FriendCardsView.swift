import SwiftUI
import WordociousCore

/// A white-clay family icon (`art-fam-ic-<name>`), multiplied by the ink and fit to a square
/// (the same way the family action menu draws its rows). Wave 3: more / share / copy / plus ...
struct FamClayIcon: View {
    let name: String
    var size: CGFloat = 18
    var ink: Color = FriendsInk.lavender

    var body: some View {
        if let ui = FamilyArt.shared.image("art-fam-ic-\(name)") {
            Image(uiImage: ui).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                .frame(width: size, height: size).colorMultiply(ink)
                .accessibilityHidden(true)
        } else {
            Color.clear.frame(width: size, height: size)
        }
    }
}

/// The Friends tab, one card per friend (FRIDAY-QUEUE 9 + 9e; the layout and every word come
/// from FriendCards in WordociousCore, pinned to the web by friend-cards-fixtures.json).
/// Their living mascot, name, "playing Classic" under it with the green dot, "N games waiting on
/// you", a compact strip of game tiles (the game's art + one word) that opens the game, and
/// their-turn games folded into one quiet line. No PLAY pills, no repeated "vs @name", no boxes.
struct FriendCardView: View {
    let card: FriendCard
    /// The friend's profile when they are in the list (nil for a stranger with a game).
    let friend: FriendsService.FriendProfile?
    /// Used for the avatar of a friend who is not in the list.
    let fallbackOpponent: FriendlyGameView.Opponent?
    let games: [String: FriendlyGameView]
    let expanded: Bool
    let onOpenGame: (FriendlyGameView) -> Void
    /// A game tile on a friend with nothing going yet: start that game with them.
    let onStartGame: (FriendlyKind) -> Void
    let onToggleTheirs: () -> Void
    let onProfile: () -> Void
    let onMenu: (() -> Void)?

    private var accent: Color { card.waiting > 0 ? FriendsInk.pink : FriendsInk.purple }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            if !card.tiles.isEmpty {
                strip(card.tiles, quiet: false)
            } else if card.theirTurn.isEmpty {
                startRow
            }
            if !card.theirTurnLine.isEmpty {
                theirLine
                if expanded { strip(card.theirTurn, quiet: true).transition(.opacity) }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .friendsCard(accent: accent, bar: [accent], radius: 18, barHeight: 5, tint: 0.07, line: 0.2)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            Button(action: onProfile) {
                HStack(spacing: 10) {
                    avatar
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.name).font(Brand.font(15, .black)).foregroundStyle(FriendsInk.heading)
                            .lineLimit(1).minimumScaleFactor(0.8)
                        if let p = card.presence {
                            HStack(spacing: 4) {
                                Circle().fill(FriendsInk.online).frame(width: 7, height: 7)
                                Text(p).font(Brand.font(11, .heavy)).foregroundStyle(FriendsKit.green)
                                    .lineLimit(1)
                            }
                        }
                        if !card.headline.isEmpty {
                            Text(card.headline).font(Brand.font(13, .black)).foregroundStyle(FriendsInk.bannerHead)
                                .lineLimit(1).minimumScaleFactor(0.8)
                        }
                    }
                    Spacer(minLength: 4)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.squishCard)
            .accessibilityLabel([card.name, card.presence, card.headline.isEmpty ? nil : card.headline]
                .compactMap { $0 }.joined(separator: ", "))
            if let onMenu {
                Button(action: onMenu) {
                    FamClayIcon(name: "more", size: 20, ink: FriendsInk.lavender)
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(RoundIconButtonStyle.compact)
                .accessibilityLabel("More for \(card.name)")
            }
        }
    }

    /// The friend's living mascot (the shared resolver: their mascot, photo or cast pick).
    private var avatar: some View {
        AvatarView(url: friend?.avatar_url ?? fallbackOpponent?.avatarUrl, username: card.name, size: 52,
                   emoji: friend?.avatar_emoji ?? fallbackOpponent?.avatarEmoji,
                   castId: friend?.avatar_cast_id, frame: friend?.avatar_frame,
                   userId: friend?.id ?? fallbackOpponent?.id, stroke: false)
            .overlay(alignment: .bottomTrailing) {
                if card.online {
                    Circle().fill(FriendsInk.online).frame(width: 13, height: 13)
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .offset(x: 2, y: 2)
                }
            }
            .frame(width: 52, height: 52)
    }

    // MARK: Game tiles

    @ViewBuilder private func strip(_ tiles: [GameTile], quiet: Bool) -> some View {
        if tiles.count <= 4 {
            HStack(spacing: 8) {
                ForEach(tiles) { t in tileButton(t, quiet: quiet).frame(maxWidth: 104) }
            }
            .frame(maxWidth: .infinity)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tiles) { t in tileButton(t, quiet: quiet).frame(width: 84) }
                }
                .padding(.horizontal, 1)
            }
        }
    }

    private func tileButton(_ t: GameTile, quiet: Bool) -> some View {
        Button {
            if let g = games[t.gameId] { onOpenGame(g) }
        } label: {
            VStack(spacing: 3) {
                gameArt(t.kind, size: 38)
                Text(t.word).font(Brand.font(11, .black))
                    .foregroundStyle(quiet ? FriendsInk.rowSub : FriendsInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .padding(.vertical, 8).padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(FriendsKit.tileAccent(t.kind).wash(quiet ? 0.07 : 0.14)))
            .opacity(quiet ? 0.85 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
        .accessibilityLabel("\(t.kind.title), \(t.word)")
    }

    /// A friend with nothing going yet: the six games as small tiles, tap one to start it with them.
    private var startRow: some View {
        HStack(spacing: 8) {
            ForEach(FriendlyKind.allCases) { k in
                Button { onStartGame(k) } label: {
                    gameArt(k, size: 30)
                        .frame(maxWidth: .infinity).padding(.vertical, 7)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(FriendsKit.tileAccent(k).wash(0.10)))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.squishCard)
                .accessibilityLabel("Play \(k.title) with \(card.name)")
            }
        }
    }

    private var theirLine: some View {
        Button(action: onToggleTheirs) {
            HStack(spacing: 5) {
                Text(card.theirTurnLine).font(Brand.font(11, .heavy)).foregroundStyle(FriendsInk.rowSub)
                Image(systemName: "chevron.down").font(.system(size: 8, weight: .bold))
                    .foregroundStyle(FriendsInk.rowSub)
                    .rotationEffect(.degrees(expanded ? 180 : 0))
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
        .accessibilityLabel(card.theirTurnLine)
        .accessibilityHint(expanded ? "Hides those games" : "Shows those games")
    }

    @ViewBuilder private func gameArt(_ k: FriendlyKind, size: CGFloat) -> some View {
        if let art = k.pocketArt {
            GameArtImage(asset: art, size: size)
        } else {
            FriendlyGameIcon(kind: k, size: size, tinted: true)
        }
    }
}
