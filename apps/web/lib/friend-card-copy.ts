// Founder 10-09: the words on the friend card's "Pick a game" dropdown and the action menu's layout rule. Pure, so the
// three apps keep one rule (iOS FriendCardsView.gamesDropdown / FamilyMenuInk.isNotes, Android FriendCardCopy).

/** The dropdown's subtitle: the first three game titles joined ", ", plus " and more" past three. */
export function gamesSubtitle(titles: readonly string[]): string {
  return titles.slice(0, 3).join(', ') + (titles.length > 3 ? ' and more' : '');
}

/** The shortest title that reads as a sentence: a non-danger action this long (React's quick notes) wears a speech bubble. */
export const NOTE_TITLE_MIN = 19;

/** A menu whose (non-danger) choices are sentences lists them one per row as speech bubbles, whole. */
export function isNotesMenu(actions: ReadonlyArray<{ title: string; danger?: boolean }>): boolean {
  return actions.some((a) => !a.danger && a.title.length >= NOTE_TITLE_MIN);
}
