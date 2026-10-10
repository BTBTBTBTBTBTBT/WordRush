import SwiftUI
import WordociousCore

// MARK: - Data container + loader

/// Everything the profile-social sections need, loaded as one non-blocking
/// pass. Every field has a safe empty default — the page renders its existing
/// content even if all of these fetches fail.
struct ProfileSocialData {
    var persona: PublicProfileService.Persona?
    /// Sweep dailies the target completed today — avatar progress ring.
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

/// Uppercase tracked caption used by every social card title (§C4 card label).
private func socialCaption(_ text: String) -> some View {
    // 2.8 item 17: the named sections (TROPHY CASE, HIGHLIGHTS, LATELY, HEAD TO HEAD) wear the bubble lettering in their
    // cast color; composite captions ("YOU vs NAME", "NAME · LAST 60 DAYS") keep the quiet caps line.
    Group {
        if let hex = StatsProfile.sectionTitleColors[text] {
            BubbleTextView(text: text, palette: .accent(.cast(hex)), maxSize: 20, minSize: 13, alignment: .leading)
                .frame(maxWidth: 240)
        } else {
            FinishLabel(text)
        }
    }
}

/// FINISH_SPEC §A1: every social card is a tinted card in its own accent with the
/// game-card top bar (no plain white).
private struct SocialCard: ViewModifier {
    var accent: Color = Color(hex: 0x7C3AED)

    func body(content: Content) -> some View {
        content
            // BJ7: 12 padding (was 14), a slimmer bar.
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tintedCard(accent: accent, bar: [accent, accent.mixed(over: .white, 0.65)], barHeight: 5)
    }
}

private extension View {
    func socialCard(_ accent: Color = Color(hex: 0x7C3AED)) -> some View { modifier(SocialCard(accent: accent)) }

    /// A small tinted inner tile / row (§A1) — dark keeps the dark surface.
    /// BJ7 / BI23: a soft fill only, no outline (strong = a deeper wash).
    func socialTile(_ accent: Color, radius: CGFloat = 12, strong: Bool = false) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let dark = Theme.isDark
        return background(shape.fill(dark ? accent.opacity(strong ? 0.28 : 0.14) : accent.wash(strong ? 0.26 : 0.13)))
    }
}

// MARK: - Identity: today ring + presence + chips

/// The profile avatar wrapped in a brand-gradient progress ring showing how
/// many of today's sweep dailies the player has completed, with an "N/M today" pill.
struct TodayRingAvatar: View {
    let profile: Profile
    let completedToday: Int

    private var fraction: Double {
        min(1, Double(completedToday) / Double(MedalService.dailyModeCount))
    }

    var body: some View {
        // §20: the progress ring is a rounded square around a letter tile.
        let tile = AvatarView.showsTile(profile.avatarUrl, username: profile.username)
        ZStack {
            AvatarOutline(tile: tile).stroke(Color(hex: 0x7C3AED).opacity(Theme.isDark ? 0.25 : 0.14), lineWidth: 5)
                .frame(width: 100, height: 100)
            AvatarOutline(tile: tile).trim(from: 0, to: fraction)
                .stroke(
                    LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 100, height: 100)
            AvatarView(url: profile.avatarUrl, username: profile.username, size: 84,
                       accentHex: profile.accentColor, emoji: profile.avatarEmoji, pro: Wordocious.isProActive(profile))
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
            // §V3: the tier badge + the level in soft numbers, on a tier-tinted pill.
            LevelBadge(level: profile.level, size: 22, showTier: true)
                .padding(.horizontal, 9).padding(.top, 5).padding(.bottom, 3)
                .tintedPill(BadgeArt.tierAccent(LevelTier.forLevel(profile.level)))

            if let arch = persona?.archetype, let info = ProfileArchetype.info(arch) {
                Button { showArchetype = true } label: {
                    chip("\(info.name.uppercased()) ›", color: Color(hex: 0x7C3AED))
                }.buttonStyle(.squish)
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
            .softSheet(isPresented: $showArchetype) {
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
             rule: "Swept every daily mode on 3 or more days."),
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
                HStack(spacing: 8) {
                    BubbleTextView(text: "PLAYER ARCHETYPES", palette: .accent(FriendsInk.dark ? Color(hex: 0xA78BFA) : FinishInk.purple),
                                   maxSize: 30, minSize: 18, animated: false, alignment: .leading)
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Close") { dismiss() }
                }
                Text("Every player gets one of five archetypes from how they actually play. The first rule you qualify for — top to bottom — is yours.")
                    .font(Brand.font(13, .bold)).foregroundStyle(FinishInk.secondary)
                ForEach(ProfileArchetype.all, id: \.key) { info in
                    archetypeRow(info, highlighted: info.key == targetArchetype)
                }
                if let mine = viewerArchetype, let info = ProfileArchetype.info(mine) {
                    HStack(spacing: 8) {
                        archetypeArt(info.key, size: 26, highlighted: true)
                        Text("You are a ").font(Brand.font(13, .bold)).foregroundColor(FinishInk.secondary)
                        + Text(info.name).font(Brand.font(13, .black)).foregroundColor(FinishInk.purple)
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .socialTile(Color(hex: 0x7C3AED), strong: true)
                }
            }
            .padding(16)
        }
        .pageBackground(.home)
        .presentationDetents([.medium, .large])
        .task {
            guard let myId = AuthService.shared.profile?.id else { return }
            viewerArchetype = await PublicProfileService.persona(id: myId)?.archetype
        }
    }

    /// Each archetype's art (the badge set); the rest of the five stay quiet until one is yours.
    @ViewBuilder private func archetypeArt(_ key: String, size: CGFloat, highlighted: Bool) -> some View {
        let asset: String = {
            switch key {
            case "GRINDER": return "art-badge-trending-up"
            case "SPEEDRUNNER": return "art-badge-zap"
            case "SNIPER": return "art-badge-target"
            case "NIGHT_OWL": return "art-ach-night_owl"
            default: return "art-badge-swords"
            }
        }()
        Image(asset).resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .saturation(highlighted ? 1 : 0.45)
            .opacity(highlighted ? 1 : 0.8)
            .accessibilityHidden(true)
    }

    private func archetypeRow(_ info: ProfileArchetype.Info, highlighted: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            archetypeArt(info.key, size: 30, highlighted: highlighted)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(info.name).font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                    if highlighted {
                        Text(targetName).font(Brand.font(9, .black)).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Capsule().fill(FinishInk.purple))
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                Text(info.rule).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .socialTile(Color(hex: 0x7C3AED), strong: highlighted)
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
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                socialCaption("YOU vs \(target.username.uppercased())")
                Spacer()
            }
            HStack(alignment: .center) {
                // §A2: the record as soft numbers.
                HStack(spacing: 4) {
                    // BJ5: both players' own avatars (the one resolver) flank the record.
                    if let me = AuthService.shared.profile {
                        AvatarView(url: me.avatarUrl, username: me.username, size: 28, userId: me.id).padding(.trailing, 2)
                    }
                    Text("\(h2h.myWins)").softNumber(26)
                    Text("–").font(Brand.font(20, .black)).foregroundStyle(FinishInk.secondary)
                    Text("\(h2h.theirWins)").softNumber(26, color: Theme.isDark ? Color(hex: 0xF9A8D4) : Color(hex: 0x9D174D))
                    AvatarView(url: target.avatarUrl, username: target.username, size: 28, userId: target.id).padding(.leading, 2)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("You \(h2h.myWins), \(target.username) \(h2h.theirWins)")
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
                            .font(Brand.font(11, .black)).foregroundStyle(A11yInk.on(Color(hex: 0x7C3AED)))
                        Text("today — \(target.username) \(scoreLabel(today.theirs)), you \(scoreLabel(today.mine))")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textPrimary)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        Spacer()
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .socialTile(Color(hex: 0x7C3AED))
                    .contentShape(Rectangle())
                }.buttonStyle(.squish)
            }
            HStack(spacing: 4) {
                Icon3D(.lock, size: 11) // ART_SPEC §5
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
        .socialCard(Color(hex: 0xEC4899))
        .contentShape(RoundedRectangle(cornerRadius: 20))
        .onTapGesture { showDetail = true }
        .fullScreenCover(isPresented: $showDetail) {
            H2HDetailScreen(target: target, h2h: h2h)
        }
        .softSheet(item: $boardRequest) { GuardedBoardSheet(request: $0) }
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
                PageBackground(tint: .home)
                ScrollView {
                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Text("\(h2h.myWins)").softNumber(32)
                            Text("–").font(Brand.font(24, .black)).foregroundStyle(FinishInk.secondary)
                            Text("\(h2h.theirWins)").softNumber(32, color: Theme.isDark ? Color(hex: 0xF9A8D4) : Color(hex: 0x9D174D))
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("You \(h2h.myWins), \(target.username) \(h2h.theirWins)")
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
                ToolbarItem(placement: .principal) {   // BJ16: HEAD TO HEAD lettering, the rival under it
                    VStack(spacing: 0) {
                        HeadingArtView(.h2h, height: 24, maxWidth: 150, label: "You vs \(target.username)", motion: false)
                        Text("vs @\(target.username)").font(Brand.font(10, .black)).foregroundStyle(FinishInk.secondary)
                            .lineLimit(1).accessibilityHidden(true)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { dismiss() }
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
        .socialTile(s.winner == 1 ? Color(hex: 0x7C3AED) : (s.winner == -1 ? Color(hex: 0xEC4899) : Color(hex: 0x8D99B0)))
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
            PageBackground(tint: .home)
            content
        }
        .presentationDetents([.medium, .large])
        .task { await load() }
    }

    @ViewBuilder private var content: some View {
        switch state {
        case .loading:
            // BI24: the cast wave, never a bare spinner.
            CastLoader(label: "LOADING BOARD", showTips: false)
        case .locked:
            // BI24: a host + brand headline, not a lock glyph over plain text.
            BrandEmptyState(title: "No spoilers yet",
                            line: "Finish today's \(request.modeTitle) and this board opens up.",
                            host: .o3)
        case .failed:
            // R unplugged for the offline / error screen (MASCOT_SPEC §6, ART_SPEC §7).
            BrandEmptyState(title: "Can't load this board", line: Mascots.offlineLine, scene: .unplugged,
                            actionTitle: "Try again", actionSymbol: "arrow.clockwise",
                            action: { state = .loading; Task { await load() } })
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
            // BI24: O3 + brand headline, not a plain grey line.
            BrandEmptyState(title: "No board to show", line: "This mode doesn't keep a board I can replay.",
                            scene: .notFound, artHeight: 100)
        } else {
            let wordLen = boards.first?.solution.count ?? 5
            let tile = CompletedBoardLayout.tileSize(boardCount: boards.count, wordLen: wordLen)
            let rowCount = boards.count > 1 ? CompletedMiniBoardView.sharedRows(boards) : (boards.map(\.maxGuesses).max() ?? 6)   // §AT2
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
        // FINISH_SPEC §AK: the tappable card squishes (a Button, not a tap gesture).
        Button { showHistory = true } label: {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                socialCaption("TROPHY CASE")
                Spacer()
            }
            TrophyShelfView(gold: profile.goldMedals, silver: profile.silverMedals, bronze: profile.bronzeMedals)
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
                .padding(.horizontal, 10).padding(.vertical, 6)
                .socialTile(Color(hex: 0x7C3AED))
            }
        }
        .socialCard(Color(hex: 0xF5A524))
        .contentShape(RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(.squishCard)
        .softSheet(isPresented: $showHistory) {
            MedalHistorySheet(username: profile.username, medals: medals)
        }
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
                PageBackground(tint: .home)
                ScrollView {
                    VStack(spacing: 6) {
                        if medals.isEmpty {
                            // BI24: a host + brand headline, not a plain grey line.
                            BrandEmptyState(title: "No medals yet", line: "Daily podiums award them. Finish top three to earn one.",
                                            host: Mascots.leaderboard)
                                .padding(.vertical, 12)
                        }
                        ForEach(medals) { m in row(m) }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                }
            }
            .navigationTitle("\(username)'s medals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { PageTitle("\(username)'s medals", size: 17) }
                ToolbarItem(placement: .topBarTrailing) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { dismiss() }
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
                rowContent(m)
            }.buttonStyle(.squish)
        } else {
            rowContent(m)
        }
    }

    private func rowContent(_ m: MedalRow) -> some View {
        HStack(spacing: 10) {
            MedalGlyph(type: m.medalType, size: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(medalLabel(m)).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                Text(socialDayLabel(m.day)).font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Spacer()
        }
        .padding(11)
        .socialTile(medalIcon(m.medalType).1)
        .contentShape(Rectangle())
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

/// A medal row's icon as the app's art (gold / silver / bronze medals, the flame badge for streaks, the trophy badge for
/// Perfect); a type with no art keeps its symbol.
struct MedalGlyph: View {
    let type: String
    var size: CGFloat = 26

    private var asset: String? {
        switch type {
        case "gold": return "art-medal-gold"
        case "silver": return "art-medal-silver"
        case "bronze": return "art-medal-bronze"
        case "streak_7", "streak_30", "streak_100": return "art-badge-flame"
        case "perfect": return "art-badge-trophy"
        default: return nil
        }
    }

    var body: some View {
        if let asset {
            Image(asset).resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            SymbolGlyph(medalIcon(type).0, size: size * 0.55, color: medalIcon(type).1)
                .frame(width: size, height: size)
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
            PageBackground(tint: .home)
            ScrollView {
                VStack(spacing: 8) {
                    socialCaption("\(socialModeTitle(request.mode).uppercased()) · \(socialDayLabel(request.day).uppercased())")
                        .padding(.top, 14)
                    if loading {
                        CastLoader(label: "LOADING PODIUM", showTips: false).padding(.vertical, 30)
                    } else if entries.isEmpty {
                        // BI24: R asleep + brand headline, not a plain grey line.
                        BrandEmptyState(title: "No podium this day", line: "Nobody made the top three for this one.",
                                        scene: .asleep, artHeight: 100)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(entries) { e in
                            NavigationLink(value: e.userId) {
                                HStack(spacing: 10) {
                                    MedalGlyph(type: e.medalType, size: 28)
                                    Text(e.username).font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                                    Spacer()
                                }
                                .padding(12)
                                .socialTile(medalIcon(e.medalType).1)
                                .contentShape(Rectangle())
                            }.buttonStyle(.squish)
                        }
                    }
                }
                .padding(.horizontal, 14)
            }
        }
        .navigationTitle("Podium")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .principal) { HeadingArtView(.podium, height: 30, maxWidth: 160, motion: false) } }   // BJ16
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
        let all = self.items
        // Item 17: never a lonely tile with an empty half — one highlight folds into a single centered line above Lately,
        // two or more fill an even 2-column grid (core highlightsLayout drops an odd last one).
        let layout = StatsProfile.highlightsLayout(count: all.count)
        let items = Array(all.prefix(layout.shown))
        Group {
            if items.isEmpty {
                EmptyView()
            } else if layout.fold {
                let item = items[0]
                Button { if item.tapsCalendar { showCalendar = true } } label: {
                    HStack(spacing: 8) {
                        SymbolGlyph(item.symbol, size: 15, color: item.color)
                        Text(item.big).softNumber(15)
                        Text(item.caption).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.squishCard)
                .disabled(!item.tapsCalendar)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    socialCaption("HIGHLIGHTS")
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
                        ForEach(items) { item in
                            card(item)
                                .contentShape(Rectangle())
                                .onTapGesture { if item.tapsCalendar { Haptics.tap(); showCalendar = true } }
                        }
                    }
                }
                .socialCard(Color(hex: 0xF97316))
            }
        }
        .softSheet(isPresented: $showCalendar) {
            StreakCalendarSheet(username: profile.username, calendar: calendar)
        }
    }

    private func card(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            SymbolGlyph(item.symbol, size: 15, color: item.color)
            Text(item.big).softNumber(16)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(item.caption).font(Brand.font(9, .bold)).foregroundStyle(FinishInk.secondary)
                .lineLimit(2).multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .socialTile(item.color, radius: 13)
    }
}

/// 60-day dot grid of daily completions — gold ring on Daily Sweep days.
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
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    BubbleTextView(text: "LAST 60 DAYS", palette: .accent(FriendsInk.dark ? Color(hex: 0xFCD34D) : Color(hex: 0xF59E0B)),
                                   maxSize: 30, minSize: 18, animated: false, alignment: .leading)
                    FinishLabel(username.uppercased(), color: FriendsInk.lavender)
                }
                HeaderCircleButton(.symbol("xmark"), size: 32, label: "Close") { dismiss() }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 10), spacing: 10) {
                ForEach(days, id: \.key) { day in
                    // Each day judged against ITS era's sweep size (the
                    // 60-day window can straddle the Stage 9 switch).
                    dot(played: day.count > 0, strength: min(1, 0.55 + Double(day.count) / 12),
                        sweep: day.count >= ModeGen.requiredSweepCount(for: day.key), size: 15)
                        .frame(width: 21, height: 21)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 14)
            .tintedCard(accent: FinishInk.purple, radius: 18, tint: 0.06, line: 0.2)
            HStack(spacing: 14) {
                legend(played: true, ring: false, label: "Played")
                legend(played: true, ring: true, label: "Daily Sweep")
                legend(played: false, ring: false, label: "Missed")
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .pageBackground(.home)
        .presentationDetents([.medium])
    }

    /// A glossy candy dot: a lit gradient with a small highlight (a missed day is a quiet recessed one); a gold ring on sweeps.
    private func dot(played: Bool, strength: Double, sweep: Bool, size: CGFloat) -> some View {
        ZStack {
            if played {
                Circle().fill(LinearGradient(colors: [Color.white.mixed(over: FinishInk.purple, 0.35), FinishInk.purple],
                                             startPoint: .top, endPoint: .bottom))
                    .opacity(strength)
                    .frame(width: size, height: size)
                    .shadow(color: FinishInk.purple.opacity(0.3), radius: 1.5, y: 1)
                Ellipse().fill(Color.white.opacity(0.45 * strength))
                    .frame(width: size * 0.5, height: size * 0.28)
                    .offset(y: -size * 0.24)
            } else {
                Circle().fill(FinishInk.purple.opacity(Theme.isDark ? 0.18 : 0.10))
                    .frame(width: size, height: size)
            }
            if sweep {
                Circle().stroke(LinearGradient(colors: [Color(hex: 0xFFE07A), Color(hex: 0xF5A524)], startPoint: .top, endPoint: .bottom),
                                lineWidth: 2)
                    .frame(width: size + 6, height: size + 6)
            }
        }
    }

    private func legend(played: Bool, ring: Bool, label: String) -> some View {
        HStack(spacing: 6) {
            dot(played: played, strength: 1, sweep: ring, size: 11)
                .frame(width: 17, height: 17)
            Text(label).font(Brand.font(11, .black)).foregroundStyle(FinishInk.secondary)
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
                        }
                        .padding(.horizontal, 10).padding(.vertical, 7)
                        .socialTile(Color(hex: 0xEC4899))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.squish)
                    .padding(.top, 6)
                }
            }
            .socialCard(Color(hex: 0xF97316))
        }
    }

    private func goldLine(_ g: GoldDay) -> String {
        g.count == 1 ? "Won gold in 1 mode" : "Won gold in \(g.count) modes"
    }

    @ViewBuilder
    private func feedRow(icon: String, color: Color, text: String, when: String, divider: Bool) -> some View {
        if divider { Rectangle().fill(Color(hex: 0xF97316).opacity(0.14)).frame(height: 1) }
        HStack(alignment: .top, spacing: 10) {
            SymbolGlyph(icon, size: 14, color: color)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.08)))
            VStack(alignment: .leading, spacing: 4) {
                Text(text).font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                Text(when).font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 5)
    }
}
