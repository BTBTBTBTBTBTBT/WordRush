// ============================================================
// Remote feature flags — the More Games kill switch (plan §7 + §10)
// ============================================================
// One rule, shared by the three platforms (FlagsService.swift / FlagsService.kt
// mirror `isFlagOn` 1:1, pinned by flags.test.ts on the web):
//
//   no flagKey on the mode        → on   (nothing to gate)
//   flags unknown / unreachable   → on   (the catalog's `enabled` alone decides)
//   no row for the key            → on
//   row.enabled = false           → OFF  (the kill switch)
//   row.audience = 'all'          → on
//   row.audience = 'testers'      → on for admins and testers only
//
// "Visible" for a mode is therefore catalog.enabled && isFlagOn(flagKey).
// The catalog flag is compile-time (a build without a game never shows it);
// the row is run-time (a shipped game can be hidden in seconds, and the
// public launch is `audience` → 'all' with no rebuild).

export interface AppFlag {
  key: string;
  enabled: boolean;
  audience: string; // 'all' | 'testers'
  note?: string | null;
}

/** What the resolver needs to know about the viewer. */
export interface FlagViewer {
  isAdmin: boolean;
  role: string | null;
}

export const NOBODY: FlagViewer = { isAdmin: false, role: null };

/** Admin or tester — the same set §228 exempts from ads. */
export function isTester(v: FlagViewer): boolean {
  return v.isAdmin || v.role === 'admin' || v.role === 'tester';
}

export function isFlagOn(flagKey: string | null | undefined, flags: Record<string, AppFlag> | null | undefined, viewer: FlagViewer): boolean {
  if (!flagKey) return true;
  if (!flags) return true;
  const row = flags[flagKey];
  if (!row) return true;
  if (!row.enabled) return false;
  if (row.audience === 'all') return true;
  return isTester(viewer);
}

/** Index a list of rows by key. */
export function indexFlags(rows: AppFlag[]): Record<string, AppFlag> {
  return Object.fromEntries(rows.map((r) => [r.key, r]));
}
