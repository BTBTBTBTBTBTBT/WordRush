import SwiftUI
import WordociousCore

/// The home banner (founder-approved home redesign, 2026-10-01; spec:
/// docs/HOME_REDESIGN_SPEC.md §2; web components/home/home-banner.tsx). One
/// window: a frosted headline strip over a Wordocious row (the eight sweep
/// dailies) and a Puzzles row (the ten More Games dailies). Each row glows on its
/// own (purple sweep, gold flawless) through ONE blended background and ONE
/// shimmer; Double Flawless turns the whole card gold. Every word comes from
/// HomeBanner (WordociousCore), pinned to the web by home-banner-fixtures.json.
struct HomeBannerView: View {
    struct Row {
        let modes: [HomeMode]
        let progress: GroupProgress
        let streaks: GroupStreaks
        /// Unlimited games finished today across this row's modes.
        let unlimitedPlayed: Int
    }

    let word: Row
    let puzzles: Row
    let byMode: [String: DailyCompletion]
    let playMode: PlayMode
    /// Pro players get the DAILY | UNLIMITED switch in the strip.
    let isPro: Bool
    let onModeChange: (PlayMode) -> Void
    /// The player's username; empty for a guest.
    let name: String
    let onOpen: (HomeMode) -> Void
    let onShare: () -> Void

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var unlimited: Bool { playMode == .unlimited }
    private var wTier: BannerTier { unlimited ? .none : HomeBanner.groupTier(word.progress) }
    private var pTier: BannerTier { unlimited ? .none : HomeBanner.groupTier(puzzles.progress) }
    private var double: Bool { wTier == .flawless && pTier == .flawless }
    private var headInk: Color { double ? Color(hex: 0x78350F) : Color(hex: 0x4C1D95) }
    private var subInk: Color { double ? Color(hex: 0x92400E) : Color(hex: 0x6D28D9) }
    private var anyPlayed: Bool { word.progress.played + puzzles.progress.played > 0 }

    private static func tierColor(_ t: BannerTier, none: UInt) -> Color {
        switch t {
        case .none: return Color(hex: none)
        case .sweep: return Color(hex: 0xEBD6FD)
        case .flawless: return Color(hex: 0xFDE68A)
        }
    }

    private static func tierInk(_ t: BannerTier) -> Color {
        switch t {
        case .none: return Color(hex: 0x6D28D9)
        case .sweep: return Color(hex: 0x7E22CE)
        case .flawless: return Color(hex: 0x92400E)
        }
    }

    var body: some View {
        // ART_SPEC §18.4: radius 22, the full content width.
        let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
        let hasPuzzles = !puzzles.modes.isEmpty
        VStack(spacing: 0) {
            strip
            rowView(word, tier: wTier, label: "WORDOCIOUS", tile: 32, radius: 9, gap: 7, icon: 16)
                .padding(.top, 10).padding(.horizontal, 12).padding(.bottom, hasPuzzles ? 6 : 12)
            // Remote flags can switch the Puzzles off entirely; then the row goes too.
            if hasPuzzles {
                rowView(puzzles, tier: pTier, label: "PUZZLES", tile: 28, radius: 8, gap: 4, icon: 14)
                    .padding(.top, 8).padding(.horizontal, 12).padding(.bottom, 12)
            }
        }
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                background
                // Exactly ONE light band across the WHOLE banner (both rows, under the
                // strip and the tiles), Daily only, once a row is swept or flawless.
                // Reduce Motion: none at all.
                if !unlimited && (wTier != .none || pTier != .none) && !Theme.reduceMotion {
                    BannerSweep().allowsHitTesting(false)
                }
            }
        }
        .clipShape(shape)
        .shadow(color: double ? Color(hex: 0xF59E0B).opacity(0.8) : Color(hex: 0x4C1D95).opacity(0.08),
                radius: double ? 13 : 7, x: 0, y: double ? 0 : 4)
        // The cast (docs/MASCOT_SPEC.md §1–§2): W hosts home, left of the share button.
        .bannerHost(Mascots.home, trailing: showsShare ? 50 : 10)
    }

    /// Unlimited: no share. Nothing played yet: nothing to share, so no button.
    private var showsShare: Bool { !unlimited && anyPlayed }

    // MARK: Background

    @ViewBuilder private var background: some View {
        if unlimited {
            LinearGradient(colors: [Color(hex: 0xFCE7F3), Color(hex: 0xEDE9FE)], startPoint: .topLeading, endPoint: .bottomTrailing)
        } else {
            let top = Self.tierColor(wTier, none: 0xECE8FF)
            let bottom = Self.tierColor(pTier, none: 0xE2E6FF)
            ZStack {
                // The vertical blend: the Wordocious tier color to 52%, the Puzzles tier color from 72%.
                LinearGradient(stops: [.init(color: top, location: 0), .init(color: top, location: 0.52),
                                       .init(color: bottom, location: 0.72), .init(color: bottom, location: 1)],
                               startPoint: .top, endPoint: .bottom)
                // The white sheen on top.
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
    }

    // MARK: Frosted headline strip

    private var strip: some View {
        // Ticks once a second for the clock line; the headline's greeting follows the hour.
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let hour = Calendar.current.component(.hour, from: ctx.date)
            let headline = HomeBanner.bannerHeadline(word.progress, puzzles.progress, hour: hour, name: name, unlimited: unlimited)
            let clockLine = HomeBanner.bannerClockLine(word.progress, puzzles.progress, clock: Self.countdown(), unlimited: unlimited)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 6) {
                    // ART_SPEC §18.4: a headline that fits on one line sits centered;
                    // one that wraps stays left, two lines, shrinking before a third.
                    ViewThatFits(in: .horizontal) {
                        headlineRow(headline, oneLine: true)
                        headlineRow(headline, oneLine: false)
                    }
                    // The headline keeps clear of the host standing at the strip's right end.
                    .padding(.trailing, Mascots.bannerClearance)
                    if showsShare {
                        Button(action: onShare) {
                            Icon3D(.share, size: 24)
                                .frame(width: 36, height: 36).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Share today's progress")
                    }
                }
                HStack(spacing: 8) {
                    Text(clockLine)
                        .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                        .foregroundStyle(subInk)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if isPro { modeSwitch }
                }
                .padding(.trailing, 4)
            }
        }
        .padding(.top, 12).padding(.trailing, 8).padding(.bottom, 10).padding(.leading, 12)
        // §18.4: frosted — white at 72% over a background blur (solid under Reduce Transparency).
        .background {
            if reduceTransparency {
                Color.white.opacity(0.9)
            } else {
                ZStack {
                    Rectangle().fill(.ultraThinMaterial)
                    Color.white.opacity(0.72)
                }
            }
        }
    }

    /// The headline (+ the double-flawless trophy / Unlimited's infinity): one line
    /// centered, or up to two lines left-aligned.
    private func headlineRow(_ headline: String, oneLine: Bool) -> some View {
        HStack(spacing: 6) {
            if double {
                Icon3D(.trophy, size: 20)
            }
            if unlimited {
                Image(systemName: "infinity").font(.system(size: 17, weight: .bold)).foregroundStyle(Color(hex: 0x7C3AED))
            }
            // The headline wears the old WORDOCIOUS wordmark style (Nunito Black,
            // violet→pink) with a soft pink glow; the double-flawless gold day keeps its tier ink.
            Text(headline)
                .font(Brand.font(22, .black)).tracking(0.4).lineSpacing(0)
                .foregroundStyle(double ? AnyShapeStyle(headInk) : AnyShapeStyle(Theme.wordmarkGradient))
                .shadow(color: double ? .clear : Color(hex: 0xEC4899).opacity(0.25), radius: 3)
                .multilineTextAlignment(oneLine ? .center : .leading)
                .fixedSize(horizontal: oneLine, vertical: true)
                .lineLimit(oneLine ? 1 : 2)
                .minimumScaleFactor(oneLine ? 1 : 0.7)
        }
        .frame(maxWidth: .infinity, minHeight: 30, alignment: oneLine ? .center : .leading)
    }

    private static func countdown() -> String {
        let s = secondsUntilLocalMidnight()
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    /// DAILY | UNLIMITED (Pro only). UNLIMITED's ink is violet, never pink or red (founder veto).
    private var modeSwitch: some View {
        HStack(spacing: 0) {
            segment(.daily, "DAILY")
            segment(.unlimited, "UNLIMITED")
        }
        .padding(2)
        .background(Capsule().fill(Color(hex: 0x7C3AED).opacity(0.12)))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Daily or Unlimited")
    }

    private func segment(_ m: PlayMode, _ label: String) -> some View {
        let on = playMode == m
        return Button { onModeChange(m) } label: {
            Text(label)
                .font(Brand.font(10.5, .black)).tracking(0.6)
                .foregroundStyle(on ? (m == .daily ? Color(hex: 0x4C1D95) : Color(hex: 0x6D28D9)) : Color(hex: 0x7C3AED))
                .padding(.horizontal, 10).frame(height: 26)
                .background(Capsule().fill(on ? Color.white : Color.clear))
                .lineLimit(1).fixedSize()
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: Rows

    private func rowView(_ r: Row, tier: BannerTier, label: String, tile: CGFloat, radius: CGFloat, gap: CGFloat, icon: CGFloat) -> some View {
        let ink = Self.tierInk(tier)
        let streak = unlimited ? 0 : HomeBanner.groupStreak(tier, r.streaks)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(label).font(Brand.font(10, .black)).tracking(1).foregroundStyle(ink)
                Text(unlimited ? HomeBanner.unlimitedGroupStatus(r.unlimitedPlayed) : HomeBanner.groupStatus(r.progress))
                    .font(Brand.font(10, .black)).tracking(0.5).foregroundStyle(ink)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 4)
                // A row's flame hides at 0 (and in Unlimited).
                if streak > 0 {
                    HStack(spacing: 2) {
                        FlameMark(size: 12)
                        Text("\(streak)").font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0xC2410C))
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(streak)-day streak")
                }
            }
            HStack(spacing: gap) {
                ForEach(r.modes) { m in
                    BannerTile(mode: m, result: unlimited ? nil : m.dbKey.flatMap { byMode[$0] },
                               unlimited: unlimited, size: tile, radius: radius, iconSize: icon) { onOpen(m) }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// The streak flame: the 3D streak buddy (HEADER_SPEC §2), sized from the old
/// glyph's point size so every caller keeps its local scale.
struct FlameMark: View {
    var size: CGFloat = 12
    var body: some View {
        Icon3D(.flame, size: SymbolGlyph.iconSize(size))
    }
}

/// One game in a banner row, drawn with its real home icon. Won = accent fill +
/// white icon + glow; lost = gray + white icon; unplayed = white with a dashed
/// accent border; Unlimited = white, no border, soft shadow.
private struct BannerTile: View {
    let mode: HomeMode
    let result: DailyCompletion?
    let unlimited: Bool
    let size: CGFloat
    let radius: CGFloat
    let iconSize: CGFloat
    let onTap: () -> Void

    var body: some View {
        let accent = mode.accent
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let solid = !unlimited && result != nil
        Button(action: onTap) {
            ZStack {
                if unlimited {
                    shape.fill(Color.white.opacity(0.9))
                        .shadow(color: Color(hex: 0x4C1D95).opacity(0.12), radius: 1.5, x: 0, y: 1)
                } else if let result {
                    shape.fill(result.completed ? accent : Color(hex: 0x9CA3AF))
                        .shadow(color: result.completed ? accent.opacity(0.7) : .clear, radius: 4.5)
                } else {
                    shape.fill(Color.white.opacity(0.85))
                    shape.strokeBorder(accent.opacity(0.55), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5]))
                }
                BannerGlyph(icon: mode.icon, ink: solid ? .white : accent, accent: accent, solid: solid, size: iconSize)
            }
            .frame(width: size, height: size)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(mode.title + (unlimited ? "" : result.map { $0.completed ? ", won" : ", played" } ?? ", not played yet"))
    }
}

/// A mode's home icon as a bare glyph in one ink (ModeIconView draws the tinted
/// square too; the banner tiles bring their own fill).
struct BannerGlyph: View {
    let icon: ModeIconKind
    let ink: Color
    let accent: Color
    /// On a solid accent / gray tile: white glyphs; the hand's digit flips to the accent.
    let solid: Bool
    let size: CGFloat

    var body: some View {
        if let art = icon.gameArt {
            // ART_SPEC §3: the 3D game icon (~1.25× the glyph, i.e. the chip). On a
            // solid result fill it sits on a white disc so it never melts into its
            // own accent color.
            if solid {
                ZStack {
                    Circle().fill(Color.white.opacity(0.94)).frame(width: size * 1.3, height: size * 1.3)
                        .shadow(color: .black.opacity(0.12), radius: 1.5, x: 0, y: 1)
                    GameArtImage(asset: art, size: size * 1.12)
                }
            } else {
                GameArtImage(asset: art, size: size * 1.25)
            }
        } else {
            glyph
        }
    }

    @ViewBuilder
    private var glyph: some View {
        switch icon.glyph {
        case .asset(let name):
            Image(name).renderingMode(.template).resizable().scaledToFit()
                .frame(width: size, height: size).foregroundStyle(ink)
        case .original(let name):
            if solid {
                Image(name).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: size, height: size).foregroundStyle(ink)
            } else {
                Image(name).resizable().scaledToFit().frame(width: size, height: size)
            }
        case .roman(let text):
            Text(text).font(Brand.font(text.count > 2 ? size * 0.5 : size * 0.69, .black))
                .foregroundStyle(ink).lineLimit(1).fixedSize()
        case .hand(let name, let number):
            ZStack {
                Image(name).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: size * 1.1, height: size * 1.15).foregroundStyle(ink)
                Text(number).font(Brand.font(size * 0.55, .black))
                    .foregroundStyle(solid ? accent : .white)
                    .offset(y: size * 0.2)
            }
        case .symbol(let name):
            Image(systemName: name).font(.system(size: size * 0.9, weight: .bold)).foregroundStyle(ink)
        case .game:
            EmptyView() // unreachable: `glyph` unwraps game icons
        }
    }
}

/// The banner's single diagonal light band: 38% of the width, white 0 → 55% → 0,
/// skewed about -18°, one left-to-right pass in ~2.2 s, then a rest, every 4 s.
/// The caller leaves it out entirely under Reduce Motion.
struct BannerSweep: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let band = w * 0.38
            LinearGradient(colors: [.white.opacity(0), .white.opacity(0.55), .white.opacity(0)],
                           startPoint: .leading, endPoint: .trailing)
                .frame(width: band, height: geo.size.height * 1.4)
                .transformEffect(CGAffineTransform(a: 1, b: 0, c: tan(-18 * .pi / 180), d: 1, tx: 0, ty: 0))
                // From fully off the left edge to fully off the right edge.
                .offset(x: -band * 1.5 + phase * (w + band * 2), y: -geo.size.height * 0.2)
        }
        .task {
            while !Task.isCancelled {
                // Jump back off the left edge unanimated, let that frame land, then sweep.
                var reset = Transaction(); reset.disablesAnimations = true
                withTransaction(reset) { phase = 0 }
                try? await Task.sleep(nanoseconds: 60_000_000)
                withAnimation(.easeInOut(duration: 2.2)) { phase = 1 }
                try? await Task.sleep(nanoseconds: 3_940_000_000)
            }
        }
    }
}
