package com.wordocious.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** Parity with core theme-surfaces.ts: theme-surfaces-fixtures.json over the shipped registry. */
class ThemeSurfacesTest {
    @Serializable private data class Look(val card: String, val ink: String, val inkSecondary: String, val accent: String, val tabBar: String)
    @Serializable private data class Entry(val id: String, val light: Look? = null, val dark: Look)
    @Serializable private data class Registry(val themes: List<Entry>)

    private val json = Json { ignoreUnknownKeys = true }

    @Test fun `derived tokens match the shared fixture for every theme and scheme`() {
        val fixtures = json.parseToJsonElement(
            javaClass.classLoader!!.getResource("fixtures/theme-surfaces-fixtures.json")!!.readText(),
        ).jsonObject
        // The registry lives in the app's assets; module tests run from app/, so read it by path.
        val file = listOf("src/main/assets/theme-registry.json", "app/src/main/assets/theme-registry.json").map { java.io.File(it) }.first { it.exists() }
        val reg = json.decodeFromString<Registry>(file.readText())
        var checked = 0
        for (t in reg.themes) for ((scheme, look) in listOf("light" to t.light, "dark" to t.dark)) {
            look ?: continue
            val want = fixtures["${t.id}:$scheme"] as JsonObject
            fun w(k: String) = (want[k] as JsonPrimitive).content
            val r = ThemeSurfaces.tokens(ThemeSurfaces.Input(look.card, look.ink, look.inkSecondary, look.accent, look.tabBar))
            val label = "${t.id}:$scheme"
            assertEquals(label, w("surface"), r.surface); assertEquals(label, w("surfaceHover"), r.surfaceHover)
            assertEquals(label, w("surfaceAlt"), r.surfaceAlt); assertEquals(label, w("border"), r.border)
            assertEquals(label, w("borderAlt"), r.borderAlt); assertEquals(label, w("borderLight"), r.borderLight)
            assertEquals(label, w("divider"), r.divider); assertEquals(label, w("text"), r.text)
            assertEquals(label, w("textSecondary"), r.textSecondary); assertEquals(label, w("textMuted"), r.textMuted)
            assertEquals(label, w("tabBar"), r.tabBar); assertEquals(label, w("tabEdge"), r.tabEdge)
            checked++
        }
        assertEquals(7, checked)
    }
}
