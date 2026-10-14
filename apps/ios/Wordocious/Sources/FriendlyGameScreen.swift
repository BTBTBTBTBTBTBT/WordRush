import SwiftUI
import UIKit
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
    @Environment(\.widthClass) private var widthClass

    @State private var loadError: String?
    @State private var sending = false
    @State private var moveError: String?
    @State private var passInput = ""
    /// Ghost: the letter in the dashed tile, played by ADD <L> (a stray tap can't lose a round).
    @State private var ghostPending: String?
    /// Word Chain: the letters typed after the locked first letter.
    @State private var chainTyped = ""
    @State private var confirmClose = false
    /// Wave 3 (9c + 12): the "?" How to Play card (opens by itself the first time this game is played).
    @State private var showHelp = false
    @State private var rematching = false

    // 9b live play (FlagsService live_play; off = today's 2 s poll, no optimistic moves, no presence).
    @StateObject private var live = FriendlyLiveChannel()
    /// The confirmed game plus my in-flight prediction (Core/FriendlyLive.swift); `game` is what it displays.
    @State private var snap = FriendlyLive.Snapshot()
    @State private var shakeCount: CGFloat = 0
    @State private var arrived = false
    @State private var turnPulse = 0
    @State private var floaters: [LiveFloater] = []
    /// Founder 10-13: the scroll area's height and where the board starts in it, so Pass the Puzzle's tray and Word Chain's frame
    /// are sized to sit fully above the pinned keyboard (aspect kept, narrower on short phones).
    @State private var viewportH: CGFloat = 0
    @State private var boardTop: CGFloat = 0
    /// The first ~0.6 s of the screen settle the layout; after that the fit never changes (no screen shifting).
    @State private var fitSettled = false

    init(gameId: String, initial: FriendlyGameView? = nil) {
        _gameId = State(initialValue: gameId)
        _game = State(initialValue: initial)
        _snap = State(initialValue: FriendlyLive.Snapshot(confirmed: initial))
    }

    private var liveOn: Bool { FlagsService.shared.isLive(FriendlyLive.switchKey) }

    /// The bed under the pinned keyboards: the Friends wallpaper's top color (§A1 —
    /// no plain white).
    static var keyboardBed: Color {
        // Dark (founder 10-10 audit): the light bar color was a pale pink slab under Ghost's / Word Chain's keyboard.
        Theme.isDark ? PageTint.friends.stops(dark: true)[2] : PageTint.friends.barColor
    }

    /// The load error for a game that no longer exists (its scene is O3 not found).
    private static let goneLine = "This game isn't here anymore."

    private var kind: FriendlyKind? { game?.kind }
    private var themName: String { game?.opponent.username ?? "Friend" }
    /// Pocket typography (founder 10-10): the game's accent and each player's name color for the bubble lettering.
    private var gameAccent: Color { FriendsKit.tileAccent(kind ?? .rps) }
    private var myColor: Color {
        PlayerTint.nameColor(userId: AuthService.shared.profile?.id, username: AuthService.shared.profile?.username ?? "You")
    }
    private var themColor: Color { PlayerTint.nameColor(userId: game?.opponent.id, username: themName) }
    private var themOnline: Bool { game.flatMap { FriendsKit.friend($0.opponent.id) }?.isOnline() ?? false }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            if let g = game {
                GeometryReader { vp in
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 16) {
                            Group {
                                #if DEBUG
                                if PerfTour.flag("noScore") { Color.clear.frame(height: 200) } else { scoreWindow(g) }
                                #else
                                scoreWindow(g)
                                #endif
                            }
                                .layoutLog("score")
                            // Founder 10-13 (no screen shifting): ONE fixed-height slot under the score window holds, in turn, the
                            // YOUR TURN flag, their lobby strip, or (game over: a win → O3 pops in; a loss → R, MASCOT_SPEC §3)
                            // the result mascot, so a turn change or the finish never pushes the board.
                            Group {
                                #if DEBUG
                                if PerfTour.flag("noSlot") { Color.clear.frame(height: Self.turnSlotHeight) } else { turnSlot(g) }
                                #else
                                turnSlot(g)
                                #endif
                            }
                                .layoutLog("slot")
                            board(g, room: boardRoom(g))
                                .opacity((g.kind == .pass || g.kind == .chain) && !fitSettled && g.isActive ? 0 : 1)
                                .layoutLog("board")
                                .background(GeometryReader { b in
                                    Color.clear.preference(key: BoardTopKey.self, value: b.frame(in: .named("fgsScroll")).minY)
                                })
                                .modifier(ShakeEffect(animatableData: shakeCount))
                                .brightness(arrived ? 0.05 : 0)   // founder 10-13 (no screen shifting): a light pulse, not a scale (the board never changes size)
                                .overlay { if turnPulse > 0 && !Theme.reduceMotion { LiveTurnRing(color: FriendsKit.tileAccent(g.kind)).id(turnPulse) } }
                                .overlay(alignment: .bottom) { liveFloaters }
                            if g.isActive && liveOn && live.socketUp { reactionBar }
                            if let moveError, !pinsInput(g) { errorText(moveError) }
                            if !g.isActive { overButtons(g) }
                        }
                        .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, g.kind == .pass || g.kind == .chain ? 4 : 24)
                        .coordinateSpace(name: "fgsScroll")
                    }
                    .onPreferenceChange(BoardTopKey.self) { if !fitSettled, $0.isFinite, $0 > 0 { boardTop = $0 } }
                    // Word Chain: keep the newest word in view.
                    .onChange(of: chainCount(g)) { _ in
                        #if DEBUG
                        if PerfTour.flag("noScrollTo") { return }
                        #endif
                        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("chain-end", anchor: .bottom) }
                    }
                }
                // Measured ONCE per screen (founder 10-13: no screen shifting): the first real size is kept for good.
                .onAppear {
                    viewportH = vp.size.height
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { fitSettled = true }
                }
                .onChange(of: vp.size.height) { h in if !fitSettled { viewportH = h } }
                }
                // Slice 5: the pinned letter keyboards cap at the 820 keyboard width on tablets (keys grow, the page does not).
                if g.isActive, case .pass(let p) = g.state { passKeyboard(g, p).modifier(PinnedKeyboardBottom()).tabletColumn(max: tabletKeyboardMaxWidth).layoutLog("pinned") }
                if g.isActive, case .ghost(let gs) = g.state { ghostKeyboard(g, gs).modifier(PinnedKeyboardBottom()).tabletColumn(max: tabletKeyboardMaxWidth).layoutLog("pinned") }
                if g.isActive, case .chain(let c) = g.state { chainInputArea(g, c).modifier(PinnedKeyboardBottom()).tabletColumn(max: tabletKeyboardMaxWidth).layoutLog("pinned") }
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
        // Slice 5 (R1/R2, iPad): the whole pocket screen (header, game, pinned keyboard) sits on the tablet page; the wallpaper
        // below stays full-bleed. COMPACT is a no-op.
        .tabletPage()
        // §A1: the Friends wallpaper (light, like the Friends tab), never plain white.
        .background(PageBackground(tint: .friends, lightOnly: true).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task(id: gameId) { await poll() }
        .onDisappear { live.stop() }
        // Wave 3 (item 9): ONE themed button. Resign lives in the Friends tab's more menu now.
        .overlay { if confirmClose { leaveCard } }
        .animation(Theme.reduceMotion ? nil : .easeOut(duration: 0.18), value: confirmClose)
        .softSheet(isPresented: $showHelp) { if let kind { PocketHelpSheet(kind: kind) } }
        .firstPlayPocket(kind: kind, show: $showHelp)
        #if DEBUG
        // Perf harness (PocketDemo): a local game the tour plays through this screen's own input path.
        .onReceive(NotificationCenter.default.publisher(for: PocketDemo.changedNote)) { _ in Task { await refresh() } }
        .onReceive(NotificationCenter.default.publisher(for: PocketDemo.myMoveNote)) { n in
            if let m = n.object as? FriendlyMove { Task { await demoPlay(m) } }
        }
        .onReceive(NotificationCenter.default.publisher(for: PocketDemo.helpNote)) { n in showHelp = (n.object as? Bool) ?? false }
        #endif
    }

    #if DEBUG
    /// DEBUG perf harness: plays my scripted move the way a finger would (letters one at a time into the entry row / pass row,
    /// a pending ghost letter, taps), so the entry row, board and keyboard are exercised exactly as in a real game.
    private func demoPlay(_ m: FriendlyMove) async {
        guard let g = game, g.isActive, g.yourTurn else { return }
        moveError = nil
        switch (g.state, m) {
        case (.chain(let c), .chain(let w)):
            let rest = c.nextLetter == nil ? w : String(w.dropFirst())   // the needed first letter is pre-filled and locked
            chainTyped = ""
            for (i, ch) in rest.enumerated() {
                chainTyped.append(ch)
                Feedback.keyTap()
                try? await Task.sleep(nanoseconds: 70_000_000)
                // The first word: try ENTER too early once ("5 to 15 letters, please" floats above the keyboard, nothing moves).
                if c.nextLetter == nil && i == 2 {
                    moveError = "\(FriendlyGames.wordMin) to \(FriendlyGames.chainWordMax) letters, please"
                    try? await Task.sleep(nanoseconds: 1_300_000_000)
                    moveError = nil
                }
            }
            if w.count == FriendlyGames.chainWordMax {
                // The 16-letter attempt: the server says no (inline error), the typed row stays, then the real word goes in.
                send(.chain(w + "S"))
                try? await Task.sleep(nanoseconds: 1_400_000_000)
                moveError = nil
            }
            try? await Task.sleep(nanoseconds: 350_000_000)
            send(m)
        case (.pass, .pass(let w)):
            passInput = ""
            for ch in w { passInput.append(ch); Feedback.keyTap(); try? await Task.sleep(nanoseconds: 70_000_000) }
            try? await Task.sleep(nanoseconds: 300_000_000)
            send(m)
        case (.ghost, .ghost(let l)):
            ghostPending = l
            try? await Task.sleep(nanoseconds: 400_000_000)
            send(m)
        default:
            send(m)
        }
    }
    #endif

    /// The Leave dialog: the game's art, "Your game waits for you", and one button back to Friends.
    /// A tap on the dimmed screen keeps playing.
    private var leaveCard: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()
                .onTapGesture { confirmClose = false }
                .accessibilityHidden(true)
            VStack(spacing: 12) {
                if let kind, let art = kind.pocketArt { GameArtImage(asset: art, size: 64) }
                BubbleTextView(text: "YOUR GAME WAITS FOR YOU", palette: .accent(gameAccent), maxSize: 26, minSize: 16, animated: false)
                Text("Pick it up any time. \(themName) gets a ping.").font(Brand.font(12, .bold))
                    .foregroundStyle(FriendsInk.muted).multilineTextAlignment(.center)
                Button { confirmClose = false; dismiss() } label: {
                    CandyLabel(title: "Back to Friends", symbol: "chevron.left")
                }
                .buttonStyle(CandyButtonStyle(variant: .pink, size: .large))
                .padding(.top, 2)
            }
            .padding(20)
            .frame(maxWidth: 320)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(FriendsInk.nightCard ?? Color(hex: 0xFFF0F7))
                .shadow(color: FriendsKit.ink.opacity(0.25), radius: 18, y: 8))
            .padding(.horizontal, 24)
        }
        .transition(.opacity)
        .accessibilityAddTraits(.isModal)
    }

    // MARK: Data

    private func poll() async {
        live.stop()
        while !Task.isCancelled {
            await refresh()
            startLiveIfNeeded()
            // Over: one last read is enough — the result won't change.
            if let g = game, !g.isActive { live.stop(); return }
            // Live play on + socket up: a slow keep-alive (it also stamps "watching" and repairs a
            // missed broadcast); socket down: a 4 s fallback; switch off: today's 2 s.
            var waited = 0
            while waited < FriendlyLive.pollIntervalMs(liveOn: liveOn, socketUp: live.socketUp), !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 250_000_000)
                waited += 250
            }
        }
    }

    /// Open the game's Realtime channel once the opponent is known (live_play on, game still going).
    private func startLiveIfNeeded() {
        guard liveOn, !live.isStarted, let g = game, g.isActive,
              let uid = AuthService.shared.profile?.id else { return }
        live.onView = { apply($0) }
        live.onRefetch = { Task { await refresh() } }
        live.onReaction = { key in addFloater(key) }
        live.start(gameId: g.id, userId: uid, opponentId: g.opponent.id)
    }

    private func refresh() async {
        switch await FriendlyGamesService.get(gameId) {
        case .success(let g): apply(g)
        case .failure(.message(let m)): if game == nil { loadError = m == "Not found" ? Self.goneLine : m }
        case .failure: if game == nil { loadError = "Could not load the game." }
        }
    }

    /// Take a newer view (a slow poll never rolls a fresh move back).
    /// `own` = the reply to MY move (it replaces my prediction); otherwise a poll / broadcast /
    /// backup refetch, which only counts when it is a strictly newer save.
    private func apply(_ g: FriendlyGameView, own: Bool = false) {
        guard g.id == gameId else { return }
        if own {
            snap.confirmMove(g)
        } else {
            let r = snap.receive(g)
            guard r.applied else { return }
            // The friend moved: an old error ("The game moved on") and a half-typed attempt from before their move are
            // stale (Android parity: its boards reset on the same change).
            if r.change.moved {
                moveError = nil
                passInput = ""
                ghostPending = nil
                chainTyped = ""
            }
            // A change that lands while my own move is in flight is my move, not the friend's.
            if liveOn && !sending {
                if r.change.moved && g.isActive {
                    Feedback.keyTap()
                    arrivePulse()
                }
                if r.change.yourTurnStarted {
                    turnPulse += 1
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) { Feedback.notify() }
                }
            }
        }
        showSnapshot()
    }

    private var chainAnimOff: Bool {
        #if DEBUG
        return PerfTour.flag("noChainAnim")
        #else
        return false
        #endif
    }

    private func showSnapshot() {
        let d = snap.displayed
        #if DEBUG
        if PerfTour.flag("noSpring") { if game != d { game = d }; return }
        #endif
        if game != d { withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { game = d } }
    }

    private func arrivePulse() {
        guard !Theme.reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.13)) { arrived = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.13) { withAnimation(.easeIn(duration: 0.13)) { arrived = false } }
    }

    /// A rejected optimistic move: the prediction is dropped, the board gives a gentle shake.
    private func rollBackMove() {
        guard snap.rejectMove() else { return }
        showSnapshot()
        if !Theme.reduceMotion { withAnimation(.easeOut(duration: 0.35)) { shakeCount += 1 } }
        Feedback.notAWord()
    }

    private func moveWithTimeout(_ id: String, _ m: FriendlyMove) async -> Result<FriendlyGameView, FriendlyGamesService.Failure> {
        await withTaskGroup(of: Result<FriendlyGameView, FriendlyGamesService.Failure>.self) { group in
            group.addTask { await FriendlyGamesService.move(id, m) }
            group.addTask { () -> Result<FriendlyGameView, FriendlyGamesService.Failure> in
                try? await Task.sleep(nanoseconds: UInt64(FriendlyLive.optimisticTimeoutMs) * 1_000_000)
                return .failure(.network)
            }
            let first = await group.next() ?? .failure(.network)
            group.cancelAll()
            return first
        }
    }

    private func send(_ m: FriendlyMove) {
        guard let g = game, g.isActive, !sending else { return }
        sending = true
        moveError = nil
        // Optimistic: my piece / pick / word lands at once with its sound; the server can still say no.
        var optimistic = false
        if liveOn, snap.beginMove(m) {
            optimistic = true
            showSnapshot()
            Feedback.keyTap()
        }
        let wasOptimistic = optimistic
        Task {
            let r = wasOptimistic ? await moveWithTimeout(g.id, m) : await FriendlyGamesService.move(g.id, m)
            sending = false
            if wasOptimistic {
                if case .success = r {} else { rollBackMove() }
            }
            switch r {
            case .success(let ng):
                apply(ng, own: true)
                switch m {
                case .pass: passInput = ""
                case .ghost: ghostPending = nil
                case .chain: chainTyped = ""
                default: break
                }
                if !ng.isActive { ng.result == "win" ? Haptics.success() : Haptics.tap() } else if !wasOptimistic { Haptics.tap() }
            case .failure(.retry):
                // Read the new state first (it clears stale input), then say why the move didn't land.
                await refresh()
                moveError = "The game moved on — try again"
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
            if case .success(let ng) = await FriendlyGamesService.resign(g.id) { apply(ng, own: true) }
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
                snap = FriendlyLive.Snapshot(confirmed: ng)
                withAnimation { game = ng }
            case .failure(.message(let m)): moveError = m
            case .failure: moveError = "Could not start a rematch — try again"
            }
        }
    }

    /// A heading-style label in bubble lettering (the game's accent; names in their player's color).
    private func heading(_ t: String, size: CGFloat = 15, names: [String] = [], nameColor: Color? = nil) -> some View {
        PocketBubble(text: t, color: gameAccent, size: size, names: names, nameColor: nameColor, minScale: 0.5)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: Top bar

    private var topBar: some View {
        // Slice 5 (R4, iPad): the title art is ~2x its phone height on EXPANDED (1.6x MEDIUM), the corner buttons 1.3x.
        let tt = tabletTitleScale(widthClass)
        let ch = tabletChromeScale(widthClass)
        return ZStack {
            HStack(spacing: 6 * tt) {
                // ART_SPEC §9: the pocket game's 3D icon beside its title.
                if let kind, kind.pocketArt != nil { FriendlyGameIcon(kind: kind, size: 28 * tt, glow: false) }
                // Founder 10-10: the title is BIG custom lettering in the game's own accent (one line, shrinks between the X and the ?).
                BubbleTextView(text: (game?.title ?? "").uppercased(), palette: .accent(gameAccent),
                               maxSize: 32 * tt, minSize: 18 * tt, animated: true)
                    .frame(height: 44 * tt)
            }
            .padding(.horizontal, 52 * ch)
            HStack {
                HeaderCircleButton(.symbol("xmark"), size: PageHeaderStyle.circle * ch, label: "Close") {
                    if game?.isActive == true { confirmClose = true } else { dismiss() }
                }
                Spacer()
                // Wave 3 (9c): the "?" in the top-right corner, same control as every other game's header.
                if kind != nil {
                    HeaderCircleButton(.icon(.help), size: 44 * ch, iconSize: HeaderControl.gameIcon * ch, label: "How to play") {
                        showHelp = true
                    }
                }
            }
        }
        .padding(.horizontal, 8).padding(.top, 4).frame(height: 48 * tt)
    }

    /// The fixed-height slot under the score window (see `body`).
    static let turnSlotHeight: CGFloat = 64

    @ViewBuilder private func turnSlot(_ g: FriendlyGameView) -> some View {
        ZStack {
            if g.isActive && g.yourTurn { PocketYourTurnFlag() }
            // Item 22: their turn = a slim lobby strip above the board (board stays visible).
            if g.isActive && !g.yourTurn {
                PocketWaitStrip(name: themName, since: g.updatedAt, nameColor: themColor, accent: gameAccent)
            }
            if !g.isActive, let outcome = Self.resultOutcome(g) {
                ResultHost(outcome: outcome, winner: Mascots.pocketWin)
                    .scaleEffect(Self.turnSlotHeight / 92)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: Self.turnSlotHeight, alignment: .center)
        .zIndex(1)   // an opened lobby mini game overlays the board instead of pushing it
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
                PocketBubble(text: headline(g), color: accent, size: 21, names: [themName], nameColor: themColor,
                             minScale: 0.5, alignment: .leading, hug: false)
                // Founder 10-10 (RPS: the tiny lettered line was hard to read): plain heavy text.
                Text(subLine(g)).font(Brand.font(12, .heavy)).tracking(0.3)
                    .foregroundStyle(FriendsInk.dark ? Color(hex: 0xF9A8D4) : Color(hex: 0xB0306F))
                    .lineLimit(2, reservesSpace: true).minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(FriendsInk.pink.vsWash(0.08))
            HStack(spacing: 0) {
                half(label: "YOU", labelColor: myColor, url: profile?.avatarUrl, name: profile?.username ?? "You", emoji: profile?.avatarEmoji,
                     score: score?[g.me], online: false, leading: true, toPlay: toPlay(g, g.me))
                half(label: themName.uppercased(), labelColor: themColor, url: g.opponent.avatarUrl, name: themName, emoji: g.opponent.avatarEmoji,
                     score: score?[g.me.other], online: livePresence(g) != nil ? live.peerPresent : (themOnline && g.isActive),
                     leading: false, toPlay: toPlay(g, g.me.other), status: presenceChip(g))
            }
        }
        .background {
            ZStack {
                // Your half lavender, theirs amber — deeper on the match winner's side.
                if let night = FriendsInk.nightCard {
                    // Halloween: the halves are the season's night glass with your purple / their amber over it.
                    HStack(spacing: 0) {
                        FriendsKit.purple.mixed(over: night, won ? 0.34 : 0.2)
                        FriendsKit.amber.mixed(over: night, g.result == "loss" ? 0.3 : 0.16)
                    }
                } else {
                    HStack(spacing: 0) {
                        Color(hex: won ? 0xDDD6FE : 0xEDE9FE)
                        Color(hex: g.result == "loss" ? 0xFDE68A : 0xFEF3C7)
                    }
                    LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                }
                if won && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
            }
        }
        .clipShape(shape)
        .overlay(shape.stroke(accent.vsWash(0.30), lineWidth: 1.5).allowsHitTesting(false))
        .shadow(color: won ? FriendsKit.purple.opacity(0.35) : FriendsKit.ink.opacity(0.08), radius: won ? 10 : 7, x: 0, y: 4)
    }

    // MARK: Live play (9b)

    /// here / thinking / left once the socket is up on a live game; nil = the old online dot.
    private func livePresence(_ g: FriendlyGameView) -> FriendlyLive.PresenceLabel? {
        guard liveOn, live.socketUp, g.isActive else { return nil }
        return FriendlyLive.presenceLabel(peerPresent: live.peerPresent, everSeen: live.peerEverSeen,
                                          theirTurn: toPlay(g, g.me.other))
    }

    /// The friend side's chip: THINKING… on their turn while they are here; HERE NOW / LEFT THE GAME otherwise.
    private func presenceChip(_ g: FriendlyGameView) -> (text: String, tone: Color)? {
        guard let p = livePresence(g) else { return nil }
        let theirTurn = toPlay(g, g.me.other)
        switch p {
        case .thinking: return (FriendlyLive.presenceCopy(.thinking), FriendsKit.amber)
        case .here: return theirTurn ? nil : (FriendlyLive.presenceCopy(.here), FriendsKit.green)
        case .left: return (FriendlyLive.presenceCopy(.left), Color(hex: 0x94A3B8))
        case .away: return nil
        }
    }

    private var reactionBar: some View {
        HStack(spacing: 8) {
            ForEach(FriendlyLive.reactions, id: \.self) { key in
                Button {
                    if live.sendReaction(key) { addFloater(key); Feedback.keyTap() }
                } label: {
                    ReactionGlyph(key: key, size: 30)
                }
                .buttonStyle(RoundIconButtonStyle())
                .accessibilityLabel("Send \(Reaction.word(key))")
            }
        }
        .frame(maxWidth: .infinity)
    }

    struct LiveFloater: Identifiable { let id = UUID(); let key: String; let x: CGFloat }

    private func addFloater(_ key: String) {
        let f = LiveFloater(key: key, x: CGFloat.random(in: -0.35...0.35))
        floaters = Array(floaters.suffix(5)) + [f]
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(FriendlyLive.reactLifetimeMs)) {
            floaters.removeAll { $0.id == f.id }
        }
    }

    @ViewBuilder private var liveFloaters: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                ForEach(floaters) { f in
                    LiveFloat(key: f.key).offset(x: f.x * geo.size.width)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .bottom)
        }
        .allowsHitTesting(false).accessibilityHidden(true)
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

    private func half(label: String, labelColor: Color, url: String?, name: String, emoji: String?, score: Int?, online: Bool, leading: Bool, toPlay: Bool,
                      status: (text: String, tone: Color)? = nil) -> some View {
        HStack(spacing: 10) {
            if !leading { Spacer(minLength: 0) }
            if leading { FriendsPresenceAvatar(url: url, username: name, emoji: emoji, size: 40, online: online).frame(width: 46, height: 46) }
            VStack(alignment: leading ? .leading : .trailing, spacing: 0) {
                // Founder 10-10: the name is bubble lettering in the player's own name color (a long name shrinks to fit).
                PocketBubble(text: label, color: labelColor, size: 15, minScale: 0.4, alignment: leading ? .leading : .trailing, hug: false)
                    .frame(maxWidth: 120, alignment: leading ? .leading : .trailing)
                if let status {
                    // 9b presence: THINKING... / HERE NOW / LEFT THE GAME takes the TO PLAY chip's slot.
                    PocketBubble(text: status.text, color: .white, size: 10.5, palette: PlayerTint.platePalette(lightInk: true), minScale: 0.5)
                        .padding(.horizontal, 7).frame(height: 19)
                        .background(Capsule().fill(status.tone))
                        .padding(.top, 2)
                } else if toPlay {
                    HStack(spacing: 3) {
                        // Wave 3 (9d): the turn marker beside whose move it is.
                        if !leading { PocketMarker(art: PocketArt.turnMarker, size: 15) }
                        PocketBubble(text: "TO PLAY", color: .white, size: 10.5, palette: PlayerTint.platePalette(lightInk: true))
                            .padding(.horizontal, 7).frame(height: 19)
                            .background(Capsule().fill(leading ? FriendsKit.purple : FriendsKit.amber))
                        if leading { PocketMarker(art: PocketArt.turnMarker, size: 15) }
                    }
                    .padding(.top, 2)
                } else {
                    // The chip's slot stays reserved (nobody to play once it is over) so the banner never changes height.
                    Color.clear.frame(height: 19).padding(.top, 2)
                }
                if let score {
                    // §A2: the score in the bubble numerals.
                    PocketBubble(text: "\(score)", color: leading ? FriendsKit.purple : Color(hex: 0xB45309), size: 36)
                }
            }
            if !leading { FriendsPresenceAvatar(url: url, username: name, emoji: emoji, size: 40, online: online).frame(width: 46, height: 46) }
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

    @ViewBuilder private func board(_ g: FriendlyGameView, room: CGFloat?) -> some View {
        switch g.state {
        case .rps(let r): rpsBoard(g, r)
        case .ttt(let t): tttBoard(g, t)
        case .coin(let c): coinBoard(g, c)
        case .pass(let p): passBoard(g, p, room: room)
        case .ghost(let gs): ghostBoard(g, gs)
        case .chain(let c): chainBoard(g, c, room: room).padding(.top, -8)
        }
    }

    /// The height the pinned-keyboard games' board may take: from where it starts to the bottom of the scroll area, less what
    /// sits under it (Pass the Puzzle's status line, Word Chain's legend) and a little air. nil until measured.
    private func boardRoom(_ g: FriendlyGameView) -> CGFloat? {
        guard g.kind == .pass || g.kind == .chain, viewportH > 0, boardTop > 0 else { return nil }
        // Pass the Puzzle keeps its status line under the tray; Word Chain has nothing under the frame (the color legend is
        // gone, the score window already carries the colors) and pulls the frame up under the turn slot by 8 pt.
        if g.kind == .chain { return max(120, viewportH - boardTop + 8 - 6) }
        return max(120, viewportH - boardTop - 34 - 10)
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

    private func art(_ p: RpsPick) -> String { PocketArt.rps(p) }

    @ViewBuilder private func rpsBoard(_ g: FriendlyGameView, _ r: RpsState) -> some View {
        let me = g.me
        let mine = r.picks[me]?.pick
        let theirs = r.picks[me.other]
        // Slice 5 (iPad): the arena band, the hands and the pick cards grow 1.6x so the page is filled, not sparse.
        let s: CGFloat = widthClass == .compact ? 1 : 1.6
        VStack(spacing: 14) {
            if let last = r.rounds.last {
                let reveal = RpsReveal(round: r.rounds.count, mine: last[me], theirs: last[me.other],
                          winner: last.winner.map { $0 == me ? 1 : 2 } ?? 0, them: themName,
                          accent: gameAccent, myColor: myColor, themColor: themColor, scale: s)
                    .id(r.rounds.count)
                    .frame(maxWidth: .infinity)
                // Founder 10-13: with the ring and the audience wallpaper the card is the arena itself (no tray around it).
                if PocketArt.ring != nil && PocketArt.rpsBackdrop != nil {
                    reveal
                } else {
                    reveal.gameTray(accent: FriendsKit.tileAccent(.rps), state: g.isActive ? .normal : trayState(g))
                }
            } else if PocketArt.ring != nil && PocketArt.rpsBackdrop != nil {
                // Before the first round the same arena stands empty, so the first reveal never pushes the picks down.
                RpsArenaEmpty(scale: s)
            }
            if g.isActive {
                VStack(spacing: 6) {
                    Group {
                        if let hidden = PocketArt.rpsHidden {
                            // Founder 10-10: while they're picking, their hand cycles rock → paper → scissors (one cheap swap every
                            // 0.42 s, no running animation; still under Reduce Motion); once their pick is in, the face-down fist
                            // (the art's fist only — its "?" bubble was cut off and the founder dropped it).
                            Group {
                            if theirs == nil {
                                if Theme.reduceMotion {
                                    Image(PocketArt.rps(.rock)).resizable().interpolation(.high).scaledToFit()
                                        .frame(width: 80 * s, height: 80 * s).opacity(0.6)
                                } else {
                                    TimelineView(.periodic(from: .now, by: 0.42)) { ctx in
                                        let i = Int(ctx.date.timeIntervalSinceReferenceDate / 0.42) % RpsPick.allCases.count
                                        Image(PocketArt.rps(RpsPick.allCases[i])).resizable().interpolation(.high).scaledToFit()
                                            .frame(width: 80 * s, height: 80 * s)
                                            .opacity(0.75)
                                    }
                                }
                            } else {
                                Image(hidden).resizable().interpolation(.high).scaledToFill()
                                    .frame(width: 92 * s, height: 116 * s, alignment: .bottom)
                                    .frame(width: 92 * s, height: 74 * s, alignment: .bottom)
                                    .clipped()
                            }
                            }
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(theirs != nil ? "\(themName)'s hand, face down" : "Waiting for \(themName)'s hand")
                        } else {
                            ZStack {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(LinearGradient(colors: [Color(hex: 0xFBCFE8), Color(hex: 0xDDD6FE)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(Color.white.opacity(0.7), style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                                    .padding(8)
                                PocketBubble(text: "?", color: .white, size: 44 * s, palette: PlayerTint.platePalette(lightInk: true))
                            }
                        }
                    }
                    .frame(width: 92 * s, height: 112 * s)
                    .shadow(color: FriendsKit.ink.opacity(0.12), radius: 6, y: 3)
                    if theirs != nil {
                        HStack(spacing: 5) {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 14 * s, weight: .black)).foregroundStyle(FriendsKit.green)
                                .accessibilityHidden(true)
                            PocketBubble(text: "\(themName) picked", color: FriendsKit.green, size: 14 * s, names: [themName], nameColor: themColor)
                        }
                    } else {
                        PocketBubble(text: "\(themName) is picking...", color: FriendsInk.muted, size: 14 * s, names: [themName], nameColor: themColor)
                    }
                }
                VStack(spacing: 8) {
                    heading("Your pick").layoutLog("picks")
                    HStack(spacing: 10 * s) {
                        ForEach(RpsPick.allCases, id: \.self) { p in
                            let selected = mine == p
                            let rps = FriendsKit.tileAccent(.rps)
                            Button { send(.rps(p)) } label: {
                                VStack(spacing: 4) {
                                    Image(art(p)).resizable().interpolation(.high).scaledToFit().frame(width: 70 * s, height: 70 * s)
                                        .accessibilityHidden(true)   // §AB: the word below names it
                                    PocketBubble(text: p.rawValue, color: rps, size: 14 * s,
                                                 palette: (selected || Theme.isDark) ? PlayerTint.platePalette(lightInk: true) : nil, minScale: 0.5)
                                }
                                .frame(maxWidth: .infinity).frame(height: 114 * s)
                                // §A1: tinted pick cards (selected = filled purple).
                                .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(selected ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xA66BFF), FriendsKit.purple], startPoint: .top, endPoint: .bottom))
                                                   : AnyShapeStyle(rps.vsWash(0.13)))
                                    .shadow(color: selected ? FriendsKit.purple.opacity(0.55) : rps.opacity(0.18),
                                            radius: selected ? 9 : 5, y: 3))
                                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(selected ? Color(hex: 0x6D28D9) : rps.vsWash(0.34), lineWidth: 1.5))
                                .opacity(mine != nil && !selected ? 0.45 : 1)
                            }
                            .buttonStyle(.squish)
                            .disabled(mine != nil || sending)
                            .accessibilityLabel(p.rawValue.capitalized)
                            .accessibilityAddTraits(selected ? .isSelected : [])
                        }
                    }
                    .gameTray(accent: FriendsKit.tileAccent(.rps), state: trayState(g))
                    PocketBubble(text: mine != nil ? "Locked in. Both picks flip at once." : "Both picks flip at once.",
                                 color: FriendsInk.muted, size: 13, minScale: 0.4)
                }
            }
        }
    }

    // Tic-Tac-Tile

    @ViewBuilder private func tttBoard(_ g: FriendlyGameView, _ t: TttState) -> some View {
        let me = g.me
        let myMove = g.isActive && g.yourTurn
        // §J2: the winning three glow.
        let winCells = FriendlyGames.tttLine(t.board)?.cells ?? []
        let line = Set(winCells)
        let accent = FriendsKit.tileAccent(.ttt)
        VStack(spacing: 12) {
            if let grid = PocketArt.tttGrid {
                // Founder 10-13: the classic # board art; the X / O tiles fill each cell to its edges (a 4% inset) and a tap
                // anywhere in a cell plays it.
                PocketBoardArt(art: grid, pixels: PocketBoard.tttPixels) { scale in
                    ForEach(0..<9, id: \.self) { i in
                        let mark = t.board[i]
                        let wins: Bool = {
                            guard myMove, mark == nil else { return false }
                            var b = t.board; b[i] = me
                            return FriendlyGames.tttLine(b) != nil
                        }()
                        let rect = PocketBoard.tttCell(i)
                        Button { send(.ttt(i)) } label: {
                            tttGridCell(mark: mark, mine: mark == me, wins: wins, glow: line.contains(i),
                                        size: CGSize(width: rect.width * scale, height: rect.height * scale))
                        }
                        .buttonStyle(.squish)
                        .disabled(!myMove || mark != nil || sending)
                        .accessibilityLabel(mark == nil ? "Empty tile \(i + 1)" : mark == me ? "Your tile" : "\(themName)'s tile")
                        .placed(rect, scale: scale)
                    }
                    // Wave 3: the strike draws through the winning three.
                    if !winCells.isEmpty { TttStrikeView(cells: winCells, scale: scale) }
                }
            } else {
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
                .gameTray(accent: accent, state: trayState(g))
            }
            HStack(spacing: 16) {
                pieceLegend("YOU · X", piece: PocketArt.ttt(mine: true) ?? "art-piece-ttt-x", fallback: FriendsKit.purple, ink: myColor)
                pieceLegend("\(themName.uppercased()) · O", piece: PocketArt.ttt(mine: false) ?? "art-piece-ttt-o", fallback: FriendsInk.pink, ink: themColor)
            }
        }
    }

    /// One cell of the # board art: nothing drawn when empty (the lilac slab is the cell; a dashed gold outline marks the
    /// move that would win), or the X / O tile art filling the cell, dropping in with the type pop; the winning three glow.
    private func tttGridCell(mark: FriendlySide?, mine: Bool, wins: Bool, glow: Bool, size: CGSize) -> some View {
        let tint = mine ? FriendsKit.purple : FriendsInk.pink
        return ZStack {
            if mark != nil {
                tttPiece(mine: mine)
                    .padding(min(size.width, size.height) * 0.04)
                    .shadow(color: glow ? tint.opacity(0.75) : .clear, radius: glow ? 10 : 0)
            } else if wins {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color(hex: 0xF5B82E), style: StrokeStyle(lineWidth: 2.5, dash: [6, 4]))
                    .padding(min(size.width, size.height) * 0.04)
            }
        }
        .frame(width: size.width, height: size.height)
        .contentShape(Rectangle())
        .modifier(TypePop(letter: mark == nil ? "" : "x", size: size))
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
                shape.fill(tint.vsWash(0.16))
                shape.stroke(tint.vsWash(glow ? 0.9 : 0.4), lineWidth: glow ? 2.5 : 1.5)
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
        if let name = PocketArt.ttt(mine: mine) {
            Image(name).resizable().interpolation(.high).scaledToFit().accessibilityHidden(true)
        } else {
            Image(systemName: mine ? "xmark" : "circle")
                .font(.system(size: 40, weight: .heavy))
                .foregroundStyle(mine ? FriendsKit.purple : FriendsInk.pink)
        }
    }

    private func pieceLegend(_ text: String, piece: String, fallback: Color, ink: Color) -> some View {
        HStack(spacing: 5) {
            if ArtAsset.exists(piece) {
                Image(piece).resizable().interpolation(.high).scaledToFit().frame(width: 16, height: 16)
                    .accessibilityHidden(true)
            } else {
                RoundedRectangle(cornerRadius: 4).fill(fallback).frame(width: 12, height: 12)
            }
            PocketBubble(text: text, color: ink, size: 13, minScale: 0.4)
        }
    }

    private func legend(_ text: String, _ c: Color, ink: Color) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 4).fill(c).frame(width: 12, height: 12)
            PocketBubble(text: text, color: ink, size: 13, minScale: 0.4)
        }
    }

    // Call It

    @ViewBuilder private func coinBoard(_ g: FriendlyGameView, _ c: CoinState) -> some View {
        let myCall = g.isActive && g.yourTurn
        VStack(spacing: 14) {
            // §L: the coin sits on the shared tray; founder 10-13: on the velvet stage in front of the theater backdrop
            // (the plain tray when that art is missing).
            let caption: AnyView? = c.rounds.last.map { last in
                let who = last.caller == g.me ? "You" : themName
                return AnyView(PocketBubble(text: "\(who) called \(last.call.rawValue) · it landed \(last.flip.rawValue)",
                                            color: FriendsInk.muted, size: 13,
                                            names: [who], nameColor: last.caller == g.me ? myColor : themColor, minScale: 0.4))
            }
            // The result line rides with the coin and appears only once it has landed (no spoiler mid-flip).
            if PocketArt.coinStage != nil && PocketArt.coinBackdrop != nil {
                SpinningCoin(face: c.rounds.last?.flip ?? .heads, spinKey: c.rounds.count, caption: caption, staged: true)
                    .id(g.id)
                    .frame(maxWidth: .infinity)
            } else {
                VStack(spacing: 8) {
                    SpinningCoin(face: c.rounds.last?.flip ?? .heads, spinKey: c.rounds.count, caption: caption)
                        .id(g.id)   // a rematch is a new coin (no leftover flip key spinning the new game's placeholder)
                }
                .frame(maxWidth: .infinity)
                .gameTray(accent: FriendsKit.tileAccent(.coin), state: trayState(g))
            }
            // Founder 10-13 (no screen shifting): the call slot is ALWAYS laid out (the HEADS / TAILS buttons are invisible on
            // their call and once it is over), so the stake line never moves between states.
            VStack(spacing: 14) {
                if myCall || !g.isActive {
                    heading("Your call").layoutLog("heading")
                } else {
                    heading("\(themName) calls", names: [themName], nameColor: themColor).layoutLog("heading")
                }
                HStack(spacing: 10) {
                    callButton("HEADS", solid: true) { send(.coin(.heads)) }
                    callButton("TAILS", solid: false) { send(.coin(.tails)) }
                }
                .opacity(myCall ? 1 : 0)
                .allowsHitTesting(myCall)
                .accessibilityHidden(!myCall)
            }
            .opacity(g.isActive ? 1 : 0)
            VStack(spacing: 6) {
                heading("What's on the line")
                PocketBubble(text: c.stake, color: FriendsKit.purple, size: 14, palette: PlayerTint.platePalette(lightInk: FriendsInk.dark))
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

    @ViewBuilder private func passBoard(_ g: FriendlyGameView, _ p: PassState, room: CGFloat?) -> some View {
        let profile = AuthService.shared.profile
        let typing = g.isActive && g.yourTurn
        if let tray = PocketArt.passTray {
            // Founder 10-13: the puzzle-piece tray. The six guess rows and their ring markers sit as one group, centered
            // in the piece's body (rings close to the tiles, a gap of ~12% of a tile).
            PocketBoardArt(art: tray, pixels: PocketBoard.passPixels, maxHeight: room) { scale in
                let t: CGFloat = 76                       // tile, in art pixels
                let gap = t * 0.16, ring = t * 0.62, ringGap = t * 0.12
                let groupW = ring + ringGap + 5 * t + 4 * gap
                let groupH = 6 * t + 5 * gap
                let body = PocketBoard.passBody
                VStack(spacing: gap * scale) {
                    ForEach(0..<FriendlyGames.passMaxGuesses, id: \.self) { row in
                        HStack(spacing: ringGap * scale) {
                            passMarker(row: row, g: g, p: p, profile: profile, size: ring * scale)
                                .frame(width: ring * scale, height: ring * scale)
                            HStack(spacing: gap * scale) {
                                ForEach(0..<5, id: \.self) { col in
                                    passTile(row: row, col: col, p: p, typing: typing, width: t * scale)
                                }
                            }
                        }
                    }
                }
                .placed(CGRect(x: body.midX - groupW / 2, y: body.midY - groupH / 2, width: groupW, height: groupH), scale: scale)
            }
        } else {
            VStack(spacing: 6) {
                ForEach(0..<FriendlyGames.passMaxGuesses, id: \.self) { row in
                    HStack(spacing: 6) {
                        passMarker(row: row, g: g, p: p, profile: profile, size: 26)
                            .frame(width: 28)
                        ForEach(0..<5, id: \.self) { col in
                            passTile(row: row, col: col, p: p, typing: typing, width: 44)
                        }
                    }
                }
            }
            // §L: the board sits on the shared tray.
            .gameTray(accent: FriendsKit.tileAccent(.pass), state: trayState(g))
        }
        if !g.isActive, let answer = g.answer {
            HStack(spacing: 7) {
                PocketBubble(text: "The word was", color: gameAccent, size: 16)
                PocketBubble(text: answer, color: Color(hex: 0xF59E0B), size: 20)
            }
            .frame(height: 28)
        } else {
            // A fixed-height status slot (blank on my turn): the tray above never moves between turns.
            HStack(spacing: 6) {
                PocketMarker(art: PocketArt.puzzlePiece, size: 22)
                PocketBubble(text: "\(themName)'s guess - you'll see it land here.", color: FriendsInk.muted, size: 13,
                             names: [themName], nameColor: themColor, minScale: 0.4)
            }
            .opacity(g.isActive && !g.yourTurn ? 1 : 0)
            .accessibilityHidden(!(g.isActive && !g.yourTurn))
            .frame(height: 28)
        }
    }

    /// §B1: the Pass the Puzzle tiles are the game kit's glossy tiles (purple right
    /// spot, gold wrong spot, slate not in the word; frosted empty, typed white).
    private func passTile(row: Int, col: Int, p: PassState, typing: Bool, width: CGFloat) -> some View {
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
        return PocketTile(face: face, letter: letter, width: width, pop: row < p.guesses.count)
            .modifier(TypePop(letter: face == .typed ? letter : "", size: CGSize(width: width, height: width)))
    }

    /// The marker left of a guess row: who played it (their avatar, outlined in their color), or the open ring (gold on the
    /// tray art, the old tinted disc without it).
    @ViewBuilder private func passMarker(row: Int, g: FriendlyGameView, p: PassState, profile: Profile?, size: CGFloat) -> some View {
        if row < p.guesses.count {
            let by = p.guesses[row].by
            if by == g.me {
                AvatarView(url: profile?.avatarUrl, username: profile?.username ?? "You", size: size, emoji: profile?.avatarEmoji)
                    .overlay(AvatarOutline(tile: AvatarView.showsTile(profile?.avatarUrl)).stroke(FriendsKit.purple, lineWidth: 2))
            } else {
                AvatarView(url: g.opponent.avatarUrl, username: themName, size: size, emoji: g.opponent.avatarEmoji)
                    .overlay(AvatarOutline(tile: AvatarView.showsTile(g.opponent.avatarUrl)).stroke(FriendsKit.amber, lineWidth: 2))
            }
        } else if PocketArt.passTray != nil {
            Circle().strokeBorder(Color(hex: 0xF5B82E), lineWidth: max(1.5, size * 0.07)).frame(width: size, height: size)
        } else {
            Circle().fill(FriendsKit.tileAccent(.pass).vsWash(0.14)).frame(width: size, height: size)
                .overlay(Circle().stroke(FriendsKit.tileAccent(.pass).vsWash(0.4), lineWidth: 1))
        }
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
        VStack(spacing: 8) {
            // The match is over: how the last round went (in play it sits UNDER the tray, so the tray never moves).
            if !g.isActive, let last = s.rounds.last, s.fragment.isEmpty {
                ghostRoundCard(last, round: s.rounds.count, me: me)
                    .id("ghost-round-\(s.rounds.count)")
                    .transition(.scale(scale: 0.95).combined(with: .opacity))
            }
            if g.isActive {
                heading(s.fragment.isEmpty ? (myLetter ? "Start the word" : "\(themName) starts") : "The letters so far",
                        names: [themName], nameColor: themColor)
                if let tray = PocketArt.ghostTray {
                    // Founder 10-13: the ghost-shaped tray. The fragment's tiles sit centered in its plum panel, the newest
                    // letter gold, a dashed outline marking the next slot. Tiles shrink only if a long fragment needs it.
                    PocketBoardArt(art: tray, pixels: PocketBoard.ghostPixels, maxWidth: 340) { scale in
                        let panel = PocketBoard.ghostPanel
                        let slots = letters.count + ((myLetter || letters.isEmpty) ? 1 : 0)
                        // Founder 10-13: tiles ~83% of the plum panel's height, shrinking only when the fragment and the
                        // next slot would not fit the panel's width.
                        let n = CGFloat(max(slots, 1))
                        let t = min(panel.height * 0.83, (panel.width - 40) / (n + 0.16 * (n - 1)))
                        HStack(spacing: t * 0.16 * scale) {
                            ForEach(letters.indices, id: \.self) { i in
                                PocketTile(face: i == letters.count - 1 ? .present : .correct, letter: letters[i],
                                           width: t * scale, pop: true)
                                    .modifier(TypePop(letter: "", size: CGSize(width: t * scale, height: t * scale)))
                                    .accessibilityLabel(letters[i])
                                    .transition(.scale.combined(with: .opacity))
                            }
                            if myLetter {
                                ghostNextSlot(ghostPending ?? "", width: t * scale, dim: false)
                            } else if letters.isEmpty {
                                ghostNextSlot("", width: t * scale, dim: true)
                            }
                        }
                        .frame(width: panel.width * scale, height: panel.height * scale)
                        .position(x: panel.midX * scale, y: panel.midY * scale)
                    }
                    .animation(Theme.reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.75), value: s.fragment)
                } else {
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
                }
                // Founder 10-13 (no screen shifting): ONE fixed-height slot under the tray. In play it holds "<friend> is adding a
                // letter..." (invisible on my turn) and the rules line; a round that just ended COVERS it with what happened.
                let roundOver = s.rounds.last != nil && s.fragment.isEmpty
                ZStack(alignment: .top) {
                    VStack(spacing: 6) {
                        HStack(spacing: 6) {
                            PocketMarker(art: PocketArt.ghostMarker, size: 22)
                            PocketBubble(text: "\(themName) is adding a letter...", color: FriendsInk.muted, size: 13,
                                         names: [themName], nameColor: themColor, minScale: 0.4)
                        }
                        .opacity(myLetter ? 0 : 1)
                        .accessibilityHidden(myLetter)
                        Text("Spell a word and you lose the round. Leave a dead end and you lose it too.")
                            .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                        if PocketArt.ghostTray == nil {
                            HStack(spacing: 16) {
                                legend("YOU", TilePalette.correct.base, ink: myColor)
                                legend(themName.uppercased(), TilePalette.present.base, ink: themColor)
                            }
                        }
                    }
                    .opacity(roundOver ? 0 : 1)
                    if roundOver, let last = s.rounds.last {
                        ghostRoundCard(last, round: s.rounds.count, me: me)
                            .id("ghost-round-\(s.rounds.count)")
                            .transition(.opacity)
                    }
                }
                .frame(minHeight: 100, alignment: .top)
                .layoutLog("ghostslot")
            }
        }
    }

    /// The slot for the next letter on the ghost tray: a dashed gold outline while empty, the typed tile once a letter is picked.
    @ViewBuilder private func ghostNextSlot(_ letter: String, width: CGFloat, dim: Bool) -> some View {
        ZStack {
            if letter.isEmpty {
                RoundedRectangle(cornerRadius: width * 0.2, style: .continuous)
                    .strokeBorder(Color(hex: 0xFDE68A), style: StrokeStyle(lineWidth: max(1.5, width * 0.06), dash: [width * 0.14, width * 0.1]))
                    .frame(width: width, height: width)
            } else {
                PocketTile(face: .typed, letter: letter, width: width)
                    .modifier(TypePop(letter: letter, size: CGSize(width: width, height: width)))
            }
        }
        .frame(width: width, height: width)
        .opacity(dim ? 0.5 : 1)
        .accessibilityLabel(letter.isEmpty ? "Your next letter" : letter)
    }

    /// One fragment tile: a §B1 glossy tile — yours purple (right-spot face),
    /// theirs gold (wrong-spot face) — or the frosted tile for your next letter
    /// (dashed while empty, typed once picked).
    private func ghostTile(_ letter: String, mine: Bool?) -> some View {
        let shape = RoundedRectangle(cornerRadius: 11, style: .continuous)
        let face: GlossyFace = mine.map { $0 ? .correct : .present } ?? (letter.isEmpty ? .empty : .typed)
        return PocketTile(face: face, letter: letter, width: 46, pop: mine != nil)
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
        return VStack(spacing: 5) {
            PocketBubble(text: "Round \(round) · \(winner) take\(r.loser == me ? "s" : "") it", color: FriendsKit.tileAccent(.ghost), size: 14,
                         names: [winner], nameColor: r.loser == me ? themColor : myColor, minScale: 0.4)
            BubbleTextView(text: PocketType.clean(text), palette: .accent(FriendsKit.tileAccent(.ghost)), names: [loser],
                           maxSize: 16, minSize: 11, animated: false)
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
            // §A8: the purple candy ADD (dimmed until a letter is picked). Always laid out (invisible on their turn) so the
            // pinned area never changes height between turns.
            Button(action: play) {
                if sending { ProgressView().tint(.white) }
                else { CandyLabel(title: ghostPending.map { "Add \($0)" } ?? "Tap a letter", symbol: ghostPending == nil ? nil : "plus") }
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium))
            .disabled(ghostPending == nil || sending || !g.yourTurn)
            .padding(.horizontal, 16)
            .opacity(g.yourTurn ? 1 : 0)
            .accessibilityHidden(!g.yourTurn)
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
        // Founder 10-13: an input error floats just above the pinned area (it used to reserve a slot inside it, which cost the
        // board 44 pt) and covers the board's lower edge only while it shows; nothing moves.
        .overlay(alignment: .top) {
            if let moveError {
                errorText(moveError).padding(.horizontal, 16).alignmentGuide(.top) { $0[.bottom] }
            }
        }
    }

    // Word Chain (§9)

    @ViewBuilder private func chainBoard(_ g: FriendlyGameView, _ c: ChainState, room: CGFloat?) -> some View {
        let me = g.me
        if let frame = PocketArt.chainBoard, let link = PocketArt.chainLink {
            // Founder 10-13: the gold chain frame. The last two words (three if they fit) as a staircase: each new word
            // starts directly under the previous word's last letter, joined by the gold link.
            // Full content width whenever it fits above the keyboard; it narrows only if it must, never below 85%.
            let fullH = min(UIScreen.main.bounds.width - 32, 560) * PocketBoard.chainPixels.height / PocketBoard.chainPixels.width
            PocketBoardArt(art: frame, pixels: PocketBoard.chainPixels, maxWidth: 560, maxHeight: room.map { max($0, fullH * 0.85) }) { scale in
                let inner = PocketBoard.chainInterior
                let w = inner.width * scale, h = inner.height * scale
                ZStack {
                    if c.words.isEmpty {
                        PocketBubble(text: g.isActive && g.yourTurn ? "Open the chain with any \(FriendlyGames.wordMin)- to \(FriendlyGames.chainWordMax)-letter word." : "\(themName) opens the chain.",
                                     color: Color(hex: 0xFDE68A), size: 13, names: [themName], nameColor: themColor, minScale: 0.4)
                            .padding(.horizontal, 6)
                    } else {
                        if chainNoStairs { Color.clear } else {
                        ChainStairs(words: c.words, me: me, active: g.isActive, link: link, themName: themName,
                                    green: FriendsKit.tileAccent(.chain), size: CGSize(width: w, height: h))
                        }
                    }
                }
                .frame(width: w, height: h)
                .position(x: inner.midX * scale, y: inner.midY * scale)
            }
            .animation(Theme.reduceMotion || chainAnimOff ? nil : .spring(response: 0.4, dampingFraction: 0.8), value: c.words.count)
            .id("chain-end")
        } else {
            VStack(spacing: 8) {
                if c.words.isEmpty {
                    PocketBubble(text: g.isActive && g.yourTurn ? "Open the chain with any \(FriendlyGames.wordMin)- to \(FriendlyGames.chainWordMax)-letter word." : "\(themName) opens the chain.",
                                 color: FriendsInk.muted, size: 13, names: [themName], nameColor: themColor, minScale: 0.4)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                ForEach(Array(c.words.suffix(3).enumerated()), id: \.offset) { i, w in
                    if i > 0, let links = PocketArt.chainLinks {
                        // Wave 3 (9d): a small gold link joins each word to the one before it.
                        Image(links).resizable().interpolation(.high).scaledToFit().frame(width: 18, height: 18)
                            .padding(.vertical, -9).accessibilityHidden(true)
                    }
                    chainRow(w, me: me, newest: i == min(c.words.count, 3) - 1 && g.isActive)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                Color.clear.frame(height: 1).id("chain-end")
            }
            // §L: the chain sits on the shared tray.
            .gameTray(accent: FriendsKit.tileAccent(.chain), state: trayState(g))
            .animation(Theme.reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.8), value: c.words.count)
        }
        if PocketArt.chainBoard == nil || PocketArt.chainLink == nil {
            HStack(spacing: 16) {
                legend("YOU", TilePalette.correct.base, ink: myColor)
                legend(themName.uppercased(), TilePalette.present.base, ink: themColor)
            }
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
                PocketTile(face: mine ? .correct : .present, letter: letters[i], width: 30,
                           glow: glow ? green : .clear, glowAmount: glow ? 1 : 0, pop: newest && !chainNoPop)
                    .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(glow ? green : .clear, lineWidth: 2.5).padding(.bottom, 2))
                    .scaleEffect(glow ? 1.08 : 1)
            }
            Spacer(minLength: 6)
            PocketBubble(text: "+\(w.points)", color: side, size: 15, palette: PlayerTint.platePalette(lightInk: FriendsInk.dark), fixed: true)
                .padding(.horizontal, 9).frame(minHeight: 26)
            .friendsChip(side)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .friendsCard(accent: side, radius: 14, tint: 0.07, line: 0.24)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(w.by == me ? "You" : themName) played \(w.word), plus \(w.points)")
    }

    /// Your word: 5–15 tiles (typed letters + one open slot) with the needed first letter pre-filled and locked,
    /// the keyboard and ENTER. Errors show inline right above it.
    private func chainInputArea(_ g: FriendlyGameView, _ c: ChainState) -> some View {
        let mine = g.yourTurn && !sending
        let locked = c.nextLetter.map(String.init)
        let letters = (locked.map { [$0] } ?? []) + Array(chainTyped).map(String.init)
        // Word Chain takes 5 to 15 letters (founder 10-13): the row shows what is typed plus ONE empty next slot, and
        // the tiles shrink smoothly as the word grows so it always fits one row.
        let wordMax = FriendlyGames.chainWordMax
        return VStack(spacing: 8) {
            if g.yourTurn {
                let slots = min(letters.count + 1, wordMax)
                GeometryReader { geo in
                    let gap: CGFloat = slots > 9 ? 3 : 5
                    let t = min(44, (geo.size.width - gap * CGFloat(slots - 1)) / CGFloat(slots))
                    HStack(spacing: gap) {
                        ForEach(0..<slots, id: \.self) { i in
                            chainInputTile(i < letters.count ? letters[i] : "", locked: i == 0 && locked != nil,
                                           optional: i >= FriendlyGames.wordMin, width: t)
                        }
                    }
                    .frame(width: geo.size.width, height: geo.size.height)
                    .animation(Theme.reduceMotion ? nil : .easeOut(duration: 0.15), value: slots)
                }
                .frame(height: 44)
                .layoutLog("entry")
                .padding(.horizontal, 16)
            } else {
                PocketBubble(text: "\(themName)'s word - it lands in the chain here.", color: FriendsInk.muted, size: 13,
                             names: [themName], nameColor: themColor, minScale: 0.4)
                    .frame(height: 44)   // the entry row's own height: the keyboard never moves between turns
            }
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
        // Founder 10-13: an input error floats just above the pinned area (it used to reserve a slot inside it, which cost the
        // board 44 pt) and covers the board's lower edge only while it shows; nothing moves.
        .overlay(alignment: .top) {
            if let moveError {
                errorText(moveError).padding(.horizontal, 16).alignmentGuide(.top) { $0[.bottom] }
            }
        }
    }

    /// Your word's tiles: the locked first letter a glossy green tile with a lock;
    /// the rest §B1 glossy tiles (frosted empty — dashed when optional — typed white).
    private func chainInputTile(_ letter: String, locked: Bool, optional: Bool, width w: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: w * 0.2, style: .continuous)
        let green = FriendsKit.tileAccent(.chain)
        return ZStack {
            if locked {
                ZStack(alignment: .top) {
                    shape.fill(Color.black.mixed(over: green, 0.35))
                    shape.fill(LinearGradient(colors: [green.mixed(over: .white, 0.7), green], startPoint: .top, endPoint: .bottom))
                        .padding(.bottom, 3)
                }
                .shadow(color: green.opacity(0.45), radius: 6, y: 2)
                Text(letter).font(Brand.font(w * 0.48, .black)).foregroundStyle(.white).padding(.bottom, 3)
                Image(systemName: "lock.fill").font(.system(size: max(5, w * 0.16), weight: .black)).foregroundStyle(.white.opacity(0.85))
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
            // Item 46: the pocket-game result card (the sender's mascot cheering, or the good-sport shrug, and the final score).
            Button { shareResult(g) } label: {
                CandyLabel(title: "Share result", symbol: "square.and.arrow.up")
            }
            .buttonStyle(CandyButtonStyle(variant: .peach, size: .large))
            Button { dismiss() } label: {
                CandyLabel(title: "Friends", symbol: "chevron.left")
            }
            .buttonStyle(CandyButtonStyle(variant: .pink, size: .large))
        }
        .padding(.top, 4)
    }

    private func shareResult(_ g: FriendlyGameView) {
        let won: Bool? = g.result == "win" ? true : g.result == "loss" ? false : nil
        let score = g.state.score
        ShareService.shareMoment(MomentShare.pocketResult(
            gameTitle: g.kind.title, won: won, mine: score?[g.me], theirs: score?[g.me.other], opponent: g.opponent.username))
    }
}

/// Word Chain's staircase on the chain-frame art (founder 10-13): the previous word on top, the newest below it starting
/// directly under the previous word's last letter (the same letter), a gold link joining the two. Shows the last two
/// words, three if they fit at a comfortable size. Tiles shrink to fit the interior; if the staircase would need tiles
/// under 18 pt, the newer word starts at the left edge instead (the link still runs from the previous last letter to the
/// new first letter). Static layout, computed once per words change.
private struct ChainStairs: View {
    let words: [ChainWord]
    let me: FriendlySide
    let active: Bool
    let link: String
    let themName: String
    let green: Color
    let size: CGSize

    private struct Layout {
        var t: CGFloat = 0
        var gap: CGFloat = 0
        var rowGap: CGFloat = 0
        var x0: CGFloat = 0
        var rows: [(word: ChainWord, col: Int)] = []
        var y0: CGFloat = 0
        /// Long words / a too-tight staircase: both rows left-aligned across the full width, joined by a run of links.
        var stacked = false
    }

    private static let gapRatio: CGFloat = 0.16
    private static let rowGapRatio: CGFloat = 0.5
    private static let stackRowGapRatio: CGFloat = 1.0
    private static let stairMin: CGFloat = 18
    private static let threeMin: CGFloat = 26
    /// Either visible word longer than this skips the staircase.
    private static let longWord = 10

    /// Tile size for `cols` columns and `rowCount` rows inside `size`.
    private static func tile(cols: Int, rows rowCount: Int, in size: CGSize, rowGapRatio: CGFloat = rowGapRatio) -> CGFloat {
        let byW = size.width / (CGFloat(cols) + gapRatio * CGFloat(cols - 1))
        let byH = size.height / (CGFloat(rowCount) + rowGapRatio * CGFloat(rowCount - 1))
        return min(byW, byH, 44)
    }

    private static func stairCols(_ shown: [ChainWord]) -> (cols: Int, starts: [Int]) {
        var starts: [Int] = []
        var col = 0
        for i in shown.indices {
            if i > 0 { col += max(shown[i - 1].word.count - 1, 0) }
            starts.append(col)
        }
        return (col + (shown.last?.word.count ?? 1), starts)
    }

    private static func layout(words: [ChainWord], size: CGSize) -> Layout {
        var shown = Array(words.suffix(2))
        let long = shown.contains { $0.word.count > longWord }
        if words.count >= 3 && !long {
            let three = Array(words.suffix(3))
            let st = stairCols(three)
            if tile(cols: st.cols, rows: 3, in: size) >= threeMin { shown = three }
        }
        let st = stairCols(shown)
        var t = tile(cols: st.cols, rows: shown.count, in: size)
        var starts = st.starts
        var cols = st.cols
        var stacked = false
        var rowGapRatio = rowGapRatio
        if shown.count > 1 && (long || t < stairMin) {
            // Every word starts at column 0, the tiles as large as the interior allows (two words at most).
            stacked = true
            rowGapRatio = stackRowGapRatio
            shown = Array(shown.suffix(2))
            starts = shown.map { _ in 0 }
            cols = shown.map { $0.word.count }.max() ?? 1
            t = tile(cols: cols, rows: shown.count, in: size, rowGapRatio: rowGapRatio)
        }
        var l = Layout()
        l.t = t
        l.stacked = stacked
        l.gap = t * gapRatio
        l.rowGap = t * rowGapRatio
        let groupW = CGFloat(cols) * t + CGFloat(cols - 1) * l.gap
        let groupH = CGFloat(shown.count) * t + CGFloat(shown.count - 1) * l.rowGap
        // Stacked rows are left-aligned (the words run edge to edge); the staircase is centered.
        l.x0 = stacked ? 0 : (size.width - groupW) / 2
        l.y0 = (size.height - groupH) / 2
        l.rows = Array(zip(shown, starts)).map { (word: $0.0, col: $0.1) }
        return l
    }

    var body: some View {
        let l = Self.layout(words: words, size: size)
        let pitch = l.t + l.gap
        ZStack(alignment: .topLeading) {
            ForEach(Array(l.rows.enumerated()), id: \.offset) { k, row in
                let letters = Array(row.word.word).map(String.init)
                let mine = row.word.by == me
                let newest = k == l.rows.count - 1 && active
                HStack(spacing: l.gap) {
                    ForEach(letters.indices, id: \.self) { i in
                        let glow = newest && i == letters.count - 1
                        // §B1 glossy tiles in the player's color (purple yours, gold theirs); the newest word's last letter
                        // glows green (the next word starts with it).
                        PocketTile(face: mine ? .correct : .present, letter: letters[i], width: l.t,
                                   glow: glow ? green : .clear, glowAmount: glow ? 1 : 0, pop: newest && !chainNoPop)
                    }
                }
                .fixedSize()
                .offset(x: l.x0 + CGFloat(row.col) * pitch, y: l.y0 + CGFloat(k) * (l.t + l.rowGap))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(mine ? "You" : themName) played \(row.word.word), plus \(row.word.points)")
            }
            // The gold link from each word's last letter down to the next word's first letter (stacked rows: a short run of
            // links along the line between the two letters).
            ForEach(1..<max(l.rows.count, 1), id: \.self) { k in
                let prev = l.rows[k - 1], cur = l.rows[k]
                let px = l.x0 + CGFloat(prev.col + prev.word.word.count - 1) * pitch + l.t / 2
                let cx = l.x0 + CGFloat(cur.col) * pitch + l.t / 2
                let py = l.y0 + CGFloat(k - 1) * (l.t + l.rowGap) + l.t
                let cy = l.y0 + CGFloat(k) * (l.t + l.rowGap)
                if l.stacked {
                    let lh = min(l.rowGap * 1.5, l.t * 1.3)
                    // The run stays inside the gap between the rows (inset from both tile edges), so it never covers a letter.
                    let (px, py, cy) = (px, py + l.rowGap * 0.3, cy - l.rowGap * 0.3)
                    let dist = hypot(cx - px, cy - py)
                    let n = max(1, Int((dist / (lh * 0.72)).rounded(.up)))
                    let angle = -Double(atan2(cx - px, cy - py))
                    ForEach(0..<n, id: \.self) { i in
                        let f = (CGFloat(i) + 0.5) / CGFloat(n)
                        Image(link).resizable().interpolation(.high)
                            .aspectRatio(PocketBoard.chainLinkAspect, contentMode: .fit)
                            .frame(height: lh)
                            .rotationEffect(.radians(angle))
                            .position(x: px + (cx - px) * f, y: py + (cy - py) * f)
                            .accessibilityHidden(true)
                    }
                } else {
                    let lh = l.rowGap + l.t * 0.5
                    Image(link).resizable().interpolation(.high)
                        .aspectRatio(PocketBoard.chainLinkAspect, contentMode: .fit)
                        .frame(height: lh)
                        .position(x: (px + cx) / 2, y: (py + cy) / 2)
                        .accessibilityHidden(true)
                }
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
    }
}

/// Both picks of the last round, flipping in together; the winner glows.
struct RpsReveal: View {
    let round: Int
    let mine: RpsPick
    let theirs: RpsPick
    /// 0 = tie, 1 = you, 2 = them.
    let winner: Int
    let them: String
    let accent: Color
    let myColor: Color
    let themColor: Color
    /// Slice 5 (iPad): 1.6 on tablets, 1 on phones; scales the arena band, the hands, the labels and the burst.
    var scale: CGFloat = 1
    @State private var flipped = Theme.reduceMotion
    /// Founder 10-10 (suspense): the "ROCK, PAPER, SCISSORS, SHOOT!" beat before the reveal — both fists pump three
    /// times as the words pop in, then both cards turn over at once. -1 = not started, 0-2 = the pumps, 3 = SHOOT.
    @State private var beat = -1
    @State private var bob: CGFloat = 0
    @State private var turn: Double = Theme.reduceMotion ? 0 : 180
    private static let words = ["ROCK...", "PAPER...", "SCISSORS...", "SHOOT!"]
    /// The arena card's fixed height (founder 10-13: nothing moves when a round is played).
    static let arenaHeight: CGFloat = 150
    private var arenaH: CGFloat { Self.arenaHeight * scale }

    /// The arena: the ring across the card's full width and the audience wallpaper behind it.
    private var arena: Bool { PocketArt.ring != nil && PocketArt.rpsBackdrop != nil }

    var body: some View {
        VStack(spacing: 6) {
            if arena {
                // White with a soft dark shadow so it reads over the wallpaper.
                PocketBubble(text: "Round \(round)", color: .white, size: 15 * scale, palette: PlayerTint.platePalette(lightInk: true))
                    .shadow(color: Color(hex: 0x1A0536).opacity(0.7), radius: 3, y: 1)
                    .padding(.top, 8)
            } else {
                PocketBubble(text: "Round \(round)", color: accent, size: 15 * scale)
            }
            HStack(spacing: 18 * scale) {
                card(mine, label: "YOU", win: winner == 1, tint: FriendsKit.purple, ink: myColor)
                ZStack {
                    // Wave 3: the clash burst pops between the hands as they flip over.
                    if let burst = PocketArt.clashBurst {
                        Image(burst).resizable().interpolation(.high).scaledToFit()
                            .frame(width: 52 * scale, height: 52 * scale)
                            .scaleEffect(flipped ? 1 : 0.4)
                            .opacity(flipped ? 1 : 0)
                            .accessibilityHidden(true)
                    }
                    if flipped {
                        PocketBubble(text: winner == 0 ? "TIE" : "VS", color: accent, size: 15 * scale, minScale: 0.5)
                    } else if beat >= 0 {
                        PocketBubble(text: Self.words[min(beat, 3)], color: beat == 3 ? Color(hex: 0xF5B82E) : accent,
                                     size: (beat == 3 ? 17 : 13) * scale, minScale: 0.35)
                            .id(beat)
                            .transition(.scale(scale: 0.5).combined(with: .opacity))
                    }
                }
                .frame(width: 40 * scale)
                card(theirs, label: them.uppercased(), win: winner == 2, tint: FriendsKit.amber, ink: themColor)
            }
            // Founder 10-12: the hands square off inside a wrestling ring (was the purple arena plate), there for the whole
            // countdown, not only after the flip. The ring art is open at the front (cut just past the star, founder 10-12), so the
            // canvas runs to the card's bottom edge and the hands stand inside it: a little room above for the ropes, none below.
            .padding(.top, PocketArt.ring == nil ? 0 : 20 * scale)
            .padding(.bottom, PocketArt.ring == nil ? 0 : 2 * scale)
            .background(alignment: .bottom) {
                if !arena, let ring = PocketArt.ring {
                    Image(ring).resizable().interpolation(.high).scaledToFit()
                        .frame(width: 330 * scale)
                        .accessibilityHidden(true)
                } else if !arena, let plate = PocketArt.arenaPlate {
                    Image(plate).resizable().interpolation(.high).scaledToFit()
                        .frame(width: 270 * scale).offset(y: 14 * scale)
                        .opacity(flipped ? 0.9 : 0)
                        .accessibilityHidden(true)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: arena ? arenaH : nil, alignment: .bottom)
        // Founder 10-13: the ring spans the card edge to edge, bottom-aligned, over the audience wallpaper (aspect-fill),
        // corners clipped to the card.
        .background(alignment: .bottom) {
            if arena, let ring = PocketArt.ring {
                Image(ring).resizable().interpolation(.high).scaledToFit()
                    .frame(maxWidth: .infinity)
                    .accessibilityHidden(true)
            }
        }
        .background {
            if arena, let wall = PocketArt.rpsBackdrop {
                Image(wall).resizable().interpolation(.high).scaledToFill()
                    .accessibilityHidden(true)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: arena ? GameTray.radius : 0, style: .continuous))
        .layoutLog("arena")
        .onAppear {
            guard !flipped else { return }
            if Theme.reduceMotion { flipped = true; turn = 0; return }
            Task { @MainActor in await countdown() }
        }
    }

    private func wait(_ s: Double) async { try? await Task.sleep(nanoseconds: UInt64(s * 1_000_000_000)) }

    /// Three pumps (ROCK / PAPER / SCISSORS), SHOOT!, then both cards turn over together.
    @MainActor private func countdown() async {
        for i in 0..<3 {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.7)) { beat = i }
            withAnimation(.easeOut(duration: 0.15)) { bob = -18 }
            await wait(0.15)
            withAnimation(.easeIn(duration: 0.13)) { bob = 0 }
            await wait(0.13)
            Haptics.light()
            await wait(0.12)
        }
        withAnimation(.spring(response: 0.22, dampingFraction: 0.6)) { beat = 3 }
        Haptics.medium()
        await wait(0.22)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { turn = 0; flipped = true }
        await wait(0.18)
        Haptics.heavy()
        if winner == 1 { await wait(0.2); Haptics.success() }
    }

    private func card(_ p: RpsPick, label: String, win: Bool, tint: Color, ink: Color) -> some View {
        VStack(spacing: 3) {
            // The pick turns over from the pumping fist (only the art turns — the label never mirrors).
            // In the ring the hands are the outlined art (the plain hand + a baked plum outline and drop shadow), scaled so the
            // visible hand keeps its size, on a static soft contact shadow on the mat (founder 10-13).
            let outlined = arena && PocketArt.rpsRing(p) != nil && PocketArt.rpsRing(.rock) != nil
            let box: CGFloat = 58 * scale
            ZStack(alignment: .bottom) {
                if outlined {
                    Ellipse().fill(RadialGradient(colors: [Color(hex: 0x28084F).opacity(0.4), Color(hex: 0x28084F).opacity(0)],
                                                  center: .center, startRadius: 0, endRadius: 30))
                        .frame(width: 62 * scale, height: 14 * scale)
                        .offset(y: 4)
                        .accessibilityHidden(true)
                }
                RpsTurnArt(angle: turn, front: outlined ? PocketArt.rpsRing(p)! : PocketArt.rps(p),
                           back: outlined ? PocketArt.rpsRing(.rock)! : PocketArt.rps(.rock),
                           frontSize: outlined ? PocketArt.rpsRingSize(p, box: box) : nil,
                           backSize: outlined ? PocketArt.rpsRingSize(.rock, box: box) : nil)
                    .frame(width: box, height: box)
                    .offset(y: flipped ? 0 : bob)
                    .accessibilityLabel(flipped ? p.rawValue.capitalized : "Hidden pick")   // §AB: the pick, not the asset name
            }
            .frame(width: box, height: box)
            Group {
                if arena {
                    // On the ring's lilac mat the player color washed out (founder 10-13): deep plum plain caps instead.
                    Text(PocketType.clean(label)).font(Brand.font(13 * scale, .black)).tracking(0.4)
                        .foregroundColor(Color(hex: 0x3B0F75))
                        .lineLimit(1).minimumScaleFactor(0.4)
                        .frame(height: 12 * 1.3 * scale)
                } else {
                    PocketBubble(text: label, color: ink, size: 12 * scale, minScale: 0.4, hug: false)
                }
            }
                .frame(width: 74 * scale)
                .opacity(win ? 1 : 0.75)
        }
        .frame(width: 84 * scale, height: 92 * scale)
        .modifier(RpsCardBox(inRing: PocketArt.ring != nil, win: win && flipped, tint: tint))
    }
}

/// The empty arena shown before the first round (same size as the reveal card).
private struct RpsArenaEmpty: View {
    var scale: CGFloat = 1
    var body: some View {
        VStack {
            PocketBubble(text: "Round 1", color: .white, size: 15 * scale, palette: PlayerTint.platePalette(lightInk: true))
                .shadow(color: Color(hex: 0x1A0536).opacity(0.7), radius: 3, y: 1)
                .padding(.top, 8)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .frame(height: RpsReveal.arenaHeight * scale)
        .background(alignment: .bottom) {
            if let ring = PocketArt.ring {
                Image(ring).resizable().interpolation(.high).scaledToFit().frame(maxWidth: .infinity).accessibilityHidden(true)
            }
        }
        .background {
            if let wall = PocketArt.rpsBackdrop {
                Image(wall).resizable().interpolation(.high).scaledToFill().accessibilityHidden(true)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: GameTray.radius, style: .continuous))
        .layoutLog("arena")
    }
}

/// The reveal card's box: in the ring the hands stand on the canvas bare (the winner glows in its color); without the
/// ring art, the old tinted box. §A1: tinted in the player's color, never plain white.
private struct RpsCardBox: ViewModifier {
    let inRing: Bool
    let win: Bool
    let tint: Color
    func body(content: Content) -> some View {
        if inRing {
            content.shadow(color: win ? tint.opacity(0.85) : .clear, radius: win ? 12 : 0)
        } else {
            content
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(tint.vsWash(win ? 0.18 : 0.10))
                    .shadow(color: win ? tint.opacity(0.6) : Color(hex: 0x4C1D95).opacity(0.08), radius: win ? 10 : 4, y: 2))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(win ? tint : tint.vsWash(0.32), lineWidth: win ? 2 : 1.5))
        }
    }
}

/// Slice 5 (iPad): the pinned letter keyboards clear the home indicator. On tablets the keyboard gets 20 pt more bottom room
/// and its bed runs under the bottom safe area, so the bottom key row never sits on the indicator. Phones are untouched.
private struct PinnedKeyboardBottom: ViewModifier {
    @Environment(\.widthClass) private var widthClass
    func body(content: Content) -> some View {
        if widthClass == .compact {
            content
        } else {
            content.padding(.bottom, 20).background(FriendlyGameScreen.keyboardBed.ignoresSafeArea(edges: .bottom))
        }
    }
}

/// An RPS hand turning over around its vertical axis: the fist (back) until the turn passes 90°, then the pick (front);
/// it narrows to its edge mid-turn. Never mirrored (a scale magnitude, not a flip).
private struct RpsTurnArt: View, Animatable {
    var angle: Double
    let front: String
    let back: String
    /// The outlined ring art's own size (it is bigger than the frame by its baked padding); nil = fit the frame.
    var frontSize: CGSize? = nil
    var backSize: CGSize? = nil
    var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    var body: some View {
        let c = cos(angle * .pi / 180)
        let size = c >= 0 ? frontSize : backSize
        Image(c >= 0 ? front : back).resizable().interpolation(.high).scaledToFit()
            .frame(width: size?.width, height: size?.height)
            .scaleEffect(x: max(0.06, abs(c)), y: 1)
    }
}

/// The Call It coin (founder 10-10: "smoother and a bit more suspenseful"): on each new flip it crouches, launches, turns
/// end over end in real 3D (fast at first, slowing over its last turns as it falls), lands with a small bounce, teeters
/// for a beat, THEN shows the face and the result line. Everything runs on SwiftUI animations (display rate); the face
/// is picked per frame from the turn angle. Haptic ticks slow down with the spin. Reduce Motion: the face, no flip.
private struct SpinningCoin: View {
    let face: CoinFace
    let spinKey: Int
    /// The result line, shown only once the coin has settled (never before it lands).
    var caption: AnyView? = nil
    /// Founder 10-13: the coin floats over the velvet stage in front of the theater backdrop (the card is drawn here; the
    /// backdrop is clipped to the card, the coin and its flight are not).
    var staged = false
    @State private var angle: Double = 0
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1
    @State private var teeter: Double = 0
    @State private var settled = true
    @State private var glow = false
    @State private var shownFace: CoinFace?
    @State private var flipTask: Task<Void, Never>?
    @State private var lastKey: Int?

    var body: some View {
        // Founder 10-12 (it showed heads under "it landed tails"): once the coin has settled it always shows the real
        // result; mid-flip it shows the face the running flip is heading for.
        let landed = settled ? face : (shownFace ?? face)
        VStack(spacing: 8) {
            if staged, let backdrop = PocketArt.coinBackdrop, let stage = PocketArt.coinStage {
                stagedCard(backdrop: backdrop, stage: stage, landed: landed)
            } else {
                coinStack(landed: landed)
                    .frame(width: 150, height: 160)
            }
            // The result line's slot is always there (founder 10-13: no screen shifting), empty until the coin has landed.
            ZStack {
                if let caption {
                    caption
                        .opacity(settled ? 1 : 0)
                        .animation(.easeOut(duration: 0.25), value: settled)
                }
            }
            .frame(height: 18)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(settled ? (face == .heads ? "Coin, heads" : "Coin, tails") : "Coin flipping")   // §AB
        // The new flip's face comes from the change itself: the onChange closure can carry the previous render's
        // `face` (the first flip of a match read the .heads placeholder and spun to heads).
        .onChange(of: CoinSpin(key: spinKey, face: face)) { spin in
            if spin.key != lastKey { lastKey = spin.key; flip(to: spin.face) } else if settled { shownFace = spin.face }
        }
        .onAppear { if lastKey == nil { lastKey = spinKey } }
        .onDisappear { flipTask?.cancel() }
    }

    /// The coin with its contact shadow and reveal glow (150 x 160 at rest).
    private func coinStack(landed: CoinFace) -> some View {
        ZStack {
            if let shadow = PocketArt.coinShadow {
                // The contact shadow shrinks and fades as the coin rises.
                Image(shadow).resizable().interpolation(.high).scaledToFit()
                    .frame(width: 140, height: 140)
                    .offset(y: 10)
                    .scaleEffect(1 + hop / 260)
                    .opacity(0.9 + Double(hop) / 260)
                    .accessibilityHidden(true)
            }
            // the reveal glow
            Circle().fill(RadialGradient(colors: [Color(hex: 0xFDE68A).opacity(0.7), .clear], center: .center,
                                         startRadius: 10, endRadius: 110))
                .frame(width: 220, height: 220)
                .opacity(glow ? 1 : 0)
                .scaleEffect(glow ? 1 : 0.6)
                .allowsHitTesting(false)
            CoinFlipFace(angle: angle, front: PocketArt.coin(landed),
                         back: PocketArt.coin(landed == .heads ? .tails : .heads))
                .frame(width: 150, height: 150)
                .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
                .rotationEffect(.degrees(teeter), anchor: .bottom)
                .offset(y: hop)
                .shadow(color: Color(hex: 0xCA8A04).opacity(0.35), radius: 12, y: 4)
        }
    }

    /// The Call It card: theater wallpaper (aspect-fill, clipped to the card's corners), the round velvet stage across
    /// ~90% of the width at the bottom, and the coin centered over the stage's top with headroom above it.
    private func stagedCard(backdrop: String, stage: String, landed: CoinFace) -> some View {
        let cardHeight: CGFloat = 256
        return GeometryReader { geo in
            let w = geo.size.width
            let stageW = w * 0.9
            let stageH = stageW * PocketBoard.coinStagePixels.height / PocketBoard.coinStagePixels.width
            ZStack(alignment: .bottom) {
                Image(backdrop).resizable().interpolation(.high).scaledToFill()
                    .frame(width: w, height: cardHeight)
                    .clipShape(RoundedRectangle(cornerRadius: GameTray.radius, style: .continuous))
                    .accessibilityHidden(true)
                Image(stage).resizable().interpolation(.high).scaledToFit()
                    .frame(width: stageW, height: stageH)
                    .padding(.bottom, 8)
                    .accessibilityHidden(true)
                // The coin rests on the stage's top surface (about a third of the way down the stage art).
                coinStack(landed: landed)
                    .frame(width: 150, height: 160)
                    .scaleEffect(0.76, anchor: .bottom)
                    .padding(.bottom, 8 + stageH * 0.6)
            }
            .frame(width: w, height: cardHeight, alignment: .bottom)
        }
        .frame(height: cardHeight)
        .layoutLog("coincard")
    }

    private func wait(_ s: Double) async { try? await Task.sleep(nanoseconds: UInt64(s * 1_000_000_000)) }

    private func flip(to result: CoinFace) {
        flipTask?.cancel()
        guard !Theme.reduceMotion else { shownFace = result; settled = true; return }
        // Start from whatever face is showing now; end on the result after five whole turns (+ a half if it changes).
        let before = shownFace ?? (result == .heads ? .tails : .heads)
        settled = false
        glow = false
        flipTask = Task { @MainActor in
            shownFace = result
            var t = Transaction(); t.disablesAnimations = true
            withTransaction(t) { angle = before == result ? 0 : 180 }
            // crouch
            withAnimation(.easeOut(duration: 0.14)) { squash = 0.86 }
            await wait(0.14)
            Haptics.medium()
            // launch: up fast, then the fall; the turns slow toward the end (the suspense)
            let spin = 1.55
            withAnimation(.timingCurve(0.12, 0.55, 0.2, 1, duration: spin)) { angle = 360 * 5 }
            withAnimation(.easeOut(duration: 0.12)) { squash = 1.06 }
            withAnimation(.easeOut(duration: spin * 0.46)) { hop = staged ? -70 : -120 }
            // ticks that slow with the spin
            Task { @MainActor in
                for gap in [0.12, 0.13, 0.15, 0.18, 0.22, 0.27, 0.34] {
                    await wait(gap)
                    if Task.isCancelled { return }
                    Haptics.selection()
                }
            }
            await wait(spin * 0.46)
            if Task.isCancelled { return }
            withAnimation(.easeIn(duration: spin * 0.54)) { hop = 0; squash = 1 }
            await wait(spin * 0.54)
            if Task.isCancelled { return }
            // land: a squash + a small bounce, then a teeter before it settles
            Haptics.heavy()
            withAnimation(.easeOut(duration: 0.08)) { squash = 0.88 }
            await wait(0.08)
            withAnimation(.spring(response: 0.28, dampingFraction: 0.5)) { squash = 1; hop = -12 }
            await wait(0.14)
            withAnimation(.easeIn(duration: 0.14)) { hop = 0 }
            withAnimation(.easeInOut(duration: 0.16)) { teeter = 7 }
            await wait(0.16)
            withAnimation(.easeInOut(duration: 0.16)) { teeter = -5 }
            await wait(0.16)
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { teeter = 0 }
            await wait(0.12)
            if Task.isCancelled { return }
            // the reveal
            Haptics.success()
            withAnimation(.easeOut(duration: 0.3)) { glow = true; settled = true }
            await wait(0.9)
            withAnimation(.easeIn(duration: 0.5)) { glow = false }
        }
    }
}

/// One coin flip as onChange sees it: the round count and the face it landed on, read together.
private struct CoinSpin: Equatable {
    let key: Int
    let face: CoinFace
}

/// The coin turning end over end around its horizontal axis: the visible face is picked from the angle each frame, the
/// art squashes to its edge as it turns and darkens a touch on the far side of the turn.
private struct CoinFlipFace: View, Animatable {
    var angle: Double
    let front: String
    let back: String
    var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    var body: some View {
        let c = cos(angle * .pi / 180)
        Image(c >= 0 ? front : back)
            .resizable().interpolation(.high).scaledToFit()
            .scaleEffect(x: 1, y: max(0.07, abs(c)))
            .brightness(-0.18 * (1 - abs(c)))
    }
}


#if DEBUG
private let chainNoPop = PerfTour.flag("noTilePop")   // perf A/B switch
private let chainNoStairs = PerfTour.flag("noStairs")
#else
private let chainNoPop = false
private let chainNoStairs = false
#endif

/// Where the board starts inside the game screen's scroll content.
private struct BoardTopKey: PreferenceKey {
    static var defaultValue: CGFloat = .infinity
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = min(value, nextValue()) }
}

#if DEBUG
/// DEBUG only (founder 10-13: no screen shifting): `-layoutLog` prints `LAYOUT|<name>|y|h` whenever a tagged view's global
/// frame changes, so a scripted playthrough can be checked for any move > 1 pt.
extension View {
    @ViewBuilder func layoutLog(_ name: String) -> some View {
        if ProcessInfo.processInfo.arguments.contains("-layoutLog") {
            background(GeometryReader { geo in
                let f = geo.frame(in: .global)
                Color.clear
                    .onAppear { plog(String(format: "LAYOUT|%@|%.1f|%.1f\n", name, f.minY, f.height)) }
                    .onChange(of: f) { n in plog(String(format: "LAYOUT|%@|%.1f|%.1f\n", name, n.minY, n.height)) }
            })
        } else { self }
    }
}
#else
extension View { func layoutLog(_ name: String) -> some View { self } }
#endif

// MARK: Live play helpers (9b)

/// The your-turn pulse: a soft ring that breathes once around the board when the move comes back to you.
private struct LiveTurnRing: View {
    let color: Color
    @State private var phase: Double = 0
    var body: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .stroke(color.opacity(0.55), lineWidth: 2.5)
            .shadow(color: color.opacity(0.4), radius: 10)
            .opacity(phase)
            .scaleEffect(1 + 0.012 * phase)
            .allowsHitTesting(false)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.45)) { phase = 1 }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { withAnimation(.easeInOut(duration: 0.5)) { phase = 0 } }
            }
    }
}

/// One live reaction rising from the bottom of the board and fading.
private struct LiveFloat: View {
    let key: String
    @State private var up = false
    var body: some View {
        ReactionGlyph(key: key, size: 34)
            .scaleEffect(up ? 1 : 0.6)
            .offset(y: up ? -130 : -4)
            .opacity(up ? 0 : 1)
            .onAppear { withAnimation(.easeOut(duration: Double(FriendlyLive.reactLifetimeMs) / 1000)) { up = true } }
    }
}

// MARK: Pocket typography (founder 10-10: "no plain text anywhere")

enum PocketType {
    /// The atlas has no @, ellipsis, dashes or check; spell them in glyphs it has (a name is never otherwise touched).
    static func clean(_ s: String) -> String {
        var out = ""
        for ch in s.uppercased() {
            switch ch {
            case "\u{2026}": out += "..."
            case "\u{2014}", "\u{2013}": out += "-"
            case "\u{2019}": out += "'"
            case "@", "\u{2713}": continue
            default: out.append(ch)
            }
        }
        return out.split(separator: " ", omittingEmptySubsequences: true).joined(separator: " ")
    }
}

/// One line of bubble lettering for the pocket games' labels, names, chips and numbers: never wraps, never clips
/// (shrinks to fit), takes only the width it needs (`hug`), static (no per-letter pop). `nameColor` tints any of
/// `names` found in the line in that player's own color.
struct PocketBubble: View {
    let text: String
    var color: Color
    var size: CGFloat = 13
    var palette: HeadlinePalette? = nil
    var names: [String] = []
    var nameColor: Color? = nil
    var minScale: CGFloat = 0.45
    var alignment: Alignment = .center
    var hug = true
    /// A fixed natural width (inside a horizontal scroll view, where no width is offered).
    var fixed = false

    private var pal: HeadlinePalette {
        var p = palette ?? HeadlinePalette.accent(color)
        if let nameColor {
            p.nameTop = Color.white.mixed(over: nameColor, 0.3)
            p.nameBottom = nameColor
        }
        return p
    }

    /// Founder 10-13 ("impossible to read"): small labels are plain capitals like the Home tile titles (`HomeCardTitleStyle.plainCaps`);
    /// bubble lettering stays for the big text (headline 21, scores 36, "?" 44, the answer, waiting-room 18).
    private var plain: Bool { size <= 15 }

    /// The plain-caps ink: the accent itself (lifted for dark surfaces / a dark season, like the tile), or white on a plate.
    private var plainInk: Color {
        guard let palette else { return Self.deepened(color.onSeasonCard.bubbleInk) }
        // A plate palette (white letters on a dark plate / deep violet on a pale one) keeps its own ink, never lifted.
        if Color.luma(palette.top) > 0.8 { return .white }
        if palette.outline == .white { return palette.bottom }
        return Self.deepened(palette.bottom.onSeasonCard.bubbleInk)
    }

    /// On the light wallpaper a bright accent (amber, orange) is deepened until it reads as plain text.
    private static func deepened(_ c: Color) -> Color {
        guard !Theme.isDark, Color.luma(c) > 0.28 else { return c }
        return Color.black.mixed(over: c, 0.32)
    }

    private var plainText: Text {
        let shown = PocketType.clean(text)
        var attr = AttributedString(shown)
        let nameInk = (nameColor ?? Color(hex: 0xDB2777)).bubbleInk
        for n in names.map(PocketType.clean) where !n.isEmpty {
            var from = attr.startIndex
            while let r = attr[from...].range(of: n) {
                attr[r].foregroundColor = nameInk
                from = r.upperBound
            }
        }
        return Text(attr)
    }

    var body: some View {
        if plain {
            plainText
                .font(Brand.font(size + 1, .black)).tracking(0.4)
                .foregroundColor(plainInk)
                // Over the night art (Call It's YOUR CALL on the hills) a soft dark halo keeps the caps legible (founder 10-13).
                .shadow(color: Theme.isDark ? Color.black.opacity(0.55) : .clear, radius: 2, y: 1)
                .lineLimit(1).minimumScaleFactor(minScale)
                .frame(maxWidth: hug || fixed ? nil : .infinity, alignment: alignment)
                .fixedSize(horizontal: fixed, vertical: false)
                .frame(height: size * 1.3)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(text)
        } else {
        let shown = PocketType.clean(text)
        let dyn = min(UIFontMetrics.default.scaledValue(for: 100) / 100, Brand.maxScale)
        let natural = CGFloat(BubbleText.widthEm(shown)) * size * dyn
        GeometryReader { g in
            let s = natural > 0 ? max(minScale, min(1, g.size.width / natural)) : 1
            BubbleLineView(text: shown, palette: pal, size: size * s, names: names.map(PocketType.clean), animated: false)
                .fixedSize()
                .frame(width: g.size.width, height: g.size.height, alignment: alignment)
        }
        .frame(minWidth: fixed ? natural + 1 : nil, maxWidth: (hug || fixed) ? natural + 1 : .infinity)
        .frame(height: size * 1.3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        }
    }
}
