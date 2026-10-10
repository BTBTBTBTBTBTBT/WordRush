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
    /// Wizard Wednesday: the wizard hat for the day (display-only, never saved).
    var wizardHat = false
    @ObservedObject private var directory = AvatarDirectory.shared

    var body: some View {
        Group {
            switch directory.ownHostChoice() {
            case .photo:
                if let h = directory.ownHostPhoto() {
                    AvatarView(url: h.url, username: h.username, size: size * 0.92, userId: h.userId)
                }
            case .mascot(let stored):
                let initial = AvatarCatalog.initial(AuthService.shared.profile?.username ?? HostLookCache.load()?.username)
                let config: AvatarConfig = {
                    guard wizardHat else { return stored }
                    var c = stored; c.head = LeaderboardStage.wizardHatPart; return c
                }()
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
    /// Tapping your mascot: it hops and the title letters bounce again (the title re-mounts, replaying its pop).
    @State private var taps = 0
    @State private var hop: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var envReduce

    private func tapMascot() {
        Haptics.light()
        taps += 1
        guard !(envReduce || Theme.reduceMotion) else { return }
        withAnimation(.easeOut(duration: 0.14)) { hop = -14 }
        withAnimation(.interpolatingSpring(stiffness: 260, damping: 9).delay(0.14)) { hop = 0 }
    }

    var body: some View {
        TimelineView(.everyMinute) { _ in
            let day = LeaderboardService.todayLocal()
            let title = LeaderboardBannerView.todayTitle()
            let host = LeaderboardStage.host(day: day)
            VStack(spacing: 1) {
                HStack(alignment: .bottom, spacing: 2) {
                    // Your mascot leans toward the title (base fixed); a tap hops it and bounces the letters.
                    StageOwnMascot(size: 62, wizardHat: LeaderboardStage.wearsWizardHat(day: day))
                        .rotationEffect(.degrees(envReduce || Theme.reduceMotion ? 0 : LeaderboardStage.mascotLeanDegrees), anchor: .bottom)
                        .offset(y: hop)
                        .contentShape(Rectangle())
                        .onTapGesture { tapMascot() }
                        .accessibilityHidden(false)
                        .accessibilityLabel("Your mascot")
                        .accessibilityAddTraits(.isButton)
                    BubbleTextView(text: title, palette: .leaderboard, maxSize: 30, minSize: 20)
                        .id(taps)
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
                // The weekday's prop floats beside the title with its own little motion.
                .overlay(alignment: .topTrailing) {
                    StageDayProp(prop: LeaderboardStage.dayProp(day: day)).padding(.trailing, 70).offset(y: -4)
                }
                // Ticks once a second for the reset clock; the date flips at local midnight.
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let date = ctx.date.formatted(.dateTime.month(.abbreviated).day()).uppercased()
                    // It sits on the pale clouds in every theme (Halloween night too): always the dark warm ink.
                    Text("\(date) · RESETS IN \(LeaderboardBannerView.resetClock())")
                        .font(Brand.font(10.5, .black)).tracking(0.6).monospacedDigit()
                        .foregroundStyle(Self.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .padding(.horizontal, 10).padding(.top, 8)
            // Founder 10-09: the title's cloud bank glows from behind (a warm gold light), so it reads as lit, not pasted.
            .background(alignment: .center) {
                RadialGradient(colors: [Color(hex: 0xFFD978).opacity(0.62), Color(hex: 0xFFB04A).opacity(0.22), .clear],
                               center: .center, startRadius: 4, endRadius: 210)
                    .scaleEffect(x: 1.25, y: 0.75)
                    .blur(radius: 10)
                    .padding(-24)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
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
        // Known and empty: no ledge (a blank podium reads unfinished), just one calm line beside the header.
        let empty = !loading && minis.isEmpty
        VStack(spacing: 4) {
            HStack {
                if empty {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("YESTERDAY").font(Brand.font(11, .black)).tracking(1.2)
                            .foregroundStyle(Theme.isDark ? Theme.textMuted : LbStyle.goldInk)
                        Text("No results from yesterday").font(Brand.font(11.5, .bold))
                            .foregroundStyle(FinishInk.secondary)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                } else {
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
                }
                Spacer(minLength: 4)
                if open && !empty { share() }
            }
            if !empty {
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
            }
            if open && !empty { expanded().transition(.opacity) }
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

/// The weekday's prop beside the Leaderboard title, each with its own motion (parity with web `.lb-prop-*`):
/// spin (sun), bob (coffee), hover (rocket), swish (wand), flash (lightning), drift (rainbow cloud). Reduce Motion: still.
struct StageDayProp: View {
    let prop: LeaderboardStage.DayProp
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        let image = Image(prop.art).resizable().scaledToFit().frame(width: 40, height: 40).accessibilityHidden(true).allowsHitTesting(false)
        if envReduce || Theme.reduceMotion {
            image
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { ctx in
                let p = Self.pose(prop.motion, t: ctx.date.timeIntervalSinceReferenceDate)
                image.scaleEffect(p.scale).rotationEffect(.degrees(p.rotation)).offset(x: p.dx, y: p.dy).opacity(p.opacity)
            }
        }
    }

    struct Pose { var dx: CGFloat = 0; var dy: CGFloat = 0; var rotation: Double = 0; var scale: CGFloat = 1; var opacity: Double = 1 }

    private static func ease(_ t: Double, _ period: Double) -> Double { (1 - cos(2 * .pi * t / period)) / 2 }

    /// Piecewise-linear through (phase, value) stops, phase in 0...1.
    private static func keys(_ phase: Double, _ stops: [(Double, Double)]) -> Double {
        guard let first = stops.first, let last = stops.last else { return 0 }
        if phase <= first.0 { return first.1 }
        for i in 1..<stops.count where phase <= stops[i].0 {
            let (a, b) = (stops[i - 1], stops[i])
            return a.1 + (b.1 - a.1) * (phase - a.0) / max(b.0 - a.0, 0.0001)
        }
        return last.1
    }

    static func pose(_ motion: String, t: Double) -> Pose {
        switch motion {
        case "spin": return Pose(rotation: (t / 18).truncatingRemainder(dividingBy: 1) * 360)
        case "bob": let p = ease(t, 2.8); return Pose(dy: CGFloat(-4 * p), rotation: -3 + 6 * p)
        case "hover": let p = ease(t, 3.2); return Pose(dy: CGFloat(-6 * p), rotation: -4 + 6 * p)
        case "swish":
            let ph = (t / 3.6).truncatingRemainder(dividingBy: 1)
            return Pose(rotation: keys(ph, [(0, 0), (0.55, 0), (0.62, -24), (0.72, 20), (0.82, -8), (0.90, 0), (1, 0)]))
        case "flash":
            let ph = (t / 3.4).truncatingRemainder(dividingBy: 1)
            return Pose(scale: CGFloat(keys(ph, [(0, 1), (0.70, 1), (0.74, 1.22), (0.78, 0.96), (0.84, 1.12), (0.92, 1), (1, 1)])),
                        opacity: keys(ph, [(0, 1), (0.74, 1), (0.78, 0.75), (0.84, 1), (1, 1)]))
        default: return Pose(dx: CGFloat(6 * sin(2 * .pi * t / 12)))   // drift
        }
    }
}
