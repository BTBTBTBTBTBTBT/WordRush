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
    /// FINISH_SPEC §R3 (founder 10-02): free players see the switch too; UNLIMITED
    /// wears a PRO pill and opens the G1 Go Pro paywall, then switches once Pro.
    @State private var showPro = false
    @State private var unlimitedAfterPurchase = false
    @ObservedObject private var auth = AuthService.shared

    private var unlimited: Bool { playMode == .unlimited }
    private var wTier: BannerTier { unlimited ? .none : HomeBanner.groupTier(word.progress) }
    private var pTier: BannerTier { unlimited ? .none : HomeBanner.groupTier(puzzles.progress) }
    private var double: Bool { wTier == .flawless && pTier == .flawless }
    private var headInk: Color { double ? Color(hex: 0x78350F) : Color(hex: 0x4C1D95) }
    private var subInk: Color { double ? Color(hex: 0x92400E) : Color(hex: 0x6D28D9) }
    private var anyPlayed: Bool { word.progress.played + puzzles.progress.played > 0 }

    /// FINISH_SPEC §Z: which optional pieces take room comes from TODAY'S DAILY
    /// state whatever the switch says (WordociousCore, unit tested), so flipping
    /// Daily ⇄ Unlimited only crossfades content inside fixed slots — the tile
    /// rows (and everything under the banner) never move.
    private var slots: HomeBannerSlots {
        HomeBannerSlots.compute(word: word.progress, puzzles: puzzles.progress,
                                wordStreaks: word.streaks, puzzleStreaks: puzzles.streaks,
                                mode: unlimited ? .unlimited : .daily)
    }
    /// Today's Double Flawless, whatever the switch says (sizes the Daily headline slot).
    private var dailyDouble: Bool {
        HomeBanner.groupTier(word.progress) == .flawless && HomeBanner.groupTier(puzzles.progress) == .flawless
    }
    /// The Daily ⇄ Unlimited switch's sliding thumb.
    @Namespace private var switchThumb

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

    /// FINISH_SPEC §G4: the banner's celebration state (the Wordocious row's tier).
    /// §Z: from today's DAILY tier whatever the switch says — the bar + art slots
    /// stay in Unlimited (the art crossfades to U's loop), so nothing moves.
    private enum Moment { case sweep, flawless }
    private var moment: Moment? {
        switch HomeBanner.groupTier(word.progress) {
        case .flawless: return .flawless
        case .sweep: return .sweep
        case .none: return nil
        }
    }
    private var momentArt: String? {
        // FINISH_SPEC §X: no celebration today → in the Halloween season the banner
        // shows `art-scene-banner-halloween` in the same slot (nil when it doesn't ship).
        guard let m = moment else { return CastSkin.bannerArt }
        let name = m == .flawless ? "art-scene-banner-flawless" : "art-scene-banner-sweep"
        return ArtAsset.exists(name) ? name : nil
    }
    /// §G4: the celebration card's top bar (gold sweep, pink flawless).
    private var momentBar: [Color]? {
        switch moment {
        case .flawless: return [Color(hex: 0xEC4899), Color(hex: 0xF9A8D4)]
        case .sweep: return [Color(hex: 0xF5A524), Color(hex: 0xFFD166)]
        case nil: return nil
        }
    }

    var body: some View {
        // ART_SPEC §18.4: radius 22, the full content width.
        let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
        let hasPuzzles = !puzzles.modes.isEmpty
        let card = VStack(spacing: 0) {
            if let bar = momentBar {
                LinearGradient(colors: bar, startPoint: .leading, endPoint: .trailing).frame(height: 8)
                    .opacity(slots.showsMomentArt ? 1 : 0)
            }
            strip
            // §G4: the wide sweep / flawless art across the banner under the headline,
            // the whole cast in it fully visible (never cropped).
            if let art = momentArt {
                Image(art).resizable().interpolation(.high).scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: 104)
                    .opacity(slots.showsMomentArt ? 1 : 0)
                    // §Z: Unlimited keeps the slot — U in her loop fills it instead.
                    .overlay {
                        if !slots.showsMomentArt && ArtAsset.exists("art-scene-unlimited-loop") {
                            ArtThumbs.image("art-scene-unlimited-loop", points: 130)   // §AQ2: slot-sized
                                .resizable().interpolation(.high).scaledToFit()
                                .transition(.opacity)
                        }
                    }
                    .padding(.horizontal, 10).padding(.top, 6)
                    .accessibilityHidden(true)
            }
            // BI21: both rows share one tile size (sized so 10 fit) and spread edge to edge.
            rowView(word, tier: wTier, label: "WORDOCIOUS")
                .padding(.top, 4).padding(.horizontal, 12).padding(.bottom, hasPuzzles ? 4 : 8)
            // Remote flags can switch the Puzzles off entirely; then the row goes too.
            if hasPuzzles {
                rowView(puzzles, tier: pTier, label: "PUZZLES")
                    .padding(.top, 4).padding(.horizontal, 12).padding(.bottom, 6)
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
        .overlay {
            if let bar = momentBar, slots.showsMomentArt {
                shape.stroke(bar[0].wash(0.45), lineWidth: 1.5)
            }
        }
        .shadow(color: double ? Color(hex: 0xF59E0B).opacity(0.8) : Color(hex: 0x4C1D95).opacity(0.08),
                radius: double ? 13 : 7, x: 0, y: double ? 0 : 4)
        // FINISH_SPEC BJ6 plan A (founder 10-03: "the created mascot can be a little more
        // prominent"): the host stands INSIDE the card on the strip's left (HomeHostMascot),
        // so nothing peeks above the card any more.
        card
    }

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
        // The headline's greeting follows the hour (a minute timeline); only the clock
        // line below ticks every second (FINISH_SPEC BJ3: a 1 s tick here used to
        // rebuild and re-measure all four headline layouts every second).
        TimelineView(.everyMinute) { ctx in
            let hour = Calendar.current.component(.hour, from: ctx.date)
            // §Z: both modes' headlines are laid out in one slot (the taller sets its
            // height) and crossfade, so the switch never changes the strip's height.
            let dailyHeadline = HomeBanner.bannerHeadline(word.progress, puzzles.progress, hour: hour, name: name, unlimited: false)
            let unlimitedHeadline = HomeBanner.bannerHeadline(word.progress, puzzles.progress, hour: hour, name: name, unlimited: true)
            // FINISH_SPEC BI21 (founder 10-03: "fill that space better … it doesn't look
            // even"): headline centered on the card's center line, then a centered wide
            // DAILY | UNLIMITED switch, then the centered meta line.
            // BH3: one headline line, 8 above the slim switch, the meta line 4 under it.
            // BJ6 plan A: the host (the player's portrait / mascot, else W) stands on the left
            // on a soft floor shadow; the headline / switch / resets column centers in the rest.
            HStack(alignment: .center, spacing: 2) {
                HomeHostMascot(size: Self.hostSize)
                    // §A7: during the celebration art (which carries W) a W host steps aside.
                    .opacity(slots.showsMomentArt && AvatarDirectory.shared.ownHostChoice() == .w ? 0 : 1)
            VStack(spacing: 0) {
                // §Z: both modes' headlines share one slot and crossfade; symmetric room for
                // the share button (top-right corner) keeps it centered in the column.
                ZStack {
                    headlineSlot(dailyHeadline, trophy: dailyDouble)
                        .opacity(unlimited ? 0 : 1).accessibilityHidden(unlimited)
                    headlineSlot(unlimitedHeadline, trophy: false)
                        .opacity(unlimited ? 1 : 0).accessibilityHidden(!unlimited)
                }
                .padding(.horizontal, slots.hasShare ? 28 : 0)
                modeSwitch
                    .frame(maxWidth: Self.switchMaxWidth)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    Text(HomeBanner.bannerClockLine(word.progress, puzzles.progress, clock: Self.countdown(), unlimited: unlimited))
                        .font(Brand.font(11, .heavy).smallCaps()).tracking(0.4).monospacedDigit()
                        .foregroundStyle(subInk)
                        .multilineTextAlignment(.center)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.top, 4)
            }
            .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 4).padding(.leading, 6).padding(.trailing, 12).padding(.bottom, 4)
        // BJ6 plan A: the share button moves to the strip's top-right corner. §Z: the slot
        // stays in Unlimited (empty there).
        .overlay(alignment: .topTrailing) {
            if slots.hasShare {
                Button(action: onShare) {
                    Icon3D(.share, size: 22)
                        .frame(width: 34, height: 34).contentShape(Rectangle())
                }
                .buttonStyle(.squish)
                .accessibilityLabel("Share today's progress")
                .opacity(slots.showsShare ? 1 : 0)
                .allowsHitTesting(slots.showsShare)
                .accessibilityHidden(!slots.showsShare)
                .padding(.top, 2).padding(.trailing, 4)
            }
        }
        // §18.4: frosted over a background blur (solid under Reduce Transparency) —
        // FINISH_SPEC §A1: a lavender frost instead of plain white.
        // §AQ2: a flat frost — the live material blur re-sampled the page under it on
        // every frame of a Home scroll for a barely visible difference at 74% lavender.
        .background {
            Color(hex: 0xF5EEFF).opacity(reduceTransparency ? 0.94 : 0.88)
        }
    }

    /// BI21: the headline's room on EACH side (kept for callers; BJ6 plan A moved the host
    /// into the strip's left column).
    static let headlineSideClear: CGFloat = Mascots.bannerClearance
    /// BJ6 plan A: the host's box — ~2× the old 52 pt corner host, the strip's full height.
    static let hostSize: CGFloat = 84
    /// BI21 / BH3: the centered switch spans ~64% of a phone-wide card, equal halves.
    static let switchMaxWidth: CGFloat = 230

    /// One mode's headline: BH3 (founder 10-03) ONE line, auto-fit (shrinks, never wraps), centered.
    private func headlineSlot(_ headline: String, trophy: Bool) -> some View {
        headlineRow(headline, oneLine: true, trophy: trophy)
    }

    /// The headline (+ the double-flawless trophy; FINISH_SPEC §Y: Unlimited has no
    /// infinity glyph any more): one line centered, or up to two lines left-aligned.
    private func headlineRow(_ headline: String, oneLine: Bool, trophy: Bool) -> some View {
        HStack(spacing: 6) {
            if trophy {
                Icon3D(.trophy, size: 20)
            }
            // FINISH_SPEC §AR: the live lettering (purple → magenta, gold numbers, the
            // player's name in the accent, "·" as the star); the double-flawless gold
            // day takes the celebration palette.
            LiveHeadline(text: headline, palette: trophy ? .celebration : .home, size: 20,
                         names: [name], alignment: .center,
                         maxLines: 1, minimumScale: 0.55)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 32, alignment: .center)
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
        .padding(CandySprite.pad(28))
        // The candy toggle sprites (night art 10-03, proposal 1): the glossy track + thumb.
        .background(CandyPill(sprite: .track))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Daily or Unlimited")
    }

    private func segment(_ m: PlayMode, _ label: String) -> some View {
        let on = playMode == m
        let locked = m == .unlimited && !isPro
        return Button {
            if locked { unlimitedAfterPurchase = true; showPro = true } else { onModeChange(m) }
        } label: {
            // BI21: equal halves. Proposal 1 (night art 10-03): the gold PRO crown sprite rides
            // INSIDE the Unlimited half, no pill (AA4: only for players without Pro).
            HStack(spacing: 4) {
                Text(label)
                    .font(Brand.font(11, .black)).tracking(0.6)
                    .foregroundStyle(on ? CandyToggleInk.on : CandyToggleInk.off)
                    .shadow(color: on ? Color(hex: 0x4C1D95).opacity(0.45) : .clear, radius: 0, x: 0, y: 1)
                if locked {
                    Image("art-badge-pro-crown-sprite").resizable().interpolation(.high)
                        .frame(width: 15, height: 15).offset(y: -1)
                        .accessibilityHidden(true)
                }
            }
                .lineLimit(1).fixedSize()
                .frame(maxWidth: .infinity).frame(height: 28 - CandySprite.pad(28) * 2)
                .contentShape(Capsule())
                // §Z: ONE glossy candy thumb slides between the segments (matched geometry);
                // the segments keep their width and weight in both states, so nothing reflows.
                .background {
                    if on {
                        CandyPill(sprite: .thumbOn)
                            .matchedGeometryEffect(id: "thumb", in: switchThumb)
                    }
                }
        }
        .buttonStyle(.squish)
        .accessibilityLabel(locked ? "\(label), Pro" : label)
        .accessibilityAddTraits(on ? .isSelected : [])
        .sheet(isPresented: m == .unlimited ? $showPro : .constant(false), onDismiss: {
            if unlimitedAfterPurchase && auth.isProActive { onModeChange(.unlimited) }
            unlimitedAfterPurchase = false
        }) { ProView() }
        .onChange(of: auth.isProActive) { pro in if pro && showPro { showPro = false } }
    }

    // MARK: Rows

    /// BI21: tile slots per row — the widest row (at least 10) sets one tile size for both.
    private var tileSlots: Int { max(10, word.modes.count, puzzles.modes.count) }

    private func rowView(_ r: Row, tier: BannerTier, label: String) -> some View {
        let ink = Self.tierInk(tier)
        // FINISH_SPEC §AS7: no per-row streak flames — every streak lives in the
        // header flame's popup.
        // BH3: label → icons 4.
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(label).font(Brand.font(9.5, .black)).tracking(1).foregroundStyle(ink)
                Text(unlimited ? HomeBanner.unlimitedGroupStatus(r.unlimitedPlayed) : HomeBanner.groupStatus(r.progress))
                    .font(Brand.font(10, .black)).tracking(0.5).foregroundStyle(ink)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 4)
            }
            BannerSpreadRow(slots: tileSlots) {
                ForEach(r.modes) { m in
                    BannerTile(mode: m, result: unlimited ? nil : m.dbKey.flatMap { byMode[$0] },
                               unlimited: unlimited, radius: 8, iconSize: 15) { onOpen(m) }
                }
            }
            .frame(maxWidth: .infinity)
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

/// One game in a banner row, drawn with its real home icon. FINISH_SPEC BI21 (no
/// bordered boxes): not played = a soft pale tile with the icon dimmed; won = a glossy
/// tile in the game's color, full icon, a small white check; lost = a glossy gray tile;
/// Unlimited = a soft tinted tile, full icon. The tile fills the size its row gives it.
private struct BannerTile: View {
    let mode: HomeMode
    let result: DailyCompletion?
    let unlimited: Bool
    let radius: CGFloat
    let iconSize: CGFloat
    let onTap: () -> Void

    var body: some View {
        let accent = mode.accent
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let solid = !unlimited && result != nil
        let won = !unlimited && result?.completed == true
        Button(action: onTap) {
            ZStack {
                if unlimited {
                    shape.fill(accent.wash(0.16))
                        .shadow(color: accent.opacity(0.18), radius: 3, x: 0, y: 2)
                } else if let result {
                    // Glossy: the fill plus a soft white sheen over its top half.
                    shape.fill(result.completed ? accent : Color(hex: 0x9CA3AF))
                        .overlay(shape.fill(LinearGradient(stops: [.init(color: .white.opacity(0.38), location: 0),
                                                                   .init(color: .white.opacity(0), location: 0.55)],
                                                           startPoint: .top, endPoint: .bottom)))
                        .shadow(color: result.completed ? accent.opacity(0.55) : .clear, radius: 3.5, x: 0, y: 1.5)
                } else {
                    shape.fill(accent.wash(0.12))
                }
                BannerGlyph(icon: mode.icon, ink: solid ? .white : accent, accent: accent, solid: solid, size: iconSize)
                    .opacity(!unlimited && result == nil ? 0.45 : 1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .bottomTrailing) {
                if won {
                    Image(systemName: "checkmark")
                        .font(.system(size: 7, weight: .black))
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.3), radius: 0.8, x: 0, y: 0.5)
                        .padding(2.5)
                        .accessibilityHidden(true)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityLabel(mode.title + (unlimited ? "" : result.map { $0.completed ? ", won" : ", played" } ?? ", not played yet"))
    }
}

/// BI21: a banner row's tiles spread edge to edge — first flush left, last flush right,
/// equal gaps — at one tile size sized so `slots` tiles fit the width (so the 8- and
/// 10-tile rows share a size and both end flush).
struct BannerSpreadRow: Layout {
    var slots: Int = 10
    var maxTile: CGFloat = 36 // BH3: up to 36 (10 across still fit)
    var minGap: CGFloat = 5

    func tile(_ width: CGFloat) -> CGFloat {
        let n = CGFloat(max(slots, 1))
        return max(18, min(maxTile, floor((width - minGap * (n - 1)) / n)))
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? (maxTile * CGFloat(slots) + minGap * CGFloat(max(slots - 1, 0)))
        return CGSize(width: w, height: tile(w))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let s = tile(bounds.width)
        let n = subviews.count
        guard n > 0 else { return }
        let gap = n > 1 ? max(0, (bounds.width - s * CGFloat(n)) / CGFloat(n - 1)) : 0
        for (i, v) in subviews.enumerated() {
            v.place(at: CGPoint(x: bounds.minX + CGFloat(i) * (s + gap), y: bounds.minY),
                    proposal: ProposedViewSize(width: s, height: s))
        }
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
                    Circle().fill(accent.wash(0.12)).frame(width: size * 1.3, height: size * 1.3)
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
