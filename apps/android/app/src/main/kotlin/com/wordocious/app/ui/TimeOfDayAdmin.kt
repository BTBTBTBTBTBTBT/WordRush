package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.RowScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * Settings > ADMIN > "Time of day" (admin-only, beside the Season preview): Auto / Morning / Day / Evening / Night pins the
 * time-of-day look (wall, Home stage, every window) for a season preview; Auto follows the device clock. Writes the same
 * `debug-tod` pref as the `--es dressTod` debug extra ([TimeOfDayState.pick]).
 */
@Composable
fun TimeOfDayAdminRows(accent: Color) {
    val pinned = TimeOfDayState.pref
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Time of day", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(
            "While a season shows. Auto follows this phone's clock (now: ${TimeOfDayState.slot.id}).",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            TodChip("Auto", pinned == null, accent) { TimeOfDayState.pick(null) }
            com.wordocious.core.TimeOfDay.entries.forEach { t ->
                TodChip(t.id.replaceFirstChar { it.uppercase() }, pinned == t, accent) { TimeOfDayState.pick(t.id) }
            }
        }
    }
}

@Composable
private fun RowScope.TodChip(label: String, active: Boolean, accent: Color, onClick: () -> Unit) {
    Box(
        Modifier.weight(1f).heightIn(min = 40.dp).clip(RoundedCornerShape(12.dp))
            .background(if (active) accent else (WTheme.season?.raised ?: WTheme.surfaceAlt))
            .squishClickable(label = "$label time of day" + if (active) ", selected" else "", role = Role.RadioButton, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, maxLines = 1, color = if (active) Color.White else WTheme.text)
    }
}
