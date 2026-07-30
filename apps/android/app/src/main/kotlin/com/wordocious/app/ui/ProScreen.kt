package com.wordocious.app.ui

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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.StoreManager
import com.wordocious.app.ui.theme.WTheme

/**
 * Pro / subscription screen — ports app/pro/page.tsx + iOS ProView (header,
 * benefits, monthly/yearly/day plans, active-Pro state, disclosure). Plan CTAs
 * launch Google Play Billing via data/StoreManager (prices come from Play when
 * available, falling back to the hardcoded US prices), plus Restore Purchases.
 */
private val GOLD = Color(0xFFD97706)

private data class Benefit(val icon: ImageVector?, val asset: Int?, val text: String)

private val BENEFITS = listOf(
    Benefit(Icons.Filled.VisibilityOff, null, "Ad-free experience — no interruptions, ever"),
    Benefit(null, R.drawable.ic_wordle_grid, "Unlimited replays of all 9 game modes, any time"),
    Benefit(null, R.drawable.ic_swords, "VS mode on every game — challenge friends in all 9 modes"),
    Benefit(Icons.Filled.Bolt, null, "Practice against the CPU — Easy, Medium & Hard bots, anytime"),
    Benefit(Icons.Filled.Mail, null, "Invite friends to private matches by link or username"),
    Benefit(null, R.drawable.ic_shield, "4 streak shields credited each billing period"),
    Benefit(Icons.Filled.Star, null, "Pro badge on profile & leaderboards"),
    Benefit(Icons.Filled.Insights, null, "Extended stats — win rate trends & avg speed per mode"),
    Benefit(Icons.Filled.Bolt, null, "Early access to new game modes"),
)

@Composable
fun ProScreen(onDone: () -> Unit) {
    val profile by AuthService.profile.collectAsState()
    // isProActive, not raw isPro — a lapsed subscriber (is_pro still true, no
    // server sweep yet) otherwise saw "You're enjoying all Pro benefits!" with
    // no way to resubscribe. Every other gate already uses isProActive.
    val isPro = AuthService.isProActive
    val lastError by StoreManager.lastError.collectAsState()
    // iOS presents AuthView as a SHEET over ProView (ProView.swift:59), so a
    // guest who signs in lands back on the plan list. Overlay it here for the
    // same result instead of leaving guest mode and tearing the paywall down.
    var showAuth by remember { mutableStateOf(false) }
    if (showAuth) {
        androidx.activity.compose.BackHandler { showAuth = false }
        // Google sign-in never calls onAuthenticated (AuthScreen.kt:315), so the
        // profile landing is what closes the overlay in that path.
        LaunchedEffect(profile) { if (profile != null) showAuth = false }
        AuthScreen(onAuthenticated = { showAuth = false })
        return
    }

    Column(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(WTheme.bg, WTheme.surfaceHover)))
            .verticalScroll(rememberScrollState()),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Close", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.primary, modifier = Modifier.weight(1f).clickableNoRipple(onDone))
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            // Header
            Icon(painterResource(R.drawable.ic_crown), null, tint = GOLD, modifier = Modifier.size(54.dp))
            Spacer(Modifier.height(6.dp))
            Text("Go Pro", fontSize = 36.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(
                "Play unlimited & ad-free — all 9 modes, any time",
                fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))

            if (profile == null) {
                // Guest — Pro is account-based (the purchase must attach to an account).
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Sign in to go Pro", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    Text(
                        "Create a free account or sign in first — Pro unlocks unlimited replays, VS on every mode, and more, tied to your account.",
                        fontSize = 13.sp, color = WTheme.textMuted, textAlign = TextAlign.Center,
                    )
                    Box(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.primary)
                            .clickableNoRipple { showAuth = true }.padding(vertical = 13.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text("Sign in", color = Color.White, fontWeight = FontWeight.Black, fontSize = 15.sp) }
                }
            } else if (isPro) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                        .border(1.5.dp, Color(0xFFFDE68A), RoundedCornerShape(16.dp)).padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(
                        Modifier.clip(RoundedCornerShape(50)).background(Brush.linearGradient(listOf(Color(0xFFF59E0B), GOLD))).padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(painterResource(R.drawable.ic_crown), null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Text("ACTIVE PRO", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                    Text("You're enjoying all Pro benefits!", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            } else {
                PlansContent()
            }
        }
    }

    // Purchase errors are a dismissible alert on every state of the screen, not
    // a line of red text inside the plan list (iOS ProView.swift:54).
    if (lastError != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { StoreManager.clearError() },
            title = { Text("Purchase issue", fontWeight = FontWeight.Black) },
            text = { Text(lastError ?: "") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { StoreManager.clearError() }) {
                    Text("OK", color = WTheme.primary, fontWeight = FontWeight.Black)
                }
            },
        )
    }
}

@Composable
private fun PlansContent() {
    val activity = LocalContext.current as? android.app.Activity
    val prices by StoreManager.prices.collectAsState()
    val purchasingId by StoreManager.purchasingId.collectAsState()
    // While a Play billing flow is in flight every CTA is inert, so a second
    // billing intent can't be launched on top of it (iOS `.disabled(purchasingId != nil)`).
    val busy = purchasingId != null
    fun buy(id: String) { activity?.let { StoreManager.purchase(it, id) } }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("BENEFITS")
        BENEFITS.forEach { BenefitRow(it) }

        Spacer(Modifier.height(4.dp))
        SectionHeader("CHOOSE YOUR PLAN")
        PlanCard(
            "Monthly", prices[StoreManager.PRO_MONTHLY] ?: "\$6.99", "/mo", "Cancel anytime",
            listOf(Color(0xFF7C3AED), Color(0xFF6D28D9)), best = false,
            cta = if (purchasingId == StoreManager.PRO_MONTHLY) "Processing…" else "Subscribe Monthly",
            loading = purchasingId == StoreManager.PRO_MONTHLY, enabled = !busy,
            onClick = { buy(StoreManager.PRO_MONTHLY) },
        )
        PlanCard(
            "Yearly", prices[StoreManager.PRO_YEARLY] ?: "\$59.99", "/yr", "\$4.99/mo billed annually",
            listOf(Color(0xFFF59E0B), GOLD), best = true,
            cta = if (purchasingId == StoreManager.PRO_YEARLY) "Processing…" else "Subscribe Yearly",
            loading = purchasingId == StoreManager.PRO_YEARLY, enabled = !busy,
            onClick = { buy(StoreManager.PRO_YEARLY) },
        )

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 6.dp)) {
            Box(Modifier.weight(1f).height(1.dp).background(WTheme.border))
            Text("OR TRY IT FIRST", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted, letterSpacing = 0.5.sp)
            Box(Modifier.weight(1f).height(1.dp).background(WTheme.border))
        }
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                .clickableNoRipple { if (!busy) buy(StoreManager.PRO_DAY) }
                .alpha(if (busy) 0.6f else 1f).padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (purchasingId == StoreManager.PRO_DAY) {
                CircularProgressIndicator(Modifier.size(16.dp), color = WTheme.primary, strokeWidth = 2.dp)
            }
            Text(
                if (purchasingId == StoreManager.PRO_DAY) "Processing…"
                else "Just today — ${prices[StoreManager.PRO_DAY] ?: "\$1"} for 24 hours of Pro →",
                fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
            )
        }
        Text(
            "Eight day passes cost more than a month of Pro.",
            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "Restore Purchases",
            fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.primary, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp).clickableNoRipple { StoreManager.restore() },
        )
        // Disclosure (Google Play wording for Android).
        Text(
            "Monthly ($6.99) and Yearly ($59.99) are auto-renewing subscriptions billed through Google Play. Payment is charged to your Google account at confirmation. Subscriptions renew automatically unless cancelled at least 24 hours before the period ends; manage or cancel in Google Play → Subscriptions. The Day Pass is a one-time 24-hour purchase and does not renew.",
            fontSize = 10.sp, color = WTheme.textMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp),
        )
        // Terms / Privacy links under the disclosure (iOS ProView.swift:153) —
        // Play's subscription policy expects them on the purchase surface too.
        val context = LocalContext.current
        fun open(url: String) {
            runCatching {
                context.startActivity(
                    android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                )
            }
        }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Terms of Service", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple { open("https://wordocious.com/terms") },
            )
            Text("·", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(
                "Privacy Policy", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple { open("https://wordocious.com/privacy") },
            )
        }
    }
}

@Composable
private fun SectionHeader(t: String) {
    Text(t, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted, letterSpacing = 1.1.sp)
}

@Composable
private fun BenefitRow(b: Benefit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            if (b.asset != null) Icon(painterResource(b.asset), null, tint = GOLD, modifier = Modifier.size(20.dp))
            else b.icon?.let { Icon(it, null, tint = GOLD, modifier = Modifier.size(20.dp)) }
        }
        Text(b.text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun PlanCard(
    title: String, price: String, unit: String, note: String, gradient: List<Color>, best: Boolean, cta: String,
    loading: Boolean = false, enabled: Boolean = true, onClick: () -> Unit = {},
) {
    Box {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, if (best) Color(0xFFFDE68A) else WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(price, fontSize = 30.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(unit, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(bottom = 4.dp))
            }
            Text(note, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(bottom = 8.dp))
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(gradient))
                    .clickableNoRipple { if (enabled) onClick() }
                    .alpha(if (enabled) 1f else 0.6f).padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                Text(cta, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }
        if (best) {
            Text(
                "BEST VALUE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                modifier = Modifier.align(Alignment.TopEnd).padding(end = 16.dp).offset(y = (-10).dp)
                    .clip(RoundedCornerShape(50)).background(Brush.horizontalGradient(gradient)).padding(horizontal = 10.dp, vertical = 2.dp),
            )
        }
    }
}
