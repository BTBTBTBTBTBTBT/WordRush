package com.wordocious.app.data

import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarSource
import com.wordocious.core.AvatarSourceKind
import com.wordocious.core.ResolvedAvatar
import com.wordocious.core.avatarToJson
import com.wordocious.core.resolveAvatar
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

// FINISH_SPEC BJ5 (founder 10-03: "I updated my profile pic and it isn't populating") —
// ONE avatar resolver on Android, built on core resolveAvatar (custom photo when display =
// "photo" → saved mascot → worn cast hero → seeded mascot; an OAuth picture with no saved
// choice is never drawn). Every avatar site (boards, podiums, Sweep, yesterday's winners,
// Records, Friends, profiles, VS, shares) goes through [PlayerAvatars.resolve] via the
// ui/PlayerAvatar.kt composable.
//
//  • Rows carry what they carry (board queries now select avatar_config / avatar_cast_id /
//    avatar_frame / accent_color); the directory fills the rest from any earlier row or a
//    batched `profiles` lookup by id / username (RPC boards, VS payloads, challenges —
//    name-only sites resolve fully after one round trip).
//  • The signed-in player's own avatar ALWAYS comes from the local profile (+ the local
//    copies kept while a column was missing, + this device's just-saved edits), matched by
//    user id, else lowercased username — cached boards and the optimistic row included, so
//    an edit shows at once with no refetch.
// Pure precedence / merge rules live in [AvatarDirectoryRules] (PlayerAvatarsTest).

/** Everything a row may say about a player's look (any field may be missing). */
data class AvatarFields(
    val userId: String? = null,
    val username: String? = null,
    val avatarUrl: String? = null,
    val config: JsonElement? = null,
    val castId: String? = null,
    val frame: String? = null,
    val accentHex: String? = null,
    /** True when this came from a read that selected every look column (no lookup needed). */
    val complete: Boolean = false,
) {
    fun toSource(): AvatarSource = AvatarSource(
        username = username, avatarUrl = avatarUrl,
        config = config?.takeUnless { it is JsonNull },
        castId = castId, frame = frame, accentHex = accentHex,
    )

    /** True when the row says nothing beyond who it is (+ maybe a picture). */
    val isPartial: Boolean get() = (config == null || config is JsonNull) && castId.isNullOrBlank() && frame.isNullOrBlank()
}

/** Pure, JVM-testable rules (PlayerAvatarsTest). */
object AvatarDirectoryRules {
    fun nameKey(username: String?): String? = username?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }
    fun idKey(userId: String?): String? = userId?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }

    private fun JsonElement?.present(): JsonElement? = this?.takeUnless { it is JsonNull || (it is JsonObject && it.isEmpty()) }

    /** The row's own non-blank fields win; [known] (an earlier row / lookup) fills the gaps. */
    fun merge(row: AvatarFields, known: AvatarFields?): AvatarFields {
        if (known == null) return row
        return AvatarFields(
            userId = row.userId ?: known.userId,
            username = row.username?.takeIf { it.isNotBlank() } ?: known.username,
            avatarUrl = row.avatarUrl?.takeIf { it.isNotBlank() } ?: known.avatarUrl,
            config = row.config.present() ?: known.config,
            castId = row.castId?.takeIf { it.isNotBlank() } ?: known.castId,
            frame = row.frame?.takeIf { it.isNotBlank() } ?: known.frame,
            accentHex = row.accentHex?.takeIf { it.isNotBlank() } ?: known.accentHex,
            complete = row.complete || known.complete,
        )
    }

    /** Whether the row is the signed-in player: by user id, else by lowercased username. */
    fun isOwn(userId: String?, username: String?, ownId: String?, ownUsername: String?): Boolean {
        val id = idKey(userId)
        val own = idKey(ownId)
        if (id != null && own != null) return id == own
        val n = nameKey(username)
        return n != null && n == nameKey(ownUsername)
    }

    /**
     * The signed-in player's own fields: this device's just-saved [patch] first ("" = chose
     * none), then the profile row (its cast / frame already merged with their local copies),
     * then the local avatar_config copy kept while that column was missing.
     */
    fun ownFields(profile: AvatarFields, patch: AvatarFields?, localConfig: JsonElement?): AvatarFields {
        val base = merge(profile, AvatarFields(config = localConfig))
        if (patch == null) return base
        return base.copy(
            avatarUrl = if (patch.avatarUrl != null) patch.avatarUrl.ifBlank { null } else base.avatarUrl,
            config = patch.config.present() ?: base.config,
            castId = if (patch.castId != null) patch.castId.ifBlank { null } else base.castId,
            frame = if (patch.frame != null) patch.frame.ifBlank { null } else base.frame,
        )
    }

    /** The one precedence: the own player from [own]; anyone else from the row + [known]. */
    fun resolve(row: AvatarFields, known: AvatarFields?, own: AvatarFields?): ResolvedAvatar {
        if (own != null && isOwn(row.userId, row.username, own.userId, own.username)) {
            // Keep the row's display name as the seed so the seeded mascot never flips on a rename race.
            return resolveAvatar(own.copy(username = own.username ?: row.username).toSource())
        }
        return resolveAvatar(merge(row, known).toSource())
    }

    /**
     * BJ5 photo rule (founder 10-03: a photo is never a face on a mascot body): a photo is a
     * framed PORTRAIT — the chosen frame, else the Pro gold frame for a Pro player, else (when
     * the level is known, e.g. the signed-in player) their level tier's frame; else none.
     */
    fun portraitFrame(chosen: String?, pro: Boolean, level: Int?): String? {
        val c = chosen?.trim()?.lowercase()?.takeIf { it != "none" && it in com.wordocious.core.AvatarOptions.FRAMES }
        return c ?: (if (pro) "pro" else null) ?: level?.let { com.wordocious.core.levelTier(it).key }
    }

    /**
     * BJ6 Plan A: who stands in the Good Morning card. A signed-in player whose resolved avatar
     * is a PHOTO → that photo as a framed portrait; a saved mascot or worn cast hero → the full
     * mascot (display forced to mascot); guests / seeded players → W waving.
     */
    fun hostPick(own: AvatarFields?, level: Int? = null, pro: Boolean = false): HomeHostPick {
        own ?: return HomeHostPick.W
        val r = resolveAvatar(own.toSource())
        return when (r.kind) {
            AvatarSourceKind.PHOTO -> HomeHostPick.Portrait(r.photoUrl!!, portraitFrame(r.config.frame, pro, level))
            AvatarSourceKind.CONFIG, AvatarSourceKind.CAST ->
                HomeHostPick.Mascot(r.config.copy(display = com.wordocious.core.AvatarOptions.DISPLAY_MASCOT))
            AvatarSourceKind.SEEDED -> HomeHostPick.W
        }
    }
}

/** BJ6: the Good Morning card's host. */
sealed class HomeHostPick {
    /** The player's photo, whole, as a framed portrait ([frame] null = unframed). */
    data class Portrait(val url: String, val frame: String?) : HomeHostPick()
    /** The player's full mascot. */
    data class Mascot(val config: AvatarConfig) : HomeHostPick()
    /** W in its wave pose (guests, seeded players). */
    object W : HomeHostPick()
}

/** One `profiles` row as the avatar lookup reads it. */
@Serializable
data class AvatarProfileRow(
    val id: String,
    val username: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("avatar_config") val avatarConfig: JsonElement? = null,
    @SerialName("avatar_cast_id") val avatarCastId: String? = null,
    @SerialName("avatar_frame") val avatarFrame: String? = null,
    @SerialName("accent_color") val accentColor: String? = null,
) {
    fun fields() = AvatarFields(id, username, avatarUrl, avatarConfig, avatarCastId, avatarFrame, accentColor)
}

object PlayerAvatars {
    private val byId = mutableStateMapOf<String, AvatarFields>()
    private val byName = mutableStateMapOf<String, AvatarFields>()
    private val ownPatch = mutableStateOf<AvatarFields?>(null)
    private var patchOwner: String? = null

    /** A snapshot mirror of the signed-in profile, so every avatar recomposes when it reloads. */
    private val profileMirror = mutableStateOf<Profile?>(null)
    @Volatile private var mirroring = false

    private fun ensureMirror() {
        if (mirroring) return
        mirroring = true
        scope.launch(Dispatchers.Main) { AuthService.profile.collect { profileMirror.value = it } }
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val lock = Any()
    private val requested = HashSet<String>()
    private val pendingIds = LinkedHashSet<String>()
    private val pendingNames = LinkedHashSet<String>()
    private var flushJob: Job? = null
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    @Volatile private var lastLocalText: String? = null
    @Volatile private var lastLocalEl: JsonElement? = null

    const val FULL_COLUMNS = "id,username,avatar_url,avatar_config,avatar_cast_id,avatar_frame,accent_color"
    const val BASIC_COLUMNS = "id,username,avatar_url,accent_color"

    /** What we know about a player from earlier rows / lookups (snapshot state: avatars recompose). */
    fun known(userId: String?, username: String?): AvatarFields? =
        AvatarDirectoryRules.idKey(userId)?.let { byId[it] } ?: AvatarDirectoryRules.nameKey(username)?.let { byName[it] }

    /** Record a row that carries the look columns (absent fields never clear what is known). */
    fun record(fields: AvatarFields) {
        val idK = AvatarDirectoryRules.idKey(fields.userId)
        val nameK = AvatarDirectoryRules.nameKey(fields.username)
        if (idK == null && nameK == null) return
        val merged = AvatarDirectoryRules.merge(fields, known(fields.userId, fields.username))
        if (idK != null && byId[idK] != merged) byId[idK] = merged
        if (nameK != null && byName[nameK] != merged) byName[nameK] = merged
        // A row that carried the look columns needs no lookup; a name-only row still may.
        if (fields.complete || !fields.isPartial) synchronized(lock) { idK?.let { requested.add("id:$it") }; nameK?.let { requested.add("name:$it") } }
    }

    fun recordAll(rows: List<AvatarFields>) = rows.forEach { record(it) }

    /** The signed-in player's own fields (null when signed out). */
    fun ownFields(): AvatarFields? {
        ensureMirror()
        @Suppress("UNUSED_VARIABLE") val subscribe = profileMirror.value // read: recompose on a reload
        val p = AuthService.profile.value ?: return null
        if (patchOwner != null && patchOwner != p.id) { ownPatch.value = null; patchOwner = null }
        val localText = runCatching { SettingsPref.get(MascotConfigRules.prefKey(p.id), "") }.getOrDefault("")
        if (localText != lastLocalText) {
            lastLocalText = localText
            lastLocalEl = localText.takeIf { it.isNotBlank() }?.let { runCatching { json.parseToJsonElement(it) }.getOrNull() }
        }
        val localCfg = lastLocalEl
        val look = runCatching { CastAvatars.ownLook(p) }.getOrNull()
        return AvatarDirectoryRules.ownFields(
            profile = AvatarFields(
                p.id, p.username, p.avatarUrl, p.avatarConfig,
                if (look != null) look.castId else p.avatarCastId, if (look != null) look.frame else p.avatarFrame, p.accentColor,
            ),
            patch = ownPatch.value,
            localConfig = localCfg,
        )
    }

    /** BJ5: the one resolver — every avatar on every screen. */
    fun resolve(row: AvatarFields): ResolvedAvatar =
        AvatarDirectoryRules.resolve(row, known(row.userId, row.username), ownFields())

    /** True when [row] is the signed-in player. */
    fun isOwn(userId: String?, username: String?): Boolean {
        val p = AuthService.profile.value ?: return false
        return AvatarDirectoryRules.isOwn(userId, username, p.id, p.username)
    }

    /**
     * This device just saved a look (Edit Profile / the builder / a photo upload): show it
     * everywhere now, before the profile reload lands, and patch the cached boards.
     */
    fun patchOwn(
        /** "" = removed. */
        avatarUrl: String? = null, config: AvatarConfig? = null,
        /** "" = chose none. */
        castId: String? = null, frame: String? = null,
    ) {
        val p = AuthService.profile.value ?: return
        val cur = (ownPatch.value?.takeIf { patchOwner == p.id }) ?: AvatarFields(userId = p.id, username = p.username)
        val next = cur.copy(
            avatarUrl = avatarUrl ?: cur.avatarUrl,
            config = config?.let { avatarToJson(it) } ?: cur.config,
            castId = castId ?: cur.castId,
            frame = frame ?: cur.frame,
        )
        patchOwner = p.id
        ownPatch.value = next
        runCatching { ownFields()?.let { LeaderboardService.patchOwnAvatar(it) } }
    }

    /** Ask for a batched `profiles` lookup of a player we haven't seen (name-only payloads). */
    fun requestLookup(userId: String?, username: String?) {
        val idK = AvatarDirectoryRules.idKey(userId)
        val nameK = AvatarDirectoryRules.nameKey(username)
        if (idK == null && nameK == null) return
        if (isOwn(userId, username)) return
        synchronized(lock) {
            if (idK != null) {
                if (!requested.add("id:$idK")) return
                pendingIds.add(idK)
            } else if (nameK != null) {
                if (!requested.add("name:$nameK")) return
                pendingNames.add(username!!.trim())
            }
            if (flushJob?.isActive == true) return
            flushJob = scope.launch { delay(80); flush() }
        }
    }

    private suspend fun flush() {
        val (ids, names) = synchronized(lock) {
            val i = pendingIds.toList(); val n = pendingNames.toList()
            pendingIds.clear(); pendingNames.clear()
            i to n
        }
        if (ids.isNotEmpty()) fetch("id", ids)
        if (names.isNotEmpty()) fetch("username", names)
    }

    /** Batch-look-up these user ids now (RPC boards: the Sweep, all-time sweep). Known ids are skipped. */
    suspend fun lookupIds(userIds: Collection<String>) {
        val ids = userIds.mapNotNull { AvatarDirectoryRules.idKey(it) }.distinct()
            .filter { id -> byId[id]?.complete != true }
        if (ids.isEmpty()) return
        synchronized(lock) { ids.forEach { requested.add("id:$it") } }
        fetch("id", ids)
    }

    /** PostgREST `profiles` read, the look columns first; retried once without them. */
    private suspend fun fetch(column: String, values: List<String>) {
        for (chunk in values.chunked(80)) {
            val full = select(FULL_COLUMNS, column, chunk)
            val rows = full ?: select(BASIC_COLUMNS, column, chunk) ?: continue
            withContext(Dispatchers.Main) { rows.forEach { record(it.fields().copy(complete = full != null)) } }
        }
    }

    private suspend fun select(cols: String, column: String, values: List<String>): List<AvatarProfileRow>? = runCatching {
        SupabaseConfig.client.postgrest["profiles"].select(Columns.raw(cols)) {
            filter { isIn(column, values) }
        }.decodeList<AvatarProfileRow>()
    }.getOrElse { if (it is kotlinx.coroutines.CancellationException) throw it else null }
}
