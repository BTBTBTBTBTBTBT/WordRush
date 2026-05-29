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

    func signOut() async {
        try? await client.auth.signOut()
        profile = nil
        isAuthenticated = false
    }

    // MARK: - Profile

    func refreshProfile() async {
        guard let userId = try? await client.auth.session.user.id.uuidString else { return }
        await handleSignedIn(userId: userId)
    }

    private func handleSignedIn(userId: String) async {
        isAuthenticated = true
        do {
            let row: Profile = try await client.from("profiles")
                .select("id,username,avatar_url,is_pro,pro_expires_at,is_banned,has_onboarded")
                .eq("id", value: userId)
                .single()
                .execute()
                .value
            if row.isBanned {
                await signOut()
                return
            }
            profile = row
        } catch {
            // No profile row yet (e.g. OAuth first sign-in) — leave nil; the
            // sign-up path creates it, OAuth path will create it in Phase 2.
            profile = nil
        }
    }
}
