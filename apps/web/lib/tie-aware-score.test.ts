import { describe, it, expect } from 'vitest';
import { formatScore, tieAwareScoreLabels } from './composite-scoring';

// TIE-AWARE score labels — decimals appear only where two rows on the same
// board share a whole number (the Lindsay/Michael photo finish of 2026-08-08:
// 2,328.8 vs 2,328.0 both displayed "2,328" while she outranked him).

describe('tieAwareScoreLabels', () => {
  it('leaves non-colliding scores as clean integers', () => {
    const labels = tieAwareScoreLabels([2328.8, 1944.6, 1529.2]);
    expect(labels.get(2328.8)).toBe('2,328');
    expect(labels.get(1944.6)).toBe('1,944');
    expect(labels.get(1529.2)).toBe('1,529');
  });

  it('renders one decimal for a whole-number collision (the photo finish)', () => {
    const labels = tieAwareScoreLabels([2328.8, 2328.0, 1944.6]);
    expect(labels.get(2328.8)).toBe('2,328.8');
    expect(labels.get(2328.0)).toBe('2,328.0');
    expect(labels.get(1944.6)).toBe('1,944');
  });

  it('keeps a TRUE tie (identical stored scores) as integers', () => {
    const labels = tieAwareScoreLabels([2328.8, 2328.8, 1200]);
    expect(labels.get(2328.8)).toBe('2,328');
    expect(labels.get(1200)).toBe('1,200');
  });

  it('escalates to two decimals when one is not enough (OctoWord 0.08/s steps)', () => {
    // 2001.44 and 2001.36 both round to 2001.4 at one decimal.
    const labels = tieAwareScoreLabels([2001.44, 2001.36]);
    expect(labels.get(2001.44)).toBe('2,001.44');
    expect(labels.get(2001.36)).toBe('2,001.36');
  });

  it('separates collision groups independently on the same board', () => {
    const labels = tieAwareScoreLabels([2328.8, 2328.0, 2100.4, 2100.4, 1635.2]);
    expect(labels.get(2328.8)).toBe('2,328.8'); // colliding pair → decimals
    expect(labels.get(2328.0)).toBe('2,328.0');
    expect(labels.get(2100.4)).toBe('2,100');   // true tie → integer
    expect(labels.get(1635.2)).toBe('1,635');   // alone → integer
  });

  it('matches formatScore for every non-colliding value', () => {
    const scores = [2328.8, 1944.6, 1200];
    const labels = tieAwareScoreLabels(scores);
    for (const s of scores) expect(labels.get(s)).toBe(formatScore(s));
  });
});
