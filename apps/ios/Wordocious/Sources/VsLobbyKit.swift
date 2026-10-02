import SwiftUI
import WordociousCore

/// Shared pieces of the VS overhaul (founder-approved 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md): the teal palette, the nine VS modes, today's two
/// battles, and the small views every VS page draws (section labels, cards,
/// bot art, mode chips). The words come from VsLobby (WordociousCore).
enum VsLobbyKit {
    // §0 palette — VS accent is teal; results screens use the home purple.
    static let ink = Color(hex: 0x0F766E)
    static let soft = Color(hex: 0xCCFBF1)
    static let deep = Color(hex: 0x134E4A)
    static let titleGradient = [Color(hex: 0x0D9488), Color(hex: 0x0891B2)]
    static let page = Color(hex: 0xF8F7FF)
    static let label = Color(hex: 0x6B7280)
    static let sub = Color(hex: 0x4B5563)
    static let purple = Color(hex: 0x7C3AED)
    static let purpleInk = Color(hex: 0x4C1D95)
    static let purpleSub = Color(hex: 0x6D28D9)

    /// The nine VS modes in lobby-strip order (VsLobby.modeOrder).
    static let modes: [GameMode] = VsLobby.modeOrder.compactMap { GameMode(rawValue: $0) }

    /// The catalog tile for a mode (title, accent, real home icon).
    static func home(_ mode: GameMode) -> HomeMode? {
        (homeModes + moreModes).first { $0.dbKey == mode.rawValue }
    }

    /// "Classic", "QuadWord"… — the catalog title.
    static func modeName(_ mode: GameMode) -> String {
        ModeGen.byDbKey(mode.rawValue)?.title ?? ModeStyle.title(mode)
    }

    static func accent(_ mode: GameMode) -> Color { ModeStyle.accent(mode) }

    // MARK: Lobby mode selection (persists locally, default Classic)

    private static let modeKey = "wordocious-vs-mode"
    static var selectedMode: GameMode {
        get { UserDefaults.standard.string(forKey: modeKey).flatMap { GameMode(rawValue: $0) }.flatMap { modes.contains($0) ? $0 : nil } ?? .duel }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: modeKey) }
    }

    // MARK: Clocks (the Daily Battle + Bot of the Day are UTC-seeded)

    static func secondsUntilUTCMidnight(_ now: Date = Date()) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let start = cal.startOfDay(for: now)
        let next = cal.date(byAdding: .day, value: 1, to: start) ?? now
        return max(0, Int(next.timeIntervalSince(now)))
    }

    static func utcCountdown(_ now: Date = Date()) -> String {
        let s = secondsUntilUTCMidnight(now)
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    // MARK: Today's Daily Battle

    /// A Daily Battle a bot stepped into (§6) — `wordocious-vs-daily-<UTC day>`.
    private struct DailyBot: Codable { let result: String; let opponent: String }
    private static func dailyBotKey(_ day: String) -> String { "wordocious-vs-daily-\(day)" }

    static func recordDailyBot(result: VsDayResult, opponent: String) {
        let row = DailyBot(result: result.rawValue, opponent: opponent)
        if let data = try? JSONEncoder().encode(row), let s = String(data: data, encoding: .utf8) {
            UserDefaults.standard.set(s, forKey: dailyBotKey(LeaderboardService.todayUTC()))
        }
    }

    static func dailyBot() -> (result: VsDayResult, opponent: String)? {
        guard let s = UserDefaults.standard.string(forKey: dailyBotKey(LeaderboardService.todayUTC())),
              let row = try? JSONDecoder().decode(DailyBot.self, from: Data(s.utf8)),
              let r = VsDayResult(rawValue: row.result) else { return nil }
        return (r, row.opponent)
    }

    /// Today's Daily Battle: the person row (daily_results 'vs' for the LOCAL day —
    /// the day that row is written with) wins over a bot that stepped in (keyed
    /// by the UTC day, like the Daily Battle's seed).
    @MainActor static func dailyBattle() async -> (result: VsDayResult, opponent: String?) {
        if let person = await DailyResultsService.dailyVSOutcome(), person != .open {
            return (person, await lastPersonOpponentToday())
        }
        if let bot = dailyBot() { return (bot.result, bot.opponent) }
        return (.open, nil)
    }

    /// "@kate" for "Beat @kate": the other player of my match on today's daily
    /// VS seed (the shared Daily Battle puzzle).
    @MainActor private static func lastPersonOpponentToday() async -> String? {
        guard let uid = AuthService.shared.profile?.id else { return nil }
        let seed = generateDailySeed(date: LeaderboardService.todayUTC(), gameMode: "DUEL_VS")
        struct Row: Decodable { let player1_id: String; let player2_id: String? }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("player1_id, player2_id")
            .eq("seed", value: seed)
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .not("player2_id", operator: .is, value: "null")
            .order("created_at", ascending: false)
            .limit(1).execute().value) ?? []
        guard let r = rows.first else { return nil }
        let opp = r.player1_id.lowercased() == uid.lowercased() ? (r.player2_id ?? "") : r.player1_id
        guard !opp.isEmpty else { return nil }
        return await PublicProfileService.usernames(ids: [opp])[opp].map { "@\($0)" }
    }

    /// "Classic · open" / "Beat @kate" / "Lost to Lexi" / "Draw with @kate".
    static func tileLine(_ r: VsDayResult, opponent: String?, open: String) -> String {
        let who = opponent ?? "them"
        switch r {
        case .open: return open
        case .won: return "Beat \(who)"
        case .lost: return "Lost to \(who)"
        case .draw: return "Draw with \(who)"
        }
    }

    // MARK: Live counts (the matchmaking server)

    struct Counts {
        var waiting: [String: Int] = [:]
        var playing: [String: Int] = [:]
        var totalWaiting: Int { waiting.values.reduce(0, +) }
    }

    /// /vs/counts — who is waiting in (and playing) each mode's queue right now.
    static func fetchCounts() async -> Counts? {
        struct Body: Decodable { let waiting: [String: Int]?; let playing: [String: Int]? }
        guard let url = VSConfig.serverURL?.appendingPathComponent("vs/counts"),
              let (data, resp) = try? await Net.api.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let b = try? JSONDecoder().decode(Body.self, from: data) else { return nil }
        return Counts(waiting: b.waiting ?? [:], playing: b.playing ?? [:])
    }

    /// /presence — everyone connected (the "N online" fallback).
    static func fetchOnline() async -> Int? {
        struct Body: Decodable { let online: Int }
        guard let url = VSConfig.serverURL?.appendingPathComponent("presence"),
              let (data, resp) = try? await Net.api.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let b = try? JSONDecoder().decode(Body.self, from: data) else { return nil }
        return b.online
    }

    // MARK: Rivals

    /// "You lead 4–3 · last: QuadWord" / "You trail 1–2 · …" / "Even 2–2 · …".
    static func rivalLine(wins: Int, losses: Int, lastMode: String?) -> String {
        let head: String
        if wins > losses { head = "You lead \(wins)–\(losses)" }
        else if losses > wins { head = "You trail \(wins)–\(losses)" }
        else { head = "Even \(wins)–\(losses)" }
        guard let lastMode, let m = GameMode(rawValue: lastMode) else { return head }
        return "\(head) · last: \(modeName(m))"
    }

    /// The bot a live search hands you at 0:15 (§6): the free Daily Battle (and
    /// any Daily Battle) gets Lexi; otherwise the ladder's next bot.
    static func stepInKind(isDaily: Bool) -> CpuKind {
        isDaily ? .medium : BotPersonas.kind(forBotId: CpuProgressionStore.load().nextLadderBot)
    }
}

// MARK: - Views

/// 11 pt / 900 / letter-spaced gray section label (PLAY, RIVALS, THE LADDER…).
struct VSSectionLabel: View {
    let text: String
    var body: some View {
        Text(text).font(Brand.font(11, .black)).tracking(1.2).foregroundStyle(VsLobbyKit.label)
    }
}

extension View {
    /// §0 card: white, radius 14, soft purple shadow, no border.
    func vsCard(radius: CGFloat = 14) -> some View {
        background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Color.white)
            .shadow(color: Color(hex: 0x4C1D95).opacity(0.07), radius: 5, x: 0, y: 2))
    }
}

/// Bot art in a circle — every place a bot appears (§9, never emoji).
struct BotArtCircle: View {
    let art: String
    var size: CGFloat = 36
    var background: Color = VsLobbyKit.soft
    var body: some View {
        ZStack {
            Circle().fill(background)
            Image(art).resizable().interpolation(.high).scaledToFit()
                .padding(size * 0.06)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

/// A person's avatar, or a bot's art when `botArt` is set.
struct VSPlayerAvatar: View {
    let url: String?
    let username: String
    var botArt: String? = nil
    var size: CGFloat = 28
    var body: some View {
        if let botArt { BotArtCircle(art: botArt, size: size) }
        else { AvatarView(url: url, username: username, size: size) }
    }
}

/// Initial-letter avatar circle (incoming challenges, rivals).
struct VSInitialAvatar: View {
    let name: String
    var size: CGFloat = 36
    var tint: Color = VsLobbyKit.ink
    var body: some View {
        Text(String(name.trimmingCharacters(in: CharacterSet(charactersIn: "@ ")).prefix(1)).uppercased())
            .font(Brand.font(size * 0.42, .black)).foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(Circle().fill(tint.opacity(0.14)))
    }
}

/// The mode chip on a page's nav (icon tile + mode name in its color).
struct VSModeChip: View {
    let mode: GameMode
    var body: some View {
        HStack(spacing: 6) {
            VSModeGlyphTile(mode: mode, selected: true, size: 22)
            Text(VsLobbyKit.modeName(mode).uppercased()).font(Brand.font(11, .black)).tracking(0.6)
                .foregroundStyle(VsLobbyKit.accent(mode)).lineLimit(1)
        }
    }
}

/// A mode's real home icon on a small tile: selected = filled with the mode
/// color + glow + white icon; otherwise white with the colored icon.
struct VSModeGlyphTile: View {
    let mode: GameMode
    let selected: Bool
    var size: CGFloat = 34
    var body: some View {
        let accent = VsLobbyKit.accent(mode)
        let shape = RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
        ZStack {
            if selected {
                shape.fill(accent).shadow(color: accent.opacity(0.6), radius: 5)
            } else {
                shape.fill(Color.white).shadow(color: Color(hex: 0x4C1D95).opacity(0.08), radius: 2, y: 1)
            }
            if let h = VsLobbyKit.home(mode) {
                BannerGlyph(icon: h.icon, ink: selected ? .white : accent, accent: accent, solid: selected, size: size * 0.5)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Solid teal caps button (primary VS action).
struct VSPrimaryButton: View {
    let title: String
    var subtitle: String? = nil
    var color: Color = VsLobbyKit.ink
    var disabled = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(title).font(Brand.font(14, .black)).tracking(0.6)
                if let subtitle { Text(subtitle).font(Brand.font(10.5, .bold)).opacity(0.85) }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, subtitle == nil ? 14 : 10)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(disabled ? Color(hex: 0x9CA3AF) : color))
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .disabled(disabled)
    }
}

/// Soft pill (`#ccfbf1` bg, teal text) — JOIN, Challenge, Race it, KEEP WAITING.
struct VSSoftPill: View {
    let title: String
    var bg: Color = VsLobbyKit.soft
    var fg: Color = VsLobbyKit.ink
    var body: some View {
        Text(title).font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(fg)
            .padding(.horizontal, 12).frame(height: 30)
            .background(Capsule().fill(bg))
    }
}

/// Small lock badge for Pro-only rows.
struct VSLockBadge: View {
    var body: some View {
        Image(systemName: "lock.fill").font(.system(size: 9, weight: .bold)).foregroundStyle(VsLobbyKit.label)
    }
}

/// The VS page nav bar: teal back chevron, a gradient caps title, a trailing slot.
struct VSNavBar<Trailing: View>: View {
    let title: String
    /// The page's host beside the title (MASCOT_SPEC §6); nil = none.
    var host: MascotID? = nil
    let onBack: () -> Void
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        ZStack {
            HStack(spacing: 6) {
                Text(title).font(Brand.font(20, .black)).tracking(0.4)
                    .foregroundStyle(LinearGradient(colors: VsLobbyKit.titleGradient, startPoint: .leading, endPoint: .trailing))
                if let host { MascotView(host, size: 32, motion: .bob) }
            }
            HStack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left").font(.system(size: 17, weight: .bold))
                        .foregroundStyle(VsLobbyKit.ink).frame(width: 36, height: 36).contentShape(Rectangle())
                }
                .buttonStyle(.plain).accessibilityLabel("Back")
                Spacer()
                trailing()
            }
        }
        .padding(.horizontal, 8).padding(.top, 4).frame(height: 44)
    }
}

/// The live-search ring: teal on soft teal, filling over the 15 s step-in
/// window, a soft pulse behind, the elapsed time counting up in the middle.
struct SearchRing: View {
    let elapsed: TimeInterval
    @State private var pulse = false

    var body: some View {
        let secs = Int(elapsed)
        ZStack {
            if !Theme.reduceMotion {
                Circle().fill(VsLobbyKit.soft)
                    .frame(width: 128, height: 128)
                    .scaleEffect(pulse ? 1.25 : 0.95).opacity(pulse ? 0 : 0.8)
            }
            Circle().stroke(VsLobbyKit.soft, lineWidth: 9).frame(width: 118, height: 118)
            Circle().trim(from: 0, to: min(1, elapsed / 15))
                .stroke(VsLobbyKit.ink, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 118, height: 118)
            Text("\(secs / 60):\(String(format: "%02d", secs % 60))")
                .font(Brand.font(28, .black)).monospacedDigit().foregroundStyle(VsLobbyKit.deep)
        }
        .frame(width: 140, height: 140)
        .onAppear {
            guard !Theme.reduceMotion else { return }
            withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true }
        }
        .accessibilityLabel("Searching for \(secs) seconds")
    }
}

/// The live-search ring driven by a 60 fps animation timeline (founder,
/// 2026-10-01: the 15 s step-in countdown ticked choppily at 4 fps). The arc
/// moves continuously; the digits still change once a second.
struct LiveSearchRing: View {
    let startedAt: Date?
    /// Stops the frame clock while an opaque overlay (intro / countdown) covers it.
    var paused = false
    var body: some View {
        TimelineView(.animation(minimumInterval: nil, paused: paused)) { ctx in
            SearchRing(elapsed: startedAt.map { max(0, ctx.date.timeIntervalSince($0)) } ?? 0)
        }
    }
}

/// The step-in card's slim teal bar, filling continuously toward the bot's 0:15.
struct StepInProgressBar: View {
    let startedAt: Date?
    var window: TimeInterval = 15
    var body: some View {
        TimelineView(.animation) { ctx in
            let elapsed = startedAt.map { max(0, ctx.date.timeIntervalSince($0)) } ?? 0
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(VsLobbyKit.soft)
                    Capsule().fill(VsLobbyKit.ink).frame(width: geo.size.width * min(1, elapsed / window))
                }
            }
        }
        .frame(height: 6)
    }
}

/// Small solid teal `VS` pill — sits beside a mode title on the match header
/// and the countdown (VS polish spec §1).
struct VSTagPill: View {
    var size: CGFloat = 11
    var body: some View {
        Text("VS").font(Brand.font(size, .black)).tracking(0.6).foregroundStyle(.white)
            .padding(.horizontal, size * 0.65).frame(height: size * 1.8)
            .background(Capsule().fill(VsLobbyKit.ink))
            .accessibilityLabel("Versus")
    }
}

/// Small soft gray caps pill — LEAVE / CANCEL on the VS screens.
struct VSGreyPill: View {
    let title: String
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon { Image(systemName: icon).font(.system(size: 10, weight: .black)) }
                Text(title).font(Brand.font(11, .black)).tracking(0.6)
            }
            .foregroundStyle(VsLobbyKit.sub)
            .padding(.horizontal, 16).frame(height: 32)
            .background(Capsule().fill(Color(hex: 0xEEF0F3)))
            .contentShape(Capsule())
        }
        .buttonStyle(PressableStyle())
    }
}

/// Soft lavender caps button (`#ede9fe` bg, `#6d28d9` text) — the result
/// screens' secondary actions (HOME, SHARE, DECLINE).
struct VSSoftPurpleButton: View {
    let title: String
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).font(.system(size: 12, weight: .black)) }
                Text(title).font(Brand.font(14, .black)).tracking(0.6)
            }
            .foregroundStyle(VsLobbyKit.purpleSub)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xEDE9FE)))
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
    }
}

/// Teal ring spinner on soft teal (VS loading screens).
struct VSRingSpinner: View {
    var size: CGFloat = 46
    var body: some View {
        TimelineView(.animation) { ctx in
            let angle = ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 0.9) / 0.9 * 360
            ZStack {
                Circle().stroke(VsLobbyKit.soft, lineWidth: size * 0.12)
                Circle().trim(from: 0, to: 0.28)
                    .stroke(VsLobbyKit.ink, style: StrokeStyle(lineWidth: size * 0.12, lineCap: .round))
                    .rotationEffect(.degrees(angle))
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Loading")
    }
}

/// VS loading / entry screen (VS polish spec §2): the mode icon in its color,
/// a teal ring spinner and `LOADING <MODE>` on the VS page color — never bare
/// text or a blank screen. Bots add their art + a "Matching you with…" line.
struct VSLoadingView: View {
    let mode: GameMode?
    /// Replaces `LOADING <MODE>` (e.g. "LOADING CHALLENGE" before the mode is known).
    var title: String? = nil
    var botArt: String? = nil
    var line: String? = nil

    var body: some View {
        VStack(spacing: 16) {
            if let mode { VSModeGlyphTile(mode: mode, selected: false, size: 48) }
            // The cast's staggered wave replaces the spinner; LOADING <MODE> stays and
            // D voices a rotating tip (MASCOT_SPEC §3/§6).
            CastLoader(label: title ?? "LOADING \(mode.map { VsLobbyKit.modeName($0).uppercased() } ?? "")",
                       labelColor: VsLobbyKit.label, showTips: botArt == nil && line == nil, tipColor: VsLobbyKit.sub)
            if botArt != nil || line != nil {
                HStack(spacing: 8) {
                    if let botArt { BotArtCircle(art: botArt, size: 30) }
                    if let line {
                        Text(line).font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(VsLobbyKit.page.ignoresSafeArea())
    }
}

/// Soft VS confirm card over a dim backdrop (forfeit and friends): caps title,
/// a short message, a purple primary and a soft secondary action.
struct VSConfirmCard: View {
    let title: String
    let message: String
    let primary: String
    let secondary: String
    var secondaryDestructive = false
    let onPrimary: () -> Void
    let onSecondary: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea().onTapGesture(perform: onPrimary)
            VStack(spacing: 12) {
                Text(title).font(Brand.font(17, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleInk)
                    .multilineTextAlignment(.center)
                Text(message).font(Brand.font(13, .bold)).foregroundStyle(VsLobbyKit.sub)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                VSPrimaryButton(title: primary, color: VsLobbyKit.purple, action: onPrimary).padding(.top, 4)
                Button(action: onSecondary) {
                    Text(secondary).font(Brand.font(14, .black)).tracking(0.6)
                        .foregroundStyle(secondaryDestructive ? Color(hex: 0xB91C1C) : VsLobbyKit.purpleSub)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xEDE9FE)))
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
            }
            .padding(18).frame(maxWidth: 340)
            .vsCard(radius: 16)
            .padding(.horizontal, 24)
        }
        .transition(.opacity)
    }
}
