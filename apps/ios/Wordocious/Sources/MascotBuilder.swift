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

enum MascotBuilderMode { case profile, onboarding }

/// The builder's categories, in tab order.
enum MascotBuilderTab: String, CaseIterable, Identifiable, Hashable {
    case body, color, pattern, eyes, nose, cheeks, mouth, hats, extras, backdrop, frame
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
        }
    }
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

    @State private var config: AvatarConfig
    @State private var tab: MascotBuilderTab = .body
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1
    @State private var showPro = false
    @State private var lastTick = Date.distantPast
    /// "Mask doesn't fit with Round glasses, so it came off" (the fit system swaps conflicting picks).
    @State private var note: String?

    init(initial: String, config: AvatarConfig, mode: MascotBuilderMode = .profile, hasPhoto: Bool = false,
         level: Int = 1, isPro: Bool = false, saveTitle: String = "Save", saving: Bool = false,
         onChange: ((AvatarConfig) -> Void)? = nil, onSave: ((AvatarConfig) -> Void)? = nil, onSkip: (() -> Void)? = nil) {
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
        _config = State(initialValue: config)
    }

    private var accent: Color { Color(hex: AvatarCatalog.colorValue(config.color)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            stage
            if hasPhoto { displayToggle }
            presets
            tabs
            options.builderAnchor(.options)
            actions
        }
        .onChange(of: config) { c in
            onChange?(c)
            bounce()
        }
        .softSheet(isPresented: $showPro) { ProView() }
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

    private let columns = [GridItem(.adaptive(minimum: 70), spacing: 8)]

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
        case .eyes: grid(AvatarCatalog.eyes.map { Option(slot: "eyes", value: $0) })
        case .nose: grid(AvatarCatalog.noses.map { Option(slot: "nose", value: $0) })
        case .cheeks: grid(AvatarCatalog.cheeks.map { Option(slot: "cheeks", value: $0) })
        case .mouth: grid(AvatarCatalog.mouths.map { Option(slot: "mouth", value: $0) })
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
                accColorSection
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
                ForEach(opts) { o in tile(o) }
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
                let proLocked = id != "default" && sw.pro && !isPro
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
                    .shadow(color: Color(hex: AvatarCatalog.colorValue(id)).opacity(0.4), radius: 3, y: 2)
                    .scaleEffect(on ? 1.14 : 1)
                    .animation(.spring(response: 0.25, dampingFraction: 0.6), value: on)
                    .overlay(alignment: .topTrailing) { if proLocked { MascotProPill().scaleEffect(0.7).offset(x: 10, y: -8) } }
                    .frame(width: 40, height: 40)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("\(MascotOptionNames.name(id))\(proLocked ? ", Pro only" : "")")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
    }

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
        case "eyes", "nose", "cheeks", "mouth", "head", "face", "neck":
            // the fit system: a pick that doesn't fit with something worn swaps it out
            if let fit = MascotParts.fit { c = AvatarFit.applyPick(c, field: o.slot, id: o.value, manifest: fit) }
        case "bg": c.bg = o.value
        case "frame": c.frame = o.value
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
        case "bg": return config.bg == o.value
        case "frame": return config.frame == o.value
        default: return false
        }
    }

    private func isProOnly(_ o: Option) -> Bool {
        switch o.slot {
        case "head": return AvatarCatalog.isProOnly(head: o.value)
        case "neck": return AvatarCatalog.isProOnly(neck: o.value)
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
            case "face", "neck": return "extra"
            case "bg": return "backdrop"
            case "frame": return "frame"
            default: return ""
            }
        }()
        var s = o.value == "none" ? "No \(kind)" : "\(label(o)) \(kind)"
        if let t = tierLock(o) { s += ", locked, reach level \(t.minLevel)" }
        else if isProOnly(o) && !isPro { s += ", Pro only" }
        return s
    }

    private func tile(_ o: Option) -> some View {
        let on = isSelected(o)
        let proLocked = isProOnly(o) && !isPro
        let tier = tierLock(o)
        let tileAccent = o.slot == "color" ? Color(hex: AvatarCatalog.colorValue(o.value)) : accent
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
            VStack(spacing: 4) {
                MascotAvatar(config: applied(o), initial: initial, size: 54, cached: false)
                    .overlay(alignment: .topTrailing) {
                        if proLocked { MascotProPill().offset(x: 8, y: -6) }
                    }
                    .overlay {
                        if tier != nil {
                            Image(systemName: "lock.fill").font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white).shadow(color: .black.opacity(0.35), radius: 2, y: 1)
                        }
                    }
                Text(tier.map { "Lv \($0.minLevel)" } ?? label(o))
                    .font(Brand.font(10, .black)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7).padding(.horizontal, 2)
            .g5Option(active: on, accent: tileAccent, radius: 14)
            .opacity(tier != nil ? 0.55 : 1)
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
            if let onSave {
                Button { onSave(AvatarCatalog.enforcePro(config, isPro: isPro)) } label: {
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
        var g = SystemRandomNumberGenerator()
        func any(_ xs: [String]) -> String { xs.randomElement(using: &g) ?? xs[0] }
        func wearable(_ slot: String, _ ids: [String]) -> [String] {
            ids.filter { id in
                let o = Option(slot: slot, value: id)
                return !(isProOnly(o) && !isPro) && tierLock(o) == nil
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
        config = c
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
