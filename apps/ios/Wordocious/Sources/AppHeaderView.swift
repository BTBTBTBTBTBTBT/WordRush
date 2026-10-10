import SwiftUI
import WordociousCore

/// Shared top header across all four tabs (HEADER_SPEC §1; FINISH_SPEC §A3, §A5,
/// §C1, §C5 — founder 2026-10-02).
/// FINISH_SPEC §AS2: Row 1 (top): the streak / flawless / shield controls on the
/// left and help + settings on the right, all soft 3D icons drawn bare (no bubbles)
/// with soft numbers, each squishing on press. Row 2: the living cast header — the
/// ten mascots spelling WORDOCIOUS edge to edge, one of them playing its move every
/// few seconds (Pro: W wears the crown). The stat controls open the redesigned
/// popups (colored header, big 3D icon, host character, soft-number tiles) — §AS6:
/// presented full-screen from the app root (`HeaderPopupHost`), never inside the
/// header's own container.
struct AppHeaderView: View {
    /// FINISH_SPEC BJ6 (founder 10-03: symmetric Home card): Home's "share today's
    /// progress" lives here as a matching circle left of help + settings. `visible` false
    /// keeps the slot (no jump) but hides and disables it. nil = no share slot (other tabs).
    struct Share {
        var visible: Bool
        var action: () -> Void
    }
    var share: Share? = nil
    /// 2.8 item 14: the page's scroll model — the cast row slims as the page scrolls (nil = never condenses).
    var scroll: HeaderScrollModel? = nil

    @ObservedObject private var auth = AuthService.shared
    @State private var showMenu = false
    @State private var menuSelection: InfoMenuDestination?
    @State private var menuDest: InfoMenuDestination?
    @State private var showSettings = false
    @State private var showAuth = false
    /// BI25: the last help / gear fire (single-fire guard).
    @State private var lastSheetTap: Date?
    /// §AS6: the popups live at the app root (full-screen scrim + card).
    @ObservedObject private var popups = HeaderPopups.shared

    typealias HeaderPop = HeaderPopups.Kind

    var body: some View {
        VStack(spacing: 0) {
            // §AS2: the controls row ABOVE the WORDOCIOUS cast row.
            HStack(spacing: 2) {
                // Drawn from `headerStreak`/`headerShields`, not from `profile`
                // directly: the profile row arrives a beat after launch, so gating
                // the controls on it made them pop in a second late on EVERY cold
                // start. Those accessors fall back to the last known values for
                // exactly that window (nil on a first launch or after sign-out, so
                // nothing is drawn then). The popups still need the real row, so
                // a tap during the window is simply inert.
                if let streak = auth.headerStreak, streak > 0 {
                    statControl(.flame, value: streak, label: "Daily streak, \(streak)") {
                        if auth.profile != nil { toggle(.streak) }
                    }
                }
                // §244: the flawless-streak control — the day-stamped cache written by
                // dailySweepStats(), synchronous like the other header values.
                // Only a live run (>= 2) earns header real estate.
                if MatchStatsService.cachedFlawlessStreak() >= 2 {
                    let flawless = MatchStatsService.cachedFlawlessStreak()
                    statControl(.trophy, value: flawless, label: "Flawless streak, \(flawless)") { toggle(.flawless) }
                }
                if let shields = auth.headerShields {
                    statControl(.shield, value: shields, label: "Streak shields, \(shields)") {
                        if auth.profile != nil { toggle(.shield) }
                    }
                }

                Spacer(minLength: 6)

                // BJ6 (founder 10-03: "sign in at the top should be closer to the question mark"):
                // the right-hand controls are ONE right-aligned group with the same visual gap
                // between every control — [SIGN IN] [?] [gear] for guests, [Share] [?] [gear] on
                // Home once there's something to share. No reserved invisible slots: an absent
                // control simply drops out. Each icon keeps its 44-pt tap area (it overhangs its
                // hugging layout box); the gear stays where it was.
                HStack(spacing: Self.groupGap) {
                    // Guest — prominent Sign In entry (account tabs also prompt, but the
                    // Home header had no entry). Presents the sign-in sheet.
                    if auth.isGuest {
                        // A hugging pill gives the bubble lettering no width to fit against (it shrank to a speck):
                        // give the label its own width.
                        Button { showAuth = true } label: { CandyLabel(title: "Sign In").frame(width: 78) }
                            .buttonStyle(CastButtonStyle(size: .small, fullWidth: false))
                    }
                    if let share, share.visible {
                        groupIcon(.share, label: "Share today's progress", action: share.action)
                    }
                    // BI25: single-fire — a double tap (or a tap while a sheet is on its
                    // way) can't open and then close it; the sheet builds light and
                    // presents on the tap frame (heavy pieces load after it lands).
                    groupIcon(.help, label: "Help") { openSheet { showMenu = true } }
                    groupIcon(.gear, label: "Settings") { openSheet { showSettings = true } }
                }
                .padding(.trailing, (HeaderControl.tap - HeaderControl.icon) / 2)
                .frame(minHeight: HeaderControl.tap)
            }
            .padding(.horizontal, 8)
            .padding(.top, 2)

            if let scroll {
                CondensingCast(model: scroll, pro: auth.isProActive)
            } else {
                LivingCastHeader(pro: auth.isProActive)
            }
        }
        .padding(.bottom, 2)
        .streakBumpFeedback(auth.headerStreak)                      // §U: streak +1
        .softSheet(isPresented: $showMenu, onDismiss: { if let s = menuSelection { menuDest = s; menuSelection = nil } }) {
            MenuSheet(selection: $menuSelection).presentationDetents([.large])
        }
        .softSheet(item: $menuDest) { infoMenuDestinationView($0).presentationDetents([.large]) }
        .softSheet(isPresented: $showSettings) { SettingsView() }
        .softSheet(isPresented: $showAuth) { AuthView() }
    }

    /// BI25: the help / gear taps fire once (SettingsPreviews.sheetTapFires, unit tested).
    private func openSheet(_ open: () -> Void) {
        let now = Date()
        let presenting = showMenu || showSettings || showAuth || menuDest != nil
        guard SettingsPreviews.sheetTapFires(at: now, lastFire: lastSheetTap, presenting: presenting) else { return }
        lastSheetTap = now
        open()
    }

    private func toggle(_ p: HeaderPop) {
        popups.toggle(p)
    }

    // MARK: - Controls (§A3)

    /// A bare 3D icon (23 pt) + its soft number (17 pt) in a 44-pt tap area.
    private func statControl(_ icon: Icon3DName, value: Int, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Icon3D(icon, size: HeaderControl.icon)
                    .shadow(color: Color(hex: 0x4C1D95).opacity(0.18), radius: 2.5, x: 0, y: 3)
                Text("\(value)").softNumber(17)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .fixedSize()
            .padding(.horizontal, 6)
            .frame(minHeight: HeaderControl.tap)
            .contentShape(Rectangle())
            .modifier(CounterPop(value: value))   // 2.8 item 7: the counter pops + glows the moment it grows
        }
        .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23
        .accessibilityLabel(label)
    }

    /// BJ6: the right group's gap between visual edges.
    static let groupGap: CGFloat = 10

    /// A right-group icon: laid out at its visual width (so the group's gaps are even) with
    /// its full 44-pt tap area overhanging the layout box.
    private func groupIcon(_ icon: Icon3DName, label: String, action: @escaping () -> Void) -> some View {
        iconControl(icon, label: label, action: action)
            .frame(width: HeaderControl.icon, height: HeaderControl.tap)
    }

    /// A bare 3D icon (23 pt) in a 44-pt tap area.
    private func iconControl(_ icon: Icon3DName, label: String, action: @escaping () -> Void) -> some View {
        HeaderCircleButton(.icon(icon), size: HeaderControl.tap, label: label, action: action)
    }

}

/// One §C5 popup: a colored header (gradient, the big 3D icon, a headline and a
/// subline, the host pose peeking at the right), then its body on a soft tint.
struct PopCard<Body: View>: View {
    let tint: Color
    let header: [Color]
    let icon: Icon3DName
    let title: String
    let subtitle: String
    let host: MascotID
    let hostPose: String
    /// FINISH_SPEC BJ16: the headline as moment lettering (STREAK! / FLAWLESS!); `title` stays its label.
    var titleArt: String? = nil
    @ViewBuilder var content: () -> Body

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 24, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Icon3D(icon, size: 58)
                    .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 4)
                VStack(alignment: .leading, spacing: 1) {
                    if let titleArt, ArtAsset.exists(titleArt) {
                        ArtThumbs.image(titleArt, points: 150)
                            .resizable().interpolation(.high).scaledToFit()
                            .frame(maxWidth: 150, maxHeight: 36, alignment: .leading)
                            .accessibilityLabel(title)
                            .accessibilityAddTraits(.isHeader)
                    } else {
                    Text(title).font(Brand.font(21, .black)).foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.12), radius: 0, x: 0, y: 2)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
                    }
                    Text(subtitle).font(Brand.font(12, .heavy)).foregroundStyle(.white.opacity(0.9))
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.trailing, 70)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LinearGradient(colors: header, startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(alignment: .bottomTrailing) {
                PoseImage(host, hostPose, height: 74)
                    .padding(.trailing, 8)
                    .offset(y: 6)
            }
            .zIndex(1)

            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .padding(.bottom, 14)
        }
        .background(tint)
        .clipShape(shape)
        .shadow(color: Color(hex: 0x280F50).opacity(0.35), radius: 20, x: 0, y: 18)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - The living cast header (FINISH_SPEC §A5)

/// The ten cast heroes (`mascot-<id>`) in a row spelling WORDOCIOUS, edge to edge
/// (§A5 option A; game-kit.html `.castrow`): each figure is its own image, every
/// other one sits a touch higher, and every 2.6–5 s ONE random character (never the
/// same twice in a row) plays its personality move — O1 spins, W hops, R nods off,
/// D double-bounces, O2 star-pulses, C leans in, I wiggles, O3 jumps, U levitates,
/// S dashes (keyframes in core `CastMoves`). Off with Reduce Motion (the OS
/// setting or the in-app toggle). Pro: W wears the gold crown. Decorative; the row
/// reads "Wordocious" as the header.
///
/// The musical cast easter egg (docs/cloud-prompts/10, core `MusicalCast`; behind `musicalOn` — DEBUG builds only
/// until the founder approves): a long-press on any figure turns all ten "musical" with a squash-and-pop rippling out
/// from it (a soft gold glow, a little note badge); then a tap plays that hero's scale note in its own voice (W O R D
/// O C I O U S = C4 … E5) + a selection haptic + a small hop (no laugh) + a floating note (visual even with Sound
/// off), and playing a known tune unlocks its secret achievement. Long-press again → back to the laughs. Reduce
/// Motion = an instant swap (no pop, the notes fade in place). Halloween costumes keep their costume + the music touch.
struct LivingCastHeader: View {
    var pro: Bool

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var active: ActiveMove?
    /// FINISH_SPEC §F2 fix: hidden while the cold-start intro runs; reports its
    /// frames to the intro; plays the landing flourish.
    @ObservedObject private var handoff = CastHandoff.shared
    @Environment(\.pageTint) private var pageTint
    /// FINISH_SPEC §X: re-render when the admin season preview flips (CastSkin reads it).
    @AppStorage(CastSkin.debugKey) private var debugSeason = ""
    /// FINISH_SPEC §AA1: the crown's "You're Pro" sheet.
    @State private var showProSheet = false
    /// Perf audit: the row is on screen (its tab is selected). Off-screen tabs and the
    /// pages under a game cover rest their personality moves (60 fps row redraws).
    @State private var onScreen = false
    /// 2.7.1 cast puppets: when each character's signature move / last tap started.
    @State private var puppetGesture: [MascotID: Date] = [:]
    @State private var puppetTap: [MascotID: Date] = [:]
    /// The puppets' wall clock (breathing, blinks, idle sways).
    @State private var puppetClock = Date()

    // The musical cast (see above).
    /// The musicalCast flag: on in DEBUG, off in release (core MusicalCast.enabled).
    static let musicalOn: Bool = {
        #if DEBUG
        return MusicalCast.enabled(isDebugBuild: true)
        #else
        return MusicalCast.enabled(isDebugBuild: false)
        #endif
    }()
    /// Item 4b: the app-wide musical state + melody buffer (MusicalCastStore), so every header — and a header that
    /// remounts on a tab switch or push — shows the same mode until a long-press flips it. Never persisted.
    @ObservedObject private var musicalStore = MusicalCastStore.shared
    private var musical: Bool { musicalStore.musical }
    /// The last transform's start (nil once every pop has played) and the figure it rippled out from.
    @State private var musicalAt: Date?
    @State private var musicalFrom: MascotID = .w
    /// When each musical figure's note hop started (transform-only: no laughing face).
    @State private var noteTap: [MascotID: Date] = [:]
    /// The floating notes in flight (at most `maxFloats`).
    @State private var floats: [MusicalFloat] = []
    @State private var floatSeq = 0
    /// This touch's start and the last long-press: a touch that toggled the mode never also taps.
    @State private var pressBegan: Date?
    @State private var lastLongPress: Date?
    static let maxFloats = 12
    /// The ripple delays (ms, WORDOCIOUS order) from each pressed figure, worked out once (core transformDelays).
    static let rippleDelays: [MascotID: [Int]] = Dictionary(uniqueKeysWithValues: Mascots.cast.map {
        ($0, MusicalCast.transformDelays(pressed: $0.rawValue, reduceMotion: false))
    })
    /// The ripple delay (ms) of figure `i` when the transform starts at `from`.
    static func rippleDelay(_ i: Int, from: MascotID) -> Int {
        guard let d = rippleDelays[from], d.indices.contains(i) else { return 0 }
        return d[i]
    }
    /// The note hop: a half-strength pop this long.
    static let noteHopSeconds = 0.3

    private struct ActiveMove: Equatable {
        let id: MascotID
        let start: Date
    }

    /// Each character's visible width as a fraction of its square art (the art is
    /// 512 px with transparent sides; I is the narrow one), so the row packs by
    /// what you see rather than by the squares.
    static let visibleWidth: [MascotID: CGFloat] = [
        .w: 0.92, .o1: 0.92, .r: 0.80, .d: 0.92, .o2: 0.76,
        .c: 0.86, .i: 0.44, .o3: 0.91, .u: 0.92, .s: 0.92,
    ]
    /// The overlap between neighbors (the mockup's −2.2% margin), as a share of a figure.
    static let overlap: CGFloat = 0.05
    /// Every other figure sits this much higher (the mockup's 7 px on a 393-pt row).
    static let stagger: CGFloat = 7
    /// FINISH_SPEC §N3: the row spans ≈90% of the screen width, centered (not edge to edge).
    static let widthShare: CGFloat = 0.90
    /// The row's side inset (the 5% each side left by the 90% row).
    static var inset: CGFloat { UIScreen.main.bounds.width * (1 - widthShare) / 2 }
    /// §N3: breathing room under the status bar.
    static let topMargin: CGFloat = 9

    /// The figure size that spans the row's 90% width.
    static var figure: CGFloat {
        let units = Mascots.cast.reduce(CGFloat(0)) { $0 + (visibleWidth[$1] ?? 1) }
            - CGFloat(Mascots.cast.count - 1) * overlap
        return max(28, (UIScreen.main.bounds.width - inset * 2) / units)
    }

    /// The header's height: the top margin, the figures, the stagger and the crown's room. Founder 10-09: the crown's
    /// room is ALWAYS reserved — Pro resolves a beat after launch, and growing the header then shoved the whole Home
    /// page down ~8 pt on every cold start. (`pro` is kept for callers.)
    static func height(pro: Bool) -> CGFloat {
        let s = figure
        return topMargin + s + stagger + s * 0.22
    }

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    /// 2.7.1: the rigs play out of season only (they are cut from the plain heroes; the
    /// costumes keep their images + a transform-only tap hop). Off if the bundle fails.
    private var puppetsOn: Bool { CastSkin.season == nil && CastPuppets.shared.bundle != nil }

    /// A tap or a signature move is playing (full frame rate); else the puppets breathe at 15 fps.
    private func puppetBusy(_ now: Date) -> Bool {
        if musicalBusy(now) { return true }
        let tapDur = CastPuppets.shared.bundle?.tap.dur ?? 1
        if puppetTap.values.contains(where: { now.timeIntervalSince($0) < tapDur }) { return true }
        return puppetGesture.contains { id, start in now.timeIntervalSince(start) < (CastPuppets.shared.rig(id)?.gestureSeconds ?? 0) }
    }

    private var timelinePaused: Bool {
        let now = Date()
        if puppetsOn {
            if !onScreen || handoff.introRunning { return true }
            // Reduce Motion / Low Power: hold still; a tap still fades the laughing face.
            if still || Motion.lowPower { return !puppetBusy(now) && handoff.flourishStart == nil }
            return false
        }
        return (active == nil && handoff.flourishStart == nil && !puppetBusy(now)) || still
    }

    var body: some View {
        let s = Self.figure
        let busy = puppetBusy(Date())
        TimelineView(.animation(minimumInterval: puppetsOn && !busy && handoff.flourishStart == nil ? 1 / 30 : 1 / 60, paused: timelinePaused)) { ctx in
            row(s, now: ctx.date)
                // Perf audit: ONE soft shadow pass for the row (was one offscreen pass per figure).
                .compositingGroup()
                .shadow(color: Color(hex: 0x3C1E6E).opacity(0.18), radius: 2, x: 0, y: 3)
        }
        // §F2 fix step 1: hidden (still laid out) while the intro runs; shown in the
        // same frame the intro row is removed.
        .opacity(handoff.introRunning ? 0 : 1)
        .onPreferenceChange(CastFramesKey.self) { frames in
            if handoff.introRunning { handoff.frames = frames }
        }
        .frame(maxWidth: .infinity)
        .frame(height: Self.height(pro: pro), alignment: .bottom)
        // §N3: a soft elliptical ground shadow under the row (the page accent at ~14%, blurred).
        .background(alignment: .bottom) {
            Ellipse()
                .fill(pageTint.accent.opacity(Theme.isDark ? 0.22 : 0.14))
                .frame(height: s * 0.26)
                .padding(.horizontal, s * 0.2)
                .blur(radius: 7)
                .offset(y: s * 0.06)
                .opacity(handoff.introRunning ? 0 : 1)
                .allowsHitTesting(false)
        }
        .padding(.horizontal, Self.inset)
        // §AA1: only W's crown takes touches (each figure turns hit-testing off, and
        // the row's containers have no content shape), so the page under the row
        // still gets every other tap.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(pro ? "Wordocious Pro" : "Wordocious")
        .accessibilityAddTraits(.isHeader)
        .modifier(ProCrownAccessibility(pro: pro) { showProSheet = true })
        .softSheet(isPresented: $showProSheet) { ProMemberSheet() }
        .onChange(of: debugSeason) { _ in CastSkin.invalidate() }
        .onChange(of: musicalStore.flipped) { rippleToggle($0) }
        .onAppear { onScreen = true }
        .onDisappear { onScreen = false }
        .task { await runMoves() }
        // 2.8 item 13: when your mascot celebrates a Sweep / Flawless the whole cast hops with it (the living mascot switch gates
        // the post itself; Reduce Motion / Low Power: nothing).
        .onReceive(NotificationCenter.default.publisher(for: .mascotMoment)) { note in
            if let kind = note.userInfo?["kind"] as? String { cheerCast(kind) }
        }
    }

    /// A quick ripple of hops across the cast (every third also plays its signature move on the rig).
    private func cheerCast(_ kind: String) {
        guard kind == "sweep" || kind == "flawless", onScreen, !still, !Motion.lowPower, FlagsService.shared.isLive("cast_cheer") else { return }
        let dur = CastPuppets.shared.bundle?.tap.dur ?? 1
        for (i, m) in Mascots.cast.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.07) {
                let now = Date()
                puppetTap[m] = now
                if puppetsOn, i % 3 == 0, puppetGesture[m] == nil { startGesture(m, at: now) }
                DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.05) { if puppetTap[m] == now { puppetTap[m] = nil } }
            }
        }
    }

    private func row(_ s: CGFloat, now: Date) -> some View {
        HStack(alignment: .bottom, spacing: -s * Self.overlap) {
            ForEach(0..<Mascots.cast.count, id: \.self) { i in
                figure(i, s: s, now: now)
            }
        }
    }

    private func figure(_ i: Int, s: CGFloat, now: Date) -> some View {
        let m = Mascots.cast[i]
        let vis: CGFloat = Self.visibleWidth[m] ?? 1
        let moving = active?.id == m
        let flourish = handoff.flourishStart.map { CastMoves.flourishPose(index: i, elapsed: now.timeIntervalSince($0)) }
        let pose: CastPose = flourish ?? (moving ? CastMoves.pose(m.rawValue, elapsed: now.timeIntervalSince(active?.start ?? now)) : .identity)
        let spec = flourish != nil ? CastMoves.moves["w"] : CastMoves.moves[m.rawValue]
        let anchor = UnitPoint(x: spec?.anchor.x ?? 0.5, y: spec?.anchor.y ?? 0.85)
        let skew = CGFloat(tan(pose.skewX * .pi / 180))
        // §X: the season's skin (Halloween) when one is active, else the hero image.
        // Perf audit: the display-size bitmap (the 512 px hero was scaled every frame).
        // 2.7.1: the puppet (out of season), else the season skin's image with the tap hop.
        let tapPose = puppetsOn ? (hop: 0.0, sq: 0.0) : seasonTapPose(m, now: now)
        // The musical cast: the transform's squash-and-pop (rippling from the pressed figure) and a note's hop.
        let mpop = musicalPose(i, m, now: now)
        let hopY: CGFloat = CGFloat(tapPose.hop) * 0.53 * s / 512 - CGFloat(mpop.lift) / 100 * s
        // Each figure's glow + badge switch on (and off) partway through its own pop — the ripple.
        let touchDelay: Double = still ? 0
            : Double(Self.rippleDelay(i, from: musicalFrom) + MusicalTiming.popMs * 2 / 5) / 1000
        let touchW: CGFloat = s * max(vis, 0.7)
        return figureArt(m, s: s, now: now)
            .frame(width: s, height: s)
            // §F2 fix step 2: the figure's square on screen, for the intro to land on.
            .background(GeometryReader { g in
                Color.clear.preference(key: CastFramesKey.self, value: [m: g.frame(in: .global)])
            })
            .frame(width: s * vis)
            .background {
                if Self.musicalOn { MusicalGlow(on: musical, delay: touchDelay, still: still, width: s * vis * 1.16, height: s * 0.96).offset(y: s * 0.06) }
            }
            .overlay(alignment: .topTrailing) {
                // TODO(art): art-cast-musical-<id> — the hero's ChatGPT musical costume art replaces this code-drawn badge.
                if Self.musicalOn {
                    MusicalBadge(on: musical, delay: touchDelay, still: still, width: touchW * 0.3)
                        .padding(.top, s * 0.04).padding(.trailing, s * vis * 0.02)
                }
            }
            .allowsHitTesting(false)
            // 2.7.1: tap a character → hop + laugh (its signature move too), a light haptic.
            // The musical cast: a long-press toggles musical mode; in it, the touch-down sings the note.
            .overlay {
                Color.clear.contentShape(Rectangle())
                    .onTapGesture { tapPuppet(m) }
                    .modifier(MusicalPress(enabled: Self.musicalOn,
                                           onPressing: { musicalPressing(m, $0) },
                                           onLong: { toggleMusical(from: m) }))
            }
            .overlay(alignment: .top) {
                if pro && m == .w {
                    // §AA1: W's crown (the gold sprite, tilted ~-8°, a twinkle every ~8 s),
                    // ~45% of W's width, sitting on its top edge. It rides inside W's
                    // transforms below, so it hops / moves / flourishes with W.
                    CastCrown(size: s * 0.92 * 0.45, still: still || Motion.lowPower) { showProSheet = true }
                        .offset(y: s * 0.115 - s * 0.92 * 0.45 * 0.72 + puppetCrownHop(s: s, now: now))
                }
            }
            .scaleEffect(x: CGFloat(1 - tapPose.sq * 0.6), y: CGFloat(1 + tapPose.sq), anchor: UnitPoint(x: 0.5, y: 0.94))
            .scaleEffect(x: CGFloat(mpop.sx), y: CGFloat(mpop.sy), anchor: UnitPoint(x: 0.5, y: 0.94))
            .offset(y: hopY)
            .scaleEffect(x: CGFloat(pose.sx), y: CGFloat(pose.sy), anchor: anchor)
            .rotationEffect(.degrees(pose.rotation), anchor: anchor)
            .transformEffect(CGAffineTransform(a: 1, b: 0, c: skew, d: 1, tx: -skew * s * anchor.y, ty: 0))
            .offset(x: CGFloat(pose.tx) * s * vis, y: CGFloat(pose.ty) * s)
            // The musical cast's floating notes (rise + fade; fade in place under Reduce Motion).
            .overlay(alignment: .topLeading) {
                if Self.musicalOn { floatsLayer(m, s: s, vis: vis, noteW: touchW * 0.32) }
            }
            .padding(.bottom, i % 2 == 1 ? Self.stagger : 0)
            .zIndex(moving || puppetFront(m, now) ? 20 : Double(Mascots.cast.count - i))
    }

    // MARK: 2.7.1 cast puppets

    @ViewBuilder
    private func figureArt(_ m: MascotID, s: CGFloat, now: Date) -> some View {
        if puppetsOn, let bundle = CastPuppets.shared.bundle, let rig = CastPuppets.shared.rig(m) {
            let gr = puppetGesture[m].map { now.timeIntervalSince($0) }
            let tap = puppetTap[m].map { now.timeIntervalSince($0) }
            CastPuppetCanvas(
                id: m.rawValue, rig: rig, bundle: bundle, size: s,
                t: now.timeIntervalSince(puppetClock),
                gr: gr.flatMap { $0 < rig.gestureSeconds ? $0 : nil },
                tap: tap.flatMap { $0 < bundle.tap.dur ? $0 : nil },
                still: still || Motion.lowPower
            )
        } else {
            // §X: the season's skin (Halloween) when one is active, else the hero image.
            // Perf audit: the display-size bitmap (the 512 px hero was scaled every frame).
            ArtThumbs.image(CastSkin.assetName(for: m), points: s).resizable().interpolation(.high).scaledToFit()
        }
    }

    /// The puppet W hops inside his canvas: his crown rides the same hop (points).
    private func puppetCrownHop(s: CGFloat, now: Date) -> CGFloat {
        guard puppetsOn, !still, !Motion.lowPower, let start = puppetTap[.w],
              let b = CastPuppets.shared.bundle, let rig = CastPuppets.shared.rig(.w) else { return 0 }
        return CGFloat(b.tap.pose(now.timeIntervalSince(start)).hop * rig.mascot.s) * s / 512
    }

    /// In season: the costume's transform-only tap hop (squash + stretch, no face swap).
    private func seasonTapPose(_ m: MascotID, now: Date) -> (hop: Double, sq: Double) {
        guard !still, let start = puppetTap[m], let tap = CastPuppets.shared.bundle?.tap else { return (0, 0) }
        return tap.pose(now.timeIntervalSince(start))
    }

    /// A character mid-move or mid-hop draws over its neighbors (raised arms).
    private func puppetFront(_ m: MascotID, _ now: Date) -> Bool {
        if let t = puppetTap[m], now.timeIntervalSince(t) < (CastPuppets.shared.bundle?.tap.dur ?? 1) { return true }
        if let g = puppetGesture[m], now.timeIntervalSince(g) < (CastPuppets.shared.rig(m)?.gestureSeconds ?? 0) { return true }
        return false
    }

    private func tapPuppet(_ m: MascotID) {
        if Self.musicalOn {
            // This touch long-pressed (the mode toggled): no tap after it.
            if let long = lastLongPress, let began = pressBegan, long >= began { return }
            if musical {
                // The note sang on touch-down (musicalPressing); only if that never fired for this touch, sing now.
                if pressBegan.map({ Date().timeIntervalSince($0) > 1.5 }) ?? true { playNote(m) }
                return
            }
        }
        let now = Date()
        puppetTap[m] = now
        let rigOn = puppetsOn && !still && !Motion.lowPower
        if rigOn, puppetGesture[m] == nil { startGesture(m, at: now) }
        Haptics.light()
        SoundManager.shared.castLaugh(m.rawValue)
        let dur = CastPuppets.shared.bundle?.tap.dur ?? 1
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((dur + 0.05) * 1_000_000_000))
            if puppetTap[m] == now { puppetTap[m] = nil }
        }
    }

    private func startGesture(_ m: MascotID, at now: Date) {
        guard let secs = CastPuppets.shared.rig(m)?.gestureSeconds, secs > 0 else { return }
        puppetGesture[m] = now
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((secs + 0.05) * 1_000_000_000))
            if puppetGesture[m] == now { puppetGesture[m] = nil }
        }
    }

    // MARK: The musical cast (docs/cloud-prompts/10)

    /// A transform pop or a note hop is playing (the row runs at full frame rate meanwhile).
    private func musicalBusy(_ now: Date) -> Bool {
        guard Self.musicalOn else { return false }
        if let at = musicalAt,
           now.timeIntervalSince(at) < Double(MusicalCast.transformDuration(pressed: musicalFrom.rawValue, reduceMotion: false)) / 1000 { return true }
        return noteTap.values.contains { now.timeIntervalSince($0) < Self.noteHopSeconds }
    }

    /// Figure `i`'s musical pose: its transform pop (after its ripple delay) times its note hop (half strength).
    private func musicalPose(_ i: Int, _ m: MascotID, now: Date) -> MusicalPopKey {
        guard Self.musicalOn, !still else { return MusicalPopKey(t: 0, sx: 1, sy: 1, lift: 0) }
        var sx = 1.0, sy = 1.0, lift = 0.0
        if let at = musicalAt {
            let delay = Double(Self.rippleDelay(i, from: musicalFrom))
            let p = MusicalCast.popPose((now.timeIntervalSince(at) * 1000 - delay) / Double(MusicalTiming.popMs))
            sx *= p.sx; sy *= p.sy; lift += p.lift
        }
        if let start = noteTap[m] {
            let p = MusicalCast.popPose(now.timeIntervalSince(start) / Self.noteHopSeconds)
            sx *= 1 + (p.sx - 1) / 2; sy *= 1 + (p.sy - 1) / 2; lift += p.lift / 2
        }
        return MusicalPopKey(t: 0, sx: sx, sy: sy, lift: lift)
    }

    /// Long-press: flip the shared mode (every mounted header changes over together, see `rippleToggle`).
    private func toggleMusical(from m: MascotID) {
        lastLongPress = Date()
        Haptics.medium()
        musicalStore.toggle(from: m)
    }

    /// The shared mode flipped (here or on another mounted header): all ten change over, rippling out from the
    /// pressed figure (an instant swap under Reduce Motion).
    private func rippleToggle(_ flip: MusicalCastStore.Flip?) {
        guard let flip else { return }
        musicalFrom = flip.from
        guard !still else { musicalAt = nil; return }
        let now = flip.at
        musicalAt = now
        let secs = Double(MusicalCast.transformDuration(pressed: flip.from.rawValue, reduceMotion: false)) / 1000
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((secs + 0.05) * 1_000_000_000))
            if musicalAt == now { musicalAt = nil }
        }
    }

    /// Touch-down on a figure: in musical mode the note sings right away (a melody needs the beat on the press).
    private func musicalPressing(_ m: MascotID, _ pressing: Bool) {
        guard pressing else { return }
        pressBegan = Date()
        if musical { playNote(m) }
    }

    /// One note: the voice (silent with Sound off), a selection haptic, the hop (no laugh), a floating note, and the
    /// melody matcher — a finished tune unlocks its secret achievement (signed-in players; guests nothing).
    private func playNote(_ m: MascotID) {
        SoundManager.shared.castNote(m.rawValue)
        Haptics.selection()
        let now = Date()
        if !still {
            noteTap[m] = now
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64((Self.noteHopSeconds + 0.05) * 1_000_000_000))
                if noteTap[m] == now { noteTap[m] = nil }
            }
        }
        if floats.count < Self.maxFloats {
            floatSeq += 1
            let f = MusicalFloat(id: floatSeq, cast: m, drift: CGFloat.random(in: -40...40),
                                 color: MusicalFloat.colors[floatSeq % MusicalFloat.colors.count])
            floats.append(f)
            let life = still ? MusicalFloatView.stillLife : MusicalFloatView.life
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64((life + 0.05) * 1_000_000_000))
                floats.removeAll { $0.id == f.id }
            }
        }
        // Item 49: season-aware, so the Halloween tunes only count in season (and sound with the spooky voicing).
        let r = MusicalCast.tap(musicalStore.melody, castId: m.rawValue, atMs: ProcessInfo.processInfo.systemUptime * 1000,
                                season: SeasonKit.current?.id)
        musicalStore.melody = r.state
        if let tune = r.matched {
            let key = tune.achievement
            Task { await AchievementService.unlockTune(key) }
        }
    }

    /// The floats rising off figure `m` (the web's .cm-float: 30% in, 10% down, 32% of the figure wide).
    private func floatsLayer(_ m: MascotID, s: CGFloat, vis: CGFloat, noteW: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(floats.filter { $0.cast == m }) { f in
                MusicalFloatView(width: noteW, drift: f.drift, color: Color(hex: f.color), still: still)
            }
        }
        .offset(x: s * vis * 0.3, y: s * 0.1)
        .allowsHitTesting(false)
    }

    /// One move at a time: wait, pick a character (never the last one), play its
    /// move, rest 2.6–5 s from the move's start, repeat. Cancelled with the view.
    private func runMoves() async {
        try? await Task.sleep(nanoseconds: UInt64(CastMoves.firstDelay * 1_000_000_000))
        var last: String?
        while !Task.isCancelled {
            // No personality moves under the intro or its landing flourish.
            // §AD: Low Power Mode also rests the idle moves (checked each round, so it's live).
            if still || Motion.lowPower || handoff.introRunning || handoff.flourishStart != nil
                || !onScreen || ChromeVisibility.shared.bottomNavHidden {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                continue
            }
            if puppetsOn {
                // 2.7.1: one signature move every 6–10 s (never the same character twice
                // in a row, never over another move or a tapped character's own).
                var playing = 0.0
                if puppetGesture.isEmpty {
                    let pool = Mascots.cast.filter { $0.rawValue != last }
                    if let m = pool.randomElement() {
                        last = m.rawValue
                        startGesture(m, at: Date())
                        playing = CastPuppets.shared.rig(m)?.gestureSeconds ?? 0
                    }
                }
                // 6–10 s of rest after the move ends (the idle cast breathes at 15 fps).
                try? await Task.sleep(nanoseconds: UInt64((playing + Double.random(in: 6...10)) * 1_000_000_000))
                continue
            }
            let id = CastMoves.pick(after: last)
            last = id
            let duration = CastMoves.duration(id)
            let gap = CastMoves.interval(unit: Double.random(in: 0...1))
            if let m = MascotID(rawValue: id) { active = ActiveMove(id: m, start: Date()) }
            // BI7: idle moves are silent — no sound the player didn't cause (founder 10-02).
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            active = nil
            try? await Task.sleep(nanoseconds: UInt64(max(0.2, gap - duration) * 1_000_000_000))
        }
    }
}

/// §AA1: the header reads as one element ("Wordocious Pro"); for Pro it also offers
/// the crown's action so VoiceOver can open the membership sheet.
private struct ProCrownAccessibility: ViewModifier {
    let pro: Bool
    let open: () -> Void

    func body(content: Content) -> some View {
        if pro {
            content.accessibilityAction(named: "Show Pro membership", open)
        } else {
            content
        }
    }
}

// MARK: - The musical cast (docs/cloud-prompts/10)

/// The long-press that toggles musical mode (MusicalTiming: 0.55 s, a 10-pt slop) beside the figure's existing tap;
/// `onPressing(true)` is the touch-down (a musical tap sings then). Off (no gesture at all) when the flag is off.
private struct MusicalPress: ViewModifier {
    let enabled: Bool
    let onPressing: (Bool) -> Void
    let onLong: () -> Void

    func body(content: Content) -> some View {
        if enabled {
            content.onLongPressGesture(minimumDuration: Double(MusicalTiming.longPressMs) / 1000,
                                       maximumDistance: CGFloat(MusicalTiming.moveSlop),
                                       perform: onLong,
                                       onPressingChanged: onPressing)
        } else {
            content
        }
    }
}

/// One floating note in flight.
struct MusicalFloat: Identifiable, Equatable {
    let id: Int
    let cast: MascotID
    /// Sideways drift, % of the note's width (−40…40).
    let drift: CGFloat
    let color: UInt

    /// The cast candy colors (web NOTE_COLORS), cycled per tap.
    static let colors: [UInt] = [0x7C3AED, 0xEC4899, 0xF59E0B, 0x0EA5E9, 0x22C55E]
}

/// A floating note: pops in, rises and fades (opacity + transform only); under Reduce Motion it fades in place.
struct MusicalFloatView: View {
    let width: CGFloat
    let drift: CGFloat
    let color: Color
    let still: Bool
    /// 0 = just born, 1 = up and opaque, 2 = gone.
    @State private var phase = 0

    static let life: Double = 1.1
    static let stillLife: Double = 0.6

    var body: some View {
        let h = width * 1.2
        let x: CGFloat = still ? 0 : (phase == 0 ? 0 : phase == 1 ? drift / 300 * width : drift / 100 * width)
        let y: CGFloat = still ? 0 : (phase == 0 ? 0 : phase == 1 ? -0.6 * h : -2.2 * h)
        let scale: CGFloat = still ? 1 : (phase == 0 ? 0.5 : phase == 1 ? 1 : 0.9)
        MusicNoteGlyph(color: color)
            .frame(width: width, height: h)
            .scaleEffect(scale)
            .rotationEffect(.degrees(still || phase < 2 ? 0 : Double(drift / 3)))
            .offset(x: x, y: y)
            .opacity(phase == 1 ? 1 : 0)
            .onAppear {
                let rise = (still ? Self.stillLife : Self.life) * 0.25
                withAnimation(.easeOut(duration: rise)) { phase = 1 }
                DispatchQueue.main.asyncAfter(deadline: .now() + rise) {
                    withAnimation(.easeIn(duration: (still ? Self.stillLife : Self.life) - rise)) { phase = 2 }
                }
            }
    }
}

/// The soft gold radial glow behind a musical figure (web .cm-glow), on after the figure's ripple delay.
private struct MusicalGlow: View {
    let on: Bool
    let delay: Double
    let still: Bool
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        Ellipse()
            .fill(EllipticalGradient(stops: [
                .init(color: Color(hex: 0xFDE047).opacity(0.55), location: 0),
                .init(color: Color(hex: 0xFDE047).opacity(0), location: 0.72),
            ], center: .center, startRadiusFraction: 0, endRadiusFraction: 0.5))
            .frame(width: width, height: height)
            .opacity(on ? 1 : 0)
            .animation(still ? nil : .easeOut(duration: 0.26).delay(delay), value: on)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// The little note badge on a musical figure's shoulder (web .cm-note), popping in after its ripple delay.
/// TODO(art): art-cast-musical-<id> — the ChatGPT musical costume art slots in per hero here.
private struct MusicalBadge: View {
    let on: Bool
    let delay: Double
    let still: Bool
    let width: CGFloat

    var body: some View {
        MusicNoteGlyph(color: Color(hex: 0x7C3AED))
            .frame(width: width, height: width * 1.2)
            .shadow(color: Color(hex: 0x3C1E6E).opacity(0.3), radius: 1, x: 0, y: 1)
            .scaleEffect(on ? 1 : 0.3)
            .opacity(on ? 1 : 0)
            .animation(still ? nil : .spring(response: 0.32, dampingFraction: 0.55).delay(delay), value: on)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// A drawn eighth-note pair (web NOTE_SVG; never an emoji): two stems under a slanted beam, two tilted heads.
/// Laid out in a 20 × 24 box.
struct MusicNoteGlyph: View {
    let color: Color

    var body: some View {
        GeometryReader { g in
            let kx = g.size.width / 20
            let ky = g.size.height / 24
            ZStack(alignment: .topLeading) {
                NoteStems().fill(color)
                ForEach(0..<2, id: \.self) { k in
                    let cx: CGFloat = k == 0 ? 13.9 : 7.3
                    let cy: CGFloat = k == 0 ? 15.8 : 18.3
                    Ellipse().fill(color)
                        .frame(width: 7.2 * kx, height: 6 * ky)
                        .rotationEffect(.degrees(-20))
                        .position(x: cx * kx, y: cy * ky)
                }
            }
        }
    }

    /// The beam and both stems (20 × 24 units).
    private struct NoteStems: Shape {
        func path(in r: CGRect) -> Path {
            let kx = r.width / 20, ky = r.height / 24
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * kx, y: r.minY + y * ky) }
            var path = Path()
            path.move(to: p(8, 3))
            path.addLine(to: p(17, 1))
            path.addLine(to: p(17, 15.5))
            path.addLine(to: p(14.6, 15.5))
            path.addLine(to: p(14.6, 5.3))
            path.addLine(to: p(10.4, 6.2))
            path.addLine(to: p(10.4, 18))
            path.addLine(to: p(8, 18))
            path.closeSubpath()
            return path
        }
    }
}

// MARK: - 2.7.1 Cast puppets

/// The rig bundle (`cast-rigs` data asset) and each layer (`rig-<id>-<layer>` image sets),
/// written by docs/design/brand/animation/rig-engine/ship-rigs.py — the same data web and
/// Android read (WordociousCore `CastRig`, CastRigTests). `bundle` is nil (→ the static
/// hero images) if anything is missing, or with the QA / perf A-B switch
/// `-debug-no-puppets YES`.
@MainActor
final class CastPuppets {
    static let shared = CastPuppets()

    let bundle: CastRigBundle?
    private var rigs: [MascotID: CastRig] = [:]
    /// Layers pre-scaled to the size they are drawn at (key: id/layer/pixel scale).
    private var scaled: [String: Image] = [:]

    private init() {
        #if DEBUG
        // perf A-B: `perf-tour.sh --flag noPuppets` measures the static row.
        if PerfTour.flag("noPuppets") { bundle = nil; return }
        #endif
        guard !UserDefaults.standard.bool(forKey: "debug-no-puppets"),
              let data = NSDataAsset(name: "cast-rigs")?.data,
              let b = try? CastRigBundle.decode(data) else { bundle = nil; return }
        var rigs: [MascotID: CastRig] = [:]
        for m in Mascots.cast {
            guard let r = b.rigs[m.rawValue],
                  r.lay.keys.allSatisfy({ UIImage(named: "rig-\(m.rawValue)-\($0)") != nil }) else { bundle = nil; return }
            rigs[m] = r
        }
        self.rigs = rigs
        bundle = b
    }

    func rig(_ m: MascotID) -> CastRig? { rigs[m] }

    /// The layer drawn at `heroToPoints` (points per hero px), rendered once at that size.
    func image(_ id: String, _ layer: String, box: CastRigBox, heroToPoints k: CGFloat) -> Image? {
        let key = "\(id)/\(layer)/\(Int((k * 10000).rounded()))"
        if let hit = scaled[key] { return hit }
        guard let src = UIImage(named: "rig-\(id)-\(layer)") else { return nil }
        let size = CGSize(width: max(1, (box.w * k).rounded()), height: max(1, (box.h * k).rounded()))
        let fmt = UIGraphicsImageRendererFormat.preferred()
        let img = UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in
            ctx.cgContext.interpolationQuality = .high
            src.draw(in: CGRect(origin: .zero, size: size))
        }
        let out = Image(uiImage: img)
        scaled[key] = out
        return out
    }
}

/// One puppet: its rig drawn from `CastRig.evaluate`'s ops into a Canvas a little bigger
/// than the figure's square (room for the hop and raised arms), centered on it so the
/// rest pose sits exactly where the hero image did.
struct CastPuppetCanvas: View {
    let id: String
    let rig: CastRig
    let bundle: CastRigBundle
    /// The figure's square (points) = the 512-px `mascot-<id>` square.
    let size: CGFloat
    let t: Double
    let gr: Double?
    let tap: Double?
    let still: Bool

    /// The canvas around the 512-px mascot square (mascot px) — same as web PUPPET_PAD.
    static let padX: CGFloat = 160, padTop: CGFloat = 150, padBottom: CGFloat = 28

    var body: some View {
        let u = size / 512
        let w = (512 + Self.padX * 2) * u
        let h = (512 + Self.padTop + Self.padBottom) * u
        let ops = rig.evaluate(bundle, t: t, gr: gr, tap: tap, still: still)
        Canvas(rendersAsynchronously: false) { ctx, _ in
            let M = rig.mascot
            let a = CGFloat(M.s) * u
            let ex = (CGFloat(M.ox) + Self.padX) * u
            let ey = (CGFloat(M.oy) + Self.padTop) * u
            for op in ops {
                guard let box = rig.lay[op.layer],
                      let img = CastPuppets.shared.image(id, op.layer, box: box, heroToPoints: a) else { continue }
                let m = op.m.map { CGFloat($0) }
                var c = ctx
                c.concatenate(CGAffineTransform(a: a * m[0], b: a * m[1], c: a * m[2], d: a * m[3], tx: a * m[4] + ex, ty: a * m[5] + ey))
                c.opacity = op.alpha
                c.draw(img, in: CGRect(x: 0, y: 0, width: box.w, height: box.h))
            }
        }
        .frame(width: w, height: h)
        // the canvas's center sits (padBottom − padTop) / 2 mascot px off the square's center
        .offset(y: (Self.padBottom - Self.padTop) / 2 * u)
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }
}


/// 2.8 items 7 + 48: a header counter (streak flame, flawless trophy, shields) pops and glows for a beat the moment its
/// number grows — the streak just extended. Reduce Motion: no motion (the number simply changes). Transform + a soft
/// glow only, one spring, no timers running while idle.
private struct CounterPop: ViewModifier {
    let value: Int
    @State private var last: Int?
    @State private var pop = false
    @Environment(\.accessibilityReduceMotion) private var envReduce

    func body(content: Content) -> some View {
        content
            .scaleEffect(pop ? 1.32 : 1)
            .shadow(color: Color(hex: 0xF5A524).opacity(pop ? 0.85 : 0), radius: pop ? 10 : 0)
            .onAppear { last = value }
            .onChange(of: value) { new in
                defer { last = new }
                guard let old = last, new > old, !Motion.calm(envReduce) else { return }
                withAnimation(.spring(response: 0.22, dampingFraction: 0.45)) { pop = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { pop = false }
                }
            }
    }
}
