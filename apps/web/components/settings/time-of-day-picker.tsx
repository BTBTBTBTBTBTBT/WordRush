'use client';

import { useEffect, useState } from 'react';
import { SettingsOption, SettingsSection } from '@/components/settings/settings-kit';
import { TOD_EVENT, setTodPreview, storedTodPreview, type TimeOfDay } from '@/lib/time-of-day';

const ACCENT = '#f97316';
const CHOICES: { id: TimeOfDay; label: string; hours: string }[] = [
  { id: 'morning', label: 'Morning', hours: '5 AM - 10 AM' },
  { id: 'day', label: 'Day', hours: '10 AM - 4 PM' },
  { id: 'evening', label: 'Evening', hours: '4 PM - 7 PM' },
  { id: 'night', label: 'Night', hours: '7 PM - 5 AM' },
];

/**
 * Settings > Time of day (admins only, next to the Season preview): Auto follows the device clock; the others pin the season's
 * wall, stage and window colors to one look so each can be checked at any hour. Session-only, like the season preview.
 */
export function TimeOfDayPicker() {
  const [picked, setPicked] = useState<TimeOfDay | null>(null);
  useEffect(() => {
    const read = () => setPicked(storedTodPreview());
    read();
    window.addEventListener(TOD_EVENT, read);
    return () => window.removeEventListener(TOD_EVENT, read);
  }, []);
  const choose = (t: TimeOfDay | null) => { setPicked(t); setTodPreview(t); };
  return (
    <SettingsSection title="Time of day" accent={ACCENT}>
      <div className="space-y-1.5">
        <SettingsOption selected={picked == null} accent={ACCENT} label="Auto" description="Follow this device's clock" onClick={() => choose(null)} />
        {CHOICES.map((c) => (
          <SettingsOption key={c.id} selected={picked === c.id} accent={ACCENT} label={c.label} description={`${c.hours}: preview this look (admin)`} onClick={() => choose(c.id)} />
        ))}
      </div>
    </SettingsSection>
  );
}
