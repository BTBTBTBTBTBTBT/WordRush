package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.FlagsService
import com.wordocious.app.data.InviteService
import com.wordocious.app.data.VsChallengeService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.vs.VsInk
import com.wordocious.app.ui.vs.VsTeal
import com.wordocious.core.BrandedInvite
import com.wordocious.core.GameMode
import kotlinx.coroutines.launch

/** What "Have a code?" found; the host opens the screen that accepts it. */
sealed class HaveACodeResult {
    data class Race(val code: String) : HaveACodeResult()
    data class Live(val mode: GameMode, val code: String) : HaveACodeResult()
    /** A friend / gift link: the web referral flow (wordocious.com/join/<CODE>), or the native join landing. */
    data class Friend(val code: String) : HaveACodeResult()
}

/**
 * "Have a code?" (FRIDAY-QUEUE 9f): ONE obvious family button that opens a paste/type dialog. It takes a
 * bare code or any invite link (core BrandedInvite.parseTyped) and tells the host what it found. Hidden
 * when `branded_invites` is off. Self-contained: the VS lobby and the Friends tab each place
 * `HaveACodeButton(onResolved = ...)`. Mirrors web components/invites/have-a-code.tsx.
 */
@Composable
fun HaveACodeButton(
    onResolved: (HaveACodeResult) -> Unit,
    modifier: Modifier = Modifier,
    color: CandyColor = CandyColor.TEAL,
) {
    val flags by FlagsService.flags.collectAsState()
    var open by remember { mutableStateOf(false) }
    if (!FlagsService.isLive(BrandedInvite.SWITCH_KEY, flags)) return
    CandyButton("HAVE A CODE?", onClick = { open = true }, modifier = modifier.fillMaxWidth(), color = color, size = CandySize.MEDIUM, fill = true)
    if (open) HaveACodeDialog(color, onDismiss = { open = false }) { r -> open = false; onResolved(r) }
}

@Composable
fun HaveACodeDialog(color: CandyColor, onDismiss: () -> Unit, onResolved: (HaveACodeResult) -> Unit) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var typed by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    val canJoin = typed.trim().length >= 4 && !busy

    fun go() {
        if (!canJoin) return
        val parsed = BrandedInvite.parseTyped(typed)
        if (parsed == null) { error = "That does not look like an invite code or link."; return }
        if (parsed.kind == BrandedInvite.Kind.FRIEND) { onResolved(HaveACodeResult.Friend(parsed.code)); return }
        busy = true; error = null
        scope.launch {
            // A race-my-run challenge first, then a live private-match code (the order the lobby always used).
            if (VsChallengeService.lookup(parsed.code) is VsChallengeService.LookupOutcome.Found) {
                busy = false; onResolved(HaveACodeResult.Race(parsed.code))
            } else {
                val gm = InviteService.lookupMode(parsed.code)?.let { runCatching { GameMode.valueOf(it) }.getOrNull() }
                busy = false
                if (gm != null) onResolved(HaveACodeResult.Live(gm, parsed.code)) else error = "No match found for that code."
            }
        }
    }

    AlertDialog(
        modifier = PopupWidth,
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFF3EEFF),
        title = { Text("Have a code?", fontWeight = FontWeight.Black, color = VsInk.heading) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Paste the invite link or type the code your friend sent.", fontWeight = FontWeight.Bold, color = VsTeal.sub, fontSize = 13.sp)
                BasicTextField(
                    value = typed, onValueChange = { typed = it.take(120); error = null },
                    singleLine = true,
                    textStyle = TextStyle(fontFamily = Nunito, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = VsTeal.deep),
                    cursorBrush = SolidColor(VsTeal.ink),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0xFF8B5CF6).copy(alpha = 0.12f)).padding(12.dp).focusRequester(focus),
                    decorationBox = { inner ->
                        if (typed.isEmpty()) Text("Link or CODE", fontSize = 16.sp, fontWeight = FontWeight.Black, color = VsTeal.grey)
                        inner()
                    },
                )
                error?.let { Text(it, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626)) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
                    CandyButton(
                        "PASTE", onClick = { clipboard.getText()?.text?.trim()?.take(120)?.let { typed = it; error = null } },
                        color = CandyColor.PEACH, size = CandySize.MEDIUM,
                    )
                    CandyButton(if (busy) "CHECKING…" else "JOIN", onClick = { go() }, color = color, size = CandySize.MEDIUM, enabled = canJoin, fill = true, modifier = Modifier.weight(1f))
                }
            }
        },
        confirmButton = {},
    )
}
