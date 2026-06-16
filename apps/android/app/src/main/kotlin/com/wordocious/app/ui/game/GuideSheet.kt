package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.GuideService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode

/**
 * In-game help sheet — renders one mode's strategy guide (facts / How it works /
 * How scoring works / Strategy), fetched from the web. ModalBottomSheet gives the
 * drag handle + swipe-down-to-close for free.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuideSheet(mode: GameMode, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var guide by remember(mode) { mutableStateOf<GuideService.ModeGuide?>(null) }
    LaunchedEffect(mode) { guide = GuideService.guide(mode) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = WTheme.bg) {
        val g = guide
        if (g == null) {
            Box(Modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WTheme.primary)
            }
        } else {
            val accent = runCatching { Color(android.graphics.Color.parseColor(g.accent)) }.getOrDefault(WTheme.primary)
            Column(
                Modifier.fillMaxWidth().heightIn(max = 620.dp).verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp).padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        g.title.uppercase(), fontSize = 26.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
                        style = androidx.compose.ui.text.TextStyle(
                            brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                                com.wordocious.app.ui.modeTitleGradient(mode),
                            ),
                        ),
                    )
                    Text(g.tagline, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                // Quick facts — 2-col chips
                g.facts.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { f ->
                            Column(
                                Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
                                    .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                            ) {
                                Text(f.label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = WTheme.textMuted)
                                Text(f.value, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                            }
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
                guideCard("How it works") { paragraphs(g.rules) }
                guideCard("How scoring works") { paragraphs(g.scoring) }
                guideCard("Strategy") {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        g.tips.forEach { t ->
                            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(t.heading, fontSize = 12.sp, fontWeight = FontWeight.Black, color = accent)
                                Text(t.body, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary, lineHeight = 18.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun guideCard(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        content()
    }
}

@Composable
private fun paragraphs(ps: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ps.forEach { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary, lineHeight = 18.sp) }
    }
}
