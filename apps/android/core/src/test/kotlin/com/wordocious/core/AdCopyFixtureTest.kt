package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** Parity guard for the "are ads serving" switch (packages/core/src/ads.ts, ad-copy-fixtures.json). */
class AdCopyFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/ad-copy-fixtures.json")!!.readText()).jsonObject
    }

    @Test
    fun ad_switch_and_caption_match() {
        assertEquals(root["adsServing"]!!.jsonPrimitive.boolean, ADS_SERVING)
        assertEquals(root["noLimitsCaption"]!!.jsonPrimitive.content, StatsProfile.PRO_BENEFIT_CAPTION.getValue(StatsProfile.ProBenefit.NO_LIMITS))
    }

    @Test
    fun reasons_map_the_same() {
        val names = mapOf(
            "noLimits" to StatsProfile.ProBenefit.NO_LIMITS, "items" to StatsProfile.ProBenefit.ITEMS, "unlimited" to StatsProfile.ProBenefit.UNLIMITED,
            "vsBots" to StatsProfile.ProBenefit.VS_BOTS, "stats" to StatsProfile.ProBenefit.STATS,
        )
        for (r in root["reasons"]!!.jsonArray) {
            val o = r.jsonObject
            val reason = o["reason"]!!.jsonPrimitive.content
            assertEquals(reason, names.getValue(o["benefit"]!!.jsonPrimitive.content), StatsProfile.proBenefitForReason(reason))
        }
    }
}
