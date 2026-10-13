import { describe, expect, it } from 'vitest';
import { addAppleSalesDay, emptyAppleSalesWeek } from './apple-sales-summary';

const HEAD = ['Provider', 'Title', 'Product Type Identifier', 'Units', 'Developer Proceeds', 'Currency of Proceeds'].join('\t');
const row = (type: string, units: number, proceeds = 0, cur = 'USD') => ['APPLE', 'Wordocious', type, units, proceeds.toFixed(2), cur].join('\t');

describe('Apple sales summary week (founder 10-13: no SUBSCRIPTION report yet)', () => {
  it('sorts downloads, re-downloads, updates and purchases, and sums proceeds per currency', () => {
    let w = emptyAppleSalesWeek();
    w = addAppleSalesDay(w, [HEAD, row('1', 1), row('7', 10), row('7', 1, 0, 'CAD'), row('3', 2), row('IAY', 2, 2.79), row('1F', 3)].join('\n'));
    w = addAppleSalesDay(w, [HEAD, row('IA9', 1, 1.5, 'EUR'), row('F7', 4)].join('\n'));
    expect(w).toEqual({ days: 2, firstDownloads: 4, redownloads: 2, updates: 15, purchases: 3, proceeds: { USD: 5.58, EUR: 1.5 } });
  });
  it('ignores an empty body', () => {
    expect(addAppleSalesDay(emptyAppleSalesWeek(), '')).toEqual(emptyAppleSalesWeek());
  });
});
