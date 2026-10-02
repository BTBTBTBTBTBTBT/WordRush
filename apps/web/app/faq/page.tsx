import type { Metadata } from 'next';
import { FAQ_SECTIONS as SECTIONS } from '@/lib/content/static-content';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoCard, InfoLabel, InfoPageLayout, IntroCard, IntroText, QuestionCard, infoAccent } from '@/components/ui/info-page';

export const metadata: Metadata = {
  title: 'Wordocious FAQ & Strategy — Tips for Every Word Game Mode',
  description:
    'Answers to common Wordocious questions plus word-game strategy: best starting words, how to read purple/amber/gray tiles, juggling multi-board modes like QuadWord and OctoWord, beating the Gauntlet, and scoring higher on daily leaderboards.',
};

export default function FaqPage() {
  return (
    <InfoPageLayout title="FAQ & Strategy" art="art-title-faq">
      <IntroCard title="Everything you need to start winning at Wordocious">
        <IntroText>Common questions first, then strategy for every mode.</IntroText>
      </IntroCard>

      {/* C6: each FAQ section is a tinted label, its questions are question cards in the section's color. */}
      {SECTIONS.map((section, si) => {
        const accent = infoAccent(si);
        return (
          <section key={section.heading} className="flex flex-col gap-2.5">
            <InfoLabel accent={accent}>{section.heading}</InfoLabel>
            {section.items.map((item) => (
              <QuestionCard key={item.q} q={item.q} a={item.a} accent={accent} />
            ))}
          </section>
        );
      })}

      <InfoCard className="p-5 text-center flex flex-col items-center gap-3">
        <p className="m-0 text-sm font-black" style={{ color: 'var(--color-text)' }}>Ready to play?</p>
        <CandyLink href="/" color="purple" size="md" icon="play">Start today&apos;s puzzles</CandyLink>
      </InfoCard>
    </InfoPageLayout>
  );
}
