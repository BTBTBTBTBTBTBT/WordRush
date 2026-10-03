import SwiftUI
import UIKit

// FINISH_SPEC §AQ2 (menus + scrolling smoothness) and §AS3 (the tab pages' tail).
//
// - `ArtThumbs`: art drawn at its display size. A 256–1200 px asset shown in a
//   20–64 pt slot is downsampled ONCE to the slot's pixel size and cached, so the
//   GPU never scales a big bitmap every frame of a scroll (and the full decode is
//   dropped right after).
// - `ScrollMotion`: idle loops (bobbing cast, title float, waves) pause while any
//   tab page is scrolling, and — iOS 18+ — while their view is scrolled off screen.
// - `.tabScrollTail()`: every tab page's scroll content ends clear of the docked
//   footer (its measured height + 16 pt).

// MARK: - Downsampled art

enum ArtThumbs {
    private static let lock = NSLock()
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 300
        return c
    }()
    /// Asset name → its longest side in pixels (0 = missing).
    private static var sourcePixels: [String: CGFloat] = [:]
    /// Names known to need no downsampling at a pixel bucket.
    private static var passthrough: Set<String> = []

    private static var screenScale: CGFloat {
        let s = UITraitCollection.current.displayScale
        return s > 0 ? s : 3
    }

    /// The pixel target for `points` (rounded up to 16 px so near sizes share one bitmap).
    static func bucket(points: CGFloat, scale: CGFloat) -> Int {
        let px = max(16, points * scale)
        return Int((px / 16).rounded(.up)) * 16
    }

    /// A downsampled copy of asset `name` whose longest side fits `points`, or nil
    /// when the asset is already about that size (draw it as is) or doesn't ship.
    static func uiImage(_ name: String, points: CGFloat, scale: CGFloat? = nil) -> UIImage? {
        guard points > 0 else { return nil }
        let target = bucket(points: points, scale: scale ?? screenScale)
        let key = "\(name)|\(target)"
        lock.lock()
        if let hit = cache.object(forKey: key as NSString) { lock.unlock(); return hit }
        if passthrough.contains(key) { lock.unlock(); return nil }
        let known = sourcePixels[name]
        lock.unlock()

        var src: UIImage?
        let longest: CGFloat
        if let known {
            longest = known
        } else {
            src = UIImage(named: name)
            longest = src.map { max($0.size.width, $0.size.height) * $0.scale } ?? 0
            lock.lock(); sourcePixels[name] = longest; lock.unlock()
        }
        // Only worth it when the source is clearly bigger than the slot.
        guard longest > CGFloat(target) * 1.4 else {
            lock.lock(); passthrough.insert(key); lock.unlock()
            return nil
        }
        guard let full = src ?? UIImage(named: name) else { return nil }
        let k = CGFloat(target) / longest
        let size = CGSize(width: max(1, (full.size.width * full.scale * k).rounded()),
                          height: max(1, (full.size.height * full.scale * k).rounded()))
        guard let thumb = full.preparingThumbnail(of: size) else { return nil }
        lock.lock(); cache.setObject(thumb, forKey: key as NSString); lock.unlock()
        return thumb
    }

    /// FINISH_SPEC BJ2: decode `items` (asset, display points) into the cache on a
    /// utility thread, so the first frame that shows them never decodes on main.
    /// Call on the main thread (it reads the screen scale there).
    static func prewarm(_ items: [(String, CGFloat)]) {
        let scale = screenScale
        DispatchQueue.global(qos: .utility).async {
            for (name, points) in items { _ = uiImage(name, points: points, scale: scale) }
        }
    }

    /// The SwiftUI image for asset `name` shown with its longest side ≈ `points`.
    static func image(_ name: String, points: CGFloat) -> Image {
        if let ui = uiImage(name, points: points) { return Image(uiImage: ui) }
        return Image(name)
    }
}

// MARK: - Idle motion while scrolling

/// Whether a tab page is scrolling right now (iOS 18+; always false before).
@MainActor
final class ScrollMotion: ObservableObject {
    static let shared = ScrollMotion()
    @Published private(set) var scrolling = false
    private init() {}

    func set(_ on: Bool) {
        if scrolling != on { scrolling = on }
    }
}

private struct ReportsScrolling: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollPhaseChange { _, phase in
                ScrollMotion.shared.set(phase.isScrolling)
            }
        } else {
            content
        }
    }
}

private struct TracksScrollVisibility: ViewModifier {
    @Binding var visible: Bool
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollVisibilityChange(threshold: 0.01) { visible = $0 }
        } else {
            content
        }
    }
}

extension View {
    /// §AQ2: on a page's ScrollView — idle loops pause while it scrolls.
    func reportsScrollMotion() -> some View { modifier(ReportsScrolling()) }

    /// §AQ2: keeps `visible` in step with whether this view is on screen inside a
    /// scroll view (iOS 18+; stays true elsewhere).
    func tracksScrollVisibility(_ visible: Binding<Bool>) -> some View {
        modifier(TracksScrollVisibility(visible: visible))
    }
}

// MARK: - §AS3 tab page tail

private struct TabScrollTail: ViewModifier {
    @ObservedObject private var chrome = ChromeVisibility.shared
    let extra: CGFloat
    func body(content: Content) -> some View {
        content.padding(.bottom, extra + chrome.bottomInset)
    }
}

extension View {
    /// §AS3: the end of a tab page's scroll content — the docked footer's height
    /// plus `extra` (16 pt), so the footer never covers the last row.
    func tabScrollTail(_ extra: CGFloat = 16) -> some View { modifier(TabScrollTail(extra: extra)) }
}
