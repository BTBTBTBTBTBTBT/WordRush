# Share-card samples (founder 10-06: full game title at the top; 10-12: never taller than 3:4)

Every game's web share card, drawn by the real renderers (`apps/web/lib/share-image.ts`,
`vs-share-image.ts`) from the fixtures in `apps/web/lib/share-samples.ts`.

```sh
# from the repo root (needs `pnpm install` and a playwright-core install anywhere)
node docs/design/share/render.mjs /path/to/node_modules/playwright-core/index.mjs
python3 docs/design/share/contact.py web
```

`out/web-*.png` are the full 1080-wide cards (local only, git-ignored); `out/web-*.jpg` are
half-size previews and `out/_contact-web.jpg` is every card side by side.

iOS (SwiftUI `ImageRenderer`) and Android (`Canvas`) cards can't be rendered in the cloud
container (no Xcode / Android SDK) — check them on a device: share Classic 4/6, QuadWord,
OctoWord, Gauntlet, a Puzzles game and a VS result, and confirm the whole title shows.

## 3:4 cap (founder 10-12)

iMessage shows an image in a bubble of at most ~3:4 and center-crops anything taller, which cut the title and the
stat chips off cards that had grown to 9:16 under the sender's hero band. A message card is now 1080 x 1350 (4:5) ..
1080 x 1440 (3:4), the hero band is 190 + 8 px, the gaps are tighter and the cast wordmark is 80% wide. The render
harness draws every card twice: `web-<id>.png` (a guest, no hero band) and `webhero-<id>.png` (a signed-in sender).
`python3 docs/design/share/contact34.py` lays selected cards on 3:4 frames -> `docs/design/review/share-3x4-contact.png`.
