import Foundation

/// Realtime VS (socket.io) server configuration.
///
/// The web reads this from `NEXT_PUBLIC_SERVER_URL`; the native client points at
/// the same durable host so both stay in sync forever. The socket.io server
/// (apps/server) is deployed on Railway and fronted by the stable custom domain
/// below — a Railway CNAME (`server` → *.up.railway.app) on the wordocious.com
/// zone, so the underlying Railway service can change without touching clients.
enum VSConfig {
    /// Production socket server base URL — the Railway custom domain.
    /// Matches Vercel's `NEXT_PUBLIC_SERVER_URL`. Stable across redeploys.
    static let serverURL = URL(string: "https://server.wordocious.com")

    /// True once a real (non-placeholder) server URL has been configured.
    static var isConfigured: Bool {
        guard let host = serverURL?.host else { return false }
        return !host.contains("REPLACE-WITH")
    }
}
