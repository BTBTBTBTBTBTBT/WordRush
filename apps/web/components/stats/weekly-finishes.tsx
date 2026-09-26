'use client';

import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { ordinal } from '@/lib/weekly-race';

// Weekly race finishes on the Stats tab's All-time page (D3.3): the settled
// weeks from weekly_race_results (owner read via RLS) — how many times you won,
// placed and showed, and the last result in words.

interface Row { week_start: string; rank: number; points: number; circle_size: number; winner_points: number | null }

export function WeeklyFinishesCard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let active = true;
    (supabase as any)
      .from('weekly_race_results')
      .select('week_start, rank, points, circle_size, winner_points')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(52)
      .then(({ data }: { data: Row[] | null }) => { if (active) setRows(data ?? []); }, () => { if (active) setRows([]); });
    return () => { active = false; };
  }, [userId]);
  if (!rows || rows.length === 0) return null;
  const count = (r: number) => rows.filter((w) => w.rank === r).length;
  const last = rows[0];
  const mon = new Date(`${last.week_start}T00:00:00`);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
      <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }} />
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Flag className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <span className="font-black text-sm" style={{ color: 'var(--color-text)' }}>Weekly Race Finishes</span>
          <span className="text-[10px] font-bold ml-auto" style={{ color: 'var(--color-text-muted)' }}>{rows.length} {rows.length === 1 ? 'week' : 'weeks'}</span>
        </div>
        <div className="flex items-center justify-around">
          {[['🥇', count(1)], ['🥈', count(2)], ['🥉', count(3)]].map(([m, n]) => (
            <div key={m as string} className="text-center">
              <div className="text-lg">{m}</div>
              <div className="text-base font-black" style={{ color: 'var(--color-text)' }}>{n as number}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-bold text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {f(mon)}–{f(sun)}: finished {ordinal(last.rank)} of {last.circle_size} · {last.points.toLocaleString()} pts
        </p>
      </div>
    </div>
  );
}
