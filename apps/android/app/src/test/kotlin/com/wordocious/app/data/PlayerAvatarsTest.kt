package com.wordocious.app.data

import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarSourceKind
import com.wordocious.core.avatarToJson
import com.wordocious.core.castPreset
import com.wordocious.core.podiumLayout
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * FINISH_SPEC BJ5: the Android avatar directory's pure rules — the one precedence via core
 * resolveAvatar, the row + known merge, the own-profile override (by id, else lowercased
 * username; this device's just-saved patch wins), BJ6's host pick — and BJ4 podium-for-N.
 */
class PlayerAvatarsTest {
    private val bucket = "https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg?t=1"
    private val google = "https://lh3.googleusercontent.com/a/letter=s96-c"
    private val star = AvatarConfig(body = "star", color = "mint", display = "mascot")
    private val starPhoto = star.copy(display = "photo")

    @Test
    fun precedence_photo_config_cast_seeded() {
        // 1. custom photo + a saved config showing the photo → the photo.
        val p = AvatarDirectoryRules.resolve(AvatarFields("u1", "BMT", bucket, avatarToJson(starPhoto)), null, null)
        assertEquals(AvatarSourceKind.PHOTO, p.kind); assertEquals(bucket, p.photoUrl)
        // 2. a saved config showing the mascot beats the photo.
        val c = AvatarDirectoryRules.resolve(AvatarFields("u1", "BMT", bucket, avatarToJson(star)), null, null)
        assertEquals(AvatarSourceKind.CONFIG, c.kind); assertNull(c.photoUrl); assertEquals("star", c.config.body)
        // 3. a worn cast hero (no config, no custom photo) → its preset.
        val k = AvatarDirectoryRules.resolve(AvatarFields("u2", "doug", castId = "O2"), null, null)
        assertEquals(AvatarSourceKind.CAST, k.kind); assertEquals(castPreset("o2").color, k.config.color)
        // 4. nothing → the seeded mascot.
        val s = AvatarDirectoryRules.resolve(AvatarFields("u3", "doug"), null, null)
        assertEquals(AvatarSourceKind.SEEDED, s.kind)
    }

    @Test
    fun oauth_picture_without_a_saved_choice_is_never_drawn() {
        val r = AvatarDirectoryRules.resolve(AvatarFields("u9", "Ukrainian Cyclone", google), null, null)
        assertEquals(AvatarSourceKind.SEEDED, r.kind)
        assertNull(r.photoUrl)
    }

    @Test
    fun known_fields_fill_a_name_only_row() {
        val known = AvatarFields("u1", "BMT", bucket, avatarToJson(starPhoto), complete = true)
        // A VS payload carries only the name: the directory supplies the photo + config.
        val r = AvatarDirectoryRules.resolve(AvatarFields(username = "bmt"), known, null)
        assertEquals(AvatarSourceKind.PHOTO, r.kind); assertEquals(bucket, r.photoUrl)
        // The row's own non-blank fields win over what is known.
        val m = AvatarDirectoryRules.merge(AvatarFields("u1", "BMT", castId = "r", frame = "  "), known)
        assertEquals("r", m.castId); assertEquals(bucket, m.avatarUrl); assertTrue(m.complete)
        assertNull(m.frame)
        // An empty JSON object never hides a known config.
        assertEquals(known.config, AvatarDirectoryRules.merge(AvatarFields("u1", config = JsonObject(emptyMap())), known).config)
    }

    @Test
    fun own_avatar_always_comes_from_the_local_profile() {
        val own = AvatarFields("ME-1", "Brian", bucket, avatarToJson(starPhoto))
        // A stale cached board row (old Google picture, no config) for the same id → the local look.
        val r = AvatarDirectoryRules.resolve(AvatarFields("me-1", "Brian", google), null, own)
        assertEquals(AvatarSourceKind.PHOTO, r.kind); assertEquals(bucket, r.photoUrl)
        // Matched by lowercased username when the row has no id (VS payloads).
        val byName = AvatarDirectoryRules.resolve(AvatarFields(username = " brian "), null, own)
        assertEquals(bucket, byName.photoUrl)
        // Someone else is never overridden.
        assertFalse(AvatarDirectoryRules.isOwn("other", "Brian", "me-1", "Brian"))
        assertTrue(AvatarDirectoryRules.isOwn(null, "BRIAN", "me-1", "brian"))
    }

    @Test
    fun own_patch_wins_and_can_clear() {
        val profile = AvatarFields("me", "Brian", bucket, null, "w", "gold")
        // Just saved a mascot shown instead of the photo: the patch shows at once.
        val patched = AvatarDirectoryRules.ownFields(profile, AvatarFields(config = avatarToJson(star)), null)
        assertEquals(AvatarSourceKind.CONFIG, AvatarDirectoryRules.resolve(AvatarFields("me"), null, patched).kind)
        // "" clears: removed photo + no cast → the seeded mascot.
        val cleared = AvatarDirectoryRules.ownFields(profile, AvatarFields(avatarUrl = "", castId = "", frame = ""), null)
        assertNull(cleared.avatarUrl); assertNull(cleared.castId); assertNull(cleared.frame)
        assertEquals(AvatarSourceKind.SEEDED, AvatarDirectoryRules.resolve(AvatarFields("me"), null, cleared).kind)
        // The local copy fills a config the row doesn't carry yet.
        val local = AvatarDirectoryRules.ownFields(profile.copy(avatarUrl = null), null, avatarToJson(star))
        assertEquals("star", AvatarDirectoryRules.resolve(AvatarFields("me"), null, local).config.body)
    }

    @Test
    fun host_pick_photo_mascot_or_w() {
        // Signed out → W.
        assertEquals(HomeHostPick.W, AvatarDirectoryRules.hostPick(null))
        // A Google picture with no saved choice resolves to the seeded mascot → W keeps hosting.
        assertEquals(HomeHostPick.W, AvatarDirectoryRules.hostPick(AvatarFields("me", "Brian", google)))
        // A custom photo (no config) → the photo as a framed portrait, tier frame from the level.
        val photo = AvatarDirectoryRules.hostPick(AvatarFields("me", "Brian", bucket), level = 30)
        assertEquals(HomeHostPick.Portrait(bucket, "gold"), photo)
        // A saved config SHOWING the photo → still the portrait, with the chosen frame.
        val framed = AvatarDirectoryRules.hostPick(AvatarFields("me", "Brian", bucket, avatarToJson(starPhoto.copy(frame = "silver"))), level = 120)
        assertEquals(HomeHostPick.Portrait(bucket, "silver"), framed)
        // A saved config showing the mascot → the full mascot (display mascot), never the photo.
        val m = AvatarDirectoryRules.hostPick(AvatarFields("me", "Brian", bucket, avatarToJson(star)))
        assertTrue(m is HomeHostPick.Mascot)
        assertEquals("star", (m as HomeHostPick.Mascot).config.body); assertEquals("mascot", m.config.display)
        // A worn hero → its preset mascot.
        val c = AvatarDirectoryRules.hostPick(AvatarFields("me", "Brian", castId = "c"))
        assertEquals(castPreset("c").color, (c as HomeHostPick.Mascot).config.color)
    }

    @Test
    fun portrait_frame_fallbacks() {
        assertEquals("diamond", AvatarDirectoryRules.portraitFrame("Diamond", pro = true, level = 3))
        assertEquals("pro", AvatarDirectoryRules.portraitFrame("none", pro = true, level = 3))
        assertEquals("bronze", AvatarDirectoryRules.portraitFrame(null, pro = false, level = 3))
        assertEquals("platinum", AvatarDirectoryRules.portraitFrame("none", pro = false, level = 60))
        // Unknown level (another player) and no chosen frame → unframed.
        assertNull(AvatarDirectoryRules.portraitFrame("none", pro = false, level = null))
        assertNull(AvatarDirectoryRules.portraitFrame("sparkly", pro = false, level = null))
    }

    @Test
    fun podium_for_n_results() {
        assertEquals(0, podiumLayout(emptyList()).filled)
        assertEquals(listOf(2, 3), podiumLayout(listOf(1)).open)
        assertEquals(listOf(3), podiumLayout(listOf(1, 1)).open)
        for (n in 3..60) {
            val l = podiumLayout((1..n).toList())
            assertEquals(3, l.filled); assertTrue(l.open.isEmpty())
        }
    }
}
