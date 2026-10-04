import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PageBackground } from '@/components/ui/page-background';
import { CandyLink } from '@/components/ui/candy-button';
import { CastLink } from '@/components/ui/cast-button';
import { GuideBody, GuideHeroCard, GuideNumeral, GuideTakeaway, GuideWordmark, ReadChip } from '@/components/strategy/guide-family';
import { accentInk } from '@/lib/soft-surface';
import { wordOfDay, parseDateKey, dateKey, daysSinceEpoch, wordPlayAnalysis } from '@/lib/word-of-day';
import { wordInsights, ordinal, BANK_SIZE } from '@/lib/word-insights';

export const revalidate = 86400;
export const dynamicParams = true;

interface Props {
  params: { date: string };
}

function prettyDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const date = parseDateKey(params.date);
  if (!date) return { title: 'Word of the Day | Wordocious' };
  const entry = await wordOfDay(date);
  const w = entry.word.toUpperCase();
  const desc = entry.definition
    ? `${w} (${entry.partOfSpeech}): ${entry.definition} The Wordocious Word of the Day for ${prettyDate(date)}, with pronunciation, meaning, and word-puzzle letter analysis.`
    : `${w} — the Wordocious Word of the Day for ${prettyDate(date)}, with a letter-by-letter breakdown for word-puzzle players.`;
  return {
    title: `${w} — Word of the Day (${params.date}) | Wordocious`,
    description: desc.slice(0, 300),
    alternates: { canonical: `https://wordocious.com/word/${params.date}` },
    // §229: 60 of the site's 100 indexed URLs were these templated date
    // pages (~280 words each, one template) — AdSense's "low value content"
    // classifier reads that as an auto-generated site, which is what every
    // review for months came back with. Out of the index (and the sitemap)
    // until each page carries substantial unique content; the /words hub
    // stays indexable.
    robots: { index: false, follow: true },
  };
}

// FINISH_SPEC BI17 (3-platform parity): the guide page family look. The hero is
// the guide hero card (I-green, I "ready"); below it no cards — section labels,
// numbered senses on accent-wash numerals, takeaways as soft color fields.
/** I's green, the Word of the Day host. */
const WOTD_ACCENT = '#4CC77A';
/** Brand purple, the reading accent (senses, eyebrows, the example). */
const READ_ACCENT = '#7C3AED';
const AMBER = '#F59E0B';
const EYEBROW_INK = accentInk(READ_ACCENT, '#6d28d9');

/** A section label: 13 px black caps, tracking 1.2, heading ink. */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="m-0 font-black uppercase" style={{ fontSize: 13, letterSpacing: '1.2px', color: 'var(--color-text)' }}>{children}</h2>
);

/** One numbered sense: the soft numeral, a small part-of-speech eyebrow, the definition. */
const SenseRow = ({ n, partOfSpeech, children }: { n: number; partOfSpeech?: string; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <GuideNumeral n={n} accent={READ_ACCENT} />
    <div className="min-w-0 pt-0.5">
      {partOfSpeech && (
        <div className={`font-black uppercase leading-none mb-1 ${EYEBROW_INK.className}`} style={{ ...EYEBROW_INK.style, fontSize: 10, letterSpacing: '1px' }}>
          {partOfSpeech}
        </div>
      )}
      <p className="m-0" style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--color-text)' }}>{children}</p>
    </div>
  </li>
);

export default async function WordOfDayPage({ params }: Props) {
  const date = parseDateKey(params.date);
  if (!date) notFound();

  // Don't expose future days. +1 tolerance: this renders on a UTC server, so a
  // viewer ahead of UTC has a local "today" the server still considers
  // tomorrow — without the allowance their own featured day 404s every evening.
  const todayIdx = daysSinceEpoch(new Date());
  if (daysSinceEpoch(date) > todayIdx + 1) notFound();

  const entry = await wordOfDay(date);
  const w = entry.word.toUpperCase();
  const analysis = wordPlayAnalysis(entry.word);
  const insights = wordInsights(entry.word);

  // Calendar arithmetic, not ±86400000 — local-midnight dates shift by an hour
  // across DST, which would flip the neighboring dateKey.
  const prev = dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const hasNext = daysSinceEpoch(nextDate) <= todayIdx + 1;
  const next = dateKey(nextDate);

  const topFacts = insights.letterFacts.slice(0, 3);

  return (
    <PageBackground tint="home" className="min-h-screen pb-16">
      <div className="info-page max-w-2xl mx-auto px-4 pt-6">
        {/* §255 (founder: "there is no way to go home on the word of the day
            screen... on the native versions there is an X to close the window"):
            the back link only went up to the archive index. An X on the right
            returns to the home screen, as the natives do. */}
        {/* HEADER_SPEC §4: the shared page header — back circle to the archive, X home, I (the Word of the Day host). */}
        <PageHeader
          className="mb-6"
          title="Word of the Day"
          art="art-titlecast-wotd"
          titleTag="div"
          back={{ href: '/words', label: 'All words' }}
          close={{ href: '/', label: 'Close and return home' }}
        />

        <div className="flex flex-col gap-7 mb-8">
          {/* The hero: guide hero card, I "ready", the word in the brand caps (the page's h1). */}
          <GuideHeroCard accent={WOTD_ACCENT} host="i" poseSize={96} priority className="px-5 pt-3 pb-5 gap-2">
            <p className={`m-0 font-black uppercase ${EYEBROW_INK.className}`} style={{ ...EYEBROW_INK.style, fontSize: 11, letterSpacing: '1.2px' }}>
              Word of the Day · {prettyDate(date)}
            </p>
            <GuideWordmark>{w}</GuideWordmark>
            {(entry.phonetic || entry.partOfSpeech) && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {entry.phonetic && (
                  <span className="font-bold" style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>{entry.phonetic}</span>
                )}
                {entry.partOfSpeech && <ReadChip accent={READ_ACCENT}>{entry.partOfSpeech}</ReadChip>}
              </div>
            )}
          </GuideHeroCard>

          {/* Definition (dictionary): numbered senses, the example as a highlighted line. */}
          {entry.definition && (
            <section className="flex flex-col gap-3.5">
              <SectionLabel>Meaning</SectionLabel>
              <ol className="m-0 p-0 list-none flex flex-col gap-3.5">
                <SenseRow n={1} partOfSpeech={entry.partOfSpeech}>{entry.definition}</SenseRow>
                {(entry.extraSenses ?? []).map((s, i) => (
                  <SenseRow key={i} n={i + 2} partOfSpeech={s.partOfSpeech}>{s.definition}</SenseRow>
                ))}
              </ol>
              {entry.example && (
                <GuideTakeaway accent={READ_ACCENT}><em>“{entry.example}”</em></GuideTakeaway>
              )}
              {(entry.synonyms?.length || entry.antonyms?.length) ? (
                <div className="flex flex-col gap-1.5">
                  {entry.synonyms && entry.synonyms.length > 0 && (
                    <p className="m-0 text-sm" style={{ color: 'var(--color-text)' }}>
                      <span className={`font-black uppercase mr-2 ${EYEBROW_INK.className}`} style={{ ...EYEBROW_INK.style, fontSize: 10, letterSpacing: '1px' }}>Similar</span>
                      {entry.synonyms.join(', ')}
                    </p>
                  )}
                  {entry.antonyms && entry.antonyms.length > 0 && (
                    <p className="m-0 text-sm" style={{ color: 'var(--color-text)' }}>
                      <span className={`font-black uppercase mr-2 ${EYEBROW_INK.className}`} style={{ ...EYEBROW_INK.style, fontSize: 10, letterSpacing: '1px' }}>Opposite</span>
                      {entry.antonyms.join(', ')}
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          )}

          {/* ORIGINAL: letter analysis — unique, factual, useful for word-puzzle players */}
          <section className="flex flex-col gap-3">
            <SectionLabel>{w} as a puzzle answer</SectionLabel>
            <GuideTakeaway accent={AMBER}>{analysis.summary}</GuideTakeaway>
            <GuideBody>{analysis.strategy}</GuideBody>
          </section>

          {/* ORIGINAL: by the numbers — first-party stats from the curated answer bank */}
          <section className="flex flex-col gap-3">
            <SectionLabel>{w} by the numbers</SectionLabel>
            <GuideBody>
              Across the {BANK_SIZE.toLocaleString()} curated answers in the Wordocious bank,{' '}
              {topFacts.map((f, i) => (
                <span key={f.letter}>
                  <strong>{f.letter}</strong> appears in {f.pct}% of answers (the {ordinal(f.rank)} most common letter)
                  {i < topFacts.length - 1 ? ', ' : '. '}
                </span>
              ))}
              {insights.sameStartCount > 0
                ? `${insights.sameStartCount} other answer${insights.sameStartCount === 1 ? '' : 's'} share the opening “${insights.prefix}-”, so two purple tiles up front still leave real guessing to do.`
                : `No other answer in the bank opens with “${insights.prefix}-”, so locking those first two letters all but gives it away.`}
            </GuideBody>
            <GuideBody>
              <strong>Difficulty:</strong> {insights.difficulty}/5 — {insights.difficultyLabel}, because {insights.difficultyWhy}.
            </GuideBody>
          </section>

          {/* ORIGINAL: near misses & anagrams from the answer bank */}
          {(insights.neighbors.length > 0 || insights.anagrams.length > 0) && (
            <section className="flex flex-col gap-3">
              <SectionLabel>Near misses</SectionLabel>
              {insights.neighbors.length > 0 && (
                <GuideBody>
                  One letter away in the answer bank: <strong>{insights.neighbors.join(', ')}</strong>. Each of these turns four
                  tiles purple against {w} — the classic endgame squeeze where spending a guess on the differing letter beats
                  burning attempts on hope.
                </GuideBody>
              )}
              {insights.anagrams.length > 0 && (
                <GuideBody>
                  Same letters, different order: <strong>{insights.anagrams.join(', ')}</strong> — amber-heavy boards can be
                  hiding {insights.anagrams.length === 1 ? 'this anagram' : 'one of these anagrams'} instead.
                </GuideBody>
              )}
            </section>
          )}

          {/* Play CTA — internal links into the game modes */}
          <section className="flex flex-col gap-3">
            <SectionLabel>Put it to use</SectionLabel>
            <GuideBody>
              Words like {w} are exactly what the daily puzzles throw at you. Warm up in{' '}
              <Link href="/practice" className="font-bold" style={{ color: '#7c3aed' }}>Practice</Link>, race the clock in the{' '}
              <Link href="/" className="font-bold" style={{ color: '#7c3aed' }}>Daily Challenge</Link>, or study the{' '}
              <Link href="/strategy/best-starting-words" className="font-bold" style={{ color: '#7c3aed' }}>best starting words</Link>{' '}
              before your next run. New to the multi-board modes? The{' '}
              <Link href="/guides" className="font-bold" style={{ color: '#7c3aed' }}>mode guides</Link> cover every mode.
            </GuideBody>
          </section>
        </div>

        {/* Prev / next day */}
        <div className="flex items-center justify-between">
          {/* A8: candy buttons. */}
          <CandyLink href={`/word/${prev}`} color="peach" size="sm" icon={<ChevronLeft className="w-4 h-4" aria-hidden="true" />}>
            {prev}
          </CandyLink>
          {hasNext && (
            <CandyLink href={`/word/${next}`} color="peach" size="sm" trailing={<ChevronRight className="w-4 h-4" aria-hidden="true" />}>
              {next}
            </CandyLink>
          )}
        </div>

        <p className="text-[11px] mt-8 px-1" style={{ color: 'var(--color-text-secondary)' }}>
          Definitions adapted from Wiktionary via the Free Dictionary API (CC BY-SA). Letter statistics, difficulty ratings,
          and near-miss analysis are original Wordocious research computed from our curated answer list.
        </p>
      </div>
    </PageBackground>
  );
}
