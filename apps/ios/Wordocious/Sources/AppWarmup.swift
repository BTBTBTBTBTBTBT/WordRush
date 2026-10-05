import Foundation
import WordociousCore

/// Shared URLSessions (founder, 2026-09-29): URLSession.shared waits 60 s
/// before a stalled request fails, so a dead connection left a spinner up for
/// a minute. `api` (Supabase + app API calls) gives up after 15 s without
/// data; `upload` keeps a long timeout for photo / share-card uploads. Both
/// use URLCache.shared, which WordociousApp.init sizes before any request.
enum Net {
    static let api: URLSession = session(requestTimeout: 15)
    static let upload: URLSession = session(requestTimeout: 120)

    private static func session(requestTimeout: TimeInterval) -> URLSession {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = requestTimeout
        c.urlCache = URLCache.shared
        #if DEBUG
        // `-storeDemo`: every request is answered on device (StoreDemo.swift), nothing leaves.
        if StoreDemo.active { c.protocolClasses = [StoreDemoURLProtocol.self] + (c.protocolClasses ?? []); c.urlCache = nil }
        #endif
        return URLSession(configuration: c)
    }
}

/// Launch-time background work, all on a utility thread so the main thread
/// never pays for it (founder, 2026-09-29).
enum AppWarmup {
    /// ~2 s after launch: sweep stale Unlimited saves, then decode every
    /// bundled puzzle bank and the word-definitions dictionary, so the first
    /// open of a More Games title and the first win card never decode on main.
    /// Every store is a `static let` (thread-safe lazy init) that reads the
    /// bundle and runs JSONDecoder only — no UIKit, no main-actor state.
    static func start() {
        // FINISH_SPEC BJ2: the win / lose card's art, decoded off main ahead of time.
        FinishArt.prewarm()
        // Avatar parts + the podium pedestals, decoded off main before Home / the Leaderboard paint them.
        MascotArtCache.prewarm()
        PodiumView.prewarm()
        CastArt.prewarm()          // BJ15: cast button skins + art labels, decoded + pre-scaled off main
        HomeHostMascot.prewarm()   // BJ6: the Good Morning host's pose, before Home paints
        HeadingArt.prewarm()       // BJ16: popup / sheet heading lettering at display size, off main
        Task { @MainActor in LeaderboardArt.prewarm() }   // 10-05: the big day title + game card titles, no pop-in
        GoProSign.prewarm()        // BJ17: the GO PRO sign cast (Stats locked sections + the free finish upsell)
        Task { @MainActor in GameCoverPreview.prewarm() }   // BJ14 r7: recent games' page + header art for the open's shell
        Task { @MainActor in WidgetAvatarSnapshot.start() }   // BI13c: the player's look for the widget
        Task.detached(priority: .utility) {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            GamePersistence.shared.sweepStalePracticeSaves()
            warmBanks()
            WordDefinitions.prewarm()
        }
    }

    /// Idempotent: a store already decoded is a no-op.
    static func warmBanks() {
        _ = HolidayTable.bundled
        _ = HubBankStore.shared
        _ = CrosswordBankStore.shared
        _ = GroupsBankStore.shared
        _ = WordsearchBankStore.shared
        _ = ScrambleBankStore.shared
        _ = CryptogramBankStore.shared
        _ = LadderBankStore.shared
        ProperNoundle.prewarm()
    }

    /// Today's Muddle cartoon downloaded (URLCache: its /muddle/ URLs are immutable,
    /// cached a year) and decoded in memory, so the panel paints on its first frame.
    /// Once per local day; called from Home.
    @MainActor private static var cartoonDay: String?
    @MainActor static func prefetchMuddleCartoon() {
        let today = LeaderboardService.todayLocal()
        guard cartoonDay != today else { return }
        cartoonDay = today
        Task.detached(priority: .utility) {
            guard let bank = ScrambleBankStore.shared,
                  let cartoon = scramblePuzzleForDay(bank, day: today, holidays: HolidayTable.bundled)?.cartoon
            else { return }
            // Founder 10-03: downloaded AND decoded into memory, so the panel's first frame has it.
            _ = await MuddleCartoons.load(cartoon)
        }
    }
}
