import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase-client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

import { MUSICAL_CAST_ON, NOTE_COLORS, noteColor, unlockTune } from './musical-cast';

describe('web musical cast', () => {
  it('is on in dev / test builds (off in production builds)', () => {
    expect(MUSICAL_CAST_ON).toBe(process.env.NODE_ENV !== 'production');
  });
  it('note colors cycle', () => {
    expect(noteColor(0)).toBe(NOTE_COLORS[0]);
    expect(noteColor(NOTE_COLORS.length + 1)).toBe(NOTE_COLORS[1]);
    expect(noteColor(-1)).toBe(NOTE_COLORS[NOTE_COLORS.length - 1]);
  });
  it('a guest unlocks nothing (and never throws)', async () => {
    expect(await unlockTune('tune_ode_to_joy')).toEqual([]);
  });
});
