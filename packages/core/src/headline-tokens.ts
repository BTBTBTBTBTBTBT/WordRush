// FINISH_SPEC AR: live lettering for the rotating personalized headlines. A
// headline ("WARMING UP · 3 DOWN", "OLIVER LEADS TODAY'S RACE", "YOU'RE #3
// TODAY") is split into tokens so every platform styles the same pieces:
//   number → gold soft numbers ("3", "6,976", "#2", "3/8", "3:12", "85%", "3RD")
//   name   → the palette's accent gradient (the player's / a friend's name)
//   star   → the "·" separator, drawn as the tiny gold star sprite
//   text   → the main lettering (spaces included)
// Pure, so web, iOS and Android agree: the Swift and Kotlin ports assert
// against headline-tokens-fixtures.json (scripts/gen-parity-fixtures.ts).

export type HeadlineTokenKind = 'text' | 'number' | 'name' | 'star';

export interface HeadlineToken {
  kind: HeadlineTokenKind;
  text: string;
}

/** The separator that becomes the star sprite. */
export const HEADLINE_STAR = '\u00b7';

const NUMBER = /^#?\d+(?:[,.:/]\d+)*(?:%|ST|ND|RD|TH)?/i;

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_]/.test(ch);
}

/**
 * Split `text` into styled tokens. `names` are matched case-insensitively as
 * whole words (longest first); blank names are ignored. Adjacent plain text
 * merges into one token; nothing is dropped (the tokens join back to `text`).
 */
export function headlineTokens(text: string, names: readonly string[] = []): HeadlineToken[] {
  const wanted = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0))]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  const lower = text.toLowerCase();
  const out: HeadlineToken[] = [];
  const push = (kind: HeadlineTokenKind, piece: string) => {
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.text += piece;
    else out.push({ kind, text: piece });
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === HEADLINE_STAR) { push('star', ch); i += 1; continue; }
    const prev = i > 0 ? text[i - 1] : undefined;
    if (!isWordChar(prev)) {
      const name = wanted.find((n) => lower.startsWith(n.toLowerCase(), i) && !isWordChar(text[i + n.length]));
      if (name) { push('name', text.slice(i, i + name.length)); i += name.length; continue; }
      const m = NUMBER.exec(text.slice(i));
      if (m && /\d/.test(m[0]) && !/[A-Za-z]/.test(text[i + m[0].length] ?? '')) {
        push('number', m[0]); i += m[0].length; continue;
      }
    }
    push('text', ch);
    i += 1;
  }
  return out;
}
