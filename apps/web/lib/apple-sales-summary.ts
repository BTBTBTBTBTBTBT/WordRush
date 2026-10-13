// Apple's daily SALES / SUMMARY report (salesReports, version 1_1), folded into a week for the admin Revenue card
// (founder 10-13). Apple only creates the SUBSCRIPTION report once a vendor has App Store subscription activity, and
// until then answers it with a misleading 400 "Invalid vendor number specified" — the card shows this instead.
//
// Product Type Identifier: 1 / 1F / 1T / F1 = first download, 3 / 3F / 3T / F3 = re-download, 7 / 7F / 7T / F7 =
// update, IA* / FI1 = in-app purchase (auto-renew IAY, non-renew IA9, consumable IA1, ...). Developer Proceeds is per
// unit, in the Currency of Proceeds.

export interface AppleSalesWeek {
  days: number;
  firstDownloads: number;
  redownloads: number;
  updates: number;
  purchases: number;
  /** Developer proceeds summed per currency ("USD" → 12.6). */
  proceeds: Record<string, number>;
}

export function emptyAppleSalesWeek(): AppleSalesWeek {
  return { days: 0, firstDownloads: 0, redownloads: 0, updates: 0, purchases: 0, proceeds: {} };
}

/** Add one day's TSV (gunzipped report body) into the running week. */
export function addAppleSalesDay(week: AppleSalesWeek, tsv: string): AppleSalesWeek {
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return week;
  const head = lines[0].split('\t');
  const col = (name: string) => head.indexOf(name);
  const iType = col('Product Type Identifier');
  const iUnits = col('Units');
  const iProceeds = col('Developer Proceeds');
  const iCurrency = col('Currency of Proceeds');
  const out: AppleSalesWeek = { ...week, days: week.days + 1, proceeds: { ...week.proceeds } };
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    const type = (c[iType] ?? '').trim().toUpperCase();
    const units = Number(c[iUnits]) || 0;
    if (/^(1|1F|1T|F1)$/.test(type)) out.firstDownloads += units;
    else if (/^(3|3F|3T|F3)$/.test(type)) out.redownloads += units;
    else if (/^(7|7F|7T|F7)$/.test(type)) out.updates += units;
    else if (/^(IA|FI)/.test(type)) {
      out.purchases += units;
      const proceeds = (Number(c[iProceeds]) || 0) * units;
      const cur = (c[iCurrency] ?? '').trim() || 'USD';
      if (proceeds) out.proceeds[cur] = (out.proceeds[cur] ?? 0) + proceeds;
    }
  }
  return out;
}
