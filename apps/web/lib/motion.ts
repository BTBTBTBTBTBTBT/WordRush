// Reduce Motion, both switches (docs/FINISH_SPEC.md: "Respect Reduce Motion
// everywhere"): the OS setting and the in-app toggle (lib/theme-context.tsx
// sets [data-reduced-motion="true"] on <html>). Client-only reads.

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
