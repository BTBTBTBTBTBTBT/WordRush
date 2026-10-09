package com.wordocious.app.ui

import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarOptions
import com.wordocious.core.AvatarPresets
import com.wordocious.core.validateAvatar
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AN4 (+ addendum) — the builder's pure logic: Randomize stays valid, Pro gating, tier locks, Backdrop. */
class MascotBuilderLogicTest {
    private val photo = AvatarOptions.DISPLAY_PHOTO
    private val mascot = AvatarOptions.DISPLAY_MASCOT

    @Test fun everyTabHasOptionsAndTheSpecOrder() {
        assertEquals(
            listOf("Presets", "Body", "Color", "Pattern", "Eyes", "Nose", "Cheeks", "Mouth", "Hats", "Extras", "Backdrop", "Frame", "Season"),
            BuilderTab.entries.map { it.label },
        )
        // Round 2: the Color tab is the glossy swatch grid (SwatchGrid rows), not option tiles.
        // (the Season shelf is empty out of season: the room hides its tab then)
        BuilderTab.entries.filter { it != BuilderTab.COLOR && it != BuilderTab.SEASON }.forEach { assertTrue(it.name, MascotBuilderLogic.options(it).isNotEmpty()) }
        assertEquals(38, com.wordocious.core.AvatarOptions.SWATCHES.size)
        assertEquals(10, MascotBuilderLogic.options(BuilderTab.PRESETS).size)
        // The full catalogs (round 2): 33 hats + None, 9 face + 11 neck/back extras + None, auto + 18 backdrops.
        // no fit manifest here: seasons are unknown, so the 4 Halloween hats list too (seasonalPartsFollowTheSeason covers the filter)
        assertEquals(47, MascotBuilderLogic.options(BuilderTab.HATS).size)   // + goth/emo/punk hats + 3 sports hats (10-09)
        // None + 9 faces + 11 neck items + the 10-05 integrated parts (12 held, 5 wraps, 4 shoes, 4 buddies, 6 brows, 4 extras)
        assertEquals(21 + 35 + 7 + 12 + 10, MascotBuilderLogic.options(BuilderTab.EXTRAS).size)   // + 7 Halloween (bat wings, cat tail, collar, pail, 3 buddies) + 12 goth/emo/punk + 10 sports extras (10-09)
        assertEquals(19, MascotBuilderLogic.options(BuilderTab.BACKDROP).size)
        assertEquals("none", MascotBuilderLogic.options(BuilderTab.HATS).first().id)
        assertEquals("auto", MascotBuilderLogic.options(BuilderTab.BACKDROP).first().id)
        assertEquals("none", MascotBuilderLogic.options(BuilderTab.FRAME).first().id)
    }

    @Test fun applyingAnyOptionStaysValidAndIsSelected() {
        val base = AvatarConfig()
        BuilderTab.entries.forEach { tab ->
            MascotBuilderLogic.options(tab).forEach { o ->
                val c = MascotBuilderLogic.apply(base, o)
                assertEquals("$tab ${o.id}", c, validateAvatar(c, c))
                assertTrue("$tab ${o.id} selected", MascotBuilderLogic.isSelected(c, o))
            }
        }
    }

    @Test fun mascotPartsShowTheMascotButFramesDressThePhotoToo() {
        val onPhoto = AvatarConfig(display = photo)
        assertEquals(mascot, MascotBuilderLogic.apply(onPhoto, BuilderOption("eyes", "hearts")).display)
        assertEquals(mascot, MascotBuilderLogic.apply(onPhoto, BuilderOption("bg", "sunset")).display)
        assertEquals(photo, MascotBuilderLogic.apply(onPhoto, BuilderOption("frame", "bronze")).display)
        // Randomize keeps the display.
        assertEquals(photo, MascotBuilderLogic.randomize(onPhoto, isPro = false, level = 1, random = Random(1)).display)
    }

    @Test fun presetsKeepTheEarnedFrameAndBackdrop() {
        val mine = AvatarConfig(frame = "gold", head = "halo", bg = "mint")
        val w = MascotBuilderLogic.apply(mine, BuilderOption("preset", "w"))
        assertEquals("gold", w.frame)
        assertEquals("mint", w.bg)
        assertEquals("none", w.head)
        assertEquals(AvatarPresets.forCast("w")!!.copy(frame = "gold", bg = "mint", display = mascot), w)
    }

    @Test fun presetOfFindsTheExactCastLook() {
        val s = AvatarPresets.forCast("s")!!.copy(frame = "bronze", display = photo)
        assertTrue(MascotBuilderLogic.presetOf(s) != null)
        assertNull(MascotBuilderLogic.presetOf(s.copy(head = "halo")))
    }

    @Test fun accessoriesToggleOff() {
        val c = MascotBuilderLogic.tap(AvatarConfig(), BuilderOption("head", "wizard"))
        assertEquals("wizard", c.head)
        assertEquals("none", MascotBuilderLogic.tap(c, BuilderOption("head", "wizard")).head)
        val e = MascotBuilderLogic.tap(MascotBuilderLogic.tap(AvatarConfig(), BuilderOption("face", "monocle")), BuilderOption("neck", "scarf"))
        assertEquals("monocle", e.face); assertEquals("scarf", e.neck)
        val none = MascotBuilderLogic.tap(e, BuilderOption("extras", "none"))
        assertEquals("none", none.face); assertEquals("none", none.neck)
    }

    @Test fun proGating() {
        val pro = listOf(
            BuilderOption("head", "crown"), BuilderOption("head", "halo"), BuilderOption("head", "tiara"),
            BuilderOption("neck", "wings"), BuilderOption("neck", "chain"),
            BuilderOption("held", "wand-star"), BuilderOption("wrap", "cape-drape"),
            BuilderOption("bg", "aurora"), BuilderOption("bg", "galaxy"),
            BuilderOption("frame", "diamond"), BuilderOption("frame", "pro"),
        )
        pro.forEach { assertTrue(it.toString(), MascotBuilderLogic.proLocked(it, isPro = false)) }
        assertFalse(MascotBuilderLogic.proLocked(BuilderOption("head", "wizard"), isPro = false))
        assertFalse(MascotBuilderLogic.proLocked(BuilderOption("bg", "sunset"), isPro = false))
        // The ★ items stay Pro only (the 10-09 packs add their own Pro pieces on top).
        val all = BuilderTab.entries.flatMap { MascotBuilderLogic.options(it) }
        assertTrue(all.filter { MascotBuilderLogic.isProOnly(it) }.toSet().containsAll(pro))
        // Pro players never see a PRO lock.
        all.forEach { assertFalse(MascotBuilderLogic.proLocked(it, isPro = true)) }
        val crown = BuilderOption("head", "crown")
        assertTrue(MascotBuilderLogic.a11yLabel(BuilderTab.HATS, crown, "Crown", false, false, 1).endsWith("Pro only"))
        assertEquals("Hats: Crown", MascotBuilderLogic.a11yLabel(BuilderTab.HATS, crown, "Crown", false, true, 1))
        assertEquals("Backdrop: Galaxy, Pro only", MascotBuilderLogic.a11yLabel(BuilderTab.BACKDROP, BuilderOption("bg", "galaxy"), "Galaxy", false, false, 1))
    }

    @Test fun tierLocks() {
        val silver = BuilderOption("frame", "silver")
        val gold = BuilderOption("frame", "gold")
        val diamond = BuilderOption("frame", "diamond")
        assertFalse(MascotBuilderLogic.tierLocked(BuilderOption("frame", "bronze"), 1))
        assertFalse(MascotBuilderLogic.tierLocked(BuilderOption("frame", "none"), 1))
        assertTrue(MascotBuilderLogic.tierLocked(silver, 10))
        assertFalse(MascotBuilderLogic.tierLocked(silver, 11))
        assertTrue(MascotBuilderLogic.tierLocked(gold, 25))
        assertFalse(MascotBuilderLogic.tierLocked(gold, 26))
        // Diamond needs BOTH level 100 and Pro.
        assertFalse(MascotBuilderLogic.canWear(diamond, isPro = true, level = 99))
        assertFalse(MascotBuilderLogic.canWear(diamond, isPro = false, level = 100))
        assertTrue(MascotBuilderLogic.canWear(diamond, isPro = true, level = 100))
        // The Pro frame has no tier.
        assertFalse(MascotBuilderLogic.tierLocked(BuilderOption("frame", "pro"), 1))
        assertEquals(
            "Frame: Gold, locked, reach level 26",
            MascotBuilderLogic.a11yLabel(BuilderTab.FRAME, gold, "Gold", false, false, 3),
        )
        assertEquals("Eyes: Hearts, selected", MascotBuilderLogic.a11yLabel(BuilderTab.EYES, BuilderOption("eyes", "hearts"), "Hearts", true, false, 3))
    }

    @Test fun sanitizeDropsWhatThePlayerCannotWear() {
        val c = AvatarConfig(head = "tiara", neck = "wings", bg = "galaxy", frame = "gold", display = photo)
        val free = MascotBuilderLogic.sanitize(c, isPro = false, level = 5)
        assertEquals("none", free.head); assertEquals("none", free.neck)
        assertEquals("auto", free.bg); assertEquals("none", free.frame)
        assertEquals(photo, free.display)
        assertEquals(c, MascotBuilderLogic.sanitize(c, isPro = true, level = 30))
    }

    @Test fun randomizeStaysValidAndRespectsGating() {
        val r = Random(42)
        var cur = AvatarConfig(frame = "silver", bg = "mint")
        repeat(500) {
            val next = MascotBuilderLogic.randomize(cur, isPro = false, level = 12, random = r)
            assertEquals(next, validateAvatar(next, next))
            assertNotEquals(cur, next)
            assertFalse(AvatarOptions.isProOnly("head", next.head))
            assertFalse(AvatarOptions.isProOnly("neck", next.neck))
            assertEquals("silver", next.frame)
            assertEquals("mint", next.bg)
            assertTrue(next.head in AvatarOptions.HEADS && next.face in AvatarOptions.FACES && next.neck in AvatarOptions.NECKS)
            assertTrue(next.color in AvatarOptions.COLORS && next.patternColor in AvatarOptions.COLORS)
            cur = next
        }
        // A frame / backdrop the player can no longer wear is dropped, never invented.
        val lapsed = MascotBuilderLogic.randomize(AvatarConfig(frame = "gold", bg = "aurora"), isPro = false, level = 1, random = r)
        assertEquals("none", lapsed.frame); assertEquals("auto", lapsed.bg)
        assertEquals("none", MascotBuilderLogic.randomize(AvatarConfig(), isPro = true, level = 200, random = r).frame)
        // Pro players can roll the Pro hats.
        val rolls = (0 until 400).map { MascotBuilderLogic.randomize(AvatarConfig(), isPro = true, level = 1, random = r).head }
        assertTrue(rolls.contains("crown"))
    }

    @Test fun everyOptionHasAName() {
        BuilderTab.entries.forEach { tab ->
            MascotBuilderLogic.options(tab).forEach { assertTrue(MascotBuilderLogic.fallbackName(it).isNotBlank()) }
        }
        assertEquals("No hat", MascotBuilderLogic.fallbackName(BuilderOption("head", "none")))
        assertEquals("Auto", MascotBuilderLogic.fallbackName(BuilderOption("bg", "auto")))
    }

    /** 10-05 seasonal items: hidden out of season unless saved, on the shelf in season, never randomized out of season. */
    @Test fun seasonalPartsFollowTheSeason() {
        val fit = com.wordocious.core.AvatarFitManifest.parse(java.io.File("src/main/assets/avatar-parts.json").readText())!!
        val before = Triple(MascotBuilderLogic.fit, MascotBuilderLogic.season, MascotBuilderLogic.saved)
        try {
            MascotBuilderLogic.fit = fit
            MascotBuilderLogic.season = null
            MascotBuilderLogic.saved = null
            // Seasonal parts never disappear (10-09): off-season they stay in their own tab; only the Season shelf empties.
            assertTrue(MascotBuilderLogic.options(BuilderTab.HATS).any { it.id == "pumpkinhat" })
            assertTrue(MascotBuilderLogic.options(BuilderTab.SEASON).isEmpty())
            repeat(40) { assertFalse(MascotBuilderLogic.randomize(AvatarConfig(), true, 100).head in setOf("pumpkinhat", "candycornhat", "witchnight", "batears")) }
            MascotBuilderLogic.saved = AvatarConfig().copy(head = "pumpkinhat")
            assertTrue(MascotBuilderLogic.options(BuilderTab.HATS).any { it.id == "pumpkinhat" })
            assertTrue(MascotBuilderLogic.options(BuilderTab.HATS).any { it.id == "witchnight" })
            MascotBuilderLogic.season = "halloween"
            assertTrue(MascotBuilderLogic.options(BuilderTab.SEASON).any { it.id == "pumpkinhat" })   // the shelf now leads with the season bodies
            assertTrue(MascotBuilderLogic.options(BuilderTab.EXTRAS).any { it.id == "batwings" })
            assertEquals("halloween", MascotBuilderLogic.seasonOf(BuilderOption("pet", "ghost")))
            assertFalse(MascotBuilderLogic.isNew(BuilderOption("pet", "ghost")))
        } finally {
            MascotBuilderLogic.fit = before.first; MascotBuilderLogic.season = before.second; MascotBuilderLogic.saved = before.third
        }
    }
    /** Item gating (docs/cloud-prompts/11): flag OFF = no change; with gating on, try-on + the save check + the Locked card rows. */
    @Test fun itemGatingHelpers() {
        val fit = com.wordocious.core.AvatarFitManifest.parse(java.io.File("src/main/assets/avatar-parts.json").readText())!!
        val table = com.wordocious.core.AvatarAccessTable.parse(java.io.File("src/main/assets/avatar-access.json").readText())!!
        val before = Triple(MascotBuilderLogic.fit, MascotBuilderLogic.season, MascotBuilderLogic.accessTable)
        try {
            MascotBuilderLogic.fit = fit
            MascotBuilderLogic.season = null
            MascotBuilderLogic.accessTable = table
            // the flag ships OFF: the maker never gates, Save writes exactly what sanitize wrote
            assertFalse(com.wordocious.core.AvatarAccessConfig.ITEM_GATING)
            assertFalse(MascotBuilderLogic.gatingOn())
            val draft = AvatarConfig().copy(head = "cowboy", pet = "kitten", color = "navy", patternColor = "navy", neck = "wings")
            val off = MascotBuilderLogic.accessContext(isPro = false, stats = null, saved = null)
            assertFalse(MascotBuilderLogic.itemLocked(BuilderOption("head", "cowboy"), off))
            assertFalse(MascotBuilderLogic.itemLocked(BuilderOption("head", "cowboy"), null))
            assertNull(MascotBuilderLogic.saveCheck(draft, off))
            assertEquals(MascotBuilderLogic.sanitize(draft, false, 1), MascotBuilderLogic.saveLook(draft, false, 1, off))
            assertEquals(MascotBuilderLogic.sanitize(draft, false, 1), MascotBuilderLogic.saveLook(draft, false, 1, null))

            // gating on (the context's flag): locked tiles, the save check in maker order, save without them
            val stats = MascotBuilderLogic.earnStats(level = 3, currentStreak = 2, bestStreak = 12, bestLoginStreak = 5, achievements = null)
            val on = MascotBuilderLogic.accessContext(isPro = false, stats = stats, saved = null, date = "2026-07-01", gating = true)
            assertTrue(MascotBuilderLogic.itemLocked(BuilderOption("head", "cowboy"), on))
            assertFalse(MascotBuilderLogic.itemLocked(BuilderOption("head", "party"), on))
            assertFalse(MascotBuilderLogic.itemLocked(BuilderOption("preset", "w"), on))
            assertFalse(MascotBuilderLogic.itemLocked(BuilderOption("extras", "none"), on))
            // a best streak of 12 has earned the kitten (7-day streak): it saves without Pro
            val check = MascotBuilderLogic.saveCheck(draft, on)!!
            assertFalse(check.ok)
            assertEquals(listOf("color:navy", "head:cowboy", "neck:wings"), check.locked.map { "${it.field}:${it.id}" })
            val stripped = MascotBuilderLogic.saveLook(draft, false, 1, on)
            assertEquals(listOf("purple", "none", "none", "kitten"), listOf(stripped.color, stripped.head, stripped.neck, stripped.pet))
            assertTrue(MascotBuilderLogic.saveCheck(stripped, on)!!.ok)
            // no stats: the kitten is locked too and falls back to none
            val bare = on.copy(stats = null)
            assertEquals(listOf("color:navy", "head:cowboy", "neck:wings", "pet:kitten"), MascotBuilderLogic.saveCheck(draft, bare)!!.locked.map { "${it.field}:${it.id}" })
            assertEquals("none", MascotBuilderLogic.saveWithout(draft, bare).pet)
            // Pro: everything Pro-only saves (no stripping)
            val pro = on.copy(isPro = true)
            assertTrue(MascotBuilderLogic.saveCheck(draft, pro)!!.ok)
            // a saved (grandfathered) part stays
            val kept = on.copy(saved = AvatarConfig().copy(head = "cowboy"))
            assertEquals("cowboy", MascotBuilderLogic.saveWithout(draft, kept).head)

            // the Locked card rows: earn (with its bar) · Pro · buy
            val star = MascotBuilderLogic.partAccess(BuilderOption("body", "star"), on)!!
            val rows = MascotBuilderLogic.lockedRows(star)
            assertEquals(listOf("earn", "pro", "buy"), rows.map { it.kind })
            assertEquals(listOf("Earn: Keep a 30-day play streak (12 / 30)", "Included with Pro", "Buy $2.99"), rows.map { it.text })
            assertEquals(0.4f, rows[0].progress!!, 0.0001f)
            assertNull(rows[1].progress)
            // an achievement (target 1) has no bar
            val crown = MascotBuilderLogic.lockedRows(MascotBuilderLogic.partAccess(BuilderOption("head", "crown"), on)!!)
            assertEquals("Earn: Beat Webster, the final boss", crown[0].text)
            assertNull(crown[0].progress)
        } finally {
            MascotBuilderLogic.fit = before.first; MascotBuilderLogic.season = before.second; MascotBuilderLogic.accessTable = before.third
        }
    }
}
