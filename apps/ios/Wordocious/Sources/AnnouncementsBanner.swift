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
                // FINISH_SPEC §K1: a tinted notice card with its top bar, a small
                // cast pose (O2 strutting the news — Home's host is W), the headline
                // in Nunito Black; the ✕ is a bare icon with the squish.
                HStack(alignment: .center, spacing: 10) {
                    PoseImage(.o2, "strut", height: 46)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Image(systemName: "megaphone.fill")
                                .font(.system(size: 11)).foregroundStyle(Color(hex: 0x7C3AED))
                                .accessibilityHidden(true)
                            Text(a.title)
                                .font(Brand.font(13, .black))
                                .foregroundStyle(FinishInk.heading)
                        }
                        Text(a.body).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    Button { dismiss(a) } label: {
                        Image(systemName: "xmark").font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(FinishInk.secondary)
                            .frame(width: 30, height: 30)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.squishIcon)
                    .accessibilityLabel("Dismiss announcement")
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .tintedCard(accent: G5Accent.purple, bar: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], radius: 18, barHeight: 6)
                .transition(G5Toast.transition)
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
        withAnimation(G5Toast.animation) { current = nil }
    }

    private func load() async {
        let rows: [Announcement]? = try? await AuthService.shared.client
            .from("announcements")
            .select("id, title, body")
            .order("created_at", ascending: false)
            .limit(5)
            .execute().value
        let dismissed = dismissedIds()
        let next = rows?.first { !dismissed.contains($0.id) }
        // §K1: the notice slides in with a spring (Reduce Motion: a fade).
        withAnimation(G5Toast.animation) { current = next }
    }
}
