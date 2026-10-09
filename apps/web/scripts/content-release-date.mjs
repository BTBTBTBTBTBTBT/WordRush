// The first day whose puzzles may differ from what is already bundled in the store apps
// (and live on the web). Content repairs to the bundled puzzle banks (Spyglass, Kindred,
// Muddle, Hubbub, Letter Ladder, Crossword) start HERE and never touch an earlier daily,
// so a puzzle someone already played never changes. Set it to the date the next
// coordinated release (web push + iOS + Android carrying the same banks) goes live.
// Read by content-american.test.ts and every repair-future script; move it in one place.
export const CONTENT_RELEASE_DATE = '2026-10-13';
