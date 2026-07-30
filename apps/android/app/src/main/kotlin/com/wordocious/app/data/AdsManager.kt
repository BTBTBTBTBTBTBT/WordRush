package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * AdMob lifecycle + the game-start interstitial — Android port of iOS
 * AdsManager (which mirrors the web AdGate). Ads only show for non-Pro users.
 *
 * Flow per Google: UMP consent (GDPR/UK/EEA form when required) → initialize
 * the Mobile Ads SDK (gated on canRequestAds) → preload the interstitial.
 *
 * IDs: the REAL Wordocious Android AdMob app, created 2026-07-30 under the same
 * publisher as iOS (pub-3015627373086578). App ~3743919404 is Android; iOS is
 * the separate ~8393761846. Both are declared by the single app-ads.txt on
 * wordocious.com, which is per-publisher, not per-app.
 *
 * The app shows "Requires review" until it is live on Play and the store link
 * is added — ad serving is LIMITED, not off, until then (same review the iOS
 * app just cleared).
 */
object AdsManager {
    private const val ENABLED = true

    // STANDARD interstitial, not rewarded. A rewarded interstitial forces the
    // full ~30s watch because the user is nominally earning something — and we
    // granted nothing, so free players sat through the whole ad for no benefit.
    // Standard interstitials show a close button after a few seconds, which is
    // the normal pattern for a game-start gate. (Old rewarded unit
    // .../6697119876 left in AdMob, unused.)
    private const val INTERSTITIAL_UNIT = "ca-app-pub-3015627373086578/8174953152"

    const val BANNER_UNIT = "ca-app-pub-3015627373086578/3452009437"

    /** Whether ads should show right now (enabled + not Pro) — web AdGate gate. */
    val active: Boolean get() = ENABLED && !AuthService.isProActive

    /**
     * True once the Mobile Ads SDK has actually initialized (consent resolved).
     * The banner must not build an AdView before this or the request is dropped
     * and the slot renders empty for the rest of the session.
     */
    var initialized by androidx.compose.runtime.mutableStateOf(false)

    private var started = false
    private var interstitial: InterstitialAd? = null

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
            InterstitialAd.load(
                context, INTERSTITIAL_UNIT, AdRequest.Builder().build(),
                object : InterstitialAdLoadCallback() {
                    override fun onAdLoaded(ad: InterstitialAd) { interstitial = ad }
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
        // Standard interstitial: no reward callback, dismissal drives onDone.
        runCatching { ad.show(activity) }.onFailure { onDone() }
    }
}
