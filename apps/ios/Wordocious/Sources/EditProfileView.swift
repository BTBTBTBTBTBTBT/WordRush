import SwiftUI
import PhotosUI
import WordociousCore

/// Edit Profile — founder 10-05 "The Stage" (docs/design/profile-2026-10-05): your mascot (or framed
/// photo) is the page, alive on its backdrop + podium; the name plate wears the featured title as a gold
/// ribbon; one MAKE YOUR MASCOT button opens the full-screen Dressing Room; backdrop + frame are one-tap
/// swatch rows; everything else is a quiet unboxed row; socials + privacy fold into small sheets. ONE Save.
struct EditProfileView: View {
    /// Where it opens (the doors: Stats card, podium, Home host, the party-hat offer).
    var start: DressUp.Door = .stage

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
    /// FINISH_SPEC §AN: the mascot being built (live), and whether the player changed it this visit
    /// (only then is avatar_config written).
    @State private var mascot: AvatarConfig = AvatarCatalog.defaultAvatar(userId: "")
    @State private var mascotTouched = false
    @State private var isPrivate = false
    @State private var unlocked: Set<String> = []
    @State private var unlockedDates: [String: String] = [:]
    @State private var error: String?
    @State private var saving = false
    @State private var photoItem: PhotosPickerItem?
    @State private var uploadingAvatar = false
    @State private var showPhotoChoice = false
    @State private var showLibraryPicker = false
    @State private var showCamera = false
    // The Stage
    @State private var showRoom = false
    @State private var roomTab: MascotBuilderTab = .body
    @State private var roomStart: AvatarConfig?
    @State private var hopToken = 0
    @State private var showTitles = false
    @State private var showSocials = false
    @State private var showPrivacy = false
    @State private var showFavorite = false
    @State private var opened = false

    private let bioMax = 80
    private let platforms: [(key: String, label: String, placeholder: String)] = [
        ("twitter", "Twitter / X", "username"), ("instagram", "Instagram", "username"),
        ("tiktok", "TikTok", "username"), ("threads", "Threads", "username"),
        ("discord", "Discord", "username"), ("website", "Website", "https://example.com"),
    ]
    private var dailyModes: [HomeMode] { homeModes.filter { $0.dbKey != nil && $0.dbKey != "VS" } }
    private var accentColor: Color { ProfileAccent.color(accent) }
    private var initial: String { AvatarCatalog.initial(username.isEmpty ? auth.profile?.username : username) }
    private var showsPhoto: Bool { mascot.display == "photo" && hasPhoto }
    private var ink: Color { Theme.isDark ? Theme.textPrimary : FinishInk.title }
    private var labelInk: Color { Theme.isDark ? Theme.textSecondary : Color(hex: 0x7A6AA6) }
    private var featuredName: String? { featured.flatMap { k in catalog.all.first { $0.key == k }?.name } }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                stage
                namePlate.padding(.top, 8)
                ctaRow.padding(.horizontal, 16).padding(.top, 14)
                if let error { G5Notice(error, tone: .error).padding(.horizontal, 16).padding(.top, 10) }
                swatchSection("BACKDROP") { backdropRow }.padding(.top, 14)
                swatchSection("FRAME", hint: "how you look in lists") { frameRow }.padding(.top, 10)
                rows.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 28)
            }
        }
        .ignoresSafeArea(edges: .top)
        .background((Theme.isDark ? Theme.surface : Color(hex: 0xF6F0FF)).ignoresSafeArea())
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
            }
            openDoor()
            await catalog.load()
            if let uid = auth.profile?.id {
                socials = await ProfileExtras.socialLinks(userId: uid)
                unlockedDates = await AchievementService.fetchUnlockedDates(userId: uid)
                unlocked = Set(unlockedDates.keys)
            }
            // 2.7.1 gate: the Title Shelves' badges (50 pt, locked ones pre-grayed) decode off the main
            // thread while the Stage is up, so "Wear it" opens the shelves without a decode stall.
            let earned = unlocked
            BadgeArt.prewarm(catalog.all.filter { !($0.hidden ?? false) }.map {
                (name: BadgeArt.achievementAsset(key: $0.key, icon: $0.icon, category: $0.category), gray: !earned.contains($0.key))
            }, points: 50)
        }
        .onChange(of: photoItem) { item in
            guard let item else { return }
            uploadingAvatar = true
            Task { await uploadAvatar(item); uploadingAvatar = false }
        }
        // Change Photo — the family action menu (founder 10-05: no plain-text menus); same three choices.
        .familyActionMenu(item: Binding(
            get: { showPhotoChoice ? FamilyMenuToken(id: "photo") : nil },
            set: { showPhotoChoice = $0 != nil })) { _ in photoMenuModel() }
        .photosPicker(isPresented: $showLibraryPicker, selection: $photoItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                showCamera = false
                guard let data = image?.jpegData(compressionQuality: 0.9) else { return }
                uploadingAvatar = true
                Task { await uploadAvatar(data: data); uploadingAvatar = false }
            }.ignoresSafeArea()
        }
        .fullScreenCover(isPresented: $showRoom) { dressingRoom }
        .softSheet(isPresented: $showTitles) {
            TitleShelvesView(username: username.isEmpty ? (auth.profile?.username ?? "") : username, mascot: mascot,
                             initial: initial, accent: accentColor, unlockedDates: unlockedDates, selected: featured) { key in
                featured = key
                hopToken += 1
            }
        }
        .softSheet(isPresented: $showSocials) { socialsSheet.presentationDetents([.medium, .large]) }
        .softSheet(isPresented: $showPrivacy) { privacySheet.presentationDetents([.height(260)]) }
        .softSheet(isPresented: $showFavorite) { favoriteSheet.presentationDetents([.height(300)]) }
    }

    /// The door it was opened through: straight into the room (a tab, or the party hat on Hats).
    private func openDoor() {
        guard !opened else { return }
        opened = true
        switch start {
        case .stage: break
        case .titles: showTitles = true
        case .room(let t):
            roomTab = t
            roomStart = mascot
            withTransaction(Transaction(animation: nil)) { showRoom = true }
        case .partyHat:
            roomTab = .hats
            var c = mascot
            c.display = "mascot"
            if let fit = MascotParts.fit { c = AvatarFit.applyPick(c, field: "head", id: "party", manifest: fit) } else { c.head = "party" }
            roomStart = c
            DressUp.shared.finish(.partyHat)
            withTransaction(Transaction(animation: nil)) { showRoom = true }
        }
    }

    // MARK: - The Stage

    private var stage: some View {
        DressStage(config: mascot, initial: initial,
                   photo: showsPhoto ? (auth.profile?.avatarUrl, auth.profile?.username ?? username, auth.profile?.id) : nil,
                   height: StageMetrics.height + 44, hopToken: hopToken) {
            VStack {
                // × and SAVE sit in equal side slots, so the heading centers and both stay inside the stage.
                HStack(alignment: .center, spacing: 4) {
                    // -8: the X's 44 pt hit area pads its glyph; this puts the glyph as far in as SAVE's edge.
                    StageCloseButton(label: "Cancel") { dismiss() }
                        .padding(.leading, -8)
                        .frame(width: StageMetrics.sideSlot, alignment: .leading)
                    HeadingArtView(.editprofile, height: 34, maxWidth: 200)
                        .frame(maxWidth: .infinity)
                    Button { save() } label: { CandyLabel(title: saving ? "Saving…" : "Save") }
                        .buttonStyle(CastButtonStyle(color: .purple, size: .small, fullWidth: false))
                        .disabled(saving)
                        .frame(width: StageMetrics.sideSlot, alignment: .trailing)
                }
                .padding(.horizontal, 12).padding(.top, 54)
                Spacer()
            }
        }
        .clipShape(RoomStageShape(radius: 28))
    }

    private var namePlate: some View {
        VStack(spacing: 5) {
            Text(username.trimmingCharacters(in: .whitespaces).isEmpty ? "username" : username)
                .font(Brand.font(22, .black)).foregroundStyle(ProfileAccent.isCustom(accent) ? accentColor : Color(hex: 0x6D28D9))
                .lineLimit(1).minimumScaleFactor(0.6)
            Button { showTitles = true } label: {
                TitleRibbon(text: featuredName ?? "Choose a title", height: 28, maxWidth: 250, placeholder: featuredName == nil)
            }
            .buttonStyle(.squish)
            .accessibilityHint("Opens the title picker")
        }
        .padding(.horizontal, 16)
    }

    private var ctaRow: some View {
        HStack(spacing: 10) {
            Button { openRoom(.body) } label: { CandyLabel(title: "MAKE YOUR MASCOT", symbol: "sparkles") }
                .buttonStyle(CandyButtonStyle(variant: .pink, size: .large, fullWidth: true))
            Button {
                Haptics.tap()
                var c = MascotBuilderView.randomLook(from: mascot, isPro: auth.isProActive, level: auth.profile?.level ?? 1)
                c.display = mascot.display
                mascot = c
                mascotTouched = true
                hopToken += 1
            } label: {
                Image(systemName: "dice.fill").font(.system(size: 20, weight: .black)).foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(Circle().fill(LinearGradient(colors: [Color(hex: 0x5EEAD4), Color(hex: 0x0D9488)], startPoint: .top, endPoint: .bottom)))
                    .overlay(Circle().fill(LinearGradient(colors: [.white.opacity(0.45), .clear], startPoint: .top, endPoint: .center)).padding(4))
                    .shadow(color: Color(hex: 0x0F766E), radius: 0, y: 3)
            }
            .buttonStyle(.squish)
            .accessibilityLabel("Randomize my mascot")
        }
    }

    private func openRoom(_ tab: MascotBuilderTab) {
        Haptics.tap()
        roomTab = tab
        var c = mascot
        c.display = "mascot"
        roomStart = c
        showRoom = true
    }

    private var dressingRoom: some View {
        MascotBuilderView(initial: initial, config: roomStart ?? mascot, mode: .room,
                          hasPhoto: hasPhoto, level: auth.profile?.level ?? 1, isPro: auth.isProActive,
                          saveTitle: "Done",
                          onSave: { c in
                              var next = c
                              next.display = mascot.display == "photo" && start == .stage ? mascot.display : "mascot"
                              if !hasPhoto { next.display = "mascot" }
                              mascot = next
                              mascotTouched = true
                              showRoom = false
                              // the soft hop back on the Stage
                              DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { hopToken += 1 }
                          },
                          startTab: roomTab,
                          onClose: { showRoom = false })
    }

    // MARK: - Swatch rows (one tap)

    private func swatchSection<C: View>(_ title: String, hint: String? = nil, @ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 4) {
                Text(title).font(Brand.font(10, .black)).tracking(1.2).foregroundStyle(labelInk)
                if let hint { Text("· \(hint)").font(Brand.font(10, .bold)).foregroundStyle(labelInk.opacity(0.8)) }
            }
            content()
        }
        .frame(maxWidth: .infinity)
    }

    private var backdropRow: some View {
        let base = Color(hex: AvatarCatalog.colorValue(mascot.color))
        let ids = Array(AvatarCatalog.backdropIds.prefix(8))
        return HStack(spacing: 9) {
            ForEach(ids, id: \.self) { id in
                let on = mascot.bg == id
                let locked = AvatarCatalog.isProOnly(bg: id) && !auth.isProActive
                Button {
                    if locked { openRoom(.backdrop); return }
                    Haptics.tap(); mascot.bg = id; mascotTouched = true
                } label: {
                    MascotBackdrop(bg: id, base: base, dark: Theme.isDark)
                        .frame(width: 30, height: 30).clipShape(Circle())
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.75), lineWidth: 2))
                        .shadow(color: on ? Color(hex: 0xF59E0B) : Color(hex: 0x3C1E78).opacity(0.18), radius: on ? 0 : 2.5, y: on ? 0 : 2)
                        .overlay(Circle().strokeBorder(on ? Color(hex: 0xF5B82E) : .clear, lineWidth: 2.5).padding(-3))
                        .scaleEffect(on ? 1.1 : 1)
                        .opacity(locked ? 0.5 : 1)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("\(MascotOptionNames.name(id)) backdrop\(locked ? ", Pro only" : "")")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
            Button { openRoom(.backdrop) } label: {
                Image(systemName: "ellipsis").font(.system(size: 14, weight: .black)).foregroundStyle(Color(hex: 0x7C3AED))
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Color.white.opacity(Theme.isDark ? 0.12 : 0.7)))
            }
            .buttonStyle(.squish)
            .accessibilityLabel("More backdrops")
        }
    }

    private var frameRow: some View {
        let level = auth.profile?.level ?? 1
        let ids = AvatarCatalog.frames.filter { $0 != "pro" || auth.isProActive }
        return HStack(spacing: 8) {
            ForEach(ids, id: \.self) { id in
                let on = mascot.frame == id
                let tierLocked = AvatarFrameRules.tier(id) != nil && !AvatarFrameRules.isUnlocked(id, level: level)
                let proLocked = AvatarCatalog.isProOnly(frame: id) && !auth.isProActive
                Button {
                    if tierLocked || proLocked { return }
                    Haptics.tap(); mascot.frame = id; mascotTouched = true
                } label: {
                    PartThumb(slot: "frame", value: id, config: mascot, initial: initial)
                        .frame(width: 32, height: 32)
                        .padding(2)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(on ? Color.white : Color.white.opacity(Theme.isDark ? 0.08 : 0.5)))
                        .shadow(color: on ? Color(hex: 0xA78BFA).opacity(0.6) : .clear, radius: 4)
                        .opacity(tierLocked || proLocked ? 0.4 : 1)
                        .overlay { if tierLocked { StageArt("art-dress-lock", height: 15) } }
                }
                .buttonStyle(.squish)
                .accessibilityLabel(id == "none" ? "No frame" : "\(AvatarFrameRules.tier(id)?.label ?? id.capitalized) frame\(tierLocked ? ", locked" : "")")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
    }

    // MARK: - Quiet rows

    private var rows: some View {
        VStack(spacing: 0) {
            row("SHOW") {
                SoftSegmented(options: [(key: "mascot", label: "My mascot"), (key: "photo", label: "My photo")],
                              selection: Binding(get: { showsPhoto ? "photo" : "mascot" }, set: { v in
                                  if v == "photo" && !hasPhoto { showPhotoChoice = true; return }
                                  mascot.display = v; mascotTouched = true; hopToken += 1
                              }),
                              accent: G5Accent.purple, accessibilityLabel: "Which avatar shows")
            }
            divider
            row("USERNAME") {
                TextField("username", text: $username)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .font(Brand.font(15, .heavy)).foregroundStyle(ink)
            }
            divider
            row("BIO") {
                TextField("A short tagline…", text: $bio, axis: .vertical)
                    .lineLimit(1...3).font(Brand.font(14, .bold)).foregroundStyle(ink)
                    .onChange(of: bio) {
                        // Count/truncate by unicode SCALARS (the DB CHECK is char_length).
                        if $0.unicodeScalars.count > bioMax {
                            bio = String(String.UnicodeScalarView($0.unicodeScalars.prefix(bioMax)))
                        }
                    }
            }
            divider
            tapRow("TITLE", action: { showTitles = true }) {
                Text(featuredName ?? "Choose one").font(Brand.font(12, .black))
                    .foregroundStyle(Color(hex: 0x92400E))
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)], startPoint: .top, endPoint: .bottom)))
                    .lineLimit(1)
            }
            divider
            tapRow("FAVORITE", action: { showFavorite = true }) {
                if let m = dailyModes.first(where: { $0.dbKey == favoriteMode }) {
                    ModeIconView(icon: m.icon, accent: m.accent, box: 22)
                    Text(m.title).font(Brand.font(14, .heavy)).foregroundStyle(ink).lineLimit(1)
                } else {
                    Text("Pick a game").font(Brand.font(14, .bold)).foregroundStyle(labelInk)
                }
            }
            divider
            row("NAME COLOR") {
                HStack(spacing: 7) {
                    ForEach(ProfileAccent.palette, id: \.id) { sw in
                        let on = ProfileAccent.hex(accent) == sw.hex
                        Button { Haptics.tap(); accent = sw.id == "purple" ? nil : String(format: "#%06X", sw.hex) } label: {
                            Circle().fill(Color(hex: sw.hex)).frame(width: 16, height: 16)
                                .overlay(Circle().strokeBorder(Color.white, lineWidth: on ? 2 : 0))
                                .shadow(color: on ? Color(hex: sw.hex) : .clear, radius: 0, x: 0, y: 0)
                                .padding(on ? 0 : 2)
                                .background(Circle().fill(on ? Color(hex: sw.hex) : .clear).padding(-2))
                        }
                        .buttonStyle(.squish)
                        .accessibilityLabel("\(sw.id.capitalized) name color")
                        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                    }
                }
            }
            divider
            tapRow("PRIVATE", action: { showPrivacy = true }) {
                Text(isPrivate ? "On · words & history hidden" : "Off").font(Brand.font(13, .bold)).foregroundStyle(labelInk).lineLimit(1)
            }
            divider
            tapRow("SOCIALS", action: { showSocials = true }) {
                let n = platforms.filter { !(socials[$0.key] ?? "").trimmingCharacters(in: .whitespaces).isEmpty }.count
                Text(n == 0 ? "Add links" : "\(n) link\(n == 1 ? "" : "s")").font(Brand.font(13, .bold)).foregroundStyle(labelInk)
            }
        }
    }

    private var divider: some View { Rectangle().fill(Color(hex: 0x7C3AED).opacity(0.08)).frame(height: 1) }

    private func row<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        HStack(spacing: 10) {
            Text(label).font(Brand.font(10, .black)).tracking(1).foregroundStyle(labelInk)
                .frame(width: 84, alignment: .leading)
            content().frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 10)
    }

    private func tapRow<C: View>(_ label: String, action: @escaping () -> Void, @ViewBuilder _ content: () -> C) -> some View {
        Button { Haptics.tap(); action() } label: {
            row(label) {
                HStack(spacing: 6) {
                    content()
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .black)).foregroundStyle(Color(hex: 0xA78BFA))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.squishCard)
    }

    // MARK: - Small sheets (soft-pop)

    private func sheetTitle(_ t: String) -> some View {
        Text(t).font(Brand.font(18, .black)).foregroundStyle(Color(hex: 0x6D28D9)).padding(.top, 18)
    }

    private var socialsSheet: some View {
        VStack(spacing: 0) {
            sheetTitle("Your links")
            VStack(spacing: 0) {
                ForEach(platforms, id: \.key) { p in
                    row(p.label.uppercased()) {
                        TextField(p.placeholder, text: Binding(get: { socials[p.key] ?? "" }, set: { socials[p.key] = $0 }))
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                            .keyboardType(p.key == "website" ? .URL : .default).font(Brand.font(14, .bold))
                            .foregroundStyle(ink)
                    }
                    if p.key != platforms.last?.key { divider }
                }
            }
            .padding(.horizontal, 20).padding(.top, 8)
            Text("Saved with the rest of your profile.").font(Brand.font(11, .bold)).foregroundStyle(labelInk).padding(.top, 8)
            Spacer(minLength: 0)
        }
    }

    private var privacySheet: some View {
        VStack(spacing: 14) {
            sheetTitle("Private profile")
            Toggle(isOn: $isPrivate) {
                Text("Hide my words, stats and game history").font(Brand.font(14, .heavy)).foregroundStyle(ink)
            }
            .toggleStyle(.candy)   // button family §4: the candy switch everywhere
            .padding(.horizontal, 24)
            Text("You'll still appear on leaderboards.").font(Brand.font(12, .bold)).foregroundStyle(labelInk)
            Spacer(minLength: 0)
        }
    }

    private var favoriteSheet: some View {
        VStack(spacing: 10) {
            sheetTitle("Favorite game")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Button { favoriteMode = nil; showFavorite = false } label: {
                        Text("None").font(Brand.font(12, .black)).foregroundStyle(labelInk)
                            .frame(width: 58, height: 58)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0x7C3AED).opacity(0.08)))
                    }
                    .buttonStyle(.squish)
                    ForEach(dailyModes) { m in
                        Button { favoriteMode = m.dbKey; showFavorite = false } label: {
                            GameTileSquare(accent: m.accent, label: ModeGen.byId(m.id)?.shortTitle ?? m.title,
                                           selected: favoriteMode == m.dbKey, side: 58) { chip in
                                ModeIconView(icon: m.icon, accent: m.accent, box: chip)
                            }
                        }
                        .buttonStyle(.squish)
                        .accessibilityLabel(m.title)
                        .accessibilityAddTraits(favoriteMode == m.dbKey ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 6)
            }
            Spacer(minLength: 0)
        }
    }

    private var hasPhoto: Bool { !(auth.profile?.avatarUrl?.trimmingCharacters(in: .whitespaces).isEmpty ?? true) }

    private static func nudgeKey(_ uid: String) -> String { "wd_pick_character_nudge_v1:\(uid.lowercased())" }

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
                if castVal != nil || mascotTouched {
                    UserDefaults.standard.set(true, forKey: Self.nudgeKey(uid))
                    DressUp.shared.noteSaved()
                }
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
        await auth.refreshProfile()
    }
    /// Change Photo's rows: Take Photo (when there's a camera), Choose from Library, Remove Photo (when one is set).
    private func photoMenuModel() -> FamilyActionMenuModel {
        var rows: [FamilyMenuAction] = []
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            rows.append(FamilyMenuAction(id: "camera", title: "Take photo", icon: .symbol("camera.fill")) { showCamera = true })
        }
        rows.append(FamilyMenuAction(id: "library", title: "Choose from library", icon: .symbol("photo.on.rectangle"),
                                     tint: FamilyMenuInk.teal) { showLibraryPicker = true })
        if auth.profile?.avatarUrl != nil {
            rows.append(FamilyMenuAction(id: "remove", title: "Remove photo", icon: .clay("xmark"), danger: true) {
                Task { await removeAvatar() }
            })
        }
        return FamilyActionMenuModel(title: "Change Photo", subtitle: "A new photo or one from your library",
                                     actions: rows)
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
