package com.wordocious.app.ui

import android.content.Context
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * The season registry on Android (docs/design/brand/seasons/README.md "How to add a season").
 * assets/season-registry.json (the copy of packages/core/src/season-registry.json; the web test
 * checks the copies match) says, per season, which shipped art replaces which normal art — the
 * cast, a title per game / screen, the walls, the props pair, the Home banner, extras — and a
 * palette (button tints, wall fallback stops). Which season is active is [rememberSeason] (the
 * admin preview first, else core currentSeason on the local date). Art names are the web /
 * iOS names (dashes); drawables are the same with underscores, looked up by name
 * (res/raw/keep_season.xml keeps them through shrinking). A missing slot or drawable falls back
 * to the normal art, so a partial season never leaves a hole.
 */
object SeasonKit {
    data class Palette(val accent: Color, val buttonTint: Color, val quietTint: Color, val wallLight: List<Color>, val wallDark: List<Color>)

    data class Entry(
        val id: String,
        val title: String,
        val palette: Palette,
        val cast: String?,
        val castSize: Int,
        val castTrim: Map<String, List<Int>>,
        val titles: Map<String, String>,
        val walls: Map<String, String>,
        val props: List<String>,
        val banner: String?,
        val surfaces: com.wordocious.app.ui.theme.SeasonSurfaces? = null,
        val surfaceVariants: Map<String, com.wordocious.app.ui.theme.SeasonSurfaces> = emptyMap(),
    )

    @Volatile private var loaded: List<Entry>? = null

    /** Every registry season (file order = calendar order); empty if the asset can't be read. */
    fun registry(context: Context): List<Entry> = loaded ?: synchronized(this) {
        loaded ?: runCatching { parse(context.assets.open("season-registry.json").bufferedReader().use { it.readText() }) }
            .getOrDefault(emptyList()).also { loaded = it }
    }

    /** Pure parser (kotlinx.serialization; unit tested against the shared file). */
    fun parse(json: String): List<Entry> {
        val seasons = Json.parseToJsonElement(json).jsonObject["seasons"]!!.jsonArray
        return seasons.map { el ->
            val s = el.jsonObject
            val p = s["palette"]!!.jsonObject
            val slots = s["slots"]!!.jsonObject
            fun str(o: JsonObject, k: String) = o[k]?.jsonPrimitive?.contentOrNull
            fun color(v: String) = Color(0xFF000000 or v.removePrefix("#").toLong(16))
            fun colors(k: String) = p[k]!!.jsonArray.map { color(it.jsonPrimitive.content) }
            fun map(k: String): Map<String, String> = (slots[k] as? JsonObject)?.mapValues { it.value.jsonPrimitive.content } ?: emptyMap()
            Entry(
                id = str(s, "id")!!,
                title = str(s, "title")!!,
                palette = Palette(color(str(p, "accent")!!), color(str(p, "buttonTint")!!), color(str(p, "quietTint")!!), colors("wallLight"), colors("wallDark")),
                cast = str(slots, "cast"),
                castSize = slots["castSize"]?.jsonPrimitive?.intOrNull ?: 320,
                castTrim = (slots["castTrim"] as? JsonObject)?.mapValues { e -> e.value.jsonArray.map { it.jsonPrimitive.int } } ?: emptyMap(),
                titles = map("titles"),
                walls = map("walls"),
                props = (slots["props"] as? JsonArray)?.map { it.jsonPrimitive.content } ?: emptyList(),
                banner = str(slots, "banner"),
                surfaces = (s["surfaces"] as? JsonObject)?.let(::parseSurfaces),
                surfaceVariants = (s["surfaceVariants"] as? JsonObject)?.mapValues { parseSurfaces(it.value.jsonObject) } ?: emptyMap(),
            )
        }
    }

    /** A registry `surfaces` block (every slot optional). */
    fun parseSurfaces(o: JsonObject): com.wordocious.app.ui.theme.SeasonSurfaces {
        fun c(k: String) = o[k]?.jsonPrimitive?.contentOrNull?.let { Color(0xFF000000 or it.removePrefix("#").toLong(16)) }
        fun f(k: String) = o[k]?.jsonPrimitive?.contentOrNull?.toFloatOrNull()
        fun cs(k: String) = (o[k] as? JsonArray)?.map { Color(0xFF000000 or it.jsonPrimitive.content.removePrefix("#").toLong(16)) }
        return com.wordocious.app.ui.theme.SeasonSurfaces(
            dark = o["tone"]?.jsonPrimitive?.contentOrNull == "dark",
            card = c("card"), cardOpacity = f("cardOpacity") ?: 1f,
            hero = c("hero"), heroOpacity = f("heroOpacity") ?: 1f,
            raised = c("raised"), cap = cs("cap")?.takeIf { it.size == 3 }, capTint = f("capTint") ?: 0f,
            glow = c("glow"), text = c("text"), textMuted = c("textMuted"), textSecondary = c("textSecondary"),
            headline = cs("headline")?.takeIf { it.size == 5 }, bannerGlow = c("bannerGlow"), cobweb = c("cobweb"),
        )
    }

    /** Admin surfaces preview key (same as iOS): absent = the registry's `surfaces`, a `surfaceVariants` id, or "off". */
    const val SURFACES_KEY = "debug-season-surfaces"

    /** The season's windows for [season] and a preview [choice] (pure). */
    fun surfacesFor(context: Context, season: String?, choice: String?): com.wordocious.app.ui.theme.SeasonSurfaces? {
        val e = entry(context, season) ?: return null
        if (choice == "off") return null
        return choice?.takeIf { it.isNotBlank() }?.let { e.surfaceVariants[it] } ?: e.surfaces
    }

    /** Hands the active season's windows to the theme (WTheme.season + its palette). */
    fun applySurfaces(context: Context) {
        val choice = runCatching { com.wordocious.app.data.SettingsPref.get(SURFACES_KEY, "") }.getOrDefault("")
        val look = surfacesFor(context, SeasonSkins.current(), choice)
        val base = com.wordocious.app.ui.theme.Palettes.byKey(com.wordocious.app.data.ThemePref.current())
        com.wordocious.app.ui.theme.WTheme.season = look
        com.wordocious.app.ui.theme.WTheme.palette = look?.palette(
            if (look.dark) com.wordocious.app.ui.theme.Palettes.Dark else com.wordocious.app.ui.theme.Palettes.Light,
        ) ?: base
    }

    fun entry(context: Context, id: String?): Entry? = id?.let { k -> registry(context).firstOrNull { it.id == k } }

    /** A slot map lookup: the exact name first, then the longest `prefix*` key. */
    fun lookup(map: Map<String, String>, name: String): String? =
        map[name] ?: map.entries.filter { it.key.endsWith("*") && name.startsWith(it.key.dropLast(1)) }.maxByOrNull { it.key.length }?.value

    /** The drawable id for an art name ("art-title-halloween-six" → R.drawable.art_title_halloween_six), 0 = not shipped. */
    fun drawable(context: Context, name: String): Int =
        context.resources.getIdentifier(name.replace('-', '_'), "drawable", context.packageName)

    /** The art name (dashes) of a drawable id, or null. */
    fun nameOf(context: Context, @DrawableRes res: Int): String? =
        runCatching { context.resources.getResourceEntryName(res).replace('_', '-') }.getOrNull()

    /** The season's title drawable that replaces [res] (an art_titlecast_* / art_game_*), else [res]. */
    @DrawableRes
    fun title(context: Context, @DrawableRes res: Int, season: String?): Int {
        val e = entry(context, season) ?: return res
        val swap = nameOf(context, res)?.let { lookup(e.titles, it) } ?: return res
        return drawable(context, swap).takeIf { it != 0 } ?: res
    }

    /** The season's wallpaper for [res] (light mode prefers the `-light` twin); null = keep the normal one. */
    @DrawableRes
    fun wall(context: Context, @DrawableRes res: Int, season: String?, dark: Boolean): Int? {
        val e = entry(context, season) ?: return null
        val swap = nameOf(context, res)?.let { lookup(e.walls, it) } ?: return null
        if (!dark) drawable(context, "$swap-light").takeIf { it != 0 }?.let { return it }
        return drawable(context, swap).takeIf { it != 0 }
    }

    /** The season's props (shipped drawables only), in registry order. */
    fun props(context: Context, season: String?): List<Int> =
        entry(context, season)?.props?.map { drawable(context, it) }?.filter { it != 0 } ?: emptyList()

    /** The season's Home banner drawable, 0 = none. */
    fun banner(context: Context, season: String?): Int = entry(context, season)?.banner?.let { drawable(context, it) } ?: 0
}

/** The season's title drawable for [res] (recomposes when the admin preview flips). */
@Composable
@DrawableRes
fun seasonalTitleRes(@DrawableRes res: Int): Int {
    val season = rememberSeason()
    val context = LocalContext.current
    return remember(res, season) { SeasonKit.title(context, res, season) }
}

/** The active season's palette, null out of season. */
@Composable
fun seasonPalette(): SeasonKit.Palette? {
    val season = rememberSeason()
    val context = LocalContext.current
    return remember(season) { SeasonKit.entry(context, season)?.palette }
}
