package com.wordocious.app.ui

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
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
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
    var unlocked by remember { mutableStateOf<Set<String>>(emptySet()) }
    val catalog by androidx.compose.runtime.produceState(com.wordocious.app.data.AchievementCatalog.cached()) {
        value = com.wordocious.app.data.AchievementCatalog.load()
    }
    val dailyModes = remember { MODE_CARDS.filter { it.engineMode != null && it.id != "vs" } }

    LaunchedEffect(profile?.id) {
        username = profile?.username ?: ""
        bio = profile?.bio ?: ""
        accent = profile?.accentColor
        favoriteMode = profile?.favoriteMode
        featured = profile?.featuredAchievement
        avatarEmoji = profile?.avatarEmoji ?: ""
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
                AuthService.refreshProfile()
                avatarOverride = url
            } else {
                // Web parity: surface upload failures instead of silently bailing.
                error = "Avatar upload failed. Please try again."
            }
            uploading = false
        }
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
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showPhotoChoice = false },
            containerColor = WTheme.surface,
            title = { Text("Change Photo", fontWeight = FontWeight.Black, color = WTheme.text) },
            text = { Text("Take a new photo or choose one from your library.", color = WTheme.textSecondary) },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = {
                    showPhotoChoice = false
                    cameraLauncher.launch(cameraUri)
                }) { Text("Take Photo", color = WTheme.primary, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = {
                    showPhotoChoice = false
                    picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }) { Text("Choose from Library", color = WTheme.primary, fontWeight = FontWeight.Bold) }
            },
        )
    }

    Column(Modifier.fillMaxSize().background(WTheme.bg)) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Cancel", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.clickableNoRipple(onDone))
            Spacer(Modifier.weight(1f))
            Text("EDIT PROFILE", fontSize = 18.sp, fontWeight = FontWeight.Black,
                style = androidx.compose.ui.text.TextStyle(brush = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))))
            Spacer(Modifier.weight(1f))
            Text(
                if (saving) "Saving…" else "Save", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple {
                    if (saving) return@clickableNoRipple
                    val t = username.trim()
                    validate(t)?.let { error = it; return@clickableNoRipple }
                    val uid = profile?.id ?: return@clickableNoRipple
                    val cleaned = SOCIAL_PLATFORMS.mapNotNull { (k, _, _) ->
                        val v = sanitize(k, socials[k] ?: ""); if (v.isNotEmpty()) k to v else null
                    }.toMap()
                    saving = true; error = null
                    scope.launch {
                        val ok = runCatching {
                            val bioVal = bio.trim().take(80).ifBlank { null }
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
                            }) { filter { eq("id", uid) } }
                        }
                        if (ok.isSuccess) { AuthService.refreshProfile(); onDone() }
                        else {
                            val msg = ok.exceptionOrNull()?.message ?: ""
                            error = if (msg.contains("23505") || msg.contains("duplicate", true)) "Username already taken"
                            else msg.ifBlank { "Failed to save" }
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

            // Live preview
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(Modifier.size(64.dp).clip(CircleShape).background(if (avatarUrl != null) Brush.linearGradient(listOf(WTheme.surface, WTheme.surface)) else ProfileAccent.avatarBrush(accent)), contentAlignment = Alignment.Center) {
                    if (avatarUrl != null) coil.compose.AsyncImage(model = avatarUrl, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                    else Text(avatarEmoji.ifBlank { (username.take(1).ifBlank { "?" }).uppercase() }, fontSize = if (avatarEmoji.isBlank()) 26.sp else 28.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
                Text(username.trim().ifBlank { "username" }, fontSize = 18.sp, fontWeight = FontWeight.Black, color = accentColor)
                if (featuredName != null) Row(Modifier.background(accentColor.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("★", fontSize = 10.sp, color = accentColor); Text(featuredName.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = accentColor)
                }
                if (bio.trim().isNotEmpty()) Text(bio.trim(), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                if (favCard != null) Row(Modifier.background(favCard.accent.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    ModeGlyph(favCard, tint = favCard.accent, glyphSize = 11.sp, iconSize = 14.dp); Text(favCard.title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = favCard.accent)
                }
            }

            // Avatar + Change Photo
            Box(
                Modifier.size(72.dp).clip(CircleShape).background(if (avatarUrl != null) Brush.linearGradient(listOf(WTheme.surface, WTheme.surface)) else ProfileAccent.avatarBrush(accent)),
                contentAlignment = Alignment.Center,
            ) {
                if (avatarUrl != null) {
                    coil.compose.AsyncImage(model = avatarUrl, contentDescription = "Avatar", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                } else {
                    Text(avatarEmoji.ifBlank { (profile?.username?.take(2) ?: "P").uppercase() }, fontSize = 28.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
            Text(
                if (uploading) "Uploading…" else "Change Photo", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple { if (!uploading) showPhotoChoice = true },
            )
            // Avatar emoji
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Avatar emoji", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                OutlinedTextField(
                    value = avatarEmoji, onValueChange = { avatarEmoji = it.take(2) }, singleLine = true,
                    modifier = Modifier.width(72.dp),
                    placeholder = { Text("🎯", fontSize = 13.sp) },
                    colors = TextFieldDefaults.colors(focusedContainerColor = WTheme.surface, unfocusedContainerColor = WTheme.surface),
                )
            }

            // Username
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("USERNAME", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                OutlinedTextField(
                    value = username, onValueChange = { username = it; error = null }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = TextFieldDefaults.colors(focusedContainerColor = WTheme.surface, unfocusedContainerColor = WTheme.surface),
                )
                error?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) }
            }

            // Bio
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("BIO  ·  ${bio.length}/80", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                OutlinedTextField(
                    value = bio, onValueChange = { if (it.length <= 80) bio = it },
                    placeholder = { Text("A short tagline…", fontSize = 13.sp, color = WTheme.textMuted) },
                    modifier = Modifier.fillMaxWidth(), maxLines = 3,
                    colors = TextFieldDefaults.colors(focusedContainerColor = WTheme.surface, unfocusedContainerColor = WTheme.surface),
                )
            }

            // Accent color
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ACCENT COLOR", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ProfileAccent.palette.forEach { (id, hex) ->
                        val selected = ProfileAccent.hex(accent).equals(hex, true)
                        Box(
                            Modifier.size(30.dp).clip(CircleShape)
                                .background(ProfileAccent.color(hex))
                                .border(if (selected) 2.5.dp else 0.dp, if (selected) ProfileAccent.color(hex) else Color.Transparent, CircleShape)
                                .clickableNoRipple { accent = if (id == "purple") null else hex },
                        )
                    }
                }
            }

            // Featured title
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("FEATURED TITLE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                val unlockedDefs = catalog.filter { unlocked.contains(it.key) }
                if (unlockedDefs.isEmpty()) {
                    Text("Unlock achievements to wear one as a title.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                } else {
                    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item { EditChip("None", featured == null, ProfileAccent.color(accent)) { featured = null } }
                        items(unlockedDefs.size) { i ->
                            val def = unlockedDefs[i]
                            EditChip("★ ${def.name}", featured == def.key, ProfileAccent.color(accent)) { featured = def.key }
                        }
                    }
                }
            }

            // Favorite mode
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("FAVORITE MODE", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { EditChip("None", favoriteMode == null, ProfileAccent.color(accent)) { favoriteMode = null } }
                    items(dailyModes.size) { i ->
                        val m = dailyModes[i]
                        val sel = favoriteMode == m.engineMode?.name
                        Box(
                            Modifier.size(40.dp).clip(RoundedCornerShape(10.dp))
                                .background(m.accent.copy(alpha = if (sel) 0.22f else 0.08f))
                                .border(if (sel) 2.dp else 0.dp, if (sel) m.accent else Color.Transparent, RoundedCornerShape(10.dp))
                                .clickableNoRipple { favoriteMode = m.engineMode?.name },
                            contentAlignment = Alignment.Center,
                        ) { ModeGlyph(m, tint = m.accent, glyphSize = 14.sp, iconSize = 18.dp) }
                    }
                }
            }

            // Social Links
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("SOCIAL LINKS", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                SOCIAL_PLATFORMS.forEach { (key, label, placeholder) ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary, modifier = Modifier.width(96.dp))
                        OutlinedTextField(
                            value = socials[key] ?: "", onValueChange = { socials[key] = it }, singleLine = true,
                            placeholder = { Text(placeholder, fontSize = 13.sp, color = WTheme.textMuted) },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = if (key == "website") KeyboardType.Uri else KeyboardType.Text),
                            colors = TextFieldDefaults.colors(focusedContainerColor = WTheme.surface, unfocusedContainerColor = WTheme.surface),
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun EditChip(label: String, selected: Boolean, accent: Color, onClick: () -> Unit) {
    Text(
        label, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1,
        color = if (selected) Color.White else WTheme.text,
        modifier = Modifier.clip(RoundedCornerShape(50))
            .background(if (selected) accent else WTheme.surfaceAlt)
            .clickableNoRipple(onClick).padding(horizontal = 10.dp, vertical = 6.dp),
    )
}

private fun validate(name: String): String? {
    // Web parity (profile-edit-modal.tsx): length-only, matching the DB
    // constraint. The charset regex was native-only and locked out users whose
    // web-set username contains a space/hyphen — they couldn't re-save.
    val t = name.trim()
    if (t.length !in 3..20) return "Username must be 3-20 characters"
    return null
}

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
