import SwiftUI
import WordociousCore

/// ACTIVITY (Friends D3.2, §290) — the Friends tab's feed: the last seven
/// days of your circle's moments — Daily Sweeps, Flawless Victories, podium /
/// perfect / streak medals, all-time records set, More Games Sweeps — newest
/// first, each friend's row a door to the profile. Read-only over
/// GET /api/friends/feed (FriendsService.fetchFeed). Native twin of
/// components/friends/activity-feed.tsx. Friends overhaul (2026-10-01, spec
/// §6): titled MOMENTS on a white card, finished pocket games join the feed,
/// and every moment takes the fixed reactions (clap, fire, wow, grr, Rematch on games).
/// §10 (founder, iOS 220): chips show only when a moment has reactions, small
/// and inside its card; double-tap toggles clap, long-press floats the reaction
/// bar above the card (tap outside to dismiss).
struct ActivityFeedView: View {
    /// Friends overhaul §6: a Rematch reaction on a game moment opens the
    /// quick-play sheet with that game and friend.
    var onRematch: ((FriendlyKind, String) -> Void)? = nil

    /// The session's last feed in the FIRST frame (founder, 2026-09-29: every open of the Friends
    /// screen — the Leaderboard sheet, a profile push, the first tab visit — flashed the 3-row
    /// skeleton, then the feed snapped in at a different height). Refreshed underneath as before.
    @State private var events: [FriendsService.FeedEvent]? = StatsMemo.shared.get(Self.memoKey)
    private static var memoKey: String { "friendsFeed:\(StatsMemo.uid)" }
    @State private var reactions: [String: FriendsService.MomentReactions] = [:]
    /// The moment whose floating reaction bar is open (long-press).
    @State private var picking: String?
    /// A friend's moment tapped once → their profile.
    @State private var profileId: String?
    @State private var expanded = false
    @State private var pulse = false
    /// §AM1: when each "<moment>:<key>" was last picked (uptime) — drives its pop + burst.
    @State private var poppedAt: [String: TimeInterval] = [:]

    private static let purple = Color(hex: 0x7C3AED)
    private static let shown = 8

    /// The fixed reaction set (server keys → their word). §AM1: drawn as our 3D
    /// art / word pills (`ReactionGlyph`), never the system emoji.
    static let reactionKeys: [(key: String, label: String)] = ["clap", "fire", "wow", "grr", "rematch"].map { ($0, Reaction.word($0)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            FriendsSectionHeader(title: "MOMENTS") {
                Text("LAST 7 DAYS · DOUBLE-TAP OR HOLD TO REACT").font(Brand.font(8.5, .black)).tracking(0.6)
                    .foregroundStyle(FriendsInk.section).lineLimit(1).minimumScaleFactor(0.7)
            }
            if let events {
                if events.isEmpty {
                    // R asleep over the quiet feed (ART_SPEC §7).
                    // BI24: brand headline over R's voice line.
                    BrandEmptyState(title: "Quiet week so far",
                                    line: "Sweeps, medals, records and wins from your circle show up here.",
                                    scene: .asleep, artHeight: 80, colors: [Color(hex: 0xDB2777), Color(hex: 0x7C3AED)],
                                    lineColor: FriendsInk.muted)
                        .frame(maxWidth: .infinity)
                        .friendsCard(accent: FriendsInk.pink)
                } else {
                    let today = FriendsService.localDay()
                    let shownEvents = expanded ? events : Array(events.prefix(Self.shown))
                    let poses = Self.assignPoses(shownEvents)
                    // FINISH_SPEC §K1: every moment is its own notice card in the
                    // event's color.
                    VStack(spacing: 6) {
                        ForEach(shownEvents) { e in
                            moment(e, today: today, pose: poses[e.id])
                                .zIndex(picking == e.id ? 1 : 0)
                        }
                    }
                    if events.count > Self.shown {
                        Button {
                            if Theme.reduceMotion { expanded.toggle() }
                            else { withAnimation(.easeInOut(duration: 0.15)) { expanded.toggle() } }
                        } label: {
                            CandyLabel(title: expanded ? "Show less" : "Show all \(events.count)")
                        }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                        .frame(maxWidth: .infinity)
                    }
                }
            } else {
                // Skeleton while the feed loads.
                VStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(FriendsInk.pink.wash(0.12)).frame(height: 32)
                    }
                }
                .opacity(pulse ? 0.45 : 1)
                .onAppear {
                    guard !Theme.reduceMotion else { return }
                    withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
                }
                .padding(14)
                .friendsCard(accent: FriendsInk.pink)
            }
        }
        // Tap outside the floating bar to dismiss it: an oversized catcher behind
        // the feed (it doesn't take layout space).
        .background {
            if picking != nil {
                Color.white.opacity(0.001)
                    .frame(width: 4000, height: 8000)
                    .contentShape(Rectangle())
                    .onTapGesture { withAnimation(.easeOut(duration: 0.15)) { picking = nil } }
            }
        }
        .navigationDestination(isPresented: Binding(get: { profileId != nil }, set: { if !$0 { profileId = nil } })) {
            if let id = profileId { PublicProfileView(userId: id) }
        }
        .task(id: AuthService.shared.profile?.id) {
            guard AuthService.shared.profile != nil else { return }
            if let fresh = await FriendsService.fetchFeedWithReactions() {
                events = fresh.events
                reactions = fresh.reactions
                StatsMemo.shared.set(Self.memoKey, fresh.events)
            } else if events == nil {
                events = []
            }
        }
    }

    /// One moment: its notice card (§K1 — the row, the reaction chips when it has
    /// any, the candy action), double-tap → clap, hold → the floating reaction bar,
    /// tap → the profile.
    private func moment(_ e: FriendsService.FeedEvent, today: String, pose: Pose?) -> some View {
        let open = picking == e.id
        let look = Self.look(e)
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return VStack(alignment: .leading, spacing: 6) {
            row(e, today: today, pose: pose)
            // §AS5: the chips / Rematch row only when there's something in it.
            if hasFooter(e) {
                HStack(spacing: 6) {
                    reactionChips(e)
                    Spacer(minLength: 0)
                    action(e)
                }
            }
        }
        .padding(.horizontal, 10).padding(.top, 8).padding(.bottom, 8)
        .friendsCard(accent: look.color, bar: [look.color, look.color.mixed(over: .white, 0.7)], radius: 16,
                     barHeight: 5, tint: e.me ? 0.12 : 0.08, line: 0.26)
        .overlay(shape.stroke(open ? FriendsKit.solid.opacity(0.6) : .clear, lineWidth: 2).allowsHitTesting(false))
        .contentShape(shape)
        .onTapGesture(count: 2) {
            picking = nil
            // §AM1: the pick plays the candy press sound (the bar's squish buttons do it on touch-down).
            SoundManager.shared.play(.press)
            toggle(e, "clap")
        }
        .onTapGesture {
            if picking != nil { withAnimation(.easeOut(duration: 0.15)) { picking = nil }; return }
            if !e.me { profileId = e.userId }
        }
        .onLongPressGesture(minimumDuration: 0.35) {
            Haptics.tap()
            if Theme.reduceMotion { picking = e.id }
            else { withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { picking = e.id } }
        }
        .overlay(alignment: .top) {
            if open {
                reactionBar(e)
                    .alignmentGuide(.top) { $0[.bottom] + 6 }
                    .transition(.scale(scale: 0.8, anchor: .bottom).combined(with: .opacity))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint(e.me ? "" : "Opens the profile")
        .accessibilityActions {
            ForEach(options(e), id: \.key) { o in
                Button("React \(o.label)") { toggle(e, o.key) }
            }
        }
    }

    private func row(_ e: FriendsService.FeedEvent, today: String, pose: Pose?) -> some View {
        let d = Self.describe(e)
        let score = Self.scoreText(e)
        let headline = score.map { d.text.replacingOccurrences(of: " (\($0))", with: "") } ?? d.text
        // BJ7: one top line — avatar, headline and the small pose top-aligned; the
        // score + day 4 under the headline.
        return HStack(alignment: .top, spacing: 10) {
            // The sender's letter tile (§20; an uploaded photo stays a circle).
            AvatarView(url: e.avatar_url, username: e.username, size: 36, emoji: e.avatar_emoji)
                .overlay(alignment: .bottomTrailing) {
                    Group {
                        if e.type == "game", let k = e.friendlyKind {
                            FriendlyGameIcon(kind: k, size: 18, glow: false)
                        } else {
                            SymbolGlyph(d.symbol, size: 10, weight: .bold, color: d.color)
                                .frame(width: 18, height: 18)
                                .background(Circle().fill(d.color.wash(0.16)))
                                .overlay(Circle().stroke(d.color.wash(0.45), lineWidth: 1))
                        }
                    }
                    .offset(x: 5, y: 4)
                }
            VStack(alignment: .leading, spacing: 4) {
                Text(headline).font(Brand.font(13, .black)).foregroundStyle(FriendsInk.heading)
                    .lineLimit(2).multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    if let score {
                        Text(score).softNumber(14, color: VsLobbyKit.numberInk)
                    }
                    Text(Self.dayLabel(e.day, today: today)).font(Brand.font(10, .bold)).foregroundStyle(FriendsInk.rowSub)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if e.type == "gift" {
                // §T4: a shield gift wears the small shield-guard art (U guarding the flame).
                FriendsSceneArt(asset: "art-scene-shield-guard", height: 38, maxWidth: 48, spring: false)
            } else if let pose {
                // §K1: a small cast pose that fits the event (decorative, §A7 variety).
                PoseImage(pose.id, pose.pose, height: 38)
            }
        }
    }

    /// §K1: the small candy action where the moment already has one — Rematch on a
    /// pocket game (the Rematch reaction's quick play).
    @ViewBuilder private func action(_ e: FriendsService.FeedEvent) -> some View {
        if e.type == "game", e.friendlyKind != nil, onRematch != nil {
            Button {
                let r = reactions[e.id] ?? .init(counts: [:], mine: [])
                if r.mine.contains("rematch") {
                    // Already reacted: just open quick play again.
                    let friendId = e.me ? e.otherId : e.userId
                    if let friendId, let kind = e.friendlyKind { onRematch?(kind, friendId) }
                } else {
                    toggle(e, "rematch")
                }
            } label: {
                CandyLabel(title: "Rematch", symbol: "arrow.counterclockwise")
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
            .accessibilityLabel("Rematch")
        }
        // FINISH_SPEC §AS5: no "View" button — tapping the row (or the avatar) opens
        // the player's profile, so the rows stay short.
    }

    // MARK: §K1 event looks + poses

    struct Pose: Equatable { let id: MascotID; let pose: String }

    /// The event's notice color (its card wash + top bar).
    static func look(_ e: FriendsService.FeedEvent) -> (color: Color, poses: [Pose]) {
        let viewer = AuthService.shared.profile?.id
        switch e.type {
        case "game":
            if e.kind == "draw" { return (Color(hex: 0x0EA5E9), [Pose(id: .u, pose: "lotus"), Pose(id: .c, pose: "lean")]) }
            // "Doug beat you": O2 gasps.
            if !e.me, let other = e.otherId, other.caseInsensitiveCompare(viewer ?? "") == .orderedSame {
                return (FriendsInk.pink, [Pose(id: .o2, pose: "gasp"), Pose(id: .o3, pose: "laugh")])
            }
            return (FriendsInk.purple, [Pose(id: .s, pose: "trophy"), Pose(id: .w, pose: "cheer"), Pose(id: .i, pose: "cheer")])
        case "flawless": return (Color(hex: 0xF59E0B), [Pose(id: .d, pose: "cheer"), Pose(id: .o2, pose: "twirl")])
        case "sweep": return (Color(hex: 0x7C3AED), [Pose(id: .s, pose: "slide"), Pose(id: .s, pose: "flex")])
        case "more_flawless", "more_sweep": return (Color(hex: 0x4F46E5), [Pose(id: .c, pose: "cheer"), Pose(id: .c, pose: "telescope")])
        case "gift": return (Color(hex: 0x0D9488), [Pose(id: .u, pose: "meditate"), Pose(id: .u, pose: "tea")])
        case "record": return (Color(hex: 0xD97706), [Pose(id: .d, pose: "eureka"), Pose(id: .d, pose: "notes")])
        default:
            let k = e.kind ?? ""
            if k == "gold" { return (Color(hex: 0xF5A524), [Pose(id: .w, pose: "proud"), Pose(id: .w, pose: "victory")]) }
            if k == "silver" { return (Color(hex: 0x8D99B0), [Pose(id: .i, pose: "giggle"), Pose(id: .i, pose: "victory")]) }
            if k == "bronze" { return (Color(hex: 0xD9844A), [Pose(id: .r, pose: "cheer"), Pose(id: .r, pose: "cocoa")]) }
            if k == "perfect" { return (Color(hex: 0x10B981), [Pose(id: .i, pose: "cheer"), Pose(id: .o3, pose: "handstand")]) }
            if k.hasPrefix("streak_") { return (Color(hex: 0xF97316), [Pose(id: .s, pose: "stopwatch"), Pose(id: .s, pose: "ready")]) }
            return (Color(hex: 0x7C3AED), [Pose(id: .w, pose: "wave")])
        }
    }

    /// §A7: never the same image twice on the screen — each shown moment takes its
    /// event's first unused pose, else any unused cast pose (never O1, the page host).
    static func assignPoses(_ events: [FriendsService.FeedEvent]) -> [String: Pose] {
        let pool: [Pose] = [MascotID.w, .r, .d, .o2, .c, .i, .o3, .u, .s].flatMap { id in
            ["ready", "victory", "goodgame", "waiting"].map { Pose(id: id, pose: $0) }
        }
        var used: [Pose] = []
        var out: [String: Pose] = [:]
        for e in events where e.type != "gift" {
            let preferred = look(e).poses
            if let p = preferred.first(where: { !used.contains($0) }) ?? pool.first(where: { !used.contains($0) }) {
                used.append(p)
                out[e.id] = p
            }
        }
        return out
    }

    /// A score / value shown as a soft number: a pocket game's "2–1", a record's value.
    static func scoreText(_ e: FriendsService.FeedEvent) -> String? {
        switch e.type {
        case "game":
            guard let s = e.score, s.first?.isNumber == true else { return nil }
            return s
        default:
            return nil
        }
    }

    // MARK: Reactions (§6, §10)

    private func options(_ e: FriendsService.FeedEvent) -> [(key: String, label: String)] {
        let isGame = e.type == "game"
        return Self.reactionKeys.filter { $0.key != "rematch" || isGame }
    }

    /// Small chips inside the card, only for reactions that have a count.
    /// Whether a moment shows its footer row (reaction chips or the Rematch action).
    private func hasFooter(_ e: FriendsService.FeedEvent) -> Bool {
        let r = reactions[e.id] ?? .init(counts: [:], mine: [])
        let chips = options(e).contains { (r.counts[$0.key] ?? 0) > 0 }
        return chips || (e.type == "game" && e.friendlyKind != nil && onRematch != nil)
    }

    @ViewBuilder private func reactionChips(_ e: FriendsService.FeedEvent) -> some View {
        let r = reactions[e.id] ?? .init(counts: [:], mine: [])
        let shown = options(e).filter { (r.counts[$0.key] ?? 0) > 0 }
        if !shown.isEmpty {
            HStack(spacing: 5) {
                ForEach(shown, id: \.key) { o in
                    chip(o.key, label: o.label, count: r.counts[o.key] ?? 0, mine: r.mine.contains(o.key),
                         poppedAt: poppedAt["\(e.id):\(o.key)"] ?? 0) { toggle(e, o.key) }
                }
            }
            .padding(.leading, 46)
        }
    }

    /// §AM1: a reaction chip — our 3D art / word (never the emoji) + its soft-number count.
    private func chip(_ key: String, label: String, count: Int, mine: Bool, poppedAt: TimeInterval,
                      action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 3) {
                ReactionGlyph(key: key, size: 16, framed: false)
                Text("\(count)").softNumber(11, color: VsLobbyKit.numberInk)
            }
            .padding(.horizontal, 7).frame(minHeight: 22)
            .friendsChip(FriendsInk.pink, strong: mine)
            .reactionPop(at: poppedAt)
        }
        .buttonStyle(.squish)
        .accessibilityLabel("\(label) \(count)")
        .accessibilityAddTraits(mine ? .isSelected : [])
    }

    /// §AM1: the floating candy tray above a held moment — clap, fire, wow, grr
    /// (+ Rematch on games) as squishy 3D-art buttons with their counts; the pick
    /// pops with a little burst, then the tray tucks away.
    private func reactionBar(_ e: FriendsService.FeedEvent) -> some View {
        let r = reactions[e.id] ?? .init(counts: [:], mine: [])
        return HStack(spacing: 4) {
            ForEach(options(e), id: \.key) { o in
                let mine = r.mine.contains(o.key)
                let count = r.counts[o.key] ?? 0
                Button {
                    toggle(e, o.key)
                    // Let the pop + burst play before the tray tucks away (Reduce Motion: at once).
                    let wait = Theme.reduceMotion ? 0 : 0.32
                    DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
                        guard picking == e.id else { return }
                        withAnimation(.easeOut(duration: 0.15)) { picking = nil }
                    }
                } label: {
                    HStack(spacing: 2) {
                        ReactionGlyph(key: o.key, size: 30)
                            .reactionPop(at: poppedAt["\(e.id):\(o.key)"] ?? 0)
                        if count > 0 {
                            Text("\(count)").softNumber(12, color: VsLobbyKit.numberInk)
                        }
                    }
                    .padding(.horizontal, 4)
                    .frame(minWidth: 40, minHeight: 40)
                    .background(Capsule().fill(mine ? FriendsInk.pink.wash(0.26) : .clear))
                    .overlay(Capsule().stroke(mine ? FriendsKit.solid : .clear, lineWidth: 1.5))
                }
                .buttonStyle(.squish)
                .accessibilityLabel(o.key == "rematch" ? "Rematch" : "React \(o.label)")
                .accessibilityValue(count > 0 ? "\(count)" : "")
                .accessibilityAddTraits(mine ? .isSelected : [])
            }
        }
        // §A1 + §AM1: the popover is a tinted candy tray, never plain white.
        .reactionTray(FriendsInk.pink)
        .fixedSize()
    }

    /// Optimistic toggle; a Rematch tap on a game moment also opens quick play.
    private func toggle(_ e: FriendsService.FeedEvent, _ key: String) {
        var r = reactions[e.id] ?? .init(counts: [:], mine: [])
        let on = !r.mine.contains(key)
        if on { r.mine.append(key); r.counts[key, default: 0] += 1 }
        else { r.mine.removeAll { $0 == key }; r.counts[key] = max(0, (r.counts[key] ?? 1) - 1) }
        reactions[e.id] = r
        if on { poppedAt["\(e.id):\(key)"] = ProcessInfo.processInfo.systemUptime }
        Haptics.tap()
        Task { await FriendsService.react(momentId: e.id, ownerId: e.userId, emoji: key, on: on) }
        if key == "rematch", on, e.type == "game", let kind = e.friendlyKind {
            // The friend in it: the other player when it's your moment, else its
            // owner — the winner (also between two other friends).
            let friendId = e.me ? e.otherId : e.userId
            if let friendId { onRematch?(kind, friendId) }
        }
    }

    // MARK: copy — mirrors activity-feed.tsx describe() / dayLabel()

    struct Description { let text: String; let symbol: String; let color: Color }

    /// "Doug took gold in Classic" / "You swept the dailies" / "Amy set the
    /// all-time Six Fastest Win · 42s" / "Doug hit a 7-day streak".
    /// BJ12: the More Games dailies a More Games Sweep covers — catalog-driven
    /// (the feed route counts the same set: enabled, daily, More Games).
    static let moreSweepTotal = ModeGen.all.filter { $0.enabled && $0.group == "more" && $0.dailyEligible && $0.dbKey != nil }.count

    static func describe(_ e: FriendsService.FeedEvent) -> Description {
        let who = e.me ? "You" : e.username
        switch e.type {
        case "flawless":
            return .init(text: "\(who) won every daily — Flawless Victory", symbol: "trophy.fill", color: Color(hex: 0xB45309))
        case "sweep":
            return .init(text: "\(who) swept the dailies", symbol: "sparkles", color: purple)
        case "more_flawless":
            // BJ12: the count comes from the catalog (the feed route counts the same set).
            return .init(text: ModeCoverage.moreSweepMomentText(who: who, flawless: true, total: moreSweepTotal), symbol: "square.grid.2x2.fill", color: Color(hex: 0xB45309))
        case "more_sweep":
            return .init(text: ModeCoverage.moreSweepMomentText(who: who, flawless: false, total: moreSweepTotal), symbol: "square.grid.2x2", color: Color(hex: 0x4F46E5))
        case "game":
            // Friends overhaul §6: "Doug beat you at Tic-Tac-Tile (2–1)" /
            // "You and Kate drew at Call It".
            let other = e.otherName ?? "a friend"
            let title = e.gameTitle ?? "a game"
            if e.kind == "draw" {
                return .init(text: "\(who) and \(other) drew at \(title)", symbol: "equal.circle.fill", color: Color(hex: 0xDB2777))
            }
            let score = e.score.map { " (\($0))" } ?? ""
            return .init(text: "\(who) beat \(other) at \(title)\(score)", symbol: "gamecontroller.fill", color: Color(hex: 0xDB2777))
        case "gift":
            // D3.4 (§294): a streak shield sent to a friend.
            return .init(text: "\(who) sent \(e.otherName ?? "a friend") a streak shield", symbol: "shield.fill", color: Color(hex: 0x0D9488))
        case "record":
            // BJ12: the shared headline — "Fewest Mistakes · 0 mistakes" for Sudocious, never "Fewest Guesses".
            let meta = e.gameMode.flatMap { ModeGen.byDbKey($0) }
            let value = (e.kind != nil && e.value != nil)
                ? ModeCoverage.recordValueText(e.kind!, value: Int(e.value!), semantics: meta?.guessSemantics, guessBase: meta?.guessBase ?? 1)
                : nil
            return .init(text: ModeCoverage.modeMomentHeadline(type: "record", me: e.me, username: e.username, kind: e.kind,
                                                               gameMode: e.gameMode, gameTitle: e.gameTitle,
                                                               semantics: meta?.guessSemantics, valueText: value),
                         symbol: "star.fill", color: Color(hex: 0xD97706))
        default:
            // BJ12: the shared medal headline (Core ModeCoverage) — every game, every platform.
            let k = e.kind ?? ""
            let text = ModeCoverage.modeMomentHeadline(type: e.type, me: e.me, username: e.username, kind: e.kind,
                                                       gameMode: e.gameMode, gameTitle: e.gameTitle, semantics: nil, valueText: nil)
            if k == "gold" { return .init(text: text, symbol: "crown.fill", color: Color(hex: 0xD97706)) }
            if k == "silver" { return .init(text: text, symbol: "medal.fill", color: Color(hex: 0x9CA3AF)) }
            if k == "bronze" { return .init(text: text, symbol: "medal.fill", color: Color(hex: 0xB45309)) }
            if k == "perfect" { return .init(text: text, symbol: "star.fill", color: Theme.win) }
            if k.hasPrefix("streak_") { return .init(text: text, symbol: "flame.fill", color: Color(hex: 0xF97316)) }
            return .init(text: text, symbol: "medal", color: Theme.textMuted)
        }
    }

    /// "today" / "yesterday" / "Mon" — both days are local YYYY-MM-DD.
    static func dayLabel(_ day: String, today: String) -> String {
        if day == today { return "today" }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        guard let d = f.date(from: day), let t = f.date(from: today) else { return day }
        let diff = Int((t.timeIntervalSince(d) / 86_400).rounded())
        if diff == 1 { return "yesterday" }
        let w = DateFormatter()
        w.locale = Locale(identifier: "en_US"); w.dateFormat = "EEE"
        return w.string(from: d)
    }
}
