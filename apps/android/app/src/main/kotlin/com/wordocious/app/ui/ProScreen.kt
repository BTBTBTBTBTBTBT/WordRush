package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.StoreManager
import com.wordocious.app.data.SubscriptionCopy
import com.wordocious.app.ui.theme.WTheme

/**
 * Pro / subscription screen — ports app/pro/page.tsx + iOS ProView (header,
 * benefits, monthly/yearly/day plans, active-Pro state, disclosure). Plan CTAs
 * launch Google Play Billing via data/StoreManager (prices come from Play when
 * available, falling back to the hardcoded US prices), plus Restore Purchases.
 *
 * FINISH_SPEC G1 (the finishing look): the GO PRO headline, then the gold card
 * family — W crowned with the golden star (`art_scene_pro_crown`) large on a gold
 * hero card with a gold top bar, the benefits as tinted rows with 3D icons, the plans
 * as tinted cards (selected = stronger tint + gold ring), ONE large amber candy CTA
 * for the selected plan, Restore as a soft peach candy button. No plain white.
 */
private val PRO_GOLD = Color(0xFFF5A524)

private data class Benefit(val text: String, val icon3d: Icon3DName? = null, @DrawableRes val art: Int? = null)

private val BENEFITS = listOf(
    Benefit("Ad-free experience — no interruptions, ever", Icon3DName.BADGE_CHECK),
    Benefit("Unlimited replays of every game mode, any time", art = R.drawable.game_practice),
    Benefit("VS mode on every game — challenge friends in every mode", art = R.drawable.game_vs),
    // AP: the bots are the cast now (BotCast) — not the old Easy / Medium / Hard tiers.
    Benefit("Battle all ten of the cast — climb the bot ladder in any mode, any time", art = R.drawable.art_scene_ladder_cleared),
    Benefit("Invite friends to private matches by link or username", Icon3DName.ADD_FRIEND),
    Benefit("4 streak shields credited each billing period", Icon3DName.SHIELD),
    Benefit("Pro badge on profile & leaderboards", Icon3DName.CROWN),
    Benefit("Extended stats — win rate trends & avg speed per mode", Icon3DName.TAB_STATS),
    Benefit("Early access to new game modes", Icon3DName.BELL),
)

/** Headings on the gold cards (fixed light ink; dark mode keeps the themed text). */
private val proInk: Color @Composable get() = if (WTheme.isDark) WTheme.text else FinishInk.heading
private val proMuted: Color @Composable get() = if (WTheme.isDark) WTheme.textSecondary else FinishInk.muted
private val proLabel: Color get() = Color(0xFF8A4A12)

@Composable
fun ProScreen(
    onDone: () -> Unit,
    /** 2.8 item 20: what the player reached for ("Pro mascot styles"); picks the benefit scene next to their mascot. null = the five scenes take turns. */
    reason: String? = null,
) {
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
    // AP: when this purchase brought up "Welcome to Pro", its "LET'S PLAY!" goes back to
    // where the player was — so the Pro page closes with it.
    val welcome by ProWelcome.showing.collectAsState()
    var sawWelcome by remember { mutableStateOf(false) }
    LaunchedEffect(welcome) {
        if (welcome != null) sawWelcome = true
        else if (sawWelcome) { sawWelcome = false; onDone() }
    }
    if (showAuth) {
        androidx.activity.compose.BackHandler { showAuth = false }
        // Google sign-in never calls onAuthenticated (AuthScreen.kt:315), so the
        // profile landing is what closes the overlay in that path.
        LaunchedEffect(profile) { if (profile != null) showAuth = false }
        AuthScreen(onAuthenticated = { showAuth = false })
        return
    }

    Column(
        Modifier.fillMaxSize().pageBackground(PageTint.HOME)
            .verticalScroll(rememberScrollState()),
    ) {
        // The header control (A3): the bare close X, no bubble.
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.End) {
            HeaderBackButton(onDone, close = true)
        }
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // A6 / N1: the GO PRO lettering as the page headline (the shared headline sizing).
            PageHeadline(TitleArt.GOPRO)
            ProHero(isPro = isPro, reason = reason)

            if (profile == null) {
                // Guest — Pro is account-based (the purchase must attach to an account).
                TintedCard(
                    PRO_GOLD, Modifier.fillMaxWidth(), bar = MomentInk.proBar,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    // No plain-text headings (founder): the PRO PERK lettering, the line under it.
                    HeadingArt(Heading.PROPERK, height = 40.dp, maxWidth = 260.dp, contentDescription = "Sign in to go Pro")
                    Text("Sign in to go Pro", fontSize = 15.sp, fontWeight = FontWeight.Black, color = proInk,
                        textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    Text(
                        "Create a free account or sign in first — Pro unlocks unlimited replays, VS on every mode, and more, tied to your account.",
                        fontSize = 13.sp, fontWeight = FontWeight.Bold, color = proMuted, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    CastButton(
                        "Sign in", onClick = { showAuth = true }, color = CastColor.GOLD, size = CastSize.L,
                        fill = true, modifier = Modifier.fillMaxWidth(),
                    )
                }
            } else if (isPro) {
                TintedCard(
                    PRO_GOLD, Modifier.fillMaxWidth(), bar = MomentInk.proBar,
                    tint = accentWash(PRO_GOLD, 0.16f),
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(
                        Modifier.align(Alignment.CenterHorizontally).clip(RoundedCornerShape(50))
                            .background(Brush.verticalGradient(listOf(Color(0xFFFFC56B), Color(0xFFF97316))))
                            .border(1.5.dp, Color(0xFFF5C542), RoundedCornerShape(50))
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon3D(Icon3DName.CROWN, 20.dp)
                        CandyLabel("ACTIVE PRO", 14.sp)
                    }
                    Text(
                        "You're enjoying all Pro benefits!", fontSize = 15.sp, fontWeight = FontWeight.Black,
                        color = proInk, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                    )
                    // BJ11: the member state carries the plan, its renewal, the branded
                    // Manage hand-off (then Play's page) and Restore Purchases.
                    Text(
                        ProIdentityText.renewalLine(profile?.proExpiresAt), fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                        color = proMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                    )
                    var manage by remember { mutableStateOf(false) }
                    if (manage) ManageSubscriptionHandoff(onDismiss = { manage = false })
                    CastButton(
                        "Manage subscription", onClick = { manage = true },
                        color = CastColor.GOLD, size = CastSize.L, fill = true, modifier = Modifier.fillMaxWidth(),
                    )
                    Text(
                        SubscriptionCopy.handoff(SubscriptionCopy.Store.GOOGLE).line, fontSize = 11.sp, fontWeight = FontWeight.Black,
                        color = if (WTheme.isDark) WTheme.textSecondary else proLabel, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    CandyButton(
                        "Restore Purchases", onClick = { StoreManager.restore() },
                        color = CandyColor.PEACH, size = CandySize.SMALL,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    )
                }
                BenefitsCard()
            } else {
                PlansContent()
            }
        }
    }

    // Purchase errors are a dismissible alert on every state of the screen, not
    // a line of red text inside the plan list (iOS ProView.swift:54).
    if (lastError != null) {
        androidx.compose.material3.AlertDialog(
            modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
            onDismissRequest = { StoreManager.clearError() },
            containerColor = accentWash(PRO_GOLD, 0.12f),
            title = { Text("Purchase issue", fontWeight = FontWeight.Black, color = proInk) },
            text = { Text(lastError ?: "", color = proMuted, fontWeight = FontWeight.Bold) },
            confirmButton = {
                CastButton("OK", onClick = { StoreManager.clearError() }, color = CastColor.GOLD, size = CastSize.M)
            },
        )
    }
}

/**
 * G1 the gold hero. Members keep W crowned with the golden star; FREE players (item 20) see their own mascot, alive, on the
 * spotlight pedestal with the scene of what they reached for ([reason]) or the five benefit scenes taking turns.
 */
@Composable
private fun ProHero(isPro: Boolean, reason: String?) {
    TintedCard(
        PRO_GOLD, Modifier.fillMaxWidth(), bar = MomentInk.proBar,
        tint = accentWash(PRO_GOLD, 0.15f),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (isPro) SceneArtPop(R.drawable.art_scene_pro_crown, height = 190.dp, glow = Color(0xFFFFE08A))
        else if (reason != null) ProScene(com.wordocious.core.StatsProfile.proBenefitForReason(reason), height = 180.dp)
        else ProSceneCarousel(height = 190.dp)
        Text(
            "Play unlimited & ad-free — every mode, any time",
            fontSize = 15.sp, fontWeight = FontWeight.Black, color = proInk, textAlign = TextAlign.Center,
            lineHeight = 1.25.em, modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** G1 the benefits: tinted gold rows (soft stripes) each led by a 3D icon. */
@Composable
private fun BenefitsCard() {
    FinishLabel("BENEFITS", Modifier.fillMaxWidth(), color = proLabel)
    TintedCard(
        PRO_GOLD, Modifier.fillMaxWidth(), bar = MomentInk.proBar,
        contentPadding = PaddingValues(0.dp), verticalArrangement = Arrangement.Top,
    ) {
        BENEFITS.forEachIndexed { i, b ->
            Row(
                Modifier.fillMaxWidth().stripedRow(i, PRO_GOLD).padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(30.dp).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
                    when {
                        b.icon3d != null -> Icon3D(b.icon3d, 28.dp)
                        b.art != null -> Image(painterResource(b.art), null, Modifier.size(28.dp))
                    }
                }
                Text(b.text, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = proInk, modifier = Modifier.weight(1f))
            }
        }
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
    // G1: the plans are selectable tinted cards; ONE amber CTA buys the selected plan.
    var plan by rememberSaveable { mutableStateOf(StoreManager.PRO_YEARLY) }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        LapsedCard()
        BenefitsCard()

        Spacer(Modifier.height(2.dp))
        FinishLabel("CHOOSE YOUR PLAN", Modifier.fillMaxWidth(), color = proLabel)
        PlanCard(
            "Yearly", prices[StoreManager.PRO_YEARLY] ?: "\$59.99", "/yr", "\$5/mo billed annually",
            selected = plan == StoreManager.PRO_YEARLY, best = true, enabled = !busy,
            onSelect = { plan = StoreManager.PRO_YEARLY },
        )
        PlanCard(
            "Monthly", prices[StoreManager.PRO_MONTHLY] ?: "\$6.99", "/mo", "Cancel anytime",
            selected = plan == StoreManager.PRO_MONTHLY, best = false, enabled = !busy,
            onSelect = { plan = StoreManager.PRO_MONTHLY },
        )

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 2.dp)) {
            Box(Modifier.weight(1f).height(1.5.dp).background(accentLine(PRO_GOLD)))
            Text("OR TRY IT FIRST", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textSecondary else proLabel, letterSpacing = 0.6.sp)
            Box(Modifier.weight(1f).height(1.5.dp).background(accentLine(PRO_GOLD)))
        }
        PlanCard(
            "Day Pass", prices[StoreManager.PRO_DAY] ?: "\$1", " / 24 hours", "One-time — does not renew",
            selected = plan == StoreManager.PRO_DAY, best = false, enabled = !busy,
            onSelect = { plan = StoreManager.PRO_DAY },
        )
        Text(
            "Eight day passes cost more than a month of Pro.",
            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = proMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )

        // A8: the large amber candy CTA for the selected plan.
        val processing = purchasingId != null
        CastButton(
            when {
                processing -> "Processing…"
                plan == StoreManager.PRO_YEARLY -> "Subscribe Yearly"
                plan == StoreManager.PRO_MONTHLY -> "Subscribe Monthly"
                else -> "Get 24 Hours of Pro"
            },
            onClick = { if (!busy) buy(plan) },
            color = CastColor.GOLD, size = CastSize.L, fill = true, enabled = !busy,
            leading = if (processing) {
                { CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.5.dp) }
            } else null,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        )
        CandyButton(
            "Restore Purchases", onClick = { StoreManager.restore() },
            color = CandyColor.PEACH, size = CandySize.MEDIUM,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        // Disclosure (Google Play wording for Android) — BJ11: the live Play prices.
        Text(
            SubscriptionCopy.playDisclosure(prices[StoreManager.PRO_MONTHLY] ?: "\$6.99", prices[StoreManager.PRO_YEARLY] ?: "\$59.99"),
            fontSize = 10.sp, color = proMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp),
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
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            InfoLinkChip("Terms of Service", PRO_GOLD) { open("https://wordocious.com/terms") }
            InfoLinkChip("Privacy Policy", PRO_GOLD) { open("https://wordocious.com/privacy") }
        }
    }
}

/** BJ11: a former member — W waves them back, with the day their Pro ended. */
@Composable
private fun LapsedCard() {
    val profile by AuthService.profile.collectAsState()
    val line = SubscriptionCopy.lapsedLine(profile?.proExpiresAt, AuthService.isProActive) ?: return
    TintedCard(
        PRO_GOLD, Modifier.fillMaxWidth().semantics(mergeDescendants = true) { }, bar = MomentInk.proBar,
        tint = accentWash(PRO_GOLD, 0.14f),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.Top,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CastPose(MascotId.W, "wave", 64.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Welcome back", fontSize = 15.sp, fontWeight = FontWeight.Black, color = proInk)
                Text(line, fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textSecondary else proLabel)
                Text(SubscriptionCopy.LAPSED_BODY, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = proMuted)
            }
        }
    }
}

/**
 * G1 a plan option: a tinted gold card with a gold top bar; selected = the stronger
 * tint, a 2 dp gold border and a soft gold ring, plus a filled check. Tapping selects
 * it (TalkBack: a radio button). The price is a soft number (A2).
 */
@Composable
private fun PlanCard(
    title: String, price: String, unit: String, note: String,
    selected: Boolean, best: Boolean, enabled: Boolean, onSelect: () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    val dark = WTheme.isDark
    Box(Modifier.fillMaxWidth().padding(top = if (best) 8.dp else 0.dp)) {
        Row(
            Modifier.fillMaxWidth()
                .squishClickable("$title plan, $price$unit, $note", role = Role.RadioButton, enabled = enabled, onClick = onSelect)
                .semantics { this.selected = selected }
                .shadow(if (selected) 6.dp else 3.dp, shape, clip = false, ambientColor = PRO_GOLD.copy(alpha = 0.25f), spotColor = PRO_GOLD.copy(alpha = 0.35f))
                .clip(shape)
                .background(if (dark) WTheme.surface else Wash.mix(PRO_GOLD, if (selected) Wash.SELECTED else Wash.CARD))
                .drawWithContent {
                    drawContent()
                    drawRect(Brush.horizontalGradient(listOf(Color(0xFFFFD66B), PRO_GOLD, Color(0xFFE8901A))), Offset.Zero, Size(size.width, 6.dp.toPx()))
                }
                // BI25: no outline — the selected plan takes the deeper wash + stronger glow.
                .padding(start = 16.dp, end = 14.dp, top = 16.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title.uppercase(), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.1.em,
                    color = if (dark) WTheme.textSecondary else proLabel)
                Row(verticalAlignment = Alignment.Bottom) {
                    SoftNumber(price, 30.sp)
                    Text(unit, fontSize = 14.sp, fontWeight = FontWeight.Black, color = proMuted, modifier = Modifier.padding(bottom = 4.dp))
                }
                Text(note, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = proMuted)
            }
            PlanCheck(selected)
        }
        if (best) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(end = 18.dp).offset(y = (-9).dp)
                    .clip(RoundedCornerShape(50))
                    .background(Brush.verticalGradient(listOf(Color(0xFFF472B6), Color(0xFFA21CAF))))
                    .border(1.dp, Color(0xFFF5C542), RoundedCornerShape(50))
                    .padding(horizontal = 10.dp, vertical = 3.dp)
                    .clearAndSetSemantics { },
            ) { CandyLabel("BEST VALUE", 10.sp) }
        }
    }
}

/** The selection mark: a filled gold circle with a check when selected, an empty ring otherwise. */
@Composable
private fun PlanCheck(selected: Boolean, size: Dp = 26.dp) {
    Box(
        Modifier.size(size).clip(CircleShape)
            .background(if (selected) Brush.verticalGradient(listOf(Color(0xFFFFC56B), Color(0xFFF97316))) else Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent)))
            .border(2.dp, if (selected) Color(0xFFF5C542) else accentLine(PRO_GOLD, 0.5f), CircleShape)
            .clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        if (selected) Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(16.dp))
    }
}
