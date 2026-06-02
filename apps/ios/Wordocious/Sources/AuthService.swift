import Foundation
import Supabase

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
        let response = try await client.auth.signUp(email: email, password: password)
        let userId = response.user.id.uuidString
        // Create the profile row (RLS: a user may insert their own row).
        try await client.from("profiles")
            .insert(["id": userId, "username": username])
            .execute()
        await handleSignedIn(userId: userId)
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

    /// Google sign-in via Supabase's hosted OAuth flow (ASWebAuthenticationSession).
    /// Requires the Google provider enabled in Supabase Auth and the redirect URL
    /// `com.wordocious.app://auth-callback` added to the project's allow-list.
    func signInWithGoogle() async throws {
        let session = try await client.auth.signInWithOAuth(
            provider: .google,
            redirectTo: URL(string: "com.wordocious.app://auth-callback"))
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
