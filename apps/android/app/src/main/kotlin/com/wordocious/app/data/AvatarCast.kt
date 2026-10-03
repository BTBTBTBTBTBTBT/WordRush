package com.wordocious.app.data

import androidx.compose.runtime.mutableStateMapOf
import com.wordocious.core.BotCast
import com.wordocious.core.LevelTier

// FINISH_SPEC AH — pick-a-character avatars + level-tier frames.
//
// The player can wear one of the ten WORDOCIOUS characters as their avatar (drawn
// on a tinted circle in that character's own color, BotCast.color) and a ring
// frame for any level tier they have reached (bronze 1–10, silver 11–25, gold
// 26–50, platinum 51–99, diamond 100+; core levelTier). Both are stored on
// profiles (avatar_cast_id text null, avatar_frame text null). The columns may not
// exist yet: rows decode them as optional, and a save the server rejects for an
// unknown column is retried without them while the choice lives on locally
// (SettingsPref) so the player still sees it. Pure logic here is JVM-tested
// (AvatarCastTest); the drawing lives in ui/CastAvatar.kt.

/** The ten characters a player can wear, by their art id (lowercase MascotId name). */
object AvatarCast {
    /** WORDOCIOUS order — the Edit Profile grid order. */
    val IDS: List<String> = listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s")

    /** The stored value as a known character id, or null (blank, unknown or malformed). */
    fun normalize(raw: String?): String? {
        val v = raw?.trim()?.lowercase() ?: return null
        return v.takeIf { it in IDS }
    }

    fun isValid(raw: String?): Boolean = normalize(raw) != null

    /** The character's own color (0xFFRRGGBB, the BotCast table), or null for an unknown id. */
    fun colorArgb(castId: String?): Long? {
        val id = normalize(castId) ?: return null
        return BotCast.MEMBERS.firstOrNull { it.castId == id }?.color
    }

    /** The character's name ("Webster", "Ollie", …) for labels, or null. */
    fun name(castId: String?): String? {
        val id = normalize(castId) ?: return null
        return BotCast.MEMBERS.firstOrNull { it.castId == id }?.name
    }
}

/** The level-tier avatar frames (a ring in the tier color, or `art_frame_<tier>` art). */
object AvatarFrame {
    /** "bronze" … "diamond", lowest first. */
    val KEYS: List<String> = LevelTier.entries.map { it.key }

    fun normalize(raw: String?): String? {
        val v = raw?.trim()?.lowercase() ?: return null
        return v.takeIf { it in KEYS }
    }

    fun tierOf(key: String?): LevelTier? = normalize(key)?.let { k -> LevelTier.entries.first { it.key == k } }

    /** The code-drawn ring color (0xRRGGBB) while the frame art is missing. */
    fun ringRgb(key: String?): Int? = when (tierOf(key)) {
        LevelTier.BRONZE -> 0xCD7F32
        LevelTier.SILVER -> 0xC0C7D2
        LevelTier.GOLD -> 0xF5C542
        LevelTier.PLATINUM -> 0x9FE3E0
        LevelTier.DIAMOND -> 0x8EC5FF
        null -> null
    }

    /** The drawable name the frame art will ship under. */
    fun artName(key: String): String = "art_frame_$key"

    /** Every tier the player at [level] has reached (bronze always). */
    fun unlocked(level: Int): List<LevelTier> = LevelTier.entries.filter { it.minLevel <= level.coerceAtLeast(1) }

    fun isUnlocked(key: String?, level: Int): Boolean {
        val t = tierOf(key) ?: return false
        return t.minLevel <= level.coerceAtLeast(1)
    }

    /**
     * The frame to draw: the stored one when it is a known tier the player has
     * reached ([level] null = unknown level, trust the row), else none.
     */
    fun effective(stored: String?, level: Int?): String? {
        val k = normalize(stored) ?: return null
        return if (level == null || isUnlocked(k, level)) k else null
    }
}

/** The save-with-fallback rules for the two new profile columns. */
object AvatarSave {
    const val CAST_COLUMN = "avatar_cast_id"
    const val FRAME_COLUMN = "avatar_frame"

    /**
     * True when a PostgREST / Postgres error says one of the avatar columns does
     * not exist yet (PGRST204 "Could not find the 'avatar_cast_id' column of
     * 'profiles' in the schema cache", or 42703 "column … does not exist"): the
     * save is then retried without them.
     */
    fun isMissingAvatarColumn(message: String?): Boolean {
        val m = message ?: return false
        val mentions = m.contains(CAST_COLUMN) || m.contains(FRAME_COLUMN)
        if (!mentions) return false
        return m.contains("PGRST204") || m.contains("42703") ||
            m.contains("schema cache", ignoreCase = true) ||
            m.contains("does not exist", ignoreCase = true) ||
            m.contains("could not find", ignoreCase = true)
    }

    /** SettingsPref keys for the local copy (per account). */
    fun castPrefKey(userId: String): String = "avatar-cast-id:${userId.lowercase()}"
    fun framePrefKey(userId: String): String = "avatar-frame:${userId.lowercase()}"

    /**
     * The player's own choice: the server value when the row carries one, else
     * the local copy kept while the column was missing ("" = chose none).
     */
    fun resolve(server: String?, local: String?): String? =
        server?.trim()?.takeIf { it.isNotEmpty() } ?: local?.trim()?.takeIf { it.isNotEmpty() }

    /**
     * What to keep locally after a successful save: nothing ("") when the server
     * took the columns (the row is the truth, so a change on another device wins),
     * else the choice itself so the player keeps seeing it until the columns exist.
     */
    fun localCopyAfterSave(columnsAccepted: Boolean, castId: String?, frame: String?): Pair<String?, String?> =
        if (columnsAccepted) null to null else AvatarCast.normalize(castId) to AvatarFrame.normalize(frame)

    /**
     * FINISH_SPEC AN3: save the signed-in player's build-your-own mascot
     * (profiles.avatar_config). While the column is missing it is kept on this device
     * ([AvatarSaveResult.SAVED_LOCALLY]) and still shown on every avatar here.
     */
    suspend fun saveConfig(config: com.wordocious.core.AvatarConfig): AvatarSaveResult = MascotAvatars.save(config)
}

/** What an avatar wears: a character and / or a frame (both optional). */
data class AvatarLook(val castId: String?, val frame: String?)

/**
 * Who wears what, by username (lowercased) — so every LetterTileAvatar on any
 * screen draws the chosen character without each caller threading the field
 * through. Fed by the signed-in profile (+ its local fallback) and the friends
 * payload. Snapshot state, so avatars recompose when a choice arrives.
 */
object CastAvatars {
    private val byName = mutableStateMapOf<String, AvatarLook>()
    private var ownKey: String? = null
    @Volatile private var friendsHooked = false

    private fun key(username: String?): String? = username?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }

    /** The look for [username], or null when they wear neither. */
    fun lookFor(username: String?): AvatarLook? {
        val k = key(username) ?: return null
        return byName[k]
    }

    fun record(username: String?, castId: String?, frame: String?) {
        val k = key(username) ?: return
        val look = AvatarLook(AvatarCast.normalize(castId), AvatarFrame.normalize(frame))
        if (look.castId == null && look.frame == null) {
            if (byName.containsKey(k)) byName.remove(k)
        } else if (byName[k] != look) {
            byName[k] = look
        }
    }

    /** The signed-in player's look: the row's columns, else the local copy. */
    fun ownLook(profile: Profile?): AvatarLook {
        val uid = profile?.id ?: return AvatarLook(null, null)
        val cast = AvatarSave.resolve(profile.avatarCastId, SettingsPref.get(AvatarSave.castPrefKey(uid), ""))
        val frame = AvatarSave.resolve(profile.avatarFrame, SettingsPref.get(AvatarSave.framePrefKey(uid), ""))
        return AvatarLook(AvatarCast.normalize(cast), AvatarFrame.effective(frame, profile.level))
    }

    /** Record the signed-in player's look (call off the composition, e.g. after a profile load). */
    fun recordOwn(profile: Profile?) {
        hookFriends()
        val name = key(profile?.username)
        ownKey?.let { old -> if (old != name) byName.remove(old) }
        ownKey = name
        if (profile == null) { runCatching { MascotAvatars.recordOwn(null) }; return }
        val look = ownLook(profile)
        record(profile.username, look.castId, look.frame)
        // AN3: the build-your-own mascot (its saved config, else this character's preset).
        runCatching { MascotAvatars.recordOwn(profile) }
    }

    /** Keep the local copy in step with a choice (null = none). */
    fun storeLocal(userId: String, castId: String?, frame: String?) {
        SettingsPref.set(AvatarSave.castPrefKey(userId), AvatarCast.normalize(castId) ?: "")
        SettingsPref.set(AvatarSave.framePrefKey(userId), AvatarFrame.normalize(frame) ?: "")
    }

    private fun hookFriends() {
        if (friendsHooked) return
        friendsHooked = true
        FriendsService.addListener { syncFriends() }
        syncFriends()
    }

    private fun syncFriends() {
        // BJ5: the shared avatar directory learns every friend's look (by id + name).
        runCatching {
            PlayerAvatars.recordAll((FriendsService.friends + FriendsService.incoming + FriendsService.outgoingProfiles).map {
                AvatarFields(it.id, it.username, it.avatarUrl, it.avatarConfig, it.avatarCastId, it.avatarFrame)
            })
        }
        // AN3: friends rows that carry avatar_config.
        runCatching { MascotAvatars.recordFriends(FriendsService.friends + FriendsService.incoming + FriendsService.outgoingProfiles) }
        runCatching {
            (FriendsService.friends + FriendsService.incoming + FriendsService.outgoingProfiles).forEach {
                // Only rows that carry the fields: absent (older API) never clears a known look.
                if (it.avatarCastId != null || it.avatarFrame != null) {
                    record(it.username, it.avatarCastId, AvatarFrame.effective(it.avatarFrame, it.level.takeIf { l -> l > 0 }))
                }
            }
        }
    }
}
