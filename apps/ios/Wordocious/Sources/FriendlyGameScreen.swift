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
                VStack(spacing: 12) {
                    Text(loadError).font(Brand.font(15, .black)).foregroundStyle(FriendsKit.ink).multilineTextAlignment(.center)
                    Button { dismiss() } label: { FriendsPill(title: "FRIENDS", solid: false) }.buttonStyle(.plain)
                }
                .padding(24)
                Spacer()
            } else {
                Spacer()
                ProgressView().tint(FriendsKit.solid)
                Spacer()
            }
        }
        .background(FriendsKit.page.ignoresSafeArea())
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
        case .failure(.message(let m)): if game == nil { loadError = m == "Not found" ? "This game isn't here anymore." : m }
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
            Text((game?.title ?? "").uppercased())
                .font(Brand.font(19, .black)).tracking(0.4)
                .foregroundStyle(LinearGradient(colors: kind.map(FriendsKit.gradient) ?? FriendsKit.titleGradient,
                                                startPoint: .leading, endPoint: .trailing))
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.horizontal, 48)
            HStack {
                Button {
                    if game?.isActive == true { confirmClose = true } else { dismiss() }
                } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .bold))
                        .foregroundStyle(FriendsKit.solid).frame(width: 40, height: 40).contentShape(Rectangle())
                }
                .buttonStyle(.plain).accessibilityLabel("Close")
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
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text(headline(g))
                    .font(Brand.font(18, .black)).tracking(0.4).foregroundStyle(FriendsKit.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text(subLine(g)).font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(FriendsKit.mid)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(Color.white.opacity(0.5))
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
        .shadow(color: won ? FriendsKit.purple.opacity(0.35) : FriendsKit.ink.opacity(0.08), radius: won ? 10 : 7, x: 0, y: 4)
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
                    Text("\(score)").font(Brand.font(34, .black)).monospacedDigit()
                        .foregroundStyle(leading ? Color(hex: 0x4C1D95) : Color(hex: 0x78350F))
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

    private func errorText(_ m: String) -> some View {
        Text(m).font(Brand.font(12, .heavy)).foregroundStyle(Color(hex: 0xDC2626))
            .multilineTextAlignment(.center)
            .transition(.opacity)
    }

    private func chainCount(_ g: FriendlyGameView) -> Int {
        if case .chain(let c) = g.state { return c.words.count }
        return 0
    }

    /// Whose color a letter wears in Ghost and Word Chain: yours purple, theirs amber.
    private func sideColor(_ side: FriendlySide, me: FriendlySide) -> Color {
        side == me ? FriendsKit.purple : FriendsKit.amber
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
                        Text("\(themName.uppercased()) IS PICKING…").font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(FriendsKit.label)
                    }
                }
                VStack(spacing: 8) {
                    VSSectionLabel(text: "YOUR PICK")
                    HStack(spacing: 10) {
                        ForEach(RpsPick.allCases, id: \.self) { p in
                            let selected = mine == p
                            Button { send(.rps(p)) } label: {
                                VStack(spacing: 4) {
                                    Image(art(p)).resizable().interpolation(.high).scaledToFit().frame(width: 74, height: 74)
                                    Text(p.rawValue.uppercased()).font(Brand.font(11, .black)).tracking(0.6)
                                        .foregroundStyle(selected ? .white : FriendsKit.ink)
                                }
                                .frame(width: 104, height: 118)
                                .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(selected ? FriendsKit.purple : Color.white)
                                    .shadow(color: selected ? FriendsKit.purple.opacity(0.55) : Color(hex: 0x4C1D95).opacity(0.08),
                                            radius: selected ? 9 : 5, y: 2))
                                .opacity(mine != nil && !selected ? 0.45 : 1)
                            }
                            .buttonStyle(PressableStyle())
                            .disabled(mine != nil || sending)
                            .accessibilityLabel(p.rawValue.capitalized)
                            .accessibilityAddTraits(selected ? .isSelected : [])
                        }
                    }
                    Text(mine != nil ? "Locked in. Both picks flip at once." : "Both picks flip at once.")
                        .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                }
            }
        }
    }

    // Tic-Tac-Tile

    @ViewBuilder private func tttBoard(_ g: FriendlyGameView, _ t: TttState) -> some View {
        let me = g.me
        let myMove = g.isActive && g.yourTurn
        VStack(spacing: 12) {
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(98), spacing: 10), count: 3), spacing: 10) {
                ForEach(0..<9, id: \.self) { i in
                    let mark = t.board[i]
                    let wins: Bool = {
                        guard myMove, mark == nil else { return false }
                        var b = t.board; b[i] = me
                        return FriendlyGames.tttLine(b) != nil
                    }()
                    Button { send(.ttt(i)) } label: {
                        ZStack {
                            if let mark {
                                let mine = mark == me
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(mine ? FriendsKit.purple : FriendsKit.amber)
                                    .shadow(color: (mine ? FriendsKit.purple : FriendsKit.amber).opacity(0.4), radius: 5, y: 2)
                                Image(systemName: mine ? "xmark" : "circle")
                                    .font(.system(size: 40, weight: .heavy)).foregroundStyle(.white)
                                    .transition(.scale.combined(with: .opacity))
                            } else {
                                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white)
                                    .shadow(color: wins ? FriendsKit.purple.opacity(0.45) : Color(hex: 0x4C1D95).opacity(0.08), radius: wins ? 8 : 5, y: 2)
                                if wins {
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .strokeBorder(FriendsKit.purple, style: StrokeStyle(lineWidth: 2.5, dash: [6, 4]))
                                }
                            }
                        }
                        .frame(width: 98, height: 98)
                    }
                    .buttonStyle(PressableStyle())
                    .disabled(!myMove || mark != nil || sending)
                    .accessibilityLabel(mark == nil ? "Empty tile \(i + 1)" : mark == me ? "Your tile" : "\(themName)'s tile")
                }
            }
            HStack(spacing: 16) {
                legend("YOU · X", FriendsKit.purple)
                legend("\(themName.uppercased()) · O", FriendsKit.amber)
            }
        }
    }

    private func legend(_ text: String, _ c: Color) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 4).fill(c).frame(width: 12, height: 12)
            Text(text).font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(FriendsKit.label).lineLimit(1)
        }
    }

    // Call It

    @ViewBuilder private func coinBoard(_ g: FriendlyGameView, _ c: CoinState) -> some View {
        let myCall = g.isActive && g.yourTurn
        VStack(spacing: 14) {
            SpinningCoin(face: c.rounds.last?.flip ?? .heads, spinKey: c.rounds.count)
            if let last = c.rounds.last {
                let who = last.caller == g.me ? "You" : themName
                Text("\(who) called \(last.call.rawValue) · it landed \(last.flip.rawValue)")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
            }
            if g.isActive {
                if myCall {
                    VSSectionLabel(text: "YOUR CALL")
                    HStack(spacing: 10) {
                        callButton("HEADS", solid: true) { send(.coin(.heads)) }
                        callButton("TAILS", solid: false) { send(.coin(.tails)) }
                    }
                } else {
                    Text("\(themName.uppercased()) CALLS").font(Brand.font(13, .black)).tracking(0.6).foregroundStyle(FriendsKit.mid)
                }
            }
            VStack(spacing: 6) {
                VSSectionLabel(text: "WHAT'S ON THE LINE")
                Text(c.stake).font(Brand.font(12, .heavy)).foregroundStyle(FriendsKit.ink)
                    .padding(.horizontal, 14).frame(height: 30)
                    .background(Capsule().fill(Color.white))
                    .overlay(Capsule().stroke(FriendsKit.solid, lineWidth: 2))
            }
        }
    }

    private func callButton(_ title: String, solid: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(Brand.font(15, .black)).tracking(0.8)
                .foregroundStyle(solid ? .white : FriendsKit.purple)
                .frame(maxWidth: .infinity).frame(height: 50)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(solid ? FriendsKit.purple : Color(hex: 0xEDE9FE))
                    .shadow(color: solid ? FriendsKit.purple.opacity(0.4) : .clear, radius: 6, y: 3))
        }
        .buttonStyle(PressableStyle())
        .disabled(sending)
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
                                    .overlay(Circle().stroke(FriendsKit.purple, lineWidth: 2))
                            } else {
                                AvatarView(url: g.opponent.avatarUrl, username: themName, size: 26, emoji: g.opponent.avatarEmoji)
                                    .overlay(Circle().stroke(FriendsKit.amber, lineWidth: 2))
                            }
                        } else {
                            Circle().fill(Color.white).frame(width: 26, height: 26)
                                .overlay(Circle().stroke(Color(hex: 0xE5E7EB), lineWidth: 1))
                        }
                    }
                    .frame(width: 28)
                    ForEach(0..<5, id: \.self) { col in
                        passTile(row: row, col: col, p: p, typing: typing)
                    }
                }
            }
            if !g.isActive, let answer = g.answer {
                Text("THE WORD WAS \(answer.uppercased())").font(Brand.font(13, .black)).tracking(0.8)
                    .foregroundStyle(FriendsKit.ink).padding(.top, 8)
            } else if g.isActive && !g.yourTurn {
                Text("\(themName)'s guess — you'll see it land here.").font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                    .padding(.top, 6)
            }
        }
    }

    private func passTile(row: Int, col: Int, p: PassState, typing: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        var letter = ""
        var fill: Color? = nil
        if row < p.guesses.count {
            let gs = p.guesses[row]
            let chars = Array(gs.word)
            letter = col < chars.count ? String(chars[col]) : ""
            fill = col < gs.tiles.count ? tileColor(gs.tiles[col]) : FriendsKit.slate
        } else if typing && row == p.guesses.count {
            let chars = Array(passInput)
            letter = col < chars.count ? String(chars[col]) : ""
        }
        return ZStack {
            if let fill {
                shape.fill(fill)
            } else {
                shape.fill(Color.white)
                shape.strokeBorder(letter.isEmpty ? Color(hex: 0xE5E7EB) : FriendsKit.purple.opacity(0.6), lineWidth: 2)
            }
            Text(letter).font(Brand.font(21, .black)).foregroundStyle(fill == nil ? Color(hex: 0x111827) : .white)
        }
        .frame(width: 44, height: 44)
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
            keyFill: { l in
                switch best[Character(l)] {
                case 3: return FriendsKit.purple
                case 2: return FriendsKit.amber
                case 1: return FriendsKit.slate
                default: return nil
                }
            },
            hardwareEnabled: mine
        )
        .opacity(mine ? 1 : 0.5)
        .padding(.bottom, 6)
        .background(FriendsKit.page)
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
                VSSectionLabel(text: s.fragment.isEmpty ? (myLetter ? "START THE WORD" : "\(themName.uppercased()) STARTS") : "THE LETTERS SO FAR")
                HStack(spacing: 6) {
                    ForEach(letters.indices, id: \.self) { i in
                        let by = i < s.letters.count ? s.letters[i] : me.other
                        ghostTile(letters[i], fill: sideColor(by, me: me))
                            .transition(.scale.combined(with: .opacity))
                    }
                    if myLetter {
                        ghostTile(ghostPending ?? "", fill: nil)
                    } else if letters.isEmpty {
                        ghostTile("", fill: nil).opacity(0.5)
                    }
                }
                .frame(maxWidth: .infinity)
                .animation(.spring(response: 0.35, dampingFraction: 0.75), value: s.fragment)
                if !myLetter {
                    Text("\(themName) is adding a letter…").font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                }
                Text("Spell a word and you lose the round. Leave a dead end and you lose it too.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 16) {
                    legend("YOU", FriendsKit.purple)
                    legend(themName.uppercased(), FriendsKit.amber)
                }
            }
        }
    }

    /// One fragment tile (52 px, radius 10): colored by who played it, or the
    /// dashed tile for your next letter.
    private func ghostTile(_ letter: String, fill: Color?) -> some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        return ZStack {
            if let fill {
                shape.fill(fill).shadow(color: fill.opacity(0.4), radius: 5, y: 2)
            } else {
                shape.fill(Color.white)
                shape.strokeBorder(letter.isEmpty ? FriendsKit.purple.opacity(0.45) : FriendsKit.purple,
                                   style: StrokeStyle(lineWidth: 2, dash: letter.isEmpty ? [5, 4] : []))
            }
            Text(letter).font(Brand.font(26, .black)).foregroundStyle(fill == nil ? FriendsKit.purple : .white)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: 52, maxHeight: 52)
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel(letter.isEmpty ? "Your next letter" : letter)
    }

    /// `<WORD> — <name> spelled a word` / `<LETTERS> — no word starts with that`.
    private func ghostRoundCard(_ r: GhostRound, round: Int, me: FriendlySide) -> some View {
        let loser = r.loser == me ? "you" : themName
        let winner = r.loser == me ? themName.uppercased() : "YOU"
        let text = r.reason == .word ? "\(r.fragment) — \(loser) spelled a word" : "\(r.fragment) — no word starts with that"
        return VStack(spacing: 4) {
            Text("ROUND \(round) · \(winner) TAKE\(r.loser == me ? "S" : "") IT")
                .font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsKit.mid)
            Text(text).font(Brand.font(14, .black)).foregroundStyle(FriendsKit.ink)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FriendsKit.soft))
    }

    /// Letters only: a tap fills the dashed tile; `ADD <L>` plays it (web parity).
    private func ghostKeyboard(_ g: FriendlyGameView, _ s: GhostState) -> some View {
        let mine = g.yourTurn && !sending
        let ghostColor = FriendsKit.color(.ghost)
        let play = {
            guard mine, let l = ghostPending else { return }
            send(.ghost(l))
        }
        return VStack(spacing: 8) {
            if let moveError { errorText(moveError).padding(.horizontal, 16) }
            if g.yourTurn {
                Button(action: play) {
                    Group {
                        if sending { ProgressView().tint(.white) }
                        else { Text(ghostPending.map { "ADD \($0)" } ?? "TAP A LETTER").font(Brand.font(15, .black)).tracking(0.8) }
                    }
                    .foregroundStyle(.white).frame(maxWidth: .infinity).frame(height: 46)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(ghostColor)
                        .shadow(color: ghostColor.opacity(ghostPending == nil ? 0 : 0.4), radius: 6, y: 3))
                    .opacity(ghostPending == nil ? 0.45 : 1)
                }
                .buttonStyle(PressableStyle())
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
        .background(FriendsKit.page)
    }

    // Word Chain (§9)

    @ViewBuilder private func chainBoard(_ g: FriendlyGameView, _ c: ChainState) -> some View {
        let me = g.me
        VStack(spacing: 8) {
            if c.words.isEmpty {
                Text(g.isActive && g.yourTurn ? "Open the chain with any 5- to 7-letter word." : "\(themName) opens the chain.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                    .padding(.vertical, 8)
            }
            ForEach(Array(c.words.enumerated()), id: \.offset) { i, w in
                chainRow(w, me: me, newest: i == c.words.count - 1 && g.isActive)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            Color.clear.frame(height: 1).id("chain-end")
            HStack(spacing: 16) {
                legend("YOU", FriendsKit.purple)
                legend(themName.uppercased(), FriendsKit.amber)
            }
            .padding(.top, 2)
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: c.words.count)
    }

    /// One word pill: tiles (30 px) in the player's color and a `+5` chip; the
    /// newest word's last letter glows (the next word starts with it).
    private func chainRow(_ w: ChainWord, me: FriendlySide, newest: Bool) -> some View {
        let letters = Array(w.word).map(String.init)
        let fill = sideColor(w.by, me: me)
        return HStack(spacing: 4) {
            ForEach(letters.indices, id: \.self) { i in
                let glow = newest && i == letters.count - 1
                Text(letters[i]).font(Brand.font(15, .black)).foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(fill))
                    .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(glow ? FriendsKit.color(.chain) : .clear, lineWidth: 2.5))
                    .shadow(color: glow ? FriendsKit.color(.chain).opacity(0.7) : .clear, radius: glow ? 7 : 0)
                    .scaleEffect(glow ? 1.08 : 1)
            }
            Spacer(minLength: 6)
            Text("+\(w.points)").font(Brand.font(12, .black)).monospacedDigit()
                .foregroundStyle(w.by == me ? FriendsKit.purple : Color(hex: 0xB45309))
                .padding(.horizontal, 9).frame(height: 24)
                .background(Capsule().fill(w.by == me ? Color(hex: 0xEDE9FE) : Color(hex: 0xFEF3C7)))
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .vsCard(radius: 14)
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
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
            }
            if let moveError { errorText(moveError).padding(.horizontal, 16) }
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
        .background(FriendsKit.page)
    }

    private func chainInputTile(_ letter: String, locked: Bool, optional: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 9, style: .continuous)
        let green = FriendsKit.color(.chain)
        return ZStack {
            if locked {
                shape.fill(green).shadow(color: green.opacity(0.45), radius: 6, y: 2)
            } else {
                shape.fill(Color.white)
                shape.strokeBorder(letter.isEmpty ? Color(hex: 0xE5E7EB) : FriendsKit.purple.opacity(0.7),
                                   style: StrokeStyle(lineWidth: 2, dash: optional && letter.isEmpty ? [4, 3] : []))
            }
            Text(letter).font(Brand.font(21, .black)).foregroundStyle(locked ? .white : Color(hex: 0x111827))
            if locked {
                Image(systemName: "lock.fill").font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.85))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(4)
            }
        }
        .frame(maxWidth: 44, maxHeight: 44)
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel(locked ? "\(letter), locked" : letter.isEmpty ? "Empty" : letter)
    }

    // MARK: Over

    private func overButtons(_ g: FriendlyGameView) -> some View {
        VStack(spacing: 10) {
            Button { rematch(g) } label: {
                Group {
                    if rematching { ProgressView().tint(.white) }
                    else { Text("REMATCH").font(Brand.font(14, .black)).tracking(0.6) }
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity).frame(height: 50)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FriendsKit.solid)
                    .shadow(color: FriendsKit.solid.opacity(0.35), radius: 6, y: 3))
            }
            .buttonStyle(PressableStyle())
            .disabled(rematching)
            Button { dismiss() } label: {
                Text("FRIENDS").font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(FriendsKit.solid)
                    .frame(maxWidth: .infinity).frame(height: 50)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FriendsKit.soft))
            }
            .buttonStyle(PressableStyle())
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
            Text("ROUND \(round)").font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsKit.label)
            HStack(spacing: 18) {
                card(mine, label: "YOU", win: winner == 1, tint: FriendsKit.purple)
                Text(winner == 0 ? "TIE" : "VS").font(Brand.font(12, .black)).foregroundStyle(FriendsKit.label)
                card(theirs, label: them.uppercased(), win: winner == 2, tint: FriendsKit.amber)
            }
        }
        .onAppear {
            guard !flipped else { return }
            withAnimation(.spring(response: 0.55, dampingFraction: 0.7).delay(0.05)) { flipped = true }
        }
    }

    private func card(_ p: RpsPick, label: String, win: Bool, tint: Color) -> some View {
        VStack(spacing: 3) {
            Image("friends-\(p.rawValue)").resizable().interpolation(.high).scaledToFit().frame(width: 58, height: 58)
            Text(label).font(Brand.font(9.5, .black)).tracking(0.5).foregroundStyle(win ? tint : FriendsKit.label).lineLimit(1)
        }
        .frame(width: 84, height: 92)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white)
            .shadow(color: win ? tint.opacity(0.6) : Color(hex: 0x4C1D95).opacity(0.08), radius: win ? 10 : 4, y: 2))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(win ? tint : .clear, lineWidth: 2))
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
