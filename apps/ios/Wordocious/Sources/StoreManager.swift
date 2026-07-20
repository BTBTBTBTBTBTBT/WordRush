import Foundation
import StoreKit

/// StoreKit 2 wrapper for the Pro subscription. Mirrors the web's Pro plans
/// (lib/payment/types.ts) and fulfillment (lib/payment/purchase-service.ts):
///   pro_monthly  $6.99  auto-renewable  → +30d, +4 shields
///   pro_yearly   $59.99 auto-renewable  → +365d, +4 shields
///   pro_day      $1.00  consumable      → +24h (stacks on existing window), no shields
///
/// Entitlement is written to the same `profiles` columns the web uses
/// (is_pro / pro_expires_at / streak_shields) so Pro is identical across clients.
@MainActor
final class StoreManager: ObservableObject {
    static let shared = StoreManager()

    enum Plan: String, CaseIterable {
        case monthly = "com.wordocious.app.pro_monthly"
        case yearly  = "com.wordocious.app.pro_yearly"
        case day     = "com.wordocious.app.pro_day"

        /// Days added per purchase (day pass handled with stacking semantics).
        var addedDays: Int { self == .yearly ? 365 : (self == .monthly ? 30 : 1) }
        var grantsShields: Bool { self != .day }
    }

    @Published private(set) var products: [Product] = []
    @Published private(set) var purchasingId: String?
    @Published var lastError: String?

    private var updatesTask: Task<Void, Never>?

    /// Transaction IDs whose one-time effects (shield grant, Day Pass +24h) have
    /// already been applied — so the .success and Transaction.updates paths
    /// can't double-apply the same delivery, and a re-delivered consumable
    /// after a crash can't stack a second 24h. A new billing period carries a
    /// new transaction.id, so this still grants shields once PER renewal.
    /// Persisted (bounded) so it survives relaunch.
    private static let processedKey = "storekit-processed-tx-ids"
    private var processedTxIDs: Set<UInt64> = {
        let raw = UserDefaults.standard.array(forKey: processedKey) as? [NSNumber] ?? []
        return Set(raw.map(\.uint64Value))
    }()

    private func hasProcessed(_ id: UInt64) -> Bool { processedTxIDs.contains(id) }
    private func markProcessed(_ id: UInt64) {
        processedTxIDs.insert(id)
        // Keep the most recent 500 — unbounded growth is the only downside.
        if processedTxIDs.count > 500 { processedTxIDs = Set(processedTxIDs.sorted().suffix(500)) }
        UserDefaults.standard.set(processedTxIDs.map { NSNumber(value: $0) }, forKey: Self.processedKey)
    }

    func product(for plan: Plan) -> Product? { products.first { $0.id == plan.rawValue } }

    private init() {}

    /// Call once at launch (after auth bootstrap). Loads products, reconciles any
    /// active subscription into the profile, and listens for renewals/revocations.
    func start() {
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                await self?.handle(verification: update, isNewPurchase: false)
            }
        }
        Task { await loadProducts() }
        Task { await syncCurrentEntitlements() }
    }

    func loadProducts() async {
        do {
            let loaded = try await Product.products(for: Plan.allCases.map(\.rawValue))
            // Stable display order: monthly, yearly, day.
            let order = Plan.allCases.map(\.rawValue)
            products = loaded.sorted { order.firstIndex(of: $0.id)! < order.firstIndex(of: $1.id)! }
        } catch {
            lastError = "Couldn't load products: \(error.localizedDescription)"
        }
    }

    // MARK: - Purchase

    func purchase(_ plan: Plan) async {
        guard let product = product(for: plan) else {
            lastError = "That plan isn't available right now."
            return
        }
        purchasingId = plan.rawValue
        defer { purchasingId = nil }
        do {
            // Tag the purchase with the Supabase user UUID so the server-side
            // App Store Server Notifications webhook can map the transaction to
            // this user (appAccountToken surfaces in the signed transaction).
            var options: Set<Product.PurchaseOption> = []
            if let session = try? await AuthService.shared.client.auth.session {
                options.insert(.appAccountToken(session.user.id))
            }
            let result = try await product.purchase(options: options)
            switch result {
            case .success(let verification):
                await handle(verification: verification, isNewPurchase: true)
            case .userCancelled:
                break
            case .pending:
                lastError = "Your purchase is pending approval."
            @unknown default:
                break
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Re-sync from the App Store (Apple requires a Restore Purchases action).
    func restore() async {
        do {
            try await AppStore.sync()
            await syncCurrentEntitlements()
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Transaction handling

    private func handle(verification: VerificationResult<Transaction>, isNewPurchase: Bool) async {
        // Unverified is never trusted; surface it so a paying user isn't left
        // staring at a cleared spinner with no explanation.
        guard case .verified(let transaction) = verification else {
            if isNewPurchase { lastError = "Your purchase couldn't be verified. Try Restore Purchases." }
            return
        }
        guard let plan = Plan(rawValue: transaction.productID) else { await transaction.finish(); return }

        // Refund / revocation arrives on Transaction.updates. Revoke Pro rather
        // than fall through — a refunded sub whose expiry is still in the future
        // was otherwise re-affirmed as Pro. finish() only after a durable write.
        if transaction.revocationDate != nil || transaction.isUpgraded {
            if await AuthService.shared.revokePro() { markProcessed(transaction.id); await transaction.finish() }
            return
        }

        // The transaction must belong to the signed-in Supabase user. Without
        // this, account B on a device whose Apple ID owns A's subscription
        // would have Pro written onto B. Leave unfinished so it can be applied
        // once the owning account signs in.
        if !appAccountMatchesCurrentUser(transaction) { return }

        // A Day Pass already applied (crash re-delivery, or the .success/.updates
        // race) must not stack another 24h. Subscriptions re-reconcile harmlessly.
        if plan == .day && hasProcessed(transaction.id) { await transaction.finish(); return }

        let expiry = expiryDate(for: plan, transaction: transaction)
        // Shields once per delivery (per billing period): grant unless this exact
        // transaction was already processed — covers first purchase, each renewal,
        // and Ask-to-Buy approvals, without double-granting on the race.
        let shields = (plan.grantsShields && !hasProcessed(transaction.id)) ? 4 : 0
        let ok = await AuthService.shared.applyProGrant(expiresAt: expiry, addShields: shields)

        // Only mark + finish once the entitlement is durably written. On failure
        // the transaction stays unfinished → StoreKit re-delivers it via
        // Transaction.updates for retry (fixes the paid-but-unfulfilled Day Pass).
        if ok {
            markProcessed(transaction.id)
            await transaction.finish()
        }
    }

    /// On launch / restore: reflect any active auto-renewable entitlement into the
    /// profile without granting shields (reconciliation, not a new purchase).
    private func syncCurrentEntitlements() async {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  let plan = Plan(rawValue: transaction.productID),
                  transaction.revocationDate == nil,
                  appAccountMatchesCurrentUser(transaction) else { continue }
            // Skip expired (StoreKit usually omits these, but be safe).
            if let exp = transaction.expirationDate, exp < Date() { continue }
            await AuthService.shared.syncProExpiry(expiresAt: expiryDate(for: plan, transaction: transaction))
        }
    }

    /// True when the transaction has no appAccountToken (legacy/unmapped — accept,
    /// matching the webhook's no-token no-op) or it equals the current user's id.
    private func appAccountMatchesCurrentUser(_ transaction: Transaction) -> Bool {
        guard let token = transaction.appAccountToken else { return true }
        guard let uid = AuthService.shared.profile?.id, let current = UUID(uuidString: uid) else { return false }
        return token == current
    }

    private func expiryDate(for plan: Plan, transaction: Transaction) -> Date {
        switch plan {
        case .monthly, .yearly:
            // Trust StoreKit's expiration for auto-renewables (keeps renewals in sync).
            return transaction.expirationDate ?? Date().addingTimeInterval(Double(plan.addedDays) * 86_400)
        case .day:
            // Day pass stacks on the existing Pro window (max semantics), like the web.
            let now = Date()
            let existing = AuthService.shared.profile?.proExpiresAt.flatMap(parseTimestamp)
            let base = max(existing ?? now, now)
            return base.addingTimeInterval(86_400)
        }
    }
}
