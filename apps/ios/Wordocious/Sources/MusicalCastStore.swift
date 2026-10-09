import SwiftUI
import WordociousCore

/// The musical cast's app-wide state (FRIDAY-QUEUE item 4b, founder 10-06): once the cast turns musical it STAYS
/// musical on every page that shows the header (Home, Leaderboard, Stats, Friends, game pages, the auth screen …) until
/// a long-press turns it back. One shared store every `LivingCastHeader` observes, so a tab switch or a push (which
/// remounts the header) keeps it. Never persisted: an app restart is normal again (decided). The melody buffer lives here
/// too, so a tune can span pages. Web: lib/musical-store.ts · Android: MusicalCastKit's top-level state.
final class MusicalCastStore: ObservableObject {
    static let shared = MusicalCastStore()

    /// Whether the cast is musical right now.
    @Published private(set) var musical = false

    /// The latest toggle: every mounted header ripples from `from` at `at` (a header that mounts later just shows the state).
    struct Flip: Equatable {
        let id: Int
        let at: Date
        let from: MascotID
    }
    @Published private(set) var flipped: Flip?
    private var toggleSeq = 0

    /// The tune matcher's phrase, shared across headers (not published: nothing redraws on a note).
    var melody = MelodyState.start

    private init() {}

    /// Long-press on figure `m`: flip the mode everywhere and start a fresh phrase.
    func toggle(from m: MascotID) {
        melody = .start
        musical.toggle()
        toggleSeq += 1
        flipped = Flip(id: toggleSeq, at: Date(), from: m)
    }
}
