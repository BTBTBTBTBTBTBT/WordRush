import SwiftUI

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
                        .frame(minHeight: minBoardHeight)
                        dock()
                        if hasExtras { moreChip(proxy) }
                    }
                    .frame(height: max(page.size.height, minBoardHeight + 220))
                    if showMore {
                        extras().id("finished-more")
                    }
                }
            }
            .scrollDisabled(!showMore && page.size.height >= minBoardHeight + 220)
            }
        }
        // BA1: on short screens every title art in the finished header caps at ~56 pt.
        .environment(\.finishedTitleCap, FinishLayoutMetrics.isShort ? 56 : nil)
    }

    private func moreChip(_ proxy: ScrollViewProxy) -> some View {
        Button {
            Haptics.tap()
            withAnimation(Theme.animation(Motion.spring)) { showMore.toggle() }
            if !showMore { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                withAnimation(Theme.animation(.easeInOut(duration: 0.35))) { proxy.scrollTo("finished-more", anchor: .top) }
            }
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

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @ObservedObject private var auth = AuthService.shared
    @State private var wobble = false
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

    private var card: some View {
        let still = envReduce || Theme.reduceMotion
        return VStack(spacing: 10) {
            HStack(spacing: 10) {
                Group {
                    if ArtAsset.exists("art-scene-unlimited-loop") {
                        ArtThumbs.image("art-scene-unlimited-loop", points: 96)   // §AQ2: slot-sized
                            .resizable().interpolation(.high).scaledToFit()
                    } else {
                        MascotView(.u, size: 56)
                    }
                }
                .frame(width: 64, height: 64)
                .rotationEffect(.degrees(wobble ? 4 : -4))
                .offset(y: wobble ? -2 : 2)
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
        .onAppear {
            guard !still, !Motion.calm() else { return }   // §AD: no idle wobble in Low Power Mode
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) { wobble = true }
        }
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
