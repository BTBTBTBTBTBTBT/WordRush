import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

// The living mascot (docs/cloud-prompts/06; WordociousCore AvatarPose, parity with web use-living-mascot.ts +
// Android). Behind AvatarLiveConfig.livingMascot (OFF): while it is off no surface creates this view and every mascot
// renders exactly as before.
//
// The player's own mascot breathes, blinks, holds its saved pose, hops + laughs on a tap (the cast giggle pitched per
// body), squishes while pressed, follows the finger with its eyes (the Edit Profile Stage) and reacts to moments
// (MascotMoment.post: win = cheer, loss = shrug, streak +1 = hop, level up = cheer).
//
// Performance (founder: smooth over pretty): laid out ONCE with the live layout (the saved pose + room for every
// reaction, so it never rescales); each frame only recomputes a handful of part matrices (AvatarFit.liveTransforms)
// and redraws one Canvas from pre-decoded art. TimelineView(.animation) runs only while on screen, only for the few
// mascots holding an animation slot (AvatarLiveConfig.maxAnimated, the player's own first), never in lists. Reduce
// Motion = the still frame (a tap only shows the laugh).

/// The animation budget: at most AvatarLiveConfig.maxAnimated living mascots tick at once; the player's own always do.
@MainActor
enum LivingMascotBudget {
    private static var running: Set<UUID> = []

    static func claim(_ id: UUID, own: Bool) -> Bool {
        if running.contains(id) { return true }
        guard own || running.count < AvatarLiveConfig.maxAnimated else { return false }
        running.insert(id)
        return true
    }

    static func release(_ id: UUID) { running.remove(id) }
}

struct LivingMascotView: View {
    let config: AvatarConfig
    let initial: String
    var size: CGFloat
    /// A free-standing figure (the Stage, the Home host) instead of the framed tile (the Stats card).
    var cutout: Bool = false
    /// The eyes follow the finger while it is on the mascot (the Edit Profile Stage).
    var follow: Bool = false
    /// Taps hop + laugh, a press squishes. false where the mascot sits inside a button (the Stats card) or lets taps
    /// through (the Home host).
    var interactive: Bool = true
    /// The player's own mascot: it reacts to moments and always gets an animation slot.
    var own: Bool = true
    /// Bump to hop from outside (the Dressing Room's part changes).
    var hopToken: Int = 0
    var stroke: Bool = true
    /// 2.8 item 40: what VoiceOver says; nil = "Your mascot" for your own, "Mascot" for anyone else's.
    var label: String? = nil

    /// Whether this config can come alive: the flag, the fit manifest, the pose data and the body's rig art.
    static func canAnimate(_ c: AvatarConfig) -> Bool {
        guard AvatarLiveConfig.livingMascot, MascotParts.fit != nil, let poses = AvatarPosesData.bundled,
              poses.rigs[c.body] != nil, MascotParts.art("body", c.body) != nil else { return false }
        return AvatarPose.rigParts.allSatisfy { ArtAsset.exists("art-av-body-\(c.body)-\($0)") }
    }

    private struct Reaction: Equatable { let kind: AvatarReaction; let at: Date }

    @Environment(\.accessibilityReduceMotion) private var envReduce
    @State private var start = Date()
    @State private var tapAt: Date?
    @State private var reaction: Reaction?
    @State private var pressing = false
    @State private var pressFrom: Double = 0
    @State private var pressChanged = Date.distantPast
    @State private var look: CGPoint = .zero
    @State private var visible = false
    @State private var slot = false
    @State private var slotId = UUID()

    var body: some View {
        let still = Motion.calm(envReduce)
        // the live layout, once per config + size (not per frame)
        let shown: AvatarConfig = {
            var c = config
            if cutout { c.frame = "none" }
            return c
        }()
        let small = size <= MascotParts.smallSize
        let layout: AvatarLayout? = MascotParts.fit.map { AvatarFit.liveLayout(shown, small: small, manifest: $0) }
        TimelineView(.animation(minimumInterval: nil, paused: paused(still))) { tl in
            drawFrame(at: tl.date, config: shown, layout: layout, still: still, small: small)
        }
        .frame(width: size, height: size)
        .contentShape(Rectangle())
        .simultaneousGesture(press, including: interactive ? .all : .none)
        .onAppear {
            visible = true
            slot = LivingMascotBudget.claim(slotId, own: own)
            #if canImport(UIKit)
            MascotArtCache.warm(shown)
            if let layout { DispatchQueue.global(qos: .userInitiated).async { for l in layout.layers { _ = MascotArtCache.uiImage(l.art) } } }
            #endif
        }
        .onDisappear {
            visible = false
            LivingMascotBudget.release(slotId)
            slot = false
        }
        .onReceive(NotificationCenter.default.publisher(for: .mascotMoment)) { note in
            guard own, !still, let raw = note.userInfo?["kind"] as? String, let kind = AvatarReaction(rawValue: raw) else { return }
            let r = Reaction(kind: kind, at: Date())
            reaction = r
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { if reaction == r { reaction = nil } }
        }
        .onChange(of: hopToken) { _ in hop(sound: false) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? (own ? "Your mascot" : "Mascot"))
        .accessibilityAddTraits(interactive ? .isButton : [])
        .accessibilityHint(interactive ? "Makes your mascot hop" : "")
        .accessibilityAction { if interactive { hop(sound: true) } }
    }

    /// Frames tick only while on screen; Reduce Motion only while a tap's laugh plays; otherwise only with a slot.
    private func paused(_ still: Bool) -> Bool {
        guard visible else { return true }
        if still { return tapAt == nil }
        return !slot
    }

    @ViewBuilder
    private func drawFrame(at date: Date, config c: AvatarConfig, layout: AvatarLayout?, still: Bool, small: Bool) -> some View {
        let live = transforms(at: date, layout: layout, still: still)
        if let fit = MascotParts.fit, let layout {
            if cutout {
                Canvas { ctx, _ in
                    MascotArtPainter.paint(ctx, side: size, layout: layout, config: c, initial: initial, small: small, live: live)
                }
                .frame(width: size, height: size)
            } else {
                MascotArtComposition(config: c, initial: initial, size: size, dark: Theme.isDark, fit: fit, stroke: stroke,
                                     layoutOverride: layout, live: live)
            }
        } else if cutout {
            MascotCutout(config: c, initial: initial, size: size)
        } else {
            MascotAvatar(config: c, initial: initial, size: size, cached: false, stroke: stroke)
        }
    }

    private func transforms(at date: Date, layout: AvatarLayout?, still: Bool) -> [String: AvatarMatrix]? {
        guard let layout, let poses = AvatarPosesData.bundled else { return nil }
        let seed = Double((config.body.count * 977 + config.color.count * 131) % 233280)
        let rx: (kind: AvatarReaction, t: Double)? = reaction.map { (kind: $0.kind, t: date.timeIntervalSince($0.at)) }
        let input = AvatarLiveInput(pose: config.pose, t: date.timeIntervalSince(start), tap: tapAt.map { date.timeIntervalSince($0) },
                                    reaction: rx, press: pressAmount(date), still: still, ambient: true, blinkSeed: seed)
        let f = AvatarPose.liveFrame(input, data: poses)
        let tf = AvatarFit.liveTransforms(layout, body: config.body, frame: f, look: (Double(look.x), Double(look.y)), poses: poses)
        return tf.isEmpty ? nil : tf
    }

    /// Press-and-hold squish 0 → 1, eased like the web's per-frame `press += (target − press) · 0.25` (τ ≈ 60 ms).
    private func pressAmount(_ now: Date) -> Double {
        let k = exp(-max(0, now.timeIntervalSince(pressChanged)) / 0.06)
        return pressing ? 1 - (1 - pressFrom) * k : pressFrom * k
    }

    private var press: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { v in
                if !pressing {
                    let now = Date()
                    pressFrom = pressAmount(now); pressChanged = now
                    pressing = true
                }
                if follow {
                    let x = (v.location.x - size / 2) / (size * 1.5)
                    let y = (v.location.y - size * 0.4) / (size * 1.5)
                    look = CGPoint(x: max(-1, min(1, x)), y: max(-1, min(1, y)))
                }
            }
            .onEnded { _ in
                let now = Date()
                pressFrom = pressAmount(now); pressChanged = now
                pressing = false
                look = .zero
                hop(sound: true)
            }
    }

    /// Tap = hop + laugh (Reduce Motion: only the laugh). `sound`: the cast giggle pitched for this body + a haptic.
    private func hop(sound: Bool) {
        let at = Date()
        tapAt = at
        if sound {
            SoundManager.shared.mascotLaugh(body: config.body)
            Haptics.tap()
        }
        // let the timeline pause again once the laugh is over (Reduce Motion ticks only while it plays)
        DispatchQueue.main.asyncAfter(deadline: .now() + AvatarPose.tapDur + 0.1) { if tapAt == at { tapAt = nil } }
    }
}

/// A pose thumbnail for the Dressing Room's Pose tab: the player's mascot in `pose` (a static posed layout), cut out.
struct MascotPoseThumb: View {
    let config: AvatarConfig
    let pose: String
    let initial: String
    var size: CGFloat = 56

    var body: some View {
        var c = config
        c.frame = "none"
        c.pose = pose
        let small = size <= MascotParts.smallSize
        return Group {
            if let fit = MascotParts.fit, LivingMascotView.canAnimate(c) {
                let layout = AvatarFit.layout(c, small: small, pose: .id(pose), manifest: fit)
                Canvas { ctx, _ in
                    MascotArtPainter.paint(ctx, side: size, layout: layout, config: c, initial: initial, small: small)
                }
            } else {
                MascotCutout(config: c, initial: initial, size: size)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
