// 2.8 item 40 (screen readers): the spoken words for everything new in 2.8, in ONE place so VoiceOver (iOS), TalkBack
// (Android) and ARIA (web) say the same thing. Pure; the Swift / Kotlin ports assert against a11y-labels-fixtures.json.
// Every helper returns a non-empty string (a test pins that), so no image title, headline or mascot is ever silent.

/** "First" / "Second" / "Third" / "#4". */
export function placeWord(place: number): string {
  return place === 1 ? 'First' : place === 2 ? 'Second' : place === 3 ? 'Third' : `#${place}`;
}

/** A podium place as one spoken line: "First place, doug, 2,005, 4 Guesses · 1m 45s". */
export function podiumPlaceLabel(place: number, name: string, points: string, detail?: string | null): string {
  const d = detail && detail.trim() ? `, ${detail.trim()}` : '';
  return `${placeWord(place)} place, ${name}, ${points}${d}`;
}

/** A free podium place. */
export function podiumOpenSpotLabel(place: number): string {
  return `${placeWord(place)} place, open spot`;
}

/** The button that opens a podium mascot's mini Stage card. */
export function podiumStageCardLabel(name: string, place: number): string {
  return `${name}, ${placeWord(place).toLowerCase()} place. Opens their stage`;
}

/** The gold seal on the Flawless popup. */
export function flawlessSealLabel(days: number): string {
  return `${days} Flawless ${days === 1 ? 'day' : 'days'} in a row`;
}

/** A changing headline set in bubble letters (or split over lines): the plain sentence, whitespace collapsed. */
export function headlineLabel(lines: string | readonly string[]): string {
  const text = (typeof lines === 'string' ? lines : lines.join(' ')).replace(/\s+/g, ' ').trim();
  return text || 'Headline';
}

/** A mascot picture: yours, or another player's. */
export function mascotLabel(own: boolean, name?: string | null): string {
  if (own) return 'Your mascot';
  const n = name?.trim();
  return n ? `${n}'s mascot` : 'Mascot';
}

/** The Home counter ("7 OF 18"). */
export function progressLabel(played: number, total: number): string {
  return `${played} of ${total} played today`;
}
