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

    LaunchedEffect(profile?.id) {
        username = profile?.username ?: ""
        val uid = profile?.id ?: return@LaunchedEffect
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
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Cancel", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.clickableNoRipple(onDone))
            Spacer(Modifier.weight(1f))
            Text("Edit Profile", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
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
                            SupabaseConfig.client.postgrest["profiles"].update({
                                set("username", t)
                                set("social_links", buildJsonObject { cleaned.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
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
            // Avatar + Change Photo
            val avatarUrl = avatarOverride ?: profile?.avatarUrl?.takeIf { it.isNotBlank() }
            Box(
                Modifier.size(84.dp).clip(CircleShape).background(Brush.linearGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd))),
                contentAlignment = Alignment.Center,
            ) {
                if (avatarUrl != null) {
                    coil.compose.AsyncImage(model = avatarUrl, contentDescription = "Avatar", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                } else {
                    Text((profile?.username?.take(2) ?: "P").uppercase(), fontSize = 30.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
            Text(
                if (uploading) "Uploading…" else "Change Photo", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple { if (!uploading) showPhotoChoice = true },
            )

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
