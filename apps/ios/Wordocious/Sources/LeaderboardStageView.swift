import SwiftUI
import WordociousCore

// FRIDAY-QUEUE items 11 + 11b (iOS): the Leaderboard is ONE living stage. These are its pieces; LeaderboardTab
// composes them: the day's bubble title with YOUR mascot and the day's cast host, the game picker with no card,
// the selected-game strip (art, "N today", your rank + stats, the compact Your board pill), the Everyone/Friends
// + share line, the podium, and Yesterday's winners as the stage's base ledge — all on ONE continuous backdrop
// whose tint is the selected game's (a game switch sweeps the tint through every layer together).
// Shared constants: core LeaderboardStage (parity with packages/core/src/leaderboard-stage.ts).
// Web: components/leaderboard/leaderboard-stage.tsx · Android: LeaderboardStageKit.kt.

/// The stage container + its continuous backdrop.
struct LeaderboardStageCard<Content: View>: View {
    let accent: Color
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) { content() }
            .background { LeaderboardStageBackdrop(accent: accent) }
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

/// Sky wash in the game's tint (strongest on top), clouds, the sunburst light behind the podium, the floor glow.
struct LeaderboardStageBackdrop: View {
    let accent: Color

    var body: some View {
        ZStack(alignment: .top) {
            LinearGradient(stops: [
                .init(color: accent.opacity(LeaderboardStage.skyTop), location: 0),
                .init(color: accent.opacity(LeaderboardStage.skyMid), location: 0.52),
                .init(color: accent.opacity(LeaderboardStage.skyBottom), location: 1),
            ], startPoint: .top, endPoint: .bottom)
            Image("art-lb-clouds").resizable().scaledToFit()
                .frame(maxWidth: .infinity).opacity(0.75).offset(y: -6)
                .accessibilityHidden(true)
            VStack { Spacer(minLength: 0)
                Image("art-lb-sunburst").resizable().scaledToFit()
                    .frame(maxWidth: .infinity).scaleEffect(1.3, anchor: .bottom)
                    .opacity(LeaderboardStage.rays).blendMode(.softLight)
                    .accessibilityHidden(true)
            }
            VStack { Spacer(minLength: 0)
                RadialGradient(colors: [accent.opacity(LeaderboardStage.floorGlow), accent.opacity(0)],
                               center: .bottom, startRadius: 0, endRadius: 170)
                    .frame(height: 60)
            }
        }
        .animation(Theme.reduceMotion ? nil : .easeInOut(duration: 0.38), value: accent.description)
        .allowsHitTesting(false)
    }
}

/// The player's own mascot, full body (alive when the living mascot is on): their look, else W waving.
struct StageOwnMascot: View {
    let size: CGFloat
    @ObservedObject private var directory = AvatarDirectory.shared

    var body: some View {
        Group {
            switch directory.ownHostChoice() {
            case .photo:
                if let h = directory.ownHostPhoto() {
                    AvatarView(url: h.url, username: h.username, size: size * 0.92, userId: h.userId)
                }
            case .mascot(let config):
                let initial = AvatarCatalog.initial(AuthService.shared.profile?.username ?? HostLookCache.load()?.username)
                if LivingMascotView.canAnimate(config) {
                    LivingMascotView(config: config, initial: initial, size: size, cutout: true, interactive: false)
                } else {
                    MascotCutout(config: config, initial: initial, size: size)
                }
            case .w:
                PoseImage(.w, "wave", height: size)
            }
        }
        .frame(width: size, height: size)
        .shadow(color: Color(hex: 0x4C1D95).opacity(0.16), radius: 2.5, x: 0, y: 2)
        .accessibilityHidden(true)
    }
}

/// Row 1 of the stage: [your mascot] · the day's title in bubble lettering · [the day's cast host], filling the
/// width; the date + reset clock is ONE small line under it.
struct StageTitleRow: View {
    private static let ink = Color(hex: 0x8A4A12)

    var body: some View {
        TimelineView(.everyMinute) { _ in
            let day = LeaderboardService.todayLocal()
            let title = LeaderboardBannerView.todayTitle()
            let host = LeaderboardStage.host(day: day)
            VStack(spacing: 1) {
                HStack(alignment: .bottom, spacing: 2) {
                    StageOwnMascot(size: 62)
                    BubbleTextView(text: title, palette: .leaderboard, maxSize: 30, minSize: 20)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 10)
                    ArtThumbs.image("art-pose-\(host.castId)-\(host.pose)", points: 70)
                        .resizable().interpolation(.high).scaledToFit()
                        .frame(width: 66, height: 66)
                        .scaleEffect(x: -1, y: 1)
                        .shadow(color: Color(hex: 0x3C1478).opacity(0.22), radius: 4, x: 0, y: 3)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: 76)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(title)
                .accessibilityAddTraits(.isHeader)
                // Ticks once a second for the reset clock; the date flips at local midnight.
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let date = ctx.date.formatted(.dateTime.month(.abbreviated).day()).uppercased()
                    Text("\(date) · RESETS IN \(LeaderboardBannerView.resetClock())")
                        .font(Brand.font(10.5, .black)).tracking(0.6).monospacedDigit()
                        .foregroundStyle(Theme.isDark ? Theme.textSecondary : Self.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .padding(.horizontal, 10).padding(.top, 8)
        }
    }
}

/// The compact "Your board" pill (`art-lb-btn-yourboard`, label drawn live) = today's VIEW BOARD.
struct YourBoardPill: View {
    var label = "Your board"
    let action: () -> Void

    var body: some View {
        Button { Haptics.light(); action() } label: {
            ZStack {
                Image("art-lb-btn-yourboard").resizable().scaledToFit()
                Text(label.uppercased())
                    .font(Brand.font(11.5, .black)).tracking(0.3)
                    .foregroundStyle(Color(hex: 0x4C1D95))
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .padding(.leading, 30).padding(.trailing, 8)
            }
            .frame(width: 112, height: 36)
        }
        .buttonStyle(.squishCard)
        .accessibilityLabel(label)
    }
}

/// The stage's base: the "Yesterday" ledge art with yesterday's top three as small mascots on its steps; tap to expand
/// the full list in place (`expanded`). `minis` are place-ordered (1st, 2nd, 3rd).
struct StageYesterdayLedge<Expanded: View, Share: View>: View {
    let minis: [PodiumEntry]
    @Binding var open: Bool
    let loading: Bool
    @ViewBuilder var share: () -> Share
    @ViewBuilder var expanded: () -> Expanded
    private static var artAspect: CGFloat { 394.0 / 160.0 }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Button { Haptics.light(); withAnimation(.easeInOut(duration: 0.22)) { open.toggle() } } label: {
                    HStack(spacing: 4) {
                        Text("YESTERDAY").font(Brand.font(11, .black)).tracking(1.2)
                            .foregroundStyle(Theme.isDark ? Theme.textMuted : LbStyle.goldInk)
                        Image(systemName: open ? "chevron.up" : "chevron.down").font(.system(size: 10, weight: .black))
                            .foregroundStyle(Theme.isDark ? Theme.textMuted : LbStyle.goldInk)
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.squishCard)
                Spacer(minLength: 4)
                if open { share() }
            }
            GeometryReader { geo in
                let w = min(geo.size.width, 394)
                ZStack {
                    Image("art-lb-ledge").resizable().scaledToFit().frame(width: w)
                        .accessibilityHidden(true)
                    if !loading {
                        ForEach(LeaderboardStage.ledgeSteps, id: \.place) { step in
                            if let e = minis.first(where: { ($0.rank ?? 0) == step.place }) {
                                StageLedgeFigure(entry: e, size: w * CGFloat(LeaderboardStage.ledgeFigureFraction))
                                    .position(x: w * CGFloat(step.x) + (geo.size.width - w) / 2,
                                              y: w / Self.artAspect * CGFloat(step.top) - w * CGFloat(LeaderboardStage.ledgeFigureFraction) * 0.38)
                            }
                        }
                        if minis.isEmpty {
                            Text("No results from yesterday").font(Brand.font(11.5, .heavy))
                                .foregroundStyle(FinishInk.secondary)
                                .position(x: geo.size.width / 2, y: w / Self.artAspect * 0.3)
                        }
                    }
                }
                .frame(width: geo.size.width, height: w / Self.artAspect)
                .contentShape(Rectangle())
                .onTapGesture { Haptics.light(); withAnimation(.easeInOut(duration: 0.22)) { open.toggle() } }
            }
            .aspectRatio(Self.artAspect, contentMode: .fit)
            .frame(maxWidth: 394)
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(open ? "Hide yesterday's winners" : "Show yesterday's winners")
            if open { expanded().transition(.opacity) }
        }
        .padding(.horizontal, 12).padding(.bottom, 8)
    }
}

/// One mini winner standing on a ledge step (their mascot, a little alive when the living mascot is on).
private struct StageLedgeFigure: View {
    let entry: PodiumEntry
    let size: CGFloat
    @ObservedObject private var directory = AvatarDirectory.shared

    var body: some View {
        let r = directory.look(username: entry.username, userId: entry.id, url: entry.avatarUrl, castId: nil, frame: nil,
                               mascot: nil, accentHex: LetterTileAvatar.defaultAccentHex(username: entry.username, accentHex: entry.accentHex),
                               lookup: true).resolved
        let initial = AvatarCatalog.initial(entry.username)
        Group {
            if r.photoUrl == nil {
                if LivingMascotView.canAnimate(r.config) {
                    LivingMascotView(config: r.config, initial: initial, size: size, cutout: true, interactive: false)
                } else {
                    MascotCutout(config: r.config, initial: initial, size: size)
                }
            } else {
                AvatarView(url: entry.avatarUrl, username: entry.username, size: size * 0.8, userId: entry.id)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
