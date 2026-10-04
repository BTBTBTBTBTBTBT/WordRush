import SwiftUI
import WordociousCore

/// Async challenge screens (VS overhaul, founder 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md §3–§5): the race entry (load → intro → game), the
/// "CHALLENGE SENT!" screen, and the challenge result in the HOME palette.

// MARK: - Mini board (§5)

/// A run in our colors: single-board modes show each guess row evaluated
/// against the solution; multi-board modes one square per board (solved = purple).
struct VSMiniRunBoard: View {
    let run: VsChallengeRun
    var tile: CGFloat = 16

    private static let correct = Color(hex: 0x7C3AED)
    private static let present = Color(hex: 0xF59E0B)
    private static let absent = Color(hex: 0x94A3B8)

    private func color(_ s: TileState) -> Color {
        switch s {
        case .correct: return Self.correct
        case .present: return Self.present
        default: return Self.absent
        }
    }

    /// Each guess against the (single) solution; letters that can't be scored
    /// (ProperNoundle spacing, a length mismatch) read as absent.
    private var rows: [[TileState]] {
        let solution = (run.solutions.first ?? "").uppercased()
        return run.guessLog.map { raw in
            let g = raw.uppercased()
            if g == solution { return Array(repeating: .correct, count: max(1, g.count)) }
            if !g.isEmpty, g.count == solution.count, !g.contains(" ") {
                return evaluateGuess(solution: solution, guess: g).tiles.map(\.state)
            }
            return Array(repeating: .absent, count: max(1, min(g.count, 8)))
        }
    }

    var body: some View {
        let gap: CGFloat = 3
        if run.totalBoards > 1 {
            let perRow = run.totalBoards > 8 ? 7 : min(run.totalBoards, 4)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(tile), spacing: gap), count: perRow), spacing: gap) {
                ForEach(0..<run.totalBoards, id: \.self) { i in
                    square(i < run.boardsSolved ? Self.correct : Self.absent)
                }
            }
            .fixedSize()
        } else {
            VStack(spacing: gap) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: gap) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, s in square(color(s)) }
                    }
                }
            }
        }
    }

    /// A tiny glossy square (§B1 look at mini size): the color, a top gloss and a
    /// darker lip.
    private func square(_ c: Color) -> some View {
        let shape = RoundedRectangle(cornerRadius: max(3, tile * 0.24), style: .continuous)
        return ZStack(alignment: .top) {
            shape.fill(Color.black.mixed(over: c, 0.3))
            shape.fill(LinearGradient(colors: [Color.white.mixed(over: c, 0.25), c], startPoint: .top, endPoint: .bottom))
                .padding(.bottom, max(1, tile * 0.08))
            shape.fill(LinearGradient(colors: [Color.white.opacity(0.45), Color.white.opacity(0)], startPoint: .top, endPoint: .bottom))
                .frame(height: tile * 0.38)
                .padding(.horizontal, tile * 0.1).padding(.top, 1)
        }
        .frame(width: tile, height: tile)
        .shadow(color: c == Self.correct ? Self.correct.opacity(0.35) : .clear, radius: 3)
    }
}

// MARK: - Challenge result (§5, the home palette)

struct VSChallengeResultView: View {
    let mode: GameMode
    let code: String
    let outcome: VSChallengeOutcome
    let opponentId: String
    let headToHead: HeadToHeadRecord?
    let xpGain: Int?
    var note: String? = nil
    let onHome: () -> Void

    @ObservedObject private var auth = AuthService.shared

    private var won: Bool { outcome.outcome == .win }
    private var lost: Bool { outcome.outcome == .loss }
    private var name: String { outcome.opponentName }
    private var margin: String { VsLobby.vsMargin(outcome.mine.vsRun, outcome.theirs.vsRun) }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ZStack {
                    Wordmark(size: 22)
                    HStack {
                        HeaderCircleButton(.symbol("xmark"), label: "Close", action: onHome)
                        Spacer()
                    }
                }
                .padding(.top, 6)
                // YOU WIN → S pops in; a loss → R; a draw → U (MASCOT_SPEC §3).
                ResultHost(outcome: won ? .win : (lost ? .loss : .draw))
                window
                h2hCard
                if let note {
                    Text(note).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub)
                        .multilineTextAlignment(.center)
                }
                buttons
            }
            .padding(.horizontal, 16).padding(.bottom, 32)
        }
        .pageBackground(.vs, lightOnly: true)
    }

    private var window: some View {
        let draw = outcome.outcome == .draw
        let tone: Color = won ? VsLobbyKit.purple : (draw ? Color(hex: 0x8B5CF6) : VsLobbyKit.slate)
        let bar: [Color] = won ? VsLobbyKit.purpleBar : (draw ? [Color(hex: 0xC4B5FD), Color(hex: 0x8B5CF6)] : VsLobbyKit.slateBar)
        // ART_SPEC §6: YOU WIN! / YOU LOSE / DRAW lettering in place of the text
        // headline (centered, the share button kept on the right); text is the fallback.
        let moment: MomentArt = won ? .youwin : (lost ? .youlose : .draw)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    if moment.isAvailable {
                        MomentLettering(moment) { EmptyView() }
                            .frame(maxWidth: .infinity)
                            .padding(.leading, 42)
                    } else {
                        Image("swords").renderingMode(.template).resizable().scaledToFit()
                            .frame(width: 18, height: 18).foregroundStyle(VsLobbyKit.purple)
                        Text(VsLobby.challengeHeadline(outcome.outcome, from: name))
                            .font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.titleInk)
                            .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ShareLink(item: VsChallengeService.shareURL(code), message: Text(shareText)) {
                        Icon3D(.share, size: 24).frame(width: 44, height: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.squishIcon)
                    .accessibilityLabel("Share the result")
                }
                HStack(spacing: 6) {
                    if let h = VsLobbyKit.home(mode) {
                        BannerGlyph(icon: h.icon, ink: h.accent, accent: h.accent, solid: false, size: 18)
                    }
                    Text("\(VsLobbyKit.modeName(mode).uppercased()) · SAME PUZZLE · \(margin)")
                        .font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleSub)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)

            HStack(alignment: .top, spacing: 8) {
                column(label: "YOU", run: outcome.mine, winner: won, accent: VsLobbyKit.purple).frame(maxWidth: .infinity)
                column(label: "@\(name.uppercased())", run: outcome.theirs, winner: lost, accent: Color(hex: 0xEC4899)).frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 10).padding(.bottom, 12)
        }
        .vsTinted(tone, bar: bar, tint: 0.10, line: 0.32)
        .overlay {
            if won && !Theme.reduceMotion {
                BannerSweep().allowsHitTesting(false)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
        }
    }

    private func column(label: String, run: VsChallengeRun, winner: Bool, accent: Color) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                if winner { Icon3D(.crown, size: 14) }
                Text(label).font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(VsLobbyKit.titleInk).lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            // §L: the mini run on the shared game tray in the mode's color.
            VSMiniRunBoard(run: run)
                .gameTray(accent: VsLobbyKit.accent(mode), state: run.solved ? .won : .lost, radius: 14, padding: 8, lightOnly: true)
            Text(VsLobby.vsClock(run.timeMs)).vsNumber(24)
            Text(run.solved ? "SOLVED IN \(run.guesses)" : "NOT SOLVED")
                .font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.mutedInk)
        }
        .padding(.horizontal, 6).padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .vsTile(winner ? VsLobbyKit.gold : accent, strong: winner)
    }

    private var h2hCard: some View {
        // BJ7: one top line (avatar, label, XP top-aligned), the line 4 under it.
        HStack(alignment: .top, spacing: 10) {
            VSInitialAvatar(name: name, size: 38)
            VStack(alignment: .leading, spacing: 4) {
                Text("YOU AND @\(name.uppercased())").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.mutedInk)
                Text(headToHead.map { HeadToHeadService.headToHeadLine(opponentName: name, $0) } ?? "Head-to-head…")
                    .font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.titleInk)
                    .lineLimit(1).minimumScaleFactor(0.75)
            }
            Spacer(minLength: 4)
            if let xp = xpGain, xp > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("+\(xp)").vsNumber(15)
                    Text("XP").font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0x92400E))
                }
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Capsule().fill(VsLobbyKit.gold.wash(0.22)))
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10).vsTinted(Color(hex: 0xEC4899), radius: 18)
    }

    private var buttons: some View {
        VStack(spacing: 10) {
            NavigationLink {
                if auth.isProActive { VSFriendPage(mode: mode, preselected: [opponentId]) } else { ProView() }
            } label: {
                VStack(spacing: 1) {
                    OutlinedText(text: "CHALLENGE BACK", size: 15, width: 1.5)
                    Text("new puzzle, \(name) races you").font(Brand.font(10.5, .heavy)).foregroundStyle(.white.opacity(0.95))
                        .shadow(color: VsLobbyKit.numberInk.opacity(0.5), radius: 1, x: 0, y: 1)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .accessibilityElement(children: .combine)
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
            VSSoftPurpleButton(title: "VS HOME", icon: "house.fill", variant: .peach, action: onHome)
        }
    }

    private var shareText: String {
        // FINISH_SPEC §S4: the shared caption bank; the link rides as the ShareLink item.
        let m = VsLobbyKit.modeName(mode)
        let day = LeaderboardService.todayLocal()
        switch outcome.outcome {
        case .win: return ShareCopy.caption(.vsWin(opponent: name), game: m, date: day)
        case .loss: return ShareCopy.caption(.vsLoss(opponent: name), game: m, date: day)
        case .draw: return ShareCopy.caption(.vsDraw(opponent: name), game: m, date: day)
        }
    }
}

// MARK: - Challenge sent (§3)

struct VSChallengeSentView: View {
    @ObservedObject var vm: VSMatchViewModel
    let onHome: () -> Void

    private var mode: GameMode { vm.mode }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Wordmark(size: 22).padding(.top, 10)
                VStack(spacing: 12) {
                    Text(headline).font(Brand.font(22, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.titleInk)
                    if let run = vm.sentRun {
                        Text(subline(run)).font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleSub)
                            .multilineTextAlignment(.center)
                        VSMiniRunBoard(run: run, tile: 18)
                            .gameTray(accent: VsLobbyKit.accent(mode), state: run.solved ? .won : .lost, radius: 16, padding: 10, lightOnly: true)
                            .padding(.vertical, 6)
                    }
                    switch vm.sendState {
                    case .sending:
                        CastLoader(label: "SENDING", labelColor: VsLobbyKit.purpleSub, showTips: false)
                    case .failed(let message):
                        Text(message).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                            .multilineTextAlignment(.center)
                    case .sent:
                        Text("They get a notification with your time to beat.")
                            .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.mutedInk).multilineTextAlignment(.center)
                    }
                }
                .padding(18).frame(maxWidth: .infinity)
                .vsTinted(VsLobbyKit.purple, bar: VsLobbyKit.purpleBar, tint: 0.10, line: 0.3)
                .overlay {
                    if case .sent = vm.sendState, !Theme.reduceMotion {
                        BannerSweep().allowsHitTesting(false)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                }

                VStack(spacing: 10) {
                    switch vm.sendState {
                    case .sent(let code):
                        if vm.sendTarget?.link == true {
                            ShareLink(item: VsChallengeService.shareURL(code),
                                      message: Text(VsChallengeService.shareText(mode: mode, code: code))) {
                                CandyLabel(title: "Share link") { Icon3D(.share, size: 20) }
                            }
                            .buttonStyle(CastButtonStyle(color: .blue, size: .large))
                            .simultaneousGesture(TapGesture().onEnded {
                                ShareEvents.log(kind: "link_invite", gameMode: mode.rawValue, surface: "vs_challenge")
                            })
                        }
                    case .failed:
                        VSPrimaryButton(title: "TRY AGAIN", symbol: "arrow.clockwise") { vm.sendChallenge() }
                    case .sending:
                        EmptyView()
                    }
                    VSSoftPurpleButton(title: "VS HOME", icon: "house.fill", variant: .peach, action: onHome)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 32)
        }
        .pageBackground(.vs, lightOnly: true)
    }

    private var headline: String {
        switch vm.sendState {
        case .sending: return "SENDING…"
        case .failed: return "NOT SENT YET"
        case .sent: return "CHALLENGE SENT!"
        }
    }

    /// "CLASSIC · SOLVED IN 4 · 1:52 · 24H TO RACE" / "CLASSIC · NOT SOLVED · 24H TO RACE".
    private func subline(_ run: VsChallengeRun) -> String {
        let m = VsLobbyKit.modeName(mode).uppercased()
        return run.solved
            ? "\(m) · SOLVED IN \(run.guesses) · \(VsLobby.vsClock(run.timeMs)) · 24H TO RACE"
            : "\(m) · NOT SOLVED · 24H TO RACE"
    }
}

// MARK: - Racing a challenge (§4, free to answer)

/// Entry for every way into a challenge: an incoming card, a push or link
/// (/vs/challenge/<code>), or the lobby's code field. Loads the challenge, then
/// shows the expired card, a stored result, your own challenge's results, or
/// the intro with START — which swaps in the game right here, so the game's
/// VS HOME closes this whole flow.
struct VSChallengeRaceView: View {
    let code: String
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var auth = AuthService.shared

    private enum Phase {
        case loading
        case error(String)
        case expired
        case stored(VsChallenge, VsChallengeEntry)
        case mine(VsChallenge, VsSentChallenge?)
        case intro(VsChallenge)
        case playing(VsChallenge)
    }
    @State private var phase: Phase = .loading
    @State private var h2h: HeadToHeadRecord?
    @State private var showAuth = false

    var body: some View {
        Group {
            switch phase {
            case .playing(let c):
                VSGameView(mode: c.mode, intent: .race(c))
            case .stored(let c, let entry):
                VSChallengeResultView(
                    mode: c.mode, code: c.code,
                    outcome: VSChallengeOutcome(
                        mine: VsChallengeRun(solved: entry.solved, boardsSolved: entry.boardsSolved, totalBoards: c.run.totalBoards,
                                             guesses: entry.guesses, timeMs: entry.timeMs, guessLog: entry.guessLog ?? [],
                                             solutions: c.run.solutions),
                        theirs: c.run,
                        outcome: VsOutcome(rawValue: entry.outcome) ?? VsLobby.vsOutcome(entry.vsRun, c.run.vsRun),
                        opponentName: c.challenger.username),
                    opponentId: c.challenger.id, headToHead: h2h, xpGain: nil, onHome: { dismiss() })
                .task { await loadH2H(c) }
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
            default:
                VStack(spacing: 0) {
                    VSNavBar(title: "CHALLENGE", onBack: { dismiss() }) { EmptyView() }
                    ScrollView { content.padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 32) }
                }
                .pageBackground(.vs, lightOnly: true)
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
            }
        }
        .task { if case .loading = phase { await load() } }
        .softSheet(isPresented: $showAuth) { AuthView() }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .loading:
            // The VS loading look (spec §2) — the mode isn't known until it loads.
            CastLoader(label: "LOADING CHALLENGE", labelColor: VsLobbyKit.label, tipColor: VsLobbyKit.sub)
            .frame(maxWidth: .infinity)
            .padding(.top, 120)
        case .error(let message):
            simpleCard(message, sub: auth.isAuthenticated ? nil : "Sign in to race a friend’s run.")
        case .expired:
            simpleCard("This challenge has expired", sub: nil)
        case .mine(let c, let sent):
            mineCard(c, sent)
        case .intro(let c):
            introCard(c)
        default:
            EmptyView()
        }
    }

    private func load() async {
        guard auth.isAuthenticated else { phase = .error("Sign in to race this challenge"); return }
        switch await VsChallengeService.get(code: code) {
        case .failure(let e):
            phase = .error(e.message)
        case .success(let d):
            if let entry = d.entry { phase = .stored(d.challenge, entry) }
            else if d.isMine {
                let sent = await VsChallengeService.list()?.sent.first { $0.code == d.challenge.code }
                phase = .mine(d.challenge, sent)
            }
            else if d.expired { phase = .expired }
            else { phase = .intro(d.challenge) }
        }
    }

    private func loadH2H(_ c: VsChallenge) async {
        guard let me = auth.profile?.id else { return }
        h2h = await HeadToHeadService.fetchHeadToHead(myId: me, opponentId: c.challenger.id)
    }

    private func simpleCard(_ title: String, sub: String?) -> some View {
        VStack(spacing: 10) {
            Image("swords").renderingMode(.template).resizable().scaledToFit()
                .frame(width: 32, height: 32).foregroundStyle(VsLobbyKit.ink)
            Text(title).font(Brand.font(17, .black)).foregroundStyle(VsLobbyKit.titleInk).multilineTextAlignment(.center)
            if let sub { Text(sub).font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.mutedInk).multilineTextAlignment(.center) }
            if !auth.isAuthenticated {
                VSPrimaryButton(title: "SIGN IN") { showAuth = true }
            }
            VSPrimaryButton(title: "VS HOME", variant: auth.isAuthenticated ? .purple : .peach) { dismiss() }
        }
        .padding(16).frame(maxWidth: .infinity).vsTinted(VsLobbyKit.ink, bar: VsLobbyKit.tealBar, barHeight: 6)
    }

    /// The frosted teal intro: RACE @DOUG'S RUN, the mode, the target, START.
    private func introCard(_ c: VsChallenge) -> some View {
        let name = c.challenger.username
        let target = c.run.solved ? "Solved in \(c.run.guesses) · \(VsLobby.vsClock(c.run.timeMs))" : "Not solved — just solve it"
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("RACE @\(name.uppercased())’S RUN").font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.titleInk)
                HStack(spacing: 8) {
                    VSModeChip(mode: c.mode)
                    Spacer()
                    Text("\(c.hoursLeft)H LEFT").font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(VsLobbyKit.ink)
                }
            }
            .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 4).frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    AvatarView(url: c.challenger.avatarUrl, username: name, size: 40)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("TIME TO BEAT").font(Brand.font(10, .black)).tracking(1).foregroundStyle(VsLobbyKit.ink)
                        Text(target).vsNumber(18)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    Spacer(minLength: 0)
                }
                Text("Same puzzle. \(name)’s pace plays out beside you.")
                    .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
                VSPrimaryButton(title: "START", symbol: "play.fill") { Haptics.tap(); phase = .playing(c) }
            }
            .padding(.horizontal, 12).padding(.bottom, 12)
        }
        .vsTinted(VsLobbyKit.ink, bar: VsLobbyKit.tealBar, barHeight: 6, tint: 0.10, line: 0.3)
    }

    /// Your own challenge: who raced it so far.
    private func mineCard(_ c: VsChallenge, _ sent: VsSentChallenge?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                Text("YOUR CHALLENGE").font(Brand.font(16, .black)).foregroundStyle(VsLobbyKit.titleInk)
                Spacer()
                VSModeChip(mode: c.mode)
            }
            Text("Your run: \(c.run.summary)").font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
            let results = sent?.results ?? []
            if results.isEmpty {
                // R asleep: quiet in here (MASCOT_SPEC §1, ART_SPEC §7), kept small inside the card.
                HStack(spacing: 8) {
                    SceneArt(.asleep, height: 56, fallbackSize: 40)
                    Text("Nobody has raced it yet.").font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.label)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(results.enumerated()), id: \.offset) { i, r in
                        HStack(spacing: 8) {
                            VSInitialAvatar(name: r.username, size: 28)
                            Text("@\(r.username)").font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.titleInk)
                            Spacer()
                            if r.outcome == "win" || r.outcome == "loss" {
                                // From YOUR side: "win" = you won (W), "loss" = they beat it (L).
                                RowResultBadge(won: r.outcome == "win", size: 18)
                            }
                            Text(r.outcome == "win" ? "you won" : r.outcome == "loss" ? "\(r.username) won" : "draw")
                                .font(Brand.font(11, .heavy)).foregroundStyle(r.outcome == "loss" ? VsLobbyKit.mutedInk : VsLobbyKit.ink)
                        }
                        .padding(.horizontal, 10).padding(.vertical, 7)
                        .vsStripedRow(i)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            VSPrimaryButton(title: "VS HOME", variant: .peach) { dismiss() }
        }
        .padding(12).vsTinted(VsLobbyKit.ink, bar: VsLobbyKit.tealBar, barHeight: 6)
    }
}
