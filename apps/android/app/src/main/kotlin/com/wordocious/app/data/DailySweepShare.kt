package com.wordocious.app.data

import android.content.Context
import android.content.Intent
import com.wordocious.app.ModeGen
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.wordocious.app.R
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.floor

/**
 * All-dailies share card (Daily Sweep / Flawless Victory) — Android port of web
 * lib/share-image.ts drawDailySweepCard + iOS DailySweepCardView. A 1080×1350
 * PNG with the wordmark, the gold/violet title, summed header totals, and one
 * mode-accent row per daily game. Keep the mode order, glyphs, and layout
 * identical to web/iOS.
 */
object DailySweepShare {
    private const val W = 1080
    private const val H = 1350
    private const val BG = 0xFFF8F7FF.toInt()
    private const val TEXT_MUTED = 0xFF6B7280.toInt()
    private const val TEXT_DARK = 0xFF1A1A2E.toInt()
    private const val FOOT = 0xFF9CA3AF.toInt()
    private const val WIN_FG = 0xFF7C3AED.toInt()
    private const val WIN_BG = 0xFFF5F3FF.toInt()
    private const val LOSS_FG = 0xFFDC2626.toInt()
    private const val LOSS_BG = 0xFFFEE2E2.toInt()

    data class Row(
        val dbKey: String, val label: String, val accent: Int, val glyph: String,
        val won: Boolean, val guesses: Int, val timeSeconds: Int, val score: Int,
    )

    /** DB game_mode → (label, accent, glyph) in canonical daily order — order,
     *  accent and glyph are single-sourced from the catalog (modes.json → ModeGen).
     *  Only ProperNoundle's label is shortened to "Proper" to fit the row. */
    private val LABEL_OVERRIDE = mapOf("PROPERNOUNDLE" to "Proper")
    private val MODES: List<Pair<Triple<String, String, Int>, String>> =
        ModeGen.daily.map { m ->
            val key = m.dbKey ?: ""
            Triple(key, LABEL_OVERRIDE[key] ?: m.shareLabel, m.accentInt) to (m.glyph ?: "")
        }

    fun rows(byMode: Map<String, DailyCompletionsService.Completion>): List<Row> =
        MODES.mapNotNull { (meta, glyph) ->
            val (dbKey, label, accent) = meta
            byMode[dbKey]?.let { c ->
                Row(dbKey, label, accent, glyph, c.completed, c.guessCount, c.timeSeconds, Math.round(c.score).toInt())
            }
        }

    private fun nunito(context: Context, black: Boolean): Typeface {
        val base = ResourcesCompat.getFont(context, R.font.nunito) ?: Typeface.DEFAULT
        return Typeface.create(base, if (black) Typeface.BOLD else Typeface.NORMAL)
    }

    private fun fmt(s: Int): String = "%d:%02d".format(s / 60, s % 60)

    fun render(
        context: Context, rows: List<Row>, totals: DailyCompletionsService.Totals, flawless: Boolean,
    ): Bitmap {
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(BG)
        val black = nunito(context, true)
        val bold = nunito(context, false)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
        val cx = W / 2f

        // Wordmark
        p.typeface = black; p.isFakeBoldText = true; p.textSize = 56f
        p.shader = LinearGradient(cx - 200f, 0f, cx + 200f, 0f, 0xFFA78BFA.toInt(), 0xFFEC4899.toInt(), Shader.TileMode.CLAMP)
        c.drawText("WORDOCIOUS", cx, 92f, p)
        p.shader = null

        // Title
        p.textSize = 52f
        val titleColors = if (flawless) intArrayOf(0xFFFBBF24.toInt(), 0xFFB45309.toInt())
                          else intArrayOf(0xFFA78BFA.toInt(), 0xFFEC4899.toInt())
        p.shader = LinearGradient(cx - 260f, 0f, cx + 260f, 0f, titleColors, null, Shader.TileMode.CLAMP)
        c.drawText(if (flawless) "FLAWLESS VICTORY" else "DAILY SWEEP", cx, 156f, p)
        p.shader = null

        // Stats line
        val date = SimpleDateFormat("MMM d", Locale.US).format(Date())
        p.typeface = bold; p.isFakeBoldText = true; p.textSize = 26f; p.color = TEXT_MUTED
        c.drawText("${totals.won}/${totals.total} won · ${fmt(totals.totalTimeSeconds)} · ${totals.totalScore} pts · $date", cx, 206f, p)

        // Rows
        val padH = 90f; val gap = 16f
        val areaTop = 250f; val areaBottom = H - 80f
        val n = rows.size
        val rowH = floor((areaBottom - areaTop - gap * (n - 1)) / n)
        for (i in 0 until n) {
            val r = rows[i]
            val top = areaTop + i * (rowH + gap)
            val rect = RectF(padH, top, W - padH, top + rowH)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (r.won) WIN_BG else LOSS_BG }
            c.drawRoundRect(rect, 20f, 20f, fill)
            val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 3f; color = if (r.won) WIN_FG else LOSS_FG
            }
            c.drawRoundRect(rect, 20f, 20f, stroke)

            // Accent glyph badge
            val badge = minOf(rowH - 24f, 72f)
            val bx = rect.left + 24f
            val by = rect.centerY() - badge / 2
            val badgeRect = RectF(bx, by, bx + badge, by + badge)
            c.drawRoundRect(badgeRect, 16f, 16f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = r.accent })
            // Real game icon (lucide vector, drawn WHITE) for the icon modes
            // (Classic/Succession/Deliverance/Gauntlet/Proper); the numeral modes
            // (IV/VIII/6/7) keep their glyph — same as the home cards.
            val lucide = com.wordocious.app.ui.MODE_CARDS.firstOrNull { it.engineMode?.name == r.dbKey }?.lucide
            val iconRes = com.wordocious.app.ui.modeIconRes(lucide)
            val iconDrawable = iconRes?.let { androidx.core.content.ContextCompat.getDrawable(context, it) }
            if (iconDrawable != null) {
                val inset = badge * 0.28f
                iconDrawable.setTint(Color.WHITE)
                iconDrawable.setBounds(
                    (badgeRect.left + inset).toInt(), (badgeRect.top + inset).toInt(),
                    (badgeRect.right - inset).toInt(), (badgeRect.bottom - inset).toInt(),
                )
                iconDrawable.draw(c)
            } else {
                p.typeface = black; p.isFakeBoldText = true
                p.textSize = if (r.glyph.length >= 3) 24f else 30f; p.color = Color.WHITE
                c.drawText(r.glyph, badgeRect.centerX(), badgeRect.centerY() + p.textSize * 0.35f, p)
            }

            val textX = bx + badge + 22f
            p.textAlign = Paint.Align.LEFT
            p.textSize = 30f; p.color = TEXT_DARK
            c.drawText(r.label, textX, rect.centerY() - 6f, p)
            p.typeface = bold; p.textSize = 21f; p.color = TEXT_MUTED
            val guessDisp = if (r.won) "${r.guesses}g" else "X"
            c.drawText("$guessDisp · ${fmt(r.timeSeconds)} · ${r.score} pts", textX, rect.centerY() + 24f, p)

            p.typeface = black; p.textAlign = Paint.Align.RIGHT; p.textSize = 48f
            p.color = if (r.won) WIN_FG else LOSS_FG
            c.drawText(if (r.won) "✓" else "✗", rect.right - 32f, rect.centerY() + 18f, p)
            p.textAlign = Paint.Align.CENTER
        }

        // Footer
        p.typeface = bold; p.isFakeBoldText = true; p.textSize = 22f; p.color = FOOT
        c.drawText("wordocious.com", cx, H - 40f, p)
        return bmp
    }

    /** Build + share the all-dailies card. */
    fun share(context: Context, byMode: Map<String, DailyCompletionsService.Completion>) {
        val rows = rows(byMode)
        if (rows.isEmpty()) return
        val totals = DailyCompletionsService.totals(byMode)
        val bitmap = render(context, rows, totals, totals.flawless)
        val text = if (totals.flawless)
            "Flawless Victory on Wordocious! All ${totals.total} daily puzzles won."
        else "Daily Sweep on Wordocious! All ${totals.total} daily puzzles done."

        val uri = runCatching {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "wordocious-dailysweep.png")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }.getOrNull()
        if (uri == null) { ShareHelper.share(context, text); return }

        CoroutineScope(Dispatchers.IO).launch {
            val url = uploadUrl(bitmap, totals)
            val finalText = if (url != null) "$text\n$url" else text
            withContext(Dispatchers.Main) {
                runCatching {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, finalText)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(intent, "Share your dailies").apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                }.onFailure { ShareHelper.share(context, finalText) }
            }
        }
    }

    private suspend fun uploadUrl(bitmap: Bitmap, totals: DailyCompletionsService.Totals): String? = runCatching {
        val uid = AuthService.userId?.lowercase() ?: return null
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val key = "$uid/DailySweep-$dateStr"
        val png = ByteArrayOutputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it); it.toByteArray() }
        SupabaseConfig.client.storage.from("share-images").upload("$key.png", png) { upsert = true }
        val q = linkedMapOf(
            "m" to "DailySweep",
            "sweep" to if (totals.flawless) "flawless" else "sweep",
            "won" to "${totals.won}", "tot" to "${totals.total}",
            "t" to "${totals.totalTimeSeconds}", "pts" to "${totals.totalScore}",
            "w" to "1080", "h" to "1350",
            "v" to "${if (totals.flawless) "f" else "s"}${totals.won}-${totals.totalTimeSeconds}-${totals.totalScore}",
        )
        "https://wordocious.com/s/$key?" + q.entries.joinToString("&") { "${it.key}=${android.net.Uri.encode(it.value)}" }
    }.getOrNull()
}

/** Profile stats share card (Wave B P4) — 1080² PNG matching web drawProfileCard:
 *  wordmark, accent username, Level·Tier, a 2×3 grid of stat tiles. */
object ProfileShare {
    private const val S = 1080
    private const val BG = 0xFFF8F7FF.toInt()
    private const val TEXT_MUTED = 0xFF6B7280.toInt()
    private const val FOOT = 0xFF9CA3AF.toInt()
    private const val TILE_BORDER = 0xFFE5E7EB.toInt()

    data class ProfileInput(
        val username: String, val level: Int, val tier: String, val accent: Int,
        val totalWins: Int, val winRate: Int, val currentStreak: Int, val dailyStreak: Int,
        val gold: Int, val silver: Int, val bronze: Int,
        val achievementsUnlocked: Int, val achievementsTotal: Int,
    )

    private fun nunito(context: Context, black: Boolean): Typeface {
        val base = ResourcesCompat.getFont(context, R.font.nunito) ?: Typeface.DEFAULT
        return Typeface.create(base, if (black) Typeface.BOLD else Typeface.NORMAL)
    }

    fun render(context: Context, input: ProfileInput): Bitmap {
        val bmp = Bitmap.createBitmap(S, S, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(BG)
        val black = nunito(context, true)
        val bold = nunito(context, false)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
        val cx = S / 2f

        // Wordmark
        p.typeface = black; p.isFakeBoldText = true; p.textSize = 50f
        p.shader = LinearGradient(cx - 200f, 0f, cx + 200f, 0f, 0xFFA78BFA.toInt(), 0xFFEC4899.toInt(), Shader.TileMode.CLAMP)
        c.drawText("WORDOCIOUS", cx, 110f, p)
        p.shader = null

        // Username (accent)
        p.textSize = 76f; p.color = input.accent
        c.drawText(input.username, cx, 210f, p)

        // Level · Tier
        p.typeface = bold; p.textSize = 30f; p.color = TEXT_MUTED
        c.drawText("Level ${input.level} · ${input.tier}", cx, 262f, p)

        // 2×3 stat tiles
        val tiles = listOf(
            "${input.totalWins}" to "Total Wins",
            "${input.winRate}%" to "Win Rate",
            "${input.currentStreak}" to "Win Streak",
            "${input.dailyStreak}" to "Daily Streak",
            "${input.gold}·${input.silver}·${input.bronze}" to "Medals G·S·B",
            "${input.achievementsUnlocked}/${input.achievementsTotal}" to "Achievements",
        )
        val padH = 80f; val gap = 24f
        val tileW = (S - padH * 2 - gap) / 2
        val areaTop = 340f; val areaBottom = (S - 90).toFloat()
        val tileH = (areaBottom - areaTop - gap * 2) / 3
        for (i in tiles.indices) {
            val col = i % 2; val rowIdx = i / 2
            val left = padH + col * (tileW + gap)
            val top = areaTop + rowIdx * (tileH + gap)
            val rect = RectF(left, top, left + tileW, top + tileH)
            c.drawRoundRect(rect, 28f, 28f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
            c.drawRoundRect(rect, 28f, 28f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 3f; color = TILE_BORDER
            })
            p.typeface = black; p.isFakeBoldText = true; p.textSize = 60f; p.color = input.accent
            c.drawText(tiles[i].first, rect.centerX(), rect.centerY() + 6f, p)
            p.typeface = bold; p.textSize = 26f; p.color = TEXT_MUTED
            c.drawText(tiles[i].second, rect.centerX(), rect.centerY() + 56f, p)
        }

        // Footer
        p.typeface = bold; p.isFakeBoldText = true; p.textSize = 24f; p.color = FOOT
        c.drawText("wordocious.com", cx, S - 44f, p)
        return bmp
    }

    fun share(context: Context, input: ProfileInput) {
        val bitmap = render(context, input)
        val text = "My Wordocious stats — Level ${input.level} ${input.tier}, ${input.totalWins} wins."
        val uri = runCatching {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "wordocious-profile.png")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }.getOrNull()
        if (uri == null) { ShareHelper.share(context, text); return }

        CoroutineScope(Dispatchers.IO).launch {
            val url = uploadUrl(bitmap, input)
            val finalText = if (url != null) "$text\n$url" else text
            withContext(Dispatchers.Main) {
                runCatching {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, finalText)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(intent, "Share your stats").apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                }.onFailure { ShareHelper.share(context, finalText) }
            }
        }
    }

    private suspend fun uploadUrl(bitmap: Bitmap, input: ProfileInput): String? = runCatching {
        val uid = AuthService.userId?.lowercase() ?: return null
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val key = "$uid/Profile-$dateStr"
        val png = ByteArrayOutputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it); it.toByteArray() }
        SupabaseConfig.client.storage.from("share-images").upload("$key.png", png) { upsert = true }
        val q = linkedMapOf(
            "m" to "Profile", "w" to "1080", "h" to "1080",
            "v" to "p${input.totalWins}-${input.currentStreak}-${input.achievementsUnlocked}",
        )
        "https://wordocious.com/s/$key?" + q.entries.joinToString("&") { "${it.key}=${android.net.Uri.encode(it.value)}" }
    }.getOrNull()
}
