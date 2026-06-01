import SwiftUI

/// Edit username + social links — ports the web profile-edit-modal. (Avatar
/// photo upload is deferred — native shows the initial avatar.) Handles are
/// stored without a leading @; the website is stored as-is.
struct EditProfileView: View {
    @ObservedObject private var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var socials: [String: String] = [:]
    @State private var error: String?
    @State private var saving = false

    private let platforms: [(key: String, label: String, placeholder: String)] = [
        ("twitter", "Twitter / X", "username"), ("instagram", "Instagram", "username"),
        ("tiktok", "TikTok", "username"), ("threads", "Threads", "username"),
        ("discord", "Discord", "username"), ("website", "Website", "https://example.com"),
    ]

    private struct EditUpdate: Encodable { let username: String; let social_links: [String: String] }

    var body: some View {
        NavigationStack {
            Form {
                Section("Username") {
                    TextField("username", text: $username)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    if let error { Text(error).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0xDC2626)) }
                }
                Section("Social Links") {
                    ForEach(platforms, id: \.key) { p in
                        HStack {
                            Text(p.label).font(Brand.font(13, .bold)).foregroundStyle(Theme.textSecondary).frame(width: 110, alignment: .leading)
                            TextField(p.placeholder, text: Binding(
                                get: { socials[p.key] ?? "" },
                                set: { socials[p.key] = $0 }))
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .keyboardType(p.key == "website" ? .URL : .default)
                        }
                    }
                }
            }
            .navigationTitle("Edit Profile").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(saving ? "Saving…" : "Save") { save() }.disabled(saving).bold()
                }
            }
            .task {
                username = auth.profile?.username ?? ""
                if let uid = auth.profile?.id { socials = await ProfileExtras.socialLinks(userId: uid) }
            }
        }
    }

    private func validate(_ name: String) -> String? {
        let t = name.trimmingCharacters(in: .whitespaces)
        if t.count < 3 { return "At least 3 characters" }
        if t.count > 20 { return "20 characters max" }
        if t.range(of: "^[a-zA-Z0-9_]+$", options: .regularExpression) == nil { return "Letters, numbers, and underscores only" }
        return nil
    }

    /// Strip a leading @ / whitespace from handles; keep websites as typed.
    private func sanitize(_ key: String, _ raw: String) -> String {
        let t = raw.trimmingCharacters(in: .whitespaces)
        if key == "website" { return t }
        return t.hasPrefix("@") ? String(t.dropFirst()) : t
    }

    private func save() {
        let t = username.trimmingCharacters(in: .whitespaces)
        if let v = validate(t) { error = v; return }
        guard let uid = auth.profile?.id else { return }
        var cleaned: [String: String] = [:]
        for p in platforms {
            let v = sanitize(p.key, socials[p.key] ?? "")
            if !v.isEmpty { cleaned[p.key] = v }
        }
        saving = true; error = nil
        Task {
            do {
                try await auth.client.from("profiles").update(EditUpdate(username: t, social_links: cleaned)).eq("id", value: uid).execute()
                await auth.refreshProfile()
                dismiss()
            } catch {
                let msg = "\(error)"
                self.error = msg.contains("23505") || msg.lowercased().contains("duplicate") ? "Username already taken" : "Something went wrong"
                saving = false
            }
        }
    }
}
