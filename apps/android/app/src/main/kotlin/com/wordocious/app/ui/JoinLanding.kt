package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DeepLinkRouter
import com.wordocious.app.data.JoinLandingRules
import com.wordocious.app.data.JoinLandingRules.Status
import com.wordocious.app.data.ReferralService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * The referral / gift-a-week invite landing (wordocious.com/join/<CODE>; web app/join/[code],
 * FINISH_SPEC T2/T4): a gold-tinted sheet with the gift art, "<Name> sent you a week of Pro!",
 * the 7 DAYS badge and one candy. Signed in → "Claim my free week" redeems it (the Welcome to
 * Pro gift moment follows, ProWelcome.checkGift); a guest → "Sign up to claim" keeps the code
 * (JoinLandingRules.PENDING_KEY) and redeems it right after sign-in. Used / expired / not-found
 * / not-eligible states each get a cast scene + a candy, never a bare line. Mounted next to
 * ProWelcomeHost in MainActivity.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinLandingHost() {
    val code by DeepLinkRouter.referralCode.collectAsState()
    val isAuthed by AuthService.isAuthenticated.collectAsState()
    val scope = rememberCoroutineScope()

    // Signup attribution: a code kept from a link (opened while signed out / as a guest) is
    // redeemed once there's an account; any final answer clears it.
    LaunchedEffect(isAuthed, code) {
        if (!isAuthed || code != null) return@LaunchedEffect
        val pending = JoinLandingRules.normalize(SettingsPref.get(JoinLandingRules.PENDING_KEY, "")) ?: return@LaunchedEffect
        val (ok, reason) = ReferralService.redeem(pending)
        if (ok || JoinLandingRules.isFinal(reason)) SettingsPref.remove(JoinLandingRules.PENDING_KEY)
        if (ok) {
            AuthService.userId?.let { runCatching { AuthService.loadProfile(it) } }
            ProWelcome.checkGift()
        }
    }

    val c = code ?: return
    var status by remember(c) { mutableStateOf(Status.LOADING) }
    var inviter by remember(c) { mutableStateOf<String?>(null) }
    var claim by remember(c) { mutableStateOf<String?>(null) } // null | "busy" | "claimed" | "ineligible"
    LaunchedEffect(c) {
        val r = ReferralService.lookup(c)
        inviter = r?.second
        status = if (r == null) Status.NOT_FOUND else JoinLandingRules.status(r.first)
        if (status != Status.READY) SettingsPref.remove(JoinLandingRules.PENDING_KEY)
    }
    val close = { DeepLinkRouter.referralCode.value = null }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    SoftModalSheet(
        onDismissRequest = close, sheetState = sheet, dragHandle = null,
        containerColor = accentWash(GIFT_GOLD, 0.08f),
    ) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                claim == "claimed" -> JoinState(
                    R.drawable.art_scene_pro_crown, "Pro unlocked!", "7 days of Pro are yours. Enjoy every game, unlimited.",
                    "Start playing", CandyColor.AMBER, close,
                )
                claim == "ineligible" -> JoinState(
                    R.drawable.art_pose_r_cocoa, "Not eligible", "This gift is for players who haven't had Pro yet. Thanks for stopping by!",
                    "Go to Wordocious", CandyColor.PURPLE, close,
                )
                status == Status.LOADING -> JoinState(R.drawable.art_scene_gift_pro, "Opening your gift…", null, null, CandyColor.AMBER, close)
                status == Status.READY -> {
                    InviteCard(Modifier.fillMaxWidth(), accent = GIFT_GOLD, bar = MomentInk.proBar) {
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            SceneArtPop(R.drawable.art_scene_gift_pro, height = 120.dp)
                            InviteLettering(JoinLandingRules.headline(inviter), 22.sp)
                            SevenDaysBadge()
                            Text(
                                "Unlimited puzzles in every game, VS in every mode and the Pro look, free for a week.",
                                fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                            )
                            if (isAuthed) {
                                CandyButton(
                                    if (claim == "busy") "Claiming…" else "Claim my free week",
                                    onClick = {
                                        if (claim == "busy") return@CandyButton
                                        claim = "busy"
                                        scope.launch {
                                            val (ok, reason) = ReferralService.redeem(c)
                                            if (ok || JoinLandingRules.isFinal(reason)) SettingsPref.remove(JoinLandingRules.PENDING_KEY)
                                            claim = if (ok) "claimed" else if (reason == "network") null else "ineligible"
                                            if (ok) {
                                                AuthService.userId?.let { runCatching { AuthService.loadProfile(it) } }
                                                ProWelcome.checkGift()
                                            }
                                        }
                                    },
                                    color = CandyColor.AMBER, modifier = Modifier.fillMaxWidth(), fill = true, enabled = claim != "busy",
                                )
                            } else {
                                // A guest: the code waits (PENDING_KEY) and is redeemed right after sign-up.
                                CandyButton(
                                    "Sign up to claim", onClick = { close(); AuthService.exitGuest() },
                                    color = CandyColor.AMBER, modifier = Modifier.fillMaxWidth(), fill = true,
                                )
                            }
                        }
                    }
                }
                status == Status.USED -> JoinState(
                    R.drawable.art_scene_o3_notfound, "Already claimed", "Someone already used this gift. Ask your friend for a fresh one!",
                    "Go to Wordocious", CandyColor.PURPLE, close,
                )
                status == Status.EXPIRED -> JoinState(
                    R.drawable.art_scene_o3_notfound, "This gift expired", "Gift links last 30 days. Ask your friend for a fresh one!",
                    "Go to Wordocious", CandyColor.PURPLE, close,
                )
                else -> JoinState(
                    R.drawable.art_scene_o3_notfound, "Gift not found", "We couldn't find that invite. Check the link and try again.",
                    "Go to Wordocious", CandyColor.PURPLE, close,
                )
            }
        }
    }
}

@Composable
private fun JoinState(@DrawableRes art: Int, title: String, line: String?, cta: String?, color: CandyColor, onCta: () -> Unit) {
    InviteCard(Modifier.fillMaxWidth(), accent = if (color == CandyColor.AMBER) GIFT_GOLD else INVITE_ACCENT) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SceneArtPop(art, height = 112.dp)
            InviteLettering(title, 22.sp)
            if (line != null) {
                Text(line, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center)
            }
            if (cta != null) CandyButton(cta, onClick = onCta, color = color, modifier = Modifier.fillMaxWidth(), fill = true)
        }
    }
}
