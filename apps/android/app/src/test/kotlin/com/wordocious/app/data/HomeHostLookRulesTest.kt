package com.wordocious.app.data

import com.wordocious.core.AvatarConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Founder 2.7.1: the Good Morning host draws the player's cached look, never a purple-W flash. */
class HomeHostLookRulesTest {
    private val mine = HomeHostPick.Mascot(AvatarConfig(body = "star", color = "teal", head = "crown", held = "balloon"))
    private val photo = HomeHostPick.Portrait("https://x/storage/v1/object/public/avatars/a.jpg", "gold")
    private val cacheA = CachedHostLook("user-A", "Brian", mine)

    @Test
    fun cached_look_shows_while_loading() {
        // Cold start: the launch-painted row may be stale (W) — the cache wins until the look is known.
        val d = HomeHostLookRules.decide(cacheA, live = HomeHostPick.W, liveUserId = "user-A", liveUsername = "Brian", loaded = false, guest = false)
        assertEquals(mine, d.pick)
        assertTrue(d.fromCache)
        // Before any profile is known at all, the last signed-in player's cache still draws.
        val early = HomeHostLookRules.decide(cacheA, live = null, liveUserId = null, liveUsername = null, loaded = false, guest = false)
        assertEquals(mine, early.pick)
        assertEquals("Brian", early.username)
        // Photo display is cached too: the portrait, never W.
        val p = HomeHostLookRules.decide(CachedHostLook("user-A", "Brian", photo), null, null, null, loaded = false, guest = false)
        assertEquals(photo, p.pick)
    }

    @Test
    fun cache_is_keyed_by_user_and_another_users_entry_is_ignored() {
        assertTrue(HomeHostLookRules.honors(cacheA, "USER-A"))
        assertFalse(HomeHostLookRules.honors(cacheA, "user-B"))
        val d = HomeHostLookRules.decide(cacheA, live = HomeHostPick.W, liveUserId = "user-B", liveUsername = "Doug", loaded = false, guest = false)
        assertEquals(HomeHostPick.W, d.pick)
        assertFalse(d.fromCache)
        // B's own custom look from the painted row still beats W.
        val b = HomeHostLookRules.decide(cacheA, live = photo, liveUserId = "user-B", liveUsername = "Doug", loaded = false, guest = false)
        assertEquals(photo, b.pick)
    }

    @Test
    fun cleared_on_sign_out_so_nothing_is_honored() {
        // Sign-out clears the slot (HomeHostLookCache.clear): a cleared slot decodes to no entry.
        assertNull(HomeHostLookRules.decode(""))
        assertNull(HomeHostLookRules.decode(null))
        val d = HomeHostLookRules.decide(null, live = null, liveUserId = null, liveUsername = null, loaded = false, guest = false)
        assertEquals(HomeHostPick.W, d.pick)
        // Guests never draw a cached look.
        val g = HomeHostLookRules.decide(cacheA, live = null, liveUserId = null, liveUsername = null, loaded = false, guest = true)
        assertEquals(HomeHostPick.W, g.pick)
        assertTrue(g.inviteAllowed)
    }

    @Test
    fun no_bubble_while_the_look_is_unknown() {
        val unknown = HomeHostLookRules.decide(null, live = HomeHostPick.W, liveUserId = "user-A", liveUsername = "Brian", loaded = false, guest = false)
        assertEquals(HomeHostPick.W, unknown.pick)
        assertFalse(unknown.inviteAllowed)
        // Known plain player: today's plain mascot + "Make me yours!" bubble.
        val known = HomeHostLookRules.decide(null, live = HomeHostPick.W, liveUserId = "user-A", liveUsername = "Brian", loaded = true, guest = false)
        assertTrue(known.inviteAllowed)
    }

    @Test
    fun live_look_wins_once_known_and_crossfade_only_on_change() {
        val changed = HomeHostLookRules.decide(cacheA, live = photo, liveUserId = "user-A", liveUsername = "Brian", loaded = true, guest = false)
        assertEquals(photo, changed.pick)
        assertFalse(changed.fromCache)
        // Same look → nothing changes; a different look (another device) → crossfade.
        assertFalse(HomeHostLookRules.crossfades(mine, HomeHostPick.Mascot(mine.config.copy())))
        assertTrue(HomeHostLookRules.crossfades(mine, photo))
        assertTrue(HomeHostLookRules.crossfades(HomeHostPick.W, mine))
        // The first host on screen just appears (no fade from nothing).
        assertFalse(HomeHostLookRules.crossfades(null, mine))
        assertEquals(200, HomeHostLookRules.CROSSFADE_MS)
    }

    @Test
    fun stored_shape_round_trips_so_a_matching_live_look_never_swaps() {
        for (look in listOf(
            cacheA,
            CachedHostLook("user-A", "Brian", HomeHostPick.Mascot(AvatarConfig())),
            CachedHostLook("user-A", null, photo),
            CachedHostLook("user-A", "Brian", HomeHostPick.Portrait("https://x/a.jpg", null)),
            CachedHostLook("user-A", "Brian", HomeHostPick.W),
        )) {
            assertEquals(look, HomeHostLookRules.decode(HomeHostLookRules.encode(look)))
        }
        assertNull(HomeHostLookRules.decode("{not json"))
        assertNull(HomeHostLookRules.decode("""{"v":1,"kind":"mascot"}"""))
        assertFalse(HomeHostLookRules.needsWrite(cacheA, cacheA.copy()))
        assertTrue(HomeHostLookRules.needsWrite(cacheA, cacheA.copy(pick = photo)))
        assertTrue(HomeHostLookRules.needsWrite(null, cacheA))
    }
}
