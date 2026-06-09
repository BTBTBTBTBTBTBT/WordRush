import Foundation
import Supabase
import UIKit
import GoogleSignIn
import Security

/// Supabase auth-session storage that prefers the Keychain (secure, used on
/// real devices) but transparently falls back to UserDefaults when a Keychain
/// write is rejected — e.g. on the iOS Simulator, where an unsigned build has
/// no `application-identifier` entitlement and the Keychain returns
/// errSecMissingEntitlement (-34018). Without this, signing in on the simulator
/// fails with "keychain error" the moment Supabase tries to persist the session.
/// On device the Keychain path always succeeds, so behavior there is unchanged.
struct ResilientAuthStorage: AuthLocalStorage {
    private let service = "com.wordocious.app.supabase.auth"
    private func defaultsKey(_ key: String) -> String { "sb-auth-\(key)" }

    func store(key: String, value: Data) throws {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = value
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        if SecItemAdd(add as CFDictionary, nil) == errSecSuccess {
            UserDefaults.standard.removeObject(forKey: defaultsKey(key))
        } else {
            // Keychain unavailable (unsigned simulator) → fall back.
            UserDefaults.standard.set(value, forKey: defaultsKey(key))
        }
    }

    func retrieve(key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data {
            return data
        }
        return UserDefaults.standard.data(forKey: defaultsKey(key))
    }

    func remove(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        UserDefaults.standard.removeObject(forKey: defaultsKey(key))
    }
}

/// Google OAuth client IDs (spellstrike Google Cloud project). The iOS client
/// drives the native GoogleSignIn SDK; the web client is passed as
/// `serverClientID` so Google mints an idToken whose audience Supabase's Google
/// provider already trusts. Mirrors the working ShowLoud native setup.
enum GoogleAuth {
    static let iosClientID = "193086095286-4ftdf92g8cnsur8kd7odqq0jueqq5oog.apps.googleusercontent.com"
    static let webClientID = "193086095286-2h2smgnt72veffaufh1nuruvlris79d9.apps.googleusercontent.com"
}

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
            supabaseKey: SupabaseConfig.isConfigured ? SupabaseConfig.anonKey : "anon-key-not-set",
            options: .init(auth: .init(storage: ResilientAuthStorage()))
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

    /// Native Google sign-in via the GoogleSignIn SDK → exchange the resulting
    /// idToken for a Supabase session (`signInWithIdToken`) — the same mechanism
    /// as Apple above. This replaces Supabase's web OAuth (ASWebAuthenticationSession
    /// + PKCE) flow, which returned an empty auth code on iOS. Matches the
    /// proven ShowLoud setup. `serverClientID` makes Google mint an idToken whose
    /// audience the Supabase Google provider trusts.
    /// Requires: a Google Cloud iOS OAuth client for `com.wordocious.app`, the
    /// reversed-client-ID URL scheme in Info.plist, and the iOS client id added
    /// to the Supabase Google provider's authorized client IDs.
    func signInWithGoogle() async throws {
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: GoogleAuth.iosClientID, serverClientID: GoogleAuth.webClientID)
        guard let presenter = Self.topViewController() else {
            throw NSError(domain: "WordociousAuth", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Couldn't present Google sign-in."])
        }
        // GoogleSignIn 7.x issues its own nonce in the id_token and doesn't
        // expose it, so we can't echo it to Supabase — the Supabase Google
        // provider must have "Skip nonce checks" enabled (its sanctioned iOS
        // setting). Upgrading to GoogleSignIn 8.x would let us pass an explicit
        // nonce and turn that back off.
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        guard let idToken = result.user.idToken?.tokenString else {
            throw NSError(domain: "WordociousAuth", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "Google sign-in didn't return an ID token."])
        }
        let session = try await client.auth.signInWithIdToken(
            credentials: .init(provider: .google, idToken: idToken,
                               accessToken: result.user.accessToken.tokenString))
        await handleSignedIn(userId: session.user.id.uuidString)
    }

    /// Top-most view controller to present the Google sign-in sheet from.
    @MainActor private static func topViewController() -> UIViewController? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
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
    /// same columns real purchases set; remove before launch.
    ///
    /// NOTE: `isProActive` is expiry-aware (is_pro && (expiry == nil || expiry > now)),
    /// so flipping is_pro alone does NOTHING if the row has a lapsed pro_expires_at.
    /// When simulating Pro ON we therefore also push pro_expires_at one year out so
    /// the preview actually activates regardless of any stale expiry.
    private struct ProToggle: Encodable { let is_pro: Bool; let pro_expires_at: String? }
    func setSimulatePro(_ on: Bool) async {
        guard let userId = try? await client.auth.session.user.id.uuidString else { return }
        let expiry: String? = on
            ? ISO8601DateFormatter().string(from: Date().addingTimeInterval(365 * 24 * 60 * 60))
            : nil
        try? await client.from("profiles").update(ProToggle(is_pro: on, pro_expires_at: expiry))
            .eq("id", value: userId).execute()
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
