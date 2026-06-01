import AVFoundation

/// Synthesized sound effects mirroring the web `lib/sounds.ts` (key taps +
/// win/loss/invalid jingles) so the Settings "Sound Effects" toggle does
/// something. Tones are generated on the fly via AVAudioEngine — no bundled
/// assets. Uses the `.ambient` session so effects respect the ringer/mute
/// switch and never interrupt background audio. Gated by `pref-sound`
/// (default on); the native haptics are unchanged and fire alongside these.
final class SoundManager {
    static let shared = SoundManager()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    private var started = false

    private init() {}

    /// Default ON unless the user explicitly turned it off.
    private var enabled: Bool {
        UserDefaults.standard.object(forKey: "pref-sound") == nil
            ? true
            : UserDefaults.standard.bool(forKey: "pref-sound")
    }

    private func ensureStarted() {
        guard !started else { return }
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
            try engine.start()
            player.play()
            started = true
        } catch {
            started = false
        }
    }

    /// Schedule one sine tone with a smooth fade-out (so it doesn't click),
    /// optionally after `delay` seconds — used to chain jingle notes.
    private func tone(_ freq: Double, _ duration: Double, _ volume: Float, delay: Double = 0) {
        let sr = format.sampleRate
        let frames = AVAudioFrameCount(sr * duration)
        guard frames > 0, let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return }
        buf.frameLength = frames
        guard let ch = buf.floatChannelData?[0] else { return }
        let w = 2.0 * Double.pi * freq
        for i in 0..<Int(frames) {
            let t = Double(i) / sr
            let env = Float(pow(1.0 - Double(i) / Double(frames), 1.5)) // fade to silence
            ch[i] = Float(sin(w * t)) * volume * env
        }
        let fire = { [weak self] in
            guard let self else { return }
            self.ensureStarted()
            guard self.started else { return }
            self.player.scheduleBuffer(buf, at: nil, options: [], completionHandler: nil)
        }
        if delay > 0 { DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: fire) }
        else { fire() }
    }

    // Frequencies/timings mirror lib/sounds.ts.
    func playKeyTap()  { guard enabled else { return }; tone(800, 0.04, 0.06) }
    func playInvalid() { guard enabled else { return }; tone(200, 0.15, 0.08); tone(150, 0.15, 0.06, delay: 0.08) }
    func playSuccess() { guard enabled else { return }; tone(523, 0.12, 0.10); tone(659, 0.12, 0.10, delay: 0.10); tone(784, 0.20, 0.12, delay: 0.20) }
    func playGameOver(){ guard enabled else { return }; tone(392, 0.20, 0.10); tone(330, 0.20, 0.10, delay: 0.15); tone(262, 0.30, 0.08, delay: 0.30) }
}
