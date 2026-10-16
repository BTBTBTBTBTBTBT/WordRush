import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// App-size policy (docs/review/app-size/REPORT.md): new art must not silently undo the installed-size savings.
//  - iOS: every raster imageset declares its actool compression-type (lossy HEVC, or lossless for the data-atlas /
//    fully-opaque exceptions). Fix: python3 scripts/ios-asset-compression.py
//  - Android: no stray PNGs in drawable-nodpi (bubble_* tint maps excepted) and no un-aliased byte-identical avatar
//    parts. Fix: python3 scripts/android-art-optimize.py
const repo = join(__dirname, '..', '..', '..');
const run = (script: string) => spawnSync('python3', [join(repo, 'scripts', script), '--check'], { encoding: 'utf8', timeout: 120_000 });

describe('app-size asset policy', () => {
  it('every iOS raster imageset declares its compression-type', () => {
    const r = run('ios-asset-compression.py');
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('Android drawable-nodpi has no stray PNGs and no un-aliased duplicate avatar parts', () => {
    const r = run('android-art-optimize.py');
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});
