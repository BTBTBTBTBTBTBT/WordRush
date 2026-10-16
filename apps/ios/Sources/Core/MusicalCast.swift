import Foundation

/// The musical cast easter egg (docs/cloud-prompts/10) — a port of packages/core/src/musical-cast.ts: long-press
/// any cast puppet in the header → all ten turn "musical" (a staggered squash-and-pop, floating notes, a little
/// glow); then each tap plays a note in that character's own voice. Left → right W O R D O C I O U S is a C major
/// scale, C4 … E5. Play a public-domain tune correctly and a secret achievement unlocks (shown only once earned).
/// Long-press again → back to normal laughs. Pure; pinned across TS / Swift / Kotlin by musical-cast-fixtures.json
/// (MusicalCastTests).
///
/// Behind the musicalCast flag: ON in debug builds, ON in release too (founder 10-09: the tunes ship in 2.8).
public enum MusicalCast {
    /// The flag: on in debug (web dev, iOS DEBUG, Android BuildConfig.DEBUG), off in release.
    public static let flag: (debug: Bool, release: Bool) = (debug: true, release: true)

    public static func enabled(isDebugBuild: Bool) -> Bool {
        isDebugBuild ? flag.debug : flag.release
    }

    /// The header's cast, left → right (WORDOCIOUS).
    public static let ids: [String] = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]
    /// C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 as MIDI note numbers (the notes are cut by docs/design/brand/sounds/make-notes.py).
    public static let scale: [Int] = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76]

    private static let names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    /// "C4", "E5" …
    public static func noteName(_ midi: Int) -> String {
        let octave = Int((Double(midi) / 12).rounded(.down)) - 1
        return "\(names[((midi % 12) + 12) % 12])\(octave)"
    }

    /// In a season with its own spooky voicing (item 49), each cast member's note is the same voice with an instrument
    /// layered under it: the sound is `<prefix><id>`. Other seasons: none. The registry's `slots.sounds.note` names the
    /// same prefix; this is the core's mirror so the three apps agree.
    public static let seasonNotePrefix: [String: String] = ["halloween": "note-h-"]

    /// A cast member's note (unknown id → nil). `season` = the active season id (nil/unknown = the normal voices).
    public static func note(_ castId: String, season: String? = nil) -> MusicalNote? {
        guard let index = ids.firstIndex(of: castId) else { return nil }
        let midi = scale[index]
        let prefix = season.flatMap { seasonNotePrefix[$0] } ?? "note-"
        return MusicalNote(castId: castId, index: index, midi: midi, name: noteName(midi), sound: "\(prefix)\(castId)")
    }

    // MARK: The transform

    /// The squash-and-pop keyframes (t 0..1 → scale x / y, a little lift in % of height): squash, stretch up, settle.
    public static let popKeys: [MusicalPopKey] = [
        MusicalPopKey(t: 0, sx: 1, sy: 1, lift: 0),
        MusicalPopKey(t: 0.22, sx: 1.16, sy: 0.82, lift: 0),
        MusicalPopKey(t: 0.5, sx: 0.9, sy: 1.14, lift: 9),
        MusicalPopKey(t: 0.74, sx: 1.05, sy: 0.96, lift: 0),
        MusicalPopKey(t: 1, sx: 1, sy: 1, lift: 0),
    ]

    /// The pop at `t` (0..1; outside → rest), each segment eased in-out between its keys.
    public static func popPose(_ t: Double) -> MusicalPopKey {
        guard t > 0, t < 1 else { return MusicalPopKey(t: t, sx: 1, sy: 1, lift: 0) }
        for k in 1..<popKeys.count where t <= popKeys[k].t {
            let a = popKeys[k - 1], b = popKeys[k]
            let u = (t - a.t) / max(1e-9, b.t - a.t)
            let e = u * u * (3 - 2 * u)
            return MusicalPopKey(t: t, sx: a.sx + (b.sx - a.sx) * e, sy: a.sy + (b.sy - a.sy) * e, lift: a.lift + (b.lift - a.lift) * e)
        }
        return MusicalPopKey(t: t, sx: 1, sy: 1, lift: 0)
    }

    /// The per-character start delays (ms, WORDOCIOUS order): a ripple out from the pressed one (|i − pressed| × stagger).
    /// Reduce Motion → every delay 0 (and the platforms swap instantly, no pop).
    public static func transformDelays(pressed pressedCastId: String, reduceMotion: Bool) -> [Int] {
        let from = max(0, ids.firstIndex(of: pressedCastId) ?? -1)
        return ids.indices.map { i in reduceMotion ? 0 : abs(i - from) * MusicalTiming.staggerMs }
    }

    /// The whole transform's length (ms): the last delay + one pop; 0 under Reduce Motion.
    public static func transformDuration(pressed pressedCastId: String, reduceMotion: Bool) -> Int {
        if reduceMotion { return 0 }
        return (transformDelays(pressed: pressedCastId, reduceMotion: false).max() ?? 0) + MusicalTiming.popMs
    }

    // MARK: Melodies

    private static let C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76

    /// Public-domain tunes (their best-known opening, every note on a cast key).
    public static let melodies: [MusicalMelody] = [
        MusicalMelody(id: "mary", name: "Mary Had a Little Lamb", achievement: "tune_little_lamb",
                      source: "Sarah Josepha Hale, 1830; traditional tune", hint: "A lamb whose fleece was white as snow",
                      notes: [E4, D4, C4, D4, E4, E4, E4, D4, D4, D4, E4, G4, G4],
                      song: [E4, D4, C4, D4, E4, E4, E4, D4, D4, D4, E4, G4, G4, E4, D4, C4, D4, E4, E4, E4, E4, D4, D4, E4, D4, C4],
                      beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]),
        MusicalMelody(id: "twinkle", name: "Twinkle, Twinkle, Little Star", achievement: "tune_little_star",
                      source: "French folk tune, 1761; words Jane Taylor, 1806", hint: "A little star, up above the world so high",
                      notes: [C4, C4, G4, G4, A4, A4, G4, F4, F4, E4, E4, D4, D4, C4],
                      beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2]),
        MusicalMelody(id: "ode", name: "Ode to Joy", achievement: "tune_ode_to_joy",
                      source: "Ludwig van Beethoven, Symphony No. 9, 1824", hint: "Beethoven's big finale, four notes up the scale",
                      notes: [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4],
                      song: [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4, E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, D4, C4, C4],
                      beats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2]),
        MusicalMelody(id: "birthday", name: "Happy Birthday", achievement: "tune_happy_birthday",
                      source: "Patty and Mildred Hill, 1893 (public domain since 2016)", hint: "The song with the candles, once a year",
                      notes: [G4, G4, A4, G4, C5, B4, G4, G4, A4, G4, D5, C5],
                      beats: [0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1, 2]),
        MusicalMelody(id: "buns", name: "Hot Cross Buns", achievement: "tune_hot_cross_buns",
                      source: "English street cry, 1798", hint: "One a penny, two a penny",
                      notes: [E4, D4, C4, E4, D4, C4, C4, C4, C4, C4, D4, D4, D4, D4, E4, D4, C4],
                      beats: [1, 1, 2, 1, 1, 2, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 2]),
    ]

    /// The Halloween tunes (item 49): public-domain compositions played on the cast's own white keys (matching is by
    /// interval shape). Only active in season. Each is a hidden achievement.
    ///   - In the Hall of the Mountain King (Grieg, 1875): A B C D E C E . D B D.
    ///   - Toccata and Fugue in D minor (Bach, BWV 565) opening; the cast has no C#, so it plays the C natural.
    ///   - Funeral March (Chopin, 1839), Funeral March of a Marionette (Gounod, 1872; G stands in for G#), Danse Macabre
    ///     (Saint-Saens, 1874), Night on Bald Mountain (Mussorgsky), The Sorcerer's Apprentice (Dukas, 1897): each
    ///     checked against a score and realized on the white keys by interval shape (see musical-cast.ts).
    public static let halloweenMelodies: [MusicalMelody] = [
        MusicalMelody(id: "mountain_king", name: "In the Hall of the Mountain King", achievement: "tune_mountain_king",
                      season: "halloween", source: "Edvard Grieg, Peer Gynt, 1875", hint: "Tiptoe up the steps of the mountain king's hall",
                      notes: [A4, B4, C5, D5, E5, C5, E5, D5, B4, D5],
                      song: [D4, E4, F4, G4, A4, F4, A4, G4, E4, G4, G4, E4, G4, D4, E4, F4, G4, A4, F4, A4, D5, C5, A4, F4, A4, C5],
                      beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3]),
        MusicalMelody(id: "toccata", name: "Toccata and Fugue in D minor", achievement: "tune_toccata",
                      season: "halloween", source: "Johann Sebastian Bach, BWV 565, c. 1704", hint: "The spookiest organ opening ever written",
                      notes: [A4, G4, A4, G4, F4, E4, D4, C4, D4],
                      song: [A4, G4, A4, G4, F4, E4, D4, C4, D4, A4, G4, A4, E4, F4, C4, D4],
                      beats: [0.25, 0.25, 2, 0.25, 0.25, 0.25, 0.25, 0.5, 2.5, 0.25, 0.25, 2, 0.25, 0.25, 0.5, 3]),
        MusicalMelody(id: "funeral_march", name: "Funeral March", achievement: "tune_funeral_march",
                      season: "halloween", source: "Frederic Chopin, Piano Sonata No. 2, 1839", hint: "A slow march on one low note",
                      notes: [A4, A4, A4, A4, C5, B4, B4, A4, A4, G4, A4]),
        MusicalMelody(id: "marionette", name: "Funeral March of a Marionette", achievement: "tune_marionette",
                      season: "halloween", source: "Charles Gounod, 1872", hint: "A puppet's march (a certain TV host liked it too)",
                      notes: [A4, A4, G4, F4, G4, A4, B4]),
        MusicalMelody(id: "danse_macabre", name: "Danse Macabre", achievement: "tune_danse_macabre",
                      season: "halloween", source: "Camille Saint-Saens, 1874", hint: "Skeletons waltzing at midnight",
                      notes: [A4, A4, C5, A4, B4, C5, A4, C5, A4, C5, B4, C5, B4, A4]),
        MusicalMelody(id: "bald_mountain", name: "Night on Bald Mountain", achievement: "tune_bald_mountain",
                      season: "halloween", source: "Modest Mussorgsky, 1867", hint: "A wild night on a bare mountain",
                      notes: [B4, C5, B4, A4, B4, C5, C5, E5, B4],
                      song: [B4, C5, B4, A4, B4, C5, C5, E5, B4, B4, C5, D5, E5, E5, D5, C5, B4, A4],
                      beats: [1, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 1]),
        MusicalMelody(id: "sorcerers_apprentice", name: "The Sorcerer's Apprentice", achievement: "tune_sorcerers_apprentice",
                      season: "halloween", source: "Paul Dukas, 1897", hint: "Brooms that will not stop marching",
                      notes: [A4, E5, A4, C5, A4, C5, B4, C5, A4, C5]),
    ]

    /// Halloween tunes still waiting for checked notation: none (all five from the plan are wired above).
    public static let halloweenTunesTodo: [String] = []

    /// The Thanksgiving tunes (founder 10-16): public-domain compositions on the cast's white keys, matched by interval
    /// shape, only in the Thanksgiving window (and only once the season is READY: SeasonKit.current gates it; the admin
    /// preview passes the id). Normal voices (no seasonal note prefix). Simple Gifts (Brackett, 1848): the first phrase
    /// a fifth up (D4 pickup, G4 tonic); the sung continuation ends on D4 with F standing in for F# (see musical-cast.ts).
    /// We Gather Together, Come Ye Thankful People and Now Thank We All Our God are checked against scores (sources in musical-cast.ts).
    public static let thanksgivingMelodies: [MusicalMelody] = [
        MusicalMelody(id: "simple_gifts", name: "Simple Gifts", achievement: "tune_simple_gifts",
                      season: "thanksgiving", source: "Joseph Brackett, Shaker, 1848", hint: "'Tis the gift to be simple",
                      notes: [D4, D4, G4, G4, A4, B4, A4, B4, C5, D5, D5, C5, B4, A4, G4],
                      song: [D4, D4, G4, G4, A4, B4, A4, B4, C5, D5, D5, C5, B4, A4, G4, A4, A4, A4, A4, A4, B4, A4, F4, D4],
                      beats: [0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 2]),
        MusicalMelody(id: "we_gather", name: "We Gather Together", achievement: "tune_we_gather",
                      season: "thanksgiving", source: "Dutch folk tune, 1626; arr. Eduard Kremser, 1877", hint: "A Dutch melody for the whole table, asking a blessing",
                      notes: [G4, G4, A4, G4, E4, F4, G4, F4, E4, D4, E4, C4],
                      song: [G4, G4, A4, G4, E4, F4, G4, F4, E4, D4, E4, C4, G4, G4, A4, B4, C5, D5, B4, A4, G4, A4, G4, G4, G4, A4, B4, C5, G4, G4, G4, A4, F4, G4, E4, C4, C4, F4, G4, A4, F4, G4, F4, E4, E4, F4, D4, C4, C4],
                      beats: [1, 1.5, 0.5, 1, 1, 1, 1, 1.5, 0.5, 1, 1, 1, 1, 1.5, 0.5, 1, 1.5, 0.5, 1, 1.5, 0.5, 1, 2, 1, 1.5, 0.5, 1, 1, 1, 1, 1.5, 0.5, 0.5, 0.5, 1, 1, 1, 1.5, 0.5, 0.5, 0.5, 1.5, 0.5, 0.5, 0.5, 1, 1.5, 0.5, 2]),
        MusicalMelody(id: "thankful_people", name: "Come, Ye Thankful People, Come", achievement: "tune_thankful_people",
                      season: "thanksgiving", source: "George J. Elvey, St. George's Windsor, 1858", hint: "The last wagon of the harvest rolls home",
                      notes: [E4, E4, G4, E4, C4, D4, E4, E4, E4, G4, E4, C4, D4, E4],
                      beats: [1.5, 0.5, 1, 1, 1, 1, 2, 1.5, 0.5, 1, 1, 1, 1, 2]),
        MusicalMelody(id: "now_thank", name: "Now Thank We All Our God", achievement: "tune_now_thank",
                      season: "thanksgiving", source: "Johann Cruger, Nun danket, 1647", hint: "A grand old chorale: thanks with heart, hands and voices",
                      notes: [G4, G4, G4, A4, A4, G4, E4, F4, E4, D4],
                      beats: [2, 1.5, 0.5, 1, 1, 3, 1, 1, 1, 2]),
    ]

    /// Thanksgiving tunes still waiting for checked notation (public domain; wired once checked against a score).
    public static let thanksgivingTunesTodo: [String] = [
        "Over the River and Through the Wood", "Bringing in the Sheaves", "For the Beauty of the Earth",
    ]

    /// Each season's own tunes (only count in that season; the achievements stay forever).
    public static let seasonMelodies: [String: [MusicalMelody]] = ["halloween": halloweenMelodies, "thanksgiving": thanksgivingMelodies]

    /// Every tune in catalog order: the everyday five, then each season's batch (Halloween, Thanksgiving).
    public static let allMelodies: [MusicalMelody] = melodies + halloweenMelodies + thanksgivingMelodies

    /// The tunes that count right now: the everyday five, plus the season's own (seasonMelodies).
    public static func activeMelodies(season: String? = nil) -> [MusicalMelody] {
        if let season, let own = seasonMelodies[season] { return melodies + own }
        return melodies
    }

    /// The steps between consecutive notes (the shape of a tune, key-free).
    public static func intervals(_ notes: [Int]) -> [Int] {
        guard notes.count > 1 else { return [] }
        return (1..<notes.count).map { notes[$0] - notes[$0 - 1] }
    }

    /// The tune the played notes END with, or nil. A tune counts when its last N notes have the tune's exact shape
    /// (its intervals) — in C or any other key the cast can play. Ties → the longest tune.
    public static func match(_ played: [Int], melodies: [MusicalMelody] = MusicalCast.melodies) -> MusicalMelody? {
        var best: MusicalMelody?
        for m in melodies {
            if played.count < m.notes.count { continue }
            let tail = Array(played.suffix(m.notes.count))
            if intervals(tail) == intervals(m.notes) && (best == nil || m.notes.count > best!.notes.count) { best = m }
        }
        return best
    }

    /// A pause longer than this starts a fresh phrase; the buffer keeps at most this many notes.
    public static let gapMs: Double = 4000
    public static let bufferSize = 32

    /// One tap in musical mode at `atMs` (any clock in ms). Pure: returns the next state.
    public static func tap(_ state: MelodyState, castId: String, atMs: Double, season: String? = nil) -> MelodyTap {
        guard let played = MusicalCast.note(castId, season: season) else { return MelodyTap(state: state, note: nil, matched: nil) }
        let fresh: Bool
        if let last = state.lastAt { fresh = atMs - last > gapMs || atMs < last } else { fresh = true }
        let kept: [Int] = fresh ? [] : state.notes
        let notes = Array((kept + [played.midi]).suffix(bufferSize))
        let matched = match(notes, melodies: activeMelodies(season: season))
        return MelodyTap(state: MelodyState(notes: matched != nil ? [] : notes, lastAt: atMs), note: played, matched: matched)
    }

    /// The secret achievement keys (achievement-rules NEW_ACHIEVEMENTS, `secret`: shown only once unlocked).
    public static let achievementKeys: [String] = allMelodies.map(\.achievement)

    /// The playback (founder 10-12): a completed tune is sung back once, cleanly — `replayLeadInMs` after the last tap,
    /// each note on its own figure. Founder 10-13: the cast finishes the jingle (`song`) in its own rhythm (`beats`, in
    /// `replayBeatMs` units). Mirrors core `MELODY_REPLAY` / `melodySong` / `melodyReplay` / `melodyReplayDuration`.
    public static let replayLeadInMs = 450
    public static let replayBeatMs = 300

    /// What the cast sings for a tune: its notes and each one's length in beats.
    public static func song(_ m: MusicalMelody) -> (notes: [Int], beats: [Double]) {
        let notes = m.song ?? m.notes
        return (notes, m.beats ?? notes.map { _ in 1 })
    }

    /// The completed tune as the cast plays it back: which figure sings each note and when (ms after the last tap).
    public static func replay(_ m: MusicalMelody) -> [(castId: String, atMs: Int)] {
        let (notes, beats) = song(m)
        var at = 0.0
        return notes.enumerated().compactMap { i, midi in
            let atMs = replayLeadInMs + Int((at * Double(replayBeatMs)).rounded())
            at += beats[i]
            guard let k = scale.firstIndex(of: midi) else { return nil }
            return (ids[k], atMs)
        }
    }

    /// The whole playback's length (ms after the last tap): the lead-in + every note's beats.
    public static func replayDuration(_ m: MusicalMelody) -> Int {
        replayLeadInMs + Int((song(m).beats.reduce(0, +) * Double(replayBeatMs)).rounded())
    }
}

/// How long a press must hold to toggle musical mode, and the transform's timing (same perf rules as the puppets).
public enum MusicalTiming {
    public static let longPressMs = 550
    /// A finger that drifts further than this (pt) cancels the long-press.
    public static let moveSlop: Double = 10
    /// Each character starts this much after its neighbor, rippling out from the one pressed.
    public static let staggerMs = 55
    /// One character's squash-and-pop.
    public static let popMs = 420
}

public struct MusicalNote: Equatable {
    public let castId: String
    public let index: Int
    public let midi: Int
    public let name: String
    /// The sound name: note-<id> (note-h-<id> in a season with its own voicing).
    public let sound: String

    public init(castId: String, index: Int, midi: Int, name: String, sound: String) {
        self.castId = castId; self.index = index; self.midi = midi; self.name = name; self.sound = sound
    }
}

public struct MusicalPopKey: Equatable {
    public let t: Double
    public let sx: Double
    public let sy: Double
    /// Lift in % of the figure's height.
    public let lift: Double

    public init(t: Double, sx: Double, sy: Double, lift: Double) {
        self.t = t; self.sx = sx; self.sy = sy; self.lift = lift
    }
}

public struct MusicalMelody: Equatable {
    public let id: String
    public let name: String
    /// The secret achievement it unlocks.
    public let achievement: String
    /// The tune as MIDI notes, in C (every note on the cast's keys). Matched by its intervals, so any key that fits counts.
    public let notes: [Int]
    /// What the cast sings back once matched (founder 10-13): the jingle finished to its natural end, never a second
    /// verse. nil → `notes`.
    public let song: [Int]?
    /// Each sung note's length in replay beats (same length as `song ?? notes`). nil → 1 each.
    public let beats: [Double]?
    /// The season (registry id) it only counts in; nil = every day. Data for the admin Sound Library.
    public let season: String?
    /// Where the public-domain tune comes from (composer / origin, year).
    public let source: String
    /// The discovery hint: a short, spoiler-light nudge. Never the title.
    public let hint: String

    public init(id: String, name: String, achievement: String, season: String? = nil, source: String = "", hint: String = "",
                notes: [Int], song: [Int]? = nil, beats: [Double]? = nil) {
        self.id = id; self.name = name; self.achievement = achievement; self.notes = notes
        self.song = song; self.beats = beats; self.season = season; self.source = source; self.hint = hint
    }
}

public struct MelodyState: Equatable {
    public var notes: [Int]
    public var lastAt: Double?

    public init(notes: [Int] = [], lastAt: Double? = nil) {
        self.notes = notes; self.lastAt = lastAt
    }

    public static let start = MelodyState()
}

public struct MelodyTap: Equatable {
    public let state: MelodyState
    public let note: MusicalNote?
    /// The tune just completed (the buffer then clears so it can't fire twice).
    public let matched: MusicalMelody?
}
