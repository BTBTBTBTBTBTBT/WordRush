'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { MELODY_REPLAY } from '@wordle-duel/core';
import { noteSound, soundUrl, type SoundName } from '@/lib/sound-map';
import { seasonLabel, seasonNoteSound } from '@/lib/season-kit';
import { Callout } from '../components/admin-ui';
import { SECRET_SONG_TRIGGER, secretSongGroups, type SecretSongGroup, type SecretSongView, type SongStep } from '@/lib/admin/secret-songs';

// admin > Design > Sound Library > Secret songs (founder 10-16): the musical-cast easter eggs by season, read straight
// from core (lib/admin/secret-songs.ts). ▶ sings the jingle in the browser with the same note samples + tempo the web
// app uses (MELODY_REPLAY.beatMs per beat; the season's voicing when the season has one), through plain <audio> like
// the rest of this page (lib/sounds.ts mutes /admin).

/** The sample for one step: the season's voicing (note-h-w …) when the group has one, else the everyday note. */
function stepSound(step: SongStep, season: string | null): SoundName | null {
  return noteSound(step.castId, season ? seasonNoteSound(season, step.castId) : null);
}

/** One jingle at a time, each note on its own beat. Only ever started by a tap. */
function useJingle() {
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const live = useRef<HTMLAudioElement[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = useCallback(() => {
    seq.current += 1;
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    for (const a of live.current) { try { a.pause(); } catch { /* already stopped */ } }
    live.current = [];
    setPlaying(null);
  }, []);
  const play = useCallback((key: string, steps: SongStep[], season: string | null) => {
    stop();
    const run = seq.current;
    setPlaying(key);
    let at = 0;
    for (const step of steps) {
      const name = stepSound(step, season);
      if (name) {
        const atMs = Math.round(at * MELODY_REPLAY.beatMs);
        timers.current.push(setTimeout(() => {
          if (run !== seq.current) return;
          const a = new Audio(soundUrl(name));
          live.current.push(a);
          a.play().catch(() => { /* autoplay refused: the tap started it, so this is rare */ });
        }, atMs));
      }
      at += step.beats;
    }
    timers.current.push(setTimeout(() => { if (run === seq.current) { setPlaying(null); live.current = []; } }, Math.round(at * MELODY_REPLAY.beatMs) + 600));
  }, [stop]);
  useEffect(() => () => stop(), [stop]);
  return { playing, play, stop };
}

const STATUS = {
  live: { label: 'Live', cls: 'bg-orange-500 text-white' },
  preview: { label: 'Preview only', cls: 'bg-amber-100 text-amber-800' },
} as const;

function Steps({ steps, muted }: { steps: SongStep[]; muted?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {steps.map((s, i) => (
        <span key={i} title={`${s.note}${s.beats !== 1 ? ` · ${s.beats} beats` : ''}`}
          className={`inline-flex flex-col items-center rounded-lg px-1.5 py-0.5 leading-none ${muted ? 'bg-white/70 text-gray-500' : 'bg-white text-purple-800'}`}>
          <span className="text-sm font-black">{s.letter}</span>
          <span className="text-[9px] font-bold opacity-70">{s.note}</span>
        </span>
      ))}
    </span>
  );
}

function Song({ s, group, jingle }: { s: SecretSongView; group: SecretSongGroup; jingle: ReturnType<typeof useJingle> }) {
  const key = `${group.id}/${s.id}`;
  const isPlaying = jingle.playing === key;
  const season = group.notePrefix ? group.id : null;
  const sungDiffers = s.song.length !== s.match.length;
  return (
    <div className="rounded-2xl bg-purple-100/50 p-2.5 sm:p-3">
      <div className="flex items-start gap-2.5">
        <button type="button" onClick={() => (isPlaying ? jingle.stop() : jingle.play(key, s.song, season))}
          aria-label={isPlaying ? `Stop ${s.name}` : `Play ${s.name}`}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${isPlaying ? 'bg-fuchsia-500' : 'bg-purple-600 hover:bg-purple-700'}`}>
          {isPlaying ? <Square className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-base font-black text-gray-900 leading-tight">{s.name}</h3>
            {s.source && <span className="text-[11px] font-bold text-gray-500">{s.source}</span>}
          </div>
          <p className="text-[11px] font-bold text-purple-600">
            Unlocks <span className="text-gray-800">{s.achievement?.name ?? s.id}</span>
            <span className="text-gray-400"> · {s.achievement?.key ?? '—'}</span>
            {' · '}{Math.round(s.totalBeats * MELODY_REPLAY.beatMs / 100) / 10}s sung
          </p>
          {s.hint && <p className="mt-0.5 text-xs font-semibold text-gray-600">{s.hint}</p>}
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wide text-purple-500">Tap to unlock</p>
        <Steps steps={s.match} />
        {sungDiffers && (
          <>
            <p className="pt-1 text-[10px] font-black uppercase tracking-wide text-purple-500">The cast sings back</p>
            <Steps steps={s.song} muted />
          </>
        )}
      </div>
    </div>
  );
}

export function SecretSongs() {
  const groups = useMemo(() => secretSongGroups(seasonLabel), []);
  const jingle = useJingle();
  const total = groups.reduce((n, g) => n + g.songs.length, 0);
  return (
    <div className="space-y-3">
      <Callout tone="purple">
        <span className="font-black">How players find them.</span> {SECRET_SONG_TRIGGER}
        <span className="block mt-1 text-xs opacity-80">{total} tunes from core musical-cast.ts, grouped by the season they count in. Each badge is secret: listed only once earned. Season tunes count only inside the window, and only once the season is ready.</span>
      </Callout>
      {groups.map((g) => {
        const st = STATUS[g.status];
        return (
          <section key={g.id} className="rounded-3xl bg-purple-50/60 p-2.5 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-gray-900 leading-tight">{g.title}</h2>
                <p className="text-xs font-bold text-gray-500">
                  {g.window ? `${g.window} · ` : 'Every day · '}{g.songs.length} {g.songs.length === 1 ? 'tune' : 'tunes'}
                  {g.notePrefix ? ` · ${g.title} voicing (${g.notePrefix}…)` : ' · everyday voices'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${st.cls}`}>{st.label}</span>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {g.songs.map((s) => <Song key={s.id} s={s} group={g} jingle={jingle} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
