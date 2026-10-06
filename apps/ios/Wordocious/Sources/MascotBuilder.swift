import SwiftUI
import WordociousCore

// FINISH_SPEC §AN4 (+ AN addendum) — "Make your mascot": the build-your-own-mascot
// builder. A big live preview on a tinted stage (the mascot hops on every change +
// the `hop` sound), the ten cast presets ("Start from W" …), category tabs as candy
// chips (Body · Color · Pattern · Eyes · Nose · Mouth · Hats · Extras · Backdrop ·
// Frame), each a grid of squishy option tiles showing that part ON the current
// mascot, Randomize (dice candy) and Save (candy). Pro-only items wear the gold PRO
// pill for free players → the Go Pro page. Every option is labeled for VoiceOver.
//
// Reusable: Edit Profile embeds it (`.profile`); first-run onboarding (§AO) can
// show it full screen (`.onboarding`, with Skip). Coach marks can find the tabs,
// presets, preview, Randomize and Save through `MascotBuilderAnchorKey` (bounds
// anchors) or the stable `MascotBuilderAnchor.id` strings (ScrollViewReader ids).

enum MascotBuilderMode {
    case profile, onboarding
    /// Founder 10-05 "Dressing Room": full screen, the stage pinned on top, icon tabs, part-only tiles.
    case room
}

/// The builder's categories, in tab order.
enum MascotBuilderTab: String, CaseIterable, Identifiable, Hashable {
    case body, color, pattern, eyes, nose, cheeks, mouth, hats, extras, backdrop, frame
    /// 10-05: the season's shelf (AvatarSeason), first in the row while a season is on.
    case season
    /// 10-06: the saved pose (AvatarPose), last in the room's row — only while AvatarLiveConfig.livingMascot is on.
    case pose
    var id: String { rawValue }

    var title: String {
        switch self {
        case .body: return "Body"
        case .color: return "Color"
        case .pattern: return "Pattern"
        case .eyes: return "Eyes"
        case .nose: return "Nose"
        case .cheeks: return "Cheeks"
        case .mouth: return "Mouth"
        case .hats: return "Hats"
        case .extras: return "Extras"
        case .backdrop: return "Backdrop"
        case .frame: return "Frame"
        case .season: return MascotSeasonal.title ?? "Season"
        case .pose: return "Pose"
        }
    }

    /// The Dressing Room's tabs (all visible in one row): Cheeks joins Nose.
    static let roomTabs: [MascotBuilderTab] = [.body, .color, .pattern, .eyes, .nose, .mouth, .hats, .extras, .backdrop, .frame]
    /// The tabs the room shows: + Pose while the living mascot ships (AvatarLiveConfig.livingMascot; hidden while off).
    static var shownRoomTabs: [MascotBuilderTab] { roomTabs + (AvatarLiveConfig.livingMascot ? [.pose] : []) }

    /// The tab's ChatGPT icon (art-dress-tab-<id>).
    var artId: String { self == .cheeks ? "nose" : rawValue }
}

/// 10-05 seasonal items (WordociousCore AvatarSeason): the active season = the admin preview (`debug-season`), else
/// the calendar's window (CastSkin.season). A seasonal part shows while its season is on, or when the player's saved
/// look wears it; the shelf leads the room's tabs during the season.
enum MascotSeasonal {
    static var season: String? { CastSkin.season?.rawValue }
    static var title: String? {
        season.map { $0.split(separator: "-").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ") }
    }
    static var shelf: [AvatarPart] {
        guard let fit = MascotParts.fit else { return [] }
        return AvatarSeason.shelf(season, manifest: fit)
    }
    static func available(_ field: String, _ id: String, saved: AvatarConfig?) -> Bool {
        guard let fit = MascotParts.fit else { return true }
        return AvatarSeason.isPartAvailable(AvatarPart(field: field, id: id), day: AvatarSeason.today(), preview: season ?? "none",
                                            saved: saved, manifest: fit)
    }
    static func partSeason(_ field: String, _ id: String) -> String? {
        guard let fit = MascotParts.fit else { return nil }
        return AvatarSeason.partSeason(field: field, id: id, manifest: fit)
    }
}

/// Parts that wear the pink NEW tag in the maker until the player has visited their tab once.
enum MascotNew {
    static let ids: Set<String> = ["head:santa", "head:witch", "neck:scarf", "neck:bubbletea", "neck:guitar", "neck:fairywings"]
    /// The 10-05 additions + the 7 rebuilt parts (WordociousCore AvatarCatalog.newParts).
    static func integrated(slot: String, value: String) -> Bool {
        guard value != "none", ["held", "wrap", "feet", "pet", "brows", "extra", "neck"].contains(slot) else { return false }
        return AvatarCatalog.newParts.contains(slot == "brows" ? "brows:\(value)" : value)
    }
    private static func key(_ t: MascotBuilderTab) -> String { "wd_mascot_new_seen_v1:\(t.artId)" }
    static func seen(_ t: MascotBuilderTab) -> Bool { UserDefaults.standard.bool(forKey: key(t)) }
    static func markSeen(_ t: MascotBuilderTab) { UserDefaults.standard.set(true, forKey: key(t)) }
}

/// The spots a coach-mark spotlight can point at.
enum MascotBuilderAnchor: Hashable {
    case preview, presets, displayToggle, tab(MascotBuilderTab), options, randomize, save, skip

    /// Stable ids (also applied with `.id(_:)`) for ScrollViewReader-driven tours.
    var id: String {
        switch self {
        case .preview: return "mascot-builder-preview"
        case .presets: return "mascot-builder-presets"
        case .displayToggle: return "mascot-builder-display"
        case .tab(let t): return "mascot-builder-tab-\(t.rawValue)"
        case .options: return "mascot-builder-options"
        case .randomize: return "mascot-builder-randomize"
        case .save: return "mascot-builder-save"
        case .skip: return "mascot-builder-skip"
        }
    }
}

/// Bounds anchors of the builder's controls (read with `.overlayPreferenceValue`).
struct MascotBuilderAnchorKey: PreferenceKey {
    static var defaultValue: [MascotBuilderAnchor: Anchor<CGRect>] = [:]
    static func reduce(value: inout [MascotBuilderAnchor: Anchor<CGRect>], nextValue: () -> [MascotBuilderAnchor: Anchor<CGRect>]) {
        value.merge(nextValue()) { $1 }
    }
}

private extension View {
    func builderAnchor(_ a: MascotBuilderAnchor) -> some View {
        self.id(a.id).anchorPreference(key: MascotBuilderAnchorKey.self, value: .bounds) { [a: $0] }
    }
}

/// The friendly names (and VoiceOver labels) of every option id.
enum MascotOptionNames {
    static func name(_ id: String) -> String {
        switch id {
        case "none": return "None"
        case "auto": return "Auto"
        case "twotone": return "Two-tone"
        case "o": return "Little O"
        case "cat": return "Cat :3"
        case "toothy": return "Toothy"
        case "red": return "Red nose"
        case "button": return "Button"
        case "blush": return "Rosy"
        case "starfreckles": return "Star freckles"
        case "sparkle": return "Sparkle"
        case "bandage": return "Bandage"
        case "bignose": return "Big nose"
        case "clownstar": return "Star nose"
        case "sunglasses": return "Shades"
        case "anime": return "Sparkle eyes"
        case "biground": return "Big round"
        case "sideglance": return "Side glance"
        case "tongueside": return "Silly tongue"
        case "teeth": return "Toothy smile"
        case "minicrown": return "Mini crown"
        case "flowercrown": return "Flower crown"
        case "astronaut": return "Space helmet"
        case "bigbow": return "Big bow"
        case "pombeanie": return "Pom beanie"
        case "bearears": return "Bear ears"
        case "starglasses": return "Star shades"
        case "roundglasses": return "Round glasses"
        case "eyepatch": return "Eye patch"
        case "facepaint": return "Face paint"
        case "curlymustache": return "Curly 'stache"
        case "bubbletea": return "Bubble tea"
        case "supercape": return "Hero cape"
        case "fairywings": return "Fairy wings"
        // 10-05 integrated parts
        case "mug": return "Coffee mug"
        case "pencil-big": return "Big pencil"
        case "magnifier": return "Magnifier"
        case "icecream": return "Ice cream"
        case "mic": return "Microphone"
        case "wand-star": return "Star wand"
        case "apron": return "Chef apron"
        case "lei": return "Flower lei"
        case "cape-drape": return "Drape cape"
        case "sneakers": return "High-tops"
        case "boots": return "Rain boots"
        case "slippers": return "Bunny slippers"
        case "skates": return "Roller skates"
        case "snail": return "Snail"
        case "worried": return "Worried"
        case "surprised": return "Surprised"
        case "cheeky": return "Cheeky"
        case "sweat": return "Sweat drop"
        case "tear": return "Happy tear"
        case "steam": return "Steam puff"
        case "tiedye": return "Tie-dye"
        case "colorblock": return "Color block"
        case "babyblue": return "Baby blue"
        case "default": return "Original"
        case "heart-glasses": return "Heart shades"
        case "tophat": return "Top hat"
        case "catears": return "Cat ears"
        case "bunnyears": return "Bunny ears"
        case "grad": return "Grad cap"
        case "bowtie": return "Bow tie"
        case "chain": return "Gold chain"
        case "cottoncandy": return "Cotton candy"
        case "pro": return "Pro gold"
        default:
            return id.prefix(1).uppercased() + id.dropFirst()
        }
    }
}

struct MascotBuilderView: View {
    let initial: String
    var mode: MascotBuilderMode = .profile
    /// The player has an uploaded photo: show the "My mascot | My photo" toggle.
    var hasPhoto: Bool = false
    var level: Int = 1
    var isPro: Bool = false
    /// Every change (Edit Profile mirrors it into its own state).
    var onChange: ((AvatarConfig) -> Void)? = nil
    var onSave: ((AvatarConfig) -> Void)? = nil
    var onSkip: (() -> Void)? = nil
    var saveTitle: String = "Save"
    var saving: Bool = false
    /// `.room`: closes without keeping the changes.
    var onClose: (() -> Void)? = nil
    /// Item gating (AvatarAccessConfig.itemGating, OFF): the earn evaluator's stats (nil = the level alone) and the
    /// player's SAVED look (its parts are never locked — grandfathered).
    var accessStats: AvatarEarnStats? = nil
    var savedConfig: AvatarConfig? = nil

    @State private var config: AvatarConfig
    @State private var tab: MascotBuilderTab = .body
    /// `.room`: Undo (every change pushes the look before it) and the mascot's hop on each change.
    @State private var undo: [AvatarConfig] = []
    @State private var previous: AvatarConfig
    @State private var undoing = false
    @State private var hopToken = 0
    /// The tabs whose NEW tags were already on screen when this visit began.
    @State private var seenNew: Set<MascotBuilderTab> = Set(MascotBuilderTab.allCases.filter(MascotNew.seen))
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1
    @State private var showPro = false
    @State private var lastTick = Date.distantPast
    /// "Mask doesn't fit with Round glasses, so it came off" (the fit system swaps conflicting picks).
    @State private var note: String?
    /// The look the room opened on (the saved look): its seasonal parts stay offered after their season.
    private let savedLook: AvatarConfig
    /// Item gating: the worn parts that blocked Save (the Locked card lists them).
    @State private var lockedParts: [AvatarPart] = []
    @State private var showLocked = false

    init(initial: String, config: AvatarConfig, mode: MascotBuilderMode = .profile, hasPhoto: Bool = false,
         level: Int = 1, isPro: Bool = false, saveTitle: String = "Save", saving: Bool = false,
         onChange: ((AvatarConfig) -> Void)? = nil, onSave: ((AvatarConfig) -> Void)? = nil, onSkip: (() -> Void)? = nil,
         startTab: MascotBuilderTab = .body, onClose: (() -> Void)? = nil,
         accessStats: AvatarEarnStats? = nil, savedConfig: AvatarConfig? = nil) {
        self.initial = initial
        self.mode = mode
        self.hasPhoto = hasPhoto
        self.level = level
        self.isPro = isPro
        self.saveTitle = saveTitle
        self.saving = saving
        self.onChange = onChange
        self.onSave = onSave
        self.onSkip = onSkip
        self.onClose = onClose
        self.accessStats = accessStats
        self.savedConfig = savedConfig
        _config = State(initialValue: config)
        _previous = State(initialValue: config)
        savedLook = config
        _tab = State(initialValue: startTab)
    }

    private var accent: Color { Color(hex: AvatarCatalog.colorValue(config.color)) }

    var body: some View {
        Group {
            if mode == .room {
                room
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    stage
                    if hasPhoto { displayToggle }
                    presets
                    tabs
                    options.builderAnchor(.options)
                    actions
                }
            }
        }
        .onChange(of: config) { c in
            onChange?(c)
            if mode == .room {
                if !undoing { undo.append(previous); if undo.count > 40 { undo.removeFirst() } }
                undoing = false
                previous = c
                let now = Date()
                if now.timeIntervalSince(lastTick) > 0.08 { Feedback.hop(volume: 0.8) }
                lastTick = now
                hopToken += 1
            } else {
                bounce()
            }
        }
        .onChange(of: tab) { MascotNew.markSeen($0) }
        .onAppear { MascotNew.markSeen(tab) }
        #if DEBUG
        .onPerfTour { c in
            switch c {
            case .builderTab(let t): tab = t
            case .builderHop: hopToken += 1
            default: break
            }
        }
        #endif
        .softSheet(isPresented: $showLocked) {
            LockedItemCard(config: config, initial: initial, locked: lockedParts, ctx: accessContext,
                           onSaveWithout: {
                               let next = MascotAccess.enforce(config, accessContext)
                               showLocked = false
                               // after the card is down (the room's onSave closes its full-screen cover)
                               DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onSave?(next) }
                           },
                           onClose: { showLocked = false })
            .presentationDetents([.medium, .large])
        }
        .softSheet(isPresented: $showPro) { ProView() }
    }

    // MARK: Item gating (AvatarAccessConfig.itemGating, OFF)

    /// Gating on: every part can be tried on; Save checks access (WordociousCore AvatarAccess).
    private var gated: Bool { MascotAccess.isOn }

    private var accessContext: AvatarAccessContext {
        MascotAccess.context(isPro: isPro, stats: accessStats ?? AvatarEarnStats(level: Double(level)), saved: savedConfig)
    }

    /// A part the player can try on but not save yet (always false while gating is off).
    private func gatedLock(_ slot: String, _ id: String) -> Bool {
        gated && MascotAccess.isLocked(slot, id, accessContext)
    }

    /// Save: gating off = today (the Pro strip); on = the save check, and the Locked card when parts are locked.
    private func save() {
        guard let onSave else { return }
        guard let check = MascotAccess.saveCheck(config, accessContext) else {
            onSave(AvatarCatalog.enforcePro(config, isPro: isPro))
            return
        }
        if check.ok {
            onSave(config)
        } else {
            Haptics.tap()
            lockedParts = check.locked
            showLocked = true
        }
    }

    // MARK: The Dressing Room (founder 10-05)

    private var room: some View {
        VStack(spacing: 0) {
            DressStage(config: config, initial: initial, height: StageMetrics.roomHeight, mascotSize: 160,
                       hopToken: hopToken, curtains: true, bulbs: true) {
                ZStack(alignment: .topLeading) {
                    HStack(alignment: .center) {
                        StageCloseButton(label: "Close without saving") { onClose?() }
                        Spacer(minLength: 0)
                        if onSave != nil {
                            Button { save() } label: {
                                CandyLabel(title: saving ? "Saving…" : saveTitle)
                            }
                            // The finished cast primary (the frost helper pill read pale on the stage).
                            .buttonStyle(CastButtonStyle(color: .purple, size: .small, fullWidth: false))
                            .disabled(saving)
                            .builderAnchor(.save)
                        }
                    }
                    .padding(.horizontal, 10).padding(.top, 40)
                    VStack(spacing: 9) {
                        roundButton("dice.fill", label: "Randomize", top: 0x5EEAD4, bottom: 0x0D9488) { randomize() }
                            .builderAnchor(.randomize)
                        roundButton("arrow.uturn.backward", label: "Undo", top: 0xFDE68A, bottom: 0xF59E0B, disabled: undo.isEmpty) {
                            guard let last = undo.popLast() else { return }
                            undoing = true
                            config = last
                        }
                    }
                    .padding(.leading, 12).padding(.top, 92)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .background(alignment: .top) {
                MascotBackdrop(bg: config.bg, base: accent, dark: Theme.isDark).ignoresSafeArea(edges: .top)
            }
            .clipShape(RoomStageShape(radius: 26))
            .builderAnchor(.preview)
            iconTabs.padding(.horizontal, 6).padding(.top, 8)
            ScrollView(showsIndicators: false) {
                options.builderAnchor(.options)
                    .padding(.horizontal, 14).padding(.top, 6).padding(.bottom, 40)
            }
        }
        .background(Theme.isDark ? Theme.surface : Color(hex: 0xF7F2FF))
    }

    private func roundButton(_ symbol: String, label: String, top: UInt, bottom: UInt, disabled: Bool = false,
                             _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 15, weight: .black)).foregroundStyle(.white)
                .shadow(color: .black.opacity(0.2), radius: 1, y: 1)
                .frame(width: 38, height: 38)
                .background(Circle().fill(LinearGradient(colors: [Color(hex: top), Color(hex: bottom)], startPoint: .top, endPoint: .bottom)))
                .overlay(Circle().fill(LinearGradient(colors: [.white.opacity(0.45), .clear], startPoint: .top, endPoint: .center)).padding(3))
                .shadow(color: Color(hex: bottom).opacity(0.5), radius: 0, y: 3)
        }
        .buttonStyle(.squish)
        .opacity(disabled ? 0.45 : 1)
        .disabled(disabled)
        .accessibilityLabel(label)
    }

    /// All ten tabs in one row: the ChatGPT tab icon over a tiny label; the open tab lifts on a white pad.
    private var iconTabs: some View {
        HStack(spacing: 1) {
            ForEach((MascotSeasonal.shelf.isEmpty ? [] : [MascotBuilderTab.season]) + MascotBuilderTab.shownRoomTabs) { t in
                let on = tab == t || (t == .nose && tab == .cheeks)
                Button { Haptics.tap(); tab = t } label: {
                    VStack(spacing: 2) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(on ? Color.white : Color.white.opacity(Theme.isDark ? 0.08 : 0.55))
                                .shadow(color: Color(hex: 0x7C3AED).opacity(on ? 0.3 : 0), radius: 6, y: 3)
                            if t == .season, let first = MascotSeasonal.shelf.first {
                                StageArt("art-av-acc-\(first.id)", height: 24)   // the season's first hat (the pumpkin)
                            } else if t == .pose {
                                // no tab art yet: the player's own mascot, waving
                                MascotPoseThumb(config: config, pose: "wave", initial: initial, size: 30)   // > 28 pt: small mascots never pose
                            } else {
                                StageArt("art-dress-tab-\(t.artId)", height: 24)
                            }
                        }
                        .frame(width: 32, height: 32)
                        Text(t == .extras ? "Extras" : t.title)
                            .font(Brand.font(8.5, .black))
                            .foregroundStyle(on ? Color(hex: t == .season ? 0xC2410C : 0x6D28D9) : (Theme.isDark ? Theme.textSecondary : Color(hex: 0x6B5C8F)))
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .frame(maxWidth: .infinity)
                    .overlay(alignment: .topTrailing) {
                        if hasNew(t) { Circle().fill(Color(hex: 0xEC4899)).frame(width: 7, height: 7).offset(x: -4, y: 1) }
                    }
                }
                .buttonStyle(.squish)
                .accessibilityLabel("\(t.title) options")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                .builderAnchor(.tab(t))
            }
        }
    }

    private func hasNew(_ t: MascotBuilderTab) -> Bool {
        guard !seenNew.contains(t) else { return false }
        switch t {
        case .hats: return MascotNew.ids.contains { $0.hasPrefix("head:") }
        case .extras: return true   // the 10-05 integrated parts (held / wraps / shoes / buddies / brows / extras)
        default: return false
        }
    }

    // MARK: Stage

    private var stage: some View {
        let dark = Theme.isDark
        return ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(LinearGradient(colors: dark ? [accent.mixed(over: Theme.surface, 0.18), accent.mixed(over: Theme.surface, 0.32)]
                                                  : [accent.wash(0.10), accent.wash(0.24)],
                                     startPoint: .top, endPoint: .bottom))
            // A soft floor shadow under the hopping mascot.
            Ellipse().fill(Color.black.opacity(dark ? 0.35 : 0.10))
                .frame(width: 110 * (1 - min(0.3, -hop / 60)), height: 14)
                .offset(y: 82)
            MascotAvatar(config: config, initial: initial, size: 156, cached: false)
                .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
                .offset(y: hop)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 196)
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
            .strokeBorder(dark ? accent.opacity(0.45) : accent.wash(0.34), lineWidth: 1.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your mascot preview")
        .builderAnchor(.preview)
    }

    private func bounce() {
        let now = Date()
        if now.timeIntervalSince(lastTick) > 0.08 { Feedback.hop(volume: 0.8) }
        lastTick = now
        guard !Theme.reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.08)) { squash = 0.9 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.55)) { hop = -18; squash = 1.04 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.24) {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.5)) { hop = 0; squash = 1 }
        }
    }

    // MARK: Display toggle (players with a photo)

    private var displayToggle: some View {
        VStack(alignment: .leading, spacing: 6) {
            SoftSegmented(options: [(key: "mascot", label: "My mascot"), (key: "photo", label: "My photo")],
                          selection: Binding(get: { config.display }, set: { config.display = $0 }),
                          accent: G5Accent.purple, accessibilityLabel: "Which avatar shows")
            Text(config.display == "photo" ? "Your photo shows. Your mascot is saved for later."
                                           : "Your mascot shows. Your photo stays saved.")
                .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
        }
        .builderAnchor(.displayToggle)
    }

    // MARK: Presets

    private var presets: some View {
        VStack(alignment: .leading, spacing: 6) {
            FinishLabel("START FROM")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(AvatarCastRules.ids, id: \.self) { id in
                        let name = AvatarCastRules.name(id) ?? id.uppercased()
                        Button { applyPreset(id) } label: {
                            VStack(spacing: 3) {
                                CastAvatarFace(castId: id, size: 44)
                                Text(name).font(Brand.font(10, .black)).foregroundStyle(FinishInk.heading)
                                    .lineLimit(1).minimumScaleFactor(0.7)
                            }
                            .frame(width: 58)
                            .padding(.vertical, 6)
                            .g5Option(active: false, accent: AvatarCastArt.color(id), radius: 14)
                        }
                        .buttonStyle(.squish)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Start from \(name)")
                        .accessibilityAddTraits(.isButton)
                    }
                }
                .padding(.horizontal, 2).padding(.vertical, 4)
            }
        }
        .builderAnchor(.presets)
    }

    private func applyPreset(_ castId: String) {
        var p = AvatarCatalog.castPreset(castId)
        // Keep what isn't part of the character: frame, backdrop, display.
        p.frame = config.frame
        p.display = config.display
        config = p
    }

    // MARK: Tabs (candy chips)

    private var tabs: some View {
        iconTabs
    }

    private var chipTabs: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(MascotBuilderTab.allCases) { t in
                        Button {
                            tab = t
                        } label: {
                            CandyLabel(title: t.title)
                        }
                        .buttonStyle(CandyButtonStyle(variant: tab == t ? .purple : .peach, size: .small, fullWidth: false))
                        .accessibilityLabel("\(t.title) options")
                        .accessibilityAddTraits(tab == t ? [.isButton, .isSelected] : .isButton)
                        .builderAnchor(.tab(t))
                    }
                }
                .padding(.horizontal, 2).padding(.vertical, 6)
            }
            .onChange(of: tab) { t in
                if Theme.reduceMotion { proxy.scrollTo(MascotBuilderAnchor.tab(t).id, anchor: .center) }
                else { withAnimation(.easeInOut(duration: 0.25)) { proxy.scrollTo(MascotBuilderAnchor.tab(t).id, anchor: .center) } }
            }
        }
    }

    // MARK: Option grids

    private struct Option: Identifiable {
        let slot: String
        let value: String
        var id: String { "\(slot):\(value)" }
    }

    private let columns = [GridItem(.adaptive(minimum: 60), spacing: 10)]

    @ViewBuilder private var options: some View {
        switch tab {
        case .body: grid(AvatarCatalog.bodies.map { Option(slot: "body", value: $0) })
        case .color: swatchGrid("color")
        case .pattern:
            VStack(alignment: .leading, spacing: 10) {
                grid(AvatarCatalog.patterns.map { Option(slot: "pattern", value: $0) })
                if config.pattern != "solid" {
                    FinishLabel("PATTERN COLOR")
                    swatchGrid("patternColor")
                }
            }
        case .eyes: grid((["none"] + AvatarCatalog.eyes).map { Option(slot: "eyes", value: $0) })   // founder 10-05: None on any part
        case .nose, .cheeks:
            VStack(alignment: .leading, spacing: 10) {
                FinishLabel("NOSE")
                grid(AvatarCatalog.noses.map { Option(slot: "nose", value: $0) })
                FinishLabel("CHEEKS")
                grid(AvatarCatalog.cheeks.map { Option(slot: "cheeks", value: $0) })
            }
        case .mouth: grid((["none"] + AvatarCatalog.mouths).map { Option(slot: "mouth", value: $0) })
        case .hats:
            VStack(alignment: .leading, spacing: 10) {
                grid(AvatarCatalog.heads.map { Option(slot: "head", value: $0) })
                accColorSection
            }
        case .extras:
            VStack(alignment: .leading, spacing: 10) {
                FinishLabel("FACE")
                grid(AvatarCatalog.faces.map { Option(slot: "face", value: $0) })
                FinishLabel("NECK + BACK")
                grid(AvatarCatalog.necks.map { Option(slot: "neck", value: $0) })
                // 10-05 integrated parts ride in Extras until the Dressing Room gives them their own tabs
                ForEach(AvatarCatalog.integratedFields, id: \.field) { f in
                    FinishLabel(Self.integratedHeading[f.field] ?? f.field.uppercased())
                    grid(f.options.map { Option(slot: f.field, value: $0) })
                }
                accColorSection
            }
        case .season:
            VStack(alignment: .leading, spacing: 8) {
                grid(MascotSeasonal.shelf.map { Option(slot: $0.field, value: $0.id) })
                Text("Free for the season. Save a look and it stays yours.")
                    .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                    .frame(maxWidth: .infinity)
            }
        case .pose:
            VStack(alignment: .leading, spacing: 8) {
                grid(AvatarPose.ids.map { Option(slot: "pose", value: $0) })
                Text("Your mascot holds this pose and comes alive on your Stage and Home.")
                    .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
            }
        case .backdrop: grid(AvatarCatalog.backdropIds.map { Option(slot: "bg", value: $0) })
        case .frame:
            VStack(alignment: .leading, spacing: 8) {
                grid(AvatarCatalog.frames.map { Option(slot: "frame", value: $0) })
                Text("Reach a new level tier to unlock its frame.")
                    .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
            }
        }
    }

    private func grid(_ opts: [Option]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            LazyVGrid(columns: columns, spacing: 8) {
                // seasonal parts: only while their season is on, or when the saved look wears them
                ForEach(opts.filter { MascotSeasonal.available($0.slot, $0.value, saved: savedLook) }) { o in tile(o) }
            }
            if let note {
                Text(note).font(Brand.font(11, .bold)).foregroundStyle(Color(hex: 0x6D28D9))
                    .frame(maxWidth: .infinity).transition(.opacity)
            }
        }
    }

    /// The accessory color row: only while a white (tintable) accessory is worn.
    @ViewBuilder private var accColorSection: some View {
        if AvatarCatalog.tintable.contains(config.head) || AvatarCatalog.tintable.contains(config.neck) {
            FinishLabel("ACCESSORY COLOR")
            swatchGrid("accColor")
        }
    }

    private static let rowTitles = ["bright": "BRIGHTS", "pastel": "PASTELS", "deep": "DEEPS", "neutral": "NEUTRALS", "special": "PRO SPECIALS"]

    /// Glossy round swatches grouped by row (no tiles, no outlines): selected = a white check + a gentle scale.
    private func swatchGrid(_ slot: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if slot == "accColor" {
                swatchRow(slot, ["default"])
            }
            ForEach(AvatarCatalog.colorGroups, id: \.self) { g in
                Text(Self.rowTitles[g] ?? g.uppercased()).font(Brand.font(9, .black)).foregroundStyle(FinishInk.secondary)
                swatchRow(slot, AvatarCatalog.colors.filter { $0.group == g }.map(\.id))
            }
        }
    }

    private func swatchRow(_ slot: String, _ ids: [String]) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 40), spacing: 4)], spacing: 4) {
            ForEach(ids, id: \.self) { id in
                let o = Option(slot: slot, value: id)
                let on = isSelected(o)
                let sw = AvatarCatalog.color(id)
                let proLocked = !gated && id != "default" && sw.pro && !isPro
                // gating on: locked swatches dim with a lock tag but stay tappable (try-on)
                let locked = gatedLock(slot, id)
                let fill: AnyShapeStyle = id == "default"
                    ? AnyShapeStyle(Color.white)
                    : sw.stops.count >= 2
                        ? AnyShapeStyle(LinearGradient(colors: sw.stops.map { Color(hex: UInt($0.dropFirst(), radix: 16) ?? 0) },
                                                       startPoint: sw.dir == "h" ? .leading : .topLeading, endPoint: sw.dir == "h" ? .trailing : sw.dir == "d" ? .bottomTrailing : .bottom))
                        : AnyShapeStyle(Color(hex: AvatarCatalog.colorValue(id)))
                let light = ["default", "white", "cream", "butter", "seafoam"].contains(id)
                Button {
                    if proLocked { showPro = true; return }
                    config = applied(o)
                } label: {
                    ZStack {
                        Circle().fill(fill)
                        Circle().fill(RadialGradient(colors: [.white.opacity(0.6), .white.opacity(0)], center: UnitPoint(x: 0.35, y: 0.28), startRadius: 0, endRadius: 14))
                        if on {
                            Image(systemName: "checkmark").font(.system(size: 13, weight: .black)).foregroundStyle(light ? Color(hex: 0x7C3AED) : .white)
                        } else if id == "default" {
                            Text("AUTO").font(Brand.fixedFont(8, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                        }
                    }
                    .frame(width: 32, height: 32)
                    .opacity(locked && !on ? 0.55 : 1)
                    .shadow(color: Color(hex: AvatarCatalog.colorValue(id)).opacity(0.4), radius: 3, y: 2)
                    .scaleEffect(on ? 1.14 : 1)
                    .animation(.spring(response: 0.25, dampingFraction: 0.6), value: on)
                    .overlay(alignment: .topTrailing) { if proLocked { MascotProPill().scaleEffect(0.7).offset(x: 10, y: -8) } }
                    .overlay(alignment: .bottomTrailing) { if locked { MascotLockTag(height: 12).offset(x: 4, y: 3) } }
                    .frame(width: 40, height: 40)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("\(MascotOptionNames.name(id))\(proLocked ? ", Pro only" : locked ? ", locked, try it on" : "")")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
    }

    /// Section headings for the 10-05 integrated parts (in the Extras tab).
    static let integratedHeading: [String: String] = ["held": "IN HAND", "wrap": "WRAPS", "feet": "SHOES", "pet": "BUDDIES",
                                                      "brows": "BROWS", "extra": "FACE EXTRAS"]

    private func applied(_ o: Option) -> AvatarConfig {
        var c = config
        switch o.slot {
        case "body": c.body = o.value
        case "color":
            if c.patternColor == c.color { c.patternColor = o.value }
            c.color = o.value
        case "pattern":
            c.pattern = o.value
            if o.value != "solid" && c.patternColor == c.color { c.patternColor = Self.contrast(for: c.color) }
        case "patternColor": c.patternColor = o.value
        case "accColor": c.accColor = o.value
        case "eyes", "nose", "cheeks", "mouth", "head", "face", "neck", "held", "wrap", "feet", "pet", "brows", "extra":
            // the fit system: a pick that doesn't fit with something worn swaps it out
            if let fit = MascotParts.fit { c = AvatarFit.applyPick(c, field: o.slot, id: o.value, manifest: fit) }
        case "bg": c.bg = o.value
        case "frame": c.frame = o.value
        case "pose": c.pose = o.value
        default: break
        }
        return c
    }

    /// A friendly second color for a fresh pattern (a light swatch that reads on the body).
    static func contrast(for color: String) -> String {
        switch color {
        case "lilac", "peach", "mint", "yellow", "amber": return "purple"
        case "pink", "red", "orange": return "peach"
        case "green", "emerald", "teal": return "mint"
        default: return "lilac"
        }
    }

    private func isSelected(_ o: Option) -> Bool {
        switch o.slot {
        case "body": return config.body == o.value
        case "color": return config.color == o.value
        case "pattern": return config.pattern == o.value
        case "patternColor": return config.patternColor == o.value
        case "accColor": return config.accColor == o.value
        case "eyes": return config.eyes == o.value
        case "nose": return config.nose == o.value
        case "cheeks": return config.cheeks == o.value
        case "mouth": return config.mouth == o.value
        case "head": return config.head == o.value
        case "face": return config.face == o.value
        case "neck": return config.neck == o.value
        case "held", "wrap", "feet", "pet", "brows", "extra": return AvatarFit.value(config, o.slot) == o.value
        case "bg": return config.bg == o.value
        case "frame": return config.frame == o.value
        case "pose": return config.pose == o.value
        default: return false
        }
    }

    private func isProOnly(_ o: Option) -> Bool {
        switch o.slot {
        case "head": return AvatarCatalog.isProOnly(head: o.value)
        case "neck": return AvatarCatalog.isProOnly(neck: o.value)
        case "held": return AvatarCatalog.proOnlyHeld.contains(o.value)
        case "wrap": return AvatarCatalog.proOnlyWraps.contains(o.value)
        case "frame": return AvatarCatalog.isProOnly(frame: o.value)
        case "bg": return AvatarCatalog.isProOnly(bg: o.value)
        default: return false
        }
    }

    /// The level tier a frame needs (nil = no level gate).
    private func tierLock(_ o: Option) -> LevelTier? {
        guard o.slot == "frame", let tier = AvatarFrameRules.tier(o.value) else { return nil }
        return AvatarFrameRules.isUnlocked(o.value, level: level) ? nil : tier
    }

    private func label(_ o: Option) -> String {
        if o.slot == "color" || o.slot == "patternColor" { return MascotOptionNames.name(o.value) }
        if o.slot == "frame", let t = AvatarFrameRules.tier(o.value) { return t.label }
        if o.slot == "pose" { return o.value == "none" ? "Standing" : AvatarPosesData.bundled?.poses[o.value]?.label ?? MascotOptionNames.name(o.value) }
        return MascotOptionNames.name(o.value)
    }

    private func a11y(_ o: Option) -> String {
        let kind: String = {
            switch o.slot {
            case "body": return "body"
            case "color": return "color"
            case "pattern": return "pattern"
            case "patternColor": return "pattern color"
            case "eyes": return "eyes"
            case "nose": return "nose"
            case "cheeks": return "cheeks"
            case "mouth": return "mouth"
            case "head": return "hat"
            case "face", "neck", "held", "wrap", "feet", "pet", "extra": return "extra"
            case "brows": return "brows"
            case "bg": return "backdrop"
            case "frame": return "frame"
            case "pose": return "pose"
            default: return ""
            }
        }()
        var s = o.value == "none" ? "No \(kind)" : "\(label(o)) \(kind)"
        if gated { if gatedLock(o.slot, o.value) { s += ", locked, try it on" } }
        else if let t = tierLock(o) { s += ", locked, reach level \(t.minLevel)" }
        else if isProOnly(o) && !isPro { s += ", Pro only" }
        return s
    }

    /// Founder 10-05 (Dressing Room): a tile shows ONLY the part on a soft round pad (no framed mascot
    /// thumbnails); the selected one glows gold. NEW / PRO tags are the ChatGPT tag art.
    private func tile(_ o: Option) -> some View {
        let on = isSelected(o)
        // gating on: no Pro pill / level lock — locked parts dim with a lock tag and stay tappable (try-on)
        let proLocked = !gated && isProOnly(o) && !isPro
        let tier = gated ? nil : tierLock(o)
        let locked = gatedLock(o.slot, o.value)
        let seasonOf = MascotSeasonal.partSeason(o.slot, o.value)
        let isNew = seasonOf == nil && (MascotNew.ids.contains("\(o.slot):\(o.value)") || MascotNew.integrated(slot: o.slot, value: o.value)) && !seenNew.contains(tab)
        let dark = Theme.isDark
        return Button {
            if tier != nil { return }
            if proLocked { showPro = true; return }
            let next = applied(o)
            if let fit = MascotParts.fit, let hit = AvatarFit.pickConflict(config, field: o.slot, id: o.value, manifest: fit) {
                note = "\(MascotOptionNames.name(o.value)) doesn't fit with \(MascotOptionNames.name(hit.id)), so it came off"
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { note = nil }
            } else {
                note = nil
            }
            config = next
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    // a soft lavender pad (white parts — wings, chef hat — still read on it)
                    Circle().fill(on ? Color.white : (dark ? Color.white.opacity(0.10) : Color(hex: 0xEAE2FA)))
                    PartThumb(slot: o.slot, value: o.value, config: config, initial: initial)
                        .padding(o.slot == "bg" ? 0 : 7)
                        .clipShape(Circle())
                        .opacity(tier != nil ? 0.45 : locked && !on ? 0.55 : 1)
                    if tier != nil { StageArt("art-dress-lock", height: 20) }
                }
                .aspectRatio(1, contentMode: .fit)
                .shadow(color: on ? Color(hex: 0xF59E0B).opacity(0.55) : .clear, radius: 6)
                .overlay(Circle().strokeBorder(on ? Color(hex: 0xF5B82E) : .clear, lineWidth: 3))
                .overlay(alignment: .topTrailing) { if isNew && !proLocked { StageArt("art-dress-tag-new", height: 15).offset(x: 4, y: -3) } }
                .overlay(alignment: .topTrailing) { if let seasonOf { StageArt("art-dress-tag-\(seasonOf)", height: 13).offset(x: 8, y: -3) } }
                .overlay(alignment: .bottomTrailing) { if proLocked { StageArt("art-dress-tag-pro", height: 15).offset(x: 6, y: 2) } }
                .overlay(alignment: .bottomTrailing) { if locked { MascotLockTag().offset(x: 5, y: 2) } }
                if let tier {
                    Text("Lv \(tier.minLevel)").font(Brand.font(9, .black)).foregroundStyle(FinishInk.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11y(o))
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: Randomize / Save / Skip

    private var actions: some View {
        HStack(spacing: 10) {
            Button { randomize() } label: { CandyLabel(title: "Randomize", symbol: "dice.fill") }
                .buttonStyle(CandyButtonStyle(variant: .teal, size: .medium, fullWidth: true))
                .accessibilityHint("Makes a random mascot")
                .builderAnchor(.randomize)
            if onSave != nil {
                Button { save() } label: {
                    CandyLabel(title: saving ? "Saving…" : saveTitle, symbol: "checkmark")
                }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: true))
                .disabled(saving)
                .builderAnchor(.save)
            }
        }
        .overlay(alignment: .bottom) {
            if mode == .onboarding, let onSkip {
                Button { onSkip() } label: { CandyLabel(title: "Do it later") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                    .builderAnchor(.skip)
                    .offset(y: 52)
            }
        }
        .padding(.bottom, mode == .onboarding && onSkip != nil ? 52 : 0)
    }

    private func randomize() {
        config = Self.randomLook(from: config, isPro: isPro, level: level)
    }

    /// A random look the player can wear (no locked Pro parts, no level-locked frames, never a fit conflict).
    static func randomLook(from config: AvatarConfig, isPro: Bool, level: Int) -> AvatarConfig {
        var g = SystemRandomNumberGenerator()
        func any(_ xs: [String]) -> String { xs.randomElement(using: &g) ?? xs[0] }
        func wearable(_ slot: String, _ ids: [String]) -> [String] {
            ids.filter { id in
                switch slot {
                // seasonal parts only while their season is on (MascotSeasonal; never a saved-only pick)
                case "head": return (isPro || !AvatarCatalog.isProOnly(head: id)) && MascotSeasonal.available("head", id, saved: nil)
                case "neck": return (isPro || !AvatarCatalog.isProOnly(neck: id)) && MascotSeasonal.available("neck", id, saved: nil)
                case "bg": return isPro || !AvatarCatalog.isProOnly(bg: id)
                default: return true
                }
            }
        }
        var c = config
        c.body = any(AvatarCatalog.bodies)
        c.color = any(AvatarCatalog.colorIds.filter { isPro || !AvatarCatalog.isProOnly(color: $0) })
        c.pattern = Bool.random(using: &g) ? "solid" : any(AvatarCatalog.patterns)
        c.patternColor = c.pattern == "solid" ? c.color : any(AvatarCatalog.colorIds.filter { $0 != c.color })
        c.eyes = any(AvatarCatalog.eyes)
        c.nose = Bool.random(using: &g) ? "none" : any(AvatarCatalog.noses)
        c.cheeks = Bool.random(using: &g) ? "none" : any(AvatarCatalog.cheeks)
        c.mouth = any(AvatarCatalog.mouths)
        c.head = Int.random(in: 0..<10, using: &g) < 4 ? "none" : any(wearable("head", AvatarCatalog.heads))
        c.face = Int.random(in: 0..<10, using: &g) < 7 ? "none" : any(AvatarCatalog.faces)
        c.neck = Int.random(in: 0..<10, using: &g) < 6 ? "none" : any(wearable("neck", AvatarCatalog.necks))
        c.bg = Bool.random(using: &g) ? "auto" : any(wearable("bg", AvatarCatalog.backdropIds))
        if c == config { c.eyes = any(AvatarCatalog.eyes.filter { $0 != config.eyes }) }
        // never a combination the fit system rules out (the face extra yields)
        if let fit = MascotParts.fit, AvatarFit.pickConflict(c, field: "face", id: c.face, manifest: fit) != nil { c.face = "none" }
        return c
    }
}

/// One maker option drawn as JUST the part (founder 10-05): the body shape in the current color, the
/// pattern on that body, the face part / accessory art, the backdrop swatch or the frame.
struct PartThumb: View {
    let slot: String
    let value: String
    let config: AvatarConfig
    let initial: String

    var body: some View {
        let dark = Theme.isDark
        let base = Color(hex: AvatarCatalog.colorValue(config.color))
        if slot == "pose" {
            MascotPoseThumb(config: config, pose: value, initial: initial, size: 56)
        } else if value == "none" || (slot == "pattern" && value == "solid") {
            NoneGlyph()
        } else {
        switch slot {
        case "bg":
            MascotBackdrop(bg: value, base: base, dark: dark)
        case "body", "pattern":
            let bodyId = slot == "body" ? value : config.body
            let pat = slot == "pattern" ? value : "solid"
            Canvas { ctx, size in
                let r = CGRect(origin: .zero, size: size).insetBy(dx: size.width * 0.04, dy: size.height * 0.04)
                let bodyColor = AvatarCatalog.color(config.color)
                let ink = MascotArtPainter.color(AvatarCatalog.color(config.patternColor == config.color ? MascotBuilderView.contrast(for: config.color) : config.patternColor).hex)
                MascotArtPainter.tinted(ctx, "art-av-body-\(bodyId)", r, fill: MascotArtPainter.shading(bodyColor, in: r)) { layer in
                    guard pat != "solid" else { return }
                    MascotArtPainter.pattern(&layer, AvatarFit.patternShapes(pat), in: r, ink: ink, base: base)
                }
            }
        case "frame":
            if value == "none" {
                Text("None").font(Brand.font(10, .black)).foregroundStyle(FinishInk.secondary)
            } else if value == "pro" {
                MascotFrame(frame: "pro", size: 40).padding(4)
            } else if ArtAsset.exists("art-frame-\(value)") {
                ArtThumbs.image("art-frame-\(value)", points: 48).resizable().interpolation(.high).scaledToFit()
            } else {
                MascotFrame(frame: value, size: 40)
            }
        default:
            let kind = ["eyes": "eyes", "mouth": "mouth", "nose": "nose", "cheeks": "cheeks", "brows": "brows"][slot] ?? "acc"
            if value == "none" {
                Text("None").font(Brand.font(10, .black)).foregroundStyle(FinishInk.secondary)
            } else if let name = MascotParts.art(kind, value) {
                Image(uiImage: MascotArtCache.uiImage(name) ?? UIImage()).resizable().interpolation(.high).scaledToFit()
            } else {
                Text(MascotOptionNames.name(value)).font(Brand.font(9, .black)).foregroundStyle(FinishInk.heading)
                    .multilineTextAlignment(.center).minimumScaleFactor(0.6)
            }
        }
        }
    }
}

/// The soft "None" tile glyph (ChatGPT art: a puffy lavender ring with a gentle slash; founder 10-05:
/// "you're able to hit None on any body part").
struct NoneGlyph: View {
    var body: some View {
        if ArtAsset.exists("art-dress-none") {
            StageArt("art-dress-none", height: 30).accessibilityHidden(true)
        } else {
            Text("None").font(Brand.font(10, .black)).foregroundStyle(FinishInk.secondary)
        }
    }
}

/// The room's stage: square top corners (it runs under the status bar), rounded bottom.
struct RoomStageShape: Shape {
    var radius: CGFloat
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY - 400))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY - 400))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - radius))
        p.addQuadCurve(to: CGPoint(x: r.maxX - radius, y: r.maxY), control: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX + radius, y: r.maxY))
        p.addQuadCurve(to: CGPoint(x: r.minX, y: r.maxY - radius), control: CGPoint(x: r.minX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// The small gold PRO pill on a Pro-only option (free players only, §AA4).
struct MascotProPill: View {
    var body: some View {
        HStack(spacing: 2) {
            Icon3D(.crown, size: 10)
            Text("PRO").font(Brand.fixedFont(8.5, .black)).tracking(0.5).foregroundStyle(Color(hex: 0x7A3D00))
        }
        .padding(.horizontal, 5).padding(.vertical, 2)
        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xFFE08A), Color(hex: 0xF5A524)], startPoint: .top, endPoint: .bottom)))
        .overlay(Capsule().strokeBorder(Color(hex: 0xB0650B).opacity(0.5), lineWidth: 1))
        .accessibilityHidden(true)
    }
}
