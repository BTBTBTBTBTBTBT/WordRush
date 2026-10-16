import Foundation

// Share sheet: the shared model behind the custom share sheet (docs/review/share-sheet-plan.md §3, founder direction A,
// docs/design/review/share-sheet-1016/SPEC.md). Swift port of packages/core/src/share-sheet.ts, pinned to it by
// share-sheet-fixtures.json (ShareSheetFixtureTests).
//
// One pure function turns a share CONTEXT (surface, available cards, spoiler variant, season, caption pick) plus the
// PLATFORM into everything the sheet shows: the ordered card carousel, the "No spoilers | Full results" toggle, the
// look swatches (season + normal, only inside a season), and the ordered CHANNELS row with, per channel, what travels
// (image / text / link), the tracked `/go/<slug>` link and the caption. Channels waiting on a registration (Stories,
// Snapchat, TikTok) come back in `hiddenChannels`, not `channels`.
//
// Every model encodes explicit `null`s (the fixtures are compared as canonical JSON), so the structs spell out
// `encode(to:)` instead of leaning on the synthesized `encodeIfPresent`.

public enum ShareSurface: String, Codable, CaseIterable { case finished, leaderboard, sweep, vs, profile, moment }
public enum SharePlay: String, Codable, CaseIterable { case daily, unlimited }
public enum SharePlatform: String, Codable, CaseIterable { case ios, android, web }
public enum ShareFrame: String, Codable, CaseIterable { case message, story, square }

public enum ShareCardKind: String, Codable, CaseIterable {
    case result, vsResult = "vs-result", dailySweep = "daily-sweep", leaderboard, moment, profile, streak, achievement
}

public enum ShareChannelId: String, Codable, CaseIterable {
    case copy, messages, whatsapp, stories, x, facebook, snapchat, tiktok, save, more
}

public enum ShareChannelAvailability: String, Codable { case ready, needsRegistration }

/// What the channel carries: the PNG alone, PNG + caption text, caption text + link, or just the link.
public enum ShareChannelPayload: String, Codable { case image, imageText, text, link }

/// The caption pick for this share (ShareCaptions); nil when the surface has no line (profile / moment).
public struct ShareSheetCaption: Decodable, Equatable {
    public var kind: ShareCaptions.Kind
    public var date: String
    public var game: String
    public var n: String? = nil
    public var t: String? = nil
    public var b: String? = nil
    public var d: Int? = nil
    public var k: String? = nil
    public var opp: String? = nil

    public init(kind: ShareCaptions.Kind, date: String, game: String, n: String? = nil, t: String? = nil, b: String? = nil,
                d: Int? = nil, k: String? = nil, opp: String? = nil) {
        self.kind = kind; self.date = date; self.game = game; self.n = n; self.t = t; self.b = b; self.d = d; self.k = k; self.opp = opp
    }
}

public struct ShareSheetContext: Decodable, Equatable {
    public var surface: ShareSurface
    /// Catalog mode id for a finished game ('regions', 'quordle', …); "" elsewhere.
    public var mode: String
    public var play: SharePlay?
    /// The card kinds this surface can render for this share (any order; the model orders them).
    public var cards: [ShareCardKind]
    public var hasSpoilerVariant: Bool
    /// The current (ready) season id, or nil outside a season.
    public var season: String?
    public var caption: ShareSheetCaption?

    public init(surface: ShareSurface, mode: String, play: SharePlay?, cards: [ShareCardKind], hasSpoilerVariant: Bool, season: String?, caption: ShareSheetCaption?) {
        self.surface = surface; self.mode = mode; self.play = play; self.cards = cards; self.hasSpoilerVariant = hasSpoilerVariant; self.season = season; self.caption = caption
    }
}

public struct ShareSheetCard: Encodable, Equatable {
    public let kind: ShareCardKind
    /// Carousel previews render the message frame; Stories re-render in `story` at tap time (channelFrame).
    public let frame: ShareFrame
    public let title: String
}

public struct ShareSheetVariantToggle: Encodable, Equatable {
    public let shown: Bool
    /// The sheet opens on this side (clean first: no spoilers by default).
    public let initial: ShareVariant
    public let copy: ShareVariantCopy
}

public struct ShareSheetLook: Encodable, Equatable {
    public let id: String
    public let label: String
}

public struct ShareSheetLooks: Encodable, Equatable {
    public let shown: Bool
    /// The season first, then "normal"; just ["normal"] outside a season.
    public let options: [ShareSheetLook]
    public let initial: String
}

public struct ShareSheetChannel: Encodable, Equatable {
    public let id: ShareChannelId
    public let label: String
    public let availability: ShareChannelAvailability
    public let payload: ShareChannelPayload
    /// The `/go/<slug>` link this channel carries; nil for image-only channels (§S1) and channels without a slug.
    public let link: String?
    /// The ShareCaptions line for text channels; nil when the channel carries no text or the context has no caption.
    public let caption: String?
    /// `caption + " " + link`, or whichever exists, for APIs that take one body; nil for image-only.
    public let text: String?
    /// Web only: the tile exists on phones and hides on desktop.
    public let mobileOnly: Bool

    enum CodingKeys: String, CodingKey { case id, label, availability, payload, link, caption, text, mobileOnly }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(label, forKey: .label); try c.encode(availability, forKey: .availability)
        try c.encode(payload, forKey: .payload); try c.encode(link, forKey: .link); try c.encode(caption, forKey: .caption)
        try c.encode(text, forKey: .text); try c.encode(mobileOnly, forKey: .mobileOnly)
    }
}

public struct ShareSheetModel: Encodable, Equatable {
    public let cards: [ShareSheetCard]
    public let variant: ShareSheetVariantToggle
    public let looks: ShareSheetLooks
    /// The ordered tiles to render (availability ready).
    public let channels: [ShareSheetChannel]
    /// Ordered tiles this platform could show once their registration exists (Stories, Snapchat, TikTok).
    public let hiddenChannels: [ShareSheetChannel]
}

public enum ShareSheet {
    // MARK: Cards

    /// Carousel order across every surface: the headline card first, then the extras.
    public static let cardOrder: [ShareCardKind] = [.result, .vsResult, .dailySweep, .leaderboard, .moment, .profile, .streak, .achievement]

    public static let cardTitles: [ShareCardKind: String] = [
        .result: "Result", .vsResult: "Race result", .dailySweep: "Daily sweep", .leaderboard: "Leaderboard",
        .moment: "Moment", .profile: "Profile", .streak: "Streak", .achievement: "Achievement",
    ]

    /// The card a surface always has, used when the context lists none.
    public static let surfaceDefaultCard: [ShareSurface: ShareCardKind] = [
        .finished: .result, .leaderboard: .leaderboard, .sweep: .dailySweep, .vs: .vsResult, .profile: .profile, .moment: .moment,
    ]

    public static func cards(_ surface: ShareSurface, _ available: [ShareCardKind]) -> [ShareSheetCard] {
        let want = available.isEmpty ? [surfaceDefaultCard[surface]!] : available
        return cardOrder.filter { want.contains($0) }.map { ShareSheetCard(kind: $0, frame: .message, title: cardTitles[$0]!) }
    }

    // MARK: Looks

    public static let lookLabels: [String: String] = ["normal": "Normal", "halloween": "Halloween", "thanksgiving": "Thanksgiving"]

    public static func lookLabel(_ id: String) -> String {
        if let known = lookLabels[id] { return known }
        guard let first = id.first else { return "" }
        return String(first).uppercased() + id.dropFirst()
    }

    public static func looks(_ season: String?) -> ShareSheetLooks {
        guard let season, !season.isEmpty, season != "normal" else {
            return ShareSheetLooks(shown: false, options: [ShareSheetLook(id: "normal", label: "Normal")], initial: "normal")
        }
        return ShareSheetLooks(shown: true, options: [ShareSheetLook(id: season, label: lookLabel(season)), ShareSheetLook(id: "normal", label: "Normal")], initial: season)
    }

    // MARK: Channels

    /// The CHANNELS row, left to right (direction A, plus Save image and TikTok).
    public static let channelOrder: [ShareChannelId] = [.copy, .messages, .whatsapp, .stories, .x, .facebook, .snapchat, .tiktok, .save, .more]

    public static let channelLabels: [ShareChannelId: String] = [
        .copy: "Copy link", .messages: "Messages", .whatsapp: "WhatsApp", .stories: "Stories", .x: "X",
        .facebook: "Facebook", .snapchat: "Snapchat", .tiktok: "TikTok", .save: "Save image", .more: "More",
    ]

    /// marketing_links slugs; nil = no tracked link.
    public static let channelSlugs: [ShareChannelId: String?] = [
        .copy: "copy", .messages: "msg", .whatsapp: "wa", .stories: "instagram", .x: "x",
        .facebook: "facebook", .snapchat: "snapchat", .tiktok: "tiktok", .save: nil, .more: nil,
    ]

    public static let channelAvailability: [ShareChannelId: ShareChannelAvailability] = [
        .copy: .ready, .messages: .ready, .whatsapp: .ready, .stories: .needsRegistration, .x: .ready,
        .facebook: .ready, .snapchat: .needsRegistration, .tiktok: .needsRegistration, .save: .ready, .more: .ready,
    ]

    /// Plan §2, encoded: what each channel carries on each platform; nil = the channel does not exist there.
    public static let channelPayloads: [ShareChannelId: [SharePlatform: ShareChannelPayload?]] = [
        .copy: [.ios: .link, .android: .link, .web: .link],
        .messages: [.ios: .image, .android: .image, .web: .text],
        .whatsapp: [.ios: .image, .android: .image, .web: .text],
        .stories: [.ios: .image, .android: .image, .web: nil],
        .x: [.ios: .image, .android: .imageText, .web: .text],
        .facebook: [.ios: .image, .android: .image, .web: .link],
        .snapchat: [.ios: .image, .android: .image, .web: .link],
        .tiktok: [.ios: .image, .android: .image, .web: nil],
        .save: [.ios: .image, .android: .image, .web: .image],
        .more: [.ios: .image, .android: .image, .web: .image],
    ]

    /// Web tiles that only make sense on a phone (sms: / wa.me).
    public static let webMobileOnly: [ShareChannelId] = [.messages, .whatsapp]

    public static let linkBase = "https://wordocious.com/go/"

    public static func payload(_ channel: ShareChannelId, _ platform: SharePlatform) -> ShareChannelPayload? {
        channelPayloads[channel]?[platform] ?? nil
    }

    /// The tracked link: `/go/<slug>?s=<surface>[&m=<mode>]`.
    public static func link(_ channel: ShareChannelId, surface: ShareSurface, mode: String) -> String? {
        guard let slug = channelSlugs[channel] ?? nil else { return nil }
        let query = mode.isEmpty ? "?s=\(surface.rawValue)" : "?s=\(surface.rawValue)&m=\(mode)"
        return linkBase + slug + query
    }

    /// Stories / Snapchat / TikTok want the 9:16 story frame; everything else the message frame.
    public static func frame(_ channel: ShareChannelId) -> ShareFrame {
        channel == .stories || channel == .snapchat || channel == .tiktok ? .story : .message
    }

    public static func carriesImage(_ channel: ShareChannelId, _ platform: SharePlatform) -> Bool {
        let p = payload(channel, platform)
        return p == .image || p == .imageText
    }

    public static func carriesLink(_ channel: ShareChannelId, _ platform: SharePlatform) -> Bool {
        let p = payload(channel, platform)
        return p == .link || p == .text || p == .imageText
    }

    public static func channel(_ channel: ShareChannelId, _ platform: SharePlatform, _ ctx: ShareSheetContext) -> ShareSheetChannel? {
        guard let payload = payload(channel, platform) else { return nil }
        let trackedLink: String? = carriesLink(channel, platform) ? ShareSheet.link(channel, surface: ctx.surface, mode: ctx.mode) : nil
        let wantsText = payload == .text || payload == .imageText
        var caption: String? = nil
        if wantsText, let c = ctx.caption {
            caption = ShareCaptions.caption(c.kind, ShareCaptions.Vars(date: c.date, game: c.game, n: c.n, t: c.t, b: c.b, d: c.d, k: c.k, opp: c.opp))
        }
        let text: String?
        if let caption, let trackedLink { text = "\(caption) \(trackedLink)" } else if wantsText { text = caption ?? trackedLink } else { text = nil }
        return ShareSheetChannel(id: channel, label: channelLabels[channel]!, availability: channelAvailability[channel]!, payload: payload,
                                 link: trackedLink, caption: caption, text: text, mobileOnly: platform == .web && webMobileOnly.contains(channel))
    }

    // MARK: The model

    public static func model(_ ctx: ShareSheetContext, _ platform: SharePlatform) -> ShareSheetModel {
        let cardList = ShareSheet.cards(ctx.surface, ctx.cards)
        let variant = ShareSheetVariantToggle(shown: ctx.hasSpoilerVariant && cardList.contains { $0.kind == .result }, initial: .clean, copy: ShareSpoilers.variantCopy(ctx.mode))
        let lookSet = ShareSheet.looks(ctx.season)
        var channels: [ShareSheetChannel] = [], hidden: [ShareSheetChannel] = []
        for id in channelOrder {
            guard let ch = ShareSheet.channel(id, platform, ctx) else { continue }
            if ch.availability == .ready { channels.append(ch) } else { hidden.append(ch) }
        }
        return ShareSheetModel(cards: cardList, variant: variant, looks: lookSet, channels: channels, hiddenChannels: hidden)
    }
}

public func shareSheetModel(_ ctx: ShareSheetContext, _ platform: SharePlatform) -> ShareSheetModel { ShareSheet.model(ctx, platform) }
public func channelFrame(_ channel: ShareChannelId) -> ShareFrame { ShareSheet.frame(channel) }
public func channelCarriesImage(_ channel: ShareChannelId, _ platform: SharePlatform) -> Bool { ShareSheet.carriesImage(channel, platform) }
