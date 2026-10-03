// The in-game feedback toast's classifier (FINISH_SPEC: finished popups).
// Every game flashes a short line ("+5", "Not in word list", "Copied!"); the
// shared toast (components/game/feedback-toast.tsx) draws a SCORE as a
// celebratory candy burst and anything else as a calm candy pill in a tone.
// Identical rules on iOS and Android. Pure: no React, no DOM.

export type FeedbackTone = 'success' | 'error' | 'win' | 'loss' | 'warn' | 'info';

export type FeedbackKind =
  | { kind: 'score'; points: number; pangram: boolean; label: string }
  | { kind: 'message'; tone: FeedbackTone; text: string };

const SCORE_RE = /^(Pangram!\s*)?\+(\d+)$/i;

/**
 * The quality label for a Hubbub-style score (4-letter word = 1 pt, n letters
 * = n pts, pangram +7): PANGRAM! / Good! (≤ 4) / Nice! (5–6) / Great! (7) /
 * Amazing! (≥ 8).
 */
export function scoreLabel(points: number, pangram: boolean): string {
  if (pangram) return 'PANGRAM!';
  if (points <= 4) return 'Good!';
  if (points <= 6) return 'Nice!';
  if (points === 7) return 'Great!';
  return 'Amazing!';
}

/** The tone of a plain message, from its words. */
export function feedbackTone(text: string): FeedbackTone {
  const t = text.trim().toLowerCase();
  if (/solved|nice|great|rank up/.test(t)) return 'win';
  if (/copied|saved|sent/.test(t)) return 'success';
  if (t.startsWith('not ') || /already|enough|invalid|must|only|too short|or more|missing/.test(t)) return 'error';
  if (/the word was|answer|out of/.test(t)) return 'loss';
  return 'info';
}

/** SCORE ("+5", "Pangram! +14") or a MESSAGE with its tone. */
export function feedbackKind(text: string): FeedbackKind {
  const m = SCORE_RE.exec(text.trim());
  if (m) {
    const points = parseInt(m[2], 10);
    const pangram = !!m[1];
    return { kind: 'score', points, pangram, label: scoreLabel(points, pangram) };
  }
  return { kind: 'message', tone: feedbackTone(text), text };
}
