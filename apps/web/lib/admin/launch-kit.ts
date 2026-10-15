/**
 * The written launch kit (press, Product Hunt, founder posts, bios) as shown in Social Studio > JP's plan.
 * The text lives in docs/marketing/jp45/*.md; scripts/launch-kit-gen.mjs turns it into launch-kit.generated.ts, and
 * a vitest guard fails if the two drift. JP sends and posts all of it himself; nothing here publishes anything.
 */
import { LAUNCH_KIT_RAW, PRESS_ONE_PAGER_HTML, type LaunchKitSection } from './launch-kit.generated';

export type { LaunchKitSection };

export interface LaunchKitDoc {
  id: string;
  title: string;
  /** The "Draft for JP" paragraph under the title. */
  intro: string;
  /** Short line for the collapsed row. */
  blurb: string;
  sections: LaunchKitSection[];
  /** The whole markdown file, for the Copy all button. */
  markdown: string;
  /** Setup tasks this doc serves. */
  setup: readonly string[];
}

const META: Record<string, { blurb: string; setup: readonly string[] }> = {
  'press-one-pager': { blurb: 'One page: what it is, the 18 games, the family origin, links and contact. Print the HTML to PDF.', setup: ['S6'] },
  'press-list': { blurb: '15 outlets with the public tips page for each; every unverified route is marked.', setup: ['S6'] },
  'press-emails': { blurb: 'Launch pitch (Oct 16), follow-up, Product Hunt nudge (Oct 27), Thanksgiving pitch (Nov 17).', setup: ['S6'] },
  'product-hunt': { blurb: 'Name, tagline, description, topics, maker comment, quiz thread, captions and the day-of checklist.', setup: ['S6'] },
  'founder-posts': { blurb: "JP's LinkedIn launch story, the founder X thread, two build-in-public posts.", setup: ['S4', 'S6'] },
  'bios': { blurb: 'One-line bio and the exact tracked /go link for every channel.', setup: ['S3'] },
};

export const LAUNCH_KIT: readonly LaunchKitDoc[] = LAUNCH_KIT_RAW.map((d) => ({
  id: d.id,
  title: d.title,
  intro: d.intro,
  blurb: META[d.id]?.blurb ?? '',
  sections: d.sections,
  markdown: d.markdown,
  setup: META[d.id]?.setup ?? [],
}));

export const PRESS_ONE_PAGER_PRINTABLE = PRESS_ONE_PAGER_HTML;

export function kitDoc(id: string): LaunchKitDoc | undefined {
  return LAUNCH_KIT.find((d) => d.id === id);
}
