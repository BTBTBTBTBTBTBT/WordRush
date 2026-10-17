import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as gen from './gen-playbooks.mjs';
import { PLAYBOOKS } from '@/lib/admin/playbooks.generated';
import { outline, parseMarkdown, safeHref } from '@/lib/admin/markdown-lite';
import { Markdown, PlaybookView } from '@/app/admin/components/playbook-view';

const SOURCES = gen.PLAYBOOKS as Record<string, string>;
const buildPlaybooks = gen.buildPlaybooks as () => Record<'season' | 'social', { path: string; markdown: string | null; updated: string | null }>;
const html = (md: string) => renderToStaticMarkup(createElement(Markdown, { source: md }));

describe('gen-playbooks', () => {
  it('reads both playbook paths, with the season playbook included', () => {
    const built = buildPlaybooks();
    expect(Object.keys(SOURCES)).toEqual(['season', 'social']);
    expect(built.season.path).toBe('docs/design/brand/seasons/PLAYBOOK.md');
    expect(built.social.path).toBe('docs/marketing/SOCIAL-PLAYBOOK.md');
    expect(built.season.markdown).toContain('Season Playbook');
    // The social playbook is written by another agent: present => non-empty text, absent => null (friendly state).
    expect(built.social.markdown === null || built.social.markdown.length > 0).toBe(true);
  });
  it('the committed generated module exposes both entries', () => {
    expect(PLAYBOOKS.season.markdown).toContain('Season Playbook');
    expect(PLAYBOOKS.social).toHaveProperty('markdown');
  });
  it('shows a being-written state when a playbook is missing', () => {
    const out = renderToStaticMarkup(createElement(PlaybookView, { title: 'Social playbook', purpose: 'p', doc: { path: 'x.md', markdown: null, updated: null }, missing: 'Coming soon.' }));
    expect(out).toContain('being written');
    expect(out).toContain('Coming soon.');
  });
});

describe('markdown renderer', () => {
  it('escapes HTML and never injects it', () => {
    const out = html('# <script>alert(1)</script>\n\nhello <img src=x onerror=alert(1)> **<b>bold</b>** `<i>`\n\n| a | b |\n|---|---|\n| <u>x</u> | y |');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<u>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&lt;img');
  });
  it('only allows safe link targets', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('https://wordocious.com')).toBe('https://wordocious.com');
    expect(safeHref('/admin/art')).toBe('/admin/art');
    const out = html('[bad](javascript:alert(1)) [ok](https://wordocious.com)');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="https://wordocious.com"');
  });
  it('renders headings, tables in a scroll container, nested lists and a contents list', () => {
    const md = '# T\n\n## One\n\n| When | What |\n|---|---|\n| D | go |\n\n- a\n  - b\n  continued\n\n1. x\n2. y\n\n## Two\n\ntext *it* **b** `c`';
    const blocks = parseMarkdown(md);
    expect(outline(blocks)).toEqual([{ id: 'one', text: 'One' }, { id: 'two', text: 'Two' }]);
    const out = html(md);
    expect(out).toContain('overflow-x-auto');
    expect(out).toContain('<table');
    expect(out).toContain('<ol');
    expect(out).toContain('b continued');
    const full = renderToStaticMarkup(createElement(PlaybookView, { title: 'S', purpose: 'p', doc: { path: 'x.md', markdown: md, updated: '2026-10-16' }, missing: '' }));
    expect(full).toContain('href="#one"');
    expect(full).toContain('Last updated 2026-10-16');
  });
  it('renders the real season playbook without leftover markdown syntax in table cells', () => {
    const out = html(PLAYBOOKS.season.markdown!);
    expect(out).toContain('<table');
    expect(out).not.toMatch(/\*\*[A-Za-z]/);
  });
});
