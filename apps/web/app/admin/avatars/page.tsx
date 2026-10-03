'use client';

import { Smile, Image as ImageIcon, Sparkles, Crown, Palette } from 'lucide-react';
import { AVATAR_PRO_ONLY } from '@wordle-duel/core';
import { DrillCard, useDrill } from '../components/drill-panel';
import { PageHeader, ReloadButton, Section, BarList, ErrorNote, LoadingGrid, Callout, fmt, useAdminData } from '../components/admin-ui';

interface Tally { key: string; count: number }
interface AvatarsData {
  applied: boolean;
  note?: string;
  players?: number | null;
  withPhoto?: number | null;
  adoption?: {
    saved: number;
    display: { mascot: number; photo: number };
    withPhoto: number;
    photoOwnersShowingMascot: number;
    accessorized: number;
    parts: Record<string, Tally[]>;
    castPicks: Tally[];
    frames: Tally[];
  };
}

const PART_TITLES: Array<[string, string]> = [
  ['body', 'Body'], ['color', 'Color'], ['pattern', 'Pattern'], ['eyes', 'Eyes'], ['mouth', 'Mouth'], ['nose', 'Nose'],
  ['head', 'Hats'], ['face', 'Face extras'], ['neck', 'Neck extras'], ['bg', 'Backdrops'], ['frame', 'Frame (in mascot)'],
];

const PRO_ONLY = new Set<string>([...AVATAR_PRO_ONLY.head, ...AVATAR_PRO_ONLY.neck, ...AVATAR_PRO_ONLY.bg]);

export default function AdminAvatarsPage() {
  const drill = useDrill();
  const { data, error, loading, reload } = useAdminData<AvatarsData>('/api/admin/avatars');
  const a = data?.adoption;
  const pctOf = (n: number, d: number | null | undefined) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avatars"
        icon={Smile}
        subtitle="Mascot maker adoption: who saved a mascot, what they picked, and whether they show the mascot or their photo. Click any choice to see the players behind it."
        actions={<ReloadButton onClick={reload} loading={loading} />}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid />}
      {data && !data.applied && <Callout tone="amber">{data.note}</Callout>}

      {a && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard
              label="Saved a mascot"
              value={fmt(a.saved)}
              sub={`${pctOf(a.saved, data?.players)} of ${fmt(data?.players)} accounts`}
              icon={<Smile className="w-3.5 h-3.5" />}
              drill={{ metric: 'avatars' }}
            />
            <DrillCard label="Showing the mascot" value={fmt(a.display.mascot)} sub={`${fmt(a.display.photo)} show their photo`} icon={<Palette className="w-3.5 h-3.5" />} />
            <DrillCard
              label="Photo owners on mascot"
              value={fmt(a.photoOwnersShowingMascot)}
              sub={`of ${fmt(a.withPhoto)} savers with a photo (${fmt(data?.withPhoto)} photos overall)`}
              icon={<ImageIcon className="w-3.5 h-3.5" />}
            />
            <DrillCard label="Wearing an accessory" value={fmt(a.accessorized)} sub="hat, face or neck extra" icon={<Sparkles className="w-3.5 h-3.5" />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {PART_TITLES.map(([part, title]) => (
              <Section key={part} title={title}>
                <BarList
                  rows={(a.parts[part] ?? []).slice(0, 10).map((t) => ({ label: t.key, count: t.count, hint: PRO_ONLY.has(t.key) && part !== 'frame' ? 'Pro' : undefined }))}
                  onPick={(label) => drill(label === 'none' || label === 'auto' ? { metric: 'avatars' } : { metric: 'avatars', key: `${part}:${label}` })}
                  empty="Nobody yet."
                />
              </Section>
            ))}
            <Section title="Level / Pro frame" icon={Crown} note="profiles.avatar_frame, the ring shown around any avatar.">
              <BarList rows={a.frames.map((t) => ({ label: t.key, count: t.count }))} empty="No frames saved." />
            </Section>
            <Section title="Cast picks" note="profiles.avatar_cast_id: a cast character chosen as the avatar.">
              <BarList rows={a.castPicks.map((t) => ({ label: t.key.toUpperCase(), count: t.count }))} empty="No cast picks yet." />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
