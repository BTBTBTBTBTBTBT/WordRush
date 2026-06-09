package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay

/**
 * Transient "+N / −N" rank-movement pill — ports web ui/rank-delta.tsx.
 * Remembers the last rank you saw per (page, mode, playType) for this app
 * session (in-memory, the analogue of the web's sessionStorage) and, when the
 * rank moved since the last look, shows a green/red trend pill for 5s.
 */
object RankDeltaStore {
    private val ranks = mutableMapOf<String, Int>()

    private fun key(pageKey: String, mode: String, playType: String) = "rank:$pageKey:$mode:$playType"

    /** previous − current: positive = moved UP the board (improved). */
    fun delta(pageKey: String, mode: String, playType: String, currentRank: Int): Int? {
        val prev = ranks[key(pageKey, mode, playType)] ?: return null
        val d = prev - currentRank
        return if (d != 0) d else null
    }

    fun save(pageKey: String, mode: String, playType: String, rank: Int) {
        ranks[key(pageKey, mode, playType)] = rank
    }
}

@Composable
fun RankDeltaBadge(mode: String, playType: String, pageKey: String, currentRank: Int) {
    var delta by remember { mutableStateOf<Int?>(null) }
    var visible by remember { mutableStateOf(true) }

    LaunchedEffect(pageKey, mode, playType, currentRank) {
        visible = true
        delta = RankDeltaStore.delta(pageKey, mode, playType, currentRank)
        RankDeltaStore.save(pageKey, mode, playType, currentRank)
        if (delta != null) {
            delay(5000)
            visible = false
        }
    }

    val d = delta
    if (d != null && visible) {
        val improved = d > 0
        Row(
            Modifier
                .clip(RoundedCornerShape(50))
                .background(if (improved) WTheme.winBg else WTheme.lossBg)
                .padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                if (improved) Icons.AutoMirrored.Filled.TrendingUp else Icons.AutoMirrored.Filled.TrendingDown,
                null,
                tint = if (improved) WTheme.winText else WTheme.lossText,
                modifier = Modifier.size(10.dp),
            )
            Text(
                if (improved) "+$d" else "$d",
                fontSize = 9.sp, fontWeight = FontWeight.Black,
                color = if (improved) WTheme.winText else WTheme.lossText,
            )
        }
    }
}
