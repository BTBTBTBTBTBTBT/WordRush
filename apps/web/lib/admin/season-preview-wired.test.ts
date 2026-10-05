import { describe, it, expect } from 'vitest';
import raw from './season-preview-wired.json';
import { parseWired, SEASON_PREVIEW_WIRED, seasonTitle, shippedNameOf, wiredFor } from './season-preview-wired';

const base = { type: 'seasons', kind: 'cast', season: 'halloween', status: 'shipped' as const };

describe('season-preview-wired.json', () => {
  it('parses: every entry has a where', () => {
    const map = parseWired(raw);
    expect(Object.keys(map)).toContain('halloween');
    for (const names of Object.values(map)) {
      for (const [name, e] of Object.entries(names)) {
        expect(name.trim()).not.toBe('');
        expect(e.where.length).toBeGreaterThan(3);
      }
    }
  });

  it('seeds the ten cast skins and the four day-title props', () => {
    const hw = SEASON_PREVIEW_WIRED.halloween;
    for (const id of ['w', 'r', 'd', 'i', 'c', 'u', 's', 'o1', 'o2', 'o3']) expect(hw[`art-halloween-${id}`]).toBeTruthy();
    for (const p of ['pumpkin', 'bat', 'candy', 'ghost']) expect(hw[`art-halloween-prop-${p}`]).toBeTruthy();
  });

  it('rejects a bad shape', () => {
    expect(() => parseWired([])).toThrow();
    expect(() => parseWired({ Halloween: {} })).toThrow();
    expect(() => parseWired({ halloween: { 'art-x': {} } })).toThrow();
    expect(() => parseWired({ halloween: { 'art-x': { where: ' ' } } })).toThrow();
  });
});

describe('wiredFor', () => {
  it('matches the shipped night0 files by shipped name, never the draft candidates', () => {
    expect(shippedNameOf({ ...base, path: 'seasons/halloween/cast/night0/c.png' })).toBe('art-halloween-c');
    expect(shippedNameOf({ ...base, path: 'seasons/halloween/cast/night0/props/bat.png' })).toBe('art-halloween-prop-bat');
    expect(shippedNameOf({ ...base, type: 'buttons', season: null, path: 'buttons/skins/purple-m.png' })).toBeNull();
    const live = wiredFor({ ...base, id: 'seasons/halloween/cast/night0/c', path: 'seasons/halloween/cast/night0/c.png' });
    expect(live).toMatchObject({ season: 'halloween', name: 'art-halloween-c' });
    expect(wiredFor({ ...base, id: 'seasons/halloween/cast/night0/props/candy', path: 'seasons/halloween/cast/night0/props/candy.png' })?.name).toBe('art-halloween-prop-candy');
    expect(wiredFor({ ...base, status: 'draft', id: 'seasons/halloween/cast/c', path: 'seasons/halloween/cast/c.png' })).toBeNull();
    expect(wiredFor({ ...base, kind: 'header', id: 'seasons/halloween/header/o1', path: 'seasons/halloween/header/o1.png' })?.name).toBe('art-halloween-o1');
    expect(wiredFor({ ...base, kind: 'header', status: 'draft', id: 'seasons/halloween/header/w', path: 'seasons/halloween/header/w.png' })).toBeNull();
    expect(wiredFor({ ...base, kind: 'titles', id: 'seasons/halloween/titles/w', path: 'seasons/halloween/titles/w.png' })).toBeNull();
    expect(wiredFor({ ...base, id: 'seasons/halloween/cast/night0/props/candycorn', path: 'seasons/halloween/cast/night0/props/candycorn.png' })).toBeNull();
  });

  it('works for any season with no code change', () => {
    const map = parseWired({ thanksgiving: { 'art-thanksgiving-w': { where: 'Home cast header' } } });
    expect(wiredFor({ ...base, season: 'thanksgiving', id: 'seasons/thanksgiving/cast/night0/w', path: 'seasons/thanksgiving/cast/night0/w.png' }, map))
      .toEqual({ season: 'thanksgiving', name: 'art-thanksgiving-w', where: 'Home cast header' });
    expect(seasonTitle('winter-holidays')).toBe('Winter holidays');
  });

  it('matches an asset id key whatever its status', () => {
    const map = parseWired({ halloween: { 'seasons/halloween/titles/home': { where: 'Home title' } } });
    expect(wiredFor({ ...base, status: 'draft', id: 'seasons/halloween/titles/home', path: 'seasons/halloween/titles/home.png' }, map))
      .toEqual({ season: 'halloween', name: 'seasons/halloween/titles/home', where: 'Home title' });
  });
});
