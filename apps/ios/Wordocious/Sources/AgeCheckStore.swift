import SwiftUI
import Security
import Sentry
import WordociousCore

/// 13+ age check state (FRIDAY-QUEUE item 29). Rules live in WordociousCore.AgeCheck; the screens in
/// AgeCheckView.swift. This store owns what the device remembers and everything that must wait for it:
///
///   - the answer sticks on the device (Keychain survives a reinstall, so "under" cannot be retried with a
///     different year; UserDefaults mirrors it for reads that can't wait on the Keychain)
///   - nothing is created or stored for an under-13 player: no account, no guest profile, no push token,
///     no crash reports — Sentry, ads/ATT and APNs registration all start only through `startServices()`
///   - signed-in accounts mirror the answer to the server (POST /api/account/age, service role; the
///     age_confirmed_13 column is not user-writable). An existing account that answers "under" is signed
///     out; the server purges it after a grace window.
///   - the `age_check` off-switch (admin > Ops > Feature flags) turns the whole thing off
@MainActor
final class AgeCheckStore: ObservableObject {
    static let shared = AgeCheckStore()

    @Published private(set) var stored: AgeCheck.Stored?
    /// A signed-in account on a fresh device may already be confirmed server-side; true once we know.
    @Published private(set) var serverCheckDone = false

    private static let defaultsKey = "wordocious.age-check"
    private static let keychainService = "com.wordocious.age-check"
    private var startedServices = false
    private var syncing = false

    private init() {
        stored = Self.read()
    }

    /// Passed on this device, or the off-switch is off (fail open: unknown flags = the check is live).
    var isCleared: Bool {
        stored?.state == .ok || !FlagsService.shared.isLive("age_check")
    }

    var isUnder: Bool { stored?.state == .under }

    // MARK: - Answer

    func answer(year: Int) {
        guard stored == nil else { return }   // never overwritten: no retry with a different year
        switch AgeCheck.verdict(year: year) {
        case .invalid: return
        case .pass: stored = AgeCheck.Stored(state: .ok, year: year)
        case .under: stored = AgeCheck.Stored(state: .under, year: year)
        }
        Self.write(stored)
        if stored?.state == .ok { startServices() }
        Task { await syncWithServer() }
    }

    /// Sentry + ads/ATT + APNs: only after the check passes (called again from the app's launch task).
    func startServices() {
        guard isCleared, !startedServices else { return }
        startedServices = true
        AgeCheckStore.startSentry()
        AdsManager.shared.start()
        PushRegistration.register()
    }

    nonisolated static func startSentry() {
        #if !DEBUG
        SentrySDK.start { options in
            options.dsn = "https://372e8127de431c710a27250cd00d07df@o4511355315748865.ingest.us.sentry.io/4511779224354816"
            options.tracesSampleRate = 0
            options.enableAutoSessionTracking = true
        }
        #endif
    }

    // MARK: - Server

    /// For a signed-in account: adopt a server confirmation on a fresh device, mirror a device answer up,
    /// and sign an under-13 account out. Safe to call repeatedly.
    func syncWithServer() async {
        let auth = AuthService.shared
        guard let id = auth.profile?.id, !syncing else { return }
        syncing = true
        defer { syncing = false }

        struct Row: Decodable { let age_confirmed_13: Bool? }
        let row: Row? = try? await auth.client
            .from("profiles").select("age_confirmed_13").eq("id", value: id).single()
            .execute().value
        let confirmed = row?.age_confirmed_13 ?? false
        serverCheckDone = true

        // The server keeps only the yes/no flag (no birth year); a confirmed account adopts a passing year here.
        if stored == nil, confirmed {
            let y = Calendar.current.component(.year, from: Date()) - 18
            stored = AgeCheck.Stored(state: .ok, year: y)
            Self.write(stored)
            startServices()
            return
        }
        guard let s = stored else { return }
        if s.state == .ok && confirmed { return }

        if await Self.post(year: s.year, token: auth.accessToken) == false { return }
        if s.state == .under {
            await auth.signOut()
        }
    }

    /// POST /api/account/age. Returns false only on a transport/server failure (retry next launch).
    private static func post(year: Int, token: String?) async -> Bool {
        guard let token, let url = URL(string: "https://wordocious.com/api/account/age") else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["year": year])
        guard let (_, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { return false }
        return (200..<300).contains(http.statusCode)
    }

    // MARK: - Persistence (Keychain + UserDefaults)

    private static func read() -> AgeCheck.Stored? {
        if let s = AgeCheck.parse(UserDefaults.standard.data(forKey: defaultsKey)) { return s }
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return AgeCheck.parse(data)
    }

    private static func write(_ value: AgeCheck.Stored?) {
        guard let value, let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}
