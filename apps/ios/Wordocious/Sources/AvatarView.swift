import SwiftUI
import Supabase
#if canImport(UIKit)
import UIKit
#endif

/// Player avatar — shows the uploaded photo (`avatar_url`) if present, else a
/// gradient circle with the username's initial. Mirrors the web AvatarUpload
/// fallback. Used on the profile, public profiles, and the edit sheet.
struct AvatarView: View {
    let url: String?
    let username: String
    var size: CGFloat = 96
    /// Personalization (optional): when there's no photo, tint the fallback with
    /// the player's accent and show their chosen emoji instead of the initial.
    var accentHex: String? = nil
    var emoji: String? = nil

    // Web parity: two-character initials fallback (avatar-upload.tsx slice(0, 2)).
    private var initial: String { String(username.prefix(2)).uppercased() }

    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                #if canImport(UIKit)
                CachedAvatarImage(url: u) { fallback }
                #else
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: fallback
                    }
                }
                #endif
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var fallback: some View {
        let emo = emoji?.trimmingCharacters(in: .whitespaces)
        return Circle()
            .fill(accentHex != nil
                  ? AnyShapeStyle(LinearGradient(colors: [ProfileAccent.color(accentHex), Color(hex: ProfileAccent.darker(ProfileAccent.hex(accentHex)))], startPoint: .topLeading, endPoint: .bottomTrailing))
                  : AnyShapeStyle(Theme.wordmarkGradient))
            .overlay(Text(emo?.isEmpty == false ? emo! : initial)
                .font(Brand.title(size * 0.4)).foregroundStyle(.white))
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
