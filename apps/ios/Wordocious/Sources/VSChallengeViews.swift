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
    private static let absent = Color(hex: 0xCBD5E1)

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

    private func square(_ c: Color) -> some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous).fill(c)
            .frame(width: tile, height: tile)
            .shadow(color: c == Self.correct ? Self.correct.opacity(0.45) : .clear, radius: 3)
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
        .background(VsLobbyKit.page.ignoresSafeArea())
    }

    private var window: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let draw = outcome.outcome == .draw
        let mineBg = draw ? Color(hex: 0xECE8FF) : (won ? Color(hex: 0xEBD6FD) : Color(hex: 0xE2E6FF))
        let theirBg = draw ? Color(hex: 0xECE8FF) : (lost ? Color(hex: 0xEBD6FD) : Color(hex: 0xE2E6FF))
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Image("swords").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 18, height: 18).foregroundStyle(VsLobbyKit.purple)
                    Text(VsLobby.challengeHeadline(outcome.outcome, from: name))
                        .font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleInk)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ShareLink(item: VsChallengeService.shareURL(code), message: Text(shareText)) {
                        Icon3D(.share, size: 22).frame(width: 34, height: 34)
                    }
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
            .background(Color.white.opacity(0.5))

            HStack(alignment: .top, spacing: 0) {
                column(label: "YOU", run: outcome.mine, winner: won).frame(maxWidth: .infinity)
                column(label: "@\(name.uppercased())", run: outcome.theirs, winner: lost).frame(maxWidth: .infinity)
            }
            .padding(.vertical, 14)
        }
        .background {
            ZStack {
                HStack(spacing: 0) { mineBg; theirBg }
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                if won && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
            }
        }
        .clipShape(shape)
        .shadow(color: Color(hex: 0x4C1D95).opacity(0.08), radius: 7, x: 0, y: 4)
    }

    private func column(label: String, run: VsChallengeRun, winner: Bool) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                if winner { Icon3D(.trophy, size: 12) }
                Text(label).font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(VsLobbyKit.purpleSub).lineLimit(1)
            }
            VSMiniRunBoard(run: run)
            Text(VsLobby.vsClock(run.timeMs)).font(Brand.font(22, .black)).monospacedDigit().foregroundStyle(VsLobbyKit.purpleInk)
            Text(run.solved ? "SOLVED IN \(run.guesses)" : "NOT SOLVED")
                .font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.purpleSub)
        }
        .padding(.horizontal, 8)
    }

    private var h2hCard: some View {
        HStack(spacing: 12) {
            VSInitialAvatar(name: name, size: 40, tint: VsLobbyKit.purple)
            VStack(alignment: .leading, spacing: 2) {
                Text("YOU AND @\(name.uppercased())").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.label)
                Text(headToHead.map { HeadToHeadService.headToHeadLine(opponentName: name, $0) } ?? "Head-to-head…")
                    .font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.purpleInk)
            }
            Spacer(minLength: 4)
            if let xp = xpGain, xp > 0 {
                Text("+\(xp) XP").font(Brand.font(11, .black)).foregroundStyle(Color(hex: 0x92400E))
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Capsule().fill(Color(hex: 0xFEF3C7)))
                    .overlay(Capsule().stroke(Color(hex: 0xFCD34D), lineWidth: 1))
            }
        }
        .padding(14).vsCard(radius: 14)
    }

    private var buttons: some View {
        VStack(spacing: 10) {
            NavigationLink {
                if auth.isProActive { VSFriendPage(mode: mode, preselected: [opponentId]) } else { ProView() }
            } label: {
                VStack(spacing: 2) {
                    Text("CHALLENGE BACK").font(Brand.font(14, .black)).tracking(0.6)
                    Text("new puzzle, \(name) races you").font(Brand.font(10.5, .bold)).opacity(0.85)
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.purple))
            }
            .buttonStyle(PressableStyle())
            Button(action: onHome) {
                Text("VS HOME").font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.purpleSub)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xEDE9FE)))
            }
            .buttonStyle(PressableStyle())
        }
    }

    private var shareText: String {
        let m = VsLobbyKit.modeName(mode)
        switch outcome.outcome {
        case .win: return "I beat \(name)’s Wordocious \(m) run (\(margin.lowercased())). Race it — code \(code)"
        case .loss: return "\(name)’s Wordocious \(m) run held against me. Can you beat it? Code \(code)"
        case .draw: return "Dead heat with \(name) on Wordocious \(m). Race it — code \(code)"
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
                    Text(headline).font(Brand.font(22, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleInk)
                    if let run = vm.sentRun {
                        Text(subline(run)).font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleSub)
                            .multilineTextAlignment(.center)
                        VSMiniRunBoard(run: run, tile: 18).padding(.vertical, 6)
                    }
                    switch vm.sendState {
                    case .sending:
                        ProgressView().tint(VsLobbyKit.purple)
                    case .failed(let message):
                        Text(message).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                            .multilineTextAlignment(.center)
                    case .sent:
                        Text("They get a notification with your time to beat.")
                            .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub).multilineTextAlignment(.center)
                    }
                }
                .padding(18).frame(maxWidth: .infinity)
                .background {
                    ZStack {
                        LinearGradient(colors: [Color(hex: 0xEBD6FD), Color(hex: 0xE2E6FF)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        if case .sent = vm.sendState, !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(spacing: 10) {
                    switch vm.sendState {
                    case .sent(let code):
                        if vm.sendTarget?.link == true {
                            ShareLink(item: VsChallengeService.shareURL(code),
                                      message: Text(VsChallengeService.shareText(mode: mode, code: code))) {
                                Text("SHARE LINK").font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(.white)
                                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.purple))
                            }
                            .simultaneousGesture(TapGesture().onEnded {
                                ShareEvents.log(kind: "link_invite", gameMode: mode.rawValue, surface: "vs_challenge")
                            })
                        }
                    case .failed:
                        VSPrimaryButton(title: "TRY AGAIN", color: VsLobbyKit.purple) { vm.sendChallenge() }
                    case .sending:
                        EmptyView()
                    }
                    Button(action: onHome) {
                        Text("VS HOME").font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.purpleSub)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xEDE9FE)))
                    }
                    .buttonStyle(PressableStyle())
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 32)
        }
        .background(VsLobbyKit.page.ignoresSafeArea())
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
                .background(VsLobbyKit.page.ignoresSafeArea())
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
            }
        }
        .task { if case .loading = phase { await load() } }
        .sheet(isPresented: $showAuth) { AuthView() }
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
        VStack(spacing: 14) {
            Image("swords").renderingMode(.template).resizable().scaledToFit()
                .frame(width: 36, height: 36).foregroundStyle(VsLobbyKit.ink)
            Text(title).font(Brand.font(17, .black)).foregroundStyle(VsLobbyKit.deep).multilineTextAlignment(.center)
            if let sub { Text(sub).font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub).multilineTextAlignment(.center) }
            if !auth.isAuthenticated {
                VSPrimaryButton(title: "SIGN IN") { showAuth = true }
            }
            VSPrimaryButton(title: "VS HOME") { dismiss() }
        }
        .padding(20).frame(maxWidth: .infinity).vsCard(radius: 16)
    }

    /// The frosted teal intro: RACE @DOUG'S RUN, the mode, the target, START.
    private func introCard(_ c: VsChallenge) -> some View {
        let name = c.challenger.username
        let target = c.run.solved ? "Solved in \(c.run.guesses) · \(VsLobby.vsClock(c.run.timeMs))" : "Not solved — just solve it"
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("RACE @\(name.uppercased())’S RUN").font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.deep)
                HStack(spacing: 8) {
                    VSModeChip(mode: c.mode)
                    Spacer()
                    Text("\(c.hoursLeft)H LEFT").font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(VsLobbyKit.ink)
                }
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.5))
            VStack(spacing: 14) {
                HStack(spacing: 12) {
                    AvatarView(url: c.challenger.avatarUrl, username: name, size: 52)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("TIME TO BEAT").font(Brand.font(10, .black)).tracking(1).foregroundStyle(VsLobbyKit.ink)
                        Text(target).font(Brand.font(18, .black)).foregroundStyle(VsLobbyKit.deep)
                    }
                    Spacer(minLength: 0)
                }
                Text("Same puzzle. \(name)’s pace plays out beside you.")
                    .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
                    .frame(maxWidth: .infinity, alignment: .leading)
                VSPrimaryButton(title: "START") { Haptics.tap(); phase = .playing(c) }
            }
            .padding(14)
        }
        .background(LinearGradient(colors: [Color(hex: 0xD5F5EE), Color(hex: 0xE0F2FE)], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: Color(hex: 0x134E4A).opacity(0.08), radius: 7, x: 0, y: 4)
    }

    /// Your own challenge: who raced it so far.
    private func mineCard(_ c: VsChallenge, _ sent: VsSentChallenge?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("YOUR CHALLENGE").font(Brand.font(16, .black)).foregroundStyle(VsLobbyKit.deep)
                Spacer()
                VSModeChip(mode: c.mode)
            }
            Text("Your run: \(c.run.summary)").font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
            let results = sent?.results ?? []
            if results.isEmpty {
                // R: quiet in here (MASCOT_SPEC §1), kept small inside the card.
                HStack(spacing: 8) {
                    MascotView(Mascots.empty, size: 40, motion: .bob)
                    Text("Nobody has raced it yet.").font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.label)
                }
            } else {
                ForEach(Array(results.enumerated()), id: \.offset) { _, r in
                    HStack {
                        VSInitialAvatar(name: r.username, size: 28)
                        Text("@\(r.username)").font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep)
                        Spacer()
                        Text(r.outcome == "win" ? "you won" : r.outcome == "loss" ? "\(r.username) won" : "draw")
                            .font(Brand.font(11, .heavy)).foregroundStyle(r.outcome == "loss" ? VsLobbyKit.label : VsLobbyKit.ink)
                    }
                }
            }
            VSPrimaryButton(title: "VS HOME") { dismiss() }
        }
        .padding(16).vsCard(radius: 16)
    }
}
