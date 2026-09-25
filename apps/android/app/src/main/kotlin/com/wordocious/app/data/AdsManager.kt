package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.unity3d.mediation.LevelPlay
import com.unity3d.mediation.LevelPlayAdError
import com.unity3d.mediation.LevelPlayAdInfo
import com.unity3d.mediation.LevelPlayConfiguration
import com.unity3d.mediation.LevelPlayInitError
import com.unity3d.mediation.LevelPlayInitListener
import com.unity3d.mediation.LevelPlayInitRequest
import com.unity3d.mediation.LevelPlayPrivacySettings
import com.unity3d.mediation.interstitial.LevelPlayInterstitialAd
import com.unity3d.mediation.interstitial.LevelPlayInterstitialAdListener
import kotlin.math.min
import kotlin.math.pow

/**
 * Unity LevelPlay (ironSource mediation) lifecycle + the game-start
 * interstitial — Android port of iOS AdsManager (which mirrors the web AdGate).
 * Ads only show for non-Pro users. Setup and account work:
 * docs/LEVELPLAY_SETUP.md.
 *
 * History, so nobody re-treads it: AdMob died with the publisher entity
 * (Google disabled pub-3015 on 2026-08-22, swept ShowLoud's pub-6632 on 08-25,
 * denied the appeal on 09-01 — entity-level, no route back; §252). AppLovin
 * MAX replaced it on 09-04 but the account never activated and on 2026-09-23
 * AppLovin Support said it is "not accepting new signups". LevelPlay is a
 * separate company with its own policy. The AdMob / Google Ad Manager adapter
 * must NEVER be enabled here — it would put Google demand through a banned
 * entity.
 *
 * Ads stay DORMANT until both dashboard IDs below are filled in, so this ships
 * safely before the LevelPlay account exists — nothing initializes, nothing
 * requests, nothing draws.
 *
 * Flow: region gate ([ConsentGate]) → privacy flags → LevelPlay.init →
 * preload the interstitial → show at game start, reload after each show.
 */
object AdsManager {
    /** LevelPlay dashboard → the Android app → App Settings → App Key. */
    private const val APP_KEY = ""
    /** LevelPlay dashboard → the Android app → Ad Units → the *Interstitial* unit id. */
    private const val INTERSTITIAL_AD_UNIT = ""
    /**
     * LevelPlay dashboard → Ad Units → the *Rewarded* unit id. Created with the
     * account, but NOT wired: showing it needs the product decision on what a
     * free player earns (LEVELPLAY_SETUP.md "Formats"). Kept so the id has a
     * home the moment that decision lands.
     */
    @Suppress("unused")
    private const val REWARDED_AD_UNIT = ""

    /** Dormant until someone pastes the dashboard values in above. */
    private val configured: Boolean get() = APP_KEY.isNotEmpty() && INTERSTITIAL_AD_UNIT.isNotEmpty()

    /**
     * §228, kept absolute.
     *
     * Under AdMob a debug build could point at Google's *sample unit IDs* and
     * serve harmless fake ads. LevelPlay (like MAX) has no such thing — test
     * traffic is identified by DEVICE, not by ad unit. So debug builds request
     * no inventory whatsoever, and any device that should see real
     * (non-billable) test ads is registered by GAID below AND in the dashboard.
     *
     * Three months of unregistered family-beta devices hitting live inventory
     * is precisely what cost us the AdMob account. This closes that door.
     */
    private val requestsAds: Boolean get() = !com.wordocious.app.BuildConfig.DEBUG

    /**
     * Google Advertising IDs of every developer / family device. LevelPlay
     * registers test devices in the DASHBOARD (Setup → Test Devices), not via
     * an SDK call, so this list is documentation of what must be registered
     * there — and a local guard: a device whose GAID is listed here is
     * expected to be a tester and is treated as such by the dashboard. Add a
     * device HERE and in the dashboard before installing an internal-track
     * build on it.
     */
    @Suppress("unused")
    private val TEST_DEVICE_GAIDS: List<String> = emptyList()

    /** Set by [start]: true when the device region requires consent we cannot yet collect. */
    private var regionBlocked = false

    /**
     * Whether ads should show right now (configured + a build that may request
     * + not in a consent-gated region + not Pro + not an admin/tester account —
     * §228) — web AdGate gate.
     */
    val active: Boolean
        get() = configured && requestsAds && !regionBlocked &&
            !AuthService.isProActive && !AuthService.isAdsExempt

    private var started = false
    private var initialized = false
    private var interstitial: LevelPlayInterstitialAd? = null
    private var loadRetryAttempt = 0.0
    private var initRetryAttempt = 0.0
    private var onDone: (() -> Unit)? = null
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    /**
     * Call once from the launcher activity.
     *
     * Order matters: the privacy flags must be set BEFORE `LevelPlay.init`
     * (the LevelPlay regulation guide's stated best practice), and the SDK is
     * never initialized at all in a region the [ConsentGate] blocks — those
     * users stay ad-free until a CMP arrives (phase 2).
     */
    fun start(activity: Activity) {
        if (!configured || !requestsAds || started) return
        val appContext = activity.applicationContext
        regionBlocked = ConsentGate.blocksAds(appContext)
        if (regionBlocked) return
        started = true
        initialize(appContext)
    }

    private fun initialize(appContext: Context) {
        runCatching {
            // No CMP yet, so the most conservative flags everywhere we do
            // serve: no GDPR consent asserted, CCPA "do not sell" honored,
            // the app is not child-directed (Wordocious is a general-audience
            // word game). These are the 9.4+ replacements for the deprecated
            // LevelPlay.setConsent(false) / setMetaData("do_not_sell","true")
            // / setMetaData("is_child_directed","false").
            LevelPlayPrivacySettings.setGDPRConsent(false)
            LevelPlayPrivacySettings.setCCPA(true)
            LevelPlayPrivacySettings.setCOPPA(false)

            val request = LevelPlayInitRequest.Builder(APP_KEY).build()
            LevelPlay.init(appContext, request, object : LevelPlayInitListener {
                override fun onInitSuccess(configuration: LevelPlayConfiguration) {
                    initialized = true
                    initRetryAttempt = 0.0
                    preload()
                }

                /** The guide says "recommended to initialize again" — same capped backoff as loads. */
                override fun onInitFailed(error: LevelPlayInitError) {
                    initRetryAttempt += 1
                    mainHandler.postDelayed({ initialize(appContext) }, backoffMs(initRetryAttempt))
                }
            })
        }
    }

    /** Exponential backoff, capped at 64 s: 2, 4, 8, 16, 32, 64, 64, ... */
    private fun backoffMs(attempt: Double): Long = (2.0.pow(min(6.0, attempt)) * 1000).toLong()

    /**
     * Whether the Settings "Ad Privacy Settings" row should show. LevelPlay has
     * no consent UI of its own and the gated regions never initialize the SDK,
     * so there is nothing to present anywhere: always false until the phase-2
     * CMP (Usercentrics) arrives, at which point this returns true in consent
     * regions and [showPrivacyOptions] re-opens the CMP's second layer.
     */
    @Suppress("UNUSED_PARAMETER")
    fun privacyOptionsRequired(activity: Activity): Boolean = false

    /**
     * Re-present the consent flow so a user can WITHDRAW or change consent.
     * [onResult] reports null on success or a message to surface on failure.
     * No CMP yet (see [privacyOptionsRequired]) — completes with null so a
     * caller that somehow reaches it never dead-ends.
     */
    @Suppress("UNUSED_PARAMETER")
    fun showPrivacyOptions(activity: Activity, onResult: (String?) -> Unit) {
        onResult(null)
    }

    /**
     * One long-lived interstitial instance, reloaded after each show — the
     * pattern LevelPlay documents ("a reusable instance that can handle
     * multiple loads and shows throughout the session"). Must be created only
     * after onInitSuccess, which is the only caller.
     */
    private fun preload() {
        if (!configured || !initialized) return
        runCatching {
            if (interstitial == null) {
                interstitial = LevelPlayInterstitialAd(INTERSTITIAL_AD_UNIT).apply {
                    setListener(listener)
                }
            }
            interstitial?.loadAd()
        }
    }

    private val listener = object : LevelPlayInterstitialAdListener {
        override fun onAdLoaded(adInfo: LevelPlayAdInfo) { loadRetryAttempt = 0.0 }

        /** Exponential backoff, capped at 64 s, per the documented retry pattern. */
        override fun onAdLoadFailed(error: LevelPlayAdError) {
            loadRetryAttempt += 1
            mainHandler.postDelayed({ interstitial?.loadAd() }, backoffMs(loadRetryAttempt))
        }

        override fun onAdDisplayed(adInfo: LevelPlayAdInfo) {}
        override fun onAdClicked(adInfo: LevelPlayAdInfo) {}
        override fun onAdInfoChanged(adInfo: LevelPlayAdInfo) {}

        override fun onAdClosed(adInfo: LevelPlayAdInfo) {
            finish()
            interstitial?.loadAd()   // load the next one
        }

        override fun onAdDisplayFailed(error: LevelPlayAdError, adInfo: LevelPlayAdInfo) {
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
     * exactly once — when the ad closes, when it fails to display, or
     * immediately when Pro / dormant / region-gated / nothing loaded — so the
     * game proceeds either way (web AdGate semantics).
     */
    fun showGameStartInterstitial(activity: Activity, onDismissed: () -> Unit) {
        val ad = interstitial
        if (!active || ad == null || !ad.isAdReady()) { onDismissed(); return }
        onDone = onDismissed
        runCatching { ad.showAd(activity) }.onFailure { finish() }
    }
}
