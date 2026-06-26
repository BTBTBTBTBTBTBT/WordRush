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
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    default: fallback
                    }
                }
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
            try await client.storage.from("avatars")
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
