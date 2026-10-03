package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The fit-check combinations (every body × hat × neck item, plus every face part on every body)
 * render ALL their layers: each layer's art ships in the app's drawable-nodpi, laid out from the
 * app's bundled avatar-parts.json (web avatar-art-coverage.test.ts + iOS AvatarArtCoverageTests
 * check the same against public/art and Assets.xcassets).
 */
class AvatarArtCoverageTest {
    /** Gradle runs unit tests from the module dir (apps/android/core). */
    private val app = File("../app/src/main")
    private val m: AvatarFitManifest by lazy { AvatarFitManifest.parse(File(app, "assets/avatar-parts.json").readText())!! }

    private fun ships(art: String) = File(app, "res/drawable-nodpi/${art.replace('-', '_')}.webp").exists()

    private fun combos(): List<AvatarConfig> {
        val base = defaultAvatar("coverage").copy(pattern = "solid")
        val out = ArrayList<AvatarConfig>()
        for (body in AvatarOptions.BODIES) {
            val b = base.copy(body = body)
            for (head in AvatarOptions.HEADS) for (neck in AvatarOptions.NECKS) out += b.copy(head = head, neck = neck)
            AvatarOptions.EYES.forEach { out += b.copy(eyes = it) }
            AvatarOptions.MOUTHS.forEach { out += b.copy(mouth = it) }
            AvatarOptions.NOSES.forEach { out += b.copy(nose = it) }
            AvatarOptions.CHEEKS.forEach { out += b.copy(cheeks = it) }
            AvatarOptions.FACES.forEach { out += b.copy(face = it) }
        }
        return out
    }

    @Test
    fun every_combination_ships_every_layer() {
        val missing = sortedSetOf<String>()
        val checked = HashSet<String>()
        var layers = 0
        val all = combos()
        assertTrue(all.size > 4800)
        for (c in all) for (small in listOf(false, true)) {
            val l = AvatarFit.layout(c, small, m)
            assertTrue(l.layers.any { it.layer == "body" })
            for (layer in l.layers) {
                layers++
                if (checked.add(layer.art) && !ships(layer.art)) missing += layer.art
            }
        }
        assertTrue(layers > 20000)
        assertEquals(emptyList<String>(), missing.toList())
    }

    @Test
    fun unknown_ids_fall_back_to_shipped_art() {
        val raw = Json.parseToJsonElement(
            """{"v":1,"body":"blobfish","color":"plasma","pattern":"tartan","patternColor":"plasma","eyes":"laser","nose":"freckles",
               "mouth":"fangs","head":"jetpack","face":"visor","neck":"tail","frame":"none","accColor":"chrome"}""",
        ).jsonObject
        val c = validateAvatar(raw)
        assertEquals("freckles", c.cheeks)
        assertEquals("none", c.nose)
        assertTrue(AvatarOptions.SWATCHES.any { it.id == c.color })
        for (small in listOf(false, true)) for (layer in AvatarFit.layout(c, small, m).layers) assertTrue(layer.art, ships(layer.art))
    }
}
