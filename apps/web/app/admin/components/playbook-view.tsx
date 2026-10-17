import React, { createElement, Fragment } from 'react';
import { BookOpen, Hourglass } from 'lucide-react';
import { outline, parseMarkdown, type Block, type Inline } from '@/lib/admin/markdown-lite';
import type { PlaybookDoc } from '@/lib/admin/playbooks.generated';

// The admin portal's playbook reader: title, one-line purpose, last-updated date, a contents list from the H2s,
// then the document. The markdown is baked in at BUILD time (lib/admin/playbooks.generated.ts); every string below
// renders as a React text node, so nothing in a document can inject HTML.

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function Inlines({ c }: { c: Inline[] }): JSX.Element {
  return (
    <>
      {c.map((n, i) => {
        switch (n.t) {
          case 'text': return <Fragment key={i}>{n.s}</Fragment>;
          case 'b': return <strong key={i} className="font-extrabold text-gray-900"><Inlines c={n.c} /></strong>;
          case 'i': return <em key={i}><Inlines c={n.c} /></em>;
          case 'code': return <code key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] font-semibold text-gray-800 break-words">{n.s}</code>;
          case 'a': {
            const external = /^https?:/i.test(n.href);
            return (
              <a key={i} href={n.href} className="font-bold text-purple-700 underline decoration-purple-300 underline-offset-2" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <Inlines c={n.c} />
              </a>
            );
          }
        }
      })}
    </>
  );
}

const HEADING = {
  1: 'text-xl font-black text-gray-900 mt-8',
  2: 'text-lg font-black text-gray-900 mt-10',
  3: 'text-base font-extrabold text-purple-800 mt-6',
  4: 'text-sm font-extrabold text-gray-700 mt-4',
} as const;

function Blocks({ blocks, nested = false }: { blocks: Block[]; nested?: boolean }): JSX.Element {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h':
            return createElement(`h${b.level + 1}`, { key: i, id: b.id, className: `${HEADING[b.level]} scroll-mt-20 first:mt-0` }, <Inlines c={b.c} />);
          case 'p': return <p key={i} className="mt-3 text-sm leading-relaxed font-medium text-gray-700 break-words"><Inlines c={b.c} /></p>;
          case 'hr': return <div key={i} className="my-6 h-1 rounded-full bg-gray-100" role="separator" />;
          case 'code': return <pre key={i} className="mt-3 overflow-x-auto rounded-xl bg-gray-100 p-3 text-xs leading-relaxed font-mono text-gray-800">{b.s}</pre>;
          case 'quote': return <p key={i} className="mt-3 rounded-xl bg-purple-50 px-4 py-3 text-sm leading-relaxed font-semibold text-purple-900"><Inlines c={b.c} /></p>;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={`${nested ? 'mt-1.5' : 'mt-3'} space-y-1.5 pl-5 text-sm leading-relaxed font-medium text-gray-700 ${b.ordered ? 'list-decimal marker:font-extrabold marker:text-purple-600' : 'list-disc marker:text-purple-400'}`}>
                {b.items.map((it, k) => (
                  <li key={k} className="break-words pl-1">
                    <Inlines c={it.c} />
                    {it.kids && <Blocks blocks={[it.kids]} nested />}
                  </li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              // The table scrolls inside its own container; the page itself never scrolls sideways.
              <div key={i} className="mt-3 max-w-full overflow-x-auto rounded-xl bg-gray-50">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-purple-50">
                      {b.head.map((h, k) => (
                        <th key={k} className={`px-3 py-2 align-bottom text-xs font-extrabold uppercase tracking-wide text-purple-800 whitespace-nowrap ${ALIGN[b.align[k] ?? 'left']}`}><Inlines c={h} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} className={ri % 2 ? 'bg-white/60' : ''}>
                        {r.map((cell, k) => (
                          <td key={k} className={`px-3 py-2 align-top font-medium leading-relaxed text-gray-700 ${k === 0 ? 'whitespace-nowrap font-extrabold text-gray-900' : 'min-w-[14rem]'} ${ALIGN[b.align[k] ?? 'left']}`}><Inlines c={cell} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

/** The document body only (no header, no contents). Exported so tests can check escaping. */
export function Markdown({ source }: { source: string }) {
  return <Blocks blocks={parseMarkdown(source)} />;
}

export function PlaybookView({ title, purpose, doc, missing }: { title: string; purpose: string; doc: PlaybookDoc; missing: string }) {
  const blocks = doc.markdown ? parseMarkdown(doc.markdown) : null;
  // The doc's own H1 repeats the title above, so it is dropped here; its text becomes the subtitle.
  const first = blocks?.[0];
  const subtitle = first && first.t === 'h' && first.level === 1 ? first.text : null;
  const body = blocks && subtitle ? blocks.slice(1) : blocks;
  const toc = body ? outline(body) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-purple-600 p-5 text-white shadow-sm">
        <p className="flex items-center gap-2 text-xl font-black"><BookOpen className="h-6 w-6 shrink-0" /> {title}</p>
        <p className="mt-1.5 max-w-3xl text-sm font-semibold text-purple-100">{purpose}</p>
        {subtitle && <p className="mt-1 max-w-3xl text-xs font-semibold text-purple-200">{subtitle}</p>}
        <p className="mt-3 text-xs font-extrabold text-purple-100">
          {doc.updated ? `Last updated ${doc.updated}` : 'Last updated date unavailable'}
          <span className="font-mono font-semibold text-purple-200"> · {doc.path}</span>
        </p>
      </div>

      {!body ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Hourglass className="mx-auto h-8 w-8 text-purple-400" />
          <p className="mt-3 text-base font-black text-gray-900">This playbook is being written</p>
          <p className="mx-auto mt-1 max-w-md text-sm font-medium text-gray-500">{missing}</p>
        </div>
      ) : (
        <>
          {toc.length > 1 && (
            <nav aria-label="Contents" className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Contents</p>
              <ol className="mt-2 flex flex-wrap gap-2">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="inline-block rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-extrabold text-purple-700 hover:bg-purple-100">{t.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <article className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
            <Blocks blocks={body} />
          </article>
        </>
      )}
    </div>
  );
}
