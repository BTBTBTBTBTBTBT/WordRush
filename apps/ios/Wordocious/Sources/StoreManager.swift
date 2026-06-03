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
        guard case .verified(let transaction) = verification else { return }
        guard let plan = Plan(rawValue: transaction.productID) else { await transaction.finish(); return }

        let expiry = expiryDate(for: plan, transaction: transaction)
        // Shields granted on real purchases/renewals only (never on launch reconcile).
        let shields = (isNewPurchase && plan.grantsShields) ? 4 : 0
        await AuthService.shared.applyProGrant(expiresAt: expiry, addShields: shields)

        await transaction.finish()
    }

    /// On launch / restore: reflect any active auto-renewable entitlement into the
    /// profile without granting shields (reconciliation, not a new purchase).
    private func syncCurrentEntitlements() async {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  let plan = Plan(rawValue: transaction.productID),
                  transaction.revocationDate == nil else { continue }
            // Skip expired (StoreKit usually omits these, but be safe).
            if let exp = transaction.expirationDate, exp < Date() { continue }
            await AuthService.shared.syncProExpiry(expiresAt: expiryDate(for: plan, transaction: transaction))
        }
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
