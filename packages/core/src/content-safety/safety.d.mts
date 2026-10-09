// Types for safety.mjs (see that file and docs/CONTENT-SAFETY.md).
export function normalizeWord(w: string): string;
export function tokens(text: string): string[];
export function offensiveWord(word: string): string | null;
export function offensiveText(text: string): string | null;
export function isOffensive(wordOrText: string): boolean;
export function britishWord(word: string): string | null;
export function britishText(text: string): string | null;
export function isBritishOnly(wordOrText: string): boolean;
export function zipf(word: string): number;
export function isListedObscure(word: string): boolean;
export function isObscure(word: string, threshold?: number): boolean;
export function mustAccept(): string[];
export function isMustAccept(word: string): boolean;
export function wordProblems(word: string, opts?: { obscure?: boolean; minZipf?: number }): string[];
export function textProblems(text: string): string[];
export function mask(word: string): string;
export function leaks(text: string): string[];
