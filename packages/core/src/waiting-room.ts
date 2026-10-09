// VS / pocket waiting rooms as a little lobby (FRIDAY-QUEUE item 22, 2.8 wave 3).
//
// One status line in the bubble lettering ("Waiting for Johnny..."), a REAL
// counting timer, and a keepy-uppy tile mini-play. Pure so the three apps say
// the same words; the ports assert against waiting-room-fixtures.json.

export type WaitingKind =
  /** A private match: invited a named friend, or a code nobody has used yet. */
  | 'friend'
  /** Random opponent search. */
  | 'random'
  /** A bot is being found / warmed up. */
  | 'bot'
  /** A pocket game waiting for the friend to take their turn. */
  | 'pocket';

export interface WaitingInput {
  kind: WaitingKind;
  /** The friend's name when known (they were invited by name). */
  name?: string | null;
}

const clean = (s: string | null | undefined): string => (s ?? '').trim().replace(/^@+/, '');

/** The ONE status line. A real ellipsis character, never three dots. */
export function waitingStatusLine(i: WaitingInput): string {
  const name = clean(i.name);
  switch (i.kind) {
    case 'friend': return name ? `Waiting for ${name}…` : 'Waiting for your friend…';
    case 'pocket': return name ? `Waiting for ${name}…` : 'Waiting for your friend…';
    case 'random': return 'Finding you an opponent…';
    case 'bot': return 'Warming up your opponent…';
  }
}

/** The counting timer: m:ss under an hour, h:mm:ss after. Negative or NaN reads 0:00. */
export function waitClock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Seconds waited from a start time (ms) and now (ms); never negative. */
export function waitedSeconds(startMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

/** The keepy-uppy line under the tile: nothing at 0, then the bounce count. */
export function keepyLine(count: number, best: number): string {
  if (count <= 0) return best > 0 ? `Tap to bounce · best ${best}` : 'Tap to bounce the tile';
  return count > best && best > 0 ? `${count} · new best!` : `${count}`;
}

/** Idle chirps cycle slowly while you wait (never more than one per 6 s). */
export const WAIT_IDLE_BITS = ['checks its watch', 'yawns', 'waves at the door'] as const;
export const WAIT_IDLE_EVERY_S = 6;

/** Which idle bit plays at a given waited second. */
export function idleBit(seconds: number): (typeof WAIT_IDLE_BITS)[number] | null {
  if (seconds < WAIT_IDLE_EVERY_S) return null;
  return WAIT_IDLE_BITS[Math.floor(seconds / WAIT_IDLE_EVERY_S - 1) % WAIT_IDLE_BITS.length];
}
