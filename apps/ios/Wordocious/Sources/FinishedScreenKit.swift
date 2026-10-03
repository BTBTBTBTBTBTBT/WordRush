import SwiftUI
import WordociousCore

// FINISH_SPEC §R2 / §R3 (founder 10-02): the shared pieces every game's finished
// screen uses so the buttons never need a scroll, and the Unlimited card.

// MARK: - §R2 One-screen finished layout

/// FINISH_SPEC §R2: a finished screen that fits ONE screen on every phone ≥ 667 pt.
/// Top → bottom: `header` (title art + the compact one-line result strip), the
/// board area — which gets exactly the height left after the header and the dock
/// (measured, not guessed; the closure receives that size, so the board scales to
/// fit, shrinking below its playing size when it must) — then the `dock` (share +
/// primary candy + the Unlimited card). Everything in `extras` (definitions,
/// breakdowns, stage lists) sits BELOW the dock: reachable by scrolling, never above
/// the buttons.
struct FinishedScreenLayout<Header: View, Board: View, Dock: View, Extras: View>: View {
    /// The smallest board area before the page is allowed to grow taller than the
    /// screen (a tiny phone with a huge dock): keeps boards legible.
    var minBoardHeight: CGFloat = 120
    /// Founder 10-02: the tallest the board area may grow (nil = take all the
    /// height left). When capped (Gauntlet's hero art), the leftover height splits
    /// evenly above and below, so the whole block sits centered on the page
    /// instead of the art eating the screen.
    var maxBoardHeight: CGFloat? = nil
    /// Whether `extras` has content (the More chip shows only then).
    var hasExtras: Bool = true
    @ViewBuilder var header: () -> Header
    @ViewBuilder var board: (CGSize) -> Board
    @ViewBuilder var dock: () -> Dock
    @ViewBuilder var extras: () -> Extras

    /// FINISH_SPEC BA: the finished screen fits ONE screen with no scrolling — the
    /// rank / breakdown / definition / stage list sit behind a small "More" chip
    /// (tap → they expand below and scroll into view).
    @State private var showMore = false
    /// FINISH_SPEC BJ2: the extras are built once the screen has settled (hidden below
    /// the fold), so "More" only fades them in and scrolls — tapping it used to build
    /// the breakdown / rank / definition in the same frames as the expand animation.
    @State private var extrasBuilt = false
    @State private var settled = false
    @ObservedObject private var celebrations = AchievementUnlockCenter.shared
    @Environment(\.finishPrebuilding) private var prebuilding

    var body: some View {
        GeometryReader { page in
            ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    VStack(spacing: 8) {
                        header()
                        GeometryReader { area in
                            board(area.size)
                                .frame(width: area.size.width, height: area.size.height)
                        }
                        .frame(minHeight: minBoardHeight, maxHeight: max(minBoardHeight, maxBoardHeight ?? .infinity))
                        dock()
                        if hasExtras { moreChip(proxy) }
                    }
                    // The block is centered in the page: uncapped it fills the height
                    // exactly (the board takes all that is left); capped, it is shorter
                    // and the leftover splits evenly above and below.
                    .frame(height: max(page.size.height, minBoardHeight + 220), alignment: .center)
                    .id("finished-top")
                    if showMore || (extrasBuilt && fitsOneScreen(page.size.height)) {
                        extras().id("finished-more")
                            .opacity(showMore ? 1 : 0)
                            .allowsHitTesting(showMore)
                            .accessibilityHidden(!showMore)
                    }
                }
            }
            .scrollDisabled(!showMore && fitsOneScreen(page.size.height))
            }
        }
        .task(id: prebuilding) {
            // BJ2: build the extras only after the finish choreography (card out, strip,
            // XP toast, achievement popups) — one big thing at a time.
            guard !prebuilding else { return }
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            settled = true
            scheduleExtras()
        }
        .onChange(of: celebrations.queue.isEmpty) { _ in scheduleExtras() }
        // BA1: on short screens every title art in the finished header caps at ~56 pt.
        .environment(\.finishedTitleCap, FinishLayoutMetrics.isShort ? 56 : nil)
    }

    /// The page has room for the whole block (the extras then wait below the fold).
    private func fitsOneScreen(_ height: CGFloat) -> Bool { height >= minBoardHeight + 220 }

    private func scheduleExtras() {
        guard hasExtras, settled, !extrasBuilt, celebrations.queue.isEmpty else { return }
        // Half a second after any popup has left, never under its exit.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if celebrations.queue.isEmpty { extrasBuilt = true }
        }
    }

    private func toggleMore(_ proxy: ScrollViewProxy) {
        if showMore {
            withAnimation(Theme.animation(Motion.spring)) {
                showMore = false
                if extrasBuilt { proxy.scrollTo("finished-top", anchor: .top) }
            }
            return
        }
        // Built already: a fade (opacity only); else the original spring-in.
        withAnimation(Theme.animation(extrasBuilt ? .easeOut(duration: 0.25) : Motion.spring)) { showMore = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            withAnimation(Theme.animation(.easeInOut(duration: 0.35))) { proxy.scrollTo("finished-more", anchor: .top) }
        }
    }

    private func moreChip(_ proxy: ScrollViewProxy) -> some View {
        Button {
            Haptics.tap()
            toggleMore(proxy)
        } label: {
            HStack(spacing: 4) {
                Text(showMore ? "Less" : "More").font(Brand.font(12, .black)).tracking(0.6)
                Image(systemName: showMore ? "chevron.up" : "chevron.down").font(.system(size: 10, weight: .black))
            }
            .foregroundStyle(FinishInk.secondary)
            .padding(.horizontal, 14).frame(height: 26)
            .tintedPill(Color(hex: 0x7C3AED))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityLabel(showMore ? "Show less" : "More: score breakdown and details")
        .padding(.bottom, 2)
    }
}

/// FINISH_SPEC BA1: short screens (height < 700 pt — iPhone SE).
enum FinishLayoutMetrics {
    static var isShort: Bool { UIScreen.main.bounds.height < 700 }
}

private struct FinishedTitleCapKey: EnvironmentKey { static let defaultValue: CGFloat? = nil }
private struct FinishPrebuildingKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    /// FINISH_SPEC BJ2: this finished screen is being built hidden under the win card
    /// (its entrances and deferred work wait until it is revealed).
    var finishPrebuilding: Bool {
        get { self[FinishPrebuildingKey.self] }
        set { self[FinishPrebuildingKey.self] = newValue }
    }
}
extension EnvironmentValues {
    /// BA1: the finished screen's title-art height cap on short screens (nil = none).
    var finishedTitleCap: CGFloat? {
        get { self[FinishedTitleCapKey.self] }
        set { self[FinishedTitleCapKey.self] = newValue }
    }
}

extension FinishedScreenLayout where Extras == EmptyView {
    init(minBoardHeight: CGFloat = 120,
         @ViewBuilder header: @escaping () -> Header,
         @ViewBuilder board: @escaping (CGSize) -> Board,
         @ViewBuilder dock: @escaping () -> Dock) {
        self.init(minBoardHeight: minBoardHeight, hasExtras: false, header: header, board: board, dock: dock) { EmptyView() }
    }
}

/// FINISH_SPEC §R2: the compact one-line result strip — badge · guesses · time ·
/// points — as small tinted pills with soft numbers.
/// FINISH_SPEC §AT1: content centered on the SCREEN with a trailing accessory (the
/// share icon) pinned as an overlay — the same room is reserved on both sides, so
/// the share button never pushes the title / strip / candies off-center.
struct CenteredWithTrailing<Content: View, Trailing: View>: View {
    var reserve: CGFloat = 46
    @ViewBuilder var content: () -> Content
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        content()
            .padding(.horizontal, reserve)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .trailing) { trailing() }
    }
}

/// Founder 10-02 (2.7 close screen): the finished screen's SHARE RESULTS candy. It
/// replaces the side-floating share icon (which pulled the column off-center) and
/// Gauntlet's dead-end "Play again tomorrow"; same share behavior (and spoiler chooser)
/// as before. Founder 10-02 follow-up ("we can't give up board room"): it sits IN the
/// dock's action row beside Next daily / Leaderboard (`NextDailyCTA(share:)`) at the
/// row's medium (42 pt) height — no row of its own — and on a daily the "Next <Game> in
/// 3h 12m" countdown rides inside it as a small second line (dropped on short screens).
struct FinishedShareCTA: View {
    /// False for shares with no tiles to spoil — skips the variant chooser.
    var hasSpoilers: Bool = true
    /// The game's name for the countdown line (dailies only); nil = no line.
    var nextGame: String? = nil
    /// Bool = "Full results" (letters revealed); false = spoiler-free card.
    let onShare: (Bool) -> Void

    @State private var showShareOptions = false
    /// The chooser's pick, consumed by the sheet's onDismiss (see ShareVariantSheet).
    @State private var shareReveal: Bool?

    var body: some View {
        Button {
            if hasSpoilers { showShareOptions = true } else { onShare(false) }
        } label: {
            if let nextGame, !FinishLayoutMetrics.isShort {
                // Refreshed on each minute boundary; the glyph steps aside for the two lines.
                TimelineView(.everyMinute) { _ in
                    let line = FinishCloseScreen.countdownLine(game: nextGame, seconds: secondsUntilLocalMidnight())
                    CandyLabel(title: "Share results", subtitle: line) { EmptyView() }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Share results. \(line)")
                }
            } else {
                CandyLabel(title: "Share results") { Icon3D(.share, size: 20) }
            }
        }
        .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium))
        .sheet(isPresented: $showShareOptions,
               onDismiss: { if let r = shareReveal { shareReveal = nil; onShare(r) } }) {
            ShareVariantSheet(selection: $shareReveal).presentationDetents([.height(260)])
        }
    }

    /// The game's display name for the countdown line ("Classic", "Gauntlet").
    static func gameName(_ mode: GameMode) -> String {
        ModeGen.byDbKey(mode.rawValue)?.title ?? ModeStyle.title(mode).capitalized
    }
}

struct FinishedResultStrip: View {
    let won: Bool
    /// ("4/6", "guesses"), ("0:48", "time")… in order.
    let items: [(value: String, label: String)]
    var points: Int? = nil

    var body: some View {
        HStack(spacing: 6) {
            ResultBadge(won: won, size: 24)
            ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                chip(it.value, it.label, i == 0 ? Color(hex: 0x7C3AED) : Color(hex: 0x2563EB))
            }
            if let points {
                chip(points.formatted(.number.grouping(.automatic)), "pts", Color(hex: 0xF5A524))
            }
            // Founder 10-02: an invisible twin of the badge balances the row, so the
            // chips sit on the screen's center line (the leading badge pulled them right).
            ResultBadge(won: won, size: 24).hidden().accessibilityHidden(true)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .accessibilityElement(children: .combine)
    }

    private func chip(_ value: String, _ label: String, _ c: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(value).softNumber(15)
            Text(label).font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.secondary)
        }
        .padding(.horizontal, 9).padding(.top, 7).padding(.bottom, 4)
        .tintedPill(c)
    }
}

// MARK: - §R3 The Unlimited card

/// FINISH_SPEC §R3: Pro players' "KEEP PLAYING" card — a peach-tinted card with
/// U floating in her loop of candy tiles (`art-scene-unlimited-loop`, ~64 pt, a
/// slow orbit wobble), "Unlimited <Game>" + "Fresh puzzles, no waiting", and a
/// peach candy "Play" (no infinity glyph, §Y). After an UNLIMITED game it is the primary
/// action: a big "NEW PUZZLE" plus a small "Other games" that opens the picker.
/// Founder 10-02 (R3 update): free players and guests see the SAME card with a small
/// gold PRO pill on the button; tapping it opens the G1 Go Pro paywall (ProView —
/// guests sign in there first and land back on it), and once Pro is active the card
/// starts the Unlimited game directly. Callers no longer gate it on Pro.
struct UnlimitedKeepPlayingCard: View {
    /// The game's name ("Classic").
    let game: String
    /// After an Unlimited game: NEW PUZZLE is the primary action.
    var afterUnlimited: Bool = false
    /// FINISH_SPEC BA1: on short screens the card collapses to ONE small peach candy
    /// ("Unlimited" with the mini U-loop icon) that sits in the action row.
    var mini: Bool = false
    let action: () -> Void
    var onOtherGames: (() -> Void)? = nil
    /// Founder 10-02: after an Unlimited game the SHARE RESULTS candy (`FinishedShareCTA`)
    /// leads the card's action row — no row of its own.
    var share: AnyView? = nil

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @ObservedObject private var auth = AuthService.shared
    @State private var showPro = false
    /// Set when the paywall opened from this card, so a purchase starts the game.
    @State private var startAfterPurchase = false

    private var locked: Bool { !auth.isProActive }

    /// Pro: play. Free / guest: the Go Pro paywall, then play once Pro is active.
    private func tap() {
        if locked {
            startAfterPurchase = true
            showPro = true
        } else {
            action()
        }
    }

    private static let peach = Color(hex: 0xFB923C)

    var body: some View {
        if mini && !afterUnlimited { miniButton } else { card }
    }

    /// BA1: the one-button form — same candy family, the U loop art as its icon.
    private var miniButton: some View {
        Button(action: tap) {
            CandyLabel(title: "Unlimited") {
                if ArtAsset.exists("art-scene-unlimited-loop") {
                    ArtThumbs.image("art-scene-unlimited-loop", points: 26)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: 26, height: 22)
                } else {
                    MascotView(.u, size: 22)
                }
            }
        }
        // ~38 pt tall: the small candy on its own slim line.
        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
        .overlay(alignment: .topTrailing) { if locked { proPill.offset(x: 6, y: -8) } }
        .accessibilityLabel(locked ? "Keep playing: Unlimited \(game). Pro" : "Keep playing: Unlimited \(game)")
        .sheet(isPresented: $showPro, onDismiss: {
            if startAfterPurchase && auth.isProActive { ProWelcomeCenter.shared.afterWelcome { action() } }
            startAfterPurchase = false
        }) { ProView() }
        .onChange(of: auth.isProActive) { pro in
            if pro && showPro { showPro = false }
        }
    }

    /// §AD: no idle wobble with Reduce Motion or in Low Power Mode.
    private var wobbling: Bool { !(envReduce || Theme.reduceMotion) && !Motion.calm() }

    private var card: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Group {
                    if ArtAsset.exists("art-scene-unlimited-loop") {
                        // BJ2: the slow orbit wobble (±4°, ±2 pt, 2.6 s each way) on Core
                        // Animation — the SwiftUI repeatForever rebuilt the whole finished
                        // screen every frame (40–75% main thread under an 8-board recap).
                        LoopArt(image: ArtThumbs.uiImage("art-scene-unlimited-loop", points: 96)
                                    ?? UIImage(named: "art-scene-unlimited-loop"),
                                wobble: wobbling ? 4 : 0, wobbleShift: 2, wobblePeriod: 2.6)
                    } else {
                        MascotView(.u, size: 56)
                    }
                }
                .frame(width: 64, height: 64)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("KEEP PLAYING")
                        .font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(Color(hex: 0xA2560C))
                    Text("Unlimited \(game)").font(Brand.font(16, .black)).foregroundStyle(FinishInk.heading)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Text("Fresh puzzles, no waiting").font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !afterUnlimited {
                    Button(action: tap) { CandyLabel(title: "Play") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium, fullWidth: false))
                        .overlay(alignment: .topTrailing) { if locked { proPill.offset(x: 6, y: -8) } }
                        .accessibilityLabel(locked ? "Keep playing: Unlimited \(game). Pro" : "Keep playing: Unlimited \(game)")
                }
            }
            if afterUnlimited {
                HStack(spacing: 8) {
                    if let share { share }
                    Button(action: tap) { CandyLabel(title: "New puzzle") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .large))
                        .overlay(alignment: .topTrailing) { if locked { proPill.offset(x: -6, y: -8) } }
                        .accessibilityLabel("New Unlimited \(game) puzzle")
                    if let onOtherGames {
                        Button(action: onOtherGames) { CandyLabel(title: "Other games") }
                            .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                    }
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .tintedCard(accent: Self.peach, bar: [Color(hex: 0xFFD6C2), Self.peach], radius: 18, barHeight: 6, tint: 0.10, line: 0.30)
        // The G1 Go Pro paywall (guests sign in inside it first). A purchase closes it
        // and starts the Unlimited game directly.
        .sheet(isPresented: $showPro, onDismiss: {
            // FINISH_SPEC §AP: a first purchase opens Welcome to Pro on top — the
            // Unlimited game starts once LET'S PLAY closes it (immediately otherwise).
            if startAfterPurchase && auth.isProActive { ProWelcomeCenter.shared.afterWelcome { action() } }
            startAfterPurchase = false
        }) { ProView() }
        .onChange(of: auth.isProActive) { pro in
            if pro && showPro { showPro = false }
        }
    }

    /// The small gold PRO pill on a locked button.
    private var proPill: some View {
        HStack(spacing: 2) {
            Icon3D(.crown, size: 11)
            Text("PRO").font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Color(hex: 0x7A3D00))
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xFFE08A), Color(hex: 0xF5A524)], startPoint: .top, endPoint: .bottom)))
        .overlay(Capsule().strokeBorder(Color(hex: 0xB0650B).opacity(0.5), lineWidth: 1))
        .accessibilityHidden(true)
    }
}
