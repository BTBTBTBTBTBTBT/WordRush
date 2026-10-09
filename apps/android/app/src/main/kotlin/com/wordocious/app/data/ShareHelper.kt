package com.wordocious.app.data

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.core.content.FileProvider
import com.wordocious.app.ModeGen
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.ShareCaptions
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import java.io.File

/**
 * Builds the shareable emoji grid (the text fallback when no image can be written)
 * and launches the Android share sheet.
 *
 * FINISH_SPEC S1: a completed-result share sends the IMAGE ONLY — ACTION_SEND
 * image/png with the FileProvider uri in EXTRA_STREAM + ClipData (so the chooser
 * previews it) + FLAG_GRANT_READ_URI_PERMISSION, and NO EXTRA_TEXT: no URL, no
 * caption, so Messages / WhatsApp show the picture, not a link-preview card.
 * Invites keep their links ([share], text/plain).
 */
object ShareHelper {

    private fun emoji(state: TileState): String = when (state) {
        TileState.CORRECT -> "🟪"
        TileState.PRESENT -> "🟧"
        TileState.HINT_USED -> "🟧"
        else -> "⬛"
    }

    /** Build the share text for a finished single- or multi-board game. */
    fun buildShareText(state: GameState, mode: GameMode, elapsedSeconds: Int): String {
        val won = state.status == GameStatus.WON
        val modeName = modeLabel(mode)
        val sb = StringBuilder()

        // Gauntlet: share the WHOLE run — every stage config (unreached = ❌)
        // and the run-total guess count, not just the final stage's boards
        // (web gauntlet-results.tsx parity).
        val g = state.gauntlet
        if (mode == GameMode.GAUNTLET && g != null) {
            val totalGuesses = g.stageResults.sumOf { it.guesses }
            val cleared = g.stageResults.count { it.status == GameStatus.WON }
            sb.appendLine("Wordocious Gauntlet $cleared/${g.totalStages} stages · $totalGuesses guesses")
            sb.appendLine()
            g.stages.forEach { st ->
                val r = g.stageResults.firstOrNull { it.stageIndex == st.stageIndex }
                val stageWon = r?.status == GameStatus.WON
                val solved = if (stageWon) st.boardCount
                else r?.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0
                sb.appendLine("${if (stageWon) "✅" else "❌"} ${st.name}  $solved/${st.boardCount} boards · ${r?.guesses ?: 0} guesses")
            }
            val mins = elapsedSeconds / 60
            val secs = elapsedSeconds % 60
            sb.appendLine()
            sb.appendLine("⏱ ${if (mins > 0) "${mins}m " else ""}${secs}s")
            sb.append("Play at wordocious.com")
            return sb.toString()
        }

        if (state.boards.size == 1) {
            val board = state.boards[0]
            val tries = if (won) "${board.guesses.size}/${board.maxGuesses}" else "X/${board.maxGuesses}"
            sb.appendLine("Wordocious $modeName $tries")
            sb.appendLine()
            board.guesses.forEach { guess ->
                val eval = evaluateGuess(board.solution, guess)
                sb.appendLine(eval.tiles.joinToString("") { emoji(it.state) })
            }
        } else {
            val solved = state.boards.count { it.status == GameStatus.WON }
            sb.appendLine("Wordocious $modeName $solved/${state.boards.size} boards")
            sb.appendLine()
            // One compact emoji line per board: its final-row result
            state.boards.forEach { board ->
                val lastGuess = board.guesses.lastOrNull()
                if (lastGuess != null) {
                    val eval = evaluateGuess(board.solution, lastGuess)
                    sb.append(eval.tiles.joinToString("") { emoji(it.state) })
                    sb.append(if (board.status == GameStatus.WON) " ✅" else " ❌")
                    sb.appendLine()
                }
            }
        }

        val mins = elapsedSeconds / 60
        val secs = elapsedSeconds % 60
        sb.appendLine()
        sb.appendLine("⏱ ${if (mins > 0) "${mins}m " else ""}${secs}s")
        sb.append("Play at wordocious.com")
        return sb.toString()
    }

    /** Launch the system share sheet with plain text (invites; the no-image fallback). */
    fun share(context: Context, text: String, title: String? = null) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        val chooser = Intent.createChooser(intent, title).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(chooser) }
    }

    // ── S4 copy (the shared bank in :core ShareCaptions; iOS ShareCopy parity) ──

    /** "Come play Wordocious with me! 🎉 <url>" — friend / gift invites keep their link. */
    fun inviteText(url: String): String =
        ShareCaptions.caption(ShareCaptions.Kind.INVITE, ShareCaptions.Vars(date = "", game = "Wordocious", url = url))

    // 9f branded one-link invites (FlagsService branded_invites): ONE wordocious.com/vs/<CODE> link
    // whose preview image carries the game + code, with a single short line beside it. Off = today's
    // /vs/join + /vs/challenge links and the "Race me at X!" line.
    private fun brandedOn(): Boolean = FlagsService.isLive(com.wordocious.core.BrandedInvite.SWITCH_KEY)

    /** The link to share for a live VS invite code. */
    fun liveInviteUrl(code: String): String =
        if (brandedOn()) com.wordocious.core.BrandedInvite.url(com.wordocious.core.BrandedInvite.Kind.VS, code)
        else "https://wordocious.com/vs/join/$code"

    /** The link to share for a race-my-run challenge code. */
    fun challengeUrl(code: String): String =
        if (brandedOn()) com.wordocious.core.BrandedInvite.url(com.wordocious.core.BrandedInvite.Kind.VS, code)
        else "https://wordocious.com/vs/challenge/$code"

    /** The share text for a live invite / challenge: [url] comes from liveInviteUrl / challengeUrl. */
    fun inviteShareText(race: Boolean, game: String, url: String): String =
        if (brandedOn()) {
            val sender = AuthService.profile.value?.username ?: "A friend"
            val v = if (race) com.wordocious.core.BrandedInvite.Variant.RACE else com.wordocious.core.BrandedInvite.Variant.LIVE
            "${com.wordocious.core.BrandedInvite.shareLine(v, sender, game)} $url"
        } else vsInviteText(game, url)

    /** "Race me at <Game>! ⚡ <url>" — VS join / challenge links keep their link. */
    fun vsInviteText(game: String, url: String): String =
        ShareCaptions.caption(ShareCaptions.Kind.VS_INVITE, ShareCaptions.Vars(date = "", game = game, url = url))

    /** The VS result line ("Beat Doug at Classic ⚔️"); a draw reads "… tied …". */
    fun vsResultText(won: Boolean, draw: Boolean, opp: String, game: String, date: String = com.wordocious.app.todayLocalDate()): String =
        ShareCaptions.caption(
            when { draw -> ShareCaptions.Kind.VS_DRAW; won -> ShareCaptions.Kind.VS_WIN; else -> ShareCaptions.Kind.VS_LOSE },
            ShareCaptions.Vars(date = date, game = game, opp = opp),
        )

    /** S4 the chooser title: "Share your QuadWord". */
    fun chooserTitle(game: String): String = "Share your $game"

    /** "Wordocious-QuadWord.png" (letters and digits only, like the iOS suggested name). */
    fun fileName(game: String): String =
        "Wordocious-${game.filter { it.isLetterOrDigit() }.ifEmpty { "Share" }}.png"

    /** Writes [bitmap] to the share cache and returns its FileProvider uri (null on failure). */
    fun writePng(context: Context, bitmap: Bitmap, name: String): Uri? = runCatching {
        val dir = File(context.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, name)
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }.getOrNull()

    /**
     * S1 the image-only intent: ACTION_SEND (one) / ACTION_SEND_MULTIPLE (several),
     * image/png, EXTRA_STREAM, ClipData for the chooser preview, read grant. No
     * EXTRA_TEXT, no EXTRA_SUBJECT: nothing but the picture travels.
     */
    fun imageIntent(context: Context, uris: List<Uri>): Intent {
        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).apply { putExtra(Intent.EXTRA_STREAM, uris[0]) }
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).apply { putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris)) }
        }
        intent.type = "image/png"
        val clip = ClipData.newUri(context.contentResolver, "Wordocious", uris[0])
        uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) }
        intent.clipData = clip
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        return intent
    }

    /**
     * S1 share one or more result images, nothing else. Returns false (after the
     * [fallbackText] text share, when given) if no image could be written or the
     * sheet could not open.
     */
    fun shareImages(context: Context, images: List<Pair<Bitmap, String>>, chooserTitle: String, fallbackText: String? = null): Boolean {
        val uris = images.mapNotNull { (bmp, name) -> writePng(context, bmp, name) }
        if (uris.isEmpty()) { fallbackText?.let { share(context, it, chooserTitle) }; return false }
        return runCatching {
            context.startActivity(Intent.createChooser(imageIntent(context, uris), chooserTitle).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                // The chooser inherits the target's ClipData + grant for its preview.
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            })
            true
        }.getOrElse {
            fallbackText?.let { t -> share(context, t, chooserTitle) }
            false
        }
    }

    /** [shareImages] for a single image named after [game] ("Share your QuadWord"). */
    fun shareImage(context: Context, bitmap: Bitmap, game: String, fallbackText: String? = null, chooserTitle: String = chooserTitle(game)): Boolean =
        shareImages(context, listOf(bitmap to fileName(game)), chooserTitle, fallbackText)

    fun modeLabel(mode: GameMode): String = when (mode) {
        GameMode.DUEL -> "Classic"
        GameMode.MULTI_DUEL -> "Duel"
        GameMode.QUORDLE -> "QuadWord"
        GameMode.OCTORDLE -> "OctoWord"
        GameMode.SEQUENCE -> "Succession"
        GameMode.RESCUE -> "Deliverance"
        GameMode.DUEL_6 -> "Six"
        GameMode.DUEL_7 -> "Seven"
        GameMode.GAUNTLET -> "Gauntlet"
        GameMode.PROPERNOUNDLE -> "ProperNoundle"
        GameMode.TOURNAMENT -> "Tournament"
        // More Games titles come from the catalog, never a second hand-typed list.
        else -> ModeGen.byDbKey(mode.name)?.title ?: mode.name
    }
}
