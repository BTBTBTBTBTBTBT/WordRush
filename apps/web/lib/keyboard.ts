/**
 * Shared guard for the game boards' window-level `keydown` listeners.
 *
 * Every board (solo, VS, practice, Gauntlet, ProperNoundle) listens on `window`
 * so you can just start typing a guess — that part is deliberate and matches
 * both natives. What was missing is a check on WHERE the keystroke came from.
 * With a board mounted, typing into any real input on the same page — the
 * welcome modal's username field, the invite-code box, profile edit — also fed
 * every letter to the board. The user sees their own text appear in the field
 * AND a guess assembling behind it, and Enter submits the half-typed word.
 *
 * Returns true when the event should be left alone for the focused control.
 * `key` is intentionally not inspected: this is about the target, not the key.
 */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;

  // A keystroke already consumed by something else (IME composition, or a
  // handler that called preventDefault) is not ours to act on either.
  if (e.defaultPrevented || e.isComposing) return true;

  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;

  // Radix/ARIA dialogs render OUTSIDE the board's tree but keystrokes still
  // reach window. A board behind an open modal must stay inert — closest()
  // walks up from the focused element, which is inside the dialog.
  if (el.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return true;

  return false;
}
