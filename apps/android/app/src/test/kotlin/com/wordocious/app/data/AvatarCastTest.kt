package com.wordocious.app.data

import com.wordocious.core.BotCast
import com.wordocious.core.LevelTier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AH: pick-a-character avatars + level-tier frames (pure logic). */
class AvatarCastTest {
    @Test
    fun cast_ids_are_the_ten_characters_in_wordocious_order() {
        assertEquals(listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"), AvatarCast.IDS)
        // Every id is a BotCast character, so each has a color + a name.
        assertEquals(BotCast.MEMBERS.map { it.castId }.toSet(), AvatarCast.IDS.toSet())
    }

    @Test
    fun cast_id_validation() {
        assertEquals("o2", AvatarCast.normalize(" O2 "))
        assertEquals("w", AvatarCast.normalize("w"))
        assertNull(AvatarCast.normalize(null))
        assertNull(AvatarCast.normalize(""))
        assertNull(AvatarCast.normalize("o"))
        assertNull(AvatarCast.normalize("o4"))
        assertNull(AvatarCast.normalize("webster"))
        assertTrue(AvatarCast.isValid("S"))
        assertFalse(AvatarCast.isValid("x"))
    }

    @Test
    fun cast_color_and_name_come_from_the_bot_cast() {
        assertEquals(0xFF7C3AED, AvatarCast.colorArgb("w"))
        assertEquals(0xFFEC4899, AvatarCast.colorArgb("O2"))
        assertEquals("Webster", AvatarCast.name("w"))
        assertEquals("Ollie", AvatarCast.name("o1"))
        assertNull(AvatarCast.colorArgb("zz"))
        assertNull(AvatarCast.name(null))
    }

    @Test
    fun tier_to_frame_color() {
        assertEquals(0xCD7F32, AvatarFrame.ringRgb("bronze"))
        assertEquals(0xC0C7D2, AvatarFrame.ringRgb("silver"))
        assertEquals(0xF5C542, AvatarFrame.ringRgb("gold"))
        assertEquals(0x9FE3E0, AvatarFrame.ringRgb("platinum"))
        assertEquals(0x8EC5FF, AvatarFrame.ringRgb("DIAMOND"))
        assertNull(AvatarFrame.ringRgb("ruby"))
        assertNull(AvatarFrame.ringRgb(null))
        assertEquals("art_frame_gold", AvatarFrame.artName("gold"))
    }

    @Test
    fun frames_unlock_by_level_tier() {
        assertEquals(listOf(LevelTier.BRONZE), AvatarFrame.unlocked(0))
        assertEquals(listOf(LevelTier.BRONZE), AvatarFrame.unlocked(10))
        assertEquals(listOf(LevelTier.BRONZE, LevelTier.SILVER), AvatarFrame.unlocked(11))
        assertEquals(3, AvatarFrame.unlocked(26).size)
        assertEquals(4, AvatarFrame.unlocked(99).size)
        assertEquals(LevelTier.entries.toList(), AvatarFrame.unlocked(100))
        assertTrue(AvatarFrame.isUnlocked("gold", 26))
        assertFalse(AvatarFrame.isUnlocked("gold", 25))
        assertFalse(AvatarFrame.isUnlocked("ruby", 500))
    }

    @Test
    fun effective_frame_drops_unknown_or_unreached_tiers() {
        assertEquals("silver", AvatarFrame.effective("Silver", 12))
        assertNull(AvatarFrame.effective("diamond", 99))
        assertEquals("diamond", AvatarFrame.effective("diamond", null)) // unknown level: trust the row
        assertNull(AvatarFrame.effective("ruby", 200))
        assertNull(AvatarFrame.effective(null, 200))
    }

    @Test
    fun missing_column_errors_trigger_the_retry() {
        assertTrue(AvatarSave.isMissingAvatarColumn(
            """{"code":"PGRST204","message":"Could not find the 'avatar_cast_id' column of 'profiles' in the schema cache"}""",
        ))
        assertTrue(AvatarSave.isMissingAvatarColumn("""column "avatar_frame" of relation "profiles" does not exist (42703)"""))
        // Other failures surface as before (no silent retry).
        assertFalse(AvatarSave.isMissingAvatarColumn("duplicate key value violates unique constraint (23505)"))
        assertFalse(AvatarSave.isMissingAvatarColumn("Could not find the 'bio' column of 'profiles' in the schema cache"))
        assertFalse(AvatarSave.isMissingAvatarColumn("avatar_cast_id: value too long"))
        assertFalse(AvatarSave.isMissingAvatarColumn(null))
    }

    @Test
    fun save_fallback_keeps_the_choice_locally_only_when_the_server_refused_it() {
        assertEquals(null to null, AvatarSave.localCopyAfterSave(columnsAccepted = true, castId = "w", frame = "gold"))
        assertEquals("w" to "gold", AvatarSave.localCopyAfterSave(columnsAccepted = false, castId = "W", frame = "gold"))
        assertEquals(null to null, AvatarSave.localCopyAfterSave(columnsAccepted = false, castId = "bogus", frame = null))
    }

    @Test
    fun own_choice_prefers_the_row_then_the_local_copy() {
        assertEquals("o1", AvatarSave.resolve("o1", "w"))
        assertEquals("w", AvatarSave.resolve(null, "w"))
        assertEquals("w", AvatarSave.resolve("  ", "w"))
        assertNull(AvatarSave.resolve(null, ""))
        assertNull(AvatarSave.resolve(null, null))
        assertEquals("avatar-cast-id:abc", AvatarSave.castPrefKey("ABC"))
        assertEquals("avatar-frame:abc", AvatarSave.framePrefKey("abc"))
    }
}
