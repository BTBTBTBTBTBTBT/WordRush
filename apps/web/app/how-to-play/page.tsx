import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { HOW_TO_PLAY, type HTPTileColor } from '@/lib/how-to-play-content';

export const metadata: Metadata = {
  title: 'How to Play Wordocious — Rules, Tips & Game Mode Guide',
  description:
    'Learn how to play Wordocious. Complete guide to all 10 game modes: Classic, VS Battle, QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, and ProperNoundle. Scoring, streaks, medals, and tips for beginners.',
};

function TileExample({ letter, color }: { letter: string; color: HTPTileColor }) {
  const bg: Record<string, string> = { green: '#7c3aed', yellow: '#f59e0b', gray: '#64748b', empty: 'var(--color-surface)' };
  const text: Record<string, string> = { green: '#fff', yellow: '#fff', gray: '#fff', empty: 'var(--color-text)' };
  const border: Record<string, string> = { green: '#7c3aed', yellow: '#f59e0b', gray: '#64748b', empty: 'var(--color-border)' };
  return (
    <span
      className="inline-flex items-center justify-center font-black text-sm rounded"
      style={{ width: 36, height: 36, background: bg[color], color: text[color], border: `2px solid ${border[color]}` }}
    >
      {letter}
    </span>
  );
}

const cardStyle = { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' } as const;

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black uppercase mb-2 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>How to Play</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>Everything you need to know to get started</p>

        <div className="space-y-4">
          {HOW_TO_PLAY.map((s, i) => (
            <div key={i} style={cardStyle} className="p-5">
              <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>{s.title}</h2>

              {s.intro && (
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>{s.intro}</p>
              )}

              {s.bullets && (
                <ul className="text-xs leading-relaxed space-y-1.5 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2">
                      <span style={{ color: '#7c3aed' }}>&#8226;</span>
                      <span>{b.strong && <strong style={{ color: 'var(--color-text)' }}>{b.strong}</strong>}{b.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              {s.tilesHeading && (
                <h3 className="text-xs font-black mb-2 mt-1" style={{ color: 'var(--color-text)' }}>{s.tilesHeading}</h3>
              )}
              {s.tiles && (
                <div className="space-y-3">
                  {s.tiles.map((t, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="flex gap-1 flex-shrink-0">
                        {t.letters.map((l, k) => <TileExample key={k} letter={l.ch} color={l.color} />)}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        <strong style={{ color: t.strongColor }}>{t.strong}</strong>{t.rest}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {s.modes && (
                <div className="space-y-4">
                  {s.modes.map((m, j) => (
                    <div key={j}>
                      <h3 className="text-xs font-black mb-1" style={{ color: m.accent }}>{m.name}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{m.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {s.outro && (
                <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--color-text-secondary)' }}>{s.outro}</p>
              )}
            </div>
          ))}

          {/* Links */}
          <div style={cardStyle} className="p-5">
            <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>More Information</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/about" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>About Wordocious</Link>
              <Link href="/privacy" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>Privacy Policy</Link>
              <Link href="/terms" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
