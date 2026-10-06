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
                        Button { showAuth = true } label: { CandyLabel(title: "Sign In") }
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

            LivingCastHeader(pro: auth.isProActive)
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
        }
        .buttonStyle(.squishIcon)
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

    /// The header's height: the top margin, the figures, the stagger and (Pro) the crown's room.
    static func height(pro: Bool) -> CGFloat {
        let s = figure
        return topMargin + s + stagger + (pro ? s * 0.22 : 2)
    }

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    /// 2.7.1: the rigs play out of season only (they are cut from the plain heroes; the
    /// costumes keep their images + a transform-only tap hop). Off if the bundle fails.
    private var puppetsOn: Bool { CastSkin.season == nil && CastPuppets.shared.bundle != nil }

    /// A tap or a signature move is playing (full frame rate); else the puppets breathe at 15 fps.
    private func puppetBusy(_ now: Date) -> Bool {
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
        TimelineView(.animation(minimumInterval: puppetsOn && !busy && handoff.flourishStart == nil ? 1 / 15 : 1 / 60, paused: timelinePaused)) { ctx in
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
        .onAppear { onScreen = true }
        .onDisappear { onScreen = false }
        .task { await runMoves() }
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
        return figureArt(m, s: s, now: now)
            .frame(width: s, height: s)
            // §F2 fix step 2: the figure's square on screen, for the intro to land on.
            .background(GeometryReader { g in
                Color.clear.preference(key: CastFramesKey.self, value: [m: g.frame(in: .global)])
            })
            .frame(width: s * vis)
            .allowsHitTesting(false)
            // 2.7.1: tap a character → hop + laugh (its signature move too), a light haptic.
            .overlay { Color.clear.contentShape(Rectangle()).onTapGesture { tapPuppet(m) } }
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
            .offset(y: CGFloat(tapPose.hop) * 0.53 * s / 512)
            .scaleEffect(x: CGFloat(pose.sx), y: CGFloat(pose.sy), anchor: anchor)
            .rotationEffect(.degrees(pose.rotation), anchor: anchor)
            .transformEffect(CGAffineTransform(a: 1, b: 0, c: skew, d: 1, tx: -skew * s * anchor.y, ty: 0))
            .offset(x: CGFloat(pose.tx) * s * vis, y: CGFloat(pose.ty) * s)
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

/// Force the popover to stay a popover (not a sheet) on iPhone where available;
/// falls back to the default adaptation on iOS < 16.4.
struct CompactPopover: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) { content.presentationCompactAdaptation(.popover) }
        else { content }
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
