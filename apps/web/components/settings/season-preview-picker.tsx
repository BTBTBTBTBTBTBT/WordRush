'use client';

import { useEffect, useState } from 'react';
import { SEASON_IDS, type Season } from '@wordle-duel/core';
import { SettingsOption, SettingsSection } from '@/components/settings/settings-kit';
import { seasonLabel } from '@/lib/season-kit';
import { SEASON_EVENT, setSeasonPreview, storedSeasonPreview } from '@/lib/season';

const ACCENT = '#f97316';

/**
 * Settings > Season preview (admins only; the caller gates on profiles.is_admin): Off (by date) or any
 * registry season, so the founder + partner can see a season's titles, walls, buttons, banner and cast
 * before its window opens. Writes the session's preview key; the page flips live (SEASON_EVENT).
 */
export function SeasonPreviewPicker() {
  const [picked, setPicked] = useState<Season | null>(null);
  useEffect(() => {
    const read = () => setPicked(storedSeasonPreview());
    read();
    window.addEventListener(SEASON_EVENT, read);
    return () => window.removeEventListener(SEASON_EVENT, read);
  }, []);
  const choose = (s: Season | null) => { setPicked(s); setSeasonPreview(s); };
  return (
    <SettingsSection title="Season preview" accent={ACCENT}>
      <div className="space-y-1.5">
        <SettingsOption
          selected={picked == null}
          accent={ACCENT}
          label="Off (by date)"
          description="Seasons switch on by the calendar"
          onClick={() => choose(null)}
        />
        {SEASON_IDS.map((id) => (
          <SettingsOption
            key={id}
            selected={picked === id}
            accent={ACCENT}
            label={seasonLabel(id)}
            description={`Show the ${seasonLabel(id)} art today (admin preview)`}
            onClick={() => choose(id)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
