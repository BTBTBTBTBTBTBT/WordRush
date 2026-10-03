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
            listOf("Presets", "Body", "Color", "Pattern", "Eyes", "Nose", "Cheeks", "Mouth", "Hats", "Extras", "Backdrop", "Frame"),
            BuilderTab.entries.map { it.label },
        )
        // Round 2: the Color tab is the glossy swatch grid (SwatchGrid rows), not option tiles.
        BuilderTab.entries.filter { it != BuilderTab.COLOR }.forEach { assertTrue(it.name, MascotBuilderLogic.options(it).isNotEmpty()) }
        assertEquals(38, com.wordocious.core.AvatarOptions.SWATCHES.size)
        assertEquals(10, MascotBuilderLogic.options(BuilderTab.PRESETS).size)
        // The full catalogs (round 2): 33 hats + None, 9 face + 11 neck/back extras + None, auto + 18 backdrops.
        assertEquals(34, MascotBuilderLogic.options(BuilderTab.HATS).size)
        assertEquals(21, MascotBuilderLogic.options(BuilderTab.EXTRAS).size)
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
            BuilderOption("bg", "aurora"), BuilderOption("bg", "galaxy"),
            BuilderOption("frame", "diamond"), BuilderOption("frame", "pro"),
        )
        pro.forEach { assertTrue(it.toString(), MascotBuilderLogic.proLocked(it, isPro = false)) }
        assertFalse(MascotBuilderLogic.proLocked(BuilderOption("head", "wizard"), isPro = false))
        assertFalse(MascotBuilderLogic.proLocked(BuilderOption("bg", "sunset"), isPro = false))
        // Exactly the ★ items are Pro only.
        val all = BuilderTab.entries.flatMap { MascotBuilderLogic.options(it) }
        assertEquals(pro.toSet(), all.filter { MascotBuilderLogic.isProOnly(it) }.toSet())
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
}
