import SwiftUI
import WordociousCore

/// FINISH_SPEC §M: the Friends tab notification badge. The count is everything
/// waiting on the player in Friends — incoming friend requests, VS challenges sent to
/// them, and friendly games where it's their turn — minus what they have already
/// seen: opening the Friends tab marks every current item seen (the badge clears and
/// comes back only for new items). Reads the data the app already loads
/// (FriendsService.incoming, FriendlyGamesService.active, VsChallengeService.list).
@MainActor
final class FriendsBadgeStore: ObservableObject {
    static let shared = FriendsBadgeStore()

    /// Unseen waiting items (the tab badge).
    @Published private(set) var count = 0
    /// Every waiting item's key (seen or not) — rows inside Friends badge themselves from it.
    @Published private(set) var waiting: Set<String> = []
    /// Bumped when the count grows (the badge springs in, the tab icon wiggles).
    @Published private(set) var arrivals = 0

    private var challenges: [VsChallenge] = []
    private static let seenKey = "wd_friends_badge_seen_v1"
    private var seen: Set<String> = Set(UserDefaults.standard.stringArray(forKey: FriendsBadgeStore.seenKey) ?? [])

    private init() {}

    static func requestKey(_ id: String) -> String { "req:\(id)" }
    static func challengeKey(_ code: String) -> String { "vs:\(code)" }
    /// A game's key carries its last update, so a new move badges again.
    static func gameKey(_ g: FriendlyGameView) -> String { "game:\(g.id):\(g.updatedAt)" }

    /// Re-read the cached lists (call on FriendsService / FriendlyGamesService changes).
    func recount() {
        var keys = Set<String>()
        for r in FriendsService.incoming { keys.insert(Self.requestKey(r.id)) }
        for g in FriendlyGamesService.active where g.yourTurn { keys.insert(Self.gameKey(g)) }
        for c in challenges { keys.insert(Self.challengeKey(c.code)) }
        waiting = keys
        let unseen = keys.subtracting(seen).count
        if unseen > count { arrivals += 1 }
        count = unseen
    }

    /// Fetch the incoming VS challenges once (the lobby's own list query).
    func loadChallenges() async {
        guard AuthService.shared.profile != nil else { return }
        if let lists = await VsChallengeService.list() { challenges = lists.incoming }
        recount()
    }

    /// Opening Friends: everything waiting now is seen.
    func markSeen() {
        guard !waiting.isSubset(of: seen) || count > 0 else { return }
        // Keep the stored set small: only the items still waiting.
        seen = waiting
        UserDefaults.standard.set(Array(seen), forKey: Self.seenKey)
        count = 0
    }

    /// Whether an item is still waiting (for the small row badges inside Friends).
    func isWaiting(_ key: String) -> Bool { waiting.contains(key) }
}

/// §M the glossy candy count badge: hot pink → coral (#ff5fa2 → #f0435f), a 1.5-pt
/// gold outline, a white top gloss and a darker lip, a white Nunito Black count
/// (1–9, then "9+"); at least 18 pt round, a pill for two digits. `pulse` adds the
/// slow soft glow pulse (every ~4 s while unseen; never with Reduce Motion).
struct CandyCountBadge: View {
    let count: Int
    var size: CGFloat = 18
    var pulse: Bool = false

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var glow = false

    var body: some View {
        let text = count > 9 ? "9+" : "\(max(0, count))"
        let shape = Capsule(style: .continuous)
        let lip: CGFloat = max(1.5, size * 0.1)
        Text(text)
            .font(Brand.fixedFont(size * 0.6, .black))
            .foregroundStyle(.white)
            .shadow(color: Color(hex: 0x7A1030).opacity(0.45), radius: 0, x: 0, y: 1)
            .padding(.horizontal, text.count > 1 ? size * 0.28 : 0)
            .frame(minWidth: size, minHeight: size)
            .background {
                ZStack(alignment: .top) {
                    shape.fill(LinearGradient(colors: [Color(hex: 0xFF5FA2), Color(hex: 0xF0435F)],
                                              startPoint: .top, endPoint: .bottom))
                    shape.fill(LinearGradient(colors: [Color.white.opacity(0.5), Color.white.opacity(0)],
                                              startPoint: .top, endPoint: .bottom))
                        .frame(height: size * 0.45)
                        .padding(.horizontal, size * 0.18).padding(.top, 1.5)
                    shape.strokeBorder(Color(hex: 0xF5C542), lineWidth: 1.5)
                }
            }
            .background(shape.fill(Color(hex: 0xB4233C)).offset(y: lip))
            .shadow(color: Color(hex: 0xFF5FA2).opacity(glow ? 0.75 : 0.25), radius: glow ? 7 : 3)
            .padding(.bottom, lip)
            .accessibilityHidden(true)
            .task(id: pulse) {
                guard pulse, !(envReduce || Theme.reduceMotion) else { glow = false; return }
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    withAnimation(.easeInOut(duration: 0.8)) { glow = true }
                    try? await Task.sleep(nanoseconds: 900_000_000)
                    withAnimation(.easeInOut(duration: 0.8)) { glow = false }
                }
            }
    }
}
