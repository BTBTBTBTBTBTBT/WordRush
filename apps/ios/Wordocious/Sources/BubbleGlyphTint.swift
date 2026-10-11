import SwiftUI
import UIKit
import WordociousCore

// 2.8 item 6: the bubble-letter glyph tinter. The asset-catalog glyphs are TINT MAPS, not colored art
// (scripts/build-bubble-atlas.py): R = tint multiplier, G = additive white (highlights), B = rim shade.
// One rule, identical on web and Android:  out = clamp(tint(y) * A + Wh + rimColor * Rm).
// Each tinted glyph is built once per (stem, size, tint) and cached, so a headline costs a few images.

enum BubbleGlyphTint {
    // Founder 10-10 (smoothness): 2.8 draws ~177 lettering sites at many sizes and tints, so a 200-image COUNT
    // limit evicted glyphs between screens and re-tinted them pixel by pixel on the main thread on every visit.
    // The cache is bounded by BYTES instead (a glyph costs w*h*4): 48 MB keeps every screen's letters resident.
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.totalCostLimit = 48 * 1024 * 1024
        return c
    }()

    private static func rgb(_ c: Color) -> (Float, Float, Float) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(c).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (Float(r), Float(g), Float(b))
    }

    /// The tinted glyph for `stem`, drawn for a `width` x `height` pt box. `f0` / `f1` = the tint gradient position
    /// (0 at the cap line, 1 at the baseline) at the glyph's top and bottom edge, so a whole word shares ONE gradient.
    static func glyph(stem: String, width: CGFloat, height: CGFloat, f0: Double, f1: Double, top: Color, bottom: Color) -> UIImage? {
        let req = Request(stem: stem, w: width, h: height, f0: f0, f1: f1, t0: rgb(top), t1: rgb(bottom), scale: UIScreen.main.scale)
        guard let (img, key) = tint(req) else { return nil }
        GlyphManifest.record(key: key as String, req)
        return img
    }

    // MARK: - The tint itself (thread-safe: NSCache, UIImage(named:) and CGContext all are)

    /// One glyph request, in plain values (so a background queue can replay it).
    struct Request {
        var stem: String
        var w: CGFloat, h: CGFloat
        var f0: Double, f1: Double
        var t0: (Float, Float, Float), t1: (Float, Float, Float)
        var scale: CGFloat
    }

    /// Source-image loads are serialized per stem name by UIImage(named:)'s own cache; the lookup is thread-safe.
    static func tint(_ q: Request) -> (UIImage, NSString)? {
        guard let m = BubbleAtlasMetrics.glyphs[q.stem] else { return nil }
        // Never more pixels than the source art has (cap capPx).
        let w = max(1, Int(min(q.w * q.scale, CGFloat(m.w * Double(BubbleAtlasMetrics.capPx))).rounded()))
        let h = max(1, Int(min(q.h * q.scale, CGFloat(m.h * Double(BubbleAtlasMetrics.capPx))).rounded()))
        let (t0, t1, f0, f1) = (q.t0, q.t1, q.f0, q.f1)
        let key = "\(q.stem)|\(w)x\(h)|\(Int(f0 * 1000))|\(Int(f1 * 1000))|\(t0)|\(t1)" as NSString
        if let hit = cache.object(forKey: key) { return (hit, key) }
        guard let src = UIImage(named: "bubble-\(q.stem)")?.cgImage else { return nil }

        var bytes = [UInt8](repeating: 0, count: w * h * 4)
        let out: CGImage? = bytes.withUnsafeMutableBytes { buf -> CGImage? in
            guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
            ctx.interpolationQuality = .high
            ctx.draw(src, in: CGRect(x: 0, y: 0, width: w, height: h))
            let data = buf.bindMemory(to: UInt8.self)

            let kA = Float(BubbleAtlasMetrics.kA), kW = Float(BubbleAtlasMetrics.kW), kR = Float(BubbleAtlasMetrics.kR)
            let rimHex = BubbleAtlasMetrics.rimHex
            let rim: (Float, Float, Float) = (Float((rimHex >> 16) & 255) / 255, Float((rimHex >> 8) & 255) / 255, Float(rimHex & 255) / 255)
            for y in 0..<h {
                let f = Float(min(1, max(0, f0 + (f1 - f0) * (Double(y) + 0.5) / Double(h))))
                let tr = t0.0 + (t1.0 - t0.0) * f, tg = t0.1 + (t1.1 - t0.1) * f, tb = t0.2 + (t1.2 - t0.2) * f
                for x in 0..<w {
                    let i = (y * w + x) * 4
                    let a = data[i + 3]
                    if a == 0 { continue }
                    let af = Float(a) / 255
                    // un-premultiply the encoded maps
                    let A = min(1, Float(data[i]) / 255 / af) * kA
                    let Wh = min(1, Float(data[i + 1]) / 255 / af) * kW
                    let R = min(1, Float(data[i + 2]) / 255 / af) * kR
                    let r = min(1, max(0, tr * A + Wh + rim.0 * R))
                    let g = min(1, max(0, tg * A + Wh + rim.1 * R))
                    let b = min(1, max(0, tb * A + Wh + rim.2 * R))
                    // store premultiplied again
                    data[i] = UInt8((r * af * 255).rounded())
                    data[i + 1] = UInt8((g * af * 255).rounded())
                    data[i + 2] = UInt8((b * af * 255).rounded())
                }
            }
            return ctx.makeImage()
        }
        guard let out else { return nil }
        let img = UIImage(cgImage: out, scale: q.scale, orientation: .up)
        cache.setObject(img, forKey: key, cost: w * h * 4)
        return (img, key)
    }
}

/// Founder 10-10 (smoothness): the glyphs a session actually drew are written to a small manifest (Caches), and the next
/// launch re-tints them on a background queue once the intro has landed, so a tab's first visit (and a Leaderboard game
/// switch to a board with new names) finds its lettering already built instead of tinting it pixel by pixel on the main
/// thread. Exactly the keys the views asked for (no layout guessing, so it covers every screen), capped, replayed gently.
/// The manifest is this session's glyphs first, then the last manifest's leftovers, so it never grows past `cap`.
enum GlyphManifest {
    private struct Entry: Codable { var k: String; var s: String; var v: [Double] }

    private static let lock = NSLock()
    private static var session: [Entry] = []
    private static var seen: Set<String> = []
    private static var previous: [Entry] = []
    private static var writeScheduled = false
    private static let cap = 2500
    // Founder 10-10 gate (guest Home idle 55 → 451 ms/s): replaying the whole capped manifest (up to 2,500 tints) at .utility
    // kept a core busy for seconds after launch and the main thread waited on it. Background QoS, the 300 most recent only,
    // small batches with real breathers.
    private static let queue = DispatchQueue(label: "com.wordocious.glyph-manifest", qos: .background)
    private static let warmLimit = 300

    private static var fileURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("bubble-glyph-manifest.json")
    }

    /// One lock + one set lookup per drawn glyph; an unseen key is stored and a write is queued 8 s later.
    static func record(key: String, _ q: BubbleGlyphTint.Request) {
        lock.lock()
        defer { lock.unlock() }
        guard session.count < cap, seen.insert(key).inserted else { return }
        session.append(Entry(k: key, s: q.stem, v: [Double(q.w), Double(q.h), q.f0, q.f1, Double(q.t0.0), Double(q.t0.1), Double(q.t0.2),
                                                   Double(q.t1.0), Double(q.t1.1), Double(q.t1.2), Double(q.scale)]))
        if !writeScheduled {
            writeScheduled = true
            queue.asyncAfter(deadline: .now() + 8) { write() }
        }
    }

    private static func write() {
        lock.lock()
        writeScheduled = false
        var out = session
        for e in previous where out.count < cap && !seen.contains(e.k) { out.append(e) }
        lock.unlock()
        guard let url = fileURL, let data = try? JSONEncoder().encode(out) else { return }
        try? data.write(to: url, options: .atomic)
    }

    /// Re-tints last session's glyphs on a utility queue (batches of 40 with a short breather). Call once, after the intro landed.
    static func warmFromLastSession() {
        queue.async {
            guard let url = fileURL, let data = try? Data(contentsOf: url),
                  let entries = try? JSONDecoder().decode([Entry].self, from: data) else { return }
            lock.lock(); previous = entries; lock.unlock()
            var n = 0
            for e in entries.prefix(warmLimit) where e.v.count == 11 {
                let v = e.v
                let q = BubbleGlyphTint.Request(stem: e.s, w: CGFloat(v[0]), h: CGFloat(v[1]), f0: v[2], f1: v[3],
                                                t0: (Float(v[4]), Float(v[5]), Float(v[6])), t1: (Float(v[7]), Float(v[8]), Float(v[9])),
                                                scale: CGFloat(v[10]))
                _ = BubbleGlyphTint.tint(q)
                n += 1
                if n % 8 == 0 { Thread.sleep(forTimeInterval: 0.05) }
            }
        }
    }
}
