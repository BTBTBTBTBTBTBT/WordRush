// Types for gate.mjs (see that file and docs/CONTENT-SAFETY.md).
export type GateOpts = { from: string; holidayDays: Record<string, string> };
export type GateItem = { bank: string; id: string; where: string; words: string[]; accepted?: string[]; sized?: string[]; texts: string[] };
export const ALLOW: Record<string, string>;
export function allowed(key: string): boolean;
export function gateDefaults(): Promise<GateOpts>;
export function unseenEntries(bank: { daily: any[]; extra?: any[]; holiday?: Record<string, any[]> }, opts: GateOpts): { id: string; where: string; p: any }[];
export const EXTRACT: Record<string, (p: any) => { words: string[]; accepted?: string[]; sized?: string[]; texts: string[] }>;
export function bankItems(bankId: string, bank: any, opts: GateOpts): GateItem[];
export function itemProblems(items: GateItem[], opts?: { skipOffensive?: Set<string> }): { g1: string[]; g2: string[]; g7: string[]; rare: string[] };
export function gateBank(bankId: string, bank: any, opts?: GateOpts): Promise<number>;
export function wordRejects(words: string[], opts?: { obscure?: boolean; minZipf?: number }): string[];
export function textRejects(texts: string[]): string[];
