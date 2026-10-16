package com.wordocious.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Share sheet: the shared model behind the custom share sheet (docs/review/share-sheet-plan.md §3, founder direction A,
 * docs/design/review/share-sheet-1016/SPEC.md). 1:1 port of packages/core/src/share-sheet.ts; pinned by
 * share-sheet-fixtures.json (ShareSheetFixtureTest).
 *
 * One pure function turns a share CONTEXT (surface, available cards, spoiler variant, season, caption pick) plus the
 * PLATFORM into everything the sheet shows: the ordered card carousel, the "No spoilers | Full results" toggle, the
 * look swatches (season + normal, only inside a season), and the ordered CHANNELS row with, per channel, what travels
 * (image / text / link), the tracked `/go/<slug>` link and the caption. Channels waiting on a registration (Stories,
 * Snapchat, TikTok) come back in `hiddenChannels`, not `channels`.
 *
 * Field order in every model matches the TypeScript object literal (the fixtures are compared byte for byte).
 */

@Serializable
enum class ShareSurface(val id: String) {
    @SerialName("finished") FINISHED("finished"),
    @SerialName("leaderboard") LEADERBOARD("leaderboard"),
    @SerialName("sweep") SWEEP("sweep"),
    @SerialName("vs") VS("vs"),
    @SerialName("profile") PROFILE("profile"),
    @SerialName("moment") MOMENT("moment");
    companion object { fun from(id: String?): ShareSurface? = entries.firstOrNull { it.id == id } }
}

@Serializable
enum class SharePlay(val id: String) {
    @SerialName("daily") DAILY("daily"),
    @SerialName("unlimited") UNLIMITED("unlimited");
    companion object { fun from(id: String?): SharePlay? = entries.firstOrNull { it.id == id } }
}

@Serializable
enum class SharePlatform(val id: String) {
    @SerialName("ios") IOS("ios"),
    @SerialName("android") ANDROID("android"),
    @SerialName("web") WEB("web");
    companion object { fun from(id: String?): SharePlatform? = entries.firstOrNull { it.id == id } }
}

@Serializable
enum class ShareFrame(val id: String) {
    @SerialName("message") MESSAGE("message"),
    @SerialName("story") STORY("story"),
    @SerialName("square") SQUARE("square"),
}

@Serializable
enum class ShareCardKind(val id: String) {
    @SerialName("result") RESULT("result"),
    @SerialName("vs-result") VS_RESULT("vs-result"),
    @SerialName("daily-sweep") DAILY_SWEEP("daily-sweep"),
    @SerialName("leaderboard") LEADERBOARD("leaderboard"),
    @SerialName("moment") MOMENT("moment"),
    @SerialName("profile") PROFILE("profile"),
    @SerialName("streak") STREAK("streak"),
    @SerialName("achievement") ACHIEVEMENT("achievement");
    companion object { fun from(id: String?): ShareCardKind? = entries.firstOrNull { it.id == id } }
}

@Serializable
enum class ShareChannelId(val id: String) {
    @SerialName("copy") COPY("copy"),
    @SerialName("messages") MESSAGES("messages"),
    @SerialName("whatsapp") WHATSAPP("whatsapp"),
    @SerialName("stories") STORIES("stories"),
    @SerialName("x") X("x"),
    @SerialName("facebook") FACEBOOK("facebook"),
    @SerialName("snapchat") SNAPCHAT("snapchat"),
    @SerialName("tiktok") TIKTOK("tiktok"),
    @SerialName("save") SAVE("save"),
    @SerialName("more") MORE("more");
    companion object { fun from(id: String?): ShareChannelId? = entries.firstOrNull { it.id == id } }
}

@Serializable
enum class ShareChannelAvailability(val id: String) {
    @SerialName("ready") READY("ready"),
    @SerialName("needsRegistration") NEEDS_REGISTRATION("needsRegistration"),
}

/** What the channel carries: the PNG alone, PNG + caption text, caption text + link, or just the link. */
@Serializable
enum class ShareChannelPayload(val id: String) {
    @SerialName("image") IMAGE("image"),
    @SerialName("imageText") IMAGE_TEXT("imageText"),
    @SerialName("text") TEXT("text"),
    @SerialName("link") LINK("link");
    companion object { fun from(id: String?): ShareChannelPayload? = entries.firstOrNull { it.id == id } }
}

/** The caption pick for this share (ShareCaptions); null when the surface has no line (profile / moment). */
data class ShareSheetCaption(
    val kind: ShareCaptions.Kind,
    val date: String,
    val game: String,
    val n: String? = null,
    val t: String? = null,
    val b: String? = null,
    val d: Int? = null,
    val k: String? = null,
    val opp: String? = null,
)

data class ShareSheetContext(
    val surface: ShareSurface,
    /** Catalog mode id for a finished game ('regions', 'quordle', …); "" elsewhere. */
    val mode: String,
    val play: SharePlay?,
    /** The card kinds this surface can render for this share (any order; the model orders them). */
    val cards: List<ShareCardKind>,
    val hasSpoilerVariant: Boolean,
    /** The current (ready) season id, or null outside a season. */
    val season: String?,
    val caption: ShareSheetCaption?,
)

@Serializable
data class ShareSheetCard(
    val kind: ShareCardKind,
    /** Carousel previews render the message frame; Stories re-render in `story` at tap time (channelFrame). */
    val frame: ShareFrame,
    val title: String,
)

@Serializable
data class ShareSheetVariantToggle(
    val shown: Boolean,
    /** The sheet opens on this side (ShareVariant id; clean first: no spoilers by default). */
    val initial: String,
    val copy: ShareVariantCopy,
)

@Serializable
data class ShareSheetLook(val id: String, val label: String)

@Serializable
data class ShareSheetLooks(
    val shown: Boolean,
    /** The season first, then "normal"; just ["normal"] outside a season. */
    val options: List<ShareSheetLook>,
    val initial: String,
)

@Serializable
data class ShareSheetChannel(
    val id: ShareChannelId,
    val label: String,
    val availability: ShareChannelAvailability,
    val payload: ShareChannelPayload,
    /** The `/go/<slug>` link this channel carries; null for image-only channels (§S1) and channels without a slug. */
    val link: String?,
    /** The ShareCaptions line for text channels; null when the channel carries no text or the context has no caption. */
    val caption: String?,
    /** `caption + " " + link`, or whichever exists, for APIs that take one body (EXTRA_TEXT); null for image-only. */
    val text: String?,
    /** Web only: the tile exists on phones and hides on desktop. */
    val mobileOnly: Boolean,
)

@Serializable
data class ShareSheetModel(
    val cards: List<ShareSheetCard>,
    val variant: ShareSheetVariantToggle,
    val looks: ShareSheetLooks,
    /** The ordered tiles to render (availability ready). */
    val channels: List<ShareSheetChannel>,
    /** Ordered tiles this platform could show once their registration exists (Stories, Snapchat, TikTok). */
    val hiddenChannels: List<ShareSheetChannel>,
)

object ShareSheet {
    // ── Cards ─────────────────────────────────────────────────────────────

    /** Carousel order across every surface: the headline card first, then the extras. */
    val CARD_ORDER: List<ShareCardKind> = listOf(
        ShareCardKind.RESULT, ShareCardKind.VS_RESULT, ShareCardKind.DAILY_SWEEP, ShareCardKind.LEADERBOARD,
        ShareCardKind.MOMENT, ShareCardKind.PROFILE, ShareCardKind.STREAK, ShareCardKind.ACHIEVEMENT,
    )

    val CARD_TITLES: Map<ShareCardKind, String> = mapOf(
        ShareCardKind.RESULT to "Result", ShareCardKind.VS_RESULT to "Race result", ShareCardKind.DAILY_SWEEP to "Daily sweep",
        ShareCardKind.LEADERBOARD to "Leaderboard", ShareCardKind.MOMENT to "Moment", ShareCardKind.PROFILE to "Profile",
        ShareCardKind.STREAK to "Streak", ShareCardKind.ACHIEVEMENT to "Achievement",
    )

    /** The card a surface always has, used when the context lists none. */
    val SURFACE_DEFAULT_CARD: Map<ShareSurface, ShareCardKind> = mapOf(
        ShareSurface.FINISHED to ShareCardKind.RESULT, ShareSurface.LEADERBOARD to ShareCardKind.LEADERBOARD,
        ShareSurface.SWEEP to ShareCardKind.DAILY_SWEEP, ShareSurface.VS to ShareCardKind.VS_RESULT,
        ShareSurface.PROFILE to ShareCardKind.PROFILE, ShareSurface.MOMENT to ShareCardKind.MOMENT,
    )

    fun cards(surface: ShareSurface, available: List<ShareCardKind>): List<ShareSheetCard> {
        val want = if (available.isNotEmpty()) available else listOf(SURFACE_DEFAULT_CARD.getValue(surface))
        return CARD_ORDER.filter { it in want }.map { ShareSheetCard(it, ShareFrame.MESSAGE, CARD_TITLES.getValue(it)) }
    }

    // ── Looks ─────────────────────────────────────────────────────────────

    val LOOK_LABELS: Map<String, String> = mapOf("normal" to "Normal", "halloween" to "Halloween", "thanksgiving" to "Thanksgiving")

    fun lookLabel(id: String): String {
        LOOK_LABELS[id]?.let { return it }
        if (id.isEmpty()) return ""
        return id.substring(0, 1).uppercase() + id.substring(1)
    }

    fun looks(season: String?): ShareSheetLooks {
        if (season == null || season.isEmpty() || season == "normal") {
            return ShareSheetLooks(false, listOf(ShareSheetLook("normal", "Normal")), "normal")
        }
        return ShareSheetLooks(true, listOf(ShareSheetLook(season, lookLabel(season)), ShareSheetLook("normal", "Normal")), season)
    }

    // ── Channels ──────────────────────────────────────────────────────────

    /** The CHANNELS row, left to right (direction A, plus Save image and TikTok). */
    val CHANNEL_ORDER: List<ShareChannelId> = listOf(
        ShareChannelId.COPY, ShareChannelId.MESSAGES, ShareChannelId.WHATSAPP, ShareChannelId.STORIES, ShareChannelId.X,
        ShareChannelId.FACEBOOK, ShareChannelId.SNAPCHAT, ShareChannelId.TIKTOK, ShareChannelId.SAVE, ShareChannelId.MORE,
    )

    val CHANNEL_LABELS: Map<ShareChannelId, String> = mapOf(
        ShareChannelId.COPY to "Copy link", ShareChannelId.MESSAGES to "Messages", ShareChannelId.WHATSAPP to "WhatsApp",
        ShareChannelId.STORIES to "Stories", ShareChannelId.X to "X", ShareChannelId.FACEBOOK to "Facebook",
        ShareChannelId.SNAPCHAT to "Snapchat", ShareChannelId.TIKTOK to "TikTok", ShareChannelId.SAVE to "Save image",
        ShareChannelId.MORE to "More",
    )

    /** marketing_links slugs; null = no tracked link. */
    val CHANNEL_SLUGS: Map<ShareChannelId, String?> = mapOf(
        ShareChannelId.COPY to "copy", ShareChannelId.MESSAGES to "msg", ShareChannelId.WHATSAPP to "wa",
        ShareChannelId.STORIES to "instagram", ShareChannelId.X to "x", ShareChannelId.FACEBOOK to "facebook",
        ShareChannelId.SNAPCHAT to "snapchat", ShareChannelId.TIKTOK to "tiktok", ShareChannelId.SAVE to null, ShareChannelId.MORE to null,
    )

    val CHANNEL_AVAILABILITY: Map<ShareChannelId, ShareChannelAvailability> = mapOf(
        ShareChannelId.COPY to ShareChannelAvailability.READY, ShareChannelId.MESSAGES to ShareChannelAvailability.READY,
        ShareChannelId.WHATSAPP to ShareChannelAvailability.READY, ShareChannelId.STORIES to ShareChannelAvailability.NEEDS_REGISTRATION,
        ShareChannelId.X to ShareChannelAvailability.READY, ShareChannelId.FACEBOOK to ShareChannelAvailability.READY,
        ShareChannelId.SNAPCHAT to ShareChannelAvailability.NEEDS_REGISTRATION, ShareChannelId.TIKTOK to ShareChannelAvailability.NEEDS_REGISTRATION,
        ShareChannelId.SAVE to ShareChannelAvailability.READY, ShareChannelId.MORE to ShareChannelAvailability.READY,
    )

    private fun row(ios: ShareChannelPayload?, android: ShareChannelPayload?, web: ShareChannelPayload?): Map<SharePlatform, ShareChannelPayload?> =
        mapOf(SharePlatform.IOS to ios, SharePlatform.ANDROID to android, SharePlatform.WEB to web)

    /** Plan §2, encoded: what each channel carries on each platform; null = the channel does not exist there. */
    val CHANNEL_PAYLOADS: Map<ShareChannelId, Map<SharePlatform, ShareChannelPayload?>> = mapOf(
        ShareChannelId.COPY to row(ShareChannelPayload.LINK, ShareChannelPayload.LINK, ShareChannelPayload.LINK),
        ShareChannelId.MESSAGES to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, ShareChannelPayload.TEXT),
        ShareChannelId.WHATSAPP to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, ShareChannelPayload.TEXT),
        ShareChannelId.STORIES to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, null),
        ShareChannelId.X to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE_TEXT, ShareChannelPayload.TEXT),
        ShareChannelId.FACEBOOK to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, ShareChannelPayload.LINK),
        ShareChannelId.SNAPCHAT to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, ShareChannelPayload.LINK),
        ShareChannelId.TIKTOK to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, null),
        ShareChannelId.SAVE to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE),
        ShareChannelId.MORE to row(ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE, ShareChannelPayload.IMAGE),
    )

    /** Web tiles that only make sense on a phone (sms: / wa.me). */
    val WEB_MOBILE_ONLY: List<ShareChannelId> = listOf(ShareChannelId.MESSAGES, ShareChannelId.WHATSAPP)

    const val LINK_BASE = "https://wordocious.com/go/"

    fun payload(channel: ShareChannelId, platform: SharePlatform): ShareChannelPayload? = CHANNEL_PAYLOADS.getValue(channel)[platform]

    /** The tracked link: `/go/<slug>?s=<surface>[&m=<mode>]`. */
    fun link(channel: ShareChannelId, surface: ShareSurface, mode: String): String? {
        val slug = CHANNEL_SLUGS[channel] ?: return null
        val query = if (mode.isNotEmpty()) "?s=${surface.id}&m=$mode" else "?s=${surface.id}"
        return LINK_BASE + slug + query
    }

    /** Stories / Snapchat / TikTok want the 9:16 story frame; everything else the message frame. */
    fun frame(channel: ShareChannelId): ShareFrame =
        if (channel == ShareChannelId.STORIES || channel == ShareChannelId.SNAPCHAT || channel == ShareChannelId.TIKTOK) ShareFrame.STORY else ShareFrame.MESSAGE

    fun carriesImage(channel: ShareChannelId, platform: SharePlatform): Boolean {
        val p = payload(channel, platform)
        return p == ShareChannelPayload.IMAGE || p == ShareChannelPayload.IMAGE_TEXT
    }

    fun carriesLink(channel: ShareChannelId, platform: SharePlatform): Boolean {
        val p = payload(channel, platform)
        return p == ShareChannelPayload.LINK || p == ShareChannelPayload.TEXT || p == ShareChannelPayload.IMAGE_TEXT
    }

    fun channel(channel: ShareChannelId, platform: SharePlatform, ctx: ShareSheetContext): ShareSheetChannel? {
        val payload = payload(channel, platform) ?: return null
        val trackedLink = if (carriesLink(channel, platform)) link(channel, ctx.surface, ctx.mode) else null
        val wantsText = payload == ShareChannelPayload.TEXT || payload == ShareChannelPayload.IMAGE_TEXT
        val c = ctx.caption
        val caption = if (wantsText && c != null) {
            ShareCaptions.caption(c.kind, ShareCaptions.Vars(date = c.date, game = c.game, n = c.n, t = c.t, b = c.b, d = c.d, k = c.k, opp = c.opp))
        } else null
        val text = if (caption != null && trackedLink != null) "$caption $trackedLink" else if (wantsText) (caption ?: trackedLink) else null
        return ShareSheetChannel(
            id = channel, label = CHANNEL_LABELS.getValue(channel), availability = CHANNEL_AVAILABILITY.getValue(channel), payload = payload,
            link = trackedLink, caption = caption, text = text, mobileOnly = platform == SharePlatform.WEB && channel in WEB_MOBILE_ONLY,
        )
    }

    // ── The model ─────────────────────────────────────────────────────────

    fun model(ctx: ShareSheetContext, platform: SharePlatform): ShareSheetModel {
        val cardList = cards(ctx.surface, ctx.cards)
        val variant = ShareSheetVariantToggle(
            shown = ctx.hasSpoilerVariant && cardList.any { it.kind == ShareCardKind.RESULT },
            initial = ShareVariant.CLEAN.id,
            copy = ShareSpoilers.variantCopy(ctx.mode),
        )
        val lookSet = looks(ctx.season)
        val channels = ArrayList<ShareSheetChannel>(); val hidden = ArrayList<ShareSheetChannel>()
        for (id in CHANNEL_ORDER) {
            val ch = channel(id, platform, ctx) ?: continue
            if (ch.availability == ShareChannelAvailability.READY) channels.add(ch) else hidden.add(ch)
        }
        return ShareSheetModel(cardList, variant, lookSet, channels, hidden)
    }
}

fun shareSheetModel(ctx: ShareSheetContext, platform: SharePlatform): ShareSheetModel = ShareSheet.model(ctx, platform)
fun channelFrame(channel: ShareChannelId): ShareFrame = ShareSheet.frame(channel)
fun channelCarriesImage(channel: ShareChannelId, platform: SharePlatform): Boolean = ShareSheet.carriesImage(channel, platform)
