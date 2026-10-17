// A small, safe markdown parser for the admin playbooks (headings, paragraphs, bold / italic / code, links, lists,
// tables, quotes, rules, fenced code). It only produces DATA; the React renderer (app/admin/components/playbook-view)
// turns text into text nodes, so nothing in a document is ever injected as HTML.

export type Inline =
  | { t: 'text'; s: string }
  | { t: 'b' | 'i'; c: Inline[] }
  | { t: 'code'; s: string }
  | { t: 'a'; href: string; c: Inline[] };

export interface ListItem { c: Inline[]; kids: Block | null }
export type Block =
  | { t: 'h'; level: 1 | 2 | 3 | 4; id: string; c: Inline[]; text: string }
  | { t: 'p'; c: Inline[] }
  | { t: 'hr' }
  | { t: 'code'; s: string }
  | { t: 'quote'; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: ListItem[] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][]; align: Array<'left' | 'center' | 'right' | null> };

/** Only plain web / mail / in-page / site links are clickable; anything else (javascript:, data:, …) stays text. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(h) ? h : null;
}

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*(?![\s*])([^*]+?)\*(?!\*)|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  const text = (s: string) => { if (s) out.push({ t: 'text', s }); };
  for (;;) {
    const m = INLINE.exec(rest);
    if (!m) { text(rest); break; }
    text(rest.slice(0, m.index));
    if (m[1] != null) out.push({ t: 'code', s: m[1] });
    else if (m[2] != null) out.push({ t: 'b', c: parseInline(m[2]) });
    else if (m[3] != null) out.push({ t: 'i', c: parseInline(m[3]) });
    else {
      const href = safeHref(m[5]);
      if (href) out.push({ t: 'a', href, c: parseInline(m[4]) });
      else text(m[4]);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export const plainText = (c: Inline[]): string =>
  c.map((n) => (n.t === 'text' || n.t === 'code' ? n.s : plainText(n.c))).join('');

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';

const splitRow = (line: string): string[] => {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((x) => x.replace(/\\\|/g, '|').trim());
};
const isSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const startsBlock = (l: string) => /^(#{1,4}\s|```|>|\s*([-*_])(\s*\2){2,}\s*$)/.test(l) || ITEM.test(l) || (l.includes('|') && l.trim().startsWith('|'));

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  const seen = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push({ t: 'code', s: buf.join('\n') });
      continue;
    }
    const h = /^(#{1,4})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const c = parseInline(h[2]);
      const base = slug(plainText(c));
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      blocks.push({ t: 'h', level: h[1].length as 1 | 2 | 3 | 4, id: n ? `${base}-${n + 1}` : base, c, text: plainText(c) });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: 'hr' }); i++; continue; }
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((s) => (s.startsWith(':') && s.endsWith(':') ? 'center' : s.endsWith(':') ? 'right' : s.startsWith(':') ? 'left' : null));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitRow(lines[i++]);
        rows.push(head.map((_, k) => parseInline(cells[k] ?? '')));
      }
      blocks.push({ t: 'table', head: head.map(parseInline), rows, align: head.map((_, k) => align[k] ?? null) });
      continue;
    }
    if (/^>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', c: parseInline(buf.join(' ').trim()) });
      continue;
    }
    if (ITEM.test(line)) {
      // Nested lists by indent. Indented / lazy continuation lines join the previous item.
      type Flat = { indent: number; ordered: boolean; text: string };
      const flat: Flat[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = ITEM.exec(l);
        // A bullet list followed by a numbered one (or the reverse) at the top level is two lists.
        if (m && flat.length && m[1].replace(/\t/g, '    ').length <= flat[0].indent && /\d/.test(m[2]) !== flat[0].ordered) break;
        if (m) { flat.push({ indent: m[1].replace(/\t/g, '    ').length, ordered: /\d/.test(m[2]), text: m[3] }); i++; continue; }
        if (!l.trim()) {
          const next = lines.slice(i + 1).find((x) => x.trim());
          if (next && ITEM.test(next)) { i++; continue; }
          break;
        }
        if (startsBlock(l)) break;
        flat[flat.length - 1].text += ` ${l.trim()}`;
        i++;
      }
      let k = 0;
      const build = (indent: number): Block => {
        const items: ListItem[] = [];
        const ordered = flat[k].ordered;
        while (k < flat.length && flat[k].indent >= indent) {
          const cur = flat[k++];
          let kids: Block | null = null;
          if (k < flat.length && flat[k].indent > cur.indent) kids = build(flat[k].indent);
          items.push({ c: parseInline(cur.text), kids });
        }
        return { t: 'list', ordered, items };
      };
      while (k < flat.length) blocks.push(build(flat[k].indent));
      continue;
    }
    // paragraph: consecutive plain lines
    const buf: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) buf.push(lines[i++].trim());
    blocks.push({ t: 'p', c: parseInline(buf.join(' ')) });
  }
  return blocks;
}

/** The H2s, for the table of contents. */
export const outline = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.t === 'h' && b.level === 2 ? [{ id: b.id, text: b.text }] : []));
