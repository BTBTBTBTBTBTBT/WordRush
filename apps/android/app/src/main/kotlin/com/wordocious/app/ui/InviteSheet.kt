package com.wordocious.app.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.wordocious.app.data.InviteService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Pro-only "Invite a friend to a VS match" modal — Android port of the web
 * InviteModal (components/invites/invite-modal.tsx) and iOS InviteSheet: pick a
 * mode, then either generate a shareable join link or send a targeted invite to
 * a username.
 */
@Composable
fun InviteSheet(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    // The 9 VS-capable modes (every MODE_CARD with an engine mode — excludes the
    // "vs" card itself). Same list + brand colors/glyphs as web MODES.
    val modes = remember { MODE_CARDS.filter { it.engineMode != null } }

    var card by remember { mutableStateOf(modes.first()) }
    var modeOpen by remember { mutableStateOf(false) }
    var tab by remember { mutableStateOf("link") }
    var username by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var inviteUrl by remember { mutableStateOf<String?>(null) }
    var sentTo by remember { mutableStateOf<String?>(null) }
    var copied by remember { mutableStateOf(false) }
    val purple = Color(0xFF7C3AED)

    fun reset() { inviteUrl = null; sentTo = null; username = ""; error = null; copied = false }

    Dialog(onDismissRequest = { reset(); onDismiss() }) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(20.dp))
                .padding(20.dp),
        ) {
            // Header row: gradient title + close.
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Invite a friend",
                        fontSize = 24.sp, fontWeight = FontWeight.Black,
                        style = androidx.compose.ui.text.TextStyle(
                            brush = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))),
                        ),
                    )
                    Text(
                        "Pick a mode, then send a link or a username invite.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Box(
                    Modifier.size(32.dp).clip(CircleShape).background(WTheme.bg)
                        .clickable { reset(); onDismiss() },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Close, "Close", tint = WTheme.textMuted, modifier = Modifier.size(16.dp)) }
            }

            Spacer(Modifier.size(16.dp))

            // Tabs: Share link / Username.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                TabButton("Share link", Icons.Filled.Link, tab == "link", Modifier.weight(1f), purple) { tab = "link"; reset() }
                TabButton("Username", Icons.Filled.Person, tab == "username", Modifier.weight(1f), purple) { tab = "username"; reset() }
            }

            Spacer(Modifier.size(16.dp))

            Column(modifier = Modifier.heightIn(min = 220.dp)) {
                // Mode picker — brand-color dropdown with glyph.
                Text("MODE", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                Spacer(Modifier.size(4.dp))
                Box {
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(WTheme.surface)
                            .border(1.5.dp, card.accent, RoundedCornerShape(10.dp))
                            .clickable { modeOpen = true }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(24.dp).clip(RoundedCornerShape(6.dp)).background(card.accent.copy(alpha = 0.10f)),
                            contentAlignment = Alignment.Center,
                        ) { ModeGlyph(card, card.accent, 13.sp, 16.dp) }
                        Spacer(Modifier.width(8.dp))
                        Text(card.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = card.accent, modifier = Modifier.weight(1f))
                        Icon(Icons.Filled.ExpandMore, null, tint = card.accent, modifier = Modifier.size(18.dp))
                    }
                    DropdownMenu(expanded = modeOpen, onDismissRequest = { modeOpen = false }) {
                        modes.forEach { m ->
                            DropdownMenuItem(
                                onClick = { card = m; modeOpen = false; reset() },
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            Modifier.size(24.dp).clip(RoundedCornerShape(6.dp)).background(m.accent.copy(alpha = 0.10f)),
                                            contentAlignment = Alignment.Center,
                                        ) { ModeGlyph(m, m.accent, 13.sp, 16.dp) }
                                        Spacer(Modifier.width(8.dp))
                                        Text(m.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = m.accent, modifier = Modifier.weight(1f))
                                        if (m.id == card.id) Icon(Icons.Filled.Check, null, tint = m.accent, modifier = Modifier.size(14.dp))
                                    }
                                },
                            )
                        }
                    }
                }

                Spacer(Modifier.size(12.dp))

                if (tab == "link") {
                    val url = inviteUrl
                    if (url == null) {
                        PrimaryButton(if (busy) "Creating…" else "Generate invite link", purple, !busy) {
                            busy = true; error = null; copied = false
                            scope.launch {
                                val r = InviteService.createInvite(card.engineMode!!.name, null)
                                busy = false
                                if (r.code != null) inviteUrl = "https://wordocious.com/vs/join/${r.code}"
                                else error = r.error ?: "Failed to create invite"
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp)).background(WTheme.bg)
                                .border(1.5.dp, WTheme.border, RoundedCornerShape(10.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(url, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.text,
                                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            Box(
                                Modifier.size(28.dp).clip(RoundedCornerShape(6.dp))
                                    .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(6.dp))
                                    .clickable { clipboard.setText(AnnotatedString(url)); copied = true },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy, "Copy",
                                    tint = if (copied) Color(0xFF16A34A) else purple, modifier = Modifier.size(14.dp))
                            }
                        }
                        Spacer(Modifier.size(12.dp))
                        PrimaryButton("Share", purple, true, Icons.Filled.Share) {
                            val text = "Come play me on Wordocious — ${card.title}."
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, "$text\n$url")
                            }
                            context.startActivity(Intent.createChooser(intent, "Invite a friend").apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            })
                        }
                        Spacer(Modifier.size(8.dp))
                        Text("Link expires in 24 hours.", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            color = WTheme.textMuted, modifier = Modifier.fillMaxWidth(),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                } else {
                    val sent = sentTo
                    if (sent == null) {
                        Text("USERNAME", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                        Spacer(Modifier.size(4.dp))
                        OutlinedTextField(
                            value = username, onValueChange = { username = it },
                            placeholder = { Text("e.g. wordmaster", fontSize = 14.sp) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.size(12.dp))
                        PrimaryButton(if (busy) "Sending…" else "Send invite", purple, !busy) {
                            val clean = username.trim().trimStart('@')
                            if (clean.isEmpty()) { error = "Enter a username"; return@PrimaryButton }
                            busy = true; error = null
                            scope.launch {
                                val r = InviteService.createInvite(card.engineMode!!.name, clean)
                                busy = false
                                if (r.code != null) sentTo = clean else error = r.error ?: "Failed to send invite"
                            }
                        }
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFF0FDF4))
                                .border(1.5.dp, Color(0xFF86EFAC), RoundedCornerShape(12.dp))
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(Icons.Filled.Check, null, tint = Color(0xFF16A34A), modifier = Modifier.size(24.dp))
                            Spacer(Modifier.size(6.dp))
                            Text("Invite sent to @$sent", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFF166534))
                            Text("They'll see it the next time they open Wordocious.",
                                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF16A34A),
                                modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }

                error?.let {
                    Spacer(Modifier.size(12.dp))
                    Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444),
                        modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            }
        }
    }
}

@Composable
private fun TabButton(
    label: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean, modifier: Modifier, accent: Color, onClick: () -> Unit,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (active) accent else WTheme.bg)
            .border(1.5.dp, if (active) accent else WTheme.border, RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(vertical = 9.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (active) Color.White else WTheme.textMuted, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (active) Color.White else WTheme.textMuted)
    }
}

@Composable
private fun PrimaryButton(
    label: String, color: Color, enabled: Boolean,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null, onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (enabled) color else color.copy(alpha = 0.5f))
            .clickable(enabled = enabled) { onClick() }
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)) }
        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
    }
}
