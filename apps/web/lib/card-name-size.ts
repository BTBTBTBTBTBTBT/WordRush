/**
 * FINISH_SPEC BJ18 (parity with Android CardNameSizeScope / iOS HomeCardSpec.uniformNameSize):
 * the cards of one grid ROW draw their names at ONE size (founder 10-10: one size for the whole grid
 * set Crosswordocious at ~12 px, so a short-named row keeps the full size; iOS rowSizes) — the largest
 * (≤ 18, 0.5 steps) at which the widest name in the row fits its slot (the card's full width), floored at 13; a name still too wide at that size shrinks
 * on its own card as the last resort (FitName in components/home/mode-card.tsx). Each FitName
 * reports the size its own name fits at; the store applies the shared minimum to every card
 * straight on the DOM (no React re-render).
 */
export const CARD_NAME_MAX = 18;
export const CARD_NAME_UNIFORM_MIN = 13;

/** The grid's shared name size for the smallest per-card fit: ≤ 18, ≥ 13, 0.5 steps. */
export function uniformCardNameSize(smallestFit: number): number {
  const stepped = Math.floor(smallestFit * 2) / 2;
  return Math.min(CARD_NAME_MAX, Math.max(CARD_NAME_UNIFORM_MIN, stepped));
}

export interface CardNameScopeStore {
  /**
   * A card's own fit size (re-reported on resize / font load); `apply` draws it at a size. `group` is the
   * card's grid row (cards of one group share a size; default one group for the whole scope).
   */
  report(key: object, fit: number, apply: (size: number) => void, group?: number): void;
  remove(key: object): void;
  /** A group's current shared size (null with no cards in it). */
  size(group?: number): number | null;
}

export function createCardNameScope(): CardNameScopeStore {
  const entries = new Map<object, { fit: number; apply: (size: number) => void; group: number }>();
  const current = new Map<number, number>();
  const recompute = (group: number, reporter?: object) => {
    let min = Infinity;
    let count = 0;
    entries.forEach((e) => { if (e.group === group) { count++; min = Math.min(min, e.fit); } });
    if (!count) { current.delete(group); return; }
    const next = uniformCardNameSize(min);
    if (next !== current.get(group)) {
      current.set(group, next);
      entries.forEach((e) => { if (e.group === group) e.apply(next); });
    } else if (reporter) {
      // The shared size held: only the card that re-measured needs redrawing.
      entries.get(reporter)?.apply(next);
    }
  };
  return {
    report(key, fit, apply, group = 0) {
      const prev = entries.get(key)?.group;
      entries.set(key, { fit, apply, group });
      recompute(group, key);
      // The card moved to another row: its old row re-fits without it.
      if (prev != null && prev !== group) recompute(prev);
    },
    remove(key) {
      const group = entries.get(key)?.group;
      entries.delete(key);
      if (group != null) recompute(group);
    },
    size: (group = 0) => current.get(group) ?? null,
  };
}
