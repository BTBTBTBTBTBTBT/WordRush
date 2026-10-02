import SwiftUI
import WordociousCore

/// Shared top header across all four tabs (HEADER_SPEC §1; FINISH_SPEC §A3, §A5,
/// §C1, §C5 — founder 2026-10-02).
/// Row 1: the living cast header — the ten mascots spelling WORDOCIOUS edge to
/// edge, one of them playing its move every few seconds (Pro: W wears the crown).
/// Row 2: the streak / flawless / shield controls on the left and help + settings on
/// the right, all soft 3D icons drawn bare (no bubbles) with soft numbers, each
/// squishing on press. The stat controls open the redesigned popups (colored
/// header, big 3D icon, host character, soft-number tiles), anchored under the row
/// while the page dims softly.
struct AppHeaderView: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var showMenu = false
    @State private var menuSelection: InfoMenuDestination?
    @State private var menuDest: InfoMenuDestination?
    @State private var showSettings = false
    @State private var showAuth = false
    @State private var pop: HeaderPop?

    enum HeaderPop: Equatable { case streak, shield, flawless }

    var body: some View {
        VStack(spacing: 0) {
            LivingCastHeader(pro: auth.isProActive)

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

                // Guest — prominent Sign In entry (account tabs also prompt, but the
                // Home header had no entry). Presents the sign-in sheet.
                if auth.isGuest {
                    Button { showAuth = true } label: { CandyLabel(title: "Sign In") }
                        .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                        .padding(.top, 4)
                }

                iconControl(.help, label: "Help") { showMenu = true }
                iconControl(.gear, label: "Settings") { showSettings = true }
            }
            .padding(.horizontal, 8)
            // FINISH_SPEC §N4: the controls row sits 6 pt below the cast row.
            .padding(.top, 6)
        }
        .padding(.bottom, 2)
        // §C5: the popup hangs under the controls row; the page below dims softly.
        .overlay(alignment: .bottom) { popLayer }
        // Draw (and hit-test) the popup layer above the page content below the header.
        .zIndex(10)
        .animation(Theme.animation(.spring(response: 0.3, dampingFraction: 0.85)), value: pop)
        .onChange(of: pop) { if $0 != nil { Feedback.whoosh() } }   // §U: popup open
        .streakBumpFeedback(auth.headerStreak)                      // §U: streak +1
        .sheet(isPresented: $showMenu, onDismiss: { if let s = menuSelection { menuDest = s; menuSelection = nil } }) {
            MenuSheet(selection: $menuSelection).presentationDetents([.large])
        }
        .sheet(item: $menuDest) { infoMenuDestinationView($0).presentationDetents([.large]) }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private func toggle(_ p: HeaderPop) {
        pop = pop == p ? nil : p
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

    /// A bare 3D icon (23 pt) in a 44-pt tap area.
    private func iconControl(_ icon: Icon3DName, label: String, action: @escaping () -> Void) -> some View {
        HeaderCircleButton(.icon(icon), size: HeaderControl.tap, label: label, action: action)
    }

    // MARK: - Popups (§C5)

    @ViewBuilder private var popLayer: some View {
        if let pop {
            if pop == .flawless {
                popContainer { card(.flawless, profile: auth.profile) }
            } else if let p = auth.profile {
                popContainer { card(pop, profile: p) }
            }
        }
    }

    private func popContainer<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        let width = UIScreen.main.bounds.width
        return ZStack(alignment: .top) {
            Color(hex: 0x1E0F3C).opacity(0.28)
                .frame(width: width * 3, height: 3000)
                .contentShape(Rectangle())
                .onTapGesture { pop = nil }
                .accessibilityLabel("Close")
                .accessibilityAddTraits(.isButton)
            content()
                .frame(width: min(420, width - 28))
                .padding(.top, 4)
        }
        .frame(width: width)
        .alignmentGuide(.bottom) { d in d[.top] }
        .transition(.opacity)
    }

    @ViewBuilder
    private func card(_ kind: HeaderPop, profile p: Profile?) -> some View {
        switch kind {
        case .streak:
            if let p { streakCard(p) }
        case .shield:
            if let p { shieldCard(p) }
        case .flawless:
            flawlessCard(MatchStatsService.cachedFlawlessStreak())
        }
    }

    private static let warm = Color(hex: 0xF5A524)
    private static let warmInk = Color(hex: 0xA2560C)

    /// §C5 streak popup: a warm orange header with the big flame, a friendly
    /// headline and S the speedster (host); Current + Best soft-number tiles; this
    /// week as seven day tiles; the how-it-works line.
    private func streakCard(_ p: Profile) -> some View {
        let streak = p.dailyLoginStreak, best = p.bestDailyLoginStreak
        let headline = streak == 1 ? "1-day streak!" : "\(streak)-day streak!"
        let sub = streak > 0 && streak >= best ? "Your best ever. Keep it rolling." : "Play a daily every day to keep it going."
        return PopCard(tint: Color(hex: 0xFFF6EA),
                       header: [Color(hex: 0xFFB36B), Color(hex: 0xF5A524), Color(hex: 0xFF8A5C)],
                       icon: .flame, title: headline, subtitle: sub, host: .s, hostPose: "trophy") {
            HStack(spacing: 8) {
                statTile(streak, "CURRENT")
                statTile(best, "BEST")
            }
            .padding(.horizontal, 14).padding(.top, 12)
            weekRow(streak: streak)
            popText("Play any daily puzzle each day to keep your streak going. Miss a day and it resets, unless a streak shield saves it.")
        }
    }

    /// §C5 shield popup: a purple header with the big shield and U (host); the
    /// shields as a row of 3D shields (the next one to earn faded).
    private func shieldCard(_ p: Profile) -> some View {
        let n = p.streakShields
        let title = n == 1 ? "1 streak shield" : "\(n) streak shields"
        let sub = n > 0 ? "Your streak is protected." : "Earn one at your next 7-day milestone."
        let shown = min(n, 6)
        return PopCard(tint: Color(hex: 0xF5EFFF),
                       header: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)],
                       icon: .shield, title: title, subtitle: sub, host: .u, hostPose: "lotus") {
            HStack(spacing: 8) {
                ForEach(0..<shown, id: \.self) { _ in Icon3D(.shield, size: 40) }
                // The next one to earn, faded.
                Icon3D(.shield, size: 40).saturation(0).opacity(0.28)
                if n > shown {
                    Text("+\(n - shown)").softNumber(20)
                }
            }
            .padding(.horizontal, 14).padding(.top, 12)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(n) shields")
            popText("A shield saves your streak if you miss a day. Earn a free one at every 7-day milestone; Pro members get 4 each billing period.")
        }
    }

    /// §244 / §C5: the flawless popup in the same family (a gold header, O2 hosts).
    private func flawlessCard(_ streak: Int) -> some View {
        PopCard(tint: Color(hex: 0xFFF8E6),
                header: [Color(hex: 0xFFD166), Color(hex: 0xF5A524), Color(hex: 0xF59E0B)],
                icon: .trophy, title: "\(streak)-day flawless run!", subtitle: "Every daily won, day after day.",
                host: .o2, hostPose: "twirl") {
            HStack(spacing: 8) { statTile(streak, "CURRENT") }
                .padding(.horizontal, 14).padding(.top, 12)
            popText("Consecutive days winning all \(DailyCompletionsStore.totalDailyModes) Daily Sweep games. Win every one today to keep it alive.")
        }
    }

    /// The popup's closing paragraph.
    private func popText(_ text: String) -> some View {
        Text(text)
            .font(Brand.font(13.5, .bold))
            .foregroundStyle(Color(hex: 0x5A4A72))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 16).padding(.top, 10)
    }

    /// Current / Best: a soft number on a tinted tile with the warm top bar.
    private func statTile(_ value: Int, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text("\(value)").softNumber(28)
            Text(label).font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(Self.warmInk)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8).padding(.horizontal, 10)
        .tintedPill(Self.warm, radius: 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label.capitalized) \(value) \(value == 1 ? "day" : "days")")
    }

    /// This week, Monday first: filled orange for each day the streak covers.
    private func weekRow(streak: Int) -> some View {
        let cal = Calendar(identifier: .gregorian)
        let today = StreakWeek.mondayIndex(weekday: cal.component(.weekday, from: Date()))
        let played = DailyCompletionsStore.cachedTodayCount() > 0
        let days = StreakWeek.days(streak: streak, playedToday: played, todayIndex: today)
        let letters = ["M", "T", "W", "T", "F", "S", "S"]
        return HStack(spacing: 4) {
            ForEach(0..<7, id: \.self) { i in
                VStack(spacing: 2) {
                    Text(letters[i]).font(Brand.font(10, .black)).foregroundStyle(Self.warmInk)
                    ZStack {
                        if days[i] {
                            RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0xB0650B)).offset(y: 2)
                            RoundedRectangle(cornerRadius: 8)
                                .fill(LinearGradient(colors: [Color(hex: 0xFFB36B), Self.warm], startPoint: .top, endPoint: .bottom))
                            Image(systemName: "checkmark").font(.system(size: 11, weight: .black)).foregroundStyle(.white)
                        } else {
                            RoundedRectangle(cornerRadius: 8).fill(Color(red: 1, green: 214 / 255, blue: 160 / 255).opacity(0.45))
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(Color(hex: 0xD97706).opacity(0.35), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
                        }
                    }
                    .frame(height: 26)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 14).padding(.top, 8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("This week: \(days.filter { $0 }.count) days played")
    }
}

/// One §C5 popup: a colored header (gradient, the big 3D icon, a headline and a
/// subline, the host pose peeking at the right), then its body on a soft tint.
private struct PopCard<Body: View>: View {
    let tint: Color
    let header: [Color]
    let icon: Icon3DName
    let title: String
    let subtitle: String
    let host: MascotID
    let hostPose: String
    @ViewBuilder var content: () -> Body

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 24, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Icon3D(icon, size: 58)
                    .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 4)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(Brand.font(21, .black)).foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.12), radius: 0, x: 0, y: 2)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
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

    var body: some View {
        let s = Self.figure
        TimelineView(.animation(minimumInterval: 1 / 60, paused: (active == nil && handoff.flourishStart == nil) || still)) { ctx in
            row(s, now: ctx.date)
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
        .sheet(isPresented: $showProSheet) { ProMemberSheet() }
        .onChange(of: debugSeason) { _ in CastSkin.invalidate() }
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
        return Image(CastSkin.assetName(for: m)).resizable().interpolation(.high).scaledToFit()
            .frame(width: s, height: s)
            // §F2 fix step 2: the figure's square on screen, for the intro to land on.
            .background(GeometryReader { g in
                Color.clear.preference(key: CastFramesKey.self, value: [m: g.frame(in: .global)])
            })
            .frame(width: s * vis)
            .allowsHitTesting(false)
            .overlay(alignment: .top) {
                if pro && m == .w {
                    // §AA1: W's crown (the gold sprite, tilted ~-8°, a twinkle every ~8 s),
                    // ~45% of W's width, sitting on its top edge. It rides inside W's
                    // transforms below, so it hops / moves / flourishes with W.
                    CastCrown(size: s * 0.92 * 0.45, still: still || Motion.lowPower) { showProSheet = true }
                        .offset(y: s * 0.115 - s * 0.92 * 0.45 * 0.72)
                }
            }
            .scaleEffect(x: CGFloat(pose.sx), y: CGFloat(pose.sy), anchor: anchor)
            .rotationEffect(.degrees(pose.rotation), anchor: anchor)
            .transformEffect(CGAffineTransform(a: 1, b: 0, c: skew, d: 1, tx: -skew * s * anchor.y, ty: 0))
            .offset(x: CGFloat(pose.tx) * s * vis, y: CGFloat(pose.ty) * s)
            .shadow(color: Color(hex: 0x3C1E6E).opacity(0.18), radius: 2, x: 0, y: 3)
            .padding(.bottom, i % 2 == 1 ? Self.stagger : 0)
            .zIndex(moving ? 20 : Double(Mascots.cast.count - i))
    }

    /// One move at a time: wait, pick a character (never the last one), play its
    /// move, rest 2.6–5 s from the move's start, repeat. Cancelled with the view.
    private func runMoves() async {
        try? await Task.sleep(nanoseconds: UInt64(CastMoves.firstDelay * 1_000_000_000))
        var last: String?
        while !Task.isCancelled {
            // No personality moves under the intro or its landing flourish.
            // §AD: Low Power Mode also rests the idle moves (checked each round, so it's live).
            if still || Motion.lowPower || handoff.introRunning || handoff.flourishStart != nil {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                continue
            }
            let id = CastMoves.pick(after: last)
            last = id
            let duration = CastMoves.duration(id)
            let gap = CastMoves.interval(unit: Double.random(in: 0...1))
            if let m = MascotID(rawValue: id) { active = ActiveMove(id: m, start: Date()) }
            if ["w", "d", "o3"].contains(id) { Feedback.hop(volume: 0.6) }   // §U: the hop / jump moves
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
