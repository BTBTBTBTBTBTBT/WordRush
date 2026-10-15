'use client';

import { Fragment, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Clapperboard, Copy, ExternalLink, Printer, Video } from 'lucide-react';
import {
  dayLabel, needsCapture, PLAN_ACCOUNT_LOG, PLAN_ANCHORS, PLAN_CHANNELS, PLAN_CHECKPOINTS, PLAN_COLLAPSE_NOTE, PLAN_COPY_PACK, PLAN_DAY_CHANNELS, PLAN_DAY_OWNER,
  PLAN_DAYS, PLAN_GUARDRAILS, PLAN_KPI_NOTE, PLAN_KPIS, PLAN_MESSAGE_HOUSE, PLAN_OBJECTIVE, PLAN_ONE_RULE, PLAN_PHASES, PLAN_PILLARS, PLAN_SERIES,
  PLAN_SETUP, PLAN_UPDATES, PLAN_VOICE, PLAN_WEEK, PLAN_WINDOW, planDay, planPhase, type PlanDay, type PlanKpi, type SetupStatus,
} from '@/lib/admin/social-plan';
import { kitDoc, LAUNCH_KIT, PRESS_ONE_PAGER_PRINTABLE, type LaunchKitDoc } from '@/lib/admin/launch-kit';

// admin > Growth > Social Studio > Plan: JP's 45-day launch plan (lib/admin/social-plan.ts), laid out to read top
// to bottom. Static; the calendar's day cards (PlanDayCard) come from the same data.

const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const range = (a: string, b: string) => `${fmtDay(a)} to ${fmtDay(b)}`;

const H2 = 'text-sm font-black uppercase tracking-wide text-gray-500';
const CARD = 'rounded-2xl bg-white shadow-sm p-3 sm:p-4';

function kpiValue(k: PlanKpi, v: number | string | null): string {
  if (v === null) return '-';
  if (typeof v === 'string') return v;
  if (k.kind === 'percent') return `${v}%`;
  return v.toLocaleString('en-US');
}

/** Pillar mix bar colors, in PLAN_PILLARS order. */
const PILLAR_TONES = ['bg-violet-500', 'bg-fuchsia-500', 'bg-sky-500', 'bg-teal-500', 'bg-orange-400', 'bg-slate-400'];

/** Setup-status chip looks. */
const STATUS_LOOK: Record<SetupStatus, { label: string; chip: string }> = {
  'done': { label: 'Done', chip: 'bg-emerald-50 text-emerald-700' },
  'in progress': { label: 'In progress', chip: 'bg-amber-50 text-amber-700' },
  'pending': { label: 'Pending', chip: 'bg-gray-100 text-gray-600' },
  'n/a': { label: 'Not needed', chip: 'bg-slate-50 text-slate-500' },
};

function CopyButton({ id, text, label, copied, onCopy }: { id: string; text: string; label: string; copied: string | null; onCopy: (id: string, text: string) => void }) {
  return (
    <button
      onClick={() => onCopy(id, text)}
      aria-label={label}
      className="shrink-0 h-9 rounded-xl bg-purple-50 px-2.5 text-xs font-extrabold text-purple-700 hover:bg-purple-100 inline-flex items-center gap-1"
    >
      {copied === id ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
    </button>
  );
}

function openPrintableOnePager() {
  const url = URL.createObjectURL(new Blob([PRESS_ONE_PAGER_PRINTABLE], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function KitDocRow({ doc, open, onToggle, copied, onCopy }: { doc: LaunchKitDoc; open: boolean; onToggle: () => void; copied: string | null; onCopy: (id: string, text: string) => void }) {
  return (
    <li id={`kit-${doc.id}`} className="py-2">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 flex items-start gap-2 text-left rounded-xl py-1 hover:bg-gray-50">
          <ChevronDown className={`mt-0.5 w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="min-w-0">
            <span className="block text-sm font-black text-gray-900">{doc.title}</span>
            <span className="block text-xs font-semibold text-gray-500 break-words">{doc.blurb}</span>
          </span>
        </button>
        {doc.setup.map((id) => <span key={id} className="hidden sm:inline shrink-0 rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-black text-purple-700">{id}</span>)}
        <CopyButton id={`kit:${doc.id}`} text={doc.markdown} label={`Copy all of ${doc.title}`} copied={copied} onCopy={onCopy} />
      </div>
      {open && (
        <div className="mt-2 ml-6 space-y-2">
          {doc.id === 'press-one-pager' && (
            <button onClick={openPrintableOnePager} className="h-9 rounded-xl bg-purple-600 px-3 text-xs font-extrabold text-white hover:bg-purple-700 inline-flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Open the printable one-pager (print to PDF)
            </button>
          )}
          {doc.intro && <p className="text-xs font-semibold text-gray-500 break-words">{doc.intro}</p>}
          <ul className="divide-y divide-gray-100 rounded-xl bg-gray-50/70 px-3">
            {doc.sections.map((sec) => (
              <li key={sec.heading} className="py-2.5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-wide text-purple-600 break-words">{sec.heading}</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-800 whitespace-pre-wrap break-words">{sec.text}</p>
                </div>
                <CopyButton id={`kit:${doc.id}:${sec.heading}`} text={sec.text} label={`Copy ${sec.heading}`} copied={copied} onCopy={onCopy} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function PlanTab({ today, onOpenDay }: { today: string; onOpenDay: (day: string) => void }) {
  const todayPlan = planDay(today);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (slot: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(slot); setTimeout(() => setCopied((c) => (c === slot ? null : c)), 1800); } catch { /* clipboard blocked */ }
  };
  const captureDays = PLAN_DAYS.filter(needsCapture).length;
  const [openDocs, setOpenDocs] = useState<ReadonlySet<string>>(new Set());
  const toggleDoc = (id: string) => setOpenDocs((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const showDoc = (id: string) => {
    setOpenDocs((cur) => new Set(cur).add(id));
    setTimeout(() => document.getElementById(`kit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const doneCount = PLAN_SETUP.filter((t) => t.status === 'done' || t.status === 'n/a').length;

  return (
    <div className="space-y-4">
      {/* ---- overview */}
      <section className={`${CARD} space-y-3`}>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-72">
            <h2 className={H2}>The 45-day plan</h2>
            <p className="mt-1 text-lg font-black text-gray-900">{PLAN_WINDOW.label}</p>
            <p className="text-xs font-bold text-gray-500">{PLAN_WINDOW.detail}</p>
          </div>
          {todayPlan ? (
            <button onClick={() => onOpenDay(today)} className="h-10 rounded-xl bg-purple-600 px-3.5 text-xs font-extrabold text-white hover:bg-purple-700 inline-flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Today: {dayLabel(todayPlan)}
            </button>
          ) : today < PLAN_WINDOW.start ? (
            <button onClick={() => onOpenDay(PLAN_WINDOW.start)} className="h-10 rounded-xl bg-purple-50 px-3.5 text-xs font-extrabold text-purple-700 hover:bg-purple-100 inline-flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Starts {fmtDay(PLAN_WINDOW.start)}
            </button>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-gray-700 break-words">{PLAN_OBJECTIVE}</p>
        <p className="text-xs font-semibold text-gray-500 break-words">{PLAN_ANCHORS}</p>
        <div className="rounded-xl bg-amber-50/70 px-3 py-2.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">Updated since JP&apos;s draft</p>
          <ul className="mt-1 space-y-1">
            {PLAN_UPDATES.map((u) => <li key={u} className="text-xs font-semibold text-amber-900 break-words">{u}</li>)}
          </ul>
        </div>
        <p className="text-[11px] font-bold text-gray-400">{PLAN_DAYS.length} days on the calendar, {captureDays} with a video that needs a capture from Brian. Click any day on the Calendar tab for its card.</p>
      </section>

      {/* ---- launch setup (live status) */}
      <section className={`${CARD} space-y-1`}>
        <h2 className={H2}>Launch setup <span className="ml-1 normal-case tracking-normal text-gray-400">{doneCount} of {PLAN_SETUP.length} settled</span></h2>
        <ul className="divide-y divide-gray-100">
          {PLAN_SETUP.map((t) => {
            const look = STATUS_LOOK[t.status];
            return (
              <li key={t.id} className="py-2.5 flex items-start gap-3" data-testid={`setup-${t.id}`}>
                <span className="w-8 shrink-0 text-xs font-black text-purple-600">{t.id}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={`text-xs font-bold break-words ${t.status === 'n/a' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.task}</p>
                  <p className="text-xs font-semibold text-gray-600 break-words">{t.note}</p>
                  {(t.links.length > 0 || (t.kit?.length ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {t.links.map((l) => (
                        <a key={l.href} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-extrabold text-purple-700 hover:bg-purple-50">
                          {l.label} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                      {t.kit?.map((id) => (
                        <button key={id} onClick={() => showDoc(id)} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-extrabold text-purple-700 hover:bg-purple-100">
                          Draft: {kitDoc(id)?.title ?? id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${look.chip}`}>{look.label}</span>
                  {t.doneOn && <span className="text-[10px] font-bold text-gray-400">{fmtDay(t.doneOn)}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${t.owner === 'JP' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>{t.owner}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className={`${H2} pt-3`}>Live account changes</h2>
        <ul className="divide-y divide-gray-100">
          {PLAN_ACCOUNT_LOG.map((c, i) => (
            <li key={`${c.date}-${i}`} className="py-1.5 flex flex-wrap gap-x-3 gap-y-0">
              <span className="w-14 shrink-0 text-[11px] font-black text-gray-400">{fmtDay(c.date)}</span>
              <span className="w-full sm:w-44 shrink-0 text-xs font-black text-gray-800 break-words">{c.channel}</span>
              <span className="min-w-0 flex-1 basis-56 text-xs font-semibold text-gray-600 break-words">{c.change}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- launch kit */}
      <section className={`${CARD} space-y-1`}>
        <h2 className={H2}>Launch kit</h2>
        <p className="text-xs font-semibold text-gray-500">
          Press, Product Hunt, founder posts and bios, drafted for JP to edit, send and post himself. Nothing here publishes.
          Copy a whole doc or any one block. The source is docs/marketing/jp45 in the repo.
        </p>
        <ul className="divide-y divide-gray-100">
          {LAUNCH_KIT.map((d) => <KitDocRow key={d.id} doc={d} open={openDocs.has(d.id)} onToggle={() => toggleDoc(d.id)} copied={copied} onCopy={copy} />)}
        </ul>
      </section>

      {/* ---- phases */}
      <section className={`${CARD} space-y-1`}>
        <h2 className={H2}>Phases</h2>
        <ul className="divide-y divide-gray-100">
          {PLAN_PHASES.map((p) => {
            const days = PLAN_DAYS.filter((d) => d.phase === p.id).length;
            return (
              <li key={p.id} className="py-3 flex flex-wrap gap-x-4 gap-y-1">
                <div className="w-full sm:w-52 shrink-0">
                  <p className="text-sm font-black text-gray-900"><span className={`mr-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] ${p.pill}`}>{p.id}</span>{p.name}</p>
                  <p className="mt-0.5 text-xs font-bold text-gray-500">{range(p.start, p.end)} · {days} days</p>
                </div>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm font-black text-purple-700 break-words">{p.theme}</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-600 break-words">{p.beats}</p>
                  <button onClick={() => onOpenDay(p.start)} className="mt-1 text-[11px] font-extrabold text-purple-600 hover:underline">Open {fmtDay(p.start)} on the calendar</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- KPIs */}
      <section className={`${CARD} space-y-2`}>
        <h2 className={H2}>Targets and actuals</h2>
        <div className="hidden md:block">
          <table className="w-full table-fixed text-left">
            <colgroup><col className="w-[28%]" />{PLAN_CHECKPOINTS.flatMap((c) => [<col key={`${c.key}t`} />, <col key={`${c.key}a`} />])}</colgroup>
            <thead>
              <tr className="text-[11px] font-black text-gray-700">
                <th rowSpan={2} className="pl-3 sm:pl-0 pr-2 pb-1 align-bottom text-[10px] font-black uppercase tracking-wide text-gray-400">Metric</th>
                {PLAN_CHECKPOINTS.map((c) => (
                  <th key={c.key} colSpan={2} className="px-2 pt-1 font-black">
                    {c.label}<span className="ml-1.5 font-bold text-gray-400">{fmtDay(c.date)}</span>
                  </th>
                ))}
              </tr>
              <tr className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                {PLAN_CHECKPOINTS.map((c) => (
                  <Fragment key={c.key}>
                    <th className="px-2 pb-1">Target</th>
                    <th className="px-2 pb-1">Actual</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PLAN_KPIS.map((k) => (
                <tr key={k.id} className="align-top">
                  <td className="pl-3 sm:pl-0 pr-2 py-2">
                    <p className="text-xs font-black text-gray-900">{k.label}</p>
                    <p className="text-[10px] font-semibold text-gray-400">{k.source}</p>
                  </td>
                  {PLAN_CHECKPOINTS.map((c) => {
                    const actual = k.actual[c.key];
                    return (
                      <Fragment key={c.key}>
                        <td className="px-2 py-2 text-xs font-black tabular-nums text-gray-900">{kpiValue(k, k.target[c.key])}</td>
                        <td className={`px-2 py-2 text-xs tabular-nums ${actual === null ? 'font-bold text-gray-300' : 'font-black text-purple-700'}`}>{kpiValue(k, actual)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="md:hidden divide-y divide-gray-100">
          {PLAN_KPIS.map((k) => (
            <li key={k.id} className="py-2.5">
              <p className="text-xs font-black text-gray-900">{k.label}</p>
              <p className="text-[10px] font-semibold text-gray-400">{k.source}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {PLAN_CHECKPOINTS.map((c) => {
                  const actual = k.actual[c.key];
                  return (
                    <div key={c.key} className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{c.label} · {fmtDay(c.date)}</p>
                      <p className="text-xs font-black text-gray-900 break-words">{kpiValue(k, k.target[c.key])}</p>
                      <p className={`text-[11px] ${actual === null ? 'font-bold text-gray-300' : 'font-black text-purple-700'}`}>Actual {kpiValue(k, actual)}</p>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs font-semibold text-gray-500 break-words">{PLAN_KPI_NOTE}</p>
      </section>

      {/* ---- one rule + message house */}
      <section className={`${CARD} space-y-3`}>
        <h2 className={H2}>The one rule</h2>
        <p className="text-sm font-black text-gray-900 break-words">{PLAN_ONE_RULE.lead}</p>
        <ol className="grid gap-2 sm:grid-cols-3">
          {PLAN_ONE_RULE.jobs.map((j, i) => (
            <li key={j} className="flex items-start gap-2 rounded-xl bg-purple-50/60 px-3 py-2">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-purple-600 text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
              <span className="text-sm font-bold text-purple-900 break-words">{j}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs font-semibold text-gray-500 break-words">{PLAN_ONE_RULE.note}</p>

        <div className="pt-1">
          <h2 className={H2}>Message house</h2>
          <p className="mt-1.5 text-xl font-black text-purple-700 break-words">{PLAN_MESSAGE_HOUSE.roof}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {PLAN_MESSAGE_HOUSE.pillars.map((p, i) => (
              <div key={p.name}>
                <p className="text-sm font-black text-gray-900">Pillar {i + 1}: {p.name}</p>
                <p className="mt-0.5 text-xs font-semibold text-gray-600 break-words">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-bold text-gray-400 break-words">Proof points: {PLAN_MESSAGE_HOUSE.proof}</p>
        </div>
      </section>

      {/* ---- voice + guardrails */}
      <section className={`${CARD} space-y-2`}>
        <h2 className={H2}>Voice and guardrails</h2>
        <ul className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
          {PLAN_VOICE.map((v) => (
            <li key={v.title}>
              <p className="text-sm font-black text-gray-900">{v.title}</p>
              <p className="text-xs font-semibold text-gray-600 break-words">{v.text}</p>
            </li>
          ))}
          {PLAN_GUARDRAILS.map((g) => (
            <li key={g.area}>
              <p className="text-sm font-black text-gray-900">{g.area}</p>
              <p className="text-xs font-semibold text-gray-600 break-words">{g.rule}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- channels */}
      <section className={`${CARD} space-y-1`}>
        <h2 className={H2}>Channels</h2>
        <ul className="divide-y divide-gray-100">
          {PLAN_CHANNELS.map((c) => (
            <li key={c.channel} className="py-2.5 flex flex-wrap gap-x-4 gap-y-0.5">
              <div className="w-full sm:w-48 shrink-0">
                <p className="text-sm font-black text-gray-900">{c.channel}</p>
                <p className="text-xs font-bold text-purple-600 break-words">{c.handle}</p>
              </div>
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-xs font-bold text-gray-800 break-words">{c.role}</p>
                <p className="text-xs font-semibold text-gray-500 break-words">{c.formats}</p>
              </div>
              <div className="w-full sm:w-44 shrink-0">
                <p className="text-xs font-black text-gray-800">{c.cadence}</p>
                <p className="text-[11px] font-bold text-gray-400">{c.dropOrder}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs font-semibold text-gray-500 break-words">{PLAN_COLLAPSE_NOTE}</p>
      </section>

      {/* ---- pillars + week */}
      <section className={`${CARD} space-y-3`}>
        <h2 className={H2}>Content mix</h2>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label={PLAN_PILLARS.map((p) => `${p.name} ${p.share} percent`).join(', ')}>
          {PLAN_PILLARS.map((p, i) => <span key={p.id} className={PILLAR_TONES[i]} style={{ width: `${p.share}%` }} title={`${p.name} ${p.share}%`} />)}
        </div>
        <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {PLAN_PILLARS.map((p, i) => (
            <li key={p.id} className="flex items-start gap-2">
              <span className={`mt-1 w-2.5 h-2.5 shrink-0 rounded-full ${PILLAR_TONES[i]}`} />
              <span className="min-w-0 text-xs font-semibold text-gray-600 break-words"><b className="font-black text-gray-900">{p.share}% {p.name}.</b> {p.text}</span>
            </li>
          ))}
        </ul>

        <h2 className={`${H2} pt-1`}>Weekly skeleton (repeats all 45 days)</h2>
        <ul className="divide-y divide-gray-100">
          {PLAN_WEEK.map((w) => (
            <li key={w.day} className="py-2 flex flex-wrap gap-x-4 gap-y-0.5">
              <p className="w-full sm:w-24 shrink-0 text-sm font-black text-gray-900">{w.day}</p>
              <p className="min-w-0 flex-1 basis-56 text-xs font-semibold text-gray-700 break-words">{w.ritual}</p>
              <p className="min-w-0 flex-1 basis-56 text-xs font-semibold text-gray-500 break-words">{w.production}</p>
            </li>
          ))}
        </ul>

        <h2 className={`${H2} pt-1`}>Recurring series</h2>
        <ul className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
          {PLAN_SERIES.map((s) => (
            <li key={s.name}>
              <p className="text-sm font-black text-gray-900">{s.name}</p>
              <p className="text-xs font-semibold text-gray-600 break-words">{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- copy pack */}
      <section className={`${CARD} space-y-1`}>
        <h2 className={H2}>Launch copy pack (ready to post)</h2>
        <p className="text-xs font-semibold text-gray-500">Links always carry the channel&apos;s attribution parameter.</p>
        <ul className="divide-y divide-gray-100">
          {PLAN_COPY_PACK.map((c) => (
            <li key={c.slot} className="py-2.5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-wide text-purple-600">{c.slot}</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-800 break-words">{c.copy}</p>
              </div>
              <button
                onClick={() => copy(c.slot, c.copy)}
                aria-label={`Copy ${c.slot}`}
                className="shrink-0 h-9 rounded-xl bg-purple-50 px-2.5 text-xs font-extrabold text-purple-700 hover:bg-purple-100 inline-flex items-center gap-1"
              >
                {copied === c.slot ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** JP's card for one calendar day: shown above that day's posts when the day is selected. */
export function PlanDayCard({ day, onOpenPlan }: { day: PlanDay; onOpenPlan: () => void }) {
  const phase = planPhase(day.phase);
  const capture = needsCapture(day);
  return (
    <div className="rounded-2xl bg-white shadow-sm p-3 sm:p-4 space-y-3" data-testid="jp-day-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-black ${phase.pill}`}>{phase.id} {phase.name}</span>
        <span className="text-xs font-black text-gray-500">{dayLabel(day)} of JP&apos;s plan</span>
        {capture && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-800">
            <Video className="w-3 h-3" /> Needs capture (Brian)
          </span>
        )}
        <button onClick={onOpenPlan} className="ml-auto text-[11px] font-extrabold text-purple-600 hover:underline">Open the plan</button>
      </div>
      <p className="text-base sm:text-lg font-black text-gray-900 break-words">{day.beat}</p>

      <dl className="divide-y divide-gray-100">
        {PLAN_DAY_CHANNELS.map((c) => {
          const text = day[c.key];
          return (
            <div key={c.key} className="py-1.5 flex flex-wrap gap-x-3 gap-y-0">
              <dt className="w-full sm:w-52 shrink-0 text-[11px] font-black uppercase tracking-wide text-gray-400">{c.label}</dt>
              <dd className={`min-w-0 flex-1 basis-48 text-sm break-words ${text ? 'font-bold text-gray-800' : 'font-semibold text-gray-300'}`}>{text || 'Nothing planned'}</dd>
            </div>
          );
        })}
      </dl>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-black uppercase tracking-wide text-gray-400">Community and press</dt>
          <dd className="text-xs font-bold text-gray-800 break-words">{day.community || 'None'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase tracking-wide text-gray-400">Call to action</dt>
          <dd className="text-xs font-bold text-gray-800 break-words">{day.cta}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase tracking-wide text-gray-400">Asset source</dt>
          <dd className="text-xs font-bold text-gray-800 break-words">{day.asset}</dd>
        </div>
      </dl>
      <p className="flex items-start gap-1.5 text-[11px] font-semibold text-gray-400 break-words">
        <Clapperboard className="w-3.5 h-3.5 shrink-0 mt-px" /> {PLAN_DAY_OWNER}
      </p>
    </div>
  );
}
