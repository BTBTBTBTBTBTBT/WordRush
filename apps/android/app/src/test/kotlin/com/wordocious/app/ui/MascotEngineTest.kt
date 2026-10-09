package com.wordocious.app.ui

import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarOptions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** FINISH_SPEC AN1/AN2/AN5: layer plan + small-size simplification, cache keying, the LRU, the manifest, the catalog. */
class MascotEngineTest {
    private val full = AvatarConfig(
        body = "star", color = "pink", pattern = "dots", patternColor = "mint", eyes = "hearts", nose = "blush",
        mouth = "grin", head = "wizard", face = "mustache", neck = "cape", frame = "gold", bg = "galaxy",
    )

    @Test
    fun layers_are_back_to_front() {
        assertEquals(
            listOf(
                MascotLayer.TILE, MascotLayer.BACK_ACC, MascotLayer.BODY, MascotLayer.PATTERN, MascotLayer.LETTER,
                MascotLayer.NOSE, MascotLayer.EYES, MascotLayer.MOUTH, MascotLayer.FACE_ACC, MascotLayer.HEAD_ACC, MascotLayer.FRAME,
            ),
            MascotLayers.plan(full, 64f),
        )
        // A bow tie sits in front; nothing optional → just the base layers.
        assertTrue(MascotLayer.NECK_ACC in MascotLayers.plan(full.copy(neck = "bowtie"), 64f))
        assertEquals(
            listOf(MascotLayer.TILE, MascotLayer.BODY, MascotLayer.LETTER, MascotLayer.EYES, MascotLayer.MOUTH),
            MascotLayers.plan(AvatarConfig(), 64f),
        )
    }

    @Test
    fun small_sizes_drop_pattern_and_accessories_but_keep_hats() {
        val small = MascotLayers.plan(full, 28f)
        assertFalse(MascotLayer.PATTERN in small)
        assertFalse(MascotLayer.BACK_ACC in small)
        assertFalse(MascotLayer.FACE_ACC in small)
        assertTrue(MascotLayer.HEAD_ACC in small)
        assertTrue(MascotLayer.FRAME in small)
        val s = MascotLayers.simplify(full, 16f)
        assertEquals("solid", s.pattern); assertEquals("none", s.face); assertEquals("none", s.neck); assertEquals("wizard", s.head)
        assertEquals(full, MascotLayers.simplify(full, 29f))
    }

    @Test
    fun cache_key_shares_simplified_small_configs() {
        val a = MascotKey.of(full, "B", 24f, 72, dark = false)
        val b = MascotKey.of(full.copy(pattern = "stripes", face = "monocle"), "B", 24f, 72, dark = false)
        assertEquals(a, b)
        // Big sizes keep them apart; size, letter and theme always matter.
        assertNotEquals(MascotKey.of(full, "B", 64f, 192, false), MascotKey.of(full.copy(pattern = "stripes"), "B", 64f, 192, false))
        assertNotEquals(a, MascotKey.of(full, "B", 24f, 96, false))
        assertNotEquals(a, MascotKey.of(full, "C", 24f, 72, false))
        assertNotEquals(a, MascotKey.of(full, "B", 24f, 72, true))
        assertEquals(72L * 72L * 4L, a.bytes)
    }

    @Test
    fun weighted_lru_evicts_least_recent() {
        val lru = WeightedLru<String, Int>(10) { _, v -> v.toLong() }
        lru.put("a", 4); lru.put("b", 4)
        lru.get("a")
        lru.put("c", 4) // over 10 → evicts b (least recently used)
        assertTrue(lru.containsKey("a")); assertFalse(lru.containsKey("b")); assertTrue(lru.containsKey("c"))
        assertEquals(8L, lru.weight)
        lru.put("huge", 11) // larger than the whole budget: not cached
        assertFalse(lru.containsKey("huge"))
        var made = 0
        lru.getOrPut("a") { made++; 1 }
        assertEquals(0, made)
    }

    @Test
    fun manifest_parses_shipped_asset_and_falls_back() {
        val text = File("src/main/assets/avatar-parts.json").takeIf { it.exists() }?.readText()
        val m = AvatarManifests.parse(text)
        for (b in AvatarOptions.BODIES) assertTrue(b, m.bodies.containsKey(b))
        if (text != null) {
            val classic = m.anchors("classic")
            assertEquals(0.3898f, classic.eyeY, 1e-6f)
            assertEquals(0.289f, classic.letterBox.x, 1e-6f)
            assertEquals(0.6143f, classic.headTop.w, 1e-6f)
            // Category-level placements: slot names map to the renderer's slots.
            assertEquals("eyes", m.placement("eyes", "beady").slot)
            assertEquals(0.37f, m.placement("eyes", "beady").scale, 1e-6f)
            assertEquals("head", m.placement("acc", "tophat", "head").slot)
            assertEquals("back", m.placement("acc", "cape", "neck").slot)
        }
        assertEquals(AvatarManifests.DEFAULT, AvatarManifests.parse("not json"))
        assertEquals(AvatarManifests.DEFAULT, AvatarManifests.parse(null))
        val custom = AvatarManifests.parse("""{"parts":{"art-av-eyes-hearts":{"slot":"eyeY","scale":0.5}}}""")
        assertEquals(0.5f, custom.placement("eyes", "hearts").scale, 1e-6f)
        assertEquals("eyes:hearts", AvatarManifests.partKey("art_av_eyes_hearts"))
        assertEquals(null, AvatarManifests.partKey("hearts"))
    }

    @Test
    fun catalog_apply_and_select() {
        var c = AvatarConfig()
        val wizard = AvatarParts.options(AvatarCategory.HATS).first { it.id == "wizard" }
        c = AvatarParts.apply(c, wizard)
        assertEquals("wizard", c.head)
        assertTrue(AvatarParts.isSelected(c, wizard))
        val none = AvatarParts.options(AvatarCategory.HATS).first()
        assertEquals(null, none.id)
        assertEquals("none", AvatarParts.apply(c, none).head)
        // Extras fill their own slot and toggle off.
        val shades = AvatarParts.options(AvatarCategory.EXTRAS).first { it.id == "heart-glasses" }
        val cape = AvatarParts.options(AvatarCategory.EXTRAS).first { it.id == "cape" }
        c = AvatarParts.apply(AvatarParts.apply(c, shades), cape)
        assertEquals("heart-glasses", c.face); assertEquals("cape", c.neck)
        assertEquals("none", AvatarParts.apply(c, cape).neck)
        // Pro flags (addendum).
        assertTrue(AvatarParts.options(AvatarCategory.HATS).filter { it.pro }.map { it.id }.containsAll(listOf("crown", "halo", "tiara")))
        assertTrue(AvatarParts.isProOnly(AvatarCategory.EXTRAS, "wings"))
        assertTrue(AvatarParts.isProOnly(AvatarCategory.BACKDROP, "galaxy"))
        assertTrue(AvatarParts.isProOnly(AvatarCategory.FRAME, "diamond"))
        assertFalse(AvatarParts.isProOnly(AvatarCategory.HATS, "beanie"))
        assertEquals(46, AvatarParts.options(AvatarCategory.HATS).size - 1)   // 33 + 4 Halloween (10-05) + 9 pack hats (10-09)
        assertEquals(19, AvatarParts.options(AvatarCategory.BACKDROP).size)
        // Every option has a label; art names use underscores.
        for (cat in AvatarParts.categories) for (o in AvatarParts.options(cat)) assertTrue("${cat}:${o.id}", o.label.isNotBlank())
        assertEquals("art_av_acc_heart_glasses", AvatarParts.drawableName(AvatarCategory.EXTRAS, "heart-glasses"))
        assertEquals(null, AvatarParts.drawableName(AvatarCategory.NOSE, "none"))
        // Randomize never hands a free player a Pro item.
        repeat(200) { i ->
            val r = AvatarParts.randomize(AvatarConfig(), pro = false, random = kotlin.random.Random(i))
            assertFalse(AvatarOptions.isProOnly("head", r.head)); assertFalse(AvatarOptions.isProOnly("neck", r.neck))
        }
    }
}
