import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { kitDoc, LAUNCH_KIT, PRESS_ONE_PAGER_PRINTABLE } from './launch-kit';
import { PLAN_ACCOUNT_LOG, PLAN_SETUP } from './social-plan';

const DOCS = path.resolve(__dirname, '../../../../docs/marketing/jp45');

describe('JP launch kit', () => {
  it('generated file matches the markdown in docs/marketing/jp45', () => {
    const script = path.resolve(__dirname, '../../scripts/launch-kit-gen.mjs');
    expect(() => execFileSync('node', [script, '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('has the six docs with sections and a blurb', () => {
    expect(LAUNCH_KIT.map((d) => d.id)).toEqual(['press-one-pager', 'press-list', 'press-emails', 'product-hunt', 'founder-posts', 'bios']);
    for (const d of LAUNCH_KIT) {
      expect(d.sections.length, d.id).toBeGreaterThan(2);
      expect(d.blurb.length, d.id).toBeGreaterThan(10);
    }
    expect(PRESS_ONE_PAGER_PRINTABLE).toContain('jp@pattersonlp.com');
  });

  it('lists 15 press targets', () => {
    const list = kitDoc('press-list')!;
    expect(list.sections.filter((s) => /^\d+\. /.test(s.heading))).toHaveLength(15);
  });

  it('keeps Product Hunt copy inside the limits', () => {
    const ph = kitDoc('product-hunt')!;
    const tagline = ph.sections.find((s) => s.heading.startsWith('Tagline'))!.text;
    const description = ph.sections.find((s) => s.heading.startsWith('Description'))!.text;
    expect(tagline.length).toBeLessThanOrEqual(60);
    expect(description.length).toBeLessThanOrEqual(260);
  });

  it('gives every channel bio a tracked /go link and a fitting length', () => {
    const bios = kitDoc('bios')!.markdown;
    for (const slug of ['x', 'instagram', 'tiktok', 'facebook', 'pinterest', 'threads', 'youtube', 'reddit', 'linkedin', 'producthunt', 'press']) {
      expect(bios, slug).toContain(`https://wordocious.com/go/${slug}\n`);
    }
    const counts = [...bios.matchAll(/(?:Bio|Intro) \((\d+) characters\): (.*)/g)];
    expect(counts.length).toBeGreaterThan(4);
    for (const m of counts) expect(m[2].length).toBe(Number(m[1]));
  });

  it('follows the brand voice in our own copy (no emoji, em dashes, competitor marks, exact prices)', () => {
    for (const f of readdirSync(DOCS).filter((n) => /\.(md|html)$/.test(n))) {
      const text = readFileSync(path.join(DOCS, f), 'utf8');
      expect(text, f).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      expect(text, f).not.toContain('—');
      if (f !== 'press-list.md') expect(text, f).not.toMatch(/wordle|new york times|\bnyt\b|connections puzzle/i);
      for (const m of text.matchAll(/\$\d[\d.]*/g)) expect(['$6.99', '$59.99', '$1'], `${f}: ${m[0]}`).toContain(m[0]);
    }
    const prices = LAUNCH_KIT.map((d) => d.markdown).join('\n');
    expect(prices).toContain('$6.99 a month');
    expect(prices).toContain('$59.99 a year');
    expect(prices).toContain('$1 day pass');
  });
});

describe('launch setup status', () => {
  it('gives S1 to S7 a status, owner, note and valid done date', () => {
    expect(PLAN_SETUP.map((t) => t.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
    for (const t of PLAN_SETUP) {
      expect(['done', 'in progress', 'pending', 'n/a']).toContain(t.status);
      expect(t.note.length, t.id).toBeGreaterThan(10);
      if (t.doneOn) expect(t.doneOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const id of t.kit ?? []) expect(kitDoc(id), `${t.id} -> ${id}`).toBeTruthy();
    }
    expect(PLAN_SETUP.find((t) => t.id === 'S1')!.status).toBe('n/a');
  });

  it('seeds the account change log newest first', () => {
    expect(PLAN_ACCOUNT_LOG.length).toBeGreaterThan(5);
    const dates = PLAN_ACCOUNT_LOG.map((c) => c.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
