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
 *   pro_monthly  $6.99  auto-renewing sub  → +30d,  +4 streak shields
 *   pro_yearly   $59.99 auto-renewing sub  → +365d, +4 streak shields
 *   pro_day      $1.00  consumable         → +24h stacked on any existing
 *                                            future expiry, no shields
 *
 * Entitlement is written to the same `profiles` columns every client uses
 * (is_pro / pro_expires_at / streak_shields) via AuthService.applyProGrant.
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
        PRO_DAY to "$1.00",
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var billingClient: BillingClient? = null
    private var productDetails: Map<String, ProductDetails> = emptyMap()

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

        val loaded = buildList {
            runCatching { addAll(client.queryProductDetails(subsParams).productDetailsList.orEmpty()) }
            runCatching { addAll(client.queryProductDetails(inappParams).productDetailsList.orEmpty()) }
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
                val result = client.queryPurchasesAsync(
                    QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                )
                val active = result.purchasesList
                    .filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                if (active.isEmpty()) {
                    _lastError.value = "No active subscription found."
                } else {
                    // Reconciliation, not a new purchase — no shield grant (mirrors
                    // iOS syncCurrentEntitlements).
                    active.forEach { handlePurchase(it, isNewPurchase = false) }
                }
            }.onFailure { _lastError.value = it.message?.take(120) ?: "Restore failed" }
        }
    }

    // MARK: Fulfillment

    private suspend fun handlePurchase(purchase: Purchase, isNewPurchase: Boolean) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        val client = billingClient ?: return
        for (productId in purchase.products) {
            when (productId) {
                PRO_DAY -> {
                    // Consumable: consume so it can be bought again, then stack
                    // 24h on any existing future Pro window (max semantics — same
                    // as iOS StoreManager.expiryDate(.day) and the web).
                    runCatching {
                        client.consumePurchase(
                            ConsumeParams.newBuilder()
                                .setPurchaseToken(purchase.purchaseToken)
                                .build()
                        )
                    }
                    val now = Instant.now()
                    val existing = AuthService.profile.value?.proExpiresAt
                        ?.let { runCatching { Instant.parse(it) }.getOrNull() }
                    val base = if (existing != null && existing.isAfter(now)) existing else now
                    AuthService.applyProGrant(base.plus(Duration.ofDays(1)).toString(), addShields = 0)
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
                    // New purchase: window starts now. Restore/reconcile: anchor on
                    // the recorded purchase time so a lapsed sub isn't extended.
                    val base = if (isNewPurchase) Instant.now()
                    else Instant.ofEpochMilli(purchase.purchaseTime)
                    // Shields only on real new purchases (mirrors iOS handle()).
                    AuthService.applyProGrant(
                        base.plus(Duration.ofDays(days)).toString(),
                        addShields = if (isNewPurchase) 4 else 0,
                    )
                }
            }
        }
    }

    fun clearError() {
        _lastError.value = null
    }
}
