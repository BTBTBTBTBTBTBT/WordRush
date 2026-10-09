// 2.8 item 40: an axe-style accessibility check over server-rendered HTML (no DOM needed: the web tests run in node).
// It implements the handful of axe rules that matter for the new 2.8 surfaces:
//   image-alt              every <img> has an alt attribute (alt="" = decorative, fine)
//   button-name            every <button>, <a href> and [role=button] has an accessible name (aria-label, text, or an inner image alt)
//   role-img-alt           [role=img] has an aria-label
//   heading-name           [role=heading] and <h1-6> have a name (aria-label or text), unless hidden
//   aria-hidden-focus      nothing focusable lives inside an aria-hidden subtree (unless tabindex="-1")
//   aria-label-not-empty   aria-label is never blank
// Pure string in, list of violations out; the tests render the key components with react-dom/server and assert none.

export interface A11yViolation { rule: string; tag: string; detail: string }

interface Node { tag: string; attrs: Record<string, string>; children: Array<Node | string>; hidden: boolean }

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** A tiny tolerant HTML tree (React's server output is well formed). */
export function parseHtml(html: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [], hidden: false };
  const stack: Node[] = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) { stack[stack.length - 1].children.push(decode(m[5])); continue; }
    if (!m[2]) continue; // comment
    const tag = m[2].toLowerCase();
    if (m[1]) {
      // closing tag: pop to the matching open one
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const attrs = parseAttrs(m[3]);
    const parent = stack[stack.length - 1];
    const node: Node = { tag, attrs, children: [], hidden: parent.hidden || attrs['aria-hidden'] === 'true' || 'hidden' in attrs };
    parent.children.push(node);
    if (!VOID.has(tag) && !m[4]) stack.push(node);
  }
  return root;
}

function textOf(n: Node | string): string {
  if (typeof n === 'string') return n;
  if (n.attrs['aria-hidden'] === 'true') return '';
  if (n.tag === 'img') return n.attrs.alt ?? '';
  return n.children.map(textOf).join(' ');
}

/** The accessible name of a node (aria-label, else its visible text / inner image alts; sr-only text counts). */
export function accessibleName(n: Node): string {
  const label = n.attrs['aria-label'];
  if (label !== undefined) return label.trim();
  return textOf({ ...n, attrs: { ...n.attrs, 'aria-hidden': 'false' } }).replace(/\s+/g, ' ').trim();
}

const FOCUSABLE = (n: Node) =>
  n.attrs.tabindex !== '-1' && (n.tag === 'button' || n.tag === 'select' || n.tag === 'textarea' || (n.tag === 'input' && n.attrs.type !== 'hidden')
    || (n.tag === 'a' && 'href' in n.attrs) || (n.attrs.tabindex !== undefined && n.attrs.tabindex !== '-1'));

export function checkA11y(html: string): A11yViolation[] {
  const out: A11yViolation[] = [];
  const walk = (n: Node, ancestorHidden: boolean) => {
    const hidden = ancestorHidden || n.attrs['aria-hidden'] === 'true' || 'hidden' in n.attrs;
    const at = `<${n.tag}${n.attrs.class ? ` class="${n.attrs.class.slice(0, 40)}"` : ''}>`;
    if (n.attrs['aria-label'] !== undefined && !n.attrs['aria-label'].trim()) out.push({ rule: 'aria-label-not-empty', tag: at, detail: 'blank aria-label' });
    if (n.tag === 'img' && !('alt' in n.attrs)) out.push({ rule: 'image-alt', tag: at, detail: n.attrs.src ?? '' });
    if (!hidden) {
      const role = n.attrs.role;
      if (n.tag === 'button' || (n.tag === 'a' && 'href' in n.attrs) || role === 'button' || role === 'link') {
        if (!accessibleName(n)) out.push({ rule: 'button-name', tag: at, detail: 'no accessible name' });
      }
      if (role === 'img' && !(n.attrs['aria-label'] ?? '').trim()) out.push({ rule: 'role-img-alt', tag: at, detail: 'role=img without aria-label' });
      if ((role === 'heading' || /^h[1-6]$/.test(n.tag)) && !accessibleName(n)) out.push({ rule: 'heading-name', tag: at, detail: 'empty heading' });
    } else if (!ancestorHidden && FOCUSABLE(n)) {
      out.push({ rule: 'aria-hidden-focus', tag: at, detail: 'focusable element hidden from assistive tech' });
    }
    if (n.attrs['aria-hidden'] === 'true') {
      // focusable descendants of an aria-hidden node
      const scan = (c: Node | string) => {
        if (typeof c === 'string') return;
        if (FOCUSABLE(c)) out.push({ rule: 'aria-hidden-focus', tag: `<${c.tag}>`, detail: 'focusable inside aria-hidden' });
        c.children.forEach(scan);
      };
      n.children.forEach(scan);
    }
    for (const c of n.children) if (typeof c !== 'string') walk(c, hidden);
  };
  walk(parseHtml(html), false);
  return out;
}
