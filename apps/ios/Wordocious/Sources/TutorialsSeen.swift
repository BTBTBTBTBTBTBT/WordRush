import SwiftUI
import WordociousCore

/// First-play tutorials, "seen" per game per player (FRIDAY-QUEUE item 12, 2.8 wave 3).
/// Signed in: profiles.tutorials_seen (text[], supabase/manual-migrations/20261010000001_tutorials_seen.sql)
/// merged with a local copy, so a new device does not re-show a card already dismissed. Guests: the local
/// copy only (UserDefaults). Until the column exists the read is empty and the write error is ignored (the
/// local copy still holds). The decision and the list math are core (PocketHelp, pinned by
/// pocket-help-fixtures.json). Keys: the guide slug for the main games ("classic", "hubbub", ...),
/// "pocket-<kind>" for the pocket games. Web twin: apps/web/lib/tutorials-seen.ts.
@MainActor
final class TutorialsSeen: ObservableObject {
    static let shared = TutorialsSeen()

    private static let localKey = "wordocious-tutorials-seen"

    /// nil until known (never show a tutorial on a guess: a signed-in player waits for the server list).
    @Published private(set) var seen: [String]?
    /// The user id whose server list is merged in already.
    private var mergedFor: String?
    /// Games played per mode (user_stats totals, dbKey -> count). nil until a signed-in player's stats
    /// land; a guest has no server stats, so `hasResults(mode:)` answers false at once.
    @Published private(set) var gamesByMode: [String: Int]?
    private var statsFor: String?

    private init() {
        // A guest (or nobody signed in) knows their list at once; a signed-in player waits for refresh().
        seen = AuthService.shared.isAuthenticated ? nil : Self.readLocal()
    }

    private static func readLocal() -> [String] {
        (UserDefaults.standard.array(forKey: localKey) as? [String]) ?? []
    }

    private static func writeLocal(_ list: [String]) {
        UserDefaults.standard.set(list, forKey: localKey)
    }

    /// Reads the server list once per signed-in user and merges it with the local copy.
    func refresh() async {
        let auth = AuthService.shared
        let local = Self.readLocal()
        guard auth.isAuthenticated else { seen = local; return }
        guard let uid = auth.profile?.id else { return }   // profile still loading: stay unknown
        guard mergedFor != uid else { return }
        struct Row: Decodable { let tutorials_seen: [String]? }
        let row: Row? = try? await auth.client.from("profiles")
            .select(PocketHelp.tutorialsSeenColumn).eq("id", value: uid).limit(1).single().execute().value
        // Any error (column missing, offline) leaves the local copy in charge.
        let merged = PocketHelp.mergeTutorialsSeen(local, row?.tutorials_seen ?? [])
        mergedFor = uid
        seen = merged
        if merged != local { Self.writeLocal(merged) }
    }

    /// Reads the signed-in player's per-mode totals once (the "already has results" half of the first-play rule).
    func refreshResults() async {
        let auth = AuthService.shared
        guard auth.isAuthenticated, let uid = auth.profile?.id, statsFor != uid else { return }
        let rows = await UserStatsService.fetch(userId: uid)
        gamesByMode = UserStatsService.gamesPerMode(rows)
        // An empty answer may be a failed read: leave it retryable (a brand-new player re-reads cheaply).
        if !rows.isEmpty { statsFor = uid }
    }

    /// Does the player already have results in this game? nil = a signed-in player's stats are still
    /// loading (the card waits, never guesses). A guest has no per-game server results: false.
    func hasResults(mode: GameMode) -> Bool? {
        if !AuthService.shared.isAuthenticated { return false }
        guard let games = gamesByMode else { return nil }
        return (games[mode.rawValue] ?? 0) > 0
    }

    /// A pocket game: any finished friendly game of this kind in the recent list (last 7 days).
    func hasResults(pocket kind: FriendlyKind) -> Bool {
        FriendlyGamesService.recent.contains { $0.kind == kind && $0.status == "done" }
    }

    /// Record a tutorial as seen: local at once, then the server (best effort).
    func mark(_ key: String) {
        let current = seen ?? Self.readLocal()
        let next = PocketHelp.withTutorialSeen(current, key: key)
        seen = next
        Self.writeLocal(next)
        guard AuthService.shared.isAuthenticated, let uid = AuthService.shared.profile?.id else { return }
        Task {
            struct Upd: Encodable { let tutorials_seen: [String] }
            _ = try? await AuthService.shared.client.from("profiles")
                .update(Upd(tutorials_seen: next)).eq("id", value: uid).execute()
        }
    }

    /// Whether this game's welcome card should show on its own right now.
    func shouldAutoShow(_ key: String, hasResults: Bool = false) -> Bool {
        PocketHelp.shouldAutoShowTutorial(live: FlagsService.shared.isLive(PocketHelp.firstPlayFlag), seen: seen, key: key, hasResults: hasResults)
    }

    /// The player already has results here but the key is unseen: record it silently (no card).
    func shouldRecordSeen(_ key: String, hasResults: Bool) -> Bool {
        PocketHelp.tutorialShouldRecordSeen(live: FlagsService.shared.isLive(PocketHelp.firstPlayFlag), seen: seen, key: key, hasResults: hasResults)
    }
}

/// Opens a game's help card by itself the first time the player opens that game (once per game per
/// player, synced). Put it next to the game's `.softSheet(isPresented: $showGuide)`.
struct FirstPlayAutoShow: ViewModifier {
    /// nil while the game is not known yet (a pocket game still loading): nothing shows.
    let key: String?
    /// Main game: its results come from the player's stats. Pocket game: `pocketKind`. Neither: no results known.
    var mode: GameMode? = nil
    var pocketKind: FriendlyKind? = nil
    @Binding var show: Bool
    @ObservedObject private var tutorials = TutorialsSeen.shared
    @ObservedObject private var flags = FlagsService.shared
    @State private var done = false

    func body(content: Content) -> some View {
        content
            .task {
                await tutorials.refresh()
                await tutorials.refreshResults()
            }
            .onAppear { evaluate() }
            .onChange(of: tutorials.seen) { _ in evaluate() }
            .onChange(of: tutorials.gamesByMode) { _ in evaluate() }
            .onChange(of: flags.flags) { _ in evaluate() }
            .onChange(of: key) { _ in evaluate() }
    }

    private func evaluate() {
        guard !done, let key else { return }
        // nil = signed-in stats still loading: wait, never guess.
        let hasResults: Bool
        if let mode {
            guard let known = tutorials.hasResults(mode: mode) else { return }
            hasResults = known
        } else if let pocketKind {
            hasResults = tutorials.hasResults(pocket: pocketKind)
        } else {
            hasResults = false
        }
        if tutorials.shouldRecordSeen(key, hasResults: hasResults) {
            done = true
            tutorials.mark(key)   // already knows the game: silently seen, no card
            return
        }
        guard tutorials.shouldAutoShow(key, hasResults: hasResults) else { return }
        done = true
        show = true
    }
}

extension View {
    /// The first-play welcome for a main game (key = its guide slug).
    func firstPlayGuide(mode: GameMode, show: Binding<Bool>) -> some View {
        modifier(FirstPlayAutoShow(key: GuideService.slug(for: mode), mode: mode, show: show))
    }

    /// The first-play welcome for a pocket game (key = "pocket-<kind>").
    func firstPlayPocket(kind: FriendlyKind?, show: Binding<Bool>) -> some View {
        modifier(FirstPlayAutoShow(key: kind.map(PocketHelp.tutorialKey), pocketKind: kind, show: show))
    }
}
