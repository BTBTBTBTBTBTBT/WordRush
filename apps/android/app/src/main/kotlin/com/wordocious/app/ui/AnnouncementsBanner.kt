package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.Serializable

// Native reader for admin-authored announcements (web/iOS parity). RLS
// serves only active + unexpired rows; dismissals persist per-id.
@Composable
fun AnnouncementsBanner() {
    var current by remember { mutableStateOf<AnnouncementRow?>(null) }

    LaunchedEffect(Unit) {
        val rows = runCatching {
            SupabaseConfig.client.postgrest["announcements"]
                .select(Columns.raw("id, title, body")) {
                    order("created_at", Order.DESCENDING)
                    limit(5)
                }
                .decodeList<AnnouncementRow>()
        }.getOrDefault(emptyList())
        val dismissed = SettingsPref.get("dismissed-announcements", "").split(",").toSet()
        current = rows.firstOrNull { it.id !in dismissed }
    }

    val a = current ?: return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(WTheme.surface, RoundedCornerShape(16.dp))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("📣", fontSize = 13.sp)
        Column(Modifier.weight(1f)) {
            Text(
                a.title, fontSize = 13.sp, fontWeight = FontWeight.Black,
                style = TextStyle(
                    brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899))),
                    fontFamily = Nunito,
                ),
            )
            Text(a.body, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, fontFamily = Nunito)
        }
        Text("✕", fontSize = 12.sp, color = WTheme.textMuted, modifier = Modifier.clickableNoRipple {
            val dismissed = SettingsPref.get("dismissed-announcements", "")
            SettingsPref.set("dismissed-announcements", if (dismissed.isEmpty()) a.id else "$dismissed,${a.id}")
            current = null
        })
    }
}

@Serializable
data class AnnouncementRow(val id: String, val title: String, val body: String)
