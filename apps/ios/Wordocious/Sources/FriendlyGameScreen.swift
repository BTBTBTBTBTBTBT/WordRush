import SwiftUI
import WordociousCore

/// One pocket game with a friend (Friends overhaul, founder 2026-10-01; spec
/// docs/FRIENDS_REDESIGN_SPEC.md §4, §9, board AE): Rock Paper Scissors,
/// Tic-Tac-Tile, Call It, Pass the Puzzle, Ghost or Word Chain. The server runs the rules; this
/// screen polls GET /api/friends/games/<id> every 2 s while open (live play
/// when both are on — the poll also marks you as watching, so moves reach you
/// without a push), sends moves, retries on 409 and offers RESIGN in the close
/// confirm. Over: REMATCH (same game, same friend) and FRIENDS.
struct FriendlyGameScreen: View {
    @State private var gameId: String
    @State private var game: FriendlyGameView?
    @Environment(\.dismiss) private var dismiss

    @State private var loadError: String?
    @State private var sending = false
    @State private var moveError: String?
    @State private var passInput = ""
    /// Ghost: the letter in the dashed tile, played by ADD <L> (a stray tap can't lose a round).
    @State private var ghostPending: String?
    /// Word Chain: the letters typed after the locked first letter.
    @State private var chainTyped = ""
    @State private var confirmClose = false
    @State private var rematching = false

    init(gameId: String, initial: FriendlyGameView? = nil) {
        _gameId = State(initialValue: gameId)
        _game = State(initialValue: initial)
    }

    /// The bed under the pinned keyboards: the Friends wallpaper's top color (§A1 —
    /// no plain white).
    static var keyboardBed: Color { PageTint.friends.barColor }

    /// The load error for a game that no longer exists (its scene is O3 not found).
    private static let goneLine = "This game isn't here anymore."

    private var kind: FriendlyKind? { game?.kind }
    private var themName: String { game?.opponent.username ?? "Friend" }
    private var themOnline: Bool { game.flatMap { FriendsKit.friend($0.opponent.id) }?.isOnline() ?? false }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            if let g = game {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 16) {
                            // Game over: a win → O3 pops in; a loss → R (MASCOT_SPEC §3).
                            if !g.isActive, let outcome = Self.resultOutcome(g) {
                                ResultHost(outcome: outcome, winner: Mascots.pocketWin)
                            }
                            scoreWindow(g)
                            board(g)
                            if let moveError, !pinsInput(g) { errorText(moveError) }
                            if !g.isActive { overButtons(g) }
                        }
                        .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 24)
                    }
                    // Word Chain: keep the newest word in view.
                    .onChange(of: chainCount(g)) { _ in
                        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("chain-end", anchor: .bottom) }
                    }
                }
                if g.isActive, case .pass(let p) = g.state { passKeyboard(g, p) }
                if g.isActive, case .ghost(let gs) = g.state { ghostKeyboard(g, gs) }
                if g.isActive, case .chain(let c) = g.state { chainInputArea(g, c) }
            } else if let loadError {
                Spacer()
                // O3 when the game is gone, R unplugged for any other error
                // (MASCOT_SPEC §6, ART_SPEC §7); BI24: brand headline + voice line + candy.
                let gone = loadError == Self.goneLine
                BrandEmptyState(title: gone ? "Game not found" : "Can't load this game", line: loadError,
                                scene: gone ? .notFound : .unplugged, colors: [Color(hex: 0xDB2777), Color(hex: 0x7C3AED)],
                                lineColor: FriendsInk.heading,
                                actionTitle: "Friends", actionSymbol: "chevron.left", actionVariant: .pink,
                                action: { dismiss() }, heading: gone ? .notfound : .oops)   // BJ16
                Spacer()
            } else {
                Spacer()
                CastLoader(label: "LOADING GAME", labelColor: FriendsInk.bannerLabel, tipColor: FriendsInk.bannerLabel)
                Spacer()
            }
        }
        // §A1: the Friends wallpaper (light, like the Friends tab), never plain white.
        .background(PageBackground(tint: .friends, lightOnly: true).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task(id: gameId) { await poll() }
        .confirmationDialog("Leave this game?", isPresented: $confirmClose, titleVisibility: .visible) {
            Button("Close — it waits for you") { dismiss() }
            Button("Resign", role: .destructive) { resign() }
            Button("Keep playing", role: .cancel) {}
        } message: {
            Text("Resigning hands \(themName) the win.")
        }
    }

    // MARK: Data

    private func poll() async {
        while !Task.isCancelled {
            await refresh()
            // Over: one last read is enough — the result won't change.
            if let g = game, !g.isActive { return }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
        }
    }

    private func refresh() async {
        switch await FriendlyGamesService.get(gameId) {
        case .success(let g): apply(g)
        case .failure(.message(let m)): if game == nil { loadError = m == "Not found" ? Self.goneLine : m }
        case .failure: if game == nil { loadError = "Could not load the game." }
        }
    }

    /// Take a newer view (a slow poll never rolls a fresh move back).
    private func apply(_ g: FriendlyGameView) {
        guard g.id == gameId else { return }
        if let cur = game, cur.updatedAt > g.updatedAt { return }
        if game != g {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { game = g }
        }
    }

    private func send(_ m: FriendlyMove) {
        guard let g = game, g.isActive, !sending else { return }
        sending = true
        moveError = nil
        Task {
            let r = await FriendlyGamesService.move(g.id, m)
            sending = false
            switch r {
            case .success(let ng):
                apply(ng)
                switch m {
                case .pass: passInput = ""
                case .ghost: ghostPending = nil
                case .chain: chainTyped = ""
                default: break
                }
                if !ng.isActive { ng.result == "win" ? Haptics.success() : Haptics.tap() } else { Haptics.tap() }
            case .failure(.retry):
                moveError = "The game moved on — try again"
                await refresh()
            case .failure(.message(let msg)):
                moveError = msg
                Haptics.error()
            case .failure(.network):
                moveError = "Network error — try again"
            }
        }
    }

    private func resign() {
        guard let g = game else { return }
        Task {
            if case .success(let ng) = await FriendlyGamesService.resign(g.id) { apply(ng) }
        }
    }

    private func rematch(_ g: FriendlyGameView) {
        guard !rematching else { return }
        rematching = true
        moveError = nil
        Task {
            let stake: String? = { if case .coin(let c) = g.state { return c.stake }; return nil }()
            let r = await FriendlyGamesService.start(kind: g.kind, friendId: g.opponent.id, stake: stake)
            rematching = false
            switch r {
            case .success(let ng):
                passInput = ""
                ghostPending = nil
                chainTyped = ""
                gameId = ng.id
                withAnimation { game = ng }
            case .failure(.message(let m)): moveError = m
            case .failure: moveError = "Could not start a rematch — try again"
            }
        }
    }

    // MARK: Top bar

    private var topBar: some View {
        ZStack {
            HStack(spacing: 6) {
                // ART_SPEC §9: the pocket game's 3D icon beside its title.
                if let kind, kind.pocketArt != nil { FriendlyGameIcon(kind: kind, size: 26, glow: false) }
                Text((game?.title ?? "").uppercased())
                    .font(Brand.font(19, .black)).tracking(0.4)
                    .foregroundStyle(LinearGradient(colors: kind.map(FriendsKit.gradient) ?? FriendsKit.titleGradient,
                                                    startPoint: .leading, endPoint: .trailing))
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .padding(.horizontal, 48)
            HStack {
                HeaderCircleButton(.symbol("xmark"), label: "Close") {
                    if game?.isActive == true { confirmClose = true } else { dismiss() }
                }
                Spacer()
            }
        }
        .padding(.horizontal, 8).padding(.top, 4).frame(height: 48)
    }

    // MARK: Score window

    private func scoreWindow(_ g: FriendlyGameView) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let won = g.result == "win"
        let profile = AuthService.shared.profile
        let score = g.state.score
        let accent = FriendsKit.tileAccent(g.kind)
        return VStack(spacing: 0) {
            // §A1: the game's own top bar.
            LinearGradient(colors: [accent, accent.mixed(over: .white, 0.6)], startPoint: .leading, endPoint: .trailing)
                .frame(height: 6)
            VStack(alignment: .leading, spacing: 4) {
                Text(headline(g))
                    .font(Brand.font(18, .black)).tracking(0.4).foregroundStyle(FriendsInk.bannerHead)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text(subLine(g)).font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(FriendsInk.bannerLabel)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(FriendsInk.pink.wash(0.08))
            HStack(spacing: 0) {
                half(label: "YOU", url: profile?.avatarUrl, name: profile?.username ?? "You", emoji: profile?.avatarEmoji,
                     score: score?[g.me], online: false, leading: true, toPlay: toPlay(g, g.me))
                half(label: "@\(themName.uppercased())", url: g.opponent.avatarUrl, name: themName, emoji: g.opponent.avatarEmoji,
                     score: score?[g.me.other], online: themOnline && g.isActive, leading: false, toPlay: toPlay(g, g.me.other))
            }
        }
        .background {
            ZStack {
                // Your half lavender, theirs amber — deeper on the match winner's side.
                HStack(spacing: 0) {
                    Color(hex: won ? 0xDDD6FE : 0xEDE9FE)
                    Color(hex: g.result == "loss" ? 0xFDE68A : 0xFEF3C7)
                }
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                if won && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
            }
        }
        .clipShape(shape)
        .overlay(shape.stroke(accent.wash(0.30), lineWidth: 1.5).allowsHitTesting(false))
        .shadow(color: won ? FriendsKit.purple.opacity(0.35) : FriendsKit.ink.opacity(0.08), radius: won ? 10 : 7, x: 0, y: 4)
    }

    /// The finished game's result for its host; nil when there is none (expired).
    static func resultOutcome(_ g: FriendlyGameView) -> ResultHost.Outcome? {
        switch g.result {
        case "win"?: return .win
        case "loss"?: return .loss
        case "draw"?: return .draw
        default: return nil
        }
    }

    /// Core headline; an expired game reads GAME EXPIRED and a resignation
    /// says who resigned (web/Android parity).
    private func headline(_ g: FriendlyGameView) -> String {
        if g.status == "expired" { return "GAME EXPIRED" }
        if g.status == "resigned" { return g.result == "win" ? "THEY RESIGNED" : "YOU RESIGNED" }
        return FriendlyGames.friendlyHeadline(g.state, me: g.me)
    }

    /// Whose half wears TO PLAY: the side to move (an open RPS round: whoever hasn't picked).
    private func toPlay(_ g: FriendlyGameView, _ side: FriendlySide) -> Bool {
        guard g.isActive else { return false }
        if case .rps(let r) = g.state { return r.picks[side] == nil }
        return FriendlyGames.whoseTurn(g.state)?.rawValue == side.rawValue
    }

    private func half(label: String, url: String?, name: String, emoji: String?, score: Int?, online: Bool, leading: Bool, toPlay: Bool) -> some View {
        HStack(spacing: 10) {
            if !leading { Spacer(minLength: 0) }
            if leading { FriendsPresenceAvatar(url: url, username: name, emoji: emoji, size: 40, online: online) }
            VStack(alignment: leading ? .leading : .trailing, spacing: 0) {
                Text(label).font(Brand.font(10, .black)).tracking(0.8)
                    .foregroundStyle(leading ? FriendsKit.purple : Color(hex: 0xB45309)).lineLimit(1).minimumScaleFactor(0.7)
                if toPlay {
                    Text("TO PLAY").font(Brand.font(8.5, .black)).tracking(0.6).foregroundStyle(.white)
                        .padding(.horizontal, 6).frame(height: 15)
                        .background(Capsule().fill(leading ? FriendsKit.purple : FriendsKit.amber))
                        .padding(.top, 2)
                }
                if let score {
                    // §A2: the score as a soft number.
                    Text("\(score)").softNumber(34, color: leading ? VsLobbyKit.numberInk : (FriendsInk.dark ? Color(hex: 0xFCD34D) : Color(hex: 0x78350F)))
                        .contentTransition(.numericText())
                }
            }
            if !leading { FriendsPresenceAvatar(url: url, username: name, emoji: emoji, size: 40, online: online) }
            if leading { Spacer(minLength: 0) }
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
        .frame(maxWidth: .infinity)
    }

    /// Best-of, live while they're on, and the last round's result.
    private func subLine(_ g: FriendlyGameView) -> String {
        var parts: [String] = []
        switch g.state {
        case .rps: parts.append("BEST OF 3")
        case .ttt(let t): parts.append("BEST OF 3 · GAME \(min(t.games.count + 1, 5))")
        case .coin: parts.append("BEST OF 5")
        case .pass: parts.append("ONE BOARD · SIX GUESSES")
        case .ghost: parts.append("BEST OF 3")
        case .chain: parts.append("FIRST TO \(FriendlyGames.chainTarget)")
        }
        if g.status == "resigned" || g.status == "expired" { return (parts + [g.line.uppercased()]).joined(separator: " · ") }
        if g.isActive && themOnline { parts.append("LIVE · \(themName.uppercased()) IS ON") }
        let me = g.me
        switch g.state {
        case .rps(let r):
            if let last = r.rounds.last {
                let n = r.rounds.count
                parts.append(last.winner == nil ? "ROUND \(n) TIED" : last.winner == me ? "YOU TOOK ROUND \(n)" : "\(themName.uppercased()) TOOK ROUND \(n)")
            }
        case .ttt(let t):
            if let last = t.games.last {
                parts.append(last.winner == nil ? "LAST GAME DRAWN" : last.winner == me ? "YOU TOOK GAME \(t.games.count)" : "\(themName.uppercased()) TOOK GAME \(t.games.count)")
            }
        case .coin(let c):
            if let last = c.rounds.last { parts.append("LANDED \(last.flip.rawValue.uppercased())") }
        case .pass: break
        case .ghost(let gs):
            if let last = gs.rounds.last {
                let n = gs.rounds.count
                parts.append(last.loser == me ? "\(themName.uppercased()) TOOK ROUND \(n)" : "YOU TOOK ROUND \(n)")
            }
        case .chain(let c):
            if let last = c.words.last {
                parts.append("\(last.by == me ? "YOU" : themName.uppercased()) PLAYED \(last.word) +\(last.points)")
            }
        }
        return parts.joined(separator: " · ")
    }

    // MARK: Boards

    @ViewBuilder private func board(_ g: FriendlyGameView) -> some View {
        switch g.state {
        case .rps(let r): rpsBoard(g, r)
        case .ttt(let t): tttBoard(g, t)
        case .coin(let c): coinBoard(g, c)
        case .pass(let p): passBoard(g, p)
        case .ghost(let gs): ghostBoard(g, gs)
        case .chain(let c): chainBoard(g, c)
        }
    }

    /// Ghost and Word Chain pin their input (and its inline error) above the keyboard.
    private func pinsInput(_ g: FriendlyGameView) -> Bool {
        guard g.isActive else { return false }
        return g.kind == .ghost || g.kind == .chain
    }

    /// §L: the board's tray state — won (purple) / lost (slate) once the match is over.
    private func trayState(_ g: FriendlyGameView) -> GameTrayState {
        guard !g.isActive else { return .normal }
        switch g.result {
        case "win"?: return .won
        case "loss"?: return .lost
        default: return .normal
        }
    }

    /// §BI22: the pinned inputs' move-error slot is always there (one candy line,
    /// empty when there's no error) — the message used to grow the pinned area and
    /// push the board up. Sized by the message's own chrome, never overlapping keys.
    private var errorSlot: some View {
        ZStack {
            G5CandyMessage(text: "Ag", tone: .error).hidden().accessibilityHidden(true)
            if let moveError { errorText(moveError) }
        }
        .frame(maxWidth: .infinity)
        .animation(.easeOut(duration: 0.2), value: moveError)
    }

    private func errorText(_ m: String) -> some View {
        // §BI9: the calm candy message (coral coin, one shake), not bare red text.
        G5CandyMessage(text: m, tone: .error)
            .id(m)
            .transition(.opacity)
    }

    private func chainCount(_ g: FriendlyGameView) -> Int {
        if case .chain(let c) = g.state { return c.words.count }
        return 0
    }

    // Rock Paper Scissors

    private func art(_ p: RpsPick) -> String { "friends-\(p.rawValue)" }

    @ViewBuilder private func rpsBoard(_ g: FriendlyGameView, _ r: RpsState) -> some View {
        let me = g.me
        let mine = r.picks[me]?.pick
        let theirs = r.picks[me.other]
        VStack(spacing: 14) {
            if let last = r.rounds.last {
                RpsReveal(round: r.rounds.count, mine: last[me], theirs: last[me.other],
                          winner: last.winner.map { $0 == me ? 1 : 2 } ?? 0, them: themName)
                    .id(r.rounds.count)
                    .frame(maxWidth: .infinity)
                    .gameTray(accent: FriendsKit.tileAccent(.rps), state: g.isActive ? .normal : trayState(g))
            }
            if g.isActive {
                VStack(spacing: 6) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(LinearGradient(colors: [Color(hex: 0xFBCFE8), Color(hex: 0xDDD6FE)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.7), style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                            .padding(8)
                        Text("?").font(Brand.font(44, .black)).foregroundStyle(.white)
                    }
                    .frame(width: 92, height: 112)
                    .shadow(color: FriendsKit.ink.opacity(0.12), radius: 6, y: 3)
                    if theirs != nil {
                        Text("✓ \(themName.uppercased()) PICKED").font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(FriendsKit.green)
                    } else {
                        Text("\(themName.uppercased()) IS PICKING…").font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(FriendsInk.muted)
                    }
                }
                VStack(spacing: 8) {
                    FriendsLabel("Your pick", color: FriendsInk.section)
                    HStack(spacing: 10) {
                        ForEach(RpsPick.allCases, id: \.self) { p in
                            let selected = mine == p
                            let rps = FriendsKit.tileAccent(.rps)
                            Button { send(.rps(p)) } label: {
                                VStack(spacing: 4) {
                                    Image(art(p)).resizable().interpolation(.high).scaledToFit().frame(width: 70, height: 70)
                                        .accessibilityHidden(true)   // §AB: the word below names it
                                    Text(p.rawValue.uppercased()).font(Brand.font(11, .black)).tracking(0.6)
                                        .foregroundStyle(selected ? .white : FriendsInk.heading)
                                }
                                .frame(maxWidth: .infinity).frame(height: 114)
                                // §A1: tinted pick cards (selected = filled purple).
                                .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(selected ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xA66BFF), FriendsKit.purple], startPoint: .top, endPoint: .bottom))
                                                   : AnyShapeStyle(rps.wash(0.13)))
                                    .shadow(color: selected ? FriendsKit.purple.opacity(0.55) : rps.opacity(0.18),
                                            radius: selected ? 9 : 5, y: 3))
                                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(selected ? Color(hex: 0x6D28D9) : rps.wash(0.34), lineWidth: 1.5))
                                .opacity(mine != nil && !selected ? 0.45 : 1)
                            }
                            .buttonStyle(.squish)
                            .disabled(mine != nil || sending)
                            .accessibilityLabel(p.rawValue.capitalized)
                            .accessibilityAddTraits(selected ? .isSelected : [])
                        }
                    }
                    .gameTray(accent: FriendsKit.tileAccent(.rps), state: trayState(g))
                    Text(mine != nil ? "Locked in. Both picks flip at once." : "Both picks flip at once.")
                        .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                }
            }
        }
    }

    // Tic-Tac-Tile

    @ViewBuilder private func tttBoard(_ g: FriendlyGameView, _ t: TttState) -> some View {
        let me = g.me
        let myMove = g.isActive && g.yourTurn
        // §J2: the winning three glow.
        let line = Set(FriendlyGames.tttLine(t.board)?.cells ?? [])
        let accent = FriendsKit.tileAccent(.ttt)
        VStack(spacing: 12) {
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(92), spacing: 10), count: 3), spacing: 10) {
                ForEach(0..<9, id: \.self) { i in
                    let mark = t.board[i]
                    let wins: Bool = {
                        guard myMove, mark == nil else { return false }
                        var b = t.board; b[i] = me
                        return FriendlyGames.tttLine(b) != nil
                    }()
                    Button { send(.ttt(i)) } label: {
                        tttCell(mark: mark, mine: mark == me, wins: wins, glow: line.contains(i))
                    }
                    .buttonStyle(.squish)
                    .disabled(!myMove || mark != nil || sending)
                    .accessibilityLabel(mark == nil ? "Empty tile \(i + 1)" : mark == me ? "Your tile" : "\(themName)'s tile")
                }
            }
            // §L: the board sits on the shared tray (no grid lines).
            .gameTray(accent: accent, state: trayState(g))
            HStack(spacing: 16) {
                pieceLegend("YOU · X", piece: "art-piece-ttt-x", fallback: FriendsKit.purple)
                pieceLegend("\(themName.uppercased()) · O", piece: "art-piece-ttt-o", fallback: FriendsInk.pink)
            }
        }
    }

    /// One Tic-Tac-Tile cell: an empty frosted tile (dashed purple when it would
    /// win), or the glossy X (yours, purple) / O (theirs, pink) piece art that drops
    /// in with the type pop (§J2); the winning three glow.
    private func tttCell(mark: FriendlySide?, mine: Bool, wins: Bool, glow: Bool) -> some View {
        let side: CGFloat = 92
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        let tint = mine ? FriendsKit.purple : FriendsInk.pink
        return ZStack {
            if mark != nil {
                shape.fill(tint.wash(0.16))
                shape.stroke(tint.wash(glow ? 0.9 : 0.4), lineWidth: glow ? 2.5 : 1.5)
                tttPiece(mine: mine)
                    .padding(10)
                    .shadow(color: glow ? tint.opacity(0.75) : .clear, radius: glow ? 12 : 0)
            } else {
                GlossyTile(face: .empty, width: side)
                if wins {
                    shape.strokeBorder(FriendsKit.purple, style: StrokeStyle(lineWidth: 2.5, dash: [6, 4]))
                }
            }
        }
        .frame(width: side, height: side)
        .shadow(color: glow ? tint.opacity(0.45) : .clear, radius: glow ? 10 : 0)
        .modifier(TypePop(letter: mark == nil ? "" : "x", size: CGSize(width: side, height: side)))
    }

    /// The X / O piece art (falls back to the old drawn glyph when missing).
    @ViewBuilder private func tttPiece(mine: Bool) -> some View {
        let name = mine ? "art-piece-ttt-x" : "art-piece-ttt-o"
        if ArtAsset.exists(name) {
            Image(name).resizable().interpolation(.high).scaledToFit().accessibilityHidden(true)
        } else {
            Image(systemName: mine ? "xmark" : "circle")
                .font(.system(size: 40, weight: .heavy))
                .foregroundStyle(mine ? FriendsKit.purple : FriendsInk.pink)
        }
    }

    private func pieceLegend(_ text: String, piece: String, fallback: Color) -> some View {
        HStack(spacing: 5) {
            if ArtAsset.exists(piece) {
                Image(piece).resizable().interpolation(.high).scaledToFit().frame(width: 16, height: 16)
                    .accessibilityHidden(true)
            } else {
                RoundedRectangle(cornerRadius: 4).fill(fallback).frame(width: 12, height: 12)
            }
            Text(text).font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(FriendsInk.muted).lineLimit(1)
        }
    }

    private func legend(_ text: String, _ c: Color) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 4).fill(c).frame(width: 12, height: 12)
            Text(text).font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(FriendsInk.muted).lineLimit(1)
        }
    }

    // Call It

    @ViewBuilder private func coinBoard(_ g: FriendlyGameView, _ c: CoinState) -> some View {
        let myCall = g.isActive && g.yourTurn
        VStack(spacing: 14) {
            // §L: the coin sits on the shared tray.
            VStack(spacing: 8) {
                SpinningCoin(face: c.rounds.last?.flip ?? .heads, spinKey: c.rounds.count)
                if let last = c.rounds.last {
                    let who = last.caller == g.me ? "You" : themName
                    Text("\(who) called \(last.call.rawValue) · it landed \(last.flip.rawValue)")
                        .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                }
            }
            .frame(maxWidth: .infinity)
            .gameTray(accent: FriendsKit.tileAccent(.coin), state: trayState(g))
            if g.isActive {
                if myCall {
                    FriendsLabel("Your call", color: FriendsInk.section)
                    HStack(spacing: 10) {
                        callButton("HEADS", solid: true) { send(.coin(.heads)) }
                        callButton("TAILS", solid: false) { send(.coin(.tails)) }
                    }
                } else {
                    Text("\(themName.uppercased()) CALLS").font(Brand.font(13, .black)).tracking(0.6).foregroundStyle(FriendsInk.bannerLabel)
                }
            }
            VStack(spacing: 6) {
                FriendsLabel("What's on the line", color: FriendsInk.section)
                Text(c.stake).font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.chip)
                    .padding(.horizontal, 14).frame(minHeight: 30)
                    .friendsChip(FriendsKit.solid, strong: true)
            }
        }
    }

    /// §A8: HEADS (purple) / TAILS (pink) candy buttons.
    private func callButton(_ title: String, solid: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { CandyLabel(title: title) }
            .buttonStyle(CandyButtonStyle(variant: solid ? .purple : .pink, size: .large))
            .disabled(sending)
            .accessibilityLabel(title.capitalized)
    }

    // Pass the Puzzle

    private func tileColor(_ raw: String) -> Color {
        switch raw {
        case TileState.correct.rawValue: return FriendsKit.purple
        case TileState.present.rawValue: return FriendsKit.amber
        default: return FriendsKit.slate
        }
    }

    @ViewBuilder private func passBoard(_ g: FriendlyGameView, _ p: PassState) -> some View {
        let profile = AuthService.shared.profile
        let typing = g.isActive && g.yourTurn
        VStack(spacing: 6) {
            ForEach(0..<FriendlyGames.passMaxGuesses, id: \.self) { row in
                HStack(spacing: 6) {
                    Group {
                        if row < p.guesses.count {
                            let by = p.guesses[row].by
                            if by == g.me {
                                AvatarView(url: profile?.avatarUrl, username: profile?.username ?? "You", size: 26, emoji: profile?.avatarEmoji)
                                    .overlay(AvatarOutline(tile: AvatarView.showsTile(profile?.avatarUrl)).stroke(FriendsKit.purple, lineWidth: 2))
                            } else {
                                AvatarView(url: g.opponent.avatarUrl, username: themName, size: 26, emoji: g.opponent.avatarEmoji)
                                    .overlay(AvatarOutline(tile: AvatarView.showsTile(g.opponent.avatarUrl)).stroke(FriendsKit.amber, lineWidth: 2))
                            }
                        } else {
                            Circle().fill(FriendsKit.tileAccent(.pass).wash(0.14)).frame(width: 26, height: 26)
                                .overlay(Circle().stroke(FriendsKit.tileAccent(.pass).wash(0.4), lineWidth: 1))
                        }
                    }
                    .frame(width: 28)
                    ForEach(0..<5, id: \.self) { col in
                        passTile(row: row, col: col, p: p, typing: typing)
                    }
                }
            }
        }
        // §L: the board sits on the shared tray.
        .gameTray(accent: FriendsKit.tileAccent(.pass), state: trayState(g))
        if !g.isActive, let answer = g.answer {
            Text("THE WORD WAS \(answer.uppercased())").font(Brand.font(13, .black)).tracking(0.8)
                .foregroundStyle(FriendsInk.heading).padding(.top, 4)
        } else if g.isActive && !g.yourTurn {
            Text("\(themName)'s guess — you'll see it land here.").font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                .padding(.top, 2)
        }
    }

    /// §B1: the Pass the Puzzle tiles are the game kit's glossy tiles (purple right
    /// spot, gold wrong spot, slate not in the word; frosted empty, typed white).
    private func passTile(row: Int, col: Int, p: PassState, typing: Bool) -> some View {
        var letter = ""
        var face: GlossyFace = .empty
        if row < p.guesses.count {
            let gs = p.guesses[row]
            let chars = Array(gs.word)
            letter = col < chars.count ? String(chars[col]) : ""
            let raw = col < gs.tiles.count ? gs.tiles[col] : TileState.absent.rawValue
            face = raw == TileState.correct.rawValue ? .correct : raw == TileState.present.rawValue ? .present : .absent
        } else if typing && row == p.guesses.count {
            let chars = Array(passInput)
            letter = col < chars.count ? String(chars[col]) : ""
            face = letter.isEmpty ? .empty : .typed
        }
        return GlossyTile(face: face, letter: letter, width: 44)
            .modifier(TypePop(letter: face == .typed ? letter : "", size: CGSize(width: 44, height: 44)))
    }

    private func passKeyboard(_ g: FriendlyGameView, _ p: PassState) -> some View {
        // Each letter at the best state any guess showed it.
        var best: [Character: Int] = [:]
        for gs in p.guesses {
            for (ch, raw) in zip(gs.word, gs.tiles) {
                let rank = raw == TileState.correct.rawValue ? 3 : raw == TileState.present.rawValue ? 2 : 1
                best[ch] = max(best[ch] ?? 0, rank)
            }
        }
        let mine = g.yourTurn && !sending
        return LetterKeyboard(
            onLetter: { l in
                guard mine, passInput.count < 5 else { return }
                passInput += l
                moveError = nil
            },
            onEnter: {
                guard mine else { return }
                guard passInput.count == 5 else { moveError = "Five letters, please"; return }
                send(.pass(passInput))
            },
            onDelete: {
                guard mine, !passInput.isEmpty else { return }
                passInput.removeLast()
            },
            // §B2: the keys take the game kit's state colors.
            keyState: { l in
                switch best[Character(l)] {
                case 3: return .correct
                case 2: return .present
                case 1: return .absent
                default: return nil
                }
            },
            hardwareEnabled: mine
        )
        .opacity(mine ? 1 : 0.5)
        .padding(.bottom, 6)
        .background(Self.keyboardBed)
    }

    // Ghost (§9)

    @ViewBuilder private func ghostBoard(_ g: FriendlyGameView, _ s: GhostState) -> some View {
        let me = g.me
        let myLetter = g.isActive && g.yourTurn
        let letters = Array(s.fragment).map(String.init)
        VStack(spacing: 12) {
            // A round just ended (or the match did): what happened.
            if let last = s.rounds.last, s.fragment.isEmpty {
                ghostRoundCard(last, round: s.rounds.count, me: me)
                    .id("ghost-round-\(s.rounds.count)")
                    .transition(.scale(scale: 0.95).combined(with: .opacity))
            }
            if g.isActive {
                FriendsLabel(s.fragment.isEmpty ? (myLetter ? "Start the word" : "\(themName) starts") : "The letters so far",
                             color: FriendsInk.section)
                HStack(spacing: 6) {
                    ForEach(letters.indices, id: \.self) { i in
                        let by = i < s.letters.count ? s.letters[i] : me.other
                        ghostTile(letters[i], mine: by == me)
                            .transition(.scale.combined(with: .opacity))
                    }
                    if myLetter {
                        ghostTile(ghostPending ?? "", mine: nil)
                    } else if letters.isEmpty {
                        ghostTile("", mine: nil).opacity(0.5)
                    }
                }
                .frame(maxWidth: .infinity)
                // §L: the fragment sits on the shared tray.
                .gameTray(accent: FriendsKit.tileAccent(.ghost))
                .animation(Theme.reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.75), value: s.fragment)
                if !myLetter {
                    Text("\(themName) is adding a letter…").font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                }
                Text("Spell a word and you lose the round. Leave a dead end and you lose it too.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 16) {
                    legend("YOU", TilePalette.correct.base)
                    legend(themName.uppercased(), TilePalette.present.base)
                }
            }
        }
    }

    /// One fragment tile: a §B1 glossy tile — yours purple (right-spot face),
    /// theirs gold (wrong-spot face) — or the frosted tile for your next letter
    /// (dashed while empty, typed once picked).
    private func ghostTile(_ letter: String, mine: Bool?) -> some View {
        let shape = RoundedRectangle(cornerRadius: 11, style: .continuous)
        let face: GlossyFace = mine.map { $0 ? .correct : .present } ?? (letter.isEmpty ? .empty : .typed)
        return GlossyTile(face: face, letter: letter, width: 46)
            .overlay {
                if mine == nil && letter.isEmpty {
                    shape.strokeBorder(FriendsKit.purple.opacity(0.45), style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                        .padding(.bottom, 3)
                }
            }
            .modifier(TypePop(letter: mine == nil ? letter : "", size: CGSize(width: 46, height: 46)))
            .frame(maxWidth: 46, maxHeight: 46)
            .accessibilityLabel(letter.isEmpty ? "Your next letter" : letter)
    }

    /// `<WORD> — <name> spelled a word` / `<LETTERS> — no word starts with that`.
    private func ghostRoundCard(_ r: GhostRound, round: Int, me: FriendlySide) -> some View {
        let loser = r.loser == me ? "you" : themName
        let winner = r.loser == me ? themName.uppercased() : "YOU"
        let text = r.reason == .word ? "\(r.fragment) — \(loser) spelled a word" : "\(r.fragment) — no word starts with that"
        return VStack(spacing: 4) {
            Text("ROUND \(round) · \(winner) TAKE\(r.loser == me ? "S" : "") IT")
                .font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsInk.bannerLabel)
            Text(text).font(Brand.font(14, .black)).foregroundStyle(FriendsInk.heading)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 14).padding(.vertical, 12)
        .friendsCard(accent: FriendsKit.tileAccent(.ghost), bar: [FriendsKit.tileAccent(.ghost)], radius: 16, barHeight: 5,
                     tint: 0.10, line: 0.28)
    }

    /// Letters only: a tap fills the dashed tile; `ADD <L>` plays it (web parity).
    private func ghostKeyboard(_ g: FriendlyGameView, _ s: GhostState) -> some View {
        let mine = g.yourTurn && !sending
        let play = {
            guard mine, let l = ghostPending else { return }
            send(.ghost(l))
        }
        return VStack(spacing: 8) {
            errorSlot.padding(.horizontal, 16)
            if g.yourTurn {
                // §A8: the purple candy ADD (dimmed until a letter is picked).
                Button(action: play) {
                    if sending { ProgressView().tint(.white) }
                    else { CandyLabel(title: ghostPending.map { "Add \($0)" } ?? "Tap a letter", symbol: ghostPending == nil ? nil : "plus") }
                }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium))
                .disabled(ghostPending == nil || sending)
                .padding(.horizontal, 16)
            }
            LetterKeyboard(
                onLetter: { l in
                    guard mine else { return }
                    ghostPending = l
                    moveError = nil
                },
                onEnter: play,
                onDelete: {
                    guard mine else { return }
                    ghostPending = nil
                },
                showEnter: false,
                onHardwareKey: { key in
                    // Return plays the letter in the dashed tile, like ADD.
                    guard key == .enter else { return false }
                    play()
                    return true
                },
                hardwareEnabled: mine
            )
            .opacity(mine ? 1 : 0.5)
        }
        .padding(.top, 6).padding(.bottom, 6)
        .background(Self.keyboardBed)
    }

    // Word Chain (§9)

    @ViewBuilder private func chainBoard(_ g: FriendlyGameView, _ c: ChainState) -> some View {
        let me = g.me
        VStack(spacing: 8) {
            if c.words.isEmpty {
                Text(g.isActive && g.yourTurn ? "Open the chain with any 5- to 7-letter word." : "\(themName) opens the chain.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            ForEach(Array(c.words.enumerated()), id: \.offset) { i, w in
                chainRow(w, me: me, newest: i == c.words.count - 1 && g.isActive)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            Color.clear.frame(height: 1).id("chain-end")
        }
        // §L: the chain sits on the shared tray.
        .gameTray(accent: FriendsKit.tileAccent(.chain), state: trayState(g))
        .animation(Theme.reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.8), value: c.words.count)
        HStack(spacing: 16) {
            legend("YOU", TilePalette.correct.base)
            legend(themName.uppercased(), TilePalette.present.base)
        }
    }

    /// One word pill: tiles (30 px) in the player's color and a `+5` chip; the
    /// newest word's last letter glows (the next word starts with it).
    private func chainRow(_ w: ChainWord, me: FriendlySide, newest: Bool) -> some View {
        let letters = Array(w.word).map(String.init)
        let mine = w.by == me
        let side = mine ? FriendsKit.purple : FriendsKit.amber
        let green = FriendsKit.tileAccent(.chain)
        return HStack(spacing: 4) {
            ForEach(letters.indices, id: \.self) { i in
                let glow = newest && i == letters.count - 1
                // §B1 glossy tiles in the player's color (purple yours, gold theirs);
                // the newest word's last letter glows green (the next word starts with it).
                GlossyTile(face: mine ? .correct : .present, letter: letters[i], width: 30,
                           glow: green, glowAmount: glow ? 1 : 0)
                    .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(glow ? green : .clear, lineWidth: 2.5).padding(.bottom, 2))
                    .scaleEffect(glow ? 1.08 : 1)
            }
            Spacer(minLength: 6)
            HStack(spacing: 0) {
                Text("+").font(Brand.font(12, .black)).foregroundStyle(VsLobbyKit.numberInk)
                Text("\(w.points)").softNumber(14, color: VsLobbyKit.numberInk)
            }
            .padding(.horizontal, 9).frame(minHeight: 26)
            .friendsChip(side)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .friendsCard(accent: side, radius: 14, tint: 0.07, line: 0.24)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(w.by == me ? "You" : themName) played \(w.word), plus \(w.points)")
    }

    /// Your word: 5–7 tiles with the needed first letter pre-filled and locked,
    /// the keyboard and ENTER. Errors show inline right above it.
    private func chainInputArea(_ g: FriendlyGameView, _ c: ChainState) -> some View {
        let mine = g.yourTurn && !sending
        let locked = c.nextLetter.map(String.init)
        let letters = (locked.map { [$0] } ?? []) + Array(chainTyped).map(String.init)
        let wordMax = FriendlyGames.wordMax
        return VStack(spacing: 8) {
            if g.yourTurn {
                HStack(spacing: 5) {
                    ForEach(0..<wordMax, id: \.self) { i in
                        chainInputTile(i < letters.count ? letters[i] : "", locked: i == 0 && locked != nil,
                                       optional: i >= FriendlyGames.wordMin)
                    }
                }
                .padding(.horizontal, 16)
            } else {
                Text("\(themName)'s word — it lands in the chain here.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
            }
            errorSlot.padding(.horizontal, 16)
            LetterKeyboard(
                onLetter: { l in
                    guard mine, letters.count < wordMax else { return }
                    chainTyped += l
                    moveError = nil
                },
                onEnter: {
                    guard mine else { return }
                    let word = letters.joined()
                    guard word.count >= FriendlyGames.wordMin else {
                        moveError = "\(FriendlyGames.wordMin) to \(wordMax) letters, please"
                        return
                    }
                    send(.chain(word))
                },
                onDelete: {
                    // The locked first letter stays.
                    guard mine, !chainTyped.isEmpty else { return }
                    chainTyped.removeLast()
                },
                hardwareEnabled: mine
            )
            .opacity(mine ? 1 : 0.5)
        }
        .padding(.top, 8).padding(.bottom, 6)
        .background(Self.keyboardBed)
    }

    /// Your word's tiles: the locked first letter a glossy green tile with a lock;
    /// the rest §B1 glossy tiles (frosted empty — dashed when optional — typed white).
    private func chainInputTile(_ letter: String, locked: Bool, optional: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 9, style: .continuous)
        let green = FriendsKit.tileAccent(.chain)
        return GeometryReader { geo in
            let w = min(geo.size.width, geo.size.height)
            ZStack {
                if locked {
                    ZStack(alignment: .top) {
                        shape.fill(Color.black.mixed(over: green, 0.35))
                        shape.fill(LinearGradient(colors: [green.mixed(over: .white, 0.7), green], startPoint: .top, endPoint: .bottom))
                            .padding(.bottom, 3)
                    }
                    .shadow(color: green.opacity(0.45), radius: 6, y: 2)
                    Text(letter).font(Brand.font(21, .black)).foregroundStyle(.white).padding(.bottom, 3)
                    Image(systemName: "lock.fill").font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.85))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(4)
                } else {
                    GlossyTile(face: letter.isEmpty ? .empty : .typed, letter: letter, width: w)
                        .modifier(TypePop(letter: letter, size: CGSize(width: w, height: w)))
                    if optional && letter.isEmpty {
                        shape.strokeBorder(FriendsKit.purple.opacity(0.35), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                            .padding(.bottom, 2)
                    }
                }
            }
            .frame(width: w, height: w)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: 44, maxHeight: 44)
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(locked ? "\(letter), locked" : letter.isEmpty ? "Empty" : letter)
    }

    // MARK: Over

    private func overButtons(_ g: FriendlyGameView) -> some View {
        VStack(spacing: 10) {
            // §A8: purple candy Rematch, pink candy back to Friends.
            Button { rematch(g) } label: {
                if rematching { ProgressView().tint(.white) }
                else { CandyLabel(title: "Rematch", symbol: "arrow.counterclockwise") }
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
            .disabled(rematching)
            Button { dismiss() } label: {
                CandyLabel(title: "Friends", symbol: "chevron.left")
            }
            .buttonStyle(CandyButtonStyle(variant: .pink, size: .large))
        }
        .padding(.top, 4)
    }
}

/// Both picks of the last round, flipping in together; the winner glows.
private struct RpsReveal: View {
    let round: Int
    let mine: RpsPick
    let theirs: RpsPick
    /// 0 = tie, 1 = you, 2 = them.
    let winner: Int
    let them: String
    @State private var flipped = Theme.reduceMotion

    var body: some View {
        VStack(spacing: 6) {
            Text("ROUND \(round)").font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsInk.muted)
            HStack(spacing: 18) {
                card(mine, label: "YOU", win: winner == 1, tint: FriendsKit.purple)
                Text(winner == 0 ? "TIE" : "VS").font(Brand.font(12, .black)).foregroundStyle(FriendsInk.muted)
                card(theirs, label: them.uppercased(), win: winner == 2, tint: FriendsKit.amber)
            }
        }
        .onAppear {
            guard !flipped else { return }
            if Theme.reduceMotion { flipped = true; return }
            withAnimation(.spring(response: 0.55, dampingFraction: 0.7).delay(0.05)) { flipped = true }
        }
    }

    private func card(_ p: RpsPick, label: String, win: Bool, tint: Color) -> some View {
        VStack(spacing: 3) {
            Image("friends-\(p.rawValue)").resizable().interpolation(.high).scaledToFit().frame(width: 58, height: 58)
                .accessibilityLabel(p.rawValue.capitalized)   // §AB: the pick, not the asset name
            Text(label).font(Brand.font(9.5, .black)).tracking(0.5).foregroundStyle(win ? tint : FriendsInk.muted).lineLimit(1)
        }
        .frame(width: 84, height: 92)
        // §A1: tinted in the player's color, never plain white.
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(tint.wash(win ? 0.18 : 0.10))
            .shadow(color: win ? tint.opacity(0.6) : Color(hex: 0x4C1D95).opacity(0.08), radius: win ? 10 : 4, y: 2))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(win ? tint : tint.wash(0.32), lineWidth: win ? 2 : 1.5))
        .rotation3DEffect(.degrees(flipped ? 0 : 90), axis: (x: 0, y: 1, z: 0))
        .opacity(flipped ? 1 : 0)
    }
}

/// The Call It coin art: spins briefly on each new flip, then lands on the server's face.
private struct SpinningCoin: View {
    let face: CoinFace
    let spinKey: Int
    @State private var angle: Double = 0

    var body: some View {
        Image(face == .heads ? "friends-heads" : "friends-tails")
            .resizable().interpolation(.high).scaledToFit()
            .accessibilityLabel(face == .heads ? "Coin: heads" : "Coin: tails")   // §AB
            .frame(width: 150, height: 150)
            .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0))
            .shadow(color: Color(hex: 0xCA8A04).opacity(0.35), radius: 12, y: 4)
            .onChange(of: spinKey) { _ in
                guard !Theme.reduceMotion else { return }
                var t = Transaction(); t.disablesAnimations = true
                withTransaction(t) { angle = 0 }
                withAnimation(.easeOut(duration: 0.9)) { angle = 720 }
            }
            .accessibilityLabel(face == .heads ? "Coin, heads" : "Coin, tails")
    }
}
