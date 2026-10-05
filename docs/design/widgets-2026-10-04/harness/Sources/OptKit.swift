import SwiftUI
import UIKit

// Widget OPTIONS kit (design night 10-04). Built on the shipping widget's own pieces
// (GlossyTile, TileMark, DailyChip, FlameStreak, Caps, WType, shade, WSnapshot) — the
// harness compiles WordociousWidget.swift in unchanged except for access control — so
// every option here can move into the widget target as is. Art comes from the widget
// catalog plus the shipped app lettering / poses and the seasonal library (extras.py).

// MARK: - Themes

struct WTheme {
    let id: String
    let name: String
    let dark: Bool
    let bg: [Color]
    let number: Color
    let label: Color
    let accent: Color
    let gold: Color
    /// "hw" (Halloween) / "tg" (Thanksgiving): costumes, lettering and two faint corner props.
    var season: String? = nil
    /// Corner props (asset, top-left?) for the seasonal backdrops — small, faint, in the margin.
    var props: [String] = []

    var muted: Color { label.opacity(0.78) }

    /// The page lettering for `key` (dailies / puzzles / wotd / leaderboard / friends).
    func title(_ key: String) -> String {
        if let season { return "art-\(season)-title-\(key)" }
        return "art-titlecast-\(key)"
    }

    /// A cast member's art: the seasonal costume in season, else the pose (or the hero).
    func cast(_ id: String, _ pose: String? = nil) -> String {
        if let season { return "art-\(season)-\(id)" }
        if let pose, UIImage(named: "art-pose-\(id)-\(pose)") != nil { return "art-pose-\(id)-\(pose)" }
        return "mascot-\(id)"
    }

    static let light = WTheme(id: "light", name: "Default", dark: false,
                              bg: [Color(widgetHex: "#e6dcff"), Color(widgetHex: "#f5f3ff"), .white],
                              number: Color(widgetHex: "#3b1a78"), label: Color(widgetHex: "#5b3c96"),
                              accent: Color(widgetHex: "#7c3aed"), gold: Color(widgetHex: "#d97706"))
    static let darkT = WTheme(id: "dark", name: "Dark", dark: true,
                              bg: [Color(widgetHex: "#2a1650"), Color(widgetHex: "#1c1231")],
                              number: Color(widgetHex: "#e9ddff"), label: Color(widgetHex: "#cdb8ff"),
                              accent: Color(widgetHex: "#a78bfa"), gold: Color(widgetHex: "#fcd34d"))
    static let ocean = WTheme(id: "ocean", name: "Ocean", dark: false,
                              bg: [Color(widgetHex: "#d6ecf7"), Color(widgetHex: "#eef7fc"), .white],
                              number: Color(widgetHex: "#0f2e3d"), label: Color(widgetHex: "#365f73"),
                              accent: Color(widgetHex: "#0284c7"), gold: Color(widgetHex: "#d97706"))
    static let forest = WTheme(id: "forest", name: "Forest", dark: false,
                               bg: [Color(widgetHex: "#dcefd3"), Color(widgetHex: "#f1f8ee"), .white],
                               number: Color(widgetHex: "#1f3320"), label: Color(widgetHex: "#46603f"),
                               accent: Color(widgetHex: "#15803d"), gold: Color(widgetHex: "#b45309"))
    static let halloween = WTheme(id: "halloween", name: "Halloween", dark: true,
                                  bg: [Color(widgetHex: "#2b1645"), Color(widgetHex: "#1a0f2c"), Color(widgetHex: "#2a1526")],
                                  number: Color(widgetHex: "#f6ecff"), label: Color(widgetHex: "#d7c2ff"),
                                  accent: Color(widgetHex: "#fb923c"), gold: Color(widgetHex: "#fcd34d"),
                                  season: "hw", props: ["art-hw-prop-moon-crescent", "art-hw-prop-bat-flying"])
    static let thanksgiving = WTheme(id: "thanksgiving", name: "Thanksgiving", dark: false,
                                     bg: [Color(widgetHex: "#fde6c8"), Color(widgetHex: "#fff4e4"), Color(widgetHex: "#fffaf3")],
                                     number: Color(widgetHex: "#4a2511"), label: Color(widgetHex: "#83502c"),
                                     accent: Color(widgetHex: "#c2410c"), gold: Color(widgetHex: "#b45309"),
                                     season: "tg", props: ["art-tg-prop-leaf-maple", "art-tg-prop-acorn"])
    static let all: [WTheme] = [.light, .darkT, .ocean, .forest, .halloween, .thanksgiving]
}

/// The calm backdrop: the theme's soft vertical wash; in season, two small faint props tucked
/// into the top-left and bottom-right margins (never behind numbers or tiles).
struct ThemeBackdrop: View {
    let t: WTheme
    var body: some View {
        ZStack {
            LinearGradient(colors: t.bg, startPoint: .top, endPoint: .bottom)
            if t.props.count >= 2 {
                GeometryReader { g in
                    Image(t.props[0]).resizable().scaledToFit().frame(width: 15, height: 15)
                        .opacity(t.dark ? 0.55 : 0.5).position(x: 9, y: 9)
                    Image(t.props[1]).resizable().scaledToFit().frame(width: 15, height: 15)
                        .opacity(t.dark ? 0.5 : 0.45).rotationEffect(.degrees(-14))
                        .position(x: g.size.width - 9, y: g.size.height - 9)
                }
            }
        }
    }
}

// MARK: - Families

enum Fam: String {
    case small, medium, large, circular, rectangular, inline
    var size: CGSize {
        switch self {
        case .small: return CGSize(width: 170, height: 170)
        case .medium: return CGSize(width: 364, height: 170)
        case .large: return CGSize(width: 364, height: 382)
        case .circular: return CGSize(width: 76, height: 76)
        case .rectangular: return CGSize(width: 172, height: 76)
        case .inline: return CGSize(width: 257, height: 26)
        }
    }
}

/// A home-screen widget as the system draws it: the backdrop, 16 pt content margins, the corner radius.
struct WidgetFrame<C: View>: View {
    let fam: Fam
    let t: WTheme
    @ViewBuilder let content: () -> C
    var body: some View {
        ZStack {
            ThemeBackdrop(t: t)
            content().padding(16)
        }
        .frame(width: fam.size.width, height: fam.size.height)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .environment(\.colorScheme, t.dark ? .dark : .light)
    }
}

// MARK: - Data (one sample day per state)

enum DayState: String, CaseIterable {
    case fresh, mid, swept, milestone, guest
    var label: String {
        switch self {
        case .fresh: return "Fresh day 0/8"
        case .mid: return "Mid-day 5/8"
        case .swept: return "Swept 8/8"
        case .milestone: return "Streak milestone"
        case .guest: return "Guest"
        }
    }
}

struct Friend {
    let name: String
    let initial: String
    let hex: String
    let played: Int
    var you = false
}

struct WD {
    let state: DayState
    let snap: WSnapshot
    let date: Date
    let guest: Bool
    let rank: Int?
    let rankOf: Int
    let rankDelta: Int
    let friends: [Friend]
    let week: [Bool]          // Mon..Sun, played that day (today = index 6)
    let best: Int

    var played: Int { snap.word.played }
    var total: Int { snap.modes.count }
    var swept: Bool { total > 0 && played >= total }
    var milestone: Bool { state == .milestone }
    var pPlayed: Int { snap.puzzleProgress.played }
    var pTotal: Int { snap.puzzleModes.count }
    var pSwept: Bool { pTotal > 0 && pPlayed >= pTotal }
    var points: Int { snap.points ?? 0 }
    var left: String { resetLabel(date) }
    var nextName: String? { snap.modes.first(where: { !$0.played }).map { WidgetStats.nextName(key: $0.key, title: $0.title) } }
    var nextMode: WSnapshot.Mode? { snap.modes.first(where: { !$0.played }) }
    var nextPuzzle: WSnapshot.Mode? { snap.puzzleModes.first(where: { !$0.played }) }

    static func make(_ s: DayState) -> WD {
        var c = DateComponents()
        c.year = 2026; c.month = 10; c.day = 5
        c.hour = [DayState.fresh: 8, .mid: 16, .swept: 20, .milestone: 13, .guest: 10][s]!
        let date = Calendar.current.date(from: c)!
        let playedIdx: [DayState: Set<Int>] = [.fresh: [], .mid: [0, 1, 2, 3, 5], .swept: Set(0..<8),
                                                .milestone: [0, 1, 3], .guest: []]
        let lostIdx: Set<Int> = s == .mid ? [3] : []
        let puzzIdx: [DayState: Set<Int>] = [.fresh: [], .mid: [0, 1, 2, 4], .swept: Set(0..<10),
                                              .milestone: [0, 3], .guest: []]
        let modes = placeholderModes.enumerated().map { i, m in
            WSnapshot.Mode(key: m.key, title: m.title, glyph: m.glyph, colorHex: m.hex,
                           played: playedIdx[s]!.contains(i), won: playedIdx[s]!.contains(i) && !lostIdx.contains(i),
                           iconKind: m.kind, iconAsset: m.asset, iconText: m.text)
        }
        let puzzles = placeholderPuzzles.enumerated().map { i, m in
            WSnapshot.Mode(key: m.key, title: m.title, glyph: m.glyph, colorHex: m.hex,
                           played: puzzIdx[s]!.contains(i), won: puzzIdx[s]!.contains(i),
                           iconKind: m.kind, iconAsset: m.asset, iconText: nil)
        }
        let streak = [DayState.fresh: 12, .mid: 12, .swept: 13, .milestone: 14, .guest: 0][s]!
        let points = [DayState.fresh: 0, .mid: 1240, .swept: 2870, .milestone: 610, .guest: 0][s]!
        let snap = WSnapshot(day: "2026-10-05", streak: streak, modes: modes, points: points, seconds: 0,
                             shields: 2, puzzles: puzzles, username: s == .guest ? nil : "brian")
        let mine = playedIdx[s]!.count
        let friends: [Friend] = s == .guest
            ? [Friend(name: "You", initial: "W", hex: "#7c3aed", played: 0, you: true)]
            : [Friend(name: "Maya", initial: "M", hex: "#ec4899", played: [DayState.fresh: 2, .mid: 7, .swept: 6, .milestone: 4][s]!),
               Friend(name: "You", initial: "B", hex: "#0d9488", played: mine, you: true),
               Friend(name: "Leo", initial: "L", hex: "#2563eb", played: [DayState.fresh: 1, .mid: 4, .swept: 8, .milestone: 2][s]!),
               Friend(name: "Priya", initial: "P", hex: "#f59e0b", played: [DayState.fresh: 0, .mid: 3, .swept: 5, .milestone: 3][s]!),
               Friend(name: "Sam", initial: "S", hex: "#059669", played: [DayState.fresh: 0, .mid: 2, .swept: 3, .milestone: 1][s]!),
               Friend(name: "Jo", initial: "J", hex: "#f97316", played: [DayState.fresh: 0, .mid: 1, .swept: 2, .milestone: 0][s]!)]
                .sorted { $0.played > $1.played || ($0.played == $1.played && $0.you) }
        let week: [Bool] = s == .guest ? [false, false, false, false, false, false, false]
            : [true, true, true, true, true, true, mine > 0]
        return WD(state: s, snap: snap, date: date, guest: s == .guest,
                  rank: [DayState.mid: 12, .swept: 4, .milestone: 31][s], rankOf: 1284,
                  rankDelta: [DayState.mid: 3, .swept: 8, .milestone: -2][s] ?? 0,
                  friends: friends, week: week, best: 31)
    }
}

// MARK: - Personality: who shows up, and how

/// The day host rotation (Mon D, Tue I, Wed U, Thu S, Fri O2, Sat O1, Sun O3).
let dayHosts = ["d", "i", "u", "s", "o2", "o1", "o3"]

/// The mood rule (BI13b, extended): sleepy before the first daily, the concept's own cast member
/// while playing, a cheer on a sweep, and on big days (swept / milestone) the player's OWN mascot.
func moodArt(_ d: WD, _ t: WTheme, host: String, playing: String, sit: Bool = false) -> String {
    if d.guest { return t.cast("w", sit ? "sit" : "wave") }
    if !d.guest && (d.swept || d.milestone) { return "art-player-mascot" }
    if d.played == 0 { return t.season == nil ? (sit ? "art-pose-r-sit" : "art-pose-r-cocoa") : t.cast("r") }
    return t.cast(host, sit ? "sit" : playing)
}

struct Art: View {
    let name: String
    var flip = false
    var body: some View {
        Image(UIImage(named: name) != nil ? name : "mascot-w").resizable().interpolation(.high).scaledToFit()
            .scaleEffect(x: flip ? -1 : 1, y: 1)
            .accessibilityHidden(true)
    }
}

/// Page lettering at a fixed height (or fit to a width), never stretched.
struct Lettering: View {
    let t: WTheme
    let key: String
    var height: CGFloat = 20
    var body: some View {
        Image(t.title(key)).resizable().interpolation(.high).scaledToFit().frame(height: height)
            .accessibilityLabel(key)
    }
}

// MARK: - Shared marks

struct Seg {
    let hex: String
    let played: Bool
    let won: Bool
}

extension WD {
    var wordSegs: [Seg] { snap.modes.map { Seg(hex: $0.colorHex, played: $0.played, won: $0.won) } }
    var puzzleSegs: [Seg] { snap.puzzleModes.map { Seg(hex: $0.colorHex, played: $0.played, won: $0.won) } }
}

func segColor(_ s: Seg, _ t: WTheme) -> Color {
    s.played ? Color(widgetHex: s.won ? s.hex : WInk.slateHex)
        : (t.dark ? shade(s.hex, 0.45).opacity(0.24) : Color(widgetHex: s.hex).opacity(0.17))
}

let goldGrad = LinearGradient(colors: [Color(widgetHex: "#fcd34d"), Color(widgetHex: "#f59e0b")],
                              startPoint: .top, endPoint: .bottom)

/// The segmented game-color ring (the shipping DailyRing's drawing, themed, any segment count).
struct SegRing: View {
    let segs: [Seg]
    let t: WTheme
    var width: CGFloat = 0.11
    var body: some View {
        GeometryReader { g in
            let dd = min(g.size.width, g.size.height)
            let lw = dd * width
            let radius = (dd - lw) / 2
            let circ = 2 * Double.pi * Double(radius)
            let n = max(segs.count, 1)
            let half = min(0.35 / Double(n), (Double(lw) / 2 + Double(dd) * 0.03) / circ)
            let swept = !segs.isEmpty && segs.allSatisfy(\.played)
            ZStack {
                ForEach(Array(segs.enumerated()), id: \.offset) { i, s in
                    let a = Double(i) / Double(n), b = Double(i + 1) / Double(n)
                    let arc = Circle().trim(from: a + half, to: b - half)
                    let style = StrokeStyle(lineWidth: lw, lineCap: .round)
                    Group {
                        if swept { arc.stroke(goldGrad, style: style) } else { arc.stroke(segColor(s, t), style: style) }
                    }
                    .rotationEffect(.degrees(-90))
                    .padding(lw / 2)
                }
            }
            .frame(width: dd, height: dd)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

/// The ring unrolled: one rounded bar per game, in the game's color as it's done.
struct SegBar: View {
    let segs: [Seg]
    let t: WTheme
    var height: CGFloat = 7
    var gap: CGFloat = 3
    var body: some View {
        let swept = !segs.isEmpty && segs.allSatisfy(\.played)
        HStack(spacing: gap) {
            ForEach(Array(segs.enumerated()), id: \.offset) { _, s in
                Capsule().fill(swept ? AnyShapeStyle(goldGrad) : AnyShapeStyle(segColor(s, t)))
            }
        }
        .frame(height: height)
    }
}

/// A glossy brand tile with a white letter (friend initials, the Word of the Day).
struct LetterTile: View {
    let letter: String
    let hex: String
    let size: CGFloat
    var body: some View {
        ZStack {
            GlossyTile(hex: hex, size: size)
            Text(letter)
                .font(WType.black(size * 0.56))
                .foregroundStyle(.white)
                .shadow(color: shade(hex, -0.4).opacity(0.5), radius: 0, x: 0, y: size * 0.03)
                .offset(y: -size * 0.04)
        }
        .frame(width: size, height: size)
    }
}

/// A pale "not yet" tile (the to-play wash) with the letter in the color.
struct PaleLetterTile: View {
    let letter: String
    let hex: String
    let size: CGFloat
    let t: WTheme
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                .fill(t.dark ? shade(hex, 0.45).opacity(0.2) : Color(widgetHex: hex).opacity(0.15))
            Text(letter).font(WType.black(size * 0.5)).foregroundStyle(t.dark ? shade(hex, 0.45) : Color(widgetHex: hex))
        }
        .frame(width: size, height: size)
    }
}

/// The count inside a ring: "5/8" (or SWEPT in gold), the caps word under it where it fits.
struct RingCount: View {
    let played: Int
    let total: Int
    let t: WTheme
    let size: CGFloat
    var word = "DAILIES"
    var body: some View {
        let swept = total > 0 && played >= total
        VStack(spacing: -1) {
            Text(swept ? "SWEPT" : "\(played)/\(total)")
                .font(WType.black(swept ? size * 0.2 : size * 0.29))
                .tracking(swept ? 0.4 : 0)
                .monospacedDigit()
                .foregroundStyle(swept ? t.gold : t.number)
                .lineLimit(1).minimumScaleFactor(0.5)
            if size >= 84 {
                Caps(text: swept ? "ALL \(total)" : word, color: t.muted)
            }
        }
        .frame(width: size * 0.62)
    }
}

/// An icon + caps stat ("4H LEFT", "1,240 PTS"): the value in ink, the word muted.
struct IconStat: View {
    let icon: String
    let value: String
    let word: String
    let t: WTheme
    var iconSize: CGFloat = 13
    var body: some View {
        HStack(spacing: 4) {
            Image(icon).resizable().interpolation(.high).scaledToFit().frame(width: iconSize, height: iconSize)
            (Text(value).foregroundColor(t.number) + Text(word.isEmpty ? "" : " " + word).foregroundColor(t.muted))
                .font(WType.black(WType.caps)).tracking(0.8).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }
    }
}

/// The streak flame with a caps word next to it.
struct FlameLabel: View {
    let d: WD
    let t: WTheme
    var size: CGFloat = 28
    var word = "STREAK"
    var body: some View {
        HStack(spacing: 3) {
            FlameStreak(streak: d.snap.streak, size: size)
            Caps(text: word, color: t.number)
        }
    }
}

/// The reset countdown (gold clock sprite + "4H LEFT").
struct LeftStat: View {
    let d: WD
    let t: WTheme
    var body: some View { IconStat(icon: "art-badge-icon-clock-sprite", value: d.left.uppercased(), word: "LEFT", t: t, iconSize: 12) }
}

/// A 7-day strip (M T W T F S S): glossy purple for a streak day, today pale until a daily is done.
struct WeekStrip: View {
    let d: WD
    let t: WTheme
    var size: CGFloat = 16
    var gap: CGFloat = 4
    var body: some View {
        let letters = ["M", "T", "W", "T", "F", "S", "S"]
        HStack(spacing: gap) {
            ForEach(0..<7, id: \.self) { i in
                if d.week[i] {
                    LetterTile(letter: letters[i], hex: i == 6 ? "#f59e0b" : "#7c3aed", size: size)
                } else {
                    PaleLetterTile(letter: letters[i], hex: i == 6 ? "#f59e0b" : "#7c3aed", size: size, t: t)
                }
            }
        }
    }
}
