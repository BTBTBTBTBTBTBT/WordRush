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
 * Ads are DORMANT unless the remote kill switch is live: the `ads` row of
 * app_flags must be enabled for this player ([flagLive]; unknown / unreachable
 * / no row = OFF). Flip it in Admin → Flags; audience "testers" first, then
 * everyone. Until then nothing initializes, nothing requests, nothing draws.
 * Admin / tester devices ([AuthService.isAdsExempt]) never auto-initialize the
 * SDK at all; an admin starts it only by tapping "Ads test suite" in
 * Settings → Admin ([launchTestSuite]).
 *
 * Flow: remote flag → region gate ([ConsentGate]) → privacy flags →
 * LevelPlay.init → preload the interstitial → show at game start, reload
 * after each show.
 */
object AdsManager {
    /** LevelPlay dashboard → the Android app → App Settings → App Key. */
    private const val APP_KEY = "28b3fb835"
    /** LevelPlay dashboard → the Android app → Ad Units → the *Interstitial* unit id. */
    private const val INTERSTITIAL_AD_UNIT = "cm5ivngx74w43t7l"
    /**
     * LevelPlay dashboard → Ad Units → the *Rewarded* unit id. Created with the
     * account, but NOT wired: showing it needs the product decision on what a
     * free player earns (LEVELPLAY_SETUP.md "Formats"). Kept so the id has a
     * home the moment that decision lands.
     */
    @Suppress("unused")
    private const val REWARDED_AD_UNIT = "uuowlbw6m5c26cae"

    /** True while the dashboard values above are present (they are; kept so a blanked constant re-dormants ads). */
    private val configured: Boolean get() = APP_KEY.isNotEmpty() && INTERSTITIAL_AD_UNIT.isNotEmpty()

    /**
     * Remote kill switch: the `ads` row of app_flags (FlagsService). Fail
     * CLOSED — flags unknown / unreachable / no row / disabled = OFF; audience
     * "testers" = on for admins and testers only. Flip it in Admin → Flags;
     * audience "testers" first, then everyone.
     */
    private fun flagLive(flags: Map<String, FlagsService.AppFlag>? = FlagsService.flags.value): Boolean =
        FlagsService.isOn("ads", flags)

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
     * registers test devices in the DASHBOARD (LevelPlay → Test devices), not
     * via an SDK call, so this list mirrors what is registered there and only
     * feeds the "test device" line of the Admin → Ads status. To add a device:
     * Admin → Ads → My ad ID → copy it, paste it here AND into LevelPlay →
     * Test devices, before installing an internal-track build on that device.
     */
    private val TEST_DEVICE_GAIDS: List<String> = emptyList()

    /** Whether [gaid] is a registered developer / family device (see [TEST_DEVICE_GAIDS]). */
    fun isTestDevice(gaid: String?): Boolean =
        gaid != null && TEST_DEVICE_GAIDS.any { it.equals(gaid, ignoreCase = true) }

    /** Set by [start]: true when the device region requires consent we cannot yet collect. */
    private var regionBlocked = false

    /**
     * Whether ads should show right now (configured + the remote `ads` flag
     * live + a build that may request + not in a consent-gated region + not
     * Pro + not an admin/tester account — §228) — web AdGate gate.
     */
    val active: Boolean
        get() = configured && flagLive() && requestsAds && !regionBlocked &&
            !AuthService.isProActive && !AuthService.isAdsExempt

    private var started = false
    private var initialized = false
    private var initInFlight = false
    /** Set when OUR init ran with the test-suite metadata, so [launchTestSuite] can open it. */
    private var testSuiteArmed = false
    /** Admin tap waiting on init: reports null on launch, or a message on failure. */
    private var suiteCallback: ((String?) -> Unit)? = null
    private var suiteActivity: Activity? = null
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
     * users stay ad-free until a CMP arrives (phase 2). Nothing initializes
     * unless the remote `ads` flag is live, and never for an admin / tester
     * (their devices are the ones that must not touch live inventory).
     * Idempotent and safe to call again when the flags or profile change.
     */
    fun start(activity: Activity) {
        if (!configured || !requestsAds || started) return
        if (!flagLive() || AuthService.isAdsExempt) return
        val appContext = activity.applicationContext
        regionBlocked = ConsentGate.blocksAds(appContext)
        if (regionBlocked) return
        started = true
        initialize(appContext)
    }

    private fun initialize(appContext: Context) {
        if (initialized || initInFlight) return
        // Re-check at every (re)try: the kill switch must stop a backoff loop too. A pending admin
        // test-suite request is an explicit tap, so it proceeds past the flag (but never past
        // configured / release-build / region — see launchTestSuite).
        if (suiteCallback == null && !flagLive()) { started = false; return }
        initInFlight = true
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
                    initInFlight = false
                    initialized = true
                    initRetryAttempt = 0.0
                    preload()
                    openPendingTestSuite()
                }

                /** The guide says "recommended to initialize again" — same capped backoff as loads. */
                override fun onInitFailed(error: LevelPlayInitError) {
                    initInFlight = false
                    val cb = suiteCallback
                    if (cb != null) {   // an admin tap: report, don't loop in the background
                        suiteCallback = null; suiteActivity = null
                        mainHandler.post { cb("LevelPlay init failed: ${error.errorMessage}") }
                        return
                    }
                    initRetryAttempt += 1
                    mainHandler.postDelayed({ initialize(appContext) }, backoffMs(initRetryAttempt))
                }
            })
        }.onFailure { initInFlight = false }
    }

    /** onInitSuccess tail: opens LevelPlay's Integration Test Suite for a waiting admin tap. */
    private fun openPendingTestSuite() {
        val cb = suiteCallback ?: return
        val act = suiteActivity
        suiteCallback = null; suiteActivity = null
        mainHandler.post {
            if (act == null || act.isFinishing) { cb("Screen closed before the suite opened"); return@post }
            runCatching { LevelPlay.launchTestSuite(act) }
                .onSuccess { cb(null) }
                .onFailure { cb("Could not open the test suite: ${it.message}") }
        }
    }

    /**
     * Admin-only (Settings → Admin → Ads test suite): initialize LevelPlay on
     * an EXPLICIT tap and open its Integration Test Suite. Works for admins
     * although they are ads-exempt, because the suite loads in LevelPlay's own
     * test mode and the exempt gates only govern the game-start interstitial
     * ([active]) and the auto-start ([start]). Still refused for: a debug
     * build (§228), a blanked key, a consent-gated region (no CMP yet).
     * The `is_test_suite` metadata only counts if set BEFORE init, so if the
     * SDK already came up this session without it the admin is told to
     * force-quit and tap again. [onResult] gets null once the suite is
     * launched, or a message to show.
     */
    fun launchTestSuite(activity: Activity, onResult: (String?) -> Unit) {
        if (!configured) { onResult("No LevelPlay keys in this build"); return }
        if (!requestsAds) { onResult("Debug builds never touch LevelPlay (use an internal-track build)"); return }
        if (!AuthService.isAdsExempt) { onResult("Admin only"); return }
        val appContext = activity.applicationContext
        regionBlocked = ConsentGate.blocksAds(appContext)
        if (regionBlocked) { onResult("This region is consent-gated (no CMP yet), so the SDK stays off"); return }
        if (initInFlight || suiteCallback != null) { onResult("LevelPlay is already starting; try again in a moment"); return }
        if (initialized) {
            if (!testSuiteArmed) { onResult("LevelPlay started earlier this session without test mode: force-quit the app, reopen, then tap again"); return }
            runCatching { LevelPlay.launchTestSuite(activity) }
                .onSuccess { onResult(null) }
                .onFailure { onResult("Could not open the test suite: ${it.message}") }
            return
        }
        // Metadata first, init second (LevelPlay Integration Test Suite docs), then launchTestSuite on init success.
        runCatching { LevelPlay.setMetaData("is_test_suite", "enable") }
        testSuiteArmed = true
        suiteCallback = onResult
        suiteActivity = activity
        initialize(appContext)
    }

    /** This device's Google advertising ID, as the admin diagnostics show it. */
    data class AdId(val id: String?, val limited: Boolean, val error: String?)

    /** Reads the GAID off the main thread (AdvertisingIdClient blocks on a service bind). */
    suspend fun fetchAdId(context: Context): AdId = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        runCatching {
            val info = com.google.android.gms.ads.identifier.AdvertisingIdClient.getAdvertisingIdInfo(context.applicationContext)
            val id = info.id
            val zeros = id.isNullOrEmpty() || id.all { it == '0' || it == '-' }
            AdId(if (zeros) null else id, info.isLimitAdTrackingEnabled || zeros, null)
        }.getOrElse { AdId(null, false, it.message ?: it.javaClass.simpleName) }
    }

    /**
     * The one-line Admin → Ads status: configured / flag live / region
     * allowed / exempt / test device (plus the release-build requirement,
     * since a debug build requests nothing). [flags] makes it recompose when
     * the table changes; [gaid] is null until the ad ID has loaded.
     */
    fun statusLine(context: Context, gaid: String?, flags: Map<String, FlagsService.AppFlag>?): String {
        fun yn(b: Boolean) = if (b) "yes" else "no"
        return "Configured ${yn(configured)} · Flag live ${yn(flagLive(flags))} · " +
            "Region allowed ${yn(!ConsentGate.blocksAds(context.applicationContext))} · " +
            "Exempt ${yn(AuthService.isAdsExempt)} · Test device ${yn(isTestDevice(gaid))} · " +
            "Release build ${yn(requestsAds)}"
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
        // Exempt (admin / tester) devices never load live inventory, even when an admin opened the SDK for the suite.
        if (!configured || !initialized || AuthService.isAdsExempt || !flagLive()) return
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
            mainHandler.postDelayed({ if (flagLive() && !AuthService.isAdsExempt) interstitial?.loadAd() }, backoffMs(loadRetryAttempt))
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
