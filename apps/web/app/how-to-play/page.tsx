import type { Metadata } from 'next';
import Image from 'next/image';
import { HOW_TO_PLAY, type HTPTileColor } from '@/lib/how-to-play-content';
import { LetterTile, type TileLook } from '@/components/game/letter-tile';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoPageLayout } from '@/components/ui/info-page';
import { GuideBody, GuideHeroCard, GuideSectionHead, GuideTakeaway } from '@/components/strategy/guide-family';
import { gameArtSrc } from '@/lib/art';
import { accentInk } from '@/lib/soft-surface';
import { MODE_BY_ID } from '@/lib/modes.generated';
import { howToPlayAccent, howToPlayModeId } from '@/lib/strategy-games';
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

/** The brand purple of the hero card (W hosts). */
const HERO_ACCENT = '#7c3aed';

export default function HowToPlayPage() {
  // The guide page family (parity spec): a no-stroke hero card, then numbered
  // sections on the page (no cards, no borders), separated by space.
  return (
    <InfoPageLayout title="How to Play" art="art-titlecast-howto">
      <div className="flex flex-col gap-6">
        <GuideHeroCard accent={HERO_ACCENT} host="w" priority className="px-5 pt-3 pb-5 gap-2">
          <h2 className="m-0 font-black leading-tight" style={{ fontSize: 20, color: 'var(--color-text)' }}>How Wordocious works</h2>
          <p className="m-0 font-bold leading-snug" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Everything you need to know to get started
          </p>
          {/* FINISH_SPEC AO: replay the welcome + quick tour (steps 1–2). */}
          <div className="mt-2">
            <CandyLink href={TOUR_HREF} color="pink" size="md" icon="play">Take the tour</CandyLink>
          </div>
        </GuideHeroCard>

        {HOW_TO_PLAY.map((s, i) => {
          const accent = howToPlayAccent(i);
          return (
            <section key={i} className="flex flex-col gap-3">
              <GuideSectionHead n={i + 1} accent={accent}>{s.title}</GuideSectionHead>

              {s.intro && <GuideTakeaway accent={accent}>{s.intro}</GuideTakeaway>}

              {s.bullets && (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2.5 items-start" style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                      <span aria-hidden="true" className="shrink-0 rounded-full" style={{ width: 8, height: 8, marginTop: 8, background: accent }} />
                      <span>{b.strong && <strong className="font-black" style={{ color: 'var(--color-text)' }}>{b.strong}</strong>}{b.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              {s.tilesHeading && (
                <h3 className="m-0 mt-1 font-black" style={{ fontSize: 15, color: 'var(--color-text)' }}>{s.tilesHeading}</h3>
              )}
              {s.tiles && (
                <div className="flex flex-col gap-3">
                  {s.tiles.map((t, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="flex gap-1 flex-shrink-0">
                        {t.letters.map((l, k) => <TileExample key={k} letter={l.ch} color={l.color} />)}
                      </div>
                      <p className="m-0 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <strong style={{ color: t.strongColor }}>{t.strong}</strong>{t.rest}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {s.modes && (
                <div className="flex flex-col gap-4">
                  {s.modes.map((m, j) => {
                    const id = howToPlayModeId(m.name);
                    const icon = gameArtSrc(id);
                    const modeAccent = (id && MODE_BY_ID[id]?.accentHex) || m.accent;
                    // The game accent on light; its pastel on dark (legible on the dark surface).
                    const ink = accentInk(modeAccent, modeAccent);
                    return (
                      <div key={j} className="flex gap-3 items-start">
                        {icon && (
                          <Image src={icon} alt="" aria-hidden width={256} height={256} sizes="32px" loading="lazy" draggable={false} className="shrink-0" style={{ width: 32, height: 32 }} />
                        )}
                        <div className="min-w-0">
                          <h3 className={`m-0 font-black leading-snug ${ink.className}`} style={{ ...ink.style, fontSize: 14 }}>{m.name}</h3>
                          <p className="m-0 mt-0.5" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{m.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {s.outro && <GuideBody size={15}>{s.outro}</GuideBody>}
            </section>
          );
        })}

        {/* Links (A8: candy buttons). */}
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-black" style={{ fontSize: 18, color: 'var(--color-text)' }}>More Information</h2>
          <div className="flex flex-wrap gap-2">
            <CandyLink href="/privacy" color="peach" size="sm">Privacy Policy</CandyLink>
            <CandyLink href="/terms" color="peach" size="sm">Terms of Service</CandyLink>
          </div>
        </section>
      </div>
    </InfoPageLayout>
  );
}
