package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * AdMob lifecycle + the game-start rewarded interstitial — Android port of iOS
 * AdsManager (which mirrors the web AdGate). Ads only show for non-Pro users.
 *
 * Flow per Google: UMP consent (GDPR/UK/EEA form when required) → initialize
 * the Mobile Ads SDK (gated on canRequestAds) → preload the interstitial.
 *
 * IDs: Google's TEST app/unit IDs until a Wordocious ANDROID AdMob app exists
 * (the approved AdMob app ca-app-pub-3015627373086578~8393761846 is iOS-only —
 * Android needs its own app + units in the AdMob console; swap the manifest
 * APPLICATION_ID meta-data and INTERSTITIAL_UNIT below when created).
 */
object AdsManager {
    private const val ENABLED = true

    /** Google TEST rewarded-interstitial unit — replace with the real Android unit. */
    private const val INTERSTITIAL_UNIT = "ca-app-pub-3940256099942544/5354046379"

    /** Google TEST banner unit — replace with the real Android unit alongside the above. */
    const val BANNER_UNIT = "ca-app-pub-3940256099942544/6300978111"

    /** Whether ads should show right now (enabled + not Pro) — web AdGate gate. */
    val active: Boolean get() = ENABLED && !AuthService.isProActive

    /**
     * True once the Mobile Ads SDK has actually initialized (consent resolved).
     * The banner must not build an AdView before this or the request is dropped
     * and the slot renders empty for the rest of the session.
     */
    var initialized by androidx.compose.runtime.mutableStateOf(false)

    private var started = false
    private var interstitial: RewardedInterstitialAd? = null

    /** Call once from the launcher activity. Consent → init → preload. */
    fun start(activity: Activity) {
        if (!ENABLED || started) return
        started = true
        runCatching {
            val params = ConsentRequestParameters.Builder()
                .setTagForUnderAgeOfConsent(false)
                .build()
            val consentInfo = UserMessagingPlatform.getConsentInformation(activity)
            consentInfo.requestConsentInfoUpdate(
                activity, params,
                {
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { _ ->
                        if (consentInfo.canRequestAds()) initAds(activity)
                    }
                },
                {
                    // Consent fetch failed (offline etc.) — initialize anyway if allowed.
                    if (consentInfo.canRequestAds()) initAds(activity)
                },
            )
        }
    }

    private fun initAds(context: Context) {
        runCatching {
            MobileAds.initialize(context) { initialized = true }
            preload(context)
        }
    }

    private fun preload(context: Context) {
        runCatching {
            RewardedInterstitialAd.load(
                context, INTERSTITIAL_UNIT, AdRequest.Builder().build(),
                object : RewardedInterstitialAdLoadCallback() {
                    override fun onAdLoaded(ad: RewardedInterstitialAd) { interstitial = ad }
                    override fun onAdFailedToLoad(error: LoadAdError) { interstitial = null }
                },
            )
        }
    }

    /**
     * Present the game-start interstitial for free users. Calls [onDone] when
     * dismissed — or immediately when Pro / disabled / nothing loaded — so the
     * game proceeds either way (web AdGate semantics).
     */
    fun showGameStartInterstitial(activity: Activity, onDone: () -> Unit) {
        val ad = interstitial
        if (!active || ad == null) { onDone(); return }
        interstitial = null
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { preload(activity); onDone() }
            override fun onAdFailedToShowFullScreenContent(error: AdError) { preload(activity); onDone() }
        }
        runCatching { ad.show(activity) { /* cosmetic reward; play proceeds either way */ } }
            .onFailure { onDone() }
    }
}
