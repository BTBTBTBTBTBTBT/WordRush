@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.FlagsService
import com.wordocious.app.data.InviteService
import com.wordocious.app.data.VsChallengeService
import com.wordocious.app.ui.friends.FriendsPink
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.core.BrandedInvite
import com.wordocious.core.GameMode
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** What "Have a code?" found; the host opens the screen that accepts it. */
sealed class HaveACodeResult {
    data class Race(val code: String) : HaveACodeResult()
    data class Live(val mode: GameMode, val code: String) : HaveACodeResult()
    /** A friend / gift link: the web referral flow (wordocious.com/join/<CODE>), or the native join landing. */
    data class Friend(val code: String) : HaveACodeResult()
}

/**
 * "Have a code?" (FRIDAY-QUEUE 9f): a button that opens a paste/type sheet. It takes a bare code or any
 * invite link (core BrandedInvite.parseTyped) and tells the host what it found. Hidden when
 * `branded_invites` is off. Self-contained: the VS lobby places the full-width `HaveACodeButton`; the
 * Friends tab places the small [quiet] pill beside Add a friend (2.8 TestFlight: it must not lead the page).
 * Mirrors web components/invites/have-a-code.tsx.
 */
@Composable
fun HaveACodeButton(
    onResolved: (HaveACodeResult) -> Unit,
    modifier: Modifier = Modifier,
    color: CandyColor = CandyColor.TEAL,
    /** Friends tab: a small family QUIET pill, never a hero button. */
    quiet: Boolean = false,
) {
    val flags by FlagsService.flags.collectAsState()
    var open by remember { mutableStateOf(false) }
    if (!FlagsService.isLive(BrandedInvite.SWITCH_KEY, flags)) return
    if (quiet) {
        QuietButton("HAVE A CODE?", onClick = { open = true }, modifier = modifier, size = CandySize.SMALL, icon = FamIcon.LINK, contentDescription = "Have a code?")
    } else {
        CandyButton("HAVE A CODE?", onClick = { open = true }, modifier = modifier.fillMaxWidth(), color = color, size = CandySize.MEDIUM, fill = true)
    }
    if (open) HaveACodeSheet(color, onDismiss = { open = false }) { r -> open = false; onResolved(r) }
}

/**
 * The paste / type sheet: sized to its content (no empty top), I waving the invite beside the bubble title, the
 * page wall behind it (the season's wall in season, the normal look otherwise), a soft rounded field, PASTE
 * (family quiet) and JOIN (primary, dimmed until there is input). It rides above the keyboard.
 */
@Composable
fun HaveACodeSheet(color: CandyColor, onDismiss: () -> Unit, onResolved: (HaveACodeResult) -> Unit) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var typed by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    val canJoin = typed.trim().length >= 4 && !busy
    val tint = if (color == CandyColor.PINK) PageTint.FRIENDS else PageTint.VS

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
    LaunchedEffect(Unit) { delay(250); runCatching { focus.requestFocus() } }

    SoftModalSheet(onDismissRequest = onDismiss, containerColor = Color.Transparent, dragHandle = null) {
        Column(
            Modifier.fillMaxWidth().pageBackground(tint, alwaysLight = true).imePadding()
                .padding(horizontal = 18.dp).padding(top = 10.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                Modifier.align(Alignment.CenterHorizontally).size(width = 40.dp, height = 5.dp)
                    .clip(RoundedCornerShape(50)).background(FriendsPink.heading.copy(alpha = 0.25f)),
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SceneImage(SceneArt.INVITE, Modifier.width(84.dp), height = 92.dp, maxWidthFraction = 1f)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    BubbleText("HAVE A CODE?", HeadlinePalette.FRIENDS, maxSize = 32, minSize = 20, align = TextAlign.Start)
                    Text(
                        "Paste an invite link or type the code your friend sent.",
                        fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted,
                    )
                }
            }
            Row(
                Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF7C3AED).copy(alpha = if (focused) 0.2f else 0.13f)).padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FamIconImage(FamIcon.LINK, FriendsPink.muted, 16.dp)
                BasicTextField(
                    value = typed, onValueChange = { typed = it.take(120); error = null },
                    singleLine = true,
                    textStyle = TextStyle(fontFamily = Nunito, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, color = FriendsPink.heading),
                    cursorBrush = SolidColor(FriendsPink.solid),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { go() }),
                    modifier = Modifier.weight(1f).focusRequester(focus).onFocusChanged { focused = it.isFocused },
                    decorationBox = { inner ->
                        if (typed.isEmpty()) {
                            Text("Paste a link or type a code", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = FriendsPink.muted.copy(alpha = 0.75f), maxLines = 1)
                        }
                        inner()
                    },
                )
            }
            error?.let { Text(it, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFDC2626)) }
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                QuietButton("PASTE", onClick = { clipboard.getText()?.text?.trim()?.take(120)?.let { typed = it; error = null } }, size = CandySize.MEDIUM)
                CandyButton(
                    if (busy) "CHECKING…" else "JOIN", onClick = { go() }, color = color, size = CandySize.MEDIUM,
                    enabled = canJoin, fill = true, modifier = Modifier.weight(1f),
                )
            }
        }
    }
}
