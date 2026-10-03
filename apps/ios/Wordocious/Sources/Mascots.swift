import SwiftUI
import WordociousCore

// The WORDOCIOUS cast in the app (founder-approved 2026-10-02; spec docs/MASCOT_SPEC.md).
// ONE shared table + component set for iOS (web lib/mascots.ts, Android ui/Mascots.kt):
// the ten characters, the page hosts (§1), the game hosts keyed by the mode db key (§5),
// the voice lines (§6), `MascotView` (none | bob | pop | wave), `CastRow` and the loader.
// Every mascot image is decorative (hidden from VoiceOver) and Reduce Motion (the OS
// setting or the in-app toggle) turns every motion off: static images only.

/// The ten cast members in WORDOCIOUS order. Art: image sets `mascot-<id>` (512 px, transparent).
enum MascotID: String, CaseIterable, Identifiable {
    case w, o1, r, d, o2, c, i, o3, u, s

    var id: String { rawValue }
    var assetName: String { "mascot-\(rawValue)" }
}

enum MascotMotion {
    /// Static.
    case none
    /// Idle: translateY 0 → −3 → 0 over 2.6 s, ease-in-out, forever.
    case bob
    /// Entrance: scale 0.6 → 1.08 → 1 over 420 ms with a 12° wiggle.
    case pop
    /// Hello: a small hop with a tilt, every 2.4 s.
    case wave
}

enum Mascots {
    /// The cast in order, spelling WORDOCIOUS.
    static let cast: [MascotID] = MascotID.allCases

    // MARK: §1 Page hosts (one host per page)

    static let home: MascotID = .w
    static let puzzles: MascotID = .c
    static let wordOfTheDay: MascotID = .i
    static let leaderboard: MascotID = .o2
    static let records: MascotID = .o2
    static let stats: MascotID = .d
    static let friends: MascotID = .o1
    static let vs: MascotID = .s
    /// "Nobody on, nothing yet."
    static let empty: MascotID = .r
    /// "All done for today / come back later."
    static let allDone: MascotID = .u
    /// Friends pocket game win.
    static let pocketWin: MascotID = .o3
    static let loss: MascotID = .r
    static let draw: MascotID = .u
    static let settings: MascotID = .r
    static let pro: MascotID = .w
    static let help: MascotID = .c
    static let offline: MascotID = .r
    /// Adding friends ("growing" the circle).
    static let addFriends: MascotID = .i
    /// The loading tips' voice.
    static let tips: MascotID = .d

    // MARK: §5 Game hosts, keyed by the mode db key (GameMode.rawValue)

    static let gameHosts: [String: MascotID] = [
        "DUEL": .w,            // Classic — the original, the leader
        "GAUNTLET": .s,        // endurance and speed
        "QUORDLE": .o1,        // four arms, four boards
        "OCTORDLE": .d,        // big brain for eight boards
        "SEQUENCE": .i,        // Succession — grows one step at a time
        "RESCUE": .c,          // Deliverance — the explorer on a rescue mission
        "DUEL_6": .o2,         // Classic Six — the star of the bigger stage
        "DUEL_7": .u,          // Classic Seven — calm under the longest words
        "SUDOKU": .u,          // Sudocious — zen logic
        "SCRAMBLE": .r,        // Muddle — groggy, everything's muddled
        "HUB": .o1,            // Hubbub — all the words at once
        "CROSSWORD": .d,       // Crosswordocious — glasses and a pencil
        "GROUPS": .o2,         // Kindred — heart sunglasses, connections
        "LADDER": .i,          // Letter Ladder — tall, climbing
        "CRYPTOGRAM": .c,      // Codebreaker — the detective
        "WORDSEARCH": .o3,     // Spyglass — one big eye
        "REGIONS": .s,         // Starsweep — the gold star
        "PROPERNOUNDLE": .w,   // ProperNoundle — proper names, the leader
    ]

    static func host(dbKey: String) -> MascotID? { gameHosts[dbKey] }
    static func host(_ mode: GameMode) -> MascotID? { gameHosts[mode.rawValue] }

    /// A cast member seeded by the local day + a salt (the mode), stable for the day.
    static func dailyPick(salt: String, day: String = LeaderboardService.todayLocal()) -> MascotID {
        // FNV-1a: deterministic across launches (Swift's Hasher is seeded per process).
        var h: UInt64 = 0xcbf29ce484222325
        for b in "\(day)|\(salt)".utf8 { h = (h ^ UInt64(b)) &* 0x100000001b3 }
        return cast[Int(h % UInt64(cast.count))]
    }

    // MARK: §6 Voice (one short line each; American spelling, warm, never mean)

    static let nobodyOnLine = "Nobody's on yet. Wake the crew with an invite."
    static let addFriendLine = "Add a friend and the race begins."
    static let statsEmptyLine = "Play a game and I'll crunch the numbers."
    static let offlineLine = "Lost the connection. Give it a sec."

    /// D's loading tips (rotate under the CastRow loader).
    static let loadingTips: [String] = [
        "Tip: start with a word that has three vowels.",
        "Tip: a letter in the wrong spot still belongs in the word.",
        "Tip: letters can repeat, so don't rule out doubles.",
        "Tip: hints cost points, so try a guess first.",
        "Tip: play a daily every day to keep your streak alive.",
    ]

    /// The headline's right padding where a banner host stands (§2).
    static let bannerClearance: CGFloat = 58

    /// Reduce Motion: the OS setting or the in-app toggle.
    static func reduceMotion(_ env: Bool) -> Bool { env || Theme.reduceMotion }
}

// MARK: - MascotView

/// One cast member at `size` pt (square), decorative. `motion` honors Reduce Motion.
struct MascotView: View {
    let id: MascotID
    var size: CGFloat
    var motion: MascotMotion

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var popScale: CGFloat
    @State private var popAngle: Double
    @State private var start = Date()
    @ObservedObject private var power = PowerMode.shared
    /// §AQ2: the idle bob / wave pauses while a page scrolls and when scrolled off screen.
    @ObservedObject private var scroll = ScrollMotion.shared
    @State private var onScreen = true

    init(_ id: MascotID, size: CGFloat, motion: MascotMotion = .none) {
        self.id = id
        self.size = size
        self.motion = motion
        let animatedPop = motion == .pop && !Theme.reduceMotion
        _popScale = State(initialValue: animatedPop ? 0.6 : 1)
        _popAngle = State(initialValue: animatedPop ? -12 : 0)
    }

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    private var image: some View {
        ArtThumbs.image(id.assetName, points: size)   // §AQ2: drawn at its display size
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
    }

    /// §AD: the endless idle loops (bob / wave) also stop in Low Power Mode; the
    /// one-shot pop stays.
    private var idleOff: Bool { (motion == .bob || motion == .wave) && Motion.calm(envReduceMotion) }

    var body: some View {
        Group {
            if still || motion == .none || idleOff {
                image
            } else {
                switch motion {
                case .none:
                    image
                case .pop:
                    image
                        .scaleEffect(popScale, anchor: .bottom)
                        .rotationEffect(.degrees(popAngle), anchor: .bottom)
                        .onAppear(perform: runPop)
                case .bob:
                    TimelineView(.animation(minimumInterval: 1 / 30, paused: idlePaused)) { ctx in
                        image.offset(y: Self.bobOffset(ctx.date.timeIntervalSince(start)))
                    }
                case .wave:
                    TimelineView(.animation(minimumInterval: 1 / 30, paused: idlePaused)) { ctx in
                        let w = Self.wave(ctx.date.timeIntervalSince(start))
                        image
                            .offset(y: w.y)
                            .rotationEffect(.degrees(w.angle), anchor: .bottom)
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .tracksScrollVisibility($onScreen)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var idlePaused: Bool { scroll.scrolling || !onScreen }

    private func runPop() {
        guard popScale != 1 || popAngle != 0 else { return }
        withAnimation(.easeOut(duration: 0.22)) { popScale = 1.08; popAngle = 12 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            withAnimation(.easeInOut(duration: 0.2)) { popScale = 1; popAngle = 0 }
        }
    }

    /// 0 → −3 → 0 over 2.6 s, ease-in-out (a cosine is exactly that curve).
    static func bobOffset(_ t: TimeInterval) -> CGFloat {
        let phase = t.truncatingRemainder(dividingBy: 2.6) / 2.6
        return CGFloat(-3 * (1 - cos(2 * .pi * phase)) / 2)
    }

    /// A 0.6 s hop (6 pt) with a ±10° tilt, then a rest, every 2.4 s.
    static func wave(_ t: TimeInterval) -> (y: CGFloat, angle: Double) {
        let p = t.truncatingRemainder(dividingBy: 2.4)
        guard p < 0.6 else { return (0, 0) }
        let k = p / 0.6
        return (CGFloat(-6 * sin(.pi * k)), 10 * sin(2 * .pi * k))
    }
}

// MARK: - CastRow

/// The ten in order, spelling WORDOCIOUS. `.wave` = a staggered left-to-right hop
/// (the loader: 8 pt, 70 ms stagger, 1.1 s loop, forever; the sweep celebration
/// passes 14 pt / 60 ms / twice). Flawless: W wears the gold crown icon.
struct CastRow: View {
    var size: CGFloat = 22
    var motion: MascotMotion = .none
    var hop: CGFloat = 8
    var stagger: Double = 0.07
    var period: Double = 1.1
    /// nil = loop forever; otherwise the number of waves before the row rests.
    var repeats: Int? = nil
    var crownOnW = false

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var start = Date()
    @State private var done = false
    /// §AQ2: the endless wave pauses while a page scrolls / off screen.
    @ObservedObject private var scroll = ScrollMotion.shared
    @State private var onScreen = true

    private static let hopDuration: Double = 0.4

    var body: some View {
        Group {
            if Mascots.reduceMotion(envReduceMotion) || motion == .none || done {
                row { _ in 0 }
            } else {
                TimelineView(.animation(minimumInterval: 1 / 30, paused: repeats == nil && (scroll.scrolling || !onScreen))) { ctx in
                    let t = ctx.date.timeIntervalSince(start)
                    row { i in offset(i, t) }
                }
                .task {
                    guard let repeats else { return }
                    let total = Double(repeats) * period + Double(Mascots.cast.count - 1) * stagger
                    try? await Task.sleep(nanoseconds: UInt64(total * 1_000_000_000))
                    done = true
                }
            }
        }
        .tracksScrollVisibility($onScreen)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func row(_ y: @escaping (Int) -> CGFloat) -> some View {
        HStack(spacing: max(1, size * 0.1)) {
            ForEach(Array(Mascots.cast.enumerated()), id: \.element) { i, m in
                ZStack(alignment: .top) {
                    // FINISH_SPEC §X: the season's skins (Halloween) in the cast loader.
                    ArtThumbs.image(CastSkin.assetName(for: m), points: size).resizable().interpolation(.high).scaledToFit()
                        .frame(width: size, height: size)
                    if crownOnW && m == .w {
                        // Flawless: W wears the gold crown from the icon set (HEADER_SPEC §2).
                        Icon3D(.crown, size: size * 0.56)
                            .offset(y: -size * 0.3)
                    }
                }
                .offset(y: y(i))
            }
        }
    }

    private func offset(_ i: Int, _ t: Double) -> CGFloat {
        let local = t - Double(i) * stagger
        guard local >= 0 else { return 0 }
        let cycle = Int(local / period)
        if let repeats, cycle >= repeats { return 0 }
        let phase = local - Double(cycle) * period
        guard phase < Self.hopDuration else { return 0 }
        return -hop * CGFloat(sin(.pi * phase / Self.hopDuration))
    }
}

// MARK: - Loader

/// The app's loading look (§3): the CastRow wave in place of a spinner, the
/// `LOADING <MODE>` label kept, and an optional rotating tip voiced by D.
struct CastLoader: View {
    var label: String? = nil
    var labelColor: Color = Theme.textMuted
    var showTips = true
    var tipColor: Color = Theme.textMuted

    @State private var tipStart = Int.random(in: 0..<Mascots.loadingTips.count)

    var body: some View {
        VStack(spacing: 14) {
            CastRow(size: 22, motion: .wave)
            if let label {
                Text(label).font(Brand.font(12, .black)).tracking(1).foregroundStyle(labelColor)
                    .multilineTextAlignment(.center)
            }
            if showTips {
                TimelineView(.periodic(from: .now, by: 4)) { ctx in
                    let n = Mascots.loadingTips.count
                    let i = (tipStart + Int(ctx.date.timeIntervalSinceReferenceDate / 4)) % n
                    HStack(spacing: 6) {
                        MascotView(Mascots.tips, size: 22)
                        Text(Mascots.loadingTips[i])
                            .font(Brand.font(12, .bold)).foregroundStyle(tipColor)
                            .lineLimit(2).multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 24)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label.map { $0.capitalized } ?? "Loading")
    }
}

/// The VS / pocket-game result host (MASCOT_SPEC §3): a win pops `winner` in,
/// a loss shows R and a draw U, both static.
struct ResultHost: View {
    enum Outcome { case win, loss, draw }
    let outcome: Outcome
    var winner: MascotID = Mascots.vs

    var body: some View {
        switch outcome {
        case .win: MascotView(winner, size: 88, motion: .pop)
        case .loss: MascotView(Mascots.loss, size: 80)
        case .draw: MascotView(Mascots.draw, size: 80)
        }
    }
}

// MARK: - Empty / error states

/// A host centered above one short line (empty and error states, §2 / §6).
/// With a `scene` (ART_SPEC §7) the scene art (~140 pt tall) stands in for the
/// plain host, the voice line kept under it; a missing image falls back to `host`.
struct MascotMessage: View {
    let host: MascotID
    let line: String
    var size: CGFloat = 96
    var motion: MascotMotion = .bob
    var font: Font = Brand.font(12, .bold)
    var color: Color = FinishInk.secondary
    var scene: ArtScene? = nil
    var sceneHeight: CGFloat = 140

    var body: some View {
        VStack(spacing: 8) {
            if let scene {
                SceneArt(scene, height: sceneHeight, fallbackSize: size, fallbackMotion: motion)
            } else {
                MascotView(host, size: size, motion: motion)
            }
            if !line.isEmpty {
                // FINISH_SPEC §G5: the voice line sits on a small tinted card (§A1 —
                // lilac wash, border, top bar) instead of bare text on white.
                Text(line).font(font).foregroundStyle(color)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 14).padding(.top, 11).padding(.bottom, 9)
                    .tintedPill(Color(hex: 0x8B5CF6), radius: 14)
            }
        }
    }
}

extension MascotMessage {
    /// ART_SPEC §7: a scene above the line (its character is the fallback host).
    init(scene: ArtScene, line: String, size: CGFloat = 96, motion: MascotMotion = .bob,
         font: Font = Brand.font(12, .bold), color: Color = FinishInk.secondary, sceneHeight: CGFloat = 140) {
        self.init(host: scene.host, line: line, size: size, motion: motion, font: font, color: color,
                  scene: scene, sceneHeight: sceneHeight)
    }
}

// MARK: - Placement helpers

extension View {
    /// §2 banners: the host stands at the right end of the frosted headline strip,
    /// 56 pt, peeking ~12 pt over the window's top edge with an idle bob. Reserves
    /// those 12 pt above the window so it never covers what sits above.
    /// `trailing` keeps it clear of the strip's right-hand controls.
    func bannerHost(_ id: MascotID, trailing: CGFloat = 10) -> some View {
        overlay(alignment: .topTrailing) {
            MascotView(id, size: 56, motion: .bob)
                .padding(.trailing, trailing)
                .offset(y: -12)
        }
        .padding(.top, 12)
    }

    /// §5 game screen titles: the game's host standing at the left of the title, static.
    func gameHost(_ mode: GameMode, size: CGFloat = 30) -> some View {
        HStack(spacing: 6) {
            if let id = Mascots.host(mode) { MascotView(id, size: size) }
            self
        }
    }

    /// ART_SPEC §10 / §14 game screen headers: the game's title art (lettering + host)
    /// in place of this title text + host, sized by the width between the corner
    /// controls — height from the aspect ratio, capped at 72 pt, at least a 44 pt slot.
    /// Without the art it stays the text with `.gameHost` beside it. `inset` keeps
    /// the art clear of the overlaid corner Home / Help circles in headers that don't
    /// pad the title themselves. `centerY` (the corner buttons' center from the
    /// header's top) drops a short art down so the buttons sit centered on it.
    @ViewBuilder
    func gameTitleArt(_ mode: GameMode, hostSize: CGFloat = 30, inset: CGFloat = 0, centerY: CGFloat? = nil) -> some View {
        if let art = GameTitleArt.forMode(mode) {
            GameTitleArtView(asset: art.asset, label: art.label, maxHeight: 72, minHeight: 44, centerY: centerY)
                .padding(.horizontal, inset)
        } else {
            gameHost(mode, size: hostSize)
        }
    }

    /// ART_SPEC §19.3 solo game screen headers: the corner buttons (Home left, ? /
    /// sound right) keep their own top row, and the game's title art sits BELOW it,
    /// spanning the content width minus 32 pt — height from the aspect ratio, capped
    /// at 120 pt (84 on screens under 700 pt). Without the art it stays this title text
    /// with `.gameHost` beside it, `fallbackInset` clear of the corner circles.
    /// (VS matches keep `.gameTitleArt`.)
    @ViewBuilder
    func soloGameTitle(_ mode: GameMode, hostSize: CGFloat = 30, fallbackInset: CGFloat = 0) -> some View {
        if let art = GameTitleArt.forMode(mode) {
            GameTitleArtView(asset: art.asset, label: art.label, maxHeight: GameTitleArtView.soloCap, minHeight: 44)
                .padding(.horizontal, 16)
                .padding(.top, GameCornerButton.rowHeight)
        } else {
            gameHost(mode, size: hostSize)
                .padding(.horizontal, fallbackInset)
        }
    }
}

// MARK: FINISH_SPEC BI23 — the signed-out page body

/// FINISH_SPEC BI23 (founder, 2026-10-03: "get rid of the sign in to track your stats
/// gray circle image and make that screen look nicer"): what a signed-out Stats /
/// Leaderboard / Friends tab shows UNDER its pinned AppHeaderView — the page host (or a
/// cast duo) popping in once, a gradient caps headline, one line, a dimmed decorative
/// preview (sample stat chips or a mini podium: soft glossy tiles, no border), the SIGN IN
/// candy button and a quiet "Play without an account" link (guests play every daily). It
/// fills the space below the header and centers in it, so the header never moves.
struct GuestPitch: View {
    struct Chip {
        let icon: Icon3DName
        let value: String
        let label: String
        let accent: Color
    }
    enum Preview { case chips([Chip]), podium, none }

    let hosts: [MascotID]
    let title: String
    let subtitle: String
    var colors: [Color] = PageHeaderStyle.purplePink
    let preview: Preview
    let onSignIn: () -> Void
    @ObservedObject private var chrome = ChromeVisibility.shared

    /// The Stats tab's sample chips (streak, wins, best time).
    static let statsChips: [Chip] = [
        Chip(icon: .flame, value: "12", label: "STREAK", accent: Color(hex: 0xF97316)),
        Chip(icon: .trophy, value: "48", label: "WINS", accent: Color(hex: 0xF59E0B)),
        Chip(icon: .crown, value: "1:42", label: "BEST TIME", accent: Color(hex: 0x7C3AED)),
    ]
    /// The Friends tab's sample chips.
    static let friendsChips: [Chip] = [
        Chip(icon: .tabFriends, value: "4", label: "FRIENDS", accent: Color(hex: 0xDB2777)),
        Chip(icon: .flame, value: "7", label: "FRIEND STREAK", accent: Color(hex: 0xF97316)),
        Chip(icon: .trophy, value: "3", label: "RACES WON", accent: Color(hex: 0xF59E0B)),
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: -18) {
                ForEach(hosts.indices, id: \.self) { i in
                    MascotView(hosts[i], size: hosts.count > 1 ? 104 : 120, motion: .pop)
                }
            }
            .padding(.bottom, 10)
            PageTitle(title, colors: colors, size: 28)
                .padding(.horizontal, 20)
            Text(subtitle)
                .font(Brand.body(15)).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32).padding(.top, 6)
            Group {
                switch preview {
                case .chips(let chips):
                    HStack(spacing: 10) {
                        ForEach(chips.indices, id: \.self) { i in chip(chips[i]) }
                    }
                case .podium:
                    podium
                case .none:
                    EmptyView()
                }
            }
            .opacity(0.72)
            .accessibilityHidden(true)   // decorative preview, not real numbers
            .padding(.top, isNone ? 0 : 20)
            Button(action: onSignIn) { CandyLabel(title: "Sign in") }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .large, fullWidth: false))
                .padding(.top, 24)
            Button { HomeNav.press {} } label: {
                Text("Play without an account")
                    .font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                    .underline()
                    .frame(minHeight: 44)
            }
            .buttonStyle(.squish)
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Centered in what is visible between the header and the bottom nav.
        .padding(.bottom, chrome.bottomInset)
    }

    private var isNone: Bool { if case .none = preview { return true } else { return false } }

    /// One soft glossy sample tile (game-kit look: a darker lip, a gradient face, a gloss
    /// over the top) — no outline, no box.
    private func chip(_ c: Chip) -> some View {
        VStack(spacing: 2) {
            Icon3D(c.icon, size: 24)
            Text(c.value).font(Brand.font(20, .black)).foregroundStyle(.white)
                .shadow(color: .black.opacity(0.18), radius: 0, x: 0, y: 1)
            Text(c.label).font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(.white.opacity(0.9))
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(width: 92, height: 88)
        .background { Self.gloss(c.accent, radius: 16) }
    }

    /// The Leaderboard's preview: a mini podium (2 · 1 · 3), the crown on first.
    private var podium: some View {
        let steps: [(rank: String, height: CGFloat, accent: Color)] = [
            ("2", 56, Color(hex: 0x94A3B8)), ("1", 78, Color(hex: 0xF59E0B)), ("3", 42, Color(hex: 0xEA580C)),
        ]
        return HStack(alignment: .bottom, spacing: 8) {
            ForEach(steps.indices, id: \.self) { i in
                let s = steps[i]
                VStack(spacing: 4) {
                    if s.rank == "1" { Icon3D(.crown, size: 28) }
                    Text(s.rank).font(Brand.font(24, .black)).foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.18), radius: 0, x: 0, y: 1)
                        .frame(width: 70, height: s.height)
                        .background { Self.gloss(s.accent, radius: 14) }
                }
            }
        }
    }

    /// The soft glossy face behind a preview tile.
    private static func gloss(_ accent: Color, radius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return ZStack(alignment: .top) {
            shape.fill(accent.opacity(0.95)).offset(y: 3)
            shape.fill(LinearGradient(colors: [accent.opacity(0.62), accent.opacity(0.88)],
                                      startPoint: .top, endPoint: .bottom))
            RoundedRectangle(cornerRadius: radius * 0.75, style: .continuous)
                .fill(LinearGradient(colors: [.white.opacity(0.38), .white.opacity(0)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(height: 28).padding(.horizontal, 7).padding(.top, 4)
        }
        .shadow(color: accent.opacity(0.22), radius: 8, x: 0, y: 5)
    }
}
