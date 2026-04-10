import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://spellstrike.vercel.app';

  const routes = [
    '/',
    '/daily',
    '/practice',
    '/quordle',
    '/octordle',
    '/sequence',
    '/rescue',
    '/gauntlet',
    '/propernoundle',
    '/pro',
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
