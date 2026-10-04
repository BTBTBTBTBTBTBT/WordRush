package com.wordocious.app.ui

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

    // statusBarsPadding: this screen paints its own gradient bar at y=0 and
    // does NOT hand-roll a top inset the way the game surfaces do, so under
    // targetSdk 35 edge-to-edge the clock sat on top of Cancel / EDIT PROFILE
    // / Save. The root fix in MainActivity covers the NAVIGATION bar only —
    // adding status-bar padding there would double the game screens' own
    // 48dp. Reported by the Play tester on the profile editor.
    Column(Modifier.fillMaxSize().pageBackground(PageTint.HOME).statusBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        // The shared page header (HEADER_SPEC §4): Cancel is the bare close control; Save
        // is a small purple candy button on the right (A8).
        PageHeader("EDIT PROFILE", heading = Heading.EDITPROFILE, onBack = onDone, backAsClose = true, backLabel = "Cancel", titleSize = 18.sp) {
            CandyButton(
                if (saving) "Saving…" else "Save", color = CandyColor.PURPLE, size = CandySize.SMALL,
                onClick = {
                    if (saving) return@CandyButton
                    val t = username.trim()
                    // Only screen a CHANGED name — mirrors the DB trigger,
                    // which leaves existing rows alone so a name that predates
                    // the policy doesn't block unrelated profile edits.
                    if (t != profile?.username) {
                        validate(t)?.let { error = it; return@CandyButton }
                    }
                    val uid = profile?.id ?: return@CandyButton
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
                            } else onDone()
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
                },
            )
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val avatarUrl = avatarOverride ?: profile?.avatarUrl?.takeIf { it.isNotBlank() }
            val accentColor = ProfileAccent.color(accent)
            val favCard = favoriteMode?.let { dk -> dailyModes.firstOrNull { it.engineMode?.name == dk } }
            val featuredName = featured?.let { key -> catalog.firstOrNull { it.key == key }?.name }

            // Live preview — a tinted card in the chosen accent with its top bar (A1), O2
            // strutting in the corner (A7: a cast pose where there is room).
            Box(Modifier.fillMaxWidth()) {
            TintedCard(
                accentColor, Modifier.fillMaxWidth(), corner = 18.dp,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
              Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                // ART_SPEC §20: photo in a circle, else the letter tile (live username / accent / emoji).
                // AA2: a Pro member's preview wears the gold ring + crown.
                val pro = profile != null && com.wordocious.app.data.AuthService.isProActive
                // AN4/AN6: the live mascot (or the square-framed photo when that is what shows) + the Pro crown.
                EditAvatar(mascot, username.trim().ifBlank { "?" }, avatarUrl, wearPhoto, 64.dp, pro)
                Text(username.trim().ifBlank { "username" }, fontSize = 18.sp, fontWeight = FontWeight.Black, color = accentColor)
                if (featuredName != null) Row(Modifier.background(accentColor.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    GlyphArtImage(GlyphArt.STAR, 13.dp); Text(featuredName.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = accentColor)
                }
                if (bio.trim().isNotEmpty()) Text(bio.trim(), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                if (favCard != null) Row(Modifier.background(favCard.accent.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    ModeGlyph(favCard, tint = favCard.accent, box = 28.dp); Text(favCard.title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = favCard.accent)
                }
              }
            }
            // A7: never the worn character twice in the card — O1 steps in when O2 is the avatar.
            if (castId == "o2") CastPose(MascotId.O1, "cheer", 56.dp, Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 6.dp))
            else CastPose(MascotId.O2, "strut", 56.dp, Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 6.dp))
            }

            val proSelf = profile != null && com.wordocious.app.data.AuthService.isProActive
            // FINISH_SPEC AM2: the emoji avatar option is retired (the cast + photo + letter
            // tile replace it; the stored avatar_emoji is left as is, no DB change). Players
            // who still have one get a one-time gentle nudge toward the character picker.
            var emojiNudge by remember { mutableStateOf(false) }
            LaunchedEffect(profile?.id, profile?.avatarEmoji) {
                if (!profile?.avatarEmoji.isNullOrBlank() && !com.wordocious.app.data.SettingsPref.get(EMOJI_AVATAR_NUDGED, false)) {
                    emojiNudge = true
                    com.wordocious.app.data.SettingsPref.set(EMOJI_AVATAR_NUDGED, true)
                }
            }
            if (emojiNudge) {
                TintedCard(accentColor, Modifier.fillMaxWidth(), corner = 16.dp, barHeight = 6.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        // A7: D here (O1 / O2 already sit in the preview card above).
                        CastPose(MascotId.D, "eureka", 48.dp)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("Pick your character!", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                            Text(
                                "Emoji avatars are retired. Choose one of the cast below, or use your photo or letter tile.",
                                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                            )
                        }
                    }
                }
            }

            // AN4: make your mascot — the cast presets (AH's character pick), every part, the
            // level-tier / Pro frames, Randomize and Save. The photo stays an option below.
            // Founder 10-03 (no plain-text headings): the MAKE YOUR MASCOT lettering titles the builder.
            SectionCard(heading = Heading.MASCOT) {
                if (avatarUrl != null) MascotWearToggle(wearPhoto, onChange = { photo ->
                    mascot = mascot?.copy(display = if (photo) AvatarOptions.DISPLAY_PHOTO else AvatarOptions.DISPLAY_MASCOT)
                    mascotSaved = false
                })
                // Built once the saved look has loaded (so opening the page doesn't hop / play the sound).
                val look = mascot
                if (look != null) MascotBuilder(
                    config = look,
                    onChange = { mascot = it; mascotSaved = false },
                    initial = MascotConfigRules.initialOf(username.trim().ifBlank { profile?.username }),
                    level = profile?.level ?: 1,
                    isPro = proSelf,
                    saving = mascotSaving,
                    saved = mascotSaved,
                    onSave = save@{
                        val uid = profile?.id ?: return@save
                        if (mascotSaving) return@save
                        val plan = mascotPlan()
                        mascotSaving = true; error = null
                        scope.launch {
                            val r = saveMascotLook(uid, profile?.username, plan)
                            mascotSaving = false
                            mascotSaved = r != AvatarSaveResult.FAILED
                            if (r == AvatarSaveResult.FAILED) error = "Couldn't save your mascot. Please try again."
                        }
                    },
                )
            }
            SectionCard("PHOTO") {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // AN6: the photo as a rounded square with the chosen frame.
                    if (avatarUrl != null) PhotoAvatar(avatarUrl, 56.dp, frame = mascot?.frame?.takeIf { it != "none" }, pro = proSelf, contentDescription = "Your photo")
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            if (avatarUrl != null) "Prefer your own face? Show your photo instead of your mascot."
                            else "Add a photo to show it instead of your mascot.",
                            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        )
                        CandyButton(
                            when { uploading -> "Uploading…"; avatarUrl != null -> "Change Photo"; else -> "Add Photo" },
                            onClick = { if (!uploading) showPhotoChoice = true },
                            color = CandyColor.PURPLE, size = CandySize.SMALL, enabled = !uploading,
                        )
                    }
                }
            }

            // Username
            SectionCard("USERNAME") {
                OutlinedTextField(
                    value = username, onValueChange = { username = it; error = null }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = editFieldColors(), shape = RoundedCornerShape(12.dp),
                )
                error?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) }
            }

            // Bio
            SectionCard("BIO  ·  ${bio.codePointCount(0, bio.length)}/80") {
                OutlinedTextField(
                    value = bio, onValueChange = { bio = it.takeCodePoints(80) },
                    placeholder = { Text("A short tagline…", fontSize = 13.sp, color = WTheme.textMuted) },
                    modifier = Modifier.fillMaxWidth(), maxLines = 3,
                    colors = editFieldColors(), shape = RoundedCornerShape(12.dp),
                )
            }

            // Accent color
            SectionCard("ACCENT COLOR") {
                // A1: each swatch a mini tinted tile; the selected one takes the stronger tint + ring.
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    ProfileAccent.palette.forEach { (id, hex) ->
                        val selected = ProfileAccent.hex(accent).equals(hex, true)
                        val c = ProfileAccent.color(hex)
                        Box(
                            Modifier.weight(1f, fill = false).size(40.dp)
                                .squishClickable(label = "$id accent" + if (selected) ", selected" else "", role = androidx.compose.ui.semantics.Role.RadioButton) {
                                    accent = if (id == "purple") null else hex
                                }
                                // BI25: a soft filled swatch tile (selected = deeper wash), no ring.
                                .clip(RoundedCornerShape(10.dp)).background(accentWash(c, if (selected) 0.34f else 0.12f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(Modifier.padding(top = 3.dp).size(20.dp).clip(CircleShape).background(c))
                        }
                    }
                }
            }

            // Featured title
            SectionCard("FEATURED TITLE") {
                val unlockedDefs = catalog.filter { unlocked.contains(it.key) }
                if (unlockedDefs.isEmpty()) {
                    // BI24 compact: a cast host beside the line, not grey text alone.
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Mascot(MascotId.U, 40.dp)
                        Text("Unlock achievements to wear one as a title.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                    }
                } else {
                    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item { EditChip("None", featured == null, ProfileAccent.color(accent)) { featured = null } }
                        items(unlockedDefs.size) { i ->
                            val def = unlockedDefs[i]
                            EditChip(def.name, featured == def.key, ProfileAccent.color(accent), star = true) { featured = def.key }
                        }
                    }
                }
            }

            // Favorite mode
            SectionCard("FAVORITE MODE") {
                androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { EditChip("None", favoriteMode == null, ProfileAccent.color(accent)) { favoriteMode = null } }
                    items(dailyModes.size) { i ->
                        val m = dailyModes[i]
                        val sel = favoriteMode == m.engineMode?.name
                        // The square game tile (docs/GAME_TILE_STYLE.md) at picker size, no label.
                        GameTileSquare(
                            accent = m.accent, label = null, selected = sel,
                            modifier = Modifier.padding(vertical = 4.dp).size(44.dp), chipSize = 30.dp, corner = 12.dp,
                            onClick = { favoriteMode = m.engineMode?.name },
                        ) { chip -> ModeGlyph(m, tint = m.accent, box = chip) }
                    }
                }
            }

            // Privacy — PRIVATE PROFILES toggle (web ProfileEditModal parity):
            // lock/globe icon + "Private profile" + ON/OFF pill, helper below.
            // Saves profiles.is_private with the rest of the form.
            SectionCard("PRIVACY") {
                Row(
                    Modifier.fillMaxWidth()
                        .squishClickable(label = "Private profile, ${if (isPrivate) "on" else "off"}", role = androidx.compose.ui.semantics.Role.Switch) { isPrivate = !isPrivate }
                        .clip(RoundedCornerShape(12.dp)).background(accentWash(EDIT_PURPLE, if (isPrivate) 0.2f else 0.08f))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    androidx.compose.material3.Icon(
                        if (isPrivate) Icons.Filled.Lock else Icons.Filled.Language,
                        null,
                        tint = if (isPrivate) Color(0xFF7C3AED) else WTheme.textMuted,
                        modifier = Modifier.size(16.dp),
                    )
                    Text("Private profile", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, modifier = Modifier.weight(1f))
                    Text(
                        if (isPrivate) "ON" else "OFF",
                        fontSize = 10.sp, fontWeight = FontWeight.Black,
                        color = if (isPrivate) Color(0xFF7C3AED) else WTheme.textMuted,
                        modifier = Modifier.clip(RoundedCornerShape(50))
                            .background(if (isPrivate) accentWash(EDIT_PURPLE, 0.3f) else accentWash(EDIT_PURPLE, 0.12f))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
                Text(
                    "Hide your words, stats, and game history from other players. You'll still appear on leaderboards.",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
            }

            // Socials
            SectionCard("SOCIALS") {
                SOCIAL_PLATFORMS.forEach { (key, label, placeholder) ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary, modifier = Modifier.width(96.dp))
                        OutlinedTextField(
                            value = socials[key] ?: "", onValueChange = { socials[key] = it }, singleLine = true,
                            placeholder = { Text(placeholder, fontSize = 13.sp, color = WTheme.textMuted) },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = if (key == "website") KeyboardType.Uri else KeyboardType.Text),
                            colors = editFieldColors(), shape = RoundedCornerShape(12.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

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
