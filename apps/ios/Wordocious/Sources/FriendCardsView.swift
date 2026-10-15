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

    /// Founder 10-15 (design A + B's waiting chip, docs/design/review/friends-cards-1015/SPEC.md): one slim row per game,
    /// your turn first; at most three, then a quiet "+N more" row that opens the rest.
    private static let rowLimit = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if allTiles.isEmpty {
                startRow
            } else {
                let shown = expanded ? allTiles : Array(allTiles.prefix(Self.rowLimit))
                VStack(spacing: 6) {
                    ForEach(shown) { t in gameRow(t) }
                    if allTiles.count > Self.rowLimit { moreRow(allTiles.count - Self.rowLimit) }
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .friendsCard(accent: accent, radius: 18, tint: 0.07, line: 0.2)   // founder 10-10: no top bar (page was busy)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            Button(action: onProfile) {
                HStack(spacing: 10) {
                    avatar
                    VStack(alignment: .leading, spacing: 2) {
                        FriendsName(name: card.name, size: 16)
                        if let p = card.presence {
                            HStack(spacing: 4) {
                                Circle().fill(FriendsInk.online).frame(width: 7, height: 7)
                                Text(p).font(Brand.font(11, .heavy)).foregroundStyle(FriendsKit.green)
                                    .lineLimit(1)
                            }
                        }
                        if card.presence == nil && !allTiles.isEmpty {
                            // The gold row says which game waits on you; the header only counts them.
                            Text(allTiles.count == 1 ? "1 GAME" : "\(allTiles.count) GAMES")
                                .font(Brand.fixedFont(10.5, .heavy)).tracking(0.6).foregroundStyle(FriendsInk.muted)
                                .lineLimit(1)
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
        AvatarView(url: friend?.avatar_url ?? fallbackOpponent?.avatarUrl, username: card.name, size: 44,
                   emoji: friend?.avatar_emoji ?? fallbackOpponent?.avatarEmoji,
                   castId: friend?.avatar_cast_id, frame: friend?.avatar_frame,
                   userId: friend?.id ?? fallbackOpponent?.id, stroke: false)
            .overlay(alignment: .bottomTrailing) {
                if card.online {
                    Circle().fill(FriendsInk.online).frame(width: 11, height: 11)
                        .overlay(Circle().stroke(FriendsInk.nightCard ?? Color.white, lineWidth: 2))
                        .offset(x: 2, y: 2)
                }
            }
            .frame(width: 44, height: 44)
    }

    // MARK: Game rows (design A)

    private static let turnGold = Color(hex: 0xFFC83D)

    /// One slim row: the game's coin, its CAPS name over what waits, then the YOUR TURN / WAITING chip and the resign flag.
    @ViewBuilder private func gameRow(_ t: GameTile) -> some View {
        ZStack {
            if confirming == t.gameId {
                rowResignConfirm(t)
            } else {
                HStack(spacing: 6) {
                    Button {
                        if let g = games[t.gameId] { onOpenGame(g) }
                    } label: {
                        HStack(spacing: 10) {
                            GameCoin(kind: t.kind, size: 34)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(t.kind.title.uppercased()).font(Brand.fixedFont(12.5, .black)).tracking(0.3)
                                    .foregroundStyle(FriendsInk.heading).lineLimit(1).minimumScaleFactor(0.75)
                                Text(t.word).font(Brand.fixedFont(11, .bold))
                                    .foregroundStyle(t.yourTurn ? Color(hex: 0xFFD45A) : FriendsInk.muted)
                                    .lineLimit(1).minimumScaleFactor(0.8)
                            }
                            Spacer(minLength: 4)
                            if t.yourTurn { yourTurnChip } else { waitingChip }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.squishCard)
                    .accessibilityLabel("\(t.kind.title), \(t.word)")
                    if onResign != nil, games[t.gameId] != nil { resignFlag(t).offset(x: -3, y: 3) }
                }
            }
        }
        .padding(.leading, 8).padding(.trailing, 4)
        .frame(maxWidth: .infinity, minHeight: 50)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(t.yourTurn ? Self.turnGold.opacity(0.12) : (FriendsInk.dark ? Color.white.opacity(0.06) : FriendsInk.lavender.opacity(0.10)))
                .shadow(color: t.yourTurn ? Self.turnGold.opacity(0.40) : .clear, radius: 8)
        }
        .animation(Theme.reduceMotion ? nil : .easeInOut(duration: 0.16), value: confirming)
    }

    /// The gold glossy capsule on a game that waits on you.
    private var yourTurnChip: some View {
        Text("YOUR TURN").font(Brand.fixedFont(10.5, .black)).tracking(0.4)
            .foregroundStyle(Color(hex: 0x5A3200)).lineLimit(1).fixedSize()
            .padding(.horizontal, 10).frame(height: 24)
            .background(
                Capsule().fill(LinearGradient(colors: [Color(hex: 0xFFE58A), Color(hex: 0xF5B21B)], startPoint: .top, endPoint: .bottom))
                    // the glossy top highlight (fades out by the middle: a sheen, not an outline)
                    .overlay(Capsule().strokeBorder(LinearGradient(colors: [Color.white.opacity(0.35), Color.white.opacity(0)],
                                                                   startPoint: .top, endPoint: .center), lineWidth: 1))
            )
            .accessibilityHidden(true)
    }

    /// B's dim chip on a game that waits on them.
    private var waitingChip: some View {
        HStack(spacing: 4) {
            Image(systemName: "clock").font(.system(size: 9, weight: .bold))
            Text("WAITING").font(Brand.fixedFont(10, .heavy)).tracking(0.5)
        }
        .foregroundStyle(FriendsInk.muted).lineLimit(1).fixedSize()
        .padding(.horizontal, 9).frame(height: 22)
        .background(Capsule().fill(FriendsInk.dark ? Color.white.opacity(0.08) : FriendsInk.lavender.opacity(0.14)))
        .accessibilityHidden(true)
    }

    /// The row turned over: "Resign Ghost? They win this one" then Keep / Resign, inside the row's height.
    private func rowResignConfirm(_ t: GameTile) -> some View {
        HStack(spacing: 8) {
            FamClayIcon(name: "flag", size: 16, ink: FriendsInk.pink)
            VStack(alignment: .leading, spacing: 0) {
                Text("Resign \(t.kind.title)?").font(Brand.fixedFont(12, .black)).foregroundStyle(FriendsInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.75)
                Text("They win this one").font(Brand.fixedFont(10, .bold)).foregroundStyle(FriendsInk.rowSub).lineLimit(1)
            }
            Spacer(minLength: 4)
            Button { confirming = nil } label: {
                Text("Keep").font(Brand.fixedFont(11, .black)).foregroundStyle(FriendsInk.lavender)
                    .padding(.horizontal, 12).frame(height: 26)
                    .background(Capsule().fill(FriendsInk.lavender.opacity(0.18)))
            }
            .buttonStyle(.squishCard)
            Button {
                confirming = nil
                if let g = games[t.gameId] { onResign?(g) }
            } label: {
                Text("Resign").font(Brand.fixedFont(11, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 12).frame(height: 26)
                    .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF472B6), Color(hex: 0xDB2777)],
                                                               startPoint: .top, endPoint: .bottom)))
            }
            .buttonStyle(.squishCard)
        }
        .padding(.trailing, 4)
        .transition(.opacity)
    }

    /// More than three games: a quiet row that opens (and folds) the rest.
    private func moreRow(_ n: Int) -> some View {
        Button(action: onToggleTheirs) {
            HStack(spacing: 6) {
                Text(expanded ? "Show fewer" : "+\(n) more").font(Brand.fixedFont(11.5, .black)).foregroundStyle(FriendsInk.lavender)
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .black)).foregroundStyle(FriendsInk.lavender)
                    .rotationEffect(.degrees(expanded ? 180 : 0))
            }
            .frame(maxWidth: .infinity).frame(height: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
        .accessibilityLabel(expanded ? "Show fewer games" : "\(n) more games")
    }

    // MARK: Pieces

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

    @ViewBuilder private func gameArt(_ k: FriendlyKind, size: CGFloat) -> some View {
        if let art = k.pocketArt {
            GameArtImage(asset: art, size: size)
        } else {
            FriendlyGameIcon(kind: k, size: size, tinted: true)
        }
    }
}

/// Design A's game coin (founder 10-15): a glossy round plate in the game's accent (light top-left, darker rim, a white
/// gloss) with the game's art centered. Drawn once (static gradients), no per-frame work.
struct GameCoin: View {
    let kind: FriendlyKind
    var size: CGFloat = 34

    var body: some View {
        let accent = FriendsKit.tileAccent(kind)
        ZStack {
            Circle().fill(accent)
            Circle().fill(RadialGradient(colors: [Color.white.opacity(0.38), Color.white.opacity(0)],
                                         center: UnitPoint(x: 0.35, y: 0.3), startRadius: 0, endRadius: size * 0.55))
            Circle().fill(Color.black.opacity(0.18)).mask(
                Circle().strokeBorder(lineWidth: size * 0.09).blur(radius: size * 0.04))
            Ellipse().fill(Color.white.opacity(0.22))
                .frame(width: size * 0.62, height: size * 0.32)
                .offset(y: -size * 0.2)
            Group {
                if let art = kind.pocketArt { GameArtImage(asset: art, size: size * 0.64) }
                else { FriendlyGameIcon(kind: kind, size: size * 0.64, tinted: false) }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
