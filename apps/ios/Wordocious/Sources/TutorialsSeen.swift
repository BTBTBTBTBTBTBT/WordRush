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
    func shouldAutoShow(_ key: String) -> Bool {
        PocketHelp.shouldAutoShowTutorial(live: FlagsService.shared.isLive(PocketHelp.firstPlayFlag), seen: seen, key: key)
    }
}

/// Opens a game's help card by itself the first time the player opens that game (once per game per
/// player, synced). Put it next to the game's `.softSheet(isPresented: $showGuide)`.
struct FirstPlayAutoShow: ViewModifier {
    /// nil while the game is not known yet (a pocket game still loading): nothing shows.
    let key: String?
    @Binding var show: Bool
    @ObservedObject private var tutorials = TutorialsSeen.shared
    @ObservedObject private var flags = FlagsService.shared
    @State private var done = false

    func body(content: Content) -> some View {
        content
            .task { await tutorials.refresh() }
            .onAppear { evaluate() }
            .onChange(of: tutorials.seen) { _ in evaluate() }
            .onChange(of: flags.flags) { _ in evaluate() }
            .onChange(of: key) { _ in evaluate() }
    }

    private func evaluate() {
        guard !done, let key, tutorials.shouldAutoShow(key) else { return }
        done = true
        show = true
    }
}

extension View {
    /// The first-play welcome for a main game (key = its guide slug).
    func firstPlayGuide(mode: GameMode, show: Binding<Bool>) -> some View {
        modifier(FirstPlayAutoShow(key: GuideService.slug(for: mode), show: show))
    }

    /// The first-play welcome for a pocket game (key = "pocket-<kind>").
    func firstPlayPocket(kind: FriendlyKind?, show: Binding<Bool>) -> some View {
        modifier(FirstPlayAutoShow(key: kind.map(PocketHelp.tutorialKey), show: show))
    }
}
