package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Parity: packages/core avatar-access.ts (avatar-access-fixtures.json) against the app's bundled avatar-access.json + avatar-parts.json. */
class AvatarAccessFixtureTest {
    private val app = File("../app/src/main")
    private val m: AvatarFitManifest by lazy { AvatarFitManifest.parse(File(app, "assets/avatar-parts.json").readText())!! }
    private val table: AvatarAccessTable by lazy { AvatarAccessTable.parse(File(app, "assets/avatar-access.json").readText())!! }

    private data class P(val field: String, val id: String)
    private data class Ctx(
        val isPro: Boolean, val date: String, val gating: Boolean, val owned: List<String>?, val stats: AvatarEarnStats?,
        val previewSeason: String?, val saved: AvatarConfig?,
    ) {
        fun ctx() = AvatarAccessContext(isPro, owned ?: emptyList(), stats, date, previewSeason, saved, gating)
    }
    private data class Named(val name: String, val ctx: Ctx)
    private data class Rule(val field: String, val id: String, val gating: Boolean, val key: String, val rule: AvatarAccessRule)
    private data class R(val kind: String, val tier: String? = null, val price: Double? = null, val progress: AvatarEarnProgress? = null, val season: String? = null)
    private data class Access(val ctx: String, val part: P, val unlocked: Boolean, val reason: String, val routes: List<R>, val lines: List<String>)
    private data class Save(val ctx: String, val draft: AvatarConfig, val ok: Boolean, val locked: List<P>, val enforced: AvatarConfig)
    private data class Earn(val cond: AvatarEarnCondition, val stats: AvatarEarnStats?, val progress: AvatarEarnProgress)
    private data class Earned(val stats: AvatarEarnStats?, val keys: List<String>)
    private data class F(
        val contexts: List<Named>, val rules: List<Rule>, val access: List<Access>, val saves: List<Save>,
        val earn: List<Earn>, val earned: List<Earned>, val tableSize: Int,
    )

    private fun r(route: AvatarAccessRoute): R = when (route) {
        is AvatarAccessRoute.Buy -> R("buy", tier = route.tier, price = route.price)
        AvatarAccessRoute.Pro -> R("pro")
        is AvatarAccessRoute.Earn -> R("earn", progress = route.progress)
        is AvatarAccessRoute.Season -> R("season", season = route.season)
    }

    private val f: F by lazy {
        Gson().fromJson(javaClass.classLoader!!.getResource("fixtures/avatar-access-fixtures.json")!!.readText(Charsets.UTF_8), F::class.java)
    }

    @Test fun flagShipsOff() {
        assertFalse(AvatarAccessConfig.ITEM_GATING)
    }

    @Test fun matchesSharedFixture() {
        assertEquals(f.tableSize, table.parts.size)
        val ctxs = f.contexts.associate { it.name to it.ctx.ctx() }
        assertEquals(10, ctxs.size)
        for (c in f.rules) {
            assertEquals("$c", c.key, AvatarAccess.key(c.field, c.id))
            assertEquals("$c", c.rule, AvatarAccess.partRule(c.field, c.id, table, m, c.gating))
        }
        for (c in f.access) {
            val a = AvatarAccess.partAccess(AvatarPart(c.part.field, c.part.id), ctxs.getValue(c.ctx), table, m)
            assertEquals("$c", c.unlocked, a.unlocked)
            assertEquals("$c", c.reason, a.reason)
            assertEquals("$c", c.routes, a.routes.map { r(it) })
            assertEquals("$c", c.lines, AvatarAccess.lockedCardLines(a))
        }
        for (c in f.saves) {
            val ctx = ctxs.getValue(c.ctx)
            val check = AvatarAccess.saveCheck(c.draft, ctx, table, m)
            assertEquals("$c", c.ok, check.ok)
            assertEquals("$c", c.locked.map { AvatarPart(it.field, it.id) }, check.locked)
            val enforced = AvatarAccess.enforce(c.draft, ctx, table, m)
            assertEquals("$c", c.enforced, enforced)
            // the stored shape: integrated parts / the pose that fell to "none" are omitted, like the TS delete
            assertEquals("$c", avatarToJson(c.enforced), avatarToJson(enforced))
        }
        for (c in f.earn) assertEquals("$c", c.progress, AvatarAccess.evaluateEarn(c.cond, c.stats))
        for (c in f.earned) assertEquals("$c", c.keys, AvatarAccess.earnedKeys(c.stats, table))
        assertEquals(240, f.access.size)
        assertEquals(60, f.saves.size)
    }

    @Test fun lockedCardSpotChecks() {
        val on = AvatarAccessContext(isPro = false, date = "2026-07-01", gating = true, stats = AvatarEarnStats(bestStreak = 12.0))
        val star = AvatarAccess.partAccess(AvatarPart("body", "star"), on, table, m)
        assertEquals(listOf("Earn: Keep a 30-day play streak (12 / 30)", "Included with Pro", "Buy $2.99"), AvatarAccess.lockedCardLines(star))
        assertEquals("$0.99", AvatarAccess.priceLabel(0.99))
        assertEquals("Free during Winter Holidays", AvatarAccess.routeLine(AvatarAccessRoute.Season("winter-holidays")))
        // junk stats read as 0
        assertEquals(0, AvatarAccess.evaluateEarn(AvatarEarnCondition("s", stat = "level", min = 10.0), AvatarEarnStats(level = Double.NaN)).current)
        // a part nobody priced is free
        assertTrue(AvatarAccess.partAccess(AvatarPart("head", "not-a-hat"), on, table, m).unlocked)
    }
}
