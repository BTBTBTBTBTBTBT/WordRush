import SwiftUI
import UIKit

// Founder 10-10 (smoothness, profiled): SwiftUI `.repeatForever` loops are interpolated on the MAIN thread every frame
// (the idle trio + sparkles kept Home's view graph updating at 60 fps while nothing happened). These loops are real Core
// Animation instead: added once to a layer, run by the render server at the display's rate (120 Hz on ProMotion), zero
// main-thread work per frame. Re-added whenever the view returns to a window (CA drops them when it leaves).

/// One looping image: a hop with a stretch / squash and a slower sway, both anchored at the image's bottom center; or a
/// twinkle (opacity + scale pulse). `still` = the image at rest.
struct CALoopImage: UIViewRepresentable {
    enum Motion: Equatable {
        /// `hop` as a fraction of the height; `stretch` / `squash` the scale at the top / on landing; `sway` degrees.
        case hop(hop: CGFloat, stretch: CGSize, squash: CGSize, sway: Double, tempo: Double, swayTempo: Double)
        /// Opacity `low`...1 and scale `small`...`big`.
        case twinkle(low: Float, small: CGFloat, big: CGFloat, tempo: Double)
        /// A slow side-to-side drift of +/- `dx` points (the Leaderboard's cloud bank).
        case drift(dx: CGFloat, tempo: Double)
    }

    let image: UIImage?
    let motion: Motion
    var delay: Double = 0
    var still: Bool = false

    func makeUIView(context: Context) -> LoopView { LoopView() }

    func updateUIView(_ v: LoopView, context: Context) {
        let changed = v.image !== image || v.motion != motion || v.delay != delay || v.still != still
        v.image = image; v.motion = motion; v.delay = delay; v.still = still
        if changed { v.restart() }
    }

    final class LoopView: UIView {
        let imageView = UIImageView()
        var image: UIImage? { didSet { imageView.image = image } }
        var motion: Motion = .twinkle(low: 1, small: 1, big: 1, tempo: 1)
        var delay: Double = 0
        var still = false

        override init(frame: CGRect) {
            super.init(frame: frame)
            isUserInteractionEnabled = false
            backgroundColor = .clear
            imageView.contentMode = .scaleAspectFit
            imageView.layer.anchorPoint = CGPoint(x: 0.5, y: 1)
            addSubview(imageView)
        }
        required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

        private var laidOut: CGSize = .zero

        override func layoutSubviews() {
            super.layoutSubviews()
            // anchored at the bottom center: bounds-sized, positioned at the bottom middle
            imageView.bounds = CGRect(origin: .zero, size: bounds.size)
            imageView.layer.position = CGPoint(x: bounds.midX, y: bounds.maxY)
            // the hop is in points (a fraction of the height): restart once the real size is known
            if bounds.size != laidOut { laidOut = bounds.size; restart() }
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil { restart() }
        }

        func restart() {
            let layer = imageView.layer
            layer.removeAllAnimations()
            guard window != nil, !still else { return }
            let begin = CACurrentMediaTime() + delay
            func loop(_ key: String, _ from: Any, _ to: Any, _ dur: Double) {
                let a = CABasicAnimation(keyPath: key)
                a.fromValue = from; a.toValue = to
                a.duration = dur; a.autoreverses = true; a.repeatCount = .infinity
                a.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                a.beginTime = begin
                a.fillMode = .both
                a.isRemovedOnCompletion = false
                layer.add(a, forKey: key)
            }
            switch motion {
            case let .hop(hop, stretch, squash, sway, tempo, swayTempo):
                let h = bounds.height
                loop("transform.translation.y", 0, -hop * h, tempo)
                loop("transform.scale.x", squash.width, stretch.width, tempo)
                loop("transform.scale.y", squash.height, stretch.height, tempo)
                let r = sway * .pi / 180
                if r != 0 { loop("transform.rotation.z", -r, r, swayTempo) }
            case let .twinkle(low, small, big, tempo):
                loop("opacity", low, 1, tempo)
                loop("transform.scale", small, big, tempo)
            case let .drift(dx, tempo):
                loop("transform.translation.x", -dx, dx, tempo)
            }
        }
    }
}

@MainActor
enum CALoopArt {
    private static var cache: [String: UIImage] = [:]

    /// A named catalog image (cached).
    static func image(_ name: String) -> UIImage? {
        if let hit = cache[name] { return hit }
        let img = UIImage(named: name)
        cache[name] = img
        return img
    }

    /// A small SwiftUI shape rendered once to a bitmap (the gold sparkle).
    static func render<V: View>(_ key: String, _ view: V) -> UIImage? {
        if let hit = cache[key] { return hit }
        let r = ImageRenderer(content: view)
        r.scale = UIScreen.main.scale
        let img = r.uiImage
        cache[key] = img
        return img
    }
}
