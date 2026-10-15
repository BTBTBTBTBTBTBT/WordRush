'use client';

import { AtSign, CircleCheck, CircleDashed, ExternalLink } from 'lucide-react';

// Social Studio > Accounts: the handle registry, beside the connected-accounts
// panel. (Moved here from Marketing: one ledger of the accounts, in the place
// they are connected.)

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
  { platform: 'X', handle: '@wordocious', url: 'https://x.com/wordocious', owner: 'bt@wordocious.com', status: 'live', note: 'Bio + /go/x link live 10-14. Developer app set up 10-15 (keys in Vercel; Connect + X API credits next: the X API is pay-per-use). JP (@JassonPatterson) admin invite pending: he must allow Delegate invites' },
  { platform: 'TikTok', handle: '@playwordocious', url: 'https://tiktok.com/@playwordocious', owner: 'bt@wordocious.com', status: 'live', note: '@wordocious held by a dormant account: claim via trademark once registered (renamed 10-14; next rename after 30 days). Linked to TikTok Business Center ShowLoud LLC; JP invited as admin. Bio carries wordocious.com/go/tiktok (10-14). Developer account still needed for Connect' },
  { platform: 'Instagram', handle: '@playwordocious', url: 'https://instagram.com/playwordocious', owner: 'bt@wordocious.com', status: 'live', note: '@wordocious held by a dormant account: claim via trademark once registered (renamed 10-14). Professional (Business) account, connected to the Facebook Page; JP gets access through the Page. Bio + "Play free" /go/instagram link live 10-14. Connect waits on the Meta developer signup' },
  { platform: 'Facebook', handle: 'facebook.com/wordocious', url: 'https://facebook.com/wordocious', owner: 'Brian (admin)', status: 'live', note: 'username set 10-14; @playwordocious connected to the Page (Page admins manage IG too). JP Page access pending: needs his Facebook profile link (his email finds no profile). Bio with /go/facebook live 10-14' },
  { platform: 'Pinterest', handle: 'wordocious', url: 'https://pinterest.com/wordocious', owner: 'bt@wordocious.com', status: 'live', note: 'JP invited as Manager (jp@pattersonlp.com) 10-14. About + /go/pinterest live; boards Daily Games, Meet the Cast, Game Guides (10-14). Developer app 1624551 pending trial access (10-15)' },
  { platform: 'Threads', handle: '@playwordocious', url: null, owner: 'via Instagram', status: 'pending', note: 'auto-claims on first Threads sign-in' },
  { platform: 'Reddit', handle: 'u/wordocious', url: null, owner: 'bt@wordocious.com', status: 'pending', note: 'create via phone app account switcher' },
  { platform: 'YouTube', handle: '@wordocious', url: null, owner: 'TBD (Google account)', status: 'pending' },
];

export function SocialRegistry() {
  return (
    <section className="rounded-2xl bg-white shadow-sm p-3 sm:p-4 space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
        <AtSign className="w-4 h-4" /> Handle registry
      </h2>
      <p className="text-xs font-semibold text-gray-500">
        The anti-sprawl ledger: every account, its owning login, and its state. Bios all point at the /go link for their
        channel (links and signups by source are on Marketing).
      </p>
      <ul className="space-y-1 text-xs font-semibold text-gray-600">
        <li>
          <span className="font-black text-gray-800">Content plan:</span> JP&apos;s 45-day plan (Oct 13 to Nov 29, launch Oct 16)
          and its draft posts are in the Calendar and JP&apos;s plan tabs. Posts go out by themselves once BMT and JP both approve.
        </li>
        <li>
          <span className="font-black text-gray-800">Profile pictures:</span> every account uses icon B (the W mascot) since
          10-14; Facebook cover and X header refreshed the same day.
        </li>
        <li>
          <span className="font-black text-gray-800">Claiming @wordocious (Instagram, TikTok):</span> keep dated evidence now,
          report with the USPTO serial number once filed, refile with the registration number, then rename
          @playwordocious (plan: bible &sect;385).
        </li>
      </ul>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-100">
              <th className="py-2 px-1 pr-2">PLATFORM</th>
              <th className="py-2 pr-2">HANDLE</th>
              <th className="py-2 pr-2">OWNER</th>
              <th className="py-2">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {SOCIAL_REGISTRY.map((s) => (
              <tr key={s.platform} className="border-b border-gray-50 align-top">
                <td className="py-2 px-1 pr-2 font-bold text-gray-800">{s.platform}</td>
                <td className="py-2 pr-2">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-violet-700 hover:underline">
                      {s.handle} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-bold text-gray-500">{s.handle}</span>
                  )}
                  {s.note && <div className="text-[11px] text-amber-600 font-semibold">{s.note}</div>}
                </td>
                <td className="py-2 pr-2 font-mono text-xs text-gray-500 whitespace-nowrap">{s.owner}</td>
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
      </div>
    </section>
  );
}
