import SwiftUI
import WordociousCore

/// The VS match UI — ports apps/web/components/vs/vs-game.tsx screens
/// (queue → countdown → match → waiting → result → rematch) for native.
struct VSGameView: View {
    @StateObject private var vm: VSMatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var adShown = false

    let mode: GameMode

    init(mode: GameMode, isDaily: Bool = false, inviteCode: String? = nil) {
        self.mode = mode
        _vm = StateObject(wrappedValue: VSMatchViewModel(mode: mode, isDaily: isDaily, inviteCode: inviteCode))
    }

    private var gradient: [Color] { ModeStyle.titleGradient(mode) }
    private var vsModeLabel: String {
        switch mode { case .duel6: return "SIX"; case .duel7: return "SEVEN"; default: return ModeStyle.title(mode) }
    }
    private var label: String { "VS \(vsModeLabel)" }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()

            switch vm.screen {
            case .notConfigured:     notConfigured
            case .queue:             queueScreen
            case .match:             matchScreen
            case .waiting:           waitingScreen
            case .result:            resultScreen
            case .opponentLeft:      opponentLeftScreen
            case .alreadyPlayedDaily: DailyVsAlreadyPlayed(answer: vm.dailyAnswer, gradient: gradient, onHome: goHome)
            }

            if vm.countdown != nil { countdownOverlay }
        }
        .navigationBarBackButtonHidden(true)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Free users watch the game-start ad before matchmaking begins.
            if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.start() } }
            else { vm.start() }
        }
        .onDisappear { vm.leave() }
    }

    private func goHome() { vm.forfeit(); dismiss() }

    private func vsTitle(_ size: CGFloat) -> some View {
        Text(label).font(Brand.font(size, .black))
            .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
    }

    // MARK: - Queue / searching

    private var queueScreen: some View {
        VStack(spacing: 22) {
            vsTitle(36)
            ProgressView().controlSize(.large).tint(Theme.primary)
            VStack(spacing: 6) {
                CyclingStatus()
                Text("Position in queue: \(vm.queuePosition + 1)")
                    .font(Brand.body(13)).foregroundStyle(Theme.textMuted)
            }
            Button(action: goHome) {
                Label("Cancel", systemImage: "xmark")
                    .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.surface)).overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)
            if let m = vm.message { errorPill(m) }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var countdownOverlay: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 12) {
                Text("MATCH FOUND").font(Brand.font(15, .heavy)).tracking(3).foregroundStyle(.white.opacity(0.7))
                Text("\(vm.countdown ?? 0)")
                    .font(Brand.font(96, .black))
                    .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
                    .id(vm.countdown)
                    .transition(.scale.combined(with: .opacity))
            }
            .animation(.easeOut(duration: 0.25), value: vm.countdown)
        }
    }

    // MARK: - Match (playing)

    @ViewBuilder private var matchScreen: some View {
        if let game = vm.game {
            VStack(spacing: 0) {
                HStack {
                    Button(action: goHome) {
                        Image(systemName: "house.fill").font(.system(size: 15, weight: .bold))
                            .foregroundStyle(ModeStyle.accent(mode))
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                    }
                    Spacer()
                    vsTitle(20)
                    Spacer()
                    Color.clear.frame(width: 34, height: 34)
                }
                .padding(.horizontal, 10).padding(.top, 6)

                OpponentStrip(opponent: vm.opponent, gradient: gradient)
                    .padding(.horizontal, 10).padding(.top, 6)

                GeometryReader { geo in
                    BoardLayout(vm: game, availableWidth: geo.size.width, fitHeight: geo.size.height)
                }
                .padding(.horizontal, 10).padding(.vertical, 4)
                KeyboardView(vm: game).padding(.bottom, 6)
            }
            if let t = game.toast { toastView(t) }
        }
    }

    private func toastView(_ text: String) -> some View {
        Text(text).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
            .padding(.top, 120).frame(maxHeight: .infinity, alignment: .top).transition(.opacity)
    }

    // MARK: - Waiting (player done, opponent still playing)

    private var waitingScreen: some View {
        VStack(spacing: 18) {
            Text("Waiting for opponent…").font(Brand.font(30, .black))
                .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
            ProgressView().controlSize(.large).tint(Theme.primary)
            if let game = vm.game {
                statCard(title: "YOUR RESULT", rows: [
                    ("Guesses", "\(game.rowsUsed)"),
                    ("Time", formatTime(Double(vm.playerTimeMs))),
                ])
            }
            statCard(title: "OPPONENT PROGRESS", rows: opponentRows)
            Button(action: goHome) {
                Label("Leave", systemImage: "xmark")
                    .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.surface)).overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 24).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var opponentRows: [(String, String)] {
        var rows = [("Guesses", "\(vm.opponent.attempts)")]
        if vm.opponent.totalBoards > 1 {
            rows.append(("Boards Solved", "\(vm.opponent.boardsSolved)/\(vm.opponent.totalBoards)"))
        }
        return rows
    }

    // MARK: - Result

    private var resultScreen: some View {
        let winner = vm.result?.winner
        let isWin = winner == "player", isDraw = winner == "draw"
        let headline = isWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT"
        let colors: [Color] = isWin ? [Color(hex: 0x4ADE80), Color(hex: 0x6EE7B7)]
            : isDraw ? [Color(hex: 0xFACC15), Color(hex: 0xFDBA74)]
            : [Color(hex: 0xF87171), Color(hex: 0xFDA4AF)]
        return ScrollView {
            VStack(spacing: 22) {
                Text(headline).font(Brand.font(60, .black))
                    .foregroundStyle(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 40)
                if let r = vm.result {
                    statCard(title: nil, rows: [
                        ("Your Guesses", "\(r.playerGuesses)"),
                        ("Opponent Guesses", "\(r.opponentGuesses)"),
                        ("Your Time", formatTime(r.playerTime)),
                        ("Opponent Time", formatTime(r.opponentTime)),
                        ("Your Score", String(format: "%.2f", r.playerScore)),
                        ("Opponent Score", String(format: "%.2f", r.opponentScore)),
                    ])
                    Text("Score = guesses + time penalty (lower is better)")
                        .font(Brand.font(10, .regular)).foregroundStyle(Theme.textMuted)
                }
                rematchSection
                actions
            }
            .padding(.horizontal, 24).padding(.bottom, 24)
        }
    }

    @ViewBuilder private var rematchSection: some View {
        switch vm.rematch {
        case .received:
            VStack(spacing: 10) {
                Text("Opponent wants a rematch!").font(Brand.font(14, .bold)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 12) {
                    Button("Decline") { vm.declineRematch() }
                        .font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
                    Button("Accept") { vm.acceptRematch() }
                        .font(Brand.font(14, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
                }
            }
            .padding(14).background(RoundedRectangle(cornerRadius: 14).stroke(Theme.primary, lineWidth: 2))
        default: EmptyView()
        }
    }

    private var actions: some View {
        HStack(spacing: 12) {
            Button(action: goHome) {
                Label("Home", systemImage: "house.fill").font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)

            switch vm.rematch {
            case .declined:
                Label("No Rematch", systemImage: "xmark").font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
            case .offered:
                Label("Waiting…", systemImage: "hourglass").font(Brand.font(14, .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
            case .received:
                EmptyView()
            case .idle:
                Button { vm.offerRematch() } label: {
                    Label("Rematch", systemImage: "arrow.clockwise").font(Brand.font(14, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
                }.buttonStyle(.plain)
            }
        }
    }

    // MARK: - Opponent left / not configured

    private var opponentLeftScreen: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.fill.xmark").font(.system(size: 40)).foregroundStyle(Theme.textMuted)
            Text("Opponent left the match").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Button("Home", action: goHome).font(Brand.font(15, .black)).foregroundStyle(Theme.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var notConfigured: some View {
        VStack(spacing: 14) {
            vsTitle(30)
            Image(systemName: "bolt.horizontal.circle").font(.system(size: 44)).foregroundStyle(Theme.textMuted)
            Text("VS is almost ready").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Text("Real-time matches turn on once the multiplayer server is connected.")
                .font(Brand.body(13)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
            Button("Back", action: goHome).font(Brand.font(15, .black)).foregroundStyle(Theme.primary).padding(.top, 4)
        }
        .padding(.horizontal, 32).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Shared bits

    private func statCard(title: String?, rows: [(String, String)]) -> some View {
        VStack(spacing: 10) {
            if let title { Text(title).font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading) }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack {
                    Text(row.0).font(Brand.font(13, .bold)).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Text(row.1).font(Brand.font(13, .bold)).foregroundStyle(Theme.textPrimary)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func errorPill(_ text: String) -> some View {
        Text(text).font(Brand.font(13, .bold)).foregroundStyle(.white)
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
    }

    private func formatTime(_ ms: Double) -> String {
        let total = Int((ms / 1000).rounded())
        if total < 60 { return "\(total)s" }
        let m = total / 60, s = total % 60
        return s > 0 ? "\(m)m \(s)s" : "\(m)m"
    }
}

/// Compact opponent progress strip shown above the player's board during a match.
private struct OpponentStrip: View {
    let opponent: VSMatchViewModel.OpponentProgress
    let gradient: [Color]

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "person.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
            Text("Opponent").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textSecondary)
            Spacer()
            if opponent.totalBoards > 1 {
                Text("\(opponent.boardsSolved)/\(opponent.totalBoards) boards").font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
            }
            Text("\(opponent.attempts) guesses").font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
            if opponent.solved {
                Image(systemName: "checkmark.seal.fill").font(.system(size: 13)).foregroundStyle(Color(hex: 0x22C55E))
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }
}

/// Cycling "Searching…/Scanning…/…" status line — ports vs-game.tsx WAITING_PHRASES.
struct CyclingStatus: View {
    private static let phrases = ["Searching", "Scanning", "Seeking", "Matching", "Pairing",
                                  "Connecting", "Locating", "Scouting", "Hunting", "Queuing",
                                  "Polling", "Awaiting", "Preparing", "Loading", "Syncing",
                                  "Summoning", "Fetching", "Probing", "Browsing", "Rallying"]
    @State private var index = 0
    var body: some View {
        Text("\(Self.phrases[index])…")
            .font(Brand.font(18, .bold)).foregroundStyle(Theme.textSecondary)
            .id(index)
            .onReceive(Timer.publish(every: 2.5, on: .main, in: .common).autoconnect()) { _ in
                index = (index + 1) % Self.phrases.count
            }
    }
}

/// Freemium "already played today" screen — ports DailyVsAlreadyPlayed.
private struct DailyVsAlreadyPlayed: View {
    let answer: String
    let gradient: [Color]
    let onHome: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            VStack(spacing: 4) {
                Text("TODAY'S VS PUZZLE").font(Brand.font(10, .heavy)).tracking(2).foregroundStyle(Theme.textMuted)
                Text("Already Played").font(Brand.font(32, .black))
                    .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
            }
            if !answer.isEmpty {
                HStack(spacing: 6) {
                    ForEach(Array(answer.uppercased().enumerated()), id: \.offset) { _, ch in
                        Text(String(ch)).font(Brand.font(18, .black)).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(RoundedRectangle(cornerRadius: 6).fill(LinearGradient(colors: [Color(hex: 0x22C55E), Color(hex: 0x16A34A)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }
                }
            }
            Text("Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center).padding(.horizontal, 16)
            Button(action: onHome) {
                Label("Home", systemImage: "house.fill").font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 24).frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
