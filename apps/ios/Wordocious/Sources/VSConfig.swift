import Foundation

/// Realtime VS (socket.io) server configuration.
///
/// The web reads this from `NEXT_PUBLIC_SERVER_URL` (the standalone socket.io
/// server on Render). It is NOT committed to the repo, so set it here for the
/// native client. Until the real URL is filled in, VS shows a "coming soon"
/// state instead of failing to connect.
enum VSConfig {
    /// Production socket server base URL, e.g. https://wordocious-server.onrender.com
    /// TODO(owner): paste the value of NEXT_PUBLIC_SERVER_URL from Vercel here.
    static let serverURL = URL(string: "https://REPLACE-WITH-RENDER-SERVER-URL")

    /// True once a real server URL has been configured.
    static var isConfigured: Bool {
        guard let host = serverURL?.host else { return false }
        return !host.contains("REPLACE-WITH")
    }
}
