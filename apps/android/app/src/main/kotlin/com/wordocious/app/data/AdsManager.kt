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
import com.google.android.ump.ConsentInformation
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
 * ShowLoud LLC publisher (pub-6632322515624356, §230 — the personal pub-3015 was disabled 2026-08-22). App ~3517539727 is Android; iOS is ~7373908732;
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
    // §228: debug builds use Google's sample units — a developer's own device
    // must never touch live inventory (three months of family beta traffic on
    // live units is what got the publisher account disabled on 2026-08-22).
    private val INTERSTITIAL_UNIT = if (com.wordocious.app.BuildConfig.DEBUG)
        "ca-app-pub-3940256099942544/1033173712" else "ca-app-pub-6632322515624356/1003941509"

    val BANNER_UNIT: String = if (com.wordocious.app.BuildConfig.DEBUG)
        "ca-app-pub-3940256099942544/6300978111" else "ca-app-pub-6632322515624356/8114426132"

    /** Whether ads should show right now (enabled + not Pro + not an
     *  admin/tester account — §228) — web AdGate gate. */
    val active: Boolean get() = ENABLED && !AuthService.isProActive && !AuthService.isAdsExempt

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

    /**
     * True when Google says a privacy-options entry point must be offered.
     *
     * UMP requires a PERSISTENT way to change an ad-consent choice — a form
     * shown once at first launch is not compliance, it's a one-shot. Our
     * in-app policy promised users a choice they had no way to revisit.
     * Drives the visibility of the Settings row so it doesn't appear for
     * users outside a consent region, where Google would show nothing.
     */
    fun privacyOptionsRequired(activity: Activity): Boolean = runCatching {
        UserMessagingPlatform.getConsentInformation(activity)
            .privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
    }.getOrDefault(false)

    /**
     * Re-present the consent form so a user can WITHDRAW or change consent.
     * onDone reports null on success or a message to surface on failure.
     */
    fun showPrivacyOptions(activity: Activity, onDone: (String?) -> Unit) {
        runCatching {
            UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
                onDone(error?.message)
            }
        }.onFailure { onDone(it.message ?: "Could not open privacy options.") }
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
