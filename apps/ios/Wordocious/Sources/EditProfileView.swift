import SwiftUI
import PhotosUI
import WordociousCore

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
    /// FINISH_SPEC §AH: the worn cast hero (nil = photo / initials) + level-tier frame.
    @State private var castId: String?
    @State private var frame: String?
    /// FINISH_SPEC §AN: the mascot being built (live), whether the player changed
    /// it this visit (only then is avatar_config written), and a token that
    /// re-seeds the builder when the page changes the mascot itself (new photo).
    @State private var mascot: AvatarConfig = AvatarCatalog.defaultAvatar(userId: "")
    @State private var mascotTouched = false
    @State private var builderToken = 0
    @State private var showCharacterNudge = false
    @State private var isPrivate = false
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

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899), Color(hex: 0xFBBF24)], startPoint: .leading, endPoint: .trailing)
                .frame(height: 6)
            HStack {
                HeaderCircleButton(.symbol("xmark"), size: 32, label: "Cancel") { dismiss() }
                Spacer()
                HeadingArtView(.editprofile, height: 40, maxWidth: 220)   // BJ16
                Spacer()
                // §A8: Save is a small candy button.
                Button { save() } label: { CandyLabel(title: saving ? "Saving…" : "Save") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                    .disabled(saving)
            }
            .padding(.horizontal, 18).padding(.vertical, 12)

            ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 14) {
                    if showCharacterNudge { characterNudge(proxy) }
                    preview
                    avatarSection
                    // §AN4: "Make your mascot" — the build-your-own-mascot builder (the AH
                    // cast pick lives here now as presets; frames are its Frame tab).
                    // Founder 10-03 (no plain-text headings): the MAKE YOUR MASCOT lettering titles the builder.
                    G5Card(nil, accent: Color(hex: AvatarCatalog.colorValue(mascot.color)), spacing: 8) {
                        HeadingArtView(.mascot, height: 30, maxWidth: 240, alignment: .leading)
                        MascotBuilderView(initial: AvatarCatalog.initial(username.isEmpty ? auth.profile?.username : username),
                                          config: mascot, mode: .profile,
                                          hasPhoto: hasPhoto, level: auth.profile?.level ?? 1, isPro: auth.isProActive,
                                          saving: saving,
                                          onChange: { c in mascot = c; mascotTouched = true },
                                          onSave: { c in mascot = c; mascotTouched = true; save() })
                            .id(builderToken)
                    }
                    .id(Self.characterGridAnchor)
                    sectionCard("USERNAME", accent: G5Accent.purple) {
                        TextField("username", text: $username)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                            .font(Brand.font(15, .bold)).foregroundStyle(FinishInk.heading)
                            .g5Field(G5Accent.purple, error: error != nil)
                        if let error { G5Notice(error, tone: .error) }
                    }
                    // Count/truncate by unicode SCALARS, not Characters: the DB
                    // CHECK is char_length (code points), and one family emoji
                    // is 1 Character but 7 code points — a Character-counted
                    // "80/80" bio can violate the CHECK and fail the whole save.
                    sectionCard("BIO  ·  \(bio.unicodeScalars.count)/\(bioMax)", accent: G5Accent.pink) {
                        TextField("A short tagline…", text: $bio, axis: .vertical)
                            .lineLimit(1...3).font(Brand.font(14, .regular)).foregroundStyle(FinishInk.heading)
                            .g5Field(G5Accent.pink)
                            .onChange(of: bio) {
                                if $0.unicodeScalars.count > bioMax {
                                    bio = String(String.UnicodeScalarView($0.unicodeScalars.prefix(bioMax)))
                                }
                            }
                    }
                    sectionCard("ACCENT COLOR", accent: accentColor) { accentRow }
                    sectionCard("FEATURED TITLE", accent: G5Accent.gold) { titlePicker }
                    sectionCard("FAVORITE MODE", accent: G5Accent.blue) { modeRow }
                    sectionCard("PRIVACY", accent: G5Accent.lilac) { privacyRow }
                    sectionCard("SOCIALS", accent: G5Accent.teal) { socialFields }
                    // §G5 / §A7: a cast pose where there's room — C leaning in.
                    PoseImage(.c, "lean", height: 84).padding(.top, 2)
                }
                .padding(16)
            }
            }
        }
        .pageBackground(.home)
        .task {
            username = auth.profile?.username ?? ""
            bio = auth.profile?.bio ?? ""
            accent = auth.profile?.accentColor
            favoriteMode = auth.profile?.favoriteMode
            featured = auth.profile?.featuredAchievement
            avatarEmoji = auth.profile?.avatarEmoji ?? ""
            isPrivate = auth.profile?.isPrivate ?? false
            let look = CastAvatars.shared.ownLook(auth.profile)
            castId = look.castId
            frame = look.frame
            // §AN: the saved mascot, else the worn AH hero's preset, else the default.
            if let p = auth.profile {
                let has = !(p.avatarUrl?.trimmingCharacters(in: .whitespaces).isEmpty ?? true)
                var m = MascotLooks.shared.ownConfig(p)
                    ?? MascotLooks.display(saved: nil, castId: look.castId, frame: look.frame, username: p.username,
                                           accentHex: LetterTileAvatar.defaultAccentHex(username: p.username, accentHex: p.accentColor))
                // No saved mascot: a worn hero showed over the photo (AH); else the photo shows.
                if MascotLooks.shared.ownConfig(p) == nil { m.display = (has && look.castId == nil) ? "photo" : "mascot" }
                mascot = m
                builderToken += 1
            }
            // §AM2: a one-time nudge for players still on a (retired) emoji avatar.
            if let uid = auth.profile?.id, !avatarEmoji.trimmingCharacters(in: .whitespaces).isEmpty, look.castId == nil,
               !UserDefaults.standard.bool(forKey: Self.nudgeKey(uid)) {
                showCharacterNudge = true
            }
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
            if !b.isEmpty { Text(b).font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary).multilineTextAlignment(.center) }
            if let m = dailyModes.first(where: { $0.dbKey == favoriteMode }) {
                HStack(spacing: 5) {
                    ModeIconView(icon: m.icon, accent: m.accent, box: 16)
                    Text(m.title).font(Brand.font(11, .bold)).foregroundStyle(m.accent)
                }
                .padding(.horizontal, 8).padding(.top, 5).padding(.bottom, 3)
                .tintedPill(m.accent)
            }
        }
        .frame(maxWidth: .infinity).padding(16)
        // §A1: the live preview sits on a card tinted by the chosen accent.
        .tintedCard(accent: accentColor, bar: G5Accent.bar(accentColor), radius: 20, barHeight: 8)
    }

    private var previewAvatar: some View {
        // §AN: the live mascot (or the photo, when "My photo" is picked).
        AvatarView(url: auth.profile?.avatarUrl, username: username, size: 64,
                   accentHex: accent, emoji: avatarEmoji, pro: auth.isProActive,
                   castId: nil, frame: nil, lookup: false, mascot: mascot)
    }

    private var hasPhoto: Bool { !(auth.profile?.avatarUrl?.trimmingCharacters(in: .whitespaces).isEmpty ?? true) }

    // MARK: - §AM2 "Pick your character!" nudge

    private static let characterGridAnchor = "edit-profile-character-grid"
    private static func nudgeKey(_ uid: String) -> String { "wd_pick_character_nudge_v1:\(uid.lowercased())" }

    private func dismissCharacterNudge() {
        if let uid = auth.profile?.id { UserDefaults.standard.set(true, forKey: Self.nudgeKey(uid)) }
        showCharacterNudge = false
    }

    private func characterNudge(_ proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 12) {
            PoseImage(.o1, "cheer", height: 64)
            VStack(alignment: .leading, spacing: 6) {
                Text("Make your mascot!")
                    .font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                    .accessibilityAddTraits(.isHeader)
                Text("Emoji avatars are retiring. Build your own mascot, or start from one of the cast!")
                    .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    Button {
                        dismissCharacterNudge()
                        if Theme.reduceMotion { proxy.scrollTo(Self.characterGridAnchor, anchor: .top) }
                        else { withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo(Self.characterGridAnchor, anchor: .top) } }
                    } label: { CandyLabel(title: "Choose") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                    Button { dismissCharacterNudge() } label: { CandyLabel(title: "Not now") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .tintedCard(accent: G5Accent.purple, bar: G5Accent.bar(G5Accent.purple), radius: 20, barHeight: 8)
    }

    // MARK: - Sections

    private var avatarSection: some View {
        VStack(spacing: 8) {
            Button { showPhotoChoice = true } label: {
                CandyLabel(title: uploadingAvatar ? "Uploading…" : "Change Photo", symbol: "camera.fill")
            }
            .buttonStyle(CandyButtonStyle(variant: .pink, size: .small, fullWidth: false))
            .disabled(uploadingAvatar)
            // §AM2: the emoji avatar option is retired (the cast grid below replaces
            // it); a stored avatar_emoji is saved back unchanged, never drawn.
        }
        .frame(maxWidth: .infinity).padding(.vertical, 4)
    }

    private var accentRow: some View {
        HStack(spacing: 10) {
            ForEach(ProfileAccent.palette, id: \.id) { sw in
                let selected = ProfileAccent.hex(accent) == sw.hex
                // §G5: each swatch is a mini tinted tile (selected = stronger tint +
                // ring), squish on tap.
                Button { accent = sw.id == "purple" ? nil : String(format: "#%06X", sw.hex) } label: {
                    Circle()
                        .fill(LinearGradient(colors: [Color.white.mixed(over: Color(hex: sw.hex), 0.3), Color(hex: sw.hex)],
                                             startPoint: .top, endPoint: .bottom))
                        .frame(width: 22, height: 22)
                        .overlay(Circle().stroke(Color.white.opacity(0.7), lineWidth: 1.5))
                        .frame(width: 34, height: 34)
                        .g5Option(active: selected, accent: Color(hex: sw.hex), radius: 11)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("\(sw.id.capitalized) accent")
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
            Spacer(minLength: 0)
        }
    }

    private var titlePicker: some View {
        Group {
            if unlockedDefs.isEmpty {
                Text("Unlock achievements to wear one as a title.").font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
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
                        // Square game tile (docs/GAME_TILE_STYLE.md).
                        GameTileSquare(accent: m.accent, label: ModeGen.byId(m.id)?.shortTitle ?? m.title,
                                       selected: favoriteMode == m.dbKey, side: 58) { chip in
                            ModeIconView(icon: m.icon, accent: m.accent, box: chip)
                        }
                    }.buttonStyle(.squish)
                    .accessibilityLabel(m.title)
                    .accessibilityAddTraits(favoriteMode == m.dbKey ? .isSelected : [])
                }
            }
            .padding(.horizontal, 4).padding(.vertical, 6)
        }
    }

    /// PRIVATE PROFILES toggle — ports the web ProfileEditModal Privacy
    /// section: lock/globe icon + "Private profile" + ON/OFF pill, helper copy
    /// below. Saves profiles.is_private with the rest of the form.
    private var privacyRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { isPrivate.toggle() } label: {
                HStack(spacing: 10) {
                    Image(systemName: isPrivate ? "lock.fill" : "globe")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(isPrivate ? Color(hex: 0x7C3AED) : FinishInk.secondary)
                    Text("Private profile")
                        .font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                    Spacer()
                    Text(isPrivate ? "ON" : "OFF")
                        .font(Brand.font(10, .black))
                        .foregroundStyle(isPrivate ? Color(hex: 0x7C3AED) : FinishInk.secondary)
                        .padding(.horizontal, 8).padding(.top, 5).padding(.bottom, 3)
                        .tintedPill(isPrivate ? Color(hex: 0x7C3AED) : G5Accent.slate)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .contentShape(Rectangle())
                .g5Option(active: isPrivate, accent: G5Accent.lilac, radius: 14)
            }
            .buttonStyle(.squish)
            Text("Hide your words, stats, and game history from other players. You'll still appear on leaderboards.")
                .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
        }
    }

    private var socialFields: some View {
        VStack(spacing: 8) {
            ForEach(platforms, id: \.key) { p in
                HStack {
                    Text(p.label).font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary).frame(width: 96, alignment: .leading)
                    TextField(p.placeholder, text: Binding(get: { socials[p.key] ?? "" }, set: { socials[p.key] = $0 }))
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .keyboardType(p.key == "website" ? .URL : .default).font(Brand.font(13, .regular))
                        .foregroundStyle(FinishInk.heading)
                        .g5Field(G5Accent.teal, radius: 10)
                }
            }
        }
    }

    // MARK: - Small components

    /// §G5: a tinted section card with its own top bar (§A1).
    private func sectionCard<C: View>(_ title: String, accent: Color, @ViewBuilder _ inner: @escaping () -> C) -> some View {
        G5Card(title, accent: accent, spacing: 8) { inner() }
    }

    private func pill(label: String, system: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: system).font(.system(size: 9, weight: .bold))
            Text(label.uppercased()).font(Brand.font(10, .black)).tracking(0.4)
        }
        .foregroundStyle(color).padding(.horizontal, 8).padding(.top, 5).padding(.bottom, 3)
        .tintedPill(color)
    }

    private func chip(_ label: String, selected: Bool, icon: String? = nil, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon { Image(systemName: icon).font(.system(size: 9, weight: .bold)) }
                Text(label).font(Brand.font(11, .bold))
            }
            .foregroundStyle(selected ? accentColor : FinishInk.heading)
            .padding(.horizontal, 10).padding(.vertical, 6)
            // §A1: chips are mini tinted tiles (selected = stronger tint + ring).
            .g5Option(active: selected, accent: accentColor, radius: 14)
        }
        .buttonStyle(.squish)
        .accessibilityAddTraits(selected ? .isSelected : [])
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
        let is_private: Bool
        enum CodingKeys: String, CodingKey { case username, social_links, bio, accent_color, favorite_mode, featured_achievement, avatar_emoji, is_private }
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            if let username { try c.encode(username, forKey: .username) }
            try c.encode(social_links, forKey: .social_links)
            try c.encode(bio, forKey: .bio)                          // null clears
            try c.encode(accent_color, forKey: .accent_color)
            try c.encode(favorite_mode, forKey: .favorite_mode)
            try c.encode(featured_achievement, forKey: .featured_achievement)
            try c.encode(avatar_emoji, forKey: .avatar_emoji)
            try c.encode(is_private, forKey: .is_private)
        }
    }
    private struct AvatarUpdate: Encodable { let avatar_url: String? }
    /// §AN3: profiles.avatar_config, written in its OWN best-effort update (the
    /// column may not exist yet).
    private struct MascotUpdate: Encodable {
        let avatar_config: AvatarConfig
    }
    /// §AH: the two new columns, written in their OWN best-effort update so a
    /// missing column never breaks the profile save. Nulls are sent (they clear).
    private struct AvatarLookUpdate: Encodable {
        let avatar_cast_id: String?
        let avatar_frame: String?
        enum CodingKeys: String, CodingKey { case avatar_cast_id, avatar_frame }
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(avatar_cast_id, forKey: .avatar_cast_id)
            try c.encode(avatar_frame, forKey: .avatar_frame)
        }
    }

    private func validate(_ name: String) -> String? {
        // Shape AND content (core Profanity mirrors the DB word list). The DB
        // trigger enforce_username_policy_trg is the authority — a profile
        // PATCH goes straight to PostgREST, so a check here is bypassable;
        // this just gives instant feedback and avoids a raw error round trip.
        Profanity.usernameError(name)
    }
    private func sanitize(_ key: String, _ raw: String) -> String {
        let t = raw.trimmingCharacters(in: .whitespaces)
        if key == "website" { return t }
        return t.hasPrefix("@") ? String(t.dropFirst()) : t
    }

    private func save() {
        let t = username.trimmingCharacters(in: .whitespaces)
        // Only screen a CHANGED name — mirrors the DB trigger, which leaves
        // existing rows alone so a name that predates the policy doesn't
        // block unrelated profile edits (bio, avatar, links).
        if t != auth.profile?.username, let v = validate(t) { error = v; return }
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
            avatar_emoji: emoji.isEmpty ? nil : emoji,
            is_private: isPrivate)
        saving = true; error = nil
        Task {
            do {
                try await auth.client.from("profiles").update(payload).eq("id", value: uid).execute()
                // §AN: the mascot (only when changed this visit), best effort; any error
                // (e.g. the column doesn't exist yet) keeps it locally on this device.
                // A saved mascot replaces AH's worn hero; its tier frame mirrors into
                // avatar_frame for older clients.
                var castVal = AvatarCastRules.normalize(castId)
                var frameVal = AvatarFrameRules.effective(frame, level: auth.profile?.level ?? 1)
                if mascotTouched {
                    let level = auth.profile?.level ?? 1
                    var m = AvatarCatalog.enforcePro(mascot, isPro: auth.isProActive)
                    if AvatarFrameRules.tier(m.frame) != nil, !AvatarFrameRules.isUnlocked(m.frame, level: level) { m.frame = "none" }
                    if !hasPhoto { m.display = "mascot" }
                    var mascotAccepted = false
                    do {
                        try await auth.client.from("profiles").update(MascotUpdate(avatar_config: m)).eq("id", value: uid).execute()
                        mascotAccepted = true
                    } catch { mascotAccepted = false }
                    MascotLooks.shared.applyOwn(userId: uid, username: t, config: m, serverAccepted: mascotAccepted)
                    castVal = nil
                    frameVal = AvatarFrameRules.normalize(m.frame)
                }
                var accepted = false
                do {
                    try await auth.client.from("profiles")
                        .update(AvatarLookUpdate(avatar_cast_id: castVal, avatar_frame: frameVal))
                        .eq("id", value: uid).execute()
                    accepted = true
                } catch { accepted = false }
                CastAvatars.shared.applyOwnChoice(userId: uid, username: t, castId: castVal, frame: frameVal,
                                                  serverAccepted: accepted)
                if castVal != nil || mascotTouched { UserDefaults.standard.set(true, forKey: Self.nudgeKey(uid)) }
                await auth.refreshProfile()
                dismiss()
            } catch {
                let msg = "\(error)"
                // enforce_username_policy_trg raises check_violation with an
                // already user-facing message. Surface THAT rather than the
                // PostgREST envelope it arrives wrapped in — the client holds
                // no copy of the word list, so the server's wording is the
                // only wording available.
                let policy = [
                    "That username is not available. Please choose another.",
                    "Username must be 3-20 characters",
                    "Username may use letters, numbers, spaces, and . _ - only",
                    "Username needs at least one letter or number",
                ].first { msg.contains($0) }
                if msg.contains("23505") || msg.lowercased().contains("duplicate") {
                    self.error = "Username already taken"
                } else if let policy {
                    self.error = policy
                } else {
                    self.error = error.localizedDescription.isEmpty ? "Failed to save" : error.localizedDescription
                }
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
        _ = try? await auth.client.from("profiles").update(AvatarUpdate(avatar_url: url)).eq("id", value: uid).execute()
        // §AH / §AN: a fresh photo means the player wants their photo — show it (saved
        // with Save). The mascot itself is kept; only `display` flips.
        castId = nil
        mascot.display = "photo"
        mascotTouched = true
        builderToken += 1
        await auth.refreshProfile()
    }
    private func removeAvatar() async {
        guard let uid = auth.profile?.id else { return }
        _ = try? await auth.client.from("profiles").update(AvatarUpdate(avatar_url: nil)).eq("id", value: uid).execute()
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
