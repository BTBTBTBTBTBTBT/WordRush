# VS multiplayer — setup + testing

The native VS client is fully built against the socket.io protocol
(apps/server/src/types.ts) and compiles. Two things remain to make live
matches work + verifiable:

## 1. Confirm the socket server URL (one line)

`VSConfig.serverURL` is set to `https://wordocious-server.onrender.com`, derived
from the Render service name in `render.yaml`. **A direct probe returned Render's
`x-render-routing: no-server`** — meaning either the free instance was spun down,
or the deployed subdomain differs from the default.

➡️ Open the Render dashboard, copy the **exact** service URL (it equals Vercel's
`NEXT_PUBLIC_SERVER_URL`), and set it in `Wordocious/Sources/VSConfig.swift`.
If it's already correct, the free instance just needs a moment to cold-start on
the first connection.

Until a real URL responds, the VS match screen shows a graceful "VS is almost
ready" state instead of hanging.

## 2. Test a live match (needs two players)

VS is real-time, so you need two clients on the same puzzle:
- **Sim + web**: run the iOS app (signed in) and open wordocious.com in a browser
  (signed into a different account). Start the same mode's VS on both → they queue
  and pair.
- **Two sims**: boot a second simulator, run a second signed-in account.
- **Private match**: on the Pro path, "Create a private match" → share the code →
  the other client "Join with a code". Both pair directly (skips the public queue).

## What's implemented (parity with vs-game.tsx)

- **Protocol**: all 21 events (VSProtocol/VSMatchService), connect-with-auth
  (presenceId), submit_guess / board_solved / player_completed / stage relay.
- **State machine** (VSMatchViewModel): queue → match-found countdown → match →
  waiting → result → rematch; opponent-left + error handling.
- **Match UI** (VSGameView): reuses the solo board + keyboard (engine-driven from
  the match seed), live opponent progress strip, result screen (Victory/Draw/Defeat
  + score breakdown), rematch offer/accept/decline.
- **Lobby** (VSLobbyView): free = one daily Classic VS (with "already played today"
  read-only screen + Pro upsell); Pro = all standard modes + private-match invites
  (create code / join by code) + rematches.
- **Recording**: on match_ended, records the result with `play_type: 'vs'` via
  GameResultsService (user_stats + profile XP/streak), mirroring the web.
- **Invites** (InviteService): match_invites row (code + game_mode), 1:1 with
  apps/web/lib/invite-service.ts (same code alphabet); server pairs on the code.

## Follow-ups (out of this pass)

- **Gauntlet VS** and **ProperNoundle VS**: bespoke flows (gauntlet stage
  transitions; ProperNoundle uses its own engine/puzzleMetadata, not GameViewModel).
  The 7 standard board modes (Classic, Six, Seven, QuadWord, OctoWord, Succession,
  Deliverance) are supported now.
- Opponent live mini-board tiles are received and stored (opponent.tiles) but the
  match UI currently shows opponent **progress** (attempts + boards solved); add a
  mini-board render if desired.
