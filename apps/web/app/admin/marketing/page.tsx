'use client';

import { useEffect, useState } from 'react';
import {
  Megaphone, Link2, Users, BellRing, Gift, Share2, Search, AtSign,
  ExternalLink, Copy, Check, CircleDashed, CircleCheck,
} from 'lucide-react';

interface MarketingLink {
  slug: string;
  channel: string;
  target: string;
  clicks: number;
  signups: number;
}

interface MarketingData {
  links: MarketingLink[];
  signupsBySource: Record<string, number>;
  attributedSignups: number;
  pushDevices: number;
  referralsRedeemed: number;
  shares30d: number;
  invites30d: number;
}

/**
 * The anti-sprawl ledger: every social account records its handle, owning
 * login, and state the day it's born. Hand-maintained on purpose — this list
 * IS the source of truth for "what exists and who owns it", and it changes a
 * few times a year, not per-request.
 */
const SOCIAL_REGISTRY: {
  platform: string;
  handle: string;
  url: string | null;
  owner: string;
  status: 'live' | 'pending';
  note?: string;
}[] = [
  { platform: 'X', handle: '@wordocious', url: 'https://x.com/wordocious', owner: 'bt@wordocious.com', status: 'live' },
  { platform: 'TikTok', handle: '@wordocious2', url: 'https://tiktok.com/@wordocious2', owner: 'bt@wordocious.com', status: 'live', note: '@wordocious rename: retry ~Aug 30' },
  { platform: 'Instagram', handle: '@wordocious2', url: 'https://instagram.com/wordocious2', owner: 'bt@wordocious.com', status: 'live', note: '@wordocious reserved — ownership test pending' },
  { platform: 'Facebook', handle: 'Wordocious (Page)', url: 'https://facebook.com/profile.php?id=61592604427791', owner: 'Brian (admin)', status: 'live' },
  { platform: 'Pinterest', handle: 'bt3518 → wordocious', url: 'https://pinterest.com/bt3518', owner: 'bt@wordocious.com', status: 'live', note: 'username rename blocked on new account — retry' },
  { platform: 'Threads', handle: '@wordocious2', url: null, owner: 'via Instagram', status: 'pending', note: 'auto-claims on first Threads sign-in' },
  { platform: 'Reddit', handle: 'u/wordocious', url: null, owner: 'bt@wordocious.com', status: 'pending', note: 'create via phone app account switcher' },
  { platform: 'YouTube', handle: '@wordocious', url: null, owner: 'TBD (Google account)', status: 'pending' },
];

export default function AdminMarketingPage() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/marketing')
      .then((r) => r.json())
      .then((d) => setData(d.links ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`https://wordocious.com/go/${slug}`).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400 font-bold">Loading marketing…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-violet-600" /> Marketing
        </h1>
        <p className="text-sm text-gray-500 font-semibold mt-1">
          Every channel that can bring a player in, and whether it actually did.
        </p>
      </div>

      {/* Channel scoreboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard icon={Users} label="Attributed signups" value={data?.attributedSignups ?? 0}
          sub="via /go links, first-touch" />
        <ScoreCard icon={BellRing} label="Push reach" value={data?.pushDevices ?? 0}
          sub="devices opted in" />
        <ScoreCard icon={Gift} label="Referrals redeemed" value={data?.referralsRedeemed ?? 0}
          sub="7-day trials claimed" />
        <ScoreCard icon={Share2} label="Shares (30d)" value={data?.shares30d ?? 0}
          sub={`${data?.invites30d ?? 0} invite links sent`} />
      </div>

      {/* Link builder & attribution — LIVE */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionTitle icon={Link2} title="Links & attribution" badge="LIVE" badgeClass="bg-green-50 text-green-700" />
        <p className="text-xs text-gray-500 font-semibold mb-3">
          Clicks count on redirect; any brand-new account within 30 days of a click is credited to
          its channel (first touch wins). Put these in bios once — retarget them later without
          reprinting anything.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-100">
              <th className="py-2 pr-2">LINK</th>
              <th className="py-2 pr-2">CHANNEL</th>
              <th className="py-2 pr-2 text-right">CLICKS</th>
              <th className="py-2 pr-2 text-right">SIGNUPS</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(data?.links ?? []).map((l) => (
              <tr key={l.slug} className="border-b border-gray-50">
                <td className="py-2 pr-2 font-mono text-xs text-violet-700">wordocious.com/go/{l.slug}</td>
                <td className="py-2 pr-2 font-bold text-gray-700 capitalize">{l.channel}</td>
                <td className="py-2 pr-2 text-right font-black tabular-nums">{l.clicks}</td>
                <td className="py-2 pr-2 text-right font-black tabular-nums">{l.signups}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => copyLink(l.slug)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-violet-700"
                    title="Copy link"
                  >
                    {copied === l.slug
                      ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </td>
              </tr>
            ))}
            {(data?.links ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400 font-semibold">
                No marketing links yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Social account registry */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionTitle icon={AtSign} title="Social account registry" />
        <p className="text-xs text-gray-500 font-semibold mb-3">
          The anti-sprawl ledger: every account, its owning login, and its state. Bios all point at
          the /go link for their channel.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-100">
              <th className="py-2 pr-2">PLATFORM</th>
              <th className="py-2 pr-2">HANDLE</th>
              <th className="py-2 pr-2">OWNER</th>
              <th className="py-2">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {SOCIAL_REGISTRY.map((s) => (
              <tr key={s.platform} className="border-b border-gray-50 align-top">
                <td className="py-2 pr-2 font-bold text-gray-800">{s.platform}</td>
                <td className="py-2 pr-2">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 font-bold text-violet-700 hover:underline">
                      {s.handle} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-bold text-gray-500">{s.handle}</span>
                  )}
                  {s.note && <div className="text-[11px] text-amber-600 font-semibold">{s.note}</div>}
                </td>
                <td className="py-2 pr-2 font-mono text-xs text-gray-500">{s.owner}</td>
                <td className="py-2">
                  {s.status === 'live' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                      <CircleCheck className="w-3 h-3" /> LIVE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                      <CircleDashed className="w-3 h-3" /> PENDING
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Signups by source detail */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionTitle icon={Users} title="Signups by source" badge="LIVE" badgeClass="bg-green-50 text-green-700" />
        {Object.keys(data?.signupsBySource ?? {}).length === 0 ? (
          <p className="text-sm text-gray-400 font-semibold py-4 text-center">
            Substrate is live — awaiting the first attributed signup. Bios are linked; this fills
            itself.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data?.signupsBySource ?? {})
              .sort((a, b) => b[1] - a[1])
              .map(([source, n]) => (
                <span key={source}
                      className="inline-flex items-center gap-2 bg-violet-50 text-violet-800 rounded-full px-3 py-1 text-sm font-bold capitalize">
                  {source} <span className="font-black tabular-nums">{n}</span>
                </span>
              ))}
          </div>
        )}
      </section>

      {/* Deliberate stubs — honest about what's not wired yet */}
      <div className="grid md:grid-cols-2 gap-3">
        <section className="bg-white rounded-xl border border-dashed border-gray-300 p-5">
          <SectionTitle icon={BellRing} title="Push campaigns" badge="NOT WIRED" badgeClass="bg-gray-100 text-gray-500" />
          <p className="text-xs text-gray-500 font-semibold">
            APNs + FCM + web push are live plumbing (Messaging page). A campaign composer with
            segments (everyone / lapsed 7d / Pro / streak holders) goes here once there&apos;s an
            audience worth segmenting.
          </p>
        </section>
        <section className="bg-white rounded-xl border border-dashed border-gray-300 p-5">
          <SectionTitle icon={Search} title="Search Console" badge="NOT WIRED" badgeClass="bg-gray-100 text-gray-500" />
          <p className="text-xs text-gray-500 font-semibold">
            Collecting since Jul 31. The API is free — impressions, clicks, and the branded vs
            non-branded query split land here once there&apos;s a few weeks of data to chart.
          </p>
        </section>
      </div>

      <p className="text-[11px] text-gray-400 font-semibold max-w-2xl">
        Deliberately absent: content calendar (link a doc, don&apos;t build a tool) and paid-ads
        tracking (no paid until organic LTV exists). Email appears only after an opt-in list does.
      </p>
    </div>
  );
}

function ScoreCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-gray-400">
        <Icon className="w-3.5 h-3.5" /> {label.toUpperCase()}
      </div>
      <div className="text-2xl font-black text-gray-900 tabular-nums mt-1">{value.toLocaleString()}</div>
      <div className="text-[11px] text-gray-400 font-semibold">{sub}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, badge, badgeClass }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  badgeClass?: string;
}) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-gray-500 mb-3">
      <Icon className="w-4 h-4" /> {title.toUpperCase()}
      {badge && (
        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${badgeClass ?? ''}`}>{badge}</span>
      )}
    </h2>
  );
}
