import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wordocious.com';

  // ONLY crawlable, unique-content pages. Game routes serve a UNIQUE
  // mode-specific public landing to logged-out crawlers (auth-gate
  // MODE_LANDING_PATHS → ModeLanding, built from that mode's guide content),
  // so they're indexable pages now, not duplicates of the generic Landing.
  const routes = [
    '/',                       // Landing (marketing content for logged-out crawlers)
    '/practice',               // Per-mode public landings (rules/scoring/strategy)
    '/six',
    '/seven',
    '/quadword',
    '/octoword',
    '/sequence',
    '/rescue',
    '/gauntlet',
    '/propernoundle',
    '/pro',                    // Pro feature overview (now public — see auth-gate PUBLIC_PATHS)
    '/how-to-play',
    '/guides',
    '/guides/classic',
    '/guides/six',
    '/guides/seven',
    '/guides/quadword',
    '/guides/octoword',
    '/guides/succession',
    '/guides/deliverance',
    '/guides/gauntlet',
    '/guides/propernoundle',
    '/words',
    '/strategy',
    '/strategy/best-starting-words',
    '/strategy/solve-faster',
    '/strategy/modes-explained',
    '/strategy/multi-board-mastery',
    '/strategy/gauntlet-survival',
    '/strategy/propernoundle-playbook',
    '/strategy/daily-sweep-guide',
    '/strategy/letter-frequency-atlas',
    '/strategy/repeated-letter-traps',
    '/strategy/beginner-to-sweeper',
    '/strategy/vs-battle-tactics',
    '/about',
    '/faq',
    '/privacy',
    '/terms',
    '/support',
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' || route === '/words' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.8,
  }));

  // §229: the Word of the Day date pages are noindex for now — 60 templated
  // pages outnumbered the site's real content 60:40 in this sitemap, and
  // AdSense's "low value content" classifier treats that as auto-generated.
  // They stay live and linked from /words; they return to the sitemap once
  // each carries substantial unique content.
  return staticEntries;
}
