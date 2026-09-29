import Foundation

/// Polls the matchmaking server's `/presence` endpoint for the number of
/// connected players — drives the home "LIVE · N players online" banner.
/// Ports the web `useLivePlayerCount` hook (same endpoint, 10s interval,
/// nil until the first success so the banner shows "Players online" instead
/// of flashing a stale zero; a flaky/down server keeps the last value).
///
/// One shared instance observed only by VSLiveTile, so a new count redraws
/// the tile and not all of Home; `count` is assigned only when it changes;
/// polling runs only while Home is on screen AND the app is foregrounded
/// (it used to poll every 10 s forever — founder, 2026-09-29).
@MainActor
final class LivePlayerCount: ObservableObject {
    static let shared = LivePlayerCount()
    @Published private(set) var count: Int?
    private var task: Task<Void, Never>?
    /// Home is showing (start/stop) — and the app is not in the background.
    private var wanted = false
    private var backgrounded = false
    private struct Presence: Decodable { let online: Int }

    /// Home appeared.
    func start() { wanted = true; resume(initialDelay: 2) }
    /// Home disappeared.
    func stop() { wanted = false; task?.cancel(); task = nil }
    /// App backgrounded / foregrounded (WordociousApp scenePhase).
    func setBackgrounded(_ bg: Bool) {
        backgrounded = bg
        if bg { task?.cancel(); task = nil } else { resume(initialDelay: 0) }
    }

    private func resume(initialDelay: UInt64) {
        guard wanted, !backgrounded, task == nil, let base = VSConfig.serverURL else { return }
        let url = base.appendingPathComponent("presence")
        task = Task { [weak self] in
            // Defer the first poll ~2s so a cold launch spends its first
            // seconds fetching content, not the vanity live count (the banner
            // shows "Players online" until the first success anyway).
            try? await Task.sleep(nanoseconds: initialDelay * 1_000_000_000)
            while !Task.isCancelled {
                if let (data, resp) = try? await Net.api.data(from: url),
                   (resp as? HTTPURLResponse)?.statusCode == 200,
                   let p = try? JSONDecoder().decode(Presence.self, from: data),
                   !Task.isCancelled, self?.count != p.online {
                    self?.count = p.online
                }
                try? await Task.sleep(nanoseconds: 10_000_000_000)
            }
        }
    }
}
