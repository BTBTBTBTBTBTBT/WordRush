import Foundation
import Supabase
import AuthenticationServices
import UIKit

/// Owns the Supabase client + auth session + the signed-in profile.
/// Mirrors apps/web/lib/auth-context.tsx (session, profile, isProActive).
@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published private(set) var profile: Profile?
    @Published private(set) var isAuthenticated = false
    @Published private(set) var isLoading = true

    let client: SupabaseClient

    var isProActive: Bool { Wordocious.isProActive(profile) }

    private init() {
        client = SupabaseClient(
            supabaseURL: SupabaseConfig.url,
            supabaseKey: SupabaseConfig.isConfigured ? SupabaseConfig.anonKey : "anon-key-not-set"
        )
    }

    /// Call once at launch. Restores any persisted session and starts listening
    /// for auth changes.
    func bootstrap() async {
        guard SupabaseConfig.isConfigured else {
            isLoading = false
            return
        }
        if let session = try? await client.auth.session {
            await handleSignedIn(userId: session.user.id.uuidString)
        }
        isLoading = false

        Task {
            for await change in client.auth.authStateChanges {
                switch change.event {
                case .signedIn, .tokenRefreshed, .userUpdated:
                    if let userId = change.session?.user.id.uuidString {
                        await handleSignedIn(userId: userId)
                    }
                case .signedOut:
                    profile = nil
                    isAuthenticated = false
                default:
                    break
                }
            }
        }
    }

    // MARK: - Email/password

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String, username: String) async throws {
        // Pass the username as user metadata; the DB trigger handle_new_user()
        // creates the profiles row (SECURITY DEFINER). We don't insert it here —
        // with email confirmation on there's no session yet, so a client insert
        // would fail the profiles RLS policy.
        let response = try await client.auth.signUp(
            email: email, password: password, data: ["username": .string(username)])
        // Only proceed to the signed-in flow if a session exists; otherwise the
        // user must confirm their email first.
        if response.session != nil {
            await handleSignedIn(userId: response.user.id.uuidString)
        }
    }

    // MARK: - OAuth (Apple / Google)

    /// Native Sign in with Apple — exchanges the Apple identity token (obtained
    /// via ASAuthorizationController) for a Supabase session. `rawNonce` is the
    /// un-hashed nonce; the hashed form was sent to Apple in the request.
    /// Requires the Apple provider configured in Supabase Auth.
    func signInWithApple(idToken: String, rawNonce: String) async throws {
        let session = try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: rawNonce))
        await handleSignedIn(userId: session.user.id.uuidString)
    }

    /// Google sign-in via Supabase's hosted OAuth (PKCE) flow, driven by an
    /// EXPLICIT ASWebAuthenticationSession rather than the all-in-one
    /// `signInWithOAuth(...)` convenience — the convenience launcher returned an
    /// empty auth code on iOS ("both auth code and code verifier should be
    /// non-empty"). Doing it explicitly makes the PKCE round-trip deterministic:
    ///  1. `getOAuthSignInURL` builds the provider URL AND persists the PKCE
    ///     code_verifier in the client's auth storage.
    ///  2. our ASWebAuthenticationSession (with a real presentation anchor)
    ///     captures the `com.wordocious.app://auth-callback?code=…` redirect.
    ///  3. `session(from:)` reads that code + the stored verifier and exchanges.
    /// Requires the Google provider enabled in Supabase Auth and the redirect URL
    /// `com.wordocious.app://auth-callback` in the project's allow-list.
    func signInWithGoogle() async throws {
        let redirect = URL(string: "com.wordocious.app://auth-callback")!
        let authURL = try client.auth.getOAuthSignInURL(provider: .google, redirectTo: redirect)
        let callbackURL = try await WebAuthSession().start(url: authURL, callbackScheme: "com.wordocious.app")
        let session = try await client.auth.session(from: callbackURL)
        await handleSignedIn(userId: session.user.id.uuidString)
    }

    func signOut() async {
        try? await client.auth.signOut()
        profile = nil
        isAuthenticated = false
    }

    /// Permanently delete the account. The native client only holds the anon
    /// key (can't delete the auth user), so this calls the web endpoint
    /// /api/account/delete — which verifies the Bearer token and performs the
    /// same cascading cleanup (user_stats, matches, daily_results, daily_medals,
    /// user_achievements, purchases, profile, then the auth user) with the
    /// service-role key. On success we sign out locally. Returns true on success.
    func deleteAccount() async -> Bool {
        guard let token = try? await client.auth.session.accessToken,
              let url = URL(string: "https://wordocious.com/api/account/delete") else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (_, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return false }
            await signOut()
            return true
        } catch {
            return false
        }
    }

    // MARK: - Pro entitlement (StoreKit fulfillment)

    private struct ProGrant: Encodable { let is_pro: Bool; let pro_expires_at: String; let streak_shields: Int }
    private struct ProSync: Encodable { let is_pro: Bool; let pro_expires_at: String }

    /// Write Pro entitlement after a verified StoreKit purchase/renewal — mirrors
    /// apps/web/lib/payment/purchase-service.ts fulfillSubscription (is_pro +
    /// pro_expires_at, plus +`addShields` streak shields for monthly/yearly).
    func applyProGrant(expiresAt: Date, addShields: Int) async {
        guard let userId = try? await client.auth.session.user.id.uuidString else { return }
        let iso = ISO8601DateFormatter().string(from: expiresAt)
        let body = ProGrant(is_pro: true, pro_expires_at: iso,
                            streak_shields: (profile?.streakShields ?? 0) + max(0, addShields))
        try? await client.from("profiles").update(body).eq("id", value: userId).execute()
        await refreshProfile()
    }

    /// Reconcile an active subscription into the profile on launch/restore — no
    /// shield grant (not a new purchase).
    func syncProExpiry(expiresAt: Date) async {
        guard let userId = try? await client.auth.session.user.id.uuidString else { return }
        let iso = ISO8601DateFormatter().string(from: expiresAt)
        try? await client.from("profiles").update(ProSync(is_pro: true, pro_expires_at: iso))
            .eq("id", value: userId).execute()
        await refreshProfile()
    }

    /// TEST-ONLY: flip the profile's is_pro marker to preview free vs Pro states,
    /// mirroring the web's "Simulate Pro" / "Disable Pro" dev toggle. Writes the
    /// same column real purchases set; remove before launch.
    private struct ProToggle: Encodable { let is_pro: Bool }
    func setSimulatePro(_ on: Bool) async {
        guard let userId = try? await client.auth.session.user.id.uuidString else { return }
        try? await client.from("profiles").update(ProToggle(is_pro: on)).eq("id", value: userId).execute()
        await refreshProfile()
    }

    // MARK: - Profile

    func refreshProfile() async {
        guard let userId = try? await client.auth.session.user.id.uuidString else { return }
        await handleSignedIn(userId: userId)
    }

    private func handleSignedIn(userId: String) async {
        isAuthenticated = true
        if let row = await fetchProfileRow(userId: userId) {
            if row.isBanned { await signOut(); return }
            profile = row
            return
        }
        // No profile row yet (OAuth first sign-in) — auto-create one, mirroring
        // apps/web/lib/auth-context.tsx (anonymized username + avatar from the
        // provider metadata + has_onboarded:false), then re-fetch.
        await createProfileForOAuth(userId: userId)
        profile = await fetchProfileRow(userId: userId)
    }

    private func fetchProfileRow(userId: String) async -> Profile? {
        try? await client.from("profiles")
            .select(Profile.selectColumns)
            .eq("id", value: userId)
            .single()
            .execute()
            .value
    }

    private func createProfileForOAuth(userId: String) async {
        let username = "Wordocious\(Int.random(in: 10000...99999))"
        var row: [String: String] = ["id": userId, "username": username]
        if let meta = try? await client.auth.session.user.userMetadata {
            if let avatar = (meta["avatar_url"] ?? meta["picture"])?.stringValue {
                row["avatar_url"] = avatar
            }
        }
        try? await client.from("profiles").insert(row).execute()
    }
}

/// Thin wrapper around ASWebAuthenticationSession for the explicit Google OAuth
/// flow. Presents the provider URL, captures the custom-scheme callback, and
/// returns it. Holds the session for its lifetime and supplies the key-window
/// presentation anchor required on iOS.
@MainActor
final class WebAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func start(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                if let error {
                    cont.resume(throwing: error)
                } else if let callbackURL {
                    cont.resume(returning: callbackURL)
                } else {
                    cont.resume(throwing: URLError(.badServerResponse))
                }
            }
            session.presentationContextProvider = self
            // Use the system browser's shared session so users already signed
            // into Google get SSO; iOS shows the standard "…wants to use
            // google.com to Sign In" consent first.
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                cont.resume(throwing: URLError(.cannotConnectToHost))
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
            ?? ASPresentationAnchor()
    }
}
