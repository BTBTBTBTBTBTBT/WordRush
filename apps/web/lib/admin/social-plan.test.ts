import { describe, expect, it } from 'vitest';
import {
  dayLabel, needsCapture, PLAN_CHANNELS, PLAN_CHECKPOINTS, PLAN_COPY_PACK, PLAN_DAYS, PLAN_KPIS, PLAN_PHASES, PLAN_SETUP, PLAN_WINDOW, planDay,
} from './social-plan';

describe('JP social plan data', () => {
  it('has 48 unique consecutive days, Oct 13 to Nov 29 2026', () => {
    expect(PLAN_DAYS).toHaveLength(48);
    const dates = PLAN_DAYS.map((d) => d.date);
    expect(new Set(dates).size).toBe(48);
    expect(dates[0]).toBe('2026-10-13');
    expect(dates[47]).toBe('2026-11-29');
    expect(dates[0]).toBe(PLAN_WINDOW.start);
    expect(dates[47]).toBe(PLAN_WINDOW.end);
    for (let i = 1; i < dates.length; i++) {
      const gap = (Date.parse(`${dates[i]}T12:00:00Z`) - Date.parse(`${dates[i - 1]}T12:00:00Z`)) / 86_400_000;
      expect(gap).toBe(1);
    }
  });

  it('numbers launch day 1 and Nov 29 day 45', () => {
    expect(dayLabel(planDay('2026-10-16')!)).toBe('Day 1');
    expect(dayLabel(planDay('2026-11-29')!)).toBe('Day 45');
    expect(dayLabel(planDay('2026-10-13')!)).toBe('D-2');
    expect(planDay('2026-10-12')).toBeNull();
  });

  it('puts every day in a phase whose date range holds it', () => {
    for (const d of PLAN_DAYS) {
      const p = PLAN_PHASES.find((x) => x.id === d.phase)!;
      expect(p, d.date).toBeTruthy();
      expect(d.date >= p.start && d.date <= p.end, d.date).toBe(true);
      expect(d.beat.length).toBeGreaterThan(0);
    }
  });

  it('flags the video days for capture', () => {
    expect(PLAN_DAYS.filter(needsCapture)).toHaveLength(30);
  });

  it('applies the founder handle corrections', () => {
    const handle = (c: string) => PLAN_CHANNELS.find((x) => x.channel === c)!.handle;
    expect(handle('Instagram')).toBe('@playwordocious');
    expect(handle('TikTok')).toBe('@playwordocious');
    expect(handle('X')).toBe('@wordocious');
    expect(JSON.stringify([PLAN_CHANNELS, PLAN_SETUP, PLAN_COPY_PACK])).not.toContain('wordocious2');
  });

  it('carries the KPI targets with empty actuals', () => {
    expect(PLAN_KPIS).toHaveLength(8);
    expect(PLAN_CHECKPOINTS.map((c) => c.date)).toEqual(['2026-10-30', '2026-11-14', '2026-11-29']);
    expect(PLAN_KPIS.find((k) => k.id === 'installs')!.target).toEqual({ d15: 150, d30: 450, d45: 900 });
    for (const k of PLAN_KPIS) expect(k.actual).toEqual({ d15: null, d30: null, d45: null });
  });
});
