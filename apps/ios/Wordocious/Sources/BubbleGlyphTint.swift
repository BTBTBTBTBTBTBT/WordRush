import SwiftUI
import UIKit
import WordociousCore

// 2.8 item 6: the bubble-letter glyph tinter. The asset-catalog glyphs are TINT MAPS, not colored art
// (scripts/build-bubble-atlas.py): R = tint multiplier, G = additive white (highlights), B = rim shade.
// One rule, identical on web and Android:  out = clamp(tint(y) * A + Wh + rimColor * Rm).
// Each tinted glyph is built once per (stem, size, tint) and cached, so a headline costs a few images.

enum BubbleGlyphTint {
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 200
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
        let scale = UIScreen.main.scale
        guard let m = BubbleAtlasMetrics.glyphs[stem] else { return nil }
        // Never more pixels than the source art has (cap capPx).
        let w = max(1, Int(min(width * scale, CGFloat(m.w * Double(BubbleAtlasMetrics.capPx))).rounded()))
        let h = max(1, Int(min(height * scale, CGFloat(m.h * Double(BubbleAtlasMetrics.capPx))).rounded()))
        let t0 = rgb(top), t1 = rgb(bottom)
        let key = "\(stem)|\(w)x\(h)|\(Int(f0 * 1000))|\(Int(f1 * 1000))|\(t0)|\(t1)" as NSString
        if let hit = cache.object(forKey: key) { return hit }
        guard let src = UIImage(named: "bubble-\(stem)")?.cgImage else { return nil }

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
        let img = UIImage(cgImage: out, scale: scale, orientation: .up)
        cache.setObject(img, forKey: key)
        return img
    }
}
