import SwiftUI

/// Shared top header across all four tabs (HEADER_SPEC §1, founder 2026-10-02).
/// Row 1: the cast title — the ten mascots spelling WORDOCIOUS replace the
/// wordmark and the PRO pill (Pro: W wears the crown over a soft gold glow line).
/// Row 2: the streak / flawless / shield stat pills on the left, help and
/// settings as white icon circles on the right. Help/Settings open their sheets;
/// the pills show the real profile values and open an explanatory popover on tap.
struct AppHeaderView: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var showMenu = false
    @State private var menuSelection: InfoMenuDestination?
    @State private var menuDest: InfoMenuDestination?
    @State private var showSettings = false
    @State private var showStreak = false
    @State private var showShield = false
    @State private var showFlawless = false
    @State private var showAuth = false

    // Stat inks (§1).
    private static let streakInk = Color(hex: 0xC2410C)
    private static let trophyInk = Color(hex: 0x92400E)
    private static let shieldInk = Color(hex: 0x5B21B6)

    var body: some View {
        VStack(spacing: 8) {
            CastTitle(pro: auth.isProActive)

            HStack(spacing: 6) {
                // Drawn from `headerStreak`/`headerShields`, not from `profile`
                // directly: the profile row arrives a beat after launch, so gating
                // the pills on it made them pop in a second late on EVERY cold
                // start. Those accessors fall back to the last known values for
                // exactly that window (nil on a first launch or after sign-out, so
                // nothing is drawn then). The popovers still need the real row, so
                // a tap during the window is simply inert — an interaction nobody
                // can win the race to make.
                if let streak = auth.headerStreak, streak > 0 {
                    Button { if auth.profile != nil { showStreak = true } } label: {
                        pill(.flame, text: "\(streak)", ink: Self.streakInk)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Daily streak, \(streak)")
                    .popover(isPresented: $showStreak) {
                        if let p = auth.profile { streakPopover(p).modifier(CompactPopover()) }
                    }
                }
                // §244: flawless-streak pill — the day-stamped cache written by
                // dailySweepStats(), synchronous like the other header values.
                // Only a live run (>= 2) earns header real estate.
                if MatchStatsService.cachedFlawlessStreak() >= 2 {
                    let flawless = MatchStatsService.cachedFlawlessStreak()
                    Button { showFlawless = true } label: {
                        pill(.trophy, text: "\(flawless)", ink: Self.trophyInk)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Flawless streak, \(flawless)")
                    .popover(isPresented: $showFlawless) {
                        flawlessPopover(flawless).modifier(CompactPopover())
                    }
                }
                if let shields = auth.headerShields {
                    Button { if auth.profile != nil { showShield = true } } label: {
                        pill(.shield, text: "\(shields)", ink: Self.shieldInk)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Streak shields, \(shields)")
                    .popover(isPresented: $showShield) {
                        if let p = auth.profile { shieldPopover(p).modifier(CompactPopover()) }
                    }
                }

                Spacer(minLength: 6)

                // Guest — prominent Sign In entry (account tabs also prompt, but the
                // Home header had no entry). Presents the sign-in sheet.
                if auth.isGuest {
                    Button { showAuth = true } label: {
                        Text("Sign In").font(Brand.font(13, .heavy)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)],
                                                                      startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }
                    .buttonStyle(.plain)
                }

                circleButton(.help, label: "Help") { showMenu = true }
                circleButton(.gear, label: "Settings") { showSettings = true }
            }
        }
        .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 8)
        .sheet(isPresented: $showMenu, onDismiss: { if let s = menuSelection { menuDest = s; menuSelection = nil } }) {
            MenuSheet(selection: $menuSelection).presentationDetents([.large])
        }
        .sheet(item: $menuDest) { infoMenuDestinationView($0).presentationDetents([.large]) }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    // MARK: - Pieces

    /// 38 pt white circle, soft shadow, the 22 pt icon (§1).
    private func circleButton(_ icon: Icon3DName, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon3D(icon, size: 22).headerCircle(38)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// White, fully round, soft shadow, NO border; the 20 pt icon + the number at 15 / 900 in the stat's ink.
    private func pill(_ icon: Icon3DName, text: String, ink: Color) -> some View {
        HStack(spacing: 4) {
            Icon3D(icon, size: 20)
            Text(text).font(Brand.font(15, .black)).foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .fixedSize()   // never compress/wrap — keeps every pill the same pill shape
        .padding(.leading, 7).padding(.trailing, 10).padding(.vertical, 5)
        .background(Capsule().fill(Theme.surface)
            .shadow(color: .black.opacity(0.10), radius: 6, x: 0, y: 2))
    }

    private func streakPopover(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Icon3D(.flame, size: 18)
                Text("Daily Streak").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
            }
            statRow("Current", "\(p.dailyLoginStreak) \(p.dailyLoginStreak == 1 ? "day" : "days")")
            statRow("Best", "\(p.bestDailyLoginStreak) \(p.bestDailyLoginStreak == 1 ? "day" : "days")")
            Divider().overlay(Theme.divider)
            Text("Play any daily puzzle each day to keep your streak going. Miss a day and it resets — unless you use a streak shield.")
                .font(Brand.font(11, .medium)).foregroundStyle(Theme.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(width: 240).background(Theme.surface)
    }

    /// §244: what the trophy pill means.
    private func flawlessPopover(_ streak: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Icon3D(.trophy, size: 18)
                Text("Flawless Streak").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
            }
            statRow("Current", "\(streak) \(streak == 1 ? "day" : "days")")
            Divider().overlay(Theme.divider)
            Text("Consecutive days winning all \(DailyCompletionsStore.totalDailyModes) Daily Sweep games. Win every one today to keep it alive.")
                .font(Brand.font(11, .medium)).foregroundStyle(Theme.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(width: 240).background(Theme.surface)
    }

    private func shieldPopover(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Icon3D(.shield, size: 18)
                Text("Streak Shields").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
            }
            statRow("Available", "\(p.streakShields) \(p.streakShields == 1 ? "shield" : "shields")")
            Divider().overlay(Theme.divider)
            Text("Shields protect your streak if you miss a day. Earn a free shield every 7-day streak milestone. PRO members get 4 shields each billing period.")
                .font(Brand.font(11, .medium)).foregroundStyle(Theme.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(width: 240).background(Theme.surface)
    }

    private func statRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            Spacer()
            Text(value).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
        }
    }
}

/// Force the popover to stay a popover (not a sheet) on iPhone where available;
/// falls back to the default adaptation on iOS < 16.4.
private struct CompactPopover: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) { content.presentationCompactAdaptation(.popover) }
        else { content }
    }
}

// MARK: - Cast title (HEADER_SPEC §1)

/// The ten mascots side by side in WORDOCIOUS order — the app's title. Tightly
/// packed (each ~36 pt, ~8% overlap, bottoms aligned), centered, not tappable.
/// A gentle one-time hop wave the first time it appears in a session (Reduce
/// Motion — the OS setting or the in-app toggle — keeps it static). Pro: W wears
/// the gold crown and the row sits on a soft gold glow line; free: neither.
struct CastTitle: View {
    var pro: Bool
    var size: CGFloat = 36

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var start = Date()
    @State private var hopping = !CastTitle.didHop

    /// The wave runs once per launch, not on every tab switch.
    private static var didHop = false

    /// Each character's visible width as a fraction of its square art (the art is
    /// 512 px with transparent sides; I is the narrow one), so the row packs by
    /// what you see rather than by the squares.
    private static let visibleWidth: [MascotID: CGFloat] = [
        .w: 0.92, .o1: 0.92, .r: 0.80, .d: 0.92, .o2: 0.76,
        .c: 0.86, .i: 0.44, .o3: 0.91, .u: 0.92, .s: 0.92,
    ]
    private static let overlap: CGFloat = 0.08
    private static let hop: CGFloat = 6
    private static let stagger: Double = 0.07
    private static let hopDuration: Double = 0.4

    var body: some View {
        GeometryReader { g in
            let s = fittedSize(g.size.width)
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                Group {
                    if Mascots.reduceMotion(envReduceMotion) || !hopping {
                        row(s) { _ in 0 }
                    } else {
                        TimelineView(.animation(minimumInterval: 1 / 30)) { ctx in
                            let t = ctx.date.timeIntervalSince(start)
                            row(s) { i in Self.offset(i, t) }
                        }
                    }
                }
                .background(alignment: .bottom) {
                    if pro {
                        // The soft gold glow line beneath the row (#f59e0b ~25%, 2 pt, blurred).
                        Capsule().fill(Color(hex: 0xF59E0B).opacity(0.25))
                            .frame(height: 2)
                            .padding(.horizontal, s * 0.2)
                            .blur(radius: 1.5)
                            .offset(y: 3)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: size + crownRoom + 4)
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(pro ? "Wordocious Pro" : "Wordocious")
        .accessibilityAddTraits(.isHeader)
        .task {
            guard hopping, !Mascots.reduceMotion(envReduceMotion) else { hopping = false; return }
            CastTitle.didHop = true
            let total = Double(Mascots.cast.count - 1) * Self.stagger + Self.hopDuration
            try? await Task.sleep(nanoseconds: UInt64(total * 1_000_000_000))
            hopping = false
        }
    }

    /// Head room for the crown above W (and the hop, which the frame absorbs).
    private var crownRoom: CGFloat { pro ? size * 0.28 : Self.hop }

    /// ~36 pt, smaller only when the screen can't fit the row.
    private func fittedSize(_ width: CGFloat) -> CGFloat {
        let units = Mascots.cast.reduce(CGFloat(0)) { $0 + (Self.visibleWidth[$1] ?? 1) }
            - CGFloat(Mascots.cast.count - 1) * Self.overlap
        guard width > 0 else { return size }
        return min(size, width / units)
    }

    private func row(_ s: CGFloat, _ y: @escaping (Int) -> CGFloat) -> some View {
        HStack(alignment: .bottom, spacing: -s * Self.overlap) {
            ForEach(Array(Mascots.cast.enumerated()), id: \.element) { i, m in
                Image(m.assetName).resizable().interpolation(.high).scaledToFit()
                    .frame(width: s, height: s)
                    .frame(width: s * (Self.visibleWidth[m] ?? 1))
                    .overlay(alignment: .top) {
                        if pro && m == .w {
                            // W's crown: ~45% of W's width, sitting on its top edge
                            // (W's art starts ~12% down its square).
                            Icon3D(.crown, size: s * 0.92 * 0.45)
                                .offset(y: s * 0.115 - s * 0.92 * 0.45 * 0.72)
                        }
                    }
                    .offset(y: y(i))
                    .zIndex(Double(Mascots.cast.count - i))
            }
        }
    }

    private static func offset(_ i: Int, _ t: Double) -> CGFloat {
        let local = t - Double(i) * stagger
        guard local >= 0, local < hopDuration else { return 0 }
        return -hop * CGFloat(sin(.pi * local / hopDuration))
    }
}
