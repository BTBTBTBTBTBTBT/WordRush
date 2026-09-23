package com.wordocious.app.data

import android.content.Context
import android.telephony.TelephonyManager
import java.util.Locale

/**
 * Region gate for the ads SDK — docs/LEVELPLAY_SETUP.md "Consent".
 *
 * Unity LevelPlay ships no consent-management platform of its own (AppLovin
 * MAX did; Google's UMP is unusable because its forms live in the dead AdMob
 * console). Until a CMP is integrated the app must not initialize the ads SDK
 * for users in a region that requires prior consent: those users simply stay
 * ad-free. The decision is made from the device region and nothing else.
 *
 * Phase 2 (a separate task): integrate Usercentrics (Unity's partner CMP),
 * paste its settings id here, and lift the gate once the CMP has run.
 */
object ConsentGate {
    /**
     * Regions whose users see no ads until a CMP exists: the 27 EU / EEA
     * member states, the three EFTA states in the EEA (Norway, Iceland,
     * Liechtenstein), the United Kingdom and Switzerland. ISO 3166-1 alpha-2,
     * upper case; "UK" is not an ISO code but is included defensively in case
     * a vendor locale uses it.
     */
    private val CONSENT_REGIONS: Set<String> = setOf(
        // EU 27
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
        "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
        // EEA / EFTA
        "NO", "IS", "LI",
        // UK GDPR, Swiss FADP
        "GB", "UK", "CH",
    )

    /**
     * Best-effort device country: the default locale's region first (what the
     * user set), the mobile network's country as the fallback when the locale
     * carries no region (e.g. a bare "en"). Empty when neither is known.
     */
    fun deviceCountry(context: Context): String {
        val fromLocale = Locale.getDefault().country.orEmpty()
        if (fromLocale.isNotEmpty()) return fromLocale.uppercase(Locale.ROOT)
        val fromNetwork = runCatching {
            context.getSystemService(TelephonyManager::class.java)?.networkCountryIso
        }.getOrNull().orEmpty()
        return fromNetwork.uppercase(Locale.ROOT)
    }

    /** True when the ads SDK must NOT be initialized on this device. */
    fun blocksAds(context: Context): Boolean = deviceCountry(context) in CONSENT_REGIONS
}
