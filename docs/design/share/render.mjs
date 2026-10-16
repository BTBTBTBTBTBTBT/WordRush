// Renders every game's web share card into docs/design/share/out/ (founder
// 10-06: the title art must sit fully on the card). Usage, from the repo root:
//   node docs/design/share/render.mjs [path/to/playwright-core]
// (macOS: uses /Applications/Google Chrome.app headless; PLAYWRIGHT_CHROMIUM overrides.)
// Bundles entry.ts with esbuild, serves apps/web/public, draws the cards in
// headless Chromium (/opt/pw-browsers or PLAYWRIGHT_CHROMIUM) and writes PNGs.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const web = join(root, 'apps/web');
const require = createRequire(join(web, 'package.json'));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).filter((d) => d.startsWith('esbuild@')).sort().pop();
const esbuild = createRequire(join(pnpmDir, esbuildPkg, 'node_modules/esbuild/package.json'))('esbuild');
const { chromium } = await import(process.argv[2] ?? 'playwright-core');

const bundle = await esbuild.build({
  entryPoints: [join(here, 'entry.ts')],
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020',
  alias: { '@': web, '@wordle-duel/core': join(root, 'packages/core/src') },
  nodePaths: [join(web, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
  external: ['fs', 'stream', 'zlib'],
  logLevel: 'error',
});
const js = bundle.outputFiles[0].text;
const html = '<!doctype html><html><body style="font-family: system-ui, -apple-system, Helvetica, sans-serif"><script src="/bundle.js"></script></body></html>';
const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') { res.end(html); return; }
  if (path === '/bundle.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return; }
  try {
    const body = await readFile(join(web, 'public', path));
    res.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const port = server.address().port;

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const exe = process.env.PLAYWRIGHT_CHROMIUM ?? (existsSync(MAC_CHROME) ? MAC_CHROME : null) ?? ['/opt/pw-browsers/chromium', ...readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)].find((p) => existsSync(p) && !p.endsWith('/chromium'));
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://localhost:${port}/${process.env.SHARE_SEASON ? `?season=${process.env.SHARE_SEASON}` : ''}`);
const outDir = process.env.SHARE_OUT ? resolve(process.env.SHARE_OUT) : join(here, 'out');
await mkdir(outDir, { recursive: true });
// Pass 1: a guest's cards (no hero band) -> web-<id>.png; pass 2: a signed-in sender's -> webhero-<id>.png.
for (const [withHero, prefix] of process.env.SHARE_GUEST_ONLY ? [[false, 'web']] : [[false, 'web'], [true, 'webhero']]) {
  const cards = await page.evaluate((h) => window.renderAll(h), withHero);
  for (const { id, url } of cards) {
    if (!url) { console.error(`${id}: no image`); continue; }
    await writeFile(join(outDir, `${prefix}-${id}${process.env.SHARE_SUFFIX ?? ''}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`${prefix}-${id}${process.env.SHARE_SUFFIX ?? ''}.png`);
  }
}
await browser.close();
server.close();
