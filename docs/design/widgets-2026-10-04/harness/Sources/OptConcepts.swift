import SwiftUI
import UIKit

// The widget option concepts (design night 10-04). Every view is content only (the 16 pt
// system margins + backdrop come from WidgetFrame / containerBackground), sized for the
// iPhone 402-pt class: small 138², medium 332×138, large 332×350 of content.

/// A cast member sitting on a ring's top-right shoulder (sit poses; feet on the stroke).
struct SitOnRing: View {
    let art: String
    let ring: CGFloat
    var fig: CGFloat = 44
    var body: some View {
        Art(name: art)
            .frame(width: fig, height: fig, alignment: .bottom)
            .offset(x: fig * 0.08, y: -fig * 0.5)
            .allowsHitTesting(false)
    }
}

/// Head and shoulders peeking up from behind a tile row (cut at the tiles' top edge).
struct PeekHead: View {
    let art: String
    let fig: CGFloat
    var show: CGFloat = 0.5
    var body: some View {
        Art(name: art).frame(width: fig, height: fig, alignment: .top)
            .frame(width: fig, height: fig * show, alignment: .top).clipped()
    }
}

/// The daily tiles in a fixed grid (no Links: the harness renders; the widget wraps each in a Link).
struct TileGrid: View {
    let modes: [WSnapshot.Mode]
    let cols: Int
    let size: CGFloat
    let hGap: CGFloat
    let vGap: CGFloat
    let t: WTheme
    var body: some View {
        let rows = (modes.count + cols - 1) / cols
        VStack(spacing: vGap) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: hGap) {
                    ForEach(Array(modes.enumerated()).filter { $0.offset / cols == r }, id: \.offset) { _, m in
                        DailyChip(mode: m, size: size, dark: t.dark)
                    }
                }
            }
        }
    }
}

/// "UP NEXT DELIVERANCE" / "ALL DONE".
struct NextCaps: View {
    let d: WD
    let t: WTheme
    var body: some View {
        if let n = d.nextName {
            (Text("NEXT ").foregroundColor(t.muted) + Text(n.uppercased()).foregroundColor(t.accent))
                .font(WType.black(WType.caps)).tracking(0.8).lineLimit(1).minimumScaleFactor(0.7)
        } else {
            Caps(text: "ALL DONE", color: t.gold)
        }
    }
}

func ptsStat(_ d: WD, _ t: WTheme) -> IconStat {
    IconStat(icon: "art-badge-icon-star-sprite", value: WidgetStats.pointsText(d.points), word: "PTS", t: t, iconSize: 12)
}

// MARK: - 1. RING FIRST

struct RingSmall: View {
    let d: WD
    let t: WTheme
    var host = "d"
    var sitter: String? = nil      // nil = the mood rule
    var showSitter = true
    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                SegRing(segs: d.wordSegs, t: t)
                RingCount(played: d.played, total: d.total, t: t, size: 92)
            }
            .frame(width: 92, height: 92)
            .overlay(alignment: .topTrailing) {
                if showSitter { SitOnRing(art: sitter ?? moodArt(d, t, host: host, playing: "sit", sit: true), ring: 92, fig: 46) }
            }
            .padding(.top, 10)
            .frame(maxWidth: .infinity)
            HStack(spacing: 0) {
                FlameLabel(d: d, t: t, size: 26)
                Spacer(minLength: 2)
                LeftStat(d: d, t: t)
            }
        }
    }
}

struct RingMedium: View {
    let d: WD
    let t: WTheme
    var host = "d"
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                SegRing(segs: d.wordSegs, t: t)
                RingCount(played: d.played, total: d.total, t: t, size: 116, word: "DONE")
            }
            .frame(width: 116, height: 116)
            .overlay(alignment: .topTrailing) {
                SitOnRing(art: moodArt(d, t, host: host, playing: "sit", sit: true), ring: 116, fig: 52)
            }
            .padding(.top, 16)
            VStack(alignment: .leading, spacing: 8) {
                if d.swept {
                    Image(t.season == nil ? "art-moment-sweep" : t.title("dailies")).resizable().scaledToFit().frame(height: 26)
                } else {
                    Lettering(t: t, key: "dailies", height: 26)
                }
                if let m = d.nextMode {
                    HStack(spacing: 7) {
                        DailyChip(mode: m, size: 30, dark: t.dark)
                        VStack(alignment: .leading, spacing: 1) {
                            Caps(text: d.played == 0 ? "START WITH" : "UP NEXT", color: t.muted)
                            Text(WidgetStats.nextName(key: m.key, title: m.title).uppercased())
                                .font(WType.black(14)).foregroundStyle(t.accent).lineLimit(1).minimumScaleFactor(0.7)
                        }
                    }
                } else if let p = d.nextPuzzle {
                    HStack(spacing: 7) {
                        DailyChip(mode: p, size: 30, dark: t.dark)
                        VStack(alignment: .leading, spacing: 1) {
                            Caps(text: "BONUS PUZZLE", color: t.muted)
                            Text(p.title.uppercased()).font(WType.black(14)).foregroundStyle(t.accent).lineLimit(1)
                        }
                    }
                } else {
                    Caps(text: "SEE YOU TOMORROW", color: t.gold)
                }
                FlameLabel(d: d, t: t, size: 26, word: "DAY STREAK")
                HStack(spacing: 12) {
                    LeftStat(d: d, t: t)
                    if d.points > 0 { ptsStat(d, t) }
                }
            }
            Spacer(minLength: 0)
        }
    }
}

struct RingLarge: View {
    let d: WD
    let t: WTheme
    var host = "d"
    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 0) {
                VStack(spacing: 2) {
                    FlameStreak(streak: d.snap.streak, size: 46)
                    Caps(text: d.guest ? "START ONE" : "DAY STREAK", color: t.number)
                }
                .frame(width: 84)
                Spacer(minLength: 0)
                ZStack {
                    SegRing(segs: d.wordSegs, t: t, width: 0.1)
                    RingCount(played: d.played, total: d.total, t: t, size: 140)
                }
                .frame(width: 140, height: 140)
                .overlay(alignment: .topTrailing) {
                    SitOnRing(art: moodArt(d, t, host: host, playing: "sit", sit: true), ring: 140, fig: 52)
                }
                Spacer(minLength: 0)
                VStack(spacing: 2) {
                    Image("art-badge-icon-star-sprite").resizable().scaledToFit().frame(width: 30, height: 30)
                        .padding(.vertical, 4)
                    Text(WidgetStats.pointsText(d.points)).font(WType.black(18)).monospacedDigit().foregroundStyle(t.number)
                    Caps(text: "PTS TODAY", color: t.muted)
                }
                .frame(width: 84)
            }
            .padding(.top, 20)
            Spacer(minLength: 10)
            TileGrid(modes: d.snap.modes, cols: 8, size: 34, hGap: 8, vGap: 0, t: t)
            Spacer(minLength: 12)
            HStack {
                Lettering(t: t, key: "puzzles", height: 18)
                Spacer()
                Caps(text: "\(d.pPlayed)/\(d.pTotal)", color: t.muted)
            }
            Spacer(minLength: 6).frame(maxHeight: 8)
            TileGrid(modes: d.snap.puzzleModes, cols: 10, size: 28, hGap: 5.8, vGap: 0, t: t)
            Spacer(minLength: 10)
            HStack { NextCaps(d: d, t: t); Spacer(); LeftStat(d: d, t: t) }
        }
    }
}

// MARK: - 2. BOARD FIRST (the tiles are the widget; lettering heads each row)

struct BoardSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 9) {
            HStack(alignment: .center) {
                Lettering(t: t, key: "dailies", height: 18)
                Spacer(minLength: 2)
                Text(d.swept ? "8/8" : "\(d.played)/\(d.total)").font(WType.black(16)).monospacedDigit()
                    .foregroundStyle(d.swept ? t.gold : t.number)
            }
            TileGrid(modes: d.snap.modes, cols: 4, size: 30, hGap: 6, vGap: 6, t: t)
            HStack(spacing: 0) {
                FlameLabel(d: d, t: t, size: 26)
                Spacer(minLength: 2)
                LeftStat(d: d, t: t)
            }
        }
    }
}

struct BoardMedium: View {
    let d: WD
    let t: WTheme
    var peek = "o3"
    var body: some View {
        VStack(spacing: 6) {
            HStack(alignment: .center, spacing: 6) {
                Lettering(t: t, key: "dailies", height: 18)
                Caps(text: "\(d.played)/\(d.total)", color: d.swept ? t.gold : t.muted)
                Spacer(minLength: 2)
                FlameLabel(d: d, t: t, size: 22)
            }
            TileGrid(modes: d.snap.modes, cols: 8, size: 36, hGap: 6.3, vGap: 0, t: t)
                .background(alignment: .topLeading) {
                    PeekHead(art: moodArt(d, t, host: peek, playing: "ready"), fig: 32, show: 0.55)
                        .offset(x: 4 * 42.3 + 2, y: -32 * 0.55 + 1)
                }
            HStack(alignment: .center, spacing: 6) {
                Lettering(t: t, key: "puzzles", height: 15)
                Caps(text: "\(d.pPlayed)/\(d.pTotal)", color: d.pSwept ? t.gold : t.muted)
                Spacer(minLength: 2)
                LeftStat(d: d, t: t)
            }
            TileGrid(modes: d.snap.puzzleModes, cols: 10, size: 28, hGap: 4.8, vGap: 0, t: t)
        }
    }
}

struct BoardLarge: View {
    let d: WD
    let t: WTheme
    var peek = "o3"
    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 6) {
                Lettering(t: t, key: "dailies", height: 24)
                Caps(text: "\(d.played)/\(d.total)", color: d.swept ? t.gold : t.muted)
                Spacer(minLength: 2)
                FlameLabel(d: d, t: t, size: 32, word: "DAY STREAK")
            }
            Spacer(minLength: 6)
            TileGrid(modes: d.snap.modes, cols: 4, size: 58, hGap: 33, vGap: 10, t: t)
                .background(alignment: .topLeading) {
                    PeekHead(art: moodArt(d, t, host: peek, playing: "ready"), fig: 44, show: 0.5)
                        .offset(x: 2 * 91 + 7, y: -22 + 1)
                }
            Spacer(minLength: 12)
            HStack(alignment: .center, spacing: 6) {
                Lettering(t: t, key: "puzzles", height: 20)
                Caps(text: "\(d.pPlayed)/\(d.pTotal)", color: d.pSwept ? t.gold : t.muted)
                Spacer(minLength: 2)
                LeftStat(d: d, t: t)
            }
            Spacer(minLength: 6)
            TileGrid(modes: d.snap.puzzleModes, cols: 5, size: 46, hGap: 25.5, vGap: 8, t: t)
            Spacer(minLength: 10)
            HStack { NextCaps(d: d, t: t); Spacer(); if d.points > 0 { ptsStat(d, t) } else { LeftStat(d: d, t: t) } }
        }
    }
}

// MARK: - 3. STREAK HERO (your mascot holds the flame)

/// The player's mascot (W for guests) with the streak flame held at its side.
struct FlameHolder: View {
    let d: WD
    let t: WTheme
    let size: CGFloat
    var body: some View {
        let who = d.guest ? t.cast("w", "wave") : "art-player-mascot"
        ZStack(alignment: .bottomTrailing) {
            Art(name: who).frame(width: size, height: size, alignment: .bottom)
            FlameStreak(streak: d.snap.streak, size: size * (d.milestone ? 0.74 : 0.64))
                .offset(x: size * 0.34, y: -size * 0.02)
        }
        .frame(width: size, height: size)
        .offset(x: -size * 0.14)
    }
}

struct StreakSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 6) {
            FlameHolder(d: d, t: t, size: 80)
                .frame(maxWidth: .infinity)
            if d.milestone {
                Image("art-titlecast-onastreak").resizable().scaledToFit().frame(height: 15)
            } else {
                Caps(text: d.guest ? "START A STREAK TODAY" : "\(d.snap.streak) DAY STREAK", color: t.number)
            }
            WeekStrip(d: d, t: t, size: 15.5, gap: 3.6)
        }
    }
}

struct StreakMedium: View {
    let d: WD
    let t: WTheme
    var body: some View {
        HStack(spacing: 8) {
            FlameHolder(d: d, t: t, size: 104)
                .offset(x: 8)
                .frame(width: 128)
            VStack(alignment: .leading, spacing: 8) {
                if d.milestone {
                    Image("art-titlecast-onastreak").resizable().scaledToFit().frame(height: 22)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text("\(d.snap.streak)").font(WType.black(WType.hero)).monospacedDigit().foregroundStyle(t.number)
                        Caps(text: d.guest ? "DAYS — PLAY ONE TO START" : "DAY STREAK", color: t.muted)
                    }
                }
                WeekStrip(d: d, t: t, size: 23, gap: 5)
                HStack(spacing: 6) {
                    SegBar(segs: d.wordSegs, t: t, height: 6, gap: 2.5).frame(width: 100)
                    Caps(text: "\(d.played)/\(d.total) TODAY", color: t.muted)
                }
                HStack(spacing: 12) {
                    IconStat(icon: "icon3d-trophy", value: "\(d.guest ? 0 : d.best)", word: "BEST", t: t, iconSize: 15)
                    IconStat(icon: "icon3d-shield", value: "\(d.guest ? 0 : (d.snap.shields ?? 0))", word: "SHIELDS", t: t, iconSize: 15)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - 4. UP NEXT (one tap into the next game; W points at it)

struct NextHero: View {
    let d: WD
    let t: WTheme
    let chip: CGFloat
    var body: some View {
        if let m = d.nextMode {
            HStack(alignment: .bottom, spacing: -chip * 0.06) {
                Art(name: t.cast("w", "point")).frame(width: chip * 0.82, height: chip * 0.82, alignment: .bottom)
                DailyChip(mode: m, size: chip, dark: t.dark)
            }
        } else {
            Art(name: d.guest ? t.cast("w", "wave") : "art-player-mascot").frame(width: chip * 1.1, height: chip * 1.1, alignment: .bottom)
        }
    }
}

struct UpNextSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 5) {
            if d.swept {
                Image(t.season == nil ? "art-moment-sweep" : t.title("dailies")).resizable().scaledToFit().frame(height: 20)
            } else {
                Caps(text: d.played == 0 ? "START WITH" : "UP NEXT", color: t.muted)
            }
            NextHero(d: d, t: t, chip: 62).frame(height: 66).frame(maxWidth: .infinity)
            Text(d.nextName?.uppercased() ?? "SEE YOU TOMORROW")
                .font(WType.black(d.nextName == nil ? 11 : 15)).foregroundStyle(d.nextName == nil ? t.gold : t.accent)
                .lineLimit(1).minimumScaleFactor(0.6)
            HStack(spacing: 6) {
                SegBar(segs: d.wordSegs, t: t, height: 6, gap: 2.5)
                Caps(text: "\(d.played)/\(d.total)", color: t.muted).fixedSize()
            }
        }
    }
}

struct UpNextMedium: View {
    let d: WD
    let t: WTheme
    var body: some View {
        HStack(spacing: 12) {
            VStack(spacing: 4) {
                NextHero(d: d, t: t, chip: 72).frame(height: 84).frame(maxWidth: .infinity)
                Text(d.nextName?.uppercased() ?? "SWEPT")
                    .font(WType.black(16)).foregroundStyle(d.nextName == nil ? t.gold : t.accent).lineLimit(1).minimumScaleFactor(0.6)
                Caps(text: d.nextName == nil ? "ALL \(d.total) DONE" : (d.played == 0 ? "TAP TO START" : "TAP TO PLAY"), color: t.muted)
            }
            .frame(width: 136)
            VStack(alignment: .leading, spacing: 9) {
                let rest = Array(d.snap.modes.filter { !$0.played }.dropFirst().prefix(4))
                if rest.isEmpty {
                    Caps(text: d.nextName == nil ? "PUZZLES \(d.pPlayed)/\(d.pTotal)" : "LAST ONE TODAY", color: t.muted)
                    if d.nextName == nil, let p = d.nextPuzzle {
                        HStack(spacing: 6) {
                            DailyChip(mode: p, size: 30, dark: t.dark)
                            Caps(text: "TRY " + p.title.uppercased(), color: t.accent)
                        }
                    }
                } else {
                    Caps(text: "THEN", color: t.muted)
                    HStack(spacing: 6) {
                        ForEach(Array(rest.enumerated()), id: \.offset) { _, m in DailyChip(mode: m, size: 30, dark: t.dark) }
                    }
                }
                HStack(spacing: 6) {
                    SegBar(segs: d.wordSegs, t: t, height: 6, gap: 2.5).frame(width: 100)
                    Caps(text: "\(d.played)/\(d.total)", color: t.muted).fixedSize()
                }
                HStack(spacing: 12) { FlameLabel(d: d, t: t, size: 24); LeftStat(d: d, t: t) }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - 5. WORD OF THE DAY

let wotdWord = "WHIMSY"
let wotdSay = "NOUN · WIM-ZEE"
let wotdMeaning = "Playful, quirky humor or fancy."
/// Cast body colors, one per letter (W purple, O amber, R slate, D blue, O pink, C teal…).
let castHexes = ["#7c3aed", "#f59e0b", "#2563eb", "#059669", "#ec4899", "#0891b2", "#f97316", "#ca8a04"]

struct WordTiles: View {
    let d: WD
    let t: WTheme
    let size: CGFloat
    let gap: CGFloat
    var body: some View {
        let solved = d.state != .fresh
        HStack(spacing: gap) {
            ForEach(Array(wotdWord.enumerated()), id: \.offset) { i, ch in
                if solved {
                    LetterTile(letter: String(ch), hex: castHexes[i % castHexes.count], size: size)
                } else {
                    PaleLetterTile(letter: String(ch), hex: castHexes[i % castHexes.count], size: size, t: t)
                }
            }
        }
    }
}

struct WotdSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 7) {
            Image(t.title("wotd")).resizable().interpolation(.high).scaledToFit().frame(maxWidth: 124, maxHeight: 24)
            WordTiles(d: d, t: t, size: 19.5, gap: 3)
            Caps(text: wotdSay, color: t.muted)
            Text(d.state == .fresh ? "Guess what it means." : wotdMeaning)
                .font(WType.black(12)).foregroundStyle(t.number).multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.8)
        }
        .frame(maxHeight: .infinity)
    }
}

struct WotdMedium: View {
    let d: WD
    let t: WTheme
    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            VStack(alignment: .leading, spacing: 8) {
                Image(t.title("wotd")).resizable().interpolation(.high).scaledToFit().frame(height: 21)
                WordTiles(d: d, t: t, size: 30, gap: 4)
                Caps(text: wotdSay, color: t.muted)
                Text(d.state == .fresh ? "Guess what it means: tap to play the quiz." : wotdMeaning)
                    .font(WType.black(13)).foregroundStyle(t.number).lineLimit(2).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            Art(name: t.cast("d", d.state == .fresh ? "notes" : "eureka"))
                .frame(width: 92, height: 112, alignment: .bottom)
        }
    }
}

// MARK: - 6. LEADERBOARD RANK

struct RankHero: View {
    let d: WD
    let t: WTheme
    let size: CGFloat
    var body: some View {
        if let r = d.rank {
            VStack(alignment: .center, spacing: 2) {
                HStack(spacing: 4) {
                    Image(r <= 3 ? "icon3d-crown" : "icon3d-trophy").resizable().scaledToFit().frame(width: size * 0.8, height: size * 0.8)
                    Text("#\(r)").font(WType.black(size)).monospacedDigit().foregroundStyle(r <= 10 ? t.gold : t.number)
                }
                Caps(text: "OF \(WidgetStats.pointsText(d.rankOf)) TODAY", color: t.muted)
                HStack(spacing: 3) {
                    Image(systemName: d.rankDelta >= 0 ? "arrowtriangle.up.fill" : "arrowtriangle.down.fill")
                        .font(.system(size: 7, weight: .black))
                    Caps(text: d.rankDelta >= 0 ? "UP \(d.rankDelta)" : "DOWN \(-d.rankDelta)",
                         color: d.rankDelta >= 0 ? Color(widgetHex: t.dark ? "#4ade80" : "#15803d") : Color(widgetHex: t.dark ? "#f87171" : "#b91c1c"))
                }
                .foregroundStyle(d.rankDelta >= 0 ? Color(widgetHex: t.dark ? "#4ade80" : "#15803d") : Color(widgetHex: t.dark ? "#f87171" : "#b91c1c"))
            }
        } else {
            VStack(spacing: 4) {
                Image("icon3d-trophy").resizable().scaledToFit().frame(width: size * 1.1, height: size * 1.1).saturation(0.4).opacity(0.85)
                Caps(text: d.guest ? "SIGN IN TO RANK" : "PLAY ONE TO RANK", color: t.number)
                Caps(text: d.guest ? "\(WidgetStats.pointsText(d.rankOf)) PLAYING" : "#18 YESTERDAY", color: t.muted)
            }
        }
    }
}

struct RankSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 6) {
            Image(t.title("leaderboard")).resizable().interpolation(.high).scaledToFit().frame(maxWidth: 120, maxHeight: 24)
            Spacer(minLength: 0)
            RankHero(d: d, t: t, size: 36)
            Spacer(minLength: 0)
        }
    }
}

struct Podium: View {
    let t: WTheme
    var body: some View {
        let top: [(String, String, String, CGFloat, String)] = [
            ("N", "#2563eb", "nova", 40, "2"), ("K", "#ec4899", "kestrel", 54, "1"), ("Z", "#059669", "zed", 30, "3")]
        let fills = ["1": ["#fde68a", "#f59e0b"], "2": ["#e2e8f0", "#94a3b8"], "3": ["#fed7aa", "#c2410c"]]
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(Array(top.enumerated()), id: \.offset) { _, p in
                VStack(spacing: 3) {
                    LetterTile(letter: p.0, hex: p.1, size: 28)
                    Caps(text: p.2, color: t.muted, tracking: 0.4)
                    ZStack(alignment: .top) {
                        UnevenRoundedRectangle(topLeadingRadius: 8, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 8, style: .continuous)
                            .fill(LinearGradient(colors: fills[p.4]!.map { Color(widgetHex: $0) }, startPoint: .top, endPoint: .bottom))
                        Text(p.4).font(WType.black(15)).foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.15), radius: 0, x: 0, y: 1).padding(.top, 4)
                    }
                    .frame(width: 46, height: p.3)
                }
            }
        }
    }
}

struct RankMedium: View {
    let d: WD
    let t: WTheme
    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(spacing: 8) {
                Image(t.title("leaderboard")).resizable().interpolation(.high).scaledToFit().frame(height: 22)
                RankHero(d: d, t: t, size: 34)
            }
            .frame(maxWidth: .infinity)
            Podium(t: t)
                .frame(maxHeight: .infinity, alignment: .bottom)
        }
    }
}

// MARK: - 7. FRIENDS RACE

struct Lane: View {
    let f: Friend
    let d: WD
    let t: WTheme
    let tile: CGFloat
    var nameWidth: CGFloat = 0
    let leader: Bool
    var body: some View {
        HStack(spacing: 6) {
            if f.you && !d.guest {
                Art(name: "art-player-mascot").frame(width: tile, height: tile)
            } else {
                LetterTile(letter: f.initial, hex: f.hex, size: tile)
            }
            if nameWidth > 0 {
                Caps(text: f.you ? "YOU" : f.name, color: f.you ? t.accent : t.number).frame(width: nameWidth, alignment: .leading)
            }
            SegBar(segs: f.you ? d.wordSegs : (0..<8).map { Seg(hex: f.hex, played: $0 < f.played, won: true) },
                   t: t, height: tile * 0.34, gap: 2)
            Text("\(f.played)").font(WType.black(11)).monospacedDigit()
                .foregroundStyle(leader ? t.gold : t.number).frame(width: 12, alignment: .trailing)
        }
    }
}

func raceLine(_ d: WD) -> String {
    guard let me = d.friends.firstIndex(where: \.you) else { return "" }
    if me == 0 {
        let next = d.friends.count > 1 ? d.friends[1].played : 0
        return d.friends[0].played == next ? "TIED FOR FIRST" : "YOU LEAD BY \(d.friends[0].played - next)"
    }
    let gap = d.friends[0].played - d.friends[me].played
    return gap == 0 ? "TIED FOR FIRST" : "\(gap) BEHIND \(d.friends[0].name.uppercased())"
}

struct GuestRace: View {
    let t: WTheme
    let big: Bool
    var body: some View {
        VStack(spacing: 6) {
            Image("icon3d-add-friend").resizable().scaledToFit().frame(width: big ? 44 : 34, height: big ? 44 : 34)
            Caps(text: "ADD A FRIEND TO RACE", color: t.number)
            Caps(text: "SAME 8 DAILIES", color: t.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct FriendsSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(t.title("friends")).resizable().interpolation(.high).scaledToFit().frame(height: 19)
            if d.guest {
                GuestRace(t: t, big: false)
            } else {
                ForEach(Array(d.friends.prefix(3).enumerated()), id: \.offset) { i, f in
                    Lane(f: f, d: d, t: t, tile: 22, leader: i == 0)
                }
                Caps(text: raceLine(d), color: t.muted).frame(maxWidth: .infinity)
            }
        }
    }
}

struct FriendsMedium: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Image(t.title("friends")).resizable().interpolation(.high).scaledToFit().frame(height: 20)
                Spacer()
                Caps(text: d.guest ? "" : raceLine(d), color: t.muted)
            }
            if d.guest {
                GuestRace(t: t, big: false)
            } else {
                ForEach(Array(d.friends.prefix(4).enumerated()), id: \.offset) { i, f in
                    Lane(f: f, d: d, t: t, tile: 21, nameWidth: 44, leader: i == 0)
                }
            }
        }
    }
}

struct FriendsLarge: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom) {
                Image(t.title("friends")).resizable().interpolation(.high).scaledToFit().frame(height: 28)
                Spacer()
                Art(name: t.cast("o1", d.guest ? "ready" : (d.friends.first?.you == true ? "cheer" : "ready")))
                    .frame(width: 56, height: 56, alignment: .bottom)
                    .padding(.top, -14)
            }
            Spacer(minLength: 6)
            Caps(text: d.guest ? "TODAY'S RACE" : "TODAY'S RACE · " + raceLine(d), color: t.muted)
            Spacer(minLength: 8)
            if d.guest {
                GuestRace(t: t, big: true)
            } else {
                VStack(spacing: 11) {
                    ForEach(Array(d.friends.prefix(6).enumerated()), id: \.offset) { i, f in
                        Lane(f: f, d: d, t: t, tile: 28, nameWidth: 54, leader: i == 0)
                    }
                }
            }
            Spacer(minLength: 10)
            HStack {
                HStack(spacing: 3) {
                    FlameStreak(streak: d.guest ? 0 : 3, size: 26)
                    Caps(text: "FRIEND STREAKS", color: t.number)
                }
                Spacer()
                LeftStat(d: d, t: t)
            }
        }
    }
}

// MARK: - 8. PUZZLES ONLY

struct PuzzlesSmall: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 6) {
            Lettering(t: t, key: "puzzles", height: 18)
            ZStack {
                SegRing(segs: d.puzzleSegs, t: t)
                RingCount(played: d.pPlayed, total: d.pTotal, t: t, size: 76, word: "SOLVED")
            }
            .frame(width: 76, height: 76)
            .overlay(alignment: .topTrailing) {
                SitOnRing(art: d.pSwept ? (d.guest ? t.cast("w", "sit") : "art-player-mascot") : (d.pPlayed == 0 ? t.cast("c", "telescope") : t.cast("c", "sit")), ring: 76, fig: 34)
            }
            .padding(.top, 12)
            if let p = d.nextPuzzle {
                (Text("NEXT ").foregroundColor(t.muted) + Text(WidgetStats.nextName(key: p.key, title: p.title).uppercased()).foregroundColor(t.accent))
                    .font(WType.black(WType.caps)).tracking(0.8).lineLimit(1)
            } else {
                Caps(text: "ALL 10 SOLVED", color: t.gold)
            }
        }
    }
}

struct PuzzlesMedium: View {
    let d: WD
    let t: WTheme
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                SegRing(segs: d.puzzleSegs, t: t)
                RingCount(played: d.pPlayed, total: d.pTotal, t: t, size: 104, word: "SOLVED")
            }
            .frame(width: 104, height: 104)
            .overlay(alignment: .topTrailing) {
                SitOnRing(art: d.pSwept ? (d.guest ? t.cast("w", "sit") : "art-player-mascot") : (d.pPlayed == 0 ? t.cast("c", "telescope") : t.cast("c", "sit")), ring: 104, fig: 46)
            }
            .padding(.top, 18)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Lettering(t: t, key: "puzzles", height: 20)
                    Spacer()
                    LeftStat(d: d, t: t)
                }
                TileGrid(modes: d.snap.puzzleModes, cols: 5, size: 37, hGap: 5.5, vGap: 6, t: t)
                if let p = d.nextPuzzle {
                    (Text("NEXT ").foregroundColor(t.muted) + Text(p.title.uppercased()).foregroundColor(t.accent))
                        .font(WType.black(WType.caps)).tracking(0.8).lineLimit(1)
                } else {
                    Caps(text: "ALL 10 SOLVED", color: t.gold)
                }
            }
        }
    }
}

struct PuzzlesLarge: View {
    let d: WD
    let t: WTheme
    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center) {
                Lettering(t: t, key: "puzzles", height: 26)
                Spacer()
                Text("\(d.pPlayed)/\(d.pTotal)").font(WType.black(22)).monospacedDigit().foregroundStyle(d.pSwept ? t.gold : t.number)
            }
            SegBar(segs: d.puzzleSegs, t: t, height: 8, gap: 4).padding(.top, 10).padding(.bottom, 30)
            VStack(spacing: 10) {
                ForEach(0..<2, id: \.self) { r in
                    HStack(spacing: 0) {
                        ForEach(Array(d.snap.puzzleModes.enumerated()).filter { $0.offset / 5 == r }, id: \.offset) { _, m in
                            VStack(spacing: 4) {
                                DailyChip(mode: m, size: 58, dark: t.dark)
                                Caps(text: m.title, color: m.played ? t.number : t.muted, tracking: 0.3)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .background(alignment: .topLeading) {
                PeekHead(art: d.pSwept ? (d.guest ? t.cast("w") : "art-player-mascot") : t.cast("c", "telescope"), fig: 44, show: 0.5)
                    .offset(x: 4 * 66.4 + 11, y: -21)
            }
            Spacer(minLength: 12)
            HStack(alignment: .center) {
                FlameStreak(streak: d.guest ? 0 : 6, size: 26)
                Caps(text: "PUZZLE STREAK", color: t.number)
                Spacer()
            }
            Spacer(minLength: 8).frame(maxHeight: 10)
            HStack {
                if let p = d.nextPuzzle {
                    (Text("NEXT ").foregroundColor(t.muted) + Text(p.title.uppercased()).foregroundColor(t.accent))
                        .font(WType.black(WType.caps)).tracking(0.8)
                } else { Caps(text: "ALL 10 SOLVED", color: t.gold) }
                Spacer()
                LeftStat(d: d, t: t)
            }
        }
    }
}

// MARK: - 9. LOCK SCREEN (system-tinted: drawn white, the system makes it vibrant)

struct LockBackdrop<C: View>: View {
    let fam: Fam
    @ViewBuilder let content: () -> C
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(widgetHex: "#3b2a6b"), Color(widgetHex: "#1d1838")], startPoint: .topLeading, endPoint: .bottomTrailing)
            content().foregroundStyle(.white)
        }
        .frame(width: fam.size.width + 24, height: fam.size.height + 24)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .environment(\.colorScheme, .dark)
    }
}

struct LockRing: View {
    let d: WD
    var body: some View {
        ZStack {
            Circle().fill(.white.opacity(0.14))
            SegRingMono(segs: d.wordSegs).padding(5)
            VStack(spacing: -2) {
                Text(d.swept ? "8/8" : "\(d.played)/\(d.total)").font(.system(size: 19, weight: .black, design: .rounded))
                Text("DAILIES").font(.system(size: 7, weight: .heavy, design: .rounded)).opacity(0.8)
            }
        }
        .frame(width: 76, height: 76)
    }
}

struct SegRingMono: View {
    let segs: [Seg]
    var body: some View {
        GeometryReader { g in
            let dd = min(g.size.width, g.size.height)
            let lw = dd * 0.1
            let n = max(1, segs.count)
            let half = 0.022
            ZStack {
                ForEach(Array(segs.enumerated()), id: \.offset) { i, s in
                    Circle().trim(from: Double(i) / Double(n) + half, to: Double(i + 1) / Double(n) - half)
                        .stroke(Color.white.opacity(s.played ? 1 : 0.28), style: StrokeStyle(lineWidth: lw, lineCap: .round))
                        .rotationEffect(.degrees(-90)).padding(lw / 2)
                }
            }
        }
    }
}

struct LockFlame: View {
    let d: WD
    var body: some View {
        ZStack {
            Circle().fill(.white.opacity(0.14))
            VStack(spacing: 0) {
                Image(systemName: "flame.fill").font(.system(size: 18, weight: .bold))
                Text("\(d.snap.streak)").font(.system(size: 22, weight: .black, design: .rounded))
                Text("STREAK").font(.system(size: 7, weight: .heavy, design: .rounded)).opacity(0.8)
            }
        }
        .frame(width: 76, height: 76)
    }
}

struct LockRectProgress: View {
    let d: WD
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("WORDOCIOUS").font(.system(size: 11, weight: .black, design: .rounded))
                Spacer()
                Image(systemName: "flame.fill").font(.system(size: 10, weight: .bold))
                Text("\(d.snap.streak)").font(.system(size: 12, weight: .black, design: .rounded))
            }
            HStack(spacing: 2.5) {
                ForEach(Array(d.wordSegs.enumerated()), id: \.offset) { _, s in
                    Capsule().fill(Color.white.opacity(s.played ? 1 : 0.28))
                }
            }
            .frame(height: 7)
            Text(d.nextName.map { "Next: \($0) · \(d.left.lowercased()) left" } ?? "Swept all 8 · new in \(d.left.lowercased())")
                .font(.system(size: 12, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(width: 172, height: 76, alignment: .leading)
    }
}

struct LockRectWord: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("WORD OF THE DAY").font(.system(size: 10, weight: .black, design: .rounded)).opacity(0.8)
            Text("whimsy").font(.system(size: 21, weight: .black, design: .rounded))
            Text(wotdMeaning).font(.system(size: 11, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(width: 172, height: 76, alignment: .leading)
    }
}

struct LockRectRace: View {
    let d: WD
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("FRIENDS RACE").font(.system(size: 10, weight: .black, design: .rounded)).opacity(0.8)
            ForEach(Array(d.friends.prefix(3).enumerated()), id: \.offset) { _, f in
                HStack(spacing: 5) {
                    Text(f.you ? "You" : f.name).font(.system(size: 11, weight: .heavy, design: .rounded)).frame(width: 38, alignment: .leading)
                    HStack(spacing: 2) {
                        ForEach(0..<8, id: \.self) { i in Capsule().fill(Color.white.opacity(i < f.played ? 1 : 0.25)) }
                    }
                    .frame(height: 5)
                    Text("\(f.played)").font(.system(size: 11, weight: .black, design: .rounded))
                }
            }
        }
        .frame(width: 172, height: 76, alignment: .leading)
    }
}

struct LockInline: View {
    let d: WD
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill")
            Text("\(d.snap.streak) · \(d.played)/\(d.total) dailies · \(d.left.lowercased()) left")
        }
        .font(.system(size: 15, weight: .semibold, design: .rounded))
        .frame(width: 257, height: 26)
    }
}
