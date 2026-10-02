import Foundation

// FINISH_SPEC §Z (founder 10-02): flipping Daily ⇄ Unlimited must never move a
// board. Everything above a board lives in fixed slots that exist in BOTH modes —
// a mode with nothing for a slot keeps it empty, never collapses it — so the
// board's top edge and size are identical in both modes. These are the pure
// slot rules the SwiftUI screens read (the game screens with a Pro Unlimited
// picker, and the Home banner that carries the switch); the unit tests assert
// the board frame is the same in both modes on every phone size.

/// Daily or Unlimited (the app's `PlayMode`, kept separate so Core stays UI-free).
public enum GamePlayMode: String, CaseIterable {
    case daily, unlimited
}

public enum GameHeaderLayout {
    /// The Unlimited-only picker row (Sudoku's Easy · Medium · Hard, Starsweep's
    /// grid sizes): one fixed height, reserved in Daily too.
    public static let pickerSlotHeight: Double = 36
    /// The game screens' stack spacing (header · picker · board · pad).
    public static let stackSpacing: Double = 8

    /// The slots above a game board for one mode.
    public struct Slots: Equatable {
        /// The picker row's reserved height (0 when the game has no picker or the
        /// player can't play Unlimited at all — then neither mode shows it).
        public let pickerHeight: Double
        /// Whether the picker's content is visible (Unlimited only); the slot's
        /// height never depends on this.
        public let showsPicker: Bool
        /// Whether the daily puzzle number ("#123") shows on the status line.
        public let showsDailyNumber: Bool
        /// Whether the daily-only holiday line shows (its slot is reserved
        /// whenever today has one, in both modes).
        public let showsHolidayLine: Bool

        /// The total height the slots reserve (what the board's top depends on).
        public var reservedHeight: Double { pickerHeight }
    }

    /// The slot rules. `offersPicker`: the game has an Unlimited-only picker AND
    /// the player can play Unlimited (Pro) — a mode-independent fact, so the slot
    /// exists in both modes.
    public static func slots(mode: GamePlayMode, offersPicker: Bool) -> Slots {
        Slots(pickerHeight: offersPicker ? pickerSlotHeight : 0,
              showsPicker: offersPicker && mode == .unlimited,
              showsDailyNumber: mode == .daily,
              showsHolidayLine: mode == .daily)
    }

    /// A phone screen in points.
    public struct Screen: Equatable {
        public let width: Double
        public let height: Double
        public let safeTop: Double
        public let safeBottom: Double
        public init(width: Double, height: Double, safeTop: Double, safeBottom: Double) {
            self.width = width; self.height = height; self.safeTop = safeTop; self.safeBottom = safeBottom
        }
    }

    /// A square board's frame on screen.
    public struct BoardFrame: Equatable {
        public let top: Double
        public let side: Double
    }

    /// Where a square board (Sudoku, Starsweep) lands: the stack is header ·
    /// picker slot · flexible space · board · flexible space · pad, so the board
    /// is centered in what's left between the slots and the pad. Every input is
    /// mode-independent except through `slots`, whose reserved height isn't.
    public static func boardFrame(screen: Screen, headerHeight: Double, dockHeight: Double,
                                  mode: GamePlayMode, offersPicker: Bool,
                                  sidePadding: Double = 16) -> BoardFrame {
        let s = slots(mode: mode, offersPicker: offersPicker)
        let pickerBlock = s.pickerHeight > 0 ? s.pickerHeight + stackSpacing : 0
        let areaTop = screen.safeTop + headerHeight + stackSpacing + pickerBlock
        let areaBottom = screen.height - screen.safeBottom - dockHeight - stackSpacing
        let available = max(0, areaBottom - areaTop)
        let side = max(0, min(screen.width - sidePadding * 2, available))
        return BoardFrame(top: areaTop + (available - side) / 2, side: side)
    }
}

// MARK: - The Home banner (where the switch lives on iOS)

/// The Home banner's mode-independent slots: which optional pieces reserve room
/// (from TODAY'S DAILY state, whatever the switch says) and which ones show
/// their content in the current mode. Flipping the switch only changes the
/// `shows…` flags, never which slots exist, so the tile rows never move.
public struct HomeBannerSlots: Equatable {
    /// The celebration bar + wide sweep / flawless art under the headline.
    public let hasMoment: Bool
    public let showsMomentArt: Bool
    /// The share button beside the headline.
    public let hasShare: Bool
    public let showsShare: Bool
    /// Each row's streak flame.
    public let hasWordFlame: Bool
    public let hasPuzzlesFlame: Bool
    public let showsFlames: Bool

    public static func compute(word: GroupProgress, puzzles: GroupProgress,
                               wordStreaks: GroupStreaks, puzzleStreaks: GroupStreaks,
                               mode: GamePlayMode) -> HomeBannerSlots {
        let daily = mode == .daily
        let wTier = HomeBanner.groupTier(word)
        let pTier = HomeBanner.groupTier(puzzles)
        let anyPlayed = word.played + puzzles.played > 0
        return HomeBannerSlots(
            hasMoment: wTier != .none, showsMomentArt: daily,
            hasShare: anyPlayed, showsShare: daily,
            hasWordFlame: HomeBanner.groupStreak(wTier, wordStreaks) > 0,
            hasPuzzlesFlame: HomeBanner.groupStreak(pTier, puzzleStreaks) > 0,
            showsFlames: daily)
    }

    /// The parts of the layout that take room — identical in both modes.
    public var reserved: [Bool] { [hasMoment, hasShare, hasWordFlame, hasPuzzlesFlame] }
}
