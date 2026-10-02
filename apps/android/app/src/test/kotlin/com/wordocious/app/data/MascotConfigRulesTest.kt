package com.wordocious.app.data

import com.wordocious.core.AvatarConfig
import com.wordocious.core.avatarToJson
import com.wordocious.core.castPreset
import com.wordocious.core.defaultAvatar
import kotlinx.serialization.json.JsonNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AN3: reading avatar_config, the local save fallback, display + frames. */
class MascotConfigRulesTest {
    private val saved = AvatarConfig(body = "bean", color = "teal", head = "tophat", display = "mascot")

    @Test
    fun missing_column_errors_are_recognized() {
        assertTrue(MascotConfigRules.isMissingConfigColumn("PGRST204: Could not find the 'avatar_config' column of 'profiles' in the schema cache"))
        assertTrue(MascotConfigRules.isMissingConfigColumn("ERROR 42703: column \"avatar_config\" does not exist"))
        assertFalse(MascotConfigRules.isMissingConfigColumn("PGRST204: Could not find the 'avatar_cast_id' column"))
        assertFalse(MascotConfigRules.isMissingConfigColumn("timeout talking to avatar_config"))
        assertFalse(MascotConfigRules.isMissingConfigColumn(null))
    }

    @Test
    fun local_copy_round_trips() {
        val text = MascotConfigRules.encodeLocal(saved)
        assertEquals(saved, MascotConfigRules.decodeLocal(text))
        assertNull(MascotConfigRules.decodeLocal(""))
        assertNull(MascotConfigRules.decodeLocal("not json"))
        assertNull(MascotConfigRules.decodeLocal("[1,2]"))
        assertEquals("avatar-config:u1", MascotConfigRules.prefKey("U1"))
    }

    @Test
    fun own_config_prefers_row_then_local_then_cast_preset() {
        val local = MascotConfigRules.encodeLocal(saved.copy(body = "blob"))
        assertEquals(saved, MascotConfigRules.resolveOwn(avatarToJson(saved), local, "w", null))
        assertEquals("blob", MascotConfigRules.resolveOwn(null, local, "w", null)?.body)
        assertEquals("blob", MascotConfigRules.resolveOwn(JsonNull, local, "w", null)?.body)
        assertEquals(castPreset("w").copy(frame = "gold"), MascotConfigRules.resolveOwn(null, "", "w", "gold"))
        assertNull(MascotConfigRules.resolveOwn(null, "", null, "gold"))
        // A config's own frame wins over AH's tier frame.
        assertEquals("diamond", MascotConfigRules.resolveOwn(avatarToJson(saved.copy(frame = "diamond")), null, null, "gold")?.frame)
    }

    @Test
    fun display_config_falls_back_to_preset_then_seeded_default() {
        assertEquals(saved, MascotConfigRules.forDisplay(saved, "w", null, "ann", null))
        assertEquals(castPreset("o2"), MascotConfigRules.forDisplay(null, "o2", null, "ann", null))
        assertEquals(defaultAvatar("ann", "#ec4899"), MascotConfigRules.forDisplay(null, null, null, "ann", "#ec4899"))
        assertEquals("silver", MascotConfigRules.forDisplay(null, null, "silver", "ann", null).frame)
        assertEquals("none", MascotConfigRules.forDisplay(null, null, "nonsense", "ann", null).frame)
    }

    @Test
    fun photo_shows_only_with_url_and_photo_display() {
        assertTrue(MascotConfigRules.showsPhoto("https://x/p.png", null, null))
        assertFalse(MascotConfigRules.showsPhoto("https://x/p.png", null, "w"))
        assertFalse(MascotConfigRules.showsPhoto("https://x/p.png", saved, null))
        assertTrue(MascotConfigRules.showsPhoto("https://x/p.png", saved.copy(display = "photo"), "w"))
        assertFalse(MascotConfigRules.showsPhoto(null, saved.copy(display = "photo"), null))
        assertFalse(MascotConfigRules.showsPhoto(" ", null, null))
        assertEquals("gold", MascotConfigRules.photoFrame(saved.copy(frame = "gold"), "bronze"))
        assertEquals("bronze", MascotConfigRules.photoFrame(saved, "bronze"))
        assertNull(MascotConfigRules.photoFrame(null, null))
    }

    @Test
    fun initial_is_the_first_letter_or_digit() {
        assertEquals("J", MascotConfigRules.initialOf("johnnyauer"))
        assertEquals("B", MascotConfigRules.initialOf("  _bt"))
        assertEquals("7", MascotConfigRules.initialOf("7even"))
        assertEquals("?", MascotConfigRules.initialOf(null))
        assertEquals("?", MascotConfigRules.initialOf("__"))
    }
}
