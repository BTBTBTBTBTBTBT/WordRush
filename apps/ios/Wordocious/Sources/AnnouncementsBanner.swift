import SwiftUI

/// Native reader for the admin-authored announcements table (web parity:
/// components/ui/announcements-banner.tsx). RLS serves only active +
/// unexpired rows; dismissals are per-announcement in UserDefaults.
struct AnnouncementsBanner: View {
    struct Announcement: Decodable, Identifiable {
        let id: String
        let title: String
        let body: String
    }

    @State private var current: Announcement?
    private static let dismissedKey = "dismissed-announcements"

    var body: some View {
        Group {
            if let a = current {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "megaphone.fill")
                        .font(.system(size: 13)).foregroundStyle(Color(hex: 0x7C3AED))
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(a.title)
                            .font(Brand.font(13, .black))
                            .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                        Text(a.body).font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer(minLength: 0)
                    Button { dismiss(a) } label: {
                        Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.textMuted)
                    }.buttonStyle(.plain)
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
            }
        }
        .task { await load() }
    }

    private func dismissedIds() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: Self.dismissedKey) ?? [])
    }

    private func dismiss(_ a: Announcement) {
        var ids = dismissedIds(); ids.insert(a.id)
        UserDefaults.standard.set(Array(ids), forKey: Self.dismissedKey)
        withAnimation { current = nil }
    }

    private func load() async {
        let rows: [Announcement]? = try? await AuthService.shared.client
            .from("announcements")
            .select("id, title, body")
            .order("created_at", ascending: false)
            .limit(5)
            .execute().value
        let dismissed = dismissedIds()
        current = rows?.first { !dismissed.contains($0.id) }
    }
}
