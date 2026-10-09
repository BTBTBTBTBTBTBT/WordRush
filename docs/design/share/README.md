# Share-card samples (founder 10-06: full game title at the top)

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
