package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Cloud prompt 07: the Change Photo rules (mirrors packages/core/src/change-photo.test.ts). */
class ChangePhotoTest {
    @Test
    fun show_reads_photo_only_when_picked_and_present() {
        assertTrue(ChangePhoto.showsPhoto("photo", true))
        assertFalse(ChangePhoto.showsPhoto("photo", false))
        assertFalse(ChangePhoto.showsPhoto("mascot", true))
        assertFalse(ChangePhoto.showsPhoto(null, true))
    }

    @Test
    fun button_shows_only_while_photo_shows() {
        assertTrue(ChangePhoto.showsChangePhoto("photo", true))
        assertFalse(ChangePhoto.showsChangePhoto("photo", false))
        assertFalse(ChangePhoto.showsChangePhoto("mascot", true))
        assertFalse(ChangePhoto.showsChangePhoto("mascot", false))
    }

    @Test
    fun my_photo_without_photo_opens_menu() {
        assertEquals(ChangePhoto.Pick(null, true), ChangePhoto.pickShow("photo", false))
        assertEquals(ChangePhoto.Pick("photo", false), ChangePhoto.pickShow("photo", true))
        assertEquals(ChangePhoto.Pick("mascot", false), ChangePhoto.pickShow("mascot", false))
    }

    @Test
    fun menu_rows() {
        assertEquals(listOf(ChangePhoto.Row.CAMERA, ChangePhoto.Row.LIBRARY, ChangePhoto.Row.REMOVE), ChangePhoto.rows(hasCamera = true, hasPhoto = true))
        assertEquals(listOf(ChangePhoto.Row.CAMERA, ChangePhoto.Row.LIBRARY), ChangePhoto.rows(hasCamera = true, hasPhoto = false))
        assertEquals(listOf(ChangePhoto.Row.LIBRARY, ChangePhoto.Row.REMOVE), ChangePhoto.rows(hasCamera = false, hasPhoto = true))
        assertEquals(listOf(ChangePhoto.Row.LIBRARY), ChangePhoto.rows(hasCamera = false, hasPhoto = false))
    }

    @Test
    fun remove_falls_back_to_mascot() {
        assertEquals("photo", ChangePhoto.displayAfter(ChangePhoto.Result.UPLOADED))
        assertEquals("mascot", ChangePhoto.displayAfter(ChangePhoto.Result.REMOVED))
    }
}
