import SwiftUI
import WordociousCore

// FRIDAY-QUEUE items 16 + 17 + 20 (2.8 wave 4): the shared pieces of the redesigned Stats page, player profile and
// Go Pro screens — the four hero stats with soft 3D icons, the win-rate ring and two-color record bar (drawn in code
// from the sections/stats specs), the 5-over-4 VS game picker, HEAD TO HEAD + POCKET GAMES from
// GET /api/friends/pocket-records, the trophy shelf, and the Go Pro scene (the free player's mascot on the pedestal
// beside the benefit's scene). Ports apps/web/components/stats/{stat-hero,pocket-records}.tsx,
// profile/trophy-shelf.tsx and pro/pro-scene.tsx. All words and decisions come from core StatsProfile.

// MARK: - Icons, ring, bar

/// A shipped stat icon (`art-stat-<name>`: crown, donut, bolt, stopwatch, star, target), decorative.
struct StatIconView: View {
    let name: String
    var size: CGFloat = 30

    var body: some View {
        Image("art-stat-\(name)").resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The win-rate ring (sections/stats spec): a rounded track, a fill arc from 12 o'clock and a pale gloss arc.
struct WinRateRing: View {
    let pct: Double
    var size: CGFloat = 44
    var accent: Color = Color(hex: 0x7C3AED)

    var body: some View {
        let stroke = max(6, (size * 0.17).rounded())
        let frac = max(0, min(1, pct / 100))
        ZStack {
            Circle().stroke(accent.opacity(0.16), lineWidth: stroke)
            if frac > 0 {
                Circle().trim(from: 0, to: frac)
                    .stroke(LinearGradient(colors: [accent.opacity(0.85), accent], startPoint: .topLeading, endPoint: .bottomTrailing),
                            style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Circle().trim(from: 0.04, to: 0.20)
                .stroke(Color.white.opacity(0.38), style: StrokeStyle(lineWidth: max(1.5, stroke * 0.16), lineCap: .round))
                .rotationEffect(.degrees(-90))
                .padding(stroke * 0.18)
        }
        .padding(stroke / 2)
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Win rate \(Int(pct.rounded())) percent")
    }
}

/// The two-color record bar (sections/stats spec): wins in the first color, losses in the second, glossy.
struct RecordBarView: View {
    let wins: Int
    let losses: Int
    var height: CGFloat = 10
    var from: Color = Color(hex: 0x7C3AED)
    var to: Color = Color(hex: 0xEC4899)

    var body: some View {
        let bar = StatsProfile.recordBar(wins: wins, losses: losses)
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(from.opacity(0.14))
                if !bar.empty {
                    HStack(spacing: 0) {
                        Capsule().fill(from).frame(width: g.size.width * bar.winFrac)
                        Capsule().fill(to).frame(width: g.size.width * bar.lossFrac)
                            .offset(x: wins > 0 && losses > 0 ? -height / 2 : 0)
                    }
                    .clipShape(Capsule())
                }
                Capsule().fill(Color.white.opacity(0.4))
                    .frame(height: max(1.5, height * 0.2)).padding(.horizontal, 6).padding(.bottom, height * 0.45)
            }
        }
        .frame(height: height)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(wins) wins, \(losses) losses")
    }
}

/// The four hero stats on one row: icon (the ring for the win rate) over a soft number over a small label.
struct HeroStatsRow: View {
    let wins: Int
    let losses: Int
    let streak: Int
    let bestStreak: Int
    let fastestSeconds: Double
    let accent: Color

    var body: some View {
        let stats = StatsProfile.heroStats(wins: wins, losses: losses, streak: streak, bestStreak: bestStreak, fastestSeconds: fastestSeconds)
        HStack(alignment: .top, spacing: 8) {
            ForEach(stats, id: \.key) { s in
                VStack(spacing: 2) {
                    if s.key == .winRate {
                        WinRateRing(pct: wins + losses > 0 ? Double(wins) / Double(wins + losses) * 100 : 0, size: 44, accent: accent)
                    } else {
                        StatIconView(name: s.icon, size: 44)
                    }
                    Text(s.value).softNumber(20).lineLimit(1).minimumScaleFactor(0.55).padding(.top, 2)
                    Text(s.label.uppercased()).font(Brand.font(9, .heavy)).tracking(0.5).foregroundStyle(FinishInk.secondary)
                    Text(s.sub ?? " ").font(Brand.font(9, .heavy)).foregroundStyle(accent).lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel([s.label, s.value, s.sub].compactMap { $0 }.joined(separator: ", "))
            }
        }
    }
}

extension Color {
    /// A core "#rrggbb" color string (StatsProfile section colors) -> Color; the W purple when malformed.
    static func cast(_ hex: String) -> Color { Color(hexString: hex) ?? Color(hex: 0x7C3AED) }
}

// MARK: - Pocket records (GET /api/friends/pocket-records)

enum PocketRecordsService {
    /// The last good answer (a returning screen paints it at once, then refreshes).
    private(set) static var cached: StatsProfile.PocketRecords?

    /// nil on any failure. The server counts finished friendly_games rows with core pocketRecords.
    @discardableResult
    static func fetch() async -> StatsProfile.PocketRecords? {
        guard let url = URL(string: "https://wordocious.com/api/friends/pocket-records") else { return nil }
        let req = await PublicProfileService.authedRequest(url)
        guard let (data, resp) = try? await Net.api.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let r = try? JSONDecoder().decode(StatsProfile.PocketRecords.self, from: data)
        else { return cached }
        cached = r
        return r
    }
}

/// POCKET GAMES: one tile per game with the player's record (Word Chain adds its best run). Fresh players see the
/// tiles with a dash, never an empty block.
struct PocketGamesSection: View {
    let records: StatsProfile.PocketRecords?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Pocket Games", accent: .cast(StatsProfile.castS))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(StatsProfile.pocketOrder, id: \.self) { kind in
                    let k = records?.byKind.first { $0.kind == kind }
                    VStack(spacing: 2) {
                        FriendlyGameIcon(kind: kind, size: 40, glow: false, tinted: true)
                        Text(kind.title).font(Brand.font(10, .black)).foregroundStyle(FinishInk.heading)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        Text(k.map { $0.record.played ? "\($0.wins)–\($0.losses)" : "—" } ?? "…").softNumber(14)
                        Text(Self.second(k)).font(Brand.font(9, .heavy)).foregroundStyle(FinishInk.secondary).lineLimit(1)
                    }
                    .padding(.vertical, 10).padding(.horizontal, 4)
                    .frame(maxWidth: .infinity)
                    .statsCard(accent: .cast(StatsProfile.castS), radius: 16)
                }
            }
        }
    }

    private static func second(_ k: StatsProfile.PocketKindRecord?) -> String {
        guard let k, k.record.played else { return " " }
        if k.kind == .chain && k.bestChain > 0 { return "best \(k.bestChain)" }
        return k.draws > 0 ? "\(k.draws) \(k.draws == 1 ? "draw" : "draws")" : " "
    }
}

/// HEAD TO HEAD: every friend you have played (VS or a pocket game) — their mascot, "VS 1–0 · Pocket 2–1" and a
/// two-color record bar.
struct HeadToHeadSection: View {
    let records: StatsProfile.PocketRecords?
    @State private var version = FriendsService.version

    private struct Row: Identifiable {
        let friend: FriendsService.FriendProfile
        let vs: StatsProfile.PocketRecord
        let pocket: StatsProfile.PocketRecord
        var wins: Int { vs.wins + pocket.wins }
        var losses: Int { vs.losses + pocket.losses }
        var id: String { friend.id }
    }

    private var rows: [Row] {
        let all: [Row] = FriendsService.friends.map { (f: FriendsService.FriendProfile) -> Row in
            let vs = StatsProfile.PocketRecord(wins: f.h2hW ?? 0, losses: f.h2hL ?? 0)
            let pocket: StatsProfile.PocketRecord = records?.byFriend[f.id]?.total ?? StatsProfile.PocketRecord()
            return Row(friend: f, vs: vs, pocket: pocket)
        }
        let played: [Row] = all.filter { (r: Row) -> Bool in r.vs.played || r.pocket.played }
        let games = { (r: Row) -> Int in r.wins + r.losses + r.pocket.draws }
        return Array(played.sorted { games($0) > games($1) }.prefix(8))
    }

    var body: some View {
        let list = rows
        Group { if !list.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader("Head to Head", accent: .cast(StatsProfile.castD))
                VStack(spacing: 8) {
                    ForEach(list) { r in
                        HStack(spacing: 12) {
                            AvatarView(url: r.friend.avatar_url, username: r.friend.username, size: 40, castId: r.friend.avatar_cast_id,
                                       frame: r.friend.avatar_frame, userId: r.friend.id)
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(alignment: .firstTextBaseline) {
                                    BubbleOneLine(text: r.friend.username.uppercased(),
                                                  palette: .accent(PlayerTint.nameColor(userId: r.friend.id, username: r.friend.username)),
                                                  size: 16, alignment: .leading)
                                    Spacer(minLength: 4)
                                    Text("\(r.wins)–\(r.losses)").softNumber(16)
                                }
                                Text(StatsProfile.headToHeadLine(vs: r.vs, pocket: r.pocket))
                                    .font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.secondary).lineLimit(1)
                                RecordBarView(wins: r.wins, losses: r.losses, height: 8)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .statsCard(accent: .cast(StatsProfile.castD), radius: 16)
                    }
                }
            }
            .id(version)
        } }
        .task { await FriendsService.load() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in version = FriendsService.version }
    }
}

// MARK: - The VS picker: 5 over 4, no swipe

struct VsGamePicker: View {
    let modes: [HomeMode]
    let selected: GameMode
    let onPick: (GameMode) -> Void

    var body: some View {
        let split = StatsProfile.pickerSplit(modes)
        VStack(spacing: 6) {
            row(split.top)
            if !split.bottom.isEmpty { row(split.bottom) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("VS game")
    }

    private func row(_ items: [HomeMode]) -> some View {
        // Equal tiles: the width of a 5-up row; a shorter row centers under it.
        GeometryReader { g in
            let side = min(64, (g.size.width - 6 * 4) / 5)
            HStack(spacing: 6) {
                ForEach(items) { m in
                    let active = m.mode == selected
                    GameTileSquare(accent: m.accent, label: ModeGen.byId(m.id)?.shortTitle ?? m.title, selected: active, side: side) { chip in
                        ModeIconView(icon: m.icon, accent: m.accent, box: chip)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { if let gm = m.mode { Haptics.tap(); onPick(gm) } }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(m.title)
                    .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: 70)
    }
}

// MARK: - Trophy shelf (item 17)

/// The ChatGPT trophy shelf with 3D gold / silver / bronze medals standing in its holders and the counts under each.
/// Holder fractions measured off the art's contact sheet (art-pf-trophy-shelf); VISUAL CHECK on a real build.
struct TrophyShelfView: View {
    let gold: Int
    let silver: Int
    let bronze: Int
    var width: CGFloat = 260

    private struct Holder { let x: CGFloat; let y: CGFloat; let disc: CGFloat }
    private let silverH = Holder(x: 0.19, y: 0.33, disc: 0.26)
    private let goldH = Holder(x: 0.51, y: 0.24, disc: 0.29)
    private let bronzeH = Holder(x: 0.81, y: 0.33, disc: 0.26)
    private let discOfWidth: CGFloat = 0.74
    private let discCenterY: CGFloat = 0.64

    var body: some View {
        let h = width * 247 / 343
        VStack(spacing: 2) {
            ZStack(alignment: .topLeading) {
                Image("art-pf-trophy-shelf").resizable().interpolation(.high).frame(width: width, height: h)
                medal("silver", silverH, silver, h)
                medal("gold", goldH, gold, h)
                medal("bronze", bronzeH, bronze, h)
            }
            .frame(width: width, height: h)
            ZStack(alignment: .topLeading) {
                count(silver, silverH, 17)
                count(gold, goldH, 20)
                count(bronze, bronzeH, 17)
            }
            .frame(width: width, height: 28)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(gold) gold, \(silver) silver, \(bronze) bronze medals")
    }

    private func medal(_ name: String, _ spot: Holder, _ n: Int, _ h: CGFloat) -> some View {
        let mw = spot.disc * width / discOfWidth
        let mh = mw * 351 / 256
        return Image("art-pf-medal-\(name)").resizable().interpolation(.high)
            .frame(width: mw, height: mh)
            .opacity(n == 0 ? 0.35 : 1)
            .saturation(n == 0 ? 0.4 : 1)
            .shadow(color: Color(hex: 0x3C146E).opacity(0.28), radius: 3, y: 3)
            .offset(x: spot.x * width - mw / 2, y: spot.y * h - discCenterY * mh)
    }

    private func count(_ n: Int, _ spot: Holder, _ size: CGFloat) -> some View {
        Text("\(n)").softNumber(size).frame(width: 56).offset(x: spot.x * width - 28)
    }
}

// MARK: - Go Pro scenes (item 20)

/// The free player's own mascot on the spotlight pedestal with the benefit's scene beside it. The mascot is the real
/// resolver render (alive while the living mascot is on), never an illustration. A guest sees the default mascot.
struct ProScene: View {
    let benefit: StatsProfile.ProBenefit
    var height: CGFloat = 170
    var caption = true

    @ObservedObject private var directory = AvatarDirectory.shared

    var body: some View {
        let pedW = height * 0.92
        let pedH = pedW * 306 / 412
        let scene = StatsProfile.proScenes[benefit] ?? "art-pro-unlimited"
        let sceneH = height * 0.78
        let sceneW = sceneH * (benefit == .vsBots ? 416.0 / 257.0 : (benefit == .noLimits ? 333.0 / 317.0 : (benefit == .stats ? 1 : (benefit == .items ? 402.0 / 424.0 : 392.0 / 307.0))))
        let mascot = height * 0.82
        VStack(spacing: 2) {
            ZStack(alignment: .bottomLeading) {
                Image(StatsProfile.proPedestal).resizable().interpolation(.high).frame(width: pedW, height: pedH)
                ownMascot(size: mascot)
                    .frame(width: mascot, height: mascot)
                    .offset(x: (pedW - mascot) / 2, y: -pedH * 0.34)
                Image(scene).resizable().interpolation(.high).scaledToFit()
                    .frame(width: sceneW, height: sceneH)
                    .shadow(color: Color(hex: 0x50288C).opacity(0.25), radius: 6, y: 5)
                    .offset(x: pedW * 0.95, y: -4)
                    .id(benefit)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
            .frame(width: pedW + sceneW * 0.7, height: height, alignment: .bottomLeading)
            if caption {
                Text(StatsProfile.proBenefitCaption[benefit] ?? "").font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0xB45309))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(StatsProfile.proBenefitCaption[benefit] ?? "Go Pro")
    }

    @ViewBuilder private func ownMascot(size: CGFloat) -> some View {
        let p = AuthService.shared.profile
        let r = directory.look(username: p?.username ?? "", userId: p?.id, url: nil, castId: nil, frame: nil, mascot: nil,
                               accentHex: LetterTileAvatar.defaultAccentHex(username: p?.username ?? "", accentHex: nil), lookup: true).resolved
        let initial = AvatarCatalog.initial(p?.username)
        if LivingMascotView.canAnimate(r.config) {
            LivingMascotView(config: r.config, initial: initial, size: size, cutout: true, interactive: true, own: true)
        } else {
            MascotCutout(config: r.config, initial: initial, size: size)
        }
    }
}

/// The Go Pro page's hero: the five scenes take turns every 3.4 s (the picker pills choose one; Reduce Motion stays on
/// the first until a pill is tapped).
struct ProSceneCarousel: View {
    var height: CGFloat = 190
    @State private var index = 0
    @State private var held = false
    @Environment(\.accessibilityReduceMotion) private var envReduce
    private let timer = Timer.publish(every: 3.4, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 6) {
            ProScene(benefit: StatsProfile.proBenefitOrder[index], height: height)
            HStack(spacing: 8) {
                ForEach(Array(StatsProfile.proBenefitOrder.enumerated()), id: \.offset) { i, b in
                    Button { held = true; withAnimation(.easeOut(duration: 0.2)) { index = i } } label: {
                        Image(StatsProfile.proScenes[b] ?? "art-pro-unlimited").resizable().scaledToFit().frame(width: 20, height: 20)
                    }
                    .buttonStyle(HelperButtonStyle(tint: Color(hex: 0xF5A524), circle: true, selected: i == index))
                    .accessibilityLabel(StatsProfile.proBenefitCaption[b] ?? "")
                }
            }
        }
        .onReceive(timer) { _ in
            guard !held, !Motion.calm(envReduce) else { return }
            withAnimation(.easeOut(duration: 0.25)) { index = (index + 1) % StatsProfile.proBenefitOrder.count }
        }
    }
}
