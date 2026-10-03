package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

// FINISH_SPEC C6 (founder-approved 2026-10-02): the footer / info pages — How to Play,
// Guides, Strategy, Words, FAQ, Privacy, Terms (and About / Support) — share ONE layout:
// the soft 3D back + help controls, the page's OWN title art at the shared footer
// height, a lavender intro card (purple → pink bar: a bold line + a short muted line),
// then tinted cards with top bars (game guides in each game's color with the game
// icon, FAQ as question cards, Privacy / Terms as section cards). Visual reference:
// finishing-touches.html (`.guidecard`, `.tsheet`).

/** The page side padding. */
internal val INFO_PAGE_PAD: Dp = 12.dp

/** C6 the info pages' fixed inks (dark mode keeps the themed text). */
internal object InfoInk {
    val heading: Color @Composable get() = if (WTheme.isDark) WTheme.text else FinishInk.heading
    val body: Color @Composable get() = if (WTheme.isDark) WTheme.textSecondary else Color(0xFF4B3D66)
    val muted: Color @Composable get() = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted
}

/** The intro card's purple → pink bar (the mockup's Guides intro). */
internal val INFO_INTRO_BAR: Brush get() = Brush.horizontalGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899)))

/**
 * C6 THE info page: a scrolling column on the Home wallpaper with the controls row
 * (back on the left, help on the right — both bare soft 3D icons that squish), then
 * the title ([art] at the shared footer height via [FooterHeadline]; [pageHeadline]
 * uses the full-width [PageHeadline] instead — Word of the Day; no art = [title] as a
 * caps heading), then the [intro] card when given, then [content].
 *
 * Help opens the info menu; a page picked there opens over this one (back returns).
 */
@Composable
fun InfoPage(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    art: TitleArt? = null,
    pageHeadline: Boolean = false,
    backLabel: String = "Back",
    intro: Pair<String, String?>? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    var menuOpen by rememberSaveable { mutableStateOf(false) }
    var nested by rememberSaveable { mutableStateOf<String?>(null) }
    nested?.let { route ->
        androidx.activity.compose.BackHandler { nested = null }
        InfoRouteScreen(route, onDone = { nested = null })
        return
    }
    Column(
        modifier.fillMaxSize().pageBackground(PageTint.HOME)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = INFO_PAGE_PAD).padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            SoftControl(Icon3DName.BACK, backLabel, onBack)
            Spacer(Modifier.weight(1f))
            SoftControl(Icon3DName.HELP, "Help", { menuOpen = true })
        }
        when {
            art != null && pageHeadline -> PageHeadline(art)
            art != null -> FooterHeadline(art)
            else -> Box(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp), contentAlignment = Alignment.Center) {
                PageTitleText(title, fontSize = 24.sp, maxLines = 3)
            }
        }
        if (intro != null) InfoIntroCard(intro.first, intro.second)
        content()
    }
    if (menuOpen) InfoMenuSheet(onNav = { menuOpen = false; nested = it }, onDismiss = { menuOpen = false })
}

/** The info routes the help menu can open over a page (MainScreen's own table, mirrored). */
@Composable
fun InfoRouteScreen(route: String, onDone: () -> Unit) {
    when (route) {
        "help" -> HowToPlayScreen(onDone = onDone)
        "faq" -> HelpScreen(onDone = onDone, initialTab = 2, showTabs = false)
        "guides" -> GuidesIndexScreen(onDone = onDone)
        "strategy" -> StrategyScreen(onDone = onDone)
        "words" -> WordsScreen(onDone = onDone)
        "pastwords" -> WordsScreen(onDone = onDone, navTitle = "Word of the Day")
        else -> InfoScreen(kind = route, onDone = onDone)
    }
}

/**
 * C6 the intro card: the lavender card (#f5eeff, line #e2d3ff) with the purple → pink
 * top bar — a bold [title] over a short muted [line].
 */
@Composable
fun InfoIntroCard(title: String, line: String?, modifier: Modifier = Modifier) {
    val dark = WTheme.isDark
    TintedCard(
        Color(0xFF7C3AED), modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
        bar = INFO_INTRO_BAR,
        tint = if (dark) WTheme.surface else FinishInk.lavender,
        line = if (dark) WTheme.border else FinishInk.lavenderLine,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = InfoInk.heading)
        if (line != null) Text(line, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted, lineHeight = 1.35.em)
    }
}

/**
 * C6 a section card: a tinted card in [accent] with its top bar, an optional bold
 * [title] (a heading for TalkBack), then [content].
 */
@Composable
fun InfoSectionCard(
    accent: Color,
    modifier: Modifier = Modifier,
    title: String? = null,
    leading: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    TintedCard(
        accent, modifier.fillMaxWidth(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (title != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                leading?.invoke()
                Text(
                    title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = InfoInk.heading,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
            }
        }
        content()
    }
}

/**
 * C6 a tappable row card (the mockup's `.guidecard`): a tinted card in [accent] with
 * its top bar, the [icon] (≈40 dp) beside a bold [title] and a small muted [subtitle],
 * squishing on press (A9).
 */
@Composable
fun InfoGuideCard(
    accent: Color,
    title: String,
    subtitle: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kicker: String? = null,
    icon: @Composable BoxScope.() -> Unit,
) {
    TintedCard(
        accent,
        modifier.fillMaxWidth().squishClickable(
            listOfNotNull(kicker, title, subtitle).joinToString(", "), onClick = onClick,
        ),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(44.dp), contentAlignment = Alignment.Center, content = icon)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                if (kicker != null) {
                    Text(kicker, fontSize = 9.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em, color = darkenInk(accent))
                }
                Text(title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = InfoInk.heading)
                if (subtitle != null) Text(subtitle, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted)
            }
        }
    }
}

/** An icon tile as a mini game card (A1) in [accent], [size] square. */
@Composable
fun InfoIconTile(accent: Color, size: Dp = 40.dp, content: @Composable BoxScope.() -> Unit) {
    Box(Modifier.size(size).miniGameCard(accent, size / 4), contentAlignment = Alignment.Center, content = content)
}

/** A body paragraph on an info card. */
@Composable
fun InfoBody(text: String, modifier: Modifier = Modifier) {
    Text(text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = InfoInk.body, lineHeight = 1.45.em, modifier = modifier)
}

/** A bulleted line (accent dot) on an info card. */
@Composable
fun InfoBullet(accent: Color, content: @Composable () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.padding(top = 7.dp).size(6.dp).background(accent, RoundedCornerShape(50)))
        Box(Modifier.weight(1f)) { content() }
    }
}

/**
 * A navigation link as a tinted chip (A1 + A9): the [accent] wash, its line, caps
 * [label], the squish. Footer / legal links (navigation, not actions — A8).
 */
@Composable
fun InfoLinkChip(label: String, accent: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier.squishClickable(label, role = Role.Button, onClick = onClick)
            .heightIn(min = 32.dp)
            // Founder rule: no outlined boxes — a soft filled chip only.
            .background(accentWash(accent, 0.16f), shape)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label.uppercase(), fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.06.em,
            color = if (WTheme.isDark) WTheme.textSecondary else darkenInk(accent), maxLines = 1, softWrap = false,
            textAlign = TextAlign.Center,
        )
    }
}
