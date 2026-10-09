import type { Metadata } from 'next';
import { ABOUT_SECTIONS } from '@/lib/content/static-content';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoPageLayout, IntroCard, IntroText, SectionCard, infoAccent } from '@/components/ui/info-page';

export const metadata: Metadata = {
  title: 'About Wordocious — Daily Word Games',
  description:
    'Wordocious is a free online puzzle game with nineteen ways to play: Classic, QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, real-time VS Battles, and ten Puzzles dailies — ProperNoundle, Sudocious, Starsweep, Letter Ladder, Spyglass, Hubbub, Codebreaker, Kindred, Crosswordocious and Muddle. Play daily puzzles, climb leaderboards, and compete with friends.',
};

export default function AboutPage() {
  return (
    <InfoPageLayout title="About Wordocious" art="art-titlecast-about" artLabel="About Wordocious">
      <IntroCard title={<>Daily Word Games &mdash; the same puzzles for everyone</>} />

      {ABOUT_SECTIONS.map((section, si) => (
        <SectionCard key={section.heading} heading={section.heading} accent={infoAccent(si)}>
          {section.paragraphs?.map((p, i) => (
            <p key={i} className="text-xs leading-relaxed mb-3 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
          ))}
          {section.items && (
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.heading}>
                  <h3 className="text-xs font-black" style={{ color: item.accent ?? '#7c3aed' }}>{item.heading}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ))}

      {/* More Information (static chrome — links to the footer pages; A8 candy buttons) */}
      <SectionCard heading="More Information" accent={infoAccent(ABOUT_SECTIONS.length)}>
        <div className="flex flex-wrap gap-2 mt-1">
          <CandyLink href="/how-to-play" color="purple" size="sm">How to Play</CandyLink>
          <CandyLink href="/privacy" color="peach" size="sm">Privacy Policy</CandyLink>
          <CandyLink href="/terms" color="peach" size="sm">Terms of Service</CandyLink>
        </div>
      </SectionCard>
    </InfoPageLayout>
  );
}
