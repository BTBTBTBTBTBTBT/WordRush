'use client';

import { useMemo } from 'react';
import { Ghost, ExternalLink, Smartphone, CalendarRange } from 'lucide-react';
import { halloweenSrc } from '@/lib/art';
import { CAST, MASCOT_LETTER } from '@/lib/mascots';
import { halloweenStatus } from '@/lib/admin/admin-aggregates';
import { PageHeader, Section, Stat, Callout } from '../components/admin-ui';

// admin > Content & Ops > Seasons: the seasonal cast skins (FINISH_SPEC X).
// core currentSeason decides on the player's LOCAL date; this page reads the
// admin's own local date the same way. Preview is web-only and per browser
// session (lib/season.ts `?season=`); natives use the admin debug toggle.

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PREVIEWS: Array<{ q: string; label: string; note: string }> = [
  { q: 'halloween', label: 'Force Halloween', note: 'Skins on for this browser session' },
  { q: 'none', label: 'Force off', note: 'Skins off even during the season' },
  { q: 'auto', label: 'Back to the calendar', note: 'Clears the preview' },
];

export default function AdminSeasonsPage() {
  const day = useMemo(localDay, []);
  const s = useMemo(() => halloweenStatus(day), [day]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seasons"
        icon={Ghost}
        subtitle="Halloween runs Oct 24 to Nov 1 on each player's local date. During the season the ten Halloween skins replace the hero cast in the cast header, the cold-start intro and landing flourish, the share-image wordmark and the loading screen."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Status today" value={s.active ? 'Halloween is on' : 'Off season'} sub={`Your local date: ${day}`} icon={Ghost} tone={s.active ? 'text-orange-600 bg-orange-50' : 'text-gray-500 bg-gray-100'} />
        <Stat label={s.active ? 'Days left' : 'Starts in'} value={s.active ? `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'}` : `${s.daysUntilStart} day${s.daysUntilStart === 1 ? '' : 's'}`} sub={s.active ? `Ends after ${s.end}` : `Opens ${s.start}`} icon={CalendarRange} />
        <Stat label="Window" value={`${s.start.slice(5)} → ${s.end.slice(5)}`} sub={s.start.slice(0, 4)} icon={CalendarRange} />
        <Stat label="Source of truth" value="core currentSeason" sub="packages/core level-season.ts" />
      </div>

      <Section title="Preview on the web" icon={ExternalLink} note="Each link opens Home in a new tab; the choice holds for that browser session.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PREVIEWS.map((p) => (
            <a
              key={p.q}
              href={`/?season=${p.q}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:bg-purple-50/40 transition"
            >
              <p className="text-sm font-black text-gray-900 flex items-center gap-1.5">{p.label} <ExternalLink className="w-3.5 h-3.5 text-gray-400" /></p>
              <p className="text-xs font-semibold text-gray-500">{p.note}</p>
              <p className="text-[11px] font-mono text-gray-400 mt-1">/?season={p.q}</p>
            </a>
          ))}
        </div>
      </Section>

      <Section title="The Halloween cast" icon={Ghost}>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
          {CAST.map((id) => (
            <div key={id} className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={halloweenSrc(id)} alt="" className="w-full aspect-square object-contain rounded-lg bg-gray-50" />
              <p className="text-[11px] font-black text-gray-500 mt-1">{MASCOT_LETTER[id]}</p>
            </div>
          ))}
        </div>
      </Section>

      <Callout>
        <span className="inline-flex items-center gap-1.5 font-bold"><Smartphone className="w-4 h-4" /> iOS and Android:</span> turn on Settings → Halloween preview (shown to admin accounts only).
      </Callout>
    </div>
  );
}
