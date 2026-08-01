import SwiftUI
import WordociousCore

// MARK: - Data container + loader

/// Everything the profile-social sections need, loaded as one non-blocking
/// pass. Every field has a safe empty default — the page renders its existing
/// content even if all of these fetches fail.
struct ProfileSocialData {
    var persona: PublicProfileService.Persona?
    /// Dailies the target completed today (0–9) — avatar progress ring.
    var todayCount = 0
    /// Viewer↔target record from shared dailies (nil = signed out / own profile).
    var h2h: PublicProfileService.H2HSummary?
    var medals: [MedalRow] = []
    var hasPerfectOcto = false
    /// day → completed-mode count, last 60 days (streak calendar).
    var calendar: [String: Int] = [:]
    var viewerId: String?
}

enum ProfileSocialLoader {
    static func load(userId: String) async -> ProfileSocialData {
        var d = ProfileSocialData()
        let viewerId = await MainActor.run { AuthService.shared.profile?.id }
        d.viewerId = viewerId
        async let persona = PublicProfileService.persona(id: userId)
        async let ring = PublicProfileService.todayRing(userId: userId)
        async let medals = MedalsService.recent(userId: userId, limit: 200)
        async let octo = PublicProfileService.hasPerfectOcto(userId: userId)
        async let cal = PublicProfileService.streakCalendar(userId: userId)
        if let viewerId, viewerId != userId {
            d.h2h = await PublicProfileService.h2h(viewerId: viewerId, targetId: userId)
        }
        d.persona = await persona
        d.todayCount = await ring
        d.medals = await medals
        d.hasPerfectOcto = await octo
        d.calendar = await cal
        return d
    }
}

// MARK: - Shared helpers

/// Proper-case mode title from a daily_results/medals game_mode key
/// (DUEL_6 → "Six") via the single-source mode catalog.
func socialModeTitle(_ dbKey: String?) -> String {
    guard let dbKey else { return "Daily" }
    if let m = homeModes.first(where: { $0.dbKey == dbKey }) { return m.title }
    if let gm = GameMode(rawValue: dbKey) { return ModeStyle.title(gm).capitalized }
    return dbKey.capitalized
}

/// "0:41" / "2:04" clock format for solve times.
func socialClock(_ seconds: Int) -> String {
    String(format: "%d:%02d", seconds / 60, seconds % 60)
}

/// "Today" / "Yesterday" / weekday within a week / "MMM d" for a yyyy-MM-dd key.
func socialDayLabel(_ day: String) -> String {
    let inF = DateFormatter()
    inF.locale = Locale(identifier: "en_US_POSIX")
    inF.calendar = Calendar(identifier: .gregorian)
    inF.dateFormat = "yyyy-MM-dd"
    inF.timeZone = .current
    guard let d = inF.date(from: day) else { return day }
    if Calendar.current.isDateInToday(d) { return "Today" }
    if Calendar.current.isDateInYesterday(d) { return "Yesterday" }
    let days = Calendar.current.dateComponents([.day], from: d, to: Date()).day ?? 99
    let outF = DateFormatter()
    outF.dateFormat = days < 7 ? "EEEE" : "MMM d"
    return outF.string(from: d)
}

/// Uppercase tracked caption used by every social card title.
private func socialCaption(_ text: String) -> some View {
    Text(text)
        .font(Brand.font(10, .black)).tracking(0.8)
        .foregroundStyle(Theme.textMuted)
        .lineLimit(1).minimumScaleFactor(0.7)
}

private struct SocialCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }
}

private extension View {
    func socialCard() -> some View { modifier(SocialCard()) }
}

// MARK: - Identity: today ring + presence + chips

/// The profile avatar wrapped in a brand-gradient progress ring showing how
/// many of today's dailies the player has completed, with an "N/9 today" pill.
struct TodayRingAvatar: View {
    let profile: Profile
    let completedToday: Int

    private var fraction: Double {
        min(1, Double(completedToday) / Double(MedalService.dailyModeCount))
    }

    var body: some View {
        ZStack {
            Circle().stroke(Theme.border, lineWidth: 5)
                .frame(width: 114, height: 114)
            Circle().trim(from: 0, to: fraction)
                .stroke(
                    LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 114, height: 114)
            AvatarView(url: profile.avatarUrl, username: profile.username, size: 96,
                       accentHex: profile.accentColor, emoji: profile.avatarEmoji)
        }
        .overlay(alignment: .bottom) {
            if completedToday > 0 {
                Text("\(completedToday)/\(MedalService.dailyModeCount) today")
                    .font(Brand.font(10, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(Theme.primary))
                    .offset(y: 8)
            }
        }
        .padding(.bottom, completedToday > 0 ? 8 : 0)
    }
}

/// "Played 12 minutes ago" with a green pulsing dot when recent.
struct PresenceLine: View {
    let lastSeenAt: String
    @State private var pulse = false

    private static let green = Color(hex: 0x22C55E)

    var body: some View {
        if let date = parseTimestamp(lastSeenAt) {
            let mins = Int(-date.timeIntervalSinceNow / 60)
            HStack(spacing: 6) {
                Circle()
                    .fill(mins <= 15 ? Self.green : Theme.textMuted.opacity(0.5))
                    .frame(width: 7, height: 7)
                    .background(
                        Circle().fill(Self.green.opacity(mins <= 15 ? 0.25 : 0))
                            .frame(width: pulse ? 15 : 9, height: pulse ? 15 : 9)
                    )
                    .onAppear {
                        guard mins <= 15, !Theme.reduceMotion else { return }
                        withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) { pulse = true }
                    }
                Text(Self.label(minutes: mins))
                    .font(Brand.font(11, .bold)).foregroundStyle(Theme.textSecondary)
            }
        }
    }

    static func label(minutes: Int) -> String {
        switch minutes {
        case ..<2: return "Playing now"
        case ..<60: return "Played \(minutes) minutes ago"
        case ..<(60 * 24):
            let h = minutes / 60
            return "Played \(h) \(h == 1 ? "hour" : "hours") ago"
        default:
            let d = minutes / (60 * 24)
            return "Played \(d) \(d == 1 ? "day" : "days") ago"
        }
    }
}

/// Level + archetype + percentile + signature-opener chip row. The archetype
/// chip opens an explainer sheet that also names the VIEWER's own archetype.
struct ProfileIdentityChips: View {
    let profile: Profile
    let persona: PublicProfileService.Persona?
    @State private var showArchetype = false

    var body: some View {
        // Wrapping HStack via two rows would over-engineer; chips are short and
        // scale down like the app's other chip rows.
        HStack(spacing: 6) {
            // Existing level badge, restyled into the row (same colors as before).
            HStack(spacing: 4) {
                Image(systemName: "star.fill").font(.system(size: 10)).foregroundStyle(Color(hex: 0xD97706))
                Text("LEVEL \(profile.level)").font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0x92400E))
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(Color(hex: 0xFEF9EC)))
            .overlay(Capsule().stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))

            if let arch = persona?.archetype, let info = ProfileArchetype.info(arch) {
                Button { showArchetype = true } label: {
                    chip("\(info.name.uppercased()) ›", color: Color(hex: 0x7C3AED))
                }.buttonStyle(.plain)
            }
            if let pct = persona?.bestPercentile {
                chip("TOP \(Int(pct.topPct.rounded()))% · \(socialModeTitle(pct.mode).uppercased())",
                     color: Color(hex: 0x0D9488))
            }
        }
        if let opener = persona?.opener {
            chip("OPENS WITH \u{201C}\(opener.word.uppercased())\u{201D}", color: Color(hex: 0xEC4899))
        }
        // Sheet host — attached to an always-present, layout-free anchor.
        Color.clear.frame(width: 0, height: 0)
            .sheet(isPresented: $showArchetype) {
                ArchetypeSheet(targetName: profile.username,
                               targetArchetype: persona?.archetype ?? "")
            }
    }

    private func chip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(Brand.font(10, .black)).tracking(0.4)
            .foregroundStyle(color)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(color.opacity(0.08)))
            .overlay(Capsule().stroke(color.opacity(0.35), lineWidth: 1.5))
            .lineLimit(1).minimumScaleFactor(0.8)
    }
}

// MARK: - Archetypes

enum ProfileArchetype {
    struct Info { let key: String; let name: String; let symbol: String; let rule: String }

    /// Priority order matches the server's computation.
    static let all: [Info] = [
        Info(key: "GRINDER", name: "Grinder", symbol: "repeat",
             rule: "Swept all nine daily modes on 3 or more days."),
        Info(key: "SPEEDRUNNER", name: "Speedrunner", symbol: "bolt.fill",
             rule: "Average solve time of 90 seconds or under (10+ games)."),
        Info(key: "SNIPER", name: "Sniper", symbol: "scope",
             rule: "Averages 3.6 guesses or fewer on single-board modes (10+ games)."),
        Info(key: "NIGHT_OWL", name: "Night Owl", symbol: "moon.fill",
             rule: "40% or more of plays happen late at night."),
        Info(key: "CHALLENGER", name: "Challenger", symbol: "flag.fill",
             rule: "Everyone else — still climbing."),
    ]

    static func info(_ key: String) -> Info? { all.first { $0.key == key } }
}

/// Explains the five archetypes, highlights the target's, and names the
/// viewer's own (fetched from the persona endpoint when signed in).
struct ArchetypeSheet: View {
    let targetName: String
    let targetArchetype: String
    @Environment(\.dismiss) private var dismiss
    @State private var viewerArchetype: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    socialCaption("PLAYER ARCHETYPES")
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20)).foregroundStyle(Theme.textMuted)
                    }.buttonStyle(.plain)
                }
                Text("Every player gets one of five archetypes from how they actually play. The first rule you qualify for — top to bottom — is yours.")
                    .font(Brand.body(13)).foregroundStyle(Theme.textSecondary)
                ForEach(ProfileArchetype.all, id: \.key) { info in
                    archetypeRow(info, highlighted: info.key == targetArchetype)
                }
                if let mine = viewerArchetype, let info = ProfileArchetype.info(mine) {
                    HStack(spacing: 8) {
                        Image(systemName: info.symbol).font(.system(size: 14)).foregroundStyle(Theme.primary)
                        Text("You are a ").font(Brand.body(13)).foregroundColor(Theme.textSecondary)
                        + Text(info.name).font(Brand.font(13, .black)).foregroundColor(Theme.primary)
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.primary.opacity(0.08)))
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .presentationDetents([.medium, .large])
        .task {
            guard let myId = AuthService.shared.profile?.id else { return }
            viewerArchetype = await PublicProfileService.persona(id: myId)?.archetype
        }
    }

    private func archetypeRow(_ info: ProfileArchetype.Info, highlighted: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: info.symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(highlighted ? Theme.primary : Theme.textMuted)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: 8)
                    .fill((highlighted ? Theme.primary : Theme.textMuted).opacity(0.1)))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(info.name).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                    if highlighted {
                        Text(targetName).font(Brand.font(9, .black)).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Capsule().fill(Theme.primary))
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                Text(info.rule).font(Brand.font(11, .bold)).foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(highlighted ? Theme.primary : Theme.border, lineWidth: 1.5))
    }
}

// MARK: - You vs Them

/// Sheet request for a guarded solved-board view.
struct BoardSheetRequest: Identifiable {
    var id: String { seed }
    let targetId: String
    let targetName: String
    let seed: String
    let mode: GameMode?
    var modeTitle: String { socialModeTitle(mode?.rawValue) }
}

struct YouVsThemCard: View {
    let target: Profile
    let h2h: PublicProfileService.H2HSummary
    @State private var showDetail = false
    @State private var boardRequest: BoardSheetRequest?

    private var leadNote: String {
        if h2h.myWins > h2h.theirWins { return "You lead all-time" }
        if h2h.theirWins > h2h.myWins { return "\(target.username) leads all-time" }
        return "Dead even all-time"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                socialCaption("YOU vs \(target.username.uppercased())")
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
            }
            HStack(alignment: .center) {
                (Text("\(h2h.myWins)").foregroundColor(Theme.primary)
                 + Text(" – ").foregroundColor(Theme.textMuted)
                 + Text("\(h2h.theirWins)").foregroundColor(Theme.textPrimary))
                    .font(Brand.font(24, .black))
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text(leadNote)
                    Text("\(h2h.shared.count) shared \(h2h.shared.count == 1 ? "daily" : "dailies") all-time")
                }
                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.trailing)
            }
            if let today = h2h.today {
                Button {
                    boardRequest = BoardSheetRequest(
                        targetId: target.id, targetName: target.username,
                        seed: generateDailySeed(date: today.day, gameMode: today.mode),
                        mode: GameMode(rawValue: today.mode))
                } label: {
                    HStack(spacing: 6) {
                        Text(socialModeTitle(today.mode).uppercased())
                            .font(Brand.font(11, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                        Text("today — \(target.username) \(scoreLabel(today.theirs)), you \(scoreLabel(today.mine))")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textPrimary)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
            HStack(spacing: 4) {
                Image(systemName: "lock.fill").font(.system(size: 8)).foregroundStyle(Theme.textMuted)
                Text("Boards open only for dailies you've finished")
                    .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            }
            HStack(spacing: 10) {
                statColumn("AVG GUESSES",
                           them: h2h.theirAvgGuesses.map { String(format: "%.1f", $0) },
                           you: h2h.myAvgGuesses.map { String(format: "%.1f", $0) })
                statColumn("AVG SOLVE",
                           them: h2h.theirAvgTime.map { socialClock(Int($0)) },
                           you: h2h.myAvgTime.map { socialClock(Int($0)) })
                statColumn("SWEEPS", them: "\(h2h.theirSweeps)", you: "\(h2h.mySweeps)")
            }
        }
        .socialCard()
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture { showDetail = true }
        .fullScreenCover(isPresented: $showDetail) {
            H2HDetailScreen(target: target, h2h: h2h)
        }
        .sheet(item: $boardRequest) { GuardedBoardSheet(request: $0) }
    }

    private func statColumn(_ label: String, them: String?, you: String?) -> some View {
        VStack(spacing: 2) {
            Text(label).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
            (Text(them ?? "—").foregroundColor(Color(hex: 0xEC4899))
             + Text(" / ").foregroundColor(Theme.textMuted)
             + Text(you ?? "—").foregroundColor(Theme.textSecondary))
                .font(Brand.font(12, .black))
        }
        .frame(maxWidth: .infinity)
        .lineLimit(1).minimumScaleFactor(0.7)
    }
}

/// "3 guesses" for single-board dailies, "6/8 boards" for multi-board ones.
func scoreLabel(_ cell: PublicProfileService.DailyCell) -> String {
    if let total = cell.totalBoards, total > 1 {
        return "\(cell.boardsSolved ?? 0)/\(total) boards"
    }
    let g = cell.guessCount ?? 0
    return "\(g) \(g == 1 ? "guess" : "guesses")"
}

/// Full-screen list of every shared daily: date, mode, both scores, winner dot.
struct H2HDetailScreen: View {
    let target: Profile
    let h2h: PublicProfileService.H2HSummary
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 8) {
                        (Text("\(h2h.myWins)").foregroundColor(Theme.primary)
                         + Text(" – ").foregroundColor(Theme.textMuted)
                         + Text("\(h2h.theirWins)").foregroundColor(Theme.textPrimary))
                            .font(Brand.font(30, .black))
                        Text("\(h2h.shared.count) shared \(h2h.shared.count == 1 ? "daily" : "dailies") · ties \(h2h.ties)")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                            .padding(.bottom, 6)
                        ForEach(h2h.shared) { s in row(s) }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                }
            }
            .navigationTitle("You vs \(target.username)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
                }
            }
        }
    }

    private func row(_ s: PublicProfileService.SharedDaily) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(s.winner == 1 ? Theme.primary : (s.winner == -1 ? Color(hex: 0xEC4899) : Theme.textMuted.opacity(0.4)))
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(socialModeTitle(s.mode)).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                Text(socialDayLabel(s.day)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("You \(scoreLabel(s.mine))").foregroundStyle(s.winner == 1 ? Theme.primary : Theme.textSecondary)
                Text("\(target.username) \(scoreLabel(s.theirs))")
                    .foregroundStyle(s.winner == -1 ? Color(hex: 0xEC4899) : Theme.textSecondary)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .font(Brand.font(11, .heavy))
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }
}

// MARK: - Guarded solved-board sheet

/// Read-only reconstruction of another player's solved daily board — the
/// server enforces the one spoiler rule (403 until the viewer finishes that
/// daily), and this sheet renders the lock state when it does.
struct GuardedBoardSheet: View {
    let request: BoardSheetRequest
    @Environment(\.dismiss) private var dismiss

    private enum LoadState {
        case loading
        case locked
        case failed
        case loaded(PublicProfileService.SolvedDailyBoard, [BoardState])
    }
    @State private var state: LoadState = .loading

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            content
        }
        .presentationDetents([.medium, .large])
        .task { await load() }
    }

    @ViewBuilder private var content: some View {
        switch state {
        case .loading:
            ProgressView().tint(Theme.primary)
        case .locked:
            VStack(spacing: 10) {
                Image(systemName: "lock.fill").font(.system(size: 30)).foregroundStyle(Theme.textMuted)
                Text("Finish today's \(request.modeTitle) first — no spoilers")
                    .font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Boards open only for dailies you've finished.")
                    .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }.padding(24)
        case .failed:
            VStack(spacing: 10) {
                Image(systemName: "wifi.slash").font(.system(size: 26)).foregroundStyle(Theme.textMuted)
                Text("Couldn't load this board").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
            }.padding(24)
        case let .loaded(board, boards):
            ScrollView {
                VStack(spacing: 12) {
                    socialCaption("\(request.targetName.uppercased()) · \(request.modeTitle.uppercased())")
                        .padding(.top, 18)
                    HStack(spacing: 10) {
                        Text(board.won == true ? "Solved" : "Not solved")
                            .font(Brand.font(12, .black))
                            .foregroundStyle(board.won == true ? Theme.win : Color(hex: 0xDC2626))
                        if let t = board.timeSeconds, t > 0 {
                            Label(socialClock(t), systemImage: "clock")
                                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                        }
                        Text("\(board.guesses.count) \(board.guesses.count == 1 ? "guess" : "guesses")")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                    }
                    boardsGrid(boards)
                        .padding(.bottom, 24)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder private func boardsGrid(_ boards: [BoardState]) -> some View {
        if boards.isEmpty {
            Text("Board unavailable for this mode.")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).padding(24)
        } else {
            let wordLen = boards.first?.solution.count ?? 5
            let tile = CompletedBoardLayout.tileSize(boardCount: boards.count, wordLen: wordLen)
            let rowCount = boards.map(\.maxGuesses).max() ?? 6
            if boards.count == 1 {
                CompletedMiniBoardView(board: boards[0], tileSize: tile, rowCount: rowCount, framed: false)
            } else {
                let cols = Array(repeating: GridItem(.flexible(), spacing: CompletedBoardLayout.gridSpacing),
                                 count: CompletedBoardLayout.cols(boards.count))
                LazyVGrid(columns: cols, spacing: CompletedBoardLayout.gridSpacing) {
                    ForEach(boards.indices, id: \.self) { i in
                        CompletedMiniBoardView(board: boards[i], tileSize: tile, rowCount: rowCount, framed: true)
                    }
                }
                .frame(maxWidth: CompletedBoardLayout.maxWidth(boards.count))
            }
        }
    }

    private func load() async {
        switch await PublicProfileService.sharedBoard(userId: request.targetId, seed: request.seed) {
        case .locked: state = .locked
        case .failed: state = .failed
        case let .board(b):
            guard let mode = GameMode(rawValue: b.gameMode) ?? request.mode else {
                state = .failed; return
            }
            // Engine replay via the deterministic daily seed — same path the
            // Solved-Puzzle review uses, so hint rows/prefills render right.
            let maxGuesses = createInitialState(seed: b.seed, mode: mode).boards.map(\.maxGuesses).max() ?? 6
            let boards = CompletedBoardReconstruct.boards(
                mode: mode, seed: b.seed, solutions: b.solutions,
                guesses: b.guesses, maxGuesses: maxGuesses)
            state = .loaded(b, boards)
        }
    }
}

// MARK: - Trophy case

struct TrophyCaseCard: View {
    let profile: Profile
    let persona: PublicProfileService.Persona?
    let medals: [MedalRow]
    @State private var showHistory = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                socialCaption("TROPHY CASE")
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
            }
            HStack(spacing: 8) {
                shelf("crown.fill", profile.goldMedals, "GOLD", Color(hex: 0xD97706), highlight: true)
                shelf("medal.fill", profile.silverMedals, "SILVER", Theme.textMuted)
                shelf("medal.fill", profile.bronzeMedals, "BRONZE", Color(hex: 0xB45309))
            }
            if let flawless = persona?.flawless, flawless.count > 0 {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles").font(.system(size: 13)).foregroundStyle(Theme.primary)
                    (Text("Rarest: ").foregroundColor(Theme.textPrimary)
                     + Text("Flawless Victory").foregroundColor(Theme.primary)
                     + Text(" ×\(flawless.count)").foregroundColor(Theme.textPrimary))
                        .font(Brand.font(11, .heavy))
                    Spacer()
                    if let pct = flawless.pctOfPlayers {
                        Text("held by \(String(format: pct < 10 ? "%.1f" : "%.0f", pct))% of players")
                            .font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0xEC4899))
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                .padding(.horizontal, 11).padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.primary.opacity(0.06)))
            }
        }
        .socialCard()
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture { showHistory = true }
        .sheet(isPresented: $showHistory) {
            MedalHistorySheet(username: profile.username, medals: medals)
        }
    }

    private func shelf(_ icon: String, _ count: Int, _ label: String, _ color: Color, highlight: Bool = false) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 16)).foregroundStyle(color)
            Text("\(count)").font(Brand.font(21, .black)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: 13)
            .fill(highlight && count > 0 ? Theme.gold.opacity(0.12) : Theme.background))
        .overlay(RoundedRectangle(cornerRadius: 13)
            .stroke(highlight && count > 0 ? Color(hex: 0xFCD34D) : Theme.border, lineWidth: 1.5))
    }
}

/// Push target for a day+mode podium inside the medal-history sheet.
struct PodiumRequest: Hashable {
    let day: String
    let mode: String
}

/// Every medal, mode-labeled; podium rows push the day's full podium, whose
/// usernames push those players' profiles (the browsing loop).
struct MedalHistorySheet: View {
    let username: String
    let medals: [MedalRow]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 6) {
                        if medals.isEmpty {
                            Text("No medals yet — daily podiums award them.")
                                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                                .padding(.vertical, 30)
                        }
                        ForEach(medals) { m in row(m) }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                }
            }
            .navigationTitle("\(username)'s medals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
                }
            }
            .navigationDestination(for: PodiumRequest.self) { PodiumScreen(request: $0) }
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
        }
    }

    @ViewBuilder private func row(_ m: MedalRow) -> some View {
        let isPodium = ["gold", "silver", "bronze"].contains(m.medalType) && m.gameMode != nil && m.gameMode != "ALL"
        if isPodium, let mode = m.gameMode {
            NavigationLink(value: PodiumRequest(day: m.day, mode: mode)) {
                rowContent(m, chevron: true)
            }.buttonStyle(.plain)
        } else {
            rowContent(m, chevron: false)
        }
    }

    private func rowContent(_ m: MedalRow, chevron: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: medalIcon(m.medalType).0)
                .font(.system(size: 14)).foregroundStyle(medalIcon(m.medalType).1)
            VStack(alignment: .leading, spacing: 1) {
                Text(medalLabel(m)).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                Text(socialDayLabel(m.day)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(11)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }

    private func medalLabel(_ m: MedalRow) -> String {
        switch m.medalType {
        case "gold": return "Gold · \(socialModeTitle(m.gameMode))"
        case "silver": return "Silver · \(socialModeTitle(m.gameMode))"
        case "bronze": return "Bronze · \(socialModeTitle(m.gameMode))"
        case "streak_7": return "7-Day Streak"
        case "streak_30": return "30-Day Streak"
        case "streak_100": return "100-Day Streak"
        case "perfect": return "Perfect! · \(socialModeTitle(m.gameMode))"
        default: return socialModeTitle(m.gameMode)
        }
    }
}

func medalIcon(_ type: String) -> (String, Color) {
    switch type {
    case "gold": return ("crown.fill", Color(hex: 0xD97706))
    case "silver": return ("medal.fill", Theme.textMuted)
    case "bronze": return ("medal.fill", Color(hex: 0xB45309))
    case "streak_7": return ("flame.fill", Color(hex: 0xEA580C))
    case "streak_30": return ("flame.fill", Color(hex: 0xDC2626))
    case "streak_100": return ("flame.fill", Color(hex: 0x7C3AED))
    case "perfect": return ("star.fill", Color(hex: 0x7C3AED))
    default: return ("medal.fill", Theme.textMuted)
    }
}

/// One day+mode podium — three medal rows; usernames push their profiles.
struct PodiumScreen: View {
    let request: PodiumRequest
    @State private var entries: [PublicProfileService.PodiumEntry] = []
    @State private var loading = true

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 8) {
                    socialCaption("\(socialModeTitle(request.mode).uppercased()) · \(socialDayLabel(request.day).uppercased())")
                        .padding(.top, 14)
                    if loading {
                        ProgressView().tint(Theme.primary).padding(.vertical, 30)
                    } else if entries.isEmpty {
                        Text("No podium recorded for this day.")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                            .padding(.vertical, 30)
                    } else {
                        ForEach(entries) { e in
                            NavigationLink(value: e.userId) {
                                HStack(spacing: 10) {
                                    Image(systemName: medalIcon(e.medalType).0)
                                        .font(.system(size: 15)).foregroundStyle(medalIcon(e.medalType).1)
                                    Text(e.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
                                }
                                .padding(12)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 14)
            }
        }
        .navigationTitle("Podium")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            entries = await PublicProfileService.podium(day: request.day, mode: request.mode)
            loading = false
        }
    }
}

// MARK: - Highlights

struct HighlightsReel: View {
    let profile: Profile
    let persona: PublicProfileService.Persona?
    let stats: [PublicProfileService.StatRow]
    let hasPerfectOcto: Bool
    let calendar: [String: Int]
    @State private var showCalendar = false

    private struct Item: Identifiable {
        let id: String
        let symbol: String
        let color: Color
        let big: String
        let caption: String
        var tapsCalendar = false
    }

    private var items: [Item] {
        var out: [Item] = []
        if let streak = persona?.longestWinStreak, streak > 1 {
            out.append(Item(id: "streak", symbol: "trophy.fill", color: Color(hex: 0xD97706),
                            big: "\(streak)-win streak", caption: "Career best", tapsCalendar: true))
        }
        if let fastest = stats.filter({ $0.playType == "solo" && $0.fastestTime > 0 }).min(by: { $0.fastestTime < $1.fastestTime }) {
            out.append(Item(id: "fastest", symbol: "bolt.fill", color: Theme.primary,
                            big: socialClock(fastest.fastestTime),
                            caption: "Fastest \(socialModeTitle(fastest.gameMode)) solve"))
        }
        if hasPerfectOcto {
            out.append(Item(id: "octo", symbol: "square.grid.4x3.fill", color: Color(hex: 0xEC4899),
                            big: "8/8 boards", caption: "Perfect OctoWord"))
        }
        if let flawless = persona?.flawless, flawless.count > 0 {
            out.append(Item(id: "flawless", symbol: "sparkles", color: Color(hex: 0x0D9488),
                            big: "\(flawless.count) Flawless",
                            caption: flawless.count == 1 ? "Flawless day" : "Flawless days"))
        }
        return out
    }

    var body: some View {
        let items = self.items
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                socialCaption("HIGHLIGHTS")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 9) {
                        ForEach(items) { item in
                            if item.tapsCalendar {
                                Button { showCalendar = true } label: { card(item) }
                                    .buttonStyle(.plain)
                            } else {
                                card(item)
                            }
                        }
                    }
                    .padding(.horizontal, 1)
                }
            }
            .socialCard()
            .sheet(isPresented: $showCalendar) {
                StreakCalendarSheet(username: profile.username, calendar: calendar)
            }
        }
    }

    private func card(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: item.symbol).font(.system(size: 15)).foregroundStyle(item.color)
            Text(item.big).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(item.caption).font(Brand.font(9, .bold)).foregroundStyle(Theme.textSecondary)
                .lineLimit(2).multilineTextAlignment(.leading)
        }
        .frame(minWidth: 108, alignment: .leading)
        .padding(11)
        .background(RoundedRectangle(cornerRadius: 13).fill(Theme.background))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(Theme.border, lineWidth: 1.5))
    }
}

/// 60-day dot grid of daily completions — gold ring on 9/9 (sweep) days.
struct StreakCalendarSheet: View {
    let username: String
    let calendar: [String: Int]
    @Environment(\.dismiss) private var dismiss

    private var days: [(key: String, count: Int)] {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return (0..<60).reversed().compactMap { offset in
            guard let d = Calendar.current.date(byAdding: .day, value: -offset, to: Date()) else { return nil }
            let key = f.string(from: d)
            return (key, calendar[key] ?? 0)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                socialCaption("\(username.uppercased()) · LAST 60 DAYS")
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20)).foregroundStyle(Theme.textMuted)
                }.buttonStyle(.plain)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 10), spacing: 10) {
                ForEach(days, id: \.key) { day in
                    Circle()
                        .fill(day.count > 0 ? Theme.primary.opacity(min(1, 0.35 + Double(day.count) / 12)) : Theme.border.opacity(0.6))
                        .frame(width: 15, height: 15)
                        .overlay {
                            if day.count >= MedalService.dailyModeCount {
                                Circle().stroke(Theme.gold, lineWidth: 2).frame(width: 21, height: 21)
                            }
                        }
                }
            }
            HStack(spacing: 14) {
                legend(fill: Theme.primary, ring: false, label: "Played")
                legend(fill: Theme.primary, ring: true, label: "Swept all \(MedalService.dailyModeCount)")
                legend(fill: Theme.border.opacity(0.6), ring: false, label: "Missed")
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.background)
        .presentationDetents([.medium])
    }

    private func legend(fill: Color, ring: Bool, label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(fill).frame(width: 10, height: 10)
                .overlay { if ring { Circle().stroke(Theme.gold, lineWidth: 1.5).frame(width: 14, height: 14) } }
            Text(label).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
        }
    }
}

// MARK: - Lately feed + nemesis

struct LatelyCard: View {
    let profile: Profile
    let medals: [MedalRow]
    let persona: PublicProfileService.Persona?

    private struct GoldDay: Identifiable {
        var id: String { day }
        let day: String
        let count: Int
    }

    private var goldDays: [GoldDay] {
        var byDay: [String: Int] = [:]
        for m in medals where m.medalType == "gold" { byDay[m.day, default: 0] += 1 }
        return byDay.map { GoldDay(day: $0.key, count: $0.value) }
            .sorted { $0.day > $1.day }
            .prefix(3).map { $0 }
    }

    private var hasContent: Bool {
        !goldDays.isEmpty || profile.dailyLoginStreak >= 2 || persona?.nemesis != nil
    }

    var body: some View {
        if hasContent {
            VStack(alignment: .leading, spacing: 0) {
                socialCaption("LATELY").padding(.bottom, 4)
                ForEach(Array(goldDays.enumerated()), id: \.element.id) { index, g in
                    feedRow(icon: "crown.fill", color: Color(hex: 0xD97706),
                            text: goldLine(g), when: socialDayLabel(g.day),
                            divider: index > 0)
                }
                if profile.dailyLoginStreak >= 2 {
                    feedRow(icon: "flame.fill", color: Color(hex: 0xEA580C),
                            text: "On a \(profile.dailyLoginStreak)-day daily streak",
                            when: "Today", divider: !goldDays.isEmpty)
                }
                if let nemesis = persona?.nemesis {
                    NavigationLink(value: nemesis.userId) {
                        HStack(spacing: 8) {
                            Image("swords").renderingMode(.template).resizable().scaledToFit()
                                .frame(width: 13, height: 13).foregroundStyle(Color(hex: 0xEC4899))
                            (Text("Most frequent rival: ").foregroundColor(Theme.textPrimary)
                             + Text(nemesis.username).foregroundColor(Color(hex: 0xEC4899))
                             + Text(" — \(nemesis.sharedBoards) shared boards").foregroundColor(Theme.textPrimary))
                                .font(Brand.font(11, .heavy))
                                .lineLimit(1).minimumScaleFactor(0.7)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
                        }
                        .padding(.horizontal, 11).padding(.vertical, 9)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xEC4899).opacity(0.06)))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xEC4899).opacity(0.35), lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 9)
                }
            }
            .socialCard()
        }
    }

    private func goldLine(_ g: GoldDay) -> String {
        g.count == 1 ? "Won gold in 1 mode" : "Won gold in \(g.count) modes"
    }

    @ViewBuilder
    private func feedRow(icon: String, color: Color, text: String, when: String, divider: Bool) -> some View {
        if divider { Rectangle().fill(Theme.border).frame(height: 1) }
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 12)).foregroundStyle(color)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.08)))
            VStack(alignment: .leading, spacing: 1) {
                Text(text).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                Text(when).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 7)
    }
}
