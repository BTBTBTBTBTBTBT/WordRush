package com.wordocious.app.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.draw.drawBehind
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
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Person
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
import androidx.compose.ui.draw.rotate
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

    // The VS-capable modes: every catalog card on the shared word reducer (the
    // eight sweep games + ProperNoundle, which sits under the More tile since
    // Stage 9). The custom-engine More Games titles have no VS. Same list +
    // brand colors/glyphs as web MODES / VSLobbyScreen.VS_MODES.
    val modes = remember { ALL_CARDS.filter { it.engineMode != null && !it.engineMode.isCustomEngine } }

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
            // A1 / G5: the invite window on a pink-tinted sheet with its top bar (no white).
            modifier = com.wordocious.app.ui.PopupWidth
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(accentWash(SHEET_PINK, 0.10f))
                .drawBehind { drawRect(SHEET_PINK, size = androidx.compose.ui.geometry.Size(size.width, 10.dp.toPx())) }
                .border(1.5.dp, accentLine(SHEET_PINK), RoundedCornerShape(20.dp))
                .padding(start = 20.dp, end = 20.dp, top = 26.dp, bottom = 20.dp),
        ) {
            // T1 invite sent: the whole sheet becomes the invite-sent card — I tossing the
            // envelope springs in, INVITE SENT!, the friend on a glossy pill, candy
            // "Send another" (back to a fresh form) + "Done" (closes).
            val sent = sentTo
            if (sent != null) {
                Box(Modifier.fillMaxWidth()) {
                    InviteSentCard(
                        onDone = { reset(); onDismiss() },
                        modifier = Modifier.padding(top = 8.dp),
                        name = "@$sent",
                        note = "They'll see it the next time they open Wordocious.",
                        onSendAnother = { reset() },
                        framed = false,
                    )
                    HeaderBackButton({ reset(); onDismiss() }, Modifier.align(Alignment.TopEnd), close = true)
                }
                return@Column
            }
            // I's invite scene heads the sheet (ART_SPEC §7).
            SceneImage(SceneArt.INVITE, height = 96.dp)
            Spacer(Modifier.size(8.dp))
            // Header row: gradient title + close.
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    PageTitleText("INVITE A FRIEND", fontSize = 24.sp)
                    Text(
                        "Pick a mode, then send a link or a username invite.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                // The shared white close circle (HEADER_SPEC §4).
                HeaderBackButton({ reset(); onDismiss() }, close = true)
            }

            Spacer(Modifier.size(16.dp))

            // Tabs: Share link / Username.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                // Only the error clears on a tab switch — a generated link or a
                // sent invite survives peeking at the other tab (iOS parity).
                TabButton("Share link", Icons.Filled.Link, tab == "link", Modifier.weight(1f), purple) { tab = "link"; error = null }
                TabButton("Username", Icons.Filled.Person, tab == "username", Modifier.weight(1f), purple) { tab = "username"; error = null }
            }

            Spacer(Modifier.size(16.dp))

            Column(modifier = Modifier.heightIn(min = 220.dp)) {
                // Mode picker — brand-color dropdown with glyph.
                Text("GAME MODE", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                Spacer(Modifier.size(4.dp))
                // Inline dropdown (expands in place + pushes content down) instead
                // of a floating menu that overlapped the buttons underneath.
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(accentWash(card.accent, 0.10f))
                        .border(1.5.dp, if (modeOpen) card.accent else accentLine(card.accent), RoundedCornerShape(14.dp)),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .squishClickable(label = "Game mode, ${card.title}", role = androidx.compose.ui.semantics.Role.DropdownList) { modeOpen = !modeOpen }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(30.dp).miniGameCard(card.accent, 8.dp),
                            contentAlignment = Alignment.Center,
                        ) { ModeGlyph(card, card.accent, box = 26.dp) }
                        Spacer(Modifier.width(10.dp))
                        Text(card.title, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.weight(1f))
                        Icon(
                            Icons.Filled.ExpandMore, null, tint = card.accent,
                            modifier = Modifier.size(18.dp).rotate(if (modeOpen) 180f else 0f),
                        )
                    }
                    if (modeOpen) {
                        androidx.compose.material3.HorizontalDivider(color = accentLine(card.accent), modifier = Modifier.padding(horizontal = 8.dp))
                        Column(Modifier.padding(horizontal = 6.dp, vertical = 4.dp)) {
                            modes.forEach { m ->
                                val selected = m.id == card.id
                                Row(
                                    modifier = Modifier.fillMaxWidth()
                                        .squishClickable(label = m.title + if (selected) ", selected" else "", role = androidx.compose.ui.semantics.Role.RadioButton) {
                                            card = m; modeOpen = false; reset()
                                        }
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (selected) m.accent.copy(alpha = 0.14f) else Color.Transparent)
                                        .padding(horizontal = 8.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        Modifier.size(28.dp).miniGameCard(m.accent, 7.dp, selected = selected),
                                        contentAlignment = Alignment.Center,
                                    ) { ModeGlyph(m, m.accent, box = 22.dp) }
                                    Spacer(Modifier.width(10.dp))
                                    Text(m.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.weight(1f))
                                    if (selected) Icon(Icons.Filled.Check, null, tint = m.accent, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.size(12.dp))

                if (tab == "link") {
                    val url = inviteUrl
                    if (url == null) {
                        PrimaryButton(if (busy) "Creating…" else "Create Invite Link", !busy) {
                            busy = true; error = null; copied = false
                            scope.launch {
                                val r = InviteService.createInvite(card.engineMode!!.name, null)
                                busy = false
                                if (r.code != null) inviteUrl = "https://wordocious.com/vs/join/${r.code}"
                                else error = r.error ?: "Failed to create invite"
                            }
                        }
                    } else {
                        // T1: the invite code on glossy letter tiles with a copy candy (copies the
                        // link, flips to a teal check), the link itself small underneath.
                        Column(
                            modifier = Modifier.fillMaxWidth()
                                .tintedPill(Color(0xFF7C3AED), 14.dp)
                                .padding(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            InviteCodeTiles(
                                InviteScreens.codeFromInviteUrl(url) ?: "", Modifier.fillMaxWidth(), tile = 28.dp,
                                copied = copied, onCopy = { clipboard.setText(AnnotatedString(url)); copied = true },
                                copyLabel = "Copy invite link",
                            )
                            Text(url, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Spacer(Modifier.size(12.dp))
                        // A8: the Share candy across the width.
                        Row(Modifier.fillMaxWidth()) {
                            CastButton(
                                "Share",
                                onClick = {
                                    com.wordocious.app.data.ShareEvents.log(
                                        "link_invite", card.engineMode?.name ?: "", "invite_sheet",
                                    )
                                    // S4 VS invite copy; the join link stays.
                                    val text = com.wordocious.app.data.ShareHelper.vsInviteText(card.title, url)
                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, text)
                                    }
                                    context.startActivity(Intent.createChooser(intent, "Invite a friend").apply {
                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    })
                                },
                                color = CastColor.PINK, size = CastSize.M,
                                modifier = Modifier.weight(1f), fill = true,
                            )
                        }
                        Spacer(Modifier.size(8.dp))
                        Text("Link expires in 24 hours.", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            color = WTheme.textMuted, modifier = Modifier.fillMaxWidth(),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                } else {
                    Text("USERNAME", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    Spacer(Modifier.size(4.dp))
                    OutlinedTextField(
                        value = username, onValueChange = { username = it },
                        placeholder = { Text("e.g. wordmaster", fontSize = 14.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                        shape = RoundedCornerShape(14.dp),
                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = accentWash(SHEET_PINK, 0.06f),
                            unfocusedContainerColor = accentWash(SHEET_PINK, 0.06f),
                            focusedBorderColor = SHEET_PINK,
                            unfocusedBorderColor = accentLine(SHEET_PINK, 0.4f),
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.size(12.dp))
                    PrimaryButton(if (busy) "Sending…" else "Send Invite", !busy) {
                        val clean = username.trim().trimStart('@')
                        if (clean.isEmpty()) { error = "Enter a username"; return@PrimaryButton }
                        busy = true; error = null
                        scope.launch {
                            val r = InviteService.createInvite(card.engineMode!!.name, clean)
                            busy = false
                            if (r.code != null) sentTo = clean else error = r.error ?: "Failed to send invite"
                        }
                    }
                }

                error?.let {
                    Spacer(Modifier.size(12.dp))
                    Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626),
                        modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            }
        }
    }
}

/** A segmented option (not a button, A8): tinted, the active one filled purple; squishes (A9). */
@Composable
private fun TabButton(
    label: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean, modifier: Modifier, accent: Color, onClick: () -> Unit,
) {
    Row(
        modifier = modifier
            .squishClickable(label = label + if (active) ", selected" else "", role = androidx.compose.ui.semantics.Role.Tab, onClick = onClick)
            .clip(RoundedCornerShape(12.dp))
            .background(if (active) accent else accentWash(accent, 0.12f))
            .border(1.5.dp, if (active) accent else accentLine(accent), RoundedCornerShape(12.dp))
            .padding(vertical = 9.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (active) Color.White else accent, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (active) Color.White else WTheme.textSecondary)
    }
}

/** A8 the sheet's primary action: a large pink candy button across the width. */
@Composable
private fun PrimaryButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    CastButton(
        label, onClick = onClick, color = CastColor.PINK, size = CastSize.L,
        modifier = Modifier.fillMaxWidth(), fill = true, enabled = enabled,
    )
}

/** The invite window's pink. */
private val SHEET_PINK = Color(0xFFEC4899)
