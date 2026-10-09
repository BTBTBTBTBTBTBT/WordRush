package com.wordocious.core

import java.time.LocalDate

// Seasonal mascot-maker items — 1:1 port of packages/core/src/avatar-season.ts (pinned by
// fixtures/avatar-season-fixtures.json, AvatarSeasonFixtureTest). A part is seasonal when its avatar-parts.json item
// carries `season`. Rules (10-05): free while the season is on (its window or the admin Season preview); a SAVED
// seasonal part stays (never strip a look); out of season unsaved ones hide; Randomize never picks them; one Home
// nudge per season per year for players not already wearing one.

data class AvatarPart(val field: String, val id: String)

object AvatarSeason {
    /** The maker fields that can hold a seasonal part, in shelf order (hats first, the buddy last). */
    val FIELDS: List<String> = listOf("body", "head", "neck", "wrap", "held", "face", "feet", "pet", "extra")

    private fun options(field: String): List<String> = when (field) {
        "body" -> AvatarOptions.BODIES
        "head" -> AvatarOptions.HEADS
        "neck" -> AvatarOptions.NECKS
        "face" -> AvatarOptions.FACES
        else -> AvatarOptions.INTEGRATED.firstOrNull { it.first == field }?.second ?: emptyList()
    }

    /** A 2.8 pack item's explicit access in the manifest: true = Pro, false = free, null = today's lists decide. */
    fun partManifestPro(field: String, id: String, m: AvatarFitManifest): Boolean? {
        if (id.isEmpty() || id == "none" || field == "body" || field !in AvatarFit.PART_FIELDS) return null
        return m.items[AvatarFit.itemKey(field, id)]?.pro
    }

    /** The season a part belongs to, or null for an everyday part. */
    fun partSeason(field: String, id: String, m: AvatarFitManifest): String? {
        if (id.isEmpty() || id == "none") return null
        if (field == "body") return m.bodies[id]?.season
        return m.items[AvatarFit.itemKey(field, id)]?.season
    }

    /** The season the maker dresses for: the preview ("none" = forced off), else the calendar's ("yyyy-MM-dd"). */
    fun active(day: String, preview: String?): String? {
        if (preview == "none") return null
        if (!preview.isNullOrEmpty()) return preview
        return currentSeason(day)
    }

    /** May the maker show (and Randomize pick) this part? `saved` = the saved config's field -> id. */
    fun isPartAvailable(part: AvatarPart, day: String, preview: String?, saved: Map<String, String>?, m: AvatarFitManifest): Boolean {
        val season = partSeason(part.field, part.id, m) ?: return true
        if (saved != null && saved[part.field] == part.id) return true
        return active(day, preview) == season
    }

    fun isPartAvailable(part: AvatarPart, day: String, preview: String?, saved: AvatarConfig?, m: AvatarFitManifest): Boolean =
        isPartAvailable(part, day, preview, saved?.let { worn(it) }, m)

    /** The season's shelf: every part of `season`, hats first, each field in its catalog order. */
    fun shelf(season: String?, m: AvatarFitManifest): List<AvatarPart> {
        if (season == null) return emptyList()
        return FIELDS.flatMap { f -> options(f).filter { partSeason(f, it, m) == season }.map { AvatarPart(f, it) } }
    }

    /** Does the config (field -> id) wear any seasonal part (of `season`, or any season when null)? */
    fun wearsSeasonalPart(config: Map<String, String>?, season: String?, m: AvatarFitManifest): Boolean {
        if (config == null) return false
        return FIELDS.any { f -> config[f]?.let { partSeason(f, it, m) }?.let { season == null || it == season } == true }
    }

    /** The nudge's "seen" key: one per season per year. */
    fun nudgeKey(season: String, day: String): String = "$season-${day.take(4)}"

    /** The one-time Home nudge's season, or null. */
    fun nudgeDue(day: String, preview: String?, config: Map<String, String>?, seen: List<String>, m: AvatarFitManifest): String? {
        val season = active(day, preview) ?: return null
        if (shelf(season, m).isEmpty()) return null
        if (nudgeKey(season, day) in seen) return null
        if (wearsSeasonalPart(config, season, m)) return null
        return season
    }

    /** The small tag on a seasonal tile (HALLOWEEN, WINTER HOLIDAYS). */
    fun tag(season: String): String = season.replace('-', ' ').uppercase()

    /** A config's part fields as field -> id. */
    fun worn(c: AvatarConfig): Map<String, String> = FIELDS.associateWith { AvatarFit.value(c, it) }

    /** Today as a local "yyyy-MM-dd". */
    fun today(): String = LocalDate.now().toString()
}
