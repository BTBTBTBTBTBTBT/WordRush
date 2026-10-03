import SwiftUI
import Supabase
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// Player avatar — FINISH_SPEC §AN / BJ5: the ONE avatar every surface draws. What it
/// shows comes from AvatarDirectory.look (core AvatarResolve): the custom photo when
/// display = photo (a rounded square, §AN6: never a circle, in the player's frame), else
/// the saved mascot, else a worn cast hero's preset, else the seeded default mascot, with
/// the initial as the body letter. The signed-in player's own avatar always comes from
/// their live profile. Never an emoji (§AM2), never a plain letter tile.
struct AvatarView: View {
    let url: String?
    let username: String
    var size: CGFloat = 96
    /// Personalization (optional): when there's no photo, the default mascot takes
    /// the player's accent. (`emoji` is retired, §AM2: passed through, never drawn.)
    var accentHex: String? = nil
    var emoji: String? = nil
    /// FINISH_SPEC §AA2: a Pro player's avatar wears the gold frame + the tiny
    /// crown on its top-right corner. Pass it only where the data says so (the
    /// signed-in player's own avatar wears it everywhere on its own, BJ5).
    var pro: Bool = false
    /// FINISH_SPEC §AH: the worn cast hero ("w" … "s") and level-tier frame
    /// ("bronze" … "diamond"). nil = the player's recorded look when `lookup`.
    var castId: String? = nil
    var frame: String? = nil
    /// false draws exactly what is passed (Edit Profile's live, unsaved choice).
    var lookup: Bool = true
    /// FINISH_SPEC §AN: an explicit mascot (Edit Profile's live preview); nil =
    /// the player's saved one when `lookup`.
    var mascot: AvatarConfig? = nil
    /// The row's user id when known (the own-avatar match; BJ5).
    var userId: String? = nil
    /// Share images are always light (ShareKit).
    var alwaysLight: Bool = false
    /// false = no thin body-color edge on an unframed mascot tile (the Pick a Friend grid only).
    var stroke: Bool = true

    @ObservedObject private var directory = AvatarDirectory.shared
    @ObservedObject private var looks = CastAvatars.shared
    @ObservedObject private var mascots = MascotLooks.shared

    /// Whether wrappers should follow the rounded-square outline
    /// (`AvatarOutline(tile:)`). FINISH_SPEC §AN6: photos, mascots and worn
    /// heroes are ALL rounded squares now, so this is always true (kept so the
    /// call sites keep compiling).
    static func showsTile(_ url: String?) -> Bool { true }

    /// §AH: kept for call sites that pass the username (always true, §AN6).
    static func showsTile(_ url: String?, username: String?) -> Bool { true }

    var body: some View {
        // FINISH_SPEC BJ5: the one resolver (AvatarDirectory → core AvatarResolve).
        let look = directory.look(username: username, userId: userId, url: url, castId: castId, frame: frame,
                                  mascot: mascot, accentHex: LetterTileAvatar.defaultAccentHex(username: username, accentHex: accentHex),
                                  lookup: lookup)
        let r = look.resolved
        let wearsPro = pro || look.ownPro
        // BJ6: a photo is a framed portrait (the chosen frame, else — for the signed-in player,
        // whose level is known — their tier's art frame); a mascot wears its own frame.
        let ownLevel = look.ownPro || directory.isOwn(username: username, userId: userId) ? AuthService.shared.profile?.level : nil
        let ring: String? = r.photoUrl != nil && lookup ? AvatarDirectory.portraitFrame(r, level: ownLevel, pro: wearsPro)
            : (r.config.frame == "none" ? nil : r.config.frame)
        Group {
            if let u = r.photoUrl.flatMap(URL.init(string:)) {
                // §AN6: photos are rounded squares (the tile's radius), never circles;
                // the mascot stands in while it loads. The frame insets the photo by its width.
                let inner = ring != nil ? size - AvatarCastArt.frameWidth(size) * 2 : size
                ZStack {
                    Group {
                        #if canImport(UIKit)
                        CachedAvatarImage(url: u) { fallback(r.config, look.initial) }
                        #else
                        AsyncImage(url: u) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFill()
                            default: fallback(r.config, look.initial)
                            }
                        }
                        #endif
                    }
                    .frame(width: inner, height: inner)
                    .clipShape(AvatarOutline(tile: true))
                    if let ring { MascotFrame(frame: ring, size: size) }
                }
                .frame(width: size, height: size)
                .proAvatarMark(wearsPro && ring != "pro", size: size, tile: true)
            } else {
                MascotAvatar(config: r.config, initial: look.initial, size: size, alwaysLight: alwaysLight, stroke: stroke)
                    .frame(width: size, height: size)
                    // §AN6: the Pro gold frame + crown follows the rounded square (a "pro" frame already wears it).
                    .proAvatarMark(wearsPro && r.config.frame != "pro", size: size, tile: true)
            }
        }
        .onAppear { if lookup { directory.want(username: username) } }
    }

    private func fallback(_ config: AvatarConfig, _ initial: String) -> some View {
        var bare = config
        bare.frame = "none"
        return MascotAvatar(config: bare, initial: initial, size: size, alwaysLight: alwaysLight, stroke: stroke)
    }
}

#if canImport(UIKit)
/// Decoded avatars kept in memory for the session (founder, 2026-09-29):
/// AsyncImage has no memory cache, so every leaderboard mode switch re-fetched
/// and flashed the initials first. A cached URL paints on the first frame;
/// a miss loads through Net.api (URLCache-backed) and decodes off the main thread.
enum AvatarImageCache {
    private static let cache: NSCache<NSURL, UIImage> = { let c = NSCache<NSURL, UIImage>(); c.countLimit = 300; return c }()
    static func cached(_ url: URL) -> UIImage? { cache.object(forKey: url as NSURL) }
    static func load(_ url: URL) async -> UIImage? {
        if let hit = cached(url) { return hit }
        guard let (data, resp) = try? await Net.api.data(from: url),
              (resp as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
              let raw = UIImage(data: data) else { return nil }
        let img = await raw.byPreparingForDisplay() ?? raw
        cache.setObject(img, forKey: url as NSURL)
        return img
    }
}

/// The avatar photo from AvatarImageCache, `placeholder` until it arrives.
private struct CachedAvatarImage<Placeholder: View>: View {
    let url: URL
    @ViewBuilder let placeholder: () -> Placeholder
    @State private var loaded: (url: URL, image: UIImage)?

    var body: some View {
        if let img = loaded?.url == url ? loaded?.image : AvatarImageCache.cached(url) {
            Image(uiImage: img).resizable().scaledToFill()
        } else {
            placeholder().task(id: url) {
                if let img = await AvatarImageCache.load(url) { loaded = (url, img) }
            }
        }
    }
}
#endif

/// Uploads a chosen photo to the public `avatars` bucket and returns the
/// cache-busted public URL — ports components/profile/avatar-upload.tsx
/// (resize to 256², JPEG, path `<uid>/avatar.jpg`, upsert).
enum AvatarUploader {
    static func upload(_ data: Data) async -> String? {
        #if canImport(UIKit)
        let client = AuthService.shared.client
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased(),
              let image = UIImage(data: data),
              let jpeg = resize(image, to: 256).jpegData(compressionQuality: 0.85) else { return nil }
        let path = "\(uid)/avatar.jpg"
        do {
            // Upload client: same session token, long-timeout URLSession (founder, 2026-09-29).
            try await AuthService.shared.uploadClient.storage.from("avatars")
                .upload(path, data: jpeg, options: FileOptions(contentType: "image/jpeg", upsert: true))
        } catch { return nil }
        // Deterministic public URL (matches getPublicURL output) + a cache-buster
        // so the new image shows immediately (web does the same).
        let base = "\(SupabaseConfig.url.absoluteString)/storage/v1/object/public/avatars/\(path)"
        return "\(base)?t=\(Int(Date().timeIntervalSince1970))"
        #else
        return nil
        #endif
    }

    #if canImport(UIKit)
    private static func resize(_ image: UIImage, to side: CGFloat) -> UIImage {
        let target = CGSize(width: side, height: side)
        let scale = max(side / image.size.width, side / image.size.height)
        let scaled = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let origin = CGPoint(x: (side - scaled.width) / 2, y: (side - scaled.height) / 2)
        let r = UIGraphicsImageRenderer(size: target)
        return r.image { _ in image.draw(in: CGRect(origin: origin, size: scaled)) }
    }
    #endif
}
