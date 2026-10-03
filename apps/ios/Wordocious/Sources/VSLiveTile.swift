import SwiftUI
import WordociousCore

/// VS Battle as a full-width tile at the very bottom of the game area (founder +
/// JP, 2026-09-26): the VS card and the old LIVE bar merged. Mirrors web
/// vs-live-tile.tsx. FINISH_SPEC §O2 (founder 10-02, "no drastic change"): the
/// same place and data as a teal-tinted game card with its top bar — the W-vs-S
/// faceoff as a small hero on the left (~40% of the card), and on the right the
/// LIVE line with the pulsing dot + player count, today's status line (with the
/// §21.1 W / L badge), a small Bot of the Day line with that day's bot pose, and
/// two candy buttons: PLAY (teal, primary) and INVITE (peach, Pro). The VS BATTLE
/// section title sits above the card in HomeView (§O1), never inside it.
struct VSLiveTile<Destination: View>: View {
    let mode: HomeMode
    /// The live count is observed HERE, not by Home, so a new count redraws
    /// this tile only (founder, 2026-09-29). nil until the endpoint answers.
    @ObservedObject private var live = LivePlayerCount.shared
    /// Today's daily VS result: true won, false lost, nil not played (Daily mode only).
    let vsDailyWon: Bool?
    let playMode: PlayMode
    let isPro: Bool
    let onInvite: () -> Void
    @ViewBuilder let destination: () -> Destination

    init(mode: HomeMode, vsDailyWon: Bool?, playMode: PlayMode, isPro: Bool,
         onInvite: @escaping () -> Void, @ViewBuilder destination: @escaping () -> Destination) {
        self.mode = mode; self.vsDailyWon = vsDailyWon; self.playMode = playMode
        self.isPro = isPro; self.onInvite = onInvite; self.destination = destination
    }

    private static var heroAsset: String { "art-scene-vs-faceoff" }
    /// BJ7: the card's content height (was 126 with the lines centered in dead space).
    static var height: CGFloat { 104 }

    var body: some View {
        let accent = mode.accent
        let done = playMode == .daily && vsDailyWon != nil
        let won = vsDailyWon ?? false
        let countText: String = {
            guard let n = live.count else { return "Players online" }
            return "\(n) \(n == 1 ? "player" : "players") online"
        }()
        let subtitle: String = done
            ? (won ? "Battle won!" : "Today's battle lost")
            : (playMode == .daily ? "Today's shared battle" : mode.desc)
        let bot = BotPersonas.botOfDay

        GeometryReader { geo in
            let heroW = geo.size.width * 0.40
            // BJ7: the text column top-aligned beside the hero; the card hugs its four
            // lines (104, was 126).
            HStack(alignment: .top, spacing: 10) {
                // The faceoff hero (W vs S), cropped to the two characters + the bolt.
                // Tapping it (or the text) opens VS, like the whole card did before.
                NavigationLink(destination: destination) {
                    hero(width: heroW, accent: accent)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("VS Battle, \(countText)")

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        LivePulseDot()
                        Text("LIVE").font(Brand.font(10, .black)).foregroundStyle(Theme.textPrimary)
                        // §A2: the live count as a soft number.
                        if let n = live.count {
                            Text("·").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            Text("\(n)").softNumber(13)
                            Text(n == 1 ? "player online" : "players online")
                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                                .minimumScaleFactor(0.8)
                        } else {
                            Text("· \(countText)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                        }
                    }
                    // Today's status, with the §21.1 W / L badge at the end of the line
                    // (an overlay, so it never changes the line's height).
                    Text(subtitle).font(Brand.font(12, .black))
                        .foregroundStyle(done ? (won ? Color(hex: 0x6D28D9) : Theme.textSecondary) : Theme.textPrimary)
                        .lineLimit(1).minimumScaleFactor(0.75)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.trailing, done ? 28 : 0)
                        .overlay(alignment: .trailing) {
                            if done { ResultBadge(won: won, size: 24) }
                        }
                    // Bot of the Day: that day's cast bot, in a small pose.
                    HStack(spacing: 4) {
                        PoseImage(bot.mascot, "ready", height: 20)
                        Text("Bot of the day: \(bot.name)")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .accessibilityElement(children: .combine)
                    HStack(spacing: 8) {
                        NavigationLink(destination: destination) {
                            CandyLabel(title: "Play", symbol: "play.fill")
                        }
                        .buttonStyle(CandyButtonStyle(variant: .teal, size: .small, fullWidth: false))
                        .accessibilityLabel("Play VS Battle")
                        if isPro {
                            Button(action: onInvite) {
                                CandyLabel(title: "Invite") { Icon3D(.addFriend, size: 15) }
                            }
                            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                            .accessibilityLabel("Invite")
                        }
                    }
                    .padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
        }
        .frame(height: Self.height)
        .padding(GameCardChrome.inner)
        // ART_SPEC §21.5 / §O2: the Home game-card chrome (tinted surface, radius,
        // border, lift, the colored top band in the VS teal). A completed daily wears
        // the game cards' done wash + accent border so today's battle never looks unplayed.
        .gameCardChrome(bar: accent, done: done)
    }

    /// The W-vs-S faceoff at ~40% of the card width, cropped to the characters and
    /// the bolt; the VS icon on a soft wash when the art is missing.
    @ViewBuilder private func hero(width: CGFloat, accent: Color) -> some View {
        let h: CGFloat = min(Self.height - 4, width * 0.66)
        if ArtAsset.exists(Self.heroAsset) {
            Image(Self.heroAsset)
                .resizable().interpolation(.high)
                .scaledToFill()
                .frame(width: width, height: h)
                .clipped()
                .frame(width: width, height: Self.height)
                .contentShape(Rectangle())
                .accessibilityHidden(true)
        } else {
            ModeIconView(icon: mode.icon, accent: accent, box: 40)
                .frame(width: width, height: Self.height)
                .background(RoundedRectangle(cornerRadius: 14).fill(accent.opacity(0.10)))
                .contentShape(Rectangle())
        }
    }
}
