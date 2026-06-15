import SwiftUI
import PhotosUI

/// Edit avatar + username + social links — ports the web profile-edit-modal.
/// Handles are stored without a leading @; the website is stored as-is.
struct EditProfileView: View {
    @ObservedObject private var auth = AuthService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var socials: [String: String] = [:]
    @State private var error: String?
    @State private var saving = false
    @State private var photoItem: PhotosPickerItem?
    @State private var uploadingAvatar = false
    @State private var showPhotoChoice = false
    @State private var showLibraryPicker = false
    @State private var showCamera = false

    private let platforms: [(key: String, label: String, placeholder: String)] = [
        ("twitter", "Twitter / X", "username"), ("instagram", "Instagram", "username"),
        ("tiktok", "TikTok", "username"), ("threads", "Threads", "username"),
        ("discord", "Discord", "username"), ("website", "Website", "https://example.com"),
    ]

    private struct EditUpdate: Encodable { let username: String; let social_links: [String: String] }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        VStack(spacing: 10) {
                            ZStack(alignment: .bottomTrailing) {
                                AvatarView(url: auth.profile?.avatarUrl, username: auth.profile?.username ?? "", size: 84)
                                    .opacity(uploadingAvatar ? 0.5 : 1)
                                if uploadingAvatar { ProgressView() }
                            }
                            Button {
                                showPhotoChoice = true
                            } label: {
                                Text(uploadingAvatar ? "Uploading…" : "Change Photo")
                                    .font(Brand.font(12, .heavy)).foregroundStyle(Theme.primary)
                            }
                            .disabled(uploadingAvatar)
                            .buttonStyle(.plain)
                        }
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
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
            .onChange(of: photoItem) { item in
                guard let item else { return }
                uploadingAvatar = true
                Task { await uploadAvatar(item); uploadingAvatar = false }
            }
            // Take Photo (camera) or Choose from Library — web mobile file
            // inputs already offer both; this brings the native flow to parity.
            .confirmationDialog("Change Photo", isPresented: $showPhotoChoice, titleVisibility: .visible) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Take Photo") { showCamera = true }
                }
                Button("Choose from Library") { showLibraryPicker = true }
                Button("Cancel", role: .cancel) {}
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $photoItem, matching: .images)
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { image in
                    showCamera = false
                    guard let data = image?.jpegData(compressionQuality: 0.9) else { return }
                    uploadingAvatar = true
                    Task { await uploadAvatar(data: data); uploadingAvatar = false }
                }
                .ignoresSafeArea()
            }
        }
    }

    private struct AvatarUpdate: Encodable { let avatar_url: String }

    /// Load the picked photo, upload to the avatars bucket, and persist the URL
    /// to profiles.avatar_url (separate write, like the web — username Save is
    /// independent), then refresh so it shows everywhere immediately.
    private func uploadAvatar(_ item: PhotosPickerItem) async {
        guard let uid = auth.profile?.id else { return }
        // Web parity: surface upload failures instead of silently bailing
        // (avatar-upload.tsx shows an "Avatar upload failed" toast).
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            error = "Avatar upload failed. Please try again."
            return
        }
        await uploadAvatar(data: data)
    }

    /// Upload raw image data (camera capture or library) → avatars bucket →
    /// profiles.avatar_url, then refresh so it shows everywhere immediately.
    private func uploadAvatar(data: Data) async {
        guard let uid = auth.profile?.id else { return }
        guard let url = await AvatarUploader.upload(data) else {
            error = "Avatar upload failed. Please try again."
            return
        }
        try? await auth.client.from("profiles").update(AvatarUpdate(avatar_url: url)).eq("id", value: uid).execute()
        await auth.refreshProfile()
    }

    private func validate(_ name: String) -> String? {
        // Web parity (profile-edit-modal.tsx): length-only validation, matching the
        // DB constraint. The iOS-only charset regex locked out users whose web-set
        // username contains a space/hyphen — they couldn't re-save their profile.
        let t = name.trimmingCharacters(in: .whitespaces)
        if t.count < 3 || t.count > 20 { return "Username must be 3-20 characters" }
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
                // Web parity: surface the real error message (fallback "Failed to save").
                self.error = msg.contains("23505") || msg.lowercased().contains("duplicate")
                    ? "Username already taken"
                    : (error.localizedDescription.isEmpty ? "Failed to save" : error.localizedDescription)
                saving = false
            }
        }
    }
}

/// System camera picker (UIImagePickerController, .camera source) wrapped for
/// SwiftUI — returns the captured UIImage (or nil if cancelled).
private struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = true
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImage: (UIImage?) -> Void
        init(onImage: @escaping (UIImage?) -> Void) { self.onImage = onImage }
        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onImage((info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage))
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onImage(nil) }
    }
}
