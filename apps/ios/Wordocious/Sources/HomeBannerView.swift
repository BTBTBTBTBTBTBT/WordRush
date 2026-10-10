import SwiftUI
import UIKit
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
    /// BJ6: the headline slot's measured width (the lettering is sized to fit it).
    @State private var headWidth: CGFloat = 0
    @State private var unlimitedAfterPurchase = false
    @ObservedObject private var auth = AuthService.shared

    private var unlimited: Bool { playMode == .unlimited }
    private var wTier: BannerTier { unlimited ? .none : HomeBanner.groupTier(word.progress) }
    private var pTier: BannerTier { unlimited ? .none : HomeBanner.groupTier(puzzles.progress) }
    private var double: Bool { wTier == .flawless && pTier == .flawless }
    /// The double's deep amber inks belong to the daytime gold card; on a dark season's night card they'd vanish, so the
    /// double there reads in warm gold instead.
    private var nightCard: Bool { SeasonKit.surfaces?.dark == true }
    private var headInk: Color { double ? (nightCard ? Color(hex: 0xFDE68A) : Color(hex: 0x78350F)) : (SeasonKit.surfaces?.text ?? Color(hex: 0x4C1D95)) }
    private var subInk: Color { double ? (nightCard ? Color(hex: 0xFCD34D) : Color(hex: 0x92400E)) : (SeasonKit.surfaces?.textSecondary ?? Color(hex: 0x6D28D9)) }
    /// Season surfaces (SeasonKit): the hero card's windows (nil = the normal look).
    private var look: SeasonKit.Look? { SeasonKit.surfaces }
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
        case .none: return SeasonKit.surfaces?.textSecondary ?? Color(hex: 0x6D28D9)
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
    /// The banner art as live figures: Flawless = D · O · I cheering under the bunting; Sweep = O cheering, S flexing,
    /// W waving; the Halloween idle scene = the costumed O · W · R swaying slow. nil = draw the art as given.
    private static func liveTrio(art: String, moment: Moment?) -> CelebrationTrio? {
        func all(_ names: [String]) -> Bool { names.allSatisfy { ArtAsset.exists($0) } }
        switch moment {
        case .flawless?:
            return CelebrationTrio(cast: ["d", "o2", "i"])
        case .sweep?:
            let n = ["art-pose-o1-cheer", "art-pose-s-flex", "art-pose-w-wave"]
            return all(n) ? CelebrationTrio(images: n) : nil
        case nil:
            guard art == "art-scene-banner-halloween" else { return nil }
            let n = ["art-halloween-o1", "art-halloween-w", "art-halloween-r"]
            return all(n) ? CelebrationTrio(images: n, sparkles: false, tempo: 0.7, swayDegrees: 3) : nil
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
            // BJ6 flair (founder 10-03: "that window needs flair … it looks unfinished"): the candy
            // frosting cap across the top edge, like the game cards' trim — brand purple → pink,
            // the moment's gold / pink on a swept / flawless day. Static, one shape.
            BannerCap(colors: slots.showsMomentArt ? (momentBar ?? Self.brandCap) : Self.brandCap,
                      season: (slots.showsMomentArt && momentBar != nil) ? nil : look?.capStops(Self.brandCap[1]))
            strip
            // §G4: the wide sweep / flawless art across the banner under the headline,
            // the whole cast in it fully visible (never cropped).
            if let art = momentArt {
                Group {
                    // Founder 10-09: on a Flawless day the celebrating trio is ALIVE (each bounces, sways and squashes on its
                    // own beat under a swaying bunting, sparkles twinkling) instead of one flat picture.
                    // Founder 10-10: EVERY banner state is alive the same way (sweep, the season's idle cast), not a still.
                    if let trio = Self.liveTrio(art: art, moment: slots.showsMomentArt ? moment : nil) {
                        trio.frame(height: 104)
                    } else {
                        Image(art).resizable().interpolation(.high).scaledToFit()
                            .idleLife()
                    }
                }
                    .frame(maxWidth: .infinity, maxHeight: 104)
                    .opacity(slots.showsMomentArt ? 1 : 0)
                    // §Z: Unlimited keeps the slot — U in her loop fills it instead.
                    .overlay {
                        if !slots.showsMomentArt && ArtAsset.exists("art-scene-unlimited-loop") {
                            ArtThumbs.image("art-scene-unlimited-loop", points: 130)   // §AQ2: slot-sized
                                .resizable().interpolation(.high).scaledToFit()
                                .idleLife(hop: 4, sway: 2.5, period: 1.8)
                                .transition(.opacity)
                        }
                    }
                    .padding(.horizontal, 10).padding(.top, 6)
                    .accessibilityHidden(true)
            }
            // BI21: both rows share one tile size (sized so 10 fit) and spread edge to edge.
            // BJ6 (founder 10-03: the progress icons "a snag bigger"): the rows zone trims its side
            // padding to 6 and the tiles' minimum gap to 4 so the shared tile is as large as fits,
            // and it sits in a soft tint band — the card reads as two zones.
            VStack(spacing: 0) {
                rowView(word, tier: wTier, label: "WORDOCIOUS")
                    .padding(.top, 6).padding(.horizontal, Self.rowsInset).padding(.bottom, hasPuzzles ? 4 : 8)
                // Remote flags can switch the Puzzles off entirely; then the row goes too.
                if hasPuzzles {
                    rowView(puzzles, tier: pTier, label: "PUZZLES")
                        .padding(.top, 4).padding(.horizontal, Self.rowsInset).padding(.bottom, 8)
                }
            }
            .background(look?.raised.map { $0.opacity(look?.dark == true ? 0.45 : 0.5) }
                        ?? Color(hex: 0x7C3AED).opacity(unlimited ? 0.05 : 0.07))
        }
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                if let look, let fill = look.heroFill {
                    SeasonHeroBackdrop(look: look, fill: fill)
                } else {
                    background
                }
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
        .shadow(color: double ? Color(hex: 0xF59E0B).opacity(0.8)
                    : (look?.glow.map { $0.opacity(0.30) } ?? Color(hex: 0x4C1D95).opacity(0.08)),
                radius: double ? 13 : (look != nil ? 12 : 7), x: 0, y: double || look != nil ? 0 : 4)
        // FINISH_SPEC BJ6 (founder 10-03: "keep things looking fairly even and symmetrical"):
        // the host (the player's framed photo / their mascot / W) stands CENTERED on the card's
        // top edge — its head rises into the gap above, its lower part overlaps the strip —
        // and the headline / switch / resets line center under it. The share button lives in
        // the app header now (AppHeaderView `share`), so the card mirrors on its center line.
        card
            .overlay(alignment: .top) {
                HomeHostMascot(size: Self.hostSize, celebrates: moment != nil && slots.showsMomentArt)
                    .offset(y: -Self.hostRise)
                    // §A7: during the celebration art (which carries W) a W host steps aside. BJ6 fix:
                    // only when there IS art showing — `showsMomentArt` alone is true on every Daily
                    // day, which hid the guest's W all day.
                    .opacity(momentArt != nil && slots.showsMomentArt
                             && AvatarDirectory.shared.ownHostChoice() == .w ? 0 : 1)
            }
            // 10-05 (founder: the Pro crown "got clipped by the WORDOCIOUS mascots"): the host's whole box
            // stays inside the scroll content (it rose `scrollTopGap` past it, so the scroll view cut tall
            // hats and the crown at the header line).
            .padding(.top, Self.hostRise)
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

    /// The hour the greeting reads (`-storeDemo` store shots are always GOOD MORNING).
    private static func greetingHour(_ date: Date) -> Int {
        #if DEBUG
        if StoreDemo.active { return 9 }
        #endif
        return Calendar.current.component(.hour, from: date)
    }

    private var strip: some View {
        // The headline's greeting follows the hour (a minute timeline); only the clock
        // line below ticks every second (FINISH_SPEC BJ3: a 1 s tick here used to
        // rebuild and re-measure all four headline layouts every second).
        TimelineView(.everyMinute) { ctx in
            let hour = Self.greetingHour(ctx.date)
            // §Z: both modes' headlines are laid out in one slot (the taller sets its
            // height) and crossfade, so the switch never changes the strip's height.
            let dailyHeadline = HomeBanner.bannerHeadline(word.progress, puzzles.progress, hour: hour, name: name, unlimited: false,
                                                          wordStreaks: word.streaks, puzzleStreaks: puzzles.streaks,
                                                          dateKey: LeaderboardService.todayLocal())
            let unlimitedHeadline = HomeBanner.bannerHeadline(word.progress, puzzles.progress, hour: hour, name: name, unlimited: true)
            // FINISH_SPEC BI21 (founder 10-03: "fill that space better … it doesn't look
            // even"): headline centered on the card's center line, then a centered wide
            // DAILY | UNLIMITED switch, then the centered meta line.
            // BH3: one headline line, 8 above the slim switch, the meta line 4 under it.
            // BJ6: everything centered under the host (which overlaps the strip's top).
            VStack(spacing: 0) {
                // §Z: both modes' headlines share one slot and crossfade. BJ6: small gold
                // sparkles flank it, mirrored.
                HStack(alignment: .top, spacing: 6) {
                    GoldSparkle(size: 11).padding(.top, Self.sparkleTop(headWidth))
                    ZStack(alignment: .top) {
                        headlineSlot(dailyHeadline, trophy: dailyDouble)
                            .opacity(unlimited ? 0 : 1).accessibilityHidden(unlimited)
                        headlineSlot(unlimitedHeadline, trophy: false)
                            .opacity(unlimited ? 1 : 0).accessibilityHidden(!unlimited)
                    }
                    .frame(maxWidth: .infinity)
                    .background(GeometryReader { g in
                        Color.clear
                            .onAppear { headWidth = g.size.width }
                            .onChange(of: g.size.width) { headWidth = $0 }
                    })
                    GoldSparkle(size: 11).padding(.top, Self.sparkleTop(headWidth))
                }
                modeSwitch
                    .frame(maxWidth: Self.switchMaxWidth)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 6)
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    Text(HomeBanner.bannerClockLine(word.progress, puzzles.progress, clock: Self.countdown(), unlimited: unlimited))
                        .font(Brand.font(11, .heavy).smallCaps()).tracking(0.4).monospacedDigit()
                        .foregroundStyle(subInk)
                        .multilineTextAlignment(.center)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.top, 3)
            }
            .frame(maxWidth: .infinity)
        }
        // BJ6: the strip starts 4 under the host's overlapping lower part.
        .padding(.top, Self.hostSize - Self.hostRise - CardTrimGeometry.band + Self.hostToHeadline)
        .padding(.horizontal, 12).padding(.bottom, 6)
        // §18.4: frosted over a background blur (solid under Reduce Transparency) —
        // FINISH_SPEC §A1: a lavender frost instead of plain white.
        // §AQ2: a flat frost — the live material blur re-sampled the page under it on
        // every frame of a Home scroll for a barely visible difference at 74% lavender.
        // BJ6 flair: a very soft diagonal sheen instead of the flat frost, and a few tiny
        // confetti dots in the empty top corners (mirrored). Static, drawn once.
        .background {
            // Season surfaces: the hero's own fill shows through (no lavender frost, no confetti).
            if look?.heroFill == nil {
                ZStack {
                    LinearGradient(colors: [Color(hex: 0xF7F0FF), Color(hex: 0xFDF2FA), Color(hex: 0xF3ECFF)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                        .opacity(reduceTransparency ? 0.97 : 0.92)
                    BannerCornerConfetti()
                }
            }
        }
    }

    /// BI21: the headline's room on EACH side (kept for callers; BJ6 plan A moved the host
    /// into the strip's left column).
    static let headlineSideClear: CGFloat = Mascots.bannerClearance
    /// BJ6 (symmetric hero, founder 10-03 "way more prominent"): the host's box, centered on the
    /// card's top edge; it rises `hostRise` above the card (into the gap under the header) and
    /// overlaps the rest; the headline starts `hostToHeadline` under its feet.
    static let hostSize: CGFloat = 88
    static let hostRise: CGFloat = 28
    static let hostToHeadline: CGFloat = 4
    /// BJ6: the progress rows' side inset (was 12) — the shared tiles grow to fit.
    static let rowsInset: CGFloat = 6
    /// BJ6 flair: the brand candy cap (purple → pink).
    static let brandCap: [Color] = [Color(hex: 0x7C3AED), Color(hex: 0xA855F7), Color(hex: 0xEC4899)]
    /// The Home scroll content's own space above the banner (HomeView: top 4 + spacing 8).
    static let scrollTopGap: CGFloat = 12
    /// BI21 / BH3: the centered switch spans ~64% of a phone-wide card, equal halves.
    static let switchMaxWidth: CGFloat = 230
    /// BJ6: the headline's lettering size.
    static let headlineSize: CGFloat = 38


    /// One mode's headline: BH3 (founder 10-03) ONE line, auto-fit (shrinks, never wraps), centered.
    private func headlineSlot(_ headline: String, trophy: Bool) -> some View {
        headlineRow(headline, oneLine: true, trophy: trophy)
    }

    /// The headline (+ the double-flawless trophy; FINISH_SPEC §Y: Unlimited has no
    /// infinity glyph any more). FINISH_SPEC BJ6 (founder 10-03: "a clever way to populate
    /// longer usernames without shrinking anything down or scrolling off screen"): the core
    /// HeadlineLayout decides — one line at the device's full size when it fits, else the
    /// greeting on line 1 and the player's NAME + "!" as the gold hero line(s) at the SAME size
    /// (a long name breaks at natural boundaries). Never shrunk, truncated or clipped.
    private func headlineRow(_ headline: String, oneLine: Bool, trophy: Bool) -> some View {
        let fit = Self.headlineFit(headline, name: name, width: headWidth - (trophy ? 26 : 0))
        return HStack(spacing: 6) {
            if trophy {
                Icon3D(.trophy, size: 20)
            }
            // FINISH_SPEC §AR: the live lettering (purple → magenta, gold numbers, the
            // player's name in the accent, "·" as the star); the double-flawless gold
            // day takes the celebration palette; a stacked name line is gold.
            VStack(spacing: -fit.size * 0.42) {
                ForEach(Array(fit.layout.lines.enumerated()), id: \.offset) { i, line in
                    let hero = fit.layout.nameLines.contains(i)
                    BubbleLineView(text: line, palette: trophy ? .celebration : (look?.headlinePalette ?? (hero ? .leaderboard : .home)),
                                   size: fit.size, names: hero ? [] : [name], interactive: true)
                }
            }
            // The lettering's line box carries ~0.3 em above the caps and ~0.35 em under the
            // baseline: trimmed, so the host / switch sit right against the words.
            .padding(.top, -fit.size * 0.24).padding(.bottom, -fit.size * 0.28)
            // 2.8 item 40: the wrapped lettering is ONE heading that reads the whole sentence (never line fragments);
            // a changed headline is announced politely while VoiceOver is on.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(A11yLabels.headline(fit.layout.lines))
            .accessibilityAddTraits(.isHeader)
            .onChange(of: headline) { new in
                guard UIAccessibility.isVoiceOverRunning, !new.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                UIAccessibility.post(notification: .announcement, argument: A11yLabels.headline([new]))
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    /// BJ6: the lettering size + line layout for a headline at the slot's width — computed when
    /// the inputs change (cached), never per frame. Brand fonts follow Dynamic Type, so the size
    /// handed to LiveHeadline is the measured size divided by that scale.
    private static var fitCache: [String: (size: CGFloat, layout: BubbleText.Fit)] = [:]
    static func headlineFit(_ text: String, name: String, width: CGFloat) -> (size: CGFloat, layout: BubbleText.Fit) {
        let dyn = min(UIFontMetrics.default.scaledValue(for: 100) / 100, Brand.maxScale)
        let key = "\(text)|\(name)|\(Int(width))|\(dyn)"
        if let hit = fitCache[key] { return hit }
        let w = max(1, Double(width))
        // 2.8 item 6: core's bubble-text fit — the name keeps its stacked gold lines, every other
        // headline that is too long wraps in balanced lines (never "…", never a clip).
        let layout = BubbleText.homeFit(text, name: name, slotWidth: w)
        let out = (size: CGFloat(layout.size) / dyn, layout: layout)
        if fitCache.count > 64 { fitCache.removeAll() }
        fitCache[key] = out
        return out
    }

    /// BJ6: the flanking sparkles sit on line 1's cap height.
    static func sparkleTop(_ width: CGFloat) -> CGFloat {
        let size = HeadlineLayout.fontSize(availableWidth: max(1, Double(width)))
        return max(0, CGFloat(size) * 0.42 - 5.5 - CGFloat(size) * 0.24)
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
        .softSheet(isPresented: m == .unlimited ? $showPro : .constant(false), onDismiss: {
            if unlimitedAfterPurchase && auth.isProActive { onModeChange(.unlimited) }
            unlimitedAfterPurchase = false
        }) { ProView(reason: "Unlimited play") }
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
            BannerSpreadRow(slots: tileSlots, maxTile: 40, minGap: 4) {
                ForEach(r.modes) { m in
                    BannerTile(mode: m, result: unlimited ? nil : m.dbKey.flatMap { byMode[$0] },
                               unlimited: unlimited, radius: 8, iconSize: 0) { onOpen(m) }
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
        Button(action: onTap) {
            ZStack {
                if !unlimited, let result {
                    // 2.8 item 8: the ONE game-tile style (the Sudocious finish screen's picker tile):
                    // the game's color wash + top band, and today's W / L badge in the corner.
                    PickerTile(accent: accent, result: result.completed, radius: radius, bar: 3, badge: 13) { side in
                        BannerGlyph(icon: mode.icon, ink: accent, accent: accent, solid: false,
                                    size: iconSize > 0 ? iconSize : floor(side * 0.56))
                    }
                } else if unlimited {
                    shape.fill(accent.seasonWash(0.16))
                        .shadow(color: accent.opacity(0.18), radius: 3, x: 0, y: 2)
                } else {
                    // Not played: pale out of season; on a dark season's glass a dim night tile
                    // (only a hint of the game color), so the played tiles' solid color stands out.
                    shape.fill(accent.seasonIdleTile)
                }
                // BJ6: the icon scales with its tile (iconSize 0 = 56% of the tile's side).
                if unlimited || result == nil {
                    GeometryReader { g in
                        BannerGlyph(icon: mode.icon, ink: accent, accent: accent, solid: false,
                                    size: iconSize > 0 ? iconSize : floor(min(g.size.width, g.size.height) * 0.56))
                            .frame(width: g.size.width, height: g.size.height)
                    }
                    .opacity(!unlimited && result == nil ? 0.45 : 1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityLabel(mode.title + (unlimited ? "" : result.map { $0.completed ? ", won" : ", lost" } ?? ", not played yet"))
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

// MARK: - BJ6 flair (static, cheap)

/// The banner's candy frosting cap: the game cards' trim shape (band + shallow drips) in a
/// horizontal gradient with a baked-in top sheen. One shape, two fills, no blur / animation.
private struct BannerCap: View {
    let colors: [Color]
    /// Season surfaces: the season's drip cap stops (top lip → body → base), drawn top to bottom.
    var season: [Color]? = nil
    var body: some View {
        ZStack {
            if let season {
                CardTrimShape().fill(LinearGradient(stops: [.init(color: season[0], location: 0), .init(color: season[1], location: 0.42),
                                                            .init(color: season[2], location: 1)],
                                                    startPoint: .top, endPoint: .bottom))
            } else {
                CardTrimShape().fill(LinearGradient(colors: colors.count > 1 ? colors : colors + colors,
                                                    startPoint: .leading, endPoint: .trailing))
            }
            CardTrimShape().fill(LinearGradient(stops: [.init(color: .white.opacity(0.42), location: 0),
                                                        .init(color: .white.opacity(0), location: 0.6)],
                                                startPoint: .top, endPoint: .bottom))
        }
        .frame(height: CardTrimGeometry.band + CardTrimGeometry.drip)
        .padding(.bottom, -CardTrimGeometry.drip)   // the drips hang over the strip
        .zIndex(1)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A small four-point gold sparkle (code-drawn, never an emoji).
struct GoldSparkle: View {
    var size: CGFloat = 10
    var body: some View {
        SparkleShape()
            .fill(LinearGradient(colors: [Color(hex: 0xFFE08A), Color(hex: 0xF5A524)], startPoint: .top, endPoint: .bottom))
            .frame(width: size, height: size)
            .shadow(color: Color(hex: 0xF59E0B).opacity(0.35), radius: 1.5, x: 0, y: 1)
            .accessibilityHidden(true)
    }
}

struct SparkleShape: Shape {
    func path(in r: CGRect) -> Path {
        let c = CGPoint(x: r.midX, y: r.midY), k = min(r.width, r.height) * 0.16
        var p = Path()
        p.move(to: CGPoint(x: c.x, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: c.y), control: CGPoint(x: c.x + k, y: c.y - k))
        p.addQuadCurve(to: CGPoint(x: c.x, y: r.maxY), control: CGPoint(x: c.x + k, y: c.y + k))
        p.addQuadCurve(to: CGPoint(x: r.minX, y: c.y), control: CGPoint(x: c.x - k, y: c.y + k))
        p.addQuadCurve(to: CGPoint(x: c.x, y: r.minY), control: CGPoint(x: c.x - k, y: c.y - k))
        p.closeSubpath()
        return p
    }
}

/// A few tiny confetti dots + two faint sparkles in the strip's empty top corners, mirrored
/// left / right. One static Canvas.
private struct BannerCornerConfetti: View {
    private static let dots: [(x: CGFloat, y: CGFloat, r: CGFloat, hex: UInt)] = [
        (0.05, 0.18, 2.0, 0xEC4899), (0.12, 0.34, 1.5, 0x22C55E), (0.20, 0.14, 1.8, 0x2563EB), (0.09, 0.52, 1.4, 0xF5A524),
    ]
    var body: some View {
        Canvas { ctx, size in
            for d in Self.dots {
                for x in [d.x, 1 - d.x] {
                    ctx.fill(Path(ellipseIn: CGRect(x: x * size.width - d.r, y: d.y * size.height - d.r, width: d.r * 2, height: d.r * 2)),
                             with: .color(Color(hex: d.hex).opacity(0.32)))
                }
            }
            for x in [0.15, 0.85] as [CGFloat] {
                let s: CGFloat = 7
                ctx.fill(SparkleShape().path(in: CGRect(x: x * size.width - s / 2, y: size.height * 0.26 - s / 2, width: s, height: s)),
                         with: .color(Color(hex: 0xA855F7).opacity(0.28)))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}


// MARK: - Season surfaces (the hero card)

/// The Home hero card's backdrop under a season's surfaces (SeasonKit.Look): the season's hero
/// fill (translucent, so the wall glows through), a soft glow behind the banner art (dark tone:
/// a jack-o'-lantern glow; light tone: an orange inner glow around the edge) and a small cobweb
/// in the top-trailing corner. Static gradients + one stroked path — no blur.
struct SeasonHeroBackdrop: View {
    let look: SeasonKit.Look
    let fill: Color

    var body: some View {
        ZStack {
            fill
            if let glow = look.bannerGlow {
                if look.dark {
                    RadialGradient(colors: [glow.opacity(0.34), glow.opacity(0.10), glow.opacity(0)],
                                   center: UnitPoint(x: 0.5, y: 0.46), startRadius: 0, endRadius: 190)
                } else {
                    EllipticalGradient(colors: [glow.opacity(0), glow.opacity(0.26)], center: .center,
                                       startRadiusFraction: 0.42, endRadiusFraction: 0.78)
                }
            }
            if let web = look.cobweb {
                CobwebShape()
                    .stroke(web.opacity(look.dark ? 0.42 : 0.38), style: StrokeStyle(lineWidth: 0.9, lineCap: .round))
                    .frame(width: 58, height: 58)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A small corner cobweb anchored at the rect's top-trailing corner: five threads fanning down
/// and left, joined by three sagging rings.
struct CobwebShape: Shape {
    func path(in r: CGRect) -> Path {
        let o = CGPoint(x: r.maxX, y: r.minY)
        let len = min(r.width, r.height)
        let angles: [Double] = [90, 112, 135, 158, 180].map { $0 * .pi / 180 }
        func pt(_ a: Double, _ d: CGFloat) -> CGPoint { CGPoint(x: o.x + CGFloat(cos(a)) * d, y: o.y + CGFloat(sin(a)) * d) }
        var p = Path()
        for a in angles { p.move(to: o); p.addLine(to: pt(a, len)) }
        for f in [0.32, 0.58, 0.84] as [CGFloat] {
            let d = len * f
            p.move(to: pt(angles[0], d))
            for i in 1..<angles.count {
                let mid = (angles[i - 1] + angles[i]) / 2
                p.addQuadCurve(to: pt(angles[i], d), control: pt(mid, d * 0.80))
            }
        }
        return p
    }
}

extension SeasonKit.Look {
    /// The hero greeting's lettering in the season's colors (registry `headline`).
    var headlinePalette: HeadlinePalette? {
        guard let h = headline else { return nil }
        return HeadlinePalette(top: h[0], bottom: h[1], deep: h[2], outline: Color(hex: 0xF5C542),
                               nameTop: h[3], nameBottom: h[4],
                               numberTop: Color(hex: 0xFFE07A), numberBottom: Color(hex: 0xF5A524))
    }
}

extension Color {
    /// `wash(amount)` under a season's windows: the accent over the season card instead of white
    /// (deeper on dark cards so the tint still reads). The normal wash out of season.
    func seasonWash(_ amount: Double) -> Color {
        guard let look = SeasonKit.surfaces, let card = look.card else { return wash(amount) }
        return mixed(over: card, look.dark ? min(1, amount * 2.4) : amount * 1.4)
    }

    /// An unplayed hero progress tile: the pale wash out of season; a dim night tile (a hint of the
    /// game color over the card) under a dark season, so the played tiles read as the lit ones.
    var seasonIdleTile: Color {
        guard let look = SeasonKit.surfaces, look.dark, let card = look.card else { return seasonWash(0.12) }
        return mixed(over: card, SeasonDone.idleTile)
    }

    /// A game color as on-card text under a dark season card (lifted so it reads); as is otherwise.
    var onSeasonCard: Color {
        guard let look = SeasonKit.surfaces, look.dark else { return self }
        return mixed(over: .white, 0.55)
    }
}


/// Founder 10-09: the Flawless banner's celebrating cast, alive — three cheer poses on one floor under the bunting,
/// each bouncing / swaying / squashing on its own offset beat; the bunting sways and gold sparkles twinkle.
/// Reduce Motion / Low Power: the same scene, still.
struct CelebrationTrio: View {
    /// The three figures' image names (left to right).
    let images: [String]
    var bunting = true
    var sparkles = true
    /// Seconds per hop (the Halloween idle trio moves slower and spookier).
    var tempo: Double = 0.42
    var swayDegrees: Double = 4

    init(cast: [String]) { images = cast.map { "art-pose-\($0)-cheer" } }
    init(images: [String], bunting: Bool = false, sparkles: Bool = true, tempo: Double = 0.42, swayDegrees: Double = 4) {
        self.images = images; self.bunting = bunting; self.sparkles = sparkles; self.tempo = tempo; self.swayDegrees = swayDegrees
    }
    @Environment(\.accessibilityReduceMotion) private var envReduce
    private var still: Bool { envReduce || Theme.reduceMotion || ProcessInfo.processInfo.isLowPowerModeEnabled }
    /// Founder 10-09 ("make sure the animations run smooth"): every move is a repeating Core Animation (it runs on the
    /// render server at the display's full rate, 120 Hz on ProMotion), not a 30 fps redraw of the whole view.
    @State private var on = false

    var body: some View {
        GeometryReader { g in
            let h = g.size.height, w = g.size.width
            let fig = min(h * 0.66, w / 3.6)
            ZStack {
                // the bunting hangs still (founder 10-09: only the cast celebrates)
                if bunting {
                    Image("age-bunting").resizable().scaledToFit()
                        .frame(width: min(w * 0.36, 136), height: h * 0.20)
                        .position(x: w / 2, y: h * 0.09)
                }
                // one shared floor shadow
                Ellipse().fill(RadialGradient(colors: [Color(hex: 0x2E1065).opacity(0.28), .clear], center: .center,
                                              startRadius: 0, endRadius: fig * 1.6))
                    .frame(width: fig * 3.2, height: 14)
                    .position(x: w / 2, y: h - 18)
                ForEach(Array(images.enumerated()), id: \.offset) { i, name in
                    let delay = Double(i) * 0.18
                    Image(name).resizable().interpolation(.high).scaledToFit()
                        .frame(width: fig, height: fig)
                        // hop: stretched at the top, squashed on the landing
                        .scaleEffect(x: on ? 0.97 : 1.04, y: on ? 1.03 : 0.95, anchor: .bottom)
                        .offset(y: on ? -fig * 0.09 : 0)
                        .animation(still ? nil : .easeInOut(duration: tempo).repeatForever(autoreverses: true).delay(delay), value: on)
                        // a slower side-to-side sway on top of the hop
                        .rotationEffect(.degrees(on ? swayDegrees : -swayDegrees), anchor: .bottom)
                        .animation(still ? nil : .easeInOut(duration: tempo * 2.26).repeatForever(autoreverses: true).delay(delay * 2), value: on)
                        .position(x: w / 2 + CGFloat(i - 1) * fig * 0.95, y: h - fig / 2 - 16)
                }
                ForEach(0..<(sparkles ? 4 : 0), id: \.self) { k in
                    let xs: [CGFloat] = [0.22, 0.78, 0.35, 0.66], ys: [CGFloat] = [0.30, 0.26, 0.12, 0.10]
                    GoldSparkle(size: 9)
                        .opacity(still ? 0.8 : (on ? 1 : 0.3))
                        .scaleEffect(on ? 1.15 : 0.8)
                        .animation(still ? nil : .easeInOut(duration: 0.8 + Double(k) * 0.17).repeatForever(autoreverses: true)
                                    .delay(Double(k) * 0.25), value: on)
                        .position(x: w * xs[k], y: h * ys[k])
                }
            }
        }
        // Start the loops a beat AFTER the first layout: flipping `on` in the same pass as the geometry settling would
        // make the repeating animation loop the figures' sizes too (they'd swim around instead of hopping in place).
        .onAppear { if !still { DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { on = true } } }
        .onChange(of: still) { s in on = !s }
        .accessibilityHidden(true)
    }
}


/// Founder 10-10: a still mascot comes alive — a gentle hop + breathe and a slower sway, as Core Animation loops (display
/// rate, no per-frame redraw), started a beat after layout. Still under Reduce Motion / Low Power.
struct IdleLife: ViewModifier {
    var hop: CGFloat = 3
    var sway: Double = 1.5
    var period: Double = 2.2
    var delay: Double = 0
    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var on = false

    func body(content: Content) -> some View {
        let still = envReduce || Theme.reduceMotion || ProcessInfo.processInfo.isLowPowerModeEnabled
        content
            .scaleEffect(x: on ? 0.99 : 1.01, y: on ? 1.015 : 0.985, anchor: .bottom)
            .offset(y: on ? -hop : 0)
            .animation(still ? nil : .easeInOut(duration: period / 2).repeatForever(autoreverses: true).delay(delay), value: on)
            .rotationEffect(.degrees(on ? sway : -sway), anchor: .bottom)
            .animation(still ? nil : .easeInOut(duration: period * 0.75).repeatForever(autoreverses: true).delay(delay), value: on)
            .onAppear { if !still { DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { on = true } } }
    }
}

extension View {
    func idleLife(hop: CGFloat = 3, sway: Double = 1.5, period: Double = 2.2, delay: Double = 0) -> some View {
        modifier(IdleLife(hop: hop, sway: sway, period: period, delay: delay))
    }
}
