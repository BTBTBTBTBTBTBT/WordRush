import type { Metadata } from 'next';
import { HOW_TO_PLAY, type HTPTileColor } from '@/lib/how-to-play-content';
import { LetterTile, type TileLook } from '@/components/game/letter-tile';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoPageLayout, IntroCard, IntroText, SectionCard, infoAccent } from '@/components/ui/info-page';
import { TOUR_HREF } from '@/lib/onboarding';

export const metadata: Metadata = {
  title: 'How to Play Wordocious — Rules, Tips & Game Mode Guide',
  description:
    'Learn how to play Wordocious. Complete guide to every game mode: Classic, VS Battle, QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, and the ten More Games dailies — ProperNoundle, Sudocious, Starsweep, Letter Ladder, Spyglass, Hubbub, Codebreaker, Kindred, Crosswordocious and Muddle. Scoring, streaks, medals, and tips for beginners.',
};

/** HTP tile colors → the glossy game tile looks (B1). Unrevealed letters show on the frosted empty tile. */
const TILE_LOOK: Record<HTPTileColor, TileLook> = { green: 'correct', yellow: 'present', gray: 'absent', empty: 'empty' };

function TileExample({ letter, color }: { letter: string; color: HTPTileColor }) {
  return <LetterTile letter={letter} look={TILE_LOOK[color]} style={{ width: 36, ['--gt-font' as string]: '17px' }} />;
}

export default function HowToPlayPage() {
  return (
    <InfoPageLayout title="How to Play" art="art-title-howto">
      <IntroCard title="Everything you need to know to get started">
        <IntroText>The rules, the tile colors and every mode, one card at a time.</IntroText>
        {/* FINISH_SPEC AO: replay the welcome + quick tour (steps 1–2). */}
        <div className="mt-3">
          <CandyLink href={TOUR_HREF} color="purple" size="sm" icon="play">Take the tour</CandyLink>
        </div>
      </IntroCard>

      {HOW_TO_PLAY.map((s, i) => (
        <SectionCard key={i} heading={s.title} accent={infoAccent(i)}>
          {s.intro && (
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>{s.intro}</p>
          )}

          {s.bullets && (
            <ul className="text-xs leading-relaxed space-y-1.5 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {s.bullets.map((b, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span>
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
        </SectionCard>
      ))}

      {/* Links (A8: candy buttons) */}
      <SectionCard heading="More Information" accent={infoAccent(HOW_TO_PLAY.length)}>
        <div className="flex flex-wrap gap-2 mt-1">
          <CandyLink href="/privacy" color="peach" size="sm">Privacy Policy</CandyLink>
          <CandyLink href="/terms" color="peach" size="sm">Terms of Service</CandyLink>
        </div>
      </SectionCard>
    </InfoPageLayout>
  );
}
