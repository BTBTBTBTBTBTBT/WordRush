package com.wordocious.app.ui

import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.wordocious.app.R
import com.wordocious.app.data.AchievementService.AchievementDef
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig

/** Founder 10-05 "T1 Title Shelves": the shelves in order (catalog category → label). iOS TitleShelfRules parity. */
internal object TitleShelfRules {
    val shelves = listOf(
        "skill" to "Skill", "consistency" to "Streaks", "beginner" to "Firsts", "puzzles" to "Puzzles",
        "social" to "VS", "friends" to "Friends", "collection" to "Medals", "mascot" to "Mascot",
        "pocket" to "Pocket", "bots" to "Bots", "streaks" to "Time of day", "seasonal" to "Seasonal",
    )
    fun recent(defs: List<AchievementDef>, dates: Map<String, String>, limit: Int = 8): List<AchievementDef> =
        defs.filter { dates.containsKey(it.key) }.sortedByDescending { dates[it.key] ?: "" }.take(limit)
}

/**
 * The featured-title picker (iOS TitleShelvesView / web title-shelves parity): a live name plate (your
 * mascot, name and the gold ribbon), search, Recently earned, then one shelf per category with its count
 * ("13 / 94"); locked titles dimmed and say how to earn them. Badge art = art_ach_<key>; shelf, plaque,
 * lock and PICK YOUR TITLE lettering = ChatGPT art.
 */
@Composable
fun TitleShelvesDialog(
    username: String,
    mascot: AvatarConfig,
    initial: String,
    accent: Color,
    catalog: List<AchievementDef>,
    unlockedDates: Map<String, String>,
    selected: String?,
    onDismiss: () -> Unit,
    onPick: (String?) -> Unit,
) {
    var pick by remember { mutableStateOf(selected) }
    var query by remember { mutableStateOf("") }
    var hint by remember { mutableStateOf("Tap a badge to try it on.") }
    var hop by remember { mutableIntStateOf(0) }
    val visible = catalog.filter { !it.hidden }
    fun earned(d: AchievementDef) = unlockedDates.containsKey(d.key)
    fun matches(d: AchievementDef) = query.isBlank() || d.name.contains(query.trim(), ignoreCase = true)
    val ink = if (WTheme.isDark) WTheme.text else Color(0xFF2A1650)
    val labelInk = if (WTheme.isDark) WTheme.textSecondary else Color(0xFF6D28D9)
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Column(Modifier.fillMaxSize().background(if (WTheme.isDark) WTheme.bg else Color(0xFFF6F0FF)).statusBarsPadding().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(StageMetrics.sideSlot), contentAlignment = Alignment.CenterStart) {
                    StageCloseButton(onStage = false, modifier = Modifier.offset(x = (-6).dp), onClick = onDismiss)
                }
                // The lettering fits between the side slots (scales down on a narrow phone instead of running under DONE).
                Box(Modifier.weight(1f).padding(horizontal = 2.dp), contentAlignment = Alignment.Center) {
                    androidx.compose.foundation.Image(
                        androidx.compose.ui.res.painterResource(R.drawable.art_dress_title), "Pick your title",
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit, modifier = Modifier.fillMaxWidth().height(30.dp),
                    )
                }
                Box(Modifier.width(StageMetrics.sideSlot), contentAlignment = Alignment.CenterEnd) {
                    CastButton("Done", onClick = { onPick(pick) }, color = CastColor.PURPLE, size = CastSize.S)
                }
            }
            // The live name plate.
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp).clip(RoundedCornerShape(20.dp))
                    .background(Brush.linearGradient(listOf(Color.White.copy(alpha = if (WTheme.isDark) 0.08f else 0.8f), Color(0x99EDE9FE))))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LiveMascot(mascot, initial, 78.dp, hopToken = hop)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(username, fontSize = 20.sp, fontWeight = FontWeight.Black, color = accent, maxLines = 1)
                    val name = pick?.let { k -> catalog.firstOrNull { it.key == k }?.name }
                    TitleRibbon(name ?: "No title", height = 26.dp, maxWidth = 230.dp, placeholder = name == null)
                    Text(hint, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7A6AA6), maxLines = 2)
                }
                if (pick != null) Text(
                    "None", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED),
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0x1A7C3AED))
                        .squishClickable(label = "Wear no title") { pick = null; hint = "No title for now." }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
            // Search (a soft filled capsule, never outlined).
            Box(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(top = 8.dp).clip(RoundedCornerShape(50))
                    .background(Color.White.copy(alpha = if (WTheme.isDark) 0.08f else 0.8f)).padding(horizontal = 14.dp, vertical = 9.dp),
            ) {
                if (query.isEmpty()) Text("Search your titles", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF8B7FB3))
                BasicTextField(query, { query = it }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    textStyle = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = ink, fontFamily = Nunito))
            }
            LazyColumn(Modifier.fillMaxWidth().weight(1f), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 30.dp)) {
                val recent = TitleShelfRules.recent(visible, unlockedDates).filter(::matches)
                if (recent.isNotEmpty()) item { Shelf("Recently earned", null, recent, pick, ::earned, labelInk, ink) { d -> if (!earned(d)) hint = "Locked · ${d.description.ifBlank { "Keep playing" }}" else { pick = d.key; hint = d.description; hop++ } } }
                TitleShelfRules.shelves.forEach { (id, label) ->
                    val all = visible.filter { it.category == id }
                    val list = (all.filter(::earned) + all.filterNot(::earned)).filter(::matches)
                    if (list.isNotEmpty()) item(key = id) {
                        Shelf(label, "${all.count(::earned)} / ${all.size}", list, pick, ::earned, labelInk, ink) { d ->
                            if (!earned(d)) hint = "Locked · ${d.description.ifBlank { "Keep playing" }}" else { pick = d.key; hint = d.description; hop++ }
                        }
                    }
                }
                if (visible.isEmpty()) item {
                    // Never a bare screen: the bundled catalog makes this rare (a broken install / cache).
                    Column(Modifier.fillMaxWidth().padding(top = 30.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CastPose(MascotId.D, "skeptic", 70.dp)
                        Text("Your titles are on their way", fontSize = 14.sp, fontWeight = FontWeight.Black, color = ink)
                    }
                } else if (visible.none(::matches)) item {
                    Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        CastPose(MascotId.D, "skeptic", 70.dp)
                        Text("No title matches \"$query\"", fontSize = 13.sp, fontWeight = FontWeight.Black, color = ink)
                    }
                }
            }
        }
    }
}

@Composable
private fun Shelf(
    label: String, count: String?, list: List<AchievementDef>, pick: String?, earned: (AchievementDef) -> Boolean,
    labelInk: Color, ink: Color, onTap: (AchievementDef) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(top = 10.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = labelInk, modifier = Modifier.weight(1f))
            if (count != null) Box(contentAlignment = Alignment.Center) {
                StageArt(R.drawable.art_dress_plaque, 22.dp, width = 64.dp)
                Text(count, fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C2D12))
            }
        }
        LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
            items(list, key = { it.key }) { d ->
                val e = earned(d); val on = pick == d.key
                Column(
                    Modifier.width(66.dp).squishClickable(label = d.name + if (e) "" else ", locked. ${d.description}") { onTap(d) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    AchievementBadge(d.icon, 50.dp, unlocked = e, glow = if (on) Color(0xFFF59E0B) else Color(0xFF7C3AED), key = d.key, category = d.category,
                        modifier = Modifier.graphicsLayer { scaleX = if (on) 1.08f else 1f; scaleY = scaleX })
                    Text(d.name, fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2, textAlign = TextAlign.Center, lineHeight = 11.sp,
                        color = if (on) Color(0xFFB45309) else if (e) ink else Color(0xFFA99CCF), modifier = Modifier.height(26.dp))
                }
            }
        }
        // The shelf ledge (ChatGPT art, three slices so it spans any width).
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp).height(16.dp)) {
            StageArt(R.drawable.art_dress_shelf_l, 16.dp)
            androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(R.drawable.art_dress_shelf_m), null,
                contentScale = androidx.compose.ui.layout.ContentScale.FillBounds, modifier = Modifier.weight(1f).height(16.dp))
            StageArt(R.drawable.art_dress_shelf_r, 16.dp)
        }
    }
}
