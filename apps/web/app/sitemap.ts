import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wordocious.com';

  // ONLY crawlable, unique-content pages. The game routes (/six, /quordle, /daily,
  // …) are login-gated and serve the SAME Landing to logged-out crawlers — listing
  // them created ~10 duplicate pages, which reads as "low value content" to AdSense.
  const routes = [
    '/',                       // Landing (marketing content for logged-out crawlers)
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
    '/about',
    '/faq',
    '/privacy',
    '/terms',
    '/support',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.8,
  }));
}
