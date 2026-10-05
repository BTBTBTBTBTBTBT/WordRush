import SwiftUI
import WordociousCore

/// 4-tab shell with a custom bottom nav that matches the web BottomNav
/// (components/ui/bottom-nav.tsx): outline icon + muted label when inactive,
/// filled icon + purple label + a 4px dot when active. The system tab bar is
/// hidden; a custom `BottomNav` is added via safeAreaInset so each tab's
/// content (and its ad banner) insets above it, while TabView keeps every tab's
/// state alive.
struct RootTabView: View {
    /// SceneStorage (2026-10-05, Android rememberSaveable parity): when iOS kills the
    /// backgrounded app, the relaunch restores the tab the player was on.
    @SceneStorage("wordocious.root-tab") private var tab: Tab = .home
    // Leaderboard's navigation stack lives here so tab gestures can reset it:
    // re-tapping the active Leaderboard tab pops to root, and leaving the tab
    // clears it so returning shows the leaderboard (not the profile you left on).
    @State private var leaderboardPath: [String] = []
    /// §AJ: the Friends tab's stack, so a tab tap can pop it.
    @State private var friendsPath: [String] = []
    @ObservedObject private var router = TabRouterModel.shared
    @ObservedObject private var chrome = ChromeVisibility.shared
    /// Universal-link VS invites (wordocious.com/vs/join/*) present from the
    /// tab root — same cover the pending-invite banner accept uses.
    @ObservedObject private var deepLink = DeepLink.shared
    /// Founder 10-05: every dress-up door (own avatar taps, the Home host, the party-hat offer) opens here.
    @ObservedObject private var dressUp = DressUp.shared
    /// Post-game "Next Daily" handoff (NextDailyCTA): the tapped mode's daily,
    /// presented from the tab root so it works no matter which tab/screen
    /// presented the game that just finished.
    @State private var nextDaily: HomeMode?
    /// Post-game "Keep playing: Unlimited <Mode>" handoff (Pro): a fresh
    /// unlimited game of the mode the player just finished, presented from the
    /// tab root exactly like the Next Daily cover.
    @State private var unlimitedGame: UnlimitedLaunch?
    /// A root cover presentation that arrived while a game cover was STILL
    /// dismissing (NextDailyCTA's 0.6s post-dismiss delay can lose to a
    /// main-thread hitch — recording writes, confetti). Presenting while the
    /// old cover's dismissal is in flight is the classic way the shell's
    /// layout latches mid-transition, so the present waits for the all-clear.
    @State private var pendingRootPresent: (() -> Void)?

    /// An unlimited run minted by the playUnlimited handler — identified by
    /// seed so Play Again (which swaps in a fresh seed) re-presents the cover.
    struct UnlimitedLaunch: Identifiable {
        let mode: HomeMode
        let seed: String
        var id: String { seed }
    }

    /// D1 of the Stats + Friends redesign (founder, 2026-09-26, "option 2"): Profile and
    /// Records merge into Stats; Friends gets its own tab. Web bottom-nav.tsx / Android
    /// MainScreen carry the same four.
    enum Tab: String, Hashable { case home, leaderboard, stats, friends }
    struct SafariURLItem: Identifiable { let id = UUID(); let url: URL }

    init() {
        DictionaryLoader.ensureInitialized()
        // The system tab bar is fully replaced by the custom BottomNav below.
        // `.toolbar(.hidden, for: .tabBar)` alone can FLASH the default (dark
        // translucent) system bar mid-transition when a fullScreenCover game
        // dismisses — hide the UIKit bar globally so it can never render.
        UITabBar.appearance().isHidden = true
    }

    /// Fresh unlimited seed for a mode, minted the way HomeView does —
    /// "unlimited-<MODE>-<epoch>", recorded under "unlimited-current-<MODE>"
    /// for engine modes so the home grid resumes it if the player bails
    /// mid-game (PN keys its own saves off the seed, no marker needed).
    private func mintUnlimitedSeed(_ m: HomeMode) -> String {
        guard let gm = m.mode else {
            // Custom engines mint the same seeds HomeView does: Sudoku's carries
            // its difficulty, Starsweep's its board size (read back by the engine).
            let ts = Int(Date().timeIntervalSince1970)
            switch m.id {
            case "sudoku": return "unlimited-SUDOKU-\(ts)-medium"
            case "regions": return "unlimited-REGIONS-\(ts)-8"
            case "ladder": return "unlimited-LADDER-\(ts)"
            case "wordsearch": return "unlimited-WORDSEARCH-\(ts)"
            case "hub": return "unlimited-HUB-\(ts)"
            case "cryptogram": return "unlimited-CRYPTOGRAM-\(ts)"
            case "groups": return "unlimited-GROUPS-\(ts)"
            case "crossword": return "unlimited-CROSSWORD-\(ts)"
            case "scramble": return "unlimited-SCRAMBLE-\(ts)"
            default: return "unlimited-PROPERNOUNDLE-\(ts)"
            }
        }
        let fresh = "unlimited-\(gm.rawValue)-\(Int(Date().timeIntervalSince1970))"
        UserDefaults.standard.set(fresh, forKey: "unlimited-current-\(gm.rawValue)")
        return fresh
    }

    /// Present a root cover only when no immersive screen (a dismissing game
    /// cover) is still on screen — immediately if already clear, otherwise the
    /// moment ChromeVisibility reports the all-clear (see onChange below).
    private func presentAfterCoverClears(_ launch: @escaping () -> Void) {
        // BI10: a queued present still fires only if Home wasn't pressed meanwhile.
        let at = Date()
        let present = { if HomeNav.handoffAllowed(since: at) { launch() } }
        if chrome.bottomNavHidden {
            pendingRootPresent = present
            // §263 failsafe: a pushed view whose onDisappear never fired once
            // left the chrome "hidden" forever — the bottom nav vanished and this
            // present waited for an all-clear that never came. If the exiting
            // cover hasn't reported out within 1.5s (dismissal takes ~0.4s),
            // assume the gate is stale: clear it and present anyway.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                guard let p = pendingRootPresent else { return }
                pendingRootPresent = nil
                chrome.reset()
                p()
            }
        } else {
            present()
        }
    }

    /// Tab selection with stack-reset side effects (web-like tab behavior).
    /// FINISH_SPEC §AJ: every tap runs core `TabRouter` — Home from anywhere
    /// dismisses overlays, pops every stack and lands on Home's root at the top;
    /// re-tapping the current tab pops it to its root. (A live VS match lives in a
    /// full-screen cover that hides this nav, and the match's own Home control
    /// already confirms the forfeit, so `liveVSMatch` is never true here.)
    private var tabSelection: Binding<Tab> {
        Binding(
            get: { tab },
            set: { newTab in
                let state = TabRouterState(
                    tab: Self.appTab(tab),
                    depth: [.leaderboard: leaderboardPath.count, .friends: friendsPath.count,
                            .home: router.pushed.contains(.home) ? 1 : 0,
                            .stats: router.pushed.contains(.stats) ? 1 : 0],
                    overlays: TabRouterModel.rootPresented ? 1 : 0)
                for action in TabRouter.tap(Self.appTab(newTab), in: state) {
                    switch action {
                    case .dismissOverlays: TabRouterModel.dismissAllOverlays()
                    case .popToRoot(let t):
                        switch t {
                        case .leaderboard: leaderboardPath = []
                        case .friends: friendsPath = []
                        case .home, .stats: router.popToRoot(t)
                        }
                    case .select(let t):
                        // Leaving the Leaderboard resets it to root (unchanged behavior).
                        if tab == .leaderboard && t != .leaderboard { leaderboardPath = [] }
                        tab = Self.tab(t)
                        router.current = t
                    case .scrollToTop(let t):
                        NotificationCenter.default.post(name: TabRouterModel.scrollToTop, object: t.rawValue)
                    case .confirmForfeit: break
                    }
                }
            })
    }

    private static func appTab(_ t: Tab) -> AppTab {
        switch t { case .home: return .home; case .leaderboard: return .leaderboard; case .stats: return .stats; case .friends: return .friends }
    }

    private static func tab(_ t: AppTab) -> Tab {
        switch t { case .home: return .home; case .leaderboard: return .leaderboard; case .stats: return .stats; case .friends: return .friends }
    }

    var body: some View {
        TabView(selection: tabSelection) {
            HomeView().tag(Tab.home).tabItem { Label("Home", systemImage: "house") }
            LeaderboardTab(path: $leaderboardPath).tag(Tab.leaderboard).tabItem { Label("Leaderboard", systemImage: "trophy") }
            ProfileTab().tag(Tab.stats).tabItem { Label("Stats", systemImage: "chart.bar") }
            NavigationStack(path: $friendsPath) {
                // The bottom-nav inset does not reach this ScrollView's tail (founder, 2026-09-26:
                // "I can't scroll all the way to the bottom") — pad by the chrome height like a push.
                FriendsScreenView(padsForChrome: true, asTab: true)
                    .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            }
            .tag(Tab.friends).tabItem { Label("Friends", systemImage: "person.2") }
        }
        .toolbar(.hidden, for: .tabBar)
        #if DEBUG
        // FINISH_SPEC BJ3: the perf tour's presenter (idle unless `-perfTour`).
        .background { PerfTourHost { tabSelection.wrappedValue = Self.tab($0) } }
        #endif
        // Hide the nav while an immersive screen (a game / solved puzzle) is up
        // so it's full-screen like the web — it otherwise bleeds onto pushed
        // views and steals the height the keyboard/boards need.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // §252: the ad banner that used to sit above the nav in this inset
            // is gone. Banner RPM is pennies and it taxed every screen of a
            // daily-habit game; the game-start interstitial carries the free
            // tier instead. The VStack stays — the height measurement below
            // still has to report the nav's own height to pushed screens.
            // §AW: hidden only under a PUSHED immersive screen; a dismissing game
            // cover finds the nav already in place (no wait, no layout jump).
            if !chrome.navHidden {
                VStack(spacing: 0) {
                    BottomNav(selection: tabSelection)
                }
                // Report the banner+nav height: this safeAreaInset only pads
                // each tab's ROOT view — SwiftUI does not extend it to views
                // pushed onto the tab's NavigationStack, so a pushed screen
                // (PublicProfileView) scrolls its tail underneath the nav
                // unless it pads by this measured height itself.
                .background(GeometryReader { g in
                    Color.clear
                        .onAppear { chrome.bottomInset = g.size.height }
                        .onChange(of: g.size.height) { chrome.bottomInset = $0 }
                })
            }
        }
        // Pin the nav to the PHYSICAL bottom, never the keyboard safe area.
        // Without this, a system keyboard raised OVER a game cover (the share
        // sheet's Messages compose — the same lingering inset GameScreen
        // already defends against with its own .ignoresSafeArea(.keyboard))
        // can latch on this root hosting controller when the hide lands while
        // the hierarchy is covered or mid-dismissal: the safeAreaInset then
        // holds the nav at keyboard-top height — MID-SCREEN, on every tab,
        // with scroll content flowing under it, until an app restart. Founder
        // hit this repeatedly after finishing dailies. All in-app text entry
        // lives in sheets/covers (own hosting, unaffected) except VSLobbyView's
        // join-code field, which now restores its own keyboard inset locally.
        .ignoresSafeArea(.keyboard)
        // Post-game "Next Daily" handoff: launch the requested mode's daily via
        // the same path the Leaderboard Play CTA uses (GameScreen with today's
        // seed; the own-engine view with a nil seed for ProperNoundle and the
        // More Games titles). The CTA dismisses its own game first, then
        // posts, so this cover presents cleanly from the root.
        // FINISH_SPEC §AY: a screen's top-left Home button — the footer's Home route.
        .onReceive(NotificationCenter.default.publisher(for: HomeNav.goHome)) { _ in
            #if DEBUG
            PerfTour.mark("goHome.root"); DispatchQueue.main.async { PerfTour.mark("goHome.root.nextTurn") }
            #endif
            // FINISH_SPEC BI10: Home means NO game — drop a queued root present and clear
            // the root's own game covers through their bindings (a cover dismissed only by
            // UIKit keeps its binding set, and SwiftUI presents it again on a later update).
            pendingRootPresent = nil
            nextDaily = nil
            unlimitedGame = nil
            let state = TabRouterState(
                tab: Self.appTab(tab),
                depth: [.leaderboard: leaderboardPath.count, .friends: friendsPath.count,
                        .home: router.pushed.contains(.home) ? 1 : 0,
                        .stats: router.pushed.contains(.stats) ? 1 : 0],
                overlays: TabRouterModel.rootPresented ? 1 : 0)
            for action in HomeButtonRules.route(from: state) {
                switch action {
                case .dismissOverlays: TabRouterModel.dismissAllOverlays(animated: true)
                case .popToRoot(let t):
                    switch t {
                    case .leaderboard: leaderboardPath = []
                    case .friends: friendsPath = []
                    case .home, .stats: router.popToRoot(t)
                    }
                case .select(let t):
                    if tab == .leaderboard && t != .leaderboard { leaderboardPath = [] }
                    tab = Self.tab(t)
                    router.current = t
                case .scrollToTop(let t):
                    NotificationCenter.default.post(name: TabRouterModel.scrollToTop, object: t.rawValue)
                case .confirmForfeit: break
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NextDailyCTA.playNextDaily)) { note in
            // BI10: a Home press after the tap cancels the handoff.
            guard let key = note.object as? String, HomeNav.handoffAllowed(note) else { return }
            presentAfterCoverClears { nextDaily = (homeModes + moreModes).first { $0.dbKey == key } }
        }
        .gameCover(item: $nextDaily, hint: { $0.dbKey }) { m in
            NavigationStack {
                if let gm = m.mode {
                    GameScreen(seed: DailySeed.today(mode: gm), mode: gm, title: m.title)
                } else {
                    // Own-engine dailies (nil seed = today's), exactly as
                    // HomeView.openFromMoreGames presents them.
                    switch m.id {
                    case "sudoku": SudokuView()
                    case "regions": RegionsView()
                    case "ladder": LadderView()
                    case "wordsearch": SpyglassView()
                    case "hub": HubView()
                    case "cryptogram": CodebreakerView()
                    case "groups": KindredView()
                    case "crossword": CrosswordView()
                    case "scramble": MuddleView()
                    default: ProperNoundleView()   // ProperNoundle daily (dbKey set, no engine mode)
                    }
                }
            }
        }
        // Post-game "Keep playing: Unlimited <Mode>" (Pro): mint a fresh
        // unlimited seed exactly like HomeView does (and remember it as the
        // mode's current unlimited game so Home resumes it if abandoned), then
        // present the same GameScreen/ProperNoundleView the home grid uses.
        .onReceive(NotificationCenter.default.publisher(for: NextDailyCTA.openLeaderboard)) { note in
            guard HomeNav.handoffAllowed(note) else { return }   // BI10
            // §214: LeaderboardTab preselects the mode itself (same note);
            // the root just lands the player on the Leaderboard tab.
            tab = .leaderboard
            // §263 failsafe: landing on a tab root with the nav still hidden
            // means a dismissed game never reported out — clear the gate.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                if chrome.bottomNavHidden { chrome.reset() }
            }
        }
        // D2 step 3: the Records sheet's "Your personal records → Stats" link.
        .onReceive(NotificationCenter.default.publisher(for: .openStats)) { _ in
            tab = .stats
        }
        .onReceive(NotificationCenter.default.publisher(for: NextDailyCTA.playUnlimited)) { note in
            guard let key = note.object as? String, HomeNav.handoffAllowed(note),   // BI10
                  let m = (homeModes + moreModes).first(where: { $0.dbKey == key }) else { return }
            presentAfterCoverClears { unlimitedGame = UnlimitedLaunch(mode: m, seed: mintUnlimitedSeed(m)) }
        }
        // Flush a deferred root present the moment the exiting game cover has
        // fully left (its .hidesBottomNav onDisappear fires at dismissal end),
        // plus one beat so UIKit's presentation bookkeeping settles.
        .onChange(of: chrome.bottomNavHidden) { hidden in
            guard !hidden, let present = pendingRootPresent else { return }
            pendingRootPresent = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { present() }
        }
        .gameCover(item: $unlimitedGame, hint: { $0.mode.dbKey }) { g in
            NavigationStack {
                if let gm = g.mode.mode {
                    GameScreen(seed: g.seed, mode: gm, title: g.mode.title, onPlayAgain: {
                        // Same as HomeView's Play Again: fresh seed, re-present.
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    // Item swaps don't rebuild the @StateObject — key on the
                    // seed so Play Again gets a fresh board (HomeView parity).
                    .id(g.seed)
                } else if g.mode.id == "sudoku" {
                    // Sudoku unlimited from "Keep playing": explicit seed = non-daily run;
                    // Play Again / difficulty switch mints a fresh seed carrying the pick.
                    SudokuView(seed: g.seed, onPlayAgain: { d in
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: "unlimited-SUDOKU-\(Int(Date().timeIntervalSince1970))-\(d.rawValue)")
                    })
                    .id(g.seed)
                } else if g.mode.id == "regions" {
                    RegionsView(seed: g.seed, onPlayAgain: { n in
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: "unlimited-REGIONS-\(Int(Date().timeIntervalSince1970))-\(n)")
                    })
                    .id(g.seed)
                } else if g.mode.id == "ladder" {
                    LadderView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else if g.mode.id == "wordsearch" {
                    SpyglassView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else if g.mode.id == "hub" {
                    HubView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else if g.mode.id == "cryptogram" {
                    CodebreakerView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else if g.mode.id == "groups" {
                    KindredView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else if g.mode.id == "crossword" {
                    CrosswordView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else if g.mode.id == "scramble" {
                    MuddleView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                } else {
                    // ProperNoundle unlimited: explicit seed = non-daily run.
                    ProperNoundleView(seed: g.seed, onPlayAgain: {
                        unlimitedGame = UnlimitedLaunch(mode: g.mode, seed: mintUnlimitedSeed(g.mode))
                    })
                    .id(g.seed)
                }
            }
        }
        // Foreground return on a NEW local day (WordociousApp posts) → land on
        // Home like a cold start: dismiss the root-level solo game covers and
        // reset the tab. The unlimited board's save survives (resumable from
        // the Unlimited grid); live VS covers are deliberately left alone.
        .onReceive(NotificationCenter.default.publisher(for: .dayRolledOver)) { _ in
            pendingRootPresent = nil   // a queued next-daily belongs to yesterday
            nextDaily = nil
            unlimitedGame = nil
            leaderboardPath = []
            tab = .home
        }
        // A More Games / Puzzles link lands on Home, which scrolls to PUZZLES.
        .onReceive(deepLink.$puzzlesRequest) { req in if req != nil { tab = .home } }
        // A tab restored from SceneStorage must be the router's current tab too.
        .onAppear { router.current = Self.appTab(tab) }
        // A Friends push (/friends) lands on the Friends tab.
        .onReceive(deepLink.$friendsRequest) { req in if req != nil { tab = .friends } }
        // A pocket-game push (/friends/games/<id>) → that game's screen.
        .gameCover(item: $deepLink.friendlyGame, onDismiss: { Task { await FriendlyGamesService.load() } }) { link in
            FriendlyGameScreen(gameId: link.id)
        }
        // Universal-link VS invite → straight into the private match, exactly
        // like accepting a pending-invite banner (VSGameView handles the rest).
        .gameCover(item: $deepLink.vsInvite) { inv in
            NavigationStack { VSGameView(mode: inv.mode, inviteCode: inv.code) }
        }
        // A challenge link or push (/vs/challenge/<code>) → the race flow; its
        // VS HOME closes the cover.
        .gameCover(item: $deepLink.vsChallenge) { link in
            NavigationStack { VSChallengeRaceView(code: link.code) }
        }
        // "Someone's looking" push (/vs/live/<MODE>) → that mode's live search,
        // same as LIVE in the lobby (Pro); without Pro, the Pro page.
        .gameCover(item: $deepLink.vsLive) { link in
            VSLiveLaunch(mode: link.mode)
        }
        // Password-recovery universal link → native set-new-password sheet
        // (session already established by DeepLink's code exchange).
        .softSheet(isPresented: $deepLink.showNewPasswordSheet) { NewPasswordSheet() }
        .softSheet(item: $dressUp.request) { req in EditProfileView(start: req.door) }
        // Cross-device auth links can't exchange in-app (PKCE verifier lives
        // on the requesting client) → finish on the web page in-app.
        .sheet(item: Binding(
            get: { deepLink.safariFallbackURL.map { SafariURLItem(url: $0) } },
            set: { _ in deepLink.safariFallbackURL = nil })) { item in
            SafariSheet(url: item.url)
        }
    }
}

/// Shared toggle for the app chrome (bottom nav). Immersive full-screen views
/// call `.hidesBottomNav()`. Tracks the set of currently-present immersive
/// screens by a per-screen ID rather than a counter: each screen's contribution
/// is isolated, so a stray `exit` from one view can't un-hide the nav while
/// another (e.g. a pushed game) is still up — the counter version drifted to 0
/// on unpaired appear/disappear (fullScreenCover dismiss, canceled swipe-back),
/// which let the nav bleed back onto live game screens.
final class ChromeVisibility: ObservableObject {
    static let shared = ChromeVisibility()
    private init() {}
    @Published private var activeIDs: Set<UUID> = []
    /// Measured height of the banner+nav safeAreaInset. Views PUSHED onto a
    /// tab's NavigationStack don't inherit that inset (root views do), so
    /// they read this to pad their own scroll content clear of the nav.
    @Published var bottomInset: CGFloat = 0
    /// FINISH_SPEC §AW: the immersive screens that actually HIDE the nav — only
    /// ones pushed onto a tab's stack. A game in a full-screen cover already covers
    /// the nav, so it never hides it: the nav is simply there, mounted and laid out,
    /// the instant the cover slides away (it used to wait for the cover's
    /// onDisappear at the END of the dismissal, then pop in with a layout jump).
    @Published private var hidingIDs: Set<UUID> = []
    /// An immersive screen is still on screen (incl. a cover mid-dismissal) — the
    /// root-present gates and celebrations wait on this.
    var bottomNavHidden: Bool { !activeIDs.isEmpty }
    /// Whether the docked nav is hidden (a pushed immersive screen is up).
    var navHidden: Bool { !hidingIDs.isEmpty }
    func enter(_ id: UUID, hidesNav: Bool = true) {
        activeIDs.insert(id)
        if hidesNav { hidingIDs.insert(id) }
    }
    func exit(_ id: UUID) {
        activeIDs.remove(id)
        hidingIDs.remove(id)
    }
    /// §263: drop every registration — for the failsafes in RootTabView when a
    /// view that hid the nav has demonstrably left without reporting out.
    func reset() { activeIDs.removeAll(); hidingIDs.removeAll() }

    /// §AW: whether a modal presentation (a full-screen cover or sheet) is up — a
    /// screen appearing inside one never needs to hide the nav underneath.
    static func inModalPresentation() -> Bool {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        return windows.contains { $0.rootViewController?.presentedViewController != nil }
    }
}

private struct ImmersiveChrome: ViewModifier {
    @State private var id = UUID()
    func body(content: Content) -> some View {
        content
            .onAppear { ChromeVisibility.shared.enter(id, hidesNav: !ChromeVisibility.inModalPresentation()) }
            .onDisappear { ChromeVisibility.shared.exit(id) }
    }
}

extension View {
    /// Hide the app's bottom nav while this view is on screen (full-screen play).
    func hidesBottomNav() -> some View { modifier(ImmersiveChrome()) }
}

/// Custom bottom navigation. FINISH_SPEC §A4: DOCKED — flush to the bottom edge,
/// edge to edge and opaque (the page content ends above it; nothing shows under
/// it), a soft page-tinted gradient (lilac Home, warm Leaderboard, blue Stats, pink
/// Friends) with a faint top line, and the home-indicator area is part of the bar.
/// Each tab icon squishes on tap.
private struct BottomNav: View {
    @Binding var selection: RootTabView.Tab
    // Pending friend-request badge on Friends (Tier 1, Aug 11; moved from Profile
    // in D1): pushes were the only signal before — a missed push meant a request
    // nobody saw. Friends overhaul §5: + pocket games waiting on your move.
    // FINISH_SPEC §M: the count is everything waiting on the player in Friends,
    // minus what they've already seen (FriendsBadgeStore); opening Friends clears it.
    @ObservedObject private var badge = FriendsBadgeStore.shared
    @Environment(\.accessibilityReduceMotion) private var envReduce
    /// The Friends icon's happy wiggle when a new item arrives (±8°, 2 swings).
    @State private var wiggle: Double = 0
    /// The badge's spring-in (scale 0 → 1.15 → 1).
    @State private var badgeScale: CGFloat = 1
    private func recount() {
        badge.recount()
        if selection == .friends { badge.markSeen() }
    }

    var body: some View {
        HStack(spacing: 0) {
            item(.home, .tabHome, "Home")
            item(.leaderboard, .tabLeaderboard, "Leaderboard")
            item(.stats, .tabStats, "Stats")
            item(.friends, .tabFriends, "Friends", badge: badge.count)
        }
        .padding(.top, 8).padding(.bottom, 2)
        .frame(maxWidth: .infinity)
        .background(bar.ignoresSafeArea(edges: .bottom))
        .task {
            await LaunchGate.wait()   // §AU5: after the cold-start intro lands
            await FriendsService.load()
            await FriendlyGamesService.load()
            recount()
            await badge.loadChallenges()
            recount()
        }
        .onChange(of: selection) { t in if t == .friends { badge.markSeen() } }
        .onChange(of: badge.arrivals) { _ in celebrateArrival() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in recount() }
        .onReceive(NotificationCenter.default.publisher(for: FriendlyGamesService.changed)) { _ in recount() }
    }

    /// §M: a new item springs the badge in and wiggles the Friends icon (Reduce Motion: none).
    private func celebrateArrival() {
        // BI7: silent — a background arrival is not something the player did (the badge still springs).
        guard !(envReduce || Theme.reduceMotion) else { return }
        badgeScale = 0
        withAnimation(.spring(response: 0.38, dampingFraction: 0.45)) { badgeScale = 1 }
        Task { @MainActor in
            for angle in [8.0, -8.0, 8.0, -8.0, 0.0] {
                withAnimation(.easeInOut(duration: 0.11)) { wiggle = angle }
                try? await Task.sleep(nanoseconds: 110_000_000)
            }
        }
    }

    /// The bar's tint for the page on screen (game-kit.html `.tabbar`).
    private var tint: [Color] {
        // Season surfaces: the season's night plum (raised -> card), so the bar belongs to the wall.
        if let look = SeasonKit.surfaces, let card = look.card { return [look.raised ?? card, card] }
        if Theme.isDark { return [Color(hex: 0x221A38), Color(hex: 0x181028)] }
        switch selection {
        case .home: return [Color(hex: 0xF7F1FF), Color(hex: 0xECE0FF)]
        case .leaderboard: return [Color(hex: 0xFFF8EA), Color(hex: 0xFFEBC8)]
        case .stats: return [Color(hex: 0xF1F6FF), Color(hex: 0xDFEAFF)]
        case .friends: return [Color(hex: 0xFFF2F8), Color(hex: 0xFCE0EE)]
        }
    }

    /// Opaque, page-tinted, a faint top line and a soft upward shadow.
    private var bar: some View {
        LinearGradient(colors: tint, startPoint: .top, endPoint: .bottom)
            .overlay(alignment: .top) {
                Rectangle().fill(SeasonKit.surfaces?.card != nil ? Color(hex: 0xF97316).opacity(0.22) : Color(hex: 0x7C3AED).opacity(0.14)).frame(height: 1)
            }
            .shadow(color: Color(hex: 0x4C1D95).opacity(0.08), radius: 8, x: 0, y: -6)
            .animation(Theme.animation(.easeInOut(duration: 0.2)), value: selection)
    }

    /// HEADER_SPEC §3: the 3D tab icons at 28 pt. Selected: full color and the label
    /// in #6d28d9 900 with a 3 pt purple underline pill under it; unselected: the
    /// icon at 55% opacity and 60% saturation with a lilac-grey label. Badges stay
    /// numeric. The icon squishes on press (§A3 / §A9).
    private func item(_ t: RootTabView.Tab, _ icon: Icon3DName, _ label: String, badge: Int = 0) -> some View {
        let active = selection == t
        return Button {
            selection = t
            Haptics.tap()
        } label: {
            VStack(spacing: 2) {
                Icon3D(icon, size: 28)
                    .saturation(active ? 1 : 0.6)
                    .opacity(active ? 1 : 0.55)
                    .rotationEffect(.degrees(t == .friends ? wiggle : 0), anchor: .bottom)
                    .overlay(alignment: .topTrailing) {
                        if badge > 0 {
                            // FINISH_SPEC §M: the glossy candy count badge (pulses while unseen).
                            CandyCountBadge(count: badge, size: 18, pulse: true)
                                .scaleEffect(badgeScale)
                                .offset(x: 11, y: -6)
                        }
                    }
                Text(label)
                    .font(Brand.font(11, active ? .black : .heavy))
                    .foregroundStyle(active ? (SeasonKit.surfaces?.card != nil ? Color(hex: 0xFDBA74) : Color(hex: 0x6D28D9))
                                     : (Theme.isDark ? Theme.textMuted : Color(hex: 0x8A78AD)))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                // The selected tab's underline pill (a clear slot otherwise, so no tab shifts).
                Capsule().fill(active ? (SeasonKit.surfaces?.card != nil ? Color(hex: 0xF97316) : Color(hex: 0x7C3AED)) : .clear)
                    .frame(width: 22, height: 3)
                    .padding(.top, 1)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishIcon)
        .accessibilityLabel(badge > 0 ? "\(label), \(badge) new" : label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

/// The /vs/live/<MODE> push target: a Pro player lands in that mode's live
/// search (LIVE in the lobby); anyone else gets the Pro page (it has Close).
private struct VSLiveLaunch: View {
    let mode: GameMode
    @ObservedObject private var auth = AuthService.shared

    var body: some View {
        if auth.isProActive {
            NavigationStack { VSGameView(mode: mode, intent: .live) }
        } else {
            ProView()
        }
    }
}
