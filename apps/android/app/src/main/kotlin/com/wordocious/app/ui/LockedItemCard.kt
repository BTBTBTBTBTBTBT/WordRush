package com.wordocious.app.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.MascotAvatars
import com.wordocious.core.AvatarAccessContext
import com.wordocious.core.AvatarAccessTable
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarPart
import com.wordocious.core.AvatarPartAccess

// Mascot item gating (docs/cloud-prompts/11, docs/design/brand/avatar/UNLOCKS-AND-SHOP.md; core AvatarAccess):
// the "Locked" card Save shows when the look wears a part the player can't save yet. Shown only while
// AvatarAccessConfig.ITEM_GATING is on (OFF): every part can be tried on; Save lists the ways to get the
// first locked one (earn · Pro · buy · season, the core order), or saves the look without the locked parts.

private val LOCK_PURPLE = Color(0xFF6D28D9)

/** The bundled access table (assets/avatar-access.json), loaded into MascotBuilderLogic only while the flag is on. */
internal fun loadAvatarAccess(context: Context) {
    if (!com.wordocious.core.AvatarAccessConfig.ITEM_GATING || MascotBuilderLogic.accessTable != null) return
    val text = runCatching { context.assets.open("avatar-access.json").bufferedReader().use { it.readText() } }.getOrNull()
    MascotBuilderLogic.accessTable = AvatarAccessTable.parse(text)
}

/**
 * The signed-in player's access context for the maker, or null while gating is off (then nothing changes):
 * [isPro], their profile stats (level, current_streak, best_streak, best_daily_login_streak), [achievements] when the
 * screen has loaded them (null otherwise — earn-by-achievement routes then read as not met), and the SAVED look.
 * Owned items: none yet — TODO load my_owned_items (docs/sql/20261010-owned-items.sql, not applied).
 */
internal fun ownAccessContext(isPro: Boolean, achievements: Collection<String>?): AvatarAccessContext? {
    if (!MascotBuilderLogic.gatingOn()) return null
    val p = AuthService.profile.value
    val stats = p?.let { MascotBuilderLogic.earnStats(it.level, it.currentStreak, it.bestStreak, it.bestDailyLoginStreak, achievements) }
    val saved = runCatching { MascotAvatars.ownConfig(p) }.getOrNull()
    return MascotBuilderLogic.accessContext(isPro = isPro, stats = stats, saved = saved, owned = emptyList())
}

/**
 * The Locked card. [part] is the first locked part of [look] (the mascot shown wearing it: try-on), [access] its
 * core access (the routes), [moreLocked] how many other worn parts are locked too. [onGoPro] opens the maker's
 * existing Go Pro flow; [onSaveWithout] saves the look with the locked parts reverted (core enforce);
 * [onKeepTrying] just closes the card.
 */
@Composable
fun LockedItemCard(
    part: AvatarPart,
    access: AvatarPartAccess,
    look: AvatarConfig,
    initial: String,
    moreLocked: Int,
    onGoPro: () -> Unit,
    onSaveWithout: () -> Unit,
    onKeepTrying: () -> Unit,
) {
    val rows = remember(access) { MascotBuilderLogic.lockedRows(access) }
    var buyNote by remember { mutableStateOf(false) }
    val name = MascotBuilderLogic.fallbackName(BuilderOption(part.field, part.id))
    androidx.compose.ui.window.Dialog(onDismissRequest = onKeepTrying) {
        val shape = RoundedCornerShape(26.dp)
        Column(
            PopupWidth.fillMaxWidth()
                .shadow(10.dp, shape, clip = false)
                .clip(shape)
                .background(if (WTheme.isDark) WTheme.bg else Color(0xFFF7F2FF))
                .border(1.5.dp, Color(0xFFD8C8FA), shape)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Locked", fontSize = 22.sp, fontWeight = FontWeight.Black, color = LOCK_PURPLE,
                modifier = Modifier.semantics { heading() },
            )
            // TODO(art): the ChatGPT lock illustration (future asset `art-lock-card` → res/drawable-nodpi/art_lock_card.webp:
            // the cast member peeking at the item behind a velvet rope). Until it ships: a rounded slot with the lock icon.
            Box(
                Modifier.size(84.dp).clip(RoundedCornerShape(20.dp)).background(Color(0xFFEAE2FA)).clearAndSetSemantics { },
                contentAlignment = Alignment.Center,
            ) {
                Icon3D(Icon3DName.LOCK, 44.dp)
            }
            // The mascot wearing it (the live try-on look).
            Box(Modifier.semantics { contentDescription = "Your mascot wearing $name" }) {
                MascotAvatar(config = look, initial = initial, size = 120.dp)
            }
            Text(
                "$name looks great on you! To save it:", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                color = if (WTheme.isDark) WTheme.text else Color(0xFF3B1A78), textAlign = TextAlign.Center,
            )
            rows.forEach { row ->
                when (row.kind) {
                    // TODO(IAP): no Play Billing yet — the buy route is a stub (one owned_items ledger across platforms later).
                    "buy" -> CandyButton(row.text, onClick = { buyNote = true }, color = CandyColor.TEAL, size = CandySize.MEDIUM, fill = true)
                    "pro" -> CandyButton(row.text, onClick = onGoPro, color = CandyColor.AMBER, size = CandySize.MEDIUM, fill = true)
                    "earn" -> Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(row.text, fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else LOCK_PURPLE)
                        row.progress?.let { p ->
                            LinearProgressIndicator(
                                progress = { p },
                                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)),
                                color = Color(0xFF7C3AED), trackColor = Color(0xFFE4D9FB),
                            )
                        }
                    }
                    else -> Text(row.text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center)
                }
            }
            if (buyNote) {
                Text("Purchases are coming soon", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center)
            }
            if (moreLocked > 0) {
                Text(
                    "+ $moreLocked more locked ${if (moreLocked == 1) "item" else "items"} in this look", fontSize = 11.sp,
                    fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                )
            }
            CandyButton("Save without it", onClick = onSaveWithout, color = CandyColor.PURPLE, size = CandySize.MEDIUM, fill = true,
                modifier = Modifier.padding(top = 4.dp))
            CandyButton("Keep trying on", onClick = onKeepTrying, color = CandyColor.PEACH, size = CandySize.SMALL)
        }
    }
}
