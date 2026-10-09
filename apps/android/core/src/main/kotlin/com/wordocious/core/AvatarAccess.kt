package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Mascot item gating (docs/cloud-prompts/11, decisions in docs/design/brand/avatar/UNLOCKS-AND-SHOP.md): who may SAVE
// which part. 1:1 port of packages/core/src/avatar-access.ts (pinned by fixtures/avatar-access-fixtures.json,
// AvatarAccessFixtureTest). Every option has an access rule (assets/avatar-access.json, the PROPOSED table):
//   free · pro (included with Pro) · buy (a direct purchase at a price tier) · earn (a condition on existing Stats /
//   achievements) · season (free in its window, AvatarSeason) · limited (the buy route only opens in the window).
// Try-on rule: ANY part can be previewed on the Stage; only saving checks access (saveCheck / enforce).
// A part the player already SAVED is never stripped (grandfathered), like the seasonal rule.
//
// Everything ships behind AvatarAccessConfig.ITEM_GATING (OFF): with it off, partRule returns today's rules
// (the AvatarOptions.PRO_ONLY lists + the level-earned tier frames + seasons) so nothing changes for anyone.
// No real purchases yet: ownership comes in as a list of owned keys (the server-side owned_items ledger,
// docs/sql/20261010-owned-items.sql — NOT applied).

/** The feature flag (OFF until the founder approves the table and the purchase flow ships). */
object AvatarAccessConfig {
    const val ITEM_GATING: Boolean = false
}

/** One earn condition: an existing achievement, or a stat ("level" | "currentStreak" | "bestStreak" | "bestLoginStreak") at least [min]. */
data class AvatarEarnCondition(
    val label: String,
    val achievement: String? = null,
    val stat: String? = null,
    val min: Double? = null,
)

data class AvatarAccessRule(
    val free: Boolean = false,
    val pro: Boolean = false,
    /** A price tier ("t1" … "t4"), or null. */
    val buy: String? = null,
    val earn: AvatarEarnCondition? = null,
    /** A seasonal part (its season id): free while the season is on. */
    val season: String? = null,
    /** The buy / earn routes only open while [season] is on (out of season: retired until next year). */
    val limited: Boolean = false,
)

/** avatar-access.json: the tier prices + one rule per "<field>:<id>" key (table order kept). */
class AvatarAccessTable(val version: Int, val tiers: Map<String, Double>, val parts: Map<String, AvatarAccessRule>) {
    companion object {
        /** Parse the bundled table (null when it doesn't parse). */
        fun parse(text: String?): AvatarAccessTable? = runCatching {
            of(Json.parseToJsonElement(text ?: return null) as JsonObject)
        }.getOrNull()

        fun of(root: JsonObject): AvatarAccessTable {
            fun JsonObject.str(k: String) = (this[k] as? JsonPrimitive)?.takeIf { it.isString }?.content
            fun JsonObject.bool(k: String) = (this[k] as? JsonPrimitive)?.booleanOrNull ?: false
            val tiers = (root["tiers"] as? JsonObject)?.mapNotNull { (k, v) -> (v as? JsonPrimitive)?.doubleOrNull?.let { k to it } }?.toMap() ?: emptyMap()
            val parts = LinkedHashMap<String, AvatarAccessRule>()
            (root["parts"] as? JsonObject)?.forEach { (key, el) ->
                val o = el as? JsonObject ?: return@forEach
                val earn = (o["earn"] as? JsonObject)?.let { e ->
                    AvatarEarnCondition(e.str("label") ?: "", e.str("achievement"), e.str("stat"), (e["min"] as? JsonPrimitive)?.doubleOrNull)
                }
                parts[key] = AvatarAccessRule(o.bool("free"), o.bool("pro"), o.str("buy"), earn, o.str("season"), o.bool("limited"))
            }
            return AvatarAccessTable((root["version"] as? JsonPrimitive)?.doubleOrNull?.toInt() ?: 0, tiers, parts)
        }
    }
}

/** What the earn evaluator reads: profile stats + the player's unlocked achievement keys. */
data class AvatarEarnStats(
    val level: Double? = null,
    val currentStreak: Double? = null,
    val bestStreak: Double? = null,
    val bestLoginStreak: Double? = null,
    val achievements: List<String>? = null,
) {
    fun stat(name: String): Double? = when (name) {
        "level" -> level
        "currentStreak" -> currentStreak
        "bestStreak" -> bestStreak
        "bestLoginStreak" -> bestLoginStreak
        else -> null
    }
}

data class AvatarEarnProgress(
    val met: Boolean,
    /** Where the player is (a stat value, capped at target; an achievement: 0 or 1). */
    val current: Int,
    val target: Int,
    val label: String,
)

data class AvatarAccessContext(
    val isPro: Boolean,
    /** Owned keys ("<field>:<id>", the owned_items ledger: bought or earned). */
    val owned: List<String> = emptyList(),
    val stats: AvatarEarnStats? = null,
    /** "yyyy-MM-dd" — for seasons. */
    val date: String,
    /** The admin Season preview (AvatarSeason). */
    val previewSeason: String? = null,
    /** The player's SAVED config: a part it wears is never stripped. */
    val saved: AvatarConfig? = null,
    val gating: Boolean = AvatarAccessConfig.ITEM_GATING,
)

/** One way to get a locked part (the locked card lists them earn · pro · buy · season). */
sealed class AvatarAccessRoute {
    abstract val kind: String
    data class Buy(val tier: String, val price: Double) : AvatarAccessRoute() { override val kind = "buy" }
    data object Pro : AvatarAccessRoute() { override val kind = "pro" }
    data class Earn(val progress: AvatarEarnProgress) : AvatarAccessRoute() { override val kind = "earn" }
    data class Season(val season: String) : AvatarAccessRoute() { override val kind = "season" }
}

data class AvatarPartAccess(
    val unlocked: Boolean,
    /** "free" | "pro" | "owned" | "earned" | "season" | "saved" | "locked". */
    val reason: String,
    /** The routes that apply (shown on the locked card; also present when unlocked, for the item's info). */
    val routes: List<AvatarAccessRoute>,
    val rule: AvatarAccessRule,
)

data class AvatarSaveCheck(
    val ok: Boolean,
    /** The worn parts the player can't save yet (try-on only), in maker order. */
    val locked: List<AvatarPart>,
)

object AvatarAccess {
    /** The fields gating covers, in the maker's order (patternColor / accColor share the color keys). */
    val FIELDS: List<String> = listOf(
        "body", "color", "pattern", "patternColor", "eyes", "brows", "nose", "cheeks", "mouth", "extra",
        "head", "face", "neck", "held", "wrap", "feet", "pet", "accColor", "frame", "bg", "pose",
    )

    private val COLOR_FIELDS = setOf("color", "patternColor", "accColor")

    /** The level a tier frame is earned at (today's rule: FRAME_UNLOCK_LEVEL on every platform). */
    val FRAME_LEVEL: Map<String, Int> = linkedMapOf("bronze" to 1, "silver" to 11, "gold" to 26, "platinum" to 51)

    /** What a locked part falls back to when saving anyway: the saved config's value, else the field's free default. */
    private val FALLBACK: Map<String, String> = mapOf(
        "body" to "classic", "color" to "purple", "pattern" to "solid", "patternColor" to "purple", "accColor" to "default", "bg" to "auto", "frame" to "none",
    )

    /** The table key of a part: "<field>:<id>"; the three color fields share "color:<id>". */
    fun key(field: String, id: String): String = "${if (field == "patternColor" || field == "accColor") "color" else field}:$id"

    /** Ids that are always free (the empty choice of every field). */
    fun alwaysFree(field: String, id: String?): Boolean {
        if (id.isNullOrEmpty() || id == "none") return true
        if (field == "pattern" && id == "solid") return true
        if (field == "bg" && id == "auto") return true
        if (field == "accColor" && id == "default") return true
        return false
    }

    /** The season of a part (only the part fields hold seasonal items; TS keys other fields "undefined:<id>"). */
    private fun partSeason(field: String, id: String, m: AvatarFitManifest): String? =
        if (field in AvatarFit.PART_FIELDS || field == "body") AvatarSeason.partSeason(field, id, m) else null

    /** Today's rules (gating OFF): Pro-only lists, level frames, seasons; everything else free. */
    fun legacyRule(field: String, id: String, m: AvatarFitManifest): AvatarAccessRule {
        if (alwaysFree(field, id)) return AvatarAccessRule(free = true)
        // Seasonal parts never disappear (founder 10-07): free in their season, Pro the rest of the year.
        partSeason(field, id, m)?.let { return AvatarAccessRule(pro = true, season = it) }
        if (field == "frame") FRAME_LEVEL[id]?.let { n -> return AvatarAccessRule(earn = AvatarEarnCondition("Reach level $n", stat = "level", min = n.toDouble())) }
        val k = if (field == "patternColor" || field == "accColor") "color" else field
        return if (AvatarOptions.PRO_ONLY[k]?.contains(id) == true) AvatarAccessRule(pro = true) else AvatarAccessRule(free = true)
    }

    /**
     * A part's rule. Gating on: the table's (a part missing from the table is free — never lock what nobody priced);
     * the manifest's `season` always wins the season field. Gating off: today's rules (legacyRule).
     */
    fun partRule(field: String, id: String, table: AvatarAccessTable, m: AvatarFitManifest, gating: Boolean = AvatarAccessConfig.ITEM_GATING): AvatarAccessRule {
        if (!gating) return legacyRule(field, id, m)
        if (alwaysFree(field, id)) return AvatarAccessRule(free = true)
        val rule = table.parts[key(field, id)] ?: AvatarAccessRule(free = true)
        val season = partSeason(field, id, m)
        return if (season != null) rule.copy(season = season) else rule
    }

    // ── The earn evaluator ──────────────────────────────────────────────────────────────────────────────

    /** Evaluate one earn condition against the player's stats + achievements. Pure. */
    fun evaluateEarn(cond: AvatarEarnCondition, stats: AvatarEarnStats?): AvatarEarnProgress {
        val s = stats ?: AvatarEarnStats()
        if (!cond.achievement.isNullOrEmpty()) {
            val met = (s.achievements ?: emptyList()).contains(cond.achievement)
            return AvatarEarnProgress(met, if (met) 1 else 0, 1, cond.label)
        }
        if (!cond.stat.isNullOrEmpty()) {
            val target = max(1.0, floor(cond.min ?: 1.0)).toInt()
            val raw = s.stat(cond.stat) ?: 0.0
            val value = if (raw.isFinite()) max(0.0, floor(raw)).toInt() else 0
            return AvatarEarnProgress(value >= target, min(value, target), target, cond.label)
        }
        return AvatarEarnProgress(false, 0, 1, cond.label)
    }

    /**
     * The parts a player's stats have earned (what the server writes to owned_items with source 'earn').
     * Every table key whose earn condition is met, in table order.
     */
    fun earnedKeys(stats: AvatarEarnStats?, table: AvatarAccessTable): List<String> =
        table.parts.filter { (_, r) -> r.earn != null && evaluateEarn(r.earn, stats).met }.map { it.key }

    // ── Access ──────────────────────────────────────────────────────────────────────────────────────────

    /** The config field a part lives in ("none" for an empty / unknown field). */
    fun value(c: AvatarConfig, field: String): String = when (field) {
        "body" -> c.body; "color" -> c.color; "pattern" -> c.pattern; "patternColor" -> c.patternColor
        "accColor" -> c.accColor; "frame" -> c.frame; "bg" -> c.bg; "pose" -> c.pose
        else -> AvatarFit.value(c, field)
    }

    /** The config with [field] set to [id] (the gated fields only). */
    fun setting(c: AvatarConfig, field: String, id: String): AvatarConfig = when (field) {
        "body" -> c.copy(body = id); "color" -> c.copy(color = id); "pattern" -> c.copy(pattern = id); "patternColor" -> c.copy(patternColor = id)
        "accColor" -> c.copy(accColor = id); "frame" -> c.copy(frame = id); "bg" -> c.copy(bg = id); "pose" -> c.copy(pose = id)
        else -> AvatarFit.setting(c, field, id)
    }

    /** Does the saved config wear this part (in this field — or, for a color, as any of the three color fields)? */
    private fun savedWears(saved: AvatarConfig?, field: String, id: String): Boolean {
        if (saved == null) return false
        if (field in COLOR_FIELDS) return COLOR_FIELDS.any { value(saved, it) == id }
        return value(saved, field) == id
    }

    /** May this player save this part, and if not, how can they get it? Pure. */
    fun partAccess(part: AvatarPart, ctx: AvatarAccessContext, table: AvatarAccessTable, m: AvatarFitManifest): AvatarPartAccess {
        val rule = partRule(part.field, part.id, table, m, ctx.gating)
        val inSeason = rule.season != null && AvatarSeason.active(ctx.date, ctx.previewSeason) == rule.season
        val routes = mutableListOf<AvatarAccessRoute>()
        if (rule.season != null) routes.add(AvatarAccessRoute.Season(rule.season))
        val routesOpen = !rule.limited || inSeason
        if (rule.buy != null && routesOpen) routes.add(AvatarAccessRoute.Buy(rule.buy, table.tiers[rule.buy] ?: 0.0))
        if (rule.pro) routes.add(AvatarAccessRoute.Pro)
        val earn = if (rule.earn != null && routesOpen) evaluateEarn(rule.earn, ctx.stats) else null
        if (earn != null) routes.add(AvatarAccessRoute.Earn(earn))
        fun done(reason: String) = AvatarPartAccess(reason != "locked", reason, routes, rule)

        if (rule.free) return done("free")
        if (inSeason) return done("season")
        if (rule.pro && ctx.isPro) return done("pro")
        if (key(part.field, part.id) in ctx.owned) return done("owned")
        if (earn?.met == true) return done("earned")
        if (savedWears(ctx.saved, part.field, part.id)) return done("saved")
        return done("locked")
    }

    /** The parts a config wears that gating covers (skipping the empty choices and an unused pattern color). */
    fun wornParts(c: AvatarConfig): List<AvatarPart> = FIELDS.mapNotNull { field ->
        val id = value(c, field)
        if (alwaysFree(field, id)) null
        else if (field == "patternColor" && c.pattern == "solid") null
        else AvatarPart(field, id)
    }

    /** The try-on rule: anything previews; saving needs every worn part unlocked. */
    fun saveCheck(draft: AvatarConfig, ctx: AvatarAccessContext, table: AvatarAccessTable, m: AvatarFitManifest): AvatarSaveCheck {
        val locked = wornParts(draft).filter { !partAccess(it, ctx, table, m).unlocked }
        return AvatarSaveCheck(locked.isEmpty(), locked)
    }

    /**
     * Strip the locked parts (save-time enforcement, like enforceAvatarPro): each locked part reverts to the SAVED
     * config's value when that one is unlocked, else to the field's free default ("none" for parts). Integrated parts
     * and the pose revert by deletion (a missing field = "none" here).
     */
    fun enforce(draft: AvatarConfig, ctx: AvatarAccessContext, table: AvatarAccessTable, m: AvatarFitManifest): AvatarConfig {
        val locked = saveCheck(draft, ctx, table, m).locked
        if (locked.isEmpty()) return draft
        var out = draft
        for (p in locked) {
            val prior = ctx.saved?.let { value(it, p.field) }
            val priorOk = !prior.isNullOrEmpty() && prior != p.id &&
                (alwaysFree(p.field, prior) || partAccess(AvatarPart(p.field, prior), ctx, table, m).unlocked)
            val next = if (priorOk) prior!! else FALLBACK[p.field] ?: "none"
            // TS deletes integrated parts + the pose when they'd be "none"; here a missing field IS "none" (avatarToJson omits it)
            out = setting(out, p.field, next)
        }
        return out
    }

    /**
     * The gating-OFF save path for seasonal parts: free in season, Pro (or owned, or already on the SAVED look) the rest of
     * the year. Reverts only seasonal parts a free player can't keep. Mirrors enforceSeasonalAccess in avatar-access.ts.
     */
    fun enforceSeasonal(draft: AvatarConfig, ctx: AvatarAccessContext, table: AvatarAccessTable, m: AvatarFitManifest): AvatarConfig {
        val legacy = ctx.copy(gating = false)
        val locked = wornParts(draft).filter { partSeason(it.field, it.id, m) != null && !partAccess(it, legacy, table, m).unlocked }
        if (locked.isEmpty()) return draft
        var out = draft
        for (p in locked) {
            val prior = ctx.saved?.let { value(it, p.field) }
            val priorOk = !prior.isNullOrEmpty() && prior != p.id &&
                (alwaysFree(p.field, prior) || partAccess(AvatarPart(p.field, prior), legacy, table, m).unlocked)
            val next = if (priorOk) prior!! else FALLBACK[p.field] ?: "none"
            out = setting(out, p.field, next)
        }
        return out
    }

    /**
     * Owned items save without Pro. enforceAvatarPro (the gating-OFF save path) strips every Pro-only part for a free player;
     * this puts back the ones the player OWNS (an admin grant, an earn, a purchase). Mirrors keepOwnedParts (web).
     */
    fun keepOwned(original: AvatarConfig, enforced: AvatarConfig, owned: List<String>): AvatarConfig {
        if (owned.isEmpty()) return enforced
        var out = enforced
        for (field in FIELDS) {
            val id = value(original, field)
            if (id.isEmpty() || value(enforced, field) == id) continue
            if (key(field, id) in owned) out = setting(out, field, id)
        }
        return out
    }

    // ── The locked card ─────────────────────────────────────────────────────────────────────────────────

    /** A price for display ("$1.99"). */
    fun priceLabel(price: Double): String = "$" + String.format(Locale.US, "%.2f", price)

    /** "halloween" → "Halloween", "winter-holidays" → "Winter Holidays". */
    private fun seasonLabel(season: String): String = season.split("-").joinToString(" ") { it.take(1).uppercase() + it.drop(1) }

    /** One line of the locked card per route ("Buy $1.99" · "Included with Pro" · "Earn: … (12 / 30)" · "Free during Halloween"). */
    fun routeLine(route: AvatarAccessRoute): String = when (route) {
        is AvatarAccessRoute.Buy -> "Buy ${priceLabel(route.price)}"
        AvatarAccessRoute.Pro -> "Included with Pro"
        is AvatarAccessRoute.Earn -> route.progress.let { p -> if (p.target > 1) "Earn: ${p.label} (${p.current} / ${p.target})" else "Earn: ${p.label}" }
        is AvatarAccessRoute.Season -> "Free during ${seasonLabel(route.season)}"
    }

    private val ROUTE_ORDER = mapOf("earn" to 0, "pro" to 1, "buy" to 2, "season" to 3)

    /** The locked card's routes, in order: earn first (play beats pay), then Pro, then buy; season info last. */
    fun sortedRoutes(access: AvatarPartAccess): List<AvatarAccessRoute> = access.routes.sortedBy { ROUTE_ORDER[it.kind] ?: 9 }

    /** The locked card's lines, in [sortedRoutes] order. */
    fun lockedCardLines(access: AvatarPartAccess): List<String> = sortedRoutes(access).map { routeLine(it) }
}
