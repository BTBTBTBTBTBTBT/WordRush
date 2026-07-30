package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.consumePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

/**
 * Google Play Billing wrapper — Android analogue of the iOS StoreKit 2
 * StoreManager (apps/ios/Wordocious/Sources/StoreManager.swift) and the web's
 * lib/payment/purchase-service.ts fulfillment:
 *   pro_monthly  $6.99  auto-renewing sub  → +30d
 *   pro_yearly   $59.99 auto-renewing sub  → +365d
 *   pro_day      $1.00  consumable         → +24h stacked on any existing
 *                                            future expiry
 *
 * Entitlement is written to the same `profiles` columns every client uses
 * (is_pro / pro_expires_at) via AuthService.applyProGrant. The +4 streak
 * shields per paid period are NOT granted here — the Play RTDN webhook owns
 * them (see PAYMENTS_RUNBOOK "streak shields").
 * Everything is wrapped in runCatching — on emulators without Play services
 * or before the Play Console products exist, the screen simply keeps its
 * hardcoded fallback prices and purchase attempts surface a friendly error.
 */
object StoreManager {
    const val PRO_MONTHLY = "pro_monthly"
    const val PRO_YEARLY = "pro_yearly"
    const val PRO_DAY = "pro_day"

    /** Fallback display prices when Play products haven't loaded. */
    private val FALLBACK_PRICES = mapOf(
        PRO_MONTHLY to "$6.99",
        PRO_YEARLY to "$59.99",
        PRO_DAY to "$1",
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var billingClient: BillingClient? = null
    private var productDetails: Map<String, ProductDetails> = emptyMap()

    /**
     * Play orderIds whose one-time effect (Day Pass +24h) has been applied —
     * Android analogue of iOS StoreManager.processedTxIDs. Without it a Day Pass
     * re-delivered after a failed consume would stack a second 24h for free.
     *
     * It no longer tracks subscription orders: its other job was deciding when
     * to credit renewal shields client-side, and those are granted server-side
     * from the RTDN webhook now — which sees a renewal whether or not the app is
     * ever reopened.
     */
    private const val PREFS_NAME = "wordocious_store"
    private const val KEY_SEEN_ORDERS = "seen-order-ids"
    private var prefs: android.content.SharedPreferences? = null
    private var seenOrderIds: MutableSet<String> = mutableSetOf()

    private fun markOrderSeen(orderId: String) {
        seenOrderIds.add(orderId)
        // putStringSet must get a fresh copy — SharedPreferences may not persist
        // in-place mutations of the set it handed out.
        prefs?.edit()?.putStringSet(KEY_SEEN_ORDERS, HashSet(seenOrderIds))?.apply()
    }

    private val _prices = MutableStateFlow(FALLBACK_PRICES)
    /** productId → localized formattedPrice (falls back to the US prices above). */
    val prices: StateFlow<Map<String, String>> = _prices.asStateFlow()

    private val _purchasingId = MutableStateFlow<String?>(null)
    val purchasingId: StateFlow<String?> = _purchasingId.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        _purchasingId.value = null
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK ->
                purchases?.forEach { p ->
                    scope.launch { runCatching { handlePurchase(p, isNewPurchase = true) } }
                }
            BillingClient.BillingResponseCode.USER_CANCELED -> Unit // not an error
            else -> _lastError.value =
                result.debugMessage.ifBlank { "Purchase failed (code ${result.responseCode})" }
        }
    }

    /** Call once at launch (next to AuthService.initialize()). Never throws. */
    fun start(context: Context) {
        runCatching {
            prefs = context.applicationContext
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            seenOrderIds = prefs?.getStringSet(KEY_SEEN_ORDERS, null)?.toMutableSet()
                ?: mutableSetOf()
            val client = BillingClient.newBuilder(context.applicationContext)
                .setListener(purchasesListener)
                .enablePendingPurchases(
                    PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
                )
                .build()
            billingClient = client
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        scope.launch { runCatching { queryProducts() } }
                        // Reconcile active subs at launch (iOS
                        // syncCurrentEntitlements parity). PurchasesUpdatedListener
                        // only fires on purchase ACTIONS, never on background
                        // renewals, so without this an Android sub's Pro is set
                        // once and never re-reflected until the user taps Restore.
                        scope.launch { runCatching { reconcileActiveSubs() } }
                        // A Day Pass left unconsumed because its grant didn't
                        // land is only ever redelivered by an INAPP query — the
                        // listener never re-fires for it. This is the retry path
                        // iOS gets for free from Transaction.updates.
                        scope.launch { runCatching { reconcileDayPasses() } }
                    }
                }

                override fun onBillingServiceDisconnected() {
                    // Play will reconnect lazily on the next purchase attempt.
                }
            })
        }
    }

    private suspend fun queryProducts() {
        val client = billingClient ?: return
        val subsParams = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(PRO_MONTHLY, PRO_YEARLY).map {
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(it)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                }
            )
            .build()
        val inappParams = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRO_DAY)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                )
            )
            .build()

        // SUBS and INAPP can't share one query (Billing library constraint),
        // but they don't need to run back-to-back either.
        val loaded: List<ProductDetails> = coroutineScope {
            val subs = async {
                runCatching { client.queryProductDetails(subsParams).productDetailsList.orEmpty() }.getOrDefault(emptyList())
            }
            val inapp = async {
                runCatching { client.queryProductDetails(inappParams).productDetailsList.orEmpty() }.getOrDefault(emptyList())
            }
            subs.await() + inapp.await()
        }
        if (loaded.isEmpty()) return // keep fallbacks — products not created yet / no Play

        productDetails = loaded.associateBy { it.productId }
        _prices.value = FALLBACK_PRICES.mapValues { (id, fallback) ->
            loaded.firstOrNull { it.productId == id }?.displayPrice() ?: fallback
        }
    }

    private fun ProductDetails.displayPrice(): String? = when (productType) {
        BillingClient.ProductType.SUBS ->
            // Last pricing phase of the base offer = the recurring full price
            // (skips intro/free-trial phases if any are ever added).
            subscriptionOfferDetails?.firstOrNull()
                ?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice
        else -> oneTimePurchaseOfferDetails?.formattedPrice
    }

    // MARK: Purchase

    /** Launch the Play purchase sheet for pro_monthly / pro_yearly / pro_day. */
    fun purchase(activity: Activity, productId: String) {
        _lastError.value = null
        runCatching {
            val client = billingClient
            val details = productDetails[productId]
            if (client == null || !client.isReady || details == null) {
                _lastError.value = "That plan isn't available right now."
                return
            }
            val detailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
            if (details.productType == BillingClient.ProductType.SUBS) {
                val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
                if (offerToken == null) {
                    _lastError.value = "That plan isn't available right now."
                    return
                }
                detailsParams.setOfferToken(offerToken)
            }
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(detailsParams.build()))
            // Tag the purchase with the Supabase user UUID — Play analogue of the
            // iOS appAccountToken (surfaces in RTDN / Play purchase records).
            AuthService.userId?.let { flowParams.setObfuscatedAccountId(it) }

            _purchasingId.value = productId
            val result = client.launchBillingFlow(activity, flowParams.build())
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                _purchasingId.value = null
                _lastError.value =
                    result.debugMessage.ifBlank { "Couldn't start purchase (code ${result.responseCode})" }
            }
        }.onFailure {
            _purchasingId.value = null
            _lastError.value = it.message?.take(120) ?: "Purchase failed"
        }
    }

    /** Re-sync active subscriptions from Play (Restore Purchases). */
    fun restore() {
        _lastError.value = null
        scope.launch {
            runCatching {
                val client = billingClient
                if (client == null || !client.isReady) {
                    _lastError.value = "Google Play isn't available right now."
                    return@launch
                }
                val active = activeSubs(client)
                if (active.isEmpty()) {
                    _lastError.value = "No active subscription found."
                } else {
                    active.forEach { handlePurchase(it, isNewPurchase = false) }
                }
            }.onFailure { _lastError.value = it.message?.take(120) ?: "Restore failed" }
        }
    }

    /** Silent launch reconcile — same as restore() but no user-facing errors. */
    private suspend fun reconcileActiveSubs() {
        val client = billingClient ?: return
        if (!client.isReady) return
        activeSubs(client).forEach { runCatching { handlePurchase(it, isNewPurchase = false) } }
    }

    /** Silent launch retry for a Day Pass that was paid for but never granted. */
    private suspend fun reconcileDayPasses() {
        val client = billingClient ?: return
        if (!client.isReady) return
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        ).purchasesList.forEach { runCatching { handlePurchase(it, isNewPurchase = false) } }
    }

    private suspend fun activeSubs(client: BillingClient): List<Purchase> =
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ).purchasesList.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }

    // MARK: Fulfillment

    private suspend fun handlePurchase(purchase: Purchase, isNewPurchase: Boolean) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) {
            // Play's PENDING state (slow card / cash payment / parental approval)
            // arrives on the OK branch — tell the user, same as iOS StoreKit's
            // `case .pending`. Only for a fresh purchase; a pending order found
            // by the silent launch reconcile must stay silent.
            if (isNewPurchase && purchase.purchaseState == Purchase.PurchaseState.PENDING) {
                _lastError.value = "Your purchase is pending approval."
            }
            return
        }
        val client = billingClient ?: return
        for (productId in purchase.products) {
            when (productId) {
                PRO_DAY -> {
                    // Re-delivery of an already-stacked Day Pass (a consume that
                    // failed and retried) must not add a second 24h — iOS
                    // hasProcessed parity.
                    val dayOrderId = purchase.orderId
                    var granted = dayOrderId != null && dayOrderId in seenOrderIds
                    if (!granted) {
                        // Stack 24h on any existing future Pro window (max
                        // semantics — same as iOS StoreManager.expiryDate(.day)
                        // and the web). The grant needs the signed-in profile as
                        // its base; without one, leave the purchase untouched so
                        // a later reconcile retries it.
                        val now = Instant.now()
                        val loaded = AuthService.profile.value
                        if (loaded != null) {
                            // AuthService.parseTimestamp handles PostgREST's offset
                            // format — Instant.parse rejected it, so stacking never
                            // saw the existing window and every Day Pass reset to
                            // now+24h.
                            val existing = loaded.proExpiresAt?.let { AuthService.parseTimestamp(it) }
                            val base = if (existing != null && existing.isAfter(now)) existing else now
                            val target = base.plus(Duration.ofDays(1))
                            AuthService.applyProGrant(target.toString())
                            // iOS only finishes a Day Pass transaction once the
                            // entitlement is durably written, leaving it
                            // unfinished for retry otherwise (StoreManager.swift
                            // `case .failed: break`). applyProGrant re-reads the
                            // row from the server, so a stored expiry that
                            // reached the target IS that confirmation.
                            val written = AuthService.profile.value?.proExpiresAt
                                ?.let { AuthService.parseTimestamp(it) }
                            granted = written != null && !written.isBefore(target.minusSeconds(5))
                            if (granted) dayOrderId?.let { markOrderSeen(it) }
                        }
                    }
                    // Consumable: consume so it can be bought again — but only
                    // after a confirmed grant. Consuming first would burn the
                    // purchase token (Play never redelivers it) and the $1 would
                    // be lost outright if the write then failed.
                    if (granted) {
                        runCatching {
                            client.consumePurchase(
                                ConsumeParams.newBuilder()
                                    .setPurchaseToken(purchase.purchaseToken)
                                    .build()
                            )
                        }
                    }
                }
                PRO_MONTHLY, PRO_YEARLY -> {
                    if (!purchase.isAcknowledged) {
                        runCatching {
                            client.acknowledgePurchase(
                                AcknowledgePurchaseParams.newBuilder()
                                    .setPurchaseToken(purchase.purchaseToken)
                                    .build()
                            )
                        }
                    }
                    val days = if (productId == PRO_YEARLY) 365L else 30L
                    val now = Instant.now()
                    val existing = AuthService.profile.value?.proExpiresAt
                        ?.let { AuthService.parseTimestamp(it) }
                    val floor = now.plus(Duration.ofDays(days))

                    if (isNewPurchase) {
                        // A real payment: extend by the plan's length. This used
                        // to write now+days flat, which threw away every day the
                        // player already held from other sources — referral
                        // rewards, admin comps, stacked Day Passes. Someone with
                        // 97 banked days who bought monthly landed on 30 and lost
                        // the other 67, with no record to restore from.
                        // applyProGrant takes the later of this and the stored
                        // window, so the purchase can only ever add.
                        AuthService.applyProGrant(floor.toString())
                    } else if (existing == null || !existing.isAfter(now)) {
                        // RECONCILE/RESTORE with no live window. Play only returns
                        // a sub here while it's ACTIVE, but Purchase carries no
                        // expiry — purchaseTime is the ORIGINAL purchase, so
                        // purchaseTime+days is months in the PAST for a renewed
                        // sub, and writing that made Restore revoke Pro (F5).
                        // Re-establish with a conservative now+days; the RTDN
                        // webhook / server sweep is the real authority once live.
                        AuthService.applyProGrant(floor.toString())
                    }
                    // else: the stored window is already live, so leave it alone.
                    // Writing now+days on every launch would push a monthly
                    // subscriber's expiry out another 30 days each time the app
                    // opened — and now that the webhook never shrinks an expiry
                    // either, that inflation would be permanent free Pro.
                    //
                    // No shield grant on any of these paths. The +4 per billing
                    // period comes from the RTDN webhook (PURCHASED / RENEWED /
                    // RECOVERED), which is the only side that sees a renewal for
                    // a player who never reopens the app, and the only side a
                    // user can't fake by PATCHing their own profiles row. This
                    // client used to add its own +4 on top, so every subscriber
                    // was quietly getting 8 shields a period instead of 4.
                }
            }
        }
    }

    fun clearError() {
        _lastError.value = null
    }
}
