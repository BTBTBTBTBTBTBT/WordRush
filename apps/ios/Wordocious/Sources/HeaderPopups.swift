import SwiftUI
import WordociousCore

// FINISH_SPEC §AS6 / §AS7: the header's streak, shield and flawless popups (§C5),
// presented from the APP ROOT as a full-screen overlay — the scrim covers the whole
// screen and the card sits centered. (They used to hang inside the header's own
// clipped container: a tap only shaded the header strip and no card showed.)
// §AS7: the streak popup holds ALL the streak info — the daily streak (current +
// best) and its week strip, the Wordocious and Puzzles sweep streaks, the flawless
// streaks in gold (a row only once that run has ever happened), and the shields.

/// Which header popup is open (nil = none). AppHeaderView toggles it; the root's
/// `HeaderPopupHost` draws it.
@MainActor
final class HeaderPopups: ObservableObject {
    static let shared = HeaderPopups()
    enum Kind: Equatable { case streak, shield, flawless }
    @Published var shown: Kind?
    private init() {}

    func toggle(_ k: Kind) { shown = shown == k ? nil : k }
    func close() { shown = nil }
}

/// Every run the streak popup lists (signed in only).
struct StreakDigest: Equatable {
    var wordSweep = 0
    var wordFlawless = 0
    var wordFlawlessBest = 0
    var puzzleSweep = 0
    var puzzleSweepBest = 0
    var puzzleFlawless = 0
    var puzzleFlawlessBest = 0

    /// Instant values from the caches the Home banner already keeps.
    static var cached: StreakDigest {
        let w = HomeStreaksService.cachedStreaks(.word), p = HomeStreaksService.cachedStreaks(.puzzles)
        let f = MatchStatsService.cachedFlawlessStreak()
        return StreakDigest(wordSweep: w.sweep, wordFlawless: max(w.flawless, f), wordFlawlessBest: max(w.flawless, f),
                            puzzleSweep: p.sweep, puzzleSweepBest: p.sweep,
                            puzzleFlawless: p.flawless, puzzleFlawlessBest: p.flawless)
    }

    /// The Puzzles group's daily keys (the PUZZLES row of the Home banner).
    @MainActor private static var puzzleKeys: [String] {
        let flags = FlagsService.shared
        guard homeModes.contains(where: { $0.id == "more" && flags.isOn($0.flagKey) }) else { return [] }
        return moreDailyModes(moreModes.filter { flags.isOn($0.flagKey) }).compactMap(\.dbKey)
    }

    /// The full digest (current + best runs) from the same sources Stats uses.
    @MainActor static func load() async -> StreakDigest {
        var d = cached
        let sweep = await MatchStatsService.dailySweepStats()
        d.wordSweep = sweep.currentSweepStreak
        d.wordFlawless = sweep.currentFlawlessStreak
        d.wordFlawlessBest = max(sweep.bestFlawlessStreak, sweep.currentFlawlessStreak)
        let keys = puzzleKeys
        if !keys.isEmpty {
            let rec = await HomeStreaksService.puzzleRecords(dbKeys: keys)
            d.puzzleSweep = rec.streaks.sweep
            d.puzzleSweepBest = max(rec.totals.bestSweep, rec.streaks.sweep)
            d.puzzleFlawless = rec.streaks.flawless
            d.puzzleFlawlessBest = max(rec.totals.bestFlawless, rec.streaks.flawless)
        }
        return d
    }
}

/// The root overlay: a full-screen scrim + the open popup, centered.
struct HeaderPopupHost: View {
    @ObservedObject private var popups = HeaderPopups.shared
    @ObservedObject private var auth = AuthService.shared
    @State private var digest = StreakDigest.cached

    var body: some View {
        ZStack {
            if let kind = popups.shown, kind == .flawless || auth.profile != nil {
                Color(hex: 0x1E0F3C).opacity(0.42)
                    .ignoresSafeArea()
                    .contentShape(Rectangle())
                    .onTapGesture { popups.close() }
                    .accessibilityLabel("Close")
                    .accessibilityAddTraits(.isButton)
                    .transition(.opacity)
                GeometryReader { g in
                    ScrollView(showsIndicators: false) {
                        card(kind)
                            .frame(width: min(420, g.size.width - 28))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                            .frame(minHeight: g.size.height)
                    }
                    .scrollBounceBehaviorBasedOnSize()
                }
                .transition(.scale(scale: 0.92).combined(with: .opacity))
                .accessibilityAddTraits(.isModal)
            }
        }
        .animation(Theme.animation(Motion.spring), value: popups.shown)   // §AZ: the shared spring
        .onChange(of: popups.shown) { shown in
            guard shown != nil else { return }
            Feedback.whoosh()   // §U: popup open
        }
        .task(id: popups.shown) {
            guard popups.shown == .streak, auth.isAuthenticated else { return }
            digest = StreakDigest.cached
            let fresh = await StreakDigest.load()
            if fresh != digest { digest = fresh }
        }
    }

    @ViewBuilder
    private func card(_ kind: HeaderPopups.Kind) -> some View {
        switch kind {
        case .streak:
            if let p = auth.profile { streakCard(p) }
        case .shield:
            if let p = auth.profile { shieldCard(p) }
        case .flawless:
            flawlessCard(MatchStatsService.cachedFlawlessStreak())
        }
    }

    private static let warm = Color(hex: 0xF5A524)
    private static let warmInk = Color(hex: 0xA2560C)
    private static let gold = Color(hex: 0xF5A524)
    private static let goldInk = Color(hex: 0x92400E)
    private static let purple = Color(hex: 0x7C3AED)
    private static let purpleInk = Color(hex: 0x5B21B6)

    // MARK: §AS7 the streak popup — every streak in one place

    private func streakCard(_ p: Profile) -> some View {
        let streak = p.dailyLoginStreak, best = p.bestDailyLoginStreak
        let headline = streak == 1 ? "1-day streak!" : "\(streak)-day streak!"
        let sub = streak > 0 && streak >= best ? "Your best ever. Keep it rolling." : "Play a daily every day to keep it going."
        let d = digest
        let wordFlawlessShown = d.wordFlawless > 0 || d.wordFlawlessBest > 0
        let puzzleFlawlessShown = d.puzzleFlawless > 0 || d.puzzleFlawlessBest > 0
        return PopCard(tint: Color(hex: 0xFFF6EA),
                       header: [Color(hex: 0xFFB36B), Color(hex: 0xF5A524), Color(hex: 0xFF8A5C)],
                       icon: .flame, title: headline, subtitle: sub, host: .s, hostPose: "trophy") {
            sectionLabel("DAILY STREAK", Self.warmInk)
            HStack(spacing: 8) {
                statTile(streak, "CURRENT")
                statTile(best, "BEST")
            }
            .padding(.horizontal, 14).padding(.top, 6)
            weekRow(streak: streak)

            sectionLabel("SWEEP STREAKS", Self.purpleInk)
            HStack(spacing: 8) {
                streakChip(label: "WORDOCIOUS", current: d.wordSweep, best: nil, gold: false) {
                    sweepIcon(26)
                }
                streakChip(label: "PUZZLES", current: d.puzzleSweep, best: d.puzzleSweepBest > 0 ? d.puzzleSweepBest : nil,
                           gold: false) {
                    sweepIcon(26)
                }
            }
            .padding(.horizontal, 14).padding(.top, 6)

            // Flawless gets its own gold section; a row shows once that run has ever happened.
            if wordFlawlessShown || puzzleFlawlessShown {
                sectionLabel("FLAWLESS STREAKS", Self.goldInk)
                HStack(spacing: 8) {
                    if wordFlawlessShown {
                        streakChip(label: "WORDOCIOUS", current: d.wordFlawless, best: d.wordFlawlessBest, gold: true) {
                            flawlessIcon(28)
                        }
                    }
                    if puzzleFlawlessShown {
                        streakChip(label: "PUZZLES", current: d.puzzleFlawless, best: d.puzzleFlawlessBest, gold: true) {
                            flawlessIcon(28)
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.top, 6)
            }

            sectionLabel("SHIELDS", Self.purpleInk)
            shieldRow(p.streakShields)
                .padding(.horizontal, 14).padding(.top, 4)
            popText("Play any daily puzzle each day to keep your streak going. Miss a day and it resets, unless a streak shield saves it. Earn a free shield at every 7-day milestone; Pro members get 4 each billing period.")
        }
    }

    private func sectionLabel(_ text: String, _ ink: Color) -> some View {
        Text(text)
            .font(Brand.font(11, .black)).tracking(1.2)
            .foregroundStyle(ink)
            .padding(.horizontal, 16).padding(.top, 14)
            .accessibilityAddTraits(.isHeader)
    }

    /// A labeled run: the 3D icon, the label, the current run as a soft number and
    /// (when known) the best. Gold = flawless.
    private func streakChip<Icon: View>(label: String, current: Int, best: Int?, gold: Bool,
                                        @ViewBuilder icon: () -> Icon) -> some View {
        let accent = gold ? Self.gold : Self.purple
        let ink = gold ? Self.goldInk : Self.purpleInk
        return HStack(spacing: 8) {
            icon()
            VStack(alignment: .leading, spacing: 0) {
                Text(label).font(Brand.font(9.5, .black)).tracking(0.8).foregroundStyle(ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(current)").softNumber(20)
                    Text(current == 1 ? "DAY" : "DAYS").font(Brand.font(9, .black)).foregroundStyle(ink)
                }
                if let best {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text("BEST").font(Brand.font(9, .black)).foregroundStyle(ink)
                        Text("\(best)").softNumber(12)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10).padding(.top, 9).padding(.bottom, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tintedPill(accent, radius: 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(gold ? "Flawless" : "Sweep") streak, \(label.capitalized): \(current) \(current == 1 ? "day" : "days")"
                            + (best.map { ", best \($0)" } ?? ""))
    }

    @ViewBuilder private func sweepIcon(_ size: CGFloat) -> some View {
        if ArtAsset.exists("game-sweep") {
            ArtThumbs.image("game-sweep", points: size).resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
        } else {
            Icon3D(.trophy, size: size)
        }
    }

    @ViewBuilder private func flawlessIcon(_ size: CGFloat) -> some View {
        if ArtAsset.exists("art-scene-flawless-star") {
            ArtThumbs.image("art-scene-flawless-star", points: size).resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
        } else {
            Icon3D(.crown, size: size)
        }
    }

    private func shieldRow(_ n: Int) -> some View {
        let shown = min(n, 6)
        return HStack(spacing: 6) {
            ForEach(0..<shown, id: \.self) { _ in Icon3D(.shield, size: 30) }
            Icon3D(.shield, size: 30).saturation(0).opacity(0.28)   // the next one to earn
            if n > shown { Text("+\(n - shown)").softNumber(16) }
            Spacer(minLength: 0)
            Text("\(n)").softNumber(20)
            Text(n == 1 ? "SHIELD" : "SHIELDS").font(Brand.font(9, .black)).foregroundStyle(Self.purpleInk)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(n) streak \(n == 1 ? "shield" : "shields")")
    }

    // MARK: §C5 shield + flawless popups (unchanged look)

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

    private func popText(_ text: String) -> some View {
        Text(text)
            .font(Brand.font(13.5, .bold))
            .foregroundStyle(Color(hex: 0x5A4A72))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 16).padding(.top, 12)
    }

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

private extension View {
    /// iOS 16.4+: don't rubber-band a popup that fits.
    @ViewBuilder func scrollBounceBehaviorBasedOnSize() -> some View {
        if #available(iOS 16.4, *) { self.scrollBounceBehavior(.basedOnSize) } else { self }
    }
}
