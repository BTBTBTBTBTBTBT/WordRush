import { describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import { SEASON_REGISTRY, seasonIntroSound, seasonNoteSound } from './season-kit';
import { SOUND_NAMES, introSound, noteSound } from './sound-map';

// Item 49: the registry's seasonal sound slots (slots.sounds) name shipped samples, so a season is data-only.
describe('seasonal sound slots', () => {
  it('halloween swaps the intro jingle and the musical-cast notes', () => {
    expect(seasonIntroSound('halloween')).toBe('intro-halloween');
    expect(seasonNoteSound('halloween', 'w')).toBe('note-h-w');
    expect(introSound(seasonIntroSound('halloween'))).toBe('intro-halloween');
    expect(noteSound('o1', seasonNoteSound('halloween', 'o1'))).toBe('note-h-o1');
  });
  it('no season, or a season without sounds, keeps the everyday ones', () => {
    expect(seasonIntroSound(null)).toBeNull();
    expect(seasonNoteSound(undefined, 'w')).toBeNull();
    expect(introSound(null)).toBe('intro');
    expect(noteSound('w', null)).toBe('note-w');
  });
  it('every sound a season names ships (web, iOS and Android)', () => {
    const root = path.resolve(__dirname, '..', '..', '..');
    const ids = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'];
    for (const s of SEASON_REGISTRY) {
      const names = [seasonIntroSound(s.id), ...ids.map((id) => seasonNoteSound(s.id, id))].filter((n): n is string => !!n);
      for (const n of names) {
        expect(SOUND_NAMES as readonly string[], `${s.id}: ${n} is in the sound map`).toContain(n);
        expect(existsSync(path.join(root, 'apps/web/public/sounds', `${n}.m4a`)), `${n} web`).toBe(true);
        expect(existsSync(path.join(root, 'apps/ios/Wordocious/Resources/Sounds', `sfx-${n}.m4a`)), `${n} iOS`).toBe(true);
        expect(existsSync(path.join(root, 'apps/android/app/src/main/res/raw', `sfx_${n.replace(/-/g, '_')}.m4a`)), `${n} Android`).toBe(true);
      }
    }
  });
});
