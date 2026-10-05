package com.wordocious.app.ui

import androidx.compose.material.icons.filled.Close
import com.wordocious.app.ui.theme.Nunito

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import com.wordocious.core.avatarColorHex
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.AvatarFrame
import com.wordocious.app.data.AvatarSave
import com.wordocious.app.data.AvatarSaveResult
import com.wordocious.app.data.MascotAvatars
import com.wordocious.app.data.MascotConfigRules
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarOptions
import com.wordocious.core.defaultAvatar
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.Profanity
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Edit avatar + username + social links — ports iOS EditProfileView /
 * web profile-edit-modal. Handles stored without a leading @; website as-is.
 * Avatar → public `avatars` bucket at `<uid>/avatar.jpg` (resized 256², JPEG,
 * upsert), then profiles.avatar_url (separate write, like the web).
 */
private val SOCIAL_PLATFORMS = listOf(
    Triple("twitter", "Twitter / X", "username"),
    Triple("instagram", "Instagram", "username"),
    Triple("tiktok", "TikTok", "username"),
    Triple("threads", "Threads", "username"),
    Triple("discord", "Discord", "username"),
    Triple("website", "Website", "https://example.com"),
)

@Serializable
private data class SocialRow(@SerialName("social_links") val socialLinks: Map<String, String>? = null)

@Composable
fun EditProfileScreen(onDone: () -> Unit) {
    val profile by AuthService.profile.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var username by remember { mutableStateOf("") }
    val socials = remember { mutableStateMapOf<String, String>() }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var uploading by remember { mutableStateOf(false) }
    var avatarOverride by remember { mutableStateOf<String?>(null) }
    var bio by remember { mutableStateOf("") }
    var accent by remember { mutableStateOf<String?>(null) }
    var favoriteMode by remember { mutableStateOf<String?>(null) }
    var featured by remember { mutableStateOf<String?>(null) }
    var avatarEmoji by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(false) }
    // FINISH_SPEC AH: the worn character (null = photo / initials) + the level-tier frame.
    var castId by remember { mutableStateOf<String?>(null) }
    var frame by remember { mutableStateOf<String?>(null) }
    // FINISH_SPEC AN4: the build-your-own mascot (live, unsaved; its frame is the avatar
    // frame for the photo too) and whether the avatar shows the photo instead.
    var mascot by remember { mutableStateOf<AvatarConfig?>(null) }
    // Which one shows (avatar_config.display): the photo is never deleted, the toggle only picks.
    val wearPhoto = mascot?.display == AvatarOptions.DISPLAY_PHOTO
    var mascotSaving by remember { mutableStateOf(false) }
    var mascotSaved by remember { mutableStateOf(false) }
    var unlocked by remember { mutableStateOf<Set<String>>(emptySet()) }
    val catalog by androidx.compose.runtime.produceState(com.wordocious.app.data.AchievementCatalog.cached()) {
        value = com.wordocious.app.data.AchievementCatalog.load()
    }
    // Favorite-mode picker: every daily mode this viewer can see — the sweep
    // tiles plus the visible More Games titles (ProperNoundle among them).
    val dailyModes = visibleDailyCards()

    LaunchedEffect(profile?.id) {
        username = profile?.username ?: ""
        bio = profile?.bio ?: ""
        accent = profile?.accentColor
        favoriteMode = profile?.favoriteMode
        featured = profile?.featuredAchievement
        avatarEmoji = profile?.avatarEmoji ?: ""
        isPrivate = profile?.isPrivate ?: false
        com.wordocious.app.data.CastAvatars.ownLook(profile).let { castId = it.castId; frame = it.frame }
        profile?.let { p ->
            // display: the saved one, else "photo" when they have a photo (a worn AH character → "mascot").
            mascot = MascotConfigRules.forDisplay(
                MascotAvatars.ownConfig(p), castId, frame, p.username, p.accentColor, hasPhoto = !p.avatarUrl.isNullOrBlank(),
            )
        }
        val uid = profile?.id ?: return@LaunchedEffect
        unlocked = com.wordocious.app.data.AchievementService.fetchUnlocked(uid)
        runCatching {
            SupabaseConfig.client.postgrest["profiles"]
                .select(io.github.jan.supabase.postgrest.query.Columns.raw("social_links")) { filter { eq("id", uid) }; limit(1) }
                .decodeSingleOrNull<SocialRow>()?.socialLinks
        }.getOrNull()?.forEach { (k, v) -> socials[k] = v }
    }

    // Shared upload path for both library picks and camera captures: read the
    // image at [uri], resize to a 256² JPEG, upsert to the avatars bucket, then
    // persist profiles.avatar_url (separate write, like the web).
    val uploadUri: (android.net.Uri) -> Unit = { uri ->
        uploading = true
        scope.launch {
            val url = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@runCatching null
                    val jpeg = resizeToJpeg(bytes, 256) ?: return@runCatching null
                    val uid = AuthService.userId ?: return@runCatching null
                    val path = "$uid/avatar.jpg"
                    SupabaseConfig.client.storage.from("avatars").upload(path, jpeg) { upsert = true }
                    "${SupabaseConfig.URL}/storage/v1/object/public/avatars/$path?t=${System.currentTimeMillis()}"
                }.getOrNull()
            }
            if (url != null) {
                runCatching {
                    SupabaseConfig.client.postgrest["profiles"].update({ set("avatar_url", url) }) { filter { eq("id", AuthService.userId!!) } }
                }
                // BJ5: the new photo shows everywhere at once (boards, podiums, VS), before the reload.
                com.wordocious.app.data.PlayerAvatars.patchOwn(avatarUrl = url)
                AuthService.refreshProfile()
                avatarOverride = url
                // AH / AN: a fresh photo means "show my photo" — kept right away on a saved
                // mascot (display = "photo"); the rest of the builder waits for Save.
                castId = null
                mascot = mascot?.copy(display = AvatarOptions.DISPLAY_PHOTO)
                MascotAvatars.ownConfig(AuthService.profile.value)?.takeIf { it.display != AvatarOptions.DISPLAY_PHOTO }?.let {
                    AvatarSave.saveConfig(it.copy(display = AvatarOptions.DISPLAY_PHOTO))
                }
            } else {
                // Web parity: surface upload failures instead of silently bailing.
                error = "Avatar upload failed. Please try again."
            }
            uploading = false
        }
    }

    // AN4: what the mascot half of a save writes — the look (Pro / tier items the player
    // can't wear dropped; display = mascot | photo), AH's character (the preset it matches
    // exactly; none while the photo shows) and the tier frame. The photo is never cleared.
    fun mascotPlan(): MascotPlan {
        val lvl = profile?.level ?: 1
        val photoNow = avatarOverride ?: profile?.avatarUrl?.takeIf { it.isNotBlank() }
        val look = MascotBuilderLogic.sanitize(
            mascot ?: defaultAvatar(profile?.username?.lowercase(), profile?.accentColor, hasPhoto = photoNow != null), AuthService.isProActive, lvl,
        )
        val showPhoto = look.display == AvatarOptions.DISPLAY_PHOTO && photoNow != null
        return MascotPlan(
            look = look,
            castId = if (showPhoto) null else MascotBuilderLogic.presetOf(look),
            frame = AvatarFrame.effective(look.frame, lvl),
        )
    }

    var showPhotoChoice by remember { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(uploadUri)
    }
    // Camera: capture into a FileProvider temp file (cacheDir/share is already
    // mapped), then read it back through the same upload path.
    val cameraUri = remember {
        val dir = java.io.File(context.cacheDir, "share").apply { mkdirs() }
        val file = java.io.File(dir, "avatar-camera.jpg")
        androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) uploadUri(cameraUri)
    }

    if (showPhotoChoice) {
        val currentAvatar = avatarOverride ?: profile?.avatarUrl?.takeIf { it.isNotBlank() }
        // A1 / A8: a tinted dialog; the three choices as candy buttons.
        androidx.compose.material3.AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { showPhotoChoice = false },
            containerColor = accentWash(EDIT_PURPLE, 0.10f),
            title = { Text("Change Photo", fontWeight = FontWeight.Black, color = WTheme.text) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Take a new photo or choose one from your library.", color = WTheme.textSecondary, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(2.dp))
                    CandyButton(
                        "Take Photo", onClick = {
                            showPhotoChoice = false
                            cameraLauncher.launch(cameraUri)
                        },
                        color = CandyColor.PURPLE, size = CandySize.MEDIUM, modifier = Modifier.fillMaxWidth(), fill = true,
                    )
                    CandyButton(
                        "Choose from Library", onClick = {
                            showPhotoChoice = false
                            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                        color = CandyColor.PURPLE, size = CandySize.MEDIUM, modifier = Modifier.fillMaxWidth(), fill = true,
                    )
                    // iOS offers Remove Photo whenever an avatar_url exists —
                    // without it an uploaded photo can never be cleared.
                    if (currentAvatar != null) {
                        CandyButton(
                            "Remove Photo", onClick = {
                                showPhotoChoice = false
                                val uid = AuthService.userId ?: return@CandyButton
                                scope.launch {
                                    runCatching {
                                        SupabaseConfig.client.postgrest["profiles"]
                                            .update({ set("avatar_url", null as String?) }) { filter { eq("id", uid) } }
                                    }
                                    com.wordocious.app.data.PlayerAvatars.patchOwn(avatarUrl = "") // BJ5
                                    AuthService.refreshProfile()
                                    avatarOverride = null
                                    mascot = mascot?.copy(display = AvatarOptions.DISPLAY_MASCOT)
                                }
                            },
                            color = CandyColor.PINK, size = CandySize.MEDIUM, modifier = Modifier.fillMaxWidth(), fill = true,
                        )
                    }
                }
            },
            confirmButton = {
                CandyButton("Cancel", onClick = { showPhotoChoice = false }, color = CandyColor.PEACH, size = CandySize.MEDIUM)
            },
        )
    }

    // The one Save (top right of the Stage).
    fun save() {
            if (saving) return
            val t = username.trim()
            // Only screen a CHANGED name — mirrors the DB trigger,
            // which leaves existing rows alone so a name that predates
            // the policy doesn't block unrelated profile edits.
            if (t != profile?.username) {
                validate(t)?.let { error = it; return }
            }
            val uid = profile?.id ?: return
            val cleaned = SOCIAL_PLATFORMS.mapNotNull { (k, _, _) ->
                val v = sanitize(k, socials[k] ?: ""); if (v.isNotEmpty()) k to v else null
            }.toMap()
            saving = true; error = null
            val plan = mascotPlan()
            scope.launch {
                val castVal = plan.castId
                val frameVal = plan.frame
                // AH: the avatar columns ride along only while the server knows them.
                suspend fun write(withAvatar: Boolean) = runCatching {
                    val bioVal = bio.trim().takeCodePoints(80).ifBlank { null }
                    val emojiVal = avatarEmoji.trim().ifBlank { null }
                    val titleVal = featured?.takeIf { unlocked.contains(it) }
                    SupabaseConfig.client.postgrest["profiles"].update({
                        set("username", t)
                        set("social_links", buildJsonObject { cleaned.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
                        set("bio", bioVal)
                        set("accent_color", accent)
                        set("favorite_mode", favoriteMode)
                        set("featured_achievement", titleVal)
                        set("avatar_emoji", emojiVal)
                        set("is_private", isPrivate)
                        if (withAvatar) {
                            set(AvatarSave.CAST_COLUMN, castVal)
                            set(AvatarSave.FRAME_COLUMN, frameVal)
                        }
                    }) { filter { eq("id", uid) } }
                }
                var columnsAccepted = true
                var ok = write(withAvatar = true)
                if (ok.isFailure && AvatarSave.isMissingAvatarColumn(ok.exceptionOrNull()?.message)) {
                    // profiles has no avatar_cast_id / avatar_frame yet: save the rest, keep the choice here.
                    columnsAccepted = false
                    ok = write(withAvatar = false)
                }
                if (ok.isSuccess) {
                    AvatarSave.localCopyAfterSave(columnsAccepted, castVal, frameVal).let { (c, f) ->
                        com.wordocious.app.data.CastAvatars.storeLocal(uid, c, f)
                    }
                    com.wordocious.app.data.CastAvatars.record(t, castVal, frameVal)
                    com.wordocious.app.data.PlayerAvatars.patchOwn(castId = castVal ?: "", frame = frameVal ?: "") // BJ5
                    // AN3/AN4: the mascot (profiles.avatar_config; kept locally while the column is missing).
                    val mascotResult = AvatarSave.saveConfig(plan.look)
                    AuthService.refreshProfile()
                    if (mascotResult == AvatarSaveResult.FAILED) {
                        error = "Your profile saved, but your mascot didn't. Please try again."
                        saving = false
                    } else { DressUp.noteSaved(); onDone() }
                }
                else {
                    val msg = ok.exceptionOrNull()?.message ?: ""
                    // enforce_username_policy_trg raises check_violation
                    // with an already user-facing message. Surface THAT
                    // rather than the raw PostgREST envelope it arrives
                    // wrapped in — the client has no copy of the word
                    // list, so the server's wording is the only wording.
                    val policy = listOf(
                        "That username is not available. Please choose another.",
                        "Username must be 3-20 characters",
                        "Username may use letters, numbers, spaces, and . _ - only",
                        "Username needs at least one letter or number",
                    ).firstOrNull { msg.contains(it) }
                    error = when {
                        msg.contains("23505") || msg.contains("duplicate", true) -> "Username already taken"
                        policy != null -> policy
                        else -> msg.ifBlank { "Failed to save" }
                    }
                    saving = false
                }
            }
    }

    // ── Founder 10-05 "The Stage" (docs/design/profile-2026-10-05; iOS EditProfileView parity) ──
    var showRoom by remember { mutableStateOf(false) }
    var roomTab by remember { mutableStateOf(BuilderTab.BODY) }
    var roomStart by remember { mutableStateOf<AvatarConfig?>(null) }
    var hopToken by remember { mutableIntStateOf(0) }
    var showTitles by remember { mutableStateOf(false) }
    var sheet by remember { mutableStateOf<String?>(null) }
    var unlockedDates by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    LaunchedEffect(profile?.id) {
        val uid = profile?.id ?: return@LaunchedEffect
        unlockedDates = com.wordocious.app.data.AchievementService.fetchUnlockedDates(uid)
    }
    val avatarUrl = avatarOverride ?: profile?.avatarUrl?.takeIf { it.isNotBlank() }
    val accentColor = ProfileAccent.color(accent)
    val featuredName = featured?.let { key -> catalog.firstOrNull { it.key == key }?.name }
    val initial = MascotConfigRules.initialOf(username.trim().ifBlank { profile?.username })
    val proSelf = profile != null && AuthService.isProActive
    val look = mascot ?: defaultAvatar(profile?.username?.lowercase(), profile?.accentColor)
    val labelInk = if (WTheme.isDark) WTheme.textSecondary else Color(0xFF7A6AA6)
    fun openRoom(tab: BuilderTab, start: AvatarConfig = look.copy(display = AvatarOptions.DISPLAY_MASCOT)) {
        roomTab = tab; roomStart = start; showRoom = true
    }
    // The door it opened through (Stats card, podium, Home host, the party-hat offer).
    var doorDone by remember { mutableStateOf(false) }
    LaunchedEffect(mascot != null) {
        if (doorDone || mascot == null) return@LaunchedEffect
        doorDone = true
        when (val d = DressUp.pendingDoor) {
            is DressDoor.Room -> openRoom(d.tab)
            DressDoor.PartyHat -> {
                DressUp.finish(DressUp.Nudge.PARTY_HAT)
                openRoom(BuilderTab.HATS, MascotBuilderLogic.apply(look, BuilderOption("head", "party")))
            }
            DressDoor.Titles -> showTitles = true
            DressDoor.Stage -> Unit
        }
        DressUp.pendingDoor = DressDoor.Stage
    }

    Box(Modifier.fillMaxSize().background(if (WTheme.isDark) WTheme.bg else Color(0xFFF6F0FF))) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
            DressStage(
                look, initial,
                modifier = Modifier.clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp)),
                photoUrl = if (wearPhoto) avatarUrl else null,
                height = StageMetrics.height + 20.dp, hopToken = hopToken,
            ) {
                Row(
                    Modifier.align(Alignment.TopCenter).fillMaxWidth().statusBarsPadding().padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(40.dp).squishClickable(label = "Cancel", icon = true, onClick = onDone), contentAlignment = Alignment.Center) {
                        androidx.compose.material3.Icon(androidx.compose.material.icons.Icons.Filled.Close, null, tint = Color(0xFF6D28D9), modifier = Modifier.size(22.dp))
                    }
                    HeadingArt(Heading.EDITPROFILE, Modifier.weight(1f), height = 32.dp, maxWidth = 200.dp)
                    CandyButton(if (saving) "Saving…" else "Save", onClick = { if (!saving) save() }, color = CandyColor.PURPLE, size = CandySize.SMALL)
                }
            }
            // The name plate: your name + the featured title as a gold ribbon (tap → the Title Shelves).
            Text(
                username.trim().ifBlank { "username" }, fontSize = 22.sp, fontWeight = FontWeight.Black, maxLines = 1,
                color = if (ProfileAccent.isCustom(accent)) accentColor else Color(0xFF6D28D9), modifier = Modifier.padding(top = 8.dp),
            )
            TitleRibbon(
                featuredName ?: "Choose a title", height = 28.dp, maxWidth = 250.dp, placeholder = featuredName == null,
                modifier = Modifier.padding(top = 4.dp).squishClickable(label = "Title, ${featuredName ?: "none"}. Opens the title picker") { showTitles = true },
            )
            // One loud button + Randomize.
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CandyButton("MAKE YOUR MASCOT", onClick = { openRoom(BuilderTab.BODY) }, color = CandyColor.PINK, size = CandySize.LARGE, fill = true, modifier = Modifier.weight(1f))
                RandomizeButton {
                    mascot = MascotBuilderLogic.randomize(look, proSelf, profile?.level ?: 1).copy(display = look.display)
                    hopToken++
                }
            }
            error?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626), modifier = Modifier.padding(top = 8.dp)) }
            // Backdrop + frame: one-tap swatch rows.
            SwatchLabel("BACKDROP", labelInk, Modifier.padding(top = 14.dp))
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                AvatarOptions.BACKDROP_IDS.take(8).forEach { id ->
                    val on = look.bg == id
                    val locked = MascotBuilderLogic.proLocked(BuilderOption("bg", id), proSelf)
                    Box(
                        Modifier.size(30.dp).graphicsLayer { scaleX = if (on) 1.1f else 1f; scaleY = scaleX; alpha = if (locked) 0.5f else 1f }
                            .clip(RoundedCornerShape(50))
                            .squishClickable(label = "$id backdrop" + if (locked) ", Pro only" else "") {
                                if (locked) openRoom(BuilderTab.BACKDROP) else mascot = look.copy(bg = id)
                            },
                    ) {
                        StageBackdrop(id, avatarColorHex(look.color), Modifier.fillMaxSize())
                        if (on) Box(Modifier.fillMaxSize().border(2.5.dp, Color(0xFFF5B82E), RoundedCornerShape(50)))
                    }
                }
                Box(Modifier.size(30.dp).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.7f)).squishClickable(label = "More backdrops") { openRoom(BuilderTab.BACKDROP) }, contentAlignment = Alignment.Center) {
                    Text("•••", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED))
                }
            }
            SwatchLabel("FRAME · how you look in lists", labelInk, Modifier.padding(top = 10.dp))
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (listOf("none") + AvatarOptions.FRAMES.filter { it != "none" && (it != "pro" || proSelf) }).forEach { id ->
                    val o = BuilderOption("frame", id)
                    val locked = MascotBuilderLogic.tierLocked(o, profile?.level ?: 1) || MascotBuilderLogic.proLocked(o, proSelf)
                    val on = look.frame == id
                    Box(
                        Modifier.size(36.dp).clip(RoundedCornerShape(10.dp))
                            .background(if (on) Color.White else Color.White.copy(alpha = 0.5f))
                            .squishClickable(label = "$id frame" + if (locked) ", locked" else "", enabled = !locked) { mascot = look.copy(frame = id) }
                            .graphicsLayer { alpha = if (locked) 0.4f else 1f },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (id == "none") Text("None", fontSize = 9.sp, fontWeight = FontWeight.Black, color = labelInk)
                        else AvatarSquareFrame(id, 30.dp)
                        if (locked) StageArt(com.wordocious.app.R.drawable.art_dress_lock, 15.dp)
                    }
                }
            }
            // Everything else: quiet unboxed rows.
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp, bottom = 28.dp)) {
                QuietRow("SHOW", labelInk) {
                    MascotWearToggle(wearPhoto, onChange = { photo ->
                        if (photo && avatarUrl == null) { showPhotoChoice = true; return@MascotWearToggle }
                        mascot = look.copy(display = if (photo) AvatarOptions.DISPLAY_PHOTO else AvatarOptions.DISPLAY_MASCOT)
                        hopToken++
                    })
                }
                RowDivider()
                QuietRow("USERNAME", labelInk) {
                    androidx.compose.foundation.text.BasicTextField(
                        username, { username = it; error = null }, singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, fontFamily = Nunito),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                RowDivider()
                QuietRow("BIO", labelInk) {
                    Box(Modifier.fillMaxWidth()) {
                        if (bio.isEmpty()) Text("A short tagline…", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = labelInk)
                        androidx.compose.foundation.text.BasicTextField(
                            bio, { bio = it.takeCodePoints(80) }, maxLines = 3,
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text, fontFamily = Nunito),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
                RowDivider()
                QuietRow("TITLE", labelInk, onClick = { showTitles = true }) {
                    Text(
                        featuredName ?: "Choose one", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF92400E), maxLines = 1,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Brush.verticalGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A)))).padding(horizontal = 10.dp, vertical = 3.dp),
                    )
                }
                RowDivider()
                QuietRow("FAVORITE", labelInk, onClick = { sheet = "favorite" }) {
                    val fav = favoriteMode?.let { dk -> dailyModes.firstOrNull { it.engineMode?.name == dk } }
                    if (fav != null) {
                        ModeGlyph(fav, tint = fav.accent, box = 24.dp)
                        Text(fav.title, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1, modifier = Modifier.padding(start = 6.dp))
                    } else Text("Pick a game", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = labelInk)
                }
                RowDivider()
                QuietRow("NAME COLOR", labelInk) {
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        ProfileAccent.palette.forEach { (id, hex) ->
                            val on = ProfileAccent.hex(accent).equals(hex, true)
                            val c = ProfileAccent.color(hex)
                            Box(
                                Modifier.size(20.dp).clip(RoundedCornerShape(50)).background(c)
                                    .then(if (on) Modifier.border(2.dp, Color.White, RoundedCornerShape(50)) else Modifier)
                                    .squishClickable(label = "$id name color" + if (on) ", selected" else "", role = Role.RadioButton) { accent = if (id == "purple") null else hex },
                            )
                        }
                    }
                }
                RowDivider()
                QuietRow("PRIVATE", labelInk, onClick = { sheet = "privacy" }) {
                    Text(if (isPrivate) "On · words & history hidden" else "Off", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = labelInk, maxLines = 1)
                }
                RowDivider()
                QuietRow("SOCIALS", labelInk, onClick = { sheet = "socials" }) {
                    val n = SOCIAL_PLATFORMS.count { (k, _, _) -> !socials[k].isNullOrBlank() }
                    Text(if (n == 0) "Add links" else "$n link" + if (n == 1) "" else "s", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = labelInk)
                }
            }
        }
    }

    // The Dressing Room (full screen): Done returns here with a soft hop.
    if (showRoom) {
        androidx.compose.ui.window.Dialog(
            onDismissRequest = { showRoom = false },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
        ) {
            DressingRoom(
                config = roomStart ?: look,
                initial = initial, level = profile?.level ?: 1, isPro = proSelf, startTab = roomTab,
                onClose = { showRoom = false },
                onDone = { c ->
                    val keepPhoto = wearPhoto && DressUp.pendingDoor == DressDoor.Stage && avatarUrl != null
                    mascot = c.copy(display = if (keepPhoto) AvatarOptions.DISPLAY_PHOTO else AvatarOptions.DISPLAY_MASCOT)
                    showRoom = false
                    scope.launch { kotlinx.coroutines.delay(420); hopToken++ }
                },
            )
        }
    }
    if (showTitles) {
        TitleShelvesDialog(
            username = username.trim().ifBlank { profile?.username ?: "" }, mascot = look, initial = initial, accent = accentColor,
            catalog = catalog, unlockedDates = unlockedDates, selected = featured,
            onDismiss = { showTitles = false },
            onPick = { featured = it; showTitles = false; hopToken++ },
        )
    }
    sheet?.let { which ->
        androidx.compose.material3.AlertDialog(
            modifier = PopupWidth,
            onDismissRequest = { sheet = null },
            containerColor = accentWash(EDIT_PURPLE, 0.10f),
            title = { Text(when (which) { "socials" -> "Your links"; "privacy" -> "Private profile"; else -> "Favorite game" }, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9)) },
            text = {
                when (which) {
                    "socials" -> Column {
                        SOCIAL_PLATFORMS.forEach { (key, label, placeholder) ->
                            QuietRow(label.uppercase(), labelInk) {
                                Box(Modifier.fillMaxWidth()) {
                                    if ((socials[key] ?: "").isEmpty()) Text(placeholder, fontSize = 14.sp, color = labelInk)
                                    androidx.compose.foundation.text.BasicTextField(
                                        socials[key] ?: "", { socials[key] = it }, singleLine = true,
                                        keyboardOptions = KeyboardOptions(keyboardType = if (key == "website") KeyboardType.Uri else KeyboardType.Text),
                                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text, fontFamily = Nunito),
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                            }
                        }
                    }
                    "privacy" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Hide my words, stats and game history", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, modifier = Modifier.weight(1f))
                            androidx.compose.material3.Switch(isPrivate, { isPrivate = it })
                        }
                        Text("You'll still appear on leaderboards.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = labelInk)
                    }
                    else -> androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item { EditChip("None", favoriteMode == null, accentColor) { favoriteMode = null; sheet = null } }
                        items(dailyModes.size) { i ->
                            val m = dailyModes[i]
                            GameTileSquare(
                                accent = m.accent, label = null, selected = favoriteMode == m.engineMode?.name,
                                modifier = Modifier.padding(vertical = 4.dp).size(48.dp), chipSize = 32.dp, corner = 12.dp,
                                onClick = { favoriteMode = m.engineMode?.name; sheet = null },
                            ) { chip -> ModeGlyph(m, tint = m.accent, box = chip) }
                        }
                    }
                }
            },
            confirmButton = { CandyButton("Done", onClick = { sheet = null }, color = CandyColor.PURPLE, size = CandySize.SMALL) },
        )
    }
}

@Composable
private fun SwatchLabel(text: String, ink: Color, modifier: Modifier = Modifier) {
    Text(text.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = ink, modifier = modifier)
}

/** A quiet row (founder 10-05: no bordered boxes): the label left, the value right; [onClick] adds the chevron. */
@Composable
private fun QuietRow(label: String, ink: Color, onClick: (() -> Unit)? = null, content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().then(if (onClick != null) Modifier.squishClickable(label = label.lowercase(), onClick = onClick) else Modifier).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = ink, modifier = Modifier.width(88.dp))
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) { content() }
        if (onClick != null) Text("›", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color(0xFFA78BFA))
    }
}

@Composable
private fun RowDivider() { Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x147C3AED))) }

/** AN4: what the mascot half of a save writes (see mascotPlan in EditProfileScreen). */
private data class MascotPlan(val look: AvatarConfig, val castId: String?, val frame: String?)

/**
 * The builder's own Save: the mascot (AvatarSave.saveConfig — local copy while the
 * column is missing), AH's character + frame columns (same missing-column fallback as
 * the page Save). The photo is never touched (avatar_config.display picks what shows).
 */
private suspend fun saveMascotLook(uid: String, username: String?, plan: MascotPlan): AvatarSaveResult {
    val r = AvatarSave.saveConfig(plan.look)
    if (r == AvatarSaveResult.FAILED) return r
    val cols = runCatching {
        SupabaseConfig.client.postgrest["profiles"].update({
            set(AvatarSave.CAST_COLUMN, plan.castId)
            set(AvatarSave.FRAME_COLUMN, plan.frame)
        }) { filter { eq("id", uid) } }
    }
    AvatarSave.localCopyAfterSave(cols.isSuccess, plan.castId, plan.frame).let { (c, f) ->
        com.wordocious.app.data.CastAvatars.storeLocal(uid, c, f)
    }
    com.wordocious.app.data.CastAvatars.record(username, plan.castId, plan.frame)
    com.wordocious.app.data.PlayerAvatars.patchOwn(castId = plan.castId ?: "", frame = plan.frame ?: "") // BJ5
    AuthService.refreshProfile()
    return r
}

/** The avatar as it will show: the square-framed photo when that is worn, else the live mascot. Decorative. */
@Composable
private fun EditAvatar(mascot: AvatarConfig?, username: String, photoUrl: String?, wearPhoto: Boolean, size: androidx.compose.ui.unit.Dp, pro: Boolean) {
    if (wearPhoto && photoUrl != null) {
        PhotoAvatar(photoUrl, size, frame = mascot?.frame?.takeIf { it != "none" }, pro = pro)
    } else {
        MascotAvatar(
            config = mascot ?: defaultAvatar(username?.lowercase(), null), initial = MascotConfigRules.initialOf(username),
            size = size, pro = pro,
        )
    }
}

/** The Edit Profile page accent (purple, like Settings / Home). */
private val EDIT_PURPLE = Color(0xFF7C3AED)

/** A titled section — iOS EditProfileView.sectionCard — as a tinted card with its top bar (A1). */
@Composable
private fun SectionCard(title: String = "", heading: Heading? = null, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    TintedCard(
        EDIT_PURPLE, Modifier.fillMaxWidth(), corner = 18.dp, barHeight = 8.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (heading != null) HeadingArt(heading, height = 30.dp, alignment = Alignment.CenterStart)
        else FinishLabel(title)
        content()
    }
}

/** A choice chip: a tinted pill (selected = filled in the accent), squishing (A9). */
@Composable
private fun EditChip(label: String, selected: Boolean, accent: Color, star: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier
            .squishClickable(label = label + if (selected) ", selected" else "", role = androidx.compose.ui.semantics.Role.RadioButton, onClick = onClick)
            .clip(shape)
            .background(if (selected) accent else accentWash(accent, 0.12f))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // AL addendum 2: the featured-title star is our gold star art, not a glyph.
        if (star) GlyphArtImage(GlyphArt.STAR, 13.dp)
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, color = if (selected) Color.White else WTheme.text)
    }
}

/** AM2: the one-time "Pick your character!" nudge for players who still wear an emoji avatar. */
private const val EMOJI_AVATAR_NUDGED = "pref-emoji-avatar-nudged"

/** The text fields: a soft purple-tinted container (A1, no white). */
@Composable
private fun editFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = accentWash(EDIT_PURPLE, 0.14f),
    unfocusedContainerColor = accentWash(EDIT_PURPLE, 0.10f),
    // BI25: a soft filled field, never outlined.
    focusedIndicatorColor = Color.Transparent,
    unfocusedIndicatorColor = Color.Transparent,
    cursorColor = EDIT_PURPLE,
)

private fun validate(name: String): String? {
    // Shape AND content (core Profanity mirrors the DB word list — this is the
    // screen "DamnDickCockBallsAss" was typed into). The DB trigger
    // enforce_username_policy_trg is the authority — the update below goes
    // straight to PostgREST, so a check here is bypassable; it just gives
    // instant feedback and avoids a raw error round trip. Charset/space rules
    // match the trigger exactly, so a web-set name can always re-save.
    return Profanity.usernameError(name)
}

/** Truncate to [max] Unicode code points — the bio DB CHECK is char_length and
 *  iOS counts unicodeScalars, so String.length (UTF-16) cuts emoji bios short. */
private fun String.takeCodePoints(max: Int): String =
    if (codePointCount(0, length) <= max) this else substring(0, offsetByCodePoints(0, max))

private fun sanitize(key: String, raw: String): String {
    val t = raw.trim()
    if (key == "website") return t
    return if (t.startsWith("@")) t.drop(1) else t
}

/** Decode → scale longest side to [max] → JPEG bytes (q85), matching web/iOS. */
private fun resizeToJpeg(bytes: ByteArray, max: Int): ByteArray? {
    val src = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val scale = max.toFloat() / maxOf(src.width, src.height).coerceAtLeast(1)
    val w = (src.width * scale).toInt().coerceAtLeast(1)
    val h = (src.height * scale).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(src, w, h, true)
    val out = java.io.ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, 85, out)
    return out.toByteArray()
}
