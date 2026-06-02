import Foundation

/// Polls the matchmaking server's `/presence` endpoint for the number of
/// connected players — drives the home "LIVE · N players online" banner.
/// Ports the web `useLivePlayerCount` hook (same endpoint, 10s interval,
/// nil until the first success so the banner shows "Players online" instead
/// of flashing a stale zero; a flaky/down server keeps the last value).
@MainActor
final class LivePlayerCount: ObservableObject {
    @Published var count: Int?
    private var task: Task<Void, Never>?
    private struct Presence: Decodable { let online: Int }

    func start() {
        guard task == nil, let base = VSConfig.serverURL else { return }
        let url = base.appendingPathComponent("presence")
        task = Task { [weak self] in
            while !Task.isCancelled {
                if let (data, resp) = try? await URLSession.shared.data(from: url),
                   (resp as? HTTPURLResponse)?.statusCode == 200,
                   let p = try? JSONDecoder().decode(Presence.self, from: data) {
                    self?.count = p.online
                }
                try? await Task.sleep(nanoseconds: 10_000_000_000)
            }
        }
    }

    func stop() { task?.cancel(); task = nil }
}
