import SwiftUI
import WordociousCore

/// Shared pieces of the VS overhaul (founder-approved 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md): the teal palette, the nine VS modes, today's two
/// battles, and the small views every VS page draws (section labels, cards,
/// bot art, mode chips). The words come from VsLobby (WordociousCore).
enum VsLobbyKit {
    // §0 palette — VS accent is teal; results screens use the home purple.
    // Season surfaces (SeasonKit, a dark `tone`): the VS pages are light-only, but under a dark
    // season their cards take the season's night glass, so every fixed ink swaps to its light
    // twin (the season's own text tokens). Off season / preview off = the light inks, unchanged.
    static var darkSeason: Bool { SeasonKit.surfaces?.dark == true }
    private static func inked(_ light: UInt, _ season: Color?) -> Color {
        darkSeason ? (season ?? Color(hex: 0xF7EEFF)) : Color(hex: light)
    }

    static var ink: Color { darkSeason ? Color(hex: 0x2DD4BF) : Color(hex: 0x0F766E) }
    static var soft: Color { darkSeason ? Color(hex: 0x134E4A) : Color(hex: 0xCCFBF1) }
    static var deep: Color { darkSeason ? Color(hex: 0x99F6E4) : Color(hex: 0x134E4A) }
    static let titleGradient = [Color(hex: 0x0D9488), Color(hex: 0x0891B2)]
    static var page: Color { darkSeason ? (SeasonKit.surfaces?.card ?? Color(hex: 0x1C0F30)) : Color(hex: 0xF8F7FF) }
    static var label: Color { inked(0x6B7280, SeasonKit.surfaces?.textMuted) }
    static var sub: Color { inked(0x4B5563, SeasonKit.surfaces?.textSecondary) }
    static let purple = Color(hex: 0x7C3AED)
    static var purpleInk: Color { inked(0x4C1D95, SeasonKit.surfaces?.text) }
    static var purpleSub: Color { darkSeason ? Color(hex: 0xC4B5FD) : Color(hex: 0x6D28D9) }

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

    // MARK: FINISH_SPEC §D3 — the cast in the VS look

    /// §A2 soft-number ink (VS pages are drawn light in every theme).
    static var numberInk: Color { inked(0x3B1A78, SeasonKit.surfaces?.text) }
    /// The card heading ink on tinted cards.
    static var titleInk: Color { inked(0x2A1650, SeasonKit.surfaces?.text) }
    static var mutedInk: Color { inked(0x6F5F8F, SeasonKit.surfaces?.textMuted) }
    /// The boss rung / trophy gold.
    static let gold = Color(hex: 0xF5A524)
    static let slate = Color(hex: 0x64748B)
    /// The VS page accent (teal) and its top bar.
    static let tealBar = [Color(hex: 0x14B8A6), Color(hex: 0x0891B2)]
    static let purpleBar = [Color(hex: 0xA66BFF), Color(hex: 0x7C3AED)]
    static let goldBar = [Color(hex: 0xFFD166), Color(hex: 0xF59E0B)]
    static let slateBar = [Color(hex: 0x94A3B8), Color(hex: 0x64748B)]

    /// The art name of Your Ghost (the player's best-run replay).
    static let ghostArt = "bot-ghost"

    /// A cast bot's own color (any bot id; the ghost → VS teal).
    static func castColor(_ botId: String) -> Color {
        botId == "ghost" ? ink : Color(hex: UInt(BotPersonas.persona(botId).color))
    }

    /// The character a bot's art (`mascot-<id>`) draws; nil for the ghost / anything else.
    static func mascot(fromArt art: String?) -> MascotID? {
        guard let art, art.hasPrefix("mascot-") else { return nil }
        return MascotID(rawValue: String(art.dropFirst("mascot-".count)))
    }

    /// A character's cast color (the persona it plays as).
    static func castColor(_ m: MascotID) -> Color {
        BotPersonas.cast.first { $0.mascot == m }.map { Color(hex: UInt($0.color)) } ?? purple
    }

    /// The bot a CPU identity plays as (the Bot of the Day's own character); nil
    /// for Your Ghost and for people.
    static func castId(_ id: CpuIdentity?) -> String? { id?.persona?.id }
}

extension Color {
    /// The VS pages' soft wash: `self` over white (the light look), or — under a dark season —
    /// `self` over the season's night glass, a little stronger so chips and rows still read.
    func vsWash(_ amount: Double) -> Color {
        guard VsLobbyKit.darkSeason, let card = SeasonKit.surfaces?.card else { return wash(amount) }
        return mixed(over: card, min(1, amount * 1.8))
    }
}

// MARK: - §A1 / §A2 VS surfaces (light in every theme — the VS pages are light-only)

extension View {
    /// FINISH_SPEC §A1 on the VS pages: a page card with no plain white — a soft
    /// wash of `accent`, a 1.5-pt accent border and (optionally) the game card's top
    /// bar. Unlike the theme-aware `.tintedCard`, it stays on the light look in dark
    /// mode (the VS pages and their fixed inks are drawn light in every theme).
    func vsTinted(_ accent: Color, bar: [Color]? = nil, radius: CGFloat = 20, barHeight: CGFloat = 10,
                  tint: Double = 0.08, line: Double = 0.26) -> some View {
        modifier(VSTintedCard(accent: accent, bar: bar, radius: radius, barHeight: barHeight, tint: tint, line: line))
    }

    /// §A2 soft numbers on the light VS surfaces: Nunito Black, dark purple
    /// #3b1a78, tabular digits, a soft white lift.
    func vsNumber(_ size: CGFloat, color: Color = VsLobbyKit.numberInk) -> some View {
        self.font(Brand.font(size, .black))
            .monospacedDigit()
            .foregroundStyle(color)
            .shadow(color: VsLobbyKit.darkSeason ? .clear : .white.opacity(0.8), radius: 0, x: 0, y: 1)
            .shadow(color: Color(hex: 0x4C1D95).opacity(VsLobbyKit.darkSeason ? 0.5 : 0.18), radius: max(2, size * 0.12), x: 0, y: max(1, size * 0.08))
    }

    /// §A1 a small stat / icon tile on the VS pages: the 13% wash (22% `strong`),
    /// a 1.5-pt 34% border, the 4-pt inset accent top bar and a soft accent shadow.
    func vsTile(_ accent: Color, strong: Bool = false, radius: CGFloat = 14) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return self
            .padding(.top, 2)
            .background {
                ZStack(alignment: .top) {
                    shape.fill(accent.vsWash(strong ? 0.22 : 0.13))
                    accent.frame(height: 4)
                }
                .clipShape(shape)
            }
            .overlay(shape.stroke(accent.vsWash(strong ? 0.5 : 0.34), lineWidth: strong ? 2 : 1.5).allowsHitTesting(false))
            .shadow(color: accent.opacity(0.14), radius: 5, x: 0, y: 3)
    }

    /// The soft striped list row on a light VS card.
    func vsStripedRow(_ index: Int, accent: Color = VsLobbyKit.ink) -> some View {
        self
            .background(index % 2 == 0 ? accent.vsWash(0.10).opacity(0.75) : Color.clear)
            .overlay(alignment: .top) {
                if index > 0 { Rectangle().fill(accent.opacity(0.10)).frame(height: 1) }
            }
    }
}

private struct VSTintedCard: ViewModifier {
    let accent: Color
    var bar: [Color]?
    var radius: CGFloat
    var barHeight: CGFloat
    var tint: Double
    var line: Double

    @ViewBuilder
    func body(content: Content) -> some View {
        if VsLobbyKit.darkSeason, let look = SeasonKit.surfaces, look.cardFill != nil {
            // A dark season: the same night glass as every other page card (TintedCard).
            content.tintedCard(accent: accent, bar: bar, radius: radius, barHeight: barHeight, tint: tint, line: line)
        } else {
            lightCard(content: content)
        }
    }

    private func lightCard(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return VStack(spacing: 0) {
            if let bar {
                LinearGradient(colors: bar.count > 1 ? bar : [bar.first ?? accent, bar.first ?? accent],
                               startPoint: .leading, endPoint: .trailing)
                    .frame(height: barHeight)
            }
            content
        }
        .background(shape.fill(accent.vsWash(tint)))
        .clipShape(shape)
        .overlay(shape.stroke(accent.vsWash(line), lineWidth: 1.5).allowsHitTesting(false))
        .shadow(color: Color(hex: 0x3C1E6E).opacity(0.10), radius: 10, x: 0, y: 8)
    }
}

/// A candy button's LOOK as a non-interactive tag, for inside a tappable card or
/// row (the card / link keeps the tap): the §A8 candy pill, hit-testing off.
struct VSCandyTag: View {
    let title: String
    var symbol: String? = nil
    var variant: CandyButtonStyle.Variant = .teal
    var size: CandyButtonStyle.Size = .small
    var showLock = false

    var body: some View {
        Button(action: {}) {
            CandyLabel(title: title, symbol: symbol) {
                if showLock { Icon3D(.lock, size: 14) }
            }
        }
        .buttonStyle(CastButtonStyle(color: variant.cast(screen: .blue), size: size, fullWidth: false))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// Your Ghost (§D1): the player's best-run replay, drawn as a FADED copy of the
/// signed-in player's own letter tile — never a bot.
struct VSGhostTile: View {
    var size: CGFloat = 40
    @ObservedObject private var auth = AuthService.shared

    var body: some View {
        LetterTileAvatar(username: auth.profile?.username ?? "You", size: size)
            .opacity(0.45)
            .overlay(
                RoundedRectangle(cornerRadius: size * LetterTileAvatar.cornerFraction, style: .continuous)
                    .strokeBorder(VsLobbyKit.purple.opacity(0.35), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5]))
            )
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// A kind, in-character banter line in a soft speech bubble (CPU matches only —
/// never for people or the ghost). `accent` is the bot's own color.
struct VSBanterBubble: View {
    let line: String
    var accent: Color = VsLobbyKit.ink
    /// The bubble's tail: pointing up (under the speaker) or left (beside it).
    var tailUp = true

    var body: some View {
        Text("“\(line)”")
            .font(Brand.font(13, .heavy))
            .foregroundStyle(VsLobbyKit.titleInk)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(accent.vsWash(0.12))
            )
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(accent.vsWash(0.34), lineWidth: 1.5))
            .overlay(alignment: tailUp ? .top : .leading) {
                VSBubbleTail()
                    .fill(accent.vsWash(0.12))
                    .overlay(VSBubbleTail().stroke(accent.vsWash(0.34), lineWidth: 1.5))
                    .frame(width: 14, height: 8)
                    .rotationEffect(.degrees(tailUp ? 0 : -90))
                    .offset(x: tailUp ? 0 : -10, y: tailUp ? -7 : 0)
            }
            .shadow(color: accent.opacity(0.14), radius: 6, x: 0, y: 3)
            .accessibilityLabel(line)
    }
}

/// The speech bubble's little tail (an upward triangle, open at the base).
private struct VSBubbleTail: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        return p
    }
}

/// An art image guarded by `ArtAsset.exists` (decorative), else `fallback`.
struct VSArt<Fallback: View>: View {
    let name: String
    var height: CGFloat? = nil
    var maxWidth: CGFloat? = nil
    @ViewBuilder var fallback: () -> Fallback

    var body: some View {
        if ArtAsset.exists(name) {
            Image(name).resizable().interpolation(.high).scaledToFit()
                .frame(maxWidth: maxWidth, maxHeight: height)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        } else {
            fallback()
        }
    }
}

extension VSArt where Fallback == EmptyView {
    init(_ name: String, height: CGFloat? = nil, maxWidth: CGFloat? = nil) {
        self.init(name: name, height: height, maxWidth: maxWidth) { EmptyView() }
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
    /// §0 card → FINISH_SPEC §A1: a soft wash of the page's accent (VS teal) with a
    /// matching 1.5-pt border and the page-tinted lift; `bar` adds the game card's
    /// top bar in the accent.
    func vsCard(radius: CGFloat = 18, bar: Bool = false) -> some View {
        modifier(VSCardSurface(radius: radius, bar: bar))
    }
}

/// FINISH_SPEC §A1: the VS card is no longer plain white — a soft wash of the
/// page's accent (VS teal) with a matching 1.5-pt border and the page-tinted lift.
private struct VSCardSurface: ViewModifier {
    let radius: CGFloat
    var bar: Bool = false
    @Environment(\.pageTint) private var tint

    @ViewBuilder
    func body(content: Content) -> some View {
        if VsLobbyKit.darkSeason {
            // A dark season: the night glass every page card wears (TintedCard), no outline.
            content.tintedCard(accent: tint.accent, bar: bar ? [tint.accent.vsWash(0.75), tint.accent] : nil,
                               radius: radius, barHeight: 8)
        } else {
            lightCard(content: content)
        }
    }

    private func lightCard(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return VStack(spacing: 0) {
            if bar {
                LinearGradient(colors: [tint.accent.vsWash(0.75), tint.accent], startPoint: .leading, endPoint: .trailing)
                    .frame(height: 8)
            }
            content
        }
        .background(shape.fill(tint.accent.vsWash(0.08)))
        .clipShape(shape)
        .overlay(shape.stroke(tint.accent.vsWash(0.26), lineWidth: 1.5).allowsHitTesting(false))
        .pageCardShadow()
    }
}

/// Bot art in a circle — every place a bot appears (§9, never emoji). FINISH_SPEC
/// §D1: a cast bot is its own character on a soft wash of its color (pass a
/// `background` to override); Your Ghost is the player's faded letter tile.
struct BotArtCircle: View {
    let art: String
    var size: CGFloat = 36
    var background: Color? = nil
    var body: some View {
        if art == VsLobbyKit.ghostArt {
            VSGhostTile(size: size)
        } else {
            let m = VsLobbyKit.mascot(fromArt: art)
            ZStack {
                Circle().fill(background ?? m.map { VsLobbyKit.castColor($0).vsWash(0.18) } ?? VsLobbyKit.soft)
                Image(art).resizable().interpolation(.high).scaledToFit()
                    .padding(size * 0.06)
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder((m.map { VsLobbyKit.castColor($0) } ?? VsLobbyKit.ink).vsWash(0.4),
                                           lineWidth: background == Color.clear ? 0 : 1.5))
            .accessibilityHidden(true)
        }
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

/// Name-only avatar (incoming challenges, rivals — no photo in the payload):
/// the §20 letter tile.
struct VSInitialAvatar: View {
    let name: String
    var size: CGFloat = 36
    var body: some View {
        LetterTileAvatar(username: name.trimmingCharacters(in: CharacterSet(charactersIn: "@ ")), size: size)
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
/// color + glow + white icon; otherwise a §A1 mini game card (soft wash of the
/// mode color, border, 3-pt top bar) with the colored icon.
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
                ZStack(alignment: .top) {
                    shape.fill(accent.vsWash(0.13))
                    accent.frame(height: max(2, size * 0.09))
                }
                .clipShape(shape)
                .overlay(shape.stroke(accent.vsWash(0.34), lineWidth: 1.2))
                .shadow(color: accent.opacity(0.16), radius: 3, y: 2)
            }
            if let h = VsLobbyKit.home(mode) {
                BannerGlyph(icon: h.icon, ink: selected ? .white : accent, accent: accent, solid: selected, size: size * 0.5)
            }
        }
        .frame(width: size, height: size)
    }
}

/// The primary VS action — FINISH_SPEC §A8: a large glossy candy pill (purple
/// primary; pass `variant` for the others), with an optional small subtitle line.
struct VSPrimaryButton: View {
    let title: String
    var subtitle: String? = nil
    var variant: CandyButtonStyle.Variant = .purple
    var symbol: String? = nil
    var disabled = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            if let subtitle {
                VStack(spacing: 1) {
                    OutlinedText(text: title.uppercased(), size: 15, width: 1.5).minimumScaleFactor(0.7)
                    Text(subtitle).font(Brand.font(10.5, .heavy))
                        .foregroundStyle(variant == .peach ? VsLobbyKit.numberInk : .white.opacity(0.95))
                        .shadow(color: VsLobbyKit.numberInk.opacity(0.5), radius: 1, x: 0, y: 1)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .accessibilityElement(children: .combine)
            } else {
                CandyLabel(title: title, symbol: symbol)
            }
        }
        .buttonStyle(CastButtonStyle(color: variant.cast(screen: .blue), size: .large))
        .disabled(disabled)
    }
}

/// A small candy tag (JOIN, Challenge, Race it) — FINISH_SPEC §A8. Drawn as a
/// label inside a tappable row / link, so the row keeps the tap.
struct VSSoftPill: View {
    let title: String
    var variant: CandyButtonStyle.Variant = .teal
    var body: some View {
        VSCandyTag(title: title, variant: variant)
    }
}

/// Small lock badge for Pro-only rows.
struct VSLockBadge: View {
    var body: some View {
        Icon3D(.lock, size: 12) // ART_SPEC §5
    }
}

/// The VS page nav bar in the shared page-header style (HEADER_SPEC §4): the back
/// control as a soft white circle, the teal gradient caps title with the page's
/// host, a trailing slot.
struct VSNavBar<Trailing: View>: View {
    let title: String
    /// The page's host beside the title (MASCOT_SPEC §6): S on the VS pages; nil
    /// where the page's banner already has its host peeking over it (§5).
    var host: MascotID? = Mascots.vs
    /// ART_SPEC §2: the whole-cast title art in place of the text title + host.
    var art: ArtTitleName? = nil
    /// FINISH_SPEC BJ16: a heading lettering (art-titlecast-<slug>) in place of the text title.
    var heading: HeadingArt? = nil
    let onBack: () -> Void
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        if let heading {
            HStack(spacing: 8) {
                HeaderCircleButton(.symbol("chevron.left"), label: "Back", action: onBack)
                HeadingArtView(heading, height: 36, maxWidth: 240, label: title.capitalized)
                trailing()
            }
            .padding(.horizontal, 10).padding(.top, 4).frame(minHeight: 48)
        } else if let art {
            // The art takes the row's middle; the back circle and trailing slot sit beside it.
            HStack(spacing: 8) {
                HeaderCircleButton(.symbol("chevron.left"), label: "Back", action: onBack)
                ArtTitle(art, colors: VsLobbyKit.titleGradient)
                    .frame(maxWidth: .infinity)
                trailing()
            }
            .padding(.horizontal, 10).padding(.top, 4).frame(minHeight: 48)
        } else {
            ZStack {
                PageHostTitle(text: title, colors: VsLobbyKit.titleGradient, host: host)
                    .padding(.horizontal, 52)
                HStack {
                    HeaderCircleButton(.symbol("chevron.left"), label: "Back", action: onBack)
                    Spacer()
                    trailing()
                }
            }
            .padding(.horizontal, 10).padding(.top, 4).frame(height: 48)
        }
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
            Circle().fill(VsLobbyKit.ink.vsWash(0.10)).frame(width: 104, height: 104)
            Text("\(secs / 60):\(String(format: "%02d", secs % 60))")
                .vsNumber(30)
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

/// A quiet action — LEAVE / CANCEL on the VS screens: FINISH_SPEC §A8's soft
/// peach candy pill (small, hugging its label).
struct VSGreyPill: View {
    let title: String
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            CandyLabel(title: title, symbol: icon)
        }
        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
    }
}

/// The result screens' secondary actions (HOME, SHARE, DECLINE) — FINISH_SPEC
/// §A8 candy pills (pink secondary by default; peach for the quiet ones). Icons
/// from the 3D set (share, home) sit in the label.
struct VSSoftPurpleButton: View {
    let title: String
    var icon: String? = nil
    var variant: CandyButtonStyle.Variant = .pink
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            if let icon, let i3d = Icon3DName.forHeaderSymbol(icon) {
                CandyLabel(title: title) { Icon3D(i3d, size: 20) }
            } else {
                CandyLabel(title: title, symbol: icon)
            }
        }
        .buttonStyle(CastButtonStyle(color: variant.cast(screen: .blue), size: .large))
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
/// the cast loader and `LOADING <MODE>` on the VS page color — never bare text or
/// a blank screen. FINISH_SPEC §D3: a bot stands ready in character (its "ready"
/// pose) over a "Matching you with…" line.
struct VSLoadingView: View {
    let mode: GameMode?
    /// Replaces `LOADING <MODE>` (e.g. "LOADING CHALLENGE" before the mode is known).
    var title: String? = nil
    var botArt: String? = nil
    var line: String? = nil

    var body: some View {
        let m = VsLobbyKit.mascot(fromArt: botArt)
        VStack(spacing: 16) {
            if let m {
                PoseImage(m, "ready", height: 132)
            } else if let mode {
                VSModeGlyphTile(mode: mode, selected: false, size: 48)
            }
            // The cast's staggered wave replaces the spinner; LOADING <MODE> stays and
            // D voices a rotating tip (MASCOT_SPEC §3/§6).
            CastLoader(label: title ?? "LOADING \(mode.map { VsLobbyKit.modeName($0).uppercased() } ?? "")",
                       labelColor: VsLobbyKit.label, showTips: botArt == nil && line == nil, tipColor: VsLobbyKit.sub)
            if botArt != nil || line != nil {
                HStack(spacing: 8) {
                    if let botArt, m == nil { BotArtCircle(art: botArt, size: 30) }
                    if let line {
                        Text(line).font(Brand.font(13, .heavy)).foregroundStyle(VsLobbyKit.titleInk)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .vsTinted(m.map { VsLobbyKit.castColor($0) } ?? VsLobbyKit.ink, radius: 16, tint: 0.10)
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pageBackground(.vs, lightOnly: true)
    }
}

/// Soft VS confirm card over a dim backdrop (forfeit and friends): caps title,
/// a short message, a purple candy primary and a quiet peach candy secondary.
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
                Text(title).font(Brand.font(17, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.titleInk)
                    .multilineTextAlignment(.center)
                Text(message).font(Brand.font(13, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                VSPrimaryButton(title: primary, action: onPrimary).padding(.top, 4)
                Button(action: onSecondary) { CandyLabel(title: secondary) }
                    .buttonStyle(CastButtonStyle(color: .slate, size: .large))
            }
            .padding(18).frame(maxWidth: 340)
            .vsTinted(VsLobbyKit.purple, bar: VsLobbyKit.purpleBar)
            .padding(.horizontal, 24)
        }
        .transition(.opacity)
    }
}
