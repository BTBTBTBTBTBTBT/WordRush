// FINISH_SPEC BJ2 (founder 10-03 on iOS 2.7 (241): "make the completion screens
// less choppy … it all feels like it can use some fluidity"): the finish plays
// ONE big thing at a time. The same numbers live in iOS FinishMotion
// (PostGameEffects.swift) and Android FinishMotion (ui/game/FinishMotion.kt).
//
//   win / lose card springs in → its answer tiles flip → the points count up →
//   ONE gloss sweep → the host's idle bob; CONTINUE → the finished screen (its
//   strip headline pops once the card has left) → the XP toast → achievement /
//   level-up popups.
//
// The reveal + finish hold (BI5) are untouched: nothing here is faster than it
// was, only ordered.
export const FINISH_MOTION = {
  /** The finished strip's headline waits for the win card's fade-out. */
  afterCardMs: 300,
  /** The XP toast rises this long after the win card has closed. */
  xpAfterHoldMs: 450,
  /** Achievement / level-up popups this long after the win card has closed. */
  achievementsAfterHoldMs: 850,
  /** Win card internals, from its spring-in. */
  tilesStartMs: 250,
  countStartMs: 450,
  sweepStartMs: 900,
  sparkleStartMs: 1150,
  bobStartMs: 1200,
} as const;

/** The R1 win / lose card is on screen (the class every ResultPopup carries). */
export function resultPopupOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('.result-pop');
}

/** How often a held celebration re-checks whether the win card has closed. */
export const HOLD_POLL_MS = 150;
