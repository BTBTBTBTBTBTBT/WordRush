import SwiftUI
import PhotosUI

/// Edit avatar + username + bio + personalization (accent / featured title /
/// favorite mode) + social links — ports the web profile-edit-modal. Restyled to
/// the app chrome (accent bar + gradient title + cards) with a live preview.
struct EditProfileView: View {
    @ObservedObject private var auth = AuthService.shared
    @ObservedObject private var catalog = AchievementCatalog.shared
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var socials: [String: String] = [:]
    @State private var bio = ""
    @State private var accent: String?          // hex or nil (= default)
    @State private var favoriteMode: String?    // dbKey or nil
    @State private var featured: String?        // achievement key or nil
    @State private var avatarEmoji = ""
    @State private var unlocked: Set<String> = []
    @State private var error: String?
    @State private var saving = false
    @State private var photoItem: PhotosPickerItem?
    @State private var uploadingAvatar = false
    @State private var showPhotoChoice = false
    @State private var showLibraryPicker = false
    @State private var showCamera = false

    private let bioMax = 80
    private let platforms: [(key: String, label: String, placeholder: String)] = [
        ("twitter", "Twitter / X", "username"), ("instagram", "Instagram", "username"),
        ("tiktok", "TikTok", "username"), ("threads", "Threads", "username"),
        ("discord", "Discord", "username"), ("website", "Website", "https://example.com"),
    ]
    private var dailyModes: [HomeMode] { homeModes.filter { $0.dbKey != nil && $0.dbKey != "VS" } }
    private var unlockedDefs: [AchievementDef] { catalog.all.filter { unlocked.contains($0.key) } }
    private var accentColor: Color { ProfileAccent.color(accent) }
    private var card: some View {
        RoundedRectangle(cornerRadius: 16).fill(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)], startPoint: .leading, endPoint: .trailing)
                .frame(height: 6)
            HStack {
                Button("Cancel") { dismiss() }.font(Brand.font(15, .bold)).foregroundStyle(Theme.textMuted)
                Spacer()
                Text("EDIT PROFILE").font(Brand.font(18, .black)).foregroundStyle(Theme.wordmarkGradient)
                Spacer()
                Button(saving ? "Saving…" : "Save") { save() }.font(Brand.font(15, .black)).foregroundStyle(Theme.primary).disabled(saving)
            }
            .padding(.horizontal, 18).padding(.vertical, 12)

            ScrollView {
                VStack(spacing: 14) {
                    preview
                    avatarSection
                    sectionCard("USERNAME") {
                        TextField("username", text: $username)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                            .font(Brand.font(15, .bold))
                        if let error { Text(error).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0xDC2626)) }
                    }
                    // Count/truncate by unicode SCALARS, not Characters: the DB
                    // CHECK is char_length (code points), and one family emoji
                    // is 1 Character but 7 code points — a Character-counted
                    // "80/80" bio can violate the CHECK and fail the whole save.
                    sectionCard("BIO  ·  \(bio.unicodeScalars.count)/\(bioMax)") {
                        TextField("A short tagline…", text: $bio, axis: .vertical)
                            .lineLimit(1...3).font(Brand.font(14, .regular))
                            .onChange(of: bio) {
                                if $0.unicodeScalars.count > bioMax {
                                    bio = String(String.UnicodeScalarView($0.unicodeScalars.prefix(bioMax)))
                                }
                            }
                    }
                    sectionCard("ACCENT COLOR") { accentRow }
                    sectionCard("FEATURED TITLE") { titlePicker }
                    sectionCard("FAVORITE MODE") { modeRow }
                    sectionCard("SOCIALS") { socialFields }
                }
                .padding(16)
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .task {
            username = auth.profile?.username ?? ""
            bio = auth.profile?.bio ?? ""
            accent = auth.profile?.accentColor
            favoriteMode = auth.profile?.favoriteMode
            featured = auth.profile?.featuredAchievement
            avatarEmoji = auth.profile?.avatarEmoji ?? ""
            await catalog.load()
            if let uid = auth.profile?.id {
                socials = await ProfileExtras.socialLinks(userId: uid)
                unlocked = await AchievementService.fetchUnlocked(userId: uid)
            }
        }
        .onChange(of: photoItem) { item in
            guard let item else { return }
            uploadingAvatar = true
            Task { await uploadAvatar(item); uploadingAvatar = false }
        }
        .confirmationDialog("Change Photo", isPresented: $showPhotoChoice, titleVisibility: .visible) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) { Button("Take Photo") { showCamera = true } }
            Button("Choose from Library") { showLibraryPicker = true }
            if auth.profile?.avatarUrl != nil { Button("Remove Photo", role: .destructive) { Task { await removeAvatar() } } }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(isPresented: $showLibraryPicker, selection: $photoItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                showCamera = false
                guard let data = image?.jpegData(compressionQuality: 0.9) else { return }
                uploadingAvatar = true
                Task { await uploadAvatar(data: data); uploadingAvatar = false }
            }.ignoresSafeArea()
        }
    }

    // MARK: - Live preview

    private var preview: some View {
        VStack(spacing: 6) {
            previewAvatar
            Text(username.trimmingCharacters(in: .whitespaces).isEmpty ? "username" : username)
                .font(Brand.font(18, .black)).foregroundStyle(accentColor)
            if let key = featured, let def = catalog.all.first(where: { $0.key == key }) {
                pill(label: def.name, system: "star.fill", color: accentColor)
            }
            let b = bio.trimmingCharacters(in: .whitespaces)
            if !b.isEmpty { Text(b).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center) }
            if let m = dailyModes.first(where: { $0.dbKey == favoriteMode }) {
                HStack(spacing: 5) {
                    ModeIconView(icon: m.icon, accent: m.accent, box: 16)
                    Text(m.title).font(Brand.font(11, .bold)).foregroundStyle(m.accent)
                }
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(m.accent.opacity(0.12)))
            }
        }
        .frame(maxWidth: .infinity).padding(16).background(card)
    }

    private var previewAvatar: some View {
        ZStack {
            if let url = auth.profile?.avatarUrl {
                AvatarView(url: url, username: username, size: 64)
            } else {
                Circle().fill(LinearGradient(colors: [accentColor, Color(hex: ProfileAccent.darker(ProfileAccent.hex(accent)))], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 64, height: 64)
                    .overlay(Text(avatarEmoji.isEmpty ? String(username.prefix(1)).uppercased() : avatarEmoji)
                        .font(Brand.font(avatarEmoji.isEmpty ? 26 : 30, .black)).foregroundStyle(.white))
            }
        }
    }

    // MARK: - Sections

    private var avatarSection: some View {
        VStack(spacing: 8) {
            Button { showPhotoChoice = true } label: {
                Text(uploadingAvatar ? "Uploading…" : "Change Photo").font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
            }.disabled(uploadingAvatar).buttonStyle(.plain)
            HStack(spacing: 8) {
                Text("Avatar emoji").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                TextField("🎯", text: $avatarEmoji).frame(width: 44).multilineTextAlignment(.center)
                    .onChange(of: avatarEmoji) { avatarEmoji = String($0.prefix(2)) }
                    .padding(6).background(RoundedRectangle(cornerRadius: 8).fill(Theme.surfaceAlt))
                Text("(shown when you have no photo)").font(Brand.font(10, .regular)).foregroundStyle(Theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 4)
    }

    private var accentRow: some View {
        HStack(spacing: 10) {
            ForEach(ProfileAccent.palette, id: \.id) { sw in
                let selected = ProfileAccent.hex(accent) == sw.hex
                Circle().fill(Color(hex: sw.hex)).frame(width: 30, height: 30)
                    .overlay(Circle().stroke(Theme.surface, lineWidth: 2))
                    .overlay(selected ? Circle().stroke(Color(hex: sw.hex), lineWidth: 2).padding(-3) : nil)
                    .onTapGesture { accent = sw.id == "purple" ? nil : String(format: "#%06X", sw.hex) }
            }
            Spacer()
        }
    }

    private var titlePicker: some View {
        Group {
            if unlockedDefs.isEmpty {
                Text("Unlock achievements to wear one as a title.").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], alignment: .leading, spacing: 8) {
                    chip("None", selected: featured == nil) { featured = nil }
                    ForEach(unlockedDefs) { def in
                        chip(def.name, selected: featured == def.key, icon: "star.fill") { featured = def.key }
                    }
                }
            }
        }
    }

    private var modeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("None", selected: favoriteMode == nil) { favoriteMode = nil }
                ForEach(dailyModes) { m in
                    Button { favoriteMode = m.dbKey } label: {
                        ModeIconView(icon: m.icon, accent: m.accent, box: 36)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(m.accent, lineWidth: favoriteMode == m.dbKey ? 2 : 0))
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    private var socialFields: some View {
        VStack(spacing: 8) {
            ForEach(platforms, id: \.key) { p in
                HStack {
                    Text(p.label).font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary).frame(width: 96, alignment: .leading)
                    TextField(p.placeholder, text: Binding(get: { socials[p.key] ?? "" }, set: { socials[p.key] = $0 }))
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .keyboardType(p.key == "website" ? .URL : .default).font(Brand.font(13, .regular))
                }
            }
        }
    }

    // MARK: - Small components

    private func sectionCard<C: View>(_ title: String, @ViewBuilder _ inner: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(Brand.font(11, .black)).tracking(0.6).foregroundStyle(Theme.textMuted)
            inner()
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(14).background(card)
    }

    private func pill(label: String, system: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: system).font(.system(size: 9, weight: .bold))
            Text(label.uppercased()).font(Brand.font(10, .black)).tracking(0.4)
        }
        .foregroundStyle(color).padding(.horizontal, 8).padding(.vertical, 3)
        .background(Capsule().fill(color.opacity(0.12)))
    }

    private func chip(_ label: String, selected: Bool, icon: String? = nil, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon { Image(systemName: icon).font(.system(size: 9, weight: .bold)) }
                Text(label).font(Brand.font(11, .bold))
            }
            .foregroundStyle(selected ? .white : Theme.textPrimary)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Capsule().fill(selected ? accentColor : Theme.surfaceAlt))
        }.buttonStyle(.plain)
    }

    // MARK: - Save

    private struct EditUpdate: Encodable {
        let username: String?
        let social_links: [String: String]
        let bio: String?
        let accent_color: String?
        let favorite_mode: String?
        let featured_achievement: String?
        let avatar_emoji: String?
        enum CodingKeys: String, CodingKey { case username, social_links, bio, accent_color, favorite_mode, featured_achievement, avatar_emoji }
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            if let username { try c.encode(username, forKey: .username) }
            try c.encode(social_links, forKey: .social_links)
            try c.encode(bio, forKey: .bio)                          // null clears
            try c.encode(accent_color, forKey: .accent_color)
            try c.encode(favorite_mode, forKey: .favorite_mode)
            try c.encode(featured_achievement, forKey: .featured_achievement)
            try c.encode(avatar_emoji, forKey: .avatar_emoji)
        }
    }
    private struct AvatarUpdate: Encodable { let avatar_url: String? }

    private func validate(_ name: String) -> String? {
        let t = name.trimmingCharacters(in: .whitespaces)
        if t.count < 3 || t.count > 20 { return "Username must be 3-20 characters" }
        return nil
    }
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
        let trimmedBio = bio.trimmingCharacters(in: .whitespaces)
        let emoji = avatarEmoji.trimmingCharacters(in: .whitespaces)
        let payload = EditUpdate(
            username: t != auth.profile?.username ? t : nil,
            social_links: cleaned,
            bio: trimmedBio.isEmpty ? nil : trimmedBio,
            accent_color: accent,
            favorite_mode: favoriteMode,
            featured_achievement: (featured.map { unlocked.contains($0) } ?? false) ? featured : nil,
            avatar_emoji: emoji.isEmpty ? nil : emoji)
        saving = true; error = nil
        Task {
            do {
                try await auth.client.from("profiles").update(payload).eq("id", value: uid).execute()
                await auth.refreshProfile()
                dismiss()
            } catch {
                let msg = "\(error)"
                self.error = msg.contains("23505") || msg.lowercased().contains("duplicate")
                    ? "Username already taken"
                    : (error.localizedDescription.isEmpty ? "Failed to save" : error.localizedDescription)
                saving = false
            }
        }
    }

    private func uploadAvatar(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            error = "Avatar upload failed. Please try again."; return
        }
        await uploadAvatar(data: data)
    }
    private func uploadAvatar(data: Data) async {
        guard let uid = auth.profile?.id else { return }
        guard let url = await AvatarUploader.upload(data) else {
            error = "Avatar upload failed. Please try again."; return
        }
        try? await auth.client.from("profiles").update(AvatarUpdate(avatar_url: url)).eq("id", value: uid).execute()
        await auth.refreshProfile()
    }
    private func removeAvatar() async {
        guard let uid = auth.profile?.id else { return }
        try? await auth.client.from("profiles").update(AvatarUpdate(avatar_url: nil)).eq("id", value: uid).execute()
        await auth.refreshProfile()
    }
}

/// System camera picker (UIImagePickerController, .camera source) for SwiftUI.
private struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage?) -> Void
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera; picker.allowsEditing = true; picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage) }
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImage: (UIImage?) -> Void
        init(onImage: @escaping (UIImage?) -> Void) { self.onImage = onImage }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onImage((info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage))
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onImage(nil) }
    }
}
