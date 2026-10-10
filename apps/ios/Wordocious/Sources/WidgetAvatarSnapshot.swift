import SwiftUI
import Combine
import WidgetKit
import WordociousCore

/// FINISH_SPEC BI13c (founder 10-03: "put the player's own mascot … on the widgets"): the
/// widget can't compose avatars, so the app renders the player's look ONCE into the app-group
/// container and the widget only draws that PNG:
///   • a custom mascot (saved avatar_config / worn cast hero) → a full-body CUTOUT (the Home
///     host's MascotCutout: no backdrop, tile or frame) → `widget-avatar-mascot.png`;
///   • an uploaded photo → the photo whole in its tier frame (the Home host's portrait,
///     never on a body) → `widget-avatar-photo.png`;
///   • guests / no custom look → neither file (the widget keeps W).
/// Re-rendered on launch and whenever the own look changes; the timelines reload only when
/// the bytes actually change (the widget's reload budget).
@MainActor
enum WidgetAvatarSnapshot {
    private static var subs: Set<AnyCancellable> = []
    private static var pending: Task<Void, Never>?

    static func start() {
        guard subs.isEmpty else { return }
        let changed = Publishers.Merge3(
            AvatarDirectory.shared.$ownVersion.map { _ in () },
            MascotLooks.shared.objectWillChange.map { _ in () },
            CastAvatars.shared.objectWillChange.map { _ in () })
        changed
            .debounce(for: .milliseconds(800), scheduler: DispatchQueue.main)
            .sink { _ in schedule() }
            .store(in: &subs)
        schedule()
    }

    private static func schedule() {
        pending?.cancel()
        pending = Task { @MainActor in await refresh() }
    }

    private static func url(_ name: String) -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetBridge.appGroup)?
            .appendingPathComponent(name)
    }

    /// Renders (or clears) the snapshot for the current own look.
    static func refresh() async {
        // Founder 10-05: not while the own look is still loading (the Home host shows the cache then).
        guard AvatarDirectory.shared.ownHostIsLive else { return }
        let side = CGFloat(WidgetAvatar.side) / 2   // drawn at 2× → 256 px
        var png: Data?
        var file: String?
        switch AvatarDirectory.shared.ownHostChoice() {
        case .w:
            break
        case .mascot(let config):
            let initial = AvatarCatalog.initial(AuthService.shared.profile?.username)
            let view = MascotCutout(config: config, initial: initial, size: side)
            png = render(view, side: side)
            file = WidgetAvatar.mascotFile
            // Founder 10-10: one still per pose, so the widget's mascot changes pose through the day.
            if LivingMascotView.canAnimate(config) {
                for pose in WidgetAvatar.poses {
                    guard !Task.isCancelled, let u = url(WidgetAvatar.poseFile(pose)) else { continue }
                    var c = config; c.pose = pose
                    let posed = LivingMascotView(config: c, initial: initial, size: side, cutout: true, interactive: false, own: false)
                    if let data = render(posed, side: side), (try? Data(contentsOf: u)) != data {
                        try? data.write(to: u, options: .atomic)
                    }
                }
            }
        case .photo:
            guard let p = AuthService.shared.profile, let s = p.avatarUrl, let u = URL(string: s) else { break }
            // Load first: AvatarView paints a cached photo on its first frame (else its mascot stand-in).
            guard await AvatarImageCache.load(u) != nil, !Task.isCancelled else { return }
            let view = AvatarView(url: p.avatarUrl, username: p.username, size: side * 0.92, userId: p.id)
                .frame(width: side, height: side)
            png = render(view, side: side)
            file = WidgetAvatar.photoFile
        }
        guard !Task.isCancelled else { return }
        var changed = false
        for name in [WidgetAvatar.mascotFile, WidgetAvatar.photoFile] {
            guard let u = url(name) else { continue }
            if name == file, let png {
                if (try? Data(contentsOf: u)) != png {
                    try? png.write(to: u, options: .atomic)
                    changed = true
                }
            } else if FileManager.default.fileExists(atPath: u.path) {
                try? FileManager.default.removeItem(at: u)
                changed = true
            }
        }
        // Not a mascot any more: the pose stills go too.
        if file != WidgetAvatar.mascotFile {
            for pose in WidgetAvatar.poses {
                if let u = url(WidgetAvatar.poseFile(pose)), FileManager.default.fileExists(atPath: u.path) {
                    try? FileManager.default.removeItem(at: u)
                    changed = true
                }
            }
        }
        if changed { WidgetCenter.shared.reloadAllTimelines() }
    }

    private static func render<V: View>(_ view: V, side: CGFloat) -> Data? {
        let r = ImageRenderer(content: view.frame(width: side, height: side).environment(\.colorScheme, .light))
        r.scale = 2
        r.isOpaque = false
        return r.uiImage?.pngData()
    }
}
