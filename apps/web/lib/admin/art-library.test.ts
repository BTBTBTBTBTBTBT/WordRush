import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS, basename, facetCounts, facetLabel, filterAssets, formatBytes, groupFounderPicks, heroIdFor,
  isRaster, mediaOf, parseDecideBody, parseSignBody, sortAssets, type ArtAsset,
} from './art-library';

let n = 0;
function asset(p: Partial<ArtAsset> & { id: string }): ArtAsset {
  n += 1;
  return {
    path: `${p.id}.png`,
    type: p.id.split('/')[0],
    kind: null,
    season: null,
    character: null,
    status: 'draft',
    stage: 'final',
    title: p.id,
    caption: null,
    width: 512,
    height: 512,
    mime: 'image/png',
    bytes: 1000,
    sha256: 'x',
    created_at: `2026-10-0${(n % 9) + 1}T00:00:00Z`,
    updated_at: '2026-10-01T00:00:00Z',
    decided_by: null,
    decided_at: null,
    note: null,
    ...p,
  };
}

const LIB: ArtAsset[] = [
  asset({ id: 'characters/hero/w', character: 'w', title: 'W hero', created_at: '2026-10-01T00:00:00Z' }),
  asset({ id: 'characters/hero/r', character: 'r', title: 'R hero', created_at: '2026-10-02T00:00:00Z' }),
  asset({ id: 'seasons/halloween/cast/w-alt1', season: 'halloween', character: 'w', kind: 'cast', title: 'W vampire', caption: 'Cape and fangs', status: 'approved', decided_at: '2026-10-04T00:00:00Z', created_at: '2026-10-03T00:00:00Z' }),
  asset({ id: 'seasons/halloween/cast/r-alt1', season: 'halloween', character: 'r', kind: 'cast', title: 'R pumpkin', status: 'rejected', created_at: '2026-10-04T00:00:00Z' }),
  asset({ id: 'seasons/winter-holidays/props/tree', season: 'winter-holidays', kind: 'props', title: 'Tree', status: 'approved', decided_at: '2026-10-05T00:00:00Z', created_at: '2026-10-05T00:00:00Z' }),
  asset({ id: 'animation/cast', path: 'animation/cast.html', mime: 'text/html', title: 'Cast player', width: null, height: null, created_at: '2026-10-06T00:00:00Z' }),
  asset({ id: 'animation/w/layers/arm', kind: 'layers', stage: 'working', title: 'Arm', created_at: '2026-10-07T00:00:00Z' }),
  asset({ id: 'sounds/tap', path: 'sounds/tap.m4a', mime: 'audio/mp4', title: 'Tap', status: 'shipped', created_at: '2026-10-06T00:00:00Z' }),
];

describe('filterAssets', () => {
  it('passes everything with no filters', () => {
    expect(filterAssets(LIB, EMPTY_FILTERS)).toHaveLength(LIB.length - 1); // the one working file is hidden
  });
  it('ANDs facet filters', () => {
    const out = filterAssets(LIB, { ...EMPTY_FILTERS, season: 'halloween', character: 'w' });
    expect(out.map((a) => a.id)).toEqual(['seasons/halloween/cast/w-alt1']);
  });
  it('searches title, caption, path and id, case-insensitively', () => {
    expect(filterAssets(LIB, { ...EMPTY_FILTERS, q: 'FANGS' }).map((a) => a.id)).toEqual(['seasons/halloween/cast/w-alt1']);
    expect(filterAssets(LIB, { ...EMPTY_FILTERS, q: '.m4a' }).map((a) => a.id)).toEqual(['sounds/tap']);
    expect(filterAssets(LIB, { ...EMPTY_FILTERS, q: 'winter-holidays/props' })).toHaveLength(1);
    expect(filterAssets(LIB, { ...EMPTY_FILTERS, q: '   ' })).toHaveLength(LIB.length - 1);
  });
});

describe('facetCounts', () => {
  it('counts a facet against the other filters only', () => {
    const f = { ...EMPTY_FILTERS, type: 'seasons' };
    // The type facet ignores its own selection: every type is still listed.
    expect(facetCounts(LIB, f, 'type').map((c) => c.value).sort()).toEqual(['animation', 'characters', 'seasons', 'sounds']);
    // Season counts respect type = seasons.
    expect(facetCounts(LIB, f, 'season')).toEqual([{ value: 'halloween', count: 2 }, { value: 'winter-holidays', count: 1 }]);
    // Character counts within seasons: only the two costumes.
    expect(facetCounts(LIB, f, 'character')).toEqual([{ value: 'r', count: 1 }, { value: 'w', count: 1 }]);
  });
  it('keeps statuses in their fixed order', () => {
    expect(facetCounts(LIB, EMPTY_FILTERS, 'status').map((c) => c.value)).toEqual(['draft', 'approved', 'rejected', 'shipped']);
  });
  it('keeps a selected value at zero so its chip can be turned off', () => {
    const f = { ...EMPTY_FILTERS, season: 'halloween', q: 'tree' };
    expect(facetCounts(LIB, f, 'season')).toEqual([{ value: 'winter-holidays', count: 1 }, { value: 'halloween', count: 0 }]);
  });
  it('respects the search', () => {
    expect(facetCounts(LIB, { ...EMPTY_FILTERS, q: 'hero' }, 'type')).toEqual([{ value: 'characters', count: 2 }]);
  });
});

describe('working files', () => {
  it('are hidden by default and counted only when shown', () => {
    expect(filterAssets(LIB, EMPTY_FILTERS).some((a) => a.stage === 'working')).toBe(false);
    expect(filterAssets(LIB, { ...EMPTY_FILTERS, working: true })).toHaveLength(LIB.length);
    expect(facetCounts(LIB, EMPTY_FILTERS, 'type').find((c) => c.value === 'animation')?.count).toBe(1);
    expect(facetCounts(LIB, { ...EMPTY_FILTERS, working: true }, 'type').find((c) => c.value === 'animation')?.count).toBe(2);
  });
});

describe('sortAssets', () => {
  it('featured: approved then draft season art (next season first), then newest finished pieces, working last', () => {
    const ids = sortAssets(LIB, 'featured').map((a) => a.id);
    expect(ids[0]).toBe('seasons/halloween/cast/w-alt1');
    expect(ids[1]).toBe('seasons/winter-holidays/props/tree');
    expect(ids[ids.length - 1]).toBe('animation/w/layers/arm');
  });
  it('newest first, ties by id', () => {
    const ids = sortAssets(filterAssets(LIB, EMPTY_FILTERS), 'newest').map((a) => a.id);
    expect(ids.slice(0, 2)).toEqual(['animation/cast', 'sounds/tap']);
    expect(ids[ids.length - 1]).toBe('characters/hero/w');
  });
  it('A to Z by title', () => {
    expect(sortAssets(filterAssets(LIB, EMPTY_FILTERS), 'az').map((a) => a.title)).toEqual(['Cast player', 'R hero', 'R pumpkin', 'Tap', 'Tree', 'W hero', 'W vampire']);
  });
  it('does not mutate the input', () => {
    const copy = LIB.slice();
    sortAssets(LIB, 'az');
    expect(LIB).toEqual(copy);
  });
});

describe('heroIdFor', () => {
  it('pairs a seasonal costume with its hero', () => {
    expect(heroIdFor({ season: 'halloween', character: 'o2' })).toBe('characters/hero/o2');
  });
  it('is null without both a season and a character', () => {
    expect(heroIdFor({ season: null, character: 'w' })).toBeNull();
    expect(heroIdFor({ season: 'halloween', character: null })).toBeNull();
  });
});

describe('groupFounderPicks', () => {
  it('lists approved (not shipped) assets grouped by type, newest decision first', () => {
    const extra = asset({ id: 'seasons/halloween/cast/d-alt1', season: 'halloween', character: 'd', status: 'approved', decided_at: '2026-10-06T00:00:00Z' });
    const groups = groupFounderPicks([...LIB, extra]);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('seasons');
    expect(groups[0].assets.map((a) => a.id)).toEqual([
      'seasons/halloween/cast/d-alt1',
      'seasons/winter-holidays/props/tree',
      'seasons/halloween/cast/w-alt1',
    ]);
  });
  it('is empty when nothing is approved', () => {
    expect(groupFounderPicks(LIB.filter((a) => a.status !== 'approved'))).toEqual([]);
  });
});

describe('media + formatting helpers', () => {
  it('maps mime types to what the page renders', () => {
    expect(mediaOf('image/webp')).toBe('image');
    expect(mediaOf('text/html')).toBe('html');
    expect(mediaOf('audio/wav')).toBe('audio');
    expect(mediaOf('audio/mp4')).toBe('audio');
    expect(mediaOf('application/json')).toBe('other');
    expect(isRaster('image/png')).toBe(true);
    expect(isRaster('image/svg+xml')).toBe(false);
  });
  it('formats names, sizes and labels', () => {
    expect(basename('seasons/halloween/cast/w-alt1.png')).toBe('w-alt1.png');
    expect(basename('logo.png')).toBe('logo.png');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(20480)).toBe('20 KB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
    expect(facetLabel('season', 'winter-holidays')).toBe('Winter holidays');
    expect(facetLabel('character', 'o2')).toBe('O2');
  });
});

describe('request validation', () => {
  it('accepts a sign body and dedupes ids', () => {
    expect(parseSignBody({ ids: ['a', 'a', 'b'], variant: 'thumb' })).toEqual({ ids: ['a', 'b'], variant: 'thumb' });
  });
  it('rejects bad sign bodies', () => {
    expect(parseSignBody({ ids: 'a', variant: 'thumb' })).toHaveProperty('error');
    expect(parseSignBody({ ids: ['a'], variant: 'huge' })).toHaveProperty('error');
    expect(parseSignBody({ ids: Array.from({ length: 121 }, (_, i) => `id${i}`), variant: 'full' })).toHaveProperty('error');
    expect(parseSignBody(null)).toHaveProperty('error');
  });
  it('validates decide bodies and normalizes the note', () => {
    expect(parseDecideBody({ id: 'x', status: 'approved', note: '  keep  ' })).toEqual({ id: 'x', status: 'approved', note: 'keep' });
    expect(parseDecideBody({ id: 'x', status: 'shipped' })).toEqual({ id: 'x', status: 'shipped', note: undefined });
    expect(parseDecideBody({ id: 'x', status: 'rejected', note: '' })).toEqual({ id: 'x', status: 'rejected', note: null });
    expect(parseDecideBody({ id: 'x', status: 'published' })).toHaveProperty('error');
    expect(parseDecideBody({ status: 'approved' })).toHaveProperty('error');
    expect(parseDecideBody({ id: 'x', status: 'approved', note: 5 })).toHaveProperty('error');
  });
});
