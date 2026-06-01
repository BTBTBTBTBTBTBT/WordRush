import Foundation

/// Realtime VS (socket.io) server configuration.
///
/// The web reads this from `NEXT_PUBLIC_SERVER_URL` (the standalone socket.io
/// server on Render). It is NOT committed to the repo, so set it here for the
/// native client. Until the real URL is filled in, VS shows a "coming soon"
/// state instead of failing to connect.
enum VSConfig {
    /// Production socket server base URL. Derived from the Render service name
    /// in `render.yaml` (service: "wordocious-server" → wordocious-server.onrender.com).
    ///
    /// ⚠️ UNVERIFIED: a direct probe of this host returned Render's
    /// `x-render-routing: no-server` (the free instance may have been spun down,
    /// or the deployed subdomain has a suffix). CONFIRM the exact URL in the
    /// Render dashboard (it's the value of Vercel's NEXT_PUBLIC_SERVER_URL) and
    /// correct this line if matches hang on "Searching…".
    static let serverURL = URL(string: "https://wordocious-server.onrender.com")

    /// True once a real (non-placeholder) server URL has been configured.
    static var isConfigured: Bool {
        guard let host = serverURL?.host else { return false }
        return !host.contains("REPLACE-WITH")
    }
}
