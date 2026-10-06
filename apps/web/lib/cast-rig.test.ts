import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { evaluateRig, gestureSeconds, kfVal, rigLayers, type RigBundle } from './cast-rig';

// The cast puppets: the three platforms read the SAME rig data and must draw the same
// frames. ship-rigs.py writes one bundle for web, iOS and Android plus golden draw ops
// from its reference evaluator; CastRigTests.swift and CastRigTest.kt check the same file.

const REPO = path.resolve(__dirname, '../../..');
const WEB = path.join(REPO, 'apps/web/public/art/rig/cast-rigs.json');
const IOS = path.join(REPO, 'apps/ios/Wordocious/Resources/Assets.xcassets/cast-rigs.dataset/cast-rigs.json');
const DROID = path.join(REPO, 'apps/android/app/src/main/res/raw/cast_rigs.json');
const GOLDEN = path.join(REPO, 'docs/design/brand/animation/rig-engine/rig-golden.json');

const bundle = JSON.parse(readFileSync(WEB, 'utf8')) as RigBundle;

describe('cast puppet rigs', () => {
  it('ships the identical bundle to web, iOS and Android', () => {
    const web = readFileSync(WEB, 'utf8');
    expect(readFileSync(IOS, 'utf8')).toBe(web);
    expect(readFileSync(DROID, 'utf8')).toBe(web);
  });

  it('ships every layer image on all three platforms', () => {
    const keep = readFileSync(path.join(REPO, 'apps/android/app/src/main/res/raw/keep_rigs.xml'), 'utf8');
    for (const id of bundle.cast) {
      for (const layer of rigLayers(bundle.rigs[id])) {
        expect(existsSync(path.join(REPO, `apps/web/public/art/rig/${id}-${layer}.webp`)), `${id}/${layer} web`).toBe(true);
        const dn = `rig_${id}_${layer}`.replace(/-/g, '_');
        expect(existsSync(path.join(REPO, `apps/android/app/src/main/res/drawable-nodpi/${dn}.webp`)), `${id}/${layer} android`).toBe(true);
        expect(keep).toContain(`@drawable/${dn}`);
        expect(existsSync(path.join(REPO, `apps/ios/Wordocious/Resources/Assets.xcassets/rig-${id}-${layer}.imageset/rig-${id}-${layer}.png`)), `${id}/${layer} ios`).toBe(true);
      }
    }
  });

  it('has all ten cast members with a signature move', () => {
    expect(bundle.cast).toEqual(['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']);
    for (const id of bundle.cast) expect(gestureSeconds(bundle.rigs[id])).toBeGreaterThan(1);
  });

  it('never shows two half-transparent faces while the laugh fades', () => {
    const w = bundle.rigs.w;
    const mid = evaluateRig(bundle, w, 1.31, null, 0.075, false); // mid fade-in, mid blink
    const lids = mid.filter((o) => o.layer.startsWith('eyes-') && o.layer !== 'eyes-happy');
    expect(lids.every((o) => o.alpha === 1)).toBe(true);
    const happy = mid.findIndex((o) => o.layer === 'eyes-happy');
    expect(happy).toBeGreaterThan(mid.findIndex((o) => o.layer === lids[0]?.layer));
    const r = evaluateRig(bundle, bundle.rigs.r, 2, null, 0.075, false);
    expect(r.find((o) => o.layer === 'mouth')?.alpha).toBe(1);
    expect(evaluateRig(bundle, bundle.rigs.r, 2, null, 0.5, false).find((o) => o.layer === 'mouth')).toBeUndefined();
  });

  it('holds the rest pose with ambient off (no breathing or idle sways)', () => {
    const a = evaluateRig(bundle, bundle.rigs.w, 0.5, null, null, false, true, false);
    const b = evaluateRig(bundle, bundle.rigs.w, 2.2, null, null, false, true, false);
    expect(a).toEqual(b);
  });

  it('eases the laugh face in and out (no hard swap)', () => {
    expect(kfVal(bundle.tap.laugh, 0)).toBe(0);
    expect(kfVal(bundle.tap.laugh, 0.075)).toBeGreaterThan(0.2);
    expect(kfVal(bundle.tap.laugh, 0.075)).toBeLessThan(0.8);
    expect(kfVal(bundle.tap.laugh, 0.5)).toBe(1);
    expect(kfVal(bundle.tap.laugh, 0.9)).toBeLessThan(1);
    expect(kfVal(bundle.tap.laugh, 0.99)).toBe(0);
  });

  it('matches the reference evaluator draw ops (golden frames)', () => {
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as { id: string; t: number; g: number | null; tap: number | null; still: boolean; ambient: boolean; ops: [string, number[], number][] }[];
    expect(golden.length).toBeGreaterThan(90);
    expect(golden.some((f) => !f.ambient)).toBe(true);
    for (const f of golden) {
      const ops = evaluateRig(bundle, bundle.rigs[f.id], f.t, f.g, f.tap, f.still, true, f.ambient);
      const where = `${f.id} t=${f.t} g=${f.g} tap=${f.tap} still=${f.still} ambient=${f.ambient}`;
      expect(ops.map((o) => o.layer), where).toEqual(f.ops.map((o) => o[0]));
      ops.forEach((o, i) => {
        o.m.forEach((v, k) => expect(Math.abs(v - f.ops[i][1][k]), `${where} ${o.layer} m${k}`).toBeLessThan(2e-3));
        expect(Math.abs(o.alpha - f.ops[i][2]), `${where} ${o.layer} alpha`).toBeLessThan(2e-3);
      });
    }
  });
});
