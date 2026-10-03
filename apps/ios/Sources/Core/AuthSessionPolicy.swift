import Foundation

/// FINISH_SPEC BI16: what a failed session restore / refresh means.
///
/// In the outage a token refresh that timed out (auth unreachable / 5xx) was
/// treated as "no session", so the app dropped to the sign-in screen at a
/// signed-in player. Only an explicit invalid / revoked refresh token, or the
/// user signing out, may clear the session; everything else keeps the cached
/// session + user and retries later.
///
/// Same rules: Android `AuthSessionPolicy`, web `lib/auth-session-policy.ts`.
public enum AuthSessionPolicy {
    public enum Outcome: Equatable, Sendable {
        /// Network / timeout / 5xx / 429 / anything unrecognized: keep the user.
        case transient
        /// The server said the refresh token or session is gone: sign out.
        case revoked
        /// Nothing stored on this device: signed out (nothing to keep).
        case noSession
    }

    /// GoTrue error codes that mean the session is truly over.
    public static let revokedCodes: Set<String> = [
        "refresh_token_not_found", "refresh_token_already_used",
        "session_not_found", "session_expired",
        "user_not_found", "user_banned",
    ]

    /// - Parameters:
    ///   - isSessionMissing: the auth client reports no stored session (it also
    ///     reports this right after it deleted a session for a revocation code).
    ///   - errorCode: the GoTrue `error_code`, when the server answered with one.
    ///   - httpStatus: the HTTP status, when the server answered at all.
    ///   - message: the server's message (old GoTrue says "Invalid Refresh Token").
    public static func classify(isSessionMissing: Bool, errorCode: String?, httpStatus: Int?,
                                message: String? = nil) -> Outcome {
        if let code = errorCode?.lowercased(), revokedCodes.contains(code) { return .revoked }
        if let status = httpStatus, status == 400 || status == 401,
           let m = message?.lowercased(), m.contains("invalid refresh token") || m.contains("refresh token not found") {
            return .revoked
        }
        if isSessionMissing { return .noSession }
        return .transient
    }

    /// Stay signed in? Only a transient failure with a session still stored.
    public static func keepsUserSignedIn(_ outcome: Outcome, hasStoredSession: Bool) -> Bool {
        outcome == .transient && hasStoredSession
    }

    /// Seconds before retry `attempt` (0-based): 5, 15, 30, then every 60.
    public static func retryDelay(attempt: Int) -> Double {
        let steps: [Double] = [5, 15, 30]
        return attempt < steps.count ? steps[max(attempt, 0)] : 60
    }
}
