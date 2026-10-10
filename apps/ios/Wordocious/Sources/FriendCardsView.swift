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
    /// Founder 10-09: each game tile carries a small resign flag; the confirm happens on the tile itself.
    var onResign: ((FriendlyGameView) -> Void)? = nil
    /// The tile whose flag was tapped (it shows "Resign?" with Keep / Resign in place).
    @State private var confirming: String?

    /// Every game going with them: yours to play first, then theirs.
    private var allTiles: [GameTile] { card.tiles + card.theirTurn }

    private var accent: Color { card.waiting > 0 ? FriendsInk.pink : FriendsInk.purple }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            // Founder 10-09: a friend with several games folds them into one dropdown (the games' art, how many wait
            // on you, a chevron); it opens the tiles to pick from. One game shows its tile; none shows the start row.
            if allTiles.count >= 2 {
                gamesDropdown
                if expanded {
                    strip(allTiles, quiet: false).transition(.opacity)
                }
            } else if let only = allTiles.first {
                strip([only], quiet: false)
            } else {
                startRow
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
                        .overlay(Circle().stroke(FriendsInk.nightCard ?? Color.white, lineWidth: 2))
                        .offset(x: 2, y: 2)
                }
            }
            .frame(width: 52, height: 52)
    }

    // MARK: Game tiles

    /// Up to four tiles share one row; five or six wrap into a three-across grid so no tile is ever
    /// sliced by the card edge (the old sideways scroller cut the fifth one mid-tile).
    @ViewBuilder private func strip(_ tiles: [GameTile], quiet: Bool) -> some View {
        if tiles.count <= 4 {
            HStack(spacing: 8) {
                ForEach(tiles) { t in tileButton(t, quiet: quiet).frame(maxWidth: 104) }
            }
            .frame(maxWidth: .infinity)
        } else {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(tiles) { t in tileButton(t, quiet: quiet) }
            }
        }
    }

    private func tileButton(_ t: GameTile, quiet q: Bool) -> some View {
        let quiet = q || !t.yourTurn
        return ZStack(alignment: .topTrailing) {
            if confirming == t.gameId {
                resignConfirm(t)
            } else {
                tileFace(t, quiet: quiet)
                if onResign != nil, games[t.gameId] != nil { resignFlag(t) }
            }
        }
        .animation(Theme.reduceMotion ? nil : .easeInOut(duration: 0.16), value: confirming)
    }

    /// The small flag in the tile's corner (a 30 pt hit area around a 22 pt coin).
    private func resignFlag(_ t: GameTile) -> some View {
        Button {
            Haptics.tap()
            confirming = t.gameId
        } label: {
            ZStack {
                Circle().fill(FriendsInk.dark ? Color.black.opacity(0.30) : Color.white.opacity(0.85))
                Circle().strokeBorder(FriendsInk.pink.opacity(0.45), lineWidth: 1)
                FamClayIcon(name: "flag", size: 12, ink: FriendsInk.pink)
            }
            .frame(width: 22, height: 22)
            .frame(width: 30, height: 30)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
        .offset(x: 3, y: -3)
        .accessibilityLabel("Resign \(t.kind.title) against \(card.name)")
    }

    /// The tile turned over: "Resign Ghost?", then Keep and Resign side by side, in the tile's own frame.
    private func resignConfirm(_ t: GameTile) -> some View {
        VStack(spacing: 6) {
            FamClayIcon(name: "flag", size: 20, ink: FriendsInk.pink)
            Text("Resign \(t.kind.title)?").font(Brand.font(12, .black)).foregroundStyle(FriendsInk.heading)
                .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.75)
            Text("They win this one").font(Brand.font(10, .bold)).foregroundStyle(FriendsInk.rowSub)
                .lineLimit(1).minimumScaleFactor(0.8)
            HStack(spacing: 5) {
                Button { confirming = nil } label: {
                    Text("Keep").font(Brand.font(11.5, .black)).foregroundStyle(FriendsInk.lavender)
                        .frame(maxWidth: .infinity).frame(height: 26)
                        .background(Capsule().fill(FriendsInk.lavender.opacity(0.18)))
                }
                .buttonStyle(.squishCard)
                Button {
                    confirming = nil
                    if let g = games[t.gameId] { onResign?(g) }
                } label: {
                    Text("Resign").font(Brand.font(11.5, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 26)
                        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF472B6), Color(hex: 0xDB2777)],
                                                                   startPoint: .top, endPoint: .bottom)))
                }
                .buttonStyle(.squishCard)
            }
        }
        .padding(.vertical, 8).padding(.horizontal, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FriendsInk.pink.opacity(0.14)))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(FriendsInk.pink.opacity(0.35), lineWidth: 1))
        .transition(.opacity)
    }

    private func tileFace(_ t: GameTile, quiet: Bool) -> some View {
        Button {
            if let g = games[t.gameId] { onOpenGame(g) }
        } label: {
            // Founder 10-09: the game's NAME, then what waits in plain words (two lines), never a cryptic two-word state.
            VStack(spacing: 3) {
                gameArt(t.kind, size: 34)
                Text(t.kind.title).font(Brand.font(12, .black))
                    .foregroundStyle(quiet ? FriendsInk.rowSub : FriendsInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.65)
                Text(t.word).font(Brand.font(10.5, .bold))
                    .foregroundStyle(quiet ? FriendsInk.rowSub : FriendsInk.heading.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .lineLimit(2).minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            .padding(.vertical, 8).padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(FriendsKit.tileAccent(t.kind).vsWash(quiet ? 0.07 : 0.14)))
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
                            .fill(FriendsKit.tileAccent(k).vsWash(0.10)))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.squishCard)
                .accessibilityLabel("Play \(k.title) with \(card.name)")
            }
        }
    }

    /// The folded games: their art overlapping, "3 games · 2 your turn", and a chevron. Tap opens the tiles.
    private var gamesDropdown: some View {
        let mine = card.tiles.count
        let n = allTiles.count
        let line = mine > 0 ? "\(n) games · \(mine) your turn" : "\(n) games · waiting on \(card.name)"
        return Button(action: onToggleTheirs) {
            HStack(spacing: 10) {
                HStack(spacing: -10) {
                    ForEach(Array(allTiles.prefix(4).enumerated()), id: \.element.id) { i, t in
                        gameArt(t.kind, size: 26)
                            .padding(4)
                            .background(Circle().fill(FriendsKit.tileAccent(t.kind).vsWash(0.22)))
                            .background(Circle().fill(FriendsInk.nightCard ?? Color.white))
                            .zIndex(Double(10 - i))
                    }
                }
                VStack(alignment: .leading, spacing: 1) {
                    // The header already says how many wait on you; the dropdown names the games (no repeat).
                    Text("Pick a game").font(Brand.font(13, .black))
                        .foregroundStyle(FriendsInk.heading).lineLimit(1).minimumScaleFactor(0.8)
                    if !expanded {
                        Text(allTiles.prefix(3).map { $0.kind.title }.joined(separator: ", ") + (n > 3 ? " and more" : ""))
                            .font(Brand.font(10.5, .bold)).foregroundStyle(FriendsInk.rowSub)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.down").font(.system(size: 11, weight: .black))
                    .foregroundStyle(accent)
                    .rotationEffect(.degrees(expanded ? 180 : 0))
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(accent.opacity(0.16)))
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(accent.opacity(0.10)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
        .accessibilityLabel(line)
        .accessibilityHint(expanded ? "Hides the games" : "Shows the games to pick from")
    }

    @ViewBuilder private func gameArt(_ k: FriendlyKind, size: CGFloat) -> some View {
        if let art = k.pocketArt {
            GameArtImage(asset: art, size: size)
        } else {
            FriendlyGameIcon(kind: k, size: size, tinted: true)
        }
    }
}
