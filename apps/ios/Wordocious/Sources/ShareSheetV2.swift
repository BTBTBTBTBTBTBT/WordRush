import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit

// The custom share sheet (founder direction A, 10-16): docs/design/review/share-sheet-1016/{option-a.png,SPEC.md}.
//
//   grabber → carousel of the REAL share-card renders (centered large, next one peeking) → "No spoilers | Full results"
//   pill (when the model says so) → look swatches (season / Normal, only in a season) → CHANNELS row.
//
// The model (`shareSheetModel(ctx, .ios)`, core ShareSheet.swift) decides the cards, the toggle, the swatches and the
// channel order; this file is the SwiftUI shell. Channel mechanics live in ShareChannels.swift.
//
// How the cards are rendered: the current night renderers sit behind each call site's own share closure
// (`onShare(reveal)` → ShareService.share → presentImages). `ShareCapture` runs that closure with `ShareCaptureState.active`
// set, so `presentImages` hands the rendered PNG to the sheet instead of presenting the system sheet (and
// `ShareEvents.log` stays quiet). ImageRenderer is main-actor only, so the render itself is main; everything around it is
// not: previews are downsampled off the main thread, PNG/JPEG encoding and the temp files happen in detached tasks, and
// a render is cached per (variant, look), so a toggle back and forth costs nothing.

// MARK: - Flag

enum ShareSheetFlag {
    /// `share_sheet_v2`: ships dark (admins + testers only) until its app_flags row opens it to everyone.
    @MainActor static var on: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-shareSheetDemo") { return true }
        #endif
        return FlagsService.shared.isLiveForTestersFirst("share_sheet_v2")
    }
}

// MARK: - Capture

@MainActor
enum ShareCapture {
    private static var buffer: [UIImage] = []

    static func append(_ images: [UIImage]) { buffer.append(contentsOf: images) }

    /// Runs `body` under a look ("normal" draws the standard cast even in a season); synchronous, so no frame of the live UI
    /// ever sees the override.
    static func withLook<T>(_ look: String, _ body: () -> T) -> T {
        CastSkin.renderNormal = look == "normal"
        defer { CastSkin.renderNormal = false }
        return body()
    }

    /// Runs a call site's share closure and returns the card image(s) it would have presented.
    static func collect(look: String, _ body: () -> Void) -> [UIImage] {
        buffer = []
        ShareCaptureState.active = true
        withLook(look, body)
        ShareCaptureState.active = false
        let out = buffer
        buffer = []
        return out
    }
}

// MARK: - Source

struct ShareSheetSource {
    var context: ShareSheetContext
    /// The game's name, for the saved file's name.
    var gameLabel: String
    /// `share_events` row: the game mode raw value and the surface.
    var logMode: String
    var logSurface: String
    /// Renders every card for (variant, look) on the main actor.
    var render: @MainActor (ShareVariant, String) -> [UIImage]

    /// A finished game: the call site's own `onShare(reveal)` is the renderer.
    @MainActor
    static func finished(dbKey: String, hasSpoilers: Bool, gameLabel: String, onShare: @escaping (Bool) -> Void) -> ShareSheetSource {
        let ctx = ShareSheetContext(surface: .finished, mode: ModeGen.byDbKey(dbKey)?.id ?? "", play: nil, cards: [.result],
                                    hasSpoilerVariant: hasSpoilers, season: CastSkin.season?.rawValue, caption: nil)
        return ShareSheetSource(context: ctx, gameLabel: gameLabel, logMode: dbKey, logSurface: "post_game") { variant, look in
            ShareCapture.collect(look: look) { onShare(variant == .full) }
        }
    }

    /// The leaderboard card.
    @MainActor
    static func leaderboard(_ input: LbShareInput) -> ShareSheetSource {
        let ctx = ShareSheetContext(surface: .leaderboard, mode: "", play: nil, cards: [.leaderboard], hasSpoilerVariant: false,
                                    season: CastSkin.season?.rawValue, caption: nil)
        return ShareSheetSource(context: ctx, gameLabel: input.shareMode, logMode: input.gameModeRaw, logSurface: "leaderboard") { _, look in
            ShareCapture.withLook(look) {
                let card = LeaderboardShareCardView(input: input)
                return ShareService.renderCard(card, size: card.size).map { [$0] } ?? []
            }
        }
    }
}

// MARK: - Present from UIKit (no SwiftUI sheet binding to hang on)

@MainActor
enum ShareSheetPresenter {
    static func present(_ source: ShareSheetSource) {
        guard let top = ShareChannels.topController() else { return }
        let host = UIHostingController(rootView: ShareSheetView(source: source))
        host.modalPresentationStyle = .pageSheet
        host.view.backgroundColor = UIColor(ShareNight.top)
        if let sheet = host.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
        top.present(host, animated: true)
    }
}

// MARK: - The chooser modifier (replaces the ShareVariantSheet entry points)

extension View {
    /// The "share" chooser every finished screen opens: the custom sheet when `share_sheet_v2` is live for this player, else the
    /// old two-button No spoilers / Full results sheet. `onShare(reveal)` is the call site's own share action.
    func shareChooser(isPresented: Binding<Bool>, dbKey: String = "", hasSpoilers: Bool = true, gameLabel: String = "",
                      onShare: @escaping (Bool) -> Void) -> some View {
        modifier(ShareChooserModifier(isPresented: isPresented, dbKey: dbKey, hasSpoilers: hasSpoilers, gameLabel: gameLabel, onShare: onShare))
    }
}

private struct ShareChooserModifier: ViewModifier {
    @Binding var isPresented: Bool
    let dbKey: String
    let hasSpoilers: Bool
    let gameLabel: String
    let onShare: (Bool) -> Void
    /// The legacy chooser's pick, consumed by the sheet's onDismiss (the old handshake).
    @State private var legacyReveal: Bool?

    func body(content: Content) -> some View {
        content.softSheet(isPresented: $isPresented, onDismiss: {
            if let r = legacyReveal { legacyReveal = nil; onShare(r) }
        }) {
            if ShareSheetFlag.on {
                ShareSheetView(source: .finished(dbKey: dbKey, hasSpoilers: hasSpoilers, gameLabel: gameLabel, onShare: onShare))
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            } else {
                ShareVariantSheet(selection: $legacyReveal).presentationDetents([.height(340)])
            }
        }
    }
}

// MARK: - Render store

@MainActor
final class ShareSheetStore: ObservableObject {
    struct Rendered { let full: [UIImage]; let preview: [UIImage] }

    @Published private(set) var variant: ShareVariant
    @Published private(set) var look: String
    /// nil until the first render lands; while a toggle re-renders it keeps the previous cards.
    @Published private(set) var rendered: Rendered?
    @Published private(set) var rendering = true

    private let source: ShareSheetSource
    private var cache: [String: Rendered] = [:]
    private var generation = 0

    init(source: ShareSheetSource, variant: ShareVariant, look: String) {
        self.source = source; self.variant = variant; self.look = look
    }

    func start() { refresh() }

    func set(variant: ShareVariant? = nil, look: String? = nil) {
        if let variant { self.variant = variant }
        if let look { self.look = look }
        refresh()
    }

    private func key(_ v: ShareVariant, _ l: String) -> String { "\(v.rawValue)|\(l)" }

    private func refresh() {
        generation += 1
        let gen = generation, v = variant, l = look, k = key(v, l)
        if let hit = cache[k] { rendered = hit; rendering = false; return }
        rendering = true
        Task { @MainActor in
            // Let the sheet (or the toggle) paint before the main-actor render blocks a frame or two.
            try? await Task.sleep(nanoseconds: 40_000_000)
            guard gen == generation else { return }
            let r = await renderNow(v, l)
            cache[k] = r
            guard gen == generation else { return }
            rendered = r; rendering = false
            prefetchOtherVariant()
        }
    }

    private func renderNow(_ v: ShareVariant, _ l: String) async -> Rendered {
        let full = source.render(v, l)
        // Downsample off the main thread: the carousel never decodes a 1080-px bitmap while it scrolls.
        let preview = await Self.previews(full)
        return Rendered(full: full, preview: preview)
    }

    private static func previews(_ images: [UIImage]) async -> [UIImage] {
        await withTaskGroup(of: (Int, UIImage).self) { group in
            for (i, img) in images.enumerated() {
                group.addTask {
                    let longest = max(img.size.width, img.size.height)
                    let scale = min(1, 1100 / max(longest, 1))
                    let target = CGSize(width: img.size.width * scale, height: img.size.height * scale)
                    return (i, await img.byPreparingThumbnail(ofSize: target) ?? img)
                }
            }
            var out = [(Int, UIImage)]()
            for await p in group { out.append(p) }
            return out.sorted { $0.0 < $1.0 }.map(\.1)
        }
    }

    /// The other side of the toggle renders once the sheet has settled, so flipping it is instant.
    private func prefetchOtherVariant() {
        guard source.context.hasSpoilerVariant else { return }
        let other: ShareVariant = variant == .clean ? .full : .clean
        let k = key(other, look), l = look, gen = generation
        guard cache[k] == nil else { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard gen == generation, cache[k] == nil else { return }
            cache[k] = await renderNow(other, l)
        }
    }
}

// MARK: - The sheet

struct ShareSheetView: View {
    let source: ShareSheetSource
    private let model: ShareSheetModel
    @StateObject private var store: ShareSheetStore
    @State private var page = 0
    @State private var toast: String?

    init(source: ShareSheetSource) {
        self.source = source
        let model = shareSheetModel(source.context, .ios)
        self.model = model
        _store = StateObject(wrappedValue: ShareSheetStore(source: source, variant: model.variant.initial, look: model.looks.initial))
    }

    var body: some View {
        ZStack {
            ShareSheetBackground()
            VStack(spacing: 0) {
                ShareCarousel(images: store.rendered?.preview ?? [], titles: model.cards.map(\.title),
                              detail: model.variant.shown ? (store.variant == .clean ? model.variant.copy.clean.subtitle : model.variant.copy.full.subtitle) : nil,
                              page: $page,
                              loading: store.rendered == nil, refreshing: store.rendering && store.rendered != nil)
                    .frame(maxHeight: .infinity)
                    .padding(.top, 22)
                if model.variant.shown {
                    ShareVariantPill(variant: Binding(get: { store.variant }, set: { store.set(variant: $0) }), copy: model.variant.copy)
                        .padding(.top, 12)
                }
                if model.looks.shown {
                    HStack(spacing: 22) {
                        ForEach(model.looks.options, id: \.id) { opt in
                            ShareLookSwatch(id: opt.id, label: opt.label, selected: store.look == opt.id) { store.set(look: opt.id) }
                        }
                    }
                    .padding(.top, 12)
                }
                ShareChannelsRow(channels: model.channels) { ch in tap(ch) }
                    .padding(.top, 14).padding(.bottom, 14)
            }
            .frame(maxWidth: 560)
            if let toast {
                ShareToast(text: toast).frame(maxHeight: .infinity, alignment: .top).padding(.top, 54)
                    .transition(.move(edge: .top).combined(with: .opacity)).allowsHitTesting(false)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { store.start() }
    }

    private var currentImage: UIImage? {
        guard let imgs = store.rendered?.full, !imgs.isEmpty else { return nil }
        return imgs[min(page, imgs.count - 1)]
    }

    private func show(_ text: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { toast = text }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        UIAccessibility.post(notification: .announcement, argument: text)
        let shown = text
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_700_000_000)
            if toast == shown { withAnimation(.easeOut(duration: 0.25)) { toast = nil } }
        }
    }

    private func tap(_ ch: ShareSheetChannel) {
        ShareChannels.logTap(ch, source: source)
        let image = currentImage
        switch ch.id {
        case .copy:
            UIPasteboard.general.string = ch.link ?? ch.text
            show("Copied")
        case .save:
            guard let image else { return }
            ShareChannels.saveToPhotos(image, game: source.gameLabel) { show($0) }
        case .messages:
            guard let image else { return }
            ShareChannels.messages(image, text: ch.text, game: source.gameLabel)
        case .whatsapp:
            guard let image else { return }
            ShareChannels.whatsApp(image, game: source.gameLabel)
        case .x, .facebook, .more, .stories, .snapchat, .tiktok:
            guard let image else { return }
            ShareChannels.systemSheet(image, text: ch.text, game: source.gameLabel)
        }
    }
}

// MARK: - Pieces

private struct ShareSheetBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [ShareNight.top, ShareNight.bottom], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [Color(hex: 0x7C3AED).opacity(0.28), .clear], center: .init(x: 0.5, y: 0.18), startRadius: 0, endRadius: 360)
        }
        .ignoresSafeArea()
    }
}

/// The card carousel: the centered card at full size, the neighbours smaller and dimmed so the next one peeks in.
private struct ShareCarousel: View {
    let images: [UIImage]
    let titles: [String]
    /// What the card shows right now ("Colors only" / "Letters revealed"), read after the title by VoiceOver.
    var detail: String? = nil
    @Binding var page: Int
    let loading: Bool
    let refreshing: Bool
    @State private var drag: CGFloat = 0
    private let gap: CGFloat = 14

    var body: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                let h = geo.size.height
                let maxW = geo.size.width * 0.72
                if loading || images.isEmpty {
                    ShareCardSkeleton().frame(width: min(maxW, h * 0.72), height: h).frame(maxWidth: .infinity)
                } else {
                    let widths = images.map { min(maxW, h * $0.size.width / max($0.size.height, 1)) }
                    let heights = zip(images, widths).map { $0.size.height / max($0.size.width, 1) * $1 }
                    let origin = (0..<images.count).map { i in widths.prefix(i).reduce(0, +) + CGFloat(i) * gap }
                    let center = geo.size.width / 2 - (origin[page] + widths[page] / 2)
                    HStack(spacing: gap) {
                        ForEach(images.indices, id: \.self) { i in
                            let on = i == page
                            Image(uiImage: images[i]).resizable().interpolation(.high)
                                .frame(width: widths[i], height: heights[i])
                                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                                .shadow(color: .black.opacity(on ? 0.5 : 0.25), radius: on ? 14 : 8, x: 0, y: on ? 8 : 4)
                                .scaleEffect(on ? 1 : 0.9)
                                .opacity(on ? 1 : 0.78)
                                .accessibilityLabel([titles.indices.contains(i) ? "\(titles[i]) card" : "Card", detail].compactMap { $0 }.joined(separator: ", "))
                                .accessibilityValue("\(i + 1) of \(images.count)")
                                .onTapGesture { if !on { go(i) } }
                        }
                    }
                    .frame(width: geo.size.width, height: h, alignment: .leading)
                    .offset(x: center + drag)
                    .opacity(refreshing ? 0.55 : 1)
                    .animation(.easeOut(duration: 0.15), value: refreshing)
                    .animation(.spring(response: 0.38, dampingFraction: 0.86), value: page)
                    .animation(.interactiveSpring(), value: drag)
                    .gesture(DragGesture(minimumDistance: 14)
                        .onChanged { drag = $0.translation.width }
                        .onEnded { v in
                            let predicted = v.predictedEndTranslation.width
                            var next = page
                            if predicted < -60 { next += 1 } else if predicted > 60 { next -= 1 }
                            drag = 0
                            go(max(0, min(images.count - 1, next)))
                        })
                }
            }
            if images.count > 1 {
                HStack(spacing: 6) {
                    ForEach(images.indices, id: \.self) { i in
                        Capsule().fill(i == page ? Color(hex: 0xFFC83D) : Color.white.opacity(0.25))
                            .frame(width: i == page ? 16 : 6, height: 6)
                    }
                }
                .animation(.easeOut(duration: 0.2), value: page)
                .accessibilityHidden(true)
            }
        }
    }

    private func go(_ i: Int) {
        guard i != page else { return }
        page = i
        UISelectionFeedbackGenerator().selectionChanged()
    }
}

/// While the first render runs: a card-shaped slab with a slow sheen (never a bare spinner).
private struct ShareCardSkeleton: View {
    @State private var sweep = false
    var body: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(LinearGradient(colors: [ShareNight.panel, ShareNight.panelDeep], startPoint: .top, endPoint: .bottom))
            .overlay {
                GeometryReader { g in
                    LinearGradient(colors: [.clear, Color.white.opacity(0.10), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: g.size.width * 0.6)
                        .offset(x: sweep ? g.size.width : -g.size.width * 0.6)
                }
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            .onAppear { withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { sweep = true } }
            .accessibilityLabel("Preparing your card")
    }
}

/// The slim "No spoilers | Full results" toggle: a quiet track and a glossy purple thumb that slides.
private struct ShareVariantPill: View {
    @Binding var variant: ShareVariant
    let copy: ShareVariantCopy
    @Namespace private var thumb

    var body: some View {
        HStack(spacing: 0) {
            seg(.clean, copy.clean.title, copy.clean.subtitle)
            seg(.full, copy.full.title, copy.full.subtitle)
        }
        .padding(4)
        .background(Capsule().fill(Color.white.opacity(0.08)))
        .frame(maxWidth: 320)
        .padding(.horizontal, 24)
    }

    private func seg(_ v: ShareVariant, _ title: String, _ sub: String) -> some View {
        let on = variant == v
        return Button {
            guard !on else { return }
            UISelectionFeedbackGenerator().selectionChanged()
            withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) { variant = v }
        } label: {
            Text(title)
                .font(Brand.font(15, .heavy))
                .foregroundStyle(on ? Color.white : ShareNight.muted)
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity).frame(height: 36)
                .background {
                    if on {
                        Capsule()
                            .fill(LinearGradient(colors: [Color(hex: 0xA66BFF), Color(hex: 0x7C3AED)], startPoint: .top, endPoint: .bottom))
                            .overlay(alignment: .top) {
                                Capsule().fill(LinearGradient(colors: [Color.white.opacity(0.38), .clear], startPoint: .top, endPoint: .bottom))
                                    .frame(height: 16).padding(.horizontal, 6).padding(.top, 2)
                            }
                            .shadow(color: Color(hex: 0x7C3AED).opacity(0.55), radius: 6, x: 0, y: 3)
                            .matchedGeometryEffect(id: "thumb", in: thumb)
                    }
                }
                .contentShape(Capsule())
                .padding(.vertical, 4)          // hit area 44 pt, the look stays 36
                .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .padding(.vertical, -4)
        .accessibilityLabel("\(title), \(sub)")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// A look swatch: W in that look (hero W for Normal, the costumed W for the season) on a round chip; the chosen one glows.
private struct ShareLookSwatch: View {
    let id: String
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                ZStack {
                    Circle().fill(LinearGradient(colors: id == "normal" ? [Color(hex: 0x4338CA), Color(hex: 0x1E1B4B)]
                                                                         : [Color(hex: 0xFB923C), Color(hex: 0x6D28D9)],
                                                 startPoint: .top, endPoint: .bottom))
                    glyph
                }
                .frame(width: 46, height: 46)
                .overlay {
                    if selected {
                        Circle().strokeBorder(AngularGradient(colors: [Color(hex: 0xFFC83D), Color(hex: 0xFF7AC8), Color(hex: 0xFFC83D)], center: .center), lineWidth: 3)
                            .padding(-4)
                    }
                }
                .shadow(color: selected ? Color(hex: 0xFFC83D).opacity(0.55) : .black.opacity(0.3), radius: selected ? 9 : 4, x: 0, y: selected ? 0 : 3)
                .scaleEffect(selected ? 1.04 : 1)
                Text(label).font(Brand.font(12, selected ? .heavy : .bold))
                    .foregroundStyle(selected ? ShareNight.text : ShareNight.muted)
            }
            .frame(minWidth: 66)
            .animation(.spring(response: 0.3, dampingFraction: 0.75), value: selected)
        }
        .buttonStyle(.squish)
        .accessibilityLabel("\(label) look")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    /// W in that look: the hero W for Normal, the season's costumed W (registry cast pattern) when it ships.
    private var glyph: some View {
        let skin = "art-\(id)-w"
        let name = id != "normal" && ArtAsset.exists(skin) ? skin : MascotID.w.assetName
        return ArtThumbs.image(name, points: 40).resizable().interpolation(.high).scaledToFit().frame(width: 40, height: 40)
    }
}

private struct ShareChannelsRow: View {
    let channels: [ShareSheetChannel]
    let action: (ShareSheetChannel) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CHANNELS").font(Brand.font(12, .heavy)).tracking(1.2).foregroundStyle(ShareNight.muted)
                .padding(.horizontal, 22)
            HStack(alignment: .top, spacing: 0) {
                ForEach(channels, id: \.id) { ch in
                    Button { action(ch) } label: {
                        VStack(spacing: 6) {
                            ShareChannelIcon(id: ch.id, size: 46)
                            Text(ch.label).font(Brand.font(11, .bold)).foregroundStyle(ShareNight.text)
                                .lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.squishIcon)
                    .accessibilityLabel(ch.label)
                }
            }
            .padding(.horizontal, 10)
        }
    }
}

/// A channel's round candy icon: a glossy gradient disc with a simple glyph (SF Symbols; no third-party logo art).
struct ShareChannelIcon: View {
    let id: ShareChannelId
    var size: CGFloat = 46

    private var colors: (Color, Color) {
        switch id {
        case .copy: return (Color(hex: 0xA66BFF), Color(hex: 0x6D28D9))
        case .messages: return (Color(hex: 0x4ADE80), Color(hex: 0x16A34A))
        case .whatsapp: return (Color(hex: 0x34E07F), Color(hex: 0x12934B))
        case .x: return (Color(hex: 0x4B4B57), Color(hex: 0x0E0E14))
        case .facebook: return (Color(hex: 0x5B9BFF), Color(hex: 0x1D4ED8))
        case .save: return (Color(hex: 0x2DD4BF), Color(hex: 0x0F766E))
        case .more: return (Color(hex: 0x8B5CF6), Color(hex: 0x5B21B6))
        case .stories: return (Color(hex: 0xF472B6), Color(hex: 0xF97316))
        case .snapchat: return (Color(hex: 0xFFE14D), Color(hex: 0xF5B800))
        case .tiktok: return (Color(hex: 0x3F3F46), Color(hex: 0x111114))
        }
    }

    private var symbol: String {
        switch id {
        case .copy: return "link"
        case .messages: return "message.fill"
        case .whatsapp: return "phone.fill"
        case .x: return "xmark"
        case .facebook: return "hand.thumbsup.fill"
        case .save: return "arrow.down.to.line"
        case .more: return "ellipsis"
        case .stories: return "plus.circle"
        case .snapchat: return "star.fill"
        case .tiktok: return "music.note"
        }
    }

    var body: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [colors.0, colors.1], startPoint: .top, endPoint: .bottom))
            Image(systemName: symbol)
                .font(.system(size: size * (id == .more ? 0.42 : 0.4), weight: .heavy))
                .foregroundStyle(id == .snapchat ? Color.white : Color.white)
                .shadow(color: .black.opacity(0.18), radius: 1, x: 0, y: 1)
        }
        .overlay(alignment: .top) {
            Ellipse().fill(LinearGradient(colors: [Color.white.opacity(0.40), .clear], startPoint: .top, endPoint: .bottom))
                .frame(width: size * 0.74, height: size * 0.36).padding(.top, size * 0.05)
        }
        .frame(width: size, height: size)
        .shadow(color: colors.1.opacity(0.55), radius: 5, x: 0, y: 3)
    }
}

private struct ShareToast: View {
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color(hex: 0x4ADE80))
            Text(text).font(Brand.font(14, .heavy)).foregroundStyle(ShareNight.text)
        }
        .padding(.horizontal, 16).padding(.vertical, 9)
        .background(Capsule().fill(ShareNight.panel).shadow(color: .black.opacity(0.4), radius: 8, x: 0, y: 4))
        .accessibilityElement(children: .combine)
    }
}
#endif
