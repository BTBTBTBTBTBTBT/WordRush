package com.wordocious.app.data

import androidx.compose.runtime.mutableStateMapOf
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarOptions
import com.wordocious.core.AvatarPresets
import com.wordocious.core.isStoredAvatar
import com.wordocious.core.avatarToJson
import com.wordocious.core.defaultAvatar
import com.wordocious.core.validateAvatar
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

// FINISH_SPEC AN3 — the build-your-own-mascot avatar data (profiles.avatar_config
// jsonb null). The column may not exist yet: rows decode it as an optional
// JsonElement (only through `select *` and the /api payloads — never an explicit
// PostgREST column list), and a save the server rejects for an unknown column
// keeps the config locally (SettingsPref) so the player still sees it, exactly
// like AH's avatar_cast_id (AvatarCast.kt). Missing / invalid → the player's
// deterministic default (core defaultAvatar). Pure rules live in [MascotConfigRules]
// (MascotAvatarsTest); the drawing lives in ui/MascotAvatar.kt.

/** Pure, JVM-testable rules for reading / saving avatar_config. */
object MascotConfigRules {
    const val CONFIG_COLUMN = "avatar_config"

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /** SettingsPref key for the local copy (per account). */
    fun prefKey(userId: String): String = "avatar-config:${userId.lowercase()}"

    /** True when a PostgREST / Postgres error says profiles.avatar_config does not exist yet. */
    fun isMissingConfigColumn(message: String?): Boolean {
        val m = message ?: return false
        if (!m.contains(CONFIG_COLUMN)) return false
        return m.contains("PGRST204") || m.contains("42703") ||
            m.contains("schema cache", ignoreCase = true) ||
            m.contains("does not exist", ignoreCase = true) ||
            m.contains("could not find", ignoreCase = true)
    }

    /** The local copy as stored text, or null for "" / malformed / not an object. */
    fun decodeLocal(text: String?, fallback: AvatarConfig = defaultAvatar("")): AvatarConfig? {
        val t = text?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val el = runCatching { json.parseToJsonElement(t) }.getOrNull() ?: return null
        return if (isStoredAvatar(el)) validateAvatar(el, fallback) else null
    }

    fun encodeLocal(config: AvatarConfig): String = avatarToJson(validateAvatar(config)).toString()

    /** An AH tier frame fills a config whose frame is "none". */
    private fun withFrame(c: AvatarConfig, frame: String?): AvatarConfig =
        if (c.frame == "none" && frame != null && frame in AvatarOptions.FRAMES) c.copy(frame = frame) else c

    /**
     * The player's own mascot: the row's avatar_config when it carries one (missing
     * fields → their default), else the local copy kept while the column was missing,
     * else AH's character as its preset (AH's frame fills a "none" frame), else null (= default).
     */
    fun resolveOwn(
        server: JsonElement?, local: String?, castId: String?, frame: String?,
        userId: String? = null, accentHex: String? = null, hasPhoto: Boolean = false,
    ): AvatarConfig? {
        val fb = defaultAvatar(userId?.lowercase(), accentHex, hasPhoto)
        val cfg = (if (isStoredAvatar(server)) validateAvatar(server, fb) else null)
            ?: decodeLocal(local, fb)
            ?: AvatarPresets.forCast(castId)
        return cfg?.let { withFrame(it, frame) }
    }

    /**
     * What any avatar shows for [username]: a recorded config, else a worn AH
     * character's preset, else the deterministic default seeded by the username
     * with the player's [accentHex]; an AH [frame] fills a "none" frame.
     */
    fun forDisplay(
        recorded: AvatarConfig?, castId: String?, frame: String?, username: String?, accentHex: String?,
        hasPhoto: Boolean = false,
    ): AvatarConfig {
        val base = recorded ?: AvatarPresets.forCast(castId) ?: defaultAvatar(username?.lowercase(), accentHex, hasPhoto)
        return withFrame(base, frame)
    }

    /**
     * Whether an avatar shows the PHOTO (coordinator 10-02: the mascot never replaces
     * the photo): only with a photo URL, and when the player's display is "photo" — a
     * recorded config's display, else "mascot" for a worn AH character, else "photo"
     * (the default when the player has a photo).
     */
    fun showsPhoto(photoUrl: String?, recorded: AvatarConfig?, castId: String?): Boolean {
        if (photoUrl.isNullOrBlank()) return false
        val display = recorded?.display ?: if (castId != null) AvatarOptions.DISPLAY_MASCOT else AvatarOptions.DISPLAY_PHOTO
        return display == AvatarOptions.DISPLAY_PHOTO
    }

    /** The frame a photo wears: the config's (when not "none"), else AH's tier frame. */
    fun photoFrame(recorded: AvatarConfig?, ahFrame: String?): String? =
        recorded?.frame?.takeIf { it != "none" } ?: ahFrame

    /** The single body letter: the username's first letter / digit, uppercased ("?" when none). */
    fun initialOf(username: String?): String {
        val s = username?.trim().orEmpty()
        val cp = s.codePoints().toArray().firstOrNull { Character.isLetterOrDigit(it) } ?: return "?"
        return String(Character.toChars(cp)).uppercase()
    }
}

/** The outcome of [MascotAvatars.save] / AvatarSave.saveConfig. */
enum class AvatarSaveResult {
    /** profiles.avatar_config took it. */
    SAVED,
    /** The column doesn't exist yet: kept on this device (still shown everywhere here). */
    SAVED_LOCALLY,
    /** Signed out, offline or any other server error (nothing changed). */
    FAILED,
}

/**
 * Who wears which mascot, by username (lowercased) — so every LetterTileAvatar on
 * any screen draws the player's mascot without each caller threading the field
 * through. Fed by the signed-in profile (+ its local fallback), the friends payload
 * and any other row that carries avatar_config ([recordRaw]). Snapshot state, so
 * avatars recompose when a config arrives.
 */
object MascotAvatars {
    private val byName = mutableStateMapOf<String, AvatarConfig>()
    private var ownKey: String? = null

    private fun key(username: String?): String? = username?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }

    /** The recorded (saved) mascot for [username], or null (→ the default). */
    fun configFor(username: String?): AvatarConfig? {
        val k = key(username) ?: return null
        return byName[k]
    }

    fun record(username: String?, config: AvatarConfig?) {
        val k = key(username) ?: return
        if (config == null) {
            if (byName.containsKey(k)) byName.remove(k)
        } else if (byName[k] != config) {
            byName[k] = config
        }
    }

    // FINISH_SPEC BJ5: the legacy photo-or-mascot helpers answer through THE shared resolver
    // (PlayerAvatars → core resolveAvatar), so older call sites follow the same precedence —
    // an OAuth picture with no saved choice is never shown, and the own look is the local one.

    /** Whether [username]'s avatar shows their photo [photoUrl], else their mascot. */
    fun showPhoto(username: String?, photoUrl: String?): Boolean =
        PlayerAvatars.resolve(AvatarFields(username = username, avatarUrl = photoUrl)).photoUrl != null

    /** True when [username] shows the mascot (the resolver drew no photo for them). */
    fun wearsMascot(username: String?): Boolean =
        PlayerAvatars.resolve(AvatarFields(username = username)).photoUrl == null

    /** The frame [username]'s photo wears (the resolved config's frame), or null. */
    fun photoFrame(username: String?): String? =
        PlayerAvatars.resolve(AvatarFields(username = username)).config.frame.takeIf { it != "none" }

    /** Record a row's raw avatar_config; absent / invalid never clears a known mascot. */
    fun recordRaw(username: String?, raw: JsonElement?) {
        if (!isStoredAvatar(raw)) return
        record(username, validateAvatar(raw, defaultAvatar(username?.lowercase())))
    }

    /** The signed-in player's own mascot (null = their default). */
    fun ownConfig(profile: Profile?): AvatarConfig? {
        val uid = profile?.id ?: return null
        val local = runCatching { SettingsPref.get(MascotConfigRules.prefKey(uid), "") }.getOrNull()
        val look = runCatching { CastAvatars.ownLook(profile) }.getOrNull()
        return MascotConfigRules.resolveOwn(
            profile.avatarConfig, local, look?.castId, look?.frame,
            userId = profile.username, accentHex = profile.accentColor, hasPhoto = !profile.avatarUrl.isNullOrBlank(),
        )
    }

    /** Record the signed-in player's mascot (called with CastAvatars.recordOwn after a profile load). */
    fun recordOwn(profile: Profile?) {
        val name = key(profile?.username)
        ownKey?.let { old -> if (old != name) byName.remove(old) }
        ownKey = name
        if (profile == null) return
        record(profile.username, ownConfig(profile))
    }

    /** Friends rows (FriendsService) carry avatar_config when the API sends it. */
    fun recordFriends(rows: List<FriendsService.FriendProfile>) {
        rows.forEach { recordRaw(it.username, it.avatarConfig) }
    }

    /**
     * Save the signed-in player's mascot: PATCH profiles.avatar_config; when the
     * column doesn't exist yet, keep it locally (SettingsPref) and still show it.
     */
    suspend fun save(config: AvatarConfig): AvatarSaveResult {
        val profile = AuthService.profile.value ?: return AvatarSaveResult.FAILED
        val uid = profile.id
        val clean = validateAvatar(config)
        val r = runCatching {
            SupabaseConfig.client.postgrest["profiles"].update({
                set(MascotConfigRules.CONFIG_COLUMN, avatarToJson(clean))
            }) { filter { eq("id", uid) } }
        }
        val result = when {
            r.isSuccess -> AvatarSaveResult.SAVED
            MascotConfigRules.isMissingConfigColumn(r.exceptionOrNull()?.message) -> AvatarSaveResult.SAVED_LOCALLY
            else -> AvatarSaveResult.FAILED
        }
        when (result) {
            // The row is the truth now (a change on another device wins later).
            AvatarSaveResult.SAVED -> runCatching { SettingsPref.set(MascotConfigRules.prefKey(uid), "") }
            AvatarSaveResult.SAVED_LOCALLY -> runCatching { SettingsPref.set(MascotConfigRules.prefKey(uid), MascotConfigRules.encodeLocal(clean)) }
            AvatarSaveResult.FAILED -> return result
        }
        record(profile.username, clean)
        // BJ5: the edit shows on every avatar (boards, podiums, VS, cached rows) at once.
        runCatching { PlayerAvatars.patchOwn(config = clean) }
        // Founder 2.7.1 (the launch flash): a SAVED row clears the local copy above, so the
        // launch-painted profile row (CACHED_PROFILE_JSON) must be rewritten too, or the next
        // cold start paints the OLD look (the onboarding mascot save never refreshed it).
        if (result == AvatarSaveResult.SAVED) runCatching { AuthService.refreshProfile() }
        return result
    }
}
