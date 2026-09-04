package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.applovin.mediation.MaxAd
import com.applovin.mediation.MaxAdListener
import com.applovin.mediation.MaxError
import com.applovin.mediation.ads.MaxInterstitialAd
import com.applovin.sdk.AppLovinMediationProvider
import com.applovin.sdk.AppLovinSdk
import com.applovin.sdk.AppLovinSdkConfiguration
import com.applovin.sdk.AppLovinSdkInitializationConfiguration
import kotlin.math.min
import kotlin.math.pow

/**
 * AppLovin MAX lifecycle + the game-start interstitial — Android port of iOS
 * AdsManager (which mirrors the web AdGate). Ads only show for non-Pro users.
 *
 * §252: replaces AdMob, which died with the publisher account. Google disabled
 * pub-3015 on 2026-08-22, swept the ShowLoud LLC account pub-6632 on 08-25, and
 * denied the appeal on 09-01 — "not eligible for further participation in our
 * publisher programs, and may not create new accounts". Entity-level, no route
 * back. AppLovin is a separate company and does not inherit that ban.
 *
 * Ads stay DORMANT until both dashboard IDs below are filled in, so this ships
 * safely before the AppLovin account exists — nothing requests, nothing draws.
 *
 * Flow: configure the CMP → initialize (AppLovin's consent flow runs itself,
 * GDPR form where required) → preload the interstitial.
 */
object AdsManager {
    /** AppLovin dashboard → Account > General > Keys. */
    private const val SDK_KEY = ""
    /** AppLovin dashboard → MAX > Ad Units → the Android *interstitial* unit. */
    private const val INTERSTITIAL_UNIT = ""

    /** Dormant until someone pastes the dashboard values in above. */
    private val configured: Boolean get() = SDK_KEY.isNotEmpty() && INTERSTITIAL_UNIT.isNotEmpty()

    /**
     * §228, hardened for MAX.
     *
     * Under AdMob a debug build could point at Google's *sample unit IDs* and
     * serve harmless fake ads. MAX has no such thing — test traffic there is
     * identified by DEVICE, not by ad unit. So the gate is now absolute: debug
     * builds request no inventory whatsoever, and any device that should see
     * real (non-billable) test ads is registered by GAID below.
     *
     * Three months of unregistered family-beta devices hitting live inventory
     * is precisely what cost us the AdMob account. This closes that door.
     */
    private val requestsAds: Boolean get() = !com.wordocious.app.BuildConfig.DEBUG

    /**
     * Google Advertising IDs flagged to AppLovin as test devices: their
     * impressions are non-billable and are never counted as invalid activity.
     * Add a device HERE before installing an internal-track build on it.
     */
    private val TEST_DEVICE_GAIDS = emptyList<String>()

    /**
     * Whether ads should show right now (configured + a build that may request
     * + not Pro + not an admin/tester account — §228) — web AdGate gate.
     */
    val active: Boolean
        get() = configured && requestsAds && !AuthService.isProActive && !AuthService.isAdsExempt

    private var started = false
    private var interstitial: MaxInterstitialAd? = null
    private var retryAttempt = 0.0
    private var onDone: (() -> Unit)? = null
    /** Set from the init callback; drives whether the Settings privacy row shows. */
    private var inGdprRegion = false

    /**
     * Call once from the launcher activity.
     *
     * AppLovin's CMP owns the entire consent sequence — the GDPR form where
     * required — so there is no separate UMP round-trip to coordinate with.
     */
    fun start(activity: Activity) {
        if (!configured || !requestsAds || started) return
        started = true
        runCatching {
            // Consent settings must be configured BEFORE initialize().
            val settings = AppLovinSdk.getInstance(activity).settings
            settings.termsAndPrivacyPolicyFlowSettings.isEnabled = true
            settings.termsAndPrivacyPolicyFlowSettings.privacyPolicyUri =
                Uri.parse("https://wordocious.com/privacy")
            settings.termsAndPrivacyPolicyFlowSettings.termsOfServiceUri =
                Uri.parse("https://wordocious.com/terms")

            val initConfig = AppLovinSdkInitializationConfiguration.builder(SDK_KEY)
                .setMediationProvider(AppLovinMediationProvider.MAX)
                .setTestDeviceAdvertisingIds(TEST_DEVICE_GAIDS)
                .build()

            AppLovinSdk.getInstance(activity).initialize(initConfig) { sdkConfig ->
                inGdprRegion = sdkConfig.consentFlowUserGeography ==
                    AppLovinSdkConfiguration.ConsentFlowUserGeography.GDPR
                preload(activity)
            }
        }
    }

    /**
     * True when the user is in a region whose consent choice must stay
     * revisitable. GDPR requires a withdrawal path and our in-app policy
     * promises one; outside those regions the CMP would present nothing, so
     * the Settings row stays hidden rather than becoming a dead end.
     */
    @Suppress("UNUSED_PARAMETER")
    fun privacyOptionsRequired(activity: Activity): Boolean = configured && inGdprRegion

    /**
     * Re-present the consent flow so a user can WITHDRAW or change consent.
     * [onResult] reports null on success or a message to surface on failure.
     */
    fun showPrivacyOptions(activity: Activity, onResult: (String?) -> Unit) {
        runCatching {
            AppLovinSdk.getInstance(activity).cmpService.showCmpForExistingUser(activity) { error ->
                onResult(if (error == null) null else "Could not open ad privacy settings.")
            }
        }.onFailure { onResult(it.message ?: "Could not open privacy options.") }
    }

    /**
     * One long-lived interstitial instance, reloaded after each show — the
     * pattern MAX documents (unlike AdMob, where each show consumed the object).
     */
    private fun preload(context: Context) {
        if (!configured) return
        runCatching {
            if (interstitial == null) {
                interstitial = MaxInterstitialAd(INTERSTITIAL_UNIT, context.applicationContext).apply {
                    setListener(listener)
                }
            }
            interstitial?.loadAd()
        }
    }

    private val listener = object : MaxAdListener {
        override fun onAdLoaded(ad: MaxAd) { retryAttempt = 0.0 }

        /** Exponential backoff, capped at 64s, per AppLovin's documented pattern. */
        override fun onAdLoadFailed(adUnitId: String, error: MaxError) {
            retryAttempt += 1
            val delayMs = (2.0.pow(min(6.0, retryAttempt)) * 1000).toLong()
            Handler(Looper.getMainLooper()).postDelayed({ interstitial?.loadAd() }, delayMs)
        }

        override fun onAdDisplayed(ad: MaxAd) {}
        override fun onAdClicked(ad: MaxAd) {}

        override fun onAdHidden(ad: MaxAd) {
            finish()
            interstitial?.loadAd()   // load the next one
        }

        override fun onAdDisplayFailed(ad: MaxAd, error: MaxError) {
            finish()
            interstitial?.loadAd()
        }
    }

    /**
     * Fires the pending completion exactly once, whatever the outcome, so a
     * failed or dismissed ad can never strand the player on a blank screen.
     */
    private fun finish() {
        val done = onDone
        onDone = null
        done?.invoke()
    }

    /**
     * Present the game-start interstitial for free users. Calls [onDismissed]
     * when dismissed — or immediately when Pro / dormant / nothing loaded — so
     * the game proceeds either way (web AdGate semantics).
     */
    fun showGameStartInterstitial(activity: Activity, onDismissed: () -> Unit) {
        val ad = interstitial
        if (!active || ad == null || !ad.isReady) { onDismissed(); return }
        onDone = onDismissed
        runCatching { ad.showAd(activity) }.onFailure { finish() }
    }
}
