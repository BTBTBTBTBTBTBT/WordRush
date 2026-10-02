# WORDOCIOUS social creative package (2026-10-02)

Everything in `out/` is ready to upload. Re-render it all with
`python3 docs/design/brand/social/compose-social.py` (about 30 s). The images are built
from the brand kit, so they match the app:
- a code-drawn sky with glossy letter tiles (`kit.py`, the same tile as the in-app initials
  avatars, ART_SPEC §20)
- the cast hero art (`cast/hero`)
- the chunky WORDOCIOUS wordmark (`wordmark-keyed.png`, made in ChatGPT)
- Nunito Black for the copy

| Channel | File | Where it goes / notes |
|---|---|---|
| All | `profile-pictures/current-app-icon-1080.png` | Profile photo everywhere today (matches the store icon). |
| All | `profile-pictures/icon-B-w-mascot-1080-USE-WHEN-APP-ICON-SWITCHES.png` | Switch to this the day the app icon changes to B. Circle-crop safe. |
| All | `profile-pictures/w-letter-tile-1080.png` | Alternate: the W letter tile (same style as the new avatars). |
| X / Twitter | `x-twitter/header-1500x500.png` | Header. Bottom-left is left open for your profile photo. |
| Facebook | `facebook/cover-1640x624.png` | Page cover. Phones crop the sides; the content is centered. |
| Facebook | `facebook/post-cast-1200x1200.png` | First feed post ("meet the cast"). |
| Instagram | `instagram/post-cast-1080x1080.png`, `post-cast-1080x1350.png` | Feed posts (square / portrait). |
| Instagram | `instagram/story-1080x1920.png` | Story / Reel cover. |
| Instagram | `instagram/cast-carousel/01…10` | 10-slide "Meet the cast" carousel, 1080×1350, one character per slide in WORDOCIOUS order. |
| Instagram | `instagram/highlight-covers/*` | Story highlight covers: daily, games, vs, friends, tips, news, wins, zen. |
| TikTok | `tiktok/cover-1080x1920.png` | Video cover / pinned post. |
| YouTube | `youtube/banner-2560x1440.png` | Channel art. Everything important is in the 1546×423 center safe area. |
| LinkedIn | `linkedin/company-cover-1128x191.png` | Company page cover. |
| LinkedIn | `linkedin/personal-cover-1584x396.png` | Personal profile background (photo bottom-left). |
| Pinterest | `pinterest/pin-1000x1500.png` | Pin. |
| Discord | `discord/server-banner-960x540.png`, `invite-splash-1920x1080.png` | Server banner + invite splash. |
| Web | `web/og-image-1200x630.png` | Link-preview image (iMessage, Slack, Discord, X cards). Not wired into the site yet. |

Copy used: "DAILY WORD GAMES", "Same puzzles for everyone · iPhone, Android & web",
"Play today's puzzles", wordocious.com, and one line per character on the carousel slides
(edit `ROLES` / `TAGLINE` in compose-social.py and re-run to change any of it).
