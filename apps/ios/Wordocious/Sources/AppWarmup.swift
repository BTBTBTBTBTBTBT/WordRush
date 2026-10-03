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
        HomeHostMascot.prewarm()   // BJ6: the Good Morning host's pose, before Home paints
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

    /// Today's Muddle cartoon into URLCache (its /muddle/ URLs are immutable,
    /// cached a year), so the panel paints at once instead of after a download.
    /// Once per local day; called from Home.
    @MainActor private static var cartoonDay: String?
    @MainActor static func prefetchMuddleCartoon() {
        let today = LeaderboardService.todayLocal()
        guard cartoonDay != today else { return }
        cartoonDay = today
        Task.detached(priority: .utility) {
            guard let bank = ScrambleBankStore.shared,
                  let cartoon = scramblePuzzleForDay(bank, day: today, holidays: HolidayTable.bundled)?.cartoon,
                  let url = URL(string: "https://wordocious.com/muddle/\(cartoon)") else { return }
            let req = URLRequest(url: url)
            if URLCache.shared.cachedResponse(for: req) != nil { return }
            // AsyncImage loads through URLSession.shared — same cache.
            _ = try? await URLSession.shared.data(for: req)
        }
    }
}
