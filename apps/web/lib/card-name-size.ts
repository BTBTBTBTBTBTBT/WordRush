/**
 * FINISH_SPEC BJ18 (parity with Android CardNameSizeScope / iOS HomeCardSpec.uniformNameSize):
 * every card in one Home grid draws its name at ONE size — the largest (≤ 17, 0.5 steps) at
 * which the widest name fits its slot, floored at 13; a name still too wide at that size shrinks
 * on its own card as the last resort (FitName in components/home/mode-card.tsx). Each FitName
 * reports the size its own name fits at; the store applies the shared minimum to every card
 * straight on the DOM (no React re-render).
 */
export const CARD_NAME_MAX = 17;
export const CARD_NAME_UNIFORM_MIN = 13;

/** The grid's shared name size for the smallest per-card fit: ≤ 17, ≥ 13, 0.5 steps. */
export function uniformCardNameSize(smallestFit: number): number {
  const stepped = Math.floor(smallestFit * 2) / 2;
  return Math.min(CARD_NAME_MAX, Math.max(CARD_NAME_UNIFORM_MIN, stepped));
}

export interface CardNameScopeStore {
  /** A card's own fit size (re-reported on resize / font load); `apply` draws it at a size. */
  report(key: object, fit: number, apply: (size: number) => void): void;
  remove(key: object): void;
  /** The current shared size (null with no cards). */
  size(): number | null;
}

export function createCardNameScope(): CardNameScopeStore {
  const entries = new Map<object, { fit: number; apply: (size: number) => void }>();
  let current: number | null = null;
  const recompute = (reporter?: object) => {
    let min = Infinity;
    entries.forEach((e) => { min = Math.min(min, e.fit); });
    const next = entries.size ? uniformCardNameSize(min) : null;
    if (next !== current) {
      current = next;
      if (next != null) entries.forEach((e) => e.apply(next));
    } else if (reporter && next != null) {
      // The shared size held: only the card that re-measured needs redrawing.
      entries.get(reporter)?.apply(next);
    }
  };
  return {
    report(key, fit, apply) { entries.set(key, { fit, apply }); recompute(key); },
    remove(key) { entries.delete(key); recompute(); },
    size: () => current,
  };
}
