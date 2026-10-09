package com.wordocious.core

// Change Photo on Edit Profile's Stage (cloud prompt 07, 2026-10-06): players couldn't replace or remove a
// photo once one existed. 1:1 port of packages/core/src/change-photo.ts (iOS: Core/ChangePhoto.swift), so
// all three show the same button, open the same menu and land on the same SHOW choice.
object ChangePhoto {
    enum class Row { CAMERA, LIBRARY, REMOVE }
    enum class Result { UPLOADED, REMOVED }

    data class Pick(val display: String?, val openMenu: Boolean)

    /** "My photo" is what SHOW reads only when the player picked it AND has a photo. */
    fun showsPhoto(display: String?, hasPhoto: Boolean): Boolean = display == "photo" && hasPhoto

    /** The quiet "Change photo" button under SHOW, and the Stage's photo being tappable: only while the photo shows. */
    fun showsChangePhoto(display: String?, hasPhoto: Boolean): Boolean = showsPhoto(display, hasPhoto)

    /**
     * Picking a SHOW option. "My photo" with no photo yet keeps the current look (display null) and opens the
     * Change Photo menu instead; anything else just switches.
     */
    fun pickShow(choice: String, hasPhoto: Boolean): Pick =
        if (choice == "photo" && !hasPhoto) Pick(null, true) else Pick(choice, false)

    /** The menu's rows, in order: Take photo (a camera exists), Choose from library, Remove photo (one is set). */
    fun rows(hasCamera: Boolean, hasPhoto: Boolean): List<Row> = buildList {
        if (hasCamera) add(Row.CAMERA)
        add(Row.LIBRARY)
        if (hasPhoto) add(Row.REMOVE)
    }

    /** SHOW after a menu result: a new photo shows; a removed photo falls back to the mascot. */
    fun displayAfter(result: Result): String = if (result == Result.UPLOADED) "photo" else "mascot"
}
